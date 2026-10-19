/**
 * M9 — le lecteur d'écran et le mouvement réduit, sur ce que les lots 46 et
 * 55 ont ajouté.
 *
 *   npm run essais:acces-m9
 *
 * ## Pourquoi un essai à part, et non un ajout à `essais:accessibilite`
 *
 * L'essai d'accessibilité du socle le dit lui-même : il ne couvre pas « les
 * champs que du JavaScript crée après coup, et ceux qui vivent derrière une
 * porte — un formulaire qui n'apparaît qu'après un clic ». Or **tout** ce que
 * mes deux lots ajoutent est de cette nature : la liste des parties, les
 * boutons d'écoute des titres et les cases du volet d'une séance n'existent
 * qu'après le déchiffrement, et le volet ne s'ouvre qu'au clic. Cet essai
 * comble ce trou déclaré, il ne double rien.
 *
 * ## Les noms accessibles sont pris dans l'ARBRE DU NAVIGATEUR
 *
 * Et non recalculés ici. `locator.ariaSnapshot()` rend le rôle et le nom tels
 * que Playwright les calcule selon la spécification — `aria-label`, puis
 * `aria-labelledby`, puis le contenu. Un essai qui refait ce calcul à sa
 * façon finit par mesurer sa propre approximation, et passe au vert sur un
 * nom qu'aucun lecteur d'écran n'annoncerait ainsi.
 *
 * (`page.accessibility` aurait servi aussi, mais il a été retiré de
 * Playwright 1.64 : la première version de cet essai l'appelait et tombait
 * sur `undefined`.)
 *
 * ## Les trois points de M9, et ce qui est mesuré pour chacun
 *
 * 1. **Un nom accessible pour chaque cible**, et — ce que M9 implique sans
 *    l'écrire — un nom **distinct** : trois boutons nommés « Écouter à partir
 *    d'ici » sont, pour qui liste les boutons, trois boutons indiscernables.
 * 2. **L'annonce des changements.** Les erreurs du lecteur s'annoncent ; le
 *    compteur de temps restant, non. Une région vivante qui se réécrit
 *    plusieurs fois par seconde n'informe pas, elle empêche d'écouter.
 * 3. **Le mouvement réduit** : mesuré sur les éléments ajoutés, sous la
 *    préférence système émulée.
 *
 * ## Le laboratoire
 *
 * Même protocole que les deux autres essais de ce lot : « content/ » bâti
 * depuis « content-exemple/ », mot de passe FACTICE, aperçu sur le port 4322,
 * tout effacé ensuite. Il refuse de tourner si « content/ », « .env.local »,
 * le témoin local ou « public/data/ » existent déjà.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { idStable } from './lib/crypto.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOT_DE_PASSE = 'laboratoire-m9-sans-valeur';
const PORT = 4322;
const RACINE_WEB = `http://localhost:${PORT}`;
const LUNDI = '2026-10-19';

const AVEC_PARTIES = 'droit-public/fascicule-1/fiche-01-hierarchie-des-normes.md';
const REPERES = [
  { id: 'i-larchitecture-de-lordre-juridique-interne', debut: 26.59 },
  { id: 'ii-le-contrôle-de-constitutionnalité', debut: 64.95 },
  { id: 'iii-larticulation-avec-le-droit-international', debut: 106.49 },
];

let rouges = 0;
const vert = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t: string) => `\x1b[31m${t}\x1b[0m`;
const jaune = (t: string) => `\x1b[33m${t}\x1b[0m`;

function verifier(quoi: string, vrai: boolean, detail = '') {
  if (vrai) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    rouges += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? ` — ${detail}` : ''}`);
  }
}

const gardes = [
  ['content', path.join(racine, 'content')],
  ['.env.local', path.join(racine, '.env.local')],
  ['public/data', path.join(racine, 'public', 'data')],
  ['.temoin-mot-de-passe.local.json', path.join(racine, '.temoin-mot-de-passe.local.json')],
] as const;

const occupes = gardes.filter(([, chemin]) => existsSync(chemin)).map(([nom]) => nom);
if (occupes.length) {
  console.log(
    `\n${rouge('✗ REFUS')} — ${occupes.join(', ')} existe déjà.\n` +
      '  Cet essai construit un site de laboratoire avec un mot de passe factice\n' +
      '  et efface tout derrière lui : il ne travaillera pas par-dessus du réel.',
  );
  process.exit(1);
}

const node = (script: string, env: Record<string, string> = {}) =>
  execFileSync(process.execPath, [path.join(racine, 'scripts', script)], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

function nettoyer() {
  try {
    execFileSync('npx', ['astro', 'preview', 'stop'], { cwd: racine, stdio: 'ignore' });
  } catch {
    /* aucun aperçu à arrêter */
  }
  for (const [, chemin] of gardes) rmSync(chemin, { recursive: true, force: true });
  rmSync(path.join(racine, 'dist'), { recursive: true, force: true });
}

