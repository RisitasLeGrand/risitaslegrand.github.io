/**
 * Le sens branche → tâche : ce qu'il coche, et surtout ce qu'il refuse.
 *
 *   npm run essais:retour-de-branche
 *
 * Trois choses s'éprouvent ici :
 *
 * - **le registre ne ment pas sur l'activité**. Chaque action déclare si son
 *   fait compte ; la suite compare cette déclaration à `TYPES_SERIE`. C'est
 *   le garde-fou de la recopie : si l'un des deux bouge sans l'autre, le
 *   double comptage revient en silence ;
 * - **une tâche liée cède son fait**, et seulement quand sa branche en
 *   produit un qui compte. La faire taire sans contrepartie supprimerait son
 *   activité ;
 * - **les quatre refus**, qui sont la moitié de la règle : un jour que la
 *   série ne prévoit pas, une exception déjà posée, une tâche déjà faite,
 *   une tâche abandonnée.
 */
import { TYPES_SERIE } from '../src/lib/odyssee/activite';
import { ACTIONS_LIABLES, laTacheCedeSonFait } from '../src/lib/odyssee/liaison-branches';
import { decisionDeRetour, retourDeBranche } from '../src/lib/odyssee/retour-de-branche';
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

/* ── 3. La décision de retour ──────────────────────────────────────────── */
console.log('\nCe que le geste de branche fait à la tâche');

v(
  'une tâche simple liée se clôt',
  decisionDeRetour(liee('sport.seance'), 'sport.seance', '2026-10-12'),
  { quoi: 'clore' },
);
v(
  'une tâche répétée reçoit une exception, le jour que la règle prévoit',
  decisionDeRetour(liee('sport.seance', { serie: lmv }), 'sport.seance', '2026-10-12'),
  { quoi: 'occurrence', jourPrevu: '2026-10-12' },
);
v(
  'mais pas un jour que la règle ne prévoit pas',
  decisionDeRetour(liee('sport.seance', { serie: lmv }), 'sport.seance', '2026-10-13'),
  { quoi: 'rien', pourquoi: 'La règle ne prévoit pas d’occurrence ce jour-là.' },
);
v(
  'ni par-dessus une exception déjà posée',
  decisionDeRetour(liee('sport.seance', { serie: lmv }), 'sport.seance', '2026-10-12', {
    dejaExcepte: true,
  }),
  { quoi: 'rien', pourquoi: 'Cette occurrence porte déjà une exception.' },
);
v(
  'une tâche déjà faite ne se refait pas',
  decisionDeRetour(liee('sport.seance', { faiteLe: '2026-10-12' }), 'sport.seance', '2026-10-12'),
  { quoi: 'rien', pourquoi: 'La tâche est déjà faite.' },
);
v(
  'une tâche abandonnée ne se coche pas',
  decisionDeRetour(
    liee('sport.seance', { abandonneeLe: '2026-10-11' }),
    'sport.seance',
    '2026-10-12',
  ),
  { quoi: 'rien', pourquoi: 'La tâche est abandonnée.' },
);
v(
  'une tâche qui vise une autre action n’est pas concernée',
  decisionDeRetour(liee('odyssee.quete'), 'sport.seance', '2026-10-12'),
  { quoi: 'rien', pourquoi: 'La tâche ne vise pas cette action.' },
);
v(
  'et une action qui ne coche rien ne coche rien',
  decisionDeRetour(liee('branche.inventee'), 'branche.inventee', '2026-10-12'),
  { quoi: 'rien', pourquoi: 'L’action « branche.inventee » ne coche aucune tâche.' },
);

/* « Ouvre l'écran » ne crée pas le fait, mais faire le fait coche quand même :
   c'est tout l'intérêt du sens retour, et le registre le dit déjà. */
v(
  'un check-in fait dans sa branche coche sa tâche',
  decisionDeRetour(liee('odyssee.checkin'), 'odyssee.checkin', '2026-10-12'),
  { quoi: 'clore' },
);
v(
  'un QCM passé coche sa tâche, bien qu’on ne puisse pas le créer d’un geste',
  decisionDeRetour(liee('revision.qcm'), 'revision.qcm', '2026-10-12'),
  { quoi: 'clore' },
);

/* ── 4. Le tri des tâches ──────────────────────────────────────────────── */
console.log('\nLe geste ne touche que les tâches qui le visent');

const lot: Tache[] = [
  liee('sport.seance', { id: 'A' }),
  liee('odyssee.quete', { id: 'B' }),
  tache({ id: 'C' }),
  liee('sport.seance', { id: 'D', faiteLe: '2026-10-12' }),
];
const retour = retourDeBranche(lot, 'sport.seance', '2026-10-12');
v('deux tâches examinées sur quatre', retour.map((r) => r.tache.id), ['A', 'D']);
v('la première se clôt', retour[0].geste, { quoi: 'clore' });
v(
  'la seconde est rendue avec sa raison, plutôt que tue',
  retour[1].geste,
  { quoi: 'rien', pourquoi: 'La tâche est déjà faite.' },
);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
