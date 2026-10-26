/**
 * 0.1 — déverrouiller EN MODE AVION, à froid, puis lire une donnée.
 *
 *   npm run essais:hors-ligne-a-froid
 *
 * ## Ce que `essais:hors-ligne-usage` ne mesure pas, et pourquoi il fallait
 * un second fichier
 *
 * L'essai de M8 déverrouille **en ligne** (sa ligne 106), PUIS passe en mode
 * avion (sa ligne 127). Il mesure donc la survie d'une session déjà ouverte —
 * ce qui était le défaut du 18 octobre, et c'est très bien. Mais le cas de
 * quelqu'un qui ouvre Cyclades **sans réseau et sans session** n'était mesuré
 * nulle part : on fermait l'onglet, on reprenait le train, et personne ne
 * savait si le mot de passe serait encore accepté.
 *
 * Deux chemins séparent ces deux cas, et ils ne tombent pas au même endroit :
 * une session ouverte passe par `obtenirCle`, qui ne conclut rien quand les
 * paramètres manquent ; une saisie de mot de passe passe par `deverrouiller`,
 * qui, elle, en avait besoin.
 *
 * ## LE DÉFAUT QUE CET ESSAI A TROUVÉ, et il n'était pas celui qu'on cherchait
 *
 * La bonne nouvelle d'abord, mesurée avant d'écrire une ligne de correctif :
 * le déverrouillage en mode avion **marchait déjà**, grâce à la copie de
 * secours des paramètres publics que `contenu.ts` garde en `localStorage`
 * depuis M8. Rien à réparer de ce côté, seulement à garder.
 *
 * La mauvaise ensuite. Quand cette copie manque aussi — hors ligne sur un
 * appareil dont le stockage local a été vidé mais dont le cache tient encore,
 * ou dans une fenêtre où `localStorage` a été refusé —, `params()` lève.
 * L'écran du verrou ne rattrapait pas : son bouton restait sur
 * « Déchiffrement… », **désactivé, définitivement**, sans message, avec dans
 * la console un « Failed to fetch » que personne ne lit. C'est le pire des
 * échecs : celui qui ressemble à une attente. Mesuré le 26 octobre, mode
 * avion, worker arrêté.
 *
 * La section 5 est là pour cela, et elle vaut autant que les quatre premières.
 *
 * ## « Lire une donnée » : laquelle, et pourquoi pas n'importe laquelle
 *
 * On lit une tâche d'Odyssée, c'est-à-dire un magasin **en clair**. Ce n'est
 * pas un hasard : `odysseeMesures` — le poids, par exemple — est un magasin
 * SCELLÉ, et le lire demande le coffre, qui est une seconde porte avec son
 * propre mot de passe. Un essai qui aurait lu un poids aurait donc pu passer
 * au vert grâce à un coffre resté mémorisé, en croyant mesurer le
 * déverrouillage du site. La confusion a été commise pendant la sonde, et
 * c'est elle qui a fixé ce choix.
 *
 * On mesure donc trois choses, qui disent ensemble que le déverrouillage a
 * eu lieu : la donnée en clair est lue, la clé du contenu est de nouveau
 * mémorisée, et `<html>` porte l'état « ouvert ».
 *
 * ## Ce que l'essai simule, et ce qu'il ne simule pas
 *
 * Le mode avion est réel — `context.setOffline(true)` coupe la pile réseau du
 * navigateur. L'arrêt du *service worker* est demandé par le protocole de
 * débogage, comme dans l'essai de M8 et pour la même raison : un worker qui
 * ne redémarre pas garde sa publication en mémoire, et l'essai passerait au
 * vert sur un cas qui ne s'est pas produit.
 *
 * En revanche l'oubli de la session est simulé : on retire `revinsp.cle` du
 * stockage plutôt que de fermer le navigateur, parce qu'un contexte fermé
 * emporterait aussi le cache, donc la page. Ce qui est éprouvé est bien le
 * chemin de la saisie, et c'est ce qui compte.
 *
 * ## Ce que les trois sabotages ont montré
 *
 * **La copie de secours neutralisée** — `parametresDeSecours()` écartée dans
 * `contenu.ts` : cinq rouges, tous en section 4 ; la section 5 reste verte,
 * puisqu'elle mesure la même privation. Un détail de ce verdict justifie à
 * lui seul la double lecture de la donnée : « lue en base » reste VERTE —
 * IndexedDB n'a pas besoin de la clé du site — tandis que « elle est à
 * l'écran » rougit. Une seule des deux lectures aurait laissé passer la
 * moitié du défaut.
 *
 * **Le message retiré de `auth.ts`**, le `finally` de l'écran gardé : trois
 * rouges, et ce sont les bons. Le bouton revient, un message paraît — donc
 * les deux garde-fous de l'écran agissent —, mais il dit « Le déverrouillage
 * a échoué : Failed to fetch ». Il ne nomme pas la cause, ne dit pas quoi
 * faire, et il est en anglais. Les deux couches sont donc mesurées
 * séparément : le `finally` sauve l'écran, la phrase d'`auth.ts` le rend
 * utile.
 *
 * **Les deux retirés** — l'état d'avant correction : cinq rouges, le message
 * est vide, le bouton reste mort. C'est l'écran sans issue, tel qu'il était.
 *
 * ## Un défaut voisin, mesuré ici et laissé à qui le tient
 *
 * Le deuxième sabotage a fait passer « Failed to fetch » à l'écran EN
 * ANGLAIS, par `messageDUneErreur` de `lib/agir.ts`. Ce n'est pas un hasard :
 * son discriminant est documenté — une `DOMException` est une panne de
 * plate-forme et se traduit, une `Error` ordinaire vient de l'application et
 * son message est déjà français. Or un échec de `fetch` est un `TypeError`,
 * donc une `Error` ordinaire, et son texte anglais traverse.
 *
 * Le chemin ne se produit plus ici — `auth.ts` nomme la cause avant —, mais
 * le trou reste pour tout autre appelant. Il est signalé au Pilote plutôt
 * que rebouché dans ce lot : `agir.ts` est tenu par tout le monde, et son
 * discriminant mérite une décision, pas un rustine de passage.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const TITRE = 'Tâche posée avant le train';

/** La copie de secours des paramètres publics, nommée une fois. */
const CLE_SECOURS = 'cyclades.parametres-publics';

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

