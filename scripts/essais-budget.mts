/**
 * Le budget : les dates, les centimes, et ce qui refuse de mentir.
 *
 * Quatre choses s'éprouvent ici, et la première est celle qu'on découvre
 * toujours trop tard :
 *
 * - **la mensualisation tombe juste à l'exact**. Douze provisions dont la
 *   somme n'égale pas l'annuel fabriquent un écart de quelques centimes par
 *   an, qu'on cherche ensuite pendant une soirée ;
 * - **les dates ne débordent pas**. Un prélèvement « le 31 » tombe le 30 en
 *   avril et le 28 ou 29 en février, et jamais le 1er du mois suivant ;
 * - **une ligne est une suite de versions** : une occurrence prend le montant
 *   en vigueur à sa date, et non le dernier connu ;
 * - **l'absence n'est pas un zéro** : sans ressource, un taux vaut `null`.
 */
import {
  CATEGORIES_EPARGNE,
  PAR_AN,
  TOLERANCE_PAR_DEFAUT,
  ajouterJours,
  ajouterMois,
  bissextile,
  comparerAuCourant,
  controlerLigne,
  joursDansLeMois,
  jourDuMois,
  largeurTolerance,
  occurrences,
  premierDecouvert,
  provisionMensuelle,
  repartir,
  totauxMensuels,
  tresorerie,
  versionAu,
  type LigneBudget,
  type VersionDeLigne,
} from '../src/lib/odyssee/budget';
import { centimesDe } from '../src/lib/odyssee/finances';

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

const version = (p: Partial<VersionDeLigne> = {}): VersionDeLigne => ({
  depuis: '2026-01-01',
  jusqua: null,
  montant: 78000,
  nature: 'fixe',
  montantHaut: null,
  periodicite: 'mensuelle',
  jourAttendu: 5,
  tolerance: TOLERANCE_PAR_DEFAUT,
  ...p,
});

const ligne = (p: Partial<LigneBudget> = {}): LigneBudget => ({
  id: 'L1',
  libelle: 'Loyer',
  categorie: 'logement',
  sens: 'charge',
  compteId: 'C1',
  essentielle: true,
  motifs: ['LOYER'],
  versions: [version()],
  note: '',
  majLe: '2026-01-01T00:00:00.000Z',
  ...p,
});

/* ════════════════════════════════════════════════════════════════════════
   1. Les dates civiles
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES DATES NE DÉBORDENT PAS');

{
  v('2024 est bissextile', bissextile(2024), true);
  v('2026 ne l’est pas', bissextile(2026), false);
  /*
     1900 et 2000 : la règle des siècles. 1900 n'est pas bissextile malgré
     son multiple de 4 ; 2000 l'est, étant multiple de 400. C'est la faute
     classique, et elle ne se voit qu'une fois par siècle.
  */
  v('1900 non plus, malgré le multiple de 4', bissextile(1900), false);
  v('mais 2000 oui', bissextile(2000), true);
  v('février 2024 a 29 jours', joursDansLeMois(2024, 2), 29);
  v('février 2026 en a 28', joursDansLeMois(2026, 2), 28);

  v('le 31 avril tombe le 30', jourDuMois(2026, 4, 31), '2026-04-30');
  v('le 31 février tombe le 28', jourDuMois(2026, 2, 31), '2026-02-28');
  v('et le 29 en année bissextile', jourDuMois(2024, 2, 31), '2024-02-29');
  v('le 5 reste le 5', jourDuMois(2026, 4, 5), '2026-04-05');

  v('un mois plus tard', ajouterMois('2026-01-31', 1), '2026-02-28');
  /*
     Le point qui compte : repartir du 28 février ne doit pas « perdre » le
     31. On passe donc le jour attendu, qui appartient à la ligne, et non le
     jour de la dernière occurrence.
  */
  v('et le jour attendu n’est pas perdu', ajouterMois('2026-02-28', 1, 31), '2026-03-31');
  v('douze mois plus tard', ajouterMois('2026-03-15', 12), '2027-03-15');

  v('un jour après le 28 février 2024', ajouterJours('2024-02-28', 1), '2024-02-29');
  v('un jour après le 28 février 2026', ajouterJours('2026-02-28', 1), '2026-03-01');
  v('passage d’année', ajouterJours('2026-12-31', 1), '2027-01-01');
  v('en arrière aussi', ajouterJours('2027-01-01', -1), '2026-12-31');
  v('trente jours en arrière', ajouterJours('2026-03-05', -30), '2026-02-03');
}

