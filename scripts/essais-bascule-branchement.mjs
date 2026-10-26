/**
 * La bascule est-elle branchée sur le coffre vivant ?
 *
 * ## Le défaut visé, et il était grave
 *
 * L'écran de bascule rechiffrait tous les enregistrements sous une clé neuve,
 * rangée sous enveloppe. Mais `ouvrirLeCoffre` continuait de **dériver** la
 * clé du mot de passe, sans jamais regarder l'enveloppe. Deux conséquences,
 * toutes deux lues dans le code avant d'écrire cet essai :
 *
 * 1. Après la bascule, le cadenas aurait refusé **tous** les mots de passe —
 *    le nouveau comme l'ancien — puisqu'une clé dérivée n'ouvre plus rien.
 * 2. Dans l'onglet où la bascule venait d'avoir lieu, le module du coffre
 *    tenait encore l'ANCIENNE clé : toute écriture faite ensuite aurait été
 *    scellée avec une clé que plus rien ne rouvre.
 *
 * Aucune donnée n'était détruite — la migration, elle, est juste — mais
 * l'accès l'était, et la condition d'Alexis était « sans perte de données ».
 * Un coffre qu'on ne peut plus rouvrir ne tient pas cette condition.
 *
 * ## Pourquoi cet essai déclenche une VRAIE bascule
 *
 * `essais-bascule-coffre.mjs` s'arrête au seuil, délibérément : il prouve que
 * la porte est fermée sans preuve de sauvegarde. Il ne pouvait donc rien dire
 * de ce qui se passe APRÈS. Ici on franchit le seuil pour de bon, sur le
 * profil jetable du navigateur d'essai — jamais sur les données d'Alexis.
 *
 * ## Ce que cet essai NE prouve pas
 *
 * Il ne relit pas le contenu déchiffré d'un enregistrement après la bascule :
 * la clé n'est exposée nulle part dans la page, et forger un déchiffrement
 * dans l'essai reviendrait à réécrire le code qu'on prétend éprouver. Cette
 * partie-là est prouvée ailleurs, au niveau du module, par
 * `essais-migration-du-coffre.mts` — qui compare les contenus ouverts, et
 * coupe le courant trente fois au milieu.
 */
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const BASE = 'http://localhost:4321';
const MDP = motDePasseEssais();

/** Le mot de passe du coffre pour cet essai. Jetable, et sans rapport avec celui d'Alexis. */
const MDP_COFFRE = 'une phrase de coffre pour l’essai';

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
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
let page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

/** Visible = coffre fermé. Le même témoin que les autres essais du coffre. */
const ferme = (p = page) =>
  p.evaluate(() => {
    const c = document.getElementById('mdp-coffre');
    return Boolean(c) && c.getBoundingClientRect().height > 0;
  });

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET POURQUOI AUCUNE N'EST UNE DURÉE

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4. Sept temporisations à
   l'aveugle, dont une de vingt secondes et une de douze : ce sont les plus
   longues du dépôt, et les plus coûteuses — elles s'ajoutent à chaque
   batterie, qu'il y ait quelque chose à attendre ou non.

   Toutes portent sur un travail dont l'écran ANNONCE la fin : « Lu et
   vérifié », « Terminé », l'écran du coffre qui s'en va. On attend donc ces
   annonces, ce qui est exact plutôt que généreux : la bascule prend le temps
   qu'elle prend, et l'essai ne dort pas après.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes. Large, parce que 600 000 itérations de dérivation
    dans un navigateur bridé prennent déjà plusieurs secondes. */
const DELAI = 60_000;

/** Attend qu'un élément porte un texte, selon le motif donné. */
const attendreLeMessage = (selecteur, motif, p = page) =>
  p
    .waitForFunction(
      ([s, source]) =>
        new RegExp(source).test(document.querySelector(s)?.textContent ?? ''),
      [selecteur, motif.source],
      { timeout: DELAI },
    )
    .catch(() => {});

/**
 * Attend le VERDICT d'une étape, quel qu'il soit.
 *
 * L'étape de la preuve écrit « Ouverture du fichier… » avant de lire, puis son
 * verdict — « Lu et vérifié », ou l'un des deux refus. Attendre un texte non
 * vide rendrait la main sur le premier ; attendre un motif de succès ferait
 * expirer la borne entière sur un refus, et l'essai lirait ensuite un écran
 * dont il ne saurait rien.
 *
 * On attend donc que le texte soit non vide ET différent de l'annonce de
 * travail. C'est le même raisonnement que « le texte a changé » : indépendant
 * de ce qu'on affirme, et vrai pour les deux issues.
 */
