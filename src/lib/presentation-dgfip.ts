/**
 * La présentation par défaut de l'épreuve DGFiP, et où elle vit.
 *
 * ## Pourquoi l'appareil, et pas le coffre
 *
 * « Copie de concours » ou « une question à la fois » n'apprend rien sur la
 * personne : c'est une préférence d'affichage, du même ordre que le thème ou
 * le réglage d'animations. La mettre dans un magasin synchronisé l'aurait
 * fait voyager dans la sauvegarde et dans l'export pour une IA, pour un
 * bénéfice nul — et elle n'aurait rien à y faire.
 *
 * Elle vit donc dans le stockage local de l'appareil, comme le thème de
 * séance. La perdre ne coûte rien : on retombe sur le défaut.
 *
 * ## Le défaut est la copie
 *
 * Décision 1 du prompt 49, et demande d'Alexis. Quelqu'un qui prépare le
 * concours a plus besoin de s'entraîner dans ses conditions que de confort,
 * et l'ancienne présentation reste à un geste.
 */
export type PresentationDgfip = 'copie' | 'une-a-la-fois';

export const PRESENTATION_PAR_DEFAUT: PresentationDgfip = 'copie';

const CLEF = 'cyclades.dgfip.presentation';

const valide = (valeur: unknown): valeur is PresentationDgfip =>
  valeur === 'copie' || valeur === 'une-a-la-fois';

/**
 * La présentation réglée, ou le défaut.
 *
 * Toute lecture est protégée : `localStorage` lève en navigation privée sur
 * certains navigateurs, et une préférence d'affichage qui empêche l'écran de
 * s'ouvrir serait un mauvais marché.
 */
export function presentationReglee(): PresentationDgfip {
  try {
    if (typeof localStorage === 'undefined') return PRESENTATION_PAR_DEFAUT;
    const brut = localStorage.getItem(CLEF);
    return valide(brut) ? brut : PRESENTATION_PAR_DEFAUT;
  } catch {
    return PRESENTATION_PAR_DEFAUT;
  }
}

export function reglerLaPresentation(presentation: PresentationDgfip): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CLEF, presentation);
  } catch {
    /* Muet : au pire le défaut revient à la prochaine ouverture. */
  }
}
