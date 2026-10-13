/**
 * Le taux de faux signaux de la veille, mesuré plutôt qu'espéré.
 *
 * Le plan se fixait **au plus un signal par an** sur une série stable avec du
 * bruit réaliste. Ce script donne le chiffre obtenu, pas celui visé — et s'il
 * est mauvais, c'est le chiffre qui a raison.
 *
 * ## Deux comptes, et ils ne disent pas la même chose
 *
 * - **Brut** : ce que le moteur lèverait sans cadence. C'est la mesure de la
 *   détection elle-même, et la seule qui réponde d'un réglage de seuil.
 * - **Vécu** : ce que la personne voit réellement, une fois le silence qui
 *   suit chaque réponse appliqué. C'est le chiffre qui compte pour savoir si
 *   le dispositif est supportable — mais il flatte, puisqu'un seul repère mal
 *   placé en masque deux autres.
 *
 * Les deux sont rapportés. Ne retenir que le second reviendrait à régler la
 * sensibilité sur la longueur du silence.
 *
 * ## Ce que ce chiffre n'est pas
 *
 * Ce n'est **pas** un taux de faux positifs au sens clinique, parce qu'il n'y
 * a pas de vrais positifs à lui opposer : aucune vérité terrain n'existe. Il
 * dit une seule chose, utile et limitée : à quelle fréquence une personne
 * dont rien ne se dégrade serait dérangée.
 */
import { REGLAGES, type Sensibilite } from '../src/lib/odyssee/moteur-veille.ts';
import { decider, enregistrer, repondre, tourDeVeille, type EtatVeille, type SignalEnregistre } from '../src/lib/odyssee/signal-veille.ts';
import { REGLAGES_PAR_DEFAUT } from '../src/lib/odyssee/signal-veille.ts';
import { vieQuiSeDegrade, vieStable } from './lib/vies-synthetiques.mts';
import type { Mesure } from '../src/lib/odyssee/veille.ts';

