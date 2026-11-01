/**
 * Masque de débordement pour les rubans défilant horizontalement.
 *
 * Une barre de défilement sous une rangée d'icônes est une gêne : elle occupe
 * de la hauteur, tranche sur le fond et n'apprend rien que le contenu ne dise
 * déjà. On la masque donc, et on la remplace par un dégradé d'estompe aux
 * bords — du côté, et seulement du côté, où il reste quelque chose à voir.
 */

/** Tolérance d'arrondi : les largeurs sont fractionnaires après mise à l'échelle. */
const MARGE = 2;

/**
 * Pose sur l'élément un attribut « data-deborde » valant « aucun », « debut »,
 * « fin » ou « deux », que la feuille de style traduit en estompe.
 * Renvoie la fonction de mesure, au cas où l'appelant veuille la déclencher.
 */
export function masquerDebordement(element: HTMLElement) {
  const mesurer = () => {
    const avant = element.scrollLeft > MARGE;
    const apres = element.scrollLeft + element.clientWidth < element.scrollWidth - MARGE;
    element.dataset.deborde = avant && apres ? 'deux' : avant ? 'debut' : apres ? 'fin' : 'aucun';
  };

  element.addEventListener('scroll', mesurer, { passive: true });
  window.addEventListener('resize', mesurer);
  // Les polices et les emojis arrivent après le premier rendu et changent la
  // largeur du ruban : une simple mesure au chargement serait vite fausse.
  if ('ResizeObserver' in window) new ResizeObserver(mesurer).observe(element);

  mesurer();
  return mesurer;
}

/* ========================================================================
   La position de défilement rendue au retour (M5)
   ======================================================================== */

/**
 * Le défaut visé, mesuré le 18 octobre à 360 × 740.
 *
 *     liste               descendu   revenu
 *     /bibliotheque/         900       900     rendue
 *     /actualites/           900         0     PERDUE
 *     /quiz/                 900         0     PERDUE
 *     /progression/          900         0     PERDUE
 *     /statistiques/         900         0     PERDUE
 *
 * La cause n'est pas le navigateur : il restaure très bien, mais il le fait
 * **au moment où il rend la page**, c'est-à-dire avant que le script ait
 * reconstruit la liste. Le document ne fait alors que quelques centaines de
 * pixels, la position demandée est hors bornes, et le navigateur la rabat à
 * zéro — définitivement. `/bibliotheque/` s'en sortait parce qu'elle garde
 * une ossature de la bonne hauteur ; les quatre autres construisent tout.
 *
 * On reprend donc la restauration à la main (`scrollRestoration = 'manual'`)
 * et on la refait **chaque fois que la page grandit**, jusqu'à atteindre la
 * position voulue ou jusqu'à ce que la fenêtre de grâce expire.
 */

const CLE_DEFILEMENT = 'cyclades.defilement';
/** Au-delà, une liste qui n'a pas fini de se construire ne le fera plus. */
const GRACE_MS = 3000;

/** Les gestes qui rendent la main à la personne, et arrêtent la reprise. */
const GESTES = ['wheel', 'touchstart', 'keydown'] as const;

type Positions = Record<string, number>;

const lirePositions = (): Positions => {
  try {
    return JSON.parse(sessionStorage.getItem(CLE_DEFILEMENT) ?? '{}') as Positions;
  } catch {
    return {};
  }
};

const ecrirePositions = (p: Positions): void => {
  try {
    sessionStorage.setItem(CLE_DEFILEMENT, JSON.stringify(p));
  } catch {
    /* Navigation privée, quota : la position se perd, et c'est tout. */
  }
};

/** La clé d'un écran : son chemin et sa requête, jamais son fragment. */
const cleDeLEcran = (): string => location.pathname + location.search;

/**
 * Repose la page à `cible`, et la maintient tant qu'elle se construit.
 *
 * **On ne s'arrête pas au premier succès**, et c'est la leçon de la mesure :
 * posée à 900 sur une page encore courte, la bibliothèque repartait seule à
 * 1 560 px. Ce n'est pas un bogue du code, c'est l'ancrage du défilement —
 * quand du contenu s'insère au-dessus du point de vue, le navigateur
 * descend la page d'autant pour ne pas faire sauter ce qu'on lit. Très bon
 * quand on lit, désastreux pendant une restauration, où le contenu inséré
 * au-dessus est justement celui qu'on avait déjà dépassé.
 *
 * Deux parades, et il faut les deux : `overflow-anchor: none` le temps de la
 * reprise, et la position reposée à **chaque** changement de hauteur jusqu'à
 * la fin de la fenêtre de grâce.
 *
 * Un geste de la personne l'emporte toujours : si elle défile elle-même, on
 * s'arrête net. Rien n'est plus désagréable qu'une page qui se reprend la
 * main sous le doigt.
 */
