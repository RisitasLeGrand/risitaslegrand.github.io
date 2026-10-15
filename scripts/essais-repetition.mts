/**
 * Le moteur de répétition — phase 1 du prompt 38.
 *
 *   npm run essais:repetition
 *
 * Le prompt nomme six familles de cas, et elles sont ici dans cet ordre :
 * chaque règle, la fin de mois (le 31, puis février), les années bissextiles,
 * le changement d'heure, le jour logique après minuit, « cette fois » ou
 * « les suivantes ».
 *
 * ## Deux choix d'écriture, et leur raison
 *
 * **On compare des listes entières, pas des compteurs.** « Sept occurrences en
 * 2026 » est vrai d'une règle qui tombe le 31 des mois longs comme d'une règle
 * qui tombe n'importe quels sept jours. Une liste exacte ne peut pas être vraie
 * par hasard.
 *
 * **On vérifie aussi les jours où la règle ne doit PAS tomber.** Un moteur qui
 * répondrait « oui » à tout passerait n'importe quelle vérification qui ne
 * demande que des oui. Les refus sont donc éprouvés autant que les acceptations
 * — c'est la leçon des contrôles verts parce qu'ils ne regardaient rien.
 */
import { jourLogique, heureLocale } from '../src/lib/noyau/jour-logique';
import {
  instantDeLOccurrence,
  occurrences,
  occurrencesAvant,
  problemesDeLaSerie,
  prochaineOccurrence,
  scinderLaSerie,
  suitLaRegle,
  type Fin,
  type JourSemaine,
  type Repetition,
  type Serie,
} from '../src/lib/odyssee/repetition';

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

const serie = (
  depuis: string,
  repetition: Repetition,
  fin: Fin = { type: 'jamais' },
  heure: string | null = null,
): Serie => ({ depuis, repetition, fin, heure });

/* ══════════════════════════════════════════════════════════════════════════
   1. Chaque règle de répétition
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCHAQUE JOUR, ET TOUS LES N JOURS');

v(
  'chaque jour',
  occurrences(serie('2026-01-01', { type: 'jours', tous: 1 }), '2026-01-01', '2026-01-05'),
  ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'],
);
v(
  'tous les trois jours',
  occurrences(serie('2026-01-01', { type: 'jours', tous: 3 }), '2026-01-01', '2026-01-12'),
  ['2026-01-01', '2026-01-04', '2026-01-07', '2026-01-10'],
);
v(
  'rien avant le jour de départ',
  occurrences(serie('2026-01-10', { type: 'jours', tous: 1 }), '2026-01-01', '2026-01-11'),
  ['2026-01-10', '2026-01-11'],
);
v(
  'et le moteur sait dire non',
  [
    suitLaRegle(serie('2026-01-01', { type: 'jours', tous: 3 }), '2026-01-02'),
    suitLaRegle(serie('2026-01-01', { type: 'jours', tous: 3 }), '2026-01-03'),
    suitLaRegle(serie('2026-01-01', { type: 'jours', tous: 3 }), '2026-01-04'),
  ],
  [false, false, true],
);
v(
  'un intervalle de trois jours franchit un mois sans se décaler',
  occurrences(serie('2026-01-28', { type: 'jours', tous: 3 }), '2026-01-28', '2026-02-07'),
  ['2026-01-28', '2026-01-31', '2026-02-03', '2026-02-06'],
);

console.log('\nCERTAINS JOURS DE LA SEMAINE');

// 2026-01-01 est un jeudi ; la série est lundi, mercredi, vendredi.
const lmv: JourSemaine[] = [1, 3, 5];
v(
  'lundi, mercredi, vendredi, à partir d’un jeudi',
  occurrences(serie('2026-01-01', { type: 'semaines', tous: 1, jours: lmv }), '2026-01-01', '2026-01-12'),
  ['2026-01-02', '2026-01-05', '2026-01-07', '2026-01-09', '2026-01-12'],
);
v(
  'le mercredi de la semaine de départ est antérieur : il ne compte pas',
  suitLaRegle(serie('2026-01-01', { type: 'semaines', tous: 1, jours: lmv }), '2025-12-31'),
  false,
);
v(
  'un mardi n’est jamais retenu',
  suitLaRegle(serie('2026-01-01', { type: 'semaines', tous: 1, jours: lmv }), '2026-01-06'),
  false,
);
/*
   Toutes les deux semaines : l'ancre est la semaine de `depuis`, pas le jour.
   La série part un jeudi, et le premier lundi retenu est donc celui de la
   semaine d'après la prochaine — le 12, pas le 5.
*/
v(
  'un lundi sur deux, ancré sur la semaine de départ',
  occurrences(serie('2026-01-01', { type: 'semaines', tous: 2, jours: [1] }), '2026-01-01', '2026-02-10'),
  ['2026-01-12', '2026-01-26', '2026-02-09'],
);

