/**
 * « Partir d'un modèle », dans un vrai navigateur.
 *
 *   npm run essais:modeles:navigateur
 *
 * ## Ce qui ne se prouve qu'ici
 *
 * - **la copie existe à l'écran** : un programme de plus dans la liste, au bon
 *   nom, et qui n'est pas celui que l'on suit ;
 * - **les exercices manquants sont ajoutés, sans doublon**. Le cas n'est pas
 *   théorique : quiconque a ouvert Sport avant ce lot a trente et un exercices
 *   et non trente-huit. L'essai ampute donc la bibliothèque, comme le ferait
 *   une base ancienne, et regarde ce qui se passe ;
 * - **deux appuis rapides ne créent qu'une copie**. Aucun essai pur ne peut
 *   l'approcher : c'est un défaut de temps réel, et il ne se voit que dans un
 *   navigateur qui clique vite ;
 * - **le programme suivi ne change qu'au bouton**.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

async function deverrouiller() {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

/** Lit un magasin de la base, depuis la page. */
const magasin = (nom) =>
  page.evaluate(
    (n) =>
      new Promise((ok, ko) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => ko(d.error);
        d.onsuccess = () => {
          const base = d.result;
          if (!base.objectStoreNames.contains(n)) {
            base.close();
            ok([]);
            return;
          }
          const r = base.transaction(n, 'readonly').objectStore(n).getAll();
          r.onsuccess = () => {
            base.close();
            ok(r.result);
          };
          r.onerror = () => {
            base.close();
            ko(r.error);
          };
        };
      }),
    nom,
  );

/** Supprime des exercices par nom : simule une base d'avant ce lot. */
const amputerLaBibliotheque = (noms) =>
  page.evaluate(
    (liste) =>
      new Promise((ok, ko) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => ko(d.error);
        d.onsuccess = () => {
          const base = d.result;
          const t = base.transaction('sportExercices', 'readwrite');
          const s = t.objectStore('sportExercices');
          const lire = s.getAll();
          lire.onsuccess = () => {
            for (const e of lire.result) if (liste.includes(e.nom)) s.delete(e.id);
          };
          t.oncomplete = () => {
            base.close();
            ok();
          };
          t.onerror = () => {
            base.close();
            ko(t.error);
          };
        };
      }),
    noms,
  );

const allerAuxProgrammes = async () => {
  await page.goto(`${RACINE}/sport/programmes/`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
};

/* Base neuve. */
await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
await deverrouiller();
await franchirInitialisation(page, RACINE, MDP);

/* ════════════════════════════════════════════════════════════════════════
   1. Le catalogue est à l'écran
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE CATALOGUE DES SEPT MODÈLES');

await allerAuxProgrammes();

v('sept cartes de modèle', await page.locator('[data-modele]').count(), 7);
v('sept boutons « Utiliser ce modèle »', await page.locator('[data-utiliser]').count(), 7);

{
  const proposes = await page
    .locator('[data-modele]:has-text("Proposé pour")')
    .evaluateAll((n) => n.map((e) => e.dataset.modele).sort());
  v('deux modèles portent la mention « proposé »', proposes, ['M3', 'M4']);
}

{
  /*
     Les avertissements du dossier, et seulement ceux-là. Un avertissement qui
     s'affiche partout ne se lit plus nulle part.
  */
  const avertis = await page
    .locator('[data-modele]:has-text("À savoir")')
    .evaluateAll((n) => n.map((e) => e.dataset.modele).sort());
  v('trois modèles portent un avertissement', avertis, ['M1', 'M2', 'M5']);
  vrai(
    'celui du PPL 3 jours nomme le passage unique',
    (await page.locator('#modele-M1').innerText()).includes('une fois par semaine'),
  );
}

{
  /* La durée du dossier, affichée telle quelle (décision 15). */
  const texte = await page.locator('#modele-M1').innerText();
  vrai('la carte dit le rythme', texte.includes('3 séances par semaine'));
  vrai('et la durée d’une séance', /de 50 à 63 min par séance/.test(texte));
  vrai('et le lieu', texte.includes('En salle'));
  vrai(
    'le modèle Maison dit qu’il est à la maison',
    (await page.locator('#modele-M6').innerText()).includes('À la maison'),
  );
}

