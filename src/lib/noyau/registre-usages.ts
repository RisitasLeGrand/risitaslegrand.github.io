/**
 * Le registre des usages, et la porte unique par laquelle l'âge et le sexe
 * sortent du profil.
 *
 * ## Une porte, parce qu'une promesse tenue à la main ne tient pas
 *
 * Tant qu'un module peut lire `sexe` directement, chaque usage ajouté est une
 * promesse qu'il faut se souvenir de tenir. Avec `contextePersonne()` et le
 * test sur le graphe d'imports, **un usage non déclaré ne compile pas** — ou
 * plutôt : il compile, et l'essai le refuse, ce qui revient au même à
 * l'intégration. C'est le geste de `ValeurSourcee`, qui rend impossible une
 * valeur sans source, appliqué à la lecture au lieu de l'écriture.
 *
 * ## Le registre n'est pas une documentation
 *
 * C'est la **source** de trois choses à la fois : ce que chaque module reçoit,
 * ce que l'écran « Qui utilise mon âge et mon sexe » affiche, et ce que la
 * question de profil répond quand la personne demande « qui utilisera cette
 * réponse ? ». Écrire la même promesse à trois endroits, c'est garantir qu'un
 * jour ils divergeront et que personne ne saura lequel engage. Le patron vient
 * de `consommateurs.ts`, où la phrase « voit » est déjà reprise au mot près.
 *
 * ## `majeur` n'est pas un booléen, et c'est délibéré
 *
 * Le prompt écrit qu'un consommateur qui n'a besoin que de « majeur ou non »
 * « reçoit **un booléen**, pas l'âge ». La granularité est juste ; le type ne
 * l'est pas. Un booléen n'a que deux valeurs, donc une absence de donnée
 * devient `false` — soit exactement « cette personne est mineure », soit
 * exactement la valeur par défaut que 2.2 interdit (« jamais une valeur par
 * défaut qui ressemblerait à une donnée »). La clé porte donc trois états.
 * L'intention du prompt est respectée — le consommateur ne reçoit pas l'âge —,
 * sa lettre ne l'est pas, et c'est le seul choix qui ne ment pas.
 *
 * ## Ce module ne lit aucun stockage
 *
 * `contextePersonne()` reçoit l'état en paramètre. Il ne va chercher ni le
 * profil, ni le coffre : qui ouvre le coffre et quand est une décision des
 * écrans, et une fonction pure se teste sans base de données. C'est aussi ce
 * qui rend vraie la promesse « pas de lecture silencieuse » (1 n° 15) : il n'y
 * a pas de lecture du tout à l'intérieur.
 */
import { franchit, trancheDAge, type DeclarationDAge } from './age';

/* ══════════════════════════════════════════════════════════════════════════
   Les clés, et l'état d'où elles sortent
   ══════════════════════════════════════════════════════════════════════════ */

export type CleDeContexte =
  | 'tranche_age'
  | 'majeur'
  | 'sexe_physio'
  | 'suivi_cycle'
  | 'statut_hormonal';

export type SexePhysio = 'femme' | 'homme' | 'intersexe_ou_autre';

/**
 * Ce que les écrans rassemblent avant d'appeler.
 *
 * Les deux parties ne viennent pas du même endroit et ne sont pas de la même
 * sensibilité : l'âge est dans le profil commun, le reste est dans
 * Odyssée > Corps, sous coffre, derrière la matrice de permissions (A.3, B.2).
 * Les réunir **ici**, en paramètre, rend la frontière visible au lieu de la
 * dissoudre dans un module qui lirait les deux.
 */
export interface EtatDeLaPersonne {
  age: DeclarationDAge;
  /** `null` : non répondu, inconnu ou refusé — les trois se lisent « inconnu ». */
  sexe: SexePhysio | null;
  suiviCycleActif: boolean;
  /** L'intitulé du statut en cours, ou `null`. Jamais déduit (1 n° 5). */
  statutHormonal: string | null;
}

export const ETAT_VIERGE: EtatDeLaPersonne = {
  age: { naissanceAnnee: null, naissanceMois: null, majeurDeclare: null },
  sexe: null,
  suiviCycleActif: false,
  statutHormonal: null,
};

