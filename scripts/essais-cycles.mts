/**
 * Les cycles : l'algorithme est mesuré, et aucun paramètre n'est appliqué.
 *
 *   npm run essais:cycles
 *
 * ## Les deux choses que cet essai garde, et elles tirent en sens opposés
 *
 * La décision 24 veut qu'**aucun chiffre ne soit appliqué** avant la réponse
 * d'Alexis. Le bon sens veut qu'un algorithme non mesuré ne soit pas livré.
 * Les deux ensemble demandent une discipline précise :
 *
 * - les fonctions pures reçoivent leurs chiffres, et les essais les exercent
 *   avec des **chiffres d'essai** ;
 * - ces chiffres d'essai sont différents de la valeur proposée **pour leur
 *   propre paramètre**, et l'essai le vérifie. Sans cela, une proposition
 *   pourrait devenir la valeur qui fait passer une mesure, et plus personne ne
 *   saurait si elle a été choisie ou héritée ;
 * - les portes publiques **refusent**, et c'est mesuré aussi.
 *
 * ## Ce qu'il ne peut pas garder
 *
 * Il ne dit pas que les chiffres proposés sont les bons : personne ne peut le
 * dire à partir du code, et c'est précisément pourquoi ils vont à Alexis.
 */
import { readFileSync } from 'node:fs';
import {
  LIBELLES_DES_FENETRES,
  LIBELLE_DU_JOUR_DE_CYCLE,
  PARAMETRES_DU_SUIVI,
  cyclesDeLHistorique,
  derivationDesCycles,
  dureeDesRegles,
  fenetreDEtude,
  fenetresDUnCycle,
  fenetresDesCycles,
  fenetresDeLHistorique,
  jourDepuisJ1,
  joursAvantProchainJ1,
  joursUn,
  parametre,
  parametresEnAttente,
  reglesApplicables,
  statistiques,
  statistiquesDeLHistorique,
  type ExclusionDeCycle,
  type ReglesDeDerivation,
} from '../src/lib/odyssee/cycles';
import { JAMAIS_CALCULE } from '../src/lib/odyssee/cycle-confidentialite';
import {
  ETAT_VIERGE,
  contextePersonne,
  usage,
  type EtatDeLaPersonne,
} from '../src/lib/noyau/registre-usages';
import type { NiveauDeSaignement, SaisieDuCycle } from '../src/lib/odyssee/cycle';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const sansCommentaires = (texte: string) =>
  texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Une saisie d'essai. L'empreinte n'est pas calculée : rien ici ne la lit. */
const saisie = (jour: string, niveau: NiveauDeSaignement): SaisieDuCycle =>
  ({ id: `essai-${jour}`, jour, niveau, debutDeclare: false, note: '', majLe: '' }) as SaisieDuCycle;

/** Les jours d'une plage, pour fabriquer des règles de plusieurs jours. */
const suite = (debut: string, jours: number, niveau: NiveauDeSaignement = 'moyen') => {
  const base = Date.parse(`${debut}T00:00:00Z`);
  return Array.from({ length: jours }, (_, d) =>
    saisie(new Date(base + d * 86_400_000).toISOString().slice(0, 10), niveau),
  );
};

/*
   LES CHIFFRES D'ESSAI, choisis différents de la proposition de leur paramètre.
   Vérifié en section 1.
*/
const REGLES_DESSAI: ReglesDeDerivation = {
  joursPourOuvrir: 3,
  ecartMinimalEntreJ1: 20,
  dureeMaximaleFiable: 60,
};
const MINIMUM_DESSAI = 4;
const LARGEUR_DESSAI = 9;
const FENETRE_DESSAI = 18;

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n1. LES HUIT PARAMÈTRES, PROPOSÉS ET NON APPLIQUÉS');

v('huit paramètres', PARAMETRES_DU_SUIVI.length, 8);
/*
   SIX SONT APPLIQUÉS DEPUIS LE 25 OCTOBRE, DEUX ATTENDENT — ET CE N'EST PAS
   « LA MOITIÉ DU TRAVAIL ».

   Ce bloc exigeait « aucun n'est appliqué », et il avait raison tant qu'Alexis
   n'avait pas répondu. Il a répondu par délégation au pilote, qui a retenu les
   huit valeurs proposées et autorisé l'application des six premières. Les deux
   dernières restent fermées pour une raison nommée, et non par prudence
   générale : leur motivation dit que le repère FIGO n'a pas été relu à sa
   source.

   L'essai nomme donc les deux clés, une par une. Un contrôle qui se
   contenterait de compter « six appliqués » resterait vert si on appliquait la
   8ᵉ et qu'on fermait la 5ᵉ — c'est-à-dire sur l'inverse de la décision.
*/
const EN_ATTENTE_DU_FIGO = ['tolerance-de-comparaison-des-dates', 'fenetre-par-defaut'];

v(
  'les deux paramètres en attente sont ceux de la réserve FIGO, nommément',
  parametresEnAttente().map((p) => p.cle),
  EN_ATTENTE_DU_FIGO,
);
v(
  'et tous les autres sont appliqués',
  PARAMETRES_DU_SUIVI.filter((p) => !p.applique && !EN_ATTENTE_DU_FIGO.includes(p.cle)).map(
    (p) => p.cle,
  ),
  [],
);
v(
  'un paramètre appliqué rend sa valeur par la porte',
  PARAMETRES_DU_SUIVI.filter((p) => p.applique).map((p) => parametre(p.cle)),
  [2, 15, 90, 3, 5, 7],
);
v(
  'et un paramètre en attente ne rend toujours rien',
  EN_ATTENTE_DU_FIGO.map((c) => parametre(c)),
  [null, null],
);
/*
   LA RÉSERVE EST DANS LE TEXTE, PAS SEULEMENT DANS LE DRAPEAU. Si quelqu'un
   appliquait l'un des deux, ce constat l'obligerait à retirer d'abord la phrase
   qui dit que la source n'a pas été lue — donc à regarder la raison avant le
   drapeau.
*/
for (const cle of EN_ATTENTE_DU_FIGO) {
  const p = PARAMETRES_DU_SUIVI.find((x) => x.cle === cle);
  v(`${cle} : sa motivation dit pourquoi elle attend`, /FIGO/.test(p?.motivation ?? ''), true);
}
v('un paramètre inconnu rend « rien », et ne lève pas', parametre('inexistant'), null);
v(
  'les clés sont uniques',
  new Set(PARAMETRES_DU_SUIVI.map((p) => p.cle)).size,
  PARAMETRES_DU_SUIVI.length,
);

