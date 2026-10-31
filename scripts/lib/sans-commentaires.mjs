/**
 * Blanchir les commentaires d'une source, en gardant les positions.
 *
 * ## Pourquoi cette règle est partagée, et non recopiée
 *
 * Elle est née dans « essais:erreurs-dites » le 25 octobre, après qu'un
 * commentaire de « sport/seance.astro » eut fait crier au loup un balayage qui
 * lisait ligne à ligne. Le même soir, « essais:manifeste-filtre » s'est fait
 * prendre par la même chose : un commentaire de « planification.ts » qui écrit
 * « chargerManifeste() » pour EXPLIQUER qu'il ne l'appelle plus était compté
 * comme un appel.
 *
 * Deux balayages, le même besoin, le même piège. Une règle recopiée finit par
 * diverger — c'est la leçon des cinq lecteurs du mot de passe de ce matin —
 * donc elle vit ici une fois.
 *
 * ## Ce qu'elle fait, et ce qu'elle ne fait pas
 *
 * Elle blanchit « // » jusqu'au bout de la ligne, et les blocs « /* *\/ » et
 * « <!-- --> », en gardant les positions : les numéros de ligne restent justes.
 *
 * Elle ne blanchit PAS les chaînes de caractères. Une chaîne qui contiendrait
 * le motif cherché mériterait d'être regardée de toute façon.
 *
 * Et elle ne tombe pas dans l'angle mort inverse : du vrai code posé APRÈS la
 * fermeture d'un commentaire, sur la même ligne, est bien rendu.
 */
export function sansCommentaires(source) {
  const sortie = [];
  let ligne = '';
  let i = 0;
  let bloc = false;
  let chaine = false;

  const pousser = (c) => {
    if (c === '\n') {
      sortie.push(ligne);
      ligne = '';
    } else ligne += c;
  };

  while (i < source.length) {
    const c = source[i];
    const deux = source.slice(i, i + 2);

    if (bloc) {
      const fin = bloc === 'js' ? deux === '*/' : source.slice(i, i + 3) === '-->';
      if (fin) {
        const n = bloc === 'js' ? 2 : 3;
        for (let k = 0; k < n; k += 1) pousser(' ');
        i += n;
        bloc = false;
        continue;
      }
      pousser(c === '\n' ? '\n' : ' ');
      i += 1;
      continue;
    }

    if (chaine) {
      pousser(c);
      if (c === '\\') {
        if (source[i + 1] !== undefined) pousser(source[i + 1]);
        i += 2;
        continue;
      }
      if (c === chaine) chaine = false;
      i += 1;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      chaine = c;
      pousser(c);
      i += 1;
      continue;
    }
    if (deux === '/*') {
      bloc = 'js';
      pousser(' ');
      pousser(' ');
      i += 2;
      continue;
    }
    if (source.slice(i, i + 4) === '<!--') {
      bloc = 'html';
      for (let k = 0; k < 4; k += 1) pousser(' ');
      i += 4;
      continue;
    }
    if (deux === '//') {
      while (i < source.length && source[i] !== '\n') {
        pousser(' ');
        i += 1;
      }
      continue;
    }
    pousser(c);
    i += 1;
  }
  sortie.push(ligne);
  return sortie;
}
