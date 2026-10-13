/**
 * « Quelque chose vient d'être écrit » — regroupé, jamais à chaque frappe.
 *
 * ## Le besoin
 *
 * La veille de synchronisation échangeait à l'ouverture d'une page, puis
 * toutes les cinq minutes. Une carte notée juste après un échange attendait
 * donc cinq minutes avant de partir, et c'est le genre de latence qui fait
 * qu'on finit par appuyer sur le bouton — ce que 0.4 ter demande justement
 * d'éviter.
 *
 * ## Pourquoi un signal, et pas une surveillance
 *
 * On aurait pu recalculer l'empreinte d'état à intervalle court. L'empreinte
 * lit les deux journaux en entier : la mesure du budget de stockage donne
 * 259 ms pour un seul balayage de magasin sur cinq ans de données. La
 * recalculer toutes les dix secondes serait payer en permanence pour une
 * information que le code d'écriture connaît gratuitement.
 *
 * ## Deux garde-fous, et le second est le plus important
 *
 * 1. **Le regroupement** : on attend que les écritures se taisent. Une séance
 *    de flashcards écrit toutes les quelques secondes ; signaler chacune
 *    vaudrait signaler en continu.
 * 2. **Le plancher** : même regroupé, un signal ne peut pas déclencher un
 *    échange plus souvent que toutes les deux minutes. Un échange coûte deux
 *    dérivations PBKDF2 de 600 000 itérations ; c'est le prix que
 *    `arriere-plan.ts` refusait déjà de payer toutes les cinq minutes pour
 *    rien, et ce module n'a pas le droit de le payer plus souvent. Le
 *    plancher est tenu par l'abonné, qui seul sait quand il a échangé.
 *
 * Ce module ne connaît ni la synchronisation, ni la base, ni le réseau. Il
 * est importé par `db.ts`, qui est chargé sur toutes les pages : il doit donc
 * rester sans dépendance et sans effet tant que personne ne s'y abonne.
 */

/** Le silence à attendre avant de considérer qu'une rafale d'écritures est finie. */
export const REGROUPEMENT_MS = 20_000;

type Auditeur = () => void;

const auditeurs = new Set<Auditeur>();
let minuteur: ReturnType<typeof setTimeout> | null = null;

/**
 * Signale une écriture qui mérite d'être propagée.
 *
 * Appelée par les deux écritures de journal — opérations et révisions —, qui
 * sont exactement ce que l'empreinte d'état couvre et ce qu'un paquet
 * transporte. Écrire un état dérivé n'appelle pas ce signal : un état dérivé
 * n'est jamais fusionné, et le propager serait l'erreur que le moteur de
 * fusion refuse par ailleurs.
 */
export function signalerEcriture(): void {
  if (!auditeurs.size) return;
  if (minuteur) clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    minuteur = null;
    for (const a of [...auditeurs]) {
      try {
        a();
      } catch {
        // Un abonné qui tombe n'empêche pas les autres d'être prévenus.
      }
    }
  }, REGROUPEMENT_MS);
  /*
     Ne pas retenir le processus : en Node — les essais, les scripts — un
     minuteur en attente empêcherait la sortie. Dans un navigateur, `unref`
     n'existe pas et l'appel est sans effet.
  */
  (minuteur as unknown as { unref?: () => void }).unref?.();
}

/** S'abonne aux écritures regroupées. Rend la fonction de désabonnement. */
export function surEcritureRegroupee(auditeur: Auditeur): () => void {
  auditeurs.add(auditeur);
  return () => auditeurs.delete(auditeur);
}

/** Pour les essais : annule une rafale en attente. */
export function oublierLesEcritures(): void {
  if (minuteur) clearTimeout(minuteur);
  minuteur = null;
}
