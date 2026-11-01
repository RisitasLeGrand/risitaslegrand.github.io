/**
 * LA PLANCHE DU PROMPT 65 BIS — TROIS LOGOS, DEUX FORMES CHACUN.
 *
 *   npm run planche:logotype:bis
 *
 * Elle produit `docs/cyclades/planche-65-bis/*.png` : les trois propositions,
 * dans deux thèmes, en clair et en sombre, à 390 et 1280 pixels de large.
 *
 * ## Ce qu'elle montre de plus que la planche du 65
 *
 * Chaque proposition a une forme COMPACTE et une forme COMPLÈTE, et la planche
 * les montre CÔTE À CÔTE dans leurs deux places : la compacte dans la rangée
 * de 44 px de l'en-tête, la complète seule et centrée sur le voile. C'est le
 * seul moyen de juger ce qui compte vraiment ici — non pas « ce dessin est-il
 * beau », mais « ces deux-là se reconnaissent-ils comme un seul logo ».
 *
 * ## Le même dessin que celui qu'on livrerait
 *
 * `svgLogoBis` est importé de `src/lib/logotype-bis.ts`. Recopier le balisage
 * ici aurait fait, au premier écart, une planche qui montre autre chose que ce
 * qu'on choisirait. Rien n'est branché dans le site : le branchement attend le
 * choix d'Alexis, au point central de `src/lib/logotype.ts`.
 *
 * ## Les polices et le réseau
 *
 * Les `@font-face` du dépôt sont chargés par `file://` depuis
 * `src/styles/polices.css`. Rien ne sort sur le réseau. Si une police manquait,
 * le substitut s'afficherait — et `textLength` tiendrait la largeur de toute
 * façon, ce qui est justement la promesse qu'on veut voir tenue.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const SORTIE = process.env.SORTIE ?? resolve(RACINE, 'docs/cyclades/planche-65-bis');
const PROVISOIRE = '/tmp/planche-65-bis-html';

const { svgLogoBis } = await import(`${RACINE}/src/lib/logotype-bis.ts`);

/*
   LES DEUX MÊMES THÈMES QU'AU 65, et pour la même raison : Égée est le défaut,
   celui que presque tout le monde verra ; République est celui dont la mesure
   a fait changer le dessin au 65 — c'est là que la marque menaçait de dominer
   le mot, donc c'est là qu'il faut regarder. Deux thèmes voisins n'auraient
   rien appris.
*/
const THEMES = [
  { id: 'egee', nom: 'Égée (par défaut)' },
  { id: 'republique', nom: 'République' },
];
const VARIANTES = [
  { id: 'archipel-c', nom: 'A · archipel-C — la lettre dessinée' },
  { id: 'baie', nom: 'B · baie — le geste' },
  { id: 'capitales', nom: 'C · capitales — la typographie seule' },
];
const LARGEURS = [390, 1280];

const lire = (chemin) => readFileSync(resolve(RACINE, chemin), 'utf8');

