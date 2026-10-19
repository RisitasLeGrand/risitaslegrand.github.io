/**
 * Le coffre refuse-t-il encore un mauvais mot de passe ?
 *
 * ## Pourquoi cet essai existe, et pourquoi maintenant
 *
 * Le coffre se vérifiait par une empreinte SHA-256 **sans sel** du mot de
 * passe du site, publiée dans le paquet. C'était sa SEULE vérification. Elle
 * est partie (prompt 44, point 1), remplacée par l'ouverture d'un
 * enregistrement scellé réel : si la clé dérivée ouvre une donnée existante,
 * c'est la bonne clé.
 *
 * Remplacer la seule barrière d'un coffre demande de prouver que la nouvelle
 * refuse, pas seulement qu'elle laisse passer. Les batteries existantes
 * ouvraient le coffre avec le BON mot de passe : elles étaient vertes avant
 * le changement et le sont restées, donc elles ne prouvent rien ici.
 *
 * « Un contrôle se valide sur le défaut qu'il vise, pas sur le code sain. »
 *
 * ## La prémisse, et elle n'est pas gratuite
 *
 * Il faut des données scellées pour qu'il y ait quelque chose à refuser. Un
 * coffre vide accepte n'importe quel mot de passe, délibérément : il n'a rien
 * à perdre, et refuser empêcherait simplement de commencer. L'essai écrit
 * donc d'abord une donnée, et vérifie qu'il l'a bien écrite.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const BASE = 'http://localhost:4321';
const MDP = process.env.SITE_PASSWORD;
if (!MDP) {
  console.error('SITE_PASSWORD manquant.');
  process.exit(1);
}

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
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
let page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

/** Le champ du coffre est-il visible ? Visible = coffre fermé. */
const ferme = () =>
  page.evaluate(() => {
    const c = document.getElementById('mdp-coffre');
    return Boolean(c) && c.getBoundingClientRect().height > 0;
  });

/**
 * Un onglet neuf sur la même base.
 *
 * Recharger ne suffit PAS : la clé du coffre survit dans le stockage de
 * session, et le coffre reste ouvert — l'essai croyait l'avoir refermé et
 * tentait de saisir un mot de passe dans un champ invisible. Un onglet neuf
 * a une session vierge et la même IndexedDB : coffre fermé, données
 * présentes. C'est exactement la situation qu'on veut éprouver.
 */
const ongletNeuf = async () => {
  await page.close();
  page = await ctx.newPage();
  await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
};

const saisir = async (motDePasse) => {
  await page.fill('#mdp-coffre', motDePasse);
  await page.click('#ouvrir-coffre');
  await page.waitForTimeout(2500);
};

console.log('\nLA PRÉMISSE : DU CONTENU SCELLÉ, SANS QUOI IL N’Y A RIEN À REFUSER');

await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
verifier('au départ, le coffre est fermé', await ferme(), true);
await saisir(MDP);
verifier('le bon mot de passe l’ouvre', await ferme(), false);

/*
   On ne fabrique pas de donnée : l'application en a déjà scellé une en
   ouvrant le coffre — le centre de notifications écrit son premier élément.
   C'est un meilleur témoin qu'un enregistrement forgé par l'essai, parce
   qu'il a été écrit par le chemin normal.

   Une première version tentait d'importer « /src/.../donnees-sensible.ts »
   dans la page : impossible contre un site CONSTRUIT, où les .ts n'existent
   plus. Elle échouait sans rien prouver.
*/
const scelles = await page.evaluate(
  () =>
    new Promise((res) => {
      const o = indexedDB.open('revinsp');
      o.onsuccess = () => {
        const b = o.result;
        /*
           TOUS les magasins, et c'est le correctif : une première version ne
           regardait que ceux dont le nom commence par « odyssee », et
           annonçait « 0 scellé » alors que « centreElements » en portait un.
           La prémisse paraissait fausse pendant que les refus étaient vrais —
           un essai qui se contredit ne prouve rien tant qu'on ne sait pas
           lequel des deux a tort.
        */
        const noms = [...b.objectStoreNames];
        const t = b.transaction(noms, 'readonly');
        const trouve = {};
        let restants = noms.length;
        for (const n of noms) {
          const r = t.objectStore(n).getAll();
          r.onsuccess = () => {
            const c = r.result.filter((e) => e && typeof e === 'object' && e.scelle).length;
            if (c > 0) trouve[n] = c;
            if (--restants === 0) res(trouve);
          };
          r.onerror = () => {
            if (--restants === 0) res(trouve);
          };
        }
      };
      o.onerror = () => res({});
    }),
);
console.log(`      scellés par magasin : ${JSON.stringify(scelles)}`);
verifier(
  'il y a bien du scellé à protéger, sinon le coffre accepterait tout',
  Object.values(scelles).reduce((a, b) => a + b, 0) > 0,
  true,
);

console.log('\nLE REFUS : UN MAUVAIS MOT DE PASSE N’OUVRE PAS');

await ongletNeuf();
verifier('dans un onglet neuf, le coffre est fermé', await ferme(), true);

await saisir(`${MDP}-faux`);
verifier('un mot de passe faux ne l’ouvre pas', await ferme(), true);
await saisir(MDP.toLowerCase() === MDP ? `${MDP}X` : MDP.toLowerCase());
verifier('une variante de casse non plus', await ferme(), true);

console.log('\nET LE BON OUVRE TOUJOURS, APRÈS LES REFUS');

await saisir(MDP);
verifier('le bon mot de passe ouvre encore', await ferme(), false);

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
