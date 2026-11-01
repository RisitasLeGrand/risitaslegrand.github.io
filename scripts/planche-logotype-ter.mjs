/**
 * LES BANDES D'IMAGES CLÉS DES TROIS ANIMATIONS (prompt 65 ter).
 *
 *   npm run planche:logotype:ter
 *
 * Elle produit `docs/cyclades/planche-65-ter/*.png` : pour chaque proposition,
 * six instants — 0, 20, 40, 60, 80 et 100 % — dans l'en-tête, en thème Égée,
 * clair et sombre.
 *
 * ## Comment une animation est figée
 *
 * Non pas en la rejouant et en capturant au bon moment — ce serait une course,
 * et une course perdue donnerait une image fausse sans qu'on le sache. Chaque
 * ligne pose `animation-play-state: paused` et un DÉLAI NÉGATIF : l'animation
 * est alors arrêtée exactement à l'instant voulu, de façon déterministe et
 * reproductible. Les six lignes d'une bande sont six éléments distincts, figés
 * chacun à son instant, et photographiés ensemble.
 *
 * Pour « marée », dont chaque lettre porte son propre retard, le délai négatif
 * s'ajoute au retard de la lettre : `calc(var(--rang) * 58ms - Tms)`. C'est ce
 * qui permet de voir la vague traverser le mot.
 *
 * ## Le voile n'est pas animé
 *
 * Et la planche ne montre donc pas de bande pour lui. La raison est mesurée,
 * et elle est écrite en tête de `src/lib/logotype-animation.ts` : le voile est
 * l'image que le sélecteur d'applications garde en vignette, il atteint
 * aujourd'hui son état final en ZÉRO trame, et une animation ferait de cette
 * fenêtre une centaine de trames pendant lesquelles la vignette montrerait un
 * logo à moitié dessiné.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const SORTIE = process.env.SORTIE ?? resolve(RACINE, 'docs/cyclades/planche-65-ter');
const PROVISOIRE = '/tmp/planche-65-ter-html';

const { svgLogotype, VARIANTE_EN_TETE } = await import(`${RACINE}/src/lib/logotype.ts`);
/*
   LA FEUILLE EST LUE SUR LE DISQUE, comme `polices.css` plus bas : c'est celle
   que le site charge, et une copie divergerait au premier retouchage.
*/
const CSS_ANIMATION = readFileSync(resolve(RACINE, 'src/styles/logotype-anime.css'), 'utf8');

/*
   UNE SEULE PROPOSITION DEPUIS LE CHOIX D'ALEXIS. « L'horizon » et « la levée »
   ont été retirées du dépôt — garder un dessin que seule une planche appelle,
   c'est garder du code que rien ne mesure. Leurs bandes restent dans
   `docs/cyclades/planche-65-ter/` comme trace de la décision ; elles ne sont
   simplement plus regénérables, et l'`index.md` le dit.
*/
const ANIMATIONS = [
  { id: 'maree', nom: 'La marée — retenue', quoi: 'chaque lettre monte à sa place à son tour' },
];

/** La durée totale, en millisecondes : 420 ms par lettre, 58 ms d'écart. */
const DUREES = { maree: 420 + 7 * 58 };
const INSTANTS = [0, 20, 40, 60, 80, 100];
const LARGEUR = 520;

