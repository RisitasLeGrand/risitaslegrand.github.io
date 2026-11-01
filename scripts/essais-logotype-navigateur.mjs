/**
 * LE LOGOTYPE DANS LA PAGE VIVANTE (prompt 65).
 *
 *   SITE_PASSWORD=… npm run essais:logotype:navigateur
 *
 * ## Ce qui s'éprouve ici, et ce qui s'éprouve déjà ailleurs
 *
 * `essais:logotype` tient dix-neuf gardes SANS navigateur, en millisecondes :
 * le nom lu une fois dans le balisage rendu, la place réservée, les polices par
 * jeton, aucun appel au réseau, et les 25 combinaisons thème × mode au-dessus
 * de 4,5:1. Rien de cela n'est repris.
 *
 * Restent les quatre choses qu'un balisage rendu hors page ne peut pas montrer :
 *
 *  1. le logotype est RÉELLEMENT aux trois endroits — deux en-têtes et le
 *     voile — et non seulement disponible ;
 *  2. le nom accessible de chaque lien le dit UNE fois : l'en-tête complet
 *     porte déjà « Menu de Cyclades » en `sr-only`, donc son logotype doit
 *     être muet, quand celui de l'en-tête léger doit se nommer. Deux
 *     emplacements voisins, deux réponses contraires — c'est le genre de
 *     détail qu'on croit juste et qu'on ne vérifie qu'une fois ;
 *  3. la mise en page ne SAUTE pas, ni au chargement des polices ni pendant
 *     une navigation. C'est la promesse du `viewBox`, et elle ne se mesure
 *     qu'en regardant bouger une vraie page ;
 *  4. le logotype se voit : il a une surface, il est peint, et il tient le
 *     contraste là où il est réellement posé — un jeton juste sur un fond
 *     inattendu donne un logotype invisible, et c'est exactement ce qui est
 *     arrivé à ma première planche.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

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

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/** Le rapport de contraste WCAG entre deux couleurs « rgb(r, v, b) ». */
function contraste(a, b) {
  const canal = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  /* Un TRIPLET sur 255, jamais une chaîne CSS : la conversion est faite dans
     la page, par un canevas, et c'est délibéré — voir le bloc du contraste. */
  const lum = ([r, v, bl]) => 0.2126 * canal(r) + 0.7152 * canal(v) + 0.0722 * canal(bl);
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

console.log('\nLE LOGOTYPE « CYCLADES » DANS LA PAGE\n');

/* ── 1. Le logotype est là, dans les deux en-têtes ──────────────────────── */

console.log('IL EST AUX ENDROITS OÙ ON L’A POSÉ');

const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
await franchirInitialisation(page, RACINE, MDP);

/*
   DEUX PAGES, et il en faut deux : la mise en page choisit l'en-tête COMPLET
   ou le LÉGER selon l'écran, et `enteteVoulu` est calculé au rendu. Mesurer
   une seule page laisserait l'autre en-tête sans garde — or les deux portent
   un logotype, et avec des règles d'accessibilité CONTRAIRES.
*/
async function enteteDe(chemin) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('header', { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const visibles = [...document.querySelectorAll('header [data-logotype]')].filter(
      (e) => e.getClientRects().length > 0,
    );
    return visibles.map((svg) => {
      const lien = svg.closest('a, span.flex, span');
      const r = svg.getBoundingClientRect();
      return {
        variante: svg.getAttribute('data-logotype'),
        nomme: svg.getAttribute('aria-label'),
        muet: svg.getAttribute('aria-hidden') === 'true',
        role: svg.getAttribute('role'),
        largeur: Math.round(r.width),
        hauteur: Math.round(r.height),
        texteDuLien: (lien?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        dansUnLien: lien?.tagName === 'A',
      };
    });
  });
}

/*
   TROIS PAGES POUR TROIS EMPLACEMENTS, et c'est un relevé qui l'a imposé : ma
   première écriture ne visitait que l'accueil, y trouvait UN logotype, et
   déclarait le nom bien dit. Les deux autres emplacements — dont celui dont la
   règle est CONTRAIRE — n'étaient pas mesurés du tout.

   - « / » rend l'en-tête léger SANS lien : le logotype y est seul porteur du
     nom, donc il se nomme ;
   - « /profil/ » rend l'en-tête léger AVEC lien, dont le `sr-only` ne dit que
     « — revenir au menu » : le logotype doit se nommer, sinon le lien
     s'annonce sans dire de quoi ;
   - « /revisions/ » rend l'en-tête COMPLET, dont le lien porte déjà « Menu de
     Cyclades » : là le logotype doit être MUET, sans quoi le nom est dit deux
     fois.

   Une seule de ces trois règles tient par accident si on ne mesure qu'une page.
*/
const EMPLACEMENTS = [
  { chemin: '/', quoi: 'en-tête léger, sans lien', nomme: true, dansUnLien: false },
  { chemin: '/profil/', quoi: 'en-tête léger, avec lien', nomme: true, dansUnLien: true },
  { chemin: '/revisions/', quoi: 'en-tête complet', nomme: false, dansUnLien: true },
];

for (const emplacement of EMPLACEMENTS) {
  const vus = await enteteDe(emplacement.chemin);
  verifier(`${emplacement.quoi} : un logotype visible`, vus.length, 1);
  if (!vus.length) continue;
  const [l] = vus;
  verifier(`${emplacement.quoi} : c’est la variante choisie`, l.variante, 'mot');
  verifier(`${emplacement.quoi} : il a une surface réelle`, l.largeur > 40 && l.hauteur > 10, true);
  verifier(
    `${emplacement.quoi} : ${emplacement.nomme ? 'il se nomme' : 'il est MUET'}`,
    { nomme: l.nomme === 'Cyclades' && l.role === 'img', muet: l.muet },
    { nomme: emplacement.nomme, muet: !emplacement.nomme },
  );
}

/* ── 2. Le nom est dit une fois, et une seule ───────────────────────────── */

console.log('\nLE NOM EST DIT UNE FOIS, ET UNE SEULE');

/*
   On compte les occurrences de « Cyclades » dans le NOM ACCESSIBLE de l'élément
   qui porte le logotype — ce que le lecteur d'écran annoncera. Compter dans le
   balisage ne suffirait pas : `role="img"` tait les descendants, un `sr-only`
   les ajoute, et seul le nom calculé dit ce qui sort vraiment.
*/
/*
   C'EST L'ARBRE D'ACCESSIBILITÉ DU NAVIGATEUR QU'ON LIT, et non une
   reconstitution. Ma première écriture parcourait les enfants du lien et
   additionnait leurs textes en sautant ceux marqués `aria-hidden`. Elle a
   compté « Cyclades » DEUX fois dans l'en-tête complet — parce que le logotype
   y est enveloppé d'un `<span>` qui, lui, n'est pas caché : mon addition
   descendait dans le texte du SVG sans voir que le SVG, lui, est muet.

   Le navigateur, lui, ne s'y trompe pas : un sous-arbre `aria-hidden` ne
   contribue à aucun nom. `page.accessibility.snapshot()` rend ce que la
   technologie d'assistance recevra, et c'est la seule mesure qui réponde à la
   question posée — « le nom est-il dit une fois ? ».
*/
let porteursExamines = 0;
for (const emplacement of EMPLACEMENTS) {
  await enteteDe(emplacement.chemin);
  /*
     ON INTERROGE LE PORTEUR, ET NON LA PAGE ENTIÈRE.

     Ma première lecture balayait tout l'arbre à la recherche de « Cyclades »,
     et comptait dix-neuf « porteurs » sur la page Profil — dont « Ce que
     Cyclades sait de vous », qui est de la prose. La question posée n'est pas
     « combien de fois le mot paraît-il dans la page », mais « le lien qui
     porte le logotype le dit-il une fois ». On marque donc le porteur, puis on
     demande SON nœud.

     Par le protocole Chromium : `page.accessibility` a disparu de Playwright,
     mais `Accessibility.queryAXTree` rend le nœud que le navigateur calcule et
     que la technologie d'assistance reçoit — un sous-arbre `aria-hidden` n'y
     contribue à aucun nom, ce que ma reconstitution précédente ignorait.
  */
  const marque = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('header [data-logotype]')].find(
      (e) => e.getClientRects().length > 0,
    );
    if (!svg) return false;
    (svg.closest('a') ?? svg.parentElement).setAttribute('data-porteur-logotype', '');
    return true;
  });
  verifier(`${emplacement.quoi} : le porteur du logotype est trouvé`, marque, true);
  if (!marque) continue;

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '[data-porteur-logotype]',
  });
  const { nodes } = await cdp.send('Accessibility.queryAXTree', { nodeId });
  await cdp.detach();

  const noms = nodes
    .filter((n) => !n.ignored && (n.name?.value ?? '').trim())
    .map((n) => ({ role: n.role?.value ?? '?', nom: n.name.value.trim() }));

  porteursExamines += 1;
  /*
     C'EST LE NOM DU PORTEUR QUI COMPTE, ET LUI SEUL.

     J'ai d'abord exigé qu'aucun descendant ne redise le nom, et les trois
     emplacements ont rougi sur des nœuds « StaticText » et « InlineTextBox ».
     Ce n'étaient pas des redites : ce sont les nœuds DONT le nom du porteur
     est composé. J'avais pris la construction d'un nom pour sa répétition.

     Un lecteur d'écran annonce le lien par son nom, une fois. La question est
     donc : ce nom dit-il « Cyclades » une fois ? Et cela suffit à attraper la
     faute visée — si le logotype de l'en-tête complet cessait d'être muet, le
     nom deviendrait « Cyclades Menu de Cyclades », et le compte passerait à
     deux. Le sabotage le vérifie plutôt que de me croire sur parole.
  */
  const [porteur] = noms;
  const foisAuPorteur = ((porteur?.nom ?? '').match(/Cyclades/g) ?? []).length;
  verifier(
    `${emplacement.quoi} : « ${porteur?.nom ?? '(sans nom)'} »`,
    foisAuPorteur,
    1,
  );
}
verifier('prémisse : les trois emplacements ont été examinés', porteursExamines, 3);