/* ══════════════════════════════════════════════════════════════════════════
   Le registre
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * D'où l'usage tire sa légitimité.
 *
 * `source-a-obtenir` est le troisième cas, et il porte le poids de cette phase :
 * les sources de l'annexe du prompt sont hors de portée de cet environnement
 * (`docs/cyclades/acces-sources.md`). Un usage dans cet état est **déclaré,
 * visible à l'écran, et inactif** : il dit ce qu'il ferait et pourquoi il ne le
 * fait pas. L'alternative — l'omettre du registre — le rendrait invisible, et
 * l'écran « Qui utilise mon âge » mentirait par omission.
 */
export type FondementDUsage =
  | { readonly type: 'regle-de-produit' }
  | { readonly type: 'source'; nom: string; ou: string; le: string }
  | { readonly type: 'source-a-obtenir'; laquelle: string };

export interface UsageDeclare {
  id: string;
  rubrique: string;
  clesLues: readonly CleDeContexte[];
  /** Une phrase. L'écran la cite telle quelle. */
  but: string;
  /** Ce que la personne voit changer. Pas « améliore l'expérience ». */
  effetVisible: string;
  fondement: FondementDUsage;
  /** La population que le repère vise, ou « sans objet » pour une règle de produit. */
  population: string;
  defaut: 'actif' | 'inactif';
  /** Le comportement quand la donnée manque, en français, affichable. */
  siInconnu: string;
  /**
   * Les bornes de tranche que **ce** consommateur déclare, ascendantes.
   *
   * Obligatoire s'il lit `tranche_age`, interdit sinon : c'est ce qui rend la
   * granularité minimale vérifiable plutôt que promise.
   */
  bornes?: readonly number[];
  /** Croise plusieurs domaines : désactivé par défaut, autorisé domaine par domaine. */
  deriveS2: boolean;
  revuLe: string;
}

/**
 * Les usages déclarés.
 *
 * Sept sont livrables ici, six attendent une source. Et parmi les sept, cinq
 * sont des **restrictions** — ne pas proposer, ne pas cocher — plutôt que des
 * enrichissements. Ce n'est pas une déception : 3.0 demande qu'un usage change
 * « quelque chose de concret », et fermer une fonction à un mineur en est un.
 */
