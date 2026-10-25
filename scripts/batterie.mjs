#!/usr/bin/env node
/**
 * La batterie complète, ou le socle seul : les essais dans l'ordre, et un verdict.
 *
 *   npm run batterie   # les 235
 *   npm run socle      # les seize transversaux, onze minutes
 *
 *   npm run batterie
 *
 * ## Pourquoi cette commande existe
 *
 * La règle de travail est « batterie complète avant chaque poussée et avant
 * chaque fusion ». Tant que la batterie n'était qu'une boucle shell écrite à
 * la main dans un dossier temporaire, elle n'était ni reproductible ni
 * vérifiable : deux lancements pouvaient ne pas couvrir les mêmes essais, et
 * personne ne pouvait relire ce qui avait tourné.
 *
 * ## Ce qu'elle refuse de faire
 *
 * Elle ne lance rien si les conditions d'un verdict honnête ne sont pas
 * réunies, et elle le dit au lieu de rendre des rouges qui n'en sont pas :
 *
 * - sans `SITE_PASSWORD`, les essais de navigateur ne peuvent pas
 *   déverrouiller le site : tous seraient rouges, pour une raison qui
 *   n'appartient pas au site ;
 * - sans aperçu servant `localhost:4321`, ils n'ont rien à visiter — et un
 *   aperçu d'un AUTRE répertoire de travail répondrait quand même, ce qui
 *   mesurerait un autre site que celui qu'on croit. L'adresse est donc
 *   affichée, et c'est à l'appelant de savoir ce qu'elle sert.
 *
 * Elle ne décide pas non plus si un rouge est acceptable : elle les nomme,
 * et la comparaison au tableau des anomalies reste un geste humain.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync as lireFichier,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const ADRESSE = process.env.RACINE ?? 'http://localhost:4321';
const DELAI_MS = Number(process.env.BATTERIE_DELAI_MS ?? 500_000);

const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {};

/**
 * LE SOCLE — les essais transversaux, à passer avant chaque poussée.
 *
 * La batterie complète demande une demi-heure quand elle se reprend, et
 * quatre heures quand elle repart de zéro. La faire tourner avant chaque
 * poussée coûterait plus que ce qu'elle garde : elle se lance donc à la fin
 * de chaque prompt, avant chaque fusion de branche et avant le lancement des
 * agents. Entre deux, c'est ce socle, avec « astro check » et les essais du
 * périmètre touché.
 *
 * Le socle ne remplace pas la batterie : il attrape ce qu'une modification
 * locale casse AILLEURS, et c'est le seul genre de dégât qu'on ne voit pas
 * en relisant son propre diff. Chaque ligne porte donc ce qu'elle garde, et
 * la liste se lit — elle ne s'allonge pas par réflexe.
 */
