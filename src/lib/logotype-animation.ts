/**
 * « LA MARÉE » : LE BRANCHEMENT DE L'ANIMATION D'ENTRÉE DU LOGOTYPE.
 *
 * Le dessin est dans `logotype.ts`, l'animation dans
 * `src/styles/logotype-anime.css`. Ce module ne fait qu'une chose : décider
 * QUAND elle se joue, en posant un attribut.
 *
 * ## Une fois par session, et pourquoi pas à chaque page
 *
 * L'en-tête porte `view-transition-name: entete-principal` : il PERSISTE d'une
 * page à l'autre, c'est tout l'objet de cette déclaration. Une animation posée
 * à chaque navigation se rejouerait donc sur un élément qui n'a pas bougé —
 * et un mouvement qui revient à chaque page est précisément ce qu'on a voulu
 * éviter en écartant l'anneau du prompt 65 : l'idiome de l'indicateur de
 * chargement.
 *
 * Le témoin est dans `sessionStorage` et non dans `localStorage` : une session
 * est un onglet, et rouvrir l'application mérite de revoir son nom se poser.
 * `localStorage` ferait que l'animation ne se joue qu'UNE FOIS dans la vie de
 * l'appareil, ce qui reviendrait à ne pas l'écrire.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne touche PAS au voile. Le voile est l'image que le sélecteur
 * d'applications garde en vignette, et une animation y ferait montrer un logo
 * à moitié dessiné — la mesure et le raisonnement sont en tête de
 * `src/styles/logotype-anime.css`.
 *
 * Il n'ajoute aucun élément, ne touche pas au focus, et ne change rien de ce
 * qui est lu : il pose un attribut sur le conteneur, et c'est la feuille de
 * style qui fait le reste. En mouvement réduit, l'attribut est posé mais la
 * feuille ne l'anime pas — c'est le navigateur qui décide, pas ce module, et
 * c'est voulu : une préférence qui change en cours de session est alors prise
 * en compte sans qu'on ait à l'écouter.
 */

/** Le témoin de session, nommé en clair : il sera lu par quelqu'un un jour. */
const TEMOIN = 'cyclades:logotype-anime';

/** L'attribut que la feuille de style attend, et la valeur qu'elle reconnaît. */
const ATTRIBUT = 'data-logo-anime';
const VALEUR = 'maree';

/**
 * Pose l'animation sur les logotypes de l'en-tête, une fois par session.
 *
 * Montée depuis la mise en page, comme le voile : une page oubliée suffirait à
 * rendre le comportement imprévisible selon la page d'entrée.
 */