export const USAGES: readonly UsageDeclare[] = [
  {
    id: 'profil.modules-a-seuil',
    rubrique: 'Profil',
    clesLues: ['majeur'],
    but: 'Ne pas proposer les modules que Cyclades réserve aux majeurs.',
    /*
       « Modules disponibles » est une SURFACE À CONSTRUIRE (phase 1), et la
       formulation reste telle quelle plutôt que d'être adoucie : elle dit ce
       que l'usage fera, et c'est à l'écran de venir, non à la déclaration de
       reculer. Relevé le 19 octobre, inscrit aux décisions en attente du
       cycle. En attendant, le suivi personnel s'atteint par une ligne neutre
       depuis l'écran Corps.
    */
    effetVisible: 'Le module n’apparaît pas dans « Modules disponibles ».',
    fondement: { type: 'regle-de-produit' },
    population: 'sans objet',
    defaut: 'actif',
    siInconnu: 'Le module n’est pas proposé. Déclarer « je suis majeur(e) » suffit à l’ouvrir.',
    deriveS2: false,
    revuLe: '2026-10-14',
  },
  {
    id: 'profil.question-cycle',
    rubrique: 'Profil',
    clesLues: ['sexe_physio'],
    but: 'Décider si la question du suivi du cycle est posée d’office.',
    effetVisible: 'La question apparaît au chapitre « Mon corps ».',
    fondement: { type: 'regle-de-produit' },
    population: 'sans objet',
    defaut: 'actif',
    siInconnu:
      'La question n’est pas posée d’office. Le module reste accessible depuis ' +
      '« Modules disponibles », sous un libellé neutre.',
    deriveS2: false,
    revuLe: '2026-10-14',
  },
  {
    id: 'sante.substances-majeur',
    rubrique: 'Santé',
    clesLues: ['majeur'],
    but: 'Fermer le module des substances et le menu des molécules sous 18 ans.',
    effetVisible: 'Le module n’est pas proposé, et l’écran dit pourquoi.',
    fondement: { type: 'regle-de-produit' },
    population: 'sans objet',
    defaut: 'actif',
    siInconnu: 'Le module n’est pas proposé.',
    deriveS2: false,
    revuLe: '2026-10-14',
  },
  {
    id: 'psyche.echelles-majeur',
    rubrique: 'Psyché',
    clesLues: ['majeur'],
    but: 'Ne pas proposer les échelles de psyché à un mineur.',
    effetVisible: 'Les échelles n’apparaissent pas ; les ressources de détresse restent affichées.',
    fondement: { type: 'regle-de-produit' },
    population: 'sans objet',
    defaut: 'actif',
    siInconnu: 'Les échelles ne sont pas proposées.',
    deriveS2: false,
    revuLe: '2026-10-14',
  },
  {
    id: 'revisions.condition-age-concours',
    rubrique: 'Révisions',
    clesLues: ['tranche_age'],
    but: 'Rappeler une condition d’âge figurant à l’avis du concours que je suis.',
    effetVisible:
      '« Âge à la date du … », sans conclure à l’éligibilité : l’avis fait foi.',
    fondement: { type: 'regle-de-produit' },
    population: 'sans objet — la condition vient de l’avis, que je saisis moi-même',
    defaut: 'inactif',
    siInconnu: 'Rien n’est affiché.',
    bornes: [18, 30, 45],
    deriveS2: false,
    revuLe: '2026-10-14',
  },
  {
    id: 'export.tranche-age',
    rubrique: 'Exports',
    clesLues: ['tranche_age'],
    but: 'Permettre d’inclure une tranche d’âge dans un export, si je le coche.',
    effetVisible: 'Une case décochée dans l’aperçu d’export. L’année n’y figure jamais.',
    fondement: { type: 'regle-de-produit' },
    population: 'sans objet',
    defaut: 'inactif',
    siInconnu: 'La case n’apparaît pas.',
    /* Dix ans, et non cinq (décision 21) : cinq ans plus un sexe, dans un
       export destiné à un tiers, se rapproche d'une donnée identifiante. */
    bornes: [20, 30, 40, 50, 60, 70],
    deriveS2: false,
    revuLe: '2026-10-14',
  },
  {
    id: 'export.sexe',
    rubrique: 'Exports',
    clesLues: ['sexe_physio'],
    but: 'Permettre d’inclure le sexe dans un export, si je le coche.',
    effetVisible: 'Une case décochée dans l’aperçu d’export.',
    fondement: { type: 'regle-de-produit' },
    population: 'sans objet',
    defaut: 'inactif',
    siInconnu: 'La case n’apparaît pas.',
    deriveS2: false,
    revuLe: '2026-10-14',
  },

  /* --- Déclarés, inactifs, en attente d'une source ------------------------ */
  {
    id: 'sante.intervalles-repli',
    rubrique: 'Santé',
    clesLues: ['tranche_age', 'sexe_physio'],
    but:
      'Afficher un intervalle de référence de repli quand le laboratoire n’a pas ' +
      'fourni le sien.',
    effetVisible: 'Un intervalle étiqueté « repli », à côté du résultat.',
    fondement: { type: 'source-a-obtenir', laquelle: 'intervalles stratifiés par âge et sexe' },
    population: 'à confirmer à la source',
    defaut: 'inactif',
    siInconnu:
      'Aucun intervalle n’est affiché. L’intervalle imprimé par le laboratoire ' +
      'prévaut toujours, et il suffit.',
    bornes: [18, 40, 65],
    deriveS2: false,
    revuLe: '2026-10-14',
  },
  {
    id: 'psyche.population-echelles',
    rubrique: 'Psyché',
    clesLues: ['tranche_age'],
    but: 'Dire qu’une échelle n’a pas été validée pour mon âge, et ne pas interpréter le score.',
    effetVisible: 'Un message neutre remplace l’interprétation du score.',
    fondement: { type: 'source-a-obtenir', laquelle: 'populations de validation du PHQ-9 et du GAD-7' },
    population: 'à confirmer à la source',
    defaut: 'actif',
    siInconnu: '« Population de validation non confirmée. »',
    bornes: [18, 65],
    deriveS2: false,
    revuLe: '2026-10-14',
  },
  {
    id: 'corps.repere-sommeil',
    rubrique: 'Corps',
    clesLues: ['tranche_age'],
    but: 'Afficher, comme repère et jamais comme cible, une durée de sommeil publiée.',
    effetVisible: 'Une ligne « repère » dans Corps > Sommeil, avec sa source et sa population.',
    fondement: { type: 'source-a-obtenir', laquelle: 'durées de sommeil de référence par tranche d’âge' },
    population: 'à confirmer à la source',
    defaut: 'inactif',
    siInconnu: 'Aucun repère n’est affiché.',
    bornes: [18, 26, 65],
    deriveS2: false,
    revuLe: '2026-10-14',
  },
  {
    id: 'finances.reperes-age',
    rubrique: 'Finances',
    clesLues: ['tranche_age'],
    but: 'Rappeler un repère officiel qui dépend de l’âge ou de la génération.',
    effetVisible: 'Un horizon « années avant l’échéance », en arithmétique simple.',
    fondement: { type: 'source-a-obtenir', laquelle: 'repères officiels datés, à vérifier à la date' },
    population: 'à confirmer à la source',
    defaut: 'inactif',
    siInconnu: 'Aucun repère n’est affiché.',
    bornes: [18, 50, 60, 67],
    deriveS2: false,
    revuLe: '2026-10-14',
  },
];

