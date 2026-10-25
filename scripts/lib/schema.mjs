/**
 * Validation du format des fiches (front-matter + sections) avec Zod.
 *
 * Note d'architecture : la validation se fait ici, dans le script de build,
 * et non via une « content collection » Astro. Raison : une content collection
 * expose le contenu au moteur de rendu d'Astro, avec le risque qu'un fragment
 * en clair se retrouve dans « dist/ » — ce qui annulerait le chiffrement.
 * Le contenu en clair ne traverse donc jamais Astro.
 */
import { z } from 'zod';
import { defautsDesDonnees } from './visuels.mjs';

export const frontMatterSchema = z.object({
  matiere: z.string().min(1, 'le champ « matiere » est obligatoire'),
  fascicule: z.string().min(1, 'le champ « fascicule » est obligatoire'),
  titre: z.string().min(1, 'le champ « titre » est obligatoire'),
  ordre: z.coerce.number().int().default(999),
  tags: z.array(z.string()).default([]),
  /**
   * L'identifiant publié d'une fiche, quand son chemin d'origine est perdu.
   *
   * ## Pourquoi ce champ existe
   *
   * D'ordinaire `ficheId = idStable(cheminRelatif)` : l'identifiant se déduit
   * du chemin, ne révèle rien, et survit aux reconstructions. C'est un bon
   * choix, et il tient à une condition — que le chemin ne change pas.
   *
   * La perte de `content/` a cassé cette condition. Le corpus a été récupéré
   * depuis la publication chiffrée, mais le chemin n'y est pas publié : pour
   * une cinquantaine de fiches sur 427, il n'a pas pu être certifié. Replacées
   * ailleurs, elles recevaient un identifiant NEUF — et toute la progression
   * enregistrée dans le navigateur, rangée par identifiant de fiche, devenait
   * orpheline. Leur fiche audio aussi, nommée par ce même identifiant : 33
   * audios déjà synthétisés redevenaient introuvables.
   *
   * Ce champ permet à une fiche de déclarer l'identifiant sous lequel elle a
   * été publiée. Le build l'emploie tel quel, et la progression de qui révise
   * continue de tomber juste malgré un chemin approximatif.
   *
   * ## Ce qu'il ne faut pas en faire
   *
   * Ce n'est pas un identifiant à écrire sur une fiche neuve : une fiche neuve
   * n'a pas d'identifiant antérieur, et en inventer un retirerait à `idStable`
   * la seule chose qu'il garantit. Le champ est une réparation, pas une
   * manière d'écrire. Deux fiches qui déclareraient le même identifiant se
   * confondraient à l'écran, et le build le refuse.
   */
  id_publie: z
    .string()
    .regex(
      /^[0-9a-f]{16}$/,
      'un identifiant publié s’écrit en seize caractères hexadécimaux minuscules',
    )
    .optional(),
});

/**
 * Les identifiants publiés déclarés deux fois.
 *
 * Deux fiches sous le même identifiant, c'est une fiche qui en écrase une
 * autre : la bibliothèque n'en montre qu'une, et la progression des deux se
 * mélange. Le contrôle vit ici, et non dans le build, pour être éprouvé sans
 * construire quoi que ce soit.
 */
export function idsPubliesEnDouble(fiches) {
  const vus = new Map();
  for (const f of fiches) {
    if (!f.id_publie) continue;
    if (!vus.has(f.id_publie)) vus.set(f.id_publie, []);
    vus.get(f.id_publie).push(f.chemin);
  }
  return [...vus.entries()]
    .filter(([, chemins]) => chemins.length > 1)
    .map(([id, chemins]) => ({ id, chemins }));
}

/**
 * L'identifiant d'une partie de fiche, tel qu'une carte ou un QCM le cite
 * (prompt 46, P4). Facultatif : son absence veut dire « la fiche entière »,
 * et c'est le cas par défaut de tout ce qui a été écrit avant.
 */
const partieCitee = z
  .string()
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u,
    'un identifiant de partie s’écrit en lettres, chiffres, tirets et soulignés',
  )
  .optional();

