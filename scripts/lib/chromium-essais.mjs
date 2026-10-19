/**
 * Où trouver le navigateur des essais, et pourquoi le chercher plutôt que le
 * nommer.
 *
 * ## Le piège, signalé le 19 octobre
 *
 * Les essais de navigateur portent le chemin du binaire en toutes lettres :
 * `process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
 * Deux ennuis en découlent, et les deux produisent des rouges qui ne viennent
 * pas du site.
 *
 * - **Quinze essais n'avaient aucun chemin de repli** : sans la variable
 *   `CHROMIUM` dans l'environnement, ils rougissaient alors que le site
 *   n'avait rien.
 * - **Le numéro de version se démode.** Le conteneur fournit aujourd'hui la
 *   1194 ; `playwright-core` épinglé en cherche une autre. Un chemin écrit en
 *   dur dans cent trente fichiers est un chemin qu'on ne corrigera pas.
 *
 * ## Ce que fait ce module
 *
 * Il cherche, dans l'ordre : la variable `CHROMIUM`, puis
 * `PLAYWRIGHT_BROWSERS_PATH`, puis `/opt/pw-browsers`, et rend le premier
 * binaire trouvé — quel que soit son numéro de version. Il ne rend
 * `undefined` que s'il n'a rien trouvé, auquel cas `playwright` cherche à sa
 * manière habituelle et dira lui-même ce qui manque.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne réécrit pas les cent seize essais qui portent déjà un chemin de repli
 * en dur et qui fonctionnent. Les toucher tous dans un seul commit
 * entrerait en collision avec les branches des agents, qui en modifient une
 * partie. Ils migreront quand ils seront ouverts pour une autre raison.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Les dossiers où un navigateur de Playwright peut être installé. */
const RACINES = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(
  (r) => typeof r === 'string' && r.length > 0,
);

/** Les dispositions connues, du binaire à l'intérieur d'un dossier de version. */
const DISPOSITIONS = ['chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome'];

/**
 * Le chemin du binaire, ou `undefined` si rien n'a été trouvé.
 *
 * Le résultat est calculé une fois : la recherche touche le disque, et une
 * batterie l'appellerait deux cent trente-cinq fois pour rien.
 */
let trouve;
let cherche = false;

export function cheminDuNavigateur() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  if (cherche) return trouve;
  cherche = true;
  for (const racine of RACINES) {
    if (!existsSync(racine)) continue;
    let entrees;
    try {
      entrees = readdirSync(racine).filter((n) => n.startsWith('chromium')).sort();
    } catch {
      continue;
    }
    for (const entree of entrees) {
      for (const disposition of DISPOSITIONS) {
        const candidat = join(racine, entree, disposition);
        if (existsSync(candidat)) {
          trouve = candidat;
          return trouve;
        }
      }
    }
  }
  return trouve;
}
