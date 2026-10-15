/**
 * Le noyau de Sport : la force, le volume, et le garde-fou.
 *
 * Trois choses se vérifient ici, et la troisième est la seule qui ne se
 * négocie pas :
 *
 * - **la charge maximale estimée est juste sur des cas connus**, calculés à la
 *   main — une formule fausse ne se voit pas, elle produit des nombres
 *   plausibles ;
 * - **l'identité de comparaison sépare ce qui doit l'être** : deux équipements
 *   différents ne partagent pas une progression ;
 * - **aucune proposition de progresser en présence d'une douleur déclarée**.
 *   Le contrôle l'éprouve sur un cas où toutes les autres règles voudraient
 *   proposer de monter, sans quoi il ne prouverait rien.
 */
import {
  COEFFICIENT_SECONDAIRE,
  MUSCLES,
  controlerExercice,
  controlerSerie,
  identiteDeComparaison,
  musclesEmpeches,
  volumeParMuscle,
  type Blessure,
  type Exercice,
  type Serie,
} from '../src/lib/sport/modele';
import {
  PROGRES_MINIMAL,
  REPETITIONS_FIABLES,
  SEANCES_POUR_UN_PLATEAU,
  courbeDeForce,
  doublons,
  maximumEstime,
  plateau,
  type PointDeForce,
} from '../src/lib/sport/force';
import { BIBLIOTHEQUE } from '../src/lib/sport/donnees';
import {
  TOLERANCE,
  comparerVolumes,
  controlerProgramme,
  musclesAbsents,
  volumePrevu,
  type Programme,
} from '../src/lib/sport/programmes';
import {
  ETATS,
  FORMES,
  SILHOUETTE,
  controlerSchema,
  etatSuivant,
  miroir,
  musclesDeLaFace,
} from '../src/lib/sport/schema-corps';
import { projeterFaitsSport } from '../src/lib/sport/faits-sport';
import type { Seance } from '../src/lib/sport/modele';
import {
  SEANCES_MINIMALES,
  controlerGardeFou,
  proposer,
  refuser,
} from '../src/lib/sport/modulation';

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

const exercice = (p: Partial<Exercice> = {}): Exercice => ({
  id: 'X',
  nom: 'Développé couché',
  nature: 'force',
  lateralite: 'bilateral',
  equipement: 'barre',
  variante: '',
  unite: 'kg',
  principaux: ['pectoraux'],
  secondaires: ['triceps', 'deltoide-anterieur'],
  fourni: false,
  majLe: '2026-10-01T00:00:00.000Z',
  ...p,
});

const serie = (p: Partial<Serie> = {}): Serie => ({
  exerciceId: 'X',
  charge: 80,
  repetitions: 8,
  echec: false,
  reserve: 2,
  repos: 120,
  le: '2026-10-09T10:00:00.000Z',
  ...p,
});

const point = (jour: string, estime: number, p: Partial<PointDeForce> = {}): PointDeForce => ({
  jour,
  estime,
  charge: estime * 0.8,
  repetitions: 8,
  imprecis: false,
  phase: null,
  ...p,
});

/* ════════════════════════════════════════════════════════════════════════
   1. La charge maximale estimée, sur des cas calculés à la main
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA CHARGE MAXIMALE ESTIMÉE');

{
  /*
     100 kg × 5 répétitions.
     Epley   : 100 × (1 + 5/30)  = 116,666… → 116,7
     Brzycki : 100 × 36 / (37−5) = 112,5
     Moyenne : 114,583…          → 114,6
  */
  const e = maximumEstime(100, 5)!;
  v('Epley sur 100 kg × 5', e.epley, 116.7);
  v('Brzycki sur 100 kg × 5', e.brzycki, 112.5);
  v('et la moyenne affichée', e.estime, 114.6);
  faux('cinq répétitions restent fiables', e.imprecis);
}
{
  /*
     60 kg × 10.
     Epley   : 60 × (1 + 10/30)   = 80
     Brzycki : 60 × 36 / (37−10)  = 80
     Les deux formules coïncident exactement à dix répétitions — c'est une
     propriété connue, et c'est un bon contrôle : si l'une des deux est mal
     écrite, l'égalité tombe.
  */
  const e = maximumEstime(60, 10)!;
  v('à dix répétitions les deux formules coïncident', [e.epley, e.brzycki], [80, 80]);
  v('et l’écart est nul', e.ecart, 0);
  faux('dix est encore dans la plage fiable', e.imprecis);
}
{
  const e = maximumEstime(50, 15)!;
  vrai('au-delà de dix, l’imprécision est signalée', e.imprecis);
  // Brzycki part plus haut qu'Epley à partir de dix : l'écart se creuse.
  vrai('et les deux formules divergent', e.ecart > 0.05);
}
v('une répétition est le maximum, sans écart', maximumEstime(140, 1), {
  epley: 140,
  brzycki: 140,
  estime: 140,
  ecart: 0,
  imprecis: false,
});
v('sans charge, rien n’est estimé', maximumEstime(null, 8), null);
v('à zéro répétition non plus', maximumEstime(100, 0), null);
/*
   Brzycki s'annule à 37 : au-delà de 36, on ne rend rien plutôt qu'un nombre
   délirant ou une division par zéro.
*/
v('et au-delà de trente-six répétitions, on se tait', maximumEstime(20, 40), null);
v('le seuil de fiabilité est bien dix', REPETITIONS_FIABLES, 10);

