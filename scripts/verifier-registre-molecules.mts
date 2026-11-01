/**
 * LE REGISTRE DES MOLÉCULES, CONTRÔLÉ SUR LES DONNÉES RÉELLES.
 *
 *   npm run verifier:registre-molecules
 *
 * ## Le trou que ce script ferme
 *
 * `controlerRegistre` existe dans `src/lib/odyssee/molecules.ts` depuis le
 * prompt 25, et il refuse beaucoup : un champ inconnu, un champ interdit — une
 * `categorie`, une `provenance` —, un identifiant en double, une entrée qui se
 * dit vérifiée sans nomenclature, un registre mal trié.
 *
 * **Rien ne l'appelait sur le vrai fichier.** Mesuré le 31 octobre : seuls des
 * essais le nourrissaient d'entrées fabriquées, et `build-content.mjs` lisait
 * `content/sante/molecules.json` pour le chiffrer et le livrer **sans le
 * consulter**. Un registre réel portant un champ interdit passait donc dans le
 * site construit, et le garde-fou restait vert sur ses propres exemples.
 *
 * C'est la même forme de défaut qu'un balayage qui n'a rien lu : la règle
 * existe, elle est juste, et elle ne s'applique à rien.
 *
 * ## Pourquoi un script à part, et en `.mts`
 *
 * La règle vit en TypeScript, dans `src/`, et c'est là qu'elle doit rester :
 * l'écran de santé et ce contrôle doivent refuser la même chose, et deux
 * copies d'une règle dérivent. `build-content.mjs` est du JavaScript lancé par
 * `node`, qui ne sait pas importer ce module. Ce script-ci est donc lancé par
 * `tsx`, importe la règle telle quelle, et se place dans la chaîne du contenu
 * **avant** la construction.
 *
 * ## L'absence du fichier n'est pas une faute
 *
 * `content/` ne vit pas dans le dépôt, et le site se construit sans registre —
 * le menu retombe alors sur le catalogue de Cyclades, et le dit. Ce script
 * suit la même règle que le build : absent, il le dit et rend 0. Mais il
 * **refuse de se taire** : un fichier présent et illisible est une faute, et
 * un fichier vide aussi.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { controlerRegistre, type EntreeRegistre } from '../src/lib/odyssee/molecules';

const racine = path.resolve(import.meta.dirname, '..');
const chemin = path.join(racine, 'content', 'sante', 'molecules.json');

if (!existsSync(chemin)) {
  console.log(
    'Registre des molécules : « content/sante/molecules.json » est absent.\n' +
      '  Ce n’est pas une faute — le menu retombe sur le catalogue de Cyclades.\n' +
      '  Rien à contrôler.',
  );
  process.exit(0);
}

let entrees: EntreeRegistre[];
try {
  const brut: unknown = JSON.parse(readFileSync(chemin, 'utf8'));
  if (!Array.isArray(brut)) {
    console.error('✗ REFUS — le registre n’est pas une liste.');
    process.exit(1);
  }
  entrees = brut as EntreeRegistre[];
} catch (erreur) {
  console.error(`✗ REFUS — le registre est illisible : ${(erreur as Error).message}`);
  process.exit(1);
}

/*
   UN REGISTRE VIDE EST REFUSÉ, et c'est le contrôle qui compte le plus ici.

   Zéro problème sur zéro entrée est le verdict d'un fichier vide ET celui d'un
   registre impeccable : les deux se lisent « ✓ ». Un fichier tronqué par une
   extraction interrompue passerait donc pour une réussite, et le menu
   retomberait silencieusement sur le catalogue alors que le fichier est là.
*/
if (entrees.length === 0) {
  console.error(
    '✗ REFUS — le registre est présent mais VIDE.\n' +
      '  Un fichier vide rend le même « aucun problème » qu’un registre juste.\n' +
      '  Relancez « npm run molecules:registre », ou retirez le fichier.',
  );
  process.exit(1);
}

const problemes = controlerRegistre(entrees);
const classees = entrees.filter((e) => e.classe != null && e.classe !== '').length;

if (problemes.length > 0) {
  console.error(`\n✗ ${problemes.length} problème dans le registre des molécules :\n`);
  for (const p of problemes) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ Registre des molécules : ${entrees.length} entrées, aucun problème ` +
    `(${classees} portant une classe).`,
);
