/**
 * L'élément du centre : sept champs, aucun contenu, un identifiant muet.
 *
 *   npm run essais:centre-modele
 *
 * Trois exigences du prompt 32 se vérifient ici, et la première est celle
 * qui a demandé un écart avec sa lettre :
 *
 * - **l'identifiant est une empreinte**, pas la référence. Le § 2.3 veut
 *   une clé dérivée pour que deux appareils n'en produisent pas deux ; le
 *   § 4.1 interdit domaine, source et date fine dans les index en clair.
 *   Une clé dérivée EN CLAIR satisferait le premier et violerait le second ;
 * - **une question à trancher ne se range pas** (§ 1 n° 8), et la rétention
 *   automatique ne la touche pas davantage, quel que soit son âge ;
 * - **la pastille ne compte que les questions**, sinon un « 7 » pour sept
 *   informations ne voudrait plus rien dire.
 */
import {
  RETENTION_PAR_DEFAUT,
  compteDansLaPastille,
  controlerElement,
  idDeLElement,
  peutEtreRange,
  sortDeLaRetention,
  type ElementDuCentre,
} from '../src/lib/notifications/modele';

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

const el = (p: Partial<ElementDuCentre> = {}): ElementDuCentre => ({
  id: '0'.repeat(32),
  source: 'rappel-de-sauvegarde',
  refSource: 'coffre/2026-10-12',
  genre: 'a-savoir',
  creeLe: '2026-10-12',
  etat: 'non_lu',
  regroupement: null,
  ...p,
});

/* ── 1. L'empreinte ────────────────────────────────────────────────────── */
console.log('\nL’identifiant est une empreinte, pas la référence');

const id = await idDeLElement('journal-du-cycle', '2026-10-12');
v('trente-deux signes hexadécimaux', /^[0-9a-f]{32}$/.test(id), true);
v('la source n’y apparaît pas', id.includes('journal'), false);
v('la date non plus', id.includes('2026'), false);
v('deux appels donnent le même', id, await idDeLElement('journal-du-cycle', '2026-10-12'));
v(
  'deux références différentes donnent deux empreintes',
  id === (await idDeLElement('journal-du-cycle', '2026-10-13')),
  false,
);
v(
  'et la séparation source / référence n’est pas ambiguë',
  (await idDeLElement('ab', 'c')) === (await idDeLElement('a', 'bc')),
  false,
);

/* ── 2. Une question à trancher ne se range pas ────────────────────────── */
console.log('\nUne question ouverte ne disparaît pas');

v('elle ne peut pas être rangée', peutEtreRange(el({ genre: 'a-trancher' })), false);
v('une information, si', peutEtreRange(el({ genre: 'a-savoir' })), true);
v(
  'et la rétention ne la touche pas, même après deux ans',
  sortDeLaRetention(el({ genre: 'a-trancher' }), '2028-10-12'),
  'rien',
);

/* ── 3. La rétention ───────────────────────────────────────────────────── */
console.log('\nLa rétention : trente jours, cent quatre-vingts');

v('le jour même, rien', sortDeLaRetention(el(), '2026-10-12'), 'rien');
v('à vingt-neuf jours, rien', sortDeLaRetention(el(), '2026-11-10'), 'rien');
v('à trente jours, on archive', sortDeLaRetention(el(), '2026-11-11'), 'archiver');
v(
  'déjà archivé, on n’archive pas deux fois',
  sortDeLaRetention(el({ etat: 'archive' }), '2026-11-11'),
  'rien',
);
v('à cent quatre-vingts jours, on supprime', sortDeLaRetention(el(), '2027-04-10'), 'supprimer');
v(
  'et un archivé ancien se supprime aussi',
  sortDeLaRetention(el({ etat: 'archive' }), '2027-04-10'),
  'supprimer',
);
v('les deux bornes sont celles de la décision 7', RETENTION_PAR_DEFAUT, {
  archiverApres: 30,
  supprimerApres: 180,
});
v(
  'et elles sont réglables',
  sortDeLaRetention(el(), '2026-10-19', { archiverApres: 7, supprimerApres: 14 }),
  'archiver',
);

/* ── 4. La pastille ────────────────────────────────────────────────────── */
console.log('\nLa pastille ne compte que les questions');

v('une question non lue compte', compteDansLaPastille(el({ genre: 'a-trancher' })), true);
v(
  'une question lue compte encore — elle n’est pas résolue',
  compteDansLaPastille(el({ genre: 'a-trancher', etat: 'lu' })),
  true,
);
v('une information ne compte pas', compteDansLaPastille(el({ genre: 'a-savoir' })), false);

/* ── 5. Le contrôle de forme ───────────────────────────────────────────── */
console.log('\nCe que le modèle refuse');

v('un élément bien formé passe', controlerElement(el({ id })), []);
v(
  'un identifiant qui n’est pas une empreinte est refusé',
  controlerElement(el({ id: 'journal-du-cycle/2026-10-12' })),
  ['L’identifiant doit être une empreinte de 32 signes.'],
);
v(
  'une date à l’instant est refusée : le § 4.1 veut un jour',
  controlerElement(el({ id, creeLe: '2026-10-12T08:05:00.000Z' })),
  ['La date de création est un jour, jamais un instant.'],
);
v('une source vide est refusée', controlerElement(el({ id, source: '' })).length, 1);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
