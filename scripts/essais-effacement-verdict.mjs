/**
 * LE VERDICT D'UN EFFACEMENT S'ÉCRIT EN DERNIER, ET IL NE MENT PAS.
 *
 * ## Les deux défauts gardés
 *
 * `appliquerEffacement` de `stockage.astro` écrivait son verdict PUIS appelait
 * `rafraichirComptes()`, qui remplace les listes par `replaceChildren()`. Un
 * seul `catch` couvrait l'effacement ET la peinture.
 *
 * 1. **LE MENSONGE.** Si la peinture échouait après un effacement RÉUSSI,
 *    l'écran disait « Effacement interrompu ». Sur le seul geste du site qui
 *    soit sans recours. Quelqu'un à qui l'on annonce une interruption qui n'a
 *    pas eu lieu ne sait plus ce qu'il possède — et peut relancer l'effacement.
 *
 * 2. **LA COURSE.** `travailFini` rend la main sur le verdict ; la peinture
 *    vient après. Les treize cases de domaine sont donc neuves et décochées à
 *    un instant où l'on croit l'écran au repos. Mesuré par le constructeur, à
 *    la sonde : à l'expiration, le message disait « Choisissez au moins un
 *    domaine. » et les treize cases étaient à faux, dont celle qui venait
 *    d'être cochée. C'était la cause de l'intermittence de
 *    `essais:effacement:navigateur` — vert, rouge, vert, vert sur le même code.
 *
 * ## Ce que cet essai mesure, et comment
 *
 * L'ISSUE NORMALE se mesure par l'ORDRE : on marque le premier enfant de la
 * liste des domaines avant le geste, et l'on vérifie qu'au moment où le verdict
 * est lisible, ce nœud a déjà disparu. Si le verdict précédait la peinture,
 * l'ancien nœud serait encore là.
 *
 * L'ISSUE DÉGRADÉE se mesure par SABOTAGE, et c'est elle qui compte : on retire
 * `#alerte-quota`, dont `peindreOccupation` a besoin. La peinture échoue donc
 * APRÈS un effacement réussi — exactement le cas où l'écran mentait. On vérifie
 * les trois choses à la fois : ce qu'il dit, ce qu'il ne dit plus, et que les
 * données sont bien parties.
 *
 * La troisième est le cœur : sans elle, un écran qui refuserait d'effacer
 * passerait l'essai en disant la bonne phrase.
 */
import { chromium } from 'playwright-core';

import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreALaRedemande } from './lib/boite-essais.mjs';
import { apresLeChangementDeTexte } from './lib/post-condition.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

