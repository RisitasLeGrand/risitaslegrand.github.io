/**
 * « Afficher la série et l'XP » — prompt 43, F3 et F4 du lot F, point F2.
 *
 * ## Pourquoi un réglage, et pourquoi allumé
 *
 * La série et l'XP aident certaines personnes et en pressent d'autres. Les
 * retirer à tout le monde prendrait quelque chose à qui s'en sert ; les
 * imposer laisse un score sous les yeux de qui n'en veut pas. Le réglage est
 * donc **allumé par défaut** : il ne retire rien, il ouvre une porte.
 *
 * ## Ce qu'il masque, et ce qu'il ne masque pas
 *
 * Il masque **tout chiffre d'XP et tout compte de série** : les deux cartes du
 * tableau de bord, les « +N XP » qui suivent une session, les lignes de
 * récapitulatif.
 *
 * Il NE masque PAS la régularité — la grille des huit semaines dit ce qu'on a
 * travaillé, pas ce qu'on a marqué —, ni l'écran qui sert à REPRENDRE le
 * calcul de l'XP : cacher un outil de réparation ne répare rien, et laisserait
 * une personne devant un total faux sans moyen de le corriger.
 *
 * ## Où la valeur vit
 *
 * Dans `localStorage`, comme les autres réglages d'affichage : c'est une
 * préférence d'écran, elle n'a pas à suivre les appareils, et elle doit être
 * lisible **avant** le premier rendu — une carte qui paraît puis disparaît
 * est pire que pas de réglage du tout.
 *
 * L'absence vaut « affichées ». C'est ce qui rend le défaut vrai sans écrire
 * quoi que ce soit chez qui n'y touche jamais.
 */

export const CLE_SERIE_XP = 'revinsp.serie-xp';

/** La série et l'XP sont-elles affichées ? Par défaut : oui. */
export function serieEtXpAffichees(): boolean {
  try {
    return localStorage.getItem(CLE_SERIE_XP) !== 'masquees';
  } catch {
    /* Navigation privée, stockage refusé : on affiche, comme par défaut. */
    return true;
  }
}

export function reglerSerieEtXp(affichees: boolean): void {
  try {
    localStorage.setItem(CLE_SERIE_XP, affichees ? 'affichees' : 'masquees');
  } catch {
    /* Le réglage ne vaudra que pour cette page. */
  }
}
