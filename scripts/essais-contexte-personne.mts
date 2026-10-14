/**
 * La porte unique : ce qu'elle laisse passer, et ce qu'elle refuse.
 *
 * Deux parties. La première éprouve l'arithmétique de l'âge — celle qui se
 * trompe silencieusement, d'un an, pendant la moitié de l'année. La seconde
 * est un **essai sur le graphe d'imports** : elle ne lit pas un résultat, elle
 * lit le code source, et elle échoue si un module contourne la porte.
 *
 * La seconde est la seule qui vaille sur la durée. L'arithmétique, une fois
 * juste, le reste ; la discipline, elle, se perd au premier module pressé.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DECLARATION_VIERGE,
  ageA,
  anneeAberrante,
  franchit,
  moisRequisPour,
  trancheDAge,
  type DeclarationDAge,
} from '../src/lib/noyau/age';
import { BRANCHES } from '../src/lib/branches';
import { CHAMPS, controlerChamps, valider } from '../src/lib/noyau/profil';
import { controlerQuestions, parcours } from '../src/lib/noyau/initialisation';
import { controlerSeuils, SEUILS } from '../src/lib/noyau/seuils-age';
import {
  ETAT_VIERGE,
  NON_USAGES,
  USAGES,
  contextePersonne,
  controlerRegistre,
  usagesLisant,
  type EtatDeLaPersonne,
} from '../src/lib/noyau/registre-usages';

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

const ne = (declaration: Partial<DeclarationDAge>): DeclarationDAge => ({
  ...DECLARATION_VIERGE,
  ...declaration,
});

/* ══════════════════════════════════════════════════════════════════════════
   1. Les fichiers déclaratifs
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. LES FICHIERS DÉCLARATIFS');

v('aucun problème dans les seuils', controlerSeuils(), []);
v('aucun problème dans le registre', controlerRegistre(), []);
v('un seul seuil déclaré, et c’est un constat', SEUILS.length, 1);
v('le seuil de majorité est une règle de produit', SEUILS[0].fondement.type, 'regle-de-produit');
v('les non-usages sont consignés', NON_USAGES.length >= 8, true);

/* ══════════════════════════════════════════════════════════════════════════
   2. L'âge est un intervalle
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n2. L’ÂGE EST UN INTERVALLE');

v('sans année, pas d’âge', ageA(DECLARATION_VIERGE, '2026-10-14'), null);
v(
  'sans le mois, l’âge vaut A−1 ou A',
  ageA(ne({ naissanceAnnee: 1990 }), '2026-10-14'),
  { min: 35, max: 36 },
);
v(
  'anniversaire passé : la fourchette se referme sur A',
  ageA(ne({ naissanceAnnee: 1990, naissanceMois: 3 }), '2026-10-14'),
  { min: 36, max: 36 },
);
v(
  'anniversaire à venir : A−1',
  ageA(ne({ naissanceAnnee: 1990, naissanceMois: 12 }), '2026-10-14'),
  { min: 35, max: 35 },
);
v(
  'le mois de naissance compte pour l’âge le plus bas jusqu’à sa fin',
  ageA(ne({ naissanceAnnee: 1990, naissanceMois: 10 }), '2026-10-14'),
  { min: 35, max: 35 },
);
v(
  'et il bascule le mois suivant',
  ageA(ne({ naissanceAnnee: 1990, naissanceMois: 10 }), '2026-11-01'),
  { min: 36, max: 36 },
);

/* ══════════════════════════════════════════════════════════════════════════
   3. Le seuil, et le bon côté de l'erreur
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n3. LE SEUIL, ET LE BON CÔTÉ DE L’ERREUR');

v('rien de déclaré : indéterminable', franchit(DECLARATION_VIERGE, 'majorite', '2026-10-14'), 'indeterminable');
v(
  'largement majeur : oui',
  franchit(ne({ naissanceAnnee: 1990 }), 'majorite', '2026-10-14'),
  'oui',
);
v(
  'largement mineur : non',
  franchit(ne({ naissanceAnnee: 2015 }), 'majorite', '2026-10-14'),
  'non',
);
v(
  'né en 2008 : 17 ou 18 ans — indéterminable, et surtout pas « non »',
  franchit(ne({ naissanceAnnee: 2008 }), 'majorite', '2026-10-14'),
  'indeterminable',
);
v(
  'le mois lève l’indétermination dans un sens…',
  franchit(ne({ naissanceAnnee: 2008, naissanceMois: 3 }), 'majorite', '2026-10-14'),
  'oui',
);
v(
  '…comme dans l’autre',
  franchit(ne({ naissanceAnnee: 2008, naissanceMois: 12 }), 'majorite', '2026-10-14'),
  'non',
);
v(
  'le mois courant reste du côté prudent',
  franchit(ne({ naissanceAnnee: 2008, naissanceMois: 10 }), 'majorite', '2026-10-14'),
  'non',
);
v(
  '« je suis majeur(e) » suffit, sans année',
  franchit(ne({ majeurDeclare: true }), 'majorite', '2026-10-14'),
  'oui',
);
v(
  'et l’année prime sur la déclaration',
  franchit(ne({ naissanceAnnee: 2015, majeurDeclare: true }), 'majorite', '2026-10-14'),
  'non',
);

console.log('\n   Le mois n’est demandé qu’à la frontière');
v('pas d’année : on ne demande pas le mois', moisRequisPour(DECLARATION_VIERGE, 'majorite', '2026-10-14'), false);
v('loin du seuil : non', moisRequisPour(ne({ naissanceAnnee: 1990 }), 'majorite', '2026-10-14'), false);
v('à la frontière : oui', moisRequisPour(ne({ naissanceAnnee: 2008 }), 'majorite', '2026-10-14'), true);
v(
  'mois déjà connu : on ne le redemande pas',
  moisRequisPour(ne({ naissanceAnnee: 2008, naissanceMois: 3 }), 'majorite', '2026-10-14'),
  false,
);

/* ══════════════════════════════════════════════════════════════════════════
   4. La tranche, à la granularité déclarée
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n4. LA TRANCHE, À LA GRANULARITÉ DÉCLARÉE');

v(
  'bornes larges : une tranche',
  trancheDAge(ne({ naissanceAnnee: 1990, naissanceMois: 3 }), [18, 40, 65], '2026-10-14'),
  '18-39',
);
v(
  'sous la première borne',
  trancheDAge(ne({ naissanceAnnee: 2015, naissanceMois: 3 }), [18, 40, 65], '2026-10-14'),
  'moins de 18',
);
v(
  'au-dessus de la dernière',
  trancheDAge(ne({ naissanceAnnee: 1950, naissanceMois: 3 }), [18, 40, 65], '2026-10-14'),
  '65 et plus',
);
v(
  'fourchette à cheval sur une borne : aucune tranche n’est vraie',
  trancheDAge(ne({ naissanceAnnee: 1986 }), [18, 40, 65], '2026-10-14'),
  null,
);
v('sans année : rien', trancheDAge(DECLARATION_VIERGE, [18, 40], '2026-10-14'), null);

/* ══════════════════════════════════════════════════════════════════════════
   5. La porte
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n5. LA PORTE');

const adulte: EtatDeLaPersonne = {
  ...ETAT_VIERGE,
  age: { naissanceAnnee: 1990, naissanceMois: 3, majeurDeclare: null },
  sexe: 'femme',
};

v(
  'un consommateur absent du registre ne reçoit rien',
  contextePersonne('module.inexistant', adulte, '2026-10-14'),
  {},
);
v(
  'un consommateur qui ne lit que « majeur » ne reçoit pas l’âge',
  contextePersonne('sante.substances-majeur', adulte, '2026-10-14'),
  { majeur: 'oui' },
);
v(
  'et ne reçoit pas non plus le sexe, qu’il n’a pas déclaré lire',
  'sexe_physio' in contextePersonne('sante.substances-majeur', adulte, '2026-10-14'),
  false,
);
v(
  'la tranche est calculée avec les bornes de ce consommateur-là',
  contextePersonne('sante.intervalles-repli', adulte, '2026-10-14'),
  { tranche_age: '18-39', sexe_physio: 'femme' },
);
v(
  'et un autre consommateur, d’autres bornes, la même personne',
  contextePersonne('export.tranche-age', adulte, '2026-10-14').tranche_age,
  '30-39',
);
v(
  'donnée absente : « inconnu », jamais une valeur par défaut',
  contextePersonne('sante.intervalles-repli', ETAT_VIERGE, '2026-10-14'),
  { tranche_age: 'inconnu', sexe_physio: 'inconnu' },
);
v(
  'majeur indéterminable se rend « inconnu », et non « non »',
  contextePersonne('sante.substances-majeur', { ...ETAT_VIERGE, age: ne({ naissanceAnnee: 2008 }) }, '2026-10-14'),
  { majeur: 'inconnu' },
);
v(
  'l’écran « Qui utilise » retrouve les lecteurs d’une clé',
  usagesLisant('sexe_physio').map((u) => u.id).sort(),
  ['export.sexe', 'profil.question-cycle', 'sante.intervalles-repli'],
);

console.log('\n   Après suppression d’un champ, aucun consommateur ne casse');
let planté: string | null = null;
for (const u of USAGES) {
  try {
    const c = contextePersonne(u.id, ETAT_VIERGE, '2026-10-14');
    for (const cle of u.clesLues) {
      if (!(cle in c)) planté = `${u.id} ne rend pas « ${cle} »`;
    }
  } catch (e) {
    planté = `${u.id} a levé : ${(e as Error).message}`;
  }
}
v('les onze usages retombent sur « inconnu » sans erreur', planté, null);

/* ══════════════════════════════════════════════════════════════════════════
   6. Le graphe d'imports : personne ne contourne la porte
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n6. LE GRAPHE D’IMPORTS');

/**
 * Les seuls modules autorisés à nommer les champs bruts ou le calcul d'âge.
 *
 * Deux familles, et la distinction est la raison d'être de la liste.
 *
 * Les trois premiers **sont** la machinerie : calculer l'âge et servir le
 * contexte est leur travail. Les deux derniers **déclarent** les champs — le
 * catalogue et la façon de poser la question — sans jamais lire la valeur
 * d'une personne pour en tirer une conséquence.
 *
 * Tout autre fichier qui nomme un de ces champs le fait pour en lire la
 * valeur, et c'est précisément le contournement que 2.2 interdit. La taille de
 * cette liste est elle-même vérifiée plus bas : l'allonger doit être un geste
 * délibéré, visible en relecture, et non une ligne ajoutée pour faire passer
 * un essai.
 */
