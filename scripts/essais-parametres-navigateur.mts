/**
 * La page « Paramètres », dans un vrai navigateur.
 *
 *   npm run essais:parametres-navigateur
 *
 * Les essais du 42 (§ 3), ceux qui demandent un écran :
 *
 * 1. **L'effet du réglage sur son écran** — on change « Cartes par séance »
 *    sur la page centrale, et on relit la valeur sur `/progression/`, son
 *    écran d'origine. C'est l'essai d'égalité que le prompt exige : il ne
 *    suffit pas que la page affiche un réglage, il faut qu'elle écrive au
 *    même endroit que l'écran d'où il vient.
 * 2. **« Rétablir »** n'apparaît qu'une fois la valeur changée, et remet la
 *    valeur d'usine.
 * 3. **Coffre fermé, rien en clair** : la ligne « Chapitre Santé » s'affiche
 *    sous son libellé, sans sa valeur, et le dit.
 * 4. **La recherche** filtre les lignes et vide les sections devenues vides.
 * 5. **Les ancres** : `/parametres/#sport` ouvre la page sur la bonne
 *    section.
 * 6. **Les cibles tactiles** des commandes construites par le script : ce
 *    sont les seules que les essais du 41 ne voient pas, puisqu'elles
 *    n'existent pas dans le HTML livré.
 *
 * Le préalable est mesuré, pas supposé : si la page ne s'ouvre pas, ou si
 * aucune commande n'est construite, l'essai le dit et s'arrête — sans quoi
 * tout le reste passerait au vert sur une page vide.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { devientVisible as devientVisibleSur } from './lib/post-condition.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();

/*
   LE DÉLAI DES ATTENTES, ET POURQUOI IL EST LARGE.

   Une attente bornée ne sert qu'à transformer un blocage en rouge lisible :
   elle ne mesure pas la vitesse, et un délai serré la ferait mentir sur une
   machine chargée. Mesuré : à ×60 de bridage, le montage des soixante-quinze
   réglages dépasse quinze secondes, et trois assertions tombaient — non parce
   que la page était fausse, mais parce que ma borne l'était.

   Trente secondes, donc. Un vrai défaut échoue de toute façon, puisque la
   condition est vérifiée en continu et que son absence est rendue comme un
   faux.
*/
const DELAI = 30_000;

/** `devientVisible` du module partagé, la page étant toujours la même ici. */
const devientVisible = (selecteur: string, visible = true): Promise<boolean> =>
  devientVisibleSur(page, selecteur, visible);

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET POURQUOI AUCUNE N'EST UNE DURÉE

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4 : une temporisation à
   l'aveugle est une MOYENNE, et elle cède sous une batterie chargée — au
   mauvais endroit, puisqu'elle lit alors l'écran d'avant et rend souvent la
   bonne réponse par hasard. Les dix-neuf de ce fichier sont remplacées par la
   post-condition de chaque geste.

   Trois choses sont attendues ici, et chacune est écrite par le site APRÈS ce
   que l'assertion lit :

   1. le MONTAGE des commandes de la page centrale — `data-monte`, un compteur
      posé une fois la boucle finie ;
   2. la VALEUR d'un champ d'écran, qui part vide du serveur et que le script
      remplit ;
   3. le REMONTAGE d'une commande après un changement : `appliquer` écrit en
      base, puis reconstruit le bloc. La reconstruction prouve l'écriture.

   Chaque attente est BORNÉE et son expiration est rendue comme un faux : la
   condition n'est pas supposée, elle est vérifiée en continu, et l'assertion
   échoue si elle ne vient jamais. Ce qui disparaît, c'est seulement l'exigence
   qu'elle arrive en moins d'une seconde et demie — laquelle ne mesurait pas
   l'écran mais la charge de la machine.
   ──────────────────────────────────────────────────────────────────────────
*/

/**
 * Attend que les commandes de la page centrale soient construites.
 *
 * `precedent` est la valeur du compteur AVANT le geste, pour le cas où la page
 * reste la même — le montage se refait à chaque ouverture ou fermeture du
 * coffre. Après une navigation, le compteur repart de zéro et `null` suffit.
 */
