/**
 * Les champs d'une série, construits une fois pour tous les écrans.
 *
 * ## Pourquoi ils sortent de `taches.astro`
 *
 * Le prompt 39 demande qu'on puisse programmer une tâche répétée **depuis
 * le calendrier**, et il ajoute : « ne recopie pas le formulaire ». Tant
 * qu'ils vivaient dans la page des tâches, il n'y avait que deux façons de
 * les réutiliser : les copier, ou faire importer une page par une autre.
 * La première diverge au premier champ ajouté ; la seconde ferait dépendre
 * le calendrier de la mise en page des tâches.
 *
 * Ils vivent donc ici, et les deux écrans les appellent. **Ce n'est pas un
 * branchement, c'est un déménagement** : le code est le même, seul son
 * domicile change. Je le dis plutôt que de le faire passer pour un ajout —
 * un remaniement présenté comme une fonctionnalité est une façon de ne pas
 * être relu.
 *
 * ## Ce qu'ils ne font pas
 *
 * Ils ne lisent ni n'écrivent aucun magasin, et ne connaissent aucune
 * tâche. Ils construisent des champs, les relisent, et disent ce qui
 * cloche. Décider d'écrire reste à l'écran qui les a montés — c'est ce qui
 * permet au calendrier de les utiliser sans hériter d'une politique
 * d'écriture qui n'est pas la sienne.
 */

import { libelleDeLaSerie, problemesDeLaSerie } from './repetition';
import type { Fin, JourSemaine, Repetition, Serie } from './repetition';

const NOMS_JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const COMPLETS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export interface ChampsDeSerie {
  element: HTMLElement;
  lire: () => Serie | null;
  /** Les problèmes de la série en cours de saisie. Vide si elle est saine. */
  problemes: () => string[];
}

/**
 * Les champs d'une série, posés une fois et réutilisés partout.
 *
 * ## Pourquoi une fabrique plutôt que du HTML
 *
 * Le même jeu de champs sert à **créer** une tâche répétée et à **modifier**
 * une série existante, et il y a autant de modifications possibles que de
 * cartes à l'écran. Deux copies — l'une en HTML, l'autre en JavaScript —
 * auraient divergé au premier champ ajouté, et la divergence se serait vue
 * sur l'un des deux chemins seulement.
 *
 * ## L'ancre, et pourquoi elle est une fonction
 *
 * Les règles mensuelles et annuelle ne portent aucune date : le quantième,
 * le rang et le mois sont **déduits de `depuis`**. L'ancre doit donc être
 * relue à chaque aperçu, puisqu'elle change quand la personne change la
 * date — d'où une fonction et non une valeur.
 */
