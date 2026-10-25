/**
 * La boîte commune : une seule fenêtre pour tout Cyclades.
 *
 * ## Ce qu'elle remplace, relevé le 18 octobre
 *
 *     13 `confirm()`  progression ×4, profil ×2, appareils, apparier,
 *                     exporter-ia, stockage, quiz/dgfip, sport/exercices,
 *                     TableauDeBord.svelte
 *      4 `alert()`    profil ×2, planification/index, exporter-ia
 *      2 `prompt()`   profil, appareils
 *
 * (Le troisième `prompt()`, dans `coffre/bascule.astro`, demande le mot de
 * passe du site : l'interdit 1 du prompt 43 défend de toucher au coffre dans
 * ce lot, il reste donc en l'état et attend son tour.)
 *
 * ## Pourquoi les fenêtres natives ne pouvaient pas rester
 *
 * Elles ne sont pas « laides » : elles sont **fausses**. Leur bouton dit
 * « OK » là où il faudrait le verbe de l'action ; leur ordre est celui du
 * système et non celui qu'on a choisi ; elles ne se laissent ni habiller, ni
 * annoncer, ni fermer par le retour arrière ; et sur un téléphone elles
 * surgissent en haut de l'écran, à l'opposé du pouce. M5 demande des
 * feuilles qui montent du bas, refermables par un bouton visible ; la
 * section C du 43 demande le reste du contrat. Les deux tiennent dans un
 * seul composant, et c'est tout l'intérêt de n'en avoir qu'un.
 *
 * ## Les choix, et ce qui les impose
 *
 * **`<dialog>` natif et `showModal()`**, et non un calque fait à la main.
 * Le navigateur donne alors gratuitement ce qu'on écrirait mal : le piège du
 * focus, la touche d'échappement, l'inertie de l'arrière-plan, et la couche
 * supérieure — qui met fin aux guerres de `z-index` dont le centre de
 * notifications a déjà fait les frais le 17 octobre.
 *
 * **L'ordre du DOM n'est pas l'ordre à l'écran.** « Annuler » est à gauche
 * (décision 1 du 43), mais c'est l'ordre du DOM qui décide de ce que la
 * touche Entrée déclenche : un formulaire soumet son **premier** bouton de
 * soumission. L'action est donc première dans le DOM et seconde à l'écran,
 * par `order`. Et quand l'action est destructrice, elle n'est plus un bouton
 * de soumission du tout : Entrée ne peut alors que tomber sur « Annuler »,
 * ce qui est exactement la règle demandée et la seule façon sûre de la tenir.
 *
 * **Le focus va sur « Annuler »** à l'ouverture d'une confirmation, et sur le
 * champ quand on demande un texte — là, c'est le champ qu'on vient chercher.
 */
import { calqueFerme, calqueOuvert } from './calques';

export interface Confirmation {
  /** Ce qu'on s'apprête à faire, en une phrase. */
  titre: string;
  /** Ce qu'il faut savoir avant de répondre : conséquences, portée. */
  texte?: string;
  /** Le libellé du bouton : **le verbe de l'action**, jamais « OK ». */
  action: string;
  /** Rouge en contour, et la touche Entrée ne la déclenche jamais. */
  destructrice?: boolean;
  /** Par défaut « Annuler ». */
  annuler?: string;
}

export interface Avertissement {
  titre: string;
  texte?: string;
  /** Par défaut « J'ai compris ». */
  bouton?: string;
}

export interface DemandeDeTexte {
  titre: string;
  texte?: string;
  /** L'étiquette du champ, visible — jamais un simple texte d'invite. */
  etiquette: string;
  valeur?: string;
  /** Pour un JSON ou une phrase longue. */
  multiligne?: boolean;
  /** Par défaut « Enregistrer ». */
  action?: string;
  /** Posé sur le champ : `inputmode`, `type`, `placeholder`… */
  attributs?: Record<string, string>;
}

let compteur = 0;

