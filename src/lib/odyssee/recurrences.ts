/**
 * Déduire le budget du réel — Finances, 1.5, phase 3.
 *
 * Saisir trente lignes de budget à la main est le mur contre lequel butent
 * tous les outils de ce genre : on les saisit un dimanche, on les oublie le
 * suivant. Les opérations importées contiennent déjà la réponse — un loyer
 * part tous les 5 du mois depuis deux ans — et il suffit de la lire.
 *
 * ## Ce module propose, il ne crée rien
 *
 * Chaque proposition est une ligne de budget **à valider**, avec ce sur quoi
 * elle repose : combien d'occurrences, sur quelle durée, avec quelle
 * dispersion. Créer trente lignes automatiquement donnerait un budget que
 * personne n'a décidé, et dont chaque écart serait l'écart à une prévision
 * qu'on n'a pas faite.
 *
 * ## Trois occurrences, pas deux
 *
 * Deux opérations espacées d'un mois sont **toujours** mensuelles : par deux
 * points passe exactement une droite, et la régularité qu'on y lit est celle
 * qu'on y a mise. La troisième est la première qui puisse démentir. C'est le
 * seuil le plus bas qui ait un sens, et il reste bas : un trimestre d'un
 * paiement mensuel suffit.
 *
 * ## La médiane, et la dispersion décide de la nature
 *
 * Le montant proposé est la **médiane**, pas la moyenne : une régularisation
 * d'électricité à 450 € une fois par an déplacerait une moyenne de vingt
 * euros par mois, et le budget serait faux onze mois sur douze. La dispersion
 * autour de cette médiane, elle, n'est pas jetée — c'est elle qui choisit si
 * la ligne est proposée `fixe`, `estime` ou en `fourchette`. Un abonnement
 * sans variation et des courses sont deux faits différents, et les présenter
 * tous les deux comme un montant fixe en effacerait un.
 */
import { euros, type Centimes, type OperationBancaire } from './finances';
import { fragmentsDe, normaliser, type Motif } from './appariement';
import {
  TOLERANCE_PAR_DEFAUT,
  type LigneBudget,
  type Nature,
  type Periodicite,
  type Sens,
} from './budget';

/* ══════════════════════════════════════════════════════════════════════════
   Les réglages, et pourquoi ils sont là plutôt que codés en dur
   ══════════════════════════════════════════════════════════════════════════ */

/** En deçà, on ne conclut rien. Voir l'en-tête : par deux points, une droite. */
export const OCCURRENCES_MINIMALES = 3;

/**
 * L'écart toléré à la périodicité théorique, en jours.
 *
 * Un prélèvement « mensuel » ne tombe pas tous les trente jours : février en
 * fait vingt-huit, un 5 qui tombe un dimanche part le 6, et une banque
 * décale ses traitements de fin d'année. Cinq jours absorbent tout cela sans
 * confondre un mensuel avec un bimensuel.
 */
export const JOURS_DE_JEU = 5;

/** Au-delà de cette dispersion relative, la ligne n'est plus « fixe ». */
export const DISPERSION_FIXE = 0.02;
/** Au-delà de celle-ci, on ne propose plus un montant mais une fourchette. */
export const DISPERSION_FOURCHETTE = 0.25;

const INTERVALLES: { periodicite: Periodicite; jours: number }[] = [
  { periodicite: 'hebdomadaire', jours: 7 },
  { periodicite: 'mensuelle', jours: 30.44 },
  { periodicite: 'trimestrielle', jours: 91.31 },
  { periodicite: 'annuelle', jours: 365.25 },
];

/* ══════════════════════════════════════════════════════════════════════════
   Les outils
   ══════════════════════════════════════════════════════════════════════════ */

export function mediane(valeurs: readonly number[]): number {
  if (!valeurs.length) return 0;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
}

const joursEntre = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/* ══════════════════════════════════════════════════════════════════════════
   La détection
   ══════════════════════════════════════════════════════════════════════════ */

export interface Recurrence {
  /** Le fragment de libellé commun, normalisé. C'est la clé du groupe. */
  fragment: string;
  /** Le libellé le plus récent, tel qu'il est écrit sur le relevé. */
  libelle: string;
  compteId: string;
  sens: Sens;
  operationIds: readonly string[];
  /** Le montant proposé : la médiane, en valeur absolue. */
  montant: Centimes;
  /** Les bornes observées, pour une fourchette et pour la phrase. */
  montantBas: Centimes;
  montantHaut: Centimes;
  /** Dispersion relative autour de la médiane. `null` si la médiane est nulle. */
  dispersion: number | null;
  nature: Nature;
  periodicite: Periodicite;
  /** Jour du mois attendu, ou jour de la semaine si hebdomadaire. */
  jourAttendu: number;
  /** L'écart médian à la périodicité théorique, en jours. */
  regularite: number;
  premier: string;
  dernier: string;
  /** Ce sur quoi la proposition repose, en une phrase. */
  fondement: string;
}

/**
 * Les fragments de libellé candidats, avec les opérations qu'ils couvrent.
 *
 * Sans exclusivité : « EDF », « PRLV EDF » et le libellé entier sont tous
 * trois proposés, et c'est `detecterLesRecurrences` qui tranche — une fois
 * qu'elle sait lequel forme vraiment une récurrence.
 */
