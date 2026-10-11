/**
 * Révisions publie ses faits — et ne les stocke pas.
 *
 * ## Pourquoi une projection, et pas un magasin de faits
 *
 * La tentation était d'ajouter un magasin `faits` et d'y écrire un fait à
 * chaque séance, chaque carte, chaque QCM. Ce serait deux vérités du même
 * événement : la séance dans `seances`, et sa copie dans `faits`. Deux vérités
 * divergent — un correctif appliqué à l'une, un effacement ciblé sur l'autre —
 * et c'est exactement ce que le contrat de faits existe pour empêcher.
 *
 * Une branche **possède** ses données et **publie** des faits. Ici, publier est
 * donc une lecture : les magasins de Révisions sont la source, les faits en
 * sont la vue typée, et il n'y a rien à synchroniser de plus que ce qui l'est
 * déjà. Le jour où Sport et Odyssée écriront leurs propres données, elles
 * publieront de la même façon, depuis leurs propres magasins.
 *
 * Ce choix a un coût, et il est réel : **ce que la branche n'a jamais
 * enregistré ne peut pas être publié**. Les convergences de seuil d'une session
 * de Veridical Mapping, par exemple, étaient calculées à l'écran et jamais
 * écrites. Ces manques sont donc comptés et rendus avec les faits
 * (`manques`), plutôt que remplacés par une estimation qui se ferait passer
 * pour une mesure.
 *
 * ## Les identifiants sont déterministes
 *
 * `revision.seance:<id de séance>` ; jamais un ULID tiré au hasard. Deux appels
 * rendent donc les mêmes faits, et un fait peut être rapproché de la ligne de
 * magasin dont il vient — sans quoi aucun journal d'XP ne serait vérifiable.
 */
