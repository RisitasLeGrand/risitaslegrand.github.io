/**
 * Santé, en navigateur : la porte, le coffre, et le bandeau.
 *
 * Trois garanties que le modèle seul ne peut pas donner, et qui sont celles
 * de la phase 1 :
 *
 * - **l'espace est fermé tant qu'on ne l'ouvre pas.** Un onglet « Santé »
 *   garni de champs vides est une invitation à y mettre la catégorie de
 *   données la plus coûteuse de l'application ;
 * - **l'activation ne suffit pas** : le coffre reste à ouvrir, et rien n'est
 *   lisible avant ;
 * - **le bandeau des valeurs non sourcées s'affiche**, parce qu'il est le
 *   livrable de la phase et non sa note de bas de page.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
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
const vrai = (titre, c) => v(titre, c, true);
const faux = (titre, c) => v(titre, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

/* Aucune requête ne doit sortir du site : une donnée de santé encore moins
   qu'une autre. */
const sorties = [];
page.on('request', (r) => {
  if (!r.url().startsWith(RACINE) && !r.url().startsWith('data:')) sorties.push(r.url());
});

await franchirInitialisation(page, RACINE, MDP);

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

console.log('\nL’ESPACE EST FERMÉ TANT QU’ON NE L’OUVRE PAS');

await aller('/odyssee/sante/', '#pas-active');
{
  vrai('l’écran annonce qu’il est fermé', await page.locator('#pas-active').isVisible());
  faux('le coffre n’est même pas demandé', await page.locator('#coffre-ferme').isVisible());
  faux('et rien n’est saisissable', await page.locator('#coffre-ouvert').isVisible());
  const texte = await page.textContent('#pas-active');
  vrai(
    'il dit ce qu’il permettrait, plutôt que de se taire',
    texte.includes('traitement') && texte.includes('prélèvement'),
  );
  vrai(
    'et que l’activation ne se synchronise pas',
    texte.includes('ne se synchronise pas') || texte.includes('reste fermé sur vos autres'),
  );
}

console.log('\nACTIVER NE SUFFIT PAS : LE COFFRE RESTE À OUVRIR');

{
  await page.click('#activer');
  await page.waitForSelector('#coffre-ferme', { state: 'visible', timeout: 20000 });
  vrai('le coffre est annoncé fermé', await page.locator('#coffre-ferme').isVisible());
  faux('et rien n’est encore lisible', await page.locator('#coffre-ouvert').isVisible());
}

console.log('\nCOFFRE OUVERT : LE BANDEAU, PUIS LA SAISIE');

{
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  await page.waitForSelector('#coffre-ouvert', { state: 'visible', timeout: 20000 });

  /*
     A-21, VUE DE CE CÔTÉ-CI. Ces trois constats affirmaient que le bandeau
     dit « Aucune fiche de molécule n'est publiée ». C'était vrai le jour où
     ils ont été écrits ; depuis le 16 octobre, cinq fiches le sont, chacune
     lue dans son RCP. Le contrôle était donc **vert sur un mensonge**, et il
     aurait empêché de le corriger : changer la phrase l'aurait fait rougir.

     Un essai qui fige le texte d'hier défend l'erreur d'aujourd'hui. Ce qu'il
     doit vérifier, ce n'est pas la phrase exacte, c'est ce qu'elle promet :
     dire pourquoi cette molécule-ci n'a pas de fiche, ne pas nier celles qui
     existent, et ne pas laisser croire qu'il faut attendre.
  */
  const bandeau = await page.textContent('#bandeau-catalogue');
  vrai(
    'le bandeau explique pourquoi CETTE molécule n’a pas de fiche',
    bandeau.includes('pas encore de fiche'),
  );
  vrai(
    'et pourquoi : une source primaire manque',
    bandeau.includes('source') && bandeau.includes('primaire'),
  );
  vrai(
    'il ne nie pas les fiches qui existent',
    !bandeau.includes('Aucune fiche de molécule'),
  );
  vrai(
    'tout en disant qu’on peut déclarer un traitement sans attendre',
    bandeau.includes('sans attendre'),
  );
}

