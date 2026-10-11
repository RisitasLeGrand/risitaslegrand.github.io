/**
 * Les faits de domaine voyagent — deux appareils, en navigateur.
 *
 * C'est l'essai qui manquait à la fin de la phase 5, et le défaut qu'il
 * couvre était réel : un QCM passé sur l'ordinateur n'arrivait jamais sur le
 * téléphone, et l'écran disait pourtant « identiques ✓ » — ce qui était vrai des
 * journaux et faux de tout le reste.
 *
 * Quatre choses y sont éprouvées, et aucune ne peut l'être hors navigateur : la
 * journalisation à l'écriture réelle (un vrai QCM, passé par l'écran), le socle
 * de l'existant, la matérialisation à l'arrivée, et le socle **déterministe** —
 * deux appareils qui portent le même enregistrement doivent produire la même
 * opération, sans quoi leurs journaux resteraient inégaux pour toujours.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 400)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 400)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);

async function appareil(nom) {
  const contexte = await nav.newContext({ acceptDownloads: true });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => console.log(`PAGEERROR[${nom}]:`, e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`CONSOLE[${nom}]:`, m.text().slice(0, 200));
  });
  /*
   * L'annulation demande confirmation par « window.confirm ». Playwright
   * referme toute boîte de dialogue par défaut, ce qui vaut « non » : sans ce
   * gestionnaire, l'essai mesurerait une annulation qui n'a jamais eu lieu.
   */
  page.on('dialog', (d) => void d.accept());
  return { nom, contexte, page };
}

async function ouvrir(appareil, chemin, selecteur) {
  await appareil.page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await appareil.page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await appareil.page.fill('#champ-mdp', MDP);
    await appareil.page.click('#bouton-verrou');
  }
  if (selecteur) await appareil.page.waitForSelector(selecteur, { timeout: 40000 });
}

/** Ce que porte la base d'un appareil, vu du journal et des magasins. */
const lire = (appareil) =>
  appareil.page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const tout = (nom) =>
      new Promise((ok) => {
        const q = base.transaction(nom).objectStore(nom).getAll();
        q.onsuccess = () => ok(q.result);
      });
    const operations = await tout('operations');
    const sortie = {
      operations: operations.length,
      ciblesDomaine: operations
        .filter((o) => /^(quiz|nback|relationnel|vmSessions|qcmSessions):/.test(o.cible))
        .map((o) => ({ cible: o.cible, socle: o.id.startsWith('SOCLE-'), type: o.type }))
        .sort((a, b) => a.cible.localeCompare(b.cible)),
      quiz: (await tout('quiz')).map((q) => q.id).sort(),
      nback: (await tout('nback')).map((s) => s.id).sort(),
      vmSessions: (await tout('vmSessions')).map((s) => s.id).sort(),
    };
    base.close();
    return sortie;
  });

/** Écrit un enregistrement **sans** passer par le site : c'est de l'existant. */
const semer = (appareil, magasin, enregistrement) =>
  appareil.page.evaluate(
    async ([magasin, enregistrement]) => {
      const base = await new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
      });
      await new Promise((ok, ko) => {
        const tx = base.transaction(magasin, 'readwrite');
        tx.objectStore(magasin).put(enregistrement);
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      base.close();
      return true;
    },
    [magasin, enregistrement],
  );

const empreinteAffichee = (appareil) =>
  appareil.page.evaluate(() => {
    const lignes = [...document.querySelectorAll('#appareils > li')];
    const moi = lignes.find((l) => l.textContent.includes('celui-ci')) ?? lignes[0];
    return [...moi.querySelectorAll('.font-mono')][0]?.textContent?.trim() ?? '';
  });

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
  return await appareil.page.textContent('#message-fusion');
}

const A = await appareil('ordinateur');
const B = await appareil('telephone');

console.log('\nUN QCM RÉELLEMENT PASSÉ ENTRE AU JOURNAL');

