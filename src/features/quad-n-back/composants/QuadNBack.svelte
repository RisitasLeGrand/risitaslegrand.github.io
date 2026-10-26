<script>
  /**
   * Exercice Quad N-Back : écran de réglages, boucle de jeu, bilan.
   *
   * La logique de jeu vient de « quad-box » (licence MIT, voir
   * LICENCE-quad-box.txt) ; l'enchaînement des écrans, le stockage et la
   * gamification sont ceux du site — une seule base IndexedDB, un seul
   * système d'XP, de badges et de série de jours.
   */
  import { onMount, onDestroy, tick } from 'svelte';
  import Grille from './Grille.svelte';
  import {
    genererPartie,
    calculerScore,
    progressionAutomatique,
    titrePartie,
    nomMode,
    DIMENSIONS,
    EXCLUSIONS,
    SOURCES_MOTIF,
    PROGRESSION_DEFAUT,
  } from '../moteur/nback.js';
  import { lecteurAudio } from '../moteur/audio.js';
  import { RETOURS } from '../moteur/constantes.js';
  import { amenerLaZone } from '../../cog-training/zone-de-jeu';
  import { confirmer } from '../../../lib/boite';
  import CommentCaMarche from '../../cog-training/composants/CommentCaMarche.svelte';
  import Glossaire from '../../cog-training/composants/Glossaire.svelte';
  import Terme from '../../cog-training/composants/Terme.svelte';
  import { registreDesTermes, CLEF_TERMES_VUS } from '../../cog-training/termes-vus';
  import { setContext } from 'svelte';
  import { ajouterSessionNBack, toutesLesSessionsNBack } from '../../../lib/db';
  import { gagnerXp, xpNBack } from '../../../lib/gamification';
  import { notifier } from '../../../lib/ui';

  const CLE_REGLAGES = 'revinsp.nback.reglages';

  /** Touches par défaut : les quatre doigts de la main gauche, comme quad-box. */
  const TOUCHES_DEFAUT = Object.fromEntries(DIMENSIONS.map((d) => [d.cle, d.touche]));

  const REGLAGES_DEFAUT = {
    // Valeurs par défaut de quad-box : 30 épreuves, 2,5 s, 25 % de
    // correspondances, 20 % d'interférence.
    n: 2,
    epreuves: 30,
    dureeEpreuve: 2500,
    tauxCorrespondance: 25,
    interference: 20,
    dimensions: ['position', 'couleur', 'forme', 'son'],
    sourceMotif: 'voronoi',
    grille3D: true,
    retourImmediat: true,
    progression: { ...PROGRESSION_DEFAUT },
    touches: { ...TOUCHES_DEFAUT },
  };

  /** Touches réservées par l'interface, qu'on refuse d'affecter à une dimension. */
  const TOUCHES_RESERVEES = new Set(['escape', 'tab', 'enter', ' ', 'f5']);

  let reglages = $state({ ...REGLAGES_DEFAUT });
  let ecran = $state('accueil'); // accueil | jeu | bilan

  /*
     LE REGISTRE DES TERMES DÉJÀ VUS DANS L'ÉCRAN COURANT (P9).

     Seule la première apparition d'un terme technique est interactive. Le
     registre se vide au changement d'écran : « premier » veut dire premier de
     CET écran, et quelqu'un qui lance directement une partie n'aurait jamais
     vu un seul terme cliquable si le compte courait sur toute la session.
  */
  const termesVus = registreDesTermes();
  setContext(CLEF_TERMES_VUS, termesVus);
  // $state.raw et non $state : un objet $state profond est un Proxy, et
  // IndexedDB refuse de sérialiser un Proxy (« could not be cloned »).
  // Seule la réaffectation de « partie » doit déclencher un rendu ; les
  // réponses sont reflétées par « signalees », qui reste réactif.
  let partie = $state.raw(null);
  let index = $state(-1);
  let visible = $state(false);
  let signalees = $state({});
  /**
   * Retour visuel par dimension pendant la partie :
   * 'neutre' | 'reussite' | 'echec' | 'oubli'.
   * Reprend les quatre états de quad-box (blank / success / failure /
   * late-failure), y compris l'oubli signalé en fin d'épreuve.
   */
  let retours = $state({});
  let minuteurOubli = null;
  let bilan = $state(null);
  let historique = $state([]);
  let compteAvant = $state(0);
  let sombre = $state(false);
  let debutSession = 0;
  let minuteurs = [];

  /*
     LES RÉGLAGES DE LA DÉCOUVERTE, et pourquoi ils vivent à part.

     La décision 1 interdit de toucher aux valeurs par défaut de l'exercice.
     Une découverte qui les écraserait les rendrait au mieux à l'identique, au
     pire plus du tout — et le prix d'une erreur serait payé par quelqu'un qui
     vient d'essayer. Elle ne les lit donc pas : elle a les siens, en dur,
     ceux du constat P3.
  */
  const DECOUVERTE = {
    n: 1,
    epreuves: 12,
    dimensions: ['position'],
    grille3D: false,
    dureeEpreuve: 3000,
    retourImmediat: true,
    /*
       UN POURCENTAGE, PAS UNE FRACTION. J'avais écrit 0,3 en croyant dire
       « trois sur dix » : le réglage s'exprime en pourcent — 25 par défaut,
       comme quad-box — et 0,3 vaut donc trois pour mille. La découverte
       n'avait RIEN à repérer, son bilan annonçait « 0 répétition sur 0 », et
       l'astuce du constat P3, qui attend le premier tour comparable, ne
       pouvait jamais paraître. Une découverte sans rien à trouver n'apprend
       rien, et aucune erreur ne le signalait.

       40 plutôt que 25 : la découverte doit montrer vite ce qu'est une
       répétition, et douze tours ne laissent pas la place d'attendre.
    */
    tauxCorrespondance: 40,
    interference: 0,
    sourceMotif: 'voronoi',
    decouverte: true,
  };

  /**
   * Ce que la partie EN COURS suit, et qui n'est pas forcément les réglages.
   *
   * Pendant une partie, le rythme, la profondeur et le retour immédiat se
   * lisaient dans `reglages` — ce qui marchait tant qu'une seule sorte de
   * partie existait. Une découverte à 3 s par tour aurait alors défilé au
   * rythme de 2,5 s de la vraie partie, et son retour immédiat aurait dépendu
   * d'une case réglée pour une autre partie. Pire : régler les dimensions
   * pendant qu'une partie court aurait changé la partie en cours.
   *
   * `enJeu` est posé au lancement et ne bouge plus. `partie.meta` porte déjà
   * `n`, les dimensions et la grille ; ce qui manquait, c'est le rythme et le
   * retour.
   */
  let enJeu = $state({ ...REGLAGES_DEFAUT, decouverte: false });

  /**
   * La durée de la découverte, en clair, déduite de ses réglages.
   *
   * `Intl` et non `toFixed` : c'est la règle du format, et une durée arrondie
   * à la dizaine de secondes se lit mieux qu'une seconde près — personne ne
   * compte « 36 secondes ».
   */
  /**
   * Un pourcentage, par `Intl` et non par `toFixed` ni `Math.round` suivi
   * d'un « % » posé à la main.
   *
   * C'est la règle du format, et elle a une raison ici : `Intl` met l'espace
   * insécable avant le signe, que « ${x} % » n'a pas, et qu'un retour à la
   * ligne entre le nombre et le signe rendrait visible.
   */
  const pourcent = (part) =>
    new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 }).format(part);

  /** Des secondes, avec la virgule et l'espace insécable que `Intl` pose. */
  const secondes = (valeur) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'unit',
      unit: 'second',
      unitDisplay: 'narrow',
      maximumFractionDigits: 1,
    }).format(valeur);

  /** Des minutes, même règle. */
  const minutes = (enSecondes) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'unit',
      unit: 'minute',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(enSecondes / 60);

  const dureeDecouverte = (() => {
    const secondes = (DECOUVERTE.epreuves * DECOUVERTE.dureeEpreuve) / 1000;
    if (secondes < 90) {
      const dizaines = Math.round(secondes / 10) * 10;
      return `environ ${new Intl.NumberFormat('fr-FR').format(dizaines)} secondes`;
    }
    const minutes = Math.round(secondes / 60);
    return `environ ${new Intl.NumberFormat('fr-FR').format(minutes)} minutes`;
  })();

  /*
     L'ASTUCE DE LA DÉCOUVERTE, montrée UNE FOIS.

     Le constat P3 veut qu'au premier tour comparable une phrase dise quoi
     faire. Une fois, et pas à chaque correspondance : répétée, elle
     répondrait à la place de la personne et la découverte n'apprendrait plus
     rien. Elle n'existe que dans la découverte — dans une vraie partie, ce
     serait souffler la réponse.
  */
  let astuce = $state('');
  let astuceVue = $state(false);

  /** Le son n'a pas pu jouer : la dimension est retirée, et on le dit (P12). */
  let sonEnPanne = $state(false);

  /** La consigne est ouverte pendant la partie : la partie est en pause (P2 du 51). */
  let consigneEnPause = $state(false);

  /** La zone de jeu, pour l'amener sous les yeux au lancement (P1 du 51). */
  let zoneDeJeu = $state(null);

  /*
     Le jeton de lancement.

     Entre « Commencer » et la première épreuve, on attend désormais que la
     zone de jeu soit visible — une attente, donc un intervalle pendant lequel
     la personne peut relancer. « Recommencer » et « Arrêter » appellent
     `nettoyerMinuteurs`, mais un minuteur PAS ENCORE POSÉ ne se nettoie pas :
     l'ancien lancement reprendrait la main après coup et ferait défiler les
     épreuves de la partie suivante. C'est exactement le défaut que le
     commentaire de `commencer` signale déjà pour les minuteurs ; l'attente le
     rouvrait par une autre porte.

     Chaque lancement prend donc un numéro, et ne pose son minuteur que s'il
     est encore le dernier.
  */
  let lancement = 0;
  /** Dimension dont on attend la nouvelle touche, ou null. */
  let captureTouche = $state(null);
  let messageTouche = $state('');
  let erreurHistorique = $state('');

  // --- Réglages mémorisés -------------------------------------------------
  function chargerReglages() {
    try {
      const brut = localStorage.getItem(CLE_REGLAGES);
      if (brut) {
        const enregistre = JSON.parse(brut);
        // Fusion en profondeur pour « touches » : une dimension ajoutée plus
        // tard doit garder sa touche par défaut plutôt que de disparaître.
        reglages = {
          ...REGLAGES_DEFAUT,
          ...enregistre,
          touches: { ...TOUCHES_DEFAUT, ...(enregistre.touches ?? {}) },
          progression: { ...PROGRESSION_DEFAUT, ...(enregistre.progression ?? {}) },
        };
      }
    } catch {
      /* navigation privée */
    }
  }

  function memoriserReglages() {
    try {
      localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages));
    } catch {
      /* navigation privée */
    }
  }

  function observerTheme() {
    const lire = () => (sombre = document.documentElement.getAttribute('data-theme') === 'sombre');
    lire();
    const observateur = new MutationObserver(lire);
    observateur.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observateur.disconnect();
  }

  let arreterObservation = () => {};

  onMount(() => {
    chargerReglages();
    arreterObservation = observerTheme();
    lecteurAudio.precharger();
    void rafraichirHistorique();
    return () => arreterObservation();
  });

  async function rafraichirHistorique() {
    try {
      const sessions = await toutesLesSessionsNBack();
      historique = sessions
        .filter((session) => session.statut !== 'jalon')
        .sort((a, b) => b.le.localeCompare(a.le))
        .slice(0, 8);
    } catch (erreur) {
      // Un échec de lecture ne doit pas rester muet : c'est ce qui avait rendu
      // invisible une panne générale de la base sur cette page.
      erreurHistorique = erreur instanceof Error ? erreur.message : String(erreur);
      historique = [];
    }
  }

  // --- Déroulement de la partie ------------------------------------------
  function nettoyerMinuteurs() {
    /*
       Un lancement en attente de la zone de jeu n'a pas encore de minuteur à
       éteindre : l'invalider demande de périmer son jeton. Sans cette ligne,
       « Arrêter » pendant l'attente laisserait la partie démarrer juste après.
    */
    lancement += 1;
    for (const m of minuteurs) clearTimeout(m);
    minuteurs = [];
    if (minuteurOubli !== null) {
      clearTimeout(minuteurOubli);
      minuteurOubli = null;
    }
  }

  const retoursNeutres = () =>
    Object.fromEntries(enJeu.dimensions.map((cle) => [cle, 'neutre']));

  /**
   * Fin d'une épreuve : les correspondances qui n'ont pas été signalées
   * apparaissent en « oubli ». Comme dans quad-box, ce retour déborde
   * volontairement sur le début de l'épreuve suivante, le temps d'être vu,
   * puis s'efface au bout d'une demi-seconde.
   */
  function detecterOublis(indiceEpreuve) {
    if (!enJeu.retourImmediat || !partie || indiceEpreuve < 0) return;
    const epreuve = partie.epreuves[indiceEpreuve];
    if (!epreuve) return;

    const suivants = {};
    let oubliDetecte = false;
    for (const cle of partie.meta.dimensions) {
      const manquee = epreuve.correspondances.includes(cle) && !signalees[cle];
      suivants[cle] = manquee ? 'oubli' : 'neutre';
      if (manquee) oubliDetecte = true;
    }
    retours = suivants;

    if (!oubliDetecte) return;
    if (minuteurOubli !== null) clearTimeout(minuteurOubli);
    minuteurOubli = window.setTimeout(() => {
      retours = Object.fromEntries(
        Object.entries(retours).map(([cle, etat]) => [cle, etat === 'oubli' ? 'neutre' : etat]),
      );
      minuteurOubli = null;
    }, 500);
  }

  function planifier(fn, delai) {
    minuteurs.push(setTimeout(fn, delai));
  }

  /** Lance la vraie partie, aux réglages de la personne. */
  function commencer() {
    if (reglages.dimensions.length === 0) return;
    lancerUnePartie({ ...reglages, decouverte: false });
  }

  /**
   * Lance la partie découverte, aux réglages du constat P3.
   *
   * Elle n'écrit rien : le garde-fou existait déjà dans `terminer`, qui
   * n'enregistre qu'une partie « terminee ». La découverte s'achève sur une
   * autre cause, et sort donc avant la première écriture — aucune session,
   * aucun XP, aucun badge, aucun jalon de progression.
   */
  function commencerLaDecouverte() {
    lancerUnePartie(DECOUVERTE);
  }

  function lancerUnePartie(parametres) {
    if (parametres.dimensions.length === 0) return;
    enJeu = { ...parametres };
    sonEnPanne = false;
    lecteurAudio.oublierLEchec();
    /*
       L'écran apprend l'échec de lecture, et en tire la seule conséquence
       honnête : la dimension Son sort de la partie EN COURS. La laisser
       compterait des oublis que personne ne pouvait éviter, et le score
       reprocherait à la personne un haut-parleur muet.
    */
    lecteurAudio.surEchec = () => {
      if (!enJeu.dimensions.includes('son')) return;
      sonEnPanne = true;
      enJeu = { ...enJeu, dimensions: enJeu.dimensions.filter((d) => d !== 'son') };
      if (partie) {
        partie = {
          ...partie,
          meta: { ...partie.meta, dimensions: partie.meta.dimensions.filter((d) => d !== 'son') },
        };
      }
      retours = retoursNeutres();
    };
    // Indispensable pour le redémarrage en cours de partie : sans cela, les
    // minuteurs de la session abandonnée continueraient de faire défiler les
    // épreuves de la nouvelle.
    nettoyerMinuteurs();
    /*
       Les réglages ne sont mémorisés que pour une vraie partie : la décision 1
       veut que ceux de l'exercice restent intacts, et la découverte n'a pas à
       devenir le nouveau défaut de qui l'essaie une fois.
    */
    if (!enJeu.decouverte) memoriserReglages();

    // Le déverrouillage audio part avec le geste de l'utilisateur — condition
    // des navigateurs mobiles — mais on ne l'attend pas : la promesse peut
    // mettre un temps indéterminé à se résoudre, et la partie resterait alors
    // figée sur un écran inerte après le clic. Le premier son n'intervient
    // qu'une seconde plus tard, au lancement de la première épreuve.
    void lecteurAudio.debloquer();

    partie = genererPartie({
      n: enJeu.n,
      epreuves: enJeu.epreuves,
      dimensions: [...enJeu.dimensions],
      grille3D: enJeu.grille3D,
      tauxCorrespondance: enJeu.tauxCorrespondance,
      interference: enJeu.interference,
      sourceMotif: enJeu.sourceMotif,
    });
    index = -1;
    astuce = '';
    astuceVue = false;
    signalees = {};
    retours = retoursNeutres();
    bilan = null;
    debutSession = Date.now();
    termesVus.vider();
    ecran = 'jeu';

    /*
       La partie ne démarre qu'une fois la zone de jeu visible.

       L'ordre compte : `tick` attend que l'écran de jeu soit rendu — sans lui
       `zoneDeJeu` est encore nulle —, puis `amenerLaZone` ne rend la main que
       lorsque la grille est effectivement sous les yeux. La seconde de
       battement garde sa raison d'être par-dessus : on ne doit pas rater un
       stimulus parce que l'écran vient de changer.
    */
    const mien = (lancement += 1);
    void (async () => {
      await tick();
      await amenerLaZone(zoneDeJeu);
      if (mien !== lancement || ecran !== 'jeu') return; // relancé ou quitté entre-temps
      planifier(epreuveSuivante, 1000);
    })();
  }

  function epreuveSuivante() {
    // L'épreuve qui s'achève livre d'abord son verdict sur les oublis.
    detecterOublis(index);

    index += 1;
    if (!partie || index >= partie.epreuves.length) {
      void terminer(enJeu.decouverte ? 'decouverte' : 'terminee');
      return;
    }

    signalees = {};
    visible = true;
    const epreuve = partie.epreuves[index];

    /*
       L'astuce paraît au premier tour où une comparaison est possible ET où
       la position se répète : c'est le seul tour où la phrase est vraie. La
       montrer plus tôt parlerait d'un tour qui n'a rien à comparer.
    */
    if (enJeu.decouverte && !astuceVue && index >= partie.meta.n && epreuve.correspondances.includes('position')) {
      astuce = 'Ce carré est à la même place qu’au tour précédent : c’est le moment de toucher Position.';
      astuceVue = true;
    } else if (astuce && index > 0) {
      astuce = '';
    }

    if (enJeu.dimensions.includes('son')) lecteurAudio.jouer(epreuve.son);

    // Le stimulus reste affiché la moitié du temps d'épreuve : l'intervalle
    // vide oblige à mémoriser plutôt qu'à comparer visuellement.
    planifier(() => (visible = false), enJeu.dureeEpreuve * 0.5);
    planifier(epreuveSuivante, enJeu.dureeEpreuve);
  }

  /*
     LA PAUSE REJOUE L'ÉPREUVE EN COURS, elle ne la saute pas.

     L'épreuve se joue sur deux minuteurs : l'un cache le stimulus à mi-temps,
     l'autre enchaîne. Les éteindre suffit à figer l'écran — mais reprendre par
     « epreuveSuivante » appellerait `detecterOublis` sur l'épreuve interrompue
     et compterait un OUBLI à qui vient de lire la consigne. Pénaliser la
     lecture de la règle serait exactement le contraire de ce que ce lot
     cherche.

     On réarme donc les deux minuteurs sur le MÊME index, sans avancer et sans
     détecter d'oubli : l'épreuve se rejoue en entier. Le prix est dit
     franchement — ouvrir la consigne redonne du temps sur l'épreuve en cours.
     C'est un prix qu'on paie volontiers pour ne pas punir une question.
  */
  function ouvrirLaConsigne() {
    nettoyerMinuteurs();
    consigneEnPause = true;
  }

  function reprendreApresLaConsigne() {
    consigneEnPause = false;
    if (ecran !== 'jeu' || !partie || index < 0 || index >= partie.epreuves.length) return;

    const mien = (lancement += 1);
    const epreuve = partie.epreuves[index];
    visible = true;
    if (enJeu.dimensions.includes('son')) lecteurAudio.jouer(epreuve.son);
    if (mien !== lancement) return;
    planifier(() => (visible = false), enJeu.dureeEpreuve * 0.5);
    planifier(epreuveSuivante, enJeu.dureeEpreuve);
  }

  function signaler(dimension) {
    if (ecran !== 'jeu' || index < 0 || !partie) return;
    if (!partie.meta.dimensions.includes(dimension)) return;
    if (signalees[dimension]) return; // une seule réponse par épreuve

    signalees = { ...signalees, [dimension]: true };
    partie.epreuves[index].reponses[dimension] = true;

    // Les n premières épreuves n'ont pas de point de comparaison : y répondre
    // ne compte pas dans le score, le retour reste donc neutre.
    if (!enJeu.retourImmediat || index < partie.meta.n) return;
    const juste = partie.epreuves[index].correspondances.includes(dimension);
    retours = { ...retours, [dimension]: juste ? 'reussite' : 'echec' };
  }

  async function terminer(cause) {
    nettoyerMinuteurs();
    visible = false;
    if (!partie) return;

    const score = calculerScore(partie);
    const secondes = Math.round((Date.now() - debutSession) / 1000);
    const titre = titrePartie(partie.meta.dimensions);
    bilan = { ...score, cause, n: partie.meta.n, decision: 'stable', suivant: partie.meta.n };
    termesVus.vider();
    ecran = 'bilan';

    // Une partie abandonnée n'est pas enregistrée : elle fausserait
    // l'historique et la progression de niveau.
    if (cause !== 'terminee') return;

    await ajouterSessionNBack({
      le: new Date().toISOString(),
      titre,
      statut: 'terminee',
      n: partie.meta.n,
      dimensions: [...partie.meta.dimensions],
      nombreEpreuves: partie.meta.nombreEpreuves,
      taux: score.taux,
      reperees: score.reperees,
      aReperer: score.aReperer,
      erreurs: score.erreurs,
      secondes,
    });

    const gain = await gagnerXp(xpNBack(partie.meta.n, score.taux), { secondes: 0 });
    compteAvant = gain.xpGagne;
    for (const badge of gain.nouveauxBadges) notifier(`${badge.icone} Succès : ${badge.nom}`, 'badge');
    if (gain.monteeDeNiveau) notifier(`Niveau ${gain.niveau.niveau} atteint`, 'succes');

    // Progression automatique : on relit l'historique, la partie qui vient
    // d'être jouée comprise, puis on pose un jalon si le niveau change — sans
    // lui, les mêmes parties seraient recomptées à la session suivante.
    const sessions = (await toutesLesSessionsNBack()).sort((a, b) => b.le.localeCompare(a.le));
    const resultat = progressionAutomatique(
      { titre, n: partie.meta.n, taux: score.taux },
      sessions,
      reglages.progression,
    );

    bilan = { ...bilan, decision: resultat.decision, suivant: resultat.n };

    if (resultat.decision !== 'stable') {
      await ajouterSessionNBack({
        le: new Date().toISOString(),
        titre,
        statut: 'jalon',
        n: partie.meta.n,
        dimensions: [...partie.meta.dimensions],
        nombreEpreuves: partie.meta.nombreEpreuves,
        taux: score.taux,
        reperees: score.reperees,
        aReperer: score.aReperer,
        erreurs: score.erreurs,
        secondes: 0,
      });
      reglages.n = resultat.n;
      notifier(
        resultat.decision === 'montee'
          ? `↑ Niveau n = ${resultat.n}`
          : `↓ Niveau n = ${resultat.n}`,
        resultat.decision === 'montee' ? 'succes' : 'info',
      );
    }

    memoriserReglages();
    await rafraichirHistorique();
  }

  function abandonner() {
    void terminer('abandonnee');
  }

  /**
   * Abandonne la partie en cours et en relance aussitôt une autre avec les
   * mêmes réglages, sans repasser par l'écran de bilan ni par les réglages.
   * La séquence de stimuli, elle, est régénérée : il s'agit bien d'une
   * nouvelle partie, pas d'une reprise.
   *
   * La partie abandonnée n'est pas enregistrée, comme tout abandon.
   */
  /**
   * Recommencer, mais pas par surprise.
   *
   * Le bouton est collé à la jauge de progression : le viser et le manquer
   * coûtait la partie en cours, sans rien demander. La confirmation dit ce
   * qu'on perd — c'est le même soin qu'« Arrêter », qui est moins grave.
   */
  async function recommencerApresConfirmation() {
    const oui = await confirmer({
      titre: 'Recommencer la partie ?',
      texte: 'La partie en cours est abandonnée et ne sera pas enregistrée.',
      action: 'Recommencer',
      annuler: 'Continuer',
    });
    if (oui) recommencer();
  }

  function recommencer() {
    commencer();
  }

  function retourAccueil() {
    nettoyerMinuteurs();
    partie = null;
    ecran = 'accueil';
  }

  /** Libellé lisible d'une touche (pour l'affichage). */
  function libelleTouche(touche) {
    if (!touche) return '—';
    if (touche === ' ') return 'Espace';
    return touche.length === 1 ? touche.toUpperCase() : touche;
  }

  function demarrerCapture(cle) {
    captureTouche = captureTouche === cle ? null : cle;
    messageTouche = '';
  }

  /**
   * Affecte une touche à une dimension.
   * Si la touche sert déjà à une autre dimension, les deux sont échangées :
   * on ne peut donc jamais se retrouver avec une dimension sans touche.
   */
  function affecterTouche(cle, touche) {
    const normalisee = touche.toLowerCase();
    if (TOUCHES_RESERVEES.has(normalisee)) {
      messageTouche = `« ${libelleTouche(touche)} » est réservée par l'interface.`;
      return;
    }

    const occupant = Object.entries(reglages.touches).find(
      ([autre, t]) => autre !== cle && t === normalisee,
    );
    const ancienne = reglages.touches[cle];

    const touches = { ...reglages.touches, [cle]: normalisee };
    if (occupant) touches[occupant[0]] = ancienne;
    reglages.touches = touches;

    messageTouche = occupant
      ? `Touches échangées avec « ${DIMENSIONS.find((d) => d.cle === occupant[0])?.libelle} ».`
      : '';
    captureTouche = null;
    memoriserReglages();
  }

  function reinitialiserTouches() {
    reglages.touches = { ...TOUCHES_DEFAUT };
    captureTouche = null;
    messageTouche = 'Touches remises par défaut.';
    memoriserReglages();
  }

  /**
   * L'élément focalisé fait-il déjà quelque chose de cette touche ?
   * Un bouton ou un lien réagit à Entrée et Espace, une zone de saisie à
   * Entrée : on ne leur vole pas la touche. Un curseur ou une case à cocher
   * ignore Entrée, le raccourci peut donc s'appliquer — sans quoi régler un
   * curseur suffirait à désactiver le lancement au clavier.
   */
  function accapareLaTouche(cible, touche) {
    if (!(cible instanceof HTMLElement)) return false;
    if (cible.isContentEditable) return true;

    const balise = cible.tagName;
    if (balise === 'BUTTON' || balise === 'A' || balise === 'SELECT' || balise === 'TEXTAREA') return true;

    if (balise === 'INPUT') {
      const type = (cible.getAttribute('type') ?? 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') return touche === ' ';
      if (type === 'range') return false;
      return true; // champs de saisie textuels
    }
    return false;
  }

  /**
   * Active ou désactive une dimension, en respectant les exclusions :
   * le motif porte déjà forme et couleur, il ne peut pas coexister avec elles
   * (même règle que dans quad-box).
   */
  function basculerDimension(cle) {
    if (reglages.dimensions.includes(cle)) {
      reglages.dimensions = reglages.dimensions.filter((d) => d !== cle);
      return;
    }
    const exclues = EXCLUSIONS[cle] ?? [];
    reglages.dimensions = [...reglages.dimensions.filter((d) => !exclues.includes(d)), cle];
  }

  function surTouche(evenement) {
    // Capture d'une nouvelle touche : prioritaire sur tout le reste.
    if (captureTouche) {
      evenement.preventDefault();
      if (evenement.key === 'Escape') {
        captureTouche = null;
        messageTouche = '';
        return;
      }
      affecterTouche(captureTouche, evenement.key);
      return;
    }

    if (ecran === 'jeu') {
      if (evenement.key === 'Escape') {
        abandonner();
        return;
      }
      const frappe = evenement.key.toLowerCase();
      const cle = Object.keys(reglages.touches).find((d) => reglages.touches[d] === frappe);
      if (cle) {
        evenement.preventDefault();
        signaler(cle);
      }
      return;
    }

    // Hors jeu : Entrée ou Espace lancent la session, pour rester au clavier.
    if (evenement.key !== 'Enter' && evenement.key !== ' ') return;
    if (accapareLaTouche(evenement.target, evenement.key)) return;
    evenement.preventDefault();
    void commencer();
  }

  onDestroy(nettoyerMinuteurs);

  /*
     Les couleurs des retours sont rangées avec les stimuli, dans
     `moteur/constantes.js` : ce sont les couleurs de l'épreuve, et c'est le
     seul fichier de l'exercice où une couleur s'écrit.
  */
  const COULEURS_RETOUR = RETOURS;

  /** Style en ligne d'un bouton de réponse selon son état. */
  function styleRetour(cle) {
    const etat = retours[cle];
    const palette = COULEURS_RETOUR[etat];
    if (!palette) return '';
    const [fond, texte] = palette[sombre ? 'sombre' : 'clair'];
    return `background-color:${fond};color:${texte};`;
  }

  /** Libellé annoncé aux lecteurs d'écran quand le retour change. */
  const LIBELLES_RETOUR = {
    reussite: 'correct',
    echec: 'incorrect',
    oubli: 'correspondance manquée',
  };

  const annonceRetour = $derived(
    Object.entries(retours)
      .filter(([, etat]) => etat !== 'neutre')
      .map(([cle, etat]) => `${DIMENSIONS.find((d) => d.cle === cle)?.libelle} : ${LIBELLES_RETOUR[etat]}`)
      .join(', '),
  );

  const dimensionsActives = $derived(DIMENSIONS.filter((d) => reglages.dimensions.includes(d.cle)));
  const progression = $derived(
    partie && index >= 0 ? Math.min(100, Math.round((index / partie.epreuves.length) * 100)) : 0,
  );
  const titreMode = $derived(nomMode(titrePartie(reglages.dimensions)));
</script>

<svelte:window on:keydown={surTouche} />

{#snippet consigne()}
  <!--
    LE TEXTE DU CONSTAT P2, REPRIS MOT POUR MOT, À UN CHIFFRE PRÈS.

    L'audit écrit « à la même place que deux tours plus tôt » et « les deux
    premiers tours ». Les deux sont vrais à n = 2, qui est le réglage par
    défaut et que la décision 1 laisse intact — mais n se règle de 1 à 5, et
    la partie découverte tourne justement à n = 1. Figer « deux » rendrait la
    consigne FAUSSE dans tous les autres cas, et fausse d'autant plus là où
    elle sert le plus : au premier contact. Seul ce chiffre suit donc le
    réglage ; le reste de la phrase est celui de l'audit.
  -->
  <p>
    À chaque tour, un carré apparaît dans la grille, avec une couleur et une
    forme, et une lettre est prononcée. Touchez <strong>Position</strong> si le
    <!--
      L'ÉLISION FAIT PARTIE DU CHIFFRE. Écrire « qu' » avant la variable
      donnait « à la même place qu'2 tours plus tôt » : la sonde l'a lu à
      l'écran. « que » et « qu'au » ne se choisissent pas séparément du reste
      de la phrase, ils en font partie.
    -->
    carré est à la même place {reglages.n === 1
      ? "qu'au tour précédent"
      : `que ${reglages.n} tours plus tôt`}, <strong>Couleur</strong> si la couleur
    est la même, et ainsi de suite. Ne touchez rien si rien ne se répète.
  </p>
  <p class="mt-2">
    {reglages.n === 1 ? 'Le premier tour sert' : `Les ${reglages.n} premiers tours servent`}
    à mémoriser : il n'y a encore rien à comparer.
  </p>
{/snippet}

{#if ecran === 'accueil'}
  <div class="space-y-6">
    <!--
      Ouvert tant qu'aucune partie n'a été jouée, replié ensuite. Un encart
      replié que personne n'ouvre ne vaut pas mieux que pas d'encart ; ouvert à
      chaque visite, il devient l'obstacle que l'habitué referme vingt fois.
      « historique » est déjà lu pour l'écran : rien n'est écrit pour le savoir.
    -->
    <CommentCaMarche ouvert={historique.length === 0}>{@render consigne()}</CommentCaMarche>
    <Glossaire ou="memoire" />
    <section class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <!--
        LE RÉSUMÉ D'ABORD, LE DÉTAIL REPLIÉ (P4, adapté à la décision 1).

        L'écran s'ouvrait sur quatre dimensions, cinq curseurs, un tableau de
        touches et deux seuils de progression — avant la moindre phrase sur la
        tâche. Les valeurs par défaut ne changent pas, la décision 1 l'interdit
        et elles sont bonnes : ce qui change, c'est qu'on n'a plus à les lire
        pour commencer.

        Le résumé les dit en une ligne, dans les mots du glossaire — « 2 tours
        en arrière » et non « n = 2 ».
      -->
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Réglages de la session</h2>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {reglages.dimensions.length} dimension{reglages.dimensions.length > 1 ? 's' : ''} ·
        <Terme
          technique="n"
          simple="{reglages.n} tour{reglages.n > 1 ? 's' : ''} en arrière"
          forme="n = {reglages.n}"
        /> ·
        grille {reglages.grille3D ? '3D' : '2D'} ·
        {secondes(reglages.dureeEpreuve / 1000)} par épreuve ·
        {minutes((reglages.epreuves * reglages.dureeEpreuve) / 1000)}
      </p>

      <details data-pli-reglages class="mt-4">
        <summary class="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
          Réglages
        </summary>
      <div class="mt-3 grid gap-5 sm:grid-cols-2">
        <div>
          <label for="niveau-n" class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            <strong>{reglages.n} tour{reglages.n > 1 ? 's' : ''} en arrière</strong>
            <span class="font-normal text-slate-400">(n = {reglages.n})</span>
          </label>
          <input id="niveau-n" type="range" min="1" max="9" bind:value={reglages.n} class="w-full accent-indigo-600" />
          <p class="mt-1 text-xs text-slate-400">
            Il faut comparer chaque stimulus à celui de {reglages.n} épreuve{reglages.n > 1 ? 's' : ''} plus tôt.
          </p>
        </div>

        <div>
          <label for="nb-epreuves" class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Épreuves : <strong>{reglages.epreuves}</strong>
          </label>
          <input id="nb-epreuves" type="range" min="10" max="60" step="2" bind:value={reglages.epreuves} class="w-full accent-indigo-600" />
          <p class="mt-1 text-xs text-slate-400">
            Durée estimée : {minutes((reglages.epreuves * reglages.dureeEpreuve) / 1000)}
          </p>
        </div>

        <div>
          <label for="duree" class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            <!--
              « 2,5 s » ET NON « 2.5 s » : le point décimal venait de
              « toFixed », que le format proscrit. « Intl » met la virgule ET
              l'espace insécable devant l'unité, ce qu'une concaténation à la
              main n'aurait pas fait.
            -->
            Rythme : <strong>{secondes(reglages.dureeEpreuve / 1000)}</strong> par épreuve
          </label>
          <input id="duree" type="range" min="1500" max="5000" step="250" bind:value={reglages.dureeEpreuve} class="w-full accent-indigo-600" />
        </div>

        <div>
          <label for="taux-corr" class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Correspondances visées : <strong>{reglages.tauxCorrespondance} %</strong>
          </label>
          <input id="taux-corr" type="range" min="10" max="50" step="5" bind:value={reglages.tauxCorrespondance} class="w-full accent-indigo-600" />
        </div>

        <div>
          <label for="interf" class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            <Terme technique="interférence" simple="Répétitions presque justes" /> :
            <strong>{reglages.interference} %</strong>
          </label>
          <input id="interf" type="range" min="0" max="60" step="5" bind:value={reglages.interference} class="w-full accent-indigo-600" />
          <p class="mt-1 text-xs text-slate-400">
            Fréquence des leurres : un stimulus proche d'une correspondance, mais décalé d'un rang.
          </p>
        </div>

        <div class="flex flex-col justify-end gap-2">
          <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              bind:checked={reglages.grille3D}
              aria-describedby="avertissement-rotation"
              class="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Grille 3D en rotation (27 positions)
          </label>
          <!--
            T25-14 du 43 : la rotation est PRÉVENUE, pas seulement désactivable.

            Elle tourne lentement pendant toute la partie, et c'est un
            mouvement d'écran entier : qui y est sensible doit le savoir avant
            de commencer, et non le découvrir au premier tour. La phrase dit
            aussi ce que le système fait tout seul, parce qu'une personne qui a
            posé « mouvement réduit » n'a pas à se demander si le site l'écoute.
          -->
          <p id="avertissement-rotation" class="-mt-1 text-xs text-slate-500 dark:text-slate-400">
            La grille tourne lentement pendant la partie. Si votre appareil est
            réglé sur « mouvement réduit », elle reste immobile.
          </p>
          <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" bind:checked={reglages.retourImmediat} class="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            Retour immédiat sur chaque réponse
          </label>
        </div>
      </div>

      <fieldset class="mt-5">
        <legend class="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          Dimensions suivies — mode <strong>{titreMode}</strong>
        </legend>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {#each DIMENSIONS as dimension (dimension.cle)}
            {@const actif = reglages.dimensions.includes(dimension.cle)}
            {@const enCapture = captureTouche === dimension.cle}
            <!--
              Deux commandes distinctes : activer la dimension, et changer sa
              touche. Elles ne peuvent pas être imbriquées dans un même bouton.
            -->
            <div
              class="rounded-xl border p-3 transition {actif
                ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/60'
                : 'border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-900'}"
            >
              <button
                type="button"
                onclick={() => basculerDimension(dimension.cle)}
                aria-pressed={actif}
                class="w-full text-left"
              >
                <span class="block text-sm font-medium text-slate-900 dark:text-white">
                  {actif ? '☑' : '☐'} {dimension.libelle}
                </span>
                <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {dimension.description}
                </span>
              </button>

              <button
                type="button"
                onclick={() => demarrerCapture(dimension.cle)}
                aria-label="Changer la touche de « {dimension.libelle} » (actuellement {libelleTouche(reglages.touches[dimension.cle])})"
                class="mt-2 w-full rounded-lg border px-2 py-1.5 text-xs transition {enCapture
                  ? 'animate-pulse border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'}"
              >
                {#if enCapture}
                  Appuyez sur une touche…
                {:else}
                  Touche : <kbd class="font-semibold">{libelleTouche(reglages.touches[dimension.cle])}</kbd>
                {/if}
              </button>
            </div>
          {/each}
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onclick={reinitialiserTouches}
            class="text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Rétablir les touches par défaut
          </button>
          {#if messageTouche}
            <span class="text-xs text-indigo-600 dark:text-indigo-400">{messageTouche}</span>
          {/if}
        </div>

        {#if reglages.dimensions.length === 0}
          <p class="mt-2 text-sm text-red-600 dark:text-red-400">Activez au moins une dimension.</p>
        {/if}

        {#if reglages.dimensions.includes('motif')}
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <label for="source-motif" class="text-sm text-slate-600 dark:text-slate-300">Source des motifs :</label>
            <select
              id="source-motif"
              bind:value={reglages.sourceMotif}
              class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {#each SOURCES_MOTIF as source (source.cle)}
                <option value={source.cle}>{source.libelle}</option>
              {/each}
            </select>
            <span class="text-xs text-slate-400">Le motif remplace la couleur et la forme.</span>
          </div>
        {/if}
      </fieldset>

      <fieldset class="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <legend class="px-1 text-sm font-medium text-slate-600 dark:text-slate-300">
          Progression automatique du niveau
        </legend>

        <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" bind:checked={reglages.progression.active} class="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          Ajuster n automatiquement d'après les parties récentes
        </label>

        {#if reglages.progression.active}
          <div class="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label for="seuil-montee" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Monter après <strong>{reglages.progression.partiesMontee}</strong>
                partie{reglages.progression.partiesMontee > 1 ? 's' : ''} à
                <strong>{reglages.progression.seuilMontee} %</strong> ou plus
              </label>
              <input id="seuil-montee" type="range" min="50" max="100" step="5" bind:value={reglages.progression.seuilMontee} class="w-full accent-emerald-600" />
              <input aria-label="Nombre de parties requises pour monter" type="range" min="1" max="5" bind:value={reglages.progression.partiesMontee} class="mt-1 w-full accent-emerald-600" />
            </div>
            <div>
              <label for="seuil-descente" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Descendre après <strong>{reglages.progression.partiesDescente}</strong>
                partie{reglages.progression.partiesDescente > 1 ? 's' : ''} sous
                <strong>{reglages.progression.seuilDescente} %</strong>
              </label>
              <input id="seuil-descente" type="range" min="10" max="80" step="5" bind:value={reglages.progression.seuilDescente} class="w-full accent-amber-600" />
              <input aria-label="Nombre de parties requises pour descendre" type="range" min="1" max="5" bind:value={reglages.progression.partiesDescente} class="mt-1 w-full accent-amber-600" />
            </div>
          </div>
          <p class="mt-2 text-xs text-slate-400">
            Seules les parties des 48 dernières heures, dans le même mode et au même niveau,
            sont comparées ; un changement de niveau remet le compteur à zéro.
          </p>
        {/if}
      </fieldset>

      </details>

      <!--
        « ESSAYER D'ABORD » D'ABORD, tant qu'aucune partie n'a été jouée.

        L'ordre des deux boutons suit la demande : la découverte est proposée
        en premier tant que l'historique est vide, et passe derrière ensuite.
        Elle ne disparaît jamais — on peut vouloir y revenir.

        LA DURÉE EST CALCULÉE, PAS RECOPIÉE. L'audit écrit « Essayer d'abord
        (1 minute) ». Douze tours à trois secondes font trente-six secondes :
        annoncer une minute surestimerait de près des deux tiers, et c'est le
        genre de chiffre qu'on ne corrige plus. Il se déduit donc de
        « DECOUVERTE », et suivra si ses valeurs changent.
      -->
      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap {historique.length === 0 ? 'sm:flex-row-reverse sm:justify-end' : ''}">
        <button
          type="button"
          onclick={commencer}
          disabled={reglages.dimensions.length === 0}
          class="w-full rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
        >
          Commencer
        </button>
        <button
          type="button"
          onclick={commencerLaDecouverte}
          class="w-full rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
        >
          Essayer d'abord ({dureeDecouverte})
        </button>
      </div>

      <p class="mt-2 text-xs text-slate-400">
        Raccourci : <kbd class="rounded border border-slate-300 px-1 dark:border-slate-600">Entrée</kbd>
        lance la session, <kbd class="rounded border border-slate-300 px-1 dark:border-slate-600">Échap</kbd> l'interrompt.
      </p>
    </section>

    {#if erreurHistorique}
      <p class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
        Historique indisponible : {erreurHistorique}
      </p>
    {/if}

    {#if historique.length}
      <section>
        <h2 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Dernières sessions</h2>
        <div class="space-y-2">
          {#each historique as session (session.id)}
            <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900">
              <span class="font-medium text-slate-800 dark:text-slate-100">
                {session.n} tour{session.n > 1 ? 's' : ''} en arrière (n = {session.n})
                <span class="ml-1 font-normal text-slate-400">{nomMode(session.titre)}</span>
              </span>
              <span class="text-xs text-slate-400">
                {new Date(session.le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              <span
                class="font-semibold {session.taux * 100 >= reglages.progression.seuilMontee
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : session.taux * 100 >= reglages.progression.seuilDescente
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'}"
              >
                {Math.round(session.taux * 100)} %
              </span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>
{:else if ecran === 'jeu'}
  <div bind:this={zoneDeJeu} data-zone-de-jeu class="space-y-4">
    <!--
      LA RANGÉE PASSE À LA LIGNE, ET CE N'EST PAS UNE PRÉCAUTION.

      Elle porte deux boutons, une jauge, un compteur et jusqu'à deux
      pastilles. Seule la jauge est réductible : le minimum des autres atteint
      442 px, mesuré à 390. La page passait donc à 442 de large pendant la
      seconde de battement — celle où « préparez-vous… » s'affiche —, et
      emportait la barre de navigation du bas hors de l'écran. Transitoire,
      donc jamais pris par une capture, et antérieur à ce lot.

      « flex-wrap » laisse les pastilles descendre d'une ligne au lieu
      d'élargir la page ; « min-w-0 » sur la jauge l'autorise à céder la place
      avant que quoi que ce soit ne déborde.
    -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        onclick={abandonner}
        class="shrink-0 text-sm text-slate-500 hover:underline dark:text-slate-400"
      >
        ← Arrêter
      </button>
      <!--
        LE LIBELLÉ SE RACCOURCIT, LE NOM ACCESSIBLE NE BOUGE PAS.

        Écrit en toutes lettres et en « shrink-0 », ce bouton a fait déborder
        la barre : avec « ← Arrêter » et « ↻ Recommencer », trois boutons
        irréductibles dépassent 390 px. La page passait à 509 px de large et
        emportait la barre de navigation du bas hors de l'écran — mesuré, pas
        supposé, et c'est une régression que j'avais introduite.

        Le voisin ↻ montrait déjà l'idiome : le texte disparaît sous « sm ».
        L'« aria-label » garde le nom entier, pour que le lecteur d'écran et
        l'essai entendent la même chose aux deux largeurs.
      -->
      <button
        type="button"
        onclick={ouvrirLaConsigne}
        aria-label="Revoir la consigne"
        class="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span class="sm:hidden">Consigne</span>
        <span class="hidden sm:inline">Revoir la consigne</span>
      </button>
      <!--
        LE ↻ EST NOMMÉ, ASSEZ GRAND, ET IL DEMANDE CONFIRMATION (P13).

        Trois défauts dans un seul bouton. Sous « sm », il n'affichait que le
        signe : un lecteur d'écran annonçait « ↻ », et le « title » n'est pas
        lu au doigt. Il mesurait moins de 44 px, le plancher du 42 pour une
        cible tactile — et il est COLLÉ à la jauge, donc le rater coûte la
        partie en cours. Enfin il abandonnait sans rien demander, alors
        qu'« Arrêter », juste à côté, est moins destructeur.
      -->
      <button
        onclick={recommencerApresConfirmation}
        aria-label="Recommencer la partie"
        title="Abandonner et relancer une partie avec les mêmes réglages"
        class="shrink-0 min-h-11 min-w-11 rounded-lg border border-slate-300 px-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span aria-hidden="true">↻</span>
        <span class="hidden sm:inline">Recommencer</span>
      </button>
      <!--
        La jauge garde une largeur minimale : réductible à zéro, elle
        disparaissait dès que la rangée se serrait, et la progression avec elle.
      -->
      <div class="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div class="jauge-remplissage jauge-seance h-full rounded-full bg-indigo-500" style="transform: scaleX({progression / 100})"></div>
      </div>
      <span class="text-sm font-medium tabular-nums text-slate-500 dark:text-slate-400">
        {Math.max(0, index + 1)}/{partie?.epreuves.length ?? 0}
      </span>
      {#if partie && index < 0}
        <!-- Seconde de battement avant la première épreuve : sans indication,
             ce temps mort passe pour un blocage. -->
        <span class="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          préparez-vous…
        </span>
      {:else if partie && index < partie.meta.n}
        <!--
          Les n premières épreuves servent d'amorçage : il n'y a rien à quoi
          les comparer. Comme dans quad-box, aucune réponse n'y est comptée —
          autant le dire, sinon l'absence de verdict passe pour une panne.
        -->
        <span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <Terme technique="amorçage" />
        </span>
      {/if}
      <span class="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
        {partie?.meta.n} tour{(partie?.meta.n ?? 1) > 1 ? 's' : ''} en arrière (n = {partie?.meta.n})
      </span>
    </div>

    <!--
      Les caractéristiques d'affichage viennent de la PARTIE en cours, pas des
      réglages : ceux-ci peuvent changer pendant qu'une partie se joue, et le
      vivier de motifs a été tiré au lancement. Dessiner des graines d'art
      génératif avec le moteur Voronoï ne produirait rien.
    -->
    <Grille
      epreuve={index >= 0 ? partie?.epreuves[index] : null}
      {visible}
      grille3D={partie?.meta.grille3D ?? reglages.grille3D}
      {sombre}
      dimensions={partie?.meta.dimensions ?? reglages.dimensions}
      sourceMotif={partie?.meta.sourceMotif ?? reglages.sourceMotif}
    />

    <div class="grid gap-2" style="grid-template-columns: repeat({dimensionsActives.length}, minmax(0, 1fr))">
      {#each dimensionsActives as dimension (dimension.cle)}
        {@const etat = retours[dimension.cle] ?? 'neutre'}
        <button
          type="button"
          onclick={() => signaler(dimension.cle)}
          style={styleRetour(dimension.cle)}
          class="rounded-xl px-2 py-4 text-sm font-medium transition duration-150 {etat !== 'neutre'
            ? ''
            : signalees[dimension.cle]
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}"
        >
          {dimension.libelle}
          <!--
            LE SIGNE ET LA LETTRE DE TOUCHE PARTAGEAIENT UN SEUL EMPLACEMENT,
            à « opacity-60 » tous les deux. Deux ennuis dans un :

            — le ✓ ✗ ⌛ est le VERDICT, et un verdict à demi effacé ne vaut pas
              mieux qu'une couleur seule, qui est le reproche de P14 ;
            — la lettre de touche n'a rien à faire sur un écran tactile, qui
              n'a pas de clavier (P13), mais la masquer aurait masqué le signe
              avec elle, puisque c'était le même élément.

            Ils sont donc séparés : le signe à pleine opacité, la lettre
            discrète et cachée au doigt.
          -->
          {#if etat !== 'neutre'}
            <span class="mt-1 block text-xs font-semibold" aria-hidden="true">
              {etat === 'reussite' ? '✓' : etat === 'echec' ? '✗' : '⌛'}
            </span>
          {:else}
            <!--
              « pointer-fine » est une variante de Tailwind 4 : la lettre de
              touche n'apparaît que là où un pointeur précis existe, donc là où
              un clavier est plausible. Au doigt elle disparaît — c'est P13, et
              c'est aussi ce qui rendait la consigne fausse sur téléphone.
            -->
            <kbd class="mt-1 hidden text-xs font-normal opacity-60 pointer-fine:block">
              {libelleTouche(reglages.touches[dimension.cle])}
            </kbd>
          {/if}
        </button>
      {/each}
    </div>
    {#if sonEnPanne}
      <!--
        LE BANDEAU DU CONSTAT P12. Il paraît pendant la partie et non à la
        fin : à la fin, il ne reste qu'un score inexplicable.
      -->
      <p
        role="status"
        class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
      >
        Le son ne joue pas sur cet appareil (mode silencieux ?). La dimension Son a
        été retirée de cette partie.
      </p>
    {/if}

    <p class="sr-only" aria-live="polite">{annonceRetour}</p>

    {#if astuce}
      <p
        role="status"
        class="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
      >{astuce}</p>
    {/if}


    {#if reglages.retourImmediat}
      <!--
        LA LÉGENDE SUIT LE MODE SOMBRE, CE QU'ELLE NE FAISAIT PAS.

        Les trois pastilles lisaient « RETOURS.<etat>.clair[0] » sans
        condition, alors que les boutons qu'elles expliquent passent par
        « sombre ? 'sombre' : 'clair' ». En mode sombre, la légende montrait
        donc les couleurs du mode clair et ne correspondait plus à ce qu'elle
        légendait. Le défaut est antérieur à ce lot, et l'audit ne le voit pas.

        Chaque pastille porte aussi son SIGNE : la légende d'un code couleur
        qui ne montre que des couleurs ne sert à rien à qui ne les distingue
        pas.
      -->
      <p class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-slate-400">
        {#each [['reussite', '✓', 'correct'], ['echec', '✗', 'incorrect'], ['oubli', '⌛', 'correspondance manquée']] as [etat, signe, libelle] (etat)}
          <span>
            <span
              class="inline-block h-2.5 w-2.5 rounded-sm align-middle"
              style="background:{RETOURS[etat][sombre ? 'sombre' : 'clair'][0]}"
            ></span>
            <span aria-hidden="true">{signe}</span>
            {libelle}
          </span>
        {/each}
      </p>
    {/if}

    <p class="text-center text-xs text-slate-400">
      Signalez une correspondance avec l'épreuve {partie?.meta.n} rangs plus tôt.
      « ↻ » recommence une nouvelle partie avec les mêmes réglages, Échap arrête.
    </p>
  </div>
{:else if ecran === 'bilan'}
  <div class="py-6 text-center">
    <!--
      TROIS FINS, ET NON DEUX. Une découverte n'est pas une session
      interrompue : elle est allée au bout, elle ne compte simplement pas.
      Les confondre sous « Session interrompue » dirait à quelqu'un qui vient
      de tout faire correctement qu'il a abandonné.
    -->
    {#if bilan.cause === 'decouverte'}
      <h2 class="text-xl font-bold text-slate-900 dark:text-white">Découverte terminée</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
        Vous avez repéré {bilan.reperees} répétition{bilan.reperees > 1 ? 's' : ''} sur
        {bilan.aReperer}. Rien n'a été enregistré : ni résultat, ni niveau, ni points.
        Quand vous voudrez que cela compte, touchez « Commencer ».
      </p>
    {:else if bilan.cause !== 'terminee'}
      <h2 class="text-xl font-bold text-slate-900 dark:text-white">Session interrompue</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Une session abandonnée n'est pas enregistrée.
      </p>
    {:else}
      <!--
        L'EMOJI SEUL EST REMPLACÉ PAR UNE PHRASE (constat P8).

        La cible, le pouce et le bras musclé étaient le seul commentaire du
        résultat : trois images
        qu'il fallait deviner, et dont la troisième — le bras musclé pour une
        partie manquée — ressemble à un encouragement de consolation. La
        phrase dit la même chose sans rien laisser à interpréter, et sans
        reproche : l'audit relève justement l'absence de compteur
        culpabilisant comme une chose à garder.
      -->
      <h2 class="text-2xl font-bold text-slate-900 dark:text-white">
        {pourcent(bilan.taux)} — {bilan.n} tour{bilan.n > 1 ? 's' : ''} en arrière (n = {bilan.n})
      </h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
        Vous avez repéré <strong>{bilan.reperees}</strong>
        répétition{bilan.reperees > 1 ? 's' : ''} sur <strong>{bilan.aReperer}</strong>,
        {#if bilan.erreurs > 0}
          et touché <strong>{bilan.erreurs}</strong> fois quand rien ne se répétait.
        {:else}
          sans toucher une seule fois quand rien ne se répétait.
        {/if}
        Le pourcentage compte vos bonnes réponses parmi toutes celles qui comptent :
        touchez seulement quand vous êtes sûr.
      </p>
      <p class="mt-1 text-xs text-slate-400">+{compteAvant} XP</p>

      <div class="mx-auto mt-6 max-w-md space-y-2 text-left">
        {#each Object.entries(bilan.parDimension) as [cle, detail] (cle)}
          {@const libelle = DIMENSIONS.find((d) => d.cle === cle)?.libelle ?? cle}
          <div class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900">
            <div class="flex items-center justify-between">
              <span class="font-medium text-slate-800 dark:text-slate-100">{libelle}</span>
              <span class="font-semibold text-slate-500 dark:text-slate-400">{pourcent(detail.taux)}</span>
            </div>
            <p class="mt-0.5 text-xs text-slate-400">
              {detail.vraisPositifs} repérée{detail.vraisPositifs > 1 ? 's' : ''} ·
              {detail.oublis} oubli{detail.oublis > 1 ? 's' : ''} ·
              {detail.fauxPositifs} fausse{detail.fauxPositifs > 1 ? 's' : ''}
              alerte{detail.fauxPositifs > 1 ? 's' : ''}
            </p>
          </div>
        {/each}
      </div>

      <!--
        LA TROISIÈME LIGNE DIT LA SUITE, et la dit en toutes lettres.

        « ↑ Prochaine session en n = 3 » demandait de savoir ce qu'est n, et de
        deviner ce que vaut la flèche. Surtout, le cas « niveau inchangé » ne
        disait pas CE QU'IL FAUDRAIT pour monter : on restait au même niveau
        sans savoir à quoi il manquait quelque chose.
      -->
      {#if bilan.decision !== 'stable'}
        <p class="mt-5 text-sm font-medium {bilan.decision === 'montee' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}">
          <span aria-hidden="true">{bilan.decision === 'montee' ? '↑' : '↓'}</span>
          Vous passez à {bilan.suivant} tour{bilan.suivant > 1 ? 's' : ''} en arrière
          (n = {bilan.suivant}).
        </p>
      {:else if reglages.progression.active}
        <p class="mt-5 text-sm text-slate-600 dark:text-slate-300">
          Pour passer à {bilan.n + 1} tour{bilan.n + 1 > 1 ? 's' : ''} en arrière :
          une partie à {pourcent(reglages.progression.seuilMontee / 100)} ou plus.
        </p>
      {/if}
    {/if}

    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <!--
        « REJOUER », PARCE QUE C'EST CE QUE FAIT CE BOUTON : il relance une
        partie aux mêmes réglages, sans repasser par l'écran de réglages. Son
        voisin, lui, y retourne. Les deux s'appelaient « Nouvelle session » et
        « Réglages », ce qui laissait croire que le premier ouvrait un choix.
      -->
      <button onclick={commencer} class="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white transition hover:bg-indigo-700">
        Rejouer
      </button>
      <button onclick={retourAccueil} class="rounded-lg border border-slate-300 px-5 py-2.5 font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
        Retour aux réglages
      </button>
    </div>
  </div>
{/if}

<!--
  LA BOÎTE DE LA CONSIGNE VIT AU NIVEAU DU COMPOSANT, hors de tout écran.

  Elle était d'abord rendue dans l'écran de jeu, à côté de la grille. Dans
  Mémoire de travail, le clic sur « Reprendre » n'arrivait jamais : la grille
  en rotation 3D crée son propre contexte d'empilement, et la boîte se
  retrouvait derrière elle. Playwright trouvait le bouton, le voyait visible,
  et attendait indéfiniment qu'il reçoive le pointeur — un écran sur lequel on
  ne peut plus rien toucher, et aucune erreur pour le dire.

  Une boîte modale n'appartient pas à un écran : elle appartient au composant.
  Rendue ici, elle est hors de portée de tout ce que les écrans empilent.
-->
<CommentCaMarche boiteSeule enBoite={consigneEnPause} fermer={reprendreApresLaConsigne}>
  {@render consigne()}
</CommentCaMarche>
