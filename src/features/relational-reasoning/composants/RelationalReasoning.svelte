<script lang="ts">
  /**
   * La session de Relational Reasoning : quelques items tirés dans les moteurs
   * ouverts, chacun à son propre échelon, correction immédiate, revue des
   * manqués à la fin.
   *
   * Un item dont le générateur a prévu un second temps compte pour **deux**
   * questions : le second temps est posé après correction du premier, et noté
   * séparément. Les compter pour une seule aurait pénalisé les items les plus
   * riches, qui sont précisément ceux qu'on veut voir revenir.
   *
   * L'espace « Comprendre » est consultable depuis l'accueil et n'interrompt
   * jamais une session. Le rappel d'une ligne au-dessus de chaque question est
   * le seul tutoriel en cours de session, et il se coupe.
   */
  import {
    ajouterSessionRelationnelle,
    ecrireSelectionEntrainement,
    lireSelectionEntrainement,
    SELECTION_PAR_DEFAUT,
    toutesLesSessionsRelationnelles,
    type SelectionEntrainement,
  } from '../../../lib/db';
  import MonEntrainement from '../../cog-training/composants/MonEntrainement.svelte';
  import type { GroupeUnites } from '../../cog-training/unites';
  import { gagnerXp, xpRelationnel } from '../../../lib/gamification';
  import Bloc from './Bloc.svelte';
  import Comprendre from './Comprendre.svelte';
  import Statistiques from './Statistiques.svelte';
  import type { Item, Option, Reponse } from '../moteurs/types';
  import { moteurParId } from '../moteurs/index';
  import { noter, type Donnee } from '../noyaux/notation';
  import { composerSession } from '../session';
  import {
    FAMILLES,
    etatDesMoteurs,
    itemsReussis,
    prochainPalierSystemes,
    statistiques,
    type Trace,
  } from '../progression';
  import CorrectionDetaillee from '../../correction/composants/CorrectionDetaillee.svelte';
  import { aCorrectionDetaillee } from '../../correction/registre';

  type Etape = 'accueil' | 'question' | 'bilan';

  /** Une question posée : le temps principal d'un item, ou son second temps. */
  interface Question {
    item: Item;
    second: boolean;
    consigne: string;
    enonce: Item['enonce'];
    reponse: Reponse;
    explication: string;
  }

  const CLE_TUTORIELS = 'revinsp:rr:tutoriels';

  let etape = $state<Etape>('accueil');
  let chargement = $state(true);
  let traces = $state<Trace[]>([]);
  let selection = $state<SelectionEntrainement>({ ...SELECTION_PAR_DEFAUT });
  let comprendreOuvert = $state(false);
  let entrainementOuvert = $state(false);
  let statsOuvert = $state(false);
  let tutoriels = $state(true);

  let questions = $state<Question[]>([]);
  let rang = $state(0);
  let corrige = $state(false);
  let resultats = $state<{ question: Question; note: number; donnee: Donnee }[]>([]);
  let debut = 0;
  let xpGagne = $state(0);

  /**
   * Comment désigner une proposition dans le texte de la correction.
   *
   * Certaines propositions sont des dessins : elles n'ont pas de texte, et seul
   * leur rang permet d'en parler. Le dire en toutes lettres importe — une
   * correction qui ne tient qu'à la couleur des cases n'est lisible ni par tout
   * le monde, ni dans toutes les conditions.
   */
  function nommerOption(options: Option[] | undefined, i: number | null): string {
    if (i === null || i === undefined) return 'aucune';
    const texte = options?.[i]?.texte?.trim();
    return texte ? `« ${texte} »` : `la proposition ${i + 1}`;
  }

  function nommerPlusieurs(options: Option[] | undefined, indices: readonly number[]): string {
    if (!indices.length) return 'aucune';
    return indices.map((i) => nommerOption(options, i)).join(', ');
  }

  let choixUnique = $state<number | null>(null);
  let choixMultiples = $state<number[]>([]);
  let appariements = $state<Record<string, string>>({});

  /**
   * La correction détaillée est **dépliée à la demande**, et refermée en passant
   * à la question suivante.
   *
   * Elle n'est pas ouverte d'office : la première chose utile après une réponse
   * est de savoir si elle était juste, et dérouler aussitôt six étapes de
   * raisonnement par-dessus noierait ce verdict. Le bouton la propose, et la
   * personne décide.
   */
  let correctionOuverte = $state(false);
  /** Les items du bilan dont la correction est dépliée, par rang. */
  let correctionsBilan = $state<number[]>([]);

  /**
   * La réponse donnée, dans la forme que la correction attend.
   *
   * Les deux formes existaient déjà — `donnee()` sert à la notation — mais la
   * correction a besoin de la **relire après coup**, y compris dans le bilan où
   * les choix du moment ne sont plus en mémoire. On la garde donc avec le
   * résultat.
   */
  function donneePourCorrection(): Donnee {
    if (question.reponse.genre === 'unique') return { genre: 'unique', choix: choixUnique };
    if (question.reponse.genre === 'multiple') return { genre: 'multiple', choix: [...choixMultiples] };
    return { genre: 'appariement', paires: { ...appariements } };
  }

  const question = $derived(questions[rang]);
  const etats = $derived(etatDesMoteurs(traces));
  const ouverts = $derived(etats.filter((etat) => etat.ouvert));
  const palier = $derived(prochainPalierSystemes(traces));

  $effect(() => {
    // Le réglage des tutoriels est une commodité par appareil : il n'a pas sa
    // place dans la base de progression, qui se synchronise entre appareils.
    try {
      tutoriels = localStorage.getItem(CLE_TUTORIELS) !== 'non';
    } catch {
      /* navigation privée : le réglage vaudra pour cette page seulement */
    }
  });

  function basculerTutoriels() {
    tutoriels = !tutoriels;
    try {
      localStorage.setItem(CLE_TUTORIELS, tutoriels ? 'oui' : 'non');
    } catch {
      /* sans stockage, le réglage ne survit pas au rechargement */
    }
  }

  async function chargerTraces() {
    try {
      const sessions = await toutesLesSessionsRelationnelles();
      traces = sessions
        .slice()
        .sort((a, b) => a.le.localeCompare(b.le))
        .flatMap((session) => session.items);
    } catch {
      traces = [];
    }
    await chargerSelection();
    chargement = false;
  }
  chargerTraces();

  /**
   * La sélection, et son amorçage.
   *
   * Une sélection vide interdit de lancer une session — c'est la règle, et elle
   * est nécessaire : une session qui se rabattrait sur tout ferait croire qu'on
   * travaille ce qu'on a coché. Mais elle rendrait la rubrique inutilisable au
   * premier jour. D'où l'amorçage : à la première ouverture, la sélection est
   * **tous les moteurs ouverts**. La règle vaut donc strictement sans jamais
   * bloquer personne.
   *
   * ## Le piège, qui s'est refermé une fois
   *
   * Une première version lisait, amorçait et **écrivait** dans un seul `try`,
   * dont le `catch` reposait la sélection par défaut — qui est vide. Il suffisait
   * donc que l'écriture échoue, ou qu'IndexedDB soit indisponible, pour que la
   * sélection amorcée soit effacée juste après l'avoir été : « Commencer »
   * restait désactivé, et la rubrique entière devenait inutilisable sans qu'un
   * message l'explique. Le défaut ne s'est vu qu'en ouvrant le site dans un
   * navigateur neuf — ni la vérification de types ni les essais ne pouvaient
   * l'attraper.
   *
   * D'où la forme actuelle : l'amorce est calculée **avant** toute entrée-sortie,
   * elle sert de repli à chaque échec, et la persistance est tentée à part. Sans
   * stockage du tout, la rubrique fonctionne — la sélection ne survit
   * simplement pas au rechargement.
   */
  async function chargerSelection() {
    const amorce: SelectionEntrainement = {
      ...SELECTION_PAR_DEFAUT,
      unites: etatDesMoteurs(traces)
        .filter((etat) => etat.ouvert)
        .map((etat) => etat.moteur.id),
    };

    let lue: SelectionEntrainement | null = null;
    try {
      lue = await lireSelectionEntrainement('relational-reasoning');
    } catch {
      /* sans stockage, on part de l'amorce */
    }

    const aPersister = !lue || lue.unites.length === 0;
    selection = aPersister ? (lue ? { ...lue, unites: amorce.unites } : amorce) : lue;

    if (aPersister) {
      try {
        await ecrireSelectionEntrainement('relational-reasoning', selection);
      } catch {
        /* l'amorce vaut pour cette session, et c'est assez pour jouer */
      }
    }
  }

  async function changerSelection(suivante: SelectionEntrainement) {
    selection = suivante;
    try {
      await ecrireSelectionEntrainement('relational-reasoning', suivante);
    } catch {
      /* sans stockage, le réglage ne survit pas au rechargement */
    }
  }

  /**
   * Les moteurs rangés en groupes, pour « Mon entraînement ».
   *
   * Même découpage que l'espace « Comprendre », induction comprise : elle n'est
   * pas dans `FAMILLES` parce qu'elle est ouverte d'emblée et n'a pas de moteur
   * d'ouverture, mais elle doit évidemment être sélectionnable.
   */
  const groupes: GroupeUnites[] = $derived(
    [
      ...FAMILLES.map((famille) => ({
        id: famille.id as string,
        nom: famille.nom,
        resume: famille.resume,
        unites: etats.filter((etat) => etat.moteur.categorie === famille.id),
      })),
      {
        id: 'induction',
        nom: 'Induction',
        resume: 'Retrouver une règle à partir d’exemples. Ouvert dès le départ.',
        unites: etats.filter((etat) => etat.moteur.categorie === 'induction'),
      },
    ].map((groupe) => ({
      id: groupe.id,
      nom: groupe.nom,
      resume: groupe.resume,
      unites: groupe.unites.map((etat) => ({
        id: etat.moteur.id,
        nom: etat.moteur.nom,
        resume: etat.moteur.resume,
        debloque: etat.ouvert,
      })),
    })),
  );

  /** Les moteurs cochés et réellement jouables : ce que la session tirera. */
  const retenus = $derived(
    etats
      .filter((etat) => (etat.ouvert || selection.modeLibre) && selection.unites.includes(etat.moteur.id))
      .map((etat) => etat.moteur.id),
  );

  function questionsDe(item: Item): Question[] {
    const principale: Question = {
      item,
      second: false,
      consigne: item.consigne,
      enonce: item.enonce,
      reponse: item.reponse,
      explication: item.explication,
    };
    if (!item.suite) return [principale];
    return [
      principale,
      {
        item,
        second: true,
        consigne: item.suite.consigne,
        // Le second temps rappelle l'énoncé du premier : sans lui, il faudrait
        // se souvenir des paires, ce qui ferait de la mémoire l'exercice.
        enonce: [...item.enonce, ...item.suite.enonce],
        reponse: item.suite.reponse,
        explication: item.suite.explication,
      },
    ];
  }

  function commencer() {
    const session = composerSession(traces, selection.items, undefined, {
      moteurs: retenus,
      ordre: selection.ordre,
      modeLibre: selection.modeLibre,
    });
    questions = session.items.flatMap(questionsDe);
    rang = 0;
    corrige = false;
    resultats = [];
    xpGagne = 0;
    debut = Date.now();
    reinitialiserReponse();
    etape = questions.length ? 'question' : 'accueil';
  }

  function reinitialiserReponse() {
    choixUnique = null;
    choixMultiples = [];
    appariements = {};
  }

  const repondu = $derived.by(() => {
    if (!question) return false;
    if (question.reponse.genre === 'unique') return choixUnique !== null;
    if (question.reponse.genre === 'multiple') return choixMultiples.length > 0;
    return question.reponse.gauche.every((clef) => appariements[clef]);
  });

  function donnee(): Donnee {
    if (question.reponse.genre === 'unique') return { genre: 'unique', choix: choixUnique };
    if (question.reponse.genre === 'multiple') return { genre: 'multiple', choix: choixMultiples };
    return { genre: 'appariement', paires: appariements };
  }

  function valider() {
    if (!repondu || corrige) return;
    resultats = [
      ...resultats,
      { question, note: noter(question.reponse, donnee()), donnee: donneePourCorrection() },
    ];
    corrige = true;
    correctionOuverte = false;
  }

  function basculerMultiple(index: number) {
    if (corrige) return;
    choixMultiples = choixMultiples.includes(index)
      ? choixMultiples.filter((i) => i !== index)
      : [...choixMultiples, index];
  }

  async function suivant() {
    if (rang + 1 < questions.length) {
      rang += 1;
      corrige = false;
      correctionOuverte = false;
      reinitialiserReponse();
      return;
    }
    await terminer();
  }

  async function terminer() {
    const secondes = Math.round((Date.now() - debut) / 1000);
    const reussis = resultats.filter((r) => r.note >= 1).length;
    const echelons = resultats.map(
      (r) => etats.find((e) => e.moteur.id === r.question.item.moteur)?.echelon ?? 1,
    );
    const echelonMoyen = echelons.length
      ? echelons.reduce((somme, e) => somme + e, 0) / echelons.length
      : 1;
    etape = 'bilan';

    const nouvelles: Trace[] = resultats.map((r) => ({
      moteur: r.question.item.moteur,
      systeme: r.question.item.systeme,
      note: r.note,
    }));

    try {
      await ajouterSessionRelationnelle({
        le: new Date().toISOString(),
        items: nouvelles,
        tentes: resultats.length,
        reussis,
        secondes,
      });
      const gain = await gagnerXp(xpRelationnel(reussis, echelonMoyen), {
        reponses: resultats.length,
        bonnes: reussis,
        secondes,
      });
      xpGagne = gain.xpGagne;
    } catch {
      // L'enregistrement peut échouer en navigation privée : le bilan
      // s'affiche quand même, seul le suivi est perdu.
    }
    traces = [...traces, ...nouvelles];
  }

  const manques = $derived(resultats.filter((r) => r.note < 1));
  const reussis = $derived(resultats.filter((r) => r.note >= 1).length);
  const partielles = $derived(resultats.filter((r) => r.note > 0 && r.note < 1).length);
  const nomMoteur = (id: string) => moteurParId(id)?.nom ?? id;
  const resumeMoteur = (id: string) => moteurParId(id)?.resume ?? '';
