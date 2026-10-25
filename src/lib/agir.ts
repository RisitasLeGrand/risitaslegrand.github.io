/**
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║  AGIR — une écriture qui échoue le dit, et le message reste            ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 *
 * A1 et A2 du prompt 43. Le constat qui les justifie est simple à vérifier et
 * désagréable à lire : dans la plupart des écrans, une suppression ou un
 * enregistrement qui échoue **ne dit rien**. Le code s'écrit
 * `void supprimerPesee(id).then(recharger)` ; la promesse rejetée part dans le
 * vide, la liste se repeint identique, et la personne croit que la ligne est
 * partie. Elle revient, la ligne est là, et elle ne sait pas si elle a mal
 * appuyé ou si le site l'a trahie.
 *
 * Ce module ne fait donc qu'une chose, et la fait partout pareil : il exécute
 * l'action, et **si elle échoue, il l'écrit à l'écran, en texte, et le texte
 * reste**.
 *
 * ## Pourquoi un message qui reste, et pas une bulle
 *
 * `ui.ts` sait déjà faire une bulle, qui s'efface au bout de 2,6 s. C'est bon
 * pour « Enregistré » ; c'est mauvais pour un échec. Un échec demande une
 * décision — recommencer, libérer de la place, changer d'appareil — et une
 * décision ne se prend pas en deux secondes et demie. Le point C4 du 43 le dit
 * dans l'autre sens : « pas d'erreur en bulle ». La région de ce module porte
 * donc `role="alert"`, elle est annoncée une fois, et elle attend qu'on la
 * ferme ou qu'une action réussisse.
 *
 * ## Pourquoi la région est créée en JavaScript
 *
 * Elle pourrait vivre dans le gabarit. Mais tous les écrans ne passent pas par
 * le même gabarit, et un écran qui l'oublierait retomberait dans le silence
 * d'aujourd'hui — exactement le défaut qu'on corrige. Créée à la demande, elle
 * existe partout où ce module est appelé, sans condition. C'est le choix que
 * `notifier()` a déjà fait, pour la même raison.
 *
 * ## L'espace plein (A2)
 *
 * `QuotaExceededError` n'était interceptée **nulle part** dans `src/` — relevé
 * le 18 octobre, zéro occurrence. Une base pleine échoue donc aujourd'hui en
 * silence, et c'est la panne la plus probable d'un site qui garde cinq ans de
 * révisions sur un téléphone. Elle est reconnue ici, une fois, et traduite en
 * une phrase qui dit **quoi faire**.
 *
 * Trois formes à reconnaître, parce que les navigateurs ne s'accordent pas :
 * le nom `QuotaExceededError`, le code 22 des vieilles implémentations, et le
 * `NS_ERROR_DOM_QUOTA_REACHED` de Firefox.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Reconnaître
   ══════════════════════════════════════════════════════════════════════════ */

