/**
 * Le mot de passe est-il vraiment redemandé avant ce qu'on ne rattrape pas ?
 *
 * ## Le défaut visé
 *
 * Trois gestes sans retour ne demandaient qu'un clic : l'effacement de tout le
 * profil, l'effacement ciblé sans sauvegarde, et l'export en clair. Un
 * `window.confirm` protège de la maladresse et de rien d'autre.
 *
 * ## Ce que cet essai fait, et pourquoi ainsi
 *
 * Il n'inspecte pas la page à la recherche d'un dialogue : il **essaie de
 * détruire**, et regarde si quelque chose a été détruit. Un essai qui se
 * contenterait de voir le dialogue apparaître serait vert même si le bouton
 * effaçait d'abord et demandait ensuite.
 *
 * La prémisse est posée à chaque fois : on vérifie qu'il y a quelque chose à
 * perdre avant d'essayer de le perdre. Un profil vide « résisterait » à tous
 * les effacements du monde sans rien prouver.
 */
import { chromium } from 'playwright-core';
import { repondreAuChamp } from './lib/boite-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const BASE = 'http://localhost:4321';
/*
   Par le module partagé, comme cent trente et un autres essais, et non par
   `process.env.SITE_PASSWORD` seul : le module lit AUSSI `.env.local`, qui
   est le fichier du build et qui est ignoré par Git. Lire la seule variable
   obligeait à écrire le mot de passe devant la commande — donc dans le
   journal de la session, en clair. Dix-sept autres essais le font encore ;
   c'est signalé au pilote plutôt que corrigé ici, où ce serait hors sujet.
*/
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
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET POURQUOI AUCUNE N'EST UNE DURÉE

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4. Dix temporisations à
   l'aveugle vivaient ici, de 500 à 4 000 ms, et chacune pariait sur une
   moyenne. Elles sont remplacées par la post-condition du geste.

   Le cas intéressant est la RÉPONSE au dialogue : elle a deux issues, et
   attendre une seule des deux ferait tomber l'autre cas. Le dialogue se
   referme quand le mot de passe est accepté ; il affiche son refus quand il
   ne l'est pas. On attend donc la première des deux, et chaque assertion dit
   ensuite laquelle est arrivée.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes : elle rend un blocage lisible, elle ne mesure rien. */
const DELAI = 30_000;

/** Le dialogue de redemande est-il ouvert ? */
const dialogueOuvert = () => page.evaluate(() => Boolean(document.querySelector('dialog[open]')));

/** Attend que le dialogue soit ouvert, ou refermé. */
const attendreLeDialogue = (ouvert) =>
  page
    .waitForFunction(
      (veutOuvert) => Boolean(document.querySelector('dialog[open]')) === veutOuvert,
      ouvert,
      { timeout: DELAI },
    )
    .catch(() => {});

/** Saisir dans le dialogue et valider, puis attendre l'une des deux issues. */
const repondre = async (motDePasse) => {
  await page.fill('dialog[open] input[type="password"]', motDePasse);
  await page.click('dialog[open] button[type="submit"]');
  await page
    .waitForFunction(
      () => {
        const boite = document.querySelector('dialog[open]');
        if (boite === null) return true;
        return (boite.querySelector('[role="alert"]')?.textContent ?? '').trim() !== '';
      },
      undefined,
      { timeout: DELAI },
    )
    .catch(() => {});
};

/*
   « Renoncer » PAR SON LIBELLÉ, et non par « le bouton qui n'est pas celui de
   validation ».

   Le point D3 du 43 pose un œil « Afficher » à côté de chaque champ de mot de
   passe — y compris celui de cette redemande (`poserLoeil`, dans
   `redemande.ts`). Il est de type `button`, donc l'ancien sélecteur en
   trouvait deux et cliquait le PREMIER : l'œil. Le dialogue restait ouvert,
   « renoncer referme le dialogue » rougissait, et le modal arrêtait ensuite
   le clic sur « Effacer mon profil » — d'où la panne trente secondes plus
   loin, loin de sa cause.
*/
const renoncer = () =>
  page.locator('dialog[open] button', { hasText: 'Renoncer' }).first().click();

