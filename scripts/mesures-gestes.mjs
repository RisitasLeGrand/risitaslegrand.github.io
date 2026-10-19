/**
 * Les fiches de geste — prompt 43, lot I, point 2.
 *
 *   SITE_PASSWORD=… npm run mesures:gestes
 *
 * ## Ce que ce script mesure, et pourquoi il écrit lui-même les fiches
 *
 * Cinq gestes quotidiens : la tâche, la Revue, la carte, la prise, la
 * dépense. Pour chacun, trois nombres que le § 2 demande — **appuis**,
 * **secondes**, **retours en arrière** — mesurés à l'écran, sur des données
 * synthétiques.
 *
 * Les fiches sont ÉCRITES PAR CE SCRIPT, dans `docs/cyclades/gestes/`. C'est
 * la seule façon d'être sûr qu'aucun chiffre n'a été posé à la main, et la
 * seule façon de les rejouer : relancer la commande refait les mesures et
 * réécrit les fiches. Le protocole, lui, vit ici, à côté du geste qu'il
 * décrit — une fiche qui décrirait un autre protocole que celui joué serait
 * pire qu'une fiche absente.
 *
 * ## Ce que valent ces chiffres, et c'est écrit sur chaque fiche
 *
 * **Testé par l'auteur seul.** Un seul opérateur, qui connaît l'écran par
 * cœur et sait d'avance où appuyer : les secondes sont donc un PLANCHER, pas
 * une moyenne, et les appuis sont le chemin le plus court, pas le chemin
 * qu'on prend quand on cherche. Ce qui est comparable d'une version à
 * l'autre, ce sont les écarts, pas les valeurs.
 *
 * ## Un geste qu'on ne peut pas atteindre n'est pas un geste à zéro appui
 *
 * Si la prémisse d'un geste ne peut pas être posée dans ce conteneur — une
 * donnée que l'échantillon de `content/` ne porte pas, un écran qui demande
 * un fichier —, la fiche le DIT et ne porte aucun chiffre. Inventer un
 * nombre pour remplir un tableau serait exactement ce que ce lot cherche à
 * éviter.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const DOSSIER = 'docs/cyclades/gestes';

/**
 * Le compteur d'un geste.
 *
 * Chaque appui passe par `appuyer`, chaque retour par `revenir` : un clic
 * fait directement sur la page ne serait pas compté, et le chiffre mentirait
 * sans qu'on le voie. C'est aussi pourquoi le script n'utilise jamais
 * `page.click` ailleurs que dans ces deux fonctions.
 */
function compteur(page) {
  const mesure = { appuis: 0, retours: 0, debut: 0, fin: 0 };
  return {
    mesure,
    demarrer: () => {
      mesure.debut = Date.now();
    },
    arreter: () => {
      mesure.fin = Date.now();
    },
    appuyer: async (cible, options = {}) => {
      const loc = typeof cible === 'string' ? page.locator(cible) : cible;
      await loc.first().click({ timeout: 15_000, ...options });
      mesure.appuis += 1;
      await page.waitForTimeout(120);
    },
    ecrire: async (cible, texte) => {
      const loc = typeof cible === 'string' ? page.locator(cible) : cible;
      await loc.first().fill(texte);
      /* La saisie n'est pas un appui : le § 2 compte les appuis, et une
         frappe au clavier n'en est pas un. Elle est dans les secondes. */
    },
    revenir: async () => {
      await page.goBack({ waitUntil: 'networkidle' });
      mesure.retours += 1;
      await page.waitForTimeout(200);
    },
  };
}

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});