function rendreLaPosition(cible: number): void {
  let fini = false;
  const racine = document.documentElement;
  const ancrageInitial = racine.style.overflowAnchor;
  racine.style.overflowAnchor = 'none';

  const terminer = () => {
    if (fini) return;
    fini = true;
    racine.style.overflowAnchor = ancrageInitial;
    observateur?.disconnect();
    clearTimeout(minuteur);
    for (const e of GESTES) removeEventListener(e, abandonner);
  };

  function abandonner() {
    terminer();
  }

  const poser = () => {
    if (fini) return;
    const max = Math.max(0, racine.scrollHeight - window.innerHeight);
    // Le défilement doux est joli quand on clique un lien d'ancre ; ici il
    // ferait glisser la page sous les yeux à chaque agrandissement.
    const doux = racine.style.scrollBehavior;
    racine.style.scrollBehavior = 'auto';
    window.scrollTo(0, Math.min(cible, max));
    racine.style.scrollBehavior = doux;
  };

  for (const e of GESTES) addEventListener(e, abandonner, { passive: true });
  const minuteur = setTimeout(terminer, GRACE_MS);
  const observateur =
    'ResizeObserver' in window ? new ResizeObserver(() => poser()) : null;
  observateur?.observe(racine);
  poser();
}

/**
 * Branche la mémoire du défilement. À appeler une fois, dans la mise en page.
 */
export function brancherLeDefilement(): void {
  if (typeof window === 'undefined' || !('scrollRestoration' in history)) return;
  history.scrollRestoration = 'manual';

  /*
     On note sous DEUX clés, et la seconde n'est pas une précaution de
     confort. `/actualites/` se réécrit l'adresse après coup — elle devient
     `/actualites/?periode=2026-W40` — si bien que la position enregistrée
     sous l'une n'était jamais retrouvée sous l'autre, et que la liste
     revenait à zéro alors que tout le reste fonctionnait. Le chemin seul
     sert de repli : il vaut mieux rendre la position d'un autre filtre de la
     même liste que de la perdre.

     La clé est relue à chaque enregistrement, et non figée au branchement,
     pour la même raison.
  */
  /*
     ON NE LIT PLUS `window.scrollY` AU MOMENT DE PARTIR, ET C'EST LE POINT.

     `noter()` lisait la position à `pagehide`. Mesuré sur `/quiz/`, au
     pixel : la page faisait 1685 px et la position était à 900 ; à
     `pagehide`, la page ne faisait plus que 1462 px, et le navigateur avait
     donc rabattu la position à 722, soit 1462 − 740 exactement. C'est 722
     qui était enregistré, et 722 qui était rendu au retour — sur une page
     redevenue haute de 1685 px, où 900 était parfaitement atteignable.

     Le rabattement N'ÉMET AUCUN ÉVÉNEMENT de défilement : il a lieu pendant
     le démontage du document, quand les événements ne sont plus distribués.
     Une sonde posée avant les scripts de la page n'a vu qu'une seule entrée,
     900 sur 1685 px. On ne peut donc pas le rattraper après coup.

     La parade est de ne plus demander la position à l'instant le plus
     mauvais. `dernierY` suit le défilement tant que la page est VIVANTE, et
     c'est lui qu'on enregistre. Il ne coûte rien — une addition par
     événement, aucune écriture — et il porte la dernière position que la
     personne a réellement choisie, et non la dernière que le navigateur a
     tolérée.

     L'écriture reste groupée : à `pagehide`, à `visibilitychange`, et sur un
     minuteur de fin de geste, parce qu'une page peut aussi être tuée sans
     prévenir. Écrire à chaque événement de défilement coûterait un
     `JSON.parse` et un `JSON.stringify` par image.

     Ce défaut ne concernait pas que `/quiz/` : les cinq autres listes
     revenaient 25 à 60 px trop court, sous la tolérance de l'essai, pour la
     même raison et à une moindre hauteur près.
  */
  let dernierY = Math.round(window.scrollY);

  const noter = () => {
    const p = lirePositions();
    p[cleDeLEcran()] = dernierY;
    p[location.pathname] = dernierY;
    ecrirePositions(p);
  };

  /*
     Fin de geste : 400 ms après le dernier défilement. Une page tuée sans
     `pagehide` — onglet fermé de force, mémoire reprise par le système —
     garde ainsi la position d'il y a moins d'une demi-seconde.

     TOUT CECI EST DÉCLARÉ AVANT L'ÉCOUTE, ET CE N'EST PAS UN GOÛT DE MISE EN
     PAGE. Ma première écriture posait l'écoute du défilement d'abord, et
     « minuteurDEcriture » ensuite, en comptant sur la remontée des
     déclarations de fonction. Or `let` a une zone morte temporelle : un
     événement de défilement survenu entre les deux — le navigateur rend la
     position pendant l'exécution du script, cela arrive — aurait levé une
     ReferenceError au lieu de noter la position. Rare, et d'autant plus
     mauvais : on ne l'aurait jamais reproduit.
  */
  let minuteurDEcriture: ReturnType<typeof setTimeout> | undefined;
  function reporterLEcriture(): void {
    clearTimeout(minuteurDEcriture);
    minuteurDEcriture = setTimeout(noter, 400);
  }

  addEventListener(
    'scroll',
    () => {
      dernierY = Math.round(window.scrollY);
      reporterLEcriture();
    },
    { passive: true },
  );

  /* `pagehide` manque à l'appel sur iOS quand on bascule d'application ;
     `visibilitychange` le rattrape, et noter deux fois ne coûte rien. */
  addEventListener('pagehide', noter);
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') noter();
  });

  // Une ancre dans l'adresse a toujours raison : c'est une position demandée.
  if (location.hash) return;

  const entree = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (entree?.type !== 'back_forward') return;

  const memoire = lirePositions();
  const cible = memoire[cleDeLEcran()] || memoire[location.pathname];
  if (!cible) return;
  rendreLaPosition(cible);
}

