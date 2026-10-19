/**
 * L'effacement ciblé : savoir d'abord, effacer ensuite.
 *
 * ## Le principe, et il n'est pas négociable
 *
 * Aucune fonction de ce module n'efface sans qu'on ait pu compter d'abord.
 * `compter()` dit exactement ce qui partirait ; `effacer()` prend le même
 * argument et le fait. Deux appels, le même filtre, et c'est l'appelant qui
 * décide entre les deux.
 *
 * La raison est qu'un effacement est la seule opération du site qui soit
 * **définitive sans recours**, sauvegarde mise à part. Une restauration se
 * défait en restaurant autre chose ; un effacement ne se défait pas. Afficher
 * « 1 470 séances et 1 495 notes vont être effacées » avant de demander
 * confirmation n'est donc pas une politesse, c'est la seule protection qui
 * reste quand la personne s'est trompée de groupe.
 */
import { MAGASINS_PROGRESSION, db } from '../db';
import { CHAMP_DATE, clefVisee, dateDe, groupe, type ClefsVisees } from './groupes';
import { cibleDe, magasinJournalise } from '../noyau/enregistrements';

/** Le filtre d'un effacement. Un groupe, et éventuellement une période. */
export interface Cible {
  /** Identifiants de groupes (`groupes.ts`). */
  groupes: readonly string[];
  /** Bornes incluses, au format `AAAA-MM-JJ`. Absentes = tout l'historique. */
  depuis?: string;
  jusqua?: string;
}

export interface CompteParMagasin {
  magasin: string;
  /** Combien d'enregistrements la cible désigne. */
  vises: number;
  /** Combien le magasin en porte en tout. */
  total: number;
  /**
   * Renseigné quand une période est demandée sur un magasin qui n'en a pas.
   *
   * Le magasin est alors **laissé entier**, et l'appelant doit le dire : un
   * magasin épargné en silence ferait croire à un effacement complet qui n'a pas
   * eu lieu.
   */
  refus?: string;
}

export interface Decompte {
  parMagasin: CompteParMagasin[];
  vises: number;
  /** Magasins écartés parce qu'une période leur a été demandée en vain. */
  refuses: CompteParMagasin[];
}

const vide = (): Decompte => ({ parMagasin: [], vises: 0, refuses: [] });

/** Les magasins désignés par une cible, dédoublonnés et dans l'ordre du schéma. */
function magasinsDe(cible: Cible): string[] {
  const voulus = new Set<string>();
  for (const id of cible.groupes) {
    for (const nom of groupe(id)?.magasins ?? []) voulus.add(nom);
  }
  return MAGASINS_PROGRESSION.filter((nom) => voulus.has(nom));
}

/**
 * Les clés visées dans un magasin, ou `null` quand c'est le magasin entier.
 *
 * B-3 du 58 : le groupe « Réglages et profil » ne désigne plus le magasin
 * `etat`, mais une liste blanche de ses clés. Un magasin reste entier dès
 * qu'un SEUL des groupes demandés le désigne entier : deux cibles qui se
 * recouvrent ne doivent pas se restreindre l'une l'autre.
 */
function viseesDe(cible: Cible, magasin: string): ClefsVisees | null {
  const exactes = new Set<string>();
  const prefixes = new Set<string>();
  for (const id of cible.groupes) {
    const g = groupe(id);
    if (!g || !g.magasins.includes(magasin)) continue;
    const visees = g.clefs?.[magasin];
    // Un seul groupe qui prend le magasin entier l'emporte : on ne peut pas
    // effacer « moins » que ce que la personne a demandé.
    if (!visees) return null;
    for (const clef of visees.exactes) exactes.add(clef);
    for (const prefixe of visees.prefixes ?? []) prefixes.add(prefixe);
  }
  return { exactes: [...exactes], prefixes: [...prefixes] };
}

/**
 * Les clés présentes dans le magasin que la cible désigne vraiment.
 *
 * Les préfixes obligent à passer par les clés réelles : `selection:nback` est
 * un réglage, et aucune liste de noms exacts ne peut l'énumérer d'avance.
 */
async function clefsPresentes(
  base: Awaited<ReturnType<typeof db>>,
  magasin: string,
  visees: ClefsVisees,
): Promise<string[]> {
  const toutes = (await base.getAllKeys(magasin as never)) as unknown as unknown[];
  return toutes
    .filter((clef): clef is string => typeof clef === 'string')
    .filter((clef) => clefVisee(clef, visees));
}

