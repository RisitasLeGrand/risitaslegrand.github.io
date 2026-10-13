/**
 * La synthèse à montrer à un médecin — phase 4.
 *
 * ## Le problème qu'elle résout
 *
 * La carte dit « en parler à votre médecin peut être utile ». Y aller les
 * mains vides, c'est y aller avec un souvenir : « je crois que l'application
 * m'a dit quelque chose au printemps ». Ce document existe pour que la phrase
 * de la carte soit suivable — et il est fait pour être **imprimé ou remis**,
 * pas pour être transmis : rien ne sort de l'appareil que la personne ne
 * porte elle-même.
 *
 * ## Les chiffres sont ici, et ils sont interdits sur la carte
 *
 * Ce n'est pas une incohérence, c'est le même raisonnement appliqué à deux
 * lecteurs. Sur la carte, un chiffre donnerait à une comparaison avec
 * soi-même l'allure d'une mesure clinique, devant quelqu'un qui n'a aucun
 * moyen d'en juger. Devant un professionnel qui en a les moyens, retenir les
 * chiffres serait l'inverse d'une précaution : ce serait lui demander un avis
 * en lui cachant ce sur quoi le donner.
 *
 * Ce qui reste interdit des deux côtés : le vocabulaire de dépistage, et
 * toute formulation qui présenterait un écart comme un degré de gravité.
 *
 * ## Ce que ce document ne contient pas, et pourquoi
 *
 * Ni auto-évaluations, ni scores d'échelles, ni contenu de note. Ce ne sont
 * pas des oublis :
 *
 * - **Les auto-évaluations** ne sont jamais entrées dans le moteur, par
 *   construction. Les faire entrer dans la synthèse les ferait rentrer par la
 *   fenêtre dans le jugement qu'un lecteur portera.
 * - **Les échelles** (WHO-5, PHQ-9, GAD-7) ont leur écran, leurs tranches et
 *   leur provenance citée. Elles se montrent telles quelles, pas résumées par
 *   un tiers qui n'en est pas l'auteur.
 * - **Le contenu des notes, des tâches et des repas** n'a jamais traversé le
 *   collecteur — il ne reçoit que des formes minimales, exprès. Il ne peut
 *   donc pas fuir ici, et un essai le vérifie plutôt que de le supposer.
 *
 * La personne peut évidemment montrer tout cela ; c'est à elle de le faire,
 * pas au programme de le décider à sa place.
 */
import { DEPUIS_LE_JOURNAL_DUSAGE, NON_COLLECTES } from './mesures-veille';
import {
  CATALOGUE,
  DOMAINES,
  JOURS_DE_REFERENCE,
  type DomaineVeille,
  type Indicateur,
} from './veille';
import {
  LIBELLES_DE_CONTEXTE,
  MOTS_INTERDITS_VEILLE,
  REGLAGES,
  REGLAGES_FIXES_LE,
  type Contexte,
  type Sensibilite,
} from './moteur-veille';
import {
  LIBELLES_DE_REPONSE,
  type ReglagesVeille,
  type SignalEnregistre,
} from './signal-veille';

/* ══════════════════════════════════════════════════════════════════════════
   Ce que la mesure a donné
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les chiffres de `docs/cyclades/psyche-veille/mesures.md`, recopiés ici avec
 * leur provenance.
 *
 * Recopiés et non recalculés : la mesure prend plusieurs minutes sur dix vies
 * de cinq ans, et un document qu'on imprime ne lance pas un calcul de cette
 * taille. Le prix est qu'ils peuvent vieillir — d'où la date, qui est dans le
 * document, et un essai qui refuse qu'elle soit antérieure au dernier
 * changement des réglages.
 */
export const MESURE = {
  faiteLe: '2026-10-13',
  annees: 5,
  vies: 10,
  /** L'ampleur de la dégradation d'épreuve, en planchers de dispersion. */
  ampleur: 6,
  parSensibilite: {
    discrete: { fauxParAn: 0.0, vues: 6, delai: 17 },
    standard: { fauxParAn: 0.04, vues: 8, delai: 14 },
    attentive: { fauxParAn: 0.46, vues: 5, delai: 10 },
  } as Record<Sensibilite, { fauxParAn: number; vues: number; delai: number }>,
} as const;

/* ══════════════════════════════════════════════════════════════════════════
   Le document
   ══════════════════════════════════════════════════════════════════════════ */

