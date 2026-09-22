/**
 * Configuration centrale du site.
 * C'est le SEUL fichier à modifier pour changer le mot de passe, le nom du
 * dépôt GitHub Pages ou les réglages de chiffrement.
 */
export default {
  /** Titre affiché dans l'onglet du navigateur et l'en-tête. */
  titre: 'Espace de révision',

  /**
   * Chemin de base sur GitHub Pages — doit correspondre à l'adresse publique.
   *
   *   Adresse visée                                        base
   *   ---------------------------------------------------  --------------------
   *   https://risitaslegrand.github.io/     (configuration   '/'
   *                                          actuelle)
   *   https://revinsp.github.io/                             '/'
   *   https://risitaslegrand.github.io/un-depot/             '/un-depot'
   *
   * Rappel : l'adresse « https://<nom>.github.io/ » n'est servie que si le
   * dépôt « <nom>.github.io » appartient au compte (ou à l'organisation)
   * « <nom> ». Voir la section « Publier sur GitHub Pages » du README.
   */
  base: '/',

  /** Branche de publication utilisée par « npm run deploy ». */
  brancheDeploiement: 'gh-pages',

  /**
   * Empreinte SHA-256 (hexadécimal minuscule) du mot de passe.
   * Pour la recalculer après un changement de mot de passe :
   *     npm run hash
   */
  motDePasseHash: '482c2515aa007dce86a1b64a081b5137754c305312f6f7ba01cfbd90bce5d234',

  /** Paramètres de dérivation de clé (PBKDF2) et de chiffrement (AES-GCM). */
  crypto: {
    iterations: 600000, // recommandation OWASP pour PBKDF2-HMAC-SHA256
    tailleSelOctets: 16,
    tailleIvOctets: 12,
    tailleCleBits: 256,
  },

  /** Comportement du glossaire automatique. */
  glossaire: {
    /** true = ne souligner que la première occurrence de chaque terme par fiche. */
    premiereOccurrenceSeulement: false,
    /** Longueur minimale d'un terme pour être détecté automatiquement. */
    longueurMinimale: 3,
  },

  /** Points d'expérience attribués par action. */
  xp: {
    flashcardDifficile: 3,
    flashcardMoyen: 5,
    flashcardFacile: 7,
    quizTermine: 10,
    quizBonneReponse: 2,
    ficheTerminee: 20,
    /** Quad N-Back : base par session terminée, puis bonus selon n et réussite. */
    nbackSession: 8,
    nbackParNiveau: 4,
    nbackBonusReussite: 10,
  },
};
