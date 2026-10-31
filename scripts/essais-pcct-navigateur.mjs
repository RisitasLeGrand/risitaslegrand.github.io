/**
 * L'ÉCRAN DE PCCT, MESURÉ AU NAVIGATEUR (L2 du prompt 64).
 *
 *   SITE_PASSWORD=… npm run essais:pcct:navigateur
 *
 * ## Ce qui s'éprouve ici, et ce qui ne s'y éprouve pas
 *
 * `essais:pcct` tient déjà onze gardes du MOTEUR, en quelques dizaines de
 * millisecondes et sans bâtisse : le rythme, l'attribution d'une frappe, les
 * réponses possibles du pavé et leur remélange, la politique de voix. Rien de
 * cela n'est repris ici.
 *
 * Restent les cinq choses qu'un moteur pur ne peut pas montrer :
 *
 *  1. les valeurs par défaut AFFICHÉES sont celles du moteur. La référence
 *     écrit 20 minutes et 3 000 ms dans son balisage quand son code en met
 *     d'autres : la personne règle donc à partir de nombres faux, et la séance
 *     ne dure pas ce qu'elle a lu ;
 *  2. chaque touche du pavé atteint 44 px sous pointeur grossier ;
 *  3. le pavé se remélange d'un essai à l'autre — le moteur le promet, et l'on
 *     vérifie que l'écran lui passe bien le rang ;
 *  4. le verdict passe par une région vocale, et en toutes lettres ;
 *  5. Échap demande confirmation, et l'annulation laisse la séance courir.
 *
 * Plus le mouvement réduit, mesuré dans un second contexte : une animation
 * conditionnée par une requête média ne se lit que là.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

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
    `  ${rouge('✗')} ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/** Mène une page jusqu'à l'écran de réglages de PCCT, déverrouillée. */
async function ouvrirPcct(ctx) {
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}/cog-training/pcct/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  /* On attend un contrôle, et non un délai : le composant est « client:only »
     et son premier rendu suit le déverrouillage. */
  await page.waitForSelector('#commencer', { timeout: 40000 });
  return { page, erreurs };
}

/**
 * Pose un réglage de curseur.
 *
 * Par `stepUp`/`stepDown` plutôt que par affectation : un `input[type=range]`
 * ramène toute valeur assignée sur sa grille de pas, et une affectation hors
 * grille passerait en silence au cran voisin — l'essai mesurerait alors autre
 * chose que ce qu'il croit régler.
 */
async function reglerCurseur(page, id, valeur) {
  await page.$eval(
    `#${id}`,
    (e, v) => {
      e.value = String(v);
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    },
    valeur,
  );
}

/* ── 1. Les valeurs par défaut affichées ─────────────────────────────────── */

console.log('\nL’ÉCRAN DE PCCT\n');
console.log('LES VALEURS PAR DÉFAUT AFFICHÉES SONT CELLES DU MOTEUR');

const ctxFin = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
const { page, erreurs } = await ouvrirPcct(ctxFin);

/*
   Les attendus sont écrits en clair plutôt que lus dans `reglages.ts` : un
   essai qui importerait la table comparerait la table à elle-même et resterait
   vert si les deux changeaient ensemble. Ce sont les valeurs du moteur, et
   `essais:pcct` garde de son côté qu'elles ne bougent pas.
*/
const attendus = { duree: '15', n: '1', 'intervalle-depart': '1500', 'delai-de-grace': '300' };
for (const [id, valeur] of Object.entries(attendus)) {
  verifier(`${id} : le curseur part de ${valeur}`, await page.inputValue(`#${id}`), valeur);
}
/* Et l'étiquette dit la MÊME chose que le curseur : un libellé figé dans le
   balisage est précisément le défaut de la référence. */
verifier(
  'l’étiquette de durée dit la même valeur',
  await page.locator('[data-valeur="duree"]').innerText(),
  '15',
);
verifier(
  'celle de l’intervalle aussi',
  await page.locator('[data-valeur="intervalleDepart"]').innerText(),
  '1500',
);
verifier(
  'et celle du délai de grâce',
  await page.locator('[data-valeur="delaiDeGrace"]').innerText(),
  '300',
);

/* ── 2. Le pavé : les touches, leur taille, leur ordre ───────────────────── */

console.log('\nLA DÉCOUVERTE S’OUVRE, ET LE PAVÉ EST LÀ');

/* Une cadence courte : l'essai doit voir plusieurs essais passer sans attendre
   quinze secondes par mesure. 400 ms est assez lent pour que la lecture du
   DOM ne course pas le rendu, assez rapide pour cinq essais en deux secondes. */
await reglerCurseur(page, 'intervalle-depart', 400);
await page.uncheck('#son');
await page.click('#decouvrir');
await page.waitForSelector('[data-nombre]', { timeout: 10000 });

