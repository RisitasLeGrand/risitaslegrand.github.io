/**
 * Les tâches à étapes — phase 3 du prompt 38.
 *
 *   npm run essais:etapes
 *
 * Le prompt demande trois choses de cette phase : la remise à zéro par
 * occurrence, l'avancement, et la fin de la tâche. Les trois sont ici, et
 * avec elles le réordonnancement, qui n'est pas cosmétique : c'est lui qui
 * décide si deux appareils peuvent réordonner sans que l'un efface l'autre.
 */
import {
  avancement,
  jourDeLOccurrence,
  cochagesDeLOccurrence,
  cochees,
  deplacer,
  etapesNonFaites,
  etapesOrdonnees,
  rangEntre,
  renumeroter,
  seClotToutSeul,
} from '../src/lib/odyssee/etapes';
import { controlerEtapeCochee, idEtapeCochee, type Etape, type EtapeCochee } from '../src/lib/odyssee/modele';

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

const etape = (id: string, rang: number, intitule = id): Etape => ({ id, rang, intitule });

const coche = (jour: string, etapeId: string, tacheId = 'T1'): EtapeCochee => ({
  id: idEtapeCochee(tacheId, jour, etapeId),
  tacheId,
  jourPrevu: jour,
  etapeId,
  le: `${jour}T08:00:00.000Z`,
  majLe: `${jour}T08:00:00.000Z`,
});

const SEPT = [
  etape('a', 10), etape('b', 20), etape('c', 30), etape('d', 40),
  etape('e', 50), etape('f', 60), etape('g', 70),
];

/* ══════════════════════════════════════════════════════════════════════════
   L'avancement
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nL’AVANCEMENT');

v(
  'trois sur sept',
  avancement(SEPT, [coche('2026-10-15', 'a'), coche('2026-10-15', 'c'), coche('2026-10-15', 'e')]).texte,
  '3 / 7',
);
v('zéro sur sept au départ', avancement(SEPT, []).texte, '0 / 7');
v('sept sur sept est complet', avancement(SEPT, SEPT.map((e) => coche('2026-10-15', e.id))).complet, true);

/*
   Une tâche SANS étapes ne se clôt jamais toute seule. « Zéro sur zéro » n'est
   pas « tout est fait » : c'est « il n'y avait rien à cocher ». Traiter le vide
   comme complet fermerait toute tâche simple à sa création — le genre de
   défaut qui se voit le jour où l'on crée sa première tâche, et pas avant.
*/
v('une tâche sans étapes n’affiche aucun avancement', avancement([], []).texte, '');
v('et ne se clôt pas toute seule', seClotToutSeul([], []), false);
v('une tâche à étapes se clôt quand tout est coché',
  seClotToutSeul(SEPT, SEPT.map((e) => coche('2026-10-15', e.id))), true);
v('mais pas avant', seClotToutSeul(SEPT, [coche('2026-10-15', 'a')]), false);

/*
   Un cochage dont l'étape a été supprimée de la tâche est ORPHELIN. Le
   compter donnerait « 4 / 3 », un avancement supérieur au total — absurde à
   l'écran et faux dans les indicateurs. Il n'est pas effacé pour autant : il
   appartient à l'historique du jour où l'étape existait.
*/
const amputee = [etape('a', 10), etape('b', 20), etape('c', 30)];
v(
  'un cochage orphelin ne compte pas, et ne donne jamais « 4 / 3 »',
  avancement(amputee, [
    coche('2026-10-15', 'a'), coche('2026-10-15', 'b'),
    coche('2026-10-15', 'c'), coche('2026-10-15', 'disparue'),
  ]).texte,
  '3 / 3',
);

/* ══════════════════════════════════════════════════════════════════════════
   Chaque occurrence repart d'une liste décochée
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCHAQUE OCCURRENCE REPART D’UNE LISTE DÉCOCHÉE');

const hier = [coche('2026-10-14', 'a'), coche('2026-10-14', 'b'), coche('2026-10-14', 'c')];
const aujourdhui = [coche('2026-10-15', 'a')];
const tous = [...hier, ...aujourdhui];

v(
  'le jour d’avant comptait trois',
  avancement(SEPT, cochagesDeLOccurrence(tous, 'T1', '2026-10-14')).texte,
  '3 / 7',
);
v(
  'et aujourd’hui repart à une, sans remise à zéro nocturne',
  avancement(SEPT, cochagesDeLOccurrence(tous, 'T1', '2026-10-15')).texte,
  '1 / 7',
);
v(
  'un jour jamais touché est vide, et c’est la vérité',
  avancement(SEPT, cochagesDeLOccurrence(tous, 'T1', '2026-10-16')).texte,
  '0 / 7',
);
v(
  'les cochages d’une autre tâche n’entrent pas',
  cochagesDeLOccurrence([...tous, coche('2026-10-15', 'a', 'T2')], 'T1', '2026-10-15').length,
  1,
);
v(
  'les étapes d’hier restent dans l’historique d’hier',
  cochagesDeLOccurrence(tous, 'T1', '2026-10-14').map((c) => c.etapeId),
  ['a', 'b', 'c'],
);

/* ══════════════════════════════════════════════════════════════════════════
   La fin à la main — décision 2c
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLA CLÔTURE À LA MAIN');

/*
   Rien n'est écrit pour les étapes restantes : l'absence de cochage EST le
   non-fait. Un enregistrement « non faite à telle heure » aurait inventé une
   donnée que personne n'a saisie.
*/
v(
  'les étapes restantes se lisent, dans l’ordre',
  etapesNonFaites(SEPT, [coche('2026-10-15', 'b'), coche('2026-10-15', 'd')]).map((e) => e.id),
  ['a', 'c', 'e', 'f', 'g'],
);
v('tout coché ne laisse rien', etapesNonFaites(SEPT, SEPT.map((e) => coche('2026-10-15', e.id))), []);

