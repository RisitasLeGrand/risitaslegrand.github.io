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

/**
 * UN REJEU QUI PANIQUE DOIT ROUGIR, PAS TUER L'ESSAI.
 *
 * `recalculer` passe chaque note à FSRS, qui REFUSE un intervalle négatif —
 * « Invalid delta_t "-18" ». Un journal rejoué à rebours du calendrier ne
 * rend donc pas un mauvais résultat : il lève, et l'exception emporte le
 * processus au milieu du fichier.
 *
 * Mesuré en sabotant le tri de `recalculer` : l'essai mourait à la première
 * assertion d'ordre, et les six sections suivantes ne tournaient plus du
 * tout. C'est rouge, donc ce n'est pas un faux vert — mais c'est le pire des
 * rouges, celui qui ne nomme pas ce qui a cassé et qui cache tout le reste.
 *
 * `tenter` rend la panne mesurable : l'appel qui lève donne `ok: false`, une
 * assertion le dit par son nom, et le fichier continue.
 */
const tenter = <T,>(quoi: () => T): { ok: boolean; valeur: T | null } => {
  try {
    return { ok: true, valeur: quoi() };
  } catch {
    return { ok: false, valeur: null };
  }
};

const NOTES: Note[] = ['oublie', 'difficile', 'correct', 'facile'];
const JOUR = 86_400_000;
const APPAREIL = 'AAAA1111';

/**
 * L'HORLOGE D'UNE ENTRÉE FABRIQUÉE, de la forme que le programme produit.
 *
 * Les quatre fabrications de cet essai omettaient « hlc » et « lot », que
 * « Journalisable » exige toutes deux. Elles éprouvaient donc des entrées que
 * le programme NE PEUT PAS produire, et rien ne le disait : tsx retire les
 * types sans les vérifier, et « scripts/ » n'est pas couvert par le typage du
 * dépôt.
 *
 * **Et il faut dire ce que cela ne coûtait PAS**, parce que je l'ai d'abord
 * cru plus grave. « hlc » est la clé primaire de « comparerJournalisables »,
 * et j'ai supposé que les assertions d'ordre — « l'ordre de lecture ne change
 * rien » — passaient par la retombée sur l'identifiant faute d'horloge.
 * Vérifié : « recalculer » trie par « id » seul et ne consulte jamais « hlc ».
 * Aucune de ces assertions n'était donc verte pour une mauvaise raison. Le
 * défaut est une entrée mal formée, pas un faux vert.
 */
function hlcDe(instantMs: number, rang = 0): string {
  return `${String(instantMs).padStart(15, '0')}-${rang.toString(36).toUpperCase().padStart(4, '0')}`;
}


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
      hlc: hlcDe(instant, i),
      lot: SANS_LOT,
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
    /*
       LA TOUTE PREMIÈRE ASSERTION DU FICHIER, et c'est pourquoi elle passe
       par « tenter » comme les autres : tant qu'elle paniquait, N'IMPORTE
       QUEL sabotage de « recalculer » tuait l'essai ici même, avant qu'une
       seule ligne ne soit imprimée. Le sabotage du tri inversé l'a montré —
       sortie 1, aucune croix, rien à lire.
    */
    const essai = tenter(() => recalculerCarte(journal));
    vrai(`${combien >= 2 ? 'ces révisions se rejouent' : 'cette révision se rejoue'} sans panne`, essai.ok);
    v(
      `${combien} ${combien >= 2 ? 'révisions' : 'révision'} : l’état rejoué est l’état tenu`,
      essai.valeur,
      carte,
    );
  }

  // L'ordre de lecture du journal ne doit rien changer : la fusion le rendra
  // dans n'importe quel ordre, et c'est l'identifiant qui porte l'ordre vrai.
  const { carte, journal } = parcourir(99, 30);
  const melange = [...journal].reverse();
  const aLEnvers = tenter(() => recalculerCarte(melange));
  vrai('le journal lu à l’envers se rejoue sans panne', aLEnvers.ok);
  v('l’ordre de lecture ne change rien', aLEnvers.valeur, carte);
  const hasard = mulberry32(5);
  const brasse = [...journal].sort(() => hasard() - 0.5);
  const brassee = tenter(() => recalculerCarte(brasse));
  vrai('un journal brassé se rejoue sans panne', brassee.ok);
  v('un ordre quelconque ne change rien', brassee.valeur, carte);

  v('un journal vide ne rend rien, et surtout pas une carte neuve', recalculerCarte([]), null);
}

