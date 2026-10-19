/**
 * L'initialisation, par l'interface réelle.
 *
 * Ce que cet essai couvre, et qu'aucun essai pur ne peut couvrir :
 *
 * - qu'une base vierge **mène à l'initialisation** avant le menu, et qu'elle
 *   n'y mène plus une fois faite ;
 * - qu'il n'y ait **qu'une question à l'écran**, que le prénom soit le seul sans
 *   « Plus tard », et que « Terminer maintenant » soit là dès la première ;
 * - qu'une question reportée **ne soit pas reposée après rechargement** — c'est
 *   la promesse qui tient tout le parcours, et elle se vérifie en fermant ;
 * - que la première entrée dans Révisions pose **ses** questions, une fois ;
 * - que l'initialisation allégée affiche ce qui est **observé** et le dise, et
 *   que rien ne soit écrit avant qu'on ait continué.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { accorderLApprentissage } from './lib/consentement-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  /* Cherché, non nommé : voir `lib/chromium-essais.mjs`. */
  executablePath: cheminDuNavigateur(),
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

async function deverrouiller() {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

const question = () => page.locator('#question').textContent();
const compteur = () => page.locator('#compteur').textContent();

/* ════════════════════════════════════════════════════════════════════════
   1. La garde : une base vierge passe par l'initialisation
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE BASE VIERGE MÈNE À L’INITIALISATION');

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
/*
   La garde décide **après** avoir lu la base, et le menu est peint pendant
   qu'elle lit : attendre « l'un ou l'autre écran » attraperait le menu avant
   la redirection, et l'essai mesurerait la vitesse de la lecture, pas la
   garde. On attend donc la redirection sans exiger qu'elle ait lieu — un
   délai qui expire est une réponse, et c'est l'assertion qui tranche.
*/
await page.waitForURL('**/initialisation/', { timeout: 20000 }).catch(() => {});
v('le menu renvoie à l’initialisation', new URL(page.url()).pathname, '/initialisation/');
await page.waitForSelector('#question', { timeout: 40000 }).catch(() => {});
v('et la première question est celle du prénom', await question(), 'Comment doit-on vous appeler ?');
/*
   L'AVANCEMENT, SANS FIGER LE TOTAL.

   L'essai attendait « 1 / 16 », chiffre juste le jour où il a été écrit.
   Le socle commun a gagné une question depuis — il annonce « 1 / 17 » — et
   l'essai accusait l'écran d'un compteur faux alors que c'est son attente
   qui s'était périmée. Recopier 17 ne ferait que déplacer la date de
   péremption.

   La propriété éprouvée ici est le COMPTEUR, pas le catalogue : il
   commence à 1, il avance d'une question à l'autre, et son total ne bouge
   pas en route. On lit donc le total une fois, on le garde, et on le
   compare à lui-même à l'écran suivant. Le nombre de questions, lui, se
   contrôle là où il se décide — au catalogue du profil, par
   « essais:contexte » et « essais:registre-gestes ».

   La borne basse reste un garde-fou : un total d'une seule question
   voudrait dire que le socle a disparu, et ce ne serait pas au compteur de
   se taire là-dessus. Elle était à dix quand le socle posait dix-huit
   questions ; la décision 2 du prompt 56 en laisse huit — celles dont la
   réponse est lue —, et la borne descend donc à cinq, toujours la moitié de
   ce qui est déclaré. Le compte exact, lui, est éprouvé par « essais:profil »
   et « essais:lu-par », là où il se décide.
*/
const avancement = await compteur();
const totalDesQuestions = Number(/^1 \/ (\d+)$/.exec(avancement ?? '')?.[1] ?? 0);
v('l’avancement est annoncé, et il commence à 1', /^1 \/ \d+$/.test(avancement ?? ''), true);
v(`et le total est crédible (${totalDesQuestions} questions)`, totalDesQuestions >= 5, true);
faux('« Plus tard » n’est pas proposé sur le prénom', await page.locator('#plus-tard').isVisible());
vrai('mais « Terminer maintenant » l’est', await page.locator('#terminer').isVisible());
v(
  'une seule question est à l’écran',
  await page.locator('#question').count(),
  1,
);
faux(
  'aucun constat d’observation sur une base vierge',
  await page.locator('#observe').isVisible(),
);

/* ════════════════════════════════════════════════════════════════════════
   2. Répondre, reporter, reprendre
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nRÉPONDRE, REPORTER, ET REVENIR AU MÊME ENDROIT');

{
  /* Le prénom est obligatoire : continuer sans rien écrire doit le dire. */
  await page.click('#valider');
  vrai('un prénom vide est refusé, avec un motif', await page.locator('#erreur').isVisible());
  v('et la question ne change pas', await question(), 'Comment doit-on vous appeler ?');
}

