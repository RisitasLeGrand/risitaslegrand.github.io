/**
 * AUCUN MAGASIN SCELLÉ NE PART AU JOURNAL TANT QUE LA CLÉ N'EST PAS PARTAGÉE.
 *
 *   npm run essais:palier-scelles
 *
 * ## Ce que cette garde arrête, et ce n'est pas une hypothèse
 *
 * Constat B-2 du prompt 58 : la clé du coffre n'est pas partagée entre
 * appareils. Ce n'est pas une crainte, et la raison est le TRAJET DU SEL.
 *
 * La clé des données est dérivée du mot de passe ET de `coffre.sel`, tiré au
 * sort à la première ouverture et rangé dans le magasin `etat`
 * (`src/lib/coffre.ts`, `selLocal`). Un paquet de synchronisation emporte
 * `operations` et `revisions`, jamais `etat` (`sync/service.ts`,
 * `magasinsEnPlus`) : l'appareil d'en face n'en reçoit donc pas le sel, en
 * tire un autre, dérive une autre clé — et une entrée scellée par l'un ne
 * s'ouvre pas chez l'autre.
 *
 * MESURÉ LE 26 OCTOBRE, ET DANS L'AUTRE SENS, ce qui en fait une preuve et
 * non une lecture : une SAUVEGARDE emporte `etat`, donc `coffre.sel`.
 * Restaurée sur un profil neuf, elle a rouvert le check-in scellé avec le
 * même mot de passe. C'est la route du sel qui décide, et non le sceau.
 *
 * Une première version de cet en-tête invoquait ici le sel de l'ENVELOPPE
 * (`coffre.sel-enveloppe`, dans `localStorage`), qui n'est pas celui-là :
 * l'enveloppe emballe la clé pour la session, elle ne la dérive pas. La
 * conclusion tenait, la raison était fausse.
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
import { operationsTransportables } from '../src/lib/noyau/transportable';
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

console.log('\n2. CE QUI PART N’EMPORTE AUCUN MAGASIN SCELLÉ');

/*
   ON ÉPROUVE CE QUI PART, PAS UN MODULE.

   Une première version de cette garde exigeait que les deux ensembles ne se
   recoupent pas, puis une seconde regardait un module. Ni l'une ni l'autre ne
   mesurait la chose qui compte : le CONTENU de ce qui quitte l'appareil.

   « operationsTransportables » est la fonction que le paquet appelle — le même
   objet, pas une copie. L'éprouver, c'est éprouver ce qui part.
*/
const operationDe = (magasin) => ({
  id: 'faux',
  charge: { magasin, enregistrement: { id: 'x' } },
});

const sortant = operationsTransportables([
  ...lesDeux.map(operationDe),
  operationDe('quiz'),
  operationDe('nback'),
  { id: 'sans-magasin', charge: { autre: 1 } },
]);

v(
  'aucune opération de magasin scellé ne part',
  sortant.map((o) => o.charge?.magasin).filter((m) => m && estScelle(m)),
  [],
);
v(
  'et ce qui n’est pas scellé part toujours',
  sortant.map((o) => o.charge?.magasin ?? '(sans magasin)').sort(),
  ['(sans magasin)', 'nback', 'quiz'],
);
console.log(`  (${lesDeux.length} magasins scellés et journalisés, tous retenus au départ)`);

console.log('\n3. LE PRÉDICAT EST DÉRIVÉ, ET NON UNE LISTE DES DIX-SEPT');

/*
   LE SABOTAGE QUE LE PILOTE A DEMANDÉ, et il se fait sans toucher au code :
   on prend un magasin scellé qui n'est PAS dans les dix-sept — il y en a
   seize — et l'on vérifie qu'il est écarté quand même. Si le filtre tenait
   une liste des dix-sept, celui-là passerait.

   C'est le dix-huitième magasin de demain, joué aujourd'hui.
*/
const scellesHorsDesDixSept = [...scelles].filter((m) => !journalises.has(m)).sort();
vrai('il existe des magasins scellés hors des dix-sept', scellesHorsDesDixSept.length > 0);
v(
  'et un tel magasin est écarté lui aussi, par calcul',
  operationsTransportables(scellesHorsDesDixSept.map(operationDe)),
  [],
);
console.log(`  (${scellesHorsDesDixSept.length} magasins scellés non journalisés, écartés sans qu’aucune liste les nomme)`);

console.log('\n4. LE JOURNAL LOCAL, LUI, EST BIEN ÉCRIT');

/*
   Le point que ma première correction avait cassé, et que le pilote a fait
   rétablir : l'opération entre au journal local comme avant. L'appareil garde
   la mémoire de ses propres écritures — la compaction et la reprise s'en
   servent — et seul le DÉPART est retenu.

   On le mesure à la source du point d'écriture : il ne doit plus consulter
   « estScelle » du tout.
*/
const ecriture = sansCommentaires(
  readFileSync(path.join(racine, 'src/lib/sync/faits-domaine.ts'), 'utf8'),
).join('\n');
const corpsEcriture = ecriture.slice(
  ecriture.indexOf('export async function journaliserEnregistrement'),
);
const avantPut = corpsEcriture.slice(0, corpsEcriture.indexOf("put('operations'"));
v('le point d’écriture ne refuse plus rien de scellé', /estScelle/.test(avantPut), false);
vrai('et il écrit bien au registre', corpsEcriture.includes("put('operations'"));

console.log('\n5. ET LE FILTRE EST POSÉ LÀ OÙ LE PAQUET SE REMPLIT');

const service = sansCommentaires(
  readFileSync(path.join(racine, 'src/lib/sync/service.ts'), 'utf8'),
).join('\n');
vrai(
  'le paquet passe par « operationsTransportables »',
  /operationsTransportables\s*\(/.test(service),
);

console.log(
  echecs === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${echecs} rouge(s).\x1b[0m`,
);
process.exit(echecs > 0 ? 1 : 0);
