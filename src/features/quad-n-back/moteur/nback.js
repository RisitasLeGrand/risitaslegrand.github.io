/**
 * Génération des séquences de stimuli pour le Quad N-Back.
 *
 * Portage de la logique de « quad-box » (src/lib/nback.js) :
 *   https://github.com/scottshadow56/quad-box  — licence MIT
 *   Copyright (c) 2025 The Quad Box Project Contributors
 *   Texte complet : src/features/quad-n-back/LICENCE-quad-box.txt
 *
 * Adaptations : suppression des modes « tally », « varying N » et des pools
 * génératifs (d3), conservation des quatre dimensions du Quad N-Back.
 *
 * Principe : pour chaque dimension (position, couleur, forme, son), on décide
 * d'abord QUELLES épreuves seront des correspondances avec l'épreuve n rangs
 * plus tôt, puis on remplit les autres en évitant les collisions entre
 * dimensions.
 */
import { COLOR_POOL, SHAPE_POOL, POSITION_POOL, POSITION_POOL_2D, AUDIO_POOL } from './constantes.js';

const tirer = (pool) => pool[Math.floor(Math.random() * pool.length)];

const melanger = (tableau) => {
  for (let i = tableau.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tableau[i], tableau[j]] = [tableau[j], tableau[i]];
  }
  return tableau;
};

/**
 * Décide, pour une dimension, quelles épreuves seront des correspondances.
 *
 * La moitié du taux visé est garantie, l'autre moitié est tirée au sort : le
 * nombre de correspondances varie donc d'une partie à l'autre sans jamais
 * s'éloigner beaucoup de la cible. Les n premières épreuves ne peuvent pas
 * être des correspondances (rien à comparer en arrière).
 */
function genererCorrespondances(nombreEpreuves, n, tauxCorrespondance) {
  if (n >= nombreEpreuves) return new Array(nombreEpreuves).fill(false);

  const comparables = nombreEpreuves - n;
  const garanties = (comparables * (tauxCorrespondance / 2)) / 100;
  const reste = comparables - garanties;
  const tauxReste = reste > 0 ? (100 * garanties) / reste : 0;

  let supplementaires = 0;
  for (let i = 0; i < reste; i++) {
    if (Math.random() * 100 < tauxReste) supplementaires++;
  }

  const total = Math.round(garanties + supplementaires);
  const correspondances = new Array(comparables).fill(false);
  for (let i = 0; i < total && i < correspondances.length; i++) correspondances[i] = true;
  melanger(correspondances);

  return new Array(n).fill(false).concat(correspondances);
}

/**
 * Remplit une dimension pour toutes les épreuves.
 *
 * « interference » (0-100) est la probabilité de choisir délibérément un
 * stimulus proche d'une correspondance (celui de n-1 ou n+1 rangs en arrière)
 * quand l'épreuve ne doit PAS en être une : c'est ce qui rend l'exercice
 * réellement difficile plutôt que simplement rapide.
 */
function remplirDimension(epreuves, dimensions, dimension, pool, n, tauxCorrespondance, interference) {
  const correspondances = genererCorrespondances(epreuves.length, n, tauxCorrespondance);
  const autres = dimensions.filter((d) => d !== dimension);

  for (let i = 0; i < epreuves.length; i++) {
    // On évite qu'une même valeur serve simultanément à deux dimensions.
    let interdits = autres.map((d) => epreuves[i][d]).filter(Boolean);
    let disponibles = pool.filter((s) => !interdits.includes(s));

    if (i < n) {
      epreuves[i][dimension] = tirer(disponibles);
      continue;
    }

    interdits = interdits.concat(autres.map((d) => epreuves[i - n][d]).filter(Boolean));
    disponibles = pool.filter((s) => !interdits.includes(s));

    if (correspondances[i]) {
      epreuves[i][dimension] = epreuves[i - n][dimension];
      epreuves[i].correspondances.push(dimension);
      continue;
    }

    const possibles = disponibles.filter((s) => s !== epreuves[i - n][dimension]);
    let leurres = [epreuves[i - n + 1]?.[dimension]];
    if (i - n - 1 >= 0) leurres.push(epreuves[i - n - 1][dimension]);
    leurres = leurres.filter((s) => s && possibles.includes(s));
    melanger(leurres);

    epreuves[i][dimension] =
      Math.random() * 100 < interference && leurres.length > 0 ? leurres[0] : tirer(possibles);
  }
}

/** Les quatre dimensions du Quad N-Back, dans l'ordre d'affichage des touches. */
export const DIMENSIONS = [
  { cle: 'position', libelle: 'Position', touche: 'a', description: 'La case occupée' },
  { cle: 'couleur', libelle: 'Couleur', touche: 's', description: 'La couleur du bloc' },
  { cle: 'forme', libelle: 'Forme', touche: 'd', description: 'La forme affichée' },
  { cle: 'son', libelle: 'Son', touche: 'f', description: 'La lettre prononcée' },
];

