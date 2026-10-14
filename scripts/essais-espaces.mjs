/**
 * Les espaces mangés entre un mot et une balise en ligne.
 *
 * ## La faute, et pourquoi elle ne se voit pas dans le gabarit
 *
 * Astro supprime le saut de ligne qui sépare un nœud de texte d'une balise en
 * ligne voisine. Le gabarit suivant, parfaitement lisible :
 *
 *     …une fois assez de réponses accumulées.
 *     <a href="…">Choisir ce qui l'alimente →</a>
 *
 * produit `accumulées.<a …>Choisir`, c'est-à-dire, à l'écran,
 * « accumulées.Choisir ». Le défaut est donc invisible à la relecture du
 * gabarit : il naît à la construction. C'est pour cela que ce contrôle lit le
 * **HTML construit** et non les sources.
 *
 * ## Ce que le contrôle attrape, et ce qu'il laisse passer
 *
 * Il signale un caractère de mot ou une ponctuation **fermante** collé à
 * l'ouverture d'une balise en ligne, et la fermeture d'une telle balise collée
 * à un caractère de mot. Il ne signale pas les collages légitimes, qui sont
 * tous précédés d'une apostrophe, d'une ouvrante ou d'un tiret : `l'<abbr…`,
 * `(<a…`, `«&nbsp;<em…`.
 *
 * Il ne voit que les pages construites. Une page que le site ne publie pas, ou
 * un texte écrit par du code au moment de l'affichage, lui échappent
 * entièrement : ce contrôle couvre les gabarits, pas les rendus dynamiques.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = 'dist';

/** Les balises dont le collage à un mot est, à l'écran, un espace manquant. */
/**
 * Les balises **fiablement** en ligne. `button` a rejoint la liste le
 * 14 octobre : il manquait, et c'est pour cela que ce contrôle ne voyait pas
 * « ici, ouchoisissez-en un » sur l'écran des finances.
 *
 * `label` a été essayé et **retiré**, avec sa raison. Il est en ligne par
 * défaut, mais le dépôt s'en sert couramment comme d'un bloc
 * (`class="flex …"`), et un mot collé à un bloc ne se voit pas : l'ajouter
 * produisait un faux positif immédiat sur la fiche de molécule. Un balayage du
 * HTML ne connaît pas le `display` calculé — c'est la limite de ce contrôle, et
 * la raison d'être de son pendant au navigateur, qui lit le texte rendu.
 */
const EN_LIGNE = 'a|abbr|b|button|code|em|i|kbd|mark|q|s|small|strong|sub|sup|u';

/**
 * Avant une ouvrante : lettre, chiffre, ou ponctuation qui termine un mot.
 * L'apostrophe, les ouvrantes et le tiret sont exclus — ils collent à bon
 * droit.
 *
 * **L'espace insécable en est exclue aussi**, et c'est la seule correction qui
 * tienne. Le minifieur supprime toute espace ordinaire entre un nœud de texte
 * et une balise en ligne : `{' '}`, une espace littérale et même `&#32;` sont
 * tous écrasés — mesuré, trois fois, le 14 octobre. L'insécable, elle, n'est
 * pas une espace réductible : elle survit, et elle garde en prime le mot avec
 * le contrôle qui le suit, ce qui est le rendu voulu.
 */
const AVANT = String.raw`[\p{L}\p{N}.,;:!?…»%]`;
/** Après une fermante : une lettre ou un chiffre. Rien d'autre ne trahit. */
const APRES = String.raw`[\p{L}\p{N}]`;

const OUVRANTE = new RegExp(`${AVANT}<(?:${EN_LIGNE})[ >]`, 'gu');
const FERMANTE = new RegExp(`</(?:${EN_LIGNE})>${APRES}`, 'gu');

function pages(dossier) {
  const sortie = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...pages(chemin));
    else if (nom.endsWith('.html')) sortie.push(chemin);
  }
  return sortie;
}

/** Le code n'est pas du texte : un `<em>` dans une chaîne JS ne se lit pas. */
const sansCode = (html) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

const ligneDe = (texte, index) => texte.slice(0, index).split('\n').length;

let fautes = 0;
for (const page of pages(RACINE)) {
  const html = sansCode(readFileSync(page, 'utf8'));
  for (const motif of [OUVRANTE, FERMANTE]) {
    motif.lastIndex = 0;
    let m;
    while ((m = motif.exec(html)) !== null) {
      const extrait = html.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ');
      console.log(`✗ ${page}:${ligneDe(html, m.index)} … ${extrait} …`);
      fautes += 1;
    }
  }
}

if (fautes > 0) {
  console.log(`\n${fautes} espace(s) mangé(s) entre un mot et une balise en ligne.`);
  process.exit(1);
}
console.log(`✓ ${pages(RACINE).length} pages : aucun mot collé à une balise en ligne.`);