/* ── Le socle ────────────────────────────────────────────────────────────── */

console.log('\nSocle des cartes antérieures au journal');
{
  // Une carte comme il en existe aujourd'hui : un état, aucune histoire.
  const { carte: ancienne } = parcourir(7, 12);
  /*
     LE QUATRIÈME ARGUMENT MANQUAIT, et l'essai tournait quand même.

     « socleDe » en demande quatre — carte, identifiant, appareil, horloge —
     et n'en recevait que trois : « hlc » valait « undefined ». Le socle
     éprouvé ici était donc un objet que le programme NE PEUT PAS produire ;
     le seul appel réel, dans « db.ts », fabrique toujours son horloge.

     Rien ne le disait : tsx retire les types sans les vérifier, et
     « scripts/ » n'est pas couvert par le typage du dépôt — relevé le
     1er novembre, 352 fichiers de « src/ » examinés et zéro de « scripts/ ».
     L'assertion qui suit était donc verte sur une entrée malformée, ce qui ne
     dit rien de l'entrée réelle : c'est vrai dans les deux sens, une
     assertion peut aussi bien être fausse sur l'objet bancal et juste sur le
     bon.

     L'horloge est construite comme « db.ts » la construit, et non inventée :
     les millisecondes de la dernière révision, complétées à quinze chiffres,
     puis un compteur en base 36. Une forme différente de celle que la
     migration produit ferait éprouver un second objet imaginaire.
  */
  const msDuSocle = Date.parse(
    ancienne.derniereRevision ?? ancienne.fsrs.last_review ?? ancienne.fsrs.due,
  );
  const hlcDuSocle = `${String(Number.isFinite(msDuSocle) ? msDuSocle : 0).padStart(15, '0')}-0000`;
  const socle = socleDe(ancienne, fabriqueUlid()(), APPAREIL, hlcDuSocle);
  v('le socle porte une horloge, comme la migration en pose une', socle.hlc, hlcDuSocle);
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
      hlc: hlcDe(instant),
      lot: SANS_LOT,
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
    hlc: hlcDe(Date.parse('2025-05-01T09:00:00.000Z')),
    lot: SANS_LOT,
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
        hlc: hlcDe(Date.parse('2025-07-01T09:00:00.000Z')),
        lot: SANS_LOT,
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

/* ── CE QUI ORDONNE LE REJEU, et ce qui ne l'ordonne pas ─────────────────── */

console.log('\nCe qui ordonne le rejeu d’un journal de révisions');
{
  /*
     UNE DISTINCTION QUI N'ÉTAIT ÉCRITE NULLE PART, et que j'ai failli prendre
     pour un défaut.

     Les entrées de ce journal sont « Journalisable » : elles portent une
     horloge, et « comparerJournalisables » — éprouvé dans la section
     suivante — départage d'abord par elle. Il est donc naturel de supposer
     que le rejeu suit le même ordre.

     IL NE LE SUIT PAS. « recalculer » trie par identifiant SEUL. C'est
     cohérent — un ULID est chronologique, et le rejeu est local, là où
     l'horloge sert à fusionner entre appareils — mais rien ne le disait, et
     deux ordres dans un même fichier sont deux occasions de se tromper.

     Les deux entrées ci-dessous se contredisent exprès : l'identifiant met A
     en premier, l'horloge met B. Ce que l'on relève est donc UNE DÉCISION,
     pas une coïncidence, et l'assertion rougira le jour où le rejeu passera à
     « comparerJournalisables » — ce qui est une bonne nouvelle à recevoir
     d'un essai plutôt que d'une carte mal recalculée.
  */
  const commun = {
    genre: 'notation' as const,
    carteId: 'c9',
    ficheId: 'f9',
    matiere: 'Économie',
    appareil: APPAREIL,
    lot: SANS_LOT,
  };
  /* A : identifiant le plus petit, horloge la PLUS GRANDE. */
  const aa: EntreeRevision = {
    ...commun,
    id: '00000000000000000000000001',
    hlc: hlcDe(Date.parse('2030-01-01T00:00:00.000Z')),
    le: '2025-01-01T09:00:00.000Z',
    note: 'oublie',
  };
  /* B : identifiant le plus grand, horloge la plus petite. */
  const bb: EntreeRevision = {
    ...commun,
    id: '00000000000000000000000002',
    hlc: hlcDe(Date.parse('2020-01-01T00:00:00.000Z')),
    le: '2025-02-01T09:00:00.000Z',
    note: 'facile',
  };

  vrai('prémisse : l’identifiant et l’horloge se contredisent bien',
    aa.id < bb.id && aa.hlc > bb.hlc);

  /*
     TOUT PASSE PAR « tenter », ET C'EST LE SABOTAGE QUI L'A EXIGÉ.

     Première rédaction : des appels nus. En sabotant le rejeu pour qu'il
     suive l'horloge, l'essai n'a pas rougi — il est MORT. L'ordre de
     l'horloge rejoue ces deux entrées à rebours du calendrier, FSRS refuse
     un intervalle de −31 jours, et l'exception a tué le processus au milieu
     du fichier. Les sections suivantes ne tournaient plus du tout.

     Un essai qui meurt est rouge, donc ce n'était pas un faux vert ; mais
     c'est le pire des rouges : il ne nomme pas ce qui a cassé, et il emporte
     tout ce qui venait après. La règle est la même que pour la région
     d'échec du site — un contrôle doit échouer LISIBLEMENT.

     Et la panne est elle-même un résultat qu'il vaut mieux consigner que
     subir : si le rejeu passait à l'horloge, ces données ne seraient pas
     mal recalculées, elles seraient INREJOUABLES.
  */
  const direct = tenter(() => recalculerCarte([aa, bb]));
  const inverse = tenter(() => recalculerCarte([bb, aa]));
  vrai('le rejeu aboutit, sans panne', direct.ok && inverse.ok);
  const parLIdentifiant = direct.valeur;
  v('le rejeu ne dépend pas de l’ordre du tableau', inverse.valeur, parLIdentifiant);

  /*
     Et voici la décision elle-même : la dernière note appliquée est celle de
     l'entrée au PLUS GRAND IDENTIFIANT, donc « facile ». Si le rejeu suivait
     l'horloge, ce serait « oublie », et l'intervalle serait tout autre.
  */
  const commeSiLHorloge = tenter(() => recalculerCarte([bb])).valeur;
  const commeSiLIdentifiant = tenter(() => recalculerCarte([aa])).valeur;
  vrai('prémisse : les deux notes ne mènent pas au même état',
    commeSiLHorloge?.fsrs.scheduled_days !== commeSiLIdentifiant?.fsrs.scheduled_days);
  /*
     LA PREMIÈRE RÉDACTION DE CE CONTRÔLE COMPARAIT « recalculerCarte([aa, bb]) »
     À LUI-MÊME. Elle était verte et ne pouvait pas être autre chose : une
     assertion qui confronte une valeur à elle-même ne mesure rien, quelle que
     soit la conviction de celui qui l'écrit. Les deux qui suivent se
     confrontent à l'ordre CONCURRENT, qui est ce qu'il fallait écarter.
  */
  vrai('le rejeu suit l’IDENTIFIANT : la dernière appliquée est B',
    parLIdentifiant?.derniereRevision === bb.le);
  vrai('et NON l’horloge, qui aurait mis A en dernier',
    parLIdentifiant?.derniereRevision !== aa.le);
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
