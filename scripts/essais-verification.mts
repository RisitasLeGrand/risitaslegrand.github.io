/**
 * La vérification des chiffres cités, et le tri.
 *
 * Ce que ces essais protègent :
 *
 * - **la distinction « non retrouvé » / « non vérifiable »**, qui est tout
 *   l'intérêt du module. Dire « non retrouvé » sur une période compactée
 *   accuserait l'IA d'avoir inventé, alors que c'est **nous** qui ne savons
 *   plus.
 * - **l'unité ne se convertit pas en silence.** Une conversion devinée
 *   marcherait neuf fois sur dix et, la dixième, confirmerait un chiffre faux.
 * - **une seule preuve non retrouvée rend tout le constat douteux.** Un constat
 *   bâti sur trois chiffres dont un est inventé n'est pas aux deux tiers juste.
 * - **le tri refuse d'adopter une action dont le constat est écarté**, et
 *   respecte le plafond de trois trajectoires actives.
 */
import {
  LIBELLES_ETAT,
  LIBELLES_VERDICT,
  PLANCHER_ABSOLU,
  TOLERANCE_APPROCHE,
  TOLERANCE_CONFIRME,
  TRAJECTOIRES_ACTIVES,
  compter,
  controlerTri,
  etatDuConstat,
  verifier,
  type Preuve,
  type Recalcul,
  type Tri,
} from '../src/lib/noyau/verification';
import {
  BANNIERE_ANALYSE,
  DOMAINES_A_AVERTISSEMENT,
  avertissement,
  controlerAvertissements,
} from '../src/lib/noyau/avertissements';

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

