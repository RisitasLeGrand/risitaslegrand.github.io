/**
 * Les refus de propositions, gardés **localement et seulement localement**.
 *
 * ## Pourquoi pas un magasin, pourquoi pas la sauvegarde
 *
 * La décision 5 pose que Sport propose, que la personne dispose, et que le
 * réel fait foi : « aucune mémoire de désobéissance, aucun compteur de
 * propositions non suivies ». Un refus doit pourtant laisser une trace, sans
 * quoi la même proposition reviendrait le lendemain — ce qui est une façon de
 * ne pas écouter.
 *
 * La trace est donc réduite au strict nécessaire pour **se taire** : quel
 * exercice, quelle sorte de proposition, jusqu'à quand, et la charge d'alors.
 * Et elle vit dans le stockage local de l'appareil, où rien d'autre ne la
 * lit :
 *
 * - elle n'entre pas dans les magasins, donc **ni dans la synchronisation, ni
 *   dans la sauvegarde, ni dans l'export pour une IA** — on ne pourra jamais
 *   bâtir un reproche sur ce qu'elle contient ;
 * - elle expire d'elle-même, et le balayage la retire ;
 * - la perdre ne coûte rien : au pire une proposition revient une fois.
 *
 * Un magasin journalisé aurait fait exactement l'inverse : il aurait rendu
 * les refus durables, synchronisés et analysables. Le choix du stockage le
 * plus faible est ici le choix de fond.
 */
import type { Refus, SorteDeProposition } from './modulation';

const CLEF = 'cyclades.sport.refus';

const disponible = (): boolean => typeof localStorage !== 'undefined';

/** Les refus encore valables aujourd'hui. Les périmés sont effacés au passage. */
export function refusEnCours(aujourdhui: string): Refus[] {
  if (!disponible()) return [];
  let bruts: unknown;
  try {
    bruts = JSON.parse(localStorage.getItem(CLEF) ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(bruts)) return [];
  const valides = bruts.filter(
    (r): r is Refus =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as Refus).exerciceId === 'string' &&
      typeof (r as Refus).jusquAu === 'string' &&
      (r as Refus).jusquAu >= aujourdhui,
  );
  if (valides.length !== bruts.length) ecrire(valides);
  return valides;
}

function ecrire(refus: readonly Refus[]): void {
  if (!disponible()) return;
  try {
    localStorage.setItem(CLEF, JSON.stringify(refus));
  } catch {
    // Muet : un refus non retenu fait revenir une proposition, rien de plus.
  }
}

/**
 * Retient un refus.
 *
 * Un seul refus par couple exercice / sorte : refuser deux fois la même chose
 * ne prolonge pas le silence au-delà du dernier refus, et empiler les entrées
 * ferait grossir sans fin une donnée qui ne sert qu'à se taire.
 */
export function retenirRefus(refus: Refus, aujourdhui: string): void {
  const autres = refusEnCours(aujourdhui).filter(
    (r) => !(r.exerciceId === refus.exerciceId && r.sorte === refus.sorte),
  );
  ecrire([...autres, refus]);
}

/** Oublie un refus. Utilisé quand on revient sur une décision. */
export function oublierRefus(
  exerciceId: string,
  sorte: SorteDeProposition,
  aujourdhui: string,
): void {
  ecrire(refusEnCours(aujourdhui).filter((r) => !(r.exerciceId === exerciceId && r.sorte === sorte)));
}

/** Tout oublier. Un bouton d'écran, parce qu'une donnée invisible doit être effaçable. */
export function oublierTousLesRefus(): void {
  if (!disponible()) return;
  try {
    localStorage.removeItem(CLEF);
  } catch {
    // Muet.
  }
}
