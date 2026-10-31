/**
 * LE TÉMOIN DE SYNCHRONISATION DIT SON ÉTAT AUTREMENT QUE PAR LA COULEUR
 * (E2 du prompt 43).
 *
 *   SITE_PASSWORD=… npm run essais:temoin-sync:navigateur
 *
 * ## Les deux défauts mesurés le 25 octobre
 *
 * 1. **L'état ne changeait jamais.** `surEtat` existait dans `OptionsVeille`
 *    et personne ne le passait : la mise en page lisait `veille.etat()` UNE
 *    FOIS, à l'ouverture du coffre. Le témoin portait donc, pour le reste de
 *    la vie de la page, l'état qu'avait la veille à cet instant — alors qu'il
 *    porte `aria-live="polite"`, c'est-à-dire la promesse d'être annoncé.
 *    « Synchronisation en cours » ne s'affichait que si l'ouverture du coffre
 *    tombait pendant un échange ; un échec survenu après restait invisible.
 * 2. **Les trois états étaient le même point de 8 px**, ne différant que par
 *    la teinte. Vert contre orange est le couple que la deutéranopie confond,
 *    et c'est « tout va bien » contre « la dernière synchronisation a
 *    échoué ». Mesurés sur le fond clair : 2,54:1 et 2,15:1, sous le 3:1 de
 *    WCAG 1.4.11.
 *
 * ## Pourquoi cet essai n'a pas besoin de certifier un appareil
 *
 * Parce que l'état est devenu DÉCLARATIF. La veille l'émet par un événement
 * du document, et la mise en page le pose en `data-etat` ; l'essai émet donc
 * le même événement. Il mesure ainsi la chaîne réelle — l'abonnement de la
 * mise en page, le peintre, la feuille de style —, et la seule chose qu'il ne
 * couvre pas est que la veille émette : c'est `surEtat` dans `veille.ts`, et
 * `essais:moteur-veille` mesure que le moteur l'appelle.
 *
 * ## Les deux modes, et la prémisse qui s'est révélée nécessaire
 *
 * Ma première sonde a mesuré DEUX FOIS le mode sombre sans s'en apercevoir :
 * `colorScheme` de Playwright ne pose que `prefers-color-scheme`, et Cyclades
 * ne le consulte que si l'on a choisi « systeme » — par défaut il bascule sur
 * l'heure, et l'heure du conteneur donnait la nuit. On pose donc le réglage de
 * l'application, et on REFUSE de mesurer si `data-theme` n'a pas pris.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { contraste } from './lib/couleurs.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const EVENEMENT = 'revinsp:veille-etat';

/* Les trois états affichables, et le mot que chacun doit dire. */
const ETATS = [
  ['en-veille', /en veille/i],
  ['en-cours', /en cours/i],
  ['echec', /échec/i],
];

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;

function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  ${rouge('✗')} ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
}
const vrai = (quoi, condition) => verifier(quoi, condition, true);

/*
   LA COMPOSITION DES COULEURS EST RENDUE AU NAVIGATEUR, et mon premier essai
   a mesuré 0,00:1 pour l'avoir faite à la main : le fond de l'en-tête est
   `bg-white/90`, que Chromium rend `oklab(0.999994 … / 0.9)` et non `rgb()`.
   Mon expression régulière n'y reconnaissait rien, et six constats disaient
   « sous 3:1 » là où le vrai grief était « je n'ai pas su lire ».

   Une toile de 1 × 1 pixel : on peint le dessous, puis la marque par-dessus,
   et on relit le pixel. N'importe quelle syntaxe de couleur passe — `oklab`,
   `oklch`, `color-mix` —, l'alpha se compose exactement comme à l'écran, et
   il n'y a plus de table de conversion à tenir.
*/
const enSRVB = (page, couleur, dessous) =>
  page.evaluate(([c, d]) => {
    const toile = document.createElement('canvas');
    toile.width = 1;
    toile.height = 1;
    const ctx = toile.getContext('2d');
    if (!ctx) return null;
    for (const teinte of [d, c]) {
      if (!teinte) continue;
      ctx.fillStyle = teinte;
      ctx.fillRect(0, 0, 1, 1);
    }
    const [r, v, b] = ctx.getImageData(0, 0, 1, 1).data;
    const h = (x) => x.toString(16).padStart(2, '0');
    return `#${h(r)}${h(v)}${h(b)}`;
  }, [couleur, dessous]);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

