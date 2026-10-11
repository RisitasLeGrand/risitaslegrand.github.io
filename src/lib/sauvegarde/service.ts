/**
 * Faire, vérifier et restaurer une sauvegarde : la couche qui touche la base.
 *
 * `format.ts` ne connaît que des octets ; ce module-ci connaît IndexedDB, le
 * registre des branches et le mot de passe de la session. La séparation n'est
 * pas de la coquetterie : elle est ce qui permet d'éprouver le format sans
 * navigateur, et de ne jamais avoir à lire du code de chiffrement pour
 * comprendre une erreur de restauration.
 */
import config from '../../../site.config.mjs';
import {
  MAGASINS_PROGRESSION,
  ecrireDerniereSauvegarde,
  exporterMagasins,
  lireDerniereSauvegarde,
  remplacerMagasins,
} from '../db';
import { BRANCHES, ID_BRANCHE_PAR_DEFAUT } from '../branches';
import { PARCOURS } from '../parcours/registre';
import {
  ecrire,
  nomDeFichier,
  relire,
  verifier,
  type BrancheSauvegardee,
  type Relecture,
  type Sauvegarde,
  type Verification,
} from './format';

/** La version de schéma des magasins de Révisions : celle de la base. */
export const SCHEMA_REVISIONS = 12;

/**
 * La déclaration de la branche Révisions pour la sauvegarde.
 *
 * C'est la première inscription au registre de branches que le prompt
 * « stockage » demande en section 3.1 : identifiant, version de schéma, liste
 * de magasins. Odyssée et Sport s'inscriront de la même façon, et le format
 * n'aura pas à changer — il ne connaît aucune liste de magasins.
 */
export function brancheRevisions(): BrancheSauvegardee {
  return {
    id: ID_BRANCHE_PAR_DEFAUT,
    schema: SCHEMA_REVISIONS,
    magasins: [...MAGASINS_PROGRESSION],
  };
}

export interface ResultatSauvegarde {
  sauvegarde: Sauvegarde;
  nom: string;
}

/**
 * Fabrique la sauvegarde.
 *
 * `motDePasse` est celui que la personne vient de saisir, ou `null` si elle a
 * explicitement refusé le chiffrement. Il n'est **ni lu dans la session, ni
 * mémorisé** : la clé de session est dérivée et non réversible, et aller
 * chercher le mot de passe ailleurs qu'auprès de la personne serait la seule
 * façon de le faire fuir par mégarde.
 */
export async function fabriquer(motDePasse: string | null): Promise<ResultatSauvegarde> {
  const magasins = await exporterMagasins();
  const maintenant = new Date();
  const sauvegarde = await ecrire({
    magasins,
    branches: [brancheRevisions()],
    versionApplication: (config as { version?: string }).version ?? 'inconnue',
    portee: {
      branches: BRANCHES.filter((b) => b.disponible).map((b) => b.id),
      parcours: PARCOURS.map((p) => p.id),
    },
    motDePasse,
    maintenant,
  });
  return { sauvegarde, nom: nomDeFichier(maintenant) };
}

