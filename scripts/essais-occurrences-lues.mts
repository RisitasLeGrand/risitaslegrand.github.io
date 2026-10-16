/**
 * Le compte d'une journée d'occurrences, et « en retard ».
 *
 *   npm run essais:occurrences-lues
 *
 * Deux règles qui décident de ce que trois écrans affichent, et dont
 * chacune peut mentir dans un sens précis :
 *
 * - **une occurrence scellée n'est pas un manque.** La ranger parmi les
 *   « pas faites » transformerait un coffre fermé en reproche ;
 * - **une occurrence scellée n'est jamais « en retard ».** On ne sait pas
 *   si elle a été faite ; l'affirmer serait inventer, et inventer dans le
 *   sens du reproche.
 *
 * La lecture elle-même (trois magasins, fenêtre élargie) n'est pas
 * éprouvée ici : elle demande une base. C'est l'essai de navigateur du
 * calendrier qui la couvre, de bout en bout.
 */
import {
  compterLesOccurrences,
  enRetard,
} from '../src/lib/odyssee/occurrences-lues';
import type { OccurrenceAffichee } from '../src/lib/odyssee/occurrences-de-la-fenetre';

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

const o = (p: Partial<OccurrenceAffichee>): OccurrenceAffichee => ({
  tacheId: '01T',
  titre: 'Courir',
  domaine: 'corps',
  jour: '2026-10-15',
  jourPrevu: '2026-10-15',
  lisible: true,
  faite: false,
  origine: 'aucune',
  abandonnee: false,
  deplacee: false,
  heure: null,
  liee: false,
  ...p,
});

console.log('\n\x1b[1mLe compte d’une journée\x1b[0m');
{
  const compte = compterLesOccurrences([
    o({ tacheId: 'A', faite: true, origine: 'exception' }),
    o({ tacheId: 'B', faite: true, origine: 'branche' }),
    o({ tacheId: 'C' }),
    o({ tacheId: 'D', abandonnee: true }),
    o({ tacheId: 'E', lisible: false }),
  ]);
  v('cinq étaient prévues', compte.prevues, 5);
  v('deux sont faites, quelle que soit l’origine', compte.faites, 2);
  v('une a été renoncée', compte.renoncees, 1);
  v('une est illisible, et comptée À PART', compte.illisibles, 1);
  /*
     La somme ne boucle pas, et c'est voulu : la cinquième ligne (« C »)
     n'est ni faite, ni renoncée, ni illisible — elle est simplement due.
     Un compte qui bouclerait aurait rangé l'illisible quelque part.
  */
  v(
    'faites + renoncées + illisibles ne font pas le total : il reste ce qui est dû',
    compte.prevues - compte.faites - compte.renoncees - compte.illisibles,
    1,
  );

  const vide = compterLesOccurrences([]);
  v('aucune occurrence : tout à zéro, rien d’inventé', vide, {
    prevues: 0,
    faites: 0,
    renoncees: 0,
    illisibles: 0,
  });
}

console.log('\n\x1b[1m« En retard » — et ce qui ne peut pas l’être\x1b[0m');
{
  const hier = '2026-10-14';
  const aujourdhui = '2026-10-15';

  v(
    'passée et pas faite : en retard',
    enRetard(o({ jour: hier }), aujourdhui),
    true,
  );
  v(
    'passée mais faite : non',
    enRetard(o({ jour: hier, faite: true, origine: 'branche' }), aujourdhui),
    false,
  );
  v(
    'passée mais renoncée : non — renoncer est une réponse',
    enRetard(o({ jour: hier, abandonnee: true }), aujourdhui),
    false,
  );
  v(
    'du jour même : non, la journée n’est pas finie',
    enRetard(o({ jour: aujourdhui }), aujourdhui),
    false,
  );
  v(
    'à venir : non',
    enRetard(o({ jour: '2026-10-20' }), aujourdhui),
    false,
  );
  v(
    'passée ET ILLISIBLE : non — on ne sait pas, et le dire serait inventer',
    enRetard(o({ jour: hier, lisible: false }), aujourdhui),
    false,
  );
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