/* ════════════════════════════════════════════════════════════════════════
   2. L'identité de comparaison
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nCE QUI SE COMPARE, ET CE QUI NE SE COMPARE PAS');

v(
  'l’identité est normalisée : accents, casse, espaces',
  identiteDeComparaison({ nom: '  Développé  Couché ', equipement: 'BARRE', variante: '' }),
  identiteDeComparaison({ nom: 'developpe couche', equipement: 'barre', variante: '' }),
);
/*
   Deux équipements différents sont deux exercices. Changer d'équipement
   repart de zéro pour le suivi, et c'est juste : un record au Smith machine
   n'est pas un record à la barre libre.
*/
vrai(
  'l’équipement sépare',
  identiteDeComparaison({ nom: 'Développé couché', equipement: 'barre', variante: '' }) !==
    identiteDeComparaison({ nom: 'Développé couché', equipement: 'haltères', variante: '' }),
);
vrai(
  'la variante aussi',
  identiteDeComparaison({ nom: 'Développé couché', equipement: 'barre', variante: 'incliné' }) !==
    identiteDeComparaison({ nom: 'Développé couché', equipement: 'barre', variante: '' }),
);

{
  const liste = [
    exercice({ id: 'A' }),
    exercice({ id: 'B', nom: 'DÉVELOPPÉ COUCHÉ' }),
    exercice({ id: 'C', equipement: 'haltères' }),
  ];
  v(
    'deux saisies du même exercice sont signalées',
    doublons(liste).map((p) => p.map((e) => e.id)),
    [['A', 'B']],
  );
}

/* ════════════════════════════════════════════════════════════════════════
   3. Le volume, et son coefficient conservé
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE VOLUME GARDE SON COEFFICIENT');

{
  const vol = volumeParMuscle([serie(), serie(), serie()], [exercice()]);
  v('trois séries font trois séries sur le muscle principal', vol.series.pectoraux, 3);
  // 3 × 0,5 : les secondaires comptent pour une fraction.
  v('et une et demie sur chaque secondaire', vol.series.triceps, 1.5);
  /*
     Le coefficient voyage avec le résultat. Sans lui, un volume lu six mois
     plus tard serait ininterprétable : « douze séries » sans savoir si les
     secondaires y pèsent une demie ou un tiers.
  */
  v('le coefficient est conservé avec le calcul', vol.coefficient, COEFFICIENT_SECONDAIRE);
  const autre = volumeParMuscle([serie(), serie(), serie()], [exercice()], 0.3);
  v('un autre coefficient donne un autre volume', autre.series.triceps, 0.9);
  v('et il est dit', autre.coefficient, 0.3);
}
v(
  'une série sur un exercice inconnu ne compte nulle part',
  volumeParMuscle([serie({ exerciceId: 'INCONNU' })], [exercice()]).series,
  {},
);