/* ══════════════════════════════════════════════════════════════════════════
   Première scène : l'effacement de tout le profil
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nL’EFFACEMENT DU PROFIL');

await page.goto(`${BASE}/profil/`, { waitUntil: 'networkidle' });

/*
   La prémisse : un profil qui porte au moins un champ. On le pose par l'écran
   lui-même — « Renseigner » sur le premier champ non rempli, dont la question
   passe par une invite du navigateur — et non par une écriture en base : un
   essai qui passe par la porte de service cesse de remarquer que la porte
   principale est cassée.

   Première version fausse, et elle mérite d'être dite : elle cochait
   « réduire les animations », en croyant à un champ de profil. C'est un
   réglage de localStorage. La prémisse était donc fausse, le profil restait
   vide, et « le profil est bien effacé » passait sur un profil qui n'avait
   jamais rien contenu. C'est la garde « le profil n'est pas vide » qui l'a
   signalé.
*/
/*
   L'ÉCRAN A CHANGÉ DE FORME, ET L'ESSAI SUIT. `#restants` — la liste séparée
   « Ce qui n'est pas renseigné » — n'existe plus : une branche du train a
   groupé les champs par bloc, et un champ vide reste À SA PLACE dans son bloc,
   marqué `data-vide`, avec son bouton « Renseigner ». Vérifié sur
   `origin/main`, où `#restants` existe encore, et ici, où il a disparu.

   On vise donc le premier champ vide et son bouton par ce qu'ils sont, et non
   par une liste qui n'est plus.
*/
await page.waitForSelector('[data-champ][data-vide] button', { timeout: 20000 });
await page
  .locator('[data-champ][data-vide] button', { hasText: 'Renseigner' })
  .first()
  .click();
/*
   LA SAISIE PASSE PAR UN CHAMP, PLUS PAR UN « PROMPT » (C2 du 43).

   « Renseigner » ouvrait un `prompt()` natif, que cet essai remplissait par
   « d.accept('Essai') ». Les deux `prompt()` du site sont devenus des champs
   dans la boîte commune, avec une étiquette visible et non un texte
   d'invite. L'essai ne remplissait donc plus rien : la prémisse « le profil
   n'est pas vide » tombait, et la boîte restée ouverte arrêtait le clic
   suivant sur « Effacer mon profil ».

   C'est exactement le défaut que cette garde a été écrite pour attraper,
   une première fois le 17 octobre : « le profil est bien effacé » peut
   passer sur un profil qui n'a jamais rien contenu.
*/
await repondreAuChamp(page, 'Essai', 'Enregistrer');
/*
   La carte renseignée perd son `data-vide` : c'est ce que la prémisse mesure
   trois lignes plus bas, donc c'est ce qu'on attend. Bornée, et son
   expiration laisse la prémisse rougir — ce qu'elle doit faire.
*/
await page
  .waitForFunction(
    () => document.querySelectorAll('[data-champ]:not([data-vide])').length > 0,
    undefined,
    { timeout: DELAI },
  )
  .catch(() => {});
/*
   « Le profil est vide » se COMPTE, maintenant qu'il n'y a plus de phrase à
   lire. L'ancienne version interrogeait `#aucun-champ`, la ligne « profil
   incomplet » que le même remaniement a retirée — et son `!e` rendait
   « vide » dès que l'élément manquait, c'est-à-dire TOUJOURS sur cet écran-là.
   La garde se serait donc tue au pire moment, sur la prémisse qu'elle existe
   pour protéger.

   Une carte remplie est un `[data-champ]` SANS `data-vide` : le profil est
   vide quand il n'en reste aucune. C'est une mesure, pas une lecture.
*/
const profilVide = () =>
  page.evaluate(
    () => document.querySelectorAll('[data-champ]:not([data-vide])').length === 0,
  );
verifier('prémisse : le profil n’est pas vide', await profilVide(), false);

await page.click('#effacer-profil');
await attendreLeDialogue(true);
verifier('le clic ouvre une redemande au lieu d’effacer', await dialogueOuvert(), true);
verifier('et rien n’a encore été effacé', await profilVide(), false);

