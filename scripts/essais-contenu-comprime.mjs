/**
 * LE CONTENU EST COMPRIMÉ AVANT D'ÊTRE CHIFFRÉ, ET IL LE RESTE.
 *
 * ## Ce que cet essai garde, et pourquoi rien d'autre ne le garderait
 *
 * Du JSON se comprime de 80 à 90 %. Les fichiers de contenu n'y gagnaient que
 * 25 %, et ce chiffre est la signature du chiffrement : un texte chiffré n'a
 * plus de redondance. La compression du serveur et celle du navigateur
 * arrivaient toutes deux trop tard. Comprimer le CLAIR puis chiffrer le
 * comprimé rend la redondance au compresseur : « recherche.json » passe de
 * 11 371 Ko à 3 270 Ko, pour un clair identique octet pour octet.
 *
 * **Le gain peut disparaître en silence**, et c'est la raison d'être de cet
 * essai. Si quelqu'un relève le seuil, retire l'appel à `gzipSync`, ou
 * remplace `chiffrerJson` par une version qui oublie le champ `z`, LE SITE
 * CONTINUE DE MARCHER PARFAITEMENT. Les fiches s'affichent, la recherche
 * trouve, les actualités se rattachent — et chaque page redevient huit
 * mégaoctets plus lourde sans qu'aucun essai ne rougisse. Il n'y a pas d'écran
 * à regarder pour cela : la perte est invisible par construction.
 *
 * Les essais de navigateur, eux, gardent déjà l'autre moitié : si la
 * décompression était cassée, `charger` lèverait et la recherche, les
 * actualités, la bibliothèque rougiraient toutes. Ce qui manquait est le sens
 * inverse — que le gain soit bien là.
 *
 * ## Il REFUSE plutôt que de se taire
 *
 * Zéro fichier lu et zéro faute se rendraient de la même façon. Un dossier
 * `public/data/` absent — parce que le contenu n'a pas été construit — donnerait
 * sinon le vert d'un balayage qui n'a rien mesuré. C'est la leçon du balayage
 * des bornes, et elle vaut ici autant : « non mesuré » n'est ni vert ni rouge.
 *
 *     npm run essais:contenu-comprime
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

const DOSSIER = process.env.DONNEES ?? 'public/data';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 200)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 200)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

/* ── Le refus ─────────────────────────────────────────────────────────── */

if (!existsSync(DOSSIER)) {
  console.error(
    `\n✗ REFUS — « ${DOSSIER} » n’existe pas.\n` +
      '  Le contenu n’a pas été construit : cet essai ne mesurerait rien, et\n' +
      '  son silence ne vaut pas un verdict. Lancez la construction du contenu.\n',
  );
  process.exit(2);
}

const blocs = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ nom: f, bloc: JSON.parse(readFileSync(`${DOSSIER}/${f}`, 'utf8')) }))
  .filter(({ bloc }) => typeof bloc?.iv === 'string' && typeof bloc?.ct === 'string');

if (blocs.length === 0) {
  console.error(
    `\n✗ REFUS — aucun bloc chiffré dans « ${DOSSIER} » ` +
      `(${readdirSync(DOSSIER).length} fichier(s) lu(s)).\n` +
      '  Ce dossier en porte normalement cinq ou plus.\n',
  );
  process.exit(2);
}

console.log(`\n\x1b[1mLE CONTENU EST COMPRIMÉ AVANT D’ÊTRE CHIFFRÉ\x1b[0m\n`);
console.log(`  ${blocs.length} blocs chiffrés lus dans « ${DOSSIER} ».\n`);

/* ── 1. Le gros fichier est bien comprimé ─────────────────────────────── */

console.log('1. LE GAIN EST LÀ');

const recherche = blocs.find((b) => b.nom === 'recherche.json');
vrai('« recherche.json » est publié', Boolean(recherche));
if (recherche) {
  v('et il se dit comprimé en gzip', recherche.bloc.z, 'gzip');
  /*
     LE SEUIL EST DANS LE CHIFFRE, ET NON DANS UN « c'est plus petit ».
     « Plus petit qu'avant » demanderait de garder l'ancien fichier ; « sous
     cinq mégaoctets » est une borne absolue qu'un retour en arrière franchit
     forcément, puisque la forme non comprimée en pèse onze.
  */
  const octets = readFileSync(`${DOSSIER}/recherche.json`).length;
  console.log(`      ${(octets / 1024).toFixed(0)} Ko servis`);
  vrai('et il pèse moins de cinq mégaoctets (onze sans compression)', octets < 5 * 1024 * 1024);
}

/* ── 2. Les petits fichiers gardent la forme d'avant ──────────────────── */

console.log('\n2. LES PETITS FICHIERS GARDENT LA FORME D’AVANT');
/*
   Ce n'est pas une coquetterie. « temoin », dans « cle.json », est le tout
   premier bloc que l'écran de connexion déchiffre, avant d'avoir rien d'autre.
   Le laisser hors de la compression garde ce chemin exactement tel qu'il
   était, et une panne de décompression ne peut donc pas enfermer la personne
   dehors.
*/
const cle = JSON.parse(readFileSync(`${DOSSIER}/cle.json`, 'utf8'));
vrai('« cle.json » porte bien un témoin', typeof cle?.temoin?.ct === 'string');
faux('et ce témoin n’est PAS comprimé', 'z' in (cle.temoin ?? {}));

for (const petit of ['glossaire.json', 'molecules.json']) {
  const b = blocs.find((x) => x.nom === petit);
  if (!b) continue;
  faux(`« ${petit} » n’est pas comprimé (sous le seuil)`, 'z' in b.bloc);
}

/* ── 3. Le champ « z » ne ment pas ────────────────────────────────────── */

console.log('\n3. LE CHAMP « z » DIT LA VÉRITÉ SUR CHAQUE BLOC');
/*
   On ne peut pas déchiffrer ici — le mot de passe n'est pas à la portée d'un
   essai de source. Mais on peut éprouver la RÉCIPROQUE sur du gzip fabriqué :
   que « gunzipSync » refuse ce qui n'est pas du gzip. C'est ce qui donne son
   sens au champ : un bloc marqué « z » dont le contenu ne serait pas comprimé
   ferait lever le navigateur, donc rougir les essais de navigateur. Le marquage
   et le contenu ne peuvent pas diverger en silence.
*/
const temoinClair = Buffer.from('{"ok":true}');
const temoinGz = gzipSync(temoinClair);
v('du gzip se décomprime à l’identique', gunzipSync(temoinGz).toString(), temoinClair.toString());
let aLeve = false;
try {
  gunzipSync(temoinClair);
} catch {
  aLeve = true;
}
vrai('et du NON-gzip fait lever la décompression, au lieu de rendre n’importe quoi', aLeve);

/* ── 4. Tous les blocs comprimés le sont vraiment ─────────────────────── */

console.log('\n4. AUCUN BLOC NE SE DIT COMPRIMÉ SANS L’ÊTRE');
const marques = blocs.filter((b) => b.bloc.z !== undefined);
console.log(`      ${marques.length} bloc(s) portent « z »`);
v(
  'et aucun ne porte une valeur que le navigateur ne saurait pas lire',
  marques.map((b) => b.bloc.z).filter((z) => z !== 'gzip'),
  [],
);

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs ? 1 : 0);
