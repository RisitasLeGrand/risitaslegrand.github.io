/**
 * Les faits de domaine, côté base : écrire au journal, socler, matérialiser.
 *
 * `noyau/enregistrements.ts` tient les règles et ne touche à rien. Ce module
 * leur donne IndexedDB.
 *
 * ## Deux écritures, et pourquoi ce n'est pas un défaut
 *
 * Enregistrer un QCM écrit dans `quiz`, puis dans `operations`. Les deux ne
 * sont pas dans la même transaction, et on pourrait croire qu'il manque une
 * garantie : si la seconde échoue, l'enregistrement existe sans voyager.
 *
 * C'est vrai, et c'est **réparable** — précisément parce que le socle est
 * déterministe. `soclerFaitsDomaine` journalise tout ce qui n'a pas d'opération,
 * et il est idempotent : le rejouer ne coûte qu'une lecture. Il tourne avant
 * chaque fabrication de paquet, donc avant que la question « qu'est-ce qui
 * voyage ? » se pose.
 *
 * Une transaction commune aurait d'ailleurs demandé de prendre l'horloge
 * logique **dans** la transaction, alors que l'horloge est elle-même persistée
 * dans `etat` et sérialisée par une file. Deux verrous imbriqués pour garantir
 * ce qu'une réparation idempotente donne gratuitement : le marché n'était pas
 * bon.
 */
import { db, lireAppareil, toutesLesOperations } from '../db';
import { prochaineHlc } from './horloge-locale';
import { decoderHlc } from '../noyau/hlc';
import { operation, SANS_LOT, type Operation } from '../noyau/operations';
import { TYPE_SUPPRESSION } from '../noyau/fusion';
import { resolutions } from '../noyau/corrections';
import { ulid } from '../noyau/ulid';
import {
  MAGASINS_JOURNALISES,
  cibleDe,
  lireCible,
  magasinJournalise,
  materialiser,
  operationSocle,
  type ChargeEnregistrement,
  type Materialisation,
} from '../noyau/enregistrements';

/**
 * Journalise un enregistrement qui vient d'être écrit dans son magasin.
 *
 * Volontairement tolérante : un échec ici ne doit pas faire perdre la session
 * de la personne, qui est déjà enregistrée. Le socle la rattrapera.
 */
export async function journaliserEnregistrement(
  magasin: string,
  enregistrement: Record<string, unknown>,
): Promise<Operation | null> {
  const declare = magasinJournalise(magasin);
  if (!declare) return null;
  const clef = enregistrement[declare.clef];
  if (typeof clef !== 'string' || !clef) return null;
  try {
    const op = operation({
      id: ulid(),
      appareil: await lireAppareil(),
      hlc: decoderHlc(await prochaineHlc()),
      type: declare.type,
      cible: cibleDe(magasin, clef),
      lot: SANS_LOT,
      charge: { magasin, enregistrement } satisfies ChargeEnregistrement,
    });
    await (await db()).put('operations', op);
    return op;
  } catch {
    return null;
  }
}

/**
 * Journalise la suppression d'enregistrements.
 *
 * Une suppression est une **opération**, pas une absence. Sans elle, effacer
 * une séance ici la verrait revenir à la première synchronisation : l'autre
 * appareil porte encore son opération d'écriture, et la matérialisation la
 * réécrirait. C'est précisément le cas que le type `suppression` existe pour
 * empêcher, et l'effacement ciblé doit donc passer par ici.
 */
export async function journaliserSuppressions(cibles: readonly string[]): Promise<number> {
  const aJournaliser = cibles.filter((c) => lireCible(c) !== null);
  if (!aJournaliser.length) return 0;
  const appareil = await lireAppareil();
  const base = await db();
  let ecrites = 0;
  for (const cible of aJournaliser) {
    try {
      const op = operation({
        id: ulid(),
        appareil,
        hlc: decoderHlc(await prochaineHlc()),
        type: TYPE_SUPPRESSION,
        cible,
        lot: SANS_LOT,
        charge: {},
      });
      await base.put('operations', op);
      ecrites += 1;
    } catch {
      // Même raison qu'à l'écriture : l'effacement local a déjà eu lieu, et une
      // suppression manquée se verra à la prochaine réparation.
    }
  }
  return ecrites;
}

