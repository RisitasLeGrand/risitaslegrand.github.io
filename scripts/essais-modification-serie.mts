/**
 * Modifier ou supprimer une série — phase 4 du prompt 38.
 *
 *   npm run essais:modification-serie
 *
 * Deux exigences du prompt sont éprouvées ici, et ce sont les deux plus
 * lourdes : « **le passé pointé reste intact dans tous les cas** » et
 * « **aucune série perdue ni réécrite en silence** ».
 *
 * La seconde ne se vérifie pas en regardant ce que le code écrit : elle se
 * vérifie en regardant ce qu'il **annonce avant** d'écrire. D'où les essais
 * sur les avertissements et sur les pointages orphelins, qui sont le cœur de
 * ce module et non sa décoration.
 */
import {
  LIBELLE_PORTEE,
  planifierAbandon,
  planifierModification,
  pointagesOrphelins,
} from '../src/lib/odyssee/modification-serie';
import { occurrences, type Serie } from '../src/lib/odyssee/repetition';
import { idOccurrence, type Occurrence, type Tache } from '../src/lib/odyssee/modele';

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

const quotidienne: Serie = {
  depuis: '2026-10-01',
  repetition: { type: 'jours', tous: 1 },
  fin: { type: 'jamais' },
  heure: '08:00',
};

const tache = (serie: Serie | null = quotidienne): Tache => ({
  id: 'T1',
  titre: 'Relire une fiche',
  domaine: 'ordre',
  echeance: null,
  faiteLe: null,
  abandonneeLe: null,
  motifAbandon: null,
  note: '',
  creeeLe: '2026-10-01T09:00:00.000Z',
  majLe: '2026-10-01T09:00:00.000Z',
  serie,
});

const pointee = (jour: string): Occurrence => ({
  id: idOccurrence('T1', jour),
  tacheId: 'T1',
  jourPrevu: jour,
  etat: 'pointee',
  jourPorte: null,
  heure: null,
  le: `${jour}T08:05:00.000Z`,
  motifAbandon: null,
  majLe: `${jour}T08:05:00.000Z`,
});

/* ══════════════════════════════════════════════════════════════════════════
   Cette occurrence seulement
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCETTE OCCURRENCE SEULEMENT');

const neufHeures: Serie = { ...quotidienne, heure: '09:00' };
const cetteFois = planifierModification(tache(), '2026-10-15', 'cette-fois', neufHeures);

/*
   LA SEULE PORTÉE QUI NE TOUCHE PAS LA SÉRIE, et c'est pour cela qu'elle est
   la plus sûre. Si elle réécrivait la tâche, « cette fois seulement » serait
   un mensonge.
*/
v('la tâche n’est pas réécrite', cetteFois.tache, undefined);
v('aucune seconde tâche', cetteFois.suite, undefined);
v('une exception, et une seule', cetteFois.occurrence?.etat, 'modifiee');
v('elle porte l’heure de remplacement', cetteFois.occurrence?.heure, '09:00');
v('et le jour visé', cetteFois.occurrence?.jourPrevu, '2026-10-15');
v('rien à signaler', cetteFois.avertissements, []);

/* ══════════════════════════════════════════════════════════════════════════
   Celle-ci et les suivantes
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCELLE-CI ET LES SUIVANTES');

const scindee = planifierModification(tache(), '2026-10-15', 'celle-ci-et-suivantes', neufHeures);

v('la première moitié s’arrête la veille', scindee.tache?.serie?.fin, {
  type: 'date',
  jusquAu: '2026-10-14',
});
/*
   « Le passé reste intact » veut dire exactement ceci : la première moitié
   garde la règle et l'heure d'origine. Lui appliquer la nouvelle heure
   réécrirait rétroactivement ce qui a déjà eu lieu.
*/
v('et garde l’heure d’origine : le passé n’est pas réécrit', scindee.tache?.serie?.heure, '08:00');
v('la suite reprend au jour choisi', scindee.suite?.serie?.depuis, '2026-10-15');
v('avec la nouvelle heure', scindee.suite?.serie?.heure, '09:00');
v('la suite n’hérite ni d’une clôture ni d’un abandon', [
  scindee.suite?.faiteLe,
  scindee.suite?.abandonneeLe,
], [null, null]);
v(
  'les deux moitiés couvrent les mêmes jours que la série d’origine',
  [
    ...occurrences(scindee.tache!.serie!, '2026-10-01', '2026-10-20'),
    ...occurrences(scindee.suite!.serie!, '2026-10-01', '2026-10-20'),
  ],
  occurrences(quotidienne, '2026-10-01', '2026-10-20'),
);

