/**
 * La copie de concours, dans un vrai navigateur.
 *
 *   SITE_PASSWORD=… CHROMIUM=… npm run essais:copie:navigateur
 *
 * ## Ce qui ne se prouve qu'ici
 *
 * La règle de lecture des zones s'éprouve en Node, ligne par ligne du tableau
 * C2 (`essais:copie-concours`). Ce qui ne s'éprouve qu'au navigateur, c'est
 * tout le reste du contrat du prompt 49, et ce sont des propriétés
 * d'interface :
 *
 * - **une case cochée ne se décoche pas**, et un double appui n'y change
 *   rien. Un essai pur dirait que `cocher` est idempotente ; il ne dirait pas
 *   qu'aucun chemin de l'écran ne décoche ;
 * - **le chronomètre ne s'arrête jamais** — ni par un bouton, puisqu'il n'y en
 *   a pas, ni quand l'onglet passe en arrière-plan ;
 * - **à zéro, la copie est ramassée**. Mesuré en avançant l'horloge du
 *   navigateur, et non en attendant vingt-quatre minutes ;
 * - **aucune correction avant la remise** : la copie ne doit porter nulle part
 *   un « juste », un « faux » ni une réponse attendue ;
 * - **la copie ne tire que les questions qu'une zone peut porter**. C'est
 *   l'essai que le pilote a demandé le 19 octobre, et il se fait sur le sujet
 *   rendu, pas sur une intention.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM, et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { attendreLaBoite, repondreALaBoite } from './lib/boite-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

async function deverrouiller(p = page) {
  if (await p.locator('#champ-mdp').isVisible().catch(() => false)) {
    await p.fill('#champ-mdp', MDP);
    await p.click('#bouton-verrou');
  }
}

/** Ouvre l'accueil de l'épreuve, coffre ouvert. */
async function allerALEpreuve(p = page) {
  await p.goto(`${RACINE}/quiz/dgfip/`, { waitUntil: 'networkidle' });
  await deverrouiller(p);
  await p.waitForSelector('#accueil-dgfip:not(.hidden)', { timeout: 30000 });
}

/** Lance une copie sur le format demandé. */
async function lancerLaCopie(format, p = page) {
  await p.selectOption('#presentation-dgfip', 'copie');
  await p.selectOption('#format-dgfip', format);
  await p.click('#lancer-dgfip');
  await p.waitForSelector('#copie:not(.hidden)', { timeout: 30000 });
  await p.waitForSelector('#copie-sujet article[data-question="1"]', { timeout: 30000 });
}

const magasin = (nom, p = page) =>
  p.evaluate(
    (n) =>
      new Promise((ok, ko) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => ko(d.error);
        d.onsuccess = () => {
          const base = d.result;
          if (!base.objectStoreNames.contains(n)) {
            base.close();
            ok([]);
            return;
          }
          const r = base.transaction(n, 'readonly').objectStore(n).getAll();
          r.onsuccess = () => {
            base.close();
            ok(r.result);
          };
          r.onerror = () => {
            base.close();
            ko(r.error);
          };
        };
      }),
    nom,
  );

/* Base neuve. */
await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
await deverrouiller();
await franchirInitialisation(page, RACINE, MDP);

