/**
 * Moteur « Analogie inter-systèmes » — catégorie Analogy.
 *
 * Deux mondes sont montrés, tirés de **deux systèmes différents**, aux
 * vocabulaires sans rapport l'un avec l'autre. Dans le premier, un fait est
 * énoncé : « Brume est à l'ouest de Calix ». Dans le second, une entité est
 * désignée, et il faut dire qui est à elle ce que Calix est à Brume.
 *
 * Ce qui transfère n'est donc **ni le mot, ni le dessin** : c'est l'algèbre
 * abstraite que la relation instancie. Un ordre reste un ordre quand il change
 * de verbe, et c'est tout l'exercice — reconnaître « précède » comme la même
 * chose que « est à l'ouest de », sans qu'aucun mot ne le dise.
 *
 * ## Pourquoi le moteur reçoit les autres systèmes au lieu de les importer
 *
 * La règle de la phase 8 est qu'un moteur ne connaît jamais un système par son
 * nom. Elle est conservée : le catalogue arrive en quatrième paramètre de
 * `engendrer`, et en second de `compatible`. Les dix-huit autres moteurs gardent
 * leur signature — un paramètre facultatif ne casse rien côté types — et la
 * séparation des deux couches tient toujours, puisque ce moteur-ci ne nomme
 * aucun système non plus : il ne lit que `relations[].algebre`.
 *
 * ## Le monde d'arrivée doit porter **exactement une** relation de l'algèbre
 *
 * C'est la condition qui rend la réponse défendable, et elle est plus exigeante
 * qu'il n'y paraît. Si le second monde avait deux relations d'ordre — le cas de
 * `line`, dont « avant » et « après » sont tous deux des ordres, ou d'un
 * système-produit qui en compte quatre —, alors « la relation de même nature »
 * en désignerait deux, converses l'une de l'autre, et l'analogie aurait deux
 * réponses symétriques dont une seule serait comptée juste. Le tirage l'exige
 * donc du monde d'arrivée.
 *
 * Du monde de départ, en revanche, on n'exige rien de tel : la relation y est
 * **énoncée**, pas à deviner. Un système qui compte quatre ordres peut servir de
 * départ sans ambiguïté, puisque l'énoncé dit lequel.
 *
 * ## L'unicité de la cible, et le leurre qui compte
 *
 * Dans le monde d'arrivée, il faut qu'une **seule** entité soit dans la relation
 * cherchée avec l'entité désignée. Sur un ordre, « précède » vaut pour
 * plusieurs : le tirage cherche donc une entité qui n'en précède qu'une, et
 * rejette le reste.
 *
 * Deux leurres sont nommés, et ce sont eux qui donnent sa valeur à la
 * correction. **La relation inverse** : on a lu l'analogie à l'envers, et
 * désigné qui précède au lieu de qui est précédé. **Le leurre de surface** :
 * on a transféré vers une relation du second monde qui n'a pas la même nature —
 * l'entité est bien reliée à la cible, mais par une équivalence là où il
 * fallait un ordre. C'est l'erreur que l'exercice existe pour attraper.
 */
