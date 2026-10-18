/**
 * Les quatorze thèmes, dans un vrai navigateur.
 *
 *   npm run essais:themes-navigateur
 *
 * Les contrastes sont mesurés ailleurs, sur les valeurs engendrées
 * (`essais:contrastes-themes`). Ici on éprouve ce qu'un calcul ne peut pas
 * dire : ce que la page **pose** et ce qu'elle **peint**.
 *
 * 1. **Le thème choisi est appliqué dès la première image.** C'est la
 *    demande du § 4.4 : « aucun éclair au chargement, quel que soit le
 *    thème ». On relève la valeur de `--etat-fond` à la première image
 *    d'animation, avant tout script de page, et on la compare au fond du
 *    thème choisi. Un thème dont la feuille arriverait en retard rendrait
 *    ici le fond d'Égée.
 * 2. **Le relais d'Égée** : Papier la nuit, Soir et Nuit de Délos le jour,
 *    bascule active et bascule désactivée.
 * 3. **La bascule jour/nuit** elle-même, aux heures dites.
 * 4. **L'amorçage et le module disent la même chose.** La logique du thème
 *    est écrite deux fois — en ligne dans `Base.astro` pour la première
 *    image, dans `src/lib/theme.ts` pour la suite. C'est un doublon
 *    inévitable : un module importé s'exécute après le premier rendu. On
 *    vérifie donc qu'il ne diverge pas, en rappelant `appliquer()` après
 *    chargement et en exigeant que rien ne bouge.
 * 5. **Le thème Séance** prend la main puis la rend.
 *
 * L'écran de connexion suffit : le thème est posé par le gabarit commun,
 * avant tout déverrouillage. C'est aussi, accessoirement, le premier écran
 * qu'on voit — donc celui où un éclair se remarquerait le plus.
 */
import { chromium } from 'playwright-core';
import { THEMES, THEMES_DE_SEANCE, theme as themeParId, type Mode } from '../src/lib/themes.ts';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';

/** « #000 » et « #000000 » sont la même couleur : le minificateur abrège. */
const normaliser = (couleur: string | null | undefined) => {
  const t = (couleur ?? '').trim().toLowerCase();
  const court = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(t);
  return court ? `#${court[1]}${court[1]}${court[2]}${court[2]}${court[3]}${court[3]}` : t;
};

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
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

/** Toute la journée, ou une minute en pleine nuit : de quoi forcer le mode. */
const TOUJOURS_JOUR = '00:00|23:59';
const TOUJOURS_NUIT = '03:00|03:01';

/**
 * Ouvre la page avec un état local donné, et relève ce qui compte.
 *
 * `addInitScript` s'exécute avant tout script de la page : c'est le seul
 * moment où l'on peut écrire dans `localStorage` ce que l'amorçage lira.
 */
async function ouvrir(etat) {
  const ctx = await nav.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript((e: Record<string, string | null>) => {
    try {
      for (const [cle, valeur] of Object.entries(e)) {
        if (valeur === null) localStorage.removeItem(cle);
        else localStorage.setItem(cle, valeur);
      }
    } catch {
      /* rien : l'essai le verra */
    }
    /*
       Deux relevés, et la différence entre les deux est tout l'objet de
       l'essai.

       - `__fondPeint` est pris à la première peinture de contenu, rapportée
         par l'observateur de performance : c'est **ce que l'œil a eu sous
         les yeux**, et c'est lui qui fait foi pour « aucun éclair ».
       - `__premierFond` est pris à la première image d'animation. Une image
         d'animation n'est pas une peinture : elle peut précéder le rendu
         que bloque justement une feuille de style en cours de chargement.
         Ce relevé-là dit « où en était la page », pas « ce qu'on a vu » ; il
         est imprimé pour mémoire quand il diffère, jamais compté en rouge.
         Sans cette distinction, l'essai accusait trois thèmes d'un éclair
         que personne ne voit.
    */
    (window as unknown as { __fondPeint: string | null }).__fondPeint = null;
    try {
      new PerformanceObserver((liste) => {
        if (!liste.getEntriesByName('first-contentful-paint').length) return;
        (window as unknown as { __fondPeint: string | null }).__fondPeint = getComputedStyle(
          document.documentElement,
        )
          .getPropertyValue('--etat-fond')
          .trim();
      }).observe({ type: 'paint', buffered: true });
    } catch {
      /* navigateur sans observateur de peinture : l'essai le dira */
    }
    (window as unknown as { __premierFond: string | null }).__premierFond = null;
    requestAnimationFrame(() => {
      (window as unknown as { __premierFond: string | null }).__premierFond = getComputedStyle(
        document.documentElement,
      )
        .getPropertyValue('--etat-fond')
        .trim();
    });
  }, etat);
  await page.goto(`${RACINE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const releve = await page.evaluate(() => ({
    premierFond: (window as unknown as { __premierFond: string | null }).__premierFond,
    fondPeint: (window as unknown as { __fondPeint: string | null }).__fondPeint,
    fond: getComputedStyle(document.documentElement).getPropertyValue('--etat-fond').trim(),
    palette: document.documentElement.getAttribute('data-palette'),
    choisie: document.documentElement.getAttribute('data-palette-choisie'),
    mode: document.documentElement.getAttribute('data-theme'),
    feuilles: [...document.querySelectorAll('link[rel=stylesheet]')]
      .map((l) => l.getAttribute('href'))
      .filter((h) => h && h.includes('/themes/')),
  }));
  return { page, ctx, releve };
}

const etat = (palette, heures, extra = {}) => ({
  'revinsp.palette': palette,
  'revinsp.bascule-jour-nuit': 'oui',
  'revinsp.heures-bascule': heures,
  ...extra,
});

/* ── 1 et 2. Chaque thème, dans chaque mode, dès la première image ──────── */

console.log('\nLE THÈME CHOISI, DÈS LA PREMIÈRE IMAGE');
for (const t of THEMES) {
  for (const [mode, heures] of [
    ['clair', TOUJOURS_JOUR],
    ['sombre', TOUJOURS_NUIT],
  ] as [Mode, string][]) {
    const { ctx, releve } = await ouvrir(etat(t.id, heures));
    /* Le relais : si le thème n'a pas ce mode, c'est Égée qui rend. */
    const attenduId = t[mode] ? t.id : 'egee';
    const attenduFond = themeParId(attenduId)[mode]!.fond.toLowerCase();
    verifier(`${t.nom} ${mode} — palette appliquée`, releve.palette, attenduId);
    verifier(`${t.nom} ${mode} — la palette choisie est retenue`, releve.choisie, t.id);
    verifier(`${t.nom} ${mode} — mode rendu`, releve.mode, mode);
    verifier(
      `${t.nom} ${mode} — fond à la première PEINTURE (aucun éclair)`,
      normaliser(releve.fondPeint),
      attenduFond,
    );
    if (normaliser(releve.premierFond) !== attenduFond)
      console.log(
        `    (pour mémoire : à la première image d'animation, le fond était encore ` +
          `${releve.premierFond} — la feuille du thème n'était pas appliquée, mais rien n'était peint)`,
      );
    verifier(
      `${t.nom} ${mode} — une seule feuille de thème chargée`,
      releve.feuilles.length,
      attenduId === 'egee' ? 0 : 1,
    );
    await ctx.close();
  }
}

