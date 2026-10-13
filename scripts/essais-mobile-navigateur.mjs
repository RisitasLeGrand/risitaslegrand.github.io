/**
 * Le téléphone : pas de défilement latéral, et des cibles qu'un doigt atteint.
 *
 * ## M2 — la page ne doit pas être plus large que l'écran
 *
 * Un seul élément trop large élargit la page entière, et tout le texte se met
 * à défiler de côté. Le contrôle compare la largeur de défilement du document
 * à celle de la fenêtre, et, en cas d'écart, **nomme** les éléments qui
 * dépassent — sans quoi le constat est vrai et inutilisable.
 *
 * Un graphique plus large que l'écran n'est pas en cause s'il défile dans son
 * propre conteneur : c'est la page qui ne doit pas bouger, pas chaque boîte
 * qui doit rentrer.
 *
 * ## M3 — la hauteur des cibles
 *
 * WCAG 2.2 AA pose 24 px comme plancher ; l'usage tactile recommande 44. Le
 * contrôle **échoue** sous 24 px et se contente de compter ce qui est entre
 * 24 et 44 : transformer la recommandation en règle ferait échouer des écrans
 * que personne n'a décidé de reprendre, et un contrôle qu'on apprend à
 * ignorer ne contrôle plus rien.
 *
 * L'exception « en ligne » du critère est appliquée, et il faut dire
 * pourquoi : WCAG 2.5.8 exempte explicitement un lien **posé dans une phrase
 * ou un bloc de texte**. « INSEE » cité au fil d'une actualité fait 12 px de
 * haut parce que c'est la hauteur d'une ligne ; lui en imposer 24 écarterait
 * les lignes du paragraphe les unes des autres pour rien. Le contrôle écarte
 * donc les liens dont le bloc parent porte d'autre texte qu'eux, et ne
 * retient que les cibles isolées — boutons, dépliants, liens seuls dans leur
 * bloc.
 *
 * La condition « pointer: coarse » n'est vraie que si le contexte déclare
 * « hasTouch » : sans cela, les hauteurs minimales du site ne s'appliquent
 * pas et la mesure accuse à tort. C'est une erreur qui a déjà été commise
 * ici, et c'est pour cela qu'elle est écrite.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const PLANCHER = 24;
const CONFORT = 44;

const ECRANS = [
  '/revisions/',
  '/statistiques/',
  '/bibliotheque/',
  '/glossaire/',
  '/actualites/',
  '/quiz/',
  '/quiz/dgfip/',
  '/progression/',
  '/profil/',
  '/odyssee/',
  '/sport/',
];

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(`\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`);
    rouges += 1;
  }
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  // Sans ces deux-là, « pointer: coarse » est faux et les hauteurs minimales
  // du site ne s'appliquent pas.
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

verifier(
  'le navigateur se déclare bien tactile',
  await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches),
  true,
);

const debordent = [];
let souslePlancher = 0;
let entreLesDeux = 0;
let cibles = 0;

for (const ecran of ECRANS) {
  await page.goto(`${RACINE}${ecran}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(800);

  const m = await page.evaluate(
    ([plancher, confort]) => {
      const racine = document.documentElement;
      const coupables = [...document.querySelectorAll('body *')]
        .filter((x) => x.getBoundingClientRect().right > racine.clientWidth + 1)
        // Un élément qui défile dans un conteneur prévu pour n'élargit rien.
        .filter((x) => !x.closest('[class*="overflow-x-auto"], [class*="overflow-x-scroll"]'))
        .slice(0, 4)
        .map((x) => `${x.tagName.toLowerCase()}${x.id ? '#' + x.id : ''}`);

      /** Vrai pour un lien posé au fil d'une phrase : exempté par 2.5.8. */
      const enLigne = (x) => {
        if (x.tagName !== 'A') return false;
        const bloc = x.parentElement;
        if (!bloc) return false;
        const sans = (bloc.textContent ?? '').replace(x.textContent ?? '', '').trim();
        return sans.length > 0;
      };

      const isolees = [...document.querySelectorAll('a[href], button:not([disabled]), summary')]
        .filter((x) => x.getClientRects().length > 0 && !x.closest('#ecran-verrou'))
        .filter((x) => !enLigne(x));
      const hauteurs = isolees.map((x) => Math.round(x.getBoundingClientRect().height));
      const fautives = isolees
        .filter((x) => x.getBoundingClientRect().height < plancher)
        .map((x) => `${x.tagName.toLowerCase()}${x.id ? '#' + x.id : ''} « ${(x.textContent ?? '').trim().slice(0, 30)} » ${Math.round(x.getBoundingClientRect().height)}px`);

      return {
        large: racine.scrollWidth > racine.clientWidth,
        largeur: racine.scrollWidth,
        fenetre: racine.clientWidth,
        coupables,
        petites: hauteurs.filter((h) => h < plancher).length,
        fautives,
        moyennes: hauteurs.filter((h) => h >= plancher && h < confort).length,
        total: hauteurs.length,
      };
    },
    [PLANCHER, CONFORT],
  );

  if (m.large) debordent.push(`${ecran} ${m.largeur}/${m.fenetre} px${m.coupables.length ? ' (' + m.coupables.join(', ') + ')' : ''}`);
  souslePlancher += m.petites;
  entreLesDeux += m.moyennes;
  cibles += m.total;
  for (const f of m.fautives) console.log(`  ${ecran} ${f}`);
}

await contexte.close();
await nav.close();

verifier(`M2 — aucun des ${ECRANS.length} écrans ne défile latéralement`, debordent, []);
verifier(`M3 — aucune cible sous ${PLANCHER} px (plancher WCAG 2.2 AA)`, souslePlancher, 0);
console.log(
  `  (${cibles} cibles mesurées ; ${entreLesDeux} entre ${PLANCHER} et ${CONFORT} px, ` +
    `au-dessus du plancher mais sous le confort tactile)`,
);

if (rouges > 0) {
  console.log(`\n\x1b[31m${rouges} constat(s) en échec.\x1b[0m`);
  process.exit(1);
}
console.log('\n\x1b[32mTous les essais passent.\x1b[0m');
