/**
 * Les désaccords entre branches, et ce qu'ils coûtent à la fiabilité.
 *
 * B.4 demande deux choses qu'aucun écran ne montre : que chaque règle de
 * conflit se déclenche sur un cas construit, et qu'un conflit resté ouvert
 * **dégrade** la fiabilité des indicateurs concernés. Les deux sont ici, avec
 * leurs contre-exemples — une règle qui se déclenche toujours ne sert à rien.
 */
import {
  ECART_POIDS_KG,
  REGLES_DESACCORD,
  TYPES_EXCLUSIFS,
  construireArbitrage,
  detecter,
  etatPourIndicateur,
  trierDesaccords,
} from '../src/lib/odyssee/desaccords';
import { TYPE_RESOLUTION } from '../src/lib/noyau/corrections';
import { SEUIL_EXPLOITABLE, fiabilite, integrite } from '../src/lib/odyssee/fiabilite';
import { typeDeFait, type Fait } from '../src/lib/noyau/faits';
import type { Operation } from '../src/lib/noyau/operations';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);

let compteur = 0;
interface Esquisse {
  type: string;
  jour: string;
  valeur?: number;
  de?: string;
  a?: string;
  details?: Record<string, unknown>;
}
const fait = (e: Esquisse): Fait => {
  const t = typeDeFait(e.type)!;
  compteur += 1;
  return {
    id: `${e.type}:${e.jour}:${compteur}`,
    branche: t.proprietaire,
    proprietaire: t.proprietaire,
    domaine: t.domaine,
    type: e.type,
    debut: e.de ?? `${e.jour}T10:00:00.000Z`,
    fin: e.a,
    jourLogique: e.jour,
    valeur: e.valeur,
    unite: t.unite,
    source: 'auto',
    fiabilite: 'confirme',
    version: 1,
    modifieLe: e.de ?? `${e.jour}T10:00:00.000Z`,
    details: e.details,
  };
};

const JOUR = '2026-05-12';

console.log('\nLE CATALOGUE DE RÈGLES EST COHÉRENT');

v(
  'chaque règle ne regarde que des types déclarés',
  REGLES_DESACCORD.flatMap((r) => r.types).filter((t) => !typeDeFait(t)),
  [],
);
v(
  'les identifiants de règle sont uniques',
  new Set(REGLES_DESACCORD.map((r) => r.id)).size,
  REGLES_DESACCORD.length,
);
v(
  'chaque règle dit pourquoi elle existe',
  REGLES_DESACCORD.filter((r) => r.pourquoi.length < 60).map((r) => r.id),
  [],
);
v(
  'les types exclusifs couvrent les trois activités qui prennent toute l’attention',
  [...TYPES_EXCLUSIFS].sort(),
  ['odyssee.focus', 'revision.seance', 'sport.seance'],
);

console.log('\nCHAQUE RÈGLE SE DÉCLENCHE SUR UN CAS CONSTRUIT');

{
  const revision = fait({
    type: 'revision.seance',
    jour: JOUR,
    de: `${JOUR}T18:00:00.000Z`,
    a: `${JOUR}T20:00:00.000Z`,
    valeur: 7200,
  });
  const sport = fait({
    type: 'sport.seance',
    jour: JOUR,
    de: `${JOUR}T19:00:00.000Z`,
    a: `${JOUR}T20:30:00.000Z`,
    valeur: 5400,
  });
  const vus = detecter([revision, sport]);
  v('chevauchement : une séance de sport dans une séance de révision', vus.length, 1);
  v('la gravité dit « impossible »', vus[0].gravite, 'impossible');
  v('les deux branches sont nommées', vus[0].branches, ['revisions', 'sport']);
  v('et les deux faits aussi', vus[0].faits.length, 2);

  const apres = fait({
    type: 'sport.seance',
    jour: JOUR,
    de: `${JOUR}T20:30:00.000Z`,
    a: `${JOUR}T21:00:00.000Z`,
    valeur: 1800,
  });
  v('deux activités qui se suivent ne se contredisent pas', detecter([revision, apres]).length, 0);
  const deuxRevisions = fait({
    type: 'revision.seance',
    jour: JOUR,
    de: `${JOUR}T19:30:00.000Z`,
    a: `${JOUR}T20:30:00.000Z`,
    valeur: 3600,
  });
  v(
    'deux séances du même type qui se chevauchent sont une saisie, pas un désaccord',
    detecter([revision, deuxRevisions]).length,
    0,
  );
}

