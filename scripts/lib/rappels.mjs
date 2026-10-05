/**
 * Résolution des « rappel de cours » d'une correction.
 *
 * ## Pourquoi un chemin dans le contenu, et un identifiant dans le site
 *
 * L'identifiant d'une fiche est un condensat de son chemin : opaque par
 * construction, pour ne rien révéler du programme révisé. Personne ne l'écrit
 * de mémoire. Dans le contenu, un rappel se désigne donc par le **chemin** de
 * la fiche sous « content/ », extension facultative — la seule désignation
 * qu'on puisse écrire à la main sans se tromper.
 *
 * Le site, lui, a besoin de l'identifiant pour fabriquer le lien, et du titre
 * pour le nommer : un condensat ne s'affiche pas.
 *
 * ## Et une référence qui ne désigne rien arrête le build
 *
 * Sans ce contrôle, un chemin mal orthographié donnerait un lien mort au moment
 * précis où il sert le plus : quand on vient de rater une question et qu'on
 * cherche le passage du cours. L'erreur doit tomber au build, seul endroit où
 * elle est encore réparable.
 */

/** Index des fiches par chemin, avec et sans l'extension « .md ». */
export function indexerFichesParChemin(fiches) {
  const index = new Map();
  for (const fiche of fiches) {
    index.set(fiche.chemin, fiche);
    index.set(fiche.chemin.replace(/\.md$/i, ''), fiche);
  }
  return index;
}

/**
 * Remplace, dans une correction, les chemins de `rappel_de_cours` par
 * `{ id, titre }`. Rend la liste des défauts — vide si tout s'est résolu.
 *
 * Mute la correction : elle vient d'être lue, et la recopier obligerait chaque
 * appelant à la réinsérer dans sa question.
 */
export function resoudreRappels(correction, index, ou) {
  if (!correction?.rappel_de_cours?.length) return [];
  const defauts = [];
  correction.rappel_de_cours = correction.rappel_de_cours.map((reference) => {
    if (reference && typeof reference === 'object' && 'id' in reference) return reference;
    const demande = String(reference)
      .trim()
      .replace(/^\.?\//, '')
      .replace(/\.md$/i, '');
    const fiche = index.get(demande);
    if (!fiche) {
      defauts.push(
        `${ou} : « rappel_de_cours: ${reference} » ne désigne aucune fiche. ` +
          'Attendu : le chemin sous « content/ », sans extension.',
      );
      return { id: '', titre: String(reference) };
    }
    return { id: fiche.id, titre: fiche.titre };
  });
  return defauts;
}
