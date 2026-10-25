/**
 * La copie de concours : le sujet, ses zones de réponse, et la feuille de fin.
 *
 * ## Pourquoi un module, et pas du code dans l'écran
 *
 * `dgfip.astro` fait déjà huit cents lignes et porte le format « une question
 * à la fois », son historique et sa correction détaillée. La copie en est une
 * seconde présentation, pas une variante : elle dessine un sujet entier, une
 * zone par question, un formulaire de soixante zones. L'y ajouter aurait rendu
 * illisible ce qui marche déjà.
 *
 * Rien ici n'est en Svelte : la copie manipule le DOM directement, comme
 * l'écran qui l'appelle. Le pont Svelte de `features/correction` existe parce
 * que la correction partage ses composants avec Cog-Training ; la copie ne
 * partage rien, et un composant de plus n'achèterait rien.
 *
 * ## Ce que ce module ne décide pas
 *
 * - **il ne note rien** : la règle de lecture et le barème sont dans
 *   `lib/qcm-copie.ts`, module pur, éprouvé ligne par ligne du tableau C2 ;
 * - **il ne refuse rien** : la zone laisse cocher deux cases sur une ligne et
 *   ne prévient pas, exactement comme au concours. La directive 4 s'applique
 *   à la correction ;
 * - **il n'écrit aucune couleur** : le papier, l'encre, les cases et les
 *   marques sortent des familles Tailwind que les quatorze thèmes
 *   redéfinissent. La copie suit donc les thèmes sans une ligne de plus.
 *
 * ## L'ordre des questions
 *
 * Celui du tirage, qui entremêle les rubriques — c'est le choix du moteur,
 * et son commentaire dit pourquoi : « pour que les rubriques s'entremêlent
 * comme à l'épreuve ». La rubrique s'affiche donc en intertitre **quand elle
 * change**, et non en tête de paquets regroupés : regrouper reviendrait à
 * réécrire l'ordre du tirage, ce que le prompt ne demande pas.
 */
import {
  LIBELLE_DU_MOTIF,
  ZONES_DU_FORMULAIRE,
  caseDeLOption,
  lireLaZone,
  optionDeLaCase,
  type Zone,
} from '../../lib/qcm-copie';
import { insecables } from '../../lib/typographie';

/** Ce que la copie a besoin de savoir d'une question. */
export interface QuestionDeLaCopie {
  rubrique: string;
  question: string;
  options: string[];
  /** L'ordre d'affichage des propositions, posé par le tirage. */
  ordre: number[];
}

/* ══════════════════════════════════════════════════════════════════════════
   Les briques du papier
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une case de la feuille : carrée, bordée, et de 44 px au moins.
 *
 * Quarante-quatre pixels est le confort tactile du prompt 41, et une grille
 * de cinq cases plus les gouttières tient dans les 328 px utiles d'un écran
 * de 360. Les réduire aurait rendu la copie plus jolie et moins remplissable
 * au doigt, ce qui est le contraire du but.
 */
function caseDeReponse(options: {
  etiquette: string;
  nomAccessible: string;
  cochee: boolean;
  surClic?: () => void;
}): HTMLButtonElement {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.textContent = options.etiquette;
  bouton.setAttribute('role', 'checkbox');
  bouton.setAttribute('aria-checked', String(options.cochee));
  bouton.setAttribute('aria-label', options.nomAccessible);
  /*
     Une case cochée ne se décoche pas : on ne rature pas sur papier.
     « aria-disabled » plutôt que « disabled » — la case reste atteignable au
     clavier et son état reste annoncé, mais le lecteur d'écran dit qu'elle
     ne changera plus. La désactiver tout court la sortirait de la
     tabulation, et la personne ne pourrait plus vérifier ce qu'elle a coché.
  */
  if (options.cochee) bouton.setAttribute('aria-disabled', 'true');
  bouton.className = [
    'inline-flex size-11 shrink-0 items-center justify-center',
    'border-2 border-slate-400 dark:border-slate-500',
    'font-serif text-sm',
    options.cochee
      ? 'bg-slate-800 text-slate-50 dark:bg-slate-200 dark:text-slate-900'
      : 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300',
    options.surClic && !options.cochee ? 'hover:bg-slate-200 dark:hover:bg-slate-800' : '',
  ].join(' ');
  if (options.surClic && !options.cochee) bouton.addEventListener('click', options.surClic);
  return bouton;
}

