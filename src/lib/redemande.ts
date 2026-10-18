/**
 * Redemander le mot de passe avant un geste qu'on ne rattrape pas.
 *
 * ## Le défaut visé
 *
 * Deux gestes du site sont sans retour, et ni l'un ni l'autre ne demandait
 * autre chose qu'un clic de confirmation :
 *
 * - **l'effacement total du profil**, qui supprime tous les champs sur cet
 *   appareil et sur les autres à la prochaine synchronisation ;
 * - **l'export en clair**, qui écrit sur le disque, sans chiffrement et sans
 *   mot de passe, ce que le reste du site passe son temps à chiffrer.
 *
 * Un `window.confirm` protège de la maladresse — du clic à côté — et de rien
 * d'autre. Il ne protège pas du cas qui compte : un ordinateur déverrouillé
 * prêté deux minutes, avec le site déjà ouvert. C'est le même cas que vise la
 * décision 3 pour le coffre, et pour la même raison : c'est le plus probable.
 *
 * ## Pourquoi le mot de passe du SITE, et pas celui du coffre
 *
 * Parce qu'il est le seul des deux dont la vérification existe pour tout le
 * monde et à tout moment. Le mot de passe du coffre n'existe qu'après la
 * bascule, et il ne couvre que les magasins scellés, alors que ces deux
 * gestes touchent tout. Le mot de passe du site, lui, se vérifie en ouvrant
 * le **témoin chiffré publié avec le contenu** : une vraie déchiffration, pas
 * une comparaison d'empreinte — celle-là a quitté le dépôt au point 1 du
 * prompt 44, et c'est tant mieux.
 *
 * ## Ce que cette redemande ne fait pas
 *
 * Elle ne protège pas contre quelqu'un qui exécute du code dans la page : il
 * appellerait la fonction effacée directement. Elle protège contre une main
 * qui passe, et c'est exactement ce qu'elle prétend faire.
 */
import { cleValide, deriverCle } from './crypto';
import { chargerParametresCle } from './contenu';

export interface Redemande {
  /** Le titre du dialogue. Court, et il nomme le geste. */
  titre: string;
  /** Ce qui va se produire, dit au futur et sans adoucir. */
  consequence: string;
  /** Le libellé du bouton qui exécute. */
  action: string;
  /** Rouge pour ce qui détruit, indigo pour ce qui sort des données. */
  ton?: 'destructeur' | 'sortie';
}

/**
 * Pose la question, et ne rend `true` que si le mot de passe est juste.
 *
 * Le dialogue est un `<dialog>` natif ouvert par `showModal` : la capture du
 * focus et la fermeture par Échap viennent du navigateur, et sont donc
 * justes du premier coup — un piège à focus écrit à la main se trompe
 * toujours sur un cas.
 */
export function redemanderLeMotDePasse(demande: Redemande): Promise<boolean> {
  return new Promise((resoudre) => {
    const destructeur = (demande.ton ?? 'destructeur') === 'destructeur';

    const dialogue = document.createElement('dialog');
    dialogue.className =
      'max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl ' +
      'backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

    const corps = document.createElement('form');
    corps.method = 'dialog';
    corps.className = 'flex flex-col gap-3 p-5';

    const titre = document.createElement('h2');
    titre.className = 'text-lg font-semibold';
    titre.textContent = demande.titre;

    const consequence = document.createElement('p');
    consequence.className = 'text-sm leading-relaxed text-slate-600 dark:text-slate-300';
    consequence.textContent = demande.consequence;

    const etiquette = document.createElement('label');
    etiquette.className = 'block text-sm';
    const legende = document.createElement('span');
    legende.className = 'mb-1 block font-medium';
    legende.textContent = 'Mot de passe du site';
    const champ = document.createElement('input');
    champ.type = 'password';
    champ.autocomplete = 'current-password';
    champ.className =
      'cible-tactile w-full rounded-lg border border-slate-300 px-3 text-sm ' +
      'dark:border-slate-700 dark:bg-slate-950';
    etiquette.append(legende, champ);

    const erreur = document.createElement('p');
    erreur.className = 'hidden text-sm text-rose-700 dark:text-rose-300';
    erreur.setAttribute('role', 'alert');

    const rangee = document.createElement('div');
    rangee.className = 'mt-1 flex flex-wrap justify-end gap-2';

    const renoncer = document.createElement('button');
    renoncer.type = 'button';
    renoncer.className =
      'cible-tactile rounded-lg border border-slate-300 px-4 text-sm font-medium ' +
      'transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800';
    renoncer.textContent = 'Renoncer';

    const confirmer = document.createElement('button');
    confirmer.type = 'submit';
    confirmer.className =
      'cible-tactile rounded-lg px-4 text-sm font-medium text-white transition ' +
      (destructeur ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700');
    confirmer.textContent = demande.action;

    rangee.append(renoncer, confirmer);
    corps.append(titre, consequence, etiquette, erreur, rangee);
    dialogue.append(corps);
    document.body.append(dialogue);

    let rendu = false;
    const finir = (verdict: boolean) => {
      if (rendu) return;
      rendu = true;
      /*
         Le champ est vidé avant de retirer le dialogue. Ce n'est pas du zèle :
         un nœud détaché vit tant qu'une référence le retient, et le mot de
         passe vivrait avec lui.
      */
      champ.value = '';
      dialogue.close();
      dialogue.remove();
      resoudre(verdict);
    };

    renoncer.addEventListener('click', () => finir(false));
    /* Échap ferme le dialogue : le navigateur émet « cancel », pas « submit ». */
    dialogue.addEventListener('cancel', (e) => {
      e.preventDefault();
      finir(false);
    });

    corps.addEventListener('submit', (e) => {
      e.preventDefault();
      void (async () => {
        const saisi = champ.value;
        if (!saisi) {
          erreur.textContent = 'Saisissez le mot de passe.';
          erreur.classList.remove('hidden');
          return;
        }
        confirmer.disabled = true;
        renoncer.disabled = true;
        const libelle = confirmer.textContent;
        confirmer.textContent = 'Vérification…';
        try {
          const parametres = await chargerParametresCle();
          const cle = await deriverCle(saisi, parametres);
          if (await cleValide(cle, parametres)) {
            finir(true);
            return;
          }
          erreur.textContent = 'Mot de passe incorrect. Rien n’a été fait.';
        } catch (e) {
          /*
             Une panne n'est pas un refus, et la confondre avec lui serait
             grave dans les deux sens : laisser passer par indulgence, ou
             accuser un mot de passe juste. On dit donc la panne, et on ne
             fait rien.
          */
          erreur.textContent = `Vérification impossible : ${(e as Error).message}. Rien n’a été fait.`;
        }
        erreur.classList.remove('hidden');
        confirmer.disabled = false;
        renoncer.disabled = false;
        confirmer.textContent = libelle;
        champ.select();
      })();
    });

    dialogue.showModal();
    champ.focus();
  });
}
