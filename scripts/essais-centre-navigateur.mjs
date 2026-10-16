/**
 * Le centre de notifications, par l'écran — prompt 32, phase 2.
 *
 *   npm run essais:centre:navigateur
 *
 * ## Ce que cet essai existe pour prouver
 *
 * `essais:centre-donnees` est **structurel**, et il le dit lui-même : une
 * sonde textuelle attrape la suppression d'un garde-fou, jamais sa
 * neutralisation. `if (false && !peutEtreRange(e))` garde la mention et
 * passe. Le sabotage a été joué, il est resté vert, c'est écrit.
 *
 * C'est donc ici, et seulement ici, que le § 1 n° 8 se constate : une
 * question à trancher **ne peut pas être rangée**, parce qu'on essaie
 * depuis l'écran, avec un vrai magasin et un vrai coffre, et que le
 * magasin refuse.
 *
 * ## Les questions sont vraies
 *
 * L'essai ne sème pas d'éléments dans le magasin du centre : il fabrique
 * un **vrai désaccord** entre deux appareils, par le chemin que la
 * synchronisation emprunte réellement — deux notes concurrentes, un
 * paquet, une fusion. Semer directement aurait éprouvé l'affichage sans
 * éprouver le recensement, et c'est précisément le recensement qui
 * décide de ce que la pastille montre.
 *
 * C'est la leçon d'A-16, et elle a coûté assez cher pour être appliquée
 * sans discuter : un mécanisme qu'aucun parcours réel n'atteint n'existe
 * pas, et seul un essai qui part d'une route le montre.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(
      `      obtenu  ${String(JSON.stringify(obtenu)).slice(0, 220)}\n      attendu ${String(JSON.stringify(attendu)).slice(0, 220)}`,
    );
  }
};
const vrai = (t, c) => v(t, c, true);

async function appareil(nom) {
  const contexte = await nav.newContext({ acceptDownloads: true });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => console.log(`PAGEERROR[${nom}]:`, e.message.slice(0, 200)));
  page.on('dialog', (d) => void d.accept());
  return { nom, contexte, page };
}

/**
 * Ouvre le **coffre**, qui n'est pas le mot de passe du site.
 *
 * Deux verrous distincts, et la distinction a coûté un essai rouge avant
 * d'être comprise : `#champ-mdp` déchiffre le contenu du site,
 * `#mdp-coffre` ouvre les domaines sensibles. `recenser` a besoin du
 * second pour sceller, et il refusait poliment — « coffre-ferme » —
 * pendant que l'essai croyait l'avoir ouvert.
 *
 * Le formulaire n'existe que sur les écrans qui en ont besoin ; on passe
 * donc par l'un d'eux, et la session garde le coffre ouvert pour l'onglet.
 *
 * `/odyssee/corps/` et non `/odyssee/sante/` : Santé masque son formulaire
 * tant que le module n'est pas activé, donc le champ existait sans être
 * visible, et l'attente expirait au lieu de dire pourquoi. Corps l'offre
 * dès que l'initialisation est franchie.
 */
async function ouvrirLeCoffre(appareil) {
  await franchirInitialisation(appareil.page, RACINE, MDP);
  await ouvrir(appareil, '/odyssee/corps/', '#entete-principal');
  /*
     Une prémisse d'essai se lit, elle ne se devine pas : si le champ n'est
     pas là, on le DIT, au lieu d'attendre quarante secondes un témoin qui
     ne viendra jamais.
  */
  const champ = await appareil.page.locator('#mdp-coffre').isVisible().catch(() => false);
  vrai(`[${appareil.nom}] le formulaire du coffre est offert`, champ);
  if (champ) {
    await appareil.page.fill('#mdp-coffre', MDP);
    await appareil.page.click('#ouvrir-coffre');
  }
  await appareil.page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 });
}

async function ouvrir(appareil, chemin, selecteur) {
  await appareil.page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await appareil.page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await appareil.page.fill('#champ-mdp', MDP);
    await appareil.page.click('#bouton-verrou');
  }
  if (selecteur) await appareil.page.waitForSelector(selecteur, { timeout: 40000 });
}

const ecrireOperation = (appareil, { id, type, cible, charge, ms }) =>
  appareil.page.evaluate(
    async ([id, type, cible, charge, ms]) => {
      const base = await new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
      });
      const moi = await new Promise((ok) => {
        const q = base.transaction('etat').objectStore('etat').get('appareil');
        q.onsuccess = () => ok(q.result);
      });
      const op = { id, appareil: moi, hlc: `${String(ms).padStart(15, '0')}-0000`, type, cible, lot: '', charge };
      await new Promise((ok, ko) => {
        const tx = base.transaction('operations', 'readwrite');
        tx.objectStore('operations').put(op);
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      base.close();
      return op;
    },
    [id, type, cible, charge, ms],
  );