/** Un enregistrement tombe-t-il dans la période demandée ? */
function dansLaPeriode(magasin: string, enregistrement: unknown, cible: Cible): boolean {
  if (!cible.depuis && !cible.jusqua) return true;
  const jour = dateDe(magasin, enregistrement);
  if (!jour) return false;
  if (cible.depuis && jour < cible.depuis) return false;
  if (cible.jusqua && jour > cible.jusqua) return false;
  return true;
}

/**
 * Compte sans rien toucher.
 *
 * C'est l'essai à blanc. Il lit les magasins visés, applique le filtre, et rend
 * les comptes — y compris ceux qu'il refuse de découper.
 */
export async function compter(cible: Cible): Promise<Decompte> {
  const noms = magasinsDe(cible);
  if (!noms.length) return vide();
  const avecPeriode = Boolean(cible.depuis || cible.jusqua);
  const base = await db();
  const sortie = vide();

  for (const nom of noms) {
    const magasin = nom as (typeof MAGASINS_PROGRESSION)[number];
    const visees = viseesDe(cible, nom);
    /*
       Quand le groupe ne désigne que des clés (B-3), on compte les clés
       visées **présentes**, et le total reste celui du magasin : annoncer
       « 14 sur 14 » pour un magasin dont on n'effacera que deux entrées
       serait exactement le mensonge que ce correctif retire, et annoncer
       « 2 sur 2 » en serait un autre.

       La période garde la main : `etat` porte un état courant et non un
       historique, donc une période ne le découpe pas, et le magasin tombe
       dans le refus ci-dessous — comme avant la B-3. Restreindre aux clés
       sans regarder la période aurait effacé TOUS les réglages sous
       prétexte qu'on en demandait une tranche.
    */
    if (visees && !(avecPeriode && CHAMP_DATE[nom] === null)) {
      const presentes = await clefsPresentes(base, nom, visees);
      const total = (await base.getAllKeys(magasin)).length;
      sortie.parMagasin.push({ magasin: nom, vises: presentes.length, total });
      sortie.vises += presentes.length;
      continue;
    }
    const tous = await base.getAll(magasin);
    const total = tous.length;

    if (avecPeriode && CHAMP_DATE[nom] === null) {
      const refus: CompteParMagasin = {
        magasin: nom,
        vises: 0,
        total,
        refus:
          'ce magasin porte un état courant et non un historique : une période ne le découpe pas',
      };
      sortie.parMagasin.push(refus);
      sortie.refuses.push(refus);
      continue;
    }

    const vises = avecPeriode
      ? tous.filter((e) => dansLaPeriode(nom, e, cible)).length
      : total;
    sortie.parMagasin.push({ magasin: nom, vises, total });
    sortie.vises += vises;
  }
  return sortie;
}

export interface ResultatEffacement {
  /**
   * Les suppressions entrées au journal, pour que l'effacement voyage.
   *
   * Zéro ne veut pas dire « raté » : seuls les magasins journalisés en
   * produisent. Un écart avec `total` est donc normal.
   */
  suppressionsJournalisees?: number;
  /** Ce qui a réellement été effacé, magasin par magasin. */
  effaces: Record<string, number>;
  total: number;
  /** Magasins laissés entiers, avec la raison. */
  refuses: CompteParMagasin[];
}

/**
 * Efface ce que la cible désigne.
 *
 * Sans période, le magasin est vidé en une opération. Avec une période, chaque
 * enregistrement est examiné et supprimé par sa clé — plus lent, et c'est le
 * prix d'un effacement qui ne déborde pas.
 *
 * L'appelant est **tenu** d'avoir proposé une sauvegarde avant d'arriver ici.
 * Ce module ne peut pas l'imposer ; l'écran, lui, ne démarre pas sans un choix
 * explicite entre « sauvegarder d'abord » et « continuer sans ».
 */
