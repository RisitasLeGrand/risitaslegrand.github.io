/**
 * Les orphelins : un module que seuls les essais atteignent.
 *
 *   npm run essais:orphelins
 *
 * ## Pourquoi ce contrôle existe
 *
 * Le 15 octobre 2026, trois phases entières du prompt 38 ont été livrées
 * avec leurs essais verts et **aucun écran qui les appelle**. Le défaut
 * était invisible à toute la batterie : chaque module avait son essai, et
 * l'essai était son seul importateur. « Essais verts » en était venu à
 * vouloir dire « livré ».
 *
 * Ce script dit la seule chose qu'aucun essai unitaire ne peut dire : **ce
 * module est-il atteignable depuis une page du site ?** Il part de
 * `src/pages`, `src/layouts` et `src/components`, suit les imports en
 * largeur, et compare le résultat à l'inventaire de `src/lib`.
 *
 * ## Ce qu'il ne sait pas faire, et qu'il vaut mieux savoir
 *
 * Il lit les spécificateurs par expression régulière, et ne résout que les
 * chemins **relatifs**. Un `import()` dont le chemin est calculé lui
 * échappe. Ce n'est pas un analyseur de dépendances : c'est un garde-fou,
 * et un garde-fou qui se trompe dans le sens du silence — il peut manquer
 * un appelant exotique, il n'en invente jamais.
 *
 * Au moment où il est écrit, le dépôt ne contient **aucun alias d'import** :
 * la résolution relative suffit donc. Si un alias apparaît un jour, ce
 * script déclarera des orphelins à tort, et c'est lui qu'il faudra corriger.
 *
 * ## Les exceptions
 *
 * Chacune porte sa raison et sa date. Une exception **datée** est une dette
 * qu'on compte ; une exception **permanente** est un choix qu'on assume. Il
 * n'y a pas de troisième sorte, et surtout pas la liste qu'on allonge sans
 * la lire.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Chaque exception dit pourquoi, et jusqu'à quand. */
const EXCEPTIONS = [
  {
    chemin: 'src/lib/sync/simulateur.ts',
    permanente: true,
    pourquoi:
      'Un simulateur de fusion : son objet est d’être appelé par des essais. ' +
      'L’appeler depuis un écran serait le défaut, pas l’inverse.',
  },
  {
    chemin: 'src/lib/notifications/recalcul.ts',
    depuis: '2026-10-15',
    pourquoi: 'Prompt 32, phase 3. Se branche à la phase 5, avec les résolveurs de source.',
  },
];

const tous = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tous(p, out);
    else out.push(p);
  }
  return out;
};

const resoudre = (depuis, spec) => {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(depuis), spec);
  const candidats = [base, `${base}.ts`, `${base}.mts`, `${base}.astro`, `${base}.svelte`, join(base, 'index.ts')];
  for (const c of candidats) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
};

const SPECIFICATEUR = /(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
const specificateursDe = (f) => [...readFileSync(f, 'utf8').matchAll(SPECIFICATEUR)].map((m) => m[1]);

const depart = ['src/pages', 'src/layouts', 'src/components']
  .flatMap((d) => tous(join(RACINE, d)))
  .filter((f) => /\.(astro|ts|svelte)$/.test(f));

const atteints = new Set();
const file = [...depart];
while (file.length) {
  const f = file.pop();
  if (atteints.has(f)) continue;
  atteints.add(f);
  for (const spec of specificateursDe(f)) {
    const cible = resoudre(f, spec);
    if (cible && !atteints.has(cible)) file.push(cible);
  }
}

const modules = tous(join(RACINE, 'src/lib')).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
const orphelins = modules.filter((f) => !atteints.has(f)).map((f) => relative(RACINE, f)).sort();

const parChemin = new Map(EXCEPTIONS.map((e) => [e.chemin, e]));
const nonDeclares = orphelins.filter((c) => !parChemin.has(c));
const perimees = EXCEPTIONS.filter((e) => !orphelins.includes(e.chemin));

console.log(`\nModules de src/lib : ${modules.length}`);
console.log(`Atteints depuis les écrans : ${modules.length - orphelins.length}`);
console.log(`Orphelins : ${orphelins.length}, dont ${EXCEPTIONS.length - perimees.length} déclarés\n`);

for (const c of orphelins) {
  const e = parChemin.get(c);
  if (!e) continue;
  const marque = e.permanente ? 'permanente' : `datée du ${e.depuis}`;
  console.log(`  \x1b[32m✓\x1b[0m ${c}\n      exception ${marque} — ${e.pourquoi}`);
}

let echecs = 0;
for (const c of nonDeclares) {
  echecs += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${c}\n      \x1b[31mOrphelin non déclaré.\x1b[0m Aucun écran ne l’atteint. ` +
      'Branchez-le, supprimez-le, ou déclarez-le ici avec sa raison.',
  );
}

/*
   Une exception qui ne sert plus est un mensonge en puissance : elle dira
   « ce module est connu pour être orphelin » le jour où il cessera de
   l'être, puis couvrira son prochain détachement sans que personne ne s'en
   avise. On la retire.
*/
for (const e of perimees) {
  echecs += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${e.chemin}\n      \x1b[31mException périmée.\x1b[0m ` +
      'Ce module est désormais atteint depuis un écran : retirez sa ligne.',
  );
}

console.log(
  echecs === 0
    ? '\n\x1b[32mAucun orphelin non déclaré.\x1b[0m\n'
    : `\n\x1b[31m${echecs} problème(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
