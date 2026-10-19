/**
 * Le pointage partagé : le registre des actions liables — phase 5.
 *
 *   npm run essais:liaison-branches
 *
 * Ce registre est une **politique**, et une politique se vérifie autrement
 * qu'un calcul : on ne contrôle pas qu'elle donne le bon nombre, on contrôle
 * qu'elle dit bien ce que les décisions ont tranché, et qu'elle refuse par
 * défaut. Les essais citent donc les décisions, et la moitié d'entre eux
 * portent sur des REFUS.
 */
import {
  ACTIONS_LIABLES,
  LIBELLE_NEUTRE_DU_POINTAGE,
  actionLiable,
  actionsProposables,
  brancheSousCoffre,
  cocheLaTache,
  ecritDansLaBranche,
  magasinDeLException,
  ouvreLEcran,
} from '../src/lib/odyssee/liaison-branches';
import { TYPES } from '../src/lib/noyau/faits';
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

const tache = (action?: string): Tache => ({
  id: 'T1',
  titre: 'Quelque chose',
  domaine: 'ordre',
  echeance: null,
  faiteLe: null,
  abandonneeLe: null,
  motifAbandon: null,
  note: '',
  creeeLe: '2026-10-01T09:00:00.000Z',
  majLe: '2026-10-01T09:00:00.000Z',
  ...(action ? { lien: { branche: 'x', action } } : {}),
});

/* ══════════════════════════════════════════════════════════════════════════
   Le vocabulaire est emprunté, pas inventé
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE VOCABULAIRE');

/*
   L'exigence qui tient tout le module : une action liable EST un type de
   fait déjà déclaré. Si ce contrôle tombe, c'est que le registre a inventé
   un identifiant — et un identifiant inventé ne se retrouve ni dans le
   journal, ni dans les permissions, ni dans l'audit.
*/
const connus = new Set(TYPES.map((t) => t.id));
v(
  'chaque action liable est un type de fait du catalogue',
  ACTIONS_LIABLES.filter((a) => !connus.has(a.id)).map((a) => a.id),
  [],
);
v(
  'aucune action n’est déclarée deux fois',
  ACTIONS_LIABLES.length - new Set(ACTIONS_LIABLES.map((a) => a.id)).size,
  0,
);
v(
  'chacune dit pourquoi elle a ce sens-là',
  ACTIONS_LIABLES.filter((a) => !a.pourquoi.trim()).map((a) => a.id),
  [],
);

/* ══════════════════════════════════════════════════════════════════════════
   Les décisions du 15 octobre, telles qu’elles ont été prises
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCE QUE LES DÉCISIONS ONT TRANCHÉ');

/* Décision 5 : lien à sens unique pour les cibles qui exigent des résultats. */
v('un QCM ne se crée pas d’un geste', ecritDansLaBranche('revision.qcm'), false);
v('mais le faire coche la tâche', cocheLaTache('revision.qcm'), true);
v('l’entraînement cognitif de même', [
  ecritDansLaBranche('revision.cog-training'),
  cocheLaTache('revision.cog-training'),
], [false, true]);

/* Décision 4 : Psyché ouvre l'écran, n'écrit rien. */
v('pointer Psyché ouvre l’écran', ouvreLEcran('odyssee.checkin'), true);
v('et n’écrit rien', ecritDansLaBranche('odyssee.checkin'), false);
/*
   Et surtout : un check-in NON RÉPONDU ne coche pas la tâche. Si c'était le
   cas, ouvrir l'écran puis le fermer vaudrait pour « fait », et la décision
   serait vidée de son sens.

   Cette exigence tenait ici sur un `cocheLaTache` à `false`, et c'était le
   mauvais garde-fou — corrigé en phase 6. `cocheLaTache` ne répond pas à
   « ouvrir l'écran coche-t-il ? » mais à « un fait écrit dans la branche
   coche-t-il ? ». Un check-in fermé sans réponse n'écrit aucun fait : rien
   n'appelle le retour de branche, et la tâche reste ouverte. C'est
   l'ABSENCE DE FAIT qui protège, pas un refus déclaré — et un refus
   déclaré, lui, cassait l'aller-retour : on ouvrait l'écran depuis le
   calendrier, on répondait, et la tâche ne se cochait jamais.
*/
v('un check-in réellement écrit coche sa tâche', cocheLaTache('odyssee.checkin'), true);
v('et rien n’est écrit tant que rien n’est répondu', ecritDansLaBranche('odyssee.checkin'), false);

