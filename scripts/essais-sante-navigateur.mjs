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
import {
  apresLeChangementDeTexte,
  apresLeRemplacement,
  attendreLeCompte,
  devientVisible,
} from './lib/post-condition.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
/** Le jour logique, pour l'échéance d'une tâche : la journée bascule à 4 h. */
const AUJOURDHUI_TACHES = (() => {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
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
/** Ce qu'on a lu, sans en faire un verdict : utile quand l'essai échoue. */
const mesure = (quoi, valeur) => console.log(`  \x1b[36m·\x1b[0m ${quoi} : ${valeur}`);

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

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET POURQUOI AUCUNE N'EST UNE DURÉE

   Vingt-cinq temporisations à l'aveugle vivaient ici, dont deux de huit et
   neuf secondes. `docs/cyclades/cadence-des-essais.md` § 3 dit le défaut :
   une durée est une MOYENNE, elle cède sous une batterie chargée, et elle
   cède là où elle était censée protéger.

   TROIS MÉCANIQUES DU SITE commandent les remplacements, et elles ont été
   lues dans « src/pages/odyssee/sante.astro » et « src/lib/annulation.ts »
   plutôt que supposées :

   1. `marquer()` pose l'attente, crée le bandeau d'annulation, PUIS repeint.
      Le bandeau paraît donc AVANT la ligne : attendre le bandeau et lire la
      ligne serait le troisième piège du § 3.
   2. `partir()`, à l'expiration du bandeau, retire le bandeau PUIS écrit et
      repeint. La disparition du bandeau ne dit donc rien de l'écriture — même
      piège, dans l'autre sens.
   3. `peindreLesCreneaux` fait `zone.replaceChildren()` : chaque ligne est un
      nœud NEUF. On marque l'ancien et l'on attend un nœud sans la marque, ce
      qui est la seule post-condition qu'aucun passage antérieur ne peut avoir
      rendue vraie.

   Et là où l'écriture n'a aucune marque à l'écran — le centre de
   notifications qui décroît, une tâche rangée, une prise pointée —, c'est la
   BASE qu'on interroge jusqu'à ce qu'elle réponde.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes. Large : elle rend un blocage lisible, elle ne
    mesure pas la vitesse. */
const DELAI = 30_000;

/** Tout un magasin, lu comme une extension le lirait. */
const lireLeMagasin = (magasin) =>
  page.evaluate(
    (nom) =>
      new Promise((ok, rate) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => rate(d.error);
        d.onsuccess = () => {
          const r = d.result.transaction(nom).objectStore(nom).getAll();
          r.onsuccess = () => ok(r.result);
          r.onerror = () => rate(r.error);
        };
      }),
    magasin,
  );

/**
 * Interroge la base jusqu'à ce qu'elle réponde ce qu'on attend.
 *
 * L'idiome vient de `essais-niveau-navigateur.mjs`. Il sert aux écritures
 * qu'aucune marque d'écran n'annonce : neuf secondes couvraient l'expiration
 * d'un bandeau PUIS l'écriture, et il suffisait d'une machine chargée pour
 * que l'assertion lise l'état d'avant.
 */
const attendreEnBase = async (magasin, estSatisfait, delai = DELAI) => {
  const fin = Date.now() + delai;
  for (;;) {
    if (estSatisfait(await lireLeMagasin(magasin))) return true;
    if (Date.now() > fin) return false;
    await page.waitForTimeout(100);
  }
};

/** La zone des créneaux du jour, repeinte en entier à chaque changement. */
const apresLesCreneaux = (geste = null) =>
  apresLeRemplacement(page, '#creneaux-du-jour', geste, { delai: DELAI });

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
  await attendreLeCompte(page, '#traitements li', 1, { delai: DELAI });
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
  await attendreLeCompte(page, '#symptomes li', 1, { delai: DELAI });
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
  /* Rien à attendre : le `fill` qui suit attend déjà son champ, et le contenu
     du repli vient du serveur. */
  await page.fill('#traitements details input[type="time"]', '08:00');
  await page.click('#traitements details button:has-text("Ajouter cette heure")');
  await page.fill('#traitements details input[type="text"]', '5 g');
  await page.click('#traitements details button[type="submit"]');
  await page.waitForSelector('#bloc-aujourdhui', { state: 'visible', timeout: 20000 });

  const creneau = await page.$eval('#creneaux-du-jour li', (li) => ({
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
  await apresLesCreneaux(() => page.click('#creneaux-du-jour li button:has-text("Pris")'));

  /*
     Le bandeau ne défait rien : il RETARDE l'écriture de six secondes.
     Pendant ce temps, la ligne annonce déjà ce qui sera écrit et ne porte
     aucun bouton — le chemin de retour est le bandeau, et en offrir un
     second ferait partir la suppression d'une marque qui n'existe pas.
  */
  const pendant = await page.$eval('#creneaux-du-jour li', (li) => ({
    etat: li.dataset.etat,
    boutons: [...li.querySelectorAll('button')].map((b) => b.textContent),
  }));
  v('pendant le délai, la ligne annonce la prise', pendant.etat, 'pris');
  v('et ne propose aucun autre chemin que le bandeau', pendant.boutons, []);
  vrai('le bandeau d’annulation est bien à l’écran', await visibleEnFixe('bandeau-annulation'));

  /*
     L'EXPIRATION, ATTENDUE PAR SA PEINTURE ET NON PAR SA DURÉE. Six secondes
     plus la marge faisaient huit ; on attend maintenant la repeinture que
     `agir()` déclenche après l'écriture, ce qui est exact plutôt que généreux.
  */
  await apresLesCreneaux();
  const apres = await page.$eval('#creneaux-du-jour li', (li) => ({
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
  await apresLesCreneaux(() =>
    page.click('#creneaux-du-jour li button:has-text("Reprendre")'),
  );
  v(
    'reprendre rend le créneau à l’absence, et non à un troisième état',
    await page.$eval('#creneaux-du-jour li', (li) => li.dataset.etat),
    'prevu',
  );

  await apresLesCreneaux(() =>
    page.click('#creneaux-du-jour li button:has-text("Pas aujourd’hui")'),
  );
  /* Puis l'expiration, qui écrit et repeint à son tour. */
  await apresLesCreneaux();
  const refus = await page.$eval('#creneaux-du-jour li', (li) => ({
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

console.log('\nLE RÉGLAGE DE RAPPEL, ET CE QU’IL DIT DE SES LIMITES');

{
  /*
     Le bouton d'export n'apparaît QUE si un traitement demande un rappel
     par agenda : un bouton qui produirait un fichier vide est pire qu'un
     bouton absent, puisqu'il faut l'ouvrir pour apprendre qu'il n'y avait
     rien.
  */
  faux('aucun rappel demandé : pas de bouton d’export', await page.locator('#export-agenda').isVisible());

  const rappel = page.locator('#traitements details').nth(1);
  await rappel.locator('summary').click();
  /* Le libellé du `summary` vient du serveur : la lecture qui suit attend
     déjà son élément, et rien n'est peint entre-temps. */
  vrai(
    'le repli invite à régler un rappel, sans en avoir posé un',
    (await rappel.locator('summary').textContent()).includes('Me rappeler'),
  );

  /*
     TOUT EST ÉTEINT PAR DÉFAUT (décision 3), et les réglages suivants sont
     cachés : des champs visibles sous une case décochée laisseraient croire
     qu'ils agissent.
  */
  faux('la case « Me rappeler » est décochée', await rappel.locator('input[type="checkbox"]').first().isChecked());
  faux('et la voie n’est pas encore proposée', await rappel.locator('select').first().isVisible());

  await rappel.locator('input[type="checkbox"]').first().check();
  await rappel.locator('select').first().waitFor({ state: 'visible', timeout: DELAI }).catch(() => {});
  vrai('cochée, elle découvre la voie', await rappel.locator('select').first().isVisible());

  /*
     CE QUE CHAQUE VOIE FAIT VRAIMENT, dit à l'écran (§ 1 n° 6 : ce qu'un
     site statique ne peut pas faire est dit, pas promis).
  */
  const ditAgenda = await rappel.locator('p').first().textContent();
  vrai('l’agenda est annoncé comme la seule voie qui sonne fermé', ditAgenda.includes('seule voie'));
  vrai('et son angle mort est dit aussi', ditAgenda.includes('jamais en cas d’oubli'));

  /*
     ON ATTEND QUE LE TEXTE AIT CHANGÉ, et non qu'il dise la phrase attendue :
     la valeur de départ est relevée avant le geste, donc l'attente ne
     présuppose rien de ce que les deux assertions affirment.
  */
  await apresLeChangementDeTexte(
    page,
    rappel.locator('p').first(),
    () => rappel.locator('select').first().selectOption('notification'),
    { delai: DELAI },
  );
  const ditNotification = await rappel.locator('p').first().textContent();
  vrai('la notification dit ce qu’elle ne fait pas sur iPhone', ditNotification.includes('iPhone'));
  vrai('et qu’Android demande l’application installée', ditNotification.includes('installée'));
  await rappel.locator('select').first().selectOption('agenda');

  /* L'avertissement du § 3.3 n'apparaît que si le libellé nomme. */
  const avertissement = rappel.locator('p', { hasText: 'synchronisé avec un service tiers' });
  faux('en libellé neutre, aucun avertissement à donner', await avertissement.isVisible());
  await rappel.locator('select').nth(1).selectOption('explicite');
  await avertissement.waitFor({ state: 'visible', timeout: DELAI }).catch(() => {});
  vrai('le libellé explicite s’accompagne de son avertissement', await avertissement.isVisible());
  await rappel.locator('select').nth(1).selectOption('neutre');

  /* Le rappel d'oubli, et la limite qu'il faut dire. */
  const oubliCase = rappel.locator('input[type="checkbox"]').nth(1);
  faux('le rappel d’oubli est éteint lui aussi', await oubliCase.isChecked());
  await oubliCase.check();
  const limite = rappel.locator('p', { hasText: 'coffre déverrouillé' });
  await limite.waitFor({ state: 'visible', timeout: DELAI }).catch(() => {});
  vrai('et la limite réelle du rappel d’oubli est dite', await limite.isVisible());
  vrai(
    'y compris qu’elle vient du chiffrement, et non d’un manque de soin',
    (await limite.textContent()).includes('chiffré'),
  );
  const delai = rappel.locator('select').nth(2);
  v('le délai par défaut est de deux heures', await delai.inputValue(), '120');

  await rappel.locator('button[type="submit"]').click();
  await devientVisible(page, '#export-agenda', true, { delai: DELAI });
  vrai('réglé, le bouton d’export apparaît', await page.locator('#export-agenda').isVisible());
}

console.log('\nL’EXPORT PRODUIT UN FICHIER, ET IL NE DIT RIEN DE TROP');

{
  /*
     On intercepte le téléchargement plutôt que de l'écrire sur le disque :
     ce qu'on veut lire, c'est le CONTENU du fichier qui partirait dans un
     agenda — lequel est, pour la plupart des gens, synchronisé chez un
     tiers.
  */
  const attendu = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#telecharger-agenda');
  const telechargement = await attendu;
  const flux = await telechargement.createReadStream();
  let ics = '';
  for await (const morceau of flux) ics += morceau;

  vrai('le fichier s’appelle comme un agenda', telechargement.suggestedFilename().endsWith('.ics'));
  vrai('il porte une règle de récurrence', ics.includes('RRULE:FREQ=DAILY'));
  vrai('et une alarme, qui est sa seule raison d’être', ics.includes('BEGIN:VALARM'));
  vrai('l’heure est écrite avec son fuseau', ics.includes('DTSTART;TZID=Europe/Paris:'));
  vrai('et le fuseau est décrit, non laissé à deviner', ics.includes('BEGIN:VTIMEZONE'));
  vrai('le libellé par défaut ne nomme rien', ics.includes('SUMMARY:Rappel Cyclades'));
  /*
     LE POINT QUI COMPTE : ce fichier QUITTE l'appareil. En libellé neutre,
     rien du traitement n'y figure.
  */
  v(
    'ni le nom du traitement, ni sa posologie, ni sa quantité',
    ['Exemple de traitement', '1 le matin', '5 g'].filter((m) => ics.includes(m)),
    [],
  );
  vrai('et l’écran dit ce qui a été exporté', await page.locator('#export-fait').isVisible());
}

console.log('\nLE RAPPEL D’OUBLI, ET CE QU’IL DÉPOSE AU CENTRE');

{
  /*
     Le créneau doit être DÉJÀ PASSÉ pour qu'un oubli existe, et on ne peut
     pas remonter l'horloge du navigateur. On pose donc l'heure prévue trois
     heures avant maintenant, avec un délai de trente minutes.

     Deux cas où ce décalage change de jour logique — la journée de Cyclades
     bascule à 4 h — et où l'essai ne mesurerait pas ce qu'il croit. Il le
     DIT alors au lieu de rougir ou de passer en silence : un essai qui se
     saute sans le dire est un essai qu'on croit vert.
  */
  /*
     La vraie condition n'est pas « il est assez tard », c'est « le créneau
     tombe dans le MÊME jour logique que maintenant ». Mon premier garde-fou
     refusait sur l'heure murale, et il s'est sauté sur 4 h 45 — une heure
     qui tombe pourtant dans le bon jour, puisque la journée de Cyclades
     bascule à 4 h. Il mesure maintenant ce qu'il devait mesurer.
  */
  const jourLogiqueDe = (d) => {
    const x = new Date(d);
    if (x.getHours() < 4) x.setDate(x.getDate() - 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const maintenant = new Date();
  /* Trois heures de recul d'abord, une seule ensuite : il faut seulement que
     le délai de trente minutes soit dépassé. */
  const h = [3, 1]
    .map((recul) => new Date(maintenant.getTime() - recul * 3_600_000))
    .find((candidat) => jourLogiqueDe(candidat) === jourLogiqueDe(maintenant));
  const heure = h
    ? `${String(h.getHours()).padStart(2, '0')}:${String(h.getMinutes()).padStart(2, '0')}`
    : '';

  if (!h) {
    console.log(
      '\x1b[36m·\x1b[0m non mesuré : à cette heure-ci, aucun créneau passé ne tombe dans le ' +
        'jour logique courant, et l’essai mesurerait autre chose que ce qu’il annonce.',
    );
  } else {
    /* Un second traitement, pour ne pas défaire ce que les essais d'au-dessus
       ont établi sur le premier. */
    await page.fill('#t-nom', 'Traitement du matin');
    await page.click('#form-traitement button[type="submit"]');
    /* Deux traitements désormais : celui des essais d'au-dessus, et celui-ci. */
    await attendreLeCompte(page, '#traitements li', 2, { delai: DELAI });

    const bloc = page.locator('#traitements li', { hasText: 'Traitement du matin' });
    await bloc.locator('details').first().locator('summary').click();
    await bloc.locator('input[type="time"]').fill(heure);
    await bloc.locator('button:has-text("Ajouter cette heure")').click();
    /*
       L'heure déclarée fait paraître un créneau du jour, puisqu'elle est
       passée : la zone des créneaux est repeinte, et c'est elle qu'on attend.
    */
    await apresLesCreneaux(() =>
      bloc.locator('details').first().locator('button[type="submit"]').click(),
    );

    const reglage = bloc.locator('details').nth(1);
    await reglage.locator('summary').click();
    /* Les cases découvrent ce qu'elles commandent ; on attend ce que chacune
       découvre, et non deux cents millisecondes. */
    await reglage.locator('input[type="checkbox"]').first().check();
    await reglage
      .locator('select')
      .first()
      .waitFor({ state: 'visible', timeout: DELAI })
      .catch(() => {});
    await reglage.locator('input[type="checkbox"]').nth(1).check();
    await reglage
      .locator('select')
      .nth(2)
      .waitFor({ state: 'visible', timeout: DELAI })
      .catch(() => {});
    await reglage.locator('select').nth(2).selectOption('30');
    /* Le réglage enregistré, la ligne du créneau porte sa marque d'oubli :
       la zone est repeinte une fois de plus. */
    await apresLesCreneaux(() => reglage.locator('button[type="submit"]').click());

    const ligne = page.locator('#creneaux-du-jour li', { hasText: 'Traitement du matin' });
    const texte = await ligne.textContent();
    mesure('la ligne du créneau oublié', JSON.stringify(texte));
    /*
       LE TEXTE DU RAPPEL, et il remplace la ligne ordinaire au lieu de s'y
       ajouter : « Prévu à 8 h » suivi de « prévue à 8 h, rien n'est noté »
       dirait deux fois la même chose, et la répétition ferait du constat
       une insistance.
    */
    vrai('il dit que rien n’est noté', texte.includes('rien n’est noté'));
    vrai('et rappelle l’heure prévue', texte.includes('prévue à'));
    faux('sans répéter « Prévu à »', texte.includes('Prévu à'));
    /*
       AUCUN CONSEIL DE RATTRAPAGE, AUCUN DÉCOMPTE. C'est l'interdit § 1
       n° 2 et n° 3 sur le seul texte que le rappel produise.
    */
    v(
      'il ne conseille rien et ne compte rien',
      [/(?<!vous )\bprenez\b/i, /\bdoublez\b/i, /\bsautez\b/i, /\brattrapez\b/i, /depuis \d+/i]
        .filter((r) => r.test(texte))
        .map(String),
      [],
    );
    /* Et les deux appuis sont toujours là : un rappel est une relance, pas
       un état qui enlèverait le moyen de répondre. */
    v(
      'les deux appuis restent offerts',
      await ligne.locator('button').evaluateAll((b) => b.map((x) => x.textContent)),
      ['Pris', 'Pas aujourd’hui'],
    );

    /*
       CE QUI EST DÉPOSÉ AU CENTRE. On lit le magasin tel qu'une extension
       ou un curieux le lirait : seuls l'identifiant — une empreinte — et le
       genre y sont en clair. La source, la référence, donc le traitement et
       l'heure, sont dans le bloc chiffré.
    */
    /*
       LE DÉPÔT SE LIT DANS LE MAGASIN, et il arrive APRÈS la peinture des
       créneaux : deux secondes couvraient les deux d'un coup, et ma première
       conversion n'attendait que la peinture — le magasin était vide, et la
       lecture suivante a cassé l'essai sur un « undefined ». Le recensement
       du centre n'a aucune marque sur CET écran-ci.
    */
    await attendreEnBase('centreElements', (tout) => tout.length >= 1);
    const centre = await lireLeMagasin('centreElements');
    v('un élément déposé au centre, et un seul', centre.length, 1);
    /*
       UN ROUGE NE DOIT PAS EN CACHER QUINZE. Les cinq constats qui suivent
       lisent `centre[0]`, et le magasin vide faisait une panne sur
       « undefined.id » : l'essai s'arrêtait là, et les quinze assertions des
       deux dernières sections — la tâche liée, le pointage, le dépointage —
       n'étaient pas mesurées du tout. Elles passaient pour absentes, ce qui
       est pire qu'un rouge.

       Rien n'est assoupli : chacune reste rouge si l'élément manque, et le
       premier constat l'a déjà dit. On se contente de ne pas mourir.
    */
    /*
       LES CINQ CONSTATS QUI SUIVENT PORTENT SUR L'ÉLÉMENT DÉPOSÉ, et ils ne
       veulent rien dire sans lui. Le magasin vide faisait une panne sur
       « undefined.id » : l'essai s'arrêtait là, et les vingt-trois assertions
       des sections suivantes — la tâche liée, le pointage, le dépointage —
       n'étaient pas mesurées du tout. Elles passaient pour absentes, ce qui
       est pire qu'un rouge.

       Rien n'est assoupli, et la différence compte. Deux de ces constats
       seraient des VERTS À VIDE sans élément — « rien d'autre n'est lisible »
       est vrai d'un objet vide — et deux autres ne font que redire le rouge du
       premier. On dit donc « non mesuré », et le dépôt manquant reste le seul
       verdict de la section ; l'essai échoue toujours.
    */
    if (centre.length === 1) {
      const depose = centre[0];
      vrai('sa clé est une empreinte, pas une référence lisible', /^[0-9a-f]{32}$/.test(depose.id));
      /*
         Genre « à savoir » et non « à trancher » : une question à trancher ne
         quitte jamais le compteur tant qu'elle n'est pas résolue, et une
         prise sans réponse n'est pas une question — ne rien répondre est une
         réponse. En faire une question aurait fabriqué le compteur d'oublis
         que l'interdit § 1 n° 3 refuse.
      */
      v('son genre ne compte pas dans la pastille', depose.genre, 'a-savoir');
      v(
        'et rien d’autre n’est lisible sans la clé',
        Object.keys(depose).filter((k) => !['id', 'genre', 'scelle', 'iv', 'majLe'].includes(k)),
        [],
      );
      const brut = JSON.stringify(depose);
      v(
        'ni le traitement, ni l’heure, ni le nom de la source',
        ['Traitement du matin', heure, 'rappel-de-prise'].filter((m) => brut.includes(m)),
        [],
      );
    } else {
      console.log(
        '  \x1b[36m·\x1b[0m non mesuré : sans élément déposé, ce que le centre laisse en ' +
          'clair ne se mesure pas — et « rien n’est lisible » serait vrai d’un objet vide.',
      );
    }

    /*
       RÉPONDRE RETIRE LE RAPPEL. C'est la seconde moitié du recensement,
       celle qu'on oublie : sans elle, le centre ne décroîtrait jamais, et
       un compteur qui ne redescend pas finit par ne plus être lu.
    */
    await ligne.locator('button:has-text("Pas aujourd’hui")').click();
    /*
       NEUF SECONDES COUVRAIENT DEUX CHOSES : l'expiration du bandeau, puis
       l'écriture et le retrait du rappel. Le centre n'en dit rien à l'écran
       d'ici — on interroge donc son magasin jusqu'à ce qu'il soit vide.
    */
    await attendreEnBase('centreElements', (tout) => tout.length === 0);
    const apresReponse = (await lireLeMagasin('centreElements')).length;
    /*
       ET LA PRÉMISSE EST DITE, parce que sans elle ce constat est un VERT À
       VIDE : si rien n'a été déposé — ce qui est le cas aujourd'hui, le
       premier constat de cette section le dit —, « le centre est vide » est
       vrai sans que le retrait ait eu lieu. Un vert obtenu ainsi ne prouve
       rien et ferait croire la seconde moitié du recensement tenue.

       L'essai le dit donc « non mesuré », et le rouge du dépôt reste le seul
       verdict de la section. L'idiome est celui de la mesure du créneau
       passé, plus haut dans ce fichier.
    */
    if (centre.length === 1) {
      v('une réponse retire le rappel du centre', apresReponse, 0);
    } else {
      console.log(
        '  \x1b[36m·\x1b[0m non mesuré : rien n’a été déposé au centre, donc « le retrait ' +
          'a eu lieu » serait vrai sans que rien ne soit retiré.',
      );
    }
  }
}

console.log('\nLE LIEN TÂCHE ↔ PRISE — POINTER NOTE, DÉPOINTER RETIRE');

{
  /*
     P5 du prompt 52, et la décision 1 du 15 octobre levée pour ce seul
     lien. Il se constate de bout en bout ou pas du tout : la tâche vit sur
     un écran, la prise dans un autre, et c'est précisément la traversée
     qu'on veut éprouver.
  */
  const lirePrises = () =>
    page.evaluate(
      () =>
        new Promise((resoudre, rejeter) => {
          const d = indexedDB.open('revinsp');
          d.onerror = () => rejeter(d.error);
          d.onsuccess = () => {
            const tx = d.result.transaction('odysseeMedicaments', 'readonly');
            const tout = tx.objectStore('odysseeMedicaments').getAll();
            tout.onsuccess = () => resoudre(tout.result.map((p) => p.id));
            tout.onerror = () => rejeter(tout.error);
          };
        }),
    );

  const avant = await lirePrises();

  const traitementId = await page.evaluate(
    () =>
      new Promise((resoudre, rejeter) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => rejeter(d.error);
        d.onsuccess = () => {
          const tx = d.result.transaction('odysseeTraitements', 'readonly');
          const tout = tx.objectStore('odysseeTraitements').getAll();
          tout.onsuccess = () => resoudre(tout.result[0]?.id ?? '');
          tout.onerror = () => rejeter(tout.error);
        };
      }),
  );

  await aller('/odyssee/taches/', '#lien');
  const proposees = await page.locator('#lien option').evaluateAll((o) => o.map((e) => e.value));
  vrai('Santé est désormais proposée à l’écran', proposees.includes('odyssee.medicament'));

  /* Le champ « Lequel » n'apparaît que pour l'action qui en demande un. */
  faux('et le champ « Lequel » reste caché pour les autres', await page.locator('#ligne-cible').isVisible());
  await page.selectOption('#lien', 'odyssee.medicament');
  await devientVisible(page, '#ligne-cible', true, { delai: DELAI });
  vrai('choisir Santé le découvre', await page.locator('#ligne-cible').isVisible());
  const cibles = await page.locator('#cible option').evaluateAll((o) =>
    o.map((e) => ({ valeur: e.value, texte: e.textContent })),
  );
  vrai('il propose le traitement déclaré', cibles.some((c) => c.texte === 'Exemple de traitement'));
  /*
     CE QUI EST RANGÉ EST L'IDENTIFIANT, JAMAIS LE NOM : la tâche vit en
     clair, et y recopier le nom annulerait le scellement de Santé pour
     cette ligne-là.
  */
  vrai('et sa valeur est un identifiant, pas un nom', cibles.some((c) => c.valeur === traitementId));

  /*
     LA TÂCHE DOIT ÊTRE RÉPÉTÉE, et ce n'est pas un détail d'essai : un lien
     n'écrit dans sa branche qu'au pointage d'une OCCURRENCE.
     `pointerLaTache` clôt simplement une tâche unique, sans passer par la
     branche — mesuré ici, et vrai pour Sport et les quêtes comme pour
     Santé. L'écran le dit désormais au lieu de le taire ; le mécanisme des
     occurrences, lui, appartient au prompt 38 et n'est pas étendu ici.
  */
  vrai(
    'sans répétition, l’écran avertit que rien ne sera enregistré',
    await page.locator('#lien-sans-repetition').isVisible(),
  );

  await page.fill('#titre', 'Prise du matin');
  await page.selectOption('#cible', traitementId);
  await page
    .locator('details', { hasText: 'Répéter' })
    .first()
    .evaluate((d) => d.setAttribute('open', ''));
  /*
     L'AVERTISSEMENT QUI TOMBE est un invariant négatif : il ne s'attend pas
     en tant que tel, puisqu'il serait vrai même si l'écran mettait une
     seconde à réagir. On attend donc sa disparition, bornée — l'expiration
     est rendue comme un faux, et l'assertion garde son sens.
  */
  await devientVisible(page, '#lien-sans-repetition', false, { delai: DELAI });
  faux(
    'avec une répétition, l’avertissement tombe',
    await page.locator('#lien-sans-repetition').isVisible(),
  );
  await page.selectOption('#champs-serie select[data-regle]', 'jours');
  await page.locator('#champs-serie input[type="number"]').first().fill('1');
  await page.click('#ajouter');
  /* La tâche part en base sans que cet écran-ci n'en montre la preuve : on
     attend le magasin, non l'écran. */
  await attendreEnBase('odysseeTaches', (tout) => tout.length >= 1);

  const tache = await page.evaluate(
    () =>
      new Promise((resoudre, rejeter) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => rejeter(d.error);
        d.onsuccess = () => {
          const tx = d.result.transaction('odysseeTaches', 'readonly');
          const tout = tx.objectStore('odysseeTaches').getAll();
          tout.onsuccess = () =>
            resoudre(tout.result.find((t) => t.titre === 'Prise du matin') ?? null);
          tout.onerror = () => rejeter(tout.error);
        };
      }),
  );
  vrai('la tâche est créée', Boolean(tache));
  v('elle vise le traitement par son identifiant', tache?.lien, {
    branche: 'sante',
    action: 'odyssee.medicament',
    cible: traitementId,
  });
  vrai('et elle est répétée, donc elle a des occurrences à pointer', Boolean(tache?.serie));
  /*
     Et son titre ne nomme pas le traitement : c'est la personne qui l'écrit,
     et rien de Cyclades ne l'y recopie. L'interdit du prompt — « une tâche
     liée ne montre jamais le nom du traitement coffre fermé » — tient
     d'abord à cela.
  */
  faux('et rien du traitement n’a été recopié en clair', JSON.stringify(tache).includes('Exemple de traitement'));

  /* ── Pointer ── */
  await page.locator(`[data-faire="${tache.id}"]`).click();
  await attendreEnBase('odysseeMedicaments', (tout) => tout.length === avant.length + 1);

  const apresPointage = await lirePrises();
  v('pointer la tâche note une prise, et une seule', apresPointage.length - avant.length, 1);
  const nouvelle = apresPointage.find((id) => !avant.includes(id));
  vrai('son identifiant dérive de la tâche et du jour', nouvelle.startsWith(`pointage-${tache.id}-`));

  /* ── Dépointer ── */
  const defaire = page.locator(`[data-depointer="${tache.id}"]`);
  vrai('l’écran propose de défaire', await defaire.isVisible());
  await defaire.click();
  await attendreEnBase('odysseeMedicaments', (tout) => tout.length === avant.length);

  const apresRetrait = await lirePrises();
  v('défaire retire la prise qu’il avait créée', apresRetrait.length, avant.length);
  /*
     ET SEULEMENT CELLE-LÀ. Les prises notées plus haut — par « Pris » sur
     un créneau — sont toujours là : elles n'ont pas été créées par ce
     geste, et les effacer serait effacer une déclaration que personne n'a
     reprise.
  */
  v('et seulement celle-là', apresRetrait.sort(), avant.sort());

  /*
     On revient sur Santé : le bloc suivant recharge la page courante pour
     éprouver la fermeture du coffre, et il doit la recharger sur l'écran
     dont il parle.
  */
  await aller('/odyssee/sante/', '#coffre-ouvert');
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
