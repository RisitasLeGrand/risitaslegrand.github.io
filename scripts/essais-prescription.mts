/**
 * Aucun verbe de prescription, hors citation sourcée — Santé, § 1 n° 2.
 *
 *   npm run essais:prescription
 *
 * ## Ce que ce contrôle est, et ce qu'il n'est pas
 *
 * **Ce n'est pas la phase 7.** Celle-ci demande la relecture de TOUS les
 * textes de Cyclades, et elle viendra avec son propre lot. Celui-ci porte
 * sur la surface de Santé — ses modules, ses écrans — parce que le prompt 52
 * l'exige de ses textes à lui : « L'essai de la phase 7 s'applique à tous
 * les nouveaux textes. » Il est écrit pour être étendu : on ajoute un
 * chemin à `SURFACE`, on ne réécrit rien.
 *
 * ## La distinction qui porte tout : l'impératif, pas l'indicatif
 *
 * « Ce que vous prenez » décrit ce que fait la personne. « Prenez-la
 * maintenant » lui dit quoi faire. Le premier est le vocabulaire ordinaire
 * d'un carnet de santé ; le second est l'acte médical qu'un logiciel n'a pas
 * le droit de poser. Une sonde qui chercherait « prenez » nu confondrait les
 * deux — essayé, constaté : elle rougissait sur la phrase d'accueil de
 * l'écran Santé.
 *
 * La règle retenue : un verbe de prescription précédé de « vous » (ou de
 * « tu ») est un indicatif et passe ; partout ailleurs, il est refusé.
 *
 * ## Les citations sourcées
 *
 * Un RCP peut parfaitement écrire « ne dépassez pas la dose prescrite », et
 * le citer n'est pas prescrire — c'est rapporter. Une ligne qui porte une
 * marque de citation est donc exemptée, et la marque est explicite : pas de
 * devinette sur des guillemets, qui servent à tout.
 *
 * ## Les commentaires sont retirés avant la lecture
 *
 * Ce qui est contrôlé est ce qui peut ATTEINDRE L'ÉCRAN, et un commentaire
 * ne l'atteint jamais. Sa première version les lisait, et elle a attrapé
 * deux lignes : « ce que je prends », titre d'une section du modèle, et un
 * commentaire de `rappels.ts` qui CITE l'interdiction — « ni "prenez-la
 * maintenant", ni "doublez", ni "sautez" ».
 *
 * La seconde est la plus instructive. Une sonde qui rougit sur un
 * commentaire expliquant la règle apprend à ne plus écrire la règle, et on
 * perd la seule chose qui explique pourquoi le code est ainsi. Les
 * commentaires sont donc retirés — pas exemptés au cas par cas, ce qui
 * aurait demandé une marque sur chacun et fini par en manquer un.
 *
 * ## Ce que ce contrôle NE prouve pas
 *
 * Il lit des **sources**, pas des pages. Un texte assemblé à l'exécution à
 * partir de morceaux innocents lui échapperait. C'est pourquoi la même sonde
 * tourne aussi dans `essais:sante:navigateur`, sur le texte RENDU de l'écran
 * — les deux se complètent, et aucune des deux ne suffit.
 */
import { readFileSync } from 'node:fs';

/**
 * Les verbes, et leur garde contre l'indicatif.
 *
 * `(?<!vous )` et `(?<!tu )` laissent passer « ce que vous prenez » et
 * refusent « Prenez-la ». La liste vise les formes que le § 1 n° 2 interdit
 * nommément — « prenez-la maintenant », « doublez », « sautez » — et les
 * voisines qui diraient la même chose.
 */
const PRESCRIPTIONS: readonly RegExp[] = [
  /(?<!vous )\bprenez\b/i,
  /(?<!tu )(?<!je )\bprends\b/i,
  /(?<!vous )\bdoublez\b/i,
  /(?<!vous )\bsautez\b/i,
  /(?<!vous )\bavalez\b/i,
  /(?<!vous )\binjectez\b/i,
  /(?<!vous )\baugmentez\b(?= la dose| votre dose| les doses)/i,
  /(?<!vous )\bdiminuez\b(?= la dose| votre dose| les doses)/i,
  /\barrêtez de prendre\b/i,
  /\bvous devriez (prendre|arrêter|doubler|sauter)\b/i,
  /(?<!vous )\brattrapez\b/i,
  /\bil faut (prendre|doubler|sauter)\b/i,
];

/** La marque qui exempte une ligne. Explicite, pour qu'elle se cherche. */
const MARQUE_DE_CITATION = 'CITATION SOURCÉE';

/**
 * Ce que le contrôle lit.
 *
 * Les modules de Santé et les écrans qui les montrent. `rappels.ts` y est
 * parce qu'il FABRIQUE du texte — c'est le seul du lot dans ce cas, et donc
 * celui où un conseil pourrait naître sans qu'aucun écran ne le porte.
 */
const SURFACE: readonly string[] = [
  'src/lib/odyssee/sante.ts',
  'src/lib/odyssee/sensible.ts',
  'src/lib/odyssee/rappels.ts',
  'src/lib/odyssee/rappels-ics.ts',
  'src/lib/odyssee/donnees-sante.ts',
  'src/lib/odyssee/donnees-sensible.ts',
  'src/lib/odyssee/molecules.ts',
  'src/pages/odyssee/sante.astro',
  'src/pages/odyssee/molecule.astro',
];

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

