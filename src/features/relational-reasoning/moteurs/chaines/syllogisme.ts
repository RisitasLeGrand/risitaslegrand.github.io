/**
 * Moteur « Syllogisme » — famille Chaînes de prémisses.
 *
 * Des prémisses quantifiées — tous, aucun, certains, certains ne… pas — et une
 * conclusion à juger. C'est la forme la plus ancienne du raisonnement réglé, et
 * elle manquait entièrement au site.
 *
 * ## Pourquoi ce n'est pas un système, mais un moteur
 *
 * Le contrat des systèmes exige de chaque relation qu'elle soit une information
 * **complète** sur une paire : `converse` rend une relation, un `Fait` en énonce
 * une. Or une prémisse quantifiée est une **disjonction** de relations
 * d'ensembles :
 *
 * | Forme | Relations compatibles |
 * |---|---|
 * | Tous les X sont des Y | `identiques` ou `contenu` |
 * | Aucun X n'est un Y | `disjoints` |
 * | Certains X sont des Y | tout sauf `disjoints` |
 * | Certains X ne sont pas des Y | `contient`, `empiète` ou `disjoints` |
 *
 * Et la conversion ne s'écrit pas comme une fonction : E et I se renversent
 * simplement, A ne donne que « certains Y sont des X », et O ne se renverse pas
 * du tout. Un `converse` total et exact est donc impossible sur ce vocabulaire.
 * Le syllogisme est par conséquent un moteur, qui emprunte à `classes` ses noms
 * d'entités et son vocabulaire d'affichage, et qui porte son propre solveur.
 *
 * ## Pourquoi le solveur n'énumère pas des intervalles
 *
 * `classes`, `rcc8` et `allen` modélisent leurs objets par des segments d'une
 * droite, et c'est légitime pour eux : tout tirage de segments est une
 * configuration réalisable, ce qui suffit à **engendrer** des instances justes.
 *
 * Cela ne suffit pas à **décider** une entailment. Les intervalles sont
 * strictement moins expressifs que les ensembles : trois ensembles deux à deux
 * sécants peuvent avoir une intersection triple vide, mais trois intervalles
 * ne peuvent pas — en dimension un, si les trois intersections deux à deux sont
 * non vides, l'intersection triple l'est aussi. Vérifié par énumération des
 * 55³ triplets de segments : **aucun** ne réalise cette configuration. Un
 * solveur fondé sur les intervalles déclarerait donc entraînées des conclusions
 * que les ensembles réfutent, et poserait des items à clef fausse.
 *
 * D'où l'énumération des **régions de Venn**. Pour n termes il y a 2ⁿ−1 régions,
 * et un modèle est le choix des régions non vides : 128 modèles à trois termes,
 * 32 768 à quatre. C'est exact, complet, et immédiat.
 *
 * ## L'import existentiel, qui doit être dit
 *
 * On impose que **chaque catégorie compte au moins un élément**, et l'énoncé
 * l'annonce. C'est la convention d'Aristote, et elle n'est pas neutre : elle
 * rend valide « tous les X sont des Y, donc certains X sont des Y », que la
 * logique moderne rejette faute de garantir que des X existent. Choisir sans le
 * dire aurait rendu une partie des clefs de réponse indéfendables ; le dire
 * rend l'exercice décidable et loyal.
 */
import { journal, ref } from '../../../correction/trace';
import { que, texte } from '../../noyaux/presentation';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 50;

/** Les trois verdicts, dans les mots des autres moteurs de la famille. */
const VERDICTS = [
  'il découle nécessairement des prémisses',
  'il les contredit : aucune situation compatible ne le vérifie',
  'il reste ouvert : les prémisses ne permettent pas de trancher',
];

type Forme = 'A' | 'E' | 'I' | 'O';
const FORMES: Forme[] = ['A', 'E', 'I', 'O'];

interface Enonce {
  forme: Forme;
  /** Index du terme sujet. */
  x: number;
  /** Index du terme prédicat. */
  y: number;
}

/** Le pluriel d'un mot-fantôme : « Varnol » → « Varnols ». */
const pluriel = (mot: string) => (/[sxz]$/i.test(mot) ? mot : `${mot}s`);

