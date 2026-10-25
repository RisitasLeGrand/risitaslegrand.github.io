/**
 * « Ma journée » dans un navigateur : une donnée, trois endroits.
 *
 *   npx astro preview &  CHROMIUM=… npm run essais:ma-journee:navigateur
 *
 * Le mot de passe ne se donne PAS sur la ligne de commande : elle reste en
 * clair dans le journal du terminal. Il se pose dans `.env.local`, ignoré
 * par Git, et `motDePasseEssais()` l'y lit — c'est la source unique.
 *
 *   printf 'SITE_PASSWORD=…\n' > .env.local
 *
 * Décision 5 du prompt 56 : « modifier à un endroit se voit aux trois ».
 * L'essai pur garde les déclarations ; celui-ci garde ce qu'aucune
 * déclaration ne peut garder — qu'une heure changée dans Paramètres se lise
 * dans « Mon profil », et que la bascule du thème la reçoive.
 *
 * Et il garde le défaut nommé par l'audit (G5, P10) : un champ vide ne doit
 * plus afficher 07:00 comme s'il avait été choisi, et le vider ne doit pas
 * écrire une heure d'usine au journal.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

/* Le binaire se cherche, il ne se nomme pas : le numéro de version du
   conteneur change, et un chemin écrit en dur rougit sans que le site ait
   rien. C'est l'outillage posé sur main le 19 octobre. */
const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
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
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));

async function deverrouiller() {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

/** Le champ d'un réglage de la page centrale. */
const champDuReglage = (id) => page.locator(`[data-reglage="${id}"] input`);
/** La phrase qui dit ce que le vide veut dire. */
const noteDuReglage = (id) => page.locator(`[data-reglage="${id}"] [data-si-vide]`);

/* Une base neuve : aucune heure n'a jamais été donnée. */
await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      try {
        localStorage.clear();
      } catch {
        /* rien à faire */
      }
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);

/* ════════════════════════════════════════════════════════════════════════
   1. Rien n'est renseigné : le champ est vide, et il le dit
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nSANS RÉPONSE, LE CHAMP EST VIDE ET LE DIT');

await aller('/parametres/', '[data-reglage="lever"] input, [data-reglage="lever"] [data-message]');
v('le lever n’affiche aucune heure', await champDuReglage('lever').inputValue(), '');
vrai('et une phrase dit ce que Cyclades fait à défaut', await noteDuReglage('lever').isVisible());
v(
  'laquelle nomme l’heure d’usine',
  (await noteDuReglage('lever').textContent())?.trim(),
  'Non renseigné : 7 h par défaut.',
);
v('le coucher aussi', await champDuReglage('coucher').inputValue(), '');
v(
  'avec sa propre phrase',
  (await noteDuReglage('coucher').textContent())?.trim(),
  'Non renseigné : 21 h par défaut.',
);
faux(
  'et « Rétablir » n’est pas proposé : il n’y a rien à rétablir',
  await page.locator('[data-reglage="lever"] button', { hasText: 'Rétablir' }).isVisible(),
);
/* La preuve que rien n'a été écrit : le journal ne porte aucun champ d'heure. */
v(
  'et le journal ne porte aucune heure',
  await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const tx = r.result.transaction('operations', 'readonly');
          tx.objectStore('operations').getAll().onsuccess = (e) =>
            ok(
              e.target.result.filter((o) => /profil:(lever|coucher)/.test(o.cible ?? '')).length,
            );
        };
        r.onerror = () => ok(-1);
      }),
  ),
  0,
);

/* ════════════════════════════════════════════════════════════════════════
   2. Une heure donnée dans Paramètres se lit dans Mon profil
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE HEURE DONNÉE SE LIT AUX TROIS ENDROITS');

await champDuReglage('lever').fill('06:30');
await champDuReglage('lever').dispatchEvent('change');
await page.waitForFunction(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const tx = r.result.transaction('operations', 'readonly');
        tx.objectStore('operations').getAll().onsuccess = (e) =>
          ok(e.target.result.some((o) => o.cible === 'profil:lever'));
      };
      r.onerror = () => ok(false);
    }),
  undefined,
  { timeout: 15000 },
);
v('la page centrale garde l’heure donnée', await champDuReglage('lever').inputValue(), '06:30');
faux('et la phrase du vide disparaît', await noteDuReglage('lever').isVisible());

await aller('/profil/', '[data-carte="lever"] [data-champ="lever"]');
{
  /* La carte du lever, dans le bloc « Votre journée ». La valeur est dite en
     français depuis P7 : « 6 h 30 », et non « 06:30 » — c'est la même donnée,
     écrite comme on l'écrit. */
  v(
    '« Mon profil » montre la même heure, dite en français',
    (await page.textContent('[data-valeur="lever"]')).trim(),
    '6 h 30',
  );
  const texte = (await page.textContent('[data-carte="lever"]')).replace(/\s+/g, ' ');
  vrai('et la dit déclarée, non observée, dans son historique', texte.includes('déclaré'));
  vrai('la ligne « Lu par » nomme Paramètres, Ma journée', texte.includes('Paramètres, Ma journée'));
}

