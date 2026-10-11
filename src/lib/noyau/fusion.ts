/**
 * Le moteur de fusion. C'est la pièce qui doit être juste.
 *
 * Si elle est fausse, aucun écran, aucun transport, aucun essai d'interface ne
 * la rattrapera : les dégâts seront déjà dans la base, et la base est la seule
 * copie. Le module est donc **pur et synchrone** — pas de chiffrement, pas
 * d'IndexedDB, pas d'horloge lue. On lui donne deux états, il en rend un
 * troisième, et c'est tout ce qu'il sait faire.
 *
 * ## Trois natures de données, trois traitements
 *
 * | Nature | Traitement |
 * |---|---|
 * | **Faits** | journalisés, jamais écrasés, **union par identifiant** |
 * | **État dérivé** | jamais fusionné : **recalculé** à partir des journaux |
 * | **Réglages** | **dernier écrivain gagne**, par champ, sur l'horloge logique |
 *
 * La distinction est la clé de tout. Un fait est arrivé : deux appareils qui en
 * ont chacun un en ont deux. Un état dérivé est un calcul : deux appareils qui
 * n'ont pas le même n'ont pas un conflit, ils ont un désaccord qui se dissout
 * dès qu'on recalcule. Les fusionner serait l'erreur la plus coûteuse du
 * chantier — une XP additionnée deux fois ne se répare pas. Ce module ne sait
 * donc **pas** fusionner un état dérivé ; il rend la liste des cibles à
 * recalculer, et c'est l'appelant qui recalcule.
 *
 * ## Les trois garanties
 *
 * Commutativité, associativité, idempotence. Elles ne sont pas une élégance :
 * ce sont les conditions pour qu'une fusion soit **rejouable sans dommage**,
 * donc pour qu'une coupure en cours de transfert se répare en renvoyant le
 * paquet entier, sans comptabilité partielle.
 *
 * Elles reposent sur une hypothèse que le code doit tenir : **aucune opération
 * n'est jamais modifiée après émission**. L'union d'ensembles est commutative,
 * associative et idempotente ; le maximum sur un ordre total l'est aussi. Une
 * seule mutation en place et les trois tombent ensemble. D'où les opérations
 * figées à la fabrication, et les essais de propriétés qui les éprouvent plutôt
 * que de se fier à ce raisonnement.
 */
import { comparerOperations, SANS_LOT, type Operation } from './operations';
import { typeDeFait } from './faits';

/* ══════════════════════════════════════════════════════════════════════════
   Réglages
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un réglage, avec de quoi savoir qui l'a écrit en dernier.
 *
 * Les clés sont **plates**, avec des points : « planification.rotation » plutôt
 * qu'un objet imbriqué. Un dernier-écrivain-gagne par champ exige des champs
 * adressables ; fusionner des objets imbriqués demanderait de toute façon une
 * horloge par feuille, et l'imbrication n'apporterait alors que l'ambiguïté sur
 * ce qui est une feuille.
 */
export interface ChampRegle {
  valeur: unknown;
  /** Horloge logique encodée, qui se trie comme elle se compare. */
  hlc: string;
  appareil: string;
}

export type Reglages = Record<string, ChampRegle>;

/**
 * Lequel des deux a été écrit en dernier.
 *
 * Le départage va **jusqu'au bout**, et ce n'est pas du zèle. La première
 * version s'arrêtait à l'identifiant d'appareil : horloge égale et appareil
 * égal, elle rendait « celui de gauche » — donc `plusRecent(a, b)` valait `a` et
 * `plusRecent(b, a)` valait `b`. Les deux appareils gardaient chacun le sien en
 * se croyant d'accord, et l'empreinte ne les départageait pas puisqu'elle porte
 * sur les journaux. Un essai de propriété l'a trouvé ; aucun essai écrit à la
 * main ne l'aurait fait, parce que le cas — même horloge, même appareil, deux
 * valeurs — ne se produit pas quand tout va bien.
 *
 * C'est précisément la raison de le traiter : il ne se produit que si quelque
 * chose est déjà cassé, et c'est là qu'il faut converger plutôt que diverger
 * silencieusement.
 */
