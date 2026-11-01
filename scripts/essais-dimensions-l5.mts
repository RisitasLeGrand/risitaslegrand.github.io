/**
 * CE QU'UNE DIMENSION DISCRÈTE CHANGE À LA MESURE — éprouvé.
 *
 * Prompt 63, lot L5. L'escalier demande un écart en `z` ; une dimension
 * discrète ne peut montrer que des multiples de son grain. Cet essai tient la
 * conséquence : à trois ou cinq niveaux, un écart au plancher de la procédure
 * devient NUL, donc les deux stimulus sont identiques, donc la personne répond
 * au hasard — et l'escalier enregistre un seuil sans que rien ne lève.
 *
 * Ce qu'il garde est donc un REFUS : que ces dimensions soient écartées avec
 * leur raison, au lieu de rendre un chiffre.
 *
 *     npm run essais:dimensions-l5
 */
import { zDepuisLAttribut } from '../src/features/veridical-mapping/dimensions/rendus/types';
import { DIMENSIONS, PAS, zDuPas } from '../src/features/veridical-mapping/dimensions';
import { stimulus } from '../src/features/veridical-mapping/stimulus';
import {
  ECARTS_REQUIS,
  ecartMontre,
  ecartsPresentables,
  ecartsPresentablesExacts,
  grainDe,
  manquentLeGrisNeutre,
  nombresSansDureeFixe,
  plancherDe,
  raisonDInaptitude,
  type DimensionL5,
} from '../src/features/veridical-mapping/dimensions-l5';
import { PLANCHER_MESURABLE } from '../src/features/veridical-mapping/escalier';

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)}`);
    console.log(`      attendu ${JSON.stringify(attendu)}`);
  }
};
const vrai = (titre: string, c: unknown) => v(titre, c, true);
const faux = (titre: string, c: unknown) => v(titre, c, false);
const proche = (titre: string, obtenu: number, attendu: number) => {
  const ok = Math.abs(obtenu - attendu) < 1e-9;
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${obtenu}, attendu ${attendu}`);
};

const d = (id: string, niveaux?: number): DimensionL5 => ({ id, niveaux });

console.log('\n\x1b[1mLE GRAIN D’UNE DIMENSION DISCRÈTE\x1b[0m\n');

/* La prémisse : sans elle, tout ce qui suit mesurerait un autre plancher. */
proche('prémisse : le plancher de la procédure vaut 0,04', PLANCHER_MESURABLE, 0.04);

proche('une dimension continue a pour grain le plancher', grainDe(d('continue')), 0.04);
proche('huit niveaux donnent un grain de 1/7', grainDe(d('huit', 8)), 1 / 7);
proche('vingt-six niveaux rejoignent le plancher', grainDe(d('vingtsix', 26)), 0.04);

console.log('\n\x1b[1mLE PLANCHER PREND LE PLUS GROSSIER DES DEUX\x1b[0m\n');
/*
   LE SENS DE L'INÉGALITÉ EST TOUT. Un seuil ne peut être ni plus fin que ce
   que la procédure encadre, ni plus fin que ce que le stimulus montre. Le
   minimum rendrait un plancher que rien ne tient — et il serait plus flatteur,
   donc personne ne le contesterait.
*/
proche('à cinq niveaux, le plancher est le grain, non 0,04', plancherDe(d('cinq', 5)), 0.25);
proche('à cent un niveaux, c’est 0,04, non 0,01', plancherDe(d('centun', 101)), 0.04);
vrai(
  'et le plancher n’est jamais plus fin que celui de la procédure',
  [2, 3, 5, 8, 12, 26, 51, 101, 1001].every((n) => plancherDe(d('x', n)) >= PLANCHER_MESURABLE),
);