/*
   LA DÉCISION 1 DU 15 OCTOBRE EST LEVÉE POUR CE SEUL LIEN — Alexis, le
   18 octobre : « Oui pour le lien ». Ces quatre constats mesuraient
   « Santé est hors du lot », qui était vrai et ne l'est plus. Ils mesurent
   désormais ce que la décision a réellement ouvert, et ils ont gagné les
   deux garanties qui, elles, tiennent toujours : le lien reste SOUS COFFRE
   et ne compte PAS dans l'activité (prompt 52, P5, mot pour mot).

   La dernière est celle qui garde le « pour ce seul lien » : une seule
   action de Santé est liable, et si quelqu'un en ajoutait une seconde sans
   décision, elle rougirait.
*/
v('pointer une tâche liée note une prise', ecritDansLaBranche('odyssee.medicament'), true);
v('et une prise notée coche la tâche', cocheLaTache('odyssee.medicament'), true);
v(
  'Santé est donc proposée à l’écran',
  actionsProposables().some((a) => a.branche === 'sante'),
  true,
);
v('le sens est défini, et non plus en attente', actionLiable('odyssee.medicament')?.sens, 'deux-sens');
v(
  'le lien reste sous coffre : ses exceptions sont scellées',
  actionLiable('odyssee.medicament')?.sousCoffre,
  true,
);
v(
  'et il ne compte pas dans l’activité — pointer ne rapporte rien',
  actionLiable('odyssee.medicament')?.compteDansLActivite,
  false,
);
v(
  'une seule action de Santé est liable : la levée ne vaut que pour celle-là',
  ACTIONS_LIABLES.filter((a) => a.branche === 'sante').map((a) => a.id),
  ['odyssee.medicament'],
);

/* Ce qui marche dans les deux sens. */
v('une séance de sport se crée d’un geste', ecritDansLaBranche('sport.seance'), true);
v('une quête aussi', ecritDansLaBranche('odyssee.quete'), true);
/*
   Et plus la séance de révision : elle portait ici un `true` fondé sur une
   affirmation fausse de ma part — « un thème, un jour et un statut ». Elle
   porte aussi `secondes`, une durée mesurée. La décision 5 du 15 octobre dit
   d'ailleurs la même chose, et en toutes lettres.
*/
v('une séance de révision, non', ecritDansLaBranche('revision.seance'), false);
v('mais la faire coche la tâche', cocheLaTache('revision.seance'), true);

/* ══════════════════════════════════════════════════════════════════════════
   Le refus par défaut
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE REFUS PAR DÉFAUT');

/*
   Un lien qui nomme une action inconnue ne donne droit à RIEN. Un défaut
   permissif écrirait dans une branche sur la foi d'une chaîne de caractères
   — venue, par exemple, d'un paquet de synchronisation d'un appareil plus
   récent que celui qui le lit.
*/
v('une action inconnue n’écrit pas', ecritDansLaBranche('inventee.action'), false);
v('n’ouvre rien', ouvreLEcran('inventee.action'), false);
v('et ne coche rien', cocheLaTache('inventee.action'), false);
v('elle est simplement introuvable', actionLiable('inventee.action'), undefined);

/* ══════════════════════════════════════════════════════════════════════════
   Où range-t-on les exceptions ? — décision 3
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE RANGEMENT DES EXCEPTIONS');

v('Psyché est sous coffre', brancheSousCoffre('psyche'), true);
v('Finances aussi', brancheSousCoffre('finances'), true);
v('Sport non', brancheSousCoffre('sport'), false);
v('Révisions non plus', brancheSousCoffre('revisions'), false);

v(
  'une tâche sans lien se range en clair',
  magasinDeLException(tache()),
  'odysseeOccurrences',
);
v(
  'une tâche liée au sport aussi',
  magasinDeLException(tache('sport.seance')),
  'odysseeOccurrences',
);
/*
   LE CŒUR DE LA VARIANTE RETENUE : une occurrence quotidienne à 8 h liée à
   une branche sensible révèle un rythme, même sans libellé.
*/
v(
  'une tâche liée à Psyché est scellée',
  magasinDeLException(tache('odyssee.checkin')),
  'odysseeExceptionsScellees',
);
v(
  'une tâche liée aux Finances aussi',
  magasinDeLException(tache('odyssee.operation')),
  'odysseeExceptionsScellees',
);
/*
   Le défaut est le CLAIR, contre la règle habituelle du coffre. La raison
   est écrite dans le module : l'inverse rendrait le calendrier illisible
   coffre fermé pour l'immense majorité des tâches. Un lien inconnu ne scelle
   donc pas — mais il n'écrit rien non plus dans la branche.
*/
v(
  'un lien inconnu ne scelle pas',
  magasinDeLException(tache('inventee.action')),
  'odysseeOccurrences',
);
v(
  'et il n’écrit rien non plus : le défaut permissif est fermé ailleurs',
  ecritDansLaBranche('inventee.action'),
  false,
);

/* ══════════════════════════════════════════════════════════════════════════
   Le libellé neutre — décision 6
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE LIBELLÉ NEUTRE');

v('le texte est fixe', LIBELLE_NEUTRE_DU_POINTAGE, 'Pointé depuis le calendrier');
/*
   Une constante, et non un gabarit : un gabarit se remplit, et ce qui se
   remplit finit par recevoir un titre de tâche — qui peut être sensible.
*/
v(
  'et il ne contient aucun emplacement à remplir',
  /[{}$<>]/.test(LIBELLE_NEUTRE_DU_POINTAGE),
  false,
);

console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
