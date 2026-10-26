/**
 * Les saisies : une par nature, construites une seule fois.
 *
 * ## Pourquoi ce module existe
 *
 * Ces constructeurs vivaient dans le script de `initialisation.astro`, et
 * « Mon profil » n'y avait pas accès : une page ne s'importe pas. Le profil
 * demandait donc **un seul champ texte pour toutes les natures**, et une
 * répartition s'y corrigeait en tapant du JSON à la main — « Forme attendue :
 * {"cognition": 10} ». Son propre commentaire le disait provisoire, et
 * signalait que l'exemple affiché parlait de domaines jusque devant les dates
 * d'épreuves, où il est faux.
 *
 * Une personne à qui l'on demande d'écrire un dictionnaire JSON pour changer
 * ses heures par domaine n'a pas un champ malcommode : elle a une porte
 * fermée. Et le remède existait déjà, vingt lignes plus loin dans un autre
 * fichier.
 *
 * ## Ce que l'extraction a dû changer, et rien de plus
 *
 * `repartition` appelait `$('valider').click()` depuis son bouton « Je ne sais
 * pas encore » : elle atteignait le DOM de la page d'initialisation, et aurait
 * été muette ailleurs. Ce point devient `surInconnu`, un rappel injecté.
 *
 * Elle bornait aussi à 20 et affichait « h » en dur. Les deux deviennent des
 * options, dont les valeurs par défaut sont celles d'avant : l'initialisation
 * se comporte à l'identique, et le profil peut suivre l'unité déclarée au
 * catalogue plutôt que d'en inventer une.
 *
 * Tout le reste est repris mot pour mot, commentaires compris — ils portent
 * des défauts mesurés, et les réécrire les perdrait.
 */
import { accorde, nombreFr } from './accords';
import { DOMAINES } from './domaines';
import {
  BORNES,
  CHOIX,
  MAXIMUM_LIGNES,
  MULTIPLES,
  SAISIE_LIBRE_CHIFFREE,
  SUGGESTIONS,
  avisDeSaisie,
  type Option,
} from './initialisation';
import { PARCOURS } from '../parcours/registre';
import { jourLogique } from './jour-logique';
import type { ChampDeclare } from './profil';

/** Ce qu'une saisie sait faire : se montrer, et rendre une valeur. */
export interface Saisie {
  element: HTMLElement;
  /** La valeur saisie, ou `undefined` quand rien n'est utilisable. */
  lire: () => unknown;
  /** Quand la saisie se valide d'elle-même — un bouton de choix unique. */
  immediate?: boolean;
}

/** Une clé de répartition ou de dates, et ce qu'elle se nomme à l'écran. */
export interface ClefLibellee {
  clef: string;
  libelle: string;
}

export const CLASSE_BASCULE =
  'min-h-11 rounded-lg border px-4 text-sm font-medium transition ' +
  'border-slate-300 text-slate-700 hover:border-indigo-400 ' +
  'dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-600';
export const CLASSE_BASCULE_ACTIVE =
  'min-h-11 rounded-lg border px-4 text-sm font-medium transition ' +
  'border-indigo-600 bg-indigo-50 text-indigo-800 ' +
  'dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-200';

const CLASSE_CHAMP =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 ' +
  'dark:border-slate-700 dark:bg-slate-950 dark:text-white';

export function bascules(options: readonly Option[], retenues: unknown[]): Saisie {
  const choisies = new Set(retenues.map((v) => String(v)));
  const element = document.createElement('div');
  element.className = 'flex flex-wrap gap-2';
  for (const option of options) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.dataset.valeur = String(option.valeur);
    const peindre = () => {
      const active = choisies.has(String(option.valeur));
      bouton.className = active ? CLASSE_BASCULE_ACTIVE : CLASSE_BASCULE;
      bouton.setAttribute('aria-pressed', active ? 'true' : 'false');
    };
    bouton.textContent = option.libelle;
    peindre();
    bouton.addEventListener('click', () => {
      const clef = String(option.valeur);
      if (choisies.has(clef)) choisies.delete(clef);
      else choisies.add(clef);
      peindre();
    });
    element.appendChild(bouton);
  }
  return {
    element,
    lire: () => options.filter((o) => choisies.has(String(o.valeur))).map((o) => String(o.valeur)),
  };
}