/* ── 3. Il se voit : contraste mesuré là où il est posé ─────────────────── */

console.log('\nIL SE VOIT, LÀ OÙ IL EST POSÉ');

/*
   LA COULEUR EST CONVERTIE PAR LE NAVIGATEUR, et c'est un rouge qui l'a
   imposé. Ma première écriture lisait la couleur calculée et la découpait à
   coups de nombres : Tailwind 4 rend `oklab(0.246814 -0.012729 -0.0370675 /
   0.9)`, dont mon analyseur tirait « 0,24 ; 0,01 ; 0,04 » comme s'il
   s'agissait de canaux sur 255. Le rapport annoncé — 17,77:1 — ne voulait
   RIEN DIRE, et il était vert.

   Un canevas 2D, lui, normalise n'importe quelle couleur CSS en sRGB : on la
   lui donne, on relit le pixel. Et comme ce fond-là n'est pas opaque — l'en-
   tête est en `bg-white/90` avec un flou d'arrière-plan —, les couches sont
   COMPOSÉES de la plus extérieure à la plus intérieure avant d'être mesurées.
   Prendre la première couche non transparente, comme je le faisais, aurait
   mesuré une couleur que personne ne voit.
*/
const vu = await page.evaluate(() => {
  const toile = document.createElement('canvas');
  toile.width = toile.height = 1;
  const d = toile.getContext('2d', { willReadFrequently: true });

  /** Une couleur CSS quelconque, rendue en sRGB opaque sur un fond donné. */
  const composer = (couches) => {
    d.clearRect(0, 0, 1, 1);
    d.fillStyle = '#ffffff';
    d.fillRect(0, 0, 1, 1);
    for (const c of couches) {
      d.fillStyle = c;
      d.fillRect(0, 0, 1, 1);
    }
    const [r, v, b] = d.getImageData(0, 0, 1, 1).data;
    return [r, v, b];
  };

  const svg = [...document.querySelectorAll('header [data-logotype]')].find(
    (e) => e.getClientRects().length > 0,
  );
  const texte = svg.querySelector('text');
  /* Pas de `<text>` : le logotype n'est plus un SVG. On rend des couleurs
     identiques plutôt que de lever — le rapport vaudra 1:1, et la garde dira
     ce qui manque au lieu de tuer l'essai. */
  if (!texte) return { couches: 0, fond: [255, 255, 255], mot: [255, 255, 255], fillBrut: '(pas de <text>)' };

  /* Les fonds, du plus extérieur au plus intérieur : c'est l'ordre dans lequel
     le navigateur les peint, donc l'ordre dans lequel il faut les composer. */
  const couches = [];
  for (let n = svg.parentElement; n; n = n.parentElement) {
    const f = getComputedStyle(n).backgroundColor;
    if (f && !/transparent/.test(f) && !/,\s*0\s*\)$/.test(f)) couches.unshift(f);
  }
  return {
    couches: couches.length,
    fond: composer(couches),
    mot: composer([...couches, getComputedStyle(texte).fill]),
    fillBrut: getComputedStyle(texte).fill,
  };
});

