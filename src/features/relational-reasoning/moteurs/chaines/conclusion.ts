/**
 * Moteur « Conclusion d'une chaîne » — famille Chaînes de prémisses.
 *
 * C'est le format élémentaire du raisonnement relationnel, et celui qui
 * manquait : **N prémisses mélangées, une conclusion à juger**. Les autres
 * moteurs du site partent plus loin — ils demandent d'inférer une algèbre, de
 * trouver la prémisse manquante, de cocher ce qui reste possible. Aucun ne
 * posait simplement « voici ce qu'on sait, et voici ce qu'on en conclut : est-ce
 * que ça tient ? »
 *
 * ## Deux options ou trois : la détermination du système décide
 *
 * La tentation est de n'offrir que *vrai* et *faux*. Elle est tenable sur un
 * système dont la composition est **fonctionnelle** — `groups`, `rang`,
 * `anneau` —, où une chaîne de prémisses couvrant les entités fixe tout le
 * réseau : une conclusion y est nécessairement entraînée ou contredite, jamais
 * entre les deux.
 *
 * Elle est **fausse** partout ailleurs. Sur une ligne, « A est avant B » et
 * « C est avant B » ne disent rien de A et C : une conclusion peut être vraie
 * dans la disposition tirée tout en restant ouverte au vu des prémisses. Lui
 * répondre « vrai » serait enseigner exactement l'erreur que la rubrique existe
 * pour corriger — conclure de ce qu'on ignore. Ces systèmes reçoivent donc les
 * **trois verdicts** déjà employés par « Entre-deux », avec les mêmes mots,
 * pour qu'un seul vocabulaire serve partout.
 *
 * ## Le hasard, et l'échelle
 *
 * Deux options, c'est une chance sur deux. Trois réussites d'affilée — la règle
 * commune pour monter d'un cran — arrivent alors une fois sur huit sans rien
 * comprendre. Le moteur déclare donc une `echelle` à fenêtre quand il tourne en
 * mode binaire : sept réussites sur huit, soit moins de quatre chances sur cent
 * sous l'hypothèse du pur hasard. Le mode à trois verdicts n'en a pas besoin, et
 * garde la règle commune.
 *
 * ## Ce que la trace doit porter
 *
 * La justification est un **chemin** : les prémisses qui, composées l'une après
 * l'autre, mènent du premier terme au second. On exige que l'ensemble obtenu par
 * ce chemin soit **exactement** celui que la propagation complète donne — sinon
 * le chemin ne suffirait pas à justifier la réponse, et la correction pas à pas
 * mentirait par omission. L'item est alors retiré plutôt que posé.
 *
 * Les prémisses hors du chemin sont vraies mais inutiles : ce sont les
 * **distractrices**, et la trace les déclare comme telles pour que la correction
 * les signale. Apprendre à voir qu'un fait ne sert à rien fait partie de
 * l'exercice.
 *
 * ## Le réglage « négation de surface »
 *
 * À partir de l'échelon 4, et sur les seuls systèmes où elle est univoque, une
 * partie des prémisses est énoncée **par la négation de l'autre relation** :
 * « A n'est pas après B » au lieu de « A est avant B ». La structure sous-jacente
 * ne change pas d'un iota — c'est pour cela que la négation est dite *de
 * surface* —, mais il faut la traverser avant de pouvoir composer, et c'est un
 * geste qui se rate.
 *
 * Deux décisions tiennent ce réglage.
 *
 * **Seules les prémisses du chemin sont niées.** Nier une distractrice
 * obligerait la correction à expliquer la conversion d'un fait qu'elle déclare
 * ensuite inutile, ce qui brouillerait les deux leçons au lieu d'en donner une.
 *
 * **Les conversions passent avant la composition.** La trace rend d'abord
 * chaque prémisse niée à sa forme affirmative, puis compose : le chemin narré
 * par `tracerChemin` parle de relations positives, et il mentirait s'il les
 * citait sans avoir dit d'où elles viennent.
 */
import { compiler, possibilites } from '../../noyaux/algebre';
import {
  complement,
  libelle,
  libelleNu,
  negationUnivoque,
  phraseNiee,
  texte,
} from '../../noyaux/presentation';
import { journal, ref, type Conclusion } from '../../../correction/trace';
import { aretes, fonctionnel, meilleurChemin, tracerChemin } from '../../noyaux/chemin';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';
import { BINAIRES, VERDICTS } from './verdicts';

const TIRAGES = 70;

/**
 * L'échelon à partir duquel la négation de surface apparaît.
 *
 * Pas avant : le format lui-même — des prémisses en désordre, trois verdicts —
 * demande déjà d'apprendre quelque chose, et ajouter la négation d'emblée
 * ferait porter l'échec sur la lecture au lieu du raisonnement.
 */
const ECHELON_NEGATION = 4;


