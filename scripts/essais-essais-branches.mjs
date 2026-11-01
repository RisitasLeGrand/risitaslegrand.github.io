/**
 * TOUT FICHIER D'ESSAI EST BRANCHÉ À UN SCRIPT `npm`.
 *
 *   npm run essais:essais-branches
 *
 * ## Le défaut que ce balayage garde, et pourquoi il est pire qu'un rouge
 *
 * Un essai rouge se voit. Un fichier d'essai qu'aucun script `npm` ne nomme
 * **ne tourne pas du tout** : ni le socle ni la batterie complète ne le
 * voient, puisque la batterie joue les scripts et non les fichiers. Son
 * silence se lit alors comme une absence de défaut.
 *
 * Mesuré le 31 octobre 2026 : **huit fichiers sur 346** étaient dans ce cas,
 * et les huit étaient verts — **118 assertions vertes et muettes**, dont cinq
 * qui gardaient la seule chose qu'aucun autre essai ne garde, à savoir qu'un
 * coffre laissé seul se referme vraiment. Ils ont été branchés le
 * 1er novembre ; ce balayage est ce qui empêche le neuvième.
 *
 * Rien ne s'y opposait : personne ne l'avait écrit. C'est la même famille que
 * le vert à vide, en pire — il n'y a même pas de vert.
 *
 * ## Ce qu'il NE garde pas, et qui porte un nom voisin
 *
 * `essais:orphelins` garde autre chose : un **module** que seuls les essais
 * atteignent, c'est-à-dire du code livré que nul écran n'appelle. Celui-ci
 * garde un **fichier d'essai** que nul script n'appelle. Les deux noms se
 * ressemblent et les deux défauts sont inverses : là, du code sans usage ;
 * ici, un contrôle sans passage.
 *
 * ## Pourquoi il refuse quand il n'a rien lu
 *
 * Zéro orphelin et zéro fichier lu se rendraient de la même façon. Un dossier
 * renommé, une extension oubliée, un motif trop strict rendraient donc le vert
 * d'une mesure qui n'a rien mesuré — devant un `&&` que personne ne relit.
 * C'est la règle du 31 octobre : **un analyseur cassé ne lève pas, il rend
 * zéro, et zéro est ce que rend un dépôt propre.**
 *
 * Il refuse donc, code 2, s'il ne lit aucun fichier d'essai ou aucun script.
 *
 * ## Et il s'éprouve dans les deux sens
 *
 * La reconnaissance est une fonction pure — elle prend la liste des fichiers
 * et celle des scripts — donc elle se contrôle sans toucher au disque. Ce
 * qu'elle doit voir est contrôlé d'abord : sans cela, un balayage qui ne
 * trouve plus jamais rien resterait vert sur tous les autres contrôles.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const racine = path.resolve(import.meta.dirname, '..');
const vert = (t) => `\u001b[32m${t}\u001b[0m`;
const rouge = (t) => `\u001b[31m${t}\u001b[0m`;

let echecs = 0;
function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    echecs += 1;
    console.log(
      `  ${rouge('✗')} ${quoi} — attendu ${JSON.stringify(attendu)}, ` +
        `obtenu ${JSON.stringify(obtenu)}`,
    );
  }
}

/**
 * Les fichiers d'essai que nul script ne nomme.
 *
 * Le motif cherche `scripts/<nom>` dans la commande, et non le nom seul : un
 * script qui mentionnerait `essais-coffre.mjs` dans un commentaire ou un
 * message ne compte pas pour un branchement.
 *
 * @param fichiers les noms de fichiers d'essai, sans leur dossier
 * @param commandes les commandes des scripts `npm`, dans n'importe quel ordre
 */
export function essaisNonBranches(fichiers, commandes) {
  const nommes = new Set(
    commandes.flatMap((commande) =>
      [...commande.matchAll(/scripts\/(essais-[a-z0-9-]+\.m[jt]s)/g)].map((m) => m[1]),
    ),
  );
  return fichiers.filter((f) => !nommes.has(f));
}

console.log('\nCE QUE LA RECONNAISSANCE DOIT VOIR');