/** Fabrique la coquille commune et rend de quoi l'ouvrir et la refermer. */
function coquille(titre: string, texte: string | undefined) {
  compteur += 1;
  const idTitre = `boite-titre-${compteur}`;
  const idTexte = `boite-texte-${compteur}`;

  const boite = document.createElement('dialog');
  boite.className = 'boite';
  boite.setAttribute('aria-labelledby', idTitre);
  if (texte) boite.setAttribute('aria-describedby', idTexte);

  const formulaire = document.createElement('form');
  formulaire.method = 'dialog';
  formulaire.className = 'boite-feuille feuille-sure';

  /* La poignée ne sert qu'à dire « ceci monte du bas et peut redescendre ».
     Le geste de balayage reste facultatif (M5) : c'est le bouton qui ferme. */
  const poignee = document.createElement('div');
  poignee.className = 'boite-poignee';
  poignee.setAttribute('aria-hidden', 'true');

  const entete = document.createElement('div');
  entete.className = 'boite-entete';
  const h = document.createElement('h2');
  h.id = idTitre;
  h.className = 'boite-titre';
  h.textContent = titre;
  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'boite-fermer cible-tactile-pleine';
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '✕';
  entete.append(h, fermer);

  formulaire.append(poignee, entete);
  if (texte) {
    const p = document.createElement('p');
    p.id = idTexte;
    p.className = 'boite-texte';
    p.textContent = texte;
    formulaire.append(p);
  }
  boite.append(formulaire);

  const actions = document.createElement('div');
  actions.className = 'boite-actions';

  return { boite, formulaire, actions, fermer };
}

/**
 * Ouvre la boîte, la referme proprement, et rend ce que le bouton a dit.
 *
 * Le focus revient d'où il venait. `showModal` le fait déjà dans les
 * navigateurs récents, mais le 18 octobre la barre latérale a montré ce que
 * coûte un focus qui retombe sur BODY : on ne s'en remet pas au navigateur
 * pour ce qui se vérifie en trois lignes.
 */
function ouvrir(
  boite: HTMLDialogElement,
  premierFocus: () => HTMLElement | null,
): Promise<string> {
  const venaitDe = document.activeElement as HTMLElement | null;
  document.body.append(boite);

  return new Promise<string>((resoudre) => {
    const partir = () => {
      calqueFerme('boite');
      const valeur = boite.returnValue;
      boite.remove();
      venaitDe?.focus?.();
      resoudre(valeur);
    };
    boite.addEventListener('close', partir, { once: true });

    /*
       Un appui à côté de la feuille la referme — c'est le réflexe, et une
       feuille qu'on ne peut quitter que par un bouton se fait fermer par le
       retour arrière, ce qui ferait perdre l'écran si celui-ci n'était pas
       branché. `<dialog>` ne le fait pas de lui-même : l'événement arrive
       sur la boîte quand il tombe sur le fond, et sur le formulaire quand il
       tombe dans la feuille.
    */
    boite.addEventListener('click', (e) => {
      if (e.target === boite) boite.close('');
    });

    boite.showModal();
    /* M5 : le retour arrière referme la feuille au lieu de quitter l'écran. */
    calqueOuvert('boite', () => boite.close(''));
    premierFocus()?.focus();
  });
}

/** Un bouton de la rangée d'actions. */
function bouton(
  texte: string,
  options: { valeur: string; sorte: 'principale' | 'annuler' | 'destructrice' },
): HTMLButtonElement {
  const b = document.createElement('button');
  /*
     Une action destructrice n'est PAS un bouton de soumission : c'est ainsi,
     et seulement ainsi, que la touche Entrée ne peut pas la déclencher.
  */
  b.type = options.sorte === 'destructrice' ? 'button' : 'submit';
  b.value = options.valeur;
  b.className = `boite-bouton cible-tactile boite-${options.sorte}`;
  b.textContent = texte;
  return b;
}

/**
 * Demande une confirmation. Rend `true` si l'action a été confirmée.
 *
 * Tout ce qui n'est pas un « oui » franc — la fermeture, l'échappement, le
 * retour arrière, un clic hors de la feuille — vaut non.
 */
