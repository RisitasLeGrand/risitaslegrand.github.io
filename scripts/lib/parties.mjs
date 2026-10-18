/**
 * Les règles qui pèsent sur les parties d'une fiche (prompt 46, P1).
 *
 * Elles vivent ici, et non dans la boucle du build, pour une raison : une
 * règle enfouie dans mille lignes ne s'éprouve qu'en construisant tout le
 * contenu, c'est-à-dire presque jamais. Ici, `essais:parties-fiche` leur
 * passe trois fiches de laboratoire et sait en une seconde si elles mordent.
 */

/**
 * Ce qui interdit de publier une fiche, en clair.
 *
 * Deux défauts, et un seul est une question de goût :
 *
 * 1. **Deux parties du même identifiant.** Un identifiant désigne une partie
 *    et une seule — sinon un repère audio, une carte rattachée ou une séance
 *    ne savent plus de laquelle ils parlent, et choisissent la première,
 *    c'est-à-dire au hasard du point de vue de qui révise.
 * 2. **Une carte ou un QCM qui cite une partie absente.** Sans ce contrôle,
 *    un rattachement fautif reste invisible jusqu'à la séance où il ne
 *    propose rien, et l'on croit la partie vide.
 */
export function defautsDesParties(chemin, parties, listes) {
  const defauts = [];

  const vues = new Map();
  for (const partie of parties) {
    if (vues.has(partie.id)) {
      defauts.push(
        `${chemin} : deux parties portent l'identifiant « ${partie.id} » ` +
          `(« ${vues.get(partie.id)} » et « ${partie.titre} »). Un identifiant désigne une ` +
          'partie et une seule.',
      );
    }
    vues.set(partie.id, partie.titre);
  }

  const identifiants = new Set(parties.map((p) => p.id));
  for (const [nom, liste] of listes) {
    for (const item of liste ?? []) {
      if (item?.partie && !identifiants.has(item.partie)) {
        defauts.push(
          `${chemin} (${nom}) : « ${String(item.question ?? '').slice(0, 60)} » cite la partie ` +
            `« ${item.partie} », qui n'existe pas dans cette fiche.`,
        );
      }
    }
  }

  return defauts;
}

/** Combien de titres n'ont pas encore d'identifiant écrit. Toléré, et dit. */
export const titresSansIdentifiant = (parties) => parties.filter((p) => !p.declare).length;
