/**
 * Lire et écrire chaque réglage — **par les fonctions qui existent déjà**.
 *
 * C'est l'interdit n° 2 du prompt 42, et c'est tout l'objet de ce fichier :
 * la page centrale n'écrit jamais une clé elle-même. Elle appelle `ecrire`,
 * qui appelle la fonction de la branche, laquelle tamponne son horloge,
 * notifie ses abonnés et fait tout ce qu'elle faisait déjà depuis l'écran
 * d'origine. Un réglage changé ici produit donc exactement le même effet
 * qu'ailleurs — et l'essai d'égalité le vérifie.
 *
 * Les réglages de nature « ailleurs » n'ont pas d'entrée : ils se règlent
 * sur leur écran, et la page centrale n'en montre que le chemin.
 */
import { delaiDuVerrouAutomatique, modeDuCoffre, oublierLAppareil, reglerLeDelaiDuVerrou } from '../coffre';
import {
  ecrireReglagesPlanification,
  ecrireReglagesSession,
  lireReglagesPlanification,
  lireReglagesSession,
} from '../db';
import {
  ecrireReglagesContenu,
  ecrireReglagesNiveau,
  lireReglagesContenu,
  lireReglagesNiveau,
  type ReglagesContenu,
  type ReglagesNiveau,
} from '../niveau';
import { reglerLaRetention, retentionReglee } from '../notifications/retention';
import { reglerSerieEtXp, serieEtXpAffichees } from '../serie-xp';
import { activerLaSante, santeActive } from '../odyssee/donnees-sante';
import { presentationReglee, reglerLaPresentation } from '../presentation-dgfip';
import { champ, ecrireChamp, supprimerChamp } from '../profil';
import {
  ecrireBascule,
  ecrireChoixDeMode,
  ecrireHeuresDeBascule,
  ecrirePalette,
  heuresDeBascule,
  heuresReglees,
  lireBascule,
  lireChoixDeMode,
  lirePalette,
  oublierLesHeures,
  type Choix,
} from '../theme';
import { CLE_VITESSE, VITESSE_PAR_DEFAUT, VITESSES } from '../podcast-noyau';
import type { Acces } from './modele';

/* ── Deux réglages locaux, lus par la séance de sport ────────────────────── */

export const CLE_THEME_SEANCE = 'revinsp.theme-seance';
export const CLE_ECRAN_ALLUME = 'revinsp.ecran-allume';
const CLE_ANIMATIONS = 'revinsp.animations';
const CLE_LATERALE = 'revinsp.laterale';
const CLE_VUE_FICHE = 'revinsp.vue-fiche';
const CLE_TUTORIELS = 'revinsp:rr:tutoriels';

const lireLocal = (cle: string): string | null => {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
};
const ecrireLocal = (cle: string, valeur: string) => {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* navigation privée : le réglage ne vaudra que pour cette page */
  }
};

/** Un champ booléen d'une forme `Reglages…`, lue et réécrite en entier. */
const champBooleen = <T extends object>(
  lireTout: () => Promise<T>,
  ecrireTout: (valeur: T) => Promise<void>,
  nom: keyof T,
): Acces => ({
  lire: async () => (await lireTout())[nom] as unknown,
  ecrire: async (valeur) => {
    const actuels = await lireTout();
    await ecrireTout({ ...actuels, [nom]: Boolean(valeur) });
  },
});

/**
 * Un champ de profil, lu et écrit par les fonctions du profil.
 *
 * ## Le faux défaut, et pourquoi il est parti (P10 du prompt 56)
 *
 * Cette fonction prenait un `defaut` et le rendait quand le champ était vide :
 * « Ma journée » affichait donc 07:00 et 21:00 comme si ces heures avaient été
 * choisies, là où « Mon profil » disait « non renseigné » pour le même champ.
 * Deux écrans, une donnée, deux réponses. Le défaut n'est pas rendu ici : la
 * valeur vide est rendue vide, et la phrase `siVide` du catalogue dit ce que
 * Cyclades fait à défaut de réponse.
 *
 * ## Vider, c'est retirer sa réponse
 *
 * Et non écrire une heure d'usine. Le bouton « Rétablir » de la page centrale
 * écrit le défaut déclaré : pour ces champs, le défaut déclaré est le vide, et
 * le vide **supprime le champ**. Sans cela, « Rétablir » aurait inscrit 7 h au
 * journal — une réponse que personne n'a donnée, qui part vers les autres
 * appareils et que l'export compte comme déclarée.
 */
const champDeProfil = (nom: string, defaut = ''): Acces => ({
  lire: async () => ((await champ(nom))?.valeur as string | undefined) ?? defaut,
  ecrire: async (v) => {
    const valeur = String(v ?? '').trim();
    if (!valeur) {
      await supprimerChamp(nom);
      return;
    }
    await ecrireChamp(nom, valeur);
  },
});

