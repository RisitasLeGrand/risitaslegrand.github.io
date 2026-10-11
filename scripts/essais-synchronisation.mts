/**
 * Les invariants du socle de synchronisation : ULID, horloge logique, empreinte.
 *
 * Ces trois modules ont une propriété commune : ils peuvent être faux sans que
 * rien ne le montre. Un ULID non monotone donne un journal dont l'ordre est
 * presque bon ; une horloge qui absorbe une dérive donne des dates presque
 * justes ; une empreinte qui dépend de l'ordre d'insertion des clés affiche
 * « différents » sur deux appareils identiques. Aucun de ces trois défauts ne
 * produit d'erreur. Le premier corrompt l'ordre de fusion, le deuxième le
 * propage, le troisième apprend à ne pas croire l'écran.
 *
 * Les essais de propriétés sont écrits à la main, sur une graine fixe, plutôt
 * qu'avec une bibliothèque de génération : le prompt prévoit « fast-check » pour
 * le moteur de fusion à la phase 2, et introduire une dépendance maintenant
 * obligerait à l'installer pour vérifier trois fonctions pures.
 */
import {
  estUlid,
  fabriqueUlid,
  instantDeUlid,
  TAILLE_ULID,
  ulid,
} from '../src/lib/noyau/ulid';
import {
  comparerHlc,
  decoderHlc,
  DERIVE_MAX_MS,
  encoderHlc,
  HlcRefusee,
  Horloge,
  type Hlc,
} from '../src/lib/noyau/hlc';
import {
  empreinte,
  empreinteLisible,
  memeEmpreinte,
  normaliser,
} from '../src/lib/noyau/empreinte';

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

/* ── Générateur reproductible ────────────────────────────────────────────── */

