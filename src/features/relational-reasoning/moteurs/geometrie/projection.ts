/**
 * Moteur « Projection » — catégorie Autres algèbres.
 *
 * Une relation est donnée dans un système à plusieurs axes, et l'on demande ce
 * qu'elle devient lorsqu'on **cesse de regarder l'un des axes**. Deux entités au
 * nord-est l'une de l'autre sont simplement à l'est l'une de l'autre si l'on
 * ignore le nord-sud.
 *
 * La mécanique est celle du n-uplet : une relation d'un système-produit **est**
 * le n-uplet de ses relations d'axe, et projeter consiste à en retirer une
 * composante. C'est exactement pour rendre cette opération triviale que `plane`
 * et `space` ont été construits comme produits plutôt que comme tables plates de
 * neuf ou vingt-sept relations — sur une table plate, il aurait fallu écrire la
 * projection à la main, relation par relation.
 *
 * Le piège que l'exercice tend est réel et instructif : l'**effondrement**. Deux
 * entités distinctes peuvent devenir indiscernables après projection — ce que la
 * relation projetée nomme par l'égalité d'axe. Une personne qui raisonne « elles
 * étaient différentes, elles le restent » se trompe, et c'est là toute la
 * difficulté : la projection **perd** de l'information, et savoir laquelle est
 * précisément ce qu'on entraîne.
 */
import { nommerComposante, nommerUplet, type AxeProduit } from '../../systemes/axes';
import { blocModele, libelle, texte } from '../../noyaux/presentation';
import { journal, ref } from '../../../correction/trace';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 40;

