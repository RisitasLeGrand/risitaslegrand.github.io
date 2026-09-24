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

  /**
   * Fiches audio (« podcasts »).
   *
   * Le script parlé est produit à chaque build par « scripts/podcasts.mjs »,
   * la voix par Piper, en local : aucune fiche n'est envoyée à un service
   * tiers, et l'audio est chiffré comme le reste du contenu.
   * Voir la section « Fiches audio » du README.
   */
  podcast: {
    /**
     * Moteur de synthèse, tous deux locaux et gratuits :
     *   « kokoro » — diction nettement plus naturelle, environ cinq fois plus
     *                lente à produire. C'est le choix par défaut ;
     *   « piper »  — rapide, diction plus mécanique. Pour un essai, ou sur une
     *                machine modeste.
     */
    moteur: 'kokoro',

    /** Modèle multilingue Kokoro v1.0 ; « ff_siwis » est sa voix française. */
    kokoro: { modele: 'kokoro-multi-lang-v1_0', voix: 'ff_siwis' },

    /** Modèle Piper (une voix par modèle) : siwis et upmc sont féminines, tom masculine. */
    piper: { voix: 'fr_FR-siwis-medium' },

    /**
     * Vitesse de diction, 1 = naturelle. En dessous, la lecture se fait plus
     * lente et plus douce — ce qui convient mieux à un cours qu'à un roman.
     */
    vitesse: 0.95,

    /** Silence entre deux paragraphes, puis entre deux phrases (millisecondes). */
    silenceParagrapheMs: 560,
    silencePhraseMs: 190,

    /** Débit du MP3 : de la parole en mono, pas de la musique. */
    bitrate: '32k',
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