export const ACCES: Record<string, Acces> = {
  /* Affichage */
  theme: { lire: async () => lirePalette(), ecrire: async (v) => ecrirePalette(String(v)) },
  'bascule-jour-nuit': {
    lire: async () => lireBascule(),
    ecrire: async (v) => ecrireBascule(Boolean(v)),
  },
  /*
     « SUIVRE MA JOURNÉE » EST L'ABSENCE DE RÉGLAGE, et c'est ce qui permet de
     ne pas toucher au script d'avant-peinture de `Base.astro` : il lit déjà la
     clé locale, puis le miroir du profil. Vide ici veut dire « rien sur cet
     appareil », donc « Ma journée ». La lecture rend donc la copie locale
     seule, et non la valeur appliquée — sinon le champ afficherait l'heure de
     « Ma journée » comme si elle avait été réglée ici.

     Donner une heure fixe les deux : la clé en porte deux, séparées par une
     barre, et il n'y a pas de demi-réglage. Le catalogue le dit en une phrase
     plutôt que de le laisser découvrir.
  */
  'heure-clair': {
    lire: async () => heuresReglees()?.lever ?? '',
    ecrire: async (v) => {
      const lever = String(v ?? '').trim();
      if (!lever) return oublierLesHeures();
      ecrireHeuresDeBascule(lever, heuresReglees()?.coucher ?? heuresDeBascule().coucher);
    },
  },
  'heure-sombre': {
    lire: async () => heuresReglees()?.coucher ?? '',
    ecrire: async (v) => {
      const coucher = String(v ?? '').trim();
      if (!coucher) return oublierLesHeures();
      ecrireHeuresDeBascule(heuresReglees()?.lever ?? heuresDeBascule().lever, coucher);
    },
  },
  mode: {
    lire: async () => lireChoixDeMode(),
    ecrire: async (v) => ecrireChoixDeMode(v as Choix),
  },
  animations: {
    lire: async () => lireLocal(CLE_ANIMATIONS) === 'reduites',
    ecrire: async (v) => {
      const valeur = v ? 'reduites' : 'completes';
      ecrireLocal(CLE_ANIMATIONS, valeur);
      /* Le même geste que l'écran d'origine : l'attribut, tout de suite,
         sinon le réglage ne prendrait qu'à la page suivante. */
      document.documentElement.setAttribute('data-animations', valeur);
    },
  },
  laterale: {
    lire: async () => lireLocal(CLE_LATERALE) === 'rail',
    ecrire: async (v) => {
      /*
         Deux valeurs écrites, et JAMAIS la clé retirée : « rail » ou
         « deplie ». Mon premier jet retirait la clé pour dire « déplié »,
         ce qui faisait DEUX façons de dire la même chose — l'absence et le
         mot — et la seconde n'aurait pas survécu au premier qui l'oublie.
      */
      const valeur = v ? 'rail' : 'deplie';
      ecrireLocal(CLE_LATERALE, valeur);
      /* Le même geste que le bouton de la barre : l'attribut tout de suite,
         sinon le réglage ne prendrait qu'à la page suivante. */
      if (v) document.documentElement.setAttribute('data-laterale', 'rail');
      else document.documentElement.removeAttribute('data-laterale');
    },
  },
  'serie-xp': {
    lire: async () => serieEtXpAffichees(),
    ecrire: async (v) => reglerSerieEtXp(Boolean(v)),
  },
  'vue-fiche': {
    lire: async () => lireLocal(CLE_VUE_FICHE) === 'continue',
    ecrire: async (v) => ecrireLocal(CLE_VUE_FICHE, v ? 'continue' : 'sections'),
  },
  'vitesse-ecoute': {
    /*
       La valeur est relue contre la liste : une clé abîmée à la main, ou
       laissée par une version qui proposait une autre échelle, ferait sinon
       lire une vitesse que le lecteur refuserait.
    */
    lire: async () => {
      const brut = Number(lireLocal(CLE_VITESSE));
      const connue = VITESSES.includes(brut as (typeof VITESSES)[number]);
      return String(connue ? brut : VITESSE_PAR_DEFAUT);
    },
    ecrire: async (v) => ecrireLocal(CLE_VITESSE, String(v)),
  },

  /* Ma journée */
  lever: champDeProfil('lever'),
  coucher: champDeProfil('coucher'),
  'moment-revue': champDeProfil('moment-revue', 'soir'),

  /* Coffre */
  'delai-verrou': {
    lire: async () => Math.round((await delaiDuVerrouAutomatique()) / 60_000),
    ecrire: async (v) => reglerLeDelaiDuVerrou(Number(v) * 60_000),
  },
  'memorisation-coffre': {
    lire: async () => modeDuCoffre() === 'appareil',
    /*
       UN RÉGLAGE QU'ON NE PEUT QU'ÉTEINDRE, et il faut le dire.

       L'enveloppe de l'appareil se fabrique en chiffrant la clé du coffre :
       elle exige le mot de passe, qu'une page de réglages ne redemande pas.
       On peut l'oublier — `oublierLAppareil`, qui referme aussi le coffre —
       mais pas la créer. L'interrupteur refuse donc d'être rallumé, et
       l'écran dit pourquoi au lieu de faire semblant. C'est un constat de
       l'inventaire, signalé au pilote plutôt que corrigé en douce.
    */
    ecrire: async (v) => {
      if (v) throw new Error('À cocher au moment d’ouvrir le coffre : le mot de passe y est nécessaire.');
      oublierLAppareil();
    },
  },

  /* Notifications */
  'retention-archiver': {
    lire: async () => retentionReglee().archiverApres,
    ecrire: async (v) =>
      void reglerLaRetention({ ...retentionReglee(), archiverApres: Number(v) }),
  },
  'retention-supprimer': {
    lire: async () => retentionReglee().supprimerApres,
    ecrire: async (v) =>
      void reglerLaRetention({ ...retentionReglee(), supprimerApres: Number(v) }),
  },

  /* Révisions */
  ...Object.fromEntries(
    (['quiz', 'flashcards', 'rappels', 'dgfip', 'pretest'] as (keyof ReglagesNiveau)[]).map(
      (nom) => [
        `niveau-${nom}`,
        champBooleen(lireReglagesNiveau, ecrireReglagesNiveau, nom),
      ],
    ),
  ),
  ...Object.fromEntries(
    (['casPratique', 'methodologie', 'reviserMethodologie'] as (keyof ReglagesContenu)[]).map(
      (nom) => [
        `contenu-${nom}`,
        champBooleen(lireReglagesContenu, ecrireReglagesContenu, nom),
      ],
    ),
  ),
  'decouper-par-parties': {
    lire: async () => (await lireReglagesPlanification())?.decouperParParties ?? false,
    ecrire: async (v) =>
      ecrireReglagesPlanification({
        trimestreEcarte: null,
        ...((await lireReglagesPlanification()) ?? {}),
        decouperParParties: Boolean(v),
      }),
  },
  'compte-a-rebours': champBooleen(
    lireReglagesSession,
    ecrireReglagesSession,
    'compteARebours',
  ),
  'plafond-cartes': {
    lire: async () => (await lireReglagesSession()).plafondCartes,
    ecrire: async (v) =>
      ecrireReglagesSession({ ...(await lireReglagesSession()), plafondCartes: Number(v) }),
  },
  'plafond-questions': {
    lire: async () => (await lireReglagesSession()).plafondQuestions,
    ecrire: async (v) =>
      ecrireReglagesSession({ ...(await lireReglagesSession()), plafondQuestions: Number(v) }),
  },
  /*
     La présentation de l'épreuve DGFiP. Une préférence d'affichage, donc
     locale à l'appareil : elle n'a rien à faire dans la sauvegarde ni dans
     l'export pour une IA.
  */
  'presentation-dgfip': {
    lire: async () => presentationReglee(),
    ecrire: async (v) =>
      reglerLaPresentation(v === 'une-a-la-fois' ? 'une-a-la-fois' : 'copie'),
  },

  /* Odyssée */
  'sante-active': {
    lire: async () => santeActive(),
    ecrire: async (v) => activerLaSante(Boolean(v)),
  },

  /*
     Sport. Les deux interrupteurs sont écrits à plat, sans fabrique : une
     fabrique les aurait cachés à l'inventaire mécanique, qui remonte les
     enveloppes d'un seul niveau. Un réglage que l'inventaire ne voit pas est
     un réglage que l'essai des orphelins ne protège plus.
  */
  'theme-seance': {
    lire: async () => lireLocal(CLE_THEME_SEANCE) !== 'non',
    ecrire: async (v) => ecrireLocal(CLE_THEME_SEANCE, v ? 'oui' : 'non'),
  },
  'ecran-allume': {
    lire: async () => lireLocal(CLE_ECRAN_ALLUME) !== 'non',
    ecrire: async (v) => ecrireLocal(CLE_ECRAN_ALLUME, v ? 'oui' : 'non'),
  },

  /* Entraînement cognitif */
  'rr-tutoriels': {
    lire: async () => lireLocal(CLE_TUTORIELS) !== 'non',
    ecrire: async (v) => ecrireLocal(CLE_TUTORIELS, v ? 'oui' : 'non'),
  },
};

/** Les deux réglages de séance, lus par l'écran de séance. */
export const themeDeSeanceVoulu = (): boolean => lireLocal(CLE_THEME_SEANCE) !== 'non';
export const ecranAllumeVoulu = (): boolean => lireLocal(CLE_ECRAN_ALLUME) !== 'non';
