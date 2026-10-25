/**
 * Le sexe déclaré : la forme de la réponse, et ce qu'elle ouvre.
 *
 *   npm run essais:sexe
 *
 * ## Pourquoi ce champ existe
 *
 * Décision d'Alexis du 19 octobre : « Le cycle menstruel ne doit s'afficher que
 * pour les utilisateurs féminins. » Elle remplace, pour ce point, le
 * comportement que le prompt 30 et le registre des usages prévoyaient — où le
 * module restait accessible sous un libellé neutre. L'écart est consigné dans
 * `docs/cyclades/decisions-en-attente-cycle-2026-10-19.md`.
 *
 * Décider cela demande de **savoir**, donc d'enregistrer la réponse. Avant
 * cette décision, `sexe` n'était stocké nulle part : `etat-personne.ts` rendait
 * `null` avec la raison écrite, et `profil.question-cycle` ne pouvait donc
 * jamais être actif.
 *
 * ## Quatre états, et pas trois
 *
 * Alexis demande trois réponses — « Féminin », « Masculin », « Je préfère ne
 * pas répondre ». Il y a pourtant **quatre** états, parce que l'absence
 * d'enregistrement n'est pas une réponse :
 *
 * | état                 | ce que cela veut dire                               |
 * |----------------------|-----------------------------------------------------|
 * | aucun enregistrement | la question n'a pas été posée, ou pas encore vue    |
 * | `'sans-reponse'`     | la question a été vue, et la personne a refusé      |
 * | `'feminin'`          | répondu                                              |
 * | `'masculin'`         | répondu                                              |
 *
 * Confondre les deux premiers coûterait quelque chose de précis : la question
 * se reposerait à chaque visite à quelqu'un qui a déjà dit non. Un refus est
 * une réponse ; il mérite d'être gardé.
 *
 * Pour ce que la décision commande, les deux se comportent pareil — rien n'est
 * montré —, et c'est pour cela que `leSuiviEstVisible` ne les distingue pas.
 * L'écran de la question, lui, les distingue.
 *
 * ## Ce que cette liste n'a pas, et qu'il faut dire
 *
 * `SexePhysio` (`noyau/registre-usages.ts`) connaît `intersexe_ou_autre`. Les
 * trois réponses d'Alexis ne l'offrent pas. Une personne dans ce cas répondra
 * donc « Je préfère ne pas répondre », et le suivi lui sera masqué. Je
 * n'invente pas une quatrième réponse qu'Alexis n'a pas demandée, et je ne
 * retire pas `intersexe_ou_autre` de `SexePhysio`, que d'autres modules
 * utilisent pour leurs populations. La conséquence est inscrite aux décisions
 * en attente : c'est à Alexis de la lever ou de la garder.
 */
import type { Contexte, SexePhysio } from '../noyau/registre-usages';

/** La réponse enregistrée. L'absence d'enregistrement est un cinquième cas. */
export type SexeDeclare = 'feminin' | 'masculin' | 'sans-reponse';

export const SEXES_DECLARABLES: readonly SexeDeclare[] = ['feminin', 'masculin', 'sans-reponse'];

/**
 * Les libellés, mot pour mot ceux d'Alexis.
 *
 * Pas de « (e) » ni de « (s) » à ajuster : ce sont des adjectifs substantivés,
 * et la forme écrite ici est celle qui s'affiche.
 */
export const LIBELLES_DU_SEXE: Record<SexeDeclare, string> = {
  feminin: 'Féminin',
  masculin: 'Masculin',
  'sans-reponse': 'Je préfère ne pas répondre',
};

/** L'identifiant de l'enregistrement unique. Une personne, une réponse. */
export const ID_DU_SEXE = 'sexe-declare';

export interface SexeEnregistre {
  id: typeof ID_DU_SEXE;
  reponse: SexeDeclare;
  majLe: string;
}

export function controlerLeSexe(s: SexeEnregistre): string[] {
  const problemes: string[] = [];
  if (s.id !== ID_DU_SEXE) problemes.push(`Identifiant inattendu : « ${s.id} ».`);
  if (!SEXES_DECLARABLES.includes(s.reponse)) {
    problemes.push(`Réponse inconnue : « ${s.reponse} ».`);
  }
  return problemes;
}

