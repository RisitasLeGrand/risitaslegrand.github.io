/**
 * Sport publie ses faits.
 *
 * Même principe que les deux autres branches : les magasins sont la source,
 * les faits en sont la vue typée, et les identifiants sont déterministes.
 * Comme pour Odyssée, la lecture et le calcul sont séparés — `projeter` ne
 * touche pas la base — pour que les règles de publication s'éprouvent sans
 * navigateur.
 *
 * ## Ce qui est publié, et à quelle condition
 *
 * | Fait | Quand | Pourquoi |
 * |---|---|---|
 * | `sport.seance` | séance **terminée** | Une séance en cours n'a pas de durée : la publier compterait un temps qui n'est pas encore passé. |
 * | `sport.serie` | chaque série d'une séance terminée | C'est la granularité à laquelle une progression se lit. |
 * | `sport.record` | au **dépassement** d'un maximum estimé | Un record republié à chaque séance ne serait plus un record. |
 * | `sport.phase` | toujours | Une phase déclarée est un fait du jour où on l'a déclarée. |
 * | `sport.blessure` | toujours | Y compris ouverte : c'est son existence qui compte, pas sa fin. |
 *
 * ## Les séries portent la charge, pas le tonnage
 *
 * La valeur d'un fait `sport.serie` est la **charge**, en kilos, telle que le
 * contrat la déclare. Multiplier par les répétitions produirait un tonnage,
 * qui mélange des exercices incomparables — voir `modele.ts`. Les répétitions
 * voyagent dans les détails, où un calcul ultérieur peut les reprendre en
 * sachant ce qu'il fait.
 */
import { jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';
import { valider, type Fait, type Fiabilite, type Source } from '../noyau/faits';
import type { Manque, OptionsPublication, Publication } from '../odyssee/faits-revisions';
import { maximumEstime } from './force';
import { DOMAINE_SPORT, type Blessure, type Exercice, type Phase, type Seance } from './modele';
import {
  toutesLesBlessures,
  toutesLesPhases,
  toutesLesSeancesSport,
  tousLesExercices,
} from './donnees';

export const BRANCHE = 'sport';

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

export interface ContenuSport {
  seances: readonly Seance[];
  exercices: readonly Exercice[];
  phases: readonly Phase[];
  blessures: readonly Blessure[];
}

const midiDu = (jour: string) => `${jour}T12:00:00.000Z`;

/** Lit les magasins, puis projette. */
export async function publierFaitsSport(options: OptionsPublication = {}): Promise<Publication> {
  const [seances, exercices, phases, blessures] = await Promise.all([
    toutesLesSeancesSport(),
    tousLesExercices(),
    toutesLesPhases(),
    toutesLesBlessures(),
  ]);
  return projeterFaitsSport({ seances, exercices, phases, blessures }, options);
}

/** La projection, de magasins déjà lus vers des faits validés. */
export function projeterFaitsSport(
  contenu: ContenuSport,
  options: OptionsPublication = {},
): Publication {
  const reglages: Partial<ReglagesJourLogique> = options.reglages ?? {};
  const brouillons: Brouillon[] = [];
  const manques: Manque[] = [];
  const { seances, exercices, phases, blessures } = contenu;

  const parExercice = new Map(exercices.map((e) => [e.id, e]));
  const terminees = [...seances]
    .filter((s) => s.statut === 'terminee' && s.fin !== null)
    .sort((a, b) => a.debut.localeCompare(b.debut));

  manques.push({
    quoi: 'Séances encore en cours',
    combien: seances.length - terminees.length,
    consequence: 'Elles ne sont pas publiées : une séance en cours n’a pas encore de durée.',
  });

  /* --- Séances -------------------------------------------------------------- */
  let sansDifficulte = 0;
  for (const seance of terminees) {
    const debut = Date.parse(seance.debut);
    const fin = Date.parse(seance.fin!);
    const secondes = Math.max(0, Math.round((fin - debut) / 1000));
    if (seance.difficulte === null) sansDifficulte += 1;
    brouillons.push({
      id: `sport.seance:${seance.id}`,
      type: 'sport.seance',
      debut: seance.debut,
      fin: seance.fin!,
      valeur: secondes,
      unite: 'secondes',
      source: 'manuel',
      fiabilite: 'confirme',
      details: {
        series: seance.series.length,
        difficulte: seance.difficulte,
        /*
           Les muscles de la séance, pour que la roue et les indicateurs
           puissent lire « ce qui a travaillé » sans recharger la bibliothèque.
        */
        muscles: [
          ...new Set(
            seance.series.flatMap((s) => parExercice.get(s.exerciceId)?.principaux ?? []),
          ),
        ],
      },
    });

    /* --- Séries ------------------------------------------------------------ */
    seance.series.forEach((serie, rang) => {
      brouillons.push({
        /*
           L'identifiant porte le rang dans la séance : deux séries identiques
           du même exercice le même jour sont deux faits distincts, et un
           identifiant qui les confondrait en perdrait une.
        */
        id: `sport.serie:${seance.id}:${rang}`,
        type: 'sport.serie',
        debut: serie.le,
        valeur: serie.charge ?? 0,
        unite: 'kg',
        source: 'manuel',
        fiabilite: 'confirme',
        details: {
          exerciceId: serie.exerciceId,
          repetitions: serie.repetitions,
          echec: serie.echec,
          reserve: serie.reserve,
        },
      });
    });
  }
  manques.push({
    quoi: 'Séances sans difficulté perçue',
    combien: sansDifficulte,
    consequence: 'Aucune charge d’entraînement ne peut être estimée pour elles.',
  });

  /* --- Records : publiés au dépassement, jamais répétés --------------------
     Un record republié à chaque séance ne serait plus un record : ce serait la
     meilleure série du jour, qui est déjà dans les faits `sport.serie`. On ne
     publie donc qu'au moment où un maximum estimé dépasse tous les précédents
     du même exercice.
  */
  const meilleur = new Map<string, number>();
  for (const seance of terminees) {
    for (const serie of seance.series) {
      const estimation = maximumEstime(serie.charge, serie.repetitions);
      if (!estimation) continue;
      const precedent = meilleur.get(serie.exerciceId) ?? 0;
      if (estimation.estime <= precedent) continue;
      meilleur.set(serie.exerciceId, estimation.estime);
      brouillons.push({
        id: `sport.record:${seance.id}:${serie.exerciceId}`,
        type: 'sport.record',
        debut: serie.le,
        valeur: estimation.estime,
        unite: 'kg',
        source: 'derive',
        /*
           `estime`, et c'est le mot juste : un maximum calculé par Epley et
           Brzycki n'a pas été soulevé. Le marquer confirmé ferait passer une
           formule pour une mesure.
        */
        fiabilite: 'estime',
        details: {
          exerciceId: serie.exerciceId,
          charge: serie.charge,
          repetitions: serie.repetitions,
          imprecis: estimation.imprecis,
        },
      });
    }
  }

  /* --- Phases ---------------------------------------------------------------- */
  for (const phase of phases) {
    brouillons.push({
      id: `sport.phase:${phase.id}`,
      type: 'sport.phase',
      debut: phase.debut,
      fin: phase.fin ?? undefined,
      valeur: phase.type,
      source: 'manuel',
      fiabilite: 'confirme',
      details: { enCours: phase.fin === null },
    });
  }

  /* --- Blessures -------------------------------------------------------------
     Publiées ouvertes ou fermées : c'est leur existence qui compte. Une
     blessure ouverte non publiée disparaîtrait des synthèses au moment même
     où elle explique tout le reste.
  */
  for (const blessure of blessures) {
    brouillons.push({
      id: `sport.blessure:${blessure.id}`,
      type: 'sport.blessure',
      debut: blessure.debut,
      fin: blessure.fin ?? undefined,
      valeur: blessure.muscles.length ? blessure.muscles.join(', ') : 'général',
      source: 'manuel',
      fiabilite: 'confirme',
      details: { intensite: blessure.intensite, ouverte: blessure.fin === null },
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
      domaine: DOMAINE_SPORT,
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

/** Le midi d'un jour, exporté pour les essais qui construisent des fixtures. */
export { midiDu };
