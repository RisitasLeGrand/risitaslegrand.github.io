/**
 * Chargement d'une page : barre de progression et garde-fou.
 *
 * Un seul module pilote les deux, pour qu'ils ne puissent pas diverger :
 * la barre avance parce que le déchiffrement est en cours, atteint 100 % parce
 * qu'il a réellement abouti, et vire à la couleur d'erreur parce qu'il a échoué
 * ou dépassé le délai — jamais sur un minuteur indépendant.
 *
 * Les pages n'appellent qu'une fonction : « auDeverrouillage ».
 */
import { quandDeverrouille } from './auth';

/** Au-delà de ce délai, on cesse de faire patienter et on explique. */
const DELAI_MAX_MS = 5000;

/* ══════════════════════════════════════════════════════════════════════════
   Barre de progression
   ══════════════════════════════════════════════════════════════════════════ */

let barre: HTMLElement | null = null;
let jauge: HTMLElement | null = null;
let minuterie: number | null = null;
let avancement = 0;

function elements() {
  barre ??= document.getElementById('barre-progression');
  jauge ??= document.getElementById('barre-progression-jauge');
  return barre && jauge;
}

function poser(valeur: number) {
  avancement = Math.max(0, Math.min(100, valeur));
  if (!elements()) return;
  /* Une transformation, plus une largeur : animer « width » recalculait la mise
     en page à chaque image, ce que l'interdit n° 4 du prompt 34 proscrit. La
     logique d'avancement, elle, ne change pas (arbitrage du 14 octobre, point 4). */
  jauge!.style.transform = `scaleX(${avancement / 100})`;
  barre!.setAttribute('aria-valuenow', String(Math.round(avancement)));
}

function stopper() {
  if (minuterie !== null) {
    clearInterval(minuterie);
    minuterie = null;
  }
}

/**
 * Démarre la barre.
 *
 * Le déchiffrement est global : le navigateur ne peut pas en mesurer
 * l'avancement réel. On simule donc une montée qui ralentit — rapide au début,
 * asymptotique vers 90 % — plutôt qu'une progression linéaire qui mentirait sur
 * le temps restant. Les 10 derniers pour cent ne sont franchis que lorsque le
 * contenu est vraiment prêt.
 */
export function demarrerChargement() {
  if (!elements()) return;
  stopper();
  barre!.dataset.etat = 'en-cours';
  barre!.removeAttribute('hidden');
  poser(avancement > 0 && avancement < 90 ? avancement : 8);

  minuterie = window.setInterval(() => {
    const reste = 90 - avancement;
    if (reste <= 0.5) return;
    poser(avancement + Math.max(0.4, reste * 0.08));
  }, 180);
}

/** Le contenu est affiché : on complète, puis on efface en fondu. */
export function terminerChargement() {
  if (!elements()) return;
  stopper();
  poser(100);
  barre!.dataset.etat = 'termine';
  window.setTimeout(() => {
    if (barre?.dataset.etat !== 'termine') return; // un autre chargement a repris
    barre.setAttribute('hidden', '');
    poser(0);
  }, 450);
}

/** Le chargement a échoué : la barre se fige et change d'aspect. */
export function echecChargement() {
  if (!elements()) return;
  stopper();
  barre!.dataset.etat = 'erreur';
  barre!.removeAttribute('hidden');
}

/* ══════════════════════════════════════════════════════════════════════════
   Garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

const MESSAGES: Record<string, string> = {
  delai:
    "Le déchiffrement n'a pas abouti dans le délai attendu. " +
    'La page est peut-être encore en train de se charger ; sinon, réessayez.',
  echec: 'Le contenu de cette page n\'a pas pu être déchiffré.',
};

/** Remplace la zone d'attente par un message d'erreur et un bouton de reprise. */
function afficherErreur(zone: HTMLElement, cause: 'delai' | 'echec', detail: string, reprendre: () => void) {
  zone.classList.remove('hidden');
  zone.innerHTML = '';

  const panneau = document.createElement('div');
  panneau.className =
    'mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center dark:border-red-900 dark:bg-red-950/40';
  panneau.setAttribute('role', 'alert');

  const titre = document.createElement('p');
  titre.className = 'font-semibold text-red-800 dark:text-red-200';
  titre.textContent = cause === 'delai' ? 'Chargement interrompu' : 'Déchiffrement impossible';

  const texte = document.createElement('p');
  texte.className = 'mt-2 text-sm text-red-700 dark:text-red-300';
  texte.textContent = MESSAGES[cause];

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className =
    'mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700';
  bouton.textContent = 'Réessayer';
  bouton.addEventListener('click', reprendre);

  panneau.append(titre, texte, bouton);

  if (detail) {
    const technique = document.createElement('p');
    technique.className = 'mt-3 text-xs break-words text-red-600/80 dark:text-red-400/80';
    technique.textContent = detail;
    panneau.appendChild(technique);
  }

  zone.appendChild(panneau);
}

