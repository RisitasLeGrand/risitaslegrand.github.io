/**
 * RELEVER LES TEMPORISATIONS À L'AVEUGLE, ET CELLES QUI COMPTENT.
 *
 * ## À quoi sert ce relevé
 *
 * `docs/cyclades/cadence-des-essais.md` § 4 tient le chantier qui remplace les
 * `waitForTimeout` des essais par des post-conditions. Ce script en donne
 * l'assiette : combien il en reste, et dans quels essais.
 *
 * Seules comptent les temporisations qui ont une **lecture derrière** — un
 * `isVisible`, un `textContent`, un `count()`, un `evaluate`, une assertion.
 * Une temporisation suivie de rien ne ment pas sur l'écran : elle ne fait que
 * ralentir la batterie, et elle se retire sans précaution.
 *
 * ## Ce que le chiffre vaut
 *
 * C'est une ESTIMATION, et la fenêtre de douze lignes en est la raison.
 * L'élargir ramasse des lectures qui appartiennent au geste suivant ; la
 * rétrécir manque celles qu'un bloc `waitForFunction` sépare de leur
 * temporisation. Deux relevés qui ne disent pas leur fenêtre ne sont donc pas
 * comparables — ce qui m'est arrivé entre deux annonces au Pilote, et c'est la
 * raison d'être de ce fichier : le chiffre à retenir est celui qui a un script
 * derrière lui.
 *
 * ## La faute que ce motif a déjà commise
 *
 * Sa première version omettait **`evaluate(`**, qui est la façon la plus
 * courante de lire l'écran dans ces essais, et elle sous-comptait d'un quart.
 * Un motif de mesure se vérifie sur un fichier DÉJÀ traité, où le reste doit
 * être zéro.
 *
 * ## L'usage
 *
 *     node scripts/relever-temporisations.mjs
 *     node scripts/relever-temporisations.mjs --fenetre 20
 *     node scripts/relever-temporisations.mjs --amortissements
 *     node scripts/relever-temporisations.mjs --bornes
 *     node scripts/relever-temporisations.mjs --bornes --dans <dossier>
 *     node scripts/relever-temporisations.mjs --deguisees
 *     node scripts/relever-temporisations.mjs --deguisees --fenetre 10
 *     node scripts/relever-temporisations.mjs --pour 'coffre|sauvegarde'
 *
 * Le dernier relève les délais que le SITE s'impose, c'est-à-dire ce qui peut
 * légitimer une attente à l'aveugle dans un essai. Une sur vingt-six au
 * pilote ; les relever avant un lot évite de « réparer » ce qui n'est pas
 * cassé.
 *
 * ## Les deux formes d'un délai, et pourquoi la seconde se manque
 *
 * **Un minuteur** — `setTimeout` — diffère une action. Il se cherche par son
 * nom, et c'est la forme à laquelle on pense.
 *
 * `--pour <motif>` rend la LISTE, fichier par fichier et ligne par ligne, des
 * sites dont le nom d'essai correspond au motif. C'est de quoi confier un
 * périmètre à quelqu'un d'autre sans lui faire refaire le relevé, et chaque
 * ligne porte la durée pariée et la lecture qui suit — de quoi décider du
 * remède avant d'ouvrir le fichier.
 *
 * `--bornes` cherche une autre faute, trouvée le 26 octobre : le second
 * argument de `waitForFunction` est la VALEUR passée à la fonction, et les
 * options sont au troisième. Une borne écrite au second est donc ignorée, et
 * la borne réelle est celle par défaut. Seize appels en portaient une. Une
 * borne qu'on croit avoir fixée est pire qu'une borne absente, et les deux
 * formes se ressemblent assez pour que rien ne se voie.
 *
 * Ce balayage-là est AU SOCLE, par `npm run essais:bornes` — qui lance
 * `scripts/essais-bornes.mjs`, lequel éprouve la reconnaissance elle-même
 * avant de balayer le dépôt. Il REFUSE — code 2 — s'il ne lit aucun appel du
 * tout : un dossier renommé rendrait sinon le vert d'une mesure qui n'a rien
 * mesuré. `--dans <dossier>` sert à le braquer ailleurs, ce dont son essai se
 * sert pour éprouver ses trois codes de sortie. La reconnaissance vit dans
 * `scripts/lib/bornes-de-waitforfunction.mjs`, pour que l'essai puisse
 * l'appeler sans lancer cette ligne de commande.
 *
 * **Ce que ce balayage ne voyait pas, et que son essai a trouvé** : la forme
 * sur plusieurs lignes. La virgule que le formateur pose après le dernier
 * argument rendait un troisième argument vide, l'appel n'en avait donc plus
 * deux, et la faute passait. Trente-quatre bornes étaient au mauvais rang
 * dans huit essais, derrière un « 0 borne » qui se lisait comme un verdict.
 * Les seize du 26 octobre n'étaient que la forme sur une ligne.
 *
 * ## L'ATTENTE DÉGUISÉE, que les deux relevés précédents ne voient pas
 *
 * `--deguisees` cherche une troisième forme, et c'est celle qui se compte le
 * moins bien : **on attend sur le sélecteur A, puis on lit le sélecteur B.**
 * Rien ne ressemble plus à un essai bien tenu. Il y a une attente, elle est
 * bornée, elle porte un sélecteur — et elle ne garantit rien de ce qui est
 * ensuite affirmé. Les deux autres relevés la manquent entièrement : il n'y a
 * ni `waitForTimeout` ni borne mal placée.
 *
 * **Un sélecteur étranger n'est pas une faute en soi**, et le relevé ne le dit
 * jamais. Sur beaucoup d'écrans, B est peint dans la même passe que A, et
 * l'attente vaut pour les deux. Ce qui décide est ce que l'assertion DEVIENT
 * si la course est perdue :
 *
 * — une lecture comparée à une VALEUR rend `null` et **rougit**. Elle se
 *   signale, on la corrige le jour où elle tombe ;
 * — une lecture qui attend une **ABSENCE** — `faux(…isVisible)`, un compte à
 *   zéro, un `false` attendu — est satisfaite par la page pas encore peinte.
 *   Elle **verdit à faux**, et rien ne le dira jamais.
 *
 * Le relevé sépare donc les deux et ne met en tête que les secondes. Un faux
 * rouge se signale ; un faux vert, non — c'est toute l'asymétrie, et c'est
 * pourquoi le chiffre à regarder est celui des muettes, pas celui des
 * candidats.
 *
 * ## Les trois gonflages que ce motif a subis avant de valoir quelque chose
 *
 * Chacun n'a été vu que parce que le relevé IMPRIME les cas qu'il compte.
 *
 * 1. Il prenait le **premier littéral de la ligne**. Or `verifier('et les
 *    boutons ont disparu', …)` en porte un avant son sélecteur : huit des dix
 *    cas tirés au sort étaient des intitulés français. 173 → 150.
 * 2. Il fermait chaque littéral sur **n'importe quel guillemet**, ce qui
 *    tronquait `'[data-etat="plein"]'` en `[data-etat=` — et un sélecteur
 *    tronqué ne ressemble plus à aucun autre, donc passait pour étranger.
 *    150 → 147.
 * 3. Il ne regardait que l'attente **la plus proche**. `essais-journal.mjs`
 *    attend `#total` puis `#reviser` et lit les deux : la garde était deux
 *    lignes plus haut. 147 → 146, un seul site — la forme était rare, et c'est
 *    une raison de le dire, pas de le taire.
 *
 * **Un repos comparé à l'horloge** n'a aucun minuteur : le site garde l'instant
 * du dernier geste et refuse le suivant s'il arrive trop tôt. `src/lib/geste.ts`
 * fait cela — `performance.now() - derniere < repos`, 600 ms par défaut, pour
 * tous les gestes qui passent par `unSeulGeste`. **C'est exactement le cas qui a
 * légitimé la seule temporisation gardée du pilote, et un relevé des
 * `setTimeout` ne le voit pas.** Ma première version de ce fichier annonçait le
 * contraire ; elle se trompait sur son propre exemple.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { bornesAuMauvaisRang } from './lib/bornes-de-waitforfunction.mjs';

const LECTURE =
  /isVisible|textContent|innerText|innerHTML|getAttribute|\$\$eval|\$eval|\.count\(\)|evaluate\(|verifier\(|verifierPresque\(|inputValue|checkVisibility/;

const args = process.argv.slice(2);
const iFenetre = args.indexOf('--fenetre');
const FENETRE = iFenetre === -1 ? 12 : Number(args[iFenetre + 1]);
const AMORTISSEMENTS = args.includes('--amortissements');
const BORNES = args.includes('--bornes');
const iDans = args.indexOf('--dans');
const DANS = iDans === -1 ? 'scripts' : args[iDans + 1];
const DEGUISEES = args.includes('--deguisees');
const iPour = args.indexOf('--pour');
const POUR = iPour === -1 ? null : args[iPour + 1];

if (!Number.isInteger(FENETRE) || FENETRE < 1) {
  console.error('La fenêtre se donne en lignes, par un entier positif.');
  process.exit(2);
}

/* ── Les essais ───────────────────────────────────────────────────────── */

