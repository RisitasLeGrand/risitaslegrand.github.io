/**
 * 0.9 — les bulles, mesurées là où elles s'affichent.
 *
 *   npm run essais:bulles:navigateur
 *
 * ## Pourquoi cet essai existe à côté de « essais:contrastes-themes »
 *
 * L'autre essai prouve l'ARITHMÉTIQUE : il lit les classes dans « ui.ts »,
 * demande au générateur la valeur de chaque jeton, et vérifie les rapports sur
 * les quatorze thèmes et leurs vingt-cinq modes. C'est beaucoup, et il y
 * manque une chose — il ne prouve pas que les classes EXISTENT.
 *
 * Tailwind n'engendre que les utilitaires qu'il a vus dans les sources. Une
 * classe mal écrite, ou écrite d'une façon que le balayeur ne reconnaît pas,
 * ne produit aucune règle : l'élément la porte, et rien ne s'applique. Le
 * bord de la bulle disparaîtrait, la bulle redeviendrait invisible sur un
 * fond noir — et l'essai arithmétique resterait vert, puisqu'il lit le texte
 * de « ui.ts » et non la feuille publiée.
 *
 * C'est exactement le genre de vert silencieux que ce chantier refuse. Cet
 * essai-ci ferme le trou, et rien d'autre : il mesure ce que le navigateur
 * CALCULE sur une bulle, dans le site construit.
 *
 * ## Ce qu'il ne mesure pas
 *
 * Il ne déclenche pas une vraie bulle : « notifier() » n'est pas exposé sur
 * la page, et l'atteindre demanderait d'y gagner de l'expérience ou un badge
 * au milieu d'un essai de contraste. On injecte donc un élément portant
 * **les classes lues dans « ui.ts »**, ce qui mesure ce qui compte ici : la
 * feuille publiée répond-elle à ces classes. Le reste — qu'une bulle paraisse
 * bien au bon moment — est mesuré ailleurs, par les essais qui gagnent de
 * l'expérience pour de vrai.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const SOURCE_UI = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'ui.ts'),
  'utf8',
);

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
const auMoins = (quoi, obtenu, seuil) => {
  if (obtenu >= seuil) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi} — ${obtenu.toFixed(2)}:1`);
    return;
  }
  console.log(`\x1b[31m✗\x1b[0m ${quoi} — ${obtenu.toFixed(2)}:1, il en faut ${seuil.toFixed(1)}:1`);
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

/* ── Ce que « ui.ts » dit de ses bulles ─────────────────────────────────── */

const couleurs = [...SOURCE_UI.matchAll(/^\s*(info|succes|badge):\s*'(bg-[\w-]+\s+text-[\w-]+)',$/gm)].map(
  ([, variante, classes]) => ({ variante, classes }),
);
const commun = /bulle\.className\s*=\s*\n?\s*'([^']+)'\s*\+\s*\n?\s*`([^`]*)\$\{couleurs\}`/.exec(SOURCE_UI);

console.log('\nLES PRÉMISSES : CE QUE L’ON A PU LIRE DANS « ui.ts »');
verifier('les trois bulles y sont lisibles', couleurs.length, 3);
verifier('et la ligne qui compose leur classe aussi', Boolean(commun), true);
if (couleurs.length !== 3 || !commun) {
  console.log(
    '\x1b[31m✗\x1b[0m rien n’a été mesuré : « ui.ts » a changé de forme et cet essai ne sait plus où regarder.',
  );
  process.exit(1);
}
const CLASSES = couleurs.map((c) => ({
  variante: c.variante,
  classe: `${commun[1]}${commun[2]}${c.classes}`,
}));

/* ── La mesure, dans le navigateur ──────────────────────────────────────── */

/**
 * Compose une couleur sur un fond, et rend le contraste WCAG.
 *
 * Écrit pour tourner DANS la page : le navigateur sait convertir n'importe
 * quelle syntaxe de couleur — « oklch() » compris — en RGBA sur un canevas de
 * 1 × 1, là où une expression régulière qui cherche « rgb( » ne verrait rien.
 * C'est la leçon déjà payée par « essais:contraste-rendu », qui avait annoncé
 * deux mille défauts sur un site qui n'en avait pas.
 */
