/**
 * LE LOGOTYPE TIENT SON CONTRASTE DANS TOUS LES THÈMES (prompt 65).
 *
 *   npm run essais:logotype
 *
 * ## Ce qui est gardé, et pourquoi au moteur plutôt qu'au navigateur
 *
 * Le logotype porte le nom de l'application, et il le porte SEUL : il n'y a
 * aucun autre texte à côté de lui sur le voile. WCAG 1.4.3 demande donc 4,5:1,
 * et non le 3:1 d'un élément non textuel — ce n'est pas un ornement, c'est le
 * nom.
 *
 * Les couleurs viennent de trois jetons, et les quatorze thèmes les
 * redéfinissent. Un thème ajouté demain pourrait donc faire passer le
 * logotype sous le seuil sans que personne touche au logotype. C'est
 * exactement ce qu'une garde doit attraper, et elle se mesure sur les
 * couleurs déclarées — en millisecondes, sans bâtisse ni navigateur, pour les
 * 25 combinaisons d'un coup.
 *
 * `essais:contrastes-themes` garde les rôles généraux ; celui-ci garde le
 * triplet précis que le logotype emploie, et dira lequel a cédé.
 */
import { contraste } from './lib/couleurs.mjs';
import { THEMES } from '../src/lib/themes';
import { svgLogotype } from '../src/lib/logotype';

/**
 * Les jetons employés par `Logotype.astro`, et par quoi.
 *
 * Écrits ici en clair plutôt qu'extraits du composant : un essai qui lirait le
 * composant pour savoir quoi mesurer resterait vert si le composant changeait
 * de jeton pour un jeton plus faible. La liste est un CONTRAT, et la faire
 * dépendre de ce qu'elle garde la viderait.
 */
const JETONS = [
  { role: 'texte', pour: 'le mot lui-même', seuil: 4.5 },
  { role: 'texteFaible', pour: 'les îles, Délos comprise', seuil: 4.5 },
] as const;

/*
   `action` N'EST PLUS DANS LA LISTE, et il faut dire pourquoi pour que personne
   ne lise un jeton retiré parce qu'il échouait.

   Délos y était, pour se distinguer des autres îles. Cette garde a rougi sur
   « republique/clair », où l'action vaut 13,79:1 contre 10,53:1 pour le texte :
   le clin d'œil y dominait le nom. Ce n'est pas le SEUIL qui était en cause —
   13,79 le passe largement — mais le contrôle qui suit, celui du rang. Le
   dessin a donc changé : Délos se distingue par sa taille et sa place, dans le
   même jeton faible que les îles. Le logotype n'emploie plus `action`, donc la
   liste ne le garde plus ; le contrôle du rang, lui, reste et vaut pour tout
   jeton que la marque emploierait demain.
*/

let echecs = 0;
const vert = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t: string) => `\x1b[31m${t}\x1b[0m`;