/* ════════════════════════════════════════════════════════════════════════
   2. Les centimes
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA RÉPARTITION TOMBE JUSTE À L’EXACT');

{
  v('150 € en douze : douze fois 12,50', repartir(15000, 12), Array(12).fill(1250));
  /*
     100 € en douze : 8,333… par part. Douze fois 8,33 font 99,96, et quatre
     centimes s'évaporent — puis réapparaissent au rapprochement sous forme
     d'un écart que rien n'explique. Le reste se répartit sur les premières.
  */
  const cent = repartir(10000, 12);
  v('100 € en douze commence par 8,34', cent[0], 834);
  v('et finit par 8,33', cent[11], 833);
  v('mais la somme fait exactement 100 €', cent.reduce((s, x) => s + x, 0), 10000);

  for (const [montant, n] of [[10000, 12], [7, 3], [99999, 7], [1, 12]] as const) {
    v(
      `${montant} centimes en ${n} parts : somme exacte`,
      repartir(montant, n).reduce((s, x) => s + x, 0),
      montant,
    );
  }
  v('un montant négatif garde son signe', repartir(-10000, 12)[0], -834);
  v('zéro part donne une liste vide', repartir(1000, 0), []);
}

console.log('\nLA PROVISION MENSUELLE');

{
  v('une mensuelle est elle-même', provisionMensuelle(version({ montant: 78000 })), 78000);
  v(
    'une annuelle de 150 € vaut 12,50 par mois',
    provisionMensuelle(version({ montant: 15000, periodicite: 'annuelle' })),
    1250,
  );
  v(
    'une trimestrielle de 90 € vaut 30 € par mois',
    provisionMensuelle(version({ montant: 9000, periodicite: 'trimestrielle' })),
    3000,
  );
  v(
    'une hebdomadaire de 20 € vaut 86,67 € par mois',
    provisionMensuelle(version({ montant: 2000, periodicite: 'hebdomadaire' })),
    8667,
  );
  /*
     La provision affichée est la **première** part, c'est-à-dire la plus
     grande. Provisionner un centime de trop vaut mieux que de découvrir en
     décembre qu'il en manque quatre.
  */
  v(
    'une annuelle de 100 € provisionne 8,34 et non 8,33',
    provisionMensuelle(version({ montant: 10000, periodicite: 'annuelle' })),
    834,
  );
  v('une ponctuelle ne se mensualise pas', provisionMensuelle(version({ periodicite: 'ponctuelle' })), null);
  v('et PAR_AN le dit aussi', PAR_AN.ponctuelle, null);
}

console.log('\nLA TOLÉRANCE PREND LA PLUS LARGE DES DEUX');

{
  /*
     2 % d'un abonnement à 9,99 € font 20 centimes : trop strict. 2 € sur un
     loyer de 780 € le sont aussi, dans l'autre sens. Chacun rattrape
     l'échelle où l'autre échoue.
  */
  v('sur 9,99 €, les 2 € l’emportent', largeurTolerance(999, TOLERANCE_PAR_DEFAUT), 200);
  v('sur 780 €, les 2 % l’emportent', largeurTolerance(78000, TOLERANCE_PAR_DEFAUT), 1560);
  v('et le signe n’y change rien', largeurTolerance(-78000, TOLERANCE_PAR_DEFAUT), 1560);
}

