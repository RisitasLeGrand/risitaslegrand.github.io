/**
 * Le bouclage complet : cinq ans de données, un export, une analyse, un import.
 *
 * ## Ce que ce script mesure, et pourquoi il existe
 *
 * Les essais vérifient des règles sur de petits jeux. Ils ne disent rien de ce
 * qui se passe sur **cinq ans d'usage réel** : combien pèse un export, combien
 * de temps il met à se construire, et si la vérification des chiffres tient sur
 * un historique qui fait des milliers d'enregistrements. Un export de dix
 * mégaoctets qu'aucune IA ne lirait serait conforme à toutes les règles et
 * inutilisable.
 *
 * Le cycle est joué **par l'interface réelle**, et l'analyse est engendrée à
 * partir du manifeste et du catalogue que l'export vient de produire : elle
 * cite donc des chiffres qui existent, et la vérification a quelque chose à
 * vérifier.
 *
 * Lancez : `npm run bouclage-ia` — fournissez CHROMIUM et lancez
 * « astro preview » avant.
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { engendrer, HYPOTHESES } from './lib/donnees-synthetiques.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const ANNEES = Number(process.env.ANNEES ?? HYPOTHESES.annees);
const RAPPORT = process.env.RAPPORT ?? '';

const octets = (n) =>
  n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Mo`
    : `${Math.round(n / 1024).toLocaleString('fr-FR')} ko`;
const secondes = (ms) => `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;

console.log(`\nBOUCLAGE SUR ${ANNEES} ANS`);
const jeu = engendrer({ annees: ANNEES, graine: 7 });
const comptes = Object.entries(jeu)
  .filter(([nom]) => nom !== 'projection')
  .map(([nom, lignes]) => `${nom} ${lignes.length.toLocaleString('fr-FR')}`);
console.log(`  jeu engendré : ${comptes.join(', ')}`);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({ acceptDownloads: true });
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

let echecs = 0;
const v = (titre, condition, detail = '') => {
  if (!condition) echecs += 1;
  console.log(`  ${condition ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}${detail ? ` — ${detail}` : ''}`);
};

/* ── La base, créée par l'application puis semée ────────────────────────── */
await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await franchirInitialisation(page, RACINE, MDP);

const LOT = 2000;
const debutSemis = Date.now();
for (const [nom, enregistrements] of Object.entries(jeu)) {
  if (nom === 'projection' || !enregistrements.length) continue;
  for (let i = 0; i < enregistrements.length; i += LOT) {
    const tranche = enregistrements.slice(i, i + LOT);
    await page.evaluate(
      async ({ nom, tranche }) => {
        const base = await new Promise((ok, ko) => {
          const r = indexedDB.open('revinsp');
          r.onsuccess = () => ok(r.result);
          r.onerror = () => ko(r.error);
        });
        await new Promise((ok, ko) => {
          const tx = base.transaction(nom, 'readwrite');
          const magasin = tx.objectStore(nom);
          for (const enr of tranche) {
            if (nom === 'etat') magasin.put(enr.valeur, enr.clef);
            else magasin.put(enr);
          }
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
          tx.onabort = () => ko(tx.error);
        });
        base.close();
      },
      { nom, tranche },
    );
  }
}
const msSemis = Date.now() - debutSemis;
const total = Object.entries(jeu)
  .filter(([nom]) => nom !== 'projection')
  .reduce((s, [, l]) => s + l.length, 0);
console.log(`  ${total.toLocaleString('fr-FR')} enregistrements semés en ${secondes(msSemis)}`);

/* ── L'export, mesuré ───────────────────────────────────────────────────── */
console.log('\nL’EXPORT');

