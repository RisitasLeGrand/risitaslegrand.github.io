/**
 * L'import d'un relevé, de bout en bout, dans un vrai navigateur.
 *
 * Ce que cet essai couvre et que rien d'autre ne couvre : que pdf.js, son
 * *worker* et l'analyseur se parlent réellement une fois empaquetés, que
 * **rien ne part sur le réseau** pendant la lecture d'un relevé, et que
 * l'import est refusé quand un solde ne boucle pas.
 *
 * Le relevé est **fabriqué** par `lib/pdf-minimal.mjs`, à la géométrie
 * mesurée sur les relevés réels — lesquels ont été effacés.
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { pdfMinimal, relevePdfDEssai } from './lib/pdf-minimal.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const BON = '/tmp/essai-releve-bon.pdf';
const FAUX = '/tmp/essai-releve-faux.pdf';

writeFileSync(BON, relevePdfDEssai());
/* Le même relevé, moins une opération : le solde ne doit plus boucler. */
{
  const entete = (y) => [
    { x: 63, y, texte: 'Date' }, { x: 98, y, texte: 'Date valeur' },
    { x: 161, y, texte: 'Operation' },
    { x: 409, y, texte: 'Debit EUROS' }, { x: 480, y, texte: 'Credit EUROS' },
  ];
  const op = (y, jour, libelle, montant, debit) => [
    { x: 62, y, texte: jour }, { x: 98, y, texte: jour },
    { x: 161, y, texte: libelle }, { x: debit ? 440 : 515, y, texte: montant },
  ];
  writeFileSync(FAUX, pdfMinimal([[
    { x: 57, y: 740, texte: 'C/C CONTRAT PERSONNEL PARCOURS.J+ N 00055347 en euros (GD)' },
    ...entete(720),
    ...op(700, '01/09/2026', 'PAIEMENT PSC TOURNAY', '3,10', true),
    ...op(688, '03/09/2026', 'VIR DE M ALEXIS POUSSET', '225,00', false),
    { x: 57, y: 660, texte: 'SOLDE CREDITEUR AU 31/08/2026' }, { x: 515, y: 660, texte: '525,71' },
    { x: 57, y: 640, texte: 'Ref : 009 SOLDE CREDITEUR AU 30/09/2026' }, { x: 515, y: 640, texte: '741,62' },
  ]]));
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 250)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 250)}`);
};
const vrai = (t, c) => v(t, c, true);
const faux = (t, c) => v(t, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250)); });

/* Toute requête qui sortirait du site est une anomalie : on les compte. */
const sorties = [];
await page.route('**/*', (route) => {
  const url = route.request().url();
  if (!url.startsWith(RACINE) && !url.startsWith('data:') && !url.startsWith('blob:')) {
    sorties.push(url);
  }
  return route.continue();
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

console.log('\nL’ÉCRAN EXISTE ET LE COFFRE LE GARDE');

await aller('/odyssee/finances/', '#vue');
vrai('le coffre est fermé au départ', await page.locator('#coffre-ferme').isVisible());
faux('et rien n’est accessible', await page.locator('#coffre-ouvert').isVisible());

await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
await page.waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 20000 });
v('aucun compte au départ', (await page.textContent('[data-etat="Comptes"] dd')).trim(), '0');

console.log('\nUN RELEVÉ QUI BOUCLE EST ACCEPTÉ');

await page.setInputFiles('#fichier', BON);
await page.waitForSelector('#apercu:not(.hidden)', { timeout: 60000 });

{
  v('le verdict est favorable', await page.getAttribute('#verdict', 'data-importable'), 'true');
  const comptes = await page.$$eval('#comptes [data-compte]', (els) =>
    els.map((e) => ({ nom: e.dataset.compte, verdict: e.dataset.verdict })));
  v('un compte, qui boucle', comptes, [{ nom: 'C/C CONTRAT PERSONNEL PARCOURS.J+', verdict: 'boucle' }]);
  const lignes = await page.$$eval('#echantillon li', (els) => els.map((e) => e.textContent));
  v('trois opérations à l’aperçu', lignes.length, 3);
  /*
     Le numéro de carte du libellé doit être masqué **dans l'aperçu**, donc
     avant tout enregistrement : ce qui est montré est ce qui sera écrit.
  */
  vrai('le numéro de carte est masqué', lignes.some((l) => l.includes('●●●●')));
  faux('et le numéro complet a disparu', lignes.some((l) => l.includes('4974123456784417')));
  vrai('le gabarit est annoncé', (await page.textContent('#gabarit')).includes('Debit EUROS@409'));
}

await page.click('#enregistrer');
await page.waitForSelector('#resultat:not(.hidden)', { timeout: 30000 });

{
  vrai('trois opérations enregistrées', (await page.textContent('#resultat')).includes('3 opération'));
  v('un compte existe', (await page.textContent('[data-etat="Comptes"] dd')).trim(), '1');
  v('et trois opérations', (await page.textContent('[data-etat="Opérations"] dd')).trim(), '3');
}

console.log('\nLE MÊME RELEVÉ DEUX FOIS NE DOUBLE RIEN');

await page.setInputFiles('#fichier', BON);
await page.waitForSelector('#apercu:not(.hidden)', { timeout: 60000 });
await page.click('#enregistrer');
await page.waitForSelector('#resultat:not(.hidden)', { timeout: 30000 });
{
  vrai('tout est déjà là', (await page.textContent('#resultat')).includes('3 déjà présente'));
  v('et le compte des opérations n’a pas bougé', (await page.textContent('[data-etat="Opérations"] dd')).trim(), '3');
}

console.log('\nUN SOLDE QUI NE BOUCLE PAS BLOQUE L’IMPORT');

await page.setInputFiles('#fichier', FAUX);
await page.waitForSelector('#apercu:not(.hidden)', { timeout: 60000 });
{
  v('le verdict est défavorable', await page.getAttribute('#verdict', 'data-importable'), 'false');
  vrai('et il dit que rien n’a été enregistré', (await page.textContent('#verdict')).includes('Rien n’a été enregistré'));
  const verdicts = await page.$$eval('#comptes [data-compte]', (els) => els.map((e) => e.dataset.verdict));
  v('le compte est en écart', verdicts, ['ecart']);
  vrai('le bouton d’enregistrement est désactivé', await page.locator('#enregistrer').isDisabled());
}

await page.click('#annuler');
faux('annuler referme l’aperçu', await page.locator('#apercu').isVisible());
v('et rien n’a été ajouté', (await page.textContent('[data-etat="Opérations"] dd')).trim(), '3');

console.log('\nAUCUNE REQUÊTE N’EST SORTIE DU SITE');
v('aucune requête externe pendant tout l’import', sorties, []);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de finances en navigateur passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
