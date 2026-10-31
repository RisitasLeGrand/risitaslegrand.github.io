/**
 * 0.4 — l'invitation iOS commence par la sauvegarde.
 *
 *   npm run essais:invitation-ios
 *
 * ## Le défaut
 *
 * Une application posée sur l'écran d'accueil d'iOS peut recevoir son PROPRE
 * espace de stockage, séparé de celui de Safari. Elle s'ouvre alors sur une
 * base vide — pas de fiches, pas de séances, pas de journal — et la personne
 * croit avoir perdu ses données en suivant une consigne de Cyclades.
 *
 * Le chemin que l'écran donnait tenait en trois gestes, et aucun ne parlait de
 * sauvegarde. C'est la seule étape qu'on ne peut pas refaire APRÈS : une fois
 * dans l'application, si la base est vide, la sauvegarde qu'on n'a pas faite
 * n'existe plus nulle part.
 *
 * ## Ce que l'essai mesure, et pourquoi l'ORDRE est l'essentiel
 *
 * Ajouter la sauvegarde en quatrième position ne corrigerait rien. Ce point
 * n'est pas « parler de la sauvegarde », c'est « commencer par elle ». L'essai
 * vérifie donc la PREMIÈRE étape, et pas seulement la présence du mot.
 *
 * Il vérifie aussi le sens inverse : sur un navigateur qui sait installer tout
 * seul, le chemin iOS reste caché. Une consigne de sauvegarde donnée à qui
 * n'en a pas besoin apprend à ignorer les consignes.
 *
 * ## Ce qu'il ne mesure pas, et il faut le dire
 *
 * Il ne mesure pas qu'iOS sépare vraiment les stockages : il faudrait un
 * iPhone, et nous n'en avons pas. Le texte de l'écran dit « peut », et cet
 * essai garde ce « peut » — il mesure la consigne, pas le système. Ce qui
 * serait mesurable et faux, en revanche, c'est une consigne qui promettrait
 * qu'il n'y aura rien à restaurer.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

/*
   L'AGENT D'UN IPHONE, ET POURQUOI C'EST LUI QUI DÉCIDE.

   `installation.ts` choisit le chemin manuel sur `estIOS()`, qui lit l'agent.
   Un essai qui voudrait forcer le chemin autrement — en appelant la fonction,
   en posant un drapeau — mesurerait un chemin que personne n'empruntera.
*/
const AGENT_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

let rouges = 0;
const v = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
const vrai = (quoi, obtenu) => v(quoi, Boolean(obtenu), true);
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

async function ouvrirLAccueil(agent) {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    ...(agent ? { userAgent: agent } : {}),
  });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(1200);
  return { ctx, page };
}

console.log('\nSUR IPHONE, LE CHEMIN COMMENCE PAR LA SAUVEGARDE');
{
  const { ctx, page } = await ouvrirLAccueil(AGENT_IPHONE);

  /*
     LA PRÉMISSE AVANT TOUT : si l'invitation ne paraît pas, les assertions
     qui suivent porteraient sur du vide et rendraient un vert sans objet.
  */
  const invitation = page.locator('#invitation-installation');
  vrai('l’invitation paraît', await invitation.isVisible().catch(() => false));
  const chemin = page.locator('#invitation-ios');
  vrai('le chemin manuel est montré', await chemin.isVisible().catch(() => false));
  vrai(
    'et le bouton « Installer » est caché, puisque Safari ne sait pas le faire',
    (await page.locator('#invitation-installer:visible').count()) === 0,
  );

  const etapes = await chemin.locator('li').allTextContents();
  v('le chemin porte quatre étapes', etapes.length, 4);

  const premiere = (etapes[0] ?? '').replace(/\s+/g, ' ').trim();
  /*
     LA PREMIÈRE, ET PAS « QUELQUE PART » : ajouter la sauvegarde en
     quatrième position ne corrigerait rien. Le point n'est pas d'en parler,
     c'est de commencer par elle.
  */
  vrai('la première étape est la sauvegarde', /sauvegarde/i.test(premiere));
  vrai(
    'elle dit pourquoi : l’application peut s’ouvrir sur une base vide',
    /base vide/i.test(premiere),
  );
  vrai(
    'elle dit que c’est la seule étape qu’on ne peut pas refaire après',
    /ne peut pas (se )?refaire|pas refaire après/i.test(premiere),
  );

  /* Et elle MÈNE à l'écran de sauvegarde : une consigne sans chemin se perd. */
  const lien = chemin.locator('li').first().locator('a');
  /*
     LE RELEVÉ EST PRIS UNE FOIS, ET LA SUITE S'Y RÉFÈRE.

     Écrit sans cette garde, l'essai mourait sur un « getAttribute: Timeout
     30000ms exceeded » quand l'étape n'était pas la première — une panne
     illisible au lieu d'un rouge. C'est la leçon que plusieurs essais de ce
     dépôt ont déjà payée : un contrôle doit échouer lisiblement.
  */
  const aUnLien = (await lien.count()) > 0;
  vrai('elle porte un lien', aUnLien);
  const href = aUnLien ? ((await lien.first().getAttribute('href')) ?? '') : '';
  vrai(
    `le lien mène à l’écran de sauvegarde (${href || 'aucun'})`,
    /\/progression\/#sauvegarde$/.test(href),
  );

  /* Les trois gestes de Safari suivent, dans leur ordre. */
  const suite = etapes.slice(1).map((t) => t.replace(/\s+/g, ' ').trim());
  vrai('puis « Partager »', /Partager/.test(suite[0] ?? ''));
  vrai('puis « Sur l’écran d’accueil »', /écran d’accueil/i.test(suite[1] ?? ''));
  vrai('puis « Ajouter »', /Ajouter/.test(suite[2] ?? ''));

  /*
     LE TEXTE D'INTRODUCTION NE DOIT PLUS PROMETTRE TROIS GESTES SEULS.

     Il disait « le chemin tient en trois gestes ». C'était juste, et ça ne
     l'est plus : il y a une étape avant, et c'est la seule qui compte si elle
     manque. Un texte qui compte faux apprend à ne pas le lire.
  */
  const intro = ((await page.locator('#invitation-texte').textContent()) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  vrai('l’introduction annonce la sauvegarde', /sauvegarde/i.test(intro));
  vrai(
    'et elle ne dit plus que le chemin tient en trois gestes',
    !/tient en trois gestes/i.test(intro),
  );

  await ctx.close();
}

console.log('\nAILLEURS, LA CONSIGNE N’EST PAS DONNÉE POUR RIEN');
{
  /*
     Sur un navigateur qui sait installer tout seul, aucun chemin manuel : ni
     les trois gestes de Safari, ni la sauvegarde. Chromium sans tête ne
     déclenche pas l'évènement d'installation, donc l'invitation reste cachée
     — et c'est exactement ce qu'on veut vérifier : le chemin iOS ne s'affiche
     pas en dehors d'iOS.
  */
  const { ctx, page } = await ouvrirLAccueil(null);
  vrai(
    'le chemin iOS reste caché hors d’iOS',
    (await page.locator('#invitation-ios:visible').count()) === 0,
  );
  await ctx.close();
}

await nav.close();
console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${rouges} rouge${rouges > 1 ? 's' : ''}.\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
