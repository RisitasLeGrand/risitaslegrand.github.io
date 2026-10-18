/**
 * M6 — aucune action n'existe par le seul geste.
 *
 *   npm run essais:registre-gestes
 *
 * ## Pourquoi un registre, et non un essai de navigateur
 *
 * « Aucune action seulement par geste (balayage, appui long) : chacune a un
 * bouton. » C'est une règle **négative** : elle dit ce qui ne doit pas
 * exister. Un essai de navigateur ne peut pas la tenir — il faudrait
 * imaginer tous les balayages possibles sur tous les écrans, et un essai
 * qui ne trouve rien ne prouve rien. On prend donc le problème par la
 * source : on relève **tous** les écouteurs de geste du code, et on exige
 * que chacun soit inscrit ici avec la raison pour laquelle il n'est pas
 * une action.
 *
 * Le contrôle attrape la régression qui compte : quelqu'un — moi — qui
 * ajoute demain un balayage pour supprimer une carte, ou un appui long
 * pour renommer. Le nouvel écouteur ne sera pas au registre, et l'essai
 * virera au rouge en nommant le fichier et la ligne.
 *
 * ## Le registre se périme dans les deux sens
 *
 * Une entrée qui ne correspond plus à rien est aussi fautive qu'un
 * écouteur absent du registre : elle laisserait croire que quelqu'un a
 * regardé, alors que le code a bougé sous elle. Les deux sens sont donc
 * vérifiés.
 *
 * ## Ce que le relevé couvre, et ce qu'il ne couvre pas
 *
 * Il couvre les noms d'événements de geste, écrits en clair, sous les deux
 * formes que ce dépôt emploie : `addEventListener('touchstart', …)` et la
 * liste `['pointerdown', 'keydown', …]` parcourue ensuite. Il ne couvre
 * pas un nom d'événement construit à l'exécution (`'touch' + 'start'`) :
 * rien de tel n'existe ici, et un relevé textuel ne saurait pas le voir.
 * C'est la limite de la méthode, et elle est écrite plutôt que tue.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Les événements par lesquels une action pourrait passer sans bouton. */
const GESTES = [
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'contextmenu',
  'dblclick',
  'gesturestart',
  'gesturechange',
  'gestureend',
];

/**
 * Le registre : un écouteur de geste par ligne, avec sa raison.
 *
 * Chaque entrée dit **ce que le geste déclenche**. Aucune ne doit
 * déclencher une écriture ni une action que seul ce geste permettrait.
 */
const REGISTRE: { fichier: string; gestes: string[]; quoi: string }[] = [
  {
    fichier: 'src/lib/defilement.ts',
    gestes: ['touchstart'],
    quoi:
      'Abandonne la restauration de position dès que la personne défile elle-même. ' +
      'Ne déclenche rien : empêche seulement le code de la tirer en arrière.',
  },
  {
    fichier: 'src/lib/coffre.ts',
    gestes: ['pointerdown'],
    quoi:
      'Marque l’activité pour repousser la fermeture automatique du coffre. ' +
      'N’écrit rien, et le coffre s’ouvre et se ferme par ses deux boutons.',
  },
  {
    fichier: 'src/lib/temps.ts',
    gestes: ['pointerdown'],
    quoi: 'Marque l’activité pour le calcul du temps passé. Observation seule.',
  },
  {
    fichier: 'src/pages/glossaire.astro',
    gestes: ['touchstart'],
    quoi:
      'Abandonne le défilement automatique vers le terme visé dès que la ' +
      'personne défile. Même raison que defilement.ts.',
  },
  {
    fichier: 'src/pages/fiche.astro',
    gestes: ['pointerdown'],
    quoi:
      'Referme le bouton flottant de sélection quand on appuie à côté. Fermer ' +
      'une surface n’est pas une action : le bouton lui-même reste le seul ' +
      'moyen de demander quoi que ce soit.',
  },
];

let rouges = 0;
const verifier = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};

/** Tous les fichiers de source où un écouteur peut vivre. */
function fichiers(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) {
      trouves.push(...fichiers(chemin));
      continue;
    }
    if (/\.(ts|astro|svelte|js|mjs)$/.test(entree)) trouves.push(chemin);
  }
  return trouves;
}

/**
 * Les gestes cités par un fichier, hors commentaires.
 *
 * Les commentaires sont retirés d'abord : plusieurs d'entre eux parlent du
 * balayage et de l'appui long pour expliquer pourquoi ils n'existent pas.
 * Les compter accuserait à tort exactement les endroits qui tiennent la
 * règle, et un contrôle qui accuse à tort se fait désactiver.
 */
function gestesDe(source: string): string[] {
  const sansCommentaires = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/<!--[\s\S]*?-->/g, '');
  return GESTES.filter((g) =>
    new RegExp(`['"\`]${g}['"\`]`).test(sansCommentaires),
  );
}

const releve = new Map<string, string[]>();
for (const chemin of fichiers('src')) {
  const trouves = gestesDe(readFileSync(chemin, 'utf8'));
  if (trouves.length) releve.set(chemin.replace(/\\/g, '/'), trouves);
}

console.log('\nLE RELEVÉ COUVRE QUELQUE CHOSE');
/*
   La prémisse : un relevé qui ne trouve aucun écouteur ne prouve pas que
   l'application n'en a pas — il prouve que la recherche est cassée. On
   exige donc d'en trouver, avant de conclure quoi que ce soit.
*/
verifier('des écouteurs de geste existent bien dans le code', releve.size > 0, true);

console.log('\nCHAQUE ÉCOUTEUR DE GESTE EST INSCRIT AU REGISTRE');
const inscrits = new Map(REGISTRE.map((e) => [e.fichier, e]));
for (const [fichier, gestes] of [...releve].sort()) {
  const entree = inscrits.get(fichier);
  if (!entree) {
    console.log(
      `\x1b[31m✗\x1b[0m ${fichier} écoute ${gestes.join(', ')} et n’est pas au registre.\n` +
        '    Si ce geste déclenche une action, il lui faut un bouton (M6).\n' +
        '    S’il n’en déclenche aucune, inscrivez-le ici avec sa raison.',
    );
    rouges += 1;
    continue;
  }
  verifier(`${fichier} — les gestes écoutés sont ceux du registre`, gestes, entree.gestes);
}

console.log('\nET LE REGISTRE NE PARLE PAS DANS LE VIDE');
for (const entree of REGISTRE) {
  if (releve.has(entree.fichier)) continue;
  console.log(
    `\x1b[31m✗\x1b[0m ${entree.fichier} est au registre mais n’écoute plus aucun geste : l’entrée a survécu au code.`,
  );
  rouges += 1;
}
if (REGISTRE.every((e) => releve.has(e.fichier))) {
  console.log('\x1b[32m✓\x1b[0m les cinq entrées correspondent toutes à du code vivant');
}

console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
