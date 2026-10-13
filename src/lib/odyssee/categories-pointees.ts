/**
 * Les catégories pointées, comparées au budget — Finances, phase 3 bis e.
 *
 * ## La ligne « non pointé » n'est pas un détail d'affichage
 *
 * C'est la pièce qui décide si cet écran est honnête. Une comparaison
 * prévu / réalisé faite à moitié ressemble **exactement** à une comparaison
 * faite en entier, et elle se trompe toujours dans le sens rassurant : les
 * opérations qu'on n'a pas encore classées manquent au réalisé, donc chaque
 * catégorie paraît tenue.
 *
 * Le nombre et le montant de ce qui n'est pas compté sont donc affichés à
 * côté du tableau, et non en pied de page.
 *
 * ## « À revoir » reste dehors
 *
 * Décision 16. Une anomalie non confirmée entre dans le réalisé si on la
 * compte, et fausse la comparaison si on la compte à tort ; dehors, elle
 * est visible, chiffrée, et attend un geste. Compter « à titre provisoire »
 * ce qu'on n'est pas sûr d'avoir compris est le meilleur moyen d'oublier
 * qu'on ne l'avait pas compris.
 *
 * ## Une catégorie d'un seul côté est signalée
 *
 * Une catégorie prévue qu'aucun vendeur n'alimente affiche un réalisé de
 * zéro face à un prévu — et ce zéro ressemble à une économie. L'inverse,
 * une catégorie réalisée sans prévu, est une dépense hors budget qui
 * n'apparaît nulle part dans la comparaison. Les deux sont nommées.
 */
import { euros, type Centimes, type OperationBancaire } from './finances';
import { CATEGORIES_BUDGET, categorieDuType, type ModificationDeType } from './taxonomie';
import type { Pointage } from './pointage';

/* ══════════════════════════════════════════════════════════════════════════
   Le réalisé
   ══════════════════════════════════════════════════════════════════════════ */

export interface SourceDesCategories {
  operations: readonly OperationBancaire[];
  pointages: readonly Pointage[];
  /** Le prévu du budget, par catégorie, en centimes positifs. */
  prevuParCategorie: Readonly<Record<string, Centimes>>;
  modifications?: readonly ModificationDeType[];
  /** Bornes de la période, incluses. */
  du: string;
  au: string;
}

export interface LigneDeCategorie {
  categorie: string;
  prevu: Centimes;
  /** Positif pour une dépense, **négatif** quand les remboursements dominent. */
  reel: Centimes;
  ecart: Centimes;
  /** `null` sans prévu : zéro divisé par zéro n'est pas « 0 % ». */
  ecartRelatif: number | null;
  /** Combien d'opérations pointées l'alimentent. */
  operations: number;
  /** Vraie quand rien n'est prévu, ou rien n'est réalisé. */
  dUnSeulCote: boolean;
}

export interface NonPointe {
  aPointer: { operations: number; montant: Centimes };
  aRevoir: { operations: number; montant: Centimes };
  /** La phrase qui accompagne le tableau. Jamais vide. */
  phrase: string;
}

export interface VueDesCategories {
  lignes: readonly LigneDeCategorie[];
  nonPointe: NonPointe;
  /** Catégories prévues qu'aucune opération pointée n'alimente. */
  prevuesSansRealise: readonly string[];
  /** Catégories réalisées qui ne sont prévues nulle part. */
  realiseesSansPrevu: readonly string[];
}

/**
 * Le réalisé par catégorie, au centime.
 *
 * Quatre règles, toutes nécessaires et aucune évidente :
 *
 * - les **virements internes** sont exclus : ce n'est pas une dépense ;
 * - les **remboursements** se déduisent de leur catégorie, ils ne gonflent
 *   pas les ressources ;
 * - une opération **fractionnée** se répartit entre ses parts ;
 * - seules les opérations **pointées** comptent — « à pointer » et
 *   « à revoir » restent dehors, et sont dites à côté.
 */
