/**
 * Les fichiers de thème disent-ils encore ce que le générateur dit ?
 *
 *   npm run essais:themes-a-jour
 *
 * Les quatorze thèmes sont engendrés, mais ils sont **commités** : le site
 * se construit et se prévisualise sans qu'il faille penser à lancer le
 * générateur, et une publication ne dépend pas d'une étape qu'on oublie.
 * Le revers est connu : un fichier engendré et commité se périme en
 * silence. Une retouche de `src/lib/themes.ts` sans `npm run themes`, ou
 * pire, une retouche à la main d'un fichier engendré, et le dépôt affirme
 * une couleur que la source ne dit plus.
 *
 * Cet essai refuse ce silence : il recalcule tout, et compare octet pour
 * octet. S'il est rouge, `npm run themes` le remet d'aplomb.
 */
import { readFileSync } from 'node:fs';
import { fichiersAttendus } from './construire-themes.mts';

let rouges = 0;
for (const [chemin, attendu] of Object.entries(fichiersAttendus())) {
  let obtenu = '';
  try {
    obtenu = readFileSync(chemin, 'utf8');
  } catch {
    console.log(`\x1b[31m✗\x1b[0m ${chemin} — absent. Lancez « npm run themes ».`);
    rouges += 1;
    continue;
  }
  if (obtenu === attendu) {
    console.log(`\x1b[32m✓\x1b[0m ${chemin}`);
    continue;
  }
  const lignesA = attendu.split('\n');
  const lignesB = obtenu.split('\n');
  const premiere = lignesA.findIndex((l, i) => l !== lignesB[i]);
  console.log(
    `\x1b[31m✗\x1b[0m ${chemin} — diffère dès la ligne ${premiere + 1} :\n` +
      `    engendré : ${lignesA[premiere]}\n    sur disque : ${lignesB[premiere] ?? '(fin du fichier)'}`,
  );
  rouges += 1;
}
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
