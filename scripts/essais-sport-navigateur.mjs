/**
 * Sport, dans un vrai navigateur.
 *
 * Trois choses ne se prouvent qu'ici, et ce sont les trois promesses de la
 * branche :
 *
 * - **le schéma du corps s'utilise au clavier seul**, et la liste de cases dit
 *   la même chose que lui dans les deux sens. C'est le test d'acceptation
 *   écrit dans le prompt, et aucun essai pur ne peut l'approcher : il porte
 *   sur le focus, les touches, et les noms accessibles ;
 * - **une séance interrompue se reprend sans perte**. L'essai recharge la page
 *   au milieu d'une séance, ce qui est exactement ce que fait un téléphone qui
 *   s'éteint ;
 * - **une douleur déclarée se voit**, et le tableau de bord annonce que rien
 *   ne sera proposé sur les muscles concernés.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { repondreALaBoite } from './lib/boite-essais.mjs';
import { liensDeNavigation } from './lib/navigation-essais.mjs';

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

/* Base neuve : les essais précédents ont pu laisser des séances en cours. */
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
   1. La branche est ouverte, et elle montre ses écrans
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA BRANCHE SPORT EST OUVERTE');

await page.goto(`${RACINE}/sport/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });

/*
   La **navigation de branche**, et non n'importe quelle barre de liens : le
   pied de page est un plan du site et liste les branches partout, ce qui est
   voulu. C'est la navigation de branche qui doit porter la branche courante.

   Elle a deux surfaces depuis D-010 — le ruban horizontal et la barre
   latérale —, et `global.css` cache le ruban à 1280 px avec une souris, le
   contexte même de cet essai. Lire la surface rendue, c'est poser la question
   d'origine ; attendre le ruban, c'était attendre quarante secondes un
   élément que le site a raison de cacher.
*/
const { chemins: onglets } = await liensDeNavigation(page);
vrai('la séance est dans le ruban', onglets.some((c) => c.endsWith('/sport/seance/')));
vrai('les exercices aussi', onglets.some((c) => c.endsWith('/sport/exercices/')));
/*
   Et surtout : le ruban ne montre **pas** les onglets de Révisions. C'est
   l'erreur exacte qui est passée en O7 — les écrans existaient, la navigation
   menait ailleurs.
*/
faux(
  'et pas ceux de Révisions',
  onglets.some((c) => c.endsWith('/flashcards/') || c.endsWith('/bibliotheque/')),
);
vrai(
  'les six écrans de Sport y sont',
  onglets.filter((c) => c.includes('/sport/')).length === 6,
);

/* ════════════════════════════════════════════════════════════════════════
   2. Le schéma du corps, au clavier seul
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE SCHÉMA DU CORPS S’UTILISE AU CLAVIER SEUL');

await page.goto(`${RACINE}/sport/exercices/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });

/* ── La liste d'abord, la création dans une boîte de dialogue ─────────── */
v(
  'la bibliothèque est en tête, le formulaire n’est pas ouvert',
  await page.evaluate(() => {
    const fenetre = document.getElementById('fenetre-ajout');
    const liste = document.getElementById('liste');
    return {
      ouverte: fenetre instanceof HTMLDialogElement ? fenetre.open : null,
      listeAvantFenetre:
        !!fenetre && !!liste && (liste.compareDocumentPosition(fenetre) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      champNomVisible: document.getElementById('nom')?.checkVisibility() ?? null,
    };
  }),
  { ouverte: false, listeAvantFenetre: true, champNomVisible: false },
);

await page.click('#ouvrir-ajout');
await page.waitForTimeout(300);
v(
  'le bouton « Ajouter un exercice » ouvre la fenêtre et donne le focus au nom',
  await page.evaluate(() => ({
    ouverte: document.getElementById('fenetre-ajout').open,
    focus: document.activeElement?.id ?? '',
  })),
  { ouverte: true, focus: 'nom' },
);

const zones = await page.$$eval('[data-zone]', (els) =>
  els.map((e) => ({
    muscle: e.dataset.zone,
    nom: e.getAttribute('aria-label'),
    focusable: e.getAttribute('tabindex') === '0',
    role: e.getAttribute('role'),
  })),
);
v('les dix-huit muscles sont des zones', zones.length, 18);
vrai('chacune porte un nom accessible', zones.every((z) => z.nom && z.nom.length > 2));
vrai('chacune est atteignable au clavier', zones.every((z) => z.focusable));
vrai('et annoncée comme un bouton', zones.every((z) => z.role === 'button'));

/*
   Le cycle au clavier. On met le focus sur une zone sans la cliquer — un clic
   prouverait la souris, pas le clavier — puis on l'active deux fois.
*/
await page.focus('[data-zone="pectoraux"]');
vrai(
  'le focus se pose bien sur la zone',
  await page.evaluate(() => document.activeElement?.dataset?.zone === 'pectoraux'),
);

await page.keyboard.press('Enter');
v(
  'Entrée fait passer à « principal »',
  await page.getAttribute('[data-zone="pectoraux"]', 'data-etat'),
  'principal',
);
v(
  'et la case correspondante suit',
  await page.inputValue('[data-case="pectoraux"]'),
  'principal',
);
v(
  'le nom accessible dit l’état',
  (await page.getAttribute('[data-zone="pectoraux"]', 'aria-label')).includes('principal'),
  true,
);

await page.keyboard.press(' ');
v(
  'Espace continue le cycle',
  await page.getAttribute('[data-zone="pectoraux"]', 'data-etat'),
  'secondaire',
);
await page.keyboard.press('Enter');
v(
  'et le cycle revient à son point de départ',
  await page.getAttribute('[data-zone="pectoraux"]', 'data-etat'),
  'aucun',
);

/* Dans l'autre sens : la case commande le schéma. */
await page.selectOption('[data-case="dorsaux"]', 'principal');
v(
  'la case met le schéma à jour',
  await page.getAttribute('[data-zone="dorsaux"]', 'data-etat'),
  'principal',
);
v(
  'et le schéma l’annonce pressé',
  await page.getAttribute('[data-zone="dorsaux"]', 'aria-pressed'),
  'true',
);

/* La silhouette ne doit pas être dans le parcours. */
v(
  'la silhouette est hors du parcours',
  await page.evaluate(
    () => document.querySelectorAll('svg g[aria-hidden="true"][tabindex]').length,
  ),
  0,
);

/* Et l'écran écrit réellement ce qu'on a coché. */
await page.fill('#nom', 'Tirage essai');
await page.fill('#equipement', 'poulie');
await page.click('#ajout button[type="submit"]');
await page.waitForTimeout(400);
v(
  'enregistrer referme la fenêtre',
  await page.evaluate(() => document.getElementById('fenetre-ajout').open),
  false,
);
await page.waitForFunction(
  () => [...document.querySelectorAll('#liste p')].some((p) => p.textContent.includes('Tirage essai')),
  { timeout: 15000 },
);
vrai('l’exercice saisi au clavier est enregistré', true);
v(
  'le formulaire est rendu neuf',
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-zone]')].every((z) => z.dataset.etat === 'aucun'),
  ),
  true,
);

/*
   UN SECOND EXERCICE, PARCE QUE LA SUPPRESSION VA EN MANGER UN.

   La section suivante supprime une ligne, et la section 3 ouvre une séance.
   Avec un seul exercice en bibliothèque, la suppression la vidait : la séance
   s'ouvrait alors sur un `<select>` sans aucune option, et comme il est
   `required`, le navigateur refusait la soumission — l'essai attendait quinze
   secondes une série qui ne pouvait pas s'écrire. C'était l'essai qui se
   privait de sa propre prémisse, pas l'écran qui cessait de marcher.

   (Que cette séance n'ait rien à dire quand la bibliothèque est vide est en
   revanche une anomalie de l'écran, et elle est consignée comme telle.)
*/
/*
   Le repos du geste ne gêne plus cette seconde création : depuis le 19/10, il
   est indexé par le contrôle ET par les données, et ce second exercice ne
   porte ni le même nom ni le même muscle que le premier. Avant ce correctif,
   la soumission était écartée en silence — le clic avait lieu, l'événement
   « submit » avait lieu, et rien ne s'écrivait.
*/
await page.click('#ouvrir-ajout');
await page.waitForSelector('#fenetre-ajout[open]', { timeout: 15000 });
await page.fill('#nom', 'Presse essai');
/* Un exercice sollicite au moins un muscle principal — `controlerExercice`
   le refuse sinon, et l'écran a raison de le refuser. */
