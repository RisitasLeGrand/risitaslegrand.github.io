/**
 * L'éditeur de parts : répartir une opération entre plusieurs catégories.
 *
 * ## Ce que la phase 3 bis avait laissé
 *
 * `vueDesCategories` répartit correctement une opération fractionnée, et les
 * essais le vérifient au centime. Mais rien ne permettait d'en **fabriquer**
 * une : `Pointage.parts` existait, personne ne pouvait le remplir. Ce module
 * est la moitié manquante, et il est pur — toute la règle est ici, l'écran
 * ne fait qu'afficher et appeler.
 *
 * ## La convention de signe, qui décide de tout
 *
 * Une part porte **le signe de son opération**. C'est imposé par le calcul
 * d'en face : pour une opération non fractionnée, `vueDesCategories` ajoute
 * `-o.centimes` à la catégorie ; pour une opération fractionnée, il ajoute
 * `-part.centimes` à chacune. Une dépense de 120 € vaut donc `-12000`, et ses
 * parts valent `-7000` et `-5000`. Des parts positives feraient compter la
 * dépense en recette, et l'erreur serait silencieuse : les deux moitiés
 * s'afficheraient au bon endroit avec le mauvais signe.
 *
 * D'où le refus des signes mêlés. On pourrait imaginer un achat suivi d'un
 * remboursement partiel sur la même ligne de relevé ; mais une ligne de
 * relevé porte un seul mouvement, et accepter le cas rendrait indétectable
 * l'erreur de saisie qu'il imite.
 *
 * ## La somme est exacte, jamais arrondie
 *
 * Les parts somment **au centime** à l'opération. C'est la même exigence que
 * `diviser()` en phase 3, et pour la même raison : un centime orphelin ferait
 * échouer le rapprochement de solde sans que personne ne comprenne pourquoi.
 * Le partage en parts égales met donc le reste de la division sur la
 * dernière part, et l'éditeur offre un geste pour y poser le reste.
 *
 * ## Pourquoi le contrôle de la somme ne vit pas dans `controlerPointage`
 *
 * Parce qu'un `Pointage` ne porte pas le montant de son opération — il porte
 * son identifiant. Le contrôle qui a besoin des deux vit donc ici, et
 * `controlerPointage` a reçu en échange les deux contrôles qui n'en ont pas
 * besoin : pas deux parts sur le même type, pas de signes mêlés. Ainsi
 * aucune voie d'écriture ne peut produire ces deux-là, et la somme est
 * vérifiée là où l'opération est connue.
 */
import { euros, type Centimes, type OperationBancaire } from './finances';
import { A_IDENTIFIER, TOUS_LES_TYPES, typeDe } from './taxonomie';
import type { PartPointee } from './pointage';

/** Le minimum : en deçà, ce n'est pas un fractionnement. */
export const PARTS_MINIMALES = 2;

/**
 * Le plafond du nombre de parts.
 *
 * Il n'a rien de technique. Au-delà d'une poignée, on ne répartit plus une
 * opération : on ressaisit un ticket de caisse, et ce n'est pas ce que cet
 * écran promet. Le refus dit cela plutôt que de laisser quelqu'un découvrir
 * à la douzième ligne qu'il s'est engagé dans une comptabilité.
 */
export const PARTS_MAXIMALES = 8;

const signeDe = (c: Centimes) => (c < 0 ? -1 : c > 0 ? 1 : 0);

/* ══════════════════════════════════════════════════════════════════════════
   Les gestes
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le partage en `n` parts égales, reste sur la dernière.
 *
 * C'est la règle de `diviser()` de la phase 3, recopiée volontairement
 * plutôt que partagée : l'autre répartit une opération entre des
 * **occurrences** de budget, celle-ci entre des **types** de dépense. Les
 * deux font la même arithmétique aujourd'hui et n'ont aucune raison de
 * rester liées demain.
 */
export function repartirEnParts(
  operation: OperationBancaire,
  n: number,
  typeId: string,
): PartPointee[] {
  const parts = Math.max(PARTS_MINIMALES, Math.min(PARTS_MAXIMALES, Math.trunc(n)));
  const base = Math.trunc(operation.centimes / parts);
  const sorties: PartPointee[] = Array.from({ length: parts }, () => ({ typeId, centimes: base }));
  sorties[parts - 1].centimes += operation.centimes - base * parts;
  return sorties;
}

