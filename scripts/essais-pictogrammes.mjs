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
   LES PLAGES, et le trou qu'elles avaient.

   Les deux premières sont celles du Pilote au premier jour : 1F300–1FAFF, les
   émojis de symboles, d'objets, de nature, de nourriture et de transport ;
   2600–26FF, les symboles divers — météo, religion, jeux, avertissement.

   ELLES LAISSAIENT PASSER NEUF ÉMOJIS, que j'ai trouvés en convertissant les
   écrans : le joker 🃏 (1F0CF) du bouton « Réviser », le triangle de lecture ▶
   (25B6) du lecteur audio, la coche verte ✅ (2705), le « i » cerclé ⓘ (24D8),
   les flèches montante et descendante ⬆ ⬇ (2B06/2B07) de la bulle de niveau,
   la pause ⏸ (23F8), le sablier ⌛ (231B) et le chronomètre ⏱ (23F1). Tous
   coloriés par les plateformes, tous hors des plages.

   Les quatre plages ajoutées les couvrent : 1F000–1F0FF (cartes, dominos,
   mah-jong), 231A–23FA (montres, sabliers, commandes de lecture),
   2B05–2B07 et 2B1B–2B1C.

   ON NE PREND PAS LE BLOC 2700–27BF EN ENTIER, et c'est une décision du
   Pilote que la mesure confirme : ✓ (2713) et ✗ (2717) y vivent, et trois
   écrans s'en servent en série de verdicts. Les émojis de ce bloc sont donc
   nommés un par un, juste en dessous.
*/
const PLAGES = [
  [0x1f300, 0x1faff],
  [0x2600, 0x26ff],
  [0x1f000, 0x1f0ff],
  [0x231a, 0x23fa],
  [0x2b05, 0x2b07],
  [0x2b1b, 0x2b1c],
];

/**
 * Les émojis nommés un par un, là où une plage emporterait des marques.
 *
 * Dingbats (2700–27BF) et symboles divers : la coche verte, les étincelles, la
 * croix et la coche épaisses, les points d'interrogation et d'exclamation
 * coloriés, les plus et moins épais, l'étoile et le rond.
 */
const POINTS_GARDES = new Set([
  0x2705, 0x2728, 0x274c, 0x274e, 0x2753, 0x2754, 0x2755, 0x2757,
  0x2795, 0x2796, 0x2797, 0x27b0, 0x27bf, 0x2b50, 0x2b55,
]);

/**
 * LE SÉLECTEUR DE PRÉSENTATION ÉMOJI, REFUSÉ PARTOUT.
 *
 * C'est la décision du Pilote, et elle vaut mieux que ce que je proposais.
 *
 * J'avais buté sur deux caractères convertis que les plages ne prenaient pas :
 * le triangle de lecture ▶ (25B6) et le « i » cerclé ⓘ (24D8). Les prendre par
 * une plage aurait emporté ● ○ ◆ ▣ △ ▲ ■ — les marques tolérées, employées en
 * série par trois écrans. Les nommer un par un aurait fait d'eux des cas
 * particuliers sans qu'on puisse dire pourquoi eux et non ▲. Je les avais donc
 * signalés et laissés passer.
 *
 * La bonne question n'était pas « lesquels », mais « à quoi tient la
 * différence ». Ces caractères ont une présentation TEXTE par défaut ; ce qui
 * en fait des émojis coloriés, c'est le sélecteur U+FE0F qui les suit. « ▶ »
 * est une forme géométrique, « ▶️ » est un bouton de lecture.
 *
 * Refuser U+FE0F ferme donc le trou pour la série entière — formes
 * géométriques, lettres encerclées, et tout ce qui viendra — sans toucher à
 * une seule marque. Et il n'y en a aujourd'hui aucun hors des fichiers
 * exemptés : la règle ne coûte rien et tient l'avenir.
 */
const SELECTEUR_EMOJI = 0xfe0f;

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
    fichier: 'src/features/quad-n-back/composants/QuadNBack.svelte',
    pourquoi:
      'le sablier du verdict « oubli », en série avec ✓ et ✗ : trois marques de ' +
      'même rang, dont une seule est tombée dans les plages élargies. La ' +
      'dessiner seule casserait la série, comme pour le relevé bancaire',
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

