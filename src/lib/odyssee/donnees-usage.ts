/**
 * L'enregistreur du journal d'usage.
 *
 * ## Une session par onglet, pas une par page
 *
 * Changer de page ferme et rouvre tout. Si chaque chargement ouvrait une
 * session, une visite de dix minutes à travers quatre écrans en compterait
 * quatre, et l'indicateur « nombre de sessions » mesurerait la navigation
 * dans Cyclades au lieu du comportement de la personne. L'identifiant de la
 * session court donc dans `sessionStorage`, qui survit à une navigation et
 * meurt avec l'onglet. `fusionnerLesProches()` rattrape ensuite ce qui
 * passerait quand même à travers — un rechargement complet, un retour arrière.
 *
 * ## Une pulsation, et pas seulement une fin
 *
 * Un onglet fermé brutalement — l'application tuée par le système, un
 * ordinateur qui s'éteint — n'émet jamais `pagehide`. Sans pulsation, sa
 * session resterait ouverte pour toujours : `fin: null`, donc durée inconnue,
 * donc un jour entier d'usage perdu. La pulsation fait que la fin connue est
 * au pire vieille d'une minute, ce qui est bien assez fin pour une médiane.
 *
 * Elle s'arrête quand l'onglet passe en arrière-plan. Un onglet oublié
 * pendant six heures ne doit pas produire une session de six heures : ce
 * serait mesurer l'oubli, pas l'usage.
 *
 * ## Après ouverture de la session, et non au chargement de la page
 *
 * L'enregistreur démarre sur `quandDeverrouille`. Quelqu'un qui arrive sur
 * l'écran de mot de passe et s'en va n'a pas utilisé Cyclades ; compter cette
 * visite ferait entrer dans le journal des arrivées qui ne sont pas des
 * usages, et ce journal sert justement à distinguer une absence réelle d'un
 * simple silence de saisie.
 */
import { db } from '../db';
import { jourLogique } from '../noyau/jour-logique';
import { ulid } from '../noyau/ulid';
import { aElaguer, controlerSession, type Session } from './usage';

const CLEF_DE_SESSION = 'cyclades.usage.session';
const PULSATION_MS = 60_000;

const maintenant = () => new Date().toISOString();

/* ══════════════════════════════════════════════════════════════════════════
   Lecture
   ══════════════════════════════════════════════════════════════════════════ */

export const toutesLesSessions = async (): Promise<Session[]> =>
  (await db()).getAll('odysseeUsage');

export const sessionsDuJour = async (jour: string): Promise<Session[]> =>
  (await db()).getAllFromIndex('odysseeUsage', 'jour', jour);

/* ══════════════════════════════════════════════════════════════════════════
   Écriture
   ══════════════════════════════════════════════════════════════════════════ */

async function ecrire(session: Session): Promise<void> {
  /*
     Le contrôle tourne à **chaque** écriture, et non une fois dans un essai.
     Ce qu'il empêche — un champ `page` ajouté « pour affiner » — s'ajouterait
     dans un module appelant, loin d'ici, et passerait toutes les
     vérifications de type puisque l'objet resterait un sur-ensemble valide
     de `Session`.
  */
  const problemes = controlerSession(session);
  if (problemes.length) throw new Error(problemes.join('\n'));
  await (await db()).put('odysseeUsage', session);
}

/** Élague ce qui dépasse `JOURS_CONSERVES`. Silencieux, et sans conséquence. */
export async function elaguerLUsage(le = new Date()): Promise<number> {
  const base = await db();
  const vieilles = aElaguer(await base.getAll('odysseeUsage'), jourLogique(le));
  for (const id of vieilles) await base.delete('odysseeUsage', id);
  return vieilles.length;
}

/* ══════════════════════════════════════════════════════════════════════════
   L'enregistreur
   ══════════════════════════════════════════════════════════════════════════ */

let pulsation: ReturnType<typeof setInterval> | null = null;
let enCours: Session | null = null;

const lireLIdentifiantDeLOnglet = (): string | null => {
  try {
    return sessionStorage.getItem(CLEF_DE_SESSION);
  } catch {
    // Navigation privée, stockage refusé : on ouvrira une session neuve. Le
    // journal perd la continuité entre deux pages, et c'est tout.
    return null;
  }
};

