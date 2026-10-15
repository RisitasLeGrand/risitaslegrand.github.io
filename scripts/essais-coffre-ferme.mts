/**
 * Le calendrier coffre fermé : ce qui reste lisible, et ce qui se refuse.
 *
 *   npm run essais:coffre-ferme
 *
 * Trois choses s'éprouvent ici, et la dernière est une exigence de
 * confidentialité plutôt qu'un calcul :
 *
 * - **fermer le coffre ne change rien pour la plupart des tâches.** C'est
 *   l'écart qui fait la valeur de la décision 3 : si tout devenait illisible,
 *   le chiffrement par branche n'aurait servi à rien ;
 * - **ce qu'on ne peut pas lire est dit, pas deviné.** Une occurrence dont
 *   l'exception est scellée ne s'affiche pas « à faire » : ce serait une
 *   affirmation fausse ;
 * - **le libellé du pointage ne porte aucun titre.** C'est la décision 6, et
 *   elle ne se vérifie pas en lisant la constante une fois : l'essai contrôle
 *   qu'elle n'est pas un gabarit, parce qu'un gabarit finit par être rempli.
 */
import {
  MENTION_ETAT_SCELLE,
  gesteSousCoffre,
  lisibiliteDeLOccurrence,
  tachesIllisibles,
} from '../src/lib/odyssee/coffre-ferme';
import {
  ACTIONS_LIABLES,
  LIBELLE_NEUTRE_DU_POINTAGE,
} from '../src/lib/odyssee/liaison-branches';
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

const tache = (action?: string, id = 'T1'): Tache => ({
  id,
  titre: 'Quelque chose',
  domaine: 'odyssee',
  faiteLe: null,
  creeeLe: '2026-10-12T08:00:00.000Z',
  majLe: '2026-10-12T08:00:00.000Z',
  lien: action ? { branche: 'x', action } : null,
});

/* ── 1. L'écart : fermer le coffre ne cache pas tout ───────────────────── */
console.log('\nFermer le coffre ne change rien pour la plupart des tâches');

v('sans lien, lisible coffre fermé', lisibiliteDeLOccurrence(tache(), false), 'lisible');
v('liée au sport, lisible coffre fermé', lisibiliteDeLOccurrence(tache('sport.seance'), false), 'lisible');
v('liée à une quête, lisible', lisibiliteDeLOccurrence(tache('odyssee.quete'), false), 'lisible');
v(
  'liée à une action inconnue, lisible — un lien non déclaré ne scelle rien',
  lisibiliteDeLOccurrence(tache('branche.inventee'), false),
  'lisible',
);
v('liée à Psyché, illisible coffre fermé', lisibiliteDeLOccurrence(tache('odyssee.checkin'), false), 'scellee');
v('liée aux Finances, illisible aussi', lisibiliteDeLOccurrence(tache('odyssee.operation'), false), 'scellee');
v('mais lisible dès que le coffre est ouvert', lisibiliteDeLOccurrence(tache('odyssee.checkin'), true), 'lisible');

const souscoffre = ACTIONS_LIABLES.filter((a) => a.sousCoffre).map((a) => a.id);
v(
  'trois actions du registre sont sous coffre, et pas une de plus',
  souscoffre,
  ['odyssee.checkin', 'odyssee.operation', 'odyssee.medicament'],
);

/* ── 2. Le geste, et son refus ─────────────────────────────────────────── */
console.log('\nCe qu’un geste peut faire');

v(
  'une tâche ordinaire s’écrit en clair, coffre fermé',
  gesteSousCoffre(tache('sport.seance'), false),
  { quoi: 'ecrire', magasin: 'odysseeOccurrences' },
);
v(
  'une tâche sous coffre s’écrit scellée, coffre ouvert',
  gesteSousCoffre(tache('odyssee.checkin'), true),
  { quoi: 'ecrire', magasin: 'odysseeExceptionsScellees' },
);
/*
   A-6, option D. Coffre fermé, le geste n'est plus refusé : il est GARDÉ
   chiffré, à condition qu'une boîte existe sur cet appareil. Sans boîte —
   coffre jamais ouvert ici — le refus demeure, et c'est préférable à un
   geste qu'on dirait gardé sans l'avoir gardé.
*/
v(
  'coffre fermé avec une boîte, le geste est gardé pour plus tard',
  gesteSousCoffre(tache('odyssee.checkin'), false, true),
  { quoi: 'reporter' },
);
const refus = gesteSousCoffre(tache('odyssee.checkin'), false, false);
v('coffre fermé sans boîte, il se refuse', refus.quoi, 'impossible');
v(
  'et le refus dit quoi faire, pas « erreur »',
  (refus as { pourquoi: string }).pourquoi,
  'Cette tâche touche une branche chiffrée, et ce navigateur n’a pas encore de boîte. Ouvrez le coffre une fois pour pouvoir la pointer plus tard.',
);
v(
  'une tâche ordinaire s’écrit, boîte ou pas',
  gesteSousCoffre(tache('sport.seance'), false, true),
  { quoi: 'ecrire', magasin: 'odysseeOccurrences' },
);

const lot = [tache('sport.seance', 'A'), tache('odyssee.checkin', 'B'), tache(undefined, 'C')];
v('une seule tâche illisible sur trois', tachesIllisibles(lot, false).map((t) => t.id), ['B']);
v('aucune, coffre ouvert', tachesIllisibles(lot, true).length, 0);

/* ── 3. Les libellés ne portent aucun titre ────────────────────────────── */
console.log('\nAucun libellé ne recopie le titre d’une tâche');

v('le libellé du pointage est neutre', LIBELLE_NEUTRE_DU_POINTAGE, 'Pointé depuis le calendrier');
/*
   Un gabarit se remplit, et ce qui se remplit finit par recevoir un titre.
   L'essai refuse donc toute marque d'interpolation dans les deux constantes
   qu'un écran recopie dans une branche ou affiche à la place d'un état.
*/
for (const [nom, texte] of [
  ['le libellé du pointage', LIBELLE_NEUTRE_DU_POINTAGE],
  ['la mention d’état scellé', MENTION_ETAT_SCELLE],
] as const) {
  v(`${nom} n’est pas un gabarit`, /\$\{|%s|\{\{/.test(texte), false);
  v(`${nom} ne contient pas le titre d’essai`, texte.includes('Quelque chose'), false);
}

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
