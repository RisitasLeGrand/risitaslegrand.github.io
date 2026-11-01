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
import { annonceDe, attendreLeCompte, devientVisible } from './lib/post-condition.mjs';

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

  /*
     LA CLAUSE DES RUBRIQUES, IMPRIMÉE : c'est elle que les trois contrôles
     suivants lisent, et la voir épargne de deviner ce qu'un « obtenu false »
     veut dire. On n'imprime pas la boîte entière — elle fait dix lignes — mais
     la phrase exacte dont il est question.
  */
  console.log(`      clause : ${/Dont [^.]*\./.exec(dit)?.[0] ?? '(absente)'}`);

  /*
     ── CE QUE CES DEUX MOTIFS EXIGEAIENT, ET POURQUOI ILS SONT TOMBÉS ──

     Ils attendaient « carte(s) suivie(s) » et « journée(s) de temps passé ».
     Mon propre lot B1 a remplacé ces formes par l'accord juste : la boîte dit
     maintenant « Dont 0 carte suivie, 0 quiz et 1 journée de temps passé ».
     Les deux contrôles rougissaient donc sur une phrase DEVENUE correcte —
     même famille que sauvegarde-confirmee et restauration-atomique, que le
     constructeur a corrigés sur main en 63a45aee.

     Les motifs acceptent maintenant les deux accords ET EXIGENT LE NOMBRE. Le
     nombre n'est pas une précaution de style : sans lui, « carte suivie »
     passerait, et ce que ces contrôles gardent est précisément qu'on ne
     propose pas un effacement sans dire COMBIEN. Une confirmation sans
     chiffre est ce qui a fait écraser Odyssée entière en croyant risquer
     trente et un enregistrements.
  */
  const MOTIF_CARTES = /\d+ cartes? suivies?/;
  const MOTIF_JOURNEES = /\d+ journées? de temps passé/;

  v('elle compte les cartes suivies', MOTIF_CARTES.test(dit), true);
  v('elle compte les quiz', /\d+ quiz/.test(dit), true);
  v('elle compte les journées de temps passé', MOTIF_JOURNEES.test(dit), true);

  /*
     ET LES MOTIFS SE GARDENT EUX-MÊMES, puisque c'est eux qui ont changé.

     Un sabotage joué une fois à la main prouve l'instant où on le joue ; ces
     quatre contrôles-ci restent. Ils disent que le motif accepte les deux
     accords — c'est ce qu'on a voulu — et qu'il ne passe NI sans nombre NI sur
     du vide, c'est-à-dire qu'il n'a pas été assoupli en le corrigeant.
  */
  v('le motif des cartes accepte le singulier', MOTIF_CARTES.test('0 carte suivie'), true);
  v('et le pluriel', MOTIF_CARTES.test('3 cartes suivies'), true);
  v('mais il ne passe pas sans le nombre', MOTIF_CARTES.test('carte suivie'), false);
  v('ni sur une phrase vide', MOTIF_CARTES.test(''), false);
  v(
    'et celui des journées ne passe pas non plus sans le nombre',
    [MOTIF_JOURNEES.test('1 journée de temps passé'), MOTIF_JOURNEES.test('journée de temps passé')],
    [true, false],
  );
  /*
     ET LA FORME PARENTHÉSÉE NE DOIT PAS REPARAÎTRE. Les deux motifs ci-dessus
     l'accepteraient — « 0 carte(s) suivie(s) » contient « 0 carte » — donc
     sans ce contrôle, un retour en arrière passerait inaperçu. Il attache
     l'essai à la RÈGLE du lot 9 plutôt qu'à un littéral.
  */
  v('et aucune forme parenthésée ne reparaît dans la boîte', /\(s\)/.test(dit), false);
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
  /*
     LE TÉMOIN EST POSITIF, ET C'EST UNE DISJONCTION. Cet écran a deux
     entrées : `#allegee` et son bouton « Commencer » quand l'installation
     porte déjà de l'usage, sinon `#parcours` et sa première question
     directement. Les deux branches qui suivaient lisaient chacune leur
     visibilité avec `.catch(() => false)`, derrière une attente aveugle de
     800 ms. Cette tolérance ne rend pas l'essai rouge quand l'attente est
     trop courte : elle le fait mesurer AUTRE CHOSE. Le prénom n'est pas
     renseigné, la boîte répond — à juste titre — « Aucun champ n'est
     renseigné », et c'est exactement le faux rouge que le commentaire
     ci-dessus raconte. Une attente aveugle devant une lecture tolérante au
     négatif ne risque pas un rouge : elle risque un vert sur le mauvais cas.

     On attend donc que l'une des deux entrées soit peinte. L'attente décrit
     un changement — l'écran affichait « Préparation… » — et les branches qui
     suivent ne choisissent plus dans le vide. Après quoi `#saisie-prenom`
     est acquis dans les deux chemins : le remplissage n'a plus à se
     protéger, et s'il échoue un jour il le dira au lieu de se taire.

     Les options de `waitForFunction` sont le TROISIÈME argument ; le second
     est la valeur passée à la fonction. Écrites au second, elles sont
     ignorées sans bruit et le délai n'existe pas.

     ET AUCUNE FONCTION NOMMÉE NE TRAVERSE CETTE FRONTIÈRE. J'avais d'abord
     écrit un `const peint = (id: string) => …` à l'intérieur du corps : le
     transpileur de ce dépôt conserve les noms et enveloppe donc la fonction
     dans un `__name(…)` qui n'existe que côté Node. Le navigateur a répondu
     « __name is not defined » et l'essai est tombé en panne — pas en rouge,
     en panne, ce qui est au moins franc. Une lambda anonyme passée en
     argument n'est pas nommée, donc rien ne l'enveloppe. Les deux constantes
     voisines de `essais-initialisation-sans-defaut.mts` échappent au piège
     autrement : ce sont des chaînes gabarit, que le transpileur ne lit pas.
  */
  await page.waitForFunction(
    () =>
      ['commencer', 'saisie-prenom'].some((id) => {
        const e = document.getElementById(id);
        return !!e && e.getClientRects().length > 0;
      }),
    undefined,
    { timeout: 30000 },
  );
  if (await page.locator('#commencer').isVisible().catch(() => false)) {
    await page.click('#commencer');
    await devientVisible(page, '#saisie-prenom', true, { delai: 30000 });
  }
  await page.fill('#saisie-prenom', 'Essai');
  await page.click('#valider');

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

  /*
     L'AIDE EST ARRIVÉE. J'avais laissé cette attente marquée, en disant que
     `annonceDe` existait deux fois dans le dépôt et qu'en recopier une
     troisième serait la faute que ce chantier corrige. A l'a promue dans
     `lib/post-condition.mjs` ; elle est ici.

     Mais elle attend une zone NON VIDE, et cet écran a déjà parlé plus haut.
     On efface donc la zone soi-même, sinon l'annonce d'avant rendrait
     l'attente vraie d'avance — la parade du § 3, pour la troisième fois de
     ce lot.

     ET L'EFFACEMENT PASSE AVANT LE CLIC. Ma première version le plaçait
     après, en se justifiant ainsi : « le message qu'on attend est celui que
     ce clic provoque ». La phrase est vraie et la conclusion fausse. Le
     gestionnaire écrit sa réponse sans me demander mon tour : s'il a déjà
     écrit quand mon `evaluate` arrive, j'effleure la réponse même que
     j'attends ensuite, et l'attente ne voit plus rien venir. C'est le rouge
     que j'ai constaté. L'ordre de la parade — effacer, agir, attendre — n'est
     pas une présentation : c'est la seule séquence où la fenêtre entre
     l'effacement et l'écriture ne m'appartient pas.
  */
  await page.evaluate(() => {
    const e = document.getElementById('message-effacement');
    if (e) e.textContent = '';
  });
  /* La boîte de redemande dit « Renoncer », pas « Annuler ». */
  const annuler2 = visible.locator('button', { hasText: /Renoncer|Annuler|Fermer/ }).first();
  if (await annuler2.count()) await annuler2.click();
  await annonceDe(page, '#message-effacement');
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