const attendreLeVerdict = (selecteur, enCours, p = page) =>
  p
    .waitForFunction(
      ([s, attente]) => {
        const texte = (document.querySelector(s)?.textContent ?? '').trim();
        return texte !== '' && !texte.startsWith(attente);
      },
      [selecteur, enCours],
      { timeout: DELAI },
    )
    .catch(() => {});

const saisirLeCoffre = async (motDePasse, p = page) => {
  /*
     ON EFFACE LE REFUS D'AVANT, et c'est la parade du § 3 : un essai qui
     essaie deux fois sur la même page trouverait le message du premier refus
     encore là, et l'attente ci-dessous rendrait la main avant que le second
     essai n'ait abouti. Effacé ici, il ne peut venir que du geste qui suit.
  */
  await p.evaluate(() => {
    const zone = document.getElementById('erreur-coffre');
    if (zone) zone.textContent = '';
  });
  await p.fill('#mdp-coffre', motDePasse);
  await p.click('#ouvrir-coffre');
  /*
     SIX SECONDES ATTENDAIENT 600 000 ITÉRATIONS de dérivation, et il faut deux
     post-conditions, non une : cette aide sert aussi bien là où le coffre
     DOIT s'ouvrir que là où il doit REFUSER — « le mot de passe du site ne
     l'ouvre plus » est tout l'objet de la bascule.

     Ma première conversion n'attendait que la disparition du champ. Mesuré :
     aux trois endroits où le refus est attendu, la borne entière se consommait
     pour rien, et deux assertions d'une autre section tombaient parce que
     l'essai y arrivait dans un état qu'il n'avait pas mesuré. L'original, lui,
     passait.

     On attend donc la PREMIÈRE des deux issues : le cadenas s'en va, ou il
     dit son refus. L'assertion qui suit dit ensuite laquelle est arrivée, et
     c'est elle qui juge.
  */
  await p
    .waitForFunction(
      () => {
        const champ = document.getElementById('mdp-coffre');
        const ouvert = champ === null || champ.getBoundingClientRect().height === 0;
        const refus = (document.getElementById('erreur-coffre')?.textContent ?? '').trim();
        return ouvert || refus !== '';
      },
      undefined,
      { timeout: DELAI },
    )
    .catch(() => {});
};

/** Une valeur du magasin « etat », lue directement dans IndexedDB. */
const lireEtat = (clef, p = page) =>
  p.evaluate(
    (c) =>
      new Promise((res) => {
        const o = indexedDB.open('revinsp');
        o.onsuccess = () => {
          const r = o.result.transaction('etat', 'readonly').objectStore('etat').get(c);
          r.onsuccess = () => res(r.result ?? null);
          r.onerror = () => res(null);
        };
        o.onerror = () => res(null);
      }),
    clef,
  );

/** Le premier chiffré scellé trouvé, quel que soit le magasin. Témoin du rechiffrement. */
const premierScelle = (p = page) =>
  p.evaluate(
    () =>
      new Promise((res) => {
        const o = indexedDB.open('revinsp');
        o.onsuccess = () => {
          const b = o.result;
          const noms = [...b.objectStoreNames];
          const t = b.transaction(noms, 'readonly');
          const trouves = [];
          let restants = noms.length;
          const fini = () => {
            if (--restants === 0) {
              trouves.sort((x, y) => (x.ou < y.ou ? -1 : 1));
              res(trouves[0] ?? null);
            }
          };
          for (const n of noms) {
            const r = t.objectStore(n).getAll();
            r.onsuccess = () => {
              for (const e of r.result) {
                if (e && typeof e === 'object' && e.scelle?.ct) {
                  trouves.push({ ou: n, ct: String(e.scelle.ct).slice(0, 48) });
                  break;
                }
              }
              fini();
            };
            r.onerror = fini;
          }
          if (noms.length === 0) res(null);
        };
        o.onerror = () => res(null);
      }),
  );

