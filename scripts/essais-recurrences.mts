/**
 * Essais de la déduction du budget depuis le réel — 1.5, phase 3.
 *
 * Ce que ces essais cherchent à empêcher, dans l'ordre de ce que ça coûte :
 *
 *  1. **Deux lignes pour une même charge**, quand la banque renomme un
 *     libellé en cours d'année. Validées, elles doublent le budget sans que
 *     rien ne le signale.
 *  2. **Une périodicité tirée de deux points**, qui est toujours vraie et ne
 *     dit donc rien.
 *  3. **Une moyenne à la place d'une médiane**, qu'une régularisation
 *     annuelle suffit à fausser onze mois sur douze.
 */
import type { OperationBancaire } from '../src/lib/odyssee/finances';
import {
  DISPERSION_FIXE,
  DISPERSION_FOURCHETTE,
  JOURS_DE_JEU,
  OCCURRENCES_MINIMALES,
  candidats,
  controlerLesRecurrences,
  detecterLesRecurrences,
  enLigneDeBudget,
  mediane,
} from '../src/lib/odyssee/recurrences';
import { controlerLigne } from '../src/lib/odyssee/budget';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

let n = 0;
const op = (jour: string, centimes: number, libelle: string): OperationBancaire => ({
  id: `OP${(n += 1)}`,
  compteId: 'C1',
  jour,
  centimes,
  libelle,
  categorie: '',
  transfertAvec: null,
  majLe: `${jour}T10:00:00.000Z`,
});

/** Douze mois d'un prélèvement au même jour du mois. */
const mensuel = (jourDuMois: number, centimes: (m: number) => number, libelle: (m: number) => string, mois = 12) =>
  Array.from({ length: mois }, (_, i) =>
    op(`2026-${String(i + 1).padStart(2, '0')}-${String(jourDuMois).padStart(2, '0')}`,
      centimes(i), libelle(i)));

console.log('\n1. CE QU’ON PEUT LIRE DANS UN HISTORIQUE');

{
  const operations = mensuel(5, () => -78000, () => 'VIR M DUPONT LOYER');
  const [r] = detecterLesRecurrences(operations);
  egal('1.1 une seule récurrence', detecterLesRecurrences(operations).length, 1);
  egal('1.2 mensuelle', r.periodicite, 'mensuelle');
  egal('1.3 le 5', r.jourAttendu, 5);
  egal('1.4 pour 780 €', r.montant, 78000);
  egal('1.5 c’est une charge', r.sens, 'charge');
  egal('1.6 de nature fixe', r.nature, 'fixe');
  egal('1.7 sans dispersion', r.dispersion, 0);
  egal('1.8 sur douze opérations', r.operationIds.length, 12);
  verifier('1.9 et le fondement dit sur quoi elle repose',
    r.fondement.includes('12 opérations') && r.fondement.includes('Montant constant'), r.fondement);
}

{
  /* Un salaire : même chose, dans l'autre sens. */
  const operations = mensuel(28, () => 235000, () => 'VIR SALAIRE TRESOR PUBLIC');
  const [r] = detecterLesRecurrences(operations);
  egal('1.10 une ressource est reconnue comme telle', r.sens, 'ressource');
  egal('1.11 au 28', r.jourAttendu, 28);
}

{
  /* Hebdomadaire : tous les lundis. 2026-01-05 est un lundi. */
  const operations = Array.from({ length: 10 }, (_, i) =>
    op(new Date(Date.UTC(2026, 0, 5 + i * 7)).toISOString().slice(0, 10), -2000, 'ABONNEMENT TRANSPORT'));
  const [r] = detecterLesRecurrences(operations);
  egal('1.12 l’hebdomadaire est reconnue', r.periodicite, 'hebdomadaire');
  egal('1.13 et le jour est le lundi', r.jourAttendu, 1);
}

{
  /* Trimestrielle, et annuelle. */
  const trim = [op('2026-01-15', -15000, 'PRLV TAXE FONCIERE ACOMPTE'),
    op('2026-04-15', -15000, 'PRLV TAXE FONCIERE ACOMPTE'),
    op('2026-07-16', -15000, 'PRLV TAXE FONCIERE ACOMPTE'),
    op('2026-10-15', -15000, 'PRLV TAXE FONCIERE ACOMPTE')];
  egal('1.14 la trimestrielle est reconnue', detecterLesRecurrences(trim)[0].periodicite, 'trimestrielle');

  const an = [op('2024-03-10', -15000, 'PRLV ASSURANCE HABITATION'),
    op('2025-03-12', -15000, 'PRLV ASSURANCE HABITATION'),
    op('2026-03-09', -15000, 'PRLV ASSURANCE HABITATION')];
  egal('1.15 l’annuelle aussi', detecterLesRecurrences(an)[0].periodicite, 'annuelle');
}

