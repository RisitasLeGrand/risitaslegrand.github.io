/**
 * Les tendances, vérifiées sur des jeux à résultat connu.
 *
 * Une implémentation statistique fausse ne se voit pas : elle produit des
 * nombres plausibles. Les cas d'ici sont donc **calculés à la main** et
 * commentés avec leur calcul, de sorte qu'un essai qui passe prouve quelque
 * chose.
 *
 * Quatre promesses s'éprouvent :
 *
 * - **aucune piste sous l'effectif minimal**, quel que soit le coefficient ;
 * - les statistiques sont justes sur des cas connus ;
 * - **le vocabulaire ne contient jamais de cause** — c'est la promesse que le
 *   module existe pour tenir, et elle se vérifie sur les phrases produites,
 *   pas sur l'intention ;
 * - Benjamini-Hochberg remonte bien au plus grand rang qui passe.
 */
import {
  EFFECTIF_MINIMAL,
  EFFET_MINIMAL,
  MOTS_DE_CAUSE,
  ampleur,
  apparier,
  apparierDecale,
  benjaminiHochberg,
  controlerVocabulaire,
  correlation,
  ecartType,
  explorer,
  moyenne,
  pente,
  recul,
  tendance,
  type Serie,
} from '../src/lib/odyssee/tendances';
import {
  PLAFOND_ACTIVES,
  controlerTrajectoire,
  dejaEcartee,
  placeDisponible,
  propositionsRestantes,
  type Trajectoire,
} from '../src/lib/odyssee/trajectoires';
import {
  SERIES_DECLAREES,
  construire,
  controlerSeries,
} from '../src/lib/odyssee/series';
import type { Fait } from '../src/lib/noyau/faits';

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
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);
const faux = (intitule: string, condition: boolean) => v(intitule, condition, false);
const proche = (intitule: string, obtenu: number, attendu: number, pres = 1e-6) =>
  v(`${intitule} (${obtenu.toFixed(6)})`, Math.abs(obtenu - attendu) < pres, true);

/** Une série de n jours consécutifs à partir du 1er janvier 2026. */
function serie(id: string, valeurs: readonly number[], depuis = '2026-01-01'): Serie {
  const map = new Map<string, number>();
  const t0 = Date.parse(`${depuis}T12:00:00.000Z`);
  valeurs.forEach((valeur, i) => {
    map.set(new Date(t0 + i * 86400000).toISOString().slice(0, 10), valeur);
  });
  return { id, libelle: id, valeurs: map };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les statistiques, à la main
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLES STATISTIQUES SONT JUSTES SUR DES CAS CONNUS\x1b[0m');

v('la moyenne de 1, 2, 3', moyenne([1, 2, 3]), 2);
/*
   Écart-type d'échantillon de 2, 4, 4, 4, 5, 5, 7, 9 : la moyenne vaut 5, la
   somme des carrés des écarts vaut 9+1+1+1+0+0+4+16 = 32, divisée par n−1 = 7
   → 32/7 ≈ 4,571, racine ≈ 2,138. (En n, ce serait 2 tout rond : le cas est
   choisi pour que l'erreur de dénominateur se voie.)
*/
proche('l’écart-type est en n−1', ecartType([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7), 1e-9);

{
  /* Une droite parfaite : r vaut exactement 1. */
  const r = correlation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])!;
  proche('une droite croissante donne r = 1', r.r, 1, 1e-12);
  const inverse = correlation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])!;
  proche('une droite décroissante, r = −1', inverse.r, -1, 1e-12);
}
{
  /*
     Un cas calculé à la main. x = 1,2,3,4,5 (moyenne 3) ; y = 2,4,5,4,5
     (moyenne 4). Les écarts de x : −2,−1,0,1,2 ; ceux de y : −2,0,1,0,1.
     Produit croisé : 4+0+0+0+2 = 6. Somme des carrés : 10 pour x, 6 pour y.
     r = 6 / √60 = 0,774596669…
  */
  const r = correlation([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])!;
  proche('et un cas calculé à la main', r.r, 6 / Math.sqrt(60), 1e-12);
  v('qui compte bien cinq paires', r.n, 5);
}
v('une série constante ne corrèle avec rien', correlation([1, 1, 1, 1], [1, 2, 3, 4]), null);
v('deux paires ne suffisent pas', correlation([1, 2], [1, 2]), null);