/**
 * Attend qu'il y ait du scellé dans la base, et rend ce qu'on y a trouvé.
 *
 * LE SCELLÉ N'APPARAÎT PAS AU CHARGEMENT : il est écrit quand l'écran, le
 * coffre ouvert, scelle son premier enregistrement. Les six secondes de
 * l'ancienne version du coffre couvraient cette écriture sans le dire, et ma
 * première conversion l'a découvert en tombant — par intermittence, ce qui est
 * le pire des cas : trois passages du même code ont rendu trois jeux de rouges
 * différents.
 *
 * Il n'y a aucune marque à l'écran pour cela : c'est la BASE qui est la
 * post-condition, et on l'interroge jusqu'à ce qu'elle réponde.
 */
const attendreDuScelle = async (p = page) => {
  const fin = Date.now() + DELAI;
  for (;;) {
    const trouve = await premierScelle(p);
    if (trouve !== null) return trouve;
    if (Date.now() > fin) return null;
    await p.waitForTimeout(100);
  }
};

console.log('\nLA PRÉMISSE : UN COFFRE OUVERT, AVEC DU SCELLÉ DEDANS');

await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
verifier('au départ, le coffre est fermé', await ferme(), true);
await saisirLeCoffre(MDP);
verifier('le mot de passe du site l’ouvre — c’est l’état d’avant la bascule', await ferme(), false);

const avant = await attendreDuScelle();
console.log(`      premier scellé : ${JSON.stringify(avant)}`);
verifier('il y a du scellé, sinon la bascule n’aurait rien à rechiffrer', avant !== null, true);
verifier('et aucune enveloppe n’est encore posée', await lireEtat('coffre.enveloppe'), null);

console.log('\nLA BASCULE, POUR DE VRAI');

await page.goto(`${BASE}/coffre/bascule/`, { waitUntil: 'networkidle' });

/* Étape 1 : la sauvegarde. Le mot de passe du site est demandé par une invite. */
page.once('dialog', (d) => void d.accept(MDP));
const attendu = page.waitForEvent('download', { timeout: 60000 });
await page.click('#faire-sauvegarde');
const telechargement = await attendu;
const dossier = await mkdtemp(path.join(tmpdir(), 'bascule-'));
const chemin = path.join(dossier, telechargement.suggestedFilename());
await telechargement.saveAs(chemin);
const taille = (await stat(chemin)).size;
console.log(`      fichier : ${telechargement.suggestedFilename()}, ${taille} octets`);
verifier('la sauvegarde est produite', telechargement.suggestedFilename().endsWith('.cyclades'), true);
verifier('et elle n’est pas vide', taille > 256, true);

/* Étape 2 : la preuve, qui est une vraie lecture du fichier. */
await page.setInputFiles('#fichier-preuve', chemin);
/* L'étape 2 lit le fichier entier, puis écrit son verdict. */
await attendreLeVerdict('#message-preuve', 'Ouverture du fichier');
const direPreuve = await page.textContent('#message-preuve');
console.log(`      message de l’étape 2 : ${direPreuve}`);
verifier('elle est relue et acceptée comme preuve', /Lu et vérifié/.test(direPreuve), true);

/* Étape 3 : le nouveau mot de passe, puis le départ. */
await page.fill('#mdp-nouveau', MDP_COFFRE);
await page.fill('#mdp-confirmation', MDP_COFFRE);
/* Le bouton s'active quand les deux champs concordent : c'est ce que
   l'assertion lit, et l'attente est bornée. */
await page
  .waitForFunction(
    () => document.getElementById('lancer-bascule')?.disabled === false,
    undefined,
    { timeout: DELAI },
  )
  .catch(() => {});
verifier(
  'le bouton de bascule s’allume',
  await page.evaluate(() => document.getElementById('lancer-bascule')?.disabled),
  false,
);

const sessionAvant = await page.evaluate(() => sessionStorage.getItem('cyclades.coffre'));
await page.click('#lancer-bascule');
/*
   VINGT SECONDES, et c'était le plus gros pari du dépôt : la bascule rechiffre
   tout le magasin, et sa durée dépend de la machine autant que des données.
   L'écran dit « Terminé » quand elle l'est — et dit autre chose quand elle
   échoue, ce que le motif prend aussi, faute de quoi un échec attendrait la
   borne entière avant de se dire.
*/
await attendreLeMessage('#message-bascule', /Terminé|Échec|Erreur|impossible|interrompue/);
const direBascule = await page.textContent('#message-bascule');
console.log(`      message de la bascule : ${direBascule}`);
verifier('la bascule s’annonce terminée', /Terminé/.test(direBascule), true);

