/**
 * Le thème à l'exécution : la palette, le mode, la bascule jour/nuit et
 * le thème Séance.
 *
 * ## Les quatre choses qui décident de ce qu'on voit
 *
 * 1. **La palette** (`revinsp.palette`) — l'un des quatorze thèmes. Absente,
 *    c'est Égée.
 * 2. **Le mode** — clair ou sombre. Il vient de la bascule jour/nuit si elle
 *    est active, sinon du choix habituel (`revinsp.theme` : clair, sombre ou
 *    « systeme »).
 * 3. **Le relais** — Papier n'a pas de mode sombre, Soir et Nuit de Délos
 *    pas de mode clair. Dans le mode manquant, Égée prend la main. La règle
 *    vit dans `themes.ts` (`themeEffectif`), appelée aussi par le script
 *    d'amorçage, pour que les deux ne répondent jamais deux choses
 *    différentes à la même question.
 * 4. **La séance** — pendant une séance de sport, le thème Séance passe
 *    devant tout le reste, puis rend la main.
 *
 * ## Pourquoi les heures sont recopiées dans `localStorage`
 *
 * La bascule doit s'appliquer **avant le premier rendu**, sinon la page
 * s'ouvre en clair avant de passer au sombre — l'éclair que l'addendum
 * interdit. Le script d'amorçage est synchrone ; IndexedDB ne l'est pas. Les
 * heures de lever et de coucher, qui vivent dans le profil, sont donc
 * recopiées dans `localStorage` à chaque chargement de page (`miroirDesHeures`),
 * et c'est cette copie que lit l'amorçage. Le profil reste la source : la
 * copie n'est jamais écrite par la personne, seulement par le site.
 *
 * Les heures propres à la bascule (`revinsp.heures-bascule`), elles, sont un
 * réglage à part entière : on peut les changer sous l'interrupteur sans
 * toucher à « Ma journée ». Quand elles existent, elles l'emportent.
 */
import { base } from './ui';
import {
  COUCHER_PAR_DEFAUT,
  LEVER_PAR_DEFAUT,
  THEME_PAR_DEFAUT,
  THEMES,
  themeEffectif,
  type Mode,
} from './themes';

export const CLE_PALETTE = 'revinsp.palette';
export const CLE_MODE = 'revinsp.theme';
export const CLE_BASCULE = 'revinsp.bascule-jour-nuit';
export const CLE_HEURES = 'revinsp.heures-bascule';
export const CLE_MIROIR = 'revinsp.heures-journee';

/* Les heures d'usine vivent dans `themes.ts`, qui s'importe partout ; on
   les réexporte pour que les appelants n'aient pas à le savoir. */
export { COUCHER_PAR_DEFAUT, LEVER_PAR_DEFAUT };

export type Choix = 'clair' | 'sombre' | 'systeme';

const lire = (cle: string): string | null => {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
};
const ecrire = (cle: string, valeur: string) => {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* navigation privée : le réglage ne vaudra que pour cette page */
  }
};

/* ── Les réglages ────────────────────────────────────────────────────────── */

export function lirePalette(): string {
  const brut = lire(CLE_PALETTE);
  return brut && THEMES.some((t) => t.id === brut) ? brut : THEME_PAR_DEFAUT;
}

export function ecrirePalette(id: string) {
  ecrire(CLE_PALETTE, id);
  appliquer();
}

/** La bascule jour/nuit est **active par défaut** : c'est la demande d'Alexis. */
export const lireBascule = (): boolean => lire(CLE_BASCULE) !== 'non';

export function ecrireBascule(active: boolean) {
  ecrire(CLE_BASCULE, active ? 'oui' : 'non');
  appliquer();
}

export function lireChoixDeMode(): Choix {
  const brut = lire(CLE_MODE);
  return brut === 'clair' || brut === 'sombre' || brut === 'systeme' ? brut : 'sombre';
}

export function ecrireChoixDeMode(choix: Choix) {
  ecrire(CLE_MODE, choix);
  appliquer();
}

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Les heures de bascule : celles du réglage, sinon « Ma journée », sinon 7 h et 21 h. */
export function heuresDeBascule(): { lever: string; coucher: string } {
  for (const cle of [CLE_HEURES, CLE_MIROIR]) {
    const brut = lire(cle);
    if (!brut) continue;
    const [lever, coucher] = brut.split('|');
    if (HEURE.test(lever ?? '') && HEURE.test(coucher ?? '')) return { lever, coucher };
  }
  return { lever: LEVER_PAR_DEFAUT, coucher: COUCHER_PAR_DEFAUT };
}

export function ecrireHeuresDeBascule(lever: string, coucher: string) {
  if (!HEURE.test(lever) || !HEURE.test(coucher)) return;
  ecrire(CLE_HEURES, `${lever}|${coucher}`);
  appliquer();
}

/** Efface le réglage d'heures : « Ma journée » reprend la main. */
export function oublierLesHeures() {
  try {
    localStorage.removeItem(CLE_HEURES);
  } catch {
    /* rien à faire */
  }
  appliquer();
}

/**
 * Recopie les heures de « Ma journée » pour le script d'amorçage.
 * Appelée par le site, jamais par la personne.
 */
export function miroirDesHeures(lever: unknown, coucher: unknown) {
  if (typeof lever !== 'string' || typeof coucher !== 'string') return;
  if (!HEURE.test(lever) || !HEURE.test(coucher)) return;
  ecrire(CLE_MIROIR, `${lever}|${coucher}`);
}

