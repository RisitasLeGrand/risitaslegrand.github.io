/**
 * Les jauges — et la largeur qu'aucune d'elles ne doit plus animer.
 *
 *   npm run essais:jauges
 *
 * **Pourquoi ce contrôle existe, et ce qu'il corrige.** L'interdit n° 4 du
 * prompt 34 proscrit l'animation de `width` : elle recalcule la mise en page à
 * chaque image. Le relevé du 14 octobre 2026 a montré que **l'infraction était
 * déjà là**, antérieure au lot : huit éléments portaient à la fois un
 * `style="width:…"` et `transition-all`, plus la barre de chargement qui
 * transitionnait `width` explicitement.
 *
 * C'est le point qui a retourné mon propre raisonnement. J'avais présenté le
 * cas 3 de l'A7 comme « ajouter un remplissage violerait l'interdit » ; en
 * réalité ne rien faire laissait l'infraction en place. Ne pas animer n'était
 * donc pas l'option prudente.
 *
 * **La parade, décidée par l'arbitrage du 14 octobre** : un mécanisme unique,
 * `transform: scaleX()` sur un élément à largeur fixe, origine à gauche.
 * `transform` est explicitement autorisé, ne recalcule pas la mise en page, et
 * n'ajoute aucun décalage.
 *
 * **Deux familles, et elles ne se confondent pas.**
 *   • Jauges de VALEUR — niveau, maîtrise, horizon, bibliothèque, sport :
 *     elles se remplissent une fois à l'arrivée, le chiffre étant déjà écrit.
 *   • Barres d'AVANCEMENT de séance — quiz, flashcards, initialisation,
 *     appariement : elles passent d'une étape à l'autre, sans remplissage
 *     d'arrivée. Leur faire jouer un remplissage à chaque question serait une
 *     animation en boucle déguisée.
 *
 * **Et une exclusion, qui ne vient pas de l'esthétique.** La jauge du tableau
 * de bord d'Odyssée mesure le temps par branche, et Psyché en est une source :
 * coffre ouvert, elle reflète une donnée du coffre. L'A7 interdit toute
 * animation explicative sur ces données. Elle migre donc au même mécanisme,
 * **sans aucune animation**.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const PLAFOND_MS = 300;

const secondes = (brut) => Number.parseFloat(String(brut)) || 0;

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 600)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};

console.log('\nJAUGES');

/* --- A. Aucune jauge n'anime ni ne transitionne « width » ---------------- */
/*
   Lu dans la source plutôt qu'à l'écran, et c'est voulu : une transition de
   largeur ne se voit qu'au moment où la valeur change, c'est-à-dire rarement
   et sur des écrans qui demandent des données. La source, elle, se lit
   entièrement.

   `transition-all` compte, et c'est tout l'intérêt : il n'écrit pas « width »,
   mais il le transitionne. Un contrôle qui chercherait le mot « width » dans
   les transitions passerait à côté de l'infraction la plus répandue.
*/

console.log('\n  A — aucune largeur animée');

const fichiers = [];
const parcourir = (d) => {
  for (const e of readdirSync(d)) {
    const c = join(d, e);
    if (statSync(c).isDirectory()) parcourir(c);
    else if (/\.(astro|svelte)$/.test(e)) fichiers.push(c);
  }
};
parcourir('src');

