/**
 * Le catalogue d'indicateurs et les synthèses.
 *
 * Ce que ces essais protègent, et qu'aucun écran ne dirait :
 *
 * - **`null` et jamais zéro.** « Aucune donnée » et « zéro » sont deux choses
 *   différentes, et les confondre fait passer un domaine non mesuré pour un
 *   domaine délaissé. Chaque indicateur est donc éprouvé sur une fenêtre vide.
 * - **Un indicateur neutre ne reçoit jamais de verdict.** E.3 interdit de
 *   présenter une mesure comme un progrès ou un recul ; l'écart est un fait, le
 *   verdict est une opinion, et les deux ne se rendent pas ensemble.
 * - **Le pivot commande la dégradation.** Un désaccord sur la première source
 *   annule la mesure ; sur une source secondaire, il l'abîme de moitié ; sur une
 *   source étrangère, il ne la touche pas.
 * - **Les périodes sont calendaires et se suivent sans trou ni chevauchement**,
 *   y compris en fin de mois, en fin d'année et sur une année bissextile.
 * - **La couverture de mesure ne se compte pas elle-même** : s'y compter la
 *   ferait monter du seul fait de la mesurer.
 */
import {
  INDICATEURS,
  controlerCatalogue,
  domainesCouverts,
  evaluer,
  evaluerTout,
  indicateur,
  indicateursDuDomaine,
  joursDeLaFenetre,
  type Fenetre,
} from '../src/lib/odyssee/indicateurs';
import {
  JOURS_AU_JOUR,
  JOURS_A_LA_SEMAINE,
  SEUIL_DE_STABILITE,
  comparer,
  periode,
  periodeLibre,
  precedente,
  resolutionDe,
  serieDegradee,
  synthese,
} from '../src/lib/odyssee/syntheses';
import { SEUIL_EXPLOITABLE } from '../src/lib/odyssee/fiabilite';
import { DOMAINES } from '../src/lib/noyau/domaines';
import type { Desaccord } from '../src/lib/odyssee/desaccords';
import type { Fait } from '../src/lib/noyau/faits';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);
const faux = (intitule: string, condition: boolean) => v(intitule, condition, false);
const proche = (intitule: string, obtenu: number, attendu: number, marge = 1e-9) =>
  vrai(`${intitule} (${obtenu})`, Math.abs(obtenu - attendu) <= marge);

/* ── Les faits de référence : une séance d'une heure par jour ───────────── */
let idFait = 0;
const fait = (
  jour: string,
  heure: number,
  minutes: number,
  type = 'revision.seance',
  details?: Record<string, unknown>,
): Fait => {
  idFait += 1;
  const debut = `${jour}T${String(heure).padStart(2, '0')}:00:00.000Z`;
  return {
    id: `fait-${idFait}`,
    branche: 'revisions',
    domaine: type === 'revision.cog-training' ? 'cognition' : 'connaissances',
    type,
    debut,
    fin: new Date(Date.parse(debut) + minutes * 60_000).toISOString(),
    jourLogique: jour,
    valeur: minutes * 60,
    unite: 'secondes',
    source: 'automatique',
    fiabilite: 'confirme',
    proprietaire: 'revisions',
    version: 1,
    ...(details ? { details } : {}),
    modifieLe: debut,
  };
};

