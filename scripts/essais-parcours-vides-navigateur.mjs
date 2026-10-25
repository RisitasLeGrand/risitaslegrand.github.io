/**
 * Un parcours planifiable et sans contenu : des états vides, jamais un écran mort.
 *
 *   SITE_PASSWORD=… npm run essais:parcours-vides:navigateur
 *
 * ## Ce que ce contrôle garde, et pourquoi il naît maintenant
 *
 * Jusqu'au 25 octobre, DGFiP A et A+ portaient `themes: []` : la planification
 * ne s'ouvrait pas pour eux, et un seul chemin existait — le bloc « Planification
 * indisponible ». Maintenant que les programmes sont établis sur l'arrêté, DGFiP
 * A et DGFiP B sont **planifiables sans porter une seule fiche** : leur dossier
 * de contenu n'existe pas. C'est un état entièrement neuf, et il est durable —
 * le contenu DGFiP viendra fiche par fiche, pendant des mois.
 *
 * Le risque qu'il crée est précis : un calendrier qui se peint à partir de
 * thèmes réels mais sans aucune fiche derrière. Soit il le dit — « Aucune
 * révision » —, soit il affiche des cases muettes, et la personne conclut que
 * l'application est cassée. Un essai de nœud ne peut pas trancher entre les
 * deux : il faut peindre l'écran.
 *
 * ## Pourquoi cet essai est séparé de `essais:registre-dgfip`
 *
 * Le lot demandait un essai pour deux garanties. Elles ne se mesurent pas au
 * même endroit : la correspondance des thèmes au document officiel se lit dans
 * deux fichiers, sans navigateur, et doit rester dans le socle de nœud, rapide
 * et sans mot de passe. Celle-ci demande un vrai navigateur, un déverrouillage
 * et une base. Les coudre ensemble aurait rendu la première dépendante du mot
 * de passe pour rien.
 *
 * ## Les trois cas, et ils sont trois
 *
 *  1. DGFiP B et DGFiP A — planifiables, sans contenu : le calendrier s'ouvre
 *     et nomme ses thèmes, et rien ne se tait.
 *  2. DGFiP A+ — référentiel officiel, aucun thème : le bloc « indisponible »,
 *     avec la raison de l'ABROGATION, et surtout pas « pas encore établi sur
 *     source officielle », qui serait faux.
 *  3. INSP — planifiable et avec du contenu : le témoin. Sans lui, un écran qui
 *     dirait « aucune révision » partout passerait pour un succès.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1200, height: 1100 } });
const page = await ctx.newPage();

/*
   Les erreurs de page sont collectées et contrôlées à la fin, et non ignorées.
   Un calendrier qui lève sur un parcours sans contenu afficherait le bloc de
   chargement pour toujours — ce qui ressemble, à l'œil, à une page lente.
*/
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 200)));

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
const faux = (titre, obtenu) => v(titre, obtenu, false);

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(2500);
  }
};

await franchirInitialisation(page, RACINE, MDP);

/**
 * Ouvre la planification sur un parcours donné.
 *
 * Le parcours courant vit dans `localStorage` sous `revinsp.parcours` — voir
 * `src/lib/parcours/courant.ts`, qui explique pourquoi il n'est pas en base.
 * On l'écrit avant la navigation : passer par le sélecteur ferait dépendre cet
 * essai d'un composant qu'il ne mesure pas, et l'écran lit la clé au chargement
 * exactement comme après un choix.
 */
async function ouvrirLaPlanification(idParcours) {
  await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
  await page.evaluate((id) => localStorage.setItem('revinsp.parcours', id), idParcours);
  await page.goto(`${RACINE}/planification/`, { waitUntil: 'networkidle' });
  await connecter();
  // L'écran ouvre l'un OU l'autre des deux blocs : on attend que le chargement cède.
  await page.waitForFunction(
    () => document.getElementById('chargement')?.classList.contains('hidden') === true,
    undefined,
    { timeout: 40000 },
  );
  await page.waitForTimeout(600);
  return {
    calendrier: await page.locator('#planification').isVisible(),
    indisponible: await page.locator('#sans-referentiel').isVisible(),
    raison: (await page.locator('#texte-sans-referentiel').textContent()) ?? '',
    planning: (await page.locator('#planning').textContent().catch(() => '')) ?? '',
    /*
       La semaine se compte dans la grille de ROTATION, qui porte sept jours
       exactement — un par `rotation-0` … `rotation-6`. La grille du planning,
       elle, porte « les jours écoulés depuis l'ouverture du carnet, aujourd'hui
       et les deux semaines à venir » : son compte varie avec la date, et
       l'exiger à sept aurait fait rougir l'essai sur son propre malentendu.
       Mesuré : quatorze sur un carnet ouvert du jour.
    */
    avertissement: await page.locator('#avertissement-programme').isVisible(),
    texteAvertissement:
      (await page.locator('#texte-avertissement-programme').textContent().catch(() => '')) ?? '',
    semaine: await page.locator('#grille-rotation select').count(),
    rotation: (await page.locator('#grille-rotation').textContent().catch(() => '')) ?? '',
    sansProposition: await page
      .locator('#grille-rotation select')
      .evaluateAll((menus) => menus.filter((m) => m.value === '').length)
      .catch(() => -1),
  };
}

