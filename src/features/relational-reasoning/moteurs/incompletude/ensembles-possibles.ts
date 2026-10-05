/**
 * Moteur « Ensembles de possibilités » — catégorie Incompleteness.
 *
 * Des faits sont donnés, qui ne suffisent pas à fixer une paire. La personne
 * coche **toutes** les relations qui restent logiquement possibles entre les deux
 * entités.
 *
 * Deux points de conception commandent tout le reste.
 *
 * **Seuls les faits sont montrés, jamais le modèle.** Les autres moteurs
 * affichent volontiers la grille dont l'instance est tirée ; ici ce serait
 * absurde, puisque la question porte précisément sur ce que les faits ne disent
 * pas. Montrer le modèle donnerait la réponse et supprimerait l'exercice.
 *
 * **La correction pas à pas n'est offerte que si un chemin la porte.** Elle se
 * déroule le long d'une chaîne de prémisses ; si cette chaîne laissait plus de
 * relations ouvertes que la propagation complète n'en laisse, elle mentirait par
 * omission — elle justifierait des cases qu'elle présente comme fausses. L'item
 * est alors rendu **sans trace**, et montre son explication seule, comme le font
 * les moteurs non encore migrés.
 *
 * Ce cas n'est pas marginal, et il est instructif : sur `rang` et sur `anneau`,
 * mesuré, **aucun** item retenu n'a de chaîne entre les deux entités
 * interrogées. L'indétermination y vient de ce que les deux ne sont pas reliées
 * du tout, et les relations exclues le sont par la propagation sur tout le
 * réseau — chacune des deux entités voit ses places restreintes par ses propres
 * chaînes, et c'est le croisement de ces restrictions qui exclut. Une chaîne
 * unique ne peut pas raconter cela. Le dire franchement valait mieux que
 * supprimer l'exercice sur ces deux systèmes.
 *
 * **Les leurres sont au moins aussi nombreux que les bonnes réponses.** C'est ce
 * qui donne son mordant au barème : tout cocher rapporte alors zéro, puisque la
 * note retranche les cases fausses des cases justes. Sans cette garantie, le
 * réflexe de tout cocher paierait, et l'exercice récompenserait l'inverse de ce
 * qu'il enseigne.
 */
import { compiler, possibilites } from '../../noyaux/algebre';
import { aretes, journal, meilleurChemin, tracerChemin } from '../../noyaux/chemin';
import { blocFaits, libelle, texte } from '../../noyaux/presentation';
import { ref } from '../../../correction/trace';
import type { Alea, Systeme } from '../../systemes/types';
import type { EtiquetteErreur } from '../../../correction/trace';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 60;

