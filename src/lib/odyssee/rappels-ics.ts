/**
 * L'export des rappels de prise vers l'agenda — Santé, phase 4, P3.
 *
 * ## Pourquoi l'agenda, et pourquoi en premier
 *
 * Le plan Santé l'a écrit sans détour (§ 5, point 2) : « Un site statique ne
 * pousse rien quand il est fermé. L'ICS avec alarme est la seule voie qui
 * fasse sonner un téléphone. » La notification de Cyclades part quand
 * l'application est ouverte ou réveillée ; l'événement d'agenda sonne tout
 * seul, y compris téléphone verrouillé et application jamais rouverte.
 *
 * En contrepartie, et c'est dit à l'écran plutôt que caché : **l'agenda ne
 * sait pas si la prise a été notée.** Il sonne à l'heure prévue, jamais « en
 * cas d'oubli ». Le rappel d'oubli, lui, ne peut venir que de l'application.
 *
 * ## Le fuseau, et pourquoi il a fallu le décrire
 *
 * `ics.ts` écrit tout en UTC, et sa raison tient : « écrire une heure locale
 * obligerait à embarquer une définition de fuseau, et c'est là que les
 * implémentations divergent le plus ». Elle valait pour des événements
 * ponctuels. Elle ne tient plus pour une **récurrence** : un
 * `RRULE:FREQ=DAILY` posé sur un `DTSTART` en UTC garde l'heure UTC, donc
 * **change l'heure murale au passage à l'heure d'hiver**. Un rappel de 8 h
 * sonnerait à 9 h à partir du 25 octobre, tous les jours, sans que rien ne
 * le dise.
 *
 * Il faut donc `DTSTART;TZID=Europe/Paris` et le bloc `VTIMEZONE` qui va
 * avec. C'est le seul endroit du lot où une décision d'écriture est rouverte,
 * et elle l'est pour la raison qu'elle nommait elle-même.
 *
 * **Un seul fuseau est décrit**, et c'est volontaire : les règles d'heure
 * d'été se changent par décision politique, et en inventer pour un fuseau
 * qu'on n'a pas vérifié produirait des rappels faux d'une heure pendant six
 * mois. Un fuseau non décrit fait **refuser l'export**, avec son nom — un
 * refus se lit, une heure fausse ne se voit pas.
 *
 * ## Ce que le fichier ne porte pas
 *
 * Ni dose, ni posologie, ni molécule, ni motif — sauf si la personne choisit
 * le libellé `explicite` ou `personnalise`, avec l'avertissement du § 3.3.
 * Un `.ics` part dans un agenda qui est, pour la plupart des gens,
 * synchronisé chez un tiers : ce qu'on y écrit quitte l'appareil.
 * `controlerLExportDesRappels()` le vérifie sur un cas construit pour fuir.
 */
import { echapperIcs, envelopperIcs, versIcs } from './ics';
import {
  LIBELLE_NEUTRE,
  libelleDuRappel,
  rangerLesHeures,
  reglageParDefaut,
  type SchemaDePrise,
  type Traitement,
} from './sante';
import { FUSEAU_PAR_DEFAUT } from '../noyau/jour-logique';

/** Le préfixe des UID, pour qu'un réexport reconnaisse les siens. */
export const PREFIXE_UID = 'rappel-prise';

/**
 * Les fuseaux dont ce module sait écrire les règles.
 *
 * Un seul aujourd'hui. Les deux blocs suivent la règle de l'Union : l'heure
 * d'été commence le dernier dimanche de mars à 2 h locales et finit le
 * dernier dimanche d'octobre à 3 h locales. `DTSTART` s'y lit dans l'heure
 * **de départ** — c'est la norme, et c'est la seule subtilité du bloc.
 */
