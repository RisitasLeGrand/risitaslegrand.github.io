/**
 * Les champs lus et jamais écrits — le contrôle qui aurait trouvé A-16.
 *
 *   npm run essais:champs-orphelins
 *
 * ## Pourquoi `essais:orphelins` ne suffisait pas
 *
 * Celui-là trouve un **module** qu'aucun écran n'importe. Il n'a pas vu
 * A-16, et il avait raison de ne pas la voir : `liaison-branches.ts`
 * était bel et bien importé par l'écran des tâches. Le module était
 * atteint ; c'est la **donnée** qu'il lit qui ne pouvait pas naître.
 * Quatorze endroits lisaient `tache.lien` ; rien ne l'écrivait.
 *
 * > Un contrôle d'atteignabilité des modules ne dit rien de
 * > l'atteignabilité des états.
 *
 * Celui-ci regarde les champs. Pour chaque champ **facultatif** d'un
 * modèle, il compte les lectures (`objet.champ`) et les écritures
 * (`champ:` dans un littéral). Un champ lu et jamais écrit est un
 * mécanisme hors d'atteinte : il attend une donnée que l'application ne
 * sait pas produire.
 *
 * ## Ce qu'il ne voit pas, et il faut le dire
 *
 * Il lit du texte, pas un arbre syntaxique. Il ne voit donc pas :
 *
 * - **une écriture par diffusion** (`{ ...autre }`) : un champ recopié
 *   d'un objet existant n'apparaît jamais sous la forme `champ:`. C'est
 *   la source légitime d'exceptions ;
 * - **une écriture par index** (`objet[nom] = …`) ;
 * - **un champ rempli par la fusion ou par un import**, qui vient d'un
 *   autre appareil et non d'un écran.
 *
 * Chaque exception porte sa raison et sa date. Une exception périmée —
 * le champ est désormais écrit — fait échouer le contrôle : une
 * déclaration qui ne correspond plus est un mensonge qui dort.
 *
 * Les champs **obligatoires** ne sont pas examinés : TypeScript refuse de
 * construire l'objet sans eux, donc leur absence se voit à la compilation.
 * C'est exactement pour cela qu'A-16 portait sur un champ facultatif.
 *
 * ## Pourquoi les valeurs d'énumération ne sont PAS contrôlées ici
 *
 * La même idée appliquée aux énumérations — « un état lu doit avoir au
 * moins un écran qui le produit » — paraît naturelle. Mesurée, elle
 * accuse à tort : `fatigue`, motif légitime de `MOTIFS`, n'apparaît comme
 * littéral **nulle part** hors du modèle. Il n'a pas à y apparaître — il
 * est choisi dans un menu, et c'est `select.value` qui le porte.
 *
 * Distinguer un état que le code doit nommer d'une valeur que la personne
 * choisit demande de savoir ce que fait l'écran. C'est un jugement, pas
 * une mesure, et un contrôle qui crie au loup se fait désactiver — on
 * perd alors aussi la moitié qui marchait.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
   Les champs lus et jamais écrits qu'on accepte, avec leur raison.
   `permanente: true` quand aucun écran ne les écrira jamais ; sinon
   `depuis`, et la ligne devra tomber.
*/
const EXCEPTIONS = [];

const MODELES = ['src/lib/odyssee/modele.ts', 'src/lib/sport/modele.ts', 'src/lib/notifications/modele.ts'];

/** Tous les fichiers de `src/`, sauf les modèles eux-mêmes. */
function sources(racine = 'src') {
  const sortie = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...sources(chemin));
    else if (/\.(ts|astro)$/.test(entree)) sortie.push(chemin);
  }
  return sortie;
}

const sansCommentaires = (texte) =>
  texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Les champs facultatifs déclarés par les interfaces d'un modèle. */
function champsFacultatifs(fichier) {
  const texte = sansCommentaires(readFileSync(fichier, 'utf8'));
  const champs = new Map();
  for (const bloc of texte.matchAll(/export interface (\w+)\s*(?:extends [\w, ]+)?\{([\s\S]*?)\n\}/g)) {
    const [, nom, corps] = bloc;
    for (const champ of corps.matchAll(/^\s{2}(\w+)\?:/gm)) {
      champs.set(champ[1], nom);
    }
  }
  return champs;
}

let echecs = 0;
const dire = (ok, texte, detail) => {
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${texte}`);
  if (detail) console.log(`      ${detail}`);
};

const fichiers = sources().filter((f) => !MODELES.includes(f));
const corpus = fichiers.map((f) => sansCommentaires(readFileSync(f, 'utf8')));

const orphelins = [];
let examines = 0;

for (const modele of MODELES) {
  for (const [champ, interfaceNom] of champsFacultatifs(modele)) {
    examines += 1;
    const lecture = new RegExp(`\\.${champ}\\b`);
    /* Une écriture : la clé dans un littéral, ou une affectation. */
    const ecriture = new RegExp(`(^|[^.\\w])${champ}:\\s|\\.${champ}\\s*=[^=]`, 'm');

    /*
       ON NE REGARDE QUE LES FICHIERS QUI CONNAISSENT LE TYPE PROPRIÉTAIRE.

       Sans cette restriction, le contrôle est inutile, et je l'ai
       constaté en le lançant contre l'état d'avant A-16 : il restait
       VERT. `lien` est aussi un domaine dans `veille.ts`
       (`lien: { libelle: 'Agenda et lien' }`), un homonyme sans aucun
       rapport avec `Tache.lien`. Cette ligne comptait pour une écriture,
       et le champ passait pour branché.

       Un nom de champ nu est trop commun pour servir de clé. Le type qui
       le porte, lui, désigne.
    */
    const proprietaire = new RegExp(`\\b${interfaceNom}\\b`);

    let lu = 0;
    let ecrit = 0;
    for (const texte of corpus) {
      if (!proprietaire.test(texte)) continue;
      if (lecture.test(texte)) lu += 1;
      if (ecriture.test(texte)) ecrit += 1;
    }
    if (lu > 0 && ecrit === 0) {
      orphelins.push({ champ, interfaceNom, modele, lu });
    }
  }
}

console.log(`\n\x1b[1m${examines} champ(s) facultatif(s) examiné(s) dans ${MODELES.length} modèles\x1b[0m\n`);

const declarees = new Map(EXCEPTIONS.map((e) => [e.champ, e]));

console.log('\x1b[1mAucun champ lu et jamais écrit\x1b[0m');
if (!orphelins.length) {
  dire(true, 'aucun champ orphelin');
} else {
  for (const o of orphelins) {
    const exception = declarees.get(o.champ);
    if (!exception) {
      dire(
        false,
        `${o.interfaceNom}.${o.champ} — lu dans ${o.lu} fichier(s), écrit nulle part`,
        'Aucun écran ne peut produire cet état. Soit on le branche, soit on déclare l’exception avec sa raison.',
      );
    } else {
      dire(true, `${o.interfaceNom}.${o.champ}`, `exception — ${exception.pourquoi}`);
    }
  }
}

console.log('\n\x1b[1mAucune exception périmée\x1b[0m');
{
  const vivants = new Set(orphelins.map((o) => o.champ));
  const perimees = EXCEPTIONS.filter((e) => !vivants.has(e.champ));
  dire(
    perimees.length === 0,
    perimees.length ? '' : 'aucune',
    perimees.length
      ? `Ces champs sont désormais écrits : ${perimees.map((e) => e.champ).join(', ')}. Retirez leur ligne.`
      : '',
  );
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} champ(s) hors d’atteinte.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