/* ── Le mode rendu ───────────────────────────────────────────────────────── */

const enMinutes = (heure: string) => Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3, 5));

/**
 * Le jour, de l'heure de lever à l'heure de coucher.
 *
 * Le cas « coucher avant lever » n'est pas une erreur de saisie : qui se
 * couche à 1 h et se lève à 7 h a une journée qui ne contient pas minuit. On
 * compare donc dans le bon sens selon l'ordre des deux heures, plutôt que de
 * supposer que le jour ne franchit jamais minuit.
 */
export function faitJour(maintenant = new Date()): boolean {
  const { lever, coucher } = heuresDeBascule();
  const minute = maintenant.getHours() * 60 + maintenant.getMinutes();
  const l = enMinutes(lever);
  const c = enMinutes(coucher);
  return l <= c ? minute >= l && minute < c : minute >= l || minute < c;
}

export function modeVoulu(maintenant = new Date()): Mode {
  if (lireBascule()) return faitJour(maintenant) ? 'clair' : 'sombre';
  const choix = lireChoixDeMode();
  if (choix !== 'systeme') return choix;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
}

/* ── L'application ───────────────────────────────────────────────────────── */

const ID_FEUILLE = 'feuille-theme';

/**
 * Charge la feuille d'un thème, s'il en faut une.
 *
 * Égée et Séance sont dans le paquet principal ; les treize autres sont des
 * fichiers à part, et un seul est chargé à la fois. C'est la règle du § 4 :
 * « seul le thème actif est chargé ».
 */
export function chargerLaFeuille(id: string): Promise<void> {
  const existante = document.getElementById(ID_FEUILLE) as HTMLLinkElement | null;
  if (id === THEME_PAR_DEFAUT) {
    existante?.remove();
    return Promise.resolve();
  }
  const href = `${base}/themes/${id}.css`;
  if (existante?.getAttribute('href') === href) return Promise.resolve();
  return new Promise((fini) => {
    const lien = document.createElement('link');
    lien.rel = 'stylesheet';
    lien.id = ID_FEUILLE;
    lien.href = href;
    lien.addEventListener('load', () => fini(), { once: true });
    /* Une feuille introuvable ne doit pas figer la page : on rend la main,
       et les sélecteurs d'Égée continuent de s'appliquer. */
    lien.addEventListener('error', () => fini(), { once: true });
    existante?.remove();
    document.head.appendChild(lien);
  });
}

/** Met la barre du navigateur à la couleur du fond, thème compris. */
function couleurDeBarre() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const fond = getComputedStyle(document.documentElement).getPropertyValue('--etat-fond').trim();
  if (fond) meta.setAttribute('content', fond);
}

/** Pose le thème courant sur la racine. Idempotent. */
export function appliquer(maintenant = new Date()) {
  const racine = document.documentElement;
  const mode = modeVoulu(maintenant);
  const choisie = lirePalette();
  const effective = themeEffectif(choisie, mode);

  racine.setAttribute('data-theme', mode);
  racine.setAttribute('data-theme-choix', lireBascule() ? 'bascule' : lireChoixDeMode());
  racine.setAttribute('data-palette', effective);
  racine.setAttribute('data-palette-choisie', choisie);
  racine.style.colorScheme = mode === 'sombre' ? 'dark' : 'light';

  void chargerLaFeuille(effective).then(couleurDeBarre);
  couleurDeBarre();
  document.dispatchEvent(
    new CustomEvent('revinsp:theme', { detail: { theme: mode, palette: effective } }),
  );
}

/**
 * Surveille l'heure : la bascule se fait sans rechargement.
 *
 * Toutes les minutes, et au retour au premier plan. Le retour au premier plan
 * n'est pas du luxe : un téléphone posé sur la table endort ses minuteurs, et
 * la page reprise à 21 h 30 serait restée claire jusqu'à la minute suivante.
 */
export function surveillerLHeure(): () => void {
  let dernier = modeVoulu();
  const verifier = () => {
    const voulu = modeVoulu();
    if (voulu !== dernier) {
      dernier = voulu;
      appliquer();
    }
  };
  const minuterie = setInterval(verifier, 60_000);
  document.addEventListener('visibilitychange', verifier);
  const media = matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', verifier);
  return () => {
    clearInterval(minuterie);
    document.removeEventListener('visibilitychange', verifier);
    media.removeEventListener('change', verifier);
  };
}

/* ── Le thème Séance ─────────────────────────────────────────────────────── */

export type VarianteDeSeance = 'seance-soleil' | 'seance-salle';

/**
 * La variante qui convient au moment où la séance commence.
 *
 * Elle est figée pour toute la séance, même si l'heure de bascule passe :
 * une salle ne s'éclaire pas parce qu'il est 21 h.
 */
export const varianteDeDepart = (): VarianteDeSeance =>
  modeVoulu() === 'sombre' ? 'seance-salle' : 'seance-soleil';

export function poserLeThemeDeSeance(variante: VarianteDeSeance) {
  document.documentElement.setAttribute('data-seance', variante);
  couleurDeBarre();
}

export function retirerLeThemeDeSeance() {
  document.documentElement.removeAttribute('data-seance');
  couleurDeBarre();
}

export const themeDeSeanceActif = (): VarianteDeSeance | null =>
  (document.documentElement.getAttribute('data-seance') as VarianteDeSeance) || null;