console.log('\n2. CE QU’ON REFUSE DE LIRE');

{
  const deux = [op('2026-01-05', -78000, 'VIR M DUPONT LOYER'), op('2026-02-05', -78000, 'VIR M DUPONT LOYER')];
  egal('2.1 deux points ne font pas une récurrence', detecterLesRecurrences(deux), []);
  egal('2.2 et le seuil est bien trois', OCCURRENCES_MINIMALES, 3);
}

{
  /* Des dates sans régularité : rien ne doit sortir. */
  const hasard = ['2026-01-03', '2026-01-19', '2026-02-02', '2026-03-28', '2026-04-01', '2026-09-14']
    .map((j) => op(j, -4390, 'SARL LE PETIT MARCHE'));
  egal('2.3 des dates sans loi ne font pas une ligne', detecterLesRecurrences(hasard), []);
}

{
  /* Un virement interne n'est pas une dépense : il ne fonde aucune ligne. */
  const operations = mensuel(5, () => -78000, () => 'VIR INTERNE EPARGNE')
    .map((o) => ({ ...o, transfertAvec: 'AUTRE' }));
  egal('2.4 un virement interne est ignoré', detecterLesRecurrences(operations), []);
}

{
  /* Un commerçant qui rembourse : le sens majoritaire gagne, l'autre reste. */
  const operations = [
    ...mensuel(10, () => -6000, () => 'PRLV MUTUELLE', 6),
    op('2026-03-20', 8000, 'PRLV MUTUELLE'),
  ];
  const [r] = detecterLesRecurrences(operations);
  egal('2.5 le sens majoritaire l’emporte', r.sens, 'charge');
  egal('2.6 et le remboursement ne compte pas dans la ligne', r.operationIds.length, 6);
}

console.log('\n3. LE LIBELLÉ QUE LA BANQUE RENOMME');

{
  /*
     Le cas qui a changé la conception : neuf mois de « PRLV EDF », puis
     trois de « PRLV EDF CLIENTS SA ». Préférer le fragment le plus long —
     mon premier choix — rendait **deux** lignes d'électricité.
  */
  const operations = mensuel(15, () => -9500,
    (i) => (i < 9 ? 'PRLV EDF' : 'PRLV EDF CLIENTS SA'));
  const trouvees = detecterLesRecurrences(operations);
  egal('3.1 une seule ligne d’électricité, pas deux', trouvees.length, 1);
  egal('3.2 qui couvre les douze mois', trouvees[0].operationIds.length, 12);
  egal('3.3 sur le fragment commun', trouvees[0].fragment, 'EDF');
  verifier('3.4 et elle porte le libellé le plus récent',
    trouvees[0].libelle === 'PRLV EDF CLIENTS SA', trouvees[0].libelle);
}

{
  /* Les fragments candidats sont bien tous proposés, sans exclusivité. */
  const operations = mensuel(15, () => -9500, (i) => (i < 9 ? 'PRLV EDF' : 'PRLV EDF CLIENTS SA'));
  const c = candidats(operations);
  verifier('3.5 le fragment commun est candidat', c.has('EDF'));
  verifier('3.6 et le libellé entier aussi', c.has('PRLV EDF'));
  egal('3.7 le commun couvre tout', c.get('EDF')?.length, 12);
  verifier('3.8 « PRLV » n’est jamais candidat : il est sur la moitié des lignes',
    !c.has('PRLV'));
}

console.log('\n4. LA MÉDIANE, ET LA DISPERSION QUI CHOISIT LA NATURE');

{
  /*
     Onze mois à 95 €, et une régularisation à 450 € en mars. La moyenne
     vaudrait 124,58 € — un budget faux onze mois sur douze.
  */
  const operations = mensuel(15, (i) => (i === 2 ? -45000 : -9500), () => 'PRLV EDF');
  const [r] = detecterLesRecurrences(operations);
  egal('4.1 la médiane ignore la régularisation', r.montant, 9500);
  verifier('4.2 là où la moyenne la subirait',
    Math.round(operations.reduce((s, o) => s + Math.abs(o.centimes), 0) / 12) === 12458);
  egal('4.3 mais la borne haute en garde la trace', r.montantHaut, 45000);
  egal('4.4 et la nature reste fixe : un seul écart ne disperse rien', r.nature, 'fixe');
}

