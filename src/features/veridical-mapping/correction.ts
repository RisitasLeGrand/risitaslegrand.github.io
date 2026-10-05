/**
 * La correction d'un essai de Veridical Mapping.
 *
 * ## Pourquoi elle ne ressemble à aucune autre
 *
 * Les corrections de Relational Reasoning déroulent un raisonnement : des
 * prémisses, une composition, une conclusion. Ici il n'y a **rien à déduire**.
 * La bonne réponse ne se démontre pas, elle se perçoit — et quand on s'est
 * trompé, c'est que l'écart était sous le seuil, non qu'on a mal raisonné.
 *
 * Une correction qui prétendrait expliquer *pourquoi* le bon candidat est le bon
 * serait donc une correction mensongère. Ce qu'elle peut faire, et qui est utile,
 * est de **montrer l'écart** : où se trouvait la référence sur son échelle, où
 * tombait sa correspondance sur l'échelle d'arrivée, où l'on a répondu, et de
 * combien les deux candidats différaient. On apprend ainsi ce que l'escalier est
 * en train de mesurer, en unités qu'on comprend — « 3 pas, soit 1,4 dB » — au
 * lieu de subir une suite de verdicts.
 *
 * ## Deux tâches demandent plus qu'une échelle
 *
 * **`plan`** transporte un couple de valeurs, et le leurre ne se trompe que sur
 * **un** des deux axes. La correction doit donc dire *lequel* : c'est tout ce
 * que l'exercice enseigne, et le taire reviendrait à répéter la question.
 *
 * **`modulaire`** ne porte pas sur une position mais sur un **intervalle**, la
 * dimension d'arrivée rebouclant. Dire « la bonne réponse était à tel pas »
 * serait un contresens : seul l'écart se transporte. La correction compare donc
 * les deux intervalles.
 *
 * Ce module ne contient aucun rendu : il calcule ce qu'il y a à montrer, et
 * l'affichage s'en occupe. C'est ce qui le rend vérifiable sans navigateur.
 */
import { PAS, ecartEnPas, type Dimension } from './dimensions';
import type { Essai, SousEssai, Tache } from './session';

/** Un axe de l'essai, corrigé. */
export interface AxeCorrige {
  de: Dimension;
  vers: Dimension;
  /** Rang de la référence sur la dimension de départ, de 0 à PAS − 1. */
  pasReference: number;
  /** Rang attendu sur la dimension d'arrivée. */
  pasAttendu: number;
  /** Rang répondu, ou `null` si l'essai n'a pas reçu de réponse. */
  pasDonne: number | null;
  /** Écart entre la réponse et l'attendu, en pas. Zéro quand c'est juste. */
  ecart: number;
  juste: boolean;
  /** L'écart mis en mots, dans l'unité de la dimension. */
  mots: string;
}

export interface SousEssaiCorrige {
  tache: Tache;
  axes: AxeCorrige[];
  juste: boolean;
  /**
   * L'écart **entre les deux candidats**, en pas, et mis en mots.
   *
   * C'est la seule grandeur que l'exercice mesure, et elle vaut qu'on ait
   * répondu juste ou faux — contrairement à l'écart entre la réponse et
   * l'attendu, qui est nul dès qu'on a raison. Une première version la
   * confondait avec la largeur d'un pas et affichait « 1 pas » là où l'escalier
   * en annonçait trente-six : un chiffre faux, contredit par l'en-tête de
   * l'essai, sur l'écran même qui prétend expliquer la mesure.
   */
  ecartEntreCandidats: number;
  motsEntreCandidats: string;
  /**
   * Le nom de l'axe sur lequel le leurre se trompait, en tâche « plan ».
   * Absent lorsque les deux axes concordent — c'est-à-dire quand l'essai a été
   * tiré sans second axe.
   */
  axeFautif?: string;
  /** Les deux intervalles comparés, en tâche modulaire. */
  intervalles?: {
    reference: number;
    donne: number | null;
    /** Les deux bouts de l'intervalle de référence, en pas. */
    bornesReference: [number, number];
    /** Les deux bouts de l'intervalle choisi, en pas. */
    bornesChoisies: [number, number] | null;
  };
}

