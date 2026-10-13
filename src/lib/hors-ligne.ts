/**
 * Le cache hors ligne, côté page : annoncer la publication, garder le jour.
 *
 * Le *service worker* ne cache rien tant qu'il ne sait pas à quelle
 * publication il appartient (`public/sw.js`). Ce module est ce qui le lui
 * dit, et c'est aussi ce qui lui désigne les fiches à garder — lui ne peut
 * pas les connaître, puisque le programme du jour se calcule dans la page,
 * après déchiffrement.
 *
 * ## Pourquoi la version de `cle.json` et pas une date
 *
 * Parce qu'elle change exactement quand le contenu chiffré change. Une durée
 * de vie en jours garderait des fiches illisibles après une republication, et
 * une purge « au changement de mot de passe » manquerait les republications
 * qui n'en changent pas. La version de publication est la seule grandeur qui
 * suive la chose à invalider.
 *
 * ## Jamais d'exception vers l'appelant
 *
 * Tout ici est un confort. Un navigateur sans *service worker*, un
 * enregistrement refusé, un quota plein : aucun de ces cas n'a de raison
 * d'empêcher la page de s'afficher, et aucun ne remonte.
 */

/** Le worker prêt à recevoir, ou `null` si l'on n'en a pas. */
async function worker(): Promise<ServiceWorker | null> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    const enregistrement = await navigator.serviceWorker.ready;
    return enregistrement.active;
  } catch {
    return null;
  }
}

/**
 * Dire au worker à quelle publication on appartient.
 *
 * À appeler une fois par chargement, après avoir lu `cle.json` — c'est-à-dire
 * de toute façon, puisque rien ne s'affiche sans lui. Le worker purge alors
 * tout cache d'une autre publication.
 */
export async function annoncerLaPublication(version: string): Promise<boolean> {
  if (!version) return false;
  const actif = await worker();
  if (!actif) return false;
  actif.postMessage({ genre: 'cyclades:publication', version });
  return true;
}

/**
 * Demander au worker de garder ces URL pour une ouverture hors ligne.
 *
 * Les URL sont celles du contenu **chiffré**, avec leur paramètre de version :
 * garder une URL sans version reviendrait à garder un fichier qu'une
 * publication suivante rendrait illisible sans qu'on puisse le distinguer.
 */
export async function garderPourHorsLigne(urls: readonly string[]): Promise<boolean> {
  if (!urls.length) return false;
  const actif = await worker();
  if (!actif) return false;
  actif.postMessage({ genre: 'cyclades:garder', urls: [...urls] });
  return true;
}