/* ══════════════════════════════════════════════════════════════════════════
   L'ordre et le réordonnancement
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nL’ORDRE');

v(
  'le rang décide',
  etapesOrdonnees([etape('c', 30), etape('a', 10), etape('b', 20)]).map((e) => e.id),
  ['a', 'b', 'c'],
);
/*
   Deux appareils peuvent poser le même rang sur deux étapes différentes : la
   fusion garde les deux. Sans second critère, l'ordre dépendrait de celui de
   lecture de la base et différerait d'un appareil à l'autre, pour les mêmes
   données.
*/
v(
  'à rang égal, l’identifiant départage — et l’ordre est le même partout',
  etapesOrdonnees([etape('z', 10), etape('a', 10)]).map((e) => e.id),
  ['a', 'z'],
);

console.log('\nLE RÉORDONNANCEMENT');

v('entre deux rangs, le milieu', rangEntre(10, 20), 15);
v('en tête, un rang plus bas', rangEntre(null, 10), 9);
v('en queue, un rang plus haut', rangEntre(70, null), 71);
v('une liste vide part de zéro', rangEntre(null, null), 0);

/*
   UN SEUL RANG CHANGE. C'est tout l'enjeu : renuméroter la liste ferait de
   chaque glissement une réécriture de la tâche entière, et deux appareils qui
   déplacent chacun une étape différente s'effaceraient l'un l'autre à la
   fusion.
*/
v('déplacer « g » en troisième position ne change que son rang', deplacer(SEPT, 'g', 2), { rang: 25 });
v('en tête', deplacer(SEPT, 'g', 0), { rang: 9 });
v('en queue', deplacer(SEPT, 'a', 7), { rang: 71 });
v('une étape inconnue ne se déplace pas', deplacer(SEPT, 'inconnue', 2), null);

/*
   La place entre deux flottants n'est pas infinie. Quand elle est épuisée, le
   moteur le DIT au lieu de rendre un rang qui écraserait un voisin : c'est
   une valeur de retour, pas un défaut qu'on découvre en production.
*/
const colles = [etape('a', 1), etape('b', 1 + Number.EPSILON), etape('c', 3)];
v('plus de place : le moteur le dit', rangEntre(1, 1 + Number.EPSILON), null);
v('et le déplacement demande une renumérotation', deplacer(colles, 'c', 1), { renumeroter: true });
v(
  'renuméroter redonne de l’air, par pas de dix',
  renumeroter(colles).map((e) => e.rang),
  [10, 20, 30],
);
v(
  'et conserve l’ordre',
  renumeroter([etape('c', 30), etape('a', 10), etape('b', 20)]).map((e) => e.id),
  ['a', 'b', 'c'],
);

/* ══════════════════════════════════════════════════════════════════════════
   La clé déterministe
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLA CLÉ DU COCHAGE');

v(
  'un cochage s’identifie « tâche/jour/étape »',
  idEtapeCochee('T1', '2026-10-15', 'a'),
  'T1/2026-10-15/a',
);
/*
   Deux appareils qui cochent la même étape le même jour visent la MÊME cible.
   C'est ce qui empêche la fusion de garder deux lignes pour un seul geste.
*/
v(
  'deux appareils, le même geste, une seule cible',
  coche('2026-10-15', 'a').id === coche('2026-10-15', 'a').id,
  true,
);
v('un cochage bien formé passe le contrôle', controlerEtapeCochee(coche('2026-10-15', 'a')), []);
v(
  'un identifiant libre est refusé',
  controlerEtapeCochee({ ...coche('2026-10-15', 'a'), id: '01JABCDE' }),
  ['L’identifiant d’un cochage est « tâche/jour/étape » : il n’est pas libre.'],
);
v('et cochees() rend bien l’ensemble', [...cochees(hier)], ['a', 'b', 'c']);

/* ══════════════════════════════════════════════════════════════════════════
   À quelle occurrence un cochage appartient-il ?
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE JOUR DE L’OCCURRENCE');

const base = {
  id: 'T1', titre: 'Dossier', domaine: 'ordre', echeance: null,
  faiteLe: null, abandonneeLe: null, motifAbandon: null, note: '',
  creeeLe: '2026-10-10T09:00:00.000Z', majLe: '2026-10-10T09:00:00.000Z',
} as const;

const repetee = { ...base, serie: { depuis: '2026-10-01', repetition: { type: 'jours', tous: 1 }, fin: { type: 'jamais' }, heure: null } } as const;

v('une tâche répétée suit le jour demandé', jourDeLOccurrence(repetee, '2026-10-15'), '2026-10-15');

/*
   Une tâche SIMPLE s'ancre sur son jour de création, et les deux autres
   candidates sont des pièges :
   — le jour du moment décocherait la liste chaque nuit ;
   — l'échéance SE MODIFIE, et repousser l'échéance d'une tâche à moitié
     cochée orphelinerait tous ses cochages d'un coup.
*/
v('une tâche simple s’ancre sur sa création', jourDeLOccurrence(base, '2026-10-15'), '2026-10-10');
v('et le jour demandé n’y change rien : la liste ne se décoche pas la nuit',
  jourDeLOccurrence(base, '2026-10-16'), jourDeLOccurrence(base, '2026-10-15'));
v('déplacer l’échéance ne déplace pas l’ancre',
  jourDeLOccurrence({ ...base, echeance: '2026-12-01' }), jourDeLOccurrence(base));

console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