/*
   CELUI-CI D'ABORD, et c'est le seul qui prouve que les autres mesurent encore
   quelque chose : une reconnaissance qui ne trouverait plus jamais rien
   resterait verte sur tout le reste de ce fichier.
*/
verifier(
  'un fichier que nul script ne nomme est vu',
  essaisNonBranches(['essais-seul.mjs'], ['node scripts/essais-autre.mjs']),
  ['essais-seul.mjs'],
);
verifier(
  'et il est vu parmi des fichiers branchés',
  essaisNonBranches(
    ['essais-a.mjs', 'essais-seul.mts', 'essais-b.mjs'],
    ['node scripts/essais-a.mjs', 'tsx scripts/essais-b.mjs'],
  ),
  ['essais-seul.mts'],
);
/*
   LE NOM SEUL NE SUFFIT PAS. Un script qui citerait un fichier d'essai dans
   un message, un commentaire ou une variable ne le fait pas tourner. Sans ce
   contrôle, une mention de passage suffirait à déclarer un essai branché.
*/
verifier(
  'un fichier seulement MENTIONNÉ, hors chemin, reste non branché',
  essaisNonBranches(['essais-cite.mjs'], ['echo "voir essais-cite.mjs pour la suite"']),
  ['essais-cite.mjs'],
);

console.log('\nCE QU’ELLE NE DOIT PAS VOIR');

verifier(
  'un fichier nommé par son chemin est branché',
  essaisNonBranches(['essais-a.mjs'], ['node scripts/essais-a.mjs']),
  [],
);
verifier(
  'un fichier nommé dans une commande enchaînée est branché',
  essaisNonBranches(
    ['essais-a.mjs', 'essais-b.mts'],
    ['node scripts/essais-a.mjs && tsx scripts/essais-b.mts'],
  ),
  [],
);
verifier(
  'deux scripts qui nomment le même fichier ne le dédoublent pas',
  essaisNonBranches(['essais-a.mjs'], ['node scripts/essais-a.mjs', 'node scripts/essais-a.mjs']),
  [],
);
verifier('aucun fichier : aucune faute', essaisNonBranches([], ['node scripts/essais-a.mjs']), []);

console.log('\nET LE DÉPÔT LUI-MÊME');

const fichiers = readdirSync(path.join(racine, 'scripts')).filter((f) =>
  /^essais-.*\.(mjs|mts)$/.test(f),
);
const scripts = JSON.parse(readFileSync(path.join(racine, 'package.json'), 'utf8')).scripts ?? {};
const commandes = Object.values(scripts);

/*
   LE REFUS, ET C'EST LE CONTRÔLE QUI COMPTE LE PLUS DE TOUT CE FICHIER.

   Zéro orphelin et zéro fichier lu se rendent de la même façon. Un dossier
   renommé, une extension oubliée, un motif trop strict rendraient donc le vert
   d'une mesure qui n'a rien mesuré, devant un `&&` que personne ne relit.
*/
if (fichiers.length === 0 || commandes.length === 0) {
  console.error(
    `\n✗ REFUS — ${fichiers.length} fichier d’essai et ${commandes.length} script lus.\n` +
      '  Ce dépôt en porte plus de trois cents : un balayage qui n’en lit aucun ne\n' +
      '  mesure rien, et son silence ne vaut pas un verdict.\n',
  );
  process.exit(2);
}

const nonBranches = essaisNonBranches(fichiers, commandes);
verifier(
  `aucun fichier d’essai sans script npm (${fichiers.length} fichiers, ${commandes.length} scripts)`,
  nonBranches,
  [],
);

/*
   ET LE CONTRE-EXEMPLE SUR LES DONNÉES RÉELLES : un fichier fabriqué, absent
   du dossier, doit être vu comme non branché par les commandes réelles. Sans
   lui, le contrôle au-dessus serait vert aussi bien parce que le dépôt est
   propre que parce que la reconnaissance a cessé de chercher.
*/
verifier(
  'sabotage : un neuvième fichier, non branché, serait vu',
  essaisNonBranches([...fichiers, 'essais-neuvieme-orphelin.mjs'], commandes),
  ['essais-neuvieme-orphelin.mjs'],
);

console.log(
  echecs === 0
    ? `\n${vert('✓')} tout fichier d’essai est branché à un script npm.\n`
    : `\n${rouge('✗')} ${echecs} ${echecs === 1 ? 'contrôle' : 'contrôles'} en échec.\n`,
);
process.exit(echecs > 0 ? 1 : 0);
