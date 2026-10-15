/**
 * Le registre des liaisons ne ment pas sur l'activité — prompt 38, puis 39.
 *
 *   npm run essais:liaison-activite
 *
 * Ce fichier est ce qui **survit** à la suppression de `retour-de-branche.ts`
 * (prompt 39, phase 3). Le module disparaît parce que la dérivation à la
 * lecture le remplace ; ses deux premières sections d'essai, elles, ne
 * portaient pas sur lui et n'avaient aucune raison de partir avec.
 *
 * Deux choses s'éprouvent ici, et elles tiennent sans lui :
 *
 * - **le registre ne ment pas sur l'activité.** Chaque action déclare si
 *   son fait compte ; la suite compare cette déclaration à `TYPES_SERIE`.
 *   C'est le garde-fou de la recopie : si l'un des deux bouge sans l'autre,
 *   le double comptage revient en silence. Il est **plus** nécessaire
 *   qu'avant, pas moins : la dérivation s'appuie entièrement sur cette
 *   déclaration pour décider si une branche coche une tâche ;
 * - **une tâche liée cède son fait**, et seulement quand sa branche en
 *   produit un qui compte. La faire taire sans contrepartie supprimerait
 *   son activité.
 *
 * Les quatre refus de `decisionDeRetour` sont partis avec le module. Ce
 * qu'ils protégeaient — ne pas cocher un jour non prévu, ne pas écraser une
 * exception, ne pas toucher une tâche faite ou abandonnée — est désormais
 * tenu par `pointage-derive.ts`, dont les essais les reprennent sous une
 * autre forme : l'exception fait autorité, et rien ne s'écrit.
 */
import { TYPES_SERIE } from '../src/lib/odyssee/activite';
import { ACTIONS_LIABLES, laTacheCedeSonFait } from '../src/lib/odyssee/liaison-branches';
import type { Serie } from '../src/lib/odyssee/repetition';
import type { Tache } from '../src/lib/odyssee/modele';

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

const tache = (p: Partial<Tache> = {}): Tache => ({
  id: 'T1',
  titre: 'Quelque chose',
  domaine: 'odyssee',
  faiteLe: null,
  creeeLe: '2026-10-12T08:00:00.000Z',
  majLe: '2026-10-12T08:00:00.000Z',
  ...p,
});

const liee = (action: string, p: Partial<Tache> = {}): Tache =>
  tache({ lien: { branche: 'x', action }, ...p });

/* Lundi, mercredi, vendredi. 2026-10-12 est un lundi, 2026-10-13 un mardi. */
const lmv: Serie = {
  depuis: '2026-10-12',
  repetition: { type: 'semaines', tous: 1, jours: [1, 3, 5] },
  fin: { type: 'jamais' },
  heure: null,
};

/* ── 1. Le registre et TYPES_SERIE disent la même chose ────────────────── */
console.log('\nLe registre ne ment pas sur l’activité');

const declareesComptees = ACTIONS_LIABLES.filter((a) => a.compteDansLActivite).map((a) => a.id).sort();
const reellementComptees = ACTIONS_LIABLES.filter((a) => TYPES_SERIE.includes(a.id)).map((a) => a.id).sort();
v('chaque action déclare justement si son fait compte', declareesComptees, reellementComptees);
v(
  'et quatre actions du registre ne comptent pas — sinon la règle n’aurait pas de mordant',
  ACTIONS_LIABLES.filter((a) => !a.compteDansLActivite).map((a) => a.id),
  ['odyssee.poids', 'odyssee.hydratation', 'odyssee.operation', 'odyssee.medicament'],
);

/* ── 2. Céder son fait ─────────────────────────────────────────────────── */
console.log('\nUne tâche liée cède son fait à sa branche');

v('liée au sport, elle cède', laTacheCedeSonFait(liee('sport.seance')), true);
v('liée à une quête, elle cède', laTacheCedeSonFait(liee('odyssee.quete')), true);
v('sans lien, elle garde son fait', laTacheCedeSonFait(tache()), false);
v('liée à une action inconnue, elle garde', laTacheCedeSonFait(liee('branche.inventee')), false);
v(
  'liée à une pesée, elle garde — la branche n’écrit rien de compté',
  laTacheCedeSonFait(liee('odyssee.poids')),
  false,
);
v(
  'liée à une prise déclarée, elle garde aussi',
  laTacheCedeSonFait(liee('odyssee.medicament')),
  false,
);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
