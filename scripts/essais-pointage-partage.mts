/**
 * Le geste de pointage : ce qu'il écrit, et surtout ce qu'il n'écrit pas.
 *
 *   npm run essais:pointage-partage
 *
 * Trois choses s'éprouvent ici, et la troisième est celle qui protège un
 * chiffre que personne ne regarde :
 *
 * - **la décision est exhaustive**. Chacune des actions du registre est
 *   passée, et chaque refus porte sa raison ;
 * - **le registre et les écrivains disent la même chose**. Une action
 *   « deux-sens » sans écrivain promettrait une écriture qui n'arrive pas ;
 *   un écrivain non déclaré écrirait dans une branche non autorisée ;
 * - **« un fait par geste, jamais deux »**. La règle ne tient que parce que
 *   `activite.ts` ne compte pas les types de ce lot. Rien dans le code ne le
 *   garantit : c'est une constatation. Elle est donc *surveillée ici*, et cet
 *   essai rougit le jour où quelqu'un ajoute `odyssee.occurrence` à la liste.
 */
import { TYPES_SERIE } from '../src/lib/odyssee/activite';
import {
  ACTIONS_LIABLES,
  actionLiable,
  cocheLaTache,
  ecritDansLaBranche,
} from '../src/lib/odyssee/liaison-branches';
import { actionsEcrivables, decisionDePointage } from '../src/lib/odyssee/pointage-partage';
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

const tache = (action?: string, cible?: string): Tache => ({
  id: 'T1',
  titre: 'Quelque chose',
  domaine: 'odyssee',
  faiteLe: null,
  creeeLe: '2026-10-15T08:00:00.000Z',
  majLe: '2026-10-15T08:00:00.000Z',
  lien: action ? { branche: actionLiable(action)?.branche ?? '?', action, cible } : null,
});

/* ── 1. La décision, action par action ─────────────────────────────────── */
console.log('\nLa décision de pointage');

v('sans lien, rien', decisionDePointage(tache()).quoi, 'rien');
v(
  'sans lien, la raison est affichable',
  (decisionDePointage(tache()) as { pourquoi: string }).pourquoi,
  'La tâche ne vise aucune branche.',
);
v('action inconnue, rien', decisionDePointage(tache('branche.inventee')).quoi, 'rien');
v(
  'action inconnue, la raison la nomme',
  (decisionDePointage(tache('branche.inventee')) as { pourquoi: string }).pourquoi,
  'Action inconnue : branche.inventee.',
);

for (const a of ACTIONS_LIABLES) {
  const attendu =
    a.sens === 'deux-sens' ? 'ecrire' : a.sens === 'ouvre-ecran' ? 'ouvrir' : 'rien';
  v(`${a.id} (${a.sens}) → ${attendu}`, decisionDePointage(tache(a.id)).quoi, attendu);
}

v(
  'un refus rend la raison du registre, pas un texte inventé',
  (decisionDePointage(tache('revision.qcm')) as { pourquoi: string }).pourquoi,
  actionLiable('revision.qcm')?.pourquoi,
);
v(
  'ouvrir nomme la branche, pour que l’écran sache où aller',
  decisionDePointage(tache('odyssee.checkin')),
  { quoi: 'ouvrir', branche: 'psyche', action: 'odyssee.checkin' },
);

/* ── 2. Registre et écrivains ──────────────────────────────────────────── */
console.log('\nLe registre et les écrivains se répondent');

const declarees = ACTIONS_LIABLES.filter((a) => a.sens === 'deux-sens')
  .map((a) => a.id)
  .sort();
v('toute action deux-sens a son écrivain, et réciproquement', actionsEcrivables(), declarees);

for (const id of actionsEcrivables()) {
  v(`${id} est bien au catalogue des faits`, Boolean(actionLiable(id)), true);
  v(`${id} écrit dans la branche`, ecritDansLaBranche(id), true);
  v(`${id} coche aussi la tâche dans l’autre sens`, cocheLaTache(id), true);
}

/* ── 3. « Un fait par geste, jamais deux » ─────────────────────────────── */
console.log('\nUn fait par geste, jamais deux');

/*
   Trois des quatre types de ce lot ne comptent jamais. Le quatrième,
   `odyssee.occurrence`, compte depuis la phase 8 — mais la protection n'a
   pas disparu, elle a CHANGÉ DE PLACE. Elle était ici, dans la liste des
   types comptés ; elle est désormais à la projection, qui n'émet pas ce
   fait pour une tâche liée. Un `odyssee.occurrence` qui existe est donc,
   par construction, celui d'une tâche non liée, et le compter ne double
   rien. Le contrôle de ce déplacement est dans `essais:revue`.
*/
for (const type of ['odyssee.etape-cochee', 'odyssee.exception-scellee', 'odyssee.report']) {
  v(`${type} ne compte pas dans l’activité`, TYPES_SERIE.includes(type), false);
}
v('odyssee.occurrence compte, depuis la phase 8', TYPES_SERIE.includes('odyssee.occurrence'), true);

v(
  'les faits que le pointage écrit, eux, comptent — sinon le geste ne vaudrait rien',
  actionsEcrivables().filter((id) => !TYPES_SERIE.includes(id)),
  [],
);

/* ── 4. La correction du 15 octobre ────────────────────────────────────── */
console.log('\nLa séance de révision ne se crée plus d’un geste');

v(
  'revision.seance est passée à branche-vers-tache',
  actionLiable('revision.seance')?.sens,
  'branche-vers-tache',
);
v('elle ne s’écrit donc pas depuis le calendrier', ecritDansLaBranche('revision.seance'), false);
v('mais la faire coche toujours la tâche', cocheLaTache('revision.seance'), true);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