function verifier(titre: string, ok: boolean, detail = '') {
  if (!ok) echecs += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${titre}${ok || !detail ? '' : `\n      ${detail}`}`);
}

console.log('\nLE LOGOTYPE « CYCLADES », DANS LES QUATORZE THÈMES\n');

/*
   LA LISTE EST CONFRONTÉE AU DESSIN RENDU, et non au texte du module.

   DEUX FOIS J'AI PRIS LA MAUVAISE MESURE ICI, et les deux fois c'est le même
   genre d'erreur. D'abord la liste seule : `JETONS` est écrite à la main — à
   raison, une liste tirée du dessin ne pourrait pas le contredire —, mais une
   liste qui ne SAIT PAS ce que le dessin emploie dérive au premier jeton
   ajouté, et la garde resterait verte en mesurant des couleurs dont aucune
   n'est à l'écran. Puis la lecture du FICHIER : j'y comptais trois éléments
   `<text>`, un par variante, et le jour où le mot est passé par une fonction
   commune il n'en restait qu'un dans la source. La garde a rougi sur sa propre
   prémisse, ce qui est la bonne façon d'échouer, mais elle mesurait la forme du
   code et non celle du dessin.

   Elle appelle donc la fonction, pour les trois variantes, et lit ce qui sort.
   C'est ce qui part dans la page, et c'est la seule chose dont les seuils
   parlent.
*/
const VARIANTES = ['mot', 'anneau', 'archipel'] as const;
const rendus = VARIANTES.map((v) => ({ variante: v, svg: svgLogotype(v, '1rem') }));

verifier(
  'prémisse : les trois variantes rendent bien un dessin',
  rendus.every((r) => r.svg.startsWith('<svg') && r.svg.includes('Cyclades')),
  rendus.map((r) => `${r.variante} : ${r.svg.slice(0, 40)}`).join(' | '),
);

/*
   LE NOM EST LU UNE FOIS, ET UNE SEULE. `role="img"` empêche l'annonce des
   descendants, donc `aria-label` est le seul porteur — mais un `<title>` ou un
   second label ajouté dans la marque ferait dire « Cyclades Cyclades ». La
   mesure est donc : un label, aucun titre.
*/
for (const { variante, svg } of rendus) {
  verifier(
    `${variante} : un seul porteur du nom accessible`,
    (svg.match(/aria-label="Cyclades"/g) ?? []).length === 1 &&
      svg.includes('role="img"') &&
      !svg.includes('<title'),
    `aria-label ×${(svg.match(/aria-label="Cyclades"/g) ?? []).length}` +
      `, role="img" ${svg.includes('role="img"')}, <title> ${svg.includes('<title')}`,
  );
}

/*
   LA PLACE EST RÉSERVÉE : un `viewBox` donne au SVG un rapport de forme
   intrinsèque, donc une boîte connue avant que la police n'arrive. Sans lui,
   le logotype mesurerait Arial puis Public Sans, et l'en-tête sauterait — or
   l'en-tête est l'élément que `view-transition-name` fait persister d'une page
   à l'autre. Et `textLength` tient la largeur du mot quelle que soit la police
   servie : c'est la seconde moitié de la même promesse.
*/
for (const { variante, svg } of rendus) {
  verifier(
    `${variante} : la place est réservée avant la police`,
    /viewBox="0 0 \d+ \d+"/.test(svg) && svg.includes('lengthAdjust="spacing"'),
    `viewBox ${/viewBox="0 0 \d+ \d+"/.test(svg)}, lengthAdjust ${svg.includes('lengthAdjust="spacing"')}`,
  );
}

/* Les polices sont celles du site, par leur jeton — jamais un nom en dur, qui
   échapperait à tout changement de la typographie. */
const policesEnDur = rendus
  .filter(({ svg }) => /font-family="(?!var\(--font-)/.test(svg))
  .map((r) => r.variante);
verifier('les polices viennent des jetons du site', policesEnDur.length === 0, policesEnDur.join(', '));

/* Et rien ne sort sur le réseau : ni image, ni police, ni lien. */
const reseau = rendus
  .filter(({ svg }) => /<image|url\(|xlink:href|@import|https?:/.test(svg))
  .map((r) => r.variante);
verifier('aucun appel au réseau dans le dessin', reseau.length === 0, reseau.join(', '));

const tousLesSvg = rendus.map((r) => r.svg).join('');
const NOM_DU_JETON: Record<string, string> = {
  '--etat-texte': 'texte',
  '--etat-texte-faible': 'texteFaible',
  '--etat-texte-fort': 'texteFort',
  '--etat-action': 'action',
  '--etat-accent': 'accent',
  '--etat-succes': 'succes',
  '--etat-alerte': 'alerte',
  '--etat-erreur': 'erreur',
};
const employes = [...tousLesSvg.matchAll(/fill="var\((--etat-[a-z-]+)\)"/g)].map((m) => m[1]);
verifier(
  'prémisse : le dessin pose bien des couleurs par jeton',
  employes.length >= 10,
  `obtenu ${employes.length} occurrences de fill="var(--etat-…)"`,
);

/*
   ET LE MOT EST PEINT DU JETON LE PLUS FORT.

   C'est un sabotage qui a écrit ce contrôle. Celui du rang, plus bas, compare
   les JETONS entre eux — `texte` contre `texteFaible` — et il est resté vert
   quand j'ai fait passer le mot lui-même au jeton faible : il mesurait que
   `texte` domine `texteFaible`, ce qui est vrai des thèmes et n'apprenait rien
   du dessin. Le mot pouvait donc être peint de la couleur de la marque sans
   qu'une croix paraisse. Les deux contrôles ne se remplacent pas : celui-ci dit
   QUEL jeton porte le nom, celui du rang dit que ce jeton l'emporte partout.
*/
for (const { variante, svg } of rendus) {
  const peints = [...svg.matchAll(/<text[^>]*?fill="var\((--etat-[a-z-]+)\)"/gs)].map((m) => m[1]);
  verifier(
    `${variante} : le mot est peint du jeton le plus fort`,
    peints.length === 1 && peints[0] === '--etat-texte',
    peints.join(', ') || '(aucun <text> coloré)',
  );
}

const declares = new Set(JETONS.map((j) => j.role as string));
const inconnus = [...new Set(employes)]
  .map((v) => ({ variable: v, role: NOM_DU_JETON[v] }))
  .filter((e) => !e.role || !declares.has(e.role));
verifier(
  'tout jeton employé par le dessin est dans la liste gardée',
  inconnus.length === 0,
  inconnus.map((e) => `${e.variable}${e.role ? '' : ' (jeton inconnu de cet essai)'}`).join(', '),
);

type Palette = { fond: string; texte: string; texteFaible: string; action: string };
const combinaisons: { id: string; mode: string; palette: Palette }[] = [];
for (const theme of THEMES as unknown as Record<string, unknown>[]) {
  for (const mode of ['clair', 'sombre']) {
    const palette = theme[mode] as Palette | undefined;
    if (palette) combinaisons.push({ id: String(theme.id), mode, palette });
  }
}

/*
   LA PRÉMISSE, et elle n'est pas de décoration : un balayage vide déclarerait
   « aucun jeton sous le seuil » en n'ayant rien mesuré. C'est le défaut qui
   m'a déjà donné un « ✓ 0 essais, tous justes » ailleurs dans ce dépôt.
*/
verifier(
  `prémisse : les combinaisons thème × mode sont toutes là (${combinaisons.length})`,
  combinaisons.length >= 25,
  `obtenu ${combinaisons.length}, attendu au moins 25`,
);
verifier(
  'prémisse : les quatorze thèmes sont représentés',
  new Set(combinaisons.map((c) => c.id)).size === 14,
  `obtenu ${new Set(combinaisons.map((c) => c.id)).size} thèmes distincts`,
);

for (const { role, pour, seuil } of JETONS) {
  const sous = combinaisons
    .map((c) => ({ ...c, rapport: contraste(c.palette[role], c.palette.fond) }))
    .filter((c) => c.rapport < seuil);
  const pire = Math.min(...combinaisons.map((c) => contraste(c.palette[role], c.palette.fond)));
  verifier(
    `${role} (${pour}) tient ${seuil}:1 partout — pire cas ${pire.toFixed(2)}:1`,
    sous.length === 0,
    sous.map((c) => `${c.id}/${c.mode} : ${c.rapport.toFixed(2)}:1`).join(', '),
  );
}

/*
   ET LE MOT EST LE PLUS CONTRASTÉ DES TROIS. La marque ne doit jamais dominer
   le nom : un anneau plus présent que le mot ferait du clin d'œil le sujet, et
   l'énoncé demande l'inverse — le mot, et au plus un clin d'œil.
*/
const ecarts = combinaisons.filter((c) => {
  const mot = contraste(c.palette.texte, c.palette.fond);
  /* Tous les jetons de la marque, quels qu'ils deviennent : la boucle lit la
     liste plutôt que de nommer `texteFaible`, pour qu'un jeton ajouté demain
     entre dans ce contrôle sans qu'on y pense. */
  return JETONS.filter((j) => j.role !== 'texte').some(
    (j) => contraste(c.palette[j.role], c.palette.fond) > mot,
  );
});
verifier(
  'le mot est partout plus contrasté que la marque',
  ecarts.length === 0,
  ecarts.map((c) => `${c.id}/${c.mode}`).join(', '),
);

console.log(
  echecs === 0
    ? `\n${vert('Le logotype se lit dans les quatorze thèmes, clair comme sombre.')}\n`
    : `\n${rouge(`${echecs} rouge(s).`)}\n`,
);
process.exit(echecs === 0 ? 0 : 1);
