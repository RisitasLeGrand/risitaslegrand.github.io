/**
 * Le bandeau du coffre : masquable, et l'interdit 6 qui ne cède pas.
 *
 *   npm run essais:bandeau-coffre
 *
 * ## Ce qu'il garde
 *
 * Le bandeau ambre prend 57 px, mesurés, soit 7,7 % d'un écran de téléphone.
 * Alexis a demandé à pouvoir le fermer, pour la session puis « à perpétuelle
 * demeure ». La tentation est de masquer et de passer à autre chose — et
 * c'est exactement là que l'interdit 6 du prompt 35 tomberait : « Fermer le
 * coffre » doit rester atteignable **partout où le coffre est ouvert**.
 *
 * Le relevé du 14 octobre avait montré que six pages sous coffre sur dix
 * n'offraient aucun bouton de fermeture. On ne refait pas ce chemin à
 * l'envers : le balayage ci-dessous rouvre la question sur **toutes** les
 * routes, bandeau masqué.
 *
 * ## Ce qu'il mesure, et non ce qu'il lit
 *
 * Il ne cherche pas la règle dans le code : il masque le bandeau par le
 * geste réel, recharge, et regarde ce que l'écran offre.
 */
import { chromium } from 'playwright-core';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { devientVisible } from './lib/post-condition.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
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