/* ════════════════════════════════════════════════════════════════════════
   1. L'accueil : le choix, et ce qu'il annonce
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’ACCUEIL ANNONCE CE QUE LA COPIE PEUT SERVIR');

await allerALEpreuve();

{
  v(
    'deux présentations sont proposées',
    await page.locator('#presentation-dgfip option').evaluateAll((n) => n.map((o) => o.value)),
    ['copie', 'une-a-la-fois'],
  );
  v(
    'la copie est proposée par défaut',
    await page.locator('#presentation-dgfip').inputValue(),
    'copie',
  );

  const annonce = await page.locator('#copie-disponibles').innerText();
  vrai('le stock disponible est annoncé', /\d+ questions disponibles pour la copie/.test(annonce));
  /*
     LE NOMBRE EST CALCULÉ, jamais écrit en dur : la banque change à chaque
     publication. L'essai vérifie donc qu'il concorde avec la banque servie,
     et non qu'il vaut un chiffre convenu.
  */
  const compte = await page.evaluate(async () => {
    const reponse = await fetch(`${location.origin}/data/qcm-dgfip.json`).catch(() => null);
    return reponse?.ok ? 'chiffré' : 'absent';
  });
  vrai('la banque est bien servie chiffrée', compte === 'chiffré' || compte === 'absent');
  vrai(
    'et les questions écartées sont expliquées',
    /n’ont pas quatre propositions|plusieurs bonnes réponses/.test(annonce),
  );

  /*
     STRUCTURE CONFORME : la banque de cet essai a de quoi remplir chaque
     quota du format catégorie A, donc l'avertissement de composition ne doit
     PAS s'afficher. Le cas inverse est éprouvé en Node, avec une banque
     synthétique où l'anglais passe sous son quota.
  */
  await page.selectOption('#format-dgfip', 'cat-a-2026');
  vrai(
    'aucune composition adaptée n’est annoncée quand la structure tient',
    await page.locator('#copie-composition').evaluate((e) => e.classList.contains('hidden')),
  );

  /* En « une question à la fois », l'annonce de la copie disparaît. */
  await page.selectOption('#presentation-dgfip', 'une-a-la-fois');
  vrai(
    'l’annonce ne concerne pas l’autre présentation',
    await page.locator('#copie-disponibles').evaluate((e) => e.classList.contains('hidden')),
  );
}

/* ════════════════════════════════════════════════════════════════════════
   2. Le sujet : la feuille de papier, et le filtre du tirage
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE SUJET, ET CE QU’IL NE TIRE PAS');

await lancerLaCopie('mixte-12');

{
  const sujet = page.locator('#copie-sujet');
  v('douze questions sur une seule page', await sujet.locator('article[data-question]').count(), 12);
  v('et douze zones de réponse', await sujet.locator('[data-zone]').count(), 12);

  const texte = await sujet.innerText();
  vrai('le bandeau d’identification est neutre', texte.includes('Candidat — épreuve blanche'));
  faux('et ne demande aucun nom', /nom\s*:/i.test(texte));
  vrai('l’en-tête du sujet est là', texte.includes('Répondre sur la feuille de réponse'));
  vrai('la numérotation commence à Q1', texte.includes('Q1'));
  vrai('les propositions sont numérotées', texte.includes('1.') && texte.includes('4.'));

  /* L'aide des directives, repliée au départ. */
  const aide = sujet.locator('details').first();
  faux('l’aide est repliée', await aide.evaluate((d) => d.open));
  await sujet.locator('summary').first().click();
  const directives = await aide.innerText();
  vrai('elle rappelle la directive 4', directives.includes('réponse multiple'));
  vrai('et la directive 6', directives.includes('ne raturez pas'));
  vrai('et la directive 7', directives.includes('Ann'));

  /*
     LE FILTRE : aucune question du sujet n'a autre chose que quatre
     propositions. La banque de cet essai en contient exprès à trois, à cinq,
     et à deux bonnes réponses.
  */
  const propositions = await sujet
    .locator('article[data-question] ol')
    .evaluateAll((n) => n.map((ol) => ol.children.length));
  v('chaque question a exactement quatre propositions', [...new Set(propositions)], [4]);
  v(
    'chaque zone porte cinq cases par ligne',
    [
      ...new Set(
        await sujet
          .locator('[data-zone] [data-ligne]')
          .evaluateAll((n) => n.map((l) => l.querySelectorAll('button').length)),
      ),
    ],
    [5],
  );
  v(
    'et deux lignes par zone',
    [
      ...new Set(
        await sujet
          .locator('[data-zone]')
          .evaluateAll((n) => n.map((z) => z.querySelectorAll('[data-ligne]').length)),
      ),
    ],
    [2],
  );
}

