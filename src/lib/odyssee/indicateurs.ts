/**
 * Le catalogue d'indicateurs : une formule, une source, une fiabilité, un id.
 *
 * ## Pourquoi un catalogue et non des calculs dispersés
 *
 * Un indicateur défini dans le composant qui l'affiche a trois défauts dont on
 * ne se rend compte que tard : **sa formule n'est écrite nulle part**, donc elle
 * dérive ; **sa fiabilité n'est pas dite**, donc elle est présumée totale ; et
 * la **couverture de mesure** ne peut pas être calculée, puisqu'il n'existe
 * aucune liste de ce qui devrait être mesuré. Le catalogue est cette liste.
 *
 * ## Quatorze, et pas cinquante-deux
 *
 * `docs/cyclades/indicateurs.md` décrit cinquante-deux indicateurs pour les cinq
 * domaines d'Odyssée. Quatorze sont calculables aujourd'hui, parce que seule la
 * branche Révisions publie des faits. Ce module **ne déclare que ceux-là**, plus
 * `tr.couverture-mesure`, qui se calcule sur le catalogue lui-même.
 *
 * Un export qui annoncerait cinquante-deux indicateurs dont trente-huit vides
 * serait moins honnête qu'un export qui en annonce quatorze et dit pourquoi. Le
 * reste du catalogue reste dans le document, où il sert de liste d'attente
 * nommée ; il entrera en code quand Sport et Odyssée publieront.
 *
 * ## Les deux règles qui ne se négocient pas
 *
 * **`calcul` rend `null`, jamais zéro.** « Aucune donnée » et « zéro » sont deux
 * choses différentes, et les confondre fabrique des roues d'équilibre fausses :
 * un domaine non mesuré apparaîtrait comme un domaine délaissé. La couverture de
 * mesure est précisément le compte des `null`.
 *
 * **`sens: 'neutre'` n'est pas un aveu d'ignorance**, c'est une interdiction de
 * juger. E.3 l'exige pour ce qui touche au corps et à l'humeur ; ici, il couvre
 * aussi le taux de bonnes réponses, qui dépend de la difficulté tirée, et le
 * niveau estimé, qui n'est pas une note de valeur.
 *
 * Ce module est **pur**. Il prend une fenêtre de données déjà rassemblée et rend
 * des mesures. Ce qui rassemble la fenêtre vit dans `src/lib/indicateurs.ts`,
 * pour la même raison que partout : les formules sont éprouvables sans
 * navigateur, les lectures ne le sont pas.
 */
import type { Fait } from '../noyau/faits';
import { etatPourIndicateur, type Desaccord } from './desaccords';
import { fiabilite, type Fiabilite, type Frequence } from './fiabilite';

/* ══════════════════════════════════════════════════════════════════════════
   Ce que le calcul reçoit
   ══════════════════════════════════════════════════════════════════════════ */

/** Une carte FSRS, réduite à ce dont les indicateurs ont besoin. */
export interface CarteLue {
  /** Rétention prédite au jour de la fenêtre, de 0 à 1. */
  retention: number;
  /** Jour logique d'échéance, au format `AAAA-MM-JJ`. */
  echeance: string;
}

/** Un niveau estimé, tel que `niveau.ts` le rend. */
export interface NiveauLu {
  matiere: string;
  note: number;
  /** Faux tant que les observations sont trop rares pour afficher un chiffre. */
  fiable: boolean;
  observations: number;
}

/** Une révision passée, pour la courbe d'oubli. */
export interface RevisionLue {
  /** Intervalle écoulé depuis la révision précédente, en jours. */
  intervalleJours: number;
  reussie: boolean;
}

export interface Programme {
  /** Fiches du parcours. */
  fiches: number;
  /** Fiches ayant reçu au moins une révision. */
  vues: number;
  /** Fiches que la planification prévoyait d'avoir vues à ce jour. */
  planifieesADate: number;
}

export interface ActiviteLue {
  /** XP par jour logique. */
  parJour: Record<string, number>;
  serieCourante: number;
  serieRecord: number;
  niveau: number;
  xp: number;
}

export interface EchelonsLus {
  /** L'échelon atteint par famille de moteurs. */
  parFamille: Record<string, number>;
  /** Combien de sessions ont servi à l'établir. */
  sessions: number;
}

