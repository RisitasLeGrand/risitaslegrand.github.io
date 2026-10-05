/**
 * Moteur « Contradiction » — catégorie Information incomplète.
 *
 * Un ensemble de faits est incohérent : aucune situation ne les satisfait tous.
 * Il faut désigner le fait dont le retrait suffit à rétablir la cohérence.
 *
 * **Le problème de l'unicité, et comment il est résolu.** L'énoncé n'a de
 * réponse unique que si un seul fait appartient à tous les conflits. Deux cycles
 * contradictoires disjoints n'ont aucun fait commun : aucun retrait unique ne
 * les répare, et la question serait sans réponse. Trois cycles partageant deux
 * arêtes en donneraient au contraire deux, et la correction rejetterait à tort
 * l'une des deux.
 *
 * Plutôt que de contraindre le tirage à produire des cycles partageant
 * exactement une arête — ce qui suppose de raisonner sur la forme des conflits
 * avant de les avoir —, le moteur **construit** puis **vérifie** : il ajoute un
 * fait faux à une instance cohérente, puis demande au noyau la liste des faits
 * rédempteurs. Si elle ne compte pas exactement un élément, le tirage est
 * rejeté. La garantie est ainsi établie sur l'instance produite et non espérée
 * du procédé, ce qui est la seule façon de ne pas se tromper.
 *
 * C'est aussi pourquoi le fait ajouté n'est pas nécessairement la réponse : un
 * autre fait de l'instance peut être le seul rédempteur, si le conflit passe par
 * lui. La réponse est ce que le solveur trouve, pas ce que le générateur voulait.
 *
 * ## Ce que la correction peut montrer, et ce qu'elle ne peut pas
 *
 * La trace montre **un** conflit : la chaîne des autres faits qui, composée,
 * exclut ce que le fait coupable affirme. C'est vérifiable à l'œil sur l'énoncé,
 * et le tirage est rejeté si ce conflit n'a pas cette forme.
 *
 * Elle ne peut pas montrer les autres, et il y en a forcément. S'il n'y avait
 * qu'un seul conflit, **chacun** de ses faits serait rédempteur — retirer
 * n'importe quel maillon casse la boucle —, et le tirage aurait été rejeté pour
 * pluralité de réponses. Un item retenu porte donc au moins deux conflits, dont
 * le fait coupable est le seul membre commun. La dernière étape le dit, au lieu
 * de laisser croire que le conflit montré est toute l'affaire.
 *
 * Les faits hors de la chaîne montrée **ne sont pas déclarés inutiles** : ils
 * entrent dans les autres conflits. Les marquer comme tels serait faux.
 */