console.log('\n\x1b[1mL’ÉCART MONTRÉ, QUI N’EST PAS L’ÉCART DEMANDÉ\x1b[0m\n');
/*
   LE CONTRÔLE QUI PORTE LE DÉFAUT. Un écart de 0,04 demandé sur une dimension
   à cinq niveaux ne se montre pas : il devient NUL. Les deux stimulus sont
   alors le même, et c'est cela qu'il fallait rendre visible — avant ce lot,
   la demande passait telle quelle et l'escalier croyait montrer 0,04.
*/
proche('à cinq niveaux, 0,04 demandé devient 0 montré', ecartMontre(d('cinq', 5), 0.04), 0);
proche('à trois niveaux aussi', ecartMontre(d('trois', 3), 0.04), 0);
/*
   À HUIT NIVEAUX AUSSI, L'ÉCART DEVIENT NUL, et c'est l'essai qui l'a appris
   à son auteur : j'avais écrit « devient 1/7 » d'après une sonde jetable qui
   comparait deux positions autour de 0,5, donc un arrondi qui franchissait une
   frontière de niveau par accident de placement. La fonction livrée arrondit
   l'ÉCART, et Math.round(0,04 / (1/7)) = Math.round(0,28) = 0.

   La règle est donc plus large que je ne l'avais écrite : TOUTE demande sous
   le demi-grain ne montre rien. À huit niveaux le demi-grain vaut 0,071, bien
   au-dessus du plancher de 0,04.
*/
proche('à huit niveaux aussi, 0,04 demandé ne montre rien', ecartMontre(d('huit', 8), 0.04), 0);
proche('et le premier écart visible y est le demi-grain franchi', ecartMontre(d('huit', 8), 0.0715), 1 / 7);
vrai(
  'règle générale : sous le demi-grain, aucun écart n’est montré',
  [3, 5, 8, 12, 26, 51, 101].every((n) => {
    const grain = grainDe(d('x', n));
    return ecartMontre(d('x', n), grain / 2 - 1e-9) === 0;
  }),
);
proche('un écart déjà sur la grille ne bouge pas', ecartMontre(d('huit', 8), 2 / 7), 2 / 7);
proche('et sur une dimension continue, rien ne change', ecartMontre(d('continue'), 0.04), 0.04);

console.log('\n\x1b[1mLE REFUS, ET SA RAISON ÉCRITE\x1b[0m\n');
for (const n of [3, 5, 12]) {
  const raison = raisonDInaptitude(d(`n${n}`, n));
  vrai(`${n} niveaux : la dimension est écartée`, raison !== null);
  vrai(`  et la raison nomme le grain et le compte d’écarts`, /grain de .* écart/.test(raison ?? ''));
}
for (const n of [26, 51, 101]) {
  v(`${n} niveaux : la dimension est admise`, raisonDInaptitude(d(`n${n}`, n)), null);
}
v('une dimension continue est admise', raisonDInaptitude(d('continue')), null);
/*
   LA BORNE EXACTE, et non « ça marche à 26 ». Avec un départ à 0,18 et trois
   écarts requis, le grain doit valoir au plus 0,06 — donc niveaux - 1 ≥ 17,
   soit dix-huit niveaux. On éprouve les deux côtés de la frontière, parce
   qu'un contrôle qui ne teste qu'un côté ne tient pas la borne.
*/
vrai('la frontière est à dix-huit niveaux : dix-sept est refusé', raisonDInaptitude(d('x', 17)) !== null);
v('et dix-huit est admis', raisonDInaptitude(d('x', 18)), null);
v('trois écarts sont requis', ECARTS_REQUIS, 3);

console.log('\n\x1b[1mUN COMPTE DE NIVEAUX IMPOSSIBLE FAIT LEVER\x1b[0m\n');
/*
   On lève plutôt que de rendre un grain. Un niveau unique n'a rien à
   discriminer, et un compte fractionnaire ne décrit aucun stimulus — rendre
   « Infinity » ou « NaN » les ferait traverser jusqu'au tableau de bord.
*/
for (const mauvais of [0, 1, -3, 2.5]) {
  let aLeve = false;
  try {
    grainDe(d('mauvais', mauvais));
  } catch {
    aLeve = true;
  }
  vrai(`${mauvais} niveau(x) fait lever`, aLeve);
}

console.log('\n\x1b[1mLES DEUX RÈGLES DÉCLARÉES SE BALAIENT\x1b[0m\n');
v(
  'une dimension qui varie dans le temps sans gris neutre est relevée',
  manquentLeGrisNeutre([
    { id: 'clignote', varieDansLeTemps: true },
    { id: 'clignote-gris', varieDansLeTemps: true, grisNeutre: true },
    { id: 'fixe' },
  ]),
  ['clignote'],
);
v(
  'un nombre d’événements sans durée totale fixe est relevé',
  nombresSansDureeFixe([
    { id: 'combien', compteDEvenements: true },
    { id: 'combien-borne', compteDEvenements: true, dureeTotaleMs: 1200 },
    { id: 'autre' },
  ]),
  ['combien'],
);
/*
   ET LES DEUX BALAYAGES RENDENT VIDE SUR UN REGISTRE SAIN — sans ce contrôle,
   un prédicat cassé qui rend toujours la liste vide passerait pour un registre
   conforme. C'est le motif « une garde qui se mesure à elle-même rend toujours
   zéro », déjà inscrit au tableau des anomalies.
*/
v('sur un registre conforme, le balayage photosensible rend vide',
  manquentLeGrisNeutre([{ id: 'ok', varieDansLeTemps: true, grisNeutre: true }]), []);
