/**
 * LE RACCORD ENTRE B-7 ET b-politique-schema, ÉPROUVÉ DE BOUT EN BOUT.
 *
 *   npm run essais:raccord-identite
 *
 * ## Ce que le raccord dit, et pourquoi il demandait une mesure
 *
 * Le constructeur a joint deux apports qui touchent la même ligne. B-7 décide
 * quelles clés d'`etat` viennent du fichier et lesquelles restent locales ;
 * b-politique-schema fait traverser les paliers aux données du fichier. Le
 * raccord fait DESCENDRE la décision d'identité après la migration, pour que
 * son côté « fichier » soit l'état MIGRÉ et non l'état brut.
 *
 * Le raisonnement est juste : trancher avant la migration aurait écrit un état
 * brut par-dessus l'état migré, et les deux apports se seraient annulés.
 *
 * **Mais il porte sur « etat », donc sur `coffre.sel`** — le sel du coffre,
 * qui est dans `TOUJOURS_DU_FICHIER`. Un sel perdu ou remplacé rend le coffre
 * restauré impossible à ouvrir avec le mot de passe du fichier, et rien, dans
 * le chemin, ne lèverait : on écrirait une base cohérente et inutilisable.
 *
 * ## Le point exact que cet essai éprouve
 *
 * Dans `service.ts`, la migration tourne BRANCHE PAR BRANCHE, et ne reçoit que
 * les magasins que la branche DÉCLARE :
 *
 *     for (const nom of branche.magasins ?? []) { … siens[nom] = magasins[nom]; }
 *     const migres = await migrerDesDonneesRestaurees(siens, branche.schema);
 *     magasins = { ...magasins, ...migres.magasins };
 *
 * Or `migrerDesDonneesRestaurees` ne garde d'`etat` que les clés que le
 * FICHIER portait — garde juste, contre l'identité inventée par le palier 12.
 * Mais si `etat` n'est PAS dans `branche.magasins`, ces clés sont lues dans un
 * `siens` qui n'en contient aucune : le filtre les vide toutes, et
 * `{ ...magasins, ...migres.magasins }` remplace l'`etat` du fichier par du
 * vide.
 *
 * Pour un fichier écrit par le code d'aujourd'hui, `etat` est bien déclaré —
 * vérifié : `branches: [{ …, magasins: [...emportes] }]`, et `etat` est dans
 * les magasins d'une sauvegarde. La question est donc celle d'un fichier dont
 * la branche ne le déclare pas, et c'est pourquoi l'essai forge les DEUX.
 *
 * ## Pourquoi un vrai fichier et un vrai navigateur
 *
 * `etatARestaurer` est pure et déjà éprouvée. Ce qui ne l'est pas, c'est le
 * CHEMIN : l'ordre entre la lecture locale, l'instantané, les paliers et la
 * décision. Il ne vit que dans l'exécution, et seul un fichier passé par
 * l'écran de restauration le parcourt en entier.
 */
import { writeFileSync } from 'node:fs';

import { chromium } from 'playwright-core';

