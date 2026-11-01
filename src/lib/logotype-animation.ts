/**
 * LES TROIS ANIMATIONS D'ENTRÉE SOUMISES AU CHOIX (prompt 65 ter).
 *
 * Ce module est TEMPORAIRE, au même titre que `logotype-bis.ts` l'a été : il
 * porte trois propositions dont une seule survivra. Les deux autres seront
 * retirées quand Alexis aura choisi, et la retenue ira dans le composant.
 *
 * ## Ce qui est animé, et ce qui ne l'est pas
 *
 * **L'EN-TÊTE, oui. LE VOILE, NON** — et c'est une mesure qui l'a décidé.
 *
 * Le voile est l'image que le sélecteur d'applications garde en vignette ; sa
 * raison d'être est de ne rien livrer de l'écran qu'il cache. `voile.ts`
 * documente déjà que le système prend sa vignette quand il veut, et que rien
 * ne garantit que `visibilitychange` soit traité AVANT la capture : le voile
 * réduit la fenêtre, il ne la ferme pas.
 *
 * Mesuré ici, cinq tours : le voile est dans le DOM synchroniquement sur
 * l'événement, et à la PREMIÈRE trame peinte — 4 à 13 ms plus tard — il est
 * déjà dans son état final : opacité 1, aucune transformation, ZÉRO animation
 * en cours, pleine largeur. La fenêtre pendant laquelle la vignette pourrait
 * montrer un logo à moitié dessiné est donc aujourd'hui de zéro trame.
 *
 * Une animation d'entrée d'une seconde et demie la porterait à une centaine.
 * Je ne peux pas mesurer d'ici le moment où iOS prend sa capture, et je ne le
 * prétends pas — mais l'argument n'en a pas besoin : il est de DOMINATION
 * STRICTE. Aujourd'hui, si le voile gagne la course, la vignette montre le
 * logo entier. Avec une animation, la gagner ne suffirait plus.
 *
 * Le voile reste donc dans son état final, et l'animation ne se joue qu'à
 * l'ouverture de l'application, dans l'en-tête.
 *
 * ## Les règles que les trois respectent
 *
 * — une seule fois, jamais en boucle : un mouvement qui revient ressemblerait
 *   à un indicateur de chargement, le défaut qui a écarté l'anneau du 65 ;
 * — 900 ms au plus, soit bien en deçà du plafond d'une seconde et demie ;
 * — aucune variation brusque de luminance, aucun clignotement : les trois ne
 *   font que découvrir ou faire monter le dessin, par une courbe d'accélération
 *   unique et monotone ;
 * — aucun décalage de mise en page : `clip-path`, `opacity` et `transform` ne
 *   participent pas à la mise en page, et la place est de toute façon réservée
 *   par le `viewBox` ;
 * — l'état final est IDENTIQUE au logo statique : c'est l'état naturel de
 *   l'élément, et c'est ce qui rend `prefers-reduced-motion` trivial. Les trois
 *   emploient pour cela `backwards` et NON `both`, et c'est une garde qui l'a
 *   imposé : avec `both`, la dernière image reste appliquée pour toujours —
 *   « horizon » gardait un `clip-path: inset(0 0 0 0)` et « levée » une matrice
 *   identité. Invisibles à l'œil, mais ce sont des propriétés qui créent un
 *   bloc conteneur et un contexte d'empilement, de quoi rogner un jour un
 *   contour de focus. Avec `backwards`, l'élément revient à son état naturel
 *   dès l'animation finie, et il n'y a donc littéralement rien à retirer ;
 * — rien ne bloque l'interaction : aucun élément n'est ajouté au-dessus, et
 *   `pointer-events` n'est pas touché ;
 * — rien ne change de ce qui est lu : l'animation ne porte que sur des
 *   propriétés de peinture, l'`aria-label` et le rôle sont intacts, et aucun
 *   élément focusable n'est créé.
 *
 * ## `prefers-reduced-motion`
 *
 * `animation: none`, et rien d'autre. Comme l'état final EST l'état naturel de
 * l'élément — les trois animations partent d'un état artificiel pour y revenir
 * —, supprimer l'animation rend le logo final directement, sans scintillement
 * ni état transitoire. C'est la raison pour laquelle aucune des trois ne pose
 * son état final dans une règle : il n'y aurait alors plus rien à retirer.
 */

export type AnimationLogotype = 'horizon' | 'maree' | 'levee';

export const ANIMATIONS: { id: AnimationLogotype; nom: string; quoi: string }[] = [
  {
    id: 'horizon',
    nom: 'A · l’horizon',
    quoi: 'le mot se découvre de gauche à droite, comme une côte qui sort de la brume',
  },
  {
    id: 'maree',
    nom: 'B · la marée',
    quoi: 'chaque lettre monte à sa place à son tour, de gauche à droite',
  },
  {
    id: 'levee',
    nom: 'C · la levée',
    quoi: 'le mot entier paraît en montant de quelques pixels — le plus sobre',
  },
];

