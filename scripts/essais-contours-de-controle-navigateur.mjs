/**
 * AUCUN CONTRÔLE N'EST DÉLIMITÉ PAR UNE SEULE BORDURE INVISIBLE (E2 du 43).
 *
 *   SITE_PASSWORD=… npm run essais:contours:navigateur
 *
 * ## Le périmètre, et c'est lui le vrai travail de cet essai
 *
 * WCAG 1.4.11 demande 3:1 à ce qui est **nécessaire pour identifier un
 * contrôle**, et non à tout trait du site. Le départage se fait sur le FOND :
 *
 * - un contrôle dont le fond diffère de celui de son parent est déjà délimité
 *   par ce fond, et la frontière existe sans sa bordure ;
 * - un contrôle qui porte le MÊME fond que son parent n'est délimité que par
 *   sa bordure, et cette bordure porte alors toute l'information.
 *
 * Mesuré le 25 octobre sur huit écrans : 494 contrôles, dont 21 en clair et 22
 * en sombre dans le second cas. Quatre formes étaient entre 1,35:1 et 2,15:1 —
 * les trois boutons de niveau des statistiques, « Réviser hors échéance » des
 * flashcards, le choix de programme de la séance.
 *
 * **Ce que cet essai ne demande donc PAS**, et c'est délibéré : que les trois
 * cent quarante `border-slate-300` du dépôt montent à 3:1. Le filet sous
 * l'en-tête et les séparateurs de sections sont à 1,23:1 ; ils sont
 * décoratifs, on comprend l'écran sans eux, et les noircir n'obéirait à rien.
 *
 * ## Pourquoi la couleur se fait composer par le navigateur
 *
 * Parce que les fonds du site sont des `oklab(… / 0.9)` — l'en-tête est
 * `bg-white/90` —, et parce qu'une transparence ne se devine pas sur la chaîne
 * de caractères : mon premier essai du témoin de synchronisation avait rendu un
 * FAUX VERT en prenant `rgb(138, 75, 0)` pour un `rgba(…, 0)`. Ici, une toile
 * de 1 × 1 pixel peint le fond puis la bordure, et relit le pixel.
 *
 * ## Les deux modes, et la prémisse qui s'est révélée nécessaire
 *
 * `colorScheme` de Playwright ne pose que `prefers-color-scheme`, et Cyclades
 * ne le consulte que si l'on a choisi « systeme » : par défaut il bascule sur
 * l'heure. Ma première sonde a donc mesuré deux fois le mode sombre sans s'en
 * apercevoir. On pose `revinsp.theme`, et on REFUSE de mesurer si
 * `data-theme` n'a pas pris.
 */
import { chromium } from 'playwright-core';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { contraste } from './lib/couleurs.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const SEUIL = 3;

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  ${rouge('✗')} ${quoi}\n      obtenu  ${JSON.stringify(obtenu, null, 1)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
}
const vrai = (quoi, condition) => verifier(quoi, condition, true);

/* Les routes sont celles que la construction a réellement produites : une
   liste écrite à la main se périme au premier écran ajouté. */
const routes = [];
(function parcourir(dossier, prefixe) {
  for (const e of readdirSync(dossier)) {
    const chemin = join(dossier, e);
    if (statSync(chemin).isDirectory()) parcourir(chemin, `${prefixe}${e}/`);
    else if (e === 'index.html') routes.push(prefixe);
  }
})('dist', '/');
routes.sort();

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

console.log('\nLES CONTOURS DE CONTRÔLE, DANS LES DEUX MODES\n');

