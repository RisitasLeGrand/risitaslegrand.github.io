/**
 * LES DEUX DIALOGUES RETIENNENT LE FOCUS, ET LE RENDENT (E4 du prompt 43).
 *
 *   SITE_PASSWORD=… npm run essais:modales:navigateur
 *
 * ## Ce qui était mesuré avant, à 390 px, coffre ouvert
 *
 * - le CENTRE de notifications se déclarait `aria-modal="false"`, laissait le
 *   focus sur son bouton au lieu de l'amener dans le panneau, et **une seule
 *   tabulation** suffisait à passer derrière un panneau qui couvre l'écran.
 *   Échap fermait, mais rendait le focus là où la tabulation l'avait laissé —
 *   sur le commutateur de thème —, si bien que la tabulation suivante
 *   repartait d'un endroit que personne n'avait choisi ;
 * - la feuille « Plus » se déclarait modale et amenait le focus dedans, mais
 *   la tabulation en sortait au vingt-deuxième arrêt.
 *
 * ## Ce que cet essai garde
 *
 * Le tour complet, dans les deux sens : depuis le dernier arrêt, Tab revient
 * au premier ; depuis le premier, Maj+Tab va au dernier. Un piège qui ne
 * tiendrait que vers l'avant laisserait sortir par l'arrière, et c'est le
 * chemin que prend quelqu'un qui cherche à revenir.
 *
 * ## ET LE MENU DU CADENAS, QUI NE DOIT PAS ÊTRE PIÉGÉ
 *
 * C'est la garantie NÉGATIVE de ce lot, et elle compte autant que les autres :
 * le cadenas porte `role="menu"`, et piéger le focus dans un menu serait une
 * faute — un menu se ferme quand le focus le quitte, il ne le retient pas. Le
 * piège est donc facultatif, et le troisième argument de `calqueOuvert` est
 * absent à son appel.
 *
 * Sans ce constat, rien ne dirait qu'on ne l'a pas piégé par commodité. Il
 * demande d'ouvrir le COFFRE — pas seulement la session, qui ne suffit pas —,
 * et c'est `lib/coffre-essais` qui le fait.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { ouvrirLeCoffre } from './lib/coffre-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

/* Les deux dialogues : leur nom, leur déclencheur, leur panneau. */
const DIALOGUES = [
  ['le centre de notifications', '#centre-bouton', '#centre-panneau'],
  ['la feuille « Plus »', '#ouvrir-plus', '#feuille-plus'],
];

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
const vrai = (quoi, condition) => verifier(quoi, condition, true);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
/* 390 px, doigt : c'est la taille où la feuille « Plus » existe, et où le
   panneau du centre couvre l'écran. */
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/revisions/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#centre-bouton', { timeout: 40000 });
await page.waitForTimeout(800);

/** Où est le focus, et est-il dans le panneau ? */
const place = (sel) =>
  page.evaluate((s) => {
    const a = document.activeElement;
    const p = document.querySelector(s);
    return {
      quoi: a && a !== document.body ? `${a.tagName.toLowerCase()}#${a.id || '-'}` : 'body',
      dedans: Boolean(a && p && p.contains(a)),
    };
  }, sel);

/** Les commandes focalisables visibles du panneau, dans l'ordre. */
const commandes = (sel) =>
  page.evaluate((s) => {
    const p = document.querySelector(s);
    if (!p) return [];
    return [
      ...p.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ]
      .filter((e) => e.getClientRects().length > 0)
      .map((e) => `${e.tagName.toLowerCase()}#${e.id || '-'}`);
  }, sel);

console.log('\nLES DEUX DIALOGUES, ET LE FOCUS\n');

