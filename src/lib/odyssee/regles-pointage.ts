/**
 * Les règles locales, et le nom inconnu traité sur le champ — phase 3 bis d.
 *
 * ## Mes corrections font des règles, et rien d'autre ne les fait
 *
 * Il n'y a pas d'apprentissage ici, au sens où aucun modèle n'ajuste de
 * poids : une correction écrit une **règle lisible**, que la personne peut
 * relire, modifier et supprimer. C'est plus long à construire et c'est le
 * seul moyen qu'elle puisse répondre à « pourquoi cette opération est-elle
 * classée là ? » autrement que par « le logiciel l'a décidé ».
 *
 * ## Une règle ne touche jamais le passé sans qu'on l'ait vu
 *
 * Créer une règle, c'est décider pour l'avenir. L'appliquer aux opérations
 * déjà importées est un **second geste**, avec le nombre d'opérations
 * touchées et des exemples. Une règle qui reclasse silencieusement trois
 * mois d'historique change des chiffres que la personne a déjà regardés.
 *
 * Et jamais, dans aucun cas, une opération **pointée par elle**.
 *
 * ## Deux corrections contradictoires : on demande
 *
 * Classer « CARREFOUR » en alimentation un jour et en carburant le
 * lendemain n'est pas une erreur : c'est un vendeur multi-catégories. En
 * tirer une règle silencieuse ferait perdre l'une des deux intentions.
 */
import { normaliser } from './appariement';
import { typeDe } from './taxonomie';
import {
  examinerLeMotif,
  libelleNet,
  positionDuMotif,
  type AvisSurLeMotif,
  type RegleDePointage,
} from './vendeurs';

/* ══════════════════════════════════════════════════════════════════════════
   Proposer un motif
   ══════════════════════════════════════════════════════════════════════════ */

/** Les mots qu'un motif proposé ne retient jamais. */
const SANS_VALEUR = new Set([
  'DE', 'DU', 'LA', 'LE', 'LES', 'ET', 'DES', 'AU', 'AUX', 'EN', 'SUR',
  'SARL', 'SAS', 'SA', 'EURL', 'SCI', 'ETS', 'STE',
]);

/**
 * Le motif que l'écran propose pour un groupe de libellés.
 *
 * Le **plus long préfixe commun en mots**, moins la plomberie. Un préfixe,
 * parce que l'enseigne est en tête d'un libellé bancaire et que la queue
 * porte la ville, la date et la référence — c'est-à-dire exactement ce qui
 * varie d'une opération à l'autre.
 *
 * Si le préfixe commun ne retient rien d'utilisable, on rend les deux
 * premiers mots porteurs du premier libellé : un motif imparfait qu'on peut
 * corriger vaut mieux qu'un champ vide devant lequel on abandonne.
 */
export function motifPropose(libelles: readonly string[]): string {
  if (!libelles.length) return '';
  const mots = libelles.map((l) => libelleNet(l).split(' ').filter(Boolean));
  const premier = mots[0];
  let commun = 0;
  while (commun < premier.length && mots.every((m) => m[commun] === premier[commun])) {
    commun += 1;
  }
  const retenus = premier.slice(0, commun).filter((m) => !SANS_VALEUR.has(m) && !/^\d+$/.test(m));
  if (retenus.join(' ').replace(/\s/g, '').length >= 4) return retenus.join(' ');

  const utiles = premier.filter((m) => !SANS_VALEUR.has(m) && !/^\d+$/.test(m));
  return utiles.slice(0, 2).join(' ');
}

/**
 * Les types suggérés pour un vendeur inconnu — **sans IA**.
 *
 * Trois sources, dans cet ordre : un mot du libellé qui est le libellé d'un
 * type (« BOULANGERIE » → Boulangerie), le type des vendeurs déjà vus dont
 * le libellé ressemble, et la catégorie fournie par la banque. Aucune ne
 * devine : chacune rapproche deux chaînes de caractères.
 *
 * Trois au plus. Une liste de quarante-six types déroulée sous chaque
 * vendeur inconnu est une liste qu'on ne lit pas.
 */