/* ════════════════════════════════════════════════════════════════════════
   4. Les contrôles de forme
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES CONTRÔLES');

v('un exercice bien formé ne pose rien', controlerExercice(exercice()), []);
v(
  'un exercice sans muscle principal est refusé',
  controlerExercice(exercice({ principaux: [] })),
  ['Un exercice sollicite au moins un muscle principal.'],
);
/*
   Un muscle principal **et** secondaire compterait deux fois dans le volume,
   une fois plein et une fois réduit : le genre d'erreur qui gonfle un chiffre
   sans jamais se voir.
*/
v(
  'un muscle à la fois principal et secondaire est refusé',
  controlerExercice(exercice({ secondaires: ['pectoraux'] })).length,
  1,
);
v('un muscle inconnu est refusé', controlerExercice(exercice({ principaux: ['foie'] })).length, 1);

v('une série bien formée ne pose rien', controlerSerie(serie()), []);
/*
   Échec et réserve non nulle sont contradictoires : si l'on aurait pu en faire
   deux de plus, on n'a pas atteint l'échec. La contradiction fausserait toute
   estimation, qui s'appuie sur l'un ou sur l'autre.
*/
v(
  'échec et réserve ensemble sont refusés',
  controlerSerie(serie({ echec: true, reserve: 2 })),
  ['Une série menée à l’échec n’a pas de répétitions en réserve.'],
);
v('échec avec zéro en réserve passe', controlerSerie(serie({ echec: true, reserve: 0 })), []);
v('les dix-huit muscles sont déclarés', MUSCLES.length, 18);

/* ════════════════════════════════════════════════════════════════════════
   5. La courbe, les phases, le plateau
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA COURBE ET LE PLATEAU');

{
  const seances = [
    { jour: '2026-10-01', series: [serie({ charge: 70 }), serie({ charge: 80 })] },
    { jour: '2026-10-05', series: [serie({ charge: 82.5 })] },
  ];
  const courbe = courbeDeForce('X', seances);
  /*
     Un point par jour, et c'est la **meilleure** série du jour : tracer
     chacune ferait un nuage où l'échauffement voisinerait la série lourde.
  */
  v('un point par jour', courbe.length, 2);
  v('et c’est la meilleure série du jour', courbe[0].charge, 80);
  vrai('les points sont triés', courbe[0].jour < courbe[1].jour);
}
{
  const phases = [
    { id: 'P1', type: 'seche' as const, debut: '2026-10-01T00:00:00.000Z', fin: '2026-10-03T00:00:00.000Z', note: '', majLe: '' },
    { id: 'P2', type: 'prise-de-masse' as const, debut: '2026-10-04T00:00:00.000Z', fin: null, note: '', majLe: '' },
  ];
  const seances = [
    { jour: '2026-10-02', series: [serie({ charge: 70 })] },
    { jour: '2026-10-06', series: [serie({ charge: 90 })] },
  ];
  const toute = courbeDeForce('X', seances, { phases });
  v('chaque point porte sa phase', toute.map((p) => p.phase), ['seche', 'prise-de-masse']);
  /*
     Le filtre « périodes comparables » : sans lui, toute sèche ressemble à un
     échec et toute prise de masse à un progrès.
  */
  const filtre = courbeDeForce('X', seances, { phases, phasesRetenues: ['prise-de-masse'] });
  v('le filtre ne garde que les périodes comparables', filtre.map((p) => p.jour), ['2026-10-06']);
}

{
  const stable = ['2026-10-01', '2026-10-05', '2026-10-09', '2026-10-13', '2026-10-17'].map((j) =>
    point(j, 100),
  );
  const p = plateau(stable);
  vrai('quatre séances sans dépasser font un plateau', p.atteint);
  v('et il dit combien', p.seances, SEANCES_POUR_UN_PLATEAU);
}
{
  const court = ['2026-10-01', '2026-10-05', '2026-10-09'].map((j) => point(j, 100));
  const p = plateau(court);
  faux('trois points ne suffisent pas à conclure', p.atteint);
  v('et on dit pourquoi', p.pourquoiPas, 'assez-de-points');
}
{
  const monte = [
    point('2026-10-01', 100),
    point('2026-10-05', 100),
    point('2026-10-09', 100),
    point('2026-10-13', 100),
    point('2026-10-17', 110),
  ];
  faux('un progrès récent rompt le plateau', plateau(monte).atteint);
}
{
  /*
     101,5 après 100, c'est 1,5 % : sous le seuil de 2 %. Une estimation portée
     par une formule approchée ne distingue pas cela d'un jour de forme.
  */
  const bruit = [
    point('2026-10-01', 100),
    point('2026-10-05', 100.5),
    point('2026-10-09', 101),
    point('2026-10-13', 101.2),
    point('2026-10-17', 101.5),
  ];
  vrai('un progrès sous le seuil reste un plateau', plateau(bruit).atteint);
  v('le seuil est bien de 2 %', PROGRES_MINIMAL, 0.02);
}

