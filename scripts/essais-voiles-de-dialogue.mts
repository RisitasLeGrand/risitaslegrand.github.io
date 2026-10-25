/**
 * Aucun voile de `<dialog>` n'est écrit en dur (point 1 du lot C-D, 43).
 *
 *   npm run essais:voiles
 *
 * ## Le défaut
 *
 * Le voile derrière une boîte modale — le `::backdrop` — était écrit en dur au
 * `slate-900` de Tailwind sur deux `<dialog>` : celui du détail d'un exercice
 * et celui de la redemande du mot de passe. Il restait donc **bleuté dans les
 * quatorze thèmes**, là où `.boite::backdrop` tire depuis longtemps sa couleur
 * de `--etat-ombre`. Le même défaut avait déjà été corrigé une fois, sur la
 * boîte commune, et son commentaire le raconte : c'est précisément le genre de
 * valeur qui revient par une autre porte.
 *
 * ## Pourquoi un relevé plutôt qu'un contrôle à l'œil
 *
 * Un voile faux ne se voit que dans un thème sombre coloré, sur l'écran
 * précis qui le porte. À l'œil, il faudrait ouvrir quatorze thèmes sur chaque
 * `<dialog>` du site. Le relevé, lui, lit tous les fichiers et ne dépend de
 * l'attention de personne — y compris de la mienne, le jour où j'ajouterai un
 * dialogue.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
const vrai = (quoi: string, condition: boolean) => v(quoi, condition, true);

function fichiers(racine: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(astro|ts|svelte)$/.test(entree)) sortie.push(chemin);
  }
  return sortie;
}

/**
 * Un voile écrit en dur : la variante `backdrop:` de Tailwind suivie d'une
 * couleur. `backdrop:blur-…` ou `backdrop:opacity-…` ne sont pas des couleurs
 * et passent — c'est la COULEUR qui doit venir du thème, pas tout le reste.
 */
const VOILE_EN_DUR = /backdrop:(bg|from|via|to)-[a-z]+-\d/g;

console.log('\n1. AUCUN VOILE DE DIALOGUE N’EST ÉCRIT EN DUR');

const coupables: string[] = [];
for (const fichier of fichiers('src')) {
  for (const trouve of readFileSync(fichier, 'utf8').match(VOILE_EN_DUR) ?? []) {
    coupables.push(`${fichier} : ${trouve}`);
  }
}
v('aucune couleur de voile en dur dans « src »', coupables, []);

console.log('\n2. LA COULEUR DU THÈME N’EST DÉCLARÉE QU’UNE FOIS');

const css = readFileSync('src/styles/global.css', 'utf8');
/*
   Une seule règle porte la valeur, et les deux sélecteurs la partagent :
   deux règles jumelles auraient dérivé, et c'est exactement ce qui est arrivé
   la première fois.
*/
const regle = /\.boite::backdrop,\s*\.voile-du-theme::backdrop\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
vrai('les deux sélecteurs partagent la même règle', regle.length > 0);
vrai(
  'et elle tire sa couleur de l’ombre du thème',
  /color-mix\([^)]*var\(--etat-ombre\)/.test(regle),
);
v(
  'la valeur n’est écrite qu’une fois dans la feuille',
  (css.match(/\.voile-du-theme::backdrop/g) ?? []).length,
  1,
);

console.log('\n3. LES DEUX DIALOGUES CONNUS PORTENT LA CLASSE');

/*
   Nommés, et non comptés : un jour où l'un des deux perdrait sa classe, un
   compte global resterait vert si un troisième l'avait prise.
*/
for (const [fichier, quoi] of [
  ['src/pages/sport/exercices.astro', 'le détail d’un exercice'],
  ['src/lib/redemande.ts', 'la redemande du mot de passe'],
  /*
     LE TROISIÈME, QUE PERSONNE N'AVAIT VU.

     La commande en nommait deux, et mon propre relevé en avait trouvé deux —
     parce qu'il ne lisait que les `.astro` et les `.ts`. Le dialogue de
     l'assistant est un composant Svelte, et il portait le même voile en dur.
     C'est le relevé de cet essai, qui balaie aussi les `.svelte`, qui l'a
     sorti. Nommé ici pour qu'il ne redevienne pas invisible.
  */
  ['src/features/assistant/composants/DemanderALIA.svelte', 'la demande à l’assistant'],
] as const) {
  vrai(`${quoi} porte « voile-du-theme »`, /voile-du-theme/.test(readFileSync(fichier, 'utf8')));
}

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
