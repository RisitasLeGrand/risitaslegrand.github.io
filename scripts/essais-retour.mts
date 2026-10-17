/**
 * Le retour en arrière : où mène la flèche.
 *
 * Ce que ces essais protègent n'est pas l'existence de la flèche — un essai de
 * navigateur s'en charge — mais sa **destination**. Une flèche qui remonte au
 * mauvais écran est pire qu'une flèche absente : elle déplace sans prévenir, et
 * on ne s'en aperçoit qu'une fois ailleurs.
 *
 * Le piège que ces essais visent nommément : `brancheDuChemin` répond par
 * préfixe et rend Révisions par défaut, de sorte que `/syntheses/` — onglet
 * déclaré d'Odyssée, hébergé hors de `/odyssee/` — lui tombe dans Révisions.
 * Une flèche bâtie dessus aurait renvoyé une page d'Odyssée au tableau de bord
 * des Révisions.
 */
import { BRANCHES, ECRANS_COMMUNS } from '../src/lib/branches';
import { nomDuParent, normaliser, parentLogique } from '../src/lib/retour';

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

console.log("\nL'ACCUEIL N'A PAS DE PARENT");

v("le menu rend null, et c'est ce qui retire la flèche", parentLogique('/'), null);
v('la base ne change rien à la réponse', parentLogique('/index.html'), null);

console.log('\nLES ÉCRANS DISPERSÉS REMONTENT DANS LEUR BRANCHE DÉCLARÉE');

/*
   Les quatre cas que le préfixe seul rate. Ils sont écrits en toutes lettres
   plutôt que dérivés du registre : une attente calculée par la même règle que
   le code validerait la règle par elle-même.
*/
v('« Mes synthèses » est un onglet d’Odyssée, pas de Révisions', parentLogique('/syntheses/'), '/odyssee/');
v('« QCM — DGFiP » remonte à « Quiz », son écran englobant', parentLogique('/quiz/dgfip/'), '/quiz/');
v('« Santé » remonte au tableau de bord d’Odyssée', parentLogique('/odyssee/sante/'), '/odyssee/');
v('« Cartes » n’a pas d’écran englobant : il remonte à sa branche', parentLogique('/flashcards/'), '/revisions/');

console.log('\nLES RACINES ET LES ÉCRANS COMMUNS REMONTENT AU MENU');

for (const b of BRANCHES) {
  v(`la racine de ${b.libelle} remonte au menu`, parentLogique(b.racine), '/');
}
for (const o of ECRANS_COMMUNS) {
  v(`« ${o.nom} » n’a pas de branche : il remonte au menu`, parentLogique(o.chemin), '/');
}

console.log('\nAUCUNE FLÈCHE NE MÈNE HORS DU REGISTRE');

/*
   Le parent de **tout** écran déclaré doit être lui-même un écran déclaré, ou
   le menu. Sans ce contrôle, un chemin mal orthographié dans le registre
   produirait une flèche vers une page qui n'existe pas — une erreur 404 que
   rien d'autre ne verrait, puisque le lien est fabriqué à l'exécution.
*/
const declares = new Set<string>([
  '/',
  ...BRANCHES.flatMap((b) => [
    b.racine,
    ...[...b.onglets, ...(b.annexes ?? [])].map((o) => o.chemin),
  ]),
  ...ECRANS_COMMUNS.map((o) => o.chemin),
]);

const horsRegistre: string[] = [];
const sansNom: string[] = [];
for (const chemin of declares) {
  if (chemin === '/') continue;
  const parent = parentLogique(chemin);
  if (parent === null || !declares.has(parent)) horsRegistre.push(`${chemin} → ${parent}`);
  if (!nomDuParent(chemin)) sansNom.push(chemin);
}
v('chaque écran déclaré remonte vers un écran déclaré', horsRegistre, []);
v('et la flèche sait nommer sa destination, partout', sansNom, []);

console.log("\nCE QUE CES ESSAIS NE PROUVENT PAS ENCORE");

/*
   Le tri « plus long englobant d'abord » est **inerte aujourd'hui**, et il
   faut le dire plutôt que de le laisser croire vérifié : l'inverser ne fait
   rougir aucun essai, parce qu'aucun écran déclaré n'a deux ancêtres déclarés
   imbriqués. Il existe donc en prévention — pour que le premier écran imbriqué
   reçoive le parent attendu, et non son grand-parent.

   Cette assertion-ci surveille cet angle mort : le jour où un tel écran est
   déclaré, elle passe au rouge et demande qu'on vérifie la règle pour de bon,
   au lieu de laisser le tri décider en silence.
*/
const imbriques = [...declares]
  .filter((c) => c !== '/')
  .map((c) => ({
    c,
    ancetres: [...declares].filter((e) => e !== c && e !== '/' && normaliser(c).startsWith(normaliser(e))),
  }))
  .filter((x) => x.ancetres.length > 1)
  .map((x) => `${x.c} ← ${x.ancetres.join(', ')}`);
v(
  'aucun écran n’a deux ancêtres déclarés — sinon, écrire l’essai du tri',
  imbriques,
  [],
);

console.log('\nUNE FLÈCHE NE TOURNE JAMAIS EN ROND');

/*
   Remonter de parent en parent doit atteindre le menu. Une boucle — deux
   écrans parents l'un de l'autre — ferait une flèche qui ne mène nulle part,
   et le contrôle précédent ne la verrait pas : les deux chemins sont déclarés.
*/
const boucles: string[] = [];
for (const depart of declares) {
  let courant: string | null = depart;
  const vus = new Set<string>();
  for (let i = 0; i < 12 && courant !== null; i += 1) {
    if (vus.has(courant)) {
      boucles.push(`${depart} boucle sur ${courant}`);
      break;
    }
    vus.add(courant);
    courant = parentLogique(courant);
  }
  if (courant !== null && !boucles.some((b) => b.startsWith(depart))) {
    boucles.push(`${depart} n’atteint pas le menu en 12 pas`);
  }
}
v('toute remontée atteint le menu', boucles, []);

console.log('\nLA DESTINATION SE DIT EN FRANÇAIS');

v('le parent du menu ne se nomme pas', nomDuParent('/'), '');
v('une racine de branche se nomme par son libellé', nomDuParent('/odyssee/sante/'), 'Odyssée');
v('un écran englobant se nomme par son nom d’onglet', nomDuParent('/quiz/dgfip/'), 'Quiz');
v('le menu se nomme « l’accueil »', nomDuParent('/profil/'), 'l’accueil');

console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