{
  await page.fill('#t-nom', 'Exemple de traitement');
  await page.fill('#t-posologie', '1 le matin');
  await page.click('#form-traitement button[type="submit"]');
  await page.waitForTimeout(1200);
  const lignes = await page.$$eval('#traitements li', (e) => e.map((x) => x.textContent));
  v('le traitement est rangé et relu', lignes.length, 1);
  vrai('avec son nom', lignes[0].includes('Exemple de traitement'));
  vrai('sa posologie en toutes lettres', lignes[0].includes('1 le matin'));
  /*
     Le point qui compte : aucune prise n'est enregistrée, et l'écran doit le
     dire ainsi — « 0 h » dirait qu'on vient d'en prendre une.
  */
  vrai('et « aucune prise enregistrée » plutôt que « il y a 0 h »', 
    lignes[0].includes('aucune prise enregistrée'));
}

{
  await page.fill('#s-intitule', 'Fatigue');
  await page.fill('#s-intensite', '7');
  await page.click('#form-symptome button[type="submit"]');
  await page.waitForTimeout(1200);
  const lignes = await page.$$eval('#symptomes li', (e) => e.map((x) => x.textContent));
  v('le symptôme est rangé', lignes.length, 1);
  vrai('et son intensité est dite déclarée', lignes[0].includes('intensité déclarée 7/10'));
}

console.log('\nCE QUI EST ÉCRIT EST CHIFFRÉ, ET LE RESTE');

{
  /*
     La garantie qui vaut le détour par le navigateur : ce qui est dans la
     base ne contient pas le nom du traitement. Le lire ici, c'est lire ce
     qu'une extension ou un curieux lirait.
  */
  const brut = await page.evaluate(
    () =>
      new Promise((resoudre, rejeter) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => rejeter(d.error);
        d.onsuccess = () => {
          const base = d.result;
          const tx = base.transaction('odysseeTraitements', 'readonly');
          const tout = tx.objectStore('odysseeTraitements').getAll();
          tout.onsuccess = () => resoudre(JSON.stringify(tout.result));
          tout.onerror = () => rejeter(tout.error);
        };
      }),
  );
  faux('le nom du traitement n’est pas lisible dans la base', brut.includes('Exemple de traitement'));
  faux('ni la posologie', brut.includes('1 le matin'));
  vrai('mais l’enregistrement existe bien', brut.length > 50);
}

/* ══════════════════════════════════════════════════════════════════════════
   PHASE 4 — le schéma prévu et les deux appuis, vus à l'écran

   C'est la règle C6 du prompt 39 : un essai part d'une route et constate le
   résultat à l'écran. Les essais de Node prouvent le calcul des créneaux ;
   seul celui-ci prouve qu'il arrive jusqu'à la page, et qu'un geste l'écrit.

   Il se greffe sur le traitement déjà déclaré plus haut, plutôt que d'en
   créer un second : les constats précédents comptent les lignes, et un
   deuxième traitement les ferait rougir pour une raison sans rapport.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un élément en **position fixe** est-il à l'écran ?
 *
 * `offsetParent` vaut `null` pour tout élément positionné `fixed` — c'est la
 * norme, et non un défaut du bandeau d'annulation. Une sonde qui s'y fierait
 * le déclarerait invisible alors qu'il occupe le bas de l'écran. Mesuré dans
 * ce conteneur avant d'écrire cette ligne.
 */
const visibleEnFixe = (id) =>
  page.evaluate((x) => {
    const e = document.getElementById(x);
    if (!(e instanceof HTMLElement)) return false;
    return e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden';
  }, id);

console.log('\nLE SCHÉMA PRÉVU FAIT APPARAÎTRE LE CRÉNEAU DU JOUR');

