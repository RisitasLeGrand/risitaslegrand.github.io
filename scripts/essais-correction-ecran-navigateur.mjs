/**
 * La correction détaillée À L'ÉCRAN, sur les trois surfaces qui l'affichent.
 *
 * ## Pourquoi un essai de navigateur, alors que le composant est déjà éprouvé
 *
 * `essais:corrections` éprouve le bloc « correction » — sa cohérence avec la
 * clef, ses visuels, ses alternatives textuelles. Il ne dit rien de ce qui
 * ARRIVE À L'ÉCRAN, et la différence n'est pas théorique : le composant recevait
 * bien « rappel_de_cours », mais la page du QCM DGFiP ne lui passait pas
 * « lienFiche ». Le rappel de cours s'affichait donc en texte mort sur la
 * banque et sur l'épreuve blanche, alors qu'il est un lien sur le quiz de
 * cours. Aucun essai de schéma ne pouvait voir cela : les données étaient
 * justes, c'est le branchement qui manquait.
 *
 * ## Les trois surfaces, et pourquoi ce sont bien trois
 *
 * Le quiz de fiche, d'abord, où la correction s'ouvre après validation. Puis
 * les deux présentations du QCM DGFiP, qui ne sont pas la même chose pour la
 * personne : « une question à la fois » corrige sur l'écran de résultats,
 * « copie de concours » corrige sur la copie rendue. Elles partagent la page
 * mais pas le chemin, et c'est un chemin qui peut casser.
 *
 * ## Le décor est tiré au sort, donc le décor ne doit pas dépendre du tirage
 *
 * Une épreuve tire ses questions au hasard. Un essai qui espérerait tomber sur
 * la seule question portant un rappel de cours serait vert ou rouge selon le
 * tirage — c'est-à-dire inutile. Les quatre questions de la banque de
 * laboratoire portent donc TOUTES les six choses à vérifier, et l'essai est
 * déterministe quoi qu'il tire.
 *
 * La confiance est la seule qui demande deux cas, puisqu'il faut éprouver le
 * bandeau présent ET absent : la banque DGFiP est en « moyenne », la question
 * de fiche en « haute ».
 *
 * ## Le laboratoire
 *
 * Comme les sept autres essais de laboratoire : un « content/ » bâti depuis
 * « content-exemple/ », un mot de passe FACTICE, un aperçu sur le port 4322, et
 * tout est effacé à la fin. Il REFUSE de démarrer si « content/ » existe — il
 * ne travaillera pas par-dessus du contenu réel. Sous la batterie, il tourne
 * dans un arbre de travail séparé, qui n'en porte aucun.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { repondreALaBoite } from './lib/boite-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOT_DE_PASSE = 'laboratoire-correction-ecran-sans-valeur';
const PORT = 4322;
const ADRESSE = `http://localhost:${PORT}`;

/* La fiche d'exemple vers laquelle pointe le rappel de cours. Son chemin doit
   exister, sans quoi la construction refuse — ce qui est voulu : un rappel qui
   ne mène nulle part est une impasse pour la personne. */
const FICHE = 'droit-public/fascicule-1/fiche-01-hierarchie-des-normes';
const TITRE_ATTENDU = 'À relire';

/* Les textes que l'essai cherche à l'écran. Ils sont dans le décor, donc on
   sait qu'ils ne peuvent venir d'ailleurs. */
const RESUME_DGFIP = 'Resume de laboratoire, premiere proposition.';
const LEGENDE_DGFIP = 'Legende de laboratoire du tableau.';
const SOURCE_LIEE = 'Source de laboratoire avec adresse';
const SOURCE_SIMPLE = 'Source de laboratoire sans adresse';
const RESUME_FICHE = 'Resume de laboratoire de la question de fiche.';
const LEGENDE_FICHE = 'Legende de laboratoire de la fiche.';

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const gras = (t) => `\x1b[1m${t}\x1b[0m`;

