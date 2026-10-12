/**
 * L'import d'une analyse, par l'interface réelle.
 *
 * Ce que cet essai couvre, et qu'aucun essai pur ne peut couvrir :
 *
 * - **le cycle complet** : un export est produit, son manifeste donne
 *   l'identifiant et l'empreinte, une analyse les reprend, et l'import la
 *   rattache ;
 * - **la vérification des chiffres sur les vraies données** : un chiffre juste
 *   est confirmé, un chiffre inventé n'est pas retrouvé, et le constat qui le
 *   porte est signalé en évidence ;
 * - **les messages de refus avec leur chemin**, et le prompt de réparation ;
 * - **le tri** : une proposition ne peut pas être adoptée si son constat est
 *   écarté ;
 * - **l'analyse conservée porte son étiquette**, et son texte n'est jamais
 *   interprété — un énoncé qui contient du balisage est refusé à la validation,
 *   et un texte ordinaire est rendu tel quel.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { readFileSync } from 'node:fs';
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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 400)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 400)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const contexte = await nav.newContext({ acceptDownloads: true });
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});
page.on('dialog', (d) => void d.accept());

await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await franchirInitialisation(page, RACINE, MDP);

/*
   Deux heures de séances ce mois-ci, pour que l'indicateur de temps ait une
   valeur et qu'un chiffre cité puisse être confirmé ou démenti.
*/
const seme = await page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const maintenant = new Date();
  const seances = [];
  for (let i = 1; i <= 2; i += 1) {
    const jour = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), i))
      .toISOString()
      .slice(0, 10);
    seances.push({
      id: `01IMPORTESSAI${i}0000000000000`.slice(0, 26),
      jour,
      statut: 'terminee',
      theme: 'droit-public',
      secondes: 3600,
      termineeLe: `${jour}T10:00:00.000Z`,
      fiches: [],
      etendue: false,
    });
  }
  await new Promise((ok, ko) => {
    const tx = base.transaction('seances', 'readwrite');
    for (const s of seances) tx.objectStore('seances').put(s);
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
  return seances.length;
});
v('deux séances d’une heure sont semées', seme, 2);

/* ════════════════════════════════════════════════════════════════════════
   Un export réel, pour en reprendre l'identifiant et l'empreinte
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUN EXPORT RÉEL FOURNIT L’IDENTIFIANT ET L’EMPREINTE');

await page.goto(`${RACINE}/exporter-ia/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#categories input', { timeout: 40000 });
await page.click('#apercevoir');
await page.waitForSelector('#apercu:not(.hidden)', { timeout: 60000 });

const contenus = new Map();
page.on('download', async (d) => {
  const chemin = await d.path().catch(() => null);
  if (chemin) contenus.set(d.suggestedFilename(), readFileSync(chemin, 'utf8'));
});
await page.click('#telecharger');
await page.waitForSelector('#message-export:not(.hidden)', { timeout: 30000 });
await page.waitForTimeout(1500);

const manifeste = JSON.parse(contenus.get('manifest.json') ?? '{}');
const indicateurs = JSON.parse(contenus.get('indicateurs.json') ?? '{}');
vrai('le manifeste porte une empreinte', /^sha256:[0-9a-f]{64}$/.test(manifeste.empreinte ?? ''));

/** La valeur réellement calculée du temps de révision, pour citer juste. */
const vraieValeur = (indicateurs.valeurs ?? []).find(
  (x) => x.indicateur === 'cog.temps-revision',
)?.valeur;
v('le temps de révision du mois vaut deux heures', vraieValeur, 7200);