const VIDE: Fenetre = {
  de: '2026-10-05',
  a: '2026-10-11',
  aujourdhui: '2026-10-12',
  faits: [],
};

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLe catalogue\x1b[0m');

v(
  'le catalogue ne porte aucun problème',
  controlerCatalogue(DOMAINES.map((d) => d.id)),
  [],
);
v('quinze indicateurs sont déclarés', INDICATEURS.length, 15);
v(
  'dont quatorze mesures et la couverture',
  INDICATEURS.filter((i) => i.id !== 'tr.couverture-mesure').length,
  14,
);
v('cinq pour Cognition', indicateursDuDomaine('cognition').length, 5);
v('six pour Connaissances', indicateursDuDomaine('connaissances').length, 6);
v('quatre transverses', indicateursDuDomaine('transverse').length, 4);
v('trois domaines sont couverts', domainesCouverts(), ['cognition', 'connaissances', 'transverse']);
v('un indicateur inconnu n’existe pas', indicateur('corps.poids'), undefined);
v('un identifiant connu se retrouve', indicateur('tr.serie')?.libelle, 'Série de jours');
vrai(
  'aucun identifiant n’est réutilisé',
  new Set(INDICATEURS.map((i) => i.id)).size === INDICATEURS.length,
);
vrai(
  'chaque formule est une phrase française close',
  INDICATEURS.every((i) => i.formule.endsWith('.') && i.formule.length > 25),
);
vrai(
  'chaque indicateur nomme son pivot en premier',
  INDICATEURS.every((i) => i.sources.length >= 1 && i.sources[0].length > 0),
);
v(
  'aucune cible n’est proposée pour ce qui ne se juge pas',
  INDICATEURS.filter((i) => i.sens === 'neutre' && i.cible !== 'jamais-proposee').map((i) => i.id),
  [],
);
v(
  'et trois indicateurs sont déclarés neutres',
  INDICATEURS.filter((i) => i.sens === 'neutre').map((i) => i.id),
  ['sav.niveau-estime', 'sav.taux-bonnes', 'sav.courbe-oubli'],
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1m« null » et jamais zéro\x1b[0m');

{
  const toutes = evaluerTout(VIDE);
  const mesurees = toutes.filter((e) => e.mesure);
  v(
    'sur une fenêtre vide, seule la couverture de mesure se calcule',
    mesurees.map((e) => e.indicateur.id),
    ['tr.couverture-mesure'],
  );
  v('et elle vaut zéro', mesurees[0].mesure?.valeur, 0);
  vrai(
    'chaque absence dit quelle source manque',
    toutes
      .filter((e) => !e.mesure)
      .every((e) => (e.pourquoi ?? '').includes('Pas de donnée')),
  );
  vrai(
    'et aucune absence ne porte de fiabilité',
    toutes.filter((e) => !e.mesure).every((e) => e.fiabilite === null),
  );
}
{
  /* Des cartes existent, aucune n'est en retard : zéro est alors une mesure. */
  const avecCartes: Fenetre = {
    ...VIDE,
    cartes: [{ retention: 0.95, echeance: '2026-12-01' }],
  };
  const retard = evaluer(indicateur('cog.charge-arrieree')!, avecCartes);
  v('aucune carte due : la mesure vaut zéro, et existe', retard.mesure?.valeur, 0);
  const sans = evaluer(indicateur('cog.charge-arrieree')!, VIDE);
  v('aucun magasin de cartes : pas de mesure du tout', sans.mesure, null);
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes formules\x1b[0m');

const SEMAINE = { de: '2026-10-05', a: '2026-10-11', aujourdhui: '2026-10-11' };
const troisJours = [
  fait('2026-10-05', 9, 60),
  fait('2026-10-07', 9, 30),
  fait('2026-10-09', 9, 90),
];

{
  const f: Fenetre = { ...SEMAINE, faits: troisJours };
  const temps = evaluer(indicateur('cog.temps-revision')!, f);
  v('le temps de révision somme les durées', temps.mesure?.valeur, 180 * 60);
  v('et compte les jours renseignés', temps.mesure?.joursRenseignes, 3);
  const regularite = evaluer(indicateur('cog.regularite-revision')!, f);
  proche('trois jours actifs sur sept', regularite.mesure?.valeur ?? -1, 3 / 7);
  v('l’effectif est le nombre de jours de la fenêtre', regularite.mesure?.effectif, 7);
}
{
  const f: Fenetre = {
    ...SEMAINE,
    faits: [],
    cartes: [
      { retention: 0.95, echeance: '2026-10-20' },
      { retention: 0.9, echeance: '2026-10-20' },
      { retention: 0.6, echeance: '2026-10-01' },
      { retention: 0.2, echeance: '2026-10-02' },
    ],
  };
  const retention = evaluer(indicateur('cog.retention-fsrs')!, f);
  v('la rétention compte les cartes au-dessus de 0,9, bornes incluses', retention.mesure?.valeur, 0.5);
  const retard = evaluer(indicateur('cog.charge-arrieree')!, f);
  v('deux cartes sont échues', retard.mesure?.valeur, 2);
}
{
  const f: Fenetre = {
    ...SEMAINE,
    faits: [fait('2026-10-06', 9, 20, 'revision.cog-training')],
    echelons: { parFamille: { 'Quad N-Back': 4, 'Veridical Mapping': 2 }, sessions: 9 },
  };
  const echelon = evaluer(indicateur('cog.echelon-cog-training')!, f);
  v('l’échelon est la moyenne des familles', echelon.mesure?.valeur, 3);
  v('et le détail nomme chaque famille', echelon.mesure?.parClef, {
    'Quad N-Back': 4,
    'Veridical Mapping': 2,
  });
  v('l’effectif est le nombre de sessions', echelon.mesure?.effectif, 9);
}
{
  const f: Fenetre = {
    ...SEMAINE,
    faits: [],
    programme: { fiches: 400, vues: 100, planifieesADate: 150 },
  };
  v('la couverture du programme est une part', evaluer(indicateur('sav.couverture-programme')!, f).mesure?.valeur, 0.25);
  v('le retard est la différence, jamais négative', evaluer(indicateur('sav.retard-programme')!, f).mesure?.valeur, 50);
  const avance: Fenetre = { ...f, programme: { fiches: 400, vues: 200, planifieesADate: 150 } };
  v('et une avance ne devient pas un retard négatif', evaluer(indicateur('sav.retard-programme')!, avance).mesure?.valeur, 0);
}
{
  const f: Fenetre = {
    ...SEMAINE,
    faits: [],
    niveaux: [
      { matiere: 'Droit public', note: 1300, fiable: true, observations: 40 },
      { matiere: 'Économie', note: 1100, fiable: true, observations: 20 },
      { matiere: 'Questions sociales', note: 800, fiable: false, observations: 2 },
    ],
  };
  const niveau = evaluer(indicateur('sav.niveau-estime')!, f);
  v('le niveau moyen ignore les matières non fiables', niveau.mesure?.valeur, 1200);
  v('et l’effectif est la somme de leurs observations', niveau.mesure?.effectif, 60);
  faux(
    'une matière non fiable n’apparaît pas dans le détail',
    'Questions sociales' in (niveau.mesure?.parClef ?? {}),
  );
}
{
  const f: Fenetre = {
    ...SEMAINE,
    faits: [
      fait('2026-10-05', 9, 20, 'revision.qcm', { bonnes: 8, reponses: 10 }),
      fait('2026-10-06', 9, 20, 'revision.qcm', { bonnes: 6, reponses: 10 }),
      fait('2026-10-07', 9, 20, 'revision.qcm', { reponses: 0 }),
      fait('2026-10-08', 9, 60),
    ],
  };
  const taux = evaluer(indicateur('sav.taux-bonnes')!, f);
  v('le taux agrège bonnes et réponses', taux.mesure?.valeur, 0.7);
  v('l’effectif est le nombre de réponses', taux.mesure?.effectif, 20);
  v('les faits sans réponse sont écartés', taux.mesure?.joursRenseignes, 2);
}
{
  const descend: Fenetre = {
    ...SEMAINE,
    faits: [],
    revisions: [
      { intervalleJours: 1, reussie: true },
      { intervalleJours: 1, reussie: true },
      { intervalleJours: 30, reussie: false },
      { intervalleJours: 30, reussie: false },
    ],
  };
  const pente = evaluer(indicateur('sav.courbe-oubli')!, descend);
  vrai('la pente de l’oubli est négative quand l’intervalle fait rater', (pente.mesure?.valeur ?? 0) < 0);
  const plat: Fenetre = {
    ...SEMAINE,
    faits: [],
    revisions: [
      { intervalleJours: 7, reussie: true },
      { intervalleJours: 7, reussie: false },
    ],
  };
  v('sans variation d’intervalle, aucune pente — et non zéro', evaluer(indicateur('sav.courbe-oubli')!, plat).mesure, null);
  const seul: Fenetre = { ...SEMAINE, faits: [], revisions: [{ intervalleJours: 3, reussie: true }] };
  v('un seul point ne fait pas une droite', evaluer(indicateur('sav.courbe-oubli')!, seul).mesure, null);
}
{
  const f: Fenetre = {
    ...SEMAINE,
    faits: [],
    erreurs: { 'Droit public': 4, Économie: 1 },
  };
  const erreurs = evaluer(indicateur('sav.erreurs-par-matiere')!, f);
  v('les erreurs ouvertes se totalisent', erreurs.mesure?.valeur, 5);
  v('et le détail garde les matières', erreurs.mesure?.parClef, { 'Droit public': 4, Économie: 1 });
  const aucune = evaluer(indicateur('sav.erreurs-par-matiere')!, { ...SEMAINE, faits: [], erreurs: {} });
  v('un journal vide est une mesure à zéro, pas une absence', aucune.mesure?.valeur, 0);
}
{
  const f: Fenetre = {
    ...SEMAINE,
    faits: troisJours,
    activite: {
      parJour: { '2026-10-05': 70, '2026-10-07': 35, '2026-10-09': 105, '2026-10-01': 1000 },
      serieCourante: 3,
      serieRecord: 12,
      niveau: 5,
      xp: 1210,
    },
  };
  v('la série se lit du moteur d’activité', evaluer(indicateur('tr.serie')!, f).mesure?.valeur, 3);
  v('et le record voyage avec elle', evaluer(indicateur('tr.serie')!, f).mesure?.parClef, { record: 12 });
  const xp = evaluer(indicateur('tr.xp-jour')!, f);
  v('l’XP par jour divise par les jours de la fenêtre', xp.mesure?.valeur, 210 / 7);
  v('et les jours hors fenêtre ne comptent pas', xp.mesure?.effectif, 3);
  v('le niveau se lit tel quel', evaluer(indicateur('tr.niveau')!, f).mesure?.valeur, 5);
}
{
  /* La couverture s'exclut du dénominateur : quatorze, pas quinze. */
  const f: Fenetre = { ...SEMAINE, faits: troisJours };
  const couverture = evaluer(indicateur('tr.couverture-mesure')!, f);
  v('la couverture compte sur quatorze indicateurs', couverture.mesure?.parClef?.declares, 14);
  v('deux se calculent avec les seuls faits', couverture.mesure?.parClef?.calculables, 2);
  proche('soit une couverture de 2/14', couverture.mesure?.valeur ?? -1, 2 / 14);
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLa fiabilité, et le pivot qui commande\x1b[0m');

const desaccord = (types: string[]): Desaccord => ({
  regle: 'essai',
  cible: `essai:${types.join('+')}`,
  jour: '2026-10-07',
  gravite: 'bloquant',
  faits: ['a', 'b'],
  types,
  branches: ['revisions'],
  resume: 'Désaccord d’essai.',
});

{
  const base: Fenetre = { ...SEMAINE, faits: troisJours };
  const sans = evaluer(indicateur('cog.temps-revision')!, base);
  v('sans désaccord, l’intégrité est entière', sans.fiabilite?.composantes.integrite, 1);

  const pivot: Fenetre = { ...base, desaccordsOuverts: [desaccord(['revision.seance'])] };
  v('un désaccord sur le pivot annule la mesure', evaluer(indicateur('cog.temps-revision')!, pivot).fiabilite?.valeur, 0);

  const secondaire: Fenetre = { ...base, desaccordsOuverts: [desaccord(['revision.fiche'])] };
  v(
    'un désaccord sur une source secondaire l’abîme de moitié',
    evaluer(indicateur('cog.temps-revision')!, secondaire).fiabilite?.composantes.integrite,
    0.5,
  );

  const etranger: Fenetre = { ...base, desaccordsOuverts: [desaccord(['sport.seance'])] };
  v(
    'un désaccord sur une source étrangère ne la touche pas',
    evaluer(indicateur('cog.temps-revision')!, etranger).fiabilite?.composantes.integrite,
    1,
  );
}
{
  /* Trois cartes contre un minimum de vingt : l'effectif commande. */
  const f: Fenetre = {
    ...SEMAINE,
    faits: [],
    cartes: [
      { retention: 0.95, echeance: '2026-11-01' },
      { retention: 0.5, echeance: '2026-11-01' },
      { retention: 0.5, echeance: '2026-11-01' },
    ],
  };
  const evaluation = evaluer(indicateur('cog.retention-fsrs')!, f);
  v('trois cartes sur vingt attendues : effectif nul', evaluation.fiabilite?.composantes.effectif, 0);
  faux('la mesure n’est donc pas exploitable', evaluation.fiabilite?.exploitable ?? false);
  vrai('mais elle existe quand même', evaluation.mesure !== null);
  vrai('et la raison est dite', (evaluation.fiabilite?.motifs ?? []).length > 0);
}
{
  /* Une mesure dont la dernière donnée est vieille de trois semaines. */
  const f: Fenetre = {
    de: '2026-09-01',
    a: '2026-09-07',
    aujourdhui: '2026-10-12',
    faits: [fait('2026-09-01', 9, 60), fait('2026-09-02', 9, 60)],
  };
  const temps = evaluer(indicateur('cog.temps-revision')!, f);
  v('une donnée d’il y a quarante jours n’a plus de fraîcheur', temps.fiabilite?.composantes.fraicheur, 0);
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes périodes sont calendaires, et se suivent\x1b[0m');

v('la semaine va du lundi au dimanche', periode('semaine', '2026-10-15'), {
  type: 'semaine',
  de: '2026-10-12',
  a: '2026-10-18',
  libelle: 'semaine du 12 octobre 2026',
});
v('un dimanche appartient à la semaine qui précède', periode('semaine', '2026-10-18').de, '2026-10-12');
v('le mois va du premier au dernier jour', periode('mois', '2026-10-15'), {
  type: 'mois',
  de: '2026-10-01',
  a: '2026-10-31',
  libelle: 'octobre 2026',
});
v('février 2028 compte vingt-neuf jours', periode('mois', '2028-02-15').a, '2028-02-29');
v('le trimestre est un bloc de trois mois', periode('trimestre', '2026-10-15'), {
  type: 'trimestre',
  de: '2026-10-01',
  a: '2026-12-31',
  libelle: '4ᵉ trimestre 2026',
});
v('le premier trimestre est le premier', periode('trimestre', '2026-02-02').libelle, '1ᵉ trimestre 2026');
v('l’année est l’année civile', periode('annee', '2026-07-01'), {
  type: 'annee',
  de: '2026-01-01',
  a: '2026-12-31',
  libelle: 'année 2026',
});
v('la précédente d’une semaine est la semaine d’avant', precedente(periode('semaine', '2026-10-15')).de, '2026-10-05');
v('celle d’un mois, le mois d’avant', precedente(periode('mois', '2026-01-15')), {
  type: 'mois',
  de: '2025-12-01',
  a: '2025-12-31',
  libelle: 'décembre 2025',
});
v('celle d’une année, l’année d’avant', precedente(periode('annee', '2026-03-03')).de, '2025-01-01');
{
  const courante = periode('mois', '2026-10-15');
  const avant = precedente(courante);
  v('les périodes se suivent sans trou', joursDeLaFenetre(avant.a, courante.de).length, 2);
  vrai('et sans chevauchement', avant.a < courante.de);
}
{
  const libre = periodeLibre('2026-10-05', '2026-10-11');
  v('une période libre garde ses bornes', [libre.de, libre.a], ['2026-10-05', '2026-10-11']);
  v('et sa précédente a la même durée', precedente(libre), {
    type: 'libre',
    de: '2026-09-28',
    a: '2026-10-04',
    libelle: 'du 28 septembre 2026 au 4 octobre 2026',
  });
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLa synthèse\x1b[0m');

const p = periodeLibre('2026-10-05', '2026-10-11');
const fenetrePleine: Fenetre = {
  de: p.de,
  a: p.a,
  aujourdhui: '2026-10-11',
  faits: troisJours,
  cartes: Array.from({ length: 30 }, (_, i) => ({
    retention: i < 20 ? 0.95 : 0.4,
    echeance: i < 5 ? '2026-10-01' : '2026-12-01',
  })),
  activite: {
    parJour: { '2026-10-05': 70, '2026-10-07': 35, '2026-10-09': 105 },
    serieCourante: 3,
    serieRecord: 12,
    niveau: 5,
    xp: 1210,
  },
};

{
  const vue = synthese(p, fenetrePleine);
  v('la synthèse porte les quinze indicateurs', vue.evaluations.length, 15);
  /*
     Huit mesures : trois des faits, deux des cartes, trois de l'activité, plus
     la couverture — qui, elle, se calcule toujours.
  */
  v('huit rendent une mesure', vue.evaluations.filter((e) => e.mesure).length, 8);
  proche('la couverture est de 8 sur 15', vue.couverture, 8 / 15);
  v('et les sept manques sont nommés', vue.manques.length, 7);
  vrai(
    'chaque manque dit quelle source attendre',
    vue.manques.every((m) => m.pourquoi.includes('Pas de donnée')),
  );
  v('la couverture est détaillée par domaine', vue.parDomaine.length, 3);
  const cognition = vue.parDomaine.find((d) => d.domaine === 'cognition');
  v('Cognition déclare cinq indicateurs', cognition?.declares, 5);
  v('et en mesure quatre', cognition?.mesures, 4);
  vrai(
    'les exploitables ne dépassent jamais les mesurés',
    vue.parDomaine.every((d) => d.exploitables <= d.mesures),
  );
}
{
  const transversale = synthese(p, fenetrePleine, { quoi: 'transversale' });
  v('une synthèse transversale ne garde que les transverses', transversale.evaluations.length, 4);
  const domaine = synthese(p, fenetrePleine, { quoi: 'domaine', domaine: 'connaissances' });
  v('une synthèse de domaine ne garde que lui', domaine.evaluations.length, 6);
  v('et sa couverture est la sienne', domaine.couverture, 0);
}
{
  let refus = '';
  try {
    synthese(periodeLibre('2026-09-01', '2026-09-30'), fenetrePleine);
  } catch (erreur) {
    refus = (erreur as Error).message;
  }
  vrai('une fenêtre qui ne couvre pas la période est refusée', refus.includes('ne couvre pas'));
  vrai('et le refus dit les deux bornes', refus.includes('2026-09-01') && refus.includes('2026-10-05'));
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mComparer, sans juger ce qui ne se juge pas\x1b[0m');

{
  const avantFenetre: Fenetre = {
    ...fenetrePleine,
    de: '2026-09-28',
    a: '2026-10-04',
    faits: [fait('2026-09-28', 9, 30), fait('2026-09-29', 9, 30)],
    activite: { ...fenetrePleine.activite!, parJour: { '2026-09-28': 35, '2026-09-29': 35 } },
    niveaux: [{ matiere: 'Droit public', note: 1300, fiable: true, observations: 40 }],
  };
  const courantePlus: Fenetre = {
    ...fenetrePleine,
    niveaux: [{ matiere: 'Droit public', note: 1100, fiable: true, observations: 50 }],
  };
  const avant = synthese(periodeLibre('2026-09-28', '2026-10-04'), avantFenetre);
  const apres = synthese(p, courantePlus);
  const comparaisons = comparer(apres, avant);
  const par = new Map(comparaisons.map((c) => [c.indicateur, c]));

  v('le temps de révision a monté, et c’est mieux', par.get('cog.temps-revision')?.verdict, 'mieux');
  v('l’écart est rendu en clair', par.get('cog.temps-revision')?.ecart, 120 * 60);
  v(
    'le niveau estimé a baissé, et ne reçoit aucun verdict',
    par.get('sav.niveau-estime')?.verdict,
    'aucun',
  );
  v('mais son écart est bien là', par.get('sav.niveau-estime')?.ecart, -200);
  v(
    'un indicateur absent des deux côtés n’est pas jugé',
    par.get('sav.courbe-oubli')?.verdict,
    'aucun',
  );
  v('et son écart est nul au sens de « inconnu »', par.get('sav.courbe-oubli')?.ecart, null);
  vrai(
    'aucun indicateur neutre ne reçoit « mieux » ou « moins bien »',
    comparaisons
      .filter((c) => INDICATEURS.find((i) => i.id === c.indicateur)?.sens === 'neutre')
      .every((c) => c.verdict === 'aucun'),
  );
}
{
  /* Un indicateur « bas-mieux » qui descend s'améliore. */
  const base = { ...fenetrePleine, programme: { fiches: 100, vues: 50, planifieesADate: 80 } };
  const mieux = { ...fenetrePleine, programme: { fiches: 100, vues: 70, planifieesADate: 80 } };
  const comparaisons = comparer(
    synthese(p, mieux),
    synthese(periodeLibre(p.de, p.a), base),
  );
  const retard = comparaisons.find((c) => c.indicateur === 'sav.retard-programme');
  v('un retard qui diminue est un progrès', retard?.verdict, 'mieux');
  v('et l’écart est négatif', retard?.ecart, -20);
}
{
  const presquePareil = {
    ...fenetrePleine,
    faits: [fait('2026-10-05', 9, 60), fait('2026-10-07', 9, 30), fait('2026-10-09', 9, 91)],
  };
  const comparaisons = comparer(
    synthese(p, presquePareil),
    synthese(periodeLibre(p.de, p.a), fenetrePleine),
  );
  v('une variation sous le seuil se dit « stable »', comparaisons.find((c) => c.indicateur === 'cog.temps-revision')?.verdict, 'stable');
}
v('le seuil de stabilité est déclaré', SEUIL_DE_STABILITE, 0.05);
v('et celui d’exploitabilité vient de la fiabilité', SEUIL_EXPLOITABLE, 0.5);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes séries, à résolution dégradée\x1b[0m');

v('les bornes sont déclarées', [JOURS_AU_JOUR, JOURS_A_LA_SEMAINE], [30, 365]);
v('hier reste au jour', resolutionDe('2026-10-11', '2026-10-12'), 'jour');
v('il y a trente jours aussi', resolutionDe('2026-09-12', '2026-10-12'), 'jour');
v('il y a trente et un jours, à la semaine', resolutionDe('2026-09-11', '2026-10-12'), 'semaine');
v('il y a un an, encore à la semaine', resolutionDe('2025-10-12', '2026-10-12'), 'semaine');
v('au-delà, au mois', resolutionDe('2025-10-11', '2026-10-12'), 'mois');

{
  const points = [
    { jour: '2026-10-10', valeur: 10 },
    { jour: '2026-10-11', valeur: 20 },
    // Même semaine logique, à plus de trente jours : fondus ensemble.
    { jour: '2026-09-07', valeur: 2 },
    { jour: '2026-09-08', valeur: 4 },
    // Même mois, à plus d'un an : fondus aussi.
    { jour: '2024-03-04', valeur: 6 },
    { jour: '2024-03-20', valeur: 8 },
  ];
  const degradee = serieDegradee(points, '2026-10-12');
  v('six points deviennent quatre pas', degradee.length, 4);
  v('et ils sont triés', degradee.map((x) => x.jour), ['2024-03-01', '2026-09-07', '2026-10-10', '2026-10-11']);
  v('le pas mensuel porte la moyenne, pas la somme', degradee[0].valeur, 7);
  v('et il dit combien de points il a fondus', degradee[0].points, 2);
  v('le pas hebdomadaire commence au lundi', degradee[1].jour, '2026-09-07');
  v('sa valeur est la moyenne', degradee[1].valeur, 3);
  v('les jours récents restent entiers', [degradee[2].valeur, degradee[3].valeur], [10, 20]);
  v('et portent leur résolution', degradee[2].resolution, 'jour');
}
v('une série vide reste vide', serieDegradee([], '2026-10-12'), []);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
