/**
 * La page des organigrammes : ce qu'elle liste, ce qu'elle date, ce qu'elle cache.
 *
 *   npm run essais:organigrammes-page:navigateur
 *
 * ## Les quatre volets, et pourquoi chacun
 *
 * 1. **Ce que la page liste** doit être exactement ce que le manifeste compte.
 *    Un écart dans un sens laisse un organigramme introuvable ; dans l'autre,
 *    il promet un repli qui s'ouvre sur rien.
 * 2. **La date et la source** sont au-dessus du dessin, avant qu'on le croie.
 *    Un organigramme de 2015 lu comme l'état actuel est une erreur apprise avec
 *    assurance, et c'est tout ce que ce lot cherche à empêcher.
 * 3. **Le lien du pied de page** ne s'offre qu'aux parcours servis. Un lien vers
 *    une page vide est une promesse non tenue à chaque page du site.
 * 4. **L'état vide se dit.** Il sera la règle pendant des mois, et un écran
 *    blanc passe pour une panne.
 *
 * ## Pourquoi l'INSP sert de témoin à l'état vide
 *
 * La matière commune est servie aux trois parcours DGFiP : aucun d'eux n'est
 * donc vide aujourd'hui. L'INSP, lui, ne la reçoit pas — son manifeste ne porte
 * aucune fiche à organigramme, et c'est l'état vide véritable, obtenu sans rien
 * truquer.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
  }
};
const vrai = (titre, obtenu) => v(titre, obtenu, true);

const erreurs = [];
const ctx = await nav.newContext({ viewport: { width: 1200, height: 1100 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 200)));
await franchirInitialisation(page, RACINE, MDP);

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(2500);
  }
};

async function ouvrir(chemin, idParcours) {
  await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
  await page.evaluate((id) => localStorage.setItem('revinsp.parcours', id), idParcours);
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await connecter();
  await page
    .waitForFunction(
      () => document.getElementById('chargement')?.classList.contains('hidden') === true,
      null,
      { timeout: 40000 },
    )
    .catch(() => {});
}

console.log('\nCE QUE LA PAGE LISTE EST CE QUE LE MANIFESTE COMPTE');

await ouvrir('/organigrammes/', 'dgfip-a');
const replis = page.locator('#liste details[data-fiche]');
const combien = await replis.count();
vrai(`au moins une fiche à organigramme est listée (${combien})`, combien >= 1);
v('et l’état vide n’est pas affiché', await page.locator('#vide').isVisible(), false);

const titres = await replis.locator('> summary').allTextContents();
v(
  'chaque fiche listée annonce un nombre d’organigrammes',
  titres.filter((t) => !/— \d+ organigrammes?$/.test(t.trim())),
  [],
);

console.log('\nLA DATE ET LA SOURCE SONT AU-DESSUS DU DESSIN');

await replis.first().locator('> summary').click();
await page.waitForTimeout(1200);
const premier = replis.first();
const blocs = premier.locator('[data-organigramme]');
const montes = await blocs.count();
vrai(`le repli monte au moins un organigramme (${montes})`, montes >= 1);
/*
   LE COMPTE ANNONCÉ CONTRE LE COMPTE MONTÉ.

   Le résumé du repli vient du MANIFESTE — « nbOrganigrammes » —, les blocs
   montés viennent de la FICHE déchiffrée. Les comparer rapproche deux sources
   que rien d'autre ne confronte : un manifeste qui annoncerait trois
   organigrammes pour une fiche qui en porte deux ouvrirait un repli sur un
   manque, et la page le dirait mais personne ne le verrait venir.
*/
const annonce = Number(/— (\d+) organigramme/.exec((await premier.locator('> summary').textContent()) ?? '')?.[1] ?? '0');
v('le repli monte exactement ce que le manifeste annonçait', montes, annonce);

const datee = premier.locator('[data-date-organigramme]').first();
vrai('la date est déclarée en attribut, pour être vérifiable', await datee.count() > 0);
const texteDate = (await datee.textContent()) ?? '';
vrai(
  'elle est écrite en clair, avec la préposition qui convient à sa précision',
  /^État (au \d{1,2} [a-zéû]+|en [a-zéû]+) \d{4} · /.test(texteDate),
);
vrai('et la source est sur la même ligne', texteDate.includes('·'));
v(
  'la date brute n’est pas affichée telle quelle',
  texteDate.includes(await datee.getAttribute('data-date-organigramme')),
  false,
);

