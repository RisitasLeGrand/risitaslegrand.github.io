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
 * ## Le prix de ce choix, et comment il est VRAIMENT payé depuis le 25 octobre
 *
 * Il faut tenir la promesse si l'on quitte : changer d'écran pendant le délai
 * doit exécuter l'action, plutôt que de la perdre.
 *
 * Ce fichier a longtemps prétendu que `pagehide` y suffisait. **C'était
 * faux**, et mesuré : on supprime une séance, on change d'écran dans les six
 * secondes, on revient — la séance est là. Une sonde a montré que `pagehide`
 * part bien et que l'action est bien lancée ; ce qui manquait était le TEMPS.
 * La suppression est une transaction IndexedDB, et la navigation démonte la
 * page avant qu'elle n'aboutisse. La promesse n'était pas mal câblée : elle
 * était impossible à tenir ainsi.
 *
 * Le remède, arbitré le 25 octobre : on écrit l'INTENTION au clic — quelques
 * millisecondes —, puis on exécute à l'échéance. Si la personne quitte avant,
 * l'intention est déjà en base, et le prochain démarrage l'applique avant
 * qu'aucun écran n'ait lu quoi que ce soit. `pagehide` reste, en meilleur
 * effort, mais ne garantit plus rien.
 *
 * Le registre des actions rejouables vit dans `annulation-intentions.ts` :
 * un écran ne passe plus une fermeture, il déclare un GENRE et une charge.
 * Deux chemins pour la même action — l'un pour l'écran ouvert, l'autre pour
 * le démarrage — finiraient par diverger.
 *
 * ## `aria-busy`, qui sert deux fois
 *
 * Le bandeau naît « occupé » et ne s'annonce prêt qu'une fois l'intention
 * écrite. Pour un lecteur d'écran, c'est la différence entre annoncer un
 * bandeau en cours d'installation et attendre qu'il soit là. Pour un essai,
 * c'est une POST-CONDITION : tant que l'attribut est posé, quitter l'écran ne
 * prouverait rien, puisque l'intention n'est pas encore en base.
 */
import {
  poserUneIntention,
  retirerUneIntention,
  appliquerUneIntention,
} from './annulation-intentions';
import type { GenreDIntention } from './noyau/annulation-en-attente';

/** Le plancher du prompt 41, précisé par le 43. On ne descend pas en dessous. */
const SECONDES_MINIMUM = 6;

export interface Annulable {
  /** Ce qui vient de se passer, au passé : « Séance supprimée ». */
  texte: string;
  /** Le genre d'action, au registre des intentions. */
  genre: GenreDIntention;
  /** Ce dont l'appliqueur a besoin, sérialisable et sans fonction. */
  charge: Record<string, unknown>;
  /**
   * Ce que l'écran repeint quand l'action est partie, écran ouvert.
   *
   * Appelé dans un `finally` : une écriture qui échoue doit tout de même
   * laisser l'écran dire la vérité. C'est le besoin qu'avait le suivi de
   * santé, dont le `agir` portait son propre `finally`.
   */
  apres?: () => Promise<void> | void;
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
 * **À attendre** : la promesse n'est tenue qu'une fois l'intention écrite, et
 * l'appelant ne doit pas rendre la main à la personne avant. Un second appel
 * exécute d'abord ce qui attendait : deux suppressions de suite ne doivent pas
 * s'annuler l'une l'autre par recouvrement du bandeau.
 */
export async function proposerLAnnulation(a: Annulable): Promise<void> {
  vider();

  const secondes = Math.max(SECONDES_MINIMUM, a.secondes ?? SECONDES_MINIMUM);
  document.getElementById(ID)?.remove();

  const bandeau = document.createElement('div');
  bandeau.id = ID;
  bandeau.className = 'bandeau-annulation barre-sure';
  /* `status` et non `alert` : c'est une information sur ce qui vient d'être
     fait, pas une erreur. `alert` interromprait la lecture en cours. */
  bandeau.setAttribute('role', 'status');
  /* Occupé tant que l'intention n'est pas en base — voir l'en-tête. */
  bandeau.setAttribute('aria-busy', 'true');

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

  /*
     L'INTENTION D'ABORD, LE MINUTEUR ENSUITE.

     Le délai ne commence qu'une fois la promesse tenable. Les quelques
     millisecondes d'écriture s'ajoutent donc aux six secondes, ce qui va dans
     le bon sens : le plancher est un minimum.

     Si l'écriture échoue — coffre fermé, base pleine —, on ne renonce pas à
     l'annulation : on garde le bandeau et le délai, c'est-à-dire le
     comportement d'avant ce lot. Ce qui n'est alors plus garanti est la seule
     moitié que l'intention apportait : quitter l'écran pendant le délai perd
     l'action. C'est dit en console plutôt qu'avalé, et ce n'est pas dit à
     l'écran — une phrase sur un mécanisme interne, au moment où l'on vient de
     supprimer quelque chose, inquiéterait sans rien offrir à faire.
  */
  const echeanceLe = new Date(Date.now() + secondes * 1000).toISOString();
  let idIntention: string | null = null;
  try {
    idIntention = await poserUneIntention(a.genre, a.charge, echeanceLe);
  } catch (erreur) {
    console.warn(
      'L’intention d’annulation n’a pas pu être écrite : quitter l’écran pendant le délai ' +
        'perdra cette action.',
      erreur,
    );
  }
  bandeau.removeAttribute('aria-busy');

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
    /*
       L'ACTION PASSE PAR LE REGISTRE, et non par une fermeture de l'écran :
       c'est la même table qui agira au démarrage suivant si l'on quitte
       maintenant. Une seule source de vérité pour une seule action.
    */
    void (async () => {
      try {
        await appliquerUneIntention(a.genre, a.charge);
        if (idIntention) await retirerUneIntention(idIntention);
      } finally {
        await a.apres?.();
      }
    })();
  };

  const minuteur = window.setTimeout(partir, secondes * 1000);
  courant = { minuteur, partir };

  annuler.addEventListener('click', () => {
    fermer();
    void (async () => {
      /* L'intention part AVANT de repeindre : si la page se ferme entre les
         deux, mieux vaut une intention retirée et un écran en retard qu'une
         intention restée qui s'appliquerait au démarrage. */
      if (idIntention) await retirerUneIntention(idIntention).catch(() => {});
      await a.defaire?.();
    })();
  });

  /* Quitter n'annule pas : l'action part tout de suite, en meilleur effort.
     Ce qui la garantit désormais est l'intention écrite plus haut. */
  addEventListener('pagehide', vider);
}

/** Y a-t-il une action en attente ? Pour les essais, et pour les écrans qui
 *  veulent éviter d'en lancer deux. */
export const uneAnnulationEnAttente = (): boolean => courant !== null;