v('et celui des nombres aussi',
  nombresSansDureeFixe([{ id: 'ok', compteDEvenements: true, dureeTotaleMs: 900 }]), []);

console.log('\n\x1b[1mLE z RELU DEPUIS L’ATTRIBUT, POUR LE POINT D’APPEL DU RENDU\x1b[0m\n');
/*
   LA PART ÉPROUVABLE DU POINT D'APPEL. Le reste — le canevas, l'effet, le
   repli bruyant — vit dans un composant Svelte, qui ne s'importe pas depuis un
   essai ; et surtout AUCUNE DIMENSION NE PORTE ENCORE DE RENDU, donc la
   branche ne s'exécute nulle part. Je le dis plutôt que de prétendre une
   couverture que je n'ai pas : le point d'appel est écrit et compilé, il n'est
   pas exercé. La première dimension qui s'en servira viendra avec son essai.

   Ce qui EST éprouvé est l'inversion d'échelle, qui est la part subtile : un
   stimulus porte des pixels ou des hertz, pas le z que le rendu attend.
*/
for (const dim of DIMENSIONS) {
  const auPas = Math.floor((PAS - 1) * 0.37);
  const s = stimulus(dim, auPas);
  const { z, ecart } = zDepuisLAttribut(dim, s as unknown as Record<string, unknown>, PAS);
  proche(`« ${dim.id} » : le z relu est celui qu’on a posé`, z, zDuPas(auPas));
  proche(`  et l’inversion est EXACTE, non approchée`, ecart, 0);
}
/*
   LES BORNES AUSSI, parce qu'une inversion juste au milieu et fausse aux
   extrémités passerait le contrôle ci-dessus. La teinte est circulaire : son
   dernier pas ne vaut pas 360°, et c'est justement là qu'un hors-borne se
   logerait.
*/
for (const dim of DIMENSIONS) {
  for (const auPas of [0, PAS - 1]) {
    const { ecart } = zDepuisLAttribut(dim, stimulus(dim, auPas) as unknown as Record<string, unknown>, PAS);
    proche(`« ${dim.id} » au pas ${auPas} : exacte aussi`, ecart, 0);
  }
}
/*
   ET LE REFUS. Un attribut illisible ferait dessiner un stimulus immobile —
   le défaut même qu'A a retiré de `stimulus()`. On lève plutôt que de rendre
   zéro, qui serait un stimulus parfaitement valide au bas de l'échelle.
*/
{
  let aLeve = false;
  try {
    zDepuisLAttribut(DIMENSIONS[0], {}, PAS);
  } catch {
    aLeve = true;
  }
  vrai('un attribut absent fait lever, au lieu de rendre un z de zéro', aLeve);
}

