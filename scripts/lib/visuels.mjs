/**
 * Les schémas de `visuel.donnees`, un par type de visuel.
 *
 * ## Pourquoi `donnees` ne peut pas rester `unknown`
 *
 * Le contrôle de contenu bloque le build sur une correction malformée. Mais
 * `donnees` y était déclaré `z.unknown()` : une frise sans jalons, un tableau
 * dont une ligne a trois cellules pour quatre colonnes, un schéma dont un lien
 * pointe vers un nœud qui n'existe pas — tout cela passait le contrôle et
 * n'échouait qu'**au rendu**, c'est-à-dire devant la personne qui révise, au
 * moment où elle demande la correction d'une question ratée.
 *
 * Valider ici coûte quelques dizaines de lignes et déplace la faute de la
 * session de révision vers le build, qui est précisément le seul endroit où
 * elle peut encore être corrigée.
 *
 * ## Le vocabulaire est celui de la partie B, sans exception
 *
 * Les marqueurs admis sont ceux de `src/features/correction/vocabulaire.ts`. Un
 * second jeu propre aux QCM aurait obligé à réapprendre à lire en passant d'un
 * exercice à une question de cours, ce qui est exactement ce que le vocabulaire
 * partagé existe pour éviter.
 */
import { z } from 'zod';

/** Les sept marqueurs du vocabulaire visuel commun. */
export const MARQUEURS_ADMIS = [
  'utilise',
  'inutile',
  'deduit',
  'ta-reponse',
  'bonne-reponse',
  'possible',
  'exclu',
];

const marqueur = z.enum(MARQUEURS_ADMIS, {
  message: `« marqueur » doit valoir l'un de : ${MARQUEURS_ADMIS.join(', ')}`,
});

const texteCourt = z.string().min(1).max(120);

/** Une frise : des jalons datés, et des intervalles facultatifs. */
const frise = z
  .object({
    jalons: z
      .array(
        z.object({
          date: z.union([z.number(), z.string().min(1)]),
          libelle: texteCourt,
          marqueur: marqueur.optional(),
        }),
      )
      .min(2, 'une frise a besoin d’au moins deux jalons'),
    intervalles: z
      .array(
        z.object({
          de: z.union([z.number(), z.string().min(1)]),
          a: z.union([z.number(), z.string().min(1)]),
          libelle: texteCourt,
          marqueur: marqueur.optional(),
        }),
      )
      .default([]),
  })
  .strict();

/** Un tableau, avec des cellules mises en avant. */
const tableau = z
  .object({
    entetes: z.array(texteCourt).min(2, 'un tableau a besoin d’au moins deux colonnes'),
    lignes: z.array(z.array(z.string())).min(1, 'un tableau a besoin d’au moins une ligne'),
    marques: z
      .array(
        z.object({
          ligne: z.number().int().min(0),
          colonne: z.number().int().min(0),
          marqueur,
        }),
      )
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    v.lignes.forEach((ligne, i) => {
      if (ligne.length !== v.entetes.length) {
        ctx.addIssue({
          code: 'custom',
          message: `ligne ${i + 1} : ${ligne.length} cellule(s) pour ${v.entetes.length} colonne(s)`,
        });
      }
    });
    for (const m of v.marques) {
      if (m.ligne >= v.lignes.length || m.colonne >= v.entetes.length) {
        ctx.addIssue({
          code: 'custom',
          message: `marque hors du tableau : ligne ${m.ligne}, colonne ${m.colonne}`,
        });
      }
    }
  });

/** Un schéma à niveaux : hiérarchie de normes, circuit, organigramme. */
const schema = z
  .object({
    noeuds: z
      .array(
        z.object({
          id: z.string().min(1),
          libelle: texteCourt,
          niveau: z.number().int().min(0),
          marqueur: marqueur.optional(),
        }),
      )
      .min(2, 'un schéma a besoin d’au moins deux nœuds'),
    liens: z
      .array(
        z.object({
          de: z.string().min(1),
          a: z.string().min(1),
          libelle: z.string().optional(),
          marqueur: marqueur.optional(),
        }),
      )
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    const connus = new Set(v.noeuds.map((n) => n.id));
    if (connus.size !== v.noeuds.length) {
      ctx.addIssue({ code: 'custom', message: 'deux nœuds portent le même identifiant' });
    }
    for (const lien of v.liens) {
      for (const bout of [lien.de, lien.a]) {
        if (!connus.has(bout)) {
          ctx.addIssue({ code: 'custom', message: `le lien cite un nœud inconnu : « ${bout} »` });
        }
      }
    }
  });

/** Une courbe : des séries de points dans un repère nommé. */
const courbe = z
  .object({
    axeX: z.object({ nom: texteCourt, min: z.number(), max: z.number() }),
    axeY: z.object({ nom: texteCourt, min: z.number(), max: z.number() }),
    series: z
      .array(
        z.object({
          nom: texteCourt,
          points: z.array(z.tuple([z.number(), z.number()])).min(2),
          marqueur: marqueur.optional(),
        }),
      )
      .min(1, 'une courbe a besoin d’au moins une série'),
    reperes: z
      .array(
        z.object({
          x: z.number(),
          y: z.number(),
          libelle: texteCourt,
          marqueur: marqueur.optional(),
        }),
      )
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const axe of [v.axeX, v.axeY]) {
      if (axe.max <= axe.min) {
        ctx.addIssue({ code: 'custom', message: `axe « ${axe.nom} » : max doit dépasser min` });
      }
    }
  });

