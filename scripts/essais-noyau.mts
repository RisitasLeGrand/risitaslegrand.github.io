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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  TYPES,
  typeDeFait,
  typesDe,
  typesSensibles,
  valider,
  type Fait,
} from '../src/lib/noyau/faits';
import {
  LECTRICES,
  MATRICE_PAR_DEFAUT,
  TYPE_CHARGE_PERCUE,
  controlerMatrice,
  domainesNonAutorises,
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
  'odyssee.passation',
  /*
     Une fenêtre passée du cycle est sensible : elle dit qu'il y a un cycle.
     Déclarée le 19 octobre avec le lot B.2, comme la seule chose du suivi que
     4.7 et D.5 laissent sortir du module.
  */
  'odyssee.fenetre-de-cycle',
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
v('Sport lit la charge perçue', peutLire('sport', TYPE_CHARGE_PERCUE).autorise, true);

/*
   CETTE ASSERTION DISAIT « Sport lit le statut hormonal », ET ELLE AFFIRMAIT
   UN DÉFAUT.

   Le § 4.7 du prompt 30 : « Sport ne lit **que les fenêtres passées** du
   cycle ; aucun statut, aucun bilan hormonal sexuel, aucune molécule
   contraceptive. » La citation de B.2, en tête de `permissions.ts`, ne donne
   pas le statut à Sport non plus. Il y avait été ajouté au titre de D.5, qui
   parle de bandes datées sur les courbes de Sport.

   Le plan de phase 0 tranche la tension, ligne 143 : « le statut hormonal à
   quatre valeurs est trop grossier et trahirait le suivi ». Quatre valeurs
   dont une est « cycle » : le lire, c'est apprendre qu'un suivi existe.

   L'assertion garde donc son objet — ce que Sport obtient du statut — avec la
   réponse inverse, et ce que D.5 voulait est rendu par la fenêtre. Son
   exigence n'est pas abaissée : elle est retournée.
*/
v(
  'Sport ne lit PAS le statut hormonal (4.7)',
  peutLire('sport', 'odyssee.statut-hormonal').autorise,
  false,
);
v(
  'mais il lit les fenêtres passées du cycle, que 4.7 et D.5 lui donnent',
  peutLire('sport', 'odyssee.fenetre-de-cycle').autorise,
  true,
);

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

/* ══════════════════════════════════════════════════════════════════════════
   LA MATRICE EST BRANCHÉE — lot B.2, 19 octobre
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nAUCUNE LECTURE EN TRAVERS SANS DIRE QUI LIT');

/*
   La matrice existait, complète, et **personne ne l'appelait** : vérifié le
   19 octobre, le module était même déclaré orphelin depuis le 15. Tout ce qui
   lit en travers passe par `publierTousLesFaits`, `faitsEntre` et
   `faitsDuJour`, et aucune des trois ne demandait qui lisait.

   Depuis ce lot, `lectrice` y est **obligatoire** et son type est une union
   fermée (`Lectrice`), donc le compilateur fait le gros du travail : il exige
   le paramètre, et il refuse une chaîne qui n'est pas une des trois branches
   déclarées.

   CE BLOC A ÉTÉ CORRIGÉ APRÈS UN SABOTAGE QUI N'A RIEN FAIT ROUGIR. J'avais
   typé `lectrice: string` et écrit ici que le balayage garderait « un appel
   qui passerait une lectrice variable venue d'ailleurs ». Faux :
   `lectrice: inconnue` contient le mot « lectrice », donc le balayage passait.
   Le type fermé le refuse maintenant au compilateur, ce qui est plus fort que
   tout balayage.

   Ce qui reste à garder ici, et que le compilateur ne voit pas :

   - un appel qui passerait une lectrice par une **transtypie** (`as Lectrice`)
     ou par une valeur élargie. Le balayage exige donc la forme
     `LECTRICES.xxx` littéralement, et non le seul mot « lectrice » ;
   - une constante déclarée dans `LECTRICES` que la matrice ne connaîtrait pas.
     Une faute de frappe y donnerait `matrice[lectrice] ?? []`, donc tout
     refusé sauf ses propres types : le bon sens de l'erreur, mais elle ne se
     verrait qu'à l'écran, sous la forme d'un domaine soudain non autorisé.
*/
const LECTURES_EN_TRAVERS = ['publierTousLesFaits(', 'faitsEntre(', 'faitsDuJour('];

const fichiersDeSrc = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return fichiersDeSrc(chemin);
    return /\.(ts|astro|svelte)$/.test(e.name) ? [chemin] : [];
  });

const appelsSansLectrice: string[] = [];
const lectricesNommees = new Set<string>();
for (const chemin of fichiersDeSrc('src')) {
  /* Les deux modules qui DÉFINISSENT ces fonctions ne sont pas des appelants. */
  if (/faits-branches\.ts$|faits-du-jour\.ts$/.test(chemin)) continue;
  const texte = readFileSync(chemin, 'utf8');
  for (const appel of LECTURES_EN_TRAVERS) {
    let place = texte.indexOf(appel);
    while (place >= 0) {
      /* Les trois cents signes qui suivent l'appel : largement de quoi couvrir ses arguments. */
      const arguments_ = texte.slice(place, place + 300);
      if (!/LECTRICES\.\w+/.test(arguments_)) {
        appelsSansLectrice.push(`${chemin} : ${appel}`);
      }
      for (const m of arguments_.matchAll(/LECTRICES\.(\w+)/g)) lectricesNommees.add(m[1]);
      place = texte.indexOf(appel, place + 1);
    }
  }
}

