/**
 * Le cycle de vie de la boîte : la paire dure, et rien ne se perd en silence.
 *
 *   npm run essais:boite-du-coffre
 *
 * Le contrôle qui compte est le troisième du Pilote, et c'est le seul des
 * trois qui porte sur une PERTE plutôt que sur une fuite : après un
 * changement de mot de passe, un report en attente doit être reporté ou
 * signalé, **jamais perdu en silence**. Un geste perdu sans trace est pire
 * qu'un geste refusé — la personne croit l'avoir fait.
 *
 * Tout s'exécute sur le WebCrypto de Node, avec un rangement en mémoire :
 * le cas qui compte — le mot de passe changé — serait impossible à atteindre
 * dans un navigateur sans reconstruire le site entre deux assertions.
 */
import { deposer, relever } from '../src/lib/noyau/boite-aux-lettres';
import {
  CLEF_PRIVEE,
  CLEF_PUBLIQUE,
  type RangementDeLaBoite,
  assurerLaBoite,
  etatDeLaBoite,
  oublierLaBoite,
  priveeDeLaBoite,
  publiqueDeLaBoite,
  renouvelerLaBoite,
} from '../src/lib/noyau/boite-du-coffre';

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

/** Un rangement en clair, comme la base l'offrirait. */
const rangement = (): RangementDeLaBoite & { carte: Map<string, string> } => {
  const carte = new Map<string, string>();
  return {
    carte,
    lire: async (c) => carte.get(c),
    ecrire: async (c, val) => void carte.set(c, val),
    effacer: async (c) => void carte.delete(c),
  };
};

/** Une clé de coffre, dérivée comme le vrai coffre la dérive. */
const cleDeCoffre = async (motDePasse: string): Promise<CryptoKey> => {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(motDePasse),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('sel d’essai'), iterations: 1000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

const report = { tacheId: 'T1', jourPrevu: '2026-10-12', branche: 'psyche', le: '2026-10-12T08:05:00.000Z' };

const ancien = await cleDeCoffre('mot-de-passe-un');
const neuf = await cleDeCoffre('mot-de-passe-deux');

/* ── 1. La naissance ───────────────────────────────────────────────────── */
console.log('\nLa boîte naît à la première ouverture du coffre');

const r = rangement();
v('avant tout, elle est absente', await etatDeLaBoite(r, ancien), 'absente');
v('et sa publique n’existe pas', await publiqueDeLaBoite(r), null);
v('on l’assure', await assurerLaBoite(r, ancien), 'utilisable');
v('la publique est rangée en clair', typeof r.carte.get(CLEF_PUBLIQUE), 'string');
v('la privée est rangée scellée', (r.carte.get(CLEF_PRIVEE) ?? '').includes('"ct"'), true);
v(
  'et la privée en clair n’apparaît nulle part dans le rangement',
  [...r.carte.values()].join('').includes('BEGIN PRIVATE KEY'),
  false,
);

v('l’assurer deux fois ne la remplace pas', await (async () => {
  const avant = r.carte.get(CLEF_PUBLIQUE);
  await assurerLaBoite(r, ancien);
  return r.carte.get(CLEF_PUBLIQUE) === avant;
})(), true);

/* ── 2. Déposer sans coffre, relever avec ──────────────────────────────── */
console.log('\nDéposer ne demande que la publique');

const publique = await publiqueDeLaBoite(r);
v('la publique se lit sans la clé du coffre', publique !== null, true);
const pli = await deposer(publique!, report);
const privee = await priveeDeLaBoite(r, ancien);
v('la privée se descelle avec la clé du coffre', privee !== null, true);
v('et le pli se relève', await relever(privee!, pli), report);

/* ── 3. Le mot de passe change ─────────────────────────────────────────── */
console.log('\nLe mot de passe change : rien ne se perd en silence');

v('la boîte est déclarée périmée, pas absente', await etatDeLaBoite(r, neuf), 'perimee');
v('la privée n’est plus descellable', await priveeDeLaBoite(r, neuf), null);
/*
   LE POINT CENTRAL : la boîte périmée n'est PAS remplacée d'office. Si
   `assurerLaBoite` renouvelait ici, le pli en attente deviendrait illisible
   pour toujours, et sans un mot.
*/
const publiqueAvant = r.carte.get(CLEF_PUBLIQUE);
v('assurer une boîte périmée ne la renouvelle pas', await assurerLaBoite(r, neuf), 'perimee');
v('la paire est intacte', r.carte.get(CLEF_PUBLIQUE), publiqueAvant);
v('le pli existe toujours, en attente', typeof pli.charge, 'string');
v(
  'et il reste relevable par l’ancienne clé, si on la retrouve',
  await relever((await priveeDeLaBoite(r, ancien))!, pli),
  report,
);

/* ── 4. Le renouvellement est explicite, et destructeur ────────────────── */
console.log('\nRenouveler est un geste nommé, jamais un effet de bord');

await renouvelerLaBoite(r, neuf);
v('la boîte redevient utilisable', await etatDeLaBoite(r, neuf), 'utilisable');
v('la publique a changé', r.carte.get(CLEF_PUBLIQUE) === publiqueAvant, false);
let perdu = false;
try {
  await relever((await priveeDeLaBoite(r, neuf))!, pli);
} catch {
  perdu = true;
}
v('et l’ancien pli est désormais illisible — c’est le prix, et il est dit', perdu, true);

/* ── 5. Oublier sur cet appareil ───────────────────────────────────────── */
console.log('\nOublier sur cet appareil efface la boîte');

await oublierLaBoite(r);
v('plus de privée', r.carte.has(CLEF_PRIVEE), false);
v('plus de publique', r.carte.has(CLEF_PUBLIQUE), false);
v('et l’état repart d’absente', await etatDeLaBoite(r, neuf), 'absente');

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
