/**
 * Ce que coûte une vue mois d'occurrences, au volume d'un an.
 *
 *   npm run mesure:occurrences-mois
 *
 * Le pilote a fixé un seuil : **50 ms pour un écran d'un mois**. Au-delà,
 * le repli est un cache invalidé à l'écriture d'un fait. Ce script donne le
 * chiffre avant de décider, parce qu'un cache ajouté sans mesure ajoute un
 * second état à tenir juste — et un second endroit où se tromper.
 *
 * ## Ce qui est mesuré, et ce qui ne l'est pas
 *
 * **Mesuré** : `occurrencesDeLaFenetre`, c'est-à-dire le déroulé des règles
 * sur une fenêtre élargie de 93 jours, l'application des exceptions et la
 * résolution du pointage. C'est la part que la phase 5 ajoute.
 *
 * **Pas mesuré ici** : les lectures IndexedDB qui la précèdent. Elles sont
 * le même ordre de travail qu'avant la phase 5 — un `getAll` sur deux
 * petits magasins —, et c'est le banc du navigateur qui les pèse.
 *
 * Le volume suit l'hypothèse d'un an : une dizaine de tâches répétées,
 * quotidiennes pour la plupart, et une exception tous les quatre jours
 * — un pointage, un report ou un renoncement.
 */
import { occurrencesDeLaFenetre, type ExceptionLue } from '../src/lib/odyssee/occurrences-de-la-fenetre';
import type { Tache } from '../src/lib/odyssee/modele';

const jour = (depuis: string, n: number) =>
  new Date(Date.parse(`${depuis}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const DEBUT = '2026-01-01';
const COMBIEN_DE_TACHES = 12;

const taches: Tache[] = Array.from({ length: COMBIEN_DE_TACHES }, (_, i) => ({
  id: `T${String(i).padStart(3, '0')}`,
  titre: `Tâche répétée ${i}`,
  domaine: 'corps',
  echeance: null,
  faiteLe: null,
  abandonneeLe: null,
  motifAbandon: null,
  note: '',
  creeeLe: `${DEBUT}T08:00:00.000Z`,
  majLe: `${DEBUT}T08:00:00.000Z`,
  serie: {
    depuis: DEBUT,
    /* Les deux tiers quotidiennes, le reste hebdomadaire : le pire cas réaliste. */
    repetition: i % 3 === 2 ? { type: 'semaines', toutes: 1, jours: [1, 3, 5] } : { type: 'jours', tous: 1 },
    fin: { type: 'jamais' },
    heure: i % 2 ? '08:00' : null,
  },
}) as unknown as Tache);

/* Une exception tous les quatre jours, sur chaque tâche : ~1 100 lignes. */
const exceptions: ExceptionLue[] = [];
for (const t of taches) {
  for (let n = 0; n < 365; n += 4) {
    exceptions.push({ tacheId: t.id, jourPrevu: jour(DEBUT, n), etat: 'pointee', jourPorte: null });
  }
}

const faits = Array.from({ length: 400 }, (_, n) => ({
  type: 'sport.seance',
  jourLogique: jour(DEBUT, n % 365),
}));

const mesurer = (intitule: string, du: string, au: string, tours: number) => {
  /* Un tour à blanc : on mesure le régime établi, pas la première compilation. */
  occurrencesDeLaFenetre(taches, du, au, { exceptions, faits, coffreOuvert: true });
  const t0 = performance.now();
  let combien = 0;
  for (let i = 0; i < tours; i += 1) {
    combien = occurrencesDeLaFenetre(taches, du, au, {
      exceptions,
      faits,
      coffreOuvert: true,
    }).length;
  }
  const parTour = (performance.now() - t0) / tours;
  console.log(
    `  ${intitule.padEnd(28)} ${parTour.toFixed(2).padStart(7)} ms   (${combien} occurrences)`,
  );
  return parTour;
};

console.log(
  `\n\x1b[1mVolume\x1b[0m : ${taches.length} tâches répétées, ${exceptions.length} exceptions, ${faits.length} faits — un an.\n`,
);
console.log('\x1b[1mCoût par affichage\x1b[0m');
const unJour = mesurer('vue jour', '2026-06-15', '2026-06-15', 200);
const uneSemaine = mesurer('vue semaine (7 jours)', '2026-06-15', '2026-06-21', 200);
const unMois = mesurer('vue mois (30 jours)', '2026-06-01', '2026-06-30', 200);

/*
   LA PENTE, et pas seulement le point.

   Les trois chiffres ci-dessus sont presque égaux, ce qui dit où va le
   temps : pas dans la fenêtre affichée, mais dans la fenêtre ÉLARGIE de
   93 jours, déroulée à l'identique dans les trois cas, et dans le tri des
   exceptions par tâche, qui parcourt tout le lot. Le volume des exceptions
   est donc le facteur, pas la vue. On le vérifie à cinq ans.
*/
for (let an = 1; an < 5; an += 1) {
  for (const t of taches) {
    for (let n = 0; n < 365; n += 4) {
      exceptions.push({
        tacheId: t.id,
        jourPrevu: jour(DEBUT, an * 365 + n),
        etat: 'pointee',
        jourPorte: null,
      });
    }
  }
}
console.log(`\n\x1b[1mÀ cinq ans\x1b[0m (${exceptions.length} exceptions)`);
const cinqAns = mesurer('vue mois (30 jours)', '2026-06-01', '2026-06-30', 100);

const SEUIL = 50;
console.log(
  unMois < SEUIL
    ? `\n\x1b[32mSous le seuil de ${SEUIL} ms : aucun cache n’est justifié aujourd’hui.\x1b[0m\n`
    : `\n\x1b[31mAu-dessus du seuil de ${SEUIL} ms : le cache invalidé à l’écriture se justifie.\x1b[0m\n`,
);
if (cinqAns >= SEUIL) {
  console.log(
    `\x1b[33mMais à cinq ans, ${cinqAns.toFixed(1)} ms : la décision se reposera.\x1b[0m\n`,
  );
}
void unJour;
void uneSemaine;
