/**
 * Le suivi est-il visible, ici et maintenant ? Une seule réponse, un seul lieu.
 *
 * `leSuiviEstVisible` (`odyssee/sexe.ts`) est la **règle** : elle est pure, et
 * un essai la mesure en table de vérité. Ce module-ci est son **branchement** :
 * il va chercher les trois choses dont la règle a besoin — l'état du coffre,
 * l'état de la personne, les usages coupés — et les lui passe.
 *
 * Les deux sont séparés parce qu'ils se cassent différemment. La règle se
 * casse en logique, et un essai pur la garde. Le branchement se casse en
 * oubli : un écran qui lirait le sexe sans passer par la porte du registre, ou
 * qui oublierait les coupures, aurait l'air juste et montrerait le suivi à qui
 * ne doit pas le voir. C'est pourquoi il n'y en a qu'un, et que les écrans
 * n'ont pas le droit de le refaire chez eux.
 *
 * ## Pourquoi cela passe par `contextePersonne`
 *
 * La décision est un **usage déclaré** du sexe : `profil.question-cycle`, dont
 * le registre dit maintenant « Restreindre le suivi du cycle au sexe féminin
 * déclaré ». Passer par la porte a trois effets voulus, détaillés dans
 * l'en-tête de `leSuiviEstVisible` : l'écran « Qui utilise mon âge et mon
 * sexe » dit vrai, couper l'usage **masque** au lieu de débloquer, et aucun
 * écran ne contourne la porte.
 */
import { coffreOuvert } from '../coffre';
import { champ } from '../profil';
import { etatDeLaPersonne } from '../etat-personne';
import { contextePersonne } from '../noyau/registre-usages';
import { jourLogique } from '../noyau/jour-logique';
import { leSuiviEstVisible } from './sexe';

const USAGE = 'profil.question-cycle';
const USAGE_DES_STATISTIQUES = 'suivi.statistiques-majeur';

/** Les usages que la personne a coupés, ou aucun si la liste est illisible. */
async function usagesCoupes(): Promise<string[]> {
  try {
    const enregistre = await champ('usagesCoupes');
    return Array.isArray(enregistre?.valeur) ? (enregistre.valeur as string[]) : [];
  } catch {
    /*
       Une liste illisible rend `[]`, donc « rien n'est coupé », donc la règle
       décide sur le seul sexe. C'est le bon sens de l'erreur ici : traiter
       l'illisible comme « tout est coupé » masquerait le suivi à quelqu'un qui
       n'a rien coupé, sans qu'il puisse le comprendre ni le défaire.
    */
    return [];
  }
}

/**
 * Vrai seulement si le suivi doit être montré à cette personne, maintenant.
 *
 * Ne lève jamais : toute erreur rend `false`. Un échec n'est pas une
 * autorisation, et c'est le seul défaut de repli acceptable pour une
 * restriction.
 */
export async function leSuiviEstVisibleMaintenant(): Promise<boolean> {
  if (!coffreOuvert()) return false;
  try {
    const [etat, coupes] = await Promise.all([etatDeLaPersonne(), usagesCoupes()]);
    const contexte = contextePersonne(USAGE, etat, jourLogique(new Date()), coupes);
    return leSuiviEstVisible(contexte, coffreOuvert());
  } catch {
    return false;
  }
}

/**
 * Les statistiques du suivi sont-elles ouvertes ? **Journal seul sous 18 ans.**
 *
 * 4.1 du prompt 30, décision 5 : sous 18 ans, « mode journal seul : saisie des
 * règles et des symptômes, sans statistiques de cycle, sans comparaison à un
 * repère, sans estimation, sans signal d'orientation, mais avec les symptômes
 * d'urgence ». Saisir reste possible ; calculer ne l'est pas.
 *
 * ## Deux portes, et il faut passer les deux
 *
 * Le suivi doit d'abord être visible — sinon la question ne se pose pas — et
 * la personne doit être majeure. Les deux conditions passent par la porte du
 * registre, chacune sous son usage déclaré :
 * `profil.question-cycle` pour la visibilité, `suivi.statistiques-majeur`
 * pour les statistiques. Deux usages et non un, parce que ce ne sont pas les
 * mêmes données lues ni les mêmes raisons, et que l'écran « Qui utilise mon
 * âge et mon sexe » doit pouvoir les montrer séparément — et les couper
 * séparément.
 *
 * `'oui'` et rien d'autre ouvre : `'non'`, `'inconnu'`, un usage coupé et
 * toute erreur ferment. L'âge inconnu ferme comme un âge sous 18 ans, parce
 * qu'un défaut ouvert donnerait les statistiques à qui n'a rien déclaré.
 */
export async function lesStatistiquesSontOuvertes(): Promise<boolean> {
  if (!(await leSuiviEstVisibleMaintenant())) return false;
  try {
    const [etat, coupes] = await Promise.all([etatDeLaPersonne(), usagesCoupes()]);
    const contexte = contextePersonne(
      USAGE_DES_STATISTIQUES,
      etat,
      jourLogique(new Date()),
      coupes,
    );
    return contexte.majeur === 'oui';
  } catch {
    return false;
  }
}
