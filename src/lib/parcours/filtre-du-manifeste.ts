/**
 * Le manifeste vu depuis un parcours.
 *
 * ## Pourquoi ce filtre existe
 *
 * Le build range chaque fiche sous une racine de contenu et inscrit au
 * manifeste les parcours qu'elle sert — `racine` et `parcoursServis`, dérivés
 * du registre. Jusqu'ici, **rien ne lisait ces champs** : `build-content.mjs`
 * le disait en toutes lettres, « le manifeste les PORTE ; rien ne les filtre
 * encore ». La conséquence se voyait à l'écran : les fiches d'« Organisation de
 * la DGFiP », rangées sous la racine commune des trois parcours DGFiP,
 * apparaissaient aussi dans l'arbre de l'INSP, qui ne les sert pas.
 *
 * Le filtre vit donc là où le manifeste se charge, et non dans chaque écran :
 * `chargerManifeste` l'applique une fois pour toutes. Quatorze fichiers
 * l'appellent — bibliothèque, séance, quiz, cartes, positionnement,
 * statistiques, indicateurs, niveau. Un filtre posé écran par écran aurait été
 * oublié par le quinzième.
 *
 * ## Ce que « ne pas savoir » doit produire
 *
 * Les deux champs sont facultatifs, parce qu'un manifeste publié avant le
 * partage des matières ne les porte pas. Une fiche sans `parcoursServis` est
 * donc **gardée**, et non écartée : un manifeste ancien doit continuer de
 * remplir une bibliothèque, pas la vider. C'est le même choix que partout
 * ailleurs dans le produit — l'absence d'information n'est pas une
 * information. En dernier recours, `racine` seule suffit : le registre sait en
 * dériver les parcours servis.
 *
 * ## Les totaux suivent, sinon ils mentent
 *
 * `totaux.fiches` est lu par les statistiques et par l'estimation de niveau.
 * Un manifeste filtré qui garderait les totaux d'origine annoncerait « 427
 * fiches » à qui n'en voit que quatre, et le compte de progression se
 * calculerait sur un dénominateur faux. Les totaux sont donc recalculés sur ce
 * qui reste. Ceux qui ne dépendent pas des fiches — glossaire, banque de QCM —
 * sont inchangés : ils ne sont pas rangés par parcours.
 */
import type { Manifeste, Matiere, FicheResume } from '../contenu';
import { parcoursServisParLaRacine } from './registre';

/**
 * La fiche est-elle servie à ce parcours ?
 *
 * Trois cas, dans cet ordre : la liste est là et tranche ; sinon la racine est
 * là et le registre tranche ; sinon on ne sait pas, et on garde.
 */
export function ficheServieAu(fiche: FicheResume, idParcours: string): boolean {
  if (Array.isArray(fiche.parcoursServis) && fiche.parcoursServis.length > 0) {
    return fiche.parcoursServis.includes(idParcours);
  }
  if (typeof fiche.racine === 'string') {
    return parcoursServisParLaRacine(fiche.racine).includes(idParcours);
  }
  return true;
}

/**
 * Le manifeste réduit aux fiches servies à ce parcours.
 *
 * Les fascicules et les matières laissés vides disparaissent : un fascicule
 * sans fiche s'afficherait comme un dossier qu'on ouvre sur rien.
 */
export function manifestePourLeParcours(manifeste: Manifeste, idParcours: string): Manifeste {
  const matieres: Matiere[] = [];
  let fiches = 0;
  let flashcards = 0;
  let quiz = 0;
  let podcasts = 0;

  for (const matiere of manifeste.matieres ?? []) {
    const fascicules = [];
    for (const fascicule of matiere.fascicules ?? []) {
      const retenues = (fascicule.fiches ?? []).filter((f) => ficheServieAu(f, idParcours));
      if (retenues.length === 0) continue;
      for (const f of retenues) {
        fiches += 1;
        flashcards += f.nbFlashcards ?? 0;
        quiz += f.nbQuiz ?? 0;
        if (f.aPodcast) podcasts += 1;
      }
      fascicules.push({ ...fascicule, fiches: retenues });
    }
    if (fascicules.length === 0) continue;
    matieres.push({ ...matiere, fascicules });
  }

  return {
    ...manifeste,
    matieres,
    totaux: {
      ...manifeste.totaux,
      fiches,
      flashcards,
      quiz,
      ...(manifeste.totaux?.podcasts === undefined ? {} : { podcasts }),
    },
  };
}
