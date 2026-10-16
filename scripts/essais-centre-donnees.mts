/**
 * Le magasin du centre : ce qu'il refuse — prompt 32, phase 1.
 *
 *   npm run essais:centre-donnees
 *
 * Ce contrôle est **structurel**, et c'est délibéré : la couche de
 * données demande une base et un coffre ouvert, donc son comportement se
 * prouve au navigateur. Ce qui se prouve ici, en lisant les sources, ce
 * sont les propriétés qu'aucun parcours ne saurait garantir pour les
 * chemins que personne n'a encore écrits :
 *
 * 1. **le compte ne déchiffre pas.** `comptesDuCentre` ne doit appeler ni
 *    `exigerLeCoffre` ni `ouvrir` : la pastille vit coffre fermé, et elle
 *    ne vit que du `genre` laissé en clair par la décision N-1 ;
 * 2. **le filtre du cycle est appliqué À L'ÉCRITURE.** Filtrer à la
 *    lecture laisserait la donnée dans le magasin, donc dans une base
 *    qu'un autre appareil fusionne ;
 * 3. **le contexte de filtrage n'est jamais stocké.** Le § 2.3 veut un
 *    élément sans contenu ; la classe d'une molécule en est ;
 * 4. **le centre ne charge aucune branche.**
 *
 * La règle suivie, et elle vient de ce lot : *un contrôle se valide sur
 * le défaut qu'il vise.* Chacune est donc sabotée à la main avant d'être
 * déclarée tenue.
 *
 * ## Ce que ce contrôle NE prouve pas, et pourquoi c'est écrit ici
 *
 * Une sonde textuelle prouve qu'un garde-fou est **cité**. Elle ne prouve
 * jamais qu'il **agit** : le sabotage `if (false && !peutEtreRange(e))`
 * garde la mention, neutralise le refus, et ce fichier reste vert. Essayé,
 * constaté.
 *
 * Ce n'est pas réparable par une sonde plus fine — le texte ne dit pas ce
 * que le code fait. La preuve d'exécution du refus de ranger une question
 * (§ 1 n° 8) appartient donc à l'essai de navigateur de la phase 2, où un
 * vrai magasin et un vrai coffre existent. Jusque-là, la propriété est
 * **lue dans le code**, pas constatée, et la section 6 le dit à l'écran.
 */
import { readFileSync } from 'node:fs';
import {
  RETENTION_PAR_DEFAUT,
  peutEtreRange,
  sortDeLaRetention,
  type ElementDuCentre,
} from '../src/lib/notifications/modele';

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
const vrai = (t: string, c: boolean) => v(t, c, true);

/**
 * Une fonction absente rend un corps vide, et un corps vide passe toutes
 * les sondes d'absence. On exige donc d'abord qu'elle existe.
 */
const corpsDe = (nom: string): string => {
  const c = corps(nom);
  vrai(`\`${nom}\` existe (sinon toute sonde d’absence serait vraie à vide)`, c.length > 0);
  return c;
};

const source = readFileSync('src/lib/notifications/donnees.ts', 'utf8');
const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Le corps d'une fonction, pour l'examiner seule — exportée ou non.
 *
 * `changerLEtat` est interne : `marquerLu` et `archiver` n'en sont que les
 * deux portes. Un extracteur qui n'aurait cherché que des fonctions
 * exportées aurait rendu une chaîne vide, et une chaîne vide ne contient
 * aucun appel interdit : le contrôle aurait été vert **par cécité**. D'où
 * la garde `existe` ci-dessous, posée à chaque usage.
 */
function corps(nom: string): string {
  const debut = sansCommentaires.search(new RegExp(`(export )?async function ${nom}\\b`));
  if (debut < 0) return '';
  const suite = sansCommentaires.slice(debut);
  const fin = suite.indexOf('\n}\n');
  return fin < 0 ? suite : suite.slice(0, fin);
}

