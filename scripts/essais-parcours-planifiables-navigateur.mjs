/**
 * Les trois parcours DGFiP, planifiables de bout en bout — avec du contenu.
 *
 *   npm run essais:parcours-planifiables:navigateur
 *
 * ## Ce que cet essai ajoute à ceux qui existent déjà
 *
 * `essais:parcours-vides:navigateur` ouvre la planification de DGFiP B, A et A+
 * **sans une seule fiche** : il garde les états vides, et c'est son objet. Il ne
 * peut donc rien dire du cas suivant, qui est celui vers lequel le projet va :
 * un parcours qui a du contenu. Entre les deux il y a tout ce qui compte — une
 * séance qui propose vraiment quelque chose à réviser.
 *
 * Et il y a surtout la question que personne n'avait encore posée à l'écran :
 * **une fiche partagée est-elle servie au bon parcours, et à lui seul ?** Le
 * registre déclare `racinesPartagees: ['commun']` pour les trois parcours DGFiP,
 * le build écrit `parcoursServis` dans le manifeste, et le commentaire du build
 * le dit en toutes lettres : « Le manifeste les PORTE ; rien ne les filtre
 * encore. » Un essai de nœud ne peut pas trancher : il faut peindre la séance.
 *
 * ## Pourquoi un laboratoire, et pas l'aperçu de la batterie
 *
 * Le contenu DGFiP n'existe pas et viendra fiche par fiche pendant des mois.
 * Mesurer ce cas-là demande donc de le fabriquer. L'essai construit « content/ »
 * depuis « content-exemple/ » — qui donne l'INSP, le témoin —, y plante des
 * fiches DGFiP et une racine commune, chiffre le tout avec un mot de passe
 * FACTICE, sert le résultat sur le port 4322, comme ses six voisins, puis efface tout derrière lui.
 * Si « content/ », « .env.local », le témoin local ou « public/data/ » existent
 * déjà, il ne s'exécute pas et le dit : il ne travaillera pas par-dessus du
 * contenu réel.
 *
 * ## Le contenu planté, et pourquoi celui-là
 *
 * « Organisation de la DGFiP » est la matière que DGFiP B et DGFiP A déclarent
 * TOUS LES DEUX, sous le même thème `environnement-dgfip` et le même intitulé —
 * le registre le dit : « c'est la même matière, et le lot de partage entre
 * parcours s'appuiera là-dessus. » C'est donc la seule matière qui permette de
 * poser les deux questions d'un coup :
 *
 *  - la fiche de `commun/` arrive-t-elle dans la séance des deux parcours ?
 *  - la fiche de `dgfip-b/` reste-t-elle HORS de la séance de DGFiP A ?
 *
 * La seconde est celle qui mord. Sans elle, un écran qui servirait le corpus
 * entier à tout le monde passerait pour un succès.
 *
 * A+ ne déclare pas cette matière : son thème `option-metier` porte « Gestion
 * des ressources et l'organisation de la DGFiP », l'intitulé de l'arrêté. Son
 * couple de fiches est donc écrit sur cette matière-là — et l'écart entre les
 * deux intitulés est un constat, pas un oubli de l'essai.
 *
 * ## Les jours ne sont pas écrits en dur
 *
 * `environnement-dgfip` tombe un samedi chez B comme chez A, `option-metier` un
 * dimanche chez A+. Les dates sont CALCULÉES à partir d'aujourd'hui : une date
 * figée ferait vieillir l'essai, et c'est un piège dans lequel ce dépôt est
 * déjà tombé une fois — cinq assertions de l'initialisation ont basculé le jour
 * où un délai de sept jours est apparu derrière un `reporteLe` gelé.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { idStable } from './lib/crypto.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOT_DE_PASSE = 'laboratoire-parcours-planifiables-sans-valeur';
const PORT = 4322;
const RACINE_WEB = `http://localhost:${PORT}`;

/**
 * Le prochain jour de la semaine demandé, aujourd'hui compris.
 *
 * 0 = dimanche, comme `rotationParDefaut` indexe la semaine. Rendre « aujourd'hui »
 * quand il tombe juste évite de sauter sept jours pour rien.
 */
