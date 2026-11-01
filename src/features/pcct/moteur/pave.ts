/**
 * Le pavé : quelles réponses sont possibles, et dans quel ordre on les montre.
 *
 * ## Deux défauts de la référence, et ils ont la même cause
 *
 * Sa grille est bâtie sur une plage devinée, et non sur l'ensemble des résultats
 * que l'opération peut produire. D'où :
 *
 *   - elle n'offre ni ZÉRO ni les NÉGATIFS, alors qu'une différence en produit
 *     dès que le courant dépasse la référence. Une réponse juste est alors
 *     intapable au doigt ;
 *   - elle est mélangée UNE FOIS par séance, quand son réglage promet « à chaque
 *     essai ». La position de chaque chiffre devient donc apprise au bout de
 *     trois essais, et le mélange ne mélange plus rien.
 *
 * Les deux se corrigent en calculant l'ensemble depuis l'opération et la plage,
 * puis en le mélangeant à chaque essai à partir d'une graine. Le mélange est
 * déterministe pour pouvoir être éprouvé : un mélange qu'on ne peut pas rejouer
 * ne se mesure pas.
 */
import type { Operation } from './types';
import { diviseursAdmissibles } from './tirage';

/**
 * Toutes les réponses que l'opération peut produire sur la plage, triées.
 *
 * Calculé par ÉNUMÉRATION et non par bornes : les bornes d'un produit ou d'un
 * quotient ne décrivent pas un ensemble continu — sur 1 à 9, les quotients
 * possibles sont 1, 2, 3, 4, 5, 6, 7, 8 et 9, mais jamais 11 ni 13, et un pavé
 * qui offrirait tout l'intervalle proposerait des réponses impossibles.
 *
 * La plage est bornée à ce qui tient sur un pavé : au-delà, l'exercice se joue
 * au clavier. Un pavé de deux cents touches n'est pas une aide.
 */
export function reponsesPossibles(
  operation: Operation,
  min: number,
  max: number,
  plafond = 60,
): number[] {
  const vues = new Set<number>();
  for (let reference = min; reference <= max; reference += 1) {
    for (let courant = min; courant <= max; courant += 1) {
      switch (operation) {
        case 'somme':
          vues.add(courant + reference);
          break;
        case 'difference':
          vues.add(reference - courant);
          break;
        case 'produit':
          vues.add(courant * reference);
          break;
        case 'quotient':
          /* Seuls les diviseurs produisent un résultat entier, et le tirage ne
             propose que ceux-là : offrir les autres quotients serait offrir des
             réponses que l'exercice ne demande jamais. */
          for (const d of diviseursAdmissibles(reference, min, max)) {
            if (d !== 0) vues.add(reference / d);
          }
          break;
      }
    }
  }
  const triees = [...vues].sort((a, b) => a - b);
  return triees.length <= plafond ? triees : [];
}

/**
 * Mélange une liste, de façon déterministe à partir d'une graine.
 *
 * Fisher-Yates, du dernier au premier. Le générateur est écrit ici plutôt que
 * reçu : ce qu'on veut est qu'une même graine rende un même ordre, et qu'un
 * essai puisse donc comparer deux mélanges sans dépendre d'un réglage du hasard
 * ailleurs.
 */
export function melanger<T>(liste: readonly T[], graine: number): T[] {
  const sortie = [...liste];
  let etat = (graine >>> 0) || 1;
  const prochain = () => {
    /* xorshift32 : court, sans dépendance, et suffisant pour brouiller une
       position. On ne cherche pas une qualité cryptographique mais un ordre
       qu'on ne retient pas d'un essai à l'autre. */
    etat ^= etat << 13;
    etat ^= etat >>> 17;
    etat ^= etat << 5;
    return (etat >>> 0) / 4294967296;
  };
  for (let i = sortie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(prochain() * (i + 1));
    [sortie[i], sortie[j]] = [sortie[j], sortie[i]];
  }
  return sortie;
}

/**
 * L'ordre d'affichage du pavé pour un essai donné.
 *
 * `ordre` vient des réglages : croissant, décroissant, ou mélangé À CHAQUE
 * ESSAI — d'où le rang de l'essai dans la graine, qui est tout ce qui manquait à
 * la référence pour tenir sa promesse.
 */
export function paveDeLEssai(
  reponses: readonly number[],
  ordre: 'croissant' | 'decroissant' | 'melange',
  rangDeLEssai: number,
): number[] {
  if (ordre === 'croissant') return [...reponses];
  if (ordre === 'decroissant') return [...reponses].reverse();
  return melanger(reponses, rangDeLEssai * 2654435761);
}
