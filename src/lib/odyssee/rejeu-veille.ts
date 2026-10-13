/**
 * Le rejeu, et le recalcul identique sur deux appareils — phase 4.
 *
 * Deux questions distinctes, et un seul module, parce qu'elles se répondent
 * l'une l'autre : pour savoir si deux appareils disent la même chose, il faut
 * les faire dérouler la même histoire, et c'est exactement ce que le rejeu
 * fait déjà.
 *
 * ## Pourquoi un rejeu
 *
 * `mesures.md` se termine sur un aveu : la mesure sur vies synthétiques dit à
 * quelle fréquence quelqu'un dont rien ne va mal serait dérangé, et rien de
 * plus. Savoir si une dégradation de quatre planchers ou de six ressemble à
 * ce qui arrive dans une vraie vie demanderait une vérité terrain qui
 * n'existe pas. Le rejeu sur l'historique réel est le seul moyen
 * d'évaluation disponible : il ne donne pas de taux, il donne **ce que la
 * veille aurait dit**, jour par jour, sur les données de la personne.
 *
 * Il n'écrit rien, ne lève aucun repère, ne déclenche aucune notification et
 * ne touche pas aux réglages. C'est une lecture, et il faut que cela se voie
 * dans la signature : il ne reçoit que des mesures, et rend un résultat.
 *
 * ## Pourquoi le recalcul identique est une question, et pas une évidence
 *
 * La veille ne se synchronise pas : ses trois magasins — repères, réglages,
 * bases — ne sont pas journalisés, et chaque appareil calcule chez lui. Deux
 * appareils tiennent donc deux veilles, et la seule chose qui les rapproche
 * est que leurs **sources** voyagent, elles. Si le calcul est déterministe,
 * deux appareils synchronisés doivent arriver au même verdict. Sinon la
 * personne verrait une carte sur son téléphone et pas sur son ordinateur,
 * sans que rien ne permette de dire lequel des deux a raison.
 *
 * Une source ne voyage pas, et c'est délibéré : **le journal d'usage**. Un
 * appareil écrit une session chaque fois qu'on l'ouvre ; si ces sessions
 * voyageaient, les ouvrir pour comparer suffirait à créer l'écart qu'on vient
 * constater. Le domaine `rythme` en est entièrement dérivé — ses cinq
 * indicateurs, sans exception — et deux appareils ne peuvent donc pas s'y
 * accorder. Ce n'est pas un défaut à corriger, c'est une conséquence à
 * **dire** : l'empreinte de comparaison est calculée hors journal d'usage,
 * et ce qui en est écarté est nommé.
 *
 * ## Ce que l'empreinte compare, et ce qu'elle ne compare pas
 *
 * Celle du noyau (`noyau/empreinte.ts`) porte sur les journaux, c'est-à-dire
 * sur les faits, et surtout **pas** sur l'état dérivé — parce que l'état
 * dérivé se recalcule et afficherait « différents » une seconde à chaque
 * fusion. Celle-ci fait exactement l'inverse : elle porte sur le dérivé, et
 * c'est tout son objet. Les deux ne se remplacent pas. Deux appareils dont
 * les journaux sont identiques et dont les rejeux divergent ont un vrai
 * problème, et c'est précisément ce qu'on veut pouvoir constater.
 */
import { empreinteLisible, memeEmpreinte } from '../noyau/empreinte';
import { DEPUIS_LE_JOURNAL_DUSAGE } from './mesures-veille';
import {
  CATALOGUE,
  DOMAINES,
  type DomaineVeille,
  type Indicateur,
  type Mesure,
} from './veille';
import {
  REGLAGES,
  SENSIBILITE_PAR_DEFAUT,
  type Contexte,
  type Sensibilite,
} from './moteur-veille';
import {
  REGLAGES_PAR_DEFAUT,
  repondre,
  tourDeVeille,
  type EtatVeille,
  type Reponse,
} from './signal-veille';