/* ── Les relevés, pris une fois chacun ─────────────────────────────────── */

const taches = (page) =>
  page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          try {
            const q = r.result.transaction('odysseeTaches').objectStore('odysseeTaches').getAll();
            q.onsuccess = () => ok(q.result.map((t) => t.titre));
            q.onerror = () => ok(null);
          } catch {
            ok(null);
          }
        };
        r.onerror = () => ok(null);
      }),
  );

/**
 * L'état du verrou, relevé en une fois.
 *
 * En une fois, et c'est une leçon payée plusieurs fois dans ce dépôt : trois
 * relevés successifs sur une page qui bouge décrivent trois instants
 * différents, et l'assertion qui les compare ne mesure plus rien.
 */
const etat = (page) =>
  page.evaluate(
    (idSecours) => ({
      /* `offsetParent` à null = masqué. Le verrou n'est pas affiché. */
      verrouAffiche: Boolean(document.getElementById('champ-mdp')?.offsetParent),
      ouvert: document.documentElement.dataset.verrou === 'ouvert',
      cle: (() => {
        try {
          return Boolean(localStorage.getItem('revinsp.cle') || sessionStorage.getItem('revinsp.cle'));
        } catch {
          return false;
        }
      })(),
      secours: (() => {
        try {
          return Boolean(localStorage.getItem(idSecours));
        } catch {
          return false;
        }
      })(),
      bouton: (document.getElementById('bouton-verrou')?.textContent ?? '').trim(),
      boutonMort: document.getElementById('bouton-verrou')?.hasAttribute('disabled') ?? null,
      erreur: (() => {
        const e = document.getElementById('erreur-verrou');
        return e && e.offsetParent ? (e.textContent ?? '').replace(/\s+/g, ' ').trim() : '';
      })(),
    }),
    CLE_SECOURS,
  );

/** Coupe le réseau, arrête le worker, et recharge. Rend le code HTTP. */
async function rechargerAFroid(ctx, page, chemin) {
  await ctx.setOffline(true);
  /*
     L'ARRÊT DU WORKER EST DEMANDÉ, ET SON REFUS SERAIT DIT.

     Un service worker s'arrête dès qu'il se tait et repart au premier
     événement. Un essai qui enchaîne ses gestes en quelques secondes ne lui
     en laisse pas le temps : il garderait sa publication en mémoire d'un bout
     à l'autre, et « à froid » ne voudrait plus rien dire.
  */
  const cdp = await ctx.newCDPSession(page);
  let arrete = false;
  try {
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    arrete = true;
  } catch {
    /* Rendu à l'appelant : un arrêt qu'on n'a pas obtenu ne se suppose pas. */
  }
  const code = await page
    .goto(`${RACINE}${chemin}`, { waitUntil: 'load', timeout: 60000 })
    .then((r) => r?.status() ?? 0, () => 0);
  return { arrete, code };
}

