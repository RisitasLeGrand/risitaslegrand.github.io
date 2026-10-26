/**
 * Reconnaître le vendeur — Finances, phase 3 bis a.
 *
 * Déterministe, local, **sans IA et sans réseau**. Aucun enrichissement
 * extérieur, aucun logo, aucune icône distante : ce module ne sait rien
 * qu'il n'ait reçu en paramètre ou lu dans le dictionnaire embarqué.
 *
 * ## Le bruit qu'on retire, et celui qu'on garde
 *
 * Un libellé de relevé est un en-tête de transport mêlé à un nom. On retire
 * les mentions de paiement, les dates, les références, les codes de
 * terminal. On **ne retire pas** les villes : il faudrait embarquer les
 * trente-cinq mille communes de France pour un gain marginal, et
 * « CARREFOUR CITY TOURNAY » se reconnaît très bien par son début.
 *
 * On ne retire pas non plus `RETRAIT` ni `VIREMENT`, qui ressemblent à de la
 * plomberie mais n'en sont pas : ce sont les **motifs génériques** qui
 * attrapent les lignes qu'aucun dictionnaire d'enseignes ne couvre, et ils
 * sont la part la plus sûre du dictionnaire.
 *
 * ## L'ordre de résolution, et pourquoi mes règles passent devant
 *
 * Le dictionnaire est écrit sans avoir vu les relevés de la personne ; elle
 * les a sous les yeux. Une règle qu'elle a confirmée l'emporte donc sur une
 * entrée embarquée, toujours, et sans que cela se discute.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne pointe rien. Il **reconnaît** : il rend un vendeur, un type, une
 * certitude et une source. Décider s'il faut pointer automatiquement est une
 * politique, et elle vit ailleurs — mélanger la reconnaissance et la
 * décision rendrait impossible de rejouer l'une sans toucher à l'autre.
 */
import { pluriel } from '../noyau/accords';
import { normaliser } from './appariement';
import { typeDe, type TypeDeVendeur } from './taxonomie';

/* ══════════════════════════════════════════════════════════════════════════
   Normaliser le libellé
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les mentions de transport, retirées en tête de libellé.
 *
 * `RETRAIT`, `VIREMENT`, `COTISATION`, `FRAIS`, `CHEQUE` n'y sont **pas** :
 * ce sont des motifs génériques utiles, pas du bruit.
 */
export const MENTIONS_DE_PAIEMENT: readonly string[] = [
  'CB', 'PAIEMENT', 'ACHAT', 'FACT', 'FACTURE',
  'PRLV', 'PRELEVEMENT', 'PRELV', 'SEPA', 'TIP', 'ECH', 'DEBIT',
];

/**
 * Le bruit retiré **avant** la normalisation, tant que les séparateurs sont
 * encore là.
 *
 * L'ordre n'est pas un détail : `normaliser()` remplace `/` et `:` par des
 * espaces, après quoi une date `12/10` est devenue `12 10` et ne ressemble
 * plus à une date. Mon premier jet cherchait les dates après — il ne les
 * trouvait jamais, et le garde-fou l'a dit.
 *
 * `CARTE` est ici, et seulement suivi de chiffres : seul, c'est un nom
 * (« carte grise »), pas une mention de paiement.
 */
const BRUITS_AVANT: readonly RegExp[] = [
  /\b\d{2}[/.\-]\d{2}([/.\-]\d{2,4})?\b/g, // 12/10, 12.10.26
  /\bREF\s*:?\s*\S+/gi,
  /\bN[O°]?\s*\d{4,}\b/gi,
  /●{2,}\s*\d{0,4}/g,
  /\bCARTE\s*\d+\b/gi,
];

/** Et le bruit qui ne se voit qu'une fois normalisé. */
const BRUITS_APRES: readonly RegExp[] = [
  /\b\d{6,}\b/g, // toute suite d'au moins six chiffres
];

