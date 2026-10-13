/**
 * Les invariants du socle : le contrat de faits et la matrice de permissions.
 *
 * Ce que vérifient ces essais n'est visible nulle part dans l'interface, et
 * c'est précisément pour cela qu'ils existent. Qu'un type de fait ait deux
 * propriétaires, qu'une branche puisse lire les notes de journal, qu'un poids
 * aberrant soit refusé au lieu d'être marqué : rien de tout cela ne produit
 * d'erreur à l'écran. Le premier cas fabrique deux vérités, le second est une
 * fuite, le troisième fait dire au site qu'il sait mieux que la personne ce
 * qu'elle pèse.
 */
import {
  TYPES,
  typeDeFait,
  typesDe,
  typesSensibles,
  valider,
  type Fait,
} from '../src/lib/noyau/faits';
import {
  MATRICE_PAR_DEFAUT,
  TYPE_CHARGE_PERCUE,
  controlerMatrice,
  filtrerPourLecture,
  peutLire,
  typesLisibles,
} from '../src/lib/noyau/permissions';
import { BRANCHES } from '../src/lib/branches';

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

console.log('\nLE CATALOGUE EST COHÉRENT');

v('les identifiants de type sont uniques', new Set(TYPES.map((t) => t.id)).size, TYPES.length);

/*
 * L'invariant qui justifie le catalogue : un type n'a qu'un propriétaire. Il est
 * garanti par la structure — le propriétaire est un champ du type — mais la
 * vérification reste utile contre un copier-coller qui dupliquerait un
 * identifiant sous deux propriétaires.
 */
{
  const parId = new Map<string, Set<string>>();
  for (const t of TYPES) {
    if (!parId.has(t.id)) parId.set(t.id, new Set());
    parId.get(t.id)!.add(t.proprietaire);
  }
  v(
    'aucun type n’a deux propriétaires',
    [...parId.entries()].filter(([, p]) => p.size > 1).map(([id]) => id),
    [],
  );
}

{
  const branchesDeclarees = new Set(BRANCHES.map((b) => b.id));
  v(
    'chaque propriétaire est une branche déclarée',
    [...new Set(TYPES.map((t) => t.proprietaire))].filter((p) => !branchesDeclarees.has(p)),
    [],
  );
}

v('les trois branches possèdent des types', [
  typesDe('revisions').length > 0,
  typesDe('sport').length > 0,
  typesDe('odyssee').length > 0,
], [true, true, true]);

v(
  'un type qui porte une valeur déclare sa nature et son unité',
  TYPES.filter((t) => t.nature === 'nombre' && !t.unite).map((t) => t.id),
  [],
);
v(
  'chaque type a une description',
  TYPES.filter((t) => !t.description.trim()).map((t) => t.id),
  [],
);
v(
  'une plage possible encadre toujours la plage plausible',
  TYPES.filter((t) => {
    const p = t.plage;
    if (!p?.possible || !p?.plausible) return false;
    const basFaux = p.plausible.min !== undefined && p.possible.min !== undefined
      && p.plausible.min < p.possible.min;
    const hautFaux = p.plausible.max !== undefined && p.possible.max !== undefined
      && p.plausible.max > p.possible.max;
    return basFaux || hautFaux;
  }).map((t) => t.id),
  [],
);

console.log('\nCE QUI EST SENSIBLE EST DÉCLARÉ SENSIBLE');

/*
 * La liste est écrite ici en dur, exprès. C'est le seul endroit du code où une
 * relecture humaine peut dire « oui, ce sont bien les données dont la lecture
 * par un tiers fait un dommage ». Un type sensible ajouté sans l'être marqué
 * ferait échouer cet essai, ce qui est tout l'objet.
 */
const SENSIBLES_ATTENDUS = [
  'sport.blessure',
  'odyssee.poids',
  'odyssee.mesure',
  'odyssee.repas',
  'odyssee.medicament',
  'odyssee.statut-hormonal',
  'odyssee.sante',
  'odyssee.checkin',
  'odyssee.journal',
  'odyssee.operation',
  'odyssee.valorisation',
  'odyssee.usage',
];
v(
  'la liste des types sensibles est exactement celle attendue',
  typesSensibles().map((t) => t.id).sort(),
  [...SENSIBLES_ATTENDUS].sort(),
);
v(
  'la charge perçue n’est pas sensible : c’est un nombre sans texte',
  typeDeFait(TYPE_CHARGE_PERCUE)?.sensible ?? false,
  false,
);

console.log('\nLA MATRICE REFUSE PAR DÉFAUT');

