/**
 * Rassembler la fenêtre que les indicateurs lisent.
 *
 * `odyssee/indicateurs.ts` tient les formules et ne touche à rien ;
 * `odyssee/syntheses.ts` tient les périodes et les comparaisons. Ce module va
 * chercher les données : les faits publiés par la branche, les cartes FSRS, les
 * niveaux estimés, le journal d'erreurs, l'état d'activité et les désaccords
 * ouverts.
 *
 * ## Une seule lecture par synthèse
 *
 * Huit sources, et la tentation serait de les lire indicateur par indicateur.
 * Quinze indicateurs feraient alors jusqu'à quinze lectures du même magasin,
 * sur une base qui porte cinq ans d'historique. La fenêtre est donc rassemblée
 * **une fois**, et les formules la relisent en mémoire — c'est tout l'intérêt
 * de les avoir rendues pures.
 *
 * ## Ce qui manque est absent, et non nul
 *
 * Un bloc de la fenêtre qu'on ne sait pas remplir n'est **pas** rempli avec une
 * valeur neutre : il reste absent, et l'indicateur qui en dépend rend `null`.
 * C'est la règle du catalogue, et elle ne tient que si l'assembleur la respecte
 * — un `cartes: []` à la place d'un `cartes` absent transformerait « on ne sait
 * pas » en « aucune carte n'atteint 0,9 », qui est une mesure, et fausse.
 */
import {
  toutesLesCartes,
  toutesLesRevisions,
  toutesLesSessionsNBack,
  toutesLesSessionsRelationnelles,
  toutesLesSessionsVeridical,
} from './db';
import { estSocle, type EntreeRevision } from './noyau/revisions';
import { jourLogique } from './noyau/jour-logique';
import type { Fenetre, Mesure } from './odyssee/indicateurs';
import {
  INDICATEURS,
  evaluer,
  evaluerTout,
  indicateur,
  joursDeLaFenetre,
  type Evaluation,
} from './odyssee/indicateurs';
import {
  comparer,
  periode,
  periodeLibre,
  precedente,
  serieDegradee,
  synthese,
  type Comparaison,
  type Periode,
  type Portee,
  type Synthese,
  type TypePeriode,
} from './odyssee/syntheses';

/* ══════════════════════════════════════════════════════════════════════════
   Les sources, une par une
   ══════════════════════════════════════════════════════════════════════════ */

/** Les cartes, avec leur rétention prédite au jour de la mesure. */
async function lireCartes(maintenant: Date) {
  const [cartes, { retentionPredite }] = await Promise.all([
    toutesLesCartes(),
    import('./srs'),
  ]);
  if (!cartes.length) return undefined;
  return cartes.map((c) => ({ retention: retentionPredite(c, maintenant), echeance: c.du }));
}

/**
 * Les intervalles de révision et leur réussite, pour la courbe d'oubli.
 *
 * L'intervalle est l'écart entre une notation et la **précédente notation de la
 * même carte**, et non l'intervalle que FSRS avait programmé : c'est le temps
 * réellement écoulé qui fait oublier, pas celui qui était prévu. Les entrées de
 * socle sont écartées — elles reprennent un état sans porter de notation, donc
 * sans réussite à mesurer.
 */
async function lireRevisions() {
  const entrees = await toutesLesRevisions();
  if (!entrees.length) return undefined;
  const parCarte = new Map<string, EntreeRevision[]>();
  for (const entree of entrees) {
    const groupe = parCarte.get(entree.carteId);
    if (groupe) groupe.push(entree);
    else parCarte.set(entree.carteId, [entree]);
  }
  const points: { intervalleJours: number; reussie: boolean }[] = [];
  for (const groupe of parCarte.values()) {
    const ordonnees = [...groupe].sort((a, b) => (a.id < b.id ? -1 : 1));
    let precedent: number | null = null;
    for (const entree of ordonnees) {
      const instant = Date.parse(entree.le);
      if (!Number.isFinite(instant)) continue;
      if (!estSocle(entree) && precedent !== null) {
        points.push({
          intervalleJours: Math.max(0, (instant - precedent) / 86_400_000),
          reussie: entree.note !== 'oublie',
        });
      }
      precedent = instant;
    }
  }
  return points.length ? points : undefined;
}

/**
 * Les échelons de Cog-Training, une famille par moteur du site.
 *
 * Trois familles, trois définitions, et chacune est celle que son écran affiche
 * déjà : la profondeur n pour le Quad N-Back, la part d'items entièrement
 * réussis pour Relational Reasoning, la charge tenue pour Veridical Mapping.
 * Inventer une échelle commune aurait produit un nombre que personne ne
 * reconnaîtrait.
 */
