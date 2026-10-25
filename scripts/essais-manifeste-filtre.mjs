/**
 * QUI VOIT LE CORPUS ENTIER, ET QUI NE VOIT QUE SON PARCOURS.
 *
 *   npm run essais:manifeste-filtre
 *
 * ## La règle, et pourquoi elle a besoin d'une garde
 *
 * Le pilote l'a fixée ainsi, sous délégation d'Alexis :
 *
 *     ce qui PROPOSE est filtré par le parcours ;
 *     ce qui RACONTE ou CONSERVE voit tout.
 *
 * Deux agents ont résolu le même problème le même jour, à deux endroits
 * opposés, chacun avec un raisonnement écrit contre celui de l'autre. B a posé
 * le filtre dans « chargerManifeste », pour tout le site ; C dans
 * « fichesDuTheme », pour la seule séance. L'argument de B a emporté le
 * placement : « un filtre posé écran par écran aurait été oublié par le
 * quinzième ».
 *
 * Mais l'argument de C reste vrai de l'autre côté : un écran qui RACONTE et
 * qui prendrait le manifeste filtré mentirait sans rien casser. Il
 * annoncerait à Alexis, posé sur DGFiP-A, qu'il n'a jamais révisé les fiches
 * de l'INSP qu'il a révisées. Aucun essai ne le dirait, puisque rien ne
 * planterait.
 *
 * C'EST DONC LE QUINZIÈME ÉCRAN QUE CETTE GARDE ATTEND. Chaque appelant est
 * classé ici, à la main et avec sa raison. Un appelant NON CLASSÉ fait rougir :
 * on ne peut plus en ajouter un sans dire de quel côté il tombe.
 *
 * ## Ce qu'elle ne fait pas
 *
 * Elle ne juge pas le classement — c'est une décision de produit, prise par
 * Alexis. Elle tient que le classement EXISTE, qu'il est respecté, et qu'il
 * est écrit là où on le cherchera.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const racine = path.resolve(import.meta.dirname, '..');
const vert = (t) => `\u001b[32m${t}\u001b[0m`;
const rouge = (t) => `\u001b[31m${t}\u001b[0m`;
const jaune = (t) => `\u001b[33m${t}\u001b[0m`;

let echecs = 0;
function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    echecs += 1;
    console.log(
      `  ${rouge('✗')} ${quoi}\n      attendu : ${JSON.stringify(attendu)}` +
        `\n      obtenu  : ${JSON.stringify(obtenu)}`,
    );
  }
}

/**
 * LE CLASSEMENT, et la raison de chaque ligne.
 *
 * « filtre » : l'écran PROPOSE quelque chose à faire maintenant. Montrer une
 * fiche d'un concours qu'Alexis ne passe pas serait lui faire perdre son
 * temps.
 *
 * « complet » : l'écran RACONTE ce qui a été fait, ou CONSERVE. Cacher une
 * fiche déjà révisée y serait un mensonge.
 */
const CLASSEMENT = {
  /* ── Ce qui propose ──────────────────────────────────────────────────── */
  'src/lib/niveau.ts': ['filtre', 'l’estimation de niveau est celle du parcours ouvert'],
  /*
     LES DEUX, ET C'EST LE SEUL. « construireVue » sert quatre écrans dont
     trois proposent et un raconte : sa PORTÉE est donc un paramètre, dont le
     défaut est le parcours. Un fichier classé « deux » doit porter les deux
     appels — s'il n'en porte plus qu'un, la ligne ci-dessous est à revoir.
  */
  'src/lib/agregats.ts': ['deux', 'construireVue(portee) : « parcours » pour qui propose, « tout » pour qui raconte'],
  'src/pages/planification/seance.astro': ['filtre', 'la séance'],
  'src/pages/revisions/index.astro': ['filtre', 'les révisions dues'],
  'src/pages/quiz/index.astro': ['filtre', 'le quiz propose un tirage'],
  'src/pages/quiz/cours.astro': ['filtre', 'le quiz du cours propose un tirage'],
  'src/pages/quiz/dgfip.astro': ['filtre', 'l’épreuve blanche ne tire que ce que le parcours sert'],
  'src/pages/flashcards.astro': ['filtre', 'les flashcards proposent'],
  'src/pages/positionnement.astro': ['filtre', 'le positionnement propose'],
  'src/pages/fiche.astro': ['filtre', 'la fiche ouverte appartient au parcours courant'],
  'src/pages/actualites.astro': ['filtre', 'les actualités renvoient vers ce qu’on peut réviser'],

  /* ── Ce qui raconte ou conserve ──────────────────────────────────────── */
  'src/lib/indicateurs.ts': [
    'complet',
    'la fenêtre des synthèses porte cinq ans d’historique : la cacher par parcours réécrirait le passé',
  ],
  'src/pages/statistiques.astro': [
    'complet',
    'les statistiques de progression racontent ce qui a été révisé, tous parcours confondus',
  ],
};

