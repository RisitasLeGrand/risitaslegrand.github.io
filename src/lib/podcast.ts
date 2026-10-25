/**
 * Lecteur de fiche audio.
 *
 * Le fichier audio est publié chiffré, comme le reste du contenu. Il n'est
 * récupéré et déchiffré qu'au moment où on demande à l'écouter : une fiche
 * audio pèse quelques mégaoctets, les charger à l'ouverture de chaque page
 * alourdirait la navigation pour rien.
 *
 * Le son déchiffré ne quitte jamais la mémoire de l'onglet : il devient un
 * Blob, dont l'URL locale alimente un lecteur HTML natif.
 *
 * ## Les parties (prompt 46, P3, et prompt 55, N°13)
 *
 * Une fiche longue se découpe en parties, dont la synthèse a noté la seconde
 * de début (P2). Le lecteur s'en sert pour trois choses : une liste sous le
 * lecteur où l'on saute d'un appui, un bouton « Écouter à partir d'ici » sur
 * chaque titre du cours, et les commandes « partie précédente / suivante »
 * de l'écran verrouillé. Une fiche audio sans repères n'a aucune de ces
 * trois choses et s'écoute d'un bloc, exactement comme avant.
 *
 * ## Ce que l'écran verrouillé ne dit pas, et c'est délibéré
 *
 * Les commandes de l'écran verrouillé passent par Media Session, qui affiche
 * ce qu'on lui donne — sur l'écran d'un téléphone posé sur une table, à la
 * vue de n'importe qui. On ne lui donne donc **qu'un titre neutre**, le même
 * pour toutes les fiches. Pas de titre de cours, pas de matière, pas
 * d'illustration : c'est le principe de discrétion, et il ne souffre pas
 * d'exception « juste pour le confort ».
 */
import { chargerBinaire, type Fiche } from './contenu';
import { ecrirePositionPodcast, lirePositionPodcast, supprimerPositionPodcast } from './db';
import {
  CLE_VITESSE,
  horodatage,
  horodatageParle,
  partieCourante,
  partiesEcoutables,
  VITESSE_PAR_DEFAUT,
  VITESSES,
  type PartieEcoutable,
} from './podcast-noyau';
import { formaterDuree } from './ui';

/**
 * L'ANCIENNE clé de position, dans `localStorage`.
 *
 * Elle n'est plus écrite : la position vit désormais dans le magasin
 * `podcastPositions`, donc dans la synchronisation et dans la sauvegarde.
 * Elle est encore **lue**, une fois, pour reprendre ce qu'elle contenait,
 * puis retirée. Le jour où plus aucune installation ne la porte, ces
 * quelques lignes partiront ; d'ici là, les retirer perdrait la reprise de
 * quelqu'un.
 */
const CLE_POSITION_ANCIENNE = 'revinsp.podcast.position';

/*
   Ce qui se calcule sans écran vit dans `podcast-noyau.ts`, sans aucune
   dépendance : la page des réglages et un essai dans Node le lisent, et ni
   l'une ni l'autre ne peut importer ce module-ci, qui touche le DOM et la
   base. Réexporté ici pour que les pages n'aient qu'une porte d'entrée.
*/
export {
  horodatage,
  horodatageParle,
  partieCourante,
  partiesEcoutables,
  CLE_VITESSE,
  VITESSE_PAR_DEFAUT,
  VITESSES,
  type PartieEcoutable,
} from './podcast-noyau';

/**
 * Au retour, on recule de trois secondes pour retrouver le fil (P3).
 * Reprendre pile où l'on s'est arrêté tombe au milieu d'un mot ; trois
 * secondes suffisent à rattraper le début de la phrase.
 */
const RECUL_REPRISE_S = 3;

/** Sauts avant et arrière du lecteur sans écran (prompt 55, N°13). */
const SAUT_S = 15;

/** En dessous, l'écoute n'a pas vraiment commencé : rien à reprendre. */
const PLANCHER_REPRISE_S = 15;

/** Une seule URL d'objet vivante à la fois : les libérer évite de retenir le son. */
let urlCourante: string | null = null;

function liberer() {
  if (urlCourante) {
    URL.revokeObjectURL(urlCourante);
    urlCourante = null;
  }
}

