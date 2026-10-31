/**
 * « Afficher » sur un champ de mot de passe (D3 du prompt 43).
 *
 * ## Le défaut, et pourquoi il coûte plus cher ici qu'ailleurs
 *
 * Huit écrans demandent un mot de passe, et aucun ne permettait de le relire.
 * Sur un téléphone, une phrase de passe longue se tape à l'aveugle : on se
 * trompe, le site répond « mot de passe incorrect », et rien ne dit *où* on
 * s'est trompé. Le remède habituel est d'en choisir une courte, c'est-à-dire
 * d'affaiblir le coffre pour pouvoir le saisir — l'absence de ce bouton est
 * donc un défaut de sécurité, pas seulement de confort.
 *
 * ## Ce que ce module ne touche pas (interdit 1 du 43)
 *
 * Ni la logique, ni le format, ni la dérivation, ni le verrouillage. Il ne lit
 * jamais la valeur du champ, ne la copie nulle part, et ne garde aucun état
 * entre deux pages : il ne change que l'attribut `type` d'un champ, ce que le
 * navigateur fait de lui-même sur un gestionnaire de mots de passe. Un champ
 * déjà équipé est laissé tel quel, pour qu'un appel en double ne pose pas deux
 * boutons.
 *
 * ## Le bouton, et les trois choses que la décision impose
 *
 * `type="button"` — sans lui, le bouton valide le formulaire et la page
 * recharge au premier clic. `aria-pressed` — c'est un interrupteur, pas une
 * action : un lecteur d'écran doit pouvoir dire « enfoncé ». Et un libellé qui
 * **prévient** : « il deviendra lisible à l'écran » plutôt que « afficher »
 * tout court, parce qu'on appuie souvent dans un train.
 *
 * Le bouton se pose **à côté** du champ, dans une rangée, et non par-dessus :
 * un bouton superposé oblige à réserver une marge intérieure dans le champ, et
 * cette marge est précisément ce qui déborde à 360 px quand la largeur est
 * fixée en `w-56`. La rangée, elle, se rétrécit.
 */

/** Le libellé dit ce qui va se passer, et prévient de ce que ça expose. */
const LIBELLES = {
  afficher: 'Afficher le mot de passe : il deviendra lisible à l’écran',
  masquer: 'Masquer le mot de passe',
} as const;

const SVG = 'http://www.w3.org/2000/svg';

function trait(d: string): SVGPathElement {
  const chemin = document.createElementNS(SVG, 'path');
  chemin.setAttribute('d', d);
  return chemin;
}

/** L'œil, ouvert ou barré, au trait des autres icônes du site. */
function icone(visible: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'h-5 w-5');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.appendChild(trait('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z'));
  const pupille = document.createElementNS(SVG, 'circle');
  pupille.setAttribute('cx', '12');
  pupille.setAttribute('cy', '12');
  pupille.setAttribute('r', '3');
  svg.appendChild(pupille);
  /* Barré quand le mot de passe est lisible : l'icône dit ce que le bouton
     fera, et non l'état où l'on est — c'est la convention de tous les
     gestionnaires de mots de passe, et s'en écarter se paierait en clics. */
  if (visible) svg.appendChild(trait('M4 20 20 4'));
  return svg;
}

function peindre(bouton: HTMLButtonElement, visible: boolean): void {
  bouton.setAttribute('aria-pressed', String(visible));
  const libelle = visible ? LIBELLES.masquer : LIBELLES.afficher;
  bouton.setAttribute('aria-label', libelle);
  bouton.title = libelle;
  bouton.replaceChildren(icone(visible));
}

/**
 * Pose le bouton à côté d'un champ, et rend le bouton posé.
 *
 * Rend `null` si le champ en porte déjà un, ou s'il n'est pas dans le
 * document : un champ sans parent ne peut pas recevoir de rangée.
 */
export function poserLoeil(champ: HTMLInputElement): HTMLButtonElement | null {
  if (champ.dataset.oeil === 'pose' || !champ.parentNode) return null;
  champ.dataset.oeil = 'pose';

  const rangee = document.createElement('div');
  rangee.className = 'flex items-center gap-2';
  champ.parentNode.insertBefore(rangee, champ);
  rangee.appendChild(champ);

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className =
    'cible-tactile-pleine shrink-0 rounded-lg border border-slate-400 text-slate-600 ' +
    'transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 ' +
    'dark:hover:bg-slate-800';
  peindre(bouton, champ.type === 'text');
  bouton.addEventListener('click', () => {
    const visible = champ.type === 'password';
    champ.type = visible ? 'text' : 'password';
    peindre(bouton, visible);
    /* Le focus revient au champ, à la fin du texte : on appuie sur « Afficher »
       pour relire ce qu'on tape, et repartir au début serait une correction de
       plus à faire. */
    champ.focus();
    const fin = champ.value.length;
    champ.setSelectionRange?.(fin, fin);
  });
  rangee.appendChild(bouton);
  return bouton;
}

/**
 * Pose le bouton sur tous les champs de mot de passe d'une racine.
 *
 * Rend le nombre de champs équipés, pour qu'un appelant — ou un essai — puisse
 * constater qu'il n'en a oublié aucun. Idempotente.
 */
export function poserLesYeux(racine: ParentNode = document): number {
  let poses = 0;
  for (const champ of racine.querySelectorAll<HTMLInputElement>('input[type="password"]')) {
    if (poserLoeil(champ)) poses += 1;
  }
  return poses;
}