export function typesSuggeres(
  libelles: readonly string[],
  tousLesTypes: readonly { id: string; libelle: string }[],
  categorieDeLaBanque: string | null = null,
): string[] {
  const net = ` ${libelles.map((l) => libelleNet(l)).join(' ')} `;
  const suggeres: string[] = [];

  for (const t of tousLesTypes) {
    const mots = normaliser(t.libelle).split(' ').filter((m) => m.length >= 5);
    if (mots.some((m) => positionDuMotif(net.trim(), m) !== -1)) suggeres.push(t.id);
  }
  if (categorieDeLaBanque) {
    const c = normaliser(categorieDeLaBanque);
    for (const t of tousLesTypes) {
      if (normaliser(t.libelle) === c && !suggeres.includes(t.id)) suggeres.push(t.id);
    }
  }
  return suggeres.slice(0, 3);
}

/* ══════════════════════════════════════════════════════════════════════════
   Créer une règle
   ══════════════════════════════════════════════════════════════════════════ */

export interface BrouillonDeRegle {
  nom: string;
  typeId: string;
  motif: string;
  comparaison: 'contient' | 'commence' | 'exact';
  mode: 'auto' | 'proposer' | 'manuel';
  ligneId: string | null;
}

/**
 * Le brouillon qu'un vendeur inconnu propose, en un geste.
 *
 * `mode` est **« proposer »**, jamais « auto ». Une règle créée en trois
 * secondes dans un écran n'a pas été relue ; lui donner le droit de classer
 * seule ferait du geste d'un clic une décision dont la personne ne mesure
 * pas la portée. Elle peut le passer en auto, et c'est alors son choix.
 */
export function brouillonPour(
  nom: string,
  typeId: string,
  libelles: readonly string[],
): BrouillonDeRegle {
  return {
    nom,
    typeId,
    motif: motifPropose(libelles),
    comparaison: 'contient',
    mode: 'proposer',
    ligneId: null,
  };
}

export interface ProblemeDeBrouillon {
  champ: 'nom' | 'typeId' | 'motif';
  phrase: string;
}

export function controlerLeBrouillon(
  b: BrouillonDeRegle,
  vises: readonly string[],
  tousLesLibelles: readonly string[],
): { problemes: ProblemeDeBrouillon[]; avis: AvisSurLeMotif } {
  const problemes: ProblemeDeBrouillon[] = [];
  if (!b.nom.trim()) {
    problemes.push({ champ: 'nom', phrase: 'Une règle porte un nom : c’est lui qui s’affichera.' });
  }
  if (!typeDe(b.typeId)) {
    problemes.push({ champ: 'typeId', phrase: 'Choisissez un type. Sans type, rien n’alimente de catégorie.' });
  }
  const avis = examinerLeMotif(b.motif, vises, tousLesLibelles);
  if (!avis.acceptable) problemes.push({ champ: 'motif', phrase: avis.avertissement });

  /*
     Une règle en mode automatique sur un type qui l'interdit n'est pas une
     erreur de saisie mais une contradiction : on la refuse plutôt que de
     l'accepter en la désobéissant en silence.
  */
  if (b.mode === 'auto' && typeDe(b.typeId)?.jamaisAuto) {
    problemes.push({
      champ: 'typeId',
      phrase:
        `« ${typeDe(b.typeId)!.libelle} » n’est jamais pointé automatiquement. La règle peut ` +
        'proposer, pas décider seule.',
    });
  }
  return { problemes, avis };
}

