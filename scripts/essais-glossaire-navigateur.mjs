/**
 * Le glossaire : cinq cent trente et un termes qu'on doit pouvoir parcourir.
 *
 * ## Ce que la critique reprochait
 *
 * « Le champ de filtre et l'index A–Z existent, mais l'index n'est pas fixé :
 * après un saut, on ne peut plus changer de lettre sans remonter. Sur
 * téléphone : 88 891 px. »
 *
 * Le défaut n'est donc pas la hauteur — un glossaire de cinq cents entrées est
 * long, et le raccourcir voudrait dire en retirer — mais le fait qu'on ne
 * puisse pas en sortir. Les contrôles ci-dessous mesurent la **sortie**, pas
 * la hauteur : après un saut vers une lettre tardive, l'index est-il encore
 * là, montre-t-il où l'on est, et le haut de page est-il à un geste.
 *
 * ## G5 et les deux colonnes
 *
 * Sur grand écran, la hauteur, elle, se mesure : deux colonnes la coupent en
 * deux. L'essai compare la page telle qu'elle est servie à la même page dont
 * on force une seule colonne, dans le même navigateur et le même instant —
 * la seule comparaison qui ne dépende pas d'une mesure faite un autre jour.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(
      `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
    );
    rouges += 1;
  }
};
const mesure = (quoi, valeur) => console.log(`\x1b[36m·\x1b[0m ${quoi} : ${valeur}`);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

await page.goto(`${RACINE}/glossaire/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#barre-index.flex', { timeout: 30000 });
await page.waitForTimeout(500);

const inventaire = await page.evaluate(() => ({
  termes: document.querySelectorAll('#glossaire dt').length,
  lettres: document.querySelectorAll('#lettres a').length,
  hauteur: document.documentElement.scrollHeight,
}));
mesure('termes rendus', inventaire.termes);
mesure('lettres dans l’index', inventaire.lettres);
mesure('hauteur de page à 390 px (telle que servie)', `${inventaire.hauteur} px`);

const hauteurSansDiffere = await page.evaluate(() => {
  const style = document.createElement('style');
  style.textContent = '.differe { content-visibility: visible !important; }';
  document.head.appendChild(style);
  document.documentElement.scrollHeight;
  const h = document.documentElement.scrollHeight;
  style.remove();
  return h;
});
mesure('hauteur de page à 390 px (rendu différé neutralisé)', `${hauteurSansDiffere} px`);

// G4 — le rendu différé est bien appliqué à toutes les sections.
verifier(
  'G4 — chaque section de lettre est en rendu différé, avec une taille annoncée',
  await page.evaluate(() => {
    const sections = [...document.querySelectorAll('section[id^="lettre-"]')];
    return {
      sections: sections.length,
      differees: sections.filter((s) => getComputedStyle(s).contentVisibility === 'auto').length,
      sansTaille: sections.filter((s) => !s.style.containIntrinsicSize).length,
    };
  }),
  { sections: inventaire.lettres, differees: inventaire.lettres, sansTaille: 0 },
);

// G1 — après un saut vers une lettre tardive, l'index est encore là.
const derniere = await page.evaluate(
  () => [...document.querySelectorAll('#lettres a')].at(-1)?.textContent ?? '',
);
await page.click(`#lettres a:last-child`);
await page.waitForTimeout(900);

const apresSaut = await page.evaluate((lettre) => {
  const barre = document.getElementById('barre-index').getBoundingClientRect();
  const entete = document.querySelector('header').getBoundingClientRect();
  const section = document.getElementById(`lettre-${lettre}`);
  const titre = section.querySelector('h2').getBoundingClientRect();
  return {
    defilement: Math.round(window.scrollY),
    barreVisible: barre.top >= 0 && barre.bottom <= window.innerHeight && barre.height > 0,
    barreSousEntete: Math.abs(Math.round(barre.top - entete.bottom)) <= 1,
    titreSousLaBarre: titre.top >= barre.bottom - 1,
    ecartAuTitre: Math.round(titre.top - barre.bottom),
    marquee: document.querySelector('#lettres [aria-current="true"]')?.textContent ?? '',
    lettresAtteignables: [...document.querySelectorAll('#lettres a')].filter((a) => {
      const r = a.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    }).length,
  };
}, derniere);

mesure(`saut vers « ${derniere} »`, `${apresSaut.defilement} px de défilement`);
verifier('G1 — après le saut, l’index est toujours dans l’écran', apresSaut.barreVisible, true);
verifier('G1 — il est collé sous l’en-tête, sans trou ni recouvrement', apresSaut.barreSousEntete, true);
verifier('G1 — le titre de la lettre visée n’est pas caché derrière', apresSaut.titreSousLaBarre, true);
mesure('écart entre le bas de la bande et le titre atteint', `${apresSaut.ecartAuTitre} px`);
verifier(
  'G6 — le saut atterrit sur la lettre visée, et non à cinq mille pixels de là',
  Math.abs(apresSaut.ecartAuTitre) <= 4,
  true,
);
verifier('G1 — des lettres restent cliquables sans remonter', apresSaut.lettresAtteignables > 0, true);
verifier('G3 — la lettre atteinte est marquée dans l’index', apresSaut.marquee, derniere);

// G2 — le bouton « Haut » ramène en haut et rend le focus au filtre.
await page.click('#haut-de-page');
await page.waitForTimeout(1200);
verifier(
  'G2 — « Haut » ramène en haut de page et rend le focus au champ de filtre',
  await page.evaluate(() => ({
    defilement: Math.round(window.scrollY),
    focus: document.activeElement?.id ?? '',
  })),
  { defilement: 0, focus: 'filtre-glossaire' },
);

// G3 bis — le marqueur suit le défilement, sans qu'on ait cliqué.
const suivi = await page.evaluate(async () => {
  const lettres = [...document.querySelectorAll('#lettres a')].map((a) => a.textContent);
  const vues = [];
  for (const lettre of [lettres[1], lettres[Math.floor(lettres.length / 2)], lettres.at(-2)]) {
    /*
       Deux passes, et c'est voulu : à défilement nul la bande n'est pas encore
       collée, et sa position d'alors n'est pas celle qu'elle aura après le
       saut. Une seule passe visait donc trois cents pixels trop bas — c'est
       l'essai qui était faux, pas la page.

       On ne vise pas le haut de la section mais dix pixels en dessous : c'est
       la section où l'on se trouve réellement qui doit être marquée.
    */
    for (let passe = 0; passe < 2; passe += 1) {
      const section = document.getElementById(`lettre-${lettre}`);
      const barre = document.getElementById('barre-index').getBoundingClientRect();
      window.scrollTo({
        top: window.scrollY + section.getBoundingClientRect().top - barre.bottom + 10,
        behavior: 'instant',
      });
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 200));
    vues.push({
      attendu: lettre,
      marquee: document.querySelector('#lettres [aria-current="true"]')?.textContent ?? '',
    });
  }
  return vues;
});
verifier(
  'G3 — le marqueur suit le défilement de la page',
  suivi.map((v) => v.marquee === v.attendu),
  [true, true, true],
);

// G5 — deux colonnes sur grand écran, et ce que ça change.
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(600);
const large = await page.evaluate(() => {
  const dl = document.querySelector('#glossaire dl');
  const style = document.createElement('style');
  style.textContent = '.differe { content-visibility: visible !important; }';
  document.head.appendChild(style);
  const deux = document.documentElement.scrollHeight;
  const colonnes = getComputedStyle(dl).columnCount;
  const forcee = document.createElement('style');
  forcee.textContent = '#glossaire dl { columns: 1 !important; }';
  document.head.appendChild(forcee);
  const une = document.documentElement.scrollHeight;
  forcee.remove();
  style.remove();
  return { colonnes, deux, une };
});
verifier('G5 — deux colonnes à 1280 px', large.colonnes, '2');
mesure('hauteur à 1280 px, deux colonnes', `${large.deux} px`);
mesure('hauteur à 1280 px, une colonne', `${large.une} px`);
verifier('G5 — les deux colonnes raccourcissent bien la page', large.deux < large.une, true);

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
verifier(
  'G5 — une seule colonne sur téléphone',
  await page.evaluate(() => getComputedStyle(document.querySelector('#glossaire dl')).columnCount),
  'auto',
);

await nav.close();
console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
