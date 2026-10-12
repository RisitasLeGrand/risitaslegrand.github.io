/**
 * Le domaine Corps : ce qu'il refuse, ce qu'il laisse passer, ce qu'il publie.
 *
 * Quatre choses s'éprouvent ici, et la première est celle qui fait le plus de
 * dégâts quand elle est mal réglée :
 *
 * - **l'impossible est refusé, l'invraisemblable passe.** Un poids négatif est
 *   une faute de frappe ; un poids de 300 kg est le corps de quelqu'un. Les
 *   confondre, c'est soit laisser entrer n'importe quoi, soit dire à une
 *   personne qu'elle se trompe sur elle-même ;
 * - **l'absence n'est pas un zéro** : un jour sans repas noté ne vaut pas un
 *   jour à zéro calorie, et le résumé du jour le dit par `null` ;
 * - **une nuit appartient au jour du lever**, et sa durée traverse minuit ;
 * - **l'agrégat inter-branches** rend aux règles de désaccord des faits à
 *   opposer — sans quoi elles se taisent en ayant l'air satisfaites.
 */
import {
  ECART_MACROS_TOLERE,
  controlerBoisson,
  controlerMesure,
  controlerNuit,
  controlerPesee,
  controlerRepas,
  controlerSante,
  dureeDeLaNuit,
  effortEmpeche,
  journee,
  kcalDesMacros,
  macrosIncoherentes,
  moyenneMobile,
  santeEnCours,
  type Boisson,
  type EtatDeSante,
  type Nuit,
  type Pesee,
  type Repas,
} from '../src/lib/odyssee/corps';
import { projeterFaitsCorps } from '../src/lib/odyssee/faits-corps';
import { fusionner } from '../src/lib/odyssee/faits-branches';
import { detecter } from '../src/lib/odyssee/desaccords';
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

const pesee = (p: Partial<Pesee> = {}): Pesee => ({
  id: 'P',
  jour: '2026-10-12',
  le: '2026-10-12T07:00:00.000Z',
  kg: 78.4,
  note: '',
  majLe: '2026-10-12T07:00:00.000Z',
  ...p,
});

const nuit = (p: Partial<Nuit> = {}): Nuit => ({
  id: 'N',
  jour: '2026-10-12',
  coucher: '2026-10-11T22:30:00.000Z',
  lever: '2026-10-12T06:30:00.000Z',
  qualite: 3,
  reveils: 1,
  note: '',
  majLe: '2026-10-12T07:00:00.000Z',
  ...p,
});

const repas = (p: Partial<Repas> = {}): Repas => ({
  id: 'R',
  jour: '2026-10-12',
  le: '2026-10-12T12:30:00.000Z',
  moment: 'midi',
  intitule: 'Riz, poulet, brocolis',
  kcal: 620,
  proteines: 45,
  glucides: 70,
  lipides: 15,
  note: '',
  majLe: '2026-10-12T12:30:00.000Z',
  ...p,
});

const boisson = (p: Partial<Boisson> = {}): Boisson => ({
  id: 'B',
  jour: '2026-10-12',
  le: '2026-10-12T09:00:00.000Z',
  mL: 250,
  majLe: '2026-10-12T09:00:00.000Z',
  ...p,
});

const sante = (p: Partial<EtatDeSante> = {}): EtatDeSante => ({
  id: 'S',
  debut: '2026-10-10T12:00:00.000Z',
  fin: null,
  intitule: 'Angine',
  intensite: 6,
  empecheEffort: true,
  note: '',
  majLe: '2026-10-10T12:00:00.000Z',
  ...p,
});

/* ══════════════════════════════════════════════════════════════════════════
   L'impossible et l'invraisemblable
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’IMPOSSIBLE EST REFUSÉ, L’INVRAISEMBLABLE PASSE\x1b[0m');

v('une pesée ordinaire ne pose rien', controlerPesee(pesee()), []);
v('un poids négatif est refusé', controlerPesee(pesee({ kg: -5 })).length, 1);
v('un poids nul aussi', controlerPesee(pesee({ kg: 0 })).length, 1);
/*
   300 kg : le contrôle du modèle laisse passer, et c'est voulu. C'est
   `valider()` qui abaissera la fiabilité, parce qu'un corps de 300 kg existe
   et qu'un logiciel qui le refuse se trompe de rôle.
*/
v('trois cents kilos passent le contrôle', controlerPesee(pesee({ kg: 300 })), []);
{
  const { faits } = projeterFaitsCorps({
    pesees: [pesee({ kg: 300 })],
    mesures: [],
    nuits: [],
    repas: [],
    boissons: [],
    sante: [],
  });
  v('mais la projection les marque', faits[0]?.fiabilite, 'a-verifier');
  const normal = projeterFaitsCorps({
    pesees: [pesee()],
    mesures: [],
    nuits: [],
    repas: [],
    boissons: [],
    sante: [],
  });
  v('alors qu’un poids ordinaire est confirmé', normal.faits[0]?.fiabilite, 'confirme');
}