const essais = readdirSync('scripts')
  .filter((f) => /^essais-.*\.(mjs|mts)$/.test(f))
  .sort();

let total = 0;
let avecLecture = 0;
const parFichier = new Map();
const sites = [];

for (const f of essais) {
  const lignes = readFileSync(`scripts/${f}`, 'utf8').split('\n');
  lignes.forEach((l, i) => {
    if (!/waitForTimeout\(/.test(l)) return;
    total += 1;
    const fenetre = lignes.slice(i + 1, i + 1 + FENETRE).join('\n');
    if (!LECTURE.test(fenetre)) return;
    avecLecture += 1;
    parFichier.set(f, (parFichier.get(f) ?? 0) + 1);
    sites.push({ fichier: f, ligne: i + 1, code: l.trim().slice(0, 72) });
  });
}

/* ── Les amortissements du site, qui légitiment une attente ───────────── */

/** Les fichiers d'écran et de bibliothèque, à plat. */
function sourcesDuSite(racine) {
  const sortie = [];
  const pile = [racine];
  while (pile.length) {
    const d = pile.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const c = `${d}/${e.name}`;
      if (e.isDirectory()) pile.push(c);
      else if (/\.(ts|svelte|astro)$/.test(e.name)) sortie.push(c);
    }
  }
  return sortie.sort();
}

