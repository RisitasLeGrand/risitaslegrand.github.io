/**
 * Santé, phase 4 : le schéma prévu, ses créneaux, et le jour où l'heure change.
 *
 * Trois essais portent ce fichier, et ce sont ceux qui **refusent** quelque
 * chose : un traitement sans schéma ne produit rien, une prise sporadique
 * n'en produit jamais, et le 25 octobre ne fabrique ni créneau en double ni
 * créneau manquant. Les deux premiers gardent une décision ; le troisième
 * garde un calcul que personne ne relit deux fois par an.
 *
 * Rien ici n'invente de calendrier : `creneauxDuJour` s'appuie sur
 * `repetition.ts` et sur `jour-logique.ts`, déjà éprouvés. Ce que ces essais
 * mesurent, c'est que l'emprunt est correct — pas que l'arithmétique l'est.
 */
import {
  controlerSchema,
  controlerTraitement,
  creneauxDuJour,
  rangerLesHeures,
  serieDuSchema,
  type SchemaDePrise,
  type Traitement,
} from '../src/lib/odyssee/sante';

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

/** Un traitement ordinaire, en cours depuis le 1ᵉʳ octobre et sans fin. */
const traitement = (modifications: Partial<Traitement> = {}): Traitement => ({
  id: 't1',
  nom: 'Créatine',
  moleculeId: null,
  origine: 'moi',
  prescripteur: '',
  posologie: '',
  sporadique: false,
  schema: null,
  debut: '2026-10-01',
  fin: '',
  note: '',
  majLe: '2026-10-01T00:00:00.000Z',
  ...modifications,
});

const quotidien = (heures: string[]): SchemaDePrise => ({
  repetition: { type: 'jours', tous: 1 },
  heures,
  quantite: '5 g',
});

/** Les heures d'une liste de créneaux : ce qu'on compare le plus souvent. */
const heuresDe = (t: Traitement, jour: string) => creneauxDuJour(t, jour).map((c) => c.heure);
/** Les instants, en ISO : c'est là que le changement d'heure se voit. */
const instantsDe = (t: Traitement, jour: string) =>
  creneauxDuJour(t, jour).map((c) => c.instant.toISOString());

console.log('\nUN TRAITEMENT SANS SCHÉMA NE CHANGE PAS');

/*
   C'est l'essai de non-régression du lot entier : la phase 1 ne connaissait
   pas les créneaux, et tout ce qu'elle a rangé doit continuer de se lire
   comme avant. Les deux formes d'absence sont éprouvées — le champ à `null`,
   qu'écrit la couche de données, et le champ absent, que portent les
   enregistrements scellés avant ce lot.
*/
v('un schéma à null ne produit aucun créneau', heuresDe(traitement(), '2026-10-19'), []);
const avantLeLot = traitement();
delete (avantLeLot as { schema?: unknown }).schema;
v('un champ absent non plus', heuresDe(avantLeLot, '2026-10-19'), []);
v('et le traitement reste valide', controlerTraitement(avantLeLot), []);

console.log('\nJAMAIS POUR UNE PRISE SPORADIQUE');

/*
   Décision 12, reprise mot pour mot par l'interdit du § 1 : « pas de fin,
   pas de schéma, pas de rappel ». Le refus est éprouvé DEUX fois, au calcul
   et au contrôle, parce qu'ils gardent deux portes différentes : le contrôle
   garde le formulaire, le calcul garde ce qui entre par un import ou par une
   synchronisation.
*/
const sporadique = traitement({ sporadique: true, schema: quotidien(['08:00']) });
v('aucun créneau, même avec un schéma posé', heuresDe(sporadique, '2026-10-19'), []);
v(
  'et le contrôle refuse l’objet lui-même',
  controlerTraitement(sporadique),
  ['Une prise sporadique n’a pas de schéma prévu : elle est isolée.'],
);

console.log('\nLES TROIS FORMES DE RÈGLE');