await page.fill('#saisie-prenom', 'Alexis');
await page.click('#valider');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('année de naissance'),
  { timeout: 15000 },
);
/*
   LE DÉROULÉ A CHANGÉ AVEC LA DÉCISION 2 DU PROMPT 56.

   Le socle posait dix-huit questions : prénom, nom, année de naissance,
   tutoiement, langue et fuseau, activité… Dix d'entre elles ne sont plus
   posées, parce que rien ne lit leur réponse — le nom, le tutoiement et
   l'activité en font partie. Il en reste huit, dans cet ordre : prénom,
   année de naissance, fuseau, lever, moment de la revue, coucher, temps par
   semaine, domaines suivis.

   Les propriétés éprouvées ici ne changent pas d'un mot : une question à
   l'écran, « Plus tard » qui avance sans écrire, et un report qui tient au
   rechargement. Seules les questions traversées sont les nouvelles.
*/
v(
  'le prénom posé, on passe à l’année de naissance',
  await question(),
  'Quelle est votre année de naissance ?',
);
v('le compteur avance, sur le même total', await compteur(), `2 / ${totalDesQuestions}`);
vrai('et « Plus tard » apparaît', await page.locator('#plus-tard').isVisible());

await page.click('#plus-tard');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('heure de Paris'),
  { timeout: 15000 },
);
v(
  '« Plus tard » avance sans écrire : on passe au fuseau',
  await question(),
  'Vos journées sont comptées à l’heure de Paris : c’est bien ça ?',
);

/* La promesse du parcours : fermer, revenir, et retrouver le même endroit. */
await aller('/initialisation/', '#question');
v(
  'après rechargement, la question reportée n’est pas reposée',
  await question(),
  'Vos journées sont comptées à l’heure de Paris : c’est bien ça ?',
);
/*
   « Raccourci d'autant » se MESURE, au lieu de se figer : le reste à poser
   doit avoir diminué du nombre de questions reportées, et le compteur doit
   repartir de 1. Le nombre « 1 / 13 » était juste quand une seule question
   était reportée ; il ne l'est plus dès qu'on en reporte deux, et il ne
   dirait rien de plus que les deux propriétés ci-dessous.
*/
{
  const apresReport = (await compteur()) ?? '';
  const reste = Number(/^1 \/ (\d+)$/.exec(apresReport)?.[1] ?? 0);
  v('le parcours repart de la première question restante', /^1 \/ \d+$/.test(apresReport), true);
  v(
    `et il s’est raccourci : ${reste} restantes sur ${totalDesQuestions}`,
    reste > 0 && reste < totalDesQuestions,
    true,
  );
}

/*
   Un choix unique se valide d'un seul geste : pas de « Continuer » à chercher.
   Le fuseau était jusqu'ici accompagné de la langue sur le même écran, ce qui
   faisait deux champs et ramenait le bouton « Continuer » ; seul, il se valide
   du premier clic, et le bouton n'a plus de raison d'être là.
*/
faux('« Continuer » s’efface devant un choix unique', await page.locator('#valider').isVisible());
await page.click('[data-valeur="Europe/Paris"]');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('vous levez-vous'),
  { timeout: 15000 },
);
v('un bouton de choix vaut validation', await question(), 'À quelle heure vous levez-vous, d’habitude ?');

