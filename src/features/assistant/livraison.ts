/**
 * Les trois façons de sortir le prompt du site.
 *
 * Aucune n'envoie quoi que ce soit : `navigator.clipboard` écrit dans le
 * presse-papiers, `navigator.share` passe la main au système, et le lien
 * Claude est un lien — c'est le navigateur qui l'ouvre, sur un geste de la
 * personne, et le site n'a fait que l'écrire.
 */

/**
 * Copier, avec un repli.
 *
 * `navigator.clipboard` n'existe pas hors contexte sécurisé et peut être
 * refusé par la permission. Le repli par `document.execCommand` est obsolète
 * et fonctionne encore partout ; sans lui, la copie échouerait silencieusement
 * sur un navigateur ancien, c'est-à-dire que le bouton principal du module ne
 * ferait rien sans le dire.
 */
export async function copier(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    /* On tente le repli. */
  }
  try {
    const zone = document.createElement('textarea');
    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.position = 'fixed';
    zone.style.opacity = '0';
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand('copy');
    zone.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Le partage système, quand il existe. */
export function partageDisponible(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function partager(texte: string, titre: string): Promise<boolean> {
  try {
    await navigator.share({ title: titre, text: texte });
    return true;
  } catch {
    // Un refus de partage est un geste de la personne, pas une panne : on rend
    // faux sans rien dire de plus.
    return false;
  }
}