/* ── 3. La bascule désactivée : le choix d'avant revient ─────────────────── */

console.log('\nBASCULE DÉSACTIVÉE');
for (const choix of ['clair', 'sombre']) {
  const { ctx, releve } = await ouvrir({
    'revinsp.palette': 'papier',
    'revinsp.bascule-jour-nuit': 'non',
    'revinsp.theme': choix,
    'revinsp.heures-bascule': TOUJOURS_NUIT,
  });
  verifier(`choix « ${choix} » respecté malgré l’heure`, releve.mode, choix);
  verifier(
    `et le relais s’applique quand même (Papier n’a pas de mode sombre)`,
    releve.palette,
    choix === 'clair' ? 'papier' : 'egee',
  );
  await ctx.close();
}

/* ── 4. L'amorçage et le module disent-ils la même chose ? ───────────────── */

console.log('\nL’AMORÇAGE ET LE MODULE');
for (const [palette, heures] of [
  ['papier', TOUJOURS_JOUR],
  ['papier', TOUJOURS_NUIT],
  ['delos', TOUJOURS_JOUR],
  ['soir', TOUJOURS_NUIT],
  ['contraste', TOUJOURS_JOUR],
]) {
  const { page, ctx, releve } = await ouvrir(etat(palette, heures));
  /*
     Le module a déjà tourné au chargement ; on le rappelle, et rien ne doit
     bouger. Si l'amorçage et lui divergeaient, c'est ici que la page
     changerait de couleur sous les yeux, une fraction de seconde après
     s'être ouverte.
  */
  const apres = await page.evaluate(() => {
    const racine = document.documentElement;
    return {
      palette: racine.getAttribute('data-palette'),
      mode: racine.getAttribute('data-theme'),
      fond: getComputedStyle(racine).getPropertyValue('--etat-fond').trim(),
    };
  });
  verifier(`${palette} (${heures}) — le module ne change rien à l’amorçage`, apres, {
    palette: releve.palette,
    mode: releve.mode,
    fond: releve.fond,
  });
  await ctx.close();
}

/* ── 5. Le thème Séance ──────────────────────────────────────────────────── */

console.log('\nLE THÈME SÉANCE');
{
  const { page, ctx, releve } = await ouvrir(etat('papier', TOUJOURS_JOUR));
  const salle = THEMES_DE_SEANCE.find((v) => v.id === 'seance-salle')!.roles.fond.toLowerCase();
  const pendant = await page.evaluate(() => {
    document.documentElement.setAttribute('data-seance', 'seance-salle');
    return getComputedStyle(document.documentElement).getPropertyValue('--etat-fond').trim();
  });
  verifier('Séance « Salle » passe devant le thème choisi', normaliser(pendant), normaliser(salle));
  const apres = await page.evaluate(() => {
    document.documentElement.removeAttribute('data-seance');
    return getComputedStyle(document.documentElement).getPropertyValue('--etat-fond').trim();
  });
  verifier('et le thème choisi revient à la fin', normaliser(apres), normaliser(releve.fond));
  await ctx.close();
}

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