/* ════════════════════════════════════════════════════════════════════════
   6. Le garde-fou, qui ne se négocie pas
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nAUCUNE PROGRESSION PROPOSÉE SUR UNE DOULEUR DÉCLARÉE');

v('le contrôle du garde-fou ne trouve rien', controlerGardeFou(), []);

const AUJOURDHUI = '2026-10-10';
const MAINTENANT = new Date('2026-10-10T10:00:00.000Z');
const POINTS = ['2026-10-01', '2026-10-05', '2026-10-09'].map((j) => point(j, 100, { charge: 80 }));
const FACILES = [serie({ reserve: 3 }), serie({ reserve: 2 })];

const blessure = (p: Partial<Blessure> = {}): Blessure => ({
  id: 'B',
  muscles: ['pectoraux'],
  intensite: 5,
  debut: '2026-10-09T00:00:00.000Z',
  fin: null,
  note: '',
  majLe: '2026-10-09T00:00:00.000Z',
  ...p,
});

const cas = (p: Partial<Parameters<typeof proposer>[0]> = {}) =>
  proposer({
    exercice: exercice(),
    points: POINTS,
    dernieresSeries: FACILES,
    blessures: [],
    refus: [],
    aujourdhui: AUJOURDHUI,
    maintenant: MAINTENANT,
    ...p,
  });

v('sans douleur, ce cas propose de monter', cas().proposition?.sorte, 'monter');
v('et la charge suggérée est de 2,5 kg de plus', cas().proposition?.charge, 82.5);

v(
  'une douleur sur le muscle principal interdit la montée',
  cas({ blessures: [blessure()] }).proposition?.sorte,
  'reduire',
);
/*
   Un muscle **secondaire** suffit : le triceps travaille au développé couché,
   et proposer de monter la charge est proposer de le solliciter plus.
*/
v(
  'une douleur sur un secondaire aussi',
  cas({ blessures: [blessure({ muscles: ['triceps'] })] }).proposition?.sorte,
  'reduire',
);
/*
   Une blessure sans muscle est **générale** : grippe, fatigue extrême. La
   traiter comme « aucun muscle concerné » laisserait proposer une progression
   le jour où l'on est au lit.
*/
v(
  'une gêne générale couvre tout',
  cas({ blessures: [blessure({ muscles: [] })] }).proposition?.sorte,
  'reduire',
);
v(
  'une douleur refermée ne bloque plus',
  cas({ blessures: [blessure({ fin: '2026-10-09T18:00:00.000Z' })] }).proposition?.sorte,
  'monter',
);
v(
  'une douleur de plus de deux semaines invite à consulter',
  cas({ blessures: [blessure({ debut: '2026-09-20T00:00:00.000Z' })] }).proposition?.sorte,
  'consulter',
);

/* ════════════════════════════════════════════════════════════════════════
   7. Le refus, et l'absence de mémoire de désobéissance
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nSPORT PROPOSE, LA PERSONNE DISPOSE');

{
  const r = refuser('X', 'monter', AUJOURDHUI, 80);
  v('un refus porte une date de fin', r.jusquAu, '2026-10-31');
  const apres = cas({ refus: [r] });
  v('et la proposition se tait', apres.proposition, null);
  v('en disant pour combien de temps', apres.silence?.pourquoi, 'refus-recent');
  vrai('avec les jours restants', (apres.silence?.joursRestants ?? 0) > 0);
}
{
  /*
     L'exception au silence : la charge réelle a dépassé celle du refus. La
     personne a progressé d'elle-même, et se taire reviendrait à ignorer ce qui
     a eu lieu. On ne lui dit **pas** qu'elle avait refusé — c'est précisément
     ce que « aucune mémoire de désobéissance » interdit.
  */
  const r = refuser('X', 'monter', AUJOURDHUI, 80);
  const monte = POINTS.map((p) => ({ ...p, charge: 90 }));
  const apres = cas({ refus: [r], points: monte });
  v('mais un progrès réel rouvre la parole', apres.proposition?.sorte, 'monter');
  faux(
    'et rien ne mentionne le refus',
    (apres.proposition?.parceQue ?? '').toLowerCase().includes('refus'),
  );
}
{
  const r = refuser('AUTRE', 'monter', AUJOURDHUI, 80);
  v('un refus sur un autre exercice ne fait rien taire', cas({ refus: [r] }).proposition?.sorte, 'monter');
}