/**
 * Un diagramme de Venn à deux ou trois ensembles.
 *
 * Une zone est désignée par les ensembles qui la **contiennent** : `['A']` est
 * la part de A seule, `['A', 'B']` leur intersection. C'est la seule désignation
 * qui ne dépende pas du dessin, et donc la seule qui reste juste si la
 * disposition change.
 */
const venn = z
  .object({
    ensembles: z
      .array(z.object({ id: z.string().min(1), libelle: texteCourt }))
      .min(2)
      .max(3, 'au-delà de trois ensembles, un diagramme de Venn cesse d’être lisible'),
    zones: z
      .array(
        z.object({
          regions: z.array(z.string().min(1)).min(1),
          marqueur,
          libelle: z.string().optional(),
        }),
      )
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    const connus = new Set(v.ensembles.map((e) => e.id));
    for (const zone of v.zones) {
      for (const region of zone.regions) {
        if (!connus.has(region)) {
          ctx.addIssue({ code: 'custom', message: `zone citant un ensemble inconnu : « ${region} »` });
        }
      }
    }
  });

/** Une figure géométrique : points nommés, segments, angles. */
const figure = z
  .object({
    points: z
      .array(
        z.object({
          id: z.string().min(1),
          x: z.number(),
          y: z.number(),
          libelle: z.string().optional(),
        }),
      )
      .min(2),
    segments: z
      .array(
        z.object({
          de: z.string().min(1),
          a: z.string().min(1),
          cote: z.string().optional(),
          marqueur: marqueur.optional(),
        }),
      )
      .default([]),
    angles: z
      .array(
        z.object({
          en: z.string().min(1),
          de: z.string().min(1),
          a: z.string().min(1),
          libelle: texteCourt,
          marqueur: marqueur.optional(),
        }),
      )
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    const connus = new Set(v.points.map((p) => p.id));
    const verifier = (id, ou) => {
      if (!connus.has(id)) {
        ctx.addIssue({ code: 'custom', message: `${ou} cite un point inconnu : « ${id} »` });
      }
    };
    for (const s of v.segments) {
      verifier(s.de, 'un segment');
      verifier(s.a, 'un segment');
    }
    for (const a of v.angles) {
      verifier(a.en, 'un angle');
      verifier(a.de, 'un angle');
      verifier(a.a, 'un angle');
    }
  });

/** Une grille de cases : suites, tables de vérité, logique. */
const grille = z
  .object({
    colonnes: z.number().int().min(1).max(12),
    lignes: z.number().int().min(1).max(12),
    entetesColonnes: z.array(z.string()).default([]),
    entetesLignes: z.array(z.string()).default([]),
    cases: z
      .array(
        z.object({
          x: z.number().int().min(0),
          y: z.number().int().min(0),
          valeur: z.string().optional(),
          marqueur: marqueur.optional(),
        }),
      )
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const c of v.cases) {
      if (c.x >= v.colonnes || c.y >= v.lignes) {
        ctx.addIssue({ code: 'custom', message: `case hors grille : (${c.x}, ${c.y})` });
      }
    }
    if (v.entetesColonnes.length && v.entetesColonnes.length !== v.colonnes) {
      ctx.addIssue({ code: 'custom', message: 'autant d’en-têtes de colonnes que de colonnes' });
    }
    if (v.entetesLignes.length && v.entetesLignes.length !== v.lignes) {
      ctx.addIssue({ code: 'custom', message: 'autant d’en-têtes de lignes que de lignes' });
    }
  });

/** Un texte découpé en segments étiquetés : français, orthographe, syntaxe. */
const texteAnnote = z
  .object({
    segments: z
      .array(
        z.object({
          texte: z.string().min(1),
          etiquette: z.string().optional(),
          marqueur: marqueur.optional(),
        }),
      )
      .min(1, 'un texte annoté a besoin d’au moins un segment'),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.segments.some((s) => s.etiquette || s.marqueur)) {
      ctx.addIssue({
        code: 'custom',
        message: 'aucun segment n’est annoté : le visuel n’apporterait rien de plus que le texte',
      });
    }
  });

/** Le schéma de `donnees`, par type de visuel. */
export const DONNEES_PAR_TYPE = {
  frise,
  tableau,
  schema,
  courbe,
  venn,
  figure,
  grille,
  texte_annote: texteAnnote,
};

/**
 * Les défauts de `donnees` au regard du type déclaré.
 *
 * Rend des messages déjà lisibles, préfixés du type : le contrôle de contenu
 * les affiche tels quels, et une question fautive se corrige sans ouvrir le
 * schéma.
 */
export function defautsDesDonnees(type, donnees) {
  const schemaDuType = DONNEES_PAR_TYPE[type];
  if (!schemaDuType) return [];
  const resultat = schemaDuType.safeParse(donnees);
  if (resultat.success) return [];
  return resultat.error.issues.map((issue) => {
    const chemin = issue.path.length ? ` (${issue.path.join('.')})` : '';
    return `visuel « ${type} »${chemin} : ${issue.message}`;
  });
}