export const flashcardSchema = z
  .object({
    q: z.string().optional(),
    question: z.string().optional(),
    r: z.string().optional(),
    reponse: z.string().optional(),
    partie: partieCitee,
  })
  .transform((v, ctx) => {
    const question = v.q ?? v.question;
    const reponse = v.r ?? v.reponse;
    if (!question) {
      ctx.addIssue({ code: 'custom', message: 'flashcard sans « q: » (question)' });
      return z.NEVER;
    }
    if (!reponse) {
      ctx.addIssue({ code: 'custom', message: `flashcard « ${question} » sans « r: » (réponse)` });
      return z.NEVER;
    }
    return {
      question: String(question).trim(),
      reponse: String(reponse).trim(),
      ...(v.partie ? { partie: v.partie } : {}),
    };
  });

/**
 * Le visuel d'une correction, décrit en données et non en SVG.
 *
 * Pourquoi déclaratif : un SVG écrit à la main dans le contenu fige ses
 * couleurs, et le site a deux thèmes. Il fige aussi sa largeur, et le site se
 * lit sur téléphone. En décrivant le visuel par ses données, c'est un composant
 * du site qui le dessine — avec les tokens du thème actif, un « viewBox » qui
 * s'adapte, et l'alternative textuelle au bon endroit.
 *
 * Et `type: aucun` est une **décision**, pas une absence : il faut dire
 * pourquoi aucun dessin n'aiderait. Sans cette obligation, « aucun » devient le
 * choix par défaut de qui n'a pas réfléchi, et la règle « un visuel quand la
 * question porte sur une structure qui se dessine » ne veut plus rien dire.
 */
export const TYPES_VISUEL = [
  'frise',
  'tableau',
  'schema',
  'courbe',
  'venn',
  'figure',
  'grille',
  'texte_annote',
  'aucun',
];

export const visuelSchema = z
  .object({
    type: z.enum(TYPES_VISUEL, {
      message: `« visuel.type » doit valoir l'un de : ${TYPES_VISUEL.join(', ')}`,
    }),
    donnees: z.unknown().optional(),
    legende: z.string().optional(),
    alt: z.string().optional(),
    raison_aucun: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'aucun') {
      if (!v.raison_aucun?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: '« visuel.type: aucun » exige « raison_aucun » : dites pourquoi aucun dessin n’aiderait',
        });
      }
      return;
    }
    if (v.donnees === undefined || v.donnees === null) {
      ctx.addIssue({ code: 'custom', message: `« visuel.type: ${v.type} » sans « donnees »` });
    } else {
      /*
       * `donnees` était déclaré `unknown`, et c'était un trou : une frise sans
       * jalons, un tableau dont une ligne a trois cellules pour quatre
       * colonnes, un schéma dont un lien pointe vers un nœud absent — tout cela
       * passait le contrôle et n'échouait qu'**au rendu**, devant la personne
       * qui révise, au moment où elle demande la correction d'une question
       * ratée. La validation déplace la faute vers le build, seul endroit où
       * elle peut encore être corrigée.
       */
      for (const message of defautsDesDonnees(v.type, v.donnees)) {
        ctx.addIssue({ code: 'custom', message });
      }
    }
    if (!v.alt?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: `« visuel.type: ${v.type} » sans « alt » : l’alternative textuelle est obligatoire`,
      });
    }
  });

/**
 * La correction détaillée d'une question de QCM.
 *
 * Contrairement aux exercices de Cog-Training, dont la correction est calculée
 * par un solveur, celle-ci est **rédigée et stockée** : la question vient d'une
 * banque, il n'y a pas de dérivation à produire. Elle reste adaptée à la
 * réponse donnée, mais c'est l'ordre d'affichage qui varie, pas le contenu.
 *
 * `par_option` porte un verdict **par option**, et la cohérence avec la clef de
 * réponse est vérifiée dans les schémas qui connaissent les options : une
 * correction qui déclarerait juste une option que la clef donne fausse est
 * l'équivalent écrit d'une trace qui contredit sa conclusion, et aussi nuisible.
 *
 * `confiance: moyenne` s'affiche à la personne. C'est le cas des sujets sans
 * corrigé officiel, dont la réponse a été établie par recherche et
 * raisonnement : le dire vaut mieux que de présenter une déduction comme une
 * certitude.
 */
