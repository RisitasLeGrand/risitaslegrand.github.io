/**
 * Deux appareils simulés, et le scénario que le prompt demande.
 *
 * « Deux appareils simulés avec cinq ans de données synthétiques, 30 jours de
 * divergence hors ligne, puis fusion dans les deux sens : états et sauvegardes
 * identiques, XP, série et FSRS identiques après recalcul. »
 *
 * S'y ajoutent les cas limites de la section 6 du prompt que le moteur peut
 * éprouver sans réseau : dérive d'horloge, paquet tronqué, paquet rejoué,
 * suppression concurrente, reprise après interruption.
 */
import {
  appareil,
  deriveIdentique,
  identiques,
  transmettre,
  type AppareilSimule,
} from '../src/lib/sync/simulateur';
import {
  apercu,
  fabriquer,
  nomDeFichier,
  ouvrir,
  tranche,
  VERSION_PAQUET,
} from '../src/lib/sync/paquet';
import { SauvegardeRefusee } from '../src/lib/sauvegarde/format';

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

const JOUR = 86_400_000;
const MDP = 'mot-de-passe-d-essai';

/** Une paire d'appareils partageant une horloge d'essai pilotable. */
function paire(options: { deriveB?: number } = {}) {
  let instant = Date.parse('2021-01-01T08:00:00Z');
  const horloge = () => instant;
  const a = appareil({ nom: 'Ordinateur', identifiant: 'AAAA1111', instant: horloge });
  const b = appareil({
    nom: 'Téléphone',
    identifiant: 'BBBB2222',
    instant: horloge,
    deriveHorloge: options.deriveB ?? 0,
  });
  return {
    a,
    b,
    avancer: (ms: number) => {
      instant += ms;
    },
    maintenant: () => instant,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le scénario du prompt
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCINQ ANS DE DONNÉES, PUIS TRENTE JOURS DE DIVERGENCE');

{
  const { a, b, avancer } = paire();
  const hasard = mulberry32(42);

  // Cinq ans d'usage commun : on révise sur l'ordinateur, on synchronise de
  // temps en temps. C'est l'histoire partagée, celle que les deux appareils
  // auront en commun avant de diverger.
  const jours = Math.round(5 * 365.25);
  let synchronisations = 0;
  for (let jour = 0; jour < jours; jour += 1) {
    avancer(JOUR);
    const combien = 2 + Math.floor(hasard() * 6);
    for (let i = 0; i < combien; i += 1) {
      a.saisir('revision', `carte-${Math.floor(hasard() * 400)}`, {
        valeur: 1 + Math.floor(hasard() * 4),
      });
    }
    if (jour % 7 === 3) {
      b.saisir('checkin', `jour-${jour}`, { valeur: 1 + Math.floor(hasard() * 3) });
    }
    // Une synchronisation par semaine, dans les deux sens.
    if (jour % 7 === 6) {
      transmettre(a, b, { lot: `L${jour}` });
      transmettre(b, a, { lot: `L${jour}` });
      synchronisations += 1;
    }
  }
  transmettre(a, b, { lot: 'FIN' });
  transmettre(b, a, { lot: 'FIN' });

  const commun = a.etat().operations.length;
  console.log(`  ${commun.toLocaleString('fr-FR')} opérations communes, ${synchronisations} synchronisations`);
  vrai('après cinq ans, les deux appareils sont identiques', await identiques(a, b));
  vrai('et leurs états dérivés aussi', deriveIdentique(a, b));

  // Trente jours hors ligne, les deux appareils travaillant chacun de son côté.
  for (let jour = 0; jour < 30; jour += 1) {
    avancer(JOUR);
    for (let i = 0; i < 3; i += 1) {
      a.saisir('revision', `carte-${Math.floor(hasard() * 400)}`, { valeur: 2 });
    }
    b.saisir('checkin', `jour-hors-ligne-${jour}`, { valeur: 3 });
    b.saisir('revision', `carte-${Math.floor(hasard() * 400)}`, { valeur: 1 });
  }
  a.regler('bascule', 5);
  b.regler('fuseau', 'Europe/Paris');

  const divergeA = a.etat().operations.length;
  const divergeB = b.etat().operations.length;
  console.log(`  divergence : ${divergeA - commun} opérations ici, ${divergeB - commun} là-bas`);
  vrai('les empreintes diffèrent, et l’écran doit le dire', !(await identiques(a, b)));

  // Fusion dans les deux sens.
  const versB = transmettre(a, b, { lot: 'REPRISE' });
  const versA = transmettre(b, a, { lot: 'REPRISE' });
  v('le téléphone reçoit les opérations de l’ordinateur', versB.recues, divergeA - commun);
  v('et l’ordinateur celles du téléphone', versA.recues, divergeB - commun);

  vrai('après fusion, les deux appareils sont identiques', await identiques(a, b));
  vrai('et leurs états dérivés, après recalcul, le sont aussi', deriveIdentique(a, b));
  v(
    'aucune opération perdue : le total est la somme des deux divergences',
    a.etat().operations.length,
    commun + (divergeA - commun) + (divergeB - commun),
  );
  v('aucun conflit : révisions et check-in sont des événements', versA.conflits, 0);
  v('ni collision d’identifiants', versA.collisions, 0);

  // Les réglages, chacun écrit d'un côté, se retrouvent des deux.
  const reglagesA = a.etat().reglages;
  const reglagesB = b.etat().reglages;
  v('le réglage écrit ici est passé là-bas', reglagesB.bascule?.valeur, 5);
  v('et celui écrit là-bas est arrivé ici', reglagesA.fuseau?.valeur, 'Europe/Paris');
}

/* ══════════════════════════════════════════════════════════════════════════
   Dérive d'horloge
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nDÉRIVE D’HORLOGE : L’ORDRE OBSERVÉ EST CONSERVÉ');

{
  // Le téléphone a quarante minutes de retard. Ses saisies postérieures à ce
  // qu'il a reçu doivent rester postérieures.
  const { a, b, avancer } = paire({ deriveB: -40 * 60 * 1000 });
  a.saisir('revision', 'carte-1', { valeur: 1 });
  avancer(1000);
  transmettre(a, b);
  const apres = b.saisir('revision', 'carte-2', { valeur: 2 });
  const recue = b.etat().operations.find((o) => o.cible === 'carte-1')!;
  vrai(
    'ce que le téléphone émet après avoir reçu est postérieur, malgré son retard',
    apres.hlc > recue.hlc,
  );

  transmettre(b, a);
  vrai('et les deux convergent', await identiques(a, b));
}

/* ══════════════════════════════════════════════════════════════════════════
   Paquet tronqué, rejoué, perdu
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCOUPURE, REPRISE, REJEU');

{
  const { a, b, avancer } = paire();
  for (let i = 0; i < 20; i += 1) {
    avancer(1000);
    a.saisir('revision', `carte-${i}`, { valeur: 1 });
  }

  // Coupure franche : rien n'arrive.
  const perdu = transmettre(a, b, { avarie: { genre: 'perdu' } });
  v('un paquet perdu n’apporte rien', perdu.recues, 0);
  v('et ne laisse rien derrière lui', b.etat().operations.length, 0);

  // Coupure en cours de transfert : la moitié arrive.
  const tronque = transmettre(a, b, { avarie: { genre: 'tronque', garder: 8 }, lot: 'T1' });
  v('un paquet tronqué livre ce qui est arrivé', tronque.recues, 8);
  vrai('les appareils ne sont pas identiques : il manque la suite', !(await identiques(a, b)));

  // La reprise : on renvoie le paquet **entier**, ce que l'idempotence permet.
  const reprise = transmettre(a, b, { lot: 'T2' });
  v('la reprise n’apporte que ce qui manquait', reprise.recues, 12);
  transmettre(b, a, { lot: 'T2' });
  vrai('et les deux convergent', await identiques(a, b));

  // Rejeu : le même paquet deux fois de suite.
  const rejeu = transmettre(a, b, { avarie: { genre: 'double' }, lot: 'T3' });
  v('un paquet rejoué n’apporte rien la seconde fois', rejeu.recues, 0);
  vrai('et les appareils restent identiques', await identiques(a, b));
}

/* ══════════════════════════════════════════════════════════════════════════
   Suppression concurrente
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nSUPPRESSION CONCURRENTE');

{
  const { a, b, avancer } = paire();
  a.saisir('seance', 'seance-1', { valeur: 1 });
  transmettre(a, b);
  transmettre(b, a);

  // L'un supprime, l'autre modifie, puis ils se parlent.
  avancer(1000);
  a.saisir('suppression', 'seance-1', { motif: 'doublon' });
  avancer(1000);
  b.saisir('seance', 'seance-1', { valeur: 2 });

  transmettre(a, b, { lot: 'S1' });
  transmettre(b, a, { lot: 'S1' });

  vrai('les deux convergent', await identiques(a, b));
  const suppressions = a.etat().operations.filter((o) => o.type === 'suppression');
  v('la suppression survit : rien ne la ressuscite', suppressions.length, 1);
  v(
    'et la modification concurrente est conservée, pas effacée',
    a.etat().operations.filter((o) => o.cible === 'seance-1').length,
    3,
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Conflit sur un champ sensible
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCONFLIT SUR UN CHAMP SENSIBLE');

{
  const { a, b, avancer } = paire();
  a.saisir('odyssee.poids', 'poids:2026-10-09', { kg: 74.2 });
  avancer(30 * 60 * 1000);
  b.saisir('odyssee.poids', 'poids:2026-10-09', { kg: 73.8 });

  const echange = transmettre(a, b, { lot: 'P1' });
  v('le conflit est annoncé', echange.conflits, 1);
  transmettre(b, a, { lot: 'P1' });

  vrai('les deux appareils convergent malgré le conflit', await identiques(a, b));
  const conflitsA = [...a.etat().operations].filter((o) => o.type === 'odyssee.poids');
  v('les deux valeurs sont conservées', conflitsA.length, 2);
  vrai(
    'aucune n’a été écrasée',
    conflitsA.some((o) => (o.charge as { kg: number }).kg === 74.2) &&
      conflitsA.some((o) => (o.charge as { kg: number }).kg === 73.8),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Le format de paquet, bout en bout
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE PAQUET : CHIFFRÉ, VÉRIFIÉ, REFUSÉ QUAND IL LE FAUT');

{
  const { a, b, avancer } = paire();
  for (let i = 0; i < 12; i += 1) {
    avancer(1000);
    a.saisir('revision', `carte-${i}`, { valeur: 1 });
  }
  a.regler('bascule', 4);

  const paquet = await fabriquer({
    contenu: a.paquet(),
    appareil: 'AAAA1111',
    nomAppareil: 'Ordinateur de bureau',
    schema: 13,
    tranche: tranche(),
    empreinte: await a.empreinte(),
    motDePasse: MDP,
    versionApplication: 'essai',
    // 1 000 itérations au lieu de 600 000 : l'essai porte sur le format, pas sur
    // le coût de la dérivation, que « essais:sauvegarde:format » mesure déjà.
    iterations: 1000,
  });

  v('douze opérations annoncées', paquet.operations, 12);
  const vu = await apercu(paquet.octets);
  v('l’aperçu nomme l’appareil sans déchiffrer', vu.metadonnees.nomAppareil, 'Ordinateur de bureau');
  v('et son schéma', vu.metadonnees.schema, 13);
  vrai('le paquet est chiffré', vu.chiffre);
  vrai('et intact', vu.intact);
  v('au format courant', vu.metadonnees.versionPaquet, VERSION_PAQUET);

  const ouvert = await ouvrir(paquet.octets, MDP, 13);
  v('les douze opérations sont relues', ouvert.contenu.operations.length, 12);
  v('aucune ligne illisible', ouvert.lignesIllisibles, 0);
  v('les réglages voyagent', ouvert.contenu.reglages.bascule?.valeur, 4);
  v(
    'et la relecture rend exactement ce qui a été écrit',
    JSON.stringify(ouvert.contenu.operations),
    JSON.stringify(a.paquet().operations),
  );

  // Fusionné, il donne le même résultat qu'un transport en clair.
  b.recevoir(ouvert.contenu, 'PAQ');
  vrai('fusionner un paquet déchiffré converge', await identiques(a, b));

  // Les refus.
  const refus = async (quoi: string, action: () => Promise<unknown>) => {
    try {
      await action();
      echecs += 1;
      console.error(`  ✗ ${quoi} : accepté alors qu’il devait être refusé`);
    } catch (erreur) {
      const motif = erreur instanceof SauvegardeRefusee ? erreur.motif : 'autre';
      console.log(`  ✓ ${quoi} (${motif})`);
    }
  };

  await refus('mauvais mot de passe', () => ouvrir(paquet.octets, 'pas-le-bon', 13));
  await refus('schéma plus récent que le local', () => ouvrir(paquet.octets, MDP, 12));
  await refus('paquet tronqué', () =>
    ouvrir(paquet.octets.subarray(0, paquet.octets.length - 40), MDP, 13),
  );
  await refus('octets quelconques', () => ouvrir(new Uint8Array([1, 2, 3, 4]), MDP, 13));

  // Un schéma plus ancien, en revanche, doit passer : c'est tout le point d'un
  // journal immuable.
  const ancien = await ouvrir(paquet.octets, MDP, 14);
  v('un paquet d’un schéma plus ancien est accepté', ancien.contenu.operations.length, 12);

  v(
    'le nom de fichier porte l’appareil',
    nomDeFichier('AAAA1111', new Date('2026-10-11T05:17:00Z')).startsWith('cyclades-aaaa1111-'),
    true,
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Trois appareils : l'associativité en pratique
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nTROIS APPAREILS, EN ÉTOILE');

{
  let instant = Date.parse('2026-01-01T08:00:00Z');
  const horloge = () => instant;
  const ordinateur = appareil({ nom: 'Ordinateur', identifiant: 'AAAA1111', instant: horloge });
  const telephone = appareil({ nom: 'Téléphone', identifiant: 'BBBB2222', instant: horloge });
  const tablette = appareil({ nom: 'Tablette', identifiant: 'CCCC3333', instant: horloge });
  const tous: AppareilSimule[] = [ordinateur, telephone, tablette];

  for (const [i, app] of tous.entries()) {
    for (let n = 0; n < 5; n += 1) {
      instant += 1000;
      app.saisir('revision', `carte-${i}-${n}`, { valeur: n });
    }
  }

  // La tablette ne parle jamais à l'ordinateur : tout passe par le téléphone.
  transmettre(tablette, telephone, { lot: 'E1' });
  transmettre(telephone, tablette, { lot: 'E1' });
  transmettre(telephone, ordinateur, { lot: 'E2' });
  transmettre(ordinateur, telephone, { lot: 'E2' });
  transmettre(telephone, tablette, { lot: 'E3' });

  vrai('ordinateur et téléphone sont identiques', await identiques(ordinateur, telephone));
  vrai('téléphone et tablette aussi', await identiques(telephone, tablette));
  vrai(
    'donc ordinateur et tablette, qui ne se sont jamais parlé',
    await identiques(ordinateur, tablette),
  );
  v('et les quinze opérations sont partout', ordinateur.etat().operations.length, 15);
}

console.log(echecs === 0 ? '\nTous les essais passent.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
