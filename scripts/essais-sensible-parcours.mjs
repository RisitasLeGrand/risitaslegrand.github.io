/**
 * Le parcours complet des traitements — amendement signé le 16 octobre.
 *
 *   npm run essais:sensible:parcours
 *
 * ## Pourquoi un parcours, et pas trois essais de modules de plus
 *
 * Les modules sont déjà éprouvés chacun de leur côté : le publieur, la
 * garde de sortie, la séparation des sources, l'indicateur. Ce qui ne
 * l'est pas, c'est leur **rencontre** — et c'est la leçon d'A-16, payée
 * assez cher : un mécanisme qu'aucun parcours réel n'atteint n'existe
 * pas, quel que soit le nombre d'essais verts qui l'entourent.
 *
 * Le parcours part donc d'un écran et va jusqu'au bout :
 *
 * 1. on saisit une prise **par le formulaire**, coffre ouvert ;
 * 2. on constate que l'indicateur la compte ;
 * 3. on referme le coffre et on constate qu'il dit « pas de donnée » —
 *    pas zéro, ce qui serait un mensonge ;
 * 4. on saisit un statut de nature « cycle » et on constate qu'il
 *    n'entre pas dans l'analyse.
 *
 * ## Ce que ce parcours NE prouve pas, et le sabotage qui l'a montré
 *
 * Il **ne prouve pas** que le fait ne nomme pas la molécule. Deux
 * sabotages l'ont vérifié : mettre `p.nom` dans la valeur du fait, puis
 * l'intitulé du statut dans la sienne, laissent ce parcours entièrement
 * vert. La raison est structurelle — l'écran des synthèses n'affiche
 * jamais la valeur d'un fait, seulement des indicateurs calculés à
 * partir d'eux. La fuite passerait sous le radar de cet écran.
 *
 * Cette condition se prouve donc dans `essais:faits-sensible`, qui
 * sérialise le fait entier. C'est encore la même leçon, pour la
 * cinquième fois de ce chantier : **une barrière se frappe là où elle
 * est seule**, et un parcours de bout en bout n'en est pas dispensé.
 *
 * Ce qu'il prouve, et que rien d'autre ne prouve : la RENCONTRE du
 * publieur, de l'assembleur, de l'indicateur et de l'écran. Le sabotage
 * qui débranche la source sensible le rend rouge — c'est exactement
 * l'anomalie A-16, qu'aucun essai de module n'aurait vue.
 *
 * Aucune donnée réelle : les noms sont inventés (interdit 1 n° 10).
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const MOLECULE = 'Zorbitrex';
const STATUT_TRAITEMENT = 'Protocole Flibustine';
const STATUT_CYCLE = 'Phase inventée du contrôle';

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
    console.log(
      `      obtenu  ${String(JSON.stringify(obtenu)).slice(0, 220)}\n      attendu ${String(JSON.stringify(attendu)).slice(0, 220)}`,
    );
  }
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 200)));

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

/**
 * L'indicateur tel que l'écran des synthèses le rend.
 *
 * On attend que le calcul soit **fini**, pas un délai. La première
 * version dormait trois secondes et lisait le bloc à moitié peint : le
 * libellé était là, la mesure pas encore, et l'essai accusait un
 * indicateur juste. Un contrôle qui accuse à tort se fait désactiver —
 * c'est la pire des issues, pire qu'un contrôle absent.
 */
const lireLIndicateur = async () => {
  await aller('/syntheses/', '#entete-principal');
  await page
    .waitForFunction(
      () => {
        const c = document.getElementById('chargement-syntheses');
        return !c || c.hidden || c.classList.contains('hidden') || c.offsetParent === null;
      },
      undefined,
      { timeout: 40000 },
    )
    .catch(() => {});
  /* Puis un souffle, le temps que le rendu suive le calcul. */
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const bloc = document.querySelector('[data-indicateur="corps.jours-avec-prise"]');
    if (!bloc) return { present: false };
    /*
       `data-valeur` porte la valeur BRUTE, posée par l'écran. On la lit
       là, et non dans le texte : la version précédente cherchait un
       nombre dans `textContent`, et attrapait « effectif : 1 » collé à
       « 1 jour(s) renseigné(s) » — soit « 11 ». Elle accusait un
       indicateur juste, ce qui est la pire espèce de contrôle.
    */
    const valeur = bloc.querySelector('[data-valeur]');
    return {
      present: true,
      valeur: valeur ? valeur.getAttribute('data-valeur') : null,
      texte: (bloc.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  });
};