{
  const nuit = fait({ type: 'odyssee.sommeil', jour: JOUR, valeur: 8 * 3600 });
  const sieste = fait({ type: 'odyssee.sommeil', jour: JOUR, valeur: 2 * 3600 });
  v('dix heures de sommeil dans une journée : rien à dire', detecter([nuit, sieste]).length, 0);
  const enorme = fait({ type: 'odyssee.sommeil', jour: JOUR, valeur: 20 * 3600 });
  const vus = detecter([nuit, enorme]);
  v('vingt-huit heures de sommeil : impossible', vus.length, 1);
  v('la règle est nommée', vus[0].regle, 'sommeil-impossible');
  vrai('et le résumé donne les deux durées', vus[0].resume.includes('28') && vus[0].resume.includes('24'));
}

{
  const matin = fait({ type: 'odyssee.poids', jour: JOUR, valeur: 78 });
  const soir = fait({ type: 'odyssee.poids', jour: JOUR, valeur: 78 + ECART_POIDS_KG });
  v('deux pesées proches ne se contredisent pas', detecter([matin, soir]).length, 0);
  const aberrante = fait({ type: 'odyssee.poids', jour: JOUR, valeur: 87 });
  const vus = detecter([matin, aberrante]);
  v('deux pesées éloignées, oui', vus.length, 1);
  v('et c’est une contradiction, pas un impossible', vus[0].gravite, 'contradiction');
  v('une seule pesée ne dit rien', detecter([matin]).length, 0);
}

{
  const sante = fait({
    type: 'odyssee.sante',
    jour: JOUR,
    details: { empecheEffort: true },
  });
  const seance = fait({ type: 'sport.seance', jour: JOUR, valeur: 3600 });
  const vus = detecter([sante, seance]);
  v('une séance un jour d’empêchement est signalée', vus.length, 1);
  v('les deux branches sont en cause', vus[0].branches, ['odyssee', 'sport']);
  const benin = fait({ type: 'odyssee.sante', jour: JOUR, details: { empecheEffort: false } });
  v('un jour de santé sans empêchement ne dit rien', detecter([benin, seance]).length, 0);
  v('un empêchement sans séance non plus', detecter([sante]).length, 0);
}

{
  const charge = fait({ type: 'odyssee.charge-percue', jour: JOUR, valeur: 7 });
  const checkin = fait({ type: 'odyssee.checkin', jour: JOUR, valeur: 6 });
  v('une charge perçue adossée à un check-in est normale', detecter([charge, checkin]).length, 0);
  const vus = detecter([charge]);
  v('une charge perçue orpheline est signalée', vus.length, 1);
  v('elle ne met en cause que le type dérivé', vus[0].types, ['odyssee.charge-percue']);
}

console.log('\nUN DÉSACCORD EST STABLE, SE TRANCHE, ET SE ROUVRE SI UN FAIT ARRIVE');

{
  const a = fait({ type: 'odyssee.poids', jour: JOUR, valeur: 78 });
  const b = fait({ type: 'odyssee.poids', jour: JOUR, valeur: 85 });
  const premier = detecter([a, b])[0];
  const rejoue = detecter([b, a])[0];
  v('l’identifiant ne dépend pas de l’ordre des faits', premier.cible, rejoue.cible);
  v('ni la liste des faits', premier.faits, rejoue.faits);

  const charge = construireArbitrage(premier, {
    issue: 'retenue',
    retenue: premier.faits[0],
  });
  v('la charge couvre les faits du désaccord', charge.couvre, premier.faits);
  v('et porte la règle dans son type', charge.typeEnConflit, 'desaccord:poids-deux-valeurs');

  const resolution: Operation = {
    id: '01RESOLUTION00000000000001',
    appareil: 'portable',
    hlc: '000000000000001-0000',
    type: TYPE_RESOLUTION,
    cible: premier.cible,
    lot: '',
    charge: charge as unknown as Record<string, unknown>,
  };
  const tri = trierDesaccords([premier], [resolution]);
  v('le désaccord est tranché', tri.tranches.length, 1);
  v('et n’est plus ouvert', tri.ouverts.length, 0);

  // Une troisième pesée arrive : la réponse donnée ne portait pas sur elle.
  const c = fait({ type: 'odyssee.poids', jour: JOUR, valeur: 90 });
  const rouvert = detecter([a, b, c])[0];
  const tri2 = trierDesaccords([rouvert], [resolution]);
  v('un fait nouveau rouvre la question', tri2.ouverts.length, 1);
  vrai('et l’écran peut dire qu’une partie avait été répondue', tri2.ouverts[0].repondueAvant !== undefined);

  let leve = '';
  try {
    construireArbitrage(premier, { issue: 'ignore' });
  } catch (e) {
    leve = (e as Error).message;
  }
  vrai('un « ignoré » sans motif est refusé', leve.includes('pourquoi'));
  let leve2 = '';
  try {
    construireArbitrage(premier, { issue: 'retenue', retenue: 'un-fait-etranger' });
  } catch (e) {
    leve2 = (e as Error).message;
  }
  vrai('retenir un fait étranger au désaccord est refusé', leve2.includes('partie du désaccord'));
  v(
    'les deux pesées peuvent être justes, à condition de le dire',
    construireArbitrage(premier, {
      issue: 'toutes-justes',
      precision: 'Une pesée avant la séance, une après.',
    }).precision,
    'Une pesée avant la séance, une après.',
  );
}

