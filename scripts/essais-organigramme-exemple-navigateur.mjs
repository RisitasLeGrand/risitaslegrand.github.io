/**
 * Les deux lectures d'un organigramme, SANS le corpus réel.
 *
 *   npm run essais:organigramme-exemple
 *
 * ## Pourquoi un sixième essai de laboratoire, alors qu'il en existe un
 *
 * `essais:organigramme:navigateur` mesure les deux lectures sur le corpus
 * RÉEL, dans la correction d'un quiz. Il est vert — et il ne l'est que tant
 * qu'une fiche du corpus marque ses nœuds essentiels. Or `content/` n'est pas
 * dans Git : sur un conteneur neuf, cette fiche n'existe pas, l'essai retombe
 * sur son refus « non mesurable », et les deux lectures redeviennent non
 * éprouvées sans que rien ne rougisse.
 *
 * Autrement dit : la seule preuve que la bascule fonctionne dépendait d'un
 * contenu que le dépôt ne porte pas. Celui-ci la rend indépendante, en posant
 * son propre décor dans `content-exemple/`, qui est suivi par Git.
 *
 * Les deux restent, et ils ne mesurent pas la même chose :
 *
 * - l'autre éprouve la surface de la CORRECTION d'un quiz, et il éprouve le
 *   corpus réel — c'est-à-dire que du vrai contenu déclare bien ses nœuds ;
 * - celui-ci éprouve la surface de la PAGE des organigrammes, et il éprouve
 *   le code sans rien demander au corpus.
 *
 * ## L'organigramme du décor est FICTIF, et il le dit trois fois
 *
 * Son titre porte « ORGANIGRAMME FICTIF », sa source dit « aucune :
 * organigramme INVENTÉ pour les essais », et sa légende répète qu'il ne
 * décrit aucune administration réelle. Trois fois, parce que `content-exemple/`
 * est du contenu publiable : quelqu'un qui bâtirait le site depuis lui doit
 * être incapable de prendre ce dessin pour un état de l'administration, et la
 * date et la source s'affichent AU-DESSUS du dessin, avant qu'on le croie.
 *
 * Le décor est conçu pour que les trois règles du squelette soient
 * exerçables : trois nœuds essentiels sur six — donc la bascule est offerte —,
 * un lien entre deux essentiels — qui doit survivre —, et deux liens dont un
 * bout seulement est essentiel — qui doivent disparaître avec leur boîte.
 *
 * ## Le laboratoire
 *
 * Comme les autres essais de laboratoire : un `content/` bâti depuis
 * `content-exemple/`, un mot de passe FACTICE, un aperçu sur le port 4322, et
 * tout est effacé à la fin. Il REFUSE de démarrer si `content/`, `.env.local`
 * ou `public/data/` existent déjà — c'est-à-dire toujours, dans un répertoire
 * où le travail se fait, et c'est pourquoi la batterie lui ouvre un arbre
 * séparé.
 */
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOT_DE_PASSE = 'laboratoire-organigramme-exemple-sans-valeur';
const PORT = 4322;
const ADRESSE = `http://localhost:${PORT}`;

/* Le décor, et le parcours qui sert sa matière. « Droit public » est un thème
   du parcours INSP : la page des organigrammes filtre par parcours, et un
   mauvais choix ne listerait rien du tout. La prémisse ci-dessous le dirait. */
const PARCOURS = 'insp';
const TITRE_FICTIF = 'L’Office d’exemple des contrôles — ORGANIGRAMME FICTIF';

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;

