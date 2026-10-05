/**
 * Système `classes` : des catégories, et les cinq façons dont deux d'entre
 * elles peuvent se recouper.
 *
 * C'est l'algèbre **RCC5**, version grossière de RCC8 : on y oublie le contact.
 * Le choix n'est pas une simplification mais une conséquence du domaine — deux
 * *régions* peuvent se toucher sans se recouvrir, deux *ensembles* ne peuvent
 * pas. « Toucher le bord » n'a aucun sens pour des catégories, et le vocabulaire
 * ne doit pas offrir une distinction que l'objet ne porte pas.
 *
 * ## Pourquoi ce système, et pourquoi il ne suffit pas au syllogisme
 *
 * Le syllogisme — tous, aucun, certains, certains ne… pas — ne peut **pas**
 * être un système au sens de ce dossier, et il vaut mieux le dire ici que de le
 * découvrir en l'écrivant. Le contrat exige de chaque relation qu'elle soit une
 * information **complète** sur une paire : `converse` rend une relation, et un
 * `Fait` en énonce une. Or une prémisse quantifiée est une **disjonction** :
 *
 * | Forme | Ce qu'elle dit des cinq relations |
 * |---|---|
 * | Tous les X sont Y | `identiques` **ou** `contenu` |
 * | Aucun X n'est Y | `disjoints` |
 * | Certains X sont Y | tout sauf `disjoints` |
 * | Certains X ne sont pas Y | `contient`, `empiète` **ou** `disjoints` |
 *
 * Et la conversion ne se laisse pas écrire comme une fonction : « aucun X n'est
 * Y » et « certains X sont Y » se renversent simplement, « tous les X sont Y »
 * ne donne que « certains Y sont X », et « certains X ne sont pas Y » ne se
 * renverse pas du tout. Un `converse` total et exact est donc impossible sur le
 * vocabulaire quantifié.
 *
 * D'où la répartition retenue : **ce système porte les cinq relations exactes**,
 * ce qui le rend utilisable par les seize moteurs — et c'est déjà le
 * raisonnement d'inclusion, celui des diagrammes d'Euler. Le **syllogisme
 * proprement dit** sera un moteur de la famille des chaînes, qui lit le modèle
 * de ce système, en tire des prémisses quantifiées et les résout lui-même.
 *
 * ## Le modèle
 *
 * Les catégories sont des segments d'une droite graduée, comme pour `rcc8` et
 * `allen` — même noyau, troisième vocabulaire. Deux segments partagent des
 * éléments dès qu'ils ont un point commun, extrémité comprise : c'est ce qui
 * distingue le classifieur de celui de RCC8, où une extrémité commune était un
 * contact et non un recouvrement.
 *
 * Tout ce qu'un tirage de segments produit est une configuration d'ensembles
 * réalisable, ce qui garantit la cohérence des instances. L'inverse n'est pas
 * vrai — trois ensembles peuvent se recouper de façons qu'aucun triplet de
 * segments ne reproduit —, si bien que le générateur n'explore pas toutes les
 * configurations possibles. Il n'en énonce aucune de fausse, et c'est ce qui
 * compte.
 */
import { deriverTable, tirerSegments, type Segment } from '../noyaux/intervalles';
import { motsFantomes } from '../noyaux/mots';
import type { Alea, Instance, Modele, Systeme } from './types';

const IDENTIQUES = 'identiques';
const CONTENU = 'contenu';
const CONTIENT = 'contient';
const EMPIETE = 'empiete';
const DISJOINTS = 'disjoints';

const CONVERSES: Record<string, string> = {
  [IDENTIQUES]: IDENTIQUES,
  [CONTENU]: CONTIENT,
  [CONTIENT]: CONTENU,
  [EMPIETE]: EMPIETE,
  [DISJOINTS]: DISJOINTS,
};