console.log('\nLA FIABILITÉ BAISSE QUAND UN DÉSACCORD RESTE OUVERT');

v('sans désaccord, l’intégrité vaut 1', integrite({ ouverts: 0 }), 1);
v('un désaccord ouvert la ramène à 0,5', integrite({ ouverts: 1 }), 0.5);
v('un désaccord sur le pivot l’annule', integrite({ ouverts: 1, pivotEnConflit: true }), 0);

{
  const parfait = {
    points: 30,
    minimumDePoints: 20,
    joursDepuisDerniereDonnee: 1,
    frequence: 'semaine' as const,
    joursRenseignes: 7,
    joursAttendus: 7,
    desaccords: { ouverts: 0 },
  };
  const bonne = fiabilite(parfait);
  v('un indicateur complet est pleinement fiable', bonne.valeur, 1);
  vrai('et exploitable', bonne.exploitable);
  v('il n’a aucun motif à afficher', bonne.motifs, []);

  const abimee = fiabilite({ ...parfait, desaccords: { ouverts: 1 } });
  v('un désaccord ouvert divise la fiabilité par deux', abimee.valeur, 0.5);
  vrai('elle reste tout juste exploitable', abimee.exploitable);
  vrai('et la raison est dite', abimee.motifs.some((m) => m.includes('désaccord')));

  const annulee = fiabilite({ ...parfait, desaccords: { ouverts: 1, pivotEnConflit: true } });
  v('un désaccord sur le pivot annule la fiabilité', annulee.valeur, 0);
  vrai('l’indicateur ne nourrit plus aucune trajectoire', !annulee.exploitable);

  const creuse = fiabilite({ ...parfait, points: 5, desaccords: { ouverts: 1 } });
  vrai('les composantes se multiplient, la plus faible commande', creuse.valeur < SEUIL_EXPLOITABLE);
  v('et les deux raisons sont dites', creuse.motifs.length, 2);

  const vieille = fiabilite({ ...parfait, joursDepuisDerniereDonnee: 14 });
  v('une donnée vieille de deux fenêtres ne décrit plus rien', vieille.valeur, 0);
  const trouee = fiabilite({ ...parfait, joursRenseignes: 3 });
  v('une série trouée fait baisser sans annuler', Math.round(trouee.valeur * 100) / 100, 0.43);
}

{
  /*
   * Le câblage que B.4 demande : la dégradation suit les **sources** de
   * l'indicateur, et le pivot est la première d'entre elles.
   */
  const poids = fait({ type: 'odyssee.poids', jour: JOUR, valeur: 78 });
  const autre = fait({ type: 'odyssee.poids', jour: JOUR, valeur: 86 });
  const ouverts = detecter([poids, autre]);

  v(
    'un indicateur de poids voit son pivot en conflit',
    etatPourIndicateur({ sources: ['odyssee.poids', 'odyssee.repas'] }, ouverts),
    { ouverts: 1, pivotEnConflit: true },
  );
  v(
    'un indicateur qui ne lit le poids qu’en secondaire est seulement abîmé',
    etatPourIndicateur({ sources: ['odyssee.repas', 'odyssee.poids'] }, ouverts),
    { ouverts: 1, pivotEnConflit: false },
  );
  v(
    'un indicateur qui ne lit pas le poids n’est pas touché',
    etatPourIndicateur({ sources: ['revision.flashcards'] }, ouverts),
    { ouverts: 0, pivotEnConflit: false },
  );
  v(
    'et la fiabilité qui en découle est bien nulle pour le premier',
    fiabilite({
      points: 30,
      minimumDePoints: 20,
      joursDepuisDerniereDonnee: 1,
      frequence: 'semaine',
      joursRenseignes: 7,
      joursAttendus: 7,
      desaccords: etatPourIndicateur({ sources: ['odyssee.poids'] }, ouverts),
    }).valeur,
    0,
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
