/**
 * Mesure le taux de reconnaissance du dictionnaire sur le jeu synthétique.
 *
 * **Ce chiffre ne dit rien de relevés réels.** Le jeu et le dictionnaire
 * sont écrits de la même main : la mesure porte sur la cohérence entre les
 * deux, et sur la robustesse de la normalisation aux formes de libellé. Elle
 * est publiée telle quelle, avec sa réserve.
 */
import { LIBELLES } from './lib/libelles-synthetiques.mts';
import { DICTIONNAIRE, VERSION_DU_DICTIONNAIRE } from '../src/lib/odyssee/dictionnaire-vendeurs';
import { reconnaitre } from '../src/lib/odyssee/vendeurs';

const su = { regles: [], vendeurs: [], dictionnaire: DICTIONNAIRE };

let justes = 0;
let faux = 0;
let manques = 0;
let fauxPositifs = 0;
const details: string[] = [];

for (const l of LIBELLES) {
  const r = reconnaitre(l.libelle, su);
  const attendu = l.attendu;
  if (attendu === null) {
    if (r.nom === null) justes += 1;
    else {
      fauxPositifs += 1;
      details.push(`  ✗ faux positif  « ${l.libelle} » → ${r.nom} (${l.forme})`);
    }
  } else if (r.nom === attendu) {
    justes += 1;
  } else if (r.nom === null) {
    manques += 1;
    details.push(`  · non reconnu  « ${l.libelle} » attendu ${attendu} (${l.forme})`);
  } else {
    faux += 1;
    details.push(`  ✗ mal reconnu  « ${l.libelle} » → ${r.nom}, attendu ${attendu} (${l.forme})`);
  }
}

const total = LIBELLES.length;
const pc = (n: number) => `${((n / total) * 100).toFixed(1).replace('.', ',')} %`;

console.log(`
MESURE DU TAUX DE RECONNAISSANCE — dictionnaire du ${VERSION_DU_DICTIONNAIRE}
${DICTIONNAIRE.length} entrées · jeu synthétique de ${total} libellés

  justes          ${String(justes).padStart(3)}   ${pc(justes)}
  mal reconnus    ${String(faux).padStart(3)}   ${pc(faux)}
  non reconnus    ${String(manques).padStart(3)}   ${pc(manques)}
  faux positifs   ${String(fauxPositifs).padStart(3)}   ${pc(fauxPositifs)}
`);
if (details.length) console.log(details.join('\n'), '\n');
console.log(
  'Réserve : ce jeu est écrit de la même main que le dictionnaire. Le chiffre\n' +
  'mesure la robustesse de la normalisation aux formes de libellé, et la\n' +
  'cohérence entre les deux côtés de cette main. Il ne dit RIEN de la\n' +
  'couverture sur des relevés réels, qui ne se connaîtra qu’aux premiers\n' +
  'imports.\n',
);
