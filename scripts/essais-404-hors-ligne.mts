/**
 * Une adresse inconnue et une coupure de réseau restent dans Cyclades (B3).
 *
 *   npm run essais:404-hors-ligne
 *
 * ## Les deux défauts
 *
 * 1. **Aucune page 404.** GitHub Pages servait la sienne : « 404 » en
 *    anglais, sur fond blanc, hors du site, sans aucune sortie. Un vieux
 *    favori donnait donc l'impression d'un site cassé.
 * 2. **Aucune page hors ligne.** Le *service worker* rendait
 *    `Response.error()` quand une navigation échouait et que rien n'était
 *    gardé : la page d'erreur du navigateur, qui ne dit pas ce qui reste
 *    possible — alors qu'il reste la base, les fiches gardées et les
 *    sauvegardes, toutes locales.
 *
 * ## Ce que cet essai éprouve, et comment
 *
 * - La page 404 est **servie** à une adresse inconnue, avec le bon statut, et
 *   elle se lit **sans le mot de passe** : demander un mot de passe avant
 *   d'annoncer qu'une adresse n'existe pas ne protège rien.
 * - La page hors ligne est servie **pour de vrai** : le navigateur est passé
 *   hors ligne, puis on demande un écran jamais visité. C'est le worker qui
 *   répond, et l'adresse demandée reste dans la barre — ce qui est ce qui
 *   rend « Réessayer » juste.
 * - Les deux portent la flèche de retour, qui remonte à l'accueil et non à
 *   une branche dont elles ne font pas partie.
 *
 * ## Ce qu'il ne peut pas éprouver
 *
 * Que GitHub Pages serve bien `404.html` : cela dépend de l'hébergeur, pas du
 * dépôt. L'essai vérifie que le fichier est **construit** à l'endroit où
 * l'hébergeur le cherche, et que l'aperçu d'Astro le sert.
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { nomDuParent, parentLogique } from '../src/lib/retour.ts';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

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
process.on('uncaughtException', (e: unknown) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

/* ── 1. Les deux pages existent là où on les cherche ───────────────────── */

console.log('\n\x1b[1mLES DEUX PAGES SONT CONSTRUITES, ET RATTACHÉES À L’ACCUEIL\x1b[0m\n');

v('« dist/404.html » existe, là où l’hébergeur le cherche', existsSync('dist/404.html'), true);
v('« dist/hors-ligne/index.html » existe', existsSync('dist/hors-ligne/index.html'), true);
v('la page 404 remonte à l’accueil, pas à une branche', parentLogique('/404/'), '/');
v('la page hors ligne aussi', parentLogique('/hors-ligne/'), '/');
v('et la flèche le dit', [nomDuParent('/404/'), nomDuParent('/hors-ligne/')], [
  'l’accueil',
  'l’accueil',
]);

/* ── 2. L'adresse inconnue ─────────────────────────────────────────────── */

console.log('\n\x1b[1mUNE ADRESSE INCONNUE RESTE DANS CYCLADES\x1b[0m\n');

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

