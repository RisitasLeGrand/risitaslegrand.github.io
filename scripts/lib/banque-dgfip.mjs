/**
 * Le CHARGEUR de la banque « QCM — DGFiP », extrait du build.
 *
 * ## Pourquoi il déménage ici
 *
 * Ce code était une fonction interne de `build-content.mjs`. Il en sort pour
 * une raison précise : le convertisseur qui ramène la banque publiée vers sa
 * source doit PROUVER que l'aller-retour est à l'identique, et une preuve
 * faite avec un second chargeur ne prouverait que l'accord du convertisseur
 * avec lui-même. En lisant la source réécrite avec le chargeur DU BUILD, la
 * comparaison porte sur ce que le site servira vraiment.
 *
 * Rien de son comportement ne change. Les deux dépendances qu'il avait sur le
 * contexte du build — la façon d'échouer, la façon d'avertir — deviennent des
 * paramètres, parce que le build arrête tout et qu'un essai, lui, veut
 * attraper l'erreur et la lire.
 *
 * ## Ce qu'il garantit, et dont tout le reste dépend
 *
 * L'identifiant d'une question est `idStable(rubrique | énoncé)`, et celui
 * d'une rubrique `idStable(rubrique)`. Ni le nom du fichier, ni l'ordre des
 * fichiers, ni le rang de la question n'y entrent. C'est ce qui permet de
 * réécrire la source dans d'autres fichiers sans rendre orphelin l'historique
 * par question conservé dans le navigateur — et c'est aussi ce qui rend la
 * preuve d'aller-retour possible.
 */
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import YAML from 'yaml';

import { idStable } from './crypto.mjs';
import { banqueDgfipSchema } from './schema.mjs';

/**
 * Charge la banque « QCM - DGFiP » (un fichier YAML par rubrique, optionnelle).
 *
 * Un fichier par rubrique. Les identifiants sont dérivés du couple
 * rubrique + énoncé : ils restent donc stables d'un build à l'autre, ce dont
 * dépend l'historique par question conservé dans le navigateur.
 *
 * @param {string} dossier  Le dossier des rubriques (`content/qcm-dgfip`).
 * @param {object} options
 * @param {(message: string) => never} options.echouer  Arrête tout sur un
 *   fichier illisible ou hors format. Le build sort du processus ; un essai
 *   lève, pour pouvoir lire le message.
 * @param {(message: string) => void} options.avertir  Signale sans arrêter.
 * @param {string} [options.etiquette]  Comment nommer le dossier dans les
 *   messages. `content/qcm-dgfip` par défaut, parce que c'est l'endroit que la
 *   personne qui corrige connaît — nommer un dossier temporaire ne lui dirait
 *   rien.
 * @returns {Promise<{rubriques: object[], questions: object[]}>}
 */
export async function chargerBanqueDgfip(
  dossier,
  { echouer, avertir, etiquette = 'content/qcm-dgfip' },
) {
  if (!existsSync(dossier)) return { rubriques: [], questions: [] };

  const rubriques = [];
  const questions = [];
  const vus = new Map();

  const fichiers = (await readdir(dossier))
    .filter((n) => /\.ya?ml$/i.test(n))
    .sort();

  for (const nom of fichiers) {
    const brut = await readFile(path.join(dossier, nom), 'utf8');
    let donnees;
    try {
      donnees = YAML.parse(brut);
    } catch (e) {
      echouer(`« ${etiquette}/${nom} » est un YAML invalide : ${e.message}`);
    }
    const resultat = banqueDgfipSchema.safeParse(donnees);
    if (!resultat.success) {
      echouer(
        `« ${etiquette}/${nom} » ne respecte pas le format attendu :\n` +
          resultat.error.issues.map((i) => `  - ${i.path.join('.')} : ${i.message}`).join('\n'),
      );
    }
    const { rubrique, ordre, questions: liste } = resultat.data;
    const rubriqueId = await idStable(rubrique, 12);
    if (!rubriques.some((r) => r.id === rubriqueId)) {
      rubriques.push({ id: rubriqueId, nom: rubrique, ordre, total: 0 });
    }

    for (const q of liste) {
      const id = await idStable(`${rubrique}|${q.question}`, 16);
      // Deux annales reprennent souvent la même question : la garder deux fois
      // fausserait le tirage, qui la sortirait deux fois dans la même session.
      const doublon = vus.get(id);
      if (doublon) {
        avertir(
          `Question en double dans « ${rubrique} », ignorée : « ${q.question.slice(0, 60)}… »` +
            ` (déjà présente via « ${doublon} »)`,
        );
        continue;
      }
      vus.set(id, nom);
      questions.push({ id, rubrique, rubriqueId, ...q });
      rubriques.find((r) => r.id === rubriqueId).total += 1;
    }
  }

  rubriques.sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'));
  return { rubriques, questions };
}