function prochainJour(jourSemaine) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((jourSemaine - d.getDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

const SAMEDI = prochainJour(6);
const DIMANCHE = prochainJour(0);

/*
   Les six fiches du laboratoire.

   Deux couples « parcours + commun » sur une même matière, pour que la séance
   ait de quoi distinguer ; plus les deux épreuves de A+, qui servent à l'essai
   de l'estimation de niveau et dont la présence ici garantit qu'elles sont
   bien construites et bien servies.
*/
const MATIERE_PARTAGEE_B_ET_A = 'Organisation de la DGFiP';
const MATIERE_PARTAGEE_AP = 'Gestion des ressources et l’organisation de la DGFiP';

const FICHES = [
  {
    chemin: 'dgfip-b/environnement/fiche-01-reseau.md',
    matiere: MATIERE_PARTAGEE_B_ET_A,
    fascicule: 'Environnement et organisation',
    titre: 'Le réseau de la DGFiP, pour le contrôleur',
  },
  {
    chemin: 'dgfip-a/environnement/fiche-01-reseau.md',
    matiere: MATIERE_PARTAGEE_B_ET_A,
    fascicule: 'Environnement et organisation',
    titre: 'Le réseau de la DGFiP, pour l’inspecteur',
  },
  {
    chemin: 'commun/fiche-01-organisation-partagee.md',
    matiere: MATIERE_PARTAGEE_B_ET_A,
    fascicule: 'Environnement et organisation',
    titre: 'L’organisation de la DGFiP, fiche partagée',
  },
  {
    chemin: 'dgfip-ap/metier/fiche-01-ressources.md',
    matiere: MATIERE_PARTAGEE_AP,
    fascicule: 'Épreuve professionnelle',
    titre: 'La gestion des ressources, pour l’inspecteur principal',
  },
  {
    chemin: 'commun/fiche-02-ressources-partagee.md',
    matiere: MATIERE_PARTAGEE_AP,
    fascicule: 'Épreuve professionnelle',
    titre: 'La gestion des ressources, fiche partagée',
  },
  {
    chemin: 'dgfip-ap/entretien/fiche-01-entretien.md',
    matiere: 'Entretien avec le jury',
    fascicule: 'Oral',
    titre: 'L’entretien avec le jury, ce qu’il mesure',
  },
];

/*
   Une banque « QCM — DGFiP » de laboratoire, à TROIS rubriques — une par
   origine de question.

   C'est la seule forme qui permette de voir la règle à l'écran : DGFiP B ne
   tire que les questions B et maison (prompt 20, tenu par
   `questionsServables`), donc la rubrique de catégorie A ne doit pas lui être
   annoncée du tout. Une banque d'une seule origine, comme celle de
   `essais:epreuve-gardee:navigateur`, ne dirait rien de ce partage.

   La règle elle-même est éprouvée sans navigateur par `essais:temporalite`.
   Ce qui se mesure ici est que l'accueil dise la MÊME chose qu'elle : il
   affichait les totaux du build, qui comptent toutes les questions sans
   regarder leur origine.

   QUATRE PROPOSITIONS, ET UNE SEULE BONNE. Ce n'est pas de la décoration :
   `estPosableSurUneCopie` n'admet que ces questions-là, et l'accueil désactive
   « Commencer » — en affichant « la banque est vide » — dès qu'AUCUN format
   n'est possible. Une banque de laboratoire à deux propositions mettait donc
   l'écran dans cet état, et l'essai rougissait sur l'irréalisme de son propre
   laboratoire plutôt que sur un défaut du site. La banque réelle compte 339
   questions à quatre propositions sur 540 ; celle-ci leur ressemble.
*/
const ORIGINES = [
  { origine: 'A', rubrique: 'Laboratoire — catégorie A' },
  { origine: 'B', rubrique: 'Laboratoire — catégorie B' },
  { origine: 'maison', rubrique: 'Laboratoire — maison' },
];

const banqueDeLaboratoire = ({ origine, rubrique }, ordre) =>
  `rubrique: ${rubrique}\n` +
  `ordre: ${ordre}\n` +
  'questions:\n' +
  [1, 2]
    .map(
      (n) =>
        `  - question: Question ${origine} numéro ${n} ?\n` +
        `    options:\n` +
        `      - Première proposition ${n}\n` +
        `      - Deuxième proposition ${n}\n` +
        `      - Troisième proposition ${n}\n` +
        `      - Quatrième proposition ${n}\n` +
        `    reponse: Première proposition ${n}\n` +
        '    explication: Réponse de laboratoire, sans valeur de révision.\n' +
        `    categorie_origine: ${origine}`,
    )
    .join('\n') +
  '\n';

const corpsDeFiche = (titre) =>
  '## Cours complet\n\n' +
  `${titre} — texte de laboratoire, écrit pour qu'une fiche existe et se rende.\n` +
  'Il ne prétend enseigner rien du tout : les faits du concours ne s’inventent pas,\n' +
  'et un essai n’est pas l’endroit où on les écrirait.\n';

const fichierDeFiche = (f) =>
  '---\n' +
  `matiere: "${f.matiere}"\n` +
  `fascicule: "${f.fascicule}"\n` +
  `titre: "${f.titre}"\n` +
  'ordre: 1\n' +
  'tags: [laboratoire]\n' +
  '---\n\n' +
  corpsDeFiche(f.titre);

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;

function verifier(quoi, ok, detail = '') {
  if (ok) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    rouges += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? `\n      ${detail}` : ''}`);
  }
}

const gardes = [
  ['content', path.join(racine, 'content')],
  ['.env.local', path.join(racine, '.env.local')],
  ['public/data', path.join(racine, 'public', 'data')],
  ['.temoin-mot-de-passe.local.json', path.join(racine, '.temoin-mot-de-passe.local.json')],
];

const occupes = gardes.filter(([, chemin]) => existsSync(chemin)).map(([nom]) => nom);
if (occupes.length) {
  console.log(
    `\n${rouge('✗ REFUS')} — ${occupes.join(', ')} existe déjà.\n` +
      '  Cet essai construit un site de laboratoire avec un mot de passe factice et\n' +
      '  efface tout derrière lui : il ne travaillera pas par-dessus du contenu réel.',
  );
  process.exit(1);
}

const node = (script, env = {}) =>
  execFileSync(process.execPath, [path.join(racine, 'scripts', script)], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

function nettoyer() {
  try {
    execFileSync('npx', ['astro', 'preview', 'stop'], { cwd: racine, stdio: 'ignore' });
  } catch {
    /* aucun aperçu à arrêter */
  }
  for (const [, chemin] of gardes) rmSync(chemin, { recursive: true, force: true });
  rmSync(path.join(racine, 'dist'), { recursive: true, force: true });
}

/** Les identifiants des fiches plantées, par chemin : la séance les porte en clair. */
const idsPlantes = new Map();

let nav = null;

try {
  console.log('\nLA CONSTRUCTION DU LABORATOIRE');
  node('init-contenu.mjs');
  writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);

  for (const f of FICHES) {
    const complet = path.join(racine, 'content', f.chemin);
    mkdirSync(path.dirname(complet), { recursive: true });
    writeFileSync(complet, fichierDeFiche(f));
    idsPlantes.set(f.chemin, await idStable(f.chemin));
  }
  console.log(`  ${FICHES.length} fiche(s) de laboratoire plantées sous quatre racines.`);

  const dossierBanque = path.join(racine, 'content', 'qcm-dgfip');
  mkdirSync(dossierBanque, { recursive: true });
  ORIGINES.forEach((o, i) => {
    writeFileSync(path.join(dossierBanque, `${i}-${o.origine}.yml`), banqueDeLaboratoire(o, i + 1));
  });
  console.log(`  ${ORIGINES.length} rubrique(s) de QCM plantées, une par origine.`);

  const journal = node('build-content.mjs');
  /*
     Le journal du build est LU, et non supposé. Une fiche plantée avec un
     front-matter invalide ou une section non reconnue ne serait pas construite,
     et l'essai mesurerait alors une absence de son propre fait.
  */
  verifier(
    'le build ne signale ni erreur ni avertissement sur les fiches plantées',
    !/avertissement|invalide|non reconnus/i.test(journal),
    journal.split('\n').filter((l) => /avert|invalide|reconnu/i.test(l)).join('\n      '),
  );

  execFileSync('npx', ['astro', 'build'], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, REVINSP_SANS_PODCAST: '1' },
  });
  rmSync(path.join(racine, '.env.local'), { force: true });

  spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: racine,
    detached: true,
    stdio: 'ignore',
  }).unref();
} catch (erreur) {
  console.log(`\n${rouge('✗ PANNE')} — le laboratoire n’a pas pu être construit.`);
  console.log(String(erreur?.message ?? erreur).slice(0, 900));
  nettoyer();
  process.exit(1);
}

try {
  for (let essai = 0; essai < 60; essai++) {
    try {
      if ((await fetch(`${RACINE_WEB}/data/cle.json`)).ok) break;
    } catch {
      /* pas encore debout */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  nav = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });
  const contexte = await nav.newContext({ viewport: { width: 1200, height: 1100 } });
  const page = await contexte.newPage();

  /*
     Les erreurs de page sont collectées et contrôlées à la fin. Une séance qui
     lève sur un parcours sans fiche resterait au bloc de chargement, ce qui
     ressemble à une page lente et non à un défaut.
  */
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 200)));

  const connecter = async () => {
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MOT_DE_PASSE);
      await page.click('#bouton-verrou');
      await page.waitForTimeout(1500);
    }
  };

  await franchirInitialisation(page, RACINE_WEB, MOT_DE_PASSE);

  /**
   * Choisit le parcours courant, puis ouvre un écran.
   *
   * Le parcours vit dans `localStorage` sous `revinsp.parcours` — voir
   * `src/lib/parcours/courant.ts`. On l'écrit avant la navigation, comme le fait
   * `essais:parcours-vides:navigateur` et pour la même raison : passer par le
   * sélecteur ferait dépendre cet essai d'un composant qu'il ne mesure pas.
   *
   * Le sélecteur n'est pas laissé sans garde pour autant :
   * `essais:parcours-validation` le clique — il offre les parcours, le bouton
   * applique, la préférence change et la page se recharge. La répartition est
   * explicite, et non un trou.
   */
  async function allerAvecParcours(idParcours, chemin) {
    await page.goto(`${RACINE_WEB}/robots.txt`, { waitUntil: 'load' });
    await page.evaluate((id) => localStorage.setItem('revinsp.parcours', id), idParcours);
    await page.goto(`${RACINE_WEB}${chemin}`, { waitUntil: 'networkidle' });
    await connecter();
  }

  /** Ce que la planification d'un parcours affiche de ses thèmes. */
  async function themesDuParcours(idParcours) {
    await allerAvecParcours(idParcours, '/planification/');
    await page.waitForFunction(
      () => document.getElementById('chargement')?.classList.contains('hidden') === true,
      undefined,
      { timeout: 40000 },
    );
    await page.waitForTimeout(600);
    return {
      calendrier: await page.locator('#planification').isVisible(),
      indisponible: await page.locator('#sans-referentiel').isVisible(),
      rotation: (await page.locator('#grille-rotation').textContent().catch(() => '')) ?? '',
    };
  }

  /** Les fiches qu'une séance propose, par identifiant. */
  async function fichesDeLaSeance(idParcours, jour) {
    await allerAvecParcours(idParcours, `/planification/seance/?jour=${jour}`);
    await page.waitForSelector('#seance:not(.hidden)', { timeout: 40000 });
    await page.waitForTimeout(800);
    return {
      ids: await page.$$eval('[data-fiche]', (c) => c.map((e) => e.dataset.fiche ?? '')),
      texte: (await page.locator('#fiches').textContent().catch(() => '')) ?? '',
      titre: (await page.locator('#titre').textContent().catch(() => '')) ?? '',
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
     1. LA PRÉMISSE : les fiches plantées sont bien dans le site
     ══════════════════════════════════════════════════════════════════════ */

  console.log('\nLA PRÉMISSE — LES FICHES PLANTÉES SONT SERVIES');

  /*
     Sans ce contrôle, tout ce qui suit pourrait être vert parce que RIEN n'a
     été construit : une séance vide ne propose aucune fiche d'un autre
     parcours, et la plus sévère des assertions suivantes passerait alors pour
     une réussite.

     LA PRÉMISSE SE PREND DEPUIS UN PARCOURS QUI SERT LA MATIÈRE, et c'est un
     changement apporté à l'intégration, avec l'accord du pilote.

     Elle se prenait depuis l'INSP. C'était juste quand cet essai a été écrit :
     rien ne filtrait alors le manifeste, et la bibliothèque de l'INSP montrait
     tout. « b-code » a depuis posé « filtre-du-manifeste.ts » dans
     « chargerManifeste », et il retire précisément cela — son objet déclaré
     est que « les fiches d'Organisation de la DGFiP […] apparaissaient aussi
     dans l'arbre de l'INSP, QUI NE LES SERT PAS ».

     La prémisse regardait donc, depuis le seul parcours à qui cette matière
     n'est pas servie, si elle était servie. Elle garde exactement son office
     en se prenant depuis « dgfip-a », qui la sert : vérifier que les fiches
     plantées sont bien dans le site avant de mesurer quoi que ce soit.

     Que l'INSP ne la voie PAS est mesuré plus bas, par le témoin à l'envers.
  */
  {
    await allerAvecParcours('dgfip-a', '/bibliotheque/');
    await page.waitForTimeout(2500);
    const texte = (await page.locator('body').textContent()) ?? '';
    verifier(
      'la bibliothèque nomme la matière partagée de B et A',
      texte.includes(MATIERE_PARTAGEE_B_ET_A),
      `${texte.length} caractères servis`,
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     3. LA SÉANCE SERT LE PARCOURS ET SA RACINE COMMUNE
     ══════════════════════════════════════════════════════════════════════ */

  /* ── 2. Chaque parcours ouvre son calendrier et nomme ses thèmes ────── */

  console.log('\nLES THÈMES — CHAQUE PARCOURS NOMME LES SIENS, ET PAS CEUX D’UN AUTRE');

  /*
     `essais:parcours-vides:navigateur` garde déjà cette étape SANS contenu, et
     c'est là qu'elle se mesure le mieux. Ce qui s'ajoute ici est qu'elle tienne
     une fois le contenu arrivé : une grille de rotation qui se peindrait depuis
     le manifeste plutôt que depuis le registre changerait de thèmes le jour où
     une fiche apparaît, et aucun essai ne l'aurait vu.

     Les noms attendus sont les noms LONGS du registre : les menus de la grille
     portent `t.nom`, et non `t.court`, qui ne sert qu'aux cases du planning.
     J'avais écrit les courts, et c'est en relisant la fabrication des options
     que l'erreur s'est vue — avant de faire rougir le code pour une attente
     fausse.
  */
  for (const [idParcours, attendus] of [
    ['dgfip-b', ['Environnement et organisation de la DGFiP', 'Français', 'Mathématiques']],
    ['dgfip-a', ['Environnement et organisation de la DGFiP', 'Anglais', 'Union européenne']],
    ['dgfip-ap', ['Épreuve professionnelle', 'Entretien avec le jury', 'Analyse financière']],
  ]) {
    const e = await themesDuParcours(idParcours);
    verifier(
      `${idParcours} : le calendrier s’ouvre`,
      e.calendrier && !e.indisponible,
      JSON.stringify(e).slice(0, 200),
    );
    verifier(
      `${idParcours} : et sa grille nomme ses thèmes`,
      attendus.every((t) => e.rotation.includes(t)),
      `manquant(s) : ${attendus.filter((t) => !e.rotation.includes(t)).join(', ')}`,
    );
  }

  /*
     Le témoin à l'envers : les thèmes de l'INSP ne doivent PAS apparaître chez
     un parcours DGFiP. Sans lui, une grille qui offrirait tous les thèmes de
     tous les parcours passerait les trois contrôles ci-dessus.
  */
  {
    const grille = (await themesDuParcours('dgfip-b')).rotation;
    verifier(
      'et aucun thème de l’INSP ne s’est glissé chez DGFiP B',
      !/Questions européennes|Résolution de cas pratique|Questions sociales/.test(grille),
      grille.replace(/\s+/g, ' ').trim().slice(0, 200),
    );
  }

  console.log('\nDGFiP B, UN SAMEDI — SA FICHE ET CELLE DE « commun/ »');

  /*
     LE PRÉDICAT EST NOMMÉ, ET IL EST PARTAGÉ AVEC SON SABOTAGE.

     Ma première écriture recopiait la condition dans le contrôle de sabotage.
     C'était une tautologie : affaiblir l'assertion réelle n'aurait pas fait
     rougir sa copie, et le sabotage n'aurait rien gardé. C'est le défaut que
     j'ai relevé deux fois ailleurs aujourd'hui, et je venais de l'écrire.

     Une seule fonction, employée par l'assertion et par son sabotage : on ne
     peut plus affaiblir l'une sans que l'autre le dise.
  */
  const sansRacineVoisine = (ids) => !ids.includes(idA) && !ids.includes(idB);

  const idB = idsPlantes.get('dgfip-b/environnement/fiche-01-reseau.md');
  const idA = idsPlantes.get('dgfip-a/environnement/fiche-01-reseau.md');
  const idCommunOrga = idsPlantes.get('commun/fiche-01-organisation-partagee.md');
  const idAp = idsPlantes.get('dgfip-ap/metier/fiche-01-ressources.md');
  const idCommunRh = idsPlantes.get('commun/fiche-02-ressources-partagee.md');

  {
    const s = await fichesDeLaSeance('dgfip-b', SAMEDI);
    verifier('la séance s’ouvre et nomme son thème', /organisation|environnement/i.test(s.titre), s.titre);
    verifier('elle propose la fiche de DGFiP B', s.ids.includes(idB), s.ids.join(' '));
    verifier('et la fiche de « commun/ »', s.ids.includes(idCommunOrga), s.ids.join(' '));
    verifier(
      'et PAS la fiche de DGFiP A, qui porte la même matière',
      !s.ids.includes(idA),
      'la même matière est déclarée par les deux parcours : sans filtre par ' +
        'parcours servi, le corpus entier est proposé à tout le monde',
    );
  }

  console.log('\nDGFiP A, LE MÊME SAMEDI — L’AUTRE CÔTÉ DU MIROIR');

  {
    const s = await fichesDeLaSeance('dgfip-a', SAMEDI);
    verifier('elle propose la fiche de DGFiP A', s.ids.includes(idA), s.ids.join(' '));
    verifier('et la fiche de « commun/ »', s.ids.includes(idCommunOrga), s.ids.join(' '));
    verifier('et PAS la fiche de DGFiP B', !s.ids.includes(idB), s.ids.join(' '));
  }

  console.log('\nDGFiP A+, UN DIMANCHE — SON ÉPREUVE PROFESSIONNELLE');

  {
    const s = await fichesDeLaSeance('dgfip-ap', DIMANCHE);
    verifier('la séance s’ouvre', s.titre.trim().length > 0, s.titre);
    verifier('elle propose la fiche de DGFiP A+', s.ids.includes(idAp), s.ids.join(' '));
    verifier('et la fiche de « commun/ »', s.ids.includes(idCommunRh), s.ids.join(' '));
    /*
       « LES AUTRES PARCOURS » NE COMPREND PAS « commun/ », ET C'EST UN
       ARBITRAGE DU PILOTE, APPORTÉ À L'INTÉGRATION.

       Cette assertion écartait aussi « idCommunOrga », la fiche
       d'organisation rangée sous « commun/ ». Le 25 octobre, la matière
       « Organisation de la DGFiP » a été rattachée au thème « option-metier »
       de A+, parce que l'arrêté nomme l'organisation de la DGFiP dans
       l'option — et « commun/ » est servie aux TROIS parcours DGFiP, A+
       compris. Cette fiche a donc sa place dans la séance du dimanche.

       Ce qui reste interdit est ce que le nom dit : une fiche rangée sous la
       RACINE d'un autre parcours, « dgfip-b/ » ou « dgfip-a/ ». Une fiche de
       « commun/ » reste admise quand sa matière appartient au thème du jour.

       Le rouge d'origine n'était d'ailleurs pas un ajout. Le filtre de
       « b-code » ne peut qu'ENLEVER — vérifié ligne à ligne. Le vivier de A+
       a rétréci, et cette fiche est remontée dans les places laissées libres.
    */
    verifier(
      'et aucune fiche des racines des autres parcours',
      sansRacineVoisine(s.ids),
      s.ids.join(' '),
    );

    /*
       LE CONTRÔLE POSITIF, demandé avec l'arbitrage. Sans lui, l'assertion
       ci-dessus serait tenue par une séance VIDE : « aucune fiche des autres
       parcours » est vrai de rien du tout. Il dit l'inverse de la même règle —
       la fiche commune EST proposée, puisque sa matière est au programme du
       jour.
    */
    verifier(
      'et la fiche commune d’organisation EST proposée, son thème étant du jour',
      s.ids.includes(idCommunOrga),
      s.ids.join(' '),
    );
  }

  /*
     LE SABOTAGE, demandé avec l'arbitrage, et il est permanent.

     Les deux contrôles ci-dessus se lisent l'un l'autre : l'un interdit les
     racines voisines, l'autre exige la commune. Reste à montrer que le
     premier SAIT dire non. On lui présente donc une séance où une fiche de
     « dgfip-a/ » s'est glissée, et l'on vérifie qu'il la refuse.

     Sur la liste des identifiants réellement servis, et non sur une liste
     inventée : c'est la séance mesurée juste au-dessus, à laquelle on ajoute
     l'intrus.
  */
  {
    const s = await fichesDeLaSeance('dgfip-ap', DIMANCHE);
    verifier(
      'sabotage : une fiche de « dgfip-a/ » dans la séance de A+ serait refusée',
      !sansRacineVoisine([...s.ids, idA]),
      [...s.ids, idA].join(' '),
    );
    verifier(
      'sabotage : une fiche de « dgfip-b/ » aussi',
      !sansRacineVoisine([...s.ids, idB]),
      [...s.ids, idB].join(' '),
    );
  }

  console.log('\nL’INSP, LE TÉMOIN — AUCUNE FICHE DGFiP NE LUI ARRIVE');

  /*
     Le témoin à l'envers, et il est indispensable. Les trois contrôles ci-dessus
     passeraient tous si la séance ne proposait jamais rien ; celui-ci passe
     seulement si le filtre distingue, puisque l'INSP a du contenu réel.
  */
  {
    const s = await fichesDeLaSeance('insp', SAMEDI);
    const dgfip = [idB, idA, idCommunOrga, idAp, idCommunRh];
    verifier(
      'la séance de l’INSP ne porte aucune fiche DGFiP',
      dgfip.every((id) => !s.ids.includes(id)),
      s.ids.join(' '),
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     4. L'ÉPREUVE BLANCHE N'OFFRE QUE CE QUE LE PARCOURS PEUT TIRER
     ══════════════════════════════════════════════════════════════════════ */

  console.log('\nL’ÉPREUVE BLANCHE — ELLE N’OFFRE QUE CE QUI SE TIRE');

  /*
     L'accueil annonçait les totaux ÉCRITS PAR LE BUILD, qui comptent toutes les
     questions d'une rubrique sans regarder leur origine. DGFiP B se voyait donc
     promettre des questions qu'il ne tirera jamais — et une rubrique
     entièrement de catégorie A lui était présentée comme si elle était la
     sienne. Ce qui se mesure ici est que l'écran dise la même chose que la
     règle de tirage.
  */
  async function rubriquesOffertes(idParcours) {
    await allerAvecParcours(idParcours, '/quiz/dgfip/');
    await page.waitForFunction(
      () => document.getElementById('chargement')?.classList.contains('hidden') === true,
      undefined,
      { timeout: 40000 },
    );
    await page.waitForTimeout(800);
    return {
      vide: await page.locator('#dgfip-vide').isVisible(),
      rubriques: (await page.locator('#rubriques-dgfip').textContent().catch(() => '')) ?? '',
      lancerActif: await page
        .locator('#lancer-dgfip')
        .isEnabled()
        .catch(() => false),
    };
  }

  {
    const e = await rubriquesOffertes('dgfip-b');
    verifier('DGFiP B : la banque plantée est bien servie', !e.vide && e.lancerActif, JSON.stringify(e));
    verifier('et la rubrique de catégorie B lui est offerte', e.rubriques.includes('catégorie B'));
    verifier('et celle de la maison aussi', e.rubriques.includes('maison'));
    verifier(
      'mais PAS celle de catégorie A, qu’il ne peut pas tirer',
      !e.rubriques.includes('catégorie A'),
      e.rubriques.replace(/\s+/g, ' ').trim(),
    );
  }

  for (const id of ['dgfip-a', 'dgfip-ap']) {
    const e = await rubriquesOffertes(id);
    verifier(
      `${id} : les trois rubriques lui sont offertes — il révise aussi vers le bas`,
      ['catégorie A', 'catégorie B', 'maison'].every((r) => e.rubriques.includes(r)),
      e.rubriques.replace(/\s+/g, ' ').trim(),
    );
  }

  verifier('aucune erreur de page sur tout le parcours', erreurs.length === 0, erreurs.join(' | '));
} catch (erreur) {
  rouges += 1;
  console.log(`\n${rouge('✗ PANNE')} — ${String(erreur?.message ?? erreur).slice(0, 900)}`);
} finally {
  if (nav) await nav.close().catch(() => {});
  nettoyer();
}

console.log(
  rouges === 0
    ? `\n${vert('Les trois parcours DGFiP se planifient de bout en bout.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
