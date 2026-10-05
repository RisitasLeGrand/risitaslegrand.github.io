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
});

export const flashcardSchema = z
  .object({
    q: z.string().optional(),
    question: z.string().optional(),
    r: z.string().optional(),
    reponse: z.string().optional(),
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
    return { question: String(question).trim(), reponse: String(reponse).trim() };
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

export const quizSchema = z
  .object({
    question: z.string().min(1, 'question de quiz vide'),
    options: z.array(z.union([z.string(), z.number()])).min(2, 'un QCM a besoin d\'au moins 2 options'),
    reponse: z.union([z.string(), z.number()]).optional(),
    reponses: z.array(z.union([z.string(), z.number()])).optional(),
    explication: z.string().optional(),
    correction: correctionSchema.optional(),
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
      const idx = options.findIndex((o) => o.toLowerCase() === texte.toLowerCase());
      if (idx === -1) {
        ctx.addIssue({
          code: 'custom',
          message: `quiz « ${v.question} » : la réponse « ${texte} » ne figure pas dans les options`,
        });
        return z.NEVER;
      }
      indices.push(idx);
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
    };
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
export const questionDgfipSchema = z
  .object({
    question: z.string().min(1, 'question vide'),
    options: z.array(z.union([z.string(), z.number()])).min(2, 'un QCM a besoin d\'au moins 2 options'),
    reponse: z.union([z.string(), z.number()]).optional(),
    reponses: z.array(z.union([z.string(), z.number()])).optional(),
    explication: z.string().min(1, 'chaque question doit porter sa correction'),
    /** D'où vient la question : annale, sujet fourni, ou rédaction maison. */
    source: z.string().optional(),
    /** « A » ou « B » : la banque fusionne les deux niveaux de concours. */
    categorie: z.enum(['A', 'B']).optional(),
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
      const idx = options.findIndex((o) => o.toLowerCase() === texte.toLowerCase());
      if (idx === -1) {
        ctx.addIssue({
          code: 'custom',
          message: `question « ${v.question} » : la réponse « ${texte} » ne figure pas dans les options`,
        });
        return z.NEVER;
      }
      indices.push(idx);
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
      categorie: v.categorie,
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
