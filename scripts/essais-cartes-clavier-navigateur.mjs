/**
 * LA BOUCLE DE RÉVISION SE MÈNE AU CLAVIER (E5 du prompt 43).
 *
 *   SITE_PASSWORD=… npm run essais:cartes-clavier:navigateur
 *
 * ## Ce qui était mesuré le 25 octobre, avant correctif
 *
 * La carte était un `div` portant un écouteur de clic : ni `tabindex`, ni
 * `role`, ni `aria-expanded`. **Jamais atteinte en vingt-cinq tabulations.**
 *
 * Et pire, parce que invisible à la lecture : le raccourci clavier interceptait
 * Espace **et** Entrée pour tout l'écran de session, avec `preventDefault()`.
 * Un bouton de notation qui avait le focus ne s'activait donc ni à l'une ni à
 * l'autre — les deux touches étaient avalées avant de l'atteindre, et il ne se
 * passait rien. Mesuré : le compteur restait à « 1/25 ».
 *
 * Autrement dit, qui révise au clavier ne pouvait **ni retourner une carte, ni
 * la noter** autrement qu'aux chiffres 1 à 4. C'est l'écran le plus visité du
 * site, et le seul qu'on ouvre tous les jours.
 *
 * ## Ce que cet essai garde, et dans quel ordre
 *
 * D'abord les prémisses — une session a démarré, elle porte des cartes —, sans
 * quoi tout ce qui suit serait vrai d'un écran vide. Puis la forme : un
 * `<button>` avec `aria-expanded`, et la zone de réponse **dehors**, parce
 * qu'elle héberge le bouton de l'assistant et qu'un bouton dans un bouton
 * casse précisément ce qu'on vient de réparer.
 *
 * Puis les deux gestes, et ce sont eux qui comptent : Entrée sur la carte la
 * retourne, et Entrée comme Espace sur une note font avancer la carte. Le
 * compteur est le témoin : il ne bouge que si la note a été enregistrée.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;

function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  ${rouge('✗')} ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

console.log('\nLA BOUCLE DE RÉVISION, AU CLAVIER\n');

await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/flashcards/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}

/* On attend l'apparition d'un bouton de lancement, et non un délai. */
const peutLancer = await page
  .waitForSelector('#lancer-libre, #lancer', { timeout: 40000 })
  .then(() => true)
  .catch(() => false);
verifier('prémisse : un lancement de session est proposé', peutLancer, true);

if (peutLancer) {
  const libre = await page.locator('#lancer-libre').isVisible().catch(() => false);
  await page.click(libre ? '#lancer-libre' : '#lancer');
  await page.waitForSelector('#session:not(.hidden)', { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(700);
}

const etat = () =>
  page.evaluate(() => {
    const c = document.getElementById('carte');
    return {
      balise: c?.tagName.toLowerCase() ?? null,
      ariaExpanded: c?.getAttribute('aria-expanded') ?? null,
      /* La zone de réponse est-elle DANS le bouton ? Elle ne doit pas l'être. */
      reponseDansLeBouton: Boolean(c?.querySelector('#zone-reponse')),
      boutonsDansLeBouton: c ? c.querySelectorAll('button, a[href]').length : -1,
      reponseVisible: !document.getElementById('zone-reponse')?.classList.contains('hidden'),
      notationVisible: !document.getElementById('notation')?.classList.contains('hidden'),
      compteur: document.getElementById('compteur')?.textContent ?? '',
      notes: document.querySelectorAll('#notation button[data-note]').length,
    };
  });

const depart = await etat();
verifier('prémisse : la session porte des cartes', /^\d+\/\d+$/.test(depart.compteur), true);
verifier('prémisse : les quatre notes sont là', depart.notes, 4);

console.log('\nLA FORME');
verifier('la carte est un bouton', depart.balise, 'button');
verifier('elle annonce son état replié', depart.ariaExpanded, 'false');
/*
   L'INVARIANT QUI PROTÈGE LE CORRECTIF. La zone de réponse héberge le bouton
   de l'assistant : la remettre dans le bouton de la carte produirait un bouton
   dans un bouton — invalide, et le clavier y reperd ce qu'il vient de gagner.
*/
verifier('la zone de réponse est HORS du bouton', depart.reponseDansLeBouton, false);
verifier('et le bouton ne contient aucun contrôle', depart.boutonsDansLeBouton, 0);

console.log('\nLA CARTE SE RETOURNE AU CLAVIER');
await page.evaluate(() => document.body.focus());
let tabulations = 0;
let atteinte = false;
for (let i = 0; i < 25 && !atteinte; i += 1) {
  await page.keyboard.press('Tab');
  tabulations = i + 1;
  atteinte = await page.evaluate(() => document.activeElement?.id === 'carte');
}
verifier(`la carte est atteinte à la tabulation (${tabulations} appuis)`, atteinte, true);

if (atteinte) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const apres = await etat();
  verifier('Entrée la retourne', apres.reponseVisible, true);
  verifier('et l’état annoncé suit', apres.ariaExpanded, 'true');
  verifier('la notation paraît', apres.notationVisible, true);
}

/*
   LE CONTRÔLE QUI MORD : UNE NOTE S'ACTIVE AU CLAVIER.

   C'est ici que le défaut vivait. Le compteur est le témoin — il ne change que
   si la note a été enregistrée et la carte suivante montrée. Les deux touches
   sont éprouvées, parce que le `preventDefault()` les avalait toutes les deux.
*/
console.log('\nUNE NOTE S’ACTIVE AU CLAVIER, À ENTRÉE COMME À ESPACE');
for (const touche of ['Enter', 'Space']) {
  let avant = await etat();
  if (!avant.notationVisible) {
    /* On retourne la carte au clavier, comme une personne le ferait. */
    await page.locator('#carte').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    avant = await etat();
  }
  verifier(`prémisse (${touche}) : la notation est affichée`, avant.notationVisible, true);

  await page.locator('#notation button[data-note="correct"]').focus();
  const surLaNote = await page.evaluate(
    () => document.activeElement?.dataset?.note ?? 'aucune',
  );
  verifier(`prémisse (${touche}) : le focus est sur une note`, surLaNote, 'correct');

  await page.keyboard.press(touche);
  await page.waitForTimeout(900);
  const apres = await etat();
  verifier(
    `${touche} sur une note fait avancer la carte`,
    apres.compteur !== avant.compteur,
    true,
  );
  verifier(
    `et la carte suivante repart repliée (${touche})`,
    apres.ariaExpanded,
    'false',
  );
}

verifier('aucune erreur de page', erreurs.slice(0, 3), []);

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('La boucle de révision se mène entièrement au clavier.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
