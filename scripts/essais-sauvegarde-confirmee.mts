/**
 * Une sauvegarde n'est « réussie » qu'une fois constatée (A3 du prompt 43).
 *
 *   npm run essais:sauvegarde-confirmee
 *
 * ## Le défaut, et pourquoi il était invisible
 *
 * Onze endroits du site faisaient la même chose, de la même façon fausse :
 * créer une URL de blob, cliquer un lien de téléchargement, puis révoquer
 * l'URL **immédiatement**. Or `click()` ne télécharge pas : il demande au
 * navigateur de télécharger, et le navigateur lira l'URL à son rythme.
 * Chrome tolère, parce qu'il a déjà pris une référence au blob ; Safari —
 * donc l'iPhone — ne tolère pas toujours, et le fichier arrive vide.
 *
 * Pire, sur l'écran de sauvegarde : juste après le clic, le code appelait
 * `noterSauvegardeReussie()` et affichait « Sauvegarde téléchargée », sous
 * un commentaire qui affirmait « après que le fichier est réellement
 * parti ». Le commentaire était faux, et c'est lui qui rendait le défaut
 * invisible en relecture — on lisait l'intention, pas le code.
 *
 * ## Les deux contrôles, et ce que chacun peut prouver
 *
 * 1. **Un contrôle de structure**, qui lit les sources : plus un seul
 *    `URL.revokeObjectURL` hors des deux modules qui ont le droit d'en
 *    avoir. C'est le seul moyen d'empêcher le retour du défaut : il était
 *    onze fois dans le site parce que chacun l'avait réécrit à la main.
 * 2. **Un parcours dans un navigateur** : la sauvegarde annonce un
 *    téléchargement LANCÉ, demande confirmation, et ne note la date que
 *    lorsque la personne confirme avoir retrouvé le fichier.
 *
 * ## Ce qu'aucun des deux ne peut prouver
 *
 * Que le fichier soit réellement arrivé sur le disque. Le web ne le dit pas
 * — pas d'événement, pas de promesse, pas d'accès au dossier de
 * destination — et c'est précisément la raison d'être de la confirmation
 * humaine. Un essai qui prétendrait le vérifier mentirait comme l'écran
 * mentait.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
process.on('uncaughtException', (e: unknown) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

/* ── 1. Une seule porte, et deux exceptions déclarées ──────────────────── */

console.log('\n\x1b[1mUNE SEULE PORTE POUR REMETTRE UN FICHIER\x1b[0m\n');

/**
 * Les seuls fichiers autorisés à manipuler une URL de blob eux-mêmes.
 *
 * Chacun avec sa raison, et la taille de la liste est vérifiée : l'allonger
 * doit être un geste visible en relecture, pas une ligne ajoutée pour faire
 * passer un essai.
 */
const AUTORISES: Record<string, string> = {
  'src/lib/telecharger.ts': 'C’est la porte elle-même.',
  'src/lib/podcast.ts':
    'Ce n’est pas un téléchargement : le lecteur audio révoque l’URL de la ' +
    'piste précédente quand il en charge une autre. Révoquer tôt est ici ' +
    'exactement ce qu’il faut faire.',
};

const fichiers: string[] = [];
const parcourir = (dossier: string) => {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) parcourir(chemin);
    else if (/\.(ts|svelte|astro|mts)$/.test(entree)) fichiers.push(chemin);
  }
};
parcourir('src');

const fautifs: string[] = [];
for (const chemin of fichiers) {
  const normalise = chemin.replace(/\\/g, '/');
  if (normalise in AUTORISES) continue;
  const texte = readFileSync(chemin, 'utf8');
  /* Les commentaires citent le défaut ; seul le code compte. */
  const code = texte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\*.*$/gm, '')
    .replace(/\/\/.*$/gm, '');
  if (/URL\.revokeObjectURL|createObjectURL/.test(code)) fautifs.push(normalise);
}

v(`aucun des ${fichiers.length} fichiers de src/ ne fabrique son propre téléchargement`, fautifs, []);
v('la liste des exceptions n’a pas grossi en silence', Object.keys(AUTORISES).length, 2);
for (const [chemin, raison] of Object.entries(AUTORISES)) {
  v(`« ${chemin} » porte sa raison`, raison.length > 20, true);
}

/* ── 2. La porte ne révoque pas tout de suite ──────────────────────────── */

