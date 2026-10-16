/**
 * Les plis sont rejoués à l'ouverture du coffre — la promesse d'A-6 option D.
 *
 * ## Ce qui manquait, et pourquoi c'est grave
 *
 * L'option D, signée le 15 octobre, dit qu'après un changement de mot de
 * passe « un report est rejoué ou **signalé**, jamais perdu en silence ».
 * Le moteur existait : `rejouerLesReports()` relève les plis, écrit les
 * exceptions, garde les illisibles sans les supprimer. **Aucun écran ne
 * l'appelait.** Un geste fait coffre fermé était donc gardé, jamais rejoué
 * et jamais dit : exactement la perte silencieuse que la décision 5
 * interdisait, obtenue par l'absence d'un appel.
 *
 * Trouvé le 16 octobre en instruisant une autre question, et remonté comme
 * décision avant d'être corrigé : ce n'était pas un choix ouvert, c'était
 * une signature non tenue.
 *
 * ## Pourquoi ce module, et pas un appel dans `coffre.ts`
 *
 * Le coffre est du noyau ; les occurrences sont d'Odyssée. Lui faire
 * appeler une branche inverserait les couches, et le jour où une seconde
 * branche voudrait son rejeu, il faudrait un second appel dans le noyau.
 * Le coffre publie `surCoffre` ; c'est à qui veut en profiter de s'y
 * abonner. Ce module est cet abonné, et il est posé par la mise en page —
 * donc sur n'importe quel écran, parce qu'on ouvre le coffre où l'on veut.
 *
 * ## Une seule exécution à la fois
 *
 * `surCoffre` peut se déclencher deux fois — ouverture puis restitution
 * d'appareil —, et le tableau de bord demande le rejeu de son côté pour
 * pouvoir compter juste après. Les écritures, elles, sont idempotentes :
 * l'exception porte la clé déterministe `tâche/jour`, donc rejouer deux
 * fois écrit la même ligne. Ce ne sont pas les écritures qui seraient
 * fausses, ce sont **les comptes** — « 2 gestes rejoués » pour un seul
 * geste. D'où le verrou : les appels concurrents attendent le même travail
 * et lisent le même résultat.
 */
import { surCoffre } from '../coffre';

/** Ce qu'un rejeu a donné. `panne` distingue « rien à faire » de « je n'ai pas pu regarder ». */
export interface Rejeu {
  rejoues: number;
  /** Plis d'une boîte périmée. Gardés, jamais supprimés. */
  illisibles: number;
  /** Relevés mais refusés à l'écriture — une tâche supprimée depuis, par exemple. */
  echecs: number;
  /**
   * Le rejeu n'a pas pu avoir lieu.
   *
   * Distinct de trois zéros, et pour la même raison qu'un indicateur rend
   * `null` plutôt que zéro : « rien en attente » et « je n'ai pas su
   * regarder » ne se ressemblent que pour qui ne lit pas.
   */
  panne: boolean;
}

const RIEN: Rejeu = { rejoues: 0, illisibles: 0, echecs: 0, panne: false };

let enCours: Promise<Rejeu> | null = null;
let dernier: Rejeu | null = null;

/** Le dernier rejeu de cette page, ou `null` si aucun n'a eu lieu. */
export const dernierRejeu = (): Rejeu | null => dernier;

/**
 * Rejoue les plis, une fois à la fois, et ne lève jamais.
 *
 * Ne lève jamais parce que ses deux appelants ne peuvent rien d'une
 * exception : l'ouverture du coffre ne doit pas échouer pour un report, et
 * un tableau de bord ne doit pas disparaître pour la même raison. L'échec
 * devient `panne`, que l'écran sait dire.
 */
export async function rejouerMaintenant(): Promise<Rejeu> {
  if (enCours) return enCours;
  enCours = (async () => {
    try {
      const { rejouerLesReports } = await import('./donnees-occurrences');
      const r = await rejouerLesReports();
      return { ...r, panne: false };
    } catch {
      return { ...RIEN, panne: true };
    }
  })();
  try {
    dernier = await enCours;
    return dernier;
  } finally {
    enCours = null;
  }
}

let branche = false;

/**
 * Abonne le rejeu à l'ouverture du coffre. Idempotent.
 *
 * Idempotent parce que la mise en page est une par page, mais qu'un
 * appelant distrait pourrait brancher deux fois — et deux abonnés
 * compteraient le même rejeu deux fois, malgré le verrou, en se le
 * partageant. Rend la fonction de débranchement du premier abonnement.
 */
export function brancherLeRejeu(): () => void {
  if (branche) return () => {};
  branche = true;
  const retirer = surCoffre((ouvert) => {
    /*
       À l'ouverture seulement. À la fermeture il n'y a rien à rejouer, et
       `releverLesReports` lèverait — ce qui deviendrait une `panne`
       affichée pour un événement parfaitement normal.
    */
    if (ouvert) void rejouerMaintenant();
  });
  return () => {
    branche = false;
    retirer();
  };
}