console.log('\nCE QUE LA BASCULE A CHANGÉ DANS LE STOCKAGE');

verifier('une enveloppe est posée', typeof (await lireEtat('coffre.enveloppe')) === 'string', true);
verifier('et son sel aussi', typeof (await lireEtat('coffre.sel-enveloppe')) === 'string', true);
const apres = await premierScelle();
verifier('le même enregistrement est toujours là', apres?.ou, avant?.ou);
verifier('mais son chiffré a changé : il a bien été rechiffré', apres?.ct !== avant?.ct, true);

console.log('\nL’ONGLET QUI A BASCULÉ A ADOPTÉ LA CLÉ NEUVE');

const sessionApres = await page.evaluate(() => sessionStorage.getItem('cyclades.coffre'));
verifier(
  'la clé gardée pour l’onglet a été réencapsulée',
  Boolean(sessionAvant) && Boolean(sessionApres) && sessionAvant !== sessionApres,
  true,
);

console.log('\nET SURTOUT : LE COFFRE SE ROUVRE, DANS UN ONGLET NEUF');

await page.close();
page = await ctx.newPage();
await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
verifier('dans un onglet neuf, le coffre est fermé', await ferme(), true);

await saisirLeCoffre(MDP);
verifier('le mot de passe du SITE ne l’ouvre plus — c’était tout l’objet de la bascule', await ferme(), true);

await saisirLeCoffre(MDP_COFFRE);
verifier('le mot de passe du COFFRE l’ouvre', await ferme(), false);

/* ══════════════════════════════════════════════════════════════════════════
   Deuxième scène : une bascule INTERROMPUE
   ══════════════════════════════════════════════════════════════════════════

   L'enveloppe est posée AVANT que les enregistrements soient repris. Entre
   les deux, elle livre une clé parfaitement valide qui n'ouvre encore rien.
   Si le cadenas se contentait de l'enveloppe, cet état — une panne, un onglet
   fermé, une page rechargée au mauvais moment — enfermerait toutes les
   données derrière une clé juste.

   Cette scène fabrique exactement cet état. Elle écrit l'enveloppe à la main,
   et il faut dire ce que cela suppose : le sel en hexadécimal sous
   « coffre.sel-enveloppe », la clé encapsulée en base64 sous
   « coffre.enveloppe », AES-KW par-dessus PBKDF2 à 600 000 tours. Si le
   module changeait de format, l'application ne reconnaîtrait plus ce que
   l'essai écrit, et la scène tomberait au lieu de mentir.
*/
console.log('\nUNE BASCULE INTERROMPUE N’ENFERME PERSONNE');

const ctx2 = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
page = await ctx2.newPage();
await franchirInitialisation(page, BASE, MDP);
await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
await saisirLeCoffre(MDP);
verifier('prémisse : un coffre ouvert au mot de passe du site', await ferme(), false);
verifier('prémisse : du scellé dedans', (await attendreDuScelle()) !== null, true);

await page.evaluate(async (motDePasse) => {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const hexa = [...sel].map((o) => o.toString(16).padStart(2, '0')).join('');
  const materiel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(motDePasse),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const enveloppante = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel, iterations: 600000, hash: 'SHA-256' },
    materiel,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
  const donnees = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const encapsulee = await crypto.subtle.wrapKey('raw', donnees, enveloppante, 'AES-KW');
  const b64 = btoa(String.fromCharCode(...new Uint8Array(encapsulee)));
  await new Promise((res) => {
    const o = indexedDB.open('revinsp');
    o.onsuccess = () => {
      const t = o.result.transaction('etat', 'readwrite');
      t.objectStore('etat').put(hexa, 'coffre.sel-enveloppe');
      t.objectStore('etat').put(b64, 'coffre.enveloppe');
      t.oncomplete = () => res(null);
      t.onerror = () => res(null);
    };
  });
}, MDP_COFFRE);

const enveloppePlantee = await lireEtat('coffre.enveloppe');
verifier('l’enveloppe de la bascule interrompue est en place', typeof enveloppePlantee === 'string', true);

await page.close();
page = await ctx2.newPage();
await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
verifier('onglet neuf : le coffre est fermé', await ferme(), true);
await saisirLeCoffre(MDP);
verifier(
  'le mot de passe du SITE ouvre encore — personne n’est enfermé',
  await ferme(),
  false,
);

