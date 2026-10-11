/**
 * Générateur de données synthétiques : cinq ans d'usage intensif de Révisions.
 *
 * ## À quoi il sert, et à quoi il ne sert pas
 *
 * Le prompt « stockage » demande de **mesurer avant de décider** si la
 * compression vaut son coût, magasin par magasin. Ce module fabrique la matière
 * de cette mesure. Il ne décide de rien : il produit un jeu de données, et
 * `scripts/bench-storage.mjs` le pèse.
 *
 * ## Pourquoi le texte doit être du vrai français
 *
 * C'est le point le plus facile à rater. Mesurer un taux de compression sur des
 * chaînes aléatoires ne mesure rien : des octets aléatoires ne se compressent
 * pas, et gzip rendrait un gain nul sur des notes de séance qui, dans la vraie
 * vie, se compriment d'un facteur quatre ou cinq. Les notes engendrées ici sont
 * donc des phrases françaises assemblées à partir d'un vocabulaire fini, avec la
 * redondance d'une vraie prose — même structure syntaxique, mêmes mots qui
 * reviennent. La mesure de compression qui en sort est transposable ; celle d'un
 * texte aléatoire ne l'aurait pas été.
 *
 * ## Déterminisme
 *
 * Une graine donne toujours le même jeu. Sans quoi deux exécutions de
 * `bench-storage` rendraient deux budgets différents, et l'on ne saurait jamais
 * si un écart vient du modèle de données ou du tirage.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Hasard reproductible
   ══════════════════════════════════════════════════════════════════════════ */

/** Mulberry32 : court, rapide, suffisant pour engendrer des volumes. */
export function alea(graine = 1) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entier = (r, max) => Math.floor(r() * max);
const parmi = (r, liste) => liste[entier(r, liste.length)];
const entre = (r, min, max) => min + entier(r, max - min + 1);

/* ══════════════════════════════════════════════════════════════════════════
   Hypothèses de volume, toutes nommées et modifiables
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les hypothèses d'usage. Elles sont déclarées ici, en un seul endroit, parce
 * qu'un budget de stockage n'a de sens qu'avec ses hypothèses sous les yeux :
 * « 40 Mo » ne veut rien dire, « 40 Mo pour deux séances par jour pendant cinq
 * ans » veut dire quelque chose.
 */
export const HYPOTHESES = {
  annees: 5,
  /** Le contenu grandit : 262 fiches aujourd'hui, le double à cinq ans. */
  fiches: 520,
  /** Flashcards par fiche, à la louche d'après la production actuelle. */
  cartesParFiche: 8,
  /** Questions de la banque « QCM - DGFiP » : la banque entière. */
  questionsDgfip: 540,
  /** Longueur d'une note de séance, en signes. Une à deux pages. */
  noteMin: 2800,
  noteMax: 6200,
  /** Longueur d'une restitution à blanc, en signes. */
  restitutionMin: 700,
  restitutionMax: 2200,
  /** Révisions de flashcards par jour d'étude. */
  revisionsParJour: 40,
  /** Résultats de quiz de cours par jour d'étude. */
  quizParJour: 3,
  /** Sessions de QCM DGFiP par semaine. */
  qcmParSemaine: 2,
  /** Sessions de Cog-Training par jour d'étude, pour chacun des trois exercices. */
  cogParJour: 1,
  /** Entrées ouvertes au journal d'erreurs par jour d'étude. */
  erreursParJour: 4,
  /** Demandes d'aide à l'IA par jour d'étude. */
  aidesParJour: 1,
  /** Part de jours d'étude : le reste est repos, maladie, vacances. */
  partJoursEtudies: 0.82,
};

/* ══════════════════════════════════════════════════════════════════════════
   Vocabulaire : du français, et toujours le même
   ══════════════════════════════════════════════════════════════════════════ */

const MATIERES = [
  'Droit public',
  'Finances publiques',
  'Économie',
  'Questions européennes',
  'Questions internationales',
  'Questions sociales',
  'Cas pratique',
];

const THEMES = [
  'droit-public',
  'finances-publiques',
  'economie',
  'questions-europeennes',
  'questions-internationales',
  'questions-sociales',
  'cas-pratique',
];