/**
 * Tout ce qu'un calcul peut lire, et rien de plus.
 *
 * Chaque bloc est **facultatif**, et c'est le mécanisme du `null` : un
 * indicateur dont la source manque ne calcule pas, au lieu de calculer zéro. Un
 * appelant qui ne rassemble que les faits obtient donc les indicateurs des
 * faits, et les autres disent « pas de donnée ».
 */
export interface Fenetre {
  /** Premier jour logique de la fenêtre, inclus. */
  de: string;
  /** Dernier jour logique, inclus. */
  a: string;
  /** Le jour logique courant, qui sert à mesurer la fraîcheur. */
  aujourdhui: string;
  /** Les faits publiés sur la fenêtre. */
  faits: readonly Fait[];
  cartes?: readonly CarteLue[];
  niveaux?: readonly NiveauLu[];
  revisions?: readonly RevisionLue[];
  programme?: Programme;
  /** Entrées non résolues du journal d'erreurs, par matière. */
  erreurs?: Record<string, number>;
  activite?: ActiviteLue;
  echelons?: EchelonsLus;
  /**
   * Les désaccords encore ouverts, tels que `desaccords.ts` les rend.
   *
   * La liste est portée entière, et non réduite à un compte : la dégradation
   * dépend des **types** touchés, et un indicateur ne doit pas être abîmé par
   * un conflit sur une source qui ne le nourrit pas. `evaluer` fait le tri par
   * indicateur, avec la règle du pivot.
   */
  desaccordsOuverts?: readonly Desaccord[];
}

export interface Mesure {
  valeur: number;
  /** Combien de points ont servi : c'est l'effectif de la fiabilité. */
  effectif: number;
  /** Le détail, quand l'indicateur en a un — par matière, par famille. */
  parClef?: Record<string, number>;
  /** Combien de jours de la fenêtre portent une donnée de cette source. */
  joursRenseignes?: number;
  /** Le dernier jour logique renseigné, pour la fraîcheur. */
  dernierJour?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le schéma d'une entrée
   ══════════════════════════════════════════════════════════════════════════ */

export type Sens = 'haut-mieux' | 'bas-mieux' | 'neutre';

/** Une cible est **fixée par la personne**, ou proposable, ou jamais proposée. */
export type Cible = 'proposable' | 'jamais-proposee' | { valeur: number };

export interface Indicateur {
  /** Stable, jamais réutilisé : c'est la clé de l'export et des preuves. */
  id: string;
  libelle: string;
  domaine: string;
  /** La formule en français, lisible par la personne. Jamais une expression. */
  formule: string;
  unite: string;
  frequence: Frequence;
  sens: Sens;
  cible: Cible;
  /**
   * Les types de faits ou magasins requis, **pivot en premier**.
   *
   * L'ordre porte une règle : `fiabilite.ts` dégrade à zéro quand le *pivot* est
   * en conflit, et à moitié quand une source secondaire l'est.
   */
  sources: readonly string[];
  /** L'effectif à partir duquel la mesure est pleinement fiable. */
  minimumDePoints: number;
  /** Rend `null` quand la source manque. **Jamais zéro par défaut.** */
  calcul: (fenetre: Fenetre) => Mesure | null;
}

const JOUR_MS = 86_400_000;

const ecartJours = (de: string, a: string): number =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / JOUR_MS);

/** Les jours logiques d'une fenêtre, bornes incluses. */
export function joursDeLaFenetre(de: string, a: string): string[] {
  const jours: string[] = [];
  const fin = Date.parse(`${a}T00:00:00Z`);
  for (let t = Date.parse(`${de}T00:00:00Z`); t <= fin; t += JOUR_MS) {
    jours.push(new Date(t).toISOString().slice(0, 10));
  }
  return jours;
}

const dansLaFenetre = (fenetre: Fenetre, fait: Fait): boolean =>
  fait.jourLogique >= fenetre.de && fait.jourLogique <= fenetre.a;

/** Les secondes d'un fait, lues de ses bornes et non de sa valeur. */
function secondes(fait: Fait): number {
  if (!fait.fin || !fait.debut) return 0;
  const duree = (Date.parse(fait.fin) - Date.parse(fait.debut)) / 1000;
  return Number.isFinite(duree) && duree > 0 ? duree : 0;
}

const I = (i: Indicateur): Indicateur => i;

/* ══════════════════════════════════════════════════════════════════════════
   Le catalogue
   ══════════════════════════════════════════════════════════════════════════ */

