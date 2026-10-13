/**
 * L'écran « à rapprocher », de bout en bout, dans un vrai navigateur.
 *
 * Il parcourt la chaîne entière, parce que c'est la seule façon de vérifier
 * qu'elle tient : **quatre relevés importés → une récurrence déduite → une
 * ligne de budget créée → la file qui propose**. Chaque maillon pris seul a
 * ses essais purs ; ce qu'eux ne disent pas, c'est que les identifiants
 * d'occurrence calculés ici retombent bien sur ceux que l'appariement
 * attend, et qu'un rapprochement scellé se relit après rechargement.
 *
 * Les relevés sont **fabriqués**, à la géométrie mesurée sur les relevés
 * réels — lesquels ont été effacés.
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { pdfMinimal } from './lib/pdf-minimal.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

/*
   Quatre mois, et à chaque mois un loyer au 5, une facture d'électricité au
   15, et une dépense sans régularité. Trois loyers suffiraient à la
   détection ; le quatrième est là pour que la médiane ait un nombre pair de
   valeurs, cas où elle se moyenne.
*/
const X = { date: 62, valeur: 98, libelle: 161, debit: 440, credit: 515 };
const entete = (y) => [
  { x: 63, y, texte: 'Date' }, { x: 98, y, texte: 'Date valeur' },
  { x: 161, y, texte: 'Operation' },
  { x: 409, y, texte: 'Debit EUROS' }, { x: 480, y, texte: 'Credit EUROS' },
];
const ligne = (y, jour, libelle, montant, debit) => [
  { x: X.date, y, texte: jour }, { x: X.valeur, y, texte: jour },
  { x: X.libelle, y, texte: libelle },
  { x: debit ? X.debit : X.credit, y, texte: montant },
];
const sou = (s) => Math.round(Number(s.replace(/[\s ]/g, '').replace(',', '.')) * 100);
/*
   Avec le séparateur de milliers, parce qu'une banque en met un. Sans lui,
   `MONTANT` refuse « 2350,00 » — et il a raison : c'est le relevé fabriqué
   qui serait faux, pas le lecteur. L'erreur a coûté un passage de cet essai,
   où le salaire disparaissait silencieusement et les deux soldes avec lui.
*/
const euro = (c) => {
  const [entier, decimales] = Math.abs(c / 100).toFixed(2).split('.');
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${decimales}`;
};

const MOIS = [
  /*
     `jourDivers` est irrégulier exprès : un achat de marché n'a pas de
     périodicité, et il doit rester « à classer ». Je l'avais d'abord posé
     tous les 21 — donc parfaitement mensuel —, et la détection le proposait
     en ligne de budget, ce qu'elle avait parfaitement raison de faire.
  */
  { n: '09', fin: '30', electricite: '95,00', divers: '43,90', jourDivers: '03', nomEdf: 'PRLV EDF' },
  { n: '10', fin: '31', electricite: '95,00', divers: '12,90', jourDivers: '19', nomEdf: 'PRLV EDF' },
  /* La banque renomme son libellé en novembre : une seule ligne doit sortir. */
  { n: '11', fin: '30', electricite: '112,40', divers: '31,00', jourDivers: '28', nomEdf: 'PRLV EDF CLIENTS SA' },
  { n: '12', fin: '31', electricite: '95,00', divers: '8,50', jourDivers: '11', nomEdf: 'PRLV EDF CLIENTS SA' },
];
const LOYER = '780,00';
const SALAIRE = '2 350,00';

const fichiers = [];
let solde = 100000;
for (const m of MOIS) {
  const ouverture = solde;
  const mouvement = sou(SALAIRE) - sou(LOYER) - sou(m.electricite) - sou(m.divers);
  solde = ouverture + mouvement;
  const precedent = String(Number(m.n) - 1).padStart(2, '0');
  const finPrecedente = m.n === '09' ? '31/08/2026' : `${MOIS[MOIS.indexOf(m) - 1].fin}/${precedent}/2026`;
  const chemin = `/tmp/essai-releve-2026-${m.n}.pdf`;
  writeFileSync(chemin, pdfMinimal([[
    { x: 57, y: 740, texte: 'C/C CONTRAT PERSONNEL PARCOURS.J+ N 00055347 en euros (GD)' },
    ...entete(720),
    ...ligne(700, `02/${m.n}/2026`, 'VIR SALAIRE TRESOR PUBLIC', SALAIRE, false),
    ...ligne(688, `05/${m.n}/2026`, 'VIR M DUPONT LOYER', LOYER, true),
    ...ligne(676, `15/${m.n}/2026`, m.nomEdf, m.electricite, true),
    ...ligne(664, `${m.jourDivers}/${m.n}/2026`, 'SARL LE PETIT MARCHE', m.divers, true),
    { x: 57, y: 648, texte: `SOLDE CREDITEUR AU ${finPrecedente}` },
    { x: 515, y: 648, texte: euro(ouverture) },
    { x: 57, y: 628, texte: `Ref : 009 SOLDE CREDITEUR AU ${m.fin}/${m.n}/2026` },
    { x: 515, y: 628, texte: euro(solde) },
  ]]));
  fichiers.push(chemin);
}
const SOLDE_DEPART = euro(100000);
const SOLDE_FINAL = euro(solde);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
};
const vrai = (t, c) => v(t, c, true);
const faux = (t, c) => v(t, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 300)); });

const sorties = [];
await page.route('**/*', (r) => {
  const u = r.request().url();
  if (!u.startsWith(RACINE) && !u.startsWith('data:') && !u.startsWith('blob:')) sorties.push(u);
  return r.continue();
});

await franchirInitialisation(page, RACINE, MDP);

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector(selecteur, { timeout: 40000 });
  if (await page.locator('#coffre-ferme').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
    await page.waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 20000 });
  }
}

/* ── 1. Quatre relevés entrent ────────────────────────────────────────── */

console.log('\nQUATRE RELEVÉS MENSUELS ENTRENT');

await aller('/odyssee/finances/', '#vue');
for (const f of fichiers) {
  await page.setInputFiles('#fichier', f);
  await page.waitForSelector('#apercu:not(.hidden)', { timeout: 60000 });
  v(`le relevé ${f.slice(-10, -4)} boucle`, await page.getAttribute('#verdict', 'data-importable'), 'true');
  await page.click('#enregistrer');
  await page.waitForSelector('#resultat:not(.hidden)', { timeout: 30000 });
}
v('seize opérations enregistrées', (await page.textContent('[data-etat="Opérations"] dd')).trim(), '16');

/* ── 2. Sans ligne de budget, tout est à classer ──────────────────────── */

console.log('\nSANS BUDGET, TOUT EST À CLASSER');

await aller('/odyssee/rapprocher/', '#vue');
{
  const aClasser = await page.$$eval('[data-a-classer]', (e) => e.length);
  v('les seize opérations attendent', aClasser, 16);
  faux('aucune probable', await page.locator('#titre-probables').isVisible());
  faux('et rien n’a été appliqué d’office', await page.locator('#pied-certaines').isVisible());
  vrai('le compte le dit', (await page.textContent('#compte-file')).includes('16 à classer'),
    await page.textContent('#compte-file'));
}

/* ── 3. Le réel propose ses lignes ────────────────────────────────────── */

console.log('\nLE RÉEL PROPOSE SES LIGNES');

await page.click('#deduire');
await page.waitForSelector('[data-recurrence]', { timeout: 20000 });
{
  const fragments = await page.$$eval('[data-recurrence]', (e) => e.map((x) => x.dataset.recurrence));
  /*
     Le fragment retenu est le libellé **entier** : il couvre les quatre
     opérations, et à couverture égale c'est le plus long qui l'emporte,
     donc le plus spécifique. Pour l'électricité, dont le libellé a changé,
     aucun libellé entier ne couvre les quatre — et le fragment commun
     « EDF » gagne, ce qui évite les deux lignes.
  */
  vrai('le loyer est déduit', fragments.includes('VIR M DUPONT LOYER'), JSON.stringify(fragments));
  vrai('l’électricité aussi', fragments.includes('EDF'), JSON.stringify(fragments));
  /*
     Le libellé a changé en novembre. Une seule ligne d'électricité doit
     sortir : deux doubleraient ce budget sans que rien ne le signale.
  */
  v('et une seule, malgré le libellé renommé',
    fragments.filter((f) => f.includes('EDF')).length, 1);
  vrai('le marché sans régularité n’en est pas',
    !fragments.some((f) => f.includes('MARCHE')), JSON.stringify(fragments));

  const fondements = await page.$$eval('[data-fondement]', (e) => e.map((x) => x.textContent));
  vrai('chaque proposition dit sur quoi elle repose',
    fondements.every((t) => /\d+ opérations du \d{4}-\d{2}-\d{2}/.test(t)),
    JSON.stringify(fondements));
}

/* Créer la ligne du loyer, et elle seule. */
await page.click('[data-recurrence="VIR M DUPONT LOYER"] [data-geste="creer-ligne"]');
await page.waitForTimeout(2000);
{
  /*
     Sans recharger : les quatre loyers viennent d'être appliqués d'office,
     et ils doivent être **annoncés tout de suite**. Peindre le pied à partir
     de l'état lu avant l'écriture les faisait disparaître de la file sans
     que rien ne dise où ils étaient passés.
  */
  vrai('les certaines sont annoncées sans recharger',
    await page.locator('#pied-certaines').isVisible());
  v('et listées une par une',
    await page.$$eval('[data-certaine]', (e) => e.length), 4);
  vrai('le pied dit combien viennent d’être appliquées',
    (await page.textContent('#pied-certaines')).includes('Dont 4 à l’instant'),
    await page.textContent('#pied-certaines'));
}

/* ── 4. La file propose, et dit pourquoi ──────────────────────────────── */

console.log('\nLA FILE PROPOSE, ET DIT POURQUOI');

await aller('/odyssee/rapprocher/', '#vue');
{
  const certaines = await page.$$eval('[data-certaine]', (e) => e.length);
  const probables = await page.$$eval('[data-proposition]', (e) => e.length);
  /*
     Les quatre loyers restent visibles **après rechargement**, dans le pied
     des certaines. C'est ce que l'essai a attrapé : ils étaient appliqués,
     donc hors de la file, mais le pied ne montrait que le passage en cours
     — et une décision automatique qu'on ne peut plus voir ne peut plus être
     contestée.
  */
  vrai('les quatre loyers sont reconnus', certaines + probables >= 4,
    `certaines ${certaines}, probables ${probables}`);
  vrai('et chacun est annulable un par un',
    (await page.$$eval('[data-certaine] [data-geste="annuler-une"]', (e) => e.length)) >= 4);
  v('et les douze autres restent à classer',
    await page.$$eval('[data-a-classer]', (e) => e.length), 12);

  const texte = await page.textContent('#coffre-ouvert');
  vrai('les certaines sont annoncées comme appliquées',
    texte.includes('appliquée(s) automatiquement'), texte.slice(0, 200));
  vrai('et le pied dit la ligne qu’elles ont rejointe',
    (await page.textContent('#certaines')).includes('VIR M DUPONT LOYER'),
    (await page.textContent('#certaines')).slice(0, 200));
}

/* ── 5. Un rapprochement survit au rechargement ───────────────────────── */

console.log('\nUN RAPPROCHEMENT SURVIT AU RECHARGEMENT');

{
  const avant = await page.$$eval('[data-a-classer]', (e) => e.length);
  await page.click('[data-a-classer] [data-geste="hors-budget"]');
  await page.waitForTimeout(1200);
  v('un « hors budget » retire l’opération de la file',
    await page.$$eval('[data-a-classer]', (e) => e.length), avant - 1);

  await aller('/odyssee/rapprocher/', '#vue');
  v('et il tient après rechargement',
    await page.$$eval('[data-a-classer]', (e) => e.length), avant - 1);
}

/* ── 6. Le rapprochement de solde, et la recherche de causes ──────────── */

console.log('\nLE RAPPROCHEMENT DE SOLDE CHERCHE LES CAUSES');

{
  await page.fill('#solde-depart', SOLDE_DEPART);
  await page.fill('#solde-declare', SOLDE_FINAL);
  await page.click('#verifier-solde');
  await page.waitForSelector('#verdict-solde:not(.hidden)', { timeout: 10000 });
  v('le compte boucle au centime', await page.getAttribute('#verdict-solde', 'data-concorde'), 'true');
  v('et rien n’est à chercher', await page.$$eval('#causes li', (e) => e.length), 0);
}

{
  /* Un solde faux de 43,90 € : l'absence doit être proposée, avec son sens. */
  const faux1 = euro(solde - 4390);
  await page.fill('#solde-declare', faux1);
  await page.click('#verifier-solde');
  await page.waitForSelector('[data-cause]', { timeout: 10000 });
  v('un écart est annoncé', await page.getAttribute('#verdict-solde', 'data-concorde'), 'false');
  vrai('et le verdict dit que rien n’est appliqué',
    (await page.textContent('#verdict-solde')).includes('Aucune n’est appliquée'));
  const causes = await page.$$eval('[data-cause]', (e) => e.map((x) => x.dataset.cause));
  vrai('l’opération manquante est proposée', causes.includes('operationManquante'),
    JSON.stringify(causes));
  const phrases = await page.$$eval('[data-cause]', (e) => e.map((x) => x.textContent));
  vrai('en disant dans quel sens chercher',
    phrases.some((p) => p.includes('une sortie en trop')), JSON.stringify(phrases));
}

/* ── 7. Les écarts, et l’échéance non échue ───────────────────────────── */

console.log('\nLES ÉCARTS, ET L’ÉCHÉANCE NON ÉCHUE');

{
  const lignes = await page.$$eval('[data-ecart]', (e) => e.map((x) => x.textContent));
  vrai('la ligne de loyer est mesurée',
    lignes.some((t) => t.includes('Loyer') || t.includes('DUPONT')), JSON.stringify(lignes));
  vrai('avec le prévu, le réel et l’écart',
    lignes.every((t) => t.includes('prévu') && t.includes('réel') && t.includes('écart')),
    JSON.stringify(lignes));

  await page.click('[data-axe="mois"]');
  await page.waitForTimeout(800);
  const mois = await page.$$eval('[data-ecart]', (e) => e.map((x) => x.dataset.ecart));
  vrai('l’axe des mois rend des mois', mois.every((m) => /^\d{4}-\d{2}$/.test(m)),
    JSON.stringify(mois));
  v('l’axe est marqué comme actif',
    await page.getAttribute('[data-axe="mois"]', 'data-actif'), 'true');

  await page.click('[data-axe="categorie"]');
  await page.waitForTimeout(800);
  vrai('et l’axe des catégories aussi',
    (await page.$$eval('[data-ecart]', (e) => e.length)) > 0);
}

/* ── 8. Le coffre et le réseau ────────────────────────────────────────── */

console.log('\nLE COFFRE GARDE L’ÉCRAN, ET RIEN NE SORT');

{
  await page.click('#fermer-coffre');
  await page.waitForTimeout(800);
  vrai('refermer le coffre referme l’écran', await page.locator('#coffre-ferme').isVisible());
  faux('et rien n’est plus lisible', await page.locator('#coffre-ouvert').isVisible());
}
v('aucune requête n’est sortie du site', sorties, []);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de l’écran « à rapprocher » passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
