/**
 * Le centre de notifications en panne de lecture le DIT — prompt 43, F8.
 *
 *   npm run essais:centre-panne
 *
 * ## Le défaut
 *
 * `CentreNotifications.astro` rattrapait l'échec de lecture en rendant une
 * liste vide. La suite du rendu faisait alors ce qu'elle fait d'une liste
 * vide : elle affichait « Rien à signaler ». Au moment précis où le site
 * venait de perdre le moyen de savoir ce qui attend, il affirmait qu'il n'y
 * avait rien — et une question à trancher pouvait rester là sans que
 * personne l'apprenne.
 *
 * ## Comment la panne est produite
 *
 * Par le chemin réel, et non par un drapeau d'essai : `getAll` est remplacé
 * dans la page, et **seulement pour le magasin du centre**. Une panne
 * globale aurait cassé tout ce que la page lit par ailleurs, et l'essai
 * aurait alors mesuré une page morte plutôt qu'un panneau honnête.
 *
 * Le refus est synchrone, pour la raison qu'`essais:echecs-dits` a déjà
 * payée : `idb` écoute par `addEventListener`, et une fausse requête dont
 * `onerror` part au tour suivant ne remonte pas jusqu'à l'appelant.
 *
 * ## Ce que l'essai constate à l'écran, et non dans le code
 *
 * Il part d'une route, ouvre le coffre, ouvre le panneau, et lit ce qui est
 * écrit dedans. Le seul endroit où il touche au code est le sabotage.
 *
 * Playwright n'est pas une dépendance du projet : lancez « astro preview »
 * avant ce script.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(
      `      obtenu  ${String(JSON.stringify(obtenu)).slice(0, 220)}\n      attendu ${String(JSON.stringify(attendu)).slice(0, 220)}`,
    );
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

/**
 * Casse la lecture du magasin du centre, dans la page, à partir de
 * maintenant. Rendu en CHAÎNE et non en fonction : `page.evaluate` d'une
 * fonction nommée fait ajouter à l'outillage une aide `__name` qui n'existe
 * pas dans la page.
 */
const SABOTER = `
  (() => {
    if (window.__getAllSain) return;
    window.__getAllSain = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...args) {
      if (this.name === 'centreElements') {
        throw new DOMException('Lecture refusée.', 'UnknownError');
      }
      return window.__getAllSain.apply(this, args);
    };
  })()
`;

const REPARER = `
  (() => {
    if (!window.__getAllSain) return;
    IDBObjectStore.prototype.getAll = window.__getAllSain;
    delete window.__getAllSain;
  })()
`;

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});
/*
   AU DOIGT, et pas seulement à 390 px de large.

   Le plancher de 44 px ne s'applique que sous « pointer: coarse » : c'est
   `hasTouch` qui le déclenche, et non la largeur. Sans lui, le contrôle de
   hauteur rougissait sur un bouton parfaitement conforme au doigt — l'essai
   avait tort, pas le bouton.
*/
const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log(`PAGEERROR: ${e.message.slice(0, 200)}`));

const deverrouiller = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
};

const aller = async (chemin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
};

/** Ouvre le panneau, en le refermant d'abord s'il est déjà ouvert. */
const ouvrirLePanneau = async () => {
  if (!(await page.locator('#centre-panneau').isHidden().catch(() => true))) {
    await page.click('#centre-fermer').catch(() => {});
  }
  await page.click('#centre-bouton');
  await page.waitForSelector('#centre-panneau:not([hidden])', { timeout: 20000 });
  /*
     ET LA LISTE PEINTE, PAS SEULEMENT LE PANNEAU OUVERT.

     `basculer()` démasque le panneau PUIS lit la base et déchiffre : entre les
     deux, le panneau est ouvert sur une liste vide. Les quatre cents
     millisecondes qui tenaient ici étaient un pari sur la vitesse de la
     machine, et le pari se perd sous charge — c'est le défaut qui a fait
     rougir `essais:centre:navigateur` au 257e essai d'une batterie, et c'est
     le même ici.

     `aria-busy` est la post-condition : posé par le gestionnaire avant son
     premier `await`, donc dans le même tour que le clic, et retiré en dernier
     dans un `finally`. Son absence dit « la peinture est finie », y compris
     quand elle a échoué — ce qui est exactement la question à poser avant de
     lire, dans un essai qui mesure justement des pannes.

     `state: 'attached'` : on attend un attribut, pas une apparition. Une
     liste légitimement vide n'a pas de hauteur, donc n'est jamais « visible »,
     et c'est le cas de plusieurs mesures de ce fichier.

     Vérifié par A sur son correctif voisin, avec un retard de 500 ms injecté
     dans `faireLeMenage()` : sans cette attente, deux contrôles de ce fichier
     tombent.
  */
  await page.waitForSelector('#centre-liste:not([aria-busy="true"])', {
    state: 'attached',
    timeout: 20000,
  });
};

