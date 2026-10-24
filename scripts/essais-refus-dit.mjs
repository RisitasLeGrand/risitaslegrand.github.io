/**
 * Un mot de passe de coffre refusé doit être DIT, sur chacune des pages.
 *
 * ## Le défaut visé, trouvé en lisant deux écrans après coup
 *
 * `ouvrirLeCoffre` **rend** un message ; elle ne lève pas. Deux pages sur dix
 * l'appelaient dans un `try/catch` : le `catch` n'attrapait rien, et un mot
 * de passe faux ne disait rien du tout — l'écran restait fermé, sans un mot,
 * ce qui ressemble exactement à un bouton cassé.
 *
 * Aucun essai ne pouvait le voir, parce qu'aucun n'essayait de se tromper sur
 * ces pages-là. Celui-ci le fait sur les dix, et il le fera sur la onzième le
 * jour où elle existera — la liste est lue dans les sources, pas recopiée.
 *
 * ## La prémisse, qui compte autant que la mesure
 *
 * Il faut que le formulaire soit visible pour qu'il y ait quelque chose à
 * refuser. Une page qui ne l'affiche pas est signalée comme telle, et non
 * comptée pour verte.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
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

/* La liste se lit dans les sources : une liste recopiée rouille en silence. */
const dossier = path.resolve('src/pages/odyssee');
const chemins = [];
for (const nom of await readdir(dossier)) {
  if (!nom.endsWith('.astro')) continue;
  const source = await readFile(path.join(dossier, nom), 'utf8');
  if (source.includes('<FormulaireCoffre') || source.includes('id="mdp-coffre"')) {
    chemins.push(`/odyssee/${nom.replace(/\.astro$/, '')}/`);
  }
}

console.log('\nLA PRÉMISSE : DES PAGES À COFFRE, TROUVÉES DANS LES SOURCES');
console.log(`      ${chemins.length} page(s) : ${chemins.join(', ')}`);
verifier('il y en a bien plusieurs', chemins.length >= 5, true);

/*
   Le même chemin de repli que ses voisins. Sans lui, cet essai rougissait
   dès que CHROMIUM n'était pas posée dans l'environnement — un rouge qui ne
   dit rien du site, et qui fait douter des vrais.
*/
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const amorce = await ctx.newPage();
await franchirInitialisation(amorce, BASE, MDP);

/*
   LA SECONDE PRÉMISSE, et c'est elle qui manquait à la première version.

   Un coffre VIDE accepte n'importe quel mot de passe, délibérément : il n'a
   rien à perdre, et refuser empêcherait simplement de commencer. Sur un
   profil neuf, les dix pages ouvraient donc le coffre au premier essai et
   l'essai concluait « le refus n'est pas dit » — sur dix pages dont huit
   étaient saines. Il accusait à tort, faute d'avoir quelque chose à refuser.

   On ouvre donc le coffre une fois avec le BON mot de passe : l'application
   scelle alors son premier enregistrement, et il y a dès lors quelque chose
   à protéger.
*/
await amorce.goto(`${BASE}/odyssee/corps/`, { waitUntil: 'networkidle' });
await amorce.waitForTimeout(1500);
await amorce.fill('#mdp-coffre', MDP);
await amorce.click('#ouvrir-coffre');
await amorce.waitForTimeout(4000);
const scelles = await amorce.evaluate(
  () =>
    new Promise((res) => {
      const o = indexedDB.open('revinsp');
      o.onsuccess = () => {
        const b = o.result;
        const noms = [...b.objectStoreNames];
        if (!noms.length) return res(0);
        const t = b.transaction(noms, 'readonly');
        let restants = noms.length;
        let compte = 0;
        for (const n of noms) {
          const r = t.objectStore(n).getAll();
          r.onsuccess = () => {
            compte += r.result.filter((e) => e && typeof e === 'object' && e.scelle).length;
            if (--restants === 0) res(compte);
          };
          r.onerror = () => {
            if (--restants === 0) res(compte);
          };
        }
      };
      o.onerror = () => res(0);
    }),
);
console.log(`      enregistrements scellés : ${scelles}`);
verifier('prémisse : il y a du scellé, sinon le coffre accepte tout', scelles > 0, true);
await amorce.close();

console.log('\nSUR CHAQUE PAGE, UN MOT DE PASSE FAUX EST DIT');

const mesurees = [];
const nonMesurees = [];

for (const chemin of chemins) {
  /*
     Un onglet neuf par page : la clé du coffre survit dans le stockage de
     session, et une page ouverte après une réussite n'aurait plus de
     formulaire à montrer. Ici aucune ouverture ne réussit, mais l'onglet neuf
     garde l'essai indépendant de l'ordre des pages.
  */
  const page = await ctx.newPage();
  await page.goto(`${BASE}${chemin}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const champVisible = await page.evaluate(() => {
    const c = document.getElementById('mdp-coffre');
    return Boolean(c) && c.getBoundingClientRect().height > 0;
  });
  if (!champVisible) {
    /*
       Le formulaire n'est pas affiché, et ce n'est PAS forcément un défaut :
       « /odyssee/sante/ » le garde caché tant que le module n'a pas été
       activé, ce qui est un choix de cet écran. Compter cela pour un échec
       serait accuser à tort — et un contrôle qui accuse à tort se fait
       désactiver.

       On ne le compte donc pas pour vert non plus : la page passe dans la
       liste des NON MESURÉES, qui est affichée, et le nombre de pages
       réellement mesurées est vérifié plus bas.
    */
    nonMesurees.push(chemin);
    await page.close();
    continue;
  }
  mesurees.push(chemin);

  await page.fill('#mdp-coffre', `${MDP}-faux`);
  await page.click('#ouvrir-coffre');
  await page.waitForTimeout(5000);

  const dit = await page.evaluate(() => {
    const e = document.getElementById('erreur-coffre');
    if (!e) return null;
    return e.getBoundingClientRect().height > 0 ? (e.textContent ?? '').trim() : '';
  });
  verifier(`${chemin} — le refus est dit`, Boolean(dit && dit.length > 3), true);
  if (dit) console.log(`      « ${dit} »`);
  await page.close();
}

console.log('\nCE QUI A ÉTÉ MESURÉ, ET CE QUI NE L’A PAS ÉTÉ');
console.log(`      mesurées : ${mesurees.length} — ${mesurees.join(', ')}`);
console.log(
  `      non mesurées (formulaire non affiché sur cet écran) : ${nonMesurees.length}` +
    (nonMesurees.length ? ` — ${nonMesurees.join(', ')}` : ''),
);
verifier(
  'le contrôle a mesuré la grande majorité des pages à coffre',
  mesurees.length >= chemins.length - 1 && mesurees.length >= 5,
  true,
);

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
