/**
 * Lire et écrire les passations d'échelles, à travers le coffre.
 *
 * Même forme que `donnees-psyche.ts`. Une seule particularité, et elle est
 * voulue : **une passation ne se corrige pas**. Son identifiant est un ULID,
 * pas le jour — contrairement au check-in quotidien, qui se rajuste le soir.
 *
 * La raison tient à ce qu'est une échelle. Le check-in est une glissière
 * qu'on déplace ; une passation est un questionnaire rempli à un moment, sur
 * une période de rappel de deux semaines. La refaire le lendemain produit une
 * **autre** passation, et l'historique doit porter les deux : c'est
 * l'évolution qui informe, pas le dernier chiffre.
 */
import { db } from '../db';
import { exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import { jourLogique } from '../noyau/jour-logique';
import { ulid } from '../noyau/ulid';
import { echelle, noter, type IdEchelle, type Passation, type Resultat } from './echelles';

const maintenant = () => new Date().toISOString();

async function journaliser(scelle: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('../sync/faits-domaine');
    await journaliserEnregistrement('odysseePassations', scelle as Record<string, unknown>);
  } catch {
    // Muet : perdre une passation parce que le journal a échoué serait pire.
  }
}

export async function ecrirePassation(
  id: IdEchelle,
  reponses: readonly (number | null)[],
  options: { gene?: string | null; le?: Date } = {},
): Promise<Passation> {
  const cle = exigerLeCoffre();
  const e = echelle(id);
  if (reponses.length !== e.items.length) {
    throw new Error(
      `« ${id} » attend ${e.items.length} réponses, ${reponses.length} fournies. Une passation ` +
        'partielle s’enregistre avec des null, elle ne se tronque pas.',
    );
  }
  for (const r of reponses) {
    if (r === null) continue;
    if (!e.options.some((o) => o.valeur === r)) {
      throw new Error(`La valeur ${r} n’est pas une option de « ${id} ».`);
    }
  }
  const le = options.le ?? new Date();
  const passation: Passation = {
    id: ulid(),
    echelle: id,
    jour: jourLogique(le),
    reponses: [...reponses],
    gene: options.gene ?? null,
    majLe: maintenant(),
  };
  const scelle = await sceller(
    cle,
    'odysseePassations',
    passation as unknown as Record<string, unknown>,
  );
  await (await db()).put('odysseePassations', scelle as unknown as Passation);
  await journaliser(scelle);
  return passation;
}

export async function toutesLesPassations(): Promise<Passation[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll('odysseePassations')) as unknown as Record<
    string,
    unknown
  >[];
  const ouvertes = await Promise.all(rangees.map((r) => ouvrir<Passation>(cle, r)));
  return ouvertes.sort((a, b) => b.jour.localeCompare(a.jour) || b.majLe.localeCompare(a.majLe));
}

export interface PassationNotee {
  passation: Passation;
  resultat: Resultat;
}

/** L'historique d'une échelle, du plus récent au plus ancien, avec ses scores. */
export async function historique(id: IdEchelle): Promise<PassationNotee[]> {
  const e = echelle(id);
  return (await toutesLesPassations())
    .filter((p) => p.echelle === id)
    .map((p) => ({ passation: p, resultat: noter(e, p.reponses) }));
}

export async function supprimerPassation(id: string): Promise<void> {
  exigerLeCoffre();
  await (await db()).delete('odysseePassations', id);
  try {
    const { journaliserSuppressions } = await import('../sync/faits-domaine');
    await journaliserSuppressions([`odysseePassations:${id}`]);
  } catch {
    // Muet, comme l'écriture.
  }
}
