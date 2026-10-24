/**
 * L'écran des échelles, dans un vrai navigateur.
 *
 * Ce qu'il vérifie et que les essais purs ne peuvent pas : que les textes
 * affichés sont bien ceux des documents, que le coffre garde les scores, que
 * les ressources d'urgence ne dépendent d'aucun score — pas même du neuvième
 * item du PHQ-9 —, et qu'une passation incomplète s'enregistre sans score
 * plutôt que d'être refusée ou arrondie.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

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
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 240)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 240)}`);
};
const vrai = (t, c) => v(t, c, true);
const faux = (t, c) => v(t, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250)); });

const sorties = [];
await page.route('**/*', (r) => {
  const u = r.request().url();
  if (!u.startsWith(RACINE) && !u.startsWith('data:') && !u.startsWith('blob:')) sorties.push(u);
  return r.continue();
});

await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/odyssee/echelles/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });

console.log('\nLE COFFRE GARDE LES SCORES');
vrai('le coffre est fermé au départ', await page.locator('#coffre-ferme').isVisible());
faux('et aucun questionnaire n’est accessible', await page.locator('#coffre-ouvert').isVisible());

console.log('\nLES RESSOURCES NE DÉPENDENT D’AUCUN SCORE');
{
  const n = await page.$$eval('[data-ressource]', (e) => e.map((x) => x.dataset.ressource));
  vrai('le 3114 est là, coffre fermé', n.includes('3114'));
  vrai('le 15 aussi', n.includes('15'));
  vrai('et le 112', n.includes('112'));
}

await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
await page.waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 20000 });

console.log('\nLES TEXTES SONT CEUX DES DOCUMENTS');
{
  const texte = await page.textContent('#coffre-ouvert');
  vrai('le titre du WHO-5 est celui du document',
    texte.includes('Indice (en cinq points) de bien-être de l’OMS (1999)'));
  vrai('la majuscule de « Tout le Temps » est conservée', texte.includes('Tout le Temps'));
  vrai('le PHQ-9 dit « selon quelle fréquence »', texte.includes('selon quelle fréquence'));
  faux('et jamais « à quelle fréquence »', texte.includes('à quelle fréquence'));
  vrai('le neuvième item du PHQ-9 est intégral',
    texte.includes('Penser qu’il vaudrait mieux mourir ou envisager de vous faire du mal'));
  vrai('le cinquième du GAD-7 porte la tournure du document',
    texte.includes('Une agitation telle qu’il est difficile à tenir en place'));
  faux('aucune apostrophe droite dans les items', /\w'\w/.test(texte));
}

console.log('\nLES TROIS QUESTIONNAIRES SONT COMPLETS');
{
  const compter = async (id, n) =>
    v(`${id} : ${n} items`, (await page.$$(`[data-item^="${id}-"]`)).length, n);
  await compter('who5', 5);
  await compter('phq9', 9);
  await compter('gad7', 7);
  vrai('la question de gêne du PHQ-9 est là, hors score',
    (await page.textContent('[data-gene]')).includes('n’entre pas dans le calcul du score'));
}

console.log('\nUNE PASSATION COMPLÈTE DONNE UN SCORE ET UNE TRANCHE CITÉE');
await page.click('[data-commencer="phq9"]');
for (let n = 0; n < 9; n += 1) {
  // 2 partout : score 18, soit la tranche « Moderately severe » (15-19).
  await page.check(`input[name="phq9-${n}"][value="2"]`);
}
await page.click('[data-enregistrer="phq9"]');
await page.waitForFunction(
  () => document.querySelector('[data-dernier="phq9"]').textContent.includes('Score'),
  { timeout: 20000 });
{
  const dit = await page.textContent('[data-dernier="phq9"]');
  vrai('le score est affiché sur son maximum', dit.includes('Score : 18 sur 27'));
  /*
     LA CASSE VIENT DE LA TABLE 4, ET C'EST L'ESSAI QUI AVAIT TORT.

     Cet essai attendait « Moderately severe » ; le module écrit
     « Moderately Severe ». Les deux prétendaient citer la même source, et
     c'est ce désaccord INTERNE — non un désaccord entre le code et le
     manuel — qui a tenu ce contrôle au rouge.

     Le départage est écrit dans `essais-echelles.mts`, au contrôle 4.5 :
     « La casse est celle de la table 4 du manuel, qui écrit "Moderately
     Severe" sur deux lignes. La phrase en prose du manuel écrit la même
     chose en minuscules ; comme le module cite la table, c'est la casse de
     la table qui fait foi. Le relevé portait la minuscule : corrigé. »
     L'écran cite le même palier que le module : il cite donc la table, et
     la capitale avec.

     Ce que cela coûte en honnêteté, et je ne le tais pas : le manuel n'est
     pas dans `sources/`. Ce qui est constaté ici est l'accord de l'écran
     avec le module et avec la raison écrite au contrôle 4.5, non l'accord
     avec le document lui-même.
  */
  vrai('la tranche est citée, dans la langue et la casse de la source',
    dit.includes('« Moderately Severe »'));
  vrai('et la phrase cite le manuel au lieu de juger',
    dit.includes('Le manuel place ce score dans la tranche qu’il nomme'));
  faux('aucune graduation française n’est employée', /modéré|sévère|léger/i.test(dit));
}

console.log('\nLA PROVENANCE DES TRANCHES EST AFFICHÉE');
{
  const texte = await page.textContent('#coffre-ouvert');
  vrai('on dit d’où viennent les tranches du PHQ-9', texte.includes('Table 4'));
  vrai('et qu’elles sont établies sur la version anglaise',
    texte.includes('établies sur la version anglaise'));
  vrai('et que la traduction française n’est pas validée',
    texte.includes('la traduction française l’ait été')
      || texte.includes('validation de la traduction française n’est pas établie'));
}

console.log('\nUNE PASSATION INCOMPLÈTE S’ENREGISTRE, SANS SCORE');
await page.click('[data-commencer="gad7"]');
for (let n = 0; n < 5; n += 1) await page.check(`input[name="gad7-${n}"][value="3"]`);
await page.click('[data-enregistrer="gad7"]');
await page.waitForFunction(
  () => document.querySelector('[data-dernier="gad7"]').textContent.includes('passation'),
  { timeout: 20000 });
{
  const dit = await page.textContent('[data-dernier="gad7"]');
  vrai('la passation est conservée', dit.includes('Dernière passation'));
  vrai('mais sans score', dit.includes('incomplet'));
  vrai('et le nombre de réponses manquantes est dit', dit.includes('2 réponse(s) manquante(s)'));
  faux('aucun score partiel n’est affiché', /Score : \d/.test(dit));
}

console.log('\nLE WHO-5 N’A PAS DE TRANCHE');
await page.click('[data-commencer="who5"]');
for (let n = 0; n < 5; n += 1) await page.check(`input[name="who5-${n}"][value="3"]`);
await page.click('[data-enregistrer="who5"]');
await page.waitForFunction(
  () => document.querySelector('[data-dernier="who5"]').textContent.includes('Score'),
  { timeout: 20000 });
{
  const dit = await page.textContent('[data-dernier="who5"]');
  vrai('le score est multiplié par quatre', dit.includes('Score : 60 sur 100'));
  vrai('et aucune tranche n’est proposée',
    dit.includes('ne donne pas de tranche d’interprétation'));
}

console.log('\nL’HISTORIQUE SURVIT AU RECHARGEMENT');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });

