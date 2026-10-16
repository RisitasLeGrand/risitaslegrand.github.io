/**
 * Le budget d'attention : ce qu'il ne replie jamais — prompt 32, § 3.3.
 *
 *   npm run essais:budget
 *
 * La fonction est pure, donc le contrôle l'exécute, sans doublure ni
 * navigateur. Ce qui s'y éprouve n'est pas le plafond — compter jusqu'à
 * cinq se relit — mais ses **deux exceptions**, qui sont des interdits
 * non levables : une question à trancher n'est jamais repliée (§ 1 n° 8),
 * et une source d'urgence n'est « ni regroupée, ni différée, ni résumée,
 * ni comptée dans un plafond » (§ 1 n° 7).
 *
 * La seconde est testée sur une liste que le code livre **vide**. C'est
 * délibéré : la garde existe pour le jour où une source d'urgence sera
 * déclarée, et une garde qu'on n'éprouve que quand elle sert n'est
 * éprouvée qu'une fois trop tard. Le contrôle y met donc une source de
 * son cru, par une porte prévue pour lui.
 */
import {
  PLAFOND_QUOTIDIEN,
  SOURCES_HORS_PLAFOND,
  appliquerLeBudget,
  libelleDuRegroupement,
} from '../src/lib/notifications/budget';
import type { ElementDuCentre } from '../src/lib/notifications/modele';

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

const JOUR = '2026-10-16';
const HIER = '2026-10-15';

let n = 0;
const el = (
  source: string,
  genre: 'a-trancher' | 'a-savoir' = 'a-savoir',
  creeLe = JOUR,
): ElementDuCentre => ({
  id: String(n += 1).padStart(32, '0'),
  source,
  refSource: 'r',
  genre,
  creeLe,
  etat: 'non_lu',
  regroupement: null,
});

const sources = (b: { montres: ElementDuCentre[] }) => b.montres.map((e) => e.source);

console.log('\n\x1b[1m1. Le plafond replie, il ne supprime pas\x1b[0m');
{
  const huit = Array.from({ length: 8 }, () => el('avis-de-fusion'));
  const b = appliquerLeBudget(huit, JOUR);
  v('cinq montrés', b.montres.length, PLAFOND_QUOTIDIEN);
  v('trois repliés, sous leur source', b.regroupes, [{ source: 'avis-de-fusion', combien: 3 }]);
  v('et le total est conservé', b.montres.length + b.regroupes[0].combien, 8);
  v('le libellé s’accorde', [libelleDuRegroupement(3), libelleDuRegroupement(1)], ['et 3 autres', 'et 1 autre']);
}

console.log('\n\x1b[1m2. Ce qui n’est pas de ce jour n’est pas nouveau\x1b[0m');
{
  const melange = [
    ...Array.from({ length: 6 }, () => el('avis-de-fusion', 'a-savoir', HIER)),
    ...Array.from({ length: 6 }, () => el('avis-de-fusion')),
  ];
  const b = appliquerLeBudget(melange, JOUR);
  v('les six d’hier passent, plus cinq d’aujourd’hui', b.montres.length, 11);
  v('un seul replié', b.regroupes, [{ source: 'avis-de-fusion', combien: 1 }]);
}

console.log('\n\x1b[1m3. Une question à trancher n’est JAMAIS repliée (§ 1 n° 8)\x1b[0m');
{
  /*
     Six avis d'abord : le plafond est atteint avant que les questions
     n'arrivent. Si elles étaient traitées comme le reste, elles seraient
     repliées — c'est exactement le défaut visé.
  */
  const liste = [
    ...Array.from({ length: 6 }, () => el('avis-de-fusion')),
    el('question-a-trancher', 'a-trancher'),
    el('question-a-trancher', 'a-trancher'),
  ];
  const b = appliquerLeBudget(liste, JOUR);
  v(
    'les deux questions sont montrées malgré le plafond atteint',
    sources(b).filter((s) => s === 'question-a-trancher').length,
    2,
  );
  v('seul l’avis en trop est replié', b.regroupes, [{ source: 'avis-de-fusion', combien: 1 }]);

  /* Et elles ne CONSOMMENT pas le plafond non plus. */
  const avecQuestionsDAbord = [
    el('question-a-trancher', 'a-trancher'),
    el('question-a-trancher', 'a-trancher'),
    el('question-a-trancher', 'a-trancher'),
    ...Array.from({ length: 5 }, () => el('avis-de-fusion')),
  ];
  const b2 = appliquerLeBudget(avecQuestionsDAbord, JOUR);
  v('trois questions placées d’abord ne mangent pas le plafond', b2.regroupes, []);
  v('les huit sont montrés', b2.montres.length, 8);
}

console.log(
  '\n\x1b[1m4. Urgence et détresse : hors de tout plafond (§ 1 n° 7)\x1b[0m' +
    '\n   \x1b[2mLa liste est livrée VIDE ; on l’éprouve pleine, avant qu’elle ne serve.\x1b[0m',
);
{
  v('aucune source d’urgence déclarée à ce jour', SOURCES_HORS_PLAFOND, []);

  /*
     On y met une source, par la porte que le type laisse ouverte. Un
     contrôle qui se contenterait de constater la liste vide ne dirait
     rien du mécanisme — et le mécanisme est tout ce qu'il y a à garder,
     puisqu'il n'a pas encore de contenu.
  */
  const muable = SOURCES_HORS_PLAFOND as string[];
  muable.push('secours-vital');
  try {
    const liste = [
      ...Array.from({ length: 7 }, () => el('avis-de-fusion')),
      el('secours-vital'),
      el('secours-vital'),
    ];
    const b = appliquerLeBudget(liste, JOUR);
    v(
      'les deux messages de secours sont montrés',
      sources(b).filter((s) => s === 'secours-vital').length,
      2,
    );
    v('et jamais regroupés', b.regroupes.some((r) => r.source === 'secours-vital'), false);

    /*
       « ni comptés dans un plafond » : les placer EN PREMIER ne doit pas
       faire disparaître deux avis à leur place. C'est la nuance du § 1
       n° 7 qu'un « ne pas regrouper » tout seul manquerait.
    */
    const dAbord = [
      el('secours-vital'),
      el('secours-vital'),
      ...Array.from({ length: 5 }, () => el('avis-de-fusion')),
    ];
    const b2 = appliquerLeBudget(dAbord, JOUR);
    v('ils ne consomment pas le plafond', b2.regroupes, []);
    v('les sept sont montrés', b2.montres.length, 7);
  } finally {
    muable.length = 0;
  }
  v('la liste est rendue à son état livré', SOURCES_HORS_PLAFOND, []);
}

console.log('\n\x1b[1m5. Le « résumé du jour » ne replie rien (§ 3.3)\x1b[0m');
{
  const dix = Array.from({ length: 10 }, () => el('avis-de-fusion'));
  const b = appliquerLeBudget(dix, JOUR, { resumeDuJour: true });
  v('tout est montré', b.montres.length, 10);
  v('rien n’est replié', b.regroupes, []);
}

console.log('\n\x1b[1m6. L’ordre reçu est l’ordre rendu\x1b[0m');
{
  /*
     La fonction ne trie pas : c'est le panneau qui a décidé de l'ordre,
     et deux endroits qui trient finissent par trier différemment.
  */
  const liste = [el('revue-manquee'), el('avis-de-fusion'), el('trajectoire')];
  v('aucun réordonnancement', sources(appliquerLeBudget(liste, JOUR)), [
    'revue-manquee',
    'avis-de-fusion',
    'trajectoire',
  ]);
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
