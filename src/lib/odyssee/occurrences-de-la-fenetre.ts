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
    const marge = 31;
    const elargi = (jour: string, sens: 1 | -1) => {
      const d = new Date(`${jour}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + sens * marge);
      return d.toISOString().slice(0, 10);
    };

    for (const jourPrevu of occurrences(tache.serie, elargi(du, -1), elargi(au, 1))) {
      const exception = siennes.find((e) => e.jourPrevu === jourPrevu);
      const deplacee = exception?.etat === 'deplacee' && Boolean(exception.jourPorte);
      const jour = deplacee ? exception!.jourPorte! : jourPrevu;
      if (jour < du || jour > au) continue;

      const pointage = pointageDeLOccurrence(tache, jourPrevu, {
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