async function lireEchelons() {
  const [nback, relationnel, veridical] = await Promise.all([
    toutesLesSessionsNBack(),
    toutesLesSessionsRelationnelles(),
    toutesLesSessionsVeridical(),
  ]);
  const parFamille: Record<string, number> = {};
  const jouees = nback.filter((s) => s.statut !== 'jalon');
  if (jouees.length) {
    parFamille['Quad N-Back'] = Math.max(...jouees.map((s) => s.n));
  }
  if (relationnel.length) {
    const tentes = relationnel.reduce((s, x) => s + x.tentes, 0);
    const reussis = relationnel.reduce((s, x) => s + x.reussis, 0);
    // Une part sur dix, pour que l'échelle soit du même ordre que les deux
    // autres : une moyenne entre 0,8 et 4 serait dominée par la profondeur n.
    if (tentes > 0) parFamille['Relational Reasoning'] = (reussis / tentes) * 10;
  }
  if (veridical.length) {
    parFamille['Veridical Mapping'] = Math.max(...veridical.map((s) => s.charge));
  }
  const sessions = jouees.length + relationnel.length + veridical.length;
  return Object.keys(parFamille).length ? { parFamille, sessions } : undefined;
}

/** Le programme : fiches du parcours, fiches vues, fiches planifiées à date. */
async function lireProgramme(jour: string) {
  try {
    const [{ aplatirFiches, chargerManifeste }, { planning }, cartes] = await Promise.all([
      import('./contenu'),
      import('./planification'),
      toutesLesCartes(),
    ]);
    const fiches = aplatirFiches(await chargerManifeste());
    if (!fiches.length) return undefined;
    const vues = new Set(cartes.filter((c) => c.revisions > 0).map((c) => c.ficheId)).size;
    /*
     * Les fiches planifiées à date : celles des séances terminées du début de
     * l'année civile jusqu'à aujourd'hui. Le planning est la seule source qui
     * sache ce qui *devait* être vu ; sans lui, l'indicateur de retard n'a pas
     * de dénominateur et rend `null`.
     */
    const jours = await planning(`${jour.slice(0, 4)}-01-01`, jour);
    const planifieesADate = jours.reduce((s, j) => s + (j.seance?.fiches?.length ?? 0), 0);
    return { fiches: fiches.length, vues, planifieesADate };
  } catch (erreur) {
    // Le manifeste vit dans la couche chiffrée : sans session ouverte, il n'y a
    // pas de programme, et c'est une absence et non un zéro.
    console.warn('Programme indisponible pour les indicateurs :', erreur);
    return undefined;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   La fenêtre
   ══════════════════════════════════════════════════════════════════════════ */

export interface OptionsFenetre {
  maintenant?: Date;
  /** Les réglages du jour logique, s'ils sont déjà connus de l'appelant. */
  reglages?: { heureBascule: number; fuseau: string };
}

/** Rassemble tout ce que les indicateurs lisent, pour une période donnée. */
export async function rassembler(p: Periode, options: OptionsFenetre = {}): Promise<Fenetre> {
  const maintenant = options.maintenant ?? new Date();
  const reglages =
    options.reglages ??
    (await (async () => {
      const { reglagesJourLogiqueLocaux } = await import('./adaptation');
      return reglagesJourLogiqueLocaux();
    })());

  const [{ publierFaitsRevisions }, { etatActivite }, { tableauDeNiveaux }, { comptesParMatiere }] =
    await Promise.all([
      import('./odyssee/faits-revisions'),
      import('./odyssee/service'),
      import('./niveau'),
      import('./journal'),
    ]);

  const aujourdhui = jourLogique(maintenant, reglages);
  const [publication, activite, niveaux, erreurs, cartes, revisions, echelons, programme] =
    await Promise.all([
      publierFaitsRevisions({ de: p.de, a: p.a, reglages }),
      etatActivite({ reglages, maintenant }),
      tableauDeNiveaux(),
      comptesParMatiere(),
      lireCartes(maintenant),
      lireRevisions(),
      lireEchelons(),
      lireProgramme(aujourdhui),
    ]);

  const desaccordsOuverts = await (async () => {
    const { detecter } = await import('./odyssee/desaccords');
    return detecter(activite.faits);
  })();

  return {
    de: p.de,
    a: p.a,
    aujourdhui,
    faits: publication.faits,
    ...(cartes ? { cartes } : {}),
    ...(revisions ? { revisions } : {}),
    ...(echelons ? { echelons } : {}),
    ...(programme ? { programme } : {}),
    ...(niveaux.length
      ? {
          niveaux: niveaux.map(({ matiere }) => ({
            matiere: matiere.matiere,
            note: matiere.note,
            fiable: matiere.fiable,
            observations: matiere.observations,
          })),
        }
      : {}),
    ...(erreurs.length
      ? { erreurs: Object.fromEntries(erreurs.map((e) => [e.matiere, e.total])) }
      : {}),
    activite: {
      parJour: activite.journal.parJour,
      serieCourante: activite.serie.courante,
      serieRecord: activite.serie.record,
      niveau: activite.niveau.niveau,
      xp: activite.xp,
    },
    ...(desaccordsOuverts.length ? { desaccordsOuverts } : {}),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les synthèses, prêtes pour un écran
   ══════════════════════════════════════════════════════════════════════════ */

export interface SyntheseComplete {
  synthese: Synthese;
  /** La période précédente, pour la comparaison. */
  avant: Synthese | null;
  comparaisons: Comparaison[];
}

/**
 * La synthèse d'une période, avec la précédente pour comparer.
 *
 * La précédente est rassemblée **séparément** et non déduite de la courante :
 * les faits d'une période ne contiennent pas ceux de la précédente, et
 * approximer la comparaison à partir de ce qu'on a sous la main est exactement
 * la manière dont un tableau de bord finit par mentir.
 */
export async function syntheseDe(
  type: TypePeriode,
  options: OptionsFenetre & { ancre?: string; portee?: Portee; avec?: boolean } = {},
): Promise<SyntheseComplete> {
  const maintenant = options.maintenant ?? new Date();
  const reglages =
    options.reglages ??
    (await (async () => {
      const { reglagesJourLogiqueLocaux } = await import('./adaptation');
      return reglagesJourLogiqueLocaux();
    })());
  const ancre = options.ancre ?? jourLogique(maintenant, reglages);
  const courante = periode(type, ancre);
  const portee = options.portee ?? { quoi: 'globale' as const };

  const fenetre = await rassembler(courante, { maintenant, reglages });
  const vue = synthese(courante, fenetre, portee);
  if (options.avec === false) return { synthese: vue, avant: null, comparaisons: [] };

  const precedent = precedente(courante);
  const avantFenetre = await rassembler(precedent, { maintenant, reglages });
  const avant = synthese(precedent, avantFenetre, portee);
  return { synthese: vue, avant, comparaisons: comparer(vue, avant) };
}

/** La synthèse d'une période libre, bornée à la main. */
export async function syntheseLibre(
  de: string,
  a: string,
  options: OptionsFenetre & { portee?: Portee } = {},
): Promise<Synthese> {
  const p = periodeLibre(de, a);
  return synthese(p, await rassembler(p, options), options.portee ?? { quoi: 'globale' });
}

/**
 * La série d'un indicateur sur une plage, à résolution dégradée.
 *
 * Une fenêtre par jour serait juste et inutilisable : cinq ans font mille huit
 * cents rassemblements. La série est donc calculée sur **une** fenêtre couvrant
 * toute la plage, puis l'indicateur est évalué jour par jour sur les faits déjà
 * en mémoire — ce qui ne marche que pour les indicateurs dont la mesure se
 * recalcule sur une sous-fenêtre, et c'est pourquoi la fonction les nomme.
 */
export async function serieDe(
  id: string,
  de: string,
  a: string,
  options: OptionsFenetre = {},
) {
  const indic = indicateur(id);
  if (!indic) throw new Error(`Indicateur inconnu : « ${id} ».`);
  const p = periodeLibre(de, a);
  const fenetre = await rassembler(p, options);
  const points: { jour: string; valeur: number }[] = [];
  for (const jour of joursDeLaFenetre(de, a)) {
    const mesure: Mesure | null = indic.calcul({ ...fenetre, de: jour, a: jour });
    if (mesure) points.push({ jour, valeur: mesure.valeur });
  }
  return serieDegradee(points, fenetre.aujourdhui);
}

/** Toutes les évaluations sur une période, sans comparaison. */
export async function evaluationsDe(p: Periode, options: OptionsFenetre = {}): Promise<Evaluation[]> {
  return evaluerTout(await rassembler(p, options));
}

export { INDICATEURS, evaluer, indicateur };
