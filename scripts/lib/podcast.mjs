/**
 * Réécriture d'une fiche en script de podcast.
 *
 * Le « Cours complet » est écrit pour l'œil : titres numérotés, listes à
 * puces, tableaux, gras. Lu tel quel par une synthèse vocale, il donne un
 * texte haché, pénible à l'oreille. Ce module le réécrit comme on parlerait :
 * les titres deviennent des relances, les listes des énumérations dites, les
 * tableaux des phrases, et les abréviations sont développées (« art. 55 » se
 * dit « article 55 »).
 *
 * Deux exigences se tiennent :
 *
 *  - le ton doit être HUMAIN — on s'adresse à quelqu'un, on varie les
 *    formules, on ne récite pas trois fois « Première partie » ;
 *  - la transformation doit rester DÉTERMINISTE, pour tourner dans le flux de
 *    contenu à chaque ajout ou modification de fiche, sans intervention.
 *
 * D'où le procédé : les variantes de formulation sont tirées au sort, mais le
 * tirage est une empreinte du texte. Deux fiches ne s'enchaînent pas de la
 * même façon, et la même fiche donne toujours le même script.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { construireIndexGlossaire, normaliser, normaliserPositions } from './glossaire.mjs';
import { separerIdentifiant } from './markdown.mjs';

/**
 * Version du réécriveur : la changer force la régénération de tous les scripts.
 *
 * 6 (prompt 55) : UNE SEULE hausse pour les douze règles du prompt, comme
 * son interdit 3 l'exige — glossaire accentué, rang des parties, plan
 * annoncé, récapitulatifs et questions de rappel, sonie, tableaux et listes,
 * relances, prononciation et sigles fiscaux, gloses dites comme des phrases,
 * générique raccourci, parenthèses en incises, énumérations coupées, phrase
 * du schéma. Les réglages de pause et de sonie entrent dans l'empreinte,
 * comme le même interdit le demande : ils ne changent pas le texte dit, mais
 * ils changent le son produit.
 *
 * 5 (prompt 46, P2) : le marqueur d'identifiant de partie — « {#…} », posé à
 * côté des titres par P1 — était jusqu'ici DIT À VOIX HAUTE au milieu de la
 * relance, et l'en-tête du script parlé commençait au même paragraphe que la
 * phrase d'accueil, si bien que le commentaire « Script parlé engendré par
 * npm run podcasts… » se faisait entendre en ouverture de chaque fiche. Les
 * deux sont corrigés ici, et chaque script porte désormais la liste des
 * paragraphes où une partie commence, pour que la synthèse en note le repère.
 */
export const VERSION_SCRIPT = 6;

/* ══════════════════════════════════════════════════════════════════════════
   Tirage reproductible
   ══════════════════════════════════════════════════════════════════════════ */

/** Empreinte entière d'une chaîne (FNV-1a) : sert de graine au tirage. */
function graine(texte) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Choisit une variante en fonction d'une graine textuelle. */
function variante(liste, cle) {
  return liste[graine(cle) % liste.length];
}

/* ══════════════════════════════════════════════════════════════════════════
   Normalisation du texte dit à voix haute
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Juridictions et siècles : les fiches les citent en abrégé, la synthèse
 * vocale les épellerait ou les écorcherait.
 */
const REFERENCES = [
  [/\bCE Ass\./g, "Conseil d'État, Assemblée,"],
  [/\bCE Sect\./g, "Conseil d'État, Section,"],
  [/\bCE\s*,/g, "Conseil d'État,"],
  [/\bCass\.\s*Ass\.\s*pl[ée]n\./gi, 'Cassation, Assemblée plénière,'],
  [/\bCass\.\s*Crim\./gi, 'Cassation, chambre criminelle,'],
  [/\bCass\.\s*Civ\.\s*(\d)\s*(?:re|e)\b/gi, 'Cassation, $1e chambre civile,'],
  [/\bCass\.\s*Civ\./gi, 'Cassation, chambre civile,'],
  [/\bCass\.\s*Soc\./gi, 'Cassation, chambre sociale,'],
  [/\bCass\.\s*Com\./gi, 'Cassation, chambre commerciale,'],
  [/\bXXIe\b/g, 'vingt-et-unième'],
  [/\bXXe\b/g, 'vingtième'],
  [/\bXIXe\b/g, 'dix-neuvième'],
  [/\bXVIIIe\b/g, 'dix-huitième'],
  [/\bXVIIe\b/g, 'dix-septième'],
  [/\bXVIe\b/g, 'seizième'],
  [/\bXVe\b/g, 'quinzième'],
];

/*
   LES SIGLES FISCAUX (prompt 55, N°7, décision 5).

   Dits EN ENTIER la première fois d'une fiche, suivis du sigle épelé —
   « l'impôt sur le revenu, l'I.R. » —, puis épelés ensuite. Les points entre
   les lettres sont ce qui force la synthèse à épeler au lieu de tenter un
   mot : « IR » se dit « ir », « I.R. » se dit « i air ».

   La table est EXPLICITE et CLOSE : sept entrées, pas une de plus. Un sigle
   deviné serait développé faux, et un cours de fiscalité qui dit « l'impôt
   sur les sociétés » là où la fiche écrit « IS » n'est plus le même cours.
   DGFiP, IFiP, LOLF et OMS restent lus comme aujourd'hui — ils se
   prononcent, eux, et les épeler les rendrait moins clairs.

   L'article compte : « le CGI » se développe en « le code général des
   impôts », « la TVA » en « la taxe sur la valeur ajoutée ». On garde donc
   le genre avec le développement.
*/
export const SIGLES_FISCAUX = new Map([
  ['IR', { entier: 'impôt sur le revenu', epele: 'I.R.', genre: 'm' }],
  ['IS', { entier: 'impôt sur les sociétés', epele: 'I.S.', genre: 'm' }],
  ['TVA', { entier: 'taxe sur la valeur ajoutée', epele: 'T.V.A.', genre: 'f' }],
  ['CGI', { entier: 'code général des impôts', epele: 'C.G.I.', genre: 'm' }],
  ['LPF', { entier: 'livre des procédures fiscales', epele: 'L.P.F.', genre: 'm' }],
  ['CE', { entier: "Conseil d'État", epele: 'C.E.', genre: 'm' }],
  ['QPC', { entier: 'question prioritaire de constitutionnalité', epele: 'Q.P.C.', genre: 'f' }],
]);

/**
 * Prononciations que la synthèse écorche (prompt 55, N°7).
 *
 * Trois cas relevés par l'audit, et mesurés : « L. 169 » se disait « L point
 * cent-soixante-neuf », « N+3 » restait tel quel, et « Partie 2 » se disait
 * « partie deux » ou « partie seconde » selon l'humeur du moteur.
 */
const PRONONCIATIONS = [
  /* Les articles du Livre des procédures fiscales : « L. 169 » → « L 169 ». */
  [/\b([LRMD])\.\s*(?=\d)/g, '$1 '],
  /* « N+3 », « N-1 » : les exercices comptables. */
  [/\bN\s*\+\s*(\d)/g, 'N plus $1'],
  [/\bN\s*-\s*(\d)/g, 'N moins $1'],
];

/** Abréviations courantes des fiches, développées pour l'oreille. */
const ABREVIATIONS = [
  [/\bart\.\s*/gi, 'article '],
  [/\bal\.\s*(?=\d)/gi, 'alinéa '],
  [/\bn°\s*/gi, 'numéro '],
  [/\bcf\.\s*/gi, 'voir '],
  [/\bp\.\s*(?=\d)/g, 'page '],
  [/\bpp\.\s*(?=\d)/g, 'pages '],
  [/\bex\.\s*:/gi, 'par exemple :'],
  [/\betc\./gi, 'et cetera'],
  [/\bc\.-à-d\./gi, "c'est-à-dire"],
  [/\benv\.\s*(?=\d)/gi, 'environ '],
  [/\bMme\b/g, 'Madame'],
  [/\bMM\.\s*/g, 'Messieurs '],
  [/\bM\.\s+(?=[A-ZÉÈÀÂÎÔÛ])/g, 'Monsieur '],
  [/\bJO\b/g, 'Journal officiel'],
  [/\bsqq\b\.?/gi, 'et suivants'],
];

