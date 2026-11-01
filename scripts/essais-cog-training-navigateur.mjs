/**
 * Entraînement cognitif, dans un vrai navigateur.
 *
 *   npm run essais:cog:navigateur
 *
 * Le mot de passe ne se donne PAS sur la ligne de commande : elle reste en
 * clair dans le journal du terminal. Il se pose dans `.env.local`, ignoré
 * par Git, et `motDePasseEssais()` l'y lit — c'est la source unique.
 *
 *   printf 'SITE_PASSWORD=…\n' > .env.local
 *
 * La branche n'avait aucun essai de navigateur : ses deux essais existants,
 * `essais:relationnel` et `essais:veridical`, éprouvent des moteurs purs. Or
 * tout ce que le prompt 51 demande se juge à l'écran — qu'une zone soit
 * visible, qu'un verdict soit lisible, qu'une consigne soit atteignable. Rien
 * de cela ne se lit dans le code.
 *
 * ## Ce qui est mesuré ici, et pourquoi de cette façon
 *
 * **P1 — la zone de jeu est visible au lancement.** C'est le défaut le plus
 * coûteux des trois exercices : sur un téléphone, les réglages de Mémoire de
 * travail poussent la grille sous la ligne de flottaison, et la première
 * épreuve défilait hors de l'écran. L'essai part de la route, touche le bouton
 * de lancement comme on le touche, et mesure le rectangle de la zone contre
 * celui de la fenêtre.
 *
 * Il ne cherche pas `scrollIntoView` dans le code : un appel présent peut ne
 * rien produire — conteneur à défilement imbriqué, zone plus haute que la
 * fenêtre, rendu pas encore fait. C'est la position finale qui compte.
 *
 * **La tolérance est celle de la mise en œuvre, et elle est dite.** Une zone
 * plus haute que la fenêtre ne peut pas y entrer : pour celles-là on exige
 * que la part visible atteigne le seuil que `zone-de-jeu.ts` se donne. Pour
 * les autres, on exige l'intégralité. Exiger « entièrement visible » d'une
 * zone de 900 px dans une fenêtre de 844 serait un essai qu'aucun code ne
 * peut satisfaire.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { attendreLaBoite, repondreALaBoite } from './lib/boite-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { attendreEnBase } from './lib/post-condition.mjs';

const BASE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

/**
 * La tolérance que « zone-de-jeu.ts » se donne, reprise pour ne pas en inventer
 * une autre. Elle porte sur l’écart au DÉCALAGE de la page, lu sur la racine,
 * et non sur l’écart à zéro — voir « positionDeLaZone ».
 */
const TOLERANCE_HAUT = 4;

/**
 * Attend que le défilement de la page se soit arrêté.
 *
 * Deux lectures égales de `scrollY` à une trame d'intervalle, dans une
 * boucle bornée. Le défilement doux du navigateur n'est pas une animation
 * déclarée : il ne se voit ni dans `getAnimations()` ni dans une
 * transition, et la seule chose qu'il offre est sa propre position.
 */
const defilementFini = (page, { delai = 10000, sansDefilement = 400 } = {}) =>
  page.evaluate(
    ([borne, attenteDuDepart]) =>
      new Promise((fini) => {
        /*
           LE DÉFILEMENT A UN ÉVÉNEMENT DE FIN, et il faut s'en servir.

           Cette attente relisait `scrollY` à chaque trame et rendait la main
           dès DEUX LECTURES ÉGALES. Elle a été mesurée fausse une fois sur
           quatre : un défilement doux qui n'a pas encore COMMENCÉ donne deux
           lectures égales, et l'attente rendait la main en pleine descente.
           Relevé le 1er novembre, onze passages de sonde, trois lectures en
           vol — haut à -194 puis -5 puis 111 px, et -324 puis -124 puis 104
           puis 111. La hauteur, elle, ne bougeait pas : c'était bien la
           position qui n'était pas encore arrivée.

           C'est la limite déjà écrite pour `quandCelaSeFixe` dans
           « post-condition.mjs » : une valeur qui n'a pas encore commencé à
           changer est stable elle aussi.

           « scrollend » existe sur ce navigateur — mesuré, Chromium 141 — et
           il se déclenche après la dernière trame d'un défilement doux. C'est
           donc une post-condition EXACTE, et non un pari sur une durée.
        */
        let bouge = false;
        let rendu = false;
        const achever = (raison) => {
          if (rendu) return;
          rendu = true;
          fini(raison);
        };

        /*
           UN DÉFILEMENT IMPOSSIBLE SE SAIT TOUT DE SUITE : une page qui n'a
           pas de quoi défiler ne produira ni événement ni mouvement. On le
           dit plutôt que d'attendre une fin qui ne viendra pas — et c'est le
           cas le plus fréquent avant le lancement, mesuré : scrollY vaut 0
           parce que la page tient dans la fenêtre.
        */
        const racine = document.scrollingElement ?? document.documentElement;
        if (racine.scrollHeight <= innerHeight + 1) {
          achever('aucun défilement possible');
          return;
        }

        addEventListener('scroll', () => { bouge = true; }, { passive: true });
        addEventListener('scrollend', () => achever('scrollend'), { once: true });
        /*
           Et si rien n'a bougé au bout de cette attente, il n'y aura pas de
           défilement : la zone était déjà en place. Ce délai-ci ne se paie QUE
           dans ce cas, et jamais quand un défilement a lieu — l'événement
           arrive alors bien avant.
        */
        setTimeout(() => { if (!bouge) achever('aucun défilement'); }, attenteDuDepart);
        setTimeout(() => achever('EXPIRATION'), borne);
      }),
    [delai, sansDefilement],
  );

/**
 * Avance d'un pas dans une session, et attend le premier des DEUX FAITS
 * possibles : la zone de jeu change, ou la session se termine.
 *
 * ## Pourquoi une course, et non une post-condition unique
 *
 * J'avais d'abord attendu le seul changement de zone, avec une borne de 8 s.
 * Mesuré : l'essai est passé de 191 s à 231 s pour les mêmes 115 assertions.
 * La raison est que le dernier clic d'une session ne change pas la zone — il
 * la termine. L'attente allait donc au bout de sa borne à chaque fin de
 * session, plusieurs fois par exécution.
 *
 * Une attente qui ralentit l'essai sans rien garantir de plus est un mauvais
 * échange : le but du chantier est de supprimer des paris, pas d'en payer le
 * prix deux fois. On attend donc le premier des deux faits, et la borne ne
 * sert plus que de filet.
 *
 * La sortie est donnée comme un MOTIF cherché dans la page entière, parce que
 * les témoins de fin sont des titres et des boutons reconnus par leur texte,
 * ce qu'aucun sélecteur CSS honnête ne sait dire.
 */
const apresAvoirAvance = async (page, geste, motifDeSortie = null) => {
  const lire = () =>
    page
      .locator('[data-zone-de-jeu]')
      .first()
      .textContent()
      .catch(() => null);
  const avant = (await lire()) ?? '';
  await geste();
  await page
    .waitForFunction(
      ({ a, m }) => {
        const zone = document.querySelector('[data-zone-de-jeu]');
        if (zone && (zone.textContent ?? '') !== a) return true;
        return m ? new RegExp(m).test(document.body.textContent ?? '') : false;
      },
      { a: avant, m: motifDeSortie },
      { timeout: 8000 },
    )
    .catch(() => {});
};

let echecs = 0;
const v = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (intitule, condition) => v(intitule, condition === true, true);
/*
   `faux` passe quand la condition est fausse. La première écriture comparait
   « condition === false » à « false », ce qui ne passait QUE si la condition
   était vraie : l'aide affirmait exactement le contraire de son nom. Elle a
   fait rougir un bilan dont le texte, imprimé juste à côté, ne contenait pas
   ce que l'essai prétendait y trouver — c'est l'écart entre le verdict et la
   mesure qui l'a dénoncée.
*/
const faux = (intitule, condition) => v(intitule, condition === false, true);

