/**
 * Ce qui ne sort jamais — amendement signé le 16 octobre 2026.
 *
 *   npm run essais:jamais-partage
 *
 * Le contrôle éprouve la **distinction** entre deux forces que le code
 * aurait eu toutes les raisons de confondre :
 *
 * - `sensible: true` veut dire « demande un geste délibéré ». Huit types
 *   le portent, et ceux de Psyché et de Finances sortent quand la case
 *   est cochée. C'est voulu.
 * - `TYPES_JAMAIS_PARTAGES` veut dire **jamais**, case ou pas.
 *
 * Confondre les deux aurait produit l'une de deux fautes, et le contrôle
 * les attrape toutes les deux : rendre Psyché et Finances inexportables,
 * que personne n'a décidé ; ou rendre « jamais » rouvrable par une case,
 * que personne n'a accordé.
 */
import {
  TYPES_JAMAIS_PARTAGES,
  peutSortir,
  retirerCeQuiNeSortPas,
} from '../src/lib/noyau/jamais-partage';
import { TYPES as CATALOGUE_FAITS } from '../src/lib/noyau/faits';

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

console.log('\n\x1b[1m1. La liste dit exactement ce que la décision dit\x1b[0m');
{
  v('les deux types nommés, et eux seuls', [...TYPES_JAMAIS_PARTAGES].sort(), [
    'odyssee.medicament',
    'odyssee.statut-hormonal',
  ]);
  /* Et ils existent au contrat : une interdiction sur un type fantôme ne
     protège rien, et laisse croire qu'elle protège quelque chose. */
  const declares = new Set(CATALOGUE_FAITS.map((t) => t.id));
  v(
    'et chacun est un type déclaré',
    TYPES_JAMAIS_PARTAGES.filter((t) => !declares.has(t)),
    [],
  );
}

console.log('\n\x1b[1m2. « Jamais » n’est pas « sensible » — la distinction tient\x1b[0m');
{
  const sensibles = CATALOGUE_FAITS.filter((t) => t.sensible).map((t) => t.id);
  vrai('il y a bien plus de types sensibles que de types jamais partagés', sensibles.length > TYPES_JAMAIS_PARTAGES.length);

  /*
     Le défaut visé, dans un sens : avoir fait porter « jamais » par
     `sensible`. Psyché et Finances cesseraient de sortir, ce que personne
     n'a décidé — et l'export perdrait sa case.
  */
  for (const exportable of ['odyssee.journal', 'odyssee.operation', 'sport.blessure']) {
    vrai(`« ${exportable} » est sensible mais peut sortir sur geste`, peutSortir(exportable));
  }

  /* Et dans l'autre : les deux types nommés ne sortent pas. */
  for (const jamais of TYPES_JAMAIS_PARTAGES) {
    v(`« ${jamais} » ne sort pas`, peutSortir(jamais), false);
  }
}

console.log('\n\x1b[1m3. Le tamis ne garde que ce qui a le droit de sortir\x1b[0m');
{
  const faits = [
    { type: 'odyssee.poids', id: 'a' },
    { type: 'odyssee.medicament', id: 'b' },
    { type: 'odyssee.journal', id: 'c' },
    { type: 'odyssee.statut-hormonal', id: 'd' },
  ];
  v(
    'les deux interdits sont retirés, les autres restent',
    retirerCeQuiNeSortPas(faits).map((f) => f.id),
    ['a', 'c'],
  );
  v('une liste vide reste vide, sans lever', retirerCeQuiNeSortPas([]), []);
  /* L'ordre est conservé : un tamis qui réordonne changerait un export. */
  v(
    'l’ordre reçu est l’ordre rendu',
    retirerCeQuiNeSortPas([{ type: 'z' }, { type: 'a' }]).map((e) => e.type),
    ['z', 'a'],
  );
}

console.log(
  '\n\x1b[1m4. Ce que la garde N’EMPÊCHE PAS\x1b[0m' +
    '\n   \x1b[2mLa même décision les fait entrer dans les indicateurs : sortir et calculer sont deux gestes.\x1b[0m',
);
{
  /*
     Une garde qui empêcherait aussi le calcul serait une erreur d'une
     autre nature : elle ferait échouer la moitié signée de la décision,
     et sans bruit — l'indicateur serait simplement vide, ce qui ne se
     distingue pas d'un domaine qu'on néglige.
  */
  const declares = CATALOGUE_FAITS.filter((t) => TYPES_JAMAIS_PARTAGES.includes(t.id));
  v('les deux types restent au catalogue', declares.length, 2);
  for (const t of declares) {
    vrai(`« ${t.id} » garde son propriétaire`, t.proprietaire === 'odyssee');
    vrai(`« ${t.id} » reste déclaré sensible`, t.sensible === true);
  }
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
