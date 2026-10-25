/**
 * Le moteur d'activité et la reprise de l'XP, en navigateur.
 *
 * Ce que cet essai couvre, et qui ne peut pas l'être hors navigateur : la
 * projection des magasins de Révisions en faits, l'égalité entre l'XP du moteur
 * et les formules du site sur un historique posé à la main, l'écart annoncé
 * avec l'XP affichée, et la reprise — série remise à zéro, record conservé,
 * socle idempotent.
 *
 * La base est écrite **après** que l'application l'a ouverte : elle est donc
 * déjà au schéma courant, et l'essai n'a pas à le connaître.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 400)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 400)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector(selecteur, { timeout: 40000 });
}

/**
 * Les trois jours posés : avant-hier, hier, aujourd'hui — en **jours logiques**.
 *
 * La journée bascule à 4 h, fuseau Europe/Paris : entre minuit et 4 h, le jour
 * logique est encore celui de la veille. Un essai qui compterait en jours
 * calendaires sèmerait donc des faits « de demain », qui tomberaient après le
 * jour de bascule du socle et seraient comptés en plus de lui. C'est arrivé, à
 * 1 h du matin, et l'écart était exactement l'XP des deux faits du jour.
 */
const JOURS = (() => {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const BASCULE_MS = 4 * 3_600_000;
  const jour = (n) => format.format(new Date(Date.now() - BASCULE_MS - n * 86_400_000));
  return { avantHier: jour(2), hier: jour(1), aujourdhui: jour(0) };
})();

console.log('\nUN HISTORIQUE POSÉ À LA MAIN, ET L’XP QUE LE MOTEUR EN TIRE');

await aller('/statistiques/', '#activite');

const semis = await page.evaluate(async (jours) => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const ecrire = (magasin, valeur, clef) =>
    new Promise((ok, ko) => {
      const tx = base.transaction(magasin, 'readwrite');
      if (clef === undefined) tx.objectStore(magasin).put(valeur);
      else tx.objectStore(magasin).put(valeur, clef);
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });

  // L'XP affichée et la série d'avant la reprise.
  await ecrire(
    'etat',
    {
      xp: 3000,
      streakCourante: 7,
      streakRecord: 20,
      dernierJourEtudie: jours.aujourdhui,
      badges: [],
      creeLe: `${jours.avantHier}T08:00:00.000Z`,
    },
    'profil',
  );

  // Une séance tenue, avec une note d'une page et une restitution rédigée.
  await ecrire('seances', {
    id: '01ESSAISEANCE0000000000001',
    theme: 'economie',
    jour: jours.avantHier,
    statut: 'terminee',
    termineeLe: `${jours.avantHier}T19:00:00.000Z`,
    secondes: 3600,
    fiches: ['eco-1'],
    etendue: false,
  });
  await ecrire('notes', {
    seanceId: '01ESSAISEANCE0000000000001',
    note: 'x'.repeat(600),
    restitutions: { '01ESSAISEANCE0000000000000': 'y'.repeat(120) },
    majLe: `${jours.avantHier}T19:05:00.000Z`,
  });

  // Un QCM de cours : 7 bonnes sur 10.
  await ecrire('quiz', {
    id: '01ESSAIQUIZ00000000000001',
    ficheId: 'eco-1',
    matiere: 'Économie',
    le: `${jours.hier}T10:00:00.000Z`,
    bonnes: 7,
    total: 10,
  });

  // Deux cartes notées le même jour logique : une correcte, une facile.
  for (const [i, note] of ['correct', 'facile'].entries()) {
    await ecrire('revisions', {
      id: `01ESSAIREVISION000000000${i}`,
      carteId: `carte-${i}`,
      ficheId: 'eco-1',
      matiere: 'Économie',
      le: `${jours.hier}T11:0${i}:00.000Z`,
      appareil: 'essai',
      hlc: `00000000000000${i}-0000`,
      lot: '',
      genre: 'notation',
      note,
    });
  }

  // Une partie de Quad N-Back réussie au-delà de 80 %.
  await ecrire('nback', {
    id: '01ESSAINBACK00000000000001',
    le: `${jours.aujourdhui}T09:00:00.000Z`,
    titre: 'quad',
    statut: 'terminee',
    n: 3,
    dimensions: ['position', 'couleur'],
    nombreEpreuves: 20,
    taux: 0.85,
    reperees: 8,
    aReperer: 10,
    erreurs: 1,
    secondes: 600,
  });

  /*
   * Une session de Veridical Mapping : elle crédite de l'XP, et elle porte le
   * manque que la projection doit déclarer — le magasin ne garde pas le nombre
   * de seuils stabilisés de la session, dont dépendait la prime de 25 XP.
   */
  await ecrire('vmSessions', {
    id: '01ESSAIVERIDICAL000000001',
    le: `${jours.aujourdhui}T10:00:00.000Z`,
    famille: 'ligne',
    mode: 'adaptatif',
    charge: 2,
    essais: 40,
    reussis: 30,
    paires: ['position-ton'],
    seuilMedian: 3,
    secondes: 600,
  });

  base.close();
  return true;
}, JOURS);
vrai('l’historique est écrit', semis);