console.log('\nLE TÉMOIN DE SYNCHRONISATION : UNE FORME PAR ÉTAT\n');

for (const mode of ['clair', 'sombre']) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
  await page.addInitScript((m) => {
    try {
      localStorage.setItem('revinsp.bascule-jour-nuit', 'non');
      localStorage.setItem('revinsp.theme', m);
    } catch {
      /* Mode privé : la prémisse ci-dessous le dira. */
    }
  }, mode);

  await franchirInitialisation(page, RACINE, MDP);
  /*
     PAS L'ACCUEIL. Le témoin vit dans l'en-tête COMPLET, et l'accueil porte
     le « menu de garde » (`entete="leger"`), qui n'en a pas — pas plus que du
     centre de notifications, et pour la même raison : on est au-dessus des
     branches, on n'y fait rien. Mon premier passage a donc attendu quarante
     secondes un élément qui n'existe pas sur cette page, et s'est arrêté sur
     un délai expiré au lieu d'un constat.
  */
  await page.goto(`${RACINE}/statistiques/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#temoin-sync', { state: 'attached', timeout: 40000 });

  console.log(`── MODE ${mode.toUpperCase()}`);
  const theme = await page.getAttribute('html', 'data-theme');
  verifier(`prémisse : le thème demandé est bien posé`, theme, mode);
  if (theme !== mode) {
    console.log('      (rien n’est mesuré pour ce mode : la mesure serait celle de l’autre)');
    await ctx.close();
    continue;
  }

  /*
     SANS APPAREIL CERTIFIÉ, LE TÉMOIN EST CACHÉ, et ce n'est pas un oubli :
     « non certifié », « sans appairage » et « sans mot de passe » sont des
     réponses à une question que personne n'a posée. On le constate, parce que
     c'est le point de départ de tout le reste.
  */
  vrai(
    'au repos, le témoin est caché',
    await page.locator('#temoin-sync').evaluate((e) => e.classList.contains('hidden')),
  );

  /*
     L'ABONNEMENT EST POSÉ DANS UN MODULE CHARGÉ PARESSEUSEMENT, à l'ouverture
     du coffre : on attend qu'il réponde, et on ne se contente pas d'un délai.
     Un essai qui émettrait trop tôt mesurerait l'absence d'abonnement et
     l'appellerait un défaut du témoin.
  */
  const emettre = (etat) =>
    page.evaluate(
      ([ev, et]) => document.dispatchEvent(new CustomEvent(ev, { detail: { etat: et } })),
      [EVENEMENT, etat],
    );
  let abonne = false;
  for (let i = 0; i < 40 && !abonne; i += 1) {
    await emettre('en-veille');
    await page.waitForTimeout(500);
    abonne = (await page.getAttribute('#temoin-sync', 'data-etat')) === 'en-veille';
  }
  vrai('la mise en page s’abonne à l’état de la veille', abonne);
  if (!abonne) {
    console.log('      (la suite ne se mesure pas : rien ne reçoit l’état)');
    await ctx.close();
    continue;
  }

  const silhouettes = new Map();
  for (const [etat, mot] of ETATS) {
    await emettre(etat);
    await page.waitForTimeout(350);

    const m = await page.evaluate(() => {
      const temoin = document.getElementById('temoin-sync');
      const pastille = document.getElementById('pastille-sync');
      const s = getComputedStyle(pastille);
      /* Le fond RÉELLEMENT derrière la pastille, en remontant les parents
         jusqu'au premier qui en peint un : la pastille n'a pas le sien. */
      let n = pastille.parentElement;
      let fond = '';
      while (n && !fond) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba?\([^)]*,\s*0\s*\)/.test(c) && c !== 'transparent') fond = c;
        n = n.parentElement;
      }
      const b = pastille.getBoundingClientRect();
      return {
        cache: temoin.classList.contains('hidden'),
        etatPose: temoin.getAttribute('data-etat'),
        mot: document.getElementById('texte-sync').textContent ?? '',
        titre: temoin.getAttribute('title') ?? '',
        fond: fond || 'rgb(255,255,255)',
        remplissage: s.backgroundColor,
        bordure: s.borderTopWidth,
        couleurBordure: s.borderTopColor,
        rayon: s.borderRadius,
        decoupe: s.clipPath,
        taille: [Math.round(b.width), Math.round(b.height)],
      };
    });

    vrai(`${etat} : le témoin paraît`, !m.cache);
    verifier(`${etat} : l’état est lisible dans le DOM`, m.etatPose, etat);
    vrai(`${etat} : il le dit en toutes lettres`, mot.test(m.mot) && mot.test(m.titre));
    vrai(`${etat} : la pastille mesure au moins 10 px`, Math.min(...m.taille) >= 10);

    /*
       LA SILHOUETTE, et non la couleur : le remplissage est volontairement
       absent de la signature. Trois états qui ne différeraient que par la
       teinte donneraient trois signatures identiques, et c'est exactement le
       défaut que ce lot corrige.
    */
    const signature = `${m.rayon}|${m.bordure}|${m.decoupe}`;
    silhouettes.set(etat, signature);

    /* La marque porte du sens : 3:1 sur le fond qu'elle occupe (WCAG 1.4.11).
       Pour l'anneau, c'est la BORDURE qui dessine, le fond étant retiré. */
    /*
       « TRANSPARENT » SE CONSTATE, IL NE SE DEVINE PAS SUR LA CHAÎNE, et mon
       premier essai a rendu un FAUX VERT pour l'avoir deviné. J'avais écrit
       `/rgba?\([^)]*,\s*0\s*\)/`, censé reconnaître un `rgba(r, v, b, 0)` —
       mais il file aussi sur `rgb(138, 75, 0)`, c'est-à-dire sur TOUTE couleur
       dont le canal bleu vaut zéro. Or l'alerte du thème clair est `#8A4B00`.
       L'essai mesurait donc la bordure à la place du remplissage, trouvait un
       presque-noir à 18,78:1, et annonçait un triangle conforme.

       On compose la couleur sur deux fonds opposés : si le blanc reste blanc
       ET le noir reste noir, rien n'a été peint. Aucune syntaxe à analyser, et
       une demi-transparence ne passe plus pour une transparence.
    */
    const surBlanc = await enSRVB(page, m.remplissage, '#ffffff');
    const surNoir = await enSRVB(page, m.remplissage, '#000000');
    const transparent = surBlanc === '#ffffff' && surNoir === '#000000';
    const marque = await enSRVB(page, transparent ? m.couleurBordure : m.remplissage, m.fond);
    const fond = await enSRVB(page, m.fond, '#ffffff');
    const x = marque && fond ? contraste(marque, fond) : 0;
    vrai(
      `${etat} : la marque tient 3:1 sur son fond (${marque} sur ${fond}, ${x.toFixed(2)}:1)`,
      x >= 3,
    );
  }

  /*
     LE CONSTAT QUI PORTE LE LOT : trois états, trois silhouettes. S'il en
     manque une, deux états se ressemblent, et celui qui ne distingue pas les
     teintes ne les distingue pas du tout.
  */
  verifier(
    'les trois états ont trois silhouettes distinctes',
    new Set(silhouettes.values()).size,
    3,
  );
  if (new Set(silhouettes.values()).size !== 3) {
    for (const [etat, sig] of silhouettes) console.log(`        ${etat} → ${sig}`);
  }

  /* Et un état d'attente le recache, sans laisser d'état mort dans le DOM. */
  await emettre('non-certifie');
  await page.waitForTimeout(350);
  const apres = await page.evaluate(() => {
    const t = document.getElementById('temoin-sync');
    const p = document.getElementById('pastille-sync');
    return {
      cache: t.classList.contains('hidden'),
      /* LES DEUX : la pastille porte la forme, et mon premier jet ne nettoyait
         que le conteneur — un état mort sur la pastille aurait reparu tel quel
         au prochain affichage, avant la peinture. L'essai ne regardait que le
         conteneur, et ne l'aurait donc jamais dit. */
      etats: [t.getAttribute('data-etat'), p.getAttribute('data-etat')],
    };
  });
  vrai('un état d’attente recache le témoin', apres.cache);
  verifier('et ne laisse pas d’état mort dans le DOM', apres.etats, [null, null]);

  verifier('aucune erreur de page', erreurs.slice(0, 3), []);
  await ctx.close();
}

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('Le témoin dit son état par sa forme, dans les deux modes.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