/**
 * Les délais que le site s'impose, par forme.
 *
 * Rendu brut, à lire : la décision reste humaine. Ce qu'on cherche est un délai
 * dont l'essai doit attendre l'échéance parce que ce qu'il vérifie est qu'il ne
 * se passe RIEN — et cela ne se remplace pas par une marque à l'écran sans
 * annoncer ce que le site rend invisible.
 */
function amortissements(racine) {
  /* Un repos comparé à l'horloge : aucun minuteur, donc invisible à l'autre
     relevé. C'est la forme qui compte le plus, et la plus rare. */
  const REPOS = /(?:Date|performance)\.now\(\)\s*-\s*[\w.?[\]]+\s*[<>]/;
  /* Un minuteur, hors annulation. */
  const MINUTEUR = /setTimeout\(/;
  /* Et les constantes en millisecondes, qui servent d'index : un délai nommé
     est presque toujours un délai qui compte pour quelqu'un. */
  const CONSTANTE = /^\s*(?:export\s+)?const\s+([A-Z][A-Z_]*_MS|[A-Z][A-Z_]*MS)\s*=\s*([\d_]+)/;

  const repos = [];
  const minuteurs = [];
  const constantes = [];
  for (const c of sourcesDuSite(racine)) {
    readFileSync(c, 'utf8')
      .split('\n')
      .forEach((l, i) => {
        const site = { fichier: c, ligne: i + 1, code: l.trim().slice(0, 86) };
        if (REPOS.test(l)) repos.push(site);
        if (MINUTEUR.test(l) && !/clearTimeout/.test(l)) minuteurs.push(site);
        const m = l.match(CONSTANTE);
        /* Un jour en millisecondes est une unité de calendrier, pas un repos. */
        if (m && Number(m[2].replace(/_/g, '')) < 600_000) constantes.push(site);
      });
  }
  return { repos, minuteurs, constantes };
}


/* ── Les attentes déguisées ───────────────────────────────────────────── */

const ATTENTE =
  /\b(waitForSelector|devientVisible|annonceDe|attendreLeCompte|travailFini|boutonRendu|apresLaPeinture|apresLeChangementDeTexte|apresLesAnimations|apresLeRemplacement)\s*\(/;
const LECTURE_SELECTEUR =
  /\b(locator|textContent|innerText|isVisible|getAttribute|inputValue|\$\$eval|\$eval)\s*\(/;

/* Chaque littéral est lu PAR SON PROPRE délimiteur : voir le gonflage n° 2. */
const LITTERAUX = /'([^'\n]{0,160})'|"([^"\n]{0,160})"|`([^`\n]{0,160})`/g;

/* La forme d'un sélecteur, pour ne pas prendre un intitulé : gonflage n° 1. */
const FORME_DE_SELECTEUR =
  /^(?:[#.[]|(?:button|input|section|div|li|ul|ol|table|tr|td|th|span|a|h[1-6]|dialog|form|select|textarea|details|summary|p|nav|main|header|footer|canvas|svg|label|option|fieldset|progress|meter|img|body|html)\b)/;

/*
   L'ASSERTION MUETTE : celle qui verdit si la course est perdue, parce que ce
   qu'elle exige est une absence — et qu'une page pas encore peinte n'affiche
   rien. C'est le seul des deux versants qui ne se signale jamais.
*/
const MUETTE = /\bfaux\(|,\s*false\s*[),]|===\s*false|,\s*0\s*[),]|toBe\(false\)|toHaveCount\(0\)/;

/*
   ET L'EXCEPTION QUI REND LE CRI. `faux(…isEnabled())` a la forme d'une
   muette et n'en est pas une : un bouton présent est ACTIF par défaut, donc
   une page pas encore peinte rend `true` et l'assertion ROUGIT ; et un bouton
   absent fait lever l'appel, donc elle rougit aussi. Des deux côtés, elle se
   signale.

   `isChecked` ne rejoint pas la liste, et c'est le même raisonnement qui le
   dit : une case non cochée EST l'état de départ, donc `faux(…isChecked())`
   est bel et bien satisfaite par une page qui n'a rien fait.

   Ce qu'il faut savoir en lisant le chiffre : la règle générale — « une
   assertion d'absence est muette » — ne vaut que si l'absence est aussi
   l'état d'avant. Le relevé n'a pas les moyens de le savoir en général ; il ne
   traite que ce cas-ci, où le défaut du navigateur le dit. Il SUR-COMPTE donc
   encore un peu, et il vaut mieux qu'il sur-compte.
*/
const CRIE = /isEnabled\(/;

/**
 * L'assertion ENTIÈRE à laquelle la ligne appartient, et rien de plus.
 *
 * Une assertion tient souvent sur plusieurs lignes, donc il faut regarder plus
 * loin que la ligne lue. Mais un voisinage de taille fixe DÉBORDE sur
 * l'assertion suivante : `vrai('le coffre est fermé au départ', …)` passait
 * pour muette parce qu'une voisine trois lignes plus bas portait un `false`.
 * Quatrième gonflage, et le plus sournois : il inventait des muettes là où le
 * code disait exactement le contraire de ce qu'on lui prêtait.
 *
 * On s'arrête donc là où les parenthèses se referment — la fin de l'énoncé —
 * sans jamais dépasser huit lignes.
 */
function assertionDe(lignes, i) {
  let profondeur = 0;
  const prises = [];
  for (let k = i; k < Math.min(lignes.length, i + 8); k += 1) {
    const l = lignes[k];
    prises.push(l);
    for (const c of l) {
      if (c === '(' || c === '[') profondeur += 1;
      else if (c === ')' || c === ']') profondeur -= 1;
    }
    if (k > i && profondeur <= 0) break;
    if (k === i && profondeur <= 0) break;
  }
  return prises.join('\n');
}

/** Le premier littéral de la ligne qui ait la forme d'un sélecteur. */
function selecteurDe(ligne) {
  for (const m of ligne.matchAll(LITTERAUX)) {
    const v = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!FORME_DE_SELECTEUR.test(v)) continue;
    /* Une phrase française n'est pas un sélecteur. */
    if (/[^\x00-\x7F]/.test(v)) continue;
    return v;
  }
  return null;
}

/** Le sujet d'un sélecteur : ce sur quoi il porte, sans ses conditions. */
function sujetsDe(s) {
  return s
    .split(',')
    .map((p) =>
      p
        .replace(/:not\([^)]*\)/g, '')
        .replace(/:has\([^)]*\)/g, '')
        .replace(/:(?:visible|hidden|first-child|last-child|checked|disabled|enabled)\b/g, '')
        .trim(),
    )
    .filter(Boolean);
}