console.log('\nCHAQUE MOIS, LE MÊME QUANTIÈME');

v(
  'le 5 de chaque mois',
  occurrences(serie('2026-01-05', { type: 'mois-date' }), '2026-01-01', '2026-05-31'),
  ['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05', '2026-05-05'],
);

console.log('\nCHAQUE MOIS, LE MÊME RANG');

// 2026-01-05 est le premier lundi de janvier.
v(
  'le premier lundi de chaque mois',
  occurrences(serie('2026-01-05', { type: 'mois-rang' }), '2026-01-01', '2026-06-30'),
  ['2026-01-05', '2026-02-02', '2026-03-02', '2026-04-06', '2026-05-04', '2026-06-01'],
);
v(
  'le deuxième lundi n’est pas retenu par une règle de premier lundi',
  suitLaRegle(serie('2026-01-05', { type: 'mois-rang' }), '2026-02-09'),
  false,
);
/*
   2026-01-26 est le **dernier** lundi de janvier, et c'est aussi le
   quatrième. Le moteur traite tout lundi des sept derniers jours du mois
   comme « le dernier », sans quoi un cinquième lundi ne retomberait presque
   jamais et la série paraîtrait éteinte.
*/
v(
  'le dernier lundi de chaque mois',
  occurrences(serie('2026-01-26', { type: 'mois-rang' }), '2026-01-01', '2026-04-30'),
  ['2026-01-26', '2026-02-23', '2026-03-30', '2026-04-27'],
);

console.log('\nCHAQUE ANNÉE');

v(
  'le 14 juillet',
  occurrences(serie('2026-07-14', { type: 'annee' }), '2026-01-01', '2029-12-31'),
  ['2026-07-14', '2027-07-14', '2028-07-14', '2029-07-14'],
);

/* ══════════════════════════════════════════════════════════════════════════
   2. Fin de mois : le 31, puis février
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLA FIN DE MOIS');

/*
   Le 31 répété chaque mois **saute** les mois qui n'ont pas de 31. Il ne se
   rabat ni sur le 28 février ni sur le 1er mars : rabattre inventerait une
   occurrence non demandée, et le mois suivant plus personne ne saurait si
   « le 28 » voulait dire le 28 ou le 31 rogné.
*/
v(
  'le 31 de chaque mois, sur une année entière',
  occurrences(serie('2026-01-31', { type: 'mois-date' }), '2026-01-01', '2026-12-31'),
  [
    '2026-01-31',
    '2026-03-31',
    '2026-05-31',
    '2026-07-31',
    '2026-08-31',
    '2026-10-31',
    '2026-12-31',
  ],
);
v(
  'février ne reçoit rien, ni le 28 ni le 1er mars',
  occurrences(serie('2026-01-31', { type: 'mois-date' }), '2026-02-01', '2026-03-02'),
  [],
);
v(
  'après le 31 janvier vient le 31 mars',
  prochaineOccurrence(serie('2026-01-31', { type: 'mois-date' }), '2026-02-01'),
  '2026-03-31',
);
v(
  'le 30 passe en février bissextile mais pas en février ordinaire',
  [
    occurrences(serie('2024-01-30', { type: 'mois-date' }), '2024-02-01', '2024-02-29'),
    occurrences(serie('2026-01-30', { type: 'mois-date' }), '2026-02-01', '2026-02-28'),
  ],
  [[], []],
);
v(
  'le 29 passe en février bissextile, et seulement là',
  [
    occurrences(serie('2024-01-29', { type: 'mois-date' }), '2024-02-01', '2024-02-29'),
    occurrences(serie('2026-01-29', { type: 'mois-date' }), '2026-02-01', '2026-02-28'),
  ],
  [['2024-02-29'], []],
);