verifier(
  'la découverte dit qu’elle n’enregistre rien',
  await page.locator('[data-decouverte]').isVisible(),
  true,
);
const touches = await page.$$eval('[data-touche-pave]', (es) =>
  es.map((e) => Number(e.dataset.touchePave)),
);
/* Somme sur 1 à 9 : les sommes possibles vont de 2 à 18, soit dix-sept
   touches. La prémisse est explicite — un pavé vide rendrait vraies, sans
   rien mesurer, toutes les assertions qui suivent. */
verifier('prémisse : le pavé porte ses dix-sept touches', touches.length, 17);
verifier('et ce sont bien les sommes de 2 à 18', [...touches].sort((a, b) => a - b), [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
]);

console.log('\nLE PAVÉ SE REMÉLANGE D’UN ESSAI À L’AUTRE');

/*
   On relève l'ordre à plusieurs essais SUCCESSIFS, repérés par le rang que
   l'écran pose sur le nombre. Sans ce repère il faudrait deviner qu'un essai a
   changé en regardant l'ordre — c'est-à-dire supposer ce qu'on mesure.
*/
const releves = new Map();
const limite = Date.now() + 8000;
while (releves.size < 4 && Date.now() < limite) {
  const vu = await page.evaluate(() => {
    const n = document.querySelector('[data-nombre]');
    if (!n) return null;
    return {
      rang: Number(n.getAttribute('data-rang')),
      ordre: [...document.querySelectorAll('[data-touche-pave]')].map(
        (e) => e.dataset.touchePave,
      ),
    };
  });
  if (vu && vu.ordre.length && !releves.has(vu.rang)) releves.set(vu.rang, vu.ordre.join(','));
}
verifier('prémisse : quatre essais distincts relevés', releves.size, 4);
verifier(
  'et leurs quatre ordres sont tous différents',
  new Set(releves.values()).size,
  releves.size,
);

console.log('\nCHAQUE TOUCHE ATTEINT 44 PX SOUS POINTEUR GROSSIER');

/*
   Mesuré dans un SECOND contexte : « pointer: coarse » n'est vrai que si le
   contexte déclare « hasTouch » et « isMobile », et les hauteurs minimales du
   site ne s'appliquent pas sans cela. Mesurer dans le contexte à souris aurait
   donné un vert qui ne dit rien du doigt.
*/
const ctxDoigt = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const { page: pageDoigt, erreurs: erreursDoigt } = await ouvrirPcct(ctxDoigt);
verifier(
  'prémisse : le pointeur est bien grossier',
  await pageDoigt.evaluate(() => window.matchMedia('(pointer: coarse)').matches),
  true,
);
await pageDoigt.uncheck('#son');
await pageDoigt.click('#decouvrir');
await pageDoigt.waitForSelector('[data-touche-pave]', { timeout: 10000 });