export function regleDepuisLeBrouillon(
  b: BrouillonDeRegle,
  id: string,
  quand: string,
): RegleDePointage {
  return {
    id,
    nom: b.nom.trim(),
    typeId: b.typeId,
    motif: normaliser(b.motif),
    comparaison: b.comparaison,
    mode: b.mode,
    ligneId: b.ligneId,
    appliquee: 0,
    corrigee: 0,
    majLe: quand,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Appliquer au passé — après aperçu, jamais avant
   ══════════════════════════════════════════════════════════════════════════ */

export interface OperationPointable {
  id: string;
  libelle: string;
  centimes: number;
  /** Vrai si la personne l'a pointée elle-même. Intouchable. */
  pointeeParMoi?: boolean;
}

export interface Apercu {
  /** Celles que la règle reclasserait. */
  touchees: readonly OperationPointable[];
  /** Celles qu'elle attraperait mais qu'on ne touche pas : pointées par vous. */
  protegees: readonly OperationPointable[];
  somme: number;
  phrase: string;
}

/**
 * Ce qu'une règle ferait au passé, **avant** de le faire.
 *
 * Les opérations pointées par la personne sont comptées à part et jamais
 * touchées. Les montrer plutôt que de les taire est le point : « 14
 * opérations, dont 3 que vous avez classées vous-même et qui ne bougeront
 * pas » est une phrase qui laisse décider ; « 11 opérations » cache une
 * règle qu'on croit comprendre.
 */
export function apercuSurLePasse(
  r: RegleDePointage,
  operations: readonly OperationPointable[],
): Apercu {
  const colle = (o: OperationPointable) => {
    const net = libelleNet(o.libelle);
    const m = normaliser(r.motif);
    if (!m) return false;
    if (r.comparaison === 'exact') return net === m;
    if (r.comparaison === 'commence') return net.startsWith(m);
    return positionDuMotif(net, m) !== -1;
  };
  const attrapees = operations.filter(colle);
  const protegees = attrapees.filter((o) => o.pointeeParMoi);
  const touchees = attrapees.filter((o) => !o.pointeeParMoi);
  const somme = touchees.reduce((s, o) => s + Math.abs(o.centimes), 0);

  const phrase = touchees.length === 0
    ? 'Cette règle ne touche aucune opération déjà importée.'
    : `${touchees.length} opération(s) déjà importée(s) seraient reclassées`
      + (protegees.length
        ? `, et ${protegees.length} que vous avez pointée(s) vous-même ne bougeront pas.`
        : '.');
  return { touchees, protegees, somme, phrase };
}

/* ══════════════════════════════════════════════════════════════════════════
   Deux corrections contradictoires
   ══════════════════════════════════════════════════════════════════════════ */

export interface Contradiction {
  motif: string;
  types: readonly string[];
  question: string;
}

/**
 * Deux corrections qui disent deux choses du même vendeur.
 *
 * On ne tranche pas, on **demande**. Classer un hypermarché en alimentation
 * un jour et en carburant le lendemain n'est pas une erreur : c'est un
 * vendeur multi-catégories, et la bonne réponse est peut-être de le dire.
 */
export function detecterLesContradictions(
  regles: readonly RegleDePointage[],
): Contradiction[] {
  const parMotif = new Map<string, Set<string>>();
  for (const r of regles) {
    const m = normaliser(r.motif);
    parMotif.set(m, (parMotif.get(m) ?? new Set()).add(r.typeId));
  }
  const sorties: Contradiction[] = [];
  for (const [motif, types] of parMotif) {
    if (types.size < 2) continue;
    const noms = [...types].map((t) => typeDe(t)?.libelle ?? t).sort();
    sorties.push({
      motif,
      types: [...types].sort(),
      question:
        `« ${motif} » est classé à la fois en ${noms.join(' et en ')}. Est-ce un vendeur ` +
        'multi-catégories, ou l’une des deux règles est-elle de trop ?',
    });
  }
  return sorties.sort((a, b) => a.motif.localeCompare(b.motif));
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerLesRegles(): string[] {
  const problemes: string[] = [];

  /*
     Le point qui compte, et qu'aucune relecture ne garantit : une règle
     créée en un geste ne doit pas pouvoir pointer seule.
  */
  const b = brouillonPour('Le Fournil de Tournay', 'boulangerie', ['CB LE FOURNIL DE TOURNAY']);
  if (b.mode !== 'proposer') {
    problemes.push(
      'Une règle créée en un geste naît en mode automatique. Un clic de trois secondes ' +
        'déciderait alors du classement de tout un historique.',
    );
  }

  /* Et une opération pointée à la main ne bouge jamais. */
  const regle: RegleDePointage = {
    id: 'r', nom: 'Test', typeId: 'boulangerie', motif: 'FOURNIL', comparaison: 'contient',
    mode: 'proposer', ligneId: null, appliquee: 0, corrigee: 0, majLe: '2026-01-01T00:00:00.000Z',
  };
  const apercu = apercuSurLePasse(regle, [
    { id: 'A', libelle: 'CB LE FOURNIL DE TOURNAY', centimes: -800 },
    { id: 'B', libelle: 'CB LE FOURNIL TOURNAY', centimes: -900, pointeeParMoi: true },
  ]);
  if (apercu.touchees.some((o) => o.pointeeParMoi)) {
    problemes.push('Une règle toucherait une opération pointée à la main.');
  }
  if (!apercu.protegees.length) {
    problemes.push(
      'Les opérations protégées ne sont pas montrées. Les taire ferait croire que la règle ' +
        'touche moins qu’elle ne semble, ou plus.',
    );
  }
  if (!apercu.phrase.includes('ne bougeront pas')) {
    problemes.push('L’aperçu ne dit pas ce qui ne bougera pas.');
  }
  return problemes;
}