export interface RapportSocle {
  /** Le nombre d'opérations de socle écrites, par magasin. */
  parMagasin: Record<string, number>;
  total: number;
}

/**
 * Fait entrer au journal tout enregistrement qui n'y est pas encore.
 *
 * C'est à la fois la **migration** de l'existant et la **réparation** d'une
 * journalisation manquée. Les deux sont le même geste, et les confondre est le
 * bon choix : un code de migration qui ne tourne qu'une fois est un code qu'on
 * ne saura pas rejouer le jour où il aura échoué à moitié.
 */
export async function soclerFaitsDomaine(): Promise<RapportSocle> {
  const base = await db();
  const operations = await toutesLesOperations();
  /*
     Ce que le journal connaît déjà. Pour un magasin à socle **partagé**, une
     opération de n'importe quel appareil suffit : l'enregistrement est le même
     des deux côtés. Pour un magasin à socle **par appareil**, il faut une
     opération **de cet appareil** — celle de l'autre décrit sa version, pas la
     nôtre, et s'en contenter ferait disparaître la moitié de l'histoire.
  */
  const connues = new Set<string>();
  for (const op of operations) {
    const defaite = lireCible(op.cible);
    if (!defaite) continue;
    connues.add(op.cible);
    connues.add(`${op.cible}\u0000${op.appareil}`);
  }

  const parMagasin: Record<string, number> = {};
  let total = 0;
  const soi = await lireAppareil();
  for (const declare of MAGASINS_JOURNALISES) {
    const enregistrements = (await base.getAll(
      declare.magasin as never,
    )) as unknown as Record<string, unknown>[];
    const aEcrire: Operation[] = [];
    for (const enregistrement of enregistrements) {
      const clef = enregistrement[declare.clef];
      if (typeof clef !== 'string' || !clef) continue;
      const cible = cibleDe(declare.magasin, clef);
      const dejaLa =
        declare.soclePar === 'appareil'
          ? connues.has(`${cible}\u0000${soi}`)
          : connues.has(cible);
      if (dejaLa) continue;
      const op = operationSocle(declare.magasin, enregistrement, soi);
      if (op) aEcrire.push(op);
    }
    if (!aEcrire.length) continue;
    const tx = base.transaction('operations', 'readwrite');
    for (const op of aEcrire) await tx.objectStore('operations').put(op);
    await tx.done;
    parMagasin[declare.magasin] = aEcrire.length;
    total += aEcrire.length;
  }
  return { parMagasin, total };
}

export interface RapportMaterialisation extends Materialisation {
  ecrits: number;
  effaces: number;
}

/**
 * Écrit dans les magasins ce que le journal dit des cibles demandées.
 *
 * Appelée après une fusion, avec les cibles que le paquet apportait :
 * matérialiser tout le journal serait juste et cher, et ne sert qu'à la
 * réparation — d'où `cibles` facultatif, exactement comme le recalcul FSRS ne
 * recalcule que les cartes touchées.
 */
export async function materialiserFaitsDomaine(
  cibles?: Iterable<string>,
): Promise<RapportMaterialisation> {
  const base = await db();
  const operations = await toutesLesOperations();
  /*
     Les réponses aux conflits sont lues du journal, et non d'un état local :
     une résolution est une opération, donc elle voyage, donc les deux appareils
     matérialisent la même version. C'est tout l'intérêt de l'avoir faite
     journalisée à la phase 4c.
  */
  const plan = materialiser(operations, {
    ...(cibles ? { cibles } : {}),
    retenues: resolutions(operations),
  });

  let ecrits = 0;
  for (const aEcrire of plan.aEcrire) {
    await base.put(aEcrire.magasin as never, aEcrire.enregistrement as never);
    ecrits += 1;
  }
  let effaces = 0;
  for (const aEffacer of plan.aEffacer) {
    await base.delete(aEffacer.magasin as never, aEffacer.clef as never);
    effaces += 1;
  }
  return { ...plan, ecrits, effaces };
}
