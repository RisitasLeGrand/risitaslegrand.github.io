/**
 * Finances publie ses faits — et rien de ce qui identifie.
 *
 * ## Ce qui sort, et ce qui ne sort pas
 *
 * Deux types seulement, tous deux déclarés **sensibles** au contrat, donc
 * illisibles par les autres branches : `odyssee.operation` et
 * `odyssee.valorisation`. Le contrat le dit lui-même pour la première :
 * « Jamais d'IBAN ni de numéro de compte » — et il n'y en a pas non plus
 * dans les magasins, puisque l'import refuse de les enregistrer.
 *
 * **Le libellé d'une opération ne sort pas.** C'est le nom d'un commerçant,
 * d'un bailleur, d'un médecin : la donnée la plus parlante du lot, et celle
 * dont un agrégat n'a aucun besoin. Ce qui est publié est le **montant**, le
 * **jour** et la **catégorie** — de quoi compter, jamais de quoi raconter.
 * C'est le même raisonnement que pour le journal de psyché, qui publie un
 * nombre de caractères et pas une ligne de texte.
 *
 * ## Confirmé, pas dérivé
 *
 * Une opération vient d'un relevé ou d'une saisie : `confirme`. Une
 * valorisation est une photographie déclarée à une date : `confirme` aussi.
 * Rien ici n'est calculé, donc rien n'est `derive`.
 *
 * ## Et l'XP ne bouge pas
 *
 * L'interdit 5 du prompt 35 est explicite : les données du coffre comptent
 * pour les indicateurs, jamais pour l'XP. Ce module ne fait que publier ; le
 * moteur d'activité, lui, ne lit pas le domaine `finances`.
 */
import { jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';
import { valider, type Fait } from '../noyau/faits';
import type { OptionsPublication, Publication } from './faits-revisions';
import { toutesLesOperations, toutesLesValorisations } from './donnees-finances';

export const BRANCHE = 'odyssee';
export const DOMAINE_FINANCES = 'finances';

/** Les centimes du modèle, en euros pour le contrat (`unite: 'EUR'`). */
const euros = (centimes: number): number => Math.round(centimes) / 100;

export async function publierFaitsFinances(
  options: OptionsPublication = {},
): Promise<Publication> {
  const reglages = options.reglages as ReglagesJourLogique | undefined;
  const [operations, valorisations] = await Promise.all([
    toutesLesOperations(),
    toutesLesValorisations(),
  ]);

  const bruts = [
    ...operations.map((o) => ({
      id: `operation:${o.id}`,
      type: 'odyssee.operation',
      debut: `${o.jour}T12:00:00.000Z`,
      valeur: euros(o.centimes),
      unite: 'EUR',
      source: 'import' as const,
      fiabilite: 'confirme' as const,
      domaine: DOMAINE_FINANCES,
      /* La catégorie, oui ; le libellé, jamais. Voir l'en-tête. */
      details: { categorie: o.categorie || 'non catégorisée' },
    })),
    ...valorisations.map((v) => ({
      id: `valorisation:${v.id}`,
      type: 'odyssee.valorisation',
      debut: `${v.jour}T12:00:00.000Z`,
      valeur: euros(v.centimes),
      unite: 'EUR',
      source: 'manuel' as const,
      fiabilite: 'confirme' as const,
      domaine: DOMAINE_FINANCES,
    })),
  ];

  const faits: Fait[] = [];
  const refuses: Publication['refuses'] = [];
  for (const brut of bruts) {
    const jour = jourLogique(new Date(brut.debut), reglages);
    if (options.de && jour < options.de) continue;
    if (options.a && jour > options.a) continue;
    const fait: Fait = {
      id: brut.id,
      branche: BRANCHE,
      proprietaire: BRANCHE,
      domaine: brut.domaine,
      type: brut.type,
      debut: brut.debut,
      jourLogique: jour,
      valeur: brut.valeur,
      unite: brut.unite,
      source: brut.source,
      fiabilite: brut.fiabilite,
      version: 1,
      modifieLe: brut.debut,
      details: 'details' in brut ? brut.details : undefined,
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

  faits.sort((a, b) => (a.jourLogique !== b.jourLogique
    ? a.jourLogique.localeCompare(b.jourLogique)
    : a.id.localeCompare(b.id)));

  return { faits, refuses, manques: [] };
}
