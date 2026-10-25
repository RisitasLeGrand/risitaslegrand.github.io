/**
 * LECTURE DU MOT DE PASSE DU SITE — LA SEULE RÈGLE, ET SES DEUX POLITIQUES.
 *
 * ## Pourquoi ce module porte la règle
 *
 * Le mot de passe avait QUATRE lecteurs, chacun avec sa règle :
 *
 *   1. ce module, pour les outils (actualités, déchiffrement) ;
 *   2. `lib/mot-de-passe-essais.mjs`, que cent quarante-sept essais emploient ;
 *   3. `build-content.mjs`, en ligne, pour le build ;
 *   4. `essais-secret.mjs`, une copie en ligne du deuxième.
 *
 * Les trois premiers d'alors s'accordaient — `\r?\n`, `trim`, guillemets
 * APPARIÉS retirés. Le deuxième, celui des essais, divergeait sur les trois
 * points : il coupait sur `\n` seul, ne coupait pas les blancs, et retirait un
 * guillemet d'un côté sans exiger l'autre.
 *
 * Les conséquences ne sont pas théoriques. Un `.env.local` écrit avec un
 * retour de chariot donnait aux essais une valeur terminée par un retour de
 * chariot, et au build la même valeur sans lui : le site
 * se construit avec l'un, les essais déverrouillent avec l'autre, et cent
 * quarante-sept essais de navigateur restent sur l'écran de déverrouillage
 * sans qu'aucun message ne dise pourquoi. Un espace final faisait de même.
 *
 * La règle vit donc ici, une fois. `essais:mot-de-passe-une-source` vérifie
 * qu'aucun autre fichier ne la réécrit.
 *
 * ## Les deux politiques, qui restent distinctes
 *
 * - **Les outils et les essais** acceptent l'environnement d'abord, puis le
 *   fichier. L'environnement passe en premier parce qu'une routine de veille
 *   reçoit le mot de passe par là, sans avoir à écrire de fichier.
 * - **Le build** n'accepte QUE le fichier, et c'est volontaire : une commande
 *   s'enregistre en clair dans le journal du terminal, et le build est la
 *   commande qu'on tape à la main. `build-content.mjs` garde donc sa
 *   politique, et ne lui emprunte que la règle de lecture.
 */
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Le chemin du fichier local, jamais commité. */
export const CHEMIN_ENV_LOCAL = path.join(racine, '.env.local');

/**
 * Retire une paire de guillemets, et seulement une PAIRE.
 *
 * `"abc"` donne `abc` ; `"abc` reste `"abc`, parce qu'un guillemet seul est
 * sans doute un vrai caractère du mot de passe, et le retirer en silence
 * fabriquerait un mot de passe faux sans rien dire.
 */
export function deguillemeter(valeur) {
  const v = valeur.trim();
  const appariés =
    (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"));
  return appariés && v.length >= 2 ? v.slice(1, -1) : v;
}

/**
 * LA RÈGLE : extrait le mot de passe du TEXTE d'un `.env.local`.
 *
 * Renvoie `null` quand aucune ligne ne le porte, ou qu'elle le porte vide.
 * Ne lit aucun fichier : c'est ce qui la rend éprouvable sans disque.
 */
export function motDePasseDuTexte(texte) {
  const ligne = texte.split(/\r?\n/).find((l) => /^\s*SITE_PASSWORD\s*=/.test(l));
  if (!ligne) return null;
  return deguillemeter(ligne.replace(/^\s*SITE_PASSWORD\s*=/, '')) || null;
}

/** Le mot de passe du fichier local, ou `null` — lecture synchrone. */
export function motDePasseDuFichierSync(chemin = CHEMIN_ENV_LOCAL) {
  if (!existsSync(chemin)) return null;
  return motDePasseDuTexte(readFileSync(chemin, 'utf8'));
}

/** Le mot de passe de l'environnement, ou `null` — la même règle de guillemets. */
export function motDePasseDeLEnvironnement() {
  const brut = process.env.SITE_PASSWORD;
  if (!brut?.trim()) return null;
  return deguillemeter(brut) || null;
}

/**
 * Retourne le mot de passe, ou null s'il n'est disponible nulle part.
 * Les appelants décident eux-mêmes si l'absence est bloquante.
 */
export async function lireMotDePasseEventuel() {
  const deLEnv = motDePasseDeLEnvironnement();
  if (deLEnv) return deLEnv;
  if (!existsSync(CHEMIN_ENV_LOCAL)) return null;
  return motDePasseDuTexte(await readFile(CHEMIN_ENV_LOCAL, 'utf8'));
}

/** La même chose, sans attendre : ce dont les essais ont besoin. */
export function lireMotDePasseEventuelSync() {
  return motDePasseDeLEnvironnement() ?? motDePasseDuFichierSync();
}

export const AIDE_MOT_DE_PASSE =
  'Le mot de passe du site est introuvable.\n' +
  '  Posez-le dans le fichier local, jamais commité :\n' +
  '      printf \'SITE_PASSWORD=…\\n\' > .env.local\n' +
  '  Une variable d\'environnement fonctionne aussi, mais la commande reste en\n' +
  '  clair dans le journal du terminal :\n' +
  '      export SITE_PASSWORD=…';