const attendreLeMontage = (precedent: string | null = null) =>
  page
    .waitForFunction(
      (avant) => {
        const valeur = document
          .getElementById('tous-les-reglages')
          ?.getAttribute('data-monte');
        return valeur !== null && valeur !== undefined && valeur !== avant;
      },
      precedent,
      { timeout: DELAI },
    )
    .catch(() => {});

/**
 * Attend qu'un champ d'écran ait reçu sa valeur.
 *
 * Les deux champs à doublons — `#plafond-cartes` sur /progression/ et
 * `#retention-archiver` sur /notifications/ — sont rendus SANS attribut
 * `value` : vides jusqu'à ce que le script de l'écran les remplisse. « Non
 * vide » est donc une vraie transition, et non un état déjà acquis.
 */
const attendreLaValeur = (selecteur: string) =>
  page
    .waitForFunction(
      (s) => {
        const champ = document.querySelector(s);
        return champ instanceof HTMLInputElement && champ.value !== '';
      },
      selecteur,
      { timeout: DELAI },
    )
    .catch(() => {});

/** Attend que le texte d'un élément soit non vide — ou vide, au choix. */
const attendreLeTexte = (selecteur: string, nonVide = true) =>
  page
    .waitForFunction(
      ([s, veutDuTexte]) => {
        const e = document.querySelector(s as string);
        if (!e) return false;
        const plein = (e.textContent ?? '').trim() !== '';
        return plein === veutDuTexte;
      },
      [selecteur, nonVide] as [string, boolean],
      { timeout: DELAI },
    )
    .catch(() => {});

/**
 * Fait le geste, et attend que la commande du réglage soit RECONSTRUITE.
 *
 * `appliquer` écrit en base, puis rappelle `monter`, qui vide la zone et la
 * rebâtit. Marquer l'ancien enfant avant le geste et attendre un enfant sans
 * la marque est donc une post-condition qu'aucun passage antérieur ne peut
 * avoir rendue vraie — c'est la forme du compteur, appliquée à un nœud.
 *
 * Attendre « un champ qui vaut 42 » n'en serait pas une : le champ que l'essai
 * vient de remplir vaut déjà 42 avant le remontage.
 */
async function apresLeRemontage(idReglage: string, geste: () => Promise<void>) {
  const zone = `[data-reglage="${idReglage}"] [data-commande]`;
  await page.evaluate(
    (s) => document.querySelector(s)?.firstElementChild?.setAttribute('data-ancien', 'oui'),
    zone,
  );
  await geste();
  await page
    .waitForFunction(
      (s) => {
        const premier = document.querySelector(s)?.firstElementChild;
        return Boolean(premier) && !premier!.hasAttribute('data-ancien');
      },
      zone,
      { timeout: DELAI },
    )
    .catch(() => {});
}

/**
 * Attend la fin du défilement — l'ÉVÉNEMENT du navigateur, pas une durée.
 *
 * `scroll-behavior: smooth` est déclaré dans `global.css`, donc une ancre
 * défile par animation. Mesuré sur la séquence de cet essai : la section est à
 * 11 197 px au changement de fragment, encore à 550 px après 600 ms, et arrive
 * à 96 px entre 600 et 1 200 ms. L'ancienne temporisation de 1 200 ms était
 * donc un PARI sur la durée d'une animation, et il lui restait moins de
 * 600 ms de marge.
 *
 * `scrollend` dit exactement ce qu'on attend. Il ne vient pas quand rien ne
 * défile — un fragment déjà atteint —, d'où le second chemin : compter les
 * trames immobiles. Dix trames, soit bien plus qu'il n'en faut à une animation
 * pour démarrer, et d'autant plus tolérant que la machine est chargée, les
 * trames s'espaçant alors.
 *
 * Le code part en CHAÎNE, comme dans `essais-echecs-dits.mts` : `tsx` compile
 * ce fichier avec esbuild, qui enveloppe toute fonction nommée d'un appel à
 * son auxiliaire `__name` — absent de la page. La version en fonction a échoué
 * exactement là, sur un « __name is not defined » qui ne parlait pas du site.
 */