const SOCLE = [
  ['essais:structure', 'un titre de niveau 1 par écran, un titre d’onglet unique'],
  ['essais:espaces', 'aucun mot collé à une balise en ligne, dans le site construit'],
  ['essais:mots-colles:navigateur', 'les mêmes, mesurés dans la page vivante'],
  ['essais:typographie', 'apostrophes, espaces insécables, accords sans « (s) »'],
  /*
     Deux garanties que n'importe quelle retouche du rendu Markdown peut
     défaire sans qu'on la voie : les 158 « $ » monétaires et les 100 ellipses
     « \[…\] » du contenu ne doivent jamais devenir des formules, et le HTML
     écrit à la main dans une fiche doit rester détruit — le rendu des
     mathématiques ouvre « allowDangerousHtml » sur la sortie, et c'est cet
     essai qui vérifie que la porte d'entrée, elle, est restée fermée.
  */
  ['essais:maths', 'le « $ » monétaire reste du texte, et le HTML d’auteur reste détruit'],
  ['essais:accessibilite:navigateur', 'rôles, noms accessibles, ordre de tabulation'],
  ['essais:mobile:navigateur', '360 px : aucun débordement, cibles atteignables'],
  ['essais:mouvement-reduit', 'le réglage d’animations existe, et il est respecté'],
  ['essais:themes-navigateur', 'les quatorze thèmes s’appliquent pour de vrai'],
  ['essais:themes-a-jour', 'le catalogue et les feuilles engendrées concordent'],
  ['essais:contrastes-themes', 'WCAG AA dans chaque thème'],
  ['essais:couleurs-jetons', 'aucune couleur littérale hors des jetons'],
  ['essais:theme-menus', 'aucun menu hors palette, et refus de juger à vide'],
  ['essais:coffre-ferme', 'coffre fermé, rien de sensible n’apparaît'],
  ['essais:echecs-dits', 'un échec est dit, jamais avalé'],
  ['essais:refus-dit', 'un mot de passe de coffre refusé est dit, sur chaque page'],
  ['essais:carte-ecrans', 'aucun écran orphelin, aucun au-delà de trois appuis'],
  /*
     LES BALAYAGES DE SOURCE, ajoutés au socle le 19 octobre, avec l'accord du
     pilote.

     Ils ne demandent ni navigateur ni aperçu, et coûtent quelques secondes
     chacun. Ce sont pourtant ceux qu'une écriture NOUVELLE fait rougir : une
     clé d'état qu'on vient d'inventer, un magasin qu'on vient d'ajouter, un
     essai qui sème sans le dire.

     Ils manquaient, et cela s'est payé le même jour : deux clés d'état non
     déclarées ont vécu sur `main` sans qu'un contrôle d'avant-poussée puisse
     les voir — le socle ne les contenait pas, et la batterie complète coûte
     une heure. C'est un agent qui les a signalées, pas la cadence.
  */
  ['essais:reglages-orphelins', 'aucune clé d’état écrite sans être déclarée'],
  ['essais:effacement', 'aucun magasin sans groupe, sans date déclarée, sans description'],
  ['essais:semis', 'aucun essai qui sème en base sans dire pourquoi'],
  ['essais:enregistrements', 'le registre des magasins journalisés, nommé et non compté'],
  /*
     Ajouté le 24 octobre, sur signalement du pilote. Celui-ci est resté ROUGE
     sur « main » depuis la fusion du 52 sans que personne le voie : le compte
     des magasins scellés disait 27 pour 28 réels, et seule une batterie
     complète le montrait. C'est exactement le genre d'écriture nouvelle que le
     socle est là pour attraper, et il coûte une seconde.
  */
  ['essais:coffre', 'le compte des magasins scellés, et leurs champs en clair'],
  /*
     Celui-ci garde une chose qu’aucun autre ne garde : que les tables soient
     réellement CONSULTÉES. B a saboté `compter()` et `effacer()` et tout le
     reste est resté vert — seul cet essai-ci rougissait. Un garde-fou qui
     vérifie la présence d’une déclaration ne dit rien de son effet ; c’est la
     leçon des créneaux, et elle se range ici.
  */
  ['essais:effacement:navigateur', 'les tables d’effacement sont consultées, et non seulement déclarées'],
  /*
     G-13. Celui-ci entre parce que 54 sites d’affichage viennent d’être
     routés d’un coup : le cinquante-cinquième s’écrira un jour sans que
     personne y pense, et la relecture ne l’attrapera pas. Son balayage de
     source coûte une seconde et nomme le fichier et la ligne.
  */
  ['essais:erreurs-dites', 'aucun texte brut de panne à l’écran, et les messages de domaine intacts'],
  /*
     Celui-ci garde le code de sortie de CETTE batterie-ci. Il entre au socle
     parce que le socle est justement ce qu'on enchaîne avec un `&&` avant de
     pousser : s'il est le seul passage dont le verdict compte, il doit porter
     le garde-fou de son propre verdict. Il coûte trois secondes, et il tourne
     contre un faux `npm`, donc sans site et sans mot de passe réel.
  */
  ['essais:code-de-sortie', 'la batterie rend un code non nul sur un rouge, croix à code nul comprise'],
  /*
     Celui-ci entre parce que le mot de passe avait CINQ lecteurs, dont deux
     qui rechiffrent ou chiffrent le corpus. Son balayage de source attrape
     la sixième copie, celle qu'on écrira sans y penser : une copie de
     quatre lignes a l'air juste, et une relecture ne l'attrape pas.
  */
  ['essais:mot-de-passe-une-source', 'une seule règle de lecture du mot de passe, et aucune copie'],
  /*
     Le chemin du navigateur a cassé les essais TROIS fois — quinze essais le
     19 octobre, cent soixante-un le 25, et deux de plus restés épinglés sur
     une version disparue. Chaque fois, le même piège : ne rien trouver ne
     levait pas, donc l'erreur parlait d'autre chose et on cherchait du côté
     du site. Celui-ci coûte une seconde et ne demande pas d'aperçu.
  */
  ['essais:chemin-du-navigateur', 'le navigateur se trouve, et son absence refuse au lieu de se taire'],
];