export async function effacer(cible: Cible): Promise<ResultatEffacement> {
  const noms = magasinsDe(cible);
  const avecPeriode = Boolean(cible.depuis || cible.jusqua);
  const base = await db();
  const effaces: Record<string, number> = {};
  const refuses: CompteParMagasin[] = [];
  let total = 0;

  /*
     Les cibles journalisées qui disparaissent doivent **le dire**. Un
     effacement qui ne journalise rien serait défait par la première
     synchronisation : l'autre appareil porte encore l'opération d'écriture, et
     la matérialisation réécrirait l'enregistrement. Une suppression est une
     opération, pas une absence.
  */
  const supprimees: string[] = [];

  /*
     Les réglages effacés doivent aussi quitter le registre versionné
     (`etat/reglagesSync`), qui garde une copie horodatée de chaque réglage
     synchronisé. Le registre n'est pas un réglage : c'est la machinerie qui
     les fait converger, et le jeter casserait la convergence. Mais le laisser
     intact aurait fait revenir le profil effacé à la première synchronisation,
     avec sa valeur et son horloge — un effacement qui se défait tout seul.
  */
  const registreARetirer: string[] = [];

  for (const nom of noms) {
    const magasin = nom as (typeof MAGASINS_PROGRESSION)[number];
    const journalise = magasinJournalise(nom);
    const visees = viseesDe(cible, nom);

    /*
       B-3 du 58 : clé par clé, jamais `clear()`. Le magasin `etat` porte
       l'identité de l'appareil, son horloge logique et l'enveloppe de la clé
       du coffre ; les vider rendait le coffre illisible avec le bon mot de
       passe, sous un libellé qui annonçait des réglages.
    */
    if (visees && !(avecPeriode && CHAMP_DATE[nom] === null)) {
      const presentes = await clefsPresentes(base, nom, visees);
      for (const clef of presentes) await base.delete(magasin, clef as never);
      effaces[nom] = presentes.length;
      total += presentes.length;
      if (nom === 'etat') registreARetirer.push(...presentes);
      continue;
    }

    if (avecPeriode && CHAMP_DATE[nom] === null) {
      refuses.push({
        magasin: nom,
        vises: 0,
        total: (await base.getAll(magasin)).length,
        refus:
          'ce magasin porte un état courant et non un historique : une période ne le découpe pas',
      });
      continue;
    }

    if (!avecPeriode) {
      const tous = (await base.getAll(magasin)) as unknown as Record<string, unknown>[];
      if (journalise) {
        for (const enregistrement of tous) {
          const clef = enregistrement[journalise.clef];
          if (typeof clef === 'string' && clef) supprimees.push(cibleDe(nom, clef));
        }
      }
      await base.clear(magasin);
      effaces[nom] = tous.length;
      total += tous.length;
      continue;
    }

    const tx = base.transaction(magasin, 'readwrite');
    const store = tx.objectStore(magasin);
    let curseur = await store.openCursor();
    let combien = 0;
    while (curseur) {
      if (dansLaPeriode(nom, curseur.value, cible)) {
        if (journalise) {
          const clef = (curseur.value as Record<string, unknown>)[journalise.clef];
          if (typeof clef === 'string' && clef) supprimees.push(cibleDe(nom, clef));
        }
        await curseur.delete();
        combien += 1;
      }
      curseur = await curseur.continue();
    }
    await tx.done;
    effaces[nom] = combien;
    total += combien;
  }

  /*
     Le registre versionné perd les entrées des réglages effacés. On le réécrit
     une fois, après la boucle, plutôt qu'à chaque clé : c'est une seule valeur
     dans `etat`, et la réécrire vingt fois n'aurait servi qu'à multiplier les
     occasions de la perdre à moitié.

     Aucune pierre tombale n'est posée : un autre appareil qui porte encore le
     réglage le renverra. C'est le sujet de l'A7 — « l'effacement ciblé dit
     qu'il se propage » — et il n'est pas tranché ici.
  */
  if (registreARetirer.length) {
    const registre = (await base.get('etat', 'reglagesSync')) as
      | Record<string, unknown>
      | undefined;
    if (registre) {
      let touche = false;
      for (const clef of registreARetirer) {
        if (clef in registre) {
          delete registre[clef];
          touche = true;
        }
      }
      if (touche) await base.put('etat', registre as never, 'reglagesSync' as never);
    }
  }

  /*
     L'import est dynamique pour la même raison qu'ailleurs : le journalisateur
     a besoin de l'horloge logique, qui a besoin de cette base.
  */
  let suppressionsJournalisees = 0;
  if (supprimees.length) {
    try {
      const { journaliserSuppressions } = await import('../sync/faits-domaine');
      suppressionsJournalisees = await journaliserSuppressions(supprimees);
    } catch {
      // L'effacement a eu lieu ; la suppression non journalisée se rattrape à
      // la réparation, et l'écran annonce le compte.
    }
  }

  return { effaces, total, refuses, suppressionsJournalisees };
}