/** A et B tiennent-ils l'un dans l'autre ? « #liste » et « #liste li ». */
function seTiennent(a, b) {
  return a.startsWith(b) || b.startsWith(a) || a.includes(` ${b}`) || b.includes(` ${a}`);
}

/**
 * LES COUPLES QUE LE SITE BASCULE D'UN SEUL TENANT, lus dans `src/`.
 *
 * Le relevé classait « attend `#coffre-ferme`, lit `#coffre-ouvert` » parmi
 * les étrangers — ce qui est vrai de leurs noms et faux de leur conduite. Les
 * écrans font :
 *
 *     $('coffre-ferme').classList.toggle('hidden', ouvert);
 *     $('coffre-ouvert').classList.toggle('hidden', !ouvert);
 *
 * Deux énoncés synchrones, sans `await` entre eux : au moment où l'un est
 * visible, l'autre est DÉJÀ caché. L'attente garantit donc bel et bien la
 * lecture, et six des seize muettes relevaient de ce seul motif.
 *
 * Une liste d'exemptions écrite à la main aurait pourri au premier écran
 * renommé. On les DÉDUIT : deux identifiants dont la visibilité se règle à
 * moins de trois lignes l'un de l'autre, dans le même fichier, forment un
 * couple. Ce qui exempte n'est pas un nom, c'est un fait lisible dans le code.
 *
 * Ce que ce calcul NE VOIT PAS, et qu'il faut dire : un couple dont les deux
 * bascules sont séparées par un `await`, ou posées dans deux fonctions. Il
 * sous-exempte donc, jamais l'inverse — le relevé reste prudent du bon côté.
 */