/** Une balise qui pose une largeur en style, sur une seule ligne de source. */
const POSE_UNE_LARGEUR = /style\s*=\s*"[^"]*\bwidth\s*:/i;
/** Une transition qui emporte la largeur, nommée ou non. */
const TRANSITIONNE_LA_LARGEUR = /\btransition-all\b|\btransition-\[width\]|transition\s*:[^;"']*\bwidth\b/i;

{
  const fautifs = [];
  for (const f of fichiers) {
    const lignes = readFileSync(f, 'utf8').split('\n');
    lignes.forEach((ligne, i) => {
      if (POSE_UNE_LARGEUR.test(ligne) && TRANSITIONNE_LA_LARGEUR.test(ligne)) {
        fautifs.push(`${f}:${i + 1}`);
      }
    });
  }
  v('aucun élément ne pose une largeur ET ne la transitionne', fautifs, []);
}

/* Et la barre de chargement, qui transitionne « width » sans le poser en
   style : elle y échapperait sans cette ligne. */
{
  const source = readFileSync('src/components/BarreProgression.astro', 'utf8');
  v(
    'la barre de chargement ne transitionne plus la largeur',
    /transition-\[width\]/.test(source),
    false,
  );
}

/*
   **Ce que les deux contrôles ci-dessus ne voyaient pas**, et c'est l'A3 du
   prompt 37. `apparier.astro` posait sa largeur par une CLASSE Tailwind (`w-0`)
   et non par un attribut `style`, tandis que son script posait un `scaleX`. La
   barre faisait donc 0 px de large à 60 % d'avancement : invisible, sans
   qu'aucune des deux expressions régulières ne s'en émeuve.

   La règle réellement en jeu n'est pas « ne pas écrire width » : c'est que tout
   élément piloté par `scaleX` emploie le mécanisme partagé, qui lui donne sa
   largeur pleine et son origine à gauche. On la vérifie donc telle quelle.
*/

console.log('\n  A bis — tout élément piloté par scaleX emploie le mécanisme');

{
  const fautifs = [];
  for (const f of fichiers) {
    const texte = readFileSync(f, 'utf8');
    /* Les identifiants pilotés : `$('barre').style.transform = …scaleX(…)` ou
       la forme longue avec getElementById, éventuellement transtypée. */
    const pilote = /(?:\$\(|getElementById\()\s*'([^']+)'[^\n]*?\.style\.transform\s*=\s*[^\n]*scaleX/g;
    for (const trouve of texte.matchAll(pilote)) {
      const id = trouve[1];
      /* La balise qui porte cet identifiant, attributs compris, sur plusieurs
         lignes : les balises sont reformatées par le formateur. */
      const balise = new RegExp(`<[a-zA-Z][^>]*\\bid=["']${id}["'][^>]*>`, 's').exec(texte);
      if (!balise) {
        /* L'identifiant n'est pas dans ce fichier : on ne conclut pas. */
        continue;
      }
      if (!/jauge-remplissage/.test(balise[0])) {
        fautifs.push(`${f} : #${id} reçoit un scaleX sans porter « jauge-remplissage »`);
      }
      if (/\bw-0\b/.test(balise[0])) {
        fautifs.push(`${f} : #${id} garde « w-0 », donc reste large de 0 px`);
      }
    }
  }
  v('aucun élément piloté par scaleX n’ignore le mécanisme partagé', fautifs, []);
}

/* --- B. Le mécanisme est partagé, pas recopié ---------------------------- */
/*
   Vingt jauges écrites chacune à sa façon, c'est vingt occasions d'oublier la
   règle. Une classe commune, et la vingt-et-unième l'hérite.
*/

console.log('\n  B — un seul mécanisme, partagé');

{
  const socle = readFileSync('src/styles/global.css', 'utf8');
  v('le socle déclare la jauge', /\.jauge\b/.test(socle), true);
  v('et son remplissage', /\.jauge-remplissage\b/.test(socle), true);
  v(
    'le remplissage est une transformation, pas une largeur',
    /\.jauge-remplissage\s*\{[^}]*transform:\s*scaleX/.test(socle),
    true,
  );
  v(
    'ancrée à gauche, sans quoi elle grandirait par le milieu',
    /\.jauge-remplissage\s*\{[^}]*transform-origin:\s*left/.test(socle),
    true,
  );
}

/* --- C. À l'écran : la jauge dit la bonne valeur ------------------------- */

console.log('\n  C — à l’écran, la proportion est juste');

/*
   **Mesuré sur l'initialisation, et c'est un choix, pas un pis-aller.** Les
   écrans à jauge de valeur — révisions, bibliothèque — renvoient un navigateur
   neuf vers l'initialisation faute de profil : y mesurer demanderait de semer
   des données, donc de mesurer ce que l'essai a lui-même écrit.
   L'initialisation, elle, affiche « n sur m » À CÔTÉ de sa jauge. Deux
   affichages du même fait, qui doivent concorder : c'est la seule façon de
   voir qu'une jauge ment, et elle ne coûte aucune donnée.
*/
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

const ouvrir = async (page, route, attendu) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  const verrou = page.locator('#champ-mdp');
  if (await verrou.isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.locator(attendu).first().waitFor({ state: 'visible', timeout: 25000 });
};

const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

await ouvrir(page, '/initialisation/', '#compteur');

{
  const lu = await page.evaluate(() => {
    const barre = document.getElementById('jauge');
    return {
      largeurEnStyle: barre.style.width,
      classe: barre.className,
      transformation: getComputedStyle(barre).transform,
    };
  });
  v('la jauge ne porte plus de largeur en style', lu.largeurEnStyle, '');
  v('elle emploie le mécanisme partagé', /jauge-remplissage/.test(lu.classe), true);
  v('et le navigateur lui calcule bien une transformation', lu.transformation !== '', true);
}

/*
   **La justesse de l'échelle se vérifie dans la source, et c'est délibéré.**

   Mesurer « l'échelle correspond au chiffre affiché » sur un écran demande d'y
   amener des données : un navigateur neuf n'a pas de profil, les écrans à
   jauge de valeur renvoient vers l'accueil, et le parcours d'accueil n'avance
   pas sans qu'on réponde. Semer ces données reviendrait à mesurer ce que
   l'essai a lui-même écrit — et la première écriture de ce contrôle passait
   « 0 = 0 » au premier écran, c'est-à-dire sans rien regarder.

   La faute réellement possible, elle, est unique et se lit entièrement : avoir
   écrit `scaleX(62)` là où il fallait `scaleX(0.62)`. Une échelle en pourcents
   donne une jauge cent fois trop large. On vérifie donc que **chaque**
   conversion divise par cent, sur les vingt sites, plutôt qu'une seule à
   l'écran.
*/

console.log('\n  C bis — chaque échelle est bien une proportion');

{
  const suspects = [];
  for (const f of fichiers) {
    const texte = readFileSync(f, 'utf8');
    /* Les parenthèses s'imbriquent — `scaleX(${Math.round(x) / 100})` — et une
       expression régulière qui s'arrête à la première fermante tronquerait
       justement le « / 100 » qu'on cherche. Ma première écriture le faisait, et
       accusait six conversions correctes. On compte donc les parenthèses. */
    for (let i = texte.indexOf('scaleX('); i !== -1; i = texte.indexOf('scaleX(', i + 1)) {
      let profondeur = 0;
      let fin = i + 7;
      for (; fin < texte.length; fin += 1) {
        if (texte[fin] === '(') profondeur += 1;
        else if (texte[fin] === ')') {
          if (profondeur === 0) break;
          profondeur -= 1;
        }
      }
      const expr = texte.slice(i + 7, fin).trim();
      // Une constante : 0 et 1 sont les bornes légitimes.
      if (/^\$?\{?\s*-?\d+(\.\d+)?\s*\}?$/.test(expr)) {
        const valeur = Number.parseFloat(expr.replace(/[${}]/g, ''));
        if (valeur < 0 || valeur > 1) suspects.push(`${f} : scaleX(${expr})`);
        continue;
      }
      /*
         Une expression : elle DIVISE, et son `× 100` éventuel est défait.

         Trois écritures se sont succédé ici, et les deux premières étaient
         fausses. Je les laisse écrites parce que le chemin dit la règle mieux
         que la règle seule.

         1. Une LISTE DE DIVISEURS nommés — `/ 100`, `/ x.length`,
            `/ questions`, `/ file`, `/ ecrans`, `/ reglages`. Elle a accusé
            une conversion juste dès qu'un site neuf est arrivé :
            `scaleX(faits / enJeu.essais)` est une proportion par construction,
            mais son diviseur n'était pas dans la liste. Une liste de noms ne
            se tient pas à jour toute seule, et un faux positif finit par faire
            désactiver le contrôle entier.

         2. « IL SUFFIT QU'ELLE DIVISE ». Un sabotage l'a démentie dans la
            minute : `scaleX(Math.round((a / b) * 100))` divise, et reste cent
            fois trop large.

         3. Celle-ci. La multiplication par cent est permise à UNE condition,
            qu'elle soit défaite : `Math.round(x * 100) / 100` est l'arrondi à
            deux décimales employé par huit sites, et il rend bien une
            proportion. Un `× 100` sans `/ 100` est la faute visée.
      */
      if (!expr.includes('/') || (/\*\s*100\b/.test(expr) && !/\/\s*100\b/.test(expr))) {
        suspects.push(`${f} : scaleX(${expr})`);
      }
    }
  }
  v('aucune échelle n’est écrite en pourcents', suspects, []);
}

/* --- D. Sous mouvement réduit, aucun remplissage animé ------------------- */

console.log('\n  D — sous mouvement réduit, la valeur est posée, pas remplie');

{
  const sobre = await nav.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const s = await sobre.newPage();
  await ouvrir(s, '/initialisation/', '#compteur');
  const lu = await s.evaluate(() => {
    const c = getComputedStyle(document.getElementById('jauge'));
    return { duree: c.transitionDuration, animation: c.animationName, ad: c.animationDuration };
  });
  v('aucune transition ne court', secondes(lu.duree) <= 0.001, true);
  v(
    'et aucune animation de remplissage',
    lu.animation === 'none' || secondes(lu.ad) <= 0.001,
    true,
  );
  await sobre.close();
}

/* --- E. La jauge d'Odyssée n'anime rien du tout -------------------------- */
/*
   Elle reflète une donnée du coffre quand il est ouvert. L'exclusion n'est pas
   une préférence : c'est l'A7 qui l'impose.
*/

console.log('\n  E — la jauge d’Odyssée, sous coffre, n’anime rien');

{
  const source = readFileSync('src/pages/odyssee/index.astro', 'utf8');
  v('elle emploie le mécanisme partagé', /jauge-remplissage/.test(source), true);
  v(
    'et elle est marquée « sans animation »',
    /jauge-sans-animation/.test(source),
    true,
  );
  const socle = readFileSync('src/styles/global.css', 'utf8');
  v(
    'le socle neutralise cette variante',
    /\.jauge-sans-animation[^{]*\{[^}]*transition:\s*none/.test(socle),
    true,
  );
}

/* --- F. Le remplissage d'arrivée, OBSERVÉ (A2 du prompt 37) -------------- */
/*
   **Ce que les sections précédentes ne disaient pas.** Elles vérifient que le
   mécanisme est en place et que l'échelle est juste. Aucune ne regardait si la
   jauge se remplit réellement — et elle ne se remplissait jamais : la valeur
   était posée pendant que le conteneur était caché, ou l'élément créé avec sa
   valeur. Le navigateur n'a alors aucun état de départ à interpoler.

   **On échantillonne la transformation calculée pendant le remplissage.** Une
   jauge qui saute à sa valeur est à 0,8 dès la première mesure ; une jauge qui
   se remplit est quelque part entre les deux. C'est la seule observation qui
   distingue les deux cas — lire la feuille de style ne l'aurait pas fait, et
   c'est précisément l'erreur que ce lot corrige ailleurs.

   **Portée de ce contrôle, dite franchement.** Il éprouve le MÉCANISME, sur un
   élément inséré dans une vraie page et donc soumis au vrai socle, selon les
   deux scénarios constatés (révélation d'un conteneur caché, insertion déjà à
   la valeur). Il n'éprouve pas les écrans eux-mêmes, qui demandent un profil et
   des données : c'est la section A bis qui garantit que leurs jauges portent
   bien la classe. Les deux ensemble couvrent la chaîne ; ni l'une ni l'autre
   seule.
*/

console.log('\n  F — le remplissage d’arrivée, observé');

/** Insère une jauge comme le font les écrans, la révèle, et échantillonne. */
const observerLeRemplissage = async (p, classes, { creerDejaVisible = false } = {}) =>
  p.evaluate(
    async ([classes, creerDejaVisible]) => {
      const dehors = document.createElement('div');
      dehors.id = 'essai-jauge-boite';
      if (!creerDejaVisible) dehors.style.display = 'none';
      document.body.append(dehors);
      /* La piste, puis le remplissage : la même forme que la bibliothèque. */
      dehors.innerHTML =
        '<div style="width:200px" class="overflow-hidden rounded-full">' +
        `<div id="essai-jauge" class="h-1.5 ${classes}" style="transform:scaleX(0.8)"></div>` +
        '</div>';
      const jauge = document.getElementById('essai-jauge');
      if (!creerDejaVisible) {
        /* Le conteneur était caché quand la valeur a été posée : on révèle,
           exactement comme le tableau de bord des révisions. */
        dehors.style.display = 'block';
      }
      const echelle = () => {
        const m = new DOMMatrixReadOnly(echelleCalculee(jauge));
        return m.a;
      };
      function echelleCalculee(e) {
        const t = getComputedStyle(e).transform;
        return t === 'none' ? 'matrix(1,0,0,1,0,0)' : t;
      }
      const duree = getComputedStyle(jauge).transitionDuration;
      const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
      await attendre(60);
      const tot = echelle();
      await attendre(500);
      const tard = echelle();
      dehors.remove();
      return { tot, tard, duree };
    },
    [classes, creerDejaVisible],
  );

{
  const ctxF = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pf = await ctxF.newPage();
  await pf.goto(`${RACINE}/`, { waitUntil: 'networkidle' });

  /* 1. Conteneur révélé — le cas du tableau de bord des révisions. */
  const revele = await observerLeRemplissage(pf, 'jauge-remplissage');
  v(
    `révélation d’un conteneur caché : la jauge est EN COURS à 60 ms (${revele.tot.toFixed(3)})`,
    revele.tot > 0.02 && revele.tot < 0.7,
    true,
  );
  v(
    `et elle atteint sa valeur (${revele.tard.toFixed(3)})`,
    Math.abs(revele.tard - 0.8) < 0.02,
    true,
  );
  v(
    `son remplissage ne dépasse pas 300 ms (${revele.duree})`,
    Math.max(...String(revele.duree).split(',').map((x) => secondes(x))) <= 0.3,
    true,
  );

  /* 2. Élément créé déjà visible, à sa valeur — le cas de la bibliothèque. */
  const insere = await observerLeRemplissage(pf, 'jauge-remplissage', {
    creerDejaVisible: true,
  });
  v(
    `insertion déjà à la valeur : la jauge est EN COURS à 60 ms (${insere.tot.toFixed(3)})`,
    insere.tot > 0.02 && insere.tot < 0.7,
    true,
  );

  /* 3. Une barre de SÉANCE ne joue pas de remplissage d'arrivée : elle passe
        d'une étape à la suivante, et un remplissage à chaque question serait
        une animation en boucle déguisée. */
  const seance = await observerLeRemplissage(pf, 'jauge-remplissage jauge-seance');
  v(
    `une barre de séance, elle, est posée d’emblée (${seance.tot.toFixed(3)})`,
    Math.abs(seance.tot - 0.8) < 0.02,
    true,
  );

  /* 4. Et la jauge exclue — celle d'Odyssée — n'anime rien non plus. */
  const sansAnimation = await observerLeRemplissage(
    pf,
    'jauge-remplissage jauge-sans-animation',
  );
  v(
    `la jauge « sans animation » reste posée (${sansAnimation.tot.toFixed(3)})`,
    Math.abs(sansAnimation.tot - 0.8) < 0.02,
    true,
  );

  await ctxF.close();

  /* 5. Sous mouvement réduit, la valeur est posée, pas remplie. */
  const sobreF = await nav.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const ps = await sobreF.newPage();
  await ps.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
  const sobreLu = await observerLeRemplissage(ps, 'jauge-remplissage');
  v(
    `sous mouvement réduit, la jauge est posée d’emblée (${sobreLu.tot.toFixed(3)})`,
    Math.abs(sobreLu.tot - 0.8) < 0.02,
    true,
  );
  await sobreF.close();
}

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
