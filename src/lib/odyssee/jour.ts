/**
 * Les règles du jour : la roue d'équilibre, le plancher, et quoi faire maintenant.
 *
 * Module **pur**. Il reçoit ce qui a été lu — faits, tâches, quêtes, événements,
 * cibles — et rend ce que l'écran affiche. Aucun accès à la base, aucune date
 * implicite : `aujourdhui` est toujours passé, sans quoi aucun essai ne pourrait
 * jouer deux jours de suite.
 *
 * ## La règle qui commande tout le reste : vide n'est pas déséquilibré
 *
 * Au premier lancement, la couverture de mesure est de 27 % et la roue est
 * presque vide. Une roue qui afficherait alors cinq branches à zéro dirait à
 * la personne que sa vie est déséquilibrée, alors qu'elle dit seulement que le
 * logiciel ne sait rien. C'est exactement ce que E.3 interdit — « un zéro
 * permanent est un reproche permanent » — et c'est pourquoi chaque branche de
 * la roue porte un état à trois valeurs et non un nombre :
 *
 * | État | Quand | Ce que l'écran en fait |
 * |---|---|---|
 * | `mesure` | Des faits existent sur la fenêtre | La part, et la comparaison à la cible |
 * | `sans-donnee` | Le domaine est actif, mais rien n'a été publié | « Pas de donnée », jamais zéro |
 * | `en-pause` | Le domaine est désactivé | Rien : il ne compte pas dans la roue |
 *
 * ## « Que faire maintenant ? » : des règles, et jamais une IA
 *
 * Chaque suggestion porte **la règle qui l'a produite** et **ce qui l'a
 * déclenchée**. Ce n'est pas de la transparence décorative : une suggestion
 * dont on ne peut pas voir la cause ne se discute pas, et une suggestion qu'on
 * ne peut pas discuter finit par être ignorée en bloc. Les règles sont
 * déclarées dans un tableau que `controlerRegles` vérifie, de sorte qu'une
 * règle ajoutée sans raison affichable casse les essais.
 */
import type { Fait } from '../noyau/faits';
import { DOMAINES, type IdDomaine } from '../noyau/domaines';
import type { Evenement, Quete, Tache } from './modele';
import { chevauchements, dureeDeLEvenement } from './modele';

/* ══════════════════════════════════════════════════════════════════════════
   La roue d'équilibre
   ══════════════════════════════════════════════════════════════════════════ */

export const JOURS_DE_LA_ROUE = 7;

export type EtatDeBranche = 'mesure' | 'sans-donnee' | 'en-pause';

export interface BrancheDeRoue {
  domaine: IdDomaine;
  libelle: string;
  etat: EtatDeBranche;
  /** Secondes attribuées à ce domaine sur la fenêtre. `null` si rien n'est mesuré. */
  secondes: number | null;
  /** Part du total mesuré, entre 0 et 1. `null` si rien n'est mesuré. */
  part: number | null;
  /** La cible que la personne a fixée, entre 0 et 1, ou `null` si elle n'en a pas fixé. */
  cible: number | null;
  /** `part − cible`, ou `null` si l'un des deux manque. */
  ecart: number | null;
}

export interface Roue {
  branches: BrancheDeRoue[];
  /** Secondes mesurées, tous domaines actifs confondus. */
  total: number;
  /**
   * Vrai quand **aucun** domaine actif ne porte de donnée.
   *
   * L'écran s'en sert pour dire qu'il est vide au lieu de dessiner une roue
   * plate. C'est un champ et non une déduction laissée à l'appel, parce que
   * trois écrans devront poser la même question et qu'ils y répondraient
   * chacun un peu autrement.
   */
  vide: boolean;
}

export interface OptionsRoue {
  /** Les domaines allumés. Les autres sont `en-pause`. */
  actifs: readonly IdDomaine[];
  /** Les cibles, par domaine, entre 0 et 1. Un domaine absent n'a pas de cible. */
  cibles?: Readonly<Record<string, number>>;
  /** Les jours logiques de la fenêtre. */
  jours: readonly string[];
}