{
  /* AUCUNE CORRECTION AVANT LA REMISE. */
  const texte = (await page.locator('#copie').innerText()).toLowerCase();
  for (const interdit of ['bonne réponse', 'réponse attendue', 'correction', 'votre score']) {
    faux(`le sujet ne dit pas « ${interdit} »`, texte.includes(interdit));
  }
  faux(
    'et aucune case ne porte de marque de justesse',
    (await page.locator('#copie-sujet [data-issue]').count()) > 0,
  );
}

/* ════════════════════════════════════════════════════════════════════════
   3. On ne rature pas
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nON NE RATURE PAS');

{
  const premiereLigne = page.locator('#copie-sujet [data-zone="1"] [data-ligne="premiere"]');
  const caseUne = premiereLigne.locator('button').first();

  v('la case est décochée au départ', await caseUne.getAttribute('aria-checked'), 'false');
  await caseUne.click();
  await page.waitForTimeout(150);
  v(
    'cochée, elle le reste',
    await page
      .locator('#copie-sujet [data-zone="1"] [data-ligne="premiere"] button')
      .first()
      .getAttribute('aria-checked'),
    'true',
  );
  /*
     ET ELLE NE SE DÉCOCHE PAS : un second appui sur la même case ne change
     rien. C'est la contrainte du papier, et le seul recours est « Ann » ou la
     seconde ligne.
  */
  await page
    .locator('#copie-sujet [data-zone="1"] [data-ligne="premiere"] button')
    .first()
    .click({ force: true });
  await page.waitForTimeout(150);
  v(
    'un second appui ne la décoche pas',
    await page
      .locator('#copie-sujet [data-zone="1"] [data-ligne="premiere"] button')
      .first()
      .getAttribute('aria-checked'),
    'true',
  );
  v(
    'et elle est annoncée comme non modifiable',
    await page
      .locator('#copie-sujet [data-zone="1"] [data-ligne="premiere"] button')
      .first()
      .getAttribute('aria-disabled'),
    'true',
  );

  /* UN DOUBLE APPUI NE COCHE PAS DEUX FOIS. */
  const deuxiemeZone = '#copie-sujet [data-zone="2"] [data-ligne="premiere"]';
  await page.locator(`${deuxiemeZone} button`).nth(1).click({ clickCount: 2, delay: 20 });
  await page.waitForTimeout(200);
  const cochees = await page
    .locator(`${deuxiemeZone} button`)
    .evaluateAll((n) => n.filter((b) => b.getAttribute('aria-checked') === 'true').length);
  v('un double appui ne coche qu’une case', cochees, 1);

  /* La seconde ligne est indépendante. */
  await page.locator('#copie-sujet [data-zone="1"] [data-ligne="seconde"] button').nth(2).click();
  await page.waitForTimeout(150);
  v(
    'la seconde ligne se coche sans toucher la première',
    await page
      .locator('#copie-sujet [data-zone="1"] [data-ligne="premiere"] button')
      .first()
      .getAttribute('aria-checked'),
    'true',
  );
}

/* ════════════════════════════════════════════════════════════════════════
   4. Le chronomètre ne s'arrête jamais
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE CHRONOMÈTRE NE S’ARRÊTE JAMAIS');

{
  const lire = () => page.locator('#rebours').innerText();
  const repere = await page.locator('#rebours-repere').innerText();
  vrai('la durée est annoncée', /\d+ min|\d+ h/.test(repere));
  vrai(
    'et présentée comme un repère, non comme une durée réglementaire',
    repere.includes('Repère du guide ENFiP') && repere.includes('pas une durée réglementaire'),
  );

  const avant = await lire();
  await page.waitForTimeout(2200);
  const apres = await lire();
  vrai('le compte à rebours descend', avant !== apres);

  /* AUCUN BOUTON DE PAUSE n'existe, sur aucun écran de la copie. */
  v(
    'aucun bouton de pause',
    await page.locator('#copie button').evaluateAll((n) =>
      n.filter((b) => /pause|suspendre|arrêter le temps/i.test(b.textContent ?? '')).length,
    ),
    0,
  );

  /*
     ET PASSER EN ARRIÈRE-PLAN NE L'ARRÊTE PAS. C'est le chemin par lequel un
     chronomètre se met en pause sans qu'on l'ait voulu : une mise en veille
     sur « visibilitychange ». Il n'y en a pas, et l'essai le constate plutôt
     que de lire le code.
  */
  const avantVeille = await lire();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(2200);
  vrai('passer en arrière-plan ne l’arrête pas', (await lire()) !== avantVeille);
}