await aller('/statistiques/', '#activite-journal tr');

const lire = async () => ({
  xp: await page.textContent('#activite-xp'),
  niveau: await page.textContent('#activite-niveau'),
  serie: await page.textContent('#activite-serie'),
  record: await page.textContent('#activite-record'),
  faits: await page.textContent('#activite-faits'),
  domaines: await page.textContent('#activite-domaines'),
  lignes: await page.$$eval('#activite-journal tr', (trs) =>
    trs.map((tr) => [...tr.children].map((td) => td.textContent?.trim())),
  ),
  repriseVisible: await page.isVisible('#activite-reprise'),
  socleVisible: await page.isVisible('#activite-socle'),
  ecart: await page.textContent('#activite-ecart').catch(() => ''),
  manques: await page.$$eval('#activite-manques p', (ps) => ps.length),
});

{
  const vu = await lire();
  /*
   * 38 pour la séance (20 + 8 de restitution + 10 de note d'une page),
   * 24 pour le QCM (10 + 7 × 2), 10 pour les deux cartes (5 + 5),
   * 30 pour la partie de N-Back (8 + 3 × 4 + 10), 36 pour la session de
   * Veridical Mapping (6 + 30 × 1, sans prime de convergence) = 138.
   *
   * LES DEUX CARTES VALAIENT 12 (5 + 7) JUSQU'AU LOT F DU PROMPT 43. Le
   * barème des flashcards y est devenu plat : les quatre notes rapportent
   * cinq, parce que payer plus cher une note « Facile » poussait à surnoter,
   * donc à fausser l'ordonnanceur pour gagner deux points. Ce n'est pas
   * l'essai qu'on assouplit — c'est la formule du site qui a changé, et
   * l'essai qui la suit. Aucune XP déjà gagnée n'est recalculée pour autant :
   * seul le CALCUL change, et c'est précisément ce que cet écran montre.
   *
   * Cinq magasins écrits, mais **cinq faits** : les deux cartes notées le même
   * jour logique ne font qu'un fait, parce que le type « revision.flashcards »
   * porte la journée entière.
   */
  v('l’XP recalculée est celle des formules du site', vu.xp, '138 XP');
  v('le niveau en découle', vu.niveau, 'niveau 2 · 38 / 150');
  v('cinq faits sont publiés', vu.faits, '5');
  v('et ventilés par domaine', vu.domaines, 'connaissances 72 · cognition 66');
  v('la série court sur les trois jours', vu.serie, '3 jours');
  v('le record suit', vu.record, 'record : 3 jours');
  v('le journal a une ligne par fait crédité', vu.lignes.length, 5);
  v(
    'la ligne la plus récente est la session de Veridical Mapping',
    vu.lignes[0].slice(1, 2),
    ['Session de Veridical Mapping'],
  );
  v('elle porte sa base, son facteur et son XP', vu.lignes[0].slice(3), ['36', '×1', '36']);
  v(
    'et elle explique son calcul',
    vu.lignes[0][2],
    '6 pour la session, 30 × 1 par essai réussi',
  );
  v(
    'la partie de N-Back la précède, avec sa prime de réussite',
    vu.lignes[1][2],
    '8 pour la partie, 3 × 4 pour la profondeur, 10 pour la réussite au-delà de 80 %',
  );
  vrai('la reprise est proposée, pas faite', vu.repriseVisible);
  vrai('le socle n’existe pas encore', !vu.socleVisible);
  vrai('l’écart avec l’XP affichée est annoncé', vu.ecart.includes('3000') && vu.ecart.includes('138'));
  vrai('et ce qui n’a pas pu être publié est listé', vu.manques >= 1);
}