export function libelleNet(brut: string): string {
  let net = brut;
  for (const bruit of BRUITS_AVANT) net = net.replace(bruit, ' ');
  net = normaliser(net);
  for (const bruit of BRUITS_APRES) net = net.replace(bruit, ' ');
  net = net.replace(/\s+/g, ' ').trim();

  /*
     Les mentions, une par une, et seulement tant qu'elles sont **en tête**.
     Retirer les mentions partout effacerait « CARTE » de « CARTE GRISE » et
     « DEBIT » de « DEBIT DIRECT SARL », qui sont des noms.

     La boucle s'arrête aussi quand il ne resterait plus rien d'autre qu'un
     mot : « PRLV SEPA » tout seul n'est pas un vendeur, mais le réduire à
     rien perdrait la seule chose qu'on sache de l'opération.
  */
  let change = true;
  while (change) {
    change = false;
    for (const m of MENTIONS_DE_PAIEMENT) {
      if (net === m) return net;
      if (net.startsWith(`${m} `)) {
        net = net.slice(m.length + 1);
        change = true;
      }
    }
  }
  /*
     Et les quatre chiffres de fin, qui sont presque toujours un reste de
     numéro de carte ou de terminal. Quatre, pas plus : un nombre plus long
     est déjà parti avec les bruits, et un nombre plus court peut être un
     numéro de rue.
  */
  net = net.replace(/\s\d{4}$/, '');
  return net.replace(/\s+/g, ' ').trim();
}

/**
 * Les intermédiaires de paiement, et le vendeur final quand il se lit.
 *
 * « PAYPAL *FOURNIL » porte son vendeur ; « PAYPAL 4039035165 » ne le porte
 * pas. Le second cas n'est pas un échec de lecture, c'est une absence : le
 * type « intermédiaire de paiement » le dit plutôt que de deviner.
 */
export const INTERMEDIAIRES: readonly string[] = [
  'PAYPAL', 'SUMUP', 'STRIPE', 'LYDIA', 'PAYLIB', 'SYSTEMPAY', 'MOLLIE',
  'ZETTLE', 'IZETTLE', 'REVOLUT PAY', 'APPLE PAY', 'GOOGLE PAY',
];

export interface LibelleLu {
  net: string;
  /** L'intermédiaire traversé, s'il y en a un. */
  intermediaire: string | null;
  /** Vrai quand un intermédiaire a été vu sans vendeur final lisible. */
  vendeurFinalIllisible: boolean;
}

export function lireLeLibelle(brut: string): LibelleLu {
  const net = libelleNet(brut);
  for (const i of INTERMEDIAIRES) {
    if (!net.startsWith(i)) continue;
    const reste = net.slice(i.length).replace(/^[\s*]+/, '').trim();
    /*
       Ce qui reste doit ressembler à un nom : au moins trois caractères, et
       pas seulement des chiffres. « PAYPAL 4039035165 » ne nomme personne.
    */
    const nomme = reste.length >= 3 && !/^\d+$/.test(reste);
    return { net: nomme ? reste : net, intermediaire: i, vendeurFinalIllisible: !nomme };
  }
  return { net, intermediaire: null, vendeurFinalIllisible: false };
}

/* ══════════════════════════════════════════════════════════════════════════
   L'appariement approché
   ══════════════════════════════════════════════════════════════════════════ */

/** Les caractères sur lesquels la ressemblance se mesure. */
export const LONGUEUR_COMPAREE = 30;
/** En deçà, deux libellés ne sont pas le même vendeur. Mesuré, pas décrété. */
export const SEUIL_RESSEMBLANCE = 0.85;