/*
   Une panne est un échec, et elle se dit en rouge. Sans ce filet, une
   exception tue le script sans imprimer de ligne d'échec, et un banc de
   sabotage en conclut que le contrôle ne mord pas.
*/
const direPanne = (ou, erreur) => {
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m panne pendant « ${ou} » : ${String(erreur).slice(0, 220)}`);
};

/** Les trois exercices, leur route et le libellé de leur bouton de lancement. */
/**
 * LA GRAINE QUE CET ESSAI IMPOSE, ET POURQUOI C'EST ONZE.
 *
 * Les trois écrans tirent leur contenu au hasard. Sans graine, cet essai
 * mesurait donc une page dont la taille changeait à chaque passage : entre un
 * et six rouges, sur n'importe quel arbre, relevé le 1er novembre. La graine
 * passe par `graineDesEssais`, dont l'en-tête dit les deux conditions —
 * automatisation ET variable posée avant le chargement — qui la rendent
 * inaccessible à quiconque ouvre le site.
 *
 * **Onze est CHOISIE, et par la mesure.** Il faut un énoncé PLUS HAUT que la
 * fenêtre : c'est le seul cas où la position du haut est le critère, donc le
 * seul qui éprouve ce que cet essai garde. Une graine qui donnerait un énoncé
 * court ferait passer l'essai par l'autre branche et laisserait le défaut
 * intact — un vert qui ne mesure rien.
 *
 * Relevé à 390×844, en clair, douze graines :
 *
 *      1 → 840 px      7 →  762 px     17 →  960 px
 *      2 → 848 px     11 → 1082 px     19 →  762 px
 *      3 → 848 px     13 →  762 px
 *      5 → 960 px
 *
 * Onze dépasse de 238 px, la marge la plus franche : une retouche de mise en
 * page ne la fera pas basculer du mauvais côté. Et elle est REPRODUCTIBLE —
 * trois passages sur chacune des quatre combinaisons de taille et de thème
 * donnent la même hauteur au pixel : 1082 px sur téléphone, 837 sur
 * ordinateur, où la zone tient et où c'est l'autre branche qui s'applique.
 *
 * Pour la changer : relancer ce relevé, et prendre celle qui dépasse le plus.
 */
const GRAINE_DES_ESSAIS = 11;

const EXERCICES = [
  { nom: 'Mémoire de travail', route: 'quad-n-back', lancer: /^Commencer( la session)?$/ },
  { nom: 'Raisonnement relationnel', route: 'relational-reasoning', lancer: /^Commencer$/ },
  { nom: 'Correspondance perceptive', route: 'veridical-mapping', lancer: /^Commencer$/ },
];

const TAILLES = [
  { nom: 'téléphone', viewport: { width: 390, height: 844 }, tactile: true },
  { nom: 'ordinateur', viewport: { width: 1280, height: 900 }, tactile: false },
];

/** Clair et sombre, obtenus comme la page Paramètres les écrit. */
const MODES = [
  { nom: 'clair', heures: '00:00|23:59' },
  { nom: 'sombre', heures: '03:00|03:01' },
];

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});

/** Ouvre une page prête à jouer : déverrouillée, initialisation franchie, thème posé. */
async function ouvrir(taille, mode, route) {
  const contexte = await nav.newContext({
    viewport: taille.viewport,
    hasTouch: taille.tactile,
    isMobile: taille.tactile,
  });
  const page = await contexte.newPage();
  await page.addInitScript(
    ([heures, graine]) => {
      try {
        localStorage.setItem('revinsp.palette', 'egee');
        localStorage.setItem('revinsp.bascule-jour-nuit', 'oui');
        localStorage.setItem('revinsp.heures-bascule', heures);
      } catch {
        /* navigation privée */
      }
      /*
         LA GRAINE, POSÉE AVANT LE CHARGEMENT. L'application la lit par
         `graineDesEssais`, qui exige en plus que la page soit pilotée par une
         automatisation.
      */
      globalThis.__revinspGraineEssais = graine;
      /*
         ET LE HASARD DU MOTEUR DE MÉMOIRE DE TRAVAIL, qui est du code emprunté
         appelant `Math.random()` directement, sans graine à lui passer. On le
         remplace ICI, dans l'essai, plutôt que de réécrire ce moteur : la
         couture reste alors entièrement du côté de la mesure, et le site
         publié ne porte rien de plus.

         Sans cela, « la découverte propose N répétitions » variait d'un
         passage à l'autre — mesuré : 3, puis 5 —, et le texte du bilan avec
         lui. Le générateur est celui des essais de Veridical Mapping : court,
         sans dépendance, et reproductible.
      */
      let etat = (graine * 2654435761) >>> 0;
      Math.random = () => {
        etat = (etat + 0x6d2b79f5) >>> 0;
        let t = etat;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    [mode.heures, GRAINE_DES_ESSAIS],
  );

  const deverrouiller = async () => {
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
      await page.waitForLoadState('networkidle');
    }
  };

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/cog-training/${route}/`, { waitUntil: 'networkidle' });
  await deverrouiller();
  return { contexte, page };
}

/**
 * Où la zone se trouve dans la fenêtre, après le défilement.
 *
 * Mesuré sur le rectangle rendu, et non sur une classe ou un appel : c'est la
 * position finale qui décide si la personne voit la grille.
 *
 * ## Deux exigences, parce qu'il y a deux situations
 *
 * La première écriture de cet essai exigeait une part visible de 90 %. Elle a
 * trouvé un vrai défaut, mais pas celui qu'elle cherchait : la zone de
 * l'énoncé de Raisonnement mesure **1149 px dans une fenêtre de 844**, et ne
 * peut donc jamais atteindre 90 %. Le code la centrait, ce qui coupait le haut
 * — le début de l'énoncé, là où l'on commence à lire.
 *
 * Une zone qui entre dans la fenêtre doit donc y être ENTIÈREMENT ; une zone
 * plus haute doit avoir son HAUT en haut. C'est une exigence et non deux : le
 * haut en haut suffit dans les deux cas, et l'intégralité n'en est que la
 * conséquence quand la place le permet. On vérifie les deux pour que l'essai
 * dise laquelle a cédé.
 */
const positionDeLaZone = (zone) =>
  zone.evaluate((e) => {
    const r = e.getBoundingClientRect();
    /*
       LE HAUT VISÉ N'EST PAS ZÉRO, ET C'EST LA PAGE QUI LE DIT.

       La racine porte « scroll-padding-top », pour que `scrollIntoView` pose
       la cible SOUS l'en-tête collant au lieu de la glisser dessous. Mesuré le
       1er novembre : 111 px, soit l'en-tête de 103 px et huit de respiration —
       et le haut de la zone s'y pose EXACTEMENT, les neuf fois, sur les trois
       écrans.

       Cet essai exigeait pourtant zéro à quatre pixels près. Il rougissait donc
       chaque fois que la zone était plus haute que la fenêtre, puisque c'est
       alors le seul critère qui s'applique — et il passait sinon, par l'autre
       branche. Toute l'instabilité des « zone de N px dans 844, haut à 111 px »
       vient de là : la hauteur de l'énoncé est tirée au hasard, donc la branche
       aussi.

       Le décalage est LU sur la page, et non recopié. Écrire 111 ici aurait
       produit un essai faux au premier changement de l'en-tête, et faux en
       silence — c'est la faute du diviseur figé, dans l'autre sens.
    */
    const dit = getComputedStyle(document.documentElement).scrollPaddingTop;
    const decalage = Number.parseFloat(dit);
    return {
      haut: Math.round(r.top),
      hauteur: Math.round(r.height),
      fenetre: innerHeight,
      decalage: Number.isFinite(decalage) ? Math.round(decalage) : 0,
      entiere: r.top >= -1 && r.bottom <= innerHeight + 1,
    };
  });

console.log('\nP1 — LA ZONE DE JEU EST VISIBLE AU LANCEMENT');

