/**
 * Moteur « Prémisse manquante » — catégorie Information incomplète.
 *
 * Des faits sont donnés, et une conclusion qu'ils ne suffisent pas à établir. Il
 * faut choisir le fait qui, ajouté aux autres, la rend certaine.
 *
 * C'est l'exercice réciproque de Prémisses minimales, et il est plus difficile
 * pour une raison précise : il demande de raisonner sur ce qui **n'est pas
 * écrit**. On ne vérifie pas une chaîne existante, on cherche le maillon qui la
 * fermerait.
 *
 * Deux exigences sur les leurres.
 *
 * **Un leurre doit être compatible avec les prémisses.** Un fait qui rend le
 * réseau incohérent entraînerait formellement n'importe quelle conclusion — dont
 * celle demandée —, et serait donc une réponse correcte pour la mauvaise raison.
 * Le noyau écarte ces candidats avant de tester l'entraînement, **et le moteur
 * les écarte aussi de l'affichage** : la correction affirme qu'aucune
 * proposition n'est absurde, et il ne suffit pas que ce soit vrai de la bonne.
 *
 * **Un seul candidat doit suffire.** Si deux faits proposés closent chacun la
 * chaîne, l'exercice a deux réponses. Le moteur calcule la liste complète des
 * candidats suffisants et rejette le tirage si elle n'en compte pas exactement
 * un — contrainte vérifiée sur l'instance produite, non supposée du procédé.
 *
 * ## Le maillon, dans la trace
 *
 * La correction déroule la chaîne **avec le fait ajouté à sa place**, et c'est
 * là tout son intérêt : on voit le maillon se poser et la composition se fermer.
 * Le fait ajouté n'est pas affiché comme une prémisse mais comme une **option**,
 * d'où la référence particulière que la narration reçoit — sans quoi la
 * correction surlignerait une prémisse qui n'existe pas.
 */
