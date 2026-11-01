<script lang="ts">
  /**
   * L'écran de séance de PCCT.
   *
   * ## Ce que cet écran fait, et ce qu'il ne fait pas
   *
   * Il mène la CADENCE et rien d'autre : à chaque intervalle, il demande au
   * moteur l'essai suivant, l'annonce, et attend. Le moteur décide ce que
   * l'essai contient, ce que la réponse vaut, à quel essai une frappe
   * appartient (`grace.attribuer`), quelles réponses le pavé peut offrir et
   * dans quel ordre (`moteur/pave.ts`). Rien de tout cela n'est ici, et c'est
   * ce qui a permis de l'éprouver en millisecondes : `essais:pcct` joue une
   * séance de quinze minutes en quelques dizaines de millisecondes, et
   * `essais:pcct:navigateur` n'a plus à mesurer que ce qui est vraiment de
   * l'écran — les cibles tactiles, la région vocale, le mouvement, Échap.
   *
   * ## Quatre décisions d'usage
   *
   * **La découverte n'enregistre rien.** Une minute pour comprendre la tâche,
   * sur le dépôt muet : ni essai, ni séance, ni XP. Un premier essai qu'on
   * passe à comprendre les règles n'est pas une mesure, et le compter abîmerait
   * la seule courbe que la personne regardera.
   *
   * **Le retour passe par une région vocale, pas par la couleur.** « Juste » et
   * « faux » sont annoncés en toutes lettres dans un `aria-live`, en plus de la
   * couleur et du signe. Qui ne voit pas la couleur, ou ne la distingue pas, a
   * le même retour que les autres, au même moment.
   *
   * **Sans voix française locale, l'écran le dit et passe au visuel.** Il ne se
   * rabat pas en silence : la personne qui a choisi le son saurait seulement
   * que « ça ne parle pas ». La politique est dans `voix.ts`, et son motif
   * s'affiche.
   *
   * **Échap demande confirmation.** Arrêter une séance de quinze minutes d'un
   * appui qui pouvait viser autre chose, c'est la perdre. La touche passe donc
   * par `confirmer()`, comme « Arrêter ».
   */
  import { onDestroy, tick } from 'svelte';
  import { confirmer } from '../../../lib/boite';
  import { amenerLaZone } from '../../cog-training/zone-de-jeu';
  import {
    BORNES,
    DEFAUTS,
    reglagesParDefaut,
    type Reglages,
  } from '../moteur/reglages';
  import { OPERATIONS, type Aide, type Essai, type Operation } from '../moteur/types';
  import {
    exigencesDeLEssai,
    noterInhibition,
    operationDeLEssai,
    noterLEssai,
    noterSens,
    poserEssai,
    resumer,
    seanceNeuve,
    sensDeLEssai,
    signalDInhibition,
    type EtatSeance,
  } from '../moteur/seance';
  import { attribuer } from '../moteur/grace';
  import { SENS, operationsCommutables, type Sens, type Exigences } from '../moteur/modules';
  import {
    TOUCHES,
    consigneAPoser,
    consigneVisible,
    surFrappe,
    surLeTemps,
  } from '../moteur/prospective';
  import type { Consigne, ConsigneJugee } from '../moteur/types';
  import { paveDeLEssai, reponsesPossibles } from '../moteur/pave';
  import { DEPOT_MUET, DepotEnMemoire, type DepotPcct } from '../moteur/depot';
  import { direLeNombre, examinerLesVoix, type EtatDeLaVoix } from '../voix';
  import Pave from './Pave.svelte';

  type Etape = 'accueil' | 'seance' | 'bilan';

  /** La découverte, en secondes. Une minute : le temps de comprendre. */
  const DECOUVERTE = 60;

  const NOM_OPERATION: Record<Operation, string> = {
    somme: 'Somme',
    difference: 'Différence',
    produit: 'Produit',
    quotient: 'Quotient',
  };

  const SIGNE: Record<Operation, string> = {
    somme: '+',
    difference: '−',
    produit: '×',
    quotient: '÷',
  };

  let etape = $state<Etape>('accueil');
  let reglages = $state<Reglages>(reglagesParDefaut());
  let decouverte = $state(false);

  /* L'état du moteur n'est PAS réactif : il est muté en place par `poserEssai`
     et `noterLEssai`, et les runes ne suivraient pas ces mutations. L'écran
     recopie dans des `$state` les quelques valeurs qu'il affiche, au moment où
     elles changent. Le faire autrement — envelopper l'état dans `$state` —
     donnerait un affichage juste par accident, qui cesserait de l'être au
     premier champ que le moteur modifie sans réaffectation. */
  let etat: EtatSeance | null = null;
  let depot: DepotPcct = DEPOT_MUET;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let zone = $state<HTMLElement | null>(null);

  /** L'essai affiché, et son prédécesseur — le délai de grâce a besoin des deux. */
  let courant = $state<Essai | null>(null);
  let precedent: Essai | null = null;
  let apparuA = 0;
  let courantRepondu = false;
  let precedentRepondu = true;

  let secondesRestantes = $state(0);
  let notes = $state(0);
  let justes = $state(0);
  let intervalle = $state(DEFAUTS.intervalleDepart);
  let rangDeLEssai = $state(0);

  /** Ce que la région vocale annonce. Vidé puis réécrit : voir `annoncer`. */
  let annonce = $state('');
  let dernierVerdict = $state<'juste' | 'faux' | null>(null);
  let saisie = $state('');

  /* ── La mémoire prospective ──────────────────────────────────────────── */

  /**
   * Le délai avant de juger une consigne dont la fenêtre s'est fermée.
   *
   * `surLeTemps` distingue « manquée » — on y a pensé trop tard — d'« omise »,
   * où rien n'est venu. Cette distinction n'existe que s'il reste un instant
   * pour y penser trop tard : juger à la fermeture exacte rendrait « manquée »
   * inatteignable, et toute omission tardive passerait pour un oubli complet.
   * Deux secondes, et c'est un choix d'écran — le moteur n'en sait rien, on lui
   * passe simplement un instant retardé d'autant.
   */
  const TARD = 2000;

  let debutDeSeance = 0;
  const depuisLeDebut = () => performance.now() - debutDeSeance;
  /** Les frappes arrivées après la fermeture d'une fenêtre, par consigne. */
  let frappesTardives = new Map<string, { touche: string; instant: number }>();
  let consignesAffichees = $state<Consigne[]>([]);
  let annoncePm = $state('');

  /* ── L3 : l'état des quatre modules ────────────────────────────────────── */

  /** L'essai courant porte-t-il le signal d'inhibition ? */
  let signalInhibition = $state(false);
  /** « Retenir » a-t-il été pressé sur l'essai courant ? */
  let aRetenu = $state(false);
  /** Le sens donné à l'essai courant, s'il l'a été. */
  let sensDonne = $state<Sens | null>(null);
  /** Le sens attendu, calculé à la pose de l'essai. */
  let sensAttenduCourant: Sens | null = null;
  /** Ce que l'essai courant demande. */
  let exigencesCourantes: Exigences = { nombre: true, sens: false };
  /** Une TROISIÈME région vocale : voir sa glose dans le balisage. */
  let annonceModules = $state('');
  /** L'opération du bloc courant, quand le changement de règle est allumé. */
  let operationDuBloc = $state<Operation | null>(null);
  /** Vrai le temps d'annoncer qu'une nouvelle règle commence. */
  let regleQuiChange = $state(false);

  const modulesActifs = $derived(
    reglages.inhibitionActive || reglages.ndmActif || reglages.sdmActif,
  );

  /**
   * UNE COULEUR PAR RÈGLE, PRISE DANS LES JETONS.
   *
   * Jamais une teinte écrite à la main : `essais:pcct` mesure le contraste de
   * chacune sur le fond de la bannière, et une couleur hors jetons passerait
   * sous 3:1 sur l'un des quatorze thèmes sans que rien ne le dise. Et la
   * couleur n'est jamais le seul canal — le nom de l'opération est écrit à
   * côté, en toutes lettres.
   */
  const COULEUR_REGLE: Record<Operation, string> = {
    somme: 'var(--etat-succes)',
    difference: 'var(--etat-action)',
    produit: 'var(--etat-accent)',
    quotient: 'var(--etat-alerte)',
  };

  /** Le libellé d'un sens, le même à l'écran et à l'oreille. */
  const NOM_SENS: Record<Sens, string> = {
    'plus-petit': 'Plus petit',
    egal: 'Égal',
    'plus-grand': 'Plus grand',
  };

  /**
   * UNE TROISIÈME VOIX, et c'est la même raison qu'à la deuxième.
   *
   * L'arithmétique et la mémoire prospective ont chacune la leur parce que les
   * deux rendent un verdict en même temps, et qu'une seule région verrait le
   * second effacer le premier avant qu'il soit annoncé. Les modules en rendent
   * un troisième — retenu, raté, fausse alarme, sens juste ou faux —, au même
   * instant que les deux autres. Trois tâches, trois voix.
   */
  async function annoncerModules(texte: string) {
    annonceModules = '';
    await tick();
    annonceModules = texte;
  }
  let compteParVerdict = $state({ juste: 0, manquee: 0, fausse: 0, omise: 0 });

  let voix = $state<EtatDeLaVoix>({ voix: null, raison: '', enVisuel: true });
  let sonVoulu = $state(true);
  let bilan = $state<ReturnType<typeof resumer> | null>(null);
  /** La séance est-elle déjà close ? Une fin ne compte qu'une fois. */
  let close = false;

  /* ── Le pavé ─────────────────────────────────────────────────────────── */

  /*
     Les réponses possibles ne dépendent que de l'opération et de la plage :
     elles se calculent donc une fois par réglage, et non à chaque essai. Ce qui
     change à chaque essai, c'est l'ORDRE — et c'est `paveDeLEssai` qui le fait,
     en semant sur le rang.
  */
  const reponses = $derived(
    reponsesPossibles(reglages.operation, reglages.nombreMin, reglages.nombreMax),
  );
  const touches = $derived(paveDeLEssai(reponses, reglages.ordrePave, rangDeLEssai));

  /* ── Les annonces ────────────────────────────────────────────────────── */

  /**
   * Écrit dans la région vocale.
   *
   * Le texte est vidé avant d'être réécrit, et c'est nécessaire : deux essais
   * de suite jugés « Faux » produisent le même texte, et une région `aria-live`
   * ne réannonce pas un contenu identique. Sans ce vidage, le second « Faux »
   * serait silencieux — la personne qui dépend de l'annonce n'aurait de retour
   * qu'un essai sur deux.
   */
  async function annoncer(texte: string) {
    annonce = '';
    await tick();
    annonce = texte;
  }

  /* ── La cadence ──────────────────────────────────────────────────────── */

  function mouvementReduit(): boolean {
    try {
      const systeme =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return systeme || document.documentElement.getAttribute('data-animations') === 'reduites';
    } catch {
      return true;
    }
  }

  const hasard = () => Math.random();

  function poser() {
    if (!etat) return;
    /* L'essai qui s'achève sans réponse est manqué, et il faut le NOTER comme
       tel : sans cela, la cadence n'accélérerait jamais vers le bas, et la
       précision ne compterait que les essais répondus — c'est-à-dire qu'elle
       monterait en ne répondant plus. */
    if (courant && !courantRepondu && courant.attendu !== null) {
      void noterLEssai(etat, courant, { donne: null, reaction: null, aide: null }, depot);
      rafraichirLesComptes();
    }
    precedent = courant;
    precedentRepondu = courantRepondu;
    /*
       LES MODULES SE CLÔTURENT AVANT QUE LE SUIVANT PARAISSE, et c'est le seul
       moment qui convient. Le verdict d'inhibition se décide quand l'essai
       s'achève — y compris, et SURTOUT, quand rien n'est arrivé : ne rien
       faire est un verdict (`omis`), et le noter à la réponse ne le noterait
       jamais. C'est exactement le trou de la référence, où ne rien pouvoir
       faire ne compte nulle part.
    */
    cloreLesModules();

    const essai = poserEssai(etat, hasard);
    courant = essai;
    rangDeLEssai = essai.rang;
    apparuA = performance.now();
    courantRepondu = false;
    saisie = '';
    dernierVerdict = null;
    intervalle = etat.rythme.intervalle;

    /* L3 : ce que cet essai demande, et ce qu'il porte. */
    signalInhibition = signalDInhibition(etat, hasard, essai.attendu !== null);
    aRetenu = false;
    sensDonne = null;
    sensAttenduCourant = sensDeLEssai(etat, essai);
    exigencesCourantes = exigencesDeLEssai(etat, essai, signalInhibition);
    if (reglages.changementDeRegleActif) {
      const avant = operationDuBloc;
      operationDuBloc = operationDeLEssai(etat, essai.rang);
      regleQuiChange = avant !== null && avant !== operationDuBloc;
    }

    if (sonVoulu && voix.voix) direLeNombre(window.speechSynthesis, voix, essai.nombre);

    minuteur = setTimeout(poser, essai.intervalle);
  }

  /**
   * Clôt les modules de l'essai qui s'achève.
   *
   * Appelée quand le SUIVANT paraît, parce que c'est le seul instant où l'on
   * sait que plus rien n'arrivera. Elle ne fait rien avant le premier essai.
   */
  function cloreLesModules() {
    if (!etat || !courant) return;
    const donnees = { nombre: courantRepondu ? 0 : null, sens: sensDonne, retenir: aRetenu };

    /*
       UN SEUL MESSAGE, ET IL EST POSÉ À CHAQUE ESSAI — MÊME VIDE.

       La première version n'annonçait que les verdicts qui ont quelque chose à
       dire, et laissait la région intacte le reste du temps. Un essai réussi
       gardait donc à l'écran le reproche de l'essai d'avant, et c'est un
       mensonge mesurable : `essais:pcct:navigateur` lisait « il fallait aussi
       donner le sens » sur un essai où le sens avait été donné, juste.

       Les deux verdicts sont donc rassemblés en un texte, et la région est
       réécrite à chaque clôture : vide quand il n'y a rien à dire.
    */
    const dits: string[] = [];

    if (reglages.inhibitionActive) {
      const verdict = noterInhibition(etat, signalInhibition, donnees);
      if (verdict === 'retenu') dits.push('Retenu, c’était bien le signal.');
      else if (verdict === 'rate') dits.push('Il fallait retenir, pas répondre.');
      else if (verdict === 'omis') dits.push('Signal manqué : il fallait presser Retenir.');
      else if (verdict === 'fausse-alarme') dits.push('Fausse alarme : il n’y avait pas de signal.');
    }

    if (sensAttenduCourant !== null) {
      const juste = noterSens(etat, sensAttenduCourant, sensDonne);
      if (juste === false) {
        dits.push(
          sensDonne === null
            ? 'Il fallait aussi donner le sens.'
            : `Sens faux : c’était « ${NOM_SENS[sensAttenduCourant]} ».`,
        );
      }
    }

    void annoncerModules(dits.join(' '));
  }

  /**
   * « Retenir », au doigt comme au clavier.
   *
   * ÉCOUTÉE PARTOUT, et c'est le premier défaut de la référence : chez elle,
   * les touches ne sont lues que sur le champ de saisie, lequel est DÉSACTIVÉ
   * sur un essai d'inhibition. Personne ne peut donc signaler qu'il retient —
   * ni, du même coup, se tromper en le signalant à tort. Ici le geste existe
   * sur tous les essais, et presser « Retenir » sans signal est une fausse
   * alarme qui se compte.
   */
  function retenir() {
    if (etape !== 'seance' || !reglages.inhibitionActive) return;
    aRetenu = true;
  }

  /**
   * Le sens, au doigt comme au clavier.
   *
   * Acceptée AVANT comme APRÈS le nombre : c'est le deuxième défaut de la
   * référence, dont la validation automatique note l'essai dès que le nombre
   * est complet. Ici rien ne clôt l'essai sur le nombre seul — `cloreLesModules`
   * attend que le suivant paraisse —, de sorte que les deux ordres mènent au
   * même verdict.
   */
  function donnerLeSens(sens: Sens) {
    if (etape !== 'seance' || !exigencesCourantes.sens) return;
    sensDonne = sens;
  }

  function rafraichirLesComptes() {
    if (!etat) return;
    notes = etat.comptes.notes;
    justes = etat.comptes.justes;
  }

  /**
   * Une réponse, du pavé ou du clavier.
   *
   * L'attribution est demandée au moteur, et c'est tout l'intérêt : l'écran ne
   * sait pas à quel essai la frappe appartient, il le demande, puis note
   * l'essai qu'on lui nomme.
   */
  async function repondre(valeur: number) {
    if (!etat || etape !== 'seance') return;
    const vise = attribuer({
      depuisLApparition: performance.now() - apparuA,
      delaiDeGrace: reglages.delaiDeGrace,
      courantEnAttente: !courantRepondu,
      precedentSansReponse: !precedentRepondu,
    });
    if (vise === 'perdue') return;

    const cible = vise === 'precedent' ? precedent : courant;
    const aide: Aide | null = vise === 'precedent' ? 'delai-de-grace' : null;
    const reaction = vise === 'courant' ? Math.round(performance.now() - apparuA) : null;
    const joue = await noterLEssai(etat, cible, { donne: valeur, reaction, aide }, depot);

    if (vise === 'precedent') precedentRepondu = true;
    else courantRepondu = true;
    saisie = '';

    /* Un essai non notable — l'échauffement — ne se juge pas : il n'avait pas
       d'attendu, et annoncer « Faux » serait annoncer une faute impossible. */
    if (!joue) {
      await annoncer('Échauffement : rien à calculer encore.');
      return;
    }
    rafraichirLesComptes();
    intervalle = etat.rythme.intervalle;
    dernierVerdict = joue.juste ? 'juste' : 'faux';
    const rattrape = vise === 'precedent' ? ' (essai précédent, rattrapé)' : '';
    await annoncer(
      joue.juste
        ? `Juste${rattrape}.`
        : `Faux${rattrape} : ${joue.essai.attendu} était attendu.`,
    );
  }

  /** Annonce la mémoire prospective, dans SA région — voir `annoncer`. */
  async function annoncerPm(texte: string) {
    annoncePm = '';
    await tick();
    annoncePm = texte;
  }

  /**
   * Le battement de la mémoire prospective : poser, juger, afficher.
   *
   * Appelé par le compte à rebours plutôt que par la cadence des nombres : une
   * consigne vit en secondes, et l'attacher à l'intervalle la ferait battre
   * trois fois plus vite à cadence rapide — le temps d'une consigne ne dépend
   * pas de la vitesse du calcul.
   */
  function battreLaProspective() {
    if (!etat || !reglages.prospectiveActive) return;
    const maintenant = depuisLeDebut();
    const total = (decouverte ? DECOUVERTE : reglages.duree * 60) * 1000;

    /* Juger d'abord : une place libérée peut être reprise dans le même
       battement, et le refus de poser est local, jamais définitif. */
    for (const jugee of surLeTemps(etat.prospective, maintenant - TARD, frappesTardives)) {
      frappesTardives.delete(jugee.id);
      noterLaConsigne(jugee);
    }

    const posee = consigneAPoser(etat.prospective, maintenant, total, reglages, hasard);
    if (posee) {
      etat.prospective.enAttente = [...etat.prospective.enAttente, posee];
      void annoncerPm(
        `Consigne : appuyez sur ${posee.touche} dans ` +
          `${Math.round((posee.echeance - maintenant) / 1000)} secondes environ.`,
      );
    }

    consignesAffichees = etat.prospective.enAttente.filter((c) =>
      consigneVisible(c, maintenant, reglages),
    );
  }

  function noterLaConsigne(jugee: ConsigneJugee) {
    void depot.noterConsigne(jugee);
    compteParVerdict = {
      ...compteParVerdict,
      [jugee.verdict]: compteParVerdict[jugee.verdict] + 1,
    };
    const dit: Record<ConsigneJugee['verdict'], string> = {
      juste: `Consigne ${jugee.touche} : à l’heure.`,
      manquee: `Consigne ${jugee.touche} : juste touche, trop tard.`,
      fausse: `Consigne ${jugee.touche} : ${jugee.presse} au lieu de ${jugee.touche}.`,
      omise: `Consigne ${jugee.touche} : oubliée.`,
    };
    void annoncerPm(dit[jugee.verdict]);
  }

  /**
   * Une touche de consigne, du clavier ou de la rangée tactile.
   *
   * Hors fenêtre, la frappe n'est pas perdue : elle est portée au crédit de la
   * consigne dont la fenêtre vient de se fermer, et c'est ce qui permettra de
   * la juger « manquée » plutôt qu'« omise ». La PREMIÈRE frappe l'emporte —
   * y penser puis se corriger ne change pas le fait qu'on y a pensé tard.
   */
  function toucherLaConsigne(touche: string) {
    if (!etat || etape !== 'seance' || !reglages.prospectiveActive) return;
    const maintenant = depuisLeDebut();
    const jugee = surFrappe(etat.prospective, touche, maintenant);
    if (jugee) {
      noterLaConsigne(jugee);
      consignesAffichees = consignesAffichees.filter((c) => c.id !== jugee.id);
      return;
    }
    /* La consigne dont la fenêtre s'est fermée le plus récemment. */
    const fermees = etat.prospective.enAttente
      .filter((c) => maintenant > c.echeance + c.fenetre)
      .sort((a, b) => b.echeance - a.echeance);
    if (fermees.length && !frappesTardives.has(fermees[0].id)) {
      frappesTardives.set(fermees[0].id, { touche, instant: maintenant });
      void annoncerPm('Noté, mais la fenêtre était déjà fermée.');
    }
  }

  /* ── Le clavier ──────────────────────────────────────────────────────── */

  function auClavier(e: KeyboardEvent) {
    if (etape !== 'seance') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      void arreterApresConfirmation();
      return;
    }
    const majuscule = e.key.toUpperCase();
    if ((TOUCHES as readonly string[]).includes(majuscule)) {
      e.preventDefault();
      toucherLaConsigne(majuscule);
      return;
    }
    /*
       ESPACE RETIENT, LES FLÈCHES DONNENT LE SENS.

       Horizontalement, parce que la métaphore est celle d'une droite
       graduée : à gauche plus petit, à droite plus grand, en bas égal. Les
       flèches haut et bas serviraient mal — « plus grand » n'est pas « en
       haut » quand on compare deux nombres écrits côte à côte.

       `preventDefault` sur l'espace : sans lui la page défile, et la personne
       perd l'écran à chaque signal retenu.

       MAIS SEULEMENT QUAND LE MODULE EST ALLUMÉ. Confisquer l'espace et les
       flèches à toute séance priverait du défilement au clavier les neuf
       personnes sur dix qui ne jouent aucun module — un réglage éteint ne doit
       rien coûter. Le `preventDefault` est donc à l'intérieur du test, et non
       devant.
    */
    if (e.key === ' ' || e.key === 'Spacebar') {
      if (!reglages.inhibitionActive) return;
      e.preventDefault();
      retenir();
      return;
    }
    const SENS_DE_LA_FLECHE: Record<string, Sens> = {
      ArrowLeft: 'plus-petit',
      ArrowDown: 'egal',
      ArrowRight: 'plus-grand',
    };
    if (e.key in SENS_DE_LA_FLECHE) {
      if (!reglages.ndmActif && !reglages.sdmActif) return;
      e.preventDefault();
      donnerLeSens(SENS_DE_LA_FLECHE[e.key]);
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      saisie = (saisie + e.key).slice(0, 4);
      return;
    }
    if (e.key === '-' || e.key === 'Minus') {
      e.preventDefault();
      saisie = saisie.startsWith('-') ? saisie.slice(1) : `-${saisie}`;
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      saisie = saisie.slice(0, -1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const valeur = Number(saisie);
      if (saisie !== '' && saisie !== '-' && Number.isFinite(valeur)) void repondre(valeur);
    }
  }

  /* ── Commencer, arrêter ──────────────────────────────────────────────── */

  async function commencer(enDecouverte: boolean) {
    decouverte = enDecouverte;
    close = false;
    bilan = null;
    etat = seanceNeuve({ ...reglages });
    /* La découverte écrit dans le dépôt MUET : rien n'est enregistré, et ce
       n'est pas une option qu'on pourrait oublier de respecter plus loin — il
       n'y a pas de magasin au bout. */
    depot = enDecouverte ? DEPOT_MUET : new DepotEnMemoire();
    courant = null;
    precedent = null;
    courantRepondu = false;
    precedentRepondu = true;
    notes = 0;
    justes = 0;
    rangDeLEssai = 0;
    dernierVerdict = null;
    saisie = '';
    frappesTardives = new Map();
    consignesAffichees = [];
    annoncePm = '';
    compteParVerdict = { juste: 0, manquee: 0, fausse: 0, omise: 0 };
    secondesRestantes = enDecouverte ? DECOUVERTE : reglages.duree * 60;
    debutDeSeance = performance.now();
    etape = 'seance';

    await tick();
    await amenerLaZone(zone);
    await annoncer(
      enDecouverte
        ? 'Découverte : une minute, rien n’est enregistré.'
        : `Séance de ${reglages.duree} minutes. Le premier nombre ne se calcule pas.`,
    );
    compteARebours();
    poser();
  }

  function compteARebours() {
    const fin = performance.now() + secondesRestantes * 1000;
    const battre = () => {
      if (etape !== 'seance') return;
      secondesRestantes = Math.max(0, Math.ceil((fin - performance.now()) / 1000));
      battreLaProspective();
      if (secondesRestantes <= 0) {
        terminer('terme');
        return;
      }
      rebours = setTimeout(battre, 250);
    };
    battre();
  }
  let rebours: ReturnType<typeof setTimeout> | null = null;

  function arreterLesMinuteurs() {
    if (minuteur) clearTimeout(minuteur);
    if (rebours) clearTimeout(rebours);
    minuteur = null;
    rebours = null;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* Pas de synthèse : il n'y a rien à annuler. */
    }
  }

  /**
   * La fin de séance, qui ne compte QU'UNE FOIS.
   *
   * Deux chemins y mènent — le terme du compte à rebours et le bouton
   * « Arrêter » —, et ils peuvent se croiser : arrêter à la dernière seconde
   * appelait les deux. Sans le garde, la séance partait deux fois au dépôt,
   * donc l'XP et l'historique aussi.
   */
  function terminer(mode: 'terme' | 'arret') {
    if (close || !etat) return;
    close = true;
    arreterLesMinuteurs();
    const total = decouverte ? DECOUVERTE : reglages.duree * 60;
    const resume = resumer(etat, new Date().toISOString(), mode, total - secondesRestantes);
    bilan = resume;
    /* La découverte a le dépôt muet : l'appel est le même, et c'est le dépôt
       qui ne retient rien. Un `if` ici serait une seconde règle à tenir. */
    void depot.cloreSeance(resume);
    etape = 'bilan';
    void annoncer(
      decouverte
        ? 'Découverte terminée. Rien n’a été enregistré.'
        : `Séance terminée. ${resume.justes} justes sur ${resume.notes}.`,
    );
  }

  async function arreterApresConfirmation() {
    const oui = await confirmer({
      titre: 'Arrêter la séance ?',
      texte: decouverte
        ? 'La découverte s’arrête. Rien n’était enregistré.'
        : 'La séance s’arrête ici et sera enregistrée telle quelle, plus courte que prévu.',
      action: 'Arrêter',
      annuler: 'Continuer',
    });
    if (oui) terminer('arret');
  }

  /* ── La voix ─────────────────────────────────────────────────────────── */

  function examiner() {
    try {
      const synthese = window.speechSynthesis;
      if (!synthese) {
        voix = examinerLesVoix([]);
        return;
      }
      voix = examinerLesVoix(synthese.getVoices());
    } catch {
      voix = examinerLesVoix([]);
    }
  }

  $effect(() => {
    examiner();
    /* Les voix arrivent souvent après le premier appel : l'événement est le
       seul moyen fiable de les connaître, et un délai fixe ne serait qu'un
       pari. */
    try {
      window.speechSynthesis?.addEventListener('voiceschanged', examiner);
      return () => window.speechSynthesis?.removeEventListener('voiceschanged', examiner);
    } catch {
      return undefined;
    }
  });

  onDestroy(arreterLesMinuteurs);

  const precision = $derived(notes === 0 ? null : Math.round((justes / notes) * 100));
  const minutes = $derived(Math.floor(secondesRestantes / 60));
  const secondes = $derived(secondesRestantes % 60);
