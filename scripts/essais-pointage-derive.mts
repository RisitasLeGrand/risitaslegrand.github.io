/**
 * Le sens branche → tâche, calculé — prompt 39, C2.
 *
 *   npm run essais:pointage-derive
 *
 * Ce que ces essais protègent, dans l'ordre où la règle peut céder :
 *
 * - **l'exception l'emporte sur le calcul**, dans les deux sens. Si le
 *   calcul pouvait contredire un `depointee`, « Pas finalement » serait un
 *   bouton sans effet : il effacerait, et l'affichage suivant recocherait ;
 * - **une tâche qui ne cède pas son fait n'est jamais cochée par une
 *   branche.** C'est le même prédicat qu'au prompt 38, et un essai vérifie
 *   que les deux ne divergent pas ;
 * - **scellé et coffre fermé rend « on ne sait pas »**, jamais « à faire ».
 *   Un faux « à faire » est une affirmation, et elle est fausse une fois
 *   sur deux ;
 * - **le jour compte.** Un fait d'hier ne coche pas l'occurrence
 *   d'aujourd'hui, sans quoi une séance cocherait toute la série.
 */
import {
  gesteDeRetrait,
  pointageDeLOccurrence,
  type FaitObserve,
} from '../src/lib/odyssee/pointage-derive';
import { ACTIONS_LIABLES, laTacheCedeSonFait } from '../src/lib/odyssee/liaison-branches';
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
const vrai = (t: string, c: boolean) => v(t, c, true);

const JOUR = '2026-10-15';
const HIER = '2026-10-14';

const tache = (lien: Tache['lien'], p: Partial<Tache> = {}): Tache =>
  ({
    id: '01TACHE',
    titre: 'T',
    domaine: 'corps',
    echeance: null,
    faiteLe: null,
    abandonneeLe: null,
    motifAbandon: null,
    note: '',
    creeeLe: `${JOUR}T08:00:00.000Z`,
    majLe: `${JOUR}T08:00:00.000Z`,
    serie: { depuis: JOUR, repetition: { type: 'jours', tous: 1 }, fin: { type: 'jamais' }, heure: null },
    ...(lien ? { lien } : {}),
    ...p,
  }) as Tache;

const fait = (type: string, jourLogique = JOUR): FaitObserve => ({ type, jourLogique });
const ouvert = { coffreOuvert: true };

/* Une action « deux-sens » qui compte et n'est pas scellée : la séance de sport. */
const SPORT = ACTIONS_LIABLES.find((a) => a.id === 'sport.seance')!;
/* Une action comptée dont la branche est scellée. */
const SCELLEE = ACTIONS_LIABLES.find((a) => a.sousCoffre && a.compteDansLActivite);
/* Une action qui NE compte pas : la tâche garde son propre fait. */
const SANS_COMPTE = ACTIONS_LIABLES.find((a) => !a.compteDansLActivite)!;

console.log('\n\x1b[1mL’exception l’emporte sur le calcul, dans les deux sens\x1b[0m');
{
  const t = tache({ action: SPORT.id, cible: null } as Tache['lien']);
  v(
    'un « dépointée » tient tête à un fait de branche bien présent',
    pointageDeLOccurrence(t, JOUR, { ...ouvert, exception: { etat: 'depointee' }, faits: [fait(SPORT.id)] }),
    { faite: false, origine: 'exception', lisible: true },
  );
  v(
    'une « pointée » vaut même sans aucun fait',
    pointageDeLOccurrence(t, JOUR, { ...ouvert, exception: { etat: 'pointee' }, faits: [] }),
    { faite: true, origine: 'exception', lisible: true },
  );
  v(
    'une « abandonnée » n’est pas faite, quoi qu’en dise la branche',
    pointageDeLOccurrence(t, JOUR, { ...ouvert, exception: { etat: 'abandonnee' }, faits: [fait(SPORT.id)] }),
    { faite: false, origine: 'exception', lisible: true },
  );
}

