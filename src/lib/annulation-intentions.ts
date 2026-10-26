/**
 * Les intentions d'actions annulables : les poser, les appliquer, les retirer.
 *
 * ## Pourquoi ce module est séparé de `annulation.ts`
 *
 * `annulation.ts` tient le BANDEAU : du DOM, un minuteur, un bouton. Celui-ci
 * tient la BASE et le registre des actions rejouables. Les séparer n'est pas
 * une élégance : le registre doit pouvoir être appliqué **au démarrage, avant
 * qu'aucun écran n'ait lu quoi que ce soit**, donc sans qu'un bandeau existe,
 * et sans que `chargement.ts` ait à importer du DOM de notification.
 *
 * ## Le registre, et pourquoi ses appliqueurs sont des imports DIFFÉRÉS
 *
 * Une intention doit être rejouable À FROID : au prochain démarrage, sur
 * n'importe quel écran. Elle ne peut donc pas porter la fermeture que l'écran
 * lui donnerait — une fonction ne se range pas dans IndexedDB. Elle porte un
 * GENRE, et le registre dit quoi faire de chaque genre.
 *
 * Si ce registre importait statiquement `supprimerSeance` et
 * `noterLeCreneau`, chaque écran du site — `/progression/`, l'export, la
 * synchronisation — embarquerait les chemins d'écriture de Sport et de Santé
 * pour un magasin presque toujours vide. Les appliqueurs sont donc des
 * `import()` différés : rien n'est chargé tant qu'aucune intention n'attend.
 *
 * ## Les trois règles de prudence, et ce qu'elles coûtent
 *
 * 1. **Une intention qu'on ne peut pas LIRE n'est jamais effacée.** Le
 *    magasin est scellé : coffre fermé, les enregistrements reviennent
 *    chiffrés. Les écarter comme « illisibles » perdrait l'action — exactement
 *    le défaut que ce module corrige. On les laisse, et on le dit.
 * 2. **Une intention dont le genre a disparu n'est pas effacée non plus.**
 *    Elle sera réessayée à chaque démarrage, ce qui est un encombrement d'un
 *    enregistrement ; l'effacer serait une perte silencieuse. On choisit
 *    l'erreur qui se rattrape.
 * 3. **Une application qui échoue laisse l'intention en place.** Une base
 *    pleine, un coffre refermé entre-temps : le prochain démarrage réessaiera.
 *    C'est la seule façon de ne pas transformer une panne passagère en perte.
 */
import { cleDuCoffre, coffreOuvert } from './coffre';
import { estFerme, ouvrir, sceller } from './noyau/coffre';
import {
  ecrireUneAnnulationEnAttente,
  effacerUneAnnulationEnAttente,
  lesAnnulationsEnAttente,
} from './db';
import {
  GENRES_D_INTENTION,
  GENRES_SENSIBLES,
  pourquoiNonRejouable,
  unIdentifiantDIntention,
  type AnnulationEnAttente,
  type GenreDIntention,
} from './noyau/annulation-en-attente';

/** Le nom du magasin, écrit une fois : le scellement s'y réfère par nom. */
const MAGASIN = 'annulationsEnAttente';

/** Ce qu'un appliqueur reçoit : la charge, telle qu'elle a été rangée. */
type Charge = Record<string, unknown>;

const texte = (charge: Charge, champ: string): string => {
  const valeur = charge[champ];
  if (typeof valeur !== 'string' || valeur.length === 0) {
    throw new Error(`l’intention n’a pas de « ${champ} »`);
  }
  return valeur;
};

/**
 * Ce qu'il faut faire, par genre. **La seule source de vérité de l'action.**
 *
 * L'écran ne passe plus de fermeture : il déclare une intention, et c'est
 * cette table qui agit — à l'échéance comme au démarrage. Deux chemins pour la
 * même action finiraient par diverger, et la divergence se verrait là où elle
 * coûte le plus : une suppression qui n'enlève pas la même chose selon qu'on
 * est resté sur l'écran ou non.
 */