/* Et « Plus tard » une seconde fois, sans rien écrire non plus. */
await page.click('#plus-tard');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('votre revue'),
  { timeout: 15000 },
);
/* La question a changé de phrase avec la décision 4 du 56 : elle dit
   maintenant ce que le choix change, c'est-à-dire le jour sur lequel la revue
   porte. */
v(
  'la question suivante arrive',
  await question(),
  'Faites-vous votre revue le matin, sur la veille, ou le soir, sur la journée ?',
);

await page.click('#terminer');
await page.waitForSelector('#aller-menu', { timeout: 15000 });
vrai('« Terminer maintenant » mène à l’écran de fin', await page.locator('#fin').isVisible());

/* ════════════════════════════════════════════════════════════════════════
   3. La garde ne retient plus
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’INITIALISATION FAITE, LE MENU S’OUVRE');

await aller('/', '[data-branche="revisions"]');
v('le menu s’affiche', new URL(page.url()).pathname, '/');
await page.waitForFunction(
  () => document.getElementById('salutation')?.textContent?.includes('Alexis'),
  { timeout: 15000 },
);
v('et il salue par le prénom donné', await page.locator('#salutation').textContent(), 'Bonjour Alexis.');

/* ════════════════════════════════════════════════════════════════════════
   4. Le module de branche, à la première entrée
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nRÉVISIONS POSE SES QUESTIONS À LA PREMIÈRE ENTRÉE');

await aller('/revisions/', '#question, #dues');
v('la branche mène à son module', new URL(page.url()).pathname, '/initialisation/');
v('et le dit dans son étiquette', (await page.locator('#etiquette').textContent())?.includes('Révisions'), true);
/*
   DEUX QUESTIONS, ET NON SIX, depuis la décision 2 du 56. Le concours, les
   dates d'épreuves et les deux listes de matières ne sont plus demandés :
   rien ne lit leur réponse aujourd'hui. Restent les heures de révision et le
   moment préféré, que l'adaptation lit pour comparer au réel.
*/
v(
  'la première question est celle des heures',
  await question(),
  'Combien d’heures de révision par semaine ?',
);
v('le module fait deux questions', await compteur(), '1 / 2');

await page.click('#plus-tard');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('matin ou le soir'),
  { timeout: 15000 },
);
/* « travailler » devient « réviser » : la question est celle des révisions, et
   « Moment de révision préféré » s'appelle désormais « Heure préférée pour
   réviser » (décision 4). */
v('on passe au moment préféré', await question(), 'Préférez-vous réviser le matin ou le soir ?');
/*
   La dernière question répondue termine le module d'elle-même : il n'y a plus
   de « Terminer maintenant » à chercher, et l'écran de fin arrive seul. Le
   module en comptait six, et l'essai en abandonnait donc quatre par ce bouton.
*/
await page.click('[data-valeur="matin"]');
await page.waitForSelector('#aller-menu', { timeout: 15000 });
v(
  '« Entrer » ramène dans la branche, pas au menu',
  await page.locator('#aller-menu').getAttribute('href'),
  '/revisions/',
);

await aller('/revisions/', '#dues');
v('et la branche ne redemande plus rien', new URL(page.url()).pathname, '/revisions/');

