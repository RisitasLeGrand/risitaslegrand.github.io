/**
 * Le journal de révisions, et la propriété dont dépend toute la fusion :
 * **rejouer le journal rend exactement l'état stocké**.
 *
 * Si ce n'est pas vrai, la règle « les états dérivés sont recalculés à partir
 * des journaux fusionnés » produit un état différent de celui que la personne
 * avait sous les yeux avant de synchroniser — des échéances qui bougent sans
 * qu'elle ait rien révisé. C'est l'essai le plus important de la phase 1, et
 * c'est aussi celui qui dira, un jour, qu'une mise à jour de « ts-fsrs » a
 * changé l'ordonnanceur.
 */
import { carteNeuve, noter, recalculerCarte } from '../src/lib/srs';
import { fsrsNeuf, type EtatCarte, type Note } from '../src/lib/db';
import {
  recalculer,
  socleDe,
  type EntreeRevision,
} from '../src/lib/noyau/revisions';
import { fabriqueUlid } from '../src/lib/noyau/ulid';
import {
  comparerOperations,
  idAppareilNeuf,
  operation,
  SANS_LOT,
} from '../src/lib/noyau/operations';

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
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);

function mulberry32(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOTES: Note[] = ['oublie', 'difficile', 'correct', 'facile'];
const JOUR = 86_400_000;
const APPAREIL = 'AAAA1111';

/**
 * Révise une carte comme le site le fait, en gardant les deux versions : l'état
 * tenu au fil de l'eau, et le journal qui devra le reproduire.
 */
function parcourir(graine: number, combien: number, depart = Date.parse('2024-01-15T08:00:00Z')) {
  const hasard = mulberry32(graine);
  const prochainId = fabriqueUlid(() => instant);
  let instant = depart;
  let carte = carteNeuve('c1', 'f1', 'Économie', new Date(instant));
  const journal: EntreeRevision[] = [];
  for (let i = 0; i < combien; i += 1) {
    instant += Math.floor(1 + hasard() * 20) * JOUR + Math.floor(hasard() * 8) * 3_600_000;
    const note = NOTES[Math.floor(hasard() * 4)];
    journal.push({
      id: prochainId(),
      genre: 'notation',
      carteId: 'c1',
      ficheId: 'f1',
      matiere: 'Économie',
      le: new Date(instant).toISOString(),
      appareil: APPAREIL,
      note,
    });
    carte = noter(carte, note, new Date(instant));
  }
  return { carte, journal };
}

/* ── Le rejeu reproduit l'état ───────────────────────────────────────────── */

console.log('\nRejeu du journal');
{
  for (const combien of [1, 2, 5, 40, 200]) {
    const { carte, journal } = parcourir(combien + 3, combien);
    const rejoue = recalculerCarte(journal);
    v(`${combien} révision(s) : l’état rejoué est l’état tenu`, rejoue, carte);
  }

  // L'ordre de lecture du journal ne doit rien changer : la fusion le rendra
  // dans n'importe quel ordre, et c'est l'identifiant qui porte l'ordre vrai.
  const { carte, journal } = parcourir(99, 30);
  const melange = [...journal].reverse();
  v('l’ordre de lecture ne change rien', recalculerCarte(melange), carte);
  const hasard = mulberry32(5);
  const brasse = [...journal].sort(() => hasard() - 0.5);
  v('un ordre quelconque ne change rien', recalculerCarte(brasse), carte);

  v('un journal vide ne rend rien, et surtout pas une carte neuve', recalculerCarte([]), null);
}

/* ── Le socle ────────────────────────────────────────────────────────────── */

console.log('\nSocle des cartes antérieures au journal');
{
  // Une carte comme il en existe aujourd'hui : un état, aucune histoire.
  const { carte: ancienne } = parcourir(7, 12);
  const socle = socleDe(ancienne, fabriqueUlid()(), APPAREIL);
  const reprise = recalculerCarte([socle]);
  v('le socle seul rend l’état repris', reprise, ancienne);

  // Et les révisions postérieures au socle sont, elles, recalculables.
  const prochainId = fabriqueUlid();
  let instant = Date.parse('2025-06-01T09:00:00Z');
  let attendue = ancienne;
  const apres: EntreeRevision[] = [];
  for (const note of ['correct', 'oublie', 'facile'] as Note[]) {
    instant += 9 * JOUR;
    apres.push({
      id: prochainId(),
      genre: 'notation',
      carteId: ancienne.id,
      ficheId: ancienne.ficheId,
      matiere: ancienne.matiere,
      le: new Date(instant).toISOString(),
      appareil: APPAREIL,
      note,
    });
    attendue = noter(attendue, note, new Date(instant));
  }
  v('socle puis trois révisions : l’état suit', recalculerCarte([socle, ...apres]), attendue);
  v('et dans l’ordre inverse aussi', recalculerCarte([...apres, socle].reverse()), attendue);

  // Les compteurs du site sont de l'histoire : le socle doit les porter, sinon
  // le nombre d'oublis d'une carte de deux ans retomberait à zéro.
  vrai('le socle conserve les compteurs', socle.revisions === ancienne.revisions &&
    socle.oublis === ancienne.oublis);

  /*
     Une notation **antérieure** au socle. Le cas vient de la synchronisation :
     un appareil installé cette semaine note une carte, un appareil plus ancien
     migre ensuite et fabrique son socle — dont l'identifiant est postérieur.

     Cet essai existe parce que les deux précédents ne le couvraient pas et
     passaient par hasard : socle et notations tiraient leurs identifiants de
     deux fabriques ULID à la même milliseconde, et c'est le tirage aléatoire
     qui décidait lequel précédait l'autre. Une fois sur deux, le socle passait
     après — et l'ancien code l'ignorait alors en silence, repartant d'une carte
     neuve. L'essai dénonçait un vrai défaut un passage sur deux, ce qui est la
     pire façon de dénoncer quoi que ce soit.
  */
  const avantLeSocle: EntreeRevision = {
    // Un identifiant qui commence par un zéro : antérieur à tout ULID d'aujourd'hui.
    id: '00000000000000000000000001',
    genre: 'notation',
    carteId: ancienne.id,
    ficheId: ancienne.ficheId,
    matiere: ancienne.matiere,
    le: '2025-05-01T09:00:00.000Z',
    appareil: 'ZZZZ9999',
    note: 'correct',
  };
  const avecAnterieure = recalculerCarte([avantLeSocle, socle]);
  vrai(
    'une notation antérieure au socle ne fait pas oublier le socle',
    avecAnterieure !== null && avecAnterieure.revisions === ancienne.revisions + 1,
  );
  v(
    'et elle est appliquée par-dessus, car le socle ne la connaissait pas',
    avecAnterieure?.oublis,
    ancienne.oublis,
  );
  v(
    'l’ordre de lecture n’y change rien',
    recalculerCarte([socle, avantLeSocle]),
    avecAnterieure,
  );

  // Une carte dont la fiche a changé : c'est la dernière valeur qui vaut.
  const migree = recalculer(
    [
      { ...socle },
      {
        id: prochainId(),
        genre: 'notation',
        carteId: ancienne.id,
        ficheId: 'f2',
        matiere: 'Finances publiques',
        le: '2025-07-01T09:00:00.000Z',
        appareil: APPAREIL,
        note: 'correct',
      },
    ],
    { appliquer: noter, neuve: fsrsNeuf },
  ) as EtatCarte;
  v('la fiche suit la dernière entrée', [migree.ficheId, migree.matiere], [
    'f2',
    'Finances publiques',
  ]);
}

/* ── L'ordre total des opérations ────────────────────────────────────────── */

console.log('\nOrdre total des opérations');
{
  const base = { type: 'revision', cible: 'c1', charge: {} };
  const a = operation({ ...base, id: '01A', appareil: 'AAAA', hlc: { ms: 1000, compteur: 0 } });
  const b = operation({ ...base, id: '01B', appareil: 'AAAA', hlc: { ms: 1000, compteur: 1 } });
  const c = operation({ ...base, id: '01C', appareil: 'BBBB', hlc: { ms: 1000, compteur: 0 } });
  const d = operation({ ...base, id: '01D', appareil: 'AAAA', hlc: { ms: 1000, compteur: 0 } });

  vrai('l’horloge départage d’abord', comparerOperations(a, b) < 0);
  vrai('puis l’appareil', comparerOperations(a, c) < 0);
  vrai('puis l’identifiant', comparerOperations(a, d) < 0);
  v('l’ordre est total et stable', [a, b, c, d].sort(comparerOperations).map((o) => o.id), [
    '01A',
    '01D',
    '01C',
    '01B',
  ]);
  v('une saisie locale porte le lot vide, qui est indexable', a.lot, SANS_LOT);
  vrai('une opération est figée', Object.isFrozen(a));
  let mutee = false;
  try {
    (a as { cible: string }).cible = 'autre';
    mutee = a.cible !== 'c1';
  } catch {
    mutee = false;
  }
  vrai('et une mutation ne passe pas', !mutee);

  const ids = new Set(Array.from({ length: 500 }, () => idAppareilNeuf()));
  v('500 identifiants d’appareil distincts', ids.size, 500);
  vrai(
    'sans signe ambigu',
    [...ids].every((id) => id.length === 8 && !/[ILOU]/.test(id)),
  );
}

console.log(echecs === 0 ? '\nTous les essais passent.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