/**
 * LES PRÉPARATIONS — ce qu'il faut avoir fait pour qu'un essai mesure.
 *
 * `essais:actualites:navigateur` mesure la LONGUEUR de l'archive des
 * actualités. Or les actualités ne viennent pas du build : elles vivent
 * chiffrées dans « actualites-data/ », et c'est la publication qui les copie
 * à côté du site. En local, « dist/ » ne porte que les quelques entrées de
 * démonstration — et l'essai disait donc « 1 période(s) seulement », en
 * expliquant lui-même quoi lancer.
 *
 * Ce n'était un défaut ni du site ni de l'essai : c'était l'ordre du
 * passage. La batterie joue donc la préparation avant l'essai qui en a
 * besoin, une seule fois, et le dit.
 *
 * Pourquoi ici et non dans l'essai : parce que l'essai, lancé seul, doit
 * continuer à REFUSER en expliquant — il est juste qu'un essai dise « il me
 * manque ceci » plutôt que de modifier « dist/ » dans le dos de qui le
 * lance. C'est le passage d'ensemble qui a la charge de l'ordre.
 */
const PREPARATIONS = {
  'essais:actualites:navigateur': [
    [
      'actualites:dist',
      'copie les actualités réelles dans « dist/ » et reconstruit leur ' +
        'inventaire ; sans elles, l’archive mesurée fait une période',
    ],
  ],
};

const SOCLE_SEUL = process.argv.includes('--socle');

/* Tout ce qui commence par « essais » : la liste ne se tient pas à la main. */
const tous = Object.keys(scripts).filter((n) => n.startsWith('essais'));
const noms = SOCLE_SEUL ? SOCLE.map(([n]) => n) : tous;

if (SOCLE_SEUL) {
  /*
     Un nom du socle qui n'existe plus doit arrêter la commande, et non
     disparaître du passage : un socle qui rétrécit en silence ne garde plus
     ce qu'il annonce.
  */
  const inconnus = noms.filter((n) => !(n in scripts));
  if (inconnus.length > 0) {
    console.error(
      `✗ REFUS — le socle nomme des essais qui n’existent pas : ${inconnus.join(', ')}.\n` +
        '  Un essai renommé se renomme aussi dans le socle ; un essai retiré se retire\n' +
        '  du socle avec la raison de son retrait.',
    );
    process.exit(1);
  }
}

if (noms.length === 0) {
  console.error('✗ PANNE — aucun essai trouvé dans package.json.');
  process.exit(1);
}

/* ── Les deux refus ────────────────────────────────────────────────────── */

/*
   LE MOT DE PASSE SE LIT AUSSI DANS `.env.local`, ET C'EST MIEUX AINSI.

   Ce refus exigeait la variable d'environnement, et sa phrase disait « donnez-
   le dans l'environnement de la commande ». C'est précisément ce qu'il ne faut
   pas faire : une commande s'enregistre dans le journal de la session, en
   clair, et le secret y reste. `.env.local` est le fichier du build, ignoré
   par Git, et `essais:secret` vérifie qu'il n'est pas suivi.

   On passe donc par le module partagé, que cent trente-trois essais emploient
   déjà, et on POSE la valeur dans l'environnement : les essais-enfants
   reçoivent `process.env` et n'ont rien à changer.

   Le refus reste entier quand il n'y a de mot de passe nulle part : sans lui,
   les essais de navigateur ne déverrouilleraient pas le site et la batterie
   rendrait des rouges qui n'appartiennent pas au site.
*/
process.env.SITE_PASSWORD ||= motDePasseEssais();