import {
  tousLesEtatsFiches,
  tousLesResultatsQuiz,
  toutesLesRevisions,
  toutesLesSeances,
  toutesLesSessionsDgfip,
  toutesLesSessionsNBack,
  toutesLesSessionsRelationnelles,
  toutesLesSessionsVeridical,
  volumesDesNotes,
  type Note,
} from '../db';
import { estSocle } from '../noyau/revisions';
import { jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';
import { valider, type Fait, type Fiabilite, type Source } from '../noyau/faits';
import { echelonDeMoteur } from '../../features/relational-reasoning/progression';

export const BRANCHE = 'revisions';

/** Ce que la branche ne peut pas publier, et pourquoi. */
export interface Manque {
  quoi: string;
  /** Combien de faits sont concernés. */
  combien: number;
  consequence: string;
}

export interface Publication {
  faits: Fait[];
  manques: Manque[];
  /** Les faits refusés par la validation du contrat, avec leur motif. */
  refuses: { id: string; type: string; motifs: string[] }[];
}

export interface OptionsPublication {
  /** Premier jour logique publié, inclus. */
  de?: string;
  /** Dernier jour logique publié, inclus. */
  a?: string;
  reglages?: Partial<ReglagesJourLogique>;
}

interface Brouillon {
  id: string;
  type: string;
  debut: string;
  fin?: string;
  valeur?: number | string | boolean;
  source: Source;
  fiabilite: Fiabilite;
  details?: Record<string, unknown>;
}

/**
 * Publie les faits de Révisions sur la fenêtre demandée.
 *
 * Les faits sont rendus triés par jour logique puis par identifiant : l'ordre
 * est une propriété du résultat, parce qu'un journal d'XP qui changerait
 * d'ordre d'un appel à l'autre ne se relirait pas.
 */
export async function publierFaitsRevisions(
  options: OptionsPublication = {},
): Promise<Publication> {
  const reglages = options.reglages ?? {};
  const typeDe = new Map<string, { domaine: string; unite?: string }>([
    ['revision.seance', { domaine: 'connaissances', unite: 'secondes' }],
    ['revision.flashcards', { domaine: 'connaissances', unite: 'cartes' }],
    ['revision.qcm', { domaine: 'connaissances', unite: 'points' }],
    ['revision.fiche', { domaine: 'connaissances', unite: 'secondes' }],
    ['revision.pretest', { domaine: 'connaissances' }],
    ['revision.cog-training', { domaine: 'cognition', unite: 'secondes' }],
  ]);

  const brouillons: Brouillon[] = [];
  const manques: Manque[] = [];

  /* --- Séances de révision ------------------------------------------------- */
  const [seances, volumes] = await Promise.all([toutesLesSeances(), volumesDesNotes()]);
  let seancesSansHeure = 0;
  for (const seance of seances) {
    if (seance.statut !== 'terminee' || !seance.id) continue;
    const volume = volumes.get(seance.id);
    /*
     * `termineeLe` est l'heure réelle de fin ; les séances anciennes n'en ont
     * pas, et seul leur jour calendaire est connu. On les pose alors à midi,
     * ce qui ne peut pas les faire changer de jour logique, et on le compte.
     */
    const fin = seance.termineeLe ?? `${seance.jour}T12:00:00.000Z`;
    if (!seance.termineeLe) seancesSansHeure += 1;
    /*
     * Une séance a une durée : son fait porte donc un intervalle, et non un
     * instant. C'est ce qui permet aux règles de désaccord de voir qu'une
     * séance de révision et une séance de sport se chevauchent — une personne
     * n'est pas à deux endroits à la fois, donc l'une des deux est fausse.
     */
    const debut = new Date(Date.parse(fin) - seance.secondes * 1000).toISOString();
    brouillons.push({
      id: `revision.seance:${seance.id}`,
      type: 'revision.seance',
      debut,
      fin,
      valeur: seance.secondes,
      source: 'auto',
      fiabilite: seance.termineeLe ? 'confirme' : 'estime',
      details: {
        theme: seance.theme,
        etendue: seance.etendue,
        restitutions: volume?.restitutions ?? 0,
        signesNote: volume?.note ?? 0,
        fiches: seance.fiches?.length ?? 0,
      },
    });
  }
  if (seancesSansHeure) {
    manques.push({
      quoi: 'heure de fin de séance',
      combien: seancesSansHeure,
      consequence:
        'Ces séances sont rattachées à midi : leur jour logique est juste, leur heure est inventée.',
    });
  }

  /* --- Flashcards : un fait par jour logique -------------------------------- */
  const revisions = await toutesLesRevisions();
  const parJour = new Map<string, Record<Note, number>>();
  for (const entree of revisions) {
    if (estSocle(entree)) continue;
    const jour = jourLogique(new Date(entree.le), reglages);
    const compte =
      parJour.get(jour) ?? { oublie: 0, difficile: 0, correct: 0, facile: 0 };
    compte[entree.note] += 1;
    parJour.set(jour, compte);
  }
  for (const [jour, compte] of parJour) {
    const total = compte.oublie + compte.difficile + compte.correct + compte.facile;
    brouillons.push({
      id: `revision.flashcards:${jour}`,
      type: 'revision.flashcards',
      // Le fait porte la journée entière : son instant est le début du jour
      // logique tel que le contrat l'exige, et son jour logique est celui-là.
      debut: `${jour}T12:00:00.000Z`,
      valeur: total,
      source: 'auto',
      fiabilite: 'confirme',
      details: { ...compte },
    });
  }
  manques.push({
    quoi: 'cartes notées avant le journal de révisions',
    combien: revisions.filter((e) => estSocle(e)).length,
    consequence:
      'Le socle FSRS reprend un état sans journal : ces notations n’ont jamais été écrites, et ne peuvent donc pas être créditées.',
  });

  /* --- QCM de cours et QCM DGFiP -------------------------------------------- */
  const [quiz, dgfip] = await Promise.all([tousLesResultatsQuiz(), toutesLesSessionsDgfip()]);
  for (const resultat of quiz) {
    if (!resultat.id) continue;
    brouillons.push({
      id: `revision.qcm:${resultat.id}`,
      type: 'revision.qcm',
      debut: resultat.le,
      valeur: resultat.bonnes,
      source: 'auto',
      fiabilite: 'confirme',
      details: {
        origine: 'cours',
        matiere: resultat.matiere,
        ficheId: resultat.ficheId,
        bonnes: resultat.bonnes,
        posees: resultat.total,
        bareme: 'une bonne réponse par question',
      },
    });
  }
  for (const session of dgfip) {
    if (!session.id) continue;
    brouillons.push({
      id: `revision.qcm:${session.id}`,
      type: 'revision.qcm',
      debut: session.le,
      valeur: session.points,
      source: 'auto',
      fiabilite: 'confirme',
      details: {
        origine: 'dgfip',
        bonnes: session.bonnes,
        posees: session.posees,
        abstentions: session.abstentions,
        bareme: '+1 / −0,5 / 0',
      },
    });
  }

  /* --- Fiches terminées et prétests ----------------------------------------- */
  const fiches = await tousLesEtatsFiches();
  let fichesSansDate = 0;
  for (const fiche of fiches) {
    if (fiche.lu) {
      /*
       * Une fiche terminée ne porte pas la date où elle l'a été : seule
       * `derniereOuverture` existe, et une relecture la déplace. Le total d'XP
       * est donc juste, sa **date** est approchée — d'où « estime », et d'où le
       * manque déclaré plus bas.
       */
      if (fiche.derniereOuverture) {
        brouillons.push({
          id: `revision.fiche:${fiche.id}`,
          type: 'revision.fiche',
          debut: fiche.derniereOuverture,
          valeur: fiche.secondes,
          source: 'derive',
          fiabilite: 'estime',
          details: { matiere: fiche.matiere },
        });
      } else {
        fichesSansDate += 1;
      }
    }
    if (fiche.pretesteeLe) {
      brouillons.push({
        id: `revision.pretest:${fiche.id}`,
        type: 'revision.pretest',
        debut: fiche.pretesteeLe,
        source: 'auto',
        fiabilite: 'confirme',
        details: { matiere: fiche.matiere, ficheId: fiche.id },
      });
    }
  }
  if (fiches.some((f) => f.lu)) {
    manques.push({
      quoi: 'date d’achèvement d’une fiche',
      combien: fiches.filter((f) => f.lu).length,
      consequence:
        'Le jour retenu est celui de la dernière ouverture : une relecture déplace la ligne du journal, jamais le total.',
    });
  }
  if (fichesSansDate) {
    manques.push({
      quoi: 'fiche terminée sans aucune date d’ouverture',
      combien: fichesSansDate,
      consequence: 'Faute de date, ces fiches ne sont pas publiées et leur XP d’origine reste dans le socle.',
    });
  }

  /* --- Cog-Training : trois familles, un seul type -------------------------- */
  const [nback, relationnel, veridical] = await Promise.all([
    toutesLesSessionsNBack(),
    toutesLesSessionsRelationnelles(),
    toutesLesSessionsVeridical(),
  ]);
  for (const session of nback) {
    if (!session.id || (session.statut ?? 'terminee') !== 'terminee') continue;
    brouillons.push({
      id: `revision.cog-training:${session.id}`,
      type: 'revision.cog-training',
      debut: session.le,
      valeur: session.secondes,
      source: 'auto',
      fiabilite: 'confirme',
      details: {
        famille: 'nback',
        n: session.n,
        taux: session.taux,
        dimensions: session.dimensions.length,
      },
    });
  }
  /*
   * L'échelon moyen majorait l'XP de la session, et c'était l'échelon **du
   * moment**, pas celui d'aujourd'hui. Il est donc rejoué : les sessions sont
   * reprises dans l'ordre, et chacune lit l'échelon que les sessions
   * antérieures avaient produit. C'est ce que `echelonDeMoteur` sait faire —
   * le module relationnel rejoue déjà ses échelons plutôt que de les stocker.
   *
   * Les traces sont tenues par moteur : la fonction filtre de toute façon sur
   * le moteur demandé, et lui passer l'historique entier à chaque item ferait
   * un coût quadratique pour le même résultat.
   */
  const tracesParMoteur = new Map<string, { moteur: string; systeme: string; note: number }[]>();
  const relationnelOrdonne = [...relationnel].sort((a, b) =>
    a.le !== b.le ? (a.le < b.le ? -1 : 1) : (a.id ?? '') < (b.id ?? '') ? -1 : 1,
  );
  for (const session of relationnelOrdonne) {
    if (!session.id) continue;
    const echelons = session.items.map((i) =>
      echelonDeMoteur(tracesParMoteur.get(i.moteur) ?? [], i.moteur),
    );
    const echelonMoyen = echelons.length
      ? echelons.reduce((s, e) => s + e, 0) / echelons.length
      : 1;
    for (const item of session.items) {
      const vues = tracesParMoteur.get(item.moteur);
      if (vues) vues.push(item);
      else tracesParMoteur.set(item.moteur, [item]);
    }
    brouillons.push({
      id: `revision.cog-training:${session.id}`,
      type: 'revision.cog-training',
      debut: session.le,
      valeur: session.secondes,
      source: 'auto',
      fiabilite: 'confirme',
      details: {
        famille: 'relationnel',
        reussis: session.reussis,
        tentes: session.tentes,
        echelonMoyen,
      },
    });
  }
  for (const session of veridical) {
    if (!session.id) continue;
    brouillons.push({
      id: `revision.cog-training:${session.id}`,
      type: 'revision.cog-training',
      debut: session.le,
      valeur: session.secondes,
      source: 'auto',
      fiabilite: 'confirme',
      details: {
        famille: 'veridical',
        reussis: session.reussis,
        essais: session.essais,
        // Les convergences ne sont pas dans le magasin : voir « manques ».
        convergences: 0,
      },
    });
  }
  if (veridical.length) {
    manques.push({
      quoi: 'seuils stabilisés par session de Veridical Mapping',
      combien: veridical.length,
      consequence:
        'La prime de convergence (25 XP par seuil) est inconnue de l’historique : le magasin ne garde que le seuil médian, pas le nombre de convergences de la session.',
    });
  }

  /* --- Validation, fenêtre, tri -------------------------------------------- */
  const faits: Fait[] = [];
  const refuses: Publication['refuses'] = [];
  for (const brouillon of brouillons) {
    const infos = typeDe.get(brouillon.type)!;
    /*
     * Le jour logique d'un fait qui a une durée est celui de sa **fin**. Une
     * séance commencée à 22 h et finie à 1 h du matin compte pour la soirée
     * écoulée dans les deux conventions ; mais une séance qui enjamberait 4 h
     * du matin doit compter là où son XP a été attribuée — à la fin —, sans
     * quoi la reprise de l'historique déplacerait des journées entières.
     */
    const jour = jourLogique(new Date(brouillon.fin ?? brouillon.debut), reglages);
    if (options.de && jour < options.de) continue;
    if (options.a && jour > options.a) continue;
    const fait: Fait = {
      id: brouillon.id,
      branche: BRANCHE,
      proprietaire: BRANCHE,
      domaine: infos.domaine,
      type: brouillon.type,
      debut: brouillon.debut,
      fin: brouillon.fin,
      jourLogique: jour,
      valeur: brouillon.valeur,
      unite: infos.unite,
      source: brouillon.source,
      fiabilite: brouillon.fiabilite,
      version: 1,
      modifieLe: brouillon.fin ?? brouillon.debut,
      details: brouillon.details,
    };
    const verdict = valider(fait);
    if (!verdict.recevable) {
      refuses.push({
        id: fait.id,
        type: fait.type,
        motifs: verdict.problemes.filter((p) => p.gravite === 'refus').map((p) => p.message),
      });
      continue;
    }
    faits.push({ ...fait, fiabilite: verdict.fiabilite });
  }
  faits.sort((a, b) =>
    a.jourLogique !== b.jourLogique
      ? a.jourLogique < b.jourLogique
        ? -1
        : 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0,
  );
  return { faits, manques: manques.filter((m) => m.combien > 0), refuses };
}
