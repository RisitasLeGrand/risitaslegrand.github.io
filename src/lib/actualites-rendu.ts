/**
 * Fabrique les éléments DOM de la rubrique « Actualités ».
 *
 * Tout passe par « textContent » ou par « echapper() » : les données viennent
 * de fichiers JSON écrits par une routine automatisée, elles ne sont jamais
 * injectées telles quelles dans du HTML.
 */
import { echapper, formaterDate, lien } from './ui';
import {
  domaineDe,
  etiquetteDomaine,
  ORDRE_DOMAINES,
  DOMAINES,
  type ChangementLegislatif,
  type FicheActu,
  type Indicateur,
  type ItemActu,
  type PointFrise,
  type Source,
  type Tendance,
} from './actualites';
import { rattacher, type IndexTexte } from './rattachement';
import { idParcoursCourant } from './parcours/courant';
import { lienCours } from './parcours/lien-cours';
import type { FicheAplatie } from './contenu';
import { boutonAssistant } from '../features/assistant/monter';
import { contexteActualite } from '../features/assistant/fournisseurs';

/**
 * Index du corps des fiches, alimenté après coup : il pèse plus d'un mégaoctet
 * et n'est chargé que si des actualités sont restées sans rattachement.
 */
let indexTexte: IndexTexte | null = null;
export function definirIndexTexte(index: IndexTexte) {
  indexTexte = index;
}

/**
 * Fabrique une balise ouvrante dont les attributs sont posés par le DOM.
 *
 * ## Pourquoi `echapper()` ne suffisait pas
 *
 * `echapper()` passe par `textContent` puis relit `innerHTML` : le navigateur
 * y échappe `&`, `<` et `>`, parce que ce sont les trois caractères qui
 * comptent **dans du texte**. Le guillemet droit, lui, n'a rien de dangereux
 * dans du texte, et le navigateur le laisse tel quel. Interpolé dans un
 * attribut, il **ferme l'attribut** — et la suite de la chaîne devient des
 * attributs à part entière. Démontré en navigateur : la charge
 * `" onerror=…` crée un gestionnaire `onerror` vivant.
 *
 * ## Pourquoi `setAttribute` et non un second échappement
 *
 * Un `echapperAttribut()` aurait réglé les quatre sites d'aujourd'hui. Mais
 * il aurait laissé le cinquième à écrire, et c'est le cinquième qui pose
 * problème : rien ne rappelle, au moment d'ajouter un attribut, lequel des
 * deux échappements s'applique. `setAttribute` ne se trompe pas de contexte,
 * parce qu'il ne compose pas de chaîne : il pose une valeur, et c'est le
 * sérialiseur du navigateur qui l'écrit correctement, guillemets compris.
 *
 * On rend la balise **ouvrante seule** : ces fonctions assemblent du HTML en
 * chaînes, avec du contenu déjà construit, et reconstruire tout l'arbre
 * serait un chantier d'une autre taille que celui qu'on mène ici. Le gain est
 * exactement là où était le défaut : dans les attributs.
 */
function baliseOuvrante(nom: string, attributs: Record<string, string | undefined>): string {
  const el = document.createElement(nom);
  for (const [clef, valeur] of Object.entries(attributs)) {
    if (valeur !== undefined) el.setAttribute(clef, valeur);
  }
  const rendu = el.outerHTML;
  /*
     `outerHTML` rend la balise entière. On coupe à la fin de la balise
     ouvrante — l'élément est vide, donc le premier `>` qui suit les attributs
     la ferme. Chercher `>` serait faux si une valeur en contenait un ; le
     sérialiseur, lui, écrit `&gt;` dans les attributs, de sorte que le
     premier `>` littéral est bien celui de la balise.
  */
  return rendu.slice(0, rendu.indexOf('>') + 1);
}

