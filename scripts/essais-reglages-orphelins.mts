/**
 * Aucun réglage caché dans un écran — P3 du prompt 42.
 *
 *   npm run essais:reglages-orphelins
 *
 * Le prompt le demande explicitement : « Aucun réglage caché dans un écran
 * sans figurer aussi sur la page centrale : un essai échoue sinon, sur le
 * modèle de l'essai des orphelins. » Le voici.
 *
 * Il confronte deux choses qui ne se parlent pas :
 *
 * - l'**inventaire mécanique** (`scripts/lib/inventaire-reglages.mjs`), qui
 *   part des écritures du code et ne sait rien de la page centrale ;
 * - le **catalogue** (`src/lib/parametres/catalogue.ts`), qui est ce que la
 *   page affiche.
 *
 * Toute clé relevée par le premier doit être, soit dans le second, soit
 * déclarée ci-dessous comme **état technique**, avec sa raison. Une clé
 * oubliée fait échouer la batterie. Une exception périmée — la clé n'est
 * plus écrite nulle part — la fait échouer aussi : une déclaration qui ne
 * correspond plus est un mensonge qui dort.
 *
 * ## Ce qu'il ne voit pas
 *
 * Il ne dit pas qu'un réglage affiché **fonctionne** : c'est l'affaire de
 * l'essai d'égalité, qui change une valeur sur la page centrale et la relit
 * sur l'écran d'origine. Ici on ne mesure que la couverture.
 */
import { readFileSync } from 'node:fs';
import { EXCEPTIONS_DE_PORTEE, inventaire, suspectes } from './lib/inventaire-reglages.mjs';
import { REGLAGES } from '../src/lib/parametres/catalogue.ts';

/** Les clés qui ne se règlent pas : de l'état, pas des réglages. */
const ETAT_TECHNIQUE: { cle: string; raison: string }[] = [
  { cle: 'IndexedDB/etat::appareil', raison: 'l’identifiant de cet appareil, posé une fois' },
  { cle: 'IndexedDB/etat::horloge', raison: 'l’horloge logique locale' },
  { cle: 'IndexedDB/etat::appairage', raison: 'l’état d’un appairage en cours' },
  { cle: 'IndexedDB/etat::certification', raison: 'la certification d’un ordinateur, par son écran' },
  { cle: 'IndexedDB/etat::lotsRecus', raison: 'les lots de synchronisation déjà reçus' },
  { cle: 'IndexedDB/etat::derniereVeille', raison: 'l’empreinte de la dernière veille de fond' },
  { cle: 'IndexedDB/etat::reglagesSync', raison: 'le registre versionné des réglages synchronisés' },
  {
    cle: 'IndexedDB/etat::fusionEnCours',
    raison:
      'la liste du travail qu’une fusion interrompue a laissé en chemin (B-4 du ' +
      '58) : les cibles à matérialiser et les cartes à recalculer. Personne ne la ' +
      'choisit, et elle ne survit pas à la reprise — elle est posée par la ' +
      'transaction du journal et retirée dès que le travail est fini. Elle ' +
      'S’AFFICHE, mais sur /appareils/ et comme une alerte, pas comme un réglage.',
  },
  { cle: 'IndexedDB/etat::socleActivite', raison: 'le socle d’XP recalculé, pas un réglage' },
  { cle: 'IndexedDB/etat::coffre.migration', raison: 'l’avancement d’une bascule de coffre' },
  {
    cle: 'IndexedDB/etat::dossier-releves',
    raison: 'la poignée du dossier de relevés, choisie sur son écran',
  },
  { cle: 'IndexedDB/etat::dossier-releves-vus', raison: 'les relevés déjà importés' },
  { cle: 'localStorage::revinsp.cle', raison: 'la clé de session mémorisée' },
  { cle: 'sessionStorage::revinsp.cle', raison: 'la clé de session, pour cet onglet' },
  { cle: 'sessionStorage::cyclades.coffre', raison: 'l’enveloppe du coffre pour cet onglet' },
  { cle: 'sessionStorage::cyclades.coffre.multi', raison: 'le relais du coffre entre onglets' },
  { cle: 'sessionStorage::cyclades.defilement', raison: 'la position de défilement' },
  { cle: 'sessionStorage::cyclades.piles', raison: 'la pile de navigation par onglet' },
  { cle: 'sessionStorage::cyclades.retour.profondeur', raison: 'la profondeur du retour arrière' },
  { cle: 'sessionStorage::cyclades.usage.session', raison: 'l’usage observé de la session' },
  { cle: 'sessionStorage::parcours.change', raison: 'le témoin d’un changement de parcours' },
  { cle: 'localStorage::cyclades.notifications.jour', raison: 'le compteur du plafond quotidien' },
  { cle: 'localStorage::cyclades.parametres-publics', raison: 'la copie de secours de cle.json' },
  { cle: 'localStorage::revinsp.temps-en-attente', raison: 'le temps passé, en attente d’écriture' },
  { cle: 'localStorage::revinsp.podcast.position', raison: 'où l’écoute s’est arrêtée' },
  {
    cle: 'localStorage::revinsp.bibliotheque.sections',
    raison: 'les sections repliées de la bibliothèque : un état d’écran, pas un réglage',
  },
  {
    cle: 'localStorage::cyclades.installation.refusee',
    raison: 'le refus de la proposition d’installation, qui ne se repropose pas',
  },
  {
    cle: 'localStorage::revinsp.persistance-demandee-le',
    raison:
      'la date de la dernière demande de stockage persistant (A4 du 43) : elle ' +
      'tient le délai d’une semaine entre deux demandes. Ce n’est pas un réglage — ' +
      'personne ne choisit cette date, et la permission elle-même est accordée ou ' +
      'refusée par le navigateur, pas par nous. L’état accordé/refusé, lui, S’AFFICHE ' +
      'sur la page Stockage.',
  },
  {
    cle: 'localStorage::revinsp.assistant.avertissement-vu',
    raison: 'l’avertissement du volet « Demander à l’IA », vu une fois',
  },
  {
    cle: 'localStorage::revinsp.assistant.intention',
    raison: 'la dernière intention choisie dans le volet, rappelée pour la fois suivante',
  },
  {
    cle: 'IndexedDB/etat::coffre.sel',
    raison: 'le sel du coffre ; le mot de passe se change sur son écran (entrée au catalogue)',
  },
  {
    cle: 'IndexedDB/odysseeVeilleReglages::reglages',
    raison: 'lu sous la clé fixe de l’objet scellé, déjà porté par l’entrée « veille »',
  },
  {
    cle: 'localStorage::revinsp.heures-journee',
    raison:
      'la copie des heures de « Ma journée » pour le script d’amorçage : écrite par le site, jamais par la personne',
  },
  {
    cle: 'localStorage::bibliotheque.avertissement.vu',
    raison: 'l’avertissement de la bibliothèque externe, vu une fois',
  },
  {
    cle: 'IndexedDB/etat::clé variable : champ as never',
    raison: '`ecrireReglageBrut` : le chemin générique d’un réglage reçu d’un autre appareil',
  },
  {
    cle: 'IndexedDB/etat::clé variable : clef',
    raison: 'l’écriture générique des enveloppes du coffre (`coffre.ts`)',
  },
  {
    cle: 'IndexedDB/etat::clé variable : c',
    raison: 'la bascule de coffre, qui réécrit les clés qu’elle vient de lire',
  },
];