const LIBELLES: Record<string, { libelle: string; bref: string }> = {
  [IDENTIQUES]: {
    libelle: 'regroupe exactement les mêmes éléments que',
    bref: 'mêmes éléments',
  },
  [CONTENU]: { libelle: 'est entièrement contenu dans', bref: 'contenu dans' },
  [CONTIENT]: { libelle: 'contient entièrement', bref: 'contient' },
  [EMPIETE]: {
    libelle: 'a des éléments communs avec, sans qu’aucun ne contienne l’autre,',
    bref: 'empiète',
  },
  [DISJOINTS]: { libelle: 'n’a aucun élément commun avec', bref: 'disjoints' },
};

/**
 * Le classifieur RCC5 sur des segments.
 *
 * La seule différence avec celui de RCC8 est au premier test, et elle est de
 * fond : deux segments qui ne partagent qu'une extrémité **se recoupent**, parce
 * que cette extrémité est un élément commun. RCC8 y voyait un contact sans
 * recouvrement, ce qui vaut pour des régions du plan et non pour des ensembles.
 */
function classer(a: Segment, b: Segment): string {
  if (a.fin < b.debut || b.fin < a.debut) return DISJOINTS;
  if (a.debut === b.debut && a.fin === b.fin) return IDENTIQUES;
  if (a.debut >= b.debut && a.fin <= b.fin) return CONTENU;
  if (b.debut >= a.debut && b.fin <= a.fin) return CONTIENT;
  return EMPIETE;
}

const table = deriverTable(classer);

function relationDansModele(modele: Modele, a: string, b: string): string {
  const segments = modele.segments ?? {};
  const sa = segments[a];
  const sb = segments[b];
  if (!sa || !sb) return IDENTIQUES;
  return classer(sa, sb);
}

export const classes: Systeme = {
  id: 'classes',
  nom: 'Catégories',
  resume:
    'Des catégories, et les cinq façons dont deux d’entre elles se recoupent : confondues, ' +
    'l’une dans l’autre, en chevauchement, ou sans aucun élément commun.',
  regimes: ['algebre'],
  relations: Object.keys(LIBELLES).map((id) => ({
    id,
    ...LIBELLES[id],
    // « Mêmes éléments » est une équivalence ; l'inclusion est un ordre. Les
    // deux autres ne dessinent aucune des sept algèbres du classifieur :
    // « empiète » n'est pas transitive et « disjoints » ne l'est pas non plus,
    // ce qui est d'ailleurs le piège du syllogisme.
    algebre:
      id === IDENTIQUES
        ? ('equivalence' as const)
        : id === CONTENU || id === CONTIENT
          ? ('ordre' as const)
          : undefined,
  })),
  monde: 'ouvert',
  converse: (relation) => CONVERSES[relation] ?? relation,
  composer: (r, s) => new Set(table.composition[r]?.[s] ?? Object.keys(LIBELLES)),
  // Comme pour RCC8 et Allen, la cohérence de chemin ne décide pas seule :
  // regrouper des relations affaiblit la composition, donc augmente
  // l'indétermination, et il faut énumérer les scénarios pour trancher.
  cheminComplet: false,
  relationDansModele,

  engendrer(difficulte: number, alea: Alea): Instance {
    const nombre = Math.min(5, 3 + Math.floor(difficulte / 3));
    // Des mots-fantômes plutôt que « Catégorie 1 » : une catégorie nommée a un
    // nom, et savoir que « Varnol est contenu dans Belid » demande exactement
    // le même raisonnement que « les mammifères sont des vertébrés » — sans
    // qu'aucune connaissance préalable ne vienne s'en mêler.
    const entites = motsFantomes(nombre, alea);
    const tires = tirerSegments(nombre, (borne) => alea.entier(borne));
    const segments: Record<string, Segment> = {};
    entites.forEach((entite, i) => {
      segments[entite] = tires[i] ?? { debut: i, fin: i + 2 };
    });
    const modele: Modele = { segments };

    const ordre = alea.melanger(entites);
    const faits = ordre.slice(1).map((entite, i) => ({
      sujet: entite,
      relation: relationDansModele(modele, entite, ordre[i]),
      objet: ordre[i],
    }));

    return { systeme: 'classes', entites, faits: alea.melanger(faits), modele };
  },

  rendu: 'texte',
};
