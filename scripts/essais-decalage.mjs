/**
 * Le décalage de mise en page à l'arrivée — A1 du prompt 37.
 *
 *   npm run essais:decalage
 *
 * **Ce que ce contrôle mesure, et pourquoi il existe.**
 *
 * La phase 5 du prompt 34 — la mienne — a ajouté un fondu de sortie au texte
 * d'attente. Pendant ses 120 ms, le texte reste **dans le flux** sous le
 * contenu déjà affiché, à cause d'`allow-discrete` : il pousse donc tout ce
 * qui le suit, puis disparaît. Le CLS est mesuré par l'API du navigateur, pas
 * déduit : un observateur de `layout-shift` posé avant tout script de la page,
 * et la somme des décalages non consécutifs à une interaction.
 *
 * ## Pourquoi le processeur est bridé
 *
 * Sans bridage, la mesure est **bimodale** : la même page rend 0,003 ou 0,211
 * selon que ses contrôles s'hydratent avant ou après la première peinture.
 * C'est une course, et elle est **antérieure au lot** — la même alternance
 * s'observe à l'identique au commit d'avant. Une mesure tirée au sort entre
 * deux valeurs distantes de 0,2 ne peut pas juger d'une régression de 0,1 :
 * trois tirages successifs auraient donné vert, vert, rouge sans que rien
 * n'ait changé.
 *
 * Le bridage ×4 fait gagner la course au mode lent à tous les coups. Ce n'est
 * pas un ralentissement arbitraire : c'est le **pire cas**, celui du téléphone
 * modeste, et c'est le seul état que l'on sache reproduire. Mesuré trois fois
 * de suite sur les quatre pages, avant comme après : valeurs identiques.
 *
 * ## Les plafonds, et le chiffre de l'audit que je ne reproduis pas
 *
 *   page              rapport du pilote   remesuré ici, bridé (e964ba5)
 *   /bibliotheque/          0,018                 0,211
 *   /recherche/             0,098                 0,170
 *   /quiz/cours/            0,131                 0,134
 *   /statistiques/          0,361                 0,365
 *
 * Deux concordent à la marge de mesure près. Les deux autres **ne concordent
 * pas**, et l'explication tient à la course ci-dessus : l'audit a mesuré sans
 * bridage, donc sur le mode rapide, là où ce contrôle force le mode lent. Les
 * 0,2 d'écart sur la bibliothèque ne viennent pas du texte d'attente mais de
 * la barre de filtres et de ses deux listes déroulantes, qui s'insèrent après
 * la première peinture et poussent le pied de page. **C'est un défaut réel,
 * antérieur au lot, et il n'est pas corrigé ici** : une ligne du tableau
 * suivant, pas un correctif silencieux (§4.2).
 *
 * Le plafond retenu est donc la valeur **remesurée au commit d'avant le lot**,
 * parce qu'elle est la seule que ce contrôle puisse comparer honnêtement à ce
 * qu'il mesure lui-même. Il dit « la correction a ramené la page à son état
 * d'avant » ; il ne dit pas « cette page ne décale plus ».
 *
 * ## Le contrôle vérifie qu'il voit encore
 *
 * Un plafond relevé est un plafond qui peut devenir aveugle. La dernière
 * épreuve réinjecte donc le CSS exact de la phase 5 et exige que la mesure
 * **dépasse** le plafond. Si elle ne le dépasse plus, ce n'est pas que la page
 * va bien : c'est que l'instrument ne regarde plus au bon endroit, et l'essai
 * échoue en le disant.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

/*
   LES PLAFONDS ONT ÉTÉ RESSERRÉS, PARCE QUE L'INSTRUMENT NE VOYAIT PLUS.

   Ils valaient le relevé d'avant le lot des animations, mesuré au commit
   e964ba5 : 0,211 pour la bibliothèque, 0,170 pour la recherche, 0,134 pour
   les quiz, 0,365 pour les statistiques. C'étaient des plafonds de
   non-régression, et ils ont fait leur travail.

   Mais l'épreuve de l'instrument, en bas de ce fichier, réinjecte le fondu
   retiré par A1 et exige que la mesure dépasse le plafond. Elle a cessé de le
   dépasser : le fondu rend aujourd'hui 0,136 à 0,169, sous des plafonds restés
   à leur niveau d'avant. Le contrôle ne voyait donc plus la régression qu'il
   surveille, et il l'a dit — c'est exactement ce pour quoi cette épreuve
   existe, et c'est pourquoi on ne la désactive pas.

   Les pages, elles, mesurent **0,000 à 0,004** aujourd'hui. Entre 0,004 et
   0,136, un plafond unique à 0,05 laisse douze fois de marge aux pages et
   deux fois à la détection. Il est au passage deux fois plus strict que le
   seuil « bon » de 0,1 communément retenu.
*/
const PLAFOND = 0.05;
const PLAFONDS = {
  '/bibliotheque/': PLAFOND,
  '/recherche/': PLAFOND,
  '/quiz/cours/': PLAFOND,
  '/statistiques/': PLAFOND,
};

