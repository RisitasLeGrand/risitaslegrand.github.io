/**
 * Les trois échelles : WHO-5, PHQ-9, GAD-7.
 *
 * ## Les textes sont verbatim, et c'est le point entier
 *
 * Chaque item, chaque option, chaque consigne est repris **au caractère** des
 * documents authentifiés et empreintés le 13 octobre 2026 — voir
 * `docs/cyclades/echelles-psyche/releve-sources.md`, sections 10, 12 et 14.
 *
 * Trois relevés confiés à des modèles externes ont été rejetés avant ceux-là.
 * L'un donnait huit items faux sur neuf tout en ayant l'air parfaitement
 * plausible, et restituait en revanche correctement les seuils — parce qu'ils
 * sont très diffusés. C'est la signature de la mémoire paramétrique : ce qui
 * est répété partout ressort juste, ce qui est propre à un document ressort
 * inventé. **Rien ici ne doit être réécrit de mémoire.** `controlerEchelles()`
 * vérifie les comptes et les valeurs ; il ne peut pas vérifier les mots, et
 * c'est pourquoi cette note existe.
 *
 * Les documents n'emploient que l'apostrophe typographique `’` (U+2019).
 *
 * ## Les paliers sont cités, pas prononcés
 *
 * Décision du 13 octobre 2026, prise après le constat de la section 14.5 du
 * relevé : le manuel indique que **peu de traductions ont été validées
 * psychométriquement**, et les seuils sont établis sur les versions
 * **anglaises**. Rien n'établit que la traduction française « France » l'ait
 * été.
 *
 * Les paliers sont donc affichés — c'est plus utile qu'un score nu — mais
 * dans les **termes anglais du manuel**, et accompagnés de leur provenance.
 * Deux raisons.
 *
 * D'abord l'exactitude : `Moderate` est l'étiquette que la source attache à
 * cette tranche, et la traduire reviendrait à produire une étiquette
 * française que personne n'a validée.
 *
 * Ensuite la cohérence avec le reste de Psyché. `MOTS_INTERDITS` y refuse
 * « léger », « modéré » et « sévère » depuis la phase 7, parce qu'employer le
 * vocabulaire des échelles pour qualifier une glissière maison, c'est
 * emprunter l'autorité d'un instrument qu'on n'a pas administré. Ici
 * l'instrument **est** administré, mais la réserve demeure : le palier n'est
 * pas le verdict de Cyclades, c'est une tranche d'un barème américain qu'on
 * cite. L'anglais le marque à l'œil, sans avoir à l'expliquer.
 *
 * **Avec une limite, découverte en écrivant les essais.** L'anglais protège
 * le lecteur, pas la machine : `controlerVocabulairePsyche` retire les
 * accents avant de comparer, donc « sévère » y devient « severe » et heurte
 * l'étiquette `Severe`. Ce contrôle ne doit donc pas être appliqué aux
 * étiquettes de paliers — il reste appliqué à tout ce que Cyclades compose
 * de son propre chef. Ce qui tient la règle ici, c'est `controlerEchelles()`
 * et sa double exigence : langue de la source, et provenance affichée.
 *
 * ## Le WHO-5 n'a pas de palier, et n'en aura pas
 *
 * Son document ne porte **aucun seuil d'interprétation** — vérifié. Les
 * seuils de 13 ou de 50 qui circulent viennent d'ailleurs, et les inscrire
 * ici reviendrait exactement à ce qu'on reproche aux relevés rejetés. Le
 * score brut, sur cent, et la phrase du document : « Un score élevé signifie
 * un meilleur bien-être. »
 */

import { accorde, pluriel } from '../noyau/accords';
import {
  controlerPopulation,
  populationNonLue,
  type PopulationVisee,
} from '../noyau/population';

/* ══════════════════════════════════════════════════════════════════════════
   Le modèle
   ══════════════════════════════════════════════════════════════════════════ */

export type IdEchelle = 'who5' | 'phq9' | 'gad7';

export interface Option {
  libelle: string;
  valeur: number;
}