v(
  'tous les jours : le créneau est là chaque jour',
  [
    heuresDe(traitement({ schema: quotidien(['08:00']) }), '2026-10-19'),
    heuresDe(traitement({ schema: quotidien(['08:00']) }), '2026-10-20'),
  ],
  [['08:00'], ['08:00']],
);

v(
  'plusieurs heures, rendues triées',
  heuresDe(traitement({ schema: quotidien(['20:00', '08:00']) }), '2026-10-19'),
  ['08:00', '20:00'],
);

{
  /*
     Tous les trois jours depuis le 1ᵉʳ octobre : le 19 est à dix-huit jours
     du départ, donc une occurrence ; le 20 et le 21 n'en sont pas ; le 22 en
     est une. Ce qu'on mesure est que la règle SAUTE des jours — une règle de
     trois jours qui tomberait tous les jours passerait les deux bornes et
     serait pourtant fausse.
  */
  const tousLesTrois = traitement({
    schema: { repetition: { type: 'jours', tous: 3 }, heures: ['08:00'], quantite: '' },
  });
  v(
    'tous les N jours : le 19 et le 22 suivent la règle, le 20 et le 21 non',
    ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((j) =>
      heuresDe(tousLesTrois, j),
    ),
    [['08:00'], [], [], ['08:00']],
  );
}

{
  /* Lundi (1) et jeudi (4). Le 19 octobre 2026 est un lundi, le 20 un mardi. */
  const lundiJeudi = traitement({
    schema: {
      repetition: { type: 'semaines', tous: 1, jours: [1, 4] },
      heures: ['08:00'],
      quantite: '',
    },
  });
  v('certains jours de la semaine : lundi, oui', heuresDe(lundiJeudi, '2026-10-19'), ['08:00']);
  v('mardi, non', heuresDe(lundiJeudi, '2026-10-20'), []);
  v('jeudi, oui', heuresDe(lundiJeudi, '2026-10-22'), ['08:00']);
}

console.log('\nLA PÉRIODE DU TRAITEMENT EST LA FIN DE LA SÉRIE');

{
  const fini = traitement({ schema: quotidien(['08:00']), debut: '2026-10-01', fin: '2026-10-18' });
  v('rien avant le début', heuresDe(fini, '2026-09-30'), []);
  v('le dernier jour est inclus', heuresDe(fini, '2026-10-18'), ['08:00']);
  v('rien après la fin', heuresDe(fini, '2026-10-19'), []);
  v(
    'et la série traduite porte bien cette fin',
    serieDuSchema(fini, quotidien(['08:00'])).fin,
    { type: 'date', jusquAu: '2026-10-18' },
  );
}

console.log('\nLE 25 OCTOBRE — NI CRÉNEAU EN DOUBLE, NI CRÉNEAU MANQUANT');

/*
   Le dernier dimanche d'octobre, l'heure de 2 h est rejouée : 02 h 30 existe
   deux fois, et une journée dure 25 heures. C'est le jour où un calcul naïf
   fabrique une prise ou en perd une.

   Ce qu'on vérifie n'est pas que l'arithmétique des fuseaux est juste —
   `jour-logique.ts` a ses propres essais pour cela — mais que l'heure
   MURALE tient : 8 h reste 8 h des deux côtés du changement, et l'instant
   bouge d'une heure en UTC, ce qui est exactement le signe que la bascule a
   été prise en compte. Un rappel qui sonnerait à 9 h à partir du 25 serait
   le défaut que cet essai existe pour attraper.
*/
{
  const t = traitement({ schema: quotidien(['08:00']) });
  for (const jour of ['2026-10-24', '2026-10-25', '2026-10-26']) {
    v(`le ${jour} porte un seul créneau, à 8 h`, heuresDe(t, jour), ['08:00']);
  }
  v(
    'et l’instant suit la bascule : UTC+2 la veille, UTC+1 le jour même',
    [
      instantsDe(t, '2026-10-24'),
      instantsDe(t, '2026-10-25'),
      instantsDe(t, '2026-10-26'),
    ],
    [
      ['2026-10-24T06:00:00.000Z'],
      ['2026-10-25T07:00:00.000Z'],
      ['2026-10-26T07:00:00.000Z'],
    ],
  );
}