/**
 * L'état d'ouverture de l'éditeur : deux parts égales, **de types
 * différents**.
 *
 * La distinction vaut d'être écrite, parce que la première version ne la
 * faisait pas : elle ouvrait sur deux parts du type courant, c'est-à-dire
 * sur un fractionnement immédiatement invalide — deux parts sur le même
 * type —, et l'écran accueillait la personne par un reproche avant qu'elle
 * n'ait rien fait. Un éditeur doit s'ouvrir sur un état qu'on a le droit
 * d'enregistrer, même s'il n'a pas encore de sens.
 *
 * La seconde part part donc sur « à identifier » : c'est un état, pas un
 * type, et il dit exactement ce qu'il en est — on sait qu'il y a une
 * deuxième part, on ne sait pas encore de quoi.
 */
export function partsDeDepart(
  operation: OperationBancaire,
  typeId: string | null,
): PartPointee[] {
  const premier = typeId ?? A_IDENTIFIER.id;
  const second =
    premier === A_IDENTIFIER.id
      ? (TOUS_LES_TYPES.find((t) => t.id !== premier)?.id ?? premier)
      : A_IDENTIFIER.id;
  const parts = repartirEnParts(operation, 2, premier);
  parts[1] = { ...parts[1], typeId: second };
  return parts;
}

/** Ce qu'il reste à répartir. Zéro quand les parts bouclent. */
export const resteARepartir = (
  operation: OperationBancaire,
  parts: readonly PartPointee[],
): Centimes => operation.centimes - parts.reduce((s, p) => s + p.centimes, 0);

/** Pose tout le reste sur une part. Le geste qui clôt l'édition. */
export function mettreLeResteSur(
  operation: OperationBancaire,
  parts: readonly PartPointee[],
  index: number,
): PartPointee[] {
  const reste = resteARepartir(operation, parts);
  return parts.map((p, i) => (i === index ? { ...p, centimes: p.centimes + reste } : { ...p }));
}

/**
 * Ajoute une part.
 *
 * Elle prend le reste s'il y en a un — c'est le cas courant, on vient de
 * diminuer une part pour en créer une autre. Sinon elle prend la moitié de
 * la plus grosse : sans cela la nouvelle part naîtrait à zéro, donc
 * invalide, et l'écran afficherait une erreur en réponse à un geste
 * parfaitement raisonnable.
 */
export function ajouterUnePart(
  operation: OperationBancaire,
  parts: readonly PartPointee[],
  typeId: string,
): PartPointee[] {
  const reste = resteARepartir(operation, parts);
  if (reste !== 0) return [...parts.map((p) => ({ ...p })), { typeId, centimes: reste }];

  const copie = parts.map((p) => ({ ...p }));
  let plusGrosse = 0;
  for (let i = 1; i < copie.length; i += 1) {
    if (Math.abs(copie[i].centimes) > Math.abs(copie[plusGrosse].centimes)) plusGrosse = i;
  }
  const prise = Math.trunc(copie[plusGrosse].centimes / 2);
  copie[plusGrosse].centimes -= prise;
  return [...copie, { typeId, centimes: prise }];
}

/**
 * Retire une part, et **reverse son montant** sur la plus grosse des
 * restantes.
 *
 * Le reversement n'est pas une politesse : sans lui, retirer une part
 * laisserait un reste, donc une erreur, en réponse à un geste de correction.
 * Quelqu'un qui s'est trompé de type ne doit pas se retrouver avec deux
 * choses à réparer au lieu d'une.
 */
export function retirerUnePart(
  parts: readonly PartPointee[],
  index: number,
): PartPointee[] {
  if (index < 0 || index >= parts.length) return parts.map((p) => ({ ...p }));
  const restantes = parts.filter((_, i) => i !== index).map((p) => ({ ...p }));
  if (!restantes.length) return restantes;
  let plusGrosse = 0;
  for (let i = 1; i < restantes.length; i += 1) {
    if (Math.abs(restantes[i].centimes) > Math.abs(restantes[plusGrosse].centimes)) plusGrosse = i;
  }
  restantes[plusGrosse].centimes += parts[index].centimes;
  return restantes;
}

/** La part d'une opération, en pourcentage affichable. `null` si l'opération est nulle. */
export const partEnPourcentage = (
  part: PartPointee,
  operation: OperationBancaire,
): number | null =>
  operation.centimes === 0 ? null : (part.centimes / operation.centimes) * 100;