import { ecrire } from '../src/lib/sauvegarde/format';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { annonceDe, devientVisible, travailFini } from './lib/post-condition.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP: string = motDePasseEssais();
const S = process.env.TMPDIR ?? '/tmp';

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)}`);
    console.log(`      attendu ${JSON.stringify(attendu)}`);
  }
};
const vrai = (titre: string, c: unknown) => v(titre, c, true);

const SEL_DU_FICHIER = 'SEL-VENU-DU-FICHIER-0001';
const SEL_LOCAL = 'SEL-DE-CET-APPAREIL-9999';

/**
 * Forge une sauvegarde d'une version antérieure, portant un sel connu.
 *
 * `declareEtat` dit si la branche ANNONCE le magasin « etat ». C'est la seule
 * différence entre les deux fichiers, et c'est l'objet de l'essai.
 */
async function forger(schema: number, declareEtat: boolean) {
  const magasins: Record<string, unknown[]> = {
    etat: [
      { clef: 'coffre.sel', valeur: SEL_DU_FICHIER },
      { clef: 'appareil', valeur: 'appareil-du-fichier' },
    ],
    /*
       UNE ENTRÉE DE RÉVISION SANS HORLOGE LOGIQUE, et c'est elle qui PROUVE que
       les paliers tournent.

       Le palier 14 donne une horloge aux entrées qui n'en ont pas, et il est
       gardé par « if (!entree.hlc) » : le faire tourner sur des données qui en
       portent déjà une ne les abîme pas. Après restauration, cette entrée doit
       donc porter une horloge que le fichier ne contenait pas — c'est la
       constatation que la migration a eu lieu.

       Sans elle, cet essai serait vert pour la pire des raisons : la boucle des
       paliers n'aurait pas tourné, le raccord n'aurait pas été parcouru, et le
       « sel vient du fichier » prouverait seulement qu'on n'a rien migré.
    */
    revisions: [{ id: 'rev-du-fichier', lot: 'lot-1' }],
  };
  const declares = declareEtat ? Object.keys(magasins) : Object.keys(magasins).filter((n) => n !== 'etat');
  const { octets } = await ecrire({
    magasins,
    branches: [{ id: 'revisions', schema, magasins: declares }],
    versionApplication: 'essai',
    portee: { branches: ['revisions'] },
    motDePasse: MDP,
  });
  return octets;
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1000, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));

/** L'horloge logique de l'entrée semée : absente du fichier, posée par le palier 14. */
const horlogeDeLEntree = () =>
  page.evaluate(async () => {
    const base: IDBDatabase = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const vu: unknown = await new Promise((ok) => {
      const q = base.transaction('revisions').objectStore('revisions').get('rev-du-fichier');
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return (vu as { hlc?: string } | undefined)?.hlc ?? null;
  });

/** Une clé d'« etat », lue dans la vraie base. */
const etatEnBase = (clef: string) =>
  page.evaluate(async (c) => {
    const base: IDBDatabase = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const vu: unknown = await new Promise((ok) => {
      const q = base.transaction('etat').objectStore('etat').get(c);
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return vu ?? null;
  }, clef);

/** Pose un sel LOCAL, distinct de celui du fichier, pour pouvoir les distinguer. */
const semerLeSelLocal = () =>
  page.evaluate(async (sel) => {
    const base: IDBDatabase = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    await new Promise<void>((ok, non) => {
      const t = base.transaction('etat', 'readwrite');
      t.objectStore('etat').put(sel, 'coffre.sel');
      t.oncomplete = () => ok();
      t.onerror = () => non(t.error);
    });
    base.close();
  }, SEL_LOCAL);

const allerAProgression = async () => {
  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await devientVisible(page, '#champ-mdp', false, { delai: 30000 });
  }
  await page.locator('#fichier-cyclades').waitFor({ state: 'visible', timeout: 30000 });
};

/**
 * Répond à la confirmation destructrice.
 *
 * ON ATTEND LA BOÎTE, ON NE LA TESTE PAS. Ma première version posait
 * « isVisible() » juste après le clic : la boîte n'était pas encore ouverte, la
 * réponse était « non », et « appliquer » sortait sur son garde — l'écran ne
 * disait donc rien, et les assertions accusaient le raccord, qui n'y était
 * pour rien. C'est le défaut que le chantier des temporisations corrige, et
 * l'essai voisin le documente déjà de la même façon.
 *
 * Et ce n'est pas une boîte du navigateur : c'est un « <dialog> » du site, donc
 * un bouton à cliquer et non un « dialog » de Playwright à accepter.
 */
const repondreALaConfirmation = async () => {
  const bouton = page.locator('dialog[open] button', { hasText: /^Remplacer$/ }).first();
  await bouton.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await bouton.isVisible().catch(() => false)) await bouton.click();
};

/** Passe un fichier par l'écran, dans le rôle voulu. */
async function restaurer(chemin: string, role: 'remplace' | 'ajoute') {
  await allerAProgression();
  await page.setInputFiles('#fichier-cyclades', chemin);
  await annonceDe(page, '#message-cyclades');
  const champ = page.locator('#mdp-restauration');
  if (await champ.isVisible().catch(() => false)) await champ.fill(MDP);
  const appliquer = page.locator('#appliquer-cyclades');
  await appliquer.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (!(await appliquer.isVisible().catch(() => false))) return false;
  await page.check(role === 'ajoute' ? '#role-ajoute' : '#role-remplace');
  await appliquer.click();
  await repondreALaConfirmation();
  await travailFini(page, '#message-cyclades');
  return true;
}

await franchirInitialisation(page, RACINE, MDP);
await allerAProgression();

const SOURCE_DB = (await import('node:fs')).readFileSync('src/lib/db.ts', 'utf8');
const TROUVE = /^export const VERSION = (\d+);$/m.exec(SOURCE_DB);
if (!TROUVE) {
  console.log('  \x1b[31m✗\x1b[0m NON MESURABLE — « export const VERSION » introuvable');
  await nav.close();
  process.exit(3);
}
const VERSION = Number(TROUVE[1]);
/*
   ON FORGE À 13, ET NON À « VERSION - 1 ».

   Ma première version forgeait à la version précédente : les paliers tournaient
   peut-être, mais rien d'OBSERVABLE n'en sortait, donc l'essai ne pouvait pas
   distinguer « le raccord est juste » de « la migration n'a pas eu lieu ».

   13 est le point que l'essai voisin a choisi, et pour une raison qu'il écrit :
   le palier 14 — l'horloge logique des révisions — est gardé par « if
   (!entree.hlc) », donc inoffensif à rejouer, et son effet se LIT. Forger plus
   ancien ferait rejouer le palier 12, qui dédoublerait des socles : l'essai
   prouverait alors surtout qu'on peut se faire du mal.
*/
const ANCIENNE = 13;
console.log(`\n  base courante : ${VERSION} ; fichier forgé à : ${ANCIENNE}\n`);

console.log('\x1b[1m1. LE CHEMIN NORMAL — « etat » déclaré par la branche\x1b[0m');
{
  const chemin = `${S}/raccord-etat-declare.cyclades`;
  writeFileSync(chemin, await forger(ANCIENNE, true));
  for (const role of ['remplace', 'ajoute'] as const) {
    await semerLeSelLocal();
    v('prémisse : le sel local est bien celui de cet appareil', await etatEnBase('coffre.sel'), SEL_LOCAL);
    const applique = await restaurer(chemin, role);
    vrai(`  rôle « ${role} » : la restauration s’est appliquée`, applique);
    /*
       LA PRÉMISSE QUI DONNE SON SENS À TOUT LE RESTE : les paliers ont tourné.
       Le fichier ne portait aucune horloge ; si l'entrée en a une, la migration
       a eu lieu et le raccord a bien été parcouru.
    */
    vrai(`  rôle « ${role} » : les paliers ont tourné (l’entrée a reçu une horloge)`,
      (await horlogeDeLEntree()) !== null);
    /*
       LA PROPRIÉTÉ QUI COMPTE, et elle ne dépend pas du rôle : « coffre.sel »
       est dans TOUJOURS_DU_FICHIER. Un coffre restauré avec le sel de
       l'ancien appareil ne s'ouvrirait pas avec le mot de passe du fichier.
    */
    v(`  rôle « ${role} » : le sel vient du FICHIER`, await etatEnBase('coffre.sel'), SEL_DU_FICHIER);
  }
}

console.log('\n\x1b[1m2. LA FRAGILITÉ, DÉMONTRÉE — « etat » absent de la branche\x1b[0m');
{
  /*
     Le fichier porte les mêmes données ; seule sa DÉCLARATION change. Si le
     raccord est solide, le sel du fichier arrive quand même ; s'il ne l'est
     pas, la migration rend un « etat » vide et le sel disparaît.
  */
  const chemin = `${S}/raccord-etat-non-declare.cyclades`;
  writeFileSync(chemin, await forger(ANCIENNE, false));
  await semerLeSelLocal();
  v('prémisse : le sel local est bien celui de cet appareil', await etatEnBase('coffre.sel'), SEL_LOCAL);
  const applique = await restaurer(chemin, 'remplace');
  vrai('  la restauration s’est appliquée', applique);
  vrai('  et les paliers ont tourné ici aussi', (await horlogeDeLEntree()) !== null);
  const apres = await etatEnBase('coffre.sel');
  console.log(`      sel en base après restauration : ${JSON.stringify(apres)}`);
  /*
     CE CONTRÔLE CONSTATE LE DÉFAUT, IL NE LE DÉPLORE PAS.

     Mesuré : le sel DISPARAÎT. La chaîne est celle-ci. La migration tourne
     branche par branche et ne reçoit que les magasins déclarés ; comme « etat »
     n'en est pas, « clefsDuFichier » est vide ; le filtre qui protège de
     l'identité inventée par le palier 12 vide alors « etat » en entier ; et
     « { ...magasins, ...migres.magasins } » écrit ce vide par-dessus l'état du
     fichier. L'identité tranche ensuite sur un côté « fichier » inexistant.

     Une base sans « coffre.sel » est un coffre qu'on ne peut plus ouvrir DU
     TOUT — pire que l'un ou l'autre des deux sels. Et rien ne lèverait : on
     écrit une base cohérente et inutilisable.

     **Ce cas n'est pas atteignable par un fichier de Cyclades**, et c'est la
     section 3 qui le garde. On l'affirme ici tel qu'il est mesuré, pour que le
     jour où quelqu'un rend ce chemin atteignable, la section 3 rougisse en
     nommant la cause plutôt que de laisser découvrir un coffre muet.
  */
  v('  le sel disparaît — la fragilité est bien là, et elle est nommée', apres, null);
}

console.log('\n\x1b[1m3. CE QUI REND LA FRAGILITÉ INATTEIGNABLE\x1b[0m');
{
  /*
     LA GARDE. La section 2 montre ce qui arrive si une branche ne déclare pas
     « etat ». Celle-ci vérifie que cela n'arrive pas, et c'est la seule des
     trois qui protège quelque chose.

     Les deux chemins qui écrivent un fichier sont couverts :
     — une sauvegarde déclare « magasins: [...emportes] », et « etat » est dans
       les magasins d'une sauvegarde, chiffrée ou non ;
     — un paquet de synchronisation écrit « branches: [] », donc la boucle des
       paliers ne tourne pas du tout et « etat » n'est jamais remplacé.

     Le contrôle porte sur le PREMIER, qui est celui qui peut changer. Il est
     pur : aucun navigateur, aucune base.
  */
  const { magasinsDUneSauvegarde, MAGASINS_SAUVEGARDES } = await import('../src/lib/db');
  vrai('« etat » est dans les magasins d’une sauvegarde chiffrée', magasinsDUneSauvegarde(true).includes('etat'));
  vrai('« etat » est dans ceux d’une sauvegarde NON chiffrée', magasinsDUneSauvegarde(false).includes('etat'));
  /*
     ET DANS LA LISTE QU'EMPLOYAIT LA DÉCLARATION D'AVANT, parce qu'un fichier
     déjà écrit par cette version-là doit rester restaurable : la déclaration
     est passée de « [...MAGASINS_SAUVEGARDES] » à « [...emportes] », et les
     deux doivent porter « etat ».
  */
  vrai('et dans « MAGASINS_SAUVEGARDES », qu’employait la déclaration d’avant',
    MAGASINS_SAUVEGARDES.includes('etat'));
}

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs ? 1 : 0);