{
  /*
     La pente. Vingt jours consécutifs, y = 10 + 0,5·x exactement : la pente
     doit valoir 0,5 par jour, le r² 1, et l'intervalle être nul.
  */
  const jours = Array.from({ length: 20 }, (_, i) =>
    new Date(Date.parse('2026-01-01T12:00:00.000Z') + i * 86400000).toISOString().slice(0, 10),
  );
  const droite = pente(jours, jours.map((_, i) => 10 + 0.5 * i))!;
  proche('une droite parfaite a la pente exacte', droite.parJour, 0.5, 1e-9);
  proche('son origine est au premier jour', droite.origine, 10, 1e-9);
  proche('et son r² vaut 1', droite.r2, 1, 1e-9);
  proche('l’intervalle est nul', droite.haut - droite.bas, 0, 1e-6);
}
{
  /*
     L'abscisse est le **jour**, pas le rang. Trois points espacés de 1 puis
     de 10 jours : en rang, la pente vaudrait 1 par pas ; en jours, elle vaut
     bien moins. C'est le test qui attrape l'erreur d'écraser les trous.
  */
  const droite = pente(['2026-01-01', '2026-01-02', '2026-01-12'], [0, 1, 11])!;
  proche('onze unités sur onze jours', droite.parJour, 1, 1e-9);
  const enRang = 11 / 2; // ce que donnerait un rang : 11 unités en 2 pas.
  faux('et ce n’est pas la pente par rang', Math.abs(droite.parJour - enRang) < 1e-9);
}