const APPLIQUEURS: Record<GenreDIntention, (charge: Charge) => Promise<void>> = {
  'supprimer-seance': async (charge) => {
    const { supprimerSeance } = await import('./sport/donnees');
    await supprimerSeance(texte(charge, 'id'));
  },
  'noter-creneau': async (charge) => {
    const { noterLeCreneau, tousLesTraitements } = await import('./odyssee/donnees-sante');
    const traitementId = texte(charge, 'traitementId');
    const traitement = (await tousLesTraitements()).find((t) => t.id === traitementId);
    /*
       Le traitement a pu être supprimé pendant le délai, ou entre le geste et
       le démarrage suivant. On refuse, et l'intention reste : si le traitement
       revient — une restauration de sauvegarde —, la note se posera. Inventer
       un traitement pour « réussir » serait écrire une prise sur rien.
    */
    if (!traitement) throw new Error('le traitement visé n’existe plus');
    const etat = texte(charge, 'etat');
    if (etat !== 'pris' && etat !== 'pas-aujourdhui') {
      throw new Error(`l’état « ${etat} » n’est pas un état de créneau`);
    }
    const le = texte(charge, 'le');
    await noterLeCreneau(traitement, texte(charge, 'jour'), texte(charge, 'heure'), etat, {
      le: new Date(le),
      ...(typeof charge.quantite === 'string' ? { quantite: charge.quantite } : {}),
    });
  },
};

/** Les genres que le registre sait appliquer. Rapproché de la liste fermée. */
export const GENRES_APPLIQUES = Object.keys(APPLIQUEURS) as readonly GenreDIntention[];

/**
 * Pose une intention et rend son identifiant.
 *
 * **À ATTENDRE avant de laisser quitter l'écran.** C'est tout l'objet : au
 * moment où la personne change d'écran, l'intention doit être en base. Le
 * bandeau ne s'annonce prêt qu'après cette écriture.
 *
 * Coffre fermé, on refuse plutôt que d'écrire en clair : une intention non
 * scellée dirait « une prise a été notée » à qui lit la base sans mot de
 * passe.
 */
export async function poserUneIntention(
  genre: GenreDIntention,
  charge: Charge,
  echeanceLe: string,
): Promise<string> {
  /*
     SCELLÉE QUAND ON PEUT, REFUSÉE QUAND ON DOIT — ET LA MESURE A TRANCHÉ.

     Première écriture : toute intention exigeait le coffre. Mesuré sur
     « /sport/seance/ », où le coffre est FERMÉ : « Le coffre est fermé :
     l'intention ne peut pas être scellée », et donc aucune intention écrite,
     et donc le défaut intact. Exiger le scellement partout revenait à ne pas
     corriger le défaut que ce lot corrige.

     La frontière est celle que le dépôt pose déjà, magasin par magasin, et
     `noyau/annulation-en-attente.ts` la reprend genre par genre. Une
     intention sensible est refusée plutôt qu'écrite en clair ; les autres
     sont scellées si le coffre est ouvert, et écrites en clair sinon — ce qui
     ne révèle rien que le magasin visé ne révèle déjà.

     `ouvrir()` relit les deux formes : un enregistrement sans champ `scelle`
     est rendu tel quel. Le magasin peut donc porter un mélange, et c'est
     voulu.
  */
  const cle = coffreOuvert() ? cleDuCoffre() : null;
  if (!cle && GENRES_SENSIBLES.includes(genre)) {
    throw new Error(`Le coffre est fermé : l’intention « ${genre} » ne peut pas être scellée.`);
  }
  const maintenant = new Date().toISOString();
  const intention: Omit<AnnulationEnAttente, 'majLe'> = {
    id: unIdentifiantDIntention(),
    genre,
    charge,
    echeanceLe,
    le: maintenant,
  };
  const aRanger = cle
    ? ((await sceller(cle, MAGASIN, intention as unknown as Record<string, unknown>)) as unknown as Omit<
        AnnulationEnAttente,
        'majLe'
      >)
    : intention;
  await ecrireUneAnnulationEnAttente(aRanger);
  return intention.id;
}