/*
   Les ▣ « possible » rencontrés, toutes surfaces confondues.
   L'option défendable peut être celle que l'essai a cochée, et elle porte
   alors « votre réponse » : exiger un ▣ sur chaque surface rendrait l'essai
   dépendant de l'ordre d'affichage. On exige donc qu'il s'en soit montré au
   moins un au total — faute de quoi le contrôle de teinte ne prouverait rien.
*/
const possiblesVus = [];

function verifier(quoi, vrai, detail = '') {
  if (vrai) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    rouges += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? ` — ${detail}` : ''}`);
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
      '  Cet essai bâtit un site de laboratoire avec un mot de passe factice et\n' +
      '  efface tout derrière lui : il ne travaillera pas par-dessus du contenu réel.',
  );
  process.exit(1);
}

/* ── La banque de laboratoire ────────────────────────────────────────────── */

/*
   Quatre questions à trois options, toutes corrigées de la même façon : le
   tirage peut prendre n'importe laquelle, l'essai verra les mêmes six choses.
   Les énoncés sont inventés et sans valeur de révision — c'est un décor.
*/
const correctionDgfip = (n) => `    correction:
      resume: ${RESUME_DGFIP}
      par_option:
        - verdict: juste
          pourquoi: la premiere proposition est celle que la clef retient
        - verdict: faux
          pourquoi: la deuxieme proposition ne convient pas, et voici pourquoi
          marqueur: possible
        - verdict: faux
          pourquoi: la troisieme proposition ne convient pas davantage
        - verdict: faux
          pourquoi: la quatrieme proposition ne convient pas non plus
      detail: Developpement de laboratoire de la question numero ${n}, sans valeur de revision.
      rappel_de_cours:
        - ${FICHE}
      sources:
        - nom: ${SOURCE_LIEE}
          url: https://example.invalid/laboratoire
        - nom: ${SOURCE_SIMPLE}
      confiance: moyenne
      visuel:
        type: tableau
        donnees:
          entetes:
            - Proposition
            - Ce qu elle vaut
          lignes:
            - - Premiere
              - Retenue par la clef
            - - Deuxieme
              - Ecartee
          marques:
            - ligne: 0
              colonne: 1
              marqueur: bonne-reponse
            - ligne: 1
              colonne: 1
              marqueur: exclu
        legende: ${LEGENDE_DGFIP}
        alt: Tableau de laboratoire a deux colonnes, proposition et ce qu elle vaut.`;

const BANQUE = `rubrique: Laboratoire
ordre: 1
questions:
${Array.from({ length: 12 }, (_, i) => i + 1)
  .map(
    (n) => `  - question: Question de laboratoire numero ${n} ?
    options:
      - Premiere proposition ${n}
      - Deuxieme proposition ${n}
      - Troisieme proposition ${n}
      - Quatrieme proposition ${n}
    reponse: Premiere proposition ${n}
    explication: Reponse de laboratoire, sans valeur de revision.
    categorie_origine: maison
    incertain: "Question de laboratoire : la reserve est la pour eprouver son affichage."
${correctionDgfip(n)}`,
  )
  .join('\n')}