{
  /*
     Avant tout schéma, le bloc « Aujourd'hui » est ABSENT. Une section vide
     portant ce titre apprendrait à sauter ce coin de l'écran, et c'est le
     coin qu'on veut qu'on regarde.
  */
  faux('rien de prévu : le bloc du jour ne s’affiche pas', await page.locator('#bloc-aujourdhui').isVisible());

  await page.click('#traitements details summary');
  await page.waitForTimeout(300);
  await page.fill('#traitements details input[type="time"]', '08:00');
  await page.click('#traitements details button:has-text("Ajouter cette heure")');
  await page.fill('#traitements details input[type="text"]', '5 g');
  await page.click('#traitements details button[type="submit"]');
  await page.waitForSelector('#bloc-aujourdhui', { state: 'visible', timeout: 20000 });

  const creneau = await page.$eval('#creneaux li', (li) => ({
    texte: li.textContent ?? '',
    etat: li.dataset.etat,
    boutons: [...li.querySelectorAll('button')].map((b) => b.textContent),
  }));
  v('le créneau est à l’état « prévu »', creneau.etat, 'prevu');
  vrai('il porte le nom du traitement', creneau.texte.includes('Exemple de traitement'));
  vrai('l’heure prévue, à la française', /Prévu à 8 h/.test(creneau.texte));
  vrai('et la quantité déclarée, telle quelle', creneau.texte.includes('5 g'));
  v('deux appuis, et eux seuls', creneau.boutons, ['Pris', 'Pas aujourd’hui']);
}

console.log('\n« PRIS » NOTE L’HEURE RÉELLE, APRÈS SIX SECONDES D’ANNULATION');

{
  await page.click('#creneaux li button:has-text("Pris")');
  await page.waitForTimeout(600);

  /*
     Le bandeau ne défait rien : il RETARDE l'écriture de six secondes.
     Pendant ce temps, la ligne annonce déjà ce qui sera écrit et ne porte
     aucun bouton — le chemin de retour est le bandeau, et en offrir un
     second ferait partir la suppression d'une marque qui n'existe pas.
  */
  const pendant = await page.$eval('#creneaux li', (li) => ({
    etat: li.dataset.etat,
    boutons: [...li.querySelectorAll('button')].map((b) => b.textContent),
  }));
  v('pendant le délai, la ligne annonce la prise', pendant.etat, 'pris');
  v('et ne propose aucun autre chemin que le bandeau', pendant.boutons, []);
  vrai('le bandeau d’annulation est bien à l’écran', await visibleEnFixe('bandeau-annulation'));

  await page.waitForTimeout(8000);
  const apres = await page.$eval('#creneaux li', (li) => ({
    texte: li.textContent ?? '',
    etat: li.dataset.etat,
  }));
  v('la prise est écrite', apres.etat, 'pris');
  vrai('et l’écran dit à quelle heure elle a été notée', /Noté à \d+ h/.test(apres.texte));

  /*
     LE DÉFAUT CORRIGÉ EN P2, constaté ici et nulle part ailleurs.
     `ecrirePrise` n'écrivait jamais `traitementId` : `heuresDepuisLaDernierePrise`
     filtre dessus, donc rendait `null` pour tous les traitements, toujours.
     L'essai d'au-dessus attend « aucune prise enregistrée » — et il avait
     raison AVANT qu'une prise soit notée. Maintenant qu'il y en a une,
     l'écran doit dire autre chose, et ne le pouvait pas jusqu'à ce lot.
  */
  const ligne = await page.$eval('#traitements li', (li) => li.textContent ?? '');
  faux('le délai depuis la dernière prise n’est plus muet', ligne.includes('aucune prise enregistrée'));
  vrai('il se lit en toutes lettres, et non « il y a 0 h »', ligne.includes('moins d’une heure'));
}

console.log('\n« PAS AUJOURD’HUI » NE LAISSE AUCUNE MARQUE NÉGATIVE');

{
  await page.click('#creneaux li button:has-text("Reprendre")');
  await page.waitForTimeout(1500);
  v(
    'reprendre rend le créneau à l’absence, et non à un troisième état',
    await page.$eval('#creneaux li', (li) => li.dataset.etat),
    'prevu',
  );

  await page.click('#creneaux li button:has-text("Pas aujourd’hui")');
  await page.waitForTimeout(8500);
  const refus = await page.$eval('#creneaux li', (li) => ({
    etat: li.dataset.etat,
    classes: li.className,
  }));
  v('le choix est noté', refus.etat, 'pas-aujourdhui');
  /*
     AUCUNE COULEUR D'ÉCHEC (interdit § 1 n° 3) : la ligne garde la bordure
     des autres. Un reproche rendu par la couleur serait celui que le texte
     a pris soin d'éviter.
  */
  faux('et la ligne ne vire ni au rouge ni à l’orange', /rose|red|amber|orange/.test(refus.classes));
}

console.log('\nNI COMPTEUR, NI REPROCHE, NI VERBE DE PRESCRIPTION');

