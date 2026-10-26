/**
 * Un effacement dit ce qu'il efface (A7 du prompt 43).
 *
 *   npm run essais:effacements-dits
 *
 * ## Le défaut, et ce qui avait déjà été fait avant
 *
 * Les deux effacements nommaient déjà des CATÉGORIES — « les séances, les
 * révisions, les notes, les mesures », « tous les champs du profil » — et
 * c'était déjà mieux que les deux `confirm()` enchaînés d'avant, où la touche
 * Entrée validait les deux.
 *
 * Mais « les révisions » ne dit pas s'il y en a trois ou trois mille, et
 * « tous les champs » ne dit pas s'il y en a deux ou trente. **C'est le
 * nombre qui permet de mesurer ce qu'on s'apprête à perdre**, et il n'était
 * donné qu'APRÈS — « 14 champ(s) supprimé(s) » — c'est-à-dire au moment où il
 * ne sert plus à décider.
 *
 * ## Ce que cet essai mesure
 *
 * Le TEXTE DU CHOIX, et rien d'autre : chaque boîte est ouverte, lue, puis
 * annulée. Rien n'est effacé. Un essai qui confirmerait mesurerait l'effet,
 * pas la phrase — et il ne resterait rien à mesurer ensuite.
 */
import { chromium, type Page } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { attendreLeCompte, devientVisible } from './lib/post-condition.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
process.on('uncaughtException', (e: unknown) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

const deverrouiller = async (page: Page) => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    /* Le départ du champ est la post-condition du déverrouillage. */
    await devientVisible(page, '#champ-mdp', false, { delai: 30000 });
  }
};

/* ── 1. « Tout effacer » sur la progression ─────────────────────────────── */

console.log('\n\x1b[1mEFFACER SA PROGRESSION : AVEC DES NOMBRES\x1b[0m\n');