const sert = await fetch(`${ADRESSE}/robots.txt`, { signal: AbortSignal.timeout(20_000) })
  .then((r) => r.ok)
  .catch(() => false);
if (!sert) {
  console.error(
    `✗ REFUS — rien ne répond sur ${ADRESSE}.\n` +
      '  Construisez puis lancez l’aperçu avant la batterie :\n' +
      '    node scripts/build-content.mjs            (le manifeste chiffré)\n' +
      '    REVINSP_SANS_PODCAST=1 npx astro build    (avec .env.local, puis effacé)\n' +
      '    npx astro preview stop && npx astro preview --port 4321\n' +
      '  La première ligne manquait à ce message, et son absence coûte cher sur\n' +
      '  un conteneur neuf : le site se construit, l’aperçu répond, mais le\n' +
      '  manifeste de contenu n’existe pas, donc le déverrouillage échoue — et\n' +
      '  les essais de navigateur expirent sans dire pourquoi.\n' +
      '  Un aperçu d’un AUTRE répertoire de travail répondrait aussi : vérifiez\n' +
      '  qu’il sert bien le « dist/ » que vous venez de construire.',
  );
  process.exit(1);
}

/* ── Le laboratoire ────────────────────────────────────────────────────── */

/*
   CINQ ESSAIS NE PEUVENT PAS TOURNER DANS L'ARBRE DE TRAVAIL, ET C'EST VOULU.

   Ils bâtissent eux-mêmes un « content/ » depuis « content-exemple/ », avec un
   mot de passe factice, servent sur le port 4322, puis effacent tout. Ils
   REFUSENT donc de démarrer si « content/ », « .env.local » ou « public/data/ »
   existent déjà — c'est-à-dire toujours, dans le répertoire où le travail se
   fait. La batterie les comptait rouges, et la règle « aucun rouge avant de
   fusionner » devenait inapplicable.

   Les déplacer eux n'était pas la réponse : déplacer le « content/ » réel pour
   leur faire de la place, non plus, puisqu'ils le suppriment en fin de course
   et qu'il n'est pas dans Git.

   La réponse est un **arbre de travail séparé**, pris sur le même commit. Il
   ne porte aucun des trois fichiers, puisqu'aucun n'est suivi : leurs gardes
   sont satisfaites sans qu'on touche à quoi que ce soit ici. `node_modules` y
   est lié plutôt que réinstallé.

   Le laboratoire n'est créé que si au moins un de ces essais doit tourner, et
   il est retiré à la fin.
*/
const EN_LABORATOIRE = new Set([
  'essais:acces-m9',
  'essais:lecteur-parties',
  'essais:seances-parties:navigateur',
  'essais:parties-client',
  'essais:reperes-audio',
  /*
     C3 du prompt 43. L'écran du QCM DGFiP ne s'ouvre que si la banque de
     questions existe, et aucune n'est servie dans le conteneur de travail :
     « Commencer » y est désactivé, donc aucune épreuve ne peut être
     commencée ni gardée. Celui-ci se bâtit une banque synthétique de quatre
     questions, et tombe donc sous la même garde que les cinq autres.
  */
  'essais:epreuve-gardee:navigateur',
  /*
     L'aller-retour de récupération construit `content/`, le publie, le
     récupère, puis RECONSTRUIT depuis le récupéré. Il lui faut donc un arbre
     à lui : lancé ici, il verrait le `content/` d'un autre essai de
     laboratoire et se tairait sur sa garde.
  */
  'essais:recuperation-corpus',
  /*
     La correction détaillée à l'écran se vérifie sur un décor dont on connaît
     le contenu : quatre questions corrigées de la même façon, et une question
     de fiche injectée. Elle tombe donc sous la même garde que les autres —
     elle bâtit son `content/` et l'efface.
  */
  'essais:correction-ecran',
]);

/*
   Une batterie lancée DANS un laboratoire n'en crée pas un second : elle y est
   déjà, et la récursion coûterait un arbre par essai.

   Le signe est que « .git » y est un FICHIER, qui renvoie au dépôt principal,
   et non un dossier. Une première version regardait seulement s'il existait :
   il existe des deux côtés, et la détection ne détectait rien.
*/
const DANS_UN_LABORATOIRE = (() => {
  try {
    return statSync(join(process.cwd(), '.git')).isFile();
  } catch {
    return false;
  }
})();