for (const mode of ['clair', 'sombre']) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  await page.addInitScript((m) => {
    try {
      localStorage.setItem('revinsp.bascule-jour-nuit', 'non');
      localStorage.setItem('revinsp.theme', m);
    } catch {
      /* Mode privé : la prémisse ci-dessous le dira. */
    }
  }, mode);
  await franchirInitialisation(page, RACINE, MDP);

  console.log(`── MODE ${mode.toUpperCase()}`);
  const theme = await page.getAttribute('html', 'data-theme');
  verifier('prémisse : le thème demandé est bien posé', theme, mode);
  if (theme !== mode) {
    console.log('      (rien n’est mesuré : ce serait la mesure de l’autre mode)');
    await ctx.close();
    continue;
  }

  /* La composition, rendue au navigateur : voir l'en-tête. */
  const composer = (couleur, dessous) =>
    page.evaluate(([c, d]) => {
      const toile = document.createElement('canvas');
      toile.width = 1;
      toile.height = 1;
      const ctx2 = toile.getContext('2d');
      if (!ctx2) return null;
      for (const teinte of [d, c]) {
        if (!teinte) continue;
        ctx2.fillStyle = teinte;
        ctx2.fillRect(0, 0, 1, 1);
      }
      const [r, v, b] = ctx2.getImageData(0, 0, 1, 1).data;
      const h = (x) => x.toString(16).padStart(2, '0');
      return `#${h(r)}${h(v)}${h(b)}`;
    }, [couleur, dessous]);

  let controles = 0;
  let seuleBordure = 0;
  const faibles = new Map();

  for (const route of routes) {
    await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
      await page.waitForTimeout(1200);
    }
    await page.waitForTimeout(250);

    const releve = await page.evaluate(() => {
      /* Le fond RÉELLEMENT derrière : on remonte jusqu'au premier parent qui
         en peint un, parce qu'un contrôle transparent n'a pas le sien. */
      const fondDerriere = (e) => {
        let n = e;
        while (n && n !== document.documentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c)) return c;
          n = n.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
      };
      const sortie = [];
      for (const e of document.querySelectorAll(
        'input:not([type=hidden]), select, textarea, button, [role=button]',
      )) {
        const b = e.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        const s = getComputedStyle(e);
        const largeur = Math.max(
          parseFloat(s.borderTopWidth) || 0,
          parseFloat(s.borderBottomWidth) || 0,
          parseFloat(s.borderLeftWidth) || 0,
          parseFloat(s.borderRightWidth) || 0,
        );
        const parent = e.parentElement ? fondDerriere(e.parentElement) : 'rgb(255,255,255)';
        sortie.push({
          quoi:
            `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}` +
            `${e.getAttribute('type') ? '[' + e.getAttribute('type') + ']' : ''}`,
          texte: (e.textContent ?? '').trim().slice(0, 32),
          largeur,
          bordure: s.borderTopColor,
          propre: s.backgroundColor,
          parent,
        });
      }
      return sortie;
    });

    for (const r of releve) {
      controles += 1;
      if (r.largeur < 0.5) continue;
      /*
         LE DÉPARTAGE : le contrôle a-t-il un fond À LUI, distinct de celui
         de son parent ? On compose les deux sur le même fond pour les
         comparer — deux syntaxes différentes peuvent nommer la même couleur,
         et un `oklab` comparé à un `rgb` par leurs chaînes dirait toujours
         « ils diffèrent ».
         Un fond propre non peint se compose en le fond du parent : la
         comparaison rend donc l'égalité, ce qui est exactement le cas « rien
         ne le délimite que sa bordure ».
      */
      const sien = await composer(r.propre, r.parent);
      const dessous = await composer(r.parent, '#ffffff');
      if (sien !== dessous) continue;
      seuleBordure += 1;

      const trait = await composer(r.bordure, r.parent);
      if (!trait || !dessous) continue;
      const x = contraste(trait, dessous);
      if (x >= SEUIL) continue;
      const cle = `${r.quoi} « ${r.texte} » — ${trait} sur ${dessous}`;
      if (!faibles.has(cle)) faibles.set(cle, { x, ou: new Set() });
      faibles.get(cle).ou.add(route);
    }
  }

  /*
     LES PRÉMISSES AVANT LE CONSTAT : un relevé qui n'aurait rien vu passerait
     au vert sans rien mesurer, et c'est le pire des verts.
  */
  vrai(`prémisse : ${routes.length} routes visitées`, routes.length >= 50);
  vrai(`prémisse : ${controles} contrôles mesurés`, controles >= 300);
  vrai(
    `prémisse : ${seuleBordure} ne sont délimités que par leur bordure`,
    seuleBordure >= 1,
  );

  verifier(
    `aucun contrôle sous ${SEUIL}:1 quand sa bordure le délimite seule`,
    [...faibles.entries()]
      .sort((a, b) => a[1].x - b[1].x)
      .map(([cle, d]) => `${d.x.toFixed(2)}:1  ${cle}  (${[...d.ou].slice(0, 3).join(' ')})`),
    [],
  );
  await ctx.close();
}

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('Tout contrôle que sa seule bordure délimite se voit, dans les deux modes.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
