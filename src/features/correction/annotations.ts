/**
 * Ce que la correction surligne dans l'énoncé, à chaque étape du déroulé.
 *
 * C'est la pièce qui fait de la correction un **objet visuel** et non un
 * paragraphe : la trace nomme les prémisses, les entités et les options qu'elle
 * mobilise, et cette fonction les traduit en marqueurs que l'énoncé porte
 * directement. On voit alors la chaîne s'allumer au fil des étapes, au lieu de
 * lire qu'elle existe.
 *
 * ## Les clefs de prémisse, et pourquoi elles sont des chaînes
 *
 * Les moteurs ne désignent pas tous une prémisse de la même façon. La plupart la
 * désignent par son **rang** dans la liste affichée — `ref('premisse', 3)`.
 * « Inférer la relation » la désigne par son **texte**, parce que ses lignes
 * sont mélangées entre symboles et qu'un rang n'y voudrait rien dire. Les deux
 * conventions sont légitimes, et forcer l'une des deux aurait abîmé un moteur
 * pour arranger l'autre.
 *
 * La clef reste donc telle que le moteur l'a posée, et la correspondance se fait
 * à l'affichage : une phrase est marquée si la clef vaut son texte **ou** son
 * rang. C'est une règle en une ligne, et elle rend les deux conventions
 * utilisables sans qu'aucun moteur ait à changer.
 */
import type { Marqueur } from './vocabulaire';
import type { Reponse } from '../relational-reasoning/moteurs/types';
import type { Ref, TraceResolution } from './trace';

/**
 * La réponse donnée est celle que la **notation** emploie déjà, et non un type
 * jumeau.
 *
 * Un second type aux mêmes trois variantes aurait divergé au premier ajout de
 * format de réponse, et la correction aurait alors annoté autre chose que ce que
 * le barème avait noté. C'est d'ailleurs ainsi que le défaut s'est signalé : les
 * deux déclarations se sont heurtées à la compilation.
 */
export type { Donnee } from '../relational-reasoning/noyaux/notation';
import type { Donnee } from '../relational-reasoning/noyaux/notation';

export interface Annotations {
  /** Par clef de prémisse — son rang en chaîne, ou son texte. */
  premisses: Map<string, Marqueur>;
  /** Par nom d'entité, de nœud, d'axe ou de classe. */
  elements: Map<string, Marqueur>;
  /** Par rang d'option. */
  options: Map<number, Marqueur>;
}

const SORTES_ELEMENT = new Set(['entite', 'noeud', 'arete', 'axe', 'intervalle', 'region', 'classe']);

function poser(cible: Map<string, Marqueur>, clef: string, marqueur: Marqueur) {
  // Un marqueur déjà posé n'est pas écrasé : `utilise` l'emporte sur `inutile`
  // parce qu'il est posé en second, après le nettoyage de la liste des inutiles.
  cible.set(clef, marqueur);
}

function ventiler(annotations: Annotations, refs: readonly Ref[], marqueur: Marqueur) {
  for (const r of refs) {
    if (r.sorte === 'premisse') {
      poser(annotations.premisses, r.clef, marqueur);
    } else if (r.sorte === 'option') {
      /*
       * Une option s'adresse par son **rang**, et uniquement par son rang :
       * c'est le seul repère que l'affichage possède, un distracteur pouvant
       * n'être qu'un dessin. Une clef qui n'est pas un nombre est donc ignorée
       * plutôt que convertie en `NaN`.
       *
       * Le garde-fou a servi : un moteur désignait des options par leur libellé,
       * et l'entrée `NaN` qui en résultait ne s'affichait nulle part tout en
       * faisant apparaître « inutile » dans la légende. Une légende qui annonce
       * un marqueur absent de l'écran apprend à ne plus lire la légende.
       */
      const rang = Number(r.clef);
      if (Number.isInteger(rang) && rang >= 0) annotations.options.set(rang, marqueur);
    } else if (SORTES_ELEMENT.has(r.sorte)) {
      poser(annotations.elements, r.clef, marqueur);
    }
  }
}

