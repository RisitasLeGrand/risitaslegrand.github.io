/**
 * Prétest — s'essayer aux questions **avant** d'avoir lu.
 *
 * Tenter de répondre à une question avant d'avoir reçu l'enseignement
 * correspondant améliore la mémorisation de cet enseignement, y compris — et
 * surtout — quand la tentative échoue : l'erreur creuse la place où la bonne
 * réponse viendra se loger. La condition est qu'une vraie tentative ait lieu,
 * d'où le bouton « Valider » plutôt qu'un simple « suivant », et d'où aussi
 * l'absence totale d'enjeu.
 *
 * Trois règles en découlent, et elles sont plus importantes que le code :
 *
 *  - **Aucune pénalité.** La justesse ne rapporte rien et ne coûte rien : les
 *    XP sont forfaitaires, pour la tentative seule, et aucune statistique de
 *    réussite n'est tenue. Récompenser la justesse installerait de l'anxiété
 *    exactement là où il ne faut pas.
 *  - **Le prétest ne nourrit pas le journal d'erreurs.** Se tromper ici est
 *    attendu ; ce n'est pas un oubli à rattraper. Ce module n'appelle donc rien
 *    du journal, et c'est délibéré.
 *  - **Une seule fois**, avant la première lecture du cours. Ensuite l'effet
 *    n'existe plus : la question ne précède plus rien.
 *
 * **La justesse est en revanche mesurée, pour orienter.** Ce n'est pas une
 * entorse à la première règle, c'en est l'autre face : ce qui est proscrit,
 * c'est de *sanctionner* une erreur attendue, pas d'en tirer une information.
 * Les réponses alimentent donc une **note d'entrée** — distincte du niveau
 * acquis, et rangée à part pour cette raison : voir `PREFIXE_ENTREE` dans
 * `src/lib/niveau.ts`. Elle sert à une seule chose, situer les cours dans la
 * zone proximale de développement et orienter vers ceux qui y sont. Rien n'est
 * affiché comme une performance, rien n'entre dans la progression, et le
 * réglage « pretest » coupe la mesure sans toucher au reste.
 *
 * « Passer » n'est pas « répondre ». Le bouton existe pour qu'une consultation
 * rapide ne soit pas bloquée ; il met donc le prétest en sommeil pour la
 * journée, pas pour toujours. Le consommer définitivement sur un coup d'œil
 * reviendrait à le perdre pour la séance de travail qui vient.
 *
 * **La fiche porte un vivier, on en tire quelques questions.** Un prétest qui
 * poserait toujours les mêmes questions cesserait d'en être un dès le second
 * passage : la personne ne répondrait plus d'après ce qu'elle sait, mais
 * d'après la correction qu'elle a déjà lue. Or un second passage arrive — une
 * progression effacée par accident remet toutes les fiches à zéro. Le tirage
 * privilégie les questions jamais servies, et retombe sur le hasard quand la
 * mémoire de ce qui a été servi a disparu, ce qui est précisément le cas après
 * une réinitialisation.
 */
import type { Fiche, QuestionQuiz } from './contenu';
import { lireEtatFiche } from './db';
import { gagnerXp, xpPretest } from './gamification';
import { enregistrerPretest, niveauDEntree, type ReponsePretest } from './niveau';
import { enregistrerIssue, justesse, tirer, type Issue } from './pretest-noyau';
import { lien, notifier, pluriel } from './ui';

// Le noyau porte les décisions (proposer, tirer, noter, consigner) ; il est
// réexporté ici pour que les pages n'aient qu'un module à connaître.
export {
  QUESTIONS_PAR_PRETEST,
  aPretest,
  aProposer,
  justesse,
  melanger,
  memoriserServies,
  tirer,
  type Issue,
} from './pretest-noyau';

/**
 * Ajoute sous le bilan la note d'entrée et le lien d'orientation.
 *
 * Muet quand aucune note n'existe encore — mieux vaut ne rien dire qu'annoncer
 * un niveau tiré d'une seule question écartée par les réglages.
 */
