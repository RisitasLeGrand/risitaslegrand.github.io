/**
 * Le domaine Corps : pesées, mesures, sommeil, repas, boissons, santé.
 *
 * ## Ce que ce module refuse, et ce qu'il laisse passer
 *
 * Il refuse **l'impossible** et laisse passer l'invraisemblable. Un poids de
 * −5 kg est impossible : rien ne peut le rendre vrai, et l'écrire est une
 * faute de frappe. Un poids de 300 kg est invraisemblable, et c'est tout
 * autre chose — le refuser reviendrait à dire à quelqu'un qu'il se trompe sur
 * son propre corps.
 *
 * La distinction est celle du contrat de faits (B.3), qui déclare pour chaque
 * type une plage **possible** et une plage **plausible**. Les contrôles d'ici
 * ne reprennent donc que la borne du possible : marquer l'invraisemblable est
 * le travail de `valider()`, qui abaisse la fiabilité au lieu de rejeter.
 *
 * ## Ce que ce module ne contient pas, et pourquoi
 *
 * Ni **médicaments**, ni **statut hormonal**. Les deux appartiennent au
 * domaine Corps et sont déclarés au contrat, mais la **décision 3** — le
 * chiffrement au repos des données les plus sensibles — n'est pas tranchée.
 * Les écrire en clair dans IndexedDB maintenant, puis les chiffrer plus tard,
 * laisserait une trace en clair dans les instantanés de migration et dans les
 * sauvegardes déjà faites : on ne rattrape pas une donnée qu'on a écrite.
 *
 * Le reste du domaine n'attend pas pour autant : une pesée, une nuit et un
 * repas ne sont pas du même ordre, et ce sont eux qui nourrissent les règles
 * de désaccord entre Sport et Odyssée.
 *
 * ## Une nuit appartient au jour où l'on se lève
 *
 * Elle est publiée avec `debut` au coucher et `fin` au lever, et le jour
 * logique d'un fait se calcule sur sa fin. « J'ai mal dormi » désigne la nuit
 * qui précède la journée dont on parle, pas celle qui la suivra.
 */
import type { IdDomaine } from '../noyau/domaines';

export const DOMAINE_CORPS: IdDomaine = 'corps';

/* ══════════════════════════════════════════════════════════════════════════
   Les pesées et les mesures
   ══════════════════════════════════════════════════════════════════════════ */

export interface Pesee {
  id: string;
  /** Jour logique de la pesée. */
  jour: string;
  /** Instant ISO : deux pesées du même jour se distinguent par l'heure. */
  le: string;
  kg: number;
  note: string;
  majLe: string;
}

/** Ce qu'on mesure au mètre ruban. Fermé, pour que les séries se comparent. */
export type QuoiMesurer =
  | 'taille'
  | 'poitrine'
  | 'bras'
  | 'cuisse'
  | 'mollet'
  | 'hanches'
  | 'cou';

export const MESURES: Record<QuoiMesurer, string> = {
  taille: 'Tour de taille',
  poitrine: 'Tour de poitrine',
  bras: 'Tour de bras',
  cuisse: 'Tour de cuisse',
  mollet: 'Tour de mollet',
  hanches: 'Tour de hanches',
  cou: 'Tour de cou',
};

export interface MesureCorporelle {
  id: string;
  jour: string;
  le: string;
  quoi: QuoiMesurer;
  cm: number;
  note: string;
  majLe: string;
}

/*
   Les bornes du **possible**, reprises du contrat de faits. Au-delà, ce n'est
   plus une mesure : c'est une saisie dans la mauvaise unité ou dans le
   mauvais champ.
*/
export const POIDS_POSSIBLE = { min: 20, max: 400 };
export const MESURE_POSSIBLE = { min: 0, max: 300 };

