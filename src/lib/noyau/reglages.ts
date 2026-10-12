/**
 * Les réglages déduits du profil : chacun avec la réponse dont il découle.
 *
 * ## Pourquoi ils ne sont pas des champs de profil
 *
 * Le §3 de `questions.md` le pose : « aucune de ces déductions ne modifie une
 * donnée. Elles changent des **réglages**. » L'heure de bascule du jour logique
 * découle de l'heure de lever ; ce n'est pas une seconde vérité sur l'heure de
 * lever, c'est une conséquence. En faire un champ aurait créé deux valeurs à
 * tenir d'accord, et le jour où elles divergent, la personne ne saurait plus
 * laquelle elle a dite.
 *
 * ## Pourquoi chacun porte sa cause en français
 *
 * « Votre bascule de journée est à 6 h parce que vous vous levez à 7 h ; la
 * changer ici ne changera pas votre lever. » Un réglage dont on ne voit pas la
 * cause se change au hasard, et le réglage suivant le rechangera.
 *
 * Ce module est **pur** : il prend une lecture de profil et rend des réglages.
 * Ce qui les applique vit ailleurs, et c'est voulu — un réglage déduit doit
 * pouvoir être affiché sans rien changer.
 */
import { HEURE_BASCULE_PAR_DEFAUT, FUSEAU_PAR_DEFAUT } from './jour-logique';
import { DOMAINES_ACTIFS_PAR_DEFAUT } from './domaines';
import type { Profil } from './profil';

/** Une lecture de profil : le champ, et sa valeur ou rien. */
export type Lecture = (champ: string) => unknown;

export const lectureDe =
  (profil: Profil): Lecture =>
  (champ) =>
    profil.get(champ)?.valeur;

export interface Reglage {
  id: string;
  libelle: string;
  /** Les champs dont il découle. Vide : c'est un défaut, pas une déduction. */
  depuis: readonly string[];
  /** La valeur du réglage, telle que l'application l'emploie. */
  valeur: unknown;
  /** Ce qui l'explique, en français. Toujours rempli. */
  cause: string;
  /** Faux quand aucune réponse ne le nourrit : c'est alors le réglage d'usine. */
  deduit: boolean;
}

/** Les bornes de l'heure de bascule : voir l'en-tête de `jour-logique.ts`. */
export const BASCULE_MINIMALE = 2;
export const BASCULE_MAXIMALE = 6;

const heureDe = (valeur: unknown): number | null => {
  if (typeof valeur !== 'string') return null;
  const m = /^([01]\d|2[0-3]):[0-5]\d$/.exec(valeur);
  return m ? Number(m[1]) : null;
};

/**
 * L'heure à laquelle la journée change de date, déduite de l'heure de lever.
 *
 * Une heure avant le lever, bornée entre 2 h et 6 h. La borne haute n'est pas
 * un caprice : au-delà, une séance de 7 h du matin compterait pour la veille.
 * La borne basse évite la fenêtre pathologique du changement d'heure, que
 * `jour-logique.ts` sait traiter mais qu'il vaut mieux ne pas viser.
 */
export function basculeDuJour(lever: unknown): number {
  const heure = heureDe(lever);
  if (heure === null) return HEURE_BASCULE_PAR_DEFAUT;
  return Math.min(BASCULE_MAXIMALE, Math.max(BASCULE_MINIMALE, heure - 1));
}

const listeDe = (valeur: unknown): string[] =>
  Array.isArray(valeur) ? valeur.filter((x): x is string => typeof x === 'string') : [];

const nombreDe = (valeur: unknown): number | null =>
  typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null;

/** Les sept jours, dans l'ordre où `Date.getDay()` les rend. */
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** La fréquence des avis locaux, selon le style demandé. */
const AVIS: Record<string, { parJour: number; phrase: string }> = {
  discret: { parJour: 0, phrase: 'aucun avis spontané' },
  normal: { parJour: 1, phrase: 'un avis par jour au plus' },
  soutenu: { parJour: 3, phrase: 'jusqu’à trois avis par jour' },
};