await ouvrir(A, '/quiz/cours', '#quiz-matiere');
await A.page.waitForFunction(
  () => Boolean(document.querySelector('#quiz-matiere option[value="Économie"]')),
  null,
  { timeout: 40000 },
);
await A.page.selectOption('#quiz-matiere', 'Économie');
await A.page.waitForTimeout(800);
await A.page.locator('#lancer-quiz').click();
await A.page.waitForTimeout(2000);
/*
 * Le résultat n'est enregistré qu'à la **fin** de la session : le QCM de cours
 * écrit une entrée par fiche couverte quand la dernière question est passée. Il
 * faut donc aller au bout, et non répondre à quelques questions — d'où la
 * boucle qui s'arrête sur l'écran de résultat et non sur un compteur.
 */
for (let i = 0; i < 40; i += 1) {
  if (await A.page.locator('#rejouer-quiz').isVisible().catch(() => false)) break;
  const option = A.page.locator('#quiz-options button').first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    await A.page.waitForTimeout(350);
  }
  const suivant = A.page.locator('#quiz-suivant');
  if (await suivant.isVisible().catch(() => false)) {
    await suivant.click();
    await A.page.waitForTimeout(350);
  }
}
await A.page.waitForSelector('#resultat:not(.hidden)', { timeout: 40000 });
await A.page.waitForTimeout(1000);

/*
 * Un QCM de cours écrit **une entrée par fiche couverte** : un quiz tiré sur une
 * matière en touche une quinzaine. Le compte exact dépend du contenu, donc
 * l'essai le lit plutôt que de le supposer — ce qui importe est qu'il y en ait,
 * et qu'il y ait autant d'opérations que d'enregistrements.
 */
let quizEcrits = 0;
{
  const vu = await lire(A);
  quizEcrits = vu.quiz.length;
  vrai('des résultats de QCM sont enregistrés', quizEcrits > 0);
  v('autant d’opérations que d’enregistrements', vu.ciblesDomaine.length, quizEcrits);
  v('sous son type de fait', vu.ciblesDomaine[0].type, 'revision.qcm');
  vrai('avec son magasin dans la cible', vu.ciblesDomaine[0].cible.startsWith('quiz:'));
  vrai(
    'et aucun n’est un socle : ils ont été écrits en direct',
    vu.ciblesDomaine.every((c) => !c.socle),
  );
}

console.log('\nL’EXISTANT EST SOCLÉ À LA FABRICATION DU PAQUET');

await semer(A, 'nback', {
  id: '01SEMENBACK0000000000001',
  le: new Date().toISOString(),
  titre: 'quad',
  statut: 'terminee',
  n: 2,
  dimensions: ['position'],
  nombreEpreuves: 20,
  taux: 0.9,
  reperees: 8,
  aReperer: 9,
  erreurs: 1,
  secondes: 420,
});

{
  const avant = await lire(A);
  v('la partie semée n’est pas encore au journal', avant.ciblesDomaine.length, quizEcrits);
}

const paquet = await envoyer(A);

{
  const vu = await lire(A);
  v('la fabrication du paquet l’a soclée', vu.ciblesDomaine.length, quizEcrits + 1);
  const nback = vu.ciblesDomaine.find((c) => c.cible.startsWith('nback:'));
  vrai('et l’opération est un socle', nback.socle);
  v('de type Cog-Training', nback.type, 'revision.cog-training');
}

console.log('\nL’AUTRE APPAREIL LES REÇOIT DANS SES MAGASINS');

const messageFusion = await recevoir(B, paquet);

{
  const vuA = await lire(A);
  const vuB = await lire(B);
  v('le QCM est arrivé', vuB.quiz, vuA.quiz);
  v('la partie de N-Back aussi', vuB.nback, vuA.nback);
  v('les deux journaux portent les mêmes cibles', vuB.ciblesDomaine, vuA.ciblesDomaine);
  vrai('le message de fusion parle des enregistrements reçus', /enregistrement/i.test(messageFusion));

  await ouvrir(B, '/appareils/', '#ecran:not(.hidden)');
  const empreinteB = await empreinteAffichee(B);
  await ouvrir(A, '/appareils/', '#ecran:not(.hidden)');
  const empreinteA = await empreinteAffichee(A);
  vrai('les empreintes sont non vides', empreinteA.length > 4 && empreinteB.length > 4);
  v('et elles concordent', empreinteB, empreinteA);
}

