/**
 * Le découpage : ce qui part entier revient entier.
 *
 * Éprouvé par propriétés, parce que les tailles limites sont là où ça casse :
 * un paquet d'exactement un morceau, d'un morceau plus un octet, d'un octet.
 * Choisir ces cas à la main, c'est choisir ceux auxquels on a pensé.
 */
import fc from 'fast-check';
import {
  emettre,
  receveur,
  ReceptionRefusee,
  TAILLE_MORCEAU,
  type Progression,
} from '../src/lib/sync/morceaux';

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

function propriete<T>(intitule: string, arbitraire: fc.Arbitrary<T>, verifier: (x: T) => boolean) {
  try {
    fc.assert(fc.asyncProperty(arbitraire, verifier as never), { numRuns: 120 });
    console.log(`  ✓ ${intitule}`);
  } catch (erreur) {
    echecs += 1;
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error(
      `  ✗ ${intitule}\n${message.split('\n').slice(0, 10).map((l) => `      ${l}`).join('\n')}`,
    );
  }
}

/** Un couple émetteur/récepteur relié par un simple tableau. */
function relier(options: { plafond?: number; avarie?: 'aucune' | 'double' } = {}) {
  const r = receveur(options.plafond);
  const recus: Uint8Array[] = [];
  const emetteur = (octets: Uint8Array) => {
    const livrer = (m: Uint8Array) => {
      const complet = r.recevoir(m);
      if (complet) recus.push(complet);
    };
    livrer(octets);
    // Un morceau livré deux fois : le réseau le fait, le canal fiable moins,
    // mais un renvoi applicatif le ferait et il ne doit rien casser.
    if (options.avarie === 'double') livrer(octets);
  };
  return { emetteur, recus, progression: () => r.progression() };
}

const paquetDe = (taille: number) => {
  const octets = new Uint8Array(taille);
  for (let i = 0; i < taille; i += 1) octets[i] = (i * 31 + 7) % 256;
  return octets;
};

console.log('\nAller-retour');

for (const taille of [1, 100, TAILLE_MORCEAU - 1, TAILLE_MORCEAU, TAILLE_MORCEAU + 1, 70_000]) {
  const { emetteur, recus } = relier();
  const paquet = paquetDe(taille);
  await emettre(emetteur, paquet);
  v(`${taille} octet(s) : un seul paquet reçu`, recus.length, 1);
  v(`${taille} octet(s) : identique`, [...recus[0]].slice(0, 50), [...paquet].slice(0, 50));
  v(`${taille} octet(s) : même longueur`, recus[0]?.length, taille);
}

propriete(
  'n’importe quelle taille jusqu’à 50 Kio fait l’aller-retour',
  fc.integer({ min: 0, max: 50_000 }),
  async (taille) => {
    const { emetteur, recus } = relier();
    const paquet = paquetDe(taille);
    await emettre(emetteur, paquet, { taille: 1 + (taille % 997) });
    return (
      recus.length === 1 &&
      recus[0].length === taille &&
      recus[0].every((octet, i) => octet === paquet[i])
    );
  },
);

propriete(
  'un morceau livré deux fois ne change rien',
  fc.integer({ min: 1, max: 20_000 }),
  async (taille) => {
    const { emetteur, recus } = relier({ avarie: 'double' });
    const paquet = paquetDe(taille);
    await emettre(emetteur, paquet, { taille: 512 });
    return recus.length >= 1 && recus[0].length === taille;
  },
);

console.log('\nProgression');

{
  const { emetteur } = relier();
  const vues: Progression[] = [];
  await emettre(emetteur, paquetDe(50_000), {
    taille: 10_000,
    surProgression: (p) => vues.push(p),
  });
  v('une annonce par morceau', vues.length, 5);
  vrai('elle croît', vues.every((p, i) => i === 0 || p.faits > vues[i - 1].faits));
  v('et finit exactement au total', vues.at(-1), { faits: 50_000, total: 50_000 });
  vrai('elle ne dépasse jamais le total', vues.every((p) => p.faits <= p.total));
}

{
  /* La progression du récepteur est ce que l'écran affiche quand c'est lui qui
     reçoit : elle doit être lisible avant la fin, sans quoi elle ne sert à rien. */
  const r = receveur();
  const paquet = paquetDe(30_000);
  const messages: Uint8Array[] = [];
  await emettre((m) => void messages.push(new Uint8Array(m)), paquet, { taille: 10_000 });
  r.recevoir(messages[0]);
  v('après l’en-tête, le total est connu', r.progression(), { faits: 0, total: 30_000 });
  r.recevoir(messages[1]);
  v('et le reçu avance', r.progression(), { faits: 10_000, total: 30_000 });
}

console.log('\nCe qui doit être refusé');

{
  const r = receveur();
  let motif = '';
  try {
    r.recevoir(new Uint8Array([2, 0, 0, 0, 0, 42]));
  } catch (erreur) {
    motif = erreur instanceof ReceptionRefusee ? erreur.motif : 'autre';
  }
  v('un morceau sans en-tête', motif, 'sans-entete');
}

{
  const r = receveur(1000);
  let motif = '';
  const entete = new Uint8Array([1, 0, 0, 0, 0]);
  new DataView(entete.buffer).setUint32(1, 2000);
  try {
    r.recevoir(entete);
  } catch (erreur) {
    motif = erreur instanceof ReceptionRefusee ? erreur.motif : 'autre';
  }
  v('un en-tête au-dessus du plafond', motif, 'trop-gros');
}

{
  const r = receveur();
  let motif = '';
  try {
    r.recevoir(new Uint8Array([9, 9, 9]));
  } catch (erreur) {
    motif = erreur instanceof ReceptionRefusee ? erreur.motif : 'autre';
  }
  v('un type de message inconnu', motif, 'message-inconnu');
}

{
  const r = receveur();
  const entete = new Uint8Array([1, 0, 0, 0, 0]);
  new DataView(entete.buffer).setUint32(1, 10);
  r.recevoir(entete);
  let motif = '';
  try {
    const trop = new Uint8Array(5 + 20);
    trop[0] = 2;
    r.recevoir(trop);
  } catch (erreur) {
    motif = erreur instanceof ReceptionRefusee ? erreur.motif : 'autre';
  }
  v('plus d’octets que l’en-tête n’en annonce', motif, 'debordement');
}

{
  /* Deux paquets de suite sur le même canal : l'état doit repartir de zéro,
     sans quoi le second hériterait des morceaux du premier. */
  const { emetteur, recus } = relier();
  await emettre(emetteur, paquetDe(5_000), { taille: 1_000 });
  await emettre(emetteur, paquetDe(3_000), { taille: 1_000 });
  v('deux paquets de suite sont rendus séparément', recus.map((p) => p.length), [5_000, 3_000]);
}

console.log('\nLa vidange est attendue avant chaque morceau');

{
  const { emetteur } = relier();
  let attentes = 0;
  await emettre(emetteur, paquetDe(25_000), {
    taille: 10_000,
    attendreVidange: async () => void attentes++,
  });
  v('une attente par morceau', attentes, 3);
}

console.log(echecs === 0 ? '\nTous les essais passent.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
