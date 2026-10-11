/**
 * La synchronisation, côté base : lire, fabriquer, fusionner, recalculer.
 *
 * Le moteur (`noyau/fusion.ts`) est pur et ne touche à rien. Ce module est la
 * couche impure : il lit IndexedDB, chiffre, écrit, et recalcule les états
 * dérivés. La séparation n'est pas une élégance d'architecture — c'est ce qui
 * permet d'éprouver 35 propriétés sur le moteur sans navigateur, et de ne
 * garder ici que ce qu'un essai en navigateur doit couvrir.
 *
 * ## Les deux journaux
 *
 * `operations` et `revisions`. Le second est né avant le premier (phase 1b) et
 * porte un index par carte, qui rend le recalcul FSRS bon marché. Depuis la
 * version 14, les deux sont **journalisables** au même sens : même règle de
 * fusion, même ordre total, même notion de lot. Il n'y a donc qu'une règle, pas
 * deux.
 *
 * ## Ce qui n'est pas encore synchronisé, et qu'il faut dire
 *
 * Les réglages existants — rotation hebdomadaire, plafonds de session, parcours
 * courant — vivent dans le magasin `etat` sous forme d'objets simples, sans
 * horloge par champ. Ils ne sont **pas** transportés par un paquet : le registre
 * versionné (`etat.reglagesSync`) existe et se fusionne correctement, mais rien
 * n'écrit encore dedans. Les y faire passer est un travail de la phase 4, écrit
 * ici pour qu'on ne le découvre pas en constatant qu'une rotation ne suit pas.
 *
 * Ce que le transport manuel éprouve dès maintenant, c'est ce qui compte le
 * plus : les faits, les révisions, et le recalcul de l'état FSRS.
 */
import { db, ecrireCarte, ecrireReglageBrut, lireAppareil } from '../db';
import type { EntreeRevision } from '../noyau/revisions';
import type { Operation } from '../noyau/operations';
import {
  annulerLot,
  conflits,
  fusionner,
  TYPE_SUPPRESSION,
  type Conflit,
  type Reglages,
} from '../noyau/fusion';
import {
  construireResolution,
  trier,
  TYPE_RESOLUTION,
  type Issue,
  type Tri,
} from '../noyau/corrections';
import { normaliserJournal } from '../noyau/fusion';
import { empreinte, empreinteLisible } from '../noyau/empreinte';
import { ulid } from '../noyau/ulid';
import { operation, SANS_LOT } from '../noyau/operations';
import { decoderHlc } from '../noyau/hlc';
import {
  appareilsConnus,
  detenuParAppareil,
  noterObservation,
  observationDe,
  sauvegardesDeclarees,
  TYPE_NOM_APPAREIL,
  TYPE_RETRAIT,
  TYPE_SAUVEGARDE,
  type AppareilConnu,
  type SauvegardeDeclaree,
} from './appareils';
import {
  bornePartagee,
  compactagesDeclares,
  horsPerimetre,
  perimetre,
  planifier,
  TYPE_COMPACTION,
  CIBLE_COMPACTION,
  vide as planVide,
  type Borne,
  type Plan,
} from './compaction';
import { recalculerCarte } from '../srs';
import { absorberHlc, horlogeCourante, prochaineHlc } from './horloge-locale';
import {
  diagnostiquer,
  fusionnable,
  MARCHE_A_SUIVRE,
  type Diagnostic,
} from './premiere-fusion';
import {
  apercu as apercuPaquetBrut,
  BORNE_BASSE,
  fabriquer,
  nomDeFichier,
  ouvrir,
  tranche,
  type Apercu,
} from './paquet';
import type { Octets } from '../sauvegarde/format';

const CLEF_REGLAGES = 'reglagesSync';
const CLEF_LOTS = 'lotsRecus';

/** Un lot de fusion reçu, gardé pour pouvoir l'annuler. */
export interface LotRecu {
  lot: string;
  le: string;
  /** L'appareil d'où venaient les opérations. */
  appareil: string;
  nomAppareil?: string;
  operations: number;
  revisions: number;
  /** Les cartes recalculées, pour savoir ce qu'une annulation défera. */
  cartes: string[];
  /**
   * La fusion s'est-elle faite **sans geste** ? L'écran doit le distinguer : une
   * fusion qu'on n'a pas demandée mérite d'être annoncée, celle qu'on vient de
   * déclencher n'a pas besoin de l'être.
   */
  automatique?: boolean;
}