await page.selectOption('[data-case="quadriceps"]', 'principal');
await page.click('#ajout button[type="submit"]');
/*
   Le troisième argument, et non le second : `waitForFunction(fn, arg, options)`
   — passer les options à la place de l'argument laissait le délai par défaut
   de 30 s, et l'essai mettait deux fois le temps annoncé à échouer.
*/
await page.waitForFunction(
  () => [...document.querySelectorAll('#liste p')].some((p) => p.textContent.includes('Presse essai')),
  undefined,
  { timeout: 15000 },
);
/*
   Au moins deux, et non deux : `installerBibliotheque()` pose une
   bibliothèque fournie au déverrouillage. Figer son compte ici le ferait
   rougir au premier exercice ajouté à la bibliothèque livrée ; ce qui
   compte est qu'il reste de quoi tenir une séance après la suppression.
*/
vrai(
  'au moins deux exercices sont en bibliothèque avant la suppression',
  (await page.evaluate(() => document.querySelectorAll('#liste [data-exercice]').length)) >= 2,
);

/* ── « Supprimer » est derrière un menu, et pose une question ─────────── */
v(
  'aucun « Supprimer » n’est visible d’emblée sur les lignes',
  await page.evaluate(
    () =>
      [...document.querySelectorAll('#liste [data-supprimer]')].filter((b) => b.checkVisibility())
        .length,
  ),
  0,
);
v(
  'chaque ligne porte un menu d’actions nommé',
  await page.evaluate(() => {
    const cartes = [...document.querySelectorAll('#liste [data-exercice]')];
    const menus = cartes.map((c) => c.querySelector('.menu-actions > summary'));
    return {
      lignes: cartes.length > 0,
      tousUnMenu: menus.every((m) => m && (m.getAttribute('aria-label') ?? '').startsWith('Actions sur ')),
    };
  }),
  { lignes: true, tousUnMenu: true },
);

await page.click('#liste [data-exercice] .menu-actions > summary');
await page.waitForTimeout(200);
v(
  'ouvrir le menu montre « Supprimer »',
  await page.evaluate(() =>
    document.querySelector('#liste [data-supprimer]')?.checkVisibility() ?? false,
  ),
  true,
);

/*
   Le refus doit **garder** l'exercice : une suppression qui part quand même
   après un « Annuler » est pire que pas de confirmation du tout.
*/
const avantRefus = await page.evaluate(
  () => document.querySelectorAll('#liste [data-exercice]').length,
);
await page.click('#liste [data-supprimer]');
/* La confirmation est la boîte commune depuis la section C du 43, plus une
   fenêtre native : on y répond par le verbe du bouton. « Annuler », ici. */
await repondreALaBoite(page, 'Annuler');
await page.waitForTimeout(600);
v(
  'refuser la confirmation ne supprime rien',
  await page.evaluate(() => document.querySelectorAll('#liste [data-exercice]').length),
  avantRefus,
);

await page.click('#liste [data-exercice] .menu-actions > summary');
await page.click('#liste [data-supprimer]');
await repondreALaBoite(page, 'Supprimer cet exercice');
await page.waitForTimeout(800);
v(
  'accepter supprime une ligne',
  await page.evaluate(() => document.querySelectorAll('#liste [data-exercice]').length),
  avantRefus - 1,
);