/* ════════════════════════════════════════════════════════════════════════
   8. Quand Sport n'a rien à dire, il le dit
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nET QUAND IL N’A RIEN À DIRE');

v(
  'trop peu de séances : aucune proposition',
  cas({ points: POINTS.slice(0, 2) }).silence?.pourquoi,
  'pas-assez-de-seances',
);
v('le seuil est de trois séances', SEANCES_MINIMALES, 3);
{
  // Des séries dures, aucun plateau : rien à dire, et c'est une réponse.
  const dures = [serie({ reserve: 0, echec: true }), serie({ reserve: 1 })];
  const r = cas({ dernieresSeries: dures });
  v('des séries dures n’appellent pas de montée', r.proposition, null);
  v('et le silence est motivé', r.silence?.pourquoi, 'rien-a-dire');
}
{
  /*
     Un plateau n'appelle pas à forcer. Insister plus fort sur ce qui ne
     progresse plus est la réaction la plus naturelle et la moins efficace.
  */
  const stable = ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07', '2026-10-09'].map((j) =>
    point(j, 100, { charge: 80 }),
  );
  const r = cas({ points: stable, dernieresSeries: [serie({ reserve: 0, echec: true })] });
  v('un plateau propose de varier, pas de forcer', r.proposition?.sorte, 'varier');
}

/* ════════════════════════════════════════════════════════════════════════
   9. La projection de faits
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nSPORT PUBLIE CE QUI A EU LIEU');

const seance = (p: Partial<Seance> = {}): Seance => ({
  id: 'S1',
  jour: '2026-10-09',
  debut: '2026-10-09T10:00:00.000Z',
  fin: '2026-10-09T11:00:00.000Z',
  statut: 'terminee',
  series: [serie()],
  difficulte: 7,
  note: '',
  programmeId: null,
  majLe: '2026-10-09T11:00:00.000Z',
  ...p,
});

const videSport = { seances: [], exercices: [exercice()], phases: [], blessures: [] };

{
  const { faits, refuses } = projeterFaitsSport({
    ...videSport,
    seances: [seance(), seance({ id: 'S2', statut: 'en-cours', fin: null })],
  });
  v('aucun fait refusé par le contrat', refuses, []);
  /*
     Une séance en cours n'a pas de durée : la publier compterait un temps qui
     n'est pas encore passé.
  */
  v(
    'la séance en cours n’est pas publiée',
    faits.filter((f) => f.type === 'sport.seance').map((f) => f.id),
    ['sport.seance:S1'],
  );
  const laSeance = faits.find((f) => f.type === 'sport.seance')!;
  v('sa durée est celle écoulée', laSeance.valeur, 3600);
  v('et elle dit quels muscles ont travaillé', laSeance.details?.muscles, ['pectoraux']);
}

{
  const deux = seance({ series: [serie({ charge: 80 }), serie({ charge: 85 })] });
  const { faits } = projeterFaitsSport({ ...videSport, seances: [deux] });
  const series = faits.filter((f) => f.type === 'sport.serie');
  v('chaque série fait un fait', series.length, 2);
  /*
     Le rang est dans l'identifiant : deux séries identiques du même exercice
     le même jour sont deux faits distincts, et un identifiant qui les
     confondrait en perdrait une.
  */
  v('et son identifiant porte son rang', series.map((f) => f.id), [
    'sport.serie:S1:0',
    'sport.serie:S1:1',
  ]);
  // La charge, pas le tonnage : le tonnage mélange des exercices incomparables.
  v('la valeur est la charge', series[1].valeur, 85);
  v('et les répétitions sont dans les détails', series[0].details?.repetitions, 8);
}