export const correctionSchema = z.object({
  resume: z.string().min(1, '« correction.resume » est obligatoire'),
  par_option: z
    .array(
      z.object({
        verdict: z.enum(['juste', 'faux'], { message: '« verdict » vaut « juste » ou « faux »' }),
        pourquoi: z.string().min(1, 'chaque option doit dire pourquoi elle est juste ou fausse'),
        /**
         * Le marqueur d'une option que la clef donne fausse sans qu'elle soit
         * pour autant absurde. Facultatif, et restreint à « possible » : les
         * autres marqueurs du vocabulaire décrivent soit des éléments de
         * schéma, soit la réponse donnée, que l'écran déduit seul.
         */
        marqueur: z
          .literal('possible', { message: '« marqueur » ne vaut que « possible »' })
          .optional(),
      }),
    )
    .min(2, '« par_option » a besoin d’une entrée par option'),
  detail: z.string().min(1, '« correction.detail » est obligatoire'),
  /** Identifiants de fiche, pour le lien « rappel de cours ». */
  rappel_de_cours: z.array(z.string()).default([]),
  sources: z
    .array(z.object({ nom: z.string().min(1), url: z.string().optional() }))
    .default([]),
  confiance: z.enum(['haute', 'moyenne'], {
    message: '« confiance » vaut « haute » ou « moyenne »',
  }),
  visuel: visuelSchema,
}).superRefine((v, ctx) => {
  /*
   * La prose d'une correction est affichée **telle quelle**, et non rendue en
   * Markdown : les composants reçoivent du texte, pas du HTML. Un « **forme** »
   * écrit par réflexe s'affiche donc avec ses astérisques, au milieu d'une
   * phrase par ailleurs soignée — défaut invisible à la relecture du YAML, et
   * parfaitement visible à l'écran. Il s'est produit dès la première correction
   * écrite ; le refuser ici évite de le répéter quatre mille fois.
   */
  const prose = [
    ['resume', v.resume],
    ['detail', v.detail],
    ...v.par_option.map((o, i) => [`par_option.${i + 1}.pourquoi`, o.pourquoi]),
    ['visuel.legende', v.visuel?.legende],
    ['visuel.alt', v.visuel?.alt],
    ['visuel.raison_aucun', v.visuel?.raison_aucun],
  ];
  for (const [ou, texte] of prose) {
    if (typeof texte === 'string' && /\*\*|`/.test(texte)) {
      ctx.addIssue({
        code: 'custom',
        message:
          `« ${ou} » contient du Markdown (« ** » ou « \` ») : la prose des corrections ` +
          'est affichée telle quelle, les marques resteraient visibles à l’écran.',
      });
    }
  }

  /*
   * « marqueur: possible » dit d'une option fausse qu'elle reste défendable.
   * Un seul emploi le contredit, et il est silencieux à la lecture : sur une
   * option que la clef donne JUSTE, le marqueur ne veut rien dire. La bonne
   * réponse n'est pas « possible », elle est la réponse, et l'écran la marque
   * déjà comme telle.
   *
   * Il n'y a **pas** de condition sur « confiance », et c'est un choix revu.
   * Elle a d'abord été exigée à « moyenne », au motif qu'un corrigé officiel
   * tranchant la question n'y laisserait aucune option compatible. La mesure a
   * démenti le raisonnement : les deux champs portent sur des axes
   * indépendants. « confiance » dit si LA CLEF est certaine ; « possible » dit
   * si UN DISTRACTEUR est défendable. « Qui a peint La Liberté guidant le
   * peuple ? » a une clef certaine — Delacroix — et Géricault reste le
   * distracteur le plus défendable qu'on puisse offrir. La condition aurait
   * écarté 29 des 32 corrections qui emploient le marqueur, et justement
   * celles où il apprend quelque chose.
   */
  v.par_option.forEach((o, i) => {
    if (o.marqueur === undefined) return;
    if (o.verdict === 'juste') {
      ctx.addIssue({
        code: 'custom',
        message:
          `« par_option.${i + 1} » porte « marqueur: possible » sur un verdict ` +
          '« juste » : la bonne réponse n’est pas « possible », elle est la réponse.',
      });
    }
  });
});

/**
 * La correction contredit-elle la clef de réponse ?
 *
 * Appelé par les deux schémas de question, là où options et bonnes réponses
 * sont connues. Trois façons de se tromper, et les trois sont silencieuses à
 * la lecture : un nombre d'entrées qui ne correspond pas aux options, une
 * option déclarée juste que la clef donne fausse, et l'inverse.
 */