{
  /* « Pourquoi ces valeurs » : un dépliant natif, donc au clavier d'office. */
  const details = page.locator('#modele-M1 details');
  faux('le dépliant est fermé au départ', await details.evaluate((d) => d.open));
  await page.locator('#modele-M1 summary').click();
  vrai('il s’ouvre', await details.evaluate((d) => d.open));
  const dedans = await details.innerText();
  vrai('il dit que les muscles viennent de la bibliothèque', dedans.includes('votre bibliothèque'));
  vrai('il cite la réserve sur le coefficient', dedans.includes('0,32'));
  vrai('il dit la pratique de terrain', dedans.includes('pratique de terrain'));
}

/* ════════════════════════════════════════════════════════════════════════
   2. Une copie est créée, inactive
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE COPIE, ET ELLE N’EST PAS ACTIVE');

v('aucun programme au départ', (await magasin('sportProgrammes')).length, 0);

await page.locator('[data-utiliser="M4"]').click();
await page.waitForSelector('#etat-modele-M4:not(.hidden)', { timeout: 15000 });

{
  const programmes = await magasin('sportProgrammes');
  v('un programme de plus', programmes.length, 1);
  v('au nom du modèle, suivi de « (copie) »', programmes[0]?.nom, 'Corps entier, 3 jours (copie)');
  faux('et il n’est pas actif', programmes[0]?.actif);
  v('avec les séances du modèle', programmes[0]?.seances.length, 3);
  v('et les dix-huit cibles', Object.keys(programmes[0]?.ciblesParMuscle ?? {}).length, 18);
  vrai(
    'le compte rendu dit que ce n’est pas le programme suivi',
    (await page.locator('#etat-modele-M4').innerText()).includes('n’est pas votre programme suivi'),
  );
  vrai(
    'et la carte apparaît dans la liste',
    (await page.locator('#liste').innerText()).includes('Corps entier, 3 jours (copie)'),
  );
  faux(
    'sans la marque « suivi »',
    (await page.locator('#liste').innerText()).includes('suivi\n'),
  );
}

/* ════════════════════════════════════════════════════════════════════════
   3. Deux appuis rapides ne font qu'une copie
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUN APPUI, UNE COPIE');

{
  const avant = (await magasin('sportProgrammes')).length;
  const bouton = page.locator('[data-utiliser="M5"]');
  await bouton.click({ clickCount: 2, delay: 20 });
  await page.waitForTimeout(1500);
  v('deux appuis rapides ne créent qu’une copie', (await magasin('sportProgrammes')).length, avant + 1);
}

/* ════════════════════════════════════════════════════════════════════════
   4. Le programme suivi ne change qu'au bouton
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE PROGRAMME SUIVI NE CHANGE QU’AU BOUTON');

{
  const actifsAvant = (await magasin('sportProgrammes')).filter((p) => p.actif);
  v('aucune copie n’est devenue active toute seule', actifsAvant.length, 0);

  await page.locator('#liste button:has-text("En faire mon programme actif")').first().click();
  await page.waitForTimeout(1200);

  const apres = await magasin('sportProgrammes');
  v('un seul programme actif', apres.filter((p) => p.actif).length, 1);
  v('et le précédent reste enregistré', apres.length, actifsAvant.length + 2);
}

/* ════════════════════════════════════════════════════════════════════════
   5. Une bibliothèque d'avant ce lot : ce qui manque est ajouté
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE BIBLIOTHÈQUE AMPUTÉE SE COMPLÈTE, SANS DOUBLON');

const ABSENTS = [
  'Pompes',
  'Rowing à un bras',
  'Mollets debout à une jambe',
  'Développé épaules',
  'Extension triceps au-dessus de la tête',
];

{
  v('la bibliothèque livrée compte trente-huit exercices', (await magasin('sportExercices')).length, 38);

  await amputerLaBibliotheque(ABSENTS);
  const ampute = (await magasin('sportExercices')).length;
  v('amputée, elle en compte cinq de moins', ampute, 33);

  await allerAuxProgrammes();
  await page.locator('[data-utiliser="M6"]').click();
  await page.waitForSelector('#etat-modele-M6:not(.hidden)', { timeout: 20000 });

  const apres = await magasin('sportExercices');
  v('les exercices manquants sont ajoutés', apres.length, 38);
  v(
    'et ce sont bien ceux-là',
    ABSENTS.filter((nom) => !apres.some((e) => e.nom === nom)),
    [],
  );
  vrai(
    'le compte rendu le dit',
    (await page.locator('#etat-modele-M6').innerText()).includes('ajoutés à votre bibliothèque'),
  );

  const maison = (await magasin('sportProgrammes')).find((p) => p.nom.startsWith('Maison'));
  vrai('et la copie Maison existe', maison !== undefined);
  /*
     Le point qui compte : les cibles ont été calculées APRÈS l'ajout. Sans la
     seconde passe, les pectoraux du modèle Maison vaudraient zéro — un nombre
     faux et parfaitement plausible.
  */
  vrai('avec des pectoraux non nuls', (maison?.ciblesParMuscle?.pectoraux ?? 0) > 0);
  v('et des pectoraux à neuf séries', maison?.ciblesParMuscle?.pectoraux, 9);
}