await renoncer();
await attendreLeDialogue(false);
verifier('renoncer referme le dialogue', await dialogueOuvert(), false);
verifier('et n’efface rien', await profilVide(), false);

await page.click('#effacer-profil');
await attendreLeDialogue(true);
await repondre(`${MDP}-faux`);
verifier('un mot de passe faux laisse le dialogue ouvert', await dialogueOuvert(), true);
verifier('et n’efface rien', await profilVide(), false);
const refus = await page.textContent('dialog[open] [role="alert"]');
console.log(`      message du refus : ${refus}`);
verifier('le refus dit que rien n’a été fait', /Rien n’a été fait/.test(refus ?? ''), true);

await repondre(MDP);
/*
   L'EFFACEMENT SUIT LA FERMETURE, il ne l'accompagne pas : la boîte part, puis
   l'écran se repeint sans ses cartes. On attend donc que les cartes
   renseignées aient disparu — bornée, et son expiration laisse l'assertion
   rougir.
*/
await page
  .waitForFunction(
    () => document.querySelectorAll('[data-champ]:not([data-vide])').length === 0,
    undefined,
    { timeout: DELAI },
  )
  .catch(() => {});
verifier('le bon mot de passe referme le dialogue', await dialogueOuvert(), false);
verifier('et le profil est bien effacé', await profilVide(), true);

/* ══════════════════════════════════════════════════════════════════════════
   Deuxième scène : l'export en clair
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nL’EXPORT EN CLAIR');

await page.goto(`${BASE}/stockage/`, { waitUntil: 'networkidle' });
/* Les cases des domaines sont construites par le script de l'écran. */
await page
  .locator('input[name="groupe-export"]')
  .first()
  .waitFor({ state: 'attached', timeout: DELAI })
  .catch(() => {});
const domaines = await page.locator('input[name="groupe-export"]').count();
verifier('prémisse : il y a des domaines exportables', domaines > 0, true);
await page.locator('input[name="groupe-export"]').first().check();

await page.click('#exporter-csv');
await attendreLeDialogue(true);
verifier('l’export ouvre une redemande', await dialogueOuvert(), true);

/*
   Le vrai test : un mot de passe faux ne doit produire AUCUN fichier. On
   écoute les téléchargements pendant la tentative, et l'absence est ici la
   preuve — raison pour laquelle on vérifie juste après qu'un bon mot de passe,
   lui, en produit un. Sans cette seconde moitié, « aucun fichier » pourrait
   simplement vouloir dire que l'export est cassé.
*/
let fichiers = 0;
page.on('download', () => {
  fichiers += 1;
});
await repondre(`${MDP}-faux`);
verifier('un mot de passe faux ne produit aucun fichier', fichiers, 0);
verifier('et le dialogue reste ouvert', await dialogueOuvert(), true);

await renoncer();
/*
   « AUCUN FICHIER » EST UN INVARIANT NÉGATIF : il est vrai tout de suite, et
   le resterait si un fichier arrivait une seconde plus tard. On attend donc la
   post-condition du geste — l'écran qui dit ce qu'il n'a pas fait —, après
   quoi le compte a un sens.
*/
await page
  .waitForFunction(
    () => /Rien n’a été exporté/.test(document.getElementById('message-export')?.textContent ?? ''),
    undefined,
    { timeout: DELAI },
  )
  .catch(() => {});
verifier('renoncer ne produit aucun fichier non plus', fichiers, 0);
verifier(
  'et l’écran le dit',
  /Rien n’a été exporté/.test((await page.textContent('#message-export')) ?? ''),
  true,
);

await page.click('#exporter-csv');
await attendreLeDialogue(true);
await repondre(MDP);
/*
   LE TÉLÉCHARGEMENT SE COMPTE DANS NODE, pas dans la page : la
   post-condition n'est donc pas dans le DOM, et on interroge le compteur
   jusqu'à ce qu'il bouge — quatre secondes couvraient l'écriture du fichier,
   et rien ne garantissait qu'elles suffisent.
*/
const finDuFichier = Date.now() + DELAI;
while (fichiers === 0 && Date.now() < finDuFichier) await page.waitForTimeout(100);
verifier('le bon mot de passe produit bien un fichier', fichiers >= 1, true);

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
