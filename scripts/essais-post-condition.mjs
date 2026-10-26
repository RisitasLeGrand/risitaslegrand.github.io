/**
 * LES AIDES D'ATTENTE, ÉPROUVÉES DANS LES DEUX SENS.
 *
 *   npm run essais:post-condition
 *
 * ## Pourquoi cet essai existe
 *
 * `scripts/lib/post-condition.mjs` tient les attentes de tout le chantier des
 * temporisations : une cinquantaine d'essais en dépendent, et deux agents les
 * emploient. Une aide qui rendrait la main trop tôt ferait passer au vert des
 * assertions qui lisent l'écran d'avant — c'est exactement le défaut que ce
 * module existe pour supprimer, et il se réintroduirait sans un mot.
 *
 * ## Les deux sens, et pourquoi les deux
 *
 * Chaque aide est éprouvée **satisfaite** et **expirée**. Le second sens est
 * le plus important : une aide qui rend la main à l'expiration doit le dire par
 * sa valeur de retour ou laisser l'assertion juger, et surtout **ne pas
 * paraître satisfaite**. Une aide qui ne sait pas expirer est une aide qui
 * valide tout.
 *
 * ## Pourquoi il n'a besoin ni du site ni du mot de passe
 *
 * Les pages sont écrites ici, par `setContent` : quelques balises et un peu de
 * script. Éprouver les aides contre le vrai site mêlerait deux questions — les
 * aides et l'écran —, et un rouge ne dirait pas laquelle est en cause. Les
 * délais sont courts (300 ms) pour que les cas d'expiration ne coûtent rien.
 */
import { chromium } from 'playwright-core';
import {
  annonceDe,
  apresLaPeinture,
  apresLeChangementDeTexte,
  apresLeRemplacement,
  apresLesAnimations,
  attendreEnBase,
  attendreLeCompte,
  boutonRendu,
  devientVisible,
  travailFini,
} from './lib/post-condition.mjs';

const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const gras = (t) => `\x1b[1m${t}\x1b[0m`;

let echecs = 0;
const v = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? vert('✓') : rouge('✗')} ${quoi}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};
const vrai = (quoi, condition) => v(quoi, Boolean(condition), true);

/** Le délai des cas d'expiration : court, pour que l'essai reste rapide. */
const COURT = 300;

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext();
const page = await ctx.newPage();

