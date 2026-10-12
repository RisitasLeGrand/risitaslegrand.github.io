/**
 * Le domaine Corps publie ses faits.
 *
 * Même découpage qu'ailleurs : `publier` lit, `projeter` calcule et ne touche
 * pas la base. Les identifiants sont déterministes, pour qu'une republication
 * remplace au lieu d'empiler.
 *
 * ## Ce qui est publié, et avec quelle fiabilité
 *
 * | Fait | Fiabilité | Pourquoi |
 * |---|---|---|
 * | `odyssee.poids` | `confirme` | Une pesée est une mesure prise par la personne. |
 * | `odyssee.mesure` | `confirme` | Idem, au mètre ruban. |
 * | `odyssee.sommeil` | `estime` | Les heures de coucher et de lever sont reconstituées de mémoire, au quart d'heure près. Les dire confirmées flatterait la couverture là où elle est la plus molle. |
 * | `odyssee.repas` | `estime` | Les calories saisies à la main sont une estimation, et le prompt interdit la base d'aliments qui les rendrait moins approximatives. |
 * | `odyssee.hydratation` | `estime` | Un verre n'est pas un volume mesuré. |
 * | `odyssee.sante` | `confirme` | C'est une déclaration : elle ne prétend à rien d'autre qu'elle-même. |
 *
 * ## Un repas sans chiffre est publié quand même
 *
 * Avec la valeur `0` et un détail qui dit `chiffre: false`. C'est un repas
 * **pris**, et l'omettre ferait croire à un jour de jeûne — l'erreur
 * exactement inverse de celle qu'on cherche à éviter. Le détail permet à
 * toute moyenne ultérieure de l'écarter en connaissance de cause, ce qu'une
 * absence ne permettrait pas.
 */
import { jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';
import { valider, type Fait, type Fiabilite, type Source } from '../noyau/faits';
import type { Manque, OptionsPublication, Publication } from './faits-revisions';
import {
  DOMAINE_CORPS,
  MESURES,
  dureeDeLaNuit,
  kcalDesMacros,
  macrosIncoherentes,
  type Boisson,
  type EtatDeSante,
  type MesureCorporelle,
  type Nuit,
  type Pesee,
  type Repas,
} from './corps';
import {
  toutLEtatDeSante,
  toutesLesBoissons,
  toutesLesMesures,
  toutesLesNuits,
  toutesLesPesees,
  tousLesRepas,
} from './donnees-corps';

export const BRANCHE = 'odyssee';

interface Brouillon {
  id: string;
  type: string;
  debut: string;
  fin?: string;
  valeur?: number | string | boolean;
  unite?: string;
  source: Source;
  fiabilite: Fiabilite;
  details?: Record<string, unknown>;
}

export interface ContenuCorps {
  pesees: readonly Pesee[];
  mesures: readonly MesureCorporelle[];
  nuits: readonly Nuit[];
  repas: readonly Repas[];
  boissons: readonly Boisson[];
  sante: readonly EtatDeSante[];
}

export async function publierFaitsCorps(options: OptionsPublication = {}): Promise<Publication> {
  const [pesees, mesures, nuits, repas, boissons, sante] = await Promise.all([
    toutesLesPesees(),
    toutesLesMesures(),
    toutesLesNuits(),
    tousLesRepas(),
    toutesLesBoissons(),
    toutLEtatDeSante(),
  ]);
  return projeterFaitsCorps({ pesees, mesures, nuits, repas, boissons, sante }, options);
}

export function projeterFaitsCorps(
  contenu: ContenuCorps,
  options: OptionsPublication = {},
): Publication {
  const reglages: Partial<ReglagesJourLogique> = options.reglages ?? {};
  const brouillons: Brouillon[] = [];
  const manques: Manque[] = [];
  const { pesees, mesures, nuits, repas, boissons, sante } = contenu;

  /* --- Pesées ---------------------------------------------------------------- */
  for (const p of pesees) {
    brouillons.push({
      id: `odyssee.poids:${p.id}`,
      type: 'odyssee.poids',
      debut: p.le,
      valeur: p.kg,
      unite: 'kg',
      source: 'manuel',
      fiabilite: 'confirme',
      details: p.note ? { note: p.note } : undefined,
    });
  }

  /* --- Mesures --------------------------------------------------------------- */
  for (const m of mesures) {
    brouillons.push({
      id: `odyssee.mesure:${m.id}`,
      type: 'odyssee.mesure',
      debut: m.le,
      valeur: m.cm,
      unite: 'cm',
      source: 'manuel',
      fiabilite: 'confirme',
      /*
         Le `quoi` voyage dans les détails et non dans le type : un tour de
         bras et un tour de taille sont la même sorte de mesure, et leur faire
         deux types de faits obligerait à étendre le contrat à chaque partie du
         corps qu'on décide de suivre.
      */
      details: { quoi: m.quoi, libelle: MESURES[m.quoi] },
    });
  }

  /* --- Sommeil ---------------------------------------------------------------- */
  let nuitsSansQualite = 0;
  for (const n of nuits) {
    const duree = dureeDeLaNuit(n);
    if (duree === null || duree <= 0) continue;
    if (n.qualite === null) nuitsSansQualite += 1;
    brouillons.push({
      id: `odyssee.sommeil:${n.id}`,
      type: 'odyssee.sommeil',
      debut: n.coucher,
      fin: n.lever,
      valeur: duree,
      unite: 'secondes',
      source: 'manuel',
      fiabilite: 'estime',
      details: { qualite: n.qualite, reveils: n.reveils },
    });
  }
  manques.push({
    quoi: 'Nuits sans qualité perçue',
    combien: nuitsSansQualite,
    consequence: 'Le sommeil est compté en durée, mais rien ne dit s’il était réparateur.',
  });

  /* --- Repas ------------------------------------------------------------------ */
  let sansChiffre = 0;
  let incoherents = 0;
  for (const r of repas) {
    const chiffre = r.kcal !== null;
    if (!chiffre) sansChiffre += 1;
    if (macrosIncoherentes(r)) incoherents += 1;
    brouillons.push({
      id: `odyssee.repas:${r.id}`,
      type: 'odyssee.repas',
      debut: r.le,
      valeur: r.kcal ?? 0,
      unite: 'kcal',
      source: 'manuel',
      fiabilite: 'estime',
      details: {
        moment: r.moment,
        intitule: r.intitule,
        /*
           Le drapeau qui empêche la confusion entre « repas non chiffré » et
           « repas à zéro calorie ». Sans lui, une moyenne de calories compterait
           un café noté sans chiffre comme un jeûne.
        */
        chiffre,
        proteines: r.proteines,
        glucides: r.glucides,
        lipides: r.lipides,
        kcalDesMacros: kcalDesMacros(r),
      },
    });
  }
  manques.push({
    quoi: 'Repas notés sans calories',
    combien: sansChiffre,
    consequence: 'Ils comptent comme repas pris, jamais dans un total de calories.',
  });
  manques.push({
    quoi: 'Repas dont les calories contredisent les macros',
    combien: incoherents,
    consequence: 'Une unité a probablement été confondue ; les deux chiffres sont publiés tels quels.',
  });

  /* --- Hydratation : une somme par jour --------------------------------------
     Un fait par verre serait fidèle et illisible : personne ne lit « douze
     faits de 250 mL », on lit « trois litres ». La somme du jour est donc
     publiée comme un seul fait, dont l'identifiant est le jour — ce qui le
     rend naturellement idempotent à la republication.
  */
  const parJour = new Map<string, { mL: number; verres: number; dernier: string }>();
  for (const b of boissons) {
    const cumul = parJour.get(b.jour) ?? { mL: 0, verres: 0, dernier: b.le };
    cumul.mL += b.mL;
    cumul.verres += 1;
    if (b.le > cumul.dernier) cumul.dernier = b.le;
    parJour.set(b.jour, cumul);
  }
  for (const [jour, cumul] of parJour) {
    brouillons.push({
      id: `odyssee.hydratation:${jour}`,
      type: 'odyssee.hydratation',
      debut: cumul.dernier,
      valeur: cumul.mL,
      unite: 'mL',
      source: 'manuel',
      fiabilite: 'estime',
      details: { verres: cumul.verres },
    });
  }

  /* --- Santé ------------------------------------------------------------------
     Publiée ouverte ou fermée, comme une blessure de Sport : c'est son
     existence qui compte. `empecheEffort` voyage dans les détails, parce que
     c'est lui que la règle de désaccord `effort-sous-sante` lit.
  */
  for (const e of sante) {
    brouillons.push({
      id: `odyssee.sante:${e.id}`,
      type: 'odyssee.sante',
      debut: e.debut,
      fin: e.fin ?? undefined,
      valeur: e.intitule,
      source: 'manuel',
      fiabilite: 'confirme',
      details: {
        intensite: e.intensite,
        empecheEffort: e.empecheEffort,
        ouvert: e.fin === null,
      },
    });
  }

  /* --- Validation et tri ------------------------------------------------------ */
  const faits: Fait[] = [];
  const refuses: Publication['refuses'] = [];
  for (const brouillon of brouillons) {
    const jour = jourLogique(new Date(brouillon.fin ?? brouillon.debut), reglages);
    if (options.de && jour < options.de) continue;
    if (options.a && jour > options.a) continue;
    const fait: Fait = {
      id: brouillon.id,
      branche: BRANCHE,
      proprietaire: BRANCHE,
      domaine: DOMAINE_CORPS,
      type: brouillon.type,
      debut: brouillon.debut,
      fin: brouillon.fin,
      jourLogique: jour,
      valeur: brouillon.valeur,
      unite: brouillon.unite,
      source: brouillon.source,
      fiabilite: brouillon.fiabilite,
      version: 1,
      modifieLe: brouillon.fin ?? brouillon.debut,
      details: brouillon.details,
    };
    const verdict = valider(fait);
    if (!verdict.recevable) {
      refuses.push({
        id: fait.id,
        type: fait.type,
        motifs: verdict.problemes.filter((p) => p.gravite === 'refus').map((p) => p.message),
      });
      continue;
    }
    /*
       `verdict.fiabilite` et non la nôtre : c'est `valider` qui abaisse une
       valeur hors de la plage plausible. Garder la fiabilité déclarée
       reviendrait à annoncer comme confirmée une pesée de 300 kg.
    */
    faits.push({ ...fait, fiabilite: verdict.fiabilite });
  }
  faits.sort((a, b) =>
    a.jourLogique !== b.jourLogique
      ? a.jourLogique < b.jourLogique
        ? -1
        : 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0,
  );
  return { faits, manques: manques.filter((m) => m.combien > 0), refuses };
}
