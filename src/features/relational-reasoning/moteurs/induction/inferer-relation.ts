/**
 * Moteur « Inférer la relation » — catégorie Induction.
 *
 * Des symboles muets étiquettent des exemples tirés d'une structure montrée. La
 * personne retrouve, par élimination sur l'ensemble des exemples, quelle
 * relation chaque symbole désigne.
 *
 * Le moteur est agnostique du système : il ne lui demande qu'un modèle visible
 * et un vocabulaire. Il tient de ce que les relations d'un système sont
 * mutuellement exclusives : deux exemples portant le même symbole ne peuvent
 * appartenir qu'à une seule relation, si bien que la réponse est toujours
 * déterminée dès qu'un symbole a un exemple.
 */
import { blocModele, libelle, texte } from '../../noyaux/presentation';
import { journal, ref } from '../../../correction/trace';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur } from '../types';

const SYMBOLES = ['★', '◆', '●', '▲', '■'];

export const infererRelation: Moteur = {
  id: 'inferer-relation',
  nom: 'Inférer la relation',
  categorie: 'induction',
  resume: 'Des symboles sans nom étiquettent des exemples : retrouvez ce que chacun désigne.',
  regimes: ['algebre', 'clos'],

  engendrer(systeme: Systeme, difficulte: number, alea: Alea): Item | null {
    const instance = systeme.engendrer(Math.max(4, difficulte + 2), alea);
    const modele = instance.modele;
    if (!modele) return null;

    // Toutes les paires, rangées par relation. Une relation symétrique ne donne
    // qu'un sens : montrer les deux révélerait la symétrie sans qu'on l'ait
    // demandé.
    const parRelation = new Map<string, [string, string][]>();
    const dejaVues = new Set<string>();
    for (const a of instance.entites) {
      for (const b of instance.entites) {
        if (a === b) continue;
        const relation = systeme.relationDansModele(modele, a, b);
        if (systeme.converse(relation) === relation) {
          const clef = [a, b].sort().join('|');
          if (dejaVues.has(clef)) continue;
          dejaVues.add(clef);
        }
        const liste = parRelation.get(relation) ?? [];
        liste.push([a, b]);
        parRelation.set(relation, liste);
      }
    }

    // Plus la difficulté monte, plus il y a de symboles et moins d'exemples
    // chacun : c'est l'élimination qui se resserre, pas la lecture.
    const exemplesParSymbole = difficulte <= 3 ? 3 : 2;
    const voulus = Math.min(SYMBOLES.length, 2 + Math.floor(difficulte / 4));

    const utilisables = [...parRelation.entries()].filter(
      ([, paires]) => paires.length >= exemplesParSymbole,
    );
    if (utilisables.length < 2) return null;

    const choisies = alea.plusieurs(utilisables, Math.min(voulus, utilisables.length));
    if (choisies.length < 2) return null;

    const attribution = choisies.map(([relation, paires], i) => ({
      symbole: SYMBOLES[i],
      relation,
      exemples: alea.plusieurs(paires, exemplesParSymbole),
    }));

    // Les exemples sont mélangés entre symboles : sans cela, ils se liraient par
    // blocs et l'élimination n'aurait pas lieu.
    const ligne = (a: string, symbole: string, b: string) => `${a}  ${symbole}  ${b}`;
    const lignes = alea.melanger(
      attribution.flatMap(({ symbole, exemples }) =>
        exemples.map(([a, b]) => ligne(a, symbole, b)),
      ),
    );

    // À droite, les relations en jeu et deux leurres pris dans le système.
    const leurres = systeme.relations
      .map((r) => r.id)
      .filter((id) => !attribution.some((choix) => choix.relation === id));
    const droite = alea.melanger([
      ...attribution.map((choix) => libelle(systeme, choix.relation)),
      ...alea.plusieurs(leurres, Math.min(2, leurres.length)).map((id) => libelle(systeme, id)),
    ]);

    const paires: Record<string, string> = {};
    for (const choix of attribution) paires[choix.symbole] = libelle(systeme, choix.relation);

    // La trace suit le raisonnement qui fait tenir l'exercice : un symbole ne
    // peut désigner qu'une relation, parce que les relations d'un système sont
    // mutuellement exclusives. Un seul exemple suffit donc à le fixer, et les
    // autres ne font que confirmer — c'est ce que l'étape dit.
    const carnet = journal();
    for (const choix of attribution) {
      const [a, b] = choix.exemples[0];
      const nom = libelle(systeme, choix.relation);
      const confirment = choix.exemples
        .slice(1)
        .map(([x, y]) => `${x} ${nom} ${y}`)
        .join(', ');

      carnet.etape({
        utilise: choix.exemples.map(([x, y]) => ref('premisse', ligne(x, choix.symbole, y))),
        produit: `${choix.symbole} = « ${nom} »`,
        loi: 'lecture dans la structure, puis exclusion mutuelle',
        legende:
          `Dans la structure montrée, ${a} ${nom} ${b}. L’exemple « ${ligne(a, choix.symbole, b)} » ` +
          `fixe donc ${choix.symbole} sur cette relation, et aucune autre : les relations du ` +
          `système s’excluent entre elles.` +
          (confirment ? ` Les autres exemples le confirment — ${confirment}.` : ''),
        surbrillance: choix.exemples.flatMap(([x, y]) => [ref('noeud', x), ref('noeud', y)]),
      });
    }
    /*
     * Les relations proposées à droite sans être en jeu sont des leurres, et il
     * serait tentant de les déclarer inutiles. On ne le fait pas : la réponse
     * est un **appariement**, et son énoncé n'affiche pas de liste d'options
     * numérotées — la trace n'a donc aucun rang auquel les rattacher. Les
     * désigner par leur libellé donnait une référence que l'affichage ne sait
     * pas résoudre, et la légende annonçait « inutile » sans que rien ne le
     * porte. L'explication les nomme, ce qui suffit.
     */

    return {
      moteur: 'inferer-relation',
      systeme: systeme.id,
      consigne: 'À quelle relation correspond chaque symbole ?',
      enonce: [
        texte(`Voici la structure. ${systeme.resume}`),
        blocModele(systeme, instance),
        texte('Et voici des exemples, étiquetés par des symboles dont le sens n’est pas donné :'),
        { type: 'faits', phrases: lignes },
      ],
      reponse: {
        genre: 'appariement',
        gauche: attribution.map((choix) => choix.symbole),
        droite,
        paires,
      },
      explication: attribution
        .map((choix) => {
          const [a, b] = choix.exemples[0];
          return `${choix.symbole} désigne « ${libelle(systeme, choix.relation)} » : ${a} ${libelle(
            systeme,
            choix.relation,
          )} ${b} dans la structure montrée.`;
        })
        .join(' '),
      trace: carnet.sceller({ genre: 'appariement', paires }),
    };
  },
};