const lire = (chemin) => readFileSync(resolve(RACINE, chemin), 'utf8');
const polices = lire('src/styles/polices.css').replace(
  /url\((['"]?)([^'")]+)\1\)/g,
  (_, _q, u) => `url('file://${resolve(RACINE, 'public', u.replace(/^\//, ''))}')`,
);

/** Le CSS qui fige une ligne à un pourcentage donné de l'animation. */
function figer(anim, rang, pourcent) {
  const t = Math.round((DUREES[anim] * pourcent) / 100);
  const retard = `calc(var(--rang, 0) * 58ms - ${t}ms)`;
  const cible = 'tspan';
  return (
    `#ligne-${rang} [data-logo-anime] ${cible} {` +
    ` animation-delay: ${retard} !important;` +
    ` animation-play-state: paused !important; }`
  );
}

function pageDe(anim, mode) {
  const feuille = lire('src/styles/theme-defaut.css');
  /* Le dessin livré porte désormais ses `<tspan>` lui-même : la planche
     montre exactement le balisage du site, sans rien transformer. */
  const dessin = svgLogotype(VARIANTE_EN_TETE, '1.125rem');
  const lignes = INSTANTS.map(
    (p, i) => `
    <section class="ligne" id="ligne-${i}">
      <p class="pct">${p} %</p>
      <div class="entete">
        <svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span data-logo-anime="${anim}">${dessin}</span>
        <span class="remplissage"></span>
      </div>
    </section>`,
  ).join('');
  const gels = INSTANTS.map((p, i) => figer(anim, i, p)).join('\n');
  const proposition = ANIMATIONS.find((a) => a.id === anim);

  return `<!doctype html>
<html lang="fr" data-palette="egee" data-theme="${mode}" style="color-scheme:${mode === 'sombre' ? 'dark' : 'light'}">
<head><meta charset="utf-8" /><title>Planche 65 ter</title>
<style>
${polices}
${feuille}
${CSS_ANIMATION}
${gels}
:root { --font-sans: 'Public Sans', Arial, sans-serif; --font-serif: 'Spectral', Georgia, serif; }
* { box-sizing: border-box; }
body { margin: 0; padding: 18px; background: var(--etat-fond); color: var(--etat-texte);
       font-family: var(--font-sans); width: ${LARGEUR}px; }
h1 { font-size: 14px; margin: 0 0 2px; font-weight: 600; }
.sous { font-size: 11.5px; color: var(--etat-texte-faible); margin: 0 0 14px; line-height: 1.45; }
.ligne { display: flex; align-items: stretch; border: 1px solid var(--etat-bordure);
         border-radius: 6px; margin-bottom: 8px; overflow: hidden;
         background: var(--etat-fond-eleve); }
.pct { flex: none; width: 56px; margin: 0; display: flex; align-items: center;
       justify-content: center; font-size: 11px; color: var(--etat-texte-faible);
       border-right: 1px solid var(--etat-bordure); font-variant-numeric: tabular-nums; }
/* L'en-tête dans ses mesures réelles : 44 px de rangée, l'icône puis le nom. */
.entete { flex: 1; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; }
.icone { width: 20px; height: 20px; flex: none; color: var(--etat-texte); }
.remplissage { flex: 1; }
</style></head>
<body>
  <h1>${proposition.nom} — ${DUREES[anim]} ms</h1>
  <p class="sous">${proposition.quoi}.<br />Thème Égée · ${mode} · l’en-tête, à six instants.</p>
  ${lignes}
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
for (const { id } of ANIMATIONS) {
  for (const mode of ['clair', 'sombre']) {
    const ctx = await nav.newContext({
      viewport: { width: LARGEUR, height: 520 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const fichier = `${PROVISOIRE}/${id}-${mode}.html`;
    writeFileSync(fichier, pageDe(id, mode));
    await page.goto(`file://${fichier}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    /* LA PLANCHE REFUSE DE RENDRE UNE IMAGE SANS THÈME — garde héritée du 65,
       où la première planche montrait un thème qui n'était pas chargé. */
    const jetons = await page.evaluate(() => {
      const r = getComputedStyle(document.documentElement);
      return ['--etat-fond', '--etat-texte', '--etat-texte-faible'].map((n) =>
        r.getPropertyValue(n).trim(),
      );
    });
    if (jetons.some((v) => !v)) {
      throw new Error(`Thème non appliqué sur ${id}/${mode} : jetons vides.`);
    }

    /*
       ET ELLE REFUSE DE RENDRE UNE BANDE QUI NE BOUGE PAS.

       C'est le contrôle qui compte ici : six lignes figées à six instants ne
       prouvent rien si le gel n'a pas pris — on obtiendrait six fois la même
       image, et une bande parfaitement immobile se lirait comme « animation
       très discrète » au lieu de « mesure ratée ». On relève donc l'état
       effectif de chaque ligne, et on exige qu'il VARIE.
    */
    const etats = await page.evaluate(() =>
      [...document.querySelectorAll('.ligne')].map((l) => {
        /*
           LA BONNE `svg`, ET NON LA PREMIÈRE. L'icône de menu est elle aussi
           une `<svg>`, et elle vient AVANT le logotype dans la rangée : une
           sonde qui prend `querySelector('svg')` mesure l'icône, qui n'est pas
           animée, et conclut que le gel n'a pas pris. C'est ce que ce contrôle
           m'a dit au premier tour, et j'ai failli corriger l'animation pour un
           défaut de ma mesure.
        */
        const porteur = l.querySelector('[data-logo-anime]');
        const cible = porteur.querySelector('tspan[style*="--rang"]') ?? porteur.querySelector('svg');
        const st = getComputedStyle(cible);
        return `${st.opacity}|${st.transform}|${st.clipPath}`;
      }),
    );
    if (new Set(etats).size < 4) {
      throw new Error(
        `Le gel n'a pas pris sur ${id}/${mode} : ${new Set(etats).size} états distincts ` +
          `sur ${etats.length} lignes — ${[...new Set(etats)].join(' ; ')}`,
      );
    }

    const png = `${SORTIE}/${id}-${mode}.png`;
    await page.screenshot({ path: png, fullPage: true });
    faites.push({ png, etats: new Set(etats).size });
    await ctx.close();
  }
}

await nav.close();
console.log(`\n${faites.length} bandes dans ${SORTIE} :`);
for (const f of faites) console.log(`  ${f.png} — ${f.etats} états distincts sur 6 lignes`);
