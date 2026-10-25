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
  controlerMarque,
  controlerReglage,
  controlerSchema,
  controlerTraitement,
  creneauxDuJour,
  etatDuCreneau,
  idDuCreneau,
  libelleDuRappel,
  reglageParDefaut,
  rangerLesHeures,
  serieDuSchema,
  type CreneauPrevu,
  type MarqueDeCreneau,
  type NiveauDeLibelle,
  type ReglageDeRappel,
  type SchemaDePrise,
  type Traitement,
} from '../src/lib/odyssee/sante';
import { idDeLaPriseDuCreneau } from '../src/lib/odyssee/donnees-sante';
import {
  controlerLExportDesRappels,
  rappelsEnIcs,
} from '../src/lib/odyssee/rappels-ics';
import { creneauxOublies, texteDuRappelDOubli } from '../src/lib/odyssee/rappels';
import { MAGASINS_SCELLES } from '../src/lib/noyau/coffre';
import { CHAMP_DATE } from '../src/lib/sauvegarde/groupes';
import { DECOUPAGES_DE_MODULE } from '../src/lib/sauvegarde/effacement';

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

console.log('\nCE QUI EST NOTÉ D’UN CRÉNEAU');

const creneau = (heure = '08:00'): CreneauPrevu => ({
  traitementId: 't1',
  jour: '2026-10-19',
  heure,
  instant: new Date('2026-10-19T06:00:00.000Z'),
});

const marque = (modifications: Partial<MarqueDeCreneau> = {}): MarqueDeCreneau => ({
  id: 'a'.repeat(32),
  traitementId: 't1',
  jour: '2026-10-19',
  heure: '08:00',
  etat: 'pris',
  priseId: 'creneau-' + 'a'.repeat(32),
  le: '2026-10-19T06:12:00.000Z',
  majLe: '2026-10-19T06:12:00.000Z',
  ...modifications,
});

/*
   « Prévu » est l'ABSENCE de marque, et c'est tout le mécanisme : le rappel
   d'oubli lira ce silence, et il ne le lirait pas si un état « en attente »
   était rangé en base.
*/
v('rien de noté : le créneau est prévu', etatDuCreneau(creneau(), []), { etat: 'prevu' });
v(
  'noté : l’heure rendue est l’heure RÉELLE, pas l’heure prévue',
  etatDuCreneau(creneau(), [marque()]),
  { etat: 'pris', le: '2026-10-19T06:12:00.000Z' },
);
v(
  '« pas aujourd’hui » ne rend aucune heure, et aucun jugement',
  etatDuCreneau(creneau(), [marque({ etat: 'pas-aujourdhui', priseId: null })]),
  { etat: 'pas-aujourdhui' },
);
/*
   Deux créneaux le même jour sont deux objets distincts : marquer celui de
   8 h ne marque pas celui de 20 h. Sans cela, « matin et soir » se noterait
   d'un seul appui, ce qui écrirait une prise qui n'a pas eu lieu.
*/
v(
  'la marque de 8 h ne répond pas pour celle de 20 h',
  etatDuCreneau(creneau('20:00'), [marque()]),
  { etat: 'prevu' },
);

console.log('\nL’IDENTIFIANT D’UN CRÉNEAU EST UNE EMPREINTE');

{
  const a = await idDuCreneau('t1', '2026-10-19', '08:00');
  const b = await idDuCreneau('t1', '2026-10-19', '08:00');
  const autre = await idDuCreneau('t1', '2026-10-19', '20:00');
  v('deux appels sur le même créneau donnent la même clé', a === b, true);
  v('et deux créneaux différents, deux clés', a === autre, false);
  v('la forme est celle qu’exige le contrôle', /^[0-9a-f]{32}$/.test(a), true);
  /*
     LE POINT QUI COMPTE. Les clés restent en clair dans la base — c'est par
     elles qu'on retrouve un enregistrement sans l'ouvrir. Une clé lisible
     dirait « tous les jours à 8 h pour ce traitement » sans aucune clé de
     coffre, et le traitement, lui, est scellé. L'empreinte ne dit rien.
  */
  /*
     On cherche le traitement et le jour, et non l'heure : « 08 » tomberait
     par hasard dans trente-deux signes hexadécimaux une fois sur huit, et un
     essai qui rougit une fois sur huit se fait désactiver. Les deux chaînes
     cherchées ici, elles, ne peuvent pas apparaître par accident — et ce
     sont les deux qui diraient le rythme.
  */
  v(
    'elle ne porte ni le traitement, ni le jour',
    [a.includes('t1'), a.includes('2026-10-19')],
    [false, false],
  );
  v(
    'la prise créée dérive du créneau, donc un second appui écrase au lieu d’empiler',
    idDeLaPriseDuCreneau(a) === idDeLaPriseDuCreneau(b),
    true,
  );
}

