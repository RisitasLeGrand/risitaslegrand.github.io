/**
 * Fabriquer une base d'une version antérieure, pour éprouver une migration.
 *
 * ## Pourquoi une base complète, et pas trois magasins
 *
 * La tentation, quand on écrit une migration additive, est de semer juste les
 * magasins qu'on va relire. Le site, lui, en ouvre d'autres au chargement : il
 * échoue alors sur un magasin absent, l'écran reste sur « Déchiffrement du
 * contenu… », et l'essai conclut que la migration est cassée. Elle ne l'était
 * pas : la base de départ n'existait pas telle quelle.
 *
 * Ce module décrit donc le schéma **entier** d'une version, tel que `db.ts` le
 * produisait à l'époque. C'est une duplication assumée, et la seule honnête :
 * `db.ts` est écrit pour produire la version courante, et lui demander de
 * refabriquer l'ancienne le ferait mentir sur ce qu'il est.
 */

/** Le schéma de la version 14, dernière avant Odyssée. */
export function schemaV14(base) {
  base.createObjectStore('etat');

  const cartes = base.createObjectStore('cartes', { keyPath: 'id' });
  cartes.createIndex('du', 'du');
  cartes.createIndex('matiere', 'matiere');

  base.createObjectStore('fiches', { keyPath: 'id' });
  base.createObjectStore('quiz', { keyPath: 'id' }).createIndex('le', 'le');
  base.createObjectStore('jours', { keyPath: 'jour' });
  base.createObjectStore('nback', { keyPath: 'id' }).createIndex('le', 'le');

  const seances = base.createObjectStore('seances', { keyPath: 'id' });
  seances.createIndex('jour', 'jour');
  seances.createIndex('theme', 'theme');

  base.createObjectStore('notes', { keyPath: 'seanceId' });
  base.createObjectStore('qcmDgfip', { keyPath: 'id' }).createIndex('rubriqueId', 'rubriqueId');
  base.createObjectStore('qcmSessions', { keyPath: 'id' }).createIndex('le', 'le');
  base.createObjectStore('relationnel', { keyPath: 'id' }).createIndex('le', 'le');
  base.createObjectStore('vmSeuils', { keyPath: 'id' }).createIndex('famille', 'famille');
  base.createObjectStore('vmSessions', { keyPath: 'id' }).createIndex('le', 'le');

  const aides = base.createObjectStore('aides', { keyPath: 'id' });
  aides.createIndex('le', 'le');
  aides.createIndex('itemId', 'itemId');

  base.createObjectStore('journal', { keyPath: 'id' }).createIndex('matiere', 'matiere');
  base.createObjectStore('competences', { keyPath: 'clef' }).createIndex('matiere', 'matiere');
  base.createObjectStore('difficultes', { keyPath: 'id' });

  const revisions = base.createObjectStore('revisions', { keyPath: 'id' });
  revisions.createIndex('carteId', 'carteId');
  revisions.createIndex('le', 'le');

  const operations = base.createObjectStore('operations', { keyPath: 'id' });
  operations.createIndex('hlc', 'hlc');
  operations.createIndex('cible', 'cible');
  operations.createIndex('lot', 'lot');
}

/** Les noms des magasins de la version 14, pour les contrôles d'après-migration. */
export const MAGASINS_V14 = [
  'etat',
  'cartes',
  'fiches',
  'quiz',
  'jours',
  'nback',
  'seances',
  'notes',
  'qcmDgfip',
  'qcmSessions',
  'relationnel',
  'vmSeuils',
  'vmSessions',
  'aides',
  'journal',
  'competences',
  'difficultes',
  'revisions',
  'operations',
];