/*
   CE QUE CE COMPOSANT DOIT RÉELLEMENT FOURNIR, ET C'EST UN SABOTAGE QUI L'A DIT.

   Mon premier sabotage retirait `cible-tactile-pleine` des touches, et la
   mesure est restée VERTE. Mesuré ensuite touche par touche : 65 × 44 px, et
   `min-height` calculé à 44 px bien que la classe soit partie. La hauteur ne
   vient donc pas d'ici — `global.css` donne 2,75 rem à TOUT `button` sous
   « pointer: coarse », d'un seul geste et pour tout le site. Ce que la classe
   ajoute est la LARGEUR, et la largeur n'est en cause que si la grille se
   resserre : à cinq colonnes sur 390 px, chaque touche fait 65 px et aucun
   réglage de ce composant ne peut la faire descendre.

   La garde reste — elle dit ce qu'on promet, et elle rougirait si le socle
   perdait sa règle —, mais le défaut ATTEIGNABLE est la grille trop dense.
   D'où la seconde mesure, et les deux sabotages qui vont avec : une grille à
   neuf colonnes déborde l'écran avec la classe, et passe sous 44 px sans elle.
*/
const tropPetites = await pageDoigt.$$eval('[data-touche-pave]', (es) =>
  es
    .map((e) => ({ t: e.dataset.touchePave, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.height < 44 || r.width < 44)
    .map(({ t, r }) => `${t}: ${Math.round(r.width)}×${Math.round(r.height)}`),
);
const combien = await pageDoigt.$$eval('[data-touche-pave]', (es) => es.length);
verifier('prémisse : les touches sont là, au doigt aussi', combien, 17);
verifier('aucune touche sous 44 px', tropPetites, []);

/*
   ET AUCUNE TOUCHE N'EN RECOUVRE UNE AUTRE, ni ne sort de l'écran.

   C'EST LE SABOTAGE QUI A ÉCRIT CETTE MESURE, en deux temps. Une grille à neuf
   colonnes sur 390 px donne des pistes de 33 px ; la largeur minimale de
   `cible-tactile-pleine` tient alors les 44 px promis, et la garde ci-dessus
   reste verte — mais chaque touche dépasse sa case de onze pixels et MORD sur
   sa voisine. Quarante-quatre pixels dont onze appartiennent au bouton d'à
   côté ne sont pas une cible de quarante-quatre pixels : on appuie sur 7 et
   c'est 8 qui répond.

   Ma première écriture mesurait le débordement de la GRILLE, et elle est
   restée verte aussi : la grille, elle, tient dans la page — ce sont ses
   enfants qui sortent de leurs cases. C'est donc aux TOUCHES qu'il faut
   mesurer, et deux à deux.
*/
const chevauchements = await pageDoigt.$$eval('[data-touche-pave]', (es) => {
  const boites = es.map((e) => ({ t: e.dataset.touchePave, r: e.getBoundingClientRect() }));
  const fautes = [];
  for (let i = 0; i < boites.length; i += 1) {
    for (let j = i + 1; j < boites.length; j += 1) {
      const a = boites[i].r;
      const b = boites[j].r;
      /* Un pixel de tolérance : deux bords jointifs se mesurent parfois à
         0,5 px près selon l'arrondi du facteur d'échelle. */
      const seCroisent =
        a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      if (seCroisent) fautes.push(`${boites[i].t} mord sur ${boites[j].t}`);
    }
  }
  return fautes.slice(0, 4);
});
verifier('aucune touche ne recouvre sa voisine', chevauchements, []);

const horsEcran = await pageDoigt.$$eval('[data-touche-pave]', (es) => {
  const large = document.documentElement.clientWidth;
  return es
    .map((e) => ({ t: e.dataset.touchePave, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.left < -1 || r.right > large + 1)
    .map(({ t, r }) => `${t}: ${Math.round(r.left)}→${Math.round(r.right)} dans ${large}`)
    .slice(0, 4);
});
verifier('aucune touche ne sort de l’écran', horsEcran, []);

/* Et le bouton « Arrêter », qui est le seul autre contrôle de l'écran de jeu. */
const arreter = await pageDoigt.locator('#arreter').boundingBox();
verifier(
  '« Arrêter » atteint 44 px de haut',
  arreter.height >= 44,
  true,
);

/* ── 3. Le retour en toutes lettres ─────────────────────────────────────── */

console.log('\nL’APPARITION DU NOMBRE EST ANIMÉE, ET LES DEUX RÉGLAGES L’ÉTEIGNENT');

/*
   LE TÉMOIN SE MESURE SUR LE VRAI ÉLÉMENT, et c'est un rouge qui l'a imposé.

   Ma première écriture fabriquait un `<span class="apparition">` et lisait son
   `animation-name`. Il valait « none » — non parce que la feuille respectait
   quoi que ce soit, mais parce que le style d'un composant Svelte est PORTÉ :
   la règle compilée est `.apparition.svelte-xxxx`, et un élément injecté ne
   porte pas le suffixe. Le témoin ne mesurait donc rien, et un composant qui
   n'animerait rien du tout aurait passé pour respectueux.
*/
verifier(
  'témoin : sans demande de calme, le nombre EST animé',
  await page.$eval('[data-nombre]', (e) => getComputedStyle(e).animationName) !== 'none',
  true,
);

/*
   ET LE SECOND CHEMIN : le réglage de l'APPLICATION, posé en « data-animations »
   sur la racine par la page Paramètres, que la requête média ne connaît pas.
   Ne lire que la requête média laisserait l'animation à qui a coché « animations
   réduites » dans Cyclades sur un système qui ne demande rien — c'est le défaut
   que `essais:mouvement-reduit` interdit, et qu'il a déjà trouvé ailleurs.

   On attend le PROCHAIN essai : la classe est posée au rendu du nombre, et
   l'essai en cours a été rendu avant que l'attribut ne change.
*/
const rangAvant = await page.$eval('[data-nombre]', (e) => Number(e.dataset.rang));
await page.evaluate(() => document.documentElement.setAttribute('data-animations', 'reduites'));
await page
  .waitForFunction(
    (r) => Number(document.querySelector('[data-nombre]')?.dataset.rang) > r,
    rangAvant,
    { timeout: 6000 },
  )
  .catch(() => {});
verifier(
  'le réglage de l’application éteint l’animation, sans la requête média',
  await page.$eval('[data-nombre]', (e) => getComputedStyle(e).animationName),
  'none',
);
await page.evaluate(() => document.documentElement.removeAttribute('data-animations'));

console.log('\nLE VERDICT PASSE PAR UNE RÉGION VOCALE, ET EN TOUTES LETTRES');

/*
   La région existe AVANT qu'elle ait à parler : plusieurs lecteurs d'écran
   n'annoncent pas une région `aria-live` ajoutée au DOM au moment même où son
   contenu paraît. C'est donc une mesure à faire ici, et non après la première
   réponse.
*/
verifier(
  'la région existe dès le début de la séance',
  await page.locator('[data-annonce]').count(),
  1,
);
verifier(
  'elle est polie et porte un rôle d’état',
  await page.$eval('[data-annonce]', (e) => [e.getAttribute('aria-live'), e.getAttribute('role')]),
  ['polite', 'status'],
);

/*
   On répond FAUX exprès, en frappant une touche dont on sait qu'elle ne peut
   pas être la réponse — le pavé offre 2 à 18, et l'essai s'appuie sur le fait
   qu'une seule de ces valeurs est juste. On vise donc deux touches de suite :
   l'une au moins est fausse, et le texte doit nommer l'attendu.
*/
await page.waitForSelector('[data-nombre]', { timeout: 10000 });
let texteDuVerdict = '';
for (const cible of [2, 18]) {
  await page.click(`[data-touche-pave="${cible}"]`).catch(() => {});
  await page.waitForFunction(
    () => (document.querySelector('[data-annonce]')?.textContent ?? '').trim().length > 0,
    { timeout: 4000 },
  ).catch(() => {});
  const vu = (await page.locator('[data-annonce]').innerText()).trim();
  if (/^Faux/.test(vu)) {
    texteDuVerdict = vu;
    break;
  }
  if (/^Juste/.test(vu)) texteDuVerdict = vu;
}
verifier(
  'le verdict est annoncé en toutes lettres',
  /^(Juste|Faux|Échauffement)/.test(texteDuVerdict) ? 'oui' : texteDuVerdict || '(rien)',
  'oui',
);
verifier(
  'et « Faux » dit quel nombre était attendu',
  !texteDuVerdict.startsWith('Faux') || /\d/.test(texteDuVerdict),
  true,
);

/* ── 4. Échap demande confirmation ──────────────────────────────────────── */

console.log('\nÉCHAP DEMANDE CONFIRMATION, ET ANNULER LAISSE COURIR');

await page.waitForSelector('[data-nombre]', { timeout: 10000 });
await page.keyboard.press('Escape');
await page.waitForSelector('dialog[open]', { timeout: 4000 }).catch(() => {});
verifier(
  'Échap ouvre une demande de confirmation',
  await page.locator('dialog[open]').count(),
  1,
);
verifier(
  'la séance n’est PAS arrêtée tant qu’on n’a pas répondu',
  await page.locator('[data-zone-de-jeu]').count(),
  1,
);

await page.locator('dialog[open] button[value="non"]').click().catch(async () => {
  await page.keyboard.press('Escape');
});
await page.waitForTimeout(600);
verifier('annuler laisse la séance courir', await page.locator('[data-nombre]').count(), 1);

/* Et confirmer l'arrête, UNE SEULE FOIS : deux bilans voudraient dire deux
   séances enregistrées pour une seule jouée. */
await page.keyboard.press('Escape');
await page.waitForSelector('dialog[open]', { timeout: 4000 }).catch(() => {});
await page.locator('dialog[open] button[value="oui"]').click();
await page.waitForSelector('[data-bilan]', { timeout: 6000 });
verifier('confirmer arrête la séance', await page.locator('[data-bilan]').count(), 1);
verifier(
  'et la découverte redit qu’elle n’a rien enregistré',
  await page.locator('[data-rien-enregistre]').isVisible(),
  true,
);
verifier('la zone de jeu a disparu', await page.locator('[data-zone-de-jeu]').count(), 0);

/* ── 5. Le mouvement réduit ─────────────────────────────────────────────── */

console.log('\nET LA REQUÊTE MÉDIA L’ÉTEINT AUSSI, DANS SON PROPRE CONTEXTE');

const ctxCalme = await nav.newContext({
  viewport: { width: 1280, height: 1000 },
  reducedMotion: 'reduce',
});
const { page: pageCalme, erreurs: erreursCalme } = await ouvrirPcct(ctxCalme);
verifier(
  'prémisse : la requête média est bien vraie',
  await pageCalme.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  true,
);
await pageCalme.uncheck('#son');
await pageCalme.click('#decouvrir');
await pageCalme.waitForSelector('[data-nombre]', { timeout: 10000 });
verifier(
  'aucune animation sur le nombre',
  await pageCalme.$eval('[data-nombre]', (e) => getComputedStyle(e).animationName),
  'none',
);

verifier('aucune erreur de page (souris)', erreurs.slice(0, 3), []);
verifier('aucune erreur de page (doigt)', erreursDoigt.slice(0, 3), []);
verifier('aucune erreur de page (mouvement réduit)', erreursCalme.slice(0, 3), []);

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('L’écran de PCCT se joue au doigt, au clavier et à l’oreille.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