const analyse = (modifications = {}) => ({
  format: 'cyclades-analyse',
  version: 1,
  export_id: manifeste.export_id,
  export_empreinte: manifeste.empreinte,
  genere_le: '2026-10-12T18:00:00+02:00',
  periode: manifeste.periode,
  resume:
    'Le volume de travail du mois est faible mais régulier, et la couverture de mesure reste partielle.',
  constats: [
    {
      id: 'c1',
      domaine: 'cognition',
      type: 'tendance',
      enonce: 'Le temps de révision du mois est de deux heures, réparties sur deux jours.',
      confiance: 'moyenne',
      preuves: [
        {
          indicateur: 'cog.temps-revision',
          periode: manifeste.periode,
          valeur_citee: 7200,
          unite: 'secondes',
        },
      ],
      limites: 'La période est courte et l’effectif très faible.',
    },
  ],
  propositions: [
    {
      id: 'p1',
      domaine: 'cognition',
      nature: 'organisation',
      titre: 'Réserver deux créneaux fixes par semaine',
      description: 'Poser deux créneaux au même moment chaque semaine, pour ne pas décider chaque jour.',
      horizon_semaines: 4,
      indicateur_de_suivi: 'cog.temps-revision',
      lie_aux_constats: ['c1'],
      avertissement_professionnel: false,
    },
  ],
  questions_a_clarifier: [
    {
      id: 'q1',
      question: 'Les deux séances du mois correspondent-elles à une reprise ou à un creux ?',
      pourquoi: 'Une reprise et un creux ne se corrigent pas de la même manière.',
    },
  ],
  qualite_des_donnees: [
    {
      domaine: 'connaissances',
      probleme: 'Plusieurs indicateurs du domaine n’ont aucune source sur la période.',
      reference: 'qualite-des-donnees.md',
    },
  ],
  ...modifications,
});