/**
 * Construit une partie complète.
 *
 * @param {object} reglages
 * @param {number} reglages.n            profondeur (n-back)
 * @param {number} reglages.epreuves     nombre d'épreuves
 * @param {string[]} reglages.dimensions dimensions actives
 * @param {boolean} reglages.grille3D    grille 3×3×3 (sinon 3×3)
 * @param {number} reglages.tauxCorrespondance pourcentage visé de correspondances
 * @param {number} reglages.interference probabilité de leurres (0-100)
 */
export function genererPartie(reglages) {
  const {
    n,
    epreuves: nombreEpreuves,
    dimensions,
    grille3D = true,
    tauxCorrespondance = 25,
    interference = 25,
  } = reglages;

  const epreuves = new Array(nombreEpreuves).fill(null).map(() => ({
    correspondances: [],
    reponses: {},
  }));

  const pools = {
    position: grille3D ? POSITION_POOL : POSITION_POOL_2D,
    couleur: COLOR_POOL,
    forme: SHAPE_POOL,
    son: AUDIO_POOL,
  };

  // La position n'entre pas en collision avec les autres dimensions : elle est
  // remplie à part, avec sa propre liste de dimensions concurrentes vide.
  for (const dimension of dimensions) {
    const concurrentes = dimension === 'position' ? [] : dimensions.filter((d) => d !== 'position');
    remplirDimension(
      epreuves,
      concurrentes,
      dimension,
      pools[dimension],
      n,
      tauxCorrespondance,
      interference,
    );
  }

  return {
    meta: {
      n,
      nombreEpreuves,
      dimensions: [...dimensions],
      grille3D,
      tauxCorrespondance,
      interference,
      titre: titrePartie(dimensions),
    },
    epreuves,
  };
}

function titrePartie(dimensions) {
  const nombre = dimensions.length;
  return { 1: 'Simple', 2: 'Dual', 3: 'Tri', 4: 'Quad' }[nombre] ?? `${nombre} dimensions`;
}

/**
 * Calcule le score d'une partie terminée.
 *
 * Pour chaque dimension on compte : vrais positifs (correspondance signalée),
 * oublis (correspondance manquée), faux positifs (signalée à tort) et rejets
 * corrects (rien à signaler, rien signalé).
 *
 * Le taux retenu est la **précision équilibrée** : la moyenne de la
 * sensibilité (part des correspondances repérées) et de la spécificité (part
 * des non-correspondances correctement ignorées). C'est indispensable ici :
 * les correspondances sont rares (~25 %), donc une simple proportion de bonnes
 * décisions récompenserait la passivité — ne jamais rien signaler donnerait
 * près de 80 %. Avec la précision équilibrée, l'inaction vaut 50 % et seul un
 * joueur qui repère vraiment les correspondances dépasse ce seuil.
 */
export function calculerScore(partie) {
  const { epreuves, meta } = partie;
  const parDimension = {};
  const tauxParDimension = [];

  for (const dimension of meta.dimensions) {
    let vraisPositifs = 0;
    let fauxPositifs = 0;
    let oublis = 0;
    let rejetsCorrects = 0;

    epreuves.forEach((epreuve, i) => {
      if (i < meta.n) return; // épreuves sans point de comparaison
      const attendu = epreuve.correspondances.includes(dimension);
      const signale = epreuve.reponses[dimension] === true;
      if (attendu && signale) vraisPositifs++;
      else if (attendu && !signale) oublis++;
      else if (!attendu && signale) fauxPositifs++;
      else rejetsCorrects++;
    });

    const positifs = vraisPositifs + oublis;
    const negatifs = rejetsCorrects + fauxPositifs;
    const sensibilite = positifs > 0 ? vraisPositifs / positifs : null;
    const specificite = negatifs > 0 ? rejetsCorrects / negatifs : null;

    // Si une dimension n'a comporté aucune correspondance (possible quand n
    // est élevé et la partie courte), on se rabat sur la seule mesure définie.
    const taux =
      sensibilite !== null && specificite !== null
        ? (sensibilite + specificite) / 2
        : (sensibilite ?? specificite ?? 0);

    parDimension[dimension] = {
      vraisPositifs,
      fauxPositifs,
      oublis,
      rejetsCorrects,
      sensibilite,
      specificite,
      taux,
    };
    tauxParDimension.push(taux);
  }

  const taux = tauxParDimension.length
    ? tauxParDimension.reduce((a, b) => a + b, 0) / tauxParDimension.length
    : 0;

  const erreurs = Object.values(parDimension).reduce((n, d) => n + d.fauxPositifs + d.oublis, 0);
  const reperees = Object.values(parDimension).reduce((n, d) => n + d.vraisPositifs, 0);
  const aReperer = Object.values(parDimension).reduce((n, d) => n + d.vraisPositifs + d.oublis, 0);

  return { parDimension, taux, erreurs, reperees, aReperer };
}

/** Seuils de progression automatique du niveau, d'après la précision équilibrée. */
export const SEUIL_MONTEE = 0.85;
export const SEUIL_DESCENTE = 0.6;

/** Propose le niveau de la partie suivante : -1, 0 ou +1. */
export function niveauSuivant(n, taux) {
  if (taux >= SEUIL_MONTEE) return n + 1;
  if (taux < SEUIL_DESCENTE && n > 1) return n - 1;
  return n;
}
