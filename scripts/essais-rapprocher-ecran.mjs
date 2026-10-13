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
  { n: '09', fin: '30', electricite: '95,00', divers: '43,90', jourDivers: '03', presse: '3,20', nomEdf: 'PRLV EDF' },
  { n: '10', fin: '31', electricite: '95,00', divers: '12,90', jourDivers: '19', presse: '5,40', nomEdf: 'PRLV EDF' },
  /* La banque renomme son libellé en novembre : une seule ligne doit sortir. */
  { n: '11', fin: '30', electricite: '112,40', divers: '31,00', jourDivers: '28', presse: '2,80', nomEdf: 'PRLV EDF CLIENTS SA' },
  { n: '12', fin: '31', electricite: '95,00', divers: '8,50', jourDivers: '11', presse: '6,10', nomEdf: 'PRLV EDF CLIENTS SA' },
];
const LOYER = '780,00';
const SALAIRE = '2 350,00';

const fichiers = [];
let solde = 100000;
for (const m of MOIS) {
  const ouverture = solde;
  const mouvement =
    sou(SALAIRE) - sou(LOYER) - sou(m.electricite) - sou(m.divers) - sou(m.presse);
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
    /*
       Un second vendeur inconnu. Il existe pour que deux essais puissent
       chacun créer une règle sur le sien : le geste simple sur l'un, le
       mode avancé sur l'autre. Avec un seul, le premier des deux le
       consommait et le second n'éprouvait plus rien.
    */
    ...ligne(652, `08/${m.n}/2026`, 'CB PRESSE DU CENTRE', m.presse, true),
    { x: 57, y: 632, texte: `SOLDE CREDITEUR AU ${finPrecedente}` },
    { x: 515, y: 632, texte: euro(ouverture) },
    { x: 57, y: 612, texte: `Ref : 009 SOLDE CREDITEUR AU ${m.fin}/${m.n}/2026` },
    { x: 515, y: 612, texte: euro(solde) },
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
v('vingt opérations enregistrées', (await page.textContent('[data-etat="Opérations"] dd')).trim(), '20');

/* ── 2. Sans ligne de budget, tout est à classer ──────────────────────── */

console.log('\nSANS BUDGET, TOUT EST À CLASSER');

await aller('/odyssee/rapprocher/', '#vue');
{
  const aClasser = await page.$$eval('[data-a-classer]', (e) => e.length);
  v('les vingt opérations attendent', aClasser, 20);
  faux('aucune probable', await page.locator('#titre-probables').isVisible());
  faux('et rien n’a été appliqué d’office', await page.locator('#pied-certaines').isVisible());
  vrai('le compte le dit', (await page.textContent('#compte-file')).includes('20 à classer'),
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
    await page.$$eval('[data-a-classer]', (e) => e.length), 16);

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

/* ── 7 ter. Le pointage par vendeur ──────────────────────────────────── */

console.log('\nLA FILE EST UNIQUE, ET FILTRABLE');

{
  const filtres = await page.$$eval('.filtre', (e) => e.map((x) => x.dataset.filtre));
  v('quatre filtres', filtres, ['tout', 'a-pointer', 'a-rapprocher', 'a-revoir']);
  v('« Tout » est actif au départ',
    await page.getAttribute('[data-filtre="tout"]', 'data-actif'), 'true');

  await page.click('[data-filtre="a-rapprocher"]');
  await page.waitForTimeout(400);
  v('le filtre se marque',
    await page.getAttribute('[data-filtre="a-rapprocher"]', 'data-actif'), 'true');
  /*
     Le filtre **masque**, il ne recalcule pas : un filtre qui referait les
     calculs changerait les totaux affichés ailleurs selon l'onglet choisi.
  */
  faux('les « à classer » sont masqués',
    await page.locator('[data-a-classer]').first().isVisible().catch(() => false));
  await page.click('[data-filtre="tout"]');
  await page.waitForTimeout(400);
  vrai('et reviennent',
    await page.locator('[data-a-classer]').first().isVisible().catch(() => false));
}

console.log('\nLES VENDEURS INCONNUS, UN PAR LIGNE');

{
  vrai('le bloc est affiché', await page.locator('#bloc-inconnus').isVisible());
  const inconnus = await page.$$eval('[data-inconnu]', (e) => e.map((x) => x.dataset.inconnu));
  /*
     Quatre achats au marché, quatre dates différentes, **une** ligne. En
     faire quatre est exactement ce qui fait abandonner.
  */
  vrai('le marché est groupé en une ligne',
    inconnus.filter((n) => n.includes('MARCHE')).length === 1, JSON.stringify(inconnus));

  const titre = await page.textContent('[data-inconnu] p');
  vrai('la ligne dit combien d’opérations et combien au total',
    /\d+ opération\(s\).+€/.test(titre), titre);
}

{
  /* Un type est suggéré, sans IA : un mot du libellé qui est un type. */
  const premier = await page.$$eval('[data-inconnu]', (e) => e[0].dataset.inconnu);
  const options = await page.$$eval(
    `[data-type-pour="${premier}"] option`, (e) => e.map((x) => x.textContent));
  vrai('le choix commence par « Choisir un type… »',
    options[0].includes('Choisir'), JSON.stringify(options.slice(0, 3)));
  vrai('et la taxonomie entière est proposée', options.length > 50, String(options.length));
}

console.log('\nCRÉER LA RÈGLE EN UN GESTE');

{
  const avant = await page.$$eval('[data-inconnu]', (e) => e.length);
  const cible = await page.$$eval('[data-inconnu]', (e) => e[0].dataset.inconnu);
  await page.selectOption(`[data-type-pour="${cible}"]`, 'marche');
  await page.click(`[data-inconnu="${cible}"] [data-geste="creer-regle"]`);
  await page.waitForTimeout(2500);
  const apres = await page.$$eval('[data-inconnu]', (e) => e.length);
  vrai('le vendeur quitte la liste des inconnus', apres < avant, `${avant} → ${apres}`);
}

{
  /*
     Le mode avancé s'éprouve sur un **autre** vendeur que celui du geste
     simple, qui vient de quitter la liste. S'il n'en reste aucun, l'essai
     n'éprouve rien : on l'exige plutôt que de passer en silence.
  */
  vrai('il reste un vendeur inconnu pour éprouver le mode avancé',
    (await page.$$('[data-inconnu]')).length > 0);
}

console.log('\nLE MODE AVANCÉ DE CRÉATION DE RÈGLE');

{
  const cible = await page.$$eval('[data-inconnu]', (e) => e[0].dataset.inconnu);
  await page.selectOption(`[data-type-pour="${cible}"]`, 'marche');
  await page.click(`[data-inconnu="${cible}"] [data-geste="mode-avance"]`);
  await page.waitForSelector(`[data-avance="${cible}"]`, { timeout: 15000 });

  const champs = await page.$$eval('[data-champ-regle]', (e) => e.map((x) => x.dataset.champRegle));
  v('les six champs sont là', champs.sort(),
    ['comparaison', 'ligne', 'mode', 'motif', 'nom', 'type']);

  /*
     Le brouillon part du geste simple : même motif proposé, même type
     choisi juste au-dessus. Le mode avancé ouvre ce que le geste simple
     décide pour vous ; il ne recommence pas depuis rien.
  */
  vrai('le motif proposé est repris', (await page.inputValue('[data-champ-regle="motif"]')).length > 3);
  v('le type choisi est repris', await page.inputValue('[data-champ-regle="type"]'), 'marche');
  v('et le mode naît sur « proposer »',
    await page.inputValue('[data-champ-regle="mode"]'), 'proposer');

  vrai('l’aperçu sur le passé est affiché d’emblée',
    (await page.textContent('[data-apercu-regle]')).length > 10,
    await page.textContent('[data-apercu-regle]'));
}

{
  /*
     Un type « jamais automatique » ne doit pas pouvoir être pointé seul. Le
     choix est désactivé plutôt que masqué : le masquer laisserait croire
     qu'il n'existe pas.
  */
  await page.selectOption('[data-champ-regle="type"]', 'pharmacie');
  await page.waitForTimeout(600);
  const desactive = await page.$eval(
    '[data-champ-regle="mode"] option[value="auto"]', (e) => e.disabled);
  vrai('« Pointer seule » est hors d’atteinte sur un type jamais automatique', desactive);
  await page.selectOption('[data-champ-regle="type"]', 'marche');
  await page.waitForTimeout(600);
  const actif = await page.$eval(
    '[data-champ-regle="mode"] option[value="auto"]', (e) => e.disabled);
  faux('et redevient atteignable sur un type ordinaire', actif);
}

{
  // Un motif trop court est refusé, et la création se ferme.
  await page.fill('[data-champ-regle="motif"]', 'LE');
  await page.locator('[data-champ-regle="motif"]').blur();
  await page.waitForFunction(
    () => !document.querySelector('[data-defauts-regle]').classList.contains('hidden'),
    { timeout: 15000 });
  vrai('un motif trop court est refusé',
    (await page.textContent('[data-defauts-regle]')).includes('Allongez'),
    await page.textContent('[data-defauts-regle]'));
  vrai('et la création est fermée', await page.isDisabled('[data-geste="creer-avance"]'));

  /*
     Un motif qui vise le vendeur déjà classé au geste simple : la règle
     l'attrape, et pourtant rien ne bougerait — ces opérations sont pointées
     par vous. L'aperçu doit le dire. Il disait « ne touche aucune
     opération », ce qui est vrai et laisse croire à un motif qui rate sa
     cible, donc invite à l'élargir. C'est cet essai qui l'a trouvé.
  */
  await page.fill('[data-champ-regle="motif"]', 'MARCHE');
  await page.locator('[data-champ-regle="motif"]').blur();
  await page.waitForTimeout(800);
  vrai('un motif qui n’attrape que vos propres pointages le dit',
    (await page.textContent('[data-apercu-regle]')).includes('vous les avez pointées vous-même'),
    await page.textContent('[data-apercu-regle]'));

  // Un motif qui vise son propre vendeur : l'aperçu chiffre ce qu'il prend.
  await page.fill('[data-champ-regle="motif"]', 'PRESSE');
  await page.locator('[data-champ-regle="motif"]').blur();
  await page.waitForFunction(
    () => document.querySelector('[data-defauts-regle]').classList.contains('hidden'),
    { timeout: 15000 });
  faux('un motif correct rouvre la création',
    await page.isDisabled('[data-geste="creer-avance"]'));
  const apercu = await page.textContent('[data-apercu-regle]');
  vrai('l’aperçu chiffre ce que la règle reclasserait',
    /\d+ opération\(s\) déjà importée\(s\)/.test(apercu), apercu);
}

{
  /*
     Le geste qui distingue le mode avancé : créer **et** appliquer au
     passé. Ce que le geste simple ne fait pas, et ne doit pas faire sans
     qu'on ait vu combien d'opérations bougeront.
     Les quatre achats au marché sont déjà pointés par vous — ils ont été
     fractionnés ou classés plus haut —, donc protégés : c'est exactement ce
     que l'aperçu doit dire plutôt que de les reclasser en silence.
  */
  await page.selectOption('[data-champ-regle="comparaison"]', 'contient');
  await page.waitForTimeout(600);
  const avantCreation = await page.$$eval('[data-inconnu]', (e) => e.length);
  const bouton = page.locator('[data-geste="creer-et-appliquer"]');
  if (await bouton.isVisible()) {
    vrai('le bouton annonce combien d’opérations il touchera',
      /\d+ opération/.test(await bouton.textContent()), await bouton.textContent());
    await bouton.click();
  } else {
    await page.click('[data-geste="creer-avance"]');
  }
  await page.waitForTimeout(2500);
  const apres = await page.$$eval('[data-inconnu]', (e) => e.length);
  vrai('le vendeur quitte la liste des inconnus', apres < avantCreation,
    `${avantCreation} → ${apres}`);
  faux('et le formulaire avancé se referme',
    (await page.$$('[data-avance]')).length > 0);
}

console.log('\nLES CATÉGORIES POINTÉES, ET CE QU’ELLES NE COMPTENT PAS');

{
  const lignes = await page.$$eval('[data-categorie-pointee]',
    (e) => e.map((x) => x.dataset.categoriePointee));
  vrai('des catégories sont affichées', lignes.length > 0, JSON.stringify(lignes));
  vrai('l’alimentation en est, depuis la règle créée',
    lignes.includes('Alimentation'), JSON.stringify(lignes));

  /*
     La ligne « non pointé » n'est pas un détail d'affichage : une
     comparaison faite à moitié ressemble exactement à une comparaison faite
     en entier, et se trompe toujours dans le sens rassurant.
  */
  const phrase = await page.textContent('#non-pointe');
  vrai('ce qui n’est pas compté est dit',
    phrase.includes('n’en tient pas compte') || phrase.includes('Tout est pointé'), phrase);
}

/* ── 7 ter. Fractionner une opération ────────────────────────────────── */

console.log('\nFRACTIONNER UNE OPÉRATION');

{
  faux('rien n’est proposé tant qu’on n’a pas cherché',
    (await page.$$('[data-fractionnable]')).length > 0);

  await page.fill('#chercher-operation', 'PETIT MARCHE');
  await page.waitForFunction(
    () => document.querySelectorAll('[data-fractionnable]').length > 0, { timeout: 15000 });
  const trouvees = await page.$$eval('[data-fractionnable]', (e) => e.length);
  v('les quatre achats au marché sont trouvés', trouvees, 4);
  vrai('et leur nombre est annoncé',
    (await page.textContent('#fractionnement-combien')).includes('4 opération'));

  /*
     Chercher par montant autant que par libellé : on se souvient de l'un ou
     de l'autre, rarement des deux.
  */
  await page.fill('#chercher-operation', '43,90');
  await page.waitForFunction(
    () => document.querySelectorAll('[data-fractionnable]').length === 1, { timeout: 15000 });
  vrai('la recherche par montant trouve la bonne opération',
    (await page.textContent('[data-fractionnable]')).includes('43,90'));
}

{
  const cible = await page.$eval('[data-fractionnable]', (e) => e.dataset.fractionnable);
  await page.click(`[data-fractionnable="${cible}"] [data-geste="ouvrir-fractionnement"]`);
  await page.waitForSelector(`[data-editeur-parts="${cible}"]`, { timeout: 15000 });

  v('l’éditeur s’ouvre sur deux parts', (await page.$$('[data-part]')).length, 2);
  /*
     Et sur un état **enregistrable**. Ouvrir sur deux parts du même type
     accueillerait par un reproche quelqu'un qui n'a encore rien fait.
  */
  faux('aucun défaut n’est affiché à l’ouverture',
    await page.locator(`[data-defauts-parts="${cible}"]`).isVisible());
  vrai('et le reste dit que tout est réparti',
    (await page.textContent(`[data-reste="${cible}"]`)).includes('Tout est réparti'));
  faux('le bouton d’enregistrement est actif',
    await page.isDisabled('[data-geste="valider-parts"]'));

  // On déséquilibre : le reste se dit, et l'enregistrement se ferme.
  await page.fill('[data-montant-de-la-part="0"]', '-10,00');
  await page.locator('[data-montant-de-la-part="0"]').blur();
  await page.waitForFunction(
    () => document.querySelector('[data-reste]').textContent.includes('Il reste'),
    { timeout: 15000 });
  /*
     L'opération fait 43,90 €, donc 21,95 € par part à l'ouverture. Ramener
     la première à 10,00 € laisse 11,95 € — et c'est ce chiffre-là que
     l'écran doit dire, pas « il manque quelque chose ».
  */
  vrai('un déséquilibre se dit en euros, et du bon montant',
    (await page.textContent('[data-reste]')).includes('11,95'),
    await page.textContent('[data-reste]'));
  vrai('et l’enregistrement se ferme',
    await page.isDisabled('[data-geste="valider-parts"]'));
  vrai('le défaut est écrit, pas seulement signalé',
    (await page.textContent('[data-defauts-parts]')).includes('répartir'));

  // « Le reste ici » referme l'écart d'un geste.
  await page.click('[data-part="1"] [data-geste="poser-le-reste"]');
  await page.waitForFunction(
    () => document.querySelector('[data-reste]').textContent.includes('Tout est réparti'),
    { timeout: 15000 });
  faux('« Le reste ici » rend l’enregistrement possible',
    await page.isDisabled('[data-geste="valider-parts"]'));

  // Deux parts sur le même type : refusé, et dit.
  await page.selectOption('[data-type-de-la-part="1"]', 'marche');
  await page.waitForTimeout(600);
  vrai('deux parts sur le même type sont refusées',
    (await page.textContent('[data-defauts-parts]')).includes('additionnez'),
    await page.textContent('[data-defauts-parts]'));
  vrai('et l’enregistrement reste fermé',
    await page.isDisabled('[data-geste="valider-parts"]'));

  // On range la seconde part ailleurs, et on enregistre.
  await page.selectOption('[data-type-de-la-part="1"]', 'travaux-bricolage');
  await page.waitForTimeout(600);
  faux('un type distinct rouvre l’enregistrement',
    await page.isDisabled('[data-geste="valider-parts"]'));
  await page.click('[data-geste="valider-parts"]');
  await page.waitForTimeout(2500);
}

{
  /*
     Le point qui vaut cet essai de bout en bout : le fractionnement doit se
     retrouver dans les catégories, au centime. Les deux moitiés du
     dispositif — l'éditeur et « vueDesCategories » — ont leurs essais purs ;
     ce qu'eux ne disent pas, c'est que les conventions de signe des deux
     côtés sont les mêmes.
  */
  const lignes = await page.$$eval('[data-categorie-pointee]',
    (e) => e.map((x) => x.dataset.categoriePointee));
  vrai('le logement apparaît, depuis la part de bricolage',
    lignes.includes('Logement'), JSON.stringify(lignes));

  await page.fill('#chercher-operation', '43,90');
  await page.waitForFunction(
    () => document.querySelectorAll('[data-fractionnable]').length === 1, { timeout: 15000 });
  const etat = await page.textContent('[data-etat-pointage]');
  vrai('l’opération est annoncée fractionnée', etat.includes('Déjà fractionnée en 2 parts'), etat);
  vrai('et les deux parts sont nommées avec leur montant',
    etat.includes('10,00') && etat.includes('33,90'), etat);

  // Et l'on peut défaire.
  await page.click('[data-geste="defaire-fractionnement"]');
  await page.waitForTimeout(2500);
  await page.fill('#chercher-operation', '43,90');
  await page.waitForFunction(
    () => document.querySelectorAll('[data-fractionnable]').length === 1, { timeout: 15000 });
  const apres = await page.textContent('[data-etat-pointage]');
  faux('défaire le fractionnement le retire', apres.includes('Déjà fractionnée'));
  vrai('et l’opération reste pointée, pas renvoyée à zéro',
    apres.includes('Pointée'), apres);
}

/* ── 7 bis. L'export ICS des échéances ───────────────────────────────── */

console.log('\nL’EXPORT ICS NE SORT QUE CE QU’IL FAUT');

{
  const telechargement = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#exporter-ics');
  const fichier = await telechargement;
  vrai('un fichier .ics est téléchargé', fichier.suggestedFilename().endsWith('.ics'),
    fichier.suggestedFilename());

  const chemin = await fichier.path();
  const texte = (await import('node:fs')).readFileSync(chemin, 'utf8');
  vrai('c’est un VCALENDAR', texte.startsWith('BEGIN:VCALENDAR'));
  vrai('il porte douze échéances de loyer', (texte.match(/BEGIN:VEVENT/g) ?? []).length === 12,
    String((texte.match(/BEGIN:VEVENT/g) ?? []).length));
  vrai('en journées entières', texte.includes('DTSTART;VALUE=DATE:'));
  vrai('avec le montant dans le titre', texte.includes('SUMMARY:'));
  /*
     Un .ics part dans un agenda synchronisé chez un tiers. Rien de ce qui
     identifie le compte ne doit y figurer.
  */
  faux('et sans le libellé bancaire', texte.includes('VIR M DUPONT LOYER'));
  faux('ni le mot « écart »', texte.includes('écart'));
  faux('ni le mot « solde »', texte.includes('solde'));

  const zone = await page.textContent('#resultat-ics');
  vrai('l’écran dit combien ont été exportées', /12 échéance/.test(zone), zone);
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
