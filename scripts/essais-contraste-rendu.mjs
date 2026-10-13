/**
 * Le contraste **des pages rendues**, dans les deux thèmes.
 *
 * ## Ce que l'autre script ne pouvait pas dire
 *
 * « npm run contrastes » lit les jetons de `tokens.css` et contrôle une liste
 * de combinaisons écrite à la main. Il prouve que **la palette** est bonne. Il
 * ne prouve pas qu'aucune page n'a posé une couleur hors de cette palette, ni
 * qu'une superposition imprévue — un texte clair sur une carte claire — ne
 * s'est pas formée au rendu. C'est la réserve que l'audit portait au constat
 * C-027, et c'est ce que ce script-ci lève.
 *
 * ## La méthode, et ses deux pièges
 *
 * On parcourt les nœuds de texte visibles, on prend la couleur calculée du
 * texte et l'on **remonte** jusqu'au premier ancêtre dont le fond n'est pas
 * transparent. Deux pièges s'y cachent :
 *
 *  1. **Un fond semi-transparent** ne donne pas la couleur réellement vue. On
 *     le compose donc sur le fond de l'ancêtre suivant, dans l'ordre, jusqu'à
 *     l'opacité pleine — sans quoi l'en-tête à `bg-white/90` serait mesuré
 *     comme blanc pur, et son contraste légèrement faux.
 *  2. **Le seuil dépend de la taille.** WCAG AA demande 4,5:1 pour du texte
 *     ordinaire et 3:1 pour du « grand texte » — 24 px, ou 18,66 px en gras.
 *     Appliquer 4,5 partout produirait des échecs sur des titres parfaitement
 *     conformes, et l'on apprendrait à ignorer la liste.
 *  3. **Les couleurs calculées ne sont pas du `rgb()`.** Tailwind 4 rend
 *     `oklch(0.208 0.042 265.755)`, et une expression régulière qui cherche
 *     `rgb(` n'y voit rien — donc aucun fond, donc un fond blanc supposé,
 *     donc des rapports de 1:1 partout. C'est l'erreur qu'a faite la première
 *     version de ce script, et elle annonçait 2 056 défauts sur un site qui
 *     n'en a pas. On laisse donc le **navigateur** convertir : une couleur
 *     peinte sur un canevas de 1 × 1 ressort en RGBA quelle que soit sa
 *     syntaxe d'origine, aujourd'hui comme avec la notation d'après-demain.
 *
 * Les éléments masqués, de taille nulle ou hors écran sont écartés : un
 * contraste invisible n'est pas un défaut d'accessibilité, c'est du bruit.
 *
 * ## Pourquoi un plafond, et non zéro
 *
 * Au premier passage honnête, ce script a trouvé **411 textes** sous le
 * seuil : 262 en thème clair, 149 en sombre. Ce n'est pas un accident de
 * mesure — c'est `text-slate-400` et `text-slate-500` employés comme couleur
 * de texte secondaire, à 12 et 14 px, sur tout le site. Les corriger demande
 * de toucher la couleur de texte secondaire des **deux** thèmes, ce qui sort
 * du périmètre d'un essai et entre dans celui d'une décision : c'est la
 * ligne **D-031** du tableau.
 *
 * En attendant, ce script est un **cliquet** : il échoue si le compte
 * augmente. Il ne dit donc pas « le site est conforme » — il ne l'est pas —,
 * il dit « il ne se dégrade plus ». Écrire zéro et laisser l'essai rouge
 * aurait produit, en une semaine, un essai qu'on n'exécute plus ; écrire le
 * compte sans le dire aurait produit un essai qui ment. Le plafond est donc
 * accompagné du chiffre, et le chiffre est une dette nommée.
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const ROUTES = existe('/tmp/routes.txt')
  ? readFileSync('/tmp/routes.txt', 'utf8').trim().split('\n')
  : ['/', '/revisions/', '/odyssee/', '/sport/', '/glossaire/', '/statistiques/', '/profil/'];

function existe(chemin) {
  try {
    readFileSync(chemin);
    return true;
  } catch {
    return false;
  }
}

const MESURE = () => {
  const luminance = ([r, v, b]) => {
    const c = [r, v, b].map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const rapport = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  /* Le navigateur convertit : oklch, color(), hsl, rgb — tout ressort RGBA. */
  const toile = document.createElement('canvas');
  toile.width = 1;
  toile.height = 1;
  const pinceau = toile.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const lire = (couleur) => {
    if (!couleur || couleur === 'transparent') return null;
    if (cache.has(couleur)) return cache.get(couleur);
    pinceau.clearRect(0, 0, 1, 1);
    pinceau.fillStyle = '#000';
    pinceau.fillStyle = couleur;
    /* Une valeur refusée laisse « fillStyle » inchangé : on le détecte. */
    if (pinceau.fillStyle === '#000000' && !/^#0{3,6}$|^black$|^rgba?\(0,? ?0,? ?0/.test(couleur)) {
      cache.set(couleur, null);
      return null;
    }
    pinceau.fillRect(0, 0, 1, 1);
    const d = pinceau.getImageData(0, 0, 1, 1).data;
    const v = { rgb: [d[0], d[1], d[2]], alpha: d[3] / 255 };
    cache.set(couleur, v);
    return v;
  };
  /* Compose les fonds, du plus proche au plus lointain, jusqu'à l'opacité. */
  const fondEffectif = (el) => {
    const couches = [];
    for (let p = el; p; p = p.parentElement) {
      const f = lire(getComputedStyle(p).backgroundColor);
      if (!f || f.alpha === 0) continue;
      couches.push(f);
      if (f.alpha >= 1) break;
    }
    if (!couches.length) return [255, 255, 255];
    let fond = couches[couches.length - 1].rgb;
    for (let i = couches.length - 2; i >= 0; i -= 1) {
      const { rgb, alpha } = couches[i];
      fond = fond.map((v, k) => Math.round(rgb[k] * alpha + v * (1 - alpha)));
    }
    return fond;
  };

  const resultats = [];
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vus = new Set();
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    const texte = n.textContent?.trim();
    if (!texte) continue;
    const el = n.parentElement;
    if (!el || vus.has(el)) continue;
    vus.add(el);
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
    const b = el.getBoundingClientRect();
    if (b.width <= 1 || b.height <= 1 || b.bottom < 0 || b.top > window.innerHeight * 3) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    /*
       Le texte réservé aux lecteurs d'écran n'a pas de contraste à tenir : il
       n'est pas vu. Tailwind le masque par « clip-path: inset(50%) » sur un
       carré d'un pixel. Le compter faisait doubler la liste de doublons
       exacts — « Odyssée » puis « Aller dans Odyssée » — et noyait les vrais.
    */
    if (s.clipPath === 'inset(50%)' || el.closest('.sr-only')) continue;

    const avant = lire(s.color);
    if (!avant) continue;
    const fond = fondEffectif(el);
    const devant = avant.alpha >= 1
      ? avant.rgb
      : avant.rgb.map((v, k) => Math.round(v * avant.alpha + fond[k] * (1 - avant.alpha)));

    const taille = parseFloat(s.fontSize);
    const gras = Number(s.fontWeight) >= 700;
    const grand = taille >= 24 || (gras && taille >= 18.66);
    const seuil = grand ? 3 : 4.5;
    const r = rapport(devant, fond);
    if (r < seuil - 0.005) {
      resultats.push({
        texte: texte.slice(0, 40),
        rapport: Math.round(r * 100) / 100,
        seuil,
        taille: Math.round(taille * 10) / 10,
        balise: el.tagName.toLowerCase() + (el.className?.toString?.().split(' ')[0] ? '.' + el.className.toString().split(' ')[0] : ''),
      });
    }
  }
  return resultats;
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let total = 0;
const releve = {};
for (const theme of ['clair', 'sombre']) {
  const ctx = await nav.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: theme === 'sombre' ? 'dark' : 'light',
  });
  /*
     Le thème ne suit pas la préférence du système : Cyclades reste sombre
     tant qu'aucun choix n'est enregistré — « c'est celui du site depuis
     toujours ». Demander « colorScheme: light » à Playwright ne suffit donc
     pas, et la première version de ce script a mesuré deux fois le thème
     sombre en croyant en mesurer deux. On écrit le choix.
  */
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('revinsp.theme', t);
    } catch {
      /* navigation privée */
    }
  }, theme);
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  const defauts = [];
  for (const r of ROUTES) {
    await page.goto(`${RACINE}${r}`, { waitUntil: 'networkidle', timeout: 45000 });
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(200);
    const rendu = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (rendu !== theme) {
      throw new Error(`le thème demandé est « ${theme} », la page rend « ${rendu} »`);
    }
    for (const d of await page.evaluate(MESURE)) defauts.push({ route: r, ...d });
  }
  total += defauts.length;
  releve[theme] = defauts;
  const couleur = defauts.length ? '\x1b[31m✗\x1b[0m' : '\x1b[32m✓\x1b[0m';
  console.log(
    `${couleur} thème ${theme} — ${ROUTES.length} écran(s), ${defauts.length} texte(s) sous le seuil AA`,
  );
  for (const d of defauts.slice(0, 15)) {
    console.log(
      `    ${d.route} · ${d.balise} · ${d.taille} px · ${d.rapport}:1 < ${d.seuil}:1 — « ${d.texte} »`,
    );
  }
  if (defauts.length > 15) console.log(`    … et ${defauts.length - 15} autre(s).`);
  await ctx.close();
}