export interface SectionDeSynthese {
  titre: string;
  /** La prose fixe. Elle porte les dénégations, et échappe au contrôle de mots. */
  prose: readonly string[];
  /** Ce qui est fabriqué à partir des données. Contrôlé, lui. */
  lignes: readonly string[];
}

export interface Synthese {
  titre: string;
  editeLe: string;
  sections: readonly SectionDeSynthese[];
}

export interface EntreeDeSynthese {
  /** Le jour d'édition. */
  jour: string;
  reglages: ReglagesVeille;
  signaux: readonly SignalEnregistre[];
  contextes?: readonly Contexte[];
  /** Les indicateurs qui portent au moins une mesure, pour dire ce qui est vu. */
  alimentes?: readonly string[];
  catalogue?: readonly Indicateur[];
}

const dateFr = (jour: string) => {
  const [a, m, j] = jour.split('-');
  return `${j}/${m}/${a}`;
};

const pluriel = (n: number, un: string, plusieurs = `${un}s`) => (n > 1 ? plusieurs : un);

/**
 * Compose la synthèse.
 *
 * L'ordre des sections est celui d'une lecture pressée : ce qu'est le
 * document, puis ce qu'il rapporte, puis ce qu'il vaut, puis ce qu'il tait.
 * Un professionnel qui s'arrête à la deuxième section doit déjà avoir
 * l'essentiel, et surtout ne pas avoir pu confondre ce dispositif avec un
 * instrument de mesure.
 */