/** Symboles et unités : dits en toutes lettres plutôt qu'épelés ou tus. */
const SYMBOLES = [
  [/(\d)\s*Md€/g, '$1 milliards d\u2019euros'],
  [/(\d)\s*M€/g, '$1 millions d\u2019euros'],
  [/(\d)\s*k€/g, '$1 milliers d\u2019euros'],
  [/(\d)\s*€/g, '$1 euros'],
  [/€/g, ' euros'],
  [/(\d)\s*\$/g, '$1 dollars'],
  [/(\d)\s*%/g, '$1 pour cent'],
  [/%/g, ' pour cent'],
  [/(\d)\s*°C/g, '$1 degrés'],
  [/§\s*/g, 'paragraphe '],
  [/&/g, ' et '],
  [/≈/g, ' environ '],
  [/→/g, ' devient '],
  [/×/g, ' fois '],
];

/**
 * Les parenthèses deviennent des INCISES (prompt 55, N°10).
 *
 * Une parenthèse ne s'entend pas : la synthèse lit son contenu du même ton
 * que le reste, et le lecteur perd le fil de la phrase principale. Deux
 * virgules, elles, s'entendent — c'est la ponctuation de l'incise.
 *
 * Le point-virgule interne devient une virgule AU PASSAGE, et c'est tout
 * l'objet de la fonction. Sans cela, `aerer` le transformait plus tard en
 * point, et une fiche réelle s'entendait « (Jacques Vabre, 1975 pour la Cour
 * de cassation. Nicolo, 1989 pour le Conseil d'État) » : une chute de voix
 * en plein milieu d'une incise, donc une phrase qui semble finie et ne l'est
 * pas. C'est la coupure que N°10 interdit.
 */
function incises(texte) {
  return texte.replace(/\(([^()]{1,300})\)/g, (entier, dedans) => {
    const corps = dedans.trim().replace(/\s*;\s*/g, ', ').replace(/[.,;:\s]+$/, '');
    return corps ? `, ${corps},` : '';
  });
}

/**
 * Les renvois visuels (prompt 55, N°5).
 *
 * « Le tableau ci-dessus », « la liste ci-dessous », « voir le schéma
 * ci-contre » : à l'écran, l'œil sait où regarder. À l'oreille, il n'y a ni
 * dessus ni dessous, et l'auditeur cherche une chose qui n'existe pas. Le
 * renvoi devient donc temporel — « ce qu'on vient de voir », « ce qui
 * suit » —, ce qui est la seule chose vraie dans un flux de parole.
 */
const RENVOIS = [
  /*
     L'article n'est JAMAIS absorbé : « La liste ci-dessous récapitule »
     doit devenir « La liste qui suit récapitule », et non « ce qui suit
     récapitule » — qui perd la majuscule de début de phrase et change le
     sujet grammatical au passage.
  */
  [/\btableaux?\s+ci-dessus\b/gi, 'tableau qu\u2019on vient de voir'],
  [/\btableaux?\s+ci-dessous\b/gi, 'tableau qui suit'],
  [/\bliste\s+ci-dessus\b/gi, 'liste qu\u2019on vient d\u2019énumérer'],
  [/\bliste\s+ci-dessous\b/gi, 'liste qui suit'],
  [/\bsch[ée]mas?\s+ci-(?:dessus|contre|dessous)\b/gi, 'schéma à l\u2019écran'],
  [/\bci-dessus\b/gi, 'plus haut'],
  [/\bci-dessous\b/gi, 'juste après'],
  [/\bci-contre\b/gi, 'à l\u2019écran'],
];

