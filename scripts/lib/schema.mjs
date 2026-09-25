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

export const quizSchema = z
  .object({
    question: z.string().min(1, 'question de quiz vide'),
    options: z.array(z.union([z.string(), z.number()])).min(2, 'un QCM a besoin d\'au moins 2 options'),
    reponse: z.union([z.string(), z.number()]).optional(),
    reponses: z.array(z.union([z.string(), z.number()])).optional(),
    explication: z.string().optional(),
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
    return {
      question: v.question.trim(),
      options,
      bonnes: [...new Set(indices)].sort((a, b) => a - b),
      explication: v.explication?.trim(),
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
    return {
      question: v.question.trim(),
      options,
      bonnes: [...new Set(indices)].sort((a, b) => a - b),
      explication: v.explication.trim(),
      source: v.source?.trim(),
      categorie: v.categorie,
      incertain: v.incertain?.trim(),
    };
  });

export const banqueDgfipSchema = z.object({
  rubrique: z.string().min(1, 'le champ « rubrique » est obligatoire'),
  /** Ordre d'affichage de la rubrique ; à défaut, ordre alphabétique. */
  ordre: z.coerce.number().int().default(999),
  questions: z.array(questionDgfipSchema).min(1, 'une rubrique sans question'),
});