/** Ce qui a été écarté, avec sa raison. 3.1 l'exige au même titre que les usages. */
export interface NonUsage {
  rubrique: string;
  ecarte: string;
  raison: string;
}

export const NON_USAGES: readonly NonUsage[] = [
  {
    rubrique: 'Profil, adaptation',
    ecarte: 'Tutoiement, ton, style d’accompagnement, rappels, ordre des cartes.',
    raison: 'L’adaptation reste fondée sur le déclaré et l’observé, jamais sur l’âge ou le sexe.',
  },
  {
    rubrique: 'Révisions',
    ecarte: 'Difficulté, tri des questions, niveau estimé, zone proximale, normes Cog-Training.',
    raison: 'Aucune comparaison de la personne à sa tranche d’âge ou à son sexe.',
  },
  {
    rubrique: 'Sport',
    ecarte:
      'Standards de force par sexe ou par âge, programmes genrés, zones de fréquence ' +
      'cardiaque, repère de force de préhension.',
    raison:
      'Le repère de population est écarté même en bande de contexte hors classement : ' +
      'il reste une comparaison à une tranche d’âge.',
  },
  {
    rubrique: 'Corps',
    ecarte: 'IMC et catégories, dépense énergétique, cible calorique, poids idéal, tour de taille.',
    raison:
      'Aucun calcul corporel normatif à partir de l’âge et du sexe, par prudence propre ' +
      'aux troubles du comportement alimentaire.',
  },
  {
    rubrique: 'Révisions',
    ecarte: 'Avertissement de planification fondé sur un repère de sommeil de population.',
    raison:
      'Décision 6 : Cyclades connaît le sommeil déclaré **et la base habituelle de la ' +
      'personne**. Comparer à soi-même répond à la même question, sans source et sans ' +
      'exception. La fonction est gardée, l’exception supprimée.',
  },
  {
    rubrique: 'Santé',
    ecarte: 'Score de santé, « âge biologique », risque chiffré, dose selon l’âge ou le sexe.',
    raison: 'Aucun diagnostic, aucun pronostic, aucun conseil de traitement.',
  },
  {
    rubrique: 'Finances',
    ecarte: 'Allocation selon l’âge, comparaison de revenus ou de patrimoine à une moyenne.',
    raison: 'Aucune recommandation, et aucune comparaison à une population.',
  },
  {
    rubrique: 'Interface',
    ecarte: 'Accord grammatical selon le sexe déclaré.',
    raison: 'Formulations neutres par défaut : le sexe sert aux repères, pas à la langue.',
  },
];

const PAR_ID = new Map(USAGES.map((u) => [u.id, u]));

export const usage = (id: string): UsageDeclare | undefined => PAR_ID.get(id);

/** Les usages qui lisent une clé donnée — ce que l'écran « Qui utilise » groupe. */
export const usagesLisant = (cle: CleDeContexte): UsageDeclare[] =>
  USAGES.filter((u) => u.clesLues.includes(cle));