</script>

{#if chargement}
  <p class="py-16 text-center text-sm text-slate-400">Lecture de votre progression…</p>
{:else if etape === 'accueil'}
  <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold text-slate-900 dark:text-white">Commencer une session</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {ouverts.length} exercice{ouverts.length > 1 ? 's' : ''} ouvert{ouverts.length > 1 ? 's' : ''},
          chacun à son propre niveau. {itemsReussis(traces)} item{itemsReussis(traces) > 1 ? 's' : ''}
          entièrement réussi{itemsReussis(traces) > 1 ? 's' : ''} jusqu'ici.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          onclick={() => (comprendreOuvert = !comprendreOuvert)}
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700
            hover:border-indigo-300 dark:border-slate-700 dark:text-slate-200"
        >{comprendreOuvert ? 'Masquer les exercices' : 'Comprendre les exercices'}</button>
        <button
          type="button"
          onclick={() => (statsOuvert = !statsOuvert)}
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700
            hover:border-indigo-300 dark:border-slate-700 dark:text-slate-200"
        >{statsOuvert ? 'Masquer la progression' : 'Ma progression'}</button>
        <button
          type="button"
          onclick={() => (entrainementOuvert = !entrainementOuvert)}
          aria-expanded={entrainementOuvert}
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700
            hover:border-indigo-300 dark:border-slate-700 dark:text-slate-200"
        >{entrainementOuvert ? 'Masquer mon entraînement' : 'Mon entraînement'}</button>
      </div>
    </div>

    {#if comprendreOuvert}
      <Comprendre {etats} {tutoriels} onBasculerTutoriels={basculerTutoriels} />
    {/if}

    {#if statsOuvert}
      <Statistiques stats={statistiques(traces)} />
    {/if}

    {#if entrainementOuvert}
      <div class="mt-4">
        <MonEntrainement
          {groupes}
          {selection}
          onChanger={changerSelection}
          onLancer={commencer}
        />
      </div>
    {/if}

    <!-- Le réglage fin est dans « Mon entraînement » ; l'accueil n'en montre que
         le résumé, pour qu'on sache sur quoi on part sans avoir à déplier. -->
    <p class="mt-5 text-sm text-slate-600 dark:text-slate-300">
      {#if retenus.length === 0}
        <strong class="font-medium">Aucun exercice coché.</strong> Ouvrez
        « Mon entraînement » pour en choisir.
      {:else}
        {retenus.length} exercice{retenus.length > 1 ? 's' : ''} coché{retenus.length > 1 ? 's' : ''},
        {selection.items} items, ordre {selection.ordre === 'entrelace'
          ? 'entrelacé'
          : 'groupé par exercice'}{selection.modeLibre ? ', mode libre actif' : ''}.
      {/if}
    </p>

    {#if palier}
      <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Encore {palier.reste} item{palier.reste > 1 ? 's' : ''} entièrement réussi{palier.reste > 1 ? 's' : ''}
        pour ouvrir les systèmes « {palier.palier.nom} ».
      </p>
    {/if}

    <button
      type="button"
      onclick={commencer}
      disabled={retenus.length === 0}
      class="mt-5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white
        hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
    >Commencer</button>
  </section>
{:else if etape === 'question' && question}
  <section>
    <div class="mb-4 flex items-center justify-between gap-4">
      <p class="text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
        {nomMoteur(question.item.moteur)}{question.second ? ' — second temps' : ''}
      </p>
      <p class="text-xs text-slate-500 dark:text-slate-400">{rang + 1} / {questions.length}</p>
    </div>

    <div class="h-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
      <div class="h-full bg-indigo-500 transition-all" style="width: {(rang / questions.length) * 100}%"></div>
    </div>

    {#if tutoriels && !question.second}
      <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">{resumeMoteur(question.item.moteur)}</p>
    {/if}

    <h2 class="mt-4 font-semibold text-slate-900 dark:text-white">{question.consigne}</h2>

    {#each question.enonce as bloc, i (i)}
      <Bloc {bloc} />
    {/each}

    {#if question.reponse.genre === 'unique'}
      <div class="mt-4 space-y-2">
        {#each question.reponse.options as option, i (i)}
          <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm
            {corrige && i === question.reponse.bonne
              ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
              : corrige && i === choixUnique
                ? 'border-rose-400 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/40'
                : choixUnique === i
                  ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                  : 'border-slate-200 dark:border-slate-800'}">
            <input type="radio" bind:group={choixUnique} value={i} disabled={corrige} class="mt-0.5" />
            <span class="min-w-0 text-slate-800 dark:text-slate-200">
              {option.texte ?? ''}
              {#if option.blocs}
                {#each option.blocs as bloc, j (j)}<Bloc {bloc} />{/each}
              {/if}
            </span>
          </label>
        {/each}
      </div>
    {:else if question.reponse.genre === 'multiple'}
      <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Plusieurs réponses peuvent être correctes : cochez-les toutes. Une case juste rapporte, une
        case fausse retire autant — tout cocher ne rapporte rien.
      </p>
      <div class="mt-2 space-y-2">
        {#each question.reponse.options as option, i (i)}
          <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm
            {corrige && question.reponse.bonnes.includes(i)
              ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
              : corrige && choixMultiples.includes(i)
                ? 'border-rose-400 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/40'
                : choixMultiples.includes(i)
                  ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                  : 'border-slate-200 dark:border-slate-800'}">
            <input
              type="checkbox"
              checked={choixMultiples.includes(i)}
              onchange={() => basculerMultiple(i)}
              disabled={corrige}
              class="mt-0.5"
            />
            <span class="min-w-0 text-slate-800 dark:text-slate-200">{option.texte ?? ''}</span>
          </label>
        {/each}
      </div>
    {:else}
      <div class="mt-4 space-y-2">
        {#each question.reponse.gauche as clef (clef)}
          <div class="flex flex-wrap items-center gap-3 rounded-lg border p-3
            {corrige
              ? appariements[clef] === question.reponse.paires[clef]
                ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                : 'border-rose-400 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/40'
              : 'border-slate-200 dark:border-slate-800'}">
            <span class="min-w-8 font-mono text-base font-semibold text-slate-900 dark:text-white">{clef}</span>
            <span class="text-slate-400">→</span>
            <select
              bind:value={appariements[clef]}
              disabled={corrige}
              class="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm
                text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value={undefined}>— choisir —</option>
              {#each question.reponse.droite as valeur (valeur)}
                <option value={valeur}>{valeur}</option>
              {/each}
            </select>
            {#if corrige && appariements[clef] !== question.reponse.paires[clef]}
              <span class="text-xs text-slate-600 dark:text-slate-300">
                réponse : {question.reponse.paires[clef]}
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if corrige}
      {@const dernier = resultats[resultats.length - 1]}
      {@const note = dernier?.note ?? 0}
      <div class="mt-5 rounded-lg border p-4 text-sm
        {note >= 1
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
          : note > 0
            ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
            : 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30'}">
        <p class="font-semibold {note >= 1
          ? 'text-emerald-800 dark:text-emerald-200'
          : note > 0
            ? 'text-amber-800 dark:text-amber-200'
            : 'text-rose-800 dark:text-rose-200'}">
          {note >= 1
            ? 'Juste.'
            : note > 0
              ? `En partie : ${Math.round(note * 100)} %.`
              : 'Pas tout à fait.'}
        </p>
        <!--
          L'explication dit pourquoi la bonne réponse est bonne. Quand la
          réponse donnée ne l'était pas, elle laissait sans réponse la seule
          question que l'on se pose alors : « et ce que j'ai répondu, alors ? ».
          On nomme donc les deux, en toutes lettres.
        -->
        {#if note < 1 && question.reponse.genre === 'unique'}
          <p class="mt-1 text-slate-700 dark:text-slate-300">
            Vous avez répondu {nommerOption(question.reponse.options, choixUnique)} ; la réponse
            attendue était {nommerOption(question.reponse.options, question.reponse.bonne)}.
          </p>
        {:else if note < 1 && question.reponse.genre === 'multiple'}
          <p class="mt-1 text-slate-700 dark:text-slate-300">
            Vous avez coché {nommerPlusieurs(question.reponse.options, choixMultiples)} ; l'ensemble
            attendu était {nommerPlusieurs(question.reponse.options, question.reponse.bonnes)}.
          </p>
        {/if}
        <p class="mt-1 text-slate-700 dark:text-slate-300">{question.explication}</p>

        <!--
          Trois conditions, et chacune pour sa raison. Le registre dit si
          l'exercice offre la correction détaillée ; la trace dit si cet item-là
          peut la tenir ; et le **second temps** en est exclu.

          Ce dernier point n'est pas un oubli à rattraper : la trace d'un item
          conclut à la réponse de son *premier* temps. L'afficher sur le second,
          qui a sa propre question et sa propre réponse, montrerait un
          raisonnement qui conclut à autre chose que ce qu'on vient de répondre.
          Mieux vaut ne rien proposer que proposer cela — et c'est noté comme un
          reste du lot B, non comme un choix définitif.
        -->
        {#if question.item.trace && !question.second && aCorrectionDetaillee('relational-reasoning')}
          <button
            type="button"
            onclick={() => (correctionOuverte = !correctionOuverte)}
            aria-expanded={correctionOuverte}
            class="mt-3 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm
              font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700
              dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
          >{correctionOuverte ? 'Replier la correction détaillée' : 'Correction détaillée'}</button>
        {/if}
      </div>
    {/if}

    {#if corrige && correctionOuverte && question.item.trace && !question.second}
      <CorrectionDetaillee
        item={question.item}
        reponse={question.reponse}
        trace={question.item.trace}
        donnee={resultats[resultats.length - 1]?.donnee ?? null}
        fermer={() => (correctionOuverte = false)}
      />
    {/if}

    <div class="mt-5 flex gap-3">
      {#if !corrige}
        <button
          type="button"
          onclick={valider}
          disabled={!repondu}
          class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white
            hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >Valider</button>
      {:else}
        <button
          type="button"
          onclick={suivant}
          class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >{rang + 1 < questions.length ? 'Question suivante' : 'Voir le bilan'}</button>
      {/if}
    </div>
  </section>
{:else}
  <section>
    <h2 class="font-semibold text-slate-900 dark:text-white">Bilan de la session</h2>
    <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
      {reussis} réponse{reussis > 1 ? 's' : ''} exacte{reussis > 1 ? 's' : ''} sur {resultats.length}{#if partielles},
      et {partielles} partiellement juste{partielles > 1 ? 's' : ''}{/if}.
      {#if xpGagne}<span class="font-medium text-indigo-700 dark:text-indigo-300">+{xpGagne} XP.</span>{/if}
    </p>

    {#if manques.length}
      <h3 class="mt-6 text-sm font-semibold text-slate-900 dark:text-white">
        Les {manques.length} item{manques.length > 1 ? 's' : ''} à revoir
      </h3>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Relire une explication juste après la session vaut mieux que la remettre à plus tard.
      </p>
      <ul class="mt-3 space-y-3">
        {#each manques as manque, i (i)}
          <li class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {nomMoteur(manque.question.item.moteur)}
              {#if manque.note > 0}— {Math.round(manque.note * 100)} %{/if}
            </p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{manque.question.consigne}</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{manque.question.explication}</p>

            <!--
              La revue de fin de séance donne accès à la même correction, et non
              à un résumé : c'est le moment où l'on a le temps de la lire, et un
              second format aurait été un second raisonnement à tenir à jour.
            -->
            {#if manque.question.item.trace && !manque.question.second}
              <button
                type="button"
                onclick={() =>
                  (correctionsBilan = correctionsBilan.includes(i)
                    ? correctionsBilan.filter((r) => r !== i)
                    : [...correctionsBilan, i])}
                aria-expanded={correctionsBilan.includes(i)}
                class="mt-2 rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-xs
                  font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700
                  dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              >{correctionsBilan.includes(i) ? 'Replier' : 'Correction détaillée'}</button>

              {#if correctionsBilan.includes(i)}
                <CorrectionDetaillee
                  item={manque.question.item}
                  reponse={manque.question.reponse}
                  trace={manque.question.item.trace}
                  donnee={manque.donnee}
                  fermer={() => (correctionsBilan = correctionsBilan.filter((r) => r !== i))}
                />
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="mt-4 text-sm text-emerald-700 dark:text-emerald-300">Aucun item manqué.</p>
    {/if}

    <button
      type="button"
      onclick={() => (etape = 'accueil')}
      class="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
    >Nouvelle session</button>
  </section>
{/if}
