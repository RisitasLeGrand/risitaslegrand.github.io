/**
 * H4 — LA GARDE : AUCUN ÉMOJI DANS L'INTERFACE.
 *
 * ## Pourquoi une garde, et pas seulement un nettoyage
 *
 * Quatre-vingt-sept émojis ont été remplacés par des icônes du catalogue. Rien
 * n'empêche le quatre-vingt-huitième : un émoji s'écrit d'un caractère, il
 * s'affiche partout, et il a l'air de marcher. C'est précisément ce qui le rend
 * tenace — personne ne le refuse à la relecture, parce que rien ne paraît
 * cassé.
 *
 * Ce qui est cassé ne se voit pas à l'écran de celui qui écrit. Le même émoji
 * est un dessin différent sur chaque plateforme ; il ignore les quatorze thèmes
 * et garde ses couleurs sur un fond sombre ; il disparaît en mode « couleurs
 * imposées » du système, où il n'a pas de trait à suivre ; et il s'annonce à
 * voix haute — « 🗂️ » se lit « classeur », avant le libellé, à chaque passage.
 *
 * ## Ce que la garde refuse, et ce qu'elle laisse passer
 *
 * Elle refuse les ÉMOJIS, dans les plages demandées par le Pilote. Elle laisse
 * passer les MARQUES : une coche, une croix, un rond, un losange, un triangle,
 * une flèche. La différence n'est pas une affaire de goût. Une marque est un
 * signe de texte : elle suit la couleur et la taille du texte, elle reste
 * lisible en couleurs imposées, et les écrans qui s'en servent le font en
 * série — « ✓ boucle, ✗ écart, △ invérifiable » — là où un dessin parmi deux
 * signes casserait la série.
 *
 * ## Les exemptions, par fichier et jamais par caractère
 *
 * Exempter un CARACTÈRE ouvrirait la porte à son retour n'importe où. Les
 * exemptions nomment donc un fichier, et disent pourquoi. Deux familles :
 *
 *   - le CONTENU DE RÉCOMPENSE — les badges, les emblèmes de parcours, le
 *     thème du repos : ce sont des images que la personne gagne ou choisit,
 *     pas des commandes qu'elle actionne ;
 *   - les ÉNONCÉS D'ÉPREUVE — le haut-parleur d'un stimulus sonore, les
 *     symboles d'un raisonnement relationnel : l'épreuve porte sur eux, les
 *     remplacer changerait ce qui est mesuré.
 *
 * Une exemption peut porter un MOTIF, et alors elle ne couvre que les lignes
 * qui le contiennent. Le cadenas de la grille des succès est dans ce cas :
 * exempter la page entière — mille lignes — pour un cadenas serait un trou.
 *
 * ## Le périmètre
 *
 * `src/` seulement. Pas `content/`, où les fiches sont du contenu rédigé et où
 * la décision ne s'applique pas. Pas `scripts/` non plus : ses émojis sont dans
 * des messages de terminal et des commentaires, lus par qui construit le site
 * et jamais par qui le révise. La garde porte sur ce qui s'affiche.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
   LES PLAGES, telles que le Pilote les a fixées.

   1F300–1FAFF couvre les émojis de symboles, d'objets, de nature, de nourriture
   et de transport, avec les ajouts récents. 2600–26FF couvre les symboles
   divers — météo, religion, jeux, avertissement.

   Elles ne couvrent pas tout ce qu'Unicode colorie, et c'est assumé : une
   plage large attraperait les marques de texte qu'on veut garder, et une liste
   de caractères interdits serait à rallonger à chaque émoji inventé.
*/
const PLAGES = [
  [0x1f300, 0x1faff],
  [0x2600, 0x26ff],
];

/*
   LES MARQUES TOLÉRÉES DANS LES PLAGES.

   Deux seulement, et ce sont des cases à cocher : le n-back les emploie pour
   dire quelles dimensions sont actives, en série avec son libellé. Elles sont
   de la même famille que les marques ci-dessous, qui tombent hors des plages
   par construction et n'ont donc pas à être tolérées nommément. On les énumère
   quand même dans le message de refus : qui le lit cherche à savoir ce qui est
   permis, pas seulement ce qui est interdit.
*/
const MARQUES_TOLEREES = new Set(['☑', '☐']);

/**
 * Les marques hors plages, données dans le message pour information.
 *
 * L'étoile n'y est PAS, et c'est l'essai du point 2 qui me l'a appris : elle
 * est à U+2605, donc DANS la seconde plage. Elle ne passe donc pas par sa
 * nature de marque mais par l'exemption nommée du moteur de raisonnement
 * relationnel, où elle est un symbole d'énoncé. La différence compte : écrite
 * ailleurs, elle serait refusée, et c'est le bon comportement — « ★ » employé
 * comme décoration est un émoji sur la plupart des plateformes.
 */
const MARQUES_HORS_PLAGES = ['✓', '✗', '✕', '●', '○', '◆', '▣', '△', '▲', '■'];
const FLECHES = ['→', '←', '↔', '⇢', '↑', '↓', '↻', '↺'];