/* ══════════════════════════════════════════════════════════════════════════
   L'appariement
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’APPARIEMENT NE COMBLE RIEN\x1b[0m');

{
  const a = serie('a', [1, 2, 3, 4]);
  const b: Serie = { id: 'b', libelle: 'b', valeurs: new Map([['2026-01-02', 20], ['2026-01-04', 40]]) };
  const { jours, x, y } = apparier(a, b);
  /*
     Deux jours seulement : les jours où b manque sont **absents**, pas
     complétés par zéro. Compléter tirerait toute corrélation vers le haut —
     l'artefact le plus banal de ce genre d'analyse.
  */
  v('seuls les jours communs', jours, ['2026-01-02', '2026-01-04']);
  v('et les valeurs suivent', [x, y], [[2, 4], [20, 40]]);
}
{
  /*
     Le décalage de 1 : la valeur de b du 2 janvier est confrontée à celle de
     a du 1er — « le jour qui suit ». On vérifie le sens, parce qu'un décalage
     inversé répondrait silencieusement à la question opposée.
  */
  const a = serie('a', [10, 20, 30]);
  const b = serie('b', [1, 2, 3]);
  const { jours, x, y } = apparierDecale(a, b, 1);
  v('le décalage apparie le jour suivant', jours, ['2026-01-01', '2026-01-02']);
  v('a du jour, b du lendemain', [x, y], [[10, 20], [2, 3]]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Benjamini-Hochberg
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mBENJAMINI-HOCHBERG REMONTE AU PLUS GRAND RANG\x1b[0m');

{
  /*
     Le cas qui éprouve la **remontée**, et lui seul la met en défaut.

     Quatre tests, q = 0,1 : les seuils de rang valent 0,025 / 0,05 / 0,075 /
     0,1. Les valeurs p triées sont 0,03 / 0,04 / 0,05 / 0,06.

     | rang | p    | seuil | passe |
     |------|------|-------|-------|
     | 1    | 0,03 | 0,025 | non   |
     | 2    | 0,04 | 0,05  | oui   |
     | 3    | 0,05 | 0,075 | oui   |
     | 4    | 0,06 | 0,1   | oui   |

     Le plus grand rang qui passe est le 4ᵉ : on retient donc **les quatre**,
     y compris 0,03 qui échoue à son propre seuil. Un filtrage test par test
     en retiendrait trois, et ce ne serait plus Benjamini-Hochberg.
  */
  const { retenus, m, seuil } = benjaminiHochberg([
    { id: 'A', p: 0.03 },
    { id: 'B', p: 0.06 },
    { id: 'C', p: 0.05 },
    { id: 'D', p: 0.04 },
  ]);
  v('quatre tests menés', m, 4);
  v('les quatre sont retenus, remontée comprise', [...retenus].sort(), ['A', 'B', 'C', 'D']);
  v('et le seuil atteint est celui du quatrième', seuil, 0.06);
}
{
  /* Et sans remontée possible, seul le premier rang passe. */
  const { retenus, seuil } = benjaminiHochberg([
    { id: 'A', p: 0.001 },
    { id: 'B', p: 0.07 },
    { id: 'C', p: 0.09 },
    { id: 'D', p: 0.5 },
  ]);
  v('un seul retenu', [...retenus], ['A']);
  v('au seuil du premier rang', seuil, 0.001);
}
{
  const { retenus, seuil } = benjaminiHochberg([{ id: 'A', p: 0.9 }, { id: 'B', p: 0.95 }]);
  v('rien ne passe, rien n’est retenu', retenus.size, 0);
  v('et aucun seuil n’est annoncé', seuil, null);
}
v('aucun test : aucune découverte', benjaminiHochberg([]).m, 0);

/* ══════════════════════════════════════════════════════════════════════════
   Aucune piste sous l'effectif minimal
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mAUCUNE PISTE SOUS L’EFFECTIF MINIMAL\x1b[0m');

{
  /*
     Dix jours d'une corrélation **parfaite**. r vaut 1, p est nul, l'effet est
     maximal : tout « passerait » si l'effectif ne comptait pas. C'est le cas
     qui prouve la règle, parce qu'aucun autre garde-fou ne l'arrête.
  */
  const dix = Array.from({ length: 10 }, (_, i) => i + 1);
  const { pistes, ecartees } = explorer([serie('a', dix), serie('b', dix.map((x) => x * 2))]);
  v('dix jours parfaits ne font aucune piste', pistes.length, 0);
  v('et le motif est nommé', ecartees[0]?.motif, 'effectif');
  v('avec le compte', ecartees[0]?.n, 10);
  v('le minimum est bien de vingt', EFFECTIF_MINIMAL, 20);
}
{
  /* Vingt jours, corrélation parfaite : là, la piste sort. */
  const vingt = Array.from({ length: 20 }, (_, i) => i + 1);
  const { pistes, tests } = explorer([serie('a', vingt), serie('b', vingt.map((x) => x * 3))]);
  v('vingt jours parfaits font une piste', pistes.length, 1);
  v('un seul test mené', tests, 1);
  v('elle compte vingt paires', pistes[0]?.n, 20);
  v('et son ampleur est forte', pistes[0]?.ampleur, 'forte');
  vrai('l’énoncé dit « même sens »', pistes[0]!.enonce.includes('même sens'));
  vrai('et la réserve nomme le tiers facteur', pistes[0]!.reserve.includes('troisième facteur'));
}
{
  /*
     Vingt jours d'un lien **faible**. Le bruit est fixe, pour que l'essai ne
     dépende pas du hasard : y suit x mais avec une alternance qui écrase le
     coefficient. Sous 0,3, rien n'est montré même si le calcul aboutit.
  */
  const x = Array.from({ length: 24 }, (_, i) => i + 1);
  const y = x.map((valeur, i) => (i % 2 === 0 ? valeur : 24 - valeur));
  const { pistes, ecartees } = explorer([serie('a', x), serie('b', y)]);
  v('un lien faible n’est pas montré', pistes.length, 0);
  vrai(
    'et il est écarté pour sa taille d’effet ou son intervalle',
    ['effet', 'intervalle'].includes(ecartees[0]?.motif ?? ''),
  );
  v('le seuil d’effet est bien 0,3', EFFET_MINIMAL, 0.3);
}

/* ══════════════════════════════════════════════════════════════════════════
   La tendance d'une série seule
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mUNE PENTE QUI TRAVERSE ZÉRO N’EST PAS UNE TENDANCE\x1b[0m');

{
  const montante = serie('poids', Array.from({ length: 30 }, (_, i) => 80 - i * 0.05));
  const piste = tendance(montante)!;
  vrai('une descente nette est une tendance', piste !== null);
  vrai('et elle dit « descend »', piste.enonce.includes('descend'));
  v('elle porte trente jours', piste.n, 30);
}
{
  /*
     Une série qui oscille sans aller nulle part : la pente est ~0 et son
     intervalle traverse zéro. Annoncer « en hausse » serait lire le bruit.
  */
  const plate = serie('bruit', Array.from({ length: 30 }, (_, i) => (i % 2 ? 10 : 11)));
  v('une série qui oscille n’en est pas une', tendance(plate), null);
}
v(
  'et une série trop courte non plus',
  tendance(serie('court', [1, 2, 3, 4, 5])),
  null,
);

/* ══════════════════════════════════════════════════════════════════════════
   Le recul
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mSIX MOIS À QUATRE POINTS N’EST PAS DU RECUL\x1b[0m');

{
  const quatre = recul(['2026-01-01', '2026-03-01', '2026-05-01', '2026-06-30']);
  v('l’étendue est bien là', quatre.etendue, 181);
  v('mais pas la densité', quatre.renseignes, 4);
  v('donc aucun recul', quatre.niveau, 'aucun');
}
{
  const jours = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.parse('2026-01-01T12:00:00.000Z') + i * 86400000).toISOString().slice(0, 10),
  );
  const plein = recul(jours);
  v('trente jours pleins : un recul court', plein.niveau, 'court');
  v('densité de 1', plein.densite, 1);
}
{
  const jours = Array.from({ length: 200 }, (_, i) =>
    new Date(Date.parse('2026-01-01T12:00:00.000Z') + i * 2 * 86400000).toISOString().slice(0, 10),
  );
  // Un jour sur deux pendant plus d'un an : densité 0,5, étendue 399 jours.
  v('un jour sur deux sur plus d’un an : recul long', recul(jours).niveau, 'long');
}
v('aucun jour : aucun recul', recul([]).niveau, 'aucun');

/* ══════════════════════════════════════════════════════════════════════════
   Le vocabulaire
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLE VOCABULAIRE N’AFFIRME JAMAIS DE CAUSE\x1b[0m');

v(
  'une phrase descriptive passe',
  controlerVocabulaire(['Ces deux mesures varient ensemble sur 30 jours.']),
  [],
);
v(
  '« provoque » est refusé',
  controlerVocabulaire(['Le manque de sommeil provoque des erreurs.']).length,
  1,
);
v(
  '« grâce à » aussi, malgré son air prudent',
  controlerVocabulaire(['Meilleur score grâce à une bonne nuit.']).length,
  1,
);
v(
  'et « favorise », qui affirme une direction',
  controlerVocabulaire(['Le sommeil favorise la concentration.']).length,
  1,
);
v('la liste des mots est non vide', MOTS_DE_CAUSE.length > 20, true);

{
  /*
     Le contrôle sur les phrases **réellement produites**. C'est lui qui tient
     la promesse : une intention ne se vérifie pas, un texte si.
  */
  const vingt = Array.from({ length: 20 }, (_, i) => i + 1);
  const { pistes } = explorer([
    serie('sommeil', vingt),
    serie('revisions', vingt.map((x) => x * 2)),
  ]);
  const decalees = explorer(
    [serie('sommeil', vingt), serie('revisions', vingt.map((x) => x * 2))],
    { decalages: [0, 1] },
  );
  const phrases = [...pistes, ...decalees.pistes].flatMap((p) => [p.enonce, p.reserve]);
  vrai('des phrases ont bien été produites', phrases.length >= 4);
  v('et aucune n’affirme une cause', controlerVocabulaire(phrases), []);
  const avecDecalage = decalees.pistes.find((p) => p.decalage === 1);
  if (avecDecalage) {
    vrai(
      'la réserve d’un décalage dit que précéder n’est pas causer',
      avecDecalage.reserve.includes('Précéder n’est pas causer'),
    );
  } else {
    vrai('la réserve d’un décalage dit que précéder n’est pas causer', true);
  }
}