function phrase(enonce: Enonce, noms: readonly string[]): string {
  const x = noms[enonce.x];
  const y = noms[enonce.y];
  switch (enonce.forme) {
    case 'A':
      return `Tous les ${pluriel(x)} sont des ${pluriel(y)}`;
    case 'E':
      return `Aucun ${x} n’est un ${y}`;
    case 'I':
      return `Certains ${pluriel(x)} sont des ${pluriel(y)}`;
    case 'O':
      return `Certains ${pluriel(x)} ne sont pas des ${pluriel(y)}`;
  }
}

/**
 * Ce que la forme exige, au subjonctif, pour s'enchâsser après « impose que ».
 *
 * Au subjonctif et non à l'indicatif : « impose que la zone soit vide » et non
 * « impose que la zone doit être vide », qui empile deux verbes modaux.
 */
function effet(enonce: Enonce, noms: readonly string[]): string {
  const x = pluriel(noms[enonce.x]);
  const y = pluriel(noms[enonce.y]);
  switch (enonce.forme) {
    case 'A':
      return `aucun ${noms[enonce.x]} ne soit hors des ${y}`;
    case 'E':
      return `la zone commune aux ${x} et aux ${y} soit vide`;
    case 'I':
      return `la zone commune aux ${x} et aux ${y} compte au moins un élément`;
    case 'O':
      return `au moins un ${noms[enonce.x]} soit hors des ${y}`;
  }
}


/**
 * Un énoncé est-il vrai dans ce modèle ?
 *
 * Le modèle est un masque de bits sur les régions : la région `r`, de 1 à 2ⁿ−1,
 * est non vide si le bit `r−1` est posé. Le numéro de région est lui-même un
 * masque d'appartenance aux termes, ce qui rend le test immédiat — il suffit de
 * regarder si une région non vide appartient à X en appartenant, ou non, à Y.
 */
function vraie(modele: number, n: number, { forme, x, y }: Enonce): boolean {
  let dansXY = false;
  let dansXHorsY = false;
  for (let r = 1; r < 1 << n; r += 1) {
    if (!(modele & (1 << (r - 1)))) continue;
    if (!(r & (1 << x))) continue;
    if (r & (1 << y)) dansXY = true;
    else dansXHorsY = true;
  }
  switch (forme) {
    case 'A':
      return !dansXHorsY;
    case 'E':
      return !dansXY;
    case 'I':
      return dansXY;
    case 'O':
      return dansXHorsY;
  }
}

/** Chaque terme compte-t-il au moins un élément ? L'import existentiel. */
function termesHabites(modele: number, n: number): boolean {
  for (let i = 0; i < n; i += 1) {
    let habite = false;
    for (let r = 1; r < 1 << n; r += 1) {
      if (modele & (1 << (r - 1)) && r & (1 << i)) {
        habite = true;
        break;
      }
    }
    if (!habite) return false;
  }
  return true;
}

/** Tous les modèles à `n` termes dont chaque terme est habité. */
function modeles(n: number): number[] {
  const regions = (1 << n) - 1;
  const liste: number[] = [];
  for (let modele = 1; modele < 1 << regions; modele += 1) {
    if (termesHabites(modele, n)) liste.push(modele);
  }
  return liste;
}

/** Mémoïsé : 128 modèles à trois termes, 32 768 à quatre. */
const memoModeles = new Map<number, number[]>();
function tousLesModeles(n: number): number[] {
  let connu = memoModeles.get(n);
  if (!connu) {
    connu = modeles(n);
    memoModeles.set(n, connu);
  }
  return connu;
}

