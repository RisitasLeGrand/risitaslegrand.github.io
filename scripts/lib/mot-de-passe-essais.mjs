/**
 * Le mot de passe du site, pour les essais qui doivent déverrouiller une page.
 *
 * ## Pourquoi ce module existe
 *
 * Huit scripts d'essai portaient le mot de passe **en clair**, et ces huit
 * fichiers sont suivis par Git. Le dépôt est public — un compte gratuit l'exige
 * pour servir GitHub Pages. Le mot de passe du site était donc lisible par
 * quiconque, dans le dépôt, pendant tout ce temps.
 *
 * Le site ne contient que du contenu chiffré, et c'est ce chiffrement que le mot
 * de passe ouvre : le publier annulait la seule protection du contenu.
 *
 * ## Ce que ce module fait
 *
 * Il lit le mot de passe depuis l'environnement, ou depuis `.env.local` quand il
 * existe — le même fichier que celui du build, ignoré par Git. Il n'en porte
 * aucune valeur par défaut, et s'arrête avec un message clair quand il n'en
 * trouve pas : un essai qui tournerait avec un mot de passe deviné échouerait de
 * façon illisible.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '..', '..');

/** Lit SITE_PASSWORD dans `.env.local`, sans dépendance à un chargeur d'env. */
function depuisEnvLocal() {
  const chemin = path.join(RACINE, '.env.local');
  if (!existsSync(chemin)) return null;
  for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
    const m = /^\s*SITE_PASSWORD\s*=\s*(.*)\s*$/.exec(ligne);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

/**
 * Le mot de passe, ou l'arrêt du script.
 *
 * L'arrêt est volontairement brutal : un essai de navigateur sans mot de passe
 * reste bloqué sur l'écran de déverrouillage et échoue trente secondes plus tard
 * sur un sélecteur introuvable, ce qui n'apprend rien à personne.
 */
export function motDePasseEssais() {
  const mdp = process.env.SITE_PASSWORD || depuisEnvLocal();
  if (mdp) return mdp;
  console.error(
    '\n\x1b[31mMot de passe absent.\x1b[0m Cet essai déverrouille une page du site et a ' +
      'besoin du mot de passe, qui n’est écrit nulle part dans le dépôt.\n\n' +
      '  SITE_PASSWORD=… npm run <essai>\n\n' +
      'ou bien pose-le dans .env.local (ignoré par Git) le temps de la session :\n\n' +
      '  printf \'SITE_PASSWORD=…\\n\' > .env.local\n',
  );
  process.exit(2);
}