console.log('\n\x1b[1m1. Saisir une prise par le formulaire, coffre ouvert\x1b[0m');
await franchirInitialisation(page, RACINE, MDP);
await aller('/odyssee/corps/', '#entete-principal');
{
  const champ = await page.locator('#mdp-coffre').isVisible().catch(() => false);
  vrai('le formulaire du coffre est offert', champ);
  if (champ) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 });
  vrai('le coffre est ouvert', await coffreOuvert());

  await page.waitForSelector('#nom-prise', { timeout: 20000 });
  await page.fill('#nom-prise', MOLECULE);
  await page.fill('#dose', '42 mg');
  await page.click('#noter-prise');
  await page.waitForTimeout(1500);

  /*
     On vérifie la saisie par la BASE et non par l'écran : l'écran peut
     afficher une liste optimiste. Ce qui compte est qu'un enregistrement
     scellé existe.
  */
  const scelles = await page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const n = await new Promise((ok) => {
      const q = base.transaction('odysseeMedicaments').objectStore('odysseeMedicaments').count();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return n;
  });
  v('une prise est enregistrée, scellée', scelles, 1);
}

console.log('\n\x1b[1m2. L’indicateur la compte, coffre ouvert\x1b[0m');
{
  const vu = await lireLIndicateur();
  vrai('l’indicateur est affiché', vu.present === true);
  if (vu.present) {
    vrai('sous son libellé', vu.texte.includes('Jours avec une prise notée'));
    /*
       On compare la valeur rendue, pas un booléen : un échec doit dire ce
       qu'il a lu. La version booléenne a échoué deux fois sans rien
       m'apprendre, et la version par expression régulière a accusé à tort.
    */
    v('et il compte un jour', vu.valeur, '1');
    /*
       Sonde FAIBLE, et nommée telle : elle attrape une fuite D'ÉCRAN, pas
       une fuite dans le fait. Le sabotage qui met `p.nom` dans la valeur
       du fait la laisse verte, puisque cet écran n'affiche pas les faits.
       La condition « sans texte qui les nomme » se prouve dans
       `essais:faits-sensible`. Voir l'en-tête.
    */
    v('l’écran ne montre pas la molécule (sonde faible)', vu.texte.includes(MOLECULE), false);
  }
}

console.log('\n\x1b[1m3. Coffre fermé : « pas de donnée », et surtout pas zéro\x1b[0m');
{
  await aller('/odyssee/corps/', '#entete-principal');
  await page.click('#temoin-coffre-fermer');
  await page.waitForTimeout(1500);
  v('le coffre est bien refermé', await coffreOuvert(), false);

  const vu = await lireLIndicateur();
  if (!vu.present) {
    /*
       Acceptable : un indicateur sans mesure peut ne pas être rendu du
       tout. Ce qui ne l'est pas, c'est un zéro affiché.
    */
    vrai('l’indicateur n’est pas rendu, ce qui n’est pas un zéro', true);
  } else {
    v('aucun zéro affiché', /(^|\D)0(\D|$)/.test(vu.texte), false);
    vrai(
      'et l’absence est dite',
      /pas de donnée|absence|sans source|rien/i.test(vu.texte),
    );
  }
}

console.log('\n\x1b[1m4. Un statut de nature « cycle » n’entre pas dans l’analyse\x1b[0m');
{
  await aller('/odyssee/corps/', '#entete-principal');
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
    await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 });
  }
  await page.waitForSelector('#intitule-statut', { timeout: 20000 });

  for (const [intitule, nature] of [
    [STATUT_TRAITEMENT, 'traitement'],
    [STATUT_CYCLE, 'cycle'],
  ]) {
    await page.fill('#intitule-statut', intitule);
    await page.selectOption('#nature', nature);
    await page.click('#noter-statut');
    await page.waitForTimeout(1200);
  }

  const n = await page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const tout = await new Promise((ok) => {
      const q = base.transaction('odysseeHormonal').objectStore('odysseeHormonal').getAll();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return tout.length;
  });
  v('les deux statuts sont enregistrés', n, 2);

  /*
     Et le cycle n'arrive pas jusqu'à l'analyse. On lit la projection par
     l'écran des synthèses : si le filtre sautait, un indicateur de statut
     compterait deux périodes au lieu d'une — et surtout, l'intitulé
     inventé du statut de cycle apparaîtrait quelque part.
  */
  await aller('/syntheses/', '#entete-principal');
  await page.waitForTimeout(3000);
  const texte = await page.textContent('body');
  /* Mêmes sondes faibles que ci-dessus, et pour la même raison. */
  v('l’écran ne montre pas le statut de cycle (sonde faible)', texte.includes(STATUT_CYCLE), false);
  v('ni le traitement', texte.includes(STATUT_TRAITEMENT), false);
  v('ni la molécule', texte.includes(MOLECULE), false);
}

console.log('\n\x1b[1m5. Aucune erreur de page sur le parcours\x1b[0m');
v('la console est muette', erreurs, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