/* ── 1. Le témoin : l'INSP, planifiable et pourvu ─────────────────────── */

console.log('\nLE TÉMOIN — L’INSP A DES THÈMES ET DU CONTENU');

{
  const e = await ouvrirLaPlanification('insp');
  vrai('le calendrier s’ouvre', e.calendrier);
  faux('et le bloc « indisponible » reste fermé', e.indisponible);
  vrai('le planning nomme une matière de l’INSP', /Droit public|Cas pratique/.test(e.planning));
}

/* ── 2. Planifiable et sans aucune fiche ──────────────────────────────── */

console.log('\nPLANIFIABLE ET SANS CONTENU — LE CALENDRIER S’OUVRE QUAND MÊME');

/*
   Les deux parcours DGFiP dont le programme est désormais établi. Leur dossier
   de contenu — `content/dgfip-b`, `content/dgfip-a` — n'existe pas : c'est
   exactement l'état que ce bloc mesure, et il n'est pas une anomalie de l'essai.
*/
for (const [id, libelle, attendu] of [
  ['dgfip-b', 'DGFiP B', 'Connaissances générales'],
  ['dgfip-a', 'DGFiP A', 'Union européenne'],
]) {
  const e = await ouvrirLaPlanification(id);
  vrai(`${libelle} : le calendrier s’ouvre`, e.calendrier);
  faux(`${libelle} : le bloc « indisponible » reste fermé`, e.indisponible);
  /*
     SEPT JOURS, PAS SIX. DGFiP A n'a que six thèmes, et son septième jour est
     laissé sans proposition — ce qui ne doit pas le faire disparaître du
     calendrier. C'est la conséquence visible du tableau de rotation plus court
     que la semaine, et c'est ici qu'on la tient.
  */
  v(`${libelle} : la semaine porte ses sept jours`, e.semaine, 7);
  vrai(`${libelle} : le planning nomme un de ses thèmes — ${attendu}`, e.planning.includes(attendu));
  /*
     ET L'ÉCRAN NE SE TAIT PAS SUR L'ABSENCE. Sans une seule fiche, chaque jour
     doit porter une phrase qui le dise. Un calendrier de sept cases vides
     laisserait croire à une panne.
  */
  vrai(
    `${libelle} : l’absence de révision est écrite`,
    /Aucune révision|Rien à réviser|aucune fiche/i.test(e.planning),
  );
  faux(`${libelle} : aucun thème de l’INSP ne s’y égare`, /Cas pratique/.test(e.planning));
}

