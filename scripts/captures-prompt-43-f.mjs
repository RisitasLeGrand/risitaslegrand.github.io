/**
 * Les captures du prompt 43, lot F — « Habitude sans pression ».
 *
 *   SITE_PASSWORD=… node scripts/captures-prompt-43-f.mjs avant
 *   SITE_PASSWORD=… node scripts/captures-prompt-43-f.mjs apres
 *
 * Elles vont dans « audit/captures/prompt-43-f/<avant|apres>/ », hors du
 * dépôt : une capture montre l'état d'une base, et cette base ne sort pas de
 * la machine.
 *
 * ## Pourquoi un semis, et lequel
 *
 * Les écrans du lot F ne montrent rien sur une base vierge : pas de série,
 * donc pas de bandeau de pression ; pas de carte en retard, donc pas de
 * nombre à corriger. Le semis est **synthétique** et écrit dans le seul
 * magasin « etat » — un profil, jamais une donnée réelle (interdit 2).
 *
 * Deux profils sont nécessaires, et non un : les deux bandeaux que F1 retire
 * s'excluent l'un l'autre. « Série en péril » demande une série continuée et
 * un jour non étudié ; « série interrompue » demande un trou. Un seul semis
 * n'aurait donc montré qu'un bandeau sur deux.
 *
 * ## Les deux écrans révélés à la main, et pourquoi
 *
 * La proposition de l'accueil ne paraît qu'au plus une fois par semaine, et
 * l'erreur du centre de notifications demande une lecture en panne. Le script
 * les **révèle** — il retire « hidden » et pose un texte d'exemple — au lieu
 * d'attendre une conjonction qui ne vient pas. C'est dit sur l'image par son
 * nom, et les essais, eux, les atteignent par le chemin réel.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MOMENT = process.argv[2] ?? 'avant';
if (!['avant', 'apres'].includes(MOMENT)) {
  console.error('Usage : node scripts/captures-prompt-43-f.mjs <avant|apres>');
  process.exit(2);
}

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const DOSSIER = `audit/captures/prompt-43-f/${MOMENT}`;

const TAILLES = [
  { nom: '360', viewport: { width: 360, height: 740 }, tactile: true },
  { nom: '390', viewport: { width: 390, height: 844 }, tactile: true },
  { nom: '1280', viewport: { width: 1280, height: 900 }, tactile: false },
];

const MODES = [
  { nom: 'clair', heures: '00:00|23:59' },
  { nom: 'sombre', heures: '03:00|03:01' },
];

mkdirSync(DOSSIER, { recursive: true });

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});

let faites = 0;
const anomalies = [];

/** Écrit un profil synthétique dans « etat », puis rend la main. */
async function semerLeProfil(page, profil) {
  await page.evaluate(async (profil) => {
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    await new Promise((ok, ko) => {
      const tx = base.transaction('etat', 'readwrite');
      tx.objectStore('etat').put(profil, 'profil');
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
  }, profil);
}

/** Le jour ISO décalé de « n » jours par rapport à aujourd'hui. */
function jour(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const PROFIL_EN_PERIL = {
  xp: 540,
  streakCourante: 7,
  streakRecord: 12,
  dernierJourEtudie: jour(-1),
  badges: [],
  creeLe: jour(-120),
};

const PROFIL_ROMPU = {
  ...PROFIL_EN_PERIL,
  streakCourante: 9,
  dernierJourEtudie: jour(-5),
};

for (const taille of TAILLES) {
  for (const mode of MODES) {
    const contexte = await nav.newContext({
      viewport: taille.viewport,
      hasTouch: taille.tactile,
      isMobile: taille.tactile,
      deviceScaleFactor: 2,
    });
    const page = await contexte.newPage();
    const ou = `${taille.nom}/${mode.nom}`;
    page.on('pageerror', (e) => anomalies.push(`${ou} : ${e.message.slice(0, 160)}`));

    await page.addInitScript((heures) => {
      try {
        localStorage.setItem('revinsp.palette', 'egee');
        localStorage.setItem('revinsp.bascule-jour-nuit', 'oui');
        localStorage.setItem('revinsp.heures-bascule', heures);
        localStorage.setItem('revinsp.animations', 'reduites');
      } catch {
        /* navigation privée */
      }
    }, mode.heures);

    const deverrouiller = async () => {
      if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
        await page.fill('#champ-mdp', MDP);
        await page.click('#bouton-verrou');
        await page.waitForLoadState('networkidle');
      }
    };

    const prendre = async (nom) => {
      await page.screenshot({ path: `${DOSSIER}/${nom}-${taille.nom}-${mode.nom}.png`, fullPage: true });
      faites += 1;
      const debord = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (debord > 1) anomalies.push(`${nom} ${ou} : débordement de ${debord} px`);
    };

    const aller = async (route) => {
      await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
      await deverrouiller();
      await page.waitForTimeout(500);
    };

    await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
    await deverrouiller();
    await franchirInitialisation(page, RACINE, MDP);

    /* ── F1, F2, F3 : le tableau de bord, série en péril ─────────────── */
    await aller('/revisions/');
    await semerLeProfil(page, PROFIL_EN_PERIL);
    await aller('/revisions/');
    if (!(await page.locator('#alerte-streak:not(.hidden)').count())) {
      anomalies.push(`${ou} : aucun bandeau de série en péril (semis sans effet, ou jour de repos)`);
    }
    await prendre('revisions-serie-en-peril');

    /* ── F1 : l'autre bandeau, celui de la série interrompue ─────────── */
    await semerLeProfil(page, PROFIL_ROMPU);
    await aller('/revisions/');
    await prendre('revisions-serie-interrompue');

    /* ── F4, F5 : l'écran des cartes ──────────────────────────────────── */
    await aller('/flashcards/');
    await prendre('flashcards-comptes');

    /* Les quatre boutons de notation ne vivent que dans la session. */
    const lancer = page.locator('#lancer');
    if (await lancer.isVisible().catch(() => false)) {
      await lancer.click().catch(() => {});
      await page.locator('#session:not(.hidden)').waitFor({ timeout: 60_000 }).catch(() => {});
      /* La réponse se découvre en touchant la carte : c'est ce geste qui
         fait paraître les quatre boutons de notation. */
      await page.locator('#carte').click().catch(() => {});
      await page.waitForTimeout(400);
      if (!(await page.locator('#notation:not(.hidden)').count())) {
        anomalies.push(`${ou} : les boutons de notation ne sont pas apparus`);
      }
      await prendre('flashcards-notation');
    } else {
      anomalies.push(`${ou} : impossible de lancer une session de cartes`);
    }

    /* ── F2 : la section Affichage des paramètres ─────────────────────── */
    await aller('/parametres/#affichage');
    await prendre('parametres-affichage');

    /* ── F6 : la proposition de l'accueil, révélée ────────────────────── */
    await aller('/');
    await page.evaluate(() => {
      const bloc = document.getElementById('proposition');
      if (!bloc) return;
      bloc.classList.remove('hidden');
      const c = document.getElementById('proposition-constat');
      const q = document.getElementById('proposition-question');
      if (c) c.textContent = 'Vous révisez surtout le soir, alors que vos heures déclarées sont le matin.';
      if (q) q.textContent = 'Faut-il décaler la revue du jour à 21 h ?';
    });
    await page.waitForTimeout(200);
    await prendre('accueil-proposition');

    /* ── F6 : le consentement du profil ──────────────────────────────── */
    await aller('/profil/');
    await prendre('profil-consentement');

    /* ── F8 : le centre de notifications ouvert ───────────────────────── */
    await aller('/revisions/');
    const bouton = page.locator('#centre-bouton').first();
    if (await bouton.count()) {
      await bouton.click().catch(() => {});
      await page.waitForTimeout(600);
      await prendre('centre-notifications');
    } else {
      anomalies.push(`${ou} : aucun bouton de centre de notifications`);
    }

    await contexte.close();
  }
}

await nav.close();

console.log(`\n${faites} captures « ${MOMENT} » dans « ${DOSSIER} » (hors du dépôt).`);
if (anomalies.length) {
  console.log(`\n\x1b[31m${anomalies.length} anomalies :\x1b[0m`);
  for (const a of anomalies) console.log(`  · ${a}`);
  process.exit(1);
}
console.log('\x1b[32mAucune anomalie : aucun débordement, aucune erreur de page.\x1b[0m\n');
