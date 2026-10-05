/**
 * Moteur « Conclusion composée » — famille Chaînes de prémisses.
 *
 * Deux conclusions reliées par un connecteur logique, et une seule question :
 * l'énoncé composé tient-il ? C'est le format que Syllogimous appelle
 * *binary*, et il ajoute aux chaînes une couche que rien d'autre n'exerce — non
 * plus l'inférence relationnelle seule, mais la **composition d'inférences**.
 *
 * ## Pourquoi il ne tourne que sur les systèmes fonctionnels
 *
 * Un connecteur se calcule sur des valeurs de vérité, et il faut donc que
 * chaque membre **ait** une valeur de vérité. C'est le cas sur `rang`,
 * `anneau`, `groups` et `cyclic` : leur composition est fonctionnelle, une
 * chaîne couvrant les entités fixe tout le réseau, et chaque énoncé y est vrai
 * ou faux.
 *
 * Ailleurs, un membre peut rester **ouvert**, et le connecteur cesse d'être une
 * table de vérité : « A est avant B ou A est après B » découle des prémisses
 * alors qu'aucun des deux membres n'en découle. C'est vrai, c'est instructif, et
 * cela demande de raisonner sur les situations conjointes et non sur deux
 * ensembles de possibilités séparés — un troisième solveur. Plutôt que de poser
 * la question sur un système où la réponse serait approximative, le moteur s'y
 * refuse, et la note est ici pour qu'on sache que l'extension reste à faire.
 *
 * ## Deux options, donc l'échelle à fenêtre
 *
 * La réponse est oui ou non. Trois réussites d'affilée arriveraient une fois
 * sur huit par hasard : le moteur déclare la même règle que ses voisins, sept
 * réussites sur huit.
 */
import { compiler, possibilites } from '../../noyaux/algebre';
import { journal, ref } from '../../../correction/trace';
import { libelle, que, texte } from '../../noyaux/presentation';
import { aretes, fonctionnel, meilleurChemin, type Chemin } from '../../noyaux/chemin';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 60;

interface Connecteur {
  id: string;
  /** Rend l'énoncé composé, les deux membres déjà entre guillemets. */
  phrase(p: string, q: string): string;
  /** La table de vérité. */
  valeur(p: boolean, q: boolean): boolean;
  /** Ce que le connecteur exige, au subjonctif, pour s'enchâsser après « que ». */
  exigence: string;
}

/**
 * Les membres sont **cités entre guillemets**, et ce n'est pas une coquetterie
 * typographique.
 *
 * Un membre inséré nu dans la phrase du connecteur produit des fautes qu'on ne
 * voit qu'à l'exécution : « ni Guvran est à cinq places à gauche de Beuvroin »
 * — il faudrait « n'est », et le connecteur ne connaît pas la forme verbale du
 * membre qu'on lui passe. Cité, le membre devient un **nom** : « ni « Guvran est
 * à gauche de Beuvroin » ni « … » » se lit, et la construction tient quelle que
 * soit la relation du système.
 */
const cite = (membre: string) => `« ${membre} »`;

const CONNECTEURS: Connecteur[] = [
  {
    id: 'et',
    phrase: (p, q) => `${cite(p)} et ${cite(q)} sont vrais tous les deux`,
    valeur: (p, q) => p && q,
    exigence: 'les deux membres soient vrais',
  },
  {
    id: 'non-et',
    phrase: (p, q) => `${cite(p)} et ${cite(q)} ne sont pas vrais tous les deux`,
    valeur: (p, q) => !(p && q),
    exigence: 'les deux membres ne soient pas vrais en même temps',
  },
  {
    id: 'ou',
    phrase: (p, q) => `${cite(p)} ou ${cite(q)} — au moins l’un des deux`,
    valeur: (p, q) => p || q,
    exigence: 'au moins un des deux membres soit vrai',
  },
  {
    id: 'ni',
    phrase: (p, q) => `ni ${cite(p)} ni ${cite(q)}`,
    valeur: (p, q) => !p && !q,
    exigence: 'aucun des deux membres ne soit vrai',
  },
  {
    id: 'ou-exclusif',
    phrase: (p, q) => `${cite(p)} ou ${cite(q)}, mais pas les deux`,
    valeur: (p, q) => p !== q,
    exigence: 'exactement un des deux membres soit vrai',
  },
  {
    id: 'equivalence',
    phrase: (p, q) => `${cite(p)} et ${cite(q)} sont vrais tous les deux, ou faux tous les deux`,
    valeur: (p, q) => p === q,
    exigence: 'les deux membres aient la même valeur',
  },
];