async function annoncerOrientation(
  fiche: Pick<Fiche, 'matiere' | 'fascicule'>,
  apres: HTMLElement,
): Promise<void> {
  const entree = await niveauDEntree(fiche.matiere, fiche.fascicule);
  if (!entree) return;
  const phrase = document.createElement('p');
  phrase.className = 'mt-2 text-sm text-slate-600 dark:text-slate-300';
  const posees = pluriel(entree.observations, 'question', 'questions');
  phrase.textContent = entree.fiable
    ? `Niveau d’entrée estimé sur ${entree.libelle} : ${entree.note}, d’après ${posees} ` +
      'posées avant lecture. '
    : `Niveau d’entrée encore indicatif sur ${entree.libelle} — ${posees} posées avant ` +
      'lecture, il en faut quelques-unes de plus pour l’afficher. ';
  const vers = document.createElement('a');
  vers.className = 'font-medium text-indigo-600 hover:underline dark:text-indigo-400';
  vers.href =
    `${lien('/positionnement/')}?matiere=${encodeURIComponent(fiche.matiere)}` +
    `&fascicule=${encodeURIComponent(fiche.fascicule)}`;
  vers.textContent = 'Situer les cours de ce fascicule →';
  phrase.appendChild(vers);
  apres.insertAdjacentElement('afterend', phrase);
}

const CLASSE_OPTION =
  'flex w-full items-start gap-2 rounded-lg border border-slate-300 px-3 py-2 text-left text-sm ' +
  'transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800';
const CLASSE_CHOISIE =
  'flex w-full items-start gap-2 rounded-lg border border-indigo-500 bg-indigo-50 px-3 py-2 ' +
  'text-left text-sm dark:border-indigo-400 dark:bg-indigo-950/50';

/**
 * Construit le prétest dans `hote` et rend la main quand la personne a tenté ou
 * passé. L'appelant affiche ensuite le cours.
 */