/**
 * La réponse, traduite pour le registre des usages.
 *
 * `'sans-reponse'` devient `null`, c'est-à-dire « personne ne sait » — ce qui
 * est la vérité du point de vue d'un module qui lirait `sexe_physio`. Le refus
 * lui-même reste dans le magasin, pour que la question ne se repose pas ; il
 * n'a pas à voyager jusqu'aux consommateurs, qui n'en feraient rien.
 */
export function versSexePhysio(reponse: SexeDeclare | null): SexePhysio | null {
  if (reponse === 'feminin') return 'femme';
  if (reponse === 'masculin') return 'homme';
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   La restriction, en une fonction pure
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le suivi est-il visible ?
 *
 * **Une seule fonction, et tous les écrans l'appellent.** C'est délibéré : la
 * décision d'Alexis porte sur quatre surfaces aujourd'hui — la ligne de
 * l'écran Corps, l'écran du suivi, les signes d'alerte, la navigation — et sur
 * « tout accès futur ». Quatre conditions recopiées à quatre endroits donnent
 * trois endroits justes et un oublié, et l'oubli est celui qui montre.
 *
 * ## Elle reçoit un `Contexte`, et non la réponse enregistrée
 *
 * C'est le point d'architecture de cette restriction, et j'ai commencé par
 * l'écrire autrement. Le `Contexte` est ce que la porte du registre des usages
 * a bien voulu rendre à un consommateur nommé — ici `profil.question-cycle`,
 * dont c'est exactement l'objet déclaré. Trois conséquences, toutes voulues :
 *
 * - l'usage est **réellement exercé**, donc l'écran « Qui utilise mon âge et
 *   mon sexe » dit vrai quand il annonce que cet usage lit `sexe_physio` ;
 * - une personne qui **coupe** cet usage reçoit `{}`, donc le suivi disparaît.
 *   Couper l'usage qui restreint ne débloque pas : il masque. C'est le bon
 *   sens de l'erreur ;
 * - lire le magasin en direct depuis un écran aurait contourné la porte, ce
 *   que l'essai sur le graphe d'imports interdit par ailleurs.
 *
 * ## Liste blanche, et non liste noire
 *
 * **Seul** `'femme'` ouvre. Un état nouveau — une réponse ajoutée demain, une
 * lecture qui échoue, un usage coupé, un champ illisible — tombe donc du côté
 * fermé sans que personne ait à y penser. L'inverse
 * (`sexe_physio !== 'homme'`) aurait montré le suivi à tout ce qui n'est pas
 * exactement masculin, erreurs comprises.
 *
 * `coffreEstOuvert` est explicite, et redondant en apparence : coffre fermé,
 * `etatDeLaPersonne()` rend déjà `sexe: null`, donc `'inconnu'`. Il reste
 * écrit parce que c'est le point 2 de la décision — « ou coffre fermé (on ne
 * peut pas savoir) » — et qu'une garantie qui ne tient que par un détour chez
 * un autre module se perd au premier remaniement de ce module-là.
 */
export function leSuiviEstVisible(contexte: Contexte, coffreEstOuvert: boolean): boolean {
  if (!coffreEstOuvert) return false;
  return contexte.sexe_physio === 'femme';
}

/**
 * Pourquoi ce n'est pas visible, pour les essais et les journaux — **jamais
 * pour l'écran**.
 *
 * Une personne à qui le suivi est masqué ne doit pas lire « masqué parce que
 * vous avez répondu masculin » : ce serait dire qu'il existe quelque chose à
 * masquer. C'est la décision 11, qu'Alexis ne lève pas — « aucun libellé
 * neutre de repli » veut dire *rien*, pas *une explication neutre*.
 *
 * Cette fonction existe pour qu'un essai puisse distinguer les fermetures, et
 * pour qu'un relecteur voie qu'elles sont toutes prévues.
 */
export type RaisonDeMasquer = 'coffre-ferme' | 'usage-coupe' | 'pas-feminin' | 'inconnu';

export function raisonDeMasquer(contexte: Contexte, coffreEstOuvert: boolean): RaisonDeMasquer | null {
  if (!coffreEstOuvert) return 'coffre-ferme';
  if (contexte.sexe_physio === 'femme') return null;
  if (contexte.sexe_physio === undefined) return 'usage-coupe';
  if (contexte.sexe_physio === 'inconnu') return 'inconnu';
  return 'pas-feminin';
}