export function vueDesCategories(s: SourceDesCategories): VueDesCategories {
  const dansLaPeriode = (o: OperationBancaire) => o.jour >= s.du && o.jour <= s.au;
  const operations = s.operations.filter((o) => !o.transfertAvec && dansLaPeriode(o));
  const parOperation = new Map(s.pointages.map((p) => [p.operationId, p]));

  const reel = new Map<string, { centimes: Centimes; operations: number }>();
  const ajouter = (categorie: string, centimes: Centimes) => {
    const d = reel.get(categorie) ?? { centimes: 0, operations: 0 };
    d.centimes += centimes;
    reel.set(categorie, d);
  };

  let aPointerN = 0;
  let aPointerM = 0;
  let aRevoirN = 0;
  let aRevoirM = 0;

  for (const o of operations) {
    const p = parOperation.get(o.id);
    const pointee = p && (p.statut === 'pointee-auto' || p.statut === 'pointee-par-moi');
    if (!pointee) {
      if (p?.statut === 'a-revoir') {
        aRevoirN += 1;
        aRevoirM += Math.abs(o.centimes);
      } else {
        aPointerN += 1;
        aPointerM += Math.abs(o.centimes);
      }
      continue;
    }

    /*
       Le signe : une sortie compte **positivement** dans une catégorie de
       dépense, une rentrée s'en déduit. C'est la convention de tout l'écran,
       et c'est elle qui fait qu'un remboursement de mutuelle réduit la
       santé au lieu de gonfler les revenus.
    */
    if (p.parts.length) {
      for (const part of p.parts) {
        const c = categorieDuType(part.typeId, s.modifications);
        ajouter(c, -part.centimes);
      }
      /* Une opération fractionnée compte pour une, dans sa part principale. */
      const principale = [...p.parts].sort(
        (a, b) => Math.abs(b.centimes) - Math.abs(a.centimes),
      )[0];
      const c = categorieDuType(principale.typeId, s.modifications);
      reel.get(c)!.operations += 1;
    } else {
      const c = categorieDuType(p.typeId ?? '', s.modifications);
      ajouter(c, -o.centimes);
      reel.get(c)!.operations += 1;
    }
  }

  const toutes = [
    ...new Set([
      ...Object.keys(s.prevuParCategorie),
      ...reel.keys(),
    ]),
  ].sort();

  const lignes: LigneDeCategorie[] = toutes.map((categorie) => {
    const prevu = s.prevuParCategorie[categorie] ?? 0;
    const d = reel.get(categorie) ?? { centimes: 0, operations: 0 };
    const ecart = d.centimes - prevu;
    return {
      categorie,
      prevu,
      reel: d.centimes,
      ecart,
      ecartRelatif: prevu === 0 ? null : ecart / prevu,
      operations: d.operations,
      dUnSeulCote: prevu === 0 || d.operations === 0,
    };
  });

  const nonPointe: NonPointe = {
    aPointer: { operations: aPointerN, montant: aPointerM },
    aRevoir: { operations: aRevoirN, montant: aRevoirM },
    phrase: phraseDuNonPointe(aPointerN, aPointerM, aRevoirN, aRevoirM),
  };

  return {
    lignes,
    nonPointe,
    prevuesSansRealise: lignes
      .filter((l) => l.prevu > 0 && l.operations === 0)
      .map((l) => l.categorie),
    realiseesSansPrevu: lignes
      .filter((l) => l.prevu === 0 && l.operations > 0)
      .map((l) => l.categorie),
  };
}

/**
 * La phrase qui dit ce que la comparaison ne compte pas.
 *
 * Jamais vide : « rien n'est resté dehors » est une information, et son
 * absence se lirait comme un oubli.
 */
