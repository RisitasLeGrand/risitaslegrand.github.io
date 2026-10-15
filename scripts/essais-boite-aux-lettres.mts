/**
 * La boîte aux lettres : du vrai chiffrement, éprouvé pour de vrai.
 *
 *   npm run essais:boite-aux-lettres
 *
 * Node porte WebCrypto : ces contrôles exercent les MÊMES primitives que le
 * navigateur, pas une imitation. C'est rare dans ce dépôt et il faut en
 * profiter — un module de chiffrement contrôlé par des doublures ne prouve
 * que le bon fonctionnement des doublures.
 *
 * Les trois contrôles que le Pilote demande sont ici, nommés :
 *
 * - rien du pli n'est lisible sans la privée ;
 * - la privée ne traîne nulle part en clair — l'appelant la scelle, et ce
 *   module ne la stocke jamais ;
 * - un pli d'une paire révolue est REFUSÉ, bruyamment, jamais perdu en
 *   silence.
 */
import {
  PALIER_DE_REMBOURRAGE,
  VERSION_PLI,
  cleOpaque,
  deposer,
  engendrerLaPaire,
  exporterLaPrivee,
  importerLaPrivee,
  relever,
} from '../src/lib/noyau/boite-aux-lettres';

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
const leve = async (intitule: string, f: () => Promise<unknown>) => {
  try {
    await f();
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      aucune erreur levée`);
  } catch {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
  }
};

/* Un report tel que le lot l'écrirait : tout y est sensible. */
const report = {
  tacheId: '01JABCDEF0123456789ABCDEFG',
  jourPrevu: '2026-10-12',
  branche: 'psyche',
  le: '2026-10-12T08:05:00.000Z',
};

const paire = await engendrerLaPaire();

/* ── 1. L'aller-retour ─────────────────────────────────────────────────── */
console.log('\nDéposer sans clé, relever avec');

const pli = await deposer(paire.publique, report);
v('le pli porte sa version', pli.v, VERSION_PLI);

/* ── 2. Rien n'est lisible sans la privée ──────────────────────────────── */
/*
   CES CONTRÔLES VIENNENT AVANT L'ALLER-RETOUR, et c'est un sabotage qui l'a
   imposé. Placés après, ils ne s'exécutaient jamais quand le déchiffrement
   échouait : la suite mourait sur l'aller-retour et rendait « rouge », mais
   pour la mauvaise raison — elle n'avait pas vu la fuite, elle avait planté
   avant. Une fuite doit se constater sur le pli seul, sans rien déchiffrer.
*/
console.log('\nRien du pli n’est lisible sans la privée');

/*
   ON CHERCHE DANS LE PLI **ET DANS SES CHAMPS DÉCODÉS**, et c'est un second
   sabotage qui l'a imposé. Chercher seulement dans le JSON laissait passer
   une charge qui serait du base64 de texte clair : le base64 cachait les
   chaînes au contrôle sans rien cacher à personne d'autre. Un contrôle qui
   ne décode pas ne regarde pas.
*/
const decode = (b64: string) => {
  try {
    return Buffer.from(b64, 'base64').toString('binary');
  } catch {
    return '';
  }
};
const tout = JSON.stringify(pli) + decode(pli.charge) + decode(pli.epk) + decode(pli.iv);
for (const [quoi, aiguille] of [
  ['l’identifiant de la tâche', report.tacheId],
  ['le jour', report.jourPrevu],
  ['la branche', report.branche],
  ['l’instant', report.le],
  ['le nom du champ « branche »', 'branche'],
] as const) {
  v(`${quoi} n’apparaît nulle part dans le pli, même décodé`, tout.includes(aiguille), false);
}

const autre = await engendrerLaPaire();
await leve('une autre privée ne relève rien', () => relever(autre.privee, pli));
await leve(
  'un pli dont la charge est modifiée est refusé (AES-GCM authentifie)',
  () => relever(paire.privee, { ...pli, charge: pli.charge.slice(0, -4) + 'AAAA' }),
);
await leve(
  'un pli d’une version inconnue est refusé, jamais deviné',
  () => relever(paire.privee, { ...pli, v: 99 }),
);

/* L'aller-retour vient donc ici, une fois la fuite écartée. */
v('ce qui est relevé est ce qui a été déposé', await relever(paire.privee, pli), report);

/* ── 3. La taille ne trahit rien ───────────────────────────────────────── */
console.log('\nLa longueur du contenu ne se lit pas dans celle du pli');

const court = await deposer(paire.publique, { a: 1 });
const long = await deposer(paire.publique, { ...report, note: 'x'.repeat(100) });
v('un petit et un gros report font des plis de même taille', court.charge.length, long.charge.length);
v(
  'et le rembourrage est bien au palier annoncé',
  (court.charge.length * 3) / 4 >= PALIER_DE_REMBOURRAGE,
  true,
);

/* Au-delà du palier, la taille change — c'est attendu, et il faut le dire. */
const tresLong = await deposer(paire.publique, { note: 'x'.repeat(PALIER_DE_REMBOURRAGE * 2) });
v(
  'au-delà d’un palier, la taille augmente — le rembourrage borne, il n’efface pas',
  tresLong.charge.length > court.charge.length,
  true,
);

/* ── 4. Deux dépôts du même objet diffèrent ────────────────────────────── */
console.log('\nDeux dépôts identiques ne se ressemblent pas');

const a = await deposer(paire.publique, report);
const b = await deposer(paire.publique, report);
v('les charges diffèrent', a.charge === b.charge, false);
v('les clés éphémères diffèrent', a.epk === b.epk, false);
v('les vecteurs d’initialisation diffèrent', a.iv === b.iv, false);
v('et les deux se relèvent pareil', await relever(paire.privee, b), report);

/* ── 5. La privée voyage scellée, jamais en clair ──────────────────────── */
console.log('\nLa privée n’existe en clair nulle part');

const exportee = await exporterLaPrivee(paire.privee);
v('elle s’exporte, pour que l’appelant la scelle', typeof exportee, 'string');
v('et se réimporte à l’identique', await relever(await importerLaPrivee(exportee), pli), report);
/*
   Ce module ne garde RIEN. Le contrôle est structurel : il n'expose aucune
   fonction de stockage, donc il n'a aucun endroit où oublier une clé. Le
   scellement de la privée appartient à l'appelant, et c'est `essais:coffre`
   qui le couvrira.
*/
v(
  'le module n’expose aucune fonction de stockage',
  Object.keys(await import('../src/lib/noyau/boite-aux-lettres')).filter((k) =>
    /stocker|enregistrer|garder|memoire/i.test(k),
  ),
  [],
);

/* ── 6. La clé de rangement ne dit rien ────────────────────────────────── */
console.log('\nLa clé de rangement est opaque');

const cles = Array.from({ length: 50 }, () => cleOpaque());
v('cinquante clés, cinquante valeurs distinctes', new Set(cles).size, 50);
v('aucune ne contient le jour', cles.some((c) => c.includes('2026')), false);
v(
  'et aucune n’est utilisable comme chemin (ni barre, ni plus, ni égal)',
  cles.some((c) => /[+/=]/.test(c)),
  false,
);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
