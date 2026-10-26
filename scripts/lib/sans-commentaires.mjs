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
 *
 * ## Deux genres, et pourquoi il a fallu les distinguer — 26 octobre
 *
 * Pour savoir où s'arrête un commentaire, il faut savoir où commence une
 * chaîne ; et pour cela, il faut savoir dans quelle LANGUE on lit. Le
 * détecteur de désynchronisation d'`essais:accords` a mis deux angles morts au
 * jour, tous deux de cette nature :
 *
 * - dans un `.astro`, hors frontmatter et hors `<script>`, l'apostrophe de
 *   « Aujourd'hui » n'ouvre aucune chaîne : c'est une lettre. Prise pour un
 *   guillemet, elle faisait croire à une chaîne qui courait sur cent lignes,
 *   et les `/** …  *\/` de l'intervalle n'étaient plus blanchis — donc rendus
 *   comme du texte au balayage suivant, qui s'y perdait à son tour ;
 * - `.replace(/['’]/g, "'")` porte un guillemet DANS un motif. Même effet.
 *
 * D'où le `genre`, et la connaissance des littéraux `/…/`. Le genre `js` est
 * celui d'avant, pour une source franchement JavaScript ; le genre `balisage`
 * ne blanchit que les `<!-- -->` et ne voit de chaîne nulle part — c'est le
 * bon pour du balisage, dont les régions de code sont à découper d'abord.
 */
/**
 * Ce qui peut précéder une expression régulière, et jamais une division.
 *
 * Après une valeur — un nom, un nombre, `)`, `]` — un `/` divise. Après un
 * opérateur, une virgule, une ouverture, ou un `return`, il ouvre un motif.
 */
export const AVANT_UNE_REGEX =
  /(^|[([{,;:=!&|?+\-*%~^<>]|\b(?:return|typeof|case|in|of|new|delete|void|do|else|yield|await))\s*$/;

/**
 * La fin d'un littéral `/…/`, ou -1 si ce `/` n'en ouvrait pas un.
 *
 * Une classe `[…]` peut contenir un `/` sans refermer le motif, et un passage
 * à la ligne dit que ce n'était pas un motif : on rend la main plutôt que
 * d'avaler la suite du fichier.
 */
export function finDUneRegex(source, debut) {
  let j = debut + 1;
  let classe = false;
  while (j < source.length) {
    const d = source[j];
    if (d === '\\') {
      j += 2;
      continue;
    }
    if (d === '\n') return -1;
    if (classe) {
      if (d === ']') classe = false;
      j += 1;
      continue;
    }
    if (d === '[') classe = true;
    else if (d === '/') return j + 1;
    j += 1;
  }
  return -1;
}

export function sansCommentaires(source, genre = 'js') {
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

    if (genre === 'balisage') {
      /* Ni `//` ni `/* *\/` ni guillemet : dans du balisage, seul `<!-- -->`
         est un commentaire, et une apostrophe est une lettre. */
      if (source.slice(i, i + 4) === '<!--') {
        bloc = 'html';
        for (let k = 0; k < 4; k += 1) pousser(' ');
        i += 4;
        continue;
      }
      pousser(c);
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

    if (c === '/' && deux !== '//' && deux !== '/*') {
      const fin = AVANT_UNE_REGEX.test(source.slice(Math.max(0, i - 24), i))
        ? finDUneRegex(source, i)
        : -1;
      if (fin !== -1) {
        for (let k = i; k < fin; k += 1) pousser(source[k]);
        i = fin;
        continue;
      }
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