export async function montrer(
  fiche: Pick<Fiche, 'id' | 'matiere' | 'fascicule' | 'titre' | 'pretest'>,
  hote: HTMLElement,
): Promise<Issue> {
  // L'état est lu ici plutôt que reçu en argument : un appelant qui oublierait
  // de transmettre les questions déjà vues rejouerait exactement les mêmes, et
  // rien ne le signalerait.
  const etat = await lireEtatFiche(fiche.id);
  const questions = tirer(fiche.pretest ?? [], etat?.pretestVues ?? []);
  const servies = questions.map((q) => q.id);
  return new Promise<Issue>((terminer) => {
    const choix = questions.map(() => new Set<number>());
    let valide = false;

    const panneau = document.createElement('section');
    panneau.className =
      'rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-6 dark:border-indigo-900 dark:bg-indigo-950/30';

    const titre = document.createElement('h2');
    titre.className = 'text-lg font-bold text-slate-900 dark:text-white';
    titre.textContent = 'Avant de lire';
    const intro = document.createElement('p');
    intro.className = 'mt-1 text-sm text-slate-600 dark:text-slate-300';
    intro.textContent =
      'Essayez de répondre avant d’avoir lu le cours. Se tromper est normal, et c’est même ' +
      'ce qui rend la lecture plus efficace : rien ici n’est compté ni retenu contre vous.';
    panneau.append(titre, intro);

    const corps = document.createElement('div');
    corps.className = 'mt-4 space-y-5';
    panneau.appendChild(corps);

    questions.forEach((question: QuestionQuiz, i) => {
      const bloc = document.createElement('div');
      const enonce = document.createElement('p');
      enonce.className = 'font-medium text-slate-900 dark:text-slate-100';
      enonce.textContent = `${i + 1}. ${question.question}`;
      const multiple = question.bonnes.length > 1;
      const aide = document.createElement('p');
      aide.className = 'mt-0.5 text-xs text-slate-500 dark:text-slate-400';
      aide.textContent = multiple ? 'Plusieurs réponses possibles.' : 'Une seule réponse.';
      const liste = document.createElement('div');
      liste.className = 'mt-2 space-y-1.5';

      question.options.forEach((option, j) => {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = CLASSE_OPTION;
        bouton.textContent = option;
        bouton.addEventListener('click', () => {
          if (valide) return;
          if (multiple) {
            if (choix[i].has(j)) choix[i].delete(j);
            else choix[i].add(j);
          } else {
            choix[i].clear();
            choix[i].add(j);
          }
          [...liste.children].forEach((enfant, k) => {
            (enfant as HTMLElement).className = choix[i].has(k) ? CLASSE_CHOISIE : CLASSE_OPTION;
          });
        });
        liste.appendChild(bouton);
      });

      bloc.append(enonce, aide, liste);
      corps.appendChild(bloc);
    });

    const actions = document.createElement('div');
    actions.className = 'mt-5 flex flex-wrap items-center gap-2';
    const valider = document.createElement('button');
    valider.type = 'button';
    valider.className =
      'min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition ' +
      'hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200';
    valider.textContent = 'Valider mes réponses';
    const passer = document.createElement('button');
    passer.type = 'button';
    passer.className =
      'min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium transition ' +
      'hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800';
    passer.textContent = 'Passer et lire le cours';
    actions.append(valider, passer);
    panneau.appendChild(actions);

    passer.addEventListener('click', () => {
      void enregistrerIssue(fiche, 'passe', servies).then(() => {
        panneau.remove();
        terminer('passe');
      });
    });

    valider.addEventListener('click', () => {
      if (valide) return;
      valide = true;
      // La correction s'affiche, mais rien n'est noté : on montre où la lecture
      // va porter, pas un résultat.
      questions.forEach((question, i) => {
        const liste = corps.children[i].querySelector('div:last-child')!;
        [...liste.children].forEach((enfant, j) => {
          const bouton = enfant as HTMLButtonElement;
          bouton.disabled = true;
          const bonne = question.bonnes.includes(j);
          const cochee = choix[i].has(j);
          bouton.className =
            'flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm ' +
            (bonne
              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-200'
              : cochee
                ? 'border-slate-400 bg-slate-100 text-slate-600 line-through dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400'
                : 'border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400');
        });
        if (question.explication) {
          const note = document.createElement('p');
          note.className = 'mt-2 text-sm text-slate-600 dark:text-slate-300';
          note.textContent = question.explication;
          corps.children[i].appendChild(note);
        }
      });

      const tentees = choix.filter((c) => c.size > 0).length;
      valider.remove();
      passer.textContent = 'Lire le cours';
      const bilan = document.createElement('p');
      bilan.className = 'mt-4 text-sm text-slate-600 dark:text-slate-300';
      bilan.textContent = tentees
        ? 'Gardez ces questions en tête : le cours y répond. Rien n’est compté comme une ' +
          'erreur, ni porté au journal — vos réponses servent seulement à situer les cours ' +
          'qui vous sont utiles maintenant.'
        : 'Rien n’a été coché — le cours répond quand même à ces questions.';
      panneau.insertBefore(bilan, actions);

      void (async () => {
        await enregistrerIssue(fiche, 'tente', servies);
        // Les questions laissées vides ne sont pas des observations : ne rien
        // cocher n'est pas se tromper, et le compter comme un échec ferait
        // baisser la note d'entrée de qui survole plutôt que de qui ignore.
        const reponses: ReponsePretest[] = questions
          .map((question, i) => ({ question, choisies: choix[i] as ReadonlySet<number> }))
          .filter(({ choisies }) => choisies.size > 0)
          .map(({ question, choisies }) => ({
            itemId: question.id,
            resultat: justesse(question, choisies),
            matiere: fiche.matiere,
            fascicule: fiche.fascicule,
            ficheId: fiche.id,
            ficheTitre: fiche.titre,
          }));
        if (reponses.length) {
          await enregistrerPretest(reponses);
          await annoncerOrientation(fiche, bilan);
        }
        if (tentees) {
          const gain = await gagnerXp(xpPretest());
          notifier(`+${gain.xpGagne} XP — prétest tenté`, 'succes');
          for (const badge of gain.nouveauxBadges) {
            notifier(`${badge.icone} Succès : ${badge.nom}`, 'badge');
          }
          if (gain.monteeDeNiveau) notifier(`🎉 Niveau ${gain.niveau.niveau} !`, 'succes');
        }
      })();

      passer.addEventListener(
        'click',
        () => {
          panneau.remove();
          terminer('tente');
        },
        { once: true },
      );
    });

    hote.replaceChildren(panneau);
    hote.classList.remove('hidden');
    panneau.scrollIntoView({ block: 'nearest' });
  });
}