/** Au-delà, l'annulation n'est plus offerte. Voir `arriere-plan.md`. */
export const JOURS_ANNULABLES = 7;

export interface EtatLocal {
  operations: Operation[];
  revisions: EntreeRevision[];
  reglages: Reglages;
}

export async function etatLocal(): Promise<EtatLocal> {
  const base = await db();
  const [operations, revisions, reglages] = await Promise.all([
    base.getAll('operations'),
    base.getAll('revisions'),
    base.get('etat', CLEF_REGLAGES) as Promise<Reglages | undefined>,
  ]);
  return { operations, revisions, reglages: reglages ?? {} };
}

/**
 * L'empreinte d'état : « identiques ✓ ».
 *
 * Elle porte sur **les deux journaux** et sur les réglages versionnés. Les
 * identifiants sont des ULID, donc distincts entre les deux journaux : les
 * mêler ne crée pas d'ambiguïté, et les séparer aurait demandé deux empreintes à
 * comparer — ce qu'aucun œil ne fait deux fois de suite.
 */
export async function empreinteLocale(): Promise<{ complete: string; lisible: string }> {
  const { operations, revisions, reglages } = await etatLocal();
  const complete = await empreinte({
    operations: [...operations.map((o) => o.id), ...revisions.map((r) => r.id)],
    reglages: Object.fromEntries(
      Object.entries(reglages).map(([c, r]) => [c, [r.valeur, r.hlc, r.appareil]]),
    ),
  });
  return { complete, lisible: empreinteLisible(complete) };
}

export interface PaquetFabrique {
  octets: Uint8Array<ArrayBuffer>;
  nom: string;
  operations: number;
  revisions: number;
  tailleFichier: number;
  /** La plus haute horloge du paquet : ce dont le receveur accusera réception. */
  couvertJusqua: string;
}

/**
 * Fabrique le paquet de cet appareil.
 *
 * `depuis` borne la tranche d'horloge quand on sait ce que l'autre a déjà vu.
 * À défaut, on envoie tout : c'est le premier contact, et c'est aussi le seul
 * cas sûr, puisqu'on ne peut pas deviner ce qu'un appareil inconnu possède.
 */
export async function fabriquerPaquet(
  motDePasse: string,
  options: { depuis?: string; nomAppareil?: string; iterations?: number } = {},
): Promise<PaquetFabrique> {
  const { operations, revisions, reglages } = await etatLocal();
  const bornes = tranche(options.depuis);
  const dansBornes = <T extends { hlc: string }>(e: T) =>
    e.hlc >= bornes.de && e.hlc <= bornes.a;

  const retenues = operations.filter(dansBornes);
  const retenuesRevisions = revisions.filter(dansBornes);
  const appareil = await lireAppareil();
  const { complete } = await empreinteLocale();
  const base = await db();

  /*
     Ce que le paquet couvre vraiment : la plus haute horloge qu'il contient.
     À défaut d'entrée — un paquet vide est légitime, c'est celui d'un appareil
     à jour —, l'horloge courante, qui ne promet rien de faux puisqu'elle
     majore tout ce que cet appareil a émis.
  */
  let couvertJusqua = await horlogeCourante();
  for (const entree of [...retenues, ...retenuesRevisions]) {
    if (entree.hlc > couvertJusqua) couvertJusqua = entree.hlc;
  }

  const paquet = await fabriquer({
    contenu: { operations: retenues, reglages },
    // Le journal de révisions voyage comme un magasin de plus : le format ne
    // connaît aucune liste de magasins, c'est ce qui permet de l'étendre sans
    // le modifier.
    magasinsEnPlus: { revisions: retenuesRevisions },
    appareil,
    nomAppareil: options.nomAppareil,
    schema: base.version,
    tranche: bornes,
    empreinte: complete,
    couvertJusqua,
    // Ce qu'on détient de chacun : c'est ce qui autorisera l'autre à compacter.
    recuDe: await detenuParAppareil(),
    motDePasse,
    versionApplication: 'cyclades',
    iterations: options.iterations,
  });

  return {
    octets: paquet.octets,
    nom: nomDeFichier(appareil),
    operations: retenues.length,
    revisions: retenuesRevisions.length,
    tailleFichier: paquet.tailleFichier,
    couvertJusqua,
  };
}