/** Note la réussite. À appeler **après** que le fichier est réellement parti. */
export async function noterSauvegardeReussie(quand = new Date()) {
  await ecrireDerniereSauvegarde(quand.toISOString());
  /*
     Et on la déclare comme **fait**, pour que les autres appareils la voient.
     Sans cela, chacun insiste séparément : on sauvegarde deux fois le même
     jour, ou pas du tout en croyant que l'autre l'a fait. L'import est
     dynamique parce que « sync/service » importe la sauvegarde ; à l'exécution,
     ce module est entièrement initialisé.

     Un échec ici n'annule pas la sauvegarde, qui a bien eu lieu : on perdrait
     une ligne de registre pour avoir voulu la noter, ce qui serait absurde.
  */
  try {
    const { declarerSauvegarde } = await import('../sync/service');
    await declarerSauvegarde();
  } catch (erreur) {
    console.warn('Sauvegarde faite, mais non déclarée au registre partagé :', erreur);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Vérification à blanc
   ══════════════════════════════════════════════════════════════════════════ */

export interface Apercu extends Verification {
  /** Total d'enregistrements annoncés par l'en-tête. */
  enregistrements: number;
  /** Magasins que cette version ne connaît pas — conservés, jamais perdus. */
  magasinsInconnus: string[];
}

/**
 * Lit un fichier sans rien appliquer et sans mot de passe.
 *
 * C'est le bouton « Vérifier cette sauvegarde ». Il répond à la seule question
 * qui compte avant d'agir : qu'est-ce que ce fichier, et est-il entier ?
 */
export async function apercu(octets: Uint8Array): Promise<Apercu> {
  const v = await verifier(octets);
  const connus = new Set<string>(MAGASINS_PROGRESSION);
  return {
    ...v,
    enregistrements: Object.values(v.entete.magasins ?? {}).reduce((s, n) => s + n, 0),
    magasinsInconnus: Object.keys(v.entete.magasins ?? {}).filter((nom) => !connus.has(nom)),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Restauration
   ══════════════════════════════════════════════════════════════════════════ */

export interface ResultatRestauration {
  relecture: Relecture;
  ecrits: Record<string, number>;
  /** Magasins du fichier que cette version ne sait pas écrire. */
  inconnus: string[];
  /** L'instantané de sécurité pris juste avant, s'il a été pris. */
  instantane: ResultatSauvegarde | null;
}

export interface OptionsRestauration {
  octets: Uint8Array;
  /** Le mot de passe **du fichier**, qui peut différer de celui du site. */
  motDePasse?: string;
  /**
   * Fabriquer l'instantané de sécurité de l'état actuel avant d'écrire.
   *
   * Vrai par défaut, et il faut un refus explicite pour s'en passer : une
   * restauration écrase tout, et c'est le dernier moment où l'état présent
   * existe encore.
   */
  instantane?: boolean;
  /** Le mot de passe de l'instantané. À défaut, celui du fichier restauré. */
  motDePasseInstantane?: string | null;
}

/**
 * Restaure, en mode « Remplacer ».
 *
 * Il n'y a pas de mode « Fusionner » pour ce format, et ce n'est pas un oubli :
 * fusionner demande de savoir, enregistrement par enregistrement, lequel des
 * deux est le plus récent. Le modèle ne porte pas encore cette date partout, et
 * le prompt dit de ne pas improviser sur ce point. La raison et le traitement
 * proposé sont écrits dans `docs/cyclades/sauvegarde.md`.
 */
export async function restaurer(
  options: OptionsRestauration,
): Promise<ResultatRestauration> {
  // Relire d'abord : si le fichier est refusé, rien n'a été touché.
  const relecture = await relire(options.octets, options.motDePasse);

  let instantane: ResultatSauvegarde | null = null;
  if (options.instantane !== false) {
    const mdp =
      options.motDePasseInstantane === undefined
        ? (options.motDePasse ?? null)
        : options.motDePasseInstantane;
    instantane = await fabriquer(mdp);
  }

  const { ecrits, inconnus } = await remplacerMagasins(relecture.magasins);
  return { relecture, ecrits, inconnus, instantane };
}

/* ══════════════════════════════════════════════════════════════════════════
   Rappel
   ══════════════════════════════════════════════════════════════════════════ */

export type Cadence = 'quotidienne' | 'hebdomadaire' | 'mensuelle';

const DELAIS: Record<Cadence, number> = {
  quotidienne: 1,
  hebdomadaire: 7,
  mensuelle: 30,
};

/** Au-delà de ce délai, le rappel se fait plus net. Jamais bloquant. */
const INSISTANCE_JOURS = 30;

export interface EtatSauvegarde {
  derniere: string | null;
  jours: number | null;
  /** `jamais` quand aucune sauvegarde n'a été faite depuis ce navigateur. */
  etat: 'jamais' | 'recente' | 'a-faire' | 'ancienne';
  message: string;
}

/**
 * Où en est la sauvegarde, en un coup d'œil.
 *
 * Le ton monte avec le temps écoulé, et s'arrête à « ancienne » : aucun écran
 * n'est bloqué, aucune série n'est pénalisée. Le site ne peut pas sauvegarder à
 * la place de la personne — il n'a pas de serveur — et le lui faire payer
 * serait punir une limite qui n'est pas la sienne.
 */
export async function etatSauvegarde(cadence: Cadence = 'hebdomadaire'): Promise<EtatSauvegarde> {
  const derniere = await lireDerniereSauvegarde();
  if (!derniere) {
    return {
      derniere: null,
      jours: null,
      etat: 'jamais',
      message:
        'Aucune sauvegarde depuis ce navigateur. Tout ce que porte Cyclades tient ' +
        'ici : un nettoyage des données de site, un changement d’appareil, et il ' +
        'n’y a aucun recours.',
    };
  }
  const jours = Math.floor((Date.now() - new Date(derniere).getTime()) / 86_400_000);
  if (jours >= INSISTANCE_JOURS) {
    return {
      derniere,
      jours,
      etat: 'ancienne',
      message: `Dernière sauvegarde il y a ${jours} jours. C’est long : rien de ce qui a été fait depuis n’existe ailleurs qu’ici.`,
    };
  }
  if (jours >= DELAIS[cadence]) {
    return {
      derniere,
      jours,
      etat: 'a-faire',
      message: `Dernière sauvegarde il y a ${jours === 0 ? 'moins d’un jour' : `${jours} jour(s)`}.`,
    };
  }
  return {
    derniere,
    jours,
    etat: 'recente',
    message: jours === 0 ? 'Sauvegardé aujourd’hui.' : `Sauvegardé il y a ${jours} jour(s).`,
  };
}