for (const taille of TAILLES) {
  for (const mode of MODES) {
    for (const exercice of EXERCICES) {
      const ou = `${exercice.nom} · ${taille.nom} · ${mode.nom}`;
      let contexte;
      try {
        const ouvert = await ouvrir(taille, mode, exercice.route);
        contexte = ouvert.contexte;
        const page = ouvert.page;

        const lancer = page.getByRole('button', { name: exercice.lancer }).first();
        await lancer.waitFor({ state: 'visible', timeout: 30000 });

        /*
           Un bouton désactivé n'est pas un succès silencieux : il veut dire
           qu'aucune unité n'est retenue, et l'essai doit le dire plutôt que
           passer au suivant.
        */
        if (await lancer.isDisabled()) {
          echecs += 1;
          console.log(
            `  \x1b[31m✗\x1b[0m ${ou} : le bouton de lancement est désactivé, rien n'a pu être mesuré`,
          );
          await contexte.close();
          continue;
        }

        /* On part volontairement du bas de la page : c'est le pire cas. */
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        await lancer.click();

        const zone = page.locator('[data-zone-de-jeu]').first();
        await zone.waitFor({ state: 'visible', timeout: 30000 });
        /*
           LE DÉFILEMENT DOUX A UNE FIN OBSERVABLE, et ce n'est pas une
           animation du Web Animations API : `scrollTo({ behavior: 'smooth' })`
           n'apparaît pas dans `getAnimations()`, donc `apresLesAnimations` ne
           le verrait pas. Ce qu'on peut observer, c'est que la POSITION
           CESSE DE CHANGER.

           On relit `scrollY` à chaque trame jusqu'à deux lectures égales de
           suite. C'est une attente bouclée et bornée, pas un pari : elle
           rend la main quand le défilement s'arrête, et l'assertion qui
           suit mesure justement cette position.
        */
        const raison = await defilementFini(page);

        const { haut, hauteur, fenetre, decalage, entiere } = await positionDeLaZone(zone);
        /*
           « TENIR » SE MESURE SOUS L'EN-TÊTE, et non dans la fenêtre entière.

           C'était « hauteur <= fenetre ». Pour la zone de Raisonnement sur
           ordinateur — 837 px dans 900 —, l'essai concluait donc qu'elle tenait,
           et exigeait de la voir EN ENTIER. Mais posée au décalage que la page
           impose, 83 px, elle finit à 920 : elle dépasse de vingt pixels, et
           l'exigence était inatteignable.
           
           La place réellement disponible est la fenêtre MOINS le décalage. En
           dessous, on exige le haut en place ; au-dessus, l'intégralité.

           Ce cas-là était invisible avant la graine : la hauteur de l'énoncé
           étant tirée au hasard, il tombait une fois sur plusieurs et se
           mêlait aux autres instabilités.
        */
        const tient = hauteur <= fenetre - decalage;
        /*
           LE HAUT EST COMPARÉ AU DÉCALAGE DE LA PAGE, non à zéro. Voir
           « positionDeLaZone » : la page impose 111 px pour dégager l'en-tête
           collant, et c'est le bon comportement.
        */
        const hautEnPlace = Math.abs(haut - decalage) <= TOLERANCE_HAUT;
        /*
           ET UNE ATTENTE QUI A EXPIRÉ NE SE TAIT PAS. Sans cette ligne, un
           défilement qui ne finit jamais ferait mesurer une position en vol, et
           le rouge tomberait sur l'assertion de position sans nommer sa cause.
        */
        if (raison === 'EXPIRATION') {
          echecs += 1;
          console.log(
            `  \x1b[31m✗\x1b[0m ${ou} : le défilement n'a pas fini en 10 s — position non mesurable`,
          );
          await contexte.close();
          continue;
        }
        /*
           L'exigence dépend de la situation, et ma première écriture les
           confondait : elle réclamait le haut à zéro même d'une zone DÉJÀ
           entièrement visible. Une page qui n'a plus de quoi défiler laisse
           alors le haut à 68 px, et l'essai rougissait devant un écran
           parfaitement lisible. Ce qui compte est ce que la personne voit : la
           zone en entier si elle entre, son début sinon.
        */
        vrai(
          `${ou} — ${
            tient
              ? `entièrement visible, haut à ${haut} px`
              : `zone de ${hauteur} px dans ${fenetre}, haut à ${haut} px pour ${decalage} visés`
          }`,
          tient ? entiere : hautEnPlace,
        );

        /*
           ET LA PAGE NE DÉBORDE PAS EN LARGEUR, mesuré ici parce qu'il n'y
           avait rien pour le voir.

           La rangée de l'écran de jeu de Mémoire portait deux boutons, une
           jauge, un compteur et deux pastilles, dont une seule réductible : la
           page passait à 442 px de large sur un écran de 390, et emportait la
           barre de navigation du bas hors de l'écran. Le défaut n'apparaissait
           que pendant la seconde de battement, celle de « préparez-vous… » —
           assez court pour qu'aucune capture ne le prenne, assez long pour que
           la consigne y devienne intouchable.
        */
        const debord = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        vrai(`${ou} — aucun débordement en largeur`, debord <= 1);

        await contexte.close();
      } catch (erreur) {
        direPanne(ou, erreur);
        await contexte?.close().catch(() => {});
      }
    }
  }
}

