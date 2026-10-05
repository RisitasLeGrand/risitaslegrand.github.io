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
 */
import { compiler, possibilites } from '../../noyaux/algebre';
import { libelle, texte } from '../../noyaux/presentation';
import { journal, ref, type Conclusion } from '../../../correction/trace';
import type { Alea, Fait, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 70;

/** Les trois verdicts, dans les mots d'« Entre-deux ». */
const VERDICTS = [
  'il découle nécessairement des prémisses',
  'il les contredit : aucune situation compatible ne le vérifie',
  'il reste ouvert : les prémisses ne permettent pas de trancher',
];

/** Les deux verdicts du mode binaire. */
const BINAIRES = ['il découle nécessairement des prémisses', 'il n’en découle pas'];

/**
 * Un système dont deux relations ne se composent jamais en plusieurs.
 *
 * Mémoïsé, parce que le test parcourt le carré du vocabulaire et que `plan-temps`
 * en compte sept cent vingt-neuf cases.
 */
const memoFonctionnel = new WeakMap<Systeme, boolean>();
function fonctionnel(systeme: Systeme): boolean {
  const connu = memoFonctionnel.get(systeme);
  if (connu !== undefined) return connu;
  let resultat = Boolean(systeme.composer) && systeme.cheminComplet;
  if (resultat && systeme.composer) {
    for (const r of systeme.relations) {
      for (const s of systeme.relations) {
        if (systeme.composer(r.id, s.id).size > 1) {
          resultat = false;
          break;
        }
      }
      if (!resultat) break;
    }
  }
  memoFonctionnel.set(systeme, resultat);
  return resultat;
}

interface Arete {
  de: string;
  a: string;
  relation: string;
  /** Rang de la prémisse dans la liste affichée. */
  indice: number;
}

interface Chemin {
  aretes: Arete[];
  /** L'ensemble des relations que ce chemin laisse possibles entre les bouts. */
  obtenu: Set<string>;
}

/** Les arêtes parcourables : chaque prémisse dans ses deux sens. */
function aretes(systeme: Systeme, faits: readonly Fait[]): Arete[] {
  const liste: Arete[] = [];
  faits.forEach((fait, indice) => {
    liste.push({ de: fait.sujet, a: fait.objet, relation: fait.relation, indice });
    liste.push({
      de: fait.objet,
      a: fait.sujet,
      relation: systeme.converse(fait.relation),
      indice,
    });
  });
  return liste;
}

/**
 * Le chemin le plus informatif de `a` vers `b`, parmi les chemins simples.
 *
 * « Le plus informatif » et non « le plus court » : un détour qui laisse une
 * seule relation possible justifie une conclusion qu'un raccourci ambigu ne
 * justifierait pas. À égalité d'information, le plus court gagne — une
 * correction de trois étapes se suit mieux qu'une de cinq.
 */
function meilleurChemin(
  systeme: Systeme,
  liste: readonly Arete[],
  a: string,
  b: string,
  longueurMax: number,
): Chemin | null {
  if (!systeme.composer) return null;
  let meilleur: Chemin | null = null;

  const explorer = (courant: string, vus: Set<string>, prises: Arete[], obtenu: Set<string>) => {
    if (prises.length > 0 && courant === b) {
      const candidat: Chemin = { aretes: [...prises], obtenu: new Set(obtenu) };
      if (
        !meilleur ||
        candidat.obtenu.size < meilleur.obtenu.size ||
        (candidat.obtenu.size === meilleur.obtenu.size &&
          candidat.aretes.length < meilleur.aretes.length)
      ) {
        meilleur = candidat;
      }
      return;
    }
    if (prises.length >= longueurMax) return;

    for (const arete of liste) {
      if (arete.de !== courant) continue;
      if (vus.has(arete.a)) continue;
      if (prises.some((p) => p.indice === arete.indice)) continue;

      const suivant = new Set<string>();
      if (obtenu.size === 0) {
        suivant.add(arete.relation);
      } else {
        for (const r of obtenu) for (const t of systeme.composer!(r, arete.relation)) suivant.add(t);
      }
      // Un chemin dont la composition est vide est contradictoire : il ne
      // justifie rien et n'a pas à être exploré plus loin.
      if (suivant.size === 0) continue;

      vus.add(arete.a);
      prises.push(arete);
      explorer(arete.a, vus, prises, suivant);
      prises.pop();
      vus.delete(arete.a);
    }
  };

  explorer(a, new Set([a]), [], new Set());
  return meilleur;
}

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
      const surLeChemin = new Set(chemin.aretes.map((x) => x.indice));

      // ----- La trace, déposée en recomposant le chemin -------------------
      const carnet = journal();
      faits.forEach((_, indice) => {
        if (!surLeChemin.has(indice)) carnet.inutile(ref('premisse', indice));
      });

      let accumule = new Set<string>();
      chemin.aretes.forEach((arete, rang) => {
        const avant = accumule;
        accumule =
          avant.size === 0
            ? new Set([arete.relation])
            : new Set(
                [...avant].flatMap((r) => [...systeme.composer!(r, arete.relation)]),
              );
        const mobilisees = chemin.aretes.slice(0, rang + 1).map((x) => ref('premisse', x.indice));
        carnet.etape({
          utilise: [ref('premisse', arete.indice)],
          loi: rang === 0 ? undefined : 'composition',
          produit:
            accumule.size === 1
              ? `${a} ${libelle(systeme, [...accumule][0])} ${arete.a}`
              : `${a} et ${arete.a} : ${accumule.size} relations encore possibles`,
          legende:
            rang === 0
              ? `La prémisse ${arete.indice + 1} relie ${arete.de} à ${arete.a}.`
              : accumule.size === 1
                ? `En composant avec la prémisse ${arete.indice + 1}, on obtient : ` +
                  `${a} ${libelle(systeme, [...accumule][0])} ${arete.a}.`
                : `En composant avec la prémisse ${arete.indice + 1}, ${accumule.size} relations ` +
                  `restent possibles entre ${a} et ${arete.a}.`,
          surbrillance: [...mobilisees, ref('entite', a), ref('entite', arete.a)],
        });
      });

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
              'désordre, et toutes ne servent pas :',
          ),
          {
            type: 'faits',
            phrases: faits.map(
              (fait, i) => `${i + 1}. ${fait.sujet} ${libelle(systeme, fait.relation)} ${fait.objet}.`,
            ),
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
