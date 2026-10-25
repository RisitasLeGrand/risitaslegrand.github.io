/**
 * Le menu de garde et « Mon profil », en navigateur.
 *
 * Ce que cet essai couvre : que la racine soit bien un **menu** et non le
 * tableau de bord de Révisions, que l'accueil de Révisions ait suivi à
 * `/revisions/`, que le menu n'affiche **aucune** donnée personnelle hors le
 * prénom, qu'un champ de profil se pose et se supprime, et que la salutation
 * suive.
 *
 * ## Ce que le prompt 56 y ajoute, et ce qu'il en retire
 *
 * Retiré : la portée. Les 52 cases « Lisible par » ne restreignaient rien —
 * `profilDeBranche` n'avait aucun appelant — et elles sont parties (décision 1
 * d'Alexis). L'essai ne vérifie donc plus qu'une case tient après
 * rechargement : il vérifie qu'il n'y a **plus de case**, et que la ligne
 * « Lu par » dit des lecteurs réels.
 *
 * Ajouté : le plan de page, un champ de branche qui se renseigne depuis le
 * profil (B5), un champ qu'on ne demande plus mais qui garde sa valeur
 * (décision 2), l'absence de tout compteur de complétude (interdit 3), et le
 * paragraphe de confidentialité (P14).
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { BOITE, attendreLaBoite, repondreALaBoite, repondreAuChamp } from './lib/boite-essais.mjs';
import { BRANCHES } from '../src/lib/branches.ts';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  /* Cherché, non nommé : voir `lib/chromium-essais.mjs`. Le chercheur lit
     « CHROMIUM » en premier, donc la variable reste prioritaire comme sur
     main ; il trouve en plus le binaire quelle que soit sa version. */
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

/*
   PLUS AUCUNE FENÊTRE NATIVE — section C du prompt 43.

   « Mon profil » saisissait par `window.prompt` et confirmait par
   `window.confirm`. Les deux sont remplacés par la boîte commune
   (`src/lib/boite.ts`), un `<dialog>` ouvert en modal : on y répond par le
   VERBE du bouton, via `scripts/lib/boite-essais.mjs`.

   Le guetteur ci-dessous ne répond plus à la place de l'écran : il signale
   une fenêtre native qui reparaîtrait. Elle arrêterait le modal attendu, et
   l'essai expirerait dix lignes plus loin sans dire pourquoi.
*/
let fenetresNatives = 0;
page.on('dialog', async (d) => {
  fenetresNatives += 1;
  console.log(`FENÊTRE NATIVE INATTENDUE (${d.type()}) : ${d.message().slice(0, 120)}`);
  await d.dismiss().catch(() => undefined);
});

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

/*
   L'initialisation d'abord : depuis la phase C, une base vierge y mène avant de
   voir le menu. Cet essai mesure le menu et « Mon profil », pas la garde — qui
   a ses propres essais.
*/
await franchirInitialisation(page, RACINE, MDP);

console.log('\nLA RACINE EST UN MENU, PAS UNE BRANCHE');

await aller('/', '[data-branche="revisions"]');