/**
 * Les lignes d'un fichier, commentaires retirés et **numéros conservés**.
 *
 * Les lignes retirées deviennent vides au lieu de disparaître : sans cela,
 * le numéro rapporté désignerait une autre ligne que celle en cause, et un
 * essai qui montre le mauvais endroit coûte plus de temps qu'il n'en fait
 * gagner.
 *
 * Le découpage est volontairement grossier — il ne distingue pas un `//`
 * dans une chaîne d'une vraie fin de ligne commentée. L'erreur qu'il peut
 * faire est de retirer un bout de texte, donc de rater une prescription,
 * jamais d'en inventer une. Pour le cas qu'il raterait, il y a la sonde du
 * navigateur, qui lit la page rendue.
 */
function sansCommentaires(contenu: string): string[] {
  let dansUnBloc = false;
  return contenu.split('\n').map((brute) => {
    let ligne = brute;
    if (dansUnBloc) {
      const fin = ligne.indexOf('*/');
      if (fin === -1) return '';
      ligne = ligne.slice(fin + 2);
      dansUnBloc = false;
    }
    /* Les blocs ouverts et fermés sur la même ligne, puis celui qui reste ouvert. */
    ligne = ligne.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    const ouverture = ligne.indexOf('/*');
    if (ouverture !== -1) {
      dansUnBloc = true;
      ligne = ligne.slice(0, ouverture);
    }
    const commentaireHtml = ligne.indexOf('<!--');
    if (commentaireHtml !== -1) {
      dansUnBloc = true;
      ligne = ligne.slice(0, commentaireHtml);
    }
    return ligne.replace(/\/\/.*$/, '');
  });
}

interface Trouvaille {
  fichier: string;
  ligne: number;
  texte: string;
}

function fouiller(chemin: string): Trouvaille[] {
  let contenu: string;
  try {
    contenu = readFileSync(chemin, 'utf8');
  } catch {
    /*
       Un fichier de la surface qui n'existe plus est un ÉCHEC, pas un
       silence : une surface qui rétrécit sans qu'on le dise ne garde plus
       ce qu'elle annonce.
    */
    return [{ fichier: chemin, ligne: 0, texte: 'fichier introuvable' }];
  }
  const trouvailles: Trouvaille[] = [];
  sansCommentaires(contenu).forEach((ligne, index) => {
    if (ligne.includes(MARQUE_DE_CITATION)) return;
    for (const motif of PRESCRIPTIONS) {
      if (motif.test(ligne)) {
        trouvailles.push({ fichier: chemin, ligne: index + 1, texte: ligne.trim().slice(0, 120) });
        return;
      }
    }
  });
  return trouvailles;
}

console.log('\nLA SONDE REFUSE CE QU’ELLE DOIT REFUSER');

/*
   UN CONTRÔLE SE VALIDE SUR LE DÉFAUT QU'IL VISE. Une sonde affinée peut
   l'être jusqu'à ne plus rien attraper, et elle resterait verte — le seul
   genre de vert qui ne prouve rien. On lui donne donc les phrases que le
   § 1 n° 2 interdit nommément.
*/
const PIEGES: readonly string[] = [
  'Prenez-la maintenant.',
  'Doublez la prochaine prise.',
  'Sautez celle-ci.',
  'Vous devriez prendre votre créatine.',
  'Il faut doubler la dose.',
  'Rattrapez la prise de ce matin.',
  'Arrêtez de prendre ce traitement.',
  'Augmentez la dose de 50 mg.',
];
v(
  'les huit conseils de rattrapage sont attrapés',
  PIEGES.filter((phrase) => !PRESCRIPTIONS.some((r) => r.test(phrase))),
  [],
);

console.log('\nET ELLE LAISSE PASSER CE QUI N’EST PAS UNE PRESCRIPTION');

/*
   L'autre moitié, et elle compte autant : une sonde qui déborde se fait
   désactiver, et on perd les deux. Ces phrases sont celles de l'écran — du
   vocabulaire de carnet, à l'indicatif.
*/
const INNOCENTES: readonly string[] = [
  'Ce que vous prenez, ce que vous faites doser, ce que vous ressentez.',
  'Le nom du traitement, tel que vous l’écrivez.',
  'Vous prenez de la créatine depuis le 1ᵉʳ octobre.',
  'Prévu à 8 h, rien n’est noté.',
  'Une prise sporadique, sans schéma ni rappel.',
];
v(
  'et les cinq phrases de carnet passent',
  INNOCENTES.filter((phrase) => PRESCRIPTIONS.some((r) => r.test(phrase))),
  [],
);

console.log('\nLA SURFACE DE SANTÉ N’ORDONNE RIEN');

const trouvailles = SURFACE.flatMap(fouiller);
for (const t of trouvailles) {
  console.error(`      ${t.fichier}:${t.ligne} — ${t.texte}`);
}
v('aucun verbe de prescription dans les textes de Santé', trouvailles.length, 0);
/*
   Et la surface est bien celle qu'on annonce : un fichier retiré de la liste
   sans raison ferait rétrécir le contrôle en silence.
*/
v('la surface compte neuf fichiers', SURFACE.length, 9);

console.log(
  echecs === 0
    ? '\n\x1b[32mAucun verbe de prescription.\x1b[0m\n'
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
