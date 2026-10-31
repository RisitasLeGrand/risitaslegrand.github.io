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
 * **0.8 du prompt 43 — et aucune émission quand on regarde l'écran.** La
 * section N-02 porte donc deux passes : page regardée, page cachée. Sans la
 * seconde, la première ne mesurerait plus rien — un zéro y est devenu le bon
 * résultat, et c'est aussi ce que donnerait une chaîne débranchée.
 *
 * ## Ce que l'essai simule, et il faut le dire
 *
 * La permission de notifier est **accordée** au contexte d'essai, et les deux
 * voies d'affichage — `showNotification` du service worker et le constructeur
 * `Notification` de la page — sont remplacées par un compteur. Ce que l'essai
 * éprouve est donc que la chaîne va jusqu'à la demande d'affichage — pas
 * qu'un système d'exploitation l'affiche, ce qui ne se mesure pas ici.
 *
 * La page cachée est simulée elle aussi, et par nécessité : sondé avant
 * d'écrire, ce navigateur sans écran répond toujours « visible » et
 * « focalisée », qu'un second onglet soit devant, qu'on appelle
 * `bringToFront()` ailleurs, ou qu'on coupe l'émulation de focus par le
 * protocole. La propriété est donc écrasée, et ce qui est éprouvé est que le
 * code la consulte.
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

/* ── N-02 et 0.8 : la notification, et la page qu'on regarde ──────────── */
console.log('\nUN ÉLÉMENT NEUF DEMANDE UNE NOTIFICATION — SAUF SI ON REGARDE L’ÉCRAN');
/*
   DEUX PASSES, ET CE QUI LES SÉPARE EST MESURÉ, PAS SUPPOSÉ.

   N-02 reste l'objet de cette section : le dépôt d'un élément neuf va
   jusqu'à la demande d'affichage, parce que `emettre` n'avait longtemps
   aucun appelant. Le lot 0.8 lui ajoute une condition — « aucune émission
   du système quand la page est visible » — et la première passe ne
   mesurerait donc plus rien sans la seconde : un zéro y est désormais le
   bon résultat, et un zéro est aussi ce que donnerait une chaîne débranchée.

   **La page cachée est SIMULÉE, et il faut le dire.** Sondé avant d'écrire :
   dans ce navigateur sans écran, piloté par Playwright, une page répond
   toujours `visibilityState = "visible"` et `hasFocus() = true`, qu'un
   second onglet soit ouvert devant elle, qu'on appelle `bringToFront()` sur
   l'autre, ou qu'on coupe l'émulation de focus par le protocole. Il n'y a
   pas de levier réel ; la propriété est donc écrasée, et ce qui est éprouvé
   est que le code la CONSULTE et en tient compte — pas que le navigateur la
   calcule juste.

   La première passe, elle, ne simule rien : « visible » est l'état réel de
   cette page.
*/
for (const [nom, cacherLaPage] of [
  ['page regardée', false],
  ['page cachée', true],
]) {
  const ctx = await nav.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['notifications'],
  });
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

     Et l'affichage est remplacé par un compteur, AVANT tout script de la
     page : c'est la seule façon de voir passer une demande sans dépendre
     d'un système d'exploitation. **Les DEUX voies sont comptées** — celle du
     service worker et le constructeur `Notification` de la page. N'en
     compter qu'une laisserait la passe « page regardée » verte alors qu'une
     notification serait partie par l'autre, c'est-à-dire exactement le
     défaut que cette passe doit attraper.
  */
  await ctx.addInitScript((cacher) => {
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
    const poser = (voie, titre, options) => {
      window.__notifications.push({ voie, titre, marque: options?.tag ?? null });
      return Promise.resolve();
    };
    if (window.ServiceWorkerRegistration) {
      ServiceWorkerRegistration.prototype.showNotification = function (titre, options) {
        return poser('service-worker', titre, options);
      };
    }
    const Vraie = window.Notification;
    try {
      window.Notification = function (titre, options) {
        poser('page', titre, options);
      };
      window.Notification.permission = Vraie.permission;
      window.Notification.requestPermission = Vraie.requestPermission?.bind(Vraie);
    } catch {
      /* Le constructeur reste celui du navigateur : la passe le dira. */
    }
    if (cacher) {
      Object.defineProperty(Document.prototype, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => true });
    }
  }, cacherLaPage);
  const page = await ctx.newPage();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  verifier(
    `${nom} — prémisse : la permission est bien accordée`,
    await page.evaluate(() => Notification.permission),
    'granted',
  );
  verifier(
    `${nom} — prémisse : la page est bien dans l’état voulu`,
    await page.evaluate(() => document.visibilityState),
    cacherLaPage ? 'hidden' : 'visible',
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
  /*
     LA PRÉMISSE QUI PORTE LES DEUX PASSES : le centre reçoit, dans les deux
     cas. C'est ce qui distingue « on n'interrompt pas » de « on perd le
     signal » — le lot 0.8 ne retient que l'interruption, jamais l'élément.
  */
  verifier(`${nom} — prémisse : le centre a bien reçu au moins un élément`, elements > 0, true);

  const demandes = await page.evaluate(() => window.__notifications ?? []);
  console.log(`      demandes d’affichage : ${JSON.stringify(demandes)}`);
  if (cacherLaPage) {
    verifier(
      `${nom} — la chaîne va jusqu’à la demande d’affichage`,
      demandes.length > 0,
      true,
    );
    verifier(
      `${nom} — et la notification porte l’identifiant de l’élément, pour pouvoir la refermer`,
      demandes.length > 0 && typeof demandes[0].marque === 'string' && demandes[0].marque.length > 0,
      true,
    );
  } else {
    verifier(`${nom} — rien n’est parti au système`, demandes, []);
  }
  await ctx.close();
}

/* ── 0.8 : et la règle est DITE, là où on règle les notifications ──────── */
console.log('\nL’ÉCRAN DES NOTIFICATIONS DIT LA RÈGLE');
{
  /*
     Une règle qui retient une notification sans être écrite passe pour une
     panne : on active « Synchronisation », on reste sur le site, rien ne
     sonne, et on conclut que le réglage ne marche pas. Le § 3.4 demande un
     écran « qui dit la vérité » ; depuis 0.8, la vérité a une clause de
     plus, et c'est ici qu'on vérifie qu'elle y est.
  */
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/notifications/`, { waitUntil: 'networkidle' });
  const avertissement = await page
    .locator('section', { hasText: 'Ce que ces notifications peuvent' })
    .innerText();
  verifier(
    'elle est dite avant les interrupteurs : on n’est pas interrompu pendant qu’on regarde',
    /ne vous interrompent pas pendant que vous regardez/.test(avertissement),
    true,
  );
  verifier(
    'et elle dit par quoi ça s’annonce alors, au lieu de laisser croire à une panne',
    /cloche/.test(avertissement),
    true,
  );
  await ctx.close();
}

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