/* ════════════════════════════════════════════════════════════════════════
   5. Ce qui a été écrit, et comment « Mon profil » le dit
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nCE QUI EST ÉCRIT EST CE QUI A ÉTÉ RÉPONDU');

await aller('/profil/', '#champs');
{
  const champs = await page.$$eval('#champs > div', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  const texte = champs.join(' | ');
  vrai('le prénom est là, déclaré', /Prénom.*Alexis.*déclaré/.test(texte));
  vrai('le fuseau choisi aussi', /Fuseau.*Europe\/Paris/.test(texte));
  vrai('et l’heure préférée, posée par le module', /Heure préférée pour réviser.*matin/.test(texte));
  faux(
    'l’année de naissance reportée n’a rien écrit',
    /Année de naissance[^|]*déclaré/.test(texte),
  );
  /* Trois, et plus cinq : le tutoiement, la langue et le concours ne sont
     plus demandés, donc plus posés, donc plus écrits. */
  v('trois champs ont été posés, et pas un de plus', champs.length, 3);
}
{
  const restants = await page.$$eval('#restants > *', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  vrai(
    'et une question reportée revient parmi ce qui n’est pas renseigné',
    restants.some((r) => r.startsWith('Année de naissance')),
  );
}

/* ════════════════════════════════════════════════════════════════════════
   6. L'initialisation allégée : ce qui est observé est dit comme tel
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’INITIALISATION ALLÉGÉE DIT CE QU’ELLE A OBSERVÉ');

const second = await nav.newContext();
const page2 = await second.newPage();
page2.on('pageerror', (e) => console.log('PAGEERROR 2:', e.message.slice(0, 250)));

await page2.goto(`${RACINE}/robots.txt`);
await page2.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);

/*
   Huit séances sur quatre semaines pleines, écrites par la vraie porte d'entrée
   des séances — celle qui journalise. Semer directement dans le magasin aurait
   produit un usage que le journal ignore, c'est-à-dire exactement ce que la
   phase A a corrigé.
*/
await page2.goto(`${RACINE}/revisions/`, { waitUntil: 'networkidle' });
if (await page2.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page2.fill('#champ-mdp', MDP);
  await page2.click('#bouton-verrou');
}
await page2.waitForSelector('#question, #dues', { timeout: 40000 });

const seme = await page2.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const seances = [];
  const aujourdhui = new Date();
  for (let semaine = 1; semaine <= 4; semaine += 1) {
    for (const decalage of [0, 2]) {
      const date = new Date(aujourdhui.getTime() - (semaine * 7 + decalage) * 86_400_000);
      const jour = date.toISOString().slice(0, 10);
      seances.push({
        id: `01ESSAIINIT${String(semaine)}${String(decalage)}0000000000`,
        jour,
        statut: 'terminee',
        theme: 'droit-public',
        secondes: 3600,
        termineeLe: `${jour}T09:30:00.000Z`,
        fiches: [],
        etendue: false,
      });
    }
  }
  await new Promise((ok, ko) => {
    const tx = base.transaction('seances', 'readwrite');
    for (const seance of seances) tx.objectStore('seances').put(seance);
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
  return seances.length;
});
v('huit séances sont semées dans le magasin', seme, 8);

/*
   LA PORTE DU CONSENTEMENT (A-13, `3cf4122`), et c'est elle qui faisait
   six rouges.

   `observerUsage()` rend « silence : sans-consentement » AVANT de lire le
   moindre fait : semer huit séances ne suffit pas, et l'écran qui ne
   montrait aucun constat avait raison de se taire. L'essai a été écrit
   avant cette porte, et accusait l'écran d'un silence qui est une
   garantie.

   On accorde donc par l'interrupteur de « Mon profil », comme une personne
   le ferait — jamais par une écriture directe en base, qui ferait un essai
   cessant de remarquer que l'interrupteur est cassé.
*/
v(
  'le consentement est accordé par l’écran, sans quoi rien n’est observé',
  await accorderLApprentissage(page2, RACINE, MDP),
  true,
);

await page2.goto(`${RACINE}/initialisation/`, { waitUntil: 'networkidle' });
await page2.waitForSelector('#allegee:not(.hidden), #parcours:not(.hidden)', { timeout: 40000 });
vrai(
  'une base qui porte de l’usage ouvre sur l’initialisation allégée',
  await page2.locator('#allegee').isVisible(),
);
{
  const repris = await page2.$$eval('#repris li', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  vrai('elle dit ce qui est repris tel quel', repris.length >= 3);
  vrai(
    'dont les points d’expérience et le niveau',
    repris.some((r) => r.includes('expérience')),
  );
  vrai(
    'et le rythme hebdomadaire observé',
    repris.some((r) => /médiane/.test(r)),
  );
}

await page2.click('#commencer');
await page2.waitForSelector('#parcours:not(.hidden)', { timeout: 15000 });
await page2.fill('#saisie-prenom', 'Alexis');
await page2.click('#valider');
/*
   Attendre que l'écran ait changé avant d'entrer dans la boucle. Sans cela,
   la boucle lit encore la question du prénom, « Plus tard » n'y est pas, et
   Playwright patiente jusqu'à ce qu'il apparaisse — c'est-à-dire sur l'écran
   suivant. La boucle se décale alors d'un écran et compare la question à une
   valeur périmée : l'attente rend la main aussitôt, un second clic part
   pendant que le premier avance encore, et deux écrans passent pour un clic.
   C'est ce décalage qui faisait sauter la question déduite une fois sur trois.
*/
await page2.waitForFunction(
  () => document.getElementById('question')?.textContent !== 'Comment doit-on vous appeler ?',
  undefined,
  { timeout: 15000 },
);

/* On avance jusqu'à la question du temps par semaine, qui est déduite. */
let vus = 0;
while (vus < 20) {
  const texte = (await page2.locator('#question').textContent()) ?? '';
  if (texte.includes('Combien de temps pouvez-vous')) break;
  await page2.click('#plus-tard');
  /*
     Attendre que la question change, et non un délai fixe : « Plus tard »
     écrit une opération avant d'avancer, et un délai calibré sur une machine
     rapide rend l'essai instable sur une lente.
  */
  await page2.waitForFunction(
    (avant) => document.getElementById('question')?.textContent !== avant,
    texte,
    { timeout: 15000 },
  );
  vus += 1;
}
v('la question du temps disponible est atteinte', (await page2.locator('#question').textContent())?.includes('Combien de temps pouvez-vous'), true);
vrai(
  'et elle porte le constat d’observation',
  await page2.locator('#observe').isVisible(),
);
{
  const texte = (await page2.locator('#observe').textContent()) ?? '';
  vrai('qui est annoncé comme observé et non déclaré', texte.includes('Observé, pas déclaré'));
  vrai('qui dit ce qui a été vu', /médiane/.test(texte));
  vrai('et qui dit que rien n’est écrit avant d’avoir continué', texte.includes('rien n’est écrit'));
}

await page2.click('#valider');
/*
   Attendre que l'opération soit **journalisée**, et non un délai fixe :
   « Valider » écrit puis avance, et partir vers « Mon profil » sur un délai
   calibré ici ferait lire la base avant l'écriture — l'essai dirait alors que
   la confirmation ne s'enregistre pas, ce qui serait faux.
*/
await page2.waitForFunction(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const tx = r.result.transaction('operations', 'readonly');
        tx.objectStore('operations').getAll().onsuccess = (e) =>
          ok(e.target.result.some((o) => JSON.stringify(o).includes('tempsParSemaine')));
      };
      r.onerror = () => ok(false);
    }),
  undefined,
  { timeout: 15000 },
);
await page2.goto(`${RACINE}/profil/`, { waitUntil: 'networkidle' });
await page2.waitForSelector('#champs', { timeout: 40000 });
{
  const texte = (
    await page2.$$eval('#champs > div', (els) =>
      els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    )
  ).join(' | ');
  vrai(
    'une déduction confirmée est écrite comme « observé, puis confirmé »',
    /Temps disponible[^|]*observé, puis confirmé/.test(texte),
  );
  faux(
    'et jamais comme une déclaration',
    /Temps disponible[^|]*· déclaré/.test(texte),
  );
}

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
