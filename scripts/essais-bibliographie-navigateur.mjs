/**
 * La copie hors ligne de la bibliographie : elle s'ouvre, elle cherche, et
 * elle n'écrit rien.
 *
 * ## Ce qui est contrôlé, et pourquoi dans un navigateur
 *
 * Le paquet fait 1,76 Mo chiffré et huit mégaoctets une fois décompressé. Il
 * est **déchiffré puis décompressé puis analysé** dans l'onglet : trois
 * étapes où une erreur de format ne se voit pas en lisant le code. L'essai
 * ouvre donc l'écran pour de vrai, et vérifie que les vingt-cinq mille
 * références sont là, que la recherche les réduit, et que la page ne met pas
 * une minute à s'afficher.
 *
 * Le contrôle qui compte le plus est le dernier : **aucune écriture**. Ce
 * qu'on cherche dans une bibliographie de molécules est une donnée de santé.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(
      `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
    );
    rouges += 1;
  }
};
const mesure = (quoi, valeur) => console.log(`\x1b[36m·\x1b[0m ${quoi} : ${valeur}`);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await contexte.newPage();

/* Ce qui part et ce qui revient : l'écran ne doit appeler personne d'autre. */
const sorties = [];
page.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith(RACINE) && !u.startsWith('data:') && !u.startsWith('blob:')) sorties.push(u);
});

await franchirInitialisation(page, RACINE, MDP);

const depart = Date.now();
await page.goto(`${RACINE}/odyssee/bibliographie/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
const pret = await page
  .waitForSelector('#vue:not(.hidden)', { timeout: 90000 })
  .then(() => true)
  .catch(() => false);

if (!pret) {
  const erreur = await page.evaluate(
    () => document.getElementById('erreur-biblio')?.textContent?.trim() ?? '(rien)',
  );
  console.log(
    `\n\x1b[31mL'écran ne s'est pas ouvert.\x1b[0m Message affiché : ${erreur}\n\n` +
      'Si le paquet manque : npm run bibliographie:construire <source>, puis npm run build.\n',
  );
  await nav.close();
  process.exit(2);
}
mesure('ouverture complète (déchiffrement, décompression, analyse, premier rendu)', `${Date.now() - depart} ms`);

const etat = await page.evaluate(() => ({
  compte: document.getElementById('compte')?.textContent ?? '',
  lignes: document.querySelectorAll('#resultats li').length,
  datation: document.getElementById('datation')?.textContent ?? '',
  themes: document.getElementById('f-theme')?.options.length ?? 0,
  types: document.getElementById('f-type')?.options.length ?? 0,
  plus: document.getElementById('plus')?.textContent?.trim() ?? '',
}));
mesure('références annoncées', etat.compte);
mesure('thèmes / types dans les filtres', `${etat.themes - 1} / ${etat.types - 1}`);

verifier('B1 — la copie annonce une quantité à cinq chiffres', /\d{2}\s?\d{3} références/.test(etat.compte), true);
verifier('B1 — une page de résultats, pas vingt-cinq mille', etat.lignes, 50);
verifier('B1 — et un bouton pour la suite', /Afficher \d+ de plus/.test(etat.plus), true);
verifier(
  'B2 — la date de la copie est affichée, et les bornes des partages',
  /Copie figée du \d{4}-\d{2}-\d{2}.*du \d{4}-\d{2}-\d{2} au \d{4}-\d{2}-\d{2}/.test(etat.datation),
  true,
);
verifier('B2 — les filtres sont remplis', etat.themes > 10 && etat.types > 3, true);

/* B3 — la recherche réduit, et trouve ce qu'elle doit trouver. */
await page.fill('#q', 'dopamine');
await page.waitForTimeout(600);
const cherche = await page.evaluate(() => ({
  compte: document.getElementById('compte')?.textContent ?? '',
  premier: document.querySelector('#resultats li a')?.textContent ?? '',
}));
mesure('recherche « dopamine »', cherche.compte);
verifier(
  'B3 — la recherche réduit la liste et le dit',
  /sur \d+\.$/.test(cherche.compte.trim()),
  true,
);
verifier('B3 — et le premier résultat parle bien du sujet', /dopamin/i.test(cherche.premier), true);

await page.fill('#q', 'zzzzzzzzzz');
await page.waitForTimeout(600);
verifier(
  'B3 — une recherche sans réponse donne zéro, pas une erreur',
  await page.evaluate(() => ({
    compte: /^0 référence/.test(document.getElementById('compte')?.textContent ?? ''),
    lignes: document.querySelectorAll('#resultats li').length,
  })),
  { compte: true, lignes: 0 },
);
await page.fill('#q', '');
await page.waitForTimeout(600);

/* B4 — « Afficher plus » ajoute, et ne redessine pas tout. */
await page.click('#plus');
await page.waitForTimeout(300);
verifier(
  'B4 — « Afficher plus » ajoute une page',
  await page.evaluate(() => document.querySelectorAll('#resultats li').length),
  100,
);

/* B5 — les liens sortent proprement. */
verifier(
  'B5 — chaque référence est un lien externe, en nouvel onglet, sans référent',
  await page.evaluate(() => {
    const liens = [...document.querySelectorAll('#resultats li a')];
    return {
      liens: liens.length > 0,
      tous: liens.every(
        (a) =>
          a.target === '_blank' &&
          a.rel.includes('noopener') &&
          a.rel.includes('noreferrer') &&
          /^https?:/.test(a.getAttribute('href') ?? ''),
      ),
      nomme: liens.every((a) => (a.textContent ?? '').includes('s’ouvre dans un nouvel onglet')),
    };
  }),
  { liens: true, tous: true, nomme: true },
);

/* B6 — l'attribution est là, et elle nomme la ressource. */
verifier(
  'B6 — NooTopics est cité sur l’écran',
  await page.evaluate(() => (document.getElementById('contenu-principal')?.textContent ?? '').includes('NooTopics')),
  true,
);

/*
   B7 — rien n'est écrit, et rien ne sort.

   Les deux faces de la même promesse : ni trace locale de ce qu'on cherche,
   ni requête vers un tiers. Le magasin des molécules est le seul que cet
   écran pourrait toucher ; on vérifie qu'il n'a rien à toucher du tout.
*/
const traces = await page.evaluate(
  () =>
    new Promise((ok) => {
      const d = indexedDB.open('revinsp');
      d.onerror = () => ok({ erreur: true });
      d.onsuccess = () => {
        const base = d.result;
        const noms = [...base.objectStoreNames].filter((n) => /biblio|recherche|consult/i.test(n));
        base.close();
        ok({
          magasinsSuspects: noms,
          sessionStorage: Object.keys(sessionStorage).filter((k) => /biblio/i.test(k)),
          localStorage: Object.keys(localStorage).filter((k) => /biblio/i.test(k)),
        });
      };
    }),
);
verifier('B7 — aucun magasin de consultation n’a été créé', traces.magasinsSuspects, []);
verifier('B7 — rien dans sessionStorage ni localStorage', [...traces.sessionStorage, ...traces.localStorage], []);
verifier('B7 — aucune requête vers un tiers', sorties, []);

await nav.close();
console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
