/**
 * LES BORNES DE « waitForFunction » ÉCRITES AU MAUVAIS RANG.
 *
 * ## La faute, trouvée le 26 octobre
 *
 * La signature est `waitForFunction(fonction, valeur, options)`. Le second
 * argument est la VALEUR passée à la fonction ; les options — dont `timeout`
 * — sont au troisième. Écrire
 *
 *     await page.waitForFunction(() => …, { timeout: 20_000 });
 *
 * ne fixe donc aucune borne : l'objet part comme valeur, la fonction ne le
 * lit pas, et l'attente retombe sur la borne par défaut de Playwright. Seize
 * appels de ce dépôt en portaient une.
 *
 * **Une borne qu'on croit avoir fixée est pire qu'une borne absente.** Absente,
 * elle se voit à la relecture ; au mauvais rang, elle se lit comme fixée, et
 * les deux formes se ressemblent assez pour que rien ne se remarque. C'est
 * aussi la forme qui fait durer un rouge trente secondes là où l'auteur avait
 * écrit « vingt secondes au plus ».
 *
 * ## Pourquoi un analyseur écrit à la main
 *
 * Aucune expression régulière plate ne découpe les arguments de cet appel :
 * une fonction fléchée passée en premier porte ses propres parenthèses, ses
 * accolades, ses chaînes et ses virgules. Le découpage se fait donc caractère
 * par caractère, en suivant la profondeur et les chaînes — et c'est
 * exactement ce que `essais:bornes` éprouve, parce qu'un analyseur cassé ne
 * rend pas une erreur : il rend ZÉRO FAUTE, ce qui a l'air d'un dépôt propre.
 *
 * ## Ce qui est signalé, et ce qui ne l'est pas
 *
 * Signalé : un appel à DEUX arguments dont le second est un objet portant
 * `timeout`, sous la forme `{ timeout: N }` comme sous la forme abrégée
 * `{ timeout }`.
 *
 * Non signalé : les trois arguments dans le bon ordre, quelle que soit la
 * valeur au second rang ; et un appel sans borne du tout, qui est une autre
 * faute, moins trompeuse, et qui ne se corrige pas de la même façon.
 *
 * Signalé aussi — et c'est voulu : un second argument qui serait une vraie
 * valeur portant par hasard un champ nommé `timeout`. Cet appel-là n'a de
 * toute façon aucune borne, et son remède est le même : passer les options au
 * troisième rang.
 */
import { readdirSync, readFileSync } from 'node:fs';

/**
 * Les arguments de premier niveau d'un appel, à partir de sa parenthèse
 * ouvrante — l'indice donné est celui de cette parenthèse.
 *
 * Rend `null` si les parenthèses ne se referment pas : un fichier tronqué ne
 * doit pas être lu comme un appel à un argument.
 */
export function argumentsDePremierNiveau(texte, debut) {
  let profondeur = 0;
  let arg = '';
  const args = [];
  let chaine = null;
  for (let i = debut; i < texte.length; i += 1) {
    const c = texte[i];
    if (chaine) {
      if (c === chaine && texte[i - 1] !== '\\') chaine = null;
      arg += c;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      chaine = c;
      arg += c;
      continue;
    }
    if ('([{'.includes(c)) {
      profondeur += 1;
      /* La parenthèse qui OUVRE l'appel n'appartient à aucun argument. */
      if (profondeur === 1) continue;
    }
    if (')]}'.includes(c)) {
      profondeur -= 1;
      if (profondeur === 0) {
        args.push(arg.trim());
        return args;
      }
    }
    if (c === ',' && profondeur === 1) {
      args.push(arg.trim());
      arg = '';
      continue;
    }
    if (!(profondeur === 1 && arg === '' && /\s/.test(c))) arg += c;
  }
  return null;
}

/**
 * Vrai si ce texte d'argument est un objet d'options portant `timeout`.
 *
 * La parenthèse facultative couvre `({ timeout: N })`, que l'on écrit parfois
 * par symétrie avec le premier argument.
 */
function porteUneBorne(argument) {
  return /^\(?\{[\s\S]*\btimeout\b\s*[:,}]/.test(argument);
}

/**
 * Les bornes au mauvais rang dans UN texte.
 *
 * Rend aussi le nombre d'appels rencontrés : c'est ce qui permet au passage
 * d'ensemble de distinguer « rien à signaler » de « rien à lire », et de
 * refuser dans le second cas au lieu de se taire.
 *
 * @returns {{ fautes: {ligne: number, code: string}[], appels: number }}
 */
export function bornesDansLeTexte(texte) {
  const fautes = [];
  let appels = 0;
  for (const m of texte.matchAll(/waitForFunction\(/g)) {
    appels += 1;
    const args = argumentsDePremierNiveau(texte, m.index + 'waitForFunction'.length);
    if (!args) continue;
    /*
       LA VIRGULE FINALE, et c'est ce trou-là qui m'a coûté le plus.

       Un appel écrit sur plusieurs lignes est formaté avec une virgule après
       son dernier argument — c'est ce que Prettier fait partout dans ce dépôt.
       Le découpage rendait donc TROIS arguments, dont un vide, et la condition
       « exactement deux » laissait passer la faute. Un balayage qui ne voit pas
       la forme la plus courante de la faute qu'il cherche est pire qu'absent :
       son zéro se lit comme un verdict.
    */
    if (args.length > 0 && args[args.length - 1] === '') args.pop();
    if (args.length !== 2) continue;
    if (!porteUneBorne(args[1])) continue;
    fautes.push({
      ligne: texte.slice(0, m.index).split('\n').length,
      code: args[1].replace(/\s+/g, ' ').slice(0, 60),
    });
  }
  return { fautes, appels };
}

/**
 * LES FICHIERS QUI PORTENT DES EXEMPLES VOLONTAIRES.
 *
 * `essais-bornes.mjs` éprouve ce balayage, donc il contient la faute écrite
 * exprès, sous les deux formes. Le balayage le signalerait, et le socle
 * rougirait sur des exemples.
 *
 * Une exclusion est une tache aveugle, et une tache aveugle non gardée
 * s'élargit : l'essai vérifie donc que cette liste n'en compte qu'un, et que
 * ce fichier-là porte VRAIMENT des exemples — sans quoi son exclusion ne
 * servirait qu'à cacher quelque chose.
 */
export const PORTEURS_D_EXEMPLES = ['essais-bornes.mjs'];

/**
 * Le balayage d'un dossier de scripts.
 *
 * @param dossier le dossier à lire, « scripts » par défaut
 * @param options.ignorer les noms de fichiers à passer ; les porteurs
 *   d'exemples par défaut, et `[]` pour ne rien passer — ce dont l'essai se
 *   sert pour prouver que l'exclusion porte bien quelque chose
 * @returns {{ fautes: {fichier: string, ligne: number, code: string}[],
 *             appels: number, fichiers: number }}
 */
export function bornesAuMauvaisRang(dossier = 'scripts', { ignorer = PORTEURS_D_EXEMPLES } = {}) {
  const fautes = [];
  let appels = 0;
  let fichiers = 0;
  for (const f of readdirSync(dossier).sort()) {
    if (!/\.(mjs|mts|ts|js)$/.test(f)) continue;
    if (ignorer.includes(f)) continue;
    fichiers += 1;
    const texte = readFileSync(`${dossier}/${f}`, 'utf8');
    const bilan = bornesDansLeTexte(texte);
    appels += bilan.appels;
    for (const faute of bilan.fautes) fautes.push({ fichier: `${dossier}/${f}`, ...faute });
  }
  return { fautes, appels, fichiers };
}
