<script lang="ts">
  /**
   * La session de Relational Reasoning : quelques items tirés dans la phase
   * courante, correction immédiate, revue des manqués à la fin.
   *
   * Un item dont le générateur a prévu un second temps compte pour **deux**
   * questions : le second temps est posé après correction du premier, et noté
   * séparément. Compter les deux comme une seule question aurait pénalisé les
   * items les plus riches, qui sont précisément ceux qu'on veut voir.
   */
  import { ajouterSessionRelationnelle } from '../../../lib/db';
  import { gagnerXp, xpRelationnel } from '../../../lib/gamification';
  import Bloc from './Bloc.svelte';
  import type { Item, Reponse } from '../moteurs/types';
  import { composerSession } from '../session';
  import { phaseAtteinte, phasesJouables, prochainPalier, PHASES } from '../progression';

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

  let { itemsReussisInitial = 0 }: { itemsReussisInitial?: number } = $props();

  const jouables = phasesJouables();

  let etape = $state<Etape>('accueil');
  let phase = $state(Math.min(phaseAtteinte(itemsReussisInitial), Math.max(...jouables.map((p) => p.numero))));
  let longueur = $state(12);

  let questions = $state<Question[]>([]);
  let rang = $state(0);
  let corrige = $state(false);
  let resultats = $state<{ question: Question; juste: boolean }[]>([]);
  let debut = 0;
  let xpGagne = $state(0);

  // La réponse en cours, dans la forme qu'impose le genre de la question.
  let choixUnique = $state<number | null>(null);
  let choixMultiples = $state<number[]>([]);
  let appariements = $state<Record<string, string>>({});

  const question = $derived(questions[rang]);
  const palier = $derived(prochainPalier(itemsReussisInitial + resultats.filter((r) => r.juste).length));

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
    const session = composerSession(phase, longueur);
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

  function estJuste(): boolean {
    const attendue = question.reponse;
    if (attendue.genre === 'unique') return choixUnique === attendue.bonne;
    if (attendue.genre === 'multiple') {
      const donnees = [...choixMultiples].sort((a, b) => a - b);
      const bonnes = [...attendue.bonnes].sort((a, b) => a - b);
      return donnees.length === bonnes.length && donnees.every((v, i) => v === bonnes[i]);
    }
    return attendue.gauche.every((clef) => appariements[clef] === attendue.paires[clef]);
  }

  function valider() {
    if (!repondu || corrige) return;
    resultats = [...resultats, { question, juste: estJuste() }];
    corrige = true;
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
      reinitialiserReponse();
      return;
    }
    await terminer();
  }

  async function terminer() {
    const secondes = Math.round((Date.now() - debut) / 1000);
    const reussis = resultats.filter((r) => r.juste).length;
    etape = 'bilan';

    try {
      await ajouterSessionRelationnelle({
        le: new Date().toISOString(),
        phase,
        items: resultats.map((r) => ({
          moteur: r.question.item.moteur,
          systeme: r.question.item.systeme,
          reussi: r.juste,
        })),
        tentes: resultats.length,
        reussis,
        secondes,
      });
      const gain = await gagnerXp(xpRelationnel(reussis, phase), {
        reponses: resultats.length,
        bonnes: reussis,
        secondes,
      });
      xpGagne = gain.xpGagne;
    } catch {
      // L'enregistrement peut échouer en navigation privée : la session reste
      // jouable et le bilan s'affiche, seul le suivi est perdu.
    }
  }

  const manques = $derived(resultats.filter((r) => !r.juste));
  const nomDeMoteur = (id: string) => id;
</script>

{#if etape === 'accueil'}
  <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
    <h2 class="font-semibold text-slate-900 dark:text-white">Choisir une session</h2>

    <fieldset class="mt-4">
      <legend class="text-sm font-medium text-slate-700 dark:text-slate-200">Phase</legend>
      <div class="mt-2 space-y-2">
        {#each jouables as p (p.numero)}
          <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3
            {phase === p.numero
              ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
              : 'border-slate-200 dark:border-slate-800'}">
            <input type="radio" bind:group={phase} value={p.numero} class="mt-1" />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 dark:text-white">
                Phase {p.numero} — {p.nom}
              </span>
              <span class="block text-xs text-slate-500 dark:text-slate-400">{p.resume}</span>
            </span>
          </label>
        {/each}
      </div>
      {#if jouables.length < PHASES.length}
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Les phases suivantes apparaîtront à mesure que leurs systèmes et leurs moteurs seront
          écrits.
        </p>
      {/if}
    </fieldset>

    <fieldset class="mt-4">
      <legend class="text-sm font-medium text-slate-700 dark:text-slate-200">Nombre d'items</legend>
      <div class="mt-2 flex gap-2">
        {#each [8, 12, 20] as n (n)}
          <button
            type="button"
            onclick={() => (longueur = n)}
            class="rounded-lg border px-4 py-2 text-sm font-medium
              {longueur === n
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300'}"
          >{n}</button>
        {/each}
      </div>
    </fieldset>

    {#if palier}
      <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Encore {palier.reste} item{palier.reste > 1 ? 's' : ''} réussi{palier.reste > 1 ? 's' : ''}
        pour ouvrir la phase {palier.phase.numero} — {palier.phase.nom}.
      </p>
    {/if}

    <button
      type="button"
      onclick={commencer}
      class="mt-5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
    >Commencer</button>
  </section>
{:else if etape === 'question' && question}
  <section>
    <div class="mb-4 flex items-center justify-between gap-4">
      <p class="text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
        {nomDeMoteur(question.item.moteur)}{question.second ? ' — second temps' : ''}
      </p>
      <p class="text-xs text-slate-500 dark:text-slate-400">{rang + 1} / {questions.length}</p>
    </div>

    <div class="h-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
      <div class="h-full bg-indigo-500 transition-all" style="width: {((rang) / questions.length) * 100}%"></div>
    </div>

    <h2 class="mt-5 font-semibold text-slate-900 dark:text-white">{question.consigne}</h2>

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
        Plusieurs réponses peuvent être correctes : cochez-les toutes.
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
      <div class="mt-5 rounded-lg border p-4 text-sm
        {dernier?.juste
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
          : 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30'}">
        <p class="font-semibold {dernier?.juste
          ? 'text-emerald-800 dark:text-emerald-200'
          : 'text-rose-800 dark:text-rose-200'}">
          {dernier?.juste ? 'Juste.' : 'Pas tout à fait.'}
        </p>
        <p class="mt-1 text-slate-700 dark:text-slate-300">{question.explication}</p>
      </div>
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
      {resultats.filter((r) => r.juste).length} réponse{resultats.filter((r) => r.juste).length > 1 ? 's' : ''}
      juste{resultats.filter((r) => r.juste).length > 1 ? 's' : ''} sur {resultats.length}.
      {#if xpGagne}<span class="font-medium text-indigo-700 dark:text-indigo-300">+{xpGagne} XP.</span>{/if}
    </p>

    {#if manques.length}
      <h3 class="mt-6 text-sm font-semibold text-slate-900 dark:text-white">
        Les {manques.length} item{manques.length > 1 ? 's' : ''} manqué{manques.length > 1 ? 's' : ''}
      </h3>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Revoir une explication juste après la session vaut mieux que la relire plus tard.
      </p>
      <ul class="mt-3 space-y-3">
        {#each manques as manque, i (i)}
          <li class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {manque.question.item.moteur} — {manque.question.item.systeme}
            </p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{manque.question.consigne}</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{manque.question.explication}</p>
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
