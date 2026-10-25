/**
 * Lire un nombre tapé à la main (D4 du prompt 43).
 *
 *   npm run essais:nombre-saisi
 *
 * Deux choses, et la seconde compte autant que la première : que l'analyseur
 * lise ce qu'un clavier français produit, et qu'aucun champ décimal ne reste
 * en `type="number"` — un seul oublié, et la virgule y est refusée sans que
 * personne le voie.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { nombreDecimal, nombreDuChamp } from '../src/lib/nombre-saisi.ts';

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

console.log('\n1. CE QU’UN CLAVIER FRANÇAIS PRODUIT');

v('la virgule est lue', nombreDecimal('72,5'), 72.5);
v('le point aussi', nombreDecimal('72.5'), 72.5);
v('un entier', nombreDecimal('72'), 72);
v('sans partie entière', nombreDecimal(',5'), 0.5);
v('le signe en tête', nombreDecimal('-3,5'), -3.5);
v('les espaces, ordinaires, insécables et fines', nombreDecimal(' 1 234,5 '), 1234.5);

console.log('\n2. CE QUI N’EST PAS UN NOMBRE N’EN DEVIENT PAS UN');

/* Le défaut nommé par D4 : `Number('')` vaut zéro, et un zéro écrit au
   journal est une mesure que personne n'a prise. */
v('le vide n’est pas zéro', nombreDecimal(''), null);
v('ni les espaces seuls', nombreDecimal('   '), null);
v('une lettre n’est pas un nombre', nombreDecimal('abc'), null);
v('ni un nombre suivi d’une lettre', nombreDecimal('72kg'), null);
/* `Number('0x1f')` vaut 31 et `Number('1e3')` mille : deux saisies que
   personne ne tape dans un champ de poids, et que personne n'a voulu écrire. */
v('l’hexadécimal est refusé', nombreDecimal('0x1f'), null);
v('la notation scientifique aussi', nombreDecimal('1e3'), null);
v('et les deux séparateurs à la fois', nombreDecimal('1,5.5'), null);
vrai('aucune saisie ne rend NaN', ['', 'abc', '0x1f', '1e3'].every((x) => nombreDecimal(x) !== 0));

console.log('\n3. LES BORNES DU CHAMP, PUISQU’UN CHAMP TEXTE NE LES APPLIQUE PAS');

const champ = (valeur: string, min?: string, max?: string) =>
  ({ value: valeur, dataset: { min, max } }) as unknown as HTMLInputElement;
v('dans les bornes', nombreDuChamp(champ('72,5', '20', '400')), 72.5);
v('sous la borne basse', nombreDuChamp(champ('3', '20', '400')), null);
v('au-dessus de la borne haute', nombreDuChamp(champ('900', '20', '400')), null);
v('sur la borne, c’est dedans', nombreDuChamp(champ('20', '20', '400')), 20);
v('sans bornes déclarées, tout nombre passe', nombreDuChamp(champ('900')), 900);

console.log('\n4. AUCUN CHAMP DÉCIMAL N’EST RESTÉ EN « number »');

function fichiers(racine: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(astro|svelte)$/.test(entree)) sortie.push(chemin);
  }
  return sortie;
}

/* Un champ est décimal s'il porte `inputmode="decimal"` : c'est la déclaration
   qui dit « on tapera des décimales ici ». Le relevé prend la balise entière,
   des chevrons au chevron fermant, pour que l'ordre des attributs ne compte
   pas. */
const BALISE = /<input\b[^>]*>/g;
const decimauxEnNombre: string[] = [];
for (const fichier of fichiers('src')) {
  for (const balise of readFileSync(fichier, 'utf8').match(BALISE) ?? []) {
    if (!/inputmode\s*=\s*["']decimal["']/.test(balise)) continue;
    if (/type\s*=\s*["']number["']/.test(balise)) decimauxEnNombre.push(`${fichier} ${balise.slice(0, 60)}`);
  }
}
v('aucun champ décimal n’est en « type=number »', decimauxEnNombre, []);

/* Et les quatre que D4 nomme sont bien passés au texte, avec leurs bornes
   déplacées en `data-` : un `min` sur un champ texte serait un attribut qui
   ne s'applique pas, c'est-à-dire une promesse muette. */
const ATTENDUS: readonly [string, string, boolean][] = [
  ['src/pages/odyssee/corps.astro', 'id="kg"', true],
  ['src/pages/odyssee/corps.astro', 'id="cm"', true],
  ['src/pages/sport/seance.astro', 'id="charge"', false],
  ['src/pages/sport/programmes.astro', 'data-cible', true],
];
for (const [fichier, marque, avecMax] of ATTENDUS) {
  const balise = (readFileSync(fichier, 'utf8').match(BALISE) ?? []).find((b) => b.includes(marque));
  vrai(`${marque} est un champ texte à pavé décimal`, Boolean(balise) &&
    /type\s*=\s*["']text["']/.test(balise!) && /inputmode\s*=\s*["']decimal["']/.test(balise!));
  vrai(`${marque} porte ses bornes en « data- »`, Boolean(balise) &&
    /data-min=/.test(balise!) && (!avecMax || /data-max=/.test(balise!)) &&
    !/\bmin\s*=/.test(balise!.replace(/data-min=/g, '')) &&
    !/\bmax\s*=/.test(balise!.replace(/data-max=/g, '')));
}

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
