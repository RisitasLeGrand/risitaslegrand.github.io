/**
 * Le verrou automatique ferme-t-il vraiment le coffre, dans une vraie page ?
 *
 * L'essai de module dit que la décision est juste. Celui-ci dit qu'elle est
 * **branchée** : qu'un écouteur existe, qu'il tourne, et qu'au bout du délai
 * le coffre se referme pour de bon. Une sonde textuelle prouverait que le
 * module est cité ; elle ne prouverait jamais qu'il agit.
 *
 * Le délai réel est de quinze minutes. On ne l'attend pas : on règle un délai
 * très court pour cet essai, par le même chemin que l'écran de réglages
 * utilisera. Attendre quinze minutes aurait fait un essai que personne ne
 * lance.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

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

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

/** Ouvre le coffre sur une page qui en a besoin. */
const ouvrirLeCoffre = async (p) => {
  await p.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  if (await p.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await p.fill('#mdp-coffre', MDP);
    await p.click('#ouvrir-coffre');
    await p.waitForTimeout(1500);
  }
  return p.evaluate(() => {
    /*
       La VISIBILITÉ, pas la présence. Le bouton du cadenas existe dans le
       document même coffre fermé : une première version de cet essai lisait
       sa présence et voyait un coffre ouvert en permanence — y compris après
       une fermeture réussie, ce qui faisait échouer l'essai sur un indicateur
       faux plutôt que sur un défaut.

       On lit donc l'écran de saisie du coffre, qui est l'indicateur sans
       ambiguïté : visible, le coffre est fermé.
    */
    const champ = document.getElementById('mdp-coffre');
    const visible = (e) => Boolean(e) && e.getBoundingClientRect().height > 0;
    return !visible(champ);
  });
};

console.log('\nLE COFFRE S’OUVRE — LA PRÉMISSE, POSÉE ET NON DEVINÉE');

verifier('le coffre est ouvert', await ouvrirLeCoffre(page), true);

console.log('\nLE DÉLAI SE RÈGLE, ET IL EST RELU AU CHARGEMENT');

{
  /*
     On écrit dans le magasin « etat » de la base réelle, exactement là où
     l'écran de réglages écrira. Forcer la valeur en mémoire ne prouverait
     pas qu'elle survit à un rechargement, ce qui est tout son objet.

     Le nom de la base se lit dans `db.ts` : « revinsp ». Une première
     version de cet essai ouvrait « cyclades », ce qui CRÉE une base vide
     sans magasins au lieu d'échouer — le genre de prémisse fausse qui fait
     échouer un essai sur autre chose que ce qu'il vise.
  */
  const ecrit = await page.evaluate(
    () =>
      new Promise((res) => {
        const ouvrir = indexedDB.open('revinsp');
        ouvrir.onsuccess = () => {
          const b = ouvrir.result;
          if (!b.objectStoreNames.contains('etat')) {
            res(`magasins : ${[...b.objectStoreNames].slice(0, 5).join(', ')}`);
            return;
          }
          const t = b.transaction('etat', 'readwrite');
          t.objectStore('etat').put(3000, 'coffre.verrou-automatique.delai');
          t.oncomplete = () => res('ecrit');
          t.onerror = () => res(`erreur : ${t.error?.message}`);
        };
        ouvrir.onerror = () => res(`ouverture refusée : ${ouvrir.error?.message}`);
      }),
  );
  verifier('le délai s’écrit dans le magasin « etat »', ecrit, 'ecrit');
}

console.log('\nAU BOUT DU DÉLAI, LE COFFRE SE REFERME POUR DE BON');

{
  // Rechargement : c'est au chargement que le délai est relu et le verrou posé.
  await page.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  const visible = () =>
    page.evaluate(() => {
      const champ = document.getElementById('mdp-coffre');
      return Boolean(champ) && champ.getBoundingClientRect().height > 0;
    });
  const ouvertAvant = !(await visible());
  verifier('le coffre est encore ouvert après le rechargement', ouvertAvant, true);

  /*
     Trois secondes de délai, et le minuteur bat toutes les trente secondes :
     on ne peut donc pas se contenter d'attendre. On provoque le contrôle par
     un retour d'onglet, qui est précisément le déclencheur qui compte — celui
     qui rattrape une machine sortie de veille.
  */
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);

  verifier('quatre secondes sans geste, et le coffre est refermé', await visible(), true);
}

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