export interface Palier {
  /** Score minimal de la tranche, inclus. */
  de: number;
  /** Score maximal de la tranche, inclus. */
  a: number;
  /** L'étiquette **de la source**, dans sa langue. Jamais traduite. */
  etiquette: string;
  /**
   * Vrai quand l'étiquette **n'est pas celle de la source** mais une mention
   * de Cyclades.
   *
   * Un seul cas : la tranche 0-4 du GAD-7. Le manuel donne trois points de
   * coupure et nomme les trois tranches qui s'ensuivent ; il ne nomme pas
   * celle d'en dessous. Il fallait pourtant l'étiqueter pour couvrir
   * l'intervalle, d'où « Below cutpoint ».
   *
   * Ce drapeau existe parce que l'interface disait « la tranche que le manuel
   * nomme » pour **toutes** les tranches — vrai huit fois sur neuf, et faux
   * pour celle-là. Une attribution fausse à la source est exactement ce que
   * ce dossier combat ; elle était d'autant plus coûteuse qu'elle était
   * invisible au milieu de huit attributions justes.
   *
   * Conséquence d'affichage : une étiquette citée se met entre guillemets,
   * une étiquette déduite n'en porte pas.
   */
  deduit?: boolean;
}

export interface Echelle {
  id: IdEchelle;
  titre: string;
  consigne: string;
  periode: string;
  items: readonly string[];
  options: readonly Option[];
  /** Score maximal atteignable. */
  maximum: number;
  /** Multiplicateur appliqué à la somme. 1 partout sauf le WHO-5. */
  facteur: number;
  /** Vide quand la source n'en donne aucun. */
  paliers: readonly Palier[];
  /** D'où viennent les paliers, mot pour mot dans l'interface. */
  origineDesPaliers: string | null;
  /**
   * Sur quelle population les paliers ont été établis, ou pourquoi on l'ignore.
   *
   * ## Pourquoi un champ de plus à côté de `reserve`
   *
   * `reserve` dit ce que la source déclare de sa propre portée, en prose, et
   * c'est utile à lire. Mais une phrase ne se compare à rien : aucun écran ne
   * peut en tirer « ce repère ne vous concerne pas ». Le § 3.3 du prompt du
   * cycle demande un jugement, et un jugement demande une forme.
   *
   * Les deux cohabitent sans se recouvrir : `reserve` est citée, celui-ci est
   * évalué. Pour le WHO-5, qui n'affiche aucun palier, le champ dit qu'il n'y
   * a rien à situer.
   */
  populationDesPaliers: PopulationVisee;
  /** L'attribution que la source impose ou propose, verbatim. */
  attribution: string;
  /** Ce que la source dit de sa propre portée. */
  reserve: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les trois échelles, verbatim
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Pourquoi la population des tranches du PHQ-9 et du GAD-7 n'est pas lue.
 *
 * Une constante pour que la raison soit la même sur les deux : les tranches
 * viennent du même manuel, et deux formulations voisines finiraient par se
 * contredire sur le motif.
 *
 * Le manuel du PHQ dit déjà, et `reserve` le cite, que les tranches sont
 * établies sur la version anglaise et que peu de traductions ont été
 * validées. Mais **sur qui** elles l'ont été — quel âge, quel sexe, quel
 * cadre de soins — n'a pas été relevé : le manuel est hors de portée de ce
 * conteneur. Le déduire de l'intitulé « Psychiatric Annals 2002 » serait
 * l'inventer.
 */
const POPULATION_DES_TRANCHES_NON_RELUE =
  'le manuel du PHQ n’est pas atteignable depuis ce conteneur, et sur qui ses tranches ont été ' +
  'établies — âge, sexe, cadre de soins — n’a pas été relevé. La réserve citée porte sur la ' +
  'langue, pas sur la population.';

const OPTIONS_PHQ_GAD: readonly Option[] = [
  { libelle: 'Jamais', valeur: 0 },
  { libelle: 'Plusieurs jours', valeur: 1 },
  { libelle: 'Plus de la moitié du temps', valeur: 2 },
  { libelle: 'Presque tous les jours', valeur: 3 },
];

export const WHO5: Echelle = {
  id: 'who5',
  titre: 'Indice (en cinq points) de bien-être de l’OMS (1999)',
  consigne:
    'Veuillez indiquer, pour chacune des cinq affirmations, laquelle se rapproche le plus de ce ' +
    'que vous avez ressenti au cours des deux dernières semaines. Notez que le chiffre est ' +
    'proportionnel au bien-être.\nExemple : si vous vous êtes senti(e) bien et de bonne humeur ' +
    'plus de la moitié du temps au cours des deux dernières semaines, cochez la case 3.',
  periode: 'Au cours des deux dernières semaines',
  items: [
    'Je me suis senti(e) bien et de bonne humeur',
    'Je me suis senti(e) calme et tranquille',
    'Je me suis senti(e) plein(e) d’énergie et vigoureux(se)',
    'Je me suis réveillé(e) en me sentant frais(che) et dispos(e)',
    'Ma vie quotidienne a été remplie de choses intéressantes',
  ],
  /* La majuscule de « Tout le Temps » est bien celle du document. */
  options: [
    { libelle: 'Tout le Temps', valeur: 5 },
    { libelle: 'La plupart du temps', valeur: 4 },
    { libelle: 'Plus de la moitié du temps', valeur: 3 },
    { libelle: 'Moins de la moitié du temps', valeur: 2 },
    { libelle: 'De temps en temps', valeur: 1 },
    { libelle: 'Jamais', valeur: 0 },
  ],
  maximum: 100,
  facteur: 4,
  paliers: [],
  origineDesPaliers: null,
  attribution:
    '© Psychiatric Research Unit, WHO Collaborating Center for Mental Health, Frederiksborg ' +
    'General Hospital, DK-3400 Hillerød',
  reserve:
    'L’OMS décline la responsabilité de l’exactitude de cette traduction et déclare la version ' +
    'anglaise seule contraignante et authentique. Le document ne donne aucun seuil ' +
    'd’interprétation : seul le score brut est affiché, et un score élevé signifie un meilleur ' +
    'bien-être.',
  /*
     Sans objet, et c'est exemplaire plutôt que lacunaire : le document ne
     porte aucun seuil, donc il n'y a aucune tranche dont il faudrait savoir
     sur qui elle a été établie. Les seuils de 13 ou de 50 qui circulent
     viennent d'ailleurs et n'ont pas été inscrits.
  */
  populationDesPaliers: populationNonLue(
    'le document ne donne aucun seuil : il n’y a aucune tranche dont il faudrait situer la ' +
      'population.',
  ),
};

export const PHQ9: Echelle = {
  id: 'phq9',
  titre: 'QUESTIONNAIRE SUR LA SANTÉ DU PATIENT – 9 (PHQ-9)',
  consigne:
    'Au cours des 2 dernières semaines, selon quelle fréquence avez-vous été gêné(e) par les ' +
    'problèmes suivants ?',
  periode: 'Au cours des 2 dernières semaines',
  items: [
    'Peu d’intérêt ou de plaisir à faire les choses',
    'Être triste, déprimé(e) ou désespéré(e)',
    'Difficultés à s’endormir ou à rester endormi(e), ou dormir trop',
    'Se sentir fatigué(e) ou manquer d’énergie',
    'Avoir peu d’appétit ou manger trop',
    'Avoir une mauvaise opinion de soi-même, ou avoir le sentiment d’être nul(le), ou d’avoir déçu sa famille ou s’être déçu(e) soi-même',
    'Avoir du mal à se concentrer, par exemple, pour lire le journal ou regarder la télévision',
    'Bouger ou parler si lentement que les autres auraient pu le remarquer. Ou au contraire, être si agité(e) que vous avez eu du mal à tenir en place par rapport à d’habitude',
    'Penser qu’il vaudrait mieux mourir ou envisager de vous faire du mal d’une manière ou d’une autre',
  ],
  options: OPTIONS_PHQ_GAD,
  maximum: 27,
  facteur: 1,
  /* Table 4 du manuel d'instructions. Étiquettes non traduites : voir l'en-tête. */
  paliers: [
    { de: 0, a: 4, etiquette: 'None-minimal' },
    { de: 5, a: 9, etiquette: 'Mild' },
    { de: 10, a: 14, etiquette: 'Moderate' },
    { de: 15, a: 19, etiquette: 'Moderately Severe' },
    { de: 20, a: 27, etiquette: 'Severe' },
  ],
  origineDesPaliers:
    'Table 4 de l’« Instruction Manual » du PHQ, d’après Kroenke K, Spitzer RL, Psychiatric ' +
    'Annals 2002;32:509-521. Ces tranches sont établies sur la version anglaise ; le manuel ' +
    'indique que peu de traductions ont été validées psychométriquement, et rien n’établit que ' +
    'la traduction française l’ait été. Les étiquettes sont citées dans la langue de la source.',
  attribution:
    'Développé par les Dr Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke et leurs ' +
    'collègues grâce à une allocation d’études de Pfizer Inc. La reproduction, la traduction, ' +
    'l’affichage ou la distribution de ce document sont autorisés.',
  reserve:
    'Le manuel précise que la question sur la difficulté ressentie n’entre pas dans le calcul du ' +
    'score : elle rend l’impression générale de la personne sur la gêne occasionnée. Il précise ' +
    'aussi qu’une décision sur un risque réel de se faire du mal demande un entretien clinique, ' +
    'qu’aucun questionnaire ne remplace.',
  populationDesPaliers: populationNonLue(POPULATION_DES_TRANCHES_NON_RELUE),
};

export const GAD7: Echelle = {
  id: 'gad7',
  titre: 'GAD-7',
  consigne:
    'Au cours des 2 dernières semaines, selon quelle fréquence avez-vous été gêné(e) par les ' +
    'problèmes suivants ?',
  periode: 'Au cours des 2 dernières semaines',
  items: [
    'Un sentiment de nervosité, d’anxiété ou de tension',
    'Une incapacité à arrêter de s’inquiéter ou à contrôler ses inquiétudes',
    'Une inquiétude excessive à propos de différentes choses',
    'Des difficultés à se détendre',
    'Une agitation telle qu’il est difficile à tenir en place',
    'Une tendance à être facilement contrarié(e) ou irritable',
    'Un sentiment de peur comme si quelque chose de terrible risquait de se produire',
  ],
  options: OPTIONS_PHQ_GAD,
  maximum: 21,
  facteur: 1,
  /*
     Le manuel ne donne pas de tableau pour le GAD-7 : seulement les points de
     coupure 5, 10 et 15, en texte. Les tranches sont donc déduites de ces
     trois points, et les étiquettes sont celles de la phrase du manuel —
     « mild, moderate, and severe anxiety ». Il n'y a pas de cinquième
     tranche, contrairement au PHQ-9.
  */
  paliers: [
    { de: 0, a: 4, etiquette: 'Below cutpoint', deduit: true },
    { de: 5, a: 9, etiquette: 'Mild' },
    { de: 10, a: 14, etiquette: 'Moderate' },
    { de: 15, a: 21, etiquette: 'Severe' },
  ],
  origineDesPaliers:
    'Points de coupure 5, 10 et 15 donnés en texte par l’« Instruction Manual » du PHQ. Le ' +
    'manuel ajoute qu’un score de 10 ou plus justifie une évaluation complémentaire. Comme ' +
    'pour le PHQ-9, ces tranches sont établies sur la version anglaise, et la validation de la ' +
    'traduction française n’est pas établie. Le manuel ne nomme pas la tranche sous le premier ' +
    'point de coupure : « Below cutpoint » est une mention de Cyclades, déduite, et non une ' +
    'étiquette de la source.',
  attribution:
    'Développé par les Dr Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke et leurs ' +
    'collègues grâce à une allocation d’études de Pfizer Inc. La reproduction, la traduction, ' +
    'l’affichage ou la distribution de ce document sont autorisés.',
  reserve:
    'Le manuel ne donne pas de tableau de conduite à tenir pour le GAD-7, seulement trois points ' +
    'de coupure. Les tranches affichées en sont déduites.',
  populationDesPaliers: populationNonLue(POPULATION_DES_TRANCHES_NON_RELUE),
};

export const ECHELLES: readonly Echelle[] = [WHO5, PHQ9, GAD7];

export const echelle = (id: IdEchelle): Echelle => {
  const e = ECHELLES.find((x) => x.id === id);
  if (!e) throw new Error(`échelle inconnue : ${id}`);
  return e;
};

/* ══════════════════════════════════════════════════════════════════════════
   Le score
   ══════════════════════════════════════════════════════════════════════════ */

export interface Passation {
  /** ULID. */
  id: string;
  echelle: IdEchelle;
  jour: string;
  /** Une réponse par item, dans l'ordre. `null` pour une non-réponse. */
  reponses: readonly (number | null)[];
  /** PHQ-9 seulement : la gêne ressentie, hors score. */
  gene: string | null;
  majLe: string;
}

export interface Resultat {
  score: number | null;
  maximum: number;
  /** Null quand la source ne donne pas de palier, ou le score pas calculable. */
  palier: Palier | null;
  /** Combien d'items restent sans réponse. */
  sansReponse: number;
}

/**
 * Le score, ou `null`.
 *
 * **Un questionnaire incomplet n'a pas de score**, et surtout pas un score
 * partiel. Compter les items non répondus comme des zéros produirait un
 * chiffre plus bas, donc plus rassurant, sur la seule foi de ce qui n'a pas
 * été rempli — exactement l'erreur que la veille passe son temps à éviter.
 */
export function noter(e: Echelle, reponses: readonly (number | null)[]): Resultat {
  const sansReponse = e.items.length - reponses.filter((r) => r !== null).length;
  if (sansReponse > 0 || reponses.length !== e.items.length) {
    return { score: null, maximum: e.maximum, palier: null, sansReponse: Math.max(sansReponse, 0) };
  }
  const score = reponses.reduce<number>((s, r) => s + (r ?? 0), 0) * e.facteur;
  const palier = e.paliers.find((p) => score >= p.de && score <= p.a) ?? null;
  return { score, maximum: e.maximum, palier, sansReponse: 0 };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les trois échelles se contrôlent elles-mêmes.
 *
 * Ce contrôle ne peut pas vérifier que les mots sont les bons — seule la
 * confrontation au document le peut, et elle a été faite. Il vérifie ce qui
 * dérive en silence : les comptes, les valeurs, et surtout qu'aucun palier
 * n'apparaisse sans sa provenance, ni traduit en français.
 */
export function controlerEchelles(echelles: readonly Echelle[] = ECHELLES): string[] {
  const problemes: string[] = [];

  for (const e of echelles) {
    const attendus = { who5: 5, phq9: 9, gad7: 7 }[e.id];
    if (e.items.length !== attendus) {
      problemes.push(`« ${e.id} » porte ${e.items.length} items au lieu de ${attendus}.`);
    }
    const max = Math.max(...e.options.map((o) => o.valeur)) * e.items.length * e.facteur;
    if (max !== e.maximum) {
      problemes.push(`« ${e.id} » annonce un maximum de ${e.maximum}, les options en donnent ${max}.`);
    }
    if (!e.attribution.trim()) problemes.push(`« ${e.id} » n’attribue pas sa source.`);

    /*
       Un palier sans provenance serait présenté comme le jugement de
       Cyclades. C'est exactement ce que la décision du 13 octobre refuse.
    */
    /*
       La cohérence de la population est contrôlée ici, et pas seulement dans
       `essais:population` : ce contrôle-ci tourne partout où les échelles
       sont relues, l'essai ne tourne que quand on le lance.
    */
    problemes.push(...controlerPopulation(e.populationDesPaliers, `« ${e.id} »`));
    /*
       ET L'INVERSE DU PIÈGE : des paliers affichés avec une population
       DÉCLARÉE mais aucune provenance de tranches serait un repère qui sait à
       qui il s'applique sans savoir d'où il sort. Les deux vont ensemble.
    */
    if (e.populationDesPaliers.declaree && !e.paliers.length) {
      problemes.push(
        `« ${e.id} » déclare la population de ses paliers alors qu'il n'en affiche aucun.`,
      );
    }

    if (e.paliers.length && !e.origineDesPaliers) {
      problemes.push(
        `« ${e.id} » affiche des paliers sans dire d’où ils viennent. Un palier sans sa ` +
          'provenance se lit comme un verdict de l’application.',
      );
    }
    if (e.origineDesPaliers && !/anglaise/.test(e.origineDesPaliers)) {
      problemes.push(
        `« ${e.id} » ne dit pas que ses tranches sont établies sur la version anglaise. ` +
          'C’est la réserve de la section 14.5 du relevé, et elle est obligatoire.',
      );
    }

    /*
       Les étiquettes restent dans la langue de la source. Les traduire
       produirait des mots — « léger », « modéré », « sévère » — que
       `MOTS_INTERDITS` refuse ailleurs dans Psyché, et qui se liraient comme
       une qualification maison plutôt que comme une citation.
    */
    for (const p of e.paliers) {
      if (/[àâäéèêëîïôöùûüç]/i.test(p.etiquette)) {
        problemes.push(
          `Le palier « ${p.etiquette} » de « ${e.id} » semble traduit. Les étiquettes sont ` +
            'citées dans la langue de la source : traduites, elles cesseraient d’être une ' +
            'citation pour devenir un jugement.',
        );
      }
    }

    /*
       Une étiquette qui n'est pas celle de la source doit le dire, parce que
       l'interface annonce « la tranche que le manuel nomme ». Huit tranches
       sur neuf le sont ; la neuvième ne l'était pas, et l'erreur se cachait
       derrière les huit autres.
    */
    const deduits = e.paliers.filter((p) => p.deduit);
    if (deduits.length && !/déduit/i.test(e.origineDesPaliers ?? '')) {
      problemes.push(
        `« ${e.id} » porte ${pluriel(deduits.length, 'étiquette')} ` +
          `${accorde(deduits.length, 'déduite')} — ` +
          `${deduits.map((p) => `« ${p.etiquette} »`).join(', ')} — sans que ` +
          'son origine ne le dise. Une étiquette de Cyclades présentée comme celle du manuel ' +
          'est une attribution fausse à la source.',
      );
    }

    // Les tranches couvrent tout l'intervalle, sans trou ni recouvrement.
    if (e.paliers.length) {
      const tries = [...e.paliers].sort((a, b) => a.de - b.de);
      if (tries[0].de !== 0) problemes.push(`Les paliers de « ${e.id} » ne partent pas de zéro.`);
      if (tries[tries.length - 1].a !== e.maximum) {
        problemes.push(`Les paliers de « ${e.id} » ne vont pas jusqu’à ${e.maximum}.`);
      }
      for (let i = 1; i < tries.length; i += 1) {
        if (tries[i].de !== tries[i - 1].a + 1) {
          problemes.push(`Les paliers de « ${e.id} » laissent un trou ou se recouvrent.`);
        }
      }
    }
  }

  /*
     Et le WHO-5 reste sans palier. Son document n'en donne aucun ; les
     seuils qui circulent viennent d'ailleurs, et les inscrire ici serait
     précisément ce qu'on reproche aux relevés rejetés.
  */
  const w = echelles.find((e) => e.id === 'who5');
  if (w && w.paliers.length) {
    problemes.push(
      'Le WHO-5 porte des paliers. Son document n’en donne aucun : ceux qui circulent viennent ' +
        'd’ailleurs, et les inscrire reviendrait à faire ce qu’on reproche aux relevés rejetés.',
    );
  }
  return problemes;
}