export const FUSEAUX_DECRITS: Readonly<Record<string, readonly string[]>> = {
  'Europe/Paris': [
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Paris',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ],
};

/** Les jours de la semaine, du modèle vers la norme. `0` est dimanche. */
const JOURS_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/**
 * La règle de récurrence d'un schéma.
 *
 * `UNTIL` est écrit en UTC — la norme l'exige pour une récurrence à `TZID`,
 * et c'est le seul endroit du fichier où une heure UTC a un sens. On prend
 * la fin du jour de fin, pour que l'occurrence de ce jour-là ait lieu : une
 * borne posée à minuit couperait la dernière prise.
 */
export function regleDeRecurrence(schema: SchemaDePrise, fin: string): string {
  const r = schema.repetition;
  const morceaux: string[] =
    r.type === 'semaines'
      ? [
          'FREQ=WEEKLY',
          ...(r.tous > 1 ? [`INTERVAL=${r.tous}`] : []),
          `BYDAY=${[...r.jours].sort((a, b) => a - b).map((j) => JOURS_ICS[j]).join(',')}`,
        ]
      : ['FREQ=DAILY', ...(r.tous > 1 ? [`INTERVAL=${r.tous}`] : [])];
  if (fin) morceaux.push(`UNTIL=${fin.replace(/-/g, '')}T235959Z`);
  return `RRULE:${morceaux.join(';')}`;
}

/** Une heure murale d'un jour donné, à la forme de la norme : `20261019T080000`. */
const horodatageLocal = (jour: string, heure: string): string =>
  `${jour.replace(/-/g, '')}T${heure.replace(':', '')}00`;

/**
 * Le premier jour où ce schéma a une occurrence, à partir du début du
 * traitement.
 *
 * `DTSTART` d'une récurrence doit être une occurrence : poser le début du
 * traitement un mardi pour une règle « lundi et jeudi » ferait naître, chez
 * certains agendas, une occurrence ce mardi-là — une prise que personne n'a
 * prévue.
 */
export function premierJour(t: Traitement, schema: SchemaDePrise): string | null {
  const r = schema.repetition;
  if (r.type === 'jours') return t.debut;
  const [a, m, j] = t.debut.split('-').map(Number);
  for (let decalage = 0; decalage < 7; decalage += 1) {
    const d = new Date(Date.UTC(a, m - 1, j) + decalage * 86_400_000);
    if (r.jours.includes(d.getUTCDay() as (typeof r.jours)[number])) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

export class FuseauNonDecrit extends Error {
  constructor(public readonly fuseau: string) {
    super(
      `Cyclades ne sait écrire les rappels d’agenda que pour le fuseau Europe/Paris, ` +
        `et le vôtre est « ${fuseau} ». Les rappels sonneraient à la mauvaise heure une ` +
        `partie de l’année, ce qui serait pire que pas de rappel du tout.`,
    );
    this.name = 'FuseauNonDecrit';
  }
}

/**
 * La durée d'un événement de rappel, en minutes.
 *
 * Quinze. Une durée nulle n'est pas affichée par certains agendas, et une
 * heure entière barrerait la matinée d'un bandeau pour un geste de trois
 * secondes.
 */
export const DUREE_MINUTES = 15;

/**
 * Les lignes `VEVENT` des rappels d'un traitement — une par heure prévue.
 *
 * Une par heure et non une seule à heures multiples : la norme n'a pas de
 * « plusieurs heures par jour » autrement qu'avec des récurrences
 * imbriquées, que les agendas lisent mal. Deux événements se lisent partout,
 * et chacun garde son UID, donc son identité au réexport.
 */
export function evenementsDeRappel(
  t: Traitement,
  maintenant: Date,
  fuseau = FUSEAU_PAR_DEFAUT,
): string[] {
  const schema = t.schema;
  const reglage = t.rappel ?? reglageParDefaut();
  /*
     Quatre refus, et chacun est une règle du prompt plutôt qu'une
     précaution : pas de rappel non demandé, pas de rappel sans schéma,
     JAMAIS pour une prise sporadique (interdit § 1), et rien pour un
     traitement déjà terminé.
  */
  if (!schema || !reglage.actif || t.sporadique) return [];
  if (!FUSEAUX_DECRITS[fuseau]) throw new FuseauNonDecrit(fuseau);

  const depart = premierJour(t, schema);
  if (!depart) return [];
  if (t.fin && t.fin < depart) return [];

  const titre = echapperIcs(libelleDuRappel(t));
  const horodatage = versIcs(maintenant.toISOString());
  const lignes: string[] = [];

  for (const heure of rangerLesHeures(schema.heures)) {
    const debut = horodatageLocal(depart, heure);
    const [h, m] = heure.split(':').map(Number);
    const finDuCreneau = new Date(Date.UTC(2000, 0, 1, h, m + DUREE_MINUTES));
    const finHeure = `${String(finDuCreneau.getUTCHours()).padStart(2, '0')}:${String(
      finDuCreneau.getUTCMinutes(),
    ).padStart(2, '0')}`;
    /*
       Un créneau de 23 h 50 déborderait sur le lendemain. On le ramène à la
       fin de la journée plutôt que d'écrire une date de fin antérieure à
       celle de début, que les agendas refusent.
    */
    const finLocale =
      finHeure <= heure ? horodatageLocal(depart, '23:59') : horodatageLocal(depart, finHeure);

    lignes.push(
      'BEGIN:VEVENT',
      /*
         L'UID dérive du traitement et de l'heure, jamais d'un tirage : c'est
         ce qui fait qu'un réexport MET À JOUR l'agenda au lieu d'y empiler
         un rappel de plus à chaque fois. Il porte un identifiant opaque, pas
         un nom.
      */
      `UID:${PREFIXE_UID}-${t.id}-${heure.replace(':', '')}@cyclades`,
      `DTSTAMP:${horodatage}`,
      `DTSTART;TZID=${fuseau}:${debut}`,
      `DTEND;TZID=${fuseau}:${finLocale}`,
      regleDeRecurrence(schema, t.fin),
      `SUMMARY:${titre}`,
      /*
         L'ALARME est ce que le § 5 n° 2 appelait « la seule voie qui fasse
         sonner un téléphone ». `TRIGGER:PT0S` la pose à l'heure même : un
         rappel de prise qui préviendrait dix minutes avant demanderait de
         décider à la place de la personne quand elle doit se préparer.
      */
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0S',
      `DESCRIPTION:${titre}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  return lignes;
}

/**
 * Le fichier `.ics` des rappels de tous les traitements qui en demandent.
 *
 * Rend une chaîne vide quand aucun n'en demande : un fichier d'agenda vide
 * téléchargé après un appui est pire qu'un bouton absent — il faut l'ouvrir
 * pour apprendre qu'il n'y avait rien.
 */
export function rappelsEnIcs(
  traitements: readonly Traitement[],
  maintenant = new Date(),
  fuseau = FUSEAU_PAR_DEFAUT,
): string {
  const corps = traitements.flatMap((t) => evenementsDeRappel(t, maintenant, fuseau));
  if (!corps.length) return '';
  return envelopperIcs([...FUSEAUX_DECRITS[fuseau], ...corps]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'un fichier de rappels n'a pas le droit de contenir.
 *
 * Construit sur un cas qui fuirait si rien ne l'en empêchait : un traitement
 * nommé, prescrit, avec une posologie, une note et une quantité. En libellé
 * neutre — le défaut — **rien de tout cela ne doit sortir**.
 *
 * C'est la même forme que `controlerLExportDEcheances()`, et pour la même
 * raison : un contrôle qui se contenterait de relire le code dirait que le
 * garde-fou est cité, jamais qu'il agit.
 */
export function controlerLExportDesRappels(): string[] {
  const problemes: string[] = [];
  const traitement: Traitement = {
    id: 't-01',
    nom: 'Testostérone énantate',
    moleculeId: 'testosterone-enantate',
    origine: 'prescrit',
    prescripteur: 'Dr Exemple',
    posologie: '250 mg tous les dix jours',
    sporadique: false,
    schema: {
      repetition: { type: 'jours', tous: 1 },
      heures: ['08:00', '20:00'],
      quantite: '250 mg',
    },
    rappel: { ...reglageParDefaut(), actif: true },
    debut: '2026-10-01',
    fin: '',
    note: 'Suivi au CHU',
    majLe: '2026-10-01T00:00:00.000Z',
  };
  const fichier = rappelsEnIcs([traitement], new Date('2026-10-19T10:00:00Z'));

  for (const fuite of [
    'Testostérone',
    'testosterone',
    '250 mg',
    'Dr Exemple',
    'prescrit',
    'CHU',
    'dix jours',
  ]) {
    if (fichier.includes(fuite)) {
      problemes.push(
        `Le fichier de rappels porte « ${fuite} ». Un .ics part dans un agenda ` +
          'synchronisé chez un tiers : en libellé neutre, il ne porte que « Rappel Cyclades ».',
      );
    }
  }
  if (!fichier.includes(`SUMMARY:${LIBELLE_NEUTRE}`)) {
    problemes.push('Le libellé par défaut n’est pas le libellé neutre.');
  }
  if (!fichier.includes('BEGIN:VALARM')) {
    problemes.push('Un rappel sans alarme ne sonne pas : c’est pourtant sa seule raison d’être.');
  }
  if (!fichier.includes('RRULE:FREQ=DAILY')) {
    problemes.push('Un schéma quotidien n’engendre pas de règle de récurrence.');
  }
  if (!fichier.includes('DTSTART;TZID=Europe/Paris:')) {
    problemes.push(
      'Les rappels sont écrits en UTC : ils dériveraient d’une heure au changement d’heure.',
    );
  }
  if (!fichier.includes('BEGIN:VTIMEZONE')) {
    problemes.push('Un TZID sans VTIMEZONE est un fuseau que l’agenda doit deviner.');
  }
  if (!fichier.endsWith('\r\n')) {
    problemes.push('Un fichier .ics sans CRLF final est refusé par certains agendas.');
  }
  return problemes;
}