{
  /*
     Un record republié à chaque séance ne serait plus un record : ce serait la
     meilleure série du jour, déjà présente dans les faits « sport.serie ».
  */
  const seances = [
    seance({ id: 'A', jour: '2026-10-01', debut: '2026-10-01T10:00:00.000Z', fin: '2026-10-01T11:00:00.000Z', series: [serie({ charge: 80, le: '2026-10-01T10:30:00.000Z' })] }),
    seance({ id: 'B', jour: '2026-10-05', debut: '2026-10-05T10:00:00.000Z', fin: '2026-10-05T11:00:00.000Z', series: [serie({ charge: 80, le: '2026-10-05T10:30:00.000Z' })] }),
    seance({ id: 'C', jour: '2026-10-09', debut: '2026-10-09T10:00:00.000Z', fin: '2026-10-09T11:00:00.000Z', series: [serie({ charge: 90, le: '2026-10-09T10:30:00.000Z' })] }),
  ];
  const { faits } = projeterFaitsSport({ ...videSport, seances });
  const records = faits.filter((f) => f.type === 'sport.record');
  v('un record n’est publié qu’au dépassement', records.length, 2);
  v('le premier, puis celui qui le bat', records.map((f) => f.id), [
    'sport.record:A:X',
    'sport.record:C:X',
  ]);
  /*
     « estime » : un maximum calculé par Epley et Brzycki n'a pas été soulevé.
     Le marquer confirmé ferait passer une formule pour une mesure.
  */
  v('et un record estimé reste estimé', records[0].fiabilite, 'estime');
}

{
  const { faits } = projeterFaitsSport({
    ...videSport,
    blessures: [
      {
        id: 'B1',
        muscles: ['pectoraux'],
        intensite: 6,
        debut: '2026-10-08T00:00:00.000Z',
        fin: null,
        note: '',
        majLe: '2026-10-08T00:00:00.000Z',
      },
    ],
  });
  /*
     Une blessure ouverte est publiée : non publiée, elle disparaîtrait des
     synthèses au moment même où elle explique tout le reste.
  */
  const b = faits.find((f) => f.type === 'sport.blessure')!;
  v('une blessure ouverte est publiée', b.details?.ouverte, true);
  v('et elle nomme les muscles', b.valeur, 'pectoraux');
}

{
  const contenu = { ...videSport, seances: [seance()] };
  v(
    'deux projections rendent la même chose',
    JSON.stringify(projeterFaitsSport(contenu).faits),
    JSON.stringify(projeterFaitsSport(contenu).faits),
  );
}

{
  const sansExercice = projeterFaitsSport({ ...videSport, exercices: [], seances: [seance()] });
  /*
     Le fait est cherché par son type et non par son rang : les faits sont
     triés par identifiant, et « sport.record » passe avant « sport.seance ».
     Un essai qui prend le premier mesure l'ordre du tri, pas la règle.
  */
  const laSeance = sansExercice.faits.find((f) => f.type === 'sport.seance');
  vrai('une séance dont l’exercice manque reste publiée', laSeance !== undefined);
  v('mais elle ne nomme aucun muscle', laSeance?.details?.muscles, []);
}

/* ════════════════════════════════════════════════════════════════════════
   10. La bibliothèque livrée
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA BIBLIOTHÈQUE LIVRÉE');

v('trente et un exercices sont livrés', BIBLIOTHEQUE.length, 31);
{
  const problemes = BIBLIOTHEQUE.flatMap((livre, rang) =>
    controlerExercice({ ...livre, id: `L${rang}`, fourni: true, majLe: '' }).map(
      (p) => `${livre.nom} : ${p}`,
    ),
  );
  v('et aucun ne pose de problème de forme', problemes, []);
}
{
  /*
     La bibliothèque doit couvrir les dix-huit muscles : un muscle du schéma
     qu'aucun exercice livré ne sollicite serait une case du corps sur
     laquelle on ne peut rien noter sans créer d'abord son exercice.
  */
  const couverts = new Set(BIBLIOTHEQUE.flatMap((e) => [...e.principaux, ...e.secondaires]));
  const manquants = MUSCLES.filter((m) => !couverts.has(m.id)).map((m) => m.id);
  v('les dix-huit muscles sont couverts', manquants, []);
}
{
  const identites = BIBLIOTHEQUE.map(identiteDeComparaison);
  v('et aucun doublon d’identité', identites.length - new Set(identites).size, 0);
}

