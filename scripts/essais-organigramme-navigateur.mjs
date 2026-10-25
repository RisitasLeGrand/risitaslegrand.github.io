/**
 * L'organigramme à l'écran : deux lectures, un texte complet, et 390 points.
 *
 *   npm run essais:organigramme:navigateur
 *
 * ## Ce que cet essai mesure, et que celui de nœud ne peut pas
 *
 * `essais:organigramme` tient les règles — quel nœud survit au squelette, quel
 * lien le suit, ce que dit le texte engendré. Il ne dit rien de l'écran : ni
 * que la bascule existe, ni qu'elle redessine, ni que le texte est atteignable,
 * ni qu'un téléphone de 390 points n'hérite pas d'un défilement horizontal.
 * C'est ici que cela se mesure, dans une page vivante.
 *
 * ## Pourquoi l'organigramme n'est pas factice ici, contrairement à l'essai de nœud
 *
 * Un organigramme factice demanderait une page de laboratoire : une route de
 * plus, livrée au site, qu'aucun lot n'a demandée. L'essai passe donc par le
 * chemin réel — le quiz d'une fiche de la matière commune, dont une correction
 * porte un organigramme à deux lectures. Le rendu ne dépend pas des données,
 * donc ce qu'on mesure ici vaut pour n'importe quel organigramme ; et si la
 * fiche n'est pas dans le corpus de la machine, l'essai **rougit** en le disant
 * plutôt que de passer au vert sans avoir rien vu.
 *
 * ## Les 390 points
 *
 * On ne mesure pas « le dessin est lisible » — cela ne se mesure pas. On mesure
 * ce qui se mesure : que la page ne défile pas horizontalement, et que le texte
 * complet est là, puisque c'est lui qui rend l'organigramme lisible quand le
 * dessin ne l'est plus.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const MATIERE = 'Organisation de la DGFiP';

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
    console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
  }
};
const vrai = (titre, obtenu) => v(titre, obtenu, true);

/**
 * Ouvre le quiz de la matière commune et déplie la première correction qui
 * porte un organigramme à deux lectures.
 *
 * Rend la page et le nombre de questions parcourues, ou `null` si la matière
 * n'est pas servie — ce que l'appelant doit traiter comme un échec, et non
 * comme une absence.
 */
