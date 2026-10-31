/**
 * Pointer coffre fermé, ouvrir, constater le rejeu — A-6 option D.
 *
 *   npm run essais:rejeu:navigateur
 *
 * ## Ce que ce parcours prouve, et pourquoi il manquait
 *
 * L'option D, signée le 15 octobre, promet qu'« un report est rejoué ou
 * signalé, jamais perdu en silence ». Le moteur `rejouerLesReports()`
 * était écrit, éprouvé, et **appelé par personne** : un geste fait coffre
 * fermé était gardé, jamais rejoué, jamais dit. Aucun contrôle de module
 * ne pouvait le voir — chaque pièce était juste, c'est la **rencontre**
 * qui manquait, la classe de défaut A-16.
 *
 * Le parcours suit donc la vie réelle : on ouvre le coffre une fois pour
 * que la boîte naisse, on le ferme, on pointe une occurrence d'une tâche
 * liée à une branche scellée — le pointage part en pli —, on rouvre, et
 * on regarde si le pli est devenu une exception.
 *
 * ## Ce qu'il ne prouve pas
 *
 * Le changement de mot de passe lui-même, qui est la cause RÉELLE d'un pli
 * illisible. La section 5 constate désormais ses conséquences — un pli que
 * la clé ne peut pas ouvrir est gardé, compté et DIT —, mais elle les
 * obtient en semant un pli illisible, non en changeant le mot de passe du
 * site en cours de parcours.
 *
 * Cette limite-ci était écrite plus large qu'elle ne l'est : elle
 * affirmait que le cas « demanderait de changer le mot de passe ». C'était
 * une supposition, et elle était fausse — il suffit d'un pli que la clé ne
 * peut pas ouvrir. Une limite déclarée trop tôt dispense d'essayer, et
 * c'est la façon la plus discrète de laisser un chemin sans contrôle.
 *
 * La tâche est **semée** directement dans son magasin, qui n'est pas
 * scellé : la créer par l'écran ajouterait un formulaire à éprouver sans
 * rien apprendre sur le rejeu. Tout le reste passe par les écrans réels.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { devientVisible } from './lib/post-condition.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const TACHE = 'tache-rejeu-essai';
const PLI_SEME = 'pli-illisible-essai';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));

const aller = async (chemin, selecteur) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
};

const coffreOuvert = () =>
  page.evaluate(() => !document.getElementById('temoin-coffre')?.classList.contains('hidden'));

/** Combien de lignes porte un magasin, vu de la base. */
const compter = (magasin) =>
  page.evaluate(async (nom) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const n = await new Promise((ok) => {
      const q = base.transaction(nom).objectStore(nom).count();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return n;
  }, magasin);

/**
 * Sème un pli ILLISIBLE, et c'est ce qui ouvre le cas positif.
 *
 * Un pli est `{ id, pli }`. `releverLesReports` tente de l'ouvrir avec la
 * clé privée de la boîte ; si l'ouverture lève, il est compté
 * « illisible » et **n'est pas supprimé** — « un geste perdu sans trace
 * est pire qu'un geste refusé ». Le compte reste donc positif, et c'est
 * précisément l'état où l'écran doit parler.
 *
 * L'en-tête de ce fichier annonçait ce cas comme non constaté, en
 * supposant qu'il faudrait changer le mot de passe du site en cours de
 * parcours. La supposition était trop pessimiste : il suffit d'un pli que
 * la clé ne peut pas ouvrir, et le mot de passe reste intact.
 */
const semerUnPliIllisible = (id) =>
  page.evaluate(async (identifiant) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    await new Promise((ok, non) => {
      const t = base.transaction('odysseeReports', 'readwrite');
      t.objectStore('odysseeReports').put({ id: identifiant, pli: 'ceci-n-est-pas-un-pli' });
      t.oncomplete = () => ok();
      t.onerror = () => non(t.error);
    });
    base.close();
  }, id);

