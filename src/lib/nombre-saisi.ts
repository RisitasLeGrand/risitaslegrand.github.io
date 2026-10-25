/**
 * Lire un nombre tapé à la main (D4 du prompt 43).
 *
 * ## Le défaut
 *
 * Les champs décimaux — poids, taille, charge — étaient en `type="number"`.
 * Sur un clavier français, le pavé tactile propose la **virgule**, et un
 * `input[type=number]` la refuse : le champ reste vide, ou rend une chaîne
 * vide à la lecture, et `Number('')` vaut **zéro**. Une pesée à 72,5 kg
 * devenait donc une pesée à 0 kg, sans un mot. Le champ texte avec
 * `inputmode="decimal"` propose le même pavé et laisse passer les deux
 * séparateurs ; c'est au code de les lire.
 *
 * ## Pourquoi un seul analyseur
 *
 * Parce que trois lectures écrites à trois endroits divergent : l'une accepte
 * l'espace, l'autre non ; l'une rend `NaN`, l'autre `0`. Le prompt le dit —
 * « ils lisent avec le même analyseur partout ». L'argent garde le sien,
 * `centimesDe`, et c'est voulu : il compte en centimes entiers pour que
 * 1,15 € ne devienne pas 114,999…
 *
 * ## Ce qu'il rend, et ce qu'il refuse
 *
 * `null` sur une saisie vide **et** sur une saisie illisible. Les deux sont
 * une absence de nombre, et aucune des deux n'est un zéro : un zéro inventé
 * s'écrirait au journal comme une mesure réelle.
 */

/** Les espaces qu'un clavier ou un copier-coller sème dans un nombre. */
const ESPACES = /[\s  ]/g;

/**
 * Lit un nombre décimal saisi à la main.
 *
 * Accepte la virgule et le point, le signe en tête, et les espaces.
 * Rend `null` sur une saisie vide ou illisible — jamais `NaN`, jamais `0`.
 */
export function nombreDecimal(saisie: string): number | null {
  const net = saisie.replace(ESPACES, '').replace(',', '.');
  if (net === '') return null;
  /* La forme est contrôlée avant la conversion : `Number('0x1f')` vaut 31, et
     `Number('1e3')` mille — deux saisies que personne ne tape dans un champ de
     poids, et que personne n'a voulu écrire. */
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(net)) return null;
  return Number(net);
}

/**
 * Le même, mais borné : rend `null` hors des bornes.
 *
 * Les bornes viennent des attributs `data-min` et `data-max` du champ, là où
 * elles étaient `min` et `max` avant le passage en `type="text"` — un champ
 * texte les porterait sans les appliquer, ce qui est pire que de ne pas les
 * porter du tout.
 */
export function nombreDuChamp(champ: HTMLInputElement): number | null {
  const valeur = nombreDecimal(champ.value);
  if (valeur === null) return null;
  const min = nombreDecimal(champ.dataset.min ?? '');
  const max = nombreDecimal(champ.dataset.max ?? '');
  if (min !== null && valeur < min) return null;
  if (max !== null && valeur > max) return null;
  return valeur;
}