verifier('prémisse : au moins un fond est peint derrière le logotype', vu.couches >= 1, true);
/* Et le mot n'est pas la couleur du fond : un `fill` qui n'aurait pas pris —
   le jeton vide de ma planche fausse — donnerait ici deux couleurs proches, et
   le rapport le dirait. Ce contrôle existe pour que la prémisse ne soit pas
   seule à tenir. */
const rapport = contraste(vu.mot, vu.fond);
verifier(
  `le mot tient 4,5:1 là où il est posé (${rapport.toFixed(2)}:1,` +
    ` rgb(${vu.mot}) sur rgb(${vu.fond}))`,
  rapport >= 4.5,
  true,
);

/*
   LA BOÎTE EXISTE, ET C'EST ELLE QUI RÉSERVE LA PLACE.

   Contrôle posé AVANT les deux suivants, parce qu'ils le supposent : ils
   lisent `querySelector('text')` et `getAttribute('viewBox')`, et sur un
   logotype qui ne serait plus un SVG — remplacé par du texte HTML, le défaut
   même que ce dessin existe pour éviter — ils LÈVENT au lieu de rougir. Le
   sabotage 6 a rendu « PLANTAGE, zéro croix » : verdict juste, message
   inutile.

   C'est aussi la garde qui nomme la promesse : un `<svg>` à `viewBox` a un
   rapport de forme intrinsèque, donc une boîte connue avant que la police
   n'arrive. Le même mot en HTML mesurerait Arial pendant le chargement puis
   Public Sans.
*/
const boite = await page.evaluate(() => {
  const e = [...document.querySelectorAll('header [data-logotype]')].find(
    (n) => n.getClientRects().length > 0,
  );
  return e
    ? { balise: e.tagName.toLowerCase(), viewBox: e.getAttribute('viewBox') ?? '(aucun)' }
    : { balise: '(introuvable)', viewBox: '(aucun)' };
});
verifier(
  `le logotype est un SVG à viewBox (${boite.balise}, « ${boite.viewBox} »)`,
  { balise: boite.balise, aUnViewBox: /^0 0 \d+ \d+$/.test(boite.viewBox) },
  { balise: 'svg', aUnViewBox: true },
);