{
  /* Une seconde copie du même modèle ne duplique aucun exercice. */
  await page.locator('[data-utiliser="M6"]').click();
  await page.waitForTimeout(1500);
  const apres = await magasin('sportExercices');
  v('une seconde copie n’ajoute aucun doublon', apres.length, 38);
  const identites = apres.map((e) => `${e.nom}|${e.equipement}|${e.variante}`);
  v('et aucune identité en double', identites.length - new Set(identites).size, 0);
}

/* ════════════════════════════════════════════════════════════════════════
   6. Le matériel : ce qui ne passe pas est remplacé, et dit
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE MATÉRIEL DONT ON DISPOSE');

await allerAuxProgrammes();

{
  v(
    'trois choix de matériel',
    await page.locator('#equipement-modeles option').evaluateAll((n) => n.map((o) => o.value)),
    ['salle', 'maison-complete', 'maison-halteres'],
  );
  vrai(
    'le détail du premier choix est affiché',
    (await page.locator('#equipement-detail').innerText()).includes('Barres'),
  );
  await page.selectOption('#equipement-modeles', 'maison-halteres');
  vrai(
    'et il suit le choix',
    (await page.locator('#equipement-detail').innerText()).includes('haltères'),
  );
}

{
  /*
     LE CAS DU PROMPT : « haltères seulement » doit remplacer tout exercice à
     barre ou à machine, et l'écran doit dire lesquels.
  */
  const avant = (await magasin('sportProgrammes')).length;
  await page.locator('[data-utiliser="M1"]').click();
  await page.waitForSelector('#etat-modele-M1:not(.hidden)', { timeout: 20000 });

  const compteRendu = await page.locator('#etat-modele-M1').innerText();
  vrai('la copie est annoncée', compteRendu.includes('a été créé'));
  vrai('et les remplacements sont dits', compteRendu.includes('Remplacés, faute du matériel'));
  /*
     Un modèle de salle ne se convertit pas : le dossier n'écrit des
     remplaçants de maison que pour son modèle Maison. L'écran doit le dire
     franchement plutôt que de livrer un programme à moitié impossible.
  */
  vrai('et l’écran dit que ce modèle est écrit pour la salle', compteRendu.includes('écrit pour la salle'));
  vrai('il renvoie au modèle Maison', compteRendu.includes('Maison, haltères et poids du corps'));
  vrai('et nomme ce qui reste sans remplaçant', compteRendu.includes('Gardés, sans remplaçant possible'));
  v('un programme de plus', (await magasin('sportProgrammes')).length, avant + 1);

  const copie = (await magasin('sportProgrammes')).at(-1);
  const exos = await magasin('sportExercices');
  const parId = new Map(exos.map((e) => [e.id, e]));
  const materiels = new Set(
    copie.seances.flatMap((s) => s.blocs.map((b) => parId.get(b.exerciceId)?.equipement)),
  );
  /*
     L'INVARIANT, et il n'est pas « plus aucun matériel de salle » : les
     exercices sans remplaçant sont GARDÉS, à dessein. Ce qui doit être vrai,
     c'est que tout bloc demandant encore du matériel de salle est NOMMÉ dans
     le compte rendu. Lire le compte rendu seul ne suffirait pas — il dit ce
     qu'on a voulu faire, pas ce qui a été écrit ; lire les blocs seuls ne
     suffirait pas non plus — ils ne disent pas si la personne a été avertie.
  */
  const deSalle = ['barre', 'barre EZ', 'poulie', 'machine', 'barres parallèles', 'barre fixe'];
  const restants = [
    ...new Set(
      copie.seances
        .flatMap((s) => s.blocs.map((b) => parId.get(b.exerciceId)))
        .filter((e) => e && deSalle.includes(e.equipement))
        .map((e) => e.nom),
    ),
  ];
  vrai('il reste des exercices de salle, et c’est voulu', restants.length > 0);
  v(
    'chacun est nommé dans le compte rendu',
    restants.filter((nom) => !compteRendu.toLowerCase().includes(nom.toLowerCase())),
    [],
  );
  vrai('et il reste des blocs', copie.seances.reduce((n, s) => n + s.blocs.length, 0) > 0);
  vrai('du matériel de maison est apparu', [...materiels].includes('haltères'));
}