interface Options {
  /** Sélecteur de la zone d'attente à remplacer en cas d'échec. */
  zoneChargement?: string;
  /** Délai au-delà duquel on affiche l'erreur, en millisecondes. */
  delaiMax?: number;
}

/**
 * Exécute le rendu d'une page dès que la session est ouverte, avec barre de
 * progression et garde-fou.
 *
 * Trois issues possibles, et aucune ne laisse l'écran d'attente figé :
 *  • « travail » aboutit          → la barre se complète et disparaît ;
 *  • « travail » échoue           → message d'erreur et bouton « Réessayer » ;
 *  • « travail » dépasse le délai → même chose, avec un message distinct. Si le
 *    travail finit malgré tout par aboutir, l'erreur s'efface d'elle-même.
 */
export function auDeverrouillage(travail: () => void | Promise<void>, options: Options = {}) {
  const { zoneChargement = '#chargement', delaiMax = DELAI_MAX_MS } = options;

  /*
     LE COMPTEUR DE VISITES S'ACCROCHE ICI (prompt 43, lot I, point 1).

     Le point naturel serait la mise en page, d'où part déjà l'enregistreur
     d'usage — et il est hors de portée de ce lot. Celui-ci en vaut un autre,
     et il a même une propriété que l'autre n'a pas : il se déclenche quand la
     SESSION est ouverte, donc jamais pour quelqu'un qui arrive sur l'écran de
     mot de passe et s'en va. Une arrivée n'est pas une visite.

     Cinquante-quatre écrans sur cinquante-neuf appellent cette fonction. Les
     cinq autres sont `404`, `hors-ligne`, `mot-de-passe-perdu` et
     `coffre/bascule` — des écrans d'erreur ou d'avant-ouverture, où compter
     n'aurait pas de sens — et `notifications`, qui appelle le compteur
     directement.

     L'import est dynamique et l'échec est avalé : un compteur ne doit jamais
     retarder ni casser l'écran qu'il compte.
  */
  void import('./visites')
    .then(({ compterLaVisite, routeDe }) =>
      compterLaVisite(routeDe(location.pathname, import.meta.env.BASE_URL ?? '/')),
    )
    .catch(() => {});

  const lancer = () => {
    const zone = document.querySelector<HTMLElement>(zoneChargement);
    demarrerChargement();

    let acheve = false;
    let expire: number | null = null;

    const nettoyer = () => {
      acheve = true;
      if (expire !== null) clearTimeout(expire);
    };

    if (zone) {
      expire = window.setTimeout(() => {
        if (acheve) return;
        echecChargement();
        afficherErreur(zone, 'delai', '', lancer);
      }, delaiMax);
    }

    Promise.resolve()
      .then(travail)
      .then(() => {
        nettoyer();
        terminerChargement();
        /*
           Masquer la zone d'attente **ici**, et non dans chaque page.
           
           Elle n'était retirée que par les pages qui y pensaient : vingt-cinq
           le faisaient, quatorze l'avaient oublié, et leur « Lecture des
           programmes… » restait au-dessus d'un contenu pourtant rendu. Mesuré
           le 13 octobre sur les quatorze, dix secondes après le chargement.
           
           Un contrat que la moitié des appelants oublie n'est pas un contrat,
           c'est un piège : il appartient au mécanisme. Les pages qui le font
           déjà ne changent pas de comportement — masquer deux fois ne coûte
           rien —, et l'échec continue d'écrire dans la zone plutôt que de la
           masquer, puisque c'est là qu'on doit lire pourquoi.
        */
        zone?.classList.add('hidden');
      })
      .catch((erreur: unknown) => {
        nettoyer();
        echecChargement();
        const detail = erreur instanceof Error ? erreur.message : String(erreur);
        console.error('Rendu de la page impossible :', erreur);
        if (zone) afficherErreur(zone, 'echec', detail, lancer);
      });
  };

  quandDeverrouille(lancer);
}
