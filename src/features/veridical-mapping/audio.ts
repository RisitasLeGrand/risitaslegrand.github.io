/**
 * La chaîne Web Audio des stimuli sonores.
 *
 * Elle est écrite ici de bout en bout : contrairement à ce qu'indiquait le
 * cahier des charges, **aucune infrastructure Web Audio n'existait dans le
 * site**. Les podcasts de fiches sont des fichiers « .opus » synthétisés hors
 * ligne et lus par un lecteur ; le Quad N-Back joue des sons préenregistrés par
 * l'API Audio. Ni l'un ni l'autre ne synthétise quoi que ce soit, et produire
 * des sons dont l'intensité, la hauteur et la durée varient au pas près demande
 * un oscillateur.
 *
 * Une centaine de lignes et aucune dépendance, ce qui reste cohérent avec le
 * reste du projet.
 */

let contexte: AudioContext | null = null;

/** Le contexte, créé au premier besoin : en créer un au chargement serait refusé. */
function obtenirContexte(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!contexte) {
    const Constructeur =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructeur) return null;
    contexte = new Constructeur();
  }
  return contexte;
}

export function disponible(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext,
  );
}

/**
 * Débloque la lecture. Les navigateurs exigent qu'un contexte audio démarre
 * depuis un geste de l'utilisateur ; on le fait au clic sur « Commencer ».
 */
export async function debloquer(): Promise<boolean> {
  const ctx = obtenirContexte();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

/** Durée des fondus, en secondes : sans eux, chaque son claque. */
const FONDU = 0.012;

export interface Ton {
  frequenceHz: number;
  niveauDb: number;
  dureeMs: number;
}

/**
 * LE POINT D'APPEL GÉNÉRIQUE DU LOT L5, et il n'y en a qu'un ici.
 *
 * Prompt 63, lot L5. Décision du pilote du 1er novembre : le rendu va sur la
 * dimension, et les deux fichiers de rendu reçoivent un point d'appel chacun.
 *
 * `jouerTon` ci-dessous reste intact et sert les quatre dimensions sonores
 * d'origine : il joue UNE sinusoïde depuis trois nombres, ce qui ne peut
 * produire ni un motif rythmique, ni un nombre d'événements, ni de la parole.
 * Les familles `audition-motif` et `audition-parle` apportent donc leur propre
 * rendu, et cette fonction leur passe le contexte.
 *
 * **Elle ne synthétise rien elle-même**, et c'est le point : tout le code de
 * son des familles de B vit dans `dimensions/rendus/`, de son côté de la
 * frontière. Ici il n'y a que l'ouverture du contexte et le refus propre quand
 * il n'est pas disponible.
 *
 * Le refus rend une promesse résolue, comme `jouerTon`, et non une erreur : un
 * contexte audio suspendu est l'état normal avant le premier geste de la
 * personne, pas une panne. L'appelant verrouille son bouton sur cette promesse,
 * donc elle doit se résoudre dans tous les cas — c'est la leçon du délai de
 * garde de `jouerTon`, et elle vaut ici de la même façon.
 */
export async function jouerRendu(
  rendu: (cadre: { contexte: AudioContext; z: number; partiel: boolean }) => Promise<void>,
  { z, partiel = false }: { z: number; partiel?: boolean },
): Promise<void> {
  const ctx = obtenirContexte();
  if (!ctx || ctx.state !== 'running') return;
  await rendu({ contexte: ctx, z, partiel });
}

/**
 * Joue un ton et rend la main quand il est fini.
 *
 * Le niveau est donné en décibels relatifs au plein échelle, converti en gain
 * linéaire. Les plages des dimensions le maintiennent bien au-dessous de 1 :
 * le plus fort des stimuli est à −3 dB, soit un gain de 0,7.
 */
export function jouerTon({ frequenceHz, niveauDb, dureeMs }: Ton): Promise<void> {
  const ctx = obtenirContexte();
  if (!ctx || ctx.state !== 'running') return Promise.resolve();

  const duree = Math.max(0.03, dureeMs / 1000);
  const gainCible = Math.min(0.8, 10 ** (niveauDb / 20));
  const depart = ctx.currentTime + 0.02;
  const fin = depart + duree;

  const oscillateur = ctx.createOscillator();
  oscillateur.type = 'sine';
  oscillateur.frequency.value = frequenceHz;

  const gain = ctx.createGain();
  // Fondus en entrée et en sortie : une rampe linéaire depuis exactement zéro,
  // car une rampe exponentielle ne peut pas partir de zéro.
  gain.gain.setValueAtTime(0.0001, depart);
  gain.gain.linearRampToValueAtTime(gainCible, depart + FONDU);
  gain.gain.setValueAtTime(gainCible, Math.max(depart + FONDU, fin - FONDU));
  gain.gain.linearRampToValueAtTime(0.0001, fin);

  oscillateur.connect(gain).connect(ctx.destination);
  oscillateur.start(depart);
  oscillateur.stop(fin + 0.02);

  /*
   * `onended` **et** un délai de garde, et non `onended` seul.
   *
   * Le bouton d'écoute se verrouille pendant la lecture pour qu'on ne déclenche
   * pas deux tons superposés. Il se déverrouille quand cette promesse se
   * résout — c'est-à-dire jamais, si `onended` ne se déclenche pas. Or il ne se
   * déclenche pas toujours : un contexte audio suspendu en cours de ton, un
   * onglet passé à l'arrière-plan, un périphérique de sortie retiré, et
   * l'oscillateur s'arrête sans prévenir. Le bouton reste alors sur « en
   * cours… », définitivement, et l'essai devient impossible à terminer
   * autrement qu'en rechargeant la page.
   *
   * Le délai de garde est calé sur la durée du ton plus une marge : passé ce
   * temps, le son est fini ou ne viendra pas, et dans les deux cas l'interface
   * doit rendre la main. Le nettoyage est fait une seule fois, quelle que soit
   * la voie qui l'emporte.
   */
  return new Promise((resoudre) => {
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      clearTimeout(garde);
      try {
        oscillateur.disconnect();
        gain.disconnect();
      } catch {
        /* déjà déconnecté : rien à faire */
      }
      resoudre();
    };
    const garde = setTimeout(terminer, (duree + 0.1) * 1000 + MARGE_MS);
    oscillateur.onended = terminer;
  });
}

/**
 * Marge du délai de garde, en millisecondes. Assez large pour qu'un `onended`
 * normal arrive toujours le premier, assez courte pour qu'un blocage ne se
 * remarque pas comme une attente.
 */
const MARGE_MS = 400;

/** Un court silence, pour séparer deux stimuli sonores. */
export function silence(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}
