/**
 * Moteur « Prémisse du second ordre » — famille Chaînes de prémisses.
 *
 * Le dernier format du prompt A, et le seul qui demandait un solveur de plus :
 * une prémisse qui ne parle pas d'entités mais **d'autres prémisses**.
 *
 * > La relation de Brume à Calix est la même que celle d'Actos à Doran.
 *
 * Elle n'affirme rien par elle-même. Elle devient un fait quand on a lu la
 * prémisse qui donne la relation d'Actos à Doran, et c'est ce transfert — pas
 * la composition qui le suit — que l'exercice fait travailler.
 *
 * ## Pourquoi pas la formule de l'analogie
 *
 * « Brume est à Calix ce qu'Actos est à Doran » est la phrase de Syllogimous, et
 * elle est **ambiguë** : « est à … ce que » se lit aussi comme une proportion,
 * qui n'a pas de sens ici. La forme explicite — « la relation de X à Y est la
 * même que celle de Z à T » — dit exactement ce que le solveur calcule, et c'est
 * la condition pour que la correction ne mente pas.
 *
 * ## Trois exigences, et ce que chacune écarte
 *
 * **La paire source est énoncée.** Sa relation se lit dans une prémisse du
 * premier ordre, elle ne se dérive pas. On pourrait l'exiger dérivable, et
 * l'exercice serait plus riche ; il serait aussi à deux inconnues, et un échec
 * ne dirait plus lequel des deux gestes a manqué.
 *
 * **La paire cible n'est énoncée nulle part**, ni dans un sens ni dans l'autre.
 * Sinon la prémisse du second ordre serait redondante, et l'on répondrait juste
 * sans l'avoir lue.
 *
 * **Le transfert doit servir.** La conclusion est jugée deux fois, avec et sans
 * le fait transféré : on exige que le fait **réduise** l'ensemble des relations
 * encore possibles. C'est ce qui distingue un item du second ordre d'un item de
 * « Conclusion d'une chaîne » auquel on aurait ajouté une phrase décorative.
 *
 * ## La cohérence est acquise par construction, non vérifiée après coup
 *
 * La paire cible est choisie parmi celles qui portent **déjà**, dans le modèle
 * tiré, la même relation que la paire source. La prémisse du second ordre est
 * donc vraie du modèle comme le sont les prémisses du premier ordre, et le jeu
 * ne peut pas être contradictoire. Tirer la cible librement puis tester la
 * cohérence aurait marché aussi, au prix d'une propagation de plus par tirage
 * et d'une classe d'items dont on n'aurait rien pu dire.
 *
 * ## La trace : transférer, puis composer
 *
 * Une étape de transfert, qui cite les deux prémisses en jeu et produit le fait
 * obtenu ; puis le chemin, narré par `tracerChemin` sur la liste **augmentée**.
 * Le fait transféré y porte le numéro de la prémisse du second ordre, et la
 * légende le nomme « la relation obtenue par la prémisse n » plutôt que « la
 * prémisse n » : la prémisse, elle, ne relie rien.
 *
 * L'exigence d'honnêteté de la famille vaut ici aussi : le chemin doit justifier
 * à lui seul ce que la propagation complète établit, sinon l'item est retiré.
 */