import { blocModele, libelle, libelleNu, texte } from '../../noyaux/presentation';
import { INTITULES } from '../../noyaux/proprietes';
import { journal, ref } from '../../../correction/trace';
import type { AlgebreAbstraite, Alea, Instance, Modele, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 50;

/** Les algèbres que le système sait énoncer, sans doublon. */
function algebresEnoncables(systeme: Systeme): AlgebreAbstraite[] {
  const vues = new Set<AlgebreAbstraite>();
  for (const relation of systeme.relations) if (relation.algebre) vues.add(relation.algebre);
  return [...vues];
}

/**
 * La relation du système qui instancie cette algèbre, s'il n'y en a
 * **qu'une**. Deux relations de même algèbre sont converses l'une de l'autre
 * ou indiscernables : « la relation de même nature » cesserait de désigner.
 */
function relationUnique(systeme: Systeme, algebre: AlgebreAbstraite): string | null {
  const candidates = systeme.relations.filter((relation) => relation.algebre === algebre);
  return candidates.length === 1 ? candidates[0].id : null;
}

/**
 * Deux systèmes partagent-ils un mot ?
 *
 * La question n'est pas cosmétique. `poset` et `poset-ouvert` sont deux
 * préréglages du **même module** : mêmes relations, mêmes libellés, et même
 * liste de sept noms d'entités. Une analogie de l'un vers l'autre montrerait
 * deux fois « précède » et deux fois les mêmes noms — il n'y aurait rien à
 * transférer, et l'exercice serait un trompe-l'œil. Comparer les libellés
 * attrape le cas sans nommer aucun système, ce qui est la seule façon de
 * l'écarter sans rompre la séparation des deux couches.
 */
function vocabulaireCommun(premier: Systeme, second: Systeme): boolean {
  const mots = new Set(premier.relations.map((relation) => relation.libelle));
  return second.relations.some((relation) => mots.has(relation.libelle));
}

/** Les systèmes où l'on peut transférer cette algèbre sans ambiguïté. */
function mondesDArrivee(
  algebre: AlgebreAbstraite,
  depart: Systeme,
  voisins: readonly Systeme[],
): Systeme[] {
  return voisins.filter(
    (candidat) =>
      candidat.id !== depart.id &&
      relationUnique(candidat, algebre) !== null &&
      !vocabulaireCommun(depart, candidat),
  );
}

/** Les entités que `source` atteint par exactement cette relation. */
function atteintes(systeme: Systeme, modele: Modele, entites: readonly string[], source: string, relation: string) {
  return entites.filter(
    (cible) => cible !== source && systeme.relationDansModele(modele, source, cible) === relation,
  );
}

export const analogieInterSystemes: Moteur = {
  id: 'analogie-inter-systemes',
  nom: 'Analogie inter-systèmes',
  categorie: 'analogie',
  resume:
    'Deux mondes, deux vocabulaires sans rapport. Ce qui passe de l’un à l’autre est la nature de la relation, non son nom.',
  regimes: ['algebre', 'clos'],

  compatible(systeme: Systeme, voisins?: readonly Systeme[]): boolean {
    const algebres = algebresEnoncables(systeme);
    if (!algebres.length) return false;
    // Sans catalogue, on ne peut pas savoir s'il existe un monde d'arrivée. On
    // répond alors sur la seule condition vérifiable, et `engendrer` tranchera.
    if (!voisins) return true;
    return algebres.some((algebre) => mondesDArrivee(algebre, systeme, voisins).length > 0);
  },

  engendrer(
    systeme: Systeme,
    difficulte: number,
    alea: Alea,
    voisins?: readonly Systeme[],
  ): Item | null {
    if (!voisins || voisins.length < 2) return null;
    const algebres = algebresEnoncables(systeme);
    if (!algebres.length) return null;

    const taille = Math.max(4, Math.min(difficulte + 3, 7));

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const algebre = alea.un(algebres);
      const arrivees = mondesDArrivee(algebre, systeme, voisins);
      if (!arrivees.length) continue;

      const arrivee = alea.un(arrivees);
      const relationArrivee = relationUnique(arrivee, algebre)!;
      const relationDepart = alea.un(
        systeme.relations.filter((relation) => relation.algebre === algebre),
      ).id;

      const premier: Instance = systeme.engendrer(taille, alea);
      const second: Instance = arrivee.engendrer(taille, alea);
      const modelePremier = premier.modele;
      const modeleSecond = second.modele;
      if (!modelePremier || !modeleSecond) continue;

      // Deux mondes qui partageraient un nom seraient illisibles : on ne saurait
      // plus de quel monde parle l'option.
      if (premier.entites.some((entite) => second.entites.includes(entite))) continue;

      // ----- Monde de départ : une paire qui porte la relation -------------
      const paires: [string, string][] = [];
      for (const a of premier.entites) {
        for (const b of atteintes(systeme, modelePremier, premier.entites, a, relationDepart)) {
          paires.push([a, b]);
        }
      }
      if (!paires.length) continue;
      const [a, b] = alea.un(paires);

      // ----- Monde d'arrivée : une entité qui n'en atteint qu'une ----------
      const uniques: [string, string][] = [];
      for (const c of second.entites) {
        const cibles = atteintes(arrivee, modeleSecond, second.entites, c, relationArrivee);
        if (cibles.length === 1) uniques.push([c, cibles[0]]);
      }
      if (!uniques.length) continue;
      const [c, d] = alea.un(uniques);

      // ----- Les leurres, nommés quand ils le méritent ---------------------
      const restants = second.entites.filter((entite) => entite !== c && entite !== d);
      if (restants.length < 2) continue;

      /*
       * Lue à l'envers, l'analogie désigne qui est dans la relation **avec** la
       * cible, au lieu de celle que la cible atteint. Sur une relation
       * symétrique ce leurre n'existe pas — le converse est la relation
       * elle-même, et l'entité serait la bonne réponse.
       */
      const inverse = restants.find(
        (entite) => arrivee.relationDansModele(modeleSecond, entite, c) === relationArrivee,
      );

      /*
       * Le leurre de surface : relié à la cible, mais par une relation d'une
       * **autre** nature. C'est le transfert fait au jugé, sur la seule
       * impression que « ça se ressemble ».
       */
      const surface = restants.find((entite) => {
        if (entite === inverse) return false;
        const relation = arrivee.relationDansModele(modeleSecond, c, entite);
        const meta = arrivee.relations.find((r) => r.id === relation);
        return Boolean(meta?.algebre) && meta!.algebre !== algebre;
      });

      const nommes = [inverse, surface].filter((entite): entite is string => Boolean(entite));
      const muets = restants.filter((entite) => !nommes.includes(entite));
      const complement = alea.plusieurs(muets, Math.min(Math.max(0, 3 - nommes.length), muets.length));
      const proposees = [...nommes, ...complement];
      if (proposees.length < 2) continue;

      const options: Option[] = alea.melanger([
        { texte: d } as Option,
        ...proposees.map((entite) => {
          if (entite === inverse) return { texte: entite, etiquette: 'relation-inverse' as const };
          if (entite === surface) return { texte: entite, etiquette: 'leurre-de-surface' as const };
          return { texte: entite } as Option;
        }),
      ]);
      const bonne = options.findIndex((option) => option.texte === d);

      // ----- La trace : lire, nommer la nature, transférer, appliquer ------
      const nomDepart = libelle(systeme, relationDepart);
      const nomArrivee = libelle(arrivee, relationArrivee);
      const nuArrivee = libelleNu(arrivee, relationArrivee);
      const carnet = journal();

      carnet.etape({
        utilise: [ref('entite', a), ref('entite', b)],
        loi: 'lecture du premier monde',
        produit: `${a} ${nomDepart} ${b}`,
        legende:
          `Le premier monde énonce que ${a} ${nomDepart} ${b}. C’est le seul fait donné, et ` +
          'c’est de lui qu’il faut partir.',
        surbrillance: [ref('entite', a), ref('entite', b)],
      });

      carnet.etape({
        utilise: [ref('entite', a), ref('entite', b)],
        loi: 'nature de la relation',
        produit: INTITULES[algebre],
        legende:
          `« ${libelleNu(systeme, relationDepart)} » est ${INTITULES[algebre]}. C’est cela, et ` +
          'cela seul, qui va passer dans l’autre monde : le mot n’y existe pas, la nature si.',
        surbrillance: [ref('entite', a), ref('entite', b)],
      });

      carnet.etape({
        utilise: [ref('entite', c)],
        loi: 'transfert au second monde',
        produit: nomArrivee,
        legende:
          `Dans le second monde, une seule relation est ${INTITULES[algebre]} : ` +
          `« ${nuArrivee} ». S’il y en avait deux, elles seraient converses l’une de l’autre et ` +
          'la question aurait deux réponses — le tirage l’aurait refusée.',
        surbrillance: [ref('entite', c)],
      });

      carnet.etape({
        utilise: [ref('entite', c), ref('option', bonne)],
        loi: 'application à la cible',
        produit: `${c} ${nomArrivee} ${d}`,
        /*
         * La phrase ne peut pas enchâsser le libellé nu : « précède » n'est pas
         * un attribut, et « n'est précède Forge » ne se laisse pas lire. On
         * cite donc la relation **complète**, après son sujet, ce qui vaut
         * aussi bien pour un verbe que pour un groupe prépositionnel.
         */
        legende:
          `Appliquée à ${c}, cette relation désigne ${d}, et ${d} seul : aucune autre entité du ` +
          `second monde ne vérifie « ${c} ${nomArrivee} … ».`,
        surbrillance: [ref('entite', c), ref('entite', d), ref('option', bonne)],
      });

      for (let indice = 0; indice < options.length; indice += 1) {
        if (indice !== bonne) carnet.inutile(ref('option', indice));
      }

      return {
        moteur: 'analogie-inter-systemes',
        systeme: systeme.id,
        consigne: `${a} est à ${b} ce que ${c} est à… ?`,
        enonce: [
          texte(`Premier monde. ${systeme.resume}`),
          blocModele(systeme, premier, [a, b]),
          texte(`On y sait que ${a} ${nomDepart} ${b}.`),
          texte(`Second monde, sans rapport avec le premier. ${arrivee.resume}`),
          blocModele(arrivee, second, [c]),
          texte(
            `Les deux mondes n’ont aucun vocabulaire commun : ce qui passe de l’un à l’autre est ` +
              `la nature de la relation, non son nom. ${a} est à ${b} ce que ${c} est à… qui, ` +
              'dans le second monde ?',
          ),
        ],
        reponse: { genre: 'unique', options, bonne },
        explication:
          `« ${libelleNu(systeme, relationDepart)} » est ${INTITULES[algebre]}. Dans le second ` +
          `monde, la seule relation de cette nature est « ${nuArrivee} ». Appliquée à ${c}, elle ` +
          `désigne ${d} : ${c} ${nomArrivee} ${d}, et aucune autre entité ne le fait.`,
        trace: carnet.sceller({ genre: 'unique', indice: bonne }),
      };
    }
    return null;
  },
};