/** Ponctuation décorative : muette à l'oral, elle ne doit pas gêner. */
const PONCTUATION = [
  [/[«»""„"]/g, ''],
  [/[—–]/g, ', '],
  [/\u2026/g, '.'],
  [/\[\^[^\]]*\]/g, ''],
  [/[*_`~]/g, ''],
  [/\s*\|\s*/g, ', '],
];

/**
 * Prépare une chaîne pour la synthèse vocale.
 *
 * L'ordre compte : les espaces fines des milliers sont d'abord recollées
 * (« 4 700 » doit se dire « quatre mille sept cents », pas « quatre, sept
 * cents »), puis viennent les unités, les abréviations et la ponctuation.
 */
export function parler(texte) {
  if (!texte) return '';
  let t = texte.normalize('NFC');

  t = t.replace(/(\d)[\u202f\u00a0\u2009](?=\d{3}\b)/g, '$1');
  t = t.replace(/[\u202f\u00a0\u2009]/g, ' ');

  for (const [motif, remplacement] of PRONONCIATIONS) t = t.replace(motif, remplacement);
  for (const [motif, remplacement] of REFERENCES) t = t.replace(motif, remplacement);
  for (const [motif, remplacement] of SYMBOLES) t = t.replace(motif, remplacement);
  for (const [motif, remplacement] of ABREVIATIONS) t = t.replace(motif, remplacement);
  for (const [motif, remplacement] of RENVOIS) t = t.replace(motif, remplacement);
  /* Avant la ponctuation décorative : l'incise pose des virgules que la suite nettoie. */
  t = incises(t);
  for (const [motif, remplacement] of PONCTUATION) t = t.replace(motif, remplacement);

  // Le français met une espace devant les ponctuations doubles : on la garde
  // (le script se relit), mais jamais devant la virgule ni le point.
  return nombresDeRepere(t)
    .replace(/\s+/g, ' ')
    // Développer « CE Ass., » ou « Cass. Crim., » laisse deux virgules.
    .replace(/,\s*,/g, ',')
    /*
       Une incise en fin de phrase laisse sa virgule fermante contre le
       point : « …pour le Conseil d'État,. » Elle s'entend — la synthèse
       marque la virgule puis le point —, et elle vient de la conversion des
       parenthèses en incises (N°10), là où la parenthèse tombait en fin de
       phrase. La virgule s'efface devant la ponctuation forte.
    */
    .replace(/,+(\s*[.!?])/g, '$1')
    .replace(/\s+([,.])/g, '$1')
    .replace(/\s*([;:!?])/g, ' $1')
    .trim();
}

/** Les nombres jusqu'à dix, en lettres : pour « Partie 2 » → « Partie deux ». */
const EN_LETTRES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
];

/**
 * « Partie 2 » se dit « Partie deux » (prompt 55, N°7).
 *
 * Seulement après les mots qui DÉSIGNENT un morceau de cours, et seulement
 * jusqu'à dix. Partout ailleurs, un chiffre reste un chiffre : « article 55 »
 * ne doit pas devenir « article cinquante-cinq », que la synthèse dit déjà
 * très bien, et « 1958 » encore moins.
 */
function nombresDeRepere(texte) {
  return texte.replace(
    /\b(partie|section|chapitre|titre|livre|étape)\s+(\d{1,2})\b/gi,
    (entier, mot, chiffre) => {
      const n = Number(chiffre);
      return n <= 10 ? `${mot} ${EN_LETTRES[n]}` : entier;
    },
  );
}

/** Termine une phrase par un point, sauf ponctuation forte déjà présente. */
function phrase(texte) {
  const t = parler(texte).replace(/[,;:\s]+$/, '');
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Minuscule initiale, pour enchaîner un titre après une relance. */
function minusculeInitiale(texte) {
  if (!texte) return texte;
  if (/^[A-ZÉÈÀÂÎÔÛ]{2,}\b/.test(texte)) return texte; // sigle : on n'y touche pas
  return texte[0].toLowerCase() + texte.slice(1);
}

/**
 * Applique la règle des sigles fiscaux à un paragraphe (N°7, décision 5).
 *
 * `dejaDits` est l'ensemble des sigles déjà rencontrés DANS CETTE FICHE : la
 * première occurrence est dite en entier puis épelée, les suivantes sont
 * seulement épelées. L'ensemble est donc modifié au passage, et c'est
 * voulu — la règle porte sur la fiche, pas sur le paragraphe.
 *
 * La casse compte, et c'est le fond de l'affaire : le motif n'attrape que des
 * MAJUSCULES. « IS » est un sigle, « is » est la fin d'un mot, et « Is » un
 * nom propre. Sans cette exigence, « il est » perdrait son verbe.
 */
function sigles(texte, dejaDits) {
  const motif = new RegExp(`\\b(${[...SIGLES_FISCAUX.keys()].join('|')})\\b`, 'g');
  return texte.replace(motif, (sigle) => {
    const entree = SIGLES_FISCAUX.get(sigle);
    if (!entree) return sigle;
    if (dejaDits.has(sigle)) return entree.epele;
    dejaDits.add(sigle);
    /*
       « l'impôt sur le revenu, l'I.R. » : l'élision se décide sur la
       première lettre du développement, et l'article sur son genre. Un
       « le impôt » trahirait la machine en une syllabe.
    */
    const voyelle = /^[aeéèiouyh]/i.test(entree.entier);
    const article = voyelle ? "l'" : entree.genre === 'f' ? 'la ' : 'le ';
    return `${article}${entree.entier}, ${voyelle ? "l'" : article}${entree.epele}`;
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Parcours du Markdown
   ══════════════════════════════════════════════════════════════════════════ */

/** Vrai si le nœud porte une image quelque part — N°12. */
function porteUneImage(noeud) {
  if (!noeud) return false;
  if (noeud.type === 'image' || noeud.type === 'imageReference') return true;
  return Array.isArray(noeud.children) && noeud.children.some(porteUneImage);
}

/*
   N°12 — LE CONTENU QUE L'AUDIO NE PEUT PAS LIRE (décision 7).

   `texteDe` rend la chaîne vide pour une image : elle est donc muette, sans
   un mot. À l'écran, la fiche montre un schéma ; à l'oreille, il n'a jamais
   existé — et l'auditeur qui révise cette fiche ignore qu'il lui manque
   quelque chose.

   UNE SEULE PHRASE, LA PREMIÈRE FOIS. La décision 7 est explicite sur ce
   point, et elle a raison : une fiche qui porte huit schémas répéterait
   huit fois la même phrase, et l'avertissement deviendrait du bruit.
*/
const PHRASE_DU_SCHEMA = 'La fiche montre ici un schéma : vous le retrouverez à l\u2019écran.';

function texteDe(noeud) {
  if (!noeud) return '';
  if (noeud.type === 'text' || noeud.type === 'inlineCode') return noeud.value;
  if (noeud.type === 'break') return ' ';
  if (noeud.type === 'image') return '';
  if (Array.isArray(noeud.children)) return noeud.children.map(texteDe).join('');
  return '';
}

/** Retire la numérotation décorative d'un titre (« I. », « 2) », « A — »). */
function titreNu(texte) {
  return texte
    .replace(/^\s*(?:[IVXLC]+|[A-H]|\d{1,2})\s*[).:–—-]\s*/u, '')
    .replace(/^\s*[).:–—-]\s*/u, '')
    .trim();
}

/** Un titre commençant par un déterminant s'enchaîne après un verbe. */
const ENCHAINABLE = /^(le |la |les |l['\u2019]|du |des |de la |d['\u2019]|un |une |ce |cette |ces )/i;

/* --- Relances : c'est là que se joue le naturel ------------------------- */

const OUVERTURE_PARTIE = [
  'On commence par',
  'Premier temps',
  'Entrons dans le vif du sujet',
  'Première chose à voir',
];
const SUITE_PARTIE = [
  'On passe à la suite',
  'Deuxième temps',
  'Venons-en maintenant à',
  'On enchaîne avec',
  'Changement de perspective',
];
const FIN_PARTIE = [
  'Dernier temps',
  'On termine par',
  'Reste un dernier bloc',
];

const OUVERTURE_POINT = [
  'Commençons par',
  'Premier point',
  'On démarre avec',
];
const SUITE_POINT = [
  'Voyons maintenant',
  'Un mot sur',
  'Venons-en à',
  'Autre point, et il compte',
  'Passons à',
  'Deuxième chose',
];
const FIN_POINT = [
  'Terminons avec',
  'Dernier point',
  'Et on finit sur',
];

/**
 * Transforme un titre en relance parlée.
 *
 * Deux écritures selon le titre : si celui-ci commence par un déterminant, la
 * relance se prolonge dedans (« On passe à la suite : la reconnaissance
 * juridique » devient « On enchaîne avec la reconnaissance juridique ») ;
 * sinon, on annonce d'abord, on énonce ensuite, avec deux-points.
 */
/** Les rangs, en lettres : « Deuxième partie, sur trois : … » (N°2). */
const RANGS = [
  'Première', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième',
  'Sixième', 'Septième', 'Huitième', 'Neuvième', 'Dixième',
];

/**
 * Les trois façons d'annoncer le rang d'une partie (prompt 55, N°2,
 * décision 2).
 *
 * La décision est explicite sur la forme : « Deuxième partie, sur trois :
 * … ». Les variantes de l'audit la déclinent sans jamais perdre les deux
 * nombres, parce que c'est leur présence qui situe l'auditeur — savoir
 * qu'on est à la deuxième ne dit rien s'il en reste six.
 */
const RANGS_DITS = [
  (rang, total, sujet) => `${rang} partie, sur ${total} : ${sujet}`,
  (rang, total, sujet) => `${rang} partie sur ${total}. ${majusculeInitiale(sujet)}`,
  (rang, total, sujet) => `On passe à la ${rang.toLowerCase()} partie, sur ${total} : ${sujet}`,
];

function relance(niveau, titre, index, total, cle) {
  const nu = titreNu(titre);
  if (!nu) return '';

  /*
     N°2 — LE RANG SE DIT, dès qu'il y a plus d'une partie.

     Les relances d'avant — « Premier temps », « On passe à la suite »,
     « Reste un dernier bloc » — disaient le MOUVEMENT mais jamais la
     POSITION. À la trentième minute d'une fiche, « on passe à la suite » ne
     dit pas s'il reste cinq minutes ou vingt, et c'est précisément ce qu'on
     veut savoir quand on écoute en marchant.

     Les deux nombres viennent du cours lui-même : `index` et `total` sont
     comptés sur les titres de la fiche. Rien d'inventé (interdit 1).

     Seulement pour les PARTIES (niveau 2 ou 3, décision 2 du prompt 46) :
     annoncer « troisième point sur sept » à l'intérieur d'une partie
     noierait le plan au lieu de l'éclairer.
  */
  if (niveau <= 3 && total > 1 && index < RANGS.length) {
    const sujet = minusculeInitiale(parler(nu));
    /*
       « On passe à la première partie » n'a pas de sens : on n'en vient pas,
       on y entre. La première partie ne tire donc que dans les formules qui
       ne supposent rien d'avant.
    */
    const formules = index === 0 ? RANGS_DITS.slice(0, 2) : RANGS_DITS;
    return phrase(
      variante(formules, `${cle}|rang|${index}|${nu}`)(RANGS[index], EN_LETTRES[total] ?? total, sujet),
    );
  }

  const familles = niveau <= 3
    ? { debut: OUVERTURE_PARTIE, milieu: SUITE_PARTIE, fin: FIN_PARTIE }
    : { debut: OUVERTURE_POINT, milieu: SUITE_POINT, fin: FIN_POINT };
  const liste = index === 0 ? familles.debut : index === total - 1 && total > 1 ? familles.fin : familles.milieu;
  const amorce = variante(liste, `${cle}|${niveau}|${index}|${nu}`);

  const sujet = minusculeInitiale(parler(nu));
  /*
     « On commence par » appelle un complément, « Premier temps » une pause.

     LE PIÈGE, et il a produit « Venons-en maintenant à : une crise qui
     recompose les rapports » dans des fiches réelles : en JavaScript sans
     le drapeau `u`, « \b » est une limite de mot ASCII, et « à » n'est pas
     un caractère de mot ASCII. « /\bà$/ » ne correspond donc JAMAIS —
     l'amorce la plus fréquente de la famille basculait toujours du côté
     des deux-points. Une limite explicite sur l'espace règle le cas sans
     dépendre de la table de caractères.
  */
  const fluide = /(?:^|\s)(?:par|à|avec|dans)$/.test(amorce) && ENCHAINABLE.test(nu);
  /* N°6 : la préposition se contracte devant l'article — « à les » n'existe pas. */
  const complement = fluide
    ? /^(?:à|de)$/.test(amorce.split(/\s+/).pop())
      ? `${amorce.replace(/\s*\S+$/, '')} ${apres(amorce.split(/\s+/).pop(), sujet)}`.trim()
      : `${amorce} ${sujet}`
    : `${amorce} : ${sujet}`;
  return phrase(complement);
}

/** Annonces d'un exergue, quand il ne porte pas déjà son étiquette. */
const EXERGUES = [
  'Et ça, c\u2019est important.',
  'Retenez bien ceci.',
  'Le point clé, le voici.',
  'Un point à ne pas manquer.',
];

/** Annonces d'un tableau un peu long. */
const TABLEAUX = [
  'Quelques repères, dans l\u2019ordre.',
  'Prenons-les un par un.',
  'Là, il faut retenir quelques repères.',
  'Voici les repères à garder en tête.',
];

/** Liaisons entre deux éléments d'une énumération. */
const LIAISONS = ['Ensuite', 'Et puis', 'Il y a aussi', 'Par ailleurs', 'Autre chose'];

/** Une ligne de tableau devient une phrase, articulée sur l'en-tête. */
function ligneTableau(entetes, cellules) {
  const valeurs = cellules.map((c) => parler(texteDe(c)).replace(/[.;,\s]+$/, ''));
  if (valeurs.every((v) => !v)) return '';
  if (valeurs.length === 1) return phrase(valeurs[0]);
  if (valeurs.length === 2) return phrase(`${valeurs[0]} : ${valeurs[1]}`);
  const suite = valeurs
    .slice(1)
    .map((v, i) => {
      const entete = entetes[i + 1] ? minusculeInitiale(entetes[i + 1]) : '';
      return entete ? `${entete}, ${minusculeInitiale(v)}` : v;
    })
    .filter(Boolean)
    .join(' ; ');
  return phrase(`${valeurs[0]} : ${suite}`);
}

/** Titre de la grande partie qui précède un titre secondaire. */
function derniereGrandePartie(arbre, cible) {
  let courante = '';
  for (const noeud of arbre.children) {
    if (noeud === cible) break;
    if (noeud.type === 'heading' && noeud.depth <= 3) courante = separerIdentifiant(texteDe(noeud)).texte;
  }
  return courante;
}

/**
 * Convertit le Markdown d'un cours en paragraphes parlés.
 * Un paragraphe du tableau retourné = une respiration à l'écoute.
 *
 * Chaque paragraphe porte, en plus de son texte, la partie dont il ouvre la
 * lecture (prompt 46, P2) — `null` pour tous les autres. C'est ce fil-là qui
 * permet à la synthèse de savoir, en cumulant les échantillons, à quelle
 * seconde chaque partie commence : sans lui, le script parlé est une suite de
 * paragraphes anonymes et le découpage du cours est perdu en route.
 */
function paragraphesDuCours(markdown, cle) {
  const arbre = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const sortie = [];
  const ajouter = (texte, titre = false, partie = null, exergue = null) => {
    const t = texte.trim();
    if (t) sortie.push({ texte: t, titre, partie, exergue });
  };

  // Rang de chaque titre parmi ses frères de même niveau : « Premier temps »,
  // « Dernier temps »… dépendent de cette position.
  /* N°12 : la phrase du schéma n'est dite qu'une fois par fiche. */
  let schemaAnnonce = false;

  const rangs = new Map();
  const totaux = new Map();
  const cleDe = (noeud) =>
    noeud.depth <= 3 ? 'partie' : `sous:${derniereGrandePartie(arbre, noeud)}`;
  for (const noeud of arbre.children) {
    if (noeud.type !== 'heading') continue;
    const k = cleDe(noeud);
    rangs.set(noeud, totaux.get(k) ?? 0);
    totaux.set(k, (totaux.get(k) ?? 0) + 1);
  }

  for (const noeud of arbre.children) {
    switch (noeud.type) {
      case 'heading': {
        /*
           L'identifiant se lit ICI, sur le nœud qui produit la relance, et
           non dans une liste extraite ailleurs qu'il faudrait recaler : le
           texte dit et le repère viennent alors forcément du même titre.
           Un titre de niveau 4 n'est pas une partie (décision 2) — son
           marqueur, s'il en portait un, serait simplement retiré du texte dit.
        */
        const { texte: titreNet, id } = separerIdentifiant(texteDe(noeud));
        const dite = relance(
          noeud.depth,
          titreNet,
          rangs.get(noeud) ?? 0,
          totaux.get(cleDe(noeud)) ?? 1,
          cle,
        );
        if (dite) {
          sortie.push({
            texte: dite.trim(),
            titre: true,
            partie: noeud.depth <= 3 ? id : null,
            exergue: null,
            /* Le titre BRUT de la partie : le récapitulatif de N°3 le reprend,
               et le plan de N°2 aussi. Le texte DIT, lui, porte déjà son rang
               (« Deuxième partie, sur trois : … ») et ne s'y prête pas. */
            titreBrut: noeud.depth <= 3 ? titreNet : null,
          });
        }
        break;
      }

      case 'paragraph': {
        const dit = phrase(texteDe(noeud));
        /*
           L'image peut être SEULE dans son paragraphe — c'est même le cas
           le plus fréquent —, et le texte dit est alors vide. La phrase du
           schéma doit donc être posée même quand il n'y a rien d'autre à
           dire, sinon le seul cas qui compte est précisément celui qu'on
           laisse passer.
        */
        if (porteUneImage(noeud) && !schemaAnnonce) {
          schemaAnnonce = true;
          ajouter(dit ? `${dit} ${PHRASE_DU_SCHEMA}` : PHRASE_DU_SCHEMA);
        } else {
          ajouter(dit);
        }
        break;
      }

      case 'blockquote': {
        const corps = noeud.children.map((e) => phrase(texteDe(e))).filter(Boolean).join(' ');
        if (!corps) break;
        // Les exergues des fiches s'ouvrent presque toujours sur leur propre
        // étiquette (« La règle : », « Le paradoxe : »). L'annoncer une
        // seconde fois lasserait : on ne le fait que pour les autres.
        const etiquete = /^[^.!?]{3,40}\s:\s/.test(corps);
        /* Marqué comme exergue : c'est de LÀ que N°3 tire son récapitulatif. */
        ajouter(etiquete ? corps : `${variante(EXERGUES, cle + corps.slice(0, 40))} ${corps}`, false, null, corps);
        break;
      }

      case 'list': {
        const elements = noeud.children.map((e) => texteDe(e).trim()).filter(Boolean);
        /*
           N°5 — LE NOMBRE D'ÉLÉMENTS, AU-DELÀ DE QUATRE.

           À l'écran, une liste à puces se compte d'un coup d'œil. À
           l'oreille, non : passé quatre éléments, on ne sait plus si l'on
           en est au troisième ou au cinquième, ni combien il en reste. Le
           nombre vient de la liste elle-même — rien d'inventé, interdit 1.

           Jusqu'à quatre, on se tait : « Deux choses à retenir » devant
           deux éléments alourdit sans rien apprendre.
        */
        if (elements.length > 4) {
          ajouter(phrase(`${EN_LETTRES[elements.length] ?? elements.length} points, dans l\u2019ordre`));
        }
        const morceaux = elements.map((brut, i) => {
          const contenu = parler(brut).replace(/^[-–—]\s*/, '');
          if (elements.length === 1) return phrase(contenu);
          if (i === 0) return phrase(`D'abord, ${minusculeInitiale(contenu)}`);
          if (i === elements.length - 1) return phrase(`Enfin, ${minusculeInitiale(contenu)}`);
          return phrase(`${LIAISONS[(i - 1) % LIAISONS.length]}, ${minusculeInitiale(contenu)}`);
        });
        ajouter(morceaux.filter(Boolean).join(' '));
        break;
      }

      case 'table': {
        const [entete, ...lignes] = noeud.children;
        const entetes = (entete?.children ?? []).map((c) => parler(texteDe(c)));
        const phrases = lignes.map((l) => ligneTableau(entetes, l.children ?? [])).filter(Boolean);
        if (!phrases.length) break;
        if (phrases.length >= 3) ajouter(variante(TABLEAUX, cle + phrases[0]));
        // Un tableau long se découpe : mieux vaut plusieurs respirations
        // qu'un paragraphe d'une minute.
        for (let i = 0; i < phrases.length; i += 4) ajouter(phrases.slice(i, i + 4).join(' '));
        break;
      }

      default:
        break; // thematicBreak, html, code : muets
    }
  }
  return sortie;
}