export function defautsDeLaCorrection(correction, options, bonnes) {
  if (!correction) return [];
  const defauts = [];
  if (correction.par_option.length !== options.length) {
    defauts.push(
      `« par_option » compte ${correction.par_option.length} entrée(s) pour ${options.length} option(s)`,
    );
    return defauts;
  }
  const cle = new Set(bonnes);
  correction.par_option.forEach((entree, i) => {
    const juste = entree.verdict === 'juste';
    if (juste && !cle.has(i)) {
      defauts.push(`option ${i + 1} (« ${options[i]} ») donnée juste par la correction, fausse par la clef`);
    }
    if (!juste && cle.has(i)) {
      defauts.push(`option ${i + 1} (« ${options[i]} ») donnée fausse par la correction, juste par la clef`);
    }
  });
  return defauts;
}

/**
 * À quelle option correspond une réponse donnée par son texte ?
 *
 * L'appariement était insensible à la casse, et c'est un piège : une fiche sur
 * l'usage des majuscules proposait « La Cour d'appel » et « la cour d'appel »
 * comme deux options distinctes — la seule différence étant justement ce que la
 * question évalue. Mises en minuscules, les deux se confondaient, et la
 * première l'emportait : la fiche était silencieusement clefée sur la mauvaise
 * réponse, sans que rien ne le signale ni au build, ni à l'écran.
 *
 * D'où trois temps, dans cet ordre. La correspondance exacte d'abord : quand
 * elle existe, aucune ambiguïté n'est possible, même si une autre option ne
 * diffère que par la casse. La correspondance à la casse près ensuite, mais
 * **à la seule condition qu'elle soit unique** — c'est la tolérance qui rend
 * service au rédacteur pressé, et le contenu déjà écrit en dépend. Le refus
 * enfin, quand plusieurs options se confondent une fois mises en minuscules :
 * mieux vaut un build qui s'arrête qu'une clef fausse qui passe.
 *
 * Renvoie « { idx } » ou « { erreur } » ; l'appelant préfixe le message.
 */
export function indiceDeLaReponse(options, texte) {
  const exact = options.indexOf(texte);
  if (exact !== -1) return { idx: exact };
  const bas = texte.toLowerCase();
  const cassePres = [];
  options.forEach((o, i) => {
    if (o.toLowerCase() === bas) cassePres.push(i);
  });
  if (cassePres.length === 1) return { idx: cassePres[0] };
  if (cassePres.length > 1) {
    const citees = cassePres.map((i) => `${i + 1} (« ${options[i]} »)`).join(', ');
    return {
      erreur:
        `la réponse « ${texte} » ne correspond exactement à aucune option, et ` +
        `${cassePres.length} options se confondent une fois mises en minuscules : ${citees}. ` +
        'Écrire la réponse telle quelle, ou la donner par son index (0 pour la première).',
    };
  }
  return { erreur: `la réponse « ${texte} » ne figure pas dans les options` };
}

export const quizSchema = z
  .object({
    question: z.string().min(1, 'question de quiz vide'),
    options: z.array(z.union([z.string(), z.number()])).min(2, 'un QCM a besoin d\'au moins 2 options'),
    reponse: z.union([z.string(), z.number()]).optional(),
    reponses: z.array(z.union([z.string(), z.number()])).optional(),
    explication: z.string().optional(),
    correction: correctionSchema.optional(),
    partie: partieCitee,
  })
  .transform((v, ctx) => {
    const options = v.options.map((o) => String(o).trim());
    const brutes = v.reponses ?? (v.reponse !== undefined ? [v.reponse] : []);
    if (brutes.length === 0) {
      ctx.addIssue({ code: 'custom', message: `quiz « ${v.question} » sans « reponse: »` });
      return z.NEVER;
    }
    const indices = [];
    for (const brute of brutes) {
      // La réponse peut être donnée soit par son texte, soit par son index (0-based).
      if (typeof brute === 'number' && Number.isInteger(brute) && options[brute] !== undefined) {
        indices.push(brute);
        continue;
      }
      const texte = String(brute).trim();
      const trouve = indiceDeLaReponse(options, texte);
      if (trouve.erreur !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `quiz « ${v.question} » : ${trouve.erreur}`,
        });
        return z.NEVER;
      }
      indices.push(trouve.idx);
    }
    const bonnes = [...new Set(indices)].sort((a, b) => a - b);
    for (const defaut of defautsDeLaCorrection(v.correction, options, bonnes)) {
      ctx.addIssue({ code: 'custom', message: `quiz « ${v.question} » : ${defaut}` });
    }
    return {
      question: v.question.trim(),
      options,
      bonnes,
      explication: v.explication?.trim(),
      correction: v.correction,
      ...(v.partie ? { partie: v.partie } : {}),
    };
  });