const AUTORISES = new Set([
  'src/lib/noyau/age.ts',
  'src/lib/noyau/seuils-age.ts',
  'src/lib/noyau/registre-usages.ts',
  'src/lib/noyau/profil.ts',
  'src/lib/noyau/initialisation.ts',
  'src/lib/etat-personne.ts',
]);

/** Ce qu'aucun autre fichier ne doit nommer. */
const CHAMPS_BRUTS = /\b(naissanceAnnee|naissanceMois|majeurDeclare)\b/;
const IMPORT_AGE = /from\s+['"][^'"]*noyau\/(age|seuils-age)['"]/;

const fichiers: string[] = [];
const parcourir = (dossier: string) => {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) parcourir(chemin);
    else if (/\.(ts|svelte|astro|mts)$/.test(entree)) fichiers.push(chemin);
  }
};
parcourir('src');

const fautes: string[] = [];
for (const chemin of fichiers) {
  const normalise = chemin.replace(/\\/g, '/');
  if (AUTORISES.has(normalise)) continue;
  const texte = readFileSync(chemin, 'utf8');
  /* Les commentaires parlent des champs ; seul le code compte. */
  const code = texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\*.*$/gm, '');
  if (CHAMPS_BRUTS.test(code)) fautes.push(`${normalise} nomme un champ brut`);
  if (IMPORT_AGE.test(code)) fautes.push(`${normalise} importe le calcul d’âge directement`);
}

