/**
 * Le vocabulaire : les chaînes imposées, les tournures causales, l'ambiguïté.
 *
 *   npm run essais:vocabulaire
 *
 * ## Trois contrôles, trois portées, et la portée est le travail
 *
 * Le § 9 du plan de phase 0 écrit deux choses qu'il serait facile de
 * confondre. Les **tournures causales** sont « balayées partout ». Les
 * **mots interdits** ne portent pas cette mention : ce sont les mots d'un
 * domaine de santé, et les appliquer à tout le dépôt reviendrait à interdire
 * « se tromper est normal » dans Révisions, qui est une phrase pédagogique
 * juste.
 *
 * Mesuré avant d'écrire, et c'est la mesure qui a tranché : les mots
 * interdits rendent 22 occurrences sur `src/`, dont « se tromper est
 * normal » trois fois, le niveau de verbosité « Normal » des notifications,
 * et « deux pesées proches sont normales ». Les tournures causales en
 * rendent 2, toutes deux dans `MOTS_DE_CAUSE`, c'est-à-dire dans la liste
 * qui les interdit. La coupure du § 9 est donc la bonne, et elle est reprise
 * telle quelle ici.
 *
 * ## Ce qui est exempté, et pourquoi jamais sur des guillemets
 *
 * Une liste de mots interdits contient forcément des mots interdits. Un
 * non-usage déclaré nomme ce que Cyclades refuse de faire. Une `reserve`
 * dit ce qu'une pente ne prouve pas. Les trois portent légitimement le mot
 * qu'elles bannissent, et un balayage qui les compterait rendrait 85 rouges
 * justes sur 87.
 *
 * L'exemption porte donc sur des **listes nommées**, lues là où elles sont
 * déclarées, et leur inventaire est vérifié plus bas : en ajouter une doit
 * être un geste visible. Elle ne porte jamais sur la présence de
 * guillemets — n'importe quelle phrase peut en porter, et l'exemption
 * serait un trou qu'il suffirait de connaître.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHAINES_IMPOSEES,
  LIBELLES_AUTORISES_CYCLE_OU_PHASE,
  MOTS_INTERDITS_SUIVI,
} from '../src/lib/odyssee/chaines-du-suivi';

/**
 * Les cinq tournures du § 9, déclarées ici et non empruntées.
 *
 * `MOTS_DE_CAUSE`, dans `tendances.ts`, en porte vingt — « donc », « parce
 * que », « permet de », « grâce à ». Je l'avais importée pour ne pas
 * dupliquer, et l'essai a rendu 80 rouges : ce n'est pas la même règle. Cette
 * liste-là garde les énoncés de tendance, où « donc » est une inférence de
 * trop ; celle du § 9 garde l'attribution d'une cause, et cinq tournures y
 * suffisent. Les déclarer n'est donc pas une copie, c'est une autre règle.
 *
 * « cause » n'y est pas seule, et c'est volontaire : le mot apparaît dans des
 * identifiants (`reglage.cause`, `expliquerait`) qu'un relevé de source
 * attrape sans qu'aucune phrase ne soit en faute. Le § 9 interdit « à cause
 * de », une tournure, pas le substantif.
 */
const TOURNURES_CAUSALES: readonly string[] = [
  'provoque',
  'à cause de',
  'explique',
  'responsable de',
  'dû à',
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

/* ══════════════════════════════════════════════════════════════════════════
   L'outillage de lecture
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les commentaires d'abord, les interpolations ensuite.
 *
 * Les deux ont produit de faux rouges pendant l'écriture. Un commentaire qui
 * explique une prohibition la contient. Et `${erreur.diagnostic.message}`
 * dans un gabarit porte le mot « diagnostic » — mais c'est un accès à une
 * propriété, du code et non du texte : deux écrans l'ont fait rougir avant
 * que les interpolations ne soient retirées.
 */
const texteSeul = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\$\{[^}]*\}/g, ' ');

