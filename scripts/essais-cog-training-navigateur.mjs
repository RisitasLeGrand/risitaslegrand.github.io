/**
 * Entraînement cognitif, dans un vrai navigateur.
 *
 *   SITE_PASSWORD=… npm run essais:cog:navigateur
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

const BASE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = process.env.SITE_PASSWORD;
if (!MDP) {
  console.error('SITE_PASSWORD manquant.');
  process.exit(1);
}

/** La tolérance que « zone-de-jeu.ts » se donne, reprise pour ne pas en inventer une autre. */
const TOLERANCE_HAUT = 4;

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
  await page.addInitScript((heures) => {
    try {
      localStorage.setItem('revinsp.palette', 'egee');
      localStorage.setItem('revinsp.bascule-jour-nuit', 'oui');
      localStorage.setItem('revinsp.heures-bascule', heures);
    } catch {
      /* navigation privée */
    }
  }, mode.heures);

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
    return {
      haut: Math.round(r.top),
      hauteur: Math.round(r.height),
      fenetre: innerHeight,
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
        /* Le temps du défilement, que la mise en œuvre borne elle-même. */
        await page.waitForTimeout(1500);

        const { haut, hauteur, fenetre, entiere } = await positionDeLaZone(zone);
        const tient = hauteur <= fenetre;
        const hautEnPlace = Math.abs(haut) <= TOLERANCE_HAUT;
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
              : `zone de ${hauteur} px dans ${fenetre}, haut à ${haut} px`
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
    await page.waitForTimeout(400);
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
      if (await avancer.count()) await avancer.click();
      await page.waitForTimeout(150);
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

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai${echecs > 1 ? 's' : ''} en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout est vert\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