const svg = premier.locator('svg').first();
vrai('le dessin est monté', await svg.count() > 0);
vrai(
  'le texte de remplacement complet est là',
  (await premier.locator('[data-organigramme-texte]').count()) > 0,
);
vrai(
  'la date précède le dessin dans le document',
  await page.evaluate(() => {
    const bloc = document.querySelector('#liste details[data-fiche] [data-organigramme]');
    const d = bloc?.querySelector('[data-date-organigramme]');
    const s = bloc?.querySelector('svg');
    if (!d || !s) return false;
    return (d.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }),
);

console.log('\nLE LIEN NE S’OFFRE QU’AUX PARCOURS SERVIS');

const lienDuPied = () =>
  page.evaluate(() => {
    const a = [...document.querySelectorAll('footer a')].find(
      (x) => (x.textContent ?? '').trim() === 'Organigrammes',
    );
    return a ? { present: true, cache: a.hidden } : { present: false, cache: null };
  });
v('pour DGFiP A, le lien est offert', await lienDuPied(), { present: true, cache: false });

await ouvrir('/bibliotheque/', 'insp');
v('pour l’INSP, le lien est écrit mais caché', await lienDuPied(), { present: true, cache: true });

console.log('\nET L’ÉTAT VIDE SE DIT, PLUTÔT QUE DE LAISSER UN ÉCRAN BLANC');

await ouvrir('/organigrammes/', 'insp');
vrai('l’état vide est affiché', await page.locator('#vide').isVisible());
v('et aucune fiche n’est listée', await page.locator('#liste details[data-fiche]').count(), 0);
vrai(
  'il dit que les organigrammes arrivent, et non qu’il n’y en aura pas',
  ((await page.locator('#vide').textContent()) ?? '').includes('fiche par fiche'),
);

console.log('\nSESSION FERMÉE, LA PAGE NE RÉVÈLE RIEN');

/*
   ON N'OUVRE PAS LA SESSION, ET C'EST TOUT L'OBJET DE CE BLOC.

   Les organigrammes sont du contenu chiffré comme le reste ; mais un
   organigramme porte en plus un TITRE et une SOURCE que la page affiche en
   clair une fois ouverte, et c'est là le risque propre à cet écran : un titre
   écrit dans le HTML servi, ou glissé dans un attribut, révélerait l'existence
   et l'objet du contenu à qui n'a pas le mot de passe.

   On vérifie donc sur un contexte NEUF, sans franchir l'initialisation ni
   remplir le mot de passe : ni le titre d'un organigramme, ni sa source, ni la
   date d'état ne doivent apparaître — ni dans le texte, ni dans les attributs.
*/
const ctxFerme = await nav.newContext({ viewport: { width: 1200, height: 900 } });
const pageFermee = await ctxFerme.newPage();
await pageFermee.goto(`${RACINE}/organigrammes/`, { waitUntil: 'networkidle' });
await pageFermee.waitForTimeout(1500);
const htmlFerme = await pageFermee.content();
v(
  'aucun titre d’organigramme n’apparaît',
  ['Haute-Saône', 'Eure-et-Loir', 'gestion fiscale'].filter((m) => htmlFerme.includes(m)),
  [],
);
v(
  'aucune source ni référence d’annonce n’apparaît',
  ['MEF_2026-32583', 'MEF_2026-33159', 'choisirleservicepublic'].filter((m) =>
    htmlFerme.includes(m),
  ),
  [],
);
v(
  'aucune date d’état n’apparaît',
  (htmlFerme.match(/data-date-organigramme/g) ?? []).length,
  0,
);
vrai(
  'et la page demande le mot de passe plutôt que de se taire',
  (await pageFermee.locator('#champ-mdp').count()) > 0,
);
await ctxFerme.close();

console.log('\nET AUCUNE ERREUR DE PAGE N’A ÉTÉ AVALÉE');
v('aucune erreur levée', erreurs.slice(0, 3), []);

await nav.close();
console.log(
  echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} rouge${echecs > 1 ? 's' : ''}\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
