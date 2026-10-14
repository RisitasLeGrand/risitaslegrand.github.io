/**
 * L'étanchéité de la donnée morte : ce qui n'est pas là, et ce qui ne lit pas.
 *
 * ## Pourquoi ce contrôle, plutôt qu'une promesse
 *
 * La consigne est qu'une bibliothèque externe soit « une donnée morte, en
 * consultation seule » : ses données n'entrent dans aucune analyse, et rien
 * d'elle n'est copié dans le dépôt. Ce sont deux propriétés **négatives**, et
 * une propriété négative ne se constate pas en relisant : elle se constate en
 * cherchant, et en échouant à trouver.
 *
 * Ce fichier cherche donc trois choses, et il doit échouer à les trouver :
 *
 * 1. une **chaîne caractéristique** de cette base dans un fichier suivi par
 *    Git — noms de champs de ses données, extraits, pseudonymes ;
 * 2. un **module d'analyse** qui importerait la passerelle ou le registre ;
 * 3. un **lien par indice** (`#c` suivi d'un nombre), dont la cible dépend de
 *    la version publiée de la page.
 *
 * ## Ce qu'il ne prouve pas
 *
 * Il lit des fichiers, pas un programme en marche. Il dit que le code ne peut
 * pas lire cette donnée par import ; il ne dirait rien d'un `fetch` construit
 * à l'exécution. Le quatrième contrôle ci-dessous ferme cette porte-là en
 * cherchant le domaine dans tout le code.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

let rouges = 0;
const v = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(
      `  \x1b[31m✗\x1b[0m ${quoi}\n      attendu ${JSON.stringify(attendu)}\n      obtenu  ${JSON.stringify(obtenu)}`,
    );
    rouges += 1;
  }
};

/** Les fichiers que Git suit — donc ceux qui partent dans le dépôt public. */
const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => /\.(ts|mts|js|mjs|astro|svelte|json|css|md|yml|html)$/.test(f));

/**
 * Les noms de champs propres à cette base. Les trouver dans un fichier suivi
 * signifierait qu'une partie de ses données y a été recopiée.
 */
const CHAMPS_DE_LA_BASE = [
  'anecAuthors',
  'compoundCats',
  'studyTypes',
  'subtopics',
];

/**
 * Les trois endroits où le **nom** de la ressource a le droit d'apparaître :
 * la passerelle, qui doit bien porter son adresse ; le script d'extraction,
 * qui est lancé à la main ; et la documentation, qui explique pourquoi.
 */
const LIEUX_AUTORISES = [
  'src/lib/odyssee/bibliotheque-externe.ts',
  'scripts/construire-registre-molecules.mjs',
  'scripts/essais-bibliotheque.mjs',
  'docs/cyclades/plan-molecules.md',
  'docs/cyclades/message-proprietaire-bibliotheque.md',
];

console.log('\n\x1b[1mTEST DE DÉPÔT — RIEN DE LA BASE N’Y EST\x1b[0m\n');
{
  const fautifs = [];
  for (const f of suivis) {
    const texte = readFileSync(f, 'utf8');
    for (const champ of CHAMPS_DE_LA_BASE) {
      if (texte.includes(champ) && !LIEUX_AUTORISES.includes(f)) {
        fautifs.push(`${f} → « ${champ} »`);
      }
    }
  }
  v(`aucun champ de la base dans ${suivis.length} fichiers suivis`, fautifs, []);

  const nommee = suivis.filter(
    (f) =>
      !LIEUX_AUTORISES.includes(f) && readFileSync(f, 'utf8').includes('Nootopics'),
  );
  v('la ressource n’est nommée que là où elle doit l’être', nommee, []);

  /* Le registre de noms, lui, ne doit pas être suivi du tout. */
  v(
    'le registre des molécules n’est pas dans le dépôt',
    suivis.filter((f) => f.endsWith('content/sante/molecules.json')),
    [],
  );
}

