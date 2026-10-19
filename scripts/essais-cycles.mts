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
 * - ces chiffres d'essai sont **tous différents des valeurs proposées**, et
 *   l'essai le vérifie. Sans cette vérification, une proposition pourrait
 *   devenir la valeur qui fait passer une mesure, et plus personne ne saurait
 *   si elle a été choisie ou héritée ;
 * - les portes publiques **refusent**, et c'est mesuré aussi.
 *
 * ## Ce qu'il ne peut pas garder
 *
 * Il ne dit pas que les chiffres proposés sont les bons : personne ne peut le
 * dire à partir du code, et c'est précisément pourquoi ils vont à Alexis.
 */
import { readFileSync } from 'node:fs';
import {
  PARAMETRES_DU_SUIVI,
  cyclesDeLHistorique,
  derivationDesCycles,
  fenetresAvantLesRegles,
  fenetresDeLHistorique,
  joursUn,
  parametre,
  parametresEnAttente,
  reglesApplicables,
  statistiques,
  statistiquesDeLHistorique,
  type ReglesDeDerivation,
} from '../src/lib/odyssee/cycles';
import { JAMAIS_CALCULE } from '../src/lib/odyssee/cycle-confidentialite';
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

/*
   LES CHIFFRES D'ESSAI, choisis différents de toutes les propositions.

   C'est vérifié par la section 1 : si l'un venait à coïncider avec une
   proposition, la mesure cesserait de prouver que l'algorithme marche pour
   d'autres chiffres que ceux qu'on espère voir retenus.
*/
const REGLES_DESSAI: ReglesDeDerivation = {
  joursPourOuvrir: 3,
  ecartMinimalEntreJ1: 20,
  dureeMaximaleFiable: 60,
};
const MINIMUM_DESSAI = 4;
const LARGEUR_DESSAI = 7;

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n1. LES SIX PARAMÈTRES, PROPOSÉS ET NON APPLIQUÉS');

v('six paramètres', PARAMETRES_DU_SUIVI.length, 6);
v(
  'aucun n’est appliqué',
  PARAMETRES_DU_SUIVI.filter((p) => p.applique).map((p) => p.cle),
  [],
);
v('donc les six sont en attente', parametresEnAttente().length, 6);
v(
  'et aucun ne rend sa valeur',
  PARAMETRES_DU_SUIVI.map((p) => parametre(p.cle)).filter((x) => x !== null),
  [],
);
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

   Reste ce qui se mesure sans juger : qu'une motivation existe et qu'elle
   soit assez longue pour contenir un raisonnement. **Savoir si elle en
   contient un est le travail d'Alexis**, et c'est précisément pourquoi ces
   six chiffres vont chez lui plutôt que d'être décidés ici.
*/
v(
  'chacun porte une motivation d’au moins deux cents signes',
  PARAMETRES_DU_SUIVI.filter((p) => p.motivation.length < 200).map((p) => p.cle),
  [],
);
v(
  'chacun porte une valeur proposée positive et une unité',
  PARAMETRES_DU_SUIVI.filter((p) => !(p.propose > 0) || !['jours', 'cycles'].includes(p.unite)).map(
    (p) => p.cle,
  ),
  [],
);

