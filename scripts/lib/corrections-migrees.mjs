/**
 * Les périmètres dont la correction détaillée est terminée.
 *
 * Pourquoi un drapeau, et non l'obligation d'un coup : la banque compte près de
 * cinq mille questions. Rendre le bloc « correction » obligatoire partout
 * aujourd'hui casserait le build jusqu'à ce que la dernière soit rédigée, et
 * bloquerait tout le reste du site entre-temps.
 *
 * Le drapeau n'est pas pour autant un contournement, et il faut dire pourquoi :
 *
 *  - une **correction malformée** est refusée partout, migrée ou non — un bloc
 *    incohérent est un bug, pas un retard ;
 *  - une **correction absente** n'est refusée que dans un périmètre migré ;
 *  - la liste ne fait que **croître**, et elle disparaît quand la banque est
 *    complète. Retirer une matière de cette liste serait une régression, pas
 *    un réglage.
 *
 * Le rattrapage se fait par lots, et chaque lot inscrit ici le périmètre qu'il
 * vient de terminer.
 */

/**
 * Matières de cours dont toutes les questions de « ## Quiz » sont corrigées.
 *
 * `cas-pratique` y entre le 13 octobre 2026 (D-019). Les deux listes étaient
 * **vides depuis leur création** : la règle stricte ne s'appliquait nulle
 * part, et le garde-fou n'avait jamais pris effet — un contrôle qui ne
 * contrôle rien finit par rassurer, ce qui est pire que son absence.
 *
 * Mesure faite avant d'inscrire : 158 questions de cas pratique, **158
 * corrigées**. Le build ne casse donc pas aujourd'hui, et il cassera le jour
 * où une question de ce périmètre arrivera sans sa correction. C'est
 * exactement le but.
 */
export const MATIERES_MIGREES = ['cas-pratique'];

/** Rubriques de « QCM - DGFiP » dont toutes les questions sont corrigées. */
export const RUBRIQUES_MIGREES = [];

export const estMatiereMigree = (matiere) => MATIERES_MIGREES.includes(matiere);
export const estRubriqueMigree = (rubrique) => RUBRIQUES_MIGREES.includes(rubrique);