/**
 * Les { rôle, nom } d'un instantané `ariaSnapshot`.
 *
 * Son format est une ligne par nœud : « - button "Reculer de 15 secondes" »,
 * parfois suivie de « : » et du texte visible, et indentée pour les enfants.
 * On ne garde que le rôle et le nom — c'est tout ce que M9 demande de juger.
 */
function rolesEtNoms(instantane: string): { role: string; name: string }[] {
  const sortie: { role: string; name: string }[] = [];
  for (const ligne of instantane.split('\n')) {
    const trouve = /^\s*-\s+([a-z]+)(?:\s+"((?:[^"\\]|\\.)*)")?/.exec(ligne);
    if (trouve) sortie.push({ role: trouve[1], name: trouve[2] ?? '' });
  }
  return sortie;
}

let nav: Awaited<ReturnType<typeof chromium.launch>> | null = null;

try {
  console.log('\nLA CONSTRUCTION DU LABORATOIRE');
  node('init-contenu.mjs');
  writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);
  node('podcasts.mjs', { REVINSP_SANS_PODCAST: '1' });

  const dossierAudio = path.join(racine, 'content', '.audio');
  mkdirSync(dossierAudio, { recursive: true });
  const id = await idStable(AVEC_PARTIES);
  writeFileSync(path.join(dossierAudio, `${id}.opus`), Buffer.alloc(2048, 7));
  writeFileSync(
    path.join(dossierAudio, `${id}.json`),
    JSON.stringify({
      empreinte: 'x',
      secondes: 153.8,
      octets: 2048,
      moteur: 'kokoro',
      parties: REPERES,
    }),
  );

  node('build-content.mjs');
  execFileSync('npx', ['astro', 'build'], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, REVINSP_SANS_PODCAST: '1' },
  });
  rmSync(path.join(racine, '.env.local'), { force: true });

  spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: racine,
    detached: true,
    stdio: 'ignore',
  }).unref();
} catch (erreur) {
  console.log(`\n${rouge('✗ PANNE')} — le laboratoire n’a pas pu être construit.`);
  console.log(String((erreur as Error)?.message ?? erreur).slice(0, 700));
  nettoyer();
  process.exit(1);
}

