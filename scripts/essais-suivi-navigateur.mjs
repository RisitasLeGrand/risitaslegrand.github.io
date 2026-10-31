/**
 * Le suivi personnel, en navigateur : trois appuis, et des citations fidèles.
 *
 * Cinq garanties que le modèle seul ne peut pas donner :
 *
 * - **la liste des signes d'alerte est là module désactivé** (décision C) ;
 * - **chaque phrase affichée se retrouve dans la collecte** (règle 7), et
 *   c'est l'écran RENDU qu'on lit, pas la source du module ;
 * - **le 15 n'apparaît qu'au premier niveau** (règle 2), sur la page rendue ;
 * - **aucune couleur d'alarme** (règle 5) ;
 * - **trois appuis au plus** depuis l'ouverture du module (maquette 8.2).
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const PAGE = '/odyssee/corps/suivi/';
const PAGE_SIGNES = '/odyssee/corps/quand-consulter/';

/*
   LES BORNES DE LA MESURE D'EFFACEMENT, ET POURQUOI PAS « AUJOURD'HUI ».

   Le jour auquel une saisie se rattache est le **jour logique**
   (`noyau/jour-logique.ts`), qui bascule à une heure donnée : avant cette
   heure, le jour logique est la veille du jour civil. Un essai qui remplirait
   les deux bornes avec la date civile serait donc vert dans la journée et
   rouge la nuit — et son rouge ne dirait rien du code.

   La fenêtre couvre la veille et le lendemain : elle contient le jour logique
   quelle que soit l'heure, et elle mesure en plus une période de plusieurs
   jours, ce qui est le cas d'usage réel.
*/
const JOUR_MS = 86_400_000;
const dateCivile = (decalage) =>
  new Date(Date.now() + decalage * JOUR_MS).toISOString().slice(0, 10);