export function syntheseMedecin(entree: EntreeDeSynthese): Synthese {
  const catalogue = entree.catalogue ?? CATALOGUE;
  const parId = new Map(catalogue.map((i) => [i.id, i]));
  const reglage = REGLAGES[entree.reglages.sensibilite];
  const signaux = [...entree.signaux].sort((a, b) => a.jour.localeCompare(b.jour));
  const contextes = [...(entree.contextes ?? [])].sort((a, b) => a.debut.localeCompare(b.debut));
  const alimentes = entree.alimentes ?? [];
  const mesure = MESURE.parSensibilite[entree.reglages.sensibilite];

  /* ── 1. Ce que c'est ─────────────────────────────────────────────────── */
  const quoi: SectionDeSynthese = {
    titre: 'Ce que ce document est',
    prose: [
      'Cyclades est une application personnelle, tenue par la personne qui vous la ' +
        'montre, et qui fonctionne entièrement sur son appareil : rien n’en sort, et ' +
        'aucun professionnel n’y a accès.',
      'Un de ses chapitres compare, jour après jour, quelques repères du rythme de vie ' +
        'à l’habitude de la personne elle-même — son sommeil, son activité, le rythme de ' +
        'ses journées. Quand plusieurs d’entre eux s’écartent de cette habitude en même ' +
        'temps et pendant plusieurs semaines, l’application le lui dit, et lui suggère ' +
        'd’en parler. C’est tout ce qu’elle fait.',
      'Ce dispositif ne dépiste rien, ne diagnostique rien et ne mesure aucun état de ' +
        'santé. Il n’a été validé contre aucune référence clinique : il n’existe ni ' +
        'sensibilité, ni spécificité, ni taux de détection, parce qu’il n’existe aucune ' +
        'vérité à laquelle comparer ce qu’il dit. L’absence de repère ne signifie pas ' +
        'que tout va bien.',
      'Ce document est produit à la demande de la personne, sur son appareil, et n’est ' +
        'conservé nulle part.',
    ],
    lignes: [],
  };

  /* ── 2. La période et le réglage ─────────────────────────────────────── */
  const periode: SectionDeSynthese = {
    titre: 'La période et le réglage',
    prose: [
      'Le réglage ne change qu’une chose : le seuil au-delà duquel un écart est retenu. ' +
        'La fenêtre d’observation et le nombre de domaines qui doivent s’écarter en même ' +
        'temps sont les mêmes pour les trois.',
    ],
    lignes: [
      `Document édité le ${dateFr(entree.jour)}.`,
      `Réglage en vigueur : « ${reglage.libelle} ».`,
      `Un écart est retenu au-delà de ${reglage.seuil.toLocaleString('fr-FR')} écarts absolus ` +
        `médians, mesuré sur la médiane des ${reglage.persistance} derniers jours.`,
      `Il faut que ${reglage.k} domaines au moins s’écartent en même temps pour que ` +
        'quelque chose soit signalé.',
      `L’habitude de référence est établie sur les ${JOURS_DE_REFERENCE} jours qui ` +
        'précèdent la période jugée, en séparant les jours ouvrés des week-ends.',
      entree.reglages.enPauseJusquau
        ? `La veille est en pause jusqu’au ${dateFr(entree.reglages.enPauseJusquau)}.`
        : entree.reglages.active
          ? 'La veille est active.'
          : 'La veille est actuellement désactivée.',
    ],
  };

  /* ── 3. Les repères ──────────────────────────────────────────────────── */
  const lignesDesReperes = signaux.length
    ? signaux.map((s) => {
        const noms = s.indicateurs.map((i) => parId.get(i)?.libelle ?? i);
        const domaines = s.domaines.map((d) => DOMAINES[d].libelle);
        const reponse = s.reponse
          ? `Réponse : « ${LIBELLES_DE_REPONSE[s.reponse]} »`
          : 'Sans réponse à ce jour';
        const contexte = s.contextes.length
          ? ` Contexte déclaré alors : ${s.contextes.map((m) => LIBELLES_DE_CONTEXTE[m]).join(', ')}.`
          : '';
        /*
           Les domaines sont séparés par une barre et non par une virgule :
           « Travail, révisions, engagement » en contient déjà deux, et une
           liste en virgules se lisait comme cinq domaines au lieu de trois.
        */
        return (
          `${dateFr(s.jour)} — sur la période ouverte le ${dateFr(s.depuis)}. ` +
          `Domaines concernés : ${domaines.join(' / ')}. ` +
          `Repères qui s’écartaient : ${noms.join(' ; ')}. ${reponse}.${contexte}`
        );
      })
    : ['Aucun repère n’a été levé.'];

  const reperes: SectionDeSynthese = {
    titre: 'Les repères levés',
    prose: [
      'Un « repère levé » signifie que plusieurs mesures se sont écartées en même temps ' +
        'de l’habitude de cette personne. Cela ne dit pas ce qui se passait, et cela ne ' +
        'dit pas que quelque chose n’allait pas.',
    ],
    lignes: lignesDesReperes,
  };

  /* ── 4. Le contexte déclaré ──────────────────────────────────────────── */
  const contexte: SectionDeSynthese = {
    titre: 'Les périodes particulières déclarées',
    prose: [
      'La personne peut déclarer une période particulière — un voyage, une maladie, des ' +
        'examens. L’application en tient compte en se montrant plus exigeante sur les ' +
        'domaines concernés : elle ne les éteint pas, pour qu’une explication ne puisse ' +
        'pas désarmer l’observation.',
    ],
    lignes: contextes.length
      ? contextes.map((c) => {
          const ou = c.domaines.length
            ? c.domaines.map((d) => DOMAINES[d].libelle).join(', ')
            : 'tous les domaines';
          return `Du ${dateFr(c.debut)} au ${dateFr(c.fin)} : ${LIBELLES_DE_CONTEXTE[c.motif]} — ${ou}.`;
        })
      : ['Aucune période particulière n’a été déclarée.'],
  };

  /* ── 5. Ce qui est observé ───────────────────────────────────────────── */
  const vus = catalogue.filter((i) => alimentes.includes(i.id));
  const parDomaine = new Map<DomaineVeille, Indicateur[]>();
  for (const i of vus) parDomaine.set(i.domaine, [...(parDomaine.get(i.domaine) ?? []), i]);
  const muets = catalogue.filter((i) => !alimentes.includes(i.id));

  /*
     Trois états, et non deux. Un repère sans donnée peut l'être pour deux
     raisons très différentes : parce que la personne n'a rien saisi sur la
     période, ou parce qu'aucune source de l'application ne l'alimente encore.
     Les confondre dirait à un lecteur que la personne a cessé de remplir là
     où c'est le programme qui ne sait pas encore mesurer.
  */
  const jamaisAlimentes = muets.filter((i) => NON_COLLECTES.includes(i.id));
  const sansDonnee = muets.filter((i) => !NON_COLLECTES.includes(i.id));

  const observe: SectionDeSynthese = {
    titre: 'Ce qui est observé, et ce qui ne l’est pas',
    prose: [
      'Un repère qui n’est pas renseigné ne vaut pas zéro : il est absent du calcul. ' +
        'L’application ne lit jamais une absence de saisie comme un comportement.',
    ],
    lignes: [
      ...[...parDomaine.entries()]
        .map(([domaine, liste]) => ({ libelle: DOMAINES[domaine].libelle, liste }))
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
        .map(
          ({ libelle, liste }) =>
            `${libelle} : ${liste.map((i) => `${i.libelle} (${i.definition})`).join(' ; ')}.`,
        ),
      sansDonnee.length
        ? `${sansDonnee.length} ${pluriel(sansDonnee.length, 'repère')} ${pluriel(sansDonnee.length, 'n’est pas renseigné', 'ne sont pas renseignés')} sur la période : ` +
          `${sansDonnee.map((i) => i.libelle).join(', ')}.`
        : 'Tous les repères que l’application sait alimenter sont renseignés.',
      jamaisAlimentes.length
        ? `${jamaisAlimentes.length} ${pluriel(jamaisAlimentes.length, 'repère est décrit', 'repères sont décrits')} au catalogue mais ` +
          `${pluriel(jamaisAlimentes.length, 'n’est alimenté', 'ne sont alimentés')} par aucune source à ce jour : ` +
          `${jamaisAlimentes.map((i) => i.libelle).join(', ')}.`
        : '',
      DEPUIS_LE_JOURNAL_DUSAGE.length
        ? `${DEPUIS_LE_JOURNAL_DUSAGE.length} repères sont tirés de l’usage de l’application ` +
          'elle-même — heures d’ouverture, durée, fragmentation. Ils ne circulent pas d’un ' +
          'appareil à l’autre, et ne valent donc que pour celui sur lequel ce document a ' +
          'été produit.'
        : '',
    ].filter((l) => l !== ''),
  };

  /* ── 6. Ce que ces repères valent ────────────────────────────────────── */
  const valeur: SectionDeSynthese = {
    titre: 'Ce que ces repères valent',
    prose: [
      'Les chiffres qui suivent ont été obtenus sur des vies simulées, pas sur des ' +
        'personnes. Ils disent à quelle fréquence quelqu’un dont rien ne se dégrade ' +
        'serait dérangé, et si une dégradation franche finit par se voir. Ils ne sont ni ' +
        'une sensibilité ni une spécificité : il n’existe aucune vérité de terrain à ' +
        'laquelle les comparer.',
      'Un réglage plus sensible signale davantage sans mieux repérer : les signaux de ' +
        'trop consomment le silence qui suit chaque réponse, et ce silence masque ensuite ' +
        'ce qu’on cherchait. C’est la raison pour laquelle le réglage intermédiaire est ' +
        'celui par défaut.',
    ],
    lignes: [
      `Mesure faite le ${dateFr(MESURE.faiteLe)}, sur ${MESURE.vies} vies simulées de ` +
        `${MESURE.annees} ans chacune.`,
      `Au réglage « ${reglage.libelle} » : ${mesure.fauxParAn.toLocaleString('fr-FR')} signal ` +
        'par an sur une vie où rien ne se dégrade.',
      `Sur une dégradation franche et simulée touchant trois domaines, ce réglage l’a ` +
        `remarquée ${mesure.vues} fois sur ${MESURE.vies}, au bout de ${mesure.delai} jours ` +
        'en médiane.',
    ],
  };

  /* ── 7. Ce qu'il ne contient pas ─────────────────────────────────────── */
  const absent: SectionDeSynthese = {
    titre: 'Ce que ce document ne contient pas',
    prose: [
      'Aucune auto-évaluation d’humeur : l’application en enregistre, et elles n’entrent ' +
        'jamais dans ce calcul — une journée déclarée bonne ne peut pas éteindre un ' +
        'repère, ni une journée déclarée mauvaise en allumer un.',
      'Aucun score de questionnaire : les échelles remplies dans l’application ont leur ' +
        'propre écran, avec leurs tranches d’interprétation et leur provenance. La ' +
        'personne peut vous les montrer séparément si elle le souhaite.',
      'Aucun contenu de note, de tâche, de repas ni de rendez-vous. Le calcul ne reçoit ' +
        'que des horaires et des décomptes, jamais des intitulés.',
    ],
    lignes: [],
  };

  return {
    titre: 'Veille du rythme de vie — synthèse',
    editeLe: entree.jour,
    sections: [quoi, periode, reperes, contexte, observe, valeur, absent],
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le rendu
   ══════════════════════════════════════════════════════════════════════════ */

/** Le document en texte simple, celui qui s'imprime et se range dans un dossier. */
export function syntheseEnTexte(s: Synthese): string {
  const morceaux: string[] = [`${s.titre}`, `Édité le ${dateFr(s.editeLe)}`, ''];
  for (const section of s.sections) {
    morceaux.push(`## ${section.titre}`, '');
    for (const p of section.prose) morceaux.push(p, '');
    for (const l of section.lignes) morceaux.push(`- ${l}`);
    if (section.lignes.length) morceaux.push('');
  }
  return morceaux.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Les seules phrases que le contrôle de vocabulaire doit relire. */
export const lignesFabriquees = (s: Synthese): string[] =>
  s.sections.flatMap((section) => [...section.lignes]);

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

const sansAccent = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, "'")
    .toLowerCase();

/**
 * Relit une synthèse.
 *
 * Le contrôle porte sur les **lignes fabriquées**, et pas sur la prose fixe.
 * C'est la leçon de la phase 3, et elle vaut doublement ici : la prose fixe
 * est faite de dénégations — « ne dépiste rien », « il n’existe ni
 * sensibilité, ni spécificité » —, et c'est exactement ce qu'un lecteur doit
 * trouver. Interdire ces mots partout obligerait à les dire en périphrase,
 * c'est-à-dire à dire moins clairement la seule chose qui compte.
 *
 * En contrepartie, la prose fixe est vérifiée dans l'autre sens : elle doit
 * **porter** ses dénégations. Une prose qui les perdrait laisserait un
 * document d'apparence clinique sans son avertissement.
 */
export function controlerLaSynthese(synthese: Synthese): string[] {
  const problemes: string[] = [];

  for (const ligne of lignesFabriquees(synthese)) {
    const nette = sansAccent(ligne);
    for (const mot of MOTS_INTERDITS_VEILLE) {
      if (nette.includes(sansAccent(mot))) {
        problemes.push(`« ${mot} » s’est glissé dans une ligne fabriquée : « ${ligne.slice(0, 80)}… »`);
      }
    }
  }

  const prose = synthese.sections.flatMap((s) => s.prose).join(' ');
  const nette = sansAccent(prose);
  const exigees = [
    ['ne depiste rien', 'que le dispositif ne dépiste rien'],
    ["n'existe ni sensibilite", 'qu’il n’existe ni sensibilité ni spécificité'],
    ['absence de repere ne signifie pas', 'que l’absence de repère ne veut pas dire que tout va bien'],
    ['ne diagnostique rien', 'qu’il ne diagnostique rien'],
  ];
  for (const [attendu, dit] of exigees) {
    if (!nette.includes(attendu)) {
      problemes.push(`La synthèse ne dit plus ${dit}. C’est l’avertissement, pas un ornement.`);
    }
  }

  if (!synthese.sections.some((s) => s.titre.startsWith('Ce que ce document ne contient pas'))) {
    problemes.push(
      'La section « Ce que ce document ne contient pas » a disparu : un lecteur ne peut ' +
        'plus savoir ce qui a été tu, et supposera que tout y est.',
    );
  }

  return problemes;
}

/**
 * Le contrôle qui ne dépend d'aucune synthèse : les chiffres recopiés.
 *
 * Ils viennent d'un document, et un chiffre recopié vieillit en silence. On
 * vérifie au moins qu'il en existe un par sensibilité, et que l'ordre
 * mesuré est celui qu'on affirme partout — « Attentive » dérange plus sans
 * mieux repérer.
 */
export function controlerLaMesure(): string[] {
  const problemes: string[] = [];
  for (const sensibilite of Object.keys(REGLAGES) as Sensibilite[]) {
    if (!MESURE.parSensibilite[sensibilite]) {
      problemes.push(`Aucun chiffre mesuré n’est recopié pour « ${sensibilite} ».`);
    }
  }
  const { discrete, standard, attentive } = MESURE.parSensibilite;
  if (!(attentive.fauxParAn > standard.fauxParAn && standard.fauxParAn >= discrete.fauxParAn)) {
    problemes.push(
      'Les chiffres recopiés ne montrent plus qu’un seuil plus bas dérange davantage. ' +
        'Soit la mesure a changé, soit la recopie est fausse.',
    );
  }
  if (MESURE.faiteLe < REGLAGES_FIXES_LE) {
    problemes.push(
      `Les réglages ont été arrêtés le ${REGLAGES_FIXES_LE}, et les chiffres recopiés ` +
        `datent du ${MESURE.faiteLe} : la synthèse affirmerait sur ces seuils ce qui a été ` +
        'observé sur d’autres. Relancer « npm run veille:faux-signaux » et reporter.',
    );
  }
  if (attentive.vues > standard.vues) {
    problemes.push(
      'Les chiffres recopiés disent maintenant qu’« Attentive » repère mieux que ' +
        '« Standard ». Toute la justification du réglage par défaut repose sur l’inverse : ' +
        'si la mesure a changé, c’est le réglage par défaut qu’il faut reprendre.',
    );
  }
  return problemes;
}
