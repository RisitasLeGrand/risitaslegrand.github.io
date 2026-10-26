/**
 * B1 — « Restaurer une sauvegarde » est offert dès la première question.
 *
 *   npm run essais:restauration-initialisation
 *
 * ## Le défaut
 *
 * Quelqu'un qui arrive sur un appareil neuf avec son fichier de sauvegarde
 * répondait à tout le questionnaire pour rien. Il devait ensuite trouver
 * « Sauvegarde » de lui-même, et ce qu'il restaurait écrasait ce qu'il venait
 * de saisir. Rien, nulle part, ne lui disait qu'il y avait un chemin plus
 * court.
 *
 * ## Ce que cet essai mesure, et pourquoi de bout en bout
 *
 * Une offre serait un piège si le chemin n'aboutissait pas. L'essai ne se
 * contente donc pas de vérifier qu'un lien existe : il **fabrique une
 * sauvegarde** depuis l'écran, repart d'un profil NEUF, suit le lien,
 * restaure, et regarde ce qu'il y a après. Quatre parties, dans l'ordre où
 * une personne les vit.
 *
 * Il fabrique sa sauvegarde plutôt que d'en porter une : un fichier
 * d'exemple se périmerait au premier changement de format, et il faudrait le
 * commiter — or une sauvegarde porte des données.
 *
 * ## Le mot de passe
 *
 * Lu par `motDePasseEssais()`, qui va le chercher hors du dépôt. Il n'est
 * écrit nulle part ici, et la sauvegarde fabriquée vit dans un dossier
 * temporaire hors du dépôt, effacé à la fin.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium } from 'playwright-core';

import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreALaBoite } from './lib/boite-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const v = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
const vrai = (quoi, obtenu) => v(quoi, Boolean(obtenu), true);
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const dossier = await mkdtemp(path.join(tmpdir(), 'cyclades-sauvegarde-'));
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/** Un contexte neuf : aucune base, aucun profil, rien de mémorisé. */
async function unProfilNeuf() {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    acceptDownloads: true,
  });
  return { ctx, page: await ctx.newPage() };
}