/** Une ligne de la zone : les cases numérotées, puis « Ann ». */
function ligneDeZone(options: {
  numeroDeQuestion: number;
  rang: 'premiere' | 'seconde';
  question: QuestionDeLaCopie;
  zone: Zone;
  surCocher?: (ligne: 'premiere' | 'seconde', option: number) => void;
  surAnnuler?: (ligne: 'premiere' | 'seconde') => void;
}): HTMLDivElement {
  const { numeroDeQuestion, rang, question, zone } = options;
  const ligne = zone[rang];
  const nomDeLaLigne = rang === 'premiere' ? '1ʳᵉ ligne' : '2ᵉ ligne';

  const boite = document.createElement('div');
  boite.className = 'flex items-center gap-1.5';
  boite.setAttribute('role', 'group');
  boite.setAttribute('aria-label', `Question ${numeroDeQuestion}, ${nomDeLaLigne}`);
  boite.dataset.ligne = rang;

  for (let numero = 1; numero <= question.ordre.length; numero += 1) {
    const option = optionDeLaCase(question.ordre, numero)!;
    boite.appendChild(
      caseDeReponse({
        etiquette: String(numero),
        nomAccessible: `Question ${numeroDeQuestion}, ${nomDeLaLigne}, case ${numero}`,
        cochee: ligne.cases.includes(option),
        surClic: options.surCocher ? () => options.surCocher!(rang, option) : undefined,
      }),
    );
  }

  const ann = caseDeReponse({
    etiquette: 'Ann',
    nomAccessible: `Question ${numeroDeQuestion}, ${nomDeLaLigne}, annuler`,
    cochee: ligne.ann,
    surClic: options.surAnnuler ? () => options.surAnnuler!(rang) : undefined,
  });
  /* « Ann » est plus large que les chiffres : trois lettres ne tiennent pas
     dans un carré de 44 px sans rogner la police. */
  ann.className = ann.className.replace('size-11', 'h-11 min-w-14 px-1');
  boite.appendChild(ann);

  return boite;
}

