/**
 * Le noyau du lecteur de fiche audio : tout ce qui se calcule sans écran.
 *
 * ## Pourquoi ce fichier existe à part de `podcast.ts`
 *
 * `podcast.ts` touche le DOM, IndexedDB et le contenu déchiffré. Il importe
 * `ui.ts`, qui lit `import.meta.env.BASE_URL` dès son chargement : hors d'un
 * navigateur, l'import échoue sur la première ligne. Deux conséquences, et
 * ce sont elles qui ont fait naître ce fichier :
 *
 * - **la page des réglages** (`parametres/catalogue.ts`) est *pure* — elle
 *   est lue à la construction du site pour écrire du HTML, et un essai
 *   l'importe dans Node. Elle ne peut pas tirer la base et le contenu
 *   derrière elle pour connaître la liste des vitesses ;
 * - **un essai** doit pouvoir éprouver le calcul des repères — quelle partie
 *   est en cours à telle seconde, comment s'écrit « 4:12 » — sans monter un
 *   navigateur pour trois fonctions qui ne font que de l'arithmétique.
 *
 * Recopier ces valeurs des deux côtés les exposerait à diverger, c'est-à-dire
 * à proposer sur la page centrale une vitesse que le lecteur refuse. D'où la
 * règle de ce fichier : **aucune dépendance, aucun effet de bord**, et les
 * seuls imports autorisés sont des imports de type.
 */
import type { Fiche } from './contenu';

/* ══════════════════════════════════════════════════════════════════════════
   La vitesse de diction (prompt 55, N°13)
   ══════════════════════════════════════════════════════════════════════════ */

/** Clé de `localStorage` qui retient la vitesse choisie, par appareil. */
export const CLE_VITESSE = 'revinsp.podcast.vitesse';

/** Les vitesses proposées. 1 = la diction telle qu'elle a été synthétisée. */
export const VITESSES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const VITESSE_PAR_DEFAUT = 1;

/* ══════════════════════════════════════════════════════════════════════════
   Mise en forme d'un repère
   ══════════════════════════════════════════════════════════════════════════ */

const DEUX_CHIFFRES = new Intl.NumberFormat('fr-FR', { minimumIntegerDigits: 2 });

/**
 * L'heure de début d'une partie : « 4:12 », ou « 1:04:12 » passé l'heure.
 *
 * C'est un repère de lecteur audio, pas une durée en français : on garde donc
 * les deux-points, que tout le monde lit sur un lecteur, et non « 4 min 12 s ».
 *
 * Les secondes sont TRONQUÉES, pas arrondies. Un repère à 251,8 s qui
 * s'afficherait « 4:12 » enverrait à 252 s, c'est-à-dire deux dixièmes après
 * le début du titre : on entendrait la partie commencer sans son premier
 * phonème. Tronquer place le libellé du côté sûr.
 */
export function horodatage(secondes: number): string {
  const total = Math.max(0, Math.floor(secondes));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return h
    ? `${h}:${DEUX_CHIFFRES.format(m)}:${DEUX_CHIFFRES.format(s)}`
    : `${m}:${DEUX_CHIFFRES.format(s)}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les parties écoutables (prompt 46, P3)
   ══════════════════════════════════════════════════════════════════════════ */

/** Une partie telle que le lecteur l'utilise : un titre, et une seconde. */
export interface PartieEcoutable {
  id: string;
  titre: string;
  debut: number;
}

/**
 * Les parties réellement écoutables d'une fiche, dans l'ordre de l'audio.
 *
 * Deux sources, et il faut les deux : `fiche.parties` porte les titres,
 * `fiche.podcast.parties` porte les secondes. Une partie dont l'audio n'a pas
 * de repère ne peut pas être atteinte — elle est donc ABSENTE de la liste,
 * plutôt que présente et inerte. C'est le cas d'une fiche audio synthétisée
 * avant le prompt 46, qui doit s'écouter d'un bloc exactement comme avant.
 *
 * Le tri se fait sur la seconde et non sur l'ordre du sommaire : c'est l'audio
 * qu'on parcourt, et c'est lui qui décide ce que « la partie suivante » veut
 * dire.
 */
export function partiesEcoutables(fiche: Fiche): PartieEcoutable[] {
  const reperes = fiche.podcast?.parties;
  if (!reperes?.length) return [];
  const titres = new Map((fiche.parties ?? []).map((p) => [p.id, p.titre]));
  return reperes
    .filter((r) => titres.has(r.id))
    .map((r) => ({ id: r.id, titre: titres.get(r.id)!, debut: r.debut }))
    .sort((a, b) => a.debut - b.debut);
}

/**
 * Rang de la partie en cours à une seconde donnée, ou -1 avant la première.
 *
 * La tolérance d'un millième n'est pas une coquetterie : `currentTime` rend un
 * flottant, et sauter au repère 252 peut donner 251,9999. Sans elle, la partie
 * où l'on vient d'atterrir ne serait pas celle qu'on vient de mettre en
 * évidence, et la liste clignoterait d'une ligne à l'autre.
 */
export function partieCourante(parties: PartieEcoutable[], seconde: number): number {
  let rang = -1;
  for (let i = 0; i < parties.length; i++) {
    if (parties[i].debut <= seconde + 0.001) rang = i;
    else break;
  }
  return rang;
}