/* ══════════════════════════════════════════════════════════════════════════
   La porte
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'un consommateur reçoit.
 *
 * Les clés absentes le sont **réellement** : une clé non déclarée n'est pas à
 * `undefined`, elle n'est pas dans l'objet. `'inconnu'` est une valeur, pas une
 * absence, et les deux ne veulent pas dire la même chose — « tu n'as pas le
 * droit de savoir » et « personne ne sait ».
 */
export interface Contexte {
  tranche_age?: string | 'inconnu';
  majeur?: 'oui' | 'non' | 'inconnu';
  sexe_physio?: SexePhysio | 'inconnu';
  suivi_cycle?: 'actif' | 'inactif';
  statut_hormonal?: string | 'inconnu';
}

/**
 * Le contexte d'un consommateur, **réduit à ce qu'il a déclaré lire**.
 *
 * Un consommateur absent du registre reçoit un objet vide : pas une erreur, pas
 * une valeur par défaut, rien (1 n° 15). L'essai sur le graphe d'imports est ce
 * qui transforme cette politesse en garantie.
 */
export function contextePersonne(
  consommateurId: string,
  etat: EtatDeLaPersonne,
  jour: string,
): Contexte {
  const u = PAR_ID.get(consommateurId);
  if (!u) return {};
  const contexte: Contexte = {};
  for (const cle of u.clesLues) {
    switch (cle) {
      case 'majeur': {
        const f = franchit(etat.age, 'majorite', jour);
        contexte.majeur = f === 'indeterminable' ? 'inconnu' : f;
        break;
      }
      case 'tranche_age': {
        const t = u.bornes ? trancheDAge(etat.age, u.bornes, jour) : null;
        contexte.tranche_age = t ?? 'inconnu';
        break;
      }
      case 'sexe_physio':
        contexte.sexe_physio = etat.sexe ?? 'inconnu';
        break;
      case 'suivi_cycle':
        contexte.suivi_cycle = etat.suiviCycleActif ? 'actif' : 'inactif';
        break;
      case 'statut_hormonal':
        contexte.statut_hormonal = etat.statutHormonal ?? 'inconnu';
        break;
    }
  }
  return contexte;
}

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle du registre
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les invariants, vérifiés plutôt que promis.
 *
 * Le plus utile est le dernier : **lire `tranche_age` sans déclarer ses
 * bornes** est la façon la plus naturelle de perdre la granularité minimale,
 * parce que rien ne plante — le consommateur reçoit simplement plus fin que
 * nécessaire, et personne ne s'en aperçoit.
 */