/** Retire une intention : l'action est partie, ou la personne l'a annulée. */
export async function retirerUneIntention(id: string): Promise<void> {
  await effacerUneAnnulationEnAttente(id);
}

/** Applique une intention, par son genre. Jette si le genre est inconnu. */
export async function appliquerUneIntention(
  genre: GenreDIntention,
  charge: Charge,
): Promise<void> {
  const appliqueur = APPLIQUEURS[genre];
  if (!appliqueur) throw new Error(`aucun appliqueur pour le genre « ${genre} »`);
  await appliqueur(charge);
}

export interface RapportDApplication {
  /** Appliquées puis retirées. */
  appliquees: number;
  /** Laissées parce que le coffre est fermé. */
  scellees: number;
  /** Laissées, avec la raison : genre inconnu, forme abîmée, panne. */
  laissees: string[];
}

/**
 * Applique les intentions restées en base, puis les retire.
 *
 * Appelée **au démarrage, avant que l'écran ne lise**, depuis
 * `chargement.ts`. Les échéances non encore passées sont appliquées aussi, et
 * c'est le cœur de la promesse : quitter vaut exécuter. Historique, export et
 * synchronisation voient donc un état déjà appliqué, jamais un geste en
 * suspens.
 *
 * Ne jette jamais : le rapport dit ce qui s'est passé, et l'appelant décide
 * s'il le montre. Un écran ne doit pas refuser de s'afficher parce qu'une
 * intention vieille de trois jours résiste.
 */
export async function appliquerLesIntentionsEnAttente(): Promise<RapportDApplication> {
  const rapport: RapportDApplication = { appliquees: 0, scellees: 0, laissees: [] };
  let rangees: AnnulationEnAttente[];
  try {
    rangees = await lesAnnulationsEnAttente();
  } catch (erreur) {
    rapport.laissees.push(`le magasin n’a pas pu être lu : ${(erreur as Error)?.message ?? erreur}`);
    return rapport;
  }
  if (rangees.length === 0) return rapport;

  const cle = coffreOuvert() ? cleDuCoffre() : null;

  for (const rangee of rangees) {
    const brut = rangee as unknown as Record<string, unknown>;
    /*
       SCELLÉE ET SANS CLÉ : on la laisse, et on ne la compte pas comme un
       problème. C'est l'état normal d'un écran ouvert sans le coffre.
    */
    if (estFerme(brut) && !cle) {
      rapport.scellees += 1;
      continue;
    }
    let intention: AnnulationEnAttente;
    try {
      intention = estFerme(brut) && cle ? await ouvrir<AnnulationEnAttente>(cle, brut) : rangee;
    } catch (erreur) {
      rapport.laissees.push(
        `${rangee.id} : ne s’ouvre pas (${(erreur as Error)?.message ?? erreur})`,
      );
      continue;
    }
    const pourquoi = pourquoiNonRejouable(intention);
    if (pourquoi) {
      rapport.laissees.push(`${rangee.id} : ${pourquoi}`);
      continue;
    }
    try {
      await appliquerUneIntention(intention.genre, (intention.charge ?? {}) as Charge);
      await retirerUneIntention(intention.id);
      rapport.appliquees += 1;
    } catch (erreur) {
      /* Laissée exprès : le prochain démarrage réessaiera. */
      rapport.laissees.push(
        `${rangee.id} : n’a pas pu être appliquée (${(erreur as Error)?.message ?? erreur})`,
      );
    }
  }
  return rapport;
}

/** Pour les essais : la liste fermée des genres, telle que le noyau la pose. */
export { GENRES_D_INTENTION };
