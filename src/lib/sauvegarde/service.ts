/**
 * Faire, vérifier et restaurer une sauvegarde : la couche qui touche la base.
 *
 * `format.ts` ne connaît que des octets ; ce module-ci connaît IndexedDB, le
 * registre des branches et le mot de passe de la session. La séparation n'est
 * pas de la coquetterie : elle est ce qui permet d'éprouver le format sans
 * navigateur, et de ne jamais avoir à lire du code de chiffrement pour
 * comprendre une erreur de restauration.
 */
import { versionDeLApplication } from '../version';
import {
  MAGASINS_PROGRESSION,
  MAGASINS_SAUVEGARDES,
  magasinsDUneSauvegarde,
  ecrireDerniereSauvegarde,
  exporterMagasins,
  lireDerniereSauvegarde,
  migrerDesDonneesRestaurees,
  remplacerMagasins,
} from '../db';
import { VERSION as VERSION_DE_LA_BASE } from '../db';
import { BRANCHES, ID_BRANCHE_PAR_DEFAUT } from '../branches';
import { PARCOURS } from '../parcours/registre';
import { pluriel } from '../noyau/accords';
import { estScelle } from '../noyau/coffre';
import {
  SauvegardeRefusee,
  ecrire,
  nomDeFichier,
  relire,
  verifier,
  type BrancheSauvegardee,
  type Relecture,
  type Sauvegarde,
  type Verification,
} from './format';
import { verdictDUnFichier, type Verdict } from './politique-de-restauration';

/**
 * La version de schéma des magasins de Révisions : celle de la base.
 *
 * ## Elle était écrite à la main, et elle était fausse de trente et un versions
 *
 * Ce commentaire disait déjà « celle de la base », et la constante valait 12
 * pendant que la base tournait en 43. Un fichier produit aujourd'hui annonçait
 * donc une version qu'il n'avait pas, dans le seul champ dont dépend la
 * lisibilité des magasins restaurés. C'est le constat G-7 du prompt 58, et la
 * mesure l'a trouvé pire que l'audit ne le disait : l'audit comptait 23
 * versions d'écart contre la base en v35, il y en a 31 contre la v43.
 *
 * Elle est donc LUE à la source. Aucune valeur n'est plus à tenir à jour, et
 * le défaut ne peut pas revenir.
 *
 * ## Ce que cela ne corrige pas encore, et qu'il faut dire
 *
 * Le champ est désormais JUSTE ; il n'est toujours pas LU. Mesuré : aucun
 * lecteur de « .schema » dans tout « src/ », alors que le type du format
 * annonce « pour que la restauration sache migrer ». Écrire la vérité était
 * nécessaire et ne suffit pas — la restauration doit encore migrer ou refuser
 * avec un motif, et cette décision-là ne m'appartient pas : un refus mal posé
 * rendrait irrestaurable une sauvegarde légitime.
 */
export const SCHEMA_REVISIONS = VERSION_DE_LA_BASE;

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
    /* Décision 8 du prompt 32 : le centre se recalcule, il ne se sauvegarde pas. */
    magasins: [...MAGASINS_SAUVEGARDES],
  };
}

