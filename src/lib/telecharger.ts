/**
 * Remettre un fichier au navigateur — la seule porte, et pourquoi elle existe.
 *
 * ## Le défaut qu'elle corrige (A3 du prompt 43)
 *
 * Onze endroits du site faisaient la même chose, de la même façon fausse :
 *
 *     const url = URL.createObjectURL(blob);
 *     lien.href = url;
 *     lien.download = nom;
 *     lien.click();
 *     URL.revokeObjectURL(url);   // ← immédiatement
 *
 * `click()` ne télécharge pas : il **demande** au navigateur de télécharger,
 * et le navigateur lira l'URL plus tard, à son rythme. Révoquer tout de suite
 * retire la ressource sous ses pieds. Chrome tolère, parce qu'il a déjà pris
 * une référence au blob ; Safari — donc l'iPhone, donc l'appareil principal de
 * Cyclades — ne tolère pas toujours, et le fichier arrive vide ou n'arrive
 * pas. Sur une sauvegarde chiffrée, un fichier tronqué ne se voit pas : il
 * s'ouvre le jour où on en a besoin, et ce jour-là il est trop tard.
 *
 * On révoque donc **plus tard**, et jamais avant que le navigateur ait eu sa
 * chance : une minute, ou au départ de la page si elle arrive avant. Le coût
 * d'une URL qui vit une minute est nul ; le coût d'une sauvegarde tronquée ne
 * l'est pas.
 *
 * ## Ce que cette fonction NE dit pas
 *
 * Elle ne rend rien, et surtout pas « réussi ». Le web n'offre aucun moyen
 * de savoir qu'un téléchargement a abouti : pas d'événement, pas de
 * promesse, pas d'accès au dossier de destination. Un écran qui annonce
 * « Sauvegarde téléchargée » après `click()` affirme ce qu'il ne sait pas.
 *
 * C'est pour cela que la fonction s'appelle « offrir » et non
 * « télécharger » : elle offre le fichier, et c'est la personne qui
 * constate. Les écrans de sauvegarde demandent donc confirmation avant de
 * noter une sauvegarde réussie.
 */

/** Les URL encore vivantes, pour les révoquer au départ de la page. */
const enAttente = new Set<string>();
let departBranche = false;

/*
   Une minute : le temps qu'un navigateur lent, sur un téléphone chargé,
   prenne sa référence au blob. Ce n'est pas une mesure — rien ne permet de
   mesurer ce délai — c'est une marge, et elle est large exprès. Une URL de
   blob retient sa mémoire tant qu'elle vit : une minute pour un fichier de
   sauvegarde est sans conséquence, et la page se décharge souvent avant.
*/
const DELAI_DE_REVOCATION_MS = 60_000;

function brancherLeDepart(): void {
  if (departBranche || typeof window === 'undefined') return;
  departBranche = true;
  /*
     `pagehide` et non `unload` : sur iOS, `unload` ne se déclenche pas quand
     l'application passe en arrière-plan, et c'est justement le moment où
     l'onglet peut être jeté.
  */
  window.addEventListener('pagehide', () => {
    for (const url of enAttente) URL.revokeObjectURL(url);
    enAttente.clear();
  });
}

/**
 * Offre un fichier au navigateur. Ne dit pas si la personne l'a reçu.
 *
 * @param contenu  le contenu, déjà prêt — octets, texte, ou un `Blob`
 * @param nom      le nom de fichier proposé
 * @param type     le type MIME ; par défaut un flux d'octets
 */
export function offrirLeFichier(
  contenu: Blob | BlobPart,
  nom: string,
  type = 'application/octet-stream',
): void {
  const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  enAttente.add(url);
  brancherLeDepart();

  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  /*
     Dans le document, et caché. Un lien détaché fonctionne sur Chrome et
     échoue silencieusement sur Firefox : le clic d'un élément hors document
     n'y déclenche pas la navigation.
  */
  lien.style.display = 'none';
  document.body.appendChild(lien);
  lien.click();
  lien.remove();

  window.setTimeout(() => {
    if (!enAttente.delete(url)) return;
    URL.revokeObjectURL(url);
  }, DELAI_DE_REVOCATION_MS);
}

/**
 * La phrase à dire après avoir offert un fichier.
 *
 * Elle est ici, et une seule fois, parce que c'est elle qui a menti pendant
 * onze écrans : « Sauvegarde téléchargée » affirmait un fait inconnu. « Le
 * téléchargement est lancé » dit ce qui s'est passé, et la suite dit quoi
 * faire pour en être sûr.
 */
export const TELECHARGEMENT_LANCE =
  'Téléchargement lancé. Vérifiez que le fichier est bien arrivé dans vos ' +
  'téléchargements, puis confirmez-le ci-dessous.';