/**
 * La feuille de style des trois propositions.
 *
 * Elle est écrite ici en une seule chaîne pour que la planche et le site
 * montrent exactement la même chose — la leçon du 65, où recopier le balisage
 * aurait fait choisir sur une image qui n'était pas celle qu'on livre.
 *
 * Aucun script : ce sont des animations CSS, posées par un attribut. La
 * politique de sécurité du site n'a rien à autoriser de nouveau.
 */
export const CSS_ANIMATIONS = `
/* La même courbe pour les trois : sortie douce, sans rebond ni surcourse —
   un dépassement ferait osciller le mot, donc ressembler à un mouvement qui
   se répète. */
@keyframes logo-horizon {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}
@keyframes logo-maree {
  from { opacity: 0; transform: translateY(14%); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes logo-levee {
  from { opacity: 0; transform: translateY(22%); }
  to   { opacity: 1; transform: translateY(0); }
}

[data-logo-anime='horizon'] svg {
  animation: logo-horizon 900ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
}
[data-logo-anime='levee'] svg {
  animation: logo-levee 620ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
}
/* « marée » anime chaque lettre : le retard vient d'une variable posée sur
   le nœud, et non d'une liste de « nth-child », pour que le nombre de lettres
   ne soit écrit nulle part. */
[data-logo-anime='maree'] tspan {
  animation: logo-maree 420ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
  animation-delay: calc(var(--rang, 0) * 58ms);
  transform-box: fill-box;
  transform-origin: center;
}

/* RIEN, et l'état final est l'état naturel : il n'y a donc rien à rétablir. */
@media (prefers-reduced-motion: reduce) {
  [data-logo-anime] svg,
  [data-logo-anime] tspan {
    animation: none !important;
  }
}
`;

/**
 * « Marée » découpe le mot en `<tspan>`, À L'INTÉRIEUR du `<text>` d'origine.
 *
 * ## Ce que cela change, et ce que cela ne change pas
 *
 * RIEN du dessin. Le `<text>` garde son `textLength` et son `lengthAdjust`, et
 * ce sont eux qui placent les lettres : les `<tspan>` n'ont pas de `x` à eux,
 * ils héritent de la composition du parent. La géométrie finale est donc
 * RIGOUREUSEMENT celle du logo statique, au pixel près — ce qui est la
 * condition qu'on s'est donnée pour toutes les propositions.
 *
 * ## Et ce que j'ai dû jeter pour en arriver là
 *
 * Ma première version séparait le mot en huit `<text>` distincts, chacun placé
 * au centre d'une cellule de largeur égale. Cela marchait — la vague traversait
 * le mot — mais la planche l'a montré sans appel : l'espacement final était
 * FAUX. Un « I » occupait la même cellule qu'un « D », le « S » partait à la
 * dérive, « CY » se serrait. J'avais documenté ce compromis comme acceptable ;
 * l'image a dit le contraire, et c'est l'image qui avait raison.
 *
 * Les `<tspan>` l'annulent entièrement. Mesuré avant d'être écrit : Chrome
 * anime bien `opacity` et `transform` sur un `<tspan>` (avec
 * `transform-box: fill-box`), et les abscisses relevées — 0, 58, 120, 178,
 * 232, 295, 357, 411 — sont celles que `textLength` distribue, et non des
 * cellules régulières.
 *
 * Les trois propositions laissent donc le dessin livré intact : aucune ne
 * demande de changer `logotype.ts` si elle est retenue.
 */
export function enLettres(svg: string): string {
  const m = svg.match(/<text([^>]*)>([^<]*)<\/text>/);
  if (!m) return svg;
  const [entier, attributs, texte] = m;
  /*
     UN SEUL ATTRIBUT `style` PAR LETTRE, et c'est la garde de la planche qui
     l'a attrapé. Une version intermédiaire gardait le `style` du parent ET en
     ajoutait un second portant `--rang` : le parseur ne retient que le PREMIER
     et laisse tomber l'autre en silence. La variable n'arrivait jamais, toutes
     les lettres partageaient le même retard, et la sonde ne trouvait plus sa
     cible. Ici le `<tspan>` ne porte QUE `--rang` : le reste du style est sur
     le parent, où il doit être.
  */
  const lettres = [...texte]
    .map((lettre, i) => `<tspan style="--rang:${i}">${lettre}</tspan>`)
    .join('');
  return svg.replace(entier, `<text${attributs}>${lettres}</text>`);
}
