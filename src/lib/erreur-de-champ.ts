/**
 * Dire une erreur **au pied du champ** (D2 du prompt 43).
 *
 * ## Le défaut
 *
 * Les erreurs de saisie partaient dans une bulle au bas de l'écran, ou nulle
 * part. Une bulle est au mauvais endroit — elle s'affiche loin du champ
 * fautif, puis s'efface —, et elle ne dit jamais *quel* champ. Sur un
 * formulaire de quatre champs, « date invalide » oblige à deviner.
 *
 * ## Ce que ce module pose, et pourquoi chaque pièce compte
 *
 * - **La zone de message**, juste après le champ, avec `role="alert"` : elle
 *   est annoncée dès qu'elle reçoit du texte, sans déplacer le focus.
 * - **`aria-invalid`** : sans lui, un lecteur d'écran annonce un champ
 *   ordinaire, et la personne ne sait pas qu'elle doit y revenir.
 * - **`aria-describedby`** : il relie le message au champ. C'est lui qui fait
 *   la différence entre « il y a un message quelque part » et « ce champ-ci
 *   porte ce message-ci ».
 *
 * ## La validation à la SORTIE du champ, jamais pendant la frappe
 *
 * C'est la décision 2 du prompt. Valider à chaque touche reproche une erreur
 * à quelqu'un qui n'a pas fini de taper : « 7 » n'est pas un poids invalide,
 * c'est le début de « 72,5 ». L'erreur s'efface en revanche **dès la
 * correction**, pendant la frappe : effacer un reproche tout de suite ne
 * coûte rien à personne.
 *
 * ## Ce qu'on n'affiche jamais
 *
 * Le texte brut d'une `Error`. Il nomme des fonctions, parfois des clés, et
 * n'apprend rien à qui lit. Les appelants passent une phrase ; `direLEchec`
 * est là pour les cas où l'on n'a qu'une exception sous la main, et il rend
 * une phrase à la place.
 */

import { messageDUneErreur } from './agir';

/** Le préfixe des zones de message, pour les retrouver sans les confondre. */
const PREFIXE = 'erreur-de-champ-';

function zoneDe(champ: HTMLElement, creer: boolean): HTMLElement | null {
  const identifiant = champ.id || champ.getAttribute('name') || '';
  const cle = `${PREFIXE}${identifiant}`;
  const existante = identifiant ? document.getElementById(cle) : null;
  if (existante || !creer) return existante;

  const zone = document.createElement('p');
  if (identifiant) zone.id = cle;
  zone.setAttribute('role', 'alert');
  zone.className = 'mt-1 text-sm text-rose-700 dark:text-rose-300';
  /*
     Après la RANGÉE du champ quand il y en a une — celle que « Afficher »
     pose sur les mots de passe —, et sinon après le champ lui-même : un
     message glissé dans une rangée en « flex » se mettrait à côté du champ au
     lieu de se mettre dessous.
  */
  const rangee = champ.parentElement;
  const ancre = rangee?.classList.contains('flex') ? rangee : champ;
  ancre.parentNode?.insertBefore(zone, ancre.nextSibling);
  return zone;
}

/** Dit l'erreur sous le champ, et relie les deux. */
export function direLErreur(champ: HTMLElement, message: string): void {
  const zone = zoneDe(champ, true);
  if (!zone) return;
  zone.textContent = message;
  champ.setAttribute('aria-invalid', 'true');
  if (zone.id) {
    const decrit = (champ.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((x) => x && x !== zone.id);
    champ.setAttribute('aria-describedby', [...decrit, zone.id].join(' '));
  }
}

/** Efface l'erreur d'un champ, et le rend valide aux yeux des lecteurs. */
export function effacerLErreur(champ: HTMLElement): void {
  const zone = zoneDe(champ, false);
  if (zone) {
    zone.textContent = '';
    const decrit = (champ.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((x) => x && x !== zone.id);
    if (decrit.length) champ.setAttribute('aria-describedby', decrit.join(' '));
    else champ.removeAttribute('aria-describedby');
  }
  champ.removeAttribute('aria-invalid');
}

/** Le champ porte-t-il une erreur affichée ? */
export function enErreur(champ: HTMLElement): boolean {
  return champ.getAttribute('aria-invalid') === 'true';
}

/**
 * Branche la validation d'un champ : à la sortie, et l'effacement à la
 * correction.
 *
 * `controle` rend `null` quand tout va bien, ou la phrase à afficher. Elle
 * dit **comment corriger**, et non ce qui est faux : « Un poids entre 20 et
 * 400 kg, avec une virgule si besoin » plutôt que « valeur invalide ».
 */
export function validerALaSortie(
  champ: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  controle: (valeur: string) => string | null,
): void {
  champ.addEventListener('blur', () => {
    const souci = controle(champ.value);
    if (souci) direLErreur(champ, souci);
    else effacerLErreur(champ);
  });
  champ.addEventListener('input', () => {
    /* Pendant la frappe, on n'ajoute jamais d'erreur ; on en retire une dès
       qu'elle cesse d'être vraie. */
    if (enErreur(champ) && controle(champ.value) === null) effacerLErreur(champ);
  });
}

/**
 * Valide un formulaire entier à l'envoi, et **emmène le focus** au premier
 * champ fautif.
 *
 * Rend `true` quand tout passe. La saisie n'est jamais touchée : aucun champ
 * n'est vidé, aucune valeur n'est réécrite — c'est l'autre moitié de D2, et
 * c'est celle qu'on oublie, parce qu'elle ne se voit que le jour où l'on perd
 * dix lignes de texte.
 */
export function controlerAvantEnvoi(
  controles: readonly [
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    (valeur: string) => string | null,
  ][],
): boolean {
  let premier: HTMLElement | null = null;
  for (const [champ, controle] of controles) {
    const souci = controle(champ.value);
    if (souci) {
      direLErreur(champ, souci);
      premier ??= champ;
    } else {
      effacerLErreur(champ);
    }
  }
  premier?.focus();
  return premier === null;
}

/**
 * Dit un échec venu d'une exception, au pied du champ.
 *
 * ## Pourquoi ce n'est pas une phrase écrite ici
 *
 * J'avais d'abord remplacé le message de l'exception par une phrase à moi.
 * C'était une erreur, et c'est `agir.ts` qui me l'a montrée : le dépôt a déjà
 * tranché, et sa règle est plus fine que « jamais le texte d'une `Error` ».
 * Elle dit : jamais le texte brut **quand on sait faire mieux**, mais jamais
 * non plus une reformulation à la place d'un message de domaine — « Ce fichier
 * n'est pas une sauvegarde valide » est écrit exprès pour être lu, et le
 * remplacer par « une erreur est survenue » ferait perdre à la personne la
 * seule phrase qui lui apprenait quelque chose.
 *
 * `messageDUneErreur` applique cette règle : elle connaît le disque plein, et
 * remplace un message vide ou technique par une phrase utile. On l'emploie
 * plutôt que d'en écrire une seconde version ici.
 *
 * L'exception elle-même part dans la console, où elle sert à qui débogue.
 */
export function direLEchec(champ: HTMLElement, cause: unknown): void {
  console.warn('Échec sur un champ :', cause);
  direLErreur(champ, messageDUneErreur(cause));
}
