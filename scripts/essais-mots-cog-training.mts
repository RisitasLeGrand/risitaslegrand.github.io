/**
 * Aucun terme technique ne s'affiche seul, dans Entraînement cognitif.
 *
 *   npm run essais:mots-cog
 *
 * ## Pourquoi un essai de source, et non de navigateur
 *
 * Les termes paraissent dans des écrans dont le contenu est TIRÉ AU SORT :
 * « transmodale » n'apparaît que si la paire tirée l'est, « amorçage » que
 * pendant les premiers tours. Un essai de navigateur ne verrait donc qu'une
 * partie des cas, et sa couverture varierait d'un passage à l'autre — il
 * passerait au vert le jour où le tirage évite le terme.
 *
 * Celui-ci lit le texte visible des composants : il voit tous les cas, y
 * compris ceux qu'un tirage montre une fois sur cent.
 *
 * ## La règle
 *
 * Dans le texte visible, un terme de la table ne peut paraître que si son
 * équivalent simple paraît tout près — même ligne, ou l'une des deux
 * précédentes, parce qu'un gabarit coupe ses phrases à quatre-vingts
 * colonnes.
 *
 * ## Les exceptions, et leur raison
 *
 * Chacune porte la sienne, et l'essai refuse une exception périmée : le jour
 * où le fichier n'emploie plus le terme, l'exception doit disparaître avec
 * lui, sinon elle couvre un défaut futur que personne n'a décidé.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GLOSSAIRE } from '../src/features/cog-training/glossaire';

const FICHIERS = [
  'src/features/quad-n-back/composants/QuadNBack.svelte',
  'src/features/quad-n-back/composants/Grille.svelte',
  'src/features/quad-n-back/composants/Cellule.svelte',
  'src/features/relational-reasoning/composants/RelationalReasoning.svelte',
  'src/features/relational-reasoning/composants/Statistiques.svelte',
  'src/features/relational-reasoning/composants/Bloc.svelte',
  'src/features/relational-reasoning/composants/Comprendre.svelte',
  'src/features/veridical-mapping/composants/VeridicalMapping.svelte',
  'src/features/veridical-mapping/composants/TableauDeBord.svelte',
  'src/features/veridical-mapping/composants/Stimulus.svelte',
  'src/pages/cog-training/index.astro',
];

/**
 * Les noms des types de questions, affichés à l'écran par « nomMoteur ».
 *
 * Ils sont examinés à part parce qu'ils ne sont pas du texte de composant : ce
 * sont des champs « nom » déclarés dans les moteurs. Mon essai ne les regardait
 * pas, et il était vert pendant que l'écran affichait « Isomorphisme partiel »
 * et « Prémisse manquante ». Un essai qui ne voit pas la moitié de l'écran
 * rassure à tort.
 */
const NOMS_DE_MOTEURS = 'src/features/relational-reasoning/moteurs';

/** Un terme toléré seul dans un fichier, avec la raison. */
interface Exception {
  fichier: string;
  terme: string;
  raison: string;
}

const EXCEPTIONS: Exception[] = [
  {
    fichier: NOMS_DE_MOTEURS,
    terme: '*',
    raison:
      'les noms des types de questions — « Algèbre cachée », « Isomorphisme ' +
      'partiel », « Prémisse manquante »… — portent le jargon dans leur NOM, ' +
      'et un nom n’est pas une phrase : « la règle que suit une relation ' +
      '(algèbre) cachée » n’est pas un nom. Les renommer est une décision de ' +
      'contenu sur vingt moteurs, hors du lot ; elle est remontée au Pilote. ' +
      'Le glossaire couvre les termes, et cette exception existe pour que le ' +
      'manque soit DÉCLARÉ plutôt qu’invisible',
  },
  {
    fichier: 'src/features/veridical-mapping/composants/TableauDeBord.svelte',
    terme: 'seuil',
    raison:
      'la décision 6 nomme ce panneau « Mes seuils » ; sa phrase d’ouverture ' +
      'définit le mot juste en dessous, ce qui est l’équivalent demandé, mais ' +
      'sur plusieurs lignes',
  },
  {
    fichier: 'src/features/veridical-mapping/composants/VeridicalMapping.svelte',
    terme: 'seuil',
    raison:
      'l’exercice mesure des seuils : le mot est dans son titre de panneau et ' +
      'dans ses libellés de réglage, où la consigne et le bilan le définissent ' +
      'déjà en clair',
  },
];