/* Les clés dont la valeur n'est pas littérale : l'inventaire les relève
   telles quelles, et le catalogue les désigne par leur gabarit. */
const GABARITS = new Map([
  ['IndexedDB/etat::clé variable : clefSelection(exercice)', 'IndexedDB/etat::selection:*'],
]);

/** Les clés relevées par l'inventaire, ramenées à leur nom de catalogue. */
const relevees = new Map<string, string[]>();
for (const c of inventaire().cles) {
  const brut = `${c.stockage}::${c.cle}`;
  const id = GABARITS.get(brut) ?? brut;
  relevees.set(id, c.ecrivains);
}

const auCatalogue = new Set(REGLAGES.map((r) => r.stockage));
const declarees = new Map(ETAT_TECHNIQUE.map((e) => [e.cle, e.raison]));

let rouges = 0;
const dire = (texte: string) => {
  console.log(`\x1b[31m✗\x1b[0m ${texte}`);
  rouges += 1;
};

for (const [cle, ecrivains] of relevees) {
  if (auCatalogue.has(cle) || declarees.has(cle)) continue;
  dire(
    `${cle} se change dans ${ecrivains.map((f) => f.replace('src/', '')).join(', ') || '(nulle part ?)'} ` +
      'et ne figure pas sur la page centrale. Ajoutez-la au catalogue, ou déclarez-la comme état technique avec sa raison.',
  );
}

for (const [cle, raison] of declarees)
  if (!relevees.has(cle))
    dire(
      `l’exception « ${cle} » ne sert plus : plus rien ne l’écrit (sa raison était : ${raison}).`,
    );

/* ── Le garde-fou de la règle de portée ──────────────────────────────────── */