export function candidats(
  operations: readonly OperationBancaire[],
): Map<string, OperationBancaire[]> {
  const parFragment = new Map<string, OperationBancaire[]>();
  const ajouter = (cle: string, o: OperationBancaire) => {
    if (cle) parFragment.set(cle, [...(parFragment.get(cle) ?? []), o]);
  };
  for (const o of operations) {
    if (o.transfertAvec) continue;
    for (const f of fragmentsDe(o.libelle)) ajouter(f, o);
    /* Le libellé entier compte aussi : certains n'ont qu'un mot utile. */
    ajouter(normaliser(o.libelle), o);
  }
  for (const [cle, liste] of [...parFragment]) {
    if (liste.length < OCCURRENCES_MINIMALES) parFragment.delete(cle);
    else liste.sort((a, b) => a.jour.localeCompare(b.jour) || a.id.localeCompare(b.id));
  }
  return parFragment;
}

function periodiciteDe(jours: readonly string[]): { periodicite: Periodicite; regularite: number } | null {
  const intervalles: number[] = [];
  for (let i = 1; i < jours.length; i += 1) intervalles.push(joursEntre(jours[i - 1], jours[i]));
  if (!intervalles.length) return null;
  const m = mediane(intervalles);

  let meilleure: { periodicite: Periodicite; regularite: number } | null = null;
  for (const { periodicite, jours: theorique } of INTERVALLES) {
    const ecart = Math.abs(m - theorique);
    const jeu = periodicite === 'annuelle' ? JOURS_DE_JEU * 3 : JOURS_DE_JEU;
    if (ecart > jeu) continue;
    const regularite = mediane(intervalles.map((i) => Math.abs(i - theorique)));
    if (!meilleure || regularite < meilleure.regularite) meilleure = { periodicite, regularite };
  }
  return meilleure;
}

function natureDe(dispersion: number | null): Nature {
  if (dispersion === null || dispersion <= DISPERSION_FIXE) return 'fixe';
  return dispersion <= DISPERSION_FOURCHETTE ? 'estime' : 'fourchette';
}

/**
 * Les récurrences lisibles dans un historique d'opérations.
 *
 * Rendues triées par montant décroissant : une ligne à 780 € par mois mérite
 * d'être vue avant un abonnement à 2,99 €, et une liste par ordre
 * alphabétique obligerait à la lire en entier pour trouver l'essentiel.
 */
export function detecterLesRecurrences(
  operations: readonly OperationBancaire[],
): Recurrence[] {
  const trouvees: Recurrence[] = [];
  for (const [fragment, groupe] of candidats(operations)) {
    const r = recurrenceDe(fragment, groupe);
    if (r) trouvees.push(r);
  }

  /*
     Plusieurs fragments se disputent les mêmes opérations : « EDF »,
     « PRLV EDF », et le libellé entier. Le gagnant est celui qui **couvre le
     plus d'opérations**, et la dissymétrie est délibérée.

     Préférer le fragment le plus long — mon premier choix — produit une
     faute coûteuse : le jour où la banque renomme « PRLV EDF » en
     « PRLV EDF CLIENTS », le libellé long capte les trois derniers mois, le
     court garde les neuf premiers, et l'écran propose **deux lignes
     d'électricité**. Validées, elles doubleraient le budget de cette charge
     sans que rien ne le signale.

     La faute inverse — « CARREFOUR » avalant « CARREFOUR CITY » et
     « CARREFOUR MARKET » — donne une ligne de trop gros grain, visible au
     premier coup d'œil parce que sa dispersion la fait proposer en
     fourchette, et qu'il suffit de la refuser. Entre une erreur qu'on voit
     et une erreur qui double un budget en silence, le choix est fait.
  */
  trouvees.sort(
    (a, b) =>
      b.operationIds.length - a.operationIds.length ||
      a.regularite - b.regularite ||
      b.fragment.length - a.fragment.length ||
      a.fragment.localeCompare(b.fragment),
  );

  const prises = new Set<string>();
  const retenues: Recurrence[] = [];
  for (const r of trouvees) {
    if (r.operationIds.some((id) => prises.has(id))) continue;
    r.operationIds.forEach((id) => prises.add(id));
    retenues.push(r);
  }

  /* Rendues par montant décroissant : une ligne à 780 € par mois se lit
     avant un abonnement à 2,99 €. */
  return retenues.sort((a, b) => b.montant - a.montant || a.fragment.localeCompare(b.fragment));
}

