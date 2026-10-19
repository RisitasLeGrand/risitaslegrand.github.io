/**
 * La reprise d'une fusion interrompue (B-4 du 58).
 *
 * ## Le défaut
 *
 * Une fusion écrit en deux temps, et il ne peut pas en être autrement.
 *
 * D'abord **le journal** — les opérations reçues, les révisions reçues, le
 * registre des réglages —, en une transaction. Ensuite **la matérialisation** :
 * pour chaque cible touchée, la dernière opération gagne, et l'enregistrement
 * est écrit dans son magasin de domaine. Puis le recalcul FSRS des cartes dont
 * des révisions sont arrivées.
 *
 * Les deux ne peuvent pas tenir dans une transaction : la matérialisation lit
 * tout le journal avant d'écrire, touche une cinquantaine de magasins, et
 * certains de ses enregistrements passent par le coffre — donc par du
 * chiffrement, donc par des `await` étrangers. Or une transaction IndexedDB se
 * referme dès que la boucle d'événements tourne sans requête en attente : un
 * `await` qui n'est pas une requête de la transaction la clôt. Ce n'est pas un
 * choix d'écriture, c'est la règle du moteur.
 *
 * **Donc la fenêtre existe.** Entre le `tx.done` du journal et la fin de la
 * matérialisation, l'onglet peut être fermé, le téléphone s'endormir, l'écran
 * planter. Il reste alors une base où le journal sait tout et où les magasins
 * de domaine ne savent rien.
 *
 * ## Et ce que l'écran disait
 *
 * C'est le vrai dommage. L'empreinte d'état ne porte que **sur les deux
 * journaux et les réglages versionnés** — c'est son rôle, et c'est juste. Mais
 * elle est donc égale à celle de l'émetteur dès que `tx.done` est passé.
 * L'écran annonçait « les deux appareils sont désormais identiques ✓ » alors
 * que les séances, les notes, les mesures n'avaient pas été écrites. Le
 * commentaire du code disait « le recalcul suivant rétablira la cohérence » :
 * c'est faux. Aucun recalcul ne part tout seul, et un paquet suivant n'apporte
 * plus ces opérations — elles sont déjà au journal, donc plus « reçues ».
 *
 * ## Ce qui est écrit ici
 *
 * Une **marque**, posée dans la transaction du journal elle-même, donc
 * indissociable de lui : si le journal est écrit, la marque l'est. Elle porte
 * les cibles à matérialiser et les cartes à recalculer. Elle est retirée quand
 * le travail est fini.
 *
 * Trois conséquences :
 *
 * 1. tant qu'elle est là, l'écran ne dit **jamais** « identiques » ;
 * 2. l'écran dit « Fusion interrompue : une partie a été reçue » et propose
 *    « Reconstruire » ;
 * 3. une fusion suivante **réunit** les cibles en attente aux siennes, de sorte
 *    que rien n'est perdu même si la personne ne reconstruit jamais.
 *
 * La reprise est idempotente : elle relit le journal et réécrit ce qu'il dit.
 * La relancer deux fois produit la même base.
 */
import { db, ecrireCarte } from '../db';
import { recalculerCarte } from '../srs';
import { materialiserFaitsDomaine } from './faits-domaine';

/**
 * La clé d'`etat` qui porte la marque.
 *
 * Elle est **technique** au sens de la B-3 : la ranger ailleurs la rendrait
 * effaçable « à la carte », et effacer la marque d'une fusion inachevée est
 * exactement ce qui perdrait les données qu'elle sert à retrouver.
 */
export const CLEF_FUSION_EN_COURS = 'fusionEnCours';

/** Une fusion dont la matérialisation n'est pas allée au bout. */
export interface FusionInachevee {
  /** Le lot de la fusion, pour que l'écran puisse le nommer. */
  lot: string;
  /** Les cibles de domaine à (re)matérialiser. */
  cibles: readonly string[];
  /** Les cartes dont l'état FSRS est à recalculer. */
  cartes: readonly string[];
  /** Quand la fusion a commencé à écrire. */
  le: string;
  /** L'appareil d'où venait le paquet. */
  appareil: string;
  nomAppareil?: string;
}

/**
 * Pose la marque **dans la transaction du journal**.
 *
 * Le magasin est passé par l'appelant, et non ouvert ici : ouvrir une
 * transaction à nous ferait justement les deux écritures séparables, c'est-à-dire
 * le défaut qu'on corrige. La fonction ne fait donc qu'un `put`, et c'est
 * volontairement tout ce qu'elle fait.
 */
export function marquerLaFusion(
  magasinEtat: { put: (valeur: unknown, clef: string) => unknown },
  marque: FusionInachevee,
): void {
  magasinEtat.put(marque, CLEF_FUSION_EN_COURS);
}

/** La marque, s'il y en a une. */
export async function fusionInachevee(): Promise<FusionInachevee | undefined> {
  const marque = (await (await db()).get('etat', CLEF_FUSION_EN_COURS)) as
    | FusionInachevee
    | undefined;
  /*
     Une marque sans cible ni carte ne décrit aucun travail : la traiter comme
     une fusion interrompue afficherait une alerte que « Reconstruire » ne
     pourrait pas faire disparaître, puisqu'il n'y aurait rien à reconstruire.
  */
  if (!marque || (!marque.cibles?.length && !marque.cartes?.length)) return undefined;
  return marque;
}

/** Retire la marque. Appelée quand le travail est allé au bout. */
export async function oublierLaFusion(): Promise<void> {
  await (await db()).delete('etat', CLEF_FUSION_EN_COURS);
}

/** Ce que la reprise a fait. */
export interface RapportReprise {
  lot: string;
  cibles: number;
  ecrits: number;
  effaces: number;
  cartesRecalculees: number;
}

/**
 * Reprend la fusion interrompue : matérialise ses cibles, recalcule ses cartes.
 *
 * Rend `null` s'il n'y a rien à reprendre — l'appeler à tout hasard est donc
 * sans effet, et c'est ce qui permet de l'appeler à l'ouverture d'un écran de
 * synchronisation sans se demander si c'est utile.
 *
 * **La marque n'est retirée qu'à la fin.** Si la reprise est interrompue à son
 * tour, la marque reste, et l'écran continue de le dire. Le contraire — retirer
 * la marque d'abord — rendrait la deuxième interruption invisible.
 */
export async function reprendreLaFusion(): Promise<RapportReprise | null> {
  const marque = await fusionInachevee();
  if (!marque) return null;

  const domaine = marque.cibles.length
    ? await materialiserFaitsDomaine(marque.cibles)
    : { ecrits: 0, effaces: 0 };

  let recalculees = 0;
  const base = await db();
  for (const carteId of marque.cartes) {
    const entrees = await base.getAllFromIndex('revisions', 'carteId', carteId);
    const etat = recalculerCarte(entrees);
    if (etat) {
      await ecrireCarte(etat);
      recalculees += 1;
    }
  }

  await oublierLaFusion();
  return {
    lot: marque.lot,
    cibles: marque.cibles.length,
    ecrits: domaine.ecrits,
    effaces: domaine.effaces,
    cartesRecalculees: recalculees,
  };
}