export function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const courante = [i];
    for (let j = 1; j <= b.length; j += 1) {
      courante[j] = Math.min(
        precedente[j] + 1,
        courante[j - 1] + 1,
        precedente[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    precedente = courante;
  }
  return precedente[b.length];
}

/** De 0 (rien de commun) à 1 (identiques), sur les trente premiers caractères. */
export function ressemblance(a: string, b: string): number {
  const x = a.slice(0, LONGUEUR_COMPAREE);
  const y = b.slice(0, LONGUEUR_COMPAREE);
  const plus = Math.max(x.length, y.length);
  if (plus === 0) return 1;
  return 1 - distance(x, y) / plus;
}

/* ══════════════════════════════════════════════════════════════════════════
   Ce qu'on connaît
   ══════════════════════════════════════════════════════════════════════════ */

/** Un vendeur appris : nom canonique, alias vus, type retenu. */
export interface Vendeur {
  id: string;
  nom: string;
  typeId: string;
  /** Les libellés nets déjà rattachés à ce vendeur. */
  alias: readonly string[];
  /** Combien d'opérations lui ont été rattachées. */
  vu: number;
  majLe: string;
}

/** Une règle écrite par la personne. Elle prime sur tout le reste. */
export interface RegleDePointage {
  id: string;
  /** Le nom canonique que la règle impose. */
  nom: string;
  typeId: string;
  motif: string;
  comparaison: 'contient' | 'commence' | 'exact';
  /** `auto`, `proposer` ou `manuel`. Jamais `auto` par défaut. */
  mode: 'auto' | 'proposer' | 'manuel';
  /** La ligne de budget visée, si la règle en désigne une. */
  ligneId: string | null;
  appliquee: number;
  corrigee: number;
  majLe: string;
}

/** Une entrée du dictionnaire embarqué. */
export interface EntreeDuDictionnaire {
  motifs: readonly string[];
  nom: string;
  typeId: string;
  /**
   * `sur` : le **nom** n'est pas ambigu, un seul type est possible.
   *
   * Ce n'est pas une autorisation de pointer seul — celle-là vient de
   * `jamaisAuto` sur le type. « URSSAF » est un nom parfaitement non
   * ambigu et ne sera jamais pointé automatiquement.
   */
  statut: 'sur' | 'ambigu';
  /**
   * Vrai pour un motif qui ne nomme aucune enseigne : `RETRAIT`,
   * `COTISATION`, `ABONNEMENT`, `SALAIRE`.
   *
   * Ils sont un **filet**, jamais un concurrent. Sans cette distinction,
   * « PRELEVEMENT SFR ABONNEMENT » se classe en « Abonnement » parce que le
   * mot générique est plus long que l'enseigne — ce que la mesure sur le
   * jeu synthétique a montré sur quatre libellés d'un coup.
   */
  generique?: boolean;
}

export type Certitude = 'certain' | 'probable' | 'inconnu';
export type SourceDuVendeur =
  | 'ma-regle'
  | 'mon-historique'
  | 'dictionnaire'
  | 'categorie-de-la-banque'
  | 'aucune';

export interface Reconnaissance {
  /** Le libellé réduit, tel qu'il a servi. */
  net: string;
  /** `null` quand rien n'a été reconnu. */
  nom: string | null;
  typeId: string | null;
  certitude: Certitude;
  source: SourceDuVendeur;
  /** La règle ou l'entrée qui a tranché, pour « Pourquoi ce pointage ? ». */
  parQuoi: string | null;
  /** La ressemblance, quand c'est l'historique qui a tranché. */
  ressemblance: number | null;
  /** Vrai quand un intermédiaire a masqué le vendeur final. */
  parIntermediaire: boolean;
}

export interface Connaissance {
  regles: readonly RegleDePointage[];
  vendeurs: readonly Vendeur[];
  dictionnaire: readonly EntreeDuDictionnaire[];
  /** La catégorie que la banque fournit, si l'export en contient une. */
  categorieDeLaBanque?: string | null;
}

/**
 * Où un motif commence dans un libellé, **sur des mots entiers**.
 *
 * `-1` s'il n'y est pas. La frontière de mot n'est pas un raffinement : sans
 * elle, « BOULANGERIE PAUL ET MARIE » contient « BOULANGER » et une
 * boulangerie de quartier se classe en magasin d'électroménager. La mesure
 * sur le jeu synthétique l'a montré, et c'est le genre de faute qu'on ne
 * verrait jamais en relisant le dictionnaire — l'entrée « Boulanger » y est
 * parfaitement juste.
 *
 * Le libellé net ne contient que des lettres, des chiffres et des espaces :
 * une frontière est donc un début de chaîne, une fin, ou une espace.
 */
export function positionDuMotif(net: string, motif: string): number {
  if (!motif) return -1;
  let depuis = 0;
  for (;;) {
    const ou = net.indexOf(motif, depuis);
    if (ou === -1) return -1;
    const avant = ou === 0 || net[ou - 1] === ' ';
    const fin = ou + motif.length;
    const apres = fin === net.length || net[fin] === ' ';
    if (avant && apres) return ou;
    depuis = ou + 1;
  }
}

function motifColle(net: string, r: RegleDePointage): boolean {
  const m = normaliser(r.motif);
  if (!m) return false;
  if (r.comparaison === 'exact') return net === m;
  if (r.comparaison === 'commence') return net.startsWith(m);
  return positionDuMotif(net, m) !== -1;
}

/**
 * Reconnaître le vendeur d'un libellé.
 *
 * L'ordre est celui du plan, et le premier rang qui répond gagne :
 *
 * | Rang | Source | Certitude |
 * |---|---|---|
 * | 1 | mes règles | **certain** |
 * | 2 | un vendeur déjà vu, au-dessus du seuil | probable |
 * | 3 | dictionnaire, entrée « sûr » | **certain** |
 * | 4 | dictionnaire, entrée « ambigu » | probable |
 * | 5 | catégorie fournie par la banque | probable |
 * | 6 | rien | inconnu |
 *
 * Le rang 2 passe avant le dictionnaire : un vendeur que la personne a déjà
 * rattaché une fois en dit plus long sur ses relevés qu'une entrée écrite
 * sans les avoir vus.
 */
export function reconnaitre(libelle: string, su: Connaissance): Reconnaissance {
  const lu = lireLeLibelle(libelle);
  const net = lu.net;
  const base = {
    net,
    parIntermediaire: lu.intermediaire !== null,
  };

  /* 1. Mes règles. */
  const regle = su.regles.find((r) => motifColle(net, r));
  if (regle) {
    return {
      ...base, nom: regle.nom, typeId: regle.typeId, certitude: 'certain',
      source: 'ma-regle', parQuoi: `votre règle « ${regle.motif} »`, ressemblance: null,
    };
  }

  /* 2. Un vendeur déjà vu. */
  let meilleur: { v: Vendeur; r: number } | null = null;
  for (const v of su.vendeurs) {
    for (const alias of v.alias) {
      const r = ressemblance(net, alias);
      if (r >= SEUIL_RESSEMBLANCE && (!meilleur || r > meilleur.r)) meilleur = { v, r };
    }
  }
  if (meilleur) {
    return {
      ...base, nom: meilleur.v.nom, typeId: meilleur.v.typeId, certitude: 'probable',
      source: 'mon-historique',
      parQuoi: `ressemblance de ${Math.round(meilleur.r * 100)} % avec « ${meilleur.v.nom} »`,
      ressemblance: meilleur.r,
    };
  }

  /*
     3 et 4. Le dictionnaire. Le motif le plus **long** qui colle gagne :
     « CARREFOUR CITY » distingue là où « CARREFOUR » confond, et ici la
     dissymétrie va dans l'autre sens qu'à la détection de récurrences —
     parce qu'il ne s'agit plus de rassembler des opérations mais de nommer
     la plus précise des enseignes qui correspondent.
  */
  /*
     3 et 4. Le dictionnaire, en **deux passes**.

     Les entrées nommées d'abord, les génériques seulement si rien n'a
     répondu : un motif générique est un filet, et le laisser concourir à
     armes égales le fait gagner dès qu'il est plus long que l'enseigne.

     Au sein d'une passe, le **premier** motif dans le libellé gagne, et à
     position égale le plus long. La position d'abord, parce que le
     commerçant est en tête : « FNAC DARTY PARTICIPATIONS » est une Fnac, et
     la règle de la longueur seule y voyait un Darty. La longueur ensuite,
     parce que « CARREFOUR CITY » et « CARREFOUR » commencent tous deux au
     même endroit et que le plus précis doit l'emporter.
  */
  const chercher = (generiques: boolean) => {
    let meilleure: { e: EntreeDuDictionnaire; motif: string; ou: number } | null = null;
    for (const e of su.dictionnaire) {
      if (Boolean(e.generique) !== generiques) continue;
      for (const motif of e.motifs) {
        const ou = positionDuMotif(net, motif);
        if (ou === -1) continue;
        const mieux =
          !meilleure || ou < meilleure.ou
          || (ou === meilleure.ou && motif.length > meilleure.motif.length);
        if (mieux) meilleure = { e, motif, ou };
      }
    }
    return meilleure;
  };
  const trouvee = chercher(false) ?? chercher(true);
  if (trouvee) {
    return {
      ...base, nom: trouvee.e.nom, typeId: trouvee.e.typeId,
      certitude: trouvee.e.statut === 'sur' ? 'certain' : 'probable',
      source: 'dictionnaire',
      parQuoi:
        `dictionnaire embarqué, motif « ${trouvee.motif} » (${trouvee.e.statut}` +
        `${trouvee.e.generique ? ', générique' : ''})`,
      ressemblance: null,
    };
  }

  /*
     Un intermédiaire sans vendeur final lisible : on le dit, plutôt que de
     rendre « inconnu » et d'envoyer la personne chercher un nom qui n'est
     pas dans le libellé.
  */
  if (lu.vendeurFinalIllisible) {
    return {
      ...base, nom: lu.intermediaire, typeId: 'intermediaire-de-paiement',
      certitude: 'probable', source: 'dictionnaire',
      parQuoi: `intermédiaire « ${lu.intermediaire} » sans vendeur final lisible`,
      ressemblance: null,
    };
  }

  /* 5. La catégorie de la banque, indice de moindre poids. */
  if (su.categorieDeLaBanque) {
    return {
      ...base, nom: null, typeId: null, certitude: 'probable',
      source: 'categorie-de-la-banque',
      parQuoi: `catégorie fournie par la banque : « ${su.categorieDeLaBanque} »`,
      ressemblance: null,
    };
  }

  /* 6. Rien. */
  return {
    ...base, nom: null, typeId: null, certitude: 'inconnu', source: 'aucune',
    parQuoi: null, ressemblance: null,
  };
}

export const typeReconnu = (r: Reconnaissance): TypeDeVendeur | undefined =>
  r.typeId ? typeDe(r.typeId) : undefined;

/* ══════════════════════════════════════════════════════════════════════════
   Grouper les inconnus
   ══════════════════════════════════════════════════════════════════════════ */

export interface VendeurInconnu {
  /** Le libellé net le plus fréquent du groupe, qui lui sert de nom. */
  net: string;
  /** Tous les libellés bruts rassemblés, pour l'aperçu. */
  libelles: readonly string[];
  operationIds: readonly string[];
  cumule: number;
}

/**
 * Les vendeurs inconnus, **un par ligne, jamais une opération par ligne**.
 *
 * C'est la règle qui décide si l'écran sert à quelque chose. Six vendeurs
 * couvrant quatorze opérations font six lignes ; en faire quatorze, dont
 * huit sont le même commerçant, est exactement ce qui fait abandonner.
 *
 * Le regroupement se fait sur la ressemblance, pas sur l'égalité : les
 * références, les dates et les villes font varier un même libellé d'une
 * opération à l'autre.
 */
export function grouperLesInconnus(
  operations: readonly { id: string; libelle: string; centimes: number }[],
  su: Connaissance,
): VendeurInconnu[] {
  const groupes: { net: string; libelles: string[]; ids: string[]; cumule: number }[] = [];
  for (const o of operations) {
    const r = reconnaitre(o.libelle, su);
    if (r.certitude !== 'inconnu') continue;
    const proche = groupes.find((g) => ressemblance(g.net, r.net) >= SEUIL_RESSEMBLANCE);
    if (proche) {
      proche.libelles.push(o.libelle);
      proche.ids.push(o.id);
      proche.cumule += Math.abs(o.centimes);
    } else {
      groupes.push({ net: r.net, libelles: [o.libelle], ids: [o.id], cumule: Math.abs(o.centimes) });
    }
  }
  return groupes
    .map((g) => ({
      net: g.net, libelles: g.libelles, operationIds: g.ids, cumule: g.cumule,
    }))
    /* Par montant cumulé, puis par nombre : le plus coûteux d'abord. */
    .sort((a, b) => b.cumule - a.cumule || b.operationIds.length - a.operationIds.length);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les garde-fous d'un motif
   ══════════════════════════════════════════════════════════════════════════ */

/** En deçà, un motif attrape n'importe quoi. */
export const MOTIF_LONGUEUR_MINIMALE = 4;

/** Les mots trop courants pour distinguer un vendeur d'un autre. */
export const MOTS_TROP_COURANTS: readonly string[] = [
  ...MENTIONS_DE_PAIEMENT,
  'VIR', 'VIREMENT', 'RETRAIT', 'FRAIS', 'COTISATION', 'CHEQUE', 'INTERETS',
  'FRANCE', 'PARIS', 'SARL', 'SAS', 'EURL', 'SCI', 'SOCIETE', 'MAGASIN',
  'BOUTIQUE', 'CENTRE', 'SERVICE', 'SERVICES', 'GROUPE',
];

export interface AvisSurLeMotif {
  /** Faux quand le motif doit être refusé. */
  acceptable: boolean;
  /** Les libellés qu'il attraperait et qui ne sont pas du groupe visé. */
  deTrop: readonly string[];
  /** La phrase à montrer. Vide quand tout va bien. */
  avertissement: string;
}

/**
 * Ce qu'un motif attraperait, avant qu'il soit enregistré.
 *
 * Un motif trop court ou trop courant est refusé ; un motif qui attrape des
 * libellés hors du groupe visé est accepté **avec l'aperçu de ce qu'il
 * prend**. La différence tient à qui décide : un motif de deux lettres est
 * une faute, un motif qui déborde peut être exactement ce qu'on veut.
 */
export function examinerLeMotif(
  motif: string,
  vises: readonly string[],
  tousLesLibelles: readonly string[],
): AvisSurLeMotif {
  const m = normaliser(motif);
  if (m.length < MOTIF_LONGUEUR_MINIMALE) {
    return {
      acceptable: false, deTrop: [],
      avertissement:
        `Un motif de moins de ${MOTIF_LONGUEUR_MINIMALE} caractères attrape n’importe quoi. ` +
        'Allongez-le.',
    };
  }
  if (MOTS_TROP_COURANTS.includes(m)) {
    return {
      acceptable: false, deTrop: [],
      avertissement:
        `« ${m} » apparaît sur une grande part des lignes d’un relevé et ne distingue aucun ` +
        'vendeur.',
    };
  }
  const visesNets = new Set(vises.map((l) => libelleNet(l)));
  const deTrop = [
    ...new Set(
      tousLesLibelles.filter((l) => libelleNet(l).includes(m) && !visesNets.has(libelleNet(l))),
    ),
  ];
  return {
    acceptable: true,
    deTrop,
    avertissement: deTrop.length
      ? `Ce motif attraperait aussi ${pluriel(deTrop.length, 'libellé')} d’un autre commerçant.`
      : '',
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou du module
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerLaReconnaissance(): string[] {
  const problemes: string[] = [];

  if (SEUIL_RESSEMBLANCE <= 0.7) {
    problemes.push(
      `Un seuil de ressemblance de ${SEUIL_RESSEMBLANCE} confondrait deux enseignes voisines. ` +
        'Le plan exige qu’un vendeur proche mais différent ne soit pas confondu.',
    );
  }
  if (SEUIL_RESSEMBLANCE >= 0.98) {
    problemes.push(
      'Un seuil proche de 1 ne reconnaîtrait plus un libellé dont la banque a changé une ' +
        'référence, ce qui est le cas que l’appariement approché existe pour couvrir.',
    );
  }

  /*
     Les motifs génériques ne doivent **pas** être retirés par la
     normalisation : ils sont la part la plus sûre du dictionnaire, et les
     effacer rendrait les retraits et les virements illisibles.
  */
  for (const garde of ['RETRAIT', 'VIREMENT', 'COTISATION', 'FRAIS', 'CHEQUE']) {
    if (!libelleNet(`${garde} DAB GARE`).startsWith(garde)) {
      problemes.push(
        `La normalisation efface « ${garde} », qui est un motif générique utile et non du bruit.`,
      );
    }
  }

  /* Et la plomberie, elle, doit partir. */
  if (libelleNet('CB CARREFOUR CITY TOURNAY 1210') !== 'CARREFOUR CITY TOURNAY') {
    problemes.push(
      `La normalisation d’un libellé de carte est fausse : « ${libelleNet('CB CARREFOUR CITY TOURNAY 1210')} ».`,
    );
  }

  /*
     « CARTE GRISE » est un nom, pas une mention de paiement. Retirer les
     mentions partout plutôt qu'en tête l'aurait effacé.
  */
  if (!libelleNet('PRLV CARTE GRISE ANTS').includes('CARTE GRISE')) {
    problemes.push(
      'La normalisation efface « CARTE GRISE ». Les mentions de paiement ne se retirent ' +
        'qu’en tête de libellé, sans quoi elles mangent des noms.',
    );
  }

  if (MOTIF_LONGUEUR_MINIMALE < 4) {
    problemes.push('Un motif de moins de quatre caractères attrape n’importe quoi.');
  }
  return problemes;
}
