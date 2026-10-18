/**
 * Le magasin du centre de notifications — prompt 32, phase 1.
 *
 * ## Coffre fermé, on compte sans déchiffrer
 *
 * Deux lignes du prompt se tendent, et il faut les lire ensemble plutôt
 * que d'en choisir une :
 *
 * - le § 4.3 veut que le compteur s'annonce « 3 éléments à trancher » ;
 * - les essais du § 5 veulent que, coffre fermé, « rien ne soit compté,
 *   aucune mention chiffrée ».
 *
 * Elles se concilient par ce que la **décision N-1, option A, signée le
 * 15 octobre**, a posé : `genre` vit en clair à côté de `id`. Le compte
 * se fait donc sur un index clair, **sans rien déchiffrer** — aucun
 * contenu, aucune source, aucune date fine, et pas la moindre mention
 * « contenu chiffré » à l'écran. Ce que les essais interdisent, c'est de
 * compter ce qu'on a dû ouvrir ; pas de compter ce que le § 4.1 autorise
 * expressément à laisser en clair.
 *
 * C'est pourquoi `comptesDuCentre()` **n'exige pas le coffre** et que
 * `elementsDuCentre()` l'exige : la pastille vit coffre fermé, le panneau
 * non.
 *
 * ## Le filtre du cycle est appliqué à L'ÉCRITURE, pas à la lecture
 *
 * L'interdit 1 n° 3 veut qu'aucun élément touchant le cycle n'entre nulle
 * part. Filtrer à la lecture laisserait la donnée dans le magasin, donc
 * dans une base qu'un autre appareil fusionne et qu'un instantané copie.
 * Refuser à l'entrée est la seule façon qu'elle n'existe pas.
 *
 * ## Ce que le centre ne fait pas
 *
 * Il ne charge aucune branche. Les sources lui **déposent** leurs
 * éléments ; il ne va rien chercher. Un centre qui lirait les branches
 * pour se remplir ferait payer à chaque ouverture de page le coût de
 * toutes les branches, et rendrait l'état du coffre déterminant pour
 * l'affichage d'un compteur.
 */
import { db } from '../db';
import { coffreOuvert, exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import { suitLaSensibiliteDuCycle } from './filtre-cycle';
import { emettre } from './emission';
import { jourLogique } from '../noyau/jour-logique';
import {
  RETENTION_PAR_DEFAUT,
  compteDansLaPastille,
  controlerElement,
  peutEtreRange,
  sortDeLaRetention,
  type ElementDuCentre,
  type GenreDElement,
  type RetentionDuCentre,
} from './modele';

const MAGASIN = 'centreElements';

/** Ce que la pastille sait dire, coffre fermé comme coffre ouvert. */
export interface ComptesDuCentre {
  aTrancher: number;
  aSavoir: number;
}

/**
 * Les comptes, **sans ouvrir le coffre**.
 *
 * Lit `genre`, qui est en clair, et rien d'autre. Un enregistrement dont
 * le genre manque n'est pas compté : mieux vaut un compteur bas qu'un
 * compteur qui invente.
 */
export async function comptesDuCentre(): Promise<ComptesDuCentre> {
  const comptes: ComptesDuCentre = { aTrancher: 0, aSavoir: 0 };
  let rangees: unknown[];
  try {
    rangees = await (await db()).getAll(MAGASIN);
  } catch {
    /* Base absente ou refusée : zéro, et surtout pas une exception. */
    return comptes;
  }
  for (const rangee of rangees as Record<string, unknown>[]) {
    const genre = rangee.genre as GenreDElement | undefined;
    if (genre === 'a-trancher') comptes.aTrancher += 1;
    else if (genre === 'a-savoir') comptes.aSavoir += 1;
  }
  return comptes;
}

/**
 * Le compte de la pastille : les questions à trancher **non archivées**.
 *
 * Coffre fermé, l'état n'est pas lisible et toutes les questions comptent.
 * C'est le bon sens du côté sûr : une question à trancher ne s'archive
 * pas (§ 1 n° 8), donc le compte clair ne peut être que juste — et s'il
 * s'écartait, il surestimerait, ce qui ne fait taire aucun conflit.
 */
export const pastille = async (): Promise<number> => (await comptesDuCentre()).aTrancher;

/** Tous les éléments, déchiffrés. **Exige le coffre.** */
export async function elementsDuCentre(): Promise<ElementDuCentre[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll(MAGASIN)) as unknown as Record<string, unknown>[];
  return Promise.all(rangees.map((r) => ouvrir<ElementDuCentre>(cle, r)));
}