let rouges = 0;
const dire = (texte: string) => {
  console.log(`\x1b[31m✗\x1b[0m ${texte}`);
  rouges += 1;
};
const vert = (texte: string) => console.log(`\x1b[32m✓\x1b[0m ${texte}`);

/**
 * Le texte visible d'un composant : sans le script, sans les commentaires,
 * sans les classes et sans les expressions.
 *
 * Les expressions sont retirées parce qu'elles portent des NOMS DE CODE —
 * `essai.arete.transmodale`, `reglages.interference` — qui ne s'affichent pas.
 * Les garder ferait rougir un écran dont le texte est irréprochable, et c'est
 * la première version de cet essai qui l'a montré.
 */
/**
 * Les deux apostrophes ramenées à une.
 *
 * Le glossaire écrit « l’écart » avec l'apostrophe typographique, les écrans
 * parfois « l'écart » avec la droite. L'essai rougissait donc sur une ligne où
 * la règle était appliquée MOT POUR MOT, à un caractère près — le genre de
 * rouge qui fait douter du code au lieu de l'essai.
 */
const memeApostrophe = (texte: string) => texte.replace(/[’‘`´]/g, "'");

/**
 * Les balises « Terme » sont remplacées par le texte qu'elles rendent.
 *
 * Sans cela, l'essai rougissait sur la forme la PLUS correcte : un
 * « <Terme technique="seuil" /> » rend bien « le plus petit écart que vous
 * distinguez (seuil) » à l'écran, mais la source du parent ne contient que la
 * balise. L'essai aurait donc poussé à écrire le couple à la main — c'est-à-dire
 * à défaire ce que la table centralise.
 */
function sansBalisesDeTerme(source: string): string {
  return source.replace(
    /<Terme\s+[^>]*technique="([^"]+)"[^>]*\/>/g,
    (balise, technique: string) => {
      const terme = GLOSSAIRE.find((t) => t.technique === technique);
      const rendu = terme ? `${terme.simple} (${terme.technique})` : technique;
      /* La longueur est conservée pour ne pas décaler les colonnes. */
      return rendu.length <= balise.length ? rendu.padEnd(balise.length) : rendu;
    },
  );
}

function texteVisible(source: string): string[] {
  return sansBalisesDeTerme(sansExpressions(source))
    .replace(/<script[\s\S]*?<\/script>/g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    /*
       Les blocs de style aussi : leurs commentaires « / * … * / » parlent de
       géométrie — « à une demi-arête du centre » — et ne s'affichent nulle
       part. C'est la première version de cet essai qui a rougi dessus.
    */
    .replace(/<style[\s\S]*?<\/style>/g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .replace(/^---[\s\S]*?^---$/m, (bloc) => bloc.replace(/[^\n]/g, ' '))
    /*
       LES EXPRESSIONS SONT RETIRÉES AVANT LE DÉCOUPAGE EN LIGNES, et elles
       enjambent les lignes : « {reglages.n === 1 ? … : …} » s'écrit sur
       quatre. Les retirer ligne par ligne laissait « reglages.n === » dans le
       texte, et l'essai rougissait sur une consigne irréprochable, en
       croyant y lire un « n = ».

       Le remplacement est répété pour dénouer les accolades imbriquées, et
       les retours à la ligne sont préservés pour que les numéros de ligne
       restent justes — un essai qui désigne la mauvaise ligne ne sert à rien.
    */
    .replace(/class="[^"]*"/g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((ligne) => ligne.replace(/<\/?[a-zA-Z][^>]*>/g, ' '));
}

/** Retire les expressions, accolades imbriquées comprises, sans perdre les lignes. */
function sansExpressions(source: string): string {
  let texte = source;
  for (let tour = 0; tour < 6; tour += 1) {
    const avant = texte;
    texte = texte.replace(/\{[^{}]*\}/gs, (bloc) => bloc.replace(/[^\n]/g, ' '));
    if (texte === avant) break;
  }
  return texte;
}

const parException = new Map(EXCEPTIONS.map((e) => [`${e.fichier}|${e.terme}`, e]));
const exceptionsUtiles = new Set<string>();

for (const fichier of FICHIERS) {
  let source: string;
  try {
    source = readFileSync(fichier, 'utf8');
  } catch {
    dire(`${fichier} — introuvable : la liste de cet essai est à jour ?`);
    continue;
  }
  const lignes = texteVisible(source);

  for (const terme of GLOSSAIRE) {
    const motif = terme.motif ?? new RegExp(`\\b${terme.technique}\\b`, 'i');
    /*
       L'équivalent simple peut être coupé par un retour à la ligne, ET son
       pluriel peut vivre dans une expression : « {n} tour{n > 1 ? 's' : ''}
       en arrière » s'affiche « 1 tour en arrière » comme « 2 tours en
       arrière », et le « s » n'est pas dans le texte. La comparaison tolère
       donc un « s » de plus ou de moins sur chaque mot — sans quoi l'essai
       rougissait sur les lignes où la règle était DÉJÀ appliquée.
    */
    const simple = new RegExp(
      memeApostrophe(terme.simple)
        /*
           L'article initial est retiré : le glossaire dit « la règle que suit
           une relation », l'écran peut écrire « une règle que suit une
           relation » selon la phrase qui l'accueille. Exiger l'article aurait
           imposé une tournure, pas un vocabulaire.
        */
        .replace(/^(le|la|les|l')\s*/i, '')
        .split(/\s+/)
        .map((mot) => `${mot.replace(/s$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?`)
        .join('\\s+'),
      'i',
    );

    lignes.forEach((ligne, i) => {
      if (!motif.test(ligne)) return;
      const voisinage = memeApostrophe(lignes.slice(Math.max(0, i - 2), i + 2).join(' '));
      if (simple.test(voisinage)) return;

      const clef = `${fichier}|${terme.technique}`;
      if (parException.has(clef)) {
        exceptionsUtiles.add(clef);
        return;
      }
      dire(
        `${fichier}:${i + 1} — « ${terme.technique} » sans « ${terme.simple} » : ` +
          ligne.trim().slice(0, 80),
      );
    });
  }
}

/*
   LES NOMS DE MOTEURS SONT COMPTÉS, et le compte est affiché. Ils sont
   couverts par une exception motivée, mais une exception muette est une
   exception qu'on oublie : le nombre rappelle ce qui reste à décider.
*/
{
  const noms: string[] = [];
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) parcourir(chemin);
      else if (entree.name.endsWith('.ts')) {
        for (const m of readFileSync(chemin, 'utf8').matchAll(/\bnom: '([^']+)'/g)) noms.push(m[1]);
      }
    }
  };
  parcourir(NOMS_DE_MOTEURS);
  const avecJargon = noms.filter((nom) =>
    GLOSSAIRE.some((t) => new RegExp(`\\b${t.technique}`, 'i').test(nom)),
  );
  exceptionsUtiles.add(`${NOMS_DE_MOTEURS}|*`);
  console.log(
    `\x1b[33m•\x1b[0m ${avecJargon.length} nom${avecJargon.length > 1 ? 's' : ''} de type de ` +
      `question portent encore un terme technique : ${avecJargon.join(', ')} — ` +
      'couverts par une exception motivée, décision remontée au Pilote.',
  );
}

for (const e of EXCEPTIONS) {
  const clef = `${e.fichier}|${e.terme}`;
  if (!exceptionsUtiles.has(clef)) {
    dire(
      `l’exception « ${e.terme} » dans ${e.fichier} ne sert plus : retirez-la ` +
        `(sa raison était : ${e.raison})`,
    );
  }
}

if (rouges === 0) {
  vert(
    `Aucun terme technique seul. ${GLOSSAIRE.length} termes à la table, ` +
      `${EXCEPTIONS.length} exceptions, toutes utiles.`,
  );
}
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m\n' : `\n\x1b[31m${rouges} rouges.\x1b[0m\n`);
process.exit(rouges === 0 ? 0 : 1);