/* ════════════════════════════════════════════════════════════════════════
   3. Les versions
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE LIGNE EST UNE SUITE DE VERSIONS');

{
  const demenagement = ligne({
    versions: [
      version({ depuis: '2026-01-01', jusqua: '2026-02-28', montant: 74000 }),
      version({ depuis: '2026-03-01', montant: 78000 }),
    ],
  });
  v('aucun problème', controlerLigne(demenagement), []);
  v('en janvier, l’ancien loyer', versionAu(demenagement, '2026-01-15')?.montant, 74000);
  v('en mars, le nouveau', versionAu(demenagement, '2026-03-15')?.montant, 78000);
  v('avant la première version, rien', versionAu(demenagement, '2025-12-31'), null);

  /*
     Le point central : une occurrence prend le montant **de sa date**, pas
     le dernier connu. Sans cela, tout l'historique des écarts se réécrirait
     à chaque déménagement.
  */
  const trois = occurrences(demenagement, '2026-01-01', '2026-03-31');
  v('trois occurrences', trois.map((o) => o.jour), ['2026-01-05', '2026-02-05', '2026-03-05']);
  v('aux bons montants', trois.map((o) => o.montant), [74000, 74000, 78000]);
  v('toutes signées en charge', trois.map((o) => o.signe), [-1, -1, -1]);
  v('et les identifiants sont déterministes', trois[0].id, 'L1:2026-01-05');

  vrai(
    'deux versions qui se chevauchent sont refusées',
    controlerLigne(
      ligne({
        versions: [
          version({ depuis: '2026-01-01', jusqua: '2026-03-31' }),
          version({ depuis: '2026-03-01' }),
        ],
      }),
    ).length > 0,
  );
  /*
     Un **trou** est licite, lui : une charge suspendue trois mois n'a pas
     d'occurrence pendant ces trois mois, et c'est exactement ce qu'on veut
     dire. Confondre les deux obligerait à inventer une version à zéro.
  */
  const suspendue = ligne({
    versions: [
      version({ depuis: '2026-01-01', jusqua: '2026-01-31' }),
      version({ depuis: '2026-05-01' }),
    ],
  });
  v('un trou entre deux versions est permis', controlerLigne(suspendue), []);
  v(
    'et il ne produit aucune occurrence',
    occurrences(suspendue, '2026-02-01', '2026-04-30').length,
    0,
  );
  vrai(
    'une version ouverte suivie d’une autre est refusée',
    controlerLigne(
      ligne({ versions: [version({ jusqua: null }), version({ depuis: '2026-06-01' })] }),
    ).length > 0,
  );
  vrai('un montant négatif est refusé', controlerLigne(ligne({ versions: [version({ montant: -100 })] })).length > 0);
  vrai(
    'un jour attendu à 32 est refusé',
    controlerLigne(ligne({ versions: [version({ jourAttendu: 32 })] })).length > 0,
  );
  vrai(
    'un jour attendu à 8 l’est aussi pour une hebdomadaire',
    controlerLigne(
      ligne({ versions: [version({ periodicite: 'hebdomadaire', jourAttendu: 8 })] }),
    ).length > 0,
  );
}

/* ════════════════════════════════════════════════════════════════════════
   4. Les occurrences
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES OCCURRENCES SONT DÉTERMINISTES');

{
  const le31 = ligne({ versions: [version({ jourAttendu: 31, depuis: '2026-01-01' })] });
  v(
    'le 31 de chaque mois, ramené quand il déborde',
    occurrences(le31, '2026-01-01', '2026-05-31').map((o) => o.jour),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'],
  );

  const annuelle = ligne({
    versions: [version({ periodicite: 'annuelle', depuis: '2026-03-14', jourAttendu: 14 })],
  });
  v(
    'une annuelle revient à sa date',
    occurrences(annuelle, '2026-01-01', '2028-12-31').map((o) => o.jour),
    ['2026-03-14', '2027-03-14', '2028-03-14'],
  );

  /*
     La phase d'une trimestrielle appartient à la ligne, pas au calendrier :
     ouverte en février, elle tombe en février, mai, août et novembre — et
     non en janvier, avril, juillet, octobre.
  */
  const trim = ligne({
    versions: [version({ periodicite: 'trimestrielle', depuis: '2026-02-10', jourAttendu: 10 })],
  });
  v(
    'une trimestrielle garde sa phase',
    occurrences(trim, '2026-01-01', '2026-12-31').map((o) => o.jour),
    ['2026-02-10', '2026-05-10', '2026-08-10', '2026-11-10'],
  );

  const hebdo = ligne({
    versions: [version({ periodicite: 'hebdomadaire', depuis: '2026-01-01', jourAttendu: 3 })],
  });
  const mercredis = occurrences(hebdo, '2026-01-01', '2026-01-31');
  v('une hebdomadaire tombe le bon jour', mercredis.map((o) => o.jour), [
    '2026-01-07',
    '2026-01-14',
    '2026-01-21',
    '2026-01-28',
  ]);
  vrai(
    'et ce sont bien des mercredis',
    mercredis.every((o) => new Date(`${o.jour}T12:00:00.000Z`).getUTCDay() === 3),
  );

  const ponctuelle = ligne({ versions: [version({ periodicite: 'ponctuelle', depuis: '2026-07-04' })] });
  v(
    'une ponctuelle n’arrive qu’une fois',
    occurrences(ponctuelle, '2026-01-01', '2026-12-31').map((o) => o.jour),
    ['2026-07-04'],
  );
  v('et pas du tout hors période', occurrences(ponctuelle, '2027-01-01', '2027-12-31').length, 0);

  const o = occurrences(ligne(), '2026-03-01', '2026-03-31')[0];
  v('la fenêtre d’appariement s’ouvre deux jours avant', o.du, '2026-03-03');
  v('et se referme deux jours après', o.au, '2026-03-07');
  v('la tolérance de montant est celle de la version', o.tolerance, 1560);

  /*
     Déterminisme : la même demande, deux fois, rend exactement la même
     liste. C'est ce qui permet de ne jamais les stocker ni les synchroniser.
  */
  v(
    'deux calculs donnent le même résultat',
    JSON.stringify(occurrences(le31, '2026-01-01', '2026-06-30')),
    JSON.stringify(occurrences(le31, '2026-01-01', '2026-06-30')),
  );
}