/**
 * LES EXEMPTIONS. Un fichier, une raison, et au besoin un motif.
 *
 * La raison n'est pas de la décoration : c'est elle qui permet de rouvrir la
 * question plus tard. Une liste de chemins sans raisons devient une liste
 * qu'on allonge.
 */
const EXEMPTIONS = [
  {
    fichier: 'src/lib/gamification.ts',
    pourquoi:
      'les pictogrammes des badges — du contenu de récompense, que la personne gagne',
  },
  {
    fichier: 'src/lib/parcours/registre.ts',
    pourquoi: 'les emblèmes des parcours et de leurs thèmes — du contenu, choisi et non actionné',
  },
  {
    fichier: 'src/lib/rotation.ts',
    pourquoi:
      'le thème « repos », qui s’affiche dans la même liste que ceux du registre : ' +
      'un dessin au trait parmi eux se lirait comme une erreur',
  },
  {
    fichier: 'src/features/veridical-mapping/composants/Stimulus.svelte',
    pourquoi: 'le haut-parleur du stimulus sonore — l’épreuve porte sur lui',
  },
  {
    fichier: 'src/features/relational-reasoning/moteurs/induction/inferer-relation.ts',
    pourquoi: 'les symboles des énoncés de raisonnement relationnel — l’épreuve porte sur eux',
  },
  {
    fichier: 'src/pages/revisions/index.astro',
    motif: 'badge.icone',
    pourquoi:
      'le cadenas du succès non obtenu, dans la grille des badges seulement : ' +
      'les vingt-huit badges sont en émoji, et un cadenas au trait parmi eux se ' +
      'lirait comme une erreur d’affichage (décision du Pilote)',
  },
];

const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const jaune = (t) => `\x1b[33m${t}\x1b[0m`;
const gras = (t) => `\x1b[1m${t}\x1b[0m`;

let echecs = 0;
function verifier(quoi, vrai, detail = '') {
  if (vrai) console.log(`  ${vert('✓')} ${quoi}`);
  else {
    echecs += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Le caractère est-il dans les plages gardées ? */
function estDansLesPlages(caractere) {
  const point = caractere.codePointAt(0);
  return PLAGES.some(([bas, haut]) => point >= bas && point <= haut);
}

/**
 * Les pictogrammes gardés d'un texte, avec leur ligne.
 *
 * Le parcours se fait par POINT DE CODE et non par unité de 16 bits : les
 * émojis de la première plage s'écrivent sur deux unités, et un parcours
 * caractère par caractère en découperait la moitié — on compterait des
 * substituts isolés au lieu d'émojis. `[...texte]` itère par point de code.
 */
function pictogrammesDe(texte) {
  const trouves = [];
  texte.split('\n').forEach((ligne, i) => {
    for (const c of [...ligne]) {
      if (!estDansLesPlages(c)) continue;
      if (MARQUES_TOLEREES.has(c)) continue;
      trouves.push({ ligne: i + 1, caractere: c, texte: ligne.trim() });
    }
  });
  return trouves;
}

function fichiers(racine) {
  const sortie = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(ts|tsx|astro|svelte|css|js|mjs|mts)$/.test(entree)) sortie.push(chemin);
  }
  return sortie.sort();
}

/* ── 1. La garde sur les sources ──────────────────────────────────────── */

console.log(`\n${gras('1. AUCUN ÉMOJI DANS « src/ »')}\n`);

const parFichier = new Map(EXEMPTIONS.map((e) => [e.fichier, e]));
const exemptionsUtiles = new Set();
const fautes = [];

for (const chemin of fichiers('src')) {
  const texte = readFileSync(chemin, 'utf8');
  const trouves = pictogrammesDe(texte);
  if (trouves.length === 0) continue;

  const exemption = parFichier.get(chemin);
  for (const t of trouves) {
    /*
       Une exemption à motif ne couvre QUE les lignes qui le portent. Sans
       cette restriction, exempter une page de mille lignes pour un cadenas
       laisserait entrer n'importe quoi dans les neuf cent quatre-vingt-dix-neuf
       autres.
    */
    const couvert =
      exemption && (!exemption.motif || t.texte.includes(exemption.motif));
    if (couvert) {
      exemptionsUtiles.add(chemin);
      continue;
    }
    fautes.push(`${chemin}:${t.ligne} — « ${t.caractere} » dans : ${t.texte.slice(0, 70)}`);
  }
}

