/**
 * Configuration centrale du site.
 * C'est le SEUL fichier à modifier pour changer le mot de passe, le nom du
 * dépôt GitHub Pages ou les réglages de chiffrement.
 */
export default {
  /**
   * Nom du produit, affiché dans l'onglet du navigateur et l'en-tête.
   *
   * Cyclades est l'application ; Révisions, Odyssée et Sport en sont les
   * branches (voir `src/lib/branches.ts`). Les clés de stockage local gardent
   * le préfixe `revinsp.` et la base IndexedDB garde son nom : les renommer
   * coûterait l'état des installations existantes pour un gain nul. La table de
   * correspondance est dans `docs/cyclades/renommage.md`.
   */
  titre: 'Cyclades',

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

  /**
   * Dépôt de publication, « compte/dépôt », sous le nom que GitHub lui donne
   * aujourd'hui. Déclaré ici pour que « npm run deploy » puisse vérifier que la
   * télécommande « origin » le désigne bien, au lieu de le supposer.
   *
   * **Pourquoi ce contrôle existe.** Le 14 octobre 2026, une publication est
   * partie vers « RisitasLeGrand/revinsp » — un ancien nom du dépôt, que GitHub
   * redirige en silence vers celui-ci. Elle a abouti, et rien dans le compte
   * rendu ne le signalait : seule une ligne « remote: This repository moved »,
   * noyée dans la sortie de git, en portait la trace.
   *
   * Une redirection n'est pas un contrat. GitHub la retire si quelqu'un recrée
   * un dépôt sous l'ancien nom — et la publication partirait alors chez ce
   * quelqu'un, sans un mot. Mieux vaut un refus bruyant qu'un succès trompeur.
   */
  depotDePublication: 'RisitasLeGrand/risitaslegrand.github.io',

  /** Branche de publication utilisée par « npm run deploy ». */
  brancheDeploiement: 'gh-pages',

  /*
     « motDePasseHash » a été RETIRÉ le 17 octobre 2026. Point 1 du prompt 44.

     C'était une empreinte SHA-256 **sans sel** du mot de passe, et ce fichier
     part dans le paquet construit, donc dans la branche publiée. Une empreinte
     sans sel se teste par dizaines de milliards par seconde sur une carte
     graphique ordinaire : pour un mot de passe court, le retrouver prenait
     quelques secondes — et avec lui tout le contenu du dépôt. Les 600 000
     itérations de PBKDF2 ci-dessous n'y changeaient rien, puisqu'un attaquant
     ne passait plus par elles.

     Elle ne servait qu'à choisir entre deux messages d'erreur. La vraie
     vérification existait déjà : dériver la clé et ouvrir le témoin chiffré
     publié avec le contenu. C'est désormais la seule, pour le site comme pour
     le coffre, et « essais:aucune-empreinte » refuse qu'une empreinte du mot
     de passe réapparaisse dans « dist/ ».

     La garde de construction — ne pas republier tout le contenu sous un mot de
     passe différent par mégarde — n'a pas disparu : son témoin a déménagé dans
     « .temoin-mot-de-passe.local.json », salé, à 600 000 itérations, ignoré
     par Git et jamais publié.

     DEUX CHOSES QUE CE RETRAIT NE RÈGLE PAS, et qu'il faut dire :

     1. L'empreinte reste dans l'HISTORIQUE Git et dans les paquets déjà
        publiés. Le mot de passe actuel doit donc être tenu pour exposé tant
        qu'il n'a pas changé. C'est une décision d'Alexis.
     2. Une sauvegarde « .cyclades » chiffrée avant le 11 octobre 2026 ne
        s'ouvre qu'avec l'ANCIEN mot de passe. Le dialogue de restauration
        doit accepter un mot de passe différent de l'actuel, et le dire.
  */

  /**
   * Date du dernier changement de mot de passe, au format AAAA-MM-JJ.
   *
   * Tenue par « npm run mot-de-passe », et affichée sur l'écran des appareils.
   * Elle n'est pas une décoration : c'est elle qui permet de dire franchement
   * ce qu'un changement ne fait pas. Un paquet de synchronisation ou une
   * sauvegarde antérieurs à cette date s'ouvrent encore avec l'ANCIEN mot de
   * passe — un retrait d'appareil n'est pas une révocation, et l'interface doit
   * le dire plutôt que de laisser croire le contraire.
   */
  motDePasseChangeLe: '2026-10-11',

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

    /**
     * Silence avant le début d'une PARTIE (prompt 55, N°2).
     *
     * Plus long qu'une respiration de paragraphe : une partie n'est pas un
     * paragraphe de plus, c'est un changement de sujet, et l'oreille a besoin
     * qu'on le lui dise avant même d'entendre « Deuxième partie, sur trois ».
     * Mille quatre cents millisecondes, mesurés par l'audit comme le seuil
     * au-delà duquel la coupure s'entend sans donner l'impression d'un blanc.
     *
     * Il entre dans l'empreinte du script : le changer force une
     * régénération, puisque le son produit n'est plus le même.
     */
    silencePartieMs: 1400,

    /**
     * Sonie visée à l'encodage, en LUFS (prompt 55, N°4, décision 4).
     *
     * Les fiches audio sortaient nettement plus bas que ce qu'on entend
     * ailleurs : il fallait monter le volume du téléphone pour les suivre,
     * puis le redescendre en changeant d'application. −16 LUFS est la cible
     * usuelle de la parole en mobilité — c'est le choix d'Alexis.
     *
     * Appliqué par le filtre `loudnorm` de ffmpeg, avec un plafond de crête
     * à −1,5 dBTP pour garder de la marge, et une plage dynamique de 11.
     *
     * Dans l'empreinte, pour la même raison que les silences.
     */
    sonie: -16,

    /**
     * Encodage : « opus » (recommandé) ou « mp3 » pour un navigateur ancien.
     * Opus à 16 kbit/s en mono reste net sur de la parole et pèse deux fois
     * moins qu'un MP3 à 32 — ce qui compte, pour des dizaines d'heures.
     * En dessous de 12k, la voix devient métallique.
     */
    format: 'opus',
    bitrate: '16k',
  },

  /** Points d'expérience attribués par action. */
  xp: {
    /**
     * UNE SEULE VALEUR, QUELLE QUE SOIT LA NOTE (prompt 43, F4).
     *
     * Les quatre notes rapportaient 3, 4, 5 et 7 points. La note dit à
     * l'ordonnanceur quand revoir la carte ; la payer plus cher quand on se
     * déclare à l'aise met en balance deux choses qui n'ont rien à voir, et
     * pousse à surnoter — ce qui fausse FSRS pour gagner quatre points, donc
     * fait revenir trop tard des cartes qu'on ne sait pas.
     *
     * La récompense porte désormais sur le geste : avoir révisé la carte.
     * Cinq points, qui est l'ancienne valeur de « Correct » — ni l'inflation
     * du maximum, ni la déflation du minimum, de sorte qu'un total d'hier et
     * un total d'aujourd'hui restent comparables.
     */
    flashcardRevue: 5,
    quizTermine: 10,
    quizBonneReponse: 2,
    ficheTerminee: 20,
    /**
     * Prétest : récompense forfaitaire pour **avoir tenté**, jamais pour avoir
     * bien répondu. Se tromper avant d'avoir lu est attendu, et c'est même ce
     * qui fait l'effet ; récompenser la justesse installerait une anxiété
     * exactement là où il ne faut pas.
     */
    pretestTente: 4,
    /** Quad N-Back : base par session terminée, puis bonus selon n et réussite. */
    nbackSession: 8,
    nbackParNiveau: 4,
    nbackBonusReussite: 10,
    /**
     * Relational Reasoning : base par session, puis bonus par item réussi et
     * selon l'échelon de difficulté atteint. Un item y demande plus de temps
     * qu'une flashcard, d'où un rapport par item plus élevé.
     */
    relationnelSession: 8,
    relationnelParItem: 4,
    relationnelParPhase: 3,
    /**
     * Veridical Mapping : base par session, puis bonus par essai réussi et
     * prime à chaque paire dont le seuil se stabilise. Un essai y est très
     * court, d'où un rapport par essai bien plus faible qu'ailleurs.
     */
    veridicalSession: 6,
    veridicalParEssai: 1,
    veridicalConvergence: 25,
  },
};