function couplesBascules(racine) {
  const BASCULE =
    /\$\(\s*['"`]#?([\w-]+)['"`]\s*\)\s*\.classList\s*\.\s*(?:toggle|add|remove)\(\s*['"`]hidden['"`]/;
  const couples = new Set();
  for (const chemin of sourcesDuSite(racine)) {
    const lignes = readFileSync(chemin, 'utf8').split('\n');
    const vus = [];
    lignes.forEach((l, i) => {
      const m = l.match(BASCULE);
      if (!m) return;
      for (const v of vus) {
        if (i - v.ligne > 3) continue;
        if (v.id === m[1]) continue;
        couples.add([v.id, m[1]].sort().join('|'));
      }
      vus.push({ id: m[1], ligne: i });
    });
  }
  return couples;
}

/**
 * Les lectures d'écran, classées par ce qui les garde.
 *
 * On remonte la fenêtre depuis chaque lecture et l'on retient TOUTES les
 * attentes qu'on y trouve — pas seulement la plus proche : gonflage n° 3.
 */
function deguisees(fenetre) {
  const couples = couplesBascules('src');
  /** Les deux sujets sont-ils les deux faces d'une même bascule ? */
  const accouples = (x, y) => {
    const a = x.replace(/^#/, '');
    const b = y.replace(/^#/, '');
    return couples.has([a, b].sort().join('|'));
  };
  let lectures = 0;
  let sansAttente = 0;
  let meme = 0;
  let parent = 0;
  let couple = 0;
  const cas = [];

  for (const f of essais) {
    const lignes = readFileSync(`scripts/${f}`, 'utf8').split('\n');
    lignes.forEach((l, i) => {
      if (!LECTURE_SELECTEUR.test(l)) return;
      /* Une attente qui lit n'est pas une lecture non gardée : elle EST la garde. */
      if (ATTENTE.test(l)) return;
      const selecteur = selecteurDe(l);
      if (!selecteur) return;
      const sL = sujetsDe(selecteur);
      if (sL.length === 0) return;
      lectures += 1;

      const attentes = [];
      for (let k = i - 1; k >= Math.max(0, i - fenetre); k -= 1) {
        if (!ATTENTE.test(lignes[k])) continue;
        const sel = selecteurDe(lignes[k]);
        if (sel) attentes.push({ ligne: k + 1, sel });
      }
      if (attentes.length === 0) {
        sansAttente += 1;
        return;
      }
      const couvre = (test) =>
        attentes.some((a) => {
          const sA = sujetsDe(a.sel);
          return sL.some((x) => sA.some((y) => test(x, y)));
        });
      if (couvre((x, y) => x === y)) {
        meme += 1;
        return;
      }
      if (couvre(seTiennent)) {
        parent += 1;
        return;
      }
      if (couvre(accouples)) {
        couple += 1;
        return;
      }
      const enonce = assertionDe(lignes, i);
      const muette = MUETTE.test(enonce) && !CRIE.test(enonce);
      cas.push({
        fichier: f,
        muette,
        attente: attentes[0],
        ligne: i + 1,
        selecteur,
        code: l.trim().slice(0, 74),
      });
    });
  }
  return { lectures, sansAttente, meme, parent, couple, cas };
}


/* ── Le rendu ─────────────────────────────────────────────────────────── */

if (POUR) {
  /*
     LA LISTE D'UN PÉRIMÈTRE, pour la confier. On rend la ligne du site, la
     durée pariée, et la première lecture qui suit dans la fenêtre : c'est ce
     qui dit le remède — une lecture d'écran, une lecture de base, ou la
     cadence d'un geste.
  */
  const motif = new RegExp(POUR);
  let combien = 0;
  const concernes = essais.filter((f) => motif.test(f));
  console.log(`\nSites dont le nom d'essai correspond à « ${POUR} », fenêtre de ${FENETRE} lignes.\n`);
  for (const f of concernes) {
    const lignes = readFileSync(`scripts/${f}`, 'utf8').split('\n');
    const siens = [];
    lignes.forEach((l, i) => {
      if (!/waitForTimeout\(/.test(l)) return;
      const fenetre = lignes.slice(i + 1, i + 1 + FENETRE);
      const lue = fenetre.find((x) => LECTURE.test(x));
      if (!lue) return;
      siens.push({
        ligne: i + 1,
        duree: (l.match(/waitForTimeout\(([^)]*)\)/) ?? [, '?'])[1],
        lecture: lue.trim().slice(0, 66),
      });
    });
    if (siens.length === 0) continue;
    combien += siens.length;
    console.log(`  scripts/${f} — ${siens.length} site(s)`);
    for (const s of siens) {
      console.log(`      l. ${String(s.ligne).padStart(4)} · ${String(s.duree).padStart(7)} → ${s.lecture}`);
    }
    console.log('');
  }
  console.log(`  ${combien} site(s) dans ${concernes.length} essai(s) du périmètre.\n`);
} else if (BORNES) {
  const { fautes, appels, fichiers } = bornesAuMauvaisRang(DANS);
  /*
     LE REFUS QUI MANQUAIT. Zéro faute et zéro appel lu se rendaient de la même
     façon : « 0 borne au mauvais rang », et l'enchaînement continuait. Or ce
     passage entre au socle, c'est-à-dire devant un `&&` : un dossier renommé,
     un `--dans` mal orthographié ou une extension oubliée rendraient le vert
     d'un balayage qui n'a rien lu. C'est la leçon du chemin du navigateur —
     ne rien trouver doit lever — et elle vaut aussi pour les balayages de
     source.
  */
  if (appels === 0) {
    console.error(
      `\n✗ REFUS — aucun appel à « waitForFunction » dans « ${DANS} » ` +
        `(${fichiers} fichier(s) lu(s)).\n` +
        '  Ce dépôt en porte plus de deux cents : un balayage qui n’en lit aucun\n' +
        '  ne mesure rien, et son silence ne vaut pas un verdict.\n',
    );
    process.exit(2);
  }
  console.log(
    `\n${fautes.length} borne(s) de « waitForFunction » au mauvais rang ` +
      `(${appels} appels lus dans ${fichiers} fichiers de « ${DANS} »).\n`,
  );
  for (const f of fautes) console.log(`  ${f.fichier}:${f.ligne}  second argument : ${f.code}`);
  console.log('');
  process.exit(fautes.length === 0 ? 0 : 1);
} else if (DEGUISEES) {
  /*
     La fenêtre par défaut est plus COURTE ici que pour les temporisations :
     on cherche une lecture qui suit son attente de près, et non la portée d'un
     geste. Elle reste réglable par `--fenetre`, et deux relevés de fenêtres
     différentes ne se comparent pas.
  */
  const fenetre = iFenetre === -1 ? 6 : FENETRE;
  const { lectures, sansAttente, meme, parent, couple, cas } = deguisees(fenetre);
  const muettes = cas.filter((c) => c.muette);

  console.log(`\nFenêtre de ${fenetre} lignes en amont. ${essais.length} essais.\n`);
  console.log(`  ${lectures} lectures d’écran à sélecteur littéral`);
  console.log(`  ${sansAttente} sans aucune attente dans la fenêtre`);
  console.log(`  ${meme} gardées par une attente sur LE MÊME sujet`);
  console.log(`  ${parent} sur un sujet qui tient dans l’autre`);
  console.log(`  ${couple} sur l’AUTRE FACE d’une bascule que le site fait d’un tenant`);
  console.log(`  ${cas.length} sur un sujet ÉTRANGER — candidats, pas fautes`);
  console.log(`      dont ${muettes.length} MUETTES : l’assertion VERDIT si la course est perdue`);
  console.log(`      et  ${cas.length - muettes.length} bruyantes : elle rougit, donc elle se signale\n`);

  const parF = new Map();
  for (const c of muettes) parF.set(c.fichier, (parF.get(c.fichier) ?? 0) + 1);
  console.log('LES MUETTES, essai par essai — c’est le seul chiffre qui presse :\n');
  for (const [f, n] of [...parF].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  scripts/${f}`);
    for (const c of muettes.filter((x) => x.fichier === f)) {
      console.log(`         l.${String(c.attente.ligne).padStart(4)} attend « ${c.attente.sel} »`);
      console.log(`         l.${String(c.ligne).padStart(4)} lit    « ${c.selecteur} »  ${c.code}`);
    }
  }
  console.log(`\n  ${muettes.length} muettes dans ${parF.size} essais.\n`);
} else if (AMORTISSEMENTS) {
  const { repos, minuteurs, constantes } = amortissements('src');
  const dire = (titre, liste) => {
    console.log(`\n${titre} — ${liste.length}\n`);
    for (const a of liste) console.log(`  ${a.fichier}:${a.ligne}  ${a.code}`);
  };
  dire('REPOS COMPARÉS À L’HORLOGE (aucun minuteur : à lire en premier)', repos);
  /*
     Et la PORTÉE du premier des trois, qui est ce qu'on veut savoir avant un
     lot : sur ces écrans, un geste répété à données identiques en moins de
     600 ms est pris pour un rebond, et l'essai doit laisser passer le repos.
  */
  const gestes = sourcesDuSite('src').filter((c) =>
    /unSeulGeste\(/.test(readFileSync(c, 'utf8')),
  );
  console.log(`\nÉCRANS QUE LE REBOND DE « geste.ts » GOUVERNE — ${gestes.length}\n`);
  for (const c of gestes) console.log(`  ${c}`);
  dire('MINUTEURS', minuteurs);
  dire('DÉLAIS NOMMÉS, comme index', constantes);
  console.log('');
} else {
  console.log(`\nFenêtre de ${FENETRE} lignes.\n`);
  console.log(`  ${total} temporisations dans ${essais.length} essais`);
  console.log(`  ${avecLecture} avec une lecture derrière, dans ${parFichier.size} essais\n`);
  console.log('Les essais les plus chargés :\n');
  for (const [f, n] of [...parFichier].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(3)}  ${f}`);
  }
  console.log('');
}