const attendreLaFinDuDefilement = () =>
  page.evaluate(`
    new Promise((fini) => {
      var rendu = false;
      function rendre() {
        if (rendu) return;
        rendu = true;
        fini();
      }
      document.addEventListener('scrollend', rendre, { once: true });
      var immobiles = 0;
      var derniere = window.scrollY;
      function trame() {
        if (rendu) return;
        if (window.scrollY === derniere) immobiles += 1;
        else {
          immobiles = 0;
          derniere = window.scrollY;
        }
        if (immobiles >= 10) rendre();
        else requestAnimationFrame(trame);
      }
      requestAnimationFrame(trame);
    })
  `);

/**
 * Ouvre le commutateur de thème, et attend qu'il se soit ouvert.
 *
 * Le gestionnaire est SYNCHRONE — il reflète l'état puis démasque le menu —,
 * donc rien ne peut être surpris à mi-chemin. Ce que la temporisation couvrait
 * en réalité était l'attachement du gestionnaire. `aria-expanded` passé à
 * « true » le prouve, et c'est écrit par le même geste que la note : la note
 * peut donc être lue juste après, y compris pour constater son ABSENCE — ce
 * qu'aucune attente ne saurait faire directement.
 */
const ouvrirLeCommutateur = async () => {
  await page.locator('#bouton-theme').click();
  await page
    .waitForFunction(
      () => document.getElementById('bouton-theme')?.getAttribute('aria-expanded') === 'true',
      undefined,
      { timeout: DELAI },
    )
    .catch(() => {});
};