/*
   LE MOT REMPLIT SA BOÎTE, et c'est un sabotage qui a écrit cette garde.

   J'avais écrit que `textLength` « achevait la promesse » de la place
   réservée. Retiré, il ne décale RIEN : la boîte est tenue par le `viewBox`
   seul, et la garde du décalage est restée verte. Ma documentation était
   fausse sur ce point.

   Ce que `textLength` tient vraiment, c'est le remplissage : sans lui, le mot
   composé dans Arial et le mot composé dans Public Sans n'occupent pas la même
   largeur, et le logotype ballotte dans sa place — ou en déborde — selon la
   police servie. Le dessin change bien que la boîte ne bouge pas, ce qui est
   exactement le genre de défaut qu'on ne voit que chez quelqu'un d'autre, dont
   la police n'a pas chargé.
*/
const remplissage = await page.evaluate(() => {
  const svg = [...document.querySelectorAll('header [data-logotype]')].find(
    (e) => e.getClientRects().length > 0,
  );
  const texte = svg.querySelector('text');
  const vb = svg.getAttribute('viewBox');
  if (!texte || !vb) return { part: null, largeurBoite: 0, largeurMot: 0 };
  const [, , largeurBoite] = vb.split(' ').map(Number);
  return {
    part: texte.getBBox().width / largeurBoite,
    largeurBoite,
    largeurMot: Math.round(texte.getBBox().width),
  };
});
verifier(
  `le mot remplit la largeur annoncée` +
    ` (${remplissage.largeurMot} sur ${remplissage.largeurBoite} unités)`,
  remplissage.part !== null && Math.abs(remplissage.part - 1) < 0.02,
  true,
);

/* ── 4. Rien ne saute : au chargement, puis en navigant ─────────────────── */