/**
 * Tous les réglages déduits, dans l'ordre d'affichage de « Mon profil ».
 *
 * Chacun existe **toujours** : sans réponse, il porte sa valeur d'usine et le
 * dit (`deduit: false`). Une liste qui se vide quand le profil est vide
 * laisserait croire qu'il n'y a pas de réglage, alors qu'il y en a un et qu'il
 * est simplement par défaut.
 */
export function reglagesDeduits(lire: Lecture): Reglage[] {
  const sorties: Reglage[] = [];

  /* --- Le jour logique ----------------------------------------------------- */
  const lever = lire('lever');
  const bascule = basculeDuJour(lever);
  sorties.push({
    id: 'bascule-du-jour',
    libelle: 'Heure à laquelle votre journée change de date',
    depuis: ['lever'],
    valeur: bascule,
    deduit: heureDe(lever) !== null,
    cause:
      heureDe(lever) !== null
        ? `${bascule} h, parce que vous vous levez à ${lever}. La changer ne changerait pas votre heure de lever.`
        : `${bascule} h par défaut : vous n’avez pas dit à quelle heure vous vous levez.`,
  });

  const fuseau = typeof lire('fuseau') === 'string' ? (lire('fuseau') as string) : FUSEAU_PAR_DEFAUT;
  sorties.push({
    id: 'fuseau',
    libelle: 'Fuseau dans lequel les jours sont comptés',
    depuis: ['fuseau'],
    valeur: fuseau,
    deduit: typeof lire('fuseau') === 'string',
    cause:
      typeof lire('fuseau') === 'string'
        ? `${fuseau}, tel que vous l’avez confirmé.`
        : `${fuseau} par défaut.`,
  });

  /* --- Les créneaux et les jours de repos ---------------------------------- */
  const joursTravail = listeDe(lire('joursTravail'));
  const plages = listeDe(lire('plagesTravail'));
  const repos = JOURS.filter((j) => !joursTravail.includes(j));
  sorties.push({
    id: 'jours-de-repos',
    libelle: 'Jours proposés comme repos dans la rotation',
    depuis: ['joursTravail'],
    valeur: joursTravail.length ? repos : [],
    deduit: joursTravail.length > 0,
    cause: joursTravail.length
      ? `${repos.length ? repos.join(', ') : 'aucun'} — ce sont les jours où vous ne travaillez pas. Un jour de repos ne casse pas votre série.`
      : 'Aucun, faute d’avoir dit quels jours vous travaillez.',
  });
  sorties.push({
    id: 'creneaux',
    libelle: 'Plages proposées pour vos séances',
    depuis: ['plagesTravail', 'momentRevision'],
    valeur: plages.length ? plages : [],
    deduit: plages.length > 0,
    cause: plages.length
      ? `${plages.join(', ')} — les plages que vous avez données.`
      : 'Aucune plage privilégiée : les séances sont proposées à toute heure.',
  });

  /* --- Les domaines --------------------------------------------------------- */
  const domaines = listeDe(lire('domainesActifs'));
  sorties.push({
    id: 'domaines-affiches',
    libelle: 'Domaines affichés dans la roue et au menu',
    depuis: ['domainesActifs'],
    valeur: domaines.length ? domaines : [...DOMAINES_ACTIFS_PAR_DEFAUT],
    deduit: domaines.length > 0,
    cause: domaines.length
      ? `${domaines.length} domaines, ceux que vous suivez.`
      : `Les ${DOMAINES_ACTIFS_PAR_DEFAUT.length} domaines allumés au départ.`,
  });

  /* --- Les parcours --------------------------------------------------------- */
  const concours = listeDe(lire('concours'));
  sorties.push({
    id: 'parcours-ouverts',
    libelle: 'Parcours ouverts dans le registre',
    depuis: ['concours'],
    valeur: concours,
    deduit: concours.length > 0,
    cause: concours.length
      ? `${concours.join(', ')} — les concours que vous préparez.`
      : 'Aucun : le parcours courant reste celui que vous avez choisi dans Révisions.',
  });

  /* --- Les avis ------------------------------------------------------------- */
  const style = typeof lire('styleAccompagnement') === 'string' ? (lire('styleAccompagnement') as string) : '';
  const avis = AVIS[style] ?? AVIS.normal;
  const rappel = lire('heureRappel');
  sorties.push({
    id: 'avis-locaux',
    libelle: 'Fréquence et heure des avis',
    depuis: ['styleAccompagnement', 'heureRappel'],
    valeur: { parJour: avis.parJour, heure: heureDe(rappel) !== null ? rappel : null },
    deduit: Boolean(AVIS[style]) || heureDe(rappel) !== null,
    cause:
      `${avis.phrase}${AVIS[style] ? '' : ' (défaut)'}` +
      (heureDe(rappel) !== null ? `, à ${rappel}.` : ', sans heure fixe.'),
  });

  /* --- Les plafonds --------------------------------------------------------- */
  const heuresRevision = nombreDe(lire('heuresRevision'));
  const tempsParSemaine = nombreDe(lire('tempsParSemaine'));
  const objectif = heuresRevision ?? tempsParSemaine;
  sorties.push({
    id: 'objectif-hebdomadaire',
    libelle: 'Objectif indicatif de l’histogramme, et plafond d’une séance',
    depuis: ['heuresRevision', 'tempsParSemaine'],
    valeur:
      objectif === null
        ? { heuresParSemaine: null, plafondSeanceMinutes: 120 }
        : {
            heuresParSemaine: objectif,
            // Un quart de l'objectif hebdomadaire, borné à deux heures : au-delà,
            // une séance cesse d'être une séance.
            plafondSeanceMinutes: Math.min(120, Math.max(20, Math.round((objectif * 60) / 4))),
          },
    deduit: objectif !== null,
    cause:
      objectif === null
        ? 'Aucun objectif : l’histogramme n’affiche pas de ligne de cible, et une séance est plafonnée à deux heures.'
        : `${objectif} h par semaine, d’après ${heuresRevision !== null ? 'vos heures de révision' : 'le temps que vous pouvez y consacrer'}.`,
  });

  return sorties;
}

