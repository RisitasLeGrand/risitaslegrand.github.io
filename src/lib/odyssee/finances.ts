/**
 * Odyssée : le domaine Finances.
 *
 * ## L'argent se compte en centimes entiers
 *
 * Pas en euros flottants. `0.1 + 0.2` vaut `0.30000000000000004`, et une
 * réconciliation qui compare une somme d'opérations à un solde déclaré se
 * trompe alors d'un centime fantôme — exactement le genre d'écart qu'on passe
 * une soirée à chercher dans sa banque. Tout ce module manipule des entiers ;
 * la conversion se fait à la saisie et à l'affichage, aux deux bords, et
 * `centimesDe()` refuse ce qu'il ne sait pas lire plutôt que de rendre `NaN`.
 *
 * Un montant est **signé** : négatif pour une sortie, positif pour une entrée.
 * Pas de champ « sens » à côté d'une valeur absolue — deux représentations du
 * même fait finissent toujours par diverger.
 *
 * ## Aucun numéro de compte, et ce n'est pas qu'une consigne
 *
 * Le prompt l'interdit (C.7) ; `controlerCompte()` le fait respecter. Un IBAN
 * ou une longue suite de chiffres dans un intitulé est **refusé à l'écriture**,
 * parce qu'une interdiction qui ne vit que dans une documentation est une
 * interdiction qu'un import CSV violera au premier essai — les libellés de
 * banque en sont pleins.
 *
 * ## Ce que ce module ne fera jamais
 *
 * Recommander un achat ou une vente. `controlerVocabulaireFinances()` lit les
 * phrases affichables et refuse « achetez », « vendez », « opportunité »,
 * « vous devriez ». L'arithmétique de rééquilibrage dit **combien déplacer
 * pour rejoindre la cible que la personne a fixée** — c'est une soustraction,
 * pas un conseil, et la différence tient à qui a choisi la cible.
 */

/* ══════════════════════════════════════════════════════════════════════════
   L'argent
   ══════════════════════════════════════════════════════════════════════════ */

/** Un montant, en centimes entiers, signé. */
export type Centimes = number;

export const DEVISE_PAR_DEFAUT = 'EUR';

/**
 * Lit un montant saisi à la main ou venu d'un CSV français.
 *
 * Accepte la virgule décimale, les espaces (y compris insécables, que les
 * relevés de banque sèment partout), le signe en tête, et le symbole €.
 * Rend `null` sur tout le reste : une saisie illisible est une absence, pas
 * un zéro — et un zéro inventé passerait une réconciliation en silence.
 */
export function centimesDe(saisie: string): Centimes | null {
  const net = saisie
    .replace(/[\s  ]/g, '')
    .replace(/€|EUR/gi, '')
    .replace(',', '.');
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(net)) return null;
  /*
     Le passage par une chaîne plutôt que `Math.round(x * 100)` : 1,15 € vaut
     114,99999999999999 une fois multiplié, et s'arrondirait à 114 avec une
     troncature. On lit les décimales telles qu'écrites.
  */
  const [signe, corps] = net.startsWith('-') ? [-1, net.slice(1)] : [1, net.replace(/^\+/, '')];
  const [entiers, decimales = ''] = corps.split('.');
  return signe * (Number(entiers) * 100 + Number(decimales.padEnd(2, '0')));
}