let laboratoire = null;
function ouvrirLeLaboratoire() {
  if (laboratoire !== null) return laboratoire;
  const chemin = mkdtempSync(join(tmpdir(), 'labo-batterie-'));
  try {
    execFileSync('git', ['worktree', 'add', '--detach', chemin, 'HEAD'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
    });
    symlinkSync(join(process.cwd(), 'node_modules'), join(chemin, 'node_modules'));
    laboratoire = chemin;
  } catch (erreur) {
    /*
       L'échec n'est pas avalé : sans laboratoire, ces essais tomberaient sur
       leur garde et seraient comptés rouges pour une raison qui n'est pas la
       leur. On le dit une fois, et ils tournent là où ils sont.
    */
    console.log(
      `  \x1b[33m—\x1b[0m le laboratoire n'a pas pu être ouvert : ` +
        `${(erreur.stderr || erreur.message || '').toString().trim().slice(0, 200)}`,
    );
    laboratoire = false;
  }
  return laboratoire;
}

function fermerLeLaboratoire() {
  if (!laboratoire) return;
  try {
    rmSync(join(laboratoire, 'node_modules'), { force: true });
    execFileSync('git', ['worktree', 'remove', '--force', laboratoire], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
  } catch {
    /* Un laboratoire qui survit coûte de la place, pas une mesure fausse. */
  }
}

/* ── Le passage ────────────────────────────────────────────────────────── */

/*
   REPRENDRE UNE BATTERIE INTERROMPUE — 19 octobre.

   Le conteneur a redémarré au 151ᵉ essai sur 235, après deux heures et
   demie. Tout refaire aurait coûté deux heures et demie de plus pour
   remesurer la même construction, et la règle « batterie complète avant
   chaque poussée » serait devenue impraticable au premier incident.

   `BATTERIE_JOURNAL` désigne un journal existant : les essais qui y ont
   déjà un verdict sont REPRIS tels quels, et seuls les autres tournent.
   C'est juste à une condition, qui ne se devine pas et qui est donc
   rappelée à l'écran : la construction servie doit être la même. Reprendre
   un journal après un `astro build` mesurerait deux sites à la fois.

   Les verdicts s'écrivent au fur et à mesure, et non à la fin : un journal
   d'une batterie tuée en route doit rester exploitable, sinon il ne sert à
   rien le jour où il sert.
*/
const journal = process.env.BATTERIE_JOURNAL ?? mkdtempSync(join(tmpdir(), 'batterie-'));
if (!existsSync(journal)) mkdirSync(journal, { recursive: true });
const cheminDesVerdicts = join(journal, 'verdicts.json');

let verdicts = {};
if (existsSync(cheminDesVerdicts)) {
  try {
    verdicts = JSON.parse(lireFichier(cheminDesVerdicts, 'utf8'));
  } catch {
    /* Journal illisible : on remesure tout plutôt que de deviner. */
    verdicts = {};
  }
}

/*
   Les journaux de la batterie tuée au redémarrage n'ont pas de verdict
   écrit — le fichier n'existait pas encore. On les relit, et on les juge
   sur ce que le journal porte : une croix en tête de ligne, ou une signature
   de panne.
   Le code de sortie, lui, est perdu : c'est dit, essai par essai, dans le
   récapitulatif, parce qu'un juge amputé qui se présente comme entier est
   pire qu'un essai relancé.
*/
/**
 * Une ligne d'échec, c'est une ligne qui COMMENCE par une croix.
 *
 * Il a fallu trois états du monde pour arriver à cette règle, et les deux
 * premières versions du juge se sont trompées, chacune dans un sens :
 *
 * - la plupart des essais écrivent leur croix en rouge : la chercher ainsi
 *   les attrape ;
 * - « essais:retours » écrit, dans un libellé VERT, « et ✗ pour une réponse
 *   fausse ». Il décrit le signe, il ne l'émet pas : chercher la croix nue le
 *   déclarait rouge à tort — un faux rouge ;
 * - « essais:sante » écrit sa croix SANS couleur, en tête de ligne. Chercher
 *   la croix rouge l'a donc compté VERT alors qu'il est rouge — un faux vert,
 *   pire, et c'est la batterie elle-même qui l'a montré : elle annonçait 215
 *   verts là où il y en avait 214.
 *
 * La POSITION tranche les trois : une ligne d'échec porte sa croix en tête,
 * un libellé qui parle de la croix la porte au milieu. On retire donc les
 * séquences d'échappement et l'indentation, puis on regarde le premier
 * caractère visible.
 */
const sansCouleur = (ligne) => ligne.replace(/\u001b\[[0-9;]*m/g, '').trim();
const lignesDEchec = (texte) =>
  texte.split('\n').filter((l) => sansCouleur(l).startsWith('✗'));

const PANNE = /\n(?:node:internal|.*Error: |npm error )/;
const reprisSansCode = [];
for (const nom of noms) {
  if (verdicts[nom]) continue;
  const fichier = join(journal, `${nom.replace(/[:/]/g, '-')}.log`);
  if (!existsSync(fichier)) continue;
  const texte = lireFichier(fichier, 'utf8');
  const croix = lignesDEchec(texte).length > 0;
  const panne = PANNE.test(texte);
  verdicts[nom] = { code: null, croix: croix || panne, repris: true };
  reprisSansCode.push(nom);
}

/*
   Le titre dit lequel des deux passages tourne. Un journal qui annonce
   « batterie complète » après seize essais mentirait de la même façon qu'un
   faux vert : sur ce qui a été mesuré.
*/
const INTITULE = SOCLE_SEUL ? 'SOCLE' : 'BATTERIE COMPLÈTE';
console.log(`\n${INTITULE} — ${noms.length} essais, aperçu sur ${ADRESSE}`);
console.log(`Journaux : ${journal}`);
const dejaJuges = noms.filter((n) => verdicts[n]).length;
if (dejaJuges > 0) {
  console.log(
    `Repris du journal : ${dejaJuges} essais (dont ${reprisSansCode.length} jugés sur leur ` +
      'journal seul, code de sortie perdu).\n' +
      '  Valable À LA SEULE CONDITION que la construction servie soit la même.',
  );
}
console.log('');

const rouges = [];
let verts = 0;
const debut = Date.now();

for (const [index, nom] of noms.entries()) {
  const compteur = `${String(index + 1).padStart(3, ' ')}/${noms.length}`;

  /* Déjà jugé : on reprend le verdict, on ne relance pas. */
  const connu = verdicts[nom];
  if (connu) {
    if (connu.croix || (connu.code !== null && connu.code !== 0)) {
      rouges.push(nom);
      console.log(`  \x1b[31m✗\x1b[0m ${compteur} ${nom} (repris du journal)`);
    } else {
      verts += 1;
      console.log(`  \x1b[32m✓\x1b[0m ${compteur} ${nom} (repris)`);
    }
    continue;
  }
  /*
     La préparation d'abord, s'il y en a une. Son échec n'est pas avalé : un
     essai lancé sans sa préparation mesurerait autre chose que ce qu'il dit,
     et un rouge de cette sorte-là coûte une heure de diagnostic.
  */
  for (const [prep, pourquoi] of PREPARATIONS[nom] ?? []) {
    console.log(`  \x1b[36m…\x1b[0m ${compteur} ${nom} — préparation « ${prep} » : ${pourquoi}`);
    try {
      execFileSync('npm', ['run', '--silent', prep], {
        encoding: 'utf8',
        timeout: DELAI_MS,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    } catch (erreur) {
      console.log(
        `  \x1b[31m✗\x1b[0m la préparation « ${prep} » a échoué : ` +
          `${(erreur.stderr || erreur.stdout || erreur.message || '').toString().trim().slice(0, 300)}`,
      );
    }
  }

  /*
     Les essais de laboratoire tournent dans l'arbre séparé — voir plus haut.
     Les autres tournent ici, et rien ne change pour eux.
  */
  const ou =
    EN_LABORATOIRE.has(nom) && !DANS_UN_LABORATOIRE ? ouvrirLeLaboratoire() : null;
  if (ou) console.log(`  \x1b[36m…\x1b[0m ${compteur} ${nom} — dans l'arbre de laboratoire`);

  let sortie = '';
  let code = 0;
  const depart = Date.now();
  try {
    sortie = execFileSync('npm', ['run', '--silent', nom], {
      encoding: 'utf8',
      timeout: DELAI_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      ...(ou ? { cwd: ou } : {}),
    });
  } catch (erreur) {
    code = erreur.status ?? (erreur.signal ? 124 : 1);
    sortie = `${erreur.stdout ?? ''}${erreur.stderr ?? ''}`;
    if (erreur.signal) sortie += `\n[batterie] interrompu après ${DELAI_MS} ms (${erreur.signal})`;
  }
  writeFileSync(join(journal, `${nom.replace(/[:/]/g, '-')}.log`), sortie);
  verdicts[nom] = { code, croix: lignesDEchec(sortie).length > 0 };
  writeFileSync(cheminDesVerdicts, JSON.stringify(verdicts, null, 1));

  /*
     Deux juges, et non un seul : le code de sortie, et la présence d'une
     croix EN TÊTE DE LIGNE. Certains essais rendent 0 en affichant des croix — c'est un
     défaut de ces essais, consigné ailleurs, mais la batterie ne doit pas
     s'en rendre complice en les comptant verts.

     Le juge est décrit au-dessus de « lignesDEchec » : ni la croix nue, qui
     fabriquait un faux rouge, ni la croix rouge, qui a fabriqué un faux
     vert, mais la croix en tête de ligne.
  */
  const croix = lignesDEchec(sortie).length > 0;
  const secondes = ((Date.now() - depart) / 1000).toFixed(0);
  if (code === 0 && !croix) {
    verts += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${compteur} ${nom} (${secondes} s)`);
  } else {
    rouges.push(nom);
    console.log(`  \x1b[31m✗\x1b[0m ${compteur} ${nom} (code ${code}, ${secondes} s)`);
    for (const ligne of lignesDEchec(sortie).slice(0, 3)) {
      console.log(`        ${ligne.trim().slice(0, 160)}`);
    }
  }
}

const minutes = ((Date.now() - debut) / 60_000).toFixed(0);
console.log(
  `\n${SOCLE_SEUL ? 'socle' : 'batterie complète'} : ${verts} verts ; ` +
    `${rouges.length} rouges (${minutes} min)`,
);
if (rouges.length > 0) {
  console.log(`rouges : ${rouges.join(' ')}`);
  console.log(
    'À comparer au tableau des anomalies avant toute poussée : un rouge qui n’y\n' +
      'figure pas est un rouge NOUVEAU, et il se corrige avant de pousser.',
  );
}
console.log(`Journaux conservés : ${journal}\n`);
fermerLeLaboratoire();

/*
   LE CODE DE SORTIE JUGE, DÉSORMAIS.

   Il rendait zéro quoi qu'il arrive, et son commentaire l'assumait : « la
   batterie rapporte, l'humain tranche ». La phrase est juste pour un humain
   qui lit les vingt lignes du récapitulatif. Elle est fausse pour tout le
   reste : un `npm run socle && git push` passe, un enchaînement s'enchaîne,
   et une relecture rapide ne voit que « terminé ». TROIS agents s'y sont
   trompés, chacun de bonne foi, en lisant le zéro comme un verdict.

   Un passage qui ne peut pas dire non ne garde rien. Le code de sortie dit
   donc ce que le récapitulatif dit déjà : un si la liste des rouges n'est
   pas vide, zéro sinon. Les REFUS en amont rendaient déjà un, et ils
   continuent.

   Le récapitulatif reste entier : le code de sortie ne remplace pas la
   lecture, il empêche seulement de s'en passer sans le savoir.

   `essais:code-de-sortie` le garde, par sabotage : il fait tourner cette
   batterie-ci contre un faux `npm`, et vérifie les trois cas — tout vert,
   un code non nul, et une croix avec un code nul, qui est celui qui a
   trompé.
*/
process.exit(rouges.length > 0 ? 1 : 0);
