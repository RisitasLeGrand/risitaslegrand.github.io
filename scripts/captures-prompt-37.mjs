/**
 * Les captures du prompt 37 — données synthétiques seulement.
 *
 *   npm run captures:37
 *
 * Elles vont dans « audit/captures/prompt-37/ », qui est ignoré par Git :
 * une capture d'écran montre l'état d'une base, et cette base ne sort pas de
 * la machine.
 *
 * Les données sont semées par les écrans eux-mêmes (formulaire des tâches,
 * clics sur le schéma) : aucune écriture par un chemin détourné, donc rien
 * qui n'existerait pas dans un usage réel.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const DOSSIER = 'audit/captures/prompt-37';
/** Le CSS exact retiré par A1, pour reconstituer l'« avant ». */
const FONDU_DE_LA_PHASE_5 =
  '#chargement{opacity:1;transition:opacity .12s ease-out,display .12s allow-discrete}' +
  '#chargement.hidden{display:none;opacity:0}';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

const faites = [];
const prendre = async (page, nom, options = {}) => {
  await page.screenshot({ path: `${DOSSIER}/${nom}.png`, ...options });
  faites.push(nom);
  console.log(`  ✓ ${nom}.png`);
};

const ouvrir = async (page, route) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
};

const contexte = (extra = {}) =>
  nav.newContext({ viewport: { width: 390, height: 844 }, ...extra });

console.log('\nCAPTURES — PROMPT 37');

/* ── A1 : avant et après, sur la page où l'écart était le plus net ────── */
for (const [nom, sabote] of [
  ['a1-recherche-avant-le-fondu-reinjecte', true],
  ['a1-recherche-apres', false],
]) {
  const ctx = await contexte();
  const p = await ctx.newPage();
  if (sabote) {
    await p.addInitScript((css) => {
      const poser = () => {
        const s = document.createElement('style');
        s.textContent = css;
        document.head.append(s);
      };
      if (document.head) poser();
      else document.addEventListener('DOMContentLoaded', poser, { once: true });
    }, FONDU_DE_LA_PHASE_5);
  }
  await ouvrir(p, '/recherche/');
  /* On vise l'instant où le texte d'attente s'en va : c'est là que l'« avant »
     pousse le contenu, et que l'« après » ne le pousse plus. */
  await p.locator('#chargement').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(60);
  await prendre(p, nom);
  await ctx.close();
}

/* ── A2 : la jauge en cours de remplissage ─────────────────────────────── */
{
  const ctx = await contexte();
  const p = await ctx.newPage();
  await ouvrir(p, '/');
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    const boite = document.createElement('div');
    boite.id = 'demo-jauge';
    boite.style.cssText =
      'position:fixed;left:16px;right:16px;top:120px;z-index:9999;background:var(--color-white,#fff);' +
      'border:1px solid #cbd5e1;border-radius:12px;padding:16px;font:14px system-ui';
    boite.innerHTML =
      '<p style="margin:0 0 8px">Jauge de valeur, en cours de remplissage (A2)</p>' +
      '<div style="width:100%;height:10px;overflow:hidden;border-radius:9999px;background:#e2e8f0">' +
      '<div id="demo-remplissage" class="jauge-remplissage" style="height:10px;border-radius:9999px;' +
      'background:#4f46e5;transform:scaleX(0.8)"></div></div>';
    document.body.append(boite);
  });
  /* 60 ms : la jauge est à mi-course, ce qu'aucune capture ne montrait avant
     puisqu'elle sautait à sa valeur. */
  await p.waitForTimeout(60);
  await prendre(p, 'a2-jauge-en-cours-de-remplissage', { clip: { x: 0, y: 100, width: 390, height: 140 } });
  await ctx.close();
}

/* ── A3 : la barre d'appariement, visible ──────────────────────────────── */
{
  const ctx = await contexte();
  const p = await ctx.newPage();
  await ouvrir(p, '/apparier/');
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    document.getElementById('avancement')?.classList.remove('hidden');
    const b = document.getElementById('barre');
    if (b) b.style.transform = 'scaleX(0.6)';
    const t = document.getElementById('avancement-texte');
    if (t) t.textContent = '60 % — démonstration';
    document.getElementById('avancement')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await p.waitForTimeout(500);
  await prendre(p, 'a3-barre-appariement-visible');
  await ctx.close();
}

/* ── A5 : la liste pendant le glissement ───────────────────────────────── */
{
  const ctx = await contexte();
  const p = await ctx.newPage();
  await ouvrir(p, '/odyssee/taches/');
  await p.locator('#vue').waitFor({ state: 'visible', timeout: 25000 });
  for (const t of ['Relire le fascicule 3', 'Préparer la séance de sport', 'Ranger le bureau']) {
    await p.fill('#titre', t);
    await p.press('#titre', 'Enter');
    await p.waitForTimeout(400);
  }
  await p.evaluate(() =>
    document.querySelector('[data-faire]')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await p.waitForTimeout(150);
  const b = await p.evaluate(() => {
    const e = document.querySelector('[data-faire]');
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p.mouse.click(b.x, b.y);
  await p.waitForTimeout(90); // au cœur des 200 ms de glissement
  await prendre(p, 'a5-liste-pendant-le-glissement');
  await ctx.close();
}

/* ── A7 : l'étape 1 allumée, et le schéma visible en 390 ───────────────── */
{
  const ctx = await contexte();
  const p = await ctx.newPage();
  await ouvrir(p, '/sport/exercices/');
  await p.locator('#vue').waitFor({ state: 'visible', timeout: 25000 });
  await p.getByRole('button', { name: 'Ajouter un exercice' }).first().click();
  await p.locator('#fenetre-ajout').waitFor({ state: 'visible', timeout: 10000 });
  await p.evaluate(() => {
    const z = [...document.querySelectorAll('[data-zone]')];
    for (const i of [0, 2, 4]) z[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    for (const i of [1, 3]) {
      z[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      z[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  await p.getByRole('button', { name: 'Voir l’animation' }).click();
  await p.waitForTimeout(350); // l'étape 1 est allumée, la 2 pas encore
  await prendre(p, 'a7-etape-1-allumee-et-schema-visible');
  await ctx.close();
}

/* ── Le schéma du corps après le retrait de la forme complète ──────────── */
{
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await ouvrir(p, '/sport/exercices/');
  await p.locator('#vue').waitFor({ state: 'visible', timeout: 25000 });
  await p.getByRole('button', { name: 'Ajouter un exercice' }).first().click();
  await p.locator('#fenetre-ajout').waitFor({ state: 'visible', timeout: 10000 });
  await p.evaluate(() => {
    const z = [...document.querySelectorAll('[data-zone]')];
    for (const i of [0, 2, 5, 7]) z[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('svg[data-face]')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await p.waitForTimeout(600);
  await prendre(p, 'decision-1-schema-sans-la-forme-complete');
  await ctx.close();
}

/* ── A12 : le cadre pendant une transition de page ─────────────────────── */
{
  const ctx = await contexte();
  const p = await ctx.newPage();
  await ouvrir(p, '/odyssee/');
  await p.waitForTimeout(1200);
  const lien = p.locator('a[href$="/odyssee/taches/"]:visible').first();
  await lien.click();
  /* Au milieu du fondu : si le cadre se dédoublait, c'est ici qu'on le
     verrait. Le corps de page, lui, est bien en train de changer. */
  await p.waitForTimeout(90);
  await prendre(p, 'a12-cadre-pendant-la-transition');
  await ctx.close();
}

await nav.close();
console.log(`\n${faites.length} capture(s) dans ${DOSSIER}/\n`);