/**
 * Les littéraux de chaîne d'un fichier : ce qui peut atteindre un écran.
 *
 * ## Pourquoi un parcours et non une expression régulière
 *
 * La première version alternait trois motifs de guillemets. Elle a tenu tant
 * que les fichiers balayés ne portaient pas de gabarit à accents graves, puis
 * elle a rendu, sur le fichier des signes d'alerte, un « littéral » qui
 * allait de l'accent grave fermant d'un gabarit à l'accent ouvrant du
 * suivant — c'est-à-dire du code aggloméré, dans lequel un mot interdit peut
 * apparaître sans qu'aucune phrase ne soit en faute, et dans lequel une vraie
 * phrase peut disparaître.
 *
 * Un balayage dont l'extracteur se désynchronise ne mesure plus ce qu'il
 * croit mesurer, dans les deux sens. Celui-ci parcourt les signes un par un
 * en sachant dans quel genre de littéral il se trouve, et saute les
 * échappements. C'est vingt lignes au lieu d'une, et c'est la pièce sur
 * laquelle tout le reste repose.
 */
const litteraux = (source: string): string[] => {
  const texte = texteSeul(source);
  const vus: string[] = [];
  let i = 0;
  while (i < texte.length) {
    const signe = texte[i];
    if (signe !== "'" && signe !== '"' && signe !== '`') {
      i += 1;
      continue;
    }
    const fin = signe;
    let j = i + 1;
    let contenu = '';
    while (j < texte.length) {
      if (texte[j] === '\\') {
        contenu += texte[j + 1] ?? '';
        j += 2;
        continue;
      }
      if (texte[j] === fin) break;
      /* Un saut de ligne ferme un littéral simple, jamais un gabarit. */
      if (texte[j] === '\n' && fin !== '`') break;
      contenu += texte[j];
      j += 1;
    }
    if (j < texte.length && texte[j] === fin && contenu.length >= 4) vus.push(contenu);
    i = j + 1;
  }
  return vus;
};

const fichiersDe = (racine: string): string[] => {
  const vus: string[] = [];
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.(ts|svelte|astro)$/.test(entree)) vus.push(chemin);
    }
  };
  parcourir(racine);
  return vus;
};

/**
 * Le motif d'un terme interdit.
 *
 * Le « (?<![-\w]) » devant écarte `font-normal` : un mot français n'est
 * jamais précédé d'un tiret dans une phrase. Sans lui, 41 classes Tailwind
 * rougissaient. Et le « s? » final attrape le pluriel sans attraper
 * « expliquer » quand le terme est « explique » — c'est la leçon du contrôle
 * de prescription, qui mordait sur « ce que vous prenez ».
 */
const motif = (terme: string) =>
  new RegExp(`(?<![-\\w])${terme.replace(/ /g, '\\s+').replace(/é/g, '[eé]')}s?(?![-\\w])`, 'i');

/**
 * La tournure est-elle niée ?
 *
 * « La règle n'explique pas pourquoi elle existe » ne commet pas la faute du
 * § 9 : elle en est l'inverse exact. Ce que la règle interdit est
 * d'**attribuer** une cause ; une phrase qui refuse d'en attribuer une est
 * précisément ce qu'on veut lire.
 *
 * La négation est cherchée dans les quinze caractères qui précèdent, et non
 * dans toute la phrase : « cela explique » à la fin d'un paragraphe qui
 * commence par « ne » serait exempté à tort par une recherche large.
 */
