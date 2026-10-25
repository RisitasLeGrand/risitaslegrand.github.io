/**
 * Lire et écrire le sexe déclaré, sous coffre.
 *
 * Comme `donnees-cycle.ts`, et pour les mêmes raisons : chaque fonction appelle
 * `exigerLeCoffre()`, donc **aucune ne rend rien coffre fermé**. Et comme lui,
 * ce module **ne journalise pas** : `journaliserEnregistrement`
 * (`sync/faits-domaine.ts`) écrit au journal d'opérations, que la
 * synchronisation transporte. Le sexe déclaré n'a pas à voyager, et le
 * journaliser le ferait voyager sans qu'aucun nom de magasin apparaisse dans
 * `sync/` — c'est la cinquième porte de `PORTES_GARDEES`, celle qui ne se voit
 * qu'en lisant l'écrivain.
 *
 * ## Pourquoi lire lève plutôt que de rendre `null`
 *
 * Coffre fermé, on ne sait pas, et `leSuiviEstVisible` traite « on ne sait
 * pas » comme « on ne montre rien » (décision d'Alexis, point 2). Rendre
 * `null` ici serait pourtant tentant et faux : `null` veut dire « aucune
 * réponse enregistrée », état dans lequel l'écran Corps **pose la question**.
 * Un `null` rendu coffre fermé ferait donc poser la question à quelqu'un qui y
 * a déjà répondu, et sa réponse serait réécrite par-dessus l'ancienne.
 *
 * L'écran de la question appelle donc `reponseAAfficher()` plus bas, qui dit
 * lequel des deux cas on est dans, sans lever.
 */
import { db } from '../db';
import { coffreOuvert, exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import { controlerLeSexe, ID_DU_SEXE, type SexeDeclare, type SexeEnregistre } from './sexe';

/**
 * La réponse enregistrée, ou `null` si la question n'a jamais été répondue.
 *
 * Lève coffre fermé. Voir l'en-tête : c'est volontaire, et
 * `reponseAAfficher` est là pour les appelants qui ne peuvent pas lever.
 */
export async function lireLeSexe(): Promise<SexeDeclare | null> {
  const cle = exigerLeCoffre();
  const rangee = (await (await db()).get('odysseeSexe', ID_DU_SEXE)) as
    | Record<string, unknown>
    | undefined;
  if (!rangee) return null;
  const ouvert = await ouvrir<SexeEnregistre>(cle, rangee);
  return ouvert.reponse;
}

export async function ecrireLeSexe(reponse: SexeDeclare): Promise<void> {
  const cle = exigerLeCoffre();
  const enregistrement: SexeEnregistre = {
    id: ID_DU_SEXE,
    reponse,
    majLe: new Date().toISOString(),
  };
  const problemes = controlerLeSexe(enregistrement);
  if (problemes.length) throw new Error(problemes.join(' '));
  const scelle = await sceller(
    cle,
    'odysseeSexe',
    enregistrement as unknown as Record<string, unknown>,
  );
  await (await db()).put('odysseeSexe', scelle as unknown as SexeEnregistre);
}

/**
 * Efface la réponse. La question se reposera.
 *
 * **N'efface rien du suivi**, et c'est le point 5 de la décision d'Alexis :
 * « Si une personne passe de "Féminin" à une autre réponse, les données du
 * cycle déjà saisies ne sont ni effacées ni montrées. Le suivi est seulement
 * masqué. » Effacer sa réponse n'est pas plus un ordre d'effacer ses saisies
 * que de les montrer : toute suppression reste un geste explicite, par
 * l'effacement par période de l'écran du suivi ou par le groupe Odyssée.
 */
export async function effacerLeSexe(): Promise<void> {
  exigerLeCoffre();
  await (await db()).delete('odysseeSexe', ID_DU_SEXE);
}

/**
 * La réponse telle que l'ÉCRAN DE LA QUESTION en a besoin, sans jamais lever.
 *
 * Trois états rendus, et les trois comptent pour cet écran-là :
 * `'pas-de-coffre'` (on ne peut pas savoir, donc on ne demande pas), `null`
 * (la question n'a jamais été répondue, donc on la pose) et la réponse (donc
 * on la montre, modifiable).
 *
 * **Ce n'est pas la fonction qui décide de la visibilité du suivi.** Celle-là
 * est `leSuiviEstVisible` (`odyssee/sexe.ts`), et elle reçoit un `Contexte` de
 * la porte du registre des usages, pas une lecture directe de ce magasin —
 * voir son en-tête. Ici, on est dans le module qui POSSÈDE la donnée, et lire
 * sa propre donnée n'est pas contourner une porte.
 *
 * Une lecture qui échoue rend `'pas-de-coffre'` : du côté fermé. Un échec
 * n'est pas une autorisation.
 */
export async function reponseAAfficher(): Promise<SexeDeclare | null | 'pas-de-coffre'> {
  if (!coffreOuvert()) return 'pas-de-coffre';
  try {
    return await lireLeSexe();
  } catch {
    return 'pas-de-coffre';
  }
}
