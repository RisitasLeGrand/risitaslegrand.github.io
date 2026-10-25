/**
 * Une écriture qui échoue le dit — A1 et A2 du prompt 43.
 *
 *   npm run essais:echecs-dits
 *
 * L'essai part d'une route et constate l'écran, comme le veut la règle du 39.
 * Il n'inspecte pas `src/lib/agir.ts` : il **casse la base** sous les pieds de
 * la page, demande une suppression, et regarde si l'écran le dit.
 *
 * ## Comment on fait échouer une écriture sans en inventer une fausse
 *
 * `indexedDB.deleteDatabase` ne suffit pas : la connexion ouverte garde la
 * base vivante. On remplace donc, dans la page, `IDBObjectStore.prototype.put`
 * et `delete` par des méthodes qui rejettent — l'une avec une
 * `DOMException('…', 'QuotaExceededError')`, pour A2, l'autre avec une erreur
 * ordinaire, pour A1. C'est la panne telle que le navigateur la rend : une
 * requête dont `onerror` part, et non une promesse rejetée pour la forme.
 *
 * ## Ce que l'essai ne mesure pas
 *
 * Il ne dit pas que **tous** les écrans sont protégés : il en mesure deux, ceux
 * que le prompt nomme, plus le filet global. Le relevé des écritures qui
 * restent nues est dans `audit/43-confrontation.md`, et il se réduira lot par
 * lot.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/**
 * Fait échouer toute écriture IndexedDB de la page, à partir de maintenant.
 *
 * Le code part en **chaîne** et non en fonction : `tsx` compile les fonctions
 * nommées passées à `page.evaluate` en ajoutant son aide `__name`, qui
 * n'existe pas dans la page — la première version de cet essai échouait là,
 * sur un « __name is not defined » qui n'avait rien à voir avec le site.
 *
 * Le refus est **synchrone**. J'ai d'abord rendu une fausse requête dont
 * `onerror` partait au tour suivant, pour imiter la panne telle que le
 * navigateur la rend ; mesuré : la page ne la voyait pas, parce que la
 * bibliothèque `idb` écoute par `addEventListener` et non par `onerror`.
 * Un refus synchrone, lui, remonte par où remonte une base pleine quand le
 * navigateur refuse l'écriture d'emblée, et c'est ce que l'essai veut voir :
 * l'échec traverse-t-il jusqu'à l'écran.
 */
const saboterLesEcritures = (nomDErreur: string | null, message?: string) => `
  (() => {
    const refuser = function () {
      throw ${
        nomDErreur === null
          ? "new Error('Cette écriture a été refusée.')"
          : `new DOMException('${message ?? 'Quota dépassé.'}', '${nomDErreur}')`
      };
    };
    IDBObjectStore.prototype.put = refuser;
    IDBObjectStore.prototype.delete = refuser;
    IDBObjectStore.prototype.add = refuser;
    'posé'
  })();
`;

const ouvrir = async () => {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  return { ctx, page };
};

/* ── 1. La région commune existe, et elle ne paraît pas pour rien ─────────── */

console.log('\nAU REPOS, RIEN NE S’AFFICHE');
{
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  verifier(
    'aucune région d’échec sur un écran qui va bien',
    await page.locator('#echec-de-page:visible').count(),
    0,
  );
  await ctx.close();
}

/* ── 2. Une suppression qui échoue le dit (A1) ────────────────────────────── */

console.log('\nUNE SUPPRESSION QUI ÉCHOUE LE DIT');
{
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  /* Une pesée, pour avoir quelque chose à supprimer. */
  await page.locator('#kg').fill('70');
  await page.locator('#peser').click();
  await page.waitForTimeout(900);
  const lignes = await page.locator('button:has-text("Supprimer")').count();
  verifier('il y a au moins une ligne à supprimer', lignes > 0, true);
  if (lignes === 0) {
    await ctx.close();
    await nav.close();
    console.log('\x1b[31m✗\x1b[0m rien à supprimer : la suite porterait sur du vide');
    process.exit(1);
  }

  await page.evaluate(saboterLesEcritures(null));
  await page.locator('button:has-text("Supprimer")').first().click();
  await page.waitForTimeout(1200);

  /*
     On interroge **la région annoncée, où qu'elle soit** : cet écran a déjà sa
     place pour les messages, sous les formulaires, et la porte commune l'y
     écrit plutôt que de poser une seconde boîte flottante ailleurs. Deux
     endroits pour la même sorte de message sur un même écran, c'est le défaut
     que la section C du 43 combat.
  */
  const region = page.locator('[role="alert"]:visible').first();
  /*
     `parue` est relevé une fois, et les assertions suivantes s'y réfèrent :
     sans cela, une région absente faisait attendre trente secondes à
     `getAttribute` et l'essai finissait en panne illisible au lieu d'un rouge.
     C'est la même leçon que l'essai du commutateur a donnée : un contrôle doit
     échouer lisiblement.
  */
  const parue = (await page.locator('[role="alert"]:visible').count()) > 0;
  verifier('la région d’échec paraît', parue, true);
  verifier(
    'elle porte role="alert"',
    parue ? await region.getAttribute('role') : null,
    'alert',
  );
  verifier(
    'elle dit quelque chose, en texte',
    parue ? ((await region.textContent()) ?? '').replace('Masquer', '').trim().length > 10 : false,
    true,
  );
  verifier(
    'la ligne est toujours là — on n’a pas fait croire à une suppression',
    (await page.locator('button:has-text("Supprimer")').count()) >= lignes,
    true,
  );

  /* Le message reste : ce n'est pas une bulle (C4). */
  if (parue) {
    await page.waitForTimeout(3200);
    verifier('et il est encore là trois secondes plus tard', await region.isVisible(), true);

  } else {
    verifier('et il est encore là trois secondes plus tard', 'pas de région', true);
  }
  await ctx.close();
}