export const INDICATEURS: readonly Indicateur[] = [
  /* --- Cognition ---------------------------------------------------------- */
  I({
    id: 'cog.temps-revision',
    libelle: 'Temps de révision',
    domaine: 'cognition',
    formule:
      'Somme des durées des faits de révision de la fenêtre, lues de leur début et de leur fin.',
    unite: 'secondes',
    frequence: 'jour',
    sens: 'haut-mieux',
    cible: 'proposable',
    sources: ['revision.seance', 'revision.qcm', 'revision.cog-training', 'revision.fiche'],
    minimumDePoints: 1,
    calcul: (f) => {
      const retenus = f.faits.filter((x) => dansLaFenetre(f, x) && secondes(x) > 0);
      if (!retenus.length) return null;
      const jours = new Set(retenus.map((x) => x.jourLogique));
      return {
        valeur: Math.round(retenus.reduce((s, x) => s + secondes(x), 0)),
        effectif: retenus.length,
        joursRenseignes: jours.size,
        dernierJour: [...jours].sort().pop(),
      };
    },
  }),
  I({
    id: 'cog.regularite-revision',
    libelle: 'Régularité des révisions',
    domaine: 'cognition',
    formule:
      'Jours de la fenêtre portant au moins un fait de révision, divisés par le nombre de jours de la fenêtre.',
    unite: 'part',
    frequence: 'semaine',
    sens: 'haut-mieux',
    cible: 'proposable',
    sources: ['revision.seance'],
    minimumDePoints: 7,
    calcul: (f) => {
      const jours = joursDeLaFenetre(f.de, f.a);
      if (!jours.length) return null;
      const actifs = new Set(f.faits.filter((x) => dansLaFenetre(f, x)).map((x) => x.jourLogique));
      if (!actifs.size) return null;
      return {
        valeur: actifs.size / jours.length,
        effectif: jours.length,
        joursRenseignes: actifs.size,
        dernierJour: [...actifs].sort().pop(),
      };
    },
  }),
  I({
    id: 'cog.retention-fsrs',
    libelle: 'Rétention prédite',
    domaine: 'cognition',
    formule: 'Part des cartes dont la rétention prédite par FSRS atteint 0,9 au jour de la mesure.',
    unite: 'part',
    frequence: 'semaine',
    sens: 'haut-mieux',
    cible: 'proposable',
    sources: ['cartes'],
    minimumDePoints: 20,
    calcul: (f) => {
      if (!f.cartes?.length) return null;
      const bonnes = f.cartes.filter((c) => c.retention >= 0.9).length;
      return {
        valeur: bonnes / f.cartes.length,
        effectif: f.cartes.length,
        joursRenseignes: 1,
        dernierJour: f.aujourdhui,
      };
    },
  }),
  I({
    id: 'cog.charge-arrieree',
    libelle: 'Cartes en retard',
    domaine: 'cognition',
    formule: 'Cartes dont l’échéance est passée et qui n’ont pas été revues.',
    unite: 'cartes',
    frequence: 'jour',
    sens: 'bas-mieux',
    cible: { valeur: 0 },
    sources: ['cartes'],
    minimumDePoints: 1,
    calcul: (f) => {
      if (!f.cartes) return null;
      const dues = f.cartes.filter((c) => c.echeance <= f.aujourdhui).length;
      /*
       * Zéro est ici une **mesure**, pas une absence : des cartes existent, et
       * aucune n'est en retard. C'est le seul indicateur du catalogue où la
       * distinction s'inverse, et c'est pourquoi le `null` porte sur l'absence
       * du magasin et non sur un compte nul.
       */
      return { valeur: dues, effectif: f.cartes.length, joursRenseignes: 1, dernierJour: f.aujourdhui };
    },
  }),
  I({
    id: 'cog.echelon-cog-training',
    libelle: 'Échelon de Cog-Training',
    domaine: 'cognition',
    formule: 'Moyenne des échelons atteints par famille de moteurs.',
    unite: 'échelon',
    frequence: 'semaine',
    sens: 'haut-mieux',
    cible: 'proposable',
    sources: ['revision.cog-training'],
    minimumDePoints: 5,
    calcul: (f) => {
      const familles = Object.entries(f.echelons?.parFamille ?? {});
      if (!familles.length) return null;
      const faits = f.faits.filter(
        (x) => dansLaFenetre(f, x) && x.type === 'revision.cog-training',
      );
      const jours = new Set(faits.map((x) => x.jourLogique));
      return {
        valeur: familles.reduce((s, [, n]) => s + n, 0) / familles.length,
        effectif: f.echelons?.sessions ?? faits.length,
        parClef: Object.fromEntries(familles),
        joursRenseignes: jours.size,
        dernierJour: [...jours].sort().pop() ?? f.aujourdhui,
      };
    },
  }),

  /* --- Connaissances ------------------------------------------------------ */
  I({
    id: 'sav.couverture-programme',
    libelle: 'Couverture du programme',
    domaine: 'connaissances',
    formule: 'Fiches ayant reçu au moins une révision, divisées par les fiches du parcours.',
    unite: 'part',
    frequence: 'semaine',
    sens: 'haut-mieux',
    cible: { valeur: 1 },
    sources: ['fiches', 'manifeste'],
    minimumDePoints: 1,
    calcul: (f) => {
      if (!f.programme || f.programme.fiches <= 0) return null;
      return {
        valeur: f.programme.vues / f.programme.fiches,
        effectif: f.programme.fiches,
        joursRenseignes: 1,
        dernierJour: f.aujourdhui,
      };
    },
  }),
  I({
    id: 'sav.niveau-estime',
    libelle: 'Niveau estimé',
    domaine: 'connaissances',
    formule:
      'Moyenne des notes Elo des matières dont le nombre d’observations permet de l’afficher.',
    unite: 'points Elo',
    frequence: 'semaine',
    // Un niveau n'est pas une note de valeur : aucune flèche, aucune couleur de
    // jugement. E.3 appliqué à ce qui ressemble le plus à un bulletin.
    sens: 'neutre',
    cible: 'jamais-proposee',
    sources: ['competences'],
    minimumDePoints: 10,
    calcul: (f) => {
      const fiables = (f.niveaux ?? []).filter((n) => n.fiable);
      if (!fiables.length) return null;
      return {
        valeur: fiables.reduce((s, n) => s + n.note, 0) / fiables.length,
        effectif: fiables.reduce((s, n) => s + n.observations, 0),
        parClef: Object.fromEntries(fiables.map((n) => [n.matiere, Math.round(n.note)])),
        joursRenseignes: 1,
        dernierJour: f.aujourdhui,
      };
    },
  }),
  I({
    id: 'sav.retard-programme',
    libelle: 'Retard sur le programme',
    domaine: 'connaissances',
    formule: 'Fiches que la planification prévoyait d’avoir vues à ce jour, moins celles vues.',
    unite: 'fiches',
    frequence: 'semaine',
    sens: 'bas-mieux',
    cible: { valeur: 0 },
    sources: ['planification', 'fiches'],
    minimumDePoints: 1,
    calcul: (f) => {
      if (!f.programme || f.programme.planifieesADate <= 0) return null;
      return {
        valeur: Math.max(0, f.programme.planifieesADate - f.programme.vues),
        effectif: f.programme.planifieesADate,
        joursRenseignes: 1,
        dernierJour: f.aujourdhui,
      };
    },
  }),
  I({
    id: 'sav.taux-bonnes',
    libelle: 'Taux de bonnes réponses',
    domaine: 'connaissances',
    formule: 'Bonnes réponses divisées par réponses, sur les faits de QCM de la fenêtre.',
    unite: 'part',
    frequence: 'semaine',
    // Neutre, et ce n'est pas une prudence : le taux dépend de la difficulté
    // tirée. Un taux qui monte parce que le tirage s'est adouci n'est pas un
    // progrès, et une flèche verte le dirait pourtant.
    sens: 'neutre',
    cible: 'jamais-proposee',
    sources: ['revision.qcm'],
    minimumDePoints: 30,
    calcul: (f) => {
      let bonnes = 0;
      let reponses = 0;
      const jours = new Set<string>();
      for (const fait of f.faits) {
        if (!dansLaFenetre(f, fait) || fait.type !== 'revision.qcm') continue;
        const details = fait.details as { bonnes?: unknown; reponses?: unknown } | undefined;
        const b = typeof details?.bonnes === 'number' ? details.bonnes : null;
        const r = typeof details?.reponses === 'number' ? details.reponses : null;
        if (b === null || r === null || r <= 0) continue;
        bonnes += b;
        reponses += r;
        jours.add(fait.jourLogique);
      }
      if (!reponses) return null;
      return {
        valeur: bonnes / reponses,
        effectif: reponses,
        joursRenseignes: jours.size,
        dernierJour: [...jours].sort().pop(),
      };
    },
  }),
  I({
    id: 'sav.courbe-oubli',
    libelle: 'Pente de la courbe d’oubli',
    domaine: 'connaissances',
    formule:
      'Pente de la droite des moindres carrés entre l’intervalle écoulé, en jours, et la réussite de la révision.',
    unite: 'part par jour',
    frequence: 'mois',
    sens: 'neutre',
    cible: 'jamais-proposee',
    sources: ['journal', 'cartes'],
    minimumDePoints: 50,
    calcul: (f) => {
      const points = (f.revisions ?? []).filter((r) => Number.isFinite(r.intervalleJours));
      if (points.length < 2) return null;
      const n = points.length;
      const moyenneX = points.reduce((s, r) => s + r.intervalleJours, 0) / n;
      const moyenneY = points.filter((r) => r.reussie).length / n;
      let haut = 0;
      let bas = 0;
      for (const r of points) {
        const dx = r.intervalleJours - moyenneX;
        haut += dx * ((r.reussie ? 1 : 0) - moyenneY);
        bas += dx * dx;
      }
      /*
       * Toutes les révisions au même intervalle : la pente n'existe pas. Rendre
       * zéro dirait « l'oubli ne joue pas », ce qui est une affirmation forte
       * tirée d'une absence de variation.
       */
      if (bas === 0) return null;
      return { valeur: haut / bas, effectif: n, joursRenseignes: 1, dernierJour: f.aujourdhui };
    },
  }),
  I({
    id: 'sav.erreurs-par-matiere',
    libelle: 'Erreurs non résolues',
    domaine: 'connaissances',
    formule: 'Entrées du journal d’erreurs encore ouvertes, comptées par matière.',
    unite: 'entrées',
    frequence: 'semaine',
    sens: 'bas-mieux',
    cible: { valeur: 0 },
    sources: ['journal'],
    minimumDePoints: 5,
    calcul: (f) => {
      if (!f.erreurs) return null;
      const entrees = Object.entries(f.erreurs);
      const total = entrees.reduce((s, [, n]) => s + n, 0);
      return {
        valeur: total,
        effectif: Math.max(1, total),
        parClef: Object.fromEntries(entrees),
        joursRenseignes: 1,
        dernierJour: f.aujourdhui,
      };
    },
  }),

  /* --- Transverses -------------------------------------------------------- */
  I({
    id: 'tr.serie',
    libelle: 'Série de jours',
    domaine: 'transverse',
    formule:
      'Jours consécutifs portant au moins un fait d’effort, les jours de repos déclarés étant traversés sans casser la série.',
    unite: 'jours',
    frequence: 'jour',
    sens: 'haut-mieux',
    cible: 'proposable',
    sources: ['revision.seance'],
    minimumDePoints: 1,
    calcul: (f) => {
      if (!f.activite) return null;
      return {
        valeur: f.activite.serieCourante,
        effectif: 1,
        parClef: { record: f.activite.serieRecord },
        joursRenseignes: 1,
        dernierJour: f.aujourdhui,
      };
    },
  }),
  I({
    id: 'tr.xp-jour',
    libelle: 'XP par jour',
    domaine: 'transverse',
    formule: 'Somme des XP attribués par règle sur la fenêtre, divisée par ses jours.',
    unite: 'XP par jour',
    frequence: 'jour',
    sens: 'haut-mieux',
    cible: 'proposable',
    sources: ['revision.seance', 'revision.qcm', 'revision.cog-training'],
    minimumDePoints: 7,
    calcul: (f) => {
      if (!f.activite) return null;
      const jours = joursDeLaFenetre(f.de, f.a);
      const dans = Object.entries(f.activite.parJour).filter(
        ([jour]) => jour >= f.de && jour <= f.a,
      );
      if (!dans.length) return null;
      return {
        valeur: dans.reduce((s, [, xp]) => s + xp, 0) / jours.length,
        effectif: dans.length,
        joursRenseignes: dans.length,
        dernierJour: dans.map(([jour]) => jour).sort().pop(),
      };
    },
  }),
  I({
    id: 'tr.niveau',
    libelle: 'Niveau',
    domaine: 'transverse',
    formule: 'Niveau atteint au barème de 100 + 50 × (n − 1) XP par niveau.',
    unite: 'niveau',
    frequence: 'jour',
    sens: 'haut-mieux',
    cible: 'jamais-proposee',
    sources: ['revision.seance'],
    minimumDePoints: 1,
    calcul: (f) => {
      if (!f.activite) return null;
      return {
        valeur: f.activite.niveau,
        effectif: 1,
        parClef: { xp: f.activite.xp },
        joursRenseignes: 1,
        dernierJour: f.aujourdhui,
      };
    },
  }),
  I({
    id: 'tr.couverture-mesure',
    libelle: 'Couverture de mesure',
    domaine: 'transverse',
    formule:
      'Indicateurs du catalogue qui rendent une mesure sur cette fenêtre, divisés par les indicateurs du catalogue — celui-ci excepté.',
    unite: 'part',
    frequence: 'semaine',
    sens: 'haut-mieux',
    cible: 'proposable',
    sources: ['catalogue'],
    minimumDePoints: 1,
    /*
     * Le seul indicateur qui se calcule sur le catalogue et non sur les
     * données. Il s'exclut lui-même du dénominateur : s'y compter ferait monter
     * la couverture du seul fait de la mesurer.
     */
    calcul: (f) => {
      const autres = INDICATEURS.filter((i) => i.id !== 'tr.couverture-mesure');
      const calculables = autres.filter((i) => i.calcul(f) !== null).length;
      return {
        valeur: calculables / autres.length,
        effectif: autres.length,
        parClef: { calculables, declares: autres.length },
        joursRenseignes: 1,
        dernierJour: f.aujourdhui,
      };
    },
  }),

  /**
   * Traitements : un COMPTE, et rien d'autre.
   *
   * L'amendement signé le 16 octobre fait entrer les traitements dans les
   * indicateurs, coffre ouvert. Ce que cet indicateur a le droit de dire
   * est étroitement borné par le contrat du type `odyssee.medicament` :
   * « Enregistrement seul […] Aucun conseil, aucune dose proposée. »
   *
   * D'où deux choix qui ne sont pas des détails de forme.
   *
   * `sens: 'neutre'` — ni plus ni moins n'est « mieux ». Déclarer
   * `haut-mieux` ferait de l'observance une performance, et un jour sans
   * prise une contre-performance ; `bas-mieux` serait pire encore. Le
   * logiciel ne sait pas ce qui était prévu, et c'est délibéré.
   *
   * `cible: 'jamais-proposee'` — proposer une cible de prises serait un
   * acte médical rendu par un programme qui ne connaît ni l'ordonnance ni
   * la personne. Le mécanisme de proposition existe et sait se taire ; on
   * le lui demande ici explicitement plutôt que d'espérer qu'il s'abstienne.
   *
   * Le fait publié ne nomme pas la molécule ; cet indicateur ne peut donc
   * pas la nommer. Il compte des JOURS, pas des prises : un jour à six
   * prises et un jour à une prise comptent pareil, parce que le nombre de
   * prises d'un jour dépend de ce qui est pris — et qu'il ne le sait pas.
   */
  I({
    id: 'corps.jours-avec-prise',
    libelle: 'Jours avec une prise notée',
    domaine: 'corps',
    formule:
      'Nombre de jours logiques de la fenêtre portant au moins une prise notée, sans distinguer laquelle.',
    unite: 'jours',
    frequence: 'jour',
    sens: 'neutre',
    cible: 'jamais-proposee',
    sources: ['odyssee.medicament'],
    minimumDePoints: 1,
    calcul: (f) => {
      const retenus = f.faits.filter(
        (x) => dansLaFenetre(f, x) && x.type === 'odyssee.medicament',
      );
      /*
         `null` et non zéro : coffre fermé, le publieur ne rend rien, et
         zéro se lirait « aucune prise ce mois-ci » — l'inverse de la
         vérité, qui est « on n'en sait rien ».
      */
      if (!retenus.length) return null;
      const jours = new Set(retenus.map((x) => x.jourLogique));
      return {
        valeur: jours.size,
        effectif: retenus.length,
        joursRenseignes: jours.size,
        dernierJour: [...jours].sort().pop(),
      };
    },
  }),
];

