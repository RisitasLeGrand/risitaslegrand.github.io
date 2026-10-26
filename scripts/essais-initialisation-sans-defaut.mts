/**
 * Ne rien répondre n'écrit rien (U2 du prompt 43).
 *
 *   npm run essais:initialisation-sans-defaut
 *
 * ## Le défaut, tel qu'il a été constaté
 *
 * Trois saisies de l'initialisation écrivaient une valeur que personne
 * n'avait donnée :
 *
 * - une **heure** partait à « 07:00 » et ne pouvait donc jamais être vide :
 *   passer l'écran écrivait sept heures du matin, source « declare » ;
 * - un **curseur** rendait toujours `Number(champ.value)` : passer l'écran
 *   écrivait sa position de départ, zéro ;
 * - « **Je ne sais pas encore** » rendait `{}`, et un objet vide enregistré
 *   se lit comme une déclaration — « aucune heure répartie » — et non comme
 *   une absence de réponse.
 *
 * Ce n'est pas une coquille d'affichage. Une heure de lever fausse déplace
 * la bascule de journée, donc la revue du soir, donc le compte des séances ;
 * et elle est écrite « declare », c'est-à-dire « la personne l'a dit ».
 *
 * ## CE QUI N'EST PAS UN DÉFAUT, et la distinction est tout l'essai
 *
 * Une réponse **préremplie par une observation** est une autre affaire :
 * l'écran l'annonce — « Observé, pas déclaré… La réponse est préremplie.
 * Corrigez-la si elle est fausse, rien n'est écrit avant que vous
 * continuiez » — et continuer vaut alors confirmation. Idem pour les trois
 * défauts assumés du catalogue (jours de travail, langue, fuseau), qui sont
 * déclarés et commentés comme tels.
 *
 * Ce contrôle ne juge donc pas « rien n'a été écrit », ce qui condamnerait
 * un comportement voulu. Il juge : **une saisie que l'écran montre VIDE
 * doit partir vide, et ne rien écrire.**
 *
 * ## Pourquoi dans un navigateur
 *
 * Les saisies sont construites par le script de la page : elles ne
 * s'importent pas. On traverse donc le parcours comme une personne pressée
 * — « Continuer » là où il existe, « Plus tard » sur les écrans à choix
 * unique — en relevant à chaque écran ce que la saisie montre, puis on
 * relit le journal d'opérations.
 */