const polices = lire('src/styles/polices.css').replace(
  /url\((['"]?)([^'")]+)\1\)/g,
  (_, _q, u) => `url('file://${resolve(RACINE, 'public', u.replace(/^\//, ''))}')`,
);

function pageDe(themeId, mode, largeur) {
  const feuille =
    themeId === 'egee' ? lire('src/styles/theme-defaut.css') : lire(`public/themes/${themeId}.css`);

  const cartes = VARIANTES.map(
    (v) => `
    <section class="carte">
      <p class="etiquette">${v.nom}</p>
      <div class="entete">
        <svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        ${svgLogoBis(v.id, '1.125rem', 'compacte')}
        <span class="remplissage"></span>
      </div>
      <p class="glose">en-tête · forme compacte · 18 px de haut</p>
      <div class="voile">${svgLogoBis(v.id, '3.5rem', 'complete')}</div>
      <p class="glose">voile · forme complète · 56 px de haut</p>
    </section>`,
  ).join('');

  /*
     LES DEUX ATTRIBUTS, `data-palette` ET `data-theme`. Hérité d'une mesure du
     65 : avec `data-theme` seul, les feuilles des treize thèmes autres que le
     défaut n'appliquent AUCUNE règle, `--etat-texte` calcule la chaîne vide, et
     le `fill` retombe sur le noir par défaut du SVG. La première planche du 65
     montrait ainsi République en noir presque sur noir presque — une image
     fausse, sur laquelle on aurait choisi.
  */
  return `<!doctype html>
<html lang="fr" data-palette="${themeId}" data-theme="${mode}" style="color-scheme:${mode === 'sombre' ? 'dark' : 'light'}">
<head><meta charset="utf-8" /><title>Planche 65 bis</title>
<style>
${polices}
${feuille}
:root { --font-sans: 'Public Sans', Arial, sans-serif; --font-serif: 'Spectral', Georgia, serif; }
* { box-sizing: border-box; }
body { margin: 0; padding: 20px; background: var(--etat-fond); color: var(--etat-texte);
       font-family: var(--font-sans); width: ${largeur}px; }
h1 { font-size: 15px; margin: 0 0 4px; font-weight: 600; }
.sous { font-size: 12px; color: var(--etat-texte-faible); margin: 0 0 18px; }
.carte { border: 1px solid var(--etat-bordure); border-radius: 8px; margin-bottom: 16px;
         overflow: hidden; background: var(--etat-fond-eleve); }
.etiquette { font-size: 11px; letter-spacing: .06em; text-transform: uppercase;
             color: var(--etat-texte-faible); margin: 0; padding: 8px 12px;
             border-bottom: 1px solid var(--etat-bordure); }
.glose { font-size: 10px; color: var(--etat-texte-faible); margin: 0; padding: 4px 12px 6px;
         letter-spacing: .03em; }
/* L'en-tête, reproduit dans ses mesures : 44 px de rangée, l'icône puis le nom. */
.entete { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px;
          border-top: 1px solid var(--etat-bordure); }
.icone { width: 20px; height: 20px; flex: none; color: var(--etat-texte); }
.remplissage { flex: 1; }
/* Le voile : le logotype seul et centré, aux couleurs du thème, et RIEN d'autre
   — aucun indice sur l'écran qu'il cache. */
.voile { display: flex; align-items: center; justify-content: center;
         min-height: 140px; background: var(--etat-fond);
         border-top: 1px solid var(--etat-bordure); }
</style></head>
<body>
  <h1>Prompt 65 bis — trois logos, deux formes chacun</h1>
  <p class="sous">Thème ${THEMES.find((t) => t.id === themeId).nom} · ${mode} · ${largeur} px
     — pour chaque proposition : la forme compacte dans l’en-tête, la complète sur le voile.</p>
  ${cartes}
</body></html>`;
}

rmSync(PROVISOIRE, { recursive: true, force: true });
mkdirSync(PROVISOIRE, { recursive: true });
mkdirSync(SORTIE, { recursive: true });

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

const faites = [];
for (const theme of THEMES) {
  for (const mode of ['clair', 'sombre']) {
    for (const largeur of LARGEURS) {
      const ctx = await nav.newContext({
        viewport: { width: largeur, height: 900 },
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      const fichier = `${PROVISOIRE}/${theme.id}-${mode}-${largeur}.html`;
      writeFileSync(fichier, pageDe(theme.id, mode, largeur));
      await page.goto(`file://${fichier}`, { waitUntil: 'load' });
      /* On attend les polices, et non un délai : une capture prise pendant le
         chargement montrerait le substitut. */
      await page.evaluate(() => document.fonts.ready);

      /* LA PLANCHE REFUSE DE RENDRE UNE IMAGE SANS THÈME — voir la glose
         ci-dessus. Un contrôle vaut mieux qu'un coup d'œil. */
      const jetons = await page.evaluate(() => {
        const r = getComputedStyle(document.documentElement);
        return ['--etat-fond', '--etat-texte', '--etat-texte-faible', '--etat-bordure'].map((n) =>
          r.getPropertyValue(n).trim(),
        );
      });
      if (jetons.some((v) => !v)) {
        throw new Error(
          `Thème ${theme.id}/${mode} non appliqué : jetons vides (${jetons.join(', ')}). ` +
            `La feuille attend-elle un attribut que la planche ne pose pas ?`,
        );
      }

      /*
         ET ELLE REFUSE AUSSI DE RENDRE UN DESSIN VIDE. Le contrôle des jetons
         ne dit rien de la GÉOMÉTRIE : un `viewBox` mal calculé, un `textLength`
         négatif ou une variante absente donneraient un SVG présent, thémé, et
         sans rien dedans. On exige donc de chaque dessin une boîte non
         dégénérée — six dessins par page, trois compacts et trois complets.
      */
      const boites = await page.evaluate(() =>
        [...document.querySelectorAll('svg[data-logotype]')].map((s) => {
          const r = s.getBoundingClientRect();
          return { v: s.dataset.logotype, f: s.dataset.forme, l: Math.round(r.width), h: Math.round(r.height) };
        }),
      );
      if (boites.length !== VARIANTES.length * 2) {
        throw new Error(`${boites.length} dessins au lieu de ${VARIANTES.length * 2}.`);
      }
      const plates = boites.filter((b) => b.l < 20 || b.h < 10);
      if (plates.length) {
        throw new Error(
          `Dessin dégénéré : ${plates.map((b) => `${b.v}/${b.f} ${b.l}×${b.h}`).join(', ')}.`,
        );
      }

      const png = `${SORTIE}/${theme.id}-${mode}-${largeur}.png`;
      await page.screenshot({ path: png, fullPage: true });
      faites.push({ png, boites });
      await ctx.close();
    }
  }
}

await nav.close();
console.log(`\n${faites.length} captures dans ${SORTIE} :`);
for (const f of faites) console.log(`  ${f.png}`);
console.log(`\nBoîtes mesurées sur la dernière page (largeur × hauteur, en px CSS) :`);
for (const b of faites.at(-1).boites) console.log(`  ${b.v} / ${b.f} : ${b.l} × ${b.h}`);