const aller = async () => {
  await page.goto(`${RACINE}/importer-analyse/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#brut', { timeout: 40000 });
};

const soumettre = async (texte) => {
  await page.fill('#brut', texte);
  await page.click('#verifier');
  await page.waitForSelector('#bloc-apercu:not(.hidden), #bloc-erreurs:not(.hidden)', {
    timeout: 60000,
  });
};

/* ════════════════════════════════════════════════════════════════════════
   Un refus, avec son chemin et son prompt de réparation
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUN REFUS DIT OÙ, ET DONNE DE QUOI FAIRE CORRIGER');

await aller();
{
  const mauvaise = analyse();
  mauvaise.propositions[0].nature = 'dose';
  mauvaise.conseil_medical = 'prenez ceci';
  await soumettre('```json\n' + JSON.stringify(mauvaise) + ',\n```');

  vrai('le refus est affiché', await page.locator('#bloc-erreurs').isVisible());
  faux('et aucun aperçu', await page.locator('#bloc-apercu').isVisible());
  const enveloppe = (await page.locator('#enveloppe').textContent()) ?? '';
  vrai('l’enveloppe retirée est annoncée', enveloppe.includes('bloc de code'));
  vrai('la virgule finale aussi', enveloppe.includes('virgule'));

  const erreurs = await page.$$eval('#erreurs li', (els) =>
    els.map((e) => ({ chemin: e.dataset.chemin, texte: e.textContent })),
  );
  vrai(
    'le champ inconnu est signalé avec son chemin',
    erreurs.some((e) => e.chemin === 'conseil_medical'),
  );
  vrai(
    'la nature hors énumération aussi',
    erreurs.some((e) => e.chemin === 'propositions[0].nature'),
  );
  const reparation = (await page.locator('#reparation').textContent()) ?? '';
  vrai('le prompt de réparation porte les chemins', reparation.includes('`conseil_medical`'));
  vrai('il demande l’objet entier', reparation.includes('l’objet JSON entier'));
  vrai('et il rappelle les énumérations fermées', reparation.includes('énumérations sont fermées'));
}
{
  const balisee = analyse();
  balisee.constats[0].enonce = 'Un énoncé avec <script>alert(1)</script> dedans, et du texte.';
  await soumettre(JSON.stringify(balisee));
  const erreurs = await page.$$eval('#erreurs li', (els) => els.map((e) => e.dataset.chemin));
  vrai('du balisage dans un énoncé est refusé à la validation', erreurs.includes('constats[0].enonce'));
  faux('et rien n’est aperçu', await page.locator('#bloc-apercu').isVisible());
}

/* ════════════════════════════════════════════════════════════════════════
   Un chiffre juste est confirmé
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUN CHIFFRE JUSTE EST CONFIRMÉ SUR LES VRAIES DONNÉES');

await soumettre(JSON.stringify(analyse()));
{
  vrai('l’aperçu s’affiche', await page.locator('#bloc-apercu').isVisible());
  const rattachement = (await page.locator('#rattachement').textContent()) ?? '';
  vrai('l’export est retrouvé au journal', rattachement.includes('Rattachée à un export'));
  const comptes = (await page.locator('#comptes').textContent()) ?? '';
  vrai('un chiffre est confirmé', comptes.includes('1 confirmé'));
  vrai('et aucun n’est non retrouvé', comptes.includes('0 non retrouvé'));

  const constats = await page.$$eval('#constats [data-constat]', (els) =>
    els.map((e) => ({ id: e.dataset.constat, etat: e.dataset.etat })),
  );
  v('un constat est montré', constats.length, 1);
  v('et il est étayé', constats[0].etat, 'etaye');
  const verdicts = await page.$$eval('#constats [data-verdict]', (els) =>
    els.map((e) => e.dataset.verdict),
  );
  v('la preuve est confirmée', verdicts, ['confirme']);
  const resume = (await page.locator('#resume-analyse').textContent()) ?? '';
  vrai('le résumé de l’IA est rendu tel quel', resume.includes('couverture de mesure'));
}

/* ════════════════════════════════════════════════════════════════════════
   Un chiffre inventé n'est pas retrouvé, et le constat est signalé
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUN CHIFFRE INVENTÉ N’EST PAS RETROUVÉ');

{
  const inventee = analyse();
  inventee.constats[0].preuves[0].valeur_citee = 999999;
  await soumettre(JSON.stringify(inventee));
  const constats = await page.$$eval('#constats [data-constat]', (els) =>
    els.map((e) => ({ etat: e.dataset.etat, classe: e.className })),
  );
  v('le constat est douteux', constats[0].etat, 'douteux');
  vrai('et signalé en évidence', constats[0].classe.includes('border-red-400'));
  const verdicts = await page.$$eval('#constats [data-verdict]', (els) =>
    els.map((e) => e.dataset.verdict),
  );
  v('la preuve n’est pas retrouvée', verdicts, ['non-retrouve']);
  const comptes = (await page.locator('#comptes').textContent()) ?? '';
  vrai('le compte le dit', comptes.includes('1 non retrouvé'));
}
{
  const unite = analyse();
  unite.constats[0].preuves[0].valeur_citee = 2;
  unite.constats[0].preuves[0].unite = 'heures';
  await soumettre(JSON.stringify(unite));
  const verdicts = await page.$$eval('#constats [data-verdict]', (els) =>
    els.map((e) => e.dataset.verdict),
  );
  v('une unité qui ne correspond pas rend « non vérifiable »', verdicts, ['non-verifiable']);
  const raison = (await page.locator('#constats [data-verdict] span:last-child').textContent()) ?? '';
  vrai('et la raison refuse de convertir', raison.includes('aucune conversion n’est devinée'));
}
{
  const approchee = analyse();
  approchee.constats[0].preuves[0].valeur_citee = 7500;
  await soumettre(JSON.stringify(approchee));
  const verdicts = await page.$$eval('#constats [data-verdict]', (els) =>
    els.map((e) => e.dataset.verdict),
  );
  v('un arrondi raisonnable est « approché »', verdicts, ['approche']);
  const constats = await page.$$eval('#constats [data-constat]', (els) =>
    els.map((e) => e.dataset.etat),
  );
  v('et le constat reste étayé', constats, ['etaye']);
}

/* ════════════════════════════════════════════════════════════════════════
   Un export inconnu reste importable, avec un avertissement
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUN EXPORT INCONNU RESTE IMPORTABLE');

{
  const etrangere = analyse({ export_id: '01INCONNU0000000000000000' });
  await soumettre(JSON.stringify(etrangere));
  vrai('l’aperçu s’affiche quand même', await page.locator('#bloc-apercu').isVisible());
  const rattachement = (await page.locator('#rattachement').textContent()) ?? '';
  vrai('et l’avertissement est posé', rattachement.includes('n’est pas au journal'));
}

/* ════════════════════════════════════════════════════════════════════════
   Le tri, et sa règle
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE TRI REFUSE D’ADOPTER UNE ACTION DONT LE CONSTAT EST ÉCARTÉ');

await soumettre(JSON.stringify(analyse()));
{
  v(
    'un constat étayé est gardé par défaut',
    await page.locator('[data-sort-constat="c1:garde"]').getAttribute('aria-pressed'),
    'true',
  );
  v(
    'et une proposition est reportée par défaut',
    await page.locator('[data-sort-proposition="p1:reportee"]').getAttribute('aria-pressed'),
    'true',
  );
  vrai('« Conserver » est actif', await page.locator('#conserver').isEnabled());

  await page.click('[data-sort-proposition="p1:adoptee"]');
  await page.click('[data-sort-constat="c1:ecarte"]');
  await page.waitForTimeout(200);
  faux('adopter une action dont le constat est écarté désactive « Conserver »', await page.locator('#conserver').isEnabled());
  const motifs = (await page.locator('#motifs-tri').textContent()) ?? '';
  vrai('et le motif l’explique', motifs.includes('sans justification'));

  await page.click('[data-sort-constat="c1:garde"]');
  await page.waitForTimeout(200);
  vrai('garder le constat rétablit « Conserver »', await page.locator('#conserver').isEnabled());
}

console.log('\nL’ANALYSE CONSERVÉE PORTE SON ÉTIQUETTE');

{
  await page.click('#conserver');
  await page.waitForSelector('#message-import:not(.hidden)', { timeout: 30000 });
  const message = (await page.locator('#message-import').textContent()) ?? '';
  vrai('le message porte l’étiquette', message.includes('produite par une IA, non vérifiée'));
  vrai('et rappelle le plafond de trajectoires', message.includes('plafond de 3'));

  const conservees = await page.$$eval('#conservees [data-analyse]', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  v('une analyse est conservée', conservees.length, 1);
  vrai('elle porte son étiquette', conservees[0].includes('non vérifiée'));
  vrai('et sa période', conservees[0].includes(manifeste.periode.debut));

  /* L'opération journalisée porte l'étiquette, pas seulement l'écran. */
  const lu = await page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const tout = await new Promise((ok, ko) => {
      const d = base.transaction('operations').objectStore('operations').getAll();
      d.onsuccess = () => ok(d.result);
      d.onerror = () => ko(d.error);
    });
    base.close();
    const analyses = tout.filter((o) => o.type === 'analyse.importee');
    return {
      combien: analyses.length,
      etiquette: analyses[0]?.charge?.etiquette,
      tri: JSON.stringify(analyses[0]?.charge?.tri ?? null),
      verdicts: JSON.stringify(
        (analyses[0]?.charge?.verifications ?? []).map((x) => x.etat),
      ),
    };
  });
  v('une opération d’analyse est journalisée', lu.combien, 1);
  v('elle porte l’étiquette obligatoire', lu.etiquette, 'analyse externe produite par une IA, non vérifiée');
  vrai('le tri appliqué est conservé', lu.tri.includes('adoptee'));
  vrai('et les verdicts de vérification aussi', lu.verdicts.includes('etaye'));
}

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