import { coherent, possibilites } from '../../noyaux/algebre';
import { aretes, journal, meilleurChemin, tracerChemin } from '../../noyaux/chemin';
import { candidatsSuffisants, FAITS_MAXIMUM } from '../../noyaux/mus';
import { blocFaits, libelle, phrase, texte } from '../../noyaux/presentation';
import { ref } from '../../../correction/trace';
import type { Alea, Fait, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 60;
const CANDIDATS = 4;

export const premisseManquante: Moteur = {
  id: 'premisse-manquante',
  nom: 'Prémisse manquante',
  categorie: 'incompletude',
  resume: 'La conclusion ne suit pas encore : quel fait ajouté la rendrait certaine ?',
  regimes: ['algebre'],
  compatible: (systeme: Systeme) => Boolean(systeme.composer) && systeme.relations.length >= 2,

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    if (!systeme.composer) return null;
    const algebre = {
      relations: systeme.relations.map((r) => r.id),
      converse: systeme.converse,
      composer: systeme.composer,
    };

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(3, Math.min(echelon + 1, 7)), alea);
      if (!instance.modele || instance.faits.length > FAITS_MAXIMUM - 1) continue;
      const contexte = { algebre, cheminComplet: systeme.cheminComplet, entites: instance.entites };

      const [a, b] = alea.plusieurs(instance.entites, 2);
      const conclusion = systeme.relationDansModele(instance.modele, a, b);

      // On retire un fait de l'instance : c'est le trou à combler. Puis on
      // vérifie que la conclusion est bien devenue incertaine — sinon le fait
      // retiré n'était pas nécessaire et il n'y a pas de question.
      const retire = alea.un(instance.faits);
      const premisses = instance.faits.filter((f) => f !== retire);
      if (premisses.length < 2) continue;
      if (!coherent(algebre, systeme.cheminComplet, instance.entites, premisses)) continue;

      const ouvertes = possibilites(
        algebre,
        systeme.cheminComplet,
        instance.entites,
        premisses,
        a,
        b,
      );
      if (ouvertes.size < 2 || !ouvertes.has(conclusion)) continue;

      // Les candidats : le fait retiré, et des variantes portant sur d'autres
      // paires ou d'autres relations. Ils doivent tous être *plausibles* — même
      // paire, relation différente, ou paire voisine.
      const proposes: Fait[] = [retire];
      const autresRelations = systeme.relations.filter((r) => r.id !== retire.relation);
      for (const relation of alea.melanger(autresRelations).slice(0, 2)) {
        proposes.push({ sujet: retire.sujet, relation: relation.id, objet: retire.objet });
      }
      const [x, y] = alea.plusieurs(instance.entites, 2);
      if (x !== retire.sujet || y !== retire.objet) {
        proposes.push({ sujet: x, relation: alea.un(systeme.relations).id, objet: y });
      }
      if (proposes.length < CANDIDATS) continue;

      /*
       * Les candidats affichés doivent tous être **compatibles** avec les
       * prémisses.
       *
       * `candidatsSuffisants` écarte déjà les candidats incohérents du calcul de
       * la bonne réponse — un fait qui rend le réseau incohérent entraîne
       * formellement n'importe quelle conclusion, et serait juste pour la
       * mauvaise raison. Mais rien n'empêchait un tel fait d'être **montré**
       * comme leurre, et la correction affirmait alors qu'« aucune proposition
       * n'est absurde » en en montrant une qui l'était. On les écarte donc ici
       * aussi, et la correction dit vrai par construction.
       */
      const compatibles = proposes.filter((candidat) =>
        coherent(algebre, systeme.cheminComplet, instance.entites, [...premisses, candidat]),
      );
      if (compatibles.length < CANDIDATS) continue;

      const suffisants = candidatsSuffisants(contexte, premisses, compatibles, a, b, conclusion);
      // Exactement un candidat doit clore la chaîne.
      if (suffisants.length !== 1) continue;

      const melange = alea.melanger(compatibles.slice(0, CANDIDATS));
      const bonne = melange.indexOf(suffisants[0]);
      if (bonne < 0) continue;

      // ----- La trace : la chaîne refermée par le maillon ----------------
      // Le candidat est placé en queue de liste, à l'indice `premisses.length` ;
      // la narration le désigne comme une option, puisque c'est ainsi que
      // l'énoncé l'affiche.
      const indiceCandidat = premisses.length;
      const chemin = meilleurChemin(
        systeme,
        aretes(systeme, [...premisses, suffisants[0]]),
        a,
        b,
        Math.min(premisses.length + 1, 5),
      );
      if (!chemin) continue;
      // Le maillon doit servir : un chemin qui s'en passe prouverait que la
      // conclusion suivait déjà, ce que le contrôle d'indétermination exclut —
      // mais mieux vaut le vérifier que le supposer.
      if (!chemin.aretes.some((arete) => arete.indice === indiceCandidat)) continue;

      const carnet = journal();
      const obtenu = tracerChemin(carnet, systeme, chemin, a, {
        refDe: (indice) =>
          indice === indiceCandidat ? ref('option', bonne) : ref('premisse', indice),
        nomDe: (indice) =>
          indice === indiceCandidat ? 'le fait ajouté' : `la prémisse ${indice + 1}`,
      });
      if (obtenu.size !== 1 || !obtenu.has(conclusion)) continue;

      carnet.etape({
        utilise: [ref('option', bonne)],
        produit: `${a} ${libelle(systeme, conclusion)} ${b}`,
        legende:
          `Le maillon posé, la composition ne laisse plus qu’une relation entre ${a} et ${b} : ` +
          `« ${libelle(systeme, conclusion)} ». Les autres propositions sont compatibles avec ` +
          'les prémisses — aucune n’est absurde —, mais aucune ne referme la chaîne : ou bien ' +
          'elles portent sur une paire qui n’y entre pas, ou bien elles y posent une relation ' +
          'qui ne s’y compose pas.',
        surbrillance: [ref('option', bonne), ref('entite', a), ref('entite', b)],
      });

      /*
       * L'étiquette ne se pose que là où l'erreur **est** celle qu'elle nomme.
       *
       * « Relation inverse » ne vaut que pour le vrai converse du fait attendu :
       * sur la même paire, « est à la même place que » n'est pas l'inverse de
       * « est plus petit que », c'est une troisième relation. « Leurre de
       * surface » ne vaut que pour un fait qui cite une entité de la conclusion
       * — c'est de là que vient son air de pertinence. Partout ailleurs le
       * distracteur n'illustre aucune erreur identifiable, et le champ reste
       * vide : mieux vaut pas d'étiquette qu'une étiquette qui se trompe.
       */
      const converseAttendu = systeme.converse(suffisants[0].relation);
      const options: Option[] = melange.map((fait, i) => {
        if (i === bonne) return { texte: phrase(systeme, fait) };
        const memePaire =
          fait.sujet === suffisants[0].sujet && fait.objet === suffisants[0].objet;
        const citeLaConclusion = [fait.sujet, fait.objet].some((e) => e === a || e === b);
        const etiquette =
          memePaire && fait.relation === converseAttendu
            ? ('relation-inverse' as const)
            : !memePaire && citeLaConclusion
              ? ('leurre-de-surface' as const)
              : undefined;
        return { texte: phrase(systeme, fait), ...(etiquette ? { etiquette } : {}) };
      });

      return {
        moteur: 'premisse-manquante',
        systeme: systeme.id,
        consigne: `Quel fait ajouté rendrait certain que ${a} ${libelle(systeme, conclusion)} ${b} ?`,
        enonce: [
          texte(
            `${systeme.resume} Avec les seuls faits ci-dessous, ${a} et ${b} peuvent encore être ` +
              `dans ${ouvertes.size} relations différentes : la conclusion n’est pas acquise. ` +
              'Un seul des faits proposés ferme la chaîne.',
          ),
          blocFaits(systeme, premisses),
        ],
        reponse: { genre: 'unique', options, bonne },
        explication:
          `Avec « ${phrase(systeme, suffisants[0])} », la composition ne laisse plus qu’une ` +
          `relation possible entre ${a} et ${b} : « ${libelle(systeme, conclusion)} ». Les ` +
          'autres propositions sont compatibles avec les prémisses — elles ne sont pas ' +
          'absurdes — mais elles laissent la paire indéterminée : ajouter un fait vrai ne suffit ' +
          'pas, il faut ajouter **celui qui manque au chemin**.',
        trace: carnet.sceller({ genre: 'unique', indice: bonne }),
      };
    }
    return null;
  },
};
