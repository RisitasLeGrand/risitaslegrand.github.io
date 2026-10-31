/**
 * La politique de restauration selon le `.schema` — point 1 de la voie 58 p2.
 *
 *   npm run essais:politique-restauration
 *
 * ## Ce que ce contrôle éprouve
 *
 * Le module est PUR : il ne lit ni base, ni DOM, ni réseau. On lui donne ce
 * qu'un en-tête annonce et la version locale, il rend un verdict. Tout se
 * contrôle donc ici, sans navigateur — et c'est exactement pour cela que la
 * décision a été écrite dans un module à part plutôt que dans le corps de
 * `restaurer()`.
 *
 * ## Ce qu'il NE prouve pas
 *
 * Que le refus arrive bien AVANT toute écriture. C'est une propriété de
 * `service.ts`, pas de la politique : elle se mesure au navigateur, en
 * comptant la base après un refus. Noté ici comme non constaté plutôt que
 * sous-entendu tenu.
 */
import { readFileSync } from 'node:fs';
import {
  PALIERS_QUI_TRANSFORMENT,
  PALIER_FSRS,
  SCHEMA_INDETERMINE,
  paliersARejouer,
  verdictDUnFichier,
  verdictPourUneVersion,
} from '../src/lib/sauvegarde/politique-de-restauration';

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

/*
   LA VERSION LOCALE EST LUE À LA SOURCE, et non recopiée.

   La recopier serait répéter exactement la faute G-7 que ce lot corrige : une
   constante écrite à la main est restée à 12 pendant que la base montait à 43.
   On lit donc `db.ts`, et si la lecture échoue l'essai REFUSE de mesurer au
   lieu de prendre une valeur par défaut — un analyseur cassé rend zéro, ce qui
   ressemble à un dépôt propre.
*/
const SOURCE_DB = readFileSync(new URL('../src/lib/db.ts', import.meta.url), 'utf8');
const TROUVE = /^export const VERSION = (\d+);$/m.exec(SOURCE_DB);
if (!TROUVE) {
  console.log(
    '  \x1b[31m✗\x1b[0m NON MESURABLE — « export const VERSION » n’a pas été trouvé dans db.ts',
  );
  process.exit(3);
}
const VERSION = Number(TROUVE[1]);
console.log(`\n\x1b[1mLA POLITIQUE DE RESTAURATION\x1b[0m   (version locale lue : ${VERSION})`);

console.log('\n  Ce que le fichier n’annonce pas');
{
  const r = verdictPourUneVersion(null, VERSION);
  v('une version absente se restaure', r.quoi, 'restaure');
  v('sans rejouer aucun palier', r.quoi === 'restaure' ? r.paliers : null, []);
  vrai(
    'et la phrase dit que la version d’origine est inconnue',
    r.quoi === 'restaure' && /ne dit pas de quelle version/.test(r.dire ?? ''),
  );
  /*
     Le 12 n'est pas une version : c'est la constante fausse d'avant G-7. Le
     verdict doit donc être le MÊME que pour une version absente, mot pour mot.
  */
  const douze = verdictPourUneVersion(SCHEMA_INDETERMINE, VERSION);
  v('et « 12 » est traité exactement comme une absence', douze, r);
}

console.log('\n  Une version plus récente est refusée');
{
  const r = verdictPourUneVersion(VERSION + 1, VERSION);
  v('le verdict est un refus', r.quoi, 'refus');
  v('et il dit pourquoi', r.quoi === 'refus' ? r.motif : null, 'schema-trop-recent');
  vrai(
    'la phrase dit que rien n’a été touché',
    r.quoi === 'refus' && /Rien n’a été touché/.test(r.dire),
  );
  vrai(
    'et elle dit quoi faire : recharger',
    r.quoi === 'refus' && /[Rr]echargez/.test(r.dire),
  );
  /* Très au-dessus aussi : le refus ne dépend pas de l'écart. */
  v('une version très supérieure est refusée de même', verdictPourUneVersion(VERSION + 99, VERSION).quoi, 'refus');
}

console.log('\n  La version locale : rien à faire, rien à dire');
{
  const r = verdictPourUneVersion(VERSION, VERSION);
  v('on restaure', r.quoi, 'restaure');
  v('aucun palier', r.quoi === 'restaure' ? r.paliers : null, []);
  /*
     ET AUCUNE PHRASE. Un bandeau qui paraît quand tout va bien se lit une
     fois puis s'ignore, et le jour où il dit quelque chose, personne ne le
     voit plus. C'est la même règle que le centre : il n'y a de texte que
     lorsqu'il reste quelque chose à dire.
  */
  v('et pas un mot', r.quoi === 'restaure' ? r.dire : 'rien', null);
}

