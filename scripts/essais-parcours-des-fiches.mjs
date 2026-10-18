/**
 * Chaque fiche sait de quel parcours elle vient.
 *
 * ## Le défaut
 *
 * `racineContenu` était déclaré dans le registre des parcours et **lu nulle
 * part** : la hiérarchie se reconstruit depuis `matiere`/`fascicule`, de sorte
 * qu'une fiche déposée dans `content/dgfip-a/` devenait une matière de plus du
 * parcours INSP, à côté du droit public.
 *
 * ## Ce que cet essai vérifie, et ce qu'il ne vérifie pas
 *
 * Il lit le **manifeste réellement produit** par la construction, pas le code
 * qui le produit. Il vérifie que chaque fiche porte un parcours, que ce
 * parcours existe au registre, et que les fiches rangées sous une racine
 * déclarée portent bien celle-ci.
 *
 * Il ne vérifie **pas** que la bibliothèque filtre : elle ne filtre pas
 * encore, et le prétendre serait mentir. Ce champ existe pour que ce second
 * pas soit possible ; il se fera à part, avec ses propres essais.
 */
import { readFileSync, existsSync } from 'node:fs';
import { PARCOURS } from '../src/lib/parcours/registre.ts';
import { deriverCle } from './lib/crypto.mjs';

let echecs = 0;
const v = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

const CHEMIN = 'dist/data/manifeste.json';
const CLE = 'dist/data/cle.json';
if (!existsSync(CHEMIN) || !existsSync(CLE)) {
  console.error(`\n${CHEMIN} absent : construisez d'abord (npm run build).\n`);
  process.exit(1);
}

const MDP = process.env.SITE_PASSWORD;
if (!MDP) {
  console.error('\nSITE_PASSWORD manquant : le manifeste publié est CHIFFRÉ.\n');
  process.exit(1);
}

/*
   Le manifeste publié est chiffré, et il faut le déchiffrer pour l'éprouver.

   Une première version lisait le fichier tel quel, y trouvait `{iv, ct}`, en
   tirait zéro fiche — et l'assertion « aucune fiche sans parcours » passait
   AU VERT sur une liste vide. C'est la garde « le manifeste n'est pas vide »
   qui l'a arrêtée. Un essai qui parcourt zéro élément ne prouve rien, et il
   faut toujours lui donner de quoi le dire.
*/
const params = JSON.parse(readFileSync(CLE, 'utf8'));
const cle = await deriverCle(MDP, Buffer.from(params.sel, 'base64'), params.iterations, 256);
const enveloppe = JSON.parse(readFileSync(CHEMIN, 'utf8'));
const clair = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv: Buffer.from(enveloppe.iv, 'base64') },
  cle,
  Buffer.from(enveloppe.ct, 'base64'),
);
const manifeste = JSON.parse(new TextDecoder().decode(clair));

const toutes = [];
for (const m of manifeste.matieres ?? []) {
  for (const f of m.fascicules ?? []) {
    for (const fiche of f.fiches ?? []) toutes.push({ ...fiche, matiere: m.nom });
  }
}

console.log('\nLE MANIFESTE PORTE LE PARCOURS DE CHAQUE FICHE');

console.log(`      ${toutes.length} fiches au manifeste`);
v('le manifeste n’est pas vide, sinon l’essai ne prouverait rien', toutes.length > 100, true);

const sans = toutes.filter((f) => typeof f.parcours !== 'string' || !f.parcours);
v('aucune fiche sans parcours', sans.map((f) => f.titre).slice(0, 5), []);

const connus = new Set(PARCOURS.map((p) => p.id));
const inconnus = [...new Set(toutes.map((f) => f.parcours))].filter((p) => !connus.has(p));
v('aucun parcours inconnu du registre', inconnus, []);

const repartition = {};
for (const f of toutes) repartition[f.parcours] = (repartition[f.parcours] ?? 0) + 1;
console.log(`      répartition : ${JSON.stringify(repartition)}`);

console.log('\nLES FICHES RANGÉES SOUS UNE RACINE DÉCLARÉE LA PORTENT');

/*
   On compare aux fichiers présents sur le disque, et non à ce que le
   manifeste raconte de lui-même : un manifeste qui se contredirait serait
   cohérent avec lui-même et faux quand même.
*/
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const compterSous = (dossier) => {
  if (!existsSync(dossier)) return 0;
  let n = 0;
  for (const e of readdirSync(dossier)) {
    const c = join(dossier, e);
    if (statSync(c).isDirectory()) n += compterSous(c);
    else if (e.endsWith('.md') && !e.endsWith('.podcast.md')) n += 1;
  }
  return n;
};

const ecarts = [];
for (const p of PARCOURS) {
  if (p.racineContenu === '') continue;
  const surDisque = compterSous(join('content', p.racineContenu));
  const auManifeste = repartition[p.id] ?? 0;
  if (surDisque !== auManifeste) {
    ecarts.push(`${p.id} : ${surDisque} sur disque, ${auManifeste} au manifeste`);
  }
}
v('autant de fiches au manifeste que sur le disque, par parcours', ecarts, []);

console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