console.log('\nRIEN NE SAUTE — NI AU CHARGEMENT, NI EN NAVIGANT');

/*
   LA MESURE EST CELLE DU NAVIGATEUR, et non la mienne : `layout-shift` est
   l'entrée que Chromium émet quand un élément déjà peint change de place. Une
   mesure maison — relever deux rectangles à deux instants — raterait tout ce
   qui bouge ENTRE les deux relevés, c'est-à-dire exactement ce qu'on cherche.

   `hadRecentInput` écarte les décalages qui suivent un geste : faire défiler
   une page n'est pas un défaut de mise en page.
*/
/*
   L'OBSERVATEUR EST POSÉ AVANT LE DOCUMENT, et c'est encore un rouge qui l'a
   appris : je l'installais par `evaluate`, puis je naviguais. La navigation
   détruit le contexte, donc l'observateur avec — et la lecture d'après rendait
   `undefined`, sur quoi l'essai mourait au lieu de rougir. `addInitScript`
   s'exécute dans CHAQUE document avant tout script de page : c'est le seul
   endroit d'où l'on voit le premier décalage, qui est justement celui qu'on
   cherche.

   `buffered: true` récupère en plus les décalages survenus avant que
   l'observateur ne soit branché dans ce document.
*/
await page.addInitScript(() => {
  window.__decalages = 0;
  window.__coupables = [];
  new PerformanceObserver((liste) => {
    for (const e of liste.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__decalages += e.value;
      /* QUI bouge, et non seulement de combien : un décalage sans coupable
         nommé se diagnostique à l'aveugle, et l'on finit par accuser ce qu'on
         vient d'écrire. */
      for (const src of e.sources ?? []) {
        const n = src.node;
        if (!n) continue;
        /*
           ON NOMME LE LOGOTYPE, PAS L'EN-TÊTE.

           Ma première version marquait tout décalage né dans l'en-tête comme
           imputable au logotype, et la garde a rougi sur
           « HEADER>A.cible-tactile-pleine ». Mesuré alors plutôt que supposé :
           le logotype a EXACTEMENT la même géométrie sur les deux pages —
           x 318, y 27, 63,56 × 18 px — et l'en-tête porte HUIT liens de cette
           classe. Celui qui bouge est l'un des sept autres, les commandes de
           droite, dont la place dépend de la largeur du nom de branche.

           Le marquage demande donc si le nœud EST le logotype ou le CONTIENT.
           Accuser l'en-tête entier aurait fait porter à ce lot un décalage qui
           ne lui appartient pas, et une garde qu'on ne peut pas verdir se
           désarme au premier qui passe.
        */
        const porteLogotype =
          n.hasAttribute?.('data-logotype') || !!n.querySelector?.('[data-logotype]');
        const dansEntete = porteLogotype ? 'LOGOTYPE>' : n.closest?.('header') ? 'HEADER>' : '';
        window.__coupables.push(
          `${dansEntete}${n.tagName ?? '?'}${n.id ? '#' + n.id : ''}` +
            `${n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : ''}` +
            ` (${e.value.toFixed(4)})`,
        );
      }
    }
  }).observe({ type: 'layout-shift', buffered: true });
});

async function decalagesEn(action) {
  await action();
  await page.waitForTimeout(900);
  const releve = await page.evaluate(() => ({
    valeur: window.__decalages,
    coupables: [...new Set(window.__coupables)].slice(0, 6),
  }));
  if (typeof releve.valeur !== 'number') {
    throw new Error('L’observateur de décalages n’était pas en place : mesure sans valeur.');
  }
  return releve;
}

/* Un chargement complet, polices comprises : c'est là que le mot changerait de
   largeur si sa place n'était pas réservée. */
