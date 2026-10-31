/**
 * « Habitude sans pression » — prompt 43, lot F, par l'écran.
 *
 *   npm run essais:habitude:navigateur
 *
 * ## Ce que cet essai mesure, et comment
 *
 * Il part d'une route, sème un profil **synthétique** dans le seul magasin
 * « etat », recharge, et lit ce qui est écrit à l'écran. Chaque contrôle porte
 * sur une phrase visible, jamais sur une variable du code.
 *
 * Deux profils, parce que les deux bandeaux que F1 retire s'excluent l'un
 * l'autre : « en péril » demande une série continuée et un jour non étudié ;
 * « interrompue » demande un trou. Un essai qui n'en sèmerait qu'un ne
 * constaterait que la moitié du retrait, et resterait vert si l'autre bandeau
 * revenait.
 *
 * Playwright n'est pas une dépendance du projet : lancez « astro preview »
 * avant ce script.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { devientVisible } from './lib/post-condition.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(
      `      obtenu  ${String(JSON.stringify(obtenu)).slice(0, 220)}\n      attendu ${String(JSON.stringify(attendu)).slice(0, 220)}`,
    );
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const jour = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const PROFIL_EN_PERIL = {
  xp: 540,
  streakCourante: 7,
  streakRecord: 12,
  dernierJourEtudie: jour(-1),
  badges: [],
  creeLe: jour(-120),
};
const PROFIL_ROMPU = { ...PROFIL_EN_PERIL, streakCourante: 9, dernierJourEtudie: jour(-5) };

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log(`PAGEERROR: ${e.message.slice(0, 200)}`));

const deverrouiller = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
};

/**
 * Le compteur de série a-t-il été peint ?
 *
 * Le gabarit l'écrit « — » et le script le remplace après avoir lu la base.
 * Attendre que le tiret s'en aille est donc une post-condition de la peinture
 * du TABLEAU DE BORD, et non de l'ouverture du coffre : ce sont deux chaînes
 * différentes, et `aller` n'attend que la seconde. C'est le troisième piège,
 * attendre une chose et en lire une autre, et il restait ici après la première
 * passe de réparation — mesuré : quatre assertions tombaient encore sous un
 * processeur bridé vingt fois.
 *
 * Aucun passage antérieur ne peut l'avoir rendue vraie : chaque `aller` est une
 * navigation complète, et le tiret revient avec le gabarit.
 */
const attendreLeCompteur = async () =>
  page
    .waitForFunction(
      () => {
        const valeur = document.getElementById('streak')?.textContent?.trim();
        return valeur !== undefined && valeur !== '' && valeur !== '—';
      },
      undefined,
      { timeout: 20000 },
    )
    .catch(() => {});

const aller = async (chemin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  /*
     APRÈS LE DÉVERROUILLAGE, ON ATTEND QUE L'APPLICATION SOIT LÀ.

     Ces quatre cents millisecondes couvraient le déchiffrement et la première
     peinture, sur CHAQUE navigation de l'essai — une quinzaine. L'écran de
     verrou qui s'en va est la marque que le déchiffrement a abouti ; c'est
     elle qu'on attend, et elle ne dépend pas de la charge de la machine.
  */
  await page
    .waitForFunction(
      () => {
        const verrou = document.getElementById('ecran-verrou');
        return verrou === null || verrou.classList.contains('hidden') || !verrou.offsetParent;
      },
      undefined,
      { timeout: 20000 },
    )
    .catch(() => {});
};

/**
 * Écrit une valeur dans le magasin « etat », par la base, puis rend la main.
 *
 * Tout le semis de cet essai passe par là : un profil, une rotation. Rien
 * d'autre n'est touché, et rien n'est réel.
 */