const RUBRIQUES_DGFIP = [
  'culture-generale',
  'maths',
  'francais',
  'logique',
  'culture-numerique',
  'environnement-administratif',
  'union-europeenne',
  'anglais',
];

const SUJETS = [
  'la hiérarchie des normes',
  'le contrôle de conventionnalité',
  'la loi de finances initiale',
  'le principe de sincérité budgétaire',
  'la politique monétaire de la Banque centrale européenne',
  'le marché intérieur',
  'la subsidiarité',
  'le Conseil européen',
  'la protection sociale',
  'le financement de la Sécurité sociale',
  'la décentralisation',
  'le service public',
  'la responsabilité administrative',
  'la trajectoire des finances publiques',
  'le pacte de stabilité et de croissance',
  'la fiscalité du patrimoine',
  'le plein emploi',
  'la transition écologique',
];

const VERBES = [
  'repose sur',
  's’articule avec',
  'se distingue de',
  'suppose',
  'exclut',
  'conditionne',
  'encadre',
  'précise',
  'nuance',
  'complète',
];

const CHARNIERES = [
  'En revanche,',
  'Dès lors,',
  'Il reste que',
  'À l’inverse,',
  'Par ailleurs,',
  'En pratique,',
  'Au fond,',
  'Plus précisément,',
];

const COMPLEMENTS = [
  'une articulation que la jurisprudence a précisée par étapes',
  'un équilibre que le texte ne dit pas et que la pratique a fixé',
  'une exigence de motivation qui vaut aussi devant le juge',
  'un contrôle dont l’intensité varie selon la matière',
  'des chiffres qu’il faut daterester et sourcer en copie',
  'une compétence partagée dont les limites se discutent encore',
  'un dispositif dont le financement n’est pas assuré au-delà de l’exercice',
  'une réforme dont les effets ne sont pas encore mesurables',
];

/** Une phrase plausible, construite comme le seraient de vraies notes. */
function phrase(r) {
  const debut = r() < 0.4 ? `${parmi(r, CHARNIERES)} ` : '';
  return `${debut}${parmi(r, SUJETS)} ${parmi(r, VERBES)} ${parmi(r, COMPLEMENTS)}.`;
}

/** Un texte d'environ `signes` caractères, en paragraphes. */
export function texte(r, signes) {
  const morceaux = [];
  let total = 0;
  let paragraphe = [];
  while (total < signes) {
    const p = phrase(r);
    paragraphe.push(p);
    total += p.length + 1;
    if (paragraphe.length >= entre(r, 3, 6)) {
      morceaux.push(paragraphe.join(' '));
      paragraphe = [];
    }
  }
  if (paragraphe.length) morceaux.push(paragraphe.join(' '));
  return morceaux.join('\n\n');
}

/* ══════════════════════════════════════════════════════════════════════════
   Dates
   ══════════════════════════════════════════════════════════════════════════ */

const JOUR_MS = 86_400_000;

const jourISO = (d) => new Date(d).toISOString().slice(0, 10);