const auChargement = await decalagesEn(async () => {
  await page.goto(`${RACINE}/`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
});
/*
   LA GARDE PORTE SUR LE LOGOTYPE, et c'est une mesure qui a recadré la
   question. Ma première écriture exigeait un décalage NUL pour toute la page,
   et elle a rougi à 0,0345 — en nommant ses coupables : « UL.grid » et
   « NAV.mt-10 », la grille des branches de l'accueil. Rien à voir avec le
   logotype, et rien que ce lot ait introduit.

   Garder le total de la page reviendrait à faire porter à ce lot un défaut
   qui ne lui appartient pas, et à rendre la garde rouge en permanence jusqu'à
   ce que quelqu'un la désarme. Ce qui est mesuré ici est donc : AUCUN
   décalage n'a pour source le logotype ni l'en-tête qui le porte. Le total de
   la page est imprimé à côté, pour information — il est signalé au Pilote
   comme un défaut distinct, et non corrigé en passant.
*/
const duLogotype = (releve) => releve.coupables.filter((c) => c.startsWith('LOGOTYPE>'));
verifier(
  `au chargement, aucun décalage n’a pour source le logotype` +
    ` (total de la page : ${auChargement.valeur.toFixed(4)}` +
    `${auChargement.coupables.length ? `, dû à ${auChargement.coupables.join(', ')}` : ''})`,
  duLogotype(auChargement),
  [],
);

/*
   DEUX NAVIGATIONS, ET ELLES NE POSENT PAS LA MÊME QUESTION.

   Ma première écriture n'en faisait qu'une, de l'accueil vers Révisions, et
   elle a rougi : « HEADER>A.cible-tactile-pleine (0,0001) ». Or ces deux pages
   n'ont pas le même en-tête — l'accueil est en léger, Révisions en complet —,
   et un en-tête qui CHANGE de forme entre deux pages n'est pas un logotype qui
   saute. La garde posait donc une question à laquelle le site a le droit de
   répondre « oui ».

   On mesure les deux, et c'est la comparaison qui tranche plutôt que mon
   jugement : d'un en-tête à l'autre, un décalage est attendu et seulement
   imprimé ; entre deux pages du MÊME en-tête, où `view-transition-name:
   entete-principal` fait persister l'élément, le moindre décalage du logotype
   est un défaut, et c'est celui-là qui est gardé.
*/
const entreDeuxFormes = await decalagesEn(async () => {
  await page.goto(`${RACINE}/revisions/`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
});
console.log(
  `  · pour information, d’un en-tête à l’autre : ${entreDeuxFormes.valeur.toFixed(4)}` +
    `${entreDeuxFormes.coupables.length ? ` (${entreDeuxFormes.coupables.join(', ')})` : ''}`,
);

/* Puis entre deux pages du MÊME en-tête complet : là, l'en-tête persiste pour
   de bon, et c'est la promesse du `viewBox` qu'on éprouve. */
const memeEntete = await decalagesEn(async () => {
  await page.goto(`${RACINE}/sport/`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
});
verifier(
  `entre deux pages du même en-tête, le logotype ne bouge pas` +
    ` (total : ${memeEntete.valeur.toFixed(4)}` +
    `${memeEntete.coupables.length ? `, dû à ${memeEntete.coupables.join(', ')}` : ''})`,
  duLogotype(memeEntete),
  [],
);

/* ── 5. Le voile ────────────────────────────────────────────────────────── */

console.log('\nLE VOILE NE MONTRE QUE LE LOGOTYPE');

/*
   Le voile se pose quand la page cesse d'être au premier plan. On le déclenche
   par l'événement qu'il écoute, plutôt qu'en masquant l'onglet : Playwright ne
   sait pas rendre un onglet caché sans fermer le contexte, et l'écouteur est
   exactement ce qu'on veut éprouver.
*/
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(200);
const voile = await page.evaluate(() => {
  const v = document.getElementById('voile-confidentialite');
  if (!v) return null;
  const svg = v.querySelector('[data-logotype]');
  return {
    cache: v.getAttribute('aria-hidden') === 'true',
    variante: svg?.getAttribute('data-logotype') ?? null,
    /* Ce que le voile DONNE À LIRE : son texte, hors le logotype. */
    texteEnPlus: v.textContent.replace(/\s+/g, ' ').trim(),
    nbEnfants: v.children.length,
  };
});
verifier('le voile se pose', voile !== null, true);
verifier('et il porte le logotype du voile', voile?.variante, 'archipel');
verifier('il ne livre aucun autre texte', voile?.texteEnPlus, 'Cyclades');
verifier('il ne porte qu’un seul enfant', voile?.nbEnfants, 1);
verifier('et il reste muet pour les technologies d’assistance', voile?.cache, true);

verifier('aucune erreur de page', erreurs.slice(0, 3), []);

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('Le logotype est là, dit son nom une fois, et ne bouge pas.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