console.log('\nLE JOUR LOGIQUE — UNE PRISE DE 0 H 30 COMPTE POUR LA VEILLE');

/*
   La journée de Cyclades bascule à 4 h. Une prise prévue à 00 h 30 appartient
   donc au jour logique de la VEILLE, et son instant tombe le lendemain du
   calendrier. C'est la même règle que le sommeil, et elle est empruntée à
   `instantDeLOccurrence` plutôt que refaite.
*/
{
  const nuit = traitement({ schema: quotidien(['00:30']) });
  v(
    'le créneau du jour logique du 19 tombe le 20 au calendrier',
    instantsDe(nuit, '2026-10-19'),
    ['2026-10-19T22:30:00.000Z'],
  );
  /*
     Et le 24 octobre, jour logique : 00 h 30 tombe le 25 au calendrier,
     AVANT le changement d'heure de 3 h. L'heure n'est donc pas celle qui est
     rejouée, et il n'y a qu'un instant possible.
  */
  v(
    'le 24, la nuit de la bascule, il n’y en a toujours qu’un',
    instantsDe(nuit, '2026-10-24'),
    ['2026-10-24T22:30:00.000Z'],
  );
}

{
  /*
     02 h 30 le 25 octobre : l'heure qui existe DEUX fois. `instantLocal`
     rend la PREMIÈRE occurrence, et c'est la seule valeur qui garde
     l'invariant « chaque instant tombe dans les bornes de son jour ». Un
     créneau, pas deux — sinon la personne recevrait deux rappels pour une
     prise, une fois par an, sans jamais comprendre pourquoi.
  */
  const creux = traitement({ schema: quotidien(['02:30']) });
  v(
    'l’heure rejouée du 25 octobre ne donne qu’un créneau, à sa première occurrence',
    instantsDe(creux, '2026-10-24'),
    ['2026-10-25T00:30:00.000Z'],
  );
}

console.log('\nLES CONTRÔLES REFUSENT');

v(
  'une heure qui n’en est pas',
  controlerSchema({ repetition: { type: 'jours', tous: 1 }, heures: ['25:00'], quantite: '' }),
  ['« 25:00 » n’est pas une heure.'],
);
v(
  'un schéma sans aucune heure',
  controlerSchema({ repetition: { type: 'jours', tous: 1 }, heures: [], quantite: '' }),
  ['Un schéma prévu porte au moins une heure.'],
);
v(
  'la même heure deux fois',
  controlerSchema({
    repetition: { type: 'jours', tous: 1 },
    heures: ['08:00', '08:00'],
    quantite: '',
  }),
  ['Une même heure ne peut pas être prévue deux fois le même jour.'],
);
v(
  'une répétition de zéro jour',
  controlerSchema({ repetition: { type: 'jours', tous: 0 }, heures: ['08:00'], quantite: '' }),
  ['Une répétition se compte en nombres entiers, à partir de un.'],
);
v(
  'un schéma par semaine qui ne nomme aucun jour',
  controlerSchema({
    repetition: { type: 'semaines', tous: 1, jours: [] },
    heures: ['08:00'],
    quantite: '',
  }),
  ['Un schéma par semaine nomme au moins un jour.'],
);
v('les heures se rangent, et le doublon tombe', rangerLesHeures(['20:00', '08:00', '20:00']), [
  '08:00',
  '20:00',
]);

console.log(
  echecs === 0
    ? '\nTous les essais des rappels de prise passent.\n'
    : `\n${echecs} en échec.\n`,
);
process.exit(echecs === 0 ? 0 : 1);