</script>

<svelte:window onkeydown={auClavier} />

{#if etape === 'accueil'}
  <section class="space-y-5">
    <div
      class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Réglages de la séance</h2>

      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">Opération</span>
          <select
            id="operation"
            bind:value={reglages.operation}
            class="cible-tactile mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2
                   text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {#each OPERATIONS as op (op)}
              <option value={op}>{NOM_OPERATION[op]} ({SIGNE[op]})</option>
            {/each}
          </select>
        </label>

        <label class="block text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">
            Durée : <span data-valeur="duree" class="tabular-nums">{reglages.duree}</span> min
          </span>
          <input
            id="duree"
            type="range"
            bind:value={reglages.duree}
            min={BORNES.duree.min}
            max={BORNES.duree.max}
            step={BORNES.duree.pas}
            class="mt-2 w-full"
          />
        </label>

        <label class="block text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">
            Profondeur n : <span data-valeur="n" class="tabular-nums">{reglages.n}</span>
          </span>
          <input
            id="n"
            type="range"
            bind:value={reglages.n}
            min={BORNES.n.min}
            max={BORNES.n.max}
            step={BORNES.n.pas}
            class="mt-2 w-full"
          />
        </label>

        <label class="block text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">
            Intervalle de départ :
            <span data-valeur="intervalleDepart" class="tabular-nums">
              {reglages.intervalleDepart}
            </span> ms
          </span>
          <input
            id="intervalle-depart"
            type="range"
            bind:value={reglages.intervalleDepart}
            min={BORNES.intervalleDepart.min}
            max={BORNES.intervalleDepart.max}
            step={BORNES.intervalleDepart.pas}
            class="mt-2 w-full"
          />
        </label>

        <label class="block text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">
            Délai de grâce :
            <span data-valeur="delaiDeGrace" class="tabular-nums">{reglages.delaiDeGrace}</span> ms
          </span>
          <input
            id="delai-de-grace"
            type="range"
            bind:value={reglages.delaiDeGrace}
            min={BORNES.delaiDeGrace.min}
            max={BORNES.delaiDeGrace.max}
            step={BORNES.delaiDeGrace.pas}
            class="mt-2 w-full"
          />
          <span class="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Une réponse tombée juste après l’apparition du nombre suivant est rendue à l’essai
            qu’elle visait. Zéro éteint l’aide.
            <!--
              L'INSCRIPTION EST DEMANDÉE, et elle dit vrai : la référence porte
              bien une fenêtre de grâce, mais sa branche de notation la
              consomme avant qu'elle serve. Aucune valeur n'y a donc jamais été
              mise à l'épreuve, et 300 ms est le temps d'un doigt qui descend —
              un raisonnement, pas une mesure. L'écrire évite qu'on prenne ce
              défaut pour un réglage hérité.
            -->
            <strong class="font-medium">Valeur par défaut choisie, non éprouvée.</strong>
          </span>
        </label>

        <label class="block text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">Ordre du pavé</span>
          <select
            id="ordre-pave"
            bind:value={reglages.ordrePave}
            class="cible-tactile mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2
                   text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="melange">Mélangé à chaque essai</option>
            <option value="croissant">Croissant</option>
            <option value="decroissant">Décroissant</option>
          </select>
        </label>
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">
            Horizon d’une consigne :
            <span data-valeur="prospectiveHorizon" class="tabular-nums">
              {Math.round(reglages.prospectiveHorizon / 1000)}
            </span> s au plus
          </span>
          <input
            id="prospective-horizon"
            type="range"
            bind:value={reglages.prospectiveHorizon}
            min={BORNES.prospectiveHorizon.min}
            max={BORNES.prospectiveHorizon.max}
            step={BORNES.prospectiveHorizon.pas}
            class="mt-2 w-full"
          />
          <span class="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Le délai au bout duquel une consigne est attendue. L’écart réel est tiré au hasard,
            puis plafonné par ce réglage.
          </span>
        </label>

        <label class="block text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">
            Fenêtre de réponse :
            <span data-valeur="prospectiveFenetre" class="tabular-nums">
              {reglages.prospectiveFenetre}
            </span> ms
          </span>
          <input
            id="prospective-fenetre"
            type="range"
            bind:value={reglages.prospectiveFenetre}
            min={BORNES.prospectiveFenetre.min}
            max={BORNES.prospectiveFenetre.max}
            step={BORNES.prospectiveFenetre.pas}
            class="mt-2 w-full"
          />
        </label>
      </div>

      <label class="mt-4 flex items-center gap-2 text-sm">
        <input
          id="prospective"
          type="checkbox"
          bind:checked={reglages.prospectiveActive}
          class="cible-tactile-pleine"
        />
        <span class="font-medium text-slate-700 dark:text-slate-200">
          Mémoire prospective — retenir une consigne et y penser au bon moment
        </span>
      </label>

      <!--
        LES QUATRE MODULES, TOUS ÉTEINTS PAR DÉFAUT.

        Chacun ajoute une tâche à une épreuve qui en porte déjà deux : qui les
        allume le fait exprès, et le voit écrit. Le changement de règle est
        marqué « expérimental » parce qu'il l'est — rien n'a encore établi
        qu'alterner entre quatre opérations reste lisible, et le dire vaut mieux
        que de le laisser découvrir.
      -->
      <fieldset class="mt-4 rounded-lg border border-slate-300 p-3 dark:border-slate-700">
        <legend class="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Modules facultatifs
        </legend>

        <label class="flex items-center gap-2 text-sm">
          <input
            id="inhibition"
            type="checkbox"
            bind:checked={reglages.inhibitionActive}
            class="cible-tactile-pleine"
          />
          <span class="text-slate-700 dark:text-slate-200">
            Inhibition — sur certains essais, ne pas répondre mais presser « Retenir »
          </span>
        </label>

        {#if reglages.inhibitionActive}
          <label class="mt-2 block text-sm text-slate-600 dark:text-slate-300">
            Essais portant le signal : {reglages.inhibitionFrequence} %
            <input
              id="inhibition-frequence"
              type="range"
              bind:value={reglages.inhibitionFrequence}
              min={BORNES.inhibitionFrequence.min}
              max={BORNES.inhibitionFrequence.max}
              step={BORNES.inhibitionFrequence.pas}
              class="mt-1 w-full"
            />
          </label>
        {/if}

        <label class="mt-2 flex items-center gap-2 text-sm">
          <input id="ndm" type="checkbox" bind:checked={reglages.ndmActif} class="cible-tactile-pleine" />
          <span class="text-slate-700 dark:text-slate-200">
            NDM — dire si le NOMBRE est plus petit, égal ou plus grand que le précédent
          </span>
        </label>

        <label class="mt-2 flex items-center gap-2 text-sm">
          <input id="sdm" type="checkbox" bind:checked={reglages.sdmActif} class="cible-tactile-pleine" />
          <span class="text-slate-700 dark:text-slate-200">
            SDM — la même chose sur le RÉSULTAT ATTENDU, comparé à celui de l’essai précédent
          </span>
        </label>

        <label class="mt-2 flex items-center gap-2 text-sm">
          <input
            id="changement-de-regle"
            type="checkbox"
            bind:checked={reglages.changementDeRegleActif}
            class="cible-tactile-pleine"
          />
          <span class="text-slate-700 dark:text-slate-200">
            Changement de règle — l’opération alterne par blocs
            <span class="ml-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              expérimental
            </span>
          </span>
        </label>

        {#if reglages.changementDeRegleActif}
          <!--
            QUELLES OPÉRATIONS ALTERNENT.

            Exposées parce qu'un module qu'on allume sans pouvoir dire sur quoi
            il porte n'est allumé qu'à moitié. En dessous de deux il n'y a rien
            à alterner : le moteur garde alors l'opération des réglages, et la
            note ci-dessous le dit plutôt que de laisser croire au changement.
          -->
          <fieldset class="mt-2 border-0 p-0">
            <legend class="text-sm text-slate-600 dark:text-slate-300">
              Opérations qui alternent
            </legend>
            <div class="mt-1 flex flex-wrap gap-3">
              {#each OPERATIONS as op (op)}
                <label class="flex items-center gap-1 text-sm">
                  <input
                    id={`commutee-${op}`}
                    data-commutee={op}
                    type="checkbox"
                    bind:checked={reglages.operationsCommutees[op]}
                    class="cible-tactile-pleine"
                  />
                  <span class="text-slate-700 dark:text-slate-200">{NOM_OPERATION[op]}</span>
                </label>
              {/each}
            </div>
            {#if operationsCommutables(reglages.operationsCommutees).length < 2}
              <p data-pas-dalternance class="mt-1 text-xs" style="color: var(--etat-alerte)">
                Moins de deux opérations : rien n’alternera, et la règle restera
                celle choisie plus haut.
              </p>
            {/if}
          </fieldset>

          <label class="mt-2 block text-sm text-slate-600 dark:text-slate-300">
            Essais par bloc : {reglages.changementDeRegleBloc}
            <input
              id="changement-de-regle-bloc"
              type="range"
              bind:value={reglages.changementDeRegleBloc}
              min={BORNES.changementDeRegleBloc.min}
              max={BORNES.changementDeRegleBloc.max}
              step={BORNES.changementDeRegleBloc.pas}
              class="mt-1 w-full"
            />
          </label>
        {/if}
      </fieldset>

      <label class="mt-2 flex items-center gap-2 text-sm">
        <input id="son" type="checkbox" bind:checked={sonVoulu} class="cible-tactile-pleine" />
        <span class="font-medium text-slate-700 dark:text-slate-200">Dire les nombres à voix haute</span>
      </label>

      {#if sonVoulu && voix.enVisuel}
        <!--
          La politique de voix s'affiche plutôt que de se taire : qui a demandé
          le son saurait seulement que « ça ne parle pas ».
        -->
        <p
          data-voix-refusee
          class="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {voix.raison} Les nombres seront affichés.
        </p>
      {/if}
    </div>

    <div class="flex flex-wrap gap-3">
      <button
        id="commencer"
        type="button"
        onclick={() => commencer(false)}
        class="cible-tactile rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
      >
        Commencer la séance
      </button>
      <button
        id="decouvrir"
        type="button"
        onclick={() => commencer(true)}
        class="cible-tactile rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700
               hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Découvrir en une minute
      </button>
    </div>
    <p class="text-xs text-slate-500 dark:text-slate-400">
      La découverte n’enregistre rien : ni essai, ni séance, ni expérience.
    </p>
  </section>
{:else if etape === 'seance'}
  <section bind:this={zone} data-zone-de-jeu class="space-y-4">
    <div class="flex items-baseline justify-between text-sm text-slate-500 dark:text-slate-400">
      <span class="tabular-nums" data-reste>
        {minutes}:{String(secondes).padStart(2, '0')}
      </span>
      {#if decouverte}
        <span data-decouverte class="font-medium text-amber-700 dark:text-amber-300">
          Découverte — rien n’est enregistré
        </span>
      {/if}
      <span class="tabular-nums" data-cadence>{intervalle} ms</span>
    </div>

    <!--
      LA CONSIGNE, LE TEMPS DE SON AFFICHAGE SEULEMENT.

      Elle paraît, puis disparaît : c'est tout le sujet de la mémoire
      prospective — retrouver une intention sans que rien ne la rappelle. La
      laisser à l'écran jusqu'à son échéance en ferait une simple consigne de
      lecture, et l'exercice n'aurait plus de seconde tâche.
    -->
    {#each consignesAffichees as consigne (consigne.id)}
      <p
        data-consigne={consigne.touche}
        class="rounded-xl border border-indigo-300 bg-indigo-50 p-3 text-center text-sm
               font-medium text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950
               dark:text-indigo-100"
      >
        À retenir : dans environ
        <strong class="tabular-nums">
          {Math.max(0, Math.round((consigne.echeance - depuisLeDebut()) / 1000))}
        </strong>
        secondes, appuyez sur
        <strong class="text-lg">{consigne.touche}</strong>.
      </p>
    {/each}

    <!--
      Le nombre. `data-nombre` est le point d'ancrage des essais au navigateur.
      L'animation d'apparition est posée par une classe, et la feuille de style
      la retire sous « prefers-reduced-motion » — voir le bloc <style>.
    -->
    <div
      class="flex min-h-40 items-center justify-center rounded-xl border border-slate-200
             bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {#if courant}
        {#key courant.rang}
          <span
            data-nombre={courant.nombre}
            data-rang={courant.rang}
            class="apparition text-6xl font-bold tabular-nums text-slate-900 dark:text-white"
            class:sans-mouvement={mouvementReduit()}
          >
            {courant.nombre}
          </span>
        {/key}
      {/if}
    </div>

    <p class="text-center text-sm text-slate-500 dark:text-slate-400">
      {#if courant && courant.reference === null}
        Échauffement : retenez ce nombre.
      {:else if courant}
        {NOM_OPERATION[courant.operation]} avec le nombre d’il y a {reglages.n}.
      {/if}
    </p>

    <!--
      LE RETOUR, EN TOUTES LETTRES. La couleur et le signe sont un second
      canal, jamais le seul : `aria-live="polite"` annonce le verdict au même
      moment pour tout le monde. La région existe dans le DOM dès le début de
      la séance — une région créée au moment où elle doit parler n'est pas
      annoncée par tous les lecteurs d'écran.
    -->
    <p
      data-annonce
      role="status"
      aria-live="polite"
      class="min-h-6 text-center text-sm font-medium"
      class:text-emerald-700={dernierVerdict === 'juste'}
      class:dark:text-emerald-300={dernierVerdict === 'juste'}
      class:text-rose-700={dernierVerdict === 'faux'}
      class:dark:text-rose-300={dernierVerdict === 'faux'}
    >
      {annonce}
    </p>

    {#if signalInhibition}
      <!--
        LE SIGNAL D'INHIBITION, ÉCRIT.

        Sans lui le module serait injouable : rien à l'écran ne distinguerait
        l'essai où il faut retenir de celui où il faut répondre, et « omis »
        tomberait sur une personne qui n'avait aucun moyen de savoir. Un essai
        impossible n'est pas un essai difficile.

        Le signal est un MOT, et non une teinte seule : une consigne portée par
        la couleur ne parvient pas à qui ne la distingue pas, et la bordure
        colorée ci-dessous ne fait que redoubler ce qui est déjà écrit.

        Ce que ce choix coûte, dit franchement : le signal est donné plutôt
        qu'appris, ce qui ôte la part de mémoire de la règle. Ce qui reste —
        retenir un geste déjà préparé — est la part que le module mesure, et
        c'est elle que la référence rend impossible en désactivant son champ.
      -->
      <p
        data-signal-inhibition
        role="status"
        aria-live="assertive"
        class="rounded-lg border-2 px-3 py-2 text-center text-sm font-semibold"
        style="border-color: var(--etat-alerte); color: var(--etat-texte);
               background: var(--etat-fond-eleve)"
      >
        Ne répondez pas — pressez « Retenir ».
      </p>
    {/if}

    {#if reglages.changementDeRegleActif && operationDuBloc}
      <!--
        LA BANNIÈRE DU CHANGEMENT DE RÈGLE, marquée « expérimental ».

        Les couleurs viennent des JETONS, et le contraste de chacune est gardé
        par `essais:pcct` : une teinte tirée hors jetons passerait sous 3:1 sur
        l'un des quatorze thèmes sans que rien ne le dise. La couleur n'est
        JAMAIS le seul canal — l'opération est écrite en toutes lettres à côté.

        Pas d'animation : `prefers-reduced-motion` n'a rien à éteindre, ce qui
        est la façon la plus sûre de le respecter.
      -->
      <p
        data-regle-courante={operationDuBloc}
        role="status"
        aria-live="polite"
        class="rounded-lg border px-3 py-2 text-center text-sm font-medium"
        style="border-color: var(--etat-bordure); color: var(--etat-texte);
               background: var(--etat-fond-eleve)"
      >
        <span
          data-pastille-regle
          class="mr-2 inline-block h-3 w-3 rounded-full align-middle"
          style={`background: ${COULEUR_REGLE[operationDuBloc]}`}
          aria-hidden="true"
        ></span>
        Règle : {NOM_OPERATION[operationDuBloc]}
        {#if regleQuiChange}<strong> — elle vient de changer</strong>{/if}
        <span class="ml-2 text-xs uppercase tracking-wide" style="color: var(--etat-texte-faible)">
          expérimental
        </span>
      </p>
    {/if}

    {#if modulesActifs}
      <!--
        LES ÉQUIVALENTS TACTILES DES MODULES.

        « Retenir » est offert sur TOUS les essais, y compris ceux qui ne
        portent pas de signal : c'est ce qui rend la fausse alarme possible, et
        donc mesurable. La référence, elle, n'offre rien du tout — son champ est
        désactivé et ses touches ne sont lues que sur lui.

        Le pavé des chiffres n'est PAS désactivé non plus sur un essai
        d'inhibition : répondre alors qu'il fallait retenir est précisément
        l'échec que le module mesure, et l'empêcher rendrait le module borgne.
      -->
      <div class="flex flex-wrap items-center justify-center gap-2">
        {#if reglages.inhibitionActive}
          <button
            type="button"
            data-retenir
            aria-pressed={aRetenu}
            onclick={retenir}
            class="cible-tactile-pleine min-h-11 min-w-11 rounded-lg border px-4 font-semibold"
            style={`border-color: var(--etat-bordure); color: var(--etat-texte);
                    background: ${aRetenu ? 'var(--etat-fond-eleve)' : 'transparent'}`}
          >
            Retenir
          </button>
        {/if}
        {#if reglages.ndmActif || reglages.sdmActif}
          <div role="group" aria-label="Sens de la comparaison" class="flex gap-2">
            {#each SENS as sens (sens)}
              <button
                type="button"
                data-sens={sens}
                aria-pressed={sensDonne === sens}
                onclick={() => donnerLeSens(sens)}
                class="cible-tactile-pleine min-h-11 min-w-11 rounded-lg border px-3 font-medium"
                style={`border-color: var(--etat-bordure); color: var(--etat-texte);
                        background: ${sensDonne === sens ? 'var(--etat-fond-eleve)' : 'transparent'}`}
              >
                {NOM_SENS[sens]}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!--
        UNE TROISIÈME RÉGION VOCALE. Même raison qu'à la deuxième : les modules
        rendent leur verdict au même instant que l'arithmétique et que la
        mémoire prospective, et une région partagée verrait l'un effacer
        l'autre avant qu'il soit annoncé. Trois tâches, trois voix.
      -->
      <p
        data-annonce-modules
        role="status"
        aria-live="polite"
        class="min-h-6 text-center text-sm font-medium"
        style="color: var(--etat-texte-faible)"
      >
        {annonceModules}
      </p>
    {/if}

    {#if touches.length}
      <Pave {touches} onRepondre={repondre} />
    {:else}
      <p class="text-center text-sm text-slate-500 dark:text-slate-400">
        La plage est trop large pour un pavé : répondez au clavier.
      </p>
    {/if}

    {#if reglages.prospectiveActive}
      <!--
        L'ÉQUIVALENT TACTILE DES TOUCHES DE CONSIGNE.

        Les huit lettres sont offertes en permanence, et non la seule attendue :
        donner uniquement la bonne touche répondrait à la place de la personne,
        et la mémoire prospective consiste précisément à retrouver LAQUELLE.
        C'est donc l'exact équivalent du clavier, ni plus ni moins.
      -->
      <div
        role="group"
        aria-label="Touches de consigne"
        data-touches-consigne
        class="flex flex-wrap justify-center gap-2"
      >
        {#each TOUCHES as lettre (lettre)}
          <button
            type="button"
            data-touche-consigne={lettre}
            onclick={() => toucherLaConsigne(lettre)}
            class="cible-tactile-pleine min-h-11 min-w-11 rounded-lg border border-indigo-300
                   bg-indigo-50 font-semibold text-indigo-900 hover:bg-indigo-100
                   dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100
                   dark:hover:bg-indigo-900"
          >
            {lettre}
          </button>
        {/each}
      </div>

      <!--
        UNE SECONDE RÉGION VOCALE, et c'est nécessaire : les deux tâches
        rendent un verdict en même temps, et une seule région verrait le second
        effacer le premier avant qu'il soit annoncé. Deux régions, deux voix.
      -->
      <p
        data-annonce-pm
        role="status"
        aria-live="polite"
        class="min-h-6 text-center text-sm font-medium text-indigo-700 dark:text-indigo-300"
      >
        {annoncePm}
      </p>
    {/if}

    <p class="text-center text-sm text-slate-500 dark:text-slate-400">
      Au clavier : les chiffres, « − » pour le signe, Entrée pour valider.
      {#if saisie}
        <span data-saisie class="ml-2 font-mono text-base text-slate-900 dark:text-white">
          {saisie}
        </span>
      {/if}
    </p>

    <div class="flex items-center justify-between">
      <span class="text-sm text-slate-500 dark:text-slate-400" data-precision>
        {#if precision === null}
          Rien de noté encore
        {:else}
          {justes}/{notes} — {precision} %
        {/if}
      </span>
      <button
        id="arreter"
        type="button"
        onclick={arreterApresConfirmation}
        class="cible-tactile rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium
               text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200
               dark:hover:bg-slate-800"
      >
        Arrêter
      </button>
    </div>
  </section>
{:else if bilan}
  <section class="space-y-4" data-bilan>
    <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
      {decouverte ? 'Découverte terminée' : 'Séance terminée'}
    </h2>
    {#if decouverte}
      <p
        data-rien-enregistre
        class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      >
        Rien n’a été enregistré : la découverte sert à comprendre la tâche, pas à mesurer.
      </p>
    {/if}
    <dl class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <dt class="text-xs text-slate-500 dark:text-slate-400">Justes</dt>
        <dd class="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
          {bilan.justes}/{bilan.notes}
        </dd>
      </div>
      <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <dt class="text-xs text-slate-500 dark:text-slate-400">Intervalle atteint</dt>
        <dd class="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
          {bilan.intervalleFin} ms
        </dd>
      </div>
      <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <dt class="text-xs text-slate-500 dark:text-slate-400">Réaction médiane</dt>
        <dd class="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
          {bilan.reactionMediane === null ? '—' : `${Math.round(bilan.reactionMediane)} ms`}
        </dd>
      </div>
    </dl>
    {#if reglages.prospectiveActive}
      <p data-bilan-pm class="text-sm text-slate-500 dark:text-slate-400">
        Mémoire prospective — {compteParVerdict.juste} à l’heure,
        {compteParVerdict.manquee} trop tard, {compteParVerdict.fausse} mauvaise touche,
        {compteParVerdict.omise} oubliée(s).
        {#if bilan.scores.prospective !== null}
          Score : {Math.round(bilan.scores.prospective * 100)} %.
        {/if}
      </p>
    {/if}
    <button
      id="revenir"
      type="button"
      onclick={() => (etape = 'accueil')}
      class="cible-tactile rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
    >
      Revenir aux réglages
    </button>
  </section>
{/if}

<style>
  /*
     L'APPARITION RESPECTE LE MOUVEMENT RÉDUIT, PAR LES DEUX CHEMINS.

     La requête média couvre le réglage du système. La classe couvre celui de
     l'application, posé en « data-animations » sur la racine par la page
     Paramètres — que la requête média ne connaît pas. Ne lire que la requête
     média laisserait l'animation à qui a coché « animations réduites » dans
     Cyclades sur un système qui ne demande rien : c'est le défaut que
     `essais:mouvement-reduit` interdit, et qu'il a déjà trouvé ailleurs.
  */
  .apparition {
    animation: paraitre 180ms ease-out;
  }

  .apparition.sans-mouvement {
    animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .apparition {
      animation: none;
    }
  }

  @keyframes paraitre {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