const preuve = (valeurCitee: number, unite = 'secondes'): Preuve => ({
  indicateur: 'cog.temps-revision',
  periode: { debut: '2026-09-01', fin: '2026-09-30' },
  valeurCitee,
  unite,
});
const valeur = (n: number, unite = 'secondes'): Recalcul => ({ quoi: 'valeur', valeur: n, unite });

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes quatre verdicts\x1b[0m');

v('les tolérances sont déclarées', [TOLERANCE_CONFIRME, TOLERANCE_APPROCHE], [0.02, 0.1]);
v('et le plancher absolu aussi', PLANCHER_ABSOLU, 0.001);

v('une valeur exacte est confirmée', verifier(preuve(3600), valeur(3600)).verdict, 'confirme');
v('un écart de 1 % est confirmé', verifier(preuve(3636), valeur(3600)).verdict, 'confirme');
v('un écart de 2 % tout juste est confirmé', verifier(preuve(3672), valeur(3600)).verdict, 'confirme');
v('un écart de 5 % est approché', verifier(preuve(3780), valeur(3600)).verdict, 'approche');
v('un écart de 10 % tout juste est approché', verifier(preuve(3960), valeur(3600)).verdict, 'approche');
v('un écart de 11 % n’est pas retrouvé', verifier(preuve(3996), valeur(3600)).verdict, 'non-retrouve');
v('le double n’est pas retrouvé', verifier(preuve(7200), valeur(3600)).verdict, 'non-retrouve');
{
  const verification = verifier(preuve(3780), valeur(3600));
  v('l’écart relatif est rendu', Math.round((verification.ecartRelatif ?? 0) * 1000) / 1000, 0.05);
  v('et la valeur recalculée', verification.recalculee, 3600);
  /*
     Le séparateur de milliers du français est une espace **fine insécable**
     (U+202F), et non une espace ordinaire : comparer à « 3 600 » tapé à la main
     échoue sur une chaîne pourtant juste.
  */
  const sansEspaces = (t: string) => t.replace(/[\s\u202f\u00a0]/g, '');
  vrai('la raison dit la valeur recalculée', sansEspaces(verification.raison).includes('3600'));
  vrai('et le pourcentage d’écart', verification.raison.includes('5 %'));
}
{
  /*
     Le plancher absolu : deux pour cent d'une rétention de 0,04 font 0,0008,
     et aucune IA ne cite à cette précision.
  */
  const verification = verifier(preuve(0.04, 'part'), valeur(0.0405, 'part'));
  v('un écart minuscule en valeur est confirmé malgré le relatif', verification.verdict, 'confirme');
}
v(
  'une valeur citée sur un recalcul nul est refusée',
  verifier(preuve(5), valeur(0)).verdict,
  'non-retrouve',
);
v('mais zéro sur zéro est confirmé', verifier(preuve(0), valeur(0)).verdict, 'confirme');

console.log('\n\x1b[1mCe qui n’est pas vérifiable, et le dit\x1b[0m');

{
  const verification = verifier(preuve(3600), { quoi: 'compacte', detailDepuis: '2026-06-01' });
  v('une période compactée est non vérifiable', verification.verdict, 'non-verifiable');
  vrai('et la raison date la compaction', verification.raison.includes('2026-06-01'));
  vrai(
    'en disant qu’on ne peut ni confirmer ni démentir',
    verification.raison.includes('ni être confirmé ni être démenti'),
  );
  v('aucune valeur n’est inventée', verification.recalculee, undefined);
}
{
  const verification = verifier(preuve(3600), { quoi: 'inconnu' });
  v('un indicateur hors catalogue est non vérifiable', verification.verdict, 'non-verifiable');
  vrai('et la raison le nomme', verification.raison.includes('cog.temps-revision'));
}
{
  const verification = verifier(preuve(1, 'heures'), valeur(3600, 'secondes'));
  v('une unité qui ne correspond pas est non vérifiable', verification.verdict, 'non-verifiable');
  vrai('et la raison nomme les deux unités', verification.raison.includes('heures') && verification.raison.includes('secondes'));
  vrai(
    'en disant qu’aucune conversion n’est devinée',
    verification.raison.includes('aucune conversion n’est devinée'),
  );
  v('la valeur recalculée est quand même montrée', verification.recalculee, 3600);
}
{
  const verification = verifier(preuve(3600), { quoi: 'aucune-donnee' });
  v('une période sans donnée n’est pas « non vérifiable » mais « non retrouvé »', verification.verdict, 'non-retrouve');
  vrai(
    'et la raison dit que la valeur ne vient pas de l’export',
    verification.raison.includes('ne vient pas de l’export'),
  );
}
v('les quatre verdicts ont leur libellé', Object.keys(LIBELLES_VERDICT).length, 4);
v('et « non-retrouve » se dit « non retrouvé »', LIBELLES_VERDICT['non-retrouve'], 'non retrouvé');

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’état d’un constat\x1b[0m');

const confirmee = verifier(preuve(3600), valeur(3600));
const approchee = verifier(preuve(3780), valeur(3600));
const absente = verifier(preuve(99999), valeur(3600));
const invisible = verifier(preuve(3600), { quoi: 'compacte', detailDepuis: '2026-06-01' });

v('toutes confirmées : étayé', etatDuConstat([confirmee, confirmee]), 'etaye');
v('confirmée et approchée : étayé', etatDuConstat([confirmee, approchee]), 'etaye');
v('une seule non retrouvée : douteux', etatDuConstat([confirmee, confirmee, absente]), 'douteux');
v('toutes non vérifiables : invérifiable', etatDuConstat([invisible, invisible]), 'invérifiable');
v('une vérifiable et une non : étayé', etatDuConstat([confirmee, invisible]), 'etaye');
v('une non retrouvée gagne sur une non vérifiable', etatDuConstat([invisible, absente]), 'douteux');
v('aucune preuve : invérifiable', etatDuConstat([]), 'invérifiable');
vrai(
  'et le libellé d’un constat douteux dit lequel est le problème',
  LIBELLES_ETAT.douteux.includes('n’est pas retrouvée'),
);

v('le compte par verdict est rendu', compter([confirmee, approchee, absente, invisible]), {
  confirme: 1,
  approche: 1,
  'non-retrouve': 1,
  'non-verifiable': 1,
});
v('un compte vide est à zéro partout', compter([]), {
  confirme: 0,
  approche: 0,
  'non-retrouve': 0,
  'non-verifiable': 0,
});

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLe tri\x1b[0m');

const LIENS = { p1: ['c1'], p2: ['c2'], p3: ['c1', 'c3'], p4: ['c4'] };

{
  const tri: Tri = { constats: { c1: 'garde' }, propositions: { p1: 'adoptee' } };
  const verdict = controlerTri(tri, LIENS);
  v('un tri cohérent est recevable', verdict.recevable, true);
  v('sans motif', verdict.motifs, []);
  v('et l’adoptée est nommée', verdict.adoptees, ['p1']);
}
{
  const tri: Tri = { constats: { c1: 'ecarte' }, propositions: { p1: 'adoptee' } };
  const verdict = controlerTri(tri, LIENS);
  faux('adopter une action dont le constat est écarté est refusé', verdict.recevable);
  vrai('et le motif nomme les deux', verdict.motifs[0].includes('p1') && verdict.motifs[0].includes('c1'));
  vrai(
    'en disant pourquoi',
    verdict.motifs[0].includes('sans justification'),
  );
}
{
  const tri: Tri = { constats: { c1: 'ecarte' }, propositions: { p1: 'reportee' } };
  v('reporter une action dont le constat est écarté passe', controlerTri(tri, LIENS).recevable, true);
}
{
  const tri: Tri = {
    constats: { c1: 'garde', c2: 'garde', c3: 'garde', c4: 'garde' },
    propositions: { p1: 'adoptee', p2: 'adoptee', p3: 'adoptee', p4: 'adoptee' },
  };
  const verdict = controlerTri(tri, LIENS);
  faux('quatre adoptions dépassent le plafond', verdict.recevable);
  vrai('et le motif nomme le plafond', verdict.motifs[0].includes(`${TRAJECTOIRES_ACTIVES}`));
}
{
  const tri: Tri = {
    constats: { c1: 'garde', c2: 'garde' },
    propositions: { p1: 'adoptee', p2: 'adoptee' },
  };
  faux(
    'deux adoptions avec deux trajectoires déjà actives dépassent aussi',
    controlerTri(tri, LIENS, 2).recevable,
  );
  v(
    'une seule adoption avec deux actives tient',
    controlerTri({ constats: { c1: 'garde' }, propositions: { p1: 'adoptee' } }, LIENS, 2).recevable,
    true,
  );
}
{
  const tri: Tri = { constats: { c1: 'garde', c3: 'ecarte' }, propositions: { p3: 'adoptee' } };
  const verdict = controlerTri(tri, LIENS);
  faux('un seul lien écarté sur deux suffit à refuser', verdict.recevable);
  v('et un seul motif est produit', verdict.motifs.length, 1);
}
{
  const tri: Tri = { constats: {}, propositions: {} };
  v('un tri vide est recevable', controlerTri(tri, LIENS).recevable, true);
  v('et n’adopte rien', controlerTri(tri, LIENS).adoptees, []);
}
{
  const tri: Tri = { constats: {}, propositions: { inconnue: 'adoptee' } };
  v(
    'une proposition sans lien connu ne casse rien',
    controlerTri(tri, LIENS).recevable,
    true,
  );
}
v('le plafond de trajectoires est celui de C.8', TRAJECTOIRES_ACTIVES, 3);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’avertissement professionnel, décidé localement\x1b[0m');

v('le catalogue des avertissements ne porte aucun problème', controlerAvertissements(), []);
v('trois domaines en demandent un', [...DOMAINES_A_AVERTISSEMENT], ['corps', 'psyche', 'finances']);

{
  /*
     Le cas qui justifie tout le module : l'IA ne coche rien, et la règle locale
     avertit quand même. Le champ est rempli par la partie dont on se méfie.
  */
  const a = avertissement({ domaine: 'corps', nature: 'habitude', avertissementDeclare: false });
  vrai('une proposition du corps avertit même si l’IA ne l’a pas dit', a.afficher);
  v('et l’origine est la règle locale', a.origine, 'regle');
  vrai('la phrase renvoie à un médecin', a.phrase.includes('médecin'));
}
{
  const a = avertissement({ domaine: 'cognition', nature: 'organisation', avertissementDeclare: true });
  vrai('une proposition anodine avertit si l’IA le demande', a.afficher);
  v('et l’origine est l’IA', a.origine, 'ia');
  vrai('la phrase est alors générale', a.phrase.includes('L’IA a signalé'));
}
{
  const a = avertissement({ domaine: 'psyche', nature: 'question', avertissementDeclare: true });
  v('les deux ensemble se voient', a.origine, 'les-deux');
  vrai('et la phrase est celle du domaine', a.phrase.includes('psychique'));
}
{
  const a = avertissement({ domaine: 'cognition', nature: 'organisation' });
  faux('une proposition d’organisation en cognition n’avertit pas', a.afficher);
  v('et l’origine le dit', a.origine, 'aucune');
  v('la phrase est vide', a.phrase, '');
}
{
  const a = avertissement({ domaine: 'connaissances', nature: 'mesure' });
  vrai('une proposition de mesure avertit, quel que soit son domaine', a.afficher);
  v('par la règle locale', a.origine, 'regle');
}
v('les finances ont leur phrase propre', avertissement({ domaine: 'finances', nature: 'habitude' }).phrase.includes('placement'), true);
vrai('la bannière dit que l’analyse n’est pas vérifiée', BANNIERE_ANALYSE.includes('non vérifiée'));
vrai('et qu’elle ne modifie rien d’elle-même', BANNIERE_ANALYSE.includes('ne modifie aucune'));

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
