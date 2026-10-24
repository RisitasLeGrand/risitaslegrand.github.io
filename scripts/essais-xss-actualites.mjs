/**
 * La preuve que les attributs de la rubrique « Actualités » ne se laissent
 * plus ouvrir.
 *
 * ## Le défaut, et pourquoi aucun écran ne le montrait
 *
 * `echapper()` passe par `textContent` puis relit `innerHTML`. Le navigateur
 * y échappe `&`, `<` et `>` — les trois caractères qui comptent **dans du
 * texte**. Le guillemet droit n'a rien de dangereux dans du texte, et il
 * ressort tel quel. Interpolé dans un attribut, il **ferme l'attribut**, et
 * la suite de la chaîne devient des attributs à part entière.
 *
 * Les données de la rubrique viennent d'une routine qui recopie des titres,
 * des crédits d'image et des noms de source **écrits par la presse**. Aucune
 * de ces chaînes ne porte de guillemet aujourd'hui ; c'est la seule raison
 * pour laquelle rien ne s'est jamais produit. Un essai qui attend qu'une
 * charge arrive par la presse n'est pas un essai.
 *
 * ## Les deux moitiés de cet essai
 *
 * 1. **La charge marche encore** sur l'ancien procédé. Sans cette moitié, un
 *    essai vert ne prouverait peut-être que l'inoffensivité de la charge.
 * 2. **Elle ne marche plus** sur le procédé retenu, `setAttribute`, pour les
 *    quatre attributs réellement en jeu : `href` d'une source, `title` d'une
 *    puce de fiche, `href` d'un indicateur, `src` d'une image.
 *
 * On monte le fragment exactement comme `actualites-rendu.ts` le monte :
 * balise ouvrante fabriquée par le DOM, insérée dans une chaîne, puis la
 * chaîne rendue par `innerHTML`. Reproduire le chemin compte autant que
 * reproduire la charge — c'est le passage par `innerHTML` qui ressuscitait
 * l'attribut.
 */
import { chromium } from 'playwright-core';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext()).newPage();
await page.goto(RACINE);

const r = await page.evaluate(() => {
  const echapper = (texte) => {
    const d = document.createElement('div');
    d.textContent = texte;
    return d.innerHTML;
  };
  const baliseOuvrante = (nom, attributs) => {
    const el = document.createElement(nom);
    for (const [clef, valeur] of Object.entries(attributs)) {
      if (valeur !== undefined) el.setAttribute(clef, valeur);
    }
    const rendu = el.outerHTML;
    return rendu.slice(0, rendu.indexOf('>') + 1);
  };

  const CHARGE = '" onerror="window.__xss=1" x="';
  const monter = (html, selecteur) => {
    const hote = document.createElement('div');
    hote.innerHTML = html;
    return hote.querySelector(selecteur);
  };

  // 1. L'ancien procédé : la charge doit encore passer.
  const ancien = monter(`<img src="x" title="${echapper(CHARGE)}">`, 'img');

  // 2. Le procédé retenu, sur les quatre attributs réellement en jeu.
  const sites = {
    'href d’une source': monter(
      `${baliseOuvrante('a', { href: CHARGE, rel: 'noopener' })}texte</a>`,
      'a',
    ),
    'title d’une puce de fiche': monter(
      `${baliseOuvrante('a', { href: '/fiche/', title: CHARGE })}texte</a>`,
      'a',
    ),
    'href d’un indicateur': monter(
      `${baliseOuvrante('a', { href: CHARGE, target: '_blank' })}texte</a>`,
      'a',
    ),
    'src d’une image': monter(
      `${baliseOuvrante('img', { src: CHARGE, alt: '', loading: 'lazy' })}`,
      'img',
    ),
  };

  // 3. La validation de schéma (D-029) : elle vit à côté de setAttribute,
  //    parce que les deux défauts ne sont pas de même nature — l'un est une
  //    faute de composition, l'autre une faute de confiance.
  const urlSure = (brute) => {
    if (!brute) return undefined;
    try {
      return new URL(brute, document.baseURI).protocol === 'https:' ? brute : undefined;
    } catch {
      return undefined;
    }
  };
  const schemas = {
    'https: passe': urlSure('https://exemple.test/a') !== undefined,
    'http: refusé': urlSure('http://exemple.test/a') === undefined,
    'javascript: refusé': urlSure('javascript:alert(1)') === undefined,
    'JaVaScRiPt: refusé': urlSure('JaVaScRiPt:alert(1)') === undefined,
    'javascript: précédé d’espaces refusé': urlSure('  javascript:alert(1)') === undefined,
    'javascript: précédé d’un saut de ligne refusé': urlSure('\njavascript:alert(1)') === undefined,
    'data: refusé': urlSure('data:text/html,<script>1</script>') === undefined,
    'vbscript: refusé': urlSure('vbscript:msgbox(1)') === undefined,
    'url illisible refusée': urlSure('://::') === undefined,
  };

  return {
    schemas,
    echappeLesChevrons: echapper('<b>') === '&lt;b&gt;',
    echappeLesGuillemets: echapper('"') === '&quot;',
    ancienAttributInjecte: ancien?.getAttribute('onerror') ?? null,
    nouveaux: Object.fromEntries(
      Object.entries(sites).map(([nom, el]) => [
        nom,
        {
          onerror: el?.getAttribute('onerror') ?? null,
          attributs: el ? [...el.attributes].map((a) => a.name).sort() : null,
          valeurPorteLaCharge: el
            ? [...el.attributes].some((a) => a.value.includes('onerror'))
            : false,
        },
      ]),
    ),
  };
});

let echecs = 0;
const verifier = (nom, condition, detail = '') => {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${nom}`);
  else {
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${nom}${detail ? ` — ${detail}` : ''}`);
  }
};

console.log('\nLA CHARGE EST BIEN UNE CHARGE');
verifier('echapper() échappe les chevrons', r.echappeLesChevrons);
verifier(
  'echapper() n’échappe PAS le guillemet — c’est le défaut',
  r.echappeLesGuillemets === false,
);
verifier(
  'et l’ancien procédé crée donc un attribut « onerror » vivant',
  r.ancienAttributInjecte === 'window.__xss=1',
  `onerror = ${JSON.stringify(r.ancienAttributInjecte)}`,
);

console.log('\nLES QUATRE SITES NE LA LAISSENT PLUS PASSER');
for (const [nom, e] of Object.entries(r.nouveaux)) {
  verifier(`${nom} : aucun attribut « onerror »`, e.onerror === null, `onerror = ${e.onerror}`);
  verifier(
    `${nom} : la charge reste une valeur, pas des attributs`,
    e.valeurPorteLaCharge && !e.attributs.includes('onerror'),
    `attributs = ${JSON.stringify(e.attributs)}`,
  );
}

console.log('\nET LES SCHÉMAS D’URL SONT SUR LISTE BLANCHE');
for (const [nom, ok] of Object.entries(r.schemas)) verifier(nom, ok);

console.log(
  echecs === 0
    ? '\n\x1b[32m✓ Les quatre attributs sont clos, et les trois URL validées.\x1b[0m\n'
    : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`,
);
await nav.close();
process.exit(echecs === 0 ? 0 : 1);