{
  const porte = readFileSync('src/lib/telecharger.ts', 'utf8');
  v(
    'la révocation est différée, pas immédiate',
    /setTimeout\([\s\S]{0,200}revokeObjectURL/.test(porte),
    true,
  );
  v(
    'et le départ de page sert de garde-fou',
    /addEventListener\('pagehide'/.test(porte),
    true,
  );
  v(
    'le lien est posé dans le document avant d’être cliqué',
    /appendChild\(lien\)[\s\S]{0,80}lien\.click\(\)/.test(porte),
    true,
  );
}

/* ── 3. L'écran dit « lancé », puis demande la preuve ──────────────────── */

console.log('\n\x1b[1mL’ÉCRAN NE DIT PAS « RÉUSSI » AVANT D’EN SAVOIR QUELQUE CHOSE\x1b[0m\n');

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

{
  const ctx = await nav.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);

  const telechargements: string[] = [];
  page.on('download', (d) => {
    telechargements.push(d.suggestedFilename());
    void d.saveAs(`/tmp/essai-sauvegarde-${telechargements.length}.cyclades`);
  });

  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(1200);
  }
  await page.waitForSelector('#sauvegarder', { timeout: 30000 });

  const avant = (await page.locator('#etat-sauvegarde-texte').textContent()) ?? '';
  v('au départ, aucune sauvegarde n’est connue', /Aucune sauvegarde/.test(avant), true);

  await page.fill('#mdp-sauvegarde', MDP);
  await page.click('#sauvegarder');
  await page.waitForTimeout(4000);

  v('un fichier a bien été offert au navigateur', telechargements.length, 1);

  const message = (await page.locator('#message-sauvegarde').textContent()) ?? '';
  v('l’écran dit que le téléchargement est lancé', /[Tt]éléchargement lancé/.test(message), true);
  v('et il ne dit pas « téléchargée » tout court', /Sauvegarde téléchargée/.test(message), false);
  v(
    'la demande de confirmation est posée',
    await page.locator('#confirmer-sauvegarde').isVisible(),
    true,
  );
  const pasEncore = (await page.locator('#etat-sauvegarde-texte').textContent()) ?? '';
  v(
    'et la date de dernière sauvegarde n’a PAS bougé',
    /Aucune sauvegarde/.test(pasEncore),
    true,
  );

  /* « Je ne le trouve pas » : rien n'est noté, et l'écran le dit. */
  await page.click('#sauvegarde-introuvable');
  await page.waitForTimeout(600);
  const refus = (await page.locator('#message-sauvegarde').textContent()) ?? '';
  v('un échec constaté le dit', /Rien n’a été confirmé/.test(refus), true);
  v(
    'et la date n’a toujours pas bougé',
    /Aucune sauvegarde/.test((await page.locator('#etat-sauvegarde-texte').textContent()) ?? ''),
    true,
  );

  /* Puis la confirmation, qui est la seule preuve disponible. */
  await page.fill('#mdp-sauvegarde', MDP);
  await page.click('#sauvegarder');
  await page.waitForTimeout(4000);
  await page.click('#sauvegarde-retrouvee');
  await page.waitForTimeout(1500);

  const apres = (await page.locator('#message-sauvegarde').textContent()) ?? '';
  v('une fois confirmée, l’écran le dit', /Sauvegarde confirmée/.test(apres), true);
  v(
    'la demande de confirmation se referme',
    await page.locator('#confirmer-sauvegarde').isVisible(),
    false,
  );
  const etat = (await page.locator('#etat-sauvegarde-texte').textContent()) ?? '';
  v(
    'et la date de dernière sauvegarde est enfin notée',
    /Aucune sauvegarde/.test(etat),
    false,
  );
  console.log(`      état final : « ${etat.slice(0, 80)} »`);

  /* ── A6 : la confirmation de restauration dit ce qu'on perd ───────────── */

  console.log('\n\x1b[1mLA RESTAURATION DIT DE QUAND DATE LA SAUVEGARDE, ET CE QU’ELLE ÉCRASE\x1b[0m\n');

  /*
     POURQUOI CE CONTRÔLE. L'ancien texte disait « Ce qui est enregistré ici
     sera écrasé par le contenu de la sauvegarde ». Vrai, et inutilisable :
     ni la date de la sauvegarde, ni ce qu'il y a à perdre. C'est pourtant là
     qu'une erreur coûte tout — restaurer une sauvegarde de mars sur trois
     mois de travail, en croyant prendre la dernière.

     L'essai relit le fichier qu'il vient de télécharger, demande à
     l'appliquer, et LIT LA BOÎTE sans la valider. Rien n'est restauré : ce
     qu'on mesure est le texte du choix, pas son effet.
  */
  await page.setInputFiles('#fichier-cyclades', '/tmp/essai-sauvegarde-2.cyclades');
  await page.waitForTimeout(2500);
  const apercuVu = await page.locator('#apercu-cyclades').isVisible().catch(() => false);
  v('le fichier relu est accepté et son aperçu s’affiche', apercuVu, true);

  if (apercuVu) {
    await page.fill('#mdp-restauration', MDP);
    await page.click('#appliquer-cyclades');
    await page.waitForTimeout(900);
    const boite = page.locator('dialog.boite');
    const parue = (await boite.count()) > 0 && (await boite.isVisible());
    v('la confirmation s’ouvre', parue, true);
    const dit = (parue ? ((await boite.textContent()) ?? '') : '').replace(/\s+/g, ' ');
    v(
      'elle dit QUAND la sauvegarde a été faite',
      /a été faite le \d{2}\/\d{2}\/\d{4}/.test(dit),
      true,
    );
    v(
      'elle dit COMBIEN elle porte d’enregistrements',
      /porte \d+ enregistrement/.test(dit),
      true,
    );
    v(
      'elle dit ce que ce navigateur porte aujourd’hui',
      /navigateur en porte aujourd’hui \d+/.test(dit),
      true,
    );
    v(
      'et elle détaille en cartes, quiz et journées',
      /carte\(s\) suivie\(s\)[\s\S]*quiz[\s\S]*journée\(s\)/.test(dit),
      true,
    );
    v('elle parle de l’instantané', /instantané/.test(dit), true);
    /* On annule : cet essai mesure le texte du choix, pas la restauration. */
    const annuler = boite.locator('button', { hasText: /Annuler|Non|Fermer/ }).first();
    if (await annuler.count()) await annuler.click();
    await page.waitForTimeout(400);
    v('et on peut en sortir sans rien restaurer', await boite.isVisible().catch(() => false), false);
  } else {
    for (const quoi of [
      'la confirmation s’ouvre',
      'elle dit QUAND la sauvegarde a été faite',
      'elle dit COMBIEN elle porte d’enregistrements',
      'elle dit ce que ce navigateur porte aujourd’hui',
      'et elle détaille en cartes, quiz et journées',
      'elle parle de l’instantané',
      'et on peut en sortir sans rien restaurer',
    ]) {
      v(quoi, 'aperçu non affiché', true);
    }
  }
  await ctx.close();
}

await nav.close();
console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m\n'
    : `\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m\n`,
);
process.exit(rouges === 0 ? 0 : 1);