/* ════════════════════════════════════════════════════════════════════════
   P5 — LE VERDICT DE CORRESPONDANCE, EN MOTS ET EN SIGNES
   ════════════════════════════════════════════════════════════════════════

   Avant ce lot, seul le cadre disait juste ou faux : « border-emerald-500 »
   contre « border-rose-500 ». Qui ne distingue pas ces deux teintes n'avait
   aucun moyen de connaître son résultat, ni la bonne réponse. On mesure donc
   trois choses, et dans la page rendue : qu'un texte existe, qu'il porte un
   signe ET des mots, et qu'il soit dans une région annoncée.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nP1 (SUITE) — LE TEMPS MORT AVANT LA PREMIÈRE ÉPREUVE');

/*
   CE QUE CETTE SECTION MESURE, ET CE QU'ELLE NE MESURE PAS.

   « amenerLaZone » ne rend la main que lorsque la zone de jeu est en place, et
   Mémoire de travail ATTEND cette promesse avant de programmer sa première
   épreuve — à une seconde de battement près, affichée par le badge
   « préparez-vous… ». Les deux autres écrans ne l'attendent pas : rien n'y
   démarre tout seul.

   La fonction visait le haut à ZÉRO alors que la page impose un décalage pour
   dégager l'en-tête collant. Pour une zone PLUS HAUTE que la fenêtre, aucune de
   ses deux conditions n'était donc jamais vraie : elle tombait chaque fois dans
   sa sortie de secours de 1200 ms, et la personne attendait d'autant plus.

   ON NE MESURE PAS LE DÉFILEMENT. Il se termine en 310 à 470 ms de toute façon,
   fonction corrigée ou non — mesuré. Une assertion sur la position du haut
   serait donc VAINE pour ce défaut-là : elle passerait avant comme après.

   On mesure ce que la personne attend : la disparition de « préparez-vous… »,
   c'est-à-dire le moment où l'exercice démarre vraiment.

   Et sur une fenêtre COURTE, parce que c'est la seule où la zone de Mémoire
   dépasse : 705 px dans 640, mesuré. À 844 elle tient — 680 px —, la promesse
   se résout par l'autre branche, et le défaut ne se montre pas.
*/
{
  const COURT = { nom: 'téléphone court', viewport: { width: 390, height: 640 }, tactile: true };
  /*
     LE SEUIL. Zone en place vers 310 ms, plus la seconde de battement : environ
     1310 ms attendus. Par la sortie de secours : 1200 + 1000, soit 2200. On
     tranche à 1700 — assez haut pour ne pas rougir sur une machine chargée,
     assez bas pour que le défaut ne passe pas. Le sabotage le vérifie dans les
     deux sens.
  */
  const SEUIL_MS = 1700;
  const memoire = EXERCICES.find((e) => e.route === 'quad-n-back');
  let contexte;
  try {
    const ouvert = await ouvrir(COURT, MODES[0], memoire.route);
    contexte = ouvert.contexte;
    const page = ouvert.page;

    const lancer = page.getByRole('button', { name: memoire.lancer }).first();
    await lancer.waitFor({ state: 'visible', timeout: 30000 });
    if (await lancer.isDisabled()) {
      echecs += 1;
      console.log(`  \x1b[31m✗\x1b[0m ${COURT.nom} : le bouton de lancement est désactivé`);
    } else {
      await lancer.click();
      const zone = page.locator('[data-zone-de-jeu]').first();
      await zone.waitFor({ state: 'visible', timeout: 30000 });
      const mesure = await page.evaluate(
        (borne) =>
          new Promise((fini) => {
            const t0 = performance.now();
            const regarder = () => {
              const z = document.querySelector('[data-zone-de-jeu]');
              const r = z ? z.getBoundingClientRect() : null;
              /* « préparez-vous… » disparaît quand la première épreuve part. */
              const attend = document.body.textContent.includes('préparez-vous');
              if (!attend) {
                fini({
                  ms: Math.round(performance.now() - t0),
                  hauteur: r ? Math.round(r.height) : null,
                  fenetre: innerHeight,
                });
                return;
              }
              if (performance.now() - t0 > borne) {
                fini({
                  ms: null,
                  hauteur: r ? Math.round(r.height) : null,
                  fenetre: innerHeight,
                });
                return;
              }
              requestAnimationFrame(regarder);
            };
            regarder();
          }),
        SEUIL_MS + 3000,
      );

      /*
         LA PREMIÈRE ASSERTION EST CE QU'IL FAUT VOIR D'ABORD : sans une zone
         plus haute que la fenêtre, la suivante ne mesure rien. Une fenêtre
         qu'une retouche rendrait assez grande ferait passer les deux au vert
         pour la mauvaise raison.
      */
      vrai(
        `${COURT.nom} — la zone dépasse bien la fenêtre : ${mesure.hauteur} px dans ${mesure.fenetre}`,
        mesure.hauteur !== null && mesure.hauteur > mesure.fenetre,
      );
      /*
         LA DURÉE EST DITE AU DIXIÈME DE SECONDE, ET C'EST VOULU.

         Six passages ont donné 1374, 1372, 1380, 1372, 1370 et 1379 ms. Une
         durée ne peut pas être identique d'un passage à l'autre : c'est une
         lecture d'horloge, non un tirage. Mais une ligne qui change de dix
         millisecondes sans rien signifier apprend à ignorer les écarts — et le
         jour où un écart compte, personne ne le regarde plus.

         Au dixième de seconde, les six passages disent « 1,4 s », et une
         différence dans cette ligne redevient un fait : il faut cinquante
         millisecondes pour la produire. La valeur exacte est dite quand
         l'assertion échoue, là où elle sert.
      */
      const enSecondes = (ms) => String(Math.round(ms / 100) / 10).replace('.', ',');
      vrai(
        `${COURT.nom} — l’exercice démarre en ${
          mesure.ms === null ? `plus de ${enSecondes(SEUIL_MS + 3000)}` : enSecondes(mesure.ms)
        } s, sous les ${enSecondes(SEUIL_MS)} s exigées`,
        mesure.ms !== null && mesure.ms < SEUIL_MS,
      );
      if (mesure.ms === null || mesure.ms >= SEUIL_MS) {
        console.log(`      mesure exacte : ${mesure.ms === null ? 'jamais démarré' : mesure.ms + ' ms'}`);
      }
    }
  } catch (e) {
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${COURT.nom} : ${e.message}`);
  } finally {
    if (contexte) await contexte.close();
  }
}

console.log('\nP5 — LE VERDICT DE CORRESPONDANCE EST EN MOTS ET EN SIGNES');

{
  const ou = 'Correspondance · téléphone';
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[0], MODES[0], 'veridical-mapping');
    contexte = ouvert.contexte;
    const page = ouvert.page;

    const lancer = page.getByRole('button', { name: /^Commencer$/ }).first();
    await lancer.waitFor({ state: 'visible', timeout: 30000 });
    await lancer.click();
    await page.locator('[data-zone-de-jeu]').first().waitFor({ state: 'visible', timeout: 30000 });

    /*
       Aucun verdict avant d'avoir répondu : on ne révèle rien par avance.

       Le compte est pris DANS LA ZONE DE JEU, et c'est une correction : la
       mise en page commune porte déjà deux régions « status » masquées, la
       pastille de revue et le témoin de synchronisation. Ma première écriture
       comptait toute la page, trouvait ces deux-là et rougissait devant un
       code correct — puis cherchait le verdict parmi elles.
    */
    const statuts = page.locator('[data-zone-de-jeu] [role="status"]');
    v('aucun verdict avant la réponse', await statuts.count(), 0);

    /*
       On répond comme on répond : en touchant une proposition. À charge 1, ce
       geste vaut validation — c'est le rythme qu'une mesure de seuil demande.
    */
    const propositions = page.getByRole('button', { name: /^Choisir la proposition / });
    const combien = await propositions.count();
    vrai('les propositions sont nommées « proposition » et non « candidat »', combien >= 2);
    await propositions.first().click();

    const statut = statuts.first();
    await statut.waitFor({ state: 'visible', timeout: 15000 });
    const texte = (await statut.innerText()).trim();

    vrai(`le verdict est annoncé dans une région « status » — « ${texte} »`, texte.length > 0);
    vrai('il porte un signe', /[✓✗]/.test(texte));
    vrai(
      'et des mots, pas seulement un signe',
      /juste|n.était pas celle-là|sur \d/i.test(texte),
    );
    vrai(
      'quand la réponse est inexacte, la bonne est nommée',
      /✓ Juste\.$/.test(texte) || /proposition \d/.test(texte),
    );

    /*
       Les signes des cadres, à PLEINE opacité : un signe à demi effacé ne vaut
       pas mieux qu'une couleur seule. C'est le reproche de P14 aux ✓ ✗ ⌛ de
       Mémoire, et il ne doit pas se reproduire ici.
    */
    const opacites = await page
      .locator('[data-zone-de-jeu] span[aria-hidden="true"]')
      .evaluateAll((noeuds) =>
        noeuds
          .filter((n) => /[✓✗]/.test(n.textContent ?? ''))
          .map((n) => getComputedStyle(n).opacity),
      );
    vrai('au moins un cadre porte un signe', opacites.length > 0);
    v('et les signes sont à pleine opacité', [...new Set(opacites)], ['1']);

    await contexte.close();
  } catch (erreur) {
    direPanne(ou, erreur);
    await contexte?.close().catch(() => {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   P6 — LE VERDICT DE RAISONNEMENT PREND LE FOCUS ET EST ANNONCÉ
   ════════════════════════════════════════════════════════════════════════

   Le verdict portait déjà des mots : ce qui manquait, c'est qu'on puisse y
   arriver. Après « Valider », le focus restait sur un bouton qui venait de
   disparaître, et la tabulation reprenait au début de la page. On mesure donc
   la position réelle du focus, et non la présence d'un attribut.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nP6 — LE VERDICT DE RAISONNEMENT PREND LE FOCUS');

{
  const ou = 'Raisonnement · téléphone';
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[0], MODES[0], 'relational-reasoning');
    contexte = ouvert.contexte;
    const page = ouvert.page;

    await page.getByRole('button', { name: /^Commencer$/ }).first().click();
    const zone = page.locator('[data-zone-de-jeu]').first();
    await zone.waitFor({ state: 'visible', timeout: 30000 });

    const statuts = page.locator('[data-zone-de-jeu] [role="status"]');
    v('aucun verdict avant « Valider »', await statuts.count(), 0);

    /*
       Le genre de question varie d'un tirage à l'autre : on répond avec le
       premier organe de réponse présent, plutôt que de supposer un genre.
    */
    const radios = zone.locator('input[type="radio"]');
    const cases = zone.locator('input[type="checkbox"]');
    const listes = zone.locator('select');
    if (await radios.count()) await radios.first().check();
    else if (await cases.count()) await cases.first().check();
    else {
      const combien = await listes.count();
      for (let i = 0; i < combien; i += 1) await listes.nth(i).selectOption({ index: 1 });
    }

    const valider = page.getByRole('button', { name: /^Valider$/ }).first();
    await valider.waitFor({ state: 'visible', timeout: 15000 });
    await valider.click();

    const statut = statuts.first();
    await statut.waitFor({ state: 'visible', timeout: 15000 });
    vrai('le verdict est dans une région « status »', (await statuts.count()) === 1);

    /* LA POSITION RÉELLE DU FOCUS, et non la présence d'un attribut. */
    const surLeVerdict = await page.evaluate(() => {
      const actif = document.activeElement;
      const verdict = document.querySelector('[data-zone-de-jeu] [role="status"]');
      return !!actif && !!verdict && (actif === verdict || verdict.contains(actif));
    });
    vrai('et il porte le focus après « Valider »', surLeVerdict);

    await contexte.close();
  } catch (erreur) {
    direPanne(ou, erreur);
    await contexte?.close().catch(() => {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   P2 — « COMMENT ÇA MARCHE », EN TÊTE ET PENDANT LA PARTIE
   ════════════════════════════════════════════════════════════════════════

   Le constat C1 relève qu'aucun des trois exercices ne disait ce qu'il
   attendait, et qu'aucun ne permettait de revoir la règle en cours de route.
   On mesure donc les deux : l'encart en tête, et la consigne atteignable
   pendant la partie — atteignable voulant dire qu'on peut la toucher et
   qu'elle s'ouvre, pas qu'un bouton existe dans le code.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nP2 — LA CONSIGNE EST LÀ, ET ON PEUT Y REVENIR');

for (const exercice of EXERCICES) {
  const ou = `${exercice.nom} · téléphone`;
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[0], MODES[0], exercice.route);
    contexte = ouvert.contexte;
    const page = ouvert.page;

    /* L'encart en tête, ouvert tant qu'aucune partie n'a été jouée. */
    const encart = page.locator('details').filter({ hasText: 'Comment ça marche' }).first();
    await encart.waitFor({ state: 'visible', timeout: 30000 });
    vrai(`${ou} — l'encart « Comment ça marche » est en tête`, true);
    vrai(
      "et il est ouvert, aucune partie n'ayant été jouée",
      await encart.evaluate((d) => d.open),
    );
    const consigne = (await encart.innerText()).trim();
    vrai('il porte un texte, pas seulement un titre', consigne.length > 80);

    /* Et pendant la partie, on peut y revenir. */
    await page.getByRole('button', { name: exercice.lancer }).first().click();
    await page.locator('[data-zone-de-jeu]').first().waitFor({ state: 'visible', timeout: 30000 });

    const revoir = page.getByRole('button', { name: /^Revoir la consigne$/ }).first();
    await revoir.waitFor({ state: 'visible', timeout: 15000 });
    await revoir.click();

    const boite = page.locator('dialog[open]').filter({ hasText: 'Comment ça marche' }).first();
    await boite.waitFor({ state: 'visible', timeout: 15000 });
    vrai('la consigne se rouvre pendant la partie', await boite.isVisible());
    vrai(
      'et elle y dit la même chose',
      (await boite.innerText()).includes(consigne.split('\n').pop().slice(0, 40)),
    );

    /*
       Elle se referme, et la partie reprend.

       Le bouton est visé dans le dialogue ouvert, sans repasser par le filtre
       de texte : enchaîner un filtre et un rôle sur un dialogue qui vient de
       passer en couche supérieure s'est révélé instable — l'essai échouait
       dans Mémoire alors qu'une sonde montrait le bouton présent et visible.
    */
    const reprendre = page.locator('dialog[open] button', { hasText: 'Reprendre' }).first();
    await reprendre.waitFor({ state: 'visible', timeout: 15000 });
    await reprendre.click();
    /* La boîte était ouverte : son départ est la post-condition du clic. */
    await page.waitForSelector('dialog[open]', { state: 'hidden', timeout: 30000 }).catch(() => {});
    v('la boîte se referme', await page.locator('dialog[open]').count(), 0);

    await contexte.close();
  } catch (erreur) {
    direPanne(ou, erreur);
    await contexte?.close().catch(() => {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   L2 — LA DÉCOUVERTE N'ÉCRIT RIEN
   ════════════════════════════════════════════════════════════════════════

   L'interdit 3 du prompt est le plus strict du lot : ni score, ni niveau, ni
   statistique, ni XP, ni fait, ni journal. On ne le vérifie donc pas en
   lisant le code — un chemin d'écriture oublié ne se voit pas — mais en
   comparant la base AVANT et APRÈS une découverte menée jusqu'au bout.

   Et la même mesure prouve la seconde chose : la découverte est détectée par
   un magasin VIDE. Si elle écrivait, elle se retirerait elle-même la raison
   d'être proposée. Les deux règles tiennent ou tombent ensemble.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL2 — LA DÉCOUVERTE DE MÉMOIRE N’ÉCRIT RIEN');

{
  const ou = 'Mémoire · découverte';
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[1], MODES[0], 'quad-n-back');
    contexte = ouvert.contexte;
    const page = ouvert.page;

    /* L'état de la base, lu comme la page le lirait. */
    const etatDeLaBase = () =>
      page.evaluate(
        () =>
          new Promise((tenir) => {
            const requete = indexedDB.open('revinsp');
            requete.onsuccess = () => {
              const base = requete.result;
              const noms = [...base.objectStoreNames];
              const vises = noms.filter((n) =>
                ['nback', 'relationnel', 'vmSeuils', 'xp', 'faits', 'journal'].includes(n),
              );
              if (!vises.length) {
                tenir({});
                return;
              }
              const tx = base.transaction(vises, 'readonly');
              const sortie = {};
              let restants = vises.length;
              for (const nom of vises) {
                const compte = tx.objectStore(nom).count();
                compte.onsuccess = () => {
                  sortie[nom] = compte.result;
                  restants -= 1;
                  if (restants === 0) tenir(sortie);
                };
              }
            };
            requete.onerror = () => tenir({ erreur: true });
          }),
      );

    const avant = await etatDeLaBase();
    vrai(`${ou} — la base est lisible avant`, !avant.erreur);

    /* La découverte est proposée, et sa durée est dite. */
    const essayer = page.getByRole('button', { name: /^Essayer d’abord|^Essayer d'abord/ }).first();
    await essayer.waitFor({ state: 'visible', timeout: 30000 });
    const libelle = (await essayer.innerText()).trim();
    vrai(`« ${libelle} » annonce une durée`, /\d/.test(libelle));

    /*
       L'HORLOGE EST INSTALLÉE AVANT LE LANCEMENT, et l'ordre n'est pas un
       détail : `clock.install` ne gouverne que les minuteurs posés APRÈS
       elle. Installée après le clic, elle laissait la boucle des épreuves
       tourner sur l'horloge réelle, `runFor` n'avançait rien, et la partie
       n'atteignait jamais son bilan — un essai qui mesurait l'installation de
       l'horloge plutôt que la découverte.
    */
    await page.clock.install();
    await essayer.click();
    await page.locator('[data-zone-de-jeu]').first().waitFor({ state: 'visible', timeout: 30000 });

    /*
       Les réglages de la vraie partie ne doivent pas avoir bougé : la décision
       1 l'interdit. La pastille de l'écran de jeu dit le n de la PARTIE, qui
       doit valoir 1 en découverte — et l'écran de réglages devra toujours
       afficher 2 à la sortie.
    */
    const pastille = await page.locator('[data-zone-de-jeu]').first().innerText();
    vrai('la découverte tourne à n = 1', /n = 1\b/.test(pastille));

    /*
       Douze tours à trois secondes : on avance l'horloge plutôt que d'attendre
       trente-six secondes. `runFor` et non `fastForward` : le second ne
       déclenche chaque minuteur qu'une fois, et la boucle des épreuves en pose
       un par tour.
    */
    await page.clock.runFor(12 * 3000 + 4000);

    const titre = page.locator('h2', { hasText: 'Découverte terminée' }).first();
    await titre.waitFor({ state: 'visible', timeout: 15000 });
    vrai('la découverte se termine sur son propre bilan', await titre.isVisible());

    /*
       Le texte est lu DANS le bilan, et non dans la page : l'écran de réglages
       porte un historique où « XP » figure légitimement, et le chercher
       partout faisait rougir un bilan parfaitement muet sur les points.
    */
    const bilan = await titre.locator('..').innerText();

    /*
       ET LA DÉCOUVERTE A BIEN QUELQUE CHOSE À REPÉRER. Ce contrôle existe
       parce que son absence a coûté cher : le taux de correspondance était
       écrit en fraction là où le réglage attend un pourcentage, la partie ne
       contenait aucune répétition, et le bilan annonçait « 0 répétition sur
       0 » sans qu'aucune erreur ne soit levée. Une découverte sans rien à
       trouver n'apprend rien, et c'est le seul contrôle qui le dise.
    */
    const aReperer = Number((bilan.match(/sur (\d+)/) ?? [])[1] ?? 0);
    vrai(`la découverte propose ${aReperer} répétitions à repérer`, aReperer > 0);
    vrai(
      "et elle dit que rien n'a été enregistré",
      /Rien n’a été enregistré|Rien n'a été enregistré/.test(bilan),
    );
    faux(
      `aucun XP n’est annoncé dans le bilan — « ${bilan.replace(/\n+/g, ' | ')} »`,
      /\bXP\b/.test(bilan),
    );

    const apres = await etatDeLaBase();
    v("la base n'a pas changé", apres, avant);

    await contexte.close();
  } catch (erreur) {
    direPanne(ou, erreur);
    await contexte?.close().catch(() => {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   L2 — LES DEUX AUTRES DÉCOUVERTES N'ÉCRIVENT RIEN NON PLUS
   ════════════════════════════════════════════════════════════════════════

   Raisonnement n'avait AUCUN garde-fou d'écriture, et Correspondance écrit à
   CHAQUE essai et non seulement à la fin : deux raisons de mesurer plutôt que
   de relire. On mène chaque découverte jusqu'au bout — en répondant, puisque
   rien n'y court tout seul — et on compare la base.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL2 — RAISONNEMENT ET CORRESPONDANCE N’ÉCRIVENT RIEN');

const etatDeLaBaseDe = (page) =>
  page.evaluate(
    () =>
      new Promise((tenir) => {
        const requete = indexedDB.open('revinsp');
        requete.onsuccess = () => {
          const base = requete.result;
          const vises = [...base.objectStoreNames].filter((n) =>
            ['nback', 'relationnel', 'vmSeuils', 'xp', 'faits', 'journal'].includes(n),
          );
          if (!vises.length) {
            tenir({});
            return;
          }
          const tx = base.transaction(vises, 'readonly');
          const sortie = {};
          let restants = vises.length;
          for (const nom of vises) {
            const compte = tx.objectStore(nom).count();
            compte.onsuccess = () => {
              sortie[nom] = compte.result;
              restants -= 1;
              if (restants === 0) tenir(sortie);
            };
          }
        };
        requete.onerror = () => tenir({ erreur: true });
      }),
  );

for (const cas of [
  { nom: 'Raisonnement', route: 'relational-reasoning' },
  { nom: 'Correspondance', route: 'veridical-mapping' },
]) {
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[1], MODES[0], cas.route);
    contexte = ouvert.contexte;
    const page = ouvert.page;

    const avant = await etatDeLaBaseDe(page);

    const essayer = page.getByRole('button', { name: /Essayer d’abord|Essayer d'abord/ }).first();
    await essayer.waitFor({ state: 'visible', timeout: 30000 });
    const libelle = (await essayer.innerText()).trim();
    vrai(`${cas.nom} — « ${libelle} » annonce sa taille`, /\d/.test(libelle));
    await essayer.click();

    const zone = page.locator('[data-zone-de-jeu]').first();
    await zone.waitFor({ state: 'visible', timeout: 30000 });

    /*
       On répond jusqu'au bilan. Trente tours au plus : c'est largement au-delà
       des six annoncés, et une boucle bornée vaut mieux qu'une attente qui
       pourrait ne jamais finir si un bouton changeait de nom.
    */
    let tours = 0;
    while (tours < 30) {
      tours += 1;
      const fini = await page
        .locator('h2', { hasText: 'Découverte terminée' })
        .first()
        .isVisible()
        .catch(() => false);
      if (fini) break;

      const radios = zone.locator('input[type="radio"]:not(:disabled)');
      const cases = zone.locator('input[type="checkbox"]:not(:disabled)');
      const listes = zone.locator('select:not(:disabled)');
      const propositions = zone.getByRole('button', { name: /^Choisir la proposition / });

      if (await propositions.count()) await propositions.first().click();
      else if (await radios.count()) await radios.first().check();
      else if (await cases.count()) await cases.first().check();
      else if (await listes.count()) {
        const combien = await listes.count();
        for (let i = 0; i < combien; i += 1) await listes.nth(i).selectOption({ index: 1 });
      }

      const avancer = page
        .getByRole('button', { name: /^Valider$|^Question suivante$|^Essai suivant$|^Voir le bilan$/ })
        .first();
      /*
         AVANCER CHANGE LA ZONE DE JEU : c'est la post-condition du geste, et
         elle vaut pour les quatre libellés possibles sans qu'on ait à savoir
         lequel a été pressé. La borne est courte parce que la boucle re-teste
         à chaque tour : si le changement n'arrive pas, le tour suivant
         constatera que rien n'a bougé et la boucle finira par sa borne, au
         lieu de s'arrêter trente secondes sur un seul geste.
      */
      if (await avancer.count()) {
        await apresAvoirAvance(page, () => avancer.click(), 'Découverte terminée');
      }
    }

    const titre = page.locator('h2', { hasText: 'Découverte terminée' }).first();
    await titre.waitFor({ state: 'visible', timeout: 20000 });
    const bilan = await titre.locator('..').innerText();
    vrai(
      `${cas.nom} — le bilan dit que rien n'a été enregistré`,
      /Rien n’a été enregistré|Rien n'a été enregistré/.test(bilan),
    );
    faux(`${cas.nom} — aucun XP dans le bilan`, /\bXP\b/.test(bilan));

    const apres = await etatDeLaBaseDe(page);
    v(`${cas.nom} — la base n'a pas changé`, apres, avant);

    await contexte.close();
  } catch (erreur) {
    direPanne(`${cas.nom} · découverte`, erreur);
    await contexte?.close().catch(() => {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   P7 — « ARRÊTER » GARDE LES RÉPONSES, ET NE COMPTE PAS DEUX FOIS
   ════════════════════════════════════════════════════════════════════════

   Deux choses à mesurer, et la seconde est celle que le prompt demande de
   vérifier. « terminer » est appelé par « Arrêter » ET par le passage de la
   dernière question : arrêter juste avant la fin pouvait enregistrer DEUX
   sessions pour une. On compte donc les sessions avant et après, et on exige
   exactement une de plus.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nP7 — « ARRÊTER » GARDE LES RÉPONSES, SANS DOUBLE COMPTE');

for (const cas of [
  { nom: 'Raisonnement', route: 'relational-reasoning', magasin: 'relationnel' },
  { nom: 'Correspondance', route: 'veridical-mapping', magasin: 'vmSeuils' },
]) {
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[1], MODES[0], cas.route);
    contexte = ouvert.contexte;
    const page = ouvert.page;

    const sessionsDe = () =>
      page.evaluate(
        () =>
          new Promise((tenir) => {
            const r = indexedDB.open('revinsp');
            r.onsuccess = () => {
              const base = r.result;
              if (![...base.objectStoreNames].includes('relationnel')) {
                tenir({ relationnel: 0, vmSessions: 0 });
                return;
              }
              const noms = [...base.objectStoreNames].filter((n) =>
                ['relationnel', 'vmSessions'].includes(n),
              );
              const tx = base.transaction(noms, 'readonly');
              const sortie = {};
              let restants = noms.length;
              for (const nom of noms) {
                const c = tx.objectStore(nom).count();
                c.onsuccess = () => {
                  sortie[nom] = c.result;
                  restants -= 1;
                  if (restants === 0) tenir(sortie);
                };
              }
            };
            r.onerror = () => tenir({ erreur: true });
          }),
      );

    const avant = await sessionsDe();

    /* La VRAIE session, pas la découverte : c'est elle qui enregistre. */
    await page.getByRole('button', { name: /^Commencer$/ }).first().click();
    const zone = page.locator('[data-zone-de-jeu]').first();
    await zone.waitFor({ state: 'visible', timeout: 30000 });

    /* Une réponse, pour qu'il y ait quelque chose à garder. */
    const radios = zone.locator('input[type="radio"]:not(:disabled)');
    const listes = zone.locator('select:not(:disabled)');
    const propositions = zone.getByRole('button', { name: /^Choisir la proposition / });
    if (await propositions.count()) await propositions.first().click();
    else if (await radios.count()) await radios.first().check();
    else {
      const combien = await listes.count();
      for (let i = 0; i < combien; i += 1) await listes.nth(i).selectOption({ index: 1 });
    }
    const valider = page.getByRole('button', { name: /^Valider$/ }).first();
    if (await valider.count()) {
      await apresAvoirAvance(page, () => valider.click(), 'Arrêter');
    }

    /* Puis « Arrêter », et la confirmation dit ce qui est gardé. */
    const arreter = page.getByRole('button', { name: /^← Arrêter$/ }).first();
    await arreter.waitFor({ state: 'visible', timeout: 15000 });
    await arreter.click();
    await attendreLaBoite(page);
    const texte = await page.locator('dialog.boite[open]').innerText();
    vrai(
      `${cas.nom} — la confirmation dit que les réponses sont gardées`,
      /gardée|gardées/.test(texte),
    );
    await repondreALaBoite(page, 'Arrêter');

    await page
      .locator('h2', { hasText: 'Bilan de la session' })
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });

    const apres = await sessionsDe();
    const clef = cas.nom === 'Raisonnement' ? 'relationnel' : 'vmSessions';

    /*
       Arrêter enregistre exactement une session : c'est la décision 2 —
       les réponses déjà données sont gardées, et une seule fois.
    */
    if (clef in avant && clef in apres) {
      v(`${cas.nom} — exactement une session de plus`, apres[clef] - avant[clef], 1);
    } else {
      vrai(`${cas.nom} — le magasin « ${clef} » a pu être lu`, false);
    }
    /*
       Raisonnement enregistre une session ; Correspondance aussi, dans
       « vmSessions ». Exactement UNE de plus : c'est le double comptage que
       le verrou de `terminer` empêche.
    */
    await contexte.close();
  } catch (erreur) {
    direPanne(`${cas.nom} · Arrêter`, erreur);
    await contexte?.close().catch(() => {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   P7 (SUITE) — UNE SESSION MENÉE AU BOUT N'EN ENREGISTRE QU'UNE
   ════════════════════════════════════════════════════════════════════════

   Ce que cet essai mesure, et ce qu'il ne mesure pas — dit ici parce que je
   me suis trompé dessus.

   Il mène la session à sa dernière question, touche DEUX FOIS « Voir le
   bilan » sans attendre, et exige une seule session enregistrée. Il passe.
   Mais il passe AUSSI quand on retire le verrou de `terminer` : mesuré. Le
   double appel n'est donc pas atteignable au doigt, parce que `terminer` pose
   « etape = bilan » avant son premier « await » et que le bouton disparaît
   aussitôt.

   Il reste utile pour ce qu'il dit vraiment : une session complète en
   enregistre exactement une, et le double clic — geste banal sur un bouton
   qu'on touche à chaque question — n'en fabrique pas une seconde. Il ne
   prouve pas le verrou, et ne le prétend pas.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nP7 (SUITE) — UNE SESSION MENÉE AU BOUT N’EN ENREGISTRE QU’UNE');

{
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[1], MODES[0], 'relational-reasoning');
    contexte = ouvert.contexte;
    const page = ouvert.page;

    const compter = () =>
      page.evaluate(
        () =>
          new Promise((tenir) => {
            const r = indexedDB.open('revinsp');
            r.onsuccess = () => {
              const base = r.result;
              if (![...base.objectStoreNames].includes('relationnel')) {
                tenir(null);
                return;
              }
              const c = base.transaction('relationnel', 'readonly').objectStore('relationnel').count();
              c.onsuccess = () => tenir(c.result);
            };
            r.onerror = () => tenir(null);
          }),
      );

    const avant = await compter();
    vrai('le magasin des sessions est lisible', avant !== null);

    await page.getByRole('button', { name: /^Commencer$/ }).first().click();
    const zone = page.locator('[data-zone-de-jeu]').first();
    await zone.waitFor({ state: 'visible', timeout: 30000 });

    /* On répond jusqu'à voir « Voir le bilan », au plus trente tours. */
    let vu = false;
    for (let tour = 0; tour < 30 && !vu; tour += 1) {
      const radios = zone.locator('input[type="radio"]:not(:disabled)');
      const cases = zone.locator('input[type="checkbox"]:not(:disabled)');
      const listes = zone.locator('select:not(:disabled)');
      if (await radios.count()) await radios.first().check();
      else if (await cases.count()) await cases.first().check();
      else {
        const combien = await listes.count();
        for (let i = 0; i < combien; i += 1) await listes.nth(i).selectOption({ index: 1 });
      }
      const valider = page.getByRole('button', { name: /^Valider$/ }).first();
      if (await valider.count()) {
        await apresAvoirAvance(page, () => valider.click(), 'Voir le bilan');
      }

      const bilan = page.getByRole('button', { name: /^Voir le bilan$/ }).first();
      if (await bilan.count()) {
        vu = true;
        /* Deux clics sans attendre entre les deux. */
        await Promise.all([bilan.click(), bilan.click({ force: true })]).catch(() => {});
        break;
      }
      const suivante = page.getByRole('button', { name: /^Question suivante$/ }).first();
      if (await suivante.count()) {
        await apresAvoirAvance(page, () => suivante.click(), 'Voir le bilan|Bilan de la session');
      }
    }
    vrai('la dernière question a été atteinte', vu);

    await page
      .locator('h2', { hasText: 'Bilan de la session' })
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });
    /*
       DEUX FAITS DE NATURES OPPOSÉES, et les 600 ms les confondaient.

       Une session DOIT être enregistrée : on l'attend en base, c'est une
       post-condition. Une SECONDE ne doit pas l'être, malgré le second clic :
       aucune post-condition ne décrit cela, puisque rien n'arrive. C'est une
       fenêtre d'observation, et elle vient APRÈS la première écriture — donc
       elle couvre bien l'intervalle où la seconde pourrait tomber, ce que
       600 ms à partir du bilan ne garantissaient pas.
    */
    await attendreEnBase(page, 'relationnel', (tout) => tout.length >= avant + 1, { delai: 30000 });
    await page.waitForTimeout(600);

    const apres = await compter();
    v('une seule session enregistrée malgré les deux clics', apres - avant, 1);

    await contexte.close();
  } catch (erreur) {
    direPanne('Raisonnement · double clic', erreur);
    await contexte?.close().catch(() => {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   L4 — L'ACCUEIL DIT PAR OÙ COMMENCER, ET LES MOTS SONT UNIFIÉS
   ════════════════════════════════════════════════════════════════════════

   L'essai de vocabulaire, « essais:mots-cog », lit la source et voit tous les
   cas, y compris ceux qu'un tirage montre une fois sur cent. Celui-ci
   complète par ce qui ne se lit pas dans la source : que l'accueil affiche
   bien ce qu'on attend, et que le glossaire s'ouvre depuis chaque exercice.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL4 — L’ACCUEIL ET LES MOTS');

{
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[0], MODES[0], '');
    contexte = ouvert.contexte;
    const page = ouvert.page;
    await page.goto(`${BASE}/cog-training/`, { waitUntil: 'networkidle' });
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
      await page.waitForLoadState('networkidle');
    }
    await page.waitForSelector('#exercices:not(.hidden)', { timeout: 30000 });
    const texte = await page.locator('main').innerText();

    vrai('l’accueil dit par où commencer', /Nouveau \?/.test(texte));
    vrai('et nomme Raisonnement relationnel', /Commencez par\s+Raisonnement relationnel/.test(texte));
    vrai('chaque carte dit sa durée et son matériel', (texte.match(/Durée et matériel/g) ?? []).length === 3);
    vrai(
      'et ce que l’exercice fait travailler',
      (texte.match(/Ce que l’exercice fait travailler|Ce que l'exercice fait travailler/g) ?? []).length === 3,
    );
    faux('aucun « Utile pour »', /Utile pour/.test(texte));
    faux('aucun « Tableau de bord »', /Tableau de bord/.test(texte));

    /* Le français en titre, l'anglais en petit dessous (décision 3). */
    const titres = await page.locator('#exercices h2').allInnerTexts();
    v(
      'les titres de carte sont en français',
      titres.map((t) => t.trim()),
      ['Mémoire de travail', 'Raisonnement relationnel', 'Correspondance perceptive'],
    );
    vrai('et les noms anglais sont là, en dessous', /Quad N-Back/.test(texte));

    await contexte.close();
  } catch (erreur) {
    direPanne('Accueil', erreur);
    await contexte?.close().catch(() => {});
  }
}

for (const exercice of EXERCICES) {
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[0], MODES[0], exercice.route);
    contexte = ouvert.contexte;
    const page = ouvert.page;

    const glossaire = page.locator('details').filter({ hasText: 'Les mots de ces exercices' }).first();
    await glossaire.waitFor({ state: 'visible', timeout: 30000 });
    await glossaire.locator('summary').click();
    const contenu = await glossaire.innerText();
    vrai(`${exercice.nom} — le glossaire s’ouvre`, contenu.length > 200);
    vrai(
      'et il range les trois exercices',
      ['Mémoire de travail', 'Raisonnement relationnel', 'Correspondance perceptive'].every((n) =>
        contenu.includes(n),
      ),
    );
    vrai('en disant que le mot simple porte le sens', /Le mot simple porte le sens/.test(contenu));

    await contexte.close();
  } catch (erreur) {
    direPanne(`${exercice.nom} · glossaire`, erreur);
    await contexte?.close().catch(() => {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   L5 — RÉGLAGES, TOUCHER, ACCESSIBILITÉ
   ════════════════════════════════════════════════════════════════════════

   Trois choses qui ne se lisent pas dans la source : que le résumé des
   réglages paraisse AVANT leur détail, que les cibles d'appui atteignent le
   plancher du 42, et que la lettre de touche disparaisse au doigt — ce dernier
   point dépend d'une requête média, donc du contexte, donc du navigateur.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL5 — RÉGLAGES, TOUCHER, ACCESSIBILITÉ');

{
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[0], MODES[0], 'quad-n-back');
    contexte = ouvert.contexte;
    const page = ouvert.page;
    /*
       On attend le bouton de lancement, et non « h2 » : la page en porte cinq,
       dont certains cachés, et Playwright s'arrête sur le premier — qui ne
       devient jamais visible. L'essai expirait en annonçant une panne là où il
       n'y avait qu'un sélecteur trop large.
    */
    const lancer = page.getByRole('button', { name: /^Commencer$/ }).first();
    await lancer.waitFor({ state: 'visible', timeout: 30000 });

    /* P4 : le résumé est visible, le détail est replié. */
    const resume = await page.locator('section').filter({ hasText: 'Réglages de la session' }).first().innerText();
    vrai('le résumé des réglages dit le nombre de dimensions', /\d dimensions?/.test(resume));
    vrai('et les tours en arrière, dans les mots du glossaire', /tours? en arrière \(n = \d\)/.test(resume));
    vrai('et le rythme avec une virgule décimale', /2,5\s*s/.test(resume));
    faux('aucun « 2.5 s »', /2\.5\s*s/.test(resume));

    const detail = page.locator('details').filter({ hasText: 'Réglages' }).first();
    faux('le détail des réglages est replié', await detail.evaluate((d) => d.open));

    /* P13 : la lettre de touche ne paraît pas au doigt. */
    await lancer.click();
    const zone = page.locator('[data-zone-de-jeu]').first();
    await zone.waitFor({ state: 'visible', timeout: 30000 });
    v('aucune lettre de clavier visible au doigt', await zone.locator('kbd:visible').count(), 0);

    /*
       Et les cibles d'appui atteignent 44 px. Mesuré sur le rectangle rendu :
       une classe « min-h-11 » ne garantit rien si un parent la contraint.
    */
    const trop = await zone.locator('button').evaluateAll((noeuds) =>
      noeuds
        .filter((b) => b.offsetParent !== null)
        .map((b) => {
          const r = b.getBoundingClientRect();
          return { nom: (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().slice(0, 28), h: Math.round(r.height), l: Math.round(r.width) };
        })
        .filter((b) => b.h < 44 || b.l < 44),
    );
    v(`toutes les cibles d'appui atteignent 44 px`, trop, []);

    await contexte.close();
  } catch (erreur) {
    direPanne('Mémoire · L5', erreur);
    await contexte?.close().catch(() => {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   P9 — LE TERME TECHNIQUE EST LUI-MÊME LA COMMANDE
   ════════════════════════════════════════════════════════════════════════

   La règle arbitrée : à sa PREMIÈRE apparition dans un écran, le terme entre
   parenthèses s'ouvre au toucher sur son entrée du glossaire ; les suivantes
   restent du texte. Deux rouges à prévoir, et ce sont ceux demandés : une
   deuxième occurrence interactive, ou un toucher qui n'ouvre pas la bonne
   entrée.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nP9 — LE TERME OUVRE SA DÉFINITION, UNE FOIS PAR ÉCRAN');

for (const exercice of EXERCICES) {
  let contexte;
  try {
    const ouvert = await ouvrir(TAILLES[1], MODES[0], exercice.route);
    contexte = ouvert.contexte;
    const page = ouvert.page;
    await page.getByRole('button', { name: exercice.lancer }).first().waitFor({ state: 'visible', timeout: 30000 });

    /* AUCUN TERME N'EST INTERACTIF DEUX FOIS DANS LE MÊME ÉCRAN. */
    const doublons = await page.locator('button[data-terme]').evaluateAll((noeuds) => {
      const vus = {};
      for (const n of noeuds) {
        const t = n.dataset.terme;
        vus[t] = (vus[t] ?? 0) + 1;
      }
      return Object.entries(vus).filter(([, combien]) => combien > 1);
    });
    v(`${exercice.nom} — aucun terme interactif deux fois`, doublons, []);

    const termes = page.locator('button[data-terme]');
    const combien = await termes.count();
    if (combien === 0) {
      /* Pas de terme sur cet écran : rien à éprouver, et on le dit. */
      vrai(`${exercice.nom} — aucun terme technique sur l'écran de réglages`, true);
      await contexte.close();
      continue;
    }

    /* LE NOM ACCESSIBLE DIT CE QUE LE BOUTON FAIT. */
    const noms = await termes.evaluateAll((n) => n.map((b) => b.getAttribute('aria-label')));
    v(
      'chaque terme porte « Définition : … »',
      noms.filter((nom) => !/^Définition : .+/.test(nom ?? '')),
      [],
    );

    /* LA CIBLE TACTILE ATTEINT 44 px DE HAUTEUR EFFECTIVE, pseudo-élément compris. */
    const trop = await termes.evaluateAll((noeuds) =>
      noeuds
        .map((b) => {
          const apres = getComputedStyle(b, '::after');
          const haut = parseFloat(apres.insetBlockStart || '0');
          const bas = parseFloat(apres.insetBlockEnd || '0');
          const r = b.getBoundingClientRect();
          return { terme: b.dataset.terme, effective: Math.round(r.height - haut - bas) };
        })
        .filter((m) => m.effective < 44),
    );
    v('la zone touchable de chaque terme atteint 44 px', trop, []);

    /* ET LE TOUCHER OUVRE LA BONNE ENTRÉE. */
    const vise = await termes.first().getAttribute('data-terme');
    await termes.first().click();
    const entree = page.locator(`[data-entree="${vise}"]`);
    await entree.waitFor({ state: 'visible', timeout: 15000 });
    vrai(`toucher « ${vise} » ouvre son entrée`, await entree.isVisible());
    vrai(
      'et le focus y est allé',
      await page.evaluate(
        (t) => document.activeElement?.getAttribute('data-entree') === t,
        vise,
      ),
    );
    vrai(
      'et elle est mise en évidence',
      await entree.evaluate((e) => e.className.includes('ring-2')),
    );

    await contexte.close();
  } catch (erreur) {
    direPanne(`${exercice.nom} · P9`, erreur);
    await contexte?.close().catch(() => {});
  }
}

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai${echecs > 1 ? 's' : ''} en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout est vert\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