export function choixUnique(
  options: readonly Option[],
  retenue: unknown,
  valider: () => void,
): Saisie {
  let choisie: unknown = retenue;
  const element = document.createElement('div');
  element.className = 'grid gap-2';
  for (const option of options) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.dataset.valeur = String(option.valeur);
    bouton.className =
      'w-full rounded-xl border px-4 py-3 text-left transition ' +
      (String(choisie) === String(option.valeur)
        ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/50'
        : 'border-slate-300 hover:border-indigo-400 dark:border-slate-700 dark:hover:border-indigo-600');
    const titre = document.createElement('span');
    titre.className = 'block font-medium text-slate-900 dark:text-white';
    titre.textContent = option.libelle;
    bouton.appendChild(titre);
    if (option.aide) {
      const aide = document.createElement('span');
      aide.className = 'mt-1 block text-sm text-slate-500 dark:text-slate-400';
      aide.textContent = option.aide;
      bouton.appendChild(aide);
    }
    bouton.addEventListener('click', () => {
      choisie = option.valeur;
      valider();
    });
    element.appendChild(bouton);
  }
  return { element, lire: () => choisie, immediate: true };
}

/**
 * Un nombre tapé librement, que rien ne borne — et qui se fait remarquer
 * quand il est invraisemblable.
 *
 * Le repli `texte()` aurait rendu une chaîne pour un champ de nature
 * « nombre » : `valider()` l'aurait refusée, et l'écran aurait été mort sans
 * que rien ne plante. Le curseur de `BORNES`, lui, aurait imposé des bornes
 * dures là où B.3 demande un avertissement — un minimum à 1900 refuserait
 * quelqu'un né en 1895.
 *
 * D'où ce troisième cas : une saisie numérique sans borne, doublée d'une
 * phrase sous le champ quand la valeur étonne. La phrase n'empêche pas de
 * continuer ; c'est tout son intérêt.
 */
export function nombreLibre(declare: ChampDeclare, defaut: number | null): Saisie {
  const enveloppe = document.createElement('div');
  const champ = document.createElement('input');
  champ.type = 'number';
  champ.inputMode = 'numeric';
  champ.id = `saisie-${declare.champ}`;
  champ.setAttribute('aria-labelledby', 'question');
  champ.value = defaut === null ? '' : String(defaut);
  champ.autocomplete = 'off';
  champ.className = CLASSE_CHAMP;
  enveloppe.appendChild(champ);

  const avis = document.createElement('p');
  avis.id = `avis-${declare.champ}`;
  avis.className = 'mt-2 hidden text-sm text-amber-800 dark:text-amber-300';
  avis.setAttribute('role', 'status');
  enveloppe.appendChild(avis);

  champ.addEventListener('input', () => {
    const n = Number(champ.value);
    const phrase =
      champ.value.trim() === '' || !Number.isFinite(n)
        ? null
        : avisDeSaisie(declare.champ, n, jourLogique(new Date()));
    avis.textContent = phrase ?? '';
    avis.classList.toggle('hidden', phrase === null);
  });

  return {
    element: enveloppe,
    lire: () => {
      const n = Number(champ.value);
      return champ.value.trim() === '' || !Number.isFinite(n) ? undefined : n;
    },
  };
}

export function texte(declare: ChampDeclare, defaut: string): Saisie {
  const enveloppe = document.createElement('div');
  const champ = document.createElement('input');
  champ.type = 'text';
  champ.id = `saisie-${declare.champ}`;
  /* La question est le titre de l'écran : la désigner vaut mieux que la
     recopier dans un « aria-label » qui se désynchroniserait d'elle. */
  champ.setAttribute('aria-labelledby', 'question');
  champ.value = defaut;
  champ.autocomplete = 'off';
  champ.className = CLASSE_CHAMP;
  enveloppe.appendChild(champ);

  const suggestions = SUGGESTIONS[declare.champ];
  if (suggestions?.length) {
    const liste = document.createElement('div');
    liste.className = 'mt-3 flex flex-wrap gap-2';
    for (const mot of suggestions) {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = CLASSE_BASCULE;
      bouton.textContent = mot;
      bouton.addEventListener('click', () => {
        champ.value = mot;
        champ.focus();
      });
      liste.appendChild(bouton);
    }
    enveloppe.appendChild(liste);
  }
  return { element: enveloppe, lire: () => champ.value.trim() };
}