/**
 * Une URL d'origine extérieure, ou `null` si son schéma n'est pas `https:`.
 *
 * `setAttribute` a fermé la classe de défaut où la valeur **s'échappait** de
 * son attribut (D-003). Il reste celle où la valeur est un attribut honnête
 * dont le contenu est un programme : `javascript:…` posé par `setAttribute`
 * ne s'exécute pas au rendu, mais s'exécute **au clic**. Les deux défauts
 * sont voisins et se corrigent à deux endroits différents, parce qu'ils ne
 * sont pas de même nature : l'un est une faute de composition, l'autre une
 * faute de confiance.
 *
 * Liste blanche et non liste noire : `javascript:` écarté nommément
 * laisserait `data:`, `vbscript:`, et les schémas que les navigateurs
 * inventeront. On exige `https:` — ce que toutes les sources de la veille
 * portent déjà — et le reste disparaît plutôt que d'être affiché mort, parce
 * qu'un lien qui ne mène nulle part se clique quand même.
 *
 * `URL` et non une expression régulière : le constructeur applique les
 * règles d'analyse du navigateur, celles-là mêmes qui décideront au clic.
 * Un préfixe mesuré à la main se laisse contourner par une espace, une
 * tabulation ou un retour à la ligne en tête, que l'analyseur ignore.
 */
function urlSure(brute?: string): string | undefined {
  if (!brute) return undefined;
  try {
    return new URL(brute, document.baseURI).protocol === 'https:' ? brute : undefined;
  } catch {
    return undefined;
  }
}

function listeSources(sources?: Source[]): string {
  if (!sources?.length) return '';
  const liens = sources
    .filter((s) => s && s.nom)
    .map((s) => {
      const nom = echapper(s.nom);
      const url = urlSure(s.url);
      if (!url) return `<span>${nom}</span>`;
      const ouvrante = baliseOuvrante('a', {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
        class:
          'underline decoration-dotted underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400',
      });
      return `${ouvrante}${nom}</a>`;
    });
  if (!liens.length) return '';
  return `<p class="texte-secable mt-3 text-xs text-slate-500 dark:text-slate-400">Source${liens.length > 1 ? 's' : ''} : ${liens.join(' · ')}</p>`;
}

/**
 * Bloc « Lien avec le programme » : le commentaire rédigé par la veille, suivi
 * des fiches de cours réellement rattachées. Les liens sont calculés ici et non
 * par la routine, qui ne connaît pas le plan du site (il est chiffré).
 */
function blocLienCours(
  actualite: {
    titre?: string;
    mots_cles?: string[];
    lien_cours?: string;
    liens_cours?: Record<string, string>;
  },
  fiches: FicheAplatie[],
): string {
  const rattachees = fiches.length
    ? rattacher({ titre: actualite.titre ?? '', mots_cles: actualite.mots_cles }, fiches, indexTexte)
    : [];
  // Le commentaire est celui du parcours ouvert : une phrase écrite pour le
  // programme de l'INSP n'a rien à dire sous une préparation DGFiP.
  const phrase = lienCours(actualite, idParcoursCourant());
  if (!phrase && !rattachees.length) return '';

  const commentaire = phrase
    ? `<span class="font-medium text-indigo-700 dark:text-indigo-300">Lien avec le programme —</span> ${echapper(phrase)}`
    : '<span class="font-medium text-indigo-700 dark:text-indigo-300">À réviser avec</span>';

  const puces = rattachees
    .map(
      ({ fiche }) =>
        `${baliseOuvrante('a', {
          href: `${lien('/fiche/')}?id=${encodeURIComponent(fiche.id)}`,
          title: `${fiche.matiere} · ${fiche.fascicule}`,
          class:
            'inline-flex min-h-9 max-w-full items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-800 dark:hover:bg-slate-800',
        })}
           <span aria-hidden="true">📄</span><span class="texte-secable line-clamp-2 text-left">${echapper(fiche.titre)}</span>
         </a>`,
    )
    .join('');

  return `<div class="texte-secable mt-3 rounded-lg border-l-2 border-indigo-300 bg-indigo-50/60 px-3 py-2 text-sm text-slate-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-slate-300">
            <p>${commentaire}</p>
            ${puces ? `<div class="mt-2 flex flex-wrap gap-1.5">${puces}</div>` : ''}
          </div>`;
}

/**
 * Enveloppe commune aux cartes de la rubrique.
 *
 * Mise en page reprise de service-public.gouv.fr : une courte étiquette de
 * catégorie au-dessus du titre, un titre court, puis le corps de la carte.
 */