const v = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  ${rouge('✗')} ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`,
  );
};
const vrai = (quoi, obtenu) => v(quoi, Boolean(obtenu), true);

const gardes = [
  ['content', path.join(racine, 'content')],
  ['.env.local', path.join(racine, '.env.local')],
  ['public/data', path.join(racine, 'public', 'data')],
  ['.temoin-mot-de-passe.local.json', path.join(racine, '.temoin-mot-de-passe.local.json')],
];
const occupes = gardes.filter(([, chemin]) => existsSync(chemin)).map(([nom]) => nom);
if (occupes.length) {
  console.log(
    `\n${rouge('✗ REFUS')} — ${occupes.join(', ')} existe déjà.\n` +
      '  Cet essai bâtit un site de laboratoire avec un mot de passe factice et\n' +
      '  efface tout derrière lui : il ne travaillera pas par-dessus du contenu réel.',
  );
  process.exit(1);
}

const node = (script, env = {}) =>
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

let nav = null;

try {
  console.log('\nLA CONSTRUCTION DU LABORATOIRE');
  node('init-contenu.mjs');
  writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);
  node('build-content.mjs');
  execFileSync('npx', ['astro', 'build'], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, REVINSP_SANS_PODCAST: '1' },
  });
  /* Le mot de passe ne survit pas à la construction. */
  rmSync(path.join(racine, '.env.local'), { force: true });

  spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: racine,
    detached: true,
    stdio: 'ignore',
  }).unref();

  /* On interroge l'aperçu jusqu'à ce qu'il serve, et on dit au bout de combien
     de temps on renonce : la course gagnée par habitude finit par se perdre. */
  let sert = false;
  for (let i = 0; i < 60 && !sert; i += 1) {
    sert = await fetch(`${ADRESSE}/robots.txt`, { signal: AbortSignal.timeout(2000) })
      .then((r) => r.ok)
      .catch(() => false);
    if (!sert) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!sert) throw new Error(`l’aperçu n’a pas répondu sur ${ADRESSE} après une minute`);
  console.log(`  ${vert('✓')} le laboratoire sert sur ${ADRESSE}`);
} catch (erreur) {
  console.log(`\n${rouge('✗ PANNE')} — le laboratoire n’a pas pu être construit.`);
  console.log(String(erreur?.message ?? erreur).slice(0, 900));
  nettoyer();
  process.exit(1);
}

/* ── Les contrôles ───────────────────────────────────────────────────────── */

try {
  nav = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });

  const erreurs = [];
  const ctx = await nav.newContext({ viewport: { width: 1200, height: 1100 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 200)));
  await franchirInitialisation(page, ADRESSE, MOT_DE_PASSE);

  const connecter = async () => {
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MOT_DE_PASSE);
      await page.click('#bouton-verrou');
      await page.waitForTimeout(2500);
    }
  };

  await page.goto(`${ADRESSE}/robots.txt`, { waitUntil: 'load' });
  await page.evaluate((id) => localStorage.setItem('revinsp.parcours', id), PARCOURS);
  await page.goto(`${ADRESSE}/organigrammes/`, { waitUntil: 'networkidle' });
  await connecter();
  await page
    .waitForFunction(
      () => document.getElementById('chargement')?.classList.contains('hidden') === true,
      null,
      { timeout: 40000 },
    )
    .catch(() => {});

  console.log('\nLA FICHE D’EXEMPLE EST LISTÉE, ET SON ORGANIGRAMME S’OUVRE');
  const replis = page.locator('#liste details[data-fiche]');
  const combien = await replis.count();
  /*
     LA PRÉMISSE, ET ELLE PORTE TOUT LE RESTE. Si la page ne liste rien — un
     mauvais parcours, un manifeste qui n'a pas vu la section —, les contrôles
     suivants mesureraient une page vide, et un « zéro boîte » ressemblerait
     à un squelette réussi.
  */
  v(`la page liste la fiche du décor (parcours « ${PARCOURS} »)`, combien > 0, true);
  if (combien === 0) {
    console.log(
      `  ${rouge('✗')} la suite n’est pas mesurée : sans fiche listée, il n’y a pas d’organigramme`,
    );
    rouges += 1;
  } else {
    await replis.first().locator('> summary').click();
    await page.waitForTimeout(2500);

    const bloc = page.locator(`[data-organigramme="${TITRE_FICTIF}"]`);
    const la = (await bloc.count()) > 0;
    vrai('le bloc de l’organigramme fictif est monté', la);

    if (!la) {
      console.log(`  ${rouge('✗')} la suite n’est pas mesurée : le bloc attendu n’est pas là`);
      rouges += 1;
    } else {
      /*
         LA FICTION EST DITE AVANT LE DESSIN. C'est la même règle que la date :
         une réserve qui se lit après avoir regardé se lit trop tard.
      */
      const entete = ((await bloc.textContent()) ?? '').replace(/\s+/g, ' ');
      vrai('le titre annonce la fiction', /ORGANIGRAMME FICTIF/.test(entete));
      vrai('la source dit qu’il est inventé', /INVENTÉ pour les essais/i.test(entete));
      vrai('et la date est affichée', /État\s+(en|au)\s+/.test(entete));

      console.log('\nLES DEUX LECTURES, SUR LE DÉCOR D’EXEMPLE');
      const boites = () => bloc.locator('svg rect:not([width="5"])').count();
      const detail = await boites();
      /* Six nœuds au décor : le détail doit en dessiner plus que le squelette. */
      v('le détail dessine les six boîtes', detail, 6);

      const appuis = bloc.locator('[role="group"] button');
      v('les deux appuis de lecture sont offerts', await appuis.count(), 2);

      await appuis.nth(1).click();
      await page.waitForTimeout(800);
      const squelette = await boites();
      v('le squelette dessine les trois nœuds essentiels', squelette, 3);
      vrai('donc moins que le détail', squelette < detail);

      /*
         ET LES LIENS SUIVENT LEURS BOÎTES. Le décor porte un lien entre deux
         essentiels, qui doit rester, et trois liens dont un bout n'est pas
         essentiel, qui doivent partir avec leur boîte. Un trait vers une boîte
         absente serait le défaut que la règle évite, et il se verrait ici.
      */
      const traits = () => bloc.locator('svg line, svg path[data-lien]').count();
      const traitsSquelette = await traits();
      vrai('le squelette garde au moins un trait', traitsSquelette >= 1);

      await appuis.nth(0).click();
      await page.waitForTimeout(800);
      v('revenir au détail redessine tout', await boites(), detail);

      console.log('\nLE TEXTE COMPLET SUIT LA LECTURE AFFICHÉE');
      const texte = bloc.locator('[data-organigramme-texte]');
      vrai('le repli de lecture en texte est là', (await texte.count()) > 0);
      await texte.locator('summary').click();
      await page.waitForTimeout(500);
      const ditDetail = ((await texte.textContent()) ?? '').replace(/\s+/g, ' ');
      vrai('il annonce le détail', /Le détail, rang par rang/.test(ditDetail));
      vrai('et il nomme un rattachement du décor', /rattachement direct/.test(ditDetail));

      await appuis.nth(1).click();
      await page.waitForTimeout(800);
      const ditSquelette = ((await texte.textContent()) ?? '').replace(/\s+/g, ' ');
      vrai('passé au squelette, il annonce le squelette', /Le squelette, rang par rang/.test(ditSquelette));
      /*
         Et il ne nomme plus ce que le squelette ne montre pas. C'est la même
         promesse que le dessin, du côté du texte : les deux viennent de la
         même fonction, et c'est tout l'intérêt d'une seule déclaration.
      */
      v(
        'et il ne nomme plus la mission d’appui, qui n’est pas du squelette',
        /Mission d’appui/.test(ditSquelette),
        false,
      );
    }
  }

  console.log('\nET AUCUNE ERREUR DE PAGE N’A ÉTÉ AVALÉE');
  v('aucune erreur levée', erreurs.slice(0, 3), []);
} catch (erreur) {
  console.log(`\n${rouge('✗ PANNE')} — ${String(erreur?.message ?? erreur).slice(0, 400)}`);
  rouges += 1;
} finally {
  await nav?.close();
  nettoyer();
}

console.log(
  rouges === 0
    ? `\n${vert('✓ tout est vert')}\n`
    : `\n${rouge(`✗ ${rouges} rouge${rouges > 1 ? 's' : ''}`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
