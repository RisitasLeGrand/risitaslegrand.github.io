/**
 * Santé, phase 1 : la forme, et le refus des valeurs non sourcées.
 *
 * Deux essais comptent plus que les autres, et ce sont ceux qui **font
 * échouer** quelque chose : une valeur déclarée connue sans source est
 * refusée, et une valeur inconnue sans motif l'est aussi. Le reste du module
 * range des objets ; ces deux-là sont la raison d'être du type
 * « ValeurSourcee », et un contrôle qu'on n'a pas vu refuser ne prouve rien.
 */
import {
  afficher,
  controlerCondition,
  controlerFiche,
  controlerPrelevement,
  controlerResultat,
  controlerSymptome,
  controlerTraitement,
  heuresDepuisLaDernierePrise,
  inconnue,
  situerDansLIntervalle,
  sourcee,
  traitementEnCours,
  CATALOGUE,
  type FicheMolecule,
  type Resultat,
  type Source,
  type Traitement,
} from '../src/lib/odyssee/sante';
import { populationNonLue } from '../src/lib/noyau/population';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  ✓ ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  ✗ ${intitule}\n      attendu ${b}\n      obtenu  ${a}`);
};
const vrai = (t: string, c: boolean) => v(t, c, true);
const faux = (t: string, c: boolean) => v(t, c, false);

const SOURCE: Source = {
  nom: 'RCP',
  ou: 'https://exemple.test/rcp',
  le: '2026-10-13',
  populationVisee: populationNonLue('fixture d’essai : aucune population à lire.'),
};

console.log('\nLA VALEUR SOURCÉE, OU PAS');

v('une valeur sourcée s’affiche avec sa source', afficher(sourcee('5 j', SOURCE), (x) => x), {
  texte: '5 j',
  bandeau: false,
  precision: 'RCP, consulté le 2026-10-13',
});
v(
  'une valeur inconnue s’affiche « inconnue », avec son bandeau et son motif',
  afficher(inconnue('aucune source primaire atteignable'), String),
  { texte: 'inconnue', bandeau: true, precision: 'aucune source primaire atteignable' },
);

console.log('\nCE QUI EST LIVRÉ PASSE SES PROPRES CONTRÔLES');

/*
   L'ESSAI DISAIT « AUCUNE FICHE N'EST LIVRÉE ». CE N'EST PLUS VRAI.

   Il constatait, à la date où il a été écrit, que le catalogue était vide, et
   c'était alors le livrable : les contrôles étaient en place avant le
   contenu. Cinq fiches sont arrivées depuis, et la constatation est devenue
   une exigence de ne rien livrer — l'inverse de ce qu'elle voulait dire.

   Ce qui la remplace est plus fort que ce qu'elle gardait : chaque fiche
   livrée passe `controlerFiche`, un par un, et le contrôle refuse de juger si
   le catalogue revient vide — un catalogue vidé par accident ne doit pas
   faire passer cet essai au vert en silence.
*/
vrai('le catalogue livre des fiches', CATALOGUE.length > 0);
for (const livree of CATALOGUE) {
  v(`« ${livree.nom} » passe les contrôles`, controlerFiche(livree), []);
}

const fiche = (par: Partial<FicheMolecule> = {}): FicheMolecule => ({
  id: 'x',
  nom: 'Exemple',
  synonymes: [],
  demiVie: inconnue('pas de RCP au dossier'),
  maturite: inconnue('pas de RCP au dossier'),
  donneesHumaines: inconnue('pas de publication primaire'),
  antidopage: inconnue('liste non consultée'),
  ...par,
});

v('une fiche entièrement inconnue est valide', controlerFiche(fiche()), []);

/*
   Le contrôle qui mord. Une valeur « connue » sans source est inconstructible
   en TypeScript, mais une fiche peut venir d'un JSON que le compilateur n'a
   jamais vu : c'est le seul endroit où le refus peut avoir lieu.
*/
v(
  'une demi-vie connue sans source est refusée',
  controlerFiche(
    fiche({
      demiVie: {
        connue: true,
        valeur: '5 j',
        source: { nom: '', ou: '', le: '', populationVisee: populationNonLue('') },
      },
    }),
  ),
  ['La demi-vie de « Exemple » se dit connue sans dire d’où elle vient.'],
);
v(
  'et une valeur inconnue sans motif aussi',
  controlerFiche(fiche({ maturite: { connue: false, pourquoi: '  ' } })),
  ['La maturité de « Exemple » est inconnue sans dire pourquoi.'],
);

console.log('\nLES TRAITEMENTS');

const traitement = (par: Partial<Traitement> = {}): Traitement => ({
  id: 't1',
  nom: 'Exemple',
  moleculeId: null,
  origine: 'moi',
  prescripteur: '',
  posologie: '1 le matin',
  debut: '2026-01-10',
  fin: '',
  note: '',
  majLe: '2026-01-10T08:00:00.000Z',
  ...par,
});

v('un traitement bien formé passe', controlerTraitement(traitement()), []);
v('un traitement sans nom est refusé', controlerTraitement(traitement({ nom: ' ' })), [
  'Un traitement a besoin d’un nom.',
]);
v(
  'un traitement qui finit avant de commencer est refusé',
  controlerTraitement(traitement({ fin: '2026-01-01' })),
  ['Un traitement ne finit pas avant de commencer.'],
);

vrai('un traitement sans fin court toujours', traitementEnCours(traitement(), '2027-05-01'));
faux('mais pas avant son début', traitementEnCours(traitement(), '2026-01-09'));
faux(
  'et plus après sa fin',
  traitementEnCours(traitement({ fin: '2026-02-01' }), '2026-02-02'),
);

console.log('\nLES PRÉLÈVEMENTS ET LEURS RÉSULTATS');

v(
  'un prélèvement sans jour est refusé',
  controlerPrelevement({
    id: 'p',
    jour: '',
    le: '',
    laboratoire: '',
    contexte: '',
    note: '',
    majLe: '',
  }),
  ['Un prélèvement appartient à un jour.'],
);

const resultat = (par: Partial<Resultat> = {}): Resultat => ({
  id: 'r',
  prelevementId: 'p',
  analyte: 'Testostérone totale',
  valeur: 18,
  unite: 'nmol/L',
  intervalleBas: 8,
  intervalleHaut: 30,
  note: '',
  majLe: '',
  ...par,
});

v('un résultat bien formé passe', controlerResultat(resultat()), []);
v('un résultat sans unité est refusé', controlerResultat(resultat({ unite: ' ' })), [
  'Un résultat sans unité ne veut rien dire.',
]);
v(
  'un intervalle à l’envers est refusé',
  controlerResultat(resultat({ intervalleBas: 30, intervalleHaut: 8 })),
  ['L’intervalle du laboratoire est à l’envers.'],
);

v('dans l’intervalle', situerDansLIntervalle(resultat()), 'dans');
v('sous l’intervalle', situerDansLIntervalle(resultat({ valeur: 4 })), 'sous');
v('au-dessus', situerDansLIntervalle(resultat({ valeur: 44 })), 'au-dessus');
/*
   Le cas qui compte : sans les deux bornes du laboratoire, « dans la norme »
   n'a pas de sens, et l'inventer serait un avis rendu sur rien.
*/
v(
  'sans borne haute, on ne situe rien',
  situerDansLIntervalle(resultat({ intervalleHaut: null })),
  null,
);

console.log('\nSYMPTÔMES ET CONDITIONS');

v(
  'une intensité hors de 0–10 est refusée',
  controlerSymptome({ id: 's', jour: '2026-03-01', intitule: 'Fatigue', intensite: 11, note: '', majLe: '' }),
  ['L’intensité déclarée va de 0 à 10.'],
);
v(
  'une intensité non entière aussi',
  controlerSymptome({ id: 's', jour: '2026-03-01', intitule: 'Fatigue', intensite: 4.5, note: '', majLe: '' }),
  ['L’intensité déclarée va de 0 à 10.'],
);
v(
  'une condition sans intitulé est refusée',
  controlerCondition({ id: 'c', intitule: '', debut: '2026-01-01', fin: '', note: '', majLe: '' }),
  ['Une condition a besoin d’un intitulé.'],
);

console.log('\nLE DÉLAI DEPUIS LA DERNIÈRE PRISE');

const prises = [
  { traitementId: 't1', le: '2026-03-01T08:00:00.000Z' },
  { traitementId: 't1', le: '2026-03-03T08:00:00.000Z' },
  { traitementId: 't2', le: '2026-03-05T08:00:00.000Z' },
  { traitementId: null, le: '2026-03-06T08:00:00.000Z' },
];

v(
  'il compte depuis la plus récente du bon traitement',
  heuresDepuisLaDernierePrise(prises, 't1', '2026-03-04T08:00:00.000Z'),
  24,
);
/*
   « Aucune prise » et « zéro heure » sont deux réponses différentes, et
   rendre 0 dirait la seconde à la place de la première. C'est à l'écran de
   dire « aucune prise enregistrée », et il ne peut le faire que si le calcul
   le distingue.
*/
v(
  'aucune prise rend null, et non zéro',
  heuresDepuisLaDernierePrise(prises, 't3', '2026-03-04T08:00:00.000Z'),
  null,
);
v(
  'une prise sans traitement n’est comptée pour aucun',
  heuresDepuisLaDernierePrise(prises, '', '2026-03-07T08:00:00.000Z'),
  null,
);

console.log(
  echecs === 0 ? '\nTous les essais de santé passent.\n' : `\n${echecs} échec(s).\n`,
);
process.exit(echecs === 0 ? 0 : 1);