if (fautes.length > 0) {
  console.log(`  ${rouge('✗')} ${fautes.length} émoji(s) hors exemption :`);
  for (const f of fautes.slice(0, 20)) console.log(`      ${f}`);
  if (fautes.length > 20) console.log(`      … et ${fautes.length - 20} autres.`);
  console.log('');
  console.log('  Posez une icône du catalogue, par le composant « Icone » :');
  console.log('      <Icone nom="alerte" taille={16} />');
  console.log('  Depuis un script qui fabrique ses lignes, par un modèle du gabarit :');
  console.log('      <template id="gabarit-alerte"><Icone nom="alerte" taille={16} /></template>');
  console.log('      iconeDuGabarit(\'gabarit-alerte\')');
  console.log('');
  console.log(`  ${gras('CE QUI RESTE PERMIS')} — les marques, qui suivent la couleur du texte :`);
  console.log(`      dans les plages gardées : ${[...MARQUES_TOLEREES].join(' ')}`);
  console.log(`      hors des plages : ${MARQUES_HORS_PLAGES.join(' ')}`);
  console.log('      « ★ » est dans la seconde plage : elle ne passe que par une exemption nommée.');
  console.log(`      les flèches : ${FLECHES.join(' ')}`);
  console.log('');
  console.log(`  ${gras('LES FICHIERS EXEMPTÉS')}, et pourquoi :`);
  for (const e of EXEMPTIONS) {
    console.log(`      ${e.fichier}${e.motif ? ` (lignes portant « ${e.motif} »)` : ''}`);
    console.log(`          ${e.pourquoi}`);
  }
  console.log('');
  echecs += 1;
} else {
  console.log(`  ${vert('✓')} aucun émoji hors exemption dans « src/ »`);
}

/*
   UNE EXEMPTION QUI NE SERT PLUS EST UNE DETTE. Le pictogramme a disparu, la
   ligne reste, et la prochaine personne croit que ce fichier a le droit d'en
   porter. C'est le même raisonnement que les exceptions de
   « essais:couleurs-jetons », qui exige aussi que chacune serve.
*/
const inutiles = EXEMPTIONS.filter((e) => !exemptionsUtiles.has(e.fichier)).map((e) => e.fichier);
verifier(
  `les ${EXEMPTIONS.length} exemptions servent toutes`,
  inutiles.length === 0,
  `sans objet : ${inutiles.join(', ')} — retirez-les`,
);

/* ── 2. Ce que la garde doit laisser passer ───────────────────────────── */

console.log(`\n${gras('2. LES MARQUES ET LES FLÈCHES PASSENT')}\n`);

/*
   LE CONTRÔLE QUI EMPÊCHE LA GARDE DE TROP PRENDRE.

   Sans lui, élargir les plages « pour attraper un émoji de plus » emporterait
   les marqueurs de correction et les flèches, et casserait les séries de
   verdicts de trois écrans. L'essai le dirait alors tout de suite, au lieu de
   le laisser découvrir à l'écran.
*/
for (const marque of MARQUES_HORS_PLAGES) {
  verifier(
    `« ${marque} » passe`,
    pictogrammesDe(`const m = '${marque}';`).length === 0,
  );
}
for (const fleche of FLECHES) {
  verifier(`« ${fleche} » passe`, pictogrammesDe(`libelle = 'Suivant ${fleche}';`).length === 0);
}
for (const marque of MARQUES_TOLEREES) {
  verifier(
    `« ${marque} » passe, tolérée dans les plages`,
    pictogrammesDe(`{actif ? '${marque}' : ''}`).length === 0,
  );
}

/* ── 3. Ce que la garde doit prendre ──────────────────────────────────── */

console.log(`\n${gras('3. ET LES ÉMOJIS, EUX, SONT PRIS')}\n`);

/*
   LE TÉMOIN INVERSE, et il vaut autant que le reste. Une garde dont la
   détection serait cassée — une plage mal écrite, un parcours par unité de
   16 bits au lieu du point de code — passerait au vert en ne voyant plus rien.
   On lui soumet donc des émojis qu'elle DOIT refuser, un par plage.
*/
const DOIVENT_ETRE_PRIS = [
  ['🎉', 'la première plage, sur deux unités de 16 bits'],
  ['🔒', 'la première plage'],
  ['⚠', 'la seconde plage'],
  ['☎', 'la seconde plage'],
  ['★', 'la seconde plage, bien qu’elle ressemble à une marque'],
];
for (const [emoji, quoi] of DOIVENT_ETRE_PRIS) {
  const pris = pictogrammesDe(`texte = '${emoji} Bonjour';`);
  verifier(
    `« ${emoji} » est pris (${quoi})`,
    pris.length === 1 && pris[0].caractere === emoji,
    `${pris.length} prise(s) : ${pris.map((p) => p.caractere).join('')}`,
  );
}

/* Et le parcours par point de code, démontré sur un émoji hors du plan de base. */
verifier(
  'un émoji de quatre octets est compté une fois, et non deux',
  pictogrammesDe("const x = '🧩';").length === 1,
);

console.log(
  echecs ? `\n${rouge(`${echecs} essai(s) en échec.`)}\n` : `\n${vert('Tous les essais passent.')}\n`,
);
console.log(
  jaune(
    'Rappel : la garde porte sur « src/ ». « content/ » est du contenu rédigé, et\n' +
      '« scripts/ » ne parle qu’au terminal de qui construit le site.\n',
  ),
);
process.exit(echecs ? 1 : 0);