await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/parametres/`, { waitUntil: 'networkidle' });
await attendreLeMontage();

/* ── La prémisse ─────────────────────────────────────────────────────────── */

const lignes = await page.locator('[data-reglage]').count();
verifier('la page porte des réglages', lignes > 20, true);
const commandes = await page.locator('[data-reglage] [role="switch"], [data-reglage] select').count();
if (lignes === 0 || commandes === 0) {
  console.log(
    '\x1b[31m✗\x1b[0m aucune commande construite : la suite porterait sur une page vide, elle n’est pas mesurée',
  );
  await nav.close();
  process.exit(1);
}

/* ── 1. L'égalité avec l'écran d'origine ─────────────────────────────────── */

console.log('\nLE MÊME RÉGLAGE, DES DEUX CÔTÉS');
const champCartes = page.locator('[data-reglage="plafond-cartes"] input[type=number]');
await champCartes.waitFor({ state: 'visible', timeout: 10_000 });
const avant = await champCartes.inputValue();
verifier('« Cartes par séance » part de sa valeur d’usine', avant, '25');
await apresLeRemontage('plafond-cartes', async () => {
  await champCartes.fill('42');
  await champCartes.dispatchEvent('change');
});

const surProgression = await page.evaluate(async () => {
  const { lireReglagesSession } = await import('/src/lib/db.ts').catch(() => ({}) as never);
  return lireReglagesSession ? (await lireReglagesSession()).plafondCartes : null;
});
/*
   La lecture par import de module ne marche qu'en développement ; en
   construction, les modules sont empaquetés. On relit donc la base
   directement, ce qui mesure la même chose : ce que l'écran d'origine
   lirait.
*/
const enBase = await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const q = r.result.transaction('etat').objectStore('etat').get('reglagesSession');
        q.onsuccess = () => ok((q.result as { plafondCartes?: number })?.plafondCartes ?? null);
        q.onerror = () => ok(null);
      };
      r.onerror = () => ok(null);
    }),
);
verifier('la valeur écrite va bien dans `etat.reglagesSession`', enBase, 42);
void surProgression;

await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
await attendreLaValeur('#plafond-cartes');
const surSonEcran = await page
  .locator('#plafond-cartes')
  .first()
  .inputValue()
  .catch(() => null);
/*
   L'assertion disait d'abord « ou n'a pas ce champ, auquel cas la base fait
   foi ». C'était une porte de sortie : si le champ disparaissait de
   `/progression/`, l'essai restait vert. Le champ existe
   (`progression.astro:30`), on l'exige donc.
*/
verifier('et l’écran d’origine montre la même valeur', surSonEcran, '42');

/* ── 1 bis. Le sens inverse, et le second écran à doublons ───────────────── */

/*
   Décision du pilote du 18 octobre : les doublons de `progression.astro` et de
   `notifications.astro` sont **gardés**, « à condition d'utiliser les mêmes
   clés et les mêmes fonctions », et un essai doit vérifier « que la même
   valeur s'affiche aux deux endroits après un changement fait à l'un ».
   « À l'un » : dans les deux sens, donc, et pas seulement de la page centrale
   vers l'écran. Un réglage écrit par deux chemins qui divergent est pire
   qu'un réglage absent — on croit l'avoir changé.
*/
console.log('\nLE MÊME RÉGLAGE, DANS L’AUTRE SENS');

/* On est déjà sur /progression/ : on y change la valeur, puis on la relit
   sur la page centrale. */
const cartesSurEcran = page.locator('#plafond-cartes');
await cartesSurEcran.waitFor({ state: 'visible', timeout: 10_000 });
await cartesSurEcran.fill('65');
await cartesSurEcran.dispatchEvent('change');
/*
   L'écran écrit en base, relit ce qui a été retenu, puis annonce
   « Enregistré : … » et démasque l'annonce — en dernier. Au repos elle est
   masquée, donc la transition est réelle.
*/
await devientVisible('#message-reglages');

await page.goto(`${RACINE}/parametres/`, { waitUntil: 'networkidle' });
await attendreLeMontage();
verifier(
  'changée sur /progression/, la valeur se lit sur la page centrale',
  await page.locator('[data-reglage="plafond-cartes"] input[type=number]').inputValue(),
  '65',
);

/* Et le second écran à doublons : la rétention des notifications. */
await page.goto(`${RACINE}/notifications/`, { waitUntil: 'networkidle' });
await attendreLaValeur('#retention-archiver');
const archiverSurEcran = page.locator('#retention-archiver');
await archiverSurEcran.waitFor({ state: 'visible', timeout: 10_000 });
await archiverSurEcran.fill('11');
await archiverSurEcran.dispatchEvent('change');
await page.locator('#retention-enregistrer').click().catch(() => {});
/* Le verdict est écrit en dernier, et l'écran part sans message. */
await attendreLeTexte('#retention-message');

await page.goto(`${RACINE}/parametres/`, { waitUntil: 'networkidle' });
await attendreLeMontage();
verifier(
  'changée sur /notifications/, « Archiver après » se lit sur la page centrale',
  await page.locator('[data-reglage="retention-archiver"] input[type=number]').inputValue(),
  '11',
);

/* Puis l'aller, sur ce même réglage : la page centrale écrit là où l'écran
   lit. On remet 7 jours, la valeur d'usine, ce qui sert aussi de nettoyage. */
const archiverAuCentre = page.locator('[data-reglage="retention-archiver"] input[type=number]');
await apresLeRemontage('retention-archiver', async () => {
  await archiverAuCentre.fill('9');
  await archiverAuCentre.dispatchEvent('change');
});
await page.goto(`${RACINE}/notifications/`, { waitUntil: 'networkidle' });
await attendreLaValeur('#retention-archiver');
verifier(
  'et changée au centre, elle se lit sur /notifications/',
  await page.locator('#retention-archiver').inputValue(),
  '9',
);

/* ── 1 ter. La note du commutateur dit où remettre la bascule ───────────── */

/*
   Décision du pilote du 18 octobre : annoncer qu'un geste arrête la bascule ne
   suffit pas, il faut dire où on la remet. La note le dit **et** y mène.

   L'essai vit ici, et non dans `essais:themes-navigateur` : celui-là ouvre la
   page sans franchir le coffre, et l'en-tête n'y est pas affiché — la note
   s'y mesurait à 0 × 0 px, ce qui ne prouve rien. Ici le coffre est ouvert,
   donc l'en-tête existe et la note se voit pour de bon.
*/
console.log('\nLA NOTE DU COMMUTATEUR');
await page.goto(`${RACINE}/parametres/`, { waitUntil: 'networkidle' });
/*
   Pas d'attente du montage ici : la note vit dans l'en-tête, que le serveur
   rend, et non dans les commandes que le script construit. Attendre le
   montage ferait dépendre cet essai d'un travail qui ne le concerne pas.
*/
await ouvrirLeCommutateur();
const note = page.locator('#note-bascule');
verifier('la note se voit quand la bascule est active', await note.isVisible(), true);
verifier(
  'elle dit où réactiver la bascule',
  /réactiver dans la section « Affichage » des paramètres/.test(
    ((await note.textContent()) ?? '').replace(/\s+/g, ' '),
  ),
  true,
);
/* `.catch(() => null)` et un délai court : sans eux, une note sans lien fait
   une panne de trente secondes au lieu d'un rouge lisible. */
const cheminNote = await note
  .locator('a')
  .first()
  .getAttribute('href', { timeout: 2000 })
  .catch(() => null);
verifier(
  'et le chemin est un lien vers la bonne section',
  cheminNote?.endsWith('/parametres/#affichage') ?? false,
  true,
);

/* Bascule éteinte, la note n'a plus de sens : elle disparaît. */
await page.evaluate(() => localStorage.setItem('revinsp.bascule-jour-nuit', 'non'));
await page.reload({ waitUntil: 'networkidle' });
/*
   UN INVARIANT NÉGATIF NE S'ATTEND PAS : « la note ne paraît plus » est vrai
   tout de suite, et le resterait si elle paraissait une seconde plus tard. On
   attend la post-condition du GESTE — le menu ouvert —, après quoi la lecture
   a un sens, puisque la note est posée par le même gestionnaire synchrone.
*/
await ouvrirLeCommutateur();
verifier(
  'bascule éteinte, la note ne paraît plus',
  await page.locator('#note-bascule').isVisible(),
  false,
);
await page.evaluate(() => localStorage.removeItem('revinsp.bascule-jour-nuit'));
await page.keyboard.press('Escape');

/* ── 2. « Rétablir » ─────────────────────────────────────────────────────── */

console.log('\nRÉTABLIR');
await page.goto(`${RACINE}/parametres/`, { waitUntil: 'networkidle' });
await attendreLeMontage();
const retablir = page.locator('[data-reglage="plafond-cartes"] button', { hasText: 'Rétablir' });
verifier('« Rétablir » apparaît sur une valeur changée', await retablir.count(), 1);
await apresLeRemontage('plafond-cartes', async () => {
  await retablir.click();
});
verifier(
  'et la valeur d’usine revient',
  await page.locator('[data-reglage="plafond-cartes"] input[type=number]').inputValue(),
  '25',
);
verifier(
  'et « Rétablir » disparaît',
  await page.locator('[data-reglage="plafond-cartes"] button', { hasText: 'Rétablir' }).count(),
  0,
);

/* ── 3. Coffre fermé ─────────────────────────────────────────────────────── */

console.log('\nCOFFRE FERMÉ');
const sante = await page.evaluate(() => {
  const bloc = document.querySelector('[data-reglage="sante-active"]');
  return {
    libelle: Boolean(bloc?.textContent?.includes('Chapitre Santé')),
    message: bloc?.querySelector('[data-message]')?.textContent?.trim() ?? '',
    commande: bloc?.querySelector('[data-commande]')?.children.length ?? -1,
  };
});
verifier('le réglage sous coffre garde son libellé', sante.libelle, true);
verifier('il dit que la valeur est protégée', /coffre/i.test(sante.message), true);
verifier('et n’affiche aucune commande', sante.commande, 0);

/* ── 4. La recherche ─────────────────────────────────────────────────────── */

console.log('\nLA RECHERCHE');
await page.fill('#recherche-reglage', 'notification');
/*
   Le filtre est synchrone, et il écrit son compte EN DERNIER — après avoir
   masqué les lignes et les sections vides. Le message est vide au repos, donc
   l'attendre non vide attend bien ce tri-là.
*/
await attendreLeTexte('#resultat-recherche');
const apresRecherche = await page.evaluate(() => ({
  visibles: [...document.querySelectorAll<HTMLElement>('[data-reglage]')].filter((b) => !b.hidden)
    .length,
  sectionsVisibles: [...document.querySelectorAll<HTMLElement>('[data-section]')].filter(
    (s) => !s.hidden,
  ).length,
  message: document.getElementById('resultat-recherche')?.textContent ?? '',
}));
verifier('la recherche ne garde que les lignes qui correspondent', apresRecherche.visibles > 0 && apresRecherche.visibles < 10, true);
verifier('et vide les sections devenues vides', apresRecherche.sectionsVisibles <= 2, true);
verifier('elle dit combien', /réglage/.test(apresRecherche.message), true);
await page.fill('#recherche-reglage', '');
/* Le champ vidé, le même gestionnaire efface son message : c'est la
   post-condition du nettoyage, et la suite part d'une page entière. */
await attendreLeTexte('#resultat-recherche', false);

/* ── 5. Les ancres ───────────────────────────────────────────────────────── */

console.log('\nLES ANCRES');
await page.goto(`${RACINE}/parametres/#sport`, { waitUntil: 'networkidle' });
/*
   DEUX ATTENTES, ET ELLES NE SE REMPLACENT PAS.

   Le montage d'abord : les blocs situés au-dessus de « sport » grandissent
   quand leurs commandes arrivent, et la section redescend — mesurer avant
   mesurerait une mise en page qui n'existera plus. Sur la séquence de cet
   essai, la page est déjà montée et cette attente rend la main aussitôt ;
   elle sert au cas où l'essai est lancé depuis un autre état.

   Le défilement ensuite, et c'est lui que la temporisation couvrait. Ma
   première conversion n'avait gardé que le montage : les deux attentes
   étaient satisfaites en quelques millisecondes, la section était encore à
   11 197 px, et l'assertion est tombée. C'est elle qui m'a appris que l'ancre
   défile par ANIMATION.
*/
await attendreLeMontage();
await attendreLaFinDuDefilement();
const ancre = await page.evaluate(() => {
  const section = document.getElementById('sport');
  if (!section) return null;
  const r = section.getBoundingClientRect();
  return Math.round(r.top);
});
verifier('`#sport` amène la section dans l’écran', ancre !== null && ancre > -50 && ancre < 400, true);