/**
 * Les marqueurs à porter dans l'énoncé, pour les `visibles` premières étapes.
 *
 * L'ordre de pose compte, et il va du plus faible au plus fort :
 *
 * 1. les éléments que la trace déclare **inutiles** — ils sont visibles dès le
 *    départ, parce que savoir qu'un fait ne sert à rien fait partie de ce qu'on
 *    apprend, et qu'attendre la dernière étape pour le dire serait tard ;
 * 2. ce que les étapes **déjà montrées** mobilisent, en `utilise` ;
 * 3. la réponse donnée, puis la bonne, qui l'emportent sur tout le reste.
 *
 * ## Pourquoi l'étape en cours ne reçoit pas `deduit`
 *
 * Une première version marquait `deduit` ce que l'étape courante mobilise, pour
 * la distinguer des précédentes. C'était un contresens, et il se voyait à
 * l'écran : `deduit` veut dire « établi par l'étape, et **non donné par
 * l'énoncé** », et il se trouvait posé sur une prémisse, qui est donnée par
 * l'énoncé par définition. Un vocabulaire partagé ne vaut que si chaque marqueur
 * garde son sens partout ; le détourner pour marquer « c'est ici qu'on en est »
 * l'aurait vidé.
 *
 * Ce que l'étape courante mobilise est donc `utilise`, comme le reste. Dire où
 * l'on en est est le travail de la légende d'étape, qui le dit en toutes
 * lettres, et du compteur « 1 / 3 ». `deduit` reste disponible pour ce qu'il
 * désigne : une relation que le schéma trace parce qu'elle a été inférée.
 *
 * La bonne réponse est posée **après** la réponse donnée : quand les deux
 * coïncident, c'est `bonne-reponse` qui reste, et l'écran dit en toutes lettres
 * que c'était la vôtre. L'inverse aurait affiché « votre réponse » sur une
 * réponse juste, sans dire qu'elle l'était.
 */
export function annoter(
  trace: TraceResolution | undefined,
  reponse: Reponse,
  donnee: Donnee | null,
  visibles: number,
): Annotations {
  const annotations: Annotations = {
    premisses: new Map(),
    elements: new Map(),
    options: new Map(),
  };

  if (trace) {
    ventiler(annotations, trace.elementsInutiles, 'inutile');

    const montrees = trace.etapes.slice(0, Math.max(0, visibles));
    for (const etape of montrees) {
      ventiler(annotations, etape.utilise, 'utilise');
      ventiler(annotations, etape.surbrillance, 'utilise');
    }
  }

  if (donnee?.genre === 'unique' && donnee.choix !== null) {
    annotations.options.set(donnee.choix, 'ta-reponse');
  } else if (donnee?.genre === 'multiple') {
    for (const i of donnee.choix) annotations.options.set(i, 'ta-reponse');
  }

  if (reponse.genre === 'unique') annotations.options.set(reponse.bonne, 'bonne-reponse');
  else if (reponse.genre === 'multiple') {
    for (const i of reponse.bonnes) annotations.options.set(i, 'bonne-reponse');
  }

  return annotations;
}

/**
 * Le marqueur d'une phrase de l'énoncé, par son texte et son rang.
 *
 * Les deux conventions de clef sont acceptées ici, et nulle part ailleurs : un
 * moteur n'a donc jamais à savoir comment l'affichage s'y prend.
 */
export function marqueurDePhrase(
  annotations: Annotations,
  phrase: string,
  rang: number,
): Marqueur | undefined {
  return annotations.premisses.get(phrase) ?? annotations.premisses.get(String(rang));
}

/**
 * Les marqueurs effectivement employés, dans l'ordre de la légende.
 *
 * La légende ne liste que ce qui est à l'écran : une légende qui annonce sept
 * marqueurs là où trois servent apprend à ignorer la légende.
 */
export function marqueursEmployes(annotations: Annotations): Marqueur[] {
  const vus = new Set<Marqueur>([
    ...annotations.premisses.values(),
    ...annotations.elements.values(),
    ...annotations.options.values(),
  ]);
  const ordre: Marqueur[] = [
    'utilise',
    'deduit',
    'inutile',
    'possible',
    'exclu',
    'ta-reponse',
    'bonne-reponse',
  ];
  return ordre.filter((m) => vus.has(m));
}

/**
 * La réponse donnée est-elle la bonne ? Sert à choisir les mots de l'en-tête,
 * qui ne peuvent pas être les mêmes dans les deux cas.
 */
export function reponseJuste(reponse: Reponse, donnee: Donnee | null): boolean {
  if (!donnee) return false;
  if (reponse.genre === 'unique' && donnee.genre === 'unique') {
    return donnee.choix === reponse.bonne;
  }
  if (reponse.genre === 'multiple' && donnee.genre === 'multiple') {
    const attendu = [...reponse.bonnes].sort((a, b) => a - b);
    const obtenu = [...donnee.choix].sort((a, b) => a - b);
    return attendu.length === obtenu.length && attendu.every((x, i) => x === obtenu[i]);
  }
  if (reponse.genre === 'appariement' && donnee.genre === 'appariement') {
    return Object.entries(reponse.paires).every(([k, v]) => donnee.paires[k] === v);
  }
  return false;
}
