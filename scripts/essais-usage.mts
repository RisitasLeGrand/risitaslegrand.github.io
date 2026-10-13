/**
 * Le journal d'usage : ce qu'il mesure, et surtout ce qu'il refuse d'enregistrer.
 *
 * Trois choses s'éprouvent ici.
 *
 * - **Aucun contenu.** Une session est un début et une fin. La liste blanche
 *   des champs refuse tout le reste, et le contrôle refuse qu'un champ de
 *   contenu entre un jour dans la liste blanche.
 * - **Changer de page ne fait pas quatre sessions.** Sans fusion des
 *   sessions proches, la « fragmentation » mesurerait la navigation plutôt
 *   que le comportement — c'est-à-dire l'inverse de ce qu'on veut.
 * - **Une session en cours ne dure pas zéro.** Sa durée est `null`, et une
 *   journée sans session terminée n'a pas de durée médiane.
 */
import {
  CHAMPS_AUTORISES,
  CHAMPS_DE_CONTENU_INTERDITS,
  HEURE_TARDIVE,
  JOURS_CONSERVES,
  SECONDES_ENTRE_DEUX_SESSIONS,
  aElaguer,
  controlerSession,
  controlerUsage,
  duree,
  fusionnerLesProches,
  journeeDUsage,
  journeesDUsage,
  type Session,
} from '../src/lib/odyssee/usage';

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
const vrai = (i: string, c: boolean) => v(i, c, true);
const faux = (i: string, c: boolean) => v(i, c, false);

/** Heure locale de Paris en octobre : UTC+2. */
const a = (heure: number, minute = 0, jour = 12) =>
  new Date(Date.UTC(2026, 9, jour, heure - 2, minute)).toISOString();

const session = (p: Partial<Session> = {}): Session => ({
  id: 'S1',
  jour: '2026-10-12',
  debut: a(9),
  fin: a(9, 30),
  majLe: a(9, 30),
  ...p,
});

/* ════════════════════════════════════════════════════════════════════════
   1. Aucun contenu
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE SESSION NE PORTE AUCUN CONTENU');

{
  v('cinq champs, pas un de plus', [...CHAMPS_AUTORISES].sort(), ['debut', 'fin', 'id', 'jour', 'majLe']);
  v('une session ordinaire passe', controlerSession(session()), []);

  /*
     Le cas qui viendra : quelqu'un ajoute la page consultée « pour affiner ».
     Savoir que l'application a été ouverte à 3 h est une information de
     rythme ; savoir que « Ma psyché » a été ouverte à 3 h est une
     information sur la personne.
  */
  const avecPage = { ...session(), page: '/odyssee/psyche/' } as unknown as Session;
  vrai('un champ « page » est refusé', controlerSession(avecPage).length > 0);
  vrai(
    'et le message dit pourquoi',
    controlerSession(avecPage)[0].includes('n’enregistre aucun contenu'),
  );
  for (const champ of ['url', 'ecran', 'action', 'recherche']) {
    vrai(
      `un champ « ${champ} » aussi`,
      controlerSession({ ...session(), [champ]: 'x' } as unknown as Session).length > 0,
    );
  }

  v('le module se contrôle lui-même', controlerUsage(), []);
  faux(
    'aucun champ de contenu n’est dans la liste blanche',
    CHAMPS_DE_CONTENU_INTERDITS.some((c) => CHAMPS_AUTORISES.includes(c)),
  );
  vrai('et la rétention reste bornée', JOURS_CONSERVES <= 400);
}

console.log('\nCE QU’UNE SESSION REFUSE D’ÊTRE');

{
  vrai('une fin avant le début', controlerSession(session({ fin: a(8) })).length > 0);
  vrai('un jour mal formé', controlerSession(session({ jour: '12/10/2026' })).length > 0);
  v('une session en cours est licite', controlerSession(session({ fin: null })), []);
}

/* ════════════════════════════════════════════════════════════════════════
   2. Les durées
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE SESSION EN COURS NE DURE PAS ZÉRO');

{
  v('trente minutes', duree(session()), 1800);
  /*
     `null`, et non 0. Une session ouverte depuis une heure compterait comme
     une visite éclair, et tirerait la durée médiane vers le bas au moment
     précis où la personne est présente.
  */
  v('une session en cours n’a pas de durée', duree(session({ fin: null })), null);
  v('une session instantanée dure zéro', duree(session({ fin: a(9) })), 0);
}

console.log('\nCHANGER DE PAGE NE FAIT PAS QUATRE SESSIONS');