v(`aucun des ${fichiers.length} fichiers de src/ ne contourne la porte`, fautes, []);
v('la liste des modules autorisés n’a pas grossi en silence', AUTORISES.size, 6);

/* ══════════════════════════════════════════════════════════════════════════
   7. Les champs, dans le profil commun
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n7. LES CHAMPS, DANS LE PROFIL COMMUN');

v('le catalogue de profil est sain', controlerChamps(BRANCHES.map((b) => b.id)), []);
v('chaque question sait se poser', controlerQuestions(), []);

const declares = CHAMPS.filter((c) =>
  ['naissanceAnnee', 'naissanceMois', 'majeurDeclare'].includes(c.champ),
);
v('les trois champs sont déclarés', declares.length, 3);
v(
  'aucun n’est obligatoire',
  declares.some((c) => c.obligatoire === true),
  false,
);
v(
  'aucune branche ne les lit par la portée : le registre seul ouvre',
  declares.map((c) => JSON.stringify(c.porteeParDefaut)),
  ['[]', '[]', '[]'],
);

const auBesoin = CHAMPS.filter((c) => c.demandeAuBesoin).map((c) => c.champ);
v('les champs demandés au besoin, et eux seuls', auBesoin, [
  'naissanceMois',
  'majeurDeclare',
  'usagesCoupes',
]);
v(
  'et ils ne sont donc pas dans le parcours d’initialisation',
  parcours([]).etapes.map((e) => e.declare.champ).filter((c) => auBesoin.includes(c)),
  [],
);
v(
  'l’année, elle, y est — au chapitre « Moi », juste après le nom',
  parcours([]).etapes.map((e) => e.declare.champ).slice(0, 3),
  ['prenom', 'nom', 'naissanceAnnee'],
);

console.log('\n   Une année aberrante se signale, elle ne se refuse pas');
v('1990 ne dit rien', anneeAberrante(1990, '2026-10-14'), null);
v('une année recevable reste recevable', valider('naissanceAnnee', 1066).recevable, true);
v(
  'mais 1066 se fait remarquer',
  anneeAberrante(1066, '2026-10-14'),
  '1066 donnerait plus de 130 ans. Est-ce bien l’année voulue ?',
);
v(
  'le futur aussi',
  anneeAberrante(2030, '2026-10-14'),
  '2030 est dans le futur. Est-ce bien l’année voulue ?',
);

/* ══════════════════════════════════════════════════════════════════════════ */

console.log(
  echecs === 0
    ? `\n\x1b[32mTout est vert.\x1b[0m\n`
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
