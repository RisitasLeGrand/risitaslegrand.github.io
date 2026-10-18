/**
 * M6 — le double appui, sur les gestes quotidiens hors Sport.
 *
 *   npm run essais:double-appui
 *
 * ## Ce que ce contrôle mesure, et pourquoi il est séparé d'`essais:gestes`
 *
 * `essais:gestes` tient la séance de Sport : cinq gestes, un écran, un
 * magasin. Celui-ci tient les autres gestes fréquents que le 41 nomme —
 * « un fait, une dépense, un pointage » — et ils vivent sur quatre écrans et
 * autant de magasins. Les réunir aurait fait un essai de dix minutes qu'on
 * finit par ne plus lancer.
 *
 * ## La mesure se fait dans la base, pas à l'écran
 *
 * Un écran peut n'afficher qu'une ligne là où la base en porte deux : les
 * cartes du jour se regroupent, et un verre de plus ne change qu'un total.
 * On compte donc les lignes réellement écrites, par `indexedDB`, dans la
 * base `revinsp`. C'est la seule mesure qui ne se laisse pas tromper par un
 * rendu qui agrège.
 *
 * ## Ce que le sabotage a montré, et ce que chaque ligne vaut donc
 *
 * `unSeulGeste` rendu passe-plat, les trente contrôles ne virent pas tous
 * au rouge : **douze** le font, et ce sont ceux-là qui prouvent le
 * garde-fou. Les douze autres restent verts parce qu'ils mesurent un
 * accident plutôt qu'une protection.
 *
 *   - Les quatre écarts des **boutons hors formulaire** (verre d'eau,
 *     « J'ai dormi ») virent tous au rouge : rien ne les protégeait.
 *   - Les **envois de formulaire** (tâche, quête, rendez-vous, pesée) ne
 *     virent au rouge **qu'à 0 ms**. Au-delà, la validation native refuse
 *     le second envoi, parce que le champ requis vient d'être vidé. Ces
 *     neuf lignes-là ne prouvent donc pas le garde-fou ; elles gardent
 *     l'accident, et signaleront le jour où un écran cessera de vider son
 *     champ. C'est utile, mais ce n'est pas la même preuve, et il ne faut
 *     pas les lire comme telle.
 *
 * ## Le revers est mesuré aussi
 *
 * Un garde-fou qui refuse le second verre **voulu** est un défaut, pas une
 * protection : on boit deux verres de suite, et on pèse deux fois quand la
 * première pesée était fausse. Chaque geste protégé est donc suivi d'un
 * essai à une seconde d'écart, qui doit passer.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

/** Compte les lignes d'un magasin de la base réelle. */
const compter = (page, magasin) =>
  page.evaluate(
    (nom) =>
      new Promise((resoudre) => {
        const ouverture = indexedDB.open('revinsp');
        ouverture.onsuccess = () => {
          const base = ouverture.result;
          if (!base.objectStoreNames.contains(nom)) {
            resoudre(-1);
            return;
          }
          const demande = base.transaction(nom, 'readonly').objectStore(nom).count();
          demande.onsuccess = () => resoudre(demande.result);
          demande.onerror = () => resoudre(-2);
        };
        ouverture.onerror = () => resoudre(-3);
      }),
    magasin,
  );