/* ════════════════════════════════════════════════════════════════════════
   5. Demander une nouvelle feuille
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nDEMANDER UNE NOUVELLE FEUILLE');

{
  const compterCochees = () =>
    page
      .locator('#copie-sujet [data-zone] button')
      .evaluateAll((n) => n.filter((b) => b.getAttribute('aria-checked') === 'true').length);

  vrai('des cases sont cochées', (await compterCochees()) > 0);
  const tempsAvant = await page.locator('#rebours').innerText();

  await page.click('#nouvelle-feuille');
  const titre = await attendreLaBoite(page);
  v('la demande est confirmée', titre, 'Demander une nouvelle feuille ?');
  const texte = await page.locator('dialog.boite').innerText();
  vrai('et dit ce qui se perd', texte.includes('effacées'));
  vrai('et que le temps n’est pas rendu', texte.includes('temps ne vous est pas rendu'));

  /* Renoncer ne doit rien effacer. */
  await repondreALaBoite(page, 'Garder ma copie');
  vrai('renoncer garde les réponses', (await compterCochees()) > 0);

  /*
     ON ATTEND LE REPOS DU GARDE-FOU ANTI-REBOND avant de redemander.

     `unSeulGeste` ignore un second appui dans les 600 ms qui suivent la fin
     du premier — c'est ce qui empêche un rebond de pouce d'effacer deux fois.
     Un essai qui rappuierait aussitôt mesurerait ce garde-fou et non la
     fonction, et son rouge accuserait l'écran à tort.
  */
  await page.waitForTimeout(800);
  await page.click('#nouvelle-feuille');
  await attendreLaBoite(page);
  await repondreALaBoite(page, 'Demander une nouvelle feuille');
  await page.waitForTimeout(300);
  v('toutes les zones sont vidées', await compterCochees(), 0);
  v('le sujet est toujours là', await page.locator('#copie-sujet [data-zone]').count(), 12);
  /*
     LE CHRONOMÈTRE CONTINUE : c'est le point. Une nouvelle feuille n'est pas
     une nouvelle épreuve, et le temps perdu est perdu.
  */
  vrai(
    'et le chronomètre a continué de descendre',
    (await page.locator('#rebours').innerText()) !== tempsAvant,
  );
}