async function envoyer(appareil) {
  await ouvrir(appareil, '/appareils/', '#ecran:not(.hidden)');
  await appareil.page.fill('#mdp-envoi', MDP);
  const attente = appareil.page.waitForEvent('download', { timeout: 90000 });
  await appareil.page.click('#envoyer');
  const telechargement = await attente;
  await appareil.page.waitForSelector('#message-envoi:not(.hidden)', { timeout: 40000 });
  return await telechargement.path();
}

async function recevoir(appareil, chemin) {
  await ouvrir(appareil, '/appareils/', '#ecran:not(.hidden)');
  await appareil.page.setInputFiles('#fichier', chemin);
  await appareil.page.waitForSelector('#apercu:not(.hidden)', { timeout: 40000 });
  await appareil.page.fill('#mdp-fusion', MDP);
  await appareil.page.click('#fusionner');
  await appareil.page.waitForSelector('#message-fusion:not(.hidden)', { timeout: 90000 });
  await appareil.page.waitForFunction(
    () => !document.getElementById('message-fusion').textContent.includes('en cours'),
    undefined,
    { timeout: 90000 },
  );
}

/** Ce que porte le magasin du centre, vu de la base — sans passer par l'écran. */
const magasinDuCentre = (appareil) =>
  appareil.page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const tout = await new Promise((ok) => {
      const q = base.transaction('centreElements').objectStore('centreElements').getAll();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    /*
       On rend les champs EN CLAIR tels qu'ils sont réellement sur le disque.
       C'est la seule façon de vérifier que le reste est bien scellé : si
       `source` ou `refSource` apparaissaient ici, le § 4.1 serait violé et
       aucune lecture par l'écran ne le montrerait.
    */
    return tout.map((e) => ({ champs: Object.keys(e).sort(), genre: e.genre }));
  });

const A = await appareil('ordinateur');
const B = await appareil('telephone');

const SEANCE = 'seance-centre-essai';
const base = Date.now();

console.log('\n\x1b[1m1. UN VRAI DÉSACCORD ENTRE DEUX APPAREILS\x1b[0m');

await ouvrir(A, '/revisions/', '#entete-principal');
await ouvrir(B, '/revisions/', '#entete-principal');
await ouvrirLeCoffre(A);
await ouvrirLeCoffre(B);

await ecrireOperation(A, {
  id: '01CENTREORDI000000000001',
  type: 'revision.note-seance',
  cible: `notes:${SEANCE}`,
  charge: {
    magasin: 'notes',
    enregistrement: { seanceId: SEANCE, note: 'Version de l’ordinateur.', restitutions: {}, majLe: new Date(base).toISOString() },
  },
  ms: base,
});
await ecrireOperation(B, {
  id: '01CENTREPHONE00000000001',
  type: 'revision.note-seance',
  cible: `notes:${SEANCE}`,
  charge: {
    magasin: 'notes',
    enregistrement: { seanceId: SEANCE, note: 'Version du téléphone.', restitutions: {}, majLe: new Date(base + 1000).toISOString() },
  },
  ms: base + 1000,
});

const paquet = await envoyer(A);
await recevoir(B, paquet);

await ouvrir(B, '/appareils/', '#ecran:not(.hidden)');
await B.page.waitForSelector('#conflits:not(.hidden)', { timeout: 40000 });
vrai('le désaccord est ouvert sur le second appareil', true);
vrai(
  'et le coffre est ouvert, sans quoi rien ne se déposerait',
  await B.page.evaluate(() => !document.getElementById('temoin-coffre')?.classList.contains('hidden')),
);

/* Le recensement est lancé par l'écran, sans attendre le rendu : on laisse
   la transaction se poser avant de lire le magasin. */