await nav.close();

/**
 * Le plafond, mesuré le 13 octobre 2026.
 *
 * À faire baisser, jamais monter. Quand D-031 sera tranchée, ces nombres
 * tomberont — et le jour où ils atteignent zéro, on retire le plafond et
 * l'essai exige la conformité pleine.
 */
const PLAFOND = { clair: 262, sombre: 149 };
/* Le relevé complet : la console en montre quinze, le fichier les porte tous. */
if (process.env.RELEVE_CONTRASTE) {
  writeFileSync(process.env.RELEVE_CONTRASTE, JSON.stringify(releve, null, 1));
  console.log(`\nRelevé complet : ${process.env.RELEVE_CONTRASTE}`);
}
const depassements = Object.entries(PLAFOND).filter(([t, max]) => (releve[t]?.length ?? 0) > max);
const plafondTotal = Object.values(PLAFOND).reduce((n, v) => n + v, 0);

if (depassements.length) {
  console.log(`\n\x1b[31m✗ Le contraste s'est dégradé :\x1b[0m`);
  for (const [t, max] of depassements) {
    console.log(`    thème ${t} : ${releve[t].length} textes sous le seuil, plafond ${max}`);
  }
  console.log('');
  process.exit(1);
}

if (total === 0) {
  console.log(
    '\n\x1b[32m✓ Tous les textes rendus atteignent le seuil WCAG AA, dans les deux thèmes.\x1b[0m' +
      '\n  Le plafond peut être retiré de ce script.\n',
  );
} else {
  console.log(
    `\n\x1b[33m✓ Pas de dégradation : ${total} texte(s) sous le seuil, plafond ${plafondTotal}.\x1b[0m` +
      '\n  Ce n\'est pas une conformité : c\'est une dette qui ne grandit pas. Voir D-031.\n',
  );
}
process.exit(0);
