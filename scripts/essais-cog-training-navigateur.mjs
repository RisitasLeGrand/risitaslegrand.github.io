/**
 * Entraînement cognitif, dans un vrai navigateur.
 *
 *   SITE_PASSWORD=… npm run essais:cog:navigateur
 *
 * La branche n'avait aucun essai de navigateur : ses deux essais existants,
 * `essais:relationnel` et `essais:veridical`, éprouvent des moteurs purs. Or
 * tout ce que le prompt 51 demande se juge à l'écran — qu'une zone soit
 * visible, qu'un verdict soit lisible, qu'une consigne soit atteignable. Rien
 * de cela ne se lit dans le code.
 *
 * ## Ce qui est mesuré ici, et pourquoi de cette façon
 *
 * **P1 — la zone de jeu est visible au lancement.** C'est le défaut le plus
 * coûteux des trois exercices : sur un téléphone, les réglages de Mémoire de
 * travail poussent la grille sous la ligne de flottaison, et la première
 * épreuve défilait hors de l'écran. L'essai part de la route, touche le bouton
 * de lancement comme on le touche, et mesure le rectangle de la zone contre
 * celui de la fenêtre.
 *
 * Il ne cherche pas `scrollIntoView` dans le code : un appel présent peut ne
 * rien produire — conteneur à défilement imbriqué, zone plus haute que la
 * fenêtre, rendu pas encore fait. C'est la position finale qui compte.
 *
 * **La tolérance est celle de la mise en œuvre, et elle est dite.** Une zone
 * plus haute que la fenêtre ne peut pas y entrer : pour celles-là on exige
 * que la part visible atteigne le seuil que `zone-de-jeu.ts` se donne. Pour
 * les autres, on exige l'intégralité. Exiger « entièrement visible » d'une
 * zone de 900 px dans une fenêtre de 844 serait un essai qu'aucun code ne
 * peut satisfaire.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const BASE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = process.env.SITE_PASSWORD;
if (!MDP) {
  console.error('SITE_PASSWORD manquant.');
  process.exit(1);
}

/** Le seuil que « zone-de-jeu.ts » se donne, repris ici pour ne pas en inventer un autre. */
const PART_VISIBLE = 0.9;

let echecs = 0;
const v = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (intitule, condition) => v(intitule, condition === true, true);

/*
   Une panne est un échec, et elle se dit en rouge. Sans ce filet, une
   exception tue le script sans imprimer de ligne d'échec, et un banc de
   sabotage en conclut que le contrôle ne mord pas.
*/
const direPanne = (ou, erreur) => {
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m panne pendant « ${ou} » : ${String(erreur).slice(0, 220)}`);
};

/** Les trois exercices, leur route et le libellé de leur bouton de lancement. */
const EXERCICES = [
  { nom: 'Mémoire de travail', route: 'quad-n-back', lancer: /^Commencer( la session)?$/ },
  { nom: 'Raisonnement relationnel', route: 'relational-reasoning', lancer: /^Commencer$/ },
  { nom: 'Correspondance perceptive', route: 'veridical-mapping', lancer: /^Commencer$/ },
];

const TAILLES = [
  { nom: 'téléphone', viewport: { width: 390, height: 844 }, tactile: true },
  { nom: 'ordinateur', viewport: { width: 1280, height: 900 }, tactile: false },
];

/** Clair et sombre, obtenus comme la page Paramètres les écrit. */
const MODES = [
  { nom: 'clair', heures: '00:00|23:59' },
  { nom: 'sombre', heures: '03:00|03:01' },
];

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});

/** Ouvre une page prête à jouer : déverrouillée, initialisation franchie, thème posé. */
async function ouvrir(taille, mode, route) {
  const contexte = await nav.newContext({
    viewport: taille.viewport,
    hasTouch: taille.tactile,
    isMobile: taille.tactile,
  });
  const page = await contexte.newPage();
  await page.addInitScript((heures) => {
    try {
      localStorage.setItem('revinsp.palette', 'egee');
      localStorage.setItem('revinsp.bascule-jour-nuit', 'oui');
      localStorage.setItem('revinsp.heures-bascule', heures);
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

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/cog-training/${route}/`, { waitUntil: 'networkidle' });
  await deverrouiller();
  return { contexte, page };
}

/**
 * Ce que la fenêtre montre de la zone, en part de sa hauteur.
 *
 * Mesuré sur le rectangle rendu, et non sur une classe ou un appel : c'est la
 * position finale qui décide si la personne voit la grille.
 */
const partVisible = (zone) =>
  zone.evaluate((e) => {
    const r = e.getBoundingClientRect();
    if (r.height === 0) return { part: 0, hauteur: 0, fenetre: innerHeight };
    const haut = Math.max(r.top, 0);
    const bas = Math.min(r.bottom, innerHeight);
    return {
      part: Math.max(0, bas - haut) / r.height,
      hauteur: Math.round(r.height),
      fenetre: innerHeight,
    };
  });

console.log('\nP1 — LA ZONE DE JEU EST VISIBLE AU LANCEMENT');

for (const taille of TAILLES) {
  for (const mode of MODES) {
    for (const exercice of EXERCICES) {
      const ou = `${exercice.nom} · ${taille.nom} · ${mode.nom}`;
      let contexte;
      try {
        const ouvert = await ouvrir(taille, mode, exercice.route);
        contexte = ouvert.contexte;
        const page = ouvert.page;

        const lancer = page.getByRole('button', { name: exercice.lancer }).first();
        await lancer.waitFor({ state: 'visible', timeout: 30000 });

        /*
           Un bouton désactivé n'est pas un succès silencieux : il veut dire
           qu'aucune unité n'est retenue, et l'essai doit le dire plutôt que
           passer au suivant.
        */
        if (await lancer.isDisabled()) {
          echecs += 1;
          console.log(
            `  \x1b[31m✗\x1b[0m ${ou} : le bouton de lancement est désactivé, rien n'a pu être mesuré`,
          );
          await contexte.close();
          continue;
        }

        /* On part volontairement du bas de la page : c'est le pire cas. */
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        await lancer.click();

        const zone = page.locator('[data-zone-de-jeu]').first();
        await zone.waitFor({ state: 'visible', timeout: 30000 });
        /* Le temps du défilement, que la mise en œuvre borne elle-même. */
        await page.waitForTimeout(1500);

        const { part, hauteur, fenetre } = await partVisible(zone);
        const tient = hauteur <= fenetre;
        const exige = tient ? 1 : PART_VISIBLE;
        vrai(
          `${ou} — ${tient ? 'entièrement visible' : `${Math.round(part * 100)} % visibles, zone de ${hauteur} px dans ${fenetre}`}`,
          part >= exige - 0.001,
        );

        await contexte.close();
      } catch (erreur) {
        direPanne(ou, erreur);
        await contexte?.close().catch(() => {});
      }
    }
  }
}

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai${echecs > 1 ? 's' : ''} en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout est vert\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