/** Rouvre le verrou du site si l'écran le redemande. */
async function deverrouiller(page) {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(1000);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   1. La première question offre la restauration
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLA PREMIÈRE QUESTION OFFRE LA RESTAURATION');
{
  const { ctx, page } = await unProfilNeuf();
  await page.goto(`${RACINE}/initialisation/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#question', { timeout: 30000 });
  await page.waitForTimeout(1200);

  /* La prémisse : on est bien à la PREMIÈRE question, et pas ailleurs. */
  v('on est à la première question', (await page.locator('#compteur').textContent())?.trim().startsWith('1 /'), true);

  /*
     LE RELEVÉ EST PRIS UNE FOIS, ET LA SUITE S'Y RÉFÈRE.

     Sans cette garde, l'essai mourait sur un « textContent: Timeout 30000ms
     exceeded » dès que le bloc manquait — une panne illisible au lieu d'un
     rouge. Le sabotage l'a montré, et c'est la même leçon que plusieurs essais
     de ce dépôt ont déjà payée : un contrôle doit échouer lisiblement.
  */
  const offre = page.locator('#offre-restauration');
  const parue = await offre.isVisible().catch(() => false);
  vrai('l’offre de restauration est visible', parue);
  const dit = parue ? ((await offre.textContent()) ?? '').replace(/\s+/g, ' ').trim() : '';
  vrai('elle parle de sauvegarde', /sauvegarde/i.test(dit));
  vrai(
    'et elle dit ce qu’on y gagne : ne pas répondre à ces questions',
    /plutôt que de répondre|n’aurez pas à répondre/i.test(dit),
  );
  const href = parue ? ((await offre.locator('a').first().getAttribute('href')) ?? '') : '';
  vrai(`le lien mène à la restauration (${href || 'aucun'})`, /\/progression\/#restaurer$/.test(href));

  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   2. La restauration réussit, et le chemin aboutit
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLA SAUVEGARDE SE FABRIQUE, PUIS SE RESTAURE SUR UN PROFIL NEUF');

/** Fabrique une sauvegarde depuis l'écran, et rend son chemin sur le disque. */
async function fabriquerUneSauvegarde(marque) {
  const { ctx, page } = await unProfilNeuf();
  await franchirInitialisation(page, RACINE, MDP);
  /* Une donnée reconnaissable, pour savoir ensuite si elle est revenue. */
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForTimeout(1500);
  await page.locator('#kg').fill(String(marque));
  await page.locator('#peser').click();
  await page.waitForTimeout(1200);

  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForTimeout(1500);
  await page.fill('#mdp-sauvegarde', MDP);
  const attente = page.waitForEvent('download', { timeout: 60000 });
  await page.click('#sauvegarder');
  const telechargement = await attente;
  const chemin = path.join(dossier, 'sauvegarde.cyclades');
  await telechargement.saveAs(chemin);
  await ctx.close();
  return chemin;
}

/** Suit le chemin d'une personne qui restaure, et rend ce qu'elle a vu. */
async function restaurerDepuis(page, chemin, motDePasse) {
  await page.goto(`${RACINE}/progression/#restaurer`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#fichier-cyclades', { timeout: 30000 });
  await page.locator('#fichier-cyclades').setInputFiles(chemin);
  await page.waitForTimeout(2500);
  const verifie = (await page.locator('#apercu-cyclades:not(.hidden)').count()) > 0;
  if (!verifie) {
    return { verifie, message: ((await page.locator('#message-cyclades').textContent()) ?? '').trim() };
  }
  await page.fill('#mdp-restauration', motDePasse);
  await page.locator('#avec-instantane').uncheck().catch(() => {});
  await page.click('#appliquer-cyclades');
  await page.waitForTimeout(800);
  await repondreALaBoite(page, 'Remplacer').catch(() => {});
  await page.waitForTimeout(4000);
  return { verifie, message: ((await page.locator('#message-cyclades').textContent()) ?? '').trim() };
}

const MARQUE = 77;
const sauvegarde = await fabriquerUneSauvegarde(MARQUE);
{
  const { ctx, page } = await unProfilNeuf();
  const issue = await restaurerDepuis(page, sauvegarde, MDP);
  vrai('le fichier est vérifié avant d’être appliqué', issue.verifie);
  vrai(
    `la restauration est faite, et elle le dit (« ${issue.message.slice(0, 60)} »)`,
    /Restauration faite/i.test(issue.message),
  );

  /* ── 3. L'initialisation est considérée comme faite ───────────────── */
  console.log('\nENSUITE, L’INITIALISATION N’EST PAS REDEMANDÉE');
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForTimeout(2500);
  const apres = await page.evaluate((marque) => ({
    questionnaire: Boolean(document.getElementById('question')),
    url: location.pathname,
    porteLaMarque: new RegExp(String(marque)).test(document.body.innerText),
  }), MARQUE);
  v('aucun questionnaire ne reparaît', apres.questionnaire, false);
  v('on est bien resté sur l’écran demandé', apres.url, '/odyssee/corps/');
  vrai(`la donnée restaurée est là (${MARQUE} kg)`, apres.porteLaMarque);
  await ctx.close();
}

/*
   LE CAS TÉMOIN, ET CE N'EST PAS UN SABOTAGE : c'en est le contraire utile.

   « Aucun questionnaire ne reparaît » ne vaut que si un profil neuf, LUI, en
   voit un. Sans ce témoin, l'assertion passerait aussi sur un site qui ne
   pose jamais de question — et ne mesurerait donc rien de la restauration.
*/
console.log('\nET LE TÉMOIN : UN PROFIL NEUF, LUI, VOIT BIEN LE QUESTIONNAIRE');
{
  const { ctx, page } = await unProfilNeuf();
  await page.goto(`${RACINE}/initialisation/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForTimeout(2000);
  vrai(
    'un profil neuf voit le questionnaire',
    (await page.locator('#question').count()) > 0,
  );
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Une fois des réponses données, l'offre dit ce qu'elle remplacera
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nQUESTIONNAIRE COMMENCÉ : L’OFFRE PRÉVIENT');
{
  const { ctx, page } = await unProfilNeuf();
  await page.goto(`${RACINE}/initialisation/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#question', { timeout: 30000 });
  await page.waitForTimeout(1200);

  /* On répond à la première question comme une personne le ferait. */
  const champ = page.locator('#saisie input, #saisie textarea, #saisie select').first();
  if ((await champ.count()) > 0) {
    const genre = await champ.evaluate((e) => e.tagName.toLowerCase() + ':' + (e.getAttribute('type') ?? ''));
    if (genre.startsWith('input:text') || genre.startsWith('input:') || genre.startsWith('textarea')) {
      await champ.fill('Essai').catch(() => {});
    }
  }
  await page.click('#valider');
  await page.waitForTimeout(1500);

  const compteur = ((await page.locator('#compteur').textContent()) ?? '').trim();
  /*
     LA PRÉMISSE : on a bien avancé. Si « Continuer » n'a pas changé d'écran —
     un champ obligatoire resté vide, par exemple —, la suite mesurerait le
     texte de la PREMIÈRE question, et rendrait un rouge qui n'en est pas un.
  */
  const avance = !compteur.startsWith('1 /');
  vrai(`on a avancé dans le questionnaire (compteur « ${compteur} »)`, avance);
  if (avance) {
    /* Même garde qu'en partie 1 : on relève une fois, puis on juge. */
    const bloc = page.locator('#offre-restauration');
    const la = (await bloc.count()) > 0;
    const dit = la ? ((await bloc.textContent()) ?? '').replace(/\s+/g, ' ').trim() : '';
    vrai('l’offre est toujours là', la && dit.length > 0);
    vrai('et elle prévient qu’elle remplacera les réponses', /remplacer/i.test(dit));
    vrai(
      'elle ne promet plus de faire gagner le questionnaire',
      !/plutôt que de répondre/i.test(dit),
    );
  }
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Un fichier abîmé est refusé, et rien n'est touché
   ══════════════════════════════════════════════════════════════════════════ */

/*
   C'est le refus qu'on mesure, pas la réussite : une restauration qui
   accepterait un fichier tronqué écrirait une base à moitié remplacée, et
   c'est le seul geste de l'application qu'on ne peut pas rattraper.
*/
console.log('\nUN FICHIER ABÎMÉ EST REFUSÉ');
{
  const { readFile, writeFile } = await import('node:fs/promises');
  const abime = path.join(dossier, 'abime.cyclades');
  const octets = await readFile(sauvegarde);
  await writeFile(abime, octets.subarray(0, Math.floor(octets.length / 2)));

  const { ctx, page } = await unProfilNeuf();
  const issue = await restaurerDepuis(page, abime, MDP);
  vrai('le fichier tronqué n’est pas accepté', !issue.verifie);
  vrai(
    `et le refus est dit (« ${issue.message.slice(0, 70)} »)`,
    issue.message.length > 0,
  );

  /* Et la base n'a rien reçu : le questionnaire est toujours à faire. */
  await page.goto(`${RACINE}/initialisation/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForTimeout(2000);
  vrai(
    'rien n’a été appliqué : le questionnaire est toujours là',
    (await page.locator('#question').count()) > 0,
  );
  await ctx.close();
}

await nav.close();
await rm(dossier, { recursive: true, force: true });
console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${rouges} rouge${rouges > 1 ? 's' : ''}.\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