const ajouterJours = (jour: string, n: number) =>
  new Date(Date.parse(`${jour}T12:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);

const joursEntre = (debut: string, fin: string) =>
  Math.round((Date.parse(`${fin}T12:00:00.000Z`) - Date.parse(`${debut}T12:00:00.000Z`)) / 86_400_000);

/* ══════════════════════════════════════════════════════════════════════════
   Le rejeu
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les jours écartés en tête de rejeu.
 *
 * La veille exige vingt-huit jours de base ; en deçà elle répond « données
 * insuffisantes », ce qui est le bon comportement mais ne dit rien. Les
 * compter comme des jours observés ferait croire à un dispositif plus discret
 * qu'il n'est. On part donc une période de référence complète après le
 * premier jour de données, plus la fenêtre la plus longue.
 */
export const ECHAUFFEMENT = 84;

export interface EntreeDeRejeu {
  mesures: Readonly<Record<string, readonly Mesure[]>>;
  /** À défaut, le premier et le dernier jour trouvés dans les mesures. */
  debut?: string;
  fin?: string;
  sensibilite?: Sensibilite;
  contextes?: readonly Contexte[];
  catalogue?: readonly Indicateur[];
  /**
   * Ce que la personne est supposée avoir répondu à chaque repère.
   *
   * Il en faut une, et le choix pèse : le silence qui suit « Pas pertinent »
   * dure quatre fois celui de « Je l'ai vu », donc masque quatre fois plus.
   * « Je l'ai vu » est l'hypothèse la moins flatteuse pour le dispositif,
   * c'est-à-dire la bonne par défaut.
   */
  reponse?: Reponse;
  echauffement?: number;
}

export interface RepereRejoue {
  id: string;
  jour: string;
  depuis: string;
  domaines: readonly DomaineVeille[];
  indicateurs: readonly string[];
}

export interface Rejeu {
  sensibilite: Sensibilite;
  debut: string;
  fin: string;
  /** Jours réellement parcourus, échauffement déduit. */
  jours: number;
  /** Jours où la veille a pu se prononcer. */
  evalues: number;
  /** Jours où elle a répondu « données insuffisantes ». */
  insuffisants: number;
  reperes: readonly RepereRejoue[];
  /** Combien de repères chaque domaine a contribué à lever. */
  parDomaine: Readonly<Partial<Record<DomaineVeille, number>>>;
  /** La cadence ramenée à l'année, pour être comparable aux vies synthétiques. */
  parAn: number | null;
}

const bornesDesMesures = (
  mesures: Readonly<Record<string, readonly Mesure[]>>,
): [string, string] | null => {
  const jours = Object.values(mesures).flatMap((serie) => serie.map((m) => m.jour));
  if (!jours.length) return null;
  const tries = [...jours].sort();
  return [tries[0], tries[tries.length - 1]];
};

/**
 * Déroule l'historique jour par jour, exactement comme la veille l'aurait vécu.
 *
 * **Séquentiel**, et ce n'est pas une commodité : la base figée, le silence
 * après réponse et la règle du repère unique dépendent tous de l'état laissé
 * par la veille. Évaluer chaque jour indépendamment donnerait un autre
 * chiffre, plus grand, et qui ne correspondrait à l'expérience de personne.
 *
 * Le tour employé est `tourDeVeille`, celui de la vraie veille, et non une
 * copie : une copie aurait dérivé au premier changement de cadence, et le
 * rejeu aurait montré une veille qui n'existe pas.
 */
export function rejouer(entree: EntreeDeRejeu): Rejeu {
  const sensibilite = entree.sensibilite ?? SENSIBILITE_PAR_DEFAUT;
  const bornes = bornesDesMesures(entree.mesures);
  const debut = entree.debut ?? bornes?.[0] ?? '';
  const fin = entree.fin ?? bornes?.[1] ?? '';
  const vide: Rejeu = {
    sensibilite,
    debut,
    fin,
    jours: 0,
    evalues: 0,
    insuffisants: 0,
    reperes: [],
    parDomaine: {},
    parAn: null,
  };
  if (!debut || !fin || fin < debut) return vide;

  const echauffement = entree.echauffement ?? ECHAUFFEMENT;
  const premier = ajouterJours(debut, echauffement);
  if (premier > fin) return vide;

  let etat: EtatVeille = {
    reglages: { ...REGLAGES_PAR_DEFAUT, active: true, sensibilite, majLe: debut },
    ouvert: null,
    dernierClos: null,
  };
  const reponse: Reponse = entree.reponse ?? 'vu';
  const reperes: RepereRejoue[] = [];
  const parDomaine: Partial<Record<DomaineVeille, number>> = {};
  let evalues = 0;
  let insuffisants = 0;

  for (let jour = premier; jour <= fin; jour = ajouterJours(jour, 1)) {
    const tour = tourDeVeille({
      jour,
      etat,
      mesures: entree.mesures,
      ...(entree.contextes ? { contextes: entree.contextes } : {}),
      ...(entree.catalogue ? { catalogue: entree.catalogue } : {}),
    });

    if (tour.verdict?.quoi === 'donnees-insuffisantes') insuffisants += 1;
    else if (tour.verdict) evalues += 1;

    if (tour.leve) {
      reperes.push({
        id: tour.leve.id,
        jour: tour.leve.jour,
        depuis: tour.leve.depuis,
        domaines: tour.leve.domaines,
        indicateurs: tour.leve.indicateurs,
      });
      for (const d of tour.leve.domaines) parDomaine[d] = (parDomaine[d] ?? 0) + 1;
      etat = { reglages: tour.reglages, ouvert: null, dernierClos: repondre(tour.leve, reponse, jour) };
    } else if (tour.decision.quoi === 'montrer') {
      // Un repère resté ouvert d'un tour précédent : la personne y répond.
      etat = {
        reglages: tour.reglages,
        ouvert: null,
        dernierClos: repondre(tour.decision.signal, reponse, jour),
      };
    } else {
      etat = { ...etat, reglages: tour.reglages };
    }
  }

  const jours = joursEntre(premier, fin) + 1;
  return {
    sensibilite,
    debut: premier,
    fin,
    jours,
    evalues,
    insuffisants,
    reperes,
    parDomaine,
    parAn: jours > 0 ? (reperes.length * 365) / jours : null,
  };
}

/** Les trois sensibilités sur le même historique, pour les comparer. */
export const rejouerLesTrois = (entree: Omit<EntreeDeRejeu, 'sensibilite'>): Rejeu[] =>
  (['discrete', 'standard', 'attentive'] as Sensibilite[]).map((sensibilite) =>
    rejouer({ ...entree, sensibilite }),
  );

/* ══════════════════════════════════════════════════════════════════════════
   Ce que deux appareils peuvent comparer
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les mesures dont deux appareils synchronisés disposent **tous les deux**.
 *
 * C'est-à-dire tout sauf ce que le journal d'usage alimente. Le retrait est
 * explicite plutôt que silencieux : la fonction rend aussi ce qu'elle a
 * écarté, pour que l'écran puisse le nommer au lieu de présenter une
 * empreinte dont nul ne saurait sur quoi elle porte.
 */
export function partageable(mesures: Readonly<Record<string, readonly Mesure[]>>): {
  mesures: Record<string, readonly Mesure[]>;
  ecartes: readonly string[];
} {
  const retenues: Record<string, readonly Mesure[]> = {};
  const ecartes: string[] = [];
  for (const id of Object.keys(mesures).sort()) {
    if (DEPUIS_LE_JOURNAL_DUSAGE.includes(id)) ecartes.push(id);
    else retenues[id] = mesures[id];
  }
  return { mesures: retenues, ecartes };
}

/**
 * Le texte canonique d'un rejeu : ce qui doit être identique, et rien d'autre.
 *
 * Les clés sont écrites dans un ordre fixe et les indicateurs sont triés.
 * Rien de tout cela n'est cosmétique : `JSON.stringify` suit l'ordre
 * d'insertion des clés, qui suit l'histoire de l'objet et non son contenu, et
 * l'ordre des déviations suit leur force — donc leur départage en cas
 * d'égalité. Deux appareils d'accord sur tout afficheraient deux empreintes
 * différentes.
 */
export function texteCanonique(rejeu: Rejeu): string {
  const lignes = rejeu.reperes.map((r) =>
    [r.jour, r.depuis, [...r.domaines].sort().join('+'), [...r.indicateurs].sort().join(',')].join('|'),
  );
  return [
    'veille:1',
    rejeu.sensibilite,
    rejeu.debut,
    rejeu.fin,
    String(rejeu.reperes.length),
    ...lignes,
  ].join('\n');
}

async function condense(texte: string): Promise<string> {
  const octets = new TextEncoder().encode(texte);
  const brut = await crypto.subtle.digest('SHA-256', octets);
  return Array.from(new Uint8Array(brut))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * L'empreinte à comparer de visu entre deux appareils.
 *
 * Seize signes en quatre groupes, comme celle des journaux : l'œil sait déjà
 * faire ce geste sur l'écran des appareils, et lui en demander un autre
 * n'apporterait rien.
 */
export async function empreinteDuRejeu(rejeu: Rejeu): Promise<string> {
  return condense(texteCanonique(rejeu));
}

export { empreinteLisible, memeEmpreinte };

export interface Divergence {
  jour: string;
  quoi: string;
}

/** Ce qui sépare deux rejeux, jour par jour. Sans interprétation. */
export function comparerLesRejeux(a: Rejeu, b: Rejeu): {
  identiques: boolean;
  divergences: readonly Divergence[];
} {
  const divergences: Divergence[] = [];

  if (a.sensibilite !== b.sensibilite) {
    divergences.push({
      jour: a.debut,
      quoi: `sensibilités différentes : ${a.sensibilite} et ${b.sensibilite}`,
    });
  }

  const parJour = (r: Rejeu) => new Map(r.reperes.map((x) => [x.jour, x]));
  const ga = parJour(a);
  const gb = parJour(b);
  for (const jour of [...new Set([...ga.keys(), ...gb.keys()])].sort()) {
    const x = ga.get(jour);
    const y = gb.get(jour);
    if (x && !y) {
      divergences.push({ jour, quoi: `un repère ici, aucun là (${x.indicateurs.join(', ')})` });
      continue;
    }
    if (y && !x) {
      divergences.push({ jour, quoi: `aucun repère ici, un là (${y.indicateurs.join(', ')})` });
      continue;
    }
    if (!x || !y) continue;
    const ia = [...x.indicateurs].sort();
    const ib = [...y.indicateurs].sort();
    if (ia.join(',') !== ib.join(',')) {
      const seulement = [
        ...ia.filter((i) => !ib.includes(i)),
        ...ib.filter((i) => !ia.includes(i)),
      ];
      divergences.push({
        jour,
        quoi: `le même repère, sur des indicateurs différents (${seulement.join(', ')})`,
      });
    }
  }

  return { identiques: divergences.length === 0, divergences };
}

export interface ComparaisonDAppareils {
  /** Sur la part qui voyage. Toute divergence ici est un défaut. */
  defauts: readonly Divergence[];
  /** Ce que le journal d'usage ajoute, et qui ne prouve rien. */
  imputablesAuJournalDUsage: readonly Divergence[];
  /** Les indicateurs écartés de la comparaison, nommés. */
  ecartes: readonly string[];
  /** Les deux empreintes à afficher, calculées sur la part partageable. */
  empreintes: readonly [string, string];
  identiques: boolean;
}

/**
 * Deux appareils, et la seule façon honnête de les comparer.
 *
 * La première version de ce module classait chaque divergence « attendue » ou
 * non selon que les indicateurs en cause venaient du journal d'usage. Le
 * classement était presque toujours faux dans le sens dangereux : un repère
 * exige trois domaines, donc sa liste d'indicateurs en contient d'autres que
 * ceux du rythme, donc une divergence réellement causée par le journal
 * d'usage se présentait comme un défaut — et, à force, on aurait cessé de
 * regarder.
 *
 * La bonne méthode ne demande aucun jugement : on **rejoue deux fois**. Sur
 * la part qui voyage, où les deux appareils tiennent exactement les mêmes
 * données, toute divergence est un défaut, sans exception et sans
 * interprétation. Sur la totalité, ce qui apparaît en plus est le prix du
 * journal d'usage, et ce prix se constate au lieu de se déduire.
 */
export function comparerLesAppareils(
  a: Readonly<Record<string, readonly Mesure[]>>,
  b: Readonly<Record<string, readonly Mesure[]>>,
  options: Omit<EntreeDeRejeu, 'mesures'> = {},
): Promise<ComparaisonDAppareils> {
  const partA = partageable(a);
  const partB = partageable(b);
  const surLaPart = comparerLesRejeux(
    rejouer({ ...options, mesures: partA.mesures }),
    rejouer({ ...options, mesures: partB.mesures }),
  );
  const surTout = comparerLesRejeux(
    rejouer({ ...options, mesures: a }),
    rejouer({ ...options, mesures: b }),
  );
  const dejaVues = new Set(surLaPart.divergences.map((d) => `${d.jour}|${d.quoi}`));
  const enPlus = surTout.divergences.filter((d) => !dejaVues.has(`${d.jour}|${d.quoi}`));

  return (async () => ({
    defauts: surLaPart.divergences,
    imputablesAuJournalDUsage: enPlus,
    ecartes: [...new Set([...partA.ecartes, ...partB.ecartes])].sort(),
    empreintes: [
      await empreinteDuRejeu(rejouer({ ...options, mesures: partA.mesures })),
      await empreinteDuRejeu(rejouer({ ...options, mesures: partB.mesures })),
    ] as [string, string],
    identiques: surLaPart.identiques,
  }))();
}

/* ══════════════════════════════════════════════════════════════════════════
   La mise en mots
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce que le rejeu a donné, en une phrase, sans jamais présenter un chiffre
 * comme un taux.
 *
 * « Deux repères sur trois ans » est une observation ; « 0,67 repère par an »
 * a l'allure d'une fréquence établie, sur un échantillon de un. La cadence
 * annualisée existe dans les données pour qui veut comparer les trois
 * sensibilités, elle ne se dit pas ici.
 */
export function phraseDuRejeu(rejeu: Rejeu): string {
  if (!rejeu.jours) {
    return 'Il n’y a pas encore assez d’historique pour rejouer quoi que ce soit.';
  }
  const duree =
    rejeu.jours >= 365
      ? `${Math.round(rejeu.jours / 365.25)} an(s)`
      : `${Math.round(rejeu.jours / 30.44)} mois`;
  const nom = REGLAGES[rejeu.sensibilite].libelle.toLowerCase();
  if (!rejeu.reperes.length) {
    return (
      `Sur ${duree} d’historique, en sensibilité ${nom}, la veille n’aurait rien signalé. ` +
      'Cela ne veut pas dire que rien ne s’est passé pendant cette période.'
    );
  }
  const n = rejeu.reperes.length;
  return (
    `Sur ${duree} d’historique, en sensibilité ${nom}, la veille aurait levé ` +
    `${n} repère${n > 1 ? 's' : ''} : ${rejeu.reperes.map((r) => r.jour).join(', ')}.`
  );
}

/** Les domaines qui ont porté les repères, du plus fréquent au moins. */
export function domainesDuRejeu(rejeu: Rejeu): { domaine: DomaineVeille; libelle: string; n: number }[] {
  return Object.entries(rejeu.parDomaine)
    .map(([domaine, n]) => ({
      domaine: domaine as DomaineVeille,
      libelle: DOMAINES[domaine as DomaineVeille].libelle,
      n: n ?? 0,
    }))
    .sort((a, b) => b.n - a.n || a.domaine.localeCompare(b.domaine));
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerLeRejeu(catalogue: readonly Indicateur[] = CATALOGUE): string[] {
  const problemes: string[] = [];

  const connus = new Set(catalogue.map((i) => i.id));
  for (const id of DEPUIS_LE_JOURNAL_DUSAGE) {
    if (!connus.has(id)) {
      problemes.push(`« ${id} » est donné pour venir du journal d’usage, mais n’est pas au catalogue.`);
    }
  }

  /*
     Le domaine `rythme` est entièrement dérivé du journal d'usage, et c'est
     ce qui rend la comparaison entre deux appareils partielle. Si un jour un
     indicateur de `rythme` venait d'ailleurs, l'écran continuerait à dire que
     tout le domaine est hors comparaison, ce qui serait faux dans le sens
     fâcheux : il écarterait de la comparaison quelque chose qui devait y être.
  */
  const rythme = catalogue.filter((i) => i.domaine === 'rythme').map((i) => i.id);
  const horsUsage = rythme.filter((id) => !DEPUIS_LE_JOURNAL_DUSAGE.includes(id));
  if (horsUsage.length) {
    problemes.push(
      `Le domaine « rythme » ne vient plus entièrement du journal d’usage (${horsUsage.join(', ')}). ` +
        'La comparaison entre deux appareils en écarte pourtant tout le domaine : elle écarte ' +
        'désormais des indicateurs qui pourraient être comparés.',
    );
  }

  if (ECHAUFFEMENT < 28) {
    problemes.push(
      'L’échauffement du rejeu est plus court que la base minimale : les premiers jours ' +
        'rejoués diraient « données insuffisantes » et seraient comptés comme observés.',
    );
  }

  return problemes;
}