const MESURE = (classes) => {
  const enRgba = (couleur) => {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillStyle = couleur;
    const dessine = ctx.fillStyle;
    /* fillStyle rend « #rrggbb » ou « rgba(...) » ; on passe par le pixel. */
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = dessine;
    ctx.fillRect(0, 0, 1, 1);
    const [r, v, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, v, b, a / 255];
  };
  const sur = ([r, v, b, a], [fr, fv, fb]) => [
    Math.round(r * a + fr * (1 - a)),
    Math.round(v * a + fv * (1 - a)),
    Math.round(b * a + fb * (1 - a)),
    1,
  ];
  const luminance = ([r, v, b]) =>
    [r, v, b]
      .map((x) => x / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
  const contraste = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  const page = enRgba(getComputedStyle(document.body).backgroundColor);
  const releves = [];
  for (const { variante, classe } of classes) {
    const bulle = document.createElement('div');
    bulle.className = classe;
    bulle.textContent = 'Mesure';
    document.body.appendChild(bulle);
    const style = getComputedStyle(bulle);
    const fond = sur(enRgba(style.backgroundColor), page);
    const texte = sur(enRgba(style.color), fond);
    const bordBrut = enRgba(style.borderTopColor);
    const bord = sur(bordBrut, fond);
    releves.push({
      variante,
      largeurDuBord: Number.parseFloat(style.borderTopWidth) || 0,
      alphaDuBord: Number(bordBrut[3].toFixed(2)),
      fondEstPeint: enRgba(style.backgroundColor)[3] > 0.99,
      texteSurFond: contraste(texte, fond),
      fondSurPage: contraste(fond, page),
      bordSurPage: contraste(bord, page),
    });
    bulle.remove();
  }
  return { releves, theme: document.documentElement.getAttribute('data-theme') };
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
/*
   LE THÈME SE FORCE PAR « localStorage », ET NON PAR « emulateMedia ».

   Première écriture : « page.emulateMedia({ colorScheme: 'dark' }) ». Les
   deux passages ont rendu des chiffres IDENTIQUES — 12,00:1 en clair comme en
   sombre — ce qui n'était pas un site irréprochable mais un essai qui
   mesurait deux fois la même chose. L'amorçage de Cyclades lit son thème dans
   « localStorage » et pose « data-theme » lui-même : la requête de média ne
   décide de rien quand un choix est enregistré.

   On écrit donc l'état avec « addInitScript », comme « essais:themes-navigateur »,
   dans un contexte NEUF par passage — un contexte réutilisé garderait le
   thème du précédent. Et le thème obtenu est VÉRIFIÉ avant toute mesure :
   sans cette vérification, le jour où ces clés changent de nom, l'essai
   mesurerait trois fois le thème par défaut en annonçant trois thèmes.

   Le troisième passage est « Contraste élevé » en sombre, parce que c'est le
   pire cas mesuré : c'est là que « slate-800 » et le fond de page valaient
   tous deux #000000.
*/
const PASSAGES = [
  { titre: 'ÉGÉE, EN CLAIR', palette: 'egee', mode: 'clair' },
  { titre: 'ÉGÉE, EN SOMBRE', palette: 'egee', mode: 'sombre' },
  { titre: 'CONTRASTE ÉLEVÉ, EN SOMBRE — LE PIRE CAS MESURÉ', palette: 'contraste', mode: 'sombre' },
];

for (const passage of PASSAGES) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([palette, mode]) => {
      try {
        localStorage.setItem('revinsp.palette', palette);
        localStorage.setItem('revinsp.theme', mode);
        localStorage.setItem('revinsp.bascule-jour-nuit', 'non');
      } catch {
        /* rien : la prémisse ci-dessous le dira */
      }
    },
    [passage.palette, passage.mode],
  );
  /*
     L'écran de verrouillage suffit, et c'est voulu : une bulle est un élément
     de l'habillage, pas du contenu, et déverrouiller pour mesurer une couleur
     donnerait à cet essai une raison de rougir qui ne le concerne pas.
  */
  await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const { releves, theme } = await page.evaluate(MESURE, CLASSES);

  console.log(`\n${passage.titre}`);
  /* La prémisse d'abord : a-t-on bien obtenu le thème qu'on croit mesurer ? */
  verifier(`le thème appliqué est « ${passage.mode} »`, theme, passage.mode);
  for (const r of releves) {
    /*
       D'ABORD QUE LES CLASSES EXISTENT. Sans cette assertion, tout le reste
       se mesurerait sur une bulle transparente sans bord, et les rapports
       seraient ceux de la page — souvent conformes, et sans aucun rapport
       avec la bulle.
    */
    verifier(`bulle « ${r.variante} » : son fond est peint`, r.fondEstPeint, true);
    verifier(
      `bulle « ${r.variante} » : « border-white/50 » a bien produit une règle`,
      { largeur: r.largeurDuBord > 0, alpha: r.alphaDuBord },
      { largeur: true, alpha: 0.5 },
    );
    auMoins(`bulle « ${r.variante} » : son texte sur son fond`, r.texteSurFond, 4.5);
    auMoins(
      `bulle « ${r.variante} » se détache de la page (fond ${r.fondSurPage.toFixed(2)}:1, ` +
        `bord ${r.bordSurPage.toFixed(2)}:1)`,
      Math.max(r.fondSurPage, r.bordSurPage),
      3,
    );
  }
  await ctx.close();
}

await nav.close();
console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${rouges} rouge${rouges > 1 ? 's' : ''}.\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