export const apercuPaquet = (octets: Octets): Promise<Apercu> => apercuPaquetBrut(octets);

export interface RapportDeFusion {
  lot: string;
  recues: number;
  /** Les champs de réglage que la fusion a changés ici. */
  reglagesChanges: readonly string[];
  revisionsRecues: number;
  aEnvoyer: number;
  conflits: number;
  collisions: number;
  cartesRecalculees: number;
  /**
   * Les entrées que cette fusion a effacées parce qu'un compactage reçu les
   * déclarait effacées. Zéro en temps normal ; non nul, l'écran d'annulation
   * doit le dire : une annulation ne les ramènera pas.
   */
  effaceesParCompactage: number;
  /** Les deux appareils sont-ils identiques après la fusion ? */
  identiques: boolean;
  empreinte: string;
  /** L'empreinte annoncée par le paquet, pour la comparer. */
  empreinteDistante: string;
  /** L'appareil qui a fabriqué le paquet : l'écran le nomme, l'appairage le retient. */
  appareilDistant: string;
  /**
   * Ce que la fusion a constaté des deux histoires avant d'écrire.
   *
   * Il voyage avec le rapport plutôt que de s'obtenir par un appel séparé : un
   * diagnostic appelé à part redériverait la clé, et 600 000 itérations PBKDF2
   * deux fois pour une seule action de l'utilisateur sont 600 000 de trop.
   */
  diagnostic: Diagnostic;
}

/**
 * Fusionne un paquet reçu, puis **recalcule** les états dérivés touchés.
 *
 * L'ordre compte et n'est pas négociable : on écrit les journaux, **ensuite** on
 * recalcule. L'inverse recalculerait depuis un journal incomplet, et écrirait un
 * état FSRS faux par-dessus un état juste — la seule façon de perdre des
 * échéances sans perdre une seule donnée.
 */
export class FusionRefusee extends Error {
  constructor(
    readonly diagnostic: Diagnostic,
    readonly marcheASuivre: readonly string[] = MARCHE_A_SUIVRE,
  ) {
    super(diagnostic.message);
    this.name = 'FusionRefusee';
  }
}