const nie = (chaine: string, terme: string): boolean => {
  const trouve = motif(terme).exec(chaine);
  if (!trouve) return false;
  const avant = chaine.slice(Math.max(0, trouve.index - 15), trouve.index);
  return /\b(ne|n[’'])\s*$/i.test(avant) || /\b(pas|jamais|aucune?|rien)\b[^.]{0,10}$/i.test(avant);
};

/* ══════════════════════════════════════════════════════════════════════════
   1. Les chaînes imposées sont là, et aucune n'est vide
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. LES CHAÎNES IMPOSÉES');

const cles = Object.keys(CHAINES_IMPOSEES);
v('les neuf chaînes du § 9 portées en clair sont déclarées', cles.length, 9);
v(
  'aucune n’est vide',
  cles.filter((c) => !CHAINES_IMPOSEES[c as keyof typeof CHAINES_IMPOSEES].texte.trim()),
  [],
);
v(
  'chacune dit d’où elle vient',
  cles.filter((c) => !CHAINES_IMPOSEES[c as keyof typeof CHAINES_IMPOSEES].origine.trim()),
  [],
);

/*
   LES TYPOGRAPHIES DROITES SONT UN DÉFAUT ICI, et pas une préférence : le
   format G demande l'apostrophe courbe, et une chaîne imposée mal
   typographiée se recopiera telle quelle dans chaque écran qui l'emprunte.
*/
v(
  'aucune ne porte d’apostrophe droite',
  cles.filter((c) => CHAINES_IMPOSEES[c as keyof typeof CHAINES_IMPOSEES].texte.includes("'")),
  [],
);

/*
   AUCUN « (s) » DANS LES CHAÎNES IMPOSÉES. Le dépôt en porte environ 225,
   dont la purge appartient au lot G du constructeur ; ce contrôle ne garde
   que ce domaine, où il n'y en a aucun et où il n'y en aura pas.
*/
v(
  'aucune ne porte de pluriel entre parenthèses',
  cles.filter((c) =>
    /[a-zà-ÿ]\((s|e|es|x)\)/i.test(CHAINES_IMPOSEES[c as keyof typeof CHAINES_IMPOSEES].texte),
  ),
  [],
);

/* ══════════════════════════════════════════════════════════════════════════
   2. Les tournures causales, balayées partout
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n2. LES TOURNURES CAUSALES, SUR TOUT src/');

/**
 * Les listes de prohibition déjà déclarées dans le dépôt.
 *
 * Elles sont lues **là où elles sont** : une copie de leur contenu ici se
 * désynchroniserait en silence le jour où l'une d'elles s'allonge. Leur
 * nombre est vérifié juste après, pour que l'ajout d'une exemption soit un
 * geste délibéré et non une ligne glissée pour faire passer un essai.
 */
const PORTEURS_DE_PROHIBITION: readonly string[] = [
  'src/lib/odyssee/psyche.ts',
  'src/lib/odyssee/finances.ts',
  'src/lib/odyssee/moteur-veille.ts',
  'src/lib/odyssee/tendances.ts',
  'src/lib/odyssee/molecules.ts',
  'src/lib/odyssee/usage.ts',
  'src/lib/odyssee/echeances-ics.ts',
  'src/lib/odyssee/faits-sensible.ts',
  'src/lib/noyau/coffre.ts',
  'src/lib/noyau/registre-usages.ts',
  'src/lib/odyssee/signal-veille.ts',
  'src/lib/odyssee/synthese-veille.ts',
  'src/lib/odyssee/export-ia.ts',
  'src/lib/odyssee/chaines-du-suivi.ts',
];
v('la liste des porteurs de prohibition n’a pas grossi en silence', PORTEURS_DE_PROHIBITION.length, 14);

/**
 * Les consignes envoyées à un modèle extérieur.
 *
 * `prompt.ts` porte « Dis-moi quelle confusion précise explique ma réponse ».
 * C'est une question posée à un modèle sur un item de quiz, pas une phrase
 * que Cyclades affirme à la personne — et le § 9 garde ce que l'application
 * **dit**, non ce qu'elle demande. Ce que le modèle répond est gardé
 * ailleurs, par les listes de l'assistant.
 *
 * Une seule entrée, et sa taille est vérifiée : c'est le seul endroit du
 * dépôt où la distinction se présente, et l'élargir doit se voir. Je l'ai
 * signalé au pilote plutôt que de l'exempter en silence.
 */
const CONSIGNES_VERS_UN_MODELE: readonly string[] = ['src/features/assistant/prompt.ts'];
v('une seule consigne vers un modèle est exemptée', CONSIGNES_VERS_UN_MODELE.length, 1);
v('les cinq tournures du § 9, et pas une de plus', TOURNURES_CAUSALES.length, 5);

const exempte = new Set([...PORTEURS_DE_PROHIBITION, ...CONSIGNES_VERS_UN_MODELE]);
const tousLesFichiers = fichiersDe('src');
v('src/ est bien parcouru', tousLesFichiers.length > 300, true);

const fautesCausales: string[] = [];
for (const chemin of tousLesFichiers) {
  const normalise = chemin.replace(/\\/g, '/');
  if (exempte.has(normalise)) continue;
  for (const chaine of litteraux(readFileSync(chemin, 'utf8'))) {
    for (const terme of TOURNURES_CAUSALES) {
      if (!motif(terme).test(chaine)) continue;
      if (nie(chaine, terme)) continue;
      fautesCausales.push(`${normalise} → « ${terme} » dans « ${chaine.slice(0, 60)} »`);
    }
  }
}
v(`aucune tournure causale sur les ${tousLesFichiers.length} fichiers de src/`, fautesCausales, []);

/* ══════════════════════════════════════════════════════════════════════════
   3. Les mots interdits, sur la surface du suivi
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n3. LES MOTS INTERDITS, SUR LA SURFACE DU SUIVI');

/**
 * Les fichiers du suivi personnel.
 *
 * Elle grandit d'une ligne par fichier, à chaque lot. Un fichier du suivi
 * absent d'ici n'est pas balayé : c'est pourquoi le contrôle vérifie aussi
 * que chaque fichier du dépôt dont le nom désigne le suivi y figure — la
 * liste ne peut pas prendre du retard sans le dire.
 */
const SURFACE_DU_SUIVI: readonly string[] = [
  'src/lib/odyssee/chaines-du-suivi.ts',
  'src/lib/odyssee/cycle.ts',
  'src/lib/odyssee/cycle-confidentialite.ts',
  'src/lib/odyssee/cycle-signes-alerte.ts',
  'src/lib/odyssee/donnees-cycle.ts',
];

const designeLeSuivi = (chemin: string) =>
  /chaines-du-suivi|suivi-personnel|odyssee\/(donnees-)?cycle(-|\.)/.test(chemin);
const oublies = tousLesFichiers
  .map((c) => c.replace(/\\/g, '/'))
  .filter((c) => designeLeSuivi(c) && !SURFACE_DU_SUIVI.includes(c));
v('aucun fichier du suivi n’échappe à la surface balayée', oublies, []);

/**
 * Les documents sourcés, et pourquoi ils servent d'exemption.
 *
 * ## Une citation prouvée, et non déclarée
 *
 * J'avais annoncé au pilote une exemption **structurelle** : les champs d'un
 * objet `Citation` seraient exemptés, et rien d'autre. Elle tenait, mais elle
 * reposait encore sur une déclaration — il suffisait d'appeler une phrase
 * maison « citation » pour la faire passer.
 *
 * Celle-ci est plus forte, et plus simple : une chaîne est exemptée si elle
 * **se retrouve mot pour mot dans un document de collecte**. C'est le test le
 * plus dur qui existe pour « est-ce une citation ? », puisqu'il ne demande
 * pas de croire l'auteur. Et il ne se contourne qu'en ajoutant la phrase à
 * une collecte sourcée, c'est-à-dire par un geste visible en relecture.
 *
 * Les trois citations qui en bénéficient aujourd'hui portent « anormal » :
 * « écoulement vaginal anormal », « règles anormalement abondantes »,
 * « s'aggravent anormalement ». Elles viennent des pages ameli, et les
 * réécrire serait cesser de citer.
 */
const collectes = readdirSync('docs/cyclades/collectes')
  .filter((f) => f.endsWith('.md'))
  .map((f) => readFileSync(join('docs/cyclades/collectes', f), 'utf8'))
  .join('\n')
  .replace(/[’‘`´]/g, "'")
  .replace(/[\u00A0\u202F\u2009\u200A]/g, ' ')
  .replace(/\s+/g, ' ');

const estUneCitationProuvee = (chaine: string): boolean => {
  const normalisee = chaine
    .replace(/[’‘`´]/g, "'")
    .replace(/[\u00A0\u202F\u2009\u200A]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  /*
     Une chaîne très courte se retrouve par hasard dans n'importe quel
     document. Le seuil écarte « fièvre ; » — qui ne porte d'ailleurs aucun
     mot interdit — sans écarter aucune phrase réelle.
  */
  return normalisee.length >= 20 && collectes.includes(normalisee);
};

const fautesDeMots: string[] = [];
for (const chemin of SURFACE_DU_SUIVI) {
  const source = readFileSync(chemin, 'utf8');
  /*
     LES DEUX LISTES DU FICHIER SONT RETIRÉES AVANT LE BALAYAGE, et c'est la
     seule exemption : `MOTS_INTERDITS_SUIVI` contient par construction les
     dix mots, et `LIBELLES_AUTORISES_CYCLE_OU_PHASE` est l'objet du contrôle
     suivant, pas de celui-ci.
  */
  /*
     LES LISTES DE PROHIBITION DU FICHIER LUI-MÊME SONT RETIRÉES, par leur
     NOM et non une par une.

     C'est la troisième fois que le motif se présente, et la deuxième dans ce
     chantier : une liste qui nomme ce qu'elle interdit contient par
     construction ce qu'elle interdit. `MOTS_INTERDITS_SUIVI` au lot 1, puis
     `JAMAIS_CALCULE` au lot 4 — « fenêtre fertile », « jours sûrs » — qui a
     fait rougir ce contrôle à sa première exécution sur le fichier du cycle.

     La convention de nom du dépôt est celle que `essais:schema` emploie
     déjà : INTERDIT, ECARTE, PROSCRIT, et JAMAIS pour les calculs refusés.
     Nommer les listes une par une ici obligerait à y penser à chaque lot,
     ce qui est précisément ce qu'un essai sert à ne plus avoir à faire.
  */
  const sansSesPropresListes = source
    .replace(
      /export const [A-Z_]*(INTERDIT|ECARTE|PROSCRIT|JAMAIS)[A-Z_]*[\s\S]*?\n\];/g,
      '',
    )
    .replace(/export const LIBELLES_AUTORISES_CYCLE_OU_PHASE[\s\S]*?\n\];/, '')
    /*
       ET LA LISTE BLANCHE, parce que le § 9 ne la soumet qu'aux tournures :
       « Le balayage des tournures causales s'applique partout, liste blanche
       comprise. » Les MOTS, eux, sont interdits « hors citation d'une
       source » — et une chaîne imposée est le cas même d'un texte qu'une
       autorité extérieure a arrêté. `rdv.pas-diagnostic` dit « pas un
       diagnostic » : la phrase porte le mot pour le nier, et c'est le prompt
       qui l'écrit ainsi, pas Cyclades.
    */
    .replace(/export const CHAINES_IMPOSEES[\s\S]*?\n\} as const satisfies[^;]*;/, '');
  for (const chaine of litteraux(sansSesPropresListes)) {
    for (const terme of MOTS_INTERDITS_SUIVI) {
      if (!motif(terme).test(chaine)) continue;
      if (estUneCitationProuvee(chaine)) continue;
      fautesDeMots.push(`${chemin} → « ${terme} » dans « ${chaine.slice(0, 60)} »`);
    }
  }
}
v('aucun mot interdit sur la surface du suivi', fautesDeMots, []);