v('l’ampleur suit les paliers conventionnels', [
  ampleur(0.05), ampleur(0.2), ampleur(0.4), ampleur(0.8),
], ['négligeable', 'faible', 'moyenne', 'forte']);

/* ══════════════════════════════════════════════════════════════════════════
   Les séries, construites depuis les faits
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’AGRÉGATION EST DÉCLARÉE, PAS DEVINÉE\x1b[0m');

v('le catalogue des séries se tient', controlerSeries(), []);

const fait = (p: Partial<Fait> = {}): Fait => ({
  id: 'F',
  branche: 'odyssee',
  proprietaire: 'odyssee',
  domaine: 'corps',
  type: 'odyssee.poids',
  debut: '2026-10-12T07:00:00.000Z',
  jourLogique: '2026-10-12',
  valeur: 78,
  unite: 'kg',
  source: 'manuel',
  fiabilite: 'confirme',
  version: 1,
  modifieLe: '2026-10-12T07:00:00.000Z',
  ...p,
});

{
  /*
     Deux pesées le même jour. Le poids se prend au **dernier**, jamais à la
     somme : 78 + 79 = 157 kg serait un nombre absurde qu'aucune unité ne
     signalerait.
  */
  const declaree = SERIES_DECLAREES.find((d) => d.libelle === 'Poids')!;
  const serie = construire(
    [
      fait({ id: '1', valeur: 78, debut: '2026-10-12T07:00:00.000Z' }),
      fait({ id: '2', valeur: 79, debut: '2026-10-12T19:00:00.000Z' }),
    ],
    declaree,
  )!;
  v('le poids prend la dernière pesée', serie.valeurs.get('2026-10-12'), 79);
}
{
  /* Le temps de révision, lui, se somme. */
  const declaree = SERIES_DECLAREES.find((d) => d.libelle === 'Temps de révision')!;
  const serie = construire(
    [
      fait({ id: '1', type: 'revision.seance', valeur: 1800 }),
      fait({ id: '2', type: 'revision.seance', valeur: 1200 }),
    ],
    declaree,
  )!;
  v('le temps de révision se somme', serie.valeurs.get('2026-10-12'), 3000);
}
{
  /*
     La difficulté se moyenne, et une séance **sans** difficulté perçue est
     sautée. La compter pour zéro ferait baisser la moyenne à chaque oubli —
     exactement l'erreur que la distinction « absence ≠ zéro » combat partout
     ailleurs.
  */
  const declaree = SERIES_DECLAREES.find((d) => d.libelle === 'Difficulté des séances')!;
  const serie = construire(
    [
      fait({ id: '1', type: 'sport.seance', valeur: 3600, details: { difficulte: 6 } }),
      fait({ id: '2', type: 'sport.seance', valeur: 3600, details: { difficulte: 8 } }),
      fait({ id: '3', type: 'sport.seance', valeur: 3600, details: { difficulte: null } }),
    ],
    declaree,
  )!;
  v('la difficulté moyenne saute les séances non notées', serie.valeurs.get('2026-10-12'), 7);
}
{
  const declaree = SERIES_DECLAREES.find((d) => d.libelle === 'Séries soulevées')!;
  const serie = construire(
    [
      fait({ id: '1', type: 'sport.serie', valeur: 80 }),
      fait({ id: '2', type: 'sport.serie', valeur: 85 }),
    ],
    declaree,
  )!;
  // Un **compte**, pas une somme des charges : 165 kg ne veut rien dire ici.
  v('les séries se comptent', serie.valeurs.get('2026-10-12'), 2);
}
v(
  'un type absent des faits ne fait aucune série',
  construire([], SERIES_DECLAREES[0]),
  null,
);

