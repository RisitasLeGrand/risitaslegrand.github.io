/**
 * Le rappel d'oubli — Santé, phase 4, P4.
 *
 * ## Une règle est levée ici, et il faut dire laquelle
 *
 * `sante.ts` disait « aucun rappel d'oubli » et `sensible.ts` « le module ne
 * sait pas ce qui était prévu, et c'est délibéré ». Alexis a levé cette règle
 * le 18 octobre, **pour un rappel de sa propre déclaration et pour rien
 * d'autre**. Ce module rappelle donc ce que la personne a écrit, à l'heure
 * qu'elle a choisie, après le délai qu'elle a fixé. Il ne conseille rien : ni
 * « prenez-la maintenant », ni « doublez », ni « sautez ».
 *
 * ## Ce qu'il ne compte pas, et qui n'est pas un oubli de ma part
 *
 * Aucun compteur d'oublis, aucune série, aucun pourcentage d'observance
 * (interdit § 1 n° 3). La conséquence est visible dans la forme même de ce
 * module : il ne rend que les créneaux **d'aujourd'hui**, jamais un
 * historique. Un producteur qui remonterait dans le temps serait un compteur
 * déguisé — trente créneaux sans réponse feraient trente lignes au centre, et
 * ces trente lignes seraient un reproche quel qu'en soit le texte.
 *
 * ## Pourquoi un producteur pur
 *
 * C'est la forme de tous les producteurs du centre (`notifications/
 * alimentation.ts`) : pas de base, pas de coffre, pas d'horloge — l'instant
 * est un paramètre. Ils se contrôlent entièrement sans navigateur, et c'est
 * ce qui permet d'éprouver « jamais avant le délai » ou « jamais deux fois »
 * sans attendre deux heures.
 */
import {
  creneauxDuJour,
  type MarqueDeCreneau,
  type Traitement,
} from './sante';
import type { ReglagesJourLogique } from '../noyau/jour-logique';

/** La source, telle que les deux registres du centre la nomment déjà. */
export const SOURCE_RAPPEL_DE_PRISE = 'rappel-de-prise';

export interface CreneauOublie {
  traitementId: string;
  jour: string;
  /** L'heure prévue, « HH:MM ». */
  heure: string;
  /**
   * La référence déposée au centre.
   *
   * En clair ici, scellée là-bas : `centreElements` ne laisse en clair que
   * l'`id` — une empreinte de `source + refSource` — et le `genre`. La
   * référence elle-même part dans le bloc chiffré, et l'empreinte ne dit
   * rien. C'est la règle dégagée par l'inventaire des signaux : **la
   * référence nomme l'objet, jamais ce qu'il contient.**
   */
  ref: string;
}

export const refDuCreneau = (traitementId: string, jour: string, heure: string): string =>
  `${traitementId}|${jour}|${heure}`;

/**
 * Les créneaux d'aujourd'hui pour lesquels le délai est passé et rien n'est
 * noté.
 *
 * Quatre conditions, et chacune vient du prompt :
 *
 * 1. **le rappel d'oubli est demandé** pour ce traitement — les deux
 *    drapeaux, « Me rappeler » et « Me le rappeler si je n'ai rien noté »,
 *    sont éteints par défaut ;
 * 2. **une prise était prévue** — ce que `creneauxDuJour` décide, et qui
 *    exclut déjà les prises sporadiques et les traitements sans schéma ;
 * 3. **le délai est passé** depuis l'heure prévue, pas depuis l'ouverture de
 *    l'écran ;
 * 4. **rien n'est noté pour ce créneau**, ni « Pris » ni « Pas aujourd'hui ».
 *
 * Et une cinquième règle, qui n'est pas une condition mais une limite :
 * **au plus un créneau par traitement et par jour**. Un traitement du matin
 * et du soir tous deux sans réponse ne fait pas deux rappels ; il en fait un,
 * sur le plus ancien — celui qui attend depuis le plus longtemps.
 */
export function creneauxOublies(
  traitements: readonly Traitement[],
  marques: readonly MarqueDeCreneau[],
  maintenant: Date,
  jour: string,
  reglages: Partial<ReglagesJourLogique> = {},
): CreneauOublie[] {
  const oublies: CreneauOublie[] = [];

  for (const t of traitements) {
    const reglage = t.rappel;
    if (!reglage?.actif || !reglage.oubli) continue;

    const attendu = reglage.delaiOubli * 60_000;
    /*
       `creneauxDuJour` rend déjà la liste triée par heure : le premier
       candidat est donc le plus ancien, et c'est celui qu'on garde. Retrier
       ici serait inutile, et surtout ce serait une seconde affirmation sur
       l'ordre — celle qui se met à mentir le jour où l'autre change.
    */
    const candidat = creneauxDuJour(t, jour, reglages).find((creneau) => {
      if (maintenant.getTime() - creneau.instant.getTime() < attendu) return false;
      return !marques.some(
        (m) =>
          m.traitementId === creneau.traitementId &&
          m.jour === creneau.jour &&
          m.heure === creneau.heure,
      );
    });

    if (candidat) {
      oublies.push({
        traitementId: candidat.traitementId,
        jour: candidat.jour,
        heure: candidat.heure,
        ref: refDuCreneau(candidat.traitementId, candidat.jour, candidat.heure),
      });
    }
  }

  return oublies;
}

/**
 * Le texte d'un rappel d'oubli, **sous coffre seulement**.
 *
 * Il n'est jamais le texte d'une notification du système : celui-là est une
 * constante unique (`notifications/emission.ts`), et la liste fermée des
 * sources autorisées à en dire plus est vide — décision 3 du prompt 32, que
 * ce lot ne rouvre pas. Une source de Santé n'y entrerait de toute façon
 * jamais.
 *
 * Ce texte-ci s'affiche donc là où le coffre est déjà ouvert, et il dit ce
 * que la personne a déclaré : l'heure prévue, et que rien n'est noté. Rien
 * d'autre — aucun conseil de rattrapage, aucune durée écoulée, aucun
 * décompte.
 */
export function texteDuRappelDOubli(t: Traitement, heure: string): string {
  const [h, m] = heure.split(':').map(Number);
  const quand = m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
  const nom = t.rappel?.libelle === 'neutre' ? 'Une prise' : t.nom.trim() || 'Une prise';
  return `${nom} : prévue à ${quand}, rien n’est noté.`;
}