/* ════════════════════════════════════════════════════════════════════════
   5. Les totaux
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES TOTAUX, ET CE QU’ILS REFUSENT DE DIRE');

{
  const budget: LigneBudget[] = [
    ligne({ id: 'R1', libelle: 'Salaire', categorie: 'salaire', sens: 'ressource', versions: [version({ montant: 245000, jourAttendu: 27 })] }),
    ligne({ id: 'C1', libelle: 'Loyer', categorie: 'logement', versions: [version({ montant: 78000 })] }),
    ligne({ id: 'C2', libelle: 'Assurance', categorie: 'assurance', versions: [version({ montant: 15000, periodicite: 'annuelle', depuis: '2026-03-14', jourAttendu: 14 })] }),
    ligne({ id: 'C3', libelle: 'Alimentation', categorie: 'alimentation', versions: [version({ montant: 40000, nature: 'estime' })] }),
    ligne({ id: 'E1', libelle: 'Virement livret', categorie: 'épargne', versions: [version({ montant: 30000, jourAttendu: 2 })] }),
  ];
  const t = totauxMensuels(budget, '2026-06-15');
  v('les ressources', t.ressources, 245000);
  v('les charges fixes, assurance mensualisée comprise', t.chargesFixes, 78000 + 1250);
  v('les variables à part', t.chargesVariables, 40000);
  v('l’épargne programmée aussi', t.epargne, 30000);
  /*
     Le reste à vivre ne retranche **pas** les enveloppes variables : c'est
     dedans qu'on vit, et les retrancher donnerait un reste à vivre qui ne
     reste à rien.
  */
  v('le reste à vivre', t.resteAVivre, 245000 - 79250 - 30000);
  v('le taux d’effort', t.tauxEffort, 32.3);
  v('le taux d’épargne', t.tauxEpargne, 12.2);
  v(
    'la formule alternative retranche les variables',
    totauxMensuels(budget, '2026-06-15', { variablesComprises: true }).resteAVivre,
    245000 - 79250 - 30000 - 40000,
  );
  vrai('la catégorie « épargne » est reconnue', CATEGORIES_EPARGNE.includes('épargne'));

  /*
     Sans ressource, un taux ne vaut pas zéro : il n'existe pas. Zéro
     laisserait lire « 0 % d'effort », c'est-à-dire une situation
     confortable, là où il n'y a simplement rien de saisi.
  */
  const sansRevenu = totauxMensuels([budget[1]], '2026-06-15');
  v('sans ressource, le taux d’effort est null', sansRevenu.tauxEffort, null);
  v('et le taux d’épargne aussi', sansRevenu.tauxEpargne, null);
  v('mais la charge, elle, existe', sansRevenu.chargesFixes, 78000);

  v('une ligne hors période ne compte pas', totauxMensuels(budget, '2025-01-01').ressources, 0);
}

