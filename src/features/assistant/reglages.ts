/**
 * Ce que la fenêtre se rappelle d'une fois sur l'autre.
 *
 * Dans `localStorage` et non dans IndexedDB : ce sont des préférences
 * d'interface, pas de la progression. Elles n'ont pas à être exportées avec le
 * reste, pas à survivre à un changement d'appareil, et une base indisponible ne
 * doit pas empêcher le bouton de fonctionner — d'où les `try` : un navigateur
 * en navigation privée refuse parfois l'écriture, et le module doit alors
 * marcher avec ses valeurs par défaut plutôt que de jeter.
 */
import { OPTIONS_PAR_DEFAUT, type OptionsDeContexte } from './contexte';
import type { Intention } from './prompt';

const CLEF_OPTIONS = 'revinsp.assistant.options';
const CLEF_AVERTISSEMENT = 'revinsp.assistant.avertissement-vu';
const CLEF_INTENTION = 'revinsp.assistant.intention';

export function lireOptions(): OptionsDeContexte {
  try {
    const brut = localStorage.getItem(CLEF_OPTIONS);
    if (!brut) return { ...OPTIONS_PAR_DEFAUT };
    const lu = JSON.parse(brut) as Partial<OptionsDeContexte>;
    return {
      monNiveau: Boolean(lu.monNiveau),
      mesErreurs: Boolean(lu.mesErreurs),
      mesNotes: Boolean(lu.mesNotes),
    };
  } catch {
    return { ...OPTIONS_PAR_DEFAUT };
  }
}

export function ecrireOptions(options: OptionsDeContexte): void {
  try {
    localStorage.setItem(CLEF_OPTIONS, JSON.stringify(options));
  } catch {
    /* Préférence perdue, fonctionnement intact. */
  }
}

export function lireIntention(): Intention {
  try {
    return (localStorage.getItem(CLEF_INTENTION) as Intention) || 'expliquer';
  } catch {
    return 'expliquer';
  }
}

export function ecrireIntention(intention: Intention): void {
  try {
    localStorage.setItem(CLEF_INTENTION, intention);
  } catch {
    /* idem */
  }
}

/**
 * L'avertissement de premier usage a-t-il été vu ?
 *
 * Il dit ce que le bouton fait et ce qu'il ne fait pas : le texte part sur un
 * service tiers dès qu'on le colle, et le site, lui, n'envoie rien. C'est la
 * seule chose qu'il faut avoir lue une fois — après quoi le redemander serait
 * du bruit, d'où la case « ne plus afficher ».
 */
export function avertissementVu(): boolean {
  try {
    return localStorage.getItem(CLEF_AVERTISSEMENT) === 'oui';
  } catch {
    return false;
  }
}

export function marquerAvertissementVu(): void {
  try {
    localStorage.setItem(CLEF_AVERTISSEMENT, 'oui');
  } catch {
    /* L'avertissement se réaffichera : c'est le bon sens de l'échec. */
  }
}