function coquilleCarte(options: {
  etiquette: string;
  classeEtiquette: string;
  titre: string;
  mention?: string;
  entete?: string;
  corps: string;
}): HTMLElement {
  const element = document.createElement('article');
  element.className =
    'flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700';
  element.innerHTML = `
    ${options.entete ?? ''}
    <div data-entete class="flex items-baseline justify-between gap-3">
      <p class="etiquette ${options.classeEtiquette}">${echapper(options.etiquette)}</p>
      ${
        options.mention
          ? `<span class="shrink-0 text-xs text-slate-400 dark:text-slate-500">${echapper(options.mention)}</span>`
          : ''
      }
    </div>
    <h3 class="texte-secable mt-1.5 leading-snug font-semibold text-slate-900 dark:text-white">${echapper(options.titre)}</h3>
    ${options.corps}`;
  return element;
}

/**
 * Dépliant « Voir plus / Voir moins », générique.
 *
 * Rend un bloc « details » stylé en bouton (voir « .depliant » dans
 * global.css) : le contenu passé est masqué tant que le bloc n'est pas
 * ouvert. Pensé pour être réutilisé par toute fiche du suivi permanent qui
 * deviendrait trop longue, et pas seulement par les deux premières.
 */
export function depliant(options: {
  /** Contenu masqué, déjà échappé. */
  contenu: string;
  ouvrir: string;
  fermer: string;
  /** Classes supplémentaires sur le bloc « details ». */
  classe?: string;
  /** false pour un texte, qui se poursuit sans zone de défilement propre. */
  borner?: boolean;
}): string {
  const { contenu, ouvrir, fermer, classe = '', borner = true } = options;
  return `<details class="depliant ${classe}">
            <summary>
              <span class="depliant-ouvrir">${echapper(ouvrir)}</span>
              <span class="depliant-fermer">${echapper(fermer)}</span>
            </summary>
            <div class="${borner ? 'depliant-corps ' : ''}mt-2">${contenu}</div>
          </details>`;
}

/**
 * Coupe un texte long à la fin de la première phrase qui dépasse le seuil.
 * Retourne l'extrait visible et la suite, vide si le texte est déjà court.
 */
function couperApresPhrase(texte: string, seuil = 180): [string, string] {
  if (texte.length <= seuil * 1.4) return [texte, ''];
  const fin = texte.slice(seuil).search(/[.!?]\s/);
  if (fin === -1) return [texte, ''];
  const coupe = seuil + fin + 1;
  return [texte.slice(0, coupe).trim(), texte.slice(coupe).trim()];
}

/** Ordre d'affichage du tableau de bord économique, et intitulé de chaque tuile. */
const INDICATEURS: { cle: string; libelle: string }[] = [
  { cle: 'pib', libelle: 'PIB' },
  { cle: 'dette', libelle: 'Dette publique' },
  { cle: 'dette_pct_pib', libelle: 'Dette en % du PIB' },
  { cle: 'deficit', libelle: 'Déficit public' },
  { cle: 'inflation', libelle: 'Inflation' },
];

/**
 * Tableau de bord des chiffres clés : une tuile par indicateur, valeur en
 * gros, période de référence et source en petit. Les clés inconnues du
 * barème ci-dessus sont affichées à la suite plutôt qu'ignorées.
 */