export function lignes(declare: ChampDeclare, defaut: string[]): Saisie {
  const maximum = MAXIMUM_LIGNES[declare.champ] ?? 3;
  const enveloppe = document.createElement('div');
  enveloppe.className = 'space-y-2';
  const champs: HTMLInputElement[] = [];
  for (let i = 0; i < maximum; i += 1) {
    const champ = document.createElement('input');
    champ.type = 'text';
    champ.value = defaut[i] ?? '';
    champ.placeholder = i === 0 ? 'Une phrase suffit' : 'Facultatif';
    champ.className = CLASSE_CHAMP;
    champs.push(champ);
    enveloppe.appendChild(champ);
  }
  return {
    element: enveloppe,
    lire: () => champs.map((c) => c.value.trim()).filter(Boolean),
  };
}

/*
   U2 DU 43 — UNE HEURE NON RÉPONDUE N'EST PAS SEPT HEURES.

   Cette saisie partait de « 07:00 » quand rien n'était connu. Le champ
   n'étant jamais vide, `lire()` rendait toujours une valeur, et passer
   l'écran sans y toucher ÉCRIVAIT sept heures au profil — avec la source
   « declare », c'est-à-dire « la personne l'a dit ». Elle ne l'avait pas
   dit. Et une heure de lever fausse déplace la bascule de journée, donc
   la revue du soir, donc le compte des séances.

   Elle part donc vide, et la note le dit. Une valeur déjà enregistrée est
   bien reproposée : revenir sur une question ne doit pas effacer la
   réponse d'avant.
*/
export function heure(declare: ChampDeclare, defaut: string | null): Saisie {
  const enveloppe = document.createElement('div');
  const champ = document.createElement('input');
  champ.type = 'time';
  champ.step = '900';
  champ.id = `saisie-${declare.champ}`;
  champ.setAttribute('aria-labelledby', 'question');
  champ.value = defaut ?? '';
  champ.className =
    'rounded-lg border border-slate-300 px-3 py-2 text-slate-900 ' +
    'dark:border-slate-700 dark:bg-slate-950 dark:text-white';
  const note = document.createElement('p');
  note.className = 'mt-2 text-xs text-slate-500 dark:text-slate-400';
  note.textContent = 'Laissez vide si vous ne savez pas.';
  enveloppe.append(champ, note);
  return { element: enveloppe, lire: () => (champ.value ? champ.value : undefined) };
}

/*
   U2 DU 43 — UN CURSEUR NON TOUCHÉ N'A RIEN RÉPONDU.

   `lire()` rendait `Number(champ.value)`, donc TOUJOURS un nombre : passer
   l'écran sans toucher le curseur écrivait sa position de départ, zéro
   quand rien n'était connu. Un zéro écrit « declare » est une réponse,
   pas une absence de réponse — et il se propage aux déductions.

   Un curseur n'a pas d'état vide : on en tient donc un, et on l'affiche.
   Tant que la personne n'a pas bougé le curseur ET qu'aucune valeur
   n'était enregistrée, l'écran dit « non répondu » et rien n'est écrit.
   Une valeur déjà enregistrée compte, elle, comme une réponse : la
   reproposer et ne pas la réécrire reviendrait à la perdre au prochain
   passage.
*/
export function curseur(declare: ChampDeclare, defaut: number | null): Saisie {
  const bornes =
    BORNES[declare.champ] ?? { min: 0, max: 40, pas: 1, unite: { un: '', plusieurs: '' } };
  const enveloppe = document.createElement('div');
  const valeur = document.createElement('p');
  valeur.className = 'text-2xl font-semibold text-slate-900 dark:text-white';
  const champ = document.createElement('input');
  champ.type = 'range';
  champ.id = `saisie-${declare.champ}`;
  champ.setAttribute('aria-labelledby', 'question');
  champ.min = String(bornes.min);
  champ.max = String(bornes.max);
  champ.step = String(bornes.pas);
  const depart = defaut ?? Math.round((bornes.min + bornes.max) / 2);
  champ.value = String(Math.min(bornes.max, Math.max(bornes.min, depart)));
  champ.className = 'mt-2 w-full';
  let repondu = defaut !== null;
  const note = document.createElement('p');
  note.className = 'mt-2 text-xs text-slate-500 dark:text-slate-400';
  note.textContent = 'Laissez vide si vous ne savez pas : touchez le curseur pour répondre.';
  const peindre = () => {
    if (!repondu) {
      valeur.textContent = 'non répondu';
      note.classList.remove('hidden');
      return;
    }
    const n = Number(champ.value);
    valeur.textContent =
      `${nombreFr(n)} ${accorde(n, bornes.unite.un, bornes.unite.plusieurs)}`.trim();
    note.classList.add('hidden');
  };
  champ.addEventListener('input', () => {
    repondu = true;
    peindre();
  });
  peindre();
  enveloppe.append(valeur, champ, note);
  return { element: enveloppe, lire: () => (repondu ? Number(champ.value) : undefined) };
}