{
  const ecran = await page.evaluate(() => document.body.innerText);

  /* Interdit § 1 n° 3 : aucun compteur d'oublis, aucune série, aucun
     pourcentage d'observance. On cherche les formes qu'ils prendraient. */
  v(
    'aucun compteur, aucune série, aucun pourcentage d’observance',
    [/observance/i, /\d+\s*%/, /\boubli[eé]?s?\b/i, /série de \d+/i, /\d+ *\/ *\d+ *prises/i]
      .filter((r) => r.test(ecran))
      .map(String),
    [],
  );
  v(
    'aucun mot de reproche',
    ['manqué', 'manquée', 'raté', 'ratée', 'en retard', 'non pris'].filter((m) =>
      ecran.toLowerCase().includes(m),
    ),
    [],
  );

  /*
     L'interdit § 1 n° 2 : un rappel ne conseille rien. L'essai de la phase 7
     portera cette règle sur TOUS les textes ; celui-ci la porte sur cet
     écran, et il sera remplacé par lui — pas doublé.

     La sonde vise l'IMPÉRATIF et non l'indicatif : la phrase d'accueil dit
     « Ce que vous prenez, ce que vous faites doser », qui décrit ce que fait
     la personne. Une première version cherchait « prenez » nu et rougissait
     dessus. La distinction tient dans un mot — un impératif n'est pas
     précédé de « vous » — et c'est la sonde qui a été affinée, pas la liste
     qui a été raccourcie.
  */
  const PRESCRIPTIONS = [
    /(?<!vous )\bprenez\b/i,
    /(?<!tu )\bprends\b/i,
    /(?<!vous )\bdoublez\b/i,
    /(?<!vous )\bsautez\b/i,
    /(?<!vous )\bavalez\b/i,
    /(?<!vous )\baugmentez\b/i,
    /(?<!vous )\bdiminuez\b/i,
    /\barrêtez de prendre\b/i,
    /vous devriez prendre/i,
    /(?<!vous )\brattrapez\b/i,
  ];
  v('l’écran n’ordonne rien', PRESCRIPTIONS.filter((r) => r.test(ecran)).map(String), []);

  /*
     ET LA SONDE EST VALIDÉE SUR LE DÉFAUT QU'ELLE VISE. Une sonde affinée
     peut l'être jusqu'à ne plus rien attraper, et elle resterait verte — le
     seul genre de vert qui ne prouve rien.
  */
  v(
    'et elle attraperait bien un conseil de rattrapage',
    [
      'Prenez-la maintenant.',
      'Doublez la prochaine.',
      'Sautez celle-ci.',
      'Vous devriez prendre votre créatine.',
    ].filter((phrase) => !PRESCRIPTIONS.some((r) => r.test(phrase))),
    [],
  );
}

console.log('\nREFERMER LE COFFRE REFERME L’ÉCRAN');

{
  /*
     La clé du coffre vit dans `sessionStorage`, jamais dans `localStorage` :
     c'est la décision du module, et la vider ici est exactement ce que fait
     la fermeture de l'onglet.
  */
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#coffre-ferme', { state: 'visible', timeout: 20000 });
  faux('rien n’est lisible après rechargement', await page.locator('#coffre-ouvert').isVisible());
  faux('et l’espace reste activé', await page.locator('#pas-active').isVisible());
  /*
     PHASE 4. Le bloc du jour se referme avec le reste, et rien de ce qu'il
     portait ne reste dans la page : ni le nom du traitement, ni l'heure
     prévue, ni ce qui a été noté. C'est l'interdit § 1 n° 5 — coffre fermé,
     aucun écran ne laisse lire le nom d'un traitement ni l'existence de
     Santé.
  */
  faux('le bloc du jour est fermé lui aussi', await page.locator('#bloc-aujourdhui').isVisible());
  const ferme = await page.evaluate(() => `${document.title}\n${document.body.innerText}`);
  v(
    'ni le traitement, ni son heure prévue, ni ce qui en a été noté',
    ['Exemple de traitement', '5 g', 'Prévu à', 'Noté à', 'Pas aujourd’hui'].filter((m) =>
      ferme.includes(m),
    ),
    [],
  );
}

v('aucune requête n’est sortie du site', sorties, []);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de santé en navigateur passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