function tuilesIndicateurs(indicateurs?: Record<string, Indicateur>): string {
  if (!indicateurs) return '';
  const connues = INDICATEURS.filter((i) => indicateurs[i.cle]);
  const autres = Object.keys(indicateurs)
    .filter((cle) => !INDICATEURS.some((i) => i.cle === cle))
    .map((cle) => ({ cle, libelle: cle.replace(/_/g, ' ') }));
  const tuiles = [...connues, ...autres].map(({ cle, libelle }) => {
    const indicateur = indicateurs[cle];
    const urlIndicateur = urlSure(indicateur.source?.url);
    const source = indicateur.source?.nom
      ? urlIndicateur
        ? `${baliseOuvrante('a', {
            href: urlIndicateur,
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
            class: 'cible-minimale underline decoration-dotted underline-offset-2',
          })}${echapper(indicateur.source.nom)}</a>`
        : echapper(indicateur.source.nom)
      : '';
    return `<div class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <p class="etiquette text-slate-500 dark:text-slate-400">${echapper(libelle)}</p>
              <p class="texte-secable mt-1 text-xl font-bold text-slate-900 dark:text-white">${echapper(indicateur.valeur ?? '—')}</p>
              ${
                indicateur.periode_reference
                  ? `<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">${echapper(indicateur.periode_reference)}</p>`
                  : ''
              }
              ${source ? `<p class="texte-secable mt-1 text-xs text-slate-400 dark:text-slate-500">${source}</p>` : ''}
            </div>`;
  });
  if (!tuiles.length) return '';
  return `<div class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">${tuiles.join('')}</div>`;
}

/**
 * Historique cumulatif des changements législatifs : à la différence des
 * autres fiches de suivi, rien n'est écrasé — chaque changement s'ajoute, du
 * plus récent au plus ancien.
 */
/**
 * Nombre d'entrées d'historique affichées sans déplier.
 *
 * Trois plutôt que cinq : chaque entrée porte son résumé, son lien avec le
 * programme et ses sources, et l'historique publié en compte justement cinq —
 * s'arrêter à cinq ne replierait donc rien du tout.
 */
const HISTORIQUE_VISIBLE = 3;

function listeHistorique(historique: ChangementLegislatif[] | undefined, fiches: FicheAplatie[]): string {
  if (!historique?.length) return '';
  const entrees = [...historique].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const elements = entrees.map(
    (entree) => `
      <li class="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
        ${entree.date ? `<p class="text-xs font-medium text-slate-500 dark:text-slate-400">${echapper(formaterDate(entree.date))}</p>` : ''}
        <p class="texte-secable font-medium text-slate-900 dark:text-white">${echapper(entree.titre)}</p>
        <p class="texte-secable mt-0.5 text-sm text-slate-600 dark:text-slate-300">${echapper(entree.resume)}</p>
        ${blocLienCours(entree, fiches)}
        ${listeSources(entree.sources)}
      </li>`,
  );
  // Les plus récentes d'abord, le reste derrière un « Voir plus » : la liste
  // est cumulative, elle n'est donc pas destinée à être lue d'un bloc.
  const recentes = elements.slice(0, HISTORIQUE_VISIBLE);
  const anciennes = elements.slice(HISTORIQUE_VISIBLE);
  const liste = `<ol class="mt-3 space-y-4">${recentes.join('')}</ol>`;
  if (!anciennes.length) return liste;

  const reste = anciennes.length;
  return (
    liste +
    depliant({
      classe: 'mt-3',
      ouvrir: `Voir plus (${reste} entrée${reste > 1 ? 's' : ''} plus ancienne${reste > 1 ? 's' : ''})`,
      fermer: 'Voir moins',
      contenu: `<ol class="space-y-4 pr-1">${anciennes.join('')}</ol>`,
    })
  );
}

/** Un paragraphe dont la suite, si elle existe, se déplie sous le texte. */
function paragrapheDepliable(extrait: string, suite: string, marge: string): string {
  if (!extrait) return '';
  const classe = `texte-secable ${marge} text-sm text-slate-600 dark:text-slate-300`;
  const debut = `<p class="${classe}">${echapper(extrait)}</p>`;
  if (!suite) return debut;
  return (
    debut +
    depliant({
      classe: 'mt-1',
      ouvrir: 'Voir plus',
      fermer: 'Voir moins',
      borner: false,
      contenu: `<p class="${classe.replace(marge, 'mt-0')}">${echapper(suite)}</p>`,
    })
  );
}

/** Carte d'une fiche suivie en continu (Premier ministre, chiffres clés…). */
export function carteFiche(fiche: FicheActu, fichesCours: FicheAplatie[] = []): HTMLElement {
  const texte = fiche.resume ?? fiche.texte_contextuel ?? '';
  const contexte =
    fiche.texte_contextuel && fiche.resume ? fiche.texte_contextuel : '';
  // Les tuiles d'indicateurs restent toujours visibles : c'est le texte qui
  // les accompagne, lui seul, qui se replie.
  const [extrait, suite] = couperApresPhrase(texte);
  const [extraitContexte, suiteContexte] = couperApresPhrase(contexte);
  const element = coquilleCarte({
    etiquette: 'Suivi permanent',
    classeEtiquette: 'text-slate-500 dark:text-slate-400',
    titre: fiche.titre,
    mention: fiche.derniere_maj ? formaterDate(fiche.derniere_maj) : undefined,
    corps: `
      ${tuilesIndicateurs(fiche.indicateurs)}
      ${paragrapheDepliable(extrait, suite, 'mt-3')}
      ${paragrapheDepliable(extraitContexte, suiteContexte, 'mt-2')}
      ${listeHistorique(fiche.historique, fichesCours)}
      ${fiche.historique?.length ? '' : blocLienCours(fiche, fichesCours)}
      ${listeSources(fiche.sources)}`,
  });
  marquerRattachement(element);
  return element;
}

/**
 * Bloc « Tendances de fond » des bilans mensuel, trimestriel et annuel :
 * quelques paragraphes de lecture d'ensemble, pas une liste d'actualités.
 */
export function blocTendances(tendances: Tendance[]): HTMLElement {
  const bloc = document.createElement('section');
  bloc.className =
    'rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30';
  const paragraphes = tendances
    .map((tendance) => {
      const domaine = tendance.domaine ? etiquetteDomaine(tendance.domaine) : null;
      return `<div>
        ${domaine ? `<p class="etiquette ${domaine.classe}">${echapper(domaine.libelle)}</p>` : ''}
        ${tendance.titre ? `<p class="texte-secable mt-0.5 font-semibold text-slate-900 dark:text-white">${echapper(tendance.titre)}</p>` : ''}
        <p class="texte-secable mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">${echapper(tendance.texte)}</p>
      </div>`;
    })
    .join('');
  bloc.innerHTML = `
    <p class="etiquette text-indigo-700 dark:text-indigo-300">Tendances de fond</p>
    <div class="mt-2 space-y-3">${paragraphes}</div>`;
  return bloc;
}

/** Légende des domaines, affichée au-dessus des frises chronologiques. */
export function legendeDomaines(utilises?: Set<string>): HTMLElement {
  const legende = document.createElement('ul');
  legende.className = 'flex flex-wrap gap-x-4 gap-y-1.5';
  const domaines = ORDRE_DOMAINES.filter((d) => !utilises || utilises.has(d));
  legende.innerHTML = domaines
    .map(
      (d) =>
        `<li class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
           <span class="h-2.5 w-2.5 shrink-0 rounded-full ${DOMAINES[d].pastille}" aria-hidden="true"></span>
           ${echapper(DOMAINES[d].libelle)}
         </li>`,
    )
    .join('');
  return legende;
}

/**
 * Frise chronologique d'une période : une colonne d'événements ordonnés,
 * chacun portant la couleur de son domaine. Pas de rendu graphique à
 * l'horizontale : à 360 px de large, une liste jalonnée reste lisible là où
 * une frise horizontale imposerait un défilement latéral.
 */
export function friseChronologique(points: PointFrise[]): HTMLElement {
  const frise = document.createElement('ol');
  frise.className = 'relative ml-1 space-y-4 border-l border-slate-300 pl-5 dark:border-slate-700';
  frise.innerHTML = points
    .map((point) => {
      const domaine = etiquetteDomaine(point.domaine);
      const pastille = 'pastille' in domaine ? domaine.pastille : 'bg-slate-400';
      return `<li class="relative">
        <span class="absolute top-1.5 -left-[1.6rem] h-2.5 w-2.5 rounded-full ring-2 ring-white ${pastille} dark:ring-slate-900" aria-hidden="true"></span>
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">${echapper(formaterDate(point.date) || point.date)}</p>
        <p class="texte-secable font-medium text-slate-900 dark:text-white">${echapper(point.libelle)}</p>
        ${point.detail ? `<p class="texte-secable mt-0.5 text-sm text-slate-600 dark:text-slate-300">${echapper(point.detail)}</p>` : ''}
        <p class="etiquette mt-0.5 ${domaine.classe}">${echapper(domaine.libelle)}</p>
      </li>`;
    })
    .join('');
  return frise;
}

/** Note sur la carte si elle a trouvé des fiches de cours, pour un repêchage éventuel. */
function marquerRattachement(element: HTMLElement) {
  element.dataset.rattachements = String(element.querySelectorAll('a[href*="/fiche/"]').length);
}

/**
 * Carte d'une actualité datée (entrée hebdomadaire, trimestrielle ou annuelle).
 *
 * ## Le mode replié
 *
 * Sur l'archive, cent neuf articles de huit à dix lignes faisaient quarante
 * mille pixels et sept cent dix éléments interactifs. Repliée, la carte
 * montre son domaine, son titre et trois lignes de résumé ; le lien avec le
 * programme, les sources et le bouton « Préparer une question pour une IA »
 * attendent derrière « Lire la suite ». Ce ne sont pas seulement des pixels
 * en moins : ces trois blocs portaient presque tous les éléments interactifs
 * de la page, et une liste qu'on survole n'a pas besoin d'eux.
 *
 * Le tableau de bord, lui, n'affiche que quatre actualités et n'a jamais été
 * trop long : il garde la carte entière. D'où l'option, plutôt qu'un
 * changement partout.
 */
export function carteItem(
  item: ItemActu,
  fichesCours: FicheAplatie[] = [],
  {
    replie = false,
    lecture,
  }: {
    replie?: boolean;
    /**
     * Le marqueur « lu » (D-039). Absent, la carte n'en porte pas : le
     * tableau de bord montre quatre actualités du jour, où « lu » n'a pas de
     * sens.
     */
    lecture?: { lu: boolean; basculer: (lu: boolean) => void | Promise<void> };
  } = {},
): HTMLElement {
  const domaine = etiquetteDomaine(domaineDe(item));

  // L'image n'est jamais hébergée ici : on affiche l'URL d'origine, et on
  // masque le bloc si elle ne se charge pas (lien mort, hotlink refusé).
  const urlImage = urlSure(item.image?.url);
  const image = urlImage
    ? `<figure class="-mx-4 -mt-4 mb-3 overflow-hidden bg-slate-100 dark:bg-slate-800">
         ${baliseOuvrante('img', {
           src: urlImage,
           alt: '',
           loading: 'lazy',
           referrerpolicy: 'no-referrer',
           class: 'aspect-video w-full max-w-full object-cover',
           onerror: "this.closest('figure').remove()",
         })}
         ${
           item.image?.credit
             ? `<figcaption class="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">${echapper(item.image.credit)}</figcaption>`
             : ''
         }
       </figure>`
    : '';

  const element = coquilleCarte({
    etiquette: domaine.libelle,
    classeEtiquette: domaine.classe,
    titre: item.titre ?? '',
    entete: image,
    corps: `
      <p data-resume class="texte-secable mt-2 text-sm text-slate-600 dark:text-slate-300${replie ? ' line-clamp-3' : ''}">${echapper(item.resume ?? '')}</p>`,
  });
  element.dataset.domaine = domaineDe(item);
  if (lecture) marquerLecture(element, lecture.lu);

  const suite = document.createElement('div');
  suite.innerHTML = `${blocLienCours(item, fichesCours)}${listeSources(item.sources)}`;

  /*
   * Une actualité est le contexte où l'assistant sert le plus souvent : elle
   * est courte par construction, et ce qu'on veut en savoir — pourquoi cela
   * compte, à quoi le rattacher au programme — n'y est jamais écrit.
   */
  const aide = document.createElement('div');
  aide.className = 'mt-3';
  aide.appendChild(
    boutonAssistant(
      {
        titre: 'Préparer une question pour une IA — actualité',
        construireContexte: async () =>
          contexteActualite({
            titre: item.titre ?? '',
            resume: item.resume ?? '',
            date: item.date ?? '',
            domaine: etiquetteDomaine(domaineDe(item)).libelle,
            sources: (item.sources ?? []).map((s) => ({ nom: s.nom ?? '', url: s.url })),
            lienCours: lienCours(item, idParcoursCourant()),
            motsCles: item.mots_cles,
          }),
      },
      'Préparer une question pour une IA',
    ),
  );
  suite.appendChild(aide);

  if (!replie) {
    element.appendChild(suite);
    marquerRattachement(element);
    return element;
  }

  const bloc = document.createElement('details');
  bloc.className = 'depliant min-w-0 flex-1';
  const titre = document.createElement('summary');
  const ouvrir = document.createElement('span');
  ouvrir.className = 'depliant-ouvrir';
  ouvrir.textContent = 'Lire la suite';
  const fermer = document.createElement('span');
  fermer.className = 'depliant-fermer';
  fermer.textContent = 'Replier';
  titre.append(ouvrir, fermer);
  bloc.append(titre, suite);
  // Le résumé se déplie avec le reste : le couper à trois lignes et laisser
  // la coupe en place une fois la carte ouverte n'aurait caché que le texte
  // qu'on vient de demander à lire.
  bloc.addEventListener('toggle', () => {
    element.querySelector('[data-resume]')?.classList.toggle('line-clamp-3', !bloc.open);
  });
  /*
     Le dépliant et le marqueur de lecture partagent une ligne.

     Une ligne de plus par carte sur cent neuf cartes, c'est une page plus
     longue pour une information qui tient dans un coin. « items-start » et
     non « items-center » : une fois le dépliant ouvert, le bouton doit
     rester en haut, à côté de « Replier », et non flotter au milieu du
     contenu déplié.
  */
  const actions = document.createElement('div');
  actions.className = 'mt-1 flex flex-wrap items-start justify-between gap-2';
  actions.appendChild(bloc);
  if (lecture) actions.appendChild(boutonDeLecture(element, lecture));
  element.appendChild(actions);
  // « marquerRattachement » lit le bloc « lien avec le programme », qui est
  // maintenant dans le dépliant : il doit donc passer après l'assemblage.
  marquerRattachement(element);
  return element;
}

/**
 * Pose l'état de lecture sur la carte : une étiquette dans l'en-tête, et un
 * peu moins d'encre.
 *
 * L'étiquette porte le mot, et l'atténuation le renforce — une carte plus
 * pâle, seule, ne dirait rien à qui ne compare pas, et ne dirait rien du tout
 * à un lecteur d'écran.
 */
function marquerLecture(carte: HTMLElement, lu: boolean): void {
  carte.dataset.lu = String(lu);
  carte.classList.toggle('opacity-70', lu);
  const entete = carte.querySelector('[data-entete]');
  let marque = carte.querySelector<HTMLElement>('[data-marque-lu]');
  if (!lu) {
    marque?.remove();
    return;
  }
  if (!marque && entete) {
    marque = document.createElement('span');
    marque.dataset.marqueLu = 'oui';
    marque.className =
      'shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300';
    marque.textContent = 'Lu';
    entete.appendChild(marque);
  }
}

/**
 * Le bouton qui bascule l'état.
 *
 * Son libellé **dit l'action**, pas l'état : « Marquer comme lu » puis
 * « Marquer comme non lu ». Un bouton intitulé « Lu » laisserait entière la
 * question de savoir si c'est un constat ou une commande, et son nom
 * accessible ne pourrait pas être les deux à la fois.
 */
function boutonDeLecture(
  carte: HTMLElement,
  lecture: { lu: boolean; basculer: (lu: boolean) => void | Promise<void> },
): HTMLElement {
  let lu = lecture.lu;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.dataset.basculeLu = '';
  const peindre = () => {
    bouton.textContent = lu ? 'Marquer comme non lu' : 'Marquer comme lu';
    bouton.className =
      'cible-minimale shrink-0 rounded-lg px-2 py-1 text-xs font-medium transition ' +
      (lu
        ? 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
        : 'text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40');
  };
  peindre();
  bouton.addEventListener('click', () => {
    lu = !lu;
    peindre();
    marquerLecture(carte, lu);
    void lecture.basculer(lu);
  });
  return bouton;
}

/** Message affiché tant qu'aucune donnée n'a été publiée. */
export function messageVide(texte: string): HTMLElement {
  const p = document.createElement('p');
  p.className =
    'rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400';
  p.textContent = texte;
  return p;
}