/**
 * Dépose un élément. **Exige le coffre**, et refuse ce qui touche au cycle.
 *
 * Le refus est une **valeur** et non une exception : une source qui
 * dépose en boucle ne doit pas voir son écran tomber parce qu'un élément
 * a été écarté. Elle apprend qu'il l'a été, et c'est tout ce qu'elle a à
 * savoir.
 */
export type Depot = { quoi: 'depose'; element: ElementDuCentre } | { quoi: 'ecarte'; pourquoi: string };

/**
 * Le contexte de filtrage, fourni par la source **au dépôt**.
 *
 * Il n'est **jamais stocké**. Le § 2.3 veut un élément sans contenu ; la
 * classe d'une molécule et la source visée sont du contenu, et des plus
 * sensibles. La source les connaît au moment où elle dépose, le filtre en
 * a besoin à cet instant, et ni l'un ni l'autre n'a de raison de les
 * garder ensuite.
 */
export interface ContexteDeDepot {
  classeMolecule?: string | null;
  viseLaSource?: string | null;
}

export async function deposer(
  element: ElementDuCentre,
  contexte: ContexteDeDepot = {},
): Promise<Depot> {
  const problemes = controlerElement(element);
  if (problemes.length) return { quoi: 'ecarte', pourquoi: problemes.join(' ') };

  /*
     Le filtre reçoit un SIGNAL, pas l'élément : il compare une source, une
     classe de molécule et la source visée. Lui passer l'élément entier
     l'exposerait à des champs qu'il n'a pas à connaître — et il est écrit
     pour ne rien ouvrir.
  */
  if (
    suitLaSensibiliteDuCycle({
      source: element.source,
      refSource: element.refSource,
      classeMolecule: contexte.classeMolecule ?? null,
      viseLaSource: contexte.viseLaSource ?? null,
    })
  ) {
    return {
      quoi: 'ecarte',
      pourquoi: 'Le centre ne porte rien qui touche au cycle (interdit 1 n° 3).',
    };
  }

  const cle = exigerLeCoffre();
  const base = await db();
  /*
     Est-il NEUF ? La question se pose avant l'écriture, et elle se pose ici
     plutôt que chez l'appelant : `deposer` est la porte unique du magasin, et
     la nouveauté calculée ailleurs finirait par diverger d'un appelant à
     l'autre. L'identifiant est un champ clair du scellé, donc lisible sans la
     clé.
  */
  const deja = Boolean(await base.get(MAGASIN, element.id));
  const scelle = await sceller(cle, MAGASIN, element as unknown as Record<string, unknown>);
  await base.put(MAGASIN, scelle as unknown as ElementDuCentre);

  /*
     LA TROISIÈME PORTE (§ 1 n° 3 : le centre, le compteur, la notification).

     `emettre` existait, avec ses six refus et son plafond quotidien — et
     **personne ne l'appelait**. Le centre se remplissait donc en silence :
     la seule façon d'apprendre qu'une question attendait était d'ouvrir le
     centre, c'est-à-dire de savoir déjà qu'il y avait quelque chose dedans.

     Elle est appelée ici, et seulement pour un élément NEUF : réémettre à
     chaque recensement ferait sonner le téléphone à chaque page pour une
     question posée une fois.

     Son échec n'annule pas le dépôt. Une notification qui ne part pas coûte
     un signal ; un dépôt annulé coûte l'élément lui-même, et c'est lui qui
     porte la question.
  */
  if (!deja) {
    try {
      await emettre(element, jourLogique());
    } catch {
      // Le service worker manque, ou le navigateur refuse : le centre, lui, a reçu.
    }
  }
  return { quoi: 'depose', element };
}

/**
 * Marque un élément lu. **Refuse une question non tranchée** (§ 1 n° 8).
 *
 * Sans ce refus, le centre offrirait un moyen de faire taire un conflit
 * sans le résoudre, ce qui est pire que de ne rien signaler.
 */