/* ── 3. L'espace plein dit quoi faire (A2) ────────────────────────────────── */

console.log('\nL’ESPACE PLEIN DIT QUOI FAIRE');
{
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(saboterLesEcritures('QuotaExceededError'));
  await page.locator('#kg').fill('71');
  await page.locator('#peser').click();
  await page.waitForTimeout(1500);

  const visible = page.locator('#echec-de-page:visible, [role="alert"]:visible').first();
  const dit = ((await visible.count()) ? ((await visible.textContent()) ?? '') : '').replace(
    /\s+/g,
    ' ',
  );
  verifier('l’écran parle d’espace plein', /espace .* plein/i.test(dit), true);
  verifier('il dit où libérer de la place', /Stockage/.test(dit), true);
  verifier('et il dit que rien n’a été enregistré', /rien n’a été enregistré/.test(dit), true);
  await ctx.close();
}

/* ── 4. Le filet attrape ce qu'on n'a pas prévu ───────────────────────────── */

console.log('\nLE FILET');
{
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    void Promise.reject(new Error('Une panne que personne n’attrape.'));
  });
  await page.waitForTimeout(800);
  const region = page.locator('#echec-de-page');
  const vue = await region.isVisible();
  verifier('une promesse rejetée sans garde est dite', vue, true);
  verifier(
    'avec son message',
    vue ? ((await region.textContent()) ?? '').includes('Une panne que personne n’attrape.') : false,
    true,
  );
  verifier('la région commune porte role="alert"', vue ? await region.getAttribute('role') : null, 'alert');
  if (vue) {
    /* Elle reste : ce n'est pas une bulle (C4). */
    await page.waitForTimeout(3200);
    verifier('elle est encore là trois secondes plus tard', await region.isVisible(), true);
    const masquer = region.locator('button:has-text("Masquer")');
    verifier(
      'la cible de « Masquer » fait au moins 44 px',
      await masquer.evaluate((b) => {
        const r = b.getBoundingClientRect();
        return Math.min(r.width, r.height) >= 44;
      }),
      true,
    );
    await masquer.click();
    verifier('et elle se masque', await region.isVisible(), false);
  } else {
    verifier('elle est encore là trois secondes plus tard', 'pas de région', true);
    verifier('la cible de « Masquer » fait au moins 44 px', 'pas de région', true);
    verifier('et elle se masque', 'pas de région', false);
  }
  await ctx.close();
}

/* ── 5. Psyché passe par la même porte (43, lot 2) ───────────────────────── */

/*
   POURQUOI CET ÉCRAN EN PARTICULIER. Il disait déjà ses échecs — et c'est
   pour cela qu'il valait d'être repris : il les disait à sa façon.
   `zone.textContent = String(e)` affichait le message brut d'une exception,
   « QuotaExceededError », et sans rôle sur la zone, aucun lecteur d'écran ne
   l'annonçait. Un écran qui parle mal n'est pas plus honnête qu'un écran
   muet, il est seulement plus difficile à soupçonner.

   Psyché est sous coffre : l'essai l'ouvre comme une personne le ferait.
*/
console.log('\nPSYCHÉ, PAR LA MÊME PORTE');
{
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
    await page.waitForTimeout(2500);
  }
  const ouvert = await page.locator('#coffre-ouvert').isVisible().catch(() => false);
  verifier('le coffre de Psyché s’ouvre', ouvert, true);

  if (ouvert) {
    await page.evaluate(saboterLesEcritures('QuotaExceededError'));
    await page.locator('#entree').fill('Une entrée d’essai, qui ne doit pas être perdue en silence.');
    await page.locator('#ecrire').click();
    await page.waitForTimeout(1500);

    const visible = page.locator('#echec-de-page:visible, [role="alert"]:visible').first();
    const parue = (await visible.count()) > 0;
    verifier('l’échec est dit', parue, true);
    const dit = (parue ? ((await visible.textContent()) ?? '') : '').replace(/\s+/g, ' ');
    verifier('en français, et non par le nom de l’exception', /QuotaExceededError/.test(dit), false);
    verifier('l’écran parle d’espace plein', /espace .* plein/i.test(dit), true);
    verifier('il dit où libérer de la place', /Stockage/.test(dit), true);
    verifier('et que rien n’a été enregistré', /rien n’a été enregistré/.test(dit), true);
    verifier(
      'la zone porte role="alert", donc elle s’annonce',
      parue ? await visible.getAttribute('role') : null,
      'alert',
    );
  } else {
    for (const quoi of [
      'l’échec est dit',
      'en français, et non par le nom de l’exception',
      'l’écran parle d’espace plein',
      'il dit où libérer de la place',
      'et que rien n’a été enregistré',
      'la zone porte role="alert", donc elle s’annonce',
    ]) {
      verifier(quoi, 'coffre resté fermé', true);
    }
  }
  await ctx.close();
}

