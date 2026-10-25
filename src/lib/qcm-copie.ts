/**
 * La feuille de réponse pré-imprimée : ce qu'on y coche, et ce qui en est lu.
 *
 * ## Deux lignes, et pourquoi la seconde existe
 *
 * Le jour du concours, chaque question a une **zone de réponse** à deux
 * lignes. Les directives du sujet 2026 le disent en toutes lettres :
 *
 * > 6. Si vous désirez MODIFIER votre 1ère réponse, ne raturez pas, indiquez
 * >    votre nouvelle réponse sur la 2ème ligne.
 * > 7. Si vous souhaitez ANNULER votre réponse de la 1ère ligne et/ou de la
 * >    2ème ligne, vous pouvez cocher la case « Ann ».
 *
 * Une case cochée ne se décoche donc pas : sur papier, on ne décoche rien. On
 * passe à la seconde ligne, ou l'on coche « Ann ». C'est la contrainte
 * centrale de ce module, et elle n'est pas un handicap simulé pour le
 * plaisir : apprendre à se corriger sans raturer fait partie de l'épreuve.
 *
 * ## La zone ne juge rien
 *
 * Elle laisse cocher deux cases sur une même ligne, et ne prévient pas. La
 * directive 4 — « toute réponse multiple sera assimilée à une réponse
 * inexacte » — s'applique **à la correction**, pas à la saisie, exactement
 * comme au concours. Un formulaire qui refuserait la faute empêcherait de
 * l'apprendre.
 *
 * ## Ce module est pur
 *
 * Aucun accès au navigateur, aucune lecture de magasin. Il s'éprouve en Node,
 * ligne du tableau par ligne du tableau — c'est la même raison qui a fait
 * sortir la temporalité du QCM dans son propre module.
 */
import type { FormatEpreuve, Issue } from './qcm';

/** Le nombre de zones du formulaire officiel, quel que soit le format. */
export const ZONES_DU_FORMULAIRE = 60;

/**
 * Les minutes qu'on se donne par question, et d'où vient ce chiffre.
 *
 * ## Aucun arrêté ne donne la durée du QCM seul
 *
 * Les arrêtés donnent la durée de l'épreuve ENTIÈRE : 2 heures pour le QCM
 * puis les QRC du contrôleur, 2 h 30 pour ceux de l'inspecteur
 * (`docs/cyclades/programmes-dgfip.md`). Le découpage entre les deux parties
 * n'y figure pas, et il fallait bien en choisir un.
 *
 * Le seul repère trouvé est celui du guide ENFiP, cité dans le même
 * document : « deux minutes par question au plus, soit 1 h 20 pour le QCM »
 * — pour quarante questions. On applique donc sa règle plutôt que sa somme,
 * ce qui donne une durée cohérente quel que soit le format.
 *
 * C'est **un repère du guide, pas une durée réglementaire**, et l'écran le
 * dit. Confirmé par le pilote le 19 octobre.
 *
 * Ces deux-là vivent ici, et non dans `qcm.ts`, pour la même raison que la
 * temporalité : `qcm.ts` importe `./ui`, qui lit `import.meta.env` et
 * n'existe donc que dans un navigateur. Une durée doit pouvoir s'éprouver
 * en Node.
 */
export const MINUTES_PAR_QUESTION = 2;

/** La durée d'une copie, en secondes, pour le compte à rebours. */
export const secondesDuFormat = (format: Pick<FormatEpreuve, 'total'>): number =>
  format.total * MINUTES_PAR_QUESTION * 60;

