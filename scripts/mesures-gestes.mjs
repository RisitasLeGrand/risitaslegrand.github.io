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
import { pdfMinimal } from './lib/pdf-minimal.mjs';

/* ══════════════════════════════════════════════════════════════════════════
   Les prémisses, semées PAR L'ÉCRAN et en données synthétiques
   ══════════════════════════════════════════════════════════════════════════

   Deux gestes n'existent pas sur une base vide : on ne marque pas une prise
   sans traitement déclaré, on ne pointe pas une dépense sans relevé importé.
   La première version de ce script rendait donc « non mesuré » pour les deux.

   C'était vrai, et insuffisant : la prémisse est SEMABLE, et par le chemin
   réel — un formulaire pour le traitement, un relevé PDF fabriqué pour les
   opérations. Le semis n'est pas compté dans le geste : le chronomètre et le
   compteur d'appuis partent APRÈS lui.
   ══════════════════════════════════════════════════════════════════════════ */

const X = { date: 62, valeur: 98, libelle: 161, debit: 440, credit: 515 };
const entete = (y) => [
  { x: 63, y, texte: 'Date' },
  { x: 98, y, texte: 'Date valeur' },
  { x: 161, y, texte: 'Operation' },
  { x: 409, y, texte: 'Debit EUROS' },
  { x: 480, y, texte: 'Credit EUROS' },
];
const ligneDeReleve = (y, jour, libelle, montant, debit) => [
  { x: X.date, y, texte: jour },
  { x: X.valeur, y, texte: jour },
  { x: X.libelle, y, texte: libelle },
  { x: debit ? X.debit : X.credit, y, texte: montant },
];