{
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#reinitialiser', { timeout: 30000 });

  /*
     DEUX ENREGISTREMENTS D'ODYSSÉE, SEMÉS À LA MAIN.

     Sans eux, la rubrique serait vide, la boîte la tairait — à juste titre —
     et l'essai mesurerait le cas qui ne prouve rien. Les écrire par l'écran
     demanderait une tâche, une occurrence et un jour logique : ce n'est pas
     ce qu'on éprouve ici, qui est le TEXTE du choix.
  */
  await page.evaluate(async () => {
    const base = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    await new Promise<void>((ok, ko) => {
      const tx = base.transaction('odysseeTaches', 'readwrite');
      tx.objectStore('odysseeTaches').put({ id: 'G5-A', titre: 'Essai G-5 A' });
      tx.objectStore('odysseeTaches').put({ id: 'G5-B', titre: 'Essai G-5 B' });
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
  });

  /*
     Le chapeau est lu sur la SECTION, et non sur le parent immédiat du
     bouton. A7 du 58 a mis deux boutons côte à côte — « Tout effacer sur cet
     appareil » et « Délier cet appareil » —, donc le parent immédiat est
     maintenant leur rangée, qui ne porte aucun texte. Viser la section dit
     ce que ce contrôle veut dire : la phrase d'annonce est quelque part
     au-dessus du bouton, pas collée à lui.
  */
  v(
    'le chapeau de la section annonce que le détail viendra',
    /nombres/.test(
      (await page.locator('#reinitialiser').locator('xpath=ancestor::section[1]').textContent()) ??
        '',
    ),
    true,
  );

  await page.click('#reinitialiser');
  const parue = await devientVisible(page, 'dialog.boite', true);
  const boite = page.locator('dialog.boite');
  v('la confirmation s’ouvre', parue, true);
  const dit = (parue ? ((await boite.textContent()) ?? '') : '').replace(/\s+/g, ' ');

  v('elle compte les cartes suivies', /\d+ carte\(s\) suivie\(s\)/.test(dit), true);
  v('elle compte les quiz', /\d+ quiz/.test(dit), true);
  v('elle compte les journées de temps passé', /\d+ journée\(s\) de temps passé/.test(dit), true);
  v('elle dit ce qui reste', /Restent : les fiches du site/.test(dit), true);
  /*
     La base d'essai n'a jamais confirmé de sauvegarde : l'avertissement doit
     paraître. C'est le cas qui compte le plus — effacer sans filet.
  */
  v(
    'et, sans sauvegarde confirmée, elle avertit que rien n’existe ailleurs',
    /aucune sauvegarde n’a jamais été confirmée/.test(dit),
    true,
  );
  /*
     G-5 ET G-6 DU 58 — LES RUBRIQUES, ET PAS SEULEMENT TROIS MAGASINS.

     La somme d'avant valait `cartes + quiz + jours`. Odyssée — quarante-quatre
     magasins — n'y était pas, non plus que Santé, Finances ni le profil. Deux
     enregistrements d'Odyssée ont été semés plus haut : la boîte doit les
     compter, et les nommer sous le libellé du groupe.
  */
  v('elle nomme la rubrique Odyssée', /Odyssée \d+/.test(dit), true);
  /*
     LE NOMBRE EST DÉRIVÉ, JAMAIS FIGÉ. Première version : j'attendais
     « Odyssée 2 », pour les deux tâches semées. La boîte dit 3 — une clé
     d'`etat` appartient aussi à Odyssée. L'essai avait tort, pas l'écran.
     Ce qui compte est donc : la rubrique est comptée, elle inclut au moins
     ce qu'on a semé, et le total s'accorde avec la somme des rubriques.
  */
  const odyssee = Number(/Odyssée (\d+)/.exec(dit)?.[1] ?? 0);
  v('elle compte au moins les deux enregistrements semés', odyssee >= 2, true);
  const rubriques = [...dit.matchAll(/([A-ZÉÀ][^,:.]*?) (\d+)(?=,| —)/g)].map((m) =>
    Number(m[2]),
  );
  const total = Number(/soit ([\d\u202f ]+) enregistrement/.exec(dit)?.[1]?.replace(/\D/g, '') ?? -1);
  v(
    'et le total s’accorde avec la somme des rubriques nommées',
    total,
    rubriques.reduce((a, b) => a + b, 0),
  );
  v('elle dit que c’est irréversible', /irréversible/.test(dit), true);

  const annuler = boite.locator('button', { hasText: /Annuler|Non|Fermer/ }).first();
  if (await annuler.count()) await annuler.click();
  /*
     UNE ASSERTION DE NON-VISIBILITÉ est la plus traîtresse : lue trop tôt, elle
     est vraie par hasard. On attend donc la disparition, bornée, et son
     expiration devient le rouge.
  */
  v('on en sort sans rien effacer', await devientVisible(page, 'dialog.boite', false), true);
  await ctx.close();
}

/* ── 2. « Supprimer tout le profil » ────────────────────────────────────── */

console.log('\n\x1b[1mEFFACER SON PROFIL : AVEC LES NOMS DES CHAMPS\x1b[0m\n');

{
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);

  /*
     UN CHAMP AU MOINS DOIT ÊTRE RENSEIGNÉ, sinon la boîte dirait — à juste
     titre — qu'il n'y a rien à effacer, et l'essai mesurerait le cas vide.
     Première version de cet essai : elle se contentait de `franchirInitialisation`,
     qui clique « Terminer maintenant » sans rien répondre. Le profil restait
     vide, la boîte disait « Aucun champ n'est renseigné », et deux assertions
     tombaient. C'est l'essai qui avait tort, pas l'écran.

     On répond donc à la première question, la seule obligatoire : le prénom.
  */
  await page.goto(`${RACINE}/initialisation/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForTimeout(800);
  if (await page.locator('#commencer').isVisible().catch(() => false)) {
    await page.click('#commencer');
    await page.waitForTimeout(400);
  }
  if (await page.locator('#saisie-prenom').isVisible().catch(() => false)) {
    await page.fill('#saisie-prenom', 'Essai');
    await page.click('#valider');
    await page.waitForTimeout(600);
  }

  await page.goto(`${RACINE}/profil/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#effacer-profil', { timeout: 30000 });

  await page.click('#effacer-profil');
  await attendreLeCompte(page, 'dialog', 1);
  const dialogues = page.locator('dialog');
  const combien = await dialogues.count();
  v('une boîte s’ouvre', combien > 0, true);
  const visible = dialogues.filter({ has: page.locator(':scope') }).last();
  const dit = (combien ? ((await visible.textContent()) ?? '') : '').replace(/\s+/g, ' ');

  v('elle compte les champs renseignés', /\d+ champ/.test(dit), true);
  v('elle en nomme au moins un', /dont /.test(dit), true);
  v(
    'elle dit que l’effacement part vers les autres appareils',
    /autres appareils à la prochaine/.test(dit),
    true,
  );
  v(
    'et que les révisions, le sport et Odyssée ne sont pas touchés',
    /ne sont pas touchées/.test(dit),
    true,
  );
  v('elle redemande le mot de passe', /mot de passe/i.test(dit), true);

  /* La boîte de redemande dit « Renoncer », pas « Annuler ». */
  const annuler2 = visible.locator('button', { hasText: /Renoncer|Annuler|Fermer/ }).first();
  if (await annuler2.count()) await annuler2.click();
  /*
     CELLE-CI ATTEND L'AIDE PARTAGÉE. La post-condition est « l'annonce est
     écrite » — non vide —, et cette aide existe déjà DEUX fois dans le dépôt :
     `annonceDe` dans « essais-effacement-navigateur », et sa jumelle que j'ai
     écrite par mégarde dans « essais-sauvegarde-cyclades ». La promouvoir dans
     `lib/post-condition.mjs` revient à A, qui tient ce module ; en recopier une
     troisième serait la faute que ce chantier corrige.
  */
  await page.waitForTimeout(600);
  const message = (await page.locator('#message-effacement').textContent()) ?? '';
  v('et un abandon le dit', /Rien n’a été supprimé/.test(message), true);
  await ctx.close();
}

await nav.close();
console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m\n'
    : `\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m\n`,
);
process.exit(rouges === 0 ? 0 : 1);
