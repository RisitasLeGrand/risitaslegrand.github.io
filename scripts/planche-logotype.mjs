/**
 * LA PLANCHE DE CHOIX DU LOGOTYPE « CYCLADES » (prompt 65).
 *
 *   npm run planche:logotype
 *
 * Elle produit `/tmp/planche-logotype/*.png` : les trois variantes, dans deux
 * thèmes, en clair et en sombre, à 390 et 1280 pixels de large. C'est de quoi
 * choisir, et de quoi le montrer.
 *
 * ## Ce que la planche montre, et ce qu'elle ne montre pas
 *
 * Elle montre les deux CONTEXTES où le logotype se posera, et pas un échantillon
 * flottant sur du gris : l'en-tête, en rangée avec l'icône de menu, et le
 * voile de confidentialité, seul et centré. Un logotype se juge à sa place.
 *
 * Elle ne montre pas le site : la page est fabriquée ici, et ne charge que les
 * feuilles de style du dépôt. Monter les variantes DANS le site exigerait de
 * brancher un dessin avant qu'il soit choisi, et c'est précisément ce que la
 * planche existe pour éviter.
 *
 * ## Le même dessin que celui qu'on livre
 *
 * `svgLogotype` est importé de `src/lib/logotype.ts` — la fonction même que le
 * composant appelle. Recopier le balisage ici aurait fait, au premier écart,
 * une planche qui montre autre chose que ce qu'on livre ; et la planche est ce
 * sur quoi la décision se prend.
 *
 * ## Les polices
 *
 * Les `@font-face` du dépôt sont chargés depuis `src/styles/polices.css`, par
 * `file://`. Rien ne sort sur le réseau — et si une police manquait, le
 * substitut s'afficherait : `textLength` tient la largeur de toute façon, ce
 * qui est justement la promesse qu'on veut voir tenue sur la planche.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const SORTIE = process.env.SORTIE ?? '/tmp/planche-logotype';

/* Le dessin, importé et non recopié. */
const { svgLogotype } = await import(`${RACINE}/src/lib/logotype.ts`);

/*
   DEUX THÈMES, et ceux-ci : Égée est le thème par défaut, celui que presque
   tout le monde verra ; République est celui dont la mesure a fait changer le
   dessin — c'est là que la marque menaçait de dominer le mot, donc c'est là
   qu'il faut regarder. Montrer deux thèmes voisins n'aurait rien appris.
*/
const THEMES = [
  { id: 'egee', nom: 'Égée (par défaut)' },
  { id: 'republique', nom: 'République' },
];
/*
   LES DEUX FORMES DU LOGOTYPE RETENU. Les six variantes des prompts 65 et
   65 bis ont disparu avec le choix d'Alexis : garder dans le dépôt un dessin
   que seule la planche appelle, c'est garder du code que rien ne mesure. Les
   planches elles-mêmes restent, comme trace de la décision —
   `docs/cyclades/planche-65/` et `docs/cyclades/planche-65-bis/`.
*/
const VARIANTES = [
  { id: 'compacte', nom: 'Forme compacte — l’en-tête' },
  { id: 'complete', nom: 'Forme complète — le voile' },
];
const LARGEURS = [390, 1280];

const lire = (chemin) => readFileSync(resolve(RACINE, chemin), 'utf8');

/* Les feuilles du dépôt, en ligne : aucune requête, et les vraies valeurs. */
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
        ${svgLogotype(v.id, '1.125rem')}
        <span class="remplissage"></span>
      </div>
      <div class="voile">${svgLogotype(v.id, '3.5rem')}</div>
    </section>`,
  ).join('');

  /*
     LES DEUX ATTRIBUTS, et c'est une MESURE qui l'a imposé.

     Ma première planche ne posait que `data-theme`. Les captures d'Égée
     étaient justes — sa feuille porte un sélecteur sans palette, parce qu'elle
     est le thème par défaut — mais celles de République montraient un mot
     presque noir sur un fond presque noir. J'ai d'abord cru à un défaut de
     contraste du logotype, alors que la garde mesure 16,36:1 pour ce thème.

     Les deux ne pouvaient pas être vraies. Relevé dans la page :
     `--etat-texte` y calculait la chaîne VIDE, et le `fill` retombait sur le
     noir par défaut du SVG. Les feuilles des treize autres thèmes exigent
     `[data-palette='<id>'][data-theme='<mode>']` : sans la palette, aucune
     règle ne s'applique, et la page n'avait tout simplement aucun thème — le
     fond sombre venait du `color-scheme` du navigateur, pas des jetons.

     Une planche qui montre une variante sous un thème qu'elle n'a pas chargé
     est pire qu'une planche manquante : on y choisirait sur une image fausse.
  */
  return `<!doctype html>
<html lang="fr" data-palette="${themeId}" data-theme="${mode}" style="color-scheme:${mode === 'sombre' ? 'dark' : 'light'}">
<head><meta charset="utf-8" /><title>Planche</title>
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
/* L'en-tête, reproduit dans ses mesures : 44 px de rangée, l'icône puis le nom. */
.entete { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px;
          border-bottom: 1px solid var(--etat-bordure); }
.icone { width: 20px; height: 20px; flex: none; color: var(--etat-texte); }
.remplissage { flex: 1; }
/* Le voile : le logotype seul et centré, aux couleurs du thème, et RIEN d'autre
   — aucun indice sur l'écran qu'il cache. */
.voile { display: flex; align-items: center; justify-content: center;
         min-height: 132px; background: var(--etat-fond); }
</style></head>
<body>
  <h1>Logotype « Cyclades » — ${VARIANTES.length} formes</h1>
  <p class="sous">Thème ${THEMES.find((t) => t.id === themeId).nom} · ${mode} · ${largeur} px
     — en haut l’en-tête, en bas le voile.</p>
  ${cartes}
</body></html>`;
}

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
      const fichier = `${SORTIE}/planche-${theme.id}-${mode}-${largeur}.html`;
      writeFileSync(fichier, pageDe(theme.id, mode, largeur));
      await page.goto(`file://${fichier}`, { waitUntil: 'load' });
      /* On attend les polices, et non un délai : une capture prise pendant le
         chargement montrerait le substitut, et c'est justement ce dont on veut
         savoir qu'il ne décale rien — mais sur une AUTRE capture, pas sur
         celle qui sert à choisir. */
      await page.evaluate(() => document.fonts.ready);
      /*
         LA PLANCHE REFUSE DE RENDRE UNE IMAGE SANS THÈME. Le défaut ci-dessus
         ne s'est pas vu à la lecture du code : il s'est vu sur l'image, et
         seulement parce que je l'ai regardée. Un contrôle vaut mieux qu'un
         coup d'œil, et il coûte trois lignes.
      */
      const jetons = await page.evaluate(() => {
        const r = getComputedStyle(document.documentElement);
        return ['--etat-fond', '--etat-texte', '--etat-texte-faible'].map((n) =>
          r.getPropertyValue(n).trim(),
        );
      });
      if (jetons.some((v) => !v)) {
        throw new Error(
          `Thème ${theme.id}/${mode} non appliqué : jetons vides (${jetons.join(', ')}). ` +
            `La feuille attend-elle un attribut que la planche ne pose pas ?`,
        );
      }
      const png = `${SORTIE}/${theme.id}-${mode}-${largeur}.png`;
      await page.screenshot({ path: png, fullPage: true });
      faites.push(png);
      await ctx.close();
    }
  }
}

await nav.close();
console.log(`\n${faites.length} captures dans ${SORTIE} :`);
for (const f of faites) console.log(`  ${f}`);
