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

/** Matières de cours dont toutes les questions de « ## Quiz » sont corrigées. */
export const MATIERES_MIGREES = [];

/** Rubriques de « QCM - DGFiP » dont toutes les questions sont corrigées. */
export const RUBRIQUES_MIGREES = [];

export const estMatiereMigree = (matiere) => MATIERES_MIGREES.includes(matiere);
export const estRubriqueMigree = (rubrique) => RUBRIQUES_MIGREES.includes(rubrique);
