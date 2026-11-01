/**
 * LE JOUR LOGIQUE, POUR LES ESSAIS DE NAVIGATEUR.
 *
 * ## Le défaut que cette fonction existe pour empêcher
 *
 * Seize essais calculent « aujourd'hui » par `new Date().toISOString().slice(0, 10)`.
 * C'est la date CALENDAIRE, en UTC. Or les écrans d'Odyssée — l'agenda, le
 * calendrier, les tâches, la revue — n'emploient pas la date calendaire : ils
 * emploient le **jour logique**, qui bascule à 4 h du matin, heure de Paris.
 * Une soirée qui se prolonge appartient à la journée commencée la veille, et
 * c'est délibéré.
 *
 * Les deux coïncident la plus grande partie du temps, et divergent chaque nuit
 * entre minuit et 4 h de Paris. Un essai qui compare la date calendaire à ce
 * que l'écran affiche est donc VERT le jour et ROUGE la nuit, sans qu'une
 * seule ligne de code ait bougé.
 *
 * MESURÉ, ET NON SUPPOSÉ. La batterie complète de `main` du 1er novembre 2026
 * a rendu quatre rouges — `calendrier-occurrences`, `taches-parcours`,
 * `phase6-ecrans`, `branche-vers-tache` — qui tenaient tous à cela. Le peintre
 * du calendrier, instrumenté, l'a dit en une ligne :
 *
 *     [peindre] 1 DESSINE vue=semaine occ=1 fenetre=2026-10-26..2026-11-01
 *     [peindre] 2 DESSINE vue=jour    occ=0 fenetre=2026-10-31..2026-10-31
 *
 * La vue « jour » visait le 31 quand l'essai attendait le 1er. L'écran avait
 * raison ; l'essai mesurait autre chose que ce qu'il croyait.
 *
 * ## Pourquoi une copie de la règle, et comment elle ne dérive pas
 *
 * Les essais de navigateur sont en JavaScript simple et ne peuvent pas importer
 * `src/lib/noyau/jour-logique.ts`. La règle est donc réécrite ici — ce qui
 * serait dangereux si rien ne la confrontait à l'originale. `essais:jour-logique`
 * compare les deux sur une série d'instants, dont ceux qui encadrent la
 * bascule : si l'une des deux change, la garde rougit.
 *
 * Un essai qui aurait vraiment besoin de la date calendaire — un export ICS,
 * par exemple, dont les dates sont calendaires par définition — ne doit pas
 * employer cette fonction. Le critère est simple : **ce que l'écran mesuré
 * emploie**, et non ce qui est commode.
 */

/** L'heure de bascule et le fuseau, qui doivent suivre `src/lib/noyau/jour-logique.ts`. */
export const HEURE_BASCULE = 4;
export const FUSEAU = 'Europe/Paris';

/**
 * Le jour logique d'un instant, au format `AAAA-MM-JJ`.
 *
 * L'heure locale est lue par `Intl` plutôt que par un décalage en dur : le
 * passage à l'heure d'hiver change l'écart avec UTC, et un décalage écrit à la
 * main serait faux la moitié de l'année.
 */
export function jourLogiqueDEssai(instant = new Date()) {
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: FUSEAU,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const lire = (type) => Number(parties.find((p) => p.type === type).value);
  const [annee, mois, jour, heure] = [lire('year'), lire('month'), lire('day'), lire('hour')];

  const iso = (a, m, j) =>
    `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
  if (heure >= HEURE_BASCULE) return iso(annee, mois, jour);

  /* La veille, calculée en UTC pour que le passage d'un mois ou d'une année ne
     soit pas à refaire à la main — comme dans le module d'origine. */
  const veille = new Date(Date.UTC(annee, mois - 1, jour) - 86_400_000);
  return iso(veille.getUTCFullYear(), veille.getUTCMonth() + 1, veille.getUTCDate());
}