console.log('\n\x1b[1m1. Le compte ne déchiffre pas — la pastille vit coffre fermé\x1b[0m');
{
  const compte = corpsDe('comptesDuCentre');
  v('il n’exige pas le coffre', compte.includes('exigerLeCoffre'), false);
  v('et il n’ouvre rien', /\bouvrir[<(]/.test(compte), false);
  vrai('il lit le genre, laissé en clair par la décision N-1', compte.includes('genre'));
  /*
     Et il ne lève pas : une base absente rend zéro. Un compteur qui jette
     emporterait l'en-tête de toutes les pages.
  */
  vrai('une base absente rend zéro au lieu de lever', compte.includes('catch'));
}

console.log('\n\x1b[1m2. Le panneau, lui, exige le coffre\x1b[0m');
{
  const elements = corpsDe('elementsDuCentre');
  vrai('`elementsDuCentre` exige le coffre', elements.includes('exigerLeCoffre'));
  vrai('et déchiffre', elements.includes('ouvrir'));
}

console.log('\n\x1b[1m3. Le filtre du cycle est appliqué à L’ÉCRITURE\x1b[0m');
{
  const depot = corpsDe('deposer');
  vrai('`deposer` consulte le filtre', depot.includes('suitLaSensibiliteDuCycle'));
  /* Avant l'écriture, pas après : sinon la donnée existe déjà. */
  const filtre = depot.indexOf('suitLaSensibiliteDuCycle');
  const ecriture = depot.indexOf('.put(');
  vrai('et le consulte AVANT d’écrire', filtre >= 0 && ecriture > filtre);
  vrai('le refus est une valeur, pas une exception', depot.includes("quoi: 'ecarte'"));

  /* La lecture, elle, ne refiltre pas : ce serait avouer qu'on a laissé entrer. */
  v(
    '`elementsDuCentre` ne refiltre pas : rien d’interdit n’est jamais entré',
    corpsDe('elementsDuCentre').includes('suitLaSensibiliteDuCycle'),
    false,
  );
}

console.log('\n\x1b[1m4. Le contexte de filtrage n’est jamais stocké\x1b[0m');
{
  const depot = corpsDe('deposer');
  /*
     `sceller` reçoit `element`, et non un objet qui mêlerait l'élément au
     contexte. Une seule ligne sépare « un modèle sans contenu » de « un
     modèle qui porte une classe de molécule ».
  */
  vrai(
    'ce qui est scellé est l’élément seul',
    /sceller\(cle, MAGASIN, element as unknown/.test(depot),
  );
  v(
    'le contexte n’entre pas dans ce qui est écrit',
    /sceller\([^)]*contexte/.test(depot),
    false,
  );
}

console.log('\n\x1b[1m5. Le centre ne charge aucune branche\x1b[0m');
{
  const branches = ['faits-branches', 'faits-revisions', 'odyssee/donnees', 'sport/donnees'];
  const chargees = branches.filter((b) => sansCommentaires.includes(b));
  v('aucune branche importée', chargees, []);
}

console.log(
  '\n\x1b[1m6. Une question à trancher ne se range pas (§ 1 n° 8)\x1b[0m' +
    '\n   \x1b[2mLa règle pure est exécutée ; la délégation des deux écrivains n’est que LUE.\x1b[0m',
);
{
  const question: ElementDuCentre = {
    id: 'a',
    source: 'fusion',
    refSource: 'r',
    genre: 'a-trancher',
    creeLe: '2026-01-01',
    etat: 'non_lu',
    regroupement: null,
  };
  v('elle ne peut pas être rangée', peutEtreRange(question), false);
  v(
    'et la rétention ne la touche pas, même à deux ans',
    sortDeLaRetention(question, '2028-01-01', RETENTION_PAR_DEFAUT),
    'rien',
  );

  const avis: ElementDuCentre = { ...question, id: 'b', genre: 'a-savoir' };
  v('un avis, lui, s’archive à 30 jours', sortDeLaRetention(avis, '2026-02-15'), 'archiver');
  v('et se supprime à 180', sortDeLaRetention(avis, '2026-07-15'), 'supprimer');

  /*
     Et les deux écrivains délèguent à la règle pure, au lieu de rejuger.
     Sonde FAIBLE, et nommée telle : elle attrape la suppression du garde-
     fou, jamais sa neutralisation. Voir l'en-tête.
  */
  const etat = corpsDe('changerLEtat');
  vrai(
    '`changerLEtat` cite `peutEtreRange` (sonde faible : citation, pas effet)',
    etat.includes('peutEtreRange'),
  );
  vrai(
    'et `marquerLu` comme `archiver` passent par lui — une seule porte à garder',
    /return changerLEtat\(id, 'lu'\)/.test(sansCommentaires) &&
      /return changerLEtat\(id, 'archive'\)/.test(sansCommentaires),
  );
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