console.log('\nLE MAGASIN DES CRÉNEAUX EST SCELLÉ, ET SA CLÉ EST MUETTE');

/*
   Lu dans la déclaration elle-même, et non dans une sonde textuelle : c'est
   `MAGASINS_SCELLES` qui fait foi pour `sceller()`, donc c'est lui qu'il faut
   interroger. Si quelqu'un ajoutait `jour` aux champs clairs pour se donner
   un index, le rythme des prises redeviendrait lisible sans le coffre — et
   cet essai rougirait.

   LA DEMANDE A MONTÉ LE 19 OCTOBRE, ELLE N'A PAS BAISSÉ. L'essai attendait
   `['id', 'majLe']` et il était vert ; `majLe` est pourtant une date
   d'écriture, et une suite de dates d'écriture en clair dessine le rythme
   des prises — « une ligne chaque matin » — c'est-à-dire exactement ce que
   la clé opaque cache. Il n'attend plus que la clé, et il nomme en plus les
   champs qui ne doivent JAMAIS y être : la liste littérale dit l'état,
   l'exclusion dit la règle, et une liste qui s'allongerait un jour sans
   qu'on y pense se heurterait à la seconde.
*/
{
  const declaration = MAGASINS_SCELLES.find((m) => m.magasin === 'odysseeCreneaux');
  v('le magasin est déclaré scellé', Boolean(declaration), true);
  v('et ne laisse en clair que la clé', declaration?.clairs, ['id']);
  for (const champ of ['jour', 'heure', 'le', 'majLe', 'traitementId', 'etat'] as const) {
    v(`« ${champ} » n’est pas en clair`, declaration?.clairs.includes(champ), false);
  }
  /*
     Et le corollaire, qui est la moitié oubliée : un champ qui n'est plus en
     clair ne peut plus servir à découper une période. Les deux tables sont
     liées, et c'est leur désaccord qui rendait l'effacement muet.
  */
  v('le magasin ne se découpe donc pas par date en clair', CHAMP_DATE.odysseeCreneaux, null);
  v(
    'et son découpage par période vit dans son module',
    Object.keys(DECOUPAGES_DE_MODULE).includes('odysseeCreneaux'),
    true,
  );
}

console.log('\nLES CONTRÔLES D’UNE MARQUE REFUSENT');

v(
  'une clé qui n’est pas une empreinte',
  controlerMarque(marque({ id: 't1/2026-10-19/08:00' })),
  ['L’identifiant d’un créneau est une empreinte de 32 signes.'],
);
v(
  '« pas aujourd’hui » qui porterait une prise',
  controlerMarque(marque({ etat: 'pas-aujourdhui' })),
  ['« Pas aujourd’hui » ne crée aucune prise.'],
);
v('une marque bien formée passe', controlerMarque(marque()), []);

console.log('\nL’EXPORT VERS L’AGENDA — RRULE, VALARM, FUSEAU');

/*
   Le garde-fou d'abord : il est construit sur un traitement qui FUIRAIT si
   rien ne l'en empêchait — nommé, prescrit, avec sa posologie, sa note et sa
   quantité. En libellé neutre, qui est le défaut, rien de tout cela ne doit
   sortir du fichier.
*/
v('le garde-fou de l’export ne trouve rien à redire', controlerLExportDesRappels(), []);

const avecRappel = (
  schema: SchemaDePrise,
  rappel: Partial<ReglageDeRappel> = {},
  autres: Partial<Traitement> = {},
): Traitement =>
  traitement({ schema, rappel: { ...reglageParDefaut(), actif: true, ...rappel }, ...autres });

