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
  franchit,
  moisRequisPour,
  trancheDAge,
  type DeclarationDAge,
} from '../src/lib/noyau/age';
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
  ageA(ne({ anneeNaissance: 1990 }), '2026-10-14'),
  { min: 35, max: 36 },
);
v(
  'anniversaire passé : la fourchette se referme sur A',
  ageA(ne({ anneeNaissance: 1990, moisNaissance: 3 }), '2026-10-14'),
  { min: 36, max: 36 },
);
v(
  'anniversaire à venir : A−1',
  ageA(ne({ anneeNaissance: 1990, moisNaissance: 12 }), '2026-10-14'),
  { min: 35, max: 35 },
);
v(
  'le mois de naissance compte pour l’âge le plus bas jusqu’à sa fin',
  ageA(ne({ anneeNaissance: 1990, moisNaissance: 10 }), '2026-10-14'),
  { min: 35, max: 35 },
);
v(
  'et il bascule le mois suivant',
  ageA(ne({ anneeNaissance: 1990, moisNaissance: 10 }), '2026-11-01'),
  { min: 36, max: 36 },
);

/* ══════════════════════════════════════════════════════════════════════════
   3. Le seuil, et le bon côté de l'erreur
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n3. LE SEUIL, ET LE BON CÔTÉ DE L’ERREUR');

v('rien de déclaré : indéterminable', franchit(DECLARATION_VIERGE, 'majorite', '2026-10-14'), 'indeterminable');
v(
  'largement majeur : oui',
  franchit(ne({ anneeNaissance: 1990 }), 'majorite', '2026-10-14'),
  'oui',
);
v(
  'largement mineur : non',
  franchit(ne({ anneeNaissance: 2015 }), 'majorite', '2026-10-14'),
  'non',
);
v(
  'né en 2008 : 17 ou 18 ans — indéterminable, et surtout pas « non »',
  franchit(ne({ anneeNaissance: 2008 }), 'majorite', '2026-10-14'),
  'indeterminable',
);
v(
  'le mois lève l’indétermination dans un sens…',
  franchit(ne({ anneeNaissance: 2008, moisNaissance: 3 }), 'majorite', '2026-10-14'),
  'oui',
);
v(
  '…comme dans l’autre',
  franchit(ne({ anneeNaissance: 2008, moisNaissance: 12 }), 'majorite', '2026-10-14'),
  'non',
);
v(
  'le mois courant reste du côté prudent',
  franchit(ne({ anneeNaissance: 2008, moisNaissance: 10 }), 'majorite', '2026-10-14'),
  'non',
);
v(
  '« je suis majeur(e) » suffit, sans année',
  franchit(ne({ majeurDeclare: true }), 'majorite', '2026-10-14'),
  'oui',
);
v(
  'et l’année prime sur la déclaration',
  franchit(ne({ anneeNaissance: 2015, majeurDeclare: true }), 'majorite', '2026-10-14'),
  'non',
);

console.log('\n   Le mois n’est demandé qu’à la frontière');
v('pas d’année : on ne demande pas le mois', moisRequisPour(DECLARATION_VIERGE, 'majorite', '2026-10-14'), false);
v('loin du seuil : non', moisRequisPour(ne({ anneeNaissance: 1990 }), 'majorite', '2026-10-14'), false);
v('à la frontière : oui', moisRequisPour(ne({ anneeNaissance: 2008 }), 'majorite', '2026-10-14'), true);
v(
  'mois déjà connu : on ne le redemande pas',
  moisRequisPour(ne({ anneeNaissance: 2008, moisNaissance: 3 }), 'majorite', '2026-10-14'),
  false,
);

/* ══════════════════════════════════════════════════════════════════════════
   4. La tranche, à la granularité déclarée
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n4. LA TRANCHE, À LA GRANULARITÉ DÉCLARÉE');

v(
  'bornes larges : une tranche',
  trancheDAge(ne({ anneeNaissance: 1990, moisNaissance: 3 }), [18, 40, 65], '2026-10-14'),
  '18-39',
);
v(
  'sous la première borne',
  trancheDAge(ne({ anneeNaissance: 2015, moisNaissance: 3 }), [18, 40, 65], '2026-10-14'),
  'moins de 18',
);
v(
  'au-dessus de la dernière',
  trancheDAge(ne({ anneeNaissance: 1950, moisNaissance: 3 }), [18, 40, 65], '2026-10-14'),
  '65 et plus',
);
v(
  'fourchette à cheval sur une borne : aucune tranche n’est vraie',
  trancheDAge(ne({ anneeNaissance: 1986 }), [18, 40, 65], '2026-10-14'),
  null,
);
v('sans année : rien', trancheDAge(DECLARATION_VIERGE, [18, 40], '2026-10-14'), null);

/* ══════════════════════════════════════════════════════════════════════════
   5. La porte
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n5. LA PORTE');

const adulte: EtatDeLaPersonne = {
  ...ETAT_VIERGE,
  age: { anneeNaissance: 1990, moisNaissance: 3, majeurDeclare: null },
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
  contextePersonne('sante.substances-majeur', { ...ETAT_VIERGE, age: ne({ anneeNaissance: 2008 }) }, '2026-10-14'),
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

/** Les seuls modules autorisés à toucher les champs bruts ou le calcul d'âge. */
const AUTORISES = new Set([
  'src/lib/noyau/age.ts',
  'src/lib/noyau/seuils-age.ts',
  'src/lib/noyau/registre-usages.ts',
]);

/** Ce qu'aucun autre fichier ne doit nommer. */
const CHAMPS_BRUTS = /\b(anneeNaissance|moisNaissance|majeurDeclare)\b/;
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

/* ══════════════════════════════════════════════════════════════════════════ */

console.log(
  echecs === 0
    ? `\n\x1b[32mTout est vert.\x1b[0m\n`
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