/* ══════════════════════════════════════════════════════════════════════════
   Digestibilité : des phrases qu'on peut suivre à l'oreille
   ══════════════════════════════════════════════════════════════════════════ */

/** Au-delà, la phrase est trop longue pour être suivie sans la relire. */
const MOTS_PHRASE_MAX = 34;

/**
 * Points de coupure d'une phrase trop longue.
 *
 * La liste est volontairement courte : ces trois marqueurs introduisent
 * presque toujours une proposition autonome. « , et », « , alors que » ou
 * « , tandis que » coordonnent aussi bien deux sujets que deux propositions —
 * y couper produirait une phrase bancale, et le sens prime sur le confort.
 */
const RUPTURES = [', mais ', ', car ', ', si bien que '];

/**
 * Les deux-points d'une énumération longue (prompt 55, N°11).
 *
 * Traités à part des RUPTURES, parce que la coupure ne se fait pas de la
 * même manière : la rupture remplace sa conjonction par un début de phrase,
 * là où les deux-points **restent** à la fin de la partie gauche. « Trois
 * conditions cumulatives : applicabilité, absence de déclaration, caractère
 * sérieux » doit s'entendre « Trois conditions cumulatives. Applicabilité,
 * absence… », et non « Trois conditions cumulatives. Et applicabilité… ».
 *
 * On ne coupe que si les DEUX côtés valent une phrase : couper « Trois
 * conditions : » d'un mot ferait une annonce suspendue dans le vide.
 */