export function confirmer(d: Confirmation): Promise<boolean> {
  const { boite, formulaire, actions, fermer } = coquille(d.titre, d.texte);

  const agir = bouton(d.action, {
    valeur: 'oui',
    sorte: d.destructrice ? 'destructrice' : 'principale',
  });
  const annuler = bouton(d.annuler ?? 'Annuler', { valeur: 'non', sorte: 'annuler' });
  /* L'action d'abord dans le DOM, « Annuler » d'abord à l'écran : voir
     l'en-tête du fichier. */
  actions.append(agir, annuler);
  formulaire.append(actions);

  if (d.destructrice) agir.addEventListener('click', () => boite.close('oui'));
  fermer.addEventListener('click', () => boite.close('non'));

  return ouvrir(boite, () => annuler).then((valeur) => valeur === 'oui');
}

/** Une issue proposée par la feuille des choix. */
export interface IssueProposee {
  /** Le verbe de l'issue, jamais « OK » ni « Oui ». */
  texte: string;
  /** Ce que la promesse rend si on la choisit. */
  valeur: string;
  /** Le rang visuel : « annuler » à gauche, les autres à droite. */
  sorte?: 'principale' | 'annuler' | 'destructrice';
}

/**
 * Propose PLUSIEURS issues, et rend celle qu'on a choisie — ou `null`.
 *
 * ## Pourquoi `confirmer` ne suffisait pas
 *
 * « Quitter l'épreuve ? » n'est pas une question à deux réponses. On peut
 * vouloir continuer, garder pour plus tard, ou abandonner : poser la
 * question en oui/non force à jeter le travail ou à rester, et c'est
 * précisément le choix que C3 du prompt 43 refuse.
 *
 * Les règles de `confirmer` tiennent toutes : « Annuler » à gauche et prend
 * le focus, les autres à droite ; une issue destructrice est en contour, et
 * **la touche Entrée ne la déclenche jamais** — elle n'est pas un bouton de
 * soumission. Tout ce qui ferme la feuille sans choisir — l'échappement, le
 * retour arrière, un appui à côté — rend `null`, c'est-à-dire « je n'ai rien
 * décidé », et non la première issue venue.
 */
export function choisirUneIssue(d: {
  titre: string;
  texte?: string;
  issues: readonly IssueProposee[];
}): Promise<string | null> {
  const { boite, formulaire, actions, fermer } = coquille(d.titre, d.texte);

  let aFocaliser: HTMLButtonElement | null = null;
  for (const issue of d.issues) {
    const sorte = issue.sorte ?? 'principale';
    const b = bouton(issue.texte, { valeur: issue.valeur, sorte });
    /* Une destructrice n'est pas un bouton de soumission : il faut donc lui
       fermer la feuille à la main, comme le fait `confirmer`. */
    if (sorte === 'destructrice') b.addEventListener('click', () => boite.close(issue.valeur));
    if (sorte === 'annuler') aFocaliser ??= b;
    actions.append(b);
  }
  formulaire.append(actions);
  fermer.addEventListener('click', () => boite.close(''));

  const valeurs = new Set(d.issues.map((i) => i.valeur));
  return ouvrir(boite, () => aFocaliser).then((valeur) =>
    valeurs.has(valeur) ? valeur : null,
  );
}

/** Dit quelque chose, et attend qu'on l'ait lu. */
export function avertir(d: Avertissement): Promise<void> {
  const { boite, formulaire, actions, fermer } = coquille(d.titre, d.texte);
  const compris = bouton(d.bouton ?? 'J’ai compris', {
    valeur: 'compris',
    sorte: 'principale',
  });
  actions.append(compris);
  formulaire.append(actions);
  fermer.addEventListener('click', () => boite.close('compris'));
  return ouvrir(boite, () => compris).then(() => undefined);
}

/**
 * Demande un texte. Rend `null` si on a renoncé.
 *
 * Le champ porte une **étiquette visible** : un texte d'invite qui disparaît
 * dès la première lettre ne dit plus ce qu'on est en train de taper.
 */
