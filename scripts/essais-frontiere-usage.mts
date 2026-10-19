/**
 * La frontière entre le compteur de visites et le journal d'usage.
 *
 *   npm run essais:frontiere-usage
 *
 * ## La phrase que cet essai garde
 *
 * > Le compteur porte une route sans instant ; le journal d'usage porte un
 * > instant sans route ; et rien ne peut joindre les deux.
 *
 * Elle est écrite dans `lib/visites.ts`, dans `odyssee/usage.ts` et dans la
 * déclaration du magasin scellé. Un commentaire ne garde rien : cet essai
 * rougit si l'un des deux modules gagne le champ de l'autre.
 *
 * ## Pourquoi une liste blanche de chaque côté, et pas une liste noire
 *
 * Interdire `date` laisserait passer `le`, `jour`, `quand`, `horodatage`, et
 * tout ce qu'on n'a pas pensé. Chaque module déclare donc les seuls champs
 * qu'il a le droit de porter, et cet essai vérifie que ces listes ne se
 * recouvrent pas — ni par un nom, ni par un synonyme connu.
 */
import { CHAMPS_AUTORISES as CHAMPS_VISITE, controlerVisite, type Visite } from '../src/lib/visites';
import { CHAMPS_AUTORISES as CHAMPS_SESSION, controlerSession, type Session } from '../src/lib/odyssee/usage';
import { MAGASINS_SCELLES } from '../src/lib/noyau/coffre';
import { CHAMP_DATE } from '../src/lib/sauvegarde/groupes';

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};
const vrai = (titre: string, condition: boolean) => v(titre, condition, true);

/** Les noms par lesquels un instant se glisse dans un enregistrement. */
const NOMS_D_INSTANT = [
  'date',
  'jour',
  'le',
  'debut',
  'fin',
  'majle',
  'quand',
  'horodatage',
  'heure',
  'instant',
  'creele',
  'vule',
  'dernier',
];

/** Les noms par lesquels une route se glisse dans un enregistrement. */
const NOMS_DE_ROUTE = ['route', 'page', 'url', 'chemin', 'ecran', 'vue', 'adresse', 'lien'];

const contient = (champs: readonly string[], noms: readonly string[]) =>
  champs.filter((c) => noms.includes(c.toLowerCase()));

console.log('\nLE COMPTEUR PORTE UNE ROUTE SANS INSTANT');
v('ses champs sont exactement trois', [...CHAMPS_VISITE].sort(), ['compte', 'id', 'route']);
v('aucun n’est un instant', contient(CHAMPS_VISITE, NOMS_D_INSTANT), []);
v('et sa date déclarée est « null », explicitement', CHAMP_DATE.visites, null);

console.log('\nLE JOURNAL D’USAGE PORTE UN INSTANT SANS ROUTE');
v('aucun de ses champs n’est une route', contient(CHAMPS_SESSION, NOMS_DE_ROUTE), []);
vrai('et il porte bien des instants', contient(CHAMPS_SESSION, NOMS_D_INSTANT).length > 0);

console.log('\nNI L’UN NI L’AUTRE NE PEUT GAGNER LE CHAMP DE L’AUTRE');
/* Les contrôles sont appelés pour de vrai : une liste blanche qu'aucun code
   n'applique ne garde rien. */
const visiteDatee = { id: 'a', route: '/revisions', compte: 2, vuLe: '2026-10-19' } as unknown as Visite;
vrai('une visite datée est refusée', controlerVisite(visiteDatee).length > 0);
vrai(
  'et le refus nomme le champ',
  controlerVisite(visiteDatee).some((p) => p.includes('vuLe')),
);

const sessionRoutee = {
  id: 'b',
  jour: '2026-10-19',
  debut: '2026-10-19T08:00:00.000Z',
  fin: null,
  majLe: '2026-10-19T08:00:00.000Z',
  page: '/odyssee/psyche',
} as unknown as Session;
vrai('une session avec une page est refusée', controlerSession(sessionRoutee).length > 0);

console.log('\nET LE MAGASIN NE LAISSE RIEN EN CLAIR QUI DISE L’UN OU L’AUTRE');
const declare = MAGASINS_SCELLES.find((m) => m.magasin === 'visites');
vrai('le compteur est déclaré scellé', Boolean(declare));
v('un seul champ en clair : l’identifiant', [...(declare?.clairs ?? [])], ['id']);
v(
  'qui n’est ni une route ni un instant',
  contient(declare?.clairs ?? [], [...NOMS_DE_ROUTE, ...NOMS_D_INSTANT]),
  [],
);
vrai(
  'et la phrase de frontière est écrite dans la déclaration',
  (declare?.pourquoi ?? '').includes('une route sans instant'),
);

console.log(
  echecs === 0
    ? '\n\x1b[32mLa frontière tient.\x1b[0m\n'
    : `\n\x1b[31m${echecs} contrôle${echecs > 1 ? 's' : ''} rouge${echecs > 1 ? 's' : ''}.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