function horodatage(r, jour) {
  const h = String(entre(r, 7, 23)).padStart(2, '0');
  const m = String(entier(r, 60)).padStart(2, '0');
  const s = String(entier(r, 60)).padStart(2, '0');
  return `${jour}T${h}:${m}:${s}.000Z`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le générateur
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un identifiant de fiche tel que le build en produit : seize signes
 * hexadécimaux, issus d'un hachage de chemin.
 */
function idFiche(r) {
  let s = '';
  for (let i = 0; i < 16; i += 1) s += '0123456789abcdef'[entier(r, 16)];
  return s;
}

/**
 * Engendre le jeu complet.
 *
 * Rend un objet dont les clés sont les noms des magasins d'IndexedDB, plus la
 * clé `projection`, qui porte les magasins qui **n'existent pas encore** mais
 * que le modèle de données appellera — voir `bench-storage.mjs`.
 */
export function engendrer({ annees = HYPOTHESES.annees, graine = 1, hypotheses = {} } = {}) {
  const h = { ...HYPOTHESES, ...hypotheses, annees };
  const r = alea(graine);
  const jours = Math.round(annees * 365.25);
  const debut = Date.UTC(2026, 0, 1) - jours * JOUR_MS;

  const fiches = Array.from({ length: h.fiches }, () => idFiche(r));
  const matiereDe = new Map(fiches.map((id) => [id, parmi(r, MATIERES)]));

  const sortie = {
    etat: [],
    cartes: [],
    fiches: [],
    journal: [],
    competences: [],
    difficultes: [],
    quiz: [],
    jours: [],
    nback: [],
    seances: [],
    qcmDgfip: [],
    qcmSessions: [],
    relationnel: [],
    vmSeuils: [],
    vmSessions: [],
    aides: [],
    projection: { revisions: [] },
  };

  /* --- Profil et réglages : quelques enregistrements, pour mémoire --------- */
  sortie.etat.push(
    {
      clef: 'profil',
      valeur: {
        xp: jours * 60,
        streakCourante: 120,
        streakRecord: 310,
        dernierJourEtudie: jourISO(debut + (jours - 1) * JOUR_MS),
        badges: ['premier-jour', 'cent-jours', 'mille-cartes', 'serie-100'],
        creeLe: horodatage(r, jourISO(debut)),
      },
    },
    {
      clef: 'planification',
      valeur: { rotations: { insp: THEMES }, trimestreEcarte: null },
    },
    { clef: 'reglagesSession', valeur: { plafondCartes: 60, plafondQuestions: 30 } },
  );

  /* --- Fiches : un état par fiche ---------------------------------------- */
  for (const id of fiches) {
    const lue = r() < 0.9;
    sortie.fiches.push({
      id,
      matiere: matiereDe.get(id),
      lu: lue,
      derniereOuverture: lue ? horodatage(r, jourISO(debut + entier(r, jours) * JOUR_MS)) : null,
      secondes: lue ? entre(r, 300, 5400) : 0,
      ...(r() < 0.8
        ? {
            pretesteeLe: horodatage(r, jourISO(debut + entier(r, jours) * JOUR_MS)),
            pretestVues: Array.from({ length: entre(r, 3, 9) }, () => `q${entier(r, 400)}`),
          }
        : {}),
    });
  }

  /* --- Cartes : l'état courant, un par carte ----------------------------- */
  const cartes = [];
  for (const ficheId of fiches) {
    for (let i = 0; i < h.cartesParFiche; i += 1) {
      const id = `${ficheId}:${i}`;
      cartes.push(id);
      const revisions = entre(r, 1, 60);
      const derniere = jourISO(debut + entre(r, jours - 400, jours - 1) * JOUR_MS);
      const intervalle = entre(r, 1, 365);
      sortie.cartes.push({
        id,
        ficheId,
        matiere: matiereDe.get(ficheId),
        du: jourISO(new Date(`${derniere}T00:00:00Z`).getTime() + intervalle * JOUR_MS),
        derniereRevision: horodatage(r, derniere),
        intervalle,
        revisions,
        oublis: entier(r, Math.max(1, Math.round(revisions / 4))),
        fsrs: {
          due: horodatage(r, derniere),
          stability: Number((r() * 400).toFixed(4)),
          difficulty: Number((1 + r() * 9).toFixed(4)),
          elapsed_days: entier(r, 400),
          scheduled_days: intervalle,
          learning_steps: entier(r, 3),
          reps: revisions,
          lapses: entier(r, 8),
          state: parmi(r, [1, 2, 2, 2, 3]),
          last_review: horodatage(r, derniere),
        },
      });
    }
  }

  /* --- Banque DGFiP : un état par question -------------------------------- */
  for (let i = 0; i < h.questionsDgfip; i += 1) {
    const vues = entre(r, 1, 40);
    const bonnes = entier(r, vues + 1);
    const mauvaises = entier(r, vues - bonnes + 1);
    sortie.qcmDgfip.push({
      id: `dgfip-${parmi(r, RUBRIQUES_DGFIP)}-${i}`,
      rubriqueId: parmi(r, RUBRIQUES_DGFIP),
      vues,
      bonnes,
      mauvaises,
      abstentions: vues - bonnes - mauvaises,
      derniereLe: horodatage(r, jourISO(debut + entier(r, jours) * JOUR_MS)),
    });
  }

  /* --- Seuils Veridical Mapping : série temporelle conservée telle quelle -- */
  const DIMENSIONS = ['taille', 'intensite', 'hauteur', 'duree', 'luminosite', 'rugosite', 'tempo'];
  for (const de of DIMENSIONS) {
    for (const vers of DIMENSIONS) {
      if (de === vers) continue;
      sortie.vmSeuils.push({
        id: `${de}>${vers}`,
        famille: parmi(r, ['prothetique', 'metathetique', 'mixte']),
        de,
        vers,
        horsFamille: r() < 0.4,
        transmodale: r() < 0.3,
        escalier: {
          delta: Number((r() * 8).toFixed(3)),
          bonnesDeSuite: entier(r, 4),
          inversions: Array.from({ length: entre(r, 4, 24) }, () => Number((r() * 8).toFixed(3))),
          derniereDirection: parmi(r, ['resserre', 'elargit', null]),
          essais: entre(r, 20, 900),
          reussis: entre(r, 10, 700),
        },
        seuil: r() < 0.8 ? Number((r() * 6).toFixed(3)) : null,
        statut: parmi(r, ['en-cours', 'converge', 'converge']),
        majLe: horodatage(r, jourISO(debut + entier(r, jours) * JOUR_MS)),
      });
    }
  }

  /* --- Compétences et difficultés ---------------------------------------- */
  for (const matiere of MATIERES) {
    sortie.competences.push({
      clef: `matiere:${matiere}`,
      portee: 'matiere',
      libelle: matiere,
      matiere,
      note: Number((1200 + r() * 600).toFixed(2)),
      observations: entre(r, 50, 3000),
      majLe: horodatage(r, jourISO(debut + jours * JOUR_MS - JOUR_MS)),
    });
    for (let f = 1; f <= 8; f += 1) {
      sortie.competences.push({
        clef: `fascicule:${matiere}|Fascicule ${f}`,
        portee: 'fascicule',
        libelle: `Fascicule ${f}`,
        matiere,
        note: Number((1100 + r() * 700).toFixed(2)),
        observations: entre(r, 10, 600),
        majLe: horodatage(r, jourISO(debut + entier(r, jours) * JOUR_MS)),
      });
    }
  }
  for (const id of fiches) {
    sortie.competences.push({
      clef: `fiche:${id}`,
      portee: 'fiche',
      libelle: `Fiche ${id.slice(0, 6)}`,
      matiere: matiereDe.get(id),
      note: Number((1000 + r() * 800).toFixed(2)),
      observations: entre(r, 1, 80),
      majLe: horodatage(r, jourISO(debut + entier(r, jours) * JOUR_MS)),
    });
  }
  // Une difficulté par item jamais rencontré : cartes, questions de quiz, QCM.
  for (const id of cartes) {
    sortie.difficultes.push({
      id,
      note: Number((900 + r() * 900).toFixed(2)),
      observations: entre(r, 1, 60),
      majLe: horodatage(r, jourISO(debut + entier(r, jours) * JOUR_MS)),
    });
  }
  for (let i = 0; i < h.questionsDgfip; i += 1) {
    sortie.difficultes.push({
      id: `dgfip-${i}`,
      note: Number((900 + r() * 900).toFixed(2)),
      observations: entre(r, 1, 40),
      majLe: horodatage(r, jourISO(debut + entier(r, jours) * JOUR_MS)),
    });
  }

  /* --- Le fil des jours --------------------------------------------------- */
  let idQuiz = 1;
  let idSeance = 1;
  let idNback = 1;
  let idRelationnel = 1;
  let idVm = 1;
  let idQcm = 1;
  let idAide = 1;
  let idRevision = 1;
  const seancesParTheme = new Map();

  for (let j = 0; j < jours; j += 1) {
    const jour = jourISO(debut + j * JOUR_MS);
    const etudie = r() < h.partJoursEtudies;
    const theme = THEMES[new Date(`${jour}T12:00:00Z`).getUTCDay() % THEMES.length];

    /* Pointage du jour : un enregistrement par jour, étudié ou non. */
    const cartesDuJour = etudie ? entre(r, 20, h.revisionsParJour + 20) : 0;
    const reponses = etudie ? entre(r, 10, 60) : 0;
    sortie.jours.push({
      jour,
      xp: etudie ? entre(r, 20, 160) : 0,
      cartes: cartesDuJour,
      quiz: etudie ? entre(r, 0, h.quizParJour) : 0,
      bonnes: Math.round(reponses * (0.5 + r() * 0.45)),
      reponses,
      secondes: etudie ? entre(r, 900, 10800) : 0,
    });

    if (!etudie) continue;

    /* Séance de révision, avec sa note et ses restitutions. */
    const anterieures = seancesParTheme.get(theme) ?? [];
    const etendue = jour.slice(8, 10) === '01';
    const combien = Math.min(etendue ? 4 : 2, anterieures.length);
    const restitutions = {};
    for (const ante of anterieures.slice(-combien)) {
      restitutions[String(ante)] = texte(r, entre(r, h.restitutionMin, h.restitutionMax));
    }
    sortie.seances.push({
      id: idSeance,
      theme,
      jour,
      statut: 'terminee',
      termineeLe: horodatage(r, jour),
      secondes: entre(r, 1800, 10800),
      note: texte(r, entre(r, h.noteMin, h.noteMax)),
      restitutions,
      fiches: Array.from({ length: entre(r, 1, 5) }, () => parmi(r, fiches)),
      etendue,
    });
    anterieures.push(idSeance);
    seancesParTheme.set(theme, anterieures);
    idSeance += 1;

    /* Révisions de flashcards : le journal que le modèle n'a pas encore. */
    for (let k = 0; k < cartesDuJour; k += 1) {
      sortie.projection.revisions.push({
        id: idRevision,
        carteId: parmi(r, cartes),
        le: horodatage(r, jour),
        note: parmi(r, [1, 2, 3, 3, 4]),
        etatAvant: parmi(r, [1, 2, 2, 3]),
        intervalleAvant: entier(r, 300),
        secondes: entre(r, 2, 90),
      });
      idRevision += 1;
    }

    /* Quiz de cours. */
    for (let k = 0; k < entre(r, 0, h.quizParJour); k += 1) {
      const ficheId = parmi(r, fiches);
      const total = entre(r, 5, 12);
      sortie.quiz.push({
        id: idQuiz,
        ficheId,
        matiere: matiereDe.get(ficheId),
        le: horodatage(r, jour),
        bonnes: entier(r, total + 1),
        total,
      });
      idQuiz += 1;
    }

    /* Cog-Training : trois exercices, détail par item pour le relationnel. */
    for (let k = 0; k < h.cogParJour; k += 1) {
      const epreuves = entre(r, 20, 60);
      sortie.nback.push({
        id: idNback,
        le: horodatage(r, jour),
        titre: parmi(r, ['duo', 'trio', 'quad']),
        statut: 'terminee',
        n: entre(r, 2, 5),
        dimensions: ['position', 'couleur', 'son', 'forme'].slice(0, entre(r, 2, 4)),
        nombreEpreuves: epreuves,
        taux: Number(r().toFixed(4)),
        reperees: entier(r, epreuves),
        aReperer: entier(r, epreuves),
        erreurs: entier(r, 20),
        secondes: entre(r, 180, 900),
      });
      idNback += 1;

      const tentes = entre(r, 10, 30);
      sortie.relationnel.push({
        id: idRelationnel,
        le: horodatage(r, jour),
        items: Array.from({ length: tentes }, () => ({
          moteur: parmi(r, [
            'chaine-conclusion',
            'chaine-second-ordre',
            'premisse-manquante',
            'analogie-inter-systemes',
            'syllogisme',
            'compose',
          ]),
          systeme: parmi(r, ['line', 'groups', 'rang', 'allen', 'rcc8', 'classes', 'poset']),
          note: Number(r().toFixed(3)),
        })),
        tentes,
        reussis: entier(r, tentes + 1),
        secondes: entre(r, 300, 1500),
      });
      idRelationnel += 1;

      if (r() < 0.5) {
        const essais = entre(r, 20, 80);
        sortie.vmSessions.push({
          id: idVm,
          le: horodatage(r, jour),
          famille: parmi(r, ['prothetique', 'metathetique', 'mixte']),
          mode: parmi(r, ['paire', 'plan', 'modulaire']),
          charge: entre(r, 1, 4),
          essais,
          reussis: entier(r, essais + 1),
          paires: Array.from({ length: entre(r, 1, 4) }, () => `${parmi(r, DIMENSIONS)}>${parmi(r, DIMENSIONS)}`),
          seuilMedian: r() < 0.9 ? Number((r() * 6).toFixed(3)) : null,
          secondes: entre(r, 240, 1200),
        });
        idVm += 1;
      }
    }

    /* Sessions de QCM DGFiP, deux par semaine. */
    if (r() < h.qcmParSemaine / 7) {
      const parRubrique = RUBRIQUES_DGFIP.map((rubriqueId) => {
        const posees = entre(r, 4, 10);
        const bonnes = entier(r, posees + 1);
        const mauvaises = entier(r, posees - bonnes + 1);
        return {
          rubriqueId,
          rubrique: rubriqueId,
          posees,
          bonnes,
          mauvaises,
          abstentions: posees - bonnes - mauvaises,
          points: Number((bonnes - mauvaises * 0.5).toFixed(1)),
        };
      });
      const posees = parRubrique.reduce((s, x) => s + x.posees, 0);
      sortie.qcmSessions.push({
        id: idQcm,
        le: horodatage(r, jour),
        posees,
        bonnes: parRubrique.reduce((s, x) => s + x.bonnes, 0),
        mauvaises: parRubrique.reduce((s, x) => s + x.mauvaises, 0),
        abstentions: parRubrique.reduce((s, x) => s + x.abstentions, 0),
        points: Number(parRubrique.reduce((s, x) => s + x.points, 0).toFixed(1)),
        maximum: posees,
        parRubrique,
      });
      idQcm += 1;
    }

    /* Journal d'erreurs : des entrées s'ouvrent, la plupart se referment. */
    for (let k = 0; k < entre(r, 0, h.erreursParJour); k += 1) {
      const genre = parmi(r, ['flashcard', 'quiz', 'dgfip']);
      const ficheId = parmi(r, fiches);
      const fermee = r() < 0.75;
      const erreurs = entre(r, 1, 5);
      sortie.journal.push({
        id: genre === 'dgfip' ? `dgfip-${entier(r, h.questionsDgfip)}` : `${ficheId}:${entier(r, h.cartesParFiche)}`,
        genre,
        matiere: genre === 'dgfip' ? 'QCM DGFiP' : matiereDe.get(ficheId),
        ...(genre === 'dgfip'
          ? { rubriqueId: parmi(r, RUBRIQUES_DGFIP) }
          : { fascicule: `Fascicule ${entre(r, 1, 8)}`, ficheId }),
        ouverteLe: horodatage(r, jour),
        derniereErreurLe: horodatage(r, jour),
        erreurs,
        reussites: fermee ? 2 : entier(r, 2),
        derniereSession: horodatage(r, jour),
        ...(fermee ? { fermeeLe: horodatage(r, jourISO(debut + Math.min(jours - 1, j + entre(r, 1, 60)) * JOUR_MS)) } : {}),
      });
    }

    /* Demandes d'aide à l'IA. */
    for (let k = 0; k < entre(r, 0, h.aidesParJour); k += 1) {
      sortie.aides.push({
        id: idAide,
        le: horodatage(r, jour),
        provenance: parmi(r, ['quiz-cours', 'qcm-dgfip', 'fiche', 'journal', 'cog-training']),
        itemId: parmi(r, cartes),
        matiere: parmi(r, MATIERES),
        intention: parmi(r, ['expliquer', 'reformuler', 'interroger', 'approfondir', 'verifier']),
      });
      idAide += 1;
    }
  }

  return sortie;
}
