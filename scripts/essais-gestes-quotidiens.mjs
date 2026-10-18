/**
 * M5 — chaque écran quotidien à trois gestes au plus depuis la barre du bas.
 *
 *   npm run essais:gestes-quotidiens
 *
 * ## Pourquoi ce contrôle n'est pas celui de la carte des écrans
 *
 * `essais:carte-ecrans` compte les appuis **depuis l'accueil**, sur tous les
 * liens rendus, quel que soit l'endroit de la page. C'est la bonne mesure
 * pour « une fonction qu'on ne trouve pas n'existe pas ».
 *
 * M5 pose une autre question, et plus dure : depuis **la barre du bas**,
 * c'est-à-dire avec le pouce là où il est déjà, en bas de l'écran, et sans
 * aller chercher l'en-tête. Les arêtes sont donc limitées à ce que le bas
 * de l'écran offre :
 *
 *   - un lien de la barre du bas       → 1 geste
 *   - « Plus », puis un lien de la feuille → 2 gestes
 *
 * ## Ce que la mesure a trouvé, le 18 octobre
 *
 * Dans une branche, tout tenait en un ou deux gestes. D'une branche à une
 * autre, **rien** : l'infini. Le changement de branche ne vivait que dans
 * l'en-tête, en haut, et la feuille « Plus » ne portait que les onglets de
 * la branche courante. Depuis Sport, Odyssée et Révisions étaient hors de
 * portée du bas de l'écran — ce que l'audit du 17 avait vu autrement
 * (M-05, M-12) sans le chiffrer.
 *
 * ## L'accueil n'a pas de barre du bas, et ce n'est pas un défaut
 *
 * `/` est le menu, au-dessus des branches : il n'a ni barre du bas, ni
 * ruban, ni cloche, pour la raison écrite dans `essais-carte-ecrans`. Une
 * règle qui parle de la barre du bas ne peut pas être évaluée là où il n'y
 * en a pas ; l'écran est donc **hors prémisse** et non en échec, et
 * `carte-ecrans` prouve déjà que tout y tient en deux appuis.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const PLAFOND = 3;

/** Les écrans quotidiens — la même liste que `essais-carte-ecrans`. */
const QUOTIDIENS = [
  '/odyssee/',
  '/odyssee/revue/',
  '/odyssee/taches/',
  '/odyssee/calendrier/',
  '/odyssee/corps/',
  '/flashcards/',
  '/revisions/',
  '/sport/seance/',
  '/sport/',
];

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
const contexte = await nav.newContext({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

/* Coffre ouvert : un relevé coffre fermé lit les liens d'écrans vides, et
   c'est l'erreur du 14 octobre. */
await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
}
await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
verifier(
  'la prémisse — le coffre est ouvert avant de relever le moindre lien',
  await page.evaluate(() => !document.getElementById('temoin-coffre')?.classList.contains('hidden')),
  true,
);

/** route → Map(cible → coût en gestes, depuis le bas de l'écran seulement) */
const liens = new Map();
/** route → { branche courante, racine → branche } tels que l'en-tête les rend */
const branchesVues = new Map();
for (const route of QUOTIDIENS) {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(400);
  const vus = await page.evaluate(() => {
    const prendre = (selecteur, cout) => {
      const zone = document.querySelector(selecteur);
      if (!zone) return [];
      return [...zone.querySelectorAll('a[href]')]
        .map((a) => {
          let c = a.getAttribute('href').replace(location.origin, '').split('?')[0].split('#')[0];
          if (c && !c.endsWith('/')) c += '/';
          return { c, cout };
        })
        .filter((x) => x.c && x.c.startsWith('/'));
    };
    /* La branche courante et les racines se lisent dans l'en-tête, où le
       registre les a rendues. Les déduire du chemin serait faux : les
       écrans de Révisions sont à `/flashcards/`, `/revisions/`, `/quiz/`…
       et n'ont aucun préfixe commun. */
    const marques = [...document.querySelectorAll('#entete-principal a[data-branche]')];
    const racines = {};
    for (const a of marques) {
      let c = a.getAttribute('href').replace(location.origin, '');
      if (c && !c.endsWith('/')) c += '/';
      racines[c] = a.dataset.branche;
    }
    const courante = marques.find((a) => a.getAttribute('aria-current') === 'true');
    return {
      barre: !!document.getElementById('barre-du-bas'),
      plus: !!document.getElementById('ouvrir-plus'),
      racines,
      branche: courante ? courante.dataset.branche : null,
      liens: [...prendre('#barre-du-bas', 1), ...prendre('#feuille-plus', 2)],
    };
  });
  // Un essai qui parcourt zéro élément ne prouve rien : si la barre ou son
  // bouton « Plus » manque, la mesure n'a pas de sens et doit le dire.
  if (!vus.barre || !vus.plus) {
    verifier(`la barre du bas et « Plus » existent sur ${route}`, vus, { barre: true, plus: true });
  }
  const m = new Map();
  for (const { c, cout } of vus.liens) {
    if (c === route) continue;
    if (!m.has(c) || m.get(c) > cout) m.set(c, cout);
  }
  liens.set(route, m);
  branchesVues.set(route, { branche: vus.branche, racines: vus.racines });
}

await contexte.close();
await nav.close();

/* ---- Dijkstra, et la matrice imprimée en clair ------------------------- */

const depuis = (depart) => {
  const d = new Map([[depart, 0]]);
  let bouge = true;
  while (bouge) {
    bouge = false;
    for (const [s, cibles] of liens) {
      const base = d.get(s);
      if (base === undefined) continue;
      for (const [c, cout] of cibles) {
        if (!d.has(c) || d.get(c) > base + cout) {
          d.set(c, base + cout);
          bouge = true;
        }
      }
    }
  }
  return d;
};

const court = (r) => r.replace(/^\/|\/$/g, '').split('/').pop().slice(0, 8);
console.log('\n  GESTES DEPUIS LA BARRE DU BAS — 1 = un lien de la barre, 2 = par « Plus »\n');
console.log('  ' + ''.padEnd(22) + QUOTIDIENS.map((q) => court(q).padStart(10)).join(''));
const trop = [];
for (const depart of QUOTIDIENS) {
  const d = depuis(depart);
  console.log(
    '  ' + depart.padEnd(22) + QUOTIDIENS.map((q) => String(d.get(q) ?? '∞').padStart(10)).join(''),
  );
  for (const q of QUOTIDIENS) {
    const v = d.get(q);
    if (v === undefined || v > PLAFOND) trop.push(`${depart} → ${q} : ${v ?? '∞'}`);
  }
}
console.log('');
verifier(`M5e — aucun trajet au-delà de ${PLAFOND} gestes`, trop, []);

/* Interdit 3 : les raccourcis sont dans la feuille, pas dans la barre.
   La preuve directe, c'est qu'aucune racine de branche étrangère n'est
   atteignable à UN geste — un geste, c'est la barre elle-même. */
verifier(
  'interdit 3 — aucune branche étrangère n’est entrée dans la barre du bas',
  [...liens.entries()].flatMap(([depart, m]) => {
    const { branche, racines } = branchesVues.get(depart) ?? {};
    return [...m.entries()]
      .filter(([cible, cout]) => cout === 1 && racines?.[cible] && racines[cible] !== branche)
      .map(([cible]) => `${depart} → ${cible} (${racines[cible]} ≠ ${branche})`);
  }),
  [],
);
// Et la prémisse de ce contrôle : sans branche courante lue, il ne juge rien.
verifier(
  'chaque écran a bien déclaré sa branche dans l’en-tête',
  [...branchesVues.entries()].filter(([, v]) => !v.branche).map(([r]) => r),
  [],
);

process.exit(rouges === 0 ? 0 : 1);
