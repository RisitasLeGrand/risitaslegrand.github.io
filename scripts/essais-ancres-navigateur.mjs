/**
 * E3 — UNE ANCRE ATTERRIT JUSTE SOUS L'EN-TÊTE : NI DERRIÈRE, NI PLUS BAS.
 *
 *   npm run essais:ancres:navigateur
 *
 * ## Ce qu'un saut d'ancre fait, et pourquoi l'en-tête le gâche
 *
 * Sauter à une ancre amène le haut de la cible au haut de la FENÊTRE. L'en-tête
 * complet de Cyclades est collant — `.entete-sur`, `position: sticky`,
 * `top: var(--sur-haut)` — et occupe cette bande en permanence. Le haut de la
 * cible arrive donc DERRIÈRE lui : son titre et ses premières lignes sont
 * couverts.
 *
 * Le navigateur sait l'éviter, mais seulement si on le lui dit, de l'une des
 * deux façons : `scroll-padding-top` sur le conteneur qui défile, qui vaut pour
 * TOUTES les cibles, ou `scroll-margin-top` sur chaque cible, une par une.
 *
 * ## Ce que le dépôt portait quand cet essai a été écrit
 *
 * `scroll-padding-top` : nulle part. `scroll-margin-top` : sept endroits, tous
 * écrits en dur à `scroll-mt-24`, soit 6 rem — plus le glossaire, qui est la
 * seule exception et qui MESURE l'en-tête pour poser `--saut-glossaire`.
 *
 * Il y a donc DEUX défauts, et non un, et cet essai les sépare parce qu'ils ne
 * se corrigent pas de la même façon :
 *
 *   LA CIBLE COUVERTE — le planning, les numéros d'écoute de la veille, le
 *   lien « Aller au contenu » n'ont aucune marge. Sous un en-tête collant,
 *   leur titre passe derrière.
 *
 *   Et le contenu de cours : chaque titre portait sa marge, posée une fois dans
 *   `global.css`. Ce lot la retire au profit de la règle de racine, donc
 *   l'essai mesure aussi le sommaire d'une fiche — retirer une garantie sans
 *   mesurer celle qui la remplace, c'est la perdre.
 *
 *   LE TROU — il y a DEUX en-têtes dans le gabarit, et **le léger n'est pas
 *   collant** : il s'en va avec le contenu. Les quatre marges de `/profil/`,
 *   qui porte l'en-tête léger, ne protègent donc de rien ; elles poussent la
 *   section 96 px plus bas que demandé et ouvrent un blanc au-dessus d'elle.
 *   Six rem n'était pas seulement un nombre deviné : sur cette page, c'était
 *   un nombre deviné contre un en-tête qui n'était pas là.
 *
 * ## L'invariant, un seul, qui tient tous les cas
 *
 * La cible doit arriver juste sous CE QUI BARRE LE HAUT DE LA FENÊTRE, à un jeu
 * de respiration près. L'essai ne décide pas d'avance ce qui barre : il relève,
 * dans la page, tout ce qui est effectivement collé en haut — l'en-tête quand
 * il est collant, la barre d'index du glossaire qui se pose dessous, rien du
 * tout sur une page dont l'en-tête défile. Le repère vaut alors zéro, et la
 * cible doit arriver en haut de la fenêtre.
 *
 * C'est cette généralité qui a corrigé mon premier instrument : il comparait au
 * bas de l'en-tête seul, et condamnait donc le glossaire — le seul écran qui
 * fasse les choses bien — pour les 57 px de sa propre barre.
 *
 * ## Pourquoi deux largeurs, et pas une
 *
 * Mesurer à 1280 seulement laisserait passer le cas du téléphone, où l'en-tête
 * est le plus haut et le défaut le plus grave : il tient sur une rangée
 * au-dessus de « lg » et sur deux au-dessous. Mesurer à 390 seulement
 * laisserait passer une marge calibrée pour le téléphone qui ouvrirait un trou
 * sur l'ordinateur. Les deux, donc, et le constat porte le nom de la largeur.
 *
 * ## Ce que l'essai REFUSE de mesurer
 *
 * Une cible déjà au bas du document ne peut pas monter plus haut : le
 * navigateur est au bout de sa course, et la trouver sous l'en-tête ne dit rien
 * de la marge. De même si le saut n'a pas défilé — la cible était déjà en vue,
 * et zéro égale zéro ne prouve rien. Ces cas sont déclarés NON MESURÉS et
 * nommés, jamais comptés verts : c'est la leçon des listes courtes de
 * `essais:defilement-rendu`.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

/**
 * Deux pixels pour l'arrondi, douze pour le jeu.
 *
 * `TOLERANCE` absorbe l'arrondi d'un `getBoundingClientRect` sur un facteur de
 * zoom non entier, et rien de plus : une tolérance large est une dette, celle
 * de `essais:defilement-rendu` valait 80 px et cachait cinq faux verts.
 *
 * `JEU` est la respiration admise entre le bas de l'en-tête et le haut de la
 * cible — un titre collé au bord se lit mal. Douze pixels couvrent le demi-rem
 * que pose la feuille de style et son arrondi ; au-delà, c'est un trou.
 */
