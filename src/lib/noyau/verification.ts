/**
 * La vérification des chiffres cités : quatre verdicts, et aucune invention.
 *
 * ## Pourquoi quatre et pas deux
 *
 * « Juste » et « faux » ne suffisent pas, et les deux cas manquants sont les
 * plus fréquents :
 *
 * - **approché** : une IA qui lit « 5,3 h » et cite « 5 h » n'a pas inventé,
 *   elle a arrondi. La signaler comme fausse ferait rejeter des analyses
 *   correctes, et la personne cesserait de lire les verdicts.
 * - **non vérifiable** : une compaction a effacé le détail d'avant une borne, ou
 *   l'unité citée ne correspond pas à celle du catalogue. Dire « non retrouvé »
 *   laisserait croire que l'IA a inventé, alors que c'est **nous** qui ne savons
 *   plus. C'est la distinction qui compte le plus de tout le module.
 *
 * ## La tolérance est déclarée, pas choisie à l'affichage
 *
 * Deux écrans qui arrondiraient différemment donneraient deux verdicts sur la
 * même preuve. Les deux seuils vivent donc ici, en pour-cent de la valeur
 * recalculée, avec un plancher absolu pour les petites valeurs — 2 % de 0,04 ne
 * veut rien dire.
 *
 * ## L'unité ne se convertit pas en silence
 *
 * Si l'IA cite des heures là où le catalogue compte des secondes, le verdict est
 * **non vérifiable**, pas une conversion devinée. Une conversion silencieuse
 * marcherait neuf fois sur dix et, la dixième, confirmerait un chiffre faux.
 */

/** Les quatre verdicts de B.6.4. */
import { accorde, pluriel } from './accords';

export type Verdict = 'confirme' | 'approche' | 'non-retrouve' | 'non-verifiable';

/** Écart relatif en deçà duquel la valeur est **confirmée**. */
export const TOLERANCE_CONFIRME = 0.02;

/** Écart relatif en deçà duquel elle est **approchée**. */
export const TOLERANCE_APPROCHE = 0.1;

/**
 * Le plancher absolu, pour les valeurs proches de zéro.
 *
 * Deux pour cent d'une rétention de 0,04 font 0,0008 : aucune IA ne cite à
 * cette précision, et toutes seraient déclarées fausses. Le plancher dit qu'un
 * écart inférieur à un millième est confirmé quelle que soit la valeur.
 */
export const PLANCHER_ABSOLU = 0.001;

export interface Preuve {
  indicateur: string;
  periode: { debut: string; fin: string };
  valeurCitee: number;
  unite: string;
}

/** Ce que le recalcul a trouvé, ou pourquoi il n'a rien trouvé. */
export type Recalcul =
  | { quoi: 'valeur'; valeur: number; unite: string }
  /** L'indicateur existe, mais la période n'a aucune donnée. */
  | { quoi: 'aucune-donnee' }
  /** Le détail a été compacté : on ne sait plus, et on le dit. */
  | { quoi: 'compacte'; detailDepuis: string }
  /** L'indicateur n'est pas au catalogue de cette version du site. */
  | { quoi: 'inconnu' };

export interface Verification {
  preuve: Preuve;
  verdict: Verdict;
  /** La valeur recalculée, quand il y en a une. */
  recalculee?: number;
  /** L'écart relatif, quand les deux valeurs existent. */
  ecartRelatif?: number;
  /** Ce qu'il faut dire à l'écran, en une phrase. */
  raison: string;
}

const nombre = (n: number) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });

/**
 * Le verdict d'une preuve, au vu du recalcul.
 *
 * L'ordre des cas n'est pas indifférent : l'impossibilité de vérifier passe
 * **avant** la comparaison. Comparer une valeur citée à un zéro issu d'un
 * journal compacté produirait « non retrouvé » sur une preuve peut-être juste.
 */