/* ══════════════════════════════════════════════════════════════════════════
   Le contrôle
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les parts tiennent-elles ?
 *
 * Appelé par l'écran à chaque frappe pour afficher ce qui cloche, et une
 * dernière fois avant d'écrire. Les messages s'adressent à quelqu'un qui est
 * en train d'éditer : ils disent ce qui manque et de combien, pas qu'une
 * invariante est violée.
 */
export function controlerLesParts(
  operation: OperationBancaire,
  parts: readonly PartPointee[],
): string[] {
  const problemes: string[] = [];

  if (parts.length < PARTS_MINIMALES) {
    problemes.push(
      `Un fractionnement demande au moins ${PARTS_MINIMALES} parts. Avec une seule, ` +
        'il suffit de choisir le type de l’opération.',
    );
  }
  if (parts.length > PARTS_MAXIMALES) {
    problemes.push(
      `${parts.length} parts, c’est plus que les ${PARTS_MAXIMALES} que cet écran ` +
        'accepte. Au-delà, ce n’est plus répartir une opération, c’est ressaisir un ticket.',
    );
  }

  const reste = resteARepartir(operation, parts);
  if (reste !== 0) {
    problemes.push(`${phraseDuReste(operation, parts)} L’opération fait ${euros(operation.centimes)}.`);
  }

  if (parts.some((p) => p.centimes === 0)) {
    problemes.push('Une part à zéro n’est pas une part : retirez-la, ou donnez-lui un montant.');
  }

  const attendu = signeDe(operation.centimes);
  const contraires = parts.filter((p) => p.centimes !== 0 && signeDe(p.centimes) !== attendu);
  if (attendu !== 0 && contraires.length) {
    problemes.push(
      attendu < 0
        ? 'Une part positive sur une dépense compterait cette part en recette. ' +
          'Toutes les parts d’une dépense sont négatives.'
        : 'Une part négative sur une recette compterait cette part en dépense. ' +
          'Toutes les parts d’une recette sont positives.',
    );
  }

  const vus = new Set<string>();
  for (const p of parts) {
    if (!p.typeId) {
      problemes.push('Une part sans type ne se range nulle part : choisissez-en un.');
      continue;
    }
    if (!typeDe(p.typeId)) {
      problemes.push(`Le type « ${p.typeId} » n’existe pas dans la taxonomie.`);
      continue;
    }
    if (vus.has(p.typeId)) {
      problemes.push(
        `Deux parts sur « ${typeDe(p.typeId)!.libelle} » : additionnez-les en une seule, ` +
          'le résultat sera le même et la lecture plus claire.',
      );
    }
    vus.add(p.typeId);
  }

  return problemes;
}

/**
 * La phrase du reste, toujours affichée.
 *
 * Même à zéro — surtout à zéro. Un écran qui n'affiche le reste que
 * lorsqu'il est non nul laisse la personne deviner si le silence veut dire
 * « ça tombe juste » ou « je n'ai pas encore calculé ».
 */
export function phraseDuReste(operation: OperationBancaire, parts: readonly PartPointee[]): string {
  const reste = resteARepartir(operation, parts);
  if (reste === 0) return `Tout est réparti : les parts font ${euros(operation.centimes)}.`;
  const manque = signeDe(reste) === signeDe(operation.centimes);
  return manque
    ? `Il reste ${euros(reste)} à répartir.`
    : `Les parts dépassent l’opération de ${euros(-reste)}.`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerLeFractionnement(): string[] {
  const problemes: string[] = [];
  if (PARTS_MINIMALES < 2) {
    problemes.push('Une part unique n’est pas un fractionnement.');
  }
  if (PARTS_MAXIMALES < PARTS_MINIMALES) {
    problemes.push('Le plafond de parts est sous le plancher : aucun fractionnement ne passerait.');
  }

  /*
     Le partage en parts égales doit boucler **quel que soit** le montant.
     C'est l'invariante que personne ne vérifierait à la main, et c'est
     exactement celle qui lâche sur les montants indivisibles : 100 € en
     trois, un centime de reste.
  */
  for (const centimes of [-10_000, -10_001, -1, 7, 99_999, -333_333]) {
    for (let n = PARTS_MINIMALES; n <= PARTS_MAXIMALES; n += 1) {
      const operation = { centimes } as OperationBancaire;
      const parts = repartirEnParts(operation, n, 'courses');
      if (resteARepartir(operation, parts) !== 0) {
        problemes.push(
          `Le partage de ${euros(centimes)} en ${n} parts laisse un reste : un centime ` +
            'orphelin ferait échouer le rapprochement de solde sans dire pourquoi.',
        );
      }
    }
  }
  return problemes;
}