const PAR_ID = new Map(INDICATEURS.map((i) => [i.id, i]));

export const indicateur = (id: string): Indicateur | undefined => PAR_ID.get(id);

export const indicateursDuDomaine = (domaine: string): Indicateur[] =>
  INDICATEURS.filter((i) => i.domaine === domaine);

/** Les domaines que le catalogue couvre aujourd'hui, dans l'ordre déclaré. */
export const domainesCouverts = (): string[] => [
  ...new Set(INDICATEURS.map((i) => i.domaine)),
];

/* ══════════════════════════════════════════════════════════════════════════
   Évaluer : la mesure, et ce qu'elle vaut
   ══════════════════════════════════════════════════════════════════════════ */

export interface Evaluation {
  indicateur: Indicateur;
  /** `null` quand la source manque : « pas de donnée », et non zéro. */
  mesure: Mesure | null;
  /** Absente quand il n'y a rien à qualifier. */
  fiabilite: Fiabilite | null;
  /** Ce qu'il faut dire quand il n'y a pas de mesure. */
  pourquoi?: string;
}

/**
 * Évalue un indicateur sur une fenêtre, fiabilité comprise.
 *
 * La fiabilité n'est calculée que s'il y a une mesure : qualifier l'exactitude
 * d'une valeur qui n'existe pas n'a pas de sens, et rendre `0` aurait fait
 * croire à une mesure très mauvaise plutôt qu'à une absence.
 */