/* ══════════════════════════════════════════════════════════════════════════
   3. Les années bissextiles
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLES ANNÉES BISSEXTILES');

v(
  'le 29 février annuel ne tombe que les années bissextiles',
  occurrences(serie('2024-02-29', { type: 'annee' }), '2024-01-01', '2036-12-31'),
  ['2024-02-29', '2028-02-29', '2032-02-29', '2036-02-29'],
);
/*
   La règle du siècle : 2100 n'est pas bissextile, donc après 2096 vient 2104,
   huit ans plus tard. C'est le cas qui fixe l'horizon de `prochaineOccurrence` :
   un horizon d'un an — ou même de cinq — aurait rendu `null` pour une série
   parfaitement vivante, et l'essai qui l'aurait montré se serait écrit en 2100.
*/
v(
  'après le 29 février 2096 vient le 29 février 2104, pas 2100',
  prochaineOccurrence(serie('2096-02-29', { type: 'annee' }), '2096-03-01'),
  '2104-02-29',
);
v(
  'et 2100 ne reçoit rien',
  occurrences(serie('2096-02-29', { type: 'annee' }), '2100-01-01', '2100-12-31'),
  [],
);
v(
  'une série quotidienne traverse le 29 février sans trou',
  occurrences(serie('2024-02-27', { type: 'jours', tous: 1 }), '2024-02-27', '2024-03-02'),
  ['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02'],
);

/* ══════════════════════════════════════════════════════════════════════════
   4. Le changement d'heure
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE CHANGEMENT D’HEURE');

/** L'heure murale de Paris d'un instant, en `HH:MM`. */
const murale = (instant: Date | null) => {
  if (instant === null) return null;
  const l = heureLocale(instant);
  return `${String(l.heure).padStart(2, '0')}:${String(l.minute).padStart(2, '0')}`;
};

/*
   Le 25 octobre 2026, Paris repasse à l'heure d'hiver. Une tâche de 8 h reste
   à 8 h : c'est l'exigence littérale du prompt, et elle n'est tenue que parce
   qu'une occurrence est un jour plus une heure **murale**, jamais un instant.
*/
const matinale = serie('2026-10-20', { type: 'jours', tous: 1 }, { type: 'jamais' }, '08:00');
v(
  'la veille, le jour et le lendemain du 25 octobre 2026 sont tous à 8 h',
  [
    murale(instantDeLOccurrence(matinale, '2026-10-24')),
    murale(instantDeLOccurrence(matinale, '2026-10-25')),
    murale(instantDeLOccurrence(matinale, '2026-10-26')),
  ],
  ['08:00', '08:00', '08:00'],
);
/*
   La contrepartie, écrite parce qu'elle est contre-intuitive : ces deux
   occurrences-là sont séparées de 25 heures, pas de 24. C'est le comportement
   voulu — on se lève à 8 h, pas vingt-quatre heures après son dernier lever —
   mais un calcul de durée qui soustrairait deux occurrences serait faux.
*/
const heures = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;
v(
  'du 24 au 25 octobre 2026, il s’écoule 25 heures',
  heures(instantDeLOccurrence(matinale, '2026-10-24')!, instantDeLOccurrence(matinale, '2026-10-25')!),
  25,
);
const printaniere = serie('2026-03-25', { type: 'jours', tous: 1 }, { type: 'jamais' }, '08:00');
v(
  'le 29 mars 2026, le passage à l’heure d’été laisse aussi 8 h à 8 h',
  [
    murale(instantDeLOccurrence(printaniere, '2026-03-28')),
    murale(instantDeLOccurrence(printaniere, '2026-03-29')),
  ],
  ['08:00', '08:00'],
);
v(
  'et du 28 au 29 mars 2026, il s’écoule 23 heures',
  heures(
    instantDeLOccurrence(printaniere, '2026-03-28')!,
    instantDeLOccurrence(printaniere, '2026-03-29')!,
  ),
  23,
);
v(
  'le changement d’heure ne retire ni n’ajoute un jour à la série',
  occurrences(serie('2026-10-23', { type: 'jours', tous: 1 }), '2026-10-23', '2026-10-27'),
  ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'],
);
/*
   Une série sans heure n'a pas d'instant du tout : « une tâche quotidienne
   sans heure apparaît dans la journée, pas à minuit ». Rendre minuit aurait
   été la facilité, et aurait rangé la tâche la veille au soir une fois sur
   deux, puisque minuit appartient au jour logique précédent.
*/
const sansHeure = serie('2026-10-20', { type: 'jours', tous: 1 });
v('une série sans heure n’a pas d’instant', instantDeLOccurrence(sansHeure, '2026-10-24'), null);
v('une série avec heure en a un', instantDeLOccurrence(matinale, '2026-10-24') instanceof Date, true);