/* ══════════════════════════════════════════════════════════════════════════
   4. L'ambiguïté « cycle » et « phase » là où les deux sens coexistent
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n4. « CYCLE » ET « PHASE » DANS LA ZONE OÙ LES DEUX SENS COEXISTENT');

/**
 * La zone à risque : Odyssée > Corps.
 *
 * Le statut hormonal y porte une nature dont le libellé disait « Phase du
 * cycle » au sens d'une cure de substances, dans une liste qui dit par
 * ailleurs « Traitement hormonal » et « Substance ». Le jour où le suivi
 * menstruel arrive, la même phrase désigne deux choses sans que l'écran
 * puisse les départager.
 *
 * `sensible.ts` déclare les libellés, `corps.astro` les affiche. Les deux
 * sont dans la zone, et le contrôle lit les libellés là où ils sont
 * déclarés.
 */
const ZONE_AMBIGUE: readonly string[] = [
  'src/lib/odyssee/sensible.ts',
  'src/lib/odyssee/chaines-du-suivi.ts',
  'src/lib/odyssee/cycle.ts',
  'src/lib/odyssee/cycle-confidentialite.ts',
];

const estUnLibelle = (chaine: string) =>
  /^[A-ZÀ-Þ]/.test(chaine) && chaine.length < 60 && !chaine.includes('`');

const ambigus: string[] = [];
for (const chemin of ZONE_AMBIGUE) {
  const source = readFileSync(chemin, 'utf8');
  const sansLaListe = source.replace(
    /export const LIBELLES_AUTORISES_CYCLE_OU_PHASE[\s\S]*?\n\];/,
    '',
  );
  for (const chaine of litteraux(sansLaListe)) {
    if (!estUnLibelle(chaine)) continue;
    if (!/(?<![-\w])(cycles?|phases?)(?![-\w])/i.test(chaine)) continue;
    if (LIBELLES_AUTORISES_CYCLE_OU_PHASE.includes(chaine)) continue;
    ambigus.push(`${chemin} → « ${chaine} »`);
  }
}
v('aucun libellé ambigu dans la zone', ambigus, []);
v(
  'la liste des libellés autorisés n’a pas grossi en silence',
  LIBELLES_AUTORISES_CYCLE_OU_PHASE.length,
  1,
);

console.log(
  echecs === 0
    ? `\n\x1b[32m${cles.length} chaînes imposées, ${TOURNURES_CAUSALES.length} tournures balayées sur ` +
        `${tousLesFichiers.length} fichiers, ${MOTS_INTERDITS_SUIVI.length} mots sur la surface du suivi.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