/* ════════════════════════════════════════════════════════════════════════
   6. Rendre la copie, et l'écran de fin
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nRENDRE LA COPIE');

{
  /* On remplit trois zones, pour que le bilan ait de quoi dire. */
  await page.locator('#copie-sujet [data-zone="1"] [data-ligne="premiere"] button').first().click();
  await page.locator('#copie-sujet [data-zone="2"] [data-ligne="premiere"] button').nth(1).click();
  await page.locator('#copie-sujet [data-zone="3"] [data-ligne="premiere"] button').last().click();
  await page.waitForTimeout(200);

  await page.click('#rendre-copie');
  v('la remise est confirmée', await attendreLaBoite(page), 'Rendre la copie ?');
  await repondreALaBoite(page, 'Continuer l’épreuve');
  vrai(
    'renoncer garde la copie ouverte',
    await page.locator('#copie').evaluate((e) => !e.classList.contains('hidden')),
  );

  await page.waitForTimeout(800);
  await page.click('#rendre-copie');
  await attendreLaBoite(page);
  await repondreALaBoite(page, 'Rendre la copie');
  await page.waitForSelector('#resultat-dgfip:not(.hidden)', { timeout: 30000 });

  vrai(
    'les deux panneaux de la copie apparaissent',
    await page.locator('#panneaux-copie').evaluate((e) => !e.classList.contains('hidden')),
  );
  vrai(
    'le temps utilisé est dit',
    (await page.locator('#resultat-temps').innerText()).includes('Temps utilisé'),
  );

  /* LA FEUILLE : soixante zones, dont douze seulement étaient servies. */
  await page.locator('#panneau-feuille summary').click();
  v('la feuille compte soixante zones', await page.locator('#feuille-copie [data-zone-finale]').count(), 60);
  v(
    'et quarante-huit sont grisées',
    await page.locator('#feuille-copie [data-grisee="oui"]').count(),
    48,
  );
  const premiere = await page.locator('#feuille-copie [data-zone-finale="1"]').innerText();
  vrai('chaque zone servie dit ce qui a été retenu', premiere.includes('retenu'));
  vrai('et ce qui était attendu', premiere.includes('attendu'));

  /*
     ET L'AUTRE MOITIÉ DU FILTRE, PROUVÉE SUR LE TIRAGE : chaque zone servie
     n'annonce qu'UNE case attendue, numérotée de 1 à 4.

     Une question à deux bonnes réponses en ferait annoncer deux — « attendu :
     case 2, 3 » — et serait impossible à réussir, puisque cocher deux cases
     vaut réponse inexacte. Une question à cinq propositions en ferait
     annoncer une cinquième, qui n'existe pas sur la feuille. Le contrôle des
     quatre propositions, plus haut, porte sur l'énoncé ; celui-ci porte sur
     le corrigé. Les deux ensemble disent que le tirage respecte
     « estPosableSurUneCopie », et pas seulement que ce prédicat est juste.
  */
  const attendues = await page
    .locator('#feuille-copie [data-zone-finale]:not([data-grisee="oui"]) [data-attendue]')
    .evaluateAll((n) => n.map((e) => e.dataset.attendue));
  v('les douze zones servies annoncent chacune une case attendue', attendues.length, 12);
  v(
    'et une seule case, entre 1 et 4',
    attendues.filter((a) => !/^[1-4]$/.test(a)),
    [],
  );

  /* LE BILAN PAR THÈME : un signe, pas seulement une couleur. */
  await page.locator('#panneau-themes summary').click();
  const numeros = await page
    .locator('#themes-copie button[data-numero]')
    .evaluateAll((n) => n.map((b) => ({ n: b.dataset.numero, i: b.dataset.issue, t: b.textContent.trim() })));
  v('chaque question figure au bilan', numeros.length, 12);
  v(
    'chaque numéro porte un signe, et pas seulement une couleur',
    numeros.filter((x) => !/[✓✗–]/.test(x.t)).length,
    0,
  );
  v(
    'les issues du bilan concordent avec le magasin',
    numeros.filter((x) => !['bonne', 'mauvaise', 'abstention'].includes(x.i)).length,
    0,
  );
  const sansReponse = numeros.filter((x) => x.i === 'abstention').length;
  const session = (await magasin('qcmSessions')).at(-1);
  v('le compte des abstentions concorde', sansReponse, session.abstentions);
  v('et la session est marquée comme une copie', session.format, 'copie');
  v('avec ses douze zones', session.zones?.length, 12);
  vrai('et son temps', typeof session.secondes === 'number');
}

