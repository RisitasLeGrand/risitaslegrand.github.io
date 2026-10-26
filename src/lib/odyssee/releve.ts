/**
 * Lire un relevé bancaire, et refuser de le croire sans preuve.
 *
 * ## Ce module ne connaît pas les PDF
 *
 * Il reçoit des **morceaux de texte positionnés** — page, abscisse, ordonnée,
 * contenu — et rend des comptes et des opérations. C'est un adaptateur qui
 * appelle pdf.js et lui donne cette forme ; le même analyseur sert donc à un
 * collage depuis le site d'une banque, où les positions viennent des cellules
 * d'un tableau.
 *
 * La raison n'est pas l'élégance : c'est qu'un analyseur de relevés doit
 * s'éprouver sur des cas tordus, et qu'on ne fabrique pas un PDF tordu à la
 * demande. Avec des morceaux, on écrit le cas en six lignes.
 *
 * ## Le signe est une position, pas un mot
 *
 * Mesuré sur deux relevés CIC : débit et crédit sont deux colonnes, séparées
 * d'une cinquantaine de points, et l'extraction linéaire les écrase — un
 * débit et un crédit finissent à la même colonne de caractères. Le signe est
 * donc **perdu** par toute lecture qui ne garde pas les abscisses.
 *
 * La frontière entre les deux colonnes s'ancre sur l'**en-tête imprimé**
 * (« Débit » / « Crédit »), relu **à chaque page** : sur ces relevés, les
 * pages paires sont décalées de dix points — marge recto-verso. À défaut
 * d'en-tête, on retombe sur le plus grand écart entre abscisses, mais
 * seulement si les deux groupes existent vraiment : un relevé d'une page sans
 * aucun crédit n'a qu'un groupe, et découper au milieu inventerait une
 * séparation.
 *
 * ## Rien n'est importé tant que le solde ne boucle pas
 *
 * Le relevé imprime ses propres soldes d'ouverture et de clôture : le
 * contrôle est donc **gratuit et total**. Ce n'est pas un échantillon vérifié,
 * c'est l'intégralité des opérations qui doit se recomposer au centime.
 *
 * Ce n'est pas une précaution, c'est la condition. Un premier analyseur,
 * écrit avec soin, perdait onze opérations sur 278 à cause d'un caractère
 * isolé dans la marge, **sans rien signaler** : 267 lignes plausibles
 * ressemblent exactement à 278 lignes plausibles. Seul le solde l'a dit.
 */
import { accorde, nombreFr, pluriel } from '../noyau/accords';
import { centimesDe, type Centimes } from './finances';

/* ══════════════════════════════════════════════════════════════════════════
   L'entrée
   ══════════════════════════════════════════════════════════════════════════ */

export interface Morceau {
  page: number;
  /** Abscisse du coin gauche, en points typographiques. */
  x: number;
  /** Ordonnée, croissante vers le haut (convention PDF). */
  y: number;
  texte: string;
}

/** Une ligne reconstituée : les morceaux d'une même ordonnée, de gauche à droite. */
export interface LigneLue {
  page: number;
  y: number;
  morceaux: readonly Morceau[];
  texte: string;
}

/** Deux morceaux à moins de ce nombre de points sont sur la même ligne. */
export const TOLERANCE_LIGNE = 2;

/**
 * Groupe par **proximité**, et non par arrondi sur une grille.
 *
 * Arrondir `y` à un pas de deux points paraît équivalent et ne l'est pas :
 * deux fragments d'une même ligne posés à 99,9 et 100,1 tombent de part et
 * d'autre d'une frontière de grille et se retrouvent sur deux lignes
 * différentes. Les bases de ligne d'un PDF ne sont pas parfaitement alignées
 * — l'accentuation, les changements de police et les positionnements
 * relatifs introduisent exactement ce genre de dixièmes de point.
 *
 * On trie donc par ordonnée décroissante (le PDF compte depuis le bas) et on
 * ouvre une nouvelle ligne quand l'écart dépasse la tolérance. Un seuil sur
 * une distance n'a pas de frontière arbitraire : seule la distance compte.
 */