console.log('\nLA REPRISE CONVERTIT SANS RECALCULER');

await page.click('#reprendre-activite');
await page.waitForSelector('#activite-socle:not(.hidden)', { timeout: 20000 });

const socle = () =>
  page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const get = (clef) =>
      new Promise((ok) => {
        const q = base.transaction('etat').objectStore('etat').get(clef);
        q.onsuccess = () => ok(q.result ?? null);
      });
    const socle = await get('socleActivite');
    const profil = await get('profil');
    base.close();
    return { socle, profil };
  });

{
  const { socle: s, profil } = await socle();
  v('le socle garde l’XP affichée', s.xpAffichee, 3000);
  v('et ce que le recalcul donnait', s.xpRecalculee, 138);
  v('la somme répartie fait exactement l’XP affichée', Object.values(s.xpRepris).reduce((a, b) => a + b, 0), 3000);
  v(
    'répartie selon les parts du recalcul',
    s.xpRepris,
    { cognition: Math.round((66 / 138) * 3000), connaissances: 3000 - Math.round((66 / 138) * 3000) },
  );
  v('la série courante repart de zéro', profil.streakCourante, 0);
  v('le record est conservé', profil.streakRecord, 20);
  v('la série d’avant est gardée pour mémoire', s.serieAvant, 7);
  v('et le dernier jour étudié est effacé', profil.dernierJourEtudie, null);
  vrai('le jour de bascule est celui d’aujourd’hui', s.jour === JOURS.aujourdhui);
}

{
  const vu = await lire();
  vrai('la reprise n’est plus proposée', !vu.repriseVisible);
  vrai('le socle est annoncé à l’écran', vu.socleVisible);
  /*
   * Tous les faits de l'essai sont du jour de bascule ou d'avant : ils
   * appartiennent au socle, et le journal postérieur est donc vide. L'XP
   * affichée est exactement celle reprise.
   */
  v('l’XP affichée est celle du socle', vu.xp, '3000 XP');
  v('le journal postérieur est vide', vu.lignes.length, 0);
  v('la série repart donc de zéro à l’écran', vu.serie, '0 jour');
  v('et le record reste visible', vu.record, 'record : 20 jours');
}

console.log('\nLA REPRISE EST IDEMPOTENTE');

await aller('/statistiques/', '#activite');
const avant = (await socle()).socle;
/*
 * Le bouton est dans un bloc masqué — l'écran ne propose plus la reprise — mais
 * il est toujours dans le document, et c'est le chemin de code qu'on veut
 * éprouver : un second appel doit rendre le socle existant, sans rien écrire.
 */
await page.$eval('#reprendre-activite', (b) => b.click());
await page.waitForTimeout(1500);
{
  const apres = (await socle()).socle;
  v('un second appel ne change pas la date du socle', apres.le, avant.le);
  v('ni l’XP reprise', apres.xpRepris, avant.xpRepris);
  v('ni le record', apres.serieRecord, avant.serieRecord);
  const profil = (await socle()).profil;
  v('et la série reste à zéro, sans se décrémenter', profil.streakCourante, 0);
  const vu = await lire();
  vrai('l’écran continue d’annoncer le socle', vu.socleVisible);
}

console.log('\nLES DÉSACCORDS ENTRE BRANCHES SONT VISIBLES, MÊME À ZÉRO');

{
  const etat = await page.textContent('#desaccords-etat');
  vrai(
    'l’écran dit pourquoi il n’y en a aucun',
    etat.includes('Aucun désaccord') && etat.includes('Révisions'),
  );
  const regles = await page.$$eval('#desaccords-regles > div > p:first-child', (ps) =>
    ps.map((p) => p.textContent?.trim()),
  );
  v('les cinq règles déclarées sont listées', regles.length, 5);
  vrai(
    'dont le chevauchement de deux activités exclusives',
    regles.includes('Deux activités exclusives au même moment'),
  );
  const ouverts = await page.$$eval('#desaccords-liste > div', (d) => d.length);
  v('et aucun désaccord ouvert sur cet historique', ouverts, 0);
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais d’activité en navigateur passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
