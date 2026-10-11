/**
 * Le moteur d'activité : les formules, le journal, et la série.
 *
 * Ce que ces essais protègent n'est pas visible à l'écran : que l'XP rendue par
 * le moteur soit **exactement** celle que les neuf formules du site
 * attribuaient, qu'une ligne de journal explique son propre nombre, et qu'une
 * série ne se casse pas sur un jour de repos déclaré. La première propriété est
 * la condition de la migration : convertir sans recalculer n'a de sens que si
 * l'on sait que le recalcul donnerait la même chose.
 */
import {
  MULTIPLICATEURS,
  REGLES,
  TYPES_SERIE,
  calculerNiveau,
  calculerXp,
  coutNiveau,
  joursActifs,
  serie,
  type Multiplicateur,
} from '../src/lib/odyssee/activite';
import { typeDeFait, valider, type Fait } from '../src/lib/noyau/faits';

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

/** Un fait minimal, valide au sens du contrat. */
const fait = (type: string, jour: string, details: Record<string, unknown> = {}, valeur?: number): Fait => {
  const t = typeDeFait(type)!;
  return {
    id: `${type}:${jour}:${JSON.stringify(details).length}`,
    branche: t.proprietaire,
    proprietaire: t.proprietaire,
    domaine: t.domaine,
    type,
    debut: `${jour}T10:00:00.000Z`,
    jourLogique: jour,
    valeur,
    unite: t.unite,
    source: 'auto',
    fiabilite: 'confirme',
    version: 1,
    modifieLe: `${jour}T10:00:00.000Z`,
    details,
  };
};

console.log('\nLES RÈGLES SONT COHÉRENTES AVEC LE CATALOGUE DE FAITS');

v(
  'chaque règle écoute un type déclaré',
  REGLES.filter((r) => !typeDeFait(r.type)).map((r) => r.id),
  [],
);
v('les identifiants de règle sont uniques', new Set(REGLES.map((r) => r.id)).size, REGLES.length);
v(
  'deux règles d’un même type se distinguent par une condition',
  REGLES.filter(
    (r) => !r.quand && REGLES.filter((autre) => autre.type === r.type).length > 1,
  ).map((r) => r.id),
  [],
);
/*
 * Le mécanisme de multiplicateur existe, la liste est vide, et c'est une
 * décision écrite dans le module : l'XP du site n'en a jamais eu, et en
 * introduire un à la reprise de l'historique changerait des totaux que personne
 * n'a demandé de changer.
 */
v('aucun multiplicateur n’est déclaré aujourd’hui', MULTIPLICATEURS.length, 0);
v(
  'les faits de la série sont tous des types déclarés',
  TYPES_SERIE.filter((t) => !typeDeFait(t)),
  [],
);

console.log('\nCHAQUE FORMULE REND CE QUE LE SITE ATTRIBUAIT');

// Séance : 20 pour la séance, 8 par restitution rédigée, palier de note, 10 si étendue.
v(
  'séance nue',
  calculerXp([fait('revision.seance', '2026-03-02', { restitutions: 0, signesNote: 0 }, 3600)]).total,
  20,
);
v(
  'séance avec deux restitutions et une note d’une page',
  calculerXp([
    fait('revision.seance', '2026-03-02', { restitutions: 2, signesNote: 600 }, 3600),
  ]).total,
  20 + 16 + 10,
);
v(
  'séance étendue, note de deux pages',
  calculerXp([
    fait('revision.seance', '2026-03-02', { restitutions: 1, signesNote: 1400, etendue: true }, 3600),
  ]).total,
  20 + 8 + 20 + 10,
);
v(
  'le palier de note ne se cumule pas',
  calculerXp([fait('revision.seance', '2026-03-02', { signesNote: 1200 }, 3600)]).total,
  40,
);

// Flashcards : le prix dépend de la note, et le fait porte la journée entière.
v(
  'flashcards : quatre notes, quatre prix',
  calculerXp([
    fait('revision.flashcards', '2026-03-02', { oublie: 1, difficile: 1, correct: 1, facile: 1 }, 4),
  ]).total,
  3 + 4 + 5 + 7,
);
v(
  'flashcards : dix cartes correctes',
  calculerXp([fait('revision.flashcards', '2026-03-02', { correct: 10 }, 10)]).total,
  50,
);

v(
  'QCM : dix pour la session, deux par bonne réponse',
  calculerXp([fait('revision.qcm', '2026-03-02', { origine: 'cours', bonnes: 7, posees: 10 }, 7)]).total,
  10 + 14,
);
v(
  'QCM DGFiP : même barème d’XP, barème de score différent',
  calculerXp([fait('revision.qcm', '2026-03-02', { origine: 'dgfip', bonnes: 40, posees: 54 }, 33.5)]).total,
  10 + 80,
);
v('fiche terminée', calculerXp([fait('revision.fiche', '2026-03-02', {}, 900)]).total, 20);
v('prétest tenté', calculerXp([fait('revision.pretest', '2026-03-02')]).total, 4);