/** « 1 h 30 », « 54 min » : la durée telle que l'écran l'annonce. */
export function dureeEnClair(secondes: number): string {
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`;
}

/**
 * Une ligne de la zone : les cases numérotées cochées, et « Ann ».
 *
 * Les cases sont tenues dans un ensemble d'**indices d'option**, et non de
 * numéros affichés : la zone parle le même langage que `QuestionDgfip.bonnes`,
 * ce qui évite une conversion de plus entre la feuille et la correction.
 */
export interface LigneDeZone {
  cases: number[];
  ann: boolean;
}

export interface Zone {
  premiere: LigneDeZone;
  seconde: LigneDeZone;
}

export const ligneVide = (): LigneDeZone => ({ cases: [], ann: false });
export const zoneVide = (): Zone => ({ premiere: ligneVide(), seconde: ligneVide() });

const ligneEstVide = (l: LigneDeZone): boolean => l.cases.length === 0 && !l.ann;

export const zoneEstVide = (z: Zone): boolean =>
  ligneEstVide(z.premiere) && ligneEstVide(z.seconde);

/**
 * Coche une case. **Ne décoche jamais.**
 *
 * Le nom dit ce qu'il fait, et l'absence de son contraire est la fonction :
 * il n'existe pas de `decocher`, parce qu'il n'en existe pas sur papier.
 * Cocher deux fois la même case est sans effet, comme un second passage de
 * stylo.
 */
export function cocher(zone: Zone, ligne: 'premiere' | 'seconde', option: number): Zone {
  const courante = zone[ligne];
  if (courante.cases.includes(option)) return zone;
  return {
    ...zone,
    [ligne]: { ...courante, cases: [...courante.cases, option].sort((a, b) => a - b) },
  };
}

/** Coche « Ann » sur une ligne. Ne se décoche pas non plus. */
export function cocherAnn(zone: Zone, ligne: 'premiere' | 'seconde'): Zone {
  if (zone[ligne].ann) return zone;
  return { ...zone, [ligne]: { ...zone[ligne], ann: true } };
}

/* ══════════════════════════════════════════════════════════════════════════
   Du numéro de case à l'indice d'option
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La case numérotée « n » de la feuille porte quelle option ?
 *
 * ## Le décalage que ces deux fonctions existent pour empêcher
 *
 * Les propositions sont **mélangées** à l'affichage (`ordre`, posé par le
 * tirage), pour qu'une question sue ne se reconnaisse pas à la place de sa
 * réponse. La feuille, elle, numérote ses cases 1 à 4 dans l'ordre où les
 * propositions sont imprimées. La case 1 ne désigne donc pas l'option 0.
 *
 * Confondre les deux ne casserait rien de visible : la copie se remplirait,
 * la note se calculerait, et elle serait fausse — sur les seules questions
 * dont l'ordre a changé, c'est-à-dire presque toutes. C'est exactement le
 * genre de défaut qui ne se voit qu'en comptant à la main.
 *
 * La zone stocke des **indices d'option**, et non des numéros de case : ainsi
 * la réponse retenue garde un sens une fois l'épreuve rangée dans
 * l'historique, sans qu'il faille conserver l'ordre d'affichage pour la
 * relire.
 */
export const optionDeLaCase = (ordre: readonly number[], numero: number): number | undefined =>
  ordre[numero - 1];

/** Et l'inverse : cette option est imprimée sur quelle case ? `0` si absente. */
export const caseDeLOption = (ordre: readonly number[], option: number): number =>
  ordre.indexOf(option) + 1;

/* ══════════════════════════════════════════════════════════════════════════
   La lecture : quelle réponse la copie porte-t-elle ?
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Pourquoi cette réponse a été retenue. Affiché à l'issue de l'épreuve.
 *
 * Le motif compte autant que la réponse : une question perdue parce qu'on a
 * coché deux cases ne s'apprend pas comme une question perdue parce qu'on ne
 * savait pas.
 */
export type MotifDeLecture =
  | 'premiere-ligne'
  | 'seconde-ligne'
  | 'annulee'
  | 'reponse-multiple'
  | 'sans-reponse';

/** Ce que l'écran de fin écrit en marge de la zone. */
export const LIBELLE_DU_MOTIF: Record<MotifDeLecture, string> = {
  'premiere-ligne': '1ʳᵉ ligne',
  'seconde-ligne': '2ᵉ ligne',
  annulee: 'Annulée',
  'reponse-multiple': 'Réponse multiple',
  'sans-reponse': 'Sans réponse',
};

export interface LectureDeZone {
  /** L'indice d'option retenu, ou `null` : abstention ou réponse inexacte. */
  retenue: number | null;
  motif: MotifDeLecture;
}

/**
 * La règle de lecture de la feuille, telle que les directives la posent.
 *
 * ## L'ordre des questions **est** la règle
 *
 * La seconde ligne est examinée d'abord. C'est la directive 6 : elle
 * **remplace** la première, et non « s'ajoute à ». Lire la première d'abord
 * obligerait ensuite à la défaire, et le jour où les deux lignes se
 * contredisent, c'est l'ordre qui décide.
 *
 * ## Deux situations que le tableau du prompt ne tranche pas
 *
 * Elles sont dites ici plutôt que résolues en silence.
 *
 * 1. **« Ann » cochée en même temps que plusieurs cases numérotées**, sur la
 *    même ligne. Le tableau donne « Ann cochée (avec ou sans case) →
 *    abstention » et « plusieurs cases → réponse inexacte » : les deux lignes
 *    s'appliquent. On retient l'**annulation**, pour deux raisons. La
 *    directive 7 fait de « Ann » un geste d'annulation explicite, et non une
 *    réponse de plus ; et le tableau lui-même a déjà tranché le cas « Ann +
 *    une case » en faveur de l'abstention — traiter « Ann + deux cases »
 *    autrement serait incohérent avec sa propre ligne 3.
 *
 * 2. **Première ligne vide, seconde ligne portant une seule case.** Le
 *    tableau ne la nomme pas (sa ligne 5 dit « quelconque » pour la première
 *    dès que la seconde est servie). On retient la seconde ligne : elle est
 *    servie, et la directive 6 lui donne le dernier mot.
 *
 * Si une troisième situation apparaît, elle doit être dite avant d'être
 * codée, et non devinée ici.
 */
export function lireLaZone(zone: Zone): LectureDeZone {
  const { premiere, seconde } = zone;

  /* ── 1. La seconde ligne, si elle est servie : elle remplace la première. ── */
  if (!ligneEstVide(seconde)) {
    if (seconde.ann) return { retenue: null, motif: 'annulee' };
    if (seconde.cases.length > 1) return { retenue: null, motif: 'reponse-multiple' };
    return { retenue: seconde.cases[0], motif: 'seconde-ligne' };
  }

  /* ── 2. Sinon la première. ──────────────────────────────────────────────── */
  if (premiere.ann) return { retenue: null, motif: 'annulee' };
  if (premiere.cases.length > 1) return { retenue: null, motif: 'reponse-multiple' };
  if (premiere.cases.length === 1) return { retenue: premiere.cases[0], motif: 'premiere-ligne' };

  return { retenue: null, motif: 'sans-reponse' };
}

/**
 * La ligne que la lecture a retenue.
 *
 * Utile à l'écran de fin, qui dit non seulement la réponse mais d'où elle
 * vient : « 2ᵉ ligne » n'a pas la même leçon que « réponse multiple ». La
 * règle est la même que celle de `lireLaZone` — la seconde ligne dès qu'elle
 * est servie —, et la tenir en un seul endroit évite qu'elles divergent.
 */
export const ligneRetenue = (zone: Zone): 'premiere' | 'seconde' =>
  ligneEstVide(zone.seconde) ? 'premiere' : 'seconde';

/**
 * L'issue d'une zone au barème du concours : +1, −0,5, ou 0.
 *
 * Une **réponse multiple est une réponse inexacte**, et non une abstention :
 * c'est la directive 4, et c'est ce qui la distingue d'une case laissée vide.
 * Confondre les deux rendrait le remplissage au hasard gratuit, ce que le
 * barème existe précisément pour empêcher.
 *
 * `bonnes` vient de la question. Une question dont la clef porte plusieurs
 * bonnes réponses ne peut pas être réussie sur une copie — une seule case par
 * ligne y est autorisée —, et c'est pourquoi le format ne la pose pas : voir
 * `estPosableSurUneCopie`.
 */
export function issueDeLaZone(lecture: LectureDeZone, bonnes: readonly number[]): Issue {
  if (lecture.motif === 'reponse-multiple') return 'mauvaise';
  if (lecture.retenue === null) return 'abstention';
  return bonnes.length === 1 && bonnes[0] === lecture.retenue ? 'bonne' : 'mauvaise';
}

/* ══════════════════════════════════════════════════════════════════════════
   Quelles questions une copie peut porter
   ══════════════════════════════════════════════════════════════════════════ */

/** Le nombre de propositions qu'une zone de la feuille officielle peut porter. */
export const PROPOSITIONS_PAR_ZONE = 4;

/**
 * Cette question entre-t-elle dans une zone de la feuille ?
 *
 * ## Le défaut que ce filtre existe pour empêcher
 *
 * La feuille pré-imprimée a **quatre cases numérotées et une case « Ann »**,
 * et le guide ENFiP le confirme pour l'épreuve réelle : « quatre propositions
 * par question, une seule réponse autorisée ». La banque de Cyclades, elle,
 * accepte de deux à n propositions et des réponses multiples — c'est son
 * schéma, et c'est utile au format « une question à la fois ».
 *
 * Posée sur une copie, une question à cinq propositions n'aurait pas de case
 * où se cocher ; une question à deux bonnes réponses serait **impossible à
 * réussir**, puisque cocher deux cases vaut réponse inexacte. Elle coûterait
 * un demi-point à coup sûr, sans que rien ne l'explique.
 *
 * Le format « Copie de concours » ne tire donc que les questions conformes,
 * et l'écran dit franchement combien de questions il peut servir — le
 * mécanisme existe déjà pour les formats que la banque ne remplit qu'à
 * moitié. Rien n'est retiré de la banque, et le format « une question à la
 * fois » continue de les poser toutes.
 */
export function estPosableSurUneCopie(question: {
  options: readonly unknown[];
  bonnes: readonly number[];
}): boolean {
  return question.options.length === PROPOSITIONS_PAR_ZONE && question.bonnes.length === 1;
}

/**
 * Pourquoi une question a été écartée de la copie. Pour le compte rendu.
 *
 * Rendu plutôt que compté : « douze questions écartées » n'apprend rien, « dix
 * à cinq propositions, deux à deux bonnes réponses » dit quoi corriger dans
 * la banque.
 */
export function raisonDuRetrait(question: {
  options: readonly unknown[];
  bonnes: readonly number[];
}): 'propositions' | 'reponses-multiples' | null {
  if (question.options.length !== PROPOSITIONS_PAR_ZONE) return 'propositions';
  if (question.bonnes.length !== 1) return 'reponses-multiples';
  return null;
}