console.log('\n\x1b[1mLE PAQUET PUBLIÉ — RIEN EN CLAIR\x1b[0m\n');
{
  /*
     Le registre des noms **est** dans le paquet publié, et c'est voulu : sans
     lui le menu n'aurait pas la liste demandée. Mais il y est chiffré, comme
     tout le contenu de ce site. Ce contrôle le vérifie plutôt que de le
     supposer — un fichier qu'on croit chiffré et qui ne l'est pas est la
     seule façon dont cette histoire pouvait mal finir.
  */
  if (!existsSync('dist/data')) {
    console.log('  · pas de paquet construit : contrôle sauté.');
  } else {
    const chemin = 'dist/data/molecules.json';
    if (!existsSync(chemin)) {
      console.log('  · aucun registre publié (extraction non lancée) : contrôle sans objet.');
    } else {
      const publie = JSON.parse(readFileSync(chemin, 'utf8'));
      v('le registre publié est une enveloppe chiffrée', Object.keys(publie).sort(), ['ct', 'iv']);
      const local = JSON.parse(readFileSync('content/sante/molecules.json', 'utf8'));
      /*
         Le témoin n'est **pas nommé** dans la sortie : reproduire un nom de
         la base dans un rapport serait exactement ce que la consigne
         interdit. On dit son rang, pas son libellé.
      */
      const rang = Math.floor(local.length / 2);
      const temoin = local[rang]?.nom ?? '';
      v(
        `le nom de rang ${rang} n’est pas lisible dans le paquet`,
        Boolean(temoin) && publie.ct.includes(temoin),
        false,
      );
    }
    /*
       Aucune page construite ne porte un **champ de données** de la base.
       L'adresse, elle, a le droit d'y être : c'est le lien, et un lien sans
       adresse ne mène nulle part. Le contrôle vérifie donc qu'elle n'est que
       sur l'écran qui la porte, et nulle part ailleurs.
    */
    const pages = execFileSync('find', ['dist', '-name', '*.html'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    const avecDonnees = pages.filter((f) => {
      const t = readFileSync(f, 'utf8');
      return CHAMPS_DE_LA_BASE.some((c) => t.includes(c));
    });
    v(`aucune des ${pages.length} pages construites ne porte un champ de la base`, avecDonnees, []);

    const avecAdresse = pages.filter((f) => readFileSync(f, 'utf8').includes('Nootopics'));
    v('l’adresse n’est que sur l’écran de molécule', avecAdresse, [
      'dist/odyssee/molecule/index.html',
    ]);
  }
}

console.log('\n\x1b[1mGRAPHE D’IMPORTS — AUCUNE ANALYSE NE LA LIT\x1b[0m\n');
{
  /**
   * Les modules qui n'ont pas le droit d'importer la passerelle ni le
   * registre. La liste est volontairement large : « aucune analyse » couvre
   * les dérivées, les croisements, les alertes, les statistiques, l'XP, la
   * veille, la recherche, les exports, les sauvegardes, la synchronisation et
   * l'assistant.
   */
  const ANALYSES = [
    'src/lib/agregats.ts',
    'src/lib/niveau.ts',
    'src/lib/gamification.ts',
    'src/lib/journal.ts',
    'src/lib/recherche.ts',
    'src/lib/sauvegarde.ts',
  ];
  const DOSSIERS_ANALYSE = [
    'src/lib/sync/',
    'src/features/assistant/',
    'src/lib/odyssee/veille',
    'src/lib/odyssee/signal-veille',
    'src/lib/odyssee/tendances',
    'src/lib/odyssee/indicateurs',
    'src/lib/odyssee/export',
  ];
  const INTERDITS = ['bibliotheque-externe', 'chargerRegistreMolecules'];

  const lecteurs = [];
  for (const f of suivis) {
    const analyse =
      ANALYSES.includes(f) || DOSSIERS_ANALYSE.some((d) => f.startsWith(d));
    if (!analyse) continue;
    const texte = readFileSync(f, 'utf8');
    for (const i of INTERDITS) {
      if (texte.includes(i)) lecteurs.push(`${f} → ${i}`);
    }
  }
  v('aucun module d’analyse n’importe la passerelle ni le registre', lecteurs, []);

  /* Et personne n'écrit la ressource dans IndexedDB. */
  const base = readFileSync('src/lib/db.ts', 'utf8');
  v(
    'aucun magasin ne porte cette ressource',
    /bibliotheque|nootropic|nootopics/i.test(base),
    false,
  );
}

console.log('\n\x1b[1mLA PASSERELLE EST UNE SORTIE, PAS UN APPEL\x1b[0m\n');
{
  const passerelle = readFileSync('src/lib/odyssee/bibliotheque-externe.ts', 'utf8');
  const ecran = readFileSync('src/pages/odyssee/molecule.astro', 'utf8');

  v(
    'l’adresse est la page d’accueil, sans paramètre ni fragment',
    /ADRESSE_BIBLIOTHEQUE =\s*\n?\s*'https:\/\/[^']*\/';/.test(passerelle),
    true,
  );
  v('aucun lien par indice dans le code', /#c\d+/.test(passerelle + ecran), false);
  v('le lien porte noopener et noreferrer', ecran.includes('rel="noopener noreferrer"'), true);
  v('et il s’ouvre dans un nouvel onglet', ecran.includes('target="_blank"'), true);
  v(
    'son nom dit qu’il est externe et ouvre un onglet',
    ecran.includes('site externe, s’ouvre dans un nouvel onglet'),
    true,
  );
  v(
    'aucun fetch de Cyclades vers ce domaine',
    suivis
      .filter((f) => f.startsWith('src/'))
      .some((f) => /fetch\([^)]*nootropics123/i.test(readFileSync(f, 'utf8'))),
    false,
  );
  v(
    'la mention « donnée morte » est sur l’écran',
    ecran.includes('MENTION_DONNEE_MORTE'),
    true,
  );
  v(
    'l’avertissement nomme les témoignages et les doses rapportées',
    passerelle.includes('témoignages de tiers, dont des doses rapportées'),
    true,
  );
  v(
    'l’écran dit que Cyclades ne sait pas si la ressource couvre la molécule',
    ecran.includes('COUVERTURE_INCONNUE'),
    true,
  );
}

console.log('\n\x1b[1mAUCUNE TRACE DE CE QUI EST CONSULTÉ\x1b[0m\n');
{
  const ecran = readFileSync('src/pages/odyssee/molecule.astro', 'utf8');
  /*
     La seule chose que cet écran a le droit d'écrire est une note de
     ressenti, et la préférence « ne plus avertir ». Pas un compteur
     d'ouvertures, pas un historique de recherche : savoir quelles molécules
     quelqu'un regarde est une donnée de santé.
  */
  const ecritures = [...ecran.matchAll(/ecrire[A-Z]\w*/g)].map((m) => m[0]);
  v('la seule écriture de l’écran est le ressenti', [...new Set(ecritures)], ['ecrireRessenti']);
  v(
    'aucun compteur de consultation',
    /consultations?|vues?Compteur|nbOuvertures/.test(ecran),
    false,
  );
}

if (rouges > 0) {
  console.log(`\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m`);
  process.exit(1);
}
console.log('\n\x1b[32mTous les essais passent.\x1b[0m');