const TOLERANCE = 2;
const JEU = 12;

/** Les largeurs où l'en-tête n'a pas la même hauteur. */
const LARGEURS = [
  { nom: 'téléphone 390', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  { nom: 'ordinateur 1280', viewport: { width: 1280, height: 900 }, hasTouch: false, isMobile: false },
];

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const gris = (t) => `\x1b[90m${t}\x1b[0m`;

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

process.on('uncaughtException', (e) => {
  console.log(`${rouge('✗')} PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`${rouge('✗')} PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

/**
 * Les ancres du site, et comment on les atteint.
 *
 * `fragment` quand il est écrit dans le code ; `trouver` quand il est construit
 * à l'exécution — le glossaire par lettre, les réglages par section. L'essai le
 * découvre alors dans la page plutôt que de recopier un identifiant qui
 * changera.
 */
const ANCRES = [
  {
    route: '/planification/',
    fragment: 'planning',
    quoi: 'le planning (composant Section : aucune marge)',
  },
  {
    route: '/odyssee/veille/',
    fragment: 'ressources',
    quoi: 'les numéros d’écoute, « Besoin d’en parler ? » (aucune marge)',
  },
  {
    route: '/profil/',
    fragment: 'journee',
    quoi: 'une section du profil (marge en dur, en-tête léger)',
  },
  {
    route: '/parametres/',
    trouver: () => document.querySelector('section[data-section][id]')?.id ?? null,
    quoi: 'une section des réglages (marge en dur)',
  },
  {
    route: '/glossaire/',
    /*
       LE GLOSSAIRE NE PASSE PAS PAR LA BANDE, ET CETTE LIGNE GARDE AUTRE CHOSE.

       Le sabotage D — la bande ne comptant plus les barres d'écran — laissait
       cette ligne VERTE, et j'ai d'abord cru que l'essai mesurait mal. J'ai
       ensuite lu l'écran : ses puces font `preventDefault()` et appellent
       `allerA()`, qui calcule sa propre cible et appelle `window.scrollTo` en
       visant le bas de la barre d'index, avec des rendez-vous successifs pour
       absorber la mise en page différée de ses sections. Ni `scroll-padding` ni
       `scroll-margin` n'entrent donc en jeu ici.

       Son vert sous D était juste. Cette ligne ne garde pas la bande : elle
       garde que CE SAUT-LÀ atterrit bien sous les deux barres. C'est ce que
       doit éprouver le sabotage qui lui fait viser le HAUT de la barre d'index
       au lieu de son bas — sans quoi cette ligne serait verte sans mesurer.

       Elle vise une lettre du MILIEU de l'index : la première est si près du
       haut du document que le saut s'écrête, et la dernière tombe en bout de
       course, que l'essai refuse de mesurer.
    */
    trouver: () => {
      const puces = [...document.querySelectorAll('a[href^="#lettre-"]')];
      return puces[Math.floor(puces.length / 2)]?.getAttribute('href')?.slice(1) ?? null;
    },
    quoi: 'une lettre du glossaire (saut calculé par l’écran)',
  },
];

/**
 * Attend que la HAUTEUR du document cesse de bouger.
 *
 * Les listes de Cyclades se construisent après le déchiffrement, et les
 * sections du glossaire portent `content-visibility: auto` : le navigateur ne
 * les met en page qu'à leur approche, et remplace alors la hauteur ESTIMÉE par
 * la vraie. Mesurer avant que cela se tasse, c'est mesurer une dérive.
 */
async function attendreLaStabilite(page) {
  let precedent = -1;
  let stables = 0;
  for (let i = 0; i < 50 && stables < 3; i += 1) {
    const h = await page.evaluate(
      () => Math.round((document.scrollingElement ?? document.documentElement).scrollHeight),
    );
    stables = h === precedent ? stables + 1 : 0;
    precedent = h;
    await page.waitForTimeout(200);
  }
}

/** Attend que le défilement s'arrête, et rend la position atteinte. */
async function attendreLArret(page) {
  let precedent = null;
  for (let i = 0; i < 50; i += 1) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === precedent) return y;
    precedent = y;
    await page.waitForTimeout(100);
  }
  return precedent;
}

/**
 * Saute à un fragment, par le geste réel quand il existe.
 *
 * Un lien visible vers ce fragment : on clique, c'est ce que fait quelqu'un.
 * Sinon on pose le fragment dans l'adresse, ce qui est l'autre façon d'y
 * arriver — un lien partagé. Les deux passent par le même défilement du
 * navigateur ; le constat dit lequel a servi.
 */
async function sauter(page, fragment) {
  const clique = await page.evaluate((frag) => {
    const lien = [...document.querySelectorAll(`a[href="#${frag}"]`)].find(
      (a) => a.getClientRects().length > 0,
    );
    if (!lien) return false;
    lien.click();
    return true;
  }, fragment);
  if (!clique) {
    /*
       REPOSER UN FRAGMENT IDENTIQUE NE DÉFILE PAS, et c'est ce qui a rendu mon
       second saut muet : après le premier, l'adresse portait déjà `#lettre-2`,
       et l'affectation était un non-geste. On efface donc le fragment SANS
       défiler — `replaceState` ne touche pas au défilement — avant de le
       reposer, ce qui redéclenche le saut à coup sûr.
    */
    await page.evaluate((frag) => {
      if (location.hash === `#${frag}`) {
        history.replaceState(null, '', location.pathname + location.search);
      }
      location.hash = frag;
    }, fragment);
  }
  await attendreLArret(page);
  return clique ? 'au clic' : 'par l’adresse';
}

/**
 * Saute jusqu'à ce que la mesure se répète, et rend le relevé stable.
 *
 * Deux relevés consécutifs identiques : la page a fini de se mettre en page, et
 * ce qu'on lit est la MARGE. Jamais de concordance : on ne sait pas mesurer cet
 * écran, et on le dit — un relevé instable annoncé comme une mesure vaudrait
 * moins que rien.
 */
async function sauterJusquAConcorder(page, fragment, essais = 4) {
  let precedent = null;
  let comment = null;
  for (let i = 0; i < essais; i += 1) {
    comment = await sauter(page, fragment);
    await attendreLaStabilite(page);
    const m = await page.evaluate(releve, fragment);
    if (m.manque) return { m, comment };
    if (
      precedent !== null &&
      m.hautCible === precedent.hautCible &&
      m.repere === precedent.repere
    ) {
      return { m, comment };
    }
    precedent = m;
  }
  return { m: { ...precedent, instable: true }, comment };
}

/**
 * Relève, dans la page, tout ce dont le constat a besoin.
 *
 * Le fragment arrive en ARGUMENT, et non par fermeture : cette fonction est
 * sérialisée pour être exécutée dans le navigateur, où rien de la portée de ce
 * fichier n'existe. Ma première écriture la refermait sur une variable, ce qui
 * se lisait bien et n'aurait rendu que `undefined`.
 */
const releve = (frag) => {
  const cible = document.getElementById(frag);
  if (!cible) return { manque: `cible #${frag}` };
  const c = cible.getBoundingClientRect();
  const racine = document.scrollingElement ?? document.documentElement;

  /*
     LE REPÈRE N'EST PAS L'EN-TÊTE : C'EST TOUT CE QUI EST DEVANT LA CIBLE.

     Ma première écriture prenait le bas de `#entete-principal`. Elle déclarait
     donc un trou de 57 px sur le glossaire — qui n'en a pas : ces 57 px sont la
     hauteur de SA barre d'index, collante elle aussi et posée sous l'en-tête.
     Le glossaire est précisément l'écran qui fait les choses bien, et mon
     repère le condamnait.

     LE CRITÈRE EST « COMMENCE AU-DESSUS DE LA CIBLE », ET RIEN DE PLUS.

     J'ai essayé deux critères plus savants, et tous deux ont manqué quelque
     chose. Ne retenir que ce qui touche le bord de la fenêtre laissait échapper
     la barre d'index du glossaire, collée sous l'en-tête. Remonter la pile de
     proche en proche depuis le bord laissait échapper l'en-tête lui-même au
     saut du lien d'évitement : la cible est alors si près du haut du document
     que la page s'arrête 8 px avant que l'en-tête n'atteigne son point de
     collage ; il commence donc à 8 px et non à 0, et la pile se brisait là.

     Or la question n'a jamais été de reconstituer une pile. Elle est : QU'EST-CE
     QUI EST DEVANT LA CIBLE ? Tout élément collé ou fixe qui COMMENCE au-dessus
     du haut de la cible, OU AU MÊME NIVEAU QU'ELLE, est devant elle ; le plus
     bas de ces bas est le repère. Le « au même niveau » n'est pas un détail :
     sans lui, une cible entièrement couverte passait au vert, et c'est le
     sabotage qui l'a dit.

     Le filtre garde une position collante ou fixe, une hauteur et un bas
     positifs, et une largeur qui barre la fenêtre. Cette dernière condition
     compte : sans elle, une bulle fixe de cent pixels de large passerait pour un
     bandeau, et la barre latérale, qui est étroite, compterait pour un en-tête.

     Zéro occulteur est un résultat, pas une panne : une page sans rien de collé
     — l'en-tête léger en est un, il s'en va avec le contenu — doit recevoir sa
     cible en haut de la fenêtre.
  */
  const occulteurs = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'sticky' && cs.position !== 'fixed') continue;
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 || r.bottom <= 0) continue;
    if (r.width < window.innerWidth * 0.6) continue;
    /*
       « AU-DESSUS OU AU MÊME NIVEAU », ET NON « STRICTEMENT AU-DESSUS ».

       J'avais écrit `>=`, et le premier sabotage — la déclaration retirée — a
       montré ce que cela coûtait : la cible atterrit alors EXACTEMENT à 0, et
       l'en-tête collé est lui aussi à 0 ; il était donc exclu, l'essai
       concluait « rien devant la cible », et le constat passait au VERT sur
       le cas le plus grave qu'il existe — un titre entièrement couvert.

       Un élément qui commence au même niveau que la cible et descend plus bas
       qu'elle est devant elle. C'est tout ce que ce `>` dit.
    */
    if (r.top > c.top) continue;
    occulteurs.push({
      nom: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
      bas: Math.round(r.bottom),
    });
  }
  const repere = occulteurs.reduce((max, o) => Math.max(max, o.bas), 0);

  return {
    occulteurs,
    repere,
    hautCible: Math.round(c.top),
    y: Math.round(window.scrollY),
    yMax: Math.round(racine.scrollHeight - window.innerHeight),
  };
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