console.log('\n\x1b[1mLE GRAIN, CONTRE LA FICHE DE RÉFÉRENCE D’A\x1b[0m\n');
/*
   DEUX ROUTES INDÉPENDANTES VERS LE MÊME NOMBRE, et c'est ce qui donne sa
   valeur à ce contrôle. A a EXTRAIT ces grains des 123 déclarations de
   VMTrainer ; cette formule les CALCULE depuis le nombre de niveaux et la
   circularité. Si elles divergent quelque part, l'un de nous se trompe, et il
   vaut mieux le savoir ici que sur l'écran de quelqu'un.

   Source : « docs/cyclades/p63-dimensions-reference.md » sur
   claude/a-cog-zone-de-jeu, tableau « les 32 discrètes, du plus grossier au
   plus fin ».

   ET J'AVAIS TORT SUR DEUX POINTS, tous deux relevés par A :

   1. « number » n'a pas dix niveaux mais VINGT. J'avais écrit « les dix
      chiffres » — c'est-à-dire que j'ai pris le nombre dans le MONDE au lieu
      de le lire dans la DÉCLARATION, qui dit « STEP(20,false) ». C'est
      exactement la faute que je reproche ailleurs, commise sur une colonne que
      je croyais évidente. Conséquence : « number » passe AU-DESSUS de la
      frontière et n'a jamais eu à être écarté.

   2. Le grain n'est pas 1/(n−1) partout. Cinq des sept « parlées » sont
      CIRCULAIRES, et « STEP » y vaut « round(z·n) modulo n » : le grain est
      1/n. Sur « weekday » à sept niveaux, 1/(n−1) rendait 16,7 % là où la
      référence dit 14,3 %.
*/
const DISCRETES: [string, number, 'lin' | 'circ' | 'log', number, number?][] = [
  /* nom, niveaux, échelle, grain attendu en %, pire grain pour les log */
  ['nesting_depth', 5, 'lin', 25],
  ['audition.event_count', 15, 'log', 24, 0.24],
  ['polygon_sides', 6, 'lin', 20],
  ['accent_phase', 6, 'circ', 16.7],
  ['divisor_richness', 7, 'lin', 16.7],
  ['period_length', 8, 'lin', 14.3],
  ['weekday', 7, 'circ', 14.3],
  ['note_name', 7, 'circ', 14.3],
  ['flash_count', 9, 'lin', 12.5],
  ['compass_point', 8, 'circ', 12.5],
  ['vision.numerosity', 49, 'log', 9.7, 0.097],
  ['month', 12, 'circ', 8.3],
  ['clock_hour', 12, 'circ', 8.3],
  ['audition.spectral_complexity', 14, 'lin', 7.7],
  ['motif_rotation', 16, 'circ', 6.2],
  ['number', 20, 'lin', 5.3],
  ['letter', 26, 'lin', 4],
];

const laDimension = (nom: string, niveaux: number, echelle: string, pire?: number): DimensionL5 => ({
  id: nom,
  niveaux,
  ...(echelle === 'circ' ? { circulaire: true as const } : {}),
  ...(pire !== undefined ? { pireGrain: pire } : {}),
});

let accords = 0;
for (const [nom, niveaux, echelle, attenduPct, pire] of DISCRETES) {
  const obtenu = 100 * grainDe(laDimension(nom, niveaux, echelle, pire));
  /*
     LA FICHE DONNE UNE DÉCIMALE, DONC ON COMPARE À UNE DÉCIMALE — et on
     accepte les deux arrondis possibles plutôt qu'un epsilon choisi pour que
     ça passe.

     « motif_rotation » est le seul cas où cela se voit : 1/16 vaut 6,25 %,
     que la fiche écrit « 6,2 » et que l'arrondi au plus proche écrirait
     « 6,3 ». Les deux désignent le même nombre. Un epsilon de 0,06 l'aurait
     laissé passer aussi, mais en masquant POURQUOI, et il aurait laissé
     passer du même coup un vrai désaccord de 0,05 point.
  */
  const arrondi = Math.round(obtenu * 10) / 10;
  const tronque = Math.floor(obtenu * 10) / 10;
  const ok = attenduPct === arrondi || attenduPct === tronque;
  if (ok) accords += 1;
  else echecs += 1;
  const note = arrondi !== tronque && ok ? `  (${tronque} ou ${arrondi} : 1/${niveaux} = ${obtenu} %)` : '';
  console.log(
    `  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nom.padEnd(30)} ${String(niveaux).padStart(3)} ${echelle.padEnd(5)} ` +
      `calculé ${obtenu.toFixed(2)} % · fiche ${attenduPct} %${note}`,
  );
}
console.log(`\n  ${accords} accords sur ${DISCRETES.length} entre ma formule et l’extraction d’A.\n`);