/** Ce que l'appelant décide d'une répartition : ses bornes, son unité, sa sortie. */
export interface OptionsRepartition {
  /** Le haut du curseur. 20 par défaut, comme à l'initialisation. */
  max?: number;
  /** L'unité lue à droite de chaque ligne. « h » par défaut. */
  unite?: string;
  /**
   * Ce que fait « Je ne sais pas encore ». À l'initialisation, valider
   * l'écran ; ailleurs, fermer la boîte. Sans rappel, le bouton n'est pas
   * posé : un bouton qui ne fait rien vaut moins que pas de bouton.
   */
  surInconnu?: () => void;
}

export function repartition(
  champs: readonly ClefLibellee[],
  defaut: Record<string, number>,
  options: OptionsRepartition = {},
): Saisie {
  const max = options.max ?? 20;
  const unite = options.unite ?? 'h';
  const enveloppe = document.createElement('div');
  enveloppe.className = 'space-y-3';
  const curseurs = new Map<string, HTMLInputElement>();
  let inconnu = false;
  for (const { clef, libelle } of champs) {
    const ligne = document.createElement('div');
    const etiquette = document.createElement('div');
    etiquette.className = 'flex items-baseline justify-between text-sm';
    const nom = document.createElement('span');
    nom.className = 'text-slate-700 dark:text-slate-200';
    nom.textContent = libelle;
    const lu = document.createElement('span');
    lu.className = 'font-medium text-slate-900 dark:text-white';
    const champ = document.createElement('input');
    champ.type = 'range';
    champ.min = '0';
    champ.max = String(max);
    champ.step = '1';
    champ.value = String(defaut[clef] ?? 0);
    champ.className = 'mt-1 w-full';
    champ.setAttribute('aria-label', libelle);
    const peindre = () => {
      lu.textContent = `${Number(champ.value)} ${unite}`;
    };
    champ.addEventListener('input', peindre);
    peindre();
    etiquette.append(nom, lu);
    ligne.append(etiquette, champ);
    curseurs.set(clef, champ);
    enveloppe.appendChild(ligne);
  }
  if (options.surInconnu) {
    const pas = document.createElement('button');
    pas.type = 'button';
    pas.className = CLASSE_BASCULE;
    pas.textContent = 'Je ne sais pas encore';
    pas.addEventListener('click', () => {
      inconnu = true;
      options.surInconnu!();
    });
    enveloppe.appendChild(pas);
  }
  return {
    element: enveloppe,
    lire: () => {
      /*
         U2 DU 43. « Je ne sais pas encore » rendait `{}`, et la boucle
         d'enregistrement écrivait cet objet vide : le profil portait alors
         une répartition DÉCLARÉE et vide, ce qui n'est pas la même chose
         qu'une répartition inconnue. Un « je ne sais pas » n'écrit rien.
         Et si tous les curseurs sont à zéro, il n'y a rien à dire non plus.
      */
      if (inconnu) return undefined;
      const sortie: Record<string, number> = {};
      for (const [clef, champ] of curseurs) {
        const n = Number(champ.value);
        if (n > 0) sortie[clef] = n;
      }
      return Object.keys(sortie).length ? sortie : undefined;
    },
  };
}