export const chaineConclusion: Moteur = {
  id: 'chaine-conclusion',
  nom: 'Conclusion d’une chaîne',
  categorie: 'chaines',
  resume:
    'Des prémisses dans le désordre, une conclusion : en découle-t-elle, la contredit-elle, ' +
    'ou reste-t-elle ouverte ?',
  regimes: ['algebre'],
  compatible: (systeme: Systeme) => Boolean(systeme.composer) && systeme.relations.length >= 2,

  /**
   * La règle à fenêtre vaut pour tous les systèmes, bien que seuls les systèmes
   * fonctionnels donnent deux options.
   *
   * C'est volontaire : l'échelle d'un moteur est unique et se rejoue depuis un
   * historique qui mêle les systèmes. Une règle qui changerait selon le système
   * du dernier item rendrait l'échelon indéterminé. Sept sur huit est par
   * ailleurs une exigence raisonnable à trois options aussi.
   */
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

    /**
     * Le verdict visé, tiré **une fois** et tenu.
     *
     * Le tirer à chaque essai paraît équivalent et ne l'est pas : la boucle
     * rend l'item au premier succès, de sorte qu'un verdict rare — « découle
     * nécessairement » sur un système à trois axes, où les prémisses laissent
     * presque toujours de l'indétermination — serait abandonné dès le premier
     * échec au profit d'un verdict facile. Mesuré avant correction : 2 % de
     * « découle nécessairement » sur `space`, contre 60 % de « reste ouvert ».
     * Une personne aurait appris à répondre toujours la même chose.
     */
    const vise = alea.entier(binaire ? 2 : 3);

    /**
     * La négation de surface est tirée **une fois**, comme le verdict, et pour
     * la même raison : tirée à chaque essai, elle serait abandonnée au premier
     * refus et l'on retomberait toujours sur la forme affirmative.
     *
     * Une fois sur deux seulement au-dessus du seuil. Toujours niées, les
     * prémisses cesseraient d'être un réglage pour devenir le format : on
     * apprendrait à lire « n'est pas » comme un mot de plus, au lieu d'avoir à
     * traverser la négation. L'alternance interdit de s'installer dans un mode.
     */
    const negationVisee =
      negationUnivoque(systeme) && echelon >= ECHELON_NEGATION && alea.entier(2) === 0;

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(3, Math.min(echelon + 2, 9)), alea);

      // Toutes les paires, mélangées : on cherche celle qui réalise le verdict
      // visé, plutôt que d'en tirer une au hasard et de prendre ce qu'elle donne.
      const paires: [string, string][] = [];
      for (const x of instance.entites) {
        for (const y of instance.entites) if (x !== y) paires.push([x, y]);
      }

      for (const [a, b] of alea.melanger(paires).slice(0, 6)) {
        // La paire interrogée ne doit pas être énoncée : sinon il n'y a rien à
        // composer, et la question se réduit à relire une prémisse.
        const faits = instance.faits.filter(
          (fait) =>
            !(fait.sujet === a && fait.objet === b) && !(fait.sujet === b && fait.objet === a),
        );
        if (faits.length < 2) continue;

        const chemin = meilleurChemin(systeme, aretes(systeme, faits), a, b, 4);
        if (!chemin) continue;

        // Le chemin sert de filtre **avant** la propagation complète, qui est
        // coûteuse : sur `classes` ou `rcc8` elle demande d'énumérer les
        // scénarios, et la tester sur six paires par instance sortirait du
        // budget de temps. Le chemin, lui, ne coûte rien.
        if (vise === 0 && chemin.obtenu.size !== 1) continue;
        if (vise === 2 && chemin.obtenu.size < 2) continue;

        const ouvertes = possibilites(
          algebre,
          systeme.cheminComplet,
          instance.entites,
          faits,
          a,
          b,
        );
        if (ouvertes.size === 0) continue;

        // L'exigence qui rend la correction honnête : le chemin doit justifier à
        // lui seul ce que la propagation complète établit.
        if (chemin.obtenu.size !== ouvertes.size) continue;
        let identiques = true;
        for (const r of chemin.obtenu) if (!ouvertes.has(r)) identiques = false;
        if (!identiques) continue;

      const determine = ouvertes.size === 1;
      const exclues = systeme.relations.filter((r) => !ouvertes.has(r.id));

      let relationConclue: string | null = null;
      let verdict = 0;

      if (vise === 0 && determine) {
        relationConclue = [...ouvertes][0];
        verdict = 0;
      } else if (vise === 1 && exclues.length > 0) {
        relationConclue = alea.un(exclues).id;
        verdict = 1;
      } else if (vise === 2 && !determine) {
        relationConclue = alea.un([...ouvertes]);
        verdict = 2;
      }
      if (!relationConclue) continue;

      // En mode binaire, « contredit » et « reste ouvert » se disent tous deux
      // « n'en découle pas » : le verdict affiché se réduit à deux valeurs.
      const bonne = binaire ? (verdict === 0 ? 0 : 1) : verdict;

      const conclusion = `${a} ${libelle(systeme, relationConclue)} ${b}`;

      /*
       * Les prémisses niées : un sous-ensemble non vide des prémisses **du
       * chemin**, tiré au sort. Jamais toutes, pour que l'énoncé garde au moins
       * une forme affirmative à quoi comparer.
       */
      const surLeChemin = chemin.aretes.map((arete) => arete.indice);
      const nies = new Set<number>();
      if (negationVisee && surLeChemin.length >= 2) {
        const combien = 1 + alea.entier(surLeChemin.length - 1);
        for (const indice of alea.plusieurs(surLeChemin, combien)) nies.add(indice);
      }

      // ----- La trace, déposée en recomposant le chemin -------------------
      const carnet = journal();

      /*
       * Les conversions d'abord : le chemin narré ensuite cite des relations
       * positives, et il faut avoir dit d'où elles sortent.
       */
      for (const arete of chemin.aretes) {
        if (!nies.has(arete.indice)) continue;
        const fait = faits[arete.indice];
        const autre = complement(systeme, fait.relation)!;
        const affirme = `${fait.sujet} ${libelle(systeme, fait.relation)} ${fait.objet}`;
        /*
         * Le chemin peut traverser la prémisse dans l'autre sens. Dire
         * seulement « donc A est après G » laisserait alors l'étape suivante
         * parler de « G est avant A » sans qu'on sache d'où vient le
         * retournement. La conversion donne donc les deux formes, et produit
         * celle que le chemin va employer.
         */
        const retourne = arete.de !== fait.sujet;
        const oriente = `${arete.de} ${libelle(systeme, arete.relation)} ${arete.a}`;
        carnet.etape({
          utilise: [ref('premisse', arete.indice)],
          loi: 'négation de surface',
          produit: oriente,
          legende:
            `La prémisse ${arete.indice + 1} est énoncée par la négation : « ${fait.sujet} ` +
            `n’est pas ${libelleNu(systeme, autre)} ${fait.objet} ». Ce système n’a que deux ` +
            `relations, exclusives et exhaustives : nier l’une affirme l’autre, donc ` +
            `${affirme}` +
            (retourne ? `, c’est-à-dire ${oriente}.` : '.'),
          surbrillance: [
            ref('premisse', arete.indice),
            ref('entite', fait.sujet),
            ref('entite', fait.objet),
          ],
        });
      }

      tracerChemin(carnet, systeme, chemin, a, { inutilesParmi: faits.length });

      const nomsOuverts = [...ouvertes].map((r) => libelle(systeme, r));
      carnet.etape({
        utilise: [ref('option', bonne)],
        produit: intitules[bonne],
        legende:
          verdict === 0
            ? `Le chemin ne laisse qu’une relation possible entre ${a} et ${b}, et c’est ` +
              `celle de la conclusion : elle découle donc des prémisses.`
            : verdict === 1
              ? `Le chemin laisse ${ouvertes.size} relation${ouvertes.size > 1 ? 's' : ''} ` +
                `possible${ouvertes.size > 1 ? 's' : ''} entre ${a} et ${b} — ` +
                `${nomsOuverts.join(', ')} — et la conclusion n’en fait pas partie : ` +
                `elle est exclue.`
              : `Le chemin laisse ${ouvertes.size} relations possibles entre ${a} et ${b} : ` +
                `${nomsOuverts.join(', ')}. La conclusion en fait partie, mais rien ne la ` +
                `distingue des autres : les prémisses ne tranchent pas.`,
        surbrillance: [ref('entite', a), ref('entite', b)],
      });
      const trace = carnet.sceller({ genre: 'unique', indice: bonne } as Conclusion);

      // ----- Les options, et l'erreur que chacune incarne ------------------
      const options: Option[] = intitules.map((intitule, i) => ({
        texte: intitule,
        etiquette:
          i === bonne
            ? undefined
            : // Dire « ça découle » quand ça ne fait que rester possible, c'est
              // exactement appliquer la transitivité là où elle ne vaut pas.
              i === 0
              ? ('transitivite-abusive' as const)
              : i === 1 && !binaire
                ? ('hors-zone' as const)
                : ('non-etiquete' as const),
      }));

      return {
        moteur: 'chaine-conclusion',
        systeme: systeme.id,
        consigne: `Que vaut la conclusion « ${conclusion} » ?`,
        enonce: [
          texte(
            `On sait ceci de ${instance.entites.length} entités — les prémisses sont dans le ` +
              'désordre, et toutes ne servent pas' +
              (nies.size
                ? `. Certaines sont énoncées par la négation : ce système n’a que deux ` +
                  `relations, et nier l’une affirme l’autre`
                : '') +
              ' :',
          ),
          {
            type: 'faits',
            phrases: faits.map((fait, i) => {
              const niee = nies.has(i) ? phraseNiee(systeme, fait) : null;
              return `${i + 1}. ${niee ?? `${fait.sujet} ${libelle(systeme, fait.relation)} ${fait.objet}.`}`;
            }),
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
