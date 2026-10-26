/**
 * L'intention d'une action annulable, écrite avant d'être exécutée (M6, 0.2).
 *
 * ## Le défaut que ce module corrige, et il était mesuré
 *
 * Le bandeau d'annulation RETARDE l'écriture au lieu de la défaire : rien
 * n'est détruit avant la fin du délai, donc rien ne peut être mal
 * reconstruit. Le prix de ce choix est écrit depuis le début en tête de
 * `src/lib/annulation.ts` : « il faut tenir la promesse si l'on quitte —
 * fermer l'onglet ou changer d'écran pendant le délai exécute l'action tout de
 * suite, plutôt que de la perdre. C'est ce que fait `pagehide`. »
 *
 * **La promesse n'était pas tenue.** Mesuré le 25 octobre : on supprime une
 * séance, on change d'écran dans les six secondes, on revient — la séance est
 * là. Une sonde a montré que `pagehide` part bien et que l'action est bien
 * lancée ; ce qui manque est le TEMPS. La suppression est une transaction
 * IndexedDB, et la navigation démonte la page avant qu'elle n'aboutisse. La
 * promesse n'était pas mal câblée : elle était impossible à tenir ainsi.
 *
 * ## Le remède, arbitré le 25 octobre
 *
 * On n'écrit plus l'action à l'échéance : on écrit l'INTENTION au clic, puis
 * on l'exécute. L'écriture de l'intention prend quelques millisecondes, pas
 * six secondes : au moment où quelqu'un quitte l'écran, elle est déjà en
 * base. Au démarrage suivant, une intention restée là est appliquée — même si
 * son échéance n'est pas passée, parce que quitter vaut exécuter.
 *
 * `pagehide` reste en place, en meilleur effort, mais ne garantit plus rien.
 *
 * ## Pourquoi un module pur, hors de la base
 *
 * Ce qui est délicat ici n'est pas d'écrire l'enregistrement : c'est de
 * décider, au démarrage, si ce qu'on a gardé est **rejouable**. Une intention
 * dont le genre a disparu du registre, une charge abîmée par une version
 * antérieure, un enregistrement sans échéance : chacun de ces cas doit se
 * trancher sans navigateur et sans base, donc ici.
 *
 * ## Ce que l'enregistrement NE DOIT PAS porter en clair
 *
 * Le magasin est scellé, et une clé primaire ne peut pas l'être — c'est dit
 * dans `noyau/coffre.ts`, et le reconnaître vaut mieux que de l'oublier.
 * L'identifiant est donc **opaque** : il ne dit ni le genre de l'action, ni sa
 * cible. Sans cette précaution, un `getAllKeys` sans mot de passe dirait
 * « une prise de médicament a été notée », ce qui est exactement la donnée que
 * la décision 3 scelle.
 *
 * Ce qui reste lisible malgré tout, et qu'on ne peut pas cacher : qu'une
 * action est en attente, et depuis quand. C'est modeste, et c'est dit.
 */

/**
 * Les genres d'action qu'une intention peut porter.
 *
 * La liste est fermée exprès. Un genre écrit à la main dans un écran et
 * absent du registre produirait une intention qu'on ne saurait plus
 * appliquer : elle resterait en base, et l'action serait perdue en silence —
 * c'est-à-dire le défaut qu'on est en train de corriger, déplacé d'un cran.
 * `essais:annulation:navigateur` rapproche cette liste du registre.
 */
export const GENRES_D_INTENTION = ['supprimer-seance', 'noter-creneau'] as const;

export type GenreDIntention = (typeof GENRES_D_INTENTION)[number];