export function dates(
  clefs: readonly ClefLibellee[],
  defaut: Record<string, unknown>,
): Saisie {
  const enveloppe = document.createElement('div');
  enveloppe.className = 'space-y-3';
  const champs = new Map<string, HTMLInputElement>();
  for (const { clef, libelle } of clefs) {
    const ligne = document.createElement('label');
    ligne.className = 'block text-sm';
    const nom = document.createElement('span');
    nom.className = 'block text-slate-700 dark:text-slate-200';
    nom.textContent = libelle;
    const champ = document.createElement('input');
    champ.type = 'date';
    const deja = defaut[clef];
    champ.value = typeof deja === 'string' ? deja : '';
    champ.className =
      'mt-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 ' +
      'dark:border-slate-700 dark:bg-slate-950 dark:text-white';
    champs.set(clef, champ);
    ligne.append(nom, champ);
    enveloppe.appendChild(ligne);
  }
  const note = document.createElement('p');
  note.className = 'text-xs text-slate-500 dark:text-slate-400';
  note.textContent = 'Laissez vide si vous ne savez pas encore.';
  enveloppe.appendChild(note);
  return {
    element: enveloppe,
    lire: () => {
      /* U2 DU 43 : aucune date saisie, rien à enregistrer — et surtout pas
         un objet vide, qui se lirait comme « aucune épreuve ». */
      const sortie: Record<string, string> = {};
      for (const [clef, champ] of champs) if (champ.value) sortie[clef] = champ.value;
      return Object.keys(sortie).length ? sortie : undefined;
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   La saisie qui convient à un champ
   ══════════════════════════════════════════════════════════════════════════ */

/** Les matières de tous les parcours, dédoublonnées et triées. */
export function matieresDesParcours(): { valeur: string; libelle: string }[] {
  const vues = new Map<string, string>();
  for (const parcours of PARCOURS) {
    for (const theme of parcours.themes) {
      for (const matiere of theme.matieres) vues.set(matiere, matiere);
    }
  }
  return [...vues.keys()]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((m) => ({ valeur: m, libelle: m }));
}

/**
 * Les domaines qu'une répartition par domaine doit montrer.
 *
 * `null` veut dire « on ne sait pas ce qui a été retenu » : c'est le cas à
 * l'initialisation, où la question des domaines se pose avant mais où la
 * réponse n'est pas encore relue, et le cas d'un profil qui n'y a pas répondu.
 * On retombe alors sur les domaines actifs par défaut, qui sont la bonne
 * réponse là.
 *
 * Une liste **vide** n'est pas `null`, et la distinction compte : elle veut
 * dire « je n'en suis aucun », et elle est respectée. Les confondre
 * réafficherait les domaines par défaut à quelqu'un qui les a tous coupés.
 *
 * L'ordre est celui du catalogue, jamais celui de la réponse : deux écrans qui
 * listent les mêmes domaines dans un ordre différent se lisent comme deux
 * listes différentes.
 */
export function domainesAMontrer(retenus: readonly string[] | null): ClefLibellee[] {
  const gardes = retenus === null ? null : new Set(retenus);
  return DOMAINES.filter((d) => (gardes ? gardes.has(d.id) : d.actifParDefaut)).map((d) => ({
    clef: d.id,
    libelle: d.libelle,
  }));
}

/** Ce que l'écran appelant fournit à l'aiguillage. */
export interface OptionsSaisiePourChamp {
  /**
   * Ce que fait un choix unique une fois cliqué : il se valide de lui-même.
   * À l'initialisation, passer à l'écran suivant ; dans une boîte, la fermer.
   */
  valider: () => void;
  /** Ce que fait « Je ne sais pas encore » sur une répartition. */
  surInconnu?: () => void;
  /**
   * Les domaines à montrer dans une répartition par domaine.
   *
   * Sans cette option, ce sont les domaines actifs **par défaut**. C'est juste
   * à l'initialisation, où la question des domaines se pose avant et où rien
   * n'a encore été coupé. Depuis « Mon profil », c'est faux : un domaine que
   * la personne a coupé réapparaissait dans sa répartition d'heures, et lui
   * demandait donc de répartir du temps sur quelque chose qu'elle avait
   * justement retiré.
   */
  domaines?: readonly ClefLibellee[];
}

/**
 * La saisie qui convient à ce champ.
 *
 * ## Elle aiguille par NOM, et c'est à savoir
 *
 * On s'attendrait à une saisie par nature. Ce n'en est pas une : la nature
 * n'est consultée que pour `heure`, et tout le reste se décide sur le nom du
 * champ ou sur sa présence dans une table — `CHOIX`, `BORNES`,
 * `MAXIMUM_LIGNES`, `SAISIE_LIBRE_CHIFFREE`.
 *
 * Ce n'est pas un défaut à corriger ici : deux champs de même nature n'ont pas
 * la même saisie — `tempsParDomaine` et `datesEpreuves` sont tous deux
 * déclarés « repartition », et l'un veut des curseurs d'heures, l'autre un
 * calendrier par parcours. La nature dit comment la valeur se stocke, pas
 * comment elle se demande.
 *
 * ## Pourquoi cet aiguillage est partagé, et non recopié
 *
 * « Mon profil » et l'initialisation posent les mêmes questions sur les mêmes
 * champs. Deux aiguillages finiraient par diverger, et la divergence se
 * verrait là où elle coûte le plus : un champ qu'on règle à l'initialisation
 * avec des curseurs et qu'on corrige ensuite dans un champ texte.
 *
 * ## QUELS DOMAINES UNE RÉPARTITION MONTRE
 *
 * Par défaut, les domaines actifs **par défaut**. C'est juste à
 * l'initialisation, où la question des domaines se pose avant et où rien n'a
 * encore été coupé.
 *
 * Ce ne l'est pas depuis « Mon profil » : un domaine coupé réapparaissait
 * dans la répartition d'heures, et demandait de répartir du temps sur ce
 * qu'on venait de retirer. L'appelant passe donc `domaines` quand il sait
 * lesquels ont été retenus, et l'option existe pour que ce soit l'écran qui
 * le dise — ce module ne lit pas le profil.
 */
export function saisiePourChamp(
  declare: ChampDeclare,
  defaut: unknown,
  options: OptionsSaisiePourChamp,
): Saisie {
  const champ = declare.champ;

  if (champ === 'domainesActifs') {
    const choix = DOMAINES.map((d) => ({ valeur: d.id, libelle: d.libelle, aide: d.description }));
    const retenues = Array.isArray(defaut)
      ? (defaut as unknown[])
      : DOMAINES.filter((d) => d.actifParDefaut).map((d) => d.id);
    return bascules(choix, retenues);
  }
  if (champ === 'concours') {
    const choix = PARCOURS.map((p) => ({ valeur: p.id, libelle: p.libelle, aide: p.intitule }));
    return bascules(choix, Array.isArray(defaut) ? (defaut as unknown[]) : []);
  }
  if (champ === 'matieresFortes' || champ === 'matieresFaibles') {
    return bascules(matieresDesParcours(), Array.isArray(defaut) ? (defaut as unknown[]) : []);
  }
  if (champ === 'tempsParDomaine' || champ === 'ciblesEquilibre') {
    const actifs = options.domaines ?? domainesAMontrer(null);
    return repartition(actifs, (defaut as Record<string, number>) ?? {}, {
      unite: declare.unite?.un ?? 'h',
      surInconnu: options.surInconnu,
    });
  }
  if (champ === 'datesEpreuves') {
    const clefs = PARCOURS.map((p) => ({ clef: p.id, libelle: p.libelle }));
    return dates(clefs, (defaut as Record<string, unknown>) ?? {});
  }

  const choix = CHOIX[champ];
  if (choix) {
    if (MULTIPLES.includes(champ)) {
      return bascules(choix, Array.isArray(defaut) ? (defaut as unknown[]) : []);
    }
    return choixUnique(choix, defaut, options.valider);
  }
  if (SAISIE_LIBRE_CHIFFREE.includes(champ)) {
    return nombreLibre(declare, typeof defaut === 'number' ? defaut : null);
  }
  if (champ in BORNES) return curseur(declare, typeof defaut === 'number' ? defaut : null);
  if (champ in MAXIMUM_LIGNES) {
    return lignes(declare, Array.isArray(defaut) ? (defaut as string[]).map(String) : []);
  }
  if (declare.nature === 'heure') return heure(declare, typeof defaut === 'string' ? defaut : null);
  return texte(declare, typeof defaut === 'string' ? defaut : '');
}