/**
 * Un organigramme consultable, déclaré dans « ## Organigrammes ».
 *
 * ## Pourquoi la date et la source sont OBLIGATOIRES ici
 *
 * Un visuel de correction se lit à côté de la question qu'il corrige : son
 * contexte le date. Un organigramme de référence, lui, se consulte seul, des
 * mois plus tard — et l'organisation d'une administration bouge. Un
 * organigramme sans date est une affirmation sans réserve : celui de la
 * direction régionale d'Île-de-France vaut pour juillet 2025, celui d'une
 * direction départementale pour l'annonce qui l'a décrit, et confondre les
 * deux fait apprendre un état qui n'existe plus.
 *
 * Le build refuse donc les deux absences, plutôt que de les signaler. Un
 * avertissement se lit une fois et s'oublie ; un refus se corrige.
 *
 * La date accepte « 2025-07 » comme « 2025-07-15 » : beaucoup de documents
 * officiels ne datent qu'au mois — « mise à jour au 07/2025 » —, et exiger un
 * jour obligerait à en inventer un.
 */
const SANS_SOURCE =
  'un organigramme sans source est une affirmation sans preuve : nommez le document';
const SANS_DATE =
  'un organigramme sans date est une affirmation sans réserve : « 2025-07 » ou « 2025-07-15 »';

/*
   TROIS PIÈGES DE VALIDATION, ET MON PROPRE ESSAI LES A TROUVÉS.

   1. « .min(1, message) » ne dit RIEN quand la clé est absente : zod rend
      alors son message générique, « Invalid input », et la personne qui écrit
      du contenu ne sait pas ce qu'on lui demande. Le message va donc sur le
      TYPE, où il couvre l'absence comme le mauvais type.
   2. « .min(1) » accepte « '   ' » : trois espaces font une chaîne de
      longueur trois. Sans « .trim() » devant, une source faite d'espaces
      passait — c'est-à-dire une source absente qui se déclare présente.
   3. « .trim() » normalise aussi ce qui est stocké, donc le contenu publié ne
      porte pas les espaces de frappe.
*/
export const organigrammeSchema = z.object({
  titre: z
    .string({ message: 'un organigramme a besoin d’un titre' })
    .trim()
    .min(1, 'un organigramme a besoin d’un titre'),
  donnees: z.unknown(),
  alt: z
    .string({ message: '« alt » est obligatoire : c’est ce que lit un lecteur d’écran' })
    .trim()
    .min(1, '« alt » est obligatoire : c’est ce que lit un lecteur d’écran'),
  legende: z.string().trim().optional(),
  source: z.string({ message: SANS_SOURCE }).trim().min(1, SANS_SOURCE),
  date: z
    .string({ message: SANS_DATE })
    .trim()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, SANS_DATE),
}).superRefine((v, ctx) => {
  /*
     Les données sont celles d'un visuel « schema », et elles passent par le
     même contrôle que dans une correction : une rangée mal déclarée, un lien
     vers un nœud absent, un libellé trop long échouent ici plutôt qu'au
     rendu, devant la personne qui consulte.
  */
  for (const message of defautsDesDonnees('schema', v.donnees)) {
    ctx.addIssue({ code: 'custom', message });
  }
});

export const glossaireSchema = z.array(
  z.object({
    terme: z.string().min(1),
    formes: z.array(z.string()).default([]),
    definition: z.string().min(1),
  }),
);

/**
 * Banque « QCM - DGFiP » (content/qcm-dgfip/*.yml).
 *
 * Même logique de réponse que « quizSchema » — par texte ou par index — mais
 * avec ce qu'exige une banque d'annales : la provenance de la question, la
 * catégorie du concours, et la possibilité de signaler une réponse discutable
 * plutôt que de la présenter comme certaine.
 */