/*
   CET INVARIANT A ÉTÉ REMPLACÉ PAR UNE DÉCISION, PAS PAR UN RELÂCHEMENT.

   L'essai ressaisissait le mot de passe du coffre après le rechargement : il
   supposait qu'un rechargement referme le coffre. Le prompt 35 a livré la
   MÉMOIRE DE SESSION — la clé encapsulée vit dans « sessionStorage » —, donc
   le coffre se rouvre tout seul dans le même onglet, et le formulaire n'est
   même plus affiché. L'essai attendait un champ invisible jusqu'à expiration.

   Exiger encore la ressaisie reviendrait à exiger que la fonctionnalité ne
   marche pas. Ce qui est vérifié maintenant est plus fort : le coffre est
   DÉJÀ ouvert après le rechargement — c'est la promesse du prompt 35 — et
   l'historique est là. Le repli couvre le cas où le formulaire reparaîtrait
   (navigation privée, stockage refusé) : on ressaisit alors, et le contrôle
   le dit.
*/
const formulaireReparu = await page
  .locator('#mdp-coffre')
  .isVisible()
  .catch(() => false);
vrai('le coffre est resté ouvert après le rechargement (mémoire de session)', !formulaireReparu);
if (formulaireReparu) {
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
}
await page.waitForFunction(
  () => document.querySelector('[data-dernier="phq9"]').textContent.includes('Score'),
  { timeout: 20000 });
v('trois passations enregistrées',
  (await page.$$('[data-passation]')).length, 3);

console.log('\nRIEN N’EST SORTI DU SITE');
v('aucune requête extérieure', sorties, []);

console.log(echecs ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m` : '\n\x1b[32m✓ tout passe\x1b[0m');
await nav.close();
process.exit(echecs ? 1 : 0);