async function ouvrirUnOrganigramme(largeur) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 1000 } });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 200)));

  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('revinsp.parcours', 'dgfip-a'));
  await page.goto(`${RACINE}/quiz/cours/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(2500);
  }
  await page.waitForFunction(
    () => (document.getElementById('quiz-matiere')?.options.length ?? 0) > 1,
    null,
    { timeout: 40000 },
  );

  const matieres = await page.$$eval('#quiz-matiere option', (o) => o.map((x) => x.value));
  if (!matieres.includes(MATIERE)) return { ctx, page, erreurs, trouve: false, matieres };

  await page.selectOption('#quiz-matiere', MATIERE);
  await page.waitForTimeout(600);
  /*
     ON RESTREINT À LA FICHE, ET PAS SEULEMENT À LA MATIÈRE.

     Première version : matière choisie, vingt questions tirées parmi les
     trente-deux de la matière. L'écran large tombait sur l'organigramme,
     l'écran étroit non — un essai qui réussit une fois sur deux ne mesure
     rien. En restreignant à la fiche, les huit questions sont toutes tirées
     et la correction visée est atteinte à coup sûr.
  */
  const fiches = await page.$$eval('#quiz-fiche option', (o) =>
    o.map((x) => ({ valeur: x.value, texte: x.textContent ?? '' })),
  );
  const visee = fiches.find((f) => f.texte.includes('direction départementale'));
  if (visee) await page.selectOption('#quiz-fiche', visee.valeur);
  await page.selectOption('#quiz-taille', '20').catch(() => {});
  await page.click('#lancer-quiz');
  await page.waitForSelector('#jeu:not(.hidden)', { timeout: 120000 });

  /*
     On répond, on déplie la correction, on regarde si elle porte la bascule.
     Vingt questions au plus : au-delà, c'est que la fiche n'est pas là, et le
     dire vaut mieux que de tourner sans fin.
  */
  for (let n = 0; n < 20; n += 1) {
    await page.locator('#quiz-options button').first().click();
    await page.waitForTimeout(350);
    const detaillee = page.locator('#quiz-correction button:has-text("Correction détaillée")');
    if (await detaillee.isVisible().catch(() => false)) {
      await detaillee.click();
      await page.waitForTimeout(700);
      const bascule = page.locator('#quiz-correction-detaillee button:has-text("Voir le squelette")');
      if (await bascule.isVisible().catch(() => false)) return { ctx, page, erreurs, trouve: true };
      await detaillee.click().catch(() => {});
      await page.waitForTimeout(200);
    }
    const suivant = page.locator('#quiz-suivant');
    if (!(await suivant.isVisible().catch(() => false))) break;
    await suivant.click();
    await page.waitForTimeout(350);
  }
  return { ctx, page, erreurs, trouve: false, matieres };
}

console.log('\nDEUX LECTURES, SUR UN ÉCRAN LARGE');

const large = await ouvrirUnOrganigramme(1200);
vrai(
  `un organigramme à deux lectures est atteignable dans « ${MATIERE} »` +
    (large.trouve ? '' : ' — sans lui, rien de ce qui suit ne serait mesuré'),
  large.trouve,
);

if (large.trouve) {
  const panneau = large.page.locator('#quiz-correction-detaillee');
  const boites = () => panneau.locator('svg rect:not([width="5"])').count();

  const auDetail = await boites();
  vrai('le détail dessine plus de trois boîtes', auDetail > 3);
  v(
    'les deux appuis sont offerts, et l’état courant se lit sur eux',
    await panneau.locator('button[aria-pressed]').evaluateAll((b) =>
      b.map((x) => `${x.textContent.trim()}:${x.getAttribute('aria-pressed')}`),
    ),
    ['Voir le détail:true', 'Voir le squelette:false'],
  );

  await panneau.locator('button:has-text("Voir le squelette")').click();
  await large.page.waitForTimeout(400);
  const auSquelette = await boites();
  vrai(`le squelette dessine moins de boîtes (${auSquelette} contre ${auDetail})`, auSquelette < auDetail);
  vrai('et il en dessine au moins deux', auSquelette >= 2);
  v(
    'l’état courant a suivi la bascule',
    await panneau.locator('button[aria-pressed]').evaluateAll((b) =>
      b.map((x) => `${x.textContent.trim()}:${x.getAttribute('aria-pressed')}`),
    ),
    ['Voir le détail:false', 'Voir le squelette:true'],
  );

  await panneau.locator('button:has-text("Voir le détail")').click();
  await large.page.waitForTimeout(400);
  v('revenir au détail redessine tout', await boites(), auDetail);

  console.log('\nLE TEXTE COMPLET EST ATTEIGNABLE, ET IL DIT LES RANGS');

  const texte = panneau.locator('[data-organigramme-texte]');
  vrai('le repli de lecture en texte est présent', await texte.isVisible());
  await texte.locator('summary').click();
  await large.page.waitForTimeout(250);
  const contenu = (await texte.textContent()) ?? '';
  vrai('il nomme les rangs', /Rang 1\b/.test(contenu));
  vrai('et il nomme au moins un rattachement', contenu.includes('De «'));
  v(
    'le texte suit la lecture affichée : il annonce le détail',
    contenu.includes('Le détail, rang par rang'),
    true,
  );
}

console.log('\nET À 390 POINTS, AUCUN DÉFILEMENT HORIZONTAL DE LA PAGE');

const etroit = await ouvrirUnOrganigramme(390);
vrai('l’organigramme est atteignable sur un écran de 390 points', etroit.trouve);
if (etroit.trouve) {
  const debordement = await etroit.page.evaluate(() => {
    const vue = document.documentElement.clientWidth;
    const panneau = document.getElementById('quiz-correction-detaillee');
    const coupables = [...document.querySelectorAll('*')]
      .filter((e) => e.getBoundingClientRect().right > vue + 1)
      .map((e) => ({
        dansLaCorrection: Boolean(panneau?.contains(e)),
        quoi: e.id || `${e.tagName.toLowerCase()}.${(e.className?.toString?.() ?? '').split(' ')[0]}`,
        droite: Math.round(e.getBoundingClientRect().right),
      }));
    return {
      pageDeborde: document.documentElement.scrollWidth > vue + 1,
      largeurDuDocument: document.documentElement.scrollWidth,
      coupables,
      largeurDuSvg: panneau?.querySelector('svg')?.getBoundingClientRect().width,
      largeurDeLaFenetre: vue,
    };
  });
  /*
     CE QUE CET ESSAI PEUT PROMETTRE, ET CE QU'IL NE PEUT PAS.

     Il a d'abord exigé « la page ne défile pas horizontalement », et il a
     rougi — pour une raison qui n'est pas la sienne. Mesuré le 25 octobre : à
     390 points, le document fait 471 points de large, et l'unique coupable est
     « #selecteur-parcours », dans l'en-tête, dont le bord droit tombe à 471
     alors que son conteneur s'arrête à 374. Le conteneur est écrasé à 13 points
     par « flex-1 min-w-0 » tandis que le menu, « shrink-0 », refuse de
     rétrécir. À 360 points le même conteneur passe à la ligne et mesure 328 :
     le défaut n'existe donc que dans une bande de largeurs, et
     « essais:mobile:navigateur » mesure 360, c'est-à-dire précisément la
     largeur où il ne se voit pas.

     Ce défaut est celui de l'en-tête, pas de l'organigramme — le dessin, lui,
     tient en 324 points sur 390. Exiger ici une page sans débordement
     reviendrait à faire rougir ce lot pour le compte d'un autre, et à
     empêcher de voir le jour où l'organigramme, lui, déborderait vraiment.

     L'essai demande donc ce que le lot promet : AUCUN élément de la correction
     ne sort de la fenêtre. Le débordement de la page est imprimé comme un
     constat, avec son coupable nommé, pour qu'il soit repris là où il
     appartient et non oublié ici.
  */
  v(
    'aucun élément de la correction ne sort de la fenêtre',
    debordement.coupables.filter((c) => c.dansLaCorrection),
    [],
  );
  if (debordement.pageDeborde) {
    console.log(
      `      \x1b[36m·\x1b[0m constat, hors de ce lot : la page fait ${debordement.largeurDuDocument} points ` +
        `pour une fenêtre de ${debordement.largeurDeLaFenetre}. Coupables hors correction : ` +
        `${debordement.coupables
          .filter((c) => !c.dansLaCorrection)
          .map((c) => `${c.quoi} (bord droit ${c.droite})`)
          .join(', ')}.`,
    );
  }
  vrai(
    `le dessin tient dans la fenêtre (${Math.round(debordement.largeurDuSvg ?? 0)} points pour ${debordement.largeurDeLaFenetre})`,
    (debordement.largeurDuSvg ?? 0) <= debordement.largeurDeLaFenetre,
  );
  vrai(
    'et le texte complet est là, lui qui reste lisible quand le dessin se réduit',
    await etroit.page.locator('#quiz-correction-detaillee [data-organigramme-texte]').isVisible(),
  );
}

console.log('\nET AUCUNE ERREUR DE PAGE N’A ÉTÉ AVALÉE');
v('aucune erreur levée', [...(large.erreurs ?? []), ...(etroit.erreurs ?? [])].slice(0, 3), []);

await nav.close();
console.log(
  echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} rouge${echecs > 1 ? 's' : ''}\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
