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
import { MAGASINS_SCELLES } from '../src/lib/noyau/coffre';
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

console.log('\n2. ET ILS NE SE RECOUPENT PAS');

v('aucun magasin scellé n’est journalisé', lesDeux, []);

if (lesDeux.length > 0) {
  console.log(
    `\n  Ces ${lesDeux.length} magasins partent chiffrés avec une clé que\n` +
      '  l’appareil qui reçoit ne possède pas. Ils y arrivent illisibles, et,\n' +
      '  les lecteurs étant en « Promise.all », rendent du même coup illisibles\n' +
      '  les données LOCALES de celui qui reçoit :\n',
  );
  for (const m of lesDeux) console.log(`    ${m}`);
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${echecs} rouge(s).\x1b[0m`,
);
process.exit(echecs > 0 ? 1 : 0);