const semer = (clef, valeur) =>
  page.evaluate(async ([clef, valeur]) => {
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    await new Promise((ok, ko) => {
      const tx = base.transaction('etat', 'readwrite');
      tx.objectStore('etat').put(valeur, clef);
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
  }, [clef, valeur]);

/**
 * Une semaine sans aucun jour de repos.
 *
 * La prémisse de F3 en dépend : un jour de repos n'est PAS un oubli, et la
 * grâce n'aurait rien à absorber. En posant la rotation, l'essai ne dépend
 * plus de ce que le parcours propose par défaut — ni de ce qu'il proposera.
 */
const SEPT_JOURS_TRAVAILLES = {
  rotations: {
    insp: [
      'cas-pratique',
      'droit-public',
      'finances-publiques',
      'economie',
      'questions-europeennes',
      'questions-internationales',
      'questions-sociales',
    ],
  },
  trimestreEcarte: null,
};

/** Une fiche est-elle atteignable, ici et maintenant, au doigt ? */
const premiereFicheVisible = () =>
  page
    .locator('a[href*="/fiche/?id="]')
    .first()
    .isVisible()
    .catch(() => false);

const semerLeProfil = (profil) =>
  page.evaluate(async (profil) => {
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    await new Promise((ok, ko) => {
      const tx = base.transaction('etat', 'readwrite');
      tx.objectStore('etat').put(profil, 'profil');
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
  }, profil);

/**
 * Le texte visible de la page, EN MINUSCULES et apostrophes droites.
 *
 * `innerText` rend la casse APPLIQUÉE PAR LE STYLE : la classe « etiquette »
 * met ses intitulés en capitales, et « Série en cours » s'y lit « SÉRIE EN
 * COURS ». Un contrôle sensible à la casse était donc vert des deux côtés,
 * avant comme après le correctif, et ne prouvait rien — il a fallu le
 * mesurer sur la construction d'avant pour s'en apercevoir.
 *
 * Tout ce qui est cherché ici s'écrit donc en minuscules.
 */
const texteDeLaPage = async () =>
  (await page.locator('body').innerText()).replace(/[’ʼ]/g, "'").toLowerCase();

try {
  await aller('/');
  await franchirInitialisation(page, RACINE, MDP);

  console.log('\nF1 — LA SÉRIE EN PÉRIL NE PRESSE PLUS PERSONNE');
  await aller('/revisions/');
  await semerLeProfil(PROFIL_EN_PERIL);
  await aller('/revisions/');

  /* La prémisse d'abord : sans elle, les trois contrôles suivants seraient
     verts sur un écran qui ne montre simplement aucune série. */
  vrai(
    'le semis a pris : la série de sept jours est à l’écran',
    (await attendreLeCompteur(), await page.locator('#streak').innerText().catch(() => '')).trim() === '7',
  );

  let texte = await texteDeLaPage();
  faux("« s'arrête ce soir » n'est plus écrit nulle part", texte.includes("s'arrête ce soir"));
  faux('aucun sablier de compte à rebours', texte.includes('⏳'));
  v("le bandeau de relance n'existe plus dans le document", await page.locator('#alerte-streak').count(), 0);

  console.log('\nF1 — LA SÉRIE INTERROMPUE NE REPROCHE PLUS RIEN');
  await semerLeProfil(PROFIL_ROMPU);
  await aller('/revisions/');
  texte = await texteDeLaPage();
  faux("« La série s'est interrompue » n'est plus écrit", texte.includes("s'est interrompue"));
  faux("aucune relance « en relance une nouvelle »", texte.includes('relance une nouvelle'));
  vrai(
    'le compteur dit toujours ce qu’il sait : le record est affiché',
    texte.includes('record'),
  );
  console.log('\nF3 — UN JOUR OUBLIÉ PAR SEMAINE NE CASSE PLUS LA SÉRIE');
  await semer('planification', SEPT_JOURS_TRAVAILLES);

  /* Un jour sauté, aucune grâce encore consommée : la série tient. */
  await semerLeProfil({ ...PROFIL_EN_PERIL, streakCourante: 7, dernierJourEtudie: jour(-2) });
  await aller('/revisions/');
  v(
    'un jour oublié, la série de sept jours est intacte',
    (await attendreLeCompteur(), await page.locator('#streak').innerText().catch(() => '')).trim(),
    '7',
  );

  /* La même situation, la grâce consommée avant-hier : la série tombe. Ce
     contrôle est aussi la PRÉMISSE du précédent — si le jour sauté n'était
     pas compté comme un oubli, celui-ci rougirait. */
  await semerLeProfil({
    ...PROFIL_EN_PERIL,
    streakCourante: 7,
    dernierJourEtudie: jour(-2),
    graceUtiliseeLe: jour(-2),
  });
  await aller('/revisions/');
  v(
    'la grâce déjà consommée cette semaine : la série est rompue',
    (await attendreLeCompteur(), await page.locator('#streak').innerText().catch(() => '')).trim(),
    '0',
  );

  /* La grâce se renouvelle au bout de sept jours. */
  await semerLeProfil({
    ...PROFIL_EN_PERIL,
    streakCourante: 7,
    dernierJourEtudie: jour(-2),
    graceUtiliseeLe: jour(-9),
  });
  await aller('/revisions/');
  v(
    'la grâce d\u2019il y a neuf jours est de nouveau disponible',
    (await attendreLeCompteur(), await page.locator('#streak').innerText().catch(() => '')).trim(),
    '7',
  );

  /* Deux jours oubliés d'affilée : la grâce absorbe l'accident, pas l'arrêt. */
  await semerLeProfil({ ...PROFIL_EN_PERIL, streakCourante: 7, dernierJourEtudie: jour(-3) });
  await aller('/revisions/');
  v(
    'deux jours oubliés : la série est rompue, grâce ou non',
    (await attendreLeCompteur(), await page.locator('#streak').innerText().catch(() => '')).trim(),
    '0',
  );

  texte = await texteDeLaPage();
  vrai(
    'la règle est écrite sous le compteur',
    texte.includes('un jour oublié par semaine ne casse pas la série'),
  );
  console.log('\nF2 — « AFFICHER LA SÉRIE ET L\u2019XP », ALLUMÉ PAR DÉFAUT');
  await semerLeProfil({ ...PROFIL_EN_PERIL, xp: 540, dernierJourEtudie: jour(-1) });
  await aller('/parametres/#affichage');
  const interrupteur = page.locator('#reglage-serie-xp [role="switch"]');
  /*
     Les lectures sont bornées et rattrapées : quand le réglage n'existe pas
     — c'était l'état d'avant ce lot —, l'essai doit rendre une suite de
     rouges lisibles, et non une panne d'outillage au bout de trente
     secondes d'attente.
  */
  const etatDe = (quoi) =>
    page
      .locator(quoi)
      .getAttribute('aria-checked', { timeout: 2000 })
      .catch(() => null);
  const basculer = () =>
    page
      .locator('#reglage-serie-xp [role="switch"]')
      .click({ timeout: 2000 })
      .catch(() => {});

  v('le réglage est à la page Paramètres, dans Affichage', await interrupteur.count(), 1);
  v(
    'il est allumé par défaut : rien n\u2019est retiré à personne',
    await etatDe('#reglage-serie-xp [role="switch"]'),
    'true',
  );
  vrai(
    'le libellé dit ce qu\u2019il règle',
    (await page.locator('#reglage-serie-xp').innerText({ timeout: 2000 }).catch(() => ''))
      .toLowerCase()
      .includes('afficher la série et l’xp'),
  );

  console.log('\nF2 — ÉTEINT, LES SCORES DISPARAISSENT DES ÉCRANS');
  await basculer();
  /*
     ON ATTEND L'ÉTAT QU'ON VA LIRE, et non trois cents millisecondes.

     L'interrupteur écrit son réglage puis repeint son attribut : la bascule
     est asynchrone. Sous un processeur bridé douze fois, la lecture arrivait
     avant la peinture. L'attente est bornée, donc son expiration reste un
     rouge — on n'a retiré que l'exigence que la peinture tienne en 300 ms,
     qui mesurait la machine et non l'écran.
  */
  await page
    .waitForFunction(
      () =>
        document
          .querySelector('#reglage-serie-xp [role="switch"]')
          ?.getAttribute('aria-checked') === 'false',
      undefined,
      { timeout: 10000 },
    )
    .catch(() => {});
  v('l\u2019interrupteur est éteint', await etatDe('#reglage-serie-xp [role="switch"]'), 'false');

  await aller('/revisions/');
  /* EXISTE, ET EST CACHÉE. « isHidden » rend vrai sur un élément ABSENT :
     sans le compte, le contrôle serait vert sur une page qui n'aurait
     jamais porté cette carte. */
  vrai(
    'la carte du niveau existe et est retirée de la vue',
    (await page.locator('#carte-niveau').count()) === 1 &&
      (await page.locator('#carte-niveau').isHidden().catch(() => false)),
  );
  vrai(
    'la carte de la série existe et est retirée de la vue',
    (await page.locator('#carte-streak').count()) === 1 &&
      (await page.locator('#carte-streak').isHidden().catch(() => false)),
  );
  texte = await texteDeLaPage();
  faux('aucun total d\u2019XP à l\u2019écran', texte.includes('xp au total'));
  faux('aucun compteur de série', texte.includes('série en cours'));
  vrai(
    'la régularité reste : elle dit ce qu\u2019on a travaillé, pas ce qu\u2019on a marqué',
    texte.includes('huit dernières semaines'),
  );
  faux('et sa légende ne nomme plus l\u2019XP', texte.includes("reflète l'xp gagné"));

  await aller('/progression/');
  texte = await texteDeLaPage();
  faux('le récapitulatif ne porte plus la série record', texte.includes('série record'));
  vrai('il porte toujours ce qui n\u2019est pas un score', texte.includes('cartes suivies'));

  console.log('\nF2 — RALLUMÉ, RIEN N\u2019A ÉTÉ PERDU');
  await aller('/parametres/#affichage');
  await basculer();
  /* Le réglage doit être ÉCRIT avant qu'on quitte la page : une navigation
     qui part trop tôt emporte l'ancien état, et l'écran d'après le montre. */
  await page
    .waitForFunction(
      () =>
        document
          .querySelector('#reglage-serie-xp [role="switch"]')
          ?.getAttribute('aria-checked') === 'true',
      undefined,
      { timeout: 10000 },
    )
    .catch(() => {});
  await aller('/revisions/');
  texte = await texteDeLaPage();
  vrai(
    'le total d\u2019XP est revenu intact : le calcul n\u2019avait pas cessé',
    texte.includes('540 xp au total'),
  );
  vrai(
    'la carte de la série est de retour',
    await page.locator('#carte-streak').isVisible().catch(() => false),
  );
  console.log('\nF4 — LIRE N\u2019EST PAS MAÎTRISER');
  await aller('/revisions/');
  const maitriseAvant = (await page.locator('#maitrise').innerText().catch(() => '')).trim();
  v('prémisse : la maîtrise part de zéro', maitriseAvant, '0 %');

  /* Le geste réel : ouvrir une fiche depuis la bibliothèque et la marquer
     lue. Écrire l'état en base aurait éprouvé le calcul sans éprouver le
     chemin par lequel une personne y arrive. */
  await aller('/bibliotheque/');
  /*
     LA BIBLIOTHÈQUE RANGE SES FICHES DANS DEUX DÉPLIANTS IMBRIQUÉS — la
     matière, puis le fascicule. Le lien est dans le document dès le départ,
     mais il ne mesure RIEN tant qu'ils sont fermés : une sonde l'a montré
     (boîte de 0 × 0, deux « details » au-dessus), et le clic attendait
     trente secondes un élément invisible. Pire, l'essai continuait ensuite
     sur l'écran de la bibliothèque et son contrôle suivant passait au vert
     sans avoir rien marqué.

     On fait donc les deux gestes qu'une personne fait.
  */
  for (let i = 0; i < 4; i += 1) {
    if (await premiereFicheVisible()) break;
    /* Visés DANS LA LISTE : la mise en page porte elle aussi des dépliants,
       et ouvrir « Cet espace — réglages et données » n'approche d'aucune
       fiche. C'est la leçon du lot précédent, payée une fois déjà. */
    const ferme = page.locator('#liste details:not([open]) > summary').first();
    if (!(await ferme.count())) break;
    await ferme.click().catch(() => {});
    /* Le dépliant ouvert est la post-condition du clic ; sans elle, la boucle
       rouvrait le même quatre fois sous un processeur bridé. */
    await ferme.evaluate((s) => s.parentElement?.hasAttribute('open')).catch(() => false);
    await page
      .waitForFunction(
        () => document.querySelectorAll('#liste details[open]').length > 0,
        undefined,
        { timeout: 5000 },
      )
      .catch(() => {});
  }
  vrai('la bibliothèque offre une fiche', await premiereFicheVisible());
  const premiereFiche = page.locator('a[href*="/fiche/?id="]').first();
  await premiereFiche.click({ timeout: 10_000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await deverrouiller();
  const boutonLu = page.locator('#bouton-lu');
  /* Le bouton existe dès le rendu, mais son libellé n'est posé qu'une fois
     l'état de la fiche lu en base : cliquer avant, c'est cliquer sur un
     bouton qui ne sait pas encore ce qu'il fait. */
  await boutonLu
    .filter({ hasText: /Marquer comme lue|Fiche lue/ })
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await boutonLu.click({ timeout: 5000 }).catch(() => {});
  /*
     LE LIBELLÉ EST ÉCRIT APRÈS UNE ÉCRITURE EN BASE, et c'est lui qu'on lit.
     Huit cents millisecondes le couvraient d'habitude ; sous charge, non.
  */
  await boutonLu
    .filter({ hasText: 'Fiche lue' })
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  v(
    'prémisse : la fiche est marquée lue',
    (await boutonLu.innerText().catch(() => '')).trim(),
    '✓ Fiche lue',
  );

  await aller('/revisions/');
  v(
    'une fiche lue ne fait pas monter la jauge de maîtrise',
    (await page.locator('#maitrise').innerText().catch(() => '')).trim(),
    '0 %',
  );

  console.log('\nF4 — LES QUATRE NOTES RAPPORTENT AUTANT');
  await aller('/flashcards/');
  const taille = page.locator('#choix-taille');
  /* La plus petite session offerte : l'essai doit noter toutes les cartes,
     et il n'a aucune raison d'en noter quarante. */
  const valeurs = await taille.locator('option').evaluateAll((os) => os.map((o) => o.value));
  await taille.selectOption(valeurs.map(Number).sort((a, b) => a - b)[0]
    ? String(valeurs.map(Number).sort((a, b) => a - b)[0])
    : valeurs[0]);
  await page.locator('#lancer').click();
  await page.locator('#session:not(.hidden)').waitFor({ timeout: 90_000 });

  /* Toutes les cartes notées « Facile », qui valait SEPT et vaut CINQ : un
     mélange de notes aurait pu tomber en moyenne sur cinq et ne rien
     prouver. */
  /* Les définitions se lisent dans la session : c'est le seul endroit où
     elles sont à l'écran. Sur l'accueil, le bloc de notation existe mais
     reste caché, et « innerText » — qui ne rend que le visible — n'en
     voyait rien. Le premier essai cherchait donc ces phrases sur l'écran
     d'accueil, et rougissait sans qu'aucune faute soit du code. */
  await page.locator('#carte').click().catch(() => {});
  /* Le bloc de notation VISIBLE est la post-condition du retournement, et
     c'est exactement ce que « innerText » va lire — il ne rend que le
     visible. */
  await devientVisible(page, '#notation', true);
  const notation = (await page.locator('#notation').innerText().catch(() => '')).toLowerCase();
  vrai('« Oublié » dit ce qu\u2019il veut dire', notation.includes('vous ne saviez pas'));
  vrai('« Difficile » aussi', notation.includes('retrouvé, mais avec peine'));
  vrai('« Correct » aussi', notation.includes('su, après un temps de réflexion'));
  vrai('« Facile » aussi', notation.includes('su tout de suite'));
  vrai(
    'et la règle est dite : la note choisit la date, pas la récompense',
    notation.includes('les quatre rapportent'),
  );

  let notees = 0;
  let inedites = 0;
  for (let i = 0; i < 60; i += 1) {
    if (await page.locator('#bilan:not(.hidden)').count()) break;
    if (
      (await page.locator('#source-carte').innerText().catch(() => '')).includes('nouvelle carte')
    ) {
      inedites += 1;
    }
    await page.locator('#carte').click().catch(() => {});
    /*
       LE ROUGE MESURÉ ÉTAIT ICI, et il mentait doucement.

       Cent vingt millisecondes après le retournement, la boucle regardait UNE
       FOIS si le bouton « Facile » était là et SORTAIT sinon. Sous un
       processeur bridé douze fois, il n'était pas encore peint au premier
       tour : la boucle notait une carte au lieu de quatre, et l'assertion
       d'après — « les 1 cartes rapportent 1 × 5 » — comparait un total juste
       à un compte faux. Elle rougissait donc pour la bonne raison, sans que
       rien ne dise laquelle.

       L'attente bornée distingue les deux cas que la temporisation
       confondait : le bouton tarde, ou il ne viendra pas. Seul le second
       justifie de sortir.
    */
    const bouton = page.locator('[data-note="facile"]');
    if (!(await devientVisible(page, '[data-note="facile"]', true, { delai: 8000 }))) break;
    await bouton.click();
    notees += 1;
    /* La carte suivante est arrivée quand le bouton a disparu — ou quand le
       bilan paraît, si c'était la dernière. */
    await Promise.race([
      page.waitForSelector('[data-note="facile"]', { state: 'hidden', timeout: 8000 }),
      page.waitForSelector('#bilan:not(.hidden)', { timeout: 8000 }),
    ]).catch(() => {});
  }
  /* Le bilan non vide est la post-condition de la fin de session. */
  await page
    .waitForFunction(
      () => (document.getElementById('bilan-detail')?.innerText ?? '').trim().length > 0,
      undefined,
      { timeout: 15000 },
    )
    .catch(() => {});
  const bilan = (await page.locator('#bilan-detail').innerText().catch(() => '')).trim();
  vrai('prémisse : des cartes ont été notées', notees > 0);
  vrai(
    `les ${notees} cartes « Facile » rapportent ${notees} × 5, et non × 7`,
    bilan.includes(`+${notees * 5} XP`),
  );

  console.log('\nF5 — LE RETARD EST COMPTÉ À PART, ET IL EST PROPOSÉ DE SOUFFLER');
  /* Cent une cartes en retard, clonées d'un état RÉEL écrit par la session
     qu'on vient de faire : une carte inventée porterait un identifiant de
     fiche que le manifeste ne connaît pas, et ne serait comptée nulle
     part. */
  const semis = await page.evaluate(async () => {
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const reelles = await new Promise((ok) => {
      const q = base.transaction('cartes').objectStore('cartes').getAll();
      q.onsuccess = () => ok(q.result);
    });
    if (!reelles.length) return { reelles: 0, clones: 0 };
    const avant = new Date();
    avant.setDate(avant.getDate() - 3);
    const veille = avant.toISOString().slice(0, 10);
    await new Promise((ok, ko) => {
      const tx = base.transaction('cartes', 'readwrite');
      const magasin = tx.objectStore('cartes');
      /* Les cartes RÉELLES passent en retard : ce sont elles que la session
         pourra servir, puisqu'elles existent dans une fiche. */
      for (const carte of reelles) magasin.put({ ...carte, du: veille });
      /* Et cent une clones, pour que le COMPTEUR franchisse le seuil. Elles
         ne sont servies par aucune session — leur identifiant n'est dans
         aucune fiche —, ce qui est exactement le cas d'une carte dont la
         question a été réécrite. */
      for (let i = 0; i < 101; i += 1) {
        magasin.put({ ...reelles[0], id: `essai-retard-${i}`, du: veille, intervalle: 2 });
      }
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
    return { reelles: reelles.length, clones: 101 };
  });
  vrai('prémisse : des cartes réelles sont passées en retard', semis.reelles > 0);
  v('prémisse : cent une cartes de plus sont en retard', semis.clones, 101);

  await aller('/flashcards/');
  vrai(
    'le nombre « en retard » est affiché à part',
    Number((await page.locator('#nb-retard').innerText().catch(() => '0')).trim()) >= 101,
  );
  v(
    'et il ne gonfle pas le nombre du jour',
    Number((await page.locator('#nb-dues').innerText().catch(() => '999')).trim()) < 101,
    true,
  );
  vrai(
    'au-delà de cent, l\u2019écran propose de laisser les cartes neuves',
    await page.locator('#proposition-retard').isVisible().catch(() => false),
  );
  const sansNeuves = await page.locator('#lancer-sans-neuves').boundingBox({ timeout: 2000 }).catch(() => null);
  vrai('la proposition porte un bouton', Boolean(sansNeuves));
  v(
    'qui tient le plancher de 44 px',
    sansNeuves ? Math.round(sansNeuves.height) >= 44 : null,
    true,
  );

  vrai(
    'prémisse : une session ordinaire sert, elle, des cartes inédites',
    inedites > 0,
  );

  await page.locator('#lancer-sans-neuves').click().catch(() => {});
  await page.locator('#session:not(.hidden)').waitFor({ timeout: 90_000 }).catch(() => {});
  /* La session entière est parcourue : une carte inédite servie en
     troisième position ne doit pas échapper au contrôle. */
  let servies = 0;
  let ineditesServies = 0;
  for (let i = 0; i < 60; i += 1) {
    if (!(await page.locator('#session:not(.hidden)').count())) break;
    const source = await page.locator('#source-carte').innerText().catch(() => '');
    if (source.includes('nouvelle carte')) ineditesServies += 1;
    servies += 1;
    await page.locator('#carte').click().catch(() => {});
    /* Même défaut que la boucle de F4, et même parade : l'attente bornée
       distingue « le bouton tarde » de « il ne viendra pas ». */
    const bouton = page.locator('[data-note="correct"]');
    if (!(await devientVisible(page, '[data-note="correct"]', true, { delai: 8000 }))) break;
    await bouton.click();
    await Promise.race([
      page.waitForSelector('[data-note="correct"]', { state: 'hidden', timeout: 8000 }),
      page.waitForSelector('#bilan:not(.hidden)', { timeout: 8000 }),
    ]).catch(() => {});
  }
  vrai('prémisse : la session « sans cartes neuves » a servi des cartes', servies > 0);
  v('et aucune n\u2019était inédite', ineditesServies, 0);

  console.log('\nF6 — « OUI » ET « NON » ONT LE MÊME POIDS');
  await aller('/');
  /*
     Le bloc est RÉVÉLÉ à la main, et il faut le dire : une proposition ne
     paraît qu'une fois par semaine au plus, et attendre la conjonction
     rendrait cet essai muet la plupart du temps. Ce qui est mesuré est la
     MISE EN FORME, qui ne dépend pas de la façon dont le bloc a été montré.
  */
  await page.evaluate(() => {
    document.getElementById('proposition')?.classList.remove('hidden');
  });
  /* Le démasquage est fait PAR l'essai, donc sa visibilité est la seule
     post-condition dont il a besoin — et deux cents millisecondes de plus
     n'ajoutaient rien qu'une chance de moins. */
  await devientVisible(page, '#proposition', true);

  const styles = await page.evaluate(() =>
    ['proposition-oui', 'proposition-plus-tard', 'proposition-non'].map((id) => {
      const bouton = document.getElementById(id);
      if (!bouton) return null;
      const s = getComputedStyle(bouton);
      return {
        fond: s.backgroundColor,
        texte: s.color,
        bordure: `${s.borderTopWidth} ${s.borderTopColor}`,
        graisse: s.fontWeight,
        taille: s.fontSize,
        hauteur: Math.round(bouton.getBoundingClientRect().height),
      };
    }),
  );
  vrai('les trois réponses sont à l\u2019écran', styles.every(Boolean));
  const [oui, plusTard, non] = styles;
  v('« Oui » et « Non » ont le même fond', oui?.fond, non?.fond);
  v('la même couleur de texte', oui?.texte, non?.texte);
  v('la même bordure', oui?.bordure, non?.bordure);
  v('la même graisse', oui?.graisse, non?.graisse);
  v('la même taille de texte', oui?.taille, non?.taille);
  v('et « Plus tard » ne se distingue pas non plus', plusTard?.fond, oui?.fond);
  /*
     Ce contrôle a d'abord cherché un soulignement, parce que « Non » était
     un mot souligné. Mesuré sur la construction d'avant : VERT des deux
     côtés — le soulignement ne venait qu'au survol, et « textDecorationLine »
     au repos vaut « none ». Il ne prouvait rien, et il est remplacé par ce
     qui rend l'égalité vraie plutôt que déclarée : une seule mise en forme,
     écrite une fois.
  */
  v(
    'les trois réponses partagent une seule mise en forme',
    await page.evaluate(
      () =>
        new Set(
          ['proposition-oui', 'proposition-plus-tard', 'proposition-non'].map(
            (id) => document.getElementById(id)?.className ?? '',
          ),
        ).size,
    ),
    1,
  );
  vrai(
    'les trois tiennent le plancher de 44 px',
    styles.every((s) => s && s.hauteur >= 44),
  );
} finally {
  await contexte.close();
  await nav.close();
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les contrôles sont verts.\x1b[0m\n'
    : `\n\x1b[31m${echecs} contrôle${echecs > 1 ? 's' : ''} rouge${echecs > 1 ? 's' : ''}.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