function couperAuxDeuxPoints(p) {
  const position = p.indexOf(' : ');
  if (position === -1) return null;
  const gauche = p.slice(0, position).trim();
  const droite = p.slice(position + 3).trim();
  if (compterMots(gauche) < 4 || compterMots(droite) < 8) return null;
  return [`${gauche}.`, majusculeInitiale(droite)];
}

const compterMots = (t) => t.split(/\s+/).filter(Boolean).length;

/** Majuscule initiale, pour ouvrir une phrase issue d'une coupure. */
function majusculeInitiale(texte) {
  return texte ? texte[0].toUpperCase() + texte.slice(1) : texte;
}

/**
 * Coupe une phrase trop longue au point de rupture le plus proche de son
 * milieu — couper au premier venu déséquilibrerait les deux moitiés.
 */
function couperPhrase(p) {
  if (compterMots(p) <= MOTS_PHRASE_MAX) return [p];
  /*
     Les deux-points d'abord : dans une phrase qui annonce puis énumère,
     c'est LÀ qu'est la respiration naturelle, et aucune des ruptures
     ci-dessous ne tombe juste à l'intérieur d'une énumération.
  */
  const auxDeuxPoints = couperAuxDeuxPoints(p);
  if (auxDeuxPoints) return auxDeuxPoints.flatMap(couperPhrase);
  let meilleur = null;
  for (const rupture of RUPTURES) {
    let position = p.indexOf(rupture);
    while (position !== -1) {
      const gauche = compterMots(p.slice(0, position));
      const droite = compterMots(p.slice(position));
      if (gauche >= 12 && droite >= 12) {
        const ecart = Math.abs(gauche - droite);
        if (!meilleur || ecart < meilleur.ecart) meilleur = { position, rupture, ecart };
      }
      position = p.indexOf(rupture, position + 1);
    }
  }
  if (!meilleur) return [p];
  const gauche = p.slice(0, meilleur.position) + '.';
  const droite = majusculeInitiale(meilleur.rupture.replace(/^,\s*/, '')) + p.slice(meilleur.position + meilleur.rupture.length);
  return [...couperPhrase(gauche), ...couperPhrase(droite)];
}

/**
 * Aère un paragraphe : le point-virgule, qui s'entend mal, devient un point,
 * et les phrases interminables sont coupées. Rien n'est retiré du fond.
 */
function aerer(paragraphe) {
  const sansPointVirgule = paragraphe.replace(/\s*;\s*/g, (m, i, chaine) => {
    const suite = chaine.slice(i + m.length);
    return suite ? '. ' : '.';
  });
  const phrases = sansPointVirgule
    .split(/(?<=[.!?])\s+/)
    .map((p) => majusculeInitiale(p.trim()))
    .filter(Boolean)
    .flatMap(couperPhrase);
  return phrases.join(' ');
}

/* ══════════════════════════════════════════════════════════════════════════
   Explication des notions
   ══════════════════════════════════════════════════════════════════════════ */

/*
   LE GENRE DES NOMS QUI OUVRENT UNE DÉFINITION (prompt 55, N°8).

   Une définition de glossaire commence presque toujours par un nom nu —
   « Ensemble des règles… », « Principe selon lequel… », « Procédure
   permettant… ». Pour la dire comme une phrase, il faut lui rendre son
   article, donc connaître son genre.

   Cette table est EXPLICITE et CLOSE, et c'est ce qui la distingue d'une
   devinette : le genre d'un nom français est un fait vérifiable, pas une
   information de contenu. Un nom absent de la table ne reçoit aucun
   article : la glose garde alors l'apposition par virgule, qui est juste
   elle aussi. On n'invente jamais un genre pour faire joli — « c'est la
   principe » s'entendrait, et une faute dite est pire qu'une raideur.
*/
const GENRE_DES_OUVERTURES = new Map([
  ['ensemble', 'm'],
  ['principe', 'm'],
  ['mode', 'm'],
  ['instrument', 'm'],
  ['dispositif', 'm'],
  ['mécanisme', 'm'],
  ['document', 'm'],
  ['acte', 'm'],
  ['droit', 'm'],
  ['fait', 'm'],
  ['pouvoir', 'm'],
  ['organe', 'm'],
  ['texte', 'm'],
  ['moyen', 'm'],
  ['procédé', 'm'],
  ['contrôle', 'm'],
  ['procédure', 'f'],
  ['capacité', 'f'],
  ['règle', 'f'],
  ['action', 'f'],
  ['décision', 'f'],
  ['obligation', 'f'],
  ['autorité', 'f'],
  ['juridiction', 'f'],
  ['méthode', 'f'],
  ['situation', 'f'],
  ['opération', 'f'],
  ['faculté', 'f'],
  ['théorie', 'f'],
  ['norme', 'f'],
]);

/**
 * L'article défini qui convient au premier nom d'une définition, ou `null`
 * quand on ne le sait pas — auquel cas la glose change de tournure.
 */
function articleDeLaDefinition(definition) {
  const premier = normaliser(definition.split(/[\s,;:]+/)[0] ?? '');
  const genre = GENRE_DES_OUVERTURES.get(premier);
  if (!genre) return null;
  /* L'élision se décide sur la lettre, le genre ne sert qu'à défaut. */
  return /^[aeéèêiouyh]/i.test(premier) ? 'l\u2019' : genre === 'f' ? 'la ' : 'le ';
}

/** Manières d'introduire l'explication d'une notion croisée en chemin. */
const GLOSES = [
  (quoi) => `Un mot d\u2019explication sur ${quoi} :`,
  (quoi) => `Précisons ${quoi} :`,
  () => 'Petit rappel au passage :',
  () => 'Pour être sûr qu\u2019on parle de la même chose :',
  (quoi) => `Arrêtons-nous une seconde sur ${quoi} :`,
];

/** Une définition trop longue perd son auditeur : on garde les deux premières phrases. */
function definitionDite(definition) {
  const phrases = parler(definition).split(/(?<=[.!?])\s+/);
  let retenu = phrases[0] ?? '';
  if (compterMots(retenu) < 22 && phrases[1]) retenu += ' ' + phrases[1];
  return retenu.replace(/[\s.]+$/, '') + '.';
}

/**
 * Explique, à sa première occurrence, chaque notion du glossaire rencontrée.
 *
 * L'explication est dite juste après le paragraphe où le mot apparaît, comme
 * une parenthèse du formateur — plutôt qu'insérée au milieu de la phrase, qui
 * deviendrait illisible. Un sigle est d'abord développé.
 *
 * Entre et sort des paragraphes de la même forme — `{ texte, titre, partie }`.
 * Elle rendait auparavant des CHAÎNES quand le glossaire était vide, et des
 * objets sinon : le script parlé d'un dépôt sans glossaire s'écrivait alors
 * « [object Object] », paragraphe après paragraphe. Le défaut ne se voyait
 * pas parce que le glossaire réel n'est jamais vide.
 */