{
  const fichier = rappelsEnIcs([avecRappel(quotidien(['08:00']))], new Date('2026-10-19T10:00:00Z'));
  const lignes = fichier.split('\r\n');
  const a = (prefixe: string) => lignes.filter((l) => l.startsWith(prefixe));

  v('une seule heure prévue, un seul événement', a('BEGIN:VEVENT').length, 1);
  v('l’heure murale est écrite avec son fuseau', a('DTSTART;TZID='), [
    'DTSTART;TZID=Europe/Paris:20261001T080000',
  ]);
  v('la règle est quotidienne et sans fin', a('RRULE:FREQ=DAILY'), ['RRULE:FREQ=DAILY']);
  v('l’alarme est posée à l’heure même', a('TRIGGER:'), ['TRIGGER:PT0S']);
  v('et le libellé par défaut ne nomme rien', a('SUMMARY:'), ['SUMMARY:Rappel Cyclades']);
  /*
     LE POINT DU 25 OCTOBRE. Un RRULE quotidien posé sur un DTSTART en UTC
     garderait l'heure UTC, donc décalerait l'heure murale d'une heure au
     passage à l'heure d'hiver : un rappel de 8 h sonnerait à 9 h à partir du
     25, tous les jours, sans que rien ne le dise. Le TZID et son VTIMEZONE
     sont la seule parade, et ce sont les deux lignes qu'on vérifie.
  */
  v('le fuseau est décrit dans le fichier, et non laissé à deviner', a('TZID:Europe/Paris'), [
    'TZID:Europe/Paris',
  ]);
  v(
    'avec les deux bascules de la règle européenne',
    [fichier.includes('BYMONTH=3;BYDAY=-1SU'), fichier.includes('BYMONTH=10;BYDAY=-1SU')],
    [true, true],
  );
  v('le fichier finit par un CRLF', fichier.endsWith('\r\n'), true);
}

{
  /* Deux heures : deux événements, et deux UID distincts. */
  const fichier = rappelsEnIcs(
    [avecRappel(quotidien(['08:00', '20:00']))],
    new Date('2026-10-19T10:00:00Z'),
  );
  const uid = fichier.split('\r\n').filter((l) => l.startsWith('UID:'));
  v('deux heures prévues, deux événements', uid.length, 2);
  v('et deux identités distinctes, stables au réexport', new Set(uid).size, 2);
  /*
     L'UID dérive du traitement et de l'heure : réexporter met à jour au lieu
     d'empiler. On le vérifie en réexportant à un autre instant — seul le
     DTSTAMP doit changer.
     */
  const plusTard = rappelsEnIcs(
    [avecRappel(quotidien(['08:00', '20:00']))],
    new Date('2026-11-02T10:00:00Z'),
  );
  v('les identités survivent à un réexport', plusTard.split('\r\n').filter((l) => l.startsWith('UID:')), uid);
}

{
  /* Lundi et jeudi, toutes les deux semaines, et un traitement qui finit. */
  const fichier = rappelsEnIcs(
    [
      avecRappel(
        {
          repetition: { type: 'semaines', tous: 2, jours: [4, 1] },
          heures: ['08:00'],
          quantite: '',
        },
        {},
        { fin: '2026-12-31' },
      ),
    ],
    new Date('2026-10-19T10:00:00Z'),
  );
  /*
     On filtre sur « FREQ=WEEKLY » et non sur « RRULE: » nu : le VTIMEZONE
     porte lui-même deux règles de récurrence — les deux bascules annuelles
     de l'heure d'été —, et les ramasser ici mêlerait la description du
     fuseau à celle du schéma.
  */
  v(
    'les jours de la semaine sont rendus dans l’ordre de la norme',
    fichier.split('\r\n').filter((l) => l.startsWith('RRULE:FREQ=WEEKLY')),
    ['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20261231T235959Z'],
  );
  /*
     Le traitement commence le jeudi 1ᵉʳ octobre 2026. DTSTART doit être une
     OCCURRENCE : posé sur un jour qui n'en est pas un, certains agendas y
     ajoutent une prise que personne n'a prévue.
  */
  v(
    'et le départ tombe sur une occurrence',
    fichier.split('\r\n').filter((l) => l.startsWith('DTSTART;TZID=')),
    ['DTSTART;TZID=Europe/Paris:20261001T080000'],
  );
}

console.log('\nCE QUE L’EXPORT REFUSE D’ÉCRIRE');