console.log('\nUNE SECONDE FUSION NE DOUBLE RIEN');

{
  const avant = await lire(B);
  const encore = await envoyer(A);
  await recevoir(B, encore);
  const apres = await lire(B);
  v('les magasins sont inchangés', apres.quiz.length + apres.nback.length, avant.quiz.length + avant.nback.length);
  v('et le journal aussi', apres.ciblesDomaine, avant.ciblesDomaine);
}

console.log('\nLE SOCLE EST DÉTERMINISTE : LE MÊME ENREGISTREMENT DES DEUX CÔTÉS');

{
  /*
   * Les deux appareils portent la **même** session, semée à l'identique, et
   * chacun la socle de son côté. Si le socle dépendait de l'appareil, les deux
   * journaux porteraient deux opérations pour un seul enregistrement et ne
   * seraient plus jamais égaux. C'est la propriété qui rend réconciliables deux
   * bases migrées séparément.
   */
  const session = {
    id: '01SEMEVERIDICAL000000001',
    le: new Date().toISOString(),
    famille: 'ligne',
    mode: 'adaptatif',
    charge: 2,
    essais: 20,
    reussis: 14,
    paires: ['position-ton'],
    seuilMedian: 3,
    secondes: 300,
  };
  await semer(A, 'vmSessions', session);
  await semer(B, 'vmSessions', { ...session });

  // Chacun fabrique un paquet : c'est ce qui déclenche son socle.
  await envoyer(B);
  const dAversB = await envoyer(A);
  await recevoir(B, dAversB);

  const vuA = await lire(A);
  const vuB = await lire(B);
  v('une seule opération pour cette session chez A', vuA.ciblesDomaine.filter((c) => c.cible.startsWith('vmSessions:')).length, 1);
  v('une seule chez B après fusion', vuB.ciblesDomaine.filter((c) => c.cible.startsWith('vmSessions:')).length, 1);
  v('les deux journaux portent les mêmes cibles', vuB.ciblesDomaine, vuA.ciblesDomaine);
  v('et le même nombre d’opérations', vuB.operations, vuA.operations);

  await ouvrir(B, '/appareils/', '#ecran:not(.hidden)');
  const empreinteB = await empreinteAffichee(B);
  await ouvrir(A, '/appareils/', '#ecran:not(.hidden)');
  v('donc la même empreinte', empreinteB, await empreinteAffichee(A));
}

console.log('\nANNULER UNE FUSION DÉFAIT CE QU’ELLE A ÉCRIT');

{
  /*
   * Un enregistrement que seul l'autre appareil portait doit disparaître :
   * sans cela, l'annulation n'annulerait rien. Un enregistrement que cet
   * appareil portait déjà, lui, reste — son opération locale n'a pas le lot.
   */
  const C = await appareil('tablette');
  await ouvrir(C, '/appareils/', '#ecran:not(.hidden)');
  await semer(C, 'quiz', {
    id: '01PROPRE00000000000000001',
    ficheId: 'eco-1',
    matiere: 'Économie',
    le: new Date().toISOString(),
    bonnes: 4,
    total: 5,
  });
  await envoyer(C);

  const dAversC = await envoyer(A);
  await recevoir(C, dAversC);
  const apresFusion = await lire(C);
  vrai('la fusion a apporté les QCM de l’autre', apresFusion.quiz.length >= 2);

  await ouvrir(C, '/appareils/', '#ecran:not(.hidden)');
  await C.page.waitForSelector('.annuler', { timeout: 40000 });
  await C.page.locator('.annuler').first().click();
  await C.page.waitForSelector('#message-annulation:not(.hidden)', { timeout: 40000 });
  await C.page.waitForFunction(
    () => !document.getElementById('message-annulation').textContent.includes('en cours'),
    undefined,
    { timeout: 40000 },
  );

  const apresAnnulation = await lire(C);
  v('les enregistrements reçus sont repartis', apresAnnulation.quiz, ['01PROPRE00000000000000001']);
  v('et ceux de cet appareil sont restés', apresAnnulation.quiz.length, 1);
  v('les sessions reçues aussi', apresAnnulation.nback, []);
  await C.contexte.close();
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de faits de domaine passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