{
  const cartes = await page.$$eval('[data-branche]', (els) =>
    els.map((e) => ({
      branche: e.dataset.branche,
      cliquable: e.tagName === 'A',
      texte: e.textContent.replace(/\s+/g, ' ').trim(),
    })),
  );
  /*
     LE COMPTE VIENT DU REGISTRE, PAS D'UN CHIFFRE RECOPIÉ.

     L'essai figeait « trois ». La quatrième branche — Entraînement cognitif,
     consigne du pilote du 18/10 — l'a mis au rouge, alors que le menu la
     proposait correctement : l'essai mesurait la mémoire de son auteur, pas
     l'écran. La référence est donc `BRANCHES`, qui est ce que le menu peint,
     et le contrôle refuse de juger si elle revient vide.
  */
  const attendues = BRANCHES.map((b) => b.id).sort();
  const ouvertes = BRANCHES.filter((b) => b.disponible).map((b) => b.id).sort();
  vrai('le registre des branches a bien été lu', attendues.length > 0);
  v('le menu propose toutes les branches du registre', cartes.map((c) => c.branche).sort(), attendues);
  /*
     Odyssée et Sport se sont ouvertes le 12 octobre 2026, Entraînement
     cognitif est née ouverte. Les branches `disponible` sont donc cliquables,
     et l'essai le vérifie plutôt que de le supposer : c'est exactement la
     ligne qui a rattrapé l'ouverture d'Odyssée, quand les écrans existaient
     et que la navigation n'y menait pas.
  */
  v(
    'les branches ouvertes du registre sont cliquables',
    cartes.filter((c) => c.cliquable).map((c) => c.branche).sort(),
    ouvertes,
  );
  vrai(
    'aucune n’annonce plus « Bientôt »',
    cartes.every((c) => !c.texte.includes('Bientôt')),
  );
  vrai(
    'et Sport est bien un lien',
    await page.evaluate(() => !!document.querySelector('a[data-branche="sport"]')),
  );

  // Aucune donnée personnelle : ni XP, ni série, ni carte de séance.
  const texte = await page.locator('main').textContent();
  vrai('aucune XP au menu', !/\bXP\b/.test(texte));
  vrai('aucune série', !/série/i.test(texte));
  vrai('aucune carte due', !/carte/i.test(texte));
  v('la salutation est neutre tant que le prénom est inconnu', (await page.textContent('#salutation')).trim(), 'Bonjour.');

  /*
     Dans `main`, et non dans la page entière : le pied de page est devenu un
     plan du site et porte lui aussi un lien « Mon profil ». Chercher partout
     en trouverait deux, et l'essai échouerait pour une raison qui n'est pas
     celle qu'il mesure — le menu doit mener au profil, pas être seul à le
     faire.
  */
  vrai('le menu mène à « Mon profil »', await page.locator('main a[href$="/profil/"]').isVisible());
  vrai('aux appareils', await page.locator('main a[href$="/appareils/"]').isVisible());
}

console.log('\nL’ACCUEIL DE RÉVISIONS A SUIVI À /revisions/');

await page.click('a[data-branche="revisions"]');
await page.waitForSelector('#seance-titre', { timeout: 40000 });
v('la branche s’ouvre sur son tableau de bord', new URL(page.url()).pathname, '/revisions/');
vrai(
  'et l’en-tête ramène au menu',
  await page.locator('header a[href="/"]').first().isVisible(),
);
await page.click('header a[href="/"]');
await page.waitForSelector('[data-branche="revisions"]', { timeout: 40000 });
v('le menu revient', new URL(page.url()).pathname, '/');


console.log('\nLE PLAN DE PAGE, DANS L’ORDRE (P1)');

await aller('/profil/', '#avancement');

{
  /*
     L'ORDRE DES SECTIONS, LU DANS LE DOCUMENT.

     Le plan du prompt 56 n'est pas une préférence de mise en page : il met
     « Effacer mon profil » en dernier et « Confidentialité » avant lui, et
     c'est l'ordre dans lequel on vient les chercher. On lit donc les
     identifiants dans l'ordre du document, et non leur présence.
  */
  const ordre = await page.$$eval('main section[id]', (els) => els.map((e) => e.id));
  v(
    'les sections paraissent dans l’ordre du plan',
    ordre.filter((id) =>
      ['vous', 'journee', 'objectifs', 'deductions', 'confidentialite', 'observation'].includes(id),
    ),
    ['vous', 'journee', 'objectifs', 'deductions', 'confidentialite', 'observation'],
  );
  vrai(
    'et le sommaire mène aux cinq ancres',
    (await page.$$eval('nav[aria-label="Sommaire de la page"] a', (els) => els.length)) === 5,
  );
  /* M3 : le renvoi « Affichage » ne coupe plus la page en deux. */
  const texte = await page.locator('main').textContent();
  vrai('plus de section « Affichage » au milieu du profil', !texte.includes('Ouvrir les réglages d’affichage'));
  /* Et le lien vers Ma journée est là : le catalogue des réglages le cite. */
  vrai(
    'le bloc « Votre journée » renvoie à Paramètres',
    await page.locator('#journee a[href*="parametres"]').first().isVisible(),
  );
}