v('une mesure de 400 cm est refusée', controlerMesure({
  id: 'M', jour: '2026-10-12', le: '2026-10-12T07:00:00.000Z',
  quoi: 'taille', cm: 400, note: '', majLe: '2026-10-12T07:00:00.000Z',
}).length, 1);
v('un volume nul est refusé', controlerBoisson(boisson({ mL: 0 })).length, 1);
v('une intensité de 11 est refusée', controlerSante(sante({ intensite: 11 })).length, 1);
v('un état de santé sans intitulé est refusé', controlerSante(sante({ intitule: '  ' })).length, 1);

/* ══════════════════════════════════════════════════════════════════════════
   Le sommeil
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mUNE NUIT TRAVERSE MINUIT\x1b[0m');

v('huit heures, à cheval sur deux jours', dureeDeLaNuit(nuit()), 8 * 3600);
v('une nuit ordinaire ne pose rien', controlerNuit(nuit()), []);
v(
  'un lever avant le coucher est refusé',
  controlerNuit(nuit({ coucher: '2026-10-12T08:00:00.000Z', lever: '2026-10-12T07:00:00.000Z' }))
    .length,
  1,
);
v('une qualité de 0 est refusée', controlerNuit(nuit({ qualite: 0 })).length, 1);
v('une qualité absente ne l’est pas', controlerNuit(nuit({ qualite: null })), []);
{
  /*
     Le jour logique du fait est celui du **lever**, parce que `projeter` le
     calcule sur la fin. C'est ce qui fait qu'une nuit du 11 au 12 compte pour
     le 12 — « j'ai mal dormi » désigne la nuit qui précède la journée.
  */
  const { faits } = projeterFaitsCorps({
    pesees: [], mesures: [], nuits: [nuit()], repas: [], boissons: [], sante: [],
  });
  v('le fait porte le jour du lever', faits[0]?.jourLogique, '2026-10-12');
  v('et il est estimé, jamais confirmé', faits[0]?.fiabilite, 'estime');
}