export function plusRecent(a: ChampRegle, b: ChampRegle): ChampRegle {
  if (a.hlc !== b.hlc) return a.hlc > b.hlc ? a : b;
  if (a.appareil !== b.appareil) return a.appareil > b.appareil ? a : b;
  const sa = serialiserStable(a.valeur);
  const sb = serialiserStable(b.valeur);
  if (sa !== sb) return sa > sb ? a : b;
  return a;
}

/* ══════════════════════════════════════════════════════════════════════════
   Suppressions
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le type d'opération qui supprime. Une suppression est une **opération**, pas
 * une absence : sans cela, un appareil en retard ressusciterait à chaque fusion
 * ce que l'autre a supprimé, et il n'y aurait aucun moyen de l'en empêcher.
 */
export const TYPE_SUPPRESSION = 'suppression';

export const supprimees = (operations: Iterable<Operation>): Set<string> => {
  const sortie = new Set<string>();
  for (const op of operations) if (op.type === TYPE_SUPPRESSION) sortie.add(op.cible);
  return sortie;
};

/* ══════════════════════════════════════════════════════════════════════════
   Conflits
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les types de faits dont un désaccord doit être **montré** et non résolu.
 *
 * Les huit validés. Les autres types sensibles — check-in, journal, repas — ne
 * sont pas moins sensibles : ils sont des **événements** et non des états, ils
 * s'unissent par identifiant sans conflit possible, et leur ajouter une
 * notification fabriquerait des conflits qui n'existent pas.
 *
 * Un conflit n'est jamais résolu par le moteur, quelle que soit l'évidence. La
 * plus récente est affichée en attendant, marquée « à vérifier », et la
 * fiabilité des indicateurs qui s'en servent est dégradée jusqu'à la réponse.
 */
export const TYPES_A_CONFLIT_EXPLICITE: readonly string[] = [
  'odyssee.poids',
  'odyssee.mesure',
  'odyssee.statut-hormonal',
  'odyssee.medicament',
  'odyssee.valorisation',
  'odyssee.operation',
  'odyssee.sante',
  'sport.blessure',
];

export interface Conflit {
  type: string;
  cible: string;
  /** Les opérations en désaccord, par ordre de fusion. Toutes conservées. */
  operations: Operation[];
  /** Celle qu'on affiche en attendant la réponse : la plus récente. */
  provisoire: Operation;
}

/**
 * Deux opérations disent-elles la même chose ?
 *
 * Comparaison structurelle de la charge, par JSON normalisé : deux appareils
 * qui enregistrent le même poids le même jour ne sont pas en conflit, et
 * l'afficher comme tel apprendrait à cliquer sans lire.
 */
function memeCharge(a: unknown, b: unknown): boolean {
  return serialiserStable(a) === serialiserStable(b);
}

function serialiserStable(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(serialiserStable).join(',')}]`;
  if (valeur && typeof valeur === 'object') {
    const entrees = Object.entries(valeur as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${entrees.map(([c, v]) => `${JSON.stringify(c)}:${serialiserStable(v)}`).join(',')}}`;
  }
  return JSON.stringify(valeur) ?? 'null';
}

/**
 * Les conflits d'un journal fusionné.
 *
 * Un conflit, c'est un même objet (`type` + `cible`) sur lequel **plusieurs
 * appareils** ont écrit des valeurs différentes. Deux écritures du même appareil
 * ne sont pas un conflit : c'est une correction, et la plus récente gagne — la
 * personne a changé d'avis sur son propre appareil, ce qui ne demande pas d'être
 * arbitré.
 */