/** La zone de réponse d'une question : deux lignes, sous son énoncé. */
export function zoneDeReponse(options: {
  numeroDeQuestion: number;
  question: QuestionDeLaCopie;
  zone: Zone;
  surCocher?: (ligne: 'premiere' | 'seconde', option: number) => void;
  surAnnuler?: (ligne: 'premiere' | 'seconde') => void;
}): HTMLDivElement {
  const bloc = document.createElement('div');
  bloc.className =
    'mt-3 w-fit space-y-1.5 border border-slate-300 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-900';
  bloc.setAttribute('role', 'group');
  bloc.setAttribute('aria-label', `Zone de réponse de la question ${options.numeroDeQuestion}`);
  bloc.dataset.zone = String(options.numeroDeQuestion);
  for (const rang of ['premiere', 'seconde'] as const) {
    bloc.appendChild(ligneDeZone({ ...options, rang }));
  }
  return bloc;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le sujet
   ══════════════════════════════════════════════════════════════════════════ */

/** Les directives 4 à 7, dans les termes du sujet 2026. */
const DIRECTIVES: readonly string[] = [
  'Vous avez le choix entre 4 réponses possibles : 1, 2, 3 ou 4. Une seule réponse par question est autorisée. Toute réponse multiple sera assimilée à une réponse inexacte.',
  'Si vous souhaitez vous abstenir de répondre, vous pouvez cocher la case « Ann » ou ne cocher aucune case. Une réponse fausse est pénalisée ; l’absence de réponse vaut zéro.',
  'Si vous désirez modifier votre première réponse, ne raturez pas : indiquez votre nouvelle réponse sur la 2ᵉ ligne.',
  'Si vous souhaitez annuler votre réponse de la 1ʳᵉ ligne ou de la 2ᵉ ligne, vous pouvez cocher la case « Ann ».',
];

export interface OptionsDuSujet {
  questions: readonly QuestionDeLaCopie[];
  zones: readonly Zone[];
  surCocher: (indice: number, ligne: 'premiere' | 'seconde', option: number) => void;
  surAnnuler: (indice: number, ligne: 'premiere' | 'seconde') => void;
}

/**
 * Dessine le sujet entier, zones comprises.
 *
 * Tout est remplacé à chaque appel plutôt que mis à jour case par case : un
 * sujet de quarante-cinq questions se redessine en quelques millisecondes, et
 * une mise à jour fine demanderait de tenir à jour autant de références que de
 * cases — pour un gain qu'on ne mesurerait pas.
 */
export function monterLeSujet(cible: HTMLElement, options: OptionsDuSujet): void {
  cible.innerHTML = '';

  /* ── Le bandeau d'identification, volontairement neutre ───────────────── */
  const bandeau = document.createElement('div');
  bandeau.className =
    'border-2 border-slate-400 bg-slate-100 px-4 py-3 font-serif dark:border-slate-600 dark:bg-slate-900';
  const identite = document.createElement('p');
  identite.className = 'text-sm font-semibold text-slate-900 dark:text-slate-100';
  identite.textContent = 'Candidat — épreuve blanche';
  const rappel = document.createElement('p');
  rappel.className = 'mt-0.5 text-xs text-slate-600 dark:text-slate-400';
  /*
     AUCUN NOM, AUCUNE DONNÉE PERSONNELLE sur la copie : c'est l'interdit
     n° 4. Le bandeau existe parce que la feuille réelle en a un, et il reste
     une zone neutre — y mettre un prénom n'apprendrait rien et sortirait une
     donnée du coffre pour la poser sur un écran.
  */
  rappel.textContent = 'Aucun nom n’est demandé : cette copie ne quitte pas votre appareil.';
  bandeau.append(identite, rappel);

  const entete = document.createElement('p');
  entete.className = 'mt-3 font-serif text-sm font-semibold text-slate-900 dark:text-slate-100';
  entete.textContent = 'Répondre sur la feuille de réponse';

  /* ── L'aide, repliée ──────────────────────────────────────────────────── */
  const aide = document.createElement('details');
  aide.className = 'mt-2 font-serif text-sm';
  const resume = document.createElement('summary');
  resume.className = 'cible-tactile cursor-pointer text-slate-700 underline dark:text-slate-300';
  resume.textContent = 'Comment remplir la feuille de réponse';
  const liste = document.createElement('ol');
  liste.className = 'mt-2 list-decimal space-y-1 pl-5 text-slate-600 dark:text-slate-400';
  for (const directive of DIRECTIVES) {
    const li = document.createElement('li');
    li.textContent = insecables(directive);
    liste.appendChild(li);
  }
  aide.append(resume, liste);

  cible.append(bandeau, entete, aide);

  /* ── Les questions ────────────────────────────────────────────────────── */
  let rubriquePrecedente = '';
  options.questions.forEach((question, indice) => {
    if (question.rubrique !== rubriquePrecedente) {
      rubriquePrecedente = question.rubrique;
      const intertitre = document.createElement('h3');
      intertitre.className =
        'mt-8 border-b border-slate-300 pb-1 font-serif text-base font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100';
      intertitre.textContent = question.rubrique;
      cible.appendChild(intertitre);
    }

    const article = document.createElement('article');
    article.className = 'mt-5 font-serif';
    article.dataset.question = String(indice + 1);

    const numero = document.createElement('p');
    numero.className = 'text-sm font-bold text-slate-900 dark:text-slate-100';
    numero.textContent = `Q${indice + 1}`;

    const enonce = document.createElement('p');
    enonce.className = 'mt-0.5 text-base leading-relaxed text-slate-900 dark:text-slate-100';
    enonce.textContent = insecables(question.question);

    const propositions = document.createElement('ol');
    propositions.className = 'mt-2 space-y-0.5 text-base text-slate-800 dark:text-slate-200';
    question.ordre.forEach((option, rang) => {
      const li = document.createElement('li');
      li.className = 'flex gap-2';
      const marque = document.createElement('span');
      marque.className = 'shrink-0 tabular-nums';
      marque.textContent = `${rang + 1}.`;
      const texte = document.createElement('span');
      texte.textContent = insecables(question.options[option]);
      li.append(marque, texte);
      propositions.appendChild(li);
    });

    article.append(numero, enonce, propositions);
    article.appendChild(
      zoneDeReponse({
        numeroDeQuestion: indice + 1,
        question,
        zone: options.zones[indice],
        surCocher: (ligne, option) => options.surCocher(indice, ligne, option),
        surAnnuler: (ligne) => options.surAnnuler(indice, ligne),
      }),
    );
    cible.appendChild(article);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   La feuille de réponse, à l'issue de l'épreuve
   ══════════════════════════════════════════════════════════════════════════ */

export interface OptionsDeLaFeuille {
  questions: readonly QuestionDeLaCopie[];
  zones: readonly Zone[];
  /** Les bonnes réponses, par question, en indices d'option. */
  bonnes: readonly (readonly number[])[];
}

/**
 * La feuille pré-imprimée telle qu'elle a été remplie — les soixante zones.
 *
 * Le formulaire officiel en compte soixante, quel que soit le nombre de
 * questions : « vous ne devrez servir que les N premières zones ». Les
 * afficher toutes, et griser celles au-delà de N, est ce qui rend la feuille
 * reconnaissable — et ce qui rappelle le piège du jour de l'épreuve, où l'on
 * décale tout d'une ligne.
 */
export function monterLaFeuille(cible: HTMLElement, options: OptionsDeLaFeuille): void {
  cible.innerHTML = '';
  const n = options.questions.length;

  const grille = document.createElement('div');
  /* Deux colonnes sur téléphone, trois sur écran large (C4). */
  grille.className = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

  for (let debut = 0; debut < ZONES_DU_FORMULAIRE; debut += 20) {
    const colonne = document.createElement('div');
    colonne.className = 'min-w-0';

    const tete = document.createElement('p');
    tete.className =
      'mb-1 flex gap-1.5 font-serif text-xs text-slate-500 tabular-nums dark:text-slate-400';
    tete.setAttribute('aria-hidden', 'true');
    /* « 1 2 3 4 Ann » en tête de chaque colonne, comme sur la feuille. */
    const vide = document.createElement('span');
    vide.className = 'w-8 shrink-0';
    tete.appendChild(vide);
    for (const etiquette of ['1', '2', '3', '4', 'Ann']) {
      const span = document.createElement('span');
      span.className = etiquette === 'Ann' ? 'min-w-8 text-center' : 'w-6 text-center';
      span.textContent = etiquette;
      tete.appendChild(span);
    }
    colonne.appendChild(tete);

    for (let rang = debut; rang < Math.min(debut + 20, ZONES_DU_FORMULAIRE); rang += 1) {
      colonne.appendChild(ligneDeLaFeuille(rang, n, options));
    }
    grille.appendChild(colonne);
  }
  cible.appendChild(grille);
}

/** Une zone de la feuille de fin : son numéro, ses cases, et ce qui en est lu. */
function ligneDeLaFeuille(
  rang: number,
  n: number,
  options: OptionsDeLaFeuille,
): HTMLDivElement {
  const numero = rang + 1;
  const servie = rang < n;

  const ligne = document.createElement('div');
  /*
     « flex-wrap » : sur une colonne étroite, la marge passe SOUS les cases
     plutôt que d'être rognée. La première version la tronquait — « retenu :
     case 3 (2… » —, ce qui revenait à ne pas l'écrire : C4 demande qu'on y
     lise la réponse retenue ET la bonne.
  */
  ligne.className =
    'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-b border-slate-200 py-1 dark:border-slate-800';
  ligne.dataset.zoneFinale = String(numero);
  if (!servie) ligne.dataset.grisee = 'oui';

  const etiquette = document.createElement('span');
  etiquette.className = `w-8 shrink-0 font-serif text-xs tabular-nums ${
    servie ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'
  }`;
  etiquette.textContent = String(numero);
  ligne.appendChild(etiquette);

  if (!servie) {
    /*
       Au-delà de N, la zone est grisée et vide. Elle n'est pas masquée : la
       feuille en compte soixante, et la voir incomplète est l'information.
    */
    const barre = document.createElement('span');
    barre.className = 'h-5 flex-1 bg-slate-100 dark:bg-slate-900';
    barre.setAttribute('aria-hidden', 'true');
    ligne.appendChild(barre);
    return ligne;
  }

  const question = options.questions[rang];
  const zone = options.zones[rang];
  const lecture = lireLaZone(zone);

  for (let caseNumero = 1; caseNumero <= 4; caseNumero += 1) {
    const option = optionDeLaCase(question.ordre, caseNumero);
    const cochee =
      option !== undefined &&
      (zone.premiere.cases.includes(option) || zone.seconde.cases.includes(option));
    const petite = document.createElement('span');
    petite.className = [
      'inline-flex size-5 shrink-0 items-center justify-center border',
      'border-slate-400 dark:border-slate-500',
      cochee ? 'bg-slate-800 dark:bg-slate-200' : 'bg-slate-50 dark:bg-slate-950',
    ].join(' ');
    petite.setAttribute('aria-hidden', 'true');
    ligne.appendChild(petite);
  }

  const annCochee = zone.premiere.ann || zone.seconde.ann;
  const ann = document.createElement('span');
  ann.className = [
    'inline-flex h-5 min-w-8 shrink-0 items-center justify-center border',
    'border-slate-400 dark:border-slate-500',
    annCochee ? 'bg-slate-800 dark:bg-slate-200' : 'bg-slate-50 dark:bg-slate-950',
  ].join(' ');
  ann.setAttribute('aria-hidden', 'true');
  ligne.appendChild(ann);

  /*
     EN MARGE : la réponse retenue, d'où elle vient, et la bonne.

     Le motif compte autant que la case. « 2ᵉ ligne » dit une correction
     réussie ; « Réponse multiple » dit une faute de remplissage qui a coûté
     un demi-point sans que la connaissance soit en cause. Les confondre
     ferait réviser la mauvaise chose.
  */
  const marge = document.createElement('span');
  marge.className =
    'ml-1 min-w-0 flex-1 text-xs leading-tight text-slate-600 dark:text-slate-400';
  const retenue =
    lecture.retenue === null
      ? LIBELLE_DU_MOTIF[lecture.motif]
      : `case ${caseDeLOption(question.ordre, lecture.retenue)}, ${LIBELLE_DU_MOTIF[lecture.motif]}`;
  const attendue = options.bonnes[rang]
    .map((o) => caseDeLOption(question.ordre, o))
    .filter((c) => c > 0)
    .join(', ');
  marge.textContent = `retenu : ${retenue} — attendu : case ${attendue}`;
  /*
     Les cases attendues sont aussi posées en attribut. Ce n'est pas pour le
     style : c'est ce qui rend le filtre de la copie vérifiable de bout en
     bout. Une zone ne doit jamais annoncer deux cases attendues, ni une
     cinquième ; l'essai le lit ici, sur le tirage réel.
  */
  marge.dataset.attendue = attendue;
  ligne.appendChild(marge);

  return ligne;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le bilan par thème
   ══════════════════════════════════════════════════════════════════════════ */

export interface LigneDeTheme {
  rubrique: string;
  /** Les numéros de question de cette rubrique, dans l'ordre du sujet. */
  numeros: number[];
  /** L'issue de chaque numéro, dans le même ordre. */
  issues: ('bonne' | 'mauvaise' | 'abstention')[];
  /** Les points de la rubrique, déjà formatés. */
  points: string;
}

/**
 * Le signe de chaque issue, et pourquoi il y en a un.
 *
 * **Jamais la couleur seule** (C4). Un daltonien, une capture en noir et
 * blanc, un écran en plein soleil : trois façons ordinaires de perdre la
 * couleur, et dans les trois cas le bilan deviendrait illisible. Le signe
 * porte l'information, la couleur la renforce.
 */
const SIGNE = { bonne: '✓', mauvaise: '✗', abstention: '–' } as const;

const DIT = {
  bonne: 'juste',
  mauvaise: 'faux',
  abstention: 'sans réponse',
} as const;

const TEINTE = {
  bonne: 'border-emerald-600 text-emerald-800 dark:border-emerald-400 dark:text-emerald-200',
  mauvaise: 'border-red-600 text-red-800 dark:border-red-400 dark:text-red-200',
  abstention: 'border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-400',
} as const;

/**
 * Les numéros de question groupés par rubrique, avec le score de chacune.
 *
 * Toucher un numéro mène à sa correction : c'est le seul chemin rapide entre
 * « j'ai raté la 23 » et ce qu'il fallait répondre. Sans lui, il faudrait
 * parcourir quarante-cinq corrections pour retrouver une question.
 */
export function monterLesThemes(
  cible: HTMLElement,
  lignes: readonly LigneDeTheme[],
  surClic: (numero: number) => void,
): void {
  cible.innerHTML = '';
  for (const ligne of lignes) {
    const bloc = document.createElement('div');
    bloc.className = 'border-b border-slate-200 py-2 dark:border-slate-800';
    bloc.dataset.theme = ligne.rubrique;

    const tete = document.createElement('div');
    tete.className = 'flex flex-wrap items-baseline justify-between gap-x-3';
    const nom = document.createElement('p');
    nom.className = 'font-medium text-slate-900 dark:text-white';
    nom.textContent = ligne.rubrique;
    const points = document.createElement('p');
    points.className = 'text-sm text-slate-600 tabular-nums dark:text-slate-300';
    points.textContent = ligne.points;
    tete.append(nom, points);

    const numeros = document.createElement('ul');
    numeros.className = 'mt-1.5 flex flex-wrap gap-1.5';
    ligne.numeros.forEach((numero, rang) => {
      const issue = ligne.issues[rang];
      const li = document.createElement('li');
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.dataset.numero = String(numero);
      bouton.dataset.issue = issue;
      bouton.className = [
        'cible-tactile inline-flex min-w-11 items-center justify-center gap-1',
        'rounded border-2 px-1.5 text-sm tabular-nums',
        TEINTE[issue],
      ].join(' ');
      /*
         Le signe est dans le bouton, le mot est dans son nom accessible : un
         lecteur d'écran dit « question 23, faux » plutôt que « question 23,
         croix ».
      */
      bouton.textContent = `${numero} ${SIGNE[issue]}`;
      bouton.setAttribute('aria-label', `Question ${numero}, ${DIT[issue]}`);
      bouton.addEventListener('click', () => surClic(numero));
      li.appendChild(bouton);
      numeros.appendChild(li);
    });

    bloc.append(tete, numeros);
    cible.appendChild(bloc);
  }
}