/*
   LE SEPTIÈME JOUR DE DGFiP A, QUI NE REÇOIT RIEN — ET LE DÉFAUT QUE CELA A
   RÉVÉLÉ.

   Six thèmes à l'arrêté, sept jours dans la semaine : le samedi de DGFiP A ne
   porte aucune proposition. Le menu de rotation n'avait alors AUCUNE option
   correspondant à la valeur enregistrée, et le navigateur sélectionnait donc la
   première de la liste : l'écran affichait « Environnement administratif… »
   là où rien n'était enregistré. Mesuré à l'exécution, pas supposé — et l'état
   n'était pas atteignable avant ce lot, puisqu'un parcours sans thèmes
   n'arrivait jamais à cette grille.

   Les deux contrôles ci-dessous tiennent la correction : un menu vraiment vide
   côté valeur, et une phrase qui le dit côté écran.
*/
{
  const b = await ouvrirLaPlanification('dgfip-b');
  v('DGFiP B : ses sept thèmes remplissent la semaine', b.sansProposition, 0);
  faux('DGFiP B : aucune case ne dit « rien de proposé »', /Rien de proposé/.test(b.rotation));

  /*
     DGFiP A a reçu son septième thème le 25 octobre — l'organisation de la
     DGFiP, portée par le thème I du QCM et l'option 5 de l'interne —, donc sa
     semaine est pleine. Le cas « jour sans proposition » a migré vers A+, et
     c'est là qu'il est mesuré. Le garder ici aurait fait rougir l'essai sur un
     état que le programme ne produit plus.
  */
  const a = await ouvrirLaPlanification('dgfip-a');
  v('DGFiP A : ses sept thèmes remplissent la semaine', a.sansProposition, 0);
  faux('DGFiP A : aucune case ne dit « rien de proposé »', /Rien de proposé/.test(a.rotation));
  /*
     Le témoin de la correction : l'INSP a sept thèmes, donc aucune case vide,
     donc la phrase ne doit pas apparaître. Sans ce constat, une option ajoutée
     à tous les menus passerait pour un succès.
  */
  const insp = await ouvrirLaPlanification('insp');
  v('INSP : aucune case sans proposition', insp.sansProposition, 0);
  faux('INSP : et la phrase ne s’affiche pas', /Rien de proposé/.test(insp.rotation));
}

/* ── 3. Des thèmes sans programme : A+ avertit au lieu de se taire ────── */

console.log('\nDES THÈMES SANS PROGRAMME — A+ AVERTIT AU LIEU DE SE TAIRE');

/*
   LE CAS A CHANGÉ DE NATURE LE 25 OCTOBRE, ET L'ESSAI AVEC LUI.

   A+ n'avait aucun thème, et affichait donc le bloc « Planification
   indisponible » avec la raison de l'abrogation. Alexis veut le parcours servi :
   il porte maintenant les quatre épreuves de l'article 1er, qui est la seule
   délimitation en vigueur. Son calendrier s'ouvre donc, et le fait qui comptait
   — le programme annexé est abrogé — ne doit pas disparaître avec le bloc qui le
   portait. Il est passé dans un avertissement affiché AVEC le calendrier.

   C'est le genre de glissement qui fait perdre une garantie sans qu'une seule
   ligne rougisse : le bloc disparaît, sa phrase avec, et l'essai qui ne
   mesurait que le bloc reste vert.
*/
{
  const e = await ouvrirLaPlanification('dgfip-ap');
  vrai('DGFiP A+ : le calendrier s’ouvre', e.calendrier);
  faux('DGFiP A+ : le bloc « indisponible » reste fermé', e.indisponible);
  vrai('DGFiP A+ : mais l’avertissement s’affiche', e.avertissement);
  vrai('DGFiP A+ : et il dit l’abrogation', /abrog/i.test(e.texteAvertissement));
  vrai("DGFiP A+ : et d’où viennent ses thèmes", /article 1er/.test(e.texteAvertissement));
  faux(
    'DGFiP A+ : et ne prétend pas attendre une source',
    /pas encore établi/.test(e.texteAvertissement),
  );
  /*
     Quatre épreuves, sept jours : trois jours sans proposition, annoncés case
     par case. C'est ici que le compte se mesure, et non dans le registre seul.
  */
  v('DGFiP A+ : trois jours restent sans proposition', e.sansProposition, 3);
  vrai('DGFiP A+ : et l’écran le dit', /Rien de proposé/.test(e.rotation));
  vrai('DGFiP A+ : son épreuve professionnelle est au calendrier', e.planning.includes('Épreuve professionnelle'));
}

/*
   ET L'AVERTISSEMENT NE S'AFFICHE QUE LÀ. Le coller partout affaiblirait celui
   qui compte ; un bandeau permanent cesse d'être lu.
*/
console.log('\nET AUCUN AUTRE PARCOURS NE PORTE CET AVERTISSEMENT');

for (const [id, libelle] of [['insp', 'INSP'], ['dgfip-b', 'DGFiP B'], ['dgfip-a', 'DGFiP A']]) {
  const e = await ouvrirLaPlanification(id);
  faux(`${libelle} : aucun avertissement de programme`, e.avertissement);
}

/* ── 4. Rien n'a levé ─────────────────────────────────────────────────── */

console.log('\nAUCUN ÉCRAN N’A LEVÉ');

v('aucune erreur de page sur les quatre parcours', erreurs, []);

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
