/**
 * L'empreinte d'état : « identiques ✓ », rendu vérifiable.
 *
 * C'est la pièce la plus visible du chantier de synchronisation, et la plus
 * courte. Deux appareils affichent quatre groupes de quatre signes ; l'œil
 * compare ; si c'est identique, les journaux le sont.
 *
 * ## Elle porte sur les journaux, pas sur l'état dérivé
 *
 * Deux appareils peuvent avoir la même empreinte et, l'instant d'après, des XP
 * différentes : l'un n'a pas encore recalculé. L'écran doit dire « identiques »
 * dans ce cas, parce que c'est vrai de ce qui compte — les faits — et que le
 * recalcul est déterministe. Faire porter l'empreinte sur l'état dérivé
 * afficherait « différents » pendant une seconde à chaque fusion, et apprendrait
 * à ne pas la croire.
 *
 * ## Les réglages y sont, et il faut les normaliser
 *
 * Un réglage est gagné par le dernier écrivain : deux appareils qui n'ont pas la
 * même heure de bascule ne sont pas synchronisés, et l'empreinte doit le dire.
 * Mais `JSON.stringify` d'un objet dépend de l'ordre d'insertion des clés, qui
 * dépend de l'histoire de l'objet et non de son contenu : deux appareils aux
 * mêmes réglages afficheraient des empreintes différentes. D'où le tri récursif
 * des clés avant hachage, qui est le seul vrai soin de ce module.
 *
 * ## Coût
 *
 * L'empreinte est recalculée en entier : un SHA-256 sur la liste triée des
 * identifiants, soit de l'ordre de 1,5 Mo de texte après cinq ans. Une somme
 * incrémentale par OU exclusif serait en temps constant par opération, mais un
 * condensé par OU exclusif n'est pas idempotent — une opération comptée deux
 * fois s'annule — et la protection reposerait alors entièrement sur la
 * déduplication en amont. On garde le calcul complet, dont le coût sera mesuré
 * à la phase 2 ; s'il dépasse 200 ms, la bonne réponse sera un arbre de Merkle
 * par tranche d'horloge, qui garde l'idempotence, et non le OU exclusif.
 */

/** La longueur affichée : 16 signes hexadécimaux, en quatre groupes de quatre. */
export const SIGNES_AFFICHES = 16;

async function sha256Hex(texte: string): Promise<string> {
  const octets = new TextEncoder().encode(texte);
  const condense = await crypto.subtle.digest('SHA-256', octets);
  return Array.from(new Uint8Array(condense))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Une valeur dont les clés sont triées récursivement.
 *
 * Les tableaux gardent leur ordre : dans un réglage, l'ordre d'un tableau est
 * une information — la rotation hebdomadaire n'est pas un ensemble.
 */
export function normaliser(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(normaliser);
  if (valeur && typeof valeur === 'object') {
    const entrees = Object.entries(valeur as Record<string, unknown>)
      // Une clé absente et une clé à « undefined » doivent donner la même
      // empreinte : JSON.stringify omet la seconde, le tri la garderait.
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entrees.map(([c, v]) => [c, normaliser(v)]));
  }
  return valeur;
}

export interface EtatAEmpreindre {
  /** Les identifiants des opérations du journal, dans n'importe quel ordre. */
  operations: Iterable<string>;
  /** Les réglages synchronisés, tels quels : la normalisation est ici. */
  reglages?: unknown;
}

/**
 * L'empreinte complète, en hexadécimal.
 *
 * Les identifiants sont triés ici et non par l'appelant : l'empreinte ne doit
 * pas dépendre de l'ordre dans lequel on a lu le journal, et confier ce tri à
 * chaque appelant serait confier la justesse de la comparaison à la discipline
 * de l'appelant.
 */
export async function empreinte(etat: EtatAEmpreindre): Promise<string> {
  const ids = [...etat.operations].sort();
  const reglages = JSON.stringify(normaliser(etat.reglages ?? null));
  // Le nombre d'opérations ouvre la chaîne : sans lui, un journal vide dont les
  // réglages commencent par un chiffre pourrait coïncider avec un journal d'une
  // opération. Le séparateur « \n » ne peut pas apparaître dans un ULID.
  return sha256Hex(`cyclades:1\n${ids.length}\n${ids.join('\n')}\n${reglages}`);
}

/** La forme lue par un humain : « 7F2A · 91C4 · 8D06 · B3E1 ». */
export function empreinteLisible(hexadecimal: string): string {
  const signes = hexadecimal.slice(0, SIGNES_AFFICHES).toUpperCase();
  return (signes.match(/.{1,4}/g) ?? []).join(' · ');
}

/**
 * Compare deux empreintes sur ce qui est **affiché**.
 *
 * C'est volontaire, et c'est la seule définition honnête : l'écran demande à
 * l'utilisateur de comparer seize signes, donc « identiques » doit signifier
 * « identiques sur ces seize signes ». Si le site comparait les soixante-quatre
 * signes du condensé complet, il pourrait dire « différents » devant deux
 * écrans que l'utilisateur voit identiques, et il n'aurait aucun moyen de le
 * lui expliquer.
 */
export const memeEmpreinte = (a: string, b: string): boolean =>
  a.slice(0, SIGNES_AFFICHES).toLowerCase() === b.slice(0, SIGNES_AFFICHES).toLowerCase();