/* ══════════════════════════════════════════════════════════════════════════
   5. Le jour logique après minuit
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE JOUR LOGIQUE APRÈS MINUIT');

/*
   Le jour logique bascule à 4 h. Une occurrence de 2 h du jour logique du 15
   tombe donc, dans le calendrier, le **16 à 2 h**. L'invariant qui doit tenir
   est celui-ci : l'instant d'une occurrence retombe sur son propre jour
   logique. Sans lui, une tâche de nuit s'afficherait la veille.
*/
const nocturne = serie('2026-01-10', { type: 'jours', tous: 1 }, { type: 'jamais' }, '02:00');
const instantNocturne = instantDeLOccurrence(nocturne, '2026-01-15')!;
v('une occurrence de 2 h est au calendrier le lendemain', instantNocturne.toISOString(), '2026-01-16T01:00:00.000Z');
v('et elle appartient bien à son jour logique', jourLogique(instantNocturne), '2026-01-15');

const tardive = serie('2026-01-10', { type: 'jours', tous: 1 }, { type: 'jamais' }, '03:59');
const matinal = serie('2026-01-10', { type: 'jours', tous: 1 }, { type: 'jamais' }, '04:00');
v(
  '3 h 59 bascule encore, 4 h 00 ne bascule plus',
  [
    instantDeLOccurrence(tardive, '2026-01-15')!.toISOString(),
    instantDeLOccurrence(matinal, '2026-01-15')!.toISOString(),
  ],
  ['2026-01-16T02:59:00.000Z', '2026-01-15T03:00:00.000Z'],
);
v(
  'et les deux retombent sur le jour logique du 15',
  [
    jourLogique(instantDeLOccurrence(tardive, '2026-01-15')!),
    jourLogique(instantDeLOccurrence(matinal, '2026-01-15')!),
  ],
  ['2026-01-15', '2026-01-15'],
);
/*
   Les deux jours où cette conversion croise un changement d'heure. L'heure de
   2 h 30 n'existe pas le 29 mars et existe deux fois le 25 octobre : le noyau
   tranche — l'instant du saut au printemps, la première occurrence à l'automne
   — et l'invariant doit tenir dans les deux cas.
*/
const demiNuit = serie('2026-01-01', { type: 'jours', tous: 1 }, { type: 'jamais' }, '02:30');
v(
  'l’heure qui n’existe pas : le jour logique du 28 mars tient quand même',
  jourLogique(instantDeLOccurrence(demiNuit, '2026-03-28')!),
  '2026-03-28',
);
v(
  'l’heure qui existe deux fois : le jour logique du 24 octobre aussi',
  jourLogique(instantDeLOccurrence(demiNuit, '2026-10-24')!),
  '2026-10-24',
);

/* ══════════════════════════════════════════════════════════════════════════
   Les fins de série
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLES FINS DE SÉRIE');

v(
  'une fin à une date inclut ce jour-là',
  occurrences(
    serie('2026-01-01', { type: 'jours', tous: 1 }, { type: 'date', jusquAu: '2026-01-03' }),
    '2026-01-01',
    '2026-01-10',
  ),
  ['2026-01-01', '2026-01-02', '2026-01-03'],
);
v(
  'une fin après N fois compte les occurrences, pas les jours',
  occurrences(
    serie('2026-01-01', { type: 'jours', tous: 3 }, { type: 'fois', nombre: 4 }),
    '2026-01-01',
    '2026-12-31',
  ),
  ['2026-01-01', '2026-01-04', '2026-01-07', '2026-01-10'],
);
v(
  'une fin après N fois tient même quand la fenêtre commence au milieu',
  occurrences(
    serie('2026-01-01', { type: 'jours', tous: 3 }, { type: 'fois', nombre: 4 }),
    '2026-01-06',
    '2026-12-31',
  ),
  ['2026-01-07', '2026-01-10'],
);
v(
  'une série finie n’a plus de prochaine occurrence',
  prochaineOccurrence(
    serie('2026-01-01', { type: 'jours', tous: 1 }, { type: 'fois', nombre: 3 }),
    '2026-01-04',
  ),
  null,
);

/* ══════════════════════════════════════════════════════════════════════════
   6. « Cette fois » ou « les suivantes »
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n« CELLE-CI ET LES SUIVANTES »');

const douze = serie('2026-01-01', { type: 'jours', tous: 1 }, { type: 'fois', nombre: 12 });
const scindee = scinderLaSerie(douze, '2026-01-04');
v('trois occurrences ont déjà eu lieu', occurrencesAvant(douze, '2026-01-04'), 3);
v('la moitié d’avant garde ces trois-là', scindee.avant?.fin, { type: 'fois', nombre: 3 });
v('la moitié d’après reprend au 4', scindee.apres?.depuis, '2026-01-04');
/*
   La somme est conservée. Sans ce report, scinder une série de douze en
   fabriquerait quinze — « aucune série réécrite en silence » vaut aussi dans
   ce sens-là.
*/
v('et les neuf restantes', scindee.apres?.fin, { type: 'fois', nombre: 9 });
v(
  'les deux moitiés redonnent exactement la série d’origine',
  [
    ...occurrences(scindee.avant!, '2026-01-01', '2026-12-31'),
    ...occurrences(scindee.apres!, '2026-01-01', '2026-12-31'),
  ],
  occurrences(douze, '2026-01-01', '2026-12-31'),
);