console.log('\nAUCUN COMPTEUR, AUCUNE COMPLÉTUDE (P9, INTERDIT 3)');

{
  const avancement = (await page.textContent('#avancement')).replace(/\s+/g, ' ').trim();
  vrai('la ligne dit que tout reste modifiable', avancement.includes('quand vous voulez'));
  vrai('aucun « sur N »', !/\bsur \d+/.test(avancement));
  vrai('aucun pourcentage', !avancement.includes('%'));
  vrai('aucun « incomplet »', !/incompl/i.test(avancement));
  const page_ = (await page.locator('main').textContent()).replace(/\s+/g, ' ');
  vrai('ni ailleurs dans la page', !/\d+ ?% / .test(page_) && !/réponse\(s\) sur/.test(page_));
}

console.log('\nUN CHAMP VIDE SE RENSEIGNE DEPUIS SA CARTE');

{
  /* Le prénom est vide et lu : sa carte est là, avec « — » et « Renseigner ». */
  const carte = page.locator('[data-carte="prenom"] [data-champ="prenom"]');
  vrai('la carte du prénom est dans le bloc « Vous »', await carte.isVisible());
  v('sa valeur est un tiret', (await page.textContent('[data-valeur="prenom"]')).trim(), '—');
  await page.locator('[data-carte="prenom"] button', { hasText: 'Renseigner' }).first().click();
  await repondreAuChamp(page, 'Alexis', 'Enregistrer');
  await page.waitForFunction(
    () => document.querySelector('[data-valeur="prenom"]')?.textContent?.includes('Alexis'),
    undefined,
    { timeout: 15000 },
  );
  v('la valeur est écrite', (await page.textContent('[data-valeur="prenom"]')).trim(), 'Alexis');
  const texte = (await page.textContent('[data-carte="prenom"]')).replace(/\s+/g, ' ');
  vrai('et la ligne « Lu par » nomme la salutation', texte.includes('Lu par : la salutation du menu'));
  vrai('la provenance est passée dans « Historique »', texte.includes('Historique'));
  vrai('qui dit « déclaré »', texte.includes('déclaré'));
  vrai('et plus aucune « version 1 » sur la carte elle-même', !texte.includes('version 1'));
}

console.log('\nUN CHAMP DEMANDÉ AU BESOIN DIT QUAND IL SE DEMANDE');

{
  /*
     Le mois de naissance n'est pas posé à l'initialisation : il se demande au
     moment où un seuil d'âge tombe sur l'année déclarée. Son absence se
     lirait comme un oubli si l'écran ne disait pas pourquoi — et le bouton
     reste, parce que répondre d'avance est le droit de la personne.
  */
  const carte = (await page.textContent('[data-carte="naissanceMois"]')).replace(/\s+/g, ' ');
  vrai('la carte dit quand la question se pose', carte.includes('Demandé au besoin :'));
  vrai('et pourquoi', carte.includes('seuil'));
  vrai(
    'le bouton « Renseigner » reste offert',
    await page
      .locator('[data-carte="naissanceMois"] button', { hasText: 'Renseigner' })
      .first()
      .isVisible(),
  );
  v(
    'trois champs seulement se demandent au besoin',
    await page.$$eval('[data-au-besoin]', (els) => els.map((e) => e.dataset.auBesoin).sort()),
    ['majeurDeclare', 'naissanceMois', 'usagesCoupes'],
  );
}

