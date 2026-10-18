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
  const noter = () => {
    const p = lirePositions();
    const y = Math.round(window.scrollY);
    p[cleDeLEcran()] = y;
    p[location.pathname] = y;
    ecrirePositions(p);
  };
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