const retenirLIdentifiantDeLOnglet = (id: string): void => {
  try {
    sessionStorage.setItem(CLEF_DE_SESSION, id);
  } catch {
    /* Voir ci-dessus. */
  }
};

/** Reprend la session de cet onglet, ou en ouvre une. */
async function reprendreOuOuvrir(le: Date): Promise<Session> {
  const id = lireLIdentifiantDeLOnglet();
  if (id) {
    const ancienne = await (await db()).get('odysseeUsage', id);
    /*
       On ne reprend qu'une session du **même jour logique**. Un onglet laissé
       ouvert toute la nuit reprendrait sinon la session de la veille, et
       produirait une session de quatorze heures à cheval sur deux jours :
       l'amplitude de la journée et la durée médiane deviendraient toutes deux
       fausses, dans le sens qui inquiète.
    */
    if (ancienne && ancienne.jour === jourLogique(le)) return ancienne;
  }
  const neuve: Session = {
    id: ulid(),
    jour: jourLogique(le),
    debut: le.toISOString(),
    fin: null,
    majLe: maintenant(),
  };
  retenirLIdentifiantDeLOnglet(neuve.id);
  return neuve;
}

async function marquer(fin: string | null): Promise<void> {
  if (!enCours) return;
  enCours = { ...enCours, fin, majLe: maintenant() };
  await ecrire(enCours);
}

/**
 * Referme les sessions qu'aucun onglet ne tient plus.
 *
 * Un onglet tué par le système, un ordinateur éteint, un navigateur qui
 * plante : aucun n'émet `pagehide`, et leur session resterait ouverte pour
 * toujours. `duree()` rendrait alors `null`, et la journée entière
 * disparaîtrait des indicateurs — une panne technique se lirait comme une
 * journée sans usage, ce qui est exactement la confusion que ce journal
 * existe pour éviter.
 *
 * La fin retenue est `majLe` : le dernier battement reçu, donc le dernier
 * moment où l'on sait que l'onglet vivait. Ni l'instant présent, qui
 * inventerait des heures, ni `debut`, qui en effacerait.
 */
async function cloturerLesAbandonnees(sauf: string): Promise<void> {
  const base = await db();
  for (const s of await base.getAll('odysseeUsage')) {
    if (s.id === sauf || s.fin !== null) continue;
    await ecrire({ ...s, fin: s.majLe });
  }
}

const arreterLaPulsation = () => {
  if (pulsation !== null) clearInterval(pulsation);
  pulsation = null;
};

const demarrerLaPulsation = () => {
  arreterLaPulsation();
  pulsation = setInterval(() => void marquer(maintenant()), PULSATION_MS);
};

/**
 * Branche l'enregistreur sur le cycle de vie de la page.
 *
 * Rend une fonction qui le débranche — utile aux essais, qui ne doivent pas
 * laisser courir une pulsation d'une minute après leur dernière assertion.
 */
export async function enregistrerLUsage(le = new Date()): Promise<() => void> {
  enCours = await reprendreOuOuvrir(le);
  await cloturerLesAbandonnees(enCours.id);
  await marquer(le.toISOString());

  const surVisibilite = () => {
    if (document.visibilityState === 'hidden') {
      arreterLaPulsation();
      void marquer(maintenant());
    } else {
      demarrerLaPulsation();
      void marquer(maintenant());
    }
  };

  /*
     `pagehide` et non `beforeunload` : sur mobile, un onglet mis en
     arrière-plan puis récupéré par le système n'émet jamais `beforeunload`.
     `pagehide` part dans les deux cas, et c'est le seul événement sur lequel
     on puisse compter là où l'application est le plus utilisée.
  */
  const surDepart = () => void marquer(maintenant());

  document.addEventListener('visibilitychange', surVisibilite);
  window.addEventListener('pagehide', surDepart);
  if (document.visibilityState !== 'hidden') demarrerLaPulsation();

  // L'élagage profite de ce que la base est déjà ouverte, et n'a aucune raison
  // de retarder l'enregistrement : il part sans qu'on l'attende.
  void elaguerLUsage(le);

  return () => {
    arreterLaPulsation();
    document.removeEventListener('visibilitychange', surVisibilite);
    window.removeEventListener('pagehide', surDepart);
    enCours = null;
  };
}