export function phraseDuNonPointe(
  aPointerN: number,
  aPointerM: Centimes,
  aRevoirN: number,
  aRevoirM: Centimes,
): string {
  if (!aPointerN && !aRevoirN) {
    return 'Tout est pointé : la comparaison porte sur l’ensemble de la période.';
  }
  const morceaux: string[] = [];
  if (aPointerN) morceaux.push(`${aPointerN} opération(s) à pointer · ${euros(aPointerM)}`);
  if (aRevoirN) morceaux.push(`${aRevoirN} à revoir · ${euros(aRevoirM)}`);
  return (
    `${morceaux.join(' — ')}. La comparaison ci-dessus n’en tient pas compte : `
    + 'elle porte sur ce qui est classé, et rien d’autre.'
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerLesCategoriesPointees(): string[] {
  const problemes: string[] = [];

  if (!phraseDuNonPointe(0, 0, 0, 0).trim()) {
    problemes.push(
      'La phrase du non-pointé est vide quand tout est pointé. « Rien n’est resté dehors » ' +
        'est une information, et son absence se lirait comme un oubli.',
    );
  }

  /*
     La règle du sens, vérifiée sur un cas monté exprès : un remboursement
     doit **réduire** sa catégorie. L'erreur inverse est silencieuse — elle
     gonfle une dépense d'un montant qui est rentré.
  */
  const operations: OperationBancaire[] = [
    {
      id: 'A', compteId: 'C1', jour: '2026-10-05', centimes: -6000, libelle: 'PRLV MUTUELLE',
      categorie: '', transfertAvec: null, majLe: '2026-10-05T00:00:00.000Z',
    },
    {
      id: 'B', compteId: 'C1', jour: '2026-10-20', centimes: 8000, libelle: 'VIR MUTUELLE',
      categorie: '', transfertAvec: null, majLe: '2026-10-20T00:00:00.000Z',
    },
  ];
  const pointage = (id: string): Pointage => ({
    id, operationId: id, statut: 'pointee-par-moi', vendeurNom: 'Mutuelle',
    typeId: 'mutuelle', parts: [], auteur: 'moi', pourquoi: '',
    versionDuDictionnaire: null, importId: null, precedent: null,
    appareil: 'essai', decideLe: '2026-10-21T00:00:00.000Z', majLe: '2026-10-21T00:00:00.000Z',
  });
  const vue = vueDesCategories({
    operations,
    pointages: [pointage('A'), pointage('B')],
    prevuParCategorie: { Assurances: 6000 },
    du: '2026-10-01',
    au: '2026-10-31',
  });
  const assurances = vue.lignes.find((l) => l.categorie === 'Assurances');
  if (!assurances || assurances.reel !== -2000) {
    problemes.push(
      'Un remboursement ne réduit pas sa catégorie : 60 € prélevés et 80 € rendus doivent ' +
        `faire −20 €, et non ${assurances ? euros(assurances.reel) : 'rien'}.`,
    );
  }

  /* Et un virement interne n'entre pas dans le réalisé. */
  const avecTransfert = vueDesCategories({
    operations: [
      ...operations,
      {
        id: 'T', compteId: 'C1', jour: '2026-10-10', centimes: -50000,
        libelle: 'VIR LIVRET A', categorie: '', transfertAvec: 'U',
        majLe: '2026-10-10T00:00:00.000Z',
      },
    ],
    pointages: [pointage('A'), pointage('B')],
    prevuParCategorie: { Assurances: 6000 },
    du: '2026-10-01',
    au: '2026-10-31',
  });
  if (avecTransfert.nonPointe.aPointer.operations !== 0) {
    problemes.push('Un virement interne est compté comme « à pointer ». Ce n’est pas une dépense.');
  }

  for (const c of ['Alimentation', 'Santé', 'Revenus']) {
    if (!CATEGORIES_BUDGET.includes(c)) {
      problemes.push(`La catégorie « ${c} » a disparu du catalogue commun.`);
    }
  }
  return problemes;
}