export function evaluer(indic: Indicateur, fenetre: Fenetre): Evaluation {
  const mesure = indic.calcul(fenetre);
  if (!mesure) {
    return {
      indicateur: indic,
      mesure: null,
      fiabilite: null,
      pourquoi: `Pas de donnée sur cette période pour ${indic.sources.join(', ')}.`,
    };
  }
  const jours = joursDeLaFenetre(fenetre.de, fenetre.a);
  return {
    indicateur: indic,
    mesure,
    fiabilite: fiabilite({
      points: mesure.effectif,
      minimumDePoints: indic.minimumDePoints,
      joursDepuisDerniereDonnee: mesure.dernierJour
        ? Math.max(0, ecartJours(mesure.dernierJour, fenetre.aujourdhui))
        : ecartJours(fenetre.a, fenetre.aujourdhui),
      frequence: indic.frequence,
      joursRenseignes: mesure.joursRenseignes ?? jours.length,
      joursAttendus: jours.length,
      desaccords: etatPourIndicateur(indic, fenetre.desaccordsOuverts ?? []),
    }),
  };
}

export const evaluerTout = (fenetre: Fenetre): Evaluation[] =>
  INDICATEURS.map((i) => evaluer(i, fenetre));

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle du catalogue
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Vérifie les invariants du catalogue.
 *
 * Trois comptent vraiment. Qu'**aucun identifiant ne soit réutilisé** : un id
 * est la clé d'une preuve dans une analyse importée, et le recycler ferait
 * pointer une preuve ancienne sur une formule nouvelle. Que **chaque formule
 * soit lisible en français** : c'est elle que la personne lit pour juger la
 * mesure. Et que **le pivot soit nommé en premier** dans les sources, puisque
 * la règle d'intégrité en dépend.
 */