/** Deux chiffres après la virgule au plus, et jamais de zéro inutile. */
function nombre(valeur: number): string {
  const arrondi = Math.abs(valeur) >= 10 ? Math.round(valeur) : Math.round(valeur * 10) / 10;
  return arrondi.toLocaleString('fr-FR');
}

/**
 * L'écart entre deux rangs, dit en pas **et** dans l'unité de la dimension.
 *
 * Les deux ensemble, et pas l'un ou l'autre : le pas est ce que l'escalier
 * manipule, l'unité est ce que l'on perçoit. Une correction qui ne donnerait que
 * les pas parlerait de l'algorithme ; une qui ne donnerait que l'unité
 * empêcherait de rapprocher deux dimensions qui n'ont pas la même.
 */
export function ecartEnMots(dimension: Dimension, a: number, b: number): string {
  const pas = ecartEnPas(dimension, a, b);
  if (pas === 0) return 'aucun écart';
  const valeur = Math.abs(dimension.valeur(a) - dimension.valeur(b));
  return `${pas} pas, soit ${nombre(valeur)} ${dimension.unite}`;
}

/** Le candidat juste, et celui que la personne a désigné. */
function choisis(sousEssai: SousEssai, choix: number | null) {
  const attendu = sousEssai.candidats.find((candidat) => candidat.juste) ?? null;
  const donne = choix === null ? null : (sousEssai.candidats[choix] ?? null);
  return { attendu, donne };
}

/**
 * Corrige chaque sous-essai d'un essai, dans l'ordre où ils sont affichés.
 *
 * `choix` suit la même indexation que `essai.sousEssais` ; une entrée `null`
 * signifie « pas répondu », ce que la correction montre comme tel plutôt que de
 * l'assimiler à une erreur.
 */
export function corrigerEssai(essai: Essai, choix: readonly (number | null)[]): SousEssaiCorrige[] {
  return essai.sousEssais.map((sousEssai, i) => {
    const { attendu, donne } = choisis(sousEssai, choix[i] ?? null);
    const juste = donne?.juste === true;

    const principal: AxeCorrige = {
      de: essai.arete.de,
      vers: essai.arete.vers,
      pasReference: sousEssai.pasReference,
      pasAttendu: attendu?.pas ?? sousEssai.pasReference,
      pasDonne: donne?.pas ?? null,
      ecart: donne ? ecartEnPas(essai.arete.vers, donne.pas, attendu?.pas ?? donne.pas) : 0,
      juste: donne ? donne.pas === attendu?.pas : false,
      mots: donne
        ? ecartEnMots(essai.arete.vers, donne.pas, attendu?.pas ?? donne.pas)
        : 'aucune réponse',
    };

    const axes = [principal];

    /*
     * Le second axe de la tâche « plan ».
     *
     * Il n'est corrigé que si les deux candidats portent leur rang secondaire :
     * sans lui, on ne saurait pas dire lequel des deux axes était fautif, et
     * l'affirmer au hasard serait pire que se taire.
     */
    let axeFautif: string | undefined;
    if (essai.tache === 'plan' && essai.secondaireDimensions && attendu?.pasSecondaire !== undefined) {
      const { de, vers } = essai.secondaireDimensions;
      const attenduSecond = attendu.pasSecondaire;
      const donneSecond = donne?.pasSecondaire ?? null;
      axes.push({
        de,
        vers,
        pasReference: sousEssai.pasReferenceSecondaire ?? attenduSecond,
        pasAttendu: attenduSecond,
        pasDonne: donneSecond,
        ecart: donneSecond === null ? 0 : ecartEnPas(vers, donneSecond, attenduSecond),
        juste: donneSecond === attenduSecond,
        mots:
          donneSecond === null
            ? 'aucune réponse'
            : ecartEnMots(vers, donneSecond, attenduSecond),
      });
      // Le leurre ne se trompe que sur **un** axe, par construction du tirage :
      // c'est donc celui dont le rang diffère, et il n'y en a qu'un.
      if (!juste && donne) {
        axeFautif = donne.pas !== attendu.pas ? essai.arete.vers.nom : vers.nom;
      }
    }

    // L'écart entre les deux candidats se lit sur les candidats eux-mêmes, et
    // non sur `essai.delta` : en tâche « plan » le leurre ne diffère que sur un
    // axe, et le delta nominal ne dirait pas lequel.
    const autre = sousEssai.candidats.find((candidat) => !candidat.juste) ?? null;
    const second = essai.secondaireDimensions?.vers;
    const dimensionMesuree =
      essai.tache === 'plan' && second && axeFautif === second.nom ? second : essai.arete.vers;
    const rangJuste =
      dimensionMesuree === essai.arete.vers ? (attendu?.pas ?? 0) : (attendu?.pasSecondaire ?? 0);
    const rangAutre =
      dimensionMesuree === essai.arete.vers ? (autre?.pas ?? 0) : (autre?.pasSecondaire ?? 0);

    const corrige: SousEssaiCorrige = {
      tache: essai.tache,
      axes,
      juste,
      axeFautif,
      ecartEntreCandidats: autre ? ecartEnPas(dimensionMesuree, rangJuste, rangAutre) : 0,
      motsEntreCandidats: autre
        ? ecartEnMots(dimensionMesuree, rangJuste, rangAutre)
        : 'aucun second candidat',
    };

    if (essai.tache === 'modulaire' && sousEssai.pasReference2 !== undefined) {
      const reference = ecartEnPas(essai.arete.de, sousEssai.pasReference, sousEssai.pasReference2);
      corrige.intervalles = {
        reference,
        donne:
          donne && donne.ancre !== undefined
            ? ecartEnPas(essai.arete.vers, donne.ancre, donne.pas)
            : null,
        bornesReference: [sousEssai.pasReference, sousEssai.pasReference2],
        bornesChoisies:
          donne && donne.ancre !== undefined ? [donne.ancre, donne.pas] : null,
      };
    }

    return corrige;
  });
}