v(
  'un type inconnu est refusé',
  peutLire('sport', 'odyssee.inexistant').autorise,
  false,
);
v(
  'une branche inconnue ne lit rien',
  peutLire('inconnue', 'odyssee.poids').autorise,
  false,
);
for (const t of TYPES) {
  if (t.proprietaire !== 'revisions') continue;
  v(`Révisions lit son propre « ${t.id} »`, peutLire('revisions', t.id).autorise, true);
}

console.log('\nSPORT LIT LE CORPS, ET PAS LA PSYCHÉ');

v('Sport lit le poids', peutLire('sport', 'odyssee.poids').autorise, true);
v('Sport lit le sommeil', peutLire('sport', 'odyssee.sommeil').autorise, true);
v('Sport lit la diète', peutLire('sport', 'odyssee.repas').autorise, true);
v('Sport lit la santé générale', peutLire('sport', 'odyssee.sante').autorise, true);
v('Sport lit le statut hormonal', peutLire('sport', 'odyssee.statut-hormonal').autorise, true);
v('Sport lit la charge perçue', peutLire('sport', TYPE_CHARGE_PERCUE).autorise, true);

v('Sport ne lit PAS les check-ins', peutLire('sport', 'odyssee.checkin').autorise, false);
v('Sport ne lit PAS le journal', peutLire('sport', 'odyssee.journal').autorise, false);
v('Sport ne lit PAS les finances', peutLire('sport', 'odyssee.operation').autorise, false);
v('Sport ne lit PAS les valorisations', peutLire('sport', 'odyssee.valorisation').autorise, false);
v('Sport ne lit PAS les médicaments', peutLire('sport', 'odyssee.medicament').autorise, false);
v(
  'et le refus sur un type sensible le dit',
  /donnée sensible/.test(peutLire('sport', 'odyssee.journal').raison),
  true,
);

console.log('\nRÉVISIONS LIT PEU');

v('Révisions lit le sommeil', peutLire('revisions', 'odyssee.sommeil').autorise, true);
v('Révisions lit la charge perçue', peutLire('revisions', TYPE_CHARGE_PERCUE).autorise, true);
v('Révisions ne lit pas le poids', peutLire('revisions', 'odyssee.poids').autorise, false);
v('Révisions ne lit pas la diète', peutLire('revisions', 'odyssee.repas').autorise, false);
v('Révisions ne lit rien de Sport', peutLire('revisions', 'sport.serie').autorise, false);

console.log('\nODYSSÉE LIT TOUT');

v(
  'aucun type n’échappe à Odyssée',
  TYPES.filter((t) => !peutLire('odyssee', t.id).autorise).map((t) => t.id),
  [],
);
v('et elle en lit autant que le catalogue en compte', typesLisibles('odyssee').length, TYPES.length);

console.log('\nLE FILTRE NE LAISSE RIEN FUIR, PAS MÊME UN COMPTE');

{
  const journee = [
    { type: 'odyssee.sommeil', valeur: 7 * 3600 },
    { type: 'odyssee.checkin', valeur: 3 },
    { type: 'odyssee.journal', valeur: 'ce que je ne veux dire à personne' },
    { type: 'odyssee.poids', valeur: 74.2 },
  ];
  const pourSport = filtrerPourLecture('sport', journee);
  v('Sport reçoit deux faits sur quatre', pourSport.length, 2);
  v(
    'et ce sont le sommeil et le poids',
    pourSport.map((f) => f.type).sort(),
    ['odyssee.poids', 'odyssee.sommeil'],
  );
  /*
   * Le filtre retire, il ne masque pas. Rendre les faits refusés sous une forme
   * caviardée aurait suffi à apprendre qu'il y a eu un check-in ce jour-là,
   * c'est-à-dire exactement ce qu'on cherche à ne pas dire.
   */
  v(
    'aucune trace des faits refusés',
    JSON.stringify(pourSport).includes('journal') ||
      JSON.stringify(pourSport).includes('checkin'),
    false,
  );
  v('Odyssée reçoit les quatre', filtrerPourLecture('odyssee', journee).length, 4);
}

console.log('\nLA MATRICE MODIFIÉE EST CONTRÔLÉE');