/**
 * La roue d'équilibre, en secondes attribuées par domaine.
 *
 * **Seuls les faits qui portent une durée comptent.** Une tâche close et une
 * quête tenue n'ont pas de durée : les compter pour une valeur arbitraire
 * — « une tâche vaut dix minutes » — ferait d'un chiffre inventé la moitié de
 * la roue. Ils nourrissent le plancher du jour, qui est fait pour eux.
 */
export function roue(faits: readonly Fait[], options: OptionsRoue): Roue {
  const fenetre = new Set(options.jours);
  const actifs = new Set(options.actifs);
  const cibles = options.cibles ?? {};

  const secondesPar = new Map<IdDomaine, number>();
  for (const fait of faits) {
    if (!fenetre.has(fait.jourLogique)) continue;
    if (!actifs.has(fait.domaine)) continue;
    if (fait.unite !== 'secondes' || typeof fait.valeur !== 'number') continue;
    secondesPar.set(fait.domaine, (secondesPar.get(fait.domaine) ?? 0) + fait.valeur);
  }

  const total = [...secondesPar.values()].reduce((a, b) => a + b, 0);
  const branches: BrancheDeRoue[] = DOMAINES.map((d) => {
    if (!actifs.has(d.id)) {
      return {
        domaine: d.id,
        libelle: d.libelle,
        etat: 'en-pause' as const,
        secondes: null,
        part: null,
        cible: null,
        ecart: null,
      };
    }
    const secondes = secondesPar.get(d.id);
    if (secondes === undefined) {
      /*
         Le domaine est allumé et ne porte rien : « pas de donnée », et surtout
         pas zéro. La cible est quand même rendue — la personne l'a fixée, et
         la masquer donnerait l'impression qu'elle a été perdue — mais l'écart
         reste `null`, parce qu'on ne peut pas s'écarter de sa cible sans
         savoir où l'on est.
      */
      return {
        domaine: d.id,
        libelle: d.libelle,
        etat: 'sans-donnee' as const,
        secondes: null,
        part: null,
        cible: cibles[d.id] ?? null,
        ecart: null,
      };
    }
    const part = total > 0 ? secondes / total : null;
    const cible = cibles[d.id] ?? null;
    return {
      domaine: d.id,
      libelle: d.libelle,
      etat: 'mesure' as const,
      secondes,
      part,
      cible,
      ecart: part !== null && cible !== null ? part - cible : null,
    };
  });

  return { branches, total, vide: branches.every((b) => b.etat !== 'mesure') };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le plancher du jour
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'on s'est engagé à faire aujourd'hui, et où l'on en est.
 *
 * Le plancher est fait des **quêtes quotidiennes actives** : ce sont elles qui
 * portent l'engagement. Les tâches n'en font pas partie — une tâche a une
 * échéance, pas une cadence, et faire du plancher la somme de l'arriéré
 * garantirait de ne jamais l'atteindre.
 *
 * Une quête **hebdomadaire** compte pour le plancher du jour seulement si elle
 * n'a pas encore été tenue cette semaine : la tenir lundi doit libérer les six
 * jours suivants, sinon la cadence « semaine » ne voudrait rien dire.
 */
export interface Plancher {
  /** Les quêtes attendues aujourd'hui, tenues ou non. */
  attendues: { quete: Quete; tenue: boolean }[];
  tenues: number;
  total: number;
  /** Vrai quand tout ce qui était attendu est tenu. `total` à zéro le rend faux. */
  atteint: boolean;
}

export interface OptionsPlancher {
  aujourdhui: string;
  /** Les jours logiques de la semaine en cours, pour les quêtes hebdomadaires. */
  semaine: readonly string[];
  actifs: readonly IdDomaine[];
}

export function plancherDuJour(
  quetes: readonly Quete[],
  options: OptionsPlancher,
): Plancher {
  const actifs = new Set(options.actifs);
  const semaine = new Set(options.semaine);
  const attendues: Plancher['attendues'] = [];

  for (const quete of quetes) {
    if (!quete.active || !actifs.has(quete.domaine)) continue;
    if (quete.cadence === 'jour') {
      attendues.push({ quete, tenue: quete.tenues.includes(options.aujourdhui) });
      continue;
    }
    const tenueCetteSemaine = quete.tenues.some((j) => semaine.has(j));
    // Tenue cette semaine : elle n'est plus attendue, et n'encombre pas le jour.
    if (tenueCetteSemaine) continue;
    attendues.push({ quete, tenue: false });
  }

  const tenues = attendues.filter((a) => a.tenue).length;
  return {
    attendues,
    tenues,
    total: attendues.length,
    atteint: attendues.length > 0 && tenues === attendues.length,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Que faire maintenant ?
   ══════════════════════════════════════════════════════════════════════════ */

export type IdRegle =
  | 'quete-du-jour'
  | 'tache-en-retard'
  | 'tache-du-jour'
  | 'evenement-imminent'
  | 'journee-surchargee'
  | 'agenda-en-conflit'
  | 'domaine-delaisse'
  | 'revue-du-soir';

export interface Regle {
  id: IdRegle;
  /** Ce que la règle cherche, en une phrase affichable. */
  intitule: string;
  /** Pourquoi elle existe. Jamais affiché, toujours lu par qui modifie le code. */
  raison: string;
}

/**
 * Les règles, déclarées une fois.
 *
 * L'ordre est **l'ordre de priorité** : les suggestions sortent dans cet ordre,
 * et c'est délibéré. Ce qui est engagé pour aujourd'hui passe avant ce qui est
 * en retard, parce qu'un arriéré affiché en tête transforme chaque ouverture de
 * l'écran en reproche. Le délaissement d'un domaine vient en dernier : c'est la
 * seule suggestion qui regarde une semaine plutôt qu'une journée.
 */
export const REGLES: readonly Regle[] = [
  {
    id: 'quete-du-jour',
    intitule: 'Une quête du jour n’est pas encore tenue',
    raison: 'Le plancher du jour est ce qu’on s’est engagé à faire ; il passe avant le reste.',
  },
  {
    id: 'evenement-imminent',
    intitule: 'Un événement commence bientôt',
    raison: 'Une chose qui a une heure ne se rattrape pas plus tard dans la journée.',
  },
  {
    id: 'tache-en-retard',
    intitule: 'Une tâche a dépassé son échéance',
    raison: 'Une échéance dépassée est la seule forme d’arriéré qui mérite d’être signalée.',
  },
  {
    id: 'tache-du-jour',
    intitule: 'Une tâche arrive à échéance aujourd’hui',
    raison: 'Signalée le jour même, elle ne devient pas un retard demain.',
  },
  {
    id: 'journee-surchargee',
    intitule: 'La journée est déjà très chargée',
    raison:
      'Proposer d’en faire plus un jour déjà plein est le plus sûr moyen de faire abandonner ' +
      'l’outil. La règle existe pour **retenir** les autres, pas pour ajouter.',
  },
  {
    id: 'agenda-en-conflit',
    intitule: 'Deux événements se chevauchent',
    raison: 'Un conflit d’agenda se règle avant l’heure, jamais pendant.',
  },
  {
    id: 'domaine-delaisse',
    intitule: 'Un domaine actif n’a rien reçu de la semaine',
    raison:
      'C’est le seul regard long de l’écran. Il ne s’applique qu’aux domaines **mesurés** ' +
      'ailleurs : un domaine qui n’a jamais rien reçu n’est pas délaissé, il n’est pas suivi.',
  },
  {
    id: 'revue-du-soir',
    intitule: 'La revue du soir n’est pas faite',
    raison: 'Proposée seulement après l’heure du coucher moins deux heures, jamais le matin.',
  },
];

const PAR_ID = new Map(REGLES.map((r) => [r.id, r]));

export interface Suggestion {
  regle: IdRegle;
  /** Ce que l'écran affiche. */
  texte: string;
  /** Ce qui l'a déclenchée, affiché en dessous : « parce que… ». */
  parceQue: string;
  /** L'objet visé, pour que le bouton mène quelque part. */
  cible?: { quoi: 'tache' | 'quete' | 'evenement' | 'revue'; id: string };
}

/** Seuils de la règle « journée surchargée ». */
export const HEURES_SURCHARGE = 9;
/** Un événement est « imminent » dans ce délai. */
export const MINUTES_IMMINENCE = 45;
/** Plafond de suggestions affichées en même temps. */
export const SUGGESTIONS_AFFICHEES = 4;

export interface OptionsSuggestions {
  /** Instant courant, pour l'imminence et l'heure du coucher. */
  maintenant: Date;
  aujourdhui: string;
  semaine: readonly string[];
  actifs: readonly IdDomaine[];
  /** Heure de coucher déclarée, « HH:MM ». Absente : la revue du soir n'est jamais proposée. */
  coucher?: string;
  /** La revue du soir a-t-elle déjà été tenue aujourd'hui ? */
  revueFaite?: boolean;
}

const heures = (secondes: number) => Math.round((secondes / 3600) * 10) / 10;

/**
 * Les suggestions du moment, dans l'ordre des règles, plafonnées.
 *
 * Le plafond est une décision, pas une commodité d'affichage : une liste de
 * quinze suggestions n'est pas une aide, c'est une liste de reproches. Les
 * suggestions écartées par le plafond ne sont pas perdues — les écrans
 * concernés les montrent, en entier, quand on y va.
 */
export function queFaireMaintenant(
  entrees: {
    quetes: readonly Quete[];
    taches: readonly Tache[];
    evenementsDuJour: readonly Evenement[];
    faits: readonly Fait[];
  },
  options: OptionsSuggestions,
): { suggestions: Suggestion[]; retenues: number; surchargee: boolean } {
  const actifs = new Set(options.actifs);
  const brutes: Suggestion[] = [];

  /* --- La journée est-elle chargée ? Calculé d'abord, pour retenir le reste. */
  const occupation = entrees.evenementsDuJour
    .filter((e) => !e.journeeEntiere)
    .reduce((somme, e) => somme + dureeDeLEvenement(e), 0);
  const surchargee = occupation >= HEURES_SURCHARGE * 3600;

  /* --- Les quêtes du jour ------------------------------------------------- */
  const plancher = plancherDuJour(entrees.quetes, {
    aujourdhui: options.aujourdhui,
    semaine: options.semaine,
    actifs: options.actifs,
  });
  for (const { quete, tenue } of plancher.attendues) {
    if (tenue) continue;
    brutes.push({
      regle: 'quete-du-jour',
      texte: quete.titre,
      parceQue:
        quete.cadence === 'jour'
          ? 'Quête quotidienne, pas encore tenue aujourd’hui.'
          : 'Quête hebdomadaire, pas encore tenue cette semaine.',
      cible: { quoi: 'quete', id: quete.id },
    });
  }

  /* --- Les événements imminents ------------------------------------------- */
  const limite = options.maintenant.getTime() + MINUTES_IMMINENCE * 60 * 1000;
  for (const evenement of entrees.evenementsDuJour) {
    if (evenement.journeeEntiere) continue;
    const debut = Date.parse(evenement.debut);
    if (Number.isNaN(debut) || debut < options.maintenant.getTime() || debut > limite) continue;
    const minutes = Math.max(0, Math.round((debut - options.maintenant.getTime()) / 60000));
    brutes.push({
      regle: 'evenement-imminent',
      texte: evenement.titre,
      parceQue: minutes === 0 ? 'Commence maintenant.' : `Commence dans ${minutes} min.`,
      cible: { quoi: 'evenement', id: evenement.id },
    });
  }

  /* --- Les tâches ---------------------------------------------------------- */
  for (const tache of entrees.taches) {
    if (tache.faiteLe || !tache.echeance || !actifs.has(tache.domaine)) continue;
    if (tache.echeance < options.aujourdhui) {
      brutes.push({
        regle: 'tache-en-retard',
        texte: tache.titre,
        parceQue: `Échéance passée : ${tache.echeance}.`,
        cible: { quoi: 'tache', id: tache.id },
      });
    } else if (tache.echeance === options.aujourdhui) {
      brutes.push({
        regle: 'tache-du-jour',
        texte: tache.titre,
        parceQue: 'Échéance aujourd’hui.',
        cible: { quoi: 'tache', id: tache.id },
      });
    }
  }

  /* --- La surcharge, qui est un avertissement et non une tâche ------------- */
  if (surchargee) {
    brutes.push({
      regle: 'journee-surchargee',
      texte: 'Journée déjà très chargée',
      parceQue: `${heures(occupation)} h d’agenda aujourd’hui.`,
    });
  }

  /* --- Les conflits d'agenda ----------------------------------------------- */
  for (const [a, b] of chevauchements(entrees.evenementsDuJour)) {
    brutes.push({
      regle: 'agenda-en-conflit',
      texte: `${a.titre} et ${b.titre} se chevauchent`,
      parceQue: 'Deux événements occupent le même créneau.',
      cible: { quoi: 'evenement', id: a.id },
    });
  }

  /* --- Les domaines délaissés ----------------------------------------------
     « Délaissé » suppose « suivi ». Un domaine qui n'a jamais rien reçu n'est
     pas délaissé : il n'est pas mesuré, et le signaler reviendrait à reprocher
     à la personne de ne pas saisir — exactement ce que E.6 refuse.
  */
  const semaine = new Set(options.semaine);
  const vusCetteSemaine = new Set<IdDomaine>();
  const vusUnJour = new Set<IdDomaine>();
  for (const fait of entrees.faits) {
    vusUnJour.add(fait.domaine);
    if (semaine.has(fait.jourLogique)) vusCetteSemaine.add(fait.domaine);
  }
  for (const d of DOMAINES) {
    if (!actifs.has(d.id)) continue;
    if (vusCetteSemaine.has(d.id) || !vusUnJour.has(d.id)) continue;
    brutes.push({
      regle: 'domaine-delaisse',
      texte: d.libelle,
      parceQue: 'Rien dans ce domaine depuis le début de la semaine.',
    });
  }

  /* --- La revue du soir ----------------------------------------------------- */
  if (options.coucher && !options.revueFaite) {
    const [h, m] = options.coucher.split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const minutesCourantes =
        options.maintenant.getHours() * 60 + options.maintenant.getMinutes();
      /*
         Deux heures avant le coucher, et pas avant : proposer une revue du
         soir à neuf heures du matin n'a aucun sens, et la proposer après
         l'heure du coucher revient à retenir quelqu'un qui allait dormir.
      */
      const ouverture = h * 60 + m - 120;
      if (minutesCourantes >= ouverture && minutesCourantes < h * 60 + m) {
        brutes.push({
          regle: 'revue-du-soir',
          texte: 'La revue du soir',
          parceQue: 'Moins de deux heures avant votre heure de coucher.',
          cible: { quoi: 'revue', id: options.aujourdhui },
        });
      }
    }
  }

  /* --- Tri par priorité de règle, puis plafond -----------------------------
     Une journée surchargée **retient** les suggestions qui ajoutent du travail :
     les tâches et les domaines délaissés disparaissent, les engagements du jour
     et les conflits restent. C'est la seule règle qui en désactive d'autres, et
     c'est sa raison d'être.
  */
  const rangs = new Map(REGLES.map((r, i) => [r.id, i]));
  const ajoutentDuTravail: IdRegle[] = ['tache-en-retard', 'tache-du-jour', 'domaine-delaisse'];
  const gardees = surchargee ? brutes.filter((s) => !ajoutentDuTravail.includes(s.regle)) : brutes;
  gardees.sort((a, b) => (rangs.get(a.regle) ?? 99) - (rangs.get(b.regle) ?? 99));

  return {
    suggestions: gardees.slice(0, SUGGESTIONS_AFFICHEES),
    retenues: brutes.length - gardees.length,
    surchargee,
  };
}

/** Le libellé d'une règle, pour l'écran qui explique une suggestion. */
export const regle = (id: IdRegle): Regle | undefined => PAR_ID.get(id);

/**
 * Le catalogue de règles se tient-il ?
 *
 * Une règle sans intitulé ne peut pas s'afficher, une règle sans raison ne peut
 * pas se discuter, et un identifiant en double ferait taire silencieusement
 * l'une des deux.
 */
export function controlerRegles(): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();
  for (const r of REGLES) {
    if (vus.has(r.id)) problemes.push(`La règle « ${r.id} » est déclarée deux fois.`);
    vus.add(r.id);
    if (!r.intitule.trim()) problemes.push(`La règle « ${r.id} » n’a pas d’intitulé.`);
    if (r.raison.trim().length < 30) {
      problemes.push(`La règle « ${r.id} » n’explique pas pourquoi elle existe.`);
    }
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   La couverture de mesure
   ══════════════════════════════════════════════════════════════════════════ */

export interface Couverture {
  /** Domaines actifs qui portent au moins un fait sur la fenêtre. */
  mesures: IdDomaine[];
  /** Domaines actifs qui n'en portent aucun. */
  sansDonnee: IdDomaine[];
  /** Part des domaines actifs qui sont mesurés, entre 0 et 1. `null` si aucun n'est actif. */
  part: number | null;
}

/**
 * Combien des domaines allumés portent réellement quelque chose.
 *
 * Distinct de `tr.couverture-mesure` du catalogue, qui compte les
 * **indicateurs** calculables : celui-ci compte les **domaines** renseignés, ce
 * qui est la question que pose la roue. Les deux peuvent diverger — un domaine
 * peut porter des faits sans qu'aucun indicateur du catalogue ne les exploite
 * encore — et c'est pourquoi ils ne sont pas le même nombre.
 */
export function couverture(
  faits: readonly Fait[],
  actifs: readonly IdDomaine[],
  jours: readonly string[],
): Couverture {
  const fenetre = new Set(jours);
  const vus = new Set<IdDomaine>();
  for (const fait of faits) {
    if (fenetre.has(fait.jourLogique)) vus.add(fait.domaine);
  }
  const mesures = actifs.filter((d) => vus.has(d));
  const sansDonnee = actifs.filter((d) => !vus.has(d));
  return {
    mesures,
    sansDonnee,
    part: actifs.length ? mesures.length / actifs.length : null,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les fenêtres de jours
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les `n` derniers jours logiques, `aujourdhui` compris, du plus ancien au plus
 * récent.
 *
 * Construits par arithmétique sur `Date` en UTC : un jour logique est une
 * étiquette `AAAA-MM-JJ`, et lui appliquer un fuseau en ferait sauter un deux
 * fois par an, au changement d'heure.
 */
export function derniersJours(aujourdhui: string, n: number): string[] {
  const jours: string[] = [];
  const depart = new Date(`${aujourdhui}T00:00:00.000Z`);
  for (let i = n - 1; i >= 0; i -= 1) {
    const jour = new Date(depart.getTime() - i * 24 * 3600 * 1000);
    jours.push(jour.toISOString().slice(0, 10));
  }
  return jours;
}

/**
 * Les jours de la semaine en cours, du lundi au jour donné.
 *
 * Du **lundi**, parce que c'est la semaine française, et jusqu'à aujourd'hui
 * seulement : une quête hebdomadaire ne peut pas avoir été tenue demain, et
 * inclure la fin de la semaine ferait compter des jours qui n'ont pas eu lieu.
 */
export function semaineCourante(aujourdhui: string): string[] {
  const jour = new Date(`${aujourdhui}T00:00:00.000Z`);
  // getUTCDay : 0 = dimanche. Le lundi est donc à (jour + 6) % 7 jours en arrière.
  const recul = (jour.getUTCDay() + 6) % 7;
  const jours: string[] = [];
  for (let i = recul; i >= 0; i -= 1) {
    jours.push(new Date(jour.getTime() - i * 24 * 3600 * 1000).toISOString().slice(0, 10));
  }
  return jours;
}