export function champsDeSerie(
  prefixe: string,
  ancre: () => string,
  initiale: Serie | null = null,
): ChampsDeSerie {
  const element = document.createElement('div');

  const ligneChamps = document.createElement('div');
  ligneChamps.className = 'flex flex-wrap items-end gap-3';
  element.appendChild(ligneChamps);

  const etiquette = (texte: string) => {
    const l = document.createElement('label');
    l.className = 'text-sm';
    const s = document.createElement('span');
    s.className = 'block text-slate-700 dark:text-slate-200';
    s.textContent = texte;
    l.appendChild(s);
    return l;
  };

  const CLASSE_CHAMP =
    'mt-1 min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm ' +
    'dark:border-slate-700 dark:bg-slate-950';

  /* --- Le rythme --- */
  const labelRegle = etiquette('Rythme');
  const regle = document.createElement('select');
  regle.className = CLASSE_CHAMP;
  regle.dataset.regle = prefixe;
  for (const [valeur, texte] of [
    ['', 'Jamais'],
    ['jours', 'Tous les N jours'],
    ['semaines', 'Certains jours de la semaine'],
    ['mois-date', 'Chaque mois, le même quantième'],
    ['mois-rang', 'Chaque mois, le même rang'],
    ['annee', 'Chaque année'],
  ] as const) {
    const o = document.createElement('option');
    o.value = valeur;
    o.textContent = texte;
    regle.appendChild(o);
  }
  labelRegle.appendChild(regle);
  ligneChamps.appendChild(labelRegle);

  /* --- L'intervalle --- */
  const labelTous = etiquette('Tous les');
  labelTous.classList.add('hidden');
  const tous = document.createElement('input');
  tous.type = 'number';
  tous.min = '1';
  tous.max = '365';
  tous.value = '1';
  tous.className = `${CLASSE_CHAMP} w-20`;
  labelTous.appendChild(tous);
  ligneChamps.appendChild(labelTous);

  /* --- Les jours de la semaine --- */
  const blocJours = document.createElement('fieldset');
  blocJours.className = 'hidden text-sm';
  const legende = document.createElement('legend');
  legende.className = 'text-slate-700 dark:text-slate-200';
  legende.textContent = 'Quels jours';
  blocJours.appendChild(legende);
  const zoneJours = document.createElement('div');
  zoneJours.className = 'mt-1 flex flex-wrap gap-1';
  blocJours.appendChild(zoneJours);
  ligneChamps.appendChild(blocJours);

  /* Lundi d'abord : c'est l'ordre français. Zéro reste dimanche dans les
     données — la convention de `Date.getUTCDay()`, que le dépôt suit. */
  const casesJours: HTMLInputElement[] = [];
  for (const j of [1, 2, 3, 4, 5, 6, 0]) {
    const label = document.createElement('label');
    label.className =
      'flex min-h-11 w-11 cursor-pointer items-center justify-center rounded-lg ' +
      'border border-slate-300 text-sm dark:border-slate-700';
    label.title = COMPLETS[j];
    const caseJour = document.createElement('input');
    caseJour.type = 'checkbox';
    caseJour.className = 'sr-only';
    caseJour.dataset.jour = String(j);
    const texte = document.createElement('span');
    texte.textContent = NOMS_JOURS[j];
    const peindreCase = () => {
      label.classList.toggle('border-indigo-500', caseJour.checked);
      label.classList.toggle('bg-indigo-50', caseJour.checked);
      label.classList.toggle('dark:bg-indigo-950', caseJour.checked);
    };
    caseJour.addEventListener('change', () => {
      peindreCase();
      rafraichir();
    });
    label.append(caseJour, texte);
    zoneJours.appendChild(label);
    casesJours.push(caseJour);
  }

  /* --- L'heure --- */
  const labelHeure = etiquette('À quelle heure');
  const heure = document.createElement('input');
  heure.type = 'time';
  heure.className = CLASSE_CHAMP;
  labelHeure.appendChild(heure);
  ligneChamps.appendChild(labelHeure);

  /* --- La fin --- */
  const labelFin = etiquette('Jusqu’à quand');
  const fin = document.createElement('select');
  fin.className = CLASSE_CHAMP;
  for (const [valeur, texte] of [
    ['jamais', 'Sans fin'],
    ['date', 'Jusqu’à une date'],
    ['fois', 'Après N fois'],
  ] as const) {
    const o = document.createElement('option');
    o.value = valeur;
    o.textContent = texte;
    fin.appendChild(o);
  }
  labelFin.appendChild(fin);
  ligneChamps.appendChild(labelFin);

  const labelFinDate = etiquette('Date de fin');
  labelFinDate.classList.add('hidden');
  const finDate = document.createElement('input');
  finDate.type = 'date';
  finDate.className = CLASSE_CHAMP;
  labelFinDate.appendChild(finDate);
  ligneChamps.appendChild(labelFinDate);

  const labelFinFois = etiquette('Combien de fois');
  labelFinFois.classList.add('hidden');
  const finFois = document.createElement('input');
  finFois.type = 'number';
  finFois.min = '1';
  finFois.max = '999';
  finFois.value = '10';
  finFois.className = `${CLASSE_CHAMP} w-24`;
  labelFinFois.appendChild(finFois);
  ligneChamps.appendChild(labelFinFois);

  /*
     L'aperçu en clair. Il n'est pas décoratif : le prompt interdit qu'une
     série soit réécrite en silence, et une personne ne peut confirmer que
     ce qu'elle comprend. « toutes les 2 semaines, le lundi » se comprend ;
     une structure de données, non.
  */
  const apercu = document.createElement('p');
  apercu.className = 'mt-2 text-xs text-indigo-700 dark:text-indigo-300';
  apercu.dataset.apercu = prefixe;
  element.appendChild(apercu);

  const lire = (): Serie | null => {
    if (!regle.value) return null;
    const n = Math.max(1, Number(tous.value) || 1);
    const repetition: Repetition =
      regle.value === 'jours'
        ? { type: 'jours', tous: n }
        : regle.value === 'semaines'
          ? {
              type: 'semaines',
              tous: n,
              jours: casesJours
                .filter((c) => c.checked)
                .map((c) => Number(c.dataset.jour) as JourSemaine),
            }
          : regle.value === 'mois-date'
            ? { type: 'mois-date' }
            : regle.value === 'mois-rang'
              ? { type: 'mois-rang' }
              : { type: 'annee' };
    const quelleFin: Fin =
      fin.value === 'date'
        ? { type: 'date', jusquAu: finDate.value }
        : fin.value === 'fois'
          ? { type: 'fois', nombre: Math.max(1, Number(finFois.value) || 1) }
          : { type: 'jamais' };
    return { depuis: ancre(), repetition, fin: quelleFin, heure: heure.value || null };
  };

  /*
     Les problèmes s'affichent PENDANT la saisie et non à l'envoi : un refus
     après coup oblige à retrouver ce qu'on avait voulu dire.
  */
  function rafraichir() {
    labelTous.classList.toggle(
      'hidden',
      regle.value !== 'jours' && regle.value !== 'semaines',
    );
    blocJours.classList.toggle('hidden', regle.value !== 'semaines');
    labelFinDate.classList.toggle('hidden', fin.value !== 'date');
    labelFinFois.classList.toggle('hidden', fin.value !== 'fois');

    const serie = lire();
    if (!serie) {
      apercu.textContent = '';
      return;
    }
    const soucis = problemesDeLaSerie(serie);
    apercu.textContent = soucis.length ? soucis.join(' ') : libelleDeLaSerie(serie);
    apercu.classList.toggle('text-rose-700', soucis.length > 0);
    apercu.classList.toggle('dark:text-rose-300', soucis.length > 0);
    apercu.classList.toggle('text-indigo-700', soucis.length === 0);
    apercu.classList.toggle('dark:text-indigo-300', soucis.length === 0);
  }

  for (const champ of [regle, tous, heure, fin, finDate, finFois]) {
    champ.addEventListener('change', rafraichir);
    champ.addEventListener('input', rafraichir);
  }

  /* --- Pré-remplissage, pour une série existante --- */
  if (initiale) {
    regle.value = initiale.repetition.type;
    if (initiale.repetition.type === 'jours' || initiale.repetition.type === 'semaines') {
      tous.value = String(initiale.repetition.tous);
    }
    if (initiale.repetition.type === 'semaines') {
      const choisis = new Set<number>(initiale.repetition.jours);
      for (const c of casesJours) {
        c.checked = choisis.has(Number(c.dataset.jour));
        c.dispatchEvent(new Event('change'));
      }
    }
    heure.value = initiale.heure ?? '';
    fin.value = initiale.fin.type;
    if (initiale.fin.type === 'date') finDate.value = initiale.fin.jusquAu;
    if (initiale.fin.type === 'fois') finFois.value = String(initiale.fin.nombre);
  }
  rafraichir();

  return { element, lire, problemes: () => { const s = lire(); return s ? problemesDeLaSerie(s) : []; } };
}