import { chromium, type Page } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
process.on('uncaughtException', (e: unknown) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/*
   Des CHAÎNES et non des fonctions : sous tsx, une fonction passée à
   `page.evaluate` est compilée avec un appel à `__name` qui n'existe pas
   dans la page. Et la chaîne doit être une expression APPELÉE, sinon
   Playwright rend la fonction elle-même, c'est-à-dire `undefined`.
*/
const CHAMPS_ECRITS = `(async () => {
  const base = await new Promise((ok, ko) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  if (![...base.objectStoreNames].includes('operations')) { base.close(); return []; }
  const tout = await new Promise((ok, ko) => {
    const d = base.transaction('operations').objectStore('operations').getAll();
    d.onsuccess = () => ok(d.result);
    d.onerror = () => ko(d.error);
  });
  base.close();
  return tout
    .filter((o) => o.type === 'profil.champ')
    .map((o) => String(o.cible).replace(/^profil:/, ''));
})()`;

/** Ce que l'écran courant montre : les saisies vides, et les autres. */
const ETAT_ECRAN = `(() => {
  const zone = document.getElementById('saisie');
  const observe = document.getElementById('observe');
  const deduit = Boolean(observe && !observe.classList.contains('hidden'));
  const vides = [];
  const remplies = [];
  const prerempliesSansRaison = [];
  for (const champ of zone ? zone.querySelectorAll('input') : []) {
    const nom = (champ.id || '').replace(/^saisie-/, '');
    if (!nom) continue;
    if (champ.type === 'time') {
      (champ.value ? remplies : vides).push(nom);
      /* Une heure préremplie SANS observation est le défaut d'origine : la
         valeur ne vient alors de personne. */
      if (champ.value && !deduit) prerempliesSansRaison.push(nom);
    }
    else if (champ.type === 'range') {
      const texte = (champ.parentElement ? champ.parentElement.textContent : '') || '';
      (texte.includes('non répondu') ? vides : remplies).push(nom);
    }
  }
  return {
    deduit,
    vides,
    remplies,
    prerempliesSansRaison,
    question: (document.getElementById('question') || {}).textContent || '',
  };
})()`;

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CES DEUX PARCOURS, ET POURQUOI AUCUNE N'EST UNE DURÉE

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4. Sept temporisations à
   l'aveugle, de 220 et 300 ms, et toutes au même endroit : entre un appui et
   la lecture de l'écran SUIVANT. Deux cent vingt millisecondes pour peindre
   une question : c'est la moyenne qui tient sur une machine au repos, et un
   parcours de quarante écrans la paie quarante fois.

   La post-condition est la QUESTION, qui change d'un écran à l'autre. On la
   relève avant l'appui et l'on attend qu'elle diffère — indépendant de ce que
   les assertions comptent ensuite, et impossible à satisfaire par un passage
   antérieur.

   Et « Continuer » a DEUX issues : l'écran avance, ou il refuse et montre son
   erreur. On attend donc la première des deux, faute de quoi un refus
   consommerait la borne entière avant que l'essai ne le voie.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes : elle rend un blocage lisible, elle ne mesure rien. */
const DELAI = 30_000;

/** L'état de l'écran dont un appui va nous faire sortir. */
const avantLAppui = (page: import('playwright-core').Page) =>
  page.evaluate(() => {
    const erreur = document.getElementById('erreur');
    return {
      question: document.getElementById('question')?.textContent ?? '',
      erreurVue: erreur instanceof HTMLElement && !erreur.classList.contains('hidden'),
    };
  });

/**
 * Attend que l'écran ait avancé — ou qu'il ait refusé.
 *
 * Trois sorties, et la deuxième demande une précaution. La question change,
 * c'est le cas ordinaire. L'erreur PARAÎT, et il faut qu'elle n'ait pas été
 * déjà là : ma première version se contentait de « l'erreur est visible », et
 * une erreur restée affichée d'un écran à l'autre faisait rendre la main
 * aussitôt — le parcours lisait alors deux fois le même écran, et n'avançait
 * plus. Mesuré : cinq questions distinctes au lieu de la dizaine attendue.
 * Ou le parcours se termine, et « Aller au menu » paraît.
 */
const apresLAppui = (
  page: import('playwright-core').Page,
  avant: { question: string; erreurVue: boolean },
) =>
  page
    .waitForFunction(
      ([questionDAvant, erreurDejaLa]) => {
        const question = document.getElementById('question')?.textContent ?? '';
        if (question !== questionDAvant) return true;
        const erreur = document.getElementById('erreur');
        const vue = erreur instanceof HTMLElement && !erreur.classList.contains('hidden');
        if (vue && !erreurDejaLa) return true;
        const menu = document.getElementById('aller-menu');
        return menu instanceof HTMLElement && menu.offsetParent !== null;
      },
      [avant.question, avant.erreurVue] as [string, boolean],
      { timeout: DELAI },
    )
    .catch(() => {});

/**
 * Traverse le parcours en ne répondant que ce qui est obligatoire.
 *
 * PREMIÈRE VERSION, FAUSSE, ET SA LEÇON. Elle cliquait « Continuer » trente
 * fois et comptait les écrans vus. Or la première question — « Comment
 * doit-on vous appeler ? » — est la seule obligatoire : l'écran refusait
 * d'avancer, l'essai revoyait trente fois la même question, et son « les
 * écrans ont bien défilé » passait au vert sur un compteur qui ne mesurait
 * que ses propres clics. Il est resté vert sous sabotage. Un essai qui ne
 * bouge pas ne garde rien.
 */
async function traverser(page: Page, branche: string | null) {
  const chemin = branche ? `/initialisation/?branche=${branche}` : '/initialisation/';
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForFunction(
    () =>
      ['valider', 'aller-menu', 'commencer', 'plus-tard'].some((id) => {
        const e = document.getElementById(id);
        return e instanceof HTMLElement && e.offsetParent !== null;
      }),
    undefined,
    { timeout: 40000 },
  );
  if (await page.locator('#commencer').isVisible().catch(() => false)) {
    const avant = await avantLAppui(page);
    await page.click('#commencer');
    await apresLAppui(page, avant);
  }

  const questions: string[] = [];
  const vides: string[] = [];
  const remplies: string[] = [];
  const obligatoires: string[] = [];
  const prerempliesSansRaison: string[] = [];

  for (let i = 0; i < 40; i += 1) {
    if (await page.locator('#aller-menu').isVisible().catch(() => false)) break;
    const etat = (await page.evaluate(ETAT_ECRAN)) as {
      deduit: boolean;
      vides: string[];
      remplies: string[];
      prerempliesSansRaison: string[];
      question: string;
    };
    /* Une saisie préremplie par une observation n'est pas un défaut : on ne
       la compte ni parmi les vides ni parmi les fautes. */
    if (!etat.deduit) vides.push(...etat.vides);
    remplies.push(...etat.remplies);
    prerempliesSansRaison.push(...etat.prerempliesSansRaison);
    questions.push(etat.question);

    if (await page.locator('#valider').isVisible().catch(() => false)) {
      const avant = await avantLAppui(page);
      await page.click('#valider');
      await apresLAppui(page, avant);
      const bloque = await page.evaluate(
        `(() => {
          const e = document.getElementById('erreur');
          return Boolean(e && !e.classList.contains('hidden'));
        })()`,
      );
      if (bloque) {
        const nom = await page.evaluate(
          `(() => {
            const zone = document.getElementById('saisie');
            const champ = zone && zone.querySelector('input[type=text], textarea');
            if (!champ) return null;
            champ.value = 'Essai';
            champ.dispatchEvent(new Event('input', { bubbles: true }));
            return (champ.id || '').replace(/^saisie-/, '') || null;
          })()`,
        );
        if (!nom) break;
        obligatoires.push(nom as string);
        const avantReponse = await avantLAppui(page);
        await page.click('#valider');
        await apresLAppui(page, avantReponse);
      }
    } else if (await page.locator('#plus-tard').isVisible().catch(() => false)) {
      /* Les écrans à choix unique n'ont pas de « Continuer » : cliquer une
         réponse EST une réponse. « Plus tard » enregistre un report, qui
         n'est pas une valeur de profil — c'est le bouton de qui ne veut
         rien dire, et c'est donc lui qu'il faut éprouver. */
      const avant = await avantLAppui(page);
      await page.click('#plus-tard');
      await apresLAppui(page, avant);
    } else {
      break;
    }

    const apres = (await page.evaluate(ETAT_ECRAN)) as { question: string };
    if (apres.question === etat.question) break;
  }
  return { questions, vides, remplies, obligatoires, prerempliesSansRaison };
}

console.log('\n\x1b[1mUNE SAISIE VIDE PART VIDE, ET N’ÉCRIT RIEN\x1b[0m\n');

{
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  const socle = await traverser(page, null);
  const revisions = await traverser(page, 'revisions');

  const questions = new Set([...socle.questions, ...revisions.questions]);
  /* Dites, et non seulement comptées : un rouge ici doit montrer OÙ le
     parcours s'est arrêté, faute de quoi on cherche le défaut à l'aveugle. */
  console.log(`      questions vues : ${[...questions].map((q) => q.slice(0, 40)).join(' | ')}`);
  v('le parcours a vraiment défilé (questions distinctes)', questions.size > 5, true);

  const vides = [...new Set([...socle.vides, ...revisions.vides])];
  v(
    'au moins une heure ou un curseur a été vu sans réponse',
    vides.length > 0,
    true,
  );
  console.log(`      saisies vues vides : ${vides.join(', ') || '—'}`);

  v(
    'aucune heure n’est préremplie sans observation qui la justifie',
    [...new Set([...socle.prerempliesSansRaison, ...revisions.prerempliesSansRaison])],
    [],
  );

  const ecrits = (await page.evaluate(CHAMPS_ECRITS)) as string[];
  v(
    'aucune saisie vue vide n’a été écrite',
    vides.filter((c) => ecrits.includes(c)),
    [],
  );
  v(
    'et ce qui était obligatoire l’a bien été',
    [...new Set([...socle.obligatoires, ...revisions.obligatoires])].filter(
      (c) => !ecrits.includes(c),
    ),
    [],
  );
  await ctx.close();
}

console.log('\n\x1b[1mET EN RÉPONDANT, L’ÉCRAN ÉCRIT BIEN\x1b[0m\n');

/*
   Le contre-essai, sans lequel le premier ne prouve rien : une saisie qui
   n'écrirait jamais rien passerait « aucune vide n'a été écrite » avec les
   honneurs. On répond donc à ce qui se trouve sur le chemin, et on exige
   que ces champs-là soient écrits.
*/
{
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await page.goto(`${RACINE}/initialisation/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForFunction(
    () =>
      ['valider', 'aller-menu', 'commencer', 'plus-tard'].some((id) => {
        const e = document.getElementById(id);
        return e instanceof HTMLElement && e.offsetParent !== null;
      }),
    undefined,
    { timeout: 40000 },
  );
  if (await page.locator('#commencer').isVisible().catch(() => false)) {
    const avant = await avantLAppui(page);
    await page.click('#commencer');
    await apresLAppui(page, avant);
  }

  const repondus: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    if (await page.locator('#aller-menu').isVisible().catch(() => false)) break;
    if (!(await page.locator('#valider').isVisible().catch(() => false))) {
      if (!(await page.locator('#plus-tard').isVisible().catch(() => false))) break;
      const avant = await avantLAppui(page);
      await page.click('#plus-tard');
      await apresLAppui(page, avant);
      continue;
    }
    const touche = await page.evaluate(
      `(() => {
        const zone = document.getElementById('saisie');
        const champ = zone && zone.querySelector('input[type=time], input[type=range], input[type=text]');
        if (!champ) return null;
        if (champ.type === 'time') champ.value = '06:30';
        else if (champ.type === 'range') champ.value = String(Number(champ.max) - Number(champ.step));
        else champ.value = 'Essai';
        champ.dispatchEvent(new Event('input', { bubbles: true }));
        return (champ.id || '').replace(/^saisie-/, '') || null;
      })()`,
    );
    if (touche) repondus.push(touche as string);
    const avant = await avantLAppui(page);
    await page.click('#valider');
    await apresLAppui(page, avant);
  }

  const ecrits = (await page.evaluate(CHAMPS_ECRITS)) as string[];
  v('au moins une saisie a été touchée sur le parcours', repondus.length > 0, true);
  console.log(`      saisies touchées : ${[...new Set(repondus)].join(', ') || '—'}`);
  v(
    'et tout ce qui a été touché a été écrit',
    [...new Set(repondus)].filter((c) => !ecrits.includes(c)),
    [],
  );
  await ctx.close();
}

await nav.close();
console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m\n'
    : `\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m\n`,
);
process.exit(rouges === 0 ? 0 : 1);