export const projection: Moteur = {
  id: 'projection',
  nom: 'Projection',
  categorie: 'algebres',
  resume: 'Que devient la relation si l’on cesse de regarder un des axes ?',
  regimes: ['algebre', 'transformation'],
  // Il faut un axe à effondrer et au moins un axe restant.
  compatible: (systeme: Systeme) => (systeme.axes?.length ?? 0) >= 2,

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    const axes = (systeme.axes ?? []) as AxeProduit[];
    if (axes.length < 2) return null;

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(2, Math.min(echelon, 7)), alea);
      if (!instance.modele?.coordonnees) continue;
      const [a, b] = alea.plusieurs(instance.entites, 2);

      const relation = systeme.relationDansModele(instance.modele, a, b);
      if (relation.length !== axes.length) continue;

      const retire = alea.entier(axes.length);
      const axesRestants = axes.filter((_, i) => i !== retire);
      const projetee = relation
        .split('')
        .filter((_, i) => i !== retire)
        .join('');

      const nomProjete = nommerUplet(projetee, axesRestants);

      // Les leurres : les autres n-uplets possibles sur les axes restants. Le
      // plus tentant est celui obtenu en gardant le mauvais axe — et il figure
      // toujours parmi eux, par construction du vocabulaire.
      const tous: string[] = [''];
      const combinaisons = axesRestants.reduce<string[]>(
        (acquis, axe) => {
          const lettres = axe.strict ? ['a', 'p'] : ['a', 'e', 'p'];
          return acquis.flatMap((debut) => lettres.map((lettre) => debut + lettre));
        },
        tous,
      );
      const autres = combinaisons.filter((uplet) => uplet !== projetee);
      if (autres.length < 2) continue;

      const leurres = alea.plusieurs(autres, Math.min(3, autres.length));
      const melange = alea.melanger([
        { uplet: projetee, bonne: true },
        ...leurres.map((uplet) => ({ uplet, bonne: false })),
      ]);
      const bonne = melange.findIndex((entree) => entree.bonne);
      const effondre = projetee.split('').every((r) => r === 'e');

      /*
       * L'étiquette distingue les deux erreurs que l'exercice provoque.
       *
       * Garder la composante du mauvais axe est l'erreur d'axe permuté : on a
       * bien projeté, mais effacé le mauvais. Elle ne se reconnaît que sur les
       * leurres qui coïncident avec la relation d'origine privée d'une **autre**
       * composante — c'est calculable, et le dire au hasard serait pire que de
       * ne rien dire.
       */
      const projeteesAutres = new Set(
        axes
          .map((_, i) =>
            i === retire
              ? null
              : relation
                  .split('')
                  .filter((_, k) => k !== i)
                  .join(''),
          )
          .filter((x): x is string => x !== null),
      );
      const options: Option[] = melange.map((entree) => ({
        texte: `${a} ${nommerUplet(entree.uplet, axesRestants).libelle} ${b}`,
        ...(entree.bonne
          ? {}
          : projeteesAutres.has(entree.uplet)
            ? { etiquette: 'axe-permute' as const }
            : {}),
      }));

      // ----- La trace : la relation décomposée, axe par axe --------------
      const carnet = journal();
      const lettres = relation.split('');
      axes.forEach((axe, i) => {
        const garde = i !== retire;
        carnet.etape({
          utilise: [ref('axe', axe.id)],
          loi: garde ? 'composante conservée' : 'composante effacée',
          produit: garde
            ? `${axe.libelle} : ${nommerComposante(lettres[i], axe)}`
            : `${axe.libelle} : effacé`,
          legende: garde
            ? `Sur l’axe « ${axe.libelle} », ${a} ${nommerComposante(lettres[i], axe)} ${b}. ` +
              'Cet axe demeure : sa composante passe telle quelle dans la relation projetée.'
            : `Sur l’axe « ${axe.libelle} », ${a} ${nommerComposante(lettres[i], axe)} ${b} — ` +
              'et c’est précisément l’axe qu’on efface. Cette composante est donc perdue.',
          surbrillance: [ref('axe', axe.id), ref('entite', a), ref('entite', b)],
        });
        if (!garde) carnet.inutile(ref('axe', axe.id));
      });

      carnet.etape({
        utilise: [ref('option', bonne), ...axesRestants.map((axe) => ref('axe', axe.id))],
        produit: `${a} ${nomProjete.libelle} ${b}`,
        loi: 'recomposition sur les axes restants',
        legende: effondre
          ? `Il ne reste aucune composante : ${a} et ${b} ne se distinguaient que par l’axe ` +
            `effacé, et deviennent indiscernables. C’est ce que dit ` +
            `« ${nomProjete.libelle} » — la projection perd de l’information, et c’est bien ` +
            'ce qu’elle est censée faire.'
          : `En recomposant les composantes conservées, il reste : ${a} ` +
            `${nomProjete.libelle} ${b}. Aucune n’a été déformée — projeter efface, ` +
            'cela ne déplace rien.',
        surbrillance: [ref('entite', a), ref('entite', b), ref('option', bonne)],
      });

      return {
        moteur: 'projection',
        systeme: systeme.id,
        consigne: `En ignorant l’axe « ${axes[retire].libelle} », quelle relation lie ${a} à ${b} ?`,
        enonce: [
          texte(
            `${systeme.resume} On sait que ${a} ${libelle(systeme, relation)} ${b}. ` +
              `Imaginez maintenant qu’on efface l’axe « ${axes[retire].libelle} » : il ne reste ` +
              `que ${axesRestants.length === 1 ? 'l’axe' : 'les axes'} ` +
              `${axesRestants.map((axe) => `« ${axe.libelle} »`).join(' et ')}.`,
          ),
          blocModele(systeme, instance, [a, b]),
        ],
        reponse: { genre: 'unique', options, bonne },
        explication:
          `La relation « ${libelle(systeme, relation)} » se lit axe par axe. En retirant la ` +
          `composante de l’axe « ${axes[retire].libelle} », il reste ` +
          `« ${nomProjete.libelle} ».` +
          (effondre
            ? ` Remarquez ce qui s’est passé : ${a} et ${b} ne se distinguaient que par cet axe, ` +
              'et deviennent **indiscernables** une fois qu’il disparaît. La projection perd de ' +
              'l’information, et c’est bien ce qu’elle est censée faire.'
            : ' Les autres axes sont inchangés : projeter ne déforme rien, cela efface.'),
        trace: carnet.sceller({ genre: 'unique', indice: bonne }),
      };
    }
    return null;
  },
};