/* ════════════════════════════════════════════════════════════════════════
   3. Une séance interrompue se reprend sans perte
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE SÉANCE INTERROMPUE SE REPREND SANS PERTE');

await page.goto(`${RACINE}/sport/seance/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
await page.click('#commencer');
await page.waitForSelector('#encours:not(.hidden)', { timeout: 15000 });

async function serie(repetitions, charge) {
  /*
     Ici l'attente reste nécessaire, et c'est voulu : deux séries de 8
     répétitions à 60 kg portent EXACTEMENT les mêmes données. Le repos de
     600 ms les prend donc pour un seul geste, ce qui est précisément son
     objet depuis que l'empreinte le distingue des gestes différents. Une
     main attend entre deux séries ; l'essai attend donc aussi.
  */
  await page.waitForTimeout(700);
  await page.fill('#charge', String(charge));
  await page.fill('#repetitions', String(repetitions));
  const avant = await page.$$eval('#series li', (l) => l.length);
  await page.click('#saisie button[type="submit"]');
  await page.waitForFunction(
    (n) => document.querySelectorAll('#series li').length > n,
    avant,
    { timeout: 15000 },
  );
}

await serie(8, 60);
await serie(8, 60);
v('deux séries sont enregistrées', await page.$$eval('#series li', (l) => l.length), 2);

/*
   On recharge **sans rien clore** : c'est le téléphone qui s'éteint. Rien
   d'autre n'est fait entre les deux, pour que ce qui survit ne survive que
   grâce à l'écriture à chaque série.
*/
await page.reload({ waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#encours:not(.hidden)', { timeout: 30000 });
v('la séance est reprise telle quelle', await page.$$eval('#series li', (l) => l.length), 2);
vrai(
  'et l’écran de repos n’est pas proposé',
  await page.evaluate(() => document.getElementById('repos').classList.contains('hidden')),
);

/* Le repos enregistré est le repos réel, mesuré, et non la cible affichée. */
await serie(6, 62.5);
const troisieme = await page.textContent('#series li:nth-child(3)');
vrai('la troisième série porte un repos mesuré', /de repos/.test(troisieme));
faux(
  'et ce n’est pas la cible de deux minutes',
  /2:00 de repos/.test(troisieme),
);

await page.click('#terminer');
await page.waitForSelector('#repos:not(.hidden)', { timeout: 15000 });
vrai(
  'la séance close apparaît dans l’historique',
  (await page.textContent('#dernieres')).includes('3 séries'),
);

/* ════════════════════════════════════════════════════════════════════════
   4. Le garde-fou se voit
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE DOULEUR DÉCLARÉE SE VOIT');

await page.goto(`${RACINE}/sport/corps/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
vrai(
  'rien n’est déclaré au départ',
  await page.locator('#aucune-ouverte').isVisible(),
);

/*
   Le premier « details » **du contenu**, et non de la page.

   Depuis que la barre de navigation groupe ses onglets dans des « details »,
   la page en porte trois avant le contenu : « details >> nth=0 » désignait
   un menu de l'en-tête, caché à cette largeur, et l'essai expirait sur un
   défaut qui n'existait pas. C'est le sélecteur qui était trop large.
*/
await page.click('#contenu-principal details >> nth=0');
await page.check('[data-muscle="pectoraux"]');
await page.click('#declarer');
await page.waitForFunction(
  () => document.querySelectorAll('#ouvertes [data-blessure]').length > 0,
  { timeout: 15000 },
);
v(
  'la blessure est ouverte',
  await page.getAttribute('#ouvertes [data-blessure]', 'data-ouverte'),
  'true',
);

await page.goto(`${RACINE}/sport/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
vrai('le tableau de bord l’annonce', await page.locator('#alerte').isVisible());
vrai(
  'et dit que rien ne sera proposé dessus',
  (await page.textContent('#alerte')).includes('Pectoraux'),
);

/* ════════════════════════════════════════════════════════════════════════ */
await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