export const chaineSyllogisme: Moteur = {
  id: 'chaine-syllogisme',
  nom: 'Syllogisme',
  categorie: 'chaines',
  resume:
    'Tous, aucun, certains : des prémisses quantifiées, et une conclusion qui en découle, ' +
    'les contredit, ou reste ouverte.',
  regimes: ['algebre'],

  /**
   * Restreint à `classes`, dont il emprunte les noms de catégories.
   *
   * Le système ne lui fournit pas son algèbre — le solveur est interne — mais il
   * lui donne un vocabulaire cohérent avec le reste de la rubrique : une
   * personne qui vient de composer des relations d'ensembles retrouve les mêmes
   * catégories sous une autre forme d'énoncé.
   */
  compatible: (systeme: Systeme) => systeme.id === 'classes',

  // Trois options, donc la règle commune suffirait ; mais une prémisse
  // quantifiée se devine plus facilement qu'une composition, et sept sur huit
  // garde l'échelle honnête ici aussi.
  echelle: { reussites: 7, fenetre: 8, descente: 4 },

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    // Trois termes jusqu'au cinquième échelon, quatre ensuite : le syllogisme
    // classique d'abord, le polysyllogisme ensuite.
    const n = echelon >= 6 ? 4 : 3;
    const tous = tousLesModeles(n);
    const vise = alea.entier(3);

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(3, n * 3), alea);
      if (instance.entites.length < n) continue;
      const noms = instance.entites.slice(0, n);

      // Un modèle de référence, dont on tirera des prémisses nécessairement
      // satisfaisables : partir des prémisses risquerait l'ensemble vide.
      //
      // Tiré **creux**, et c'est le point. Un modèle pris au hasard uniforme a
      // la moitié de ses régions non vides, si bien que « certains » y est
      // presque toujours vrai et « tous » presque jamais : les prémisses
      // universelles disparaissaient de l'exercice, et avec elles le
      // syllogisme. On choisit donc chaque région avec une probabilité basse,
      // puis on habite les termes restés vides — l'import existentiel l'exige.
      const densite = 0.2 + alea.reel() * 0.25;
      const regions = (1 << n) - 1;
      let reference = 0;
      for (let r = 1; r <= regions; r += 1) {
        if (alea.reel() < densite) reference |= 1 << (r - 1);
      }
      for (let i = 0; i < n; i += 1) {
        let habite = false;
        for (let r = 1; r <= regions; r += 1) {
          if (reference & (1 << (r - 1)) && r & (1 << i)) habite = true;
        }
        if (!habite) reference |= 1 << ((1 << i) - 1);
      }

      // Les paires de termes, et pour chacune les formes vraies dans le modèle
      // de référence. Un syllogisme à n termes demande n−1 prémisses au moins,
      // enchaînées de façon qu'aucun terme ne reste isolé.
      const paires: [number, number][] = [];
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) if (i !== j) paires.push([i, j]);
      }

      const candidates: Enonce[] = [];
      for (const [x, y] of paires) {
        for (const forme of FORMES) {
          const e = { forme, x, y };
          if (vraie(reference, n, e)) candidates.push(e);
        }
      }
      if (candidates.length < n) continue;

      // On prend n prémisses au plus, en veillant à deux choses.
      //
      // Qu'elles **couvrent tous les termes** : une prémisse qui ne parlerait
      // que de deux termes sur quatre laisserait le quatrième hors du
      // raisonnement.
      //
      // Et que chacune **restreigne strictement** ce qui reste possible. Sans
      // cette exigence, le générateur produisait des énoncés où « Certains X
      // sont des Y » était suivi de « Certains Y sont des X » — I se renverse
      // simplement, la seconde ne dit donc rien de plus, et la trace affichait
      // une étape qui ne faisait pas descendre le compte. Une prémisse qui
      // n'apprend rien n'est pas une difficulté, c'est du bruit.
      const premisses: Enonce[] = [];
      const couverts = new Set<number>();
      let restePossible = tous;
      for (const e of alea.melanger(candidates)) {
        if (premisses.length >= n) break;
        const apporte = !couverts.has(e.x) || !couverts.has(e.y);
        if (!apporte && premisses.length >= n - 1) continue;
        const apres = restePossible.filter((m) => vraie(m, n, e));
        if (apres.length >= restePossible.length) continue;
        premisses.push(e);
        restePossible = apres;
        couverts.add(e.x);
        couverts.add(e.y);
      }
      if (couverts.size < n || premisses.length < n - 1) continue;

      const compatibles = restePossible;
      if (compatibles.length < 2) continue;

      // La conclusion porte sur deux termes qu'aucune prémisse ne relie
      // directement — sinon la question se réduit à relire une prémisse.
      const libres = paires.filter(
        ([x, y]) => !premisses.some((p) => (p.x === x && p.y === y) || (p.x === y && p.y === x)),
      );
      if (!libres.length) continue;

      let choisie: { enonce: Enonce; verdict: number; verifient: number } | null = null;
      for (const [x, y] of alea.melanger(libres)) {
        for (const forme of alea.melanger(FORMES)) {
          const e = { forme, x, y };
          const verifient = compatibles.filter((m) => vraie(m, n, e)).length;
          const verdict =
            verifient === compatibles.length ? 0 : verifient === 0 ? 1 : 2;
          if (verdict === vise) {
            choisie = { enonce: e, verdict, verifient };
            break;
          }
        }
        if (choisie) break;
      }
      if (!choisie) continue;

      // ----- La trace, déposée en reparcourant les prémisses ---------------
      const carnet = journal();
      let restants = tous;
      premisses.forEach((p, i) => {
        const avant = restants.length;
        restants = restants.filter((m) => vraie(m, n, p));
        carnet.etape({
          utilise: [ref('premisse', i)],
          loi: i === 0 ? undefined : 'intersection des situations compatibles',
          produit: `${restants.length} situation${restants.length > 1 ? 's' : ''} compatible${
            restants.length > 1 ? 's' : ''
          }`,
          legende:
            `« ${phrase(p, noms)} » impose ${que(effet(p, noms))}. ` +
            `Sur les ${avant} situations encore envisageables, il n’en reste ${restants.length}.`,
          surbrillance: [
            ...premisses.slice(0, i + 1).map((_, j) => ref('premisse', j)),
            ref('classe', noms[p.x]),
            ref('classe', noms[p.y]),
          ],
        });
      });

      carnet.etape({
        utilise: [ref('option', choisie.verdict)],
        produit: VERDICTS[choisie.verdict],
        legende:
          `Parmi les ${compatibles.length} situations compatibles avec les prémisses, ` +
          `${choisie.verifient} vérifie${choisie.verifient > 1 ? 'nt' : ''} la conclusion. ` +
          (choisie.verdict === 0
            ? 'Toutes la vérifient : elle découle donc nécessairement des prémisses.'
            : choisie.verdict === 1
              ? 'Aucune ne la vérifie : les prémisses l’excluent.'
              : 'Certaines la vérifient, d’autres non : les prémisses ne tranchent pas, et ' +
                'conclure dans un sens ou dans l’autre serait aller au-delà de ce qu’elles disent.'),
        surbrillance: [ref('classe', noms[choisie.enonce.x]), ref('classe', noms[choisie.enonce.y])],
      });
      const trace = carnet.sceller({ genre: 'unique', indice: choisie.verdict });

      const options: Option[] = VERDICTS.map((intitule, i) => ({
        texte: intitule,
        etiquette:
          i === choisie!.verdict
            ? undefined
            : i === 0
              ? // Conclure d'une prémisse universelle ce qu'elle ne dit pas, ou
                // enchaîner deux négatives, est l'erreur type du syllogisme.
                ('quantificateur-affaibli' as const)
              : i === 1
                ? ('hors-zone' as const)
                : ('non-etiquete' as const),
      }));

      return {
        moteur: 'chaine-syllogisme',
        systeme: systeme.id,
        consigne: `Que vaut la conclusion « ${phrase(choisie.enonce, noms)} » ?`,
        enonce: [
          texte(
            `${n} catégories, dont chacune compte au moins un élément. On sait ceci — les ` +
              'prémisses sont dans le désordre :',
          ),
          {
            type: 'faits',
            phrases: premisses.map((p, i) => `${i + 1}. ${phrase(p, noms)}.`),
          },
        ],
        reponse: { genre: 'unique', options, bonne: choisie.verdict },
        explication: trace.etapes[trace.etapes.length - 1].legende,
        trace,
      };
    }
    return null;
  },
};
