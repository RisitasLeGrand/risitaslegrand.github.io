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

console.log('\n1. LA PORTE EST UNE LIGNE NEUTRE DEPUIS CORPS');

/*
   Le sélecteur d'attente est propre à la page, et pas `h1` : le verrou du
   site porte le sien, donc `h1` résout deux éléments et Playwright attend que
   le premier — celui du verrou, devenu caché — redevienne visible. Il attend
   pour toujours, et le message parle d'un délai dépassé plutôt que de la
   cause.
*/
await aller('/odyssee/corps/', 'a[href="/odyssee/corps/suivi/"]');
{
  const lien = page.locator('a[href="/odyssee/corps/suivi/"]');
  vrai('une ligne mène au suivi', await lien.count() > 0);
  const texte = normaliser(await lien.first().textContent());
  v('et son libellé est neutre', texte, 'suivi personnel');
  /*
     LA DISCRÉTION DE 4.8, MESURÉE SUR L'ÉCRAN QUI PORTE LA PORTE. Le mot
     « règles » ne doit pas apparaître hors du module — et `corps.astro` est
     hors du module.
  */
  const corps = normaliser(await page.textContent('main'));
  faux('et l’écran Corps ne dit pas « règles »', /\brègles?\b/i.test(corps));
}

console.log('\n2. LES SIGNES D’ALERTE SONT LÀ COFFRE FERMÉ ET MODULE DÉSACTIVÉ');

await aller(PAGE, '#signes');
{
  vrai('la section est visible', await page.locator('#signes').isVisible());
  faux('alors que le coffre n’est pas ouvert', await page.locator('#coffre-ouvert').isVisible());
  vrai('et le coffre est bien demandé', await page.locator('#coffre-ferme').isVisible());

  const mention = normaliser(await page.textContent('main'));
  vrai(
    'la mention d’ouverture du module est affichée',
    mention.includes(
      normaliser(
        'Cyclades n’est pas une méthode contraceptive, n’est pas un dispositif médical et ne ' +
          'remplace pas un professionnel de santé.',
      ),
    ),
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

console.log('\n7. TROIS APPUIS AU PLUS DEPUIS L’OUVERTURE DU MODULE (MAQUETTE 8.2)');

{
  /*
     Les appuis sont comptés depuis l'arrivée sur l'écran, et le déverrouillage
     du coffre en fait partie : la personne ne choisit pas de le faire.
       1. ouvrir le coffre
       2. activer le suivi
       3. choisir un niveau
     Et une fois le suivi activé, il n'en reste qu'un.
  */
  let appuis = 0;
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  appuis += 1;
  await page.waitForSelector('#coffre-ouvert', { state: 'visible', timeout: 20000 });

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

  v('trois appuis, pas plus', appuis, 3);
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
  */
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
  vrai('la section des signes est toujours là', await page.locator('#signes').isVisible());
}

console.log('\n9. RIEN N’EST SORTI DU SITE');

v('aucune requête hors du site', sorties, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTrois appuis, citations fidèles, aucune alarme, aucune sortie.\x1b[0m\n'
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