export function demanderUnTexte(d: DemandeDeTexte): Promise<string | null> {
  const { boite, formulaire, actions, fermer } = coquille(d.titre, d.texte);
  compteur += 1;
  const idChamp = `boite-champ-${compteur}`;

  const etiquette = document.createElement('label');
  etiquette.className = 'boite-etiquette';
  etiquette.htmlFor = idChamp;
  etiquette.textContent = d.etiquette;

  const champ = d.multiligne
    ? document.createElement('textarea')
    : document.createElement('input');
  champ.id = idChamp;
  champ.className = 'boite-champ';
  champ.value = d.valeur ?? '';
  if (champ instanceof HTMLTextAreaElement) champ.rows = 4;
  for (const [cle, valeur] of Object.entries(d.attributs ?? {})) {
    champ.setAttribute(cle, valeur);
  }

  const valider = bouton(d.action ?? 'Enregistrer', { valeur: 'oui', sorte: 'principale' });
  const annuler = bouton('Annuler', { valeur: 'non', sorte: 'annuler' });
  actions.append(valider, annuler);
  formulaire.append(etiquette, champ, actions);
  fermer.addEventListener('click', () => boite.close('non'));

  return ouvrir(boite, () => champ).then((valeur) => (valeur === 'oui' ? champ.value : null));
}

/**
 * Demande une **saisie construite** — des curseurs, des dates, des bascules —
 * et rend ce qu'elle a lu.
 *
 * ## Pourquoi `demanderUnTexte` ne suffisait pas
 *
 * « Mon profil » n'avait que lui, et un champ texte ne sait porter qu'une
 * chaîne. Corriger ses heures par domaine s'y faisait donc en tapant
 * « {"cognition": 10} » : la boîte demandait du JSON à une personne parce que
 * c'était la seule forme qu'elle savait recevoir.
 *
 * ## Ce que le retour distingue, et pourquoi il est enveloppé
 *
 * `null` veut dire **renoncé** : on a fermé, échappé, annulé. `{ valeur }`
 * veut dire **répondu**, et la valeur peut alors être `undefined` — c'est ce
 * que rend une saisie à qui l'on a dit « je ne sais pas », ou dont aucun
 * curseur n'a bougé.
 *
 * Les deux ne sont pas la même chose, et un retour nu les confondrait :
 * « j'ai renoncé » laisse le champ tel qu'il était, « je ne sais pas » est une
 * réponse dont l'appelant décide. Rendre `undefined` dans les deux cas
 * reviendrait à traiter un renoncement comme une réponse, ou l'inverse.
 *
 * ## Le rappel de fermeture
 *
 * `construire` reçoit de quoi fermer la feuille, parce qu'une saisie peut
 * porter sa propre sortie — le « Je ne sais pas encore » d'une répartition.
 * À l'initialisation ce bouton validait l'écran ; ici il ferme la boîte, et
 * c'est l'appelant qui le câble, non la boîte qui le devine.
 */
export function demanderUneSaisie(d: {
  titre: string;
  texte?: string;
  /** Omise quand la saisie porte déjà ses propres étiquettes. */
  etiquette?: string;
  /** Le verbe de l'action, jamais « OK ». */
  action?: string;
  construire: (fermer: () => void) => { element: HTMLElement; lire: () => unknown };
}): Promise<{ valeur: unknown } | null> {
  const { boite, formulaire, actions, fermer } = coquille(d.titre, d.texte);

  const saisie = d.construire(() => boite.close('oui'));

  const valider = bouton(d.action ?? 'Enregistrer', { valeur: 'oui', sorte: 'principale' });
  const annuler = bouton('Annuler', { valeur: 'non', sorte: 'annuler' });
  actions.append(valider, annuler);

  if (d.etiquette) {
    const etiquette = document.createElement('p');
    etiquette.className = 'boite-etiquette';
    etiquette.textContent = d.etiquette;
    formulaire.append(etiquette);
  }
  formulaire.append(saisie.element, actions);
  fermer.addEventListener('click', () => boite.close('non'));

  /*
     Le focus va sur la saisie, et non sur « Annuler ». Une confirmation
     focalise « Annuler » parce que son action est irréversible ; ici
     l'action est de remplir un champ, et faire tabuler la personne jusqu'à
     sa propre saisie serait un obstacle sans contrepartie.
  */
  const premier = saisie.element.querySelector<HTMLElement>(
    'input, select, textarea, button',
  );
  return ouvrir(boite, () => premier ?? annuler).then((valeur) =>
    valeur === 'oui' ? { valeur: saisie.lire() } : null,
  );
}