export function conflits(operations: readonly Operation[]): Conflit[] {
  const groupes = new Map<string, Operation[]>();
  for (const op of operations) {
    if (!TYPES_A_CONFLIT_EXPLICITE.includes(op.type)) continue;
    const clef = `${op.type}\u0000${op.cible}`;
    const groupe = groupes.get(clef);
    if (groupe) groupe.push(op);
    else groupes.set(clef, [op]);
  }

  const sortie: Conflit[] = [];
  for (const groupe of groupes.values()) {
    const appareils = new Set(groupe.map((o) => o.appareil));
    if (appareils.size < 2) continue;
    const dernierParAppareil = new Map<string, Operation>();
    for (const op of [...groupe].sort(comparerOperations)) {
      dernierParAppareil.set(op.appareil, op);
    }
    const positions = [...dernierParAppareil.values()];
    const toutesPareilles = positions.every((o) => memeCharge(o.charge, positions[0].charge));
    if (toutesPareilles) continue;
    const ordonnees = positions.sort(comparerOperations);
    sortie.push({
      type: ordonnees[0].type,
      cible: ordonnees[0].cible,
      operations: ordonnees,
      provisoire: ordonnees[ordonnees.length - 1],
    });
  }
  return sortie.sort((a, b) => a.type.localeCompare(b.type) || a.cible.localeCompare(b.cible));
}

/* ══════════════════════════════════════════════════════════════════════════
   Fusion
   ══════════════════════════════════════════════════════════════════════════ */

export interface EtatSynchronisable {
  operations: readonly Operation[];
  reglages: Reglages;
}

/**
 * Une collision d'identifiants : deux opérations de même `id` et de contenu
 * différent. Cela ne peut pas arriver si tout va bien — un ULID est unique et
 * une opération est immuable —, donc si cela arrive, un paquet est corrompu,
 * tronqué de travers, ou forgé.
 */
export interface Collision {
  id: string;
  /** Les versions rencontrées, dédoublonnées par contenu. */
  versions: readonly Operation[];
  /** Celle que la fusion retient, par un choix déterministe des deux côtés. */
  retenue: Operation;
}

export interface JournalNormalise {
  operations: readonly Operation[];
  collisions: readonly Collision[];
}

/**
 * Dédoublonne un journal par identifiant, de façon **déterministe**.
 *
 * Le moteur supposait qu'un journal n'a pas deux opérations de même
 * identifiant. C'est vrai de ses propres journaux, et c'est exactement
 * l'hypothèse qu'un paquet venu d'ailleurs peut violer. Les essais de propriétés
 * ont montré ce que cela coûtait : commutativité, associativité et identité
 * tombaient toutes les trois, parce que le gagnant dépendait du côté d'où venait
 * le doublon — le local écrasait par le dernier rencontré, le distant était
 * ignoré d'office.
 *
 * La règle est donc la même pour les deux côtés et ne dépend d'aucun point de
 * vue : à identifiant égal, on retient la version dont la forme sérialisée est
 * la plus petite. Le choix lui-même n'a aucun sens métier — il n'en existe pas,
 * puisque l'une des deux versions est fausse et qu'on ne sait pas laquelle. Ce
 * qui a un sens, c'est que les deux appareils retiennent **la même**, donc
 * convergent, et que la collision soit **signalée** plutôt que résorbée en
 * silence.
 */