try {
  for (let essai = 0; essai < 40; essai++) {
    try {
      if ((await fetch(`${RACINE_WEB}/data/cle.json`)).ok) break;
    } catch {
      /* pas encore debout */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  nav = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const contexte = await nav.newContext();
  const page = await contexte.newPage();
  const ficheAvec = await idStable(AVEC_PARTIES);

  async function deverrouiller(url: string, attendre: string) {
    await page.goto(url, { waitUntil: 'networkidle' });
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MOT_DE_PASSE);
      await page.click('#bouton-verrou');
    }
    await page.waitForSelector(attendre, { timeout: 30000 });
    await page.waitForTimeout(800);
  }

  /* ══════════════════════════════════════════════════════════════════════
     1. LA RÉGION VIVANTE EXISTE DÈS LE CHARGEMENT
     ══════════════════════════════════════════════════════════════════════ */

  console.log('\nLA RÉGION DES BULLES EXISTE DÈS LE CHARGEMENT');

  await deverrouiller(
    `${RACINE_WEB}/fiche/?id=${encodeURIComponent(ficheAvec)}`,
    '#fiche:not(.hidden)',
  );

  /*
     LE DÉFAUT QUE CECI GARDE. La zone était créée paresseusement, au premier
     appel de `notifier` — donc dans le même tour de boucle que l'insertion de
     la bulle. Un lecteur d'écran enregistre une région `aria-live` quand elle
     entre dans l'arbre : du contenu inséré dans une région née à l'instant
     même n'est pas annoncé. La PREMIÈRE bulle de chaque page était donc
     perdue pour VoiceOver et TalkBack — et ces bulles sont ce par quoi
     l'application dit « pointage fait » ou signale une erreur.

     Rien ne se voyait à l'œil : la bulle s'affichait normalement.
  */
  const zone = await page.evaluate(() => {
    const e = document.getElementById('zone-notifications');
    return e ? { live: e.getAttribute('aria-live'), bulles: e.children.length } : null;
  });
  verifier('la zone des bulles est dans le document', zone !== null);
  verifier('elle porte « aria-live=polite »', zone?.live === 'polite', String(zone?.live));
  verifier(
    'et elle est VIDE — donc posée avant toute bulle, pas avec la première',
    zone?.bulles === 0,
    `${zone?.bulles} enfant(s)`,
  );

  /* ══════════════════════════════════════════════════════════════════════
     2. UN NOM ACCESSIBLE, ET DISTINCT, POUR CHAQUE CIBLE
     ══════════════════════════════════════════════════════════════════════ */

  console.log('\nLE LECTEUR — un nom pour chaque cible, pris dans l’arbre du navigateur');

  /*
     ON CHARGE L'AUDIO D'ABORD, et ce n'est pas un détail d'essai : les
     commandes de saut et de vitesse sont `hidden` jusqu'au déchiffrement, donc
     ABSENTES de l'arbre d'accessibilité — ce qui est juste, un contrôle caché
     n'a pas à être annoncé. Les lire avant le clic mesurerait leur absence et
     la prendrait pour un défaut de nommage. La première version de cet essai
     faisait exactement cela.
  */
  await page.click('#podcast-bouton');
  await page.waitForSelector('#podcast-commandes:not(.hidden)', { timeout: 20000 });
  await page.waitForTimeout(400);

  const arbreLecteur = rolesEtNoms(await page.locator('#podcast').ariaSnapshot());
  const nomsLecteur = arbreLecteur.filter((n) => ['button', 'combobox'].includes(n.role));

  verifier(
    'aucune cible du lecteur n’est sans nom',
    nomsLecteur.length > 0 && nomsLecteur.every((n) => n.name.trim().length > 0),
    nomsLecteur.map((n) => `${n.role}:«${n.name}»`).join(' | '),
  );
  verifier(
    'le saut arrière se nomme en mots, pas par sa flèche',
    nomsLecteur.some((n) => n.name === 'Reculer de 15 secondes'),
    nomsLecteur.map((n) => n.name).join(' | '),
  );
  verifier(
    'le saut avant aussi',
    nomsLecteur.some((n) => n.name === 'Avancer de 15 secondes'),
  );
  verifier(
    'le choix de vitesse porte un nom',
    nomsLecteur.some((n) => n.role === 'combobox' && /vitesse/i.test(n.name)),
    nomsLecteur.filter((n) => n.role === 'combobox').map((n) => n.name).join(' | '),
  );

  const nomsParties = nomsLecteur.filter((n) => /^Écouter «/.test(n.name)).map((n) => n.name);
  verifier(
    'chaque partie se nomme par son titre et son heure EN MOTS',
    nomsParties.length === 3 && nomsParties.every((n) => /à .*(seconde|minute)/.test(n)),
    nomsParties.join(' | '),
  );
  verifier(
    'et les trois noms sont DISTINCTS',
    new Set(nomsParties).size === nomsParties.length,
    nomsParties.join(' | '),
  );

  /* ── Les boutons posés sur les titres du cours ────────────────────────── */

  console.log('\nLES BOUTONS DES TITRES — trois cibles, trois noms');

  const nomsTitres = rolesEtNoms(await page.locator('#contenu').ariaSnapshot())
    .filter((n) => n.role === 'button' && /^Écouter à partir de/.test(n.name))
    .map((n) => n.name);
  /*
     LE DÉFAUT CORRIGÉ. Les trois boutons portaient le même nom —
     « 🎧 Écouter à partir d'ici ». Qui parcourt la page par sa liste de
     boutons voyait trois entrées identiques et devait deviner laquelle mène
     où. Et l'émoji se lit « casque audio » avant chaque intitulé.
  */
  verifier(
    'un bouton par partie atteignable',
    nomsTitres.length === 3,
    `${nomsTitres.length} bouton(s)`,
  );
  verifier(
    'leurs noms sont DISTINCTS, et nomment leur partie',
    new Set(nomsTitres).size === 3,
    nomsTitres.join(' | '),
  );
  verifier(
    'et aucun ne porte l’émoji dans son nom',
    nomsTitres.every((n) => !/🎧/.test(n)),
    nomsTitres.join(' | '),
  );

  /* ══════════════════════════════════════════════════════════════════════
     3. L'ANNONCE DES CHANGEMENTS — ce qui parle, et ce qui se taît
     ══════════════════════════════════════════════════════════════════════ */

  console.log('\nCE QUI S’ANNONCE, ET CE QUI DOIT SE TAIRE');

  /*
     Écrit sans fonction interne nommée, exprès : `tsx` compile ce fichier
     avec esbuild, qui enveloppe toute fonction nommée d'un appel à son
     auxiliaire `__name`. Cet auxiliaire n'existe pas dans la page, et
     `page.evaluate` échoue alors sur « __name is not defined ». Une boucle
     plate évite le piège.
  */
  const vivant = await page.evaluate(() => {
    const resultat: Record<string, boolean> = {};
    for (const id of ['podcast-info', 'podcast-reste', 'suivi-parties']) {
      let e: HTMLElement | null = document.getElementById(id);
      let dedans = false;
      while (e && !dedans) {
        const live = e.getAttribute('aria-live');
        const role = e.getAttribute('role');
        if ((live && live !== 'off') || role === 'status' || role === 'alert') dedans = true;
        e = e.parentElement;
      }
      resultat[id] = dedans;
    }
    return resultat;
  });
  /*
     Les erreurs du lecteur passent par « podcast-info » : « Lecture
     impossible », « format audio non lisible ». Sans région vivante, qui ne
     voit pas l'écran appuie sur « Écouter » et n'apprend jamais pourquoi
     rien ne vient.
  */
  verifier('les messages du lecteur s’annoncent', vivant['podcast-info']);
  /*
     LE COMPTEUR, LUI, DOIT SE TAIRE — et c'était une région vivante.
     « reste 6 min » se réécrit à chaque `timeupdate`, soit plusieurs fois par
     seconde. Annoncé, il couvre la parole qu'on essaie d'écouter.
  */
  verifier('le temps restant NE s’annonce PAS', !vivant['podcast-reste']);
  verifier('le compte des parties vues non plus', !vivant['suivi-parties']);

  /* ══════════════════════════════════════════════════════════════════════
     4. LE MOUVEMENT RÉDUIT
     ══════════════════════════════════════════════════════════════════════ */

  console.log('\nLE MOUVEMENT RÉDUIT, SUR CE QUE CES LOTS ONT AJOUTÉ');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(300);
  const transitions = await page.evaluate(() => {
    const cibles = [
      '#podcast-recul',
      '#podcast-avance',
      '#podcast-parties [data-partie]',
      '#contenu h2[data-ecoute] button, #contenu h3[data-ecoute] button',
    ];
    const mesures: { ou: string; duree: string }[] = [];
    for (const selecteur of cibles) {
      const e = document.querySelector(selecteur);
      if (e) mesures.push({ ou: selecteur, duree: getComputedStyle(e).transitionDuration });
    }
    return mesures;
  });
  const enSecondes = (d: string) =>
    d.split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) / 1000 : parseFloat(x)));
  verifier(
    'aucune transition ajoutée ne survit au mouvement réduit',
    transitions.length > 0 &&
      transitions.every((t) => enSecondes(t.duree).every((s) => s <= 0.001)),
    transitions.map((t) => `${t.ou} = ${t.duree}`).join(' | '),
  );
  console.log(
    `  ${jaune('—')} mesuré sur ${transitions.length} élément(s) : ` +
      transitions.map((t) => t.duree).join(', '),
  );
  await page.emulateMedia({ reducedMotion: null });

  /* ══════════════════════════════════════════════════════════════════════
     5. LE VOLET DES PARTIES D'UNE SÉANCE
     ══════════════════════════════════════════════════════════════════════ */

  console.log('\nLE VOLET D’UNE SÉANCE — un nom par fiche, pas dix fois le même');

  await deverrouiller(`${RACINE_WEB}/planification/seance/?jour=${LUNDI}`, '[data-fiche]');

  const volets = await page.$$eval('details[data-volet-fiche] summary', (s) =>
    s.map((e) => e.getAttribute('aria-label') ?? e.textContent ?? ''),
  );
  verifier(
    'chaque volet porte un nom',
    volets.length > 0 && volets.every((n) => n.trim().length > 0),
    `${volets.length} volet(s)`,
  );
  /*
     Une séance propose une dizaine de fiches. Chacune portait un volet au nom
     identique — « Travailler seulement certaines parties » —, et rien ne le
     rattachait à sa fiche pour l'oreille.
  */
  verifier(
    'et les noms sont DISTINCTS d’une fiche à l’autre',
    new Set(volets).size === volets.length,
    volets.slice(0, 3).join(' | '),
  );
  verifier(
    'le nom nomme sa fiche',
    volets.every((n) => / de « .+ »$/.test(n)),
    volets[0] ?? '',
  );

  const volet = `details[data-volet-fiche="${ficheAvec}"]`;
  await page.click(`${volet} summary`);
  await page.waitForSelector(`${volet} [data-partie]`, { timeout: 20000 });
  const casesNommees = rolesEtNoms(await page.locator(volet).ariaSnapshot()).filter(
    (n) => n.role === 'checkbox',
  );
  verifier(
    'les cases de partie portent un nom, et il nomme la fiche',
    casesNommees.length === 3 && casesNommees.every((n) => n.name.includes('—')),
    casesNommees.map((n) => `«${n.name}»`).join(' | '),
  );
  verifier(
    'et leurs noms sont distincts',
    new Set(casesNommees.map((n) => n.name)).size === casesNommees.length,
  );
} finally {
  await nav?.close();
  nettoyer();
}

console.log(
  rouges === 0
    ? `\n${vert('Tout est vert.')}`
    : `\n${rouge(`${rouges} rouge${rouges > 1 ? 's' : ''}.`)}`,
);
process.exit(rouges === 0 ? 0 : 1);