v(
  'un rappel non demandé n’engendre rien',
  rappelsEnIcs([traitement({ schema: quotidien(['08:00']) })], new Date('2026-10-19T10:00:00Z')),
  '',
);
v(
  'un rappel sans schéma non plus',
  rappelsEnIcs([traitement({ rappel: { ...reglageParDefaut(), actif: true } })], new Date()),
  '',
);
/*
   JAMAIS POUR UNE PRISE SPORADIQUE — interdit § 1, et décision 12. Le refus
   est au calcul de l'export, en plus de celui du schéma : un enregistrement
   venu d'une synchronisation plus ancienne pourrait porter les deux.
*/
v(
  'jamais pour une prise sporadique, même réglée pour sonner',
  rappelsEnIcs(
    [avecRappel(quotidien(['08:00']), {}, { sporadique: true })],
    new Date('2026-10-19T10:00:00Z'),
  ),
  '',
);

{
  /*
     Un fuseau que ce module n'a pas vérifié fait REFUSER l'export, avec son
     nom. Les règles d'heure d'été se changent par décision politique : en
     inventer produirait des rappels faux d'une heure pendant six mois, et
     une heure fausse ne se voit pas, là où un refus se lit.
  */
  let refus = '';
  try {
    rappelsEnIcs([avecRappel(quotidien(['08:00']))], new Date(), 'America/New_York');
  } catch (e) {
    refus = e instanceof Error ? e.name : 'autre';
  }
  v('un fuseau non décrit est refusé, et nommé', refus, 'FuseauNonDecrit');
}

console.log('\nLES TROIS NIVEAUX DE LIBELLÉ (§ 3.3 DU PLAN)');

const titreDe = (t: Traitement) =>
  rappelsEnIcs([t], new Date('2026-10-19T10:00:00Z'))
    .split('\r\n')
    .filter((l) => l.startsWith('SUMMARY:'));

v('neutre, par défaut', titreDe(avecRappel(quotidien(['08:00']))), ['SUMMARY:Rappel Cyclades']);
v(
  'explicite, quand la personne le choisit',
  titreDe(avecRappel(quotidien(['08:00']), { libelle: 'explicite' })),
  ['SUMMARY:Créatine'],
);
v(
  'personnalisé, dans ses mots',
  titreDe(avecRappel(quotidien(['08:00']), { libelle: 'personnalise', texte: 'Le pot vert' })),
  ['SUMMARY:Le pot vert'],
);
/*
   LE REPLI EST TOUJOURS LE NEUTRE, et jamais le nom. Un niveau inconnu —
   venu d'un enregistrement plus récent qu'une version installée — ne doit
   pas révéler un traitement par accident. Quand on ne sait pas, on se tait.
*/
v(
  'un niveau inconnu retombe sur le neutre, jamais sur le nom',
  libelleDuRappel(
    avecRappel(quotidien(['08:00']), { libelle: 'inconnu' as NiveauDeLibelle }),
  ),
  'Rappel Cyclades',
);
v(
  'et un libellé personnalisé vide aussi',
  libelleDuRappel(avecRappel(quotidien(['08:00']), { libelle: 'personnalise', texte: '   ' })),
  'Rappel Cyclades',
);

console.log('\nLES CONTRÔLES DU RÉGLAGE REFUSENT');

v(
  'un libellé personnalisé sans texte',
  controlerReglage({ ...reglageParDefaut(), libelle: 'personnalise' }),
  ['Un libellé personnalisé a besoin de son texte.'],
);
v(
  'un délai d’oubli qui n’est pas proposé',
  controlerReglage({ ...reglageParDefaut(), delaiOubli: 17 }),
  ['Délai de rappel inconnu : 17 minutes.'],
);
v(
  'un rappel d’oubli sans rappel',
  controlerReglage({ ...reglageParDefaut(), oubli: true }),
  ['Un rappel d’oubli suppose un rappel : activez d’abord « Me rappeler ».'],
);
v(
  'un rappel actif sur un traitement sans schéma',
  controlerTraitement(traitement({ rappel: { ...reglageParDefaut(), actif: true } })),
  ['Un rappel a besoin d’un schéma prévu : il n’aurait aucune heure à rappeler.'],
);
/* Les deux défauts du prompt : tout est éteint tant qu'on ne demande rien. */
v('le réglage par défaut ne sonne pas', [reglageParDefaut().actif, reglageParDefaut().oubli], [
  false,
  false,
]);
v('et le délai d’oubli par défaut est de deux heures', reglageParDefaut().delaiOubli, 120);

console.log('\nLE RAPPEL D’OUBLI — IL PART UNE FOIS, APRÈS LE DÉLAI, ET JAMAIS SANS RAISON');

