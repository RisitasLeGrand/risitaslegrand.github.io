/**
 * M7 — QUI décale la page, écran par écran.
 *
 *   npm run diagnostic:cls
 *
 * Le banc `mesure-vitesse` dit **combien** la page bouge. Il ne dit pas
 * **quoi** bouge, et sans cela on corrigerait au jugé. Chaque entrée
 * `layout-shift` porte un champ `sources` qui nomme les nœuds déplacés,
 * avec leur rectangle avant et après : c'est la seule façon d'attribuer le
 * décalage à un élément plutôt qu'à une intuition.
 *
 * Ce fichier ne corrige rien et ne juge rien. Il relève, pour que la
 * correction vise le défaut réel.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

const ECRANS = [
  '/odyssee/',
  '/odyssee/revue/',
  '/odyssee/taches/',
  '/odyssee/calendrier/',
  '/odyssee/corps/',
  '/flashcards/',
  '/revisions/',
  '/sport/seance/',
  '/sport/',
];

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

/*
   La sonde garde, pour chaque décalage, l'instant, la valeur et le nom des
   nœuds déplacés. Le nom est construit ici, dans la page : une référence de
   nœud ne traverse pas le pont vers Node.
*/
await page.addInitScript(`
  window.__decalages = [];
  const nommer = (n) => {
    if (!n || n.nodeType !== 1) return '(nœud sans élément)';
    const id = n.id ? '#' + n.id : '';
    const classes = typeof n.className === 'string' && n.className
      ? '.' + n.className.trim().split(/\\s+/).slice(0, 3).join('.')
      : '';
    return n.tagName.toLowerCase() + id + classes;
  };
  new PerformanceObserver((liste) => {
    for (const e of liste.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__decalages.push({
        ms: Math.round(e.startTime),
        valeur: Math.round(e.value * 1000) / 1000,
        sources: (e.sources ?? []).map((s) => ({
          quoi: nommer(s.node),
          deY: Math.round((s.currentRect?.top ?? 0) - (s.previousRect?.top ?? 0)),
          hauteurAvant: Math.round(s.previousRect?.height ?? 0),
          hauteurApres: Math.round(s.currentRect?.height ?? 0),
        })),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
`);

await franchirInitialisation(page, RACINE, MDP);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

console.log('\nQUI DÉCALE LA PAGE — les nœuds cités par chaque « layout-shift »');
for (const chemin of ECRANS) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(5000);
  const decalages = await page.evaluate(() => window.__decalages);
  const total = decalages.reduce((s, d) => s + d.valeur, 0);
  console.log(`\n${chemin} — CLS ${Math.round(total * 1000) / 1000}, ${decalages.length} décalage(s)`);
  /* Les coupables, par valeur cumulée : c'est l'ordre dans lequel corriger. */
  const parNoeud = new Map();
  for (const d of decalages) {
    for (const s of d.sources) {
      const cle = s.quoi;
      const avant = parNoeud.get(cle) ?? { valeur: 0, n: 0, deY: 0, ms: d.ms };
      parNoeud.set(cle, {
        valeur: avant.valeur + d.valeur / Math.max(1, d.sources.length),
        n: avant.n + 1,
        deY: Math.abs(s.deY) > Math.abs(avant.deY) ? s.deY : avant.deY,
        ms: Math.min(avant.ms, d.ms),
      });
    }
  }
  const classement = [...parNoeud].sort((a, b) => b[1].valeur - a[1].valeur).slice(0, 5);
  if (!classement.length) console.log('  (aucune source nommée)');
  for (const [quoi, info] of classement) {
    console.log(
      `  ${String(Math.round(info.valeur * 1000) / 1000).padStart(6)}  ${quoi.slice(0, 60).padEnd(60)}` +
        ` déplacé de ${String(info.deY).padStart(5)} px, dès ${info.ms} ms`,
    );
  }
}

await nav.close();
