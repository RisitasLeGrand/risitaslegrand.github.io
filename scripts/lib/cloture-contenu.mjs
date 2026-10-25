/**
 * La garde de clôture : à la fin du contenu, TOUTE question a une correction.
 *
 * ## Pourquoi une garde de plus, alors que « corrections-migrees » existe
 *
 * Le drapeau par périmètre fait déjà respecter la couverture complète — mais
 * seulement là où on l'a inscrit. C'est une liste qui s'ajoute une matière à la
 * fois, et son propre commentaire dit le risque qu'elle porte : les deux
 * listes sont restées vides depuis leur création, « la règle stricte ne
 * s'appliquait nulle part, et le garde-fou n'avait jamais pris effet ».
 *
 * Une liste d'inscription ne peut pas, par construction, attraper le périmètre
 * que personne n'a pensé à inscrire. Or c'est exactement ce qui arrive à la
 * clôture : on termine la dernière rubrique, on oublie de l'ajouter, et le
 * build reste vert sur une banque incomplète. La garde de clôture est l'autre
 * sens du même contrôle — non plus « ce périmètre est fini, tiens-le », mais
 * « plus rien ne doit manquer, où que ce soit ».
 *
 * ## Pourquoi elle est désactivée, et ce que cela ne veut pas dire
 *
 * Activée aujourd'hui, elle refuserait la banque entière : la couverture est de
 * quelques pour cent, et le rattrapage se fait par lots. La garde est donc
 * ÉCRITE, ÉPROUVÉE, et éteinte par un drapeau jusqu'à la clôture du contenu.
 *
 * Ce n'est pas un essai désactivé — l'essai, lui, tourne à chaque batterie et
 * allume le drapeau pour vérifier que la garde refuse bien. Ce qui est éteint,
 * c'est son effet sur le build, pas sa vérification. La distinction compte :
 * une garde qu'on écrit sans l'éprouver est une garde dont on ne sait rien le
 * jour où on l'allume.
 *
 * ## Comment on l'allume
 *
 * Le jour de la clôture, `CONTENU_CLOS` passe à `true` ci-dessous, en un seul
 * caractère, et le build exige la couverture complète partout. La variable
 * d'environnement n'est là que pour les essais, sur le modèle de
 * `CYCLADES_JOUR` : l'essai allume la garde sans toucher à la source, au lieu
 * de la modifier puis de la remettre.
 */

/**
 * Le contenu est-il clos ? Un seul caractère à changer le jour venu.
 *
 * Tant qu'il vaut `false`, la garde n'a aucun effet sur le build. Le passage à
 * `true` est une décision de clôture, pas un réglage : il ne se fait pas pour
 * faire passer un essai ni pour débloquer une construction.
 */
export const CONTENU_CLOS = false;

/**
 * Le drapeau effectif, surchargeable pour les essais seulement.
 *
 * `CYCLADES_CONTENU_CLOS` accepte `1`/`oui` et `0`/`non`. Toute autre valeur
 * est ignorée plutôt que devinée : un drapeau mal orthographié qui éteindrait
 * silencieusement la garde serait le pire des deux mondes.
 */
export function contenuEstClos() {
  const drapeau = process.env.CYCLADES_CONTENU_CLOS;
  if (drapeau === '1' || drapeau === 'oui') return true;
  if (drapeau === '0' || drapeau === 'non') return false;
  return CONTENU_CLOS;
}

/**
 * Les périmètres dont la couverture n'est pas complète.
 *
 * `perimetres` est une suite de paires `[étiquette, { total, corrigees }]` —
 * la forme que le vérificateur tient déjà pour son tableau de couverture, de
 * sorte que la garde ne recompte rien et ne peut donc pas compter autrement
 * que le rapport affiché juste au-dessus d'elle.
 *
 * Un périmètre VIDE n'est pas un manque : zéro question sur zéro est une
 * couverture complète, et traiter l'absence de contenu comme une faute ferait
 * échouer la garde sur un dossier qu'on vient de créer.
 */
export function manquesDeCouverture(perimetres) {
  const manques = [];
  for (const [etiquette, stats] of perimetres) {
    const total = stats?.total ?? 0;
    const corrigees = stats?.corrigees ?? 0;
    if (total === 0) continue;
    if (corrigees >= total) continue;
    const absentes = total - corrigees;
    manques.push(
      `${etiquette} : ${absentes} question(s) sans correction sur ${total} — ` +
        'le contenu est déclaré clos, donc la couverture doit être complète',
    );
  }
  return manques;
}
