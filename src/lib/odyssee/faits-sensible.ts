/**
 * Traitements et statut hormonal publient leurs faits — amendement signé
 * le 16 octobre 2026.
 *
 * La décision, mot pour mot : « Oui, maintenant : coffre ouvert seulement ;
 * seulement dans les indicateurs et les règles de désaccord, sans texte qui
 * les nomme hors du coffre ; jamais dans les exports, "Demander à l'IA" ni
 * les notifications ; le statut hormonal reste soumis au filtre du cycle. »
 *
 * Quatre conditions, quatre gardes, et chacune est éprouvée séparément.
 *
 * ## 1. Le fait ne nomme pas la molécule, et c'est la garde centrale
 *
 * Un fait **sort du coffre**. Il part au journal d'opérations, qui se
 * réplique entre appareils et entre dans les sauvegardes. Mettre le nom du
 * médicament dans `valeur` ou dans `details` reviendrait donc à écrire
 * « sans texte qui les nomme hors du coffre » puis à faire exactement
 * l'inverse.
 *
 * Le fait dit donc **qu'une prise a eu lieu**, jamais laquelle : une
 * valeur, `prise`, et un compte du jour. C'est maigre, et c'est assez pour
 * ce que la décision autorise — une règle de désaccord veut savoir qu'il y
 * a eu une prise ce jour-là, pas ce qui a été pris. Le détail reste dans le
 * magasin scellé, où l'écran Santé va le chercher coffre ouvert.
 *
 * Même chose pour le statut : sa `nature` est publiée — `traitement`,
 * `substance`, `autre` — parce que c'est une catégorie fermée de trois
 * valeurs et non un texte libre, et parce qu'une règle de désaccord qui ne
 * saurait pas distinguer un traitement d'une substance ne servirait à rien.
 * Son `intitule`, lui, ne sort jamais.
 *
 * ## 2. Coffre fermé, on ne publie rien — et on le DIT
 *
 * Les lecteurs scellés lèvent sans la clé. On pourrait laisser l'exception
 * remonter ; ce serait une panne là où il n'y a qu'un état. `publier` rend
 * donc une publication vide assortie d'un manque nommé, de sorte que la
 * couverture d'indicateur affiche « coffre fermé » au lieu de zéro — et
 * zéro, pour une couverture, ne se distingue pas d'un domaine négligé.
 *
 * ## 3. Jamais dans les exports, « Demander à l'IA » ni les notifications
 *
 * Gardé ailleurs, et volontairement : `noyau/jamais-partage.ts`, au point
 * de sortie. Ce module **publie**, il ne décide pas de ce qui sort. Deux
 * modules qui jugeraient tous les deux de la sortie finiraient par ne plus
 * être d'accord, et c'est le genre de désaccord qui se découvre dans un
 * fichier déjà envoyé.
 *
 * ## 4. Le statut de nature « cycle » n'entre pas
 *
 * « Le statut hormonal reste soumis au filtre du cycle. » Un statut dont la
 * nature est `cycle` **est** une donnée de cycle : il ne devient pas
 * admissible parce qu'il transite par un autre magasin. Il est donc écarté
 * à la projection, et compté comme un manque — pour que la couverture dise
 * qu'il manque quelque chose, plutôt que de laisser croire que tout a été vu.
 */
import { jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';
import { valider, type Fait, type Fiabilite, type Source } from '../noyau/faits';
import type { Manque, OptionsPublication, Publication } from './faits-revisions';
import { DOMAINE_CORPS } from './corps';
import type { Prise, StatutHormonal } from './sensible';

export const BRANCHE = 'odyssee';

/** La valeur publiée d'une prise. Constante : elle ne dit rien d'autre. */
export const VALEUR_DE_PRISE = 'prise';

/**
 * Les natures de statut qui n'entrent pas dans l'analyse.
 *
 * Une seule, et c'est le filtre du cycle appliqué ici. Déclarée en liste
 * plutôt qu'en comparaison directe pour la même raison que partout
 * ailleurs : une règle nommée se relit, une égalité enfouie se perd.
 */
export const NATURES_ECARTEES: readonly string[] = ['cycle'];

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

export interface ContenuSensible {
  prises: readonly Prise[];
  statuts: readonly StatutHormonal[];
}

/**
 * Lit les deux magasins scellés et projette.
 *
 * **Coffre fermé, rend vide plutôt que de lever.** Le manque est nommé,
 * pour que l'absence se lise comme un état et non comme un zéro.
 */
export async function publierFaitsSensibles(
  options: OptionsPublication = {},
): Promise<Publication> {
  const { coffreOuvert } = await import('../coffre');
  if (!coffreOuvert()) {
    return {
      faits: [],
      manques: [
        {
          quoi: 'odyssee.medicament',
          combien: 1,
          consequence:
            'Coffre fermé : les traitements et le statut hormonal n’ont pas été lus. Ce n’est pas une absence de données.',
        },
      ],
      refuses: [],
    };
  }
  const { toutesLesPrises, tousLesStatuts } = await import('./donnees-sensible');
  const [prises, statuts] = await Promise.all([toutesLesPrises(), tousLesStatuts()]);
  return projeterFaitsSensibles({ prises, statuts }, options);
}

export function projeterFaitsSensibles(
  contenu: ContenuSensible,
  options: OptionsPublication = {},
): Publication {
  const reglages: Partial<ReglagesJourLogique> = options.reglages ?? {};
  const brouillons: Brouillon[] = [];
  const manques: Manque[] = [];
  const { prises, statuts } = contenu;

  /* --- Prises ---------------------------------------------------------------- */
  for (const p of prises) {
    brouillons.push({
      id: `odyssee.medicament:${p.id}`,
      type: 'odyssee.medicament',
      debut: p.le,
      /*
         `prise`, et rien d'autre. Ni `p.nom`, ni `p.dose`, ni `p.motif` :
         ce fait voyage hors du coffre, et la décision dit « sans texte qui
         les nomme ». Ce qu'on perd — distinguer deux molécules dans une
         règle de désaccord — est ce que la décision refuse d'accorder.
      */
      valeur: VALEUR_DE_PRISE,
      source: 'manuel',
      /*
         `confirme` : une prise saisie est une déclaration de ce qui a été
         fait. Elle ne prétend à rien d'autre qu'elle-même — pas plus qu'un
         état de santé déclaré, qui porte déjà cette fiabilité.
      */
      fiabilite: 'confirme',
      /*
         Aucun détail. Le gabarit des autres domaines en met volontiers ;
         ici chaque clef serait une occasion de laisser passer le nom, et
         un champ vide ne se remplit pas par accident.
      */
    });
  }

  /* --- Statuts hormonaux ------------------------------------------------------ */
  let ecartesParLeCycle = 0;
  for (const s of statuts) {
    if (NATURES_ECARTEES.includes(s.nature)) {
      ecartesParLeCycle += 1;
      continue;
    }
    brouillons.push({
      id: `odyssee.statut-hormonal:${s.id}`,
      type: 'odyssee.statut-hormonal',
      debut: s.debut,
      /*
         Pas de `fin` quand le statut dure : un fait dont la fin est nulle
         est un fait ouvert, et le dire clos à aujourd'hui le ferait
         disparaître demain.
      */
      ...(s.fin !== null ? { fin: s.fin } : {}),
      /*
         La nature, pas l'intitulé. Trois valeurs d'une liste fermée, qui
         permettent à une règle de distinguer un traitement d'une
         substance ; l'intitulé est du texte libre et reste au coffre.
      */
      valeur: s.nature,
      source: 'manuel',
      fiabilite: 'confirme',
    });
  }
  manques.push({
    quoi: 'odyssee.statut-hormonal',
    combien: ecartesParLeCycle,
    consequence:
      'Des statuts de nature « cycle » existent et sont écartés de l’analyse : le filtre du cycle s’applique.',
  });

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