await page.goto(`${RACINE}/exporter-ia/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#categories input', { timeout: 60000 });
/* L'année : la période la plus lourde que l'assistant propose. */
await page.click('[data-periode="annee"]');

const debutExport = Date.now();
await page.click('#apercevoir');
await page.waitForSelector('#apercu:not(.hidden)', { timeout: 300000 });
const msExport = Date.now() - debutExport;

const taille = (await page.locator('#taille').textContent()) ?? '';
const resume = (await page.locator('#resume-export').textContent()) ?? '';
console.log(`  construit en ${secondes(msExport)}`);
console.log(`  ${resume.trim()}`);
console.log(`  ${taille.trim()}`);
v('l’export se construit en moins de deux minutes', msExport < 120_000, secondes(msExport));

const contenus = new Map();
page.on('download', async (d) => {
  const chemin = await d.path().catch(() => null);
  if (chemin) contenus.set(d.suggestedFilename(), (await import('node:fs')).readFileSync(chemin, 'utf8'));
});
await page.click('#telecharger');
await page.waitForSelector('#message-export:not(.hidden)', { timeout: 60000 });
await page.waitForTimeout(2500);

const manifeste = JSON.parse(contenus.get('manifest.json') ?? '{}');
const catalogue = JSON.parse(contenus.get('indicateurs.json') ?? '{}');
const octetsExport = (manifeste.fichiers ?? []).reduce((s, f) => s + f.octets, 0);
v('les neuf fichiers sont produits', contenus.size === 9, `${contenus.size} fichiers`);
v('le manifeste porte une empreinte', /^sha256:[0-9a-f]{64}$/.test(manifeste.empreinte ?? ''));
v(
  'le vecteur de versions nomme au moins un appareil',
  Object.keys(manifeste.vecteur_de_versions?.bornes ?? {}).length >= 1,
);
console.log(`  poids total des huit fichiers : ${octets(octetsExport)}`);

/*
 * Le seuil n'est pas une règle du produit : c'est ce qu'une IA lit
 * raisonnablement d'un coup, et l'assistant propose un découpage au-delà. Le
 * bouclage vérifie donc que la **proposition de découpage** apparaît quand il
 * le faut, pas que l'export soit petit.
 */
const decoupeProposee = await page.locator('#decoupage').isVisible();
v(
  'le découpage est proposé si et seulement si le volume déborde',
  decoupeProposee === octetsExport > 400 * 1024,
  decoupeProposee ? 'proposé' : 'non proposé',
);

/* ── L'analyse, engendrée sur les chiffres réels ────────────────────────── */
console.log('\nL’ANALYSE, CONSTRUITE SUR LES CHIFFRES DE L’EXPORT');

const mesures = (catalogue.valeurs ?? []).filter((x) => x.valeur !== null);
v('l’export porte des mesures à citer', mesures.length >= 3, `${mesures.length} mesurées`);

const uniteDe = (id) => (catalogue.catalogue ?? []).find((i) => i.id === id)?.unite ?? '';
const constats = mesures.slice(0, 6).map((m, i) => ({
  id: `c${i + 1}`,
  domaine: (catalogue.catalogue ?? []).find((x) => x.id === m.indicateur)?.domaine ?? 'transverse',
  type: 'tendance',
  enonce: `Sur la période, l’indicateur ${m.indicateur} vaut ${m.valeur} ${uniteDe(m.indicateur)}.`,
  confiance: 'moyenne',
  preuves: [
    {
      indicateur: m.indicateur,
      periode: manifeste.periode,
      valeur_citee: m.valeur,
      unite: uniteDe(m.indicateur),
    },
  ],
  limites: 'Ce constat ne dit rien de ce qui n’est pas mesuré sur la période.',
}));

/* Un constat délibérément faux, pour que la vérification ait à le trouver. */
constats.push({
  id: 'c99',
  domaine: 'cognition',
  type: 'anomalie',
  enonce: 'Un chiffre inventé, que la vérification doit refuser de confirmer.',
  confiance: 'elevee',
  preuves: [
    {
      indicateur: mesures[0].indicateur,
      periode: manifeste.periode,
      valeur_citee: mesures[0].valeur * 7 + 1234,
      unite: uniteDe(mesures[0].indicateur),
    },
  ],
});

const analyse = {
  format: 'cyclades-analyse',
  version: 1,
  export_id: manifeste.export_id,
  export_empreinte: manifeste.empreinte,
  genere_le: new Date().toISOString(),
  periode: manifeste.periode,
  resume:
    'Analyse de bouclage engendrée localement sur les chiffres de l’export, pour mesurer le cycle complet.',
  constats,
  propositions: [
    {
      id: 'p1',
      domaine: 'cognition',
      nature: 'organisation',
      titre: 'Fixer deux créneaux hebdomadaires',
      description: 'Réserver deux créneaux au même moment chaque semaine, pour ne pas décider chaque jour.',
      horizon_semaines: 8,
      indicateur_de_suivi: mesures[0].indicateur,
      lie_aux_constats: ['c1'],
      avertissement_professionnel: false,
    },
    {
      id: 'p2',
      domaine: 'corps',
      nature: 'habitude',
      titre: 'Se lever du bureau toutes les heures',
      description: 'Une pause debout par heure de travail, pour ne pas rester assis une demi-journée.',
      horizon_semaines: 4,
      indicateur_de_suivi: mesures[0].indicateur,
      lie_aux_constats: ['c1'],
      // L'IA ne le signale pas : la règle locale doit le faire à sa place.
      avertissement_professionnel: false,
    },
  ],
  questions_a_clarifier: [
    {
      id: 'q1',
      question: 'Les creux de l’historique correspondent-ils à des congés ?',
      pourquoi: 'Un creux choisi et un creux subi ne se corrigent pas de la même manière.',
    },
  ],
  qualite_des_donnees: [
    {
      domaine: 'connaissances',
      probleme: 'Plusieurs indicateurs du domaine n’ont aucune source sur la période.',
      reference: 'qualite-des-donnees.md',
    },
  ],
  limites_globales: 'Analyse engendrée pour un bouclage technique : elle ne vaut rien comme analyse.',
};

const texteAnalyse = JSON.stringify(analyse, null, 2);
const octetsAnalyse = new TextEncoder().encode(texteAnalyse).length;
console.log(`  analyse de ${octets(octetsAnalyse)}, ${constats.length} constats`);

/* ── L'import, mesuré ───────────────────────────────────────────────────── */
console.log('\nL’IMPORT');

await page.goto(`${RACINE}/importer-analyse/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#brut', { timeout: 60000 });
await page.fill('#brut', texteAnalyse);

const debutImport = Date.now();
await page.click('#verifier');
await page.waitForSelector('#bloc-apercu:not(.hidden), #bloc-erreurs:not(.hidden)', {
  timeout: 300000,
});
const msImport = Date.now() - debutImport;
console.log(`  validé et vérifié en ${secondes(msImport)}`);

const erreurs = await page.$$eval('#erreurs li', (els) => els.map((e) => e.textContent));
v('l’analyse est acceptée', await page.locator('#bloc-apercu').isVisible(), erreurs.join(' | ').slice(0, 200));
v('l’import tient en moins de deux minutes', msImport < 120_000, secondes(msImport));

if (await page.locator('#bloc-apercu').isVisible()) {
  const comptesTexte = (await page.locator('#comptes').textContent()) ?? '';
  console.log(`  ${comptesTexte.trim()}`);
  const verdicts = await page.$$eval('#constats [data-verdict]', (els) =>
    els.map((e) => e.dataset.verdict),
  );
  v(
    'les chiffres repris de l’export sont confirmés',
    verdicts.filter((x) => x === 'confirme').length >= Math.min(6, mesures.length),
    `${verdicts.filter((x) => x === 'confirme').length} confirmés`,
  );
  v(
    'le chiffre inventé n’est pas retrouvé',
    verdicts.includes('non-retrouve'),
  );
  const douteux = await page.$$eval('#constats [data-constat]', (els) =>
    els.filter((e) => e.dataset.etat === 'douteux').map((e) => e.dataset.constat),
  );
  v('et le constat qui le porte est signalé', douteux.includes('c99'), douteux.join(', '));

  const avertissements = await page.$$eval('#propositions [data-avertissement]', (els) =>
    els.map((e) => e.dataset.avertissement),
  );
  v(
    'la proposition qui touche au corps porte un avertissement',
    avertissements.includes('regle'),
    avertissements.join(', ') || 'aucun',
  );
  v('la bannière permanente est posée', ((await page.locator('#banniere').textContent()) ?? '').includes('non vérifiée'));

  /* On garde le tri par défaut, qui écarte le constat douteux. */
  await page.click('#conserver');
  await page.waitForSelector('#message-import:not(.hidden)', { timeout: 60000 });
  const conservees = await page.$$eval('#conservees [data-analyse]', (els) => els.length);
  v('l’analyse est conservée', conservees === 1);
}

const usage = await page.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0);
console.log(`\n  occupation de la base après bouclage : ${octets(usage)}`);

const lignes = [
  `# Bouclage sur ${ANNEES} ans — ${new Date().toISOString().slice(0, 10)}`,
  '',
  `- Enregistrements semés : **${total.toLocaleString('fr-FR')}** en ${secondes(msSemis)}`,
  `- Export de l’année construit en **${secondes(msExport)}**`,
  `- Poids des huit fichiers : **${octets(octetsExport)}**`,
  `- Découpage proposé : ${decoupeProposee ? 'oui' : 'non'}`,
  `- Analyse de ${octets(octetsAnalyse)}, ${constats.length} constats`,
  `- Validation, vérification et aperçu : **${secondes(msImport)}**`,
  `- Occupation de la base après bouclage : **${octets(usage)}**`,
  '',
  echecs ? `**${echecs} contrôle(s) en échec.**` : '**Tous les contrôles passent.**',
  '',
];
if (RAPPORT) {
  writeFileSync(RAPPORT, lignes.join('\n'), 'utf8');
  console.log(`  rapport écrit dans ${RAPPORT}`);
}

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} contrôle(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mBouclage complet : tout passe.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
