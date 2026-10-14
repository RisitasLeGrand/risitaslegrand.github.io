/** Petites fonctions utilitaires partagées par les pages. */

export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const lien = (chemin: string) => `${base}${chemin}`;

export function echapper(texte: string): string {
  const d = document.createElement('div');
  d.textContent = texte;
  return d.innerHTML;
}

/** Retire les accents et met en minuscules (recherche insensible). */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function formaterDuree(secondes: number): string {
  if (secondes < 60) return `${Math.round(secondes)} s`;
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste ? `${heures} h ${String(reste).padStart(2, '0')}` : `${heures} h`;
}

export function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function pluriel(n: number, singulier: string, plurielForme = `${singulier}s`): string {
  return `${n} ${n > 1 ? plurielForme : singulier}`;
}

/** Mélange un tableau (Fisher-Yates). */
export function melanger<T>(tableau: T[]): T[] {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

export function parametreUrl(nom: string): string | null {
  return new URLSearchParams(window.location.search).get(nom);
}

/** Affiche un message éphémère en bas de l'écran (gains d'XP, badges…). */
export function notifier(message: string, variante: 'info' | 'succes' | 'badge' = 'info') {
  let zone = document.getElementById('zone-notifications');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'zone-notifications';
    zone.className = 'pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4';
    zone.setAttribute('aria-live', 'polite');
    document.body.appendChild(zone);
  }
  const couleurs = {
    info: 'bg-slate-800 text-white',
    succes: 'bg-emerald-600 text-white',
    badge: 'bg-amber-500 text-white',
  }[variante];

  const bulle = document.createElement('div');
  bulle.className =
    'bulle-notification pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 ' +
    `text-sm font-medium shadow-lg ${couleurs}`;

  /*
     La coche de la décision 3 : « célébrations discrètes ». Une coche, pas un
     confetti. Elle est masquée aux lecteurs d'écran — le message lui-même dit
     déjà ce qui a réussi, et un « coche » lu à voix haute n'apprendrait rien.
     Le texte reste la source du sens ; la coche le renforce, elle ne le
     remplace pas.
  */
  if (variante === 'succes') {
    const coche = document.createElement('span');
    coche.dataset.coche = '';
    coche.setAttribute('aria-hidden', 'true');
    coche.className = 'shrink-0 font-bold';
    coche.textContent = '✓';
    bulle.appendChild(coche);
  }

  const texte = document.createElement('span');
  texte.textContent = message;
  bulle.appendChild(texte);

  zone.appendChild(bulle);
  requestAnimationFrame(() => bulle.classList.add('parue'));

  setTimeout(() => {
    bulle.classList.remove('parue');
    bulle.classList.add('sortante');
    // La durée de sortie vit dans la feuille de style, avec les autres jetons
    // du prompt 34 ; on la relit plutôt que d'en garder ici une copie qui
    // dériverait en silence. La marge couvre l'arrondi et le mouvement réduit,
    // où la durée tombe à 0,01 ms et la bulle doit tout de même disparaître.
    const sortie = Number.parseFloat(getComputedStyle(bulle).transitionDuration) * 1000;
    setTimeout(() => bulle.remove(), Math.max(sortie, 0) + 40);
  }, 2600);
}

/** L'état d'une option de QCM, une fois la réponse donnée. */
export type EtatOption = 'juste' | 'choisi-faux' | 'neutre';

const MARQUES: Record<EtatOption, { signe: string; dit: string } | null> = {
  juste: { signe: '✓', dit: 'Bonne réponse' },
  'choisi-faux': { signe: '✗', dit: 'Votre réponse, fausse' },
  neutre: null,
};

/**
 * Marque une option corrigée d'un signe, plutôt que de rayer son texte.
 *
 * ## Pourquoi ne plus barrer
 *
 * La réponse choisie à tort était rayée en rouge. C'est le seul texte de la
 * page qu'on a besoin de relire attentivement — « qu'est-ce que j'ai répondu,
 * au juste ? » — et c'était le seul rendu illisible. Un signe devant, une
 * bordure et un fond disent la même chose sans abîmer la lecture.
 *
 * ## Pourquoi un signe et pas seulement une couleur
 *
 * Rouge et vert sont la paire que la plus fréquente des dyschromatopsies
 * confond. Le signe porte donc l'information, la couleur la renforce, et un
 * texte masqué la donne aux lecteurs d'écran, pour qui ni l'un ni l'autre
 * n'existe.
 *
 * Idempotente : marquer deux fois ne double pas le signe. Le texte passe par
 * « textContent » de bout en bout — rien de ce qui vient d'une fiche n'est
 * interprété comme du HTML.
 */
export function marquerOption(bouton: HTMLElement, etat: EtatOption): void {
  const marque = MARQUES[etat];
  if (!marque || bouton.querySelector('[data-marque]')) return;

  const texte = bouton.textContent ?? '';
  bouton.textContent = '';

  const signe = document.createElement('span');
  signe.dataset.marque = etat;
  signe.setAttribute('aria-hidden', 'true');
  signe.className = 'shrink-0 font-bold';
  signe.textContent = marque.signe;

  const dit = document.createElement('span');
  dit.className = 'sr-only';
  dit.textContent = `${marque.dit} : `;

  const corps = document.createElement('span');
  corps.textContent = texte;

  bouton.append(signe, dit, corps);
}
