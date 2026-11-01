/**
 * LA NUIT, POUR LES ESSAIS DE NAVIGATEUR : NODE *ET* LE NAVIGATEUR À 1 H 30.
 *
 *   node --import scripts/lib/horloge-de-nuit.mjs scripts/essais-<nom>.mjs
 *   npm run essais:horloge-de-nuit     (la garde sur cet outil même)
 *
 * ## Ce qu'il sert à mesurer
 *
 * Les écrans d'Odyssée — l'agenda, le calendrier, les tâches, la revue —
 * emploient le **jour logique**, qui bascule à 4 h heure de Paris, et non la
 * date du calendrier. Les deux coïncident la plus grande partie du temps et
 * divergent chaque nuit entre minuit et 4 h. Un essai qui compare une date
 * calendaire à ce que l'un de ces écrans affiche est donc vert le jour et
 * rouge la nuit, sans qu'une ligne de code ait bougé.
 *
 * Ce crochet reproduit cette nuit-là à toute heure, et permet de classer un
 * essai sans attendre quatre heures du matin.
 *
 * ## POURQUOI LES DEUX HORLOGES, ET NON CELLE DE NODE SEULE
 *
 * C'est la leçon qui a coûté le plus cher à écrire. Mon premier outil décalait
 * l'horloge de Node d'un jour en laissant le navigateur à l'heure réelle. Il
 * mélangeait DEUX perturbations :
 *
 *   — le jour calendaire de Node cesse de coïncider avec le jour logique de
 *     l'écran, ce qui est bien le défaut cherché ;
 *   — mais les HORODATAGES écrits par Node passent dans le futur du
 *     navigateur, ce qui n'arrive jamais.
 *
 * `essais-faits-domaine` a rendu sous ce régime deux croix — « les deux
 * versions sont résumées », « en attendant la réponse, la plus récente
 * s'affiche » — qui portaient sur l'écran de conflit, c'est-à-dire sur des
 * enregistrements datés de demain. Un faux positif, qui allait me faire
 * corriger un défaut inexistant.
 *
 * La nuit réelle, elle, ne décale rien : à 1 h 30, Node et le navigateur sont
 * à la MÊME heure. Seul diverge le jour logique. On déplace donc les deux
 * horloges ensemble, et ce qui rougit alors rougit vraiment la nuit.
 *
 * Et avant cela, une erreur plus bête encore : mon tout premier outil RECULAIT
 * l'horloge de Node. Or la nuit, c'est l'ÉCRAN qui est en retard — le jour
 * logique vaut encore la veille —, donc Node est en avance. Je simulais une
 * situation qui n'arrive jamais, et j'en ai tiré trois verdicts sans valeur.
 *
 * ## Le silence qui rend un vert vide
 *
 * Une troisième version posait le script d'initialisation du navigateur sans
 * l'attendre et avalait ses erreurs (`.catch(() => {})`). Le contexte était
 * rendu avant que le script soit en place, et une erreur de pose disparaissait
 * sans bruit : les verts qu'elle rendait ne prouvaient rien, le navigateur
 * pouvant être resté à l'heure réelle. La pose est maintenant ATTENDUE et ses
 * erreurs remontent. C'est aussi pourquoi `essais:horloge-de-nuit` existe :
 * un outil de mesure dont la panne est silencieuse est pire que pas d'outil.
 *
 * Le crochet annonce son décalage sur la sortie, préfixé `[horloge]` : un
 * script qui classe des essais peut exiger cette ligne avant de croire au
 * résultat.
 */

const VraieDate = Date;

