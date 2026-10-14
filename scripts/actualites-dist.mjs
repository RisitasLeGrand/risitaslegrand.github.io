#!/usr/bin/env node
/**
 * Place les **vraies** actualités du dépôt dans « dist/ », pour mesurer
 * l'archive en local :
 *
 *   npm run build && npm run actualites:dist && npx astro preview
 *
 * ## Pourquoi ce script existe
 *
 * Les actualités ne viennent pas du build : elles sont dans « actualites-data/ »,
 * chiffrées avec la clé publique de la rubrique, et c'est « npm run deploy » qui
 * les copie à côté du site. En local, « dist/ » ne contient que les quelques
 * entrées de démonstration de « npm run actualites:local » — une semaine, un
 * mois, un trimestre, une année. Mesurer la longueur de l'archive sur une seule
 * semaine ne mesure rien.
 *
 * Ce script copie les entrées réelles et **reconstruit l'inventaire** à partir
 * des fichiers présents. Sans cet inventaire, le navigateur emprunte la voie de
 * secours — le sondage — et ne voit pas la rubrique telle qu'elle est en ligne.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il n'écrit que dans « dist/ », qui est ignoré par Git, et ne déchiffre rien :
 * les fichiers sont recopiés tels quels. Il ne touche ni au dépôt, ni au site
 * publié.
 */
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chiffrerPourActualites, idStable, importerPubliqueActualites } from './lib/crypto.mjs';
import { readFile } from 'node:fs/promises';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(racine, 'actualites-data');
const cible = path.join(racine, 'dist', 'actualites-data');
const DOSSIERS = ['fiches', 'semaines', 'mois', 'trimestres', 'annees'];

if (!existsSync(path.join(racine, 'dist'))) {
  console.error('\n✖ Pas de « dist/ ». Lancez d\'abord : npm run build\n');
  process.exit(1);
}
if (!existsSync(source)) {
  console.error('\n✖ Pas de « actualites-data/ » dans le dépôt.\n');
  process.exit(1);
}

await mkdir(cible, { recursive: true });
await cp(source, cible, { recursive: true });

/*
   L'inventaire est reconstruit à partir de ce qui est réellement là, et non
   recopié : « dist/ » peut déjà porter les entrées de démonstration de
   « actualites:local », et un inventaire qui ne listerait que les unes ou que
   les autres masquerait la moitié de la rubrique.
*/
const inventaire = {};
for (const dossier of DOSSIERS) {
  const chemin = path.join(cible, dossier);
  if (!existsSync(chemin)) continue;
  const noms = (await readdir(chemin)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  if (noms.length) inventaire[dossier] = noms;
}

const { jwk } = JSON.parse(await readFile(path.join(source, 'cle-publique.json'), 'utf8'));
const clePublique = await importerPubliqueActualites(jwk);
await writeFile(
  path.join(cible, `${await idStable('inventaire')}.json`),
  JSON.stringify(await chiffrerPourActualites(clePublique, inventaire)),
);

const total = Object.values(inventaire).reduce((n, l) => n + l.length, 0);
console.log(
  `✓ ${total} entrée(s) dans « dist/actualites-data/ » : ` +
    DOSSIERS.filter((d) => inventaire[d]).map((d) => `${d} ${inventaire[d].length}`).join(', ') +
    '.',
);
