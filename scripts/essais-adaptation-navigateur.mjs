/**
 * L'adaptation, par l'interface réelle.
 *
 * Ce que cet essai couvre, et qu'aucun essai pur ne peut couvrir :
 *
 * - que la proposition s'affiche **sous** les cartes du menu et ne bloque rien ;
 * - que les trois réponses — d'accord, plus tard, non — soient journalisées, et
 *   que la proposition disparaisse ensuite ;
 * - qu'après une réponse, **plus rien n'est proposé de la semaine**, et que
 *   « Mon profil » dise que l'écart est connu et qu'il attend ;
 * - qu'une acceptation écrive le champ **« observé, puis confirmé »** et jamais
 *   « déclaré » ;
 * - que « Réinitialiser l'adaptation » retrouve la valeur **déclarée** — celle
 *   que la personne avait donnée — et non une valeur par défaut.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

/**
 * Un appareil prêt : base vierge, session ouverte, usage semé, profil posé.
 *
 * Six heures par semaine sur quatre semaines pleines, et deux heures déclarées :
 * l'écart est de deux à six heures, ce qui franchit les deux seuils de la règle
 * — beaucoup en proportion, et beaucoup en heures.
 */
async function appareilEnEcart(nom) {
  const contexte = await nav.newContext();
  const page = await contexte.newPage();
  page.on('pageerror', (e) => console.log(`PAGEERROR[${nom}]:`, e.message.slice(0, 250)));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`CONSOLE[${nom}]:`, m.text().slice(0, 250));
  });
  page.on('dialog', (d) => void d.accept());

  await page.goto(`${RACINE}/robots.txt`);
  await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.deleteDatabase('revinsp');
        r.onsuccess = r.onerror = r.onblocked = () => ok();
      }),
  );

  /* La base n'existe qu'une fois la session ouverte : on ouvre avant de semer. */
  await page.goto(`${RACINE}/initialisation/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#terminer, #aller-menu', { timeout: 40000 });

  const semees = await page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    /* Le lundi de cette semaine, en temps universel : l'ancre des quatre semaines. */
    const aujourdhui = new Date();
    const lundi = new Date(
      Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate()) -
        ((aujourdhui.getUTCDay() + 6) % 7) * 86_400_000,
    );
    const seances = [];
    for (let semaine = 1; semaine <= 4; semaine += 1) {
      for (let jour = 0; jour < 6; jour += 1) {
        const date = new Date(lundi.getTime() + (jour - semaine * 7) * 86_400_000);
        const iso = date.toISOString().slice(0, 10);
        seances.push({
          id: `01ADAPTESSAI${semaine}${jour}000000000000`,
          jour: iso,
          statut: 'terminee',
          theme: 'droit-public',
          secondes: 3600,
          termineeLe: `${iso}T09:30:00.000Z`,
          fiches: [],
          etendue: false,
        });
      }
    }
    await new Promise((ok, ko) => {
      const tx = base.transaction('seances', 'readwrite');
      for (const seance of seances) tx.objectStore('seances').put(seance);
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
    return seances.length;
  });

  /* On sort de l'initialisation du socle sans rien répondre. */
  if (await page.locator('#commencer').isVisible().catch(() => false)) {
    await page.click('#commencer');
  }
  if (await page.locator('#terminer').isVisible().catch(() => false)) {
    await page.click('#terminer');
  }
  await page.waitForSelector('#aller-menu', { timeout: 20000 });

  /* Le module de Révisions : on déclare deux heures par semaine. */
  await page.goto(`${RACINE}/initialisation/?branche=revisions`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#question', { timeout: 40000 });
  let garde = 0;
  while (garde < 10) {
    const texte = (await page.locator('#question').textContent()) ?? '';
    if (texte.includes('Combien d’heures de révision')) break;
    await page.click('#plus-tard');
    await page.waitForFunction(
      (avant) => document.getElementById('question')?.textContent !== avant,
      texte,
      { timeout: 15000 },
    );
    garde += 1;
  }
  await page.locator('#saisie input[type="range"]').fill('2');
  await page.click('#valider');
  await page.waitForTimeout(300);
  await page.click('#terminer');
  await page.waitForSelector('#aller-menu', { timeout: 20000 });

  return { page, contexte, semees };
}

const allerAuMenu = async (page) => {
  await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-branche="revisions"]', { timeout: 40000 });
};

/* ════════════════════════════════════════════════════════════════════════
   1. La proposition s'affiche, et elle ne bloque rien
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA PROPOSITION S’AFFICHE AU MENU, SANS RIEN BLOQUER');

const A = await appareilEnEcart('reporte');
v('vingt-quatre séances sont semées', A.semees, 24);

await allerAuMenu(A.page);
vrai(
  'les cartes de branches sont là avant la proposition',
  await A.page.locator('[data-branche="revisions"]').isVisible(),
);
await A.page.waitForSelector('#proposition:not(.hidden)', { timeout: 40000 });
{
  const constat = (await A.page.locator('#proposition-constat').textContent()) ?? '';
  const question = (await A.page.locator('#proposition-question').textContent()) ?? '';
  vrai('le constat dit ce qui a été déclaré', constat.includes('2 h'));
  vrai('et ce qui a été observé', constat.includes('6 h'));
  vrai('la question propose la valeur observée', question.includes('6 h'));
  vrai('et c’est une question', question.endsWith('?'));
  v('trois réponses sont offertes', await A.page.locator('#proposition button').count(), 3);
}

/* ════════════════════════════════════════════════════════════════════════
   2. « Plus tard », et le silence de la semaine
   ════════════════════════════════════════════════════════════════════════ */
console.log('\n« PLUS TARD » SUSPEND LA SEMAINE, ET « MON PROFIL » LE DIT');

await A.page.click('#proposition-plus-tard');
await A.page.waitForSelector('#proposition-reponse:not(.hidden)', { timeout: 15000 });
v(
  'la réponse dit quand on en reparlera',
  (await A.page.locator('#proposition-reponse').textContent())?.includes('deux semaines'),
  true,
);
faux('et les boutons ont disparu', await A.page.locator('#proposition-oui').isVisible());

await allerAuMenu(A.page);
await A.page.waitForTimeout(2500);
faux(
  'après rechargement, plus rien n’est proposé',
  await A.page.locator('#proposition').isVisible(),
);

await A.page.goto(`${RACINE}/profil/`, { waitUntil: 'networkidle' });
await A.page.waitForFunction(
  () => !document.getElementById('adaptation-etat')?.textContent?.includes('Chargement'),
  { timeout: 40000 },
);
{
  const etat = (await A.page.locator('#adaptation-etat').textContent()) ?? '';
  vrai('« Mon profil » dit que l’écart est connu', etat.includes('écart est connu'));
  vrai('qu’il a été **reporté**, et non refusé', etat.includes('reporté') && !etat.includes('refus'));
  vrai('et dans combien de jours on en reparlera', /\d+ jour/.test(etat));
  const ecarts = await A.page.$$eval('#ecarts > div', (els) => els.map((e) => e.textContent));
  vrai('l’écart est montré, même s’il n’est pas proposé aujourd’hui', ecarts.length >= 1);
  const decisions = (
    await A.page.$$eval('#decisions > p', (els) => els.map((e) => e.textContent))
  ).join(' | ');
  vrai('et la décision prise est rappelée', decisions.includes('reportée'));
}
{
  const reglages = await A.page.$$eval('#reglages > div', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  v('huit réglages déduits sont affichés', reglages.length, 8);
  const texte = reglages.join(' | ');
  vrai(
    'l’objectif hebdomadaire se dit déduit de la réponse donnée',
    /Objectif indicatif[^|]*déduit de vos réponses/.test(texte),
  );
  vrai(
    'et la bascule du jour se dit par défaut, faute d’heure de lever',
    /change de date[^|]*réglage par défaut/.test(texte),
  );
  vrai(
    'chaque réglage porte sa cause',
    reglages.every((r) => r.length > 40),
  );
}
await A.contexte.close();

/* ════════════════════════════════════════════════════════════════════════
   3. Accepter, puis tout défaire
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nACCEPTER ÉCRIT « OBSERVÉ, PUIS CONFIRMÉ » — ET SE DÉFAIT');

const B = await appareilEnEcart('accepte');
await allerAuMenu(B.page);
await B.page.waitForSelector('#proposition:not(.hidden)', { timeout: 40000 });
await B.page.click('#proposition-oui');
await B.page.waitForSelector('#proposition-reponse:not(.hidden)', { timeout: 15000 });
vrai(
  'la réponse dit qu’on peut tout remettre comme avant',
  (await B.page.locator('#proposition-reponse').textContent())?.includes('remettre comme avant'),
);

const lireChamp = async (page) => {
  await page.goto(`${RACINE}/profil/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#champs > div', { timeout: 40000 });
  const champs = await page.$$eval('#champs > div', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  return champs.find((c) => c.startsWith('Heures de révision')) ?? '';
};

{
  const champ = await lireChamp(B.page);
  vrai('le champ porte désormais la valeur observée', champ.includes('6'));
  vrai('et la source dit qu’elle vient d’une observation', champ.includes('observé, puis confirmé'));
  faux('jamais « déclaré »', / · déclaré/.test(champ));
}

await B.page.waitForFunction(
  () => !document.getElementById('adaptation-etat')?.textContent?.includes('Chargement'),
  { timeout: 40000 },
);
await B.page.click('#reinitialiser-adaptation');
await B.page.waitForSelector('#message-adaptation:not(.hidden)', { timeout: 20000 });
v(
  'la remise annonce ce qu’elle a fait',
  (await B.page.locator('#message-adaptation').textContent())?.includes('valeur déclarée'),
  true,
);
{
  const champ = await lireChamp(B.page);
  vrai('le champ est revenu à la valeur déclarée', champ.includes('2'));
  vrai('et sa source est de nouveau « déclaré »', champ.includes('déclaré'));
  faux('et non « confirmé »', champ.includes('confirmé'));
}
await B.contexte.close();

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
