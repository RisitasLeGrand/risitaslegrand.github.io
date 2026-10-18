/**
 * Les piles par onglet : le raisonnement, éprouvé sans navigateur.
 *
 * Trois questions, et la troisième est celle qui compte :
 *
 * 1. une position profonde est-elle attribuée au BON onglet, y compris quand
 *    un chemin en préfixe un autre (« /quiz/dgfip/ » commence par « /quiz/ ») ;
 * 2. la racine efface-t-elle la position, pour qu'on ne garde pas une pile
 *    qui ne dit rien ;
 * 3. **le second appui rembobine-t-il**, c'est-à-dire : être déjà dans
 *    l'onglet l'emporte-t-il sur la position retenue ? Sans cette priorité,
 *    le second appui ne ferait que recharger la page où l'on se trouve.
 */
import { BRANCHES } from '../src/lib/branches';
import { destination, ongletDuChemin, ongletParRacine, poser, type Piles } from '../src/lib/piles';

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

console.log('\nLA PRÉMISSE : DES ONGLETS DÉCLARÉS, ET AU MOINS DEUX IMBRIQUÉS');

const tous = BRANCHES.flatMap((b) => [...b.onglets, ...(b.annexes ?? [])]);
v('le registre n’est pas vide', tous.length > 0, true);
const imbriques = tous.filter((o) =>
  tous.some((autre) => autre !== o && o.chemin.startsWith(autre.chemin.replace(/\/$/, '/'))),
);
console.log(`      onglets imbriqués dans un autre : ${imbriques.map((o) => o.chemin).join(', ') || 'aucun'}`);

console.log('\nUN CHEMIN EST ATTRIBUÉ À L’ONGLET LE PLUS PRÉCIS');

for (const onglet of tous.slice(0, 6)) {
  v(`« ${onglet.chemin} » → ${onglet.id}`, ongletDuChemin(onglet.chemin)?.id, onglet.id);
}
if (imbriques.length) {
  const profond = imbriques[0];
  v(
    `« ${profond.chemin} » va au plus précis, pas au préfixe`,
    ongletDuChemin(profond.chemin)?.id,
    profond.id,
  );
} else {
  /*
     Aucun onglet imbriqué aujourd'hui : le tri par longueur est une
     prévention, et cet essai le dit plutôt que de faire semblant de le
     prouver. On éprouve alors la règle sur un chemin fabriqué, qui est le
     cas réel d'une page PROFONDE sous un onglet.
  */
  console.log('      (aucun onglet imbriqué : on éprouve sur une page profonde)');
}

const premier = tous[0];
const profond = `${premier.chemin}une-page-profonde/`;
v('une page profonde appartient à son onglet', ongletDuChemin(profond)?.id, premier.id);
v('un chemin hors registre n’appartient à personne', ongletDuChemin('/mot-de-passe-perdu/'), null);

console.log('\nLA POSE : LA RACINE N’EST PAS UNE POSITION');

let piles: Piles = {};
piles = poser(piles, profond);
v('une page profonde est retenue', piles[premier.chemin], profond);
piles = poser(piles, premier.chemin);
v('revenir à la racine efface la position', piles[premier.chemin], undefined);

console.log('\nLE SECOND APPUI REMBOBINE, MÊME AVEC UNE POSITION RETENUE');

piles = poser({}, profond);
v(
  'depuis ailleurs, l’onglet reprend sa position',
  destination(piles, premier, '/mot-de-passe-perdu/'),
  profond,
);
v(
  'depuis l’onglet lui-même, il remonte à la racine',
  destination(piles, premier, profond),
  premier.chemin,
);
v(
  'sans position retenue, il mène à la racine',
  destination({}, premier, '/mot-de-passe-perdu/'),
  premier.chemin,
);
v(
  'une position d’un autre onglet n’est jamais suivie',
  destination({ [premier.chemin]: '/un-ailleurs-quelconque/' }, premier, '/mot-de-passe-perdu/'),
  premier.chemin,
);
v('et l’onglet se retrouve par sa racine', ongletParRacine(premier.chemin)?.chemin, premier.chemin);

/*
   Le défaut trouvé en navigateur : « accueil » existe dans plusieurs
   branches. Une pile indexée par identifiant renvoyait l'accueil d'Odyssée
   sur celui de Révisions. Cet essai-ci ne pouvait pas le voir tant qu'il
   raisonnait sur un seul onglet ; il le voit maintenant.
*/
const homonymes = tous.filter((o) => tous.filter((a) => a.id === o.id).length > 1);
console.log(`      identifiants partagés par plusieurs branches : ${[...new Set(homonymes.map((o) => o.id))].join(', ') || 'aucun'}`);
v('il existe bien des identifiants homonymes', homonymes.length > 1, true);
for (const h of homonymes) {
  v(`« ${h.chemin} » se retrouve sans se confondre`, ongletParRacine(h.chemin)?.chemin, h.chemin);
}

console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