/*
   Tout est figé : le jour, l'heure prévue, l'instant d'observation. Un essai
   qui lirait l'horloge serait vert la nuit et rouge le matin, et on finirait
   par le croire capricieux plutôt que juste.

   Le 19 octobre 2026 est en heure d'été : 8 h murales valent 06:00 UTC.
*/
const JOUR = '2026-10-19';
const A_8H = '2026-10-19T06:00:00.000Z';
const apres = (minutes: number) => new Date(Date.parse(A_8H) + minutes * 60_000);

const quiSeRappelle = (modifications: Partial<ReglageDeRappel> = {}): Traitement =>
  traitement({
    schema: quotidien(['08:00']),
    rappel: { ...reglageParDefaut(), actif: true, oubli: true, ...modifications },
  });

const marqueDe = (heure: string, etat: 'pris' | 'pas-aujourdhui'): MarqueDeCreneau => ({
  id: 'b'.repeat(32),
  traitementId: 't1',
  jour: JOUR,
  heure,
  etat,
  priseId: etat === 'pris' ? 'creneau-' + 'b'.repeat(32) : null,
  le: A_8H,
  majLe: A_8H,
});

const refs = (...args: Parameters<typeof creneauxOublies>) =>
  creneauxOublies(...args).map((o) => o.ref);

{
  const t = quiSeRappelle();
  /* Le délai par défaut est de deux heures : rien avant, et à la minute. */
  v('rien à l’heure prévue', refs([t], [], apres(0), JOUR), []);
  v('rien après une heure', refs([t], [], apres(60), JOUR), []);
  v('rien une minute avant le délai', refs([t], [], apres(119), JOUR), []);
  v('et le rappel à deux heures pile', refs([t], [], apres(120), JOUR), ['t1|2026-10-19|08:00']);
  v('il tient après', refs([t], [], apres(300), JOUR), ['t1|2026-10-19|08:00']);
}

{
  /* Le délai est celui que la personne a choisi, pas celui de Cyclades. */
  const court = quiSeRappelle({ delaiOubli: 30 });
  v('un délai de trente minutes part à trente minutes', refs([court], [], apres(30), JOUR), [
    't1|2026-10-19|08:00',
  ]);
  const long = quiSeRappelle({ delaiOubli: 240 });
  v('et un délai de quatre heures ne part pas à trois', refs([long], [], apres(180), JOUR), []);
}

console.log('\nJAMAIS SI QUELQUE CHOSE EST NOTÉ');

{
  const t = quiSeRappelle();
  v('« Pris » éteint le rappel', refs([t], [marqueDe('08:00', 'pris')], apres(300), JOUR), []);
  /*
     « Pas aujourd'hui » l'éteint AUSSI, et c'est le point : c'est une
     réponse, pas une absence de réponse. Un rappel qui insisterait après
     elle serait exactement le reproche que l'interdit § 1 n° 3 refuse.
  */
  v(
    '« Pas aujourd’hui » l’éteint aussi',
    refs([t], [marqueDe('08:00', 'pas-aujourdhui')], apres(300), JOUR),
    [],
  );
  /* Une marque sur un AUTRE créneau ne répond pas pour celui-ci. */
  v(
    'une réponse donnée à 20 h ne vaut pas pour celle de 8 h',
    refs([t], [marqueDe('20:00', 'pris')], apres(300), JOUR),
    ['t1|2026-10-19|08:00'],
  );
}

console.log('\nJAMAIS SANS LE DEMANDER, ET JAMAIS POUR UNE PRISE SPORADIQUE');

v(
  'un traitement sans réglage ne rappelle rien',
  refs([traitement({ schema: quotidien(['08:00']) })], [], apres(300), JOUR),
  [],
);
v(
  '« Me rappeler » seul ne suffit pas : le rappel d’oubli est un second choix',
  refs([quiSeRappelle({ oubli: false })], [], apres(300), JOUR),
  [],
);
/*
   JAMAIS POUR UNE PRISE SPORADIQUE — interdit § 1, et décision 12. Le refus
   vient de `creneauxDuJour`, qui ne rend aucun créneau : une seule
   implémentation de la règle, et non deux qui finiraient par diverger.
*/
v(
  'jamais pour une prise sporadique, même réglée pour rappeler',
  refs(
    [
      traitement({
        sporadique: true,
        schema: quotidien(['08:00']),
        rappel: { ...reglageParDefaut(), actif: true, oubli: true },
      }),
    ],
    [],
    apres(300),
    JOUR,
  ),
  [],
);
v(
  'ni hors de la période du traitement',
  refs([quiSeRappelle()], [], apres(300), '2026-09-30'),
  [],
);

