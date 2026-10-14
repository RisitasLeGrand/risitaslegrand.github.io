/**
 * Le jeu synthétique de cinq ans tient-il ses promesses ? — Finances, phase 5.
 *
 * Trois promesses, et une seule compte vraiment : qu'un carnet engendré deux
 * fois avec la même graine soit **identique**. Sans cela, aucune mesure prise
 * dessus ne se compare à une autre, et les trois volets qui suivent — conflits
 * entre appareils, ergonomie, guide — mesureraient le tirage au lieu du code.
 *
 * Les deux autres sont des garde-fous contre le défaut qu'on a trouvé en
 * route : une échéance mensuelle doit tomber **une fois par mois**, et le
 * caractère du carnet ne doit pas dépendre de la graine.
 */
import { engendrerFinances, LIGNES } from './lib/finances-synthetiques.mjs';
import { construireLaFile } from '../src/lib/odyssee/appariement';
import { occurrences, TOLERANCE_PAR_DEFAUT } from '../src/lib/odyssee/budget';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};

console.log('LE DÉTERMINISME, QUI CONDITIONNE TOUT LE RESTE');

{
  const a = engendrerFinances({ graine: 7 });
  const b = engendrerFinances({ graine: 7 });
  verifier(
    '1.1 deux carnets de même graine sont identiques au centime',
    JSON.stringify(a) === JSON.stringify(b),
  );
  const c = engendrerFinances({ graine: 8 });
  verifier(
    '1.2 et deux graines différentes donnent des carnets différents',
    JSON.stringify(a.operations) !== JSON.stringify(c.operations),
  );
}

console.log('\nUNE ÉCHÉANCE MENSUELLE TOMBE UNE FOIS PAR MOIS');

{
  /*
     Le défaut trouvé en écrivant ce module : le décalage du jour était tiré
     à chaque jour de la boucle, donc chaque jour rejouait sa chance d'être
     le bon. Un salaire pouvait tomber trois fois en mars et zéro en avril,
     et le solde final variait de trente-six mille euros d'une graine à
     l'autre. L'essai regarde donc le nombre d'occurrences par mois, et non
     le total de l'année, qui masquerait la compensation.
  */
  const { operations } = engendrerFinances({ graine: 7 });
  const salaires = operations.filter((o) => o.libelle.startsWith('VIR TRAITEMENT'));
  const parMois = new Map<string, number>();
  for (const o of salaires) parMois.set(o.jour.slice(0, 7), (parMois.get(o.jour.slice(0, 7)) ?? 0) + 1);
  const anormaux = [...parMois].filter(([, n]) => n !== 1);
  verifier(
    '2.1 chaque mois porte exactement un traitement',
    anormaux.length === 0,
    `mois fautifs : ${anormaux.slice(0, 5).map(([m, n]) => `${m}→${n}`).join(', ')}`,
  );
  verifier('2.2 et il y en a bien une soixantaine sur cinq ans', salaires.length >= 58 && salaires.length <= 62,
    `${salaires.length} trouvés`);
}

console.log('\nLE CARNET GARDE LE MÊME VISAGE D’UNE GRAINE À L’AUTRE');

{
  const soldes = [1, 7, 42, 99, 2026].map(
    (graine) => engendrerFinances({ graine }).compteRendu.soldeFinalCentimes,
  );
  const amplitude = Math.max(...soldes) - Math.min(...soldes);
  /* 500 000 centimes sur cinq ans, soit moins de 85 € par mois : au-delà, le
     carnet changerait de nature selon le tirage. */
  verifier(
    '3.1 l’amplitude du solde final reste sous 5 000 € sur cinq graines',
    amplitude < 500_000,
    `${(amplitude / 100).toFixed(0)} €`,
  );
  verifier('3.2 et le carnet épargne, comme un carnet ordinaire', soldes.every((s) => s > 0));
}

console.log('\nCE QUE LE CARNET DONNE À FAIRE AUX MOTEURS');

{
  const { operations, lignes, compteRendu } = engendrerFinances({ graine: 7 });
  verifier('4.1 cinq ans produisent entre 2 000 et 3 000 opérations',
    compteRendu.operations > 2000 && compteRendu.operations < 3000, `${compteRendu.operations}`);
  verifier('4.2 les prélèvements groupés existent, pour « Diviser »',
    compteRendu.prelevementsGroupes >= 15, `${compteRendu.prelevementsGroupes}`);
  verifier('4.3 le loyer a bien trois versions datées',
    lignes.find((l) => l.id === 'loyer')!.versions.length === 3);

  /* La file doit trouver du travail : si tout tombait en « certaine », le
     carnet n'exercerait pas les gestes que la phase 3 a livrés. */
  const dernierMois = operations.filter((o) => o.jour >= '2026-09-01' && o.jour < '2026-10-01');
  const occ = lignes.flatMap((l) => occurrences(l, '2026-09-01', '2026-09-30'));
  const file = construireLaFile(occ, dernierMois, {
    tolerance: TOLERANCE_PAR_DEFAUT,
    motifs: lignes.flatMap((l) => l.motifs.map((fragment) => ({ ligneId: l.id, fragment, vu: 5 }))),
    sensParLigne: Object.fromEntries(lignes.map((l) => [l.id, l.sens])),
  });
  verifier('4.4 un mois du carnet donne du travail à la file',
    file.certaines.length + file.probables.length > 0,
    `${file.certaines.length} certaines, ${file.probables.length} probables, ${file.aClasser.length} à classer`);
  console.log(`  · septembre 2026 : ${file.certaines.length} certaines, ${file.probables.length} probables, ${file.aClasser.length} à classer`);
}

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