export function verifier(preuve: Preuve, recalcul: Recalcul): Verification {
  if (recalcul.quoi === 'inconnu') {
    return {
      preuve,
      verdict: 'non-verifiable',
      raison: `« ${preuve.indicateur} » n’est pas au catalogue de cette version : rien à recalculer.`,
    };
  }
  if (recalcul.quoi === 'compacte') {
    return {
      preuve,
      verdict: 'non-verifiable',
      raison:
        `le détail n’existe plus avant le ${recalcul.detailDepuis} : une compaction a eu lieu, ` +
        'et ce chiffre ne peut ni être confirmé ni être démenti.',
    };
  }
  if (recalcul.quoi === 'aucune-donnee') {
    return {
      preuve,
      verdict: 'non-retrouve',
      raison:
        'aucune donnée sur cette période pour cet indicateur : la valeur citée ne vient pas de l’export.',
    };
  }

  if (recalcul.unite !== preuve.unite) {
    return {
      preuve,
      verdict: 'non-verifiable',
      recalculee: recalcul.valeur,
      raison:
        `l’unité citée (« ${preuve.unite} ») n’est pas celle du catalogue (« ${recalcul.unite} ») : ` +
        'la valeur n’est pas comparée, et aucune conversion n’est devinée.',
    };
  }

  const ecart = Math.abs(preuve.valeurCitee - recalcul.valeur);
  const reference = Math.abs(recalcul.valeur);
  const relatif = reference > 0 ? ecart / reference : ecart > 0 ? Infinity : 0;

  if (ecart <= PLANCHER_ABSOLU || relatif <= TOLERANCE_CONFIRME) {
    return {
      preuve,
      verdict: 'confirme',
      recalculee: recalcul.valeur,
      ecartRelatif: relatif,
      raison: `recalculé à ${nombre(recalcul.valeur)} ${recalcul.unite} : la valeur citée est juste.`,
    };
  }
  if (relatif <= TOLERANCE_APPROCHE) {
    return {
      preuve,
      verdict: 'approche',
      recalculee: recalcul.valeur,
      ecartRelatif: relatif,
      raison:
        `recalculé à ${nombre(recalcul.valeur)} ${recalcul.unite}, soit ` +
        `${nombre(relatif * 100)} % d’écart : l’ordre de grandeur est bon.`,
    };
  }
  return {
    preuve,
    verdict: 'non-retrouve',
    recalculee: recalcul.valeur,
    ecartRelatif: relatif,
    raison:
      `recalculé à ${nombre(recalcul.valeur)} ${recalcul.unite}, soit ` +
      `${nombre(relatif * 100)} % d’écart : ce chiffre n’est pas celui de l’export.`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   L'état d'un constat, au vu de ses preuves
   ══════════════════════════════════════════════════════════════════════════ */

/** Ce qu'il faut dire d'un constat entier. */
export type EtatConstat =
  /** Toutes les preuves sont confirmées ou approchées. */
  | 'etaye'
  /** Au moins une preuve n'est pas retrouvée : à signaler en évidence. */
  | 'douteux'
  /** Rien n'est démenti, mais rien n'a pu être vérifié. */
  | 'invérifiable';

/**
 * L'état d'un constat.
 *
 * B.6.4 le demande : « un constat dont une preuve n'est pas retrouvée est
 * signalé en évidence ». Une seule preuve suffit, et c'est voulu — un constat
 * bâti sur trois chiffres dont un est inventé n'est pas aux deux tiers juste.
 */
export function etatDuConstat(verifications: readonly Verification[]): EtatConstat {
  if (!verifications.length) return 'invérifiable';
  if (verifications.some((v) => v.verdict === 'non-retrouve')) return 'douteux';
  if (verifications.every((v) => v.verdict === 'non-verifiable')) return 'invérifiable';
  return 'etaye';
}

export const LIBELLES_VERDICT: Record<Verdict, string> = {
  confirme: 'confirmé',
  approche: 'approché',
  'non-retrouve': 'non retrouvé',
  'non-verifiable': 'non vérifiable',
};

export const LIBELLES_ETAT: Record<EtatConstat, string> = {
  etaye: 'étayé',
  douteux: 'une preuve n’est pas retrouvée',
  invérifiable: 'non vérifiable',
};

/** Le compte par verdict, pour l'aperçu. */
export function compter(verifications: readonly Verification[]): Record<Verdict, number> {
  const compte: Record<Verdict, number> = {
    confirme: 0,
    approche: 0,
    'non-retrouve': 0,
    'non-verifiable': 0,
  };
  for (const v of verifications) compte[v.verdict] += 1;
  return compte;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le tri
   ══════════════════════════════════════════════════════════════════════════ */

/** Ce qu'on fait d'un constat. */
export type SortConstat = 'garde' | 'ecarte';

/** Ce qu'on fait d'une proposition. */
export type SortProposition = 'adoptee' | 'reportee' | 'refusee';

/** Le plafond de trajectoires correctives actives, repris de C.8. */
export const TRAJECTOIRES_ACTIVES = 3;

export interface Tri {
  constats: Record<string, SortConstat>;
  propositions: Record<string, SortProposition>;
}

export interface VerdictDuTri {
  recevable: boolean;
  motifs: string[];
  adoptees: string[];
}

/**
 * Vérifie qu'un tri est applicable.
 *
 * Deux règles. **Au plus trois trajectoires actives** (C.8) : au-delà, ce n'est
 * plus un plan, c'est une liste de souhaits. Et **une proposition ne peut pas
 * être adoptée si le constat dont elle découle a été écarté** — adopter une
 * action tout en rejetant la raison qui la motive laisse une trajectoire que
 * plus rien ne justifie, et qu'on ne saura pas évaluer.
 */
export function controlerTri(
  tri: Tri,
  liens: Record<string, readonly string[]>,
  dejaActives = 0,
): VerdictDuTri {
  const motifs: string[] = [];
  const adoptees = Object.entries(tri.propositions)
    .filter(([, sort]) => sort === 'adoptee')
    .map(([id]) => id);

  if (adoptees.length + dejaActives > TRAJECTOIRES_ACTIVES) {
    motifs.push(
      `${pluriel(adoptees.length, 'proposition')} ${accorde(adoptees.length, 'adoptée')} et ` +
        `${pluriel(dejaActives, 'trajectoire')} déjà ${accorde(dejaActives, 'active')} : ` +
        `le plafond est de ${TRAJECTOIRES_ACTIVES}.`,
    );
  }

  for (const id of adoptees) {
    for (const constat of liens[id] ?? []) {
      if (tri.constats[constat] === 'ecarte') {
        motifs.push(
          `la proposition « ${id} » découle du constat « ${constat} », qui est écarté : ` +
            'adopter l’action en rejetant sa raison laisserait une trajectoire sans justification.',
        );
      }
    }
  }

  return { recevable: motifs.length === 0, motifs, adoptees };
}