/** Affiche un montant. Jamais utilisé pour calculer. */
export function euros(c: Centimes): string {
  return (c / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

/* ══════════════════════════════════════════════════════════════════════════
   Les comptes
   ══════════════════════════════════════════════════════════════════════════ */

export type TypeDeCompte =
  | 'courant'
  | 'livret'
  | 'epargne-reglementee'
  | 'pea'
  | 'compte-titres'
  | 'assurance-vie'
  | 'per'
  | 'dette'
  | 'autre-actif';

export const TYPES_DE_COMPTE: Record<TypeDeCompte, { libelle: string; passif: boolean }> = {
  courant: { libelle: 'Compte courant', passif: false },
  livret: { libelle: 'Livret', passif: false },
  'epargne-reglementee': { libelle: 'Épargne réglementée', passif: false },
  pea: { libelle: 'PEA', passif: false },
  'compte-titres': { libelle: 'Compte-titres', passif: false },
  'assurance-vie': { libelle: 'Assurance-vie', passif: false },
  per: { libelle: 'PER', passif: false },
  /*
     Une dette est un compte comme un autre, et sa valorisation est **positive**
     — c'est son appartenance au passif qui la fait soustraire. L'alternative,
     saisir « −12 000 » pour un prêt, oblige la personne à se souvenir d'un
     signe, et une erreur de signe sur un passif fausse le patrimoine du double
     du montant.
  */
  dette: { libelle: 'Dette ou prêt', passif: true },
  'autre-actif': { libelle: 'Autre actif', passif: false },
};

export const ORDRE_TYPES: readonly TypeDeCompte[] = [
  'courant',
  'livret',
  'epargne-reglementee',
  'pea',
  'compte-titres',
  'assurance-vie',
  'per',
  'autre-actif',
  'dette',
];

export interface Compte {
  id: string;
  libelle: string;
  type: TypeDeCompte;
  devise: string;
  /** Un compte clos reste dans l'historique, et sort du patrimoine courant. */
  closLe: string | null;
  majLe: string;
}

/**
 * Ce qui ressemble à une coordonnée bancaire.
 *
 * Deux formes, et la seconde attrape ce que la première laisse passer :
 * l'IBAN écrit en toutes lettres, et **toute suite d'au moins neuf chiffres**,
 * espaces et tirets ignorés. Neuf, parce qu'un RIB français en compte onze et
 * qu'un numéro de compte en compte onze aussi, tandis qu'une année, un code
 * postal, un montant ou un numéro de facture en comptent moins.
 *
 * La règle attrape donc un peu large : « VIREMENT 123456789 » est refusé. Le
 * message le dit et propose de retirer le numéro, qui n'apporte rien à un
 * libellé — c'est le bon côté sur lequel se tromper quand l'erreur inverse
 * consiste à enregistrer un RIB.
 */
const IBAN = /\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]{4}){2,}/i;
const SUITE_DE_CHIFFRES = /(?:\d[\s-]?){9,}/;

export function ressembleAUnNumeroDeCompte(texte: string): boolean {
  return IBAN.test(texte) || SUITE_DE_CHIFFRES.test(texte);
}