/** Un relevé d'un mois, inventé de bout en bout, dont le solde boucle. */
function releveSynthetique(chemin) {
  const ouverture = 100000;
  const salaire = 235000;
  const loyer = 78000;
  const courses = 4390;
  const solde = ouverture + salaire - loyer - courses;
  const euro = (c) => {
    const [entier, dec] = Math.abs(c / 100).toFixed(2).split('.');
    return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${dec}`;
  };
  writeFileSync(
    chemin,
    pdfMinimal([
      [
        { x: 57, y: 740, texte: 'C/C CONTRAT PERSONNEL PARCOURS.J+ N 00055347 en euros (GD)' },
        ...entete(720),
        ...ligneDeReleve(700, '02/09/2026', 'VIR SALAIRE TRESOR PUBLIC', euro(salaire), false),
        ...ligneDeReleve(688, '05/09/2026', 'VIR M DUPONT LOYER', euro(loyer), true),
        ...ligneDeReleve(676, '03/09/2026', 'SARL LE PETIT MARCHE', euro(courses), true),
        { x: 57, y: 656, texte: 'SOLDE CREDITEUR AU 31/08/2026' },
        { x: 515, y: 656, texte: euro(ouverture) },
        { x: 57, y: 636, texte: 'Ref : 009 SOLDE CREDITEUR AU 30/09/2026' },
        { x: 515, y: 636, texte: euro(solde) },
      ],
    ]),
  );
}

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
      'Prémisse, hors mesure : ouvrir le coffre, activer Santé si besoin, et déclarer un traitement synthétique par le formulaire de l’écran.',
      'Arriver sur « Santé » par son adresse.',
      'Appuyer sur la marque du premier créneau proposé.',
      'La mesure s’arrête quand le créneau est marqué.',
    ],
    async jouer({ page, aller, ouvrirLeCoffre }) {
      const ouvert = await ouvrirLeCoffre();
      if (!ouvert) return { appuis: 0, retours: 0, debut: 0, fin: 0, empeche: 'le coffre ne s’ouvre pas' };
      await aller('/odyssee/sante/');

      /* ── La prémisse, hors mesure ───────────────────────────────────── */
      const activer = page.locator('#activer');
      if (await activer.isVisible().catch(() => false)) {
        await activer.click().catch(() => {});
        await page.waitForTimeout(1200);
      }
      if (!(await page.locator('#creneaux button:visible').count())) {
        const nom = page.locator('#t-nom');
        if (await nom.isVisible().catch(() => false)) {
          const jour = new Date().toISOString().slice(0, 10);
          await nom.fill('Traitement synthétique de mesure');
          await page.locator('#t-debut').fill(jour).catch(() => {});
          await page.locator('#t-posologie').fill('1 comprimé le matin').catch(() => {});
          await page.locator('#form-traitement button[type="submit"]').first().click().catch(() => {});
          await page.waitForTimeout(1500);
        }
        /*
           UN TRAITEMENT DÉCLARÉ NE SUFFIT PAS, et c'est la mesure qui l'a
           appris : un créneau n'existe que si le traitement porte un
           SCHÉMA — une posologie écrite en toutes lettres n'en est pas un,
           et `creneauxDuJour` rend une liste vide sans lui. Le schéma se
           pose par le dépliant « Prévoir un schéma », une heure à la fois.
        */
        const pli = page.locator('#traitements details').first();
        if (await pli.count()) {
          await pli.locator('summary').first().click().catch(() => {});
          await page.waitForTimeout(400);
          const heure = pli.locator('input[aria-label="Une heure à ajouter"]').first();
          if (await heure.count()) {
            await heure.fill('08:00').catch(() => {});
            await pli.getByRole('button', { name: 'Ajouter cette heure' }).click().catch(() => {});
            await page.waitForTimeout(300);
            await pli.getByRole('button', { name: 'Enregistrer le schéma' }).click().catch(() => {});
            await page.waitForTimeout(1200);
          }
        }
        await aller('/odyssee/sante/');
      }

      /* ── Le geste ───────────────────────────────────────────────────── */
      const c = compteur(page);
      c.demarrer();
      const creneau = page.locator('#creneaux button:visible').first();
      if (!(await creneau.count())) {
        return {
          ...c.mesure,
          empeche:
            'aucun créneau n’est proposé, même après avoir déclaré un traitement par le formulaire',
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
      'Prémisse, hors mesure : ouvrir le coffre et importer un relevé synthétique d’un mois — trois opérations inventées, solde qui boucle — par l’écran « Finances ».',
      'Arriver sur « À rapprocher » par son adresse.',
      'Appuyer sur le premier geste proposé sur la première ligne.',
      'La mesure s’arrête quand la file s’est repeinte.',
    ],
    async jouer({ page, aller, ouvrirLeCoffre }) {
      const ouvert = await ouvrirLeCoffre();
      if (!ouvert) return { appuis: 0, retours: 0, debut: 0, fin: 0, empeche: 'le coffre ne s’ouvre pas' };

      /* ── La prémisse, hors mesure ───────────────────────────────────── */
      await aller('/odyssee/finances/');
      if (await page.locator('#coffre-ferme').isVisible().catch(() => false)) {
        await page.locator('#mdp-coffre').fill(MDP);
        await page.locator('#ouvrir-coffre').click().catch(() => {});
        await page.waitForTimeout(1500);
      }
      const chemin = '/tmp/mesure-geste-releve.pdf';
      releveSynthetique(chemin);
      if (await page.locator('#fichier').count()) {
        await page.setInputFiles('#fichier', chemin).catch(() => {});
        await page.locator('#apercu:not(.hidden)').waitFor({ timeout: 90_000 }).catch(() => {});
        await page.locator('#enregistrer').click({ timeout: 10_000 }).catch(() => {});
        await page.locator('#resultat:not(.hidden)').waitFor({ timeout: 60_000 }).catch(() => {});
      }

      /* ── Le geste ───────────────────────────────────────────────────── */
      await aller('/odyssee/rapprocher/');
      if (await page.locator('#coffre-ferme').isVisible().catch(() => false)) {
        await page.locator('#mdp-coffre').fill(MDP);
        await page.locator('#ouvrir-coffre').click().catch(() => {});
        await page.waitForTimeout(1500);
      }
      const c = compteur(page);
      c.demarrer();
      const ligne = page
        .locator('#probables button:visible, #file button:visible, [data-a-classer] button:visible')
        .first();
      if (!(await ligne.count())) {
        return {
          ...c.mesure,
          empeche: 'aucune ligne à pointer, même après avoir importé un relevé synthétique',
        };
      }
      await c.appuyer(ligne);
      await page.waitForTimeout(900);
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
    '> **Testé par l’auteur seul**, et par un script qu’il a écrit. Il faut en dire',
    '> la portée exacte, sans quoi ces trois nombres se liraient pour ce qu’ils ne',
    '> sont pas.',
    '>',
    '> Les **appuis** sont le chemin le plus court, pris par quelqu’un qui sait',
    '> d’avance où appuyer — pas le chemin qu’on prend quand on cherche. C’est le',
    '> nombre le plus solide des trois : il ne dépend ni de la machine ni de la',
    '> personne.',
    '>',
    '> Les **secondes** mesurent la réponse de l’application à cette suite',
    '> d’appuis, enchaînés par un script. Ce n’est donc **pas** le temps d’une',
    '> personne : il n’y a ici ni hésitation, ni lecture, ni main qui se déplace.',
    '> C’est un plancher, et il ne vaut que comparé à lui-même d’une version à',
    '> l’autre.',
    '>',
    '> Les **retours en arrière** disent si le geste oblige à revenir sur ses pas.',
    '> Zéro ne veut pas dire que personne ne revient : il veut dire que le chemin',
    '> le plus court n’y oblige pas.',
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
