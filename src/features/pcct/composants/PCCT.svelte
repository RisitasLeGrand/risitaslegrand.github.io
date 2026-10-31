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
    noterLEssai,
    poserEssai,
    resumer,
    seanceNeuve,
    type EtatSeance,
  } from '../moteur/seance';
  import { attribuer } from '../moteur/grace';
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
    const essai = poserEssai(etat, hasard);
    courant = essai;
    rangDeLEssai = essai.rang;
    apparuA = performance.now();
    courantRepondu = false;
    saisie = '';
    dernierVerdict = null;
    intervalle = etat.rythme.intervalle;

    if (sonVoulu && voix.voix) direLeNombre(window.speechSynthesis, voix, essai.nombre);

    minuteur = setTimeout(poser, essai.intervalle);
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

  /* ── Le clavier ──────────────────────────────────────────────────────── */

  function auClavier(e: KeyboardEvent) {
    if (etape !== 'seance') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      void arreterApresConfirmation();
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
    secondesRestantes = enDecouverte ? DECOUVERTE : reglages.duree * 60;
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

      <label class="mt-4 flex items-center gap-2 text-sm">
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

    {#if touches.length}
      <Pave {touches} onRepondre={repondre} />
    {:else}
      <p class="text-center text-sm text-slate-500 dark:text-slate-400">
        La plage est trop large pour un pavé : répondez au clavier.
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
