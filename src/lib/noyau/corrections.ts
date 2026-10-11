/**
 * La notification de correction : ce qu'on fait d'un conflit qu'on a montré.
 *
 * Le moteur de fusion détecte les conflits et ne les résout jamais — c'est la
 * promesse centrale du chantier : « aucune valeur ne sera écrasée ». Mais un
 * conflit qu'on ne peut pas trancher reste un conflit pour toujours, et une
 * liste qui s'allonge sans qu'on puisse y répondre apprend à ne plus la lire.
 * Ce module est la réponse.
 *
 * ## Une résolution est un fait, donc elle voyage
 *
 * C'est la décision qui compte ici. Trancher un conflit sur l'ordinateur et le
 * retrouver ouvert sur le téléphone serait épuisant et, plus grave,
 * inexplicable : on aurait répondu, et la question reviendrait. La résolution
 * est donc une **opération** comme une autre — union par identifiant, ordre
 * total, idempotence — et elle se propage à la première synchronisation.
 *
 * ## Elle nomme ce qu'elle a vu
 *
 * Une résolution porte la liste des opérations qu'elle tranchait. Si une
 * **troisième** valeur arrive plus tard du même objet, le conflit se rouvre :
 * la réponse donnée ne portait pas sur elle. C'est ce qui distingue « j'ai
 * répondu à cette question » de « je ne veux plus voir cet objet », et seule la
 * première est honnête.
 *
 * ## Les quatre issues, et pourquoi quatre
 *
 * Garder l'une, garder l'autre : les deux cas fréquents, en premier.
 * « Les deux sont justes » : deux pesées dans la même journée ne sont pas un
 * désaccord, et forcer un choix fabriquerait une fausse donnée.
 * « Ignorer » : on ne sait pas, on ne veut pas trancher maintenant, et le dire
 * vaut mieux que laisser la question ouverte en faisant semblant de l'avoir
 * vue. Les deux dernières demandent une précision, parce qu'une issue sans
 * motif ne s'explique plus six mois après.
 */
import type { Conflit } from './fusion';
import type { Operation } from './operations';

/** Le type de fait qui tranche un conflit. */
export const TYPE_RESOLUTION = 'conflit.resolu';

export type Issue =
  /** Une des valeurs est la bonne ; les autres sont fausses. */
  | 'retenue'
  /** Toutes sont justes : ce n'était pas un désaccord. */
  | 'toutes-justes'
  /** On ne tranche pas, et on dit pourquoi. */
  | 'ignore';

export interface ChargeResolution {
  /** Le type de fait en conflit, pour que la résolution se relise seule. */
  typeEnConflit: string;
  issue: Issue;
  /** L'opération retenue, pour l'issue « retenue ». */
  retenue?: string;
  /** Les identifiants des opérations que cette réponse couvrait. */
  couvre: string[];
  /** La précision demandée pour « toutes justes » et le motif pour « ignoré ». */
  precision?: string;
}

export interface Resolution extends ChargeResolution {
  /** L'identifiant de l'opération de résolution. */
  id: string;
  /** L'objet tranché. */
  cible: string;
  appareil: string;
  hlc: string;
}

/** Lit les résolutions d'un journal. */
export function resolutions(operations: readonly Operation[]): Resolution[] {
  const sortie: Resolution[] = [];
  for (const op of operations) {
    if (op.type !== TYPE_RESOLUTION) continue;
    const charge = op.charge as Partial<ChargeResolution> | undefined;
    if (!charge?.issue || !Array.isArray(charge.couvre)) continue;
    sortie.push({
      id: op.id,
      cible: op.cible,
      appareil: op.appareil,
      hlc: op.hlc,
      typeEnConflit: typeof charge.typeEnConflit === 'string' ? charge.typeEnConflit : '',
      issue: charge.issue,
      retenue: typeof charge.retenue === 'string' ? charge.retenue : undefined,
      couvre: charge.couvre.filter((x): x is string => typeof x === 'string'),
      precision: typeof charge.precision === 'string' ? charge.precision : undefined,
    });
  }
  return sortie;
}

export interface ConflitOuvert extends Conflit {
  /**
   * La résolution qui le tranchait partiellement, s'il y en a une.
   *
   * Non nul veut dire : on avait répondu, et une valeur nouvelle est arrivée
   * depuis. L'écran doit le dire — « vous avez déjà répondu à une partie de
   * cette question » — plutôt que de présenter un conflit neuf.
   */
  repondueAvant?: Resolution;
}

