/**
 * Le dictionnaire embarqué — Finances, phase 3 bis b.
 *
 * ## Ce qu'il est, et ce qu'il n'est pas
 *
 * Il est un **point de départ**, jamais une vérité. Ses entrées sont écrites
 * à la main, à partir de la connaissance des enseignes et des formats de
 * libellés français, et **n'ont pas été vérifiées sur des relevés réels**.
 * Leur couverture ne se connaîtra qu'à l'usage — au taux de reconnaissance
 * des trois premiers imports, et pas avant.
 *
 * Toute mesure faite ici porte sur un jeu de libellés **que j'ai écrit
 * aussi** : elle mesure donc surtout la cohérence entre les deux côtés de ma
 * propre main. Elle est publiée telle quelle, avec cette réserve, parce
 * qu'une mesure dont on tait la limite est pire qu'aucune mesure.
 *
 * ## Les règles de la personne priment
 *
 * Toujours, et sans que cela se discute : le dictionnaire est écrit sans
 * avoir vu ses relevés, elle les a sous les yeux. Une entrée peut être
 * **masquée** ou **remplacée** par une règle.
 *
 * ## Une mise à jour ne change rien de ce qui est pointé
 *
 * Elle ne produit que des propositions sur ce qui est encore à pointer. La
 * version qui a servi est conservée sur chaque pointage, de sorte qu'on
 * puisse dire « ce classement vient du dictionnaire du 13 octobre ».
 */
import fichier from '../../donnees/vendeurs.json';
import { typeDe } from './taxonomie';
import type { EntreeDuDictionnaire } from './vendeurs';

interface FichierDuDictionnaire {
  version: string;
  note: string;
  entrees: readonly {
    motifs: string[]; nom: string; type: string; statut: string; generique?: boolean;
  }[];
}

const brut = fichier as FichierDuDictionnaire;

export const VERSION_DU_DICTIONNAIRE = brut.version;
export const NOTE_DU_DICTIONNAIRE = brut.note;

export const DICTIONNAIRE: readonly EntreeDuDictionnaire[] = brut.entrees.map((e) => ({
  motifs: e.motifs,
  nom: e.nom,
  typeId: e.type,
  statut: e.statut === 'sur' ? 'sur' : 'ambigu',
  generique: Boolean(e.generique),
}));

/**
 * Le dictionnaire, moins ce que la personne a masqué.
 *
 * Masquer, et non supprimer : une mise à jour du fichier ne doit pas faire
 * réapparaître une entrée écartée, et supprimer une ligne d'un fichier
 * embarqué n'est de toute façon pas possible.
 */
export const dictionnaireUtilisable = (
  masques: readonly string[] = [],
): readonly EntreeDuDictionnaire[] =>
  DICTIONNAIRE.filter((e) => !masques.includes(e.nom));

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

/** Les familles que le dictionnaire doit couvrir pour mériter son nom. */
export const FAMILLES_ATTENDUES: readonly string[] = [
  'alimentation', 'restauration', 'transports', 'logement', 'energie',
  'telecoms', 'sante', 'abonnements', 'commerce', 'banque',
  'administrations', 'revenus',
];

export function controlerLeDictionnaire(): string[] {
  const problemes: string[] = [];

  if (DICTIONNAIRE.length < 200) {
    problemes.push(
      `Le dictionnaire ne porte que ${DICTIONNAIRE.length} entrées. Le prompt en exige un ` +
        'qui ne soit pas vide, et une poignée d’enseignes ne couvrirait rien.',
    );
  }

  const famillesVues = new Set<string>();
  for (const e of DICTIONNAIRE) {
    const t = typeDe(e.typeId);
    if (!t) {
      problemes.push(`L’entrée « ${e.nom} » vise le type inconnu « ${e.typeId} ».`);
      continue;
    }
    famillesVues.add(t.famille);
    if (!e.motifs.length) problemes.push(`L’entrée « ${e.nom} » n’a aucun motif.`);
    for (const m of e.motifs) {
      if (m !== m.toUpperCase() || /[^A-Z0-9 ]/.test(m)) {
        problemes.push(`Le motif « ${m} » de « ${e.nom} » n’est pas normalisé.`);
      }
    }
  }
  for (const f of FAMILLES_ATTENDUES) {
    if (!famillesVues.has(f)) {
      problemes.push(`Le dictionnaire ne couvre pas la famille « ${f} ».`);
    }
  }

  /*
     Un motif ne doit appartenir qu'à un nom. Deux entrées qui se disputent
     le même motif rendent la résolution dépendante de l'ordre du fichier,
     c'est-à-dire imprévisible pour qui le relit.
  */
  const proprietaire = new Map<string, string>();
  for (const e of DICTIONNAIRE) {
    for (const m of e.motifs) {
      const deja = proprietaire.get(m);
      if (deja && deja !== e.nom) {
        problemes.push(`Le motif « ${m} » est disputé par « ${deja} » et « ${e.nom} ».`);
      }
      proprietaire.set(m, e.nom);
    }
  }

  /*
     Et la règle qui protège le plus. Mon premier jet refusait qu'une entrée
     « sûr » vise un type sensible, et il avait tort : `statut` dit que le
     **nom** n'est pas ambigu, ce qui est parfaitement vrai d'« URSSAF » ou
     de « CPAM ». Confondre cette propriété avec « peut être pointée seule »
     aurait obligé à mentir sur seize entrées pour obtenir une protection
     qui, de toute façon, ne vient pas de là.

     L'invariant réel est ailleurs : un type sensible porte `jamaisAuto`, et
     c'est la taxonomie qui le tient. On le vérifie donc ici **sur les types
     que le dictionnaire désigne vraiment** — un fichier de données qui
     ouvrirait une porte que la taxonomie croit fermée serait la seule façon
     de contourner la protection sans toucher au code qui la pose.
  */
  for (const e of DICTIONNAIRE) {
    const t = typeDe(e.typeId);
    if (t?.sensible && !t.jamaisAuto) {
      problemes.push(
        `« ${e.nom} » vise le type sensible « ${t.libelle} », qui n’interdit pas le pointage ` +
          'automatique. Un fait de santé serait classé sans que personne le regarde.',
      );
    }
  }

  return problemes;
}
