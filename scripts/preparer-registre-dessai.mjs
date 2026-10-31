/**
 * UN REGISTRE DE MOLÉCULES D'ESSAI, POUR ATTEINDRE LE CAS « ADMIS ».
 *
 *   node scripts/preparer-registre-dessai.mjs
 *
 * ## Pourquoi cette préparation existe
 *
 * `filtre-cycle.ts` écarte du centre de notifications tout rappel de prise
 * dont la classe de molécule est inconnue — option (a), 19 octobre. Pour
 * mesurer l'autre issue, celle où le rappel **paraît**, il faut une molécule
 * dont la classe est connue ET hors cycle.
 *
 * Aucune des cinq molécules du catalogue n'en porte, et c'est voulu : la
 * classe est une donnée de contenu, renseignée depuis les RCP en phase C. Sans
 * fixture, l'essai ne pourrait mesurer qu'un seul des trois chemins, et son
 * vert ne dirait rien du plus important.
 *
 * ## Les trois entrées, et pourquoi exactement trois
 *
 * Une par issue du filtre, pour que les trois soient mesurées dans le même
 * passage : hors cycle (admise), du cycle (écartée), sans classe (écartée).
 * Les deux dernières se ressemblent à l'écran et diffèrent par la raison —
 * c'est précisément ce que `recenserEtConsigner` consigne depuis le
 * 31 octobre, et un essai qui n'en mesurerait qu'une les confondrait.
 *
 * ## Ce que cette fixture ne fait JAMAIS
 *
 * **Elle ne remplace pas un registre réel.** Si `content/sante/molecules.json`
 * existe, ce script n'y touche pas et le dit : écraser le registre de
 * quelqu'un pour faire passer un essai serait détruire des données de santé
 * pour un vert.
 *
 * Et les noms sont ceux d'une fixture, pas ceux de molécules : « Essai »
 * figure dans chacun. Une liste de molécules est un écran de santé — y
 * laisser des noms plausibles inventés tromperait quelqu'un qui l'ouvrirait
 * sans savoir qu'un essai est passé par là.
 *
 * `content/` n'est jamais commité : cette fixture ne quitte donc pas la
 * machine qui la fabrique.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const racine = path.resolve(import.meta.dirname, '..');
const dossier = path.join(racine, 'content', 'sante');
const chemin = path.join(dossier, 'molecules.json');

if (existsSync(chemin)) {
  console.log(
    'Registre des molécules : un fichier existe déjà, il n’est pas remplacé.\n' +
      '  Les essais qui demandent la fixture refuseront en le disant, plutôt que\n' +
      '  d’écraser un registre réel.',
  );
  process.exit(0);
}

/*
   LA SOURCE EST CELLE D'UNE FIXTURE, ET ELLE LE DIT. `controlerRegistre`
   exige qu'une classe porte sa source ; écrire ici une fausse référence de
   document — « Thésaurus, p. 17 » — ferait croire à une classification
   sourcée. La garde est satisfaite par une source VRAIE : celle-ci est une
   fixture d'essai, et c'est ce que la chaîne dit.
*/
const SOURCE = 'Fixture d’essai de Cyclades — aucune source documentaire, aucun usage réel.';

/* Trié par nom, comme « controlerRegistre » l'exige. */
const registre = [
  {
    id: 'essai-hors-cycle',
    nom: 'Essai — classe hors cycle',
    alias: [],
    nomenclature: null,
    fiche: false,
    identiteVerifiee: false,
    classe: 'androgenes',
    classeSource: SOURCE,
  },
  {
    id: 'essai-sans-classe',
    nom: 'Essai — sans classe',
    alias: [],
    nomenclature: null,
    fiche: false,
    identiteVerifiee: false,
  },
  {
    id: 'essai-du-cycle',
    nom: 'Essai — classe du cycle',
    alias: [],
    nomenclature: null,
    fiche: false,
    identiteVerifiee: false,
    classe: 'contraceptif',
    classeSource: SOURCE,
  },
].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));

mkdirSync(dossier, { recursive: true });
writeFileSync(chemin, `${JSON.stringify(registre, null, 2)}\n`);
console.log(
  `✓ Fixture écrite : content/sante/molecules.json, ${registre.length} entrées d’essai.\n` +
    '  Une par issue du filtre du cycle : hors cycle, du cycle, sans classe.\n' +
    '  Reconstruisez le contenu pour qu’elle atteigne le site : npm run contenu.\n' +
    '  Pour l’ôter : supprimez le fichier et reconstruisez.',
);