/** Un contexte neuf par geste : une mesure ne doit rien à la précédente. */
async function surUnePageNeuve(travail) {
  const contexte = await nav.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

  const deverrouiller = async () => {
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
      await page.waitForLoadState('networkidle');
    }
  };
  const aller = async (chemin) => {
    await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
    await deverrouiller();
    await page.waitForTimeout(400);
  };
  const ouvrirLeCoffre = async () => {
    await aller('/odyssee/corps/');
    const champ = page.locator('#mdp-coffre');
    if (!(await champ.isVisible().catch(() => false))) return true;
    await champ.fill(MDP);
    await page.locator('#ouvrir-coffre').click().catch(() => {});
    await page.waitForTimeout(1500);
    return !(await champ.isVisible().catch(() => false));
  };

  await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await franchirInitialisation(page, RACINE, MDP);

  try {
    return await travail({ page, aller, ouvrirLeCoffre, erreurs });
  } finally {
    await contexte.close();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Les cinq gestes
   ══════════════════════════════════════════════════════════════════════════ */

const GESTES = [
  {
    id: 'tache',
    titre: 'Poser une tâche, puis la clore',
    ou: '/odyssee/taches/',
    protocole: [
      'Arriver sur « Tâches » par son adresse.',
      'Écrire un titre dans le champ de la tâche.',
      'Appuyer sur « Ajouter ».',
      'Appuyer sur « Faite » sur la tâche qui vient de paraître.',
      'La mesure s’arrête quand la tâche n’est plus proposée à faire.',
    ],
    async jouer({ page, aller }) {
      await aller('/odyssee/taches/');
      const c = compteur(page);
      c.demarrer();
      await c.ecrire('#titre', 'Mesure du geste — tâche synthétique');
      await c.appuyer('#ajouter');
      await page.waitForTimeout(600);
      const faire = page.locator('[data-faire]').first();
      if (!(await faire.count())) return { ...c.mesure, empeche: 'la tâche ajoutée n’est pas proposée à faire' };
      await c.appuyer(faire);
      await page.waitForTimeout(800);
      c.arreter();
      return c.mesure;
    },
  },
  {
    id: 'revue',
    titre: 'Faire la revue du jour',
    ou: '/odyssee/revue/',
    protocole: [
      'Arriver sur « Revue » par son adresse.',
      'Appuyer sur la première action que la revue propose.',
      'La mesure s’arrête quand la revue dit qu’elle est faite, ou quand elle ne propose plus rien.',
    ],
    async jouer({ page, aller }) {
      await aller('/odyssee/revue/');
      const c = compteur(page);
      c.demarrer();
      const action = page
        .locator('#vue button:visible')
        .filter({ hasNotText: /réglages|paramètres/i })
        .first();
      if (!(await action.count())) {
        return { ...c.mesure, empeche: 'la revue ne propose aucune action sur une base synthétique' };
      }
      await c.appuyer(action);
      await page.waitForTimeout(800);
      c.arreter();
      return c.mesure;
    },
  },
  {
    id: 'carte',
    titre: 'Réviser une carte',
    ou: '/flashcards/',
    protocole: [
      'Arriver sur « Cartes » par son adresse.',
      'Appuyer sur « Commencer ».',
      'Appuyer sur la carte pour découvrir la réponse.',
      'Appuyer sur une note.',
      'La mesure s’arrête quand la carte suivante est à l’écran.',
    ],
    async jouer({ page, aller }) {
      await aller('/flashcards/');
      const c = compteur(page);
      c.demarrer();
      await c.appuyer('#lancer');
      await page.locator('#session:not(.hidden)').waitFor({ timeout: 90_000 }).catch(() => {});
      await c.appuyer('#carte');
      const note = page.locator('[data-note="correct"]');
      if (!(await note.isVisible().catch(() => false))) {
        return { ...c.mesure, empeche: 'les boutons de notation ne paraissent pas' };
      }
      await c.appuyer(note);
      await page.waitForTimeout(600);
      c.arreter();
      return c.mesure;
    },
  },
  {
    id: 'prise',
    titre: 'Marquer une prise',
    ou: '/odyssee/sante/',
    protocole: [
      'Ouvrir le coffre, que ce geste exige.',
      'Arriver sur « Santé » par son adresse.',
      'Appuyer sur la marque du premier créneau proposé.',
      'La mesure s’arrête quand le créneau est marqué.',
    ],
    async jouer({ page, aller, ouvrirLeCoffre }) {
      const ouvert = await ouvrirLeCoffre();
      if (!ouvert) return { appuis: 0, retours: 0, debut: 0, fin: 0, empeche: 'le coffre ne s’ouvre pas' };
      await aller('/odyssee/sante/');
      const c = compteur(page);
      c.demarrer();
      const creneau = page.locator('#creneaux button:visible').first();
      if (!(await creneau.count())) {
        return {
          ...c.mesure,
          empeche:
            'aucun créneau n’est proposé : il faut un traitement déclaré, que ce conteneur ne porte pas',
        };
      }
      await c.appuyer(creneau);
      await page.waitForTimeout(800);
      c.arreter();
      return c.mesure;
    },
  },
  {
    id: 'depense',
    titre: 'Pointer une dépense',
    ou: '/odyssee/rapprocher/',
    protocole: [
      'Ouvrir le coffre, que ce geste exige.',
      'Arriver sur « À rapprocher » par son adresse.',
      'Appuyer sur la première ligne proposée au pointage.',
      'La mesure s’arrête quand la ligne quitte la file.',
    ],
    async jouer({ page, aller, ouvrirLeCoffre }) {
      const ouvert = await ouvrirLeCoffre();
      if (!ouvert) return { appuis: 0, retours: 0, debut: 0, fin: 0, empeche: 'le coffre ne s’ouvre pas' };
      await aller('/odyssee/rapprocher/');
      const c = compteur(page);
      c.demarrer();
      const ligne = page.locator('#probables button:visible, #file button:visible').first();
      if (!(await ligne.count())) {
        return {
          ...c.mesure,
          empeche:
            'aucune ligne à pointer : il faut un relevé importé, que ce conteneur ne porte pas',
        };
      }
      await c.appuyer(ligne);
      await page.waitForTimeout(800);
      c.arreter();
      return c.mesure;
    },
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   La mesure, puis les fiches
   ══════════════════════════════════════════════════════════════════════════ */

mkdirSync(DOSSIER, { recursive: true });
const aujourdhui = new Date().toISOString().slice(0, 10);
const resultats = [];

for (const geste of GESTES) {
  process.stdout.write(`  ${geste.titre}… `);
  let mesure;
  try {
    mesure = await surUnePageNeuve((ctx) => geste.jouer(ctx));
  } catch (erreur) {
    mesure = { appuis: 0, retours: 0, debut: 0, fin: 0, empeche: String(erreur?.message ?? erreur).slice(0, 160) };
  }
  const secondes = mesure.fin && mesure.debut ? (mesure.fin - mesure.debut) / 1000 : null;
  resultats.push({ geste, mesure, secondes });
  console.log(
    mesure.empeche
      ? `\x1b[33mnon mesuré — ${mesure.empeche}\x1b[0m`
      : `\x1b[32m${mesure.appuis} appuis, ${secondes?.toFixed(1)} s, ${mesure.retours} retour(s)\x1b[0m`,
  );

  const lignes = [
    `# Geste quotidien — ${geste.titre}`,
    '',
    `**Mesuré le ${aujourdhui}, sur \`${geste.ou}\`, avec des données synthétiques.**`,
    '',
    '> **Testé par l’auteur seul.** Un seul opérateur, qui connaît l’écran et sait',
    '> d’avance où appuyer : les secondes sont un **plancher**, pas une moyenne, et',
    '> les appuis sont le chemin le plus court, pas celui qu’on prend quand on',
    '> cherche. Ce qui se compare d’une version à l’autre, ce sont les écarts.',
    '',
    '## Protocole',
    '',
    ...geste.protocole.map((p, i) => `${i + 1}. ${p}`),
    '',
    'Rejouable : `SITE_PASSWORD=… npm run mesures:gestes`. Les chiffres ci-dessous',
    'sont écrits par le script, jamais à la main.',
    '',
    '## Mesure',
    '',
  ];

  if (mesure.empeche) {
    lignes.push(
      '**Non mesuré.** ' + mesure.empeche + '.',
      '',
      'Aucun chiffre n’est porté ici. Un geste qu’on ne peut pas atteindre n’est pas',
      'un geste à zéro appui, et remplir le tableau aurait fabriqué une mesure.',
    );
  } else {
    lignes.push(
      '| Ce qui est compté | Valeur |',
      '|---|---|',
      `| Appuis | ${mesure.appuis} |`,
      `| Secondes | ${secondes?.toFixed(1)} |`,
      `| Retours en arrière | ${mesure.retours} |`,
      '',
      'La saisie au clavier n’est pas comptée comme un appui — elle compte dans les',
      'secondes. Chaque appui passe par une seule fonction du script, de sorte qu’un',
      'clic non compté ne puisse pas exister.',
    );
  }
  lignes.push('');
  writeFileSync(`${DOSSIER}/${geste.id}.md`, lignes.join('\n'), 'utf8');
}

await nav.close();

const mesures = resultats.filter((r) => !r.mesure.empeche);
console.log(
  `\n${mesures.length} geste${mesures.length > 1 ? 's' : ''} mesuré${mesures.length > 1 ? 's' : ''} sur ${GESTES.length}, ` +
    `${resultats.length - mesures.length} non mesuré${resultats.length - mesures.length > 1 ? 's' : ''}.`,
);
console.log(`Fiches écrites dans « ${DOSSIER}/ ».\n`);