/*
   LE TROISIÈME ENDROIT : la bascule du thème.

   `Base.astro` recopie le lever et le coucher du profil dans une clé locale,
   pour que le script d'avant-peinture sache quel thème poser avant même que la
   base soit ouverte. C'est la copie que l'audit signale (M5), et la décision 5
   demande qu'elle ne puisse pas diverger : elle est écrite par le site, jamais
   par la personne.
*/
await page.waitForFunction(
  () => (localStorage.getItem('revinsp.heures-journee') ?? '').startsWith('06:30'),
  undefined,
  { timeout: 15000 },
);
v(
  'et la bascule du thème reçoit la même heure',
  (await page.evaluate(() => localStorage.getItem('revinsp.heures-journee')))?.split('|')[0],
  '06:30',
);

/* ════════════════════════════════════════════════════════════════════════
   3. « Passer au clair à » suit Ma journée, sauf si on le règle
   ════════════════════════════════════════════════════════════════════════ */
console.log('\n« PASSER AU CLAIR À » SUIT MA JOURNÉE PAR DÉFAUT');

await aller('/parametres/', '[data-reglage="heure-clair"] input');
v('aucune heure n’est réglée sur cet appareil', await champDuReglage('heure-clair').inputValue(), '');
vrai('et la phrase renvoie à Ma journée', await noteDuReglage('heure-clair').isVisible());
v(
  'aucune copie locale n’existe',
  await page.evaluate(() => localStorage.getItem('revinsp.heures-bascule')),
  null,
);

await champDuReglage('heure-clair').fill('08:00');
await champDuReglage('heure-clair').dispatchEvent('change');
await page.waitForFunction(
  () => (localStorage.getItem('revinsp.heures-bascule') ?? '').startsWith('08:00'),
  undefined,
  { timeout: 15000 },
);
v(
  'une heure donnée ici crée la copie locale',
  (await page.evaluate(() => localStorage.getItem('revinsp.heures-bascule')))?.split('|')[0],
  '08:00',
);
vrai(
  'et « Ma journée » n’a pas bougé pour autant',
  (await page.evaluate(() => localStorage.getItem('revinsp.heures-journee')))?.startsWith('06:30'),
);

/* Vider le champ rend la main à « Ma journée » : c'est la proposition P10. */
await champDuReglage('heure-clair').fill('');
await champDuReglage('heure-clair').dispatchEvent('change');
await page.waitForFunction(
  () => localStorage.getItem('revinsp.heures-bascule') === null,
  undefined,
  { timeout: 15000 },
);
v(
  'vider le champ efface la copie locale',
  await page.evaluate(() => localStorage.getItem('revinsp.heures-bascule')),
  null,
);
v('et le champ redevient vide', await champDuReglage('heure-clair').inputValue(), '');

/* ════════════════════════════════════════════════════════════════════════
   4. Vider une heure de Ma journée retire la réponse
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nVIDER UNE HEURE RETIRE LA RÉPONSE, SANS EN ÉCRIRE UNE AUTRE');

await champDuReglage('lever').fill('');
await champDuReglage('lever').dispatchEvent('change');
await page.waitForFunction(
  () => !document.querySelector('[data-reglage="lever"] input')?.value,
  undefined,
  { timeout: 15000 },
);
v('le champ est vide', await champDuReglage('lever').inputValue(), '');
vrai('et la phrase du vide revient', await noteDuReglage('lever').isVisible());

/* On attend « ce qui n'est pas renseigné », et non « ce qui l'est » : le
   profil est redevenu vide, et une zone vide n'a pas de hauteur — Playwright
   la voit donc comme cachée, à juste titre. */
await aller('/profil/', '[data-carte="lever"] [data-champ="lever"]');
{
  /* La carte reste là — le champ est lu, donc toujours demandé —, mais elle
     est vide et propose de renseigner. C'est la même carte pour les deux
     états : la liste séparée « Ce qui n'est pas renseigné » a disparu avec le
     plan de page, et c'est elle qui ne montrait jamais les champs de branche. */
  v(
    '« Mon profil » ne montre plus l’heure',
    (await page.textContent('[data-valeur="lever"]')).trim(),
    '—',
  );
  vrai(
    'et sa carte propose de la renseigner',
    await page.locator('[data-carte="lever"] button', { hasText: 'Renseigner' }).first().isVisible(),
  );
  const texte = (await page.textContent('[data-carte="lever"]')).replace(/\s+/g, ' ');
  faux('plus d’historique sur un champ vide', texte.includes('Historique'));
}
/* Et surtout : aucune heure d'usine n'a été écrite à la place. */
v(
  'aucune valeur n’a été écrite à la place',
  await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const tx = r.result.transaction('operations', 'readonly');
          tx.objectStore('operations').getAll().onsuccess = (e) => {
            const siennes = e.target.result
              .filter((o) => o.cible === 'profil:lever')
              .sort((a, b) => (a.hlc < b.hlc ? -1 : 1));
            const derniere = siennes[siennes.length - 1];
            ok(derniere?.charge?.supprime === true ? 'supprimé' : JSON.stringify(derniere?.charge));
          };
        };
        r.onerror = () => ok('illisible');
      }),
  ),
  'supprimé',
);

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
