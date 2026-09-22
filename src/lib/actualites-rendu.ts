/**
 * Fabrique les éléments DOM de la rubrique « Actualités ».
 *
 * Tout passe par « textContent » ou par « echapper() » : les données viennent
 * de fichiers JSON écrits par une routine automatisée, elles ne sont jamais
 * injectées telles quelles dans du HTML.
 */
import { echapper, formaterDate, lien } from './ui';
import { etiquetteTheme, type FicheActu, type ItemActu, type Source } from './actualites';
import { rattacher, type IndexTexte } from './rattachement';
import type { FicheAplatie } from './contenu';

/**
 * Index du corps des fiches, alimenté après coup : il pèse plus d'un mégaoctet
 * et n'est chargé que si des actualités sont restées sans rattachement.
 */
let indexTexte: IndexTexte | null = null;
export function definirIndexTexte(index: IndexTexte) {
  indexTexte = index;
}

function listeSources(sources?: Source[]): string {
  if (!sources?.length) return '';
  const liens = sources
    .filter((s) => s && s.nom)
    .map((s) => {
      const nom = echapper(s.nom);
      if (!s.url) return `<span>${nom}</span>`;
      return `<a href="${echapper(s.url)}" target="_blank" rel="noopener noreferrer nofollow"
                 class="underline decoration-dotted underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400">${nom}</a>`;
    });
  if (!liens.length) return '';
  return `<p class="mt-3 text-xs text-slate-500 dark:text-slate-400">Source${liens.length > 1 ? 's' : ''} : ${liens.join(' · ')}</p>`;
}

/**
 * Bloc « Lien avec le programme » : le commentaire rédigé par la veille, suivi
 * des fiches de cours réellement rattachées. Les liens sont calculés ici et non
 * par la routine, qui ne connaît pas le plan du site (il est chiffré).
 */
function blocLienCours(
  actualite: { titre?: string; mots_cles?: string[]; lien_cours?: string },
  fiches: FicheAplatie[],
): string {
  const rattachees = fiches.length
    ? rattacher({ titre: actualite.titre ?? '', mots_cles: actualite.mots_cles }, fiches, indexTexte)
    : [];
  if (!actualite.lien_cours?.trim() && !rattachees.length) return '';

  const commentaire = actualite.lien_cours?.trim()
    ? `<span class="font-medium text-indigo-700 dark:text-indigo-300">Lien avec le programme —</span> ${echapper(actualite.lien_cours)}`
    : '<span class="font-medium text-indigo-700 dark:text-indigo-300">À réviser avec</span>';

  const puces = rattachees
    .map(
      ({ fiche }) =>
        `<a href="${lien('/fiche/')}?id=${encodeURIComponent(fiche.id)}"
            title="${echapper(fiche.matiere)} · ${echapper(fiche.fascicule)}"
            class="inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-800 dark:hover:bg-slate-800">
           <span aria-hidden="true">📄</span><span class="truncate">${echapper(fiche.titre)}</span>
         </a>`,
    )
    .join('');

  return `<div class="mt-3 rounded-lg border-l-2 border-indigo-300 bg-indigo-50/60 px-3 py-2 text-sm text-slate-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-slate-300">
            <p>${commentaire}</p>
            ${puces ? `<div class="mt-2 flex flex-wrap gap-1.5">${puces}</div>` : ''}
          </div>`;
}

/** Carte d'une fiche suivie en continu (Premier ministre, chiffres clés…). */
export function carteFiche(fiche: FicheActu, fichesCours: FicheAplatie[] = []): HTMLElement {
  const element = document.createElement('article');
  element.className =
    'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900';
  element.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <h3 class="font-semibold text-slate-900 dark:text-white">${echapper(fiche.titre)}</h3>
      ${
        fiche.derniere_maj
          ? `<span class="shrink-0 text-xs text-slate-400 dark:text-slate-500" title="Dernière mise à jour">${echapper(formaterDate(fiche.derniere_maj))}</span>`
          : ''
      }
    </div>
    <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${echapper(fiche.resume ?? '')}</p>
    ${blocLienCours(fiche, fichesCours)}
    ${listeSources(fiche.sources)}`;
  marquerRattachement(element);
  return element;
}

/** Note sur la carte si elle a trouvé des fiches de cours, pour un repêchage éventuel. */
function marquerRattachement(element: HTMLElement) {
  element.dataset.rattachements = String(element.querySelectorAll('a[href*="/fiche/"]').length);
}

/** Carte d'une actualité datée (entrée hebdomadaire, trimestrielle ou annuelle). */
export function carteItem(item: ItemActu, fichesCours: FicheAplatie[] = []): HTMLElement {
  const theme = etiquetteTheme(item.theme);
  const element = document.createElement('article');
  element.dataset.theme = (item.theme ?? '').toLowerCase();
  element.className =
    'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900';

  // L'image n'est jamais hébergée ici : on affiche l'URL d'origine, et on
  // masque le bloc si elle ne se charge pas (lien mort, hotlink refusé).
  const image = item.image?.url
    ? `<figure class="mb-3 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
         <img src="${echapper(item.image.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"
              class="h-40 w-full object-cover" onerror="this.closest('figure').remove()" />
         ${
           item.image.credit
             ? `<figcaption class="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">${echapper(item.image.credit)}</figcaption>`
             : ''
         }
       </figure>`
    : '';

  element.innerHTML = `
    ${image}
    <div class="flex items-start justify-between gap-3">
      <h3 class="font-semibold text-slate-900 dark:text-white">${echapper(item.titre ?? '')}</h3>
      <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${theme.classe}">${echapper(theme.libelle)}</span>
    </div>
    <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${echapper(item.resume ?? '')}</p>
    ${blocLienCours(item, fichesCours)}
    ${listeSources(item.sources)}`;
  marquerRattachement(element);
  return element;
}

/** Message affiché tant qu'aucune donnée n'a été publiée. */
export function messageVide(texte: string): HTMLElement {
  const p = document.createElement('p');
  p.className =
    'rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400';
  p.textContent = texte;
  return p;
}