import { coherent } from '../../noyaux/algebre';
import { aretes, journal, meilleurChemin, tracerChemin } from '../../noyaux/chemin';
import { faitsRedempteurs, FAITS_MAXIMUM } from '../../noyaux/mus';
import { blocFaits, libelle, phrase, texte } from '../../noyaux/presentation';
import { ref } from '../../../correction/trace';
import type { Alea, Fait, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 60;

export const contradiction: Moteur = {
  id: 'contradiction',
  nom: 'Contradiction',
  categorie: 'incompletude',
  resume: 'Ces faits ne peuvent pas être vrais ensemble : lequel retirer ?',
  regimes: ['algebre'],
  compatible: (systeme: Systeme) => Boolean(systeme.composer) && systeme.relations.length >= 2,

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    if (!systeme.composer) return null;
    const algebre = {
      relations: systeme.relations.map((r) => r.id),
      converse: systeme.converse,
      composer: systeme.composer,
    };
    const contexte = { algebre, cheminComplet: systeme.cheminComplet, entites: [] as string[] };

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(2, Math.min(echelon, 6)), alea);
      if (instance.faits.length < 3 || instance.faits.length + 1 > FAITS_MAXIMUM) continue;
      contexte.entites = instance.entites;

      if (!coherent(algebre, systeme.cheminComplet, instance.entites, instance.faits)) continue;

      // Un fait faux : une paire déjà contrainte par les autres, à laquelle on
      // attribue une relation qui n'est plus possible.
      const [a, b] = alea.plusieurs(instance.entites, 2);
      const dejaDit = instance.faits.some(
        (f) => (f.sujet === a && f.objet === b) || (f.sujet === b && f.objet === a),
      );
      if (dejaDit) continue;

      const vraie = instance.modele ? systeme.relationDansModele(instance.modele, a, b) : null;
      const fausses = systeme.relations.filter((r) => r.id !== vraie);
      if (!fausses.length) continue;
      const intrus: Fait = { sujet: a, relation: alea.un(fausses).id, objet: b };

      const faits = alea.melanger([...instance.faits, intrus]);
      if (coherent(algebre, systeme.cheminComplet, instance.entites, faits)) continue;

      const redempteurs = faitsRedempteurs(contexte, faits);
      // Zéro : conflits disjoints, aucun retrait unique ne répare. Plus d'un :
      // plusieurs réponses également correctes. Les deux cas sont rejetés.
      if (redempteurs.length !== 1) continue;

      const coupable = redempteurs[0];
      const bonne = faits.indexOf(coupable);

      // ----- La trace : un conflit, montré le long d'une chaîne ----------
      // On cherche un chemin entre les deux bouts du fait coupable, parmi les
      // **autres** faits : sa composition doit exclure ce que le coupable
      // affirme. C'est le conflit, sous sa forme la plus lisible.
      const chemin = meilleurChemin(
        systeme,
        aretes(systeme, faits).filter((arete) => arete.indice !== bonne),
        coupable.sujet,
        coupable.objet,
        Math.min(faits.length, 5),
      );
      if (!chemin) continue;
      const carnet = journal();
      const obtenu = tracerChemin(carnet, systeme, chemin, coupable.sujet);
      if (obtenu.has(coupable.relation)) continue;

      const nomsObtenus = [...obtenu].map((r) => `« ${libelle(systeme, r)} »`);
      carnet.etape({
        utilise: [ref('option', bonne)],
        produit: `retirer : ${phrase(systeme, coupable)}`,
        legende:
          `Les autres faits imposent ${nomsObtenus.join(' ou ')} entre ${coupable.sujet} et ` +
          `${coupable.objet}. Or le fait ${bonne + 1} affirme que ` +
          `${coupable.sujet} ${libelle(systeme, coupable.relation)} ${coupable.objet} : ` +
          'voilà la contradiction. Et c’est le seul fait dont le retrait suffise — il y a ' +
          'd’autres conflits dans cet énoncé, et il est le seul qu’ils ont tous en commun. ' +
          'C’est pourquoi retirer n’importe quel autre fait en laisserait un en place.',
        surbrillance: [
          ref('option', bonne),
          ref('entite', coupable.sujet),
          ref('entite', coupable.objet),
        ],
      });

      /*
       * Tous les distracteurs portent la **même** étiquette, et il faut résister
       * à l'envie d'en distinguer deux sortes selon qu'ils sont sur la chaîne
       * montrée ou non. Un fait hors de cette chaîne n'est pas « hors sujet » :
       * il appartient à l'un des autres conflits, nécessairement, puisque son
       * retrait ne rétablit pas la cohérence. L'erreur est la même dans les deux
       * cas — avoir vu une boucle et pas les autres.
       */
      const options: Option[] = faits.map((fait, i) => ({
        texte: phrase(systeme, fait),
        ...(i === bonne ? {} : { etiquette: 'cycle-ignore' as const }),
      }));

      return {
        moteur: 'contradiction',
        systeme: systeme.id,
        consigne: 'Quel fait faut-il retirer pour que les autres puissent être vrais ensemble ?',
        enonce: [
          texte(
            `${systeme.resume} Les faits ci-dessous sont **incompatibles** : aucune situation ` +
              'ne les réalise tous. Un seul d’entre eux est en cause — son retrait rend les ' +
              'autres compatibles, et le retrait de n’importe quel autre laisse la ' +
              'contradiction en place.',
          ),
          blocFaits(systeme, faits),
        ],
        reponse: { genre: 'unique', options, bonne },
        explication:
          `Le fait « ${phrase(systeme, coupable)} » est celui-là. Sans lui, les autres faits ` +
          'admettent au moins une situation ; avec lui, aucune. La vérification est directe : ' +
          'on retire chaque fait à son tour et l’on teste la cohérence de ce qui reste — ' +
          'un seul retrait la rétablit. Notez que ' +
          `« ${a} ${libelle(systeme, intrus.relation)} ${b} » n’est pas faux « en soi » : ` +
          'il l’est **relativement** aux autres faits énoncés, qui contraignent déjà cette paire.',
        trace: carnet.sceller({ genre: 'unique', indice: bonne }),
      };
    }
    return null;
  },
};