/*
   LES CHIFFRES D'ESSAI NE SONT AUCUNE DES PROPOSITIONS.

   C'est la garde qui empêche la confusion la plus facile à commettre ici :
   mesurer l'algorithme avec les valeurs qu'on espère voir retenues, et finir
   par croire qu'elles ont été validées parce que les essais sont verts.
*/
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
};
v(
  'aucun chiffre d’essai n’est la valeur proposée pour son paramètre',
  PARAMETRES_DU_SUIVI.filter((p) => CHIFFRES_DESSAI[p.cle] === p.propose).map((p) => p.cle),
  [],
);
v(
  'et chaque paramètre employé par un calcul a son chiffre d’essai',
  PARAMETRES_DU_SUIVI.filter(
    (p) => p.cle !== 'delai-du-constat-de-retard' && CHIFFRES_DESSAI[p.cle] === undefined,
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
  'et chaque valeur proposée y figure aussi',
  PARAMETRES_DU_SUIVI.filter(
    (p) => !new RegExp(`\\*\\*${p.propose}\\*\\*\\s*${p.unite}`).test(decisions),
  ).map((p) => p.cle),
  [],
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n2. LES PORTES PUBLIQUES REFUSENT, ET DISENT QUOI MANQUE');

const HISTORIQUE: SaisieDuCycle[] = [
  saisie('2026-01-01', 'abondant'),
  saisie('2026-01-02', 'moyen'),
  saisie('2026-01-03', 'leger'),
];

v('aucune règle n’est applicable', reglesApplicables(), null);

const cycles = cyclesDeLHistorique(HISTORIQUE);
v('les cycles sont refusés', 'impossible' in cycles, true);
v(
  'et le refus nomme les trois paramètres manquants',
  'impossible' in cycles ? [...cycles.manquants].sort() : null,
  ['duree-maximale-fiable', 'ecart-minimal-entre-j1', 'jours-pour-ouvrir'],
);

const stats = statistiquesDeLHistorique(HISTORIQUE);
v('les statistiques sont refusées', 'impossible' in stats, true);

const fenetres = fenetresDeLHistorique(HISTORIQUE);
v('les fenêtres sont refusées', 'impossible' in fenetres, true);

/*
   ET LE REFUS NE DÉPEND PAS DE L'HISTORIQUE : un historique vide refuse de la
   même façon. Sans cela, un écran pourrait croire que « rien à montrer » veut
   dire « pas encore de données » alors qu'il veut dire « on ne sait pas
   calculer ».
*/
v('un historique vide refuse aussi', 'impossible' in cyclesDeLHistorique([]), true);

/*
   AUCUN CALCUL NE LIT UNE VALEUR PROPOSÉE.

   Mesuré sur le source : `propose` ne doit être lu qu'à un seul endroit, la
   porte `parametre()`, qui vérifie `applique` d'abord. C'est ce qui rend la
   décision 24 vérifiable plutôt que promise — un commentaire qui jure qu'on
   n'applique rien ne garde rien.
*/
const moduleDesCycles = sansCommentaires(readFileSync('src/lib/odyssee/cycles.ts', 'utf8'));
const lecturesDeProposition = (moduleDesCycles.match(/\.propose\b/g) ?? []).length;
v('`propose` n’est lu qu’une fois dans tout le module', lecturesDeProposition, 1);
v(
  'et cette lecture est gardée par `applique`',
  /if \(!p \|\| !p\.applique\) return null;\s*return p\.propose;/.test(moduleDesCycles),
  true,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n3. LES J1, SELON LA DÉCISION 8');

/*
   « J1 = premier jour de saignement menstruel, traces isolées exclues. »
*/
v(
  'des traces seules n’ouvrent aucun cycle',
  joursUn(
    [saisie('2026-03-01', 'traces'), saisie('2026-03-02', 'traces'), saisie('2026-03-03', 'traces')],
    REGLES_DESSAI,
  ),
  [],
);
v(
  'et des traces au milieu d’un saignement n’en ouvrent pas un second',
  joursUn(
    [
      saisie('2026-03-01', 'moyen'),
      saisie('2026-03-02', 'moyen'),
      saisie('2026-03-03', 'traces'),
      saisie('2026-03-04', 'moyen'),
    ],
    REGLES_DESSAI,
  ),
  [],
);
v(
  'trois jours francs consécutifs ouvrent UN cycle, pas trois',
  joursUn(
    [
      saisie('2026-03-01', 'abondant'),
      saisie('2026-03-02', 'moyen'),
      saisie('2026-03-03', 'leger'),
    ],
    REGLES_DESSAI,
  ),
  ['2026-03-01'],
);
v(
  'deux jours francs ne suffisent pas avec ces règles',
  joursUn([saisie('2026-03-01', 'moyen'), saisie('2026-03-02', 'moyen')], REGLES_DESSAI),
  [],
);
/*
   Le trou du 2 mars coupe la suite : la première suite ne fait qu'un jour, et
   n'ouvre rien. La seconde en fait trois, et ouvre. (Ma première version de ce
   gabarit n'en donnait que deux après le trou et attendait un J1 : c'est moi
   qui comptais mal, pas le code.)
*/
v(
  'un jour sans saisie coupe la suite : il n’est pas un jour sans saignement',
  joursUn(
    [
      saisie('2026-03-01', 'moyen'),
      saisie('2026-03-03', 'moyen'),
      saisie('2026-03-04', 'moyen'),
      saisie('2026-03-05', 'moyen'),
    ],
    REGLES_DESSAI,
  ),
  ['2026-03-03'],
);
v(
  'un « aucun » saisi coupe la suite lui aussi',
  joursUn(
    [
      saisie('2026-03-01', 'moyen'),
      saisie('2026-03-02', 'aucun'),
      saisie('2026-03-03', 'moyen'),
      saisie('2026-03-04', 'moyen'),
      saisie('2026-03-05', 'moyen'),
    ],
    REGLES_DESSAI,
  ),
  ['2026-03-03'],
);

/* L'écart minimal : deux débuts trop proches ne font qu'un cycle. */
const DEUX_DEBUTS_PROCHES = [
  ...['2026-04-01', '2026-04-02', '2026-04-03'].map((j) => saisie(j, 'moyen')),
  ...['2026-04-10', '2026-04-11', '2026-04-12'].map((j) => saisie(j, 'moyen')),
];
v(
  'neuf jours d’écart, avec un minimum de vingt : un seul J1',
  joursUn(DEUX_DEBUTS_PROCHES, REGLES_DESSAI),
  ['2026-04-01'],
);
const DEUX_DEBUTS_LOIN = [
  ...['2026-04-01', '2026-04-02', '2026-04-03'].map((j) => saisie(j, 'moyen')),
  ...['2026-04-29', '2026-04-30', '2026-05-01'].map((j) => saisie(j, 'moyen')),
];
v(
  'vingt-huit jours d’écart : deux J1',
  joursUn(DEUX_DEBUTS_LOIN, REGLES_DESSAI),
  ['2026-04-01', '2026-04-29'],
);
v(
  'et l’ordre des saisies ne change rien',
  joursUn([...DEUX_DEBUTS_LOIN].reverse(), REGLES_DESSAI),
  ['2026-04-01', '2026-04-29'],
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n4. LES CYCLES, ET CELUI QUI EST EN COURS');

const DERIVES = derivationDesCycles(DEUX_DEBUTS_LOIN, REGLES_DESSAI);
v('deux cycles', DERIVES.length, 2);
v('le premier commence au premier J1', DERIVES[0].debut, '2026-04-01');
v('il finit la VEILLE du J1 suivant, qui appartient au cycle d’après', DERIVES[0].fin, '2026-04-28');
v('et sa durée est l’écart entre les deux J1', DERIVES[0].duree, 28);
v('il est fiable', DERIVES[0].fiable, true);
v('le second est en cours : pas de fin', DERIVES[1].fin, null);
v('et pas de durée non plus', DERIVES[1].duree, null);

/* Un écart au-delà du maximum : le cycle reste affiché, mais n'est pas fiable. */
const ECART_ENORME = [
  ...['2026-01-01', '2026-01-02', '2026-01-03'].map((j) => saisie(j, 'moyen')),
  ...['2026-06-01', '2026-06-02', '2026-06-03'].map((j) => saisie(j, 'moyen')),
];
const DERIVES_ENORME = derivationDesCycles(ECART_ENORME, REGLES_DESSAI);
v('un écart de cent-cinquante-un jours donne bien un cycle', DERIVES_ENORME.length, 2);
v('sa durée est rendue telle quelle', DERIVES_ENORME[0].duree, 151);
v('mais il n’est pas fiable', DERIVES_ENORME[0].fiable, false);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n5. LES STATISTIQUES, SUR LA SEULE BASE DE LA PERSONNE');

const CINQ_J1 = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-28', '2026-04-25'].flatMap(
  (debut) => {
    const base = Date.parse(`${debut}T00:00:00Z`);
    return [0, 1, 2].map((d) =>
      saisie(new Date(base + d * 86_400_000).toISOString().slice(0, 10), 'moyen'),
    );
  },
);
const CYCLES_CINQ = derivationDesCycles(CINQ_J1, REGLES_DESSAI);
v('cinq J1 donnent cinq cycles, dont un en cours', CYCLES_CINQ.length, 5);

const STATS_CINQ = statistiques(CYCLES_CINQ, MINIMUM_DESSAI);
v('quatre cycles clos', STATS_CINQ.closIdentifies, 4);
v('les quatre sont fiables', STATS_CINQ.closFiables, 4);
v('aucun n’est écarté', STATS_CINQ.closEcartes, 0);
v('la médiane de 28, 28, 30 et 28', STATS_CINQ.medianeEnJours, 28);
v('la plus courte', STATS_CINQ.plusCourteEnJours, 28);
v('la plus longue', STATS_CINQ.plusLongueEnJours, 30);

/*
   LE MINIMUM : en dessous, pas de médiane. Une médiane sur deux cycles est un
   chiffre qui a l'air d'un savoir, et c'est le sens du paramètre.
*/
const STATS_TROIS = statistiques(CYCLES_CINQ.slice(0, 3), MINIMUM_DESSAI);
v('trois cycles clos pour un minimum de quatre : pas de médiane', STATS_TROIS.medianeEnJours, null);
v('mais les extrêmes sont rendus : ce sont des faits, pas une valeur centrale', STATS_TROIS.plusCourteEnJours, 28);

/* Un cycle non fiable ne pèse pas sur la médiane. */
const AVEC_UN_TROU = [
  ...derivationDesCycles(ECART_ENORME, REGLES_DESSAI),
  ...CYCLES_CINQ.filter((c) => c.duree !== null),
];
const STATS_TROU = statistiques(AVEC_UN_TROU, 1);
v('le cycle de 151 jours est compté comme écarté', STATS_TROU.closEcartes, 1);
v(
  'et la médiane ne le voit pas',
  STATS_TROU.medianeEnJours,
  28,
);

v('aucune statistique vide ne devient zéro', statistiques([], 1), {
  closIdentifies: 0,
  closFiables: 0,
  closEcartes: 0,
  medianeEnJours: null,
  plusCourteEnJours: null,
  plusLongueEnJours: null,
});

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n6. LES FENÊTRES SONT PASSÉES, ET ANCRÉES');

const FENETRES = fenetresAvantLesRegles(CYCLES_CINQ, LARGEUR_DESSAI, '2025-12-01');
v('une fenêtre par cycle', FENETRES.length, CYCLES_CINQ.length);
v('elle est ancrée sur le J1', FENETRES[0].ancre, '2026-01-01');
v('elle finit la veille du J1', FENETRES[0].au, '2025-12-31');
v('et commence sept jours avant', FENETRES[0].du, '2025-12-25');

/*
   On ne fabrique pas des jours qu'on n'a pas : si l'historique commence après
   le début de la fenêtre, la fenêtre n'existe pas. Sans cela, l'écran
   montrerait une fenêtre de jours dont rien n'est su, et une fenêtre vide se
   lit comme une fenêtre calme.
*/
const FENETRES_COURTES = fenetresAvantLesRegles(CYCLES_CINQ, LARGEUR_DESSAI, '2026-01-01');
v(
  'le premier cycle n’a pas de fenêtre si l’historique commence à son J1',
  FENETRES_COURTES.map((f) => f.ancre).includes('2026-01-01'),
  false,
);
v('les quatre autres en ont une', FENETRES_COURTES.length, 4);

/*
   AUCUNE FENÊTRE N'EST DANS L'AVENIR. Mesuré sur toutes les fenêtres rendues :
   chacune finit avant son ancre, et l'ancre est un J1 qui a eu lieu. Une
   fenêtre ancrée sur un J1 attendu serait une prévision, donc une fenêtre
   fertile dès qu'on en déduit quoi que ce soit — décision 12, non levable.
*/
v(
  'chaque fenêtre finit avant son ancre',
  FENETRES.filter((f) => !(f.au < f.ancre) || !(f.du <= f.au)).map((f) => f.ancre),
  [],
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n7. LA DETTE D’ORPHELIN EXPIRE D’ELLE-MÊME');

/*
   Ce module n'est branché à aucun écran, et il ne peut pas l'être : ses portes
   refusent tant qu'Alexis n'a pas répondu, donc un écran qui l'appellerait
   n'afficherait rien. `essais:orphelins` le signalait, à juste titre — « une
   fonction qu'on ne trouve pas n'existe pas ».

   Il porte donc une exception **datée** dans cet essai-là : une dette qu'on
   compte, pas un choix qu'on assume. Et une exception datée a un défaut connu :
   elle survit à sa raison. Celle-ci ne peut pas, parce que les deux
   assertions ci-dessous se contredisent dès que la raison tombe.

   Le jour où un paramètre est appliqué, la seconde rougit et réclame le
   branchement et le retrait de l'exception. Le jour où quelqu'un retire
   l'exception sans brancher, `essais:orphelins` rougit. Il n'y a pas de
   chemin où l'on oublie.
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
v(
  'elle est datée, et non permanente : c’est une dette, pas un choix',
  /chemin: 'src\/lib\/odyssee\/cycles\.ts',\s*\n\s*depuis: '2026-10-19',/.test(
    essaiDesOrphelins,
  ),
  true,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n8. CE QUI N’EST JAMAIS CALCULÉ (DÉCISION 12)');

/*
   `JAMAIS_CALCULE` nomme ce que ce module n'a pas le droit de produire. Ici on
   lit les identifiants exportés de `cycles.ts` : un nom de fonction ou de
   champ qui contiendrait l'un de ces mots serait le premier signe qu'on s'y
   approche.
*/
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
    ? `\n\x1b[32m${PARAMETRES_DU_SUIVI.length} paramètres proposés, aucun appliqué ; ` +
        `l'algorithme mesuré avec des chiffres qui ne sont pas ceux proposés pour leurs paramètres.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
