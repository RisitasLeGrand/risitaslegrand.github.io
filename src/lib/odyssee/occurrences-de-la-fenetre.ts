/**
 * Les occurrences d'une fenêtre de jours, prêtes à afficher — prompt 39, C3.
 *
 * ## Pourquoi un module, et pur
 *
 * Le calendrier doit montrer les occurrences des tâches répétées, et le
 * prompt 38 le demandait déjà : « le calendrier montre les occurrences
 * futures ». Il ne le faisait pas — anomalie A-8. Le remettre dans l'écran
 * aurait mêlé trois choses : dérouler une règle de répétition, appliquer
 * les exceptions, et décider ce qui s'affiche. Mêlées, aucune n'est
 * éprouvable sans navigateur.
 *
 * Elles sont donc ici, et pures. L'écran reçoit une liste prête, et sa
 * seule liberté est la mise en page.
 *
 * ## Trois règles que ce module tient, et qu'il faut relire ensemble
 *
 * **Une occurrence déplacée n'est pas à sa place.** L'exception `deplacee`
 * porte un jour d'arrivée : l'occurrence disparaît du jour que la règle
 * prévoyait et paraît à l'autre. La dérouler sans regarder les exceptions
 * la montrerait aux deux endroits.
 *
 * **Ce qu'on ne peut pas lire ne se devine pas.** Coffre fermé, les
 * exceptions d'une tâche liée à une branche scellée sont illisibles.
 * L'occurrence n'est alors ni « à faire » ni « faite » : elle est
 * `scellee`, et l'écran affiche la mention. La règle, elle, reste lisible
 * — la série vit en clair —, donc on sait **qu'il y a** une occurrence ce
 * jour-là, sans savoir ce qu'elle est devenue. C'est exactement ce que la
 * décision 3 achète, et c'est ce qui rend le calendrier utilisable coffre
 * fermé.
 *
 * **Le titre d'une tâche est en clair, toujours.** Les tâches ne sont pas
 * scellées ; seul l'état de leurs occurrences peut l'être. Masquer le
 * titre d'une occurrence scellée ne protégerait donc rien — il se lit déjà
 * sur l'écran des tâches — et ferait croire à une protection qui n'existe
 * pas.
 */

import { lisibiliteDeLOccurrence } from './coffre-ferme';
import { pointageDeLOccurrence, type FaitObserve, type OrigineDuPointage } from './pointage-derive';
import { occurrences } from './repetition';
import type { EtatDOccurrence, Tache } from './modele';

/** L'exception d'un couple (tâche, jour), réduite à ce qui s'affiche. */
export interface ExceptionLue {
  tacheId: string;
  jourPrevu: string;
  etat: EtatDOccurrence;
  jourPorte: string | null;
  /** « Modifiée » : l'heure murale qui remplace celle de la série. */
  heure?: string | null;
}

export interface OccurrenceAffichee {
  tacheId: string;
  titre: string;
  domaine: string;
  /** Le jour où elle se montre — celui d'arrivée si elle a été déplacée. */
  jour: string;
  /** Le jour que la règle prévoyait. Diffère de `jour` si elle est déplacée. */
  jourPrevu: string;
  /** `false` quand le coffre est fermé sur une branche scellée. */
  lisible: boolean;
  faite: boolean;
  origine: OrigineDuPointage;
  abandonnee: boolean;
  deplacee: boolean;
  /**
   * L'heure murale `HH:MM`, ou `null` quand la série n'en porte pas.
   *
   * **L'exception l'emporte** quand elle en pose une : c'est la règle
   * « l'exception fait autorité, le calcul n'est que le défaut », et une
   * occurrence décalée à 19 h affichée à 8 h serait un rendez-vous manqué.
   */
  heure: string | null;
  /** La tâche vise une branche. Le calendrier le signale, sans la nommer. */
  liee: boolean;
}

export interface ContexteDeFenetre {
  exceptions: readonly ExceptionLue[];
  faits: readonly FaitObserve[];
  coffreOuvert: boolean;
}

/**
 * Les occurrences à montrer entre deux jours, inclus.
 *
 * Les tâches sans série n'en produisent aucune : elles se font une fois, et
 * le calendrier n'est pas une liste de tâches.
 */
/**
 * De combien de jours on déroule la règle **au-delà** de la fenêtre.
 *
 * Une occurrence prévue avant le début peut avoir été déplacée dedans. Sans
 * cet élargissement elle manquerait, et le calendrier mentirait par omission
 * sur un déplacement que la personne a elle-même fait.
 *
 * Trente et un jours, parce que c'est le plus long mois : un déplacement
 * au-delà d'un mois entier n'est plus un report, c'est une autre occurrence.
 * La borne est **dite** plutôt que devinée, et l'appelant qui lit les
 * exceptions doit lire la même — d'où `fenetreElargie`, exportée.
 */