/**
 * La temporalité d'une question (prompt 20, § 3).
 *
 * ## Le défaut que ce bloc existe pour empêcher
 *
 * Le site est **statique** et peut rester des mois sans reconstruction. Une
 * réponse vraie en 2025 continuerait donc d'être servie comme vraie en 2027,
 * sans qu'aucun signal ne se déclenche — ni au build, puisqu'il n'a pas lieu,
 * ni à l'exécution, puisque rien ne regarde l'heure. C'est pour cela que
 * l'expiration est vérifiée **deux fois** : ici, à la construction, et une
 * seconde fois dans le navigateur (« src/lib/qcm.ts »).
 *
 * ## Les cinq natures, et ce qu'elles engagent
 *
 * - `intemporelle` — la réponse ne dépend pas de la date. Une règle
 *   d'accord, un calcul, une définition. **Aucune date requise.**
 * - `historique` — porte sur un fait passé et clos, qui ne changera plus.
 *   « En quelle année la LOLF a-t-elle été promulguée ? » **Aucune date
 *   requise** : le passé ne se périme pas.
 * - `actuelle` — porte sur un état du monde qui peut changer : un taux, un
 *   titulaire de fonction, un seuil. **`date_de_reference` obligatoire**, et
 *   `a_reverifier_le` vivement conseillé.
 * - `passee-non-historique` — portait sur un état du monde **et cet état a
 *   changé** : la question est devenue fausse sans que personne la corrige.
 *   Le prompt demande de la remplacer, à rubrique et compétence constantes.
 *   **`expire_le` obligatoire** — elle ne doit plus être servie.
 * - `a-venir` — porte sur un fait **programmé** : une entrée en vigueur, une
 *   échéance. **`date_de_reference` et `expire_le` obligatoires**, et la
 *   source doit être donnée. Un pronostic n'est pas un fait programmé, et
 *   n'a rien à faire ici.
 *
 * ## Pourquoi les dates sont exigées par nature, et non toutes
 *
 * Exiger `date_de_reference` sur une règle d'accord du participe passé
 * produirait 540 dates dont la plupart n'ont pas de sens, et une date sans
 * sens est une date que personne ne tient à jour. Le schéma ne demande que
 * ce que la nature rend nécessaire, et **refuse** une date posée sur une
 * nature qui ne la comporte pas : une `expire_le` sur une question
 * intemporelle serait un piège à retardement.
 */
export const NATURES_QCM = [
  'intemporelle',
  'historique',
  'actuelle',
  'passee-non-historique',
  'a-venir',
];

/*
   Une date, et une date qui existe.

   « Date.parse » ne suffit pas : le 31 février se **reporte** au 3 mars sans
   lever, et la date fausse passerait le contrôle en se transformant. On fait
   donc l'aller-retour et l'on compare — si le jour revient différent de celui
   qu'on a écrit, c'est que le calendrier l'a corrigé, ce qu'un contrôle de
   format doit refuser plutôt qu'accepter en silence.
*/
const jourIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'une date se note AAAA-MM-JJ')
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'date impossible : ce jour n’existe pas au calendrier');

export const temporaliteSchema = z
  .object({
    nature: z.enum(NATURES_QCM),
    /** Le jour auquel la réponse est vraie. */
    date_de_reference: jourIso.optional(),
    /** Le jour où il faudra rouvrir la question. Avertissement, pas échec. */
    a_reverifier_le: jourIso.optional(),
    /** Le jour après lequel la question ne doit plus être servie. */
    expire_le: jourIso.optional(),
  })
  .superRefine((v, ctx) => {
    const exige = (champ, natures) => {
      if (natures.includes(v.nature) && !v[champ]) {
        ctx.addIssue({
          code: 'custom',
          message: `temporalité « ${v.nature} » : « ${champ} » est obligatoire`,
        });
      }
    };
    const interdit = (champ, natures) => {
      if (natures.includes(v.nature) && v[champ]) {
        ctx.addIssue({
          code: 'custom',
          message:
            `temporalité « ${v.nature} » : « ${champ} » n'a pas de sens ici` +
            (champ === 'expire_le' ? ' — ce serait un piège à retardement' : ''),
        });
      }
    };
    exige('date_de_reference', ['actuelle', 'a-venir']);
    exige('expire_le', ['passee-non-historique', 'a-venir']);
    interdit('expire_le', ['intemporelle', 'historique']);
    interdit('date_de_reference', ['intemporelle', 'historique']);
    if (v.expire_le && v.date_de_reference && v.expire_le < v.date_de_reference) {
      ctx.addIssue({ code: 'custom', message: '« expire_le » précède « date_de_reference »' });
    }
  });