function recurrenceDe(fragment: string, groupe: readonly OperationBancaire[]): Recurrence | null {
  /*
     Un groupe mêlant débits et crédits n'est pas une récurrence : c'est un
     commerçant chez qui on achète et qui rembourse. On garde le sens
     majoritaire, et on laisse l'autre aux « à classer ».
  */
  const charges = groupe.filter((o) => o.centimes < 0);
  const ressources = groupe.filter((o) => o.centimes > 0);
  const retenues = charges.length >= ressources.length ? charges : ressources;
  if (retenues.length < OCCURRENCES_MINIMALES) return null;

  const jours = retenues.map((o) => o.jour);
  const p = periodiciteDe(jours);
  if (!p) return null;

  const montants = retenues.map((o) => Math.abs(o.centimes));
  const montant = mediane(montants);
  const montantBas = Math.min(...montants);
  const montantHaut = Math.max(...montants);
  const dispersion =
    montant === 0 ? null : mediane(montants.map((m) => Math.abs(m - montant))) / montant;
  const nature = natureDe(dispersion);

  const jourAttendu =
    p.periodicite === 'hebdomadaire'
      ? mediane(jours.map((j) => ((new Date(`${j}T00:00:00Z`).getUTCDay() + 6) % 7) + 1))
      : mediane(jours.map((j) => Number(j.slice(8, 10))));

  const dernier = retenues[retenues.length - 1];
  return {
    fragment,
    libelle: dernier.libelle,
    compteId: dernier.compteId,
    sens: retenues === charges ? 'charge' : 'ressource',
    operationIds: retenues.map((o) => o.id),
    montant,
    montantBas,
    montantHaut,
    dispersion,
    nature,
    periodicite: p.periodicite,
    jourAttendu,
    regularite: p.regularite,
    premier: jours[0],
    dernier: jours[jours.length - 1],
    fondement: fondementDe(
      retenues.length, jours[0], jours[jours.length - 1], nature, montantBas, montantHaut,
    ),
  };
}

function fondementDe(
  combien: number,
  premier: string,
  dernier: string,
  nature: Nature,
  bas: Centimes,
  haut: Centimes,
): string {
  const mois = Math.max(1, Math.round(joursEntre(premier, dernier) / 30.44));
  const base = `${combien} opérations du ${premier} au ${dernier}, soit ${mois} mois.`;
  if (nature === 'fixe') return `${base} Montant constant.`;
  return `${base} Montant observé de ${euros(bas)} à ${euros(haut)}.`;
}

/* ══════════════════════════════════════════════════════════════════════════
   De la récurrence à la ligne
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La ligne de budget qu'une récurrence propose, et ses motifs d'appariement.
 *
 * La ligne naît avec `depuis` au **premier jour observé**, et non au jour de
 * la création : sans cela, les occurrences passées n'existeraient pas et tout
 * l'historique déjà importé resterait « à classer » alors qu'il est
 * précisément ce qui a permis de deviner la ligne.
 *
 * `categorie` reste vide. La deviner serait la seule chose de ce module qui
 * ne se lit pas dans les données : « SARL LE PETIT MARCHE » est des courses
 * ou un restaurant selon ce qu'on y achète, et une catégorie fausse rangée
 * d'office est plus coûteuse qu'une catégorie absente.
 */
export interface Proposition1cinq {
  ligne: LigneBudget;
  motifs: readonly Motif[];
  recurrence: Recurrence;
}

export function enLigneDeBudget(r: Recurrence, cree: string): Proposition1cinq {
  const id = `r-${r.fragment.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  const ligne: LigneBudget = {
    id,
    libelle: r.libelle,
    categorie: '',
    sens: r.sens,
    compteId: r.compteId,
    essentielle: false,
    motifs: [r.fragment],
    versions: [
      {
        depuis: r.premier,
        jusqua: null,
        montant: r.nature === 'fourchette' ? r.montantBas : r.montant,
        nature: r.nature,
        montantHaut: r.nature === 'fourchette' ? r.montantHaut : null,
        periodicite: r.periodicite,
        jourAttendu: r.jourAttendu,
        tolerance: TOLERANCE_PAR_DEFAUT,
      },
    ],
    note: `Déduite du réel le ${cree.slice(0, 10)}. ${r.fondement}`,
    majLe: cree,
  };
  return {
    ligne,
    motifs: [{ ligneId: id, fragment: r.fragment, vu: r.operationIds.length }],
    recurrence: r,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerLesRecurrences(): string[] {
  const problemes: string[] = [];
  if (OCCURRENCES_MINIMALES < 3) {
    problemes.push(
      'Avec moins de trois occurrences, toute paire d’opérations devient une périodicité : ' +
        'par deux points passe exactement une droite.',
    );
  }
  if (DISPERSION_FIXE >= DISPERSION_FOURCHETTE) {
    problemes.push('Les seuils de dispersion doivent croître, sinon aucune ligne n’est « estimée ».');
  }
  /*
     Le mensuel et le bimensuel ne doivent pas se confondre : si le jeu
     dépassait la moitié de l'écart entre deux périodicités voisines, un
     prélèvement tous les quinze jours deviendrait « mensuel ».
  */
  for (let i = 1; i < INTERVALLES.length; i += 1) {
    const ecart = INTERVALLES[i].jours - INTERVALLES[i - 1].jours;
    if (JOURS_DE_JEU * 2 >= ecart) {
      problemes.push(
        `Le jeu de ${JOURS_DE_JEU} jours confondrait ${INTERVALLES[i - 1].periodicite} ` +
          `et ${INTERVALLES[i].periodicite}.`,
      );
    }
  }
  return problemes;
}