/** L'espace de l'appareil est-il plein ? */
export function estEspacePlein(erreur: unknown): boolean {
  if (!erreur || typeof erreur !== 'object') return false;
  const nom = (erreur as { name?: unknown }).name;
  const code = (erreur as { code?: unknown }).code;
  return (
    nom === 'QuotaExceededError' ||
    nom === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

const PHRASE_ESPACE_PLEIN =
  'L’espace de cet appareil est plein : rien n’a été enregistré. ' +
  'Faites une sauvegarde depuis Sauvegarde, puis libérez de la place depuis ' +
  'Stockage, et recommencez.';

/*
   Les pannes de plateforme que ce site peut réellement rencontrer, et la
   phrase qui dit QUOI FAIRE. La liste est fermée exprès : un nom inconnu
   tombe sur la phrase générique plutôt que de laisser passer un texte
   anglais. Chaque entrée vient d’un appel que le code fait vraiment —
   IndexedDB, le sélecteur de fichiers, le presse-papiers, Web Crypto.
*/
const PAR_NOM_DE_PANNE: Readonly<Record<string, string>> = {
  AbortError: 'Le geste a été interrompu : rien n’a été changé.',
  NotAllowedError:
    'L’appareil a refusé l’autorisation. Vérifiez les permissions du site dans ' +
    'votre navigateur, puis recommencez.',
  SecurityError:
    'Le navigateur a bloqué l’opération pour une raison de sécurité. Elle ' +
    'demande une page ouverte directement, et non dans un cadre.',
  NotFoundError:
    'L’élément demandé est introuvable : il a sans doute été déplacé ou ' +
    'supprimé depuis. Choisissez-le à nouveau.',
  InvalidStateError:
    'La base locale n’était pas dans l’état attendu. Fermez les autres onglets ' +
    'de Cyclades, rechargez la page, puis recommencez.',
  VersionError:
    'La base locale vient d’une version plus récente de Cyclades. Rechargez la ' +
    'page ; si cela ne suffit pas, c’est qu’un autre onglet porte une version ' +
    'plus neuve.',
  ConstraintError:
    'Une entrée portant la même clé existe déjà : rien n’a été écrasé.',
  DataCloneError:
    'Une donnée n’a pas pu être enregistrée telle quelle. C’est un défaut de ' +
    'l’application, pas une erreur de votre part : notez ce que vous faisiez.',
  DataError: 'La donnée lue n’a pas la forme attendue, et rien n’a été changé.',
  TimeoutError:
    'L’opération a pris trop de temps et a été abandonnée. Rien n’a été changé ; ' +
    'réessayez.',
  OperationError:
    'Le déchiffrement a échoué. Le mot de passe ne correspond pas, ou le ' +
    'fichier est abîmé.',
  NetworkError:
    'La ressource n’a pas pu être chargée. Cyclades fonctionne hors ligne une ' +
    'fois les fiches en cache ; si la page vient d’être ouverte, revenez en ' +
    'ligne un instant.',
};

/**
 * La phrase à montrer pour une erreur.
 *
 * Jamais le texte brut d'une `Error` quand on sait faire mieux — c'est la règle
 * D2 du 43 —, mais jamais non plus un message vide : un message de domaine,
 * écrit exprès pour être lu (« Ce fichier n'est pas une sauvegarde valide »),
 * vaut mieux que n'importe quelle reformulation.
 */
export function messageDUneErreur(erreur: unknown): string {
  if (estEspacePlein(erreur)) return PHRASE_ESPACE_PLEIN;

  /*
     G-13. Une `DOMException` est une panne de la PLATEFORME, et son texte est
     celui du navigateur : anglais, technique, souvent trompeur — « Failed to
     execute 'transaction' on 'IDBDatabase' » ne dit à personne quoi faire.
     Une `Error` ordinaire, ici, vient de l’application : son message est
     français et a été écrit pour être lu. C’est le seul discriminant fiable,
     et il évite de renifler le texte, qui change avec la langue du
     navigateur.
  */
  if (typeof DOMException !== 'undefined' && erreur instanceof DOMException) {
    const dite = PAR_NOM_DE_PANNE[erreur.name];
    if (dite) return dite;
    return (
      'L’appareil a refusé l’opération, et l’application ne sait pas nommer la ' +
      'raison. Le détail technique est dans la console du navigateur.'
    );
  }

  const brut = erreur instanceof Error ? erreur.message : String(erreur ?? '');
  const propre = brut.trim();
  if (!propre || propre === 'undefined' || propre === 'null')
    return 'L’enregistrement n’a pas abouti, et la raison n’est pas connue. Réessayez ; si cela se reproduit, notez ce que vous faisiez.';
  return propre;
}

/* ══════════════════════════════════════════════════════════════════════════
   Dire
   ══════════════════════════════════════════════════════════════════════════ */

const ID_REGION = 'echec-de-page';

function region(): HTMLElement {
  const existante = document.getElementById(ID_REGION);
  if (existante) return existante;

  const zone = document.createElement('div');
  zone.id = ID_REGION;
  zone.hidden = true;
  /*
     Au-dessus de la barre du bas, comme les bulles : « bottom-20 » dégage les
     57 px de la barre et sa marge, et `--sur-bas` ajoute la poignée de
     l'iPhone. Au-delà de 640 px la barre n'existe plus et la région redescend.
  */
  zone.className =
    'fixed inset-x-0 bottom-20 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-lg ' +
    'border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg ' +
    'dark:border-red-800 dark:bg-red-950 dark:text-red-100 sm:bottom-4';
  zone.style.marginBottom = 'var(--sur-bas)';
  zone.setAttribute('role', 'alert');

  const texte = document.createElement('p');
  texte.dataset.texte = '';
  texte.className = 'grow';
  zone.appendChild(texte);

  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'cible-tactile shrink-0 rounded-lg px-2 font-medium underline';
  fermer.textContent = 'Masquer';
  fermer.addEventListener('click', () => effacerLEchec());
  zone.appendChild(fermer);

  document.body.appendChild(zone);
  return zone;
}

/**
 * Écrit un échec à l'écran, et le laisse.
 *
 * `zone` permet à un écran qui a déjà sa place réservée pour les messages de
 * la garder : la page des tâches, par exemple, écrit sous son formulaire. Sans
 * elle, la région commune s'en charge.
 */
export function direLEchec(message: string, zone?: HTMLElement | string | null): void {
  const propre = zone
    ? typeof zone === 'string'
      ? document.getElementById(zone)
      : zone
    : null;
  if (propre) {
    propre.textContent = message;
    propre.hidden = false;
    propre.classList.remove('hidden');
    if (!propre.getAttribute('role')) propre.setAttribute('role', 'alert');
    return;
  }
  const commune = region();
  (commune.querySelector('[data-texte]') as HTMLElement).textContent = message;
  commune.hidden = false;
}

/** Retire le message, s'il y en a un. */
export function effacerLEchec(zone?: HTMLElement | string | null): void {
  const propre = zone
    ? typeof zone === 'string'
      ? document.getElementById(zone)
      : zone
    : null;
  if (propre) {
    propre.textContent = '';
    propre.hidden = true;
    propre.classList.add('hidden');
    return;
  }
  const commune = document.getElementById(ID_REGION);
  if (commune) commune.hidden = true;
}

/* ══════════════════════════════════════════════════════════════════════════
   Agir
   ══════════════════════════════════════════════════════════════════════════ */

export interface Options {
  /** Ce qu'on repeint quand l'action a réussi. */
  peindre?: () => unknown | Promise<unknown>;
  /** La zone de message propre à l'écran, si elle existe. */
  zone?: HTMLElement | string | null;
}

/**
 * Exécute une action, repeint si elle réussit, l'écrit si elle échoue.
 *
 * Rend `true` quand l'action a abouti. Ne relance pas : l'appelant n'a rien à
 * rattraper, le message est déjà à l'écran. C'est voulu — un `try` de plus à
 * chaque appel, et la moitié des appels l'oublieraient.
 *
 * Le repeint ne se fait **qu'en cas de succès**. Repeindre après un échec
 * donnerait la liste inchangée pour toute réponse, ce qui est précisément
 * l'ambiguïté qu'on enlève.
 */
export async function agirPuisPeindre(
  action: () => unknown | Promise<unknown>,
  options: Options = {},
): Promise<boolean> {
  try {
    await action();
  } catch (erreur) {
    direLEchec(messageDUneErreur(erreur), options.zone);
    return false;
  }
  effacerLEchec(options.zone);
  if (options.peindre) {
    /*
       Le repeint peut échouer à son tour — une lecture refusée, un coffre qui
       se referme entre-temps. Le dire aussi : un écran figé sans explication
       est le même défaut une ligne plus bas.
    */
    try {
      await options.peindre();
    } catch (erreur) {
      direLEchec(messageDUneErreur(erreur), options.zone);
      return false;
    }
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le filet
   ══════════════════════════════════════════════════════════════════════════ */

let filetPose = false;

/**
 * Le filet des promesses rejetées que personne n'attrape (T09-19, T15-04).
 *
 * Il ne remplace pas `agirPuisPeindre` : un échec attendu doit être dit par
 * l'écran qui l'a provoqué, avec ses mots. Le filet est là pour ce qu'on n'a
 * pas prévu, et sa seule promesse est que **rien ne tombe en silence**.
 *
 * Il se garde d'être bavard : un même message n'est pas réécrit deux fois de
 * suite, et une erreur de chargement de ressource — une image absente — n'est
 * pas une panne d'écriture et ne mérite pas la région rouge.
 */
export function poserLeFiletDErreurs(): void {
  if (filetPose) return;
  filetPose = true;

  let dernier = '';
  const dire = (erreur: unknown) => {
    const message = messageDUneErreur(erreur);
    if (message === dernier) return;
    dernier = message;
    direLEchec(message);
  };

  window.addEventListener('unhandledrejection', (evenement) => {
    dire((evenement as PromiseRejectionEvent).reason);
  });

  window.addEventListener('error', (evenement) => {
    /* Une balise qui n'a pas pu charger son fichier : ce n'est pas une
       erreur de script, et `error` la rapporte avec la balise pour cible. */
    if (evenement.target && evenement.target !== window) return;
    dire((evenement as ErrorEvent).error ?? (evenement as ErrorEvent).message);
  });
}
