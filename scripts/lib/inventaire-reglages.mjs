/**
 * L'inventaire mécanique des réglages — P1 du prompt 42.
 *
 * Ce module ne rend pas un avis : il relève. Il part des **écritures**, comme
 * le prompt l'exige, parce qu'un réglage se reconnaît à ce qu'on peut le
 * changer, jamais au titre de la section qui l'affiche. Un intitulé
 * « Affichage » peut ne rien régler du tout ; un `setItem` règle toujours
 * quelque chose.
 *
 * Trois gisements, et rien d'autre :
 *
 * 1. `localStorage.setItem` / `sessionStorage.setItem` ;
 * 2. `put('<magasin>', valeur, clé)` sur IndexedDB — la clé hors ligne, donc
 *    nommée, donc relevable ;
 * 3. les formes `interface Reglages…` et leurs valeurs par défaut
 *    `…PAR_DEFAUT`, qui donnent les champs et leur valeur d'origine.
 *
 * ## Ce qu'il ne voit pas, et il faut le dire avant de lire ses tableaux
 *
 * - **Une clé calculée** (`selection:${exercice}`) est relevée sous son
 *   gabarit, jamais développée : le script ne connaît pas les exercices.
 * - **Une clé passée en argument** (`ecrireReglageBrut(champ, …)`) est
 *   relevée comme « clé variable », avec le nom de la variable. C'est un
 *   constat, pas une omission silencieuse.
 * - **Un réglage rangé dans un objet plus vaste** — un champ de `profil`,
 *   par exemple — n'apparaît pas comme clé : il apparaît par sa forme, si
 *   cette forme porte un nom `Reglages…`.
 * - **Les écrans** sont trouvés par le nom des fonctions d'écriture
 *   exportées. Un écran qui écrirait par un intermédiaire autrement nommé
 *   ne sera pas rattaché ; le module, lui, l'est toujours.
 *
 * La portée n'est pas devinée : elle vient de trois règles nommées dans la
 * sortie (`REGLES_DE_PORTEE`), pour qu'une portée fausse se voie.
 *
 * ## Une leçon de la première version, gardée ici
 *
 * Les appels étaient découpés à l'expression régulière, avec un `[\s\S]*?`
 * jusqu'au premier `);`. Ce `);` n'est pas forcément celui de l'appel : le
 * relevé a rendu des « clés » de quatre lignes, embarquant le code suivant.
 * On compte donc les parenthèses, et l'on saute les chaînes.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = 'src';

/** Les règles de portée, citées telles quelles dans la sortie. */
export const REGLES_DE_PORTEE = {
  'sous coffre': 'le module scelle ses écritures (`sceller(`) : la valeur est sous coffre',
  'tous les appareils':
    'la clé figure dans `REGLAGES_SYNCHRONISES` (ou `selection:*`) de `src/lib/db.ts`',
  'cet appareil': 'tout le reste : la valeur ne quitte pas cet appareil',
};

export function fichiers(racine = RACINE) {
  const sortie = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(ts|astro|svelte)$/.test(entree)) sortie.push(chemin);
  }
  return sortie.sort();
}

const sansCommentaires = (texte) =>
  texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Les constantes chaîne du fichier, pour résoudre `setItem(CLE, …)`. */
function constantes(texte) {
  const table = new Map();
  for (const [, nom, valeur] of texte.matchAll(
    /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*'([^']*)'/g,
  )) {
    table.set(nom, valeur);
  }
  return table;
}