console.log('\x1b[1mCE QUE LA FRONTIÈRE ÉCARTE, UNE FOIS LES VRAIS GRAINS CONNUS\x1b[0m\n');
/*
   LE RÉSULTAT CHANGE D'ÉCHELLE. Je disais « six des sept parlées » ; la
   référence montre que les 32 discrètes ont toutes un grain supérieur à 0,02,
   et la frontière en écarte la plus grande part. Seules « number » et
   « letter » la passent — dans les deux domaines, puisque chacune existe en
   vision et en audition.
*/
const admises: string[] = [];
const ecartees: string[] = [];
for (const [nom, niveaux, echelle, , pire] of DISCRETES) {
  const d = laDimension(nom, niveaux, echelle, pire);
  (raisonDInaptitude(d) === null ? admises : ecartees).push(nom);
}
console.log(`  admises  (${admises.length}) : ${admises.join(', ')}`);
console.log(`  écartées (${ecartees.length}) : ${ecartees.join(', ')}\n`);
v('seules « number » et « letter » passent la frontière', admises.sort(), ['letter', 'number']);
vrai('et « number » n’est PLUS écartée, contrairement à ce que j’avais écrit',
  raisonDInaptitude(laDimension('number', 20, 'lin')) === null);
vrai('« weekday », circulaire à sept niveaux, reste écartée',
  raisonDInaptitude(laDimension('weekday', 7, 'circ')) !== null);
proche('et son grain vaut 1/7 et non 1/6', grainDe(laDimension('weekday', 7, 'circ')), 1 / 7);

console.log('\n\x1b[1mLA PHRASE DE REFUS, ET TROIS DÉFAUTS QU’ELLE PORTAIT\x1b[0m\n');
/*
   TROIS DÉFAUTS TROUVÉS EN RELISANT MON PROPRE FICHIER avant de le livrer,
   dont un qui enfreignait une règle qu'on m'avait donnée.
*/
const refusWeekday = raisonDInaptitude(laDimension('weekday', 7, 'circ')) ?? '';
console.log(`  ${refusWeekday}\n`);
faux('la phrase ne porte aucun « (s) » — règle d’écriture', refusWeekday.includes('(s)'));
vrai('elle accorde le pluriel : « 1 écart présentable »', refusWeekday.includes('1 écart présentable'));
vrai('et le pluriel quand il y en a deux',
  (raisonDInaptitude(laDimension('motif_rotation', 16, 'circ')) ?? '').includes('2 écarts présentables'));
vrai('et le singulier à zéro',
  (raisonDInaptitude(laDimension('nesting_depth', 5, 'lin')) ?? '').includes('0 écart présentable'));

/*
   Le « undefined niveaux » n'était pas atteignable par les dimensions de la
   fiche, qui déclarent toutes leurs niveaux. Il l'était par une log qui ne
   déclare que son pire grain — et c'est la forme que la fiche marque d'une
   étoile, donc pas un cas de laboratoire.
*/
const refusLog = raisonDInaptitude({ id: 'une-log', pireGrain: 0.24 }) ?? '';
console.log(`  ${refusLog}\n`);
faux('une dimension sans « niveaux » n’annonce plus « undefined niveaux »',
  refusLog.includes('undefined'));
vrai('elle nomme son grain sans l’attribuer à un compte de niveaux',
  refusLog.includes('son grain le plus grossier vaut'));
/*
   ET C'EST ICI QUE L'ESSAI A RENDU SERVICE. J'avais écrit l'assertion avec
   une espace ORDINAIRE, et elle a rougi : « Intl » pose une espace
   INSÉCABLE (U+00A0) devant le signe, ce que la typographie française
   demande et qu'un « toFixed » suivi de « + ' %' » ne donne pas. Je l'ai
   d'abord annoncée « fine insécable » (U+202F) ; relevé dans ce moteur,
   c'est U+00A0. La différence ne se voit pas à l'œil et se mesure ici.
*/
v('le pourcentage porte une espace insécable, donc vient d’Intl',
  [...'24\u00a0%'].every((c) => refusLog.includes(c)) && refusLog.includes('24\u00a0%'),
  true);
faux('et non l’espace ordinaire d’une concaténation à la main', refusLog.includes('24 %'));