for (const [nom, declencheur, panneau] of DIALOGUES) {
  console.log(`── ${nom}`);
  const d = page.locator(declencheur).first();
  vrai('prémisse : le déclencheur est là, et visible', await d.isVisible().catch(() => false));
  if (!(await d.isVisible().catch(() => false))) {
    console.log('      (rien de ce qui suit ne se mesure)');
    continue;
  }
  await d.click();
  await page.waitForTimeout(500);

  const liste = await commandes(panneau);
  vrai(`prémisse : ${liste.length} commandes dans le panneau`, liste.length >= 2);
  verifier(
    'il se déclare modal',
    await page.getAttribute(panneau, 'aria-modal'),
    'true',
  );

  /* 1. Le focus ENTRE dans le panneau. */
  const ouverture = await place(panneau);
  vrai(`à l’ouverture, le focus entre dans le panneau (${ouverture.quoi})`, ouverture.dedans);

  /*
     2. LE TOUR COMPLET VERS L'AVANT. On tabule le nombre de commandes : on
     doit se retrouver au premier arrêt, et n'être jamais sorti en chemin.
  */
  let sortiEnChemin = null;
  for (let i = 0; i < liste.length; i += 1) {
    await page.keyboard.press('Tab');
    const p = await place(panneau);
    if (!p.dedans) {
      sortiEnChemin = `à la tabulation ${i + 1} → ${p.quoi}`;
      break;
    }
  }
  verifier('la tabulation ne sort jamais du panneau', sortiEnChemin, null);
  if (!sortiEnChemin) {
    const apresLeTour = await place(panneau);
    vrai(
      `et le tour boucle sur la première commande (${apresLeTour.quoi} / ${liste[0]})`,
      apresLeTour.quoi === liste[0],
    );
  }

  /*
     3. ET VERS L'ARRIÈRE : c'est le chemin de qui cherche à revenir, et un
     piège qui ne tiendrait que vers l'avant l'y laisserait sortir.
  */
  let sortiEnArriere = null;
  for (let i = 0; i < liste.length; i += 1) {
    await page.keyboard.press('Shift+Tab');
    const p = await place(panneau);
    if (!p.dedans) {
      sortiEnArriere = `à la ${i + 1}ᵉ tabulation arrière → ${p.quoi}`;
      break;
    }
  }
  verifier('Maj+Tab non plus ne sort du panneau', sortiEnArriere, null);

  /* 4. Échap ferme, ET REND LE FOCUS au déclencheur. */
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const ferme = await page.evaluate((s) => {
    const p = document.querySelector(s);
    if (!p) return true;
    return p.hasAttribute('hidden') || getComputedStyle(p).display === 'none';
  }, panneau);
  vrai('Échap ferme', ferme);
  /*
     Le déclencheur attendu se nomme à partir de son propre identifiant, et
     non d'une acrobatie sur le sélecteur : ma première écriture comparait
     `rendu.quoi` à une expression qui, dans un cas, valait `rendu.quoi`
     lui-même — elle n'aurait donc jamais pu échouer.
  */
  const attenduApresEchap = `button#${declencheur.slice(1)}`;
  const rendu = await place(panneau);
  verifier('et le focus revient au déclencheur', rendu.quoi, attenduApresEchap);
}

/* ── Le menu du cadenas : fermé par Échap, et JAMAIS piégé ─────────────── */

console.log('\n── le menu du cadenas (un MENU, pas un dialogue)');

{
  /*
     Le cadenas ne paraît qu'avec le coffre ouvert, et le coffre n'est pas la
     session : la déverrouiller ne l'ouvre pas. On passe donc par un écran qui
     porte le formulaire, et « finances » le porte sans activation préalable.
  */
  await page.goto(`${RACINE}/odyssee/finances/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(1200);
  }
  const ouvert = await ouvrirLeCoffre(page, MDP).catch(() => false);
  vrai('prémisse : le coffre s’ouvre par l’écran', ouvert);

  const cadenas = page.locator('#cadenas-coffre-bouton');
  const visible = ouvert && (await cadenas.isVisible().catch(() => false));
  vrai('prémisse : et le cadenas paraît alors dans l’en-tête', visible);

  if (visible) {
    await cadenas.click();
    await page.waitForTimeout(400);
    verifier(
      'le menu s’annonce comme un menu, et non comme un dialogue',
      await page.getAttribute('#cadenas-coffre-menu', 'role'),
      'menu',
    );

    /*
       LA GARANTIE NÉGATIVE : la tabulation DOIT pouvoir sortir. On tabule
       au-delà du nombre d'entrées du menu ; si l'on tourne en rond, c'est
       qu'on a piégé un menu.
    */
    const entrees = await page.locator('#cadenas-coffre-menu [role="menuitem"]:visible').count();
    let sorti = false;
    for (let i = 0; i < entrees + 3 && !sorti; i += 1) {
      await page.keyboard.press('Tab');
      sorti = !(await page.evaluate(() => {
        const m = document.getElementById('cadenas-coffre-menu');
        return Boolean(m && document.activeElement && m.contains(document.activeElement));
      }));
    }
    vrai(`la tabulation peut SORTIR du menu (${entrees} entrées)`, sorti);

    /* Et Échap le referme en rendant le focus, comme un menu le doit. */
    if (await page.locator('#cadenas-coffre-menu').isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      /* La tabulation l'a déjà refermé : on le réouvre pour éprouver Échap. */
      await cadenas.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    vrai(
      'Échap referme le menu',
      await page.evaluate(() => {
        const m = document.getElementById('cadenas-coffre-menu');
        return !m || m.classList.contains('hidden');
      }),
    );
    verifier(
      'et rend le focus au cadenas',
      await page.evaluate(() => document.activeElement?.id ?? ''),
      'cadenas-coffre-bouton',
    );
  }
}

verifier('aucune erreur de page', erreurs.slice(0, 3), []);

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('Les deux dialogues retiennent le focus dans les deux sens, et le rendent.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