/** Retire le pli semé. Effacer n'est pas lire : le coffre n'est pas requis. */
const faucherLePli = (id) =>
  page.evaluate(async (identifiant) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    await new Promise((ok, non) => {
      const t = base.transaction('odysseeReports', 'readwrite');
      t.objectStore('odysseeReports').delete(identifiant);
      t.oncomplete = () => ok();
      t.onerror = () => non(t.error);
    });
    base.close();
  }, id);

await franchirInitialisation(page, RACINE, MDP);

console.log('\n\x1b[1m1. LA BOÎTE NAÎT À LA PREMIÈRE OUVERTURE DU COFFRE\x1b[0m');
await aller('/odyssee/corps/', '#entete-principal');
{
  const champ = await page.locator('#mdp-coffre').isVisible().catch(() => false);
  vrai('le formulaire du coffre est offert', champ);
  if (champ) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
  vrai('le coffre est ouvert', await coffreOuvert());
}

console.log('\n\x1b[1m2. UNE TÂCHE LIÉE À UNE BRANCHE SCELLÉE, ET LE COFFRE REFERMÉ\x1b[0m');
const aujourdhui = await page.evaluate(async (id) => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  /*
     Le jour logique commence à 4 h ; avant cette heure, « aujourd'hui »
     est la veille. On sème donc une série QUOTIDIENNE ancrée huit jours
     en arrière : quelle que soit l'heure du parcours, il y a une
     occurrence du jour, et l'essai ne dépend pas de l'horloge.
  */
  const jour = new Date(Date.now() - 86_400_000 * 8).toISOString().slice(0, 10);
  const maintenant = new Date().toISOString();
  await new Promise((ok, ko) => {
    const tx = base.transaction('odysseeTaches', 'readwrite');
    tx.objectStore('odysseeTaches').put({
      id,
      titre: 'Tâche semée du contrôle',
      domaine: 'psyche',
      echeance: null,
      faiteLe: null,
      abandonneeLe: null,
      motifAbandon: null,
      note: '',
      creeeLe: maintenant,
      majLe: maintenant,
      serie: {
        depuis: jour,
        repetition: { type: 'jours', tous: 1 },
        fin: { type: 'jamais' },
        heure: null,
      },
      /* `odyssee.checkin` est sous coffre : c'est ce qui rend l'exception scellée. */
      lien: { action: 'odyssee.checkin' },
    });
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
  return new Date().toISOString().slice(0, 10);
}, TACHE);

/* On referme par le témoin de l'en-tête, comme on le ferait à la main. */
await page.click('#temoin-coffre-fermer').catch(async () => {
  await page.click('#temoin-coffre button');
});
/*
   LA FERMETURE A SON TÉMOIN, et il est positif au sens du § 3 : le témoin
   du coffre était VISIBLE avant ce clic, on le veut caché après. L'état
   attendu diffère de l'état d'avant, donc l'attente mesure quelque chose
   — ce que 1200 ms ne faisaient pas.

   L'assertion `coffreOuvert() === false` quatorze lignes plus bas ne
   suffisait pas à la remplacer : elle arrive APRÈS un `goto`, qui remet le
   témoin à son état de départ. Elle aurait donc été verte même si le clic
   n'avait rien fermé, et c'est le genre de vert que cette attente aveugle
   couvrait sans qu'on le sache.
*/
await devientVisible(page, '#temoin-coffre', false, { delai: 30000 });
/*
   Par l'écran des TÂCHES et non par le calendrier, et ce n'est pas un
   détail de commodité : le calendrier s'arrête un cran plus tôt. Sur une
   occurrence illisible — branche scellée, coffre fermé — il affiche
   « État chiffré » puis `return` avant toute action, donc il n'offre
   aucun moyen de pointer, donc le dépôt du pli y est inatteignable.
   Trouvé par cet essai, remonté comme anomalie A-20, et pas corrigé ici :
   ce qu'un écran montre d'une branche scellée est une décision d'Alexis.

   L'écran des tâches, lui, passe par `etatDuJour` et offre « Faite ».
   C'est le chemin réel qui marche aujourd'hui, et c'est celui qu'on suit.
*/
await aller('/odyssee/taches/', '#entete-principal');
v('le coffre est bien refermé avant de pointer', await coffreOuvert(), false);
v('aucun pli en attente au départ', await compter('odysseeReports'), 0);

console.log('\n\x1b[1m3. LE POINTAGE PART EN PLI\x1b[0m');
{
  /*
     On compte le bouton avant de cliquer : un sélecteur qui ne trouve
     rien doit accuser, pas expirer sur quarante secondes.
  */
  const bouton = page.locator(`[data-faire="${TACHE}"]`).first();
  await page.waitForSelector(`[data-faire="${TACHE}"]`, { timeout: 30000 }).catch(() => {});
  const combien = await page.locator(`[data-faire="${TACHE}"]`).count();
  vrai(`la tâche du jour est pointable (${combien} bouton(s))`, combien > 0);
  if (combien > 0) {
    await bouton.click();
    let plis = 0;
    for (let i = 0; i < 40; i += 1) {
      plis = await compter('odysseeReports');
      if (plis > 0) break;
      await page.waitForTimeout(400);
    }
    v('un pli est gardé, coffre fermé', plis, 1);
    /*
       Et rien n'est écrit dans le magasin scellé : c'est la moitié qui
       dit que le geste a bien été REPORTÉ, et non écrit en douce.
    */
    v('aucune exception scellée n’a été écrite', await compter('odysseeExceptionsScellees'), 0);
  }
}

console.log('\n\x1b[1m4. À L’OUVERTURE DU COFFRE, LE PLI EST REJOUÉ\x1b[0m');
{
  await aller('/odyssee/corps/', '#entete-principal');
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
  vrai('le coffre est rouvert', await coffreOuvert());

  let plis = 1;
  let exceptions = 0;
  for (let i = 0; i < 40; i += 1) {
    plis = await compter('odysseeReports');
    exceptions = await compter('odysseeExceptionsScellees');
    if (plis === 0 && exceptions > 0) break;
    /* Pas de scrutation borné dans une boucle qui re-teste : pas un pari. */
    await page.waitForTimeout(400);
  }
  v('le pli a disparu de la file', plis, 0);
  v('et une exception scellée a pris sa place', exceptions, 1);
}

console.log('\n\x1b[1m5. CE QUI RESTE EST DIT, ET CE QUI NE RESTE PAS SE TAIT\x1b[0m');
{
  /*
     LE CAS POSITIF D'ABORD, ET C'EST LUI QUI DONNE UN OBJET AU NÉGATIF.

     Cette section n'avait qu'une assertion — « la mention reste cachée » —
     et elle était vert à vide par construction. `#gestes-en-attente` naît
     avec la classe `hidden` (odyssee/index.astro:62) et, dans le cas qui
     passe, le gestionnaire la lui REMET (index.astro:813). L'état attendu
     était identique à l'état d'avant : rien ne distinguait « le
     gestionnaire a tourné et a décidé de cacher » de « il n'a jamais
     tourné ». Une temporisation de 3000 ms rendait la chose plausible, et
     c'est tout ce qu'elle faisait.

     On montre donc d'abord que la mention PARAÎT quand il reste quelque
     chose. Alors seulement son absence veut dire quelque chose : on aura
     établi que le mécanisme est vivant sur cet écran-là.
  */
  await semerUnPliIllisible(PLI_SEME);
  v('un pli illisible attend dans la file', await compter('odysseeReports'), 1);

  await aller('/odyssee/', '#vue:not(.hidden)');
  /*
     Et l'attente est une VRAIE post-condition, maintenant : la mention
     était cachée avant le geste, on la veut visible après. L'état attendu
     diffère de l'état d'avant, ce qui est la seule condition pour qu'une
     post-condition vaille quelque chose.
  */
  const parue = await devientVisible(page, '#gestes-en-attente', true, { delai: 30000 });
  vrai('la mention des gestes en attente paraît', parue);
  const dit = (await page.textContent('#gestes-en-attente')) ?? '';
  vrai('elle compte ce qui attend', /\b1\b/.test(dit));
  vrai('elle dit que rien n’est effacé', /gardés, pas effacés/.test(dit));
  /*
     Le § 2.3 vaut ici aussi : la mention compte, elle ne raconte pas. Ni
     le nom de la tâche semée, ni le jour.
  */
  v('et elle ne nomme ni la tâche ni le jour', new RegExp(`${TACHE}|\\d{4}-\\d{2}-\\d{2}`).test(dit), false);
  /*
     LE PLI N'EST PAS SUPPRIMÉ, et c'est la moitié qui compte vraiment :
     un geste illisible est gardé pour qu'Alexis décide lui-même de le
     jeter. Un rejeu qui « nettoierait » en passant perdrait le geste en
     croyant bien faire.
  */
  v('et le pli illisible est toujours là, non supprimé', await compter('odysseeReports'), 1);

  /*
     PREMIER SABOTAGE — LA MENTION COMPTE CE QUI RESTE, PAS N'IMPORTE QUOI.

     Un second pli, et le nombre doit suivre. Sans cette assertion, un
     gestionnaire qui afficherait une phrase constante, ou qui compterait
     les plis AVANT le rejeu au lieu des restants, resterait vert : c'est
     le défaut que le commentaire de l'écran redoute explicitement — « on
     compterait les plis pendant qu'ils sont rejoués, et la mention
     annoncerait une attente qui n'existe déjà plus ».
  */
  await semerUnPliIllisible(`${PLI_SEME}-2`);
  await aller('/odyssee/', '#vue:not(.hidden)');
  await devientVisible(page, '#gestes-en-attente', true, { delai: 30000 });
  const deux = (await page.textContent('#gestes-en-attente')) ?? '';
  vrai('deux plis, et la mention dit deux', /\b2\b/.test(deux));
  v('et elle ne dit pas un', /\b1\b/.test(deux), false);

  /*
     SECOND SABOTAGE — COFFRE FERMÉ, RIEN NE S'ANNONCE.

     Le gestionnaire sort avant tout comptage si le coffre est fermé
     (index.astro:791). Ce n'est pas une optimisation : un nombre de gestes
     en attente est une information sur ce que la personne a fait, et le
     § 3.2 n'attend rien du centre coffre fermé. Les deux plis sont
     toujours là ; la mention doit malgré tout se taire.

     Et l'attente est mesurable : la mention est VISIBLE à cet instant, on
     la veut cachée après la fermeture. Un changement, donc.
  */
  await page.click('#temoin-coffre-fermer').catch(async () => {
    await page.click('#temoin-coffre button');
  });
  await devientVisible(page, '#temoin-coffre', false, { delai: 30000 });
  await aller('/odyssee/', '#vue:not(.hidden)');
  v('coffre fermé, les deux plis sont toujours en file', await compter('odysseeReports'), 2);
  v(
    'et pourtant la mention ne dit rien',
    await page.locator('#gestes-en-attente').isVisible(),
    false,
  );

  /* On rouvre pour la suite : le cas négatif se mesure coffre ouvert. */
  await aller('/odyssee/corps/', '#entete-principal');
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  await devientVisible(page, '#temoin-coffre', true, { delai: 40000 });
  vrai('le coffre est rouvert pour la suite', await coffreOuvert());
  /*
     Et le rejeu de la réouverture n'a pas jeté les illisibles : la garantie
     vaut à chaque ouverture, pas seulement à la première.
  */
  v('et les plis illisibles ont survécu à une seconde ouverture', await compter('odysseeReports'), 2);

  /*
     LE CAS NÉGATIF ENSUITE, et son attente est devenue mesurable. La
     mention est visible à cet instant ; on retire le pli, on recharge, et
     on attend qu'elle DISPARAISSE. Visible puis cachée : un changement,
     donc une post-condition, et non plus un pari sur trois secondes.
  */
  await faucherLePli(PLI_SEME);
  await faucherLePli(`${PLI_SEME}-2`);
  v('la file est vide', await compter('odysseeReports'), 0);
  await aller('/odyssee/', '#vue:not(.hidden)');
  const partie = await devientVisible(page, '#gestes-en-attente', false, { delai: 30000 });
  vrai('et sans rien en attente, la mention s’en va', partie);
  v(
    'la mention des gestes en attente reste cachée',
    await page.locator('#gestes-en-attente').isVisible(),
    false,
  );
}

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