`;

/*
   LA QUESTION DE FICHE, et pourquoi elle est injectée ici plutôt que déposée
   dans « content-exemple/ ».

   Le contenu d'exemple sert à huit essais et à l'amorçage d'un conteneur neuf.
   Y ajouter une correction de décor la ferait apparaître à quiconque initialise
   le projet, et la ferait compter dans les rapports de couverture des autres
   essais. L'essai qui a besoin du décor se le fabrique : c'est la règle que
   suivent déjà les sept autres essais de laboratoire.

   Sa confiance est HAUTE, à l'inverse de la banque : c'est le seul moyen
   d'éprouver que le bandeau « confiance moyenne » s'affiche quand il le faut
   ET se taît quand il ne le faut pas.
*/
function injecterLaCorrectionDeFiche() {
  const chemin = path.join(racine, 'content', `${FICHE}.md`);
  const avant = readFileSync(chemin, 'utf8');
  const ancre = '  explication: "La révision constitutionnelle du 29 octobre 1974 a ouvert la saisine à soixante parlementaires."';
  if (!avant.includes(ancre)) {
    throw new Error(
      `l'ancre de la question de fiche n'a pas été trouvée dans ${FICHE}.md — ` +
        "le contenu d'exemple a changé, et le décor de cet essai doit suivre",
    );
  }
  const correction = `${ancre}
  correction:
    resume: ${RESUME_FICHE}
    par_option:
      - verdict: faux
        pourquoi: 1958 est l annee de la Constitution, non celle de la reforme
        marqueur: possible
      - verdict: faux
        pourquoi: 1971 est la decision Liberte d association
      - verdict: juste
        pourquoi: la revision du 29 octobre 1974 ouvre la saisine a soixante parlementaires
      - verdict: faux
        pourquoi: 2008 introduit la question prioritaire de constitutionnalite
    detail: Developpement de laboratoire de la question de fiche, sans valeur de revision.
    rappel_de_cours:
      - ${FICHE}
    sources:
      - nom: ${SOURCE_LIEE}
        url: https://example.invalid/laboratoire
      - nom: ${SOURCE_SIMPLE}
    confiance: haute
    visuel:
      type: tableau
      donnees:
        entetes:
          - Annee
          - Ce qu elle apporte
        lignes:
          - - "1974"
            - La saisine par soixante parlementaires
          - - "2008"
            - La question prioritaire de constitutionnalite
        marques:
          - ligne: 0
            colonne: 1
            marqueur: bonne-reponse
          - ligne: 1
            colonne: 1
            marqueur: exclu
      legende: ${LEGENDE_FICHE}
      alt: Tableau de laboratoire a deux colonnes, annee et ce qu elle apporte.`;
  writeFileSync(chemin, avant.replace(ancre, correction));
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

let nav = null;

try {
  console.log('\nLA CONSTRUCTION DU LABORATOIRE');
  node('init-contenu.mjs');
  mkdirSync(path.join(racine, 'content', 'qcm-dgfip'), { recursive: true });
  writeFileSync(path.join(racine, 'content', 'qcm-dgfip', 'laboratoire.yml'), BANQUE);
  injecterLaCorrectionDeFiche();
  writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);
  node('build-content.mjs');
  execFileSync('npx', ['astro', 'build'], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, REVINSP_SANS_PODCAST: '1' },
  });
  /* Le mot de passe ne survit pas à la construction. */
  rmSync(path.join(racine, '.env.local'), { force: true });

  spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: racine,
    detached: true,
    stdio: 'ignore',
  }).unref();

  /*
     ON ATTEND QUE L'APERÇU RÉPONDE, et ce n'est pas une précaution de style.

     Les autres essais de laboratoire enchaînent sur le navigateur sans
     attendre, et passent parce qu'il se trouve que le temps de lancement de
     Chromium suffit. C'est une course gagnée par habitude : ici, la première
     visite tombait sur un « connection refused ». Mieux vaut interroger
     l'aperçu jusqu'à ce qu'il serve, et dire au bout de combien de temps on
     renonce.
  */
  let sert = false;
  for (let i = 0; i < 60 && !sert; i += 1) {
    sert = await fetch(`${ADRESSE}/robots.txt`, { signal: AbortSignal.timeout(2000) })
      .then((r) => r.ok)
      .catch(() => false);
    if (!sert) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!sert) throw new Error(`l’aperçu n’a pas répondu sur ${ADRESSE} après une minute`);
} catch (erreur) {
  console.log(`\n${rouge('✗ PANNE')} — le laboratoire n’a pas pu être construit.`);
  console.log(String(erreur?.message ?? erreur).slice(0, 900));
  nettoyer();
  process.exit(1);
}

/* ── Les contrôles ───────────────────────────────────────────────────────── */

/**
 * Les six choses, sur une section de correction déjà ouverte.
 *
 * Le contrôle du rappel de cours porte sur un LIEN, et c'est le défaut que cet
 * essai est né pour attraper : du texte au bon endroit ne suffit pas.
 */
async function verifierLesSixChoses(section, ou, { resume, legende, confianceMoyenne, options }) {
  verifier(`${ou} · le résumé s'affiche`, (await section.locator('p').first().innerText()).includes(resume));

  /*
     On vise la liste des verdicts PAR SON NOM, et non « la première liste de la
     section ». Le visuel rend sa propre légende en liste — un élément par
     marqueur employé — et un sélecteur large comptait donc six lignes pour
     quatre options : quatre verdicts et deux entrées de légende. Le nom lève
     l'ambiguïté, pour l'essai comme pour un lecteur d'écran.
  */
  const lignes = section.locator('ul[aria-label="Verdict par option"] > li');
  const combien = await lignes.count();
  verifier(
    `${ou} · une ligne par option (${options})`,
    combien === options,
    combien === options ? '' : `${combien} ligne(s) trouvée(s) — ${(await section.innerHTML()).slice(0, 400)}`,
  );
  const premiere = await lignes.first().innerText();
  verifier(`${ou} · chaque ligne porte son pourquoi`, /ne convient pas|clef|annee|revision|Constitution/i.test(premiere), premiere.slice(0, 70));

  const rappel = section.locator('a[href*="fiche?id="]');
  verifier(`${ou} · le rappel de cours est un LIEN`, (await rappel.count()) >= 1);
  verifier(`${ou} · le rappel est annoncé par « À relire »`, (await section.innerText()).includes(TITRE_ATTENDU));

  const texte = await section.innerText();
  verifier(`${ou} · la source sans adresse est citée`, texte.includes(SOURCE_SIMPLE));
  verifier(
    `${ou} · la source avec adresse est un lien`,
    (await section.locator('a[href="https://example.invalid/laboratoire"]').count()) >= 1,
  );

  const bandeau = texte.includes('Confiance moyenne');
  verifier(
    `${ou} · le bandeau de confiance ${confianceMoyenne ? 'est présent' : 'reste absent'}`,
    bandeau === confianceMoyenne,
  );

  verifier(`${ou} · le visuel est rendu (légende)`, texte.includes(legende));
  verifier(`${ou} · le visuel est un tableau`, (await section.locator('table').count()) >= 1);

  /*
     « possible » ne doit JAMAIS porter le vert du succès sur une option fausse.
     Le vocabulaire partagé lui donne « --etat-succes », et c'est juste dans
     Cog-Training où rien n'est « la » réponse ; ici, quelques lignes sous le ✓
     vert de la bonne réponse, le même vert se lirait « correcte aussi ».

     On lit donc la couleur CALCULÉE, et non la classe : c'est la seule qui dise
     ce que l'œil reçoit. Les jetons sont résolus par une sonde, pour comparer
     des « rgb(...) » entre eux plutôt qu'un nom de variable à une couleur.
  */
  const teintes = await section.evaluate((el) => {
    const resoudre = (jeton) => {
      const sonde = document.createElement('span');
      sonde.style.color = `var(${jeton})`;
      el.appendChild(sonde);
      const c = getComputedStyle(sonde).color;
      sonde.remove();
      return c;
    };
    const glyphes = [...el.querySelectorAll('ul[aria-label="Verdict par option"] > li')]
      .map((li) => {
        const g = li.querySelector('span[aria-hidden="true"]');
        return g ? { glyphe: g.textContent.trim(), couleur: getComputedStyle(g).color } : null;
      })
      .filter(Boolean);
    return { glyphes, succes: resoudre('--etat-succes'), alerte: resoudre('--etat-alerte') };
  });

  /*
     L'invariant est posé sur TOUS les glyphes, et non sur le ▣ seul, parce que
     la ligne du ▣ n'est pas prévisible : les trois surfaces cliquent la
     première option affichée, l'écran peut en changer l'ordre, et quand la
     personne a justement coché l'option défendable, celle-ci porte « votre
     réponse » (◆) — ce qui est le comportement voulu, la réponse donnée primant
     sur ce que le contenu dit de l'option.

     Formulé ainsi, le contrôle ne dépend d'aucun ordre : seul le ✓ de la bonne
     réponse a droit au vert du succès. Tout autre glyphe qui le porterait
     dirait « correcte aussi » d'une option fausse.
  */
  const usurpateurs = teintes.glyphes.filter(
    (g) => g.glyphe !== '✓' && g.couleur === teintes.succes,
  );
  verifier(
    `${ou} · aucun glyphe sauf le ✓ ne porte le vert du succès`,
    usurpateurs.length === 0,
    usurpateurs.map((g) => `${g.glyphe} ${g.couleur}`).join(' · '),
  );
  const bonne = teintes.glyphes.find((g) => g.glyphe === '✓');
  /* Le témoin : sans lui, une liste où RIEN ne serait vert passerait le
     contrôle ci-dessus sans rien prouver. */
  verifier(
    `${ou} · et le ✓ de la bonne réponse, lui, garde bien ce vert`,
    bonne !== undefined && bonne.couleur === teintes.succes,
    bonne ? `✓ ${bonne.couleur} · succès ${teintes.succes}` : 'aucun ✓ dans la liste',
  );
  /* Quand le ▣ est là, sa teinte est vérifiée. Qu'il apparaisse au moins une
     fois sur l'ensemble du parcours est contrôlé à la fin : une assertion par
     surface passerait à vide sur celles où l'option défendable a été cochée. */
  for (const g of teintes.glyphes.filter((x) => x.glyphe === '▣')) {
    possiblesVus.push(`${ou} (${g.couleur})`);
    verifier(
      `${ou} · le ▣ « possible » porte le jeton d’alerte`,
      g.couleur === teintes.alerte,
      `▣ ${g.couleur} · alerte ${teintes.alerte}`,
    );
  }
}

