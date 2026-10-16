/**
 * Ce qui ne sort jamais — amendement signé le 16 octobre 2026.
 *
 * ## Deux forces, et les confondre rouvrirait ce qui est fermé
 *
 * Le contrat de faits connaît déjà `sensible: true`, et huit types le
 * portent. Mais `sensible` veut dire « demande un geste délibéré » : les
 * faits de Psyché et de Finances sont sensibles **et** exportables, à la
 * case cochée près, et c'est voulu — l'export le dit lui-même, « rien ne
 * sort sans mon geste ».
 *
 * La décision signée dit autre chose, et plus fort : « **jamais** dans
 * les exports, "Demander à l'IA" ni les notifications ». Pas « sur
 * demande » : jamais. Si on avait fait porter cette interdiction par
 * `sensible`, deux choses seraient arrivées — ou bien Psyché et Finances
 * cessaient d'être exportables, ce que personne n'a décidé, ou bien
 * « jamais » devenait rouvrable par une case, ce que personne n'a
 * accordé non plus.
 *
 * D'où une liste séparée, courte et nommée, qui dit exactement ce que la
 * décision dit, et rien d'autre.
 *
 * ## Ce que la garde empêche, et ce qu'elle n'empêche pas
 *
 * Elle empêche ces types de **sortir** : export pour une IA, prompt de
 * « Demander à l'IA », centre de notifications. Elle n'empêche pas de les
 * calculer : la même décision les fait entrer dans les indicateurs et les
 * règles de désaccord, coffre ouvert. Sortir et calculer ne sont pas le
 * même geste, et c'est toute la décision.
 *
 * ## Pourquoi la garde est ici et non au point de production
 *
 * Même raison que le filtre de branches de l'export, et elle est déjà
 * écrite là-bas : « c'est l'export qui fait sortir les données, c'est
 * donc à lui de restreindre ». Une garde posée à la production
 * obligerait chaque nouveau consommateur à se souvenir ; posée à la
 * sortie, elle tient pour ceux qu'on n'a pas encore écrits.
 *
 * ## Un constat, dit plutôt que tu
 *
 * Le contrat affirme qu'« un type sensible est exclu par défaut du
 * partage, des prompts d'IA ». **Ce n'est pas vrai au point de sortie** :
 * la seule chose que `sensible` déclenche aujourd'hui est un
 * avertissement de relecture dans `permissions.ts`, et l'export ne
 * consulte pas le drapeau. La phrase décrit une intention, pas un
 * mécanisme. Rien n'a fuité jusqu'ici parce qu'aucun fait sensible du
 * domaine Corps n'était publié ; ce module est écrit avant qu'ils le
 * soient, et pas après.
 */

/**
 * Les types de faits qui ne sortent jamais, quelle que soit la case cochée.
 *
 * Exactement les deux que la décision nomme. Y ajouter un type est un
 * geste qui se décide, pas qui se déduit : la liste est courte pour
 * qu'une relecture la lise en entier.
 */
export const TYPES_JAMAIS_PARTAGES: readonly string[] = [
  'odyssee.medicament',
  'odyssee.statut-hormonal',
];

/** Ce type a-t-il le droit de sortir ? */
export const peutSortir = (type: string): boolean => !TYPES_JAMAIS_PARTAGES.includes(type);

/**
 * Retire d'une liste de faits ceux qui ne sortent jamais.
 *
 * Générique sur la forme : tout ce qui porte un `type` passe, parce que
 * les points de sortie manipulent des objets de formes différentes — des
 * faits, des évaluations, des lignes de série — et qu'une fonction par
 * forme ferait autant d'occasions d'en oublier une.
 */
export const retirerCeQuiNeSortPas = <T extends { type: string }>(
  elements: readonly T[],
): T[] => elements.filter((e) => peutSortir(e.type));