export interface Tri {
  ouverts: ConflitOuvert[];
  /** Les conflits entièrement tranchés, avec leur réponse. */
  tranches: { conflit: Conflit; resolution: Resolution }[];
}

/**
 * Sépare les conflits ouverts de ceux qui sont tranchés.
 *
 * Un conflit est tranché si **toutes** ses opérations actuelles sont couvertes
 * par une résolution. Partiellement couvert, il est ouvert — et porte la
 * réponse précédente, pour que l'écran puisse le dire.
 */
export function trier(conflits: readonly Conflit[], journal: readonly Operation[]): Tri {
  const parCible = new Map<string, Resolution[]>();
  for (const resolution of resolutions(journal)) {
    const clef = `${resolution.typeEnConflit}\u0000${resolution.cible}`;
    const groupe = parCible.get(clef);
    if (groupe) groupe.push(resolution);
    else parCible.set(clef, [resolution]);
  }

  const ouverts: ConflitOuvert[] = [];
  const tranches: { conflit: Conflit; resolution: Resolution }[] = [];

  for (const conflit of conflits) {
    const candidates = parCible.get(`${conflit.type}\u0000${conflit.cible}`) ?? [];
    // La plus récente d'abord : si plusieurs réponses existent, c'est la
    // dernière qui vaut, comme pour un réglage.
    const ordonnees = [...candidates].sort((a, b) =>
      a.hlc !== b.hlc ? (a.hlc > b.hlc ? -1 : 1) : a.id > b.id ? -1 : 1,
    );
    const ids = new Set(conflit.operations.map((o) => o.id));
    const complete = ordonnees.find((r) => [...ids].every((id) => r.couvre.includes(id)));
    if (complete) {
      tranches.push({ conflit, resolution: complete });
      continue;
    }
    ouverts.push({ ...conflit, repondueAvant: ordonnees[0] });
  }
  return { ouverts, tranches };
}

/**
 * La valeur à afficher en attendant, et ce qu'il faut en dire.
 *
 * Tant qu'un conflit est ouvert, on montre la plus récente **marquée à
 * vérifier**. Ne rien montrer serait pire : la personne a bien pesé quelque
 * chose, et effacer la donnée pour cause de désaccord la punirait d'avoir deux
 * appareils. Montrer sans marquer serait un mensonge par omission.
 */
export interface Provisoire {
  operation: Operation;
  fiable: false;
  motif: string;
}

export function provisoire(conflit: ConflitOuvert): Provisoire {
  return {
    operation: conflit.provisoire,
    fiable: false,
    motif:
      `Deux valeurs existent pour cet objet, saisies sur des appareils différents. ` +
      `La plus récente est affichée en attendant votre réponse.`,
  };
}

/**
 * La charge d'une résolution, construite et **validée**.
 *
 * Elle lève plutôt que de produire une résolution incomplète : une issue
 * « retenue » sans valeur retenue, ou un « ignoré » sans motif, se relirait
 * comme un bruit six mois plus tard, et c'est exactement le moment où on la
 * relit.
 */
export function construireResolution(
  conflit: Conflit,
  choix: { issue: Issue; retenue?: string; precision?: string },
): ChargeResolution {
  const ids = conflit.operations.map((o) => o.id);
  if (choix.issue === 'retenue') {
    if (!choix.retenue || !ids.includes(choix.retenue)) {
      throw new Error(
        'Pour retenir une valeur, il faut dire laquelle, et elle doit faire partie du conflit.',
      );
    }
  } else if (!choix.precision?.trim()) {
    throw new Error(
      choix.issue === 'toutes-justes'
        ? 'Dites en quoi les deux sont justes — deux pesées dans la journée, par exemple : ' +
          'une réponse sans explication ne se relit pas.'
        : 'Dites pourquoi vous ne tranchez pas : sans motif, cette question reviendra sans ' +
          'qu’on sache qu’elle a été vue.',
    );
  }
  return {
    typeEnConflit: conflit.type,
    issue: choix.issue,
    retenue: choix.issue === 'retenue' ? choix.retenue : undefined,
    couvre: ids,
    precision: choix.precision?.trim() || undefined,
  };
}