/*
   CE QU'UN ESSAI PEUT MESURER D'UNE MOTIVATION, ET CE QU'IL NE PEUT PAS.

   Ma première version cherchait des tournures — « plus bas », « plus haut » —
   pour vérifier que chaque motivation dit ce que change une autre valeur.
   Deux motivations l'ont fait rougir alors qu'elles le disaient très bien,
   autrement. Un essai qui impose une tournure ne mesure pas la pensée : il
   fabrique des phrases écrites pour lui.

   Reste ce qui se mesure sans juger : qu'une motivation existe et soit assez
   longue pour contenir un raisonnement. **Savoir si elle en contient un est le
   travail d'Alexis**, et c'est précisément pourquoi ces chiffres vont chez lui.
*/
v(
  'chacun porte une motivation d’au moins deux cents signes',
  PARAMETRES_DU_SUIVI.filter((p) => p.motivation.length < 200).map((p) => p.cle),
  [],
);
v(
  'chacun porte une valeur proposée positive et une unité connue',
  PARAMETRES_DU_SUIVI.filter(
    (p) => !(p.propose > 0) || !['jours', 'cycles', 'mois'].includes(p.unite),
  ).map((p) => p.cle),
  [],
);

/*
   PAR PARAMÈTRE, et non en vrac. Ma première version comparait chaque chiffre
   d'essai à TOUTES les propositions, et a rougi parce que trois jours d'essai
   coïncidaient avec trois cycles proposés — deux grandeurs qui n'ont rien à
   voir. Le risque réel est qu'un chiffre d'essai soit la proposition DE CE
   PARAMÈTRE-LÀ : alors la mesure ne prouverait plus que l'algorithme marche
   pour d'autres valeurs que celle qu'on espère voir retenue.
*/
const CHIFFRES_DESSAI: Record<string, number> = {
  'jours-pour-ouvrir': REGLES_DESSAI.joursPourOuvrir,
  'ecart-minimal-entre-j1': REGLES_DESSAI.ecartMinimalEntreJ1,
  'duree-maximale-fiable': REGLES_DESSAI.dureeMaximaleFiable,
  'cycles-avant-une-mediane': MINIMUM_DESSAI,
  'largeur-fenetre-avant': LARGEUR_DESSAI,
  'fenetre-par-defaut': FENETRE_DESSAI,
};
v(
  'aucun chiffre d’essai n’est la valeur proposée pour son paramètre',
  PARAMETRES_DU_SUIVI.filter((p) => CHIFFRES_DESSAI[p.cle] === p.propose).map((p) => p.cle),
  [],
);

/*
   LES DEUX PARAMÈTRES QU'AUCUN CALCUL N'EMPLOIE ENCORE, nommés pour qu'on ne
   croie pas à un oubli :

   - `delai-du-constat-de-retard` sert au message de retard, qui demande une
     plage estimée — donc une estimation, donc un lot ultérieur ;
   - `tolerance-de-comparaison-des-dates` sert à comparer à un repère, et
     AUCUN repère publié n'est dans Cyclades : le 4.4.3 demande de re-vérifier
     chaque nombre FIGO à la source, ce que personne n'a fait.

   Les deux sont proposés quand même, parce que la décision 24 demande des
   chiffres soumis, pas des chiffres employés.
*/
const SANS_CALCUL = ['delai-du-constat-de-retard', 'tolerance-de-comparaison-des-dates'];
v(
  'tout paramètre employé par un calcul a son chiffre d’essai',
  PARAMETRES_DU_SUIVI.filter(
    (p) => !SANS_CALCUL.includes(p.cle) && CHIFFRES_DESSAI[p.cle] === undefined,
  ).map((p) => p.cle),
  [],
);

