/**
 * Ce qu'un essai a le droit de semer en base — garde-fou d'A-16.
 *
 *   npm run essais:semis
 *
 * ## La règle, et la distinction que sa première formulation n'avait pas
 *
 * Proposée ainsi : « un essai de parcours ne sème jamais en base ; toute
 * donnée naît par un écran ». L'intention est juste. Appliquée telle
 * quelle, elle condamne **vingt-deux** fichiers, dont la plupart le font
 * légitimement : on ne produit pas par l'interface une base au schéma
 * v14, ni un paquet venu d'un autre appareil, ni une journée vieille de
 * trois semaines. Un essai de migration DOIT semer — c'est son objet.
 *
 * La distinction qui manquait :
 *
 * - un **parcours** éprouve qu'un utilisateur peut faire une chose. Il ne
 *   sème rien, sous peine de prouver ce qu'il a lui-même fabriqué ;
 * - un **scénario** éprouve le comportement devant un état que
 *   l'interface ne sait pas produire : un ancien schéma, un appareil
 *   distant, une date passée. Il sème, et il dit pourquoi.
 *
 * ## Ce que ce contrôle empêche vraiment
 *
 * A-16 — aucune tâche liée ne pouvait exister — a tenu quatre phases
 * parce qu'**aucun essai de navigateur n'exerçait de tâche liée**. Les
 * essais de module en fabriquaient, légitimement, dans leurs jeux
 * d'essai. Ce n'est donc pas « les essais semaient » qui l'a cachée,
 * c'est « aucun parcours ne la créait ». Le contrôle vise ce défaut-là :
 * un essai ne doit pas fabriquer l'état dont il est censé prouver que
 * l'application sait le créer.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/*
   Les essais qui sèment, chacun avec sa raison. Une ligne sans raison est
   refusée : c'est la raison qui fait le travail, pas l'inscription.

   `permanent: true` quand l'état visé ne sera jamais produisible par
   l'interface. Sinon `depuis`, et la ligne devra tomber.
*/
const SEMIS_DECLARES = [
  { fichier: 'essais-migration-ulid.mjs', permanent: true, pourquoi: 'Une base au schéma d’avant la migration ne se crée pas par l’interface.' },
  { fichier: 'essais-migration-fsrs.mjs', permanent: true, pourquoi: 'Idem : un état FSRS antérieur est par définition hors d’atteinte de l’écran.' },
  { fichier: 'essais-migration-journal.mjs', permanent: true, pourquoi: 'Idem, pour le journal d’opérations.' },
  { fichier: 'essais-migration-notes.mjs', permanent: true, pourquoi: 'Idem, pour les notes de séance.' },
  { fichier: 'essais-instantane.mjs', permanent: true, pourquoi: 'Un instantané se prend AVANT migration : l’état d’origine doit être posé.' },
  { fichier: 'essais-compaction-navigateur.mjs', permanent: true, pourquoi: 'Compacter demande un journal long ; le produire à l’écran prendrait des heures.' },
  { fichier: 'essais-sauvegarde.mjs', permanent: true, pourquoi: 'Restaurer demande une sauvegarde d’un autre appareil.' },
  { fichier: 'essais-sauvegarde-cyclades.mjs', permanent: true, pourquoi: 'Restaurer un fichier .cyclades suppose un fichier venu d’ailleurs, chiffré par un autre appareil.' },
  { fichier: 'essais-import-navigateur.mjs', permanent: true, pourquoi: 'Importer demande une donnée extérieure, par construction.' },
  { fichier: 'essais-transport-fichier.mjs', permanent: true, pourquoi: 'Un paquet venu d’un autre appareil ne naît pas ici.' },
  { fichier: 'essais-certification-navigateur.mjs', permanent: true, pourquoi: 'Certifier un ordinateur suppose un second appareil.' },
  { fichier: 'essais-effacement-navigateur.mjs', permanent: true, pourquoi: 'Effacer demande un volume que l’écran mettrait trop longtemps à produire.' },
  { fichier: 'essais-reglages-sans-coffre.mjs', permanent: true, pourquoi: 'B-3 du 58 : il faut des enregistrements scellés ET un sel de coffre déjà posés pour que l’effacement des réglages puisse les condamner — un écran ne produit pas cet état en un geste.' },
  { fichier: 'essais-epreuve-gardee-navigateur.mjs', permanent: true, pourquoi: 'C3 du 43 : tout le parcours passe par l’écran — commencer, répondre, quitter, garder, reprendre, abandonner. Un seul état est semé, et il est hors d’atteinte de l’interface : une épreuve gardée dont une question a DISPARU de la banque. L’obtenir à l’écran demanderait de reconstruire le site entre deux visites.' },
  { fichier: 'essais-cle-disparue.mjs', permanent: true, pourquoi: 'Le coffre sans clé est, par définition, un état qu’aucun écran ne sait créer : des scellés en base et plus de sel. Le reproduire est tout l’objet de l’essai.' },
  { fichier: 'essais-fusion-interrompue.mjs', permanent: true, pourquoi: 'B-4 du 58 : l’état qu’une fusion interrompue laisse — journal écrit, rubriques non rangées — ne s’obtient qu’en tuant l’onglet au bon millième de seconde. L’essai écrit cet état plutôt que de parier sur un instant.' },
  { fichier: 'essais-stockage.mjs', permanent: true, pourquoi: 'Mesurer le stockage demande un volume semé.' },
  { fichier: 'essais-activite-navigateur.mjs', permanent: true, pourquoi: 'L’XP sur plusieurs semaines suppose des jours passés, inatteignables aujourd’hui.' },
  { fichier: 'essais-indicateurs-navigateur.mjs', permanent: true, pourquoi: 'Idem : un historique d’indicateurs porte sur des jours révolus.' },
  { fichier: 'essais-adaptation-navigateur.mjs', permanent: true, pourquoi: 'L’usage observé porte sur huit semaines passées.' },
  { fichier: 'essais-faits-domaine-navigateur.mjs', permanent: true, pourquoi: 'Les faits de domaine éprouvés portent sur des jours antérieurs.' },
  { fichier: 'essais-export-ia-navigateur.mjs', permanent: true, pourquoi: 'L’export porte sur un historique, donc sur des jours passés.' },
  { fichier: 'essais-odyssee-navigateur.mjs', permanent: true, pourquoi: 'Les règles du jour s’éprouvent sur une fenêtre de sept jours révolus.' },
  { fichier: 'essais-initialisation-navigateur.mjs', permanent: true, pourquoi: 'L’initialisation allégée part d’une installation existante.' },
  {
    fichier: 'essais-bibliotheque-vide.mjs',
    permanent: true,
    pourquoi:
      'Une bibliothèque d’exercices vide. L’écran sait la produire, en trente-' +
      'deux suppressions confirmées une à une, mais ce n’est pas ce qui est ' +
      'éprouvé : c’est ce que la séance DIT une fois la bibliothèque vide.',
  },
  {
    fichier: 'essais-bascule-branchement.mjs',
    permanent: true,
    pourquoi:
      'Une bascule INTERROMPUE : une enveloppe et son sel posés sans que le ' +
      'reste ait suivi. Aucun écran ne produit un demi-changement de clé, et ' +
      'c’est l’état devant lequel le cadenas doit encore ouvrir.',
  },
  {
    fichier: 'essais-centre-navigateur.mjs',
    permanent: true,
    pourquoi:
      'Deux opérations concurrentes sur la même note, venues de deux ' +
      'appareils, à des horloges logiques choisies. Un désaccord suppose un ' +
      'second appareil : il ne se fabrique pas depuis un seul écran.',
  },
  {
    fichier: 'essais-pastille-revue.mjs',
    permanent: true,
    pourquoi:
      'La pastille se regarde dans ses DEUX états, dont celui où la revue ' +
      'd’un jour révolu existe déjà. L’écran ne sait pas écrire la revue ' +
      'd’hier, et un témoin qui s’allume toujours ne dit rien.',
  },
  {
    fichier: 'essais-rejeu-coffre.mjs',
    permanent: true,
    pourquoi:
      'Une série quotidienne ancrée huit jours en arrière, pour qu’une ' +
      'occurrence du jour existe à toute heure. L’écran ne crée pas une ' +
      'série passée, et l’essai ne doit pas dépendre de l’horloge.',
  },
  {
    fichier: 'essais-verrou-navigateur.mjs',
    permanent: true,
    pourquoi:
      'Un délai de verrou de trois secondes. Le réel est de quinze minutes et ' +
      'aucun réglage ne descend si bas : attendre quinze minutes ferait un ' +
      'essai que personne ne lance.',
  },
  {
    fichier: 'essais-phase6-ecrans.mjs',
    permanent: true,
    pourquoi:
      'Une tâche close il y a trois semaines, pour « Reprendre la série ». ' +
      'L’écran ne sait pas remonter le temps, et c’est précisément l’état que la règle vise.',
  },
];