export async function fusionnerPaquet(
  octets: Octets,
  motDePasse: string,
  options: { automatique?: boolean } = {},
): Promise<RapportDeFusion> {
  const base = await db();
  const ouvert = await ouvrir(octets, motDePasse, base.version);
  const lot = ulid();

  const local = await etatLocal();
  const revisionsRecuesBrutes = ((ouvert.magasinsEnPlus?.revisions ?? []) as EntreeRevision[]).map(
    (r) => (r.lot === SANS_LOT ? { ...r, lot } : r),
  );

  /*
     Le périmètre de compaction, réuni des deux côtés : ce que l'un des deux
     appareils a déjà déclaré effacé ne doit pas revenir par l'autre. Le filtre
     est posé **avant** le diagnostic de première fusion, sans quoi le socle
     d'une carte supprimée et compactée ferait refuser une fusion saine.
  */
  const perimetreCommun = perimetre(
    compactagesDeclares([...local.operations, ...ouvert.contenu.operations]),
  );
  const operationsDistantes = horsPerimetre(
    ouvert.contenu.operations,
    perimetreCommun,
    (o) => o.cible,
  ).gardees;
  const distantRevisions = horsPerimetre(
    revisionsRecuesBrutes,
    perimetreCommun,
    (r) => r.carteId,
  ).gardees;

  /*
     Le refus vient **avant** toute écriture, et avant même d'absorber les
     horloges : une fusion refusée ne doit rien laisser derrière elle, pas même
     une horloge avancée.
  */
  const diagnostic = diagnostiquer(
    { operations: local.operations, revisions: local.revisions },
    { operations: operationsDistantes, revisions: distantRevisions },
  );
  if (!fusionnable(diagnostic)) throw new FusionRefusee(diagnostic);

  /*
     L'horloge locale absorbe celle de chaque entrée reçue, avant toute
     émission ultérieure. C'est ce qui garantit que ce que cet appareil écrira
     ensuite sera postérieur à ce qu'il vient de voir, même si son horloge
     murale est en retard. Une horloge trop en avance lève, et la fusion
     s'arrête avant d'avoir rien écrit.
  */
  for (const entree of [...operationsDistantes, ...distantRevisions]) {
    await absorberHlc(entree.hlc);
  }

  const resultat = fusionner(
    { operations: local.operations, reglages: local.reglages },
    { operations: operationsDistantes, reglages: ouvert.contenu.reglages },
    { lot },
  );

  const journalRevisions = normaliserJournal([...local.revisions, ...distantRevisions]);
  const idsLocaux = new Set(local.revisions.map((r) => r.id));
  const revisionsRecues = journalRevisions.operations.filter((r) => !idsLocaux.has(r.id));

  // Les écritures d'abord, en une transaction par magasin : si la seconde
  // échoue, le recalcul suivant rétablira la cohérence depuis ce qui a été
  // écrit, ce qu'un recalcul anticipé n'aurait pas pu faire.
  const tx = base.transaction(['operations', 'revisions', 'etat'], 'readwrite');
  for (const op of resultat.recues) await tx.objectStore('operations').put(op);
  for (const r of revisionsRecues) await tx.objectStore('revisions').put(r);
  if (resultat.reglagesChanges.length) {
    await tx.objectStore('etat').put(resultat.etat.reglages, CLEF_REGLAGES);
  }
  await tx.done;

  /*
     Le paquet peut apporter un **compactage** que cet appareil ne connaissait
     pas : ce qu'il déclare effacé doit alors l'être ici aussi, sans quoi les
     deux journaux resteraient différents pour toujours et l'écran dirait « non
     identiques » sans que rien ne puisse les rapprocher. L'application est
     idempotente, donc la rejouer à chaque fusion ne coûte qu'une lecture.
  */
  const effacees = await appliquerCompactages();

  /*
     Les réglages gagnants sont recopiés dans le magasin ordinaire, pour que les
     écrans les lisent sans rien savoir du registre. L'écriture est **brute** :
     les ré-horodater au nom de cet appareil les ferait repartir vers leur
     émetteur avec une horloge plus récente, indéfiniment, et les deux appareils
     ne se déclareraient jamais identiques tout en portant la même valeur.
  */
  for (const champ of resultat.reglagesChanges) {
    const gagnant = resultat.etat.reglages[champ];
    if (gagnant) await ecrireReglageBrut(champ, gagnant.valeur);
  }

  // Le recalcul, ensuite. Les cartes touchées sont celles des révisions
  // reçues : recalculer tout voudrait dire rejouer soixante mille révisions à
  // chaque synchronisation.
  const cartes = [...new Set(revisionsRecues.map((r) => r.carteId))].filter(
    (carteId) => !perimetreCommun.has(carteId),
  );
  let recalculees = 0;
  for (const carteId of cartes) {
    const entrees = await (await db()).getAllFromIndex('revisions', 'carteId', carteId);
    const etat = recalculerCarte(entrees);
    if (etat) {
      await ecrireCarte(etat);
      recalculees += 1;
    }
  }

  /*
     Un lot n'est enregistré que s'il a **apporté quelque chose**. Une fusion
     qui ne reçoit rien — le même paquet une seconde fois, ou un appareil déjà à
     jour — ne doit pas laisser de ligne dans l'historique : elle offrirait une
     annulation qui ne défait rien, ce qui est le meilleur moyen de faire
     douter de celles qui défont vraiment.
  */
  if (resultat.recues.length || revisionsRecues.length) {
    await enregistrerLot({
      lot,
      le: new Date().toISOString(),
      appareil: ouvert.metadonnees.appareil,
      nomAppareil: ouvert.metadonnees.nomAppareil,
      operations: resultat.recues.length,
      revisions: revisionsRecues.length,
      cartes,
      automatique: options.automatique || undefined,
    });
  }

  /*
     Ce qu'on vient d'apprendre de l'émetteur est noté **localement** : son nom
     annoncé, l'empreinte qu'il affichait, et jusqu'où va la tranche qu'il nous
     a envoyée — ce qui borne ce qu'on aura à lui renvoyer. Ce sont des
     observations, vraies de cet appareil-ci seulement, et les partager ferait
     dire au téléphone « vu il y a deux jours » alors que c'est l'ordinateur qui
     l'a vu.
  */
  const soi = await lireAppareil();
  const vuAvant = await observationDe(ouvert.metadonnees.appareil);
  const dejaDetenu = vuAvant?.recuJusqua;
  const reconnuAvant = vuAvant?.reconnuJusqua;
  /*
     Ce que ce paquet nous fait détenir de l'émetteur, et qu'on lui annoncera
     dans notre prochain paquet : c'est **son** autorisation de compacter.

     Deux conditions, toutes deux nécessaires. La tranche doit **se raccorder**
     à ce qu'on détient déjà de lui : partir du commencement, ou partir d'une
     borne qu'on a déjà franchie. Sans quoi il y aurait un trou en dessous, et
     « je détiens tout jusqu'à H » serait faux — c'est l'erreur qui ferait
     compacter l'autre appareil sur une promesse qu'on n'a pas tenue. Et la
     borne ne doit jamais reculer : un paquet ancien rouvert ne doit pas défaire
     une reconnaissance acquise.
  */
  const couvert = ouvert.metadonnees.couvertJusqua;
  const debut = ouvert.metadonnees.tranche.de;
  const complet =
    debut === BORNE_BASSE || (dejaDetenu !== undefined && dejaDetenu >= debut);
  const recuJusqua =
    couvert && complet && (!dejaDetenu || dejaDetenu < couvert) ? couvert : dejaDetenu;

  /*
     Et ce que l'émetteur nous dit détenir de nous, qui est ce dont **notre**
     compaction a besoin. On garde le plus haut : un paquet ancien rouvert ne
     fait pas régresser ce qu'on sait.
  */
  const annonce = ouvert.metadonnees.recuDe?.[soi];

  await noterObservation(ouvert.metadonnees.appareil, {
    vuLe: new Date().toISOString(),
    empreinte: ouvert.metadonnees.empreinte,
    nomAnnonce: ouvert.metadonnees.nomAppareil,
    recuJusqua,
    reconnuJusqua:
      annonce && (!reconnuAvant || reconnuAvant < annonce) ? annonce : reconnuAvant,
  });

  const { complete } = await empreinteLocale();
  return {
    lot,
    recues: resultat.recues.length,
    reglagesChanges: resultat.reglagesChanges,
    revisionsRecues: revisionsRecues.length,
    aEnvoyer: resultat.aEnvoyer.length,
    conflits: trier(resultat.conflits, resultat.etat.operations).ouverts.length,
    collisions: resultat.collisions.length,
    cartesRecalculees: recalculees,
    effaceesParCompactage: effacees.operations + effacees.revisions,
    identiques: complete === ouvert.metadonnees.empreinte,
    empreinte: complete,
    empreinteDistante: ouvert.metadonnees.empreinte,
    appareilDistant: ouvert.metadonnees.appareil,
    diagnostic,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Écrire un fait local
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Enregistre un fait dans le journal des opérations.
 *
 * C'est la porte par laquelle tout ce qui doit voyager entre dans le journal :
 * identifiant stable, horloge logique prise à la file, appareil émetteur, lot
 * vide — une saisie locale n'a été reçue de personne, et l'annulation d'une
 * fusion ne doit pas pouvoir l'emporter.
 */
export async function enregistrerFait(
  type: string,
  cible: string,
  charge: unknown,
): Promise<Operation> {
  const op = operation({
    id: ulid(),
    appareil: await lireAppareil(),
    hlc: decoderHlc(await prochaineHlc()),
    type,
    cible,
    charge,
  });
  await (await db()).put('operations', op);
  return op;
}

/** Nomme un appareil. Le nom est un fait : il voyage. */
export async function nommerAppareil(nom: string, appareil?: string): Promise<void> {
  const cible = appareil ?? (await lireAppareil());
  await enregistrerFait(TYPE_NOM_APPAREIL, cible, { nom: nom.trim() });
}

/**
 * Retire un appareil du registre, ou le reprend.
 *
 * Un retrait est un **fait**, parce qu'il a une conséquence sur le moteur : la
 * compaction cesse d'attendre l'accusé de réception d'un appareil retiré. Deux
 * appareils qui ne seraient pas d'accord sur qui est retiré ne compacteraient
 * pas la même chose.
 *
 * Ce n'est **pas** une révocation, et l'écran le dit : l'appareil retiré garde
 * ce qu'il a, et le mot de passe qu'il connaît ouvre encore les paquets déjà
 * transmis et les sauvegardes déjà faites. Pour protéger l'avenir, il faut
 * changer le mot de passe — ce qui ne protège pas le passé non plus.
 */
export async function retirerAppareil(appareil: string, retire = true): Promise<void> {
  const soi = await lireAppareil();
  if (appareil === soi) {
    throw new Error('Cet appareil-ci ne se retire pas lui-même : il tient le registre.');
  }
  await enregistrerFait(TYPE_RETRAIT, appareil, { retire });
}

/**
 * Déclare une sauvegarde réussie, de sorte que les deux appareils la voient.
 *
 * La maquette l'exige — « la même liste sur les deux appareils » — et ce n'est
 * pas un confort : sans elle, chaque appareil insiste séparément, et on
 * sauvegarde deux fois ou pas du tout. `couvertJusqua` dit **ce qui est
 * protégé**, là où une simple date dit seulement quand on s'en est occupé.
 */
export async function declarerSauvegarde(couvertJusqua?: string): Promise<void> {
  const quand = new Date().toISOString();
  await enregistrerFait(TYPE_SAUVEGARDE, `sauvegarde:${quand}`, {
    le: quand,
    couvertJusqua: couvertJusqua ?? (await horlogeCourante()),
  });
}

/** Le registre d'appareils, faits partagés et observations locales réunis. */
export async function registreAppareils(): Promise<AppareilConnu[]> {
  const { operations } = await etatLocal();
  return appareilsConnus(operations, await lireAppareil());
}

/** Les sauvegardes déclarées par n'importe quel appareil. */
export async function registreSauvegardes(): Promise<SauvegardeDeclaree[]> {
  const { operations } = await etatLocal();
  return sauvegardesDeclarees(operations);
}

/* ══════════════════════════════════════════════════════════════════════════
   Conflits et notification de correction
   ══════════════════════════════════════════════════════════════════════════ */

/** Les conflits à traiter, et ceux qu'on a déjà tranchés. */
export async function conflitsALire(): Promise<Tri> {
  const { operations } = await etatLocal();
  return trier(conflits(operations), operations);
}

/**
 * Tranche un conflit, et journalise la réponse.
 *
 * La résolution est un **fait** : elle voyage, et le conflit sera donc tranché
 * sur l'autre appareil aussi dès la prochaine synchronisation. Répondre deux
 * fois à la même question serait épuisant et, plus grave, inexplicable.
 */
export async function resoudreConflit(
  conflit: Conflit,
  choix: { issue: Issue; retenue?: string; precision?: string },
): Promise<void> {
  const charge = construireResolution(conflit, choix);
  await enregistrerFait(TYPE_RESOLUTION, conflit.cible, charge);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les lots, et leur annulation
   ══════════════════════════════════════════════════════════════════════════ */

async function enregistrerLot(lot: LotRecu): Promise<void> {
  const base = await db();
  const anciens = ((await base.get('etat', CLEF_LOTS)) as LotRecu[] | undefined) ?? [];
  // On garde les lots de la fenêtre d'annulation, et deux de plus : l'écran
  // doit pouvoir dire « plus annulable » plutôt que de les faire disparaître,
  // ce qui ressemblerait à un oubli.
  const limite = Date.now() - (JOURS_ANNULABLES + 7) * 86_400_000;
  const gardes = [...anciens, lot].filter((l) => Date.parse(l.le) >= limite);
  await base.put('etat', gardes, CLEF_LOTS);
}

export async function lotsRecus(): Promise<LotRecu[]> {
  const base = await db();
  const lots = ((await base.get('etat', CLEF_LOTS)) as LotRecu[] | undefined) ?? [];
  return [...lots].sort((a, b) => b.le.localeCompare(a.le));
}

export const annulable = (lot: LotRecu, maintenant = new Date()): boolean =>
  maintenant.getTime() - Date.parse(lot.le) <= JOURS_ANNULABLES * 86_400_000;

export interface RapportAnnulation {
  retirees: number;
  revisionsRetirees: number;
  cartesRecalculees: number;
  empreinte: string;
}

/**
 * Annule une fusion : retire les opérations de ce lot, et elles seules.
 *
 * Les trois propriétés viennent du modèle, pas de ce code. **Exacte** : on
 * retire ce lot, pas « les changements d'hier ». **Sans perte** : une saisie
 * locale porte le lot vide et n'est pas touchée. **Rejouable** : l'autre
 * appareil garde ces opérations, qui reviendront à la prochaine
 * synchronisation — annuler ici n'efface pas là-bas, et l'écran le dit.
 */
export async function annulerFusion(lot: string): Promise<RapportAnnulation> {
  const base = await db();
  const local = await etatLocal();

  const defait = annulerLot({ operations: local.operations, reglages: local.reglages }, lot);
  const revisionsRetirees = local.revisions.filter((r) => r.lot === lot);

  const tx = base.transaction(['operations', 'revisions'], 'readwrite');
  for (const op of defait.retirees) await tx.objectStore('operations').delete(op.id);
  for (const r of revisionsRetirees) await tx.objectStore('revisions').delete(r.id);
  await tx.done;

  // Recalcul des cartes touchées. Une carte dont toutes les entrées
  // disparaissent n'est pas supprimée : elle garde son dernier état connu, qui
  // est celui d'avant la fusion.
  const cartes = [...new Set(revisionsRetirees.map((r) => r.carteId))];
  let recalculees = 0;
  for (const carteId of cartes) {
    const entrees = await (await db()).getAllFromIndex('revisions', 'carteId', carteId);
    const etat = recalculerCarte(entrees);
    if (etat) {
      await ecrireCarte(etat);
      recalculees += 1;
    }
  }

  const restants = (await lotsRecus()).filter((l) => l.lot !== lot);
  await base.put('etat', restants, CLEF_LOTS);

  const { complete } = await empreinteLocale();
  return {
    retirees: defait.retirees.length,
    revisionsRetirees: revisionsRetirees.length,
    cartesRecalculees: recalculees,
    empreinte: complete,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   La compaction
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Applique à la base tous les compactages que le journal déclare.
 *
 * Appelée après chaque fusion, et par la compaction elle-même. Idempotente :
 * sans rien à faire, elle ne fait qu'une lecture. C'est elle qui empêche un
 * appareil en retard de ressusciter indéfiniment ce qu'un autre a effacé — le
 * compactage reste dans le journal, et chaque retour du même fait se heurte au
 * même périmètre.
 */
export async function appliquerCompactages(): Promise<{
  operations: number;
  revisions: number;
}> {
  const base = await db();
  const operations = await base.getAll('operations');
  const perim = perimetre(compactagesDeclares(operations));
  if (perim.size === 0) return { operations: 0, revisions: 0 };

  const revisions = await base.getAll('revisions');
  const opsARetirer = horsPerimetre(operations, perim, (o) => o.cible).retirees;
  const revsARetirer = horsPerimetre(revisions, perim, (r) => r.carteId).retirees;
  if (!opsARetirer.length && !revsARetirer.length) return { operations: 0, revisions: 0 };

  const tx = base.transaction(['operations', 'revisions'], 'readwrite');
  for (const op of opsARetirer) await tx.objectStore('operations').delete(op.id);
  for (const r of revsARetirer) await tx.objectStore('revisions').delete(r.id);
  await tx.done;
  return { operations: opsARetirer.length, revisions: revsARetirer.length };
}

export interface Prevision {
  borne: Borne;
  /** Le plan, quand la borne le permet. */
  plan?: Plan;
  /** Les cibles supprimées que le journal porte encore, en tout. */
  supprimees: number;
}

/**
 * Ce qu'une compaction retirerait, sans rien retirer.
 *
 * L'écran l'affiche avant de proposer le bouton : une opération qui efface des
 * entrées de journal ne se déclenche pas sans avoir dit, au nombre près, ce
 * qu'elle va faire.
 */
export async function prevoirCompaction(): Promise<Prevision> {
  const { operations, revisions } = await etatLocal();
  const appareils = await appareilsConnus(operations, await lireAppareil());
  const borne = bornePartagee(appareils, await horlogeCourante());
  const supprimeesEncore = new Set(
    operations.filter((o) => o.type === TYPE_SUPPRESSION).map((o) => o.cible),
  ).size;
  if (!borne.possible) return { borne, supprimees: supprimeesEncore };
  return {
    borne,
    plan: planifier({ operations, revisions }, borne.jusqua),
    supprimees: supprimeesEncore,
  };
}

export class CompactionRefusee extends Error {
  constructor(readonly attendus: readonly string[]) {
    super(
      attendus.length === 1
        ? `« ${attendus[0]} » n’a encore accusé réception de rien : la compaction attend.`
        : `${attendus.length} appareils n’ont encore accusé réception de rien : ` +
          'la compaction attend.',
    );
    this.name = 'CompactionRefusee';
  }
}

export interface RapportCompaction {
  jusqua: string;
  cibles: number;
  operations: number;
  revisions: number;
  pierresTombales: number;
  reportees: number;
  empreinte: string;
}

/**
 * Compacte le journal : efface les faits des cibles supprimées, et leurs
 * pierres tombales.
 *
 * L'ordre des deux écritures n'est pas négociable. Le **compactage d'abord**,
 * les suppressions ensuite : si la seconde étape échoue à moitié, le compactage
 * est déjà dans le journal et `appliquerCompactages` finira le travail à la
 * prochaine occasion. L'ordre inverse effacerait sans laisser de trace de ce
 * qui a été effacé, et le premier appareil en retard ferait tout revenir.
 */
export async function compacter(): Promise<RapportCompaction> {
  const prevision = await prevoirCompaction();
  if (!prevision.borne.possible) throw new CompactionRefusee(prevision.borne.attendus);
  const plan = prevision.plan!;
  if (planVide(plan)) {
    const { complete } = await empreinteLocale();
    return {
      jusqua: plan.jusqua,
      cibles: 0,
      operations: 0,
      revisions: 0,
      pierresTombales: 0,
      reportees: plan.reportees.length,
      empreinte: complete,
    };
  }

  await enregistrerFait(TYPE_COMPACTION, CIBLE_COMPACTION, {
    jusqua: plan.jusqua,
    cibles: plan.cibles,
  });
  const retire = await appliquerCompactages();

  const { complete } = await empreinteLocale();
  return {
    jusqua: plan.jusqua,
    cibles: plan.cibles.length,
    operations: retire.operations,
    revisions: retire.revisions,
    pierresTombales: plan.pierresTombales,
    reportees: plan.reportees.length,
    empreinte: complete,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Reconstruire les états dérivés
   ══════════════════════════════════════════════════════════════════════════ */

export interface RapportReconstruction {
  cartes: number;
  /** Cartes dont le journal est vide : leur état est laissé tel quel. */
  sansJournal: number;
}

/**
 * Recalcule l'état FSRS de **toutes** les cartes depuis le journal.
 *
 * C'est la réparation que la règle « les états dérivés sont recalculés »
 * promettait et qui n'existait pas : la fusion ne recalcule que les cartes
 * qu'elle touche — à raison, puisque tout recalculer voudrait dire rejouer
 * soixante mille révisions à chaque synchronisation. Mais il faut bien un
 * endroit où l'on peut tout refaire : après une annulation, après un retour
 * arrière de migration, ou simplement quand un état paraît faux.
 *
 * Elle est sûre par construction : le journal est la vérité, l'état dérivé n'en
 * est qu'un résumé. La relancer deux fois donne le même résultat.
 *
 * Une carte dont le journal est vide **n'est pas supprimée** et son état n'est
 * pas touché : son absence du journal signifie qu'on ne sait pas la
 * reconstituer, pas qu'elle n'existe pas. L'effacer serait décider à la place
 * de la personne.
 */
export async function reconstruireEtatsDerives(): Promise<RapportReconstruction> {
  const base = await db();
  const cartes = await base.getAll('cartes');
  const journal = await base.getAll('revisions');
  const parCarte = new Map<string, EntreeRevision[]>();
  for (const entree of journal) {
    const groupe = parCarte.get(entree.carteId);
    if (groupe) groupe.push(entree);
    else parCarte.set(entree.carteId, [entree]);
  }

  let refaites = 0;
  let sansJournal = 0;
  // Les cartes du journal, y compris celles qui n'ont pas encore
  // d'enregistrement — c'est le cas d'une carte reçue d'un autre appareil.
  for (const entrees of parCarte.values()) {
    const etat = recalculerCarte(entrees);
    if (!etat) continue;
    await ecrireCarte(etat);
    refaites += 1;
  }
  for (const carte of cartes) {
    if (!parCarte.has(carte.id)) sansJournal += 1;
  }
  return { cartes: refaites, sansJournal };
}

/** L'horloge de cet appareil, pour borner la prochaine tranche envoyée. */
export const horlogeLocale = horlogeCourante;