/** Les réglages du jour logique, tels que les moteurs les attendent. */
export function reglagesJourLogique(lire: Lecture): { heureBascule: number; fuseau: string } {
  return {
    heureBascule: basculeDuJour(lire('lever')),
    fuseau: typeof lire('fuseau') === 'string' ? (lire('fuseau') as string) : FUSEAU_PAR_DEFAUT,
  };
}

/** Vérifie que chaque réglage nomme des champs et porte une cause lisible. */
export function controlerReglages(champsConnus: readonly string[]): string[] {
  const problemes: string[] = [];
  const vides = reglagesDeduits(() => undefined);
  const vus = new Set<string>();
  for (const reglage of vides) {
    if (vus.has(reglage.id)) problemes.push(`Le réglage « ${reglage.id} » est déclaré deux fois.`);
    vus.add(reglage.id);
    if (reglage.cause.trim().length < 15) {
      problemes.push(`Le réglage « ${reglage.id} » n’explique pas d’où il vient.`);
    }
    if (reglage.deduit) {
      problemes.push(`Le réglage « ${reglage.id} » se dit déduit alors que rien n’est renseigné.`);
    }
    for (const champ of reglage.depuis) {
      if (!champsConnus.includes(champ)) {
        problemes.push(`Le réglage « ${reglage.id} » découle de « ${champ} », qui n’est pas un champ.`);
      }
    }
  }
  return problemes;
}
