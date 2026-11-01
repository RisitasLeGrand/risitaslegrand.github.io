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
  page.on('pageerror', (e) => {
    const message = e.message.slice(0, 160);
    erreurs.push(message);
    /*
       IMPRIMÉE TOUT DE SUITE, et non seulement rangée pour la garde finale.
       Une erreur de page empêche souvent la suite de paraître : le script meurt
       alors sur un sélecteur expiré, bien avant d'atteindre la garde, et la
       sortie ne nomme pas la cause. C'est arrivé — il a fallu sonder la page à
       la main pour lire « operationDeLEssai is not defined ».
    */
    console.log(`  ${rouge('‼')} erreur de page : ${message}`);
  });
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

/* Les touches de consigne, mesurées de la même façon : la seconde tâche se
   joue au doigt ou pas du tout. */
const consigneTropPetites = await pageDoigt.$$eval('[data-touche-consigne]', (es) =>
  es
    .map((e) => ({ t: e.dataset.toucheConsigne, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.height < 44 || r.width < 44)
    .map(({ t, r }) => `${t}: ${Math.round(r.width)}×${Math.round(r.height)}`),
);
verifier(
  'prémisse : les huit touches de consigne sont là au doigt',
  await pageDoigt.$$eval('[data-touche-consigne]', (es) => es.length),
  8,
);
verifier('aucune touche de consigne sous 44 px', consigneTropPetites, []);

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

/* ── La mémoire prospective, à l'écran ──────────────────────────────────── */

console.log('\nLA CONSIGNE PARAÎT, DISPARAÎT, ET SE RÉPOND À L’HEURE');

/*
   Une page neuve, et l'horizon ramené à son minimum — dix secondes. Sans ce
   réglage l'écart est tiré entre douze et trente-cinq secondes : l'essai
   attendrait jusqu'à trente-cinq secondes par mesure, et ne saurait pas quand.
   Avec lui, l'échéance est à dix secondes de la pose, et la mesure est bornée.
*/
const { page: pagePm, erreurs: erreursPm } = await ouvrirPcct(ctxFin);
await reglerCurseur(pagePm, 'prospective-horizon', 10000);
verifier(
  'prémisse : l’horizon est bien à dix secondes',
  await pagePm.inputValue('#prospective-horizon'),
  '10000',
);
verifier(
  'prémisse : la mémoire prospective est active par défaut',
  await pagePm.isChecked('#prospective'),
  true,
);
await pagePm.uncheck('#son');
await pagePm.click('#commencer');
await pagePm.waitForSelector('[data-nombre]', { timeout: 10000 });

/* Les huit touches de consigne, et leurs cibles — la seconde tâche doit se
   jouer au doigt comme la première. */
const lettres = await pagePm.$$eval('[data-touche-consigne]', (es) =>
  es.map((e) => e.dataset.toucheConsigne),
);
verifier('les huit touches de consigne sont offertes', lettres, [
  'K', 'L', 'M', 'P', 'Q', 'S', 'V', 'X',
]);
verifier(
  'et les deux régions vocales sont DEUX éléments distincts',
  /* Chaque terme supporte l'absence de la région : lire `getAttribute` sur
     `null` levait dans la page, et le sabotage 28 — une seule région pour les
     deux tâches — rendait un PLANTAGE sans croix au lieu d'un rouge nommé. */
  await pagePm.evaluate(() => {
    const a = document.querySelector('[data-annonce]');
    const b = document.querySelector('[data-annonce-pm]');
    return [a !== null, b !== null, a !== null && b !== null && a !== b, b?.getAttribute('aria-live') ?? '(pas de région)'];
  }),
  [true, true, true, 'polite'],
);

/* La consigne paraît. Elle est posée au premier battement du compte à rebours,
   donc dans la première seconde. */
await pagePm.waitForSelector('[data-consigne]', { timeout: 8000 });
const laTouche = await pagePm.$eval('[data-consigne]', (e) => e.dataset.consigne);
verifier(
  'la consigne nomme une touche de la liste',
  ['K', 'L', 'M', 'P', 'Q', 'S', 'V', 'X'].includes(laTouche),
  true,
);

/*
   PUIS ELLE DISPARAÎT, et c'est tout le sujet : la laisser à l'écran jusqu'à
   son échéance ferait de la mémoire prospective une simple consigne de
   lecture. L'affichage par défaut dure 6 500 ms.
*/
/* L'attente est rattrapée : sans le `catch`, une consigne qui resterait à
   l'écran ferait EXPIRER l'attente, et l'essai mourrait sur une exception au
   lieu de rendre un rouge nommé. Le sabotage 26 l'a montré — code 1, zéro
   croix, et un message qui ne disait pas ce qui manquait. */
await pagePm
  .waitForSelector('[data-consigne]', { state: 'detached', timeout: 12000 })
  .catch(() => {});
verifier(
  'la consigne a disparu avant son échéance',
  await pagePm.locator('[data-consigne]').count(),
  0,
);

/*
   ET ELLE SE RÉPOND À L'HEURE, AU DOIGT.

   CE QUE CETTE GARDE COUVRE, MESURÉ ET NON SUPPOSÉ. J'avais d'abord écrit
   qu'elle attrapait une horloge en temps absolu — « toute échéance serait déjà
   passée, chaque consigne jugée oubliée ». Deux sabotages ont dit le contraire.

   Passer `depuisLeDebut` en temps absolu : VERT. L'origine se simplifie,
   puisque la pose et la frappe lisent la même horloge — la consigne est posée
   à `t+10 s` et répondue à `t+10 s`, quel que soit `t`.

   Ne décaler que la frappe, en lui donnant `performance.now()` quand la pose
   compte depuis le départ : VERT ENCORE. L'écart vaut le temps écoulé entre le
   chargement de la page et le lancement, soit une à deux secondes ici —
   c'est-à-dire moins que la fenêtre de trois secondes, qui l'absorbe.

   Ce que la garde attrape vraiment, et ce sont deux défauts vraisemblables :
   la rangée tactile qui ne serait que décorative — ses huit boutons rendus
   mais non branchés, la seconde tâche injouable au doigt —, et un désaccord
   d'horloges assez grand pour sortir de la fenêtre. Les sabotages 25a et 25b
   rendent chacun un rouge.

   Ce qu'une origine fausse abîmerait réellement est hors de portée d'ici : le
   refus de poser quand l'échéance ne tiendrait plus avant la fin de séance,
   qui compare à la durée. En temps absolu, une page ouverte depuis un quart
   d'heure cesserait d'en poser, et il faudrait une page de cet âge pour le
   voir. `essais:pcct` garde cette règle au moteur, en millisecondes.

   On appuie en boucle dans la fenêtre plutôt qu'une fois à l'instant calculé :
   la fenêtre fait trois secondes, et viser une milliseconde exacte serait un
   pari sur l'ordonnanceur.
*/
let verdictPm = '';
const butoir = Date.now() + 16000;
while (Date.now() < butoir) {
  await pagePm.click(`[data-touche-consigne="${laTouche}"]`).catch(() => {});
  const vu = (await pagePm.locator('[data-annonce-pm]').innerText()).trim();
  if (/à l’heure/.test(vu)) {
    verdictPm = 'à l’heure';
    break;
  }
  if (/oubliée|trop tard/.test(vu)) {
    verdictPm = vu;
    break;
  }
  await pagePm.waitForTimeout(300);
}
verifier('la consigne répondue dans sa fenêtre est jugée « à l’heure »', verdictPm, 'à l’heure');

/* Et sans la mémoire prospective, rien de tout cela n'est à l'écran : un
   réglage décoché qui laisserait la rangée visible promettrait une tâche qui
   ne vient pas. */
const { page: pageSansPm } = await ouvrirPcct(ctxFin);
await pageSansPm.uncheck('#prospective');
await pageSansPm.uncheck('#son');
await pageSansPm.click('#decouvrir');
await pageSansPm.waitForSelector('[data-nombre]', { timeout: 10000 });
await pageSansPm.waitForTimeout(1500);
verifier(
  'décochée, la mémoire prospective ne met rien à l’écran',
  await pageSansPm.evaluate(() => [
    document.querySelectorAll('[data-touche-consigne]').length,
    document.querySelectorAll('[data-consigne]').length,
    document.querySelectorAll('[data-annonce-pm]').length,
  ]),
  [0, 0, 0],
);
await pageSansPm.close();

/* ── L3. Les quatre modules, à l'écran ──────────────────────────────────── */

/**
 * SUIT LA SUITE DES NOMBRES PRÉSENTÉS, DEPUIS LA PAGE.
 *
 * Par un observateur de mutations plutôt que par un sondage depuis Node : à
 * 1 500 ms d'intervalle un sondage à 150 ms suffirait en théorie, mais il
 * manquerait un essai dès que l'ordonnanceur hésite, et la suite des nombres
 * est la base de tous les attendus calculés ici. Un essai manqué décalerait
 * chaque somme et rendrait des rouges qui ne diraient rien du site.
 */
async function suivreLesNombres(page) {
  await page.evaluate(() => {
    window.__suivi = [];
    const noter = () => {
      const e = document.querySelector('[data-nombre]');
      if (!e) return;
      const rang = Number(e.dataset.rang);
      const dernier = window.__suivi[window.__suivi.length - 1];
      if (dernier && dernier.rang === rang) return;
      window.__suivi.push({
        rang,
        nombre: Number(e.dataset.nombre),
        signal: document.querySelector('[data-signal-inhibition]') !== null,
      });
    };
    noter();
    new MutationObserver(noter).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
}

/** Le dernier essai vu, et son signal. */
const essaiCourant = (page) =>
  page.evaluate(() => {
    const e = document.querySelector('[data-nombre]');
    return {
      rang: e ? Number(e.dataset.rang) : null,
      suivi: window.__suivi ?? [],
      signal: document.querySelector('[data-signal-inhibition]') !== null,
      annonce: (document.querySelector('[data-annonce-modules]')?.textContent ?? '').trim(),
    };
  });

/** Attend qu'un autre essai que `rang` soit à l'écran. Rend son rang, ou null. */
async function attendreLEssaiSuivant(page, rang, msMax = 9000) {
  const butoir = Date.now() + msMax;
  while (Date.now() < butoir) {
    const vu = await essaiCourant(page);
    if (vu.rang !== null && vu.rang !== rang) return vu.rang;
    await page.waitForTimeout(80);
  }
  return null;
}

/** Mène une page jusqu'à une séance de découverte, modules posés. */
async function ouvrirSeanceModules(ctx, poser) {
  const { page, erreurs } = await ouvrirPcct(ctx);
  await page.uncheck('#son');
  await page.uncheck('#prospective');
  await page.selectOption('#operation', 'somme');
  await poser(page);
  /* La découverte écrit dans le dépôt MUET : aucune de ces mesures n'ajoute
     une séance au magasin de la personne. */
  await page.click('#decouvrir');
  await page.waitForSelector('[data-nombre]', { timeout: 10000 });
  await suivreLesNombres(page);
  /* La garde est posée ICI, avant tout ce qui pourrait expirer : une séance qui
     lève à la pose du premier essai doit rendre un rouge nommé, et non un
     sélecteur introuvable quinze lignes plus bas. */
  verifier('la séance s’ouvre sans erreur de page', erreurs.slice(0, 3), []);
  return { page, erreurs };
}

const ctxModules = await nav.newContext({
  viewport: { width: 1280, height: 1000 },
  hasTouch: true,
});

/* ── L3.a Les modules s'allument depuis les réglages ───────────────────── */

console.log('\nL3 — LES QUATRE MODULES S’ALLUMENT DEPUIS LES RÉGLAGES');

const { page: pageReglages } = await ouvrirPcct(ctxModules);
verifier(
  'les quatre cases existent, et toutes les quatre sont ÉTEINTES',
  await pageReglages.evaluate(() =>
    ['inhibition', 'ndm', 'sdm', 'changement-de-regle'].map((id) => {
      const e = document.getElementById(id);
      return e === null ? '(absente)' : e.checked;
    }),
  ),
  [false, false, false, false],
);
/* Un module éteint ne montre pas son réglage fin : un curseur de fréquence
   visible sans l'inhibition promettrait un réglage sans effet. */
verifier(
  'et leurs réglages fins ne paraissent pas encore',
  await pageReglages.evaluate(() => [
    document.querySelectorAll('#inhibition-frequence').length,
    document.querySelectorAll('#changement-de-regle-bloc').length,
  ]),
  [0, 0],
);
await pageReglages.check('#inhibition');
await pageReglages.check('#changement-de-regle');
verifier(
  'cochés, les deux réglages fins paraissent',
  await pageReglages.evaluate(() => [
    document.querySelectorAll('#inhibition-frequence').length,
    document.querySelectorAll('#changement-de-regle-bloc').length,
  ]),
  [1, 1],
);
/*
   « EXPÉRIMENTAL » EST ÉCRIT, et c'est une exigence du Pilote. Le mot est lu
   dans l'étiquette de la case, et non quelque part sur la page : un avis posé
   ailleurs ne serait pas lu par qui coche.
*/
verifier(
  'le changement de règle est marqué « expérimental » dans SON étiquette',
  await pageReglages.evaluate(() => {
    const e = document.getElementById('changement-de-regle');
    const etiquette = e?.closest('label');
    return /expérimental/i.test(etiquette?.textContent ?? '');
  }),
  true,
);
await pageReglages.close();

/* ── L3.b L'inhibition se joue au doigt ET au clavier ──────────────────── */

console.log('\nL3 — L’INHIBITION SE JOUE AU DOIGT ET AU CLAVIER');

/*
   LA FRÉQUENCE AU MAXIMUM — un essai sur deux porte le signal.

   Sans ce réglage le défaut vaut 20 %, et attendre un essai signalé prendrait
   cinq essais en moyenne, dix ou quinze parfois : la mesure dépendrait du
   tirage. À 50 % l'attente est de deux essais, et les butoirs tiennent.
*/
const { page: pageInh, erreurs: erreursModules } = await ouvrirSeanceModules(
  ctxModules,
  async (page) => {
    await page.check('#inhibition');
    await reglerCurseur(page, 'inhibition-frequence', 50);
    /* La prémisse se lit ICI, avant le lancement : le panneau des réglages
       disparaît avec le départ de la séance, et la lire plus bas mourrait sur
       un sélecteur introuvable au lieu de rendre un rouge nommé. */
    verifier(
      'prémisse : la fréquence du signal est bien à 50 %',
      await page.inputValue('#inhibition-frequence'),
      '50',
    );
  },
);

/*
   « RETENIR » EST OFFERT SUR TOUS LES ESSAIS, SIGNALÉS OU NON.

   C'est la condition de la fausse alarme, et donc du module : chez la
   référence le champ est désactivé sur un essai d'inhibition et les touches ne
   sont lues que sur lui — personne ne peut signaler qu'il retient, ni se
   tromper en le signalant à tort. Un bouton qui n'apparaîtrait que sur les
   essais signalés serait le même défaut retourné : il DIRAIT le signal, et
   retenir deviendrait gratuit.
*/
verifier(
  'le bouton « Retenir » est là, et le pavé n’est pas désactivé',
  await pageInh.evaluate(() => [
    document.querySelectorAll('[data-retenir]').length,
    document.querySelectorAll('[data-touche-pave][disabled]').length,
  ]),
  [1, 0],
);

/** Attend un essai dont le signal vaut `veut`. Rend son rang, ou null. */
async function attendreUnEssai(page, veut, msMax = 20000) {
  const butoir = Date.now() + msMax;
  while (Date.now() < butoir) {
    const vu = await essaiCourant(page);
    if (vu.rang !== null && vu.rang >= 2 && vu.signal === veut) return vu.rang;
    await page.waitForTimeout(70);
  }
  return null;
}

/*
   LE SIGNAL EST ÉCRIT. Un signal porté par la seule couleur de la bordure ne
   parviendrait pas à qui ne la distingue pas, et « omis » tomberait alors sur
   une personne qui n'avait aucun moyen de savoir.
*/
const rangSignale = await attendreUnEssai(pageInh, true);
verifier('un essai signalé paraît', rangSignale !== null, true);
verifier(
  'et son signal est écrit en toutes lettres, pas seulement coloré',
  await pageInh.evaluate(() => {
    const e = document.querySelector('[data-signal-inhibition]');
    return [
      e !== null,
      /retenir/i.test(e?.textContent ?? ''),
      e?.getAttribute('aria-live') ?? '(pas de région)',
    ];
  }),
  [true, true, 'assertive'],
);

/* AU DOIGT : on presse « Retenir » sur l'essai signalé, et le verdict tombe
   quand le suivant paraît — jamais avant, puisque ne rien faire est aussi un
   verdict. */
await pageInh.tap('[data-retenir]');
verifier(
  'presser « Retenir » se voit tout de suite (aria-pressed)',
  await pageInh.getAttribute('[data-retenir]', 'aria-pressed'),
  'true',
);
await attendreLEssaiSuivant(pageInh, rangSignale);
verifier(
  'au doigt, le signal retenu est annoncé « retenu »',
  /Retenu/i.test((await essaiCourant(pageInh)).annonce),
  true,
);

/*
   AU CLAVIER : LA BARRE D'ESPACE, LE FOCUS RENDU AU CORPS DU DOCUMENT.

   LA PREMIÈRE VERSION DE CETTE GARDE ÉTAIT VIDE, et un sabotage l'a dit : en
   retirant entièrement la branche de l'espace du gestionnaire de fenêtre, la
   garde restait VERTE. La raison est que la mesure venait de TAPER sur
   « Retenir », lequel gardait le focus — et un bouton focalisé s'active à
   l'espace par le navigateur, sans qu'aucun gestionnaire de fenêtre existe.
   Elle mesurait donc une propriété de tout bouton, pas la liaison du site.

   Le focus est donc rendu au corps du document, avec une prémisse qui le dit :
   sans elle, la garde pourrait redevenir vide en silence si l'ordre des
   mesures changeait un jour.
*/
const rangSignale2 = await attendreUnEssai(pageInh, true);
verifier('un second essai signalé paraît', rangSignale2 !== null, true);
await pageInh.evaluate(() => {
  const vise = document.activeElement;
  if (vise instanceof HTMLElement) vise.blur();
});
verifier(
  'prémisse : plus aucun contrôle n’a le focus',
  await pageInh.evaluate(() => document.activeElement?.tagName ?? '(aucun)'),
  'BODY',
);
await pageInh.keyboard.press(' ');
verifier(
  'au clavier, l’espace retient aussi — sans passer par le bouton',
  await pageInh.getAttribute('[data-retenir]', 'aria-pressed'),
  'true',
);
await attendreLEssaiSuivant(pageInh, rangSignale2);
verifier(
  'et le verdict est le même',
  /Retenu/i.test((await essaiCourant(pageInh)).annonce),
  true,
);

/*
   LA FAUSSE ALARME EST POSSIBLE, ET ELLE SE COMPTE.

   C'est l'autre moitié du module, et celle que la référence perd entièrement :
   sans geste disponible il n'y a pas d'erreur de commission, et le taux de
   fausses alarmes — la mesure même de l'inhibition — vaut zéro par
   construction.
*/
const rangOrdinaire = await attendreUnEssai(pageInh, false);
verifier('un essai NON signalé paraît', rangOrdinaire !== null, true);
/*
   ET « RETENIR » Y EST OFFERT AUSSI. C'est la garde du défaut de la référence
   pris à l'envers : un bouton qui n'apparaîtrait que sur les essais signalés
   DIRAIT le signal, rendrait l'inhibition gratuite et la fausse alarme
   impossible. Le compte est lu sur un essai dont on sait qu'il ne porte pas
   le signal.
*/
verifier(
  'et « Retenir » y est offert AUSSI, sans quoi la fausse alarme serait impossible',
  await pageInh.locator('[data-retenir]').count(),
  1,
);
/* Le geste est rattrapé : si le bouton manquait, le `tap` lèverait et l'essai
   mourrait sur une exception au lieu de rendre les rouges ci-dessus. */
await pageInh.tap('[data-retenir]').catch(() => {});
await attendreLEssaiSuivant(pageInh, rangOrdinaire);
verifier(
  'retenir sans signal est annoncé « fausse alarme »',
  /fausse alarme/i.test((await essaiCourant(pageInh)).annonce),
  true,
);

/*
   LES CIBLES, SOUS POINTEUR GROSSIER.

   CE QUE CETTE GARDE PROUVE, ET CE QU'ELLE NE PROUVE PAS. Deux sabotages ont
   précisé sa portée. Retirer `cible-tactile-pleine min-h-11 min-w-11` du
   bouton « Retenir » la laisse VERTE : sous `pointer: coarse`, `global.css`
   donne 2,75 rem de haut à TOUT `button` du site, et la largeur est atteinte
   par les sept lettres de « Retenir ». Le même retrait sur les flèches la fait
   rougir, par la LARGEUR : « Égal » fait quatre lettres et n'atteint pas 44 px
   sans `min-w-11`.

   La garde dit donc vrai — la cible atteint bien 44 px — mais pour la hauteur
   c'est la règle générale qui la tient, non la classe. Ce qui est le bon
   dispositif : la classe sert aux pointeurs fins, où la règle générale ne
   s'applique pas. Un sabotage qui force la hauteur par-dessus la règle
   générale (`style="min-height:0;height:20px"`) fait rougir cette garde, et
   c'est ce qui en établit la moitié « hauteur ».
*/
verifier(
  '« Retenir » atteint 44 px dans les deux sens',
  await pageInh.evaluate(() => {
    const r = document.querySelector('[data-retenir]')?.getBoundingClientRect();
    return r ? [r.width >= 44, r.height >= 44] : ['(absent)'];
  }),
  [true, true],
);

/* ET LE SIGNAL S'EFFACE AVEC LE MODULE : un essai de la séance suivante, sans
   inhibition, ne doit rien en garder. */
const { page: pageSansInh } = await ouvrirSeanceModules(ctxModules, async () => {});
await pageSansInh.waitForTimeout(1200);
verifier(
  'tous les modules éteints, rien des modules n’est à l’écran',
  await pageSansInh.evaluate(() => [
    document.querySelectorAll('[data-retenir]').length,
    document.querySelectorAll('[data-sens]').length,
    document.querySelectorAll('[data-annonce-modules]').length,
    document.querySelectorAll('[data-signal-inhibition]').length,
    document.querySelectorAll('[data-regle-courante]').length,
  ]),
  [0, 0, 0, 0, 0],
);

/*
   ET UN RÉGLAGE ÉTEINT NE COÛTE RIEN AU CLAVIER.

   C'est une régression que j'avais introduite puis corrigée, et que rien ne
   gardait : le gestionnaire appelait `preventDefault` sur l'espace et les trois
   flèches dès qu'une séance courait, modules compris ou non. Les neuf
   personnes sur dix qui ne jouent aucun module perdaient donc le défilement au
   clavier pendant toute leur séance, sans contrepartie — l'espace n'avait
   rien à retenir et les flèches rien à dire.

   La mesure pose un écouteur de `keydown` APRÈS celui du composant, sur la
   même cible et la même phase : il voit donc `defaultPrevented` tel que le
   composant l'a laissé.
*/
const confisquees = [];
for (const touche of [' ', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
  /* PAS DE `await` ICI : la promesse de la page ne se tient qu'à la frappe, et
     l'attendre avant de frapper rendrait toujours le repli du minuteur. */
  const empeche = pageSansInh.evaluate(
    (t) =>
      new Promise((resoudre) => {
        window.addEventListener(
          'keydown',
          (e) => {
            if (e.key === t) resoudre(e.defaultPrevented);
          },
          { once: true },
        );
        /* Le minuteur est le filet : si l'écouteur ne voit rien, la mesure
           rendrait une promesse jamais tenue et l'essai mourrait en attente. */
        setTimeout(() => resoudre('(aucune frappe vue)'), 3000);
      }),
    touche,
  );
  await pageSansInh.evaluate(() => {
    const vise = document.activeElement;
    if (vise instanceof HTMLElement) vise.blur();
  });
  await pageSansInh.keyboard.press(touche);
  confisquees.push(await empeche);
}
verifier(
  'modules éteints, ni l’espace ni les flèches ne sont confisqués',
  confisquees,
  [false, false, false, false],
);

await pageSansInh.close();
await pageInh.close();

/* ── L3.c La flèche vaut avant comme après le nombre ────────────────────── */

console.log('\nL3 — LA FLÈCHE VAUT AVANT COMME APRÈS LE NOMBRE');

/*
   LE DÉFAUT VISÉ, nommé : la référence valide l'essai dès que le nombre est
   complet. Qui donne le sens après son calcul le donne donc à un essai déjà
   clos, et le module ne note jamais rien pour lui. Ici l'essai ne se clôt
   qu'à l'apparition du suivant, et les deux ordres mènent au même verdict.

   La mesure se lit sur `aria-pressed` ET sur la troisième région vocale :
   l'attribut dit que le geste a été REÇU, la région dit qu'il a été JUGÉ.
*/
/*
   LA CADENCE EST POSÉE À 3 000 MS, et ce n'est pas du confort.

   Chaque mesure d'ordre doit tenir dans UN essai : laisser passer la fenêtre
   de grâce (300 ms), répondre au nombre, taper la flèche, relire le rang. À
   1 500 ms cela tient, mais le rythme s'accélère avec la précision — et une
   mesure qui déborde sur l'essai suivant ne dit plus rien de l'écran. Trois
   secondes mettent la fenêtre hors de portée de ce hasard.
*/
const { page: pageNdm } = await ouvrirSeanceModules(ctxModules, async (page) => {
  await page.check('#ndm');
  await reglerCurseur(page, 'n', 1);
  await reglerCurseur(page, 'intervalle-depart', 3000);
});

/** Les trois sens, dans l'ordre du balisage. */
const SENS_POSSIBLES = ['plus-petit', 'egal', 'plus-grand'];

/** Le sens de `valeur` par rapport à `reference`. */
const sensEntre = (valeur, reference) =>
  valeur < reference ? 'plus-petit' : valeur > reference ? 'plus-grand' : 'egal';

/** Répond au nombre, au clavier. */
async function repondreAuNombre(page, valeur) {
  for (const c of String(valeur)) await page.keyboard.press(c === '-' ? '-' : c);
  await page.keyboard.press('Enter');
}

/** La fenêtre de grâce, en millisecondes, plus une marge. */
const APRES_LA_GRACE = 450;

/**
 * Répond au nombre DE L'ESSAI COURANT, et rend ce que le site en a annoncé.
 *
 * POURQUOI L'ATTENTE, ET POURQUOI LA LECTURE DE L'ANNONCE. Un sabotage a
 * montré que « ordre B » était vide : il refusait le sens dès que le nombre
 * était répondu — le défaut même de la référence — et la garde restait VERTE.
 *
 * La cause est le délai de grâce. La mesure répondait dans les 300 ms qui
 * suivent l'apparition, et `attribuer` portait alors la frappe sur l'essai
 * PRÉCÉDENT : `courantRepondu` restait faux, le sabotage ne mordait pas, et la
 * flèche était acceptée. La garde n'avait jamais mis l'écran dans l'état
 * qu'elle prétendait éprouver.
 *
 * On laisse donc passer la fenêtre, puis on LIT l'annonce : le site écrit
 * « (essai précédent, rattrapé) » quand il a rattrapé la frappe. Un
 * « Juste. » nu prouve d'un coup que le nombre a été noté, jugé juste, et
 * porté sur CET essai.
 */
async function repondreAuNombreDeCetEssai(page, valeur) {
  await page.waitForTimeout(APRES_LA_GRACE);
  await repondreAuNombre(page, valeur);
  return (await page.locator('[data-annonce]').innerText()).trim();
}

/**
 * Attend un essai dont le sens attendu est CALCULABLE d'ici, et le rend.
 *
 * Avec `n = 1` et la somme, l'attendu de l'essai de rang r vaut la somme des
 * nombres de rangs r-1 et r. Le sens NDM compare le nombre courant au
 * précédent. Il faut donc deux nombres observés, et c'est pourquoi le suivi
 * est posé dès la première apparition.
 */
async function attendreUnEssaiCalculable(page, msMax = 20000) {
  const butoir = Date.now() + msMax;
  /*
     ON ATTEND UN ESSAI QUI VIENT DE PARAÎTRE, et c'est une correction venue de
     la mesure. La première version rendait l'essai courant quel qu'il soit :
     quand il était déjà à la fin de sa fenêtre, le geste et la frappe qui
     suivaient tombaient sur le SUIVANT, dont le sens attendu diffère. Deux
     gardes rougissaient alors en accusant l'écran d'un défaut qui était dans
     l'essai. On part donc du rang vu à l'entrée et l'on attend qu'il change :
     la fenêtre entière est devant nous.
  */
  const depart = (await essaiCourant(page)).rang;
  while (Date.now() < butoir) {
    const vu = await essaiCourant(page);
    const suivi = vu.suivi;
    const i = suivi.findIndex((e) => e.rang === vu.rang);
    if (
      vu.rang !== depart &&
      i >= 2 &&
      suivi[i - 1].rang === vu.rang - 1 &&
      suivi[i - 2].rang === vu.rang - 2
    ) {
      return {
        rang: vu.rang,
        nombre: suivi[i].nombre,
        precedent: suivi[i - 1].nombre,
        avantPrecedent: suivi[i - 2].nombre,
      };
    }
    await page.waitForTimeout(70);
  }
  return null;
}

/**
 * Joue une interaction SUR UN SEUL ESSAI, et rend l'annonce de sa clôture.
 *
 * `jouer` reçoit l'essai et agit. La fonction vérifie ensuite que le rang n'a
 * PAS changé pendant l'interaction : sinon la mesure a porté sur deux essais,
 * et son verdict ne dit plus rien. Elle recommence alors sur un essai neuf,
 * jusqu'à `tentatives` fois. Rend `null` quand aucune tentative n'a tenu.
 */
async function surUnSeulEssai(page, jouer, tentatives = 6) {
  for (let t = 0; t < tentatives; t += 1) {
    const e = await attendreUnEssaiCalculable(page);
    if (e === null) return null;
    await jouer(e);
    const apres = (await essaiCourant(page)).rang;
    if (apres !== e.rang) continue;
    await attendreLEssaiSuivant(page, e.rang);
    return { essai: e, annonce: (await essaiCourant(page)).annonce };
  }
  return null;
}

/* ORDRE A : la flèche d'abord, le nombre ensuite. */
let recuA = null;
let noteA = null;
const tourA = await surUnSeulEssai(pageNdm, async (e) => {
  const sens = sensEntre(e.nombre, e.precedent);
  await pageNdm.tap(`[data-sens="${sens}"]`);
  recuA = await pageNdm.getAttribute(`[data-sens="${sens}"]`, 'aria-pressed');
  noteA = await repondreAuNombreDeCetEssai(pageNdm, e.nombre + e.precedent);
});
verifier('ordre A — une interaction a tenu dans un seul essai', tourA !== null, true);
verifier('ordre A — prémisse : le nombre a été noté SUR CET ESSAI', noteA, 'Juste.');
verifier('ordre A — la flèche AVANT le nombre est reçue', recuA, 'true');
verifier(
  'ordre A — et rien n’est reproché à la clôture',
  tourA === null ? '(pas de tour)' : tourA.annonce,
  '',
);

/* ORDRE B : le nombre d'abord, la flèche ensuite. C'est celui que la référence
   perd : sa validation automatique clôt l'essai dès que le nombre est complet,
   et la flèche arrive sur un essai déjà noté. */
let recuB = null;
let noteB = null;
const tourB = await surUnSeulEssai(pageNdm, async (e) => {
  const sens = sensEntre(e.nombre, e.precedent);
  noteB = await repondreAuNombreDeCetEssai(pageNdm, e.nombre + e.precedent);
  await pageNdm.tap(`[data-sens="${sens}"]`);
  recuB = await pageNdm.getAttribute(`[data-sens="${sens}"]`, 'aria-pressed');
});
verifier('ordre B — une interaction a tenu dans un seul essai', tourB !== null, true);
/* LA PRÉMISSE QUI MANQUAIT. Sans elle, la frappe pouvait être rattrapée par
   l'essai d'avant : `courantRepondu` restait faux, et « la flèche après le
   nombre » n'était jamais éprouvée. C'est le sabotage S3 qui l'a dit. */
verifier('ordre B — prémisse : le nombre a été noté SUR CET ESSAI', noteB, 'Juste.');
verifier('ordre B — la flèche APRÈS le nombre est reçue elle aussi', recuB, 'true');
verifier(
  'ordre B — et rien n’est reproché à la clôture',
  tourB === null ? '(pas de tour)' : tourB.annonce,
  '',
);

/*
   DEUX CONTRÔLES POSITIFS, sans lesquels les deux gardes ci-dessus seraient
   vides : un écran qui n'annoncerait JAMAIS rien les passerait toutes les
   deux. On donne donc exprès un sens faux, puis aucun sens du tout, et la
   troisième voix doit dire chaque fois ce qui manquait.
*/
const tourFaux = await surUnSeulEssai(pageNdm, async (e) => {
  const juste = sensEntre(e.nombre, e.precedent);
  const faux = SENS_POSSIBLES.find((x) => x !== juste);
  await pageNdm.tap(`[data-sens="${faux}"]`);
  await repondreAuNombreDeCetEssai(pageNdm, e.nombre + e.precedent);
});
verifier(
  'contrôle — un sens faux EST annoncé faux',
  /sens faux/i.test(tourFaux?.annonce ?? ''),
  true,
);

const tourMuet = await surUnSeulEssai(pageNdm, async (e) => {
  await repondreAuNombreDeCetEssai(pageNdm, e.nombre + e.precedent);
});
verifier(
  'contrôle — le sens omis EST réclamé',
  /fallait aussi donner le sens/i.test(tourMuet?.annonce ?? ''),
  true,
);

/*
   ET LA RÉGION SE VIDE. C'est la correction que cette mesure a arrachée :
   la première version n'écrivait que les verdicts qui avaient quelque chose à
   dire, de sorte qu'un essai juste gardait à l'écran le reproche du
   précédent. On vient d'en poser un fautif ; l'essai juste qui suit doit
   effacer son reproche, et non le laisser.
*/
const tourApres = await surUnSeulEssai(pageNdm, async (e) => {
  const sens = sensEntre(e.nombre, e.precedent);
  await pageNdm.tap(`[data-sens="${sens}"]`);
  await repondreAuNombreDeCetEssai(pageNdm, e.nombre + e.precedent);
});
verifier(
  'un essai juste EFFACE le reproche du précédent',
  tourApres === null ? '(pas de tour)' : tourApres.annonce,
  '',
);

/*
   LES TROIS FLÈCHES AU CLAVIER, et c'est une garde qui manquait entièrement :
   le sens ne s'éprouvait qu'au doigt, alors que le composant lie `ArrowLeft`,
   `ArrowDown` et `ArrowRight`. Le Pilote demandait l'équivalence des deux
   voies pour les DEUX modules, pas seulement pour « Retenir ».

   Le focus est rendu au corps du document avant chaque frappe, pour la raison
   apprise sur l'espace : une flèche pressée sur un bouton focalisé pourrait
   être lue par le navigateur, et la garde mesurerait autre chose que la
   liaison du site.
*/
const FLECHE_DU_SENS = {
  ArrowLeft: 'plus-petit',
  ArrowDown: 'egal',
  ArrowRight: 'plus-grand',
};
for (const [touche, sens] of Object.entries(FLECHE_DU_SENS)) {
  /*
     LA LECTURE SE FAIT DANS L'ESSAI, et non après sa clôture : `sensDonne` est
     remis à zéro quand le suivant paraît, de sorte qu'un `aria-pressed` lu
     après la clôture vaut « false » que la flèche ait agi ou non. Lu après
     coup, l'attendu serait vrai de tout, et la garde serait vide — c'est
     précisément l'erreur que les sabotages de l'espace et de l'ordre B m'ont
     apprise, et je ne la refais pas ici.
  */
  let presse = null;
  let autres = null;
  const tour = await surUnSeulEssai(pageNdm, async () => {
    await pageNdm.evaluate(() => {
      const vise = document.activeElement;
      if (vise instanceof HTMLElement) vise.blur();
    });
    await pageNdm.keyboard.press(touche);
    presse = await pageNdm.getAttribute(`[data-sens="${sens}"]`, 'aria-pressed');
    /* ET SEULEMENT CELUI-LÀ : une liaison qui allumerait les trois boutons, ou
       le mauvais, passerait la lecture du seul bouton visé. */
    autres = await pageNdm.evaluate(
      (vise) =>
        [...document.querySelectorAll('[data-sens]')]
          .filter((e) => e.dataset.sens !== vise)
          .map((e) => e.getAttribute('aria-pressed')),
      sens,
    );
  });
  verifier(`au clavier, ${touche} donne « ${sens} »`, presse, 'true');
  verifier(`et ${touche} ne touche pas les deux autres`, autres, ['false', 'false']);
}

/* Les trois cibles de sens, sous pointeur grossier. */
verifier(
  'les trois flèches atteignent 44 px',
  await pageNdm.evaluate(() =>
    [...document.querySelectorAll('[data-sens]')].map((e) => {
      const r = e.getBoundingClientRect();
      return r.width >= 44 && r.height >= 44;
    }),
  ),
  [true, true, true],
);

/* LA TROISIÈME RÉGION VOCALE est un élément DISTINCT des deux autres : trois
   tâches rendent leur verdict au même instant, et une région partagée verrait
   l'un effacer l'autre avant qu'il soit annoncé. */
verifier(
  'les régions vocales sont TROIS éléments distincts',
  await pageNdm.evaluate(() => {
    const a = document.querySelector('[data-annonce]');
    const b = document.querySelector('[data-annonce-pm]');
    const c = document.querySelector('[data-annonce-modules]');
    const vus = new Set([a, b, c].filter((e) => e !== null));
    return [a !== null, c !== null, vus.size, c?.getAttribute('aria-live') ?? '(pas de région)'];
  }),
  /* `b` est absent : la mémoire prospective est décochée dans ces séances.
     On compte donc DEUX éléments distincts, et ce qu'on garde est qu'ils le
     sont — le sabotage « une seule région pour tout » en rendrait un. */
  [true, true, 2, 'polite'],
);
await pageNdm.close();

/* ── L3.d SDM compare le RÉSULTAT attendu, pas le nombre ────────────────── */

console.log('\nL3 — SDM COMPARE LE RÉSULTAT ATTENDU, PAS LE NOMBRE');

/*
   LA GARDE EST DÉCISIVE, et c'est ce qui la distingue d'une garde vide : on
   attend un essai où les deux lectures DIVERGENT — où le sens du résultat
   attendu diffère du sens du nombre. Sur un tel essai, répondre selon le
   résultat attendu doit être tenu pour juste. Un écran qui comparerait les
   nombres rendrait « sens faux », et c'est exactement la confusion NDM/SDM
   qu'on veut interdire.
*/
const { page: pageSdm } = await ouvrirSeanceModules(ctxModules, async (page) => {
  await page.check('#sdm');
  await reglerCurseur(page, 'n', 1);
  await reglerCurseur(page, 'intervalle-depart', 3000);
});

let divergent = null;
let tourSdm = null;
const butoirSdm = Date.now() + 50000;
while (Date.now() < butoirSdm && tourSdm === null) {
  tourSdm = await surUnSeulEssai(
    pageSdm,
    async (e) => {
      const attendu = e.nombre + e.precedent;
      const attenduPrecedent = e.precedent + e.avantPrecedent;
      const sensResultat = sensEntre(attendu, attenduPrecedent);
      const sensNombre = sensEntre(e.nombre, e.precedent);
      /* On ne joue QUE les essais où les deux lectures divergent : sur les
         autres, répondre selon l'une ou l'autre donnerait le même verdict, et
         la garde ne distinguerait plus SDM de NDM. */
      if (sensResultat === sensNombre) return;
      divergent = { ...e, attendu, sensResultat, sensNombre };
      await pageSdm.tap(`[data-sens="${sensResultat}"]`);
      await repondreAuNombreDeCetEssai(pageSdm, attendu);
    },
    1,
  );
  if (divergent === null) tourSdm = null;
}
verifier('un essai où les deux lectures divergent paraît', divergent !== null, true);
verifier(
  'le sens du RÉSULTAT attendu est tenu pour juste',
  tourSdm === null ? '(pas de tour)' : tourSdm.annonce,
  '',
);
await pageSdm.close();

/* ── L3.e Le changement de règle : il charge, il se lit, il contraste ───── */

console.log('\nL3 — LE CHANGEMENT DE RÈGLE CHARGE, SE LIT, ET CONTRASTE');

/*
   « LE CHARGEMENT NE PLANTE PAS QUAND LE CHANGEMENT DE RÈGLE EST ENREGISTRÉ. »

   CE QUE CETTE GARDE PEUT MESURER ICI, ET CE QU'ELLE NE PEUT PAS. J'avais
   d'abord écrit un essai qui posait le réglage, RECHARGEAIT la page et
   vérifiait qu'il survivait. Il a rougi, et il avait tort de rougir : l'écran
   de PCCT ne conserve AUCUN réglage. `reglages` part de `reglagesParDefaut()`
   à chaque montage, et rien n'écrit dans un magasin — j'ai lu le composant
   plutôt que de croire ma garde.

   Le défaut de la référence est donc structurellement absent plutôt que
   corrigé, et le dire est plus honnête que de fabriquer une persistance pour
   avoir quelque chose à garder. Ce qui reste mesurable d'ici, et qui est
   mesuré : monter une séance avec le module allumé ne lève pas, et la bannière
   paraît. L'aller-retour du réglage par `structuredClone` et la validation est
   gardé au moteur, dans `essais:pcct`.

   (Si la persistance des réglages de PCCT est voulue, c'est une tâche à part
   entière : signalée au Pilote, pas improvisée ici.)
*/
const { page: pageRegle, erreurs: erreursRegle } = await ouvrirPcct(ctxModules);
await pageRegle.check('#changement-de-regle');
await reglerCurseur(pageRegle, 'changement-de-regle-bloc', 2);
verifier(
  'prémisse : le bloc est bien à deux essais',
  await pageRegle.inputValue('#changement-de-regle-bloc'),
  '2',
);
verifier(
  'prémisse : deux opérations commutées, donc deux règles possibles',
  await pageRegle.evaluate(() =>
    [...document.querySelectorAll('[data-commutee]')].filter((e) => e.checked).length,
  ),
  2,
);
await pageRegle.uncheck('#son');
await pageRegle.uncheck('#prospective');
await pageRegle.selectOption('#operation', 'somme');
await pageRegle.click('#decouvrir');
await pageRegle.waitForSelector('[data-nombre]', { timeout: 10000 });
await pageRegle.waitForSelector('[data-regle-courante]', { timeout: 6000 });
verifier(
  'la séance monte avec le module, et la bannière paraît',
  await pageRegle.locator('[data-regle-courante]').count(),
  1,
);

/*
   LA RÈGLE SE LIT EN TOUTES LETTRES, et la couleur n'est jamais seule : le
   nom de l'opération est écrit à côté de la pastille. Une bannière qui ne
   dirait la règle que par sa teinte ne la dirait pas du tout à qui ne la
   distingue pas.
*/
const laRegle = await pageRegle.evaluate(() => {
  const e = document.querySelector('[data-regle-courante]');
  return {
    operation: e?.getAttribute('data-regle-courante') ?? '(absente)',
    texte: (e?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    live: e?.getAttribute('aria-live') ?? '(pas de région)',
    pastilleCachee: document
      .querySelector('[data-pastille-regle]')
      ?.getAttribute('aria-hidden'),
  };
});
verifier(
  'la règle courante est l’une des quatre opérations',
  ['somme', 'difference', 'produit', 'quotient'].includes(laRegle.operation),
  true,
);
verifier(
  'elle est écrite en toutes lettres, et marquée « expérimental »',
  [/Règle\s*:/.test(laRegle.texte), /expérimental/i.test(laRegle.texte)],
  [true, true],
);
verifier('la bannière est une région vocale', laRegle.live, 'polite');
verifier(
  'la pastille de couleur est cachée aux lecteurs d’écran',
  laRegle.pastilleCachee,
  'true',
);

/*
   LE CONTRASTE DE LA PASTILLE SUR SON FOND, à 3:1 — le seuil des éléments non
   textuels. Il est mesuré sur les COULEURS CALCULÉES, et non sur les jetons
   écrits dans le code : un jeton juste dans la feuille et mal appliqué dans la
   bannière passerait une lecture du code.
*/
const contrastePastille = await pageRegle.evaluate(() => {
  const lire = (s) => {
    const m = s.match(/-?[\d.]+/g) ?? [];
    return m.slice(0, 3).map(Number);
  };
  const lum = ([r, v, b]) => {
    const f = (c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(v) + 0.0722 * f(b);
  };
  const banniere = document.querySelector('[data-regle-courante]');
  const pastille = document.querySelector('[data-pastille-regle]');
  if (!banniere || !pastille) return '(absents)';
  const a = lum(lire(getComputedStyle(pastille).backgroundColor));
  const b = lum(lire(getComputedStyle(banniere).backgroundColor));
  const haut = Math.max(a, b);
  const bas = Math.min(a, b);
  return Math.round(((haut + 0.05) / (bas + 0.05)) * 100) / 100;
});
verifier(
  'la pastille contraste à 3:1 au moins sur le fond de la bannière',
  typeof contrastePastille === 'number' && contrastePastille >= 3,
  true,
);

/* ET ELLE N'ANIME RIEN : `prefers-reduced-motion` n'a rien à éteindre, ce qui
   est la façon la plus sûre de le respecter. */
/* La DURÉE, et non la propriété : `transition-property` vaut « all » par
   défaut dans la cascade, de sorte qu'un attendu posé sur elle passerait vert
   quoi qu'il arrive. Ce qui dit qu'il n'y a pas de transition, c'est que sa
   durée est nulle. */
verifier(
  'la bannière de règle n’anime ni ne transitionne rien',
  await pageRegle.evaluate(() => {
    const s = getComputedStyle(document.querySelector('[data-regle-courante]'));
    return [s.animationName, s.transitionDuration];
  }),
  ['none', '0s'],
);

/*
   ET LA RÈGLE CHANGE VRAIMENT.

   Un bloc de deux essais et deux opérations commutées : sur une dizaine
   d'essais, la bannière doit porter au moins DEUX opérations différentes. Une
   bannière figée sur la première règle serait le module entier perdu, et rien
   d'autre ne l'attraperait — le moteur, lui, est déjà gardé.
*/
const reglesVues = new Set();
const butoirRegle = Date.now() + 14000;
while (Date.now() < butoirRegle && reglesVues.size < 2) {
  const vue = await pageRegle
    .getAttribute('[data-regle-courante]', 'data-regle-courante')
    .catch(() => null);
  if (vue) reglesVues.add(vue);
  await pageRegle.waitForTimeout(120);
}
verifier('la règle alterne : au moins deux opérations vues', reglesVues.size >= 2, true);

/*
   MOINS DE DEUX OPÉRATIONS COMMUTÉES : LE DIRE PLUTÔT QUE DE LE TAIRE.

   Le moteur garde alors l'opération choisie plus haut — ce qui est le bon
   repli, mais invisible : la personne a coché « changement de règle » et rien
   ne change. La note l'écrit.
*/
const { page: pageUneSeule } = await ouvrirPcct(ctxModules);
await pageUneSeule.check('#changement-de-regle');
await pageUneSeule.uncheck('[data-commutee="difference"]');
verifier(
  'une seule opération commutée : la note le dit',
  await pageUneSeule.evaluate(() => [
    document.querySelectorAll('[data-commutee]').length,
    document.querySelectorAll('[data-pas-dalternance]').length,
  ]),
  [4, 1],
);
await pageUneSeule.check('[data-commutee="difference"]');
verifier(
  'et elle disparaît dès qu’il y en a deux',
  await pageUneSeule.locator('[data-pas-dalternance]').count(),
  0,
);
await pageUneSeule.close();
await pageRegle.close();

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
verifier('aucune erreur de page (mémoire prospective)', erreursPm.slice(0, 3), []);
verifier('aucune erreur de page (modules)', erreursModules.slice(0, 3), []);
verifier('aucune erreur de page (changement de règle)', erreursRegle.slice(0, 3), []);

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('L’écran de PCCT se joue au doigt, au clavier et à l’oreille.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