/** Le caractère est-il gardé — par une plage, nommément, ou comme sélecteur ? */
function estDansLesPlages(caractere) {
  const point = caractere.codePointAt(0);
  if (point === SELECTEUR_EMOJI) return true;
  return POINTS_GARDES.has(point) || PLAGES.some(([bas, haut]) => point >= bas && point <= haut);
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
    /*
       LE SÉLECTEUR EST INVISIBLE, donc il se nomme au lieu de s'afficher. La
       première version imprimait « « » dans : ▶️ » — un caractère vide entre
       des guillemets, qui n'apprenait rien à qui lisait le refus.
    */
    const dit =
      t.caractere.codePointAt(0) === SELECTEUR_EMOJI
        ? 'le sélecteur de présentation émoji U+FE0F'
        : `« ${t.caractere} »`;
    fautes.push(`${chemin}:${t.ligne} — ${dit} dans : ${t.texte.slice(0, 70)}`);
  }
}

if (fautes.length > 0) {
  console.log(
    `  ${rouge('✗')} ${fautes.length} ${fautes.length > 1 ? 'émojis' : 'émoji'} hors exemption :`,
  );
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
  console.log('');
  console.log(`  ${gras('ET LE SÉLECTEUR U+FE0F EST REFUSÉ PARTOUT')} : « ▶ » passe, « ▶️ » non.`);
  console.log('      C’est lui qui fait d’une forme de texte un émoji colorié. Si une icône');
  console.log('      vous manque, elle est au catalogue ou elle s’y ajoute — pas dans un');
  console.log('      caractère suivi d’un sélecteur.');
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
  ['🎉', '1F300–1FAFF, sur deux unités de 16 bits'],
  ['🔒', '1F300–1FAFF'],
  ['⚠', '2600–26FF'],
  ['☎', '2600–26FF'],
  ['★', '2600–26FF, bien qu’elle ressemble à une marque'],
  /* Les neuf que les plages d'origine laissaient passer, et qui sont le
     motif de l'élargissement. */
  ['🃏', '1F000–1F0FF, le joker'],
  ['⌛', '231A–23FA, le sablier'],
  ['⏱', '231A–23FA, le chronomètre'],
  ['⏸', '231A–23FA, la pause'],
  ['⬆', '2B05–2B07'],
  ['⬇', '2B05–2B07'],
  ['⬛', '2B1B–2B1C'],
  ['✅', 'nommée, hors du bloc des Dingbats pris en entier'],
  ['✨', 'nommée'],
  ['❌', 'nommée'],
  ['❓', 'nommée'],
  ['❗', 'nommée'],
  ['⭐', 'nommée'],
];

/*
   ET CEUX QUE LA GARDE NE PREND PAS, délibérément. Les énumérer ici fait que
   le jour où quelqu'un élargit une plage « pour en attraper un de plus », cet
   essai dira lesquels il vient d'emporter avec.
*/
const DOIVENT_PASSER_MALGRE_TOUT = [
  ['▶', '25B6 SEUL : une forme géométrique, à présentation texte'],
  ['ⓘ', '24D8 seul : une lettre encerclée, à présentation texte'],
];

/*
   ET LES MÊMES, SUIVIS DU SÉLECTEUR, DOIVENT ÊTRE PRIS. C'est le contrôle qui
   donne son sens au précédent : ce n'est pas le caractère qui est toléré, c'est
   sa présentation texte. Suivi de U+FE0F, il devient un émoji et il est refusé.
*/
const AVEC_SELECTEUR = ['▶\ufe0f', 'ⓘ\ufe0f', '✂\ufe0f'];
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

for (const [c, quoi] of DOIVENT_PASSER_MALGRE_TOUT) {
  verifier(
    `« ${c} » passe, et c’est voulu (${quoi})`,
    pictogrammesDe(`const x = '${c}';`).length === 0,
  );
}
for (const c of AVEC_SELECTEUR) {
  const nu = c.replace('\ufe0f', '');
  verifier(
    `« ${nu} » suivi du sélecteur est pris`,
    pictogrammesDe(`const x = '${c}';`).length > 0,
  );
}

console.log(
  echecs ? `\n${rouge(`${echecs} ${echecs > 1 ? 'essais' : 'essai'} en échec.`)}\n` : `\n${vert('Tous les essais passent.')}\n`,
);
console.log(
  jaune(
    'Rappel : la garde porte sur « src/ ». « content/ » est du contenu rédigé, et\n' +
      '« scripts/ » ne parle qu’au terminal de qui construit le site.\n',
  ),
);
process.exit(echecs ? 1 : 0);