function routes() {
  const base = resolve(ICI, '..', 'src', 'pages');
  const out = [];
  const parcourir = (d, prefixe) => {
    for (const e of readdirSync(d)) {
      const c = join(d, e);
      if (statSync(c).isDirectory()) parcourir(c, `${prefixe}${e}/`);
      else if (e.endsWith('.astro')) {
        out.push(e === 'index.astro' ? prefixe : `${prefixe}${e.replace('.astro', '')}/`);
      }
    }
  };
  parcourir(base, '/');
  return out.sort();
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

const ouvrirLeCoffre = async () => {
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  /*
     ON ATTEND LE CADENAS, ET NON LE BANDEAU.

     Les deux sont peints par DEUX chaînes asynchrones indépendantes :
     « surCoffre » les notifie tous les deux, et chacun lit son propre réglage.
     Attendre l'un ne dit rien de l'autre, et c'est une temporisation de 600 ms
     qui couvrait l'écart. Mesuré : la peinture du cadenas retardée d'une
     seconde, deux assertions tombent.

     Le cadenas est le bon témoin de l'ouverture, parce qu'il paraît CHAQUE
     fois que le coffre s'ouvre. Le bandeau, lui, peut rester masqué — c'est
     précisément ce que la moitié de cet essai mesure —, et l'attendre ici
     ferait expirer l'aide dans les cas où son absence est la bonne réponse.

     L'échec de l'attente n'est plus avalé par un « catch » vide : il était
     muet, et l'assertion d'après rendait un faux sans dire que l'élément
     n'était jamais venu.
  */
  await page.waitForSelector('#cadenas-coffre', { timeout: 40000 });
};

await ouvrirLeCoffre();

/* ── La prémisse ───────────────────────────────────────────────────── */

verifier(
  'le bandeau est visible tant qu’on ne l’a pas masqué',
  await devientVisible(page, '#temoin-coffre', true),
  true,
);
verifier(
  'et le cadenas compact l’accompagne dès l’ouverture',
  await devientVisible(page, '#cadenas-coffre', true),
  true,
);

/*
   Ce que « Masquer » rend, c'est la place AVANT LE CONTENU, et non la
   hauteur de l'en-tête.

   Depuis M5 (18 octobre), le bandeau est au-dessus de l'en-tête collant et
   non dedans : le masquer ne change plus la hauteur de l'en-tête, qui reste
   à 103 px. L'ancienne mesure comparait donc 103 à 103 et accusait à tort
   une correction qui a, en vrai, rendu 105 px d'écran — 48 de bandeau et 57
   de collant. On mesure maintenant d'où commence à lire le contenu, ce qui
   est la seule chose dont dépend qui lit.
*/
const placeAvantLeContenu = () =>
  page.evaluate(() => {
    const c = document.getElementById('contenu-principal') ?? document.querySelector('main');
    // `window.scrollY` et non un `scrollTo` : le défilement est animé
    // (`scroll-behavior: smooth`), et une mesure prise juste après rendait
    // la position d'avant — −3015 px au lieu de 148.
    return c ? Math.round(c.getBoundingClientRect().top + window.scrollY) : -1;
  });
const hauteurAvant = await placeAvantLeContenu();

/* ── « Masquer » : l’onglet, et pas au-delà ────────────────────────── */

await page.click('#temoin-coffre-masquer');
verifier(
  '« Masquer » retire le bandeau',
  await devientVisible(page, '#temoin-coffre', false),
  true,
);
verifier(
  'mais pas le cadenas, qui porte le geste',
  await devientVisible(page, '#cadenas-coffre', true),
  true,
);

const hauteurApres = await placeAvantLeContenu();
verifier(
  `le haut de page rend la place du bandeau (${hauteurAvant} → ${hauteurApres} px)`,
  hauteurApres < hauteurAvant,
  true,
);

verifier(
  'rien n’est écrit dans le stockage durable pour un masquage de session',
  await page.evaluate(() => localStorage.getItem('cyclades.affichage.bandeau-coffre')),
  null,
);

/* ── L’interdit 6, sur TOUTES les routes, bandeau masqué ───────────── */

{
  /*
     L'écran qui se lit SANS le mot de passe n'a pas d'en-tête, donc pas de
     cadenas — et il ne peut pas en avoir.

     « Mot de passe perdu » est rendu avec `sansNavigation`, ce qui retire
     l'en-tête entier : c'est tout son objet, puisqu'on y arrive depuis
     l'écran de saisie, avant d'être entré. Un cadenas « Fermer le coffre »
     sur une page qu'on lit justement parce qu'on ne peut rien ouvrir n'aurait
     aucun sens. L'interdit 6 vise les écrans de l'application, pas la notice
     de secours.

     Bornée à une seule : si la liste s'allonge, c'est que l'interdit cède,
     et l'essai doit le dire.
  */
  const EXCEPTIONS = [
    {
      route: '/mot-de-passe-perdu/',
      pourquoi:
        'rendue sans en-tête (`sansNavigation`) parce qu’elle se lit avant ' +
        'd’être entré ; il n’y a donc aucun coffre à y fermer.',
    },
  ];
  const exceptee = (r) => EXCEPTIONS.some((e) => e.route === r);
  const sans = [];
  for (const r of routes()) {
    await page.goto(`${RACINE}${r}`, { waitUntil: 'networkidle' }).catch(() => {});
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
      /* Le champ qui s'en va est la post-condition du déverrouillage. */
      await devientVisible(page, '#champ-mdp', false);
    }
    /*
       L'ATTENTE PORTE LA QUESTION, et c'est ce qui la rend juste.

       Deux temporisations à l'aveugle couvraient le déverrouillage et la
       peinture du cadenas : 800 et 250 ms, sur soixante routes. Sous une
       batterie chargée, une route lente était comptée comme une route SANS
       « Fermer le coffre » — c'est-à-dire comme une violation de l'interdit 6,
       alors que rien n'y manquait.

       L'attente bornée dit exactement ce que la boucle veut savoir : le
       cadenas vient-il, oui ou non, dans un délai raisonnable ? Son expiration
       est la réponse « non », pas un accident de mesure. Une route qui ne
       l'offre vraiment jamais est toujours comptée — après dix secondes au
       lieu d'une.
    */
    const offert = await page
      .waitForFunction(
        () => {
          const zone = document.getElementById('cadenas-coffre');
          const visible = zone !== null && !zone.classList.contains('hidden');
          return visible && document.getElementById('cadenas-fermer') !== null;
        },
        undefined,
        { timeout: 10000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!offert && !exceptee(r)) sans.push(r);
  }
  verifier(
    'INTERDIT 6 — « Fermer le coffre » reste offert sur chaque route, bandeau masqué',
    sans,
    [],
  );
  verifier('et les exceptions restent au nombre d’une', EXCEPTIONS.length, 1);
  for (const e of EXCEPTIONS) console.log(`    exception : ${e.route} — ${e.pourquoi}`);
}

/* ── Le retour du bandeau à la réouverture ─────────────────────────── */

await page.evaluate(() => sessionStorage.clear());
await ouvrirLeCoffre();
verifier(
  'un masquage de session ne survit pas à la session',
  await page.locator('#temoin-coffre').isVisible(),
  true,
);

/* ── Le bandeau tient sur UNE rangée, et ce qui n'y tient pas est ailleurs ─ */

/*
   M5, 18 octobre. À 360 px le bandeau faisait 105 px : ses cinq libellés
   passaient à la ligne deux fois. Sous 640 px il n'en porte plus que deux —
   « Fermer le coffre » et « Masquer » — et les deux autres vivent dans le
   menu du cadenas. L'essai le vérifie dans les deux sens : une seule rangée
   ici, et le geste retrouvé là-bas.
*/
verifier(
  'le bandeau tient sur une seule rangée sous 640 px',
  await page.evaluate(() => {
    const rangee = document.querySelector('#temoin-coffre > div');
    if (!rangee) return null;
    const visibles = [...rangee.children].filter((c) => c.getBoundingClientRect().height > 0);
    if (!visibles.length) return null;
    /*
       Le nombre de rangées se déduit de la hauteur, et non des `top`.
       Compter les `top` distincts donnait 2 sur une rangée unique, tout
       simplement parce qu'un libellé de 15 px et un bouton de 44 px centrés
       l'un à côté de l'autre ne commencent pas à la même ordonnée.
    */
    const st = getComputedStyle(rangee);
    const interieur =
      rangee.getBoundingClientRect().height -
      parseFloat(st.paddingTop) -
      parseFloat(st.paddingBottom);
    const plusHaut = Math.max(...visibles.map((c) => c.getBoundingClientRect().height));
    return Math.max(1, Math.round(interieur / plusHaut));
  }),
  1,
);
verifier(
  '« Masquer indéfiniment » n’y est plus proposé sur téléphone',
  await page.locator('#temoin-coffre-masquer-toujours').isVisible(),
  false,
);

/* ── « Masquer indéfiniment » : il survit au rechargement ──────────── */

await page.click('#cadenas-coffre-bouton');
verifier(
  'mais le menu du cadenas le porte',
  await devientVisible(page, '#cadenas-masquer-toujours', true),
  true,
);
await page.click('#cadenas-masquer-toujours');
/*
   LA POST-CONDITION EST LA CLÉ ELLE-MÊME, et non la disparition du bandeau.

   À ce point de l'essai, le bandeau est déjà masqué par le geste de session :
   attendre qu'il disparaisse serait déjà vrai avant le clic — le premier motif
   d'attente fragile. La clé durable, elle, est écrite PAR ce geste et par lui
   seul. L'attente est bornée, donc son expiration est un rouge et non un vert
   à vide.
*/
const durableEcrit = await page
  .waitForFunction(
    () => localStorage.getItem('cyclades.affichage.bandeau-coffre') === 'masque',
    undefined,
    { timeout: 10000 },
  )
  .then(() => true)
  .catch(() => false);
verifier('le réglage durable est écrit sur l’appareil', durableEcrit, true);

await ouvrirLeCoffre();
verifier(
  'et le bandeau ne revient pas à la réouverture du coffre',
  await devientVisible(page, '#temoin-coffre', false),
  true,
);
verifier(
  'le cadenas, lui, est toujours là',
  await devientVisible(page, '#cadenas-coffre', true),
  true,
);

/* ── Le rétablissement, depuis le menu du cadenas ──────────────────── */

await page.click('#cadenas-coffre-bouton');
verifier(
  '« Afficher le bandeau » n’est proposé que lorsqu’il est masqué',
  await devientVisible(page, '#cadenas-afficher-bandeau', true),
  true,
);
await page.click('#cadenas-afficher-bandeau');
verifier('il revient aussitôt', await devientVisible(page, '#temoin-coffre', true), true);
/* Là encore, la clé est écrite par ce geste : on attend sa levée. */
const durableLeve = await page
  .waitForFunction(
    () => localStorage.getItem('cyclades.affichage.bandeau-coffre') === null,
    undefined,
    { timeout: 10000 },
  )
  .then(() => true)
  .catch(() => false);
verifier('et le réglage durable est levé', durableLeve, true);

/* ── Le clavier ────────────────────────────────────────────────────── */

await page.click('#cadenas-coffre-bouton');
/* Le menu ouvert est la post-condition du clic ; l'attribut se lit après. */
await devientVisible(page, '#cadenas-coffre-menu', true);
verifier(
  'le menu s’ouvre et le dit',
  await page.getAttribute('#cadenas-coffre-bouton', 'aria-expanded'),
  'true',
);
await page.keyboard.press('Escape');
verifier(
  'Échap le referme',
  await devientVisible(page, '#cadenas-coffre-menu', false),
  true,
);
verifier(
  'et rend le focus au cadenas plutôt qu’au corps de la page',
  await page.evaluate(() => document.activeElement?.id ?? ''),
  'cadenas-coffre-bouton',
);

/* ── Coffre fermé, le cadenas disparaît comme le bandeau ───────────── */

await page.click('#cadenas-coffre-bouton');
await devientVisible(page, '#cadenas-coffre-menu', true);
await page.click('#cadenas-fermer');
verifier(
  'coffre fermé, le cadenas s’efface',
  await devientVisible(page, '#cadenas-coffre', false),
  true,
);
verifier(
  'et le bandeau aussi',
  await devientVisible(page, '#temoin-coffre', false),
  true,
);

await contexte.close();
await nav.close();
process.exit(rouges === 0 ? 0 : 1);
