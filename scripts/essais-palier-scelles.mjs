/**
 * AUCUN MAGASIN SCELLÉ NE PART AU JOURNAL TANT QUE LA CLÉ N'EST PAS PARTAGÉE.
 *
 *   npm run essais:palier-scelles
 *
 * ## Ce que cette garde arrête, et ce n'est pas une hypothèse
 *
 * Constat B-2 du prompt 58 : la clé du coffre n'est pas partagée entre
 * appareils. Ce n'est pas une crainte, c'est la conception — et le code le dit
 * lui-même, au-dessus du sel de l'enveloppe :
 *
 *     « Un sel n'est pas un secret : il sert à ce que deux installations du
 *       même mot de passe ne produisent pas la même clé. »
 *
 * Le sel est tiré au sort à la première pose et gardé par appareil. Deux
 * appareils avec le MÊME mot de passe ont donc des clés différentes, et une
 * entrée scellée par l'un ne s'ouvre pas chez l'autre.
 *
 * Or dix-sept magasins étaient à la fois SCELLÉS et JOURNALISÉS : ils
 * partaient donc dans les paquets, et arrivaient illisibles en face. Ce
 * n'était pas une perte qui « arriverait si on synchronisait un jour » :
 * elle avait lieu.
 *
 * ## Pourquoi un palier, et non la clé partagée tout de suite
 *
 * Parce qu'un palier arrête la perte pendant qu'on construit le reste. C'est
 * la proposition 3 de l'audit, prise à la lettre et approuvée : les magasins
 * scellés ne sont plus journalisés, et l'écran le dit. La clé partagée viendra
 * ensuite, et B-6 — la Santé d'un appareil à l'autre — en dépend
 * explicitement.
 *
 * ## Ce que cette garde ne fait pas
 *
 * Elle ne supprime rien et ne demande à personne de supprimer quoi que ce
 * soit. La règle du lot est écrite ainsi, et elle vaut d'être répétée ici :
 *
 *     Isoler, c'est écarter, compter et dire. Jamais supprimer.
 *
 * Les entrées déjà parties redeviendront lisibles le jour où la clé sera
 * partagée ; les effacer maintenant transformerait un défaut réparable en
 * perte définitive.
 *
 * Elle ne juge pas non plus QUELS magasins doivent être scellés, ni lesquels
 * mériteraient d'être journalisés. Elle tient une seule chose : que les deux
 * ensembles ne se recoupent pas tant que la clé est propre à l'appareil.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MAGASINS_SCELLES, estScelle } from '../src/lib/noyau/coffre';
import { sansCommentaires } from './lib/sans-commentaires.mjs';

const racine = path.resolve(import.meta.dirname, '..');
import { MAGASINS_JOURNALISES } from '../src/lib/noyau/enregistrements';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)}`);
    console.log(`      attendu ${JSON.stringify(attendu)}`);
  }
};
const vrai = (titre, obtenu) => v(titre, obtenu, true);

const scelles = new Set(MAGASINS_SCELLES.map((m) => m.magasin));
const journalises = new Set(MAGASINS_JOURNALISES.map((m) => m.magasin));
const lesDeux = [...scelles].filter((m) => journalises.has(m)).sort();

console.log('\n1. LES DEUX ENSEMBLES SONT MESURABLES');

vrai('des magasins sont scellés', scelles.size > 0);
vrai('des magasins sont journalisés', journalises.size > 0);
console.log(`  (${scelles.size} scellés · ${journalises.size} journalisés)`);

/*
   Les deux ensembles non vides sont une PRÉMISSE, et non du décor. Si une
   liste devenait vide — un remaniement, un import cassé —, l'intersection
   serait vide elle aussi et cette garde rendrait un vert qui ne prouve rien.
   C'est le défaut que j'ai vu trois fois ce soir sous une autre forme : un
   contrôle qui passe parce qu'il ne mesure plus rien.
*/

console.log('\n2. CEUX QUI SONT LES DEUX SONT REFUSÉS AU DÉPART');

/*
   POURQUOI LES DÉCLARATIONS RESTENT, ET CE QUE CETTE GARDE MESURE DONC.

   Une première version de cet essai exigeait que les deux ensembles ne se
   recoupent pas, c'est-à-dire que les dix-sept sortent de
   « MAGASINS_JOURNALISES ». Ce serait jeter leurs déclarations — type, clef,
   libellé, règle de fusion — qu'il faudrait réécrire à l'identique le jour où
   la clé sera partagée. Le palier doit se LEVER en une ligne, pas se défaire
   en dix-sept.

   Le refus est donc posé au seul point d'étranglement, dans
   « journaliserEnregistrement », et c'est lui que cette garde mesure : le
   prédicat qui décide, et le fait qu'il soit bien consulté.

   « estScelle » est le prédicat que le code appelle — le même objet, pas une
   copie. L'éprouver, c'est éprouver la décision ; c'est la leçon des cinq
   lecteurs du mot de passe, et des deux prédicats de parcours.
*/

v(
  'le prédicat du refus classe exactement les magasins scellés',
  [...journalises].filter((m) => estScelle(m)).sort(),
  lesDeux,
);
console.log(`  (${lesDeux.length} magasins journalisés sont scellés, donc refusés au départ)`);

/*
   Et la ceinture : le prédicat ne sert à rien s'il n'est pas appelé. On lit la
   source du point d'étranglement, commentaires écartés, pour que le refus ne
   puisse pas disparaître en silence — c'est exactement ce qui est arrivé au
   nombre « SCHEMA_REVISIONS », juste quand personne ne regardait.
*/
const source = sansCommentaires(
  readFileSync(path.join(racine, 'src/lib/sync/faits-domaine.ts'), 'utf8'),
).join('\n');
const corps = source.slice(source.indexOf('export async function journaliserEnregistrement'));
const avantEcriture = corps.slice(0, corps.indexOf("put('operations'"));

vrai(
  'le point d’étranglement consulte bien ce prédicat',
  /estScelle\s*\(/.test(avantEcriture),
);
vrai(
  'et il le consulte AVANT d’écrire au registre',
  avantEcriture.length > 0 && corps.includes("put('operations'"),
);

if (lesDeux.length > 0) {
  console.log(
    `\n  Sans ce refus, ces ${lesDeux.length} magasins partiraient chiffrés avec une\n` +
      '  clé que l’appareil qui reçoit ne possède pas, et y arriveraient\n' +
      '  illisibles — rendant du même coup illisibles ses données LOCALES,\n' +
      '  les lecteurs étant en « Promise.all » :\n',
  );
  for (const m of lesDeux) console.log(`    ${m}`);
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${echecs} rouge(s).\x1b[0m`,
);
process.exit(echecs > 0 ? 1 : 0);