/** Pose l'attribut si un logotype d'en-tête est visible. Rend `true` si c'est fait. */
function poserLAnimation(): boolean {
  let dejaJoue = false;
  try {
    dejaJoue = sessionStorage.getItem(TEMOIN) === 'oui';
  } catch {
    /*
       Un stockage refusé — navigation privée, réglage du navigateur — ne doit
       pas empêcher l'animation : on la joue, simplement, et on ne saura pas
       s'en souvenir. Le défaut d'un témoin illisible est de rejouer, pas de
       casser.
    */
  }
  if (dejaJoue) return true;

  /*
     LES LOGOTYPES DE L'EN-TÊTE, ET EUX SEULS. Le voile en porte un aussi, mais
     il est créé plus tard et n'est pas dans l'en-tête — le sélecteur ne peut
     donc pas l'atteindre, ce qui est la garantie qu'on veut : non pas « on
     évite de l'animer », mais « on ne peut pas ».
  */
  const dansLEnTete = document.querySelectorAll('header [data-logotype]');

  /*
     ── ON N'ANIME QUE CE QUI SE VOIT, ET C'EST LA MESURE DANS LE SITE RÉEL QUI
        L'A IMPOSÉ ──

     Ma première version posait l'attribut sur tous les logotypes d'en-tête et
     marquait aussitôt le témoin. Mesuré sur l'aperçu : AVANT le déverrouillage
     l'attribut était bien posé — mais l'en-tête avait une hauteur de ZÉRO, il
     n'était pas affiché ; et APRÈS le déverrouillage l'attribut avait disparu
     avec le ré-affichage, le témoin étant déjà consommé.

     Autrement dit : l'animation se jouait sur un élément invisible, une fois
     par session, et PERSONNE ne la voyait jamais. Aucune garde hors du site
     ne pouvait l'attraper — l'essai de l'animation mesurait la feuille et le
     dessin, tous deux corrects.

     Deux conséquences, et les deux comptent :
       — on écarte les logotypes de hauteur nulle, donc ceux d'un en-tête
         caché ;
       — on ne marque le témoin QUE si l'on a animé quelque chose. Un appel
         qui ne trouve rien à animer ne consomme rien, et le suivant rejouera.

     Et l'appel lui-même est passé derrière `quandDeverrouille` dans la mise en
     page : c'est le moment où l'en-tête existe pour de bon.
  */
  const visibles = [...dansLEnTete].filter((n) => n.getBoundingClientRect().height > 0);
  if (!visibles.length) return false;

  for (const svg of visibles) {
    const porteur = svg.parentElement;
    if (!porteur) continue;
    porteur.setAttribute(ATTRIBUT, VALEUR);
    /*
       ── LE TÉMOIN EST MARQUÉ QUAND L'ANIMATION EST ALLÉE AU BOUT, ET PAS
          QUAND ELLE EST POSÉE ──

       Troisième mesure dans le site, troisième cause, et celle-là je ne
       l'aurais jamais devinée : le déverrouillage NAVIGUE vers
       « /initialisation/ », par un chargement complet. Relevé à la trace, sur
       un observateur posé par `addInitScript` pour survivre au rechargement :
       le document où l'attribut était posé n'était pas celui qu'on finissait
       par regarder.

       Ma version précédente attrapait donc l'en-tête pendant la fraction de
       seconde où il paraît sur la page QU'ON S'APPRÊTE À QUITTER, marquait le
       témoin, et la page d'arrivée n'avait plus rien à jouer. Le témoin était
       consommé par une animation que personne n'avait vue — le même défaut que
       les deux fois d'avant, un cran plus loin.

       On ne marque donc plus sur une intention mais sur un FAIT : la dernière
       lettre a fini de monter. Si la page part avant, le témoin reste vierge et
       la page d'arrivée rejoue — ce qui est exactement ce qu'on veut, puisque
       personne n'a encore rien vu. `animationend` remonte depuis les `<tspan>`,
       d'où l'écoute sur le porteur ; `once` suffit, la dernière lettre étant la
       seule qui nous intéresse… et c'est pourquoi on compte.
    */
    let restantes = porteur.querySelectorAll('tspan').length;
    porteur.addEventListener('animationend', function fini() {
      restantes -= 1;
      if (restantes > 0) return;
      porteur.removeEventListener('animationend', fini);
      try {
        sessionStorage.setItem(TEMOIN, 'oui');
      } catch {
        /* Voir ci-dessus : ne pas pouvoir se souvenir n'est pas une raison de
           ne pas jouer. */
      }
    });
  }
  return true;
}

/**
 * ON ATTEND QUE L'EN-TÊTE PARAISSE, SUR AU PLUS UNE SECONDE.
 *
 * Troisième mesure, troisième correction — et chacune n'était visible que dans
 * le site, jamais dans une garde hors du site :
 *
 *   1. appelée au chargement, la fonction animait un en-tête de hauteur nulle,
 *      caché derrière l'écran de mot de passe, et consommait son témoin ;
 *   2. passée derrière `quandDeverrouille`, elle ne consommait plus rien — mais
 *      elle sortait aussitôt, parce qu'au moment où le déverrouillage est
 *      annoncé l'en-tête n'est PAS ENCORE peint. Relevé : aucune mutation de
 *      l'attribut observée, alors que l'en-tête mesure 18 px un instant plus
 *      tard ;
 *   3. d'où cette attente.
 *
 * Elle se fait par TRAMES et non par un délai : une trame est exactement l'unité
 * dans laquelle une hauteur devient non nulle, et un délai en millisecondes
 * serait un pari sur la vitesse de l'appareil. Soixante trames font environ une
 * seconde sur un écran ordinaire — au-delà, on renonce en silence, sans
 * consommer le témoin, parce qu'un en-tête qui n'a pas paru en une seconde ne
 * relève plus de l'animation d'entrée.
 */
export function brancherLAnimationDuLogotype(tramesRestantes = 60): void {
  if (poserLAnimation()) return;
  if (tramesRestantes <= 0) return;
  requestAnimationFrame(() => brancherLAnimationDuLogotype(tramesRestantes - 1));
}