/*
   Les parcours : ceux-là ne sèment RIEN. Leur objet est de prouver qu'un
   utilisateur peut créer un état ; le fabriquer serait prouver sa propre
   fabrication. C'est la liste qui porte la leçon d'A-16.
*/
const PARCOURS = [
  'essais-taches-parcours.mjs',
  'essais-branche-vers-tache.mjs',
  'essais-calendrier-occurrences.mjs',
  'essais-consentement-ecran.mjs',
  'essais-taches-recurrentes-ecran.mjs',
];

/*
   Une écriture EN BASE, et rien d'autre. Première version, le motif
   attrapait aussi `Set.add(` : sept essais de mise en page étaient accusés
   de semer des données. Un contrôle qui accuse à tort se fait désactiver,
   et c'est ainsi qu'on perd un garde-fou.
*/
const ECRITURE = /'readwrite'|"readwrite"|objectStore\([^)]*\)\s*\.(put|add|delete|clear)\(/;

let echecs = 0;
const dire = (ok, texte, detail) => {
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${texte}`);
  if (!ok && detail) console.log(`      ${detail}`);
};

/*
   Le contrôle s'exclut : il contient le mot « readwrite » dans son propre
   motif, et se serait accusé lui-même de semer. Une exclusion, pas une
   exception — il n'ouvre aucune base.
*/
const fichiers = readdirSync('scripts').filter(
  (f) => /^essais-.*\.mjs$/.test(f) && f !== 'essais-semis.mjs',
);
const sement = fichiers.filter((f) => ECRITURE.test(readFileSync(join('scripts', f), 'utf8')));

console.log('\n\x1b[1mLes parcours ne sèment rien\x1b[0m');
for (const parcours of PARCOURS) {
  if (!fichiers.includes(parcours)) {
    dire(false, `${parcours} est déclaré parcours mais n’existe pas`, 'Liste à corriger.');
    continue;
  }
  dire(
    !sement.includes(parcours),
    `${parcours} crée tout par les écrans`,
    'Il écrit en base. Un parcours qui fabrique son état prouve sa propre fabrication — c’est ainsi qu’A-16 a tenu quatre phases.',
  );
}

console.log('\n\x1b[1mTout semis est déclaré, avec sa raison\x1b[0m');
{
  const declares = new Map(SEMIS_DECLARES.map((d) => [d.fichier, d]));
  const nonDeclares = sement.filter((f) => !declares.has(f));
  dire(
    nonDeclares.length === 0,
    `${sement.length} essai(s) sèment, tous déclarés`,
    nonDeclares.length ? `Non déclarés : ${nonDeclares.join(', ')}` : '',
  );

  for (const d of SEMIS_DECLARES) {
    if (!d.pourquoi || d.pourquoi.length < 30) {
      dire(false, `${d.fichier} : sa raison est trop courte pour en être une`);
    }
  }

  /* Une déclaration périmée est un mensonge qui dort. */
  const perimes = SEMIS_DECLARES.filter((d) => !sement.includes(d.fichier));
  dire(
    perimes.length === 0,
    'aucune déclaration périmée',
    perimes.length ? `Ne sèment plus : ${perimes.map((d) => d.fichier).join(', ')}` : '',
  );
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} problème(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
