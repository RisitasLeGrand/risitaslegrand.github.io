/**
 * La séparation des sources, éprouvée là où elle est seule — amendement
 * du 16 octobre 2026.
 *
 *   npm run essais:faits-branches-sensible
 *
 * Deux barrières protègent la même chose, et c'est voulu :
 *
 * 1. **La séparation des sources.** Les traitements et le statut
 *    hormonal sont publiés sous la source `sensible`, que l'export ne
 *    nomme jamais — il énumère `revisions`, `odyssee`, `corps`, `sport`,
 *    plus Psyché et Finances sur case cochée.
 * 2. **Le tamis de type**, au point de sortie de l'export.
 *
 * La seconde cache la première : tant que le tamis est là, supprimer la
 * séparation ne se voit nulle part. Ce contrôle frappe donc la première
 * **sans passer par l'export** — il interroge l'assembleur directement.
 * `essais:jamais-partage` frappe la seconde de son côté.
 *
 * C'est la troisième fois de ce chantier qu'une barrière en masque une
 * autre. La règle est désormais appliquée d'emblée plutôt qu'après coup.
 */
import { SOURCES, type SourceDeFaits } from '../src/lib/odyssee/faits-branches';
import { TYPES_JAMAIS_PARTAGES } from '../src/lib/noyau/jamais-partage';
import { readFileSync } from 'node:fs';

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

console.log('\n\x1b[1m1. « sensible » est une source à part entière\x1b[0m');
{
  vrai('elle figure dans la liste par défaut', (SOURCES as readonly string[]).includes('sensible'));
  /*
     Elle DOIT y être : les indicateurs appellent `rassembler` sans
     préciser de sources, et la moitié signée de la décision — l'entrée
     dans l'analyse — ne tiendrait pas autrement. Une source absente du
     défaut rendrait l'indicateur vide, ce qui ne se distingue pas d'un
     domaine négligé.
  */
  vrai('et elle est distincte de « corps »', 'sensible' !== ('corps' as SourceDeFaits));
}

console.log('\n\x1b[1m2. L’export ne nomme pas cette source\x1b[0m');
{
  /*
     On lit l'export, et non son résultat : son énumération de sources est
     écrite en clair dans le fichier, et c'est elle qui décide. Un essai
     qui lancerait l'export entier mesurerait le tamis en même temps — et
     le tamis cache précisément ce qu'on cherche à voir.
  */
  const source = readFileSync('src/lib/export-ia.ts', 'utf8');
  const enumeration = source.slice(
    source.indexOf('const sources = ['),
    source.indexOf('];', source.indexOf('const sources = [')),
  );
  vrai('l’énumération des sources existe', enumeration.length > 0);
  v('et elle ne contient pas « sensible »', enumeration.includes('sensible'), false);

  /* Les quatre branches ordinaires y sont, elles : on ne vérifie pas une
     absence sur une énumération qu'on aurait vidée par accident. */
  for (const attendue of ['revisions', 'odyssee', 'corps', 'sport']) {
    vrai(`« ${attendue} » y est`, enumeration.includes(`'${attendue}'`));
  }
}

console.log('\n\x1b[1m3. Et le tamis est bien posé, en plus\x1b[0m');
{
  const source = readFileSync('src/lib/export-ia.ts', 'utf8');
  vrai('l’export importe le tamis', source.includes("from './noyau/jamais-partage'"));
  vrai(
    'et l’applique à la fenêtre qu’il rassemble',
    /faits:\s*retirerCeQuiNeSortPas\(brute\.faits\)/.test(source),
  );
  /*
     Sonde faible, et nommée telle : elle attrape le retrait du tamis, pas
     sa neutralisation. L'effet du tamis se prouve ailleurs, par
     exécution, dans `essais:jamais-partage`.
  */
  v('les deux types interdits sont bien ceux-là', [...TYPES_JAMAIS_PARTAGES].sort(), [
    'odyssee.medicament',
    'odyssee.statut-hormonal',
  ]);
}

console.log('\n\x1b[1m4. L’assembleur sait publier la source sensible\x1b[0m');
{
  const source = readFileSync('src/lib/odyssee/faits-branches.ts', 'utf8');
  vrai(
    'un branchement existe pour « sensible »',
    /sources\.includes\('sensible'\)/.test(source),
  );
  vrai('et il charge le bon module', source.includes("import('./faits-sensible')"));
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