/**
 * La position d'un rang sur son échelle, de 0 à 1, pour les schémas.
 *
 * Fonction d'une ligne, mais nommée : les schémas en ont tous besoin, et la
 * recopier aurait fini par donner deux conventions de bornes.
 */
export const positionSurEchelle = (pas: number): number => pas / (PAS - 1);

/**
 * Ce que la correction a le droit d'affirmer sur un essai raté.
 *
 * Une phrase, et une seule, parce qu'il n'y en a pas davantage à dire sans
 * mentir : l'écart était celui-ci, et c'est ce que la perception doit
 * distinguer à ce niveau. Aucune explication de la bonne réponse — elle ne
 * s'explique pas.
 */
export function phraseDEcart(corrige: SousEssaiCorrige): string {
  const principal = corrige.axes[0];
  if (corrige.juste) {
    return (
      `Juste. Les deux candidats différaient de ${corrige.motsEntreCandidats} : c’est l’écart ` +
      'que vous venez de distinguer, et l’escalier va le resserrer.'
    );
  }
  if (principal.pasDonne === null) {
    return 'Aucune réponse n’a été donnée sur ce sous-essai.';
  }
  if (corrige.tache === 'modulaire' && corrige.intervalles) {
    const { reference, donne } = corrige.intervalles;
    return (
      `L’intervalle à reproduire valait ${reference} pas ; celui que vous avez choisi en vaut ` +
      `${donne ?? '?'}. Sur une dimension qui reboucle, c’est l’écart qui se transporte, jamais ` +
      'la position : les deux couples peuvent être n’importe où sur le cercle.'
    );
  }
  if (corrige.axeFautif) {
    return (
      `Le leurre ne se trompait que sur un axe, « ${corrige.axeFautif} », de ` +
      `${corrige.motsEntreCandidats}. C’est tout l’exercice : il faut tenir les deux axes, ` +
      'puisqu’on ne sait pas lequel sera fautif.'
    );
  }
  return (
    `L’écart entre les deux candidats était de ${corrige.motsEntreCandidats}. C’est ce que ` +
    'votre perception doit distinguer à ce niveau — l’escalier l’élargira après cette erreur.'
  );
}