/** Une marge de mesure : le CLS reste un calcul en virgule flottante. */
const MARGE = 0.02;

/** Le CSS exact retiré par A1, réinjecté pour éprouver le contrôle. */
const FONDU_DE_LA_PHASE_5 =
  '#chargement{opacity:1;transition:opacity .12s ease-out,display .12s allow-discrete}' +
  '#chargement.hidden{display:none;opacity:0}';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, ok) => {
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
};

console.log('\nDÉCALAGE DE MISE EN PAGE À L’ARRIVÉE (A1)');

/**
 * Un contexte neuf par mesure : le second chargement d'un contexte part d'un
 * cache chaud et d'une session déjà ouverte, donc ne mesure pas la même chose.
 */
const mesurer = async (route, { sabotage = false, mouvementReduit = false } = {}) => {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    ...(mouvementReduit ? { reducedMotion: 'reduce' } : {}),
  });
  const page = await ctx.newPage();
  await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((liste) => {
      for (const entree of liste.getEntries()) {
        /* La définition : les décalages NON consécutifs à une interaction. */
        if (!entree.hadRecentInput) window.__cls += entree.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  if (sabotage) {
    await page.addInitScript((css) => {
      const poser = () => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
      };
      if (document.head) poser();
      else document.addEventListener('DOMContentLoaded', poser, { once: true });
    }, FONDU_DE_LA_PHASE_5);
  }

  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  /*
     ATTENDRE UN ÉTAT, PAS UN DÉLAI. La première version attendait 4 000 ms en
     aveugle : sur un serveur fraîchement démarré le contenu n'était pas encore
     rendu, la mesure rendait 0,003 et paraissait excellente. Elle regardait
     trop tôt, et une bissection entière s'est appuyée dessus.
  */
  await page
    .locator('#chargement')
    .waitFor({ state: 'hidden', timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(4000);

  const cls = await page.evaluate(() => window.__cls);
  await ctx.close();
  return cls;
};

/* 390 × 844 : la taille la plus exposée, et celle du relevé d'origine. */
for (const [route, plafond] of Object.entries(PLAFONDS)) {
  const cls = await mesurer(route);
  v(
    `${route.padEnd(18)} CLS ${cls.toFixed(3)} ≤ ${plafond.toFixed(3)} + ${MARGE}`,
    cls <= plafond + MARGE,
  );
}

/*
   Sous mouvement réduit : la durée du fondu y était ramenée à presque rien,
   mais un élément qui quitte le flux déplace ce qui le suit, vite ou lentement
   — c'est pourquoi l'audit y voyait le décalage subsister. La page doit donc y
   tenir le même plafond.
*/
console.log('\n  Sous mouvement réduit');
const sobre = await mesurer('/bibliotheque/', { mouvementReduit: true });
v(
  `/bibliotheque/     CLS ${sobre.toFixed(3)} ≤ ${PLAFONDS['/bibliotheque/']} + ${MARGE}`,
  sobre <= PLAFONDS['/bibliotheque/'] + MARGE,
);

/*
   L'épreuve de l'instrument. Elle n'est pas décorative : les plafonds de deux
   de ces pages ont dû être relevés faute de reproduire le relevé d'origine, et
   un plafond relevé est un plafond qui peut cesser de voir.
*/
console.log('\n  Le contrôle voit-il encore la régression ?');
for (const route of ['/bibliotheque/', '/recherche/']) {
  const cls = await mesurer(route, { sabotage: true });
  v(
    `${route.padEnd(18)} fondu réinjecté : CLS ${cls.toFixed(3)} > ${PLAFONDS[route]} + ${MARGE}`,
    cls > PLAFONDS[route] + MARGE,
  );
}
const sobreSabote = await mesurer('/bibliotheque/', { sabotage: true, mouvementReduit: true });
v(
  `/bibliotheque/     fondu réinjecté, mouvement réduit : CLS ${sobreSabote.toFixed(3)} > ${PLAFONDS['/bibliotheque/']} + ${MARGE}`,
  sobreSabote > PLAFONDS['/bibliotheque/'] + MARGE,
);

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
