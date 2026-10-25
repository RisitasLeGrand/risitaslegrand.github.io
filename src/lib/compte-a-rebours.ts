/**
 * Le compte à rebours vers vos épreuves (décision 3 du prompt 56).
 *
 * ## Pourquoi un module pur, et sans base
 *
 * Ce qu'il y a de délicat ici n'est ni la lecture ni l'affichage : c'est
 * l'arithmétique des jours. Une échéance comptée en millisecondes se trompe
 * deux fois par an — la nuit du changement d'heure fait 23 ou 25 heures, et
 * « dans 3 jours » devient « dans 2 jours » le dimanche matin. Le calcul se
 * fait donc sur des **dates nues**, en minuits UTC : il ne compte jamais une
 * durée, il soustrait deux quantièmes. Le changement d'heure n'a alors rien à
 * voir avec lui, et l'essai peut le franchir sans navigateur.
 *
 * ## Ce que le prompt interdit, et qui se vérifie ici
 *
 * « Aucun rouge, aucune urgence, aucun reproche » : ce module ne rend **aucune
 * couleur** et aucun « plus que ». Il rend une phrase plate — « INSP :
 * 15 mars 2027, dans 21 semaines » — et c'est l'écran qui la pose. Une classe
 * de couleur rendue ici aurait fini par porter une alerte, parce qu'un champ
 * de couleur finit toujours par être rempli.
 *
 * ## Ce qu'il ne cache pas
 *
 * Les dates d'épreuves sont un champ de profil, et le profil vit dans la base
 * « etat », hors du coffre : elles sont donc lisibles dès que le verrou du site
 * est ouvert, coffre fermé compris. Ce module ne décide pas de les montrer —
 * l'écran le décide, et le réglage le coupe.
 */

/** Une date nue, telle que le champ la porte : `AAAA-MM-JJ`. */
const DATE_NUE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Au-delà de huit semaines, l'échéance se dit en semaines. */
export const JOURS_AVANT_LES_SEMAINES = 56;

/**
 * Les jours entiers entre deux dates nues, ou `null` si l'une n'en est pas une.
 *
 * Minuits UTC des deux côtés : la soustraction est exacte, et le changement
 * d'heure ne la touche pas. Une date inexistante — le 31 février — est refusée
 * plutôt que reportée en mars, parce qu'un quantième que le calendrier ne porte
 * pas ne vient pas d'une saisie mais d'une erreur ailleurs.
 */
export function joursEntre(depuis: string, jusqua: string): number | null {
  const a = enMinuitUtc(depuis);
  const b = enMinuitUtc(jusqua);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

function enMinuitUtc(date: string): number | null {
  const m = DATE_NUE.exec(date);
  if (!m) return null;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const instant = Date.UTC(annee, mois - 1, jour);
  const controle = new Date(instant);
  if (
    controle.getUTCFullYear() !== annee ||
    controle.getUTCMonth() + 1 !== mois ||
    controle.getUTCDate() !== jour
  ) {
    return null;
  }
  return instant;
}

/** La date, en toutes lettres : « 15 mars 2027 » (P7). */
export function dateDite(date: string): string | null {
  const instant = enMinuitUtc(date);
  if (instant === null) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(instant));
}

/**
 * L'échéance, dite comme on la dit.
 *
 * En jours jusqu'à huit semaines, en semaines au-delà : « dans 83 jours » se
 * compte mal, « dans 12 semaines » se situe. Le jour même ne se dit pas en
 * nombre, et la veille non plus — « dans 1 jour » n'est pas du français.
 */
export function echeanceDite(jours: number): string {
  if (jours === 0) return 'aujourd’hui';
  if (jours === 1) return 'demain';
  if (jours <= JOURS_AVANT_LES_SEMAINES) return `dans ${jours} jours`;
  return `dans ${Math.round(jours / 7)} semaines`;
}

export interface LigneDEcheance {
  /** L'identifiant du parcours, pour que l'écran sache où mène la ligne. */
  parcours: string;
  /** La phrase entière : « INSP : 15 mars 2027, dans 21 semaines ». */
  texte: string;
  /** Les jours qui restent, pour l'ordre et pour les essais. */
  jours: number;
}

export type Echeances =
  /** Des épreuves à venir, de la plus proche à la plus lointaine. */
  | { etat: 'lignes'; lignes: LigneDEcheance[] }
  /** Aucune date donnée : l'écran propose de les renseigner. */
  | { etat: 'sans-date' }
  /** Des dates données, toutes passées : l'écran propose de les mettre à jour. */
  | { etat: 'toutes-passees' };

/**
 * Les échéances à afficher, depuis le champ `datesEpreuves`.
 *
 * La valeur vient du journal, donc d'un autre appareil et peut-être d'une autre
 * version : elle est traitée comme une entrée inconnue. Une clé qui ne nomme
 * aucun parcours, une valeur qui n'est pas une date nue, un quantième
 * impossible — tout cela est **écarté en silence**, et non affiché en
 * « Invalid Date ». Un parcours dont on ne connaît pas le libellé ne peut pas
 * être nommé : la ligne est omise, pas complétée.
 */
export function echeances(
  aujourdhui: string,
  datesEpreuves: unknown,
  parcours: readonly { id: string; libelle: string }[],
): Echeances {
  if (!datesEpreuves || typeof datesEpreuves !== 'object' || Array.isArray(datesEpreuves)) {
    return { etat: 'sans-date' };
  }
  const libelles = new Map(parcours.map((p) => [p.id, p.libelle]));
  const lignes: LigneDEcheance[] = [];
  let donnees = 0;
  for (const [cle, valeur] of Object.entries(datesEpreuves as Record<string, unknown>)) {
    const libelle = libelles.get(cle);
    if (libelle === undefined || typeof valeur !== 'string') continue;
    const jours = joursEntre(aujourdhui, valeur);
    const dite = dateDite(valeur);
    if (jours === null || dite === null) continue;
    donnees += 1;
    if (jours < 0) continue;
    lignes.push({
      parcours: cle,
      texte: `${libelle} : ${dite}, ${echeanceDite(jours)}`,
      jours,
    });
  }
  if (lignes.length) {
    lignes.sort((a, b) => a.jours - b.jours || (a.parcours < b.parcours ? -1 : 1));
    return { etat: 'lignes', lignes };
  }
  return donnees ? { etat: 'toutes-passees' } : { etat: 'sans-date' };
}