/*
   LA CONCORDANCE AVEC LE DOCUMENT qu'Alexis lira. Une proposition qui
   changerait dans le code sans changer là-bas le ferait répondre à une
   question qui n'est plus posée.
*/
const decisions = readFileSync(
  'docs/cyclades/decisions-en-attente-cycle-2026-10-19.md',
  'utf8',
);
v(
  'chaque clé de paramètre est nommée dans les décisions en attente',
  PARAMETRES_DU_SUIVI.filter((p) => !decisions.includes(p.cle)).map((p) => p.cle),
  [],
);
v(
  'et chaque valeur proposée y figure avec son unité',
  PARAMETRES_DU_SUIVI.filter(
    (p) => !new RegExp(`\\*\\*${p.propose}\\*\\*\\s*${p.unite}`).test(decisions),
  ).map((p) => p.cle),
  [],
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n2. LES PORTES PUBLIQUES REFUSENT, ET DISENT QUOI MANQUE');

const HISTORIQUE = suite('2026-01-01', 3);

/*
   DEUX PORTES CALCULENT, UNE REFUSE ENCORE — ET C'EST LE CŒUR DU LOT.

   Ces constats exigeaient que les trois portes refusent. Deux ne refusent plus,
   parce que leurs chiffres sont tranchés ; la troisième refuse toujours, parce
   qu'elle lit `fenetre-par-defaut`. L'essai distingue donc les deux cas au lieu
   d'attendre un refus partout : c'est la différence entre « on ne sait pas
   calculer » et « on ne veut pas affirmer sans source ».
*/
v('les règles de dérivation sont applicables', reglesApplicables(), {
  joursPourOuvrir: 2,
  ecartMinimalEntreJ1: 15,
  dureeMaximaleFiable: 90,
});

const cycles = cyclesDeLHistorique(HISTORIQUE);
v('les cycles se calculent', 'impossible' in cycles, false);
/*
   TROIS JOURS, UN CYCLE — et mon premier intitulé disait « trois cycles ».
   `suite('2026-01-01', 3)` fabrique trois jours de saignement CONSÉCUTIFS,
   donc un seul J1, donc un seul cycle, en cours. Le module avait raison et mon
   constat était faux : il annonçait trois et obtenait un. Corrigé en nommant ce
   que la suite contient, et complété par un historique qui porte vraiment
   plusieurs cycles — sans quoi le compte ne mesurait rien.
*/
v(
  'trois jours de saignement ne font qu’un cycle, en cours',
  'impossible' in cycles ? null : cycles.cycles.map((c) => c.complet),
  [false],
);

/*
   UN HISTORIQUE À TROIS J1 ESPACÉS : deux cycles complets, et le troisième en
   cours. C'est la convention du 4.4.1 — un cycle va d'un J1 au J1 suivant —,
   donc trois J1 ne font jamais trois cycles clos.
*/
const TROIS_J1 = [
  ...suite('2026-01-01', 3),
  ...suite('2026-01-29', 3),
  ...suite('2026-02-26', 3),
];
const surTroisJ1 = cyclesDeLHistorique(TROIS_J1);
v(
  'trois premiers jours espacés font deux cycles complets et un en cours',
  'impossible' in surTroisJ1 ? null : surTroisJ1.cycles.map((c) => c.complet),
  [true, true, false],
);
v(
  'et les deux cycles clos font vingt-huit jours chacun',
  'impossible' in surTroisJ1 ? null : surTroisJ1.cycles.map((c) => c.duree),
  [28, 28, null],
);

v('les fenêtres se calculent', 'impossible' in fenetresDeLHistorique(HISTORIQUE), false);

/*
   LA SEULE PORTE ENCORE FERMÉE, ET SON REFUS NE NOMME PLUS QU'UNE CLÉ. Le
   chiffre compte : si le refus en nommait trois, c'est que les paramètres de
   dérivation seraient retombés en attente, et l'écran dirait à la personne une
   raison qui n'est pas la bonne.
*/
const resume = statistiquesDeLHistorique(HISTORIQUE);
v('les statistiques refusent toujours', 'impossible' in resume, true);
v(
  'et leur refus ne nomme que la fenêtre d’étude',
  'impossible' in resume ? [...resume.manquants] : null,
  ['fenetre-par-defaut'],
);

/*
   UN HISTORIQUE VIDE NE REFUSE PLUS : IL REND ZÉRO CYCLE, ce qui n'est pas la
   même chose. Avant, « rien à montrer » voulait dire « on ne sait pas
   calculer » ; maintenant cela veut dire « vous n'avez rien noté », et l'écran
   doit pouvoir distinguer les deux phrases. C'est pourquoi ce constat change
   de sens au lieu de disparaître.
*/
const surRien = cyclesDeLHistorique([]);
v('un historique vide ne refuse plus', 'impossible' in surRien, false);
v('il rend zéro cycle', 'impossible' in surRien ? null : surRien.cycles.length, 0);

/*
   AUCUN CALCUL NE LIT UNE VALEUR PROPOSÉE.

   Mesuré sur le source : `propose` ne doit être lu qu'à un seul endroit, la
   porte `parametre()`, qui vérifie `applique` d'abord. C'est ce qui rend la
   décision 24 vérifiable plutôt que promise — un commentaire qui jure qu'on
   n'applique rien ne garde rien.
*/
const moduleDesCycles = sansCommentaires(readFileSync('src/lib/odyssee/cycles.ts', 'utf8'));
v('`propose` n’est lu qu’une fois dans tout le module', (moduleDesCycles.match(/\.propose\b/g) ?? []).length, 1);
v(
  'et cette lecture est gardée par `applique`',
  /if \(!p \|\| !p\.applique\) return null;\s*return p\.propose;/.test(moduleDesCycles),
  true,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n3. LES J1, SELON LA DÉCISION 8');

v(
  'des traces seules n’ouvrent aucun cycle',
  joursUn(suite('2026-03-01', 4, 'traces'), REGLES_DESSAI),
  [],
);
/*
   DES TRACES AU MILIEU NE FONT PAS DEUX CYCLES, et il faut dire comment.

   Elles coupent bien la suite de jours francs — une journée de traces n'est
   pas un jour de saignement menstruel —, donc la seconde moitié devient un
   candidat. C'est l'écart minimal qui l'absorbe : quatre jours après le
   premier J1, c'est le même épisode.

   Ma première version de ce gabarit donnait deux jours avant les traces et
   trois après, et attendait aucun J1. Elle en obtenait un, à juste titre :
   avec trois jours pour ouvrir, seule la seconde moitié ouvrait. Le gabarit
   ne mesurait pas ce que son nom annonçait.
*/
v(
  'et des traces au milieu d’un saignement n’en ouvrent pas un second',
  joursUn(
    [...suite('2026-03-01', 3), saisie('2026-03-04', 'traces'), ...suite('2026-03-05', 3)],
    REGLES_DESSAI,
  ),
  ['2026-03-01'],
);
v(
  'trois jours francs consécutifs ouvrent UN cycle, pas trois',
  joursUn(suite('2026-03-01', 3), REGLES_DESSAI),
  ['2026-03-01'],
);
v(
  'deux jours francs ne suffisent pas avec ces règles',
  joursUn(suite('2026-03-01', 2), REGLES_DESSAI),
  [],
);
/*
   Le trou du 2 mars coupe la suite : la première ne fait qu'un jour et n'ouvre
   rien. La seconde en fait trois, et ouvre. (Ma première version de ce gabarit
   n'en donnait que deux après le trou et attendait un J1 : c'est moi qui
   comptais mal, pas le code.)
*/
v(
  'un jour sans saisie coupe la suite : il n’est pas un jour sans saignement',
  joursUn([saisie('2026-03-01', 'moyen'), ...suite('2026-03-03', 3)], REGLES_DESSAI),
  ['2026-03-03'],
);
v(
  'un « aucun » saisi coupe la suite lui aussi',
  joursUn(
    [saisie('2026-03-01', 'moyen'), saisie('2026-03-02', 'aucun'), ...suite('2026-03-03', 3)],
    REGLES_DESSAI,
  ),
  ['2026-03-03'],
);

/* L'écart minimal : deux débuts trop proches ne font qu'un cycle. */
v(
  'neuf jours d’écart, avec un minimum de vingt : un seul J1',
  joursUn([...suite('2026-04-01', 3), ...suite('2026-04-10', 3)], REGLES_DESSAI),
  ['2026-04-01'],
);
const DEUX_LOIN = [...suite('2026-04-01', 3), ...suite('2026-04-29', 3)];
v('vingt-huit jours d’écart : deux J1', joursUn(DEUX_LOIN, REGLES_DESSAI), [
  '2026-04-01',
  '2026-04-29',
]);
v('et l’ordre des saisies ne change rien', joursUn([...DEUX_LOIN].reverse(), REGLES_DESSAI), [
  '2026-04-01',
  '2026-04-29',
]);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n4. LES CYCLES : COMPLET, EN COURS, ET LA LONGUEUR DU 4.4.1');

const DERIVES = derivationDesCycles(DEUX_LOIN, REGLES_DESSAI);
v('deux cycles', DERIVES.length, 2);
v('le premier commence au premier J1', DERIVES[0].debut, '2026-04-01');
v('il porte le J1 suivant, qui le clôt', DERIVES[0].suivant, '2026-04-29');
v('il est COMPLET : ses deux J1 sont connus', DERIVES[0].complet, true);
v('son dernier jour compris est la veille du J1 suivant', DERIVES[0].fin, '2026-04-28');
v('et sa longueur est l’écart entre les deux J1', DERIVES[0].duree, 28);
v('il est fiable', DERIVES[0].fiable, true);
v('le second est en cours : pas de J1 suivant', DERIVES[1].suivant, null);
v('donc il n’est pas complet', DERIVES[1].complet, false);
v('et il n’a ni fin ni longueur', [DERIVES[1].fin, DERIVES[1].duree], [null, null]);

/* Un écart au-delà du maximum : le cycle reste affiché, mais n'est pas fiable. */
const SAISIES_ENORME = [...suite('2026-01-01', 3), ...suite('2026-06-01', 3)];
const ENORME = derivationDesCycles(SAISIES_ENORME, REGLES_DESSAI);
v('un écart de cent-cinquante-un jours donne bien un cycle', ENORME.length, 2);
v('sa longueur est rendue telle quelle', ENORME[0].duree, 151);
v('il reste complet', ENORME[0].complet, true);
v('mais il n’est pas fiable', ENORME[0].fiable, false);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n5. LA DURÉE DES RÈGLES');

const CINQ_JOURS = suite('2026-05-01', 5);
v('cinq jours francs consécutifs', dureeDesRegles(CINQ_JOURS, '2026-05-01'), 5);
v(
  'des traces après les règles ne les allongent pas',
  dureeDesRegles([...suite('2026-05-01', 3), saisie('2026-05-04', 'traces')], '2026-05-01'),
  3,
);
v(
  'un trou les arrête : un jour sans saisie n’est pas un jour de règles',
  dureeDesRegles([...suite('2026-05-01', 2), ...suite('2026-05-04', 2)], '2026-05-01'),
  2,
);
v(
  'et un J1 sans saisie franche rend « on ne sait pas », pas zéro',
  dureeDesRegles([saisie('2026-05-01', 'traces')], '2026-05-01'),
  null,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n6. LES STATISTIQUES, SUR LA SEULE BASE DE LA PERSONNE');

/* Cinq J1, quatre cycles clos de 28, 28, 30 et 28 jours, règles de 3 jours. */
const CINQ_J1 = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-28', '2026-04-25'].flatMap(
  (d) => suite(d, 3),
);
const CYCLES_CINQ = derivationDesCycles(CINQ_J1, REGLES_DESSAI);
v('cinq J1 donnent cinq cycles, dont un en cours', CYCLES_CINQ.length, 5);

const STATS = statistiques(CYCLES_CINQ, CINQ_J1, [], MINIMUM_DESSAI, null);
v('quatre cycles complets', STATS.complets, 4);
v('les quatre sont retenus', STATS.retenus, 4);
v('rien n’est écarté', STATS.ecartes, { pourDuree: 0, parStatut: 0, parLaPersonne: 0 });
v('l’effectif suffit', STATS.suffisant, true);
v('donc rien ne manque', STATS.ceQuiManque, null);
v('la médiane de 28, 28, 30 et 28', STATS.longueur?.medianeEnJours, 28);
v('la dispersion robuste : l’écart absolu médian', STATS.longueur?.dispersionEnJours, 0);
v('le minimum', STATS.longueur?.minEnJours, 28);
v('le maximum', STATS.longueur?.maxEnJours, 30);
v('la variation, écart du plus long au plus court (4.4.2)', STATS.variationEnJours, 2);
v('et la durée des règles, sur les mêmes cycles', STATS.dureeDesReglesEnJours?.medianeEnJours, 3);

/*
   LA DISPERSION EST ROBUSTE, et cela se mesure : un cycle très long ne la fait
   pas exploser comme le ferait un écart-type. C'est ce qu'il faut ici, parce
   qu'un historique de cycles contient presque toujours un épisode qui n'est
   pas du bruit mais qui n'est pas la règle non plus.
*/
/*
   IL FALLAIT UN CYCLE LONG **ET FIABLE** POUR MESURER LA ROBUSTESSE.

   Ma première version mettait un cycle de 67 jours, au-delà de la durée
   maximale d'essai : il était écarté par `fiable` avant d'atteindre la
   médiane, donc la mesure ne disait rien de la dispersion. Quarante-cinq jours
   reste en dessous du maximum, donc entre dans le calcul — et c'est là qu'un
   écart-type aurait explosé là où l'écart absolu médian ne bouge pas.
*/
const AVEC_UN_LONG = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-05-10'].flatMap(
  (d) => suite(d, 3),
);
const CYCLES_LONG = derivationDesCycles(AVEC_UN_LONG, REGLES_DESSAI);
const STATS_LONG = statistiques(CYCLES_LONG, AVEC_UN_LONG, [], MINIMUM_DESSAI, null);
v('quatre cycles complets, dont un de 45 jours', STATS_LONG.complets, 4);
v('les quatre sont retenus : 45 reste sous le maximum', STATS_LONG.retenus, 4);
v('la médiane tient', STATS_LONG.longueur?.medianeEnJours, 28);
v('et la dispersion reste nulle malgré le long', STATS_LONG.longueur?.dispersionEnJours, 0);
v('alors que la variation, elle, le voit', STATS_LONG.variationEnJours, 17);

/*
   L'EFFECTIF MINIMAL : en dessous, pas de médiane, et l'écran dit CE QUI
   MANQUE — 4.4.2, « "données insuffisantes", avec ce qui manque ». Un écran
   qui dit seulement « insuffisant » laisse la personne sans rien à faire.
*/
const STATS_TROIS = statistiques(CYCLES_CINQ.slice(0, 3), CINQ_J1, [], MINIMUM_DESSAI, null);
v('trois cycles complets pour un minimum de quatre', STATS_TROIS.retenus, 3);
v('l’effectif ne suffit pas', STATS_TROIS.suffisant, false);
v('et ce qui manque est dit, au singulier accordé', STATS_TROIS.ceQuiManque, 'Il manque 1 cycle complet.');
v('aucune longueur n’est rendue', STATS_TROIS.longueur, null);
v('aucune variation non plus', STATS_TROIS.variationEnJours, null);

const STATS_UN = statistiques(CYCLES_CINQ.slice(0, 2), CINQ_J1, [], MINIMUM_DESSAI, null);
v('et au pluriel quand il en manque plusieurs', STATS_UN.ceQuiManque, 'Il manque 2 cycles complets.');

v('un historique sans cycle ne devient pas zéro partout', statistiques([], [], [], 1, null), {
  fenetre: null,
  complets: 0,
  retenus: 0,
  ecartes: { pourDuree: 0, parStatut: 0, parLaPersonne: 0 },
  suffisant: false,
  ceQuiManque: 'Il manque 1 cycle complet.',
  longueur: null,
  variationEnJours: null,
  dureeDesReglesEnJours: null,
});

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n7. LES EXCLUSIONS : JAMAIS EN SILENCE, TOUJOURS RÉINTÉGRABLES');

/*
   4.4.1 : un cycle « peut être exclu des calculs par un statut (4.2) ou par
   moi ("cycle perturbé", avec un motif libre) : jamais retiré en silence,
   toujours visible et réintégrable ».

   Trois choses à mesurer, et la troisième est celle qu'on oublie : que le
   retrait de l'exclusion suffise à réintégrer.
*/
const EXCLUSIONS: ExclusionDeCycle[] = [
  { debut: '2026-02-26', par: 'personne', motif: 'cycle perturbé : voyage' },
];
const STATS_EXCLU = statistiques(CYCLES_CINQ, CINQ_J1, EXCLUSIONS, 3, null);
v('le cycle exclu reste COMPTÉ comme complet : il est visible', STATS_EXCLU.complets, 4);
v('mais il n’est plus retenu', STATS_EXCLU.retenus, 3);
v('et l’écran sait par qui', STATS_EXCLU.ecartes, {
  pourDuree: 0,
  parStatut: 0,
  parLaPersonne: 1,
});
v(
  'la médiane change, puisque le cycle de 30 jours est parti',
  STATS_EXCLU.longueur?.maxEnJours,
  28,
);

const PAR_STATUT: ExclusionDeCycle[] = [
  { debut: '2026-01-29', par: 'statut', motif: 'Contraception' },
];
v(
  'un statut écarte aussi, et se distingue d’un retrait par la personne',
  statistiques(CYCLES_CINQ, CINQ_J1, PAR_STATUT, 3, null).ecartes,
  { pourDuree: 0, parStatut: 1, parLaPersonne: 0 },
);

v(
  'RETIRER L’EXCLUSION RÉINTÈGRE : rien n’a été effacé',
  statistiques(CYCLES_CINQ, CINQ_J1, [], 3, null).retenus,
  statistiques(CYCLES_CINQ, CINQ_J1, EXCLUSIONS, 3, null).retenus + 1,
);

v(
  'une exclusion qui ne désigne aucun cycle n’écarte rien',
  statistiques(CYCLES_CINQ, CINQ_J1, [{ debut: '2000-01-01', par: 'personne', motif: 'x' }], 3, null)
    .retenus,
  4,
);

/*
   Un cycle non fiable est écarté lui aussi, et compté à part. Il faut pour
   cela un cycle réellement au-delà du maximum : celui de 45 jours de
   `AVEC_UN_LONG` reste dessous, et c'est voulu — il sert à mesurer la
   dispersion. Celui-ci fait 151 jours.
*/
const STATS_NON_FIABLE = statistiques(ENORME, SAISIES_ENORME, [], 1, null);
v('le cycle de 151 jours est écarté pour sa durée', STATS_NON_FIABLE.ecartes.pourDuree, 1);
v('il reste compté comme complet : visible', STATS_NON_FIABLE.complets, 1);
v('mais rien n’est retenu', STATS_NON_FIABLE.retenus, 0);
v('donc aucune longueur', STATS_NON_FIABLE.longueur, null);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n8. LA FENÊTRE D’ÉTUDE');

/*
   Dix-huit mois avant le 27 avril 2026, c'est le 28 octobre 2024 — et non
   2025, que j'avais écrit en comptant douze mois par distraction. Le chiffre
   d'essai est dix-huit précisément pour qu'il ne soit pas la proposition.
*/
v(
  'elle part du DERNIER JOUR SAISI, pas d’aujourd’hui',
  fenetreDEtude(CINQ_J1, FENETRE_DESSAI),
  { du: '2024-10-28', au: '2026-04-27' },
);
v('sans aucune saisie, aucune fenêtre', fenetreDEtude([], FENETRE_DESSAI), null);
v(
  'et un cycle hors fenêtre n’est pas compté',
  statistiques(CYCLES_CINQ, CINQ_J1, [], 1, { du: '2026-03-01', au: '2026-04-30' }).complets,
  1,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n9. LES DEUX COORDONNÉES DU JOUR (4.5)');

v('le J1 est le jour 1, et non le jour 0', jourDepuisJ1('2026-01-01', CYCLES_CINQ), 1);
v('le lendemain est le jour 2', jourDepuisJ1('2026-01-02', CYCLES_CINQ), 2);
v('le dernier jour du premier cycle est le jour 28', jourDepuisJ1('2026-01-28', CYCLES_CINQ), 28);
v('et le jour suivant repart à 1, dans le cycle d’après', jourDepuisJ1('2026-01-29', CYCLES_CINQ), 1);
v('un jour antérieur à tout cycle n’a pas de coordonnée', jourDepuisJ1('2025-12-01', CYCLES_CINQ), null);

v(
  'les jours avant le prochain J1 se comptent quand il est observé',
  joursAvantProchainJ1('2026-01-01', CYCLES_CINQ),
  28,
);
v('et la veille du J1 suivant vaut 1', joursAvantProchainJ1('2026-01-28', CYCLES_CINQ), 1);
/*
   LE CYCLE EN COURS N'A PAS CETTE COORDONNÉE, et c'est le point du 4.5 :
   « une fois le J1 suivant connu ». Un compte à rebours vers un J1 attendu
   serait une prévision, donc ce que la décision 12 refuse sans levée.
*/
v(
  'mais le cycle en cours n’en a pas : ce serait une prévision',
  joursAvantProchainJ1('2026-04-26', CYCLES_CINQ),
  null,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n10. LES TROIS FENÊTRES, ET SEULEMENT SUR LES CYCLES COMPLETS');

const FENETRES = fenetresDesCycles(CYCLES_CINQ, CINQ_J1, LARGEUR_DESSAI);
v(
  'aucune fenêtre pour le cycle en cours',
  FENETRES.filter((f) => f.ancre === '2026-04-25').length,
  0,
);
v('les quatre cycles complets en ont trois chacune', FENETRES.length, 12);

const DU_PREMIER = FENETRES.filter((f) => f.ancre === '2026-01-01');
v(
  'les trois genres, dans l’ordre du cycle',
  DU_PREMIER.map((f) => f.genre),
  ['jours-de-regles', 'avant-les-regles', 'reste-du-cycle'],
);
v('les jours de règles partent du J1', DU_PREMIER[0], {
  genre: 'jours-de-regles',
  ancre: '2026-01-01',
  du: '2026-01-01',
  au: '2026-01-03',
});
/*
   LA FENÊTRE D'AVANT EST ANCRÉE SUR LE J1 SUIVANT, et c'était mon erreur.

   Ma première version la calculait sur le J1 du cycle lui-même : les N jours
   qui précèdent son début. Ces jours existent et sont passés, donc rien ne
   rougissait — mais ils appartiennent au cycle PRÉCÉDENT, dont ils annonçaient
   les règles. Le prompt dit « les N jours précédant les règles SUIVANTES ».
*/
v('la fenêtre d’avant finit la veille du J1 suivant', DU_PREMIER[1].au, '2026-01-28');
v('et commence neuf jours plus tôt', DU_PREMIER[1].du, '2026-01-20');
v('le reste du cycle est entre les deux', DU_PREMIER[2], {
  genre: 'reste-du-cycle',
  ancre: '2026-01-01',
  du: '2026-01-04',
  au: '2026-01-19',
});

/*
   AUCUNE FENÊTRE NE SORT DE SON CYCLE. Mesuré sur toutes : une fenêtre qui
   remonterait avant son J1 compterait deux fois les mêmes jours, et une qui
   dépasserait le J1 suivant empiéterait sur le cycle d'après.
*/
const bornesDeSonCycle = (f: (typeof FENETRES)[number]) => {
  const cycle = CYCLES_CINQ.find((c) => c.debut === f.ancre);
  return cycle !== undefined && f.du >= cycle.debut && f.au <= (cycle.fin as string);
};
v('chaque fenêtre tient dans son cycle', FENETRES.filter((f) => !bornesDeSonCycle(f)), []);
v('et chacune va du plus tôt au plus tard', FENETRES.filter((f) => f.du > f.au), []);

/*
   UN CYCLE COURT AUX RÈGLES LONGUES : le reste du cycle est vide, et la
   fenêtre n'est pas rendue — plutôt qu'une plage inversée, qu'un appelant
   lirait comme un intervalle.
*/
/*
   Un cycle de 21 jours avec 12 jours de règles et 9 jours de fenêtre d'avant :
   12 + 9 = 21, les deux fenêtres se touchent exactement et le reste est vide.
   Ma première version mettait 8 jours de règles, ce qui laissait quatre jours
   de reste — le gabarit ne produisait pas le cas qu'il annonçait.
*/
const COURT = [...suite('2026-07-01', 12), ...suite('2026-07-22', 3)];
const CYCLES_COURT = derivationDesCycles(COURT, REGLES_DESSAI);
const FENETRES_COURT = fenetresDesCycles(CYCLES_COURT, COURT, LARGEUR_DESSAI);
v('le cycle fait bien 21 jours', CYCLES_COURT[0].duree, 21);
v('et les règles 12 jours', dureeDesRegles(COURT, '2026-07-01'), 12);
v(
  'pas de « reste du cycle » quand les deux autres se touchent',
  FENETRES_COURT.filter((f) => f.genre === 'reste-du-cycle').length,
  0,
);

/*
   LE RABOTAGE DE LA FENÊTRE D'AVANT, mesuré en l'exerçant pour de vrai.

   Avec les chiffres d'essai, il ne s'exerce jamais : l'écart minimal entre
   deux J1 (20) est plus grand que la largeur de la fenêtre (9), donc la
   fenêtre ne peut pas remonter avant le J1 de son cycle. Mon assertion
   précédente lisait une borne et ne prouvait rien.

   On appelle donc `fenetresDUnCycle` directement avec une largeur absurde :
   trente jours sur un cycle de vingt-et-un. La fenêtre est rabotée au J1, et
   le reste du cycle disparaît — ce qui est la seule réponse juste, puisqu'une
   fenêtre qui remonterait plus haut compterait deux fois les jours du cycle
   précédent.
*/
const ABSURDE = fenetresDUnCycle(CYCLES_COURT[0], COURT, 30);
v(
  'une largeur plus grande que le cycle est rabotée au J1',
  ABSURDE.find((f) => f.genre === 'avant-les-regles'),
  { genre: 'avant-les-regles', ancre: '2026-07-01', du: '2026-07-01', au: '2026-07-21' },
);
v(
  'et il ne reste alors aucun « reste du cycle »',
  ABSURDE.filter((f) => f.genre === 'reste-du-cycle').length,
  0,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n11. LES LIBELLÉS QUE 4.5 IMPOSE');

v('les trois libellés de fenêtre, mot pour mot', Object.values(LIBELLES_DES_FENETRES), [
  'jours de règles',
  'avant les règles',
  'reste du cycle',
]);
v('et celui de la coordonnée', LIBELLE_DU_JOUR_DE_CYCLE, 'jour du cycle');
v(
  'aucun ne porte de présupposé hormonal',
  [...Object.values(LIBELLES_DES_FENETRES), LIBELLE_DU_JOUR_DE_CYCLE].filter((l) =>
    /follicul|lutéal|luteal|ovul/i.test(l),
  ),
  [],
);
v(
  'et le module ne nomme aucune phase hormonale',
  (moduleDesCycles.match(/follicul|lut[ée]al/gi) ?? []).length,
  0,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n12. LA DETTE D’ORPHELIN EXPIRE D’ELLE-MÊME');

/*
   Ce module n'est branché à aucun écran, et il ne peut pas l'être : ses portes
   refusent tant qu'Alexis n'a pas répondu, donc un écran qui l'appellerait
   n'afficherait rien. `essais:orphelins` le signalait, à juste titre — « une
   fonction qu'on ne trouve pas n'existe pas ».

   Il porte donc une exception **datée** là-bas : une dette qu'on compte, pas
   un choix qu'on assume. Et une exception datée a un défaut connu : elle
   survit à sa raison. Celle-ci ne peut pas, parce que les deux assertions
   ci-dessous se contredisent dès que la raison tombe.
*/
const essaiDesOrphelins = readFileSync('scripts/essais-orphelins.mjs', 'utf8');
const exceptionPosee = essaiDesOrphelins.includes("chemin: 'src/lib/odyssee/cycles.ts'");
const auMoinsUnApplique = PARAMETRES_DU_SUIVI.some((p) => p.applique);

v(
  'tant qu’aucun paramètre n’est appliqué, l’exception est déclarée',
  auMoinsUnApplique || exceptionPosee,
  true,
);
v(
  'et dès qu’un paramètre l’est, l’exception doit avoir été retirée',
  auMoinsUnApplique && exceptionPosee,
  false,
);
/*
   L'EXCEPTION A ÉTÉ RETIRÉE LE 25 OCTOBRE, ET CE CONSTAT LE DIT MAINTENANT.

   Il vérifiait qu'elle était DATÉE et non permanente — « une dette qu'on
   compte, pas un choix qu'on assume ». Elle a tenu sa promesse : appliquer un
   paramètre l'a rendue contradictoire, donc elle est partie, et le module est
   atteint par `corps/suivi.astro`.

   Ce qui reste à tenir est l'inverse de ce qui était tenu : que l'exception ne
   REVIENNE pas. La reposer serait déclarer orphelin un module qu'un écran
   appelle, c'est-à-dire mentir dans l'autre sens.
*/
v('l’exception d’orphelin n’est plus déclarée', exceptionPosee, false);
v(
  'et plus aucune date du 19 octobre ne la rattache à ce module',
  /odyssee\/cycles\.ts/.test(essaiDesOrphelins),
  false,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n13. LES STATISTIQUES SONT FERMÉES AUX MINEURS, LE JOURNAL RESTE');

/*
   4.1 du prompt 30, décision 5 : « sous 18 ans, mode "journal seul" : saisie
   des règles et des symptômes, sans statistiques de cycle, sans comparaison à
   un repère, sans estimation, sans signal d'orientation, mais avec les
   symptômes d'urgence ».

   Deux choses sont mesurées, et la seconde est celle qu'on oublie : que la
   couche de calcul **ne connaisse pas l'âge**. Si elle le lisait, la règle
   serait appliquée à deux endroits, donc tôt ou tard à un seul.
*/
const usageDesStatistiques = usage('suivi.statistiques-majeur');
v('l’usage est déclaré', usageDesStatistiques !== undefined, true);
v('et il lit la majorité, pas l’âge exact', usageDesStatistiques?.clesLues, ['majeur']);
v(
  'son effet visible dit que le journal reste',
  /journal reste/.test(usageDesStatistiques?.effetVisible ?? ''),
  true,
);
v(
  'et que « Quand consulter » reste accessible à tous',
  /Quand consulter[\s\S]*tous/.test(usageDesStatistiques?.effetVisible ?? ''),
  true,
);
v(
  'son « si inconnu » dit que l’âge inconnu ferme',
  /âge inconnu ferme/.test(usageDesStatistiques?.siInconnu ?? ''),
  true,
);

const LE_JOUR = '2026-10-19';
const majeurPour = (etat: EtatDeLaPersonne, coupes: readonly string[] = []) =>
  contextePersonne('suivi.statistiques-majeur', etat, LE_JOUR, coupes).majeur;

v(
  'une personne née en 1990 est majeure',
  majeurPour({ ...ETAT_VIERGE, age: { naissanceAnnee: 1990, naissanceMois: 3, majeurDeclare: null } }),
  'oui',
);
v(
  'une personne née en 2015 ne l’est pas',
  majeurPour({ ...ETAT_VIERGE, age: { naissanceAnnee: 2015, naissanceMois: 3, majeurDeclare: null } }),
  'non',
);
v('rien de déclaré rend « inconnu », et non « oui »', majeurPour(ETAT_VIERGE), 'inconnu');
v(
  'et couper l’usage ne rend rien du tout',
  contextePersonne(
    'suivi.statistiques-majeur',
    { ...ETAT_VIERGE, age: { naissanceAnnee: 1990, naissanceMois: 3, majeurDeclare: null } },
    LE_JOUR,
    ['suivi.statistiques-majeur'],
  ),
  {},
);

/*
   LA PORTE N'OUVRE QUE SUR « oui ». Lu sur le source, parce que la fonction
   demande une base et un coffre : ce qui est gardé ici est qu'elle compare à
   `'oui'` et non à l'absence de `'non'` — la différence étant « inconnu », qui
   doit fermer.
*/
const portee = sansCommentaires(readFileSync('src/lib/odyssee/portee-du-suivi.ts', 'utf8'));
v(
  'la porte des statistiques exige « oui »',
  /contexte\.majeur === 'oui'/.test(portee),
  true,
);
v(
  'et elle ne se contente pas d’écarter « non »',
  /majeur !== 'non'/.test(portee),
  false,
);
v(
  'elle exige d’abord que le suivi soit visible',
  /if \(!\(await leSuiviEstVisibleMaintenant\(\)\)\) return false;/.test(portee),
  true,
);

/*
   ET LA COUCHE DE CALCUL IGNORE L'ÂGE. Elle ne doit pas le lire : la règle se
   tient à la porte, et un module qui connaîtrait l'âge inviterait à la
   reprendre chez lui — donc à l'oublier à un endroit le jour où elle change.
*/
v(
  'le module des cycles ne nomme ni l’âge ni la majorité',
  (moduleDesCycles.match(/\bmajeur\b|\bnaissance|\bage\b/gi) ?? []).length,
  0,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n14. CE QUI N’EST JAMAIS CALCULÉ (DÉCISION 12)');

const identifiants = [
  ...moduleDesCycles.matchAll(/export (?:function|const|interface|type) (\w+)/g),
].map((m) => m[1]);
v('le module exporte des identifiants', identifiants.length > 10, true);
const suspects = identifiants.filter((nom) =>
  JAMAIS_CALCULE.some((interdit) =>
    nom.toLowerCase().includes(interdit.toLowerCase().replace(/[^a-z]/g, '')),
  ),
);
v('et aucun ne nomme ce qui ne doit jamais être calculé', suspects, []);
v(
  'aucune mention de fertilité, d’ovulation ou de contraception dans le code',
  (moduleDesCycles.match(/fertil|ovulat|contracept|prevision|prediction/gi) ?? []).map((m) =>
    m.toLowerCase(),
  ),
  [],
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs === 0
    ? `\n\x1b[32m${PARAMETRES_DU_SUIVI.filter((p) => p.applique).length} paramètres ` +
        `appliqués, ${parametresEnAttente().length} en attente du repère FIGO ; ` +
        `l'algorithme mesuré avec des chiffres qui ne sont pas ceux proposés pour leurs ` +
        `paramètres.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