console.log('\nPLUS DE CASES DE PORTÉE, ET PLUS DE « UTILISÉ PAR » (P3)');

{
  const texte = (await page.locator('main').textContent()).replace(/\s+/g, ' ');
  vrai('plus de « Lisible par »', !texte.includes('Lisible par'));
  vrai('plus de « Utilisé par »', !texte.includes('Utilisé par'));
  v(
    'plus une seule case à cocher dans les cartes',
    await page.$$eval('[data-champ] input[type="checkbox"]', (els) => els.length),
    0,
  );
  /* Et la ligne « Lu par » de l'âge vient du registre des usages. */
  await page.locator('[data-carte="naissanceAnnee"] button', { hasText: 'Renseigner' }).first().click();
  await repondreAuChamp(page, '1990', 'Enregistrer');
  await page.waitForFunction(
    () => document.querySelector('[data-valeur="naissanceAnnee"]')?.textContent?.includes('1990'),
    undefined,
    { timeout: 15000 },
  );
  const age = (await page.textContent('[data-carte="naissanceAnnee"]')).replace(/\s+/g, ' ');
  vrai('l’année est dite sans séparateur de milliers', age.includes('1990'));
  vrai(
    'et ses lecteurs viennent du registre des usages',
    age.includes('Lu par : les usages de votre âge dans') && age.includes('Qui utilise mon âge'),
  );
}

console.log('\nUN CHAMP DE BRANCHE SE RENSEIGNE DEPUIS LE PROFIL (B5)');

{
  const bloc = page.locator('details[data-branche="revisions"]');
  vrai('la branche Révisions a son bloc', await bloc.isVisible());
  await bloc.locator('summary').click();
  const carte = page.locator('[data-carte="heuresRevision"]');
  vrai('et la carte des heures de révision y est', await carte.isVisible());
  await carte.locator('button', { hasText: 'Renseigner' }).first().click();
  await repondreAuChamp(page, '8', 'Enregistrer');
  await page.waitForFunction(
    () => document.querySelector('[data-valeur="heuresRevision"]')?.textContent?.includes('8'),
    undefined,
    { timeout: 15000 },
  );
  v(
    'la valeur est dite avec son unité',
    (await page.textContent('[data-valeur="heuresRevision"]')).trim(),
    '8 h par semaine',
  );
  v(
    'et le repli compte les réponses données',
    (await page.textContent('[data-compte="revisions"]')).trim(),
    '1 réponse',
  );
}

console.log('\nC2 — UNE RÉPARTITION SE CORRIGE SANS ÉCRIRE DE JSON');

{
  /*
     CE QUE CE CONTRÔLE EMPÊCHE DE REVENIR.

     « Mon profil » n'avait qu'un champ texte pour toutes les natures : pour
     donner ses dates d'épreuves, il fallait taper « {"insp": "2027-03-15"} »
     à la main, et l'aide affichée parlait de domaines — « Forme attendue :
     {"cognition": 10} » — jusque devant ce champ-là, où elle était fausse.

     Le contrôle ne vérifie donc pas qu'un calendrier existe : il vérifie
     qu'AUCUN champ de texte libre ne reste dans la boîte. C'est ce qui rend
     l'absence de JSON vraie plutôt que déclarée — une aide retirée sans que
     le champ change aurait laissé le piège intact, en le taisant.
  */
  const carte = page.locator('[data-carte="datesEpreuves"]');
  vrai('la carte des dates d’épreuves est dans le bloc Révisions', await carte.isVisible());
  await carte.locator('button', { hasText: 'Renseigner' }).first().click();
  await attendreLaBoite(page);

  const dansLaBoite = (sel) => page.locator(`${BOITE}[open] ${sel}`);
  const calendriers = await dansLaBoite('input[type="date"]').count();
  vrai('la boîte offre un calendrier par parcours', calendriers >= 2);
  v('et aucun champ de texte libre', await dansLaBoite('input[type="text"]').count(), 0);
  v('ni de zone de texte', await dansLaBoite('textarea').count(), 0);

  const texteBoite = (await page.locator(`${BOITE}[open]`).textContent()).replace(/\s+/g, ' ');
  vrai('rien ne parle de « forme attendue »', !/forme attendue/i.test(texteBoite));
  vrai('ni d’accolade à recopier', !texteBoite.includes('{'));

  /* Et elle écrit vraiment : une saisie qui n'enregistre pas ne vaut pas
     mieux qu'un champ JSON. */
  await dansLaBoite('input[type="date"]').first().fill('2027-03-15');
  await repondreALaBoite(page, 'Enregistrer');
  await page.waitForFunction(
    () => document.querySelector('[data-valeur="datesEpreuves"]')?.textContent?.includes('2027'),
    undefined,
    { timeout: 15000 },
  );
  vrai(
    'la date choisie est enregistrée',
    (await page.textContent('[data-valeur="datesEpreuves"]')).includes('2027'),
  );
}