/** Ouvre un contexte, franchit l'initialisation, et pose la donnée témoin. */
async function unAppareilQuiAServi() {
  const ctx = await nav.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.locator('#titre').fill(TITRE);
  await page.locator('#ajout button[type=submit]').click();
  await page.waitForTimeout(2500);
  return { ctx, page };
}

/* ══════════════════════════════════════════════════════════════════════════
   1. En ligne : l'appareil a servi une fois
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nEN LIGNE, L’APPAREIL A SERVI UNE FOIS');
const { ctx, page } = await unAppareilQuiAServi();
{
  const e = await etat(page);
  /*
     LES DEUX PRÉMISSES, et elles ne sont pas décoratives.

     Sans la clé, la section 3 mesurerait la disparition d'une chose qui n'a
     jamais été là. Sans la copie de secours, la section 4 mesurerait le cas
     de la section 5 — et les deux passeraient au vert pour la mauvaise
     raison, chacune en croyant mesurer l'autre.
  */
  vrai('prémisse : la clé du contenu est mémorisée', e.cle);
  vrai('prémisse : la copie de secours des paramètres est gardée', e.secours);
  v('et le verrou n’est pas affiché', e.verrouAffiche, false);
  vrai('la donnée témoin est en base', (await taches(page))?.includes(TITRE));
  vrai(
    'le service worker est actif',
    await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active)),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2. La session est oubliée — mais pas la copie de secours
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLA SESSION EST OUBLIÉE');
await page.evaluate(() => {
  try {
    localStorage.removeItem('revinsp.cle');
    sessionStorage.removeItem('revinsp.cle');
  } catch {
    /* Rapporté par le relevé qui suit. */
  }
});
{
  const e = await etat(page);
  v('la clé n’est plus mémorisée', e.cle, false);
  vrai('mais la copie de secours est intacte : c’est elle qu’on éprouve', e.secours);
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Mode avion, worker arrêté, rechargement à froid
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nEN MODE AVION, À FROID');
{
  const { arrete, code } = await rechargerAFroid(ctx, page, '/odyssee/taches/');
  vrai('le worker a été arrêté avant le rechargement', arrete);
  v('l’écran s’ouvre, servi par le cache', code, 200);
  /*
     S'ARRÊTER SI RIEN NE S'EST OUVERT.

     Une navigation qui échoue ne vide pas l'onglet : la page PRÉCÉDENTE y
     reste. Les contrôles suivants la mesureraient donc elle, et passeraient
     au vert alors que rien ne s'est ouvert. La leçon vient de
     `essais:hors-ligne-usage`, qui l'a payée sur un sabotage.
  */
  if (code !== 200) {
    console.log(
      '\x1b[31m✗\x1b[0m la suite n’est pas mesurée : sans rechargement, elle porterait sur la page précédente',
    );
    rouges += 1;
    await nav.close();
    console.log(`\n\x1b[31m${rouges} rouge${rouges > 1 ? 's' : ''}.\x1b[0m`);
    process.exit(1);
  }
  await page.waitForTimeout(4000);
  const e = await etat(page);
  vrai('le verrou est demandé, puisque la session est oubliée', e.verrouAffiche);
  v('et rien n’est ouvert pour l’instant', { ouvert: e.ouvert, cle: e.cle }, { ouvert: false, cle: false });
}

/* ══════════════════════════════════════════════════════════════════════════
   4. On déverrouille EN MODE AVION, et on lit la donnée
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nON DÉVERROUILLE EN MODE AVION');
{
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
  /*
     La dérivation PBKDF2 est volontairement lente, et le réseau échoue avant
     elle : on attend l'état, pas une durée.
  */
  await page
    .waitForFunction(() => document.documentElement.dataset.verrou === 'ouvert', undefined, {
      timeout: 30000,
    })
    .catch(() => {
      /* Le relevé qui suit dira ce qui s'est passé, au lieu de mourir ici. */
    });
  await page.waitForTimeout(2000);
  const e = await etat(page);
  vrai('le déverrouillage réussit sans réseau', e.ouvert);
  v('le verrou se referme sur l’écran', e.verrouAffiche, false);
  vrai('la clé du contenu est de nouveau mémorisée', e.cle);
  v('et aucune erreur n’est affichée', e.erreur, '');

  /*
     LA DONNÉE, LUE DE DEUX FAÇONS : en base et à l'écran. La première dit
     que la base est joignable, la seconde que l'écran s'en est servi. Une
     base lisible sous un écran vide serait une demi-réussite qu'il vaut mieux
     voir.
  */
  const lues = await taches(page);
  vrai('la donnée est lue en base, hors ligne', lues?.includes(TITRE));
  vrai(
    'et elle est à l’écran',
    await page.evaluate((t) => (document.querySelector('main')?.innerText ?? '').includes(t), TITRE),
  );
}
await ctx.close();