/*
   Scinder AVANT la première occurrence ne laisse rien à garder. Le dire est
   mieux que de fabriquer une moitié vide : la tâche prend la nouvelle règle,
   et l'écran l'annonce.
*/
const avantTout = planifierModification(tache(), '2026-09-01', 'celle-ci-et-suivantes', neufHeures);
v('scinder avant la première occurrence ne fabrique pas de moitié vide', avantTout.suite, undefined);
v('et le dit', avantTout.avertissements.length, 1);

/* ══════════════════════════════════════════════════════════════════════════
   Toute la série, et les pointages qu’elle laisserait de côté
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nTOUTE LA SÉRIE');

/*
   Le piège : les occurrences sont CALCULÉES, et la clé d'une exception est
   « tâche / jour ». Passer d'une série quotidienne à une série hebdomadaire
   laisse donc, hors de la nouvelle règle, les pointages des jours qui ne
   tombent plus.

   Les effacer reviendrait à nier un fait — « j'ai fait cette chose le 13 ».
   Le module ne les efface jamais : il les DIT, pour que l'écran puisse le
   dire avant que la personne confirme.
*/
const lundis: Serie = {
  depuis: '2026-10-05',
  repetition: { type: 'semaines', tous: 1, jours: [1] },
  fin: { type: 'jamais' },
  heure: '08:00',
};
const faits = [pointee('2026-10-12'), pointee('2026-10-13'), pointee('2026-10-14')];

v(
  'le 12 est un lundi : il survit à la nouvelle règle',
  pointagesOrphelins(faits, lundis, '2026-10-15'),
  ['2026-10-13', '2026-10-14'],
);

const toute = planifierModification(tache(), '2026-10-15', 'toute-la-serie', lundis, faits, '2026-10-15');
v('la règle est remplacée', toute.tache?.serie?.repetition, { type: 'semaines', tous: 1, jours: [1] });
v('les deux pointages orphelins sont nommés', toute.pointagesOrphelins, ['2026-10-13', '2026-10-14']);
v('et un avertissement les annonce', toute.avertissements.length, 1);
/*
   AUCUNE SUPPRESSION. Le plan ne porte pas d'effacement, et c'est la garantie
   que « le passé pointé reste intact » : il n'y a pas de chemin par lequel
   une confirmation pourrait effacer un pointage.
*/
v('le plan n’efface aucune exception', 'occurrence' in toute && toute.occurrence !== undefined, false);

v(
  'sans pointage orphelin, rien n’est annoncé',
  planifierModification(tache(), '2026-10-15', 'toute-la-serie', neufHeures, faits, '2026-10-15')
    .avertissements,
  [],
);
v(
  'une tâche sans série ne se modifie pas en silence',
  planifierModification(tache(null), '2026-10-15', 'toute-la-serie', neufHeures).avertissements,
  ['Cette tâche n’est pas répétée : il n’y a pas de série à modifier.'],
);

/* ══════════════════════════════════════════════════════════════════════════
   L’abandon
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nL’ABANDON');

const unFois = planifierAbandon(tache(), '2026-10-15', 'cette-fois', 'imprevu', '2026-10-15T20:00:00.000Z');
v('cette fois : une exception abandonnée', unFois.occurrence?.etat, 'abandonnee');
v('avec son motif, comme pour une tâche', unFois.occurrence?.motifAbandon, 'imprevu');
v('et son heure : c’est ce qu’elle garde', unFois.occurrence?.le, '2026-10-15T20:00:00.000Z');
v('la tâche n’est pas touchée', unFois.tache, undefined);

const suite = planifierAbandon(tache(), '2026-10-15', 'celle-ci-et-suivantes', 'imprevu', '2026-10-15T20:00:00.000Z');
v('les suivantes : la série s’arrête la veille', suite.tache?.serie?.fin, {
  type: 'date',
  jusquAu: '2026-10-14',
});
v('la tâche n’est pas abandonnée pour autant', suite.tache?.abandonneeLe, null);
v('et l’arrêt est annoncé', suite.avertissements.length, 1);

const tout = planifierAbandon(tache(), '2026-10-15', 'toute-la-serie', 'trop-ambitieux', '2026-10-15T20:00:00.000Z');
v('toute la série : la tâche est abandonnée', tout.tache?.abandonneeLe, '2026-10-15');
v('avec son motif', tout.tache?.motifAbandon, 'trop-ambitieux');
/*
   Abandonner n'est pas supprimer — la décision est celle de modele.ts,
   antérieure à ce lot, et elle vaut pour les séries.
*/
v('et la série reste là : abandonner n’est pas supprimer', tout.tache?.serie, quotidienne);
v('ce qui est dit', tout.avertissements.length, 1);

console.log('\nLES LIBELLÉS');
v('les trois portées, et pas une de plus', Object.keys(LIBELLE_PORTEE).length, 3);

console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
