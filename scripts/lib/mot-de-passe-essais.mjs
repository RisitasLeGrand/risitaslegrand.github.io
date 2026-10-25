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
import { AIDE_MOT_DE_PASSE, lireMotDePasseEventuelSync } from './motdepasse.mjs';

/*
   LA RÈGLE DE LECTURE N'EST PLUS ÉCRITE ICI, ET C'EST LE POINT.

   Ce module portait sa propre lecture de `.env.local`, et elle divergeait de
   celle du build sur trois points : elle coupait les lignes sur `\n` seul, ne
   coupait pas les blancs autour de la valeur, et retirait un guillemet d'un
   côté sans exiger l'autre.

   Un `.env.local` écrit avec un retour de chariot donnait donc, ici, une
   valeur terminée par ce retour de chariot, et au build la même valeur sans
   lui. Le site se construit avec l'un, les essais
   déverrouillent avec l'autre, et cent quarante-sept essais de navigateur
   restent sur l'écran de déverrouillage sans qu'aucun message ne dise
   pourquoi. Un espace final faisait de même.

   La règle vit maintenant dans `lib/motdepasse.mjs`, une seule fois, et
   `essais:mot-de-passe-une-source` vérifie qu'aucun fichier ne la réécrit.
*/

/**
 * Le mot de passe, ou l'arrêt du script.
 *
 * L'arrêt est volontairement brutal : un essai de navigateur sans mot de passe
 * reste bloqué sur l'écran de déverrouillage et échoue trente secondes plus tard
 * sur un sélecteur introuvable, ce qui n'apprend rien à personne.
 */
export function motDePasseEssais() {
  const mdp = motDePasseEssaisOuNull();
  if (mdp) return mdp;
  console.error(
    '\n\x1b[31mMot de passe absent.\x1b[0m Cet essai déverrouille une page du site et a ' +
      'besoin du mot de passe, qui n’est écrit nulle part dans le dépôt.\n\n  ' +
      AIDE_MOT_DE_PASSE.split('\n').slice(1).join('\n  ') +
      '\n',
  );
  process.exit(2);
}

/**
 * Le mot de passe, ou `null` — sans arrêter le script.
 *
 * Un seul appelant en a besoin : `essais:secret`, qui tourne pour QUICONQUE,
 * y compris sans le mot de passe. Son contrôle structurel passe toujours ; son
 * contrôle exact — « aucun fichier suivi ne contient le mot de passe » — ne
 * peut pas chercher ce qu'il ne connaît pas, et le dit alors.
 *
 * Aucun autre essai ne doit l'employer : un essai de navigateur sans mot de
 * passe reste bloqué sur l'écran de déverrouillage et échoue trente secondes
 * plus tard sur un sélecteur introuvable, ce qui n'apprend rien à personne.
 */
export function motDePasseEssaisOuNull() {
  return lireMotDePasseEventuelSync();
}