/**
 * Les genres dont la charge ne doit JAMAIS être écrite en clair.
 *
 * ## Pourquoi tous les genres ne sont pas dans cette liste
 *
 * Mesuré le 26 octobre, et c'est la mesure qui a corrigé ma conception : sur
 * « /sport/seance/ », le coffre est FERMÉ — « Le coffre est fermé :
 * l'intention ne peut pas être scellée », relevé en console. Exiger le
 * scellement pour toute intention revenait donc à ne jamais écrire celle de
 * la suppression de séance, c'est-à-dire à ne pas corriger le défaut que ce
 * lot corrige.
 *
 * La frontière juste n'est pas « toutes les intentions » : c'est celle que le
 * dépôt pose déjà magasin par magasin. `sportSeances` n'est pas scellé —
 * « j'ai supprimé une séance de sport » ne demande pas le coffre pour être
 * lu, puisque la séance elle-même ne le demande pas. Les magasins de santé le
 * sont, et une intention qui dit « noter une prise » révèle un traitement :
 * elle est aussi sensible que ce qu'elle vise.
 *
 * Une intention sensible écrite coffre fermé est donc REFUSÉE, et non écrite
 * en clair. En pratique l'écran de santé l'a ouvert — c'est lui qui le
 * demande —, donc le refus ne se produit pas ; s'il se produisait, le
 * comportement d'avant ce lot s'applique, et il est dit en console.
 */
export const GENRES_SENSIBLES: readonly GenreDIntention[] = ['noter-creneau'];

export interface AnnulationEnAttente {
  /**
   * Un identifiant OPAQUE, en clair parce qu'il est la clé primaire.
   *
   * Il ne dit rien de l'action : voir l'en-tête de ce module.
   */
  id: string;
  /** Le genre d'action, pour retrouver l'appliqueur. Scellé. */
  genre: GenreDIntention;
  /** Ce dont l'appliqueur a besoin, sérialisable. Scellé. */
  charge: unknown;
  /** Quand l'action devait partir d'elle-même. Scellé. */
  echeanceLe: string;
  /** Quand l'intention a été posée. C'est le champ de date du magasin. */
  le: string;
  /** Dernière écriture, comme les autres magasins scellés. */
  majLe: string;
}

/**
 * Cette intention est-elle rejouable ?
 *
 * `null` quand elle l'est ; sinon la raison, en français, pour qu'un journal
 * de démarrage puisse la dire au lieu de l'avaler.
 *
 * On ne contrôle PAS la charge : son contenu dépend du genre, et c'est à
 * l'appliqueur de la refuser s'il ne la reconnaît pas. Contrôler ici
 * obligerait ce module pur à connaître tous les genres, c'est-à-dire à
 * importer les écrans — exactement ce qu'il évite.
 */
export function pourquoiNonRejouable(valeur: unknown): string | null {
  if (!valeur || typeof valeur !== 'object') return 'l’enregistrement n’est pas un objet';
  const x = valeur as Partial<AnnulationEnAttente>;
  if (typeof x.id !== 'string' || x.id.length === 0) return 'il n’a pas d’identifiant';
  if (typeof x.genre !== 'string') return 'il n’a pas de genre';
  if (!(GENRES_D_INTENTION as readonly string[]).includes(x.genre)) {
    return `son genre « ${x.genre} » n’est plus connu du registre`;
  }
  if (typeof x.echeanceLe !== 'string' || Number.isNaN(Date.parse(x.echeanceLe))) {
    return 'son échéance est illisible';
  }
  return null;
}

/**
 * Un identifiant opaque pour une intention.
 *
 * `crypto.randomUUID` quand il existe, et une repli lisible sinon : ce module
 * est importé par des essais qui tournent hors navigateur, et une exception à
 * l'import y serait une panne sans rapport avec ce qu'ils mesurent.
 *
 * Pas d'ULID, et ce n'est pas un détail de goût : un ULID porte son horodatage
 * dans ses premiers caractères, donc dans la clé, donc EN CLAIR. L'instant où
 * une action a été posée se lirait sans mot de passe, et pour une prise notée
 * à 8 h chaque matin, l'instant est une partie de l'information.
 */
export function unIdentifiantDIntention(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const octets = c.getRandomValues(new Uint8Array(16));
    return [...octets].map((o) => o.toString(16).padStart(2, '0')).join('');
  }
  /* Dernier recours, et il ne sert qu'aux essais purs : jamais en base. */
  return `sans-hasard-${Math.random().toString(16).slice(2)}`;
}