/* ════════════════════════════════════════════════════════════════════════
   11. Le schéma du corps
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE SCHÉMA DU CORPS COUVRE LE MODÈLE');

v('le schéma ne pose aucun problème', controlerSchema(), []);

/*
   LA FORME DU SCHÉMA — décision 1 du 14 octobre 2026.

   Il y en avait deux, et cinq contrôles comparaient leurs tracés : que le
   défaut soit la simplifiée, qu'aucun muscle n'ait le même dessin des deux
   côtés, que les silhouettes diffèrent, que la complète porte des
   sous-chemins. La forme complète est retirée : ces contrôles n'ont plus de
   second terme, et les garder en les adaptant reviendrait à comparer un jeu
   avec lui-même.

   Ce qui les remplace est ce qui reste vrai et vérifiable : il n'y a QU'UNE
   forme, publiée sous deux noms stables, et elle est complète au sens où
   chaque muscle déclaré y est dessiné. Le reste — boîtes, débordements,
   réciprocité du reflet — est déjà couvert par `controlerSchema()` ci-dessus.
*/
{
  const sansForme = MUSCLES.filter((m) => !(FORMES[m.id] ?? []).length).map((m) => m.id);
  v('chaque muscle déclaré est dessiné', sansForme, []);
  v('la silhouette a ses pièces', SILHOUETTE.length > 0, true);
}

/* Le reflet, éprouvé sur des cas écrits à la main plutôt que sur les données
   du schéma : un contrôle qui ne s'exerce que sur ce qu'il garde finit par
   épouser ses défauts. */
v('le reflet renvoie l’abscisse autour de l’axe', miroir('M 10 20 Z'), 'M 190 20 Z');
v('il reflète aussi les points de contrôle', miroir('Q 30 40 50 60'), 'Q 170 40 150 60');
v('il laisse « Z » tranquille', miroir('Z'), 'Z');
v('refléter deux fois rend l’original', miroir(miroir('M 10 20 L 30 40 Z')), 'M 10 20 L 30 40 Z');
{
  const avant = musclesDeLaFace('avant');
  const arriere = musclesDeLaFace('arriere');
  v('les deux faces couvrent les dix-huit muscles', avant.length + arriere.length, MUSCLES.length);
  /*
     Un muscle n'apparaît que sur sa face : le montrer des deux côtés
     doublerait les zones cliquables et ferait croire à deux muscles.
  */
  v('et aucun n’est sur les deux', avant.filter((m) => arriere.includes(m)), []);
  // L'ordre de parcours au clavier suit le corps, de haut en bas.
  v('le parcours commence par le haut', avant[0], 'cou');
}
{
  /*
     Trois états, et le cycle revient à son point de départ. Sans le
     troisième, désigner un muscle secondaire demanderait un second contrôle
     à côté du schéma, et l'on aurait deux façons de dire la même chose.
  */
  v('le cycle fait trois pas', ETATS.length, 3);
  v(
    'et il revient à son point de départ',
    etatSuivant(etatSuivant(etatSuivant('aucun'))),
    'aucun',
  );
  v('rien, puis principal', etatSuivant('aucun'), 'principal');
  v('puis secondaire', etatSuivant('principal'), 'secondaire');
}