/* Le module qui DÉFINIT les deux entrées n'est pas un appelant. */
const DEFINIT = new Set(['src/lib/contenu.ts', 'src/lib/parcours/filtre-du-manifeste.ts']);

function fichiersDe(dossier) {
  const out = [];
  for (const e of readdirSync(dossier)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = path.join(dossier, e);
    if (statSync(p).isDirectory()) out.push(...fichiersDe(p));
    else if (/\.(ts|mts|js|mjs|astro|svelte)$/.test(e)) out.push(p);
  }
  return out;
}

const APPEL_FILTRE = /\bchargerManifeste\s*\(/;
const APPEL_COMPLET = /\bchargerManifesteComplet\s*\(/;

const appelants = new Map();
for (const abs of fichiersDe(path.join(racine, 'src'))) {
  const rel = path.relative(racine, abs);
  if (DEFINIT.has(rel)) continue;
  const texte = readFileSync(abs, 'utf8');
  const complet = APPEL_COMPLET.test(texte);
  /*
     « chargerManifesteComplet( » contient « chargerManifeste » : on retire
     d'abord les appels complets, sinon tout appelant du complet passerait
     aussi pour un appelant du filtré. C'est le genre de recouvrement qui fait
     qu'un balayage dit n'importe quoi en silence.
  */
  const filtre = APPEL_FILTRE.test(texte.replace(/chargerManifesteComplet\s*\(/g, 'X('));
  if (complet || filtre) appelants.set(rel, { complet, filtre });
}

console.log('\nCHAQUE APPELANT DU MANIFESTE EST CLASSÉ');
console.log(`      ${appelants.size} appelants trouvés`);

verifier(
  'il y a des appelants à classer, sinon ce balayage ne prouverait rien',
  appelants.size > 5,
  true,
);

const nonClasses = [...appelants.keys()].filter((f) => !(f in CLASSEMENT)).sort();
verifier('aucun appelant hors du classement', nonClasses, []);
for (const f of nonClasses) {
  console.log(
    `        ${f} — dites dans « scripts/essais-manifeste-filtre.mjs » s’il PROPOSE\n` +
      '          (filtre) ou s’il RACONTE / CONSERVE (complet), et pourquoi.',
  );
}

const disparus = Object.keys(CLASSEMENT).filter((f) => !appelants.has(f)).sort();
verifier('aucune ligne de classement ne vise un fichier qui n’appelle plus', disparus, []);

console.log('\nET CHACUN PREND L’ENTRÉE QUE SON CLASSEMENT DIT');

const fautes = [];
for (const [f, { complet, filtre }] of appelants) {
  const attendu = CLASSEMENT[f]?.[0];
  if (!attendu) continue;
  if (attendu === 'filtre' && complet) fautes.push(`${f} : classé « filtre » mais prend le COMPLET`);
  if (attendu === 'complet' && filtre) fautes.push(`${f} : classé « complet » mais prend le FILTRÉ`);
  if (attendu === 'deux' && !(complet && filtre)) {
    fautes.push(`${f} : classé « deux » mais ne porte ${complet ? 'que le COMPLET' : 'que le FILTRÉ'}`);
  }
}
verifier('aucun écart entre le classement et l’appel', fautes.sort(), []);

console.log('\nLES SABOTAGES, parce qu’un balayage qui ne trouve rien ne prouve rien');
verifier(
  'sabotage : « chargerManifesteComplet » n’est pas compté comme un appel filtré',
  APPEL_FILTRE.test('const m = await chargerManifesteComplet();'.replace(/chargerManifesteComplet\s*\(/g, 'X(')),
  false,
);
verifier(
  'sabotage : un appel filtré est bien vu',
  APPEL_FILTRE.test('const m = await chargerManifeste();'.replace(/chargerManifesteComplet\s*\(/g, 'X(')),
  true,
);
verifier(
  'sabotage : une MENTION en commentaire n’est pas un appel',
  APPEL_FILTRE.test(' * par `chargerManifeste`, qui filtre.'),
  false,
);

console.log(
  echecs === 0
    ? `\n${vert('✓')} les ${appelants.size} appelants sont classés, et chacun prend son entrée.\n`
    : `\n${rouge('✗')} ${echecs} ${echecs === 1 ? 'contrôle' : 'contrôles'} en échec.\n`,
);
if (echecs === 0 && appelants.size !== Object.keys(CLASSEMENT).length) {
  console.log(jaune('  ⚠ le classement et les appelants ne comptent pas pareil.'));
}
process.exit(echecs > 0 ? 1 : 0);