/* ══════════════════════════════════════════════════════════════════════════
   5. Sans la copie de secours, le refus est DIT — et le bouton revient
   ══════════════════════════════════════════════════════════════════════════ */

/*
   C'est le défaut que cet essai a trouvé. Sans ce qui suit, la section 4
   garderait un chemin qui marche, et laisserait à côté de lui un écran sans
   issue : bouton mort, aucun message, et une console que personne ne lit.
*/
console.log('\nSANS LA COPIE DE SECOURS, LE REFUS EST DIT');
{
  const { ctx: ctx2, page: page2 } = await unAppareilQuiAServi();
  await page2.evaluate((idSecours) => {
    try {
      localStorage.removeItem('revinsp.cle');
      sessionStorage.removeItem('revinsp.cle');
      localStorage.removeItem(idSecours);
    } catch {
      /* Rapporté par la prémisse qui suit. */
    }
  }, CLE_SECOURS);

  const { code } = await rechargerAFroid(ctx2, page2, '/odyssee/taches/');
  v('l’écran s’ouvre quand même, servi par le cache', code, 200);
  if (code !== 200) {
    console.log('\x1b[31m✗\x1b[0m la suite n’est pas mesurée : rien ne s’est rechargé');
    rouges += 1;
  } else {
    await page2.waitForTimeout(4000);
    const avant = await etat(page2);
    vrai('prémisse : le verrou est demandé', avant.verrouAffiche);
    v('prémisse : la copie de secours est bien absente', avant.secours, false);

    await page2.fill('#champ-mdp', MDP);
    await page2.click('#bouton-verrou');
    /*
       On attend que le bouton REVIENNE, ce qui est exactement la promesse :
       avant correction il restait sur « Déchiffrement… » pour toujours, et
       une attente de durée fixe aurait rendu ce rouge dépendant de la
       machine.
    */
    await page2
      .waitForFunction(
        () => {
          const b = document.getElementById('bouton-verrou');
          return b instanceof HTMLButtonElement && !b.disabled;
        },
        undefined,
        { timeout: 30000 },
      )
      .catch(() => {
        /* Le relevé dira que le bouton est resté mort. */
      });
    const apres = await etat(page2);
    v('le bouton revient à « Déverrouiller »', apres.bouton, 'Déverrouiller');
    v('et il est de nouveau utilisable', apres.boutonMort, false);
    vrai('le refus est dit à l’écran', apres.erreur.length > 0);
    console.log(`      message : « ${apres.erreur} »`);
    vrai(
      'il nomme la cause : les paramètres de chiffrement',
      /paramètres de chiffrement/i.test(apres.erreur),
    );
    vrai(
      'et il dit quoi faire : se reconnecter une fois',
      /reconnectez-vous une fois/i.test(apres.erreur),
    );
    /*
       ET RIEN N'EST OUVERT. Un refus qui déverrouillerait quand même serait
       pire que le bouton mort : on croirait le site fermé alors qu'il est
       ouvert.
    */
    v(
      'et rien n’a été ouvert',
      { ouvert: apres.ouvert, verrouAffiche: apres.verrouAffiche },
      { ouvert: false, verrouAffiche: true },
    );
    /*
       La phrase est en français, et c'est un contrôle à part : le texte brut
       d'une plate-forme — « Failed to fetch » — est ce qui s'affichait avant,
       dans la console.
    */
    v('et il n’est pas en anglais', /failed|error|fetch|network/i.test(apres.erreur), false);
  }
  await ctx2.close();
}

await nav.close();
console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${rouges} rouge${rouges > 1 ? 's' : ''}.\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
