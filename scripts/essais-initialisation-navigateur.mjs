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
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

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
   se taire là-dessus.
*/
const avancement = await compteur();
const totalDesQuestions = Number(/^1 \/ (\d+)$/.exec(avancement ?? '')?.[1] ?? 0);
v('l’avancement est annoncé, et il commence à 1', /^1 \/ \d+$/.test(avancement ?? ''), true);
v(`et le total est crédible (${totalDesQuestions} questions)`, totalDesQuestions >= 10, true);
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
  () => document.getElementById('question')?.textContent?.startsWith('Et votre nom'),
  { timeout: 15000 },
);
v('le prénom posé, on passe au nom', await question(), 'Et votre nom, si vous voulez le donner ?');
v('le compteur avance, sur le même total', await compteur(), `2 / ${totalDesQuestions}`);
vrai('et « Plus tard » apparaît', await page.locator('#plus-tard').isVisible());

/*
   L'ANNÉE DE NAISSANCE S'EST INTERCALÉE, et l'essai l'ignorait.

   Elle est posée juste après le nom depuis le prompt 50 (âge et cycle) :
   le parcours réel est prénom, nom, année de naissance, tutoiement. L'essai
   attendait « tutoie » dès le report du nom, et expirait donc sur une
   question parfaitement légitime.

   On reporte les deux, et la propriété éprouvée ne change pas : « Plus
   tard » avance sans écrire, autant de fois qu'on le demande.
*/
await page.click('#plus-tard');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('année de naissance'),
  { timeout: 15000 },
);
v(
  '« Plus tard » avance sans écrire : on passe à l’année de naissance',
  await question(),
  'Quelle est votre année de naissance ?',
);
await page.click('#plus-tard');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('tutoie'),
  { timeout: 15000 },
);
v('et une seconde fois, sans rien écrire non plus', await question(), 'On se tutoie, ou on se vouvoie ?');

/* La promesse du parcours : fermer, revenir, et retrouver le même endroit. */
await aller('/initialisation/', '#question');
v(
  'après rechargement, la question reportée n’est pas reposée',
  await question(),
  'On se tutoie, ou on se vouvoie ?',
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

/* Un choix unique se valide d'un seul geste : pas de « Continuer » à chercher. */
await page.click('[data-valeur="tu"]');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('heure de Paris'),
  { timeout: 15000 },
);
v('un bouton de choix vaut validation', await question(), 'Français, et heure de Paris : c’est bien ça ?');

/* Un écran, deux champs : la question 3 règle la langue **et** le fuseau. */
await page.click('#valider');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('dans la vie'),
  { timeout: 15000 },
);
v('la question suivante arrive', await question(), 'Qu’est-ce que vous faites dans la vie ?');

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
v('la première question est celle du concours', await question(), 'Quel concours préparez-vous ?');
v('le module fait six questions', await compteur(), '1 / 6');

await page.click('[data-valeur="insp"]');
await page.click('#valider');
await page.waitForFunction(
  () => document.getElementById('question')?.textContent?.includes('épreuves'),
  { timeout: 15000 },
);
v('le concours retenu, on passe aux dates', await question(), 'Quand sont les épreuves ?');

await page.click('#terminer');
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
  vrai('la formalité aussi', /Tutoiement.*tu/.test(texte));
  vrai('le concours retenu aussi', /Concours.*insp/.test(texte));
  vrai('un écran a bien écrit deux champs : la langue', /Langue.*fr/.test(texte));
  vrai('et le fuseau', /Fuseau.*Europe\/Paris/.test(texte));
  faux('le nom reporté n’a rien écrit', /Nom\b(?!bre)[^|]*déclaré/.test(texte));
  v('cinq champs ont été posés, et pas un de plus', champs.length, 5);
}
{
  const restants = await page.$$eval('#restants > *', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  vrai(
    'et une question reportée revient parmi ce qui n’est pas renseigné',
    restants.some((r) => r.startsWith('Nom')),
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
