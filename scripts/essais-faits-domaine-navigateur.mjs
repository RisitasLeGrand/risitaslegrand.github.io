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
 * Ce qu'il ne couvre pas, et c'est dit plutôt que supposé : l'écriture d'une
 * **séance** et de sa **note** par l'écran. Elles ne s'enregistrent qu'à la fin
 * d'une séance complète, qui demande un thème planifié et une dizaine de gestes
 * — l'essai les sème donc à la main et éprouve tout le reste du chemin : le
 * socle, le transport, la matérialisation, le conflit de texte et sa réponse.
 * Le QCM, lui, est réellement passé par l'écran.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreALaBoite } from './lib/boite-essais.mjs';

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
  /*
     Les fenêtres natives ont disparu avec C1 ; cet écouteur ne garde plus
     que les cas qu'aucun écran n'ouvre, et il ne coûte rien. On répond à la
     boîte commune là où elle paraît, explicitement.
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

/** L'identifiant de cet appareil, tel que la base le porte. */
const idAppareil = (appareil) =>
  appareil.page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const id = await new Promise((ok) => {
      const q = base.transaction('etat').objectStore('etat').get('appareil');
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return id;
  });

/**
 * Écrit une opération à la main, avec son appareil et son horloge.
 *
 * C'est ainsi que l'essai fabrique un **désaccord** : deux appareils qui ont
 * écrit la même cible avec des contenus différents. Le passer par l'écran
 * demanderait de terminer deux séances complètes, et ce n'est pas ce qu'on
 * éprouve ici.
 */
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
      const op = {
        id,
        appareil: moi,
        hlc: `${String(ms).padStart(15, '0')}-0000`,
        type,
        cible,
        lot: '',
        charge,
      };
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
  /*
     LA BOÎTE COMMUNE (C1 du 43). « Annuler » ouvre maintenant une
     confirmation qui nomme ce qui sera retiré — opérations, révisions,
     cartes recalculées — et le message d'annulation ne s'écrit qu'APRÈS la
     réponse. L'essai écoutait encore la fenêtre native : il attendait donc
     quarante secondes un message qu'il n'avait pas demandé.

     Le bouton dit l'action, et c'est par là qu'on le désigne.
  */
  await repondreALaBoite(C.page, 'Annuler cette synchronisation');
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

console.log('\nUNE SÉANCE ET SA NOTE VOYAGENT');

const D = await appareil('ordinateur-2');
const E = await appareil('telephone-2');
await ouvrir(D, '/appareils/', '#ecran:not(.hidden)');
await ouvrir(E, '/appareils/', '#ecran:not(.hidden)');

const SEANCE = '01SEANCEPARTAGEE000000001';
await semer(D, 'seances', {
  id: SEANCE,
  theme: 'economie',
  jour: new Date().toISOString().slice(0, 10),
  statut: 'terminee',
  termineeLe: new Date().toISOString(),
  secondes: 3600,
  fiches: ['eco-1', 'eco-2'],
  etendue: false,
});
await semer(D, 'notes', {
  seanceId: SEANCE,
  note: 'Ce que je retiens de la séance : la règle d’annualité et ses quatre exceptions.',
  restitutions: {},
  majLe: new Date().toISOString(),
});

const paquetD = await envoyer(D);
await recevoir(E, paquetD);

const lireSeance = (appareil) =>
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
    const sortie = {
      seances: (await tout('seances')).map((s) => ({ id: s.id, statut: s.statut, fiches: s.fiches })),
      notes: (await tout('notes')).map((n) => ({ seanceId: n.seanceId, note: n.note })),
    };
    base.close();
    return sortie;
  });

{
  const vu = await lireSeance(E);
  v('la séance est arrivée', vu.seances.length, 1);
  v('avec ses fiches couvertes', vu.seances[0].fiches, ['eco-1', 'eco-2']);
  v('et son statut', vu.seances[0].statut, 'terminee');
  v('la note est arrivée', vu.notes.length, 1);
  vrai('avec son texte', vu.notes[0].note.includes('annualité'));
}

console.log('\nDEUX NOTES CONCURRENTES OUVRENT UN DÉSACCORD, ET LA RÉPONSE DÉCIDE');