v('des appels ont été trouvés : le balayage ne mesure pas le vide', lectricesNommees.size > 0, true);
v(
  'aucune lecture en travers ne se fait sans une lectrice DÉCLARÉE',
  appelsSansLectrice,
  [],
);
v(
  'et chaque lectrice nommée est une clé de la matrice',
  [...lectricesNommees].filter((l) => !(l in MATRICE_PAR_DEFAUT)).sort(),
  [],
);
v(
  'les noms déclarés sont tous des clés de la matrice',
  Object.values(LECTRICES).filter((l) => !(l in MATRICE_PAR_DEFAUT)),
  [],
);

/*
   LE FILTRE EST BIEN APPLIQUÉ DANS LES DEUX MODULES, et ce contrôle existe
   parce qu'un sabotage a montré qu'il manquait : retirer
   `filtrerPourLecture` de `publierTousLesFaits` ne faisait rien rougir. Les
   essais mesuraient la matrice, pas son branchement.

   C'est un contrôle de SOURCE, et il faut dire ce qu'il ne prouve pas : il
   voit que les deux fonctions sont appelées, non qu'elles sont appelées au bon
   endroit ni sur les bons faits. L'exercer pour de vrai demanderait une base
   et six publieurs ; les écrans qui s'en servent — calendrier, tendances,
   tâches — sont ouverts par le socle, et une forme de retour changée les
   casserait bruyamment.
*/
const aggregation = readFileSync('src/lib/odyssee/faits-branches.ts', 'utf8');
const fenetre = readFileSync('src/lib/odyssee/faits-du-jour.ts', 'utf8');
for (const [nom, source] of [
  ['faits-branches', aggregation],
  ['faits-du-jour', fenetre],
] as const) {
  v(`${nom} applique le filtre de lecture`, /filtrerPourLecture\(lectrice,/.test(source), true);
  v(`${nom} rend le troisième état`, /domainesNonAutorises\(lectrice,/.test(source), true);
}

console.log('\nSPORT NE REÇOIT RIEN QUI NE SOIT DANS B.2');

/*
   Écrit en ENTIER, et non calculé depuis la matrice : un essai qui relit la
   matrice pour vérifier la matrice ne dit rien. Cette liste est celle de B.2
   plus ce que D.5 ajoute, et tout élargissement la fait rougir — c'est-à-dire
   se voit dans un diff, ce qui est le but.
*/
/*
   Comparée triée des DEUX côtés : l'ordre de cette liste n'est pas une
   exigence, et une insertion au mauvais endroit alphabétique ferait rougir un
   essai pour une raison qui n'intéresse personne. Ce qui est gardé est
   l'ENSEMBLE.
*/
const ATTENDU_POUR_SPORT = [
  'odyssee.charge-percue',
  'odyssee.hydratation',
  'odyssee.mesure',
  'odyssee.poids',
  'odyssee.repas',
  'odyssee.sante',
  'odyssee.sommeil',
  'odyssee.fenetre-de-cycle',
  'sport.blessure',
  'sport.phase',
  'sport.record',
  'sport.seance',
  'sport.serie',
];
v(
  'Sport lit exactement ce qui est prévu, ses propres types compris',
  typesLisibles(LECTRICES.sport).map((t) => t.id).sort(),
  [...ATTENDU_POUR_SPORT].sort(),
);

/*
   Et le filtre le tient sur des faits réels : un fait par type déclaré, passé
   au filtre de Sport. Ce qui survit doit être exactement la liste ci-dessus.
   C'est la même garantie, mesurée par l'autre bout — par la fonction que les
   modules appellent, et non par celle qui décrit.
*/
const unFaitParType = TYPES.map((type) => ({ type: type.id }));
v(
  'et le filtre rend la même liste, sur des faits',
  filtrerPourLecture(LECTRICES.sport, unFaitParType).map((f) => f.type).sort(),
  [...ATTENDU_POUR_SPORT].sort(),
);
v(
  'le journal, les check-ins et les finances n’en sont pas',
  filtrerPourLecture(LECTRICES.sport, unFaitParType)
    .map((f) => f.type)
    .filter((id) => /journal|checkin|operation|valorisation|passation/.test(id)),
  [],
);

console.log('\nLE TROISIÈME ÉTAT : « NON AUTORISÉ » N’EST PAS « NON MESURÉ »');

/*
   La maquette 8.3 impose la distinction. `domainesNonAutorises` la rend depuis
   la **matrice**, pas depuis les faits : la réponse est donc la même pour une
   fenêtre pleine et pour une fenêtre vide. C'est ce qui compte, parce qu'un
   domaine interdit dont la fenêtre ne contient rien se serait tu — exactement
   comme un domaine autorisé et vide.
*/
const refusesPourSport = domainesNonAutorises(LECTRICES.sport);
v('Sport a des domaines refusés', refusesPourSport.length > 0, true);
v(
  'la psyché et les finances en sont',
  refusesPourSport.map((d) => d.domaine).filter((d) => d === 'psyche' || d === 'finances').sort(),
  ['finances', 'psyche'],
);
v(
  'Odyssée n’a aucun domaine refusé : elle lit tout',
  domainesNonAutorises(LECTRICES.odyssee),
  [],
);
v(
  'et rien de ce qui est rendu ne nomme un type ni une date',
  refusesPourSport.filter(
    (d) => Object.keys(d).sort().join(',') !== 'domaine,typesEnTout,typesRefuses',
  ),
  [],
);
v(
  'les comptes sont cohérents : jamais plus de refusés que de types',
  refusesPourSport.filter((d) => d.typesRefuses > d.typesEnTout || d.typesRefuses < 1),
  [],
);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