console.log('\n\x1b[1mLE DÉFAUT FLOTTANT : CE QU’IL FAIT, ET CE QU’IL NE FAIT PAS\x1b[0m\n');
/*
   J'AI D'ABORD ÉCRIT ICI UNE ASSERTION FAUSSE, ET ELLE ÉTAIT VERTE.

   Elle disait « 0,24 / 0,08 ne vaut pas 3 en flottant mais un peu moins » et
   passait par `proche`, dont la tolérance est 1e-9. La division vaut 3,
   exactement ; l'écart que l'assertion prétendait détecter vaudrait 4e-16.
   **Une tolérance plus large que l'effet qu'elle mesure rend l'assertion
   décorative** : elle ne pouvait pas distinguer 3 de « presque 3 », donc elle
   ne mesurait rien.

   Le sabotage l'a dit, et lui seul : retirer le « + 1e-9 » du code laissait
   l'essai tout vert. Un essai qui reste vert quand on casse ce qu'il prétend
   garder ne garde rien.

   Ce qui suit mesure donc le défaut par une SECONDE ROUTE — l'arithmétique
   entière, qui n'a pas de flottant — au lieu de recopier le calcul du code.
*/
const DEPARTS_EN_CENTIEMES = [18, 24, 12, 20, 25, 30, 36, 50];
let divergences = 0;
let reparees = 0;
let cassees = 0;
let desaccords = 0;
const exemples: string[] = [];
for (const centiemes of DEPARTS_EN_CENTIEMES) {
  const depart = centiemes / 100;
  for (let n = 2; n <= 400; n++) {
    for (const circulaire of [true, false] as const) {
      const dim: DimensionL5 = { id: `n${n}`, niveaux: n, ...(circulaire ? { circulaire } : {}) };
      const pas = circulaire ? n : n - 1;
      const exact = ecartsPresentablesExacts(centiemes, pas);
      const sansGarde = Math.floor(depart / grainDe(dim));
      const avecGarde = ecartsPresentables(dim, depart);
      if (sansGarde !== exact) {
        divergences += 1;
        if (avecGarde === exact) reparees += 1;
        if (exemples.length < 3) {
          exemples.push(
            `départ ${centiemes} % · ${pas} pas · exact ${exact} · sans garde ${sansGarde} · quotient ${depart / grainDe(dim)}`,
          );
        }
      }
      if (avecGarde !== exact) cassees += 1;
      if (avecGarde !== exact) desaccords += 1;
    }
  }
}
for (const e of exemples) console.log(`  ${e}`);
console.log(`\n  ${divergences} divergences entre le flottant et l’exact, sur ${DEPARTS_EN_CENTIEMES.length * 399 * 2} couples.\n`);
vrai('le défaut existe : le flottant diverge de l’exact quelque part', divergences > 0);
v('et la garde répare TOUTES les divergences', reparees, divergences);
v('sans en casser aucune', cassees, 0);
v('donc le compte livré est exact partout où il a été relevé', desaccords, 0);

/*
   ET MAINTENANT CE QU'IL NE FAIT PAS, qui est la moitié que j'avais sautée.
*/
let basculesDeVerdict = 0;
for (let millionieme = 1; millionieme <= 180000; millionieme++) {
  const grain = millionieme / 1000000;
  const dim: DimensionL5 = { id: 'g', pireGrain: grain };
  const exact = ecartsPresentablesExacts(18, 1000000 / millionieme);
  const sansGarde = Math.floor(0.18 / grain);
  if ((exact >= ECARTS_REQUIS) !== (sansGarde >= ECARTS_REQUIS)) basculesDeVerdict += 1;
  void dim;
}
v(`aucun des 180 000 grains ne fait basculer le verdict à ${ECARTS_REQUIS} écarts requis`, basculesDeVerdict, 0);
console.log(
  '      \x1b[2mdonc la garde est INVISIBLE à travers raisonDInaptitude aujourd’hui :\x1b[0m\n' +
    '      \x1b[2mles divergences sont toutes à neuf écarts ou plus, le seuil est à trois.\x1b[0m',
);

/*
   LA RAISON DE LA GARDER, elle, se mesure : la divergence est exactement à la
   hauteur où quelqu'un pourrait porter le seuil.
*/
const grainDe75 = { id: 'un-75e', pireGrain: 1 / 75 };
v('à 1/75 sous un départ de 12 %, le compte exact vaut neuf',
  ecartsPresentablesExacts(12, 75), 9);
v('et le flottant seul en rendrait huit', Math.floor(0.12 / (1 / 75)), 8);
v('la garde rend bien neuf', ecartsPresentables(grainDe75, 0.12), 9);
console.log(
  '      \x1b[2mun seuil porté à neuf écarterait donc cette dimension sans la garde —\x1b[0m\n' +
    '      \x1b[2mc’est ce qu’elle empêche, et c’est tout ce qu’elle empêche.\x1b[0m',
);

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} ${echecs >= 2 ? 'échecs' : 'échec'}.\x1b[0m\n`,
);
process.exit(echecs ? 1 : 0);