v(
  'Quad N-Back : la profondeur paie, la réussite prime à 80 %',
  calculerXp([fait('revision.cog-training', '2026-03-02', { famille: 'nback', n: 3, taux: 0.81 }, 600)]).total,
  8 + 12 + 10,
);
v(
  'Quad N-Back : sous 80 %, la partie rapporte quand même',
  calculerXp([fait('revision.cog-training', '2026-03-02', { famille: 'nback', n: 3, taux: 0.79 }, 600)]).total,
  8 + 12,
);
v(
  'Relational Reasoning : l’échelon majore chaque item réussi',
  calculerXp([
    fait('revision.cog-training', '2026-03-02', { famille: 'relationnel', reussis: 5, echelonMoyen: 3 }, 600),
  ]).total,
  8 + 5 * (4 + 2 * 3),
);
v(
  'Relational Reasoning : échelon 1, aucune majoration',
  calculerXp([
    fait('revision.cog-training', '2026-03-02', { famille: 'relationnel', reussis: 5, echelonMoyen: 1 }, 600),
  ]).total,
  8 + 20,
);
v(
  'Veridical Mapping : la prime va au seuil stabilisé',
  calculerXp([
    fait('revision.cog-training', '2026-03-02', { famille: 'veridical', reussis: 30, convergences: 2 }, 600),
  ]).total,
  6 + 30 + 50,
);

console.log('\nLE JOURNAL EXPLIQUE CHAQUE NOMBRE');

{
  const journal = calculerXp([
    fait('revision.seance', '2026-03-02', { restitutions: 2, signesNote: 600 }, 3600),
    fait('revision.flashcards', '2026-03-02', { correct: 4 }, 4),
    fait('revision.cog-training', '2026-03-03', { famille: 'nback', n: 2, taux: 0.9 }, 600),
  ]);
  v('une ligne par fait crédité', journal.lignes.length, 3);
  v('le total est la somme des lignes', journal.total, journal.lignes.reduce((s, l) => s + l.xp, 0));
  v(
    'chaque ligne nomme sa règle',
    journal.lignes.map((l) => l.regle),
    ['seance-tenue', 'flashcards-notees', 'cog-nback'],
  );
  v(
    'chaque ligne porte son facteur, qui vaut 1 sans multiplicateur',
    journal.lignes.map((l) => l.facteur),
    [1, 1, 1],
  );
  v(
    'chaque ligne dit en français d’où vient sa base',
    journal.lignes.every((l) => l.pourquoi.length > 10),
    true,
  );
  v(
    'le détail de la séance cite ses trois composantes',
    journal.lignes[0].pourquoi,
    '20 pour la séance tenue, 2 × 8 pour les restitutions à blanc rédigées, 10 pour la note de séance (600 signes)',
  );
  v('l’XP est ventilée par domaine', journal.parDomaine, { connaissances: 46 + 20, cognition: 8 + 8 + 10 });
  v('et par jour logique', journal.parJour, { '2026-03-02': 66, '2026-03-03': 26 });
}

{
  /*
   * Un fait qu'aucune règle n'écoute n'est pas une erreur : Sport publiera des
   * séries et des records longtemps avant qu'une règle d'XP les concerne. Le
   * moteur les range à part plutôt que de les laisser disparaître en silence.
   */
  const journal = calculerXp([fait('sport.serie', '2026-03-02', {}, 80)]);
  v('un fait sans règle ne crédite rien', journal.total, 0);
  v('mais il est nommé', journal.sansRegle.map((f) => f.type), ['sport.serie']);
}

{
  /*
   * Le mécanisme de multiplicateur, éprouvé avec un multiplicateur de contrôle
   * fourni par l'essai — puisque aucun n'est déclaré dans le module.
   */
  const double: Multiplicateur = {
    id: 'essai-double',
    libelle: 'Multiplicateur de contrôle',
    motif: 'Déclaré par l’essai, et par lui seul.',
    sapplique: (f) => f.type === 'revision.fiche',
    facteur: 2,
  };
  const journal = calculerXp(
    [fait('revision.fiche', '2026-03-02', {}, 900), fait('revision.pretest', '2026-03-02')],
    { multiplicateurs: [double] },
  );
  v('le multiplicateur s’applique à la règle visée', journal.lignes[0].xp, 40);
  v('et à elle seule', journal.lignes[1].xp, 4);
  v('le journal le nomme', journal.lignes[0].multiplicateurs.map((m) => m.id), ['essai-double']);
  v('et porte son motif', journal.lignes[0].multiplicateurs[0].motif.length > 10, true);
}

console.log('\nL’ÉCHELLE DES NIVEAUX EST CELLE DU SITE');

v('le niveau 1 coûte 100', coutNiveau(1), 100);
v('le niveau 4 coûte 250', coutNiveau(4), 250);
v('0 XP, niveau 1', calculerNiveau(0).niveau, 1);
v('99 XP, niveau 1', calculerNiveau(99).niveau, 1);
v('100 XP, niveau 2', calculerNiveau(100).niveau, 2);
v('250 XP, niveau 3', calculerNiveau(250).niveau, 3);
v('une XP négative ne casse pas le calcul', calculerNiveau(-50).niveau, 1);
v('la progression est bornée', calculerNiveau(149).progression < 1, true);

