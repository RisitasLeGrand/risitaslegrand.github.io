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
import { annulerLot, conflits, fusionner, type Conflit, type Reglages } from '../noyau/fusion';
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
  noterObservation,
  sauvegardesDeclarees,
  TYPE_NOM_APPAREIL,
  TYPE_SAUVEGARDE,
  type AppareilConnu,
  type SauvegardeDeclaree,
} from './appareils';
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
  /** Les deux appareils sont-ils identiques après la fusion ? */
  identiques: boolean;
  empreinte: string;
  /** L'empreinte annoncée par le paquet, pour la comparer. */
  empreinteDistante: string;
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
): Promise<RapportDeFusion> {
  const base = await db();
  const ouvert = await ouvrir(octets, motDePasse, base.version);
  const lot = ulid();

  const local = await etatLocal();
  const distantRevisions = ((ouvert.magasinsEnPlus?.revisions ?? []) as EntreeRevision[]).map(
    (r) => (r.lot === SANS_LOT ? { ...r, lot } : r),
  );

  /*
     Le refus vient **avant** toute écriture, et avant même d'absorber les
     horloges : une fusion refusée ne doit rien laisser derrière elle, pas même
     une horloge avancée.
  */
  const diagnostic = diagnostiquer(
    { operations: local.operations, revisions: local.revisions },
    { operations: ouvert.contenu.operations, revisions: distantRevisions },
  );
  if (!fusionnable(diagnostic)) throw new FusionRefusee(diagnostic);

  /*
     L'horloge locale absorbe celle de chaque entrée reçue, avant toute
     émission ultérieure. C'est ce qui garantit que ce que cet appareil écrira
     ensuite sera postérieur à ce qu'il vient de voir, même si son horloge
     murale est en retard. Une horloge trop en avance lève, et la fusion
     s'arrête avant d'avoir rien écrit.
  */
  for (const entree of [...ouvert.contenu.operations, ...distantRevisions]) {
    await absorberHlc(entree.hlc);
  }

  const resultat = fusionner(
    { operations: local.operations, reglages: local.reglages },
    { operations: ouvert.contenu.operations, reglages: ouvert.contenu.reglages },
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
  const cartes = [...new Set(revisionsRecues.map((r) => r.carteId))];
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
  await noterObservation(ouvert.metadonnees.appareil, {
    vuLe: new Date().toISOString(),
    empreinte: ouvert.metadonnees.empreinte,
    nomAnnonce: ouvert.metadonnees.nomAppareil,
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
    identiques: complete === ouvert.metadonnees.empreinte,
    empreinte: complete,
    empreinteDistante: ouvert.metadonnees.empreinte,
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