/*
   La première règle de portée se lit au module : un fichier qui appelle
   `sceller(` quelque part voit toutes ses clés rangées « sous coffre ». C'est
   trop large d'un cran, et `sante.active` en est la preuve — un drapeau en
   clair dans un module qui scelle ses données.

   Le pilote a tranché le 18 octobre : la limite est **bornée**, pas seulement
   décrite. Chaque faux positif est nommé dans `EXCEPTIONS_DE_PORTEE` avec sa
   raison, et toute autre clé écrite en clair par un module qui scelle fait
   échouer cet essai. Deux réparations sont alors possibles, et une seule est
   bonne selon le cas : passer l'écriture par `sceller(`, ou déclarer
   l'exception si le clair est voulu.
*/
console.log('\nLA PORTÉE NE MENT QUE LÀ OÙ ON L’A DIT');
const reglagesReleves = inventaire().cles;
for (const e of suspectes(reglagesReleves))
  dire(
    `${e.stockage}::${e.cle} est écrite **en clair** par un module qui scelle ` +
      `(${e.ecrivains.map((f: string) => f.replace('src/', '')).join(', ')}). ` +
      'La portée affichée dirait « sous coffre » à tort. Scellez l’écriture, ou ' +
      'déclarez-la dans EXCEPTIONS_DE_PORTEE avec sa raison.',
  );

/* Une exception de portée qui ne correspond plus à rien est un mensonge qui
   dort, comme pour l'état technique : on la fait échouer aussi. */
for (const id of Object.keys(EXCEPTIONS_DE_PORTEE))
  if (!reglagesReleves.some((e: { stockage: string; cle: string }) => `${e.stockage}::${e.cle}` === id))
    dire(`l’exception de portée « ${id} » ne sert plus : plus rien n’écrit cette clé.`);

if (suspectes(reglagesReleves).length === 0)
  console.log(
    `\x1b[32m✓\x1b[0m aucune clé en clair non déclarée dans un module qui scelle ` +
      `(${Object.keys(EXCEPTIONS_DE_PORTEE).length} exception(s) nommée(s))`,
  );

/* Un réglage du catalogue qui ne correspond à aucune écriture relevée est
   l'erreur symétrique : la page afficherait un réglage que rien ne stocke. */
/*
   Le contrôle symétrique ne porte que sur les réglages que la page **change**
   elle-même. Pour les entrées « ailleurs » — celles qui ne font que montrer
   le chemin de leur écran —, le champ `stockage` est de la documentation :
   l'exiger relevable obligerait à décrire des magasins que l'inventaire ne
   nomme pas, et l'on écrirait des identifiants faux pour faire plaisir au
   contrôle.
*/
for (const r of REGLAGES)
  if (r.nature.genre !== 'ailleurs' && !relevees.has(r.stockage))
    dire(
      `le réglage « ${r.libelle} » (${r.id}) dit se ranger sous ${r.stockage}, que l’inventaire ne relève nulle part.`,
    );

/* ── Le lien « Réglages de cet écran » ───────────────────────────────────── */

/*
   P3 : « Depuis chaque écran à réglages, un lien “Réglages de cet écran”
   ouvre la bonne section par une ancre. » Le catalogue nomme ces écrans ; on
   vérifie ici qu'ils portent le lien. Un écran cité et sans lien est le
   défaut que ce contrôle vise : la page centrale existerait, et personne ne
   la trouverait depuis l'endroit où la question se pose.
*/
const FICHIER = (chemin: string) => {
  const nu = chemin.replace(/^\/|\/$/g, '');
  return [`src/pages/${nu}.astro`, `src/pages/${nu}/index.astro`];
};

const ecrans = new Set(REGLAGES.map((r) => r.ecran).filter((e): e is string => Boolean(e)));
for (const ecran of ecrans) {
  const candidats = FICHIER(ecran);
  let trouve = false;
  let existe = false;
  for (const chemin of candidats) {
    let source: string;
    try {
      source = readFileSync(chemin, 'utf8');
    } catch {
      continue;
    }
    existe = true;
    if (source.includes('<LienReglages')) trouve = true;
  }
  if (!existe) dire(`l’écran ${ecran}, cité par le catalogue, n’existe pas (${candidats.join(' ni ')}).`);
  else if (!trouve)
    dire(`l’écran ${ecran} ne porte pas le lien « Réglages de cet écran ».`);
}

console.log(
  rouges === 0
    ? `\n\x1b[32mTout est vert.\x1b[0m ${relevees.size} clés relevées : ${auCatalogue.size} au catalogue, ` +
        `${declarees.size} déclarées « état technique ».`
    : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