/* ── 6. Les cibles tactiles des commandes construites ────────────────────── */

console.log('\nLES CIBLES TACTILES');
/*
   La règle est celle du socle, pas une plus sévère inventée ici : 44 px pour
   une commande et pour tout ce qui porte « cible-tactile », 24 px — le
   plancher de WCAG 2.2 AA — pour ce qui porte « cible-minimale », c'est-à-dire
   ce qu'on touche rarement dans un espace compté. La première version exigeait
   44 px de tout lien, et accusait les trente « Voir l'écran » d'un défaut que
   le socle autorise explicitement. Un contrôle plus sévère que la règle ne
   mesure plus la règle.
*/
const trop = await page.evaluate(() => {
  const petites: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(
    '[data-reglage] [role="switch"], [data-reglage] select, [data-reglage] input, [data-reglage] a',
  )) {
    if (el.offsetParent === null) continue;
    const minimale = el.classList.contains('cible-minimale');
    const seuil = minimale ? 24 : 44;
    const r = el.getBoundingClientRect();
    if (r.height < seuil - 0.5)
      petites.push(`${el.tagName}${minimale ? '.min' : ''} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  return petites;
});
verifier('aucune commande sous son seuil (44 px, ou 24 px pour une cible minimale)', trop, []);

/* La prémisse : sans « pointer: coarse », les hauteurs minimales du socle ne
   s'appliquent pas, et le contrôle ci-dessus passerait au vert sur un
   navigateur de bureau. */
verifier(
  'la mesure a bien lieu sur un écran tactile',
  await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
  true,
);

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