export function reconstituerLignes(morceaux: readonly Morceau[]): LigneLue[] {
  const utiles = morceaux.filter((m) => m.texte.trim());
  const parPage = new Map<number, Morceau[]>();
  for (const m of utiles) {
    if (!parPage.has(m.page)) parPage.set(m.page, []);
    parPage.get(m.page)!.push(m);
  }

  const lignes: LigneLue[] = [];
  for (const page of [...parPage.keys()].sort((a, b) => a - b)) {
    const tries = [...parPage.get(page)!].sort((a, b) => b.y - a.y);
    let groupe: Morceau[] = [];
    const clore = () => {
      if (!groupe.length) return;
      const ordonnes = [...groupe].sort((a, b) => a.x - b.x);
      lignes.push({
        page,
        /* L'ordonnée de la ligne est celle du premier morceau rencontré, donc
           la plus haute : une valeur du document, et non une moyenne inventée. */
        y: groupe[0].y,
        morceaux: ordonnes,
        texte: ordonnes.map((m) => m.texte.trim()).join(' '),
      });
      groupe = [];
    };
    for (const m of tries) {
      if (groupe.length && groupe[groupe.length - 1].y - m.y > TOLERANCE_LIGNE) clore();
      groupe.push(m);
    }
    clore();
  }
  return lignes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Reconnaître
   ══════════════════════════════════════════════════════════════════════════ */

export const MONTANT = /^\d{1,3}(?:[.  ]\d{3})*,\d{2}$/;
export const DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const SOLDE = /SOLDE\s+(CREDITEUR|DEBITEUR)\s+AU\s+(\d{2}\/\d{2}\/\d{4})/i;
const ENTETE_COMPTE = /^(C\/C|LIVRET|PEL|CEL|PEA|COMPTE|PLAN|COMPTE-TITRES)\b/i;
const ENTETE_COLONNES = { debit: /^D[ée]bit\b/i, credit: /^Cr[ée]dit\b/i };

/** Une date au format français vers un jour logique ISO. */
export function jourDe(jjmmaaaa: string): string {
  return `${jjmmaaaa.slice(6, 10)}-${jjmmaaaa.slice(3, 5)}-${jjmmaaaa.slice(0, 2)}`;
}

/**
 * La date n'est pas toujours le premier morceau.
 *
 * Onze lignes sur 278, dans le relevé mesuré, portent un caractère isolé dans
 * la marge — un « 2 », un « X », un « V ». Exiger la date en tête les écarte
 * **en silence**, et c'est ce qui faisait rater 30 €, 125 € et 78,14 € sur
 * trois comptes. On la cherche donc dans les deux premiers morceaux, et pas
 * au-delà : plus loin, ce serait une date citée dans un libellé.
 */
export const MORCEAUX_AVANT_LA_DATE = 1;

export function indexDeLaDate(l: LigneLue): number {
  const i = l.morceaux.findIndex((m) => DATE.test(m.texte.trim()));
  return i >= 0 && i <= MORCEAUX_AVANT_LA_DATE ? i : -1;
}

/* ══════════════════════════════════════════════════════════════════════════
   La frontière débit / crédit
   ══════════════════════════════════════════════════════════════════════════ */

export type OrigineFrontiere = 'en-tête' | 'écart' | 'aucune';

export interface Frontiere {
  x: number | null;
  origine: OrigineFrontiere;
  /** Pourquoi, en une phrase affichable. */
  raison: string;
}

/** En deçà, deux groupes d'abscisses ne sont pas deux colonnes. */
export const ECART_MINIMAL_ENTRE_COLONNES = 20;

/** L'en-tête de colonnes d'une ligne, s'il y en est un. */
export function frontiereDeLEntete(l: LigneTrouvee): number | null {
  const debit = l.morceaux.find((m) => ENTETE_COLONNES.debit.test(m.texte.trim()));
  const credit = l.morceaux.find((m) => ENTETE_COLONNES.credit.test(m.texte.trim()));
  return debit && credit && credit.x > debit.x ? credit.x : null;
}
type LigneTrouvee = LigneLue;

/**
 * À défaut d'en-tête : le plus grand écart entre abscisses de montants.
 *
 * **Et seulement si les deux groupes existent.** C'est la précaution qui
 * manquait au premier jet : sur un relevé d'une page sans aucun crédit, les
 * abscisses forment un seul paquet, et couper au milieu du plus grand écart
 * interne inventerait une colonne de crédits. Le refus est préférable à une
 * lecture plausible et fausse.
 */
export function frontiereParEcart(abscisses: readonly number[]): Frontiere {
  const tries = [...new Set(abscisses)].sort((a, b) => a - b);
  if (tries.length < 2) {
    return {
      x: null,
      origine: 'aucune',
      raison: 'Un seul montant : impossible de distinguer les colonnes.',
    };
  }
  let meilleur = 0;
  let coupe = 0;
  for (let i = 1; i < tries.length; i += 1) {
    const ecart = tries[i] - tries[i - 1];
    if (ecart > meilleur) {
      meilleur = ecart;
      coupe = (tries[i] + tries[i - 1]) / 2;
    }
  }
  if (meilleur < ECART_MINIMAL_ENTRE_COLONNES) {
    return {
      x: null,
      origine: 'aucune',
      raison:
        `Les montants sont tous dans la même colonne (écart maximal ${Math.round(meilleur)} pt). ` +
        'Sans en-tête imprimé, impossible de dire lesquels sont des débits.',
    };
  }
  return {
    x: coupe,
    origine: 'écart',
    raison: `Colonnes déduites d’un vide de ${Math.round(meilleur)} points, faute d’en-tête.`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   L'empreinte de gabarit
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qui identifie une **mise en page**, et rien d'autre.
 *
 * Ni nom, ni numéro, ni montant, ni date : une description de forme, qu'on
 * peut conserver sans conserver le relevé. C'est elle qui permet de ne plus
 * rien demander dès le deuxième import d'une même banque — et d'annoncer
 * « la mise en page a changé » avant même de lire les montants.
 *
 * Mesurée identique sur deux relevés CIC à un an d'écart, neuf et dix pages.
 */
export function empreinteDeGabarit(lignes: readonly LigneLue[], producteur: string): string {
  for (const l of lignes) {
    const debit = l.morceaux.find((m) => ENTETE_COLONNES.debit.test(m.texte.trim()));
    const credit = l.morceaux.find((m) => ENTETE_COLONNES.credit.test(m.texte.trim()));
    if (!debit || !credit) continue;
    const colonnes = l.morceaux
      .map((m) => `${m.texte.trim()}@${Math.round(m.x)}`)
      .join('|');
    return `${producteur} ~ ${colonnes}`;
  }
  return `${producteur} ~ sans en-tête de colonnes`;
}

/**
 * L'intitulé d'un compte, débarrassé de tout ce qui ressemble à un numéro.
 *
 * Le nom imprimé sert de clé — un relevé ne porte aucun identifiant qu'on
 * accepte d'enregistrer. Mais il porte le numéro de compte juste à côté, et
 * le garder reviendrait à stocker par la bande ce que C.7 interdit
 * frontalement.
 *
 * Trois coupes successives, parce qu'une seule ne suffit pas : la mention
 * « N° » ou « Réf » et sa suite, la mention de devise, puis **toute suite de
 * chiffres restante**. La troisième attrape le cas qui a mordu — un relevé
 * où le « ° » manquait, et où « N 00055347 » survivait aux deux premières.
 */
export function nettoyerLeNom(texte: string): string {
  return (
    texte
      /* « N° 123 », « N 123 », « Réf : 009 » et tout ce qui suit. */
      .replace(/\s*\b(?:N[°ºo]?|R[ée]f\.?)\s*[:°]?\s*\d.*$/i, '')
      .replace(/\s+en\s+euros.*$/i, '')
      /* Toute suite de chiffres restante, où qu'elle soit. */
      .replace(/(?:\d[\s-]?){3,}/g, ' ')
      /* Ce que les coupes laissent derrière : parenthèses vides, ponctuation
         orpheline, lettre isolée en fin — « … PARCOURS.J+ N » devenait un nom. */
      .replace(/\(\s*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s:;,.\-]+$/, '')
      .replace(/\s+[A-Z]$/, '')
      .trim()
      .slice(0, 60)
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Le résultat
   ══════════════════════════════════════════════════════════════════════════ */

export interface OperationLue {
  jour: string;
  libelle: string;
  /** Signé : négatif pour un débit. */
  centimes: Centimes;
  page: number;
}

export interface CompteLu {
  nom: string;
  ouverture: { jour: string; centimes: Centimes } | null;
  cloture: { jour: string; centimes: Centimes } | null;
  operations: OperationLue[];
}

export type Verdict = 'boucle' | 'ecart' | 'invérifiable';

export interface ControleDeCompte {
  nom: string;
  verdict: Verdict;
  calcule: Centimes | null;
  imprime: Centimes | null;
  /** Positif : le relevé annonce plus que nos opérations. */
  ecart: Centimes | null;
  operations: number;
  message: string;
}

export interface Lecture {
  comptes: CompteLu[];
  controles: ControleDeCompte[];
  empreinte: string;
  /** Vrai seulement si **tous** les comptes bouclent. */
  importable: boolean;
  /** Ce qui a empêché de lire, le cas échéant. */
  refus: string | null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Lire
   ══════════════════════════════════════════════════════════════════════════ */

export function lireReleve(
  morceaux: readonly Morceau[],
  options: { producteur?: string } = {},
): Lecture {
  const lignes = reconstituerLignes(morceaux);
  const empreinte = empreinteDeGabarit(lignes, options.producteur ?? 'inconnu');

  const comptes = new Map<string, CompteLu>();
  let courant: CompteLu | null = null;
  let frontiere: Frontiere = { x: null, origine: 'aucune', raison: 'Aucun en-tête rencontré.' };
  let page = -1;
  const sansFrontiere: number[] = [];

  for (const l of lignes) {
    /*
       L'en-tête se relit à **chaque page** : les pages paires du relevé
       mesuré sont décalées de dix points. Une frontière unique pour tout le
       document finirait par trancher au mauvais endroit.
    */
    if (l.page !== page) page = l.page;
    const depuisEntete = frontiereDeLEntete(l);
    if (depuisEntete !== null) {
      frontiere = {
        x: depuisEntete,
        origine: 'en-tête',
        raison: 'Colonnes lues sur l’en-tête imprimé de la page.',
      };
      continue;
    }

    const montants = l.morceaux.filter((m) => MONTANT.test(m.texte.trim()));
    const solde = SOLDE.exec(l.texte);

    if (ENTETE_COMPTE.test(l.texte) && indexDeLaDate(l) === -1 && !solde) {
      const nom = nettoyerLeNom(l.texte);
      if (!comptes.has(nom)) {
        comptes.set(nom, { nom, ouverture: null, cloture: null, operations: [] });
      }
      courant = comptes.get(nom)!;
      continue;
    }
    if (!courant) continue;

    if (solde && montants.length >= 1) {
      const signe = /DEBITEUR/i.test(solde[1]) ? -1 : 1;
      const valeur = centimesDe(montants[montants.length - 1].texte);
      if (valeur === null) continue;
      const point = { jour: jourDe(solde[2]), centimes: signe * valeur };
      /*
         Le plus ancien est l'ouverture, le plus récent la clôture — par
         **date**, et non par ordre d'apparition : sur le relevé mesuré, le
         solde d'ouverture du compte courant est imprimé en bas de la
         première page, donc après ses opérations.
      */
      if (!courant.ouverture || point.jour < courant.ouverture.jour) courant.ouverture = point;
      if (!courant.cloture || point.jour > courant.cloture.jour) courant.cloture = point;
      continue;
    }

    const i = indexDeLaDate(l);
    if (i === -1 || montants.length !== 1) continue;

    const montant = montants[0];
    const brut = centimesDe(montant.texte);
    if (brut === null) continue;
    if (frontiere.x === null) {
      sansFrontiere.push(montant.x);
      continue;
    }
    courant.operations.push({
      jour: jourDe(l.morceaux[i].texte.trim()),
      libelle: l.morceaux
        .slice(i + 2)
        .filter((m) => m !== montant)
        .map((m) => m.texte.trim())
        .join(' ')
        .trim(),
      centimes: montant.x < frontiere.x ? -brut : brut,
      page: l.page,
    });
  }

  /*
     Des opérations rencontrées avant tout en-tête : on tente le repli par
     écart, une seule fois, sur l'ensemble de leurs abscisses.
  */
  let refus: string | null = null;
  if (sansFrontiere.length) {
    const repli = frontiereParEcart(sansFrontiere);
    refus =
      repli.x === null
        ? `${pluriel(sansFrontiere.length, 'opération')} ` +
          `${accorde(sansFrontiere.length, 'lue')} sans colonnes identifiables. ${repli.raison}`
        : null;
    if (repli.x !== null) {
      refus =
        `${pluriel(sansFrontiere.length, 'opération')} ` +
        `${accorde(sansFrontiere.length, 'précède', 'précèdent')} tout en-tête de colonnes. ` +
        'Leur signe n’a pas pu être établi de façon sûre, et elles ont été écartées.';
    }
  }

  const controles = [...comptes.values()].map((c) => controler(c));
  return {
    comptes: [...comptes.values()],
    controles,
    empreinte,
    importable: refus === null && controles.length > 0 && controles.every((v) => v.verdict === 'boucle'),
    refus,
  };
}

function controler(c: CompteLu): ControleDeCompte {
  const net = c.operations.reduce((s, o) => s + o.centimes, 0);
  if (!c.ouverture || !c.cloture || c.ouverture.jour === c.cloture.jour) {
    return {
      nom: c.nom,
      verdict: 'invérifiable',
      calcule: null,
      imprime: c.cloture?.centimes ?? null,
      ecart: null,
      operations: c.operations.length,
      message:
        'Ce compte n’imprime pas ses soldes d’ouverture et de clôture : ' +
        'rien ne permet de vérifier que la lecture est complète.',
    };
  }
  const calcule = c.ouverture.centimes + net;
  const ecart = c.cloture.centimes - calcule;
  return {
    nom: c.nom,
    verdict: ecart === 0 ? 'boucle' : 'ecart',
    calcule,
    imprime: c.cloture.centimes,
    ecart,
    operations: c.operations.length,
    message:
      ecart === 0
        ? `${pluriel(c.operations.length, 'opération')}, solde exact.`
        : `Écart de ${nombreFr(Math.abs(ecart) / 100, 2)} € : ` +
          'une opération manque, est en double, ou a été lue du mauvais côté.',
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les doublons
   ══════════════════════════════════════════════════════════════════════════ */

const sansAccent = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * L'empreinte stable d'une opération, pour que deux imports qui se
 * chevauchent n'en créent pas deux.
 *
 * Le **rang** est ce qui sauve le cas réel : cinq virements de 5,00 € le même
 * jour avec le même libellé existent, et une empreinte sans rang les
 * réduirait à un seul. Il est calculé sur la liste entière, donc stable tant
 * que l'ordre du relevé l'est — et l'ordre d'un relevé l'est.
 */
export function empreintesDOperations(
  compteId: string,
  operations: readonly OperationLue[],
): string[] {
  const vus = new Map<string, number>();
  return operations.map((o) => {
    const noyau = `${compteId}|${o.jour}|${o.centimes}|${sansAccent(o.libelle)}`;
    const rang = (vus.get(noyau) ?? 0) + 1;
    vus.set(noyau, rang);
    return `${noyau}|${rang}`;
  });
}