async function ouvrir(chemin) {
  const ctx = await nav.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

/**
 * Deux appuis sur le même bouton, à `ecart` ms, puis le compte du magasin.
 *
 * La prémisse est vérifiée avant de conclure : si le bouton n'existe pas, ou
 * si le magasin est absent, l'essai le dit au lieu de rapporter un zéro qui
 * ressemblerait à une réussite.
 */
async function doubleAppui({ chemin, selecteur, magasin, preparer }) {
  const { ctx, page } = await ouvrir(chemin);
  /*
     La préparation est rejouée **avant chaque appui**, et non une fois pour
     toutes. Sans cela, la pesée aurait été mesurée à faux : son gestionnaire
     vide `#kg` après l'écriture, si bien que le second appui lit une chaîne
     vide et se fait refuser par le contrôle de saisie. On aurait relevé « une
     seule ligne » et conclu que le geste était protégé, alors que rien ne le
     protégeait — le champ vidé faisait tout le travail, et il ne le fait que
     si les deux appuis sont assez espacés pour que le premier ait fini.
  */
  const preparerSiBesoin = async () => {
    if (preparer) await preparer(page);
  };
  await preparerSiBesoin();
  const bouton = page.locator(selecteur).first();
  const visible = await bouton.isVisible().catch(() => false);
  if (!visible) {
    await ctx.close();
    return { prémisse: `bouton ${selecteur} absent` };
  }
  const depart = await compter(page, magasin);
  if (depart < 0) {
    await ctx.close();
    return { prémisse: `magasin ${magasin} illisible (${depart})` };
  }
  const resultats = {};
  for (const ecart of [0, 60, 150, 300]) {
    await preparerSiBesoin();
    const base = await compter(page, magasin);
    await bouton.click({ force: true });
    if (ecart) await page.waitForTimeout(ecart);
    await bouton.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1800);
    resultats[ecart] = (await compter(page, magasin)) - base;
  }
  /*
     Le revers : deux gestes **voulus**, à une seconde d'écart. On rejoue la
     préparation entre les deux, parce que c'est ce qu'une personne fait —
     elle ressaisit son poids avant de peser une seconde fois.
  */
  await preparerSiBesoin();
  const base = await compter(page, magasin);
  await bouton.click({ force: true });
  await page.waitForTimeout(1200);
  await preparerSiBesoin();
  await bouton.click({ force: true });
  await page.waitForTimeout(1800);
  resultats.voulus = (await compter(page, magasin)) - base;
  await ctx.close();
  return resultats;
}

const GESTES = [
  {
    nom: 'Corps — un verre d’eau',
    chemin: '/odyssee/corps/',
    selecteur: '[data-verre]',
    magasin: 'odysseeBoissons',
  },
  {
    nom: 'Corps — « J’ai dormi »',
    chemin: '/odyssee/corps/',
    selecteur: '#dormir',
    magasin: 'odysseeNuits',
  },
  {
    nom: 'Tâches — « Ajouter » une tâche',
    chemin: '/odyssee/taches/',
    selecteur: '#ajout button[type=submit]',
    magasin: 'odysseeTaches',
    preparer: async (page) => {
      await page.fill('#titre', 'Arroser les plantes');
    },
  },
  {
    nom: 'Quêtes — « Ajouter » une quête',
    chemin: '/odyssee/quetes/',
    selecteur: '#ajout button[type=submit]',
    magasin: 'odysseeQuetes',
    preparer: async (page) => {
      await page.fill('#titre', 'Marcher une heure');
    },
  },
  {
    nom: 'Calendrier — « Ajouter » un rendez-vous',
    chemin: '/odyssee/calendrier/',
    selecteur: '#ajout button[type=submit]',
    magasin: 'odysseeEvenements',
    preparer: async (page) => {
      await page.fill('#titre', 'Rendez-vous');
      await page.fill('#debut', '2026-11-12T10:00');
    },
  },
  {
    nom: 'Corps — « Enregistrer » la pesée',
    chemin: '/odyssee/corps/',
    selecteur: '#peser',
    magasin: 'odysseePesees',
    preparer: async (page) => {
      await page.fill('#kg', '72');
    },
  },
];

console.log('\nLE DOUBLE APPUI SUR LES GESTES QUOTIDIENS');
for (const geste of GESTES) {
  const r = await doubleAppui(geste);
  if (r.prémisse) {
    console.log(`\x1b[31m✗\x1b[0m ${geste.nom} — prémisse manquante : ${r.prémisse}`);
    rouges += 1;
    continue;
  }
  for (const ecart of [0, 60, 150, 300]) {
    verifier(`${geste.nom} — deux appuis à ${ecart} ms n’écrivent qu’une ligne`, r[ecart], 1);
  }
  verifier(`${geste.nom} — deux gestes voulus à 1 s écrivent deux lignes`, r.voulus, 2);
}

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
