/**
 * Psyché publie ses faits — et presque rien n'en sort.
 *
 * ## La seule chose que les autres branches lisent
 *
 * `odyssee.charge-percue` : un nombre de 0 à 10, déclaré **non sensible** au
 * contrat, dérivé de l'énergie et du stress. Sport s'en sert pour connaître la
 * fatigue sans approcher la psyché.
 *
 * Tout le reste — les quatre dimensions, les notes, les points de semaine, le
 * journal — est publié **sensible**, et la matrice de permissions en interdit
 * la lecture aux autres branches.
 *
 * ## Le journal publie son existence, jamais son contenu
 *
 * Un fait `odyssee.journal` porte le **nombre de caractères**, et rien d'autre.
 * Pas d'extrait, pas de premiers mots, pas de titre déduit. Le contrat le dit :
 * « ne sort jamais de l'appareil, ni vers une autre branche » — or un fait
 * voyage, par construction. Publier le texte le ferait donc sortir par la porte
 * qu'on venait de fermer.
 *
 * Pourquoi le publier du tout, alors ? Parce que « j'ai écrit ce jour-là » est
 * une information de couverture : sans elle, un mois d'écriture quotidienne
 * ressemblerait à un mois vide dans les indicateurs.
 *
 * ## Un check-in est confirmé, une charge est dérivée
 *
 * Les quatre glissières sont `confirme` : la personne les a posées elle-même,
 * et elles ne prétendent à rien d'autre. La charge perçue est `derive` : elle
 * vient d'un calcul, et le dire la distingue d'une mesure.
 */
import { jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';
import { valider, type Fait, type Fiabilite, type Source } from '../noyau/faits';
import type { Manque, OptionsPublication, Publication } from './faits-revisions';
import {
  DIMENSIONS,
  ORDRE_DIMENSIONS,
  chargePercue,
  type Checkin,
  type CheckinHebdo,
  type Entree,
} from './psyche';

export const BRANCHE = 'odyssee';
export const DOMAINE_PSYCHE = 'psyche';

interface Brouillon {
  id: string;
  type: string;
  debut: string;
  valeur?: number | string | boolean;
  unite?: string;
  source: Source;
  fiabilite: Fiabilite;
  domaine: string;
  details?: Record<string, unknown>;
}

export interface ContenuPsyche {
  checkins: readonly Checkin[];
  hebdos: readonly CheckinHebdo[];
  journal: readonly Entree[];
}

/**
 * Lit les magasins scellés, puis projette.
 *
 * **Lève si le coffre est fermé**, comme toute lecture de Psyché. Les
 * appelants qui publient toutes les branches doivent donc prévoir le cas : la
 * fonction d'agrégation attrape l'erreur et déclare le manque, plutôt que de
 * laisser une page blanche.
 */
export async function publierFaitsPsyche(options: OptionsPublication = {}): Promise<Publication> {
  const { tousLesCheckins, tousLesHebdos, toutLeJournal } = await import('./donnees-psyche');
  const [checkins, hebdos, journal] = await Promise.all([
    tousLesCheckins(),
    tousLesHebdos(),
    toutLeJournal(),
  ]);
  return projeterFaitsPsyche({ checkins, hebdos, journal }, options);
}

export function projeterFaitsPsyche(
  contenu: ContenuPsyche,
  options: OptionsPublication = {},
): Publication {
  const reglages: Partial<ReglagesJourLogique> = options.reglages ?? {};
  const brouillons: Brouillon[] = [];
  const manques: Manque[] = [];
  const { checkins, hebdos, journal } = contenu;

  /* --- Les check-ins, dimension par dimension ------------------------------
     Un fait par dimension renseignée, et non un fait « check-in » portant
     quatre nombres : les indicateurs lisent une grandeur à la fois, et un fait
     composite les obligerait tous à connaître la forme interne d'un check-in.
  */
  let sansCharge = 0;
  for (const c of checkins) {
    for (const d of ORDRE_DIMENSIONS) {
      const valeur = c[d];
      if (valeur === null) continue;
      brouillons.push({
        id: `odyssee.checkin:${c.jour}:${d}`,
        type: 'odyssee.checkin',
        debut: c.le,
        valeur,
        unite: 'échelle',
        source: 'manuel',
        fiabilite: 'confirme',
        domaine: DOMAINE_PSYCHE,
        details: { dimension: d, libelle: DIMENSIONS[d].libelle },
      });
    }

    /* --- La charge perçue : le seul fil qui sort -------------------------- */
    const charge = chargePercue(c);
    if (charge === null) {
      sansCharge += 1;
      continue;
    }
    brouillons.push({
      id: `odyssee.charge-percue:${c.jour}`,
      type: 'odyssee.charge-percue',
      debut: c.le,
      valeur: charge,
      unite: 'échelle',
      source: 'derive',
      fiabilite: 'estime',
      /*
         Le domaine **corps**, et non psyché : c'est ce qui la rend lisible par
         Sport sans ouvrir la psyché. Le contrat la déclare non sensible pour
         la même raison, et les deux doivent concorder — sans quoi la matrice
         de permissions la bloquerait malgré tout.
      */
      domaine: 'corps',
      details: {
        /*
           Ce qui a servi au calcul, **nommé mais pas chiffré** : on dit quelles
           dimensions étaient présentes, jamais leur valeur. Donner les valeurs
           rendrait la psyché déductible depuis un fait non sensible.
        */
        depuis: [c.energie !== null ? 'energie' : null, c.stress !== null ? 'stress' : null].filter(
          Boolean,
        ),
      },
    });
  }
  manques.push({
    quoi: 'Check-ins sans énergie ni stress',
    combien: sansCharge,
    consequence: 'Aucune charge perçue n’en est tirée : Sport ne saura pas la fatigue ces jours-là.',
  });

  /* --- Les points de semaine -----------------------------------------------
     Trois textes libres : on publie qu'il y en a un, et combien de questions
     ont reçu une réponse. Le contenu reste dans le coffre.
  */
  for (const h of hebdos) {
    const repondues = [h.porte, h.pese, h.besoin].filter((t) => t.trim()).length;
    brouillons.push({
      id: `odyssee.checkin:${h.semaine}:hebdo`,
      type: 'odyssee.checkin',
      debut: h.le,
      valeur: repondues,
      unite: 'échelle',
      source: 'manuel',
      fiabilite: 'confirme',
      domaine: DOMAINE_PSYCHE,
      details: { dimension: 'hebdomadaire', questions: repondues },
    });
  }

  /* --- Le journal : son existence, et sa longueur --------------------------
     `caracteres` et non le texte. Voir l'en-tête : un fait voyage.
  */
  for (const e of journal) {
    brouillons.push({
      id: `odyssee.journal:${e.id}`,
      type: 'odyssee.journal',
      debut: e.le,
      valeur: 'entrée',
      source: 'manuel',
      fiabilite: 'confirme',
      domaine: DOMAINE_PSYCHE,
      details: { caracteres: e.texte.length },
    });
  }

  /* --- Validation et tri ------------------------------------------------------ */
  const faits: Fait[] = [];
  const refuses: Publication['refuses'] = [];
  for (const brouillon of brouillons) {
    const jour = jourLogique(new Date(brouillon.debut), reglages);
    if (options.de && jour < options.de) continue;
    if (options.a && jour > options.a) continue;
    const fait: Fait = {
      id: brouillon.id,
      branche: BRANCHE,
      proprietaire: BRANCHE,
      domaine: brouillon.domaine,
      type: brouillon.type,
      debut: brouillon.debut,
      jourLogique: jour,
      valeur: brouillon.valeur,
      unite: brouillon.unite,
      source: brouillon.source,
      fiabilite: brouillon.fiabilite,
      version: 1,
      modifieLe: brouillon.debut,
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

/**
 * Aucun fait publié ne laisse fuir de contenu.
 *
 * Un contrôle, parce que la promesse « le journal ne sort pas » ne tient qu'à
 * ce que personne n'ajoute un jour un extrait « pour la lisibilité ». Il relit
 * les faits produits et refuse tout détail dont la valeur est un texte long.
 */
export const LONGUEUR_MAXIMALE_DUN_DETAIL = 40;

export function controlerFuite(faits: readonly Fait[]): string[] {
  const problemes: string[] = [];
  for (const fait of faits) {
    if (fait.type !== 'odyssee.journal' && fait.domaine !== DOMAINE_PSYCHE) continue;
    for (const [clef, valeur] of Object.entries(fait.details ?? {})) {
      if (typeof valeur !== 'string') continue;
      if (valeur.length > LONGUEUR_MAXIMALE_DUN_DETAIL) {
        problemes.push(
          `« ${fait.id} » porte un détail « ${clef} » de ${valeur.length} caractères : ` +
            'du contenu a fuité dans un fait.',
        );
      }
    }
    if (typeof fait.valeur === 'string' && fait.valeur.length > LONGUEUR_MAXIMALE_DUN_DETAIL) {
      problemes.push(`« ${fait.id} » porte un texte en valeur : du contenu a fuité dans un fait.`);
    }
  }
  return problemes;
}