export const questionDgfipSchema = z
  .object({
    question: z.string().min(1, 'question vide'),
    options: z.array(z.union([z.string(), z.number()])).min(2, 'un QCM a besoin d\'au moins 2 options'),
    reponse: z.union([z.string(), z.number()]).optional(),
    reponses: z.array(z.union([z.string(), z.number()])).optional(),
    explication: z.string().min(1, 'chaque question doit porter sa correction'),
    /** D'où vient la question : annale, sujet fourni, ou rédaction maison. */
    source: z.string().optional(),
    /**
     * L'origine de la question, qui décide des parcours où elle est tirée.
     *
     * Le prompt 20 (§ par.11) prévoyait `A | B`. La banque en a démenti la
     * prémisse : **153 questions sur 540 ne viennent d'aucune annale** — elles
     * portent toutes « RevINSP — rédaction originale ». Leur écrire « B »
     * serait faux, et fausserait le tirage de DGFiP B au profit de questions
     * que la DGFiP n'a jamais posées. D'où `maison`, troisième valeur, dont le
     * sens est « utilisable partout, revendiquée par aucun concours ».
     */
    categorie_origine: z.enum(['A', 'B', 'maison'], {
      message: '« categorie_origine » est obligatoire : A, B ou maison',
    }),
    /*
       L'ancien nom est refusé, et non toléré en silence. Une tolérance aurait
       laissé une question neuve passer sous « categorie: B » sans que rien ne
       le dise, et le champ serait reparti en deux noms concurrents — ce qui
       est exactement l'état d'où l'on sort. Les 540 questions sont migrées ;
       il n'y a plus de raison d'accepter l'ancien nom, et il y en a une de le
       refuser.
    */
    categorie: z
      .never({ message: '« categorie » a été renommé « categorie_origine » (A, B ou maison)' })
      .optional(),
    /** La temporalité (prompt 20, § 3). Voir « temporaliteSchema ». */
    temporalite: temporaliteSchema.optional(),
    /**
     * Note affichée quand la bonne réponse n'est pas certaine — sujet sans
     * corrigé, énoncé ambigu, état du droit ayant changé depuis l'annale.
     */
    incertain: z.string().optional(),
    correction: correctionSchema.optional(),
  })
  .transform((v, ctx) => {
    const options = v.options.map((o) => String(o).trim());
    const brutes = v.reponses ?? (v.reponse !== undefined ? [v.reponse] : []);
    if (brutes.length === 0) {
      ctx.addIssue({ code: 'custom', message: `question « ${v.question} » sans « reponse: »` });
      return z.NEVER;
    }
    const indices = [];
    for (const brute of brutes) {
      if (typeof brute === 'number' && Number.isInteger(brute) && options[brute] !== undefined) {
        indices.push(brute);
        continue;
      }
      const texte = String(brute).trim();
      const trouve = indiceDeLaReponse(options, texte);
      if (trouve.erreur !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `question « ${v.question} » : ${trouve.erreur}`,
        });
        return z.NEVER;
      }
      indices.push(trouve.idx);
    }
    const bonnes = [...new Set(indices)].sort((a, b) => a - b);
    for (const defaut of defautsDeLaCorrection(v.correction, options, bonnes)) {
      ctx.addIssue({ code: 'custom', message: `question « ${v.question} » : ${defaut}` });
    }
    return {
      question: v.question.trim(),
      options,
      bonnes,
      explication: v.explication.trim(),
      source: v.source?.trim(),
      categorie_origine: v.categorie_origine,
      temporalite: v.temporalite,
      incertain: v.incertain?.trim(),
      correction: v.correction,
    };
  });

export const banqueDgfipSchema = z.object({
  rubrique: z.string().min(1, 'le champ « rubrique » est obligatoire'),
  /** Ordre d'affichage de la rubrique ; à défaut, ordre alphabétique. */
  ordre: z.coerce.number().int().default(999),
  questions: z.array(questionDgfipSchema).min(1, 'une rubrique sans question'),
});
