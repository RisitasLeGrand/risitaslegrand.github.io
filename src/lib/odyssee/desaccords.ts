/**
 * Les désaccords entre branches : B.4, « aucune écrasure silencieuse ».
 *
 * ## Ce que ce module n'est pas
 *
 * Ce n'est pas la détection de conflits de synchronisation. Celle-là vit dans
 * `noyau/fusion.ts` et traite deux appareils qui ont écrit la même chose
 * différemment. Ici, un seul appareil suffit : **deux branches** affirment des
 * choses qui ne peuvent pas être vraies ensemble. Une séance de sport pendant
 * une séance de révision, un sommeil de vingt-huit heures, une séance tenue le
 * jour où la santé déclare un empêchement.
 *
 * ## Mais la réponse est la même, et c'est délibéré
 *
 * Les quatre issues — garder l'une, garder l'autre, les deux sont justes,
 * ignorer en disant pourquoi — conviennent aux deux situations, et une
 * résolution est dans les deux cas un **fait qui voyage** : trancher sur
 * l'ordinateur et retrouver la question ouverte sur le téléphone serait
 * épuisant. Le même type d'opération (`conflit.resolu`) sert donc aux deux, et
 * le journal d'opérations est le journal d'audit que B.4 demande — il porte qui
 * a tranché, quand, avec quelle précision, et il se synchronise.
 *
 * Un désaccord nomme les faits qu'il opposait. Si un **troisième** fait arrive
 * plus tard sur le même jour, le désaccord se rouvre : la réponse donnée ne
 * portait pas sur lui. C'est la même règle d'honnêteté que pour les conflits de
 * fusion, et elle distingue « j'ai répondu à cette question » de « je ne veux
 * plus voir ce jour-là ».
 *
 * ## Ce qu'un désaccord ouvert coûte
 *
 * Il **dégrade la fiabilité** des indicateurs qui lisent les types en cause
 * (`fiabilite.ts`, composante d'intégrité), et il la réduit à zéro s'il porte
 * sur la source pivot. C'est tout : il n'efface rien, ne corrige rien, ne
 * choisit rien. Un désaccord qu'on ne sait pas trancher reste une donnée
 * incertaine, pas une donnée fausse.
 */
