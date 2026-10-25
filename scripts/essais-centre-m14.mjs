/**
 * Le centre de notifications : où il s'ouvre, et s'il sonne (M14).
 *
 * Deux défauts visés, tous deux constatés avant d'écrire une ligne.
 *
 * **N-01 — le centre s'ouvrait hors de l'écran.** Mesuré à 390 px :
 * `top = −161 px`. La cause a été trouvée en remontant les ancêtres et en
 * lisant leurs styles calculés — « #entete-principal » porte
 * `backdrop-filter: blur(8px)`, qui crée un bloc conteneur pour les
 * descendants en `position: fixed`. Le panneau n'était donc pas ancré à la
 * fenêtre mais à l'en-tête.
 *
 * **N-02 — `emettre` n'avait aucun appelant.** Le centre se remplissait en
 * silence : la seule façon d'apprendre qu'une question attendait était
 * d'ouvrir le centre, c'est-à-dire de savoir déjà qu'il y avait quelque
 * chose dedans.
 *
 * ## Ce que l'essai simule, et il faut le dire
 *
 * La permission de notifier est **accordée** au contexte d'essai, et
 * `showNotification` est remplacé par un compteur. Ce que l'essai éprouve
 * est donc que la chaîne va jusqu'à la demande d'affichage — pas qu'un
 * système d'exploitation l'affiche, ce qui ne se mesure pas ici.
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

/* ── N-01 : le panneau s'ouvre DANS l'écran, aux deux largeurs ────────── */
console.log('\nLE CENTRE S’OUVRE DANS L’ÉCRAN');

for (const [nom, options] of [
  ['ordinateur 1280×900', { viewport: { width: 1280, height: 900 } }],
  ['téléphone 390×844', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
]) {
  const ctx = await nav.newContext(options);
  const page = await ctx.newPage();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/revisions/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.click('#centre-bouton');
  await page.waitForTimeout(700);

  const vu = await page.evaluate(() => {
    const p = document.getElementById('centre-panneau');
    if (!p || p.hidden) return null;
    const r = p.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      left: Math.round(r.left),
      right: Math.round(r.right),
      hauteur: Math.round(r.height),
      vueH: window.innerHeight,
      vueL: window.innerWidth,
    };
  });
  console.log(`      ${nom} : ${JSON.stringify(vu)}`);
  verifier(`${nom} — le panneau est ouvert`, vu !== null, true);
  if (!vu) {
    await ctx.close();
    continue;
  }
  verifier(`${nom} — prémisse : il a une hauteur`, vu.hauteur > 50, true);
  verifier(`${nom} — son haut est dans l’écran`, vu.top >= 0, true);
  verifier(`${nom} — son bas aussi`, vu.bottom <= vu.vueH + 1, true);
  verifier(`${nom} — et ses côtés`, vu.left >= 0 && vu.right <= vu.vueL + 1, true);

  /* Le panneau a quitté l'en-tête : un clic DEDANS ne doit pas le refermer. */
  await page.click('#centre-titre');
  await page.waitForTimeout(400);
  verifier(
    `${nom} — un clic dans le panneau ne le referme pas`,
    await page.evaluate(() => document.getElementById('centre-panneau')?.hidden === false),
    true,
  );
  await ctx.close();
}

/* ── N-02 : un dépôt neuf demande une notification ────────────────────── */
console.log('\nUN ÉLÉMENT NEUF DEMANDE UNE NOTIFICATION');
{
  const ctx = await nav.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['notifications'],
  });
  /*
     On remplace l'affichage par un compteur, AVANT tout script de la page :
     c'est la seule façon de voir passer une demande sans dépendre d'un
     système d'exploitation.
  */
  /*
     Les sources sont TOUTES désactivées par défaut — c'est le choix du
     projet : la personne active ce qu'elle veut dans l'écran des
     notifications. On simule donc une personne qui les a activées, en
     écrivant le même réglage que cet écran. Sans cela, `emettre` refuse
     avec « source-inactive » et l'essai mesurerait le réglage par défaut,
     pas le branchement.

     Les identifiants sont ceux d'« alimentation.ts ». Deux d'entre eux —
     la veille du rythme et l'apprentissage étendu — sont admis au centre et
     INTERDITS de notification : les inscrire ici ne les délie pas, c'est
     « peutNotifier » qui tranche, et c'est très bien ainsi.
  */
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem(
        'cyclades.notifications.sources',
        JSON.stringify([
          'question-a-trancher',
          'avis-de-fusion',
          'rappel-de-sauvegarde',
          'revue-manquee',
          'occurrence-manquee',
          'proposition',
          'avertissement-avant-analyse',
          'apprentissage-etendu',
          'trajectoire',
          'veille-du-rythme',
        ]),
      );
    } catch {
      /* Sans stockage, l'essai dira que rien n'a été demandé. */
    }
    window.__notifications = [];
    const poser = (titre, options) => {
      window.__notifications.push({ titre, marque: options?.tag ?? null });
      return Promise.resolve();
    };
    if (window.ServiceWorkerRegistration) {
      ServiceWorkerRegistration.prototype.showNotification = function (titre, options) {
        return poser(titre, options);
      };
    }
  });
  const page = await ctx.newPage();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  verifier(
    'prémisse : la permission est bien accordée',
    await page.evaluate(() => Notification.permission),
    'granted',
  );

  /* Ouvrir le coffre fait écrire au centre son premier élément. */
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  await page.waitForTimeout(6000);

  const elements = await page.evaluate(
    () =>
      new Promise((res) => {
        const o = indexedDB.open('revinsp');
        o.onsuccess = () => {
          const r = o.result.transaction('centreElements', 'readonly').objectStore('centreElements').getAll();
          r.onsuccess = () => res(r.result.length);
          r.onerror = () => res(0);
        };
        o.onerror = () => res(0);
      }),
  );
  verifier('prémisse : le centre a bien reçu au moins un élément', elements > 0, true);

  const demandes = await page.evaluate(() => window.__notifications ?? []);
  console.log(`      demandes d’affichage : ${JSON.stringify(demandes)}`);
  verifier(
    'la chaîne va jusqu’à la demande d’affichage',
    demandes.length > 0,
    true,
  );
  verifier(
    'et la notification porte l’identifiant de l’élément, pour pouvoir la refermer',
    demandes.length > 0 && typeof demandes[0].marque === 'string' && demandes[0].marque.length > 0,
    true,
  );
  await ctx.close();
}

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