const tout = scinderLaSerie(douze, '2026-01-01');
v('scinder à la première occurrence ne laisse rien avant', tout.avant, null);
v('et rend la série entière après', tout.apres, douze);

/*
   Le piège des règles mensuelles : leur quantième est déduit de `depuis`.
   Poser `depuis` au jour du clic — le 12 — changerait « le 5 de chaque mois »
   en « le 12 de chaque mois », en silence. La reprise est donc ancrée sur la
   première occurrence suivante, jamais sur le jour du clic.
*/
const leCinq = serie('2026-01-05', { type: 'mois-date' });
const coupe = scinderLaSerie(leCinq, '2026-03-12');
v('la reprise d’une série mensuelle est la prochaine occurrence', coupe.apres?.depuis, '2026-04-05');
v(
  'et la règle reste « le 5 », pas « le 12 »',
  occurrences(coupe.apres!, '2026-04-01', '2026-06-30'),
  ['2026-04-05', '2026-05-05', '2026-06-05'],
);
v('la moitié d’avant s’arrête la veille du jour choisi', coupe.avant?.fin, {
  type: 'date',
  jusquAu: '2026-03-11',
});
v(
  'elle garde les trois occurrences passées',
  occurrences(coupe.avant!, '2026-01-01', '2026-12-31'),
  ['2026-01-05', '2026-02-05', '2026-03-05'],
);

/*
   Même piège pour un intervalle : scinder « tous les 3 jours » un jour qui
   n'est pas une occurrence ne doit pas déplacer la grille.
*/
const troisJours = serie('2026-01-01', { type: 'jours', tous: 3 });
const coupe3 = scinderLaSerie(troisJours, '2026-01-05');
v('la grille des trois jours n’est pas déplacée', coupe3.apres?.depuis, '2026-01-07');
v(
  'et la suite tombe aux mêmes jours que la série d’origine',
  occurrences(coupe3.apres!, '2026-01-01', '2026-01-17'),
  occurrences(troisJours, '2026-01-07', '2026-01-17'),
);

const finie = serie('2026-01-01', { type: 'jours', tous: 1 }, { type: 'fois', nombre: 3 });
v('scinder après la fin ne rend aucune suite', scinderLaSerie(finie, '2026-02-01').apres, null);

/* ══════════════════════════════════════════════════════════════════════════
   La validation
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLA VALIDATION');

v('une série saine n’a aucun problème', problemesDeLaSerie(
  serie('2026-01-01', { type: 'semaines', tous: 1, jours: [1, 3] }, { type: 'fois', nombre: 4 }, '08:30'),
), []);
v(
  'un intervalle nul est refusé',
  problemesDeLaSerie(serie('2026-01-01', { type: 'jours', tous: 0 })),
  ['l’intervalle doit valoir au moins 1'],
);
v(
  'une semaine sans jour choisi est refusée',
  problemesDeLaSerie(serie('2026-01-01', { type: 'semaines', tous: 1, jours: [] })),
  ['aucun jour de la semaine n’est choisi'],
);
v(
  'un jour de semaine répété est refusé',
  problemesDeLaSerie(serie('2026-01-01', { type: 'semaines', tous: 1, jours: [1, 1] })),
  ['un jour de la semaine est répété'],
);
v(
  'une fin antérieure au départ est refusée',
  problemesDeLaSerie(
    serie('2026-01-10', { type: 'jours', tous: 1 }, { type: 'date', jusquAu: '2026-01-01' }),
  ),
  ['la date de fin précède le jour de départ'],
);
v(
  'une heure impossible est refusée',
  problemesDeLaSerie(serie('2026-01-01', { type: 'jours', tous: 1 }, { type: 'jamais' }, '25:00')),
  ['l’heure n’est pas au format HH:MM'],
);

console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