interface Membre {
  a: string;
  b: string;
  relation: string;
  vrai: boolean;
  chemin: Chemin;
  phrase: string;
}

export const chaineComposee: Moteur = {
  id: 'chaine-composee',
  nom: 'Conclusion composée',
  categorie: 'chaines',
  resume:
    'Deux conclusions reliées par « et », « ou », « ni… ni » : l’énoncé composé tient-il ?',
  regimes: ['algebre'],

  /**
   * Seuls les systèmes fonctionnels : voir l'en-tête. Au moins trois relations
   * aussi, pour qu'un membre faux ne se devine pas — sur un vocabulaire de deux
   * relations, « ce n'est pas celle-ci » désigne l'autre sans calcul.
   */
  compatible: (systeme: Systeme) => fonctionnel(systeme) && systeme.relations.length >= 3,

  echelle: { reussites: 7, fenetre: 8, descente: 4 },

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    if (!systeme.composer) return null;
    const algebre = {
      relations: systeme.relations.map((r) => r.id),
      converse: systeme.converse,
      composer: systeme.composer,
    };
    compiler(algebre);

    const connecteur = alea.un(CONNECTEURS);
    // Le verdict visé est tiré une fois et tenu : le tirer à chaque essai
    // laisserait le générateur retomber sur le verdict le plus facile à
    // fabriquer, comme cela s'est produit sur « chaine-conclusion ».
    const vise = alea.entier(2) === 0;

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(4, Math.min(echelon + 3, 9)), alea);
      if (instance.entites.length < 4) continue;
      const liste = aretes(systeme, instance.faits);

      // On cherche deux membres portant sur des paires **distinctes** et non
      // énoncées : deux membres sur la même paire rendraient « et » toujours
      // faux et « ou-exclusif » toujours vrai.
      const paires: [string, string][] = [];
      for (const x of instance.entites) {
        for (const y of instance.entites) if (x !== y) paires.push([x, y]);
      }

      const membres: Membre[] = [];
      for (const [a, b] of alea.melanger(paires)) {
        if (membres.length >= 2) break;
        if (membres.some((m) => (m.a === a && m.b === b) || (m.a === b && m.b === a))) continue;
        if (instance.faits.some((f) => (f.sujet === a && f.objet === b) || (f.sujet === b && f.objet === a))) {
          continue;
        }

        const chemin = meilleurChemin(systeme, liste, a, b, 4);
        if (!chemin || chemin.obtenu.size !== 1) continue;

        const ouvertes = possibilites(
          algebre,
          systeme.cheminComplet,
          instance.entites,
          instance.faits,
          a,
          b,
        );
        if (ouvertes.size !== 1) continue;
        const etablie = [...ouvertes][0];
        if (!chemin.obtenu.has(etablie)) continue;

        // Un membre vrai énonce la relation établie ; un membre faux en énonce
        // une autre. On tire l'un ou l'autre, pour que le composé ne soit pas
        // prévisible.
        const vraiMembre = alea.entier(2) === 0;
        const autres = systeme.relations.filter((r) => r.id !== etablie);
        if (!vraiMembre && autres.length === 0) continue;
        const relation = vraiMembre ? etablie : alea.un(autres).id;

        membres.push({
          a,
          b,
          relation,
          vrai: vraiMembre,
          chemin,
          phrase: `${a} ${libelle(systeme, relation)} ${b}`,
        });
      }
      if (membres.length < 2) continue;

      const [p, q] = membres;
      const valeur = connecteur.valeur(p.vrai, q.vrai);
      if (valeur !== vise) continue;

      // ----- La trace : un membre après l'autre, puis le connecteur --------
      const carnet = journal();
      const surLesChemins = new Set(
        [...p.chemin.aretes, ...q.chemin.aretes].map((x) => x.indice),
      );
      instance.faits.forEach((_, indice) => {
        if (!surLesChemins.has(indice)) carnet.inutile(ref('premisse', indice));
      });

      membres.forEach((membre, rang) => {
        const nomsPremisses = membre.chemin.aretes.map((x) => x.indice + 1).join(' puis ');
        const etablie = [...membre.chemin.obtenu][0];
        carnet.etape({
          utilise: membre.chemin.aretes.map((x) => ref('premisse', x.indice)),
          loi: 'composition',
          produit: `${membre.a} ${libelle(systeme, etablie)} ${membre.b}`,
          legende:
            `Membre ${rang + 1} : en composant la prémisse ${nomsPremisses}, on établit que ` +
            `${membre.a} ${libelle(systeme, etablie)} ${membre.b}. ` +
            (membre.vrai
              ? 'C’est exactement ce qu’affirme ce membre : il est donc vrai.'
              : `Or ce membre affirme que ${membre.phrase} : il est donc faux.`),
          surbrillance: [
            ...membre.chemin.aretes.map((x) => ref('premisse', x.indice)),
            ref('entite', membre.a),
            ref('entite', membre.b),
          ],
        });
      });

      carnet.etape({
        utilise: [ref('option', valeur ? 0 : 1)],
        produit: valeur ? 'l’énoncé composé tient' : 'l’énoncé composé ne tient pas',
        legende:
          `Le premier membre est ${p.vrai ? 'vrai' : 'faux'}, le second est ` +
          `${q.vrai ? 'vrai' : 'faux'}. Or ce connecteur exige ${que(connecteur.exigence)} : ` +
          `l’énoncé composé ${valeur ? 'tient donc' : 'ne tient donc pas'}.`,
        surbrillance: [
          ref('entite', p.a),
          ref('entite', p.b),
          ref('entite', q.a),
          ref('entite', q.b),
        ],
      });
      const trace = carnet.sceller({ genre: 'unique', indice: valeur ? 0 : 1 });

      const options: Option[] = [
        {
          texte: 'Oui, l’énoncé composé découle des prémisses',
          // Répondre oui quand le composé ne tient pas, c'est avoir conclu de
          // membres qu'on n'a pas évalués jusqu'au bout.
          etiquette: valeur ? undefined : ('hors-zone' as const),
        },
        {
          texte: 'Non, il n’en découle pas',
          etiquette: valeur ? ('transitivite-abusive' as const) : undefined,
        },
      ];

      return {
        moteur: 'chaine-composee',
        systeme: systeme.id,
        // Pas de guillemets autour du composé : ses membres en portent déjà,
        // et des guillemets imbriqués de même forme sont illisibles.
        consigne: `Que vaut cet énoncé composé — ${connecteur.phrase(p.phrase, q.phrase)} ?`,
        enonce: [
          texte(
            `On sait ceci de ${instance.entites.length} entités — les prémisses sont dans le ` +
              'désordre, et toutes ne servent pas :',
          ),
          {
            type: 'faits',
            phrases: instance.faits.map(
              (fait, i) =>
                `${i + 1}. ${fait.sujet} ${libelle(systeme, fait.relation)} ${fait.objet}.`,
            ),
          },
        ],
        reponse: { genre: 'unique', options, bonne: valeur ? 0 : 1 },
        explication: trace.etapes[trace.etapes.length - 1].legende,
        trace,
      };
    }
    return null;
  },
};