export const ensemblesPossibles: Moteur = {
  id: 'ensembles-possibles',
  nom: 'Ensembles de possibilités',
  categorie: 'incompletude',
  resume:
    'Les faits ne tranchent pas : cochez toutes les relations qui restent possibles.',
  regimes: ['algebre'],

  /**
   * Un système dont la composition est fonctionnelle ne laisse jamais de paire
   * ouverte : « groups » fixe tout son réseau dès qu'une chaîne de faits le
   * parcourt. Le régime ne le dit pas — c'est bien une algèbre —, d'où ce
   * filtre. Un vocabulaire d'au moins quatre relations est par ailleurs
   * nécessaire pour qu'il reste des leurres en nombre suffisant.
   */
  compatible: (systeme: Systeme) => Boolean(systeme.composer) && systeme.relations.length >= 4,

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    if (!systeme.composer) return null;
    const algebre = {
      relations: systeme.relations.map((r) => r.id),
      converse: systeme.converse,
      composer: systeme.composer,
    };
    compiler(algebre);

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      // Une difficulté basse garde peu d'entités et donc peu de faits : c'est
      // l'indétermination qui doit croître, pas la longueur de l'énoncé.
      const instance = systeme.engendrer(Math.max(2, Math.min(echelon, 6)), alea);
      const [a, b] = alea.plusieurs(instance.entites, 2);

      // On retire le fait qui relierait directement les deux entités : sans
      // cela l'énoncé trancherait, et il n'y aurait rien à chercher.
      const faits = instance.faits.filter(
        (fait) =>
          !(fait.sujet === a && fait.objet === b) && !(fait.sujet === b && fait.objet === a),
      );
      if (faits.length < 2) continue;

      const ouvertes = possibilites(algebre, systeme.cheminComplet, instance.entites, faits, a, b);
      const impossibles = systeme.relations.filter((r) => !ouvertes.has(r.id));

      // Ni déterminé, ni vacant, et assez de leurres pour que tout cocher ne
      // rapporte rien.
      if (ouvertes.size < 2) continue;
      if (impossibles.length < ouvertes.size) continue;

      // Plus l'échelon monte, plus on laisse de leurres à écarter.
      const nombreLeurres = Math.min(
        impossibles.length,
        Math.max(ouvertes.size, ouvertes.size + Math.floor(echelon / 3)),
      );
      const leurres = alea.plusieurs(impossibles, nombreLeurres);

      const proposees = alea.melanger([
        ...[...ouvertes].map((id) => ({ id, bonne: true })),
        ...leurres.map((r) => ({ id: r.id, bonne: false })),
      ]);
      /*
       * L'étiquette nomme le geste à corriger plutôt que de dire « faux ».
       *
       * Un leurre qui est le converse d'une relation ouverte est l'erreur la
       * plus fréquente du raisonnement relationnel : on a bien trouvé la
       * relation, et on l'a lue dans le mauvais sens. Les autres sont exclus par
       * la composition elle-même.
       */
      const converses = new Set([...ouvertes].map((id) => systeme.converse(id)));
      const options: Option[] = proposees.map((p) => ({
        texte: `${a} ${libelle(systeme, p.id)} ${b}`,
        ...(p.bonne
          ? {}
          : {
              etiquette: (converses.has(p.id) ? 'relation-inverse' : 'hors-zone') as EtiquetteErreur,
            }),
      }));
      const bonnes = proposees.flatMap((p, i) => (p.bonne ? [i] : []));

      // ----- La trace, quand un chemin la porte -------------------------
      const chemin = meilleurChemin(
        systeme,
        aretes(systeme, faits),
        a,
        b,
        Math.min(faits.length, 5),
      );
      const carnet = journal();
      let tracable = false;
      if (chemin) {
        const obtenu = tracerChemin(carnet, systeme, chemin, a, { inutilesParmi: faits.length });
        tracable = obtenu.size === ouvertes.size && [...obtenu].every((r) => ouvertes.has(r));
      }

      if (tracable) {
        const nomsOuverts = [...ouvertes].map((id) => `« ${libelle(systeme, id)} »`);
        const nomsExclus = leurres.map((r) => `« ${libelle(systeme, r.id)} »`);
        carnet.etape({
          utilise: bonnes.map((i) => ref('option', i)),
          produit: `${ouvertes.size} relation${ouvertes.size > 1 ? 's' : ''} ouverte${ouvertes.size > 1 ? 's' : ''}`,
          legende:
            `Le chemin laisse exactement ${nomsOuverts.join(', ')} entre ${a} et ${b} : ` +
            `${ouvertes.size > 1 ? 'ce sont les cases à cocher' : 'c’est la case à cocher'}. ` +
            `${nomsExclus.join(', ')} ${nomsExclus.length > 1 ? 'sont exclues' : 'est exclue'} ` +
            'par la composition — non parce que la situation tirée en décide, mais parce ' +
            'qu’aucune situation compatible avec ces faits ne les réalise.',
          surbrillance: [ref('entite', a), ref('entite', b), ...bonnes.map((i) => ref('option', i))],
        });
      }

      return {
        moteur: 'ensembles-possibles',
        systeme: systeme.id,
        consigne: `Que peut-on encore dire de ${a} par rapport à ${b} ?`,
        enonce: [
          texte(
            `On sait seulement ceci. ${systeme.resume} Rien d’autre n’est donné : ` +
              'tout ce qui n’est pas exclu par ces faits reste possible.',
          ),
          blocFaits(systeme, faits),
        ],
        reponse: { genre: 'multiple', options, bonnes },
        explication:
          `Les faits laissent ${ouvertes.size} relation${ouvertes.size > 1 ? 's' : ''} ouverte` +
          `${ouvertes.size > 1 ? 's' : ''} entre ${a} et ${b} : ` +
          [...ouvertes].map((id) => `« ${libelle(systeme, id)} »`).join(', ') +
          `. Les autres sont exclues par composition des faits énoncés — non parce qu’elles ` +
          'sont fausses dans une situation particulière, mais parce qu’aucune situation ' +
          'compatible avec ces faits ne les réalise.',
        ...(tracable ? { trace: carnet.sceller({ genre: 'multiple', indices: bonnes }) } : {}),
      };
    }
    return null;
  },
};