export function controlerPesee(p: Pesee): string[] {
  const problemes: string[] = [];
  if (!Number.isFinite(p.kg)) problemes.push('Une pesée a besoin d’un nombre.');
  else if (p.kg < POIDS_POSSIBLE.min || p.kg > POIDS_POSSIBLE.max) {
    problemes.push(
      `Un poids de ${p.kg} kg n’est pas possible : attendu entre ${POIDS_POSSIBLE.min} et ${POIDS_POSSIBLE.max}.`,
    );
  }
  if (!p.jour) problemes.push('Une pesée appartient à un jour.');
  return problemes;
}

export function controlerMesure(m: MesureCorporelle): string[] {
  const problemes: string[] = [];
  if (!(m.quoi in MESURES)) problemes.push(`Mesure inconnue : « ${m.quoi} ».`);
  if (!Number.isFinite(m.cm) || m.cm <= MESURE_POSSIBLE.min || m.cm > MESURE_POSSIBLE.max) {
    problemes.push(`Une mesure de ${m.cm} cm n’est pas possible.`);
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le sommeil
   ══════════════════════════════════════════════════════════════════════════ */

export interface Nuit {
  id: string;
  /** Jour logique du **lever**. Voir l'en-tête. */
  jour: string;
  coucher: string;
  lever: string;
  /** Qualité perçue, de 1 à 5, ou `null` si non donnée. */
  qualite: number | null;
  /** Nombre de réveils, ou `null` si on ne sait pas. */
  reveils: number | null;
  note: string;
  majLe: string;
}

/** La durée d'une nuit, en secondes. `null` si les deux instants sont illisibles. */
export function dureeDeLaNuit(nuit: Pick<Nuit, 'coucher' | 'lever'>): number | null {
  const de = Date.parse(nuit.coucher);
  const a = Date.parse(nuit.lever);
  if (!Number.isFinite(de) || !Number.isFinite(a)) return null;
  return Math.round((a - de) / 1000);
}

export function controlerNuit(n: Nuit): string[] {
  const problemes: string[] = [];
  const duree = dureeDeLaNuit(n);
  if (duree === null) problemes.push('Une nuit a besoin d’une heure de coucher et d’une heure de lever.');
  else if (duree <= 0) problemes.push('Le lever est avant le coucher.');
  else if (duree > 24 * 3600) problemes.push('Une nuit ne dépasse pas vingt-quatre heures.');
  if (n.qualite !== null && (n.qualite < 1 || n.qualite > 5)) {
    problemes.push('La qualité perçue va de 1 à 5.');
  }
  if (n.reveils !== null && n.reveils < 0) problemes.push('Un nombre de réveils ne peut être négatif.');
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les repas et les boissons
   ══════════════════════════════════════════════════════════════════════════ */

export type MomentDuRepas = 'matin' | 'midi' | 'soir' | 'collation';

export const MOMENTS: Record<MomentDuRepas, string> = {
  matin: 'Petit-déjeuner',
  midi: 'Déjeuner',
  soir: 'Dîner',
  collation: 'Collation',
};

/**
 * Un repas, saisi à la main.
 *
 * **Aucune base d'aliments, aucun appel réseau** : c'est la décision 4, et le
 * défaut sûr. Les calories et les macros sont donc facultatives — un repas
 * noté sans chiffre reste un repas noté, et c'est déjà la moitié de ce qu'un
 * journal alimentaire sert à voir.
 */
export interface Repas {
  id: string;
  jour: string;
  le: string;
  moment: MomentDuRepas;
  intitule: string;
  kcal: number | null;
  proteines: number | null;
  glucides: number | null;
  lipides: number | null;
  note: string;
  majLe: string;
}

export interface Boisson {
  id: string;
  jour: string;
  le: string;
  mL: number;
  majLe: string;
}

export const KCAL_POSSIBLE = { min: 0, max: 20000 };
export const HYDRATATION_POSSIBLE = { min: 0, max: 15000 };

/** Les calories reconstituées depuis les macros, ou `null` si aucune n'est donnée. */
export function kcalDesMacros(r: Pick<Repas, 'proteines' | 'glucides' | 'lipides'>): number | null {
  if (r.proteines === null && r.glucides === null && r.lipides === null) return null;
  // Atwater : 4 kcal par gramme de protéine et de glucide, 9 par gramme de lipide.
  return Math.round(4 * (r.proteines ?? 0) + 4 * (r.glucides ?? 0) + 9 * (r.lipides ?? 0));
}

/** L'écart, en part, entre les calories saisies et celles que disent les macros. */
export const ECART_MACROS_TOLERE = 0.25;

export function controlerRepas(r: Repas): string[] {
  const problemes: string[] = [];
  if (!(r.moment in MOMENTS)) problemes.push(`Moment inconnu : « ${r.moment} ».`);
  if (!r.intitule.trim()) problemes.push('Un repas a besoin d’un intitulé.');
  if (r.kcal !== null && (r.kcal < KCAL_POSSIBLE.min || r.kcal > KCAL_POSSIBLE.max)) {
    problemes.push(`${r.kcal} kcal n’est pas possible pour un repas.`);
  }
  for (const [nom, valeur] of [
    ['protéines', r.proteines],
    ['glucides', r.glucides],
    ['lipides', r.lipides],
  ] as const) {
    if (valeur !== null && (valeur < 0 || valeur > 2000)) {
      problemes.push(`La quantité de ${nom} n’est pas possible.`);
    }
  }
  return problemes;
}

/**
 * Les calories saisies contredisent-elles les macros ?
 *
 * C'est un **avertissement**, pas un refus : on peut connaître ses macros
 * approximativement et ses calories par ailleurs. Mais un écart d'un quart
 * signale presque toujours une unité confondue — des grammes pris pour des
 * calories, ou l'inverse.
 */
export function macrosIncoherentes(r: Repas): boolean {
  const calcule = kcalDesMacros(r);
  if (calcule === null || r.kcal === null || calcule === 0) return false;
  return Math.abs(r.kcal - calcule) / calcule > ECART_MACROS_TOLERE;
}

export function controlerBoisson(b: Boisson): string[] {
  if (!Number.isFinite(b.mL) || b.mL <= 0 || b.mL > HYDRATATION_POSSIBLE.max) {
    return [`Un volume de ${b.mL} mL n’est pas possible.`];
  }
  return [];
}

/* ══════════════════════════════════════════════════════════════════════════
   La santé générale
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un état de santé déclaré : une maladie, des symptômes, une fatigue.
 *
 * **`empecheEffort` est le seul champ qui agit sur une autre branche.** La
 * règle de désaccord `effort-sous-sante` le lit, et le garde-fou de Sport s'y
 * ajoute. C'est pourquoi il est une case à cocher explicite et non une
 * déduction depuis l'intensité : déduire « cette personne ne devrait pas
 * s'entraîner » d'une note de 7 sur 10 serait un avis médical, et ce n'en est
 * pas un.
 */
export interface EtatDeSante {
  id: string;
  debut: string;
  /** `null` tant que cela dure. */
  fin: string | null;
  intitule: string;
  /** Intensité ressentie, de 1 à 10. */
  intensite: number;
  /** Déclaré par la personne : cela l'empêche-t-il de faire un effort ? */
  empecheEffort: boolean;
  note: string;
  majLe: string;
}

export const santeOuverte = (e: EtatDeSante): boolean => e.fin === null;

export function controlerSante(e: EtatDeSante): string[] {
  const problemes: string[] = [];
  if (!e.intitule.trim()) problemes.push('Un état de santé a besoin d’un intitulé.');
  if (!Number.isFinite(e.intensite) || e.intensite < 1 || e.intensite > 10) {
    problemes.push('L’intensité va de 1 à 10.');
  }
  if (e.fin !== null && e.fin < e.debut) problemes.push('La fin est avant le début.');
  return problemes;
}

/** Les états de santé ouverts à un instant donné. */
export function santeEnCours(
  etats: readonly EtatDeSante[],
  maintenant = new Date(),
): EtatDeSante[] {
  const instant = maintenant.toISOString();
  return etats.filter((e) => e.debut <= instant && (e.fin === null || e.fin >= instant));
}

/**
 * L'effort est-il déclaré empêché à cet instant ?
 *
 * C'est la question que Sport pose à Odyssée. Elle a sa fonction propre pour
 * que la réponse ait **un seul** chemin : un écran qui la recalculerait à sa
 * façon finirait par répondre autrement que la règle de désaccord.
 */
export function effortEmpeche(
  etats: readonly EtatDeSante[],
  maintenant = new Date(),
): { empeche: boolean; causes: EtatDeSante[] } {
  const causes = santeEnCours(etats, maintenant).filter((e) => e.empecheEffort);
  return { empeche: causes.length > 0, causes };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les totaux du jour
   ══════════════════════════════════════════════════════════════════════════ */

export interface JourneeCorps {
  jour: string;
  /** La dernière pesée du jour, ou `null`. */
  poids: number | null;
  /** Le sommeil du jour, en secondes, ou `null` si aucune nuit n'est saisie. */
  sommeil: number | null;
  /** `null` si aucun repas n'est chiffré : zéro calorie n'est pas « rien noté ». */
  kcal: number | null;
  /** Nombre de repas notés, chiffrés ou non. */
  repas: number;
  /** Millilitres bus, ou `null` si rien n'est noté. */
  hydratation: number | null;
}

/**
 * Le résumé d'un jour.
 *
 * Chaque total vaut `null` quand rien n'a été saisi, et jamais zéro. C'est la
 * même distinction que partout ailleurs dans Cyclades : « je n'ai rien bu »
 * et « je n'ai rien noté » ne sont pas la même journée, et les confondre
 * ferait mentir toute moyenne calculée dessus.
 */
export function journee(
  jour: string,
  contenu: {
    pesees: readonly Pesee[];
    nuits: readonly Nuit[];
    repas: readonly Repas[];
    boissons: readonly Boisson[];
  },
): JourneeCorps {
  const pesees = contenu.pesees.filter((p) => p.jour === jour).sort((a, b) => a.le.localeCompare(b.le));
  const nuits = contenu.nuits.filter((n) => n.jour === jour);
  const repas = contenu.repas.filter((r) => r.jour === jour);
  const boissons = contenu.boissons.filter((b) => b.jour === jour);

  const chiffres = repas.filter((r) => r.kcal !== null);
  const sommeil = nuits.reduce<number | null>((total, n) => {
    const duree = dureeDeLaNuit(n);
    if (duree === null) return total;
    return (total ?? 0) + duree;
  }, null);

  return {
    jour,
    poids: pesees.length ? pesees[pesees.length - 1].kg : null,
    sommeil,
    kcal: chiffres.length ? chiffres.reduce((s, r) => s + (r.kcal ?? 0), 0) : null,
    repas: repas.length,
    hydratation: boissons.length ? boissons.reduce((s, b) => s + b.mL, 0) : null,
  };
}

/**
 * La moyenne mobile d'une série de pesées.
 *
 * Le poids du jour ne veut rien dire : il bouge d'un kilo avec un repas salé.
 * La moyenne sur sept jours est ce qu'on regarde pour savoir où l'on va, et
 * l'afficher à la place du poids brut évite la lecture nerveuse d'une courbe
 * en dents de scie.
 *
 * Les jours **sans pesée** sont sautés, non interpolés : inventer un point
 * ferait une courbe plus lisse et moins vraie.
 */
export function moyenneMobile(
  pesees: readonly Pesee[],
  fenetre = 7,
): { jour: string; kg: number; moyenne: number; points: number }[] {
  const parJour = new Map<string, number>();
  for (const p of [...pesees].sort((a, b) => a.le.localeCompare(b.le))) parJour.set(p.jour, p.kg);
  const jours = [...parJour.keys()].sort();

  return jours.map((jour) => {
    const limite = new Date(Date.parse(`${jour}T12:00:00.000Z`) - (fenetre - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    const dans = jours.filter((j) => j >= limite && j <= jour).map((j) => parJour.get(j)!);
    return {
      jour,
      kg: parJour.get(jour)!,
      moyenne: Math.round((dans.reduce((s, k) => s + k, 0) / dans.length) * 100) / 100,
      points: dans.length,
    };
  });
}
