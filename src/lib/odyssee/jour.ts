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
import type { Evenement, MotifNonFait, Quete, Tache } from './modele';
import { MOTIFS, libelleDuMotif } from './modele';
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
  | 'releve-a-faire'
  | 'revue'
  | 'revue-manquee';

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
    id: 'releve-a-faire',
    intitule: 'Un moment prévu est passé, et vous n’avez pas dit s’il a eu lieu',
    raison:
      'Un agenda dit ce qui était prévu. Sans relevé, le site devrait supposer, et un taux de ' +
      'réalisation supposé ne vaut rien. La question se pose une fois, après coup, jamais avant.',
  },
  {
    id: 'revue-manquee',
    intitule: 'Des revues passées n’ont pas été tenues',
    raison:
      'Un SEUL rappel groupé, sur sept jours au plus. Une notification par jour ' +
      'manqué transformerait une semaine chargée en liste de reproches, et au-delà ' +
      'de sept jours un rappel n’en est plus un : c’est une accusation.',
  },
  {
    id: 'revue',
    intitule: 'La revue n’est pas faite',
    raison:
      'Proposée dans sa fenêtre : le matin depuis le lever et jusqu’à midi, ' +
      'le soir dans les deux heures avant le coucher. Les replis — 6 h et 20 h — ' +
      'vivent dans la règle, jamais dans le profil.',
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
  cible?: { quoi: 'tache' | 'quete' | 'evenement' | 'revue' | 'releve'; id: string };
}

/**
 * Les heures par défaut, et pourquoi elles vivent ICI.
 *
 * Écrire 20 h dans le champ `coucher` du profil reviendrait à faire dire à la
 * personne une heure qu'elle n'a jamais déclarée. Toute la branche distingue
 * le déclaré du déduit ; un repli est une règle de produit, et sa place est
 * dans la règle.
 *
 * Et ce repli répare un défaut constaté le 14 octobre : **sans heure de
 * coucher déclarée, la revue n'était jamais proposée**. Elle disparaissait
 * sans rien dire, ce qui est la pire façon de ne pas marcher.
 */
export const LEVER_PAR_DEFAUT = '06:00';
export const COUCHER_PAR_DEFAUT = '20:00';