export const MARGE_DE_DEPLACEMENT = 31;

/** Les bornes à lire pour une fenêtre affichée de `du` à `au`, inclus. */
export function fenetreElargie(du: string, au: string): [string, string] {
  const decale = (jour: string, sens: 1 | -1) => {
    const d = new Date(`${jour}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + sens * MARGE_DE_DEPLACEMENT);
    return d.toISOString().slice(0, 10);
  };
  return [decale(du, -1), decale(au, 1)];
}

/**
 * Une exception tombe-t-elle dans la fenêtre élargie ?
 *
 * **Les deux jours comptent.** Une occurrence prévue le 3 et déplacée au 20
 * appartient à la lecture du 3 comme à celle du 20 : la première dit que la
 * règle y prévoyait quelque chose, la seconde la montre. Ne regarder que
 * `jourPrevu` perdrait l'exception d'un déplacement venu de loin ; ne
 * regarder que `jourPorte` perdrait toutes les autres, qui ne le portent pas.
 */
export const dansLaFenetre = (
  exception: { jourPrevu: string; jourPorte: string | null },
  du: string,
  au: string,
): boolean =>
  (exception.jourPrevu >= du && exception.jourPrevu <= au) ||
  (exception.jourPorte !== null && exception.jourPorte >= du && exception.jourPorte <= au);

export function occurrencesDeLaFenetre(
  taches: readonly Tache[],
  du: string,
  au: string,
  contexte: ContexteDeFenetre,
): OccurrenceAffichee[] {
  const sortie: OccurrenceAffichee[] = [];

  for (const tache of taches) {
    if (!tache.serie || tache.abandonneeLe) continue;

    const lisible = lisibiliteDeLOccurrence(tache, contexte.coffreOuvert) === 'lisible';
    const siennes = contexte.exceptions.filter((e) => e.tacheId === tache.id);

    /*
       On déroule sur une fenêtre élargie : une occurrence prévue AVANT le
       début peut avoir été déplacée DANS la fenêtre. Sans cet élargissement
       elle manquerait, et le calendrier mentirait par omission sur un
       déplacement que la personne a elle-même fait.
    */
    const [debut, fin] = fenetreElargie(du, au);

    for (const jourPrevu of occurrences(tache.serie, debut, fin)) {
      const exception = siennes.find((e) => e.jourPrevu === jourPrevu);
      const deplacee = exception?.etat === 'deplacee' && Boolean(exception.jourPorte);
      const jour = deplacee ? exception!.jourPorte! : jourPrevu;
      if (jour < du || jour > au) continue;

      /*
         LE JOUR D'ARRIVÉE, pas celui que la règle prévoyait — anomalie A-15,
         trouvée en branchant le calendrier sur ce moteur.

         La phase 5a passait `jourPrevu`. Pour une occurrence déplacée du 20
         septembre au 15 octobre, elle cherchait donc un fait de branche le
         20 septembre, alors que la séance a eu lieu le 15 : l'occurrence
         restait « à faire » le jour où elle avait justement été faite. Le
         pointage dérivé se lit au jour où l'occurrence se présente.
      */
      const pointage = pointageDeLOccurrence(tache, jour, {
        exception: exception ? { etat: exception.etat } : null,
        faits: contexte.faits,
        coffreOuvert: contexte.coffreOuvert,
      });

      sortie.push({
        tacheId: tache.id,
        titre: tache.titre,
        domaine: tache.domaine,
        jour,
        jourPrevu,
        lisible: lisible && pointage.lisible,
        faite: pointage.faite,
        origine: pointage.origine,
        abandonnee: exception?.etat === 'abandonnee',
        deplacee,
        heure: exception?.heure ?? tache.serie.heure,
        liee: Boolean(tache.lien),
      });
    }
  }

  /* Par jour, puis par titre : un ordre stable d'un affichage à l'autre. */
  return sortie.sort((a, b) => a.jour.localeCompare(b.jour) || a.titre.localeCompare(b.titre));
}

/** Les occurrences d'un jour, pour un écran qui en dessine un seul. */
export const occurrencesDuJourAffichees = (
  toutes: readonly OccurrenceAffichee[],
  jour: string,
): OccurrenceAffichee[] => toutes.filter((o) => o.jour === jour);
