/**
 * Essais de la veille du rythme de vie, phase 1.
 *
 * Ce qui est éprouvé ici n'est pas que les calculs tombent juste — c'est que
 * les quatre règles qui empêchent la veille de mentir tiennent :
 *
 *   1. aucun indicateur ne peut se déclarer « solide » ;
 *   2. un jour non saisi n'est pas une valeur basse ;
 *   3. la base ne se laisse pas déplacer par un événement isolé ;
 *   4. la base se fige, sans quoi la dégradation devient la normale.
 */
import {
  CATALOGUE,
  DOMAINES,
  JOURS_DE_BASE_MINIMAUX,
  comptesDeJours,
  controlerCatalogue,
  ecartAbsoluMedian,
  fenetreRecente,
  ligneDeBase,
  mediane,
  suffisance,
  type Indicateur,
  type Mesure,
} from '../src/lib/odyssee/veille.ts';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(
    titre,
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`,
  );

const jourDecale = (depuis: string, jours: number) =>
  new Date(Date.parse(`${depuis}T12:00:00.000Z`) + jours * 86_400_000).toISOString().slice(0, 10);

const bon: Indicateur = {
  id: 'essai.bon',
  domaine: 'rythme',
  libelle: 'Essai',
  definition: 'Un indicateur d’essai.',
  unite: 'unités',
  sens: 'baisse',
  preuve: 'plausible',
  justification: 'Pour les essais.',
  confusions: ['une confusion'],
  saisie: 'observee',
  joursMinimaux: 10,
};

/* ── 1. Le catalogue ───────────────────────────────────────────────────── */

egal('1.1 le catalogue livré passe son propre contrôle', controlerCatalogue(), []);
verifier('1.2 le catalogue compte vingt-trois indicateurs', CATALOGUE.length === 23, `${CATALOGUE.length}`);
verifier(
  '1.3 tous les identifiants sont uniques',
  new Set(CATALOGUE.map((i) => i.id)).size === CATALOGUE.length,
);
verifier(
  '1.4 aucun indicateur livré ne se dit « solide »',
  CATALOGUE.every((i) => i.preuve !== 'solide'),
);
verifier(
  '1.5 un indicateur « solide » est refusé',
  controlerCatalogue([{ ...bon, preuve: 'solide' }]).some((p) => p.includes('solide')),
);
verifier(
  '1.6 une justification vide est refusée',
  controlerCatalogue([{ ...bon, justification: '   ' }]).some((p) => p.includes('justification')),
);
verifier(
  '1.7 un heuristique qui ne s’annonce pas est refusé',
  controlerCatalogue([{ ...bon, preuve: 'heuristique' }]).some((p) => p.includes('heuristique')),
);
verifier(
  // Un catalogue d'un seul indicateur déclenche par ailleurs la garde du
  // croisement ; ce qu'on vérifie ici est seulement qu'il ne déclenche plus
  // celle de la preuve.
  '1.8 un heuristique qui s’annonce passe',
  !controlerCatalogue([
    { ...bon, preuve: 'heuristique', justification: 'Raisonnement : parce que.' },
  ]).some((p) => p.includes('heuristique')),
);
verifier(
  '1.9 un indicateur sans facteur de confusion est refusé',
  controlerCatalogue([{ ...bon, confusions: [] }]).some((p) => p.includes('confusion')),
);
verifier(
  '1.10 un identifiant répété est refusé',
  controlerCatalogue([bon, bon]).some((p) => p.includes('deux fois')),
);
verifier(
  '1.11 un catalogue sans domaine entièrement observé est refusé',
  controlerCatalogue([{ ...bon, saisie: 'declarative' }]).some((p) => p.includes('observé')),
);
verifier(
  '1.12 le domaine « lien » ne compte pas dans le croisement',
  DOMAINES.lien.compteDansLeCroisement === false,
);
verifier(
  '1.13 le domaine « rythme » est entièrement observé',
  CATALOGUE.filter((i) => i.domaine === 'rythme').every((i) => i.saisie === 'observee'),
);
verifier(
  '1.14 au moins trois domaines comptants portent un indicateur observé',
  new Set(
    CATALOGUE.filter((i) => i.saisie === 'observee' && DOMAINES[i.domaine].compteDansLeCroisement).map(
      (i) => i.domaine,
    ),
  ).size >= 3,
);

/* ── 2. Médiane et écart absolu médian ─────────────────────────────────── */

egal('2.1 médiane d’un nombre impair de valeurs', mediane([3, 1, 2]), 2);
egal('2.2 médiane d’un nombre pair de valeurs', mediane([1, 2, 3, 4]), 2.5);
egal('2.3 médiane d’une seule valeur', mediane([7]), 7);
egal('2.4 médiane de rien vaut null, pas zéro', mediane([]), null);
egal('2.5 la médiane ne dépend pas de l’ordre', mediane([9, 1, 5, 2, 8]), mediane([1, 2, 5, 8, 9]));
egal('2.6 ÉAM d’un cas connu', ecartAbsoluMedian([1, 2, 3, 4, 5]), 1);
egal('2.7 ÉAM de valeurs identiques vaut zéro', ecartAbsoluMedian([4, 4, 4]), 0);
egal('2.8 ÉAM de rien vaut null', ecartAbsoluMedian([]), null);

{
  // La robustesse, démontrée plutôt qu'affirmée : sept nuits régulières,
  // puis une nuit blanche.
  const regulier = [7, 7.2, 7.1, 6.9, 7, 7.3, 6.8];
  const avecUneNuitBlanche = [...regulier, 1];
  const ecartType = (xs: number[]) => {
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
  };
  const eamAvant = ecartAbsoluMedian(regulier)!;
  const eamApres = ecartAbsoluMedian(avecUneNuitBlanche)!;
  const etAvant = ecartType(regulier);
  const etApres = ecartType(avecUneNuitBlanche);
  verifier(
    '2.9 une nuit blanche multiplie l’écart-type par plus de trois',
    etApres / etAvant > 3,
    `${(etApres / etAvant).toFixed(1)}×`,
  );
  verifier(
    '2.10 la même nuit laisse l’ÉAM sous le double',
    eamApres / eamAvant < 2,
    `${(eamApres / eamAvant).toFixed(1)}×`,
  );
  verifier(
    '2.11 la médiane bouge de moins de 0,2 h',
    Math.abs(mediane(avecUneNuitBlanche)! - mediane(regulier)!) < 0.2,
  );
}

/* ── 3. La ligne de base ───────────────────────────────────────────────── */

const LUNDI = '2026-08-03';
verifier('3.0 le jour de référence des essais est bien un lundi', new Date(`${LUNDI}T12:00:00.000Z`).getUTCDay() === 1);

{
  // Huit semaines : 8 h en semaine, 10 h le week-end.
  const mesures: Mesure[] = [];
  for (let d = 0; d < 56; d += 1) {
    const jour = jourDecale(LUNDI, d);
    const we = [0, 6].includes(new Date(`${jour}T12:00:00.000Z`).getUTCDay());
    mesures.push({ jour, valeur: we ? 10 : 8 });
  }
  const fin = jourDecale(LUNDI, 55);
  const base = ligneDeBase('sommeil.duree', mesures, fin);
  egal('3.1 la médiane des jours ouvrés est celle des jours ouvrés', base.ouvre?.mediane, 8);
  egal('3.2 la médiane du week-end est celle du week-end', base.weekEnd?.mediane, 10);
  egal('3.3 quarante jours ouvrés sur huit semaines', base.ouvre?.jours, 40);
  egal('3.4 seize jours de week-end sur huit semaines', base.weekEnd?.jours, 16);
  verifier(
    '3.5 sans séparation, la médiane serait fausse',
    mediane(mesures.map((m) => m.valeur)) === 8 && base.weekEnd!.mediane !== 8,
  );
  egal('3.6 la base dit jusqu’où elle regarde', base.arreteeAu, fin);
}

{
  // Un jour non saisi n'est pas un zéro.
  const complet: Mesure[] = [];
  for (let d = 0; d < 56; d += 1) complet.push({ jour: jourDecale(LUNDI, d), valeur: 8 });
  const troue = complet.filter((_, i) => i % 3 !== 0);
  const fin = jourDecale(LUNDI, 55);
  const a = ligneDeBase('x', complet, fin);
  const b = ligneDeBase('x', troue, fin);
  egal('3.7 un tiers de jours manquants ne change pas la médiane', b.ouvre?.mediane, a.ouvre?.mediane);
  verifier(
    '3.8 mais le nombre de jours, lui, baisse — l’absence se voit',
    b.ouvre!.jours < a.ouvre!.jours,
  );
  verifier(
    '3.9 un jour manquant n’est jamais compté zéro',
    b.ouvre!.mediane === 8 && ecartAbsoluMedian(troue.map((m) => m.valeur)) === 0,
  );
}

{
  // Le gel protège contre la dérive lente, et non contre un creux passager —
  // ce dernier, la médiane s'en charge déjà.
  const mesures: Mesure[] = [];
  for (let d = 0; d < 56; d += 1) mesures.push({ jour: jourDecale(LUNDI, d), valeur: 8 });
  const veilleDuSignal = jourDecale(LUNDI, 55);

  for (let d = 56; d < 70; d += 1) mesures.push({ jour: jourDecale(LUNDI, d), valeur: 4 });
  const apresDeuxSemaines = ligneDeBase('x', mesures, jourDecale(LUNDI, 69));
  egal('3.10 deux semaines de creux ne déplacent pas même la base glissante', apresDeuxSemaines.ouvre?.mediane, 8);

  for (let d = 70; d < 96; d += 1) mesures.push({ jour: jourDecale(LUNDI, d), valeur: 4 });
  const aujourdhui = jourDecale(LUNDI, 95);
  const figee = ligneDeBase('x', mesures, veilleDuSignal);
  const glissante = ligneDeBase('x', mesures, aujourdhui);
  egal('3.11 la base figée garde la référence d’avant le signal', figee.ouvre?.mediane, 8);
  egal('3.12 la base glissante, elle, a fait de la dégradation la normale', glissante.ouvre?.mediane, 4);
  verifier(
    '3.13 c’est pour cela que la date d’arrêt est un paramètre, et non « maintenant »',
    figee.arreteeAu !== glissante.arreteeAu,
  );
}

{
  // La fenêtre de référence exclut ce qui la précède et ce qui la suit.
  const mesures: Mesure[] = [
    { jour: jourDecale(LUNDI, -1), valeur: 100 },
    { jour: LUNDI, valeur: 1 },
    { jour: jourDecale(LUNDI, 1), valeur: 1 },
    { jour: jourDecale(LUNDI, 2), valeur: 200 },
  ];
  const base = ligneDeBase('x', mesures, jourDecale(LUNDI, 1), 7);
  egal('3.14 la fenêtre ignore l’avant et l’après', base.ouvre?.mediane, 1);
  egal('3.15 et ne compte que ce qu’elle a retenu', base.ouvre?.jours, 2);
}

egal(
  '3.16 une base sans aucune mesure vaut null, pas zéro',
  ligneDeBase('x', [], LUNDI).ouvre,
  null,
);

/* ── 4. Fenêtre récente et comptes ─────────────────────────────────────── */

{
  const mesures: Mesure[] = [];
  for (let d = 0; d < 30; d += 1) mesures.push({ jour: jourDecale(LUNDI, d), valeur: 1 });
  const fin = jourDecale(LUNDI, 29);
  egal('4.1 la fenêtre de quatorze jours en contient quatorze', fenetreRecente(mesures, fin).length, 14);
  egal(
    '4.2 elle commence au bon jour, bornes incluses',
    fenetreRecente(mesures, fin)[0].jour,
    jourDecale(fin, -13),
  );
  egal('4.3 et finit au jour d’arrêt', fenetreRecente(mesures, fin).at(-1)?.jour, fin);
}

{
  const fin = jourDecale(LUNDI, 55);
  const plein: Mesure[] = [];
  for (let d = 0; d < 56; d += 1) plein.push({ jour: jourDecale(LUNDI, d), valeur: 1 });
  const comptes = comptesDeJours(
    {
      'sommeil.duree': plein,
      'usage.duree': plein.filter((_, i) => i % 2 === 0),
      'poids.variation': [],
    },
    fin,
  );
  egal('4.4 un indicateur plein a quatorze jours dans la fenêtre', comptes['sommeil.duree'].joursDansLaFenetre, 14);
  egal('4.5 et cinquante-six jours de base', comptes['sommeil.duree'].joursDeBase, 56);
  egal('4.6 un jour sur deux en donne sept', comptes['usage.duree'].joursDansLaFenetre, 7);
  egal('4.7 un indicateur vide compte zéro, et non rien', comptes['poids.variation'].joursDeBase, 0);

  const doublons: Mesure[] = [
    { jour: fin, valeur: 1 },
    { jour: fin, valeur: 2 },
  ];
  egal(
    '4.8 deux mesures le même jour font un jour',
    comptesDeJours({ x: doublons }, fin).x.joursDansLaFenetre,
    1,
  );
}

/* ── 5. La suffisance ──────────────────────────────────────────────────── */

const assez = (ids: readonly string[]) =>
  Object.fromEntries(ids.map((id) => [id, { joursDansLaFenetre: 14, joursDeBase: 56 }]));

{
  const s = suffisance(
    assez(['sommeil.duree', 'sommeil.phase', 'usage.duree', 'usage.heure-tardive', 'focus.minutes', 'taches.report']),
  );
  egal('5.1 six indicateurs sur trois domaines activent la veille', s.statut, 'active');
  egal('5.2 les trois domaines sont nommés', [...s.domaines].sort(), ['engagement', 'rythme', 'sommeil']);
}

{
  const s = suffisance(assez(['sommeil.duree', 'sommeil.phase', 'usage.duree', 'usage.heure-tardive', 'focus.minutes']));
  egal('5.3 cinq indicateurs ne suffisent pas', s.statut, 'donnees-insuffisantes');
  verifier('5.4 et le manque est chiffré', s.manques[0].includes('5 indicateur'), s.manques[0]);
}

{
  const s = suffisance(
    assez([
      'sommeil.duree',
      'sommeil.phase',
      'sommeil.irregularite',
      'sommeil.nuits-courtes',
      'usage.duree',
      'usage.heure-tardive',
    ]),
  );
  egal('5.5 six indicateurs sur deux domaines ne suffisent pas', s.statut, 'donnees-insuffisantes');
}

{
  // Le domaine « lien » ne peut pas faire le troisième.
  const s = suffisance(
    assez([
      'sommeil.duree',
      'sommeil.phase',
      'usage.duree',
      'usage.heure-tardive',
      'agenda.annulations',
      'agenda.densite',
    ]),
  );
  egal('5.6 « lien » ne complète pas le croisement', s.statut, 'donnees-insuffisantes');
  verifier('5.7 et il n’apparaît pas dans les domaines comptés', !s.domaines.includes('lien'));
  verifier('5.8 bien que ses indicateurs soient éligibles', s.eligibles.includes('agenda.densite'));
}

{
  const s = suffisance({
    'sommeil.duree': { joursDansLaFenetre: 4, joursDeBase: 56 },
    'usage.duree': { joursDansLaFenetre: 14, joursDeBase: 10 },
  });
  verifier(
    '5.9 un indicateur trop peu saisi est nommé, avec son compte',
    s.manques.some((m) => m.includes('Durée de sommeil') && m.includes('4 jour')),
    s.manques.join(' | '),
  );
  verifier(
    '5.10 un historique trop court est distingué d’une fenêtre trop vide',
    s.manques.some((m) => m.includes('Durée des sessions') && m.includes(`${JOURS_DE_BASE_MINIMAUX}`)),
    s.manques.join(' | '),
  );
}

{
  const s = suffisance({ 'sommeil.duree': { joursDansLaFenetre: 14, joursDeBase: 56 } });
  egal('5.11 les vingt-deux autres sont « jamais renseignés »', s.jamaisRenseignes.length, 22);
  verifier(
    '5.12 et ils ne noient pas la liste des manques',
    s.manques.length === 1,
    s.manques.join(' | '),
  );
}

{
  const s = suffisance({ 'sommeil.duree': { joursDansLaFenetre: 0, joursDeBase: 0 } });
  verifier(
    '5.13 zéro partout compte comme jamais renseigné, non comme un manque',
    s.jamaisRenseignes.includes('sommeil.duree') && !s.manques.some((m) => m.includes('Durée de sommeil')),
  );
}

egal(
  '5.14 sans aucune donnée, la veille le dit au lieu de se taire',
  suffisance({}).statut,
  'donnees-insuffisantes',
);
verifier(
  '5.15 une veille inactive explique toujours pourquoi',
  suffisance({}).manques.length > 0,
);

/* ── Bilan ─────────────────────────────────────────────────────────────── */

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
