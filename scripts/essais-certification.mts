/**
 * La certification : une décision locale, une annonce partagée.
 *
 * Un seul essai compte vraiment ici, et c'est le troisième : un fait qui
 * certifierait un **autre** appareil que son émetteur doit être ignoré. C'est
 * la règle « jamais à distance depuis le téléphone » de l'amendement, et elle
 * ne vaut que si elle est tenue par le code — un écran qui n'offre pas le
 * bouton n'empêche personne de forger l'opération.
 */
import {
  certifiesDeclares,
  TYPE_CERTIFICATION,
} from '../src/lib/sync/certification';
import { SANS_LOT, type Operation } from '../src/lib/noyau/operations';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  ✓ ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  ✗ ${intitule}\n      attendu ${b}\n      obtenu  ${a}`);
};

const h = (n: number): string => `${String(n).padStart(15, '0')}-0000`;
let rang = 0;
const annonce = (
  appareil: string,
  cible: string,
  hlc: string,
  certifie: unknown = true,
): Operation =>
  Object.freeze({
    id: `op-${String((rang += 1)).padStart(4, '0')}`,
    appareil,
    hlc,
    type: TYPE_CERTIFICATION,
    cible,
    lot: SANS_LOT,
    charge: { certifie },
  }) as Operation;

console.log('\nL’ordinateur certifié');

v(
  'un appareil qui se déclare certifié l’est',
  [...certifiesDeclares([annonce('AAAA1111', 'AAAA1111', h(10))])],
  ['AAAA1111'],
);

v(
  'une annonce retirée plus tard l’emporte',
  [
    ...certifiesDeclares([
      annonce('AAAA1111', 'AAAA1111', h(10)),
      annonce('AAAA1111', 'AAAA1111', h(20), false),
    ]),
  ],
  [],
);

v(
  'un appareil ne peut pas certifier un autre appareil : le fait est ignoré',
  [...certifiesDeclares([annonce('BBBB2222', 'AAAA1111', h(10))])],
  [],
);

v(
  'et le fait forgé n’efface pas une certification réelle',
  [
    ...certifiesDeclares([
      annonce('AAAA1111', 'AAAA1111', h(10)),
      annonce('BBBB2222', 'AAAA1111', h(20), false),
    ]),
  ],
  ['AAAA1111'],
);

v(
  'une charge sans champ « certifie » vaut certifié : l’annonce existe',
  [
    ...certifiesDeclares([
      Object.freeze({
        id: 'op-x',
        appareil: 'AAAA1111',
        hlc: h(5),
        type: TYPE_CERTIFICATION,
        cible: 'AAAA1111',
        lot: SANS_LOT,
        charge: {},
      }) as Operation,
    ]),
  ],
  ['AAAA1111'],
);

v(
  'les autres types ne disent rien de la certification',
  [
    ...certifiesDeclares([
      Object.freeze({
        id: 'op-y',
        appareil: 'AAAA1111',
        hlc: h(5),
        type: 'appareil.nom',
        cible: 'AAAA1111',
        lot: SANS_LOT,
        charge: { nom: 'Ordinateur' },
      }) as Operation,
    ]),
  ],
  [],
);

v(
  'deux appareils peuvent se déclarer certifiés : le registre les montre tous',
  [
    ...certifiesDeclares([
      annonce('AAAA1111', 'AAAA1111', h(10)),
      annonce('BBBB2222', 'BBBB2222', h(11)),
    ]),
  ].sort(),
  ['AAAA1111', 'BBBB2222'],
);

console.log(
  echecs === 0 ? '\nTous les essais de certification passent.\n' : `\n${echecs} échec(s).\n`,
);
process.exit(echecs === 0 ? 0 : 1);