const VEILLE = dateCivile(-1);
const LENDEMAIN = dateCivile(1);

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 400)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 400)}`);
  }
};
const vrai = (titre, c) => v(titre, c, true);
const faux = (titre, c) => v(titre, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

/* Aucune requête ne doit sortir du site. Une donnée de cycle encore moins
   qu'une autre — et les adresses d'ameli sont des liens, pas des appels. */
const sorties = [];
page.on('request', (r) => {
  if (!r.url().startsWith(RACINE) && !r.url().startsWith('data:')) sorties.push(r.url());
});

const normaliser = (texte) =>
  texte
    .replace(/[’‘`´]/g, "'")
    .replace(/[    ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Les collectes, pour comparer l'écran rendu à sa source. */
const collectes = normaliser(
  readdirSync('docs/cyclades/collectes')
    .filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(join('docs/cyclades/collectes', f), 'utf8'))
    .join('\n'),
);

await franchirInitialisation(page, RACINE, MDP);

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

/* ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. L’ADRESSE DIRECTE NE MONTRE RIEN, COFFRE FERMÉ ET SANS RÉPONSE');

/*
   CETTE SECTION A CHANGÉ DE SENS LE 19 OCTOBRE, et il faut le dire ici parce
   qu'un essai réécrit sans explication ressemble à un essai affaibli.

   Elle mesurait que « les signes d'alerte sont là coffre fermé et module
   désactivé » — c'était la réponse à la collecte D2 : une personne qui saigne
   beaucoup lisait les trois niveaux et les quatre sources sans rien
   déverrouiller. Décision d'Alexis : le suivi, signes d'alerte compris,
   n'apparaît que pour un sexe féminin déclaré, et pas coffre fermé puisque la
   réponse ne peut alors pas être lue. L'écart et ce qu'il coûte sont consignés
   dans `docs/cyclades/decisions-en-attente-cycle-2026-10-19.md`.

   Le sélecteur d'attente est `#hors-portee`, qui est rendu — et non
   `#dans-la-portee`, qui est masqué. On attend ce qui doit paraître.
*/
await aller(PAGE, '#hors-portee');
{
  vrai('la page neutre est là', await page.locator('#hors-portee').isVisible());
  faux('et le suivi n’est pas rendu', await page.locator('#dans-la-portee').isVisible());
  v(
    'et la page du suivi ne porte plus les signes d’alerte : ils ont leur page',
    await page.locator('#signes').count(),
    0,
  );
  faux('ni le formulaire du coffre', await page.locator('#coffre-ferme').isVisible());

  /*
     LES MOTS, SUR LE TEXTE QU'UN ŒIL LIT — donc `innerText` et non
     `textContent`.

     MESURÉ, PARCE QUE JE L'AVAIS ÉCRIT FAUX : `textContent` rend aussi le
     texte des éléments CACHÉS, donc tout le module, donc « règles ». La
     première version de cet essai a rougi sur sa propre méthode.

     Et ce rouge a dit quelque chose de vrai, qu'il faut écrire plutôt que de
     le faire taire : LE MASQUAGE EST VISUEL. Le HTML servi à cette adresse
     contient le module entier, quelle que soit la réponse — `#dans-la-portee`
     est caché par une classe, pas absent. Quelqu'un qui lit le source de la
     page le voit. Pour qu'il en soit autrement, il faudrait que ce contenu ne
     soit pas rendu côté serveur mais injecté après la décision, ce qui est un
     autre chantier. C'est inscrit dans
     `docs/cyclades/decisions-en-attente-cycle-2026-10-19.md`.

     « suivi » n'est pas interdit — nom neutre de la décision 20, et l'adresse
     le porte de toute façon ; Alexis interdit « cycle ».
  */
  const rendu = normaliser(
    await page.evaluate(() => document.querySelector('main')?.innerText ?? ''),
  );
  v(
    'et rien dans le texte rendu ne trahit ce qu’elle cache',
    ['cycle', 'règles', 'menstruel', 'féminin', 'masculin', 'sexe'].filter((mot) =>
      new RegExp(mot, 'i').test(rendu),
    ),
    [],
  );
  vrai('elle renvoie vers Corps', (await page.locator('a[href="/odyssee/corps/"]').count()) > 0);
}

console.log('\n2. LA LIGNE DE CORPS N’EXISTE QUE POUR UNE RÉPONSE FÉMININE');

/*
   Le sélecteur d'attente est propre à la page, et pas `h1` : le verrou du
   site porte le sien, donc `h1` résout deux éléments et Playwright attend que
   le premier — celui du verrou, devenu caché — redevienne visible. Il attend
   pour toujours, et le message parle d'un délai dépassé plutôt que de la
   cause.
*/
/*
   On attend `#mdp-coffre`, qui EST visible coffre fermé — et non
   `#ligne-du-suivi`, qui doit justement rester caché. Attendre ce qui ne doit
   pas paraître fait expirer l'essai en parlant d'un délai plutôt que d'un
   défaut.
*/
await aller('/odyssee/corps/', '#mdp-coffre');
{
  faux('coffre fermé, aucune ligne ne mène au suivi', await page.locator('#ligne-du-suivi').isVisible());

  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  await page.waitForSelector('#reponses-sexe', { state: 'visible', timeout: 20000 });
  faux(
    'coffre ouvert mais sans réponse, toujours aucune ligne',
    await page.locator('#ligne-du-suivi').isVisible(),
  );

  /* Masculin : rien. C'est la ligne que la décision d'Alexis demande. */
  await page.click('#reponses-sexe button[data-sexe="masculin"]');
  await page.waitForFunction(
    () => document.getElementById('sexe-dit')?.textContent?.includes('Masculin') === true,
    { timeout: 20000 },
  );
  faux('réponse masculine : aucune ligne', await page.locator('#ligne-du-suivi').isVisible());

  /* Un refus de répondre : rien non plus, et la réponse est gardée. */
  await page.click('#reponses-sexe button[data-sexe="sans-reponse"]');
  await page.waitForFunction(
    () => document.getElementById('sexe-dit')?.textContent?.includes('préfère') === true,
    { timeout: 20000 },
  );
  faux('refus de répondre : aucune ligne', await page.locator('#ligne-du-suivi').isVisible());

  /* Et l'adresse directe reste neutre tant que la réponse n'est pas féminine. */
  await aller(PAGE, '#hors-portee');
  vrai(
    'et l’adresse directe reste neutre, coffre ouvert',
    await page.locator('#hors-portee').isVisible(),
  );
  faux('le suivi n’est toujours pas rendu', await page.locator('#dans-la-portee').isVisible());

  /* Féminin : la ligne paraît, et son libellé reste neutre. */
  await aller('/odyssee/corps/', '#reponses-sexe');
  await page.click('#reponses-sexe button[data-sexe="feminin"]');
  await page.waitForFunction(
    () => document.getElementById('ligne-du-suivi')?.classList.contains('hidden') === false,
    { timeout: 20000 },
  );
  vrai('réponse féminine : la ligne paraît', await page.locator('#ligne-du-suivi').isVisible());

  const lien = page.locator('a[href="/odyssee/corps/suivi/"]');
  vrai('une ligne mène au suivi', (await lien.count()) > 0);
  v('et son libellé est neutre', normaliser(await lien.first().textContent()), 'suivi personnel');
  /*
     LA DISCRÉTION DE 4.8, MESURÉE SUR L'ÉCRAN QUI PORTE LA PORTE. Le mot
     « règles » ne doit pas apparaître hors du module — et `corps.astro` est
     hors du module.
  */
  const corps = normaliser(await page.textContent('main'));
  faux('et l’écran Corps ne dit pas « règles »', /\brègles?\b/i.test(corps));
}

console.log('\n2 ter. « QUAND CONSULTER » EST ACCESSIBLE SANS CONDITION');

/*
   Choix d'Alexis du 19 octobre vers 17 h 10 — l'option 2. La restriction porte
   sur le suivi ; « Quand consulter » reste accessible sans coffre, sans
   déclaration, quel que soit le sexe.

   La réponse enregistrée est « Féminin » à ce point de l'essai. On la remet
   donc à « Masculin » pour mesurer le cas qui compte, puis on referme le
   coffre : si la page s'ouvre dans ces conditions, elle s'ouvre pour tout le
   monde.
*/
await aller('/odyssee/corps/', '#reponses-sexe');
await page.click('#reponses-sexe button[data-sexe="masculin"]');
await page.waitForFunction(
  () => document.getElementById('ligne-du-suivi')?.classList.contains('hidden') === true,
  { timeout: 20000 },
);
vrai(
  'la ligne « Quand consulter » reste visible pour une réponse masculine',
  await page.locator('a[href="/odyssee/corps/quand-consulter/"]').first().isVisible(),
);
await page.click('#fermer-coffre');
await page.waitForSelector('#mdp-coffre', { state: 'visible', timeout: 20000 });
vrai(
  'et elle reste visible coffre refermé',
  await page.locator('a[href="/odyssee/corps/quand-consulter/"]').first().isVisible(),
);

await aller(PAGE_SIGNES, '#signes');
{
  vrai('la page s’ouvre, coffre fermé et réponse masculine', await page.locator('#signes').isVisible());
  faux('aucun formulaire de coffre n’y est demandé', await page.locator('#mdp-coffre').isVisible());

  /*
     ET ELLE NE SAIT PAS QUE LE SUIVI EXISTE. Pas de lien, pas même
     conditionnel : un lien qui paraît pour certaines personnes et pas pour
     d'autres est ce qui se remarque quand on compare deux écrans.
  */
  v(
    'aucun lien vers le suivi',
    await page.locator('a[href="/odyssee/corps/suivi/"]').count(),
    0,
  );
  const rendu = normaliser(
    await page.evaluate(() => document.querySelector('main')?.innerText ?? ''),
  );
  v(
    'et aucune mention de son existence',
    ['suivi personnel', 'cycle', 'menstruel'].filter((mot) => new RegExp(mot, 'i').test(rendu)),
    [],
  );
}

console.log('\n3. CHAQUE PHRASE RENDUE SE RETROUVE DANS LA COLLECTE (RÈGLE 7)');

{
  /*
     On lit les CITATIONS DE L'ÉCRAN, pas celles du module. La différence est
     tout l'intérêt : `essais:signes-alerte` garde le module, celui-ci garde
     ce que le navigateur montre — après le gabarit Astro, après les
     guillemets ajoutés par la mise en page, après tout ce qui peut se glisser
     entre une constante et un écran.
  */
  const citations = await page.$$eval('#signes li, #signes p', (noeuds) =>
    noeuds
      .map((n) => n.textContent ?? '')
      .filter((t) => t.includes('«') && t.includes('»')),
  );
  vrai('l’écran rend des citations', citations.length >= 20);

  const introuvables = [];
  for (const brute of citations) {
    /* Le texte entre guillemets, sans la mention « (source n) » qui suit. */
    const entre = brute.match(/«([^»]*)»/);
    if (!entre) continue;
    const texte = normaliser(entre[1]);
    if (texte.length < 12) continue;
    /* La seule correction permise par la règle 1, défaite pour la comparaison. */
    const commeDansLaSource = texte.replace(
      normaliser('votre vie quotidienne'),
      normaliser('votre votre vie quotidienne'),
    );
    if (!collectes.includes(texte) && !collectes.includes(commeDansLaSource)) {
      introuvables.push(texte.slice(0, 80));
    }
  }
  v(`les ${citations.length} citations rendues sont dans la collecte`, introuvables, []);
}

console.log('\n4. LE 15 N’EST QU’AU PREMIER NIVEAU, SUR LA PAGE RENDUE (RÈGLE 2)');

{
  const parNiveau = await page.$$eval('[data-niveau-alerte]', (noeuds) =>
    noeuds.map((n) => ({ id: n.dataset.niveauAlerte, texte: n.textContent ?? '' })),
  );
  v('trois niveaux sont rendus', parNiveau.length, 3);
  const quinze = /(?<![\d,.])15(?![\d,.])/;
  vrai(
    'le premier le nomme',
    quinze.test(parNiveau.find((n) => n.id === 'urgence-15')?.texte ?? ''),
  );
  v(
    'et aucun des deux autres ne le nomme',
    parNiveau.filter((n) => n.id !== 'urgence-15' && quinze.test(n.texte)).map((n) => n.id),
    [],
  );
}

console.log('\n5. LA SOURCE 5 N’APPARAÎT PAS, ET LES QUATRE AUTRES SONT DATÉES');

{
  const tout = normaliser(await page.textContent('main'));
  faux('aucune mention « source 5 »', /source 5\b/i.test(tout));
  faux('et aucune de ses phrases', tout.includes(normaliser('La jeune fille apprendra')));
  faux('ni la HAS', /has-sante|PNDS/i.test(tout));

  for (const date of ['25 juin 2026', '25 juin 2025', '29 septembre 2026', '08 décembre 2025']) {
    vrai(`la date « ${date} » est visible`, tout.includes(date));
  }
  vrai('la date de collecte est visible', tout.includes('19 octobre 2026'));
  /*
     RÈGLE 4 : « pas de lien qui sortirait du coffre sans le dire ». Les liens
     vers ameli existent — on doit pouvoir vérifier une source — et chacun dit
     qu'il sort.
  */
  const liens = await page.$$eval('#signes a[href^="https://"]', (a) =>
    a.map((n) => ({ hote: new URL(n.href).host, cible: n.target })),
  );
  v('quatre liens de source, tous vers ameli', liens.length, 4);
  v('et tous ouverts hors de Cyclades', liens.filter((l) => l.cible !== '_blank'), []);
  vrai('et la page dit qu’ils sortent', tout.includes('hors de Cyclades'));
}

console.log('\n6. AUCUNE COULEUR D’ALARME (RÈGLE 5)');

{
  /*
     Le balayage porte sur les classes de la section, et non sur une capture :
     une couleur se décide dans une classe, et c'est là qu'on la voit. Les
     familles « erreur » du dépôt — rouge et rose — ne doivent pas y être.
  */
  const classes = await page.$$eval('#signes, #signes *', (noeuds) =>
    noeuds.map((n) => n.className).filter((c) => typeof c === 'string').join(' '),
  );
  const alarmantes = ['red-', 'rose-', 'bg-red', 'text-red', '--etat-erreur'];
  v(
    'aucune classe d’erreur dans la section',
    alarmantes.filter((a) => classes.includes(a)),
    [],
  );
}

/*
   ══ RETOUR DANS LA PORTÉE ════════════════════════════════════════════════

   La section 2 ter a refermé le coffre et remis la réponse à « Masculin »
   pour mesurer l'accès sans condition. Les sections qui suivent mesurent le
   MODULE, donc il faut repasser par le chemin d'une personne concernée :
   ouvrir le coffre sur Corps, répondre « Féminin », puis aller au suivi.

   C'est écrit en clair plutôt que caché dans un utilitaire : un essai dont on
   ne voit pas dans quel état il place le site mesure autre chose que ce qu'il
   annonce, et c'est ainsi qu'on croit avoir vérifié un cas qu'on n'a jamais
   atteint.
*/
await aller('/odyssee/corps/', '#mdp-coffre');
await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
await page.waitForSelector('#reponses-sexe', { state: 'visible', timeout: 20000 });
await page.click('#reponses-sexe button[data-sexe="feminin"]');
await page.waitForFunction(
  () => document.getElementById('ligne-du-suivi')?.classList.contains('hidden') === false,
  { timeout: 20000 },
);
await aller(PAGE, '#dans-la-portee');

console.log('\n7. DEUX APPUIS DEPUIS L’OUVERTURE DU MODULE (MAQUETTE 8.2)');

{
  /*
     LE COMPTE EST PASSÉ DE TROIS À DEUX, ET CE N'EST PAS UN GAIN.

     Les appuis étaient comptés depuis l'arrivée sur l'écran, le
     déverrouillage du coffre compris, parce que la personne ne choisit pas de
     le faire :
       1. ouvrir le coffre
       2. activer le suivi
       3. choisir un niveau

     Depuis la décision d'Alexis, cet écran ne peut plus proposer d'ouvrir le
     coffre : hors de portée, il ne rend que la page neutre, et il est hors de
     portée tant que la réponse n'a pas pu être lue — c'est-à-dire tant que le
     coffre est fermé. Le déverrouillage a donc lieu AILLEURS, sur l'écran
     Corps, où la question est posée. Il reste deux appuis ici, et un appui de
     plus avant d'arriver.

     Le `FormulaireCoffre` de cette page est devenu inatteignable. Il est
     laissé en place parce qu'il redeviendrait le bon chemin si la condition
     changeait, et parce que le retirer serait un changement de gabarit dont
     personne n'a besoin aujourd'hui. Mais il faut le savoir : c'est du
     gabarit qui ne sert plus, et la maquette 8.2 est tenue à deux appuis, pas
     à trois.
  */
  let appuis = 0;
  faux('le formulaire du coffre n’est plus atteignable ici', await page.locator('#coffre-ferme').isVisible());
  vrai('le coffre est déjà ouvert, depuis Corps', await page.locator('#coffre-ouvert').isVisible());

  vrai('le module s’annonce inactif', await page.locator('#bloc-inactif').isVisible());
  faux('et rien n’est saisissable', await page.locator('#bloc-actif').isVisible());

  /*
     LES CIBLES DU BLOC INACTIF SE MESURENT ICI, ET PAS PLUS BAS.

     Ma première version les mesurait avec celles du bloc actif, à la fin —
     c'est-à-dire quand le bloc inactif est caché, donc de hauteur nulle, donc
     écarté par le filtre `h > 0`. Le bouton « Activer ce suivi » n'était
     jamais mesuré, et le sabotage qui le rapetissait ne faisait rien rougir.

     Un essai qui mesure un élément caché ne mesure rien. Chaque bloc est donc
     mesuré au moment où il est à l'écran.
  */
  v(
    'les cibles du bloc inactif font au moins 44 px (D-009)',
    await page.$$eval('#bloc-inactif button', (boutons) =>
      boutons
        .map((b) => ({
          texte: (b.textContent ?? '').trim().slice(0, 28),
          h: b.getBoundingClientRect().height,
        }))
        .filter((b) => b.h < 44),
    ),
    [],
  );

  await page.click('#activer');
  appuis += 1;
  await page.waitForSelector('#bloc-actif', { state: 'visible', timeout: 20000 });

  await page.click('#niveaux button[data-niveau="moyen"]');
  appuis += 1;
  await page.waitForFunction(
    () => (document.getElementById('confirmation')?.textContent ?? '').length > 0,
    { timeout: 20000 },
  );

  v('deux appuis, pas plus', appuis, 2);
  v(
    'la confirmation est neutre',
    normaliser(await page.textContent('#confirmation')),
    'Saisie enregistrée.',
  );
  v(
    'le niveau choisi est marqué',
    await page.getAttribute('#niveaux button[data-niveau="moyen"]', 'aria-pressed'),
    'true',
  );

  /* Et une saisie de plus ne coûte qu'un appui. */
  await page.click('#niveaux button[data-niveau="traces"]');
  await page.waitForFunction(
    () => document.querySelector('#niveaux button[data-niveau="traces"]')?.getAttribute('aria-pressed') === 'true',
    { timeout: 20000 },
  );
  v(
    'un changement coûte un seul appui',
    await page.getAttribute('#niveaux button[data-niveau="moyen"]', 'aria-pressed'),
    'false',
  );
}

console.log('\n8. LES CIBLES TACTILES ET LA DÉSACTIVATION');

{
  /*
     Le bloc ACTIF, ici visible. Pas de filtre sur `h > 0` : tout bouton de ce
     bloc est à l'écran à ce moment-là, et en écarter un de hauteur nulle
     reviendrait à ne pas le mesurer.

     MESURÉ, PARCE QUE JE L'AURAIS SUPPOSÉ DE TRAVERS : un bouton dans un
     `<details>` FERMÉ garde `display: inline-block` et ses 44 px — Chromium
     ne met pas sa boîte à zéro. Les boutons repliés sont donc bien mesurés
     sans qu'on déplie, et le filtre absent ne cache rien.

     `#effacer-periode`, lui, est caché par `class="hidden"` — donc
     `display: none`, donc 0 — tant qu'aucun comptage n'a eu lieu. Il faut
     l'offrir avant de le mesurer, sinon on mesure un bouton que personne ne
     peut toucher : exactement la faute que la note du bloc inactif raconte.
  */
  /*
     Le replié s'ouvre comme une personne l'ouvrirait. Mesuré aussi, et c'est
     l'autre moitié de la surprise ci-dessus : `getBoundingClientRect` donne
     bien 44 px à un bouton replié, mais Playwright REFUSE de remplir un champ
     qu'il juge invisible. Les deux ont raison chacun à leur façon, et il
     fallait le constater plutôt que de supposer l'un depuis l'autre.
  */
  await page.click('#replier-effacement summary');
  await page.fill('#effacer-du', VEILLE);
  await page.fill('#effacer-au', LENDEMAIN);
  await page.click('#compter-periode');
  await page.waitForSelector('#effacer-periode', { state: 'visible', timeout: 20000 });

  const trop = await page.$$eval('#bloc-actif button', (boutons) =>
    boutons
      .map((b) => ({ texte: (b.textContent ?? '').trim().slice(0, 28), h: b.getBoundingClientRect().height }))
      .filter((b) => b.h < 44),
  );
  v('les cibles du bloc actif font au moins 44 px (D-009)', trop, []);

  await page.click('#desactiver');
  await page.waitForSelector('#bloc-inactif', { state: 'visible', timeout: 20000 });
  vrai('désactiver ramène au bloc inactif', await page.locator('#bloc-inactif').isVisible());
  /*
     DÉSACTIVER N'EFFACE RIEN, et c'est la nuance que l'écran promet. On
     réactive et on vérifie que la saisie est toujours là.
  */
  await page.click('#activer');
  await page.waitForSelector('#bloc-actif', { state: 'visible', timeout: 20000 });
  v(
    'et la saisie a survécu à la désactivation',
    await page.getAttribute('#niveaux button[data-niveau="traces"]', 'aria-pressed'),
    'true',
  );
  /*
     Les signes d'alerte ne sont plus sur cette page — ils ont la leur, sans
     condition. Ce qui doit rester après une désactivation est le MODULE
     atteignable, et c'est ce qui est mesuré juste au-dessus.
  */
  v('et les signes ne sont pas revenus ici', await page.locator('#signes').count(), 0);
}

console.log('\n8 bis. CE QUE CYCLADES A OBSERVÉ — LE MODULE EST VRAIMENT APPELÉ');

/*
   POURQUOI CETTE SECTION EXISTE, ET CE QU'UN ESSAI DE NŒUD NE POUVAIT PAS DIRE.

   `odyssee/cycles.ts` existait depuis le 19 octobre sans qu'aucun écran
   l'appelle : ses portes refusaient tant que les chiffres de produit n'étaient
   pas tranchés. Six le sont depuis le 25 octobre, le module est branché à cet
   écran, et son exception d'orphelin est retirée.

   `essais:orphelins` ne suffit pas à le garder : il suit les IMPORTS, pas les
   appels. Mesuré par sabotage — retirer l'appel à `peindreCeQuiEstObserve()` en
   laissant l'import laissait `essais:orphelins` ET `essais:cycles` au vert,
   pour un écran qui n'affichait plus rien. Un module importé et jamais appelé
   est un orphelin que le garde-fou ne voit pas.

   C'est donc ici, sur la page peinte, que le branchement se tient.
*/
{
  /*
     UN SEUL JOUR NE FAIT PAS UN CYCLE, ET C'EST CE QUE CETTE SECTION MESURE.

     Ma première version cliquait « premier jour », attendait un cycle, et
     obtenait zéro. Le module avait raison : un J1 demande DEUX jours civils
     consécutifs de saignement net — `jours-pour-ouvrir` vaut 2 —, et les
     traces isolées n'en ouvrent aucun (décision 8). L'écran ne note que le
     jour courant, donc un seul jour est tout ce qu'un essai de navigateur peut
     saisir sans écrire en base à la place du module.

     Ce cas vaut d'être tenu pour lui-même : c'est l'état d'une personne qui
     vient de commencer, et l'écran doit lui dire la RÈGLE plutôt que de lui
     demander de noter ce qu'elle vient de noter. La phrase a été corrigée pour
     cela, et ce constat la garde.
  */
  await page.click('#debut');
  await page.waitForTimeout(1200);

  vrai('le bloc des cycles observés s’affiche', await page.locator('#bloc-observe').isVisible());

  const cartes = await page.locator('#observe-cycles li').count();
  v('un seul jour ne reconstitue aucun cycle', cartes, 0);

  const vide = (await page.locator('#observe-vide').innerText().catch(() => '')) ?? '';
  vrai('et l’écran dit la règle des jours consécutifs', /2 jours de suite/.test(vide));

  /*
     AUCUNE FICHE DE CYCLE N'EST PROPOSÉE ICI, ET C'EST LA RÈGLE.

     La fiche du § 8.3 ne s'ouvre que pour un cycle CLOS : ses facteurs portent
     sur une fenêtre dont la fin doit être connue, sinon la couverture
     s'afficherait « sur 31 » avec un dénominateur inventé. Un cycle en cours,
     ou aucun cycle, n'en reçoit donc aucune.

     Ce que cet essai ne peut PAS mesurer, et qui est dit plutôt que tu : la
     fiche elle-même. L'écran ne note que le jour courant, donc aucun cycle clos
     n'est atteignable depuis un navigateur sans écrire en base à la place du
     module — ce qui mesurerait le semis et non l'écran. Le contenu de la fiche
     est tenu par `essais:facteurs-cycle`, sur les fonctions pures.
  */
  v('aucune fiche de cycle n’est proposée sans cycle clos', await page.locator('#observe-cycles details').count(), 0);
  vrai('en nommant les traces isolées', /traces isolées/.test(vide));
  faux(
    'il ne demande pas de noter un jour qui vient d’être noté',
    /il faut au moins un premier jour/.test(vide),
  );

  /*
     LES STATISTIQUES REFUSENT, ET L'ÉCRAN NOMME LE CHIFFRE QUI MANQUE. C'est
     la 8ᵉ valeur, celle dont le 4.4.2 dit que le repère FIGO n'a pas été lu.
     Une section absente passerait pour un oubli, une section vide pour une
     panne.
  */
  const refusStats = (await page.locator('#observe-statistiques').innerText().catch(() => '')) ?? '';
  vrai('le refus des statistiques est affiché', await page.locator('#observe-statistiques').isVisible());
  vrai('et il nomme la fenêtre d’étude', /fenetre-par-defaut/.test(refusStats));
  vrai('en disant qu’un repère doit être relu à sa source', /source/.test(refusStats));

  /*
     LA DÉCISION 12, NON LEVABLE, MESURÉE SUR LA PAGE RENDUE. Aucune fenêtre
     fertile, aucune ovulation, aucune date à venir. On lit `innerText` et non
     `textContent` : le second rend aussi ce qui est caché, et un mot interdit
     masqué resterait un mot interdit servi au navigateur.
  */
  const toutLeBloc = (await page.locator('#bloc-observe').innerText()) ?? '';
  for (const interdit of ['fertile', 'ovulation', 'féconda', 'prévision', 'prochaines règles']) {
    faux(`le mot « ${interdit} » n’apparaît pas`, new RegExp(interdit, 'i').test(toutLeBloc));
  }
  /*
     Et les trois libellés du 4.5 sont les seuls noms de fenêtre employés. On ne
     peut pas les voir sur un cycle en cours — ils ne s'établissent qu'a
     posteriori —, donc ce constat dit ce qu'il mesure : aucun AUTRE nom de
     fenêtre n'est inventé ici.
  */
  faux('aucun nom de fenêtre n’est inventé', /phase (lutéale|folliculaire)/i.test(toutLeBloc));
}

console.log('\n9. L’EFFACEMENT PAR PÉRIODE EST UNE PURGE PHYSIQUE');

{
  /*
     La partie 1 point 10 du prompt 30 demande que le suivi soit « effaçable
     par période par purge physique ». Ce qui est mesuré ici est la purge
     elle-même, dans la base : combien de clés le journal porte avant, combien
     après. Pas le texte d'une confirmation — une confirmation peut dire
     « effacé » sans que rien ne le soit.

     Pourquoi cela ne pouvait pas se mesurer ailleurs : `effacerLaPeriode`
     demande le coffre, donc une base ouverte et une clé en mémoire. Node n'en
     a pas, et le projet n'a pas de base en mémoire pour les essais.

     Le comptage des clés est fait par `indexedDB` depuis la page, et non par
     le module : si l'essai demandait au module combien il reste, il
     mesurerait le module avec lui-même.
  */
  const clefsDuJournal = () =>
    page.evaluate(
      () =>
        new Promise((resolve, rejeter) => {
          const demande = indexedDB.open('revinsp');
          demande.onerror = () => rejeter(demande.error);
          demande.onsuccess = () => {
            const base = demande.result;
            const tx = base.transaction('odysseeCycleJournal', 'readonly');
            const clefs = tx.objectStore('odysseeCycleJournal').getAllKeys();
            clefs.onsuccess = () => {
              resolve(clefs.result.map(String));
              base.close();
            };
            clefs.onerror = () => rejeter(clefs.error);
          };
        }),
    );

  const avant = await clefsDuJournal();
  v('une saisie, une clé dans le journal', avant.length, 1);
  /*
     La forme de la clé, et rien de plus ici : qu'aucune forme du jour ne s'y
     lise est mesuré sur toutes les écritures possibles de la date par
     `essais:cycle-confidentialite` (section 2). Chercher « 2026 » dans
     trente-deux signes hexadécimaux le trouverait une fois sur deux mille
     par hasard, et un essai qui rougit une fois sur deux mille est pire
     qu'aucun essai.
  */
  v('et la clé est une empreinte de 32 signes', /^[0-9a-f]{32}$/.test(avant[0]), true);

  /*
     La période est rouverte — la section 8 l'a déjà remplie pour mesurer le
     bouton, et son comptage reste valable.
  */
  await page.fill('#effacer-du', VEILLE);
  await page.fill('#effacer-au', LENDEMAIN);
  /*
     On efface l'annonce avant de compter, et l'on attend qu'elle soit
     RÉÉCRITE — au lieu d'attendre que « #effacer-periode » soit visible.

     Ce bouton l'est déjà : la section 8 a rempli la période pour mesurer le
     bouton, et le commentaire ci-dessus le dit. L'attente était donc vraie
     avant le clic. Or le gestionnaire attend « combienDansLaPeriode », et
     pendant cet await le bouton est toujours visible et l'annonce porte
     toujours le texte de la section 8 : la lecture rendait l'état précédent.
     C'est le défaut trouvé sur « reglages-sans-coffre » et sur son jumeau,
     mais il est ici LATENT et non actif, ce qui a été mesuré : un retard de
     500 ms injecté dans la fenêtre d'await laisse l'ancienne version au VERT.
     La raison est que la section 8 compte la même période, aux mêmes dates, et
     laisse donc dans l'annonce exactement la phrase attendue ici. La lecture
     périmée rend la bonne réponse par construction.

     L'assertion ne prouvait donc rien, sans pour autant mentir. On la rend
     véritable plutôt que d'attendre le jour où les deux textes différeraient —
     un contrôle qui ne contrôle rien finit par rassurer. Effacer d'abord donne
     une post-condition qu'aucun passage antérieur ne peut avoir rendue vraie,
     et le bouton, lui, est vérifié explicitement.
  */
  await page.evaluate(() => {
    const e = document.getElementById('effacement-dit');
    if (e) e.textContent = '';
  });
  await page.click('#compter-periode');
  await page.waitForFunction(
    () => (document.getElementById('effacement-dit')?.textContent ?? '').trim().length > 0,
    undefined,
    { timeout: 20000 },
  );
  v('le bouton d’effacement de la période est proposé', await page.locator('#effacer-periode').isVisible(), true);
  v(
    'le comptage annonce la saisie avant d’effacer',
    normaliser(await page.textContent('#effacement-dit')),
    'Cette période porte une saisie.',
  );

  await page.click('#effacer-periode');
  await page.waitForFunction(
    () => (document.getElementById('effacement-dit')?.textContent ?? '').includes('effacée'),
    { timeout: 20000 },
  );
  v(
    'et le compte rendu dit ce qui est parti',
    normaliser(await page.textContent('#effacement-dit')),
    'Une saisie effacée.',
  );

  const apres = await clefsDuJournal();
  v('la clé n’est plus dans la base : la purge est physique', apres, []);
  v(
    'et l’écran ne montre plus de niveau choisi',
    await page.getAttribute('#niveaux button[data-niveau="traces"]', 'aria-pressed'),
    'false',
  );

  /*
     Une période sans saisie ne propose pas d'effacer : le bouton reste caché,
     et le message le dit. Sinon la personne appuierait sur « Effacer ces
     saisies » pour rien, et ne saurait pas si quelque chose est parti.
  */
  await page.fill('#effacer-du', '2020-01-01');
  await page.fill('#effacer-au', '2020-01-31');
  await page.click('#compter-periode');
  await page.waitForFunction(
    () => (document.getElementById('effacement-dit')?.textContent ?? '').length > 0,
    { timeout: 20000 },
  );
  v(
    'une période vide le dit',
    normaliser(await page.textContent('#effacement-dit')),
    'Aucune saisie dans cette période.',
  );
  faux(
    'et n’offre pas d’effacer',
    await page.locator('#effacer-periode').isVisible(),
  );

  /* Des bornes à l'envers sont refusées avant toute écriture. */
  await page.fill('#effacer-du', '2026-05-10');
  await page.fill('#effacer-au', '2026-05-01');
  await page.click('#compter-periode');
  v(
    'des bornes à l’envers sont refusées',
    normaliser(await page.textContent('#effacement-dit')),
    'La seconde date est avant la première.',
  );
}

console.log('\n10. CHANGER DE RÉPONSE MASQUE, SANS RIEN EFFACER');

{
  /*
     Point 5 de la décision d'Alexis : « Si une personne passe de "Féminin" à
     une autre réponse, les données du cycle déjà saisies ne sont ni effacées
     ni montrées. Le suivi est seulement masqué. »

     C'est la promesse la plus facile à casser sans le voir : il suffirait
     qu'un écran efface « pour faire propre », ou que le masquage passe par un
     effacement du magasin. Elle se mesure donc dans la base, et en deux
     temps : masquer, puis revenir, et retrouver la saisie.

     La section 9 a effacé la saisie du jour ; on en refait une, d'un appui.
  */
  await page.click('#niveaux button[data-niveau="moyen"]');
  await page.waitForFunction(
    () =>
      document.querySelector('#niveaux button[data-niveau="moyen"]')?.getAttribute('aria-pressed') ===
      'true',
    { timeout: 20000 },
  );

  const combien = () =>
    page.evaluate(
      () =>
        new Promise((resolve, rejeter) => {
          const demande = indexedDB.open('revinsp');
          demande.onerror = () => rejeter(demande.error);
          demande.onsuccess = () => {
            const base = demande.result;
            const tx = base.transaction('odysseeCycleJournal', 'readonly');
            const compte = tx.objectStore('odysseeCycleJournal').count();
            compte.onsuccess = () => {
              resolve(compte.result);
              base.close();
            };
            compte.onerror = () => rejeter(compte.error);
          };
        }),
    );

  v('une saisie existe', await combien(), 1);

  /* On passe à « Masculin ». */
  await aller('/odyssee/corps/', '#reponses-sexe');
  await page.click('#reponses-sexe button[data-sexe="masculin"]');
  await page.waitForFunction(
    () => document.getElementById('ligne-du-suivi')?.classList.contains('hidden') === true,
    { timeout: 20000 },
  );
  faux('la ligne de Corps disparaît', await page.locator('#ligne-du-suivi').isVisible());

  await aller(PAGE, '#hors-portee');
  vrai('et l’adresse directe ne montre plus rien', await page.locator('#hors-portee').isVisible());
  faux('le suivi n’est pas rendu', await page.locator('#dans-la-portee').isVisible());

  /*
     ET LE BLOC DES CYCLES OBSERVÉS NON PLUS — NOMMÉMENT.

     Il est à l'intérieur de `#dans-la-portee`, donc le constat ci-dessus le
     couvre déjà par transitivité. Il est pourtant nommé ici, parce que c'est
     une décision d'Alexis — « le cycle ne s'affiche QUE pour un profil
     féminin » — et qu'une garantie tenue par transitivité tombe sans bruit le
     jour où quelqu'un déplace le bloc hors du conteneur. Un essai qui nomme la
     chose survit au déplacement.

     On lit `innerText` et non `textContent` : le masquage de cet écran est
     VISUEL, pas une absence — le gabarit servi contient le module entier —, et
     `textContent` rendrait donc des mots qu'aucun œil ne voit. C'est une leçon
     déjà payée sur cet écran.
  */
  faux('le bloc des cycles observés est masqué', await page.locator('#bloc-observe').isVisible());
  {
    const vu = await page.evaluate(() => document.body.innerText);
    for (const mot of ['Ce que Cyclades a observé', 'Cycle commencé', 'statistiques']) {
      faux(`le mot « ${mot} » n’est pas lisible`, vu.includes(mot));
    }
  }

  v('MAIS LA SAISIE EST TOUJOURS EN BASE', await combien(), 1);

  /* Et effacer la réponse n'efface pas davantage. */
  await aller('/odyssee/corps/', '#reponses-sexe');
  await page.click('#effacer-sexe');
  await page.waitForFunction(
    () => document.getElementById('sexe-dit')?.textContent === 'Réponse effacée.',
    { timeout: 20000 },
  );
  v('effacer la réponse n’efface pas la saisie', await combien(), 1);
  faux('et ne montre rien', await page.locator('#ligne-du-suivi').isVisible());

  /* On revient à « Féminin » : la saisie est retrouvée telle quelle. */
  await page.click('#reponses-sexe button[data-sexe="feminin"]');
  await page.waitForFunction(
    () => document.getElementById('ligne-du-suivi')?.classList.contains('hidden') === false,
    { timeout: 20000 },
  );
  await aller(PAGE, '#dans-la-portee');
  v(
    'et la saisie est retrouvée, au niveau où elle était',
    await page.getAttribute('#niveaux button[data-niveau="moyen"]', 'aria-pressed'),
    'true',
  );

  /*
     COFFRE REFERMÉ : rien, même pour une réponse féminine. C'est le dernier
     cas du point 2 — « ou coffre fermé (on ne peut pas savoir) ».
  */
  await aller('/odyssee/corps/', '#fermer-coffre');
  await page.click('#fermer-coffre');
  await page.waitForFunction(
    () => document.getElementById('ligne-du-suivi')?.classList.contains('hidden') === true,
    { timeout: 20000 },
  );
  faux('coffre refermé, la ligne disparaît', await page.locator('#ligne-du-suivi').isVisible());

  await aller(PAGE, '#hors-portee');
  vrai('et l’adresse directe redevient neutre', await page.locator('#hors-portee').isVisible());
  faux('le suivi n’est pas rendu', await page.locator('#dans-la-portee').isVisible());
}

console.log('\n11. RIEN N’EST SORTI DU SITE');

v('aucune requête hors du site', sorties, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mDeux appuis, visible pour la seule réponse féminine, citations fidèles, aucune sortie.\x1b[0m\n'
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
