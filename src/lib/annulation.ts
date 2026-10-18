/**
 * Le bandeau d'annulation (M6).
 *
 * ## La règle
 *
 * « Toute action destructrice ou de pointage s'annule depuis un bandeau en
 * bas, sans fenêtre de confirmation, pendant **au moins 6 secondes**. »
 *
 * ## Le choix qui compte : on retarde l'écriture, on ne la défait pas
 *
 * Deux façons d'offrir une annulation. Défaire après coup suppose de savoir
 * reconstruire ce qu'on a détruit — ce qui, pour une séance de sport avec ses
 * séries, ses instants et son identifiant, demanderait une fonction de
 * restauration qui n'existe pas, et qui se tromperait un jour.
 *
 * L'autre façon ne détruit rien avant la fin du délai : l'écran se vide tout
 * de suite, la suppression part à l'expiration. Annuler, c'est alors
 * simplement ne pas partir. Aucune donnée ne peut être perdue par un défaut
 * de reconstruction, puisqu'il n'y a rien à reconstruire.
 *
 * Le prix de ce choix est qu'il faut **tenir la promesse si l'on quitte** :
 * fermer l'onglet ou changer d'écran pendant le délai exécute l'action tout
 * de suite, plutôt que de la perdre. C'est ce que fait `pagehide`.
 */

/** Le plancher du prompt 41, précisé par le 43. On ne descend pas en dessous. */
const SECONDES_MINIMUM = 6;

export interface Annulable {
  /** Ce qui vient de se passer, au passé : « Séance supprimée ». */
  texte: string;
  /** L'action réelle, exécutée à l'expiration du délai. */
  agir: () => Promise<void> | void;
  /** Ce qu'il faut remettre à l'écran si la personne annule. */
  defaire?: () => Promise<void> | void;
  /** Au moins six. */
  secondes?: number;
}

const ID = 'bandeau-annulation';

/** Le délai en cours, s'il y en a un. */
let courant: { minuteur: number; partir: () => void } | null = null;

/** Exécute tout de suite ce qui attendait : on quitte, on ne perd pas. */
function vider(): void {
  courant?.partir();
}

/**
 * Montre le bandeau, et n'agit qu'à la fin du délai.
 *
 * Un second appel exécute d'abord ce qui attendait : deux suppressions de
 * suite ne doivent pas s'annuler l'une l'autre par recouvrement du bandeau.
 */
export function proposerLAnnulation(a: Annulable): void {
  vider();

  const secondes = Math.max(SECONDES_MINIMUM, a.secondes ?? SECONDES_MINIMUM);
  document.getElementById(ID)?.remove();

  const bandeau = document.createElement('div');
  bandeau.id = ID;
  bandeau.className = 'bandeau-annulation barre-sure';
  /* `status` et non `alert` : c'est une information sur ce qui vient d'être
     fait, pas une erreur. `alert` interromprait la lecture en cours. */
  bandeau.setAttribute('role', 'status');

  const texte = document.createElement('span');
  texte.className = 'bandeau-annulation-texte';
  texte.textContent = a.texte;

  const reste = document.createElement('span');
  reste.className = 'bandeau-annulation-reste';
  reste.setAttribute('aria-hidden', 'true');

  const annuler = document.createElement('button');
  annuler.type = 'button';
  annuler.className = 'bandeau-annulation-bouton cible-tactile';
  annuler.textContent = 'Annuler';

  bandeau.append(texte, reste, annuler);
  document.body.append(bandeau);

  let restant = secondes;
  reste.textContent = `${restant} s`;
  const tic = window.setInterval(() => {
    restant -= 1;
    reste.textContent = `${Math.max(0, restant)} s`;
  }, 1000);

  const fermer = () => {
    clearInterval(tic);
    window.clearTimeout(minuteur);
    removeEventListener('pagehide', vider);
    bandeau.remove();
    courant = null;
  };

  const partir = () => {
    fermer();
    void a.agir();
  };

  const minuteur = window.setTimeout(partir, secondes * 1000);
  courant = { minuteur, partir };

  annuler.addEventListener('click', () => {
    fermer();
    void a.defaire?.();
  });

  /* Quitter n'annule pas : l'action part tout de suite. */
  addEventListener('pagehide', vider);
}

/** Y a-t-il une action en attente ? Pour les essais, et pour les écrans qui
 *  veulent éviter d'en lancer deux. */
export const uneAnnulationEnAttente = (): boolean => courant !== null;