const resoudre = (brut, table) => {
  const texte = brut.trim();
  const litteral = texte.match(/^'([^']*)'$/);
  if (litteral) return { cle: litteral[1], sure: true };
  if (table.has(texte)) return { cle: table.get(texte), sure: true };
  const gabarit = texte.match(/^`([^`]*)`$/);
  if (gabarit) return { cle: gabarit[1].replace(/\$\{[^}]*\}/g, '*'), sure: false };
  return { cle: `clé variable : ${texte.replace(/\s+/g, ' ').slice(0, 40)}`, sure: false };
};

/**
 * Les appels dont le texte commence par `prefixe`, découpés en arguments de
 * premier niveau. Les parenthèses se comptent, les chaînes se sautent.
 */
function appels(texte, prefixe) {
  const sortie = [];
  let i = texte.indexOf(prefixe);
  while (i !== -1) {
    let j = i + prefixe.length;
    let profondeur = 1;
    let chaine = null;
    let debut = j;
    const args = [];
    for (; j < texte.length && profondeur > 0; j += 1) {
      const c = texte[j];
      if (chaine) {
        if (c === '\\') j += 1;
        else if (c === chaine) chaine = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') chaine = c;
      else if ('([{'.includes(c)) profondeur += 1;
      else if (')]}'.includes(c)) {
        profondeur -= 1;
        if (profondeur === 0) args.push(texte.slice(debut, j));
      } else if (c === ',' && profondeur === 1) {
        args.push(texte.slice(debut, j));
        debut = j + 1;
      }
    }
    if (profondeur === 0) sortie.push(args.map((a) => a.trim()).filter((a) => a !== ''));
    i = texte.indexOf(prefixe, i + prefixe.length);
  }
  return sortie;
}

/** Les synchronisés, lus dans le code plutôt que recopiés ici. */
export function reglagesSynchronises() {
  const texte = readFileSync('src/lib/db.ts', 'utf8');
  const bloc = texte.match(/REGLAGES_SYNCHRONISES\s*=\s*\[([^\]]*)\]/);
  return bloc ? [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
}

/** Le littéral `…PAR_DEFAUT: <forme> = { … }`, champ par champ. */
function defauts(texte, forme) {
  const bloc = texte.match(
    new RegExp(`const\\s+\\w*DEFAUTS?\\w*\\s*:\\s*${forme}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`),
  );
  if (!bloc) return null;
  const table = {};
  for (const [, nom, valeur] of bloc[1].matchAll(/^\s{2}(\w+)\s*:\s*([^,\n]+),?$/gm)) {
    table[nom] = valeur.trim();
  }
  return table;
}

/** Les formes `Reglages…` et leurs valeurs par défaut. */
export function formes() {
  const sortie = [];
  for (const chemin of fichiers()) {
    const texte = sansCommentaires(readFileSync(chemin, 'utf8'));
    for (const [, nom, corps] of texte.matchAll(
      /export\s+interface\s+(Reglages\w*)\s*\{([\s\S]*?)\n\}/g,
    )) {
      const champs = [...corps.matchAll(/^\s{2}(\w+)\??\s*:\s*([^;]+);/gm)].map((m) => ({
        nom: m[1],
        type: m[2].trim().replace(/\s+/g, ' '),
      }));
      sortie.push({ nom, fichier: chemin, champs, defauts: defauts(texte, nom) });
    }
    for (const [, nom, type] of texte.matchAll(/export\s+type\s+(Reglages\w*)\s*=\s*([^;]+);/g)) {
      sortie.push({
        nom,
        fichier: chemin,
        champs: [{ nom: '(le type dit tout)', type: type.trim().replace(/\s+/g, ' ') }],
        defauts: defauts(texte, nom),
      });
    }
  }
  return sortie;
}

/** Les clés écrites, avec leurs écrivains et leurs lecteurs. */
export function cles() {
  const synchronises = reglagesSynchronises();
  const table = new Map();
  const entree = (stockage, cle) => {
    const id = `${stockage}::${cle}`;
    if (!table.has(id))
      table.set(id, {
        stockage,
        cle,
        ecrivains: new Set(),
        lecteurs: new Set(),
        scelle: false,
        sure: true,
      });
    return table.get(id);
  };

  for (const chemin of fichiers()) {
    const texte = sansCommentaires(readFileSync(chemin, 'utf8'));
    const locales = constantes(texte);
    const scelle = /\bsceller\s*\(/.test(texte);

    for (const stockage of ['localStorage', 'sessionStorage']) {
      for (const args of appels(texte, `${stockage}.setItem(`)) {
        const { cle, sure } = resoudre(args[0] ?? '', locales);
        const e = entree(stockage, cle);
        e.ecrivains.add(chemin);
        e.sure &&= sure;
      }
      for (const args of appels(texte, `${stockage}.getItem(`)) {
        const { cle } = resoudre(args[0] ?? '', locales);
        entree(stockage, cle).lecteurs.add(chemin);
      }
    }

    for (const args of appels(texte, '.put(')) {
      const magasin = args[0]?.match(/^'([\w:]+)'$/)?.[1];
      if (!magasin) continue;
      const { cle, sure } = args[2]
        ? resoudre(args[2], locales)
        : { cle: '(clé portée par l’objet)', sure: true };
      const e = entree(`IndexedDB/${magasin}`, cle);
      e.ecrivains.add(chemin);
      e.scelle ||= scelle;
      e.sure &&= sure;
    }
    for (const args of appels(texte, '.get(')) {
      const magasin = args[0]?.match(/^'([\w:]+)'$/)?.[1];
      if (!magasin || !args[1]) continue;
      const { cle } = resoudre(args[1], locales);
      entree(`IndexedDB/${magasin}`, cle).lecteurs.add(chemin);
    }
  }

  return [...table.values()]
    .map((e) => ({
      ...e,
      ecrivains: [...e.ecrivains].sort(),
      lecteurs: [...e.lecteurs].sort(),
      portee: e.scelle
        ? 'sous coffre'
        : synchronises.includes(e.cle) || e.cle.startsWith('selection:')
          ? 'tous les appareils'
          : 'cet appareil',
    }))
    .sort((a, b) => (a.stockage + a.cle).localeCompare(b.stockage + b.cle));
}

/**
 * Les fonctions d'écriture exportées, et les écrans qui les appellent.
 *
 * Restreint aux modules qui écrivent au moins une **clé de réglage** : sans
 * ce filtre, la liste comptait cinquante entrées dont `ecrirePesee` et
 * `ecrireRepas`, qui écrivent des données et ne règlent rien. Un inventaire
 * qui mélange les deux ne se lit plus.
 */
export function ecrans(reglages = cles().filter(estReglage)) {
  const porteurs = new Set(reglages.flatMap((c) => c.ecrivains));
  const sortie = [];
  const tous = fichiers();
  const textes = new Map(tous.map((c) => [c, sansCommentaires(readFileSync(c, 'utf8'))]));
  for (const [chemin, texte] of textes) {
    if (!chemin.startsWith('src/lib') && !chemin.startsWith('src/features')) continue;
    if (!porteurs.has(chemin)) continue;
    for (const [, nom] of texte.matchAll(
      /export\s+(?:async\s+)?function\s+((?:ecrire|definir|enregistrerReglage|basculer)\w*)/g,
    )) {
      const appelants = tous.filter(
        (autre) =>
          autre !== chemin &&
          new RegExp(`\\b${nom}\\b`).test(textes.get(autre)) &&
          (autre.startsWith('src/pages') ||
            autre.startsWith('src/components') ||
            autre.includes('/composants/')),
      );
      if (appelants.length) sortie.push({ fonction: nom, module: chemin, ecrans: appelants });
    }
  }
  return sortie.sort((a, b) => a.fonction.localeCompare(b.fonction));
}

/**
 * Un réglage se range où se rangent les réglages : `localStorage`,
 * `sessionStorage`, le magasin `etat`, ou un magasin dont le nom finit par
 * « Reglages ». Tout le reste est de la **donnée** — une pesée, une séance,
 * une tâche —, relevée elle aussi mais comptée à part : la confondre avec un
 * réglage gonflerait l'inventaire de cent lignes qui ne se règlent pas.
 */
export const estReglage = (e) =>
  e.stockage === 'localStorage' ||
  e.stockage === 'sessionStorage' ||
  e.stockage === 'IndexedDB/etat' ||
  /Reglages$/i.test(e.stockage);

export function inventaire() {
  const toutes = cles();
  const reglages = toutes.filter(estReglage);
  return {
    cles: reglages,
    donnees: toutes.filter((e) => !estReglage(e)),
    formes: formes(),
    ecrans: ecrans(reglages),
    regles: REGLES_DE_PORTEE,
  };
}