{
  /* Un montant qui varie un peu : « estimé ». */
  const operations = mensuel(2, (i) => -(4000 + i * 150), () => 'PRLV TELEPHONE');
  const [r] = detecterLesRecurrences(operations);
  egal('4.5 une variation modérée donne un montant estimé', r.nature, 'estime');
  verifier('4.6 au-dessus du seuil fixe',
    (r.dispersion ?? 0) > DISPERSION_FIXE, String(r.dispersion));
}

{
  /* Un montant très variable : une fourchette, avec ses deux bornes. */
  const montants = [-12000, -45000, -8000, -39000, -15000, -52000, -9000, -41000];
  const operations = montants.map((c, i) =>
    op(`2026-${String(i + 1).padStart(2, '0')}-12`, c, 'CB STATION SERVICE'));
  const [r] = detecterLesRecurrences(operations);
  egal('4.7 une forte variation donne une fourchette', r.nature, 'fourchette');
  verifier('4.8 au-dessus du second seuil',
    (r.dispersion ?? 0) > DISPERSION_FOURCHETTE, String(r.dispersion));
  verifier('4.9 et le fondement montre les deux bornes',
    r.fondement.includes('80,00') && r.fondement.includes('520,00'), r.fondement);
}

{
  egal('5.0 la médiane d’un nombre pair se moyenne', mediane([10, 20, 30, 40]), 25);
  egal('5.1 et d’un nombre impair se prend', mediane([10, 20, 30]), 20);
  egal('5.2 une liste vide ne casse rien', mediane([]), 0);
}

console.log('\n5. DE LA RÉCURRENCE À LA LIGNE');

{
  const operations = mensuel(5, () => -78000, () => 'VIR M DUPONT LOYER');
  const [r] = detecterLesRecurrences(operations);
  const p = enLigneDeBudget(r, '2027-01-10T09:00:00.000Z');
  egal('5.3 la ligne proposée est valide', controlerLigne(p.ligne), []);
  egal('5.4 elle commence au premier jour observé, pas aujourd’hui',
    p.ligne.versions[0].depuis, '2026-01-05');
  egal('5.5 son montant est positif, le sens le signe', p.ligne.versions[0].montant, 78000);
  egal('5.6 elle est une charge', p.ligne.sens, 'charge');
  egal('5.7 sa catégorie reste à choisir', p.ligne.categorie, '');
  egal('5.8 elle n’est pas déclarée essentielle d’office', p.ligne.essentielle, false);
  egal('5.9 elle porte son motif d’appariement', p.motifs[0].fragment, r.fragment);
  egal('5.10 avec le compte des occurrences vues', p.motifs[0].vu, 12);
  verifier('5.11 et sa note dit d’où elle vient',
    p.ligne.note.includes('Déduite du réel le 2027-01-10'), p.ligne.note);
}

{
  const montants = [-12000, -45000, -8000, -39000, -15000, -52000, -9000, -41000];
  const operations = montants.map((c, i) =>
    op(`2026-${String(i + 1).padStart(2, '0')}-12`, c, 'CB STATION SERVICE'));
  const [r] = detecterLesRecurrences(operations);
  const p = enLigneDeBudget(r, '2027-01-10T09:00:00.000Z');
  egal('5.12 une fourchette est valide', controlerLigne(p.ligne), []);
  egal('5.13 sa borne basse est le minimum observé', p.ligne.versions[0].montant, 8000);
  egal('5.14 et sa borne haute le maximum', p.ligne.versions[0].montantHaut, 52000);
}

console.log('\n6. LES GARDE-FOUS');

{
  egal('6.1 le garde-fou ne trouve rien', controlerLesRecurrences(), []);
  verifier('6.2 le jeu ne confond pas deux périodicités voisines', JOURS_DE_JEU * 2 < 23);
}

console.log(
  echecs.length
    ? `\n\x1b[31m${reussis} essais réussis, ${echecs.length} échec(s).\x1b[0m\n` +
        echecs.map((e) => `  ✗ ${e}`).join('\n') + '\n'
    : `\n\x1b[32m${reussis} essais réussis, 0 échec.\x1b[0m\n`,
);
process.exit(echecs.length ? 1 : 0);