export function controlerRegistre(): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();
  for (const u of USAGES) {
    if (vus.has(u.id)) problemes.push(`L’usage « ${u.id} » est déclaré deux fois.`);
    vus.add(u.id);
    if (u.clesLues.length === 0) {
      problemes.push(`L’usage « ${u.id} » ne lit aucune clé : il n’a rien à faire au registre.`);
    }
    if (u.but.trim().length < 15) problemes.push(`L’usage « ${u.id} » n’a pas de but lisible.`);
    if (u.effetVisible.trim().length < 15) {
      problemes.push(`L’usage « ${u.id} » ne dit pas ce que la personne voit changer.`);
    }
    if (u.siInconnu.trim().length < 10) {
      problemes.push(`L’usage « ${u.id} » ne dit pas ce qu’il fait quand la donnée manque.`);
    }
    if (!u.population.trim()) {
      problemes.push(`L’usage « ${u.id} » ne déclare aucune population visée.`);
    }
    const litTranche = u.clesLues.includes('tranche_age');
    if (litTranche && (!u.bornes || u.bornes.length === 0)) {
      problemes.push(
        `L’usage « ${u.id} » lit « tranche_age » sans déclarer ses bornes : il recevrait ` +
          `plus fin que nécessaire, et rien ne le signalerait.`,
      );
    }
    if (!litTranche && u.bornes) {
      problemes.push(`L’usage « ${u.id} » déclare des bornes sans lire « tranche_age ».`);
    }
    if (u.bornes) {
      const triees = [...u.bornes].sort((a, b) => a - b);
      if (triees.some((b, i) => b !== u.bornes![i])) {
        problemes.push(`Les bornes de « ${u.id} » ne sont pas croissantes.`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(u.revuLe)) {
      problemes.push(`L’usage « ${u.id} » n’a pas de date de revue.`);
    }
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les interrupteurs
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un usage est-il actif ?
 *
 * On enregistre **ce que la personne a coupé**, pas ce qu'elle a laissé. La
 * dissymétrie est volontaire et elle a une conséquence précise : un usage
 * ajouté par une version ultérieure n'est dans aucune liste, donc c'est **son
 * propre défaut** qui s'applique — jamais « actif ». Un nouveau lecteur de
 * l'âge qui s'allumerait tout seul chez quelqu'un qui avait tout fermé serait
 * la pire façon d'en ajouter un.
 *
 * C'est la même règle que `relireLesReglages()` côté Finances, et pour la même
 * raison.
 */
export function estActif(id: string, coupes: readonly string[]): boolean {
  const u = PAR_ID.get(id);
  if (!u) return false;
  if (coupes.includes(id)) return false;
  return u.defaut === 'actif';
}

/**
 * Ce que l'écran « Qui utilise mon âge et mon sexe » affiche pour une ligne.
 *
 * Trois états, et le troisième n'est pas le deuxième. **Coupé** est une
 * décision de la personne ; **inconnu faute de donnée** est un usage qu'elle
 * n'a pas coupé mais qui ne peut rien faire ; **en attente d'une source** est
 * un usage que Cyclades ne sait pas encore faire. Les confondre ferait croire
 * à un réglage là où il n'y en a pas.
 */
export type EtatDUsage = 'actif' | 'coupe' | 'inconnu-faute-de-donnee' | 'attend-une-source';

export function etatDUsage(id: string, coupes: readonly string[], contexte: Contexte): EtatDUsage {
  const u = PAR_ID.get(id);
  if (!u) return 'coupe';
  if (coupes.includes(id)) return 'coupe';
  if (u.fondement.type === 'source-a-obtenir') return 'attend-une-source';
  const valeurs = Object.values(contexte);
  if (valeurs.length > 0 && valeurs.every((x) => x === 'inconnu')) {
    return 'inconnu-faute-de-donnee';
  }
  return u.defaut === 'actif' ? 'actif' : 'coupe';
}

/** Les clés qu'un écran ne montre pas sans la case « afficher les usages sensibles ». */
export const CLES_SENSIBLES: readonly CleDeContexte[] = ['suivi_cycle', 'statut_hormonal'];

/**
 * Cet usage doit-il rester replié par défaut ?
 *
 * 2.6 : l'écran ne révèle pas l'existence du suivi du cycle à quelqu'un qui
 * regarde par-dessus l'épaule. Aucun usage ne lit ces clés aujourd'hui — elles
 * arrivent avec le module du cycle —, et c'est précisément pour cela que la
 * règle s'écrit maintenant : le jour où le premier arrivera, il sera replié
 * sans que personne ait à y penser.
 */
export const estSensible = (u: UsageDeclare): boolean =>
  u.clesLues.some((c) => CLES_SENSIBLES.includes(c));

/* ══════════════════════════════════════════════════════════════════════════
   Simuler l'absence
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * « Voir ce qui change sans mon âge » (2.6), sans que l'écran touche aux
 * champs bruts.
 *
 * La première version de l'écran fabriquait l'état amputé à la main, et
 * l'essai sur le graphe d'imports l'a refusée — à juste titre. Un écran qui
 * sait écrire `{ naissanceAnnee: null, … }` sait aussi lire la vraie valeur :
 * la connaissance de la forme est déjà la moitié du contournement. La
 * simulation appartient donc au module qui possède cette forme.
 *
 * Ces deux fonctions **ne modifient rien** : elles rendent une copie. C'est ce
 * que le bandeau promet à l'écran, et un essai le vérifie en comparant la
 * liste avant et après.
 */
export const sansAge = (etat: EtatDeLaPersonne): EtatDeLaPersonne => ({
  ...etat,
  age: { naissanceAnnee: null, naissanceMois: null, majeurDeclare: null },
});

export const sansSexe = (etat: EtatDeLaPersonne): EtatDeLaPersonne => ({ ...etat, sexe: null });