import { dureeDuJourLogique, jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';
import { resolutions, type ChargeResolution, type Issue, type Resolution } from '../noyau/corrections';
import type { Operation } from '../noyau/operations';
import type { Fait } from '../noyau/faits';

/** Le préfixe du « type en conflit » d'une résolution de désaccord. */
export const PREFIXE = 'desaccord';

export type Gravite =
  /** Les deux faits ne peuvent pas être vrais ensemble. */
  | 'impossible'
  /** Ils peuvent l'être, mais l'un des deux est probablement faux. */
  | 'contradiction';

export interface Desaccord {
  /** La règle qui l'a vu. */
  regle: string;
  /** Identifiant stable : il doit survivre à un recalcul, sinon la résolution le manque. */
  cible: string;
  jour: string;
  gravite: Gravite;
  /** Les faits opposés, triés : l'ordre fait partie de l'identité du désaccord. */
  faits: string[];
  /** Les types de faits en cause, pour la dégradation de fiabilité. */
  types: string[];
  /** Les branches concernées. */
  branches: string[];
  /** Ce qu'il faut afficher, en une phrase. */
  resume: string;
}

export interface ContexteDesaccord {
  reglages?: Partial<ReglagesJourLogique>;
}

export interface RegleDesaccord {
  id: string;
  libelle: string;
  /** Pourquoi cette règle existe, en français. */
  pourquoi: string;
  /** Les types de faits qu'elle regarde. */
  types: readonly string[];
  /** Les clefs de `details` qu'elle lit. Déclarées, pour que les branches à venir les sachent. */
  lit?: readonly string[];
  /**
   * Les types dont un fait **dure**, et qu'il faut voir chaque jour couvert.
   *
   * Un fait porte un seul jour logique — celui de sa fin, ou de son début
   * s'il n'a pas de fin. Cela convient aux événements : une séance, une
   * pesée, un repas. Cela ne convient pas aux **états** : une maladie
   * déclarée le 10 et encore ouverte le 12 ne rencontrerait jamais la séance
   * du 12, et la règle se tairait en ayant l'air satisfaite.
   *
   * Étaler n'est pourtant pas le défaut, parce que ce serait faux pour les
   * règles qui **somment** : une nuit à cheval sur minuit comptée dans les
   * deux jours doublerait le sommeil. Chaque règle déclare donc les types
   * qu'elle veut voir s'étendre, et seulement ceux-là.
   */
  etale?: readonly string[];
  /** Les faits d'un même jour logique, déjà filtrés sur `types`. */
  detecter: (faits: readonly Fait[], jour: string, contexte: ContexteDesaccord) => Desaccord[];
}

const trier = (faits: readonly Fait[]): string[] => faits.map((f) => f.id).sort();

const branchesDe = (faits: readonly Fait[]): string[] =>
  [...new Set(faits.map((f) => f.branche))].sort();

const typesDe = (faits: readonly Fait[]): string[] => [...new Set(faits.map((f) => f.type))].sort();

const nombre = (fait: Fait): number | null =>
  typeof fait.valeur === 'number' && Number.isFinite(fait.valeur) ? fait.valeur : null;

/**
 * Les types dont on ne peut faire qu'un à la fois.
 *
 * Réviser, s'entraîner, tenir un minuteur de concentration : trois activités
 * qui demandent toute l'attention. Deux d'entre elles qui se chevauchent dans
 * le temps ne sont pas une donnée riche, c'est une donnée fausse — et c'est le
 * genre d'erreur qu'un minuteur oublié produit tous les mois.
 */
export const TYPES_EXCLUSIFS: readonly string[] = [
  'revision.seance',
  'sport.seance',
  'odyssee.focus',
];

/** L'écart de poids au-delà duquel deux pesées du même jour se contredisent. */
export const ECART_POIDS_KG = 2;

export const REGLES_DESACCORD: readonly RegleDesaccord[] = [
  {
    id: 'chevauchement-exclusif',
    libelle: 'Deux activités exclusives au même moment',
    pourquoi:
      'Une personne ne révise pas pendant qu’elle s’entraîne. Un chevauchement signale un minuteur oublié, et il fausse à la fois le temps de chaque domaine et la roue d’équilibre.',
    types: TYPES_EXCLUSIFS,
    detecter: (faits, jour) => {
      const avecDuree = faits
        .filter((f) => f.fin)
        .map((f) => ({ fait: f, de: Date.parse(f.debut), a: Date.parse(f.fin!) }))
        .filter((f) => Number.isFinite(f.de) && Number.isFinite(f.a) && f.a > f.de)
        .sort((a, b) => a.de - b.de);
      const sortie: Desaccord[] = [];
      for (let i = 1; i < avecDuree.length; i += 1) {
        const precedent = avecDuree[i - 1];
        const courant = avecDuree[i];
        if (courant.de >= precedent.a) continue;
        // Deux faits du même type peuvent se suivre de près sans se contredire :
        // deux séances de révision d'affilée, par exemple. Ce qui se contredit,
        // c'est d'être à deux endroits à la fois.
        if (precedent.fait.type === courant.fait.type) continue;
        const paire = [precedent.fait, courant.fait];
        sortie.push({
          regle: 'chevauchement-exclusif',
          cible: `${PREFIXE}:chevauchement-exclusif:${trier(paire).join('+')}`,
          jour,
          gravite: 'impossible',
          faits: trier(paire),
          types: typesDe(paire),
          branches: branchesDe(paire),
          resume:
            `« ${precedent.fait.type} » et « ${courant.fait.type} » se chevauchent le ${jour} : ` +
            `l’une des deux durées est fausse.`,
        });
      }
      return sortie;
    },
  },
  {
    id: 'sommeil-impossible',
    libelle: 'Plus de sommeil que de journée',
    pourquoi:
      'La somme des nuits d’un jour logique ne peut pas dépasser sa durée. Deux jours par an, cette durée vaut 23 ou 25 heures, et c’est pour cela qu’elle est demandée au jour logique plutôt que supposée de 24 heures.',
    types: ['odyssee.sommeil'],
    detecter: (faits, jour, contexte) => {
      const secondes = faits.reduce((s, f) => s + (nombre(f) ?? 0), 0);
      const duree = dureeDuJourLogique(jour, contexte.reglages) * 3600;
      if (secondes <= duree) return [];
      return [
        {
          regle: 'sommeil-impossible',
          cible: `${PREFIXE}:sommeil-impossible:${jour}`,
          jour,
          gravite: 'impossible',
          faits: trier(faits),
          types: typesDe(faits),
          branches: branchesDe(faits),
          resume:
            `${Math.round(secondes / 360) / 10} h de sommeil déclarées le ${jour}, ` +
            `pour une journée de ${Math.round(duree / 360) / 10} h.`,
        },
      ];
    },
  },
  {
    id: 'poids-deux-valeurs',
    libelle: 'Deux pesées éloignées le même jour',
    pourquoi:
      'Un corps ne varie pas de deux kilos en une journée. Deux pesées proches sont normales — avant et après une séance —, deux pesées éloignées signalent une balance mal lue ou une saisie pour un autre jour.',
    types: ['odyssee.poids'],
    detecter: (faits, jour) => {
      const valeurs = faits
        .map((f) => ({ fait: f, kg: nombre(f) }))
        .filter((f): f is { fait: Fait; kg: number } => f.kg !== null);
      if (valeurs.length < 2) return [];
      const min = Math.min(...valeurs.map((v) => v.kg));
      const max = Math.max(...valeurs.map((v) => v.kg));
      if (max - min <= ECART_POIDS_KG) return [];
      return [
        {
          regle: 'poids-deux-valeurs',
          cible: `${PREFIXE}:poids-deux-valeurs:${jour}`,
          jour,
          gravite: 'contradiction',
          faits: trier(valeurs.map((v) => v.fait)),
          types: ['odyssee.poids'],
          branches: branchesDe(valeurs.map((v) => v.fait)),
          resume: `Deux pesées du ${jour} s’écartent de ${(max - min).toFixed(1)} kg.`,
        },
      ];
    },
  },
  {
    id: 'effort-sous-sante',
    libelle: 'Effort déclaré un jour d’empêchement',
    pourquoi:
      'La santé générale appartient à Odyssée et alimente Sport (D.7 : aucune proposition de progression sous douleur déclarée). Une séance tenue un jour marqué « empêche l’effort » n’est pas interdite — on peut s’être entraîné malgré tout — mais les deux déclarations ne peuvent pas être toutes les deux justes telles quelles.',
    types: ['sport.seance', 'odyssee.sante'],
    lit: ['empecheEffort'],
    // Une maladie dure : voir `etale` sur l'interface.
    etale: ['odyssee.sante'],
    detecter: (faits, jour) => {
      const empechements = faits.filter(
        (f) => f.type === 'odyssee.sante' && f.details?.empecheEffort === true,
      );
      const seances = faits.filter((f) => f.type === 'sport.seance');
      if (!empechements.length || !seances.length) return [];
      const concernes = [...empechements, ...seances];
      return [
        {
          regle: 'effort-sous-sante',
          cible: `${PREFIXE}:effort-sous-sante:${jour}`,
          jour,
          gravite: 'contradiction',
          faits: trier(concernes),
          types: typesDe(concernes),
          branches: branchesDe(concernes),
          resume:
            `Une séance de sport est enregistrée le ${jour}, jour où la santé déclare un ` +
            `empêchement à l’effort.`,
        },
      ];
    },
  },
  {
    id: 'charge-percue-orpheline',
    libelle: 'Charge perçue sans check-in',
    pourquoi:
      'La charge perçue est un **dérivé** des check-ins, publié exprès pour que Sport connaisse la fatigue sans approcher la psyché. Une charge sans check-in le même jour veut dire que la dérivation a survécu à sa source — un effacement ciblé, un import partiel — et qu’elle affirme désormais quelque chose que rien ne soutient.',
    types: ['odyssee.charge-percue', 'odyssee.checkin'],
    detecter: (faits, jour) => {
      const charges = faits.filter((f) => f.type === 'odyssee.charge-percue');
      const checkins = faits.filter((f) => f.type === 'odyssee.checkin');
      if (!charges.length || checkins.length) return [];
      return [
        {
          regle: 'charge-percue-orpheline',
          cible: `${PREFIXE}:charge-percue-orpheline:${jour}`,
          jour,
          gravite: 'contradiction',
          faits: trier(charges),
          types: ['odyssee.charge-percue'],
          branches: branchesDe(charges),
          resume: `Une charge perçue est publiée pour le ${jour}, sans aucun check-in ce jour-là.`,
        },
      ];
    },
  },
];

/**
 * Un fait durable couvre-t-il ce jour logique ?
 *
 * Du jour de son début à celui de sa fin, bornes comprises. Sans fin, jusqu'au
 * dernier jour observé : un état ouvert vaut jusqu'à preuve du contraire, et
 * c'est le sens même de « ouvert ».
 */
function couvre(
  fait: Fait,
  jour: string,
  dernier: string,
  contexte: ContexteDesaccord,
): boolean {
  const debut = jourLogique(new Date(fait.debut), contexte.reglages);
  const fin = fait.fin ? jourLogique(new Date(fait.fin), contexte.reglages) : dernier;
  return debut <= jour && jour <= fin;
}

/**
 * Tous les désaccords d'une liste de faits.
 *
 * Les règles travaillent par jour logique, parce que c'est l'unité dans
 * laquelle une contradiction a un sens : deux pesées du même jour se
 * contredisent, deux pesées de deux jours ne se contredisent pas.
 */
export function detecter(
  faits: readonly Fait[],
  contexte: ContexteDesaccord = {},
  regles: readonly RegleDesaccord[] = REGLES_DESACCORD,
): Desaccord[] {
  const parJour = new Map<string, Fait[]>();
  for (const fait of faits) {
    const groupe = parJour.get(fait.jourLogique);
    if (groupe) groupe.push(fait);
    else parJour.set(fait.jourLogique, [fait]);
  }
  const jours = [...parJour.keys()].sort();
  /*
     Le dernier jour observé borne les états encore ouverts. Rien d'autre ne
     peut le faire ici : `detecter` est pure et ne connaît pas « aujourd'hui ».
     Une maladie sans fin couvre donc la fenêtre qu'on lui présente, ce qui est
     exactement ce qu'on veut savoir d'elle.
  */
  const dernier = jours[jours.length - 1];

  const sortie: Desaccord[] = [];
  for (const jour of jours) {
    const duJour = parJour.get(jour)!;
    for (const regle of regles) {
      const concernes = duJour.filter((f) => regle.types.includes(f.type));
      if (regle.etale?.length) {
        for (const fait of faits) {
          if (!regle.etale.includes(fait.type)) continue;
          // Déjà dans le paquet du jour : ne pas le compter deux fois.
          if (fait.jourLogique === jour) continue;
          if (!couvre(fait, jour, dernier, contexte)) continue;
          concernes.push(fait);
        }
      }
      if (!concernes.length) continue;
      sortie.push(...regle.detecter(concernes, jour, contexte));
    }
  }
  return sortie.sort((a, b) => (a.cible < b.cible ? -1 : a.cible > b.cible ? 1 : 0));
}

/* ══════════════════════════════════════════════════════════════════════════
   Trancher
   ══════════════════════════════════════════════════════════════════════════ */

export interface DesaccordOuvert extends Desaccord {
  /** La réponse précédente, quand un fait nouveau a rouvert la question. */
  repondueAvant?: Resolution;
}

export interface TriDesaccords {
  ouverts: DesaccordOuvert[];
  tranches: { desaccord: Desaccord; resolution: Resolution }[];
}

/**
 * Sépare les désaccords ouverts de ceux qui sont tranchés.
 *
 * Tranché veut dire : **tous** les faits actuels du désaccord sont couverts par
 * une résolution. Partiellement couvert, il est ouvert, et porte la réponse
 * d'avant pour que l'écran puisse dire « vous avez déjà répondu à une partie de
 * cette question ».
 */
export function trierDesaccords(
  desaccords: readonly Desaccord[],
  journal: readonly Operation[],
): TriDesaccords {
  const parCible = new Map<string, Resolution[]>();
  for (const resolution of resolutions(journal)) {
    if (!resolution.typeEnConflit.startsWith(`${PREFIXE}:`)) continue;
    const groupe = parCible.get(resolution.cible);
    if (groupe) groupe.push(resolution);
    else parCible.set(resolution.cible, [resolution]);
  }

  const ouverts: DesaccordOuvert[] = [];
  const tranches: { desaccord: Desaccord; resolution: Resolution }[] = [];
  for (const desaccord of desaccords) {
    const candidates = [...(parCible.get(desaccord.cible) ?? [])].sort((a, b) =>
      a.hlc !== b.hlc ? (a.hlc > b.hlc ? -1 : 1) : a.id > b.id ? -1 : 1,
    );
    const complete = candidates.find((r) => desaccord.faits.every((id) => r.couvre.includes(id)));
    if (complete) tranches.push({ desaccord, resolution: complete });
    else ouverts.push({ ...desaccord, repondueAvant: candidates[0] });
  }
  return { ouverts, tranches };
}

/**
 * La charge d'une résolution de désaccord, construite et validée.
 *
 * Elle lève plutôt que de produire une réponse incomplète, pour la même raison
 * que les conflits de fusion : une issue « retenue » sans valeur retenue, ou un
 * « ignoré » sans motif, ne se relit plus six mois après — et six mois après
 * est précisément le moment où on la relit.
 *
 * L'opération qui portera cette charge doit avoir pour `cible` le `cible` du
 * désaccord : c'est par là que `trierDesaccords` les rapproche.
 */
export function construireArbitrage(
  desaccord: Desaccord,
  choix: { issue: Issue; retenue?: string; precision?: string },
): ChargeResolution {
  if (choix.issue === 'retenue') {
    if (!choix.retenue || !desaccord.faits.includes(choix.retenue)) {
      throw new Error(
        'Pour retenir un fait, il faut dire lequel, et il doit faire partie du désaccord.',
      );
    }
  } else if (!choix.precision?.trim()) {
    throw new Error(
      choix.issue === 'toutes-justes'
        ? 'Dites en quoi les deux sont justes — deux pesées dans la journée, par exemple : une réponse sans explication ne se relit pas.'
        : 'Dites pourquoi vous ne tranchez pas : sans motif, cette question reviendra sans qu’on sache qu’elle a été vue.',
    );
  }
  return {
    typeEnConflit: `${PREFIXE}:${desaccord.regle}`,
    issue: choix.issue,
    retenue: choix.issue === 'retenue' ? choix.retenue : undefined,
    couvre: [...desaccord.faits],
    precision: choix.precision?.trim() || undefined,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Ce qu'un désaccord coûte à un indicateur
   ══════════════════════════════════════════════════════════════════════════ */

export interface SourcesDIndicateur {
  /**
   * Les types de faits dont l'indicateur se nourrit, **le pivot en premier**.
   *
   * Le pivot est celui sans lequel l'indicateur n'existe pas : un conflit sur
   * lui annule la mesure, un conflit sur une source secondaire l'abîme.
   */
  sources: readonly string[];
}

/**
 * L'état des désaccords pour un indicateur donné, prêt pour `fiabilite.ts`.
 */
export function etatPourIndicateur(
  indicateur: SourcesDIndicateur,
  ouverts: readonly Desaccord[],
): { ouverts: number; pivotEnConflit: boolean } {
  const pivot = indicateur.sources[0];
  const touchants = ouverts.filter((d) => d.types.some((t) => indicateur.sources.includes(t)));
  return {
    ouverts: touchants.length,
    pivotEnConflit: pivot !== undefined && touchants.some((d) => d.types.includes(pivot)),
  };
}