export function controlerCompte(c: Compte): string[] {
  const problemes: string[] = [];
  if (!c.libelle.trim()) problemes.push('Un compte a un intitulé.');
  if (ressembleAUnNumeroDeCompte(c.libelle)) {
    problemes.push(
      'Cet intitulé contient ce qui ressemble à un numéro de compte ou à un IBAN. ' +
        'Cyclades n’en enregistre aucun : retirez les chiffres, un nom suffit.',
    );
  }
  if (!/^[A-Z]{3}$/.test(c.devise)) problemes.push('La devise s’écrit en trois lettres, comme EUR.');
  if (!(c.type in TYPES_DE_COMPTE)) problemes.push(`Type de compte inconnu : « ${c.type} ».`);
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les valorisations et le patrimoine
   ══════════════════════════════════════════════════════════════════════════ */

export interface Valorisation {
  id: string;
  compteId: string;
  jour: string;
  /** Toujours positive, y compris pour une dette : voir `TYPES_DE_COMPTE`. */
  centimes: Centimes;
  majLe: string;
}

export function controlerValorisation(v: Valorisation): string[] {
  const problemes: string[] = [];
  if (!Number.isInteger(v.centimes)) problemes.push('Une valorisation se compte en centimes entiers.');
  if (v.centimes < 0) {
    problemes.push(
      'Une valorisation est positive. Pour une dette, saisissez le montant dû : ' +
        'c’est son type qui la fait soustraire du patrimoine.',
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.jour)) problemes.push('Une valorisation porte un jour.');
  if (!v.compteId) problemes.push('Une valorisation appartient à un compte.');
  return problemes;
}

export interface Patrimoine {
  /** `null` si aucun compte ouvert n'a jamais été valorisé. */
  net: Centimes | null;
  actif: Centimes;
  passif: Centimes;
  /** Les comptes ouverts sans aucune valorisation à cette date. */
  sansValorisation: readonly string[];
  /** La valorisation retenue la plus ancienne, pour dire la fraîcheur. */
  plusAncienne: string | null;
}

/**
 * Le patrimoine net à une date, à partir de la **dernière valorisation connue**
 * de chaque compte.
 *
 * Deux choses que le total seul ne dirait pas, et qui sont rendues avec lui.
 *
 * `sansValorisation` : un compte ouvert et jamais valorisé **ne vaut pas
 * zéro**. L'additionner à zéro ferait un patrimoine faux et rassurant ; le
 * nommer laisse la personne décider si l'absence est un oubli.
 *
 * `plusAncienne` : un patrimoine composé d'une valorisation d'hier et d'une de
 * l'an dernier n'est pas un patrimoine d'aujourd'hui. La date la plus ancienne
 * retenue est ce qui permet à l'écran de le dire (B.4 : une mesure ancienne
 * n'est pas présentée comme actuelle).
 */
export function patrimoineNet(
  comptes: readonly Compte[],
  valorisations: readonly Valorisation[],
  jour: string,
): Patrimoine {
  let actif = 0;
  let passif = 0;
  const sansValorisation: string[] = [];
  let plusAncienne: string | null = null;

  for (const compte of comptes) {
    if (compte.closLe && compte.closLe <= jour) continue;
    const retenue = valorisations
      .filter((v) => v.compteId === compte.id && v.jour <= jour)
      .sort((a, b) => a.jour.localeCompare(b.jour))
      .at(-1);
    if (!retenue) {
      sansValorisation.push(compte.id);
      continue;
    }
    if (TYPES_DE_COMPTE[compte.type].passif) passif += retenue.centimes;
    else actif += retenue.centimes;
    if (plusAncienne === null || retenue.jour < plusAncienne) plusAncienne = retenue.jour;
  }

  const aucune = plusAncienne === null;
  return {
    net: aucune ? null : actif - passif,
    actif,
    passif,
    sansValorisation,
    plusAncienne,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les opérations
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une opération bancaire.
 *
 * Nommée `OperationBancaire` et non `Operation` : `noyau/operations.ts` porte
 * déjà une `Operation`, qui est une entrée du journal de synchronisation. Les
 * deux sont des « opérations » en français courant et n'ont rien à voir ; les
 * laisser se disputer le nom court aurait obligé chaque fichier à
 * renommer l'une des deux à l'import, c'est-à-dire à choisir au cas par cas.
 */
export interface OperationBancaire {
  id: string;
  compteId: string;
  jour: string;
  /** Signé : négatif pour une sortie. */
  centimes: Centimes;
  libelle: string;
  /** Libre, posée par les règles locales ou à la main. Vide = non catégorisée. */
  categorie: string;
  /**
   * L'identifiant de l'opération miroir, quand c'est un virement interne.
   *
   * Nommé en positif — « ces deux-là sont le même mouvement » — parce qu'un
   * simple drapeau `interne: true` sur chaque ligne laisserait deux moitiés
   * sans moyen de vérifier qu'elles s'annulent.
   */
  transfertAvec: string | null;
  majLe: string;
}

export function controlerOperation(o: OperationBancaire): string[] {
  const problemes: string[] = [];
  if (!Number.isInteger(o.centimes)) problemes.push('Une opération se compte en centimes entiers.');
  if (o.centimes === 0) {
    problemes.push('Une opération de zéro n’est pas une opération.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.jour)) problemes.push('Une opération porte un jour.');
  if (!o.compteId) problemes.push('Une opération appartient à un compte.');
  if (ressembleAUnNumeroDeCompte(o.libelle)) {
    problemes.push(
      'Ce libellé contient ce qui ressemble à un numéro de compte. ' +
        'Les libellés de banque en sont pleins : retirez-le avant d’enregistrer.',
    );
  }
  return problemes;
}

/* ── Les règles de catégorisation ──────────────────────────────────────── */

export interface RegleCategorisation {
  id: string;
  /** Cherché dans le libellé, sans tenir compte de la casse ni des accents. */
  motif: string;
  categorie: string;
  /** Plus petit d'abord. À égalité, l'ordre de la liste. */
  rang: number;
  majLe: string;
}

const sansAccent = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * La première règle qui répond gagne.
 *
 * Et c'est tout : pas de score, pas de « meilleure correspondance ». Une
 * catégorisation dont on ne peut pas prédire le résultat est une
 * catégorisation qu'on ne corrige pas, on la subit.
 */
export function categoriser(libelle: string, regles: readonly RegleCategorisation[]): string {
  const cible = sansAccent(libelle);
  const triees = [...regles].sort((a, b) => a.rang - b.rang);
  for (const regle of triees) {
    if (regle.motif.trim() && cible.includes(sansAccent(regle.motif))) return regle.categorie;
  }
  return '';
}

/* ── Les virements internes ────────────────────────────────────────────── */

/** Au-delà, deux opérations opposées ne sont plus le même mouvement. */
export const JOURS_ENTRE_LES_DEUX_MOITIES = 3;

export interface Appariement {
  sortie: string;
  entree: string;
}

/**
 * Apparie les deux moitiés d'un virement interne.
 *
 * Sans cela, déplacer 500 € du courant vers un livret compte **500 € de
 * dépense et 500 € de revenu**. Le taux d'épargne devient faux, les dépenses
 * du mois gonflent, et la personne se croit dépensière parce qu'elle a
 * épargné. C'est le défaut le plus courant des suivis de budget maison.
 *
 * Critères : montants exactement opposés, comptes différents, moins de
 * `JOURS_ENTRE_LES_DEUX_MOITIES` jours d'écart, et chaque opération ne sert
 * qu'une fois. On apparie la paire la plus proche dans le temps d'abord, pour
 * que deux virements du même montant dans le même mois ne se croisent pas.
 */
export function detecterTransferts(operations: readonly OperationBancaire[]): Appariement[] {
  const jours = (a: string, b: string) =>
    Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;

  const candidats: (Appariement & { ecart: number })[] = [];
  for (const sortie of operations) {
    if (sortie.centimes >= 0) continue;
    for (const entree of operations) {
      if (entree.centimes !== -sortie.centimes) continue;
      if (entree.compteId === sortie.compteId) continue;
      const ecart = jours(sortie.jour, entree.jour);
      if (ecart > JOURS_ENTRE_LES_DEUX_MOITIES) continue;
      candidats.push({ sortie: sortie.id, entree: entree.id, ecart });
    }
  }
  candidats.sort((a, b) => a.ecart - b.ecart || a.sortie.localeCompare(b.sortie));

  const pris = new Set<string>();
  const retenus: Appariement[] = [];
  for (const c of candidats) {
    if (pris.has(c.sortie) || pris.has(c.entree)) continue;
    pris.add(c.sortie);
    pris.add(c.entree);
    retenus.push({ sortie: c.sortie, entree: c.entree });
  }
  return retenus;
}

/* ── Les flux ──────────────────────────────────────────────────────────── */

export interface Flux {
  revenus: Centimes;
  depenses: Centimes;
  epargne: Centimes;
  /** `null` sans revenu : diviser par zéro ne fait pas « 0 % d'épargne ». */
  tauxEpargne: number | null;
  /** Combien d'opérations ont été écartées comme virements internes. */
  transfertsEcartes: number;
}

/**
 * Revenus, dépenses, épargne sur un ensemble d'opérations.
 *
 * Les virements internes sont **exclus des deux côtés** : voir
 * `detecterTransferts`. L'épargne est ce qui reste, et non la somme des
 * versements vers les livrets — compter les versements ferait apparaître une
 * épargne négative le mois où l'on puise dedans, ce qui est vrai, et une
 * épargne nulle le mois où l'on ne verse rien tout en dépensant moins que l'on
 * gagne, ce qui ne l'est pas.
 */
export function flux(operations: readonly OperationBancaire[]): Flux {
  const internes = new Set<string>();
  for (const paire of detecterTransferts(operations)) {
    internes.add(paire.sortie);
    internes.add(paire.entree);
  }
  let revenus = 0;
  let depenses = 0;
  for (const o of operations) {
    if (internes.has(o.id) || o.transfertAvec) continue;
    if (o.centimes > 0) revenus += o.centimes;
    else depenses += -o.centimes;
  }
  const epargne = revenus - depenses;
  return {
    revenus,
    depenses,
    epargne,
    tauxEpargne: revenus === 0 ? null : Math.round((epargne / revenus) * 1000) / 10,
    transfertsEcartes: internes.size,
  };
}

/**
 * Combien de mois de dépenses l'épargne de précaution couvre.
 *
 * `null` sans dépense connue : une épargne qui couvre « une infinité de mois »
 * parce qu'on n'a rien saisi est un chiffre rassurant et faux.
 */
export function moisCouverts(precaution: Centimes, depensesMensuelles: Centimes): number | null {
  if (depensesMensuelles <= 0) return null;
  return Math.round((precaution / depensesMensuelles) * 10) / 10;
}

/* ── La réconciliation ─────────────────────────────────────────────────── */

export interface Reconciliation {
  /** Le solde reconstitué à partir des opérations. */
  calcule: Centimes;
  declare: Centimes;
  /** Positif : la banque dit plus que nos opérations. */
  ecart: Centimes;
  concorde: boolean;
}

/**
 * Compare la somme des opérations d'un compte au solde déclaré.
 *
 * **Aucune tolérance.** Ailleurs dans Cyclades, un écart de mesure est normal
 * et les comparaisons ont un seuil ; ici, deux entiers qui diffèrent d'un
 * centime signalent une opération manquante, en double, ou mal signée. Arrondir
 * ce désaccord reviendrait à masquer la seule information utile.
 */
export function reconcilier(
  operations: readonly OperationBancaire[],
  compteId: string,
  soldeDeclare: Centimes,
  depart: Centimes = 0,
): Reconciliation {
  const calcule =
    depart + operations.filter((o) => o.compteId === compteId).reduce((s, o) => s + o.centimes, 0);
  const ecart = soldeDeclare - calcule;
  return { calcule, declare: soldeDeclare, ecart, concorde: ecart === 0 };
}

/* ══════════════════════════════════════════════════════════════════════════
   L'allocation et le rééquilibrage
   ══════════════════════════════════════════════════════════════════════════ */

export interface Part {
  /** Classe d'actifs, zone, secteur : l'axe est choisi par l'appelant. */
  poche: string;
  centimes: Centimes;
}

export interface EcartALaCible {
  poche: string;
  actuel: Centimes;
  /** La part visée, en pour cent, telle que la personne l'a fixée. */
  ciblePourCent: number;
  cible: Centimes;
  /** Positif : il manque ce montant pour rejoindre la cible. */
  aDeplacer: Centimes;
}

/**
 * L'arithmétique de rééquilibrage — et rien d'autre.
 *
 * Elle répond à « combien faut-il déplacer pour que la répartition rejoigne la
 * cible **que j'ai fixée** ». Elle ne dit pas quelle cible se fixer, ne nomme
 * aucun instrument, et ne propose aucun ordre. C'est ce qui la sépare d'un
 * conseil en investissement, et la frontière tient à un seul fait : la cible
 * entre par le paramètre.
 *
 * Rend `null` si les parts ne totalisent rien, ou si la cible ne fait pas 100 %
 * — un rééquilibrage calculé sur une cible incomplète enverrait de l'argent
 * vers nulle part.
 */
export function ecartsALaCible(
  parts: readonly Part[],
  cible: Readonly<Record<string, number>>,
): EcartALaCible[] | null {
  const total = parts.reduce((s, p) => s + p.centimes, 0);
  if (total <= 0) return null;
  const sommeCible = Object.values(cible).reduce((s, x) => s + x, 0);
  if (Math.abs(sommeCible - 100) > 0.01) return null;

  const poches = [...new Set([...parts.map((p) => p.poche), ...Object.keys(cible)])].sort();
  return poches.map((poche) => {
    const actuel = parts.filter((p) => p.poche === poche).reduce((s, p) => s + p.centimes, 0);
    const ciblePourCent = cible[poche] ?? 0;
    const montantCible = Math.round((total * ciblePourCent) / 100);
    return { poche, actuel, ciblePourCent, cible: montantCible, aDeplacer: montantCible - actuel };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou E.4
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'un écran de Finances n'a pas le droit de dire.
 *
 * La frontière n'est pas le sujet, c'est le **mode** : « votre allocation
 * s'écarte de 8 points de votre cible » est une mesure, « vous devriez
 * rééquilibrer » est un conseil. La liste vise donc l'impératif et la
 * prescription, pas le vocabulaire financier.
 */
export const MOTS_INTERDITS_FINANCES: readonly string[] = [
  'achetez',
  'vendez',
  'nous recommandons',
  'je recommande',
  'recommandé d’investir',
  'vous devriez',
  'il faudrait investir',
  'opportunité',
  'bon placement',
  'mauvais placement',
  'rendement garanti',
  'sans risque',
  'valeur sûre',
  'profitez',
  'ne ratez pas',
  'conseil en investissement',
  'nous conseillons',
];

/**
 * Les négations, qui sauvent la mention obligatoire.
 *
 * Le premier jet refusait « Aucun conseil en investissement n'est donné ici »
 * — c'est-à-dire exactement la phrase que E.4 impose d'afficher. Une règle qui
 * interdit sa propre clause de non-responsabilité ne survit pas : on la
 * contourne, puis on cesse de la lire.
 *
 * Ce qui est interdit, c'est l'**emploi**, pas la mention. Une occurrence
 * précédée d'une négation proche est donc admise, et seul le reste est signalé.
 */
const NEGATIONS = ['aucun', 'aucune', 'jamais', 'ne ', 'n’', "n'", 'sans', 'pas de', 'rien'];

function estNiee(avant: string): boolean {
  const fenetre = sansAccent(avant).slice(-45);
  return NEGATIONS.some((n) => fenetre.includes(sansAccent(n)));
}

export function controlerVocabulaireFinances(phrases: readonly string[]): string[] {
  const problemes: string[] = [];
  for (const phrase of phrases) {
    const nue = sansAccent(phrase);
    for (const mot of MOTS_INTERDITS_FINANCES) {
      const cible = sansAccent(mot);
      let depuis = 0;
      for (;;) {
        const ou = nue.indexOf(cible, depuis);
        if (ou === -1) break;
        depuis = ou + cible.length;
        if (estNiee(nue.slice(0, ou))) continue;
        problemes.push(
          `« ${phrase.slice(0, 70)} » emploie « ${mot} » : c’est un conseil, pas une mesure.`,
        );
      }
    }
  }
  return problemes;
}

/** Les textes que ce module propose aux écrans, à relire comme le reste. */
export const PHRASES_FINANCES: readonly string[] = [
  'Votre répartition actuelle, comparée à la cible que vous avez fixée.',
  'Montant à déplacer pour rejoindre cette cible.',
  'Cyclades calcule et affiche. Le jugement vous appartient.',
  'Aucun conseil en investissement n’est donné ici, et aucune donnée bancaire ne quitte cet appareil.',
  'Un compte sans valorisation n’est pas un compte à zéro : il est absent du total.',
];

export function controlerFinances(): string[] {
  const problemes = controlerVocabulaireFinances(PHRASES_FINANCES);
  /*
     Le contrôle se contrôle lui-même. La mention de E.4 doit passer, et un
     conseil franc doit tomber : si l'une des deux moitiés cédait, la règle
     serait soit inutilisable, soit décorative — et dans les deux cas on
     cesserait de s'y fier sans que rien ne le signale.
  */
  if (controlerVocabulaireFinances(['Aucun conseil en investissement n’est donné ici.']).length) {
    problemes.push('La mention obligatoire de E.4 est refusée : la négation n’est pas reconnue.');
  }
  if (!controlerVocabulaireFinances(['Vous devriez rééquilibrer ce mois-ci.']).length) {
    problemes.push('Un conseil franc passe le contrôle : la règle ne sert plus à rien.');
  }
  return problemes;
}