/** Un onglet déverrouillé sur l'écran demandé. */
async function ouvrir(chemin, attendu) {
  const contexte = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await contexte.newPage();
  await franchirInitialisation(page, ADRESSE, MOT_DE_PASSE);
  await page.goto(`${ADRESSE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MOT_DE_PASSE);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(800);
  }
  if (attendu) await page.waitForSelector(attendu, { timeout: 60000 });
  return { contexte, page };
}

const SECTION = 'section[aria-label="Correction détaillée"]';

try {
  nav = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });

  /* ── 1. Le quiz de fiche ───────────────────────────────────────────────── */
  console.log(`\n${gras('1. LE QUIZ DE FICHE')}\n`);
  {
    const { contexte, page } = await ouvrir('/quiz/cours/', '#lancer-quiz');
    /* On laisse « Toutes » : la liste des matières est remplie au chargement
       depuis les fiches servies, et le laboratoire n'en porte que trois. Tirer
       vingt questions sur neuf disponibles les prend toutes, décor compris. */
    await page.selectOption('#quiz-taille', '20');
    await page.click('#lancer-quiz');
    await page.waitForSelector('#jeu:not(.hidden)', { timeout: 120000 });

    /* On répond jusqu'à tomber sur la question qui porte le décor. Vingt
       questions au plus : la fiche d'exemple en compte moins. */
    let ouverte = false;
    for (let i = 0; i < 20 && !ouverte; i += 1) {
      const options = page.locator('#quiz-options button');
      if ((await options.count()) === 0) break;
      await options.first().click();
      await page.waitForTimeout(250);
      const bouton = page.locator('button', { hasText: /^Correction détaillée$/ });
      if ((await bouton.count()) > 0) {
        await bouton.first().click();
        await page.waitForSelector(SECTION, { timeout: 20000 });
        const section = page.locator(SECTION).first();
        if ((await section.innerText()).includes(RESUME_FICHE)) {
          ouverte = true;
          await verifierLesSixChoses(section, 'quiz de fiche', {
            resume: RESUME_FICHE,
            legende: LEGENDE_FICHE,
            confianceMoyenne: false,
            options: 4,
          });
          break;
        }
      }
      const suivant = page.locator('#quiz-suivant');
      if ((await suivant.count()) === 0) break;
      await suivant.first().click();
      await page.waitForTimeout(250);
    }
    verifier('quiz de fiche · la correction de décor a bien été atteinte', ouverte);
    await contexte.close();
  }

  /* ── 2. La banque DGFiP, « une question à la fois » ────────────────────── */
  console.log(`\n${gras('2. LA BANQUE DGFIP — UNE QUESTION À LA FOIS')}\n`);
  {
    const { contexte, page } = await ouvrir('/quiz/dgfip/', '#lancer-dgfip');
    await page.selectOption('#presentation-dgfip', 'une-a-la-fois');
    const formats = await page.locator('#format-dgfip option').count();
    verifier('la banque de laboratoire propose au moins un format', formats >= 1);
    await page.selectOption('#format-dgfip', { index: 0 });
    await page.click('#lancer-dgfip');
    await page.waitForSelector('#options-dgfip button', { timeout: 60000 });

    /* On répond à tout, jusqu'à l'écran de résultats. */
    for (let i = 0; i < 60; i += 1) {
      const options = page.locator('#options-dgfip button');
      if ((await options.count()) === 0) break;
      await options.first().click();
      await page.waitForTimeout(120);
      const suivant = page.locator('#suivant-dgfip');
      const libelle = await suivant.innerText().catch(() => '');
      await suivant.click();
      await page.waitForTimeout(200);
      if (/Terminer/i.test(libelle)) break;
    }
    await page.waitForSelector('#resultat-dgfip:not(.hidden)', { timeout: 60000 });

    const bouton = page.locator('button', { hasText: /^Correction détaillée$/ }).first();
    verifier('l’écran de résultats propose la correction détaillée', (await bouton.count()) > 0);
    await bouton.click();
    await page.waitForSelector(SECTION, { timeout: 20000 });
    await verifierLesSixChoses(page.locator(SECTION).first(), 'banque DGFiP', {
      resume: RESUME_DGFIP,
      legende: LEGENDE_DGFIP,
      confianceMoyenne: true,
      options: 4,
    });
    await contexte.close();
  }

  /* ── 3. L'épreuve blanche, sur copie de concours ───────────────────────── */
  console.log(`\n${gras('3. L’ÉPREUVE BLANCHE — COPIE DE CONCOURS')}\n`);
  {
    const { contexte, page } = await ouvrir('/quiz/dgfip/', '#lancer-dgfip');
    await page.selectOption('#presentation-dgfip', 'copie');
    await page.selectOption('#format-dgfip', { index: 0 });
    await page.click('#lancer-dgfip');
    await page.waitForSelector('#copie:not(.hidden)', { timeout: 60000 });

    /*
       La copie est rendue SANS être remplie, et c'est volontaire : une feuille
       remise avec des cases vides est le cas réel du jour de l'épreuve, et
       c'est aussi le chemin où la correction n'a aucune réponse à mettre en
       premier. Le composant doit tenir les deux.
    */
    await page.click('#rendre-copie');
    await repondreALaBoite(page, 'Rendre la copie');
    await page.waitForSelector('#panneaux-copie:not(.hidden)', { timeout: 60000 });

    const bouton = page.locator('button', { hasText: /^Correction détaillée$/ }).first();
    verifier('la copie rendue propose la correction détaillée', (await bouton.count()) > 0);
    await bouton.click();
    await page.waitForSelector(SECTION, { timeout: 20000 });
    await verifierLesSixChoses(page.locator(SECTION).first(), 'épreuve blanche', {
      resume: RESUME_DGFIP,
      legende: LEGENDE_DGFIP,
      confianceMoyenne: true,
      options: 4,
    });
    await contexte.close();
  }
} catch (erreur) {
  rouges += 1;
  console.log(`\n${rouge('✗ PANNE')} — ${String(erreur?.message ?? erreur).slice(0, 900)}`);
} finally {
  if (nav) await nav.close().catch(() => {});
  nettoyer();
}

/*
   Le ▣ doit s'être montré quelque part. Sans cette ligne, le contrôle de teinte
   serait vacueux le jour où le marqueur cesserait d'arriver jusqu'à l'écran :
   aucun ▣ à vérifier, donc aucune vérification, donc tout vert.
*/
verifier(
  'le marqueur « possible » est parvenu à l’écran au moins une fois',
  possiblesVus.length > 0,
  possiblesVus.join(' · '),
);

if (rouges > 0) {
  console.log(`\n${rouge(`${rouges} essai(s) en échec.`)}\n`);
  process.exit(1);
}
console.log(`\n${vert('Tous les essais passent.')}\n`);