console.log('\nAU PLUS UN PAR TRAITEMENT ET PAR JOUR');

{
  /*
     Matin ET soir sans réponse : UN rappel, sur le plus ancien. Deux auraient
     été deux interruptions pour un même traitement le même jour, et la
     pente vers le compteur d'oublis commence là.

     L'observation est faite à 23 h, soit trois heures après le créneau de
     20 h : les deux délais sont donc passés.
  */
  const t = traitement({
    schema: quotidien(['08:00', '20:00']),
    rappel: { ...reglageParDefaut(), actif: true, oubli: true },
  });
  v(
    'deux créneaux sans réponse ne font qu’un rappel',
    refs([t], [], new Date('2026-10-19T21:00:00.000Z'), JOUR),
    ['t1|2026-10-19|08:00'],
  );
  /*
     Et si le matin a reçu sa réponse, c'est le soir qui est rappelé : le
     « plus ancien » se recalcule, il n'est pas figé.
  */
  v(
    'le matin répondu, c’est le soir qui est rappelé',
    refs([t], [marqueDe('08:00', 'pris')], new Date('2026-10-19T21:00:00.000Z'), JOUR),
    ['t1|2026-10-19|20:00'],
  );
}

{
  /* Deux traitements font deux rappels : la limite est par traitement. */
  const a = quiSeRappelle();
  const b: Traitement = { ...quiSeRappelle(), id: 't2', nom: 'Magnésium' };
  v('deux traitements, deux rappels', refs([a, b], [], apres(300), JOUR).sort(), [
    't1|2026-10-19|08:00',
    't2|2026-10-19|08:00',
  ]);
}

console.log('\nAUCUN HISTORIQUE : LE PRODUCTEUR NE REGARDE QUE LE JOUR DEMANDÉ');

{
  /*
     LA FORME MÊME DU MODULE EST L'INTERDIT § 1 n° 3. Un producteur qui
     remonterait dans le temps serait un compteur d'oublis déguisé : trente
     créneaux sans réponse feraient trente lignes au centre, et ces trente
     lignes seraient un reproche quel que soit leur texte.

     On le vérifie en demandant un jour ancien : on obtient le créneau de CE
     jour-là et rien d'autre — jamais une accumulation.
  */
  const t = quiSeRappelle();
  v(
    'un jour ancien ne rend que son propre créneau',
    refs([t], [], new Date('2026-10-19T21:00:00.000Z'), '2026-10-05'),
    ['t1|2026-10-05|08:00'],
  );
}

console.log('\nLE TEXTE DU RAPPEL NE CONSEILLE RIEN');

{
  const t = quiSeRappelle({ libelle: 'explicite' });
  v(
    'en explicite : le nom, l’heure prévue, et que rien n’est noté',
    texteDuRappelDOubli(t, '08:00'),
    'Créatine : prévue à 8 h, rien n’est noté.',
  );
  v(
    'en neutre : rien qui nomme le traitement',
    texteDuRappelDOubli(quiSeRappelle(), '08:00'),
    'Une prise : prévue à 8 h, rien n’est noté.',
  );
  v('et l’heure se lit à la française', texteDuRappelDOubli(t, '20:30'), 'Créatine : prévue à 20 h 30, rien n’est noté.');
  /*
     Aucun conseil de rattrapage, et la sonde de la phase 7 le vérifie sur ce
     texte-ci comme sur ceux de l'écran.
  */
  const ordres = [/(?<!vous )\bprenez\b/i, /\bdoublez\b/i, /\bsautez\b/i, /\brattrapez\b/i, /devriez/i];
  v(
    'le texte n’ordonne rien',
    ordres.filter((r) => r.test(texteDuRappelDOubli(t, '08:00'))).map(String),
    [],
  );
  /* Ni décompte, ni durée écoulée : « rien n'est noté », et c'est tout. */
  v(
    'et ne compte rien',
    /\d+\s*(fois|oubli|jour|%)/i.test(texteDuRappelDOubli(t, '08:00')),
    false,
  );
}

console.log(
  echecs === 0
    ? '\nTous les essais des rappels de prise passent.\n'
    : `\n${echecs} en échec.\n`,
);
process.exit(echecs === 0 ? 0 : 1);