let echecs = 0;
const v = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
  } else {
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${intitule}`);
    console.log(`      obtenu  ${a}`);
    console.log(`      attendu ${b}`);
  }
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/** Un onglet neuf, base vide, avec dix sessions de n-back en 2025. */
async function unEcranPret() {
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  const connecter = async () => {
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
    }
  };

  await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
  await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.deleteDatabase('revinsp');
        r.onsuccess = r.onerror = r.onblocked = () => ok();
      }),
  );
  /* Par un écran qui lit la base, pour qu'elle naisse au bon schéma. */
  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  await connecter();
  await page.waitForSelector('#etat-sauvegarde-titre', { timeout: 30000 });

  await page.evaluate(
    () =>
      new Promise((ok, ko) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const base = r.result;
          const tx = base.transaction(['nback'], 'readwrite');
          const nback = tx.objectStore('nback');
          for (let i = 0; i < 10; i += 1) {
            nback.put({
              id: i + 1,
              le: `2025-0${(i % 9) + 1}-15T10:00:00.000Z`,
              n: 2,
              dimensions: ['position'],
              nombreEpreuves: 20,
              taux: 0.8,
              reperees: 8,
              aReperer: 10,
              erreurs: 2,
            });
          }
          tx.oncomplete = () => {
            base.close();
            ok();
          };
          tx.onerror = () => ko(tx.error);
        };
        r.onerror = () => ko(r.error);
      }),
  );

  await page.goto(`${RACINE}/stockage/`, { waitUntil: 'networkidle' });
  await connecter();
  await page.waitForSelector('#stockage', { state: 'visible', timeout: 60000 });
  return { ctx, page };
}

const compter = (page, magasin) =>
  page.evaluate(
    (nom) =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const base = r.result;
          if (!base.objectStoreNames.contains(nom)) {
            base.close();
            return ok(null);
          }
          const q = base.transaction(nom, 'readonly').objectStore(nom).count();
          q.onsuccess = () => {
            base.close();
            ok(q.result);
          };
          q.onerror = () => {
            base.close();
            ok(null);
          };
        };
        r.onerror = () => ok(null);
      }),
    magasin,
  );

/** Coche un domaine, compte, et mène jusqu'à la redemande du mot de passe. */
async function jusquAuPointDeNonRetour(page) {
  await page.check('input[name="groupe-effacement"][value="cog-training"]');
  await page.fill('#depuis', '2025-01-01');
  await page.fill('#jusqua', '2025-12-31');
  await page.click('#compter');
  await page.waitForSelector('#decompte', { state: 'visible', timeout: 30000 });
}

try {
  /* ── L'issue normale : le verdict vient APRÈS la peinture ───────────── */
  console.log('\n\x1b[1mL’ISSUE NORMALE : LE VERDICT VIENT APRÈS LA PEINTURE\x1b[0m');
  {
    const { ctx, page } = await unEcranPret();
    v('dix sessions sont semées', await compter(page, 'nback'), 10);
    await jusquAuPointDeNonRetour(page);

    /*
       On marque le premier enfant de la liste des domaines. « peindreGroupes »
       fait « replaceChildren() » : si la peinture a eu lieu, ce nœud-là n'est
       plus dans le document. C'est la post-condition d'un REMPLACEMENT, et
       elle ne demande rien au site.
    */
    const marque = await page.evaluate(() => {
      const premier = document.querySelector('#groupes-effacement')?.firstElementChild;
      if (!premier) return false;
      premier.setAttribute('data-temoin-avant', 'oui');
      return true;
    });
    v('la liste des domaines a un premier enfant, qu’on marque', marque, true);

    /*
       ── POURQUOI « travailFini » NE CONVIENT PAS ICI, ET JE M'Y SUIS PRIS ──

       Première écriture de cet essai : « travailFini(page, '#message-effacement') ».
       Elle a rendu la main aussitôt, sur « Compté. Rien n'a été effacé. » — le
       verdict de l'étape « Compter », posé AVANT mon geste. Les deux contrôles
       qui suivaient tombaient en accusant l'écran, qui n'avait rien fait de mal.

       C'est le premier motif de « docs/cyclades/cadence-des-essais.md », et je
       l'ai commis en écrivant un essai contre lui : une attente déjà vraie
       avant le geste n'attend rien. La parade est celle du document — relever
       l'état AVANT, agir, puis attendre qu'il DIFFÈRE —, et
       « apresLeChangementDeTexte » la rend en une ligne. Elle rend « false » sur
       expiration plutôt que de lever, donc l'assertion garde son titre.
    */
    const verdictNouveau = await apresLeChangementDeTexte(
      page,
      '#message-effacement',
      async () => {
        await page.click('#effacer-sans');
        await repondreALaRedemande(page, MDP, { delai: 30000 });
      },
    );
    v('l’écran rend un verdict NOUVEAU, et non celui de « Compter »', verdictNouveau, true);
    const dit = ((await page.locator('#message-effacement').textContent()) ?? '').trim();
    console.log(`      il dit : « ${dit.slice(0, 120)} »`);

    v('le verdict annonce les dix enregistrements', /\b10\b/.test(dit), true);
    /*
       LE CONTRÔLE D'ORDRE. Au moment où le verdict est lisible, l'ancien nœud
       doit avoir disparu. Avant ce lot, le verdict paraissait d'abord et ce
       contrôle tombait.
    */
    v(
      'et quand il paraît, la liste a DÉJÀ été repeinte',
      await page.evaluate(() => document.querySelector('[data-temoin-avant]') === null),
      true,
    );
    v('les dix sessions sont parties', await compter(page, 'nback'), 0);
    await ctx.close();
  }

  /* ── L'issue dégradée : la peinture échoue après un effacement réussi ─ */
  console.log('\n\x1b[1mL’ISSUE DÉGRADÉE : L’EFFACEMENT A EU LIEU, L’AFFICHAGE NON\x1b[0m');
  {
    const { ctx, page } = await unEcranPret();
    v('dix sessions sont semées', await compter(page, 'nback'), 10);
    await jusquAuPointDeNonRetour(page);

    /*
       LE SABOTAGE. « peindreOccupation » lit « $('alerte-quota') », et « $ »
       rend « getElementById(id)! » — donc « null.classList » lève. On retire
       donc cet élément JUSTE AVANT de confirmer : la peinture échouera après
       que l'effacement aura eu lieu, qui est le cas exact où l'écran mentait.

       On le retire ici et non au chargement : « peindreOccupation » est aussi
       appelée à l'ouverture de l'écran, et la saboter là ferait échouer la mise
       en place au lieu de l'issue qu'on mesure.
    */
    const retire = await page.evaluate(() => {
      const el = document.getElementById('alerte-quota');
      if (!el) return false;
      el.remove();
      return true;
    });
    v('le sabotage retire l’élément dont la peinture a besoin', retire, true);

    /*
       MÊME PARADE QUE CI-DESSUS. Cette passe-ci était VERTE avec l'attente
       tautologique, et c'est pire que si elle avait rougi : elle l'était par le
       MOMENT — le message avait eu le temps de changer — et non par
       construction. Un essai vert par chance ne garde rien.
    */
    const verdictNouveau = await apresLeChangementDeTexte(
      page,
      '#message-effacement',
      async () => {
        await page.click('#effacer-sans');
        await repondreALaRedemande(page, MDP, { delai: 30000 });
      },
    );
    v('l’écran rend un verdict NOUVEAU', verdictNouveau, true);
    const dit = ((await page.locator('#message-effacement').textContent()) ?? '').trim();
    console.log(`      il dit : « ${dit}  »`);

    v('il dit que l’effacement est FAIT', /[Ee]ffacement fait/.test(dit), true);
    v('et que c’est l’affichage qui n’a pas suivi', /affichage n’a pas pu se mettre à jour/.test(dit), true);
    v('et il dit quoi faire', /rechargez la page/i.test(dit), true);
    /*
       LE CONTRÔLE QUI DONNE SON SENS AUX TROIS PRÉCÉDENTS. « interrompu » est
       le mot que ce lot retire, et c'était un MENSONGE : les données étaient
       parties. Un essai qui vérifierait seulement la nouvelle phrase passerait
       aussi sur un écran qui aurait cessé d'effacer.
    */
    v('il ne dit PAS « interrompu »', /interrompu/i.test(dit), false);
    v('et les dix sessions sont bien parties', await compter(page, 'nback'), 0);
    await ctx.close();
  }
} finally {
  await nav.close();
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} contrôle${echecs > 1 ? 's' : ''} en échec.\x1b[0m\n`
    : '\n\x1b[32mTout est vert : le verdict vient en dernier, et il ne ment pas.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