{
  /*
     Contexte neuf, et surtout : PAS de déverrouillage.

     Téléphone et pointeur grossier, parce que le plancher de 44 px n'existe
     que sous « (pointer: coarse) » — c'est une règle de doigt, pas de souris.
     Mesuré d'abord dans un contexte de bureau, l'essai accusait la page d'une
     flèche de 18 px : le défaut était dans sa prémisse, pas dans le site.
     C'est aussi le contexte où l'essai des flèches mesure les autres pages,
     et « dist/404.html » lui échappe — il n'énumère que les dossiers portant
     un « index.html ».
  */
  const ctx = await nav.newContext({
    viewport: { width: 360, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const reponse = await page.goto(`${RACINE}/adresse-qui-nexiste-pas/`, {
    waitUntil: 'networkidle',
  });

  v('l’adresse inconnue répond bien 404', reponse?.status(), 404);
  v(
    'et c’est la page de Cyclades, en français',
    await page.locator('h1', { hasText: 'Page introuvable' }).isVisible(),
    true,
  );
  v(
    'elle se lit sans le mot de passe',
    await page.locator('#champ-mdp').isVisible().catch(() => false),
    false,
  );
  const fleche = page.locator('#fleche-retour');
  const flechePresente = await fleche.isVisible().catch(() => false);
  v('la flèche de retour est là', flechePresente, true);
  /*
     Délai court et rattrapage : sans eux, une page sabotée faisait expirer
     « boundingBox » au bout de trente secondes et emportait tout l'essai en
     PANNE, au lieu de rendre les rouges de ce qui manque. Un contrôle qui
     meurt ne rapporte rien.
  */
  const taille = flechePresente ? await fleche.boundingBox({ timeout: 2000 }).catch(() => null) : null;
  v(
    'et elle fait au moins 44 px',
    [Math.round(taille?.width ?? 0) >= 44, Math.round(taille?.height ?? 0) >= 44],
    [true, true],
  );
  const nomDeLaFleche = flechePresente
    ? ((await fleche.textContent({ timeout: 2000 }).catch(() => '')) ?? '')
    : '';
  v('elle dit où elle va', nomDeLaFleche.includes('Revenir à l’accueil'), true);

  /* Le lien d'accueil marche : on le suit, et on regarde où l'on tombe. */
  const suivi = await page
    .click('text=Retour à l’accueil', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (suivi) await page.waitForLoadState('networkidle').catch(() => {});
  v('« Retour à l’accueil » mène à l’accueil', suivi ? new URL(page.url()).pathname : 'lien absent', '/');

  await ctx.close();
}

/* ── 3. La coupure de réseau ───────────────────────────────────────────── */

console.log('\n\x1b[1mUNE COUPURE DE RÉSEAU RESTE DANS CYCLADES\x1b[0m\n');

{
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForTimeout(3000);

  /*
     Le worker ne garde la page hors ligne qu'une fois la publication
     annoncée, ce qui n'arrive qu'après déverrouillage. On ATTEND cette
     garde au lieu de la supposer : sans elle, la suite mesurerait la page
     d'erreur du navigateur et dirait « pas de page hors ligne » pour une
     raison qui n'est pas celle qu'on croit.
  */
  const gardee = await page
    .waitForFunction(
      `(async () => {
        const noms = (await caches.keys()).filter((n) => n.startsWith('cyclades-'));
        if (noms.length !== 1) return false;
        const cache = await caches.open(noms[0]);
        return Boolean(await cache.match(new URL('hors-ligne/', location.origin + '/').href));
      })()`,
      undefined,
      { timeout: 30000, polling: 1000 },
    )
    .then(() => true)
    .catch(() => false);
  v('le worker a gardé la page hors ligne dès l’annonce de publication', gardee, true);

  if (gardee) {
    await ctx.setOffline(true);
    /* Un écran jamais visité, donc absent du cache : le pire des cas. */
    await page.goto(`${RACINE}/glossaire/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    v(
      'hors ligne, c’est la page de Cyclades qui répond',
      await page.locator('h1', { hasText: 'Hors ligne' }).isVisible().catch(() => false),
      true,
    );
    v(
      'elle dit ce qui marche sans réseau',
      /Ce qui marche sans réseau/.test((await page.content()) ?? ''),
      true,
    );
    v(
      'elle se lit sans le mot de passe — le verrou ne peut rien vérifier hors ligne',
      await page.locator('#champ-mdp').isVisible().catch(() => false),
      false,
    );
    v(
      'l’adresse demandée reste dans la barre, donc « Réessayer » retente le bon écran',
      new URL(page.url()).pathname,
      '/glossaire/',
    );
    v(
      '« Réessayer » est là',
      await page.locator('#reessayer').isVisible().catch(() => false),
      true,
    );
    await ctx.setOffline(false);
  }

  await ctx.close();
}

await nav.close();

console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m\n'
    : `\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m\n`,
);
process.exit(rouges === 0 ? 0 : 1);
