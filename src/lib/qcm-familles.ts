/**
 * Les doublons et les familles de la banque « QCM — DGFiP ».
 *
 * ## Ce que le chargeur ne peut pas voir
 *
 * Le chargeur du contenu déduplique les énoncés IDENTIQUES, par
 * `idStable(rubrique | énoncé)`. Cela ne voit rien de deux questions qui posent
 * le même fait sous deux formulations — et il y en a, parce que la banque
 * assemble douze annales qui se recoupent. Deux questions sur la déflation,
 * trois sur la réforme territoriale, deux sur l'objectif de la Banque centrale
 * européenne : le tirage peut en servir deux dans la même épreuve, et dépenser
 * deux questions pour un seul point de connaissance.
 *
 * Ce relevé est la liste de ces recoupements, tenue à la main pendant la
 * correction de la banque. Il porte des IDENTIFIANTS et non des énoncés, ce qui
 * est la raison pour laquelle il peut vivre dans le dépôt : un identifiant ne
 * dit pas le contenu de la question.
 *
 * ## Les deux types, et où passe la frontière
 *
 * `doublon-franc` : répondre à l'une donne l'autre. Soit la réponse attendue est
 * la même, soit les deux énoncés s'impliquent — demander la phrase à partir du
 * texte, puis le texte à partir de la phrase, revient à poser deux fois la
 * même question.
 *
 * `famille` : les questions portent sur le même objet sans attendre la même
 * réponse. Chacune garde sa valeur, et aucune n'est retirée ; mais en tirer
 * deux dans une même épreuve est du gâchis.
 *
 * Les deux valent exclusion au tirage. La distinction n'est pas là pour graduer
 * la sanction, mais pour que le relevé dise ce qu'il a constaté : un jour, on
 * voudra peut-être retirer les doublons francs et garder les familles, et il
 * sera trop tard pour reconstituer la différence.
 *
 * ## Le danger de ce fichier, et le garde-fou qui va avec
 *
 * Un identifiant se calcule sur la rubrique et l'énoncé. Retoucher un énoncé
 * change son identifiant — et ce relevé désignerait alors une question qui
 * n'existe plus, en silence, sans que le tirage cesse pour autant de
 * fonctionner. Il protégerait simplement moins bien qu'on le croit, ce qui est
 * la pire des pannes.
 *
 * `defautsDuReleve` existe pour cela : il confronte le relevé à la banque
 * chargée et nomme tout identifiant inconnu. Il est appelé par l'essai, et il
 * doit l'être par le contrôle du contenu — un relevé qui pourrit en silence ne
 * vaut pas mieux que pas de relevé.
 */

export type TypeDeLien = 'doublon-franc' | 'famille';

export interface LienDeQuestions {
  /** Au moins deux identifiants de questions, tels que le chargeur les calcule. */
  identifiants: string[];
  type: TypeDeLien;
  /** Ce qui a été constaté. Sert au relevé lisible, pas au tirage. */
  pourquoi: string;
}

/**
 * Le relevé, tenu au fil de la correction de la banque.
 *
 * Il n'est pas un inventaire : il couvre ce que la rédaction des corrections a
 * fait remarquer, rubrique par rubrique. Un inventaire systématique demandera
 * de comparer les RÉPONSES et les thèmes, non les énoncés — la comparaison des
 * énoncés est déjà faite par le chargeur et ne voit aucune des paires
 * ci-dessous.
 */