function mulberry32(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── ULID ────────────────────────────────────────────────────────────────── */

console.log('\nULID');
{
  const id = ulid();
  v('longueur de 26 signes', id.length, TAILLE_ULID);
  vrai('reconnu par estUlid', estUlid(id));
  vrai('un UUID n’est pas un ULID', !estUlid('0191f0a0-1c2d-7e3f-8a9b-0c1d2e3f4a5b'));
  vrai('minuscules refusées', !estUlid(id.toLowerCase()));

  // L'instant est relu tel qu'il a été écrit, à la milliseconde.
  const fige = 1_760_000_000_000;
  const fabrique = fabriqueUlid(() => fige);
  v('instant relu', instantDeUlid(fabrique()), fige);

  // La monotonie dans une milliseconde figée : c'est le cas réel d'une rafale
  // de révisions enregistrées dans la même boucle.
  const rafale = Array.from({ length: 5000 }, () => fabrique());
  const trie = [...rafale].sort();
  v('5 000 identifiants dans la même milliseconde restent ordonnés', trie, rafale);
  v('et tous distincts', new Set(rafale).size, rafale.length);
  v('tous au même instant', new Set(rafale.map(instantDeUlid)).size, 1);

  // L'horloge qui recule : une synchronisation NTP, un changement d'heure.
  let instant = 1_760_000_000_000;
  const recule = fabriqueUlid(() => instant);
  const avant = recule();
  instant -= 60_000;
  const apres = recule();
  vrai('un identifiant émis après une horloge qui recule reste supérieur', apres > avant);
  v('et garde l’instant du précédent', instantDeUlid(apres), instantDeUlid(avant));

  // L'ordre lexicographique suit l'ordre du temps, qui est la raison d'être du
  // choix : sans cela, un UUID aurait suffi.
  const hasard = mulberry32(7);
  const instants = Array.from({ length: 200 }, () => Math.floor(hasard() * 1e12));
  const ids = instants.map((ms) => fabriqueUlid(() => ms)());
  const parTemps = [...ids].sort(
    (a, b) => instantDeUlid(a) - instantDeUlid(b) || (a < b ? -1 : 1),
  );
  v('l’ordre lexicographique est l’ordre chronologique', [...ids].sort(), parTemps);
}

/* ── Horloge logique hybride ─────────────────────────────────────────────── */

console.log('\nHorloge logique hybride');
{
  const code = encoderHlc({ ms: 1_760_000_000_000, compteur: 42 });
  v('encodée en 20 signes', code.length, 20);
  v('aller-retour', decoderHlc(code), { ms: 1_760_000_000_000, compteur: 42 });

  // L'ordre des chaînes doit être l'ordre des horloges : c'est ce qui permet
  // d'indexer le journal sur l'horloge et de lire un intervalle.
  const hasard = mulberry32(11);
  const horloges: Hlc[] = Array.from({ length: 400 }, () => ({
    ms: Math.floor(hasard() * 2e12),
    compteur: Math.floor(hasard() * 1000),
  }));
  const parComparaison = [...horloges].sort(comparerHlc).map(encoderHlc);
  const parChaine = horloges.map(encoderHlc).sort();
  v('l’ordre des chaînes est l’ordre des horloges', parChaine, parComparaison);

  // Deux émissions dans la même milliseconde se départagent par le compteur.
  // Le compteur retombe à zéro dès que la partie murale progresse — c'est la
  // règle de l'horloge hybride, et c'est pourquoi la première émission porte
  // zéro : deux appareils aux horloges justes émettant au même instant
  // produisent la même horloge, et c'est l'identifiant d'appareil qui les
  // départage, non le compteur.
  const fige = new Horloge(() => 1000);
  v('première émission : le compteur part de zéro', fige.emettre(), { ms: 1000, compteur: 0 });
  v('deuxième émission, même ms', fige.emettre(), { ms: 1000, compteur: 1 });
  v('troisième', fige.emettre(), { ms: 1000, compteur: 2 });
  const avance = new Horloge(() => 2000, { ms: 1000, compteur: 7 });
  v('le compteur retombe quand la partie murale progresse', avance.emettre(), {
    ms: 2000,
    compteur: 0,
  });

  // La propriété qui justifie tout le module : l'ordre observé est conservé
  // même quand l'horloge murale de l'émetteur est fausse. Ici l'appareil B est
  // en retard d'une demi-heure ; il reçoit de A, puis émet. Son émission doit
  // rester postérieure à ce qu'il a reçu.
  const a = new Horloge(() => 1_760_000_600_000);
  const b = new Horloge(() => 1_760_000_600_000 - 30 * 60 * 1000);
  const deA = a.emettre();
  const chezB = b.recevoir(deA);
  const deB = b.emettre();
  vrai('ce que B émet après avoir reçu de A est postérieur', comparerHlc(deB, deA) > 0);
  vrai('et l’horloge de B a rattrapé celle de A', chezB.ms >= deA.ms);

  // Une dérive excessive est refusée, pas absorbée : l'absorber propagerait la
  // faute à tout le journal, sans retour possible.
  const sain = new Horloge(() => 1_760_000_000_000);
  let refus: HlcRefusee | null = null;
  try {
    sain.recevoir({ ms: 1_760_000_000_000 + DERIVE_MAX_MS + 1, compteur: 0 });
  } catch (erreur) {
    refus = erreur as HlcRefusee;
  }
  v('dérive au-delà du plafond refusée', refus?.motif, 'derive-excessive');
  v('et l’horloge locale reste intacte', sain.valeur, { ms: 0, compteur: 0 });
  v(
    'une dérive juste sous le plafond est acceptée',
    sain.recevoir({ ms: 1_760_000_000_000 + DERIVE_MAX_MS - 1, compteur: 3 }).compteur,
    4,
  );

  // Un aller-retour de 200 messages entre deux appareils aux horloges
  // divergentes : chaque horloge doit être strictement croissante chez elle.
  const gauche = new Horloge(() => 1_760_000_000_000);
  const droite = new Horloge(() => 1_760_000_000_000 + 5 * 60 * 1000);
  const vues: Hlc[] = [];
  let croissante = true;
  for (let i = 0; i < 200; i += 1) {
    const emetteur = i % 2 === 0 ? gauche : droite;
    const receveur = i % 2 === 0 ? droite : gauche;
    const emise = emetteur.emettre();
    receveur.recevoir(emise);
    if (vues.length && comparerHlc(emise, vues[vues.length - 1]) <= 0) croissante = false;
    vues.push(emise);
  }
  vrai('200 échanges croisés donnent une suite strictement croissante', croissante);
}

/* ── Empreinte d'état ────────────────────────────────────────────────────── */

console.log('\nEmpreinte d’état');
{
  const ids = ['01K7', '01K8', '01K9'];
  const directe = await empreinte({ operations: ids });
  const melangee = await empreinte({ operations: [...ids].reverse() });
  v('l’ordre de lecture du journal ne change rien', melangee, directe);

  const uneDeMoins = await empreinte({ operations: ids.slice(0, 2) });
  vrai('une opération en moins change l’empreinte', uneDeMoins !== directe);

  // Le soin principal du module : deux réglages de même contenu mais d'ordre
  // d'insertion différent doivent donner la même empreinte.
  const r1 = { bascule: 4, fuseau: 'Europe/Paris', rotation: ['a', 'b'] };
  const r2 = { rotation: ['a', 'b'], fuseau: 'Europe/Paris', bascule: 4 };
  v(
    'l’ordre des clés des réglages ne change rien',
    await empreinte({ operations: ids, reglages: r2 }),
    await empreinte({ operations: ids, reglages: r1 }),
  );
  vrai(
    'mais une valeur de réglage différente, oui',
    (await empreinte({ operations: ids, reglages: { ...r1, bascule: 5 } })) !== directe,
  );
  vrai(
    'et l’ordre d’un tableau de réglage compte',
    (await empreinte({ operations: ids, reglages: { ...r1, rotation: ['b', 'a'] } })) !==
      (await empreinte({ operations: ids, reglages: r1 })),
  );
  v(
    'une clé absente et une clé à « undefined » sont équivalentes',
    await empreinte({ operations: ids, reglages: { bascule: 4, theme: undefined } }),
    await empreinte({ operations: ids, reglages: { bascule: 4 } }),
  );
  v('normaliser trie en profondeur', normaliser({ b: { d: 1, c: 2 }, a: 3 }), {
    a: 3,
    b: { c: 2, d: 1 },
  });

  // Le compte ouvre la chaîne : sans lui, deux états pourraient se confondre
  // par recollement des séparateurs.
  vrai(
    'un journal vide et un journal d’une opération vide diffèrent',
    (await empreinte({ operations: [] })) !== (await empreinte({ operations: [''] })),
  );

  v('forme lisible', empreinteLisible('7f2a91c48d06b3e1ffff'), '7F2A · 91C4 · 8D06 · B3E1');
  vrai(
    'la comparaison porte sur ce qui est affiché',
    memeEmpreinte('7f2a91c48d06b3e1aaaa', '7F2A91C48D06B3E1bbbb'),
  );
  vrai(
    'et distingue ce qui est affiché différemment',
    !memeEmpreinte('7f2a91c48d06b3e1', '7f2a91c48d06b3e0'),
  );
}

console.log(echecs === 0 ? '\nTous les essais passent.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
