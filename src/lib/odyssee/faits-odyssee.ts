/**
 * Odyssée publie ses faits — et ne les stocke pas davantage que Révisions.
 *
 * Même principe, et il vaut la peine d'être redit parce que c'est lui qui
 * garantit qu'il n'y a jamais deux vérités d'un même événement : les magasins
 * d'Odyssée sont la source, les faits en sont la **vue typée**, calculée à la
 * lecture. Un magasin `faits` qui recevrait une copie à chaque écriture
 * divergerait au premier correctif appliqué d'un seul côté.
 *
 * ## Les identifiants sont déterministes
 *
 * `odyssee.tache:<id>` ; jamais un ULID tiré au hasard. Deux appels rendent
 * donc les mêmes faits, et un fait se rattache à la ligne dont il vient — sans
 * quoi ni le journal d'XP ni la vérification d'une analyse importée ne
 * seraient contrôlables.
 *
 * ## Ce qui est publié, et ce qui ne l'est pas
 *
 * | Magasin | Publié quand | Pourquoi |
 * |---|---|---|
 * | Tâches | **close** | Une tâche ouverte n'est pas un événement : c'est une intention. L'XP et les indicateurs portent sur ce qui a eu lieu. |
 * | Quêtes | **à chaque jour tenu** | Une quête est un objet durable, mais chaque jour tenu est un fait distinct, daté de ce jour-là. |
 * | Événements | **passés** | Un rendez-vous de la semaine prochaine n'occupe aucun temps aujourd'hui. Le publier ferait compter d'avance un temps qui n'a pas été vécu. |
 * | Focus | **toujours** | Une session de focus enregistrée est close par construction. |
 * | Revues | **toujours** | Une revue tenue est tenue. |
 *
 * Le domaine d'un fait vient de l'objet — une tâche porte le sien —, **sauf**
 * pour les revues, qui relèvent de Psyché par le contrat : une revue n'est pas
 * du rangement, c'est un retour sur soi, et la classer en « Ordre » gonflerait
 * ce domaine d'un geste qui ne lui appartient pas.
 */
import { jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';
import { valider, type Fait, type Fiabilite, type Source } from '../noyau/faits';
import {
  toutLeFocus,
  toutesLesQuetes,
  toutesLesRevues,
  tousLesEvenements,
  toutesLesTaches,
} from './donnees';
import { dureeDeLEvenement, type Evenement, type Focus, type Quete, type Revue, type Tache } from './modele';
import type { Manque, OptionsPublication, Publication } from './faits-revisions';

export const BRANCHE = 'odyssee';

interface Brouillon {
  id: string;
  type: string;
  domaine: string;
  debut: string;
  fin?: string;
  valeur?: number | string | boolean;
  unite?: string;
  source: Source;
  fiabilite: Fiabilite;
  details?: Record<string, unknown>;
}

/**
 * Midi, pour un fait qui ne connaît que son jour.
 *
 * Une quête tenue n'a pas d'heure : la personne a coché une case. Lui donner
 * minuit la placerait au bord du jour logique, où le moindre réglage de
 * bascule la ferait changer de journée ; midi est à quatre heures de la borne
 * la plus proche admise (2 h à 6 h), donc aucune bascule ne la déplace.
 */
const midiDu = (jour: string) => `${jour}T12:00:00.000Z`;

/** Ce que la projection lit. Passé explicitement, pour qu'elle reste pure. */
export interface ContenuOdyssee {
  taches: readonly Tache[];
  quetes: readonly Quete[];
  evenements: readonly Evenement[];
  focus: readonly Focus[];
  revues: readonly Revue[];
}

/**
 * Lit les magasins, puis projette.
 *
 * La lecture et le calcul sont séparés — `projeter` ne touche pas la base —
 * parce que c'est la seule façon d'éprouver les règles de publication sans
 * navigateur. Une projection testable seulement à travers IndexedDB serait
 * testée une fois, mal, et jamais sur les cas tordus.
 */
export async function publierFaitsOdyssee(
  options: OptionsPublication = {},
): Promise<Publication> {
  const [taches, quetes, evenements, focus, revues] = await Promise.all([
    toutesLesTaches(),
    toutesLesQuetes(),
    tousLesEvenements(),
    toutLeFocus(),
    toutesLesRevues(),
  ]);
  return projeterFaitsOdyssee({ taches, quetes, evenements, focus, revues }, options);
}

/**
 * La projection proprement dite : des magasins déjà lus vers des faits validés.
 *
 * `maintenant` est un paramètre et non `Date.now()` : c'est lui qui décide
 * quels événements sont « passés », et un essai doit pouvoir le fixer.
 */
export function projeterFaitsOdyssee(
  contenu: ContenuOdyssee,
  options: OptionsPublication & { maintenant?: Date } = {},
): Publication {
  const reglages: Partial<ReglagesJourLogique> = options.reglages ?? {};
  const brouillons: Brouillon[] = [];
  const manques: Manque[] = [];
  const { taches, quetes, evenements, focus, revues } = contenu;

  /* --- Tâches closes -------------------------------------------------------
     Une tâche ne porte pas l'heure de sa clôture, seulement le jour logique :
     `clore` écrit `faiteLe` et rien d'autre. Le fait est donc posé à midi de
     ce jour-là, ce qui ne peut pas le faire changer de journée.
  */
  let tachesSansDomaine = 0;
  for (const tache of taches) {
    if (!tache.faiteLe) continue;
    if (!tache.domaine) {
      tachesSansDomaine += 1;
      continue;
    }
    brouillons.push({
      id: `odyssee.tache:${tache.id}`,
      type: 'odyssee.tache',
      domaine: tache.domaine,
      debut: midiDu(tache.faiteLe),
      source: 'manuel',
      fiabilite: 'confirme',
      details: {
        titre: tache.titre,
        /*
           « En retard » est calculé ici et conservé avec le fait : la
           comparer plus tard à l'échéance redonnerait le même résultat, mais
           une tâche dont l'échéance est modifiée après coup réécrirait son
           propre passé. Le fait dit ce qui était vrai à la clôture.
        */
        enRetard: tache.echeance !== null && tache.faiteLe > tache.echeance,
      },
    });
  }
  manques.push({
    quoi: 'Tâches closes sans domaine',
    combien: tachesSansDomaine,
    consequence: 'Elles ne comptent dans aucun domaine de la roue d’équilibre.',
  });

  /* --- Quêtes tenues : un fait par jour tenu ----------------------------- */
  for (const quete of quetes) {
    for (const jour of quete.tenues) {
      brouillons.push({
        id: `odyssee.quete:${quete.id}:${jour}`,
        type: 'odyssee.quete',
        domaine: quete.domaine,
        debut: midiDu(jour),
        source: 'manuel',
        fiabilite: 'confirme',
        details: { titre: quete.titre, cadence: quete.cadence },
      });
    }
  }

  /* --- Événements passés -------------------------------------------------- */
  const maintenant = (options.maintenant ?? new Date()).toISOString();
  let evenementsAVenir = 0;
  let evenementsNonFaits = 0;
  let evenementsNonReleves = 0;
  for (const evenement of evenements) {
    if (evenement.fin > maintenant) {
      evenementsAVenir += 1;
      continue;
    }
    /*
       Relevé « pas fait » : l'événement **n'a pas eu lieu**, et publier sa
       durée compterait un temps que personne n'a passé. Il sort donc des
       faits — tout en restant dans le suivi du plan tenu, qui est fait pour
       cela. C'est la différence entre « ce qui s'est passé » et « ce qui
       était prévu ».
    */
    if (evenement.realise === 'non-fait') {
      evenementsNonFaits += 1;
      continue;
    }
    if (evenement.realise === 'inconnu') evenementsNonReleves += 1;
    brouillons.push({
      id: `odyssee.evenement:${evenement.id}`,
      type: 'odyssee.evenement',
      domaine: evenement.domaine,
      debut: evenement.debut,
      fin: evenement.fin,
      valeur: dureeDeLEvenement(evenement),
      unite: 'secondes',
      source: evenement.uidIcs ? 'import' : 'manuel',
      /*
         La fiabilité vient du **relevé**, et c'est ce que le relevé a changé.

         Avant lui, un créneau d'agenda était toujours `estime` : il disait ce
         qui était prévu, et le marquer confirmé aurait fait passer un plan
         pour une observation. Maintenant que la personne peut répondre, un
         événement qu'elle déclare fait est une observation — `confirme` —, et
         seul ce qu'elle n'a pas relevé reste une supposition.

         « En partie » reste `estime` et garde sa durée entière : on sait que
         ce fut plus court, on ne sait pas de combien, et inventer une
         proportion serait pire que de l'avouer.
      */
      fiabilite: evenement.realise === 'fait' ? 'confirme' : 'estime',
      details: {
        titre: evenement.titre,
        journeeEntiere: evenement.journeeEntiere,
        realise: evenement.realise,
      },
    });
  }
  manques.push({
    quoi: 'Événements encore à venir',
    combien: evenementsAVenir,
    consequence: 'Ils ne sont pas publiés : un temps prévu n’est pas un temps vécu.',
  });
  manques.push({
    quoi: 'Moments prévus qui n’ont pas eu lieu',
    combien: evenementsNonFaits,
    consequence: 'Ils ne comptent dans aucune durée, mais pèsent dans le suivi du plan tenu.',
  });
  manques.push({
    quoi: 'Moments passés sans relevé',
    combien: evenementsNonReleves,
    consequence:
      'Leur durée est publiée comme estimée : nul ne sait encore s’ils ont eu lieu.',
  });

  /* --- Focus --------------------------------------------------------------
     Le domaine vient de la session. Le fait porte sa durée réelle, pas la
     durée visée — voir « modele.ts ».
  */
  for (const session of focus) {
    brouillons.push({
      id: `odyssee.focus:${session.id}`,
      type: 'odyssee.focus',
      domaine: session.domaine,
      debut: session.debut,
      fin: session.fin,
      valeur: session.secondes,
      unite: 'secondes',
      source: 'auto',
      fiabilite: 'confirme',
      details: { interrompue: session.interrompue, tacheId: session.tacheId },
    });
  }

  /* --- Revues -------------------------------------------------------------- */
  for (const revue of revues) {
    brouillons.push({
      id: `odyssee.revue:${revue.id}`,
      type: 'odyssee.revue',
      domaine: 'psyche',
      debut: midiDu(revue.jour),
      source: 'manuel',
      fiabilite: 'confirme',
      details: { type: revue.type, reponses: Object.keys(revue.reponses).length },
    });
  }

  /* --- Validation et tri --------------------------------------------------- */
  const faits: Fait[] = [];
  const refuses: Publication['refuses'] = [];
  for (const brouillon of brouillons) {
    const jour = jourLogique(new Date(brouillon.fin ?? brouillon.debut), reglages);
    if (options.de && jour < options.de) continue;
    if (options.a && jour > options.a) continue;
    const fait: Fait = {
      id: brouillon.id,
      branche: BRANCHE,
      proprietaire: BRANCHE,
      domaine: brouillon.domaine,
      type: brouillon.type,
      debut: brouillon.debut,
      fin: brouillon.fin,
      jourLogique: jour,
      valeur: brouillon.valeur,
      unite: brouillon.unite,
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