console.log('\nLA SÉRIE COMPTE LES JOURS OÙ L’ON A FAIT QUELQUE CHOSE');

{
  const faits = [
    fait('revision.flashcards', '2026-03-01', { correct: 1 }, 1),
    fait('odyssee.poids', '2026-03-02', {}, 78),
    fait('sport.seance', '2026-03-03', {}, 3600),
  ];
  v('une pesée ne fait pas un jour actif', joursActifs(faits), ['2026-03-01', '2026-03-03']);
}

v('aucun jour actif : série nulle, record conservé', serie([], { recordAnterieur: 12 }), {
  courante: 0,
  record: 12,
  dernierJour: null,
  reposTraverses: [],
});

v(
  'trois jours de suite',
  serie(['2026-03-01', '2026-03-02', '2026-03-03']).courante,
  3,
);
v(
  'un trou non justifié repart à un',
  serie(['2026-03-01', '2026-03-02', '2026-03-05']).courante,
  1,
);
v(
  'mais le record garde la meilleure série',
  serie(['2026-03-01', '2026-03-02', '2026-03-05']).record,
  2,
);
v(
  'un jour de repos déclaré ne casse pas la série',
  serie(['2026-03-01', '2026-03-03'], { estRepos: (j) => j === '2026-03-02' }).courante,
  2,
);
v(
  'et il est nommé, pour que l’écran puisse le dire',
  serie(['2026-03-01', '2026-03-03'], { estRepos: (j) => j === '2026-03-02' }).reposTraverses,
  ['2026-03-02'],
);
v(
  'un seul jour non-repos dans le trou suffit à casser',
  serie(['2026-03-01', '2026-03-05'], { estRepos: (j) => j !== '2026-03-03' }).courante,
  1,
);
v(
  'au-delà de quinze jours, même déclarés de repos, c’est une interruption',
  serie(['2026-03-01', '2026-03-20'], { estRepos: () => true }).courante,
  1,
);
v(
  'la série ne court plus si le dernier jour actif est hors de portée',
  serie(['2026-03-01', '2026-03-02'], { jusqua: '2026-03-10' }).courante,
  0,
);
v(
  'elle court encore le lendemain, qui n’est pas fini',
  serie(['2026-03-01', '2026-03-02'], { jusqua: '2026-03-03' }).courante,
  2,
);
v(
  'un doublon de jour ne compte qu’une fois',
  serie(['2026-03-01', '2026-03-01', '2026-03-02']).courante,
  2,
);

console.log('\nLE JOUR LOGIQUE À 4 H NE DÉCALE AUCUNE SÉRIE');

{
  /*
   * L'exigence du plan, prise au mot : une séance finie à 00 h 30 appartient à
   * la soirée écoulée. Comptée à minuit, elle ouvrirait un jour nouveau et
   * laisserait la veille vide — donc casserait la série au lieu de la
   * prolonger.
   */
  const minuitPasse = new Date('2026-03-03T00:30:00+01:00');
  const { jourLogique } = await import('../src/lib/noyau/jour-logique');
  v('00 h 30 appartient à la veille', jourLogique(minuitPasse), '2026-03-02');
  const jours = ['2026-03-01', jourLogique(minuitPasse)];
  v('la série reste continue', serie(jours).courante, 2);
  v(
    'alors qu’à minuit elle se serait cassée',
    serie(['2026-03-01', '2026-03-03']).courante,
    1,
  );
}

console.log('\nLA RÉPARTITION DU SOCLE NE PERD NI N’INVENTE UN SEUL POINT');

{
  const { repartir } = await import('../src/lib/odyssee/service');
  const somme = (r: Record<string, number>) => Object.values(r).reduce((s, n) => s + n, 0);

  v(
    'les parts du recalcul servent de clef de répartition',
    repartir(3000, { connaissances: 74, cognition: 30 }),
    { cognition: 865, connaissances: 2135 },
  );
  v(
    'et la somme vaut exactement le total repris',
    somme(repartir(3000, { connaissances: 74, cognition: 30 })),
    3000,
  );
  /*
   * L'arrondi est absorbé par le domaine le plus chargé : trois parts égales de
   * 100 ne font pas 33 + 33 + 33, parce qu'un socle qui perdrait un point
   * afficherait deux nombres différents pour la même chose.
   */
  v('un tiers de 100 ne perd pas de point', somme(repartir(100, { a: 1, b: 1, c: 1 })), 100);
  v('ni un septième de 1 000', somme(repartir(1000, { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 })), 1000);
  v(
    'sans historique publiable, tout revient aux connaissances',
    repartir(3000, {}),
    { connaissances: 3000 },
  );
  v('une XP nulle ne répartit rien', repartir(0, { connaissances: 10 }), {});
}

console.log('\nLES FAITS PROJETÉS RESTENT VALIDES AU SENS DU CONTRAT');

v(
  'un fait de chaque type écouté passe la validation',
  REGLES.map((r) => valider(fait(r.type, '2026-03-02', {}, 1)).recevable).filter((ok) => !ok).length,
  0,
);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