/*
   Et le mot de passe du COFFRE, lui, ne doit PAS ouvrir : sa clé est juste,
   mais elle n'ouvre encore aucune donnée. Ouvrir sur un coffre vide
   d'apparence serait la pire des réponses — elle ressemble à une perte.
*/
await page.close();
page = await ctx2.newPage();
await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
await saisirLeCoffre(MDP_COFFRE);
verifier('le mot de passe du coffre n’ouvre pas sur du vide', await ferme(), true);
const erreur = await page.textContent('#erreur-coffre');
console.log(`      message du cadenas : ${erreur}`);
verifier(
  'et le refus nomme la bascule interrompue, au lieu de dire « incorrect »',
  /bascule a été interrompue/.test(erreur ?? ''),
  true,
);

/* Et la relance ne doit pas poser une SECONDE enveloppe par-dessus. */
await saisirLeCoffre(MDP);
verifier('prémisse de la relance : le coffre est rouvert au mot de passe du site', await ferme(), false);
await page.goto(`${BASE}/coffre/bascule/`, { waitUntil: 'networkidle' });
page.once('dialog', (d) => void d.accept(MDP));
const attendu2 = page.waitForEvent('download', { timeout: 60000 });
await page.click('#faire-sauvegarde');
const t2 = await attendu2;
const chemin2 = path.join(await mkdtemp(path.join(tmpdir(), 'bascule2-')), t2.suggestedFilename());
await t2.saveAs(chemin2);
await page.setInputFiles('#fichier-preuve', chemin2);
await attendreLeVerdict('#message-preuve', 'Ouverture du fichier');
/*
   LA PREUVE DE LA RELANCE EST DITE, et non supposée : le gestionnaire de
   « Lancer » rend la main EN SILENCE quand la preuve n'est pas faite —
   « if (!preuveFaite || !motDePasseValide) return; » — et le message reste
   alors vide. Sans cette ligne, un rouge plus bas ne dirait pas lequel des
   trois chemins a été pris.
*/
console.log(`      preuve de la relance : ${await page.textContent('#message-preuve')}`);
const autre = 'un tout autre mot de passe de coffre';
await page.fill('#mdp-nouveau', autre);
await page.fill('#mdp-confirmation', autre);
await page
  .waitForFunction(
    () => document.getElementById('lancer-bascule')?.disabled === false,
    undefined,
    { timeout: DELAI },
  )
  .catch(() => {});
console.log(
  `      bouton de relance : ${
    (await page.evaluate(() => document.getElementById('lancer-bascule')?.disabled)) ? 'éteint' : 'allumé'
  }`,
);
/*
   ET LE GESTE LUI-MÊME. Je l'avais PERDU en convertissant ce bloc : le
   remplacement portait sur les trois lignes « attendre, cliquer, attendre »,
   et la nouvelle n'en remettait que les attentes. L'essai a rendu un rouge
   parfaitement cohérent — « le refus n'est pas dit » — sur un refus qu'on
   n'avait jamais demandé.

   La leçon vaut pour tout le chantier, et elle n'a rien à voir avec les
   post-conditions : quand on remplace un bloc, on vérifie que le GESTE y est
   encore. Ce sont les deux lignes de diagnostic ci-dessus qui l'ont montré,
   en disant que la preuve était faite et le bouton allumé — donc que rien ne
   s'opposait au geste, donc qu'il n'avait pas eu lieu.
*/
await page.click('#lancer-bascule');
/*
   LE REFUS EST UN MESSAGE, pas une absence : la bascule déjà commencée le dit.
   Le gestionnaire écrit d'abord « Rechiffrement en cours », puis son verdict ;
   le motif ne prend donc que les verdicts, et non l'annonce de travail.
*/
await attendreLeMessage('#message-bascule', /déjà été commencée|Échec|Erreur|impossible/);
const refus = await page.textContent('#message-bascule');
console.log(`      message de la relance : ${refus}`);
verifier('un AUTRE mot de passe est refusé plutôt que posé par-dessus', /déjà été commencée/.test(refus), true);
verifier(
  'et l’enveloppe en place n’a pas bougé',
  await lireEtat('coffre.enveloppe'),
  enveloppePlantee,
);

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