v('la matrice par défaut ne pose aucun problème', controlerMatrice(MATRICE_PAR_DEFAUT), []);
v(
  'un type inconnu est refusé',
  controlerMatrice({ sport: ['odyssee.inexistant'] }).map((p) => p.gravite),
  ['refus'],
);
v(
  'une branche inconnue est refusée',
  controlerMatrice({ fantome: ['odyssee.poids'] }).map((p) => p.gravite),
  ['refus'],
);
{
  // Élargir à un type sensible est permis — ce sont ses données — mais signalé.
  const problemes = controlerMatrice({ sport: ['odyssee.journal'] });
  v('ouvrir le journal à Sport est signalé', problemes.map((p) => p.gravite), ['avertissement']);
  v(
    'et le message dit que c’est un choix',
    /votre choix/.test(problemes[0]?.message ?? ''),
    true,
  );
}

console.log('\nVALIDATION : CE QUI EST FAUX EST REFUSÉ');

const base: Fait = {
  id: 'f1',
  branche: 'odyssee',
  domaine: 'corps',
  type: 'odyssee.poids',
  debut: '2026-10-11T08:00:00.000Z',
  jourLogique: '2026-10-11',
  valeur: 74.2,
  unite: 'kg',
  source: 'manuel',
  fiabilite: 'confirme',
  proprietaire: 'odyssee',
  version: 1,
  modifieLe: '2026-10-11T08:00:00.000Z',
};

v('un fait correct est recevable', valider(base).recevable, true);
v('et garde sa fiabilité', valider(base).fiabilite, 'confirme');

v('un type inconnu est refusé', valider({ ...base, type: 'n’importe.quoi' }).recevable, false);
v('une date illisible est refusée', valider({ ...base, debut: 'hier' }).recevable, false);
v(
  'une fin avant le début est refusée',
  valider({ ...base, fin: '2026-10-11T07:00:00.000Z' }).recevable,
  false,
);
v(
  'un jour logique mal formé est refusé',
  valider({ ...base, jourLogique: '11/10/2026' }).recevable,
  false,
);
v('une version nulle est refusée', valider({ ...base, version: 0 }).recevable, false);

/*
 * Le refus qui compte le plus : une branche qui prétend publier le type d'une
 * autre. C'est la forme que prendrait la violation de la règle « aucune branche
 * n'écrit chez une autre », et elle ne produirait aucune erreur visible.
 */
{
  const usurpe = valider({ ...base, branche: 'sport', proprietaire: 'sport' });
  v('Sport ne peut pas publier le poids', usurpe.recevable, false);
  v(
    'et le refus nomme la règle',
    /n’écrit jamais chez une autre|ne peut être émis que par/.test(
      usurpe.problemes.map((p) => p.message).join(' '),
    ),
    true,
  );
}

console.log('\nVALIDATION : CE QUI SURPREND EST GARDÉ, PAS REFUSÉ');

/*
 * C'est le cœur de B.3, et la nuance est tout. Un poids de 300 kg est
 * invraisemblable : le refuser serait dire à la personne qu'elle se trompe sur
 * son propre corps. Un poids de 5 kg est impossible pour un adulte qui se pèse,
 * et le refuser est juste.
 */
{
  const gros = valider({ ...base, valeur: 300 });
  v('300 kg est accepté', gros.recevable, true);
  v('mais marqué à vérifier', gros.fiabilite, 'a-verifier');
  v('avec un doute, pas un refus', gros.problemes.map((p) => p.gravite), ['doute']);
  v(
    'et un message qui dit que la valeur est conservée',
    /conservée/.test(gros.problemes[0]?.message ?? ''),
    true,
  );
}
{
  const impossible = valider({ ...base, valeur: 5 });
  v('5 kg est refusé', impossible.recevable, false);
  v('parce que c’est impossible', /impossible/.test(impossible.problemes[0]?.message ?? ''), true);
}
{
  v(
    'une séance de douze heures est gardée, à vérifier',
    valider({
      ...base,
      type: 'revision.seance',
      branche: 'revisions',
      proprietaire: 'revisions',
      domaine: 'connaissances',
      unite: 'secondes',
      valeur: 12 * 3600,
    }).fiabilite,
    'a-verifier',
  );
  v(
    'une séance de durée négative est refusée',
    valider({
      ...base,
      type: 'revision.seance',
      branche: 'revisions',
      proprietaire: 'revisions',
      domaine: 'connaissances',
      unite: 'secondes',
      valeur: -60,
    }).recevable,
    false,
  );
}
{
  v(
    'une valeur manquante sur un type qui en attend une est un doute',
    valider({ ...base, valeur: undefined }).problemes.map((p) => p.gravite),
    ['doute'],
  );
  v(
    'alors qu’un type sans valeur n’en réclame pas',
    valider({
      ...base,
      type: 'odyssee.tache',
      domaine: 'ordre',
      unite: undefined,
      valeur: undefined,
    }).problemes,
    [],
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