{
  /*
   * Chacun réécrit la note de son côté. La plus récente s'affiche en attendant
   * — c'est le provisoire —, mais rien n'est perdu : les deux opérations sont
   * au journal, et la réponse désigne celle qui gagne.
   */
  const base = Date.now();
  const opD = await ecrireOperation(D, {
    id: '01NOTEBUREAU0000000000001',
    type: 'revision.note-seance',
    cible: `notes:${SEANCE}`,
    charge: {
      magasin: 'notes',
      enregistrement: {
        seanceId: SEANCE,
        note: 'Version de l’ordinateur : annualité, unité, universalité, spécialité.',
        restitutions: {},
        majLe: new Date(base).toISOString(),
      },
    },
    ms: base,
  });
  await ecrireOperation(E, {
    id: '01NOTEPORTABLE00000000001',
    type: 'revision.note-seance',
    cible: `notes:${SEANCE}`,
    charge: {
      magasin: 'notes',
      enregistrement: {
        seanceId: SEANCE,
        note: 'Version du téléphone : <script>alert(1)</script> quatre principes budgétaires.',
        restitutions: {},
        majLe: new Date(base + 1000).toISOString(),
      },
    },
    ms: base + 1000,
  });

  const paquet = await envoyer(D);
  await recevoir(E, paquet);

  await ouvrir(E, '/appareils/', '#ecran:not(.hidden)');
  await E.page.waitForSelector('#conflits:not(.hidden)', { timeout: 40000 });
  const texteConflit = await E.page.textContent('#liste-conflits');
  vrai('le désaccord de texte est montré', texteConflit.includes('revision.note-seance'));
  vrai('les deux versions sont résumées', texteConflit.includes('ordinateur') && texteConflit.includes('téléphone'));
  vrai('le compte de signes est donné', /signes/.test(texteConflit));
  /*
   * La note contient une balise : elle doit s'afficher comme du texte, et
   * jamais être interprétée. L'écran ne doit donc contenir aucun élément
   * « script » venu de là.
   */
  v(
    'aucune balise de la note n’a été interprétée',
    await E.page.evaluate(() => document.querySelectorAll('#liste-conflits script').length),
    0,
  );

  v(
    'en attendant la réponse, la plus récente s’affiche',
    (await lireSeance(E)).notes[0].note.includes('téléphone'),
    true,
  );

  // « Garder celle-ci » sur la version de l'ordinateur.
  const bouton = E.page.locator(`.resoudre[data-retenue="${opD.id}"]`);
  await bouton.waitFor({ timeout: 20000 });
  await bouton.click();
  await E.page.waitForTimeout(2500);

  v(
    'la réponse décide de ce qui est écrit',
    (await lireSeance(E)).notes[0].note.includes('ordinateur'),
    true,
  );
  const apres = await E.page.textContent('#liste-conflits');
  vrai('et le conflit n’est plus ouvert', !apres.includes('revision.note-seance'));
}

console.log('\nL’ÉTAT D’UNE FICHE SE COMBINE : LUE ICI, PRÉTESTÉE LÀ');

{
  /*
   * C'est le seul magasin où « la dernière écriture gagne » perdrait une
   * information que personne ne pourrait retrouver. Chaque appareil écrit sa
   * moitié de l'histoire ; la fusion doit garder les deux.
   */
  const FICHE = 'eco-essai-combinaison';
  await semer(D, 'fiches', {
    id: FICHE,
    matiere: 'Économie',
    lu: true,
    derniereOuverture: '2026-05-01T10:00:00.000Z',
    secondes: 600,
  });
  await semer(E, 'fiches', {
    id: FICHE,
    matiere: 'Économie',
    lu: false,
    derniereOuverture: '2026-05-02T09:00:00.000Z',
    secondes: 120,
    pretesteeLe: '2026-05-02',
    pretestVues: ['q1', 'q2'],
  });

  // Chacun socle sa version, puis D envoie à E.
  await envoyer(E);
  const paquet = await envoyer(D);
  await recevoir(E, paquet);

  const fiche = await E.page.evaluate(async (id) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const valeur = await new Promise((ok) => {
      const q = base.transaction('fiches').objectStore('fiches').get(id);
      q.onsuccess = () => ok(q.result ?? null);
    });
    base.close();
    return valeur;
  }, FICHE);

  vrai('la fiche existe après fusion', Boolean(fiche));
  v('« lue » est conservée, bien qu’écrite sur l’autre appareil', fiche.lu, true);
  v('le prétest local est conservé aussi', fiche.pretesteeLe, '2026-05-02');
  v('les questions servies sont unies', fiche.pretestVues, ['q1', 'q2']);
  v('la dernière ouverture est la plus récente des deux', fiche.derniereOuverture, '2026-05-02T09:00:00.000Z');
  v('le compteur prend le maximum', fiche.secondes, 600);
}

await D.contexte.close();
await E.contexte.close();

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de faits de domaine passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