function expliquerNotions(paragraphes, glossaire, cle) {
  if (!glossaire?.length) return paragraphes;

  const { regex, parForme } = construireIndexGlossaire(glossaire, { longueurMinimale: 3 });
  if (!regex) return paragraphes;
  const parId = new Map(glossaire.map((g) => [idDeTerme(g.terme), g]));

  const expliques = new Set();
  const sortie = [];

  for (const entree of paragraphes) {
    const { texte: paragraphe, titre } = entree;
    sortie.push(entree);
    if (titre) continue; // une relance de titre ne s'interrompt pas
    const gloses = [];
    /*
       N°1 — LES TERMES ACCENTUÉS SONT ENFIN RECONNUS.

       `construireIndexGlossaire` bâtit son motif sur des formes
       NORMALISÉES, c'est-à-dire désaccentuées : « hiérarchie des normes » y
       devient « hierarchie des normes ». Cherché tel quel dans le texte
       accentué de la fiche, ce motif ne correspondait JAMAIS — et le
       podcast n'expliquait donc aucun terme accentué, c'est-à-dire la
       plupart d'entre eux. Mesuré sur les fiches d'exemple : zéro glose sur
       « hiérarchie des normes », « bloc de constitutionnalité » et
       « question prioritaire de constitutionnalité », quand « gouvernance »
       et « soft power » étaient bien glosés.

       Le site, lui, n'avait pas le défaut : son plugin remark cherche dans
       `normaliserPositions(texte)`, qui désaccentue SANS changer la
       longueur — chaque position du texte normalisé désigne donc le même
       caractère dans l'original. C'est la même mécanique ici : on cherche
       dans la copie normalisée, et on relit l'occurrence dans l'original à
       la position trouvée.
    */
    const cherchable = normaliserPositions(paragraphe);
    for (const occurrence of cherchable.matchAll(regex)) {
      /* L'occurrence TELLE QU'ELLE EST ÉCRITE, pour la dire et pour juger sa casse. */
      const brute = paragraphe.slice(occurrence.index, occurrence.index + occurrence[1].length);
      const entree = parForme.get(normaliser(occurrence[1]));
      if (!entree || expliques.has(entree.id)) continue;
      const terme = parId.get(entree.id);
      if (!terme?.definition) continue;
      expliques.add(entree.id);
      // Deux explications d'affilée alourdissent : les suivantes attendront
      // leur prochaine occurrence, dans un paragraphe ultérieur.
      if (gloses.length >= 2) {
        expliques.delete(entree.id);
        continue;
      }
      /*
         N°1, second volet — UN MOT COURANT N'EST PLUS PRIS POUR UN SIGLE.

         Le motif du glossaire est insensible à la casse. Une forme qui est
         un SIGLE — « CAS », « IS », « RSI » — était donc attrapée sur le mot
         courant écrit en minuscules : « les cas sont nombreux » déclenchait
         la glose de « CAS », et l'auditeur entendait expliquer un sigle
         qu'on venait de lui inventer.

         La règle : une forme écrite tout en majuscules dans le glossaire ne
         correspond qu'à une occurrence écrite tout en majuscules dans la
         fiche. Les autres formes restent insensibles à la casse, parce
         qu'un terme en début de phrase porte une capitale.
      */
      const formeEstUnSigle = /^[A-ZÉÈÀÂÎÔÛ0-9.]{2,}$/.test(entree.forme);
      if (formeEstUnSigle && brute !== entree.forme) continue;
      const sigle = /^[A-ZÉÈÀ0-9]{2,}$/.test(brute) && normaliser(brute) !== normaliser(terme.terme);
      const amorce = variante(GLOSES, cle + entree.id);
      /*
         N°8 — UNE GLOSE SE DIT COMME UNE PHRASE.

         Avant ce prompt, la glose s'entendait « Pour être sûr qu'on parle de
         la même chose : Gouvernance. Ensemble des règles et processus… » :
         une entrée de dictionnaire lue à voix haute, le terme isolé entre
         deux points. On la dit maintenant « la gouvernance, c'est l'ensemble
         des règles… », c'est-à-dire comme un formateur la dirait.

         La définition perd sa majuscule initiale et son article éventuel est
         conservé : « Ensemble des règles » devient « l'ensemble des règles »
         seulement si la définition ne commence pas déjà par un déterminant.
      */
      /*
         DEUX FORMES, ET POURQUOI PAS UNE SEULE.

         Quand la définition commence par un DÉTERMINANT — « Ensemble des
         règles… », « Un mode de coopération… » —, la tournure parlée de
         l'audit s'applique telle quelle : « la gouvernance, c'est
         l'ensemble des règles… ».

         Quand elle commence par un nom NU — « Principe selon lequel… »,
         « Procédure permettant… » —, il faudrait lui fournir un article, et
         donc connaître son GENRE. Le glossaire ne le déclare pas, et le
         deviner produirait « c'est l'principe » ou « c'est la principe » :
         une faute dite à voix haute, ce qui est pire que la raideur qu'on
         voulait corriger. On garde alors l'apposition par deux-points —
         « hiérarchie des normes : principe d'organisation de l'ordre
         juridique… » —, qui est la forme définitionnelle française
         ordinaire et qui, elle, est juste.

         N°8 est donc appliqué là où il peut l'être sans inventer une donnée
         que le glossaire ne porte pas. L'interdit 1 du prompt 55 est net :
         si une information manque, la phrase est omise, pas complétée.
      */
      const definition = definitionDite(terme.definition);
      const dejaDetermine =
        ENCHAINABLE.test(definition) || /^(il|elle|on|c\u2019|c'|ce )/i.test(definition);
      const article = dejaDetermine ? '' : articleDeLaDefinition(definition);
      /* `null` = genre inconnu : on ne force rien, et la tournure change. */
      const avecDeterminant = dejaDetermine || article !== null;
      const nom = minusculeInitiale(parler(terme.terme));
      const nomDit = sigle ? `${brute}, c\u2019est-à-dire ${nom}` : nom;
      gloses.push(
        avecDeterminant
          ? `${amorce(sigle ? 'ce sigle' : 'ce terme')} ${nomDit}, c\u2019est ${article ?? ''}${minusculeInitiale(definition)}`
          /* Une VIRGULE, et non un second deux-points : l'amorce en porte
             déjà un, et « ce terme : hiérarchie des normes : principe… »
             s'entend comme deux annonces pour une seule explication.
             L'apposition par virgule est la forme française ordinaire. */
          : `${amorce(sigle ? 'ce sigle' : 'ce terme')} ${nomDit}, ${minusculeInitiale(definition)}`,
      );
    }
    /* Une glose appartient à la partie en cours, mais n'en ouvre aucune :
       elle ne porte donc jamais de repère. */
    for (const glose of gloses) {
      sortie.push({ texte: glose, titre: false, partie: null, exergue: null });
    }
  }
  return sortie;
}

/** Identifiant d'un terme, identique à celui du glossaire du site. */
function idDeTerme(terme) {
  return normaliser(terme).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ══════════════════════════════════════════════════════════════════════════
   Script complet
   ══════════════════════════════════════════════════════════════════════════ */

/** Débit moyen retenu pour l'estimation de durée (mots par minute). */
const MOTS_PAR_MINUTE = 145;

/**
 * Ouvertures et clôtures : volontairement proches d'une fiche à l'autre —
 * c'est ce qui donne au tout une identité de podcast — mais pas identiques au
 * mot près, pour ne pas donner l'impression d'un message enregistré.
 */
/**
 * Contracte l'article qui suit une préposition : « parle de les styles »
 * doit se dire « parle des styles ». Sans cela, chaque titre commençant par
 * un article trahirait la machine dès la première phrase.
 */
function apres(preposition, sujet) {
  const s = sujet.trim();
  if (preposition === 'de') {
    if (/^les\s/i.test(s)) return `des ${s.slice(4)}`;
    if (/^le\s/i.test(s)) return `du ${s.slice(3)}`;
    /*
       L'ÉLISION, qui manquait : un titre qui commence par une voyelle
       donnait « on parle de essai », « consacrée à une analyse ». Le second
       est correct, le premier non — « de » s'élide devant une voyelle, « à »
       jamais. On ne touche donc qu'à « de ».
    */
    if (/^[aeéèêiouyh]/i.test(s)) return `d\u2019${s}`;
    return `de ${s}`;
  }
  if (/^les\s/i.test(s)) return `aux ${s.slice(4)}`;
  if (/^le\s/i.test(s)) return `au ${s.slice(3)}`;
  return `à ${s}`;
}

/*
   LE GÉNÉRIQUE (prompt 55, N°9, décisions 3 et 6).

   Avant : trois phrases, une quarantaine de mots, environ 35 secondes avant
   d'entrer dans le cours. Sur une fiche de dix minutes, c'est 6 % du temps
   passé à dire bonjour — et les mêmes mots à chaque fiche, puisque trois
   variantes se répètent vite quand on en écoute vingt.

   Maintenant : CINQ accueils de quinze mots au plus, et le compte est
   vérifié par un essai. L'ouverture tombe autour de vingt secondes.
*/
const ACCUEILS = [
  (t) => `Fiche audio. Aujourd'hui, on parle ${apres('de', t)}.`,
  (t) => `Fiche audio, consacrée ${apres('à', t)}.`,
  (t) => `Au programme : ${t}.`,
  (t) => `On ouvre une fiche audio ${apres('de', t)}.`,
  (t) => `Voici la fiche audio consacrée ${apres('à', t)}.`,
];

/*
   DÉCISION 6 — « première écoute sans rien noter » EST REMPLACÉE.

   Les trois anciennes formules invitaient à une PREMIÈRE écoute sans
   crayon. Elles étaient fausses dès la deuxième : on réécoute une fiche
   audio, c'est même tout l'intérêt d'en avoir une, et s'entendre dire
   « écoutez d'abord sans rien noter » à la quatrième écoute sonne comme un
   enregistrement qui ne sait pas à qui il parle.

   La formule retenue vaut à chaque écoute, et annonce le récapitulatif que
   N°3 ajoute à la fin — elle est donc vraie, en plus d'être valable.
*/
const INVITATIONS = [
  'Laissez-vous porter, on reviendra à l\u2019essentiel à la fin.',
  'Laissez-vous porter : l\u2019essentiel sera repris à la fin.',
  'Laissez-vous porter, et gardez l\u2019essentiel pour la fin.',
];

const CONGES = [
  'Redites-vous à voix haute deux ou trois choses que vous retenez.',
  'Avant de passer à autre chose, redites-vous l\u2019essentiel à voix haute.',
  'Reformulez l\u2019essentiel de mémoire : c\u2019est là que ça s\u2019ancre.',
];

/**
 * Le plan annoncé à l'ouverture (prompt 55, N°2).
 *
 * Il vient des TITRES DE PARTIE de la fiche, et de rien d'autre : interdit 1
 * du prompt 55 — « plans, récapitulatifs, nombres d'éléments viennent de la
 * fiche ou de ses cartes, jamais d'une rédaction libre ».
 *
 * Rend la chaîne vide quand il n'y a rien à annoncer : une partie unique n'est
 * pas un plan, et « au programme : une partie » serait comique.
 */
function planAnnonce(titresDeParties) {
  if (titresDeParties.length < 2) return '';
  const nombre = EN_LETTRES[titresDeParties.length] ?? titresDeParties.length;
  const dits = titresDeParties.map((t) => minusculeInitiale(parler(titreNu(t))).replace(/\.$/, ''));
  return phrase(`${majusculeInitiale(nombre)} parties : ${dits.join(' ; ')}`);
}

/**
 * Le récapitulatif de fin de partie (prompt 55, N°3, décision 1).
 *
 * Construit à partir du TITRE de la partie et de ses EXERGUES, tels quels.
 * Si la partie n'a pas d'exergue, le récapitulatif se réduit au rappel de son
 * titre ; s'il n'y a ni l'un ni l'autre, il n'y a pas de récapitulatif. Rien
 * n'est résumé par nos soins : un résumé rédigé serait exactement la
 * « rédaction libre » que l'interdit 1 écarte.
 */
function recapitulatif(titreDeLaPartie, exergues) {
  const titre = minusculeInitiale(parler(titreNu(titreDeLaPartie))).replace(/\.$/, '');
  if (!titre) return '';
  if (!exergues.length) return phrase(`Récapitulatif : ${titre}`);
  /* Deux exergues suffisent : au-delà, le récapitulatif redit la partie. */
  const retenus = exergues.slice(0, 2).map((e) => e.replace(/\s+$/, ''));
  return phrase(`Récapitulatif : ${titre}. ${retenus.join(' ')}`);
}

/** Au-delà, la question est trop longue pour l'oreille (N°3). */
const MOTS_QUESTION_MAX = 30;

/** Le silence laissé pour chercher la réponse, en millisecondes (N°3). */
export const SILENCE_QUESTION_MS = 4000;

/**
 * La question de rappel d'une partie (prompt 55, N°3, décision 1).
 *
 * Elle vient d'une CARTE rattachée à la partie — le champ `partie` du prompt
 * 46, P4. Pas de carte rattachée, pas de question : on n'en fabrique pas une,
 * et c'est écrit noir sur blanc dans le prompt.
 *
 * Rend `null`, ou bien `{ question, reponse }`. Le SILENCE entre les deux
 * n'est pas dans le texte : il est déclaré à part, par rang de paragraphe,
 * exactement comme les repères de partie. Voir la note sur `silences` dans
 * `ecrireScript`.
 */
function questionDeRappel(cartes, partieId) {
  if (!partieId) return null;
  const candidate = (cartes ?? []).find((c) => c.partie === partieId && c.question && c.reponse);
  if (!candidate) return null;
  const question = parler(candidate.question);
  /*
     Une question de plus de trente mots ne se retient pas le temps de
     chercher sa réponse : on l'omet plutôt que de la poser à moitié.
  */
  if (compterMots(question) > MOTS_QUESTION_MAX) return null;
  return {
    question: phrase(`Question : ${question}`),
    reponse: phrase(`Réponse : ${parler(candidate.reponse)}`),
  };
}

/**
 * Écrit le script parlé d'une fiche.
 * Retourne « null » si la fiche n'a pas de cours à dire.
 */
export function ecrireScript({ titre, matiere, fascicule, cours, glossaire, flashcards }) {
  const cle = `${matiere}|${fascicule}|${titre}`;
  const bruts = paragraphesDuCours(cours ?? '', cle);
  if (!bruts.length) return null;
  const corps = expliquerNotions(
    bruts.map((p) => ({ ...p, texte: aerer(p.texte) })),
    glossaire,
    cle,
  );

  const titreDit = minusculeInitiale(parler(titre).replace(/[.\s]+$/, ''));
  const matiereDite = parler(matiere).replace(/[.\s]+$/, '');
  // « Fascicule 2 — Les acteurs… » : le tiret ne s'entend pas, la virgule si.
  const fasciculeDit = parler((fascicule ?? '').replace(/\s*[—–]\s*/, ', ')).replace(/[.\s]+$/, '');

  const ouverture = [
    variante(ACCUEILS, cle)(titreDit),
    fasciculeDit ? `Nous sommes en ${matiereDite}, ${minusculeInitiale(fasciculeDit)}.` : `Nous sommes en ${matiereDite}.`,
    variante(INVITATIONS, cle + 'i'),
  ].join(' ');

  const cloture = [
    /* « pour » appelle le titre nu : `apres('de', …)` y mettrait « de » ou
       « d' », et « Voilà pour d'essai » ne se dit pas. */
    `Voilà pour ${titreDit}.`,
    variante(CONGES, cle + 'c'),
    'La fiche simplifiée, les flashcards et le quiz vous attendent. À bientôt.',
  ].join(' ');

  /*
     ══════════════════════════════════════════════════════════════════════
     N°3 — LE RÉCAPITULATIF ET LA QUESTION DE RAPPEL (décision 1)
     ══════════════════════════════════════════════════════════════════════

     Posés à la FIN de chaque partie, c'est-à-dire juste avant la relance de
     la suivante, et après la dernière pour la dernière partie. Trois
     paragraphes au plus, dans cet ord:

       1. « Récapitulatif : <titre de la partie>. <exergues> »
       2. « Question : … »
       3. « Réponse : … »

     Ce qui n'existe pas n'est pas dit : une partie sans exergue a un
     récapitulatif réduit à son titre, une partie sans carte rattachée n'a
     pas de question du tout, et une question de plus de trente mots est
     omise. Jamais de phrase complétée au jugé — interdit 1.

     LE SILENCE DE QUATRE SECONDES n'est PAS dans le texte. Il est déclaré à
     part, par rang de paragraphe, comme les repères de partie du 46 : le
     paragraphe « Réponse : … » est annoncé comme devant être précédé de
     4 000 ms de silence au lieu de la respiration ordinaire.

     C'est un choix, et il vaut d'être dit. Le prompt propose un marqueur
     dans le texte, « par exemple [[silence 4000]] ». Or le garde-fou
     anti-fuite du prompt 43 refuse déjà les crochets doubles — et il a
     raison, puisque tout ce qui reste dans le texte sera PRONONCÉ. Poser le
     marqueur dans le texte dit aurait obligé à percer une exception dans
     cette table, c'est-à-dire à affaiblir le seul contrôle qui garde
     l'audio des fuites techniques. Déclaré à part, le marqueur ne peut pas
     être prononcé : il n'est jamais un mot. La table reste intacte, et
     l'essai anti-fuite la vérifie sans aménagement.
  */
  const aDire = [];
  const silences = [];
  const questionsPosees = [];

  const finirLaPartie = (partie) => {
    if (!partie?.titreBrut) return;
    const recap = recapitulatif(partie.titreBrut, partie.exergues);
    if (recap) aDire.push({ texte: recap, partie: null });
    const rappel = questionDeRappel(flashcards, partie.id);
    if (!rappel) return;
    aDire.push({ texte: rappel.question, partie: null });
    /* Le silence précède la réponse : son rang se connaîtra une ligne plus bas. */
    aDire.push({ texte: rappel.reponse, partie: null, silenceAvant: SILENCE_QUESTION_MS });
    questionsPosees.push(partie.id);
  };

  let enCours = null;
  for (const paragraphe of corps) {
    if (paragraphe.partie) {
      finirLaPartie(enCours);
      enCours = { id: paragraphe.partie, titreBrut: paragraphe.titreBrut, exergues: [] };
    } else if (enCours && paragraphe.exergue) {
      enCours.exergues.push(paragraphe.exergue);
    }
    aDire.push(paragraphe);
  }
  finirLaPartie(enCours);

  /*
     LES SIGLES FISCAUX, EN DERNIER (prompt 55, N°7, décision 5).

     Appliqués ici, et non plus tôt, pour deux raisons :

     - la règle porte sur la PREMIÈRE occurrence de la fiche, dans l'ordre
       où l'on l'entend. Il faut donc la liste complète et définitive des
       paragraphes, ouverture comprise — un sigle dans le titre est bien la
       première fois qu'on l'entend ;
     - appliqués avant les gloses du glossaire, ils auraient remplacé « IR »
       par son développement, et la glose du glossaire ne l'aurait plus
       reconnu.

     Les rangs de paragraphe ne bougent pas : on remplace du texte, on
     n'insère rien. Les repères de partie et les silences déclarés restent
     donc valides.
  */
  const siglesDits = new Set();
  const paragraphes = [ouverture, ...aDire.map((p) => p.texte), cloture].map((p) =>
    sigles(p, siglesDits),
  );
  aDire.forEach((p, i) => {
    if (p.silenceAvant) silences.push({ paragraphe: i + 1, ms: p.silenceAvant });
  });
  const mots = paragraphes.join(' ').split(/\s+/).filter(Boolean).length;

  /*
     OÙ CHAQUE PARTIE COMMENCE À SE DIRE (prompt 46, P2).

     Un rang de paragraphe, pas une seconde : à ce stade personne ne sait
     combien de temps durera la parole. C'est la synthèse qui convertira,
     en cumulant les échantillons qu'elle produit — seul endroit où le
     chiffre est exact plutôt qu'estimé.

     Le décalage de 1 n'est pas un détail : la phrase d'accueil occupe le
     paragraphe 0, et le corps commence au suivant.
  */
  /*
     Les repères se comptent sur « aDire », et non sur « corps » : les
     récapitulatifs et les questions de N°3 s'y intercalent, et un repère
     compté avant leur insertion tomberait quelques paragraphes trop tôt.
     C'est exactement le genre d'écart qui ne se voit qu'à l'écoute, une
     fois l'audio produit et chiffré.
  */
  const parties = aDire
    .map((p, i) => (p.partie ? { id: p.partie, paragraphe: i + 1 } : null))
    .filter(Boolean);

  return {
    paragraphes,
    parties,
    silences,
    questionsPosees,
    mots,
    secondesEstimees: Math.round((mots / MOTS_PAR_MINUTE) * 60),
  };
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  LE GARDE-FOU ANTI-FUITE (prompt 43, lot 2)                              */
/* ════════════════════════════════════════════════════════════════════════ */

/*
   CE QU'ON NE VEUT JAMAIS ENTENDRE. Un script parlé est lu à voix haute par
   une synthèse qui ne saute rien : tout ce qui reste de la syntaxe du
   Markdown, du HTML ou de l'en-tête d'une fiche sera PRONONCÉ. « accolade
   dièse », « deux astérisques », « h deux », « http deux points slash
   slash » — et la personne qui écoute, elle, n'a aucun moyen de savoir que
   c'est une coquille et non une phrase du cours.

   La règle est donc en deux endroits et une seule définition : cette table
   sert au contrôle (`npm run essais:scripts-parles`) ET à la construction,
   qui refuse de produire un audio à partir d'un script fautif. Si les deux
   divergeaient un jour, le contrôle passerait au vert sur un audio déjà
   livré faux.

   CE QUI N'EST PAS UNE FUITE, et il faut le dire, parce que la première
   version de ce garde-fou s'y est trompée. « Sources : Insee » est une
   phrase française parfaitement normale, et la typographie française met
   une espace avant le deux-points. Une clé d'en-tête, elle, s'écrit
   « titre: » — minuscules, collée au deux-points, en tête de ligne. C'est
   cette forme-là, et elle seule, qu'on refuse.
*/
export const MOTIFS_DE_FUITE = [
  { nom: 'attribut d’accolade « {# »', motif: /\{#/ },
  { nom: 'attribut d’accolade « {: »', motif: /\{:/ },
  { nom: 'commentaire HTML', motif: /<!--|-->/ },
  { nom: 'balise HTML', motif: /<\/?[a-z][a-z0-9]*(?:\s[^>]*)?>/i },
  { nom: 'dièse de titre Markdown', motif: /(?:^|\n)\s*#{1,6}\s/ },
  { nom: 'astérisques de Markdown', motif: /\*\*|(?:^|\s)\*\S/ },
  { nom: 'accent grave', motif: /`/ },
  { nom: 'lien Markdown', motif: /\]\(/ },
  { nom: 'crochets doubles', motif: /\[\[|\]\]/ },
  { nom: 'adresse web', motif: /https?:\/\/|\bwww\./ },
  { nom: 'séparateur de tableau', motif: /\|\s*-{3,}/ },
  { nom: 'barre de tableau', motif: /\s\|\s/ },
  { nom: 'conteneur « ::: »', motif: /:::/ },
  { nom: 'chevron de citation', motif: /(?:^|\n)\s*>\s/ },
  {
    /* Minuscules ASCII, collées au deux-points, en tête de ligne : la forme
       d'une clé d'en-tête, jamais celle d'une phrase française. */
    nom: 'clé d’en-tête technique',
    motif: /(?:^|\n)[a-z_][a-z0-9_]*:(?:\s|$)/,
  },
];

/**
 * Les fuites techniques d'un script parlé, chacune nommée et située.
 *
 * Rend un tableau vide quand tout est dicible. Chaque entrée porte le rang
 * du paragraphe, le nom du motif, et l'extrait fautif avec son voisinage —
 * de quoi retrouver la ligne dans la fiche sans la chercher.
 */
export function fuitesDuScript(paragraphes) {
  const fuites = [];
  (paragraphes ?? []).forEach((paragraphe, rang) => {
    for (const { nom, motif } of MOTIFS_DE_FUITE) {
      const trouve = motif.exec(paragraphe);
      if (!trouve) continue;
      fuites.push({
        rang,
        nom,
        extrait: paragraphe
          .slice(Math.max(0, trouve.index - 40), trouve.index + 60)
          .replace(/\n/g, '⏎'),
      });
    }
  });
  return fuites;
}
