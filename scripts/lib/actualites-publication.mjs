/**
 * Publication de la rubrique Actualités — vérification et inventaire.
 *
 * **Pourquoi un module à part.** Ces deux fonctions sont le garde-fou qui
 * empêche une actualité de partir en clair sur GitHub Pages. Elles servent
 * désormais à deux appelants : « scripts/deploy.mjs », qui reconstruit la
 * branche de publication depuis « dist/ », et « scripts/publier-actualites.mjs »,
 * qui met à jour la seule rubrique Actualités sans rien reconstruire. Un
 * garde-fou dupliqué finirait par ne plus dire la même chose des deux côtés ;
 * il n'en existe donc qu'un seul exemplaire, ici.
 *
 * Les fonctions **lèvent** une erreur au lieu de terminer le processus : c'est
 * à l'appelant de décider comment l'annoncer.
 */
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chiffrerPourActualites, idStable, importerPubliqueActualites } from './crypto.mjs';

/** Dossier de la rubrique Actualités, hors du périmètre du build. */
export const DOSSIER_ACTUALITES = 'actualites-data';

/** Seul fichier de la rubrique publié en clair, par définition : c'est son rôle. */
export const FICHIER_CLE_PUBLIQUE = 'cle-publique.json';

/**
 * Nom du fichier d'inventaire dans la publication. C'est une empreinte stable,
 * donc toujours la même : une nouvelle publication écrase la précédente au lieu
 * d'accumuler des orphelins.
 */
export async function nomFichierInventaire() {
  return `${await idStable('inventaire')}.json`;
}

/**
 * Nombre de commits présents sur « origin » et absents du clone local, pour la
 * branche indiquée. Retourne « null » si le dépôt distant est injoignable.
 *
 * **Pourquoi ce contrôle existe.** Les deux chemins de publication *remplacent*
 * le dossier « actualites-data/ » en ligne par celui du clone local, au lieu de
 * le compléter — c'est voulu, sans quoi une entrée retirée du dépôt resterait
 * en ligne pour toujours. Mais un clone en retard a un dossier plus pauvre que
 * le dépôt : publier depuis là effacerait du site les actualités fusionnées
 * entre-temps. Avec quatre routines de veille qui écrivent dans le même dossier,
 * ce n'est pas une hypothèse d'école : c'est le cas normal dès que deux d'entre
 * elles se suivent de près.
 */
export function commitsDeRetard(racine, branche) {
  const git = (...args) =>
    execFileSync('git', ['-C', racine, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('fetch', '-q', 'origin', branche);
    return Number(git('rev-list', '--count', 'HEAD..FETCH_HEAD'));
  } catch {
    return null;
  }
}

/** Branche actuellement extraite, ou « null » hors de toute branche. */
export function brancheCourante(racine) {
  try {
    const nom = execFileSync('git', ['-C', racine, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return nom && nom !== 'HEAD' ? nom : null;
  } catch {
    return null;
  }
}

/**
 * Vérifie que chaque entrée de la rubrique Actualités est bien une enveloppe
 * chiffrée. Seule « cle-publique.json » est publiée en clair, par définition.
 *
 * Retourne l'inventaire : les noms de fichiers publiés, par sous-dossier.
 * Retourne « null » si le dossier n'existe pas.
 */
export async function verifierActualitesChiffrees(dossier, journal = console.log) {
  if (!existsSync(dossier)) return null;
  let verifiees = 0;
  const inventaire = {};
  for (const sousDossier of await readdir(dossier, { withFileTypes: true })) {
    if (!sousDossier.isDirectory()) continue;
    const chemin = path.join(dossier, sousDossier.name);
    inventaire[sousDossier.name] = [];
    for (const fichier of await readdir(chemin)) {
      const brut = await readFile(path.join(chemin, fichier), 'utf8');
      let contenu;
      try {
        contenu = JSON.parse(brut);
      } catch {
        throw new Error(`« ${DOSSIER_ACTUALITES}/${sousDossier.name}/${fichier} » n'est pas un JSON valide.`);
      }
      if (!contenu?.ct || !contenu?.cle || !contenu?.iv) {
        throw new Error(
          `« ${DOSSIER_ACTUALITES}/${sousDossier.name}/${fichier} » n'est pas chiffré : publication annulée.\n` +
            '  Chiffrez-le avec « node scripts/chiffrer-actualite.mjs ».',
        );
      }
      inventaire[sousDossier.name].push(fichier.replace(/\.json$/, ''));
      verifiees++;
    }
  }
  journal(
    verifiees
      ? `› ${DOSSIER_ACTUALITES}/ : ${verifiees} actualité(s) publiée(s), toutes chiffrées.`
      : `› ${DOSSIER_ACTUALITES}/ : aucune actualité à publier pour l'instant.`,
  );
  return inventaire;
}

/**
 * Écrit l'inventaire chiffré des entrées publiées.
 *
 * **Pourquoi.** GitHub Pages ne permet pas de lister un dossier, et les noms de
 * fichiers sont des empreintes : le navigateur n'a donc aucun moyen de savoir ce
 * qui existe. Il sondait jusqu'ici les identifiants de semaine en remontant le
 * temps, ce qui coûtait plusieurs dizaines de requêtes dont l'immense majorité
 * répondaient 404 — et saturait la console d'erreurs, au point de masquer les
 * vraies. L'inventaire supprime le sondage : une requête, puis exactement les
 * fichiers qui existent.
 *
 * **Pourquoi chiffré.** Une liste d'empreintes en clair serait inversible :
 * l'espace des identifiants de période est minuscule (quelques centaines de
 * semaines plausibles), si bien que n'importe qui pourrait précalculer les
 * empreintes et lire dans l'inventaire les dates couvertes. Ce serait une
 * métadonnée sur les périodes de révision, aujourd'hui non énumérable faute de
 * listage. L'inventaire est donc une enveloppe comme les autres : seul le
 * détenteur de la clé privée le lit.
 */
export async function ecrireInventaire(dossier, inventaire, journal = console.log) {
  if (!inventaire) return;
  const cheminCle = path.join(dossier, FICHIER_CLE_PUBLIQUE);
  if (!existsSync(cheminCle)) {
    journal(`› ${DOSSIER_ACTUALITES}/ : clé publique absente, inventaire non écrit.`);
    return;
  }
  const { jwk } = JSON.parse(await readFile(cheminCle, 'utf8'));
  const clePublique = await importerPubliqueActualites(jwk);
  await writeFile(
    path.join(dossier, await nomFichierInventaire()),
    JSON.stringify(await chiffrerPourActualites(clePublique, inventaire)),
  );
  const total = Object.values(inventaire).reduce((n, noms) => n + noms.length, 0);
  journal(
    `› ${DOSSIER_ACTUALITES}/ : inventaire chiffré de ${total} entrée(s) — ` +
      'le navigateur ne sondera plus les périodes absentes.',
  );
}