export interface ResultatSauvegarde {
  sauvegarde: Sauvegarde;
  nom: string;
  /**
   * Tout ce que le fichier porte, scellés COMPRIS.
   *
   * Il ne se déduit plus de l'en-tête : depuis M-2bis, l'en-tête en clair ne
   * compte que les magasins non scellés, et le reçu qui sommait ses valeurs
   * sous-comptait donc — il annonçait à la personne, juste après sa sauvegarde,
   * moins d'enregistrements qu'elle n'en avait réellement enregistré.
   *
   * Se taire dans le FICHIER, qui peut sortir de l'appareil, et se taire DEVANT
   * LA PERSONNE, sur son propre écran, sont deux choses sans rapport. Le second
   * n'est pas de la discrétion, c'est une erreur d'affichage. Le compte se
   * prend donc à la source, avant que l'en-tête ne se taise.
   */
  enregistrements: number;
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
  /*
     LE CYCLE N'ENTRE PAS DANS UN FICHIER EN CLAIR — § 6.9 du prompt 30.

     `motDePasse === null` est le refus explicite du chiffrement, et c'est la
     seule information dont la décision a besoin : le reste
     (`magasinsDUneSauvegarde`, `db.ts`) dit lesquels partent, et pourquoi.

     L'exclusion est ici, dans la fabrique, et non à l'appel : un second
     chemin qui voudrait sauvegarder passerait par la même porte.
  */
  const emportes = magasinsDUneSauvegarde(motDePasse !== null);
  const magasins = await exporterMagasins(emportes);
  /*
     QUELS MAGASINS SONT SCELLÉS — M-2, et c'est ici qu'on le sait.

     `format.ts` est pur : il ne connaît aucune liste de magasins, et importer
     le registre du coffre lui ferait connaître IndexedDB par la bande. C'est
     donc cette couche-ci, qui touche déjà la base, qui le lui dit — comme
     `magasinsDUneSauvegarde` décide déjà de ce qui part.

     Le critère est celui du dépôt, pas un nouveau : un magasin scellé est un
     magasin dont le contenu a été jugé devoir être chiffré. Annoncer son
     compte dans un en-tête en clair revient à dire combien il en contient à
     qui ouvre le fichier dans un éditeur de texte.
  */
  const magasinsScelles = emportes.filter((nom) => estScelle(nom));
  const maintenant = new Date();
  const sauvegarde = await ecrire({
    magasins,
    /*
       La branche déclare ce qu'elle apporte, donc elle déclare la même liste :
       annoncer des magasins que le fichier ne porte pas rendrait l'aperçu de
       restauration faux.

       On la donne ENTIÈRE, scellés compris, et c'est « format.ts » qui retire
       les noms scellés de l'en-tête en clair (M-2bis) à partir de
       `magasinsScelles` ci-dessous. Le filtrage est là-bas et non ici parce que
       « ecrire » a deux appelants — celui-ci et le paquet de synchronisation :
       une règle de confidentialité qui dépend du souvenir de chaque appelant
       tient jusqu'au troisième.
    */
    branches: [{ ...brancheRevisions(), magasins: [...emportes] }],
    magasinsScelles,
    /*
       LA VRAIE VERSION — B4. Cette ligne cherchait un champ `version` dans
       `site.config.mjs`, qui n'en porte aucun : toute sauvegarde annonçait
       donc « inconnue », dans le seul champ qui permette de retrouver le code
       ayant écrit un fichier. Elle est maintenant injectée à l'assemblage.
    */
    versionApplication: versionDeLApplication(),
    portee: {
      branches: BRANCHES.filter((b) => b.disponible).map((b) => b.id),
      parcours: PARCOURS.map((p) => p.id),
    },
    motDePasse,
    maintenant,
  });
  return {
    sauvegarde,
    nom: nomDeFichier(maintenant),
    enregistrements: Object.values(magasins).reduce((somme, v) => somme + v.length, 0),
  };
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
/**
 * Les magasins qu'un fichier porte et que cette version ne sait pas écrire.
 *
 * Une seule définition, parce qu'elle sert à deux moments qui doivent répondre
 * la même chose : la vérification à blanc, sans mot de passe, et la
 * restauration, après déchiffrement. Deux définitions finiraient par diverger
 * exactement le jour où la différence compte.
 *
 * Ces magasins sont CONSERVÉS et jamais perdus — c'est pour cela qu'on les
 * nomme plutôt que de les refuser : un fichier venu d'une version plus récente
 * porte des choses que celle-ci ne comprend pas, et les jeter serait pire que
 * de les laisser dormir.
 */
export function magasinsInconnus(noms: readonly string[]): string[] {
  const connus = new Set<string>(MAGASINS_PROGRESSION);
  return noms.filter((nom) => !connus.has(nom));
}

export async function apercu(octets: Uint8Array): Promise<Apercu> {
  const v = await verifier(octets);
  return {
    ...v,
    enregistrements: Object.values(v.entete.magasins ?? {}).reduce((s, n) => s + n, 0),
    magasinsInconnus: magasinsInconnus(Object.keys(v.entete.magasins ?? {})),
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
  /**
   * Ce que la politique de `.schema` a décidé, pour que l'écran puisse le dire.
   *
   * Rendu même quand il n'y a rien à signaler : un appelant qui lit
   * `verdict.dire` et le trouve `null` sait qu'il n'a rien à afficher, là où
   * une absence de champ l'obligerait à deviner.
   */
  verdict: Verdict;
  /**
   * Les magasins qui ont traversé les paliers, s'il y en a eu.
   *
   * Vide quand rien n'était à migrer. Il est rendu pour que l'écran puisse le
   * dire et, surtout, pour qu'un essai puisse le CONSTATER : sans cela, une
   * migration qui ne ferait rien ressemblerait en tout point à une migration
   * réussie.
   */
  traverses: string[];
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

  /*
     LE VERDICT DU `.schema`, ET IL PASSE AVANT TOUT LE RESTE — y compris avant
     l'instantané de sécurité.

     Ce module portait l'aveu de ce manque : « le champ est désormais JUSTE ; il
     n'est toujours pas LU. Mesuré : aucun lecteur de ".schema" dans tout
     "src/" ». Une sauvegarde d'une version plus récente était donc écrite par
     dessus la base sans un mot, avec des enregistrements dont un champ peut
     avoir changé de SENS sans changer de nom.

     L'ordre compte à deux titres. D'abord parce qu'un refus doit laisser la
     base intacte : il tombe donc avant `remplacerMagasins`, et l'instantané
     lui-même — qui ne fait que lire, mais qui écrit un fichier et prend du
     temps — n'a aucune raison d'être fabriqué pour une restauration qui
     n'aura pas lieu. Ensuite parce que le motif doit désigner LE problème : un
     fichier refusé ici est parfaitement lisible, et le dire « abîmé » ou
     « illisible » enverrait chercher une panne qui n'existe pas.
  */
  const verdict = verdictDUnFichier(
    (relecture.entete.branches ?? []).map((b) => (typeof b.schema === 'number' ? b.schema : null)),
    VERSION_DE_LA_BASE,
  );
  if (verdict.quoi === 'refus') {
    throw new SauvegardeRefusee(verdict.motif, verdict.dire, relecture.entete);
  }

  /*
     LES MAGASINS INCONNUS SE COMPTENT ICI, ET NON DANS L'ÉCRITURE — M-2bis (b).

     Ils se lisaient dans le retour de `remplacerMagasins`, c'est-à-dire APRÈS
     que tout a été écrit. Tant que l'en-tête en clair les annonçait tous, cela
     ne coûtait rien : « Vérifier cette sauvegarde » les nommait avant qu'on
     touche à quoi que ce soit, sans mot de passe.

     Depuis M-2bis l'en-tête ne nomme plus les magasins scellés. Un magasin
     SCELLÉ et inconnu — ce que porterait une sauvegarde venue d'une version
     plus récente — devenait donc invisible jusqu'à ce que l'écriture soit
     faite. L'arbitrage gagnait en confidentialité ce qu'il perdait en sûreté de
     restauration, et ce n'est pas l'échange qui avait été demandé.

     On les compte donc sur la charge utile DÉCHIFFRÉE, avant l'instantané et
     avant l'écriture. La valeur ne vient plus de l'écriture : elle ne peut donc
     plus dépendre de son issue.
  */
  const inconnus = magasinsInconnus(Object.keys(relecture.magasins));

  let instantane: ResultatSauvegarde | null = null;
  if (options.instantane !== false) {
    const mdp =
      options.motDePasseInstantane === undefined
        ? (options.motDePasse ?? null)
        : options.motDePasseInstantane;
    instantane = await fabriquer(mdp);
  }

  /*
     LA MISE À LA FORME COURANTE, BRANCHE PAR BRANCHE.

     Chaque branche déclare SA version de schéma et SES magasins. Les migrer
     ensemble, à la plus ancienne des versions, ferait traverser à une branche
     déjà à jour des paliers qu'elle a déjà vus — et deux d'entre eux ne
     supportent pas une seconde passe : le douzième dédoublerait les socles de
     révision, le treizième réécrirait des clés déjà stables.

     On migre donc chaque branche avec ses propres magasins, à sa propre
     version. C'est correct pour une branche comme pour dix, et le format en
     prévoit plusieurs même si une seule est écrite aujourd'hui.

     Les magasins qu'aucune branche ne revendique passent tels quels. Les
     transformer au nom d'une version qui n'est pas la leur serait deviner.
  */
  let magasins = relecture.magasins;
  let traverses: string[] = [];
  if (verdict.paliers.length > 0) {
    for (const branche of relecture.entete.branches ?? []) {
      if (typeof branche.schema !== 'number' || branche.schema >= VERSION_DE_LA_BASE) continue;
      const siens: Record<string, unknown[]> = {};
      for (const nom of branche.magasins ?? []) {
        if (Array.isArray(magasins[nom])) siens[nom] = magasins[nom];
      }
      if (Object.keys(siens).length === 0) continue;
      const migres = await migrerDesDonneesRestaurees(siens, branche.schema);
      magasins = { ...magasins, ...migres.magasins };
      traverses = [...new Set([...traverses, ...migres.traverses])];
    }
  }

  /*
     ET « inconnus » NE VIENT PLUS D'ICI : il a été compté plus haut, sur la
     charge déchiffrée, avant l'instantané et avant l'écriture (M-2bis (b) de
     b-cyclades-v2). On passe donc les magasins MIGRÉS à l'écriture — c'est le
     point de b-politique-schema — et l'on ignore le « inconnus » qu'elle
     renvoie, qui dirait la même chose mais après coup. Les deux apports
     tiennent ensemble : le comptage ne dépend plus de l'issue de l'écriture, et
     l'écriture reçoit bien les données mises à la forme courante.
  */
  const { ecrits } = await remplacerMagasins(magasins);
  return { relecture, ecrits, inconnus, instantane, verdict, traverses };
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
      message:
        `Dernière sauvegarde il y a ${pluriel(jours, 'jour')}. C’est long : rien ` +
        'de ce qui a été fait depuis n’existe ailleurs qu’ici.',
    };
  }
  if (jours >= DELAIS[cadence]) {
    return {
      derniere,
      jours,
      etat: 'a-faire',
      /*
         « jour(s) » DISAIT LES DEUX ET N'EN CHOISISSAIT AUCUN. La règle G le
         proscrit, et pas par goût : une parenthèse se lit à voix haute par un
         lecteur d'écran, qui dit « jour parenthèse s parenthèse ».
      */
      message: `Dernière sauvegarde il y a ${jours === 0 ? 'moins d’un jour' : pluriel(jours, 'jour')}.`,
    };
  }
  return {
    derniere,
    jours,
    etat: 'recente',
    message:
      jours === 0 ? 'Sauvegardé aujourd’hui.' : `Sauvegardé il y a ${pluriel(jours, 'jour')}.`,
  };
}
