/**
 * Psyché, en navigateur : le coffre, l'absence, et ce qui ne s'affiche pas.
 *
 * Ce que cet essai couvre, et qui ne s'éprouve pas hors navigateur :
 *
 * - **les ressources sont lisibles coffre fermé.** C'est la garantie qui
 *   compte le plus : quelqu'un qui a besoin du 3114 ne doit pas avoir à
 *   retrouver un mot de passe ;
 * - **une glissière non cochée ne vaut pas 5.** Le curseur est au milieu par
 *   construction ; seule la case « noter » décide qu'il y a une valeur ;
 * - **la charge perçue se forme sous les yeux**, et elle disparaît quand on
 *   décoche ce qui la nourrit ;
 * - **l'écart annonce ce qui manque**, chiffré, plutôt que « pas assez de
 *   données » ;
 * - **le réenregistrement corrige** au lieu d'empiler : l'identifiant est le
 *   jour.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};
const vrai = (titre, c) => v(titre, c, true);
const faux = (titre, c) => v(titre, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

await franchirInitialisation(page, RACINE, MDP);

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

console.log('\nL’ÉCRAN EXISTE, ET L’ONGLET Y MÈNE');

await aller('/odyssee/corps/', '#vue');
vrai(
  'un onglet « Psyché » est proposé depuis une autre page d’Odyssée',
  await page.locator('a[href$="/odyssee/psyche/"]').first().isVisible(),
);

await aller('/odyssee/psyche/', '#vue');

console.log('\nCOFFRE FERMÉ : LES RESSOURCES SONT LÀ, LE RESTE NON');

{
  vrai('le coffre est annoncé fermé', await page.locator('#coffre-ferme').isVisible());
  faux('et rien de la psyché ne s’affiche', await page.locator('#coffre-ouvert').isVisible());

  /*
     Le point central de cet essai. Si cette ligne tombe un jour, c'est que
     quelqu'un a rangé les ressources dans la partie protégée « par cohérence ».
  */
  vrai('les ressources restent lisibles', await page.locator('#ressources').isVisible());
  const numeros = await page.$$eval('#ressources [data-ressource]', (els) =>
    els.map((e) => e.dataset.ressource),
  );
  v('les trois numéros, coffre fermé', numeros, ['3114', '15', '112']);
  vrai(
    'et le 3114 est composable d’un geste',
    await page.locator('a[href="tel:3114"]').isVisible(),
  );
}

console.log('\nOUVERTURE DU COFFRE');

await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
await page.waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 20000 });

{
  v('le champ de mot de passe est vidé', await page.inputValue('#mdp-coffre'), '');
  v('rien de noté aujourd’hui', (await page.textContent('#etat-checkin')).trim(), 'Rien de noté aujourd’hui.');
}

console.log('\nUNE GLISSIÈRE NON COCHÉE N’EST PAS UN 5');

{
  const etats = await page.$$eval('#glissieres [data-dimension]', (els) =>
    els.map((e) => ({
      dimension: e.dataset.dimension,
      affiche: e.querySelector('output').textContent.trim(),
      desactivee: e.querySelector('input[type="range"]').disabled,
      cochee: e.querySelector('input[type="checkbox"]').checked,
    })),
  );
  v('quatre dimensions', etats.length, 4);
  vrai('toutes annoncent « non renseigné »', etats.every((e) => e.affiche === 'non renseigné'));
  vrai('toutes les glissières sont désactivées', etats.every((e) => e.desactivee));
  vrai('et aucune case n’est cochée', etats.every((e) => !e.cochee));
  v(
    'la charge perçue dit ce qui lui manque',
    (await page.textContent('#charge')).includes('énergie ou du stress'),
    true,
  );
}

console.log('\nLA CHARGE PERÇUE SE FORME, PUIS SE DÉFAIT');

{
  await page.check('input[data-active="energie"]');
  await page.fill('input[data-glissiere="energie"]', '2');
  await page.dispatchEvent('input[data-glissiere="energie"]', 'input');
  await page.check('input[data-active="stress"]');
  await page.fill('input[data-glissiere="stress"]', '8');
  await page.dispatchEvent('input[data-glissiere="stress"]', 'input');

  vrai(
    'énergie 2 et stress 8 donnent 8 sur 10',
    (await page.textContent('#charge')).includes('8 / 10'),
  );
  vrai(
    'et l’écran dit que c’est la seule chose que Sport lira',
    (await page.textContent('#charge')).includes('Sport'),
  );

  await page.uncheck('input[data-active="energie"]');
  await page.uncheck('input[data-active="stress"]');
  vrai(
    'décochées, la charge redevient indisponible',
    (await page.textContent('#charge')).includes('énergie ou du stress'),
  );
  await page.check('input[data-active="energie"]');
  await page.check('input[data-active="stress"]');
}

console.log('\nENREGISTRER, PUIS CORRIGER');