await B.page.waitForFunction(
  async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const n = await new Promise((ok) => {
      const q = base.transaction('centreElements').objectStore('centreElements').count();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return n > 0;
  },
  undefined,
  { timeout: 40000 },
);

console.log('\n\x1b[1m2. CE QUI EST ÉCRIT SUR LE DISQUE (§ 4.1)\x1b[0m');
{
  const enregistrements = await magasinDuCentre(B);
  /*
     Compter d'abord : un contrôle qui s'effondre renseigne moins qu'un
     contrôle qui accuse. La première version lisait `[0].champs` et
     plantait sur un tableau vide, masquant la ligne en cause.
  */
  v('un element a ete depose', enregistrements.length, 1);
  /*
     Le § 4.1 interdit domaine, source et date fine dans les index en clair.
     Seuls `id`, `genre` et `scelle` ont le droit d'y être — `genre` par la
     décision N-1 option A, qui fait vivre la pastille coffre fermé.
  */
  if (enregistrements.length) {
    v('les champs en clair sont exactement ceux prévus', enregistrements[0].champs, ['genre', 'id', 'scelle']);
    v('et le genre est celui d’une question', enregistrements[0].genre, 'a-trancher');
  }
}

console.log('\n\x1b[1m3. LA PASTILLE COMPTE, ET LE PANNEAU S’OUVRE\x1b[0m');
await ouvrir(B, '/revisions/', '#centre-notifications');
{
  const visible = await B.page.locator('#centre-pastille').isVisible();
  vrai('la pastille est visible', visible);
  v('elle annonce une question', (await B.page.textContent('#centre-pastille')).trim(), '1');

  await B.page.click('#centre-bouton');
  await B.page.waitForSelector('#centre-panneau:not([hidden])', { timeout: 20000 });
  const lignes = await B.page.locator('#centre-liste li').count();
  v('une ligne dans le panneau', lignes, 1);
  vrai(
    'sous le titre du groupe de sa source',
    (await B.page.textContent('#centre-liste')).includes('Questions à trancher'),
  );
  /*
     Le § 2.3 veut un élément sans contenu : la ligne ne doit donc PAS
     contenir le texte de la note en désaccord, ni le nom du magasin.
  */
  const texte = await B.page.textContent('#centre-liste');
  v('aucune trace du contenu en désaccord', /ordinateur|téléphone|note-seance/i.test(texte), false);
}

console.log('\n\x1b[1m4. UNE QUESTION NE SE RANGE PAS — § 1 n° 8, PAR L’EXÉCUTION\x1b[0m');
{
  /*
     Le contrôle que la sonde textuelle ne pouvait pas faire. On compte
     d'abord : un sélecteur qui ne trouve rien doit accuser, pas expirer.
  */
  const ligne = B.page.locator('#centre-liste li').first();
  const boutons = await ligne.locator('button').count();
  vrai('la ligne porte au moins un bouton', boutons > 0);

  const titres = await ligne.locator('button').evaluateAll((bs) => bs.map((b) => b.title));
  v('« Marquer comme lu » est proposé', titres.includes('Marquer comme lu'), true);
  /*
     Absent, pas désactivé : un bouton grisé invite à chercher comment
     l'activer, et la bonne réponse est qu'il n'y en a pas.
  */
  v('« Archiver » est ABSENT d’une question', titres.includes('Archiver'), false);

  /*
     Alors on éprouve le refus par le chemin qui reste : « Tout marquer
     comme lu ». Le bouton passe sur TOUS les éléments ; si le magasin
     laissait ranger une question, celle-ci passerait à « lu » et son
     bouton « Marquer comme lu » disparaîtrait du panneau.
  */
  await B.page.click('#centre-tout-lu');
  await B.page.waitForTimeout(1500);
  const apres = await B.page
    .locator('#centre-liste li')
    .first()
    .locator('button')
    .evaluateAll((bs) => bs.map((b) => b.title));
  v('après « tout marquer comme lu », la question est toujours non lue', apres.includes('Marquer comme lu'), true);
  v('et toujours pas archivable', apres.includes('Archiver'), false);
  v('la pastille n’a pas bougé', (await B.page.textContent('#centre-pastille')).trim(), '1');
}

console.log('\n\x1b[1m5. COFFRE FERMÉ : UNE MENTION FIXE, ET AUCUN NOMBRE (§ 3.2)\x1b[0m');
{
  /* On ferme par le témoin de l'en-tête, comme un utilisateur le ferait. */
  await B.page.click('#temoin-coffre-fermer').catch(async () => {
    await B.page.click('#temoin-coffre button');
  });
  await B.page.waitForTimeout(1200);
  await ouvrir(B, '/revisions/', '#centre-notifications');
  /* On ne saisit PAS le mot de passe : `ouvrir` le ferait si le champ était
     visible, donc on vérifie d'abord l'état réel plutôt que de le supposer. */
  const coffreOuvert = await B.page.evaluate(
    () => !document.getElementById('temoin-coffre')?.classList.contains('hidden'),
  );
  if (coffreOuvert) {
    console.log('  \x1b[33m!\x1b[0m le coffre s’est rouvert : la section 5 n’a pas pu être éprouvée');
    echecs += 1;
  } else {
    await B.page.click('#centre-bouton');
    await B.page.waitForSelector('#centre-panneau:not([hidden])', { timeout: 20000 });
    vrai(
      'la mention fixe est affichée',
      await B.page.locator('#centre-coffre-ferme').isVisible(),
    );
    v('aucune ligne n’est listée', await B.page.locator('#centre-liste li').count(), 0);
    const panneau = await B.page.textContent('#centre-panneau');
    v('aucun nombre dans le panneau', /\d/.test(panneau.replace(/[^\S\n]/g, '')), false);
    v('et pas la moindre mention « chiffré »', /chiffr/i.test(panneau), false);
  }
}

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