/*
   LES PAGES SONT SERVIES SUR UNE VRAIE ORIGINE, et non posées par
   « setContent ».

   La raison est mesurée : sur « about:blank », l'origine est opaque et
   IndexedDB est REFUSÉE — « access to the Indexed Database API is denied in
   this context ». La section d'`attendreEnBase` tombait donc sur une panne de
   banc, et non sur un défaut d'aide.

   On intercepte donc une adresse qui n'existe pas et l'on répond soi-même :
   l'origine est normale, le site n'est pas sollicité, et les deux questions
   restent séparées.
*/
let corpsCourant = '';
const ORIGINE = 'http://essais-des-aides.cyclades';
await ctx.route(`${ORIGINE}/**`, (route) =>
  route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Essai</title></head><body>${corpsCourant}</body></html>`,
  }),
);

/** Pose une page d'essai, sur l'origine interceptée. */
const poser = async (corps) => {
  corpsCourant = corps;
  /* Une adresse différente à chaque fois : rien ne se sert d'un cache. */
  await page.goto(`${ORIGINE}/?${Date.now()}-${Math.random().toString(36).slice(2)}`);
};

/* ── annonceDe ──────────────────────────────────────────────────────────── */

console.log(`\n${gras('annonceDe — un état peint sans geste')}`);
{
  await poser('<p id="etat"></p>');
  const debut = Date.now();
  const vide = await annonceDe(page, '#etat', { delai: COURT });
  const dure = Date.now() - debut;
  v('une zone vide ne rend rien', vide, '');
  vrai('et l’attente a bien duré jusqu’à la borne', dure >= COURT);

  await page.evaluate(() => {
    setTimeout(() => {
      document.getElementById('etat').textContent = '  12 fiches  ';
    }, 60);
  });
  v('une zone remplie rend son texte, sans les blancs', await annonceDe(page, '#etat'), '12 fiches');
}

/* ── travailFini ────────────────────────────────────────────────────────── */

console.log(`\n${gras('travailFini — le verdict, et non l’annonce')}`);
{
  await poser('<p id="message">Fusion en cours…</p>');
  const reste = await travailFini(page, '#message', { delai: COURT });
  v('« en cours » ne vaut pas verdict', reste, 'Fusion en cours…');

  /*
     LE CAS QUI COMPTE : l'écran annonce, puis tranche. Une aide qui se
     contenterait de « non vide » rendrait la main sur l'annonce, et
     l'assertion lirait « Fusion en cours… » au lieu du compte.
  */
  await poser('<p id="message"></p>');
  await page.evaluate(() => {
    const zone = document.getElementById('message');
    setTimeout(() => {
      zone.textContent = 'Fusion en cours…';
    }, 40);
    setTimeout(() => {
      zone.textContent = '3 doublons fondus.';
    }, 160);
  });
  v('le verdict est attendu, pas l’annonce', await travailFini(page, '#message'), '3 doublons fondus.');

  /* Et un refus est un verdict comme un autre : l'aide n'en présume rien. */
  await poser('<p id="message"></p>');
  await page.evaluate(() => {
    setTimeout(() => {
      document.getElementById('message').textContent = 'Échec : le fichier est illisible.';
    }, 40);
  });
  v(
    'un refus aussi est un verdict',
    await travailFini(page, '#message'),
    'Échec : le fichier est illisible.',
  );
}

/* ── boutonRendu ────────────────────────────────────────────────────────── */

console.log(`\n${gras('boutonRendu — la post-condition d’un geste')}`);
{
  await poser('<button id="geste">Faire</button><p id="trace"></p>');
  await page.evaluate(() => {
    document.getElementById('geste').addEventListener('click', (e) => {
      const bouton = e.currentTarget;
      bouton.disabled = true;
      setTimeout(() => {
        document.getElementById('trace').textContent = 'fait';
        bouton.disabled = false;
      }, 120);
    });
  });
  await page.click('#geste');
  v('le bouton rendu est attendu', await boutonRendu(page, '#geste'), true);
  v('et l’action est bien finie quand il l’est', await page.textContent('#trace'), 'fait');

  /* Un bouton qui ne revient pas : l'aide doit rendre faux, non attendre. */
  await poser('<button id="bloque">Faire</button>');
  await page.evaluate(() => {
    document.getElementById('bloque').addEventListener('click', (e) => {
      e.currentTarget.disabled = true;
    });
  });
  await page.click('#bloque');
  v('un bouton qui reste désactivé rend faux', await boutonRendu(page, '#bloque', { delai: COURT }), false);
}

/* ── devientVisible ─────────────────────────────────────────────────────── */

console.log(`\n${gras('devientVisible — il paraît, il s’en va')}`);
{
  await poser('<p id="bandeau" hidden>Là</p>');
  v('caché, il ne paraît pas', await devientVisible(page, '#bandeau', true, { delai: COURT }), false);
  await page.evaluate(() => {
    setTimeout(() => document.getElementById('bandeau').removeAttribute('hidden'), 60);
  });
  v('démasqué, il paraît', await devientVisible(page, '#bandeau', true), true);
  await page.evaluate(() => {
    setTimeout(() => document.getElementById('bandeau').setAttribute('hidden', ''), 60);
  });
  v('et il s’en va', await devientVisible(page, '#bandeau', false), true);
}

/* ── attendreLeCompte ───────────────────────────────────────────────────── */

console.log(`\n${gras('attendreLeCompte — une liste qui grandit')}`);
{
  await poser('<ul id="liste"></ul>');
  v('le compte n’est pas atteint', await attendreLeCompte(page, '#liste li', 2, { delai: COURT }), false);
  await page.evaluate(() => {
    setTimeout(() => {
      document.getElementById('liste').innerHTML = '<li>un</li><li>deux</li>';
    }, 60);
  });
  v('puis il l’est', await attendreLeCompte(page, '#liste li', 2), true);
}

/* ── apresLeChangementDeTexte ───────────────────────────────────────────── */

console.log(`\n${gras('apresLeChangementDeTexte — un texte réécrit')}`);
{
  await poser('<p id="phrase">Avant</p>');
  v(
    'un geste qui ne change rien fait expirer',
    await apresLeChangementDeTexte(page, '#phrase', async () => {}, { delai: COURT }),
    false,
  );
  v(
    'un geste qui réécrit est attendu',
    await apresLeChangementDeTexte(
      page,
      '#phrase',
      () =>
        page.evaluate(() => {
          setTimeout(() => {
            document.getElementById('phrase').textContent = 'Après';
          }, 60);
        }),
    ),
    true,
  );
  v('et le texte est bien le neuf', await page.textContent('#phrase'), 'Après');
}

/* ── apresLeRemplacement ────────────────────────────────────────────────── */

console.log(`\n${gras('apresLeRemplacement — une zone qui refait ses enfants')}`);
{
  await poser('<div id="zone"><p>ancien</p></div>');
  /*
     LE CAS QUE L'AIDE EXISTE POUR TENIR : la valeur d'après ressemble à celle
     d'avant. Une attente sur le texte ne verrait rien ; la marque, si.
  */
  await apresLeRemplacement(page, '#zone', () =>
    page.evaluate(() => {
      setTimeout(() => {
        document.getElementById('zone').replaceChildren(
          Object.assign(document.createElement('p'), { textContent: 'ancien' }),
        );
      }, 60);
    }),
  );
  v(
    'le nouvel enfant ne porte pas la marque',
    await page.evaluate(() => document.querySelector('#zone > p')?.hasAttribute('data-ancien')),
    false,
  );

  /* Une zone qui ne remplace rien : la marque survit, et l'attente expire. */
  await poser('<div id="fixe"><p>là</p></div>');
  const debut = Date.now();
  await apresLeRemplacement(page, '#fixe', async () => {}, { delai: COURT });
  vrai('une zone qui ne remplace rien fait expirer', Date.now() - debut >= COURT);
}

/* ── apresLaPeinture ────────────────────────────────────────────────────── */

console.log(`\n${gras('apresLaPeinture — la zone compte ses peintures')}`);
{
  await poser('<div id="compteur" data-peint="3">état</div><button id="peindre">Peindre</button>');
  await page.evaluate(() => {
    document.getElementById('peindre').addEventListener('click', () => {
      const zone = document.getElementById('compteur');
      zone.setAttribute('aria-busy', 'true');
      setTimeout(() => {
        zone.textContent = 'repeint';
        zone.removeAttribute('aria-busy');
        zone.dataset.peint = String(Number(zone.dataset.peint) + 1);
      }, 80);
    });
  });
  await apresLaPeinture(page, '#compteur', () => page.click('#peindre'));
  v('le compteur a changé', await page.getAttribute('#compteur', 'data-peint'), '4');
  v('et la zone n’est plus occupée', await page.getAttribute('#compteur', 'aria-busy'), null);
  v('le contenu est celui d’après', await page.textContent('#compteur'), 'repeint');
}

/* ── apresLesAnimations ─────────────────────────────────────────────────── */

console.log(`\n${gras('apresLesAnimations — une géométrie se lit après l’animation')}`);
{
  await poser(`
    <style>
      @keyframes monte { from { transform: translateY(40px); } to { transform: translateY(0); } }
      #bandeau { position: fixed; bottom: 0; animation: monte 150ms linear; }
    </style>
    <div id="bandeau">Bandeau</div>
  `);
  await apresLesAnimations(page, '#bandeau', { delai: 5000 });
  v(
    'l’animation finie, la position est celle d’arrivée',
    await page.evaluate(() => Math.round(document.getElementById('bandeau').getBoundingClientRect().bottom)),
    await page.evaluate(() => window.innerHeight),
  );
  /* Un élément sans animation : l'aide rend la main tout de suite. */
  await poser('<p id="rien">Rien</p>');
  const debut = Date.now();
  await apresLesAnimations(page, '#rien', { delai: 5000 });
  vrai('sans animation, elle ne dort pas', Date.now() - debut < 1000);
}

/* ── attendreEnBase ────────────────────────────────────────────────────── */

console.log(`\n${gras('attendreEnBase — la base est la post-condition')}`);
{
  await poser('<p id="rien">base</p>');
  /* On fabrique une base dans la page : nom et magasin de Cyclades. */
  await page.evaluate(
    () =>
      new Promise((ok, rate) => {
        const demande = indexedDB.deleteDatabase('revinsp');
        demande.onsuccess = demande.onerror = demande.onblocked = () => {
          const neuve = indexedDB.open('revinsp', 1);
          neuve.onupgradeneeded = () => neuve.result.createObjectStore('cartes', { keyPath: 'id' });
          neuve.onsuccess = () => {
            neuve.result.close();
            ok();
          };
          neuve.onerror = () => rate(neuve.error);
        };
      }),
  );

  v(
    'un magasin vide ne satisfait pas',
    await attendreEnBase(page, 'cartes', (tout) => tout.length > 0, { delai: COURT }),
    null,
  );

  await page.evaluate(() => {
    setTimeout(() => {
      const demande = indexedDB.open('revinsp');
      demande.onsuccess = () => {
        const base = demande.result;
        const t = base.transaction('cartes', 'readwrite');
        t.objectStore('cartes').put({ id: 'une', fsrs: { reps: 1 } });
        t.oncomplete = () => base.close();
      };
    }, 80);
  });
  const trouve = await attendreEnBase(page, 'cartes', (tout) => tout.length > 0);
  v('une écriture est attendue, et rendue', trouve?.[0]?.id, 'une');

  /*
     ET LA CONNEXION EST REFERMÉE. On le mesure par ce qui en dépend : une
     montée de version est BLOQUÉE tant qu'une connexion de l'ancienne reste
     ouverte. Si le sondage laissait la sienne, l'ouverture en version 2
     ci-dessous n'aboutirait pas — c'est le défaut que le module a eu, et
     c'est ainsi qu'on l'empêche de revenir.
  */
  const montee = await page.evaluate(
    () =>
      new Promise((ok) => {
        const demande = indexedDB.open('revinsp', 2);
        let bloquee = false;
        demande.onblocked = () => {
          bloquee = true;
        };
        demande.onupgradeneeded = () => demande.result.createObjectStore('neuf', { keyPath: 'id' });
        demande.onsuccess = () => {
          demande.result.close();
          ok(bloquee ? 'bloquée' : 'passée');
        };
        demande.onerror = () => ok('refusée');
        setTimeout(() => ok(bloquee ? 'bloquée' : 'sans réponse'), 3000);
      }),
  );
  v('le sondage n’a laissé aucune connexion ouverte', montee, 'passée');
}

await nav.close();
console.log(
  echecs ? `\n${rouge(`${echecs} essai(s) en échec.`)}\n` : `\n${vert('Toutes les aides tiennent.')}\n`,
);
process.exit(echecs ? 1 : 0);