/* ════════════════════════════════════════════════════════════════════════
   6. La trésorerie
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE CALENDRIER RÉEL, PAS LA MOYENNE');

{
  const budget: LigneBudget[] = [
    ligne({ id: 'R1', sens: 'ressource', categorie: 'salaire', versions: [version({ montant: 245000, jourAttendu: 27 })] }),
    ligne({ id: 'C1', versions: [version({ montant: 78000, jourAttendu: 5 })] }),
  ];
  const points = tresorerie(budget, 50000, '2026-06-01', '2026-06-30');
  v('un point par jour', points.length, 30);
  v('le 4, rien n’a bougé', points.find((p) => p.jour === '2026-06-04')?.solde, 50000);
  v('le 5, le loyer est passé', points.find((p) => p.jour === '2026-06-05')?.solde, 50000 - 78000);
  v('le 27, le salaire arrive', points.find((p) => p.jour === '2026-06-27')?.solde, 50000 - 78000 + 245000);
  v('et le 30 clôt le mois', points[29].solde, 217000);

  /*
     Le découvert du 5 au 26 est invisible dans la moyenne : 500 € de départ
     plus 2 450 € de salaire moins 780 € de loyer font un mois largement
     positif. C'est le calendrier qui le montre, et c'est pour cela que les
     deux sont affichés.
  */
  v('un découvert est repéré', premierDecouvert(points), '2026-06-05');
  v('et il n’y en a pas si le salaire précède', premierDecouvert(tresorerie(
    [ligne({ id: 'R1', sens: 'ressource', versions: [version({ montant: 245000, jourAttendu: 1 })] }), budget[1]],
    50000,
    '2026-06-01',
    '2026-06-30',
  )), null);
}

/* ════════════════════════════════════════════════════════════════════════
   7. Les scénarios
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUN SCÉNARIO NE TOUCHE JAMAIS LE RÉEL');

{
  const courant: LigneBudget[] = [
    ligne({ id: 'R1', sens: 'ressource', categorie: 'salaire', versions: [version({ montant: 245000 })] }),
    ligne({ id: 'C1', versions: [version({ montant: 78000 })] }),
  ];
  const scenario = {
    id: 'S1',
    nom: 'Si je déménageais',
    copieLe: '2026-06-15',
    lignes: [courant[0], ligne({ id: 'C1', versions: [version({ montant: 95000 })] })],
    majLe: '2026-06-15T00:00:00.000Z',
  };
  const diff = comparerAuCourant(courant, scenario, '2026-06-15');
  const reste = diff.find((d) => d.champ === 'resteAVivre')!;
  v('le reste à vivre baisse de 170 €', reste.ecart, -17000);
  v('les ressources ne bougent pas', diff.find((d) => d.champ === 'ressources')?.ecart, 0);
  /*
     7,0 et non 6,9. L'écart se calcule sur les taux **déjà arrondis** —
     38,8 − 31,8 — et non sur les valeurs brutes, qui donneraient 6,94. Sinon
     l'écran afficherait trois nombres dont la soustraction ne tombe pas
     juste, et c'est la personne qui aurait l'air de se tromper.
  */
  v('le taux d’effort monte de 7 points', diff.find((d) => d.champ === 'tauxEffort')?.ecart, 7);

  /*
     Et le réel est intact : le scénario porte ses propres lignes. S'il
     référençait celles du courant, modifier le loyer réel changerait la
     réponse à « et si je déménageais », sans que personne y ait touché.
  */
  v('le budget courant n’a pas bougé', totauxMensuels(courant, '2026-06-15').chargesFixes, 78000);

  const sansRien = comparerAuCourant([], scenario, '2026-06-15');
  v(
    'comparer à un budget vide ne rend pas d’écart de taux',
    sansRien.find((d) => d.champ === 'tauxEffort')?.ecart,
    null,
  );
}

console.log('\nLA SAISIE DE MONTANTS');

{
  v('une virgule décimale', centimesDe('12,50'), 1250);
  v('un espace insécable de relevé', centimesDe('1 234,56'), 123456);
  v('un symbole euro', centimesDe('780,00 €'), 78000);
  v('un négatif', centimesDe('-45,90'), -4590);
  v('une saisie illisible rend null, pas zéro', centimesDe('environ 40'), null);
  v('et une chaîne vide aussi', centimesDe(''), null);
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