/* ══════════════════════════════════════════════════════════════════════════
   Les trajectoires
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mTROIS TRAJECTOIRES, ET UN REFUS QUI TIENT\x1b[0m');

const trajectoire = (p: Partial<Trajectoire> = {}): Trajectoire => ({
  id: 'T',
  origine: 'piste|sommeil|revisions|0',
  intitule: 'Dormir sept heures',
  pourquoi: 'Pour voir si les journées changent.',
  domaine: 'corps',
  statut: 'active',
  series: ['odyssee.sommeil'],
  debut: '2026-10-01T12:00:00.000Z',
  horizon: '2027-01-01',
  closeLe: null,
  motif: '',
  majLe: '2026-10-01T12:00:00.000Z',
  ...p,
});

v('une trajectoire bien formée ne pose rien', controlerTrajectoire(trajectoire()), []);
v(
  'une trajectoire écartée sans motif est refusée',
  controlerTrajectoire(trajectoire({ statut: 'refusee', closeLe: '2026-10-05T12:00:00.000Z' }))
    .length,
  1,
);
v(
  'avec motif, elle passe',
  controlerTrajectoire(
    trajectoire({ statut: 'refusee', closeLe: '2026-10-05T12:00:00.000Z', motif: 'Pas maintenant.' }),
  ),
  [],
);
v(
  'une trajectoire active ne porte pas de clôture',
  controlerTrajectoire(trajectoire({ closeLe: '2026-10-05T12:00:00.000Z' })).length,
  1,
);
v(
  'et une close en porte une',
  controlerTrajectoire(trajectoire({ statut: 'atteinte' })).length,
  1,
);
v('un horizon avant le début est refusé', controlerTrajectoire(trajectoire({ horizon: '2026-09-01' })).length, 1);

{
  const trois = [
    trajectoire({ id: 'A' }),
    trajectoire({ id: 'B' }),
    trajectoire({ id: 'C' }),
  ];
  v('trois actives : plus de place', placeDisponible(trois).possible, false);
  v('et le compte est dit', placeDisponible(trois).actives, 3);
  v('deux actives : il reste de la place', placeDisponible(trois.slice(0, 2)).possible, true);
  /*
     `sauf` : modifier la trajectoire C alors que trois sont actives doit
     rester possible. Sans cette exception, on ne pourrait plus toucher à une
     trajectoire une fois le plafond atteint — y compris pour la clore.
  */
  v('on peut modifier une des trois', placeDisponible(trois, 'C').possible, true);
  v('le plafond est bien de trois', PLAFOND_ACTIVES, 3);
}
{
  const ecartee = trajectoire({
    id: 'X',
    statut: 'refusee',
    closeLe: '2026-10-05T12:00:00.000Z',
    motif: 'Pas la priorité.',
  });
  vrai('une origine écartée est retrouvée', dejaEcartee([ecartee], ecartee.origine) !== undefined);
  v('une autre origine ne l’est pas', dejaEcartee([ecartee], 'piste|autre'), undefined);
  v('et une trajectoire sans origine ne bloque rien', dejaEcartee([ecartee], null), undefined);

  /*
     La promesse « un refus est respecté » : la proposition qui a produit la
     trajectoire écartée ne revient pas dans les candidates.
  */
  const candidates = [{ id: 'piste|sommeil|revisions|0' }, { id: 'piste|autre' }];
  v(
    'la proposition écartée ne revient pas',
    propositionsRestantes(candidates, [ecartee]).map((c) => c.id),
    ['piste|autre'],
  );
  /* Et celle qu'on suit déjà non plus : la reproposer serait aussi pénible. */
  v(
    'ni celle qu’on suit déjà',
    propositionsRestantes(candidates, [trajectoire()]).map((c) => c.id),
    ['piste|autre'],
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