/* ── 6. Une base prise par un autre onglet dit de le fermer (A8) ─────────── */

/*
   LE POINT A8, ET CE QU'IL DEMANDE DE PROUVER.

   `src/lib/agir.ts` porte deux phrases qui nomment le geste : « Fermez les
   autres onglets de Cyclades, rechargez la page, puis recommencez » pour
   `InvalidStateError`, et « c'est qu'un autre onglet porte une version plus
   neuve » pour `VersionError`. Elles existaient, et RIEN ne vérifiait
   qu'elles atteignent l'écran.

   C'est la différence entre une table juste et un site qui parle : une
   entrée peut être parfaite et ne jamais être atteinte — parce que l'appel
   ne passe pas par `agir`, parce qu'un `catch` l'avale, parce que l'écran
   n'a pas de région. L'essai casse donc la base avec CES noms-là, et
   regarde l'écran.

   POURQUOI CES DEUX NOMS SONT LES BONS. Ils ne sont pas inventés pour
   l'occasion : `src/lib/noyau/instantane.ts` les rencontre pour de vrai —
   « Base « … » bloquée par un autre onglet » sur `onblocked`, et une base
   ouverte ailleurs sur une version plus récente. Un essai qui éprouverait un
   nom que le code ne rencontre jamais mesurerait une politesse, pas une
   panne.

   ET LE CONTRÔLE EN SENS INVERSE. Une phrase qui parlerait d'onglets à
   chaque panne serait aussi fausse qu'une phrase absente : on vérifie donc
   qu'une erreur ORDINAIRE ne la déclenche pas. Sans cela, le vert ci-dessus
   pourrait venir d'un message passe-partout.
*/
console.log('\nUNE BASE PRISE PAR UN AUTRE ONGLET DIT DE LE FERMER');
for (const cas of [
  {
    nom: 'InvalidStateError',
    message: 'The database connection is closing.',
    attendu: /Fermez les autres onglets/i,
    quoi: 'InvalidStateError — l’écran dit de fermer les autres onglets',
  },
  {
    nom: 'VersionError',
    message: 'The requested version is less than the existing version.',
    attendu: /version plus neuve|version plus récente/i,
    quoi: 'VersionError — l’écran parle d’un onglet plus neuf',
  },
]) {
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(saboterLesEcritures(cas.nom, cas.message));
  await page.locator('#kg').fill('72');
  await page.locator('#peser').click();
  await page.waitForTimeout(1500);

  const visible = page.locator('#echec-de-page:visible, [role="alert"]:visible').first();
  const parue = (await visible.count()) > 0;
  verifier(`${cas.nom} — l’échec est dit`, parue, true);
  const dit = (parue ? ((await visible.textContent()) ?? '') : '').replace(/\s+/g, ' ');
  verifier(cas.quoi, cas.attendu.test(dit), true);
  /*
     Et pas par le message du navigateur, qui est en anglais et ne dit aucun
     geste : c'est la moitié du point qui se perdrait le plus facilement.
  */
  verifier(
    `${cas.nom} — et non par le message anglais du navigateur`,
    dit.includes(cas.message) || dit.includes(cas.nom),
    false,
  );
  verifier(
    `${cas.nom} — la zone s’annonce (role="alert")`,
    parue ? await visible.getAttribute('role') : null,
    'alert',
  );
  await ctx.close();
}

console.log('\nET LA PHRASE N’EST PAS UN PASSE-PARTOUT');
{
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(saboterLesEcritures(null));
  await page.locator('#kg').fill('73');
  await page.locator('#peser').click();
  await page.waitForTimeout(1500);
  const visible = page.locator('#echec-de-page:visible, [role="alert"]:visible').first();
  const dit = ((await visible.count()) ? ((await visible.textContent()) ?? '') : '').replace(
    /\s+/g,
    ' ',
  );
  verifier('une panne ordinaire est dite', dit.trim().length > 10, true);
  verifier(
    'mais elle ne parle pas des autres onglets',
    /autres onglets/i.test(dit),
    false,
  );
  await ctx.close();
}

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
