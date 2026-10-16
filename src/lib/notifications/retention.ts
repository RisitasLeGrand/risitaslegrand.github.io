/**
 * La rétention réglable du centre — prompt 32, § 3.6 et décision 7.
 *
 * ## Pourquoi le réglage vit sur l'appareil
 *
 * Le magasin du centre est **hors sauvegarde** (décision 8) et il n'est
 * pas répliqué : c'est un index reconstructible, pas une donnée. La
 * rétention est donc un ménage local, et son réglage l'est aussi. Ce
 * n'est pas le même raisonnement que pour les notifications — là, c'est
 * l'émission qui est propre à l'appareil ; ici, c'est le magasin.
 *
 * Deux appareils peuvent donc avoir deux durées sans se contredire :
 * chacun range sa propre copie de l'index. Ce qui voyage, lui — l'état lu
 * ou archivé (§ 3.5) —, passe par le journal d'opérations et ne dépend
 * pas de ce réglage.
 *
 * ## Les bornes refusent, elles ne corrigent pas
 *
 * Une durée d'archivage supérieure à celle de suppression produirait un
 * élément supprimé sans avoir jamais été archivé. Plutôt que de remettre
 * silencieusement les valeurs dans l'ordre — ce qui ferait un réglage qui
 * ne fait pas ce qu'on lui demande —, l'écriture **refuse** et dit
 * pourquoi. L'écran affiche le motif ; l'ancien réglage tient.
 *
 * Le plancher est un jour, et pas zéro : une rétention de zéro jour
 * supprimerait un élément l'après-midi de sa création, ce qui n'est plus
 * de la rétention mais une perte. Qui ne veut rien garder désactive la
 * source ; qui veut tout garder met un plafond haut.
 */
import { RETENTION_PAR_DEFAUT, type RetentionDuCentre } from './modele';

const CLE = 'cyclades.notifications.retention';

/** Un jour au moins, dix ans au plus. Au-delà, c'est « jamais », et on le dit. */
export const PLANCHER_JOURS = 1;
export const PLAFOND_JOURS = 3650;

export type VerdictDeRetention =
  | { recevable: true; retention: RetentionDuCentre }
  | { recevable: false; motif: string };

/**
 * Un réglage est-il tenable ?
 *
 * Pure, et séparée de l'écriture : c'est elle que le contrôle éprouve, et
 * c'est elle que l'écran appelle pour afficher un motif avant d'écrire.
 */
export function controlerLaRetention(retention: RetentionDuCentre): VerdictDeRetention {
  const { archiverApres, supprimerApres } = retention;
  for (const [nom, valeur] of [
    ['L’archivage', archiverApres],
    ['La suppression', supprimerApres],
  ] as const) {
    if (!Number.isInteger(valeur)) {
      return { recevable: false, motif: `${nom} se règle en jours entiers.` };
    }
    if (valeur < PLANCHER_JOURS) {
      return { recevable: false, motif: `${nom} ne peut pas être sous ${PLANCHER_JOURS} jour.` };
    }
    if (valeur > PLAFOND_JOURS) {
      return { recevable: false, motif: `${nom} ne peut pas dépasser ${PLAFOND_JOURS} jours.` };
    }
  }
  if (archiverApres >= supprimerApres) {
    return {
      recevable: false,
      motif:
        'La suppression doit venir après l’archivage, sinon un élément serait supprimé sans avoir jamais été rangé.',
    };
  }
  return { recevable: true, retention: { archiverApres, supprimerApres } };
}

/**
 * Le réglage en vigueur sur cet appareil.
 *
 * Un enregistrement illisible ou hors bornes rend le défaut, et ne lève
 * pas : la rétention tourne au chargement d'une page, et une exception y
 * emporterait le reste de l'initialisation pour un réglage.
 */
export function retentionReglee(): RetentionDuCentre {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return RETENTION_PAR_DEFAUT;
    const lu = JSON.parse(brut) as Partial<RetentionDuCentre>;
    const verdict = controlerLaRetention({
      archiverApres: Number(lu.archiverApres),
      supprimerApres: Number(lu.supprimerApres),
    });
    return verdict.recevable ? verdict.retention : RETENTION_PAR_DEFAUT;
  } catch {
    return RETENTION_PAR_DEFAUT;
  }
}

/** Écrit le réglage, ou dit pourquoi non. N'écrit jamais une valeur refusée. */
export function reglerLaRetention(retention: RetentionDuCentre): VerdictDeRetention {
  const verdict = controlerLaRetention(retention);
  if (!verdict.recevable) return verdict;
  try {
    localStorage.setItem(CLE, JSON.stringify(verdict.retention));
  } catch {
    return {
      recevable: false,
      motif: 'Ce navigateur refuse d’enregistrer le réglage ; il vaudra pour cette visite seulement.',
    };
  }
  return verdict;
}

/** Revient au réglage livré : 30 jours puis 180 (décision 7). */
export function retablirLaRetention(): RetentionDuCentre {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* Illisible, donc déjà au défaut à la prochaine lecture. */
  }
  return RETENTION_PAR_DEFAUT;
}