import { compiler, possibilites } from '../../noyaux/algebre';
import { libelle, texte } from '../../noyaux/presentation';
import { journal, ref, type Conclusion } from '../../../correction/trace';
import { aretes, fonctionnel, meilleurChemin, tracerChemin } from '../../noyaux/chemin';
import type { Alea, Fait, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';
import { BINAIRES, VERDICTS } from './verdicts';

const TIRAGES = 80;

/** Une paire est-elle énoncée, dans un sens ou dans l'autre ? */
function enoncee(faits: readonly Fait[], x: string, y: string): boolean {
  return faits.some(
    (fait) =>
      (fait.sujet === x && fait.objet === y) || (fait.sujet === y && fait.objet === x),
  );
}

export const chaineSecondOrdre: Moteur = {
  id: 'chaine-second-ordre',
  nom: 'Prémisse du second ordre',
  categorie: 'chaines',
  resume:
    'Une prémisse parle d’une autre prémisse : « la relation de X à Y est la même que celle de ' +
    'Z à T ». Transférer, puis conclure.',
  regimes: ['algebre'],

  /**
   * Deux refus structurels, tous deux mesurés avant d'être écrits : sans eux, le
   * moteur était accepté sur cinq systèmes où il refusait **100 %** de ses
   * tirages, et la séance y aurait brûlé douze refus chacun.
   *
   * **Les systèmes à composition fonctionnelle** — `rang`, `anneau`, `groups`,
   * `cyclic`. Une chaîne de prémisses y fixe tout le réseau : la relation de la
   * paire interrogée est déjà déterminée sans le transfert, qui ne peut donc
   * rien resserrer. La troisième exigence du moteur — que le transfert serve —
   * n'y est jamais satisfaite, et c'est une propriété du système, non du tirage.
   *
   * **Les mondes clos** — `poset`. Toutes les paires y sont énoncées, puisque
   * les faits *sont* le modèle. Aucune paire ne peut donc être la cible d'un
   * transfert : il n'y a rien à transférer vers du déjà-dit.
   */
  compatible: (systeme: Systeme) =>
    Boolean(systeme.composer) &&
    systeme.relations.length >= 2 &&
    systeme.monde === 'ouvert' &&
    !fonctionnel(systeme),

  /** Même règle à fenêtre que « Conclusion d'une chaîne », et pour la même raison. */
  echelle: { reussites: 7, fenetre: 8, descente: 4 },

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    if (!systeme.composer) return null;
    const algebre = {
      relations: systeme.relations.map((r) => r.id),
      converse: systeme.converse,
      composer: systeme.composer,
    };
    compiler(algebre);

    const binaire = fonctionnel(systeme);
    const intitules = binaire ? BINAIRES : VERDICTS;

    /** Le verdict visé, tiré une fois — voir « Conclusion d'une chaîne ». */
    const vise = alea.entier(binaire ? 2 : 3);

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      /*
       * Les systèmes dont la cohérence par chemin ne suffit pas — `rcc8`,
       * `allen`, `classes`, `poset-ouvert` — font payer chaque appel à
       * `possibilites` d'une énumération de scénarios. Mesuré avant plafond :
       * 18 020 ms pour le pire item sur `allen`, douze fois le budget que
       * `essais:relationnel` garde. Le nombre d'entités y est donc plafonné, et
       * le nombre de paires essayées divisé par deux : l'exercice ne perd rien,
       * puisqu'il porte sur un transfert et non sur la taille du réseau.
       */
      const enumere = !systeme.cheminComplet;
      const taille = enumere
        ? Math.max(4, Math.min(echelon + 2, 5))
        : Math.max(4, Math.min(echelon + 3, 9));
      const instance = systeme.engendrer(taille, alea);
      const modele = instance.modele;
      if (!modele || instance.faits.length < 2) continue;

      // ----- La paire source : une prémisse du premier ordre, au hasard -----
      const indiceSource = alea.entier(instance.faits.length);
      const source = instance.faits[indiceSource];

      /*
       * La paire cible : non énoncée, distincte de la source, et portant déjà
       * la même relation dans le modèle — c'est ce qui rend la prémisse du
       * second ordre vraie du modèle, donc compatible avec les autres.
       */
      const cibles: [string, string][] = [];
      for (const x of instance.entites) {
        for (const y of instance.entites) {
          if (x === y) continue;
          if (x === source.sujet && y === source.objet) continue;
          if (enoncee(instance.faits, x, y)) continue;
          if (systeme.relationDansModele(modele, x, y) === source.relation) cibles.push([x, y]);
        }
      }
      if (!cibles.length) continue;
      const [cibleDe, cibleA] = alea.un(cibles);

      const faits = instance.faits;
      const transfere: Fait = { sujet: cibleDe, relation: source.relation, objet: cibleA };
      const augmentes = [...faits, transfere];
      /** Le rang d'affichage de la prémisse du second ordre, et du fait qu'elle donne. */
      const rangSecondOrdre = faits.length;

      // ----- La conclusion : une paire que le transfert aide à trancher -----
      const paires: [string, string][] = [];
      for (const x of instance.entites) {
        for (const y of instance.entites) if (x !== y) paires.push([x, y]);
      }

      for (const [a, b] of alea.melanger(paires).slice(0, enumere ? 4 : 8)) {
        if (enoncee(augmentes, a, b)) continue;

        const chemin = meilleurChemin(systeme, aretes(systeme, augmentes), a, b, 4);
        if (!chemin) continue;
        // Le chemin doit emprunter le fait transféré : sans cela, l'item ne
        // porte pas sur le second ordre.
        if (!chemin.aretes.some((arete) => arete.indice === rangSecondOrdre)) continue;

        if (vise === 0 && chemin.obtenu.size !== 1) continue;
        if (vise === 2 && chemin.obtenu.size < 2) continue;

        const avec = possibilites(algebre, systeme.cheminComplet, instance.entites, augmentes, a, b);
        if (avec.size === 0) continue;

        // L'exigence d'honnêteté : le chemin justifie à lui seul la réponse.
        if (chemin.obtenu.size !== avec.size) continue;
        let identiques = true;
        for (const r of chemin.obtenu) if (!avec.has(r)) identiques = false;
        if (!identiques) continue;

        /*
         * Le transfert doit servir : sans lui, la réponse serait moins précise.
         *
         * On ne veut pas l'ensemble `sans`, seulement savoir s'il est plus grand
         * que `avec`. `arretDesQue` arrête donc l'énumération dès qu'une
         * relation de plus a été vue — le résultat est alors tronqué, et ne sert
         * qu'à cette comparaison, ce que son contrat autorise expressément.
         */
        const sans = possibilites(
          algebre,
          systeme.cheminComplet,
          instance.entites,
          faits,
          a,
          b,
          avec.size + 1,
        );
        if (!(avec.size < sans.size)) continue;

        const determine = avec.size === 1;
        const exclues = systeme.relations.filter((r) => !avec.has(r.id));

        let relationConclue: string | null = null;
        let verdict = 0;
        if (vise === 0 && determine) {
          relationConclue = [...avec][0];
          verdict = 0;
        } else if (vise === 1 && exclues.length > 0) {
          relationConclue = alea.un(exclues).id;
          verdict = 1;
        } else if (vise === 2 && !determine) {
          relationConclue = alea.un([...avec]);
          verdict = 2;
        }
        if (!relationConclue) continue;

        const bonne = binaire ? (verdict === 0 ? 0 : 1) : verdict;
        const conclusion = `${a} ${libelle(systeme, relationConclue)} ${b}`;

        // ----- La trace : le transfert, puis le chemin --------------------
        const carnet = journal();
        carnet.etape({
          utilise: [ref('premisse', indiceSource), ref('premisse', rangSecondOrdre)],
          loi: 'transfert du second ordre',
          produit: `${cibleDe} ${libelle(systeme, source.relation)} ${cibleA}`,
          legende:
            `La prémisse ${rangSecondOrdre + 1} ne dit rien par elle-même : elle dit que la ` +
            `relation de ${cibleDe} à ${cibleA} est celle de ${source.sujet} à ${source.objet}. ` +
            `Or la prémisse ${indiceSource + 1} donne cette dernière — ${source.sujet} ` +
            `${libelle(systeme, source.relation)} ${source.objet}. On en tire donc que ` +
            `${cibleDe} ${libelle(systeme, source.relation)} ${cibleA}.`,
          surbrillance: [
            ref('premisse', indiceSource),
            ref('premisse', rangSecondOrdre),
            ref('entite', cibleDe),
            ref('entite', cibleA),
          ],
        });

        tracerChemin(carnet, systeme, chemin, a, {
          inutilesParmi: augmentes.length,
          nomDe: (indice) =>
            indice === rangSecondOrdre
              ? `la relation obtenue par la prémisse ${indice + 1}`
              : `la prémisse ${indice + 1}`,
        });

        const nomsOuverts = [...avec].map((r) => libelle(systeme, r));
        carnet.etape({
          utilise: [ref('option', bonne)],
          produit: intitules[bonne],
          legende:
            verdict === 0
              ? /*
                 * Sans compter les relations qui restaient : `sans` est tronqué
                 * au seuil qui a servi à la comparaison, et en citer l'effectif
                 * serait une précision que le calcul n'a pas faite.
                 */
                `Le chemin ne laisse qu’une relation possible entre ${a} et ${b}, et c’est celle ` +
                'de la conclusion : elle découle donc des prémisses — à condition d’avoir fait le ' +
                `transfert, car sans lui la relation entre ${a} et ${b} n’était pas déterminée.`
              : verdict === 1
                ? `Le chemin laisse ${avec.size} relation${avec.size > 1 ? 's' : ''} ` +
                  `possible${avec.size > 1 ? 's' : ''} entre ${a} et ${b} — ${nomsOuverts.join(', ')} ` +
                  '— et la conclusion n’en fait pas partie : elle est exclue.'
                : `Le chemin laisse ${avec.size} relations possibles entre ${a} et ${b} : ` +
                  `${nomsOuverts.join(', ')}. La conclusion en fait partie, mais rien ne la ` +
                  'distingue des autres : les prémisses ne tranchent pas.',
          surbrillance: [ref('entite', a), ref('entite', b)],
        });
        const trace = carnet.sceller({ genre: 'unique', indice: bonne } as Conclusion);

        const options: Option[] = intitules.map((intitule, i) => ({
          texte: intitule,
          etiquette:
            i === bonne
              ? undefined
              : i === 0
                ? ('transitivite-abusive' as const)
                : i === 1 && !binaire
                  ? ('hors-zone' as const)
                  : ('non-etiquete' as const),
        }));

        return {
          moteur: 'chaine-second-ordre',
          systeme: systeme.id,
          consigne: `Que vaut la conclusion « ${conclusion} » ?`,
          enonce: [
            texte(
              `On sait ceci de ${instance.entites.length} entités. La dernière prémisse ne parle ` +
                'pas d’entités mais d’une autre prémisse : elle ne devient un fait qu’une fois ' +
                'celle-ci lue.',
            ),
            {
              type: 'faits',
              phrases: [
                ...faits.map(
                  (fait, i) =>
                    `${i + 1}. ${fait.sujet} ${libelle(systeme, fait.relation)} ${fait.objet}.`,
                ),
                `${rangSecondOrdre + 1}. La relation de ${cibleDe} à ${cibleA} est la même que ` +
                  `celle de ${source.sujet} à ${source.objet}.`,
              ],
            },
          ],
          reponse: { genre: 'unique', options, bonne },
          explication: trace.etapes[trace.etapes.length - 1].legende,
          trace,
        };
      }
    }
    return null;
  },
};
