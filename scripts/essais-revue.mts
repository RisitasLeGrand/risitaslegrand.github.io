/**
 * La Revue et les indicateurs : ce qu'une occurrence pointée rapporte.
 *
 *   npm run essais:revue
 *
 * Décision d'Alexis du 15 octobre : « compter l'occurrence SEULEMENT si la
 * tâche n'est pas liée. » C'était la plus chère des trois options, parce
 * qu'une liste de types ne sait pas regarder la tâche d'origine. La règle
 * vit donc à la **projection** : le fait n'est pas émis pour une tâche liée.
 *
 * D'où ce que cette suite éprouve :
 *
 * - **une tâche non liée rapporte**, là où elle ne rapportait rien jusqu'ici
 *   (c'était l'anomalie A-3) ;
 * - **une tâche liée ne rapporte pas deux fois** — son occurrence n'émet
 *   aucun fait, sa branche s'en charge ;
 * - **le déplacement du garde-fou est contrôlé** : le type COMPTE désormais
 *   dans l'activité, et c'est l'absence de fait qui protège. Si la
 *   projection se mettait à émettre pour les tâches liées, le double
 *   comptage reviendrait sans que la liste des types bouge.
 */
import { TYPES_SERIE } from '../src/lib/odyssee/activite';
import { projeterFaitsOdyssee, type ContenuOdyssee } from '../src/lib/odyssee/faits-odyssee';
import type { Occurrence, Tache } from '../src/lib/odyssee/modele';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

const tache = (id: string, action?: string): Tache => ({
  id,
  titre: 'Quelque chose',
  domaine: 'ordre',
  faiteLe: null,
  creeeLe: '2026-10-12T08:00:00.000Z',
  majLe: '2026-10-12T08:00:00.000Z',
  lien: action ? { branche: 'x', action } : null,
});

const pointee = (tacheId: string, jourPrevu = '2026-10-12'): Occurrence => ({
  id: `${tacheId}/${jourPrevu}`,
  tacheId,
  jourPrevu,
  etat: 'pointee',
  jourPorte: null,
  heure: null,
  le: `${jourPrevu}T08:05:00.000Z`,
  motifAbandon: null,
  majLe: `${jourPrevu}T08:05:00.000Z`,
});

const vide = { quetes: [], evenements: [], focus: [], revues: [] } as const;
const projeter = (c: Partial<ContenuOdyssee>) =>
  projeterFaitsOdyssee({ taches: [], ...vide, ...c } as ContenuOdyssee);

const occurrences = (p: ReturnType<typeof projeter>) =>
  p.faits.filter((f) => f.type === 'odyssee.occurrence');
const manque = (p: ReturnType<typeof projeter>, quoi: string) =>
  p.manques.find((m) => m.quoi === quoi)?.combien;

/* ── 1. Une tâche non liée rapporte enfin ──────────────────────────────── */
console.log('\nUne occurrence pointée d’une tâche NON liée compte');

const sansLien = projeter({ taches: [tache('A')], occurrences: [pointee('A')] });
v('un fait est émis', occurrences(sansLien).length, 1);
v(
  'son identifiant est déterministe, pas tiré au sort',
  occurrences(sansLien)[0].id,
  'odyssee.occurrence:A:2026-10-12',
);
v('il est posé à midi du jour prévu', occurrences(sansLien)[0].debut, '2026-10-12T12:00:00.000Z');
v('et son type compte dans l’activité', TYPES_SERIE.includes('odyssee.occurrence'), true);

/* ── 2. Une tâche liée ne compte pas deux fois ─────────────────────────── */
console.log('\nUne occurrence pointée d’une tâche LIÉE n’émet rien');

const liee = projeter({ taches: [tache('B', 'sport.seance')], occurrences: [pointee('B')] });
v('aucun fait d’occurrence', occurrences(liee).length, 0);
v('et c’est dit en manque, pas tu', manque(liee, 'Occurrences pointées d’une tâche liée'), 1);

/*
   Le prédicat est celui de la phase 6 : une tâche liée à une action dont le
   fait NE COMPTE PAS ne cède rien, donc son occurrence compte. Sans cela,
   une tâche liée à une pesée perdrait son activité sans contrepartie.
*/
const lieePesee = projeter({ taches: [tache('C', 'odyssee.poids')], occurrences: [pointee('C')] });
v('liée à une pesée, elle compte quand même', occurrences(lieePesee).length, 1);

const lieeInconnue = projeter({
  taches: [tache('D', 'branche.inventee')],
  occurrences: [pointee('D')],
});
v('liée à une action inconnue, elle compte aussi', occurrences(lieeInconnue).length, 1);

/* ── 3. Ce qui n’est pas une occurrence pointée ────────────────────────── */
console.log('\nSeules les occurrences pointées comptent');

const abandonnee = projeter({
  taches: [tache('E')],
  occurrences: [{ ...pointee('E'), etat: 'abandonnee', motifAbandon: 'pas-le-temps' }],
});
v('une occurrence abandonnée n’émet rien', occurrences(abandonnee).length, 0);

const deplacee = projeter({
  taches: [tache('F')],
  occurrences: [{ ...pointee('F'), etat: 'deplacee', jourPorte: '2026-10-13' }],
});
v('une occurrence déplacée non plus', occurrences(deplacee).length, 0);

const orpheline = projeter({ taches: [], occurrences: [pointee('G')] });
v('une occurrence sans tâche n’émet rien', occurrences(orpheline).length, 0);
v(
  'et elle est comptée en manque',
  manque(orpheline, 'Occurrences pointées sans tâche connue'),
  1,
);

const sansDomaine = projeter({
  taches: [{ ...tache('H'), domaine: null }],
  occurrences: [pointee('H')],
});
v('une tâche sans domaine n’émet rien', occurrences(sansDomaine).length, 0);

/* ── 4. Le coffre fermé est dit, pas deviné ────────────────────────────── */
console.log('\nCe que le coffre fermé empêche de compter');

const coffreFerme = projeter({
  taches: [tache('I')],
  occurrences: [pointee('I')],
  occurrencesIllisibles: 3,
});
v(
  'les exceptions scellées non lues sont rendues en manque',
  manque(coffreFerme, 'Exceptions scellées non lues'),
  3,
);
v('et ce qui est lisible compte normalement', occurrences(coffreFerme).length, 1);

/* ── 5. Deux appels donnent les mêmes faits ────────────────────────────── */
console.log('\nLa projection est déterministe');

const a = projeter({ taches: [tache('J')], occurrences: [pointee('J')] });
const b = projeter({ taches: [tache('J')], occurrences: [pointee('J')] });
v('mêmes identifiants, deux fois', occurrences(a).map((f) => f.id), occurrences(b).map((f) => f.id));

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