/** « 12 min · 1,5 Mo », pour annoncer le téléchargement avant de le lancer. */
function calibre(podcast: { secondes: number | null; octets: number }): string {
  const megaoctets = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(podcast.octets / 1024 / 1024);
  const poids = `${megaoctets} Mo`;
  if (!podcast.secondes) return poids;
  return `${formaterDuree(podcast.secondes)} · ${poids}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   La vitesse de diction
   ══════════════════════════════════════════════════════════════════════════ */

export function lireVitesse(): number {
  try {
    const brut = Number(localStorage.getItem(CLE_VITESSE));
    return VITESSES.includes(brut as (typeof VITESSES)[number]) ? brut : VITESSE_PAR_DEFAUT;
  } catch {
    return VITESSE_PAR_DEFAUT;
  }
}

function ecrireVitesse(vitesse: number) {
  try {
    localStorage.setItem(CLE_VITESSE, String(vitesse));
  } catch {
    /* navigation privée : la vitesse ne vaudra que pour cette page */
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   La reprise de l'ancienne clé
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Reprend les positions laissées dans `localStorage`, puis retire la clé.
 *
 * En une fois et pour toutes les fiches, et non fiche par fiche : l'ancienne
 * clé portait une table complète, et ne reprendre que la fiche ouverte aurait
 * perdu les autres au moment où la clé disparaît.
 *
 * Une position déjà présente dans le magasin **n'est pas écrasée**. Elle peut
 * venir d'un autre appareil par synchronisation, et elle est alors plus
 * récente que ce résidu local : l'écraser ferait reculer la reprise.
 */
async function reprendreAnciennesPositions(): Promise<void> {
  let table: Record<string, number>;
  try {
    const brut = localStorage.getItem(CLE_POSITION_ANCIENNE);
    if (!brut) return;
    table = JSON.parse(brut) as Record<string, number>;
  } catch {
    /* illisible, ou navigation privée : il n'y a rien à reprendre */
    return;
  }

  try {
    for (const [fiche, secondes] of Object.entries(table)) {
      if (typeof secondes !== 'number' || !Number.isFinite(secondes)) continue;
      if (secondes < PLANCHER_REPRISE_S) continue;
      if (await lirePositionPodcast(fiche)) continue;
      await ecrirePositionPodcast(
        { fiche, secondes: Math.floor(secondes), duree: null, majLe: new Date().toISOString() },
        { journaliser: true },
      );
    }
    /*
       La clé ne part qu'une fois les écritures passées : si l'une échoue, la
       reprise sera retentée à la prochaine ouverture plutôt que perdue.
    */
    localStorage.removeItem(CLE_POSITION_ANCIENNE);
  } catch {
    /* la base est indisponible : on retentera, et la clé reste */
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Le lecteur
   ══════════════════════════════════════════════════════════════════════════ */

/** Ce que la page de la fiche peut demander au lecteur une fois installé. */
export interface LecteurPodcast {
  /** Charge l'audio s'il le faut, puis saute au repère de cette partie. */
  ecouterDepuis(partieId: string): Promise<void>;
  /** Les parties atteignables, pour poser les boutons du cours écrit. */
  parties: PartieEcoutable[];
}

/**
 * Installe le lecteur dans la page d'une fiche.
 * Sans fiche audio, la section indique que le podcast n'existe pas encore —
 * plutôt qu'un lecteur vide qui semblerait cassé.
 */
export function installerLecteurPodcast(fiche: Fiche): LecteurPodcast | null {
  const section = document.getElementById('podcast');
  const bouton = document.getElementById('podcast-bouton') as HTMLButtonElement | null;
  const info = document.getElementById('podcast-info');
  const lecteur = document.getElementById('podcast-lecteur') as HTMLAudioElement | null;
  /*
     LE LIBELLÉ EST UN ÉLÉMENT À PART, et l'icône n'est plus dans le texte.

     Le bouton portait « ▶ Écouter la fiche » en une seule chaîne, réécrite
     quatre fois ici — dont une en « Déchiffrement… », qui emportait le
     triangle avec elle. Le triangle appartient au bouton, pas au message :
     il est maintenant posé par le gabarit, en SVG, et ne bouge plus. Ce
     module n'écrit que les mots.
  */
  const libelle = document.getElementById('podcast-libelle');
  if (!section || !bouton || !info || !lecteur || !libelle) return null;

  const zoneParties = document.getElementById('podcast-parties');
  const reste = document.getElementById('podcast-reste');
  const commandes = document.getElementById('podcast-commandes');
  const choixVitesse = document.getElementById('podcast-vitesse') as HTMLSelectElement | null;

  liberer();
  section.classList.remove('hidden');

  if (!fiche.podcast) {
    bouton.classList.add('hidden');
    info.textContent = 'Fiche audio pas encore disponible pour cette fiche.';
    return null;
  }

  // Le format publié est choisi au build : si ce navigateur ne sait pas le
  // lire, mieux vaut le dire que de laisser un bouton qui ne fera rien.
  if (lecteur.canPlayType(fiche.podcast.type) === '') {
    bouton.classList.add('hidden');
    info.textContent =
      'Ce navigateur ne sait pas lire le format audio publié. ' +
      'Republiez le site avec « format: \'mp3\' » dans site.config.mjs.';
    return null;
  }

  const parties = partiesEcoutables(fiche);
  info.textContent = calibre(fiche.podcast);

  /*
     La position connue, relue une seule fois à l'installation. Elle sert au
     libellé du bouton et au premier saut ; ensuite c'est le lecteur qui fait
     foi, et la relire reviendrait à se fier à une valeur qu'on vient
     d'écrire soi-même.
  */
  let repriseA = 0;
  let charge = false;
  let rangAffiche = -2;

  /* ── L'écriture de la position ───────────────────────────────────────── */

  /**
   * Enregistre où l'on en est.
   *
   * `journaliser` dit si l'écriture doit VOYAGER. Au fil de l'eau, non : une
   * opération de synchronisation toutes les cinq secondes ferait des
   * centaines d'opérations indédoublonnables par fiche. Aux moments où
   * l'écoute s'arrête — pause, arrière-plan, fermeture —, oui : c'est
   * précisément la position dont un autre appareil a besoin.
   */
  function enregistrer(journaliser: boolean) {
    const secondes = lecteur!.currentTime;
    const duree = Number.isFinite(lecteur!.duration) ? lecteur!.duration : null;
    if (secondes < PLANCHER_REPRISE_S) {
      void supprimerPositionPodcast(fiche.id).catch(() => {
        /* rien à retirer, ou base indisponible */
      });
      return;
    }
    void ecrirePositionPodcast(
      { fiche: fiche.id, secondes: Math.floor(secondes), duree, majLe: new Date().toISOString() },
      { journaliser },
    ).catch(() => {
      /* base indisponible : la position suivante réessaiera */
    });
  }

  /* ── La liste des parties ────────────────────────────────────────────── */

  function majPartieEnCours() {
    if (!zoneParties || !parties.length) return;
    const rang = partieCourante(parties, lecteur!.currentTime);
    if (rang === rangAffiche) return;
    rangAffiche = rang;
    const lignes = zoneParties.querySelectorAll<HTMLButtonElement>('[data-partie]');
    lignes.forEach((ligne, i) => {
      const enCours = i === rang;
      ligne.classList.toggle('font-semibold', enCours);
      ligne.classList.toggle('text-indigo-700', enCours);
      ligne.classList.toggle('dark:text-indigo-300', enCours);
      ligne.classList.toggle('bg-indigo-50', enCours);
      ligne.classList.toggle('dark:bg-indigo-950', enCours);
      /*
         « aria-current » et non une simple couleur : la mise en évidence doit
         s'entendre au lecteur d'écran, pas seulement se voir.
      */
      /*
         `aria-current` vaut « true » et non « location » : les deux sont
         admis, mais « true » est celui que VoiceOver et TalkBack annoncent
         le plus uniformément — « actuel » plutôt qu'un silence.
      */
      if (enCours) ligne.setAttribute('aria-current', 'true');
      else ligne.removeAttribute('aria-current');
    });
  }

  function poserListeDesParties() {
    if (!zoneParties || !parties.length) return;
    zoneParties.replaceChildren();
    const liste = document.createElement('ul');
    /* M9 — la liste se nomme : « liste de 3 éléments » ne dit pas de quoi. */
    liste.setAttribute('aria-label', 'Parties de la fiche audio');
    liste.className = 'mt-3 space-y-0.5';
    for (const partie of parties) {
      const item = document.createElement('li');
      const ligne = document.createElement('button');
      ligne.type = 'button';
      ligne.dataset.partie = partie.id;
      /*
         M9 — LE NOM ACCESSIBLE DIT L'HEURE EN MOTS.

         Le texte visible est « 4:12 » suivi du titre : à l'œil, c'est le
         repère qu'on attend d'un lecteur audio. À l'oreille, « 4:12 » se dit
         « quatre deux-points douze », ou « quatre cent douze ». Le nom
         accessible porte donc le geste et l'heure en français, et le visible
         garde sa forme courte.
      */
      ligne.setAttribute(
        'aria-label',
        `Écouter « ${partie.titre} », à ${horodatageParle(partie.debut)}`,
      );
      ligne.className =
        'flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm ' +
        'text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';
      const heure = document.createElement('span');
      heure.className = 'shrink-0 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400';
      heure.textContent = horodatage(partie.debut);
      const titre = document.createElement('span');
      titre.textContent = partie.titre;
      ligne.append(heure, titre);
      ligne.addEventListener('click', () => void ecouterDepuis(partie.id));
      item.appendChild(ligne);
      liste.appendChild(item);
    }
    const intitule = document.createElement('p');
    intitule.className = 'etiquette mt-3 text-slate-500 dark:text-slate-400';
    intitule.textContent = 'Parties';
    zoneParties.append(intitule, liste);
    zoneParties.classList.remove('hidden');
  }

  /* ── Le temps qui reste ──────────────────────────────────────────────── */

  function majReste() {
    if (!reste) return;
    const duree = lecteur!.duration;
    if (!Number.isFinite(duree) || duree <= 0) {
      reste.textContent = '';
      return;
    }
    const restant = Math.max(0, duree - lecteur!.currentTime);
    reste.textContent = restant < 1 ? 'Écoute terminée' : `reste ${formaterDuree(restant)}`;
  }

  /* ── L'écran verrouillé ──────────────────────────────────────────────── */

  function sauterDePartie(sens: -1 | 1) {
    if (!parties.length) {
      lecteur!.currentTime = Math.max(0, lecteur!.currentTime + sens * SAUT_S);
      return;
    }
    const rang = partieCourante(parties, lecteur!.currentTime);
    /*
       Reculer au début de la partie en cours quand on y est entré depuis
       plus de trois secondes : c'est ce que fait tout lecteur de podcast, et
       c'est ce qu'on attend d'un bouton « précédent » quand on vient de
       manquer le début d'un passage.
    */
    if (sens === -1 && rang >= 0 && lecteur!.currentTime - parties[rang].debut > RECUL_REPRISE_S) {
      lecteur!.currentTime = parties[rang].debut;
      return;
    }
    const vise = rang + sens;
    if (vise < 0) lecteur!.currentTime = 0;
    else if (vise < parties.length) lecteur!.currentTime = parties[vise].debut;
  }

  function poserEcranVerrouille() {
    const session = navigator.mediaSession;
    if (!session) return;
    try {
      if (typeof MediaMetadata !== 'undefined') {
        /*
           UN SEUL CHAMP, ET LE MÊME POUR TOUTES LES FICHES.

           Ni `artist`, ni `album`, ni `artwork` : chacun s'afficherait sur
           l'écran verrouillé, et « Droit public — la hiérarchie des normes »
           sur un téléphone posé sur une table dit à la pièce entière ce que
           son propriétaire révise. Le titre de la fiche est déjà dans la
           page ; il n'a rien à faire ici.
        */
        session.metadata = new MediaMetadata({ title: 'Cyclades — fiche audio' });
      }
      session.setActionHandler('play', () => void lecteur!.play().catch(() => {}));
      session.setActionHandler('pause', () => lecteur!.pause());
      session.setActionHandler('seekbackward', () => {
        lecteur!.currentTime = Math.max(0, lecteur!.currentTime - SAUT_S);
      });
      session.setActionHandler('seekforward', () => {
        lecteur!.currentTime = Math.min(lecteur!.duration || Infinity, lecteur!.currentTime + SAUT_S);
      });
      session.setActionHandler('previoustrack', () => sauterDePartie(-1));
      session.setActionHandler('nexttrack', () => sauterDePartie(1));
    } catch {
      /* un navigateur qui ne connaît pas une action la refuse : tant pis pour elle */
    }
  }

  /* ── Le chargement ───────────────────────────────────────────────────── */

  async function charger(): Promise<void> {
    if (charge) return;
    bouton!.disabled = true;
    libelle!.textContent = 'Déchiffrement…';
    try {
      const octets = await chargerBinaire(`audio/${fiche.id}.enc`);
      liberer();
      urlCourante = URL.createObjectURL(new Blob([octets], { type: fiche.podcast!.type }));
      lecteur!.src = urlCourante;
      lecteur!.playbackRate = lireVitesse();
      lecteur!.classList.remove('hidden');
      bouton!.classList.add('hidden');
      /* « hidden » et « flex » sont deux utilitaires de `display` : masquer
         demande de retirer l'un ET de poser l'autre, sinon l'ordre de la
         feuille engendrée décide à notre place. */
      commandes?.classList.remove('hidden');
      commandes?.classList.add('flex');
      charge = true;
      poserEcranVerrouille();
    } catch (erreur) {
      bouton!.disabled = false;
      libelle!.textContent = 'Écouter la fiche';
      info!.textContent = erreur instanceof Error ? erreur.message : 'Lecture impossible.';
      throw erreur;
    }
  }

  async function ecouterDepuis(partieId: string): Promise<void> {
    const partie = parties.find((p) => p.id === partieId);
    if (!partie) return;
    try {
      await charger();
    } catch {
      return; // le message est déjà à l'écran
    }
    lecteur!.currentTime = partie.debut;
    majPartieEnCours();
    majReste();
    void lecteur!.play().catch(() => {
      /* le navigateur peut refuser la lecture automatique : les commandes sont là */
    });
  }

  /* ── Le câblage ──────────────────────────────────────────────────────── */

  bouton.addEventListener('click', async () => {
    try {
      await charger();
    } catch {
      return;
    }
    if (repriseA) lecteur.currentTime = repriseA;
    void lecteur.play().catch(() => {
      /* le navigateur peut refuser la lecture automatique : les commandes sont là */
    });
  });

  if (choixVitesse) {
    const vitesse = lireVitesse();
    choixVitesse.replaceChildren();
    for (const valeur of VITESSES) {
      const option = document.createElement('option');
      option.value = String(valeur);
      /* « × 1,25 » : la virgule décimale française, et jamais un point. */
      option.textContent = `× ${new Intl.NumberFormat('fr-FR').format(valeur)}`;
      option.selected = valeur === vitesse;
      choixVitesse.appendChild(option);
    }
    choixVitesse.addEventListener('change', () => {
      const valeur = Number(choixVitesse.value);
      lecteur.playbackRate = valeur;
      ecrireVitesse(valeur);
    });
  }

  document.getElementById('podcast-recul')?.addEventListener('click', () => {
    lecteur.currentTime = Math.max(0, lecteur.currentTime - SAUT_S);
  });
  document.getElementById('podcast-avance')?.addEventListener('click', () => {
    lecteur.currentTime = Math.min(lecteur.duration || Infinity, lecteur.currentTime + SAUT_S);
  });

  // La position n'est écrite qu'au fil de l'eau : pas besoin d'une précision
  // à la seconde, et cela évite d'écrire à chaque image.
  let derniereEcriture = -Infinity;
  lecteur.addEventListener('timeupdate', () => {
    majPartieEnCours();
    majReste();
    if (lecteur.currentTime - derniereEcriture >= 5 || derniereEcriture > lecteur.currentTime) {
      derniereEcriture = lecteur.currentTime;
      enregistrer(false);
    }
  });
  lecteur.addEventListener('loadedmetadata', majReste);

  /*
     LES TROIS MOMENTS OÙ L'ÉCOUTE S'ARRÊTE (prompt 46, P3).

     `timeupdate` seul perdait jusqu'à cinq secondes. Les trois événements
     ci-dessous les rattrapent, et c'est là — et là seulement — que la
     position voyage.

     Ils ne se valent pas, et il faut le dire : `visibilitychange` est celui
     qui sauve vraiment le cas du téléphone, parce qu'il survient avant que
     la page ne soit gelée. `pagehide` est une tentative de plus, honorée
     quand le navigateur en laisse le temps — ce qu'aucune spécification ne
     garantit. D'où le maintien de l'écriture au fil de l'eau : elle est le
     filet, les trois autres sont la précision.
  */
  lecteur.addEventListener('pause', () => enregistrer(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && charge) enregistrer(true);
  });
  window.addEventListener('pagehide', () => {
    if (charge) enregistrer(true);
  });

  lecteur.addEventListener('ended', () => {
    void supprimerPositionPodcast(fiche.id).catch(() => {});
    majReste();
  });
  window.addEventListener('pagehide', liberer, { once: true });

  poserListeDesParties();

  /*
     La reprise se décide après coup, et sans faire attendre : l'ancienne clé
     est reprise, la position relue, et seul le LIBELLÉ du bouton change. Rien
     n'oblige à retarder l'affichage du lecteur pour cela.
  */
  void (async () => {
    try {
      await reprendreAnciennesPositions();
      const position = await lirePositionPodcast(fiche.id);
      if (!position || position.secondes < PLANCHER_REPRISE_S) return;
      repriseA = Math.max(0, position.secondes - RECUL_REPRISE_S);
      if (!charge) libelle.textContent = `Reprendre à ${horodatage(repriseA)}`;
    } catch {
      /* base indisponible : on écoutera depuis le début, et c'est dit par le bouton */
    }
  })();

  libelle.textContent = 'Écouter la fiche';
  return { ecouterDepuis, parties };
}
