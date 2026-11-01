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

/**
 * Fait échouer toute écriture par un `TypeError`, comme un `fetch` refusé.
 *
 * Un helper à part, et non un quatrième mode du précédent : celui-ci ne
 * fabrique pas une `DOMException` et n'a ni nom ni code à porter. Les mêler
 * aurait donné une fonction à trois branches dont deux arguments ne servent
 * qu'à une, et c'est ainsi qu'on finit par appeler la mauvaise.
 *
 * Le message est **celui du navigateur** — « Failed to fetch » —, parce que
 * c'est lui qui ne doit pas atteindre l'écran. L'inventer en français aurait
 * vidé le contrôle de son objet.
 */
const saboterParUnTypeError = (message: string) => `
  (() => {
    const refuser = function () {
      throw new TypeError(${JSON.stringify(message)});
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

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET LA SEULE QUI RESTE UNE DURÉE

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4. Douze temporisations à
   l'aveugle vivaient ici. Dix sont remplacées par la post-condition du geste
   — la région d'échec qui paraît, la pesée qui se range, le coffre qui
   s'ouvre.

   DEUX RESTENT, et elles sont d'une autre nature : « le message est encore là
   trois secondes plus tard » affirme une DURÉE. Ce n'est pas une attente
   avant lecture, c'est l'objet même du constat — le message n'est pas une
   bulle qui s'efface. On ne peut pas l'abréger sans changer ce qu'il dit.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes : elle rend un blocage lisible, elle ne mesure rien. */
const DELAI = 30_000;

/** Attend que la région d'échec paraisse — par son identifiant ou son rôle. */
const attendreLEchec = (page: import('playwright-core').Page) =>
  page
    .waitForFunction(
      () => {
        const vus = document.querySelectorAll('#echec-de-page, [role="alert"]');
        return [...vus].some((e) => (e as HTMLElement).getBoundingClientRect().height > 0);
      },
      undefined,
      { timeout: DELAI },
    )
    .catch(() => {});

/* ── 1. La région commune existe, et elle ne paraît pas pour rien ─────────── */

console.log('\nAU REPOS, RIEN NE S’AFFICHE');
{
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  /*
     Rien à attendre : « aucune région d'échec » est un invariant NÉGATIF, vrai
     dès le chargement et qui le resterait si une région paraissait une seconde
     plus tard. La seule chose qui le rendrait faux est une panne, et une panne
     survenue après la lecture serait vue par les sections suivantes.
  */
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

  /* Une pesée, pour avoir quelque chose à supprimer. */
  await page.locator('#kg').fill('70');
  await page.locator('#peser').click();
  /* La pesée rangée fait paraître sa ligne, et c'est la prémisse qui suit. */
  await page
    .locator('button:has-text("Supprimer")')
    .first()
    .waitFor({ state: 'visible', timeout: DELAI })
    .catch(() => {});
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
  /* L'écriture sabotée échoue, et la porte commune l'écrit. */
  await attendreLEchec(page);

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

  /*
     LE MESSAGE RESTE, et cette temporisation est GARDÉE : trois secondes sont
     l'objet du constat, pas une marge avant lecture. Une bulle s'efface au
     bout de quelques secondes ; cette région, non. On ne peut donc pas
     l'abréger sans changer ce qu'on affirme.
  */
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
  await page.evaluate(saboterLesEcritures('QuotaExceededError'));
  await page.locator('#kg').fill('71');
  await page.locator('#peser').click();
  await attendreLEchec(page);

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
  /*
     Le filet est posé par le module de la mise en page, donc à l'exécution du
     script — avant « load », donc avant que « networkidle » ne rende la main.
     Il n'y a rien à attendre avant de lancer la panne ; ce qu'on attend, c'est
     la région qu'elle fait paraître.
  */
  await page.evaluate(() => {
    void Promise.reject(new Error('Une panne que personne n’attrape.'));
  });
  await attendreLEchec(page);
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
    /* Gardée, pour la même raison que plus haut : la durée EST le constat. */
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
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
    /*
       DEUX SECONDES ET DEMIE ATTENDAIENT UNE DÉRIVATION de clé, et la vraie
       post-condition est l'écran qui s'ouvre — c'est ce que l'assertion lit.
    */
    await page
      .locator('#coffre-ouvert')
      .waitFor({ state: 'visible', timeout: DELAI })
      .catch(() => {});
  }
  const ouvert = await page.locator('#coffre-ouvert').isVisible().catch(() => false);
  verifier('le coffre de Psyché s’ouvre', ouvert, true);

  if (ouvert) {
    await page.evaluate(saboterLesEcritures('QuotaExceededError'));
    await page.locator('#entree').fill('Une entrée d’essai, qui ne doit pas être perdue en silence.');
    await page.locator('#ecrire').click();
    await attendreLEchec(page);

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

/* ── Le `TypeError`, troisième branche de G-13 ────────────────────────────── */

/*
   POURQUOI CETTE SECTION EXISTE.

   Le discriminant de « messageDUneErreur » opposait deux sortes d'erreurs :
   la `DOMException`, panne de plate-forme à traduire, et l'`Error` ordinaire,
   message de domaine écrit pour être lu. Un échec de `fetch` n'est ni l'un ni
   l'autre : c'est un `TypeError`. Il tombait donc dans la seconde branche, et
   son texte anglais sortait mot pour mot.

   Trouvé par un sabotage du lot 0.1 — « Le déverrouillage a échoué : Failed
   to fetch », en anglais, par la fonction même qui doit l'empêcher. La preuve
   par exécution de la phrase pure est dans `essais:erreurs-dites`, avec un
   vrai `fetch` refusé ; ce qui se mesure ICI est l'autre moitié : que la
   phrase traverse jusqu'à l'écran d'une vraie page, par la porte commune.
*/
console.log('\nUN TypeError NE MONTRE PAS SON TEXTE ANGLAIS');
{
  const BRUT_DU_NAVIGATEUR = 'Failed to fetch';
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(saboterParUnTypeError(BRUT_DU_NAVIGATEUR));
  await page.locator('#kg').fill('74');
  await page.locator('#peser').click();
  await page.waitForTimeout(1500);

  const visible = page.locator('#echec-de-page:visible, [role="alert"]:visible').first();
  const parue = (await visible.count()) > 0;
  verifier('l’échec est dit', parue, true);
  const dit = (parue ? ((await visible.textContent()) ?? '') : '').replace(/\s+/g, ' ');
  verifier('et non par le texte anglais du navigateur', dit.includes(BRUT_DU_NAVIGATEUR), false);
  verifier('la phrase parle de la connexion', /connexion/i.test(dit), true);
  verifier('et elle dit quoi faire', /réessayez/i.test(dit), true);
  verifier(
    'la zone s’annonce (role="alert")',
    parue ? await visible.getAttribute('role') : null,
    'alert',
  );
  await ctx.close();
}

/* ── 8. La zone rendue au suivant : ni alerte collée, ni succès muet ─────── */

/*
   DEUX DÉFAUTS D'UNE MÊME ORIGINE : « effacerLEchec » ne défaisait pas ce que
   « direLEchec » avait fait.

   1. LE RÔLE RESTAIT. `direLEchec` pose `role="alert"` sur une zone qui n'en
      déclare pas, et rien ne le reprenait. Les zones partagées entre échecs et
      réussites — « message-sauvegarde », sur la progression et la bascule du
      coffre — repartaient donc en ALERTE à chaque « Enregistré » suivant. Une
      alerte qui annonce une routine cesse d'être entendue comme une alerte.

   2. LE SUCCÈS ÉTAIT INVISIBLE, et c'est le plus coûteux des deux.
      `effacerLEchec` posait `hidden = true`, c'est-à-dire l'ATTRIBUT. Les
      écrans montrent leurs messages par `classList.remove('hidden')`, la
      CLASSE, parce que c'est ainsi que les douze zones sont déclarées. Deux
      mécanismes, un seul défait par l'appelant.

      Relevé au navigateur sur « progression », avant le correctif : après
      l'enchaînement réel — effacement puis message de succès —, la zone porte
      le texte « Sauvegarde confirmée… », n'a PLUS la classe, garde l'attribut,
      et `offsetWidth` comme `offsetHeight` valent zéro. Le mot est écrit et
      personne ne le voit. Et comme `effacerLEchec` tourne après CHAQUE
      réussite, pas seulement après un échec, ce message n'a jamais paru.

      Le fichier porte d'ailleurs, juste au-dessus de ce `dire`, le
      commentaire d'un essai antérieur qui avait trouvé « aucun mot à
      l'écran » et corrigé une AUTRE cause — le message était écrit dans
      l'action, donc effacé juste après. La cause corrigée était réelle ; elle
      n'était pas la seule, et le symptôme était resté.

   CE QUI SUIT ÉPROUVE LE CODE LIVRÉ, et non une imitation. La sonde qui a
   servi au diagnostic rejouait les deux fonctions à la main dans la page :
   elle établissait bien le défaut, mais n'aurait rien dit du correctif, qui
   vit dans `agir.ts`. On fait donc échouer puis RÉUSSIR une vraie
   suppression, et l'on relève la zone entre les deux.
*/

console.log('\nLA ZONE EST RENDUE AU SUIVANT');
{
  const { ctx, page } = await ouvrir();
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });

  await page.evaluate(`
    (() => {
      globalThis.__ecrituresDOrigine = {
        put: IDBObjectStore.prototype.put,
        delete: IDBObjectStore.prototype.delete,
        add: IDBObjectStore.prototype.add,
      };
      'rangé'
    })();
  `);

  await page.locator('#kg').fill('77');
  await page.locator('#peser').click();
  await page
    .locator('button:has-text("Supprimer")')
    .first()
    .waitFor({ state: 'visible', timeout: DELAI })
    .catch(() => {});
  const lignes = await page.locator('button:has-text("Supprimer")').count();
  verifier('prémisse : il y a une ligne à supprimer', lignes > 0, true);

  if (lignes === 0) {
    await ctx.close();
  } else {
    const zone = page.locator('#erreur');
    const releve = async () =>
      page.evaluate(() => {
        const e = document.getElementById('erreur');
        if (!e) return null;
        return {
          role: e.getAttribute('role'),
          attribut: e.hasAttribute('hidden'),
          classe: e.classList.contains('hidden'),
          visible: !!(e.offsetWidth || e.offsetHeight),
        };
      });

    verifier('prémisse : la zone de cet écran ne déclare aucun rôle', await zone.getAttribute('role'), null);

    /* ── 8a. L'échec : la zone s'annonce ─────────────────────────────── */
    await page.evaluate(saboterLesEcritures(null));
    await page.locator('button:has-text("Supprimer")').first().click();
    await attendreLEchec(page);
    const pendant = await releve();
    verifier('pendant l’échec, la zone s’annonce', pendant?.role, 'alert');
    verifier('et elle se voit', pendant?.visible, true);

    /* ── 8b. La réussite : la zone est rendue propre ──────────────────── */
    await page.evaluate(`
      (() => {
        const o = globalThis.__ecrituresDOrigine;
        IDBObjectStore.prototype.put = o.put;
        IDBObjectStore.prototype.delete = o.delete;
        IDBObjectStore.prototype.add = o.add;
        'rendu'
      })();
    `);
    await page.locator('button:has-text("Supprimer")').first().click();
    await page.waitForTimeout(1500);
    const apres = await releve();

    verifier('après la réussite, le rôle d’alerte est repris', apres?.role, null);
    verifier('la zone est cachée — par la CLASSE', apres?.classe, true);
    /*
       L'ASSERTION QUI PORTE TOUT LE CORRECTIF, et la seule que l'ancien code
       faisait rougir : tant que l'attribut restait posé, le message de succès
       que l'écran écrit ensuite — en retirant la classe, et elle seule —
       restait invisible.
    */
    verifier('et l’attribut « hidden » n’est PAS laissé derrière', apres?.attribut, false);

    /* ── 8c. Et le message de succès se voit, par le geste des écrans ── */
    /*
       On fait ici ce que « progression » fait après une action réussie :
       écrire dans la zone et retirer la CLASSE. Si l'attribut traînait, ce
       geste ne suffirait pas — c'est exactement ce qui se passait.
    */
    const vu = await page.evaluate(() => {
      const e = document.getElementById('erreur');
      if (!e) return null;
      e.textContent = 'Enregistré.';
      e.classList.remove('hidden');
      return !!(e.offsetWidth || e.offsetHeight);
    });
    verifier('un message de succès écrit ensuite SE VOIT', vu, true);
    await ctx.close();
  }
}

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
