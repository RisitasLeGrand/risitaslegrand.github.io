/**
 * Aucune couleur littérale hors des jetons.
 *
 *   npm run essais:couleurs-jetons
 *
 * ## Pourquoi ce contrôle existe
 *
 * Règle générale d'Alexis, 18 octobre : « L'ensemble du site devra s'adapter
 * aux nouveaux thèmes à venir. » Une couleur écrite en dur ne s'adapte pas :
 * elle reste la même dans les quatorze thèmes, et c'est exactement ainsi
 * qu'un écran se met à jurer — un `#4f46e5` indigo au milieu de Papier, une
 * carte blanche dans Nuit de Délos. Le contrôle fait échouer la batterie à
 * la première couleur littérale.
 *
 * Il relève aussi un second défaut, moins visible : une **famille Tailwind
 * non couverte**. Écrire `bg-green-500` ne déclenche aucune alerte de
 * couleur littérale, mais `--color-green-500` n'est redéfini par aucun
 * thème : la classe garde le vert de Tailwind, dans les quatorze thèmes.
 * C'est la même panne, par un autre chemin.
 *
 * ## Les exceptions, et leur raison
 *
 * Chacune porte sa raison. Une exception sans raison est une porte ouverte
 * qu'on oublie ; une exception périmée — le fichier n'a plus de couleur
 * littérale — fait échouer le contrôle, parce qu'une déclaration qui ne
 * correspond plus est un mensonge qui dort.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const EXCEPTIONS = [
  {
    fichier: 'src/styles/theme-defaut.css',
    raison: 'engendré par « npm run themes » depuis src/lib/themes.ts',
  },
  {
    fichier: 'src/lib/themes.ts',
    raison: 'les douze rôles des quatorze thèmes, écrits à la main une fois',
  },
  {
    fichier: 'src/lib/sync/qr.ts',
    raison:
      'un QR code se lit par le contraste de ses modules : noir sur blanc, ' +
      'quel que soit le thème, sinon les lecteurs échouent',
  },
  {
    fichier: 'src/features/quad-n-back/moteur/generative.js',
    raison: 'les motifs tirés au sort de l’exercice : des stimuli, comme les couleurs',
  },
  {
    fichier: 'src/features/quad-n-back/moteur/voronoi.js',
    raison: 'idem — le motif de Voronoï est dessiné, pas habillé',
  },
  {
    fichier: 'src/features/quad-n-back/moteur/constantes.js',
    raison:
      'les stimuli du Quad N-Back : huit couleurs à distinguer, les faces du ' +
      'cube et les retours. Ce sont des éléments d’épreuve, comme le dessin ' +
      'd’une icône ; suivre le thème les rendrait incomparables d’une séance ' +
      'à l’autre, et dans Ardoise la dimension « couleur » disparaîtrait',
  },
];

/*
   Un masque n'est pas une couleur : `mask-image` ne lit que l'alpha, et
   `#000` y veut dire « opaque ». L'écrire en jeton n'aurait aucun sens.

   La déclaration est retirée EN ENTIER, pas la ligne : un dégradé de masque
   s'écrit sur six lignes, et seule la première porte le mot « mask-image ».
   La première version n'ignorait que la ligne, et laissait donc passer…
   quatre `#000` sur cinq.
*/
const sansMasques = (texte) =>
  texte.replace(/(-webkit-)?mask(-image)?\s*:[\s\S]*?;/g, (bloc) =>
    bloc.replace(/[^\n]/g, ' '),
  );

const COULEUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g;

/** Les familles couvertes par le générateur, lues dans le générateur. */
function famillesCouvertes() {
  const texte = readFileSync('scripts/construire-themes.mts', 'utf8');
  const bloc = texte.slice(texte.indexOf('const FAMILLES'), texte.indexOf('type Lch'));
  return new Set([...bloc.matchAll(/'([a-z]+)'/g)].map((m) => m[1]));
}

const TOUTES_FAMILLES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

function fichiers(racine = 'src') {
  const sortie = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(ts|astro|svelte|css|js)$/.test(entree)) sortie.push(chemin);
  }
  return sortie.sort();
}

let rouges = 0;
const dire = (texte) => {
  console.log(`\x1b[31m✗\x1b[0m ${texte}`);
  rouges += 1;
};

const couvertes = famillesCouvertes();
const parException = new Map(EXCEPTIONS.map((e) => [e.fichier, e]));
const exceptionsUtiles = new Set();
const famillesVues = new Map();

for (const chemin of fichiers()) {
  const texte = readFileSync(chemin, 'utf8');

  /* 1. Les couleurs littérales. */
  const trouvees = [];
  sansMasques(texte)
    .split('\n')
    .forEach((ligne, i) => {
      for (const m of ligne.matchAll(COULEUR)) trouvees.push(`${i + 1}: ${m[0]}`);
    });
  if (trouvees.length) {
    if (parException.has(chemin)) exceptionsUtiles.add(chemin);
    else
      dire(
        `${chemin} — ${trouvees.length} couleur(s) littérale(s) : ${trouvees.slice(0, 4).join(', ')}` +
          (trouvees.length > 4 ? ` (et ${trouvees.length - 4} autres)` : ''),
      );
  }

  /* 2. Les familles Tailwind employées. */
  for (const m of texte.matchAll(
    new RegExp(`\\b(?:bg|text|border|from|to|via|fill|stroke|ring|divide|outline|accent|caret|placeholder|shadow)-(${TOUTES_FAMILLES})-(?:50|[1-9]00|950)\\b`, 'g'),
  )) {
    if (!famillesVues.has(m[1])) famillesVues.set(m[1], `${chemin} (${m[0]})`);
  }
}

for (const [famille, ou] of famillesVues)
  if (!couvertes.has(famille))
    dire(
      `la famille « ${famille} » est employée — ${ou} — mais aucun thème ne la redéfinit : ` +
        'elle gardera la couleur de Tailwind dans les quatorze thèmes',
    );

for (const e of EXCEPTIONS)
  if (!exceptionsUtiles.has(e.fichier))
    dire(
      `l’exception « ${e.fichier} » ne sert plus : le fichier n’a plus de couleur littérale, ` +
        'retirez-la (sa raison était : ' + e.raison + ')',
    );

console.log(
  rouges === 0
    ? `\n\x1b[32mTout est vert.\x1b[0m ${famillesVues.size} familles employées, toutes couvertes ; ` +
        `${EXCEPTIONS.length} exceptions, toutes utiles.`
    : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
