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
  dansLaFenetre,
  fenetreElargie,
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

console.log('\n\x1b[1mLa fenêtre élargie, que le lecteur d’exceptions doit partager\x1b[0m');
{
  /*
     Ce bloc existe parce que la borne est maintenant lue à DEUX endroits :
     ici pour dérouler la règle, et dans `donnees-occurrences.ts` pour lire
     les exceptions. Deux bornes différentes feraient manquer l'exception
     d'une occurrence déplacée de loin — l'occurrence paraîtrait au jour que
     la règle prévoyait, alors qu'elle a été déplacée.
  */
  v('un mois entier de part et d’autre', fenetreElargie('2026-10-14', '2026-10-15'), [
    '2026-09-13',
    '2026-11-15',
  ]);
  v('la borne franchit un changement d’année', fenetreElargie('2027-01-05', '2027-01-05'), [
    '2026-12-05',
    '2027-02-05',
  ]);

  const prevue = { jourPrevu: '2026-10-20', jourPorte: null };
  v('une exception du jour est dans la fenêtre', dansLaFenetre(prevue, '2026-10-14', '2026-10-21'), true);
  v('hors fenêtre, elle n’y est pas', dansLaFenetre(prevue, '2026-10-01', '2026-10-05'), false);

  const venueDeLoin = { jourPrevu: '2026-09-20', jourPorte: '2026-10-15' };
  v(
    'une occurrence déplacée DANS la fenêtre y est, par son jour d’arrivée',
    dansLaFenetre(venueDeLoin, '2026-10-14', '2026-10-15'),
    true,
  );
  v(
    'et elle y est aussi par son jour prévu, lu dans la fenêtre élargie',
    dansLaFenetre(venueDeLoin, ...fenetreElargie('2026-10-14', '2026-10-15')),
    true,
  );
  const partieAilleurs = { jourPrevu: '2026-10-15', jourPorte: '2026-12-01' };
  v(
    'une occurrence partie ailleurs reste lue, sinon on la montrerait restée',
    dansLaFenetre(partieAilleurs, '2026-10-14', '2026-10-15'),
    true,
  );
}

console.log('\n\x1b[1mL’heure : la série la donne, l’exception la reprend\x1b[0m');
{
  const t = tache({
    id: '01H',
    titre: 'Courir',
    serie: {
      depuis: '2026-10-01',
      repetition: { type: 'jours', tous: 1 },
      fin: { type: 'jamais' },
      heure: '08:00',
    },
  });
  const sansException = occurrencesDeLaFenetre([t], '2026-10-14', '2026-10-14', vide);
  v('la série porte l’heure', sansException[0].heure, '08:00');

  const decalee: ExceptionLue = {
    tacheId: '01H',
    jourPrevu: '2026-10-14',
    etat: 'modifiee',
    jourPorte: null,
    heure: '19:30',
  };
  const avec = occurrencesDeLaFenetre([t], '2026-10-14', '2026-10-14', {
    ...vide,
    exceptions: [decalee],
  });
  v('l’exception la reprend — sinon le rendez-vous est manqué', avec[0].heure, '19:30');

  const muette = tache({ id: '01M', titre: 'Lire' });
  v(
    'sans heure, rien n’est inventé',
    occurrencesDeLaFenetre([muette], '2026-10-14', '2026-10-14', vide)[0].heure,
    null,
  );
}

console.log('\n\x1b[1mLa jointure : déplacement ET dérivation ensemble — anomalie A-15\x1b[0m');
{
  /*
     CE BLOC EXISTE PARCE QUE SON ABSENCE A COÛTÉ UNE ANOMALIE.

     La phase 5a éprouvait le déplacement d'un côté et la dérivation de
     l'autre, jamais les deux à la fois. Le moteur cherchait donc le fait
     de branche au jour que la RÈGLE prévoyait, et une occurrence déplacée
     restait « à faire » le jour où elle avait justement été faite. Deux
     propriétés justes prises séparément ne prouvent pas leur combinaison,
     et c'est la jointure qu'il faut éprouver.
  */
  const liee = tache({
    id: '01J',
    titre: 'Courir',
    lien: { action: ACTIONS_LIABLES[0].id, cible: null },
    /* La série commence AVANT le jour prévu, sinon il n'y a rien à déplacer. */
    serie: {
      depuis: '2026-09-01',
      repetition: { type: 'jours', tous: 1 },
      fin: { type: 'jamais' },
      heure: null,
    },
  });
  const action = ACTIONS_LIABLES[0].id;

  const deplacement: ExceptionLue = {
    tacheId: '01J',
    jourPrevu: '2026-09-20',
    etat: 'deplacee',
    jourPorte: '2026-10-15',
    heure: null,
  };

  /* Le fait existe au jour D'ARRIVÉE : c'est là que la séance a eu lieu. */
  const auJourDArrivee = occurrencesDeLaFenetre([liee], '2026-10-15', '2026-10-15', {
    exceptions: [deplacement],
    faits: [{ type: action, jourLogique: '2026-10-15' }],
    coffreOuvert: true,
  });
  v('l’occurrence déplacée est bien là', auJourDArrivee.length >= 1, true);
  const arrivee = auJourDArrivee.find((o) => o.jourPrevu === '2026-09-20');
  v('et c’est bien celle qui vient du 20 septembre', Boolean(arrivee), true);
  v('elle est FAITE, parce que la séance est du jour d’arrivée', arrivee?.faite, true);
  v('et elle le tient de sa branche, pas d’une exception', arrivee?.origine, 'branche');

  /* Le fait au jour que la règle prévoyait ne la fait PAS : on a couru ailleurs. */
  const auJourPrevu = occurrencesDeLaFenetre([liee], '2026-10-15', '2026-10-15', {
    exceptions: [deplacement],
    faits: [{ type: action, jourLogique: '2026-09-20' }],
    coffreOuvert: true,
  });
  v(
    'un fait resté au jour prévu ne la fait pas : elle n’y est plus',
    auJourPrevu.find((o) => o.jourPrevu === '2026-09-20')?.faite,
    false,
  );
}

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