console.log('\nUN CHAMP QU’ON NE DEMANDE PLUS GARDE SA VALEUR (DÉCISION 2)');

{
  /*
     Le tutoiement n'est plus demandé : rien ne le lit. Sa carte n'est donc pas
     là tant qu'il est vide — une carte vide inviterait à renseigner une
     réponse que rien ne lirait. Mais une valeur déjà donnée reste visible et
     modifiable, avec la mention qui dit qu'elle est gardée.
  */
  v(
    'sa carte n’est pas là tant qu’il est vide',
    await page.$$eval('[data-champ="formalite"]', (els) => els.length),
    0,
  );
  /*
     ON SÈME UNE RÉPONSE COMME UN PROFIL D'AVANT L'AURAIT LAISSÉE.

     Il n'y a plus de chemin d'écran vers ce champ, et c'est voulu : il n'est
     plus demandé. L'écrire par la base est donc le seul moyen d'éprouver la
     seconde moitié de la décision 2 — « les garder s'ils sont remplis » —, et
     c'est exactement le cas d'une personne qui a répondu la semaine dernière.
     L'opération est écrite dans la forme que `lireProfil` lit : une horloge de
     quinze chiffres, un tiret, quatre caractères.
  */
  await page.evaluate(
    () =>
      new Promise((ok, ko) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const tx = r.result.transaction('operations', 'readwrite');
          tx.objectStore('operations').put({
            id: '01ESSAI56FORMALITE0000000000',
            appareil: 'ESSAI56',
            hlc: `${String(Date.now()).padStart(15, '0')}-0001`,
            type: 'profil.champ',
            cible: 'profil:formalite',
            lot: '',
            charge: { valeur: 'tu', source: 'declare' },
          });
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
        };
        r.onerror = () => ko(r.error);
      }),
  );
  await page.reload({ waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('[data-champ="formalite"]', { timeout: 40000 });
  {
    const texte = (await page.textContent('[data-carte="formalite"]')).replace(/\s+/g, ' ');
    v('la réponse donnée reste visible', (await page.textContent('[data-valeur="formalite"]')).trim(), 'tu');
    vrai(
      'avec la mention qui dit qu’elle est gardée',
      texte.includes('Pas encore utilisé par Cyclades. Votre réponse est gardée.'),
    );
    vrai('elle reste modifiable', texte.includes('Modifier'));
    vrai('et supprimable', texte.includes('Supprimer'));
    vrai('sans ligne « Lu par », puisque rien ne la lit', !texte.includes('Lu par'));
  }

  const sport = page.locator('details[data-branche="sport"]');
  vrai('le bloc Sport existe toujours', await sport.isVisible());
  v(
    'et il dit que plus rien n’y est demandé',
    (await page.textContent('[data-compte="sport"]')).trim(),
    'plus rien n’est demandé ici',
  );
  const dedans = (await page.textContent('[data-champs="branche-sport"]')).replace(/\s+/g, ' ');
  vrai(
    'avec la raison, à l’intérieur',
    dedans.includes('n’est lue par Cyclades aujourd’hui'),
  );
  v(
    'et aucune carte vide à l’intérieur',
    await page.$$eval('[data-champs="branche-sport"] [data-champ]', (els) => els.length),
    0,
  );
}

console.log('\nCE QUE CYCLADES EN DÉDUIT : SEULEMENT CE QUI EST APPLIQUÉ (P4)');

{
  const deduits = await page.$$eval('#reglages [data-reglage]', (els) =>
    els.map((e) => e.dataset.reglage),
  );
  v('trois réglages, et trois seulement', deduits, [
    'bascule-du-jour',
    'fuseau',
    'domaines-affiches',
  ]);
  const texte = (await page.textContent('#deductions')).replace(/\s+/g, ' ');
  vrai('plus de jours de repos', !texte.includes('repos'));
  vrai('plus de créneaux', !texte.includes('Plages proposées'));
  vrai('plus de parcours ouverts', !texte.includes('Parcours ouverts'));
  vrai('et plus la phrase fausse sur la série', !texte.includes('série'));
}

console.log('\nLA CONFIDENTIALITÉ DIT CE QUI SORT, ET CE QUI NE SORT JAMAIS (P14)');

{
  const texte = (await page.textContent('#confidentialite')).replace(/\s+/g, ' ');
  vrai('la copie en clair des heures est dite', texte.includes('copiées en clair sur cet appareil'));
  vrai('les cinq champs qui ne sortent jamais sont nommés', texte.includes('ne sortent pas'));
  vrai('le caviardage du prénom est dit', texte.includes('retirés'));
  vrai('le compte de ce qui sortirait est donné', /Aujourd’hui : \d+ réponse/.test(texte));
  vrai('et le titre de l’écran de l’âge est le nouveau', texte.includes('Qui utilise mon âge'));
  vrai('sans « et mon sexe »', !texte.includes('et mon sexe'));
  const page_ = (await page.locator('main').textContent()).replace(/\s+/g, ' ');
  vrai('nulle part dans la page', !page_.includes('et mon sexe'));
}

console.log('\nUN CHAMP SE SUPPRIME, ET SA CARTE REDEVIENT VIDE');

await page
  .locator('[data-carte="prenom"] button', { hasText: 'Supprimer' })
  .first()
  .click();
await repondreALaBoite(page, 'Supprimer ce champ');
await page.waitForFunction(
  () => document.querySelector('[data-valeur="prenom"]')?.textContent?.trim() === '—',
  undefined,
  { timeout: 15000 },
);

{
  v('la carte est de nouveau vide', (await page.textContent('[data-valeur="prenom"]')).trim(), '—');
  vrai(
    'et elle propose de renseigner',
    await page.locator('[data-carte="prenom"] button', { hasText: 'Renseigner' }).first().isVisible(),
  );
  await aller('/', '#salutation');
  v('le menu ne salue plus par le prénom', (await page.textContent('#salutation')).trim(), 'Bonjour.');
}

console.log('\nLES CIBLES DES CARTES FONT 44 PX (P8)');

await aller('/profil/', '[data-champ]');
{
  const petites = await page.$$eval('[data-champ] button, [data-champ] summary, details[data-branche] summary', (els) =>
    els
      .filter((e) => e.getClientRects().length > 0)
      .filter((e) => e.getBoundingClientRect().height < 44)
      .map((e) => `${e.tagName} « ${(e.textContent ?? '').trim().slice(0, 24)} » ${Math.round(e.getBoundingClientRect().height)}px`),
  );
  v('aucune cible sous 44 px dans les cartes', petites, []);
}

v('aucune fenêtre native n’a été ouverte', fenetresNatives, 0);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de profil en navigateur passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