export function controlerCatalogue(domainesConnus: readonly string[]): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();
  for (const i of INDICATEURS) {
    if (vus.has(i.id)) problemes.push(`L’indicateur « ${i.id} » est déclaré deux fois.`);
    vus.add(i.id);
    if (!/^[a-z]+\.[a-z0-9-]+$/.test(i.id)) {
      problemes.push(`L’identifiant « ${i.id} » ne suit pas la forme « domaine.nom ».`);
    }
    if (i.formule.trim().length < 25 || !i.formule.trim().endsWith('.')) {
      problemes.push(`La formule de « ${i.id} » n’est pas une phrase française complète.`);
    }
    if (!i.sources.length) problemes.push(`L’indicateur « ${i.id} » ne nomme aucune source.`);
    if (!i.unite.trim()) problemes.push(`L’indicateur « ${i.id} » n’a pas d’unité.`);
    if (i.minimumDePoints < 1) {
      problemes.push(`Le minimum d’effectif de « ${i.id} » doit valoir au moins un point.`);
    }
    if (i.domaine !== 'transverse' && !domainesConnus.includes(i.domaine)) {
      problemes.push(`L’indicateur « ${i.id} » se rattache à « ${i.domaine} », qui n’est pas un domaine.`);
    }
  }
  return problemes;
}
