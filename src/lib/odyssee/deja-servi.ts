/**
 * Ce qui a déjà été servi, et qu'on ne repose donc pas.
 *
 * ## Le risque de ce module, et il est silencieux
 *
 * Un fait mal reconnu ferait **disparaître une question qu'il fallait
 * poser**, et rien à l'écran ne le signalerait. Une revue qui ne demande
 * rien parce qu'elle croit à tort que tout est fait est pire qu'une revue
 * qui redemande : la seconde agace, la première ment.
 *
 * Deux choix en découlent.
 *
 * **Logique pure, sur une liste de faits.** Aucune lecture de base ici :
 * l'appelant fournit les faits du jour visé, ce module décide. C'est ce qui
 * permet de l'éprouver dans les deux sens sans navigateur — le fait présent
 * ne doit pas être redemandé, et le fait **absent** doit l'être.
 *
 * **Une liste explicite, jamais un motif.** Reconnaître « tout ce qui
 * commence par `sport.` » ferait entrer demain un type qu'on n'a pas examiné.
 * Chaque entrée est déclarée, avec ce qu'elle prouve.
 *
 * ## Ce qui n'est pas consulté, et pourquoi
 *
 * - `revision.fiche`, `revision.niveau`, `revision.retention`,
 *   `revision.cog-training` : **états dérivés**, pas des actes de la journée.
 *   Les afficher comme « déjà fait » serait un contresens.
 * - `sport.serie`, `sport.record`, `sport.phase` : détail interne d'une
 *   séance ou état de programme ; la séance les résume.
 * - `odyssee.usage`, `odyssee.passation`, `odyssee.interaction` : télémétrie.
 *   Les afficher reviendrait à dire à la personne ce qu'elle a cliqué.
 * - `odyssee.operation`, `odyssee.valorisation` : une opération bancaire
 *   n'est pas une chose « servie » dans une revue de journée.
 * - `odyssee.sante`, `odyssee.apport-externe`, `odyssee.charge-percue` :
 *   relèvent du lot Santé, non construit.
 *
 * ## Le coffre
 *
 * `odyssee.medicament` et `odyssee.statut-hormonal` n'entrent que **coffre
 * ouvert**, comme l'interdit 1 du prompt 36 le demande. Coffre fermé, ils
 * n'apparaissent pas — et comme aucune question ne porte sur eux, leur
 * absence ne fait taire aucune question.
 */
import type { Fait } from '../noyau/faits';

export interface LigneServie {
  /** Le type de fait qui l'a produite. Sert au contrôle, pas à l'affichage. */
  type: string;
  /** Ce que l'écran montre : « Séance de sport — enregistrée à 18 h 10 ». */
  libelle: string;
}

interface Reconnue {
  type: string;
  /** Au singulier, tel qu'il paraît sur la ligne. */
  quoi: string;
  /** Plusieurs faits du même type se résument-ils en une ligne comptée ? */
  compte?: boolean;
}

/**
 * Les types reconnus, déclarés un par un.
 *
 * L'ordre est celui de l'affichage : ce qui engage le corps d'abord, le
 * travail ensuite, le reste après. Aucune règle profonde là-dedans, mais une
 * liste stable vaut mieux qu'un ordre qui dépend de l'ordre des faits.
 */
export const RECONNUS: readonly Reconnue[] = [
  { type: 'sport.seance', quoi: 'Séance de sport' },
  { type: 'sport.blessure', quoi: 'Blessure déclarée' },
  { type: 'odyssee.sommeil', quoi: 'Nuit renseignée' },
  { type: 'odyssee.poids', quoi: 'Pesée' },
  { type: 'odyssee.mesure', quoi: 'Mesure' },
  { type: 'odyssee.repas', quoi: 'Repas noté', compte: true },
  { type: 'odyssee.hydratation', quoi: 'Hydratation notée', compte: true },
  { type: 'odyssee.checkin', quoi: 'Humeur et énergie saisies' },
  { type: 'odyssee.journal', quoi: 'Note de journal' },
  { type: 'odyssee.medicament', quoi: 'Prise déclarée', compte: true },
  { type: 'odyssee.statut-hormonal', quoi: 'Statut déclaré' },
  { type: 'revision.seance', quoi: 'Séance de révision', compte: true },
  { type: 'revision.flashcards', quoi: 'Cartes revues', compte: true },
  { type: 'revision.qcm', quoi: 'QCM passé', compte: true },
  { type: 'revision.pretest', quoi: 'Prétest fait', compte: true },
  { type: 'revision.note-seance', quoi: 'Séance déjà notée' },
  { type: 'odyssee.focus', quoi: 'Séance de concentration', compte: true },
  { type: 'odyssee.tache', quoi: 'Tâche close', compte: true },
  { type: 'odyssee.quete', quoi: 'Quête avancée', compte: true },
];

const TYPES_RECONNUS = new Set(RECONNUS.map((r) => r.type));

/** L'heure d'un fait, « 18 h 10 », ou rien si son début n'est pas lisible. */
function heure(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Ce qui est déjà servi pour ce jour, à partir des faits de toutes les
 * branches.
 *
 * Ne retient que les faits **du jour visé** : un fait de la veille ne doit
 * pas faire taire la question d'aujourd'hui, et c'est l'erreur la plus facile
 * à commettre en mode matin, où le jour visé n'est pas le jour courant.
 */
export function dejaServi(faits: readonly Fait[], jour: string): LigneServie[] {
  const duJour = faits.filter((f) => f.jourLogique === jour && TYPES_RECONNUS.has(f.type));
  const lignes: LigneServie[] = [];

  for (const reconnue of RECONNUS) {
    const siens = duJour.filter((f) => f.type === reconnue.type);
    if (!siens.length) continue;

    if (reconnue.compte && siens.length > 1) {
      lignes.push({ type: reconnue.type, libelle: `${reconnue.quoi} — ${siens.length} fois` });
      continue;
    }
    const quand = heure(siens[0].debut);
    lignes.push({
      type: reconnue.type,
      libelle: quand ? `${reconnue.quoi} — enregistrée à ${quand}` : reconnue.quoi,
    });
  }

  return lignes;
}

/**
 * Les types reconnus mais **absents** ce jour-là.
 *
 * Existe pour le contrôle, et c'est délibéré : prouver qu'une question
 * disparaît quand le fait est là ne vaut rien sans prouver qu'elle reste
 * quand il n'y est pas. C'est le sens même du défaut silencieux que ce module
 * peut produire.
 */
export function pasEncoreServi(faits: readonly Fait[], jour: string): string[] {
  const servis = new Set(dejaServi(faits, jour).map((l) => l.type));
  return RECONNUS.map((r) => r.type).filter((t) => !servis.has(t));
}