/** Le décalage qui amène « maintenant » à 1 h 30 ce matin, heure de Paris. */
function decalageVersUneHeure() {
  const maintenant = VraieDate.now();
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new VraieDate(maintenant));
  const h = Number(parties.find((p) => p.type === 'hour').value);
  const m = Number(parties.find((p) => p.type === 'minute').value);
  const minutesDepuisMinuit = h * 60 + m;
  /* 1 h 30 : franchement après minuit et franchement avant 4 h, donc à l'abri
     d'un arrondi de part et d'autre de la bascule. */
  const cible = 90;
  let delta = (cible - minutesDepuisMinuit) * 60_000;
  /* Si l'heure réelle est déjà entre minuit et 1 h 30, on recule d'un jour
     plutôt que d'avancer : on veut la nuit QUI VIENT DE PASSER, jamais une
     heure dans le futur. */
  if (delta > 0) delta -= 86_400_000;
  return delta;
}

const DELTA = decalageVersUneHeure();
process.env.REVINSP_DELTA_HORLOGE = String(DELTA);

/* ── Côté Node ──────────────────────────────────────────────────────────── */
class DateNuit extends VraieDate {
  constructor(...args) {
    if (args.length === 0) super(VraieDate.now() + DELTA);
    else super(...args);
  }
  static now() {
    return VraieDate.now() + DELTA;
  }
}
Object.defineProperty(globalThis, 'Date', { value: DateNuit, writable: true, configurable: true });

/* ── Côté navigateur ────────────────────────────────────────────────────── */
/*
   `playwright-core` est résolu depuis le DÉPÔT, et non depuis ce fichier. Un
   module posé par `--import` vit dans /tmp : la résolution par nom y échoue
   (`ERR_MODULE_NOT_FOUND`), et le crochet emportait tout l'essai avec lui.
*/
const { createRequire } = await import('node:module');
const exigerDepuisLeDepot = createRequire(
  `${process.env.RACINE_DEPOT ?? process.cwd()}/package.json`,
);
const pw = await import(
  new URL(`file://${exigerDepuisLeDepot.resolve('playwright-core')}`).href
);
const scriptDInit = `(() => {
  const V = Date, D = ${DELTA};
  class N extends V {
    constructor(...a) { if (a.length === 0) super(V.now() + D); else super(...a); }
    static now() { return V.now() + D; }
  }
  Object.defineProperty(globalThis, 'Date', { value: N, writable: true, configurable: true });
})();`;

/*
   LE SCRIPT D'INITIALISATION EST ATTENDU, ET SES ERREURS NE SONT PAS AVALÉES.

   Ma première version faisait `ctx.addInitScript(...).catch(() => {})` sans
   `await` : le contexte était rendu avant que le script soit posé, l'essai
   pouvait ouvrir sa page entre-temps, et une erreur de pose disparaissait en
   silence. J'ai alors lu un VERT qui ne prouvait rien — le navigateur était
   peut-être resté à l'heure réelle. C'est le motif même de la mesure vide.
*/
async function envelopperContexte(ctx) {
  await ctx.addInitScript(scriptDInit);
  return ctx;
}

function envelopperNavigateur(nav) {
  const vraiContexte = nav.newContext.bind(nav);
  nav.newContext = async (...a) => envelopperContexte(await vraiContexte(...a));
  const vraiePage = nav.newPage.bind(nav);
  nav.newPage = async (...a) => {
    const p = await vraiePage(...a);
    await p.addInitScript(scriptDInit);
    return p;
  };
  return nav;
}

/*
   `playwright-core` est un module CommonJS : importé par URL, ses exports
   arrivent sous `default`. Et c'est la PROPRIÉTÉ `launch` de l'objet
   `chromium` qu'on remplace, non la liaison `chromium` elle-même — l'essai
   tient une référence au même objet, et voit donc l'enveloppe.
*/
const racine = pw.default ?? pw;
const vraiLaunch = racine.chromium.launch.bind(racine.chromium);
racine.chromium.launch = async (...a) => envelopperNavigateur(await vraiLaunch(...a));
const vraiPersistant = racine.chromium.launchPersistentContext.bind(racine.chromium);
racine.chromium.launchPersistentContext = async (...a) =>
  envelopperContexte(await vraiPersistant(...a));

console.log(
  `[horloge] Node et navigateur reculés de ${Math.round(-DELTA / 60000)} min → ` +
    `${new DateNuit().toISOString()} (1 h 30 à Paris)`,
);