export const LIENS: LienDeQuestions[] = [
  /* ── Doublons francs ─────────────────────────────────────────────────── */
  {
    identifiants: ['19f09ec04938c194', '6822c423fd237d88'],
    type: 'doublon-franc',
    pourquoi:
      'Même réponse — la déflation —, énoncés quasi identiques à quelques mots près, ' +
      'et jeux d’options largement communs. Les deux viennent d’annales différentes. ' +
      'La déduplication par énoncé exact ne rapproche que les énoncés identiques : ' +
      'celles-ci lui échappent.',
  },
  {
    identifiants: ['a9679654c6dceaa3', 'fd33a95921fcd72f'],
    type: 'doublon-franc',
    pourquoi:
      'La même phrase et le même article de la Déclaration de 1789, pris dans les deux ' +
      'sens : l’une demande le texte à partir de la phrase, l’autre la phrase à partir ' +
      'du texte.',
  },
  {
    identifiants: ['3aa6b12fc2476636', '9f85befc23148eb5'],
    type: 'doublon-franc',
    pourquoi:
      'Même réponse, treize régions métropolitaines. Les énoncés diffèrent par la date ' +
      'citée — le vote de 2014, l’entrée en vigueur de 2016 — mais le nombre attendu est ' +
      'le même.',
  },
  {
    identifiants: ['8fbfb0a99a0f387e', '4d58392098ad4cd6'],
    type: 'doublon-franc',
    pourquoi:
      'Le même acte, 1958, demandé une fois par l’année et une fois par la date exacte. ' +
      'Qui tient l’une tient l’autre.',
  },
  {
    identifiants: ['36f31684a3bde614', '385723c6e6840a96'],
    type: 'doublon-franc',
    pourquoi:
      'Zola dans les deux cas, et Germinal est l’un des vingt volumes du cycle : la ' +
      'seconde question contient la première.',
  },
  {
    identifiants: ['6b5f77c72efb5e9a', '9d2bb0f4d41d744f'],
    type: 'doublon-franc',
    pourquoi:
      'Montesquieu dans les deux cas. Les œuvres diffèrent — L’Esprit des lois, les ' +
      'Lettres persanes — mais la réponse attendue est le même nom.',
  },
  {
    identifiants: ['ff6a866f70d60827', 'f7b47841f5d04530'],
    type: 'doublon-franc',
    pourquoi:
      'Énoncés presque identiques — « la capitale d’un pays », « la capitale de son ' +
      'pays » — et Canberra figure dans les deux. Les réponses attendues diffèrent, ce ' +
      'qui rend la paire piégeuse plutôt que redondante : à ne pas tirer ensemble, mais ' +
      'à conserver.',
  },

  /* ── Familles ────────────────────────────────────────────────────────── */
  {
    identifiants: ['3aa6b12fc2476636', '9f85befc23148eb5', '1cb77f14bcbd4607'],
    type: 'famille',
    pourquoi:
      'Triplet de la réforme territoriale : le vote de 2014, le nombre de treize, la ' +
      'date d’entrée en vigueur du 1er janvier 2016. Les trois sont utiles séparément.',
  },
  {
    identifiants: ['d8f0ccc921f3ac73', '08cd03ae6230db0d'],
    type: 'famille',
    pourquoi:
      'Union européenne et zone euro : la stabilité des prix, article 127 du traité sur ' +
      'le fonctionnement de l’Union, est la réponse des deux ; les énoncés abordent ' +
      'l’objectif par l’institution pour l’un, par la politique menée pour l’autre.',
  },
  {
    identifiants: ['693ec044b2a673a9', '19f09ec04938c194', '6822c423fd237d88'],
    type: 'famille',
    pourquoi:
      'Le couple inflation / déflation. Les réponses attendues sont opposées, mais les ' +
      'options se recouvrent largement et les trois questions évaluent la même distinction.',
  },
  {
    identifiants: ['6b5f77c72efb5e9a', '18c1ff95cbe9dedc', '9d2bb0f4d41d744f'],
    type: 'famille',
    pourquoi:
      'Les Lumières : Diderot et l’Encyclopédie sont la réponse de l’une et un ' +
      'distracteur de l’autre, et les trois questions se servent du même petit groupe ' +
      'd’auteurs.',
  },
  {
    identifiants: ['4cb6faa419500309', '7ff9a238e3d25f45'],
    type: 'famille',
    pourquoi:
      'Le prélèvement à la source sous deux angles, la nature de la réforme et sa date ' +
      'd’entrée en vigueur. Complémentaires ; à conserver, mais pas à tirer ensemble.',
  },
];

/**
 * Pour chaque question, celles qu'elle interdit de tirer avec elle.
 *
 * La relation est SYMÉTRIQUE et ne se propage pas : si A et B sont liés, et B
 * et C, alors A exclut B, B exclut A et C, et C exclut B — mais A et C restent
 * tirables ensemble. C'est voulu. Fermer la relation par transitivité
 * fusionnerait des familles qui n'ont rien à voir dès que l'une partage une
 * question avec une autre, et le relevé finirait par interdire la moitié de la
 * banque à cause d'un seul point commun.
 */
export function indexerLesExclusions(
  liens: readonly LienDeQuestions[] = LIENS,
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const lien of liens) {
    for (const id of lien.identifiants) {
      const deja = index.get(id) ?? new Set<string>();
      for (const autre of lien.identifiants) {
        if (autre !== id) deja.add(autre);
      }
      index.set(id, deja);
    }
  }
  return index;
}

