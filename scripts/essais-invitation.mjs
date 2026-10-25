/**
 * L'invitation à installer : quatre situations, et elles ne se ressemblent pas.
 *
 * ## Ce que cet essai mesure vraiment, et ce qu'il simule
 *
 * - **iOS** : mesuré pour de bon. Le contexte annonce un iPhone, et c'est le
 *   code de production qui en tire ses conclusions.
 * - **Déjà installée** : mesuré pour de bon. « display-mode: standalone » est
 *   émulé par le protocole du navigateur, pas par une variable à nous.
 * - **Android** : **simulé**, et il faut le dire. « beforeinstallprompt » ne
 *   se produit pas dans un navigateur de pilotage sans affichage : on émet
 *   l'événement, avec les deux méthodes qu'il porte. Ce que l'essai éprouve
 *   est donc la façon dont la page s'en sert, pas le fait que le navigateur
 *   l'émette — ce dernier point n'est pas à moi de le vérifier.
 * - **Le refus** : mesuré pour de bon, en rechargeant.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const BASE = 'http://localhost:4321';
const MDP = motDePasseEssais();

let echecs = 0;
const verifier = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
process.on('uncaughtException', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({ executablePath: cheminDuNavigateur() });

const visible = (page, id) =>
  page.evaluate((i) => {
    const e = document.getElementById(i);
    return Boolean(e) && e.getBoundingClientRect().height > 0;
  }, id);

/** Émet l'événement d'Android, avec ses deux méthodes. */
const simulerAndroid = (page, issue) =>
  page.evaluate((resultat) => {
    const e = new Event('beforeinstallprompt');
    let demandee = false;
    Object.assign(e, {
      prompt: async () => {
        demandee = true;
        window.__invitePosee = true;
      },
      userChoice: Promise.resolve({ outcome: resultat }),
    });
    window.__invitePosee = false;
    window.dispatchEvent(e);
    return demandee;
  }, issue);

/* ── 1. iOS ─────────────────────────────────────────────────────────── */
console.log('\nSUR IOS, LE CHEMIN EST EXPLIQUÉ FAUTE DE POUVOIR ÊTRE AUTOMATISÉ');
{
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  verifier('l’invitation paraît', await visible(page, 'invitation-installation'), true);
  verifier('avec les trois gestes de Safari', await visible(page, 'invitation-ios'), true);
  verifier(
    'et sans bouton « Installer », qui ne ferait rien',
    await visible(page, 'invitation-installer'),
    false,
  );
  await ctx.close();
}

/* ── 2. Déjà installée ──────────────────────────────────────────────── */
console.log('\nUNE FOIS INSTALLÉE, ON NE PROPOSE PLUS DE L’INSTALLER');
{
  /*
     Deux épreuves vivent dans « dejaInstallee », et une seule est mesurable
     ici. « display-mode: standalone » ne s'émule pas : Chromium accepte
     l'appel du protocole et n'applique rien — mesuré, et la garde de prémisse
     l'a dit avant qu'une ligne passe au vert sans objet. Cette branche-là
     reste donc NON MESURÉE, et je l'écris plutôt que de la maquiller.

     « navigator.standalone », le signal d'iOS, se pose pour de bon par un
     script d'initialisation. C'est d'ailleurs le cas qui compte le plus :
     sur iOS, l'invitation est une notice manuelle, et rien d'autre que ce
     signal ne peut la faire taire une fois l'installation faite.
  */
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
  });
  const page = await ctx.newPage();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  verifier(
    'prémisse : l’appareil se dit déjà installé',
    await page.evaluate(() => navigator.standalone === true),
    true,
  );
  verifier('l’invitation reste cachée', await visible(page, 'invitation-installation'), false);
  await ctx.close();
}

/* ── 3. Android ─────────────────────────────────────────────────────── */
console.log('\nSUR ANDROID, L’INVITE NATIVE EST REPRISE PAR UN BOUTON À NOUS');
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  verifier(
    'sans événement, rien ne s’affiche',
    await visible(page, 'invitation-installation'),
    false,
  );

  await simulerAndroid(page, 'accepted');
  await page.waitForTimeout(500);
  verifier('l’événement fait paraître l’invitation', await visible(page, 'invitation-installation'), true);
  verifier('avec son bouton', await visible(page, 'invitation-installer'), true);
  verifier('et sans le chemin d’iOS', await visible(page, 'invitation-ios'), false);

  await page.click('#invitation-installer');
  await page.waitForTimeout(800);
  verifier(
    'le bouton déclenche bien l’invite native',
    await page.evaluate(() => window.__invitePosee === true),
    true,
  );
  verifier(
    'et l’invitation disparaît une fois acceptée',
    await visible(page, 'invitation-installation'),
    false,
  );
  await ctx.close();
}

/* ── 4. Le refus tient ──────────────────────────────────────────────── */
console.log('\n« NON MERCI » TIENT, Y COMPRIS APRÈS RECHARGEMENT');
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await simulerAndroid(page, 'dismissed');
  await page.waitForTimeout(500);
  verifier('prémisse : l’invitation est là avant qu’on la refuse', await visible(page, 'invitation-installation'), true);

  await page.click('#invitation-refuser');
  await page.waitForTimeout(400);
  verifier('elle disparaît au refus', await visible(page, 'invitation-installation'), false);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await simulerAndroid(page, 'dismissed');
  await page.waitForTimeout(600);
  verifier('et ne revient pas, même si le navigateur réémet son événement', await visible(page, 'invitation-installation'), false);
  await ctx.close();
}

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
