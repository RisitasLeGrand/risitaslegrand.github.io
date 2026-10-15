/**
 * Les occurrences d'une fenêtre, telles que le calendrier les montrera.
 *
 *   npm run essais:occurrences-fenetre
 *
 * Quatre choses s'éprouvent, et chacune est une façon dont un calendrier
 * peut mentir :
 *
 * - **une occurrence déplacée n'est à sa place qu'une fois.** La dérouler
 *   sans regarder les exceptions la montrerait au jour prévu ET au jour
 *   d'arrivée ;
 * - **une occurrence déplacée DANS la fenêtre depuis un jour d'avant doit
 *   y paraître.** C'est le cas que l'élargissement de la fenêtre protège,
 *   et c'est celui qu'on oublie, parce qu'il ne se voit qu'en déplaçant à
 *   cheval sur un bord ;
 * - **coffre fermé, une occurrence liée à une branche scellée est
 *   illisible, pas absente.** La règle vit en clair : on sait qu'il y a
 *   quelque chose ce jour-là, on ne sait pas quoi ;
 * - **une tâche sans série ne produit rien.** Le calendrier n'est pas une
 *   liste de tâches.
 */
import {
  occurrencesDeLaFenetre,
  occurrencesDuJourAffichees,
  type ExceptionLue,
} from '../src/lib/odyssee/occurrences-de-la-fenetre';
import { ACTIONS_LIABLES } from '../src/lib/odyssee/liaison-branches';
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

const tache = (p: Partial<Tache> = {}): Tache =>
  ({
    id: '01T',
    titre: 'Courir',
    domaine: 'corps',
    echeance: null,
    faiteLe: null,
    abandonneeLe: null,
    motifAbandon: null,
    note: '',
    creeeLe: '2026-10-01T08:00:00.000Z',
    majLe: '2026-10-01T08:00:00.000Z',
    serie: { depuis: '2026-10-01', repetition: { type: 'jours', tous: 1 }, fin: { type: 'jamais' }, heure: null },
    ...p,
  }) as Tache;

const vide = { exceptions: [] as ExceptionLue[], faits: [], coffreOuvert: true };
const jours = (o: { jour: string }[]) => o.map((x) => x.jour);

console.log('\n\x1b[1mLa règle se déroule sur la fenêtre, et seulement elle\x1b[0m');
{
  const r = occurrencesDeLaFenetre([tache()], '2026-10-12', '2026-10-15', vide);
  v('quatre jours, quatre occurrences', jours(r), [
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
  ]);
  v(
    'une tâche sans série n’en produit aucune',
    occurrencesDeLaFenetre([tache({ serie: null })], '2026-10-12', '2026-10-15', vide).length,
    0,
  );
  v(
    'une tâche abandonnée non plus',
    occurrencesDeLaFenetre([tache({ abandonneeLe: '2026-10-10' })], '2026-10-12', '2026-10-15', vide)
      .length,
    0,
  );
}

console.log('\n\x1b[1mUne occurrence déplacée n’est à sa place qu’une fois\x1b[0m');
{
  const exceptions: ExceptionLue[] = [
    { tacheId: '01T', jourPrevu: '2026-10-13', etat: 'deplacee', jourPorte: '2026-10-15' },
  ];
  const r = occurrencesDeLaFenetre([tache()], '2026-10-12', '2026-10-15', { ...vide, exceptions });
  v('le 13 n’en porte plus', occurrencesDuJourAffichees(r, '2026-10-13').length, 0);
  v('et le 15 en porte deux', occurrencesDuJourAffichees(r, '2026-10-15').length, 2);
  v(
    'celle qui a bougé le dit, et garde son jour prévu',
    occurrencesDuJourAffichees(r, '2026-10-15')
      .filter((o) => o.deplacee)
      .map((o) => o.jourPrevu),
    ['2026-10-13'],
  );
}

console.log('\n\x1b[1mDéplacée depuis un jour hors de la fenêtre, elle y paraît quand même\x1b[0m');
{
  /*
     Le cas qu'on oublie : la règle prévoyait le 5, la personne a déplacé au
     14. Dérouler la seule fenêtre du 12 au 15 ne verrait jamais le 5, donc
     ne saurait pas qu'il arrive quelque chose le 14.
  */
  const exceptions: ExceptionLue[] = [
    { tacheId: '01T', jourPrevu: '2026-10-05', etat: 'deplacee', jourPorte: '2026-10-14' },
  ];
  const r = occurrencesDeLaFenetre([tache()], '2026-10-12', '2026-10-15', { ...vide, exceptions });
  v('le 14 en porte deux, dont la déplacée', occurrencesDuJourAffichees(r, '2026-10-14').length, 2);
  v(
    'et elle vient bien du 5',
    occurrencesDuJourAffichees(r, '2026-10-14')
      .filter((o) => o.deplacee)
      .map((o) => o.jourPrevu),
    ['2026-10-05'],
  );
}

console.log('\n\x1b[1mCoffre fermé : illisible, pas absente\x1b[0m');
{
  const scellee = ACTIONS_LIABLES.find((a) => a.sousCoffre);
  if (!scellee) {
    echecs += 1;
    console.log('  \x1b[31m✗\x1b[0m aucune action scellée au registre : l’essai ne prouve rien');
  } else {
    const liee = tache({ lien: { action: scellee.id, cible: null } } as Partial<Tache>);
    const r = occurrencesDeLaFenetre([liee], '2026-10-14', '2026-10-15', {
      exceptions: [],
      faits: [],
      coffreOuvert: false,
    });
    v('les occurrences sont là — la règle vit en clair', r.length, 2);
    v('mais aucune n’est lisible', r.filter((o) => o.lisible).length, 0);
    v('et aucune n’est annoncée faite', r.filter((o) => o.faite).length, 0);
    v(
      'le titre reste en clair, parce que les tâches ne sont pas scellées',
      r.map((o) => o.titre),
      ['Courir', 'Courir'],
    );
    const ouvert = occurrencesDeLaFenetre([liee], '2026-10-14', '2026-10-15', {
      exceptions: [],
      faits: [],
      coffreOuvert: true,
    });
    v('coffre ouvert, elles redeviennent lisibles', ouvert.filter((o) => o.lisible).length, 2);
  }
}

console.log('\n\x1b[1mL’ordre est stable\x1b[0m');
{
  const a = tache({ id: '01A', titre: 'Zèbre' });
  const b = tache({ id: '01B', titre: 'Abeille' });
  const r = occurrencesDeLaFenetre([a, b], '2026-10-14', '2026-10-14', vide);
  v('à jour égal, par titre', r.map((o) => o.titre), ['Abeille', 'Zèbre']);
}

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