/* ══════════════════════════════════════════════════════════════════════════
   Les programmes et le volume prévu
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLES PROGRAMMES\x1b[0m');

const programme = (p: Partial<Programme> = {}): Programme => ({
  id: 'P',
  nom: 'Haut / bas',
  description: '',
  seances: [
    {
      id: 'S1',
      nom: 'Poussée',
      blocs: [
        {
          exerciceId: 'X',
          series: 4,
          repetitionsMin: 6,
          repetitionsMax: 10,
          repos: 150,
          chargeIndicative: 70,
          note: '',
        },
      ],
    },
  ],
  parSemaine: 2,
  actif: true,
  ciblesParMuscle: {},
  majLe: '2026-10-10T00:00:00.000Z',
  ...p,
});

v('un programme bien formé ne pose rien', controlerProgramme(programme()), []);
v(
  'un programme sans séance est refusé',
  controlerProgramme(programme({ seances: [] })).length,
  1,
);
v(
  'une fourchette à l’envers est refusée',
  controlerProgramme(
    programme({
      seances: [
        {
          id: 'S1',
          nom: 'Poussée',
          blocs: [
            {
              exerciceId: 'X',
              series: 3,
              repetitionsMin: 12,
              repetitionsMax: 8,
              repos: null,
              chargeIndicative: null,
              note: '',
            },
          ],
        },
      ],
    }),
  ).length,
  1,
);

{
  /*
     Une séance type, deux séances par semaine, quatre séries de développé
     couché : les pectoraux reçoivent 4 × 2 = 8 séries pleines, et les deux
     muscles secondaires 8 × 0,5 = 4 chacun. Le facteur est bien 2 et non 1 —
     c'est lui qui ramène des séances types à une semaine.
  */
  const prevu = volumePrevu(programme(), [exercice()]);
  v('le facteur ramène les séances types à la semaine', prevu.facteur, 2);
  v('les principaux reçoivent le volume plein', prevu.series.pectoraux, 8);
  v('les secondaires la moitié', prevu.series.triceps, 4);
  v('le coefficient voyage avec le résultat', prevu.coefficient, COEFFICIENT_SECONDAIRE);
}

{
  /*
     Trois séances types tournées quatre fois par semaine : chacune revient
     4/3 fois. C'est le cas que le facteur existe pour traiter, et celui
     qu'un code qui multiplierait bêtement par `parSemaine` tripleraient.
  */
  const trois = programme({
    parSemaine: 4,
    seances: [
      { id: 'A', nom: 'A', blocs: [{ exerciceId: 'X', series: 3, repetitionsMin: 8, repetitionsMax: 12, repos: null, chargeIndicative: null, note: '' }] },
      { id: 'B', nom: 'B', blocs: [{ exerciceId: 'X', series: 3, repetitionsMin: 8, repetitionsMax: 12, repos: null, chargeIndicative: null, note: '' }] },
      { id: 'C', nom: 'C', blocs: [{ exerciceId: 'X', series: 3, repetitionsMin: 8, repetitionsMax: 12, repos: null, chargeIndicative: null, note: '' }] },
    ],
  });
  // 9 séries au total × (4/3) = 12 séries hebdomadaires sur les pectoraux.
  v('quatre séances pour trois types', volumePrevu(trois, [exercice()]).series.pectoraux, 12);
}

{
  const lignes = comparerVolumes({
    prevu: { pectoraux: 10 },
    realise: { pectoraux: 10, dorsaux: 2 },
    cibles: { pectoraux: 10, dorsaux: 10 },
  });
  const ligne = (id: string) => lignes.find((l) => l.muscle === id)!;
  v('tous les muscles figurent, même à zéro', lignes.length, MUSCLES.length);
  v('dans la cible', ligne('pectoraux').etat, 'dans');
  v('sous la cible', ligne('dorsaux').etat, 'sous');
  v('sans cible déclarée, aucun jugement', ligne('mollets').etat, 'sans-cible');
  /*
     La tolérance est symétrique : à ±20 % d'une cible de 10, 12 est encore
     « dans » et 12,1 passe « au-delà ». On éprouve la borne et non son
     milieu, parce que c'est la borne qui se trompe.
  */
  v(
    'la borne haute est comprise',
    comparerVolumes({ prevu: {}, realise: { pectoraux: 10 * (1 + TOLERANCE) }, cibles: { pectoraux: 10 } })
      .find((l) => l.muscle === 'pectoraux')!.etat,
    'dans',
  );
  v(
    'et juste au-dessus on sort',
    comparerVolumes({ prevu: {}, realise: { pectoraux: 12.1 }, cibles: { pectoraux: 10 } })
      .find((l) => l.muscle === 'pectoraux')!.etat,
    'au-dela',
  );
}

{
  /*
     Le trou se voit : un programme qui n'a qu'un développé couché ne touche
     ni les jambes ni le dos, et c'est ce qu'on ne voit pas en lisant le
     programme.
  */
  const absents = musclesAbsents(programme(), [exercice()]);
  vrai('les jambes manquent', absents.includes('quadriceps'));
  faux('les pectoraux ne manquent pas', absents.includes('pectoraux'));
  faux('ni les triceps, secondaires mais touchés', absents.includes('triceps'));
}


/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