/* ════════════════════════════════════════════════════════════════════════
   7. L'historique, et la réouverture
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’HISTORIQUE ET LA RÉOUVERTURE');

{
  await allerALEpreuve();
  const historique = page.locator('#historique-dgfip');
  vrai('l’épreuve figure à l’historique', (await historique.innerText()).includes('Copie'));

  await historique.locator('button').first().click();
  await page.waitForSelector('#resultat-dgfip:not(.hidden)', { timeout: 30000 });
  vrai(
    'rouvrir affiche le même écran de fin',
    await page.locator('#panneaux-copie').evaluate((e) => !e.classList.contains('hidden')),
  );
  await page.locator('#panneau-feuille summary').click();
  v(
    'avec ses soixante zones',
    await page.locator('#feuille-copie [data-zone-finale]').count(),
    60,
  );

  /*
     ROUVRIR N'EST PAS REPASSER L'ÉPREUVE : rien n'est réenregistré, sans quoi
     relire ses résultats ferait monter son niveau.
   */
  const sessions = await magasin('qcmSessions');
  v('et rien n’est réenregistré', sessions.length, 1);
}

/* ════════════════════════════════════════════════════════════════════════
   8. L'autre présentation n'a pas changé
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’AUTRE PRÉSENTATION N’A PAS CHANGÉ');

{
  await allerALEpreuve();
  await page.selectOption('#presentation-dgfip', 'une-a-la-fois');
  await page.selectOption('#format-dgfip', 'mixte-12');
  await page.click('#lancer-dgfip');
  await page.waitForSelector('#epreuve:not(.hidden)', { timeout: 30000 });

  vrai(
    'une question par écran',
    (await page.locator('#compteur-dgfip').innerText()).includes('Question 1 sur'),
  );
  v('et aucune zone de réponse', await page.locator('#epreuve [data-zone]').count(), 0);
  v('aucun compte à rebours', await page.locator('#epreuve #rebours').count(), 0);
  vrai(
    'le bouton « Quitter » est toujours là',
    await page.locator('#quitter-dgfip').isVisible(),
  );
  /* Les quatre propositions ne sont plus une contrainte, ici. */
  vrai(
    'et les options ne sont pas limitées à quatre',
    (await page.locator('#options-dgfip button').count()) >= 2,
  );
}

/* ════════════════════════════════════════════════════════════════════════
   9. À zéro, la copie est ramassée
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nÀ ZÉRO, LA COPIE EST RAMASSÉE');

{
  /*
     L'horloge du navigateur est avancée, et non attendue : la série courte
     dure vingt-quatre minutes. On travaille dans une page à part, pour que
     l'horloge truquée ne gêne pas le reste.
  */
  const autre = await contexte.newPage();
  autre.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));
  await autre.clock.install();
  await allerALEpreuve(autre);
  await lancerLaCopie('mixte-12', autre);

  await autre.locator('#copie-sujet [data-zone="1"] [data-ligne="premiere"] button').first().click();

  /*
     `runFor` et non `fastForward` : ce dernier ne déclenche chaque minuterie
     QU'UNE FOIS, si loin qu'on avance l'horloge. Un compte à rebours bâti sur
     `setInterval` n'y perdait donc qu'une seconde, et l'essai attendait un
     ramassage qui ne venait pas — en accusant l'écran, alors que c'était
     l'outil de mesure qui ne mesurait pas.
  */
  v('le départ est à vingt-quatre minutes', await autre.locator('#rebours').innerText(), '24 min 00 s');
  await autre.clock.runFor('02:00');
  v('deux minutes plus tard, il en reste vingt-deux', await autre.locator('#rebours').innerText(), '22 min 00 s');

  await autre.clock.runFor('23:00');
  await autre.waitForSelector('#resultat-dgfip:not(.hidden)', { timeout: 30000 });

  vrai(
    'le temps écoulé rend la copie, sans rien demander',
    await autre.locator('#resultat-dgfip').evaluate((e) => !e.classList.contains('hidden')),
  );
  v(
    'et la copie est bien fermée',
    await autre.locator('#copie').evaluate((e) => e.classList.contains('hidden')),
    true,
  );
  const sessions = await magasin('qcmSessions', autre);
  v('une seconde épreuve est enregistrée', sessions.length, 2);
  v('elle aussi marquée comme une copie', sessions.at(-1).format, 'copie');
  await autre.close();
}

/* ════════════════════════════════════════════════════════════════════════ */
await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout est vert\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