const visible = (selecteur) => page.locator(selecteur).isVisible().catch(() => false);

try {
  await aller('/');
  await franchirInitialisation(page, RACINE, MDP);

  /* Le coffre du site n'est pas le mot de passe du site : le centre ne lit
     rien tant que le second n'est pas ouvert. */
  await aller('/odyssee/corps/');
  const champ = await page.locator('#mdp-coffre').isVisible().catch(() => false);
  vrai('le formulaire du coffre est offert', champ);
  if (champ) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
    await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 });
  }

  console.log('\nLECTURE SAINE — le panneau dit ce qu’il sait');
  await ouvrirLePanneau();
  vrai('le bloc d’erreur est absent de l’écran', !(await visible('#centre-erreur')));
  vrai(
    '« Rien à signaler » ou une liste : le panneau rend quelque chose',
    (await visible('#centre-vide')) || (await page.locator('#centre-liste section').count()) > 0,
  );

  console.log('\nLECTURE EN PANNE — l’écran le dit, et n’affirme rien d’autre');
  await page.evaluate(SABOTER);
  await ouvrirLePanneau();

  vrai('le bloc d’erreur est à l’écran', await visible('#centre-erreur'));
  faux(
    '« Rien à signaler » n’est PAS affiché : le site ne sait pas qu’il n’y a rien',
    await visible('#centre-vide'),
  );
  const texte = (await page.locator('#centre-erreur').innerText().catch(() => '')).toLowerCase();
  vrai('le texte dit que la lecture a échoué', texte.includes('lecture a échoué'));
  v(
    'la phrase est annoncée comme une alerte',
    await page.locator('#centre-erreur [role="alert"]').count(),
    1,
  );
  v('aucune ligne n’est rendue', await page.locator('#centre-liste section').count(), 0);
  faux(
    'le résumé du jour ne se propose pas sur une lecture en panne',
    await visible('#centre-resume'),
  );

  /* « catch » et non attente : si le bouton n'existe pas, l'essai doit rendre
     un rouge lisible, et non une panne d'outillage trente secondes plus tard. */
  const boite = await page
    .locator('#centre-reessayer')
    .boundingBox({ timeout: 2000 })
    .catch(() => null);
  vrai('« Réessayer » est offert', Boolean(boite));
  v(
    '« Réessayer » tient le plancher de 44 px',
    boite ? Math.round(boite.height) >= 44 : null,
    true,
  );

  console.log('\nLA PANNE PASSE — « Réessayer » ramène le panneau à la normale');
  await page.evaluate(REPARER);
  await page.click('#centre-reessayer');
  await page.waitForTimeout(500);
  faux('le bloc d’erreur a disparu', await visible('#centre-erreur'));
  vrai(
    'le panneau rend de nouveau quelque chose',
    (await visible('#centre-vide')) || (await page.locator('#centre-liste section').count()) > 0,
  );

  console.log('\nCOFFRE FERMÉ — rien ne change de ce côté');
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* rien */
    }
  });
  await aller('/revisions/');
  await ouvrirLePanneau();
  faux('coffre fermé : aucun bloc d’erreur', await visible('#centre-erreur'));
  faux('coffre fermé : aucun « Rien à signaler »', await visible('#centre-vide'));
  vrai('coffre fermé : la mention du coffre, et elle seule', await visible('#centre-coffre-ferme'));
} finally {
  await contexte.close();
  await nav.close();
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les contrôles sont verts.\x1b[0m\n'
    : `\n\x1b[31m${echecs} contrôle${echecs > 1 ? 's' : ''} rouge${echecs > 1 ? 's' : ''}.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