/* ══════════════════════════════════════════════════════════════════════════
   Défiler en respectant le mouvement réduit (H2 du prompt 43)
   ══════════════════════════════════════════════════════════════════════════

   Six endroits faisaient glisser la page avec `behavior: 'smooth'`, et aucun
   ne consultait la préférence. Elle est pourtant respectée partout ailleurs —
   mais par la feuille de style, et un défilement demandé en JavaScript ne
   passe pas par elle. Il glissait donc quand même, et c'est précisément le
   mouvement que cette préférence vise : il déplace l'écran entier.

   Une fonction nommée, et non six `if` : le septième défilement serait reparti
   en `smooth`, parce que c'est la forme qu'on recopie en ajoutant un écran.

   Elle ne supprime pas le défilement, elle le rend **instantané**. La page va
   au même endroit ; seul le trajet disparaît. Un défilement supprimé laisserait
   la personne devant un écran qui n'a pas bougé, ce qui est une autre façon de
   la perdre.

   Ces fonctions vivent ici, avec le masque de débordement et la reprise de
   position : c'est le module du défilement, et il n'y a pas de raison d'en
   ouvrir un second.
*/

/**
 * Le mouvement est-il à réduire ? **Deux réglages, et non un.**
 *
 * Celui du système — `prefers-reduced-motion` — et celui de l'application,
 * porté par `data-animations` sur `<html>` (prompt 34). Ma première écriture
 * ne lisait que le premier, et `essais:mouvement-reduit` l'a refusée : il
 * tient une règle, qu'aucun lecteur ne connaisse un seul des deux. Elle est
 * juste. Quelqu'un qui coupe les animations dans Cyclades sans pouvoir le
 * faire dans son système — un ordinateur partagé, un téléphone de service —
 * aurait vu l'écran glisser quand même, et le réglage de l'application
 * n'aurait été qu'à moitié vrai.
 *
 * Lu à chaque appel, et non mis en cache : les deux se changent sans
 * recharger la page, et une valeur retenue au chargement serait fausse pour
 * le reste de la session. Le coût d'une lecture est nul devant un défilement.
 */
export function mouvementReduit(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return true;
    }
  } catch {
    /* Pas de `matchMedia` : on ne sait pas, et on ne présume pas d'une
       préférence qui protège quelqu'un. L'autre réglage, lui, se lit. */
  }
  try {
    return document.documentElement.getAttribute('data-animations') === 'reduites';
  } catch {
    return false;
  }
}

/** Le comportement à demander, selon la préférence. */
export const allureDuDefilement = (): ScrollBehavior => (mouvementReduit() ? 'auto' : 'smooth');

/**
 * Amène un élément à l'écran.
 *
 * `bloc` est la position visée, comme pour `scrollIntoView` : « start » pour
 * caler le haut, « center » pour centrer, « nearest » pour ne bouger que si
 * c'est nécessaire.
 */