{
  /*
     Quatre écrans parcourus en dix minutes. Sans fusion, la fragmentation
     mesurerait la navigation plutôt que le comportement.
  */
  const navigation = [
    session({ id: 'A', debut: a(9, 0), fin: a(9, 2) }),
    session({ id: 'B', debut: a(9, 3), fin: a(9, 5) }),
    session({ id: 'C', debut: a(9, 6), fin: a(9, 8) }),
    session({ id: 'D', debut: a(9, 9), fin: a(9, 10) }),
  ];
  const fusionnees = fusionnerLesProches(navigation);
  v('une seule session', fusionnees.length, 1);
  v('du début de la première à la fin de la dernière', duree(fusionnees[0]), 600);

  /*
     Deux visites séparées de trois heures restent deux visites : c'est
     exactement la distinction que la fragmentation doit voir.
  */
  const deuxVisites = [
    session({ id: 'A', debut: a(9, 0), fin: a(9, 20) }),
    session({ id: 'B', debut: a(12, 0), fin: a(12, 10) }),
  ];
  v('deux visites éloignées restent deux', fusionnerLesProches(deuxVisites).length, 2);
  /*
     La borne, des deux côtés. Exactement deux minutes fusionne, deux minutes
     et une seconde non : un seuil dont on n'éprouve qu'un côté laisse passer
     une inégalité retournée sans que rien ne le dise.
  */
  const ecarteDe = (secondes: number) =>
    fusionnerLesProches([
      session({ id: 'A', debut: a(9, 0), fin: a(9, 10) }),
      session({
        id: 'B',
        debut: new Date(Date.parse(a(9, 10)) + secondes * 1000).toISOString(),
        fin: a(9, 20),
      }),
    ]).length;
  v(`à ${SECONDES_ENTRE_DEUX_SESSIONS} secondes pile, on fusionne`, ecarteDe(SECONDES_ENTRE_DEUX_SESSIONS), 1);
  v('une seconde de plus, non', ecarteDe(SECONDES_ENTRE_DEUX_SESSIONS + 1), 2);

  /*
     Deux onglets ouverts en même temps : la fusion ne doit pas raccourcir la
     journée en gardant la fin du second, plus précoce.
  */
  const deuxOnglets = [
    session({ id: 'A', debut: a(9, 0), fin: a(10, 0) }),
    session({ id: 'B', debut: a(9, 1), fin: a(9, 30) }),
  ];
  v('deux onglets gardent la fin la plus tardive', duree(fusionnerLesProches(deuxOnglets)[0]), 3600);
}

/* ════════════════════════════════════════════════════════════════════════
   3. La journée
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA JOURNÉE D’USAGE');

{
  const journee = journeeDUsage(
    [
      session({ id: 'A', debut: a(8, 0), fin: a(8, 30) }),
      session({ id: 'B', debut: a(14, 0), fin: a(14, 20) }),
      session({ id: 'C', debut: a(23, 0), fin: a(23, 40) }),
    ],
    '2026-10-12',
  );
  v('trois sessions', journee.sessions, 3);
  v('la durée médiane est celle du milieu', journee.dureeMediane, 1800);
  v('première trace à 8 h', journee.premiereTrace, 8);
  v('dernière trace à 23 h 40', journee.derniereTrace, 23 + 40 / 60);
  v('amplitude de 15,7 heures', journee.amplitude, 15.7);
  v('aucune session tardive', journee.partTardive, 0);

  const nuit = journeeDUsage(
    [
      session({ id: 'A', debut: a(2, 0), fin: a(3, 0) }),
      session({ id: 'B', debut: a(14, 0), fin: a(14, 20) }),
    ],
    '2026-10-12',
  );
  v(`une session entre ${HEURE_TARDIVE.de} h et ${HEURE_TARDIVE.a} h sur deux`, nuit.partTardive, 0.5);

  /*
     Zéro session tardive est une information vraie ; zéro session tout court
     est une absence, et ce jour-là n'apparaît simplement pas.
  */
  const vide = journeeDUsage([], '2026-10-12');
  v('un jour sans session n’a pas de durée médiane', vide.dureeMediane, null);
  v('ni d’amplitude', vide.amplitude, null);
  v('et aucune trace', [vide.premiereTrace, vide.derniereTrace], [null, null]);

  const enCours = journeeDUsage([session({ fin: null })], '2026-10-12');
  v('une journée sans session terminée n’a pas de médiane', enCours.dureeMediane, null);
  v('mais elle a bien une session', enCours.sessions, 1);

  v(
    'les journées sont triées',
    journeesDUsage([
      session({ id: 'B', jour: '2026-10-13', debut: a(9, 0, 13), fin: a(9, 30, 13) }),
      session({ id: 'A', jour: '2026-10-11', debut: a(9, 0, 11), fin: a(9, 30, 11) }),
    ]).map((j) => j.jour),
    ['2026-10-11', '2026-10-13'],
  );
}

console.log('\nLA RÉTENTION');

{
  const vieille = session({ id: 'vieille', jour: '2025-01-01' });
  const recente = session({ id: 'recente', jour: '2026-10-01' });
  v(
    'ce qui dépasse la fenêtre est élagué',
    aElaguer([vieille, recente], '2026-10-12'),
    ['vieille'],
  );
  v(`et la fenêtre fait ${JOURS_CONSERVES} jours`, aElaguer([recente], '2026-10-12'), []);
}

console.log('\nLE JOURNAL D’USAGE NE VOYAGE PAS');

{
  /*
     La règle vit dans des données qu'un essai peut lire, parce que la
     tentation de l'inscrire au registre « pour que ça suive » est la chose la
     plus naturelle du monde — elle y a d'ailleurs été inscrite une fois.
  */
  const { MAGASINS_JOURNALISES, MAGASINS_SANS_GESTE, controlerSansGeste } = await import(
    '../src/lib/noyau/enregistrements'
  );
  vrai(
    'il est déclaré rempli sans geste de la personne',
    MAGASINS_SANS_GESTE.includes('odysseeUsage'),
  );
  faux(
    'et il n’est pas journalisé : sinon deux appareils ne concorderaient plus jamais',
    MAGASINS_JOURNALISES.some((m) => m.magasin === 'odysseeUsage'),
  );
  v('aucun magasin n’est dans les deux listes', controlerSansGeste(), []);
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