console.log('\n\x1b[1mLe calcul, quand aucune exception ne parle\x1b[0m');
{
  const t = tache({ action: SPORT.id, cible: null } as Tache['lien']);
  v(
    'un fait du jour coche l’occurrence',
    pointageDeLOccurrence(t, JOUR, { ...ouvert, faits: [fait(SPORT.id)] }),
    { faite: true, origine: 'branche', lisible: true },
  );
  v(
    'un fait d’hier ne coche pas aujourd’hui',
    pointageDeLOccurrence(t, JOUR, { ...ouvert, faits: [fait(SPORT.id, HIER)] }),
    { faite: false, origine: 'aucune', lisible: true },
  );
  v(
    'le fait d’une autre action ne coche rien',
    pointageDeLOccurrence(t, JOUR, { ...ouvert, faits: [fait('odyssee.quete')] }),
    { faite: false, origine: 'aucune', lisible: true },
  );
}

console.log('\n\x1b[1mUne tâche qui ne cède pas son fait n’est jamais cochée par une branche\x1b[0m');
{
  const t = tache({ action: SANS_COMPTE.id, cible: null } as Tache['lien']);
  vrai('l’action choisie ne compte effectivement pas', !laTacheCedeSonFait(t));
  v(
    'et son fait, bien présent, ne la coche pas',
    pointageDeLOccurrence(t, JOUR, { ...ouvert, faits: [fait(SANS_COMPTE.id)] }),
    { faite: false, origine: 'aucune', lisible: true },
  );
  v(
    'une tâche sans lien non plus',
    pointageDeLOccurrence(tache(null), JOUR, { ...ouvert, faits: [fait(SPORT.id)] }),
    { faite: false, origine: 'aucune', lisible: true },
  );
}

console.log('\n\x1b[1mScellé et coffre fermé : « on ne sait pas », jamais « à faire »\x1b[0m');
if (SCELLEE) {
  const t = tache({ action: SCELLEE.id, cible: null } as Tache['lien']);
  v(
    'coffre fermé, l’occurrence est illisible',
    pointageDeLOccurrence(t, JOUR, { coffreOuvert: false, faits: [] }),
    { faite: false, origine: 'aucune', lisible: false },
  );
  vrai(
    'et « illisible » ne se confond pas avec « pas faite » : seul le drapeau les sépare',
    pointageDeLOccurrence(t, JOUR, { coffreOuvert: false, faits: [] }).lisible !==
      pointageDeLOccurrence(t, JOUR, { coffreOuvert: true, faits: [] }).lisible,
  );
  v(
    'coffre ouvert, elle redevient lisible et le fait la coche',
    pointageDeLOccurrence(t, JOUR, { coffreOuvert: true, faits: [fait(SCELLEE.id)] }),
    { faite: true, origine: 'branche', lisible: true },
  );
} else {
  echecs += 1;
  console.log('  \x1b[31m✗\x1b[0m aucune action scellée et comptée dans le registre : l’essai ne prouve rien');
}

console.log('\n\x1b[1mLe geste de retrait porte le bon nom\x1b[0m');
{
  const t = tache({ action: SPORT.id, cible: null } as Tache['lien']);
  v(
    'un pointage qu’on a soi-même écrit s’efface',
    gesteDeRetrait(pointageDeLOccurrence(t, JOUR, { ...ouvert, exception: { etat: 'pointee' }, faits: [] })),
    'effacer-l-exception',
  );
  v(
    'un pointage déduit d’une branche se contredit, il ne s’efface pas',
    gesteDeRetrait(pointageDeLOccurrence(t, JOUR, { ...ouvert, faits: [fait(SPORT.id)] })),
    'ecrire-un-depointage',
  );
  v(
    'et ce qui n’est pas fait n’a rien à défaire',
    gesteDeRetrait(pointageDeLOccurrence(t, JOUR, { ...ouvert, faits: [] })),
    'rien-a-defaire',
  );
}

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