{
  await page.check('input[data-active="humeur"]');
  await page.fill('input[data-glissiere="humeur"]', '6');
  await page.dispatchEvent('input[data-glissiere="humeur"]', 'input');
  await page.fill('#note', 'Première version.');
  await page.click('#enregistrer');
  await page.waitForTimeout(1500);

  faux('aucune erreur', await page.locator('#erreur').isVisible());
  vrai('l’écran dit l’heure du check-in', (await page.textContent('#etat-checkin')).includes('Noté à'));
  vrai(
    'et prévient qu’un second enregistrement corrige',
    (await page.textContent('#etat-checkin')).includes('n’ajoute pas'),
  );
  v('la note est relue', await page.inputValue('#note'), 'Première version.');
  v('l’humeur est relue', (await page.textContent('#val-humeur')).trim(), '6 / 10');

  // On corrige : même jour, donc même enregistrement.
  await page.fill('input[data-glissiere="humeur"]', '9');
  await page.dispatchEvent('input[data-glissiere="humeur"]', 'input');
  await page.fill('#note', 'Seconde version.');
  await page.click('#enregistrer');
  await page.waitForTimeout(1500);
  v('la correction a pris', (await page.textContent('#val-humeur')).trim(), '9 / 10');

  const combien = await page.evaluate(
    () =>
      new Promise((resoudre) => {
        const d = indexedDB.open('revinsp');
        d.onsuccess = () => {
          const compte = d.result.transaction('odysseeCheckins').objectStore('odysseeCheckins').count();
          compte.onsuccess = () => resoudre(compte.result);
        };
      }),
  );
  v('un seul enregistrement pour aujourd’hui, pas deux', combien, 1);
}

console.log('\nL’ÉCART ANNONCE CE QUI MANQUE, CHIFFRÉ');

{
  const ecarts = await page.$$eval('#ecarts [data-ecart]', (els) =>
    els.map((e) => ({ dimension: e.dataset.ecart, texte: e.querySelector('dd').textContent.trim() })),
  );
  v('un bloc par dimension', ecarts.length, 4);
  vrai(
    'chacun chiffre ce qu’il reste à noter',
    ecarts.every((e) => /Encore \d+ jour/.test(e.texte)),
  );
  /*
     Le décompte est **par dimension**, et c'est ce que cette ligne prouve :
     trois glissières ont été notées aujourd'hui, la motivation ne l'a pas
     été. Les trois annoncent donc 36 jours restants sur 37, la quatrième 37.
     Un décompte global afficherait le même chiffre partout, et donnerait à
     croire qu'une dimension jamais notée avance comme les autres.
  */
  const restants = Object.fromEntries(
    ecarts.map((e) => [e.dimension, Number(e.texte.match(/Encore (\d+) jour/)[1])]),
  );
  v('les trois dimensions notées ont avancé d’un jour', [
    restants.humeur,
    restants.energie,
    restants.stress,
  ], [36, 36, 36]);
  v('la motivation, jamais notée, n’a pas bougé', restants.motivation, 37);
}

console.log('\nLE JOURNAL');

{
  await page.fill('#entree', 'Une entrée d’essai, qui ne doit jamais sortir d’ici.');
  await page.click('#ecrire');
  await page.waitForTimeout(1500);
  const entrees = await page.$$eval('#journal [data-entree]', (els) => els.length);
  v('une entrée apparaît', entrees, 1);
  v('le champ est vidé', await page.inputValue('#entree'), '');
  faux('et « rien d’écrit » a disparu', await page.locator('#aucune-entree').isVisible());
}

console.log('\nLA CLÉ SURVIT À UNE NAVIGATION, PAS À LA FERMETURE DE L’ONGLET');

{
  await aller('/odyssee/corps/', '#vue');
  await aller('/odyssee/psyche/', '#vue');
  vrai(
    'après deux navigations, le coffre est toujours ouvert',
    await page.locator('#coffre-ouvert').isVisible(),
  );
  v('et le check-in du jour est relu', (await page.textContent('#val-humeur')).trim(), '9 / 10');

  await page.click('#fermer-coffre');
  await page.waitForTimeout(1200);
  vrai('refermé à la demande', await page.locator('#coffre-ferme').isVisible());
  vrai('les ressources sont toujours là', await page.locator('#ressources').isVisible());
}

console.log('\nAUCUNE ÉTIQUETTE DE GRAVITÉ NULLE PART');

{
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  await page.waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 20000 });
  const texte = (await page.textContent('main')).toLowerCase().replace(/\s+/g, ' ');
  const interdits = ['dépression', 'anxiété généralisée', 'symptôme', 'sévère', 'modéré', 'pathologique'];
  v('aucun mot clinique à l’écran', interdits.filter((m) => texte.includes(m)), []);

  /*
     « diagnostic » fait exception, et il faut le traiter à part plutôt que de
     le retirer de la liste. Le mot **doit** figurer à l'écran : la mention
     « Ce score n'est pas un diagnostic » est exigée, et c'est elle qui
     empêche de lire les glissières comme un résultat.

     Ce que l'essai vérifie, c'est donc qu'il n'y apparaît **que nié**. Si
     quelqu'un écrivait un jour « votre diagnostic » ou « éléments de
     diagnostic », l'occurrence ne serait précédée d'aucune négation et la
     ligne tomberait — alors qu'une liste de mots interdits aurait dû, pour
     l'attraper, renoncer à la mention obligatoire.
  */
  const occurrences = [...texte.matchAll(/diagnostic/g)].map((m) =>
    texte.slice(Math.max(0, m.index - 40), m.index),
  );
  vrai('le mot « diagnostic » est présent, comme l’exige la mention', occurrences.length > 0);
  v(
    'et chacune de ses occurrences est niée',
    occurrences.filter((avant) => !/(aucun|n’est pas un|pas un|ni) $|(aucun|n’est pas un|pas un|ni) [a-zà-ÿ’ ]{0,20}$/.test(avant)),
    [],
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de psyché en navigateur passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
