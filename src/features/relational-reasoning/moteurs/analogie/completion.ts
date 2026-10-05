/**
 * Moteur « Compléter l'analogie » — catégorie Analogy.
 *
 * Le format A:B::C:? classique, à une différence près qui fait tout l'exercice :
 * **la relation entre A et B n'est jamais nommée**. Il faut l'inférer de la
 * structure montrée avant de pouvoir l'appliquer à C.
 *
 * Le moteur est agnostique du système. Sa seule exigence tient à l'unicité de la
 * réponse : il faut qu'une **seule** entité soit dans la relation cherchée avec
 * C. Sur un ordre total, « avant » vaut pour plusieurs entités à la fois ; le
 * tirage est alors rejeté, faute de quoi l'exercice aurait plusieurs bonnes
 * réponses dont une seule serait comptée juste.
 */
import { blocModele, libelle, libelleNu, texte } from '../../noyaux/presentation';
import { journal, ref } from '../../../correction/trace';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 60;

export const completionAnalogie: Moteur = {
  id: 'completion-analogie',
  nom: "Compléter l'analogie",
  categorie: 'analogie',
  resume: 'A est à B ce que C est à… ? La relation n’est pas nommée : il faut la deviner.',
  regimes: ['algebre', 'clos'],

  engendrer(systeme: Systeme, difficulte: number, alea: Alea): Item | null {
    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(4, difficulte + 2), alea);
      const modele = instance.modele;
      if (!modele || instance.entites.length < 4) continue;

      const relation = alea.un(systeme.relations).id;

      // Les entités qui sont dans cette relation avec exactement une autre :
      // ce sont les seules qui peuvent tenir le rôle de C.
      const cibleUnique = new Map<string, string>();
      for (const source of instance.entites) {
        const atteintes = instance.entites.filter(
          (cible) => cible !== source && systeme.relationDansModele(modele, source, cible) === relation,
        );
        if (atteintes.length === 1) cibleUnique.set(source, atteintes[0]);
      }
      if (cibleUnique.size < 2) continue;

      const [premier, second] = alea.plusieurs([...cibleUnique.keys()], 2);
      const a = premier;
      const b = cibleUnique.get(premier)!;
      const c = second;
      const d = cibleUnique.get(second)!;
      if (new Set([a, b, c, d]).size < 3) continue;

      const leurres = instance.entites.filter((entite) => entite !== c && entite !== d);
      if (leurres.length < 2) continue;

      const retenus = alea.plusieurs(leurres, Math.min(3, leurres.length));
      /*
       * Un leurre qui est dans la relation **converse** avec C est l'erreur de
       * sens : on a lu la relation à l'envers. Les autres ne sont dans aucune
       * relation remarquable avec C, et n'illustrent donc rien de nommable.
       */
      const options: Option[] = alea.melanger([
        { texte: d },
        ...retenus.map((entite) => {
          // Lue à l'envers, l'analogie désigne l'entité qui est dans la relation
          // **avec** C, au lieu de celle que C atteint.
          const inverse = systeme.relationDansModele(modele, entite, c) === relation;
          return { texte: entite, ...(inverse ? { etiquette: 'relation-inverse' as const } : {}) };
        }),
      ]);
      const bonne = options.findIndex((option) => option.texte === d);

      // ----- La trace : lire la relation, puis l'appliquer ---------------
      const carnet = journal();
      carnet.etape({
        utilise: [ref('entite', a), ref('entite', b)],
        loi: 'lecture dans la structure',
        produit: `${a} ${libelle(systeme, relation)} ${b}`,
        legende:
          `La relation n’est pas nommée dans l’énoncé : il faut la lire. Sur la structure, ` +
          `${a} ${libelle(systeme, relation)} ${b} — c’est donc « ${libelleNu(systeme, relation)} » ` +
          'que l’analogie met en jeu.',
        surbrillance: [ref('entite', a), ref('entite', b)],
      });
      carnet.etape({
        utilise: [ref('entite', c), ref('option', bonne)],
        loi: 'application à la seconde paire',
        produit: `${c} ${libelle(systeme, relation)} ${d}`,
        legende:
          `Appliquée à ${c}, cette relation désigne ${d} : sur la structure, ${c} ` +
          `${libelle(systeme, relation)} ${d}. Et c’est la seule réponse possible — si une ` +
          'autre entité convenait, l’analogie en aurait deux, et le tirage serait rejeté.',
        surbrillance: [ref('entite', c), ref('entite', d), ref('option', bonne)],
      });

      return {
        moteur: 'completion-analogie',
        systeme: systeme.id,
        consigne: `${a} est à ${b} ce que ${c} est à… ?`,
        enonce: [
          texte(`Voici la structure. ${systeme.resume}`),
          blocModele(systeme, instance, [a, b, c]),
          texte(
            `Une relation lie ${a} à ${b}. Elle n’est pas nommée : à vous de la lire sur la ` +
              `structure, puis de l’appliquer à ${c}.`,
          ),
        ],
        reponse: { genre: 'unique', options, bonne },
        explication:
          `La relation qui lie ${a} à ${b} est « ${libelleNu(systeme, relation)} ». Appliquée à ` +
          `${c}, elle désigne ${d}, et ${d} seul : aucune autre entité n’est ` +
          `${libelleNu(systeme, relation)} ${c}.`,
        trace: carnet.sceller({ genre: 'unique', indice: bonne }),
      };
    }
    return null;
  },
};