console.log('\n  Une version antérieure : on rejoue ce qui transforme');
{
  v(
    'depuis 10, les quatre paliers de transformation',
    paliersARejouer(10, VERSION),
    [11, 12, 13, 14],
  );
  v('depuis 13, seul le quatorzième reste', paliersARejouer(13, VERSION), [14]);
  v('depuis 14, plus rien à rejouer', paliersARejouer(14, VERSION), []);
  /*
     EN DESSOUS DE 7, LE BLOC FSRS AUSSI. Il n'est pas gardé par `vers(n)` mais
     par `ancienneVersion >= 1 && < 7`, donc il ne porte pas de numéro de
     palier : la politique le désigne par sa borne haute.
  */
  v('depuis 5, le bloc FSRS s’ajoute', paliersARejouer(5, VERSION), [7, 11, 12, 13, 14]);
  v('depuis 7, il ne s’ajoute plus', paliersARejouer(7, VERSION), [11, 12, 13, 14]);

  const r = verdictPourUneVersion(10, VERSION);
  v('et le verdict les porte', r.quoi === 'restaure' ? r.paliers : null, [11, 12, 13, 14]);
  vrai(
    'avec une phrase qui annonce la mise à la forme actuelle',
    r.quoi === 'restaure' && /mises à la forme actuelle/.test(r.dire ?? ''),
  );
}

console.log('\n  Plusieurs branches : le refus est contagieux, le rejeu est l’union');
{
  v('deux branches à jour : rien à dire', verdictDUnFichier([VERSION, VERSION], VERSION).dire ?? null, null);
  v(
    'une seule branche trop récente refuse le fichier entier',
    verdictDUnFichier([VERSION, VERSION + 1], VERSION).quoi,
    'refus',
  );
  const union = verdictDUnFichier([VERSION, 10], VERSION);
  v(
    'les paliers sont l’union des besoins',
    union.quoi === 'restaure' ? union.paliers : null,
    [11, 12, 13, 14],
  );
  /*
     LE DOUTE GAGNE. Une branche dont on ne peut rien déduire interdit de
     transformer les AUTRES : une base à moitié d'une forme et à moitié d'une
     autre est pire que des données laissées telles quelles, parce que plus
     personne ne peut dire ce qu'elle contient.
  */
  const doute = verdictDUnFichier([10, SCHEMA_INDETERMINE], VERSION);
  v('une branche indéterminée interdit tout rejeu', doute.quoi === 'restaure' ? doute.paliers : null, []);
  vrai(
    'et le dit',
    doute.quoi === 'restaure' && /ne dit pas de quelle version/.test(doute.dire ?? ''),
  );
  v('une liste vide vaut une absence', verdictDUnFichier([], VERSION).quoi, 'restaure');
}

console.log('\n  \x1b[1mSABOTAGE\x1b[0m — ce que la prudence sur « 12 » empêche vraiment');
{
  /*
     LE SABOTAGE PORTE SUR LA DÉCISION, PAS SUR LE CODE DU MODULE.

     On reconstruit la politique SANS le cas particulier du 12 — c'est-à-dire
     la version naïve, celle qu'on écrit quand on croit que `.schema` dit la
     vérité — et on montre ce qu'elle ferait d'un fichier annonçant 12.

     Si cette assertion tombait, cela voudrait dire que traiter le 12 comme une
     version ordinaire ne change rien, donc que le cas particulier ne sert à
     rien. Elle établit qu'il sert, et à quoi : elle nomme les paliers qui
     seraient rejoués à tort, dont le 12 lui-même, qui crée des entrées de
     socle que rien ne dédoublonne, et le 13, qui réécrirait des clés déjà
     stables.
  */
  const naive = paliersARejouer(SCHEMA_INDETERMINE, VERSION);
  v('sans le cas particulier, on rejouerait des paliers', naive, [13, 14]);
  vrai('dont le treizième, qui réécrit des clés déjà stables', naive.includes(13));
  const prudent = verdictPourUneVersion(SCHEMA_INDETERMINE, VERSION);
  v('avec le cas particulier, on n’en rejoue aucun', prudent.quoi === 'restaure' ? prudent.paliers : null, []);
  vrai('et les deux verdicts diffèrent bien', naive.length > 0);

  /*
     Et le second sabotage, sur le sens de « strictement au-dessus » : un
     fichier écrit en version N a déjà traversé le palier N. Le rejouer serait
     une seconde passe, et deux des cinq paliers ne la supportent pas.
  */
  vrai('un palier n’est jamais rejoué sur la version qui l’a déjà vu', !paliersARejouer(13, VERSION).includes(13));
  vrai('ni le douzième depuis la douzième', !paliersARejouer(12, VERSION).includes(12));
}

console.log('\n  Le registre des paliers se tient');
{
  v('quatre paliers numérotés transforment des données', [...PALIERS_QUI_TRANSFORMENT], [11, 12, 13, 14]);
  v('et le bloc FSRS est désigné par sa borne haute', PALIER_FSRS, 7);
  /*
     ILS EXISTENT VRAIMENT DANS `db.ts`. Une liste qui nommerait un palier
     disparu ferait rejouer du vide, et le silence serait complet.
  */
  for (const n of PALIERS_QUI_TRANSFORMENT) {
    vrai(`le palier ${n} existe dans db.ts`, SOURCE_DB.includes(`if (vers(${n}))`));
  }
  vrai(
    'et le bloc FSRS y est sous sa vraie garde',
    /ancienneVersion >= 1 && ancienneVersion < 7/.test(SOURCE_DB),
  );
  /* Aucun palier au-dessus de la version locale : la liste ne doit pas devancer la base. */
  v(
    'aucun palier de la liste ne dépasse la version locale',
    PALIERS_QUI_TRANSFORMENT.filter((n) => n > VERSION),
    [],
  );
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec${echecs > 1 ? 's' : ''}.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