/* ════════════════════════════════════════════════════════════════════════
   7. Une blessure ouverte est signalée, jamais retirée
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE BLESSURE EST SIGNALÉE, JAMAIS RETIRÉE');

{
  await page.evaluate(
    () =>
      new Promise((ok, ko) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => ko(d.error);
        d.onsuccess = () => {
          const base = d.result;
          const t = base.transaction('sportBlessures', 'readwrite');
          t.objectStore('sportBlessures').put({
            id: 'essai-blessure',
            muscles: ['pectoraux'],
            intensite: 5,
            debut: new Date(Date.now() - 86400000).toISOString(),
            fin: null,
            note: '',
            majLe: new Date().toISOString(),
          });
          t.oncomplete = () => {
            base.close();
            ok();
          };
          t.onerror = () => {
            base.close();
            ko(t.error);
          };
        };
      }),
  );

  await allerAuxProgrammes();
  await page.selectOption('#equipement-modeles', 'salle');
  await page.locator('[data-utiliser="M3"]').click();
  await page.waitForSelector('#etat-modele-M3:not(.hidden)', { timeout: 20000 });

  const compteRendu = await page.locator('#etat-modele-M3').innerText();
  vrai('la zone douloureuse est signalée', compteRendu.includes('zone que vous avez déclarée'));
  vrai('le muscle est nommé', compteRendu.includes('Pectoraux'));
  vrai(
    'et il est dit que les exercices restent',
    compteRendu.includes('restent dans le programme'),
  );

  const modeleM3 = await page.locator('#modele-M3').count();
  v('la carte du modèle est toujours là', modeleM3, 1);

  /*
     RIEN N'A ÉTÉ RETIRÉ. C'est la règle non négociable de la branche, et
     c'est la seule façon de la vérifier : compter les blocs écrits, et non
     lire ce que l'écran prétend.
  */
  const copie = (await magasin('sportProgrammes')).find((p) => p.nom.startsWith('Haut / Bas'));
  vrai('la copie existe', copie !== undefined);
  v(
    'et elle garde ses vingt-six blocs',
    copie?.seances.reduce((n, s) => n + s.blocs.length, 0),
    26,
  );
}

/* ════════════════════════════════════════════════════════════════════════
   8. Aucune séance n'a été créée
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nAUCUNE SÉANCE N’A ÉTÉ CRÉÉE');

v('le magasin des séances est resté vide', (await magasin('sportSeances')).length, 0);

/* ════════════════════════════════════════════════════════════════════════ */
await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout est vert\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