const ajouterJours = (jour: string, n: number) =>
  new Date(Date.parse(`${jour}T12:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);

const DEBUT = '2021-01-04';
const ANNEES = 5;
const JOURS = 365 * ANNEES;
/** On ne commence à compter qu'une fois la base constituée. */
const ECHAUFFEMENT = 84;

interface Resultat {
  brut: number;
  vecu: number;
  premier: string | null;
}

/**
 * Déroule une vie jour par jour, et compte.
 *
 * Le parcours est **séquentiel**, et c'est indispensable : la base figée, le
 * silence après réponse et la règle du repère unique dépendent tous de l'état
 * de la veille. Évaluer chaque jour indépendamment donnerait un autre chiffre,
 * plus grand, et qui ne correspondrait à l'expérience de personne.
 */
function derouler(
  mesures: Record<string, Mesure[]>,
  sensibilite: Sensibilite,
  reponse: 'vu' | 'pas-pertinent' = 'vu',
): Resultat {
  let etat: EtatVeille = {
    reglages: { ...REGLAGES_PAR_DEFAUT, active: true, sensibilite, majLe: DEBUT },
    ouvert: null,
    dernierClos: null,
  };
  let brut = 0;
  let vecu = 0;
  let premier: string | null = null;

  for (let d = ECHAUFFEMENT; d < JOURS; d += 1) {
    const jour = ajouterJours(DEBUT, d);

    // Le compte brut : ce que le moteur dirait sans aucune cadence.
    const nu = tourDeVeille({
      jour,
      etat: { reglages: { ...etat.reglages, evalueeLe: null }, ouvert: null, dernierClos: null },
      mesures,
      sensibilite,
    } as never);
    if (nu.leve) brut += 1;

    // Le compte vécu : avec la cadence, et une personne qui répond aussitôt.
    const tour = tourDeVeille({ jour, etat, mesures });
    if (tour.leve) {
      vecu += 1;
      premier ??= jour;
      const clos = repondre(tour.leve, reponse, jour);
      etat = { reglages: tour.reglages, ouvert: null, dernierClos: clos };
    } else if (tour.decision.quoi === 'montrer') {
      const clos = repondre(tour.decision.signal, reponse, jour);
      etat = { reglages: tour.reglages, ouvert: null, dernierClos: clos };
    } else {
      etat = { ...etat, reglages: tour.reglages };
    }
  }
  const annees = (JOURS - ECHAUFFEMENT) / 365;
  return { brut: brut / annees, vecu: vecu / annees, premier };
}

const pourcent = (x: number) => x.toFixed(2).padStart(6);

console.log('\n\x1b[1mTAUX DE FAUX SIGNAUX — vies stables, cinq ans, dix graines\x1b[0m');
console.log('  (une vie « stable » n’a ni tendance ni rupture : tout signal y est faux)\n');
console.log('  Sensibilité   Seuil  Fenêtre  k   Brut/an   Vécu/an   Cible');
console.log('  ' + '─'.repeat(62));

const GRAINES = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const bilan: Record<string, { brut: number; vecu: number }> = {};

for (const s of ['discrete', 'standard', 'attentive'] as Sensibilite[]) {
  let brut = 0;
  let vecu = 0;
  for (const graine of GRAINES) {
    const r = derouler(vieStable({ debut: DEBUT, jours: JOURS, graine }), s);
    brut += r.brut;
    vecu += r.vecu;
  }
  brut /= GRAINES.length;
  vecu /= GRAINES.length;
  bilan[s] = { brut, vecu };
  const g = REGLAGES[s];
  const verdict = vecu <= 1 ? '\x1b[32m✓ tenue\x1b[0m' : '\x1b[31m✗ dépassée\x1b[0m';
  console.log(
    `  ${g.libelle.padEnd(12)} ${String(g.seuil).padStart(4)}  ${String(g.persistance).padStart(5)} j  ${g.k}  ${pourcent(brut)}    ${pourcent(vecu)}   ${verdict}`,
  );
}

/*
   L'ampleur de la dégradation d'épreuve a été portée de quatre planchers à
   six, et le chiffre qu'on lisait avant valait la correction : à quatre, le
   dispositif ne voyait presque rien, et les rares « détections » tombaient
   des centaines de jours plus tard — c'étaient des coïncidences tardives,
   pas des détections. Un délai médian de quatre cent soixante-dix jours sur
   une dégradation commencée au jour quatre cents aurait dû sauter aux yeux,
   et il ne l'a fait qu'une fois le chiffre écrit noir sur blanc.
*/
const AMPLEUR = 6;

console.log('\n\x1b[1mET LE DISPOSITIF N’EST PAS MUET POUR AUTANT\x1b[0m');
console.log(`  (une dégradation de ${AMPLEUR} planchers sur trois domaines, au jour 400)\n`);

for (const s of ['discrete', 'standard', 'attentive'] as Sensibilite[]) {
  let vus = 0;
  let delais: number[] = [];
  for (const graine of GRAINES) {
    const r = derouler(vieQuiSeDegrade(400, AMPLEUR, { debut: DEBUT, jours: JOURS, graine }), s);
    if (r.premier) {
      const d = Math.round((Date.parse(r.premier) - Date.parse(ajouterJours(DEBUT, 400))) / 86_400_000);
      /*
         Au-delà de cent vingt jours, ce n'est plus une détection de cette
         dégradation : c'est un signal qui serait arrivé de toute façon. Le
         compter aurait flatté le dispositif.
      */
      if (d >= 0 && d <= 120) {
        vus += 1;
        delais.push(d);
      }
    }
  }
  const median = delais.length
    ? [...delais].sort((a, b) => a - b)[Math.floor(delais.length / 2)]
    : null;
  console.log(
    `  ${REGLAGES[s].libelle.padEnd(12)} remarquée sur ${String(vus).padStart(2)} vies sur ${GRAINES.length}` +
      (median === null ? '' : `, au bout de ${median} jours en médiane`),
  );
}

console.log(
  '\n  Ces chiffres ne sont pas une sensibilité ni une spécificité : il n’existe\n' +
    '  aucune vérité terrain à laquelle les comparer. Ils disent seulement à quelle\n' +
    '  fréquence une personne dont rien ne se dégrade serait dérangée, et si une\n' +
    '  dégradation franche finit par se voir.\n',
);