export function defilerVers(cible: Element | null, bloc: ScrollLogicalPosition = 'start'): void {
  cible?.scrollIntoView({ block: bloc, behavior: allureDuDefilement() });
}

/** Remonte en haut de la page. */
export function defilerEnHaut(): void {
  window.scrollTo({ top: 0, behavior: allureDuDefilement() });
}

/* ══════════════════════════════════════════════════════════════════════════
   CE QUI EST COLLÉ EN HAUT, MESURÉ (E3)
   ══════════════════════════════════════════════════════════════════════════

   `global.css` réserve une bande en haut de la fenêtre pour qu'une ancre
   n'atterrisse pas derrière ce qui y est collé. Il lui faut deux hauteurs, et
   aucune des deux ne s'écrit en dur.

   L'EN-TÊTE, d'abord. Relevé au pixel : 103 px à 390 et 119 px à 1280 — celui
   de l'ORDINATEUR est le plus haut des deux, contrairement à ce qu'on suppose.
   Il change encore avec la taille de police du système et la longueur des
   libellés de branche. Les nombres écrits à la main qu'on a trouvés dans le
   dépôt — 6 rem pour les marges d'ancre, 57 px pour la bascule d'une fiche —
   étaient faux à l'une des deux largeurs, et souvent aux deux.

   LES BARRES PROPRES À UN ÉCRAN, ensuite. Deux écrans en ont une, collée sous
   l'en-tête : l'index alphabétique du glossaire et la bascule
   cours / fiche simplifiée. Elles portent la classe `sous-entete`, qui les
   pose au bas de l'en-tête, et leur hauteur s'ajoute à la bande réservée —
   sans quoi un saut vers une lettre ou vers un titre de cours atterrirait
   derrière elles. Sur téléphone, la bascule d'une fiche tient sur plusieurs
   rangées et descend à 171 px : ce n'est pas un détail.

   DEUX PROPRIÉTÉS, ET NON UNE, parce qu'elles ne répondent pas à la même
   question. `--haut-entete` dit où se pose une barre d'écran ; `--haut-colle`
   dit jusqu'où la fenêtre est barrée. Une seule aurait obligé chaque barre à
   se soustraire elle-même de la somme, ce qui est la façon la plus sûre de se
   tromper d'un cran.

   Ce réglage ne déplace rien à l'écran : `scroll-padding` n'intervient qu'au
   moment d'un défilement vers une cible. L'écrire, et le corriger après le
   premier rendu, ne peut donc pas décaler la page.
*/

/**
 * Mesure l'en-tête et les barres d'écran, et publie les deux hauteurs.
 *
 * À appeler une fois, dans la mise en page. Sans en-tête — `entete="aucun"` —
 * rien n'est écrit et la feuille de style garde ses valeurs de repli, ce qui ne
 * coûte rien puisqu'aucune règle d'ancre ne s'applique alors.
 */
export function calerLaMargeDAncre(): void {
  if (typeof document === 'undefined') return;
  const entete = document.getElementById('entete-principal');
  if (!entete) return;
  const barres = [...document.querySelectorAll<HTMLElement>('.sous-entete')];

  const mesurer = () => {
    const hautEntete = Math.round(entete.getBoundingClientRect().height);
    if (hautEntete <= 0) return;
    /* `getClientRects()` et non `offsetParent` : une barre peut être en
       `position: fixed`, auquel cas `offsetParent` est nul alors qu'elle est
       bien là. Et une barre cachée — l'index du glossaire l'est tant qu'aucun
       terme n'est rendu — ne barre rien et ne doit rien ajouter. */
    const hautBarres = barres
      .filter((b) => b.getClientRects().length > 0)
      .reduce((somme, b) => somme + Math.round(b.getBoundingClientRect().height), 0);
    const racine = document.documentElement.style;
    racine.setProperty('--haut-entete', `${hautEntete}px`);
    racine.setProperty('--haut-colle', `${hautEntete + hautBarres}px`);
  };

  /* Les polices arrivent après le premier rendu, l'en-tête se réorganise quand
     la fenêtre se resserre, et l'index du glossaire change de hauteur à chaque
     filtre : une mesure unique au chargement serait vraie une seconde. Sans
     `ResizeObserver`, on se rabat sur `resize`, qui rattrape le changement de
     largeur mais pas le reste — c'est mieux que rien, et les valeurs de repli
     couvrent l'écart. */
  if ('ResizeObserver' in window) {
    const oeil = new ResizeObserver(mesurer);
    oeil.observe(entete);
    for (const b of barres) oeil.observe(b);
  } else {
    addEventListener('resize', mesurer);
  }

  mesurer();
}
