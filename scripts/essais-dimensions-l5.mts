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
  grainDe,
  manquentLeGrisNeutre,
  nombresSansDureeFixe,
  plancherDe,
  NIVEAUX_REQUIS,
  horsEscalier,
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
  const raison = horsEscalier(d(`n${n}`, n));
  vrai(`${n} niveaux : la dimension est écartée`, raison !== null);
  vrai(`  et la raison nomme le grain et le compte d’écarts`, /grain de .* écart/.test(raison ?? ''));
}
for (const n of [26, 51, 101]) {
  v(`${n} niveaux : la dimension est admise`, horsEscalier(d(`n${n}`, n)), null);
}
v('une dimension continue est admise', horsEscalier(d('continue')), null);
/*
   LA BORNE EXACTE, et non « ça marche à 26 ». Avec un départ à 0,18 et trois
   écarts requis, le grain doit valoir au plus 0,06 — donc niveaux - 1 ≥ 17,
   soit dix-huit niveaux. On éprouve les deux côtés de la frontière, parce
   qu'un contrôle qui ne teste qu'un côté ne tient pas la borne.
*/
vrai('la frontière est à dix-huit niveaux : dix-sept est refusé', horsEscalier(d('x', 17)) !== null);
v('et dix-huit est admis', horsEscalier(d('x', 18)), null);
v('trois écarts sont requis', ECARTS_REQUIS, 3);

/*
   ET LE SEUL CRITÈRE DE REJET, qui n'est pas celui-là.

   Ajouté par A le 1er novembre, sur décision du pilote : « on ne rejette que
   les dimensions de moins de 3 niveaux ». Les assertions ci-dessus portent sur
   la frontière de l'ESCALIER, qui oriente vers l'identification ; celles-ci
   portent sur le rejet, qui est définitif. Les deux côtés de la frontière sont
   éprouvés, parce qu'un critère qui ne refuserait rien aurait le même air
   qu'un critère juste.
*/
vrai('deux niveaux : la dimension est rejetée', raisonDInaptitude(d('x', 2)) !== null);
vrai('  et la raison dit qu’aucune tâche n’y changerait rien',
  /Aucune tâche n’y changerait rien/.test(raisonDInaptitude(d('x', 2)) ?? ''));
v('trois niveaux : plus de rejet', raisonDInaptitude(d('x', 3)), null);
v('sept niveaux non plus, même hors escalier', raisonDInaptitude(d('x', 7)), null);
vrai('mais sept niveaux sortent bien de l’escalier', horsEscalier(d('x', 7)) !== null);
v('une continue n’est jamais rejetée', raisonDInaptitude(d('continue')), null);
v('trois niveaux requis', NIVEAUX_REQUIS, 3);
vrai('la phrase du hors-escalier oriente vers l’identification',
  /identification/.test(horsEscalier(d('x', 7)) ?? ''));
vrai('et aucune des deux phrases ne porte de « (s) »',
  !/\(s\)/.test((horsEscalier(d('x', 7)) ?? '') + (raisonDInaptitude(d('x', 2)) ?? '')));

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

console.log('\n\x1b[1mLES SEPT PARLÉES DU PLAN L0, CONTRE LA FRONTIÈRE\x1b[0m\n');
/*
   CE BLOC N'INVENTE RIEN, et c'est la raison pour laquelle il peut exister
   avant VMTrainer.html. Les sept NOMS viennent du plan L0 d'A
   (docs/cyclades/p63-l0-plan-veridical-mapping.md, § 5, lot 5d) ; les comptes
   de niveaux viennent du MONDE et non d'un choix de conception — il y a sept
   jours dans la semaine et douze mois dans l'année.

   Les deux comptes ambigus sont éprouvés dans leurs DEUX lectures, pour que le
   verdict ne dépende pas de celle que j'aurais retenue : « compass_point » à
   huit aires de vent ou à seize, « note_name » à sept noms ou à douze avec les
   altérations. Les quatre cas sont refusés.

   À confirmer contre VMTrainer.html quand il arrivera : si la référence donne
   un autre compte pour l'une d'elles, c'est ce contrôle qui le dira.
*/
const PARLEES: [string, number][] = [
  ['weekday', 7],
  ['month', 12],
  ['clock_hour', 12],
  ['compass_point', 8],
  ['note_name', 7],
  ['number', 10],
];
for (const [nom, niveaux] of PARLEES) {
  vrai(
    `« ${nom} » (${niveaux} niveaux) n’est pas mesurable par cet escalier`,
    horsEscalier(d(nom, niveaux)) !== null,
  );
}
/* Les deux lectures ambiguës, pour que le verdict n'en dépende pas. */
vrai('« compass_point » reste refusée même à seize niveaux', horsEscalier(d('compass_point', 16)) !== null);
vrai('« note_name » reste refusée même à douze niveaux', horsEscalier(d('note_name', 12)) !== null);
/*
   ET LA SEULE QUI PASSE, qui donne sa valeur aux six refus : sans elle, un
   critère qui refuserait TOUT aurait le même air.
*/
v('« letter » (26 niveaux) est admise, tout juste au plancher', horsEscalier(d('letter', 26)), null);
proche('et son grain vaut exactement le plancher de la procédure', grainDe(d('letter', 26)), PLANCHER_MESURABLE);

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs ? 1 : 0);