const nonMesures = [];
const releves = [];

/**
 * Les deux constats que porte une mesure.
 *
 * `attendu` est le bas du plus bas de ce qui barre le haut de la fenêtre, et
 * zéro quand rien ne la barre. La cible doit s'y ranger : pas au-dessus, ce
 * qui la couvrirait, pas en dessous, ce qui ouvrirait un blanc.
 */
function constater(nom, m) {
  const attendu = m.repere;
  releves.push({
    nom,
    barres: m.occulteurs.map((o) => `${o.nom}→${o.bas}`).join(' ') || '(rien de collé)',
    attendu,
    cible: m.hautCible,
  });
  verifier(
    `${nom} — la cible n’est pas couverte (haut à ${m.hautCible} px, repère à ${attendu} px)`,
    m.hautCible >= attendu - TOLERANCE,
    true,
  );
  verifier(
    `${nom} — et aucun trou au-dessus d’elle (${m.hautCible - attendu} px de jeu)`,
    m.hautCible <= attendu + JEU,
    true,
  );
}

for (const largeur of LARGEURS) {
  const contexte = await nav.newContext({
    viewport: largeur.viewport,
    hasTouch: largeur.hasTouch,
    isMobile: largeur.isMobile,
  });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});

  console.log(`\n  ${largeur.nom.toUpperCase()}`);
  verifier(
    'prémisse — le coffre est ouvert',
    await page.evaluate(
      () => !document.getElementById('temoin-coffre')?.classList.contains('hidden'),
    ),
    true,
  );

  for (const ancre of ANCRES) {
    await page.goto(`${RACINE}${ancre.route}`, { waitUntil: 'networkidle' });
    await attendreLaStabilite(page);

    const fragment = ancre.fragment ?? (await page.evaluate(ancre.trouver));
    if (!fragment) {
      // Un fragment introuvable n'est pas un vert : l'écran a changé, et
      // l'essai ne mesure plus ce qu'il annonce.
      verifier(`prémisse — ${ancre.route} porte une ancre à mesurer`, fragment, 'un identifiant');
      continue;
    }

    /*
       ON SAUTE DEUX FOIS, ET C'EST LA CORRECTION D'UN INSTRUMENT FAUX.

       Le premier relevé du glossaire donnait 361 px au lieu des 168 px que sa
       marge demande — un écart de 193 px que j'ai d'abord pris pour un trou.
       Il n'en était pas un : les sections en `content-visibility: auto` au-
       dessus de la cible se mettent en page PENDANT le saut, leur hauteur
       estimée est remplacée par la vraie, et la cible descend après que le
       défilement s'est arrêté. L'attente portait sur `scrollY`, qui ne bougeait
       plus ; la cible, elle, bougeait encore.

       Le second saut a lieu sur une page dont la mise en page est faite. Il
       mesure donc la MARGE, qui est la question, et non la calibration du
       modèle de hauteur du glossaire, qui en est une autre et que
       `estimer()` tient déjà.
    */
    const { m, comment } = await sauterJusquAConcorder(page, fragment);
    if (m.manque) {
      verifier(`prémisse — ${ancre.route} rend sa ${m.manque}`, m.manque, 'rien ne manque');
      continue;
    }

    // Trois refus de mesurer, nommés plutôt que comptés verts.
    if (m.instable) {
      nonMesures.push(
        `${largeur.nom} ${ancre.route}#${fragment} — relevé instable, la cible bouge encore`,
      );
      continue;
    }
    if (m.y === 0) {
      nonMesures.push(`${largeur.nom} ${ancre.route}#${fragment} — le saut n’a pas défilé`);
      continue;
    }
    if (m.y >= m.yMax - 2) {
      nonMesures.push(
        `${largeur.nom} ${ancre.route}#${fragment} — bout de course (y=${m.y}, max=${m.yMax})`,
      );
      continue;
    }

    constater(`${largeur.nom} · ${ancre.quoi} ${comment}`, m);
  }

  /*
     LE LIEN D'ÉVITEMENT, qui est le cas le plus grave.

     « Aller au contenu » est la première chose qu'atteint une navigation au
     clavier, et `<main>` ne porte aucune marge de défilement. Le geste réel est
     une tabulation puis Entrée ; on le fait ainsi, et non par l'adresse, parce
     que le lien est `sr-only` jusqu'à ce qu'il reçoive le focus.
  */
  await page.goto(`${RACINE}/planification/`, { waitUntil: 'networkidle' });
  await attendreLaStabilite(page);
  let atteint = false;
  for (let i = 0; i < 6 && !atteint; i += 1) {
    await page.keyboard.press('Tab');
    atteint = await page.evaluate(
      () => document.activeElement?.getAttribute('href') === '#contenu-principal',
    );
  }
  verifier(`prémisse — le lien d’évitement se prend à la tabulation (${largeur.nom})`, atteint, true);
  if (atteint) {
    await page.keyboard.press('Enter');
    await attendreLArret(page);
    const m = await page.evaluate(releve, 'contenu-principal');
    if (m.manque) {
      verifier(`prémisse — /planification/ rend sa ${m.manque}`, m.manque, 'rien ne manque');
    } else if (m.y === 0) {
      nonMesures.push(`${largeur.nom} « Aller au contenu » — le saut n’a pas défilé`);
    } else {
      constater(`${largeur.nom} · « Aller au contenu »`, m);
    }
  }

  /*
     LE SOMMAIRE D'UNE FICHE — l'ancre la plus employée d'un site de révision.

     Chaque titre de cours portait `prose-headings:scroll-mt-24`, posé une fois
     dans `global.css` pour tout le contenu. Ce lot l'a RETIRÉ, la règle de
     racine le remplaçant : il faut donc le mesurer, sans quoi le lot
     supprimerait une garantie sans la remplacer sous les yeux de personne.

     On y arrive comme quelqu'un le ferait : la bibliothèque, puis une fiche,
     puis la première entrée de son sommaire. Les identifiants des titres sont
     engendrés à partir du texte, donc on les DÉCOUVRE au lieu d'en recopier un.
  */
  await page.goto(`${RACINE}/bibliotheque/`, { waitUntil: 'networkidle' });
  await attendreLaStabilite(page);
  const versFiche = await page.evaluate(() => {
    const lien = [...document.querySelectorAll('a[href]')].find((a) => {
      if (a.getClientRects().length === 0) return false;
      const u = new URL(a.href, location.href);
      return u.origin === location.origin && u.pathname.replace(/\/$/, '').endsWith('/fiche');
    });
    return lien ? lien.href : null;
  });
  verifier(`prémisse — la bibliothèque mène à une fiche (${largeur.nom})`, typeof versFiche, 'string');
  if (versFiche) {
    await page.goto(versFiche, { waitUntil: 'networkidle' });
    await attendreLaStabilite(page);
    const titre = await page.evaluate(
      () =>
        document.querySelector('#sommaire a[href^="#"]')?.getAttribute('href')?.slice(1) ?? null,
    );
    if (!titre) {
      /* Une fiche sans sommaire — une fiche courte, ou rendue en une autre vue
         que le cours — n'a pas d'ancre à mesurer. On le dit. */
      nonMesures.push(`${largeur.nom} une fiche — pas de sommaire rendu`);
    } else {
      const { m, comment } = await sauterJusquAConcorder(page, titre);
      if (m.manque) {
        verifier(`prémisse — la fiche rend sa ${m.manque}`, m.manque, 'rien ne manque');
      } else if (m.instable) {
        nonMesures.push(`${largeur.nom} une fiche #${titre} — relevé instable`);
      } else if (m.y === 0) {
        nonMesures.push(`${largeur.nom} une fiche #${titre} — le saut n’a pas défilé`);
      } else if (m.y >= m.yMax - 2) {
        nonMesures.push(`${largeur.nom} une fiche #${titre} — bout de course`);
      } else {
        constater(`${largeur.nom} · un titre du sommaire d’une fiche ${comment}`, m);
      }
    }

    /*
       LE PANNEAU « SOMMAIRE », qui se pose APRÈS la bascule et non sous
       l'en-tête.

       Il était collé à `top-32`, soit 128 px écrits à la main. À 1280,
       l'en-tête fait 119 et la bascule 58 : la bande s'arrête à 177, et le
       panneau commençait 49 px trop haut, sa première ligne derrière la
       bascule.

       Il n'existe qu'à partir de « lg » (`lg:block`). Sur téléphone, le constat
       n'est donc pas une position mais une ABSENCE — et on la vérifie, plutôt
       que de passer l'écran sous silence : un panneau qui se mettrait à paraître
       à 390 px sans être calé reviendrait au défaut sans un mot.
    */
    const panneau = await page.evaluate(() => {
      const bloc = document.getElementById('sommaire')?.parentElement;
      if (!bloc) return { absent: 'pas de panneau' };
      if (bloc.getClientRects().length === 0) return { rendu: false };
      const barre = document.querySelector('.sous-entete');
      if (!barre) return { absent: 'pas de bascule' };
      return {
        rendu: true,
        haut: Math.round(bloc.getBoundingClientRect().top),
        basBarre: Math.round(barre.getBoundingClientRect().bottom),
      };
    });
    if (panneau.absent) {
      verifier(`prémisse — la fiche rend son panneau et sa bascule (${largeur.nom})`, panneau.absent, 'rien ne manque');
    } else if (!panneau.rendu) {
      verifier(
        `le panneau « Sommaire » n’est pas rendu à cette largeur (${largeur.nom})`,
        largeur.viewport.width < 1024,
        true,
      );
    } else {
      verifier(
        `${largeur.nom} · le panneau « Sommaire » se pose au bas de la bascule (${panneau.haut} px contre ${panneau.basBarre} px)`,
        Math.abs(panneau.haut - panneau.basBarre) <= TOLERANCE,
        true,
      );
    }
  }

  verifier(`aucune erreur de page (${largeur.nom})`, erreurs.slice(0, 3), []);
  await contexte.close();
}

await nav.close();

if (releves.length) {
  console.log('\n  CE QUI A ÉTÉ MESURÉ');
  console.log(
    `  ${'ancre'.padEnd(56)} ${'repère'.padStart(6)} ${'cible'.padStart(6)}  ce qui barre le haut`,
  );
  for (const r of releves) {
    console.log(
      `  ${r.nom.padEnd(56).slice(0, 56)} ${String(r.attendu).padStart(6)} ${String(r.cible).padStart(6)}  ${r.barres}`,
    );
  }
}
if (nonMesures.length) {
  console.log(`\n  ${gris('NON MESURÉS — nommés, jamais comptés verts')}`);
  for (const n of nonMesures) console.log(`  ${gris(`· ${n}`)}`);
}

console.log(
  rouges === 0
    ? `\n${vert('Chaque ancre se range juste sous son en-tête, aux deux largeurs.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