export async function marquerLu(id: string): Promise<Depot> {
  return changerLEtat(id, 'lu');
}

/** Archive un élément. Même refus, et pour la même raison. */
export async function archiver(id: string): Promise<Depot> {
  return changerLEtat(id, 'archive');
}

async function changerLEtat(id: string, etat: 'lu' | 'archive'): Promise<Depot> {
  const cle = exigerLeCoffre();
  const base = await db();
  const rangee = (await base.get(MAGASIN, id)) as unknown as Record<string, unknown> | undefined;
  if (!rangee) return { quoi: 'ecarte', pourquoi: 'Cet élément n’existe plus.' };

  const element = await ouvrir<ElementDuCentre>(cle, rangee);
  if (!peutEtreRange(element)) {
    return {
      quoi: 'ecarte',
      pourquoi:
        'Une question à trancher ne se range pas : elle quitte le centre quand sa source est résolue.',
    };
  }

  const change = { ...element, etat };
  const scelle = await sceller(cle, MAGASIN, change as unknown as Record<string, unknown>);
  await base.put(MAGASIN, scelle as unknown as ElementDuCentre);
  return { quoi: 'depose', element: change };
}

/**
 * Efface tous les éléments d'une source — l'effacement en cascade
 * (§ 1 n° 9).
 *
 * **Exige le coffre**, parce que la source est chiffrée : sans la clé on
 * ne sait pas quels enregistrements appartiennent à qui. Effacer au
 * jugé — par exemple tout le magasin — tiendrait la lettre de la cascade
 * en détruisant ce qu'elle ne visait pas.
 */
export async function purgerLaSource(source: string): Promise<number> {
  const base = await db();
  const elements = await elementsDuCentre();
  const vises = elements.filter((e) => e.source === source);
  for (const element of vises) await base.delete(MAGASIN, element.id);
  return vises.length;
}

/**
 * Retire un élément parce que **sa source est résolue**.
 *
 * C'est l'autre moitié du § 1 n° 8, et la seule porte de sortie d'une
 * question à trancher. `archiver` la refuse — on ne fait pas taire une
 * question en la regardant ; la rétention la refuse aussi, quel que soit
 * son âge. Il fallait donc un geste qui dise la bonne raison : le conflit
 * n'existe plus, l'élément non plus.
 *
 * N'exige pas le coffre et ne déchiffre rien : supprimer par clé ne
 * demande pas de lire. Un recenseur peut donc nettoyer ce qu'il a déposé
 * sans ouvrir, et `recenser` refuse de son côté pour une autre raison —
 * il doit *écrire*, donc sceller.
 */
export async function oublier(id: string): Promise<void> {
  await (await db()).delete(MAGASIN, id);
}

/**
 * Applique la rétention : archive à 30 jours, supprime à 180 (décision 7).
 *
 * Jamais sur une question ouverte — `sortDeLaRetention` le garantit, et
 * ce module ne refait pas la règle, il l'exécute.
 */
export async function appliquerLaRetention(
  aujourdHui: string,
  retention: RetentionDuCentre = RETENTION_PAR_DEFAUT,
): Promise<{ archives: number; supprimes: number }> {
  const base = await db();
  const cle = exigerLeCoffre();
  let archives = 0;
  let supprimes = 0;

  for (const element of await elementsDuCentre()) {
    const sort = sortDeLaRetention(element, aujourdHui, retention);
    if (sort === 'supprimer') {
      await base.delete(MAGASIN, element.id);
      supprimes += 1;
    } else if (sort === 'archiver') {
      const change = { ...element, etat: 'archive' as const };
      await base.put(MAGASIN, (await sceller(cle, MAGASIN, change as unknown as Record<string, unknown>)) as unknown as ElementDuCentre);
      archives += 1;
    }
  }
  return { archives, supprimes };
}

/** Le centre est-il lisible ? Pour que l'écran le dise au lieu de lever. */
export const centreLisible = (): boolean => coffreOuvert();

/** Les éléments qui comptent dans la pastille, coffre ouvert. */
export const aTrancherLisibles = async (): Promise<ElementDuCentre[]> =>
  (await elementsDuCentre()).filter(compteDansLaPastille);