/**
 * Tirer `combien` éléments sans jamais en prendre deux d'un même lien.
 *
 * ## Pourquoi cette boucle vit ici, et non dans le tirage
 *
 * Elle y vivait d'abord, à l'intérieur de `composerSession`. Elle en est
 * sortie pour une raison bête et décisive : `qcm.ts` importe `ui.ts`, qui lit
 * `import.meta.env`, lequel n'existe que dans une construction Astro. Aucun
 * essai ne peut donc importer `composerSession` — et une règle qu'on ne peut
 * pas éprouver n'est pas une règle, c'est une intention.
 *
 * Ici, le module ne dépend de rien. La boucle s'éprouve avec un tireur
 * DÉTERMINISTE, ce qui vaut mieux que trois cents passages au hasard : on
 * vérifie l'invariant sur tous les cas plutôt que sur un échantillon.
 *
 * ## Une à la fois, et pourquoi c'est le cœur de l'affaire
 *
 * Tirer le lot d'un coup puis noter les exclusions ne servirait à rien : les
 * deux questions liées peuvent sortir dans le même lot, et l'interdiction
 * arriverait après le mal. Chaque choix doit rétrécir le champ du suivant.
 *
 * ## Ce que la règle cède
 *
 * Quand il ne reste que des éléments interdits, on en prend quand même.
 * `interdits` est MUTÉ et traverse les appels, de sorte qu'une épreuve
 * composée rubrique par rubrique respecte les liens d'un bout à l'autre.
 *
 * `choisirUn` reçoit les candidats encore en jeu et en rend un — c'est par là
 * que le tirage pondéré entre, sans que ce module sache ce qu'est un poids.
 */
export function tirerSansDeuxDuMemeLien<T extends { id: string }>(
  candidats: readonly T[],
  combien: number,
  choisirUn: (parmi: readonly T[]) => T | undefined,
  interdits: Set<string>,
  exclusions: Map<string, Set<string>> = indexerLesExclusions(),
): T[] {
  const restants = [...candidats];
  const tires: T[] = [];
  while (tires.length < combien && restants.length > 0) {
    const libres = restants.filter((c) => !interdits.has(c.id));
    const choisi = choisirUn(libres.length > 0 ? libres : restants);
    if (choisi === undefined) break;
    tires.push(choisi);
    const rang = restants.findIndex((c) => c.id === choisi.id);
    if (rang === -1) break; /* un tireur qui rend autre chose que ce qu'on lui donne */
    restants.splice(rang, 1);
    for (const lie of exclusions.get(choisi.id) ?? []) interdits.add(lie);
  }
  return tires;
}

/**
 * Les défauts du relevé lui-même, confronté à la banque chargée.
 *
 * `identifiantsDeLaBanque` est l'ensemble des identifiants que le chargeur a
 * calculés. Un identifiant du relevé qui n'y figure pas est signalé : soit la
 * question a été retirée, soit son énoncé a été retouché — et dans les deux
 * cas le relevé ne protège plus ce qu'il croit protéger.
 */
export function defautsDuReleve(
  identifiantsDeLaBanque: ReadonlySet<string>,
  liens: readonly LienDeQuestions[] = LIENS,
): string[] {
  const defauts: string[] = [];
  const vus = new Set<string>();

  liens.forEach((lien, rang) => {
    const ou = `relevé des familles, entrée ${rang + 1}`;

    if (lien.identifiants.length < 2) {
      defauts.push(`${ou} : il faut au moins deux identifiants pour faire un lien`);
    }

    const uniques = new Set(lien.identifiants);
    if (uniques.size !== lien.identifiants.length) {
      defauts.push(`${ou} : le même identifiant y figure deux fois`);
    }

    for (const id of lien.identifiants) {
      if (!identifiantsDeLaBanque.has(id)) {
        defauts.push(
          `${ou} : l’identifiant « ${id} » n’existe pas dans la banque — ` +
            'la question a été retirée, ou son énoncé retouché',
        );
      }
    }

    /* Deux entrées de même type sur exactement le même jeu de questions sont
       une redite, et la seconde ne peut qu'entrer en contradiction avec la
       première le jour où l'une des deux sera modifiée. */
    const empreinte = `${lien.type}|${[...uniques].sort().join(',')}`;
    if (vus.has(empreinte)) {
      defauts.push(`${ou} : cette entrée est la répétition exacte d’une précédente`);
    }
    vus.add(empreinte);
  });

  return defauts;
}