/** Minutes depuis minuit, ou `null` si l'heure n'est pas une heure. */
function enMinutes(heure: string | undefined, repli: string): number | null {
  const [h, m] = (heure && /^\d{2}:\d{2}$/.test(heure) ? heure : repli).split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * Quand la revue est proposée, selon le moment choisi.
 *
 * *Le soir* : les deux heures qui précèdent le coucher, et pas avant —
 * proposer une revue du soir à neuf heures du matin n'a aucun sens, et la
 * proposer après l'heure du coucher revient à retenir quelqu'un qui allait
 * dormir.
 *
 * *Le matin* : à partir du lever, et jusqu'à midi. La borne haute n'est pas
 * décorative : une « revue du matin » proposée à dix-sept heures porterait
 * sur la veille sans que rien ne le laisse deviner.
 */
export function fenetreDeLaRevue(
  moment: 'matin' | 'soir',
  lever: string | undefined,
  coucher: string | undefined,
): { de: number; a: number; parceQue: string } | null {
  if (moment === 'matin') {
    const debut = enMinutes(lever, LEVER_PAR_DEFAUT);
    if (debut === null) return null;
    return {
      de: debut,
      a: 12 * 60,
      parceQue: lever
        ? 'Depuis votre heure de lever, et jusqu’à midi.'
        : `Depuis ${LEVER_PAR_DEFAUT.replace(':', ' h ')}, faute d’heure de lever déclarée.`,
    };
  }
  const fin = enMinutes(coucher, COUCHER_PAR_DEFAUT);
  if (fin === null) return null;
  return {
    de: fin - 120,
    a: fin,
    parceQue: coucher
      ? 'Moins de deux heures avant votre heure de coucher.'
      : `Moins de deux heures avant ${COUCHER_PAR_DEFAUT.replace(':', ' h ')}, faute d’heure de coucher déclarée.`,
  };
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
  /**
   * Heure de coucher déclarée, « HH:MM ».
   *
   * Absente, la revue **est tout de même proposée** depuis le 15 octobre :
   * un repli vit dans la règle. Avant, elle disparaissait sans rien dire.
   */
  coucher?: string;
  /** Heure de lever déclarée, « HH:MM ». Même repli en son absence. */
  lever?: string;
  /** Le moment choisi pour la revue. Sans préférence : le soir. */
  moment?: 'matin' | 'soir';
  /** La revue du jour visé a-t-elle déjà été tenue ? */
  revueFaite?: boolean;
  /**
   * Le rappel groupé des revues manquées, déjà rédigé, ou rien.
   *
   * Rédigé en amont plutôt que calculé ici : cette fonction ne lit aucune
   * base, et c'est ce qui la rend éprouvable sans navigateur.
   */
  rappelDeRevue?: string | null;
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

  /* --- Les relevés en attente ----------------------------------------------
     Un événement passé dont on n'a pas dit s'il a eu lieu. La question se pose
     **après** l'heure de fin, jamais avant : demander à 9 h si la réunion de
     14 h a eu lieu n'a pas de sens, et demander pendant qu'elle a lieu non
     plus.

     Les relevés ne sont pas retenus par la surcharge, et c'est voulu :
     répondre « pas fait » est le geste le plus utile d'une journée trop
     pleine, et c'est précisément le jour où il faut le proposer.
  */
  for (const evenement of entrees.evenementsDuJour) {
    if (evenement.realise !== 'inconnu') continue;
    if (evenement.journeeEntiere) continue;
    if (Date.parse(evenement.fin) > options.maintenant.getTime()) continue;
    brutes.push({
      regle: 'releve-a-faire',
      texte: evenement.titre,
      parceQue: 'Était prévu, et vous n’avez pas encore dit si cela a eu lieu.',
      cible: { quoi: 'releve', id: evenement.id },
    });
  }

  /* --- La revue ------------------------------------------------------------- */
  if (!options.revueFaite) {
    const minutesCourantes = options.maintenant.getHours() * 60 + options.maintenant.getMinutes();
    const fenetre = fenetreDeLaRevue(options.moment ?? 'soir', options.lever, options.coucher);
    if (fenetre && minutesCourantes >= fenetre.de && minutesCourantes < fenetre.a) {
      brutes.push({
        regle: 'revue',
        texte: 'La revue',
        parceQue: fenetre.parceQue,
        cible: { quoi: 'revue', id: options.aujourdhui },
      });
    }
  }

  /* --- Les revues manquées, en UN rappel ------------------------------------ */
  if (options.rappelDeRevue) {
    brutes.push({
      regle: 'revue-manquee',
      texte: options.rappelDeRevue,
      parceQue: 'Vous pouvez y revenir, chacune à sa date.',
      cible: { quoi: 'revue', id: options.aujourdhui },
    });
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

/* ══════════════════════════════════════════════════════════════════════════
   Le plan tenu : ce qui était prévu a-t-il été fait ?
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'un élément du plan vaut, du point de vue du suivi.
 *
 * `partiel` vaut une demie, et ce n'est pas un arbitraire déguisé : c'est la
 * seule valeur qui ne force pas à mentir. La compter pour 1 effacerait la
 * différence entre une séance tenue et une séance rognée ; la compter pour 0
 * la rendrait équivalente à un abandon. Le chiffre est déclaré ici, une fois,
 * et affiché avec le taux pour qu'il puisse être discuté.
 */
export const POIDS_PARTIEL = 0.5;

export interface PlanTenu {
  /** Éléments prévus sur la fenêtre et déjà échus — ceux à venir n'y sont pas. */
  prevus: number;
  faits: number;
  partiels: number;
  nonFaits: number;
  /** Prévu, échu, et sans réponse. Compté à part : « je ne sais pas » n'est pas « pas fait ». */
  nonReleves: number;
  /**
   * Le taux, entre 0 et 1, **sur ce qui a été relevé seulement**.
   *
   * `null` quand rien n'a été relevé : un taux calculé sur zéro réponse serait
   * un chiffre sans contenu, et le genre de chiffre qu'on finit par citer.
   */
  taux: number | null;
  /** Combien de fois chaque motif a été donné, du plus fréquent au moins. */
  motifs: { motif: MotifNonFait; libelle: string; combien: number }[];
  /**
   * Le motif dominant, s'il y en a un.
   *
   * `null` tant que les motifs donnés n'atteignent pas `MOTIFS_POUR_CONCLURE`,
   * ou quand deux motifs sont à égalité. Nommer une cause dominante sur deux
   * observations serait exactement le genre de conclusion que le catalogue
   * d'indicateurs interdit ailleurs, et il n'y a pas de raison de se l'autoriser
   * ici parce que c'est plus facile à calculer.
   */
  dominant: { motif: MotifNonFait; libelle: string; combien: number; part: number } | null;
}

/** En deçà, on ne nomme aucune cause dominante. */
export const MOTIFS_POUR_CONCLURE = 4;

export interface OptionsPlanTenu {
  /** Les jours logiques observés. */
  jours: readonly string[];
  /** Instant courant : ce qui n'est pas encore échu n'est pas compté. */
  maintenant: Date;
  actifs: readonly IdDomaine[];
}

/**
 * Le suivi « prévu / réalisé », sur les événements et les tâches datées.
 *
 * ## Ce qui entre dans le compte, et ce qui n'y entre pas
 *
 * | Élément | Compté ? |
 * |---|---|
 * | Événement passé, relevé | oui, selon la réponse |
 * | Événement passé, non relevé | compté **à part**, jamais comme un échec |
 * | Événement encore à venir | non : on ne manque pas un rendez-vous de demain |
 * | Tâche échue et faite | oui, comme faite |
 * | Tâche échue et abandonnée | oui, comme non faite — renoncer est une réponse |
 * | Tâche échue, ni faite ni abandonnée | non relevée |
 * | Tâche **sans échéance** | non : elle n'était prévue pour aucun jour |
 *
 * La dernière ligne est la plus importante. Une liste de choses à faire « un
 * jour » n'est pas un plan, et la compter ferait baisser le taux à chaque
 * idée notée — ce qui apprendrait à ne plus rien noter.
 */
export function planTenu(
  taches: readonly Tache[],
  evenements: readonly Evenement[],
  options: OptionsPlanTenu,
): PlanTenu {
  const fenetre = new Set(options.jours);
  const actifs = new Set(options.actifs);
  const instant = options.maintenant.getTime();

  let faits = 0;
  let partiels = 0;
  let nonFaits = 0;
  let nonReleves = 0;
  const comptes = new Map<MotifNonFait, number>();
  const noter = (m: MotifNonFait | null) => {
    if (m) comptes.set(m, (comptes.get(m) ?? 0) + 1);
  };

  for (const evenement of evenements) {
    if (!actifs.has(evenement.domaine)) continue;
    const jour = evenement.debut.slice(0, 10);
    if (!fenetre.has(jour)) continue;
    // Pas encore échu : on ne manque pas ce qui n'a pas encore eu lieu.
    if (Date.parse(evenement.fin) > instant) continue;
    if (evenement.realise === 'fait') {
      faits += 1;
    } else if (evenement.realise === 'partiel') {
      partiels += 1;
      // Un « en partie » peut porter un motif, sans y être tenu.
      noter(evenement.motif);
    } else if (evenement.realise === 'non-fait') {
      nonFaits += 1;
      noter(evenement.motif);
    } else {
      nonReleves += 1;
    }
  }

  for (const tache of taches) {
    if (!actifs.has(tache.domaine)) continue;
    // Sans échéance, elle n'était prévue pour aucun jour.
    if (!tache.echeance || !fenetre.has(tache.echeance)) continue;
    if (tache.faiteLe) {
      faits += 1;
      continue;
    }
    if (tache.abandonneeLe) {
      nonFaits += 1;
      noter(tache.motifAbandon);
      continue;
    }
    /*
       Une tâche dont l'échéance n'est pas passée n'est pas en retard : elle
       est encore à faire. La comparaison porte sur le jour, parce qu'une
       échéance est un jour et non une heure.
    */
    const finDuJour = Date.parse(`${tache.echeance}T23:59:59.999Z`);
    if (finDuJour > instant) continue;
    nonReleves += 1;
  }

  const releves = faits + partiels + nonFaits;
  /*
     Les motifs sont triés par fréquence, puis par **ordre de déclaration** à
     égalité. Un tri instable ferait changer l'ordre d'un affichage à l'autre
     sur les mêmes données, et une liste qui bouge toute seule se lit comme
     une liste qui ment.
  */
  const rang = new Map(MOTIFS.map((m, i) => [m.id, i]));
  const motifs = [...comptes.entries()]
    .map(([m, combien]) => ({ motif: m, libelle: libelleDuMotif(m), combien }))
    .sort((a, b) =>
      b.combien !== a.combien
        ? b.combien - a.combien
        : (rang.get(a.motif) ?? 99) - (rang.get(b.motif) ?? 99),
    );

  const donnes = motifs.reduce((somme, m) => somme + m.combien, 0);
  const exAequo = motifs.length > 1 && motifs[0].combien === motifs[1].combien;
  const dominant =
    motifs.length && donnes >= MOTIFS_POUR_CONCLURE && !exAequo
      ? { ...motifs[0], part: motifs[0].combien / donnes }
      : null;

  return {
    prevus: releves + nonReleves,
    faits,
    partiels,
    nonFaits,
    nonReleves,
    taux: releves > 0 ? (faits + partiels * POIDS_PARTIEL) / releves : null,
    motifs,
    dominant,
  };
}