export function normaliserJournal(operations: Iterable<Operation>): JournalNormalise {
  const parId = new Map<string, Operation[]>();
  for (const op of operations) {
    const groupe = parId.get(op.id);
    if (groupe) groupe.push(op);
    else parId.set(op.id, [op]);
  }

  const retenues: Operation[] = [];
  const collisions: Collision[] = [];
  for (const [id, groupe] of parId) {
    if (groupe.length === 1) {
      retenues.push(groupe[0]);
      continue;
    }
    // Le lot est exclu de la comparaison : il dit comment une opération est
    // arrivée, ce qui diffère légitimement d'un appareil à l'autre et ne fait
    // donc pas de deux copies un conflit.
    const empreinteDe = (o: Operation) =>
      serialiserStable({ ...o, lot: undefined });
    const distinctes = new Map<string, Operation>();
    for (const o of groupe) if (!distinctes.has(empreinteDe(o))) distinctes.set(empreinteDe(o), o);
    const formes = [...distinctes.keys()].sort();
    const retenue = distinctes.get(formes[0])!;
    retenues.push(retenue);
    if (distinctes.size > 1) {
      collisions.push({ id, versions: formes.map((f) => distinctes.get(f)!), retenue });
    }
  }
  return {
    operations: retenues.sort(comparerOperations),
    collisions: collisions.sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}

export interface OptionsDeFusion {
  /**
   * L'identifiant du lot, porté par les opérations reçues. C'est ce qui rend
   * l'annulation exacte : annuler, c'est retirer ce lot et lui seul. Il est
   * fourni par l'appelant parce que le tirer ici rendrait le moteur impur, donc
   * non reproductible par un essai de propriété.
   */
  lot?: string;
}

export interface ResultatDeFusion {
  etat: EtatSynchronisable;
  /** Les opérations que le distant avait et que le local n'avait pas. */
  recues: readonly Operation[];
  /** Celles que le local a et que le distant n'a pas : l'aperçu les annonce. */
  aEnvoyer: readonly Operation[];
  /** Les champs de réglage que la fusion a changés localement. */
  reglagesChanges: readonly string[];
  conflits: readonly Conflit[];
  /**
   * Les collisions d'identifiants rencontrées. Vide quand tout va bien ; non
   * vide, elles désignent un paquet corrompu ou forgé, et l'écran doit le dire
   * — la fusion a convergé, mais sur une version dont on ne sait pas si c'est
   * la bonne.
   */
  collisions: readonly Collision[];
  /**
   * Les objets dont l'état dérivé doit être recalculé : ceux que les opérations
   * reçues touchent. Le moteur ne recalcule rien — il ne sait pas comment, et
   * c'est voulu : FSRS, XP et série ont chacun leur règle.
   */
  aRecalculer: readonly string[];
}

/**
 * Fusionne deux états. Pure, synchrone, sans effet de bord.
 *
 * Le local est le point de vue : « recues » et « aEnvoyer » sont dits de son
 * côté. Mais le résultat, lui, est **symétrique** — `fusionner(a, b).etat` et
 * `fusionner(b, a).etat` portent les mêmes opérations et les mêmes réglages.
 * C'est la commutativité, et c'est elle qui permet de synchroniser en étoile
 * sans que l'ordre des rencontres compte.
 */
export function fusionner(
  local: EtatSynchronisable,
  distant: EtatSynchronisable,
  options: OptionsDeFusion = {},
): ResultatDeFusion {
  const lot = options.lot ?? SANS_LOT;

  /*
     La normalisation porte sur l'**union** des deux journaux, et non sur chacun
     séparément. Normaliser chaque côté puis dédoublonner « au profit du local »
     laissait une collision d'un côté à l'autre se résoudre différemment selon le
     point de vue : `fusionner(a, b)` gardait la version de `a`, `fusionner(b, a)`
     celle de `b`, et la commutativité tombait. Les deux appareils convergeaient
     chacun sur sa propre version en se croyant d'accord.

     En normalisant l'union, la règle de départage est la même partout et ne
     connaît pas la notion de « local ».
  */
  const idsLocaux = new Set<string>();
  for (const op of local.operations) idsLocaux.add(op.id);

  const marquer = (op: Operation): Operation =>
    lot && op.lot === SANS_LOT && !idsLocaux.has(op.id) ? { ...op, lot } : op;

  const union = [...local.operations, ...distant.operations.map(marquer)];
  const normalise = normaliserJournal(union);
  const operations = normalise.operations;

  /*
     « Reçues » se lit sur le résultat et non sur l'entrée : ce sont les
     opérations retenues dont l'identifiant n'était pas connu localement. Les
     lire sur l'entrée distante aurait annoncé comme reçue une version que la
     normalisation vient d'écarter.
  */
  const recues = operations.filter((o) => !idsLocaux.has(o.id));

  const idsDistants = new Set(distant.operations.map((o) => o.id));
  const aEnvoyer = operations.filter((o) => idsLocaux.has(o.id) && !idsDistants.has(o.id));

  const reglages: Reglages = { ...local.reglages };
  const reglagesChanges: string[] = [];
  for (const [champ, venu] of Object.entries(distant.reglages)) {
    const ici = reglages[champ];
    if (!ici) {
      reglages[champ] = venu;
      reglagesChanges.push(champ);
      continue;
    }
    const gagnant = plusRecent(ici, venu);
    if (gagnant !== ici) {
      reglages[champ] = gagnant;
      reglagesChanges.push(champ);
    }
  }

  /*
     Les cibles à recalculer : celles que les opérations reçues touchent. On ne
     recalcule pas tout — sur cinq ans, cela voudrait dire rejouer 60 000
     révisions à chaque synchronisation — et on ne se fie pas non plus aux seules
     opérations du jour : une opération reçue peut être ancienne, et c'est
     justement le cas d'un appareil resté hors ligne un mois.
  */
  const aRecalculer = [...new Set(recues.map((o) => o.cible))].sort();

  return {
    etat: { operations, reglages },
    recues,
    aEnvoyer,
    reglagesChanges: [...new Set(reglagesChanges)].sort(),
    conflits: conflits(operations),
    collisions: normalise.collisions,
    aRecalculer,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Annulation d'un lot
   ══════════════════════════════════════════════════════════════════════════ */

export interface ResultatAnnulation {
  etat: EtatSynchronisable;
  retirees: readonly Operation[];
  aRecalculer: readonly string[];
}

/**
 * Retire les opérations d'un lot de fusion — et elles seules.
 *
 * Trois propriétés tombent du modèle, et aucune ne demande de code en plus.
 * L'annulation est **exacte** : elle ne retire pas « les changements d'hier »,
 * elle retire ce lot. Elle est **sans perte** : ce qui a été saisi localement
 * entre-temps porte le lot vide et n'est pas touché. Et elle est **rejouable** :
 * l'autre appareil garde ces opérations, qui reviendront à la prochaine
 * synchronisation — l'annulation est locale, ce n'est pas une suppression.
 *
 * Les réglages ne sont pas défaits champ par champ, et c'est volontaire : la
 * règle du dernier écrivain appliquée au journal restant donne la bonne réponse
 * sans cas particulier. Si un lot ultérieur a réécrit le même champ, annuler le
 * premier ne doit pas ressusciter l'ancienne valeur — et ne le fait pas.
 */
export function annulerLot(etat: EtatSynchronisable, lot: string): ResultatAnnulation {
  if (!lot) {
    // Le lot vide est celui des saisies locales : l'annuler effacerait ce que la
    // personne a écrit elle-même. On refuse plutôt que de le traiter comme un
    // lot ordinaire.
    throw new Error('Le lot vide désigne les saisies locales : il ne s’annule pas.');
  }
  const retirees = etat.operations.filter((o) => o.lot === lot);
  return {
    etat: {
      operations: etat.operations.filter((o) => o.lot !== lot),
      reglages: etat.reglages,
    },
    retirees,
    aRecalculer: [...new Set(retirees.map((o) => o.cible))].sort(),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle du catalogue
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Vérifie que les types à conflit explicite existent bien au catalogue.
 *
 * Une liste de types écrite à la main dérive du catalogue : un type renommé
 * sortirait silencieusement de la liste, et son conflit cesserait d'être montré
 * sans que rien ne le signale. Ce contrôle est appelé par les essais.
 */
export function controlerTypesAConflit(): string[] {
  const problemes: string[] = [];
  for (const type of TYPES_A_CONFLIT_EXPLICITE) {
    const declare = typeDeFait(type);
    if (!declare) {
      problemes.push(`« ${type} » est à conflit explicite mais absent du catalogue de faits.`);
      continue;
    }
    if (!declare.sensible) {
      problemes.push(
        `« ${type} » est à conflit explicite mais n’est pas marqué sensible : ` +
          'les deux listes doivent être la même, sans quoi un type serait sensible ' +
          'pour le partage et pas pour la fusion.',
      );
    }
  }
  return problemes;
}