/* ══════════════════════════════════════════════════════════════════════════
   L'absence n'est pas un zéro
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’ABSENCE N’EST PAS UN ZÉRO\x1b[0m');

{
  const vide = journee('2026-10-12', { pesees: [], nuits: [], repas: [], boissons: [] });
  v('aucune pesée : null, pas zéro', vide.poids, null);
  v('aucun sommeil : null', vide.sommeil, null);
  v('aucune calorie : null', vide.kcal, null);
  v('aucune boisson : null', vide.hydratation, null);
}
{
  /*
     Un café noté sans chiffre. Le jour compte **un repas** et **aucune
     calorie** : c'est la distinction qui empêche une moyenne de compter ce
     café comme un jeûne.
  */
  const cafe = journee('2026-10-12', {
    pesees: [], nuits: [],
    repas: [repas({ kcal: null, proteines: null, glucides: null, lipides: null })],
    boissons: [],
  });
  v('un repas non chiffré compte comme repas', cafe.repas, 1);
  v('mais pas dans les calories', cafe.kcal, null);
}
{
  const plein = journee('2026-10-12', {
    pesees: [pesee({ le: '2026-10-12T07:00:00.000Z', kg: 78.4 }), pesee({ id: 'P2', le: '2026-10-12T19:00:00.000Z', kg: 79.1 })],
    nuits: [nuit()],
    repas: [repas(), repas({ id: 'R2', kcal: 400 })],
    boissons: [boisson(), boisson({ id: 'B2', mL: 500 })],
  });
  // La **dernière** pesée du jour, pas la première : c'est la plus récente qui vaut.
  v('la dernière pesée du jour gagne', plein.poids, 79.1);
  v('les calories s’additionnent', plein.kcal, 1020);
  v('les volumes aussi', plein.hydratation, 750);
}
{
  const { faits } = projeterFaitsCorps({
    pesees: [], mesures: [], nuits: [], repas: [],
    boissons: [boisson(), boisson({ id: 'B2', mL: 500, le: '2026-10-12T18:00:00.000Z' })],
    sante: [],
  });
  /*
     Un seul fait d'hydratation par jour, et son identifiant est le jour :
     republier ne l'empile pas. Douze faits de 250 mL seraient fidèles et
     illisibles.
  */
  v('un seul fait d’hydratation par jour', faits.length, 1);
  v('et il porte la somme', faits[0]?.valeur, 750);
  v('son identifiant est le jour', faits[0]?.id, 'odyssee.hydratation:2026-10-12');
  v('avec le nombre de verres en détail', faits[0]?.details?.verres, 2);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les macros
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLES MACROS SE CONTRÔLENT ENTRE ELLES\x1b[0m');

// Atwater : 45×4 + 70×4 + 15×9 = 180 + 280 + 135 = 595.
v('Atwater, à la main', kcalDesMacros(repas()), 595);
v('aucune macro donnée : null, pas zéro', kcalDesMacros({ proteines: null, glucides: null, lipides: null }), null);
faux('620 contre 595 reste dans la tolérance', macrosIncoherentes(repas()));
vrai(
  'mais 2000 contre 595 ne l’est plus',
  macrosIncoherentes(repas({ kcal: 2000 })),
);
faux(
  'et sans calories saisies, rien à contredire',
  macrosIncoherentes(repas({ kcal: null })),
);
{
  // La borne exacte : 595 × (1 + 0,25) = 743,75. À 743, on est dedans.
  faux('la borne de tolérance est comprise', macrosIncoherentes(repas({ kcal: 743 })));
  vrai('juste au-dessus, non', macrosIncoherentes(repas({ kcal: 745 })));
  v('la tolérance est bien d’un quart', ECART_MACROS_TOLERE, 0.25);
}
v('un repas sans intitulé est refusé', controlerRepas(repas({ intitule: ' ' })).length, 1);

/* ══════════════════════════════════════════════════════════════════════════
   La moyenne mobile
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLA MOYENNE MOBILE NE COMBLE PAS LES TROUS\x1b[0m');

{
  const serie = moyenneMobile([
    pesee({ id: '1', jour: '2026-10-01', le: '2026-10-01T07:00:00.000Z', kg: 80 }),
    pesee({ id: '2', jour: '2026-10-02', le: '2026-10-02T07:00:00.000Z', kg: 79 }),
    // Trou de plusieurs jours : rien n'est inventé entre les deux.
    pesee({ id: '3', jour: '2026-10-09', le: '2026-10-09T07:00:00.000Z', kg: 78 }),
  ]);
  v('un point par jour pesé, pas un par jour', serie.length, 3);
  v('le premier point est sa propre moyenne', serie[0].moyenne, 80);
  v('le deuxième moyenne deux points', serie[1].moyenne, 79.5);
  v('et il le dit', serie[1].points, 2);
  /*
     Le 9 octobre : la fenêtre de sept jours remonte au 3, et les pesées du 1er
     et du 2 en sont sorties. La moyenne vaut donc le seul point présent — pas
     une interpolation des jours manquants.
  */
  v('le troisième est seul dans sa fenêtre', serie[2].moyenne, 78);
  v('et il le dit aussi', serie[2].points, 1);
}

/* ══════════════════════════════════════════════════════════════════════════
   La santé, et ce qu'elle dit à Sport
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLA SANTÉ PARLE À SPORT\x1b[0m');

{
  const le12 = new Date('2026-10-12T12:00:00.000Z');
  v('un état ouvert est en cours', santeEnCours([sante()], le12).length, 1);
  v(
    'un état refermé avant ne l’est plus',
    santeEnCours([sante({ fin: '2026-10-11T12:00:00.000Z' })], le12).length,
    0,
  );
  v(
    'un état qui commence demain non plus',
    santeEnCours([sante({ debut: '2026-10-13T12:00:00.000Z' })], le12).length,
    0,
  );
  vrai('l’effort est empêché', effortEmpeche([sante()], le12).empeche);
  faux(
    'mais pas par un état qui ne le déclare pas',
    effortEmpeche([sante({ empecheEffort: false })], le12).empeche,
  );
  v('et la cause est nommée', effortEmpeche([sante()], le12).causes[0]?.intitule, 'Angine');
}
{
  const { faits } = projeterFaitsCorps({
    pesees: [], mesures: [], nuits: [], repas: [], boissons: [], sante: [sante()],
  });
  v('la santé est publiée ouverte', faits[0]?.details?.ouvert, true);
  v('avec l’empêchement, que la règle de désaccord lit', faits[0]?.details?.empecheEffort, true);
}

/* ══════════════════════════════════════════════════════════════════════════
   L'agrégat rend aux règles de quoi se déclencher
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’AGRÉGAT REND AUX RÈGLES DE QUOI SE DÉCLENCHER\x1b[0m');

const faitSport: Fait = {
  id: 'sport.seance:X',
  branche: 'sport',
  proprietaire: 'sport',
  domaine: 'corps',
  type: 'sport.seance',
  debut: '2026-10-12T17:00:00.000Z',
  fin: '2026-10-12T18:00:00.000Z',
  jourLogique: '2026-10-12',
  valeur: 3600,
  unite: 'secondes',
  source: 'manuel',
  fiabilite: 'confirme',
  version: 1,
  modifieLe: '2026-10-12T18:00:00.000Z',
};

{
  const corps = projeterFaitsCorps({
    pesees: [], mesures: [], nuits: [], repas: [], boissons: [], sante: [sante()],
  });

  /*
     Seul, le domaine Corps ne déclenche rien : la règle `effort-sous-sante`
     oppose **deux** branches, et c'est exactement pour cela qu'elle est restée
     muette tant que personne n'assemblait les publications.
  */
  v('la santé seule ne déclenche rien', detecter(corps.faits).length, 0);
  v('la séance seule non plus', detecter([faitSport]).length, 0);

  const ensemble = fusionner([corps, { faits: [faitSport], manques: [], refuses: [] }]);
  const desaccords = detecter(ensemble.faits);
  v('les deux ensemble, si', desaccords.length, 1);
  v('et la règle est nommée', desaccords[0]?.regle, 'effort-sous-sante');
  v('elle est une contradiction, pas un impossible', desaccords[0]?.gravite, 'contradiction');
}
{
  /*
     Le défaut que cet essai a trouvé : un fait porte **un** jour logique, et
     une maladie déclarée le 10 ne rencontrait jamais la séance du 12. La règle
     se taisait exactement comme si de rien n'était — le pire des silences.
  */
  const corps = projeterFaitsCorps({
    pesees: [], mesures: [], nuits: [], repas: [], boissons: [],
    sante: [sante({ debut: '2026-10-08T12:00:00.000Z' })],
  });
  v('la maladie est publiée au 8', corps.faits[0]?.jourLogique, '2026-10-08');
  const ensemble = fusionner([corps, { faits: [faitSport], manques: [], refuses: [] }]);
  const desaccords = detecter(ensemble.faits);
  v('elle rattrape pourtant la séance du 12', desaccords.length, 1);
  v('et le désaccord porte le jour de la séance', desaccords[0]?.jour, '2026-10-12');

  /* Refermée la veille, elle ne couvre plus le 12. */
  const refermee = projeterFaitsCorps({
    pesees: [], mesures: [], nuits: [], repas: [], boissons: [],
    sante: [sante({ debut: '2026-10-08T12:00:00.000Z', fin: '2026-10-11T12:00:00.000Z' })],
  });
  v(
    'une maladie refermée la veille ne couvre plus',
    detecter(fusionner([refermee, { faits: [faitSport], manques: [], refuses: [] }]).faits).length,
    0,
  );
}
{
  /*
     Et l'étalement reste **choisi** par la règle. Le sommeil somme par jour :
     étaler une nuit à cheval sur minuit la compterait deux fois, et un jour de
     huit heures de sommeil deviendrait un jour impossible de seize.
  */
  const corps = projeterFaitsCorps({
    pesees: [], mesures: [], nuits: [nuit()], repas: [], boissons: [], sante: [],
  });
  v('une nuit ordinaire ne crée aucun désaccord', detecter(corps.faits).length, 0);
}
{
  /* La fusion trie, et additionne les manques de même intitulé. */
  const a = {
    faits: [faitSport],
    manques: [{ quoi: 'Séances encore en cours', combien: 2, consequence: 'x' }],
    refuses: [],
  };
  const b = {
    faits: [{ ...faitSport, id: 'sport.seance:A', jourLogique: '2026-10-11' }],
    manques: [{ quoi: 'Séances encore en cours', combien: 3, consequence: 'x' }],
    refuses: [],
  };
  const ensemble = fusionner([a, b]);
  v('les faits sont triés par jour', ensemble.faits.map((f) => f.jourLogique), [
    '2026-10-11',
    '2026-10-12',
  ]);
  v('un seul manque, et il additionne', ensemble.manques.length, 1);
  v('cinq en tout', ensemble.manques[0].combien, 5);
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
