/**
 * La temporalité du QCM : le schéma, et l'expiration à l'exécution.
 *
 * ## Le défaut que tout ceci existe pour empêcher
 *
 * Le site est **statique**. Entre deux publications il peut se passer des
 * mois, et pendant ce temps aucun contrôle de construction ne s'exécute. Une
 * réponse vraie en 2025 continuerait donc d'être servie comme vraie en 2027.
 * D'où deux vérifications et non une : le schéma arrête la construction, et
 * `estExpiree` arrête le tirage dans le navigateur. Les deux sont éprouvées
 * ici, et la seconde l'est **en avançant l'horloge**, parce qu'un essai qui
 * attendrait 2027 ne prouverait rien avant 2027.
 *
 * ## Ce qui est vérifié aussi, et qu'on oublie
 *
 * Qu'une question **non étiquetée** n'est pas traitée comme périmée.
 * L'étiquetage de la banque se fait par lots ; si l'absence valait
 * expiration, la première mise en service viderait l'épreuve entière.
 */
import { questionDgfipSchema, temporaliteSchema } from './lib/schema.mjs';
import { estExpiree, questionsServables } from '../src/lib/qcm-temporalite';
import type { BanqueDgfip, QuestionDgfip } from '../src/lib/contenu';

let echecs = 0;
const verifier = (nom: string, condition: boolean, detail = '') => {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${nom}`);
  else {
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${nom}${detail ? ` — ${detail}` : ''}`);
  }
};

const accepte = (t: unknown) => temporaliteSchema.safeParse(t).success;

console.log('\nLE SCHÉMA DE TEMPORALITÉ');
verifier('une nature inconnue est refusée', !accepte({ nature: 'bientôt' }));
verifier('« intemporelle » se suffit à elle-même', accepte({ nature: 'intemporelle' }));
verifier('« historique » aussi', accepte({ nature: 'historique' }));
verifier(
  '« actuelle » exige une date de référence',
  !accepte({ nature: 'actuelle' }) &&
    accepte({ nature: 'actuelle', date_de_reference: '2026-01-01' }),
);
verifier(
  '« a-venir » exige une date de référence ET une expiration',
  !accepte({ nature: 'a-venir', date_de_reference: '2026-01-01' }) &&
    accepte({ nature: 'a-venir', date_de_reference: '2026-01-01', expire_le: '2027-01-01' }),
);
verifier(
  '« passee-non-historique » exige une expiration',
  !accepte({ nature: 'passee-non-historique' }) &&
    accepte({ nature: 'passee-non-historique', expire_le: '2025-01-01' }),
);
verifier(
  'une expiration sur une question intemporelle est refusée',
  !accepte({ nature: 'intemporelle', expire_le: '2030-01-01' }),
);
verifier(
  'une expiration antérieure à la date de référence est refusée',
  !accepte({ nature: 'a-venir', date_de_reference: '2026-06-01', expire_le: '2026-01-01' }),
);
verifier('une date mal formée est refusée', !accepte({ nature: 'actuelle', date_de_reference: '01/01/2026' }));
verifier(
  'une date impossible est refusée',
  !accepte({ nature: 'actuelle', date_de_reference: '2026-02-31' }),
);

console.log('\nLA QUESTION EXIGE SON ORIGINE');
const base = {
  question: 'Combien font deux et deux ?',
  options: ['3', '4'],
  reponse: '4',
  explication: 'Quatre.',
};
verifier(
  '« categorie_origine » est obligatoire',
  !questionDgfipSchema.safeParse(base).success,
);
verifier(
  'A, B et maison sont acceptées',
  (['A', 'B', 'maison'] as const).every(
    (c) => questionDgfipSchema.safeParse({ ...base, categorie_origine: c }).success,
  ),
);
verifier(
  'l’ancien nom « categorie » est refusé, et non ignoré',
  !questionDgfipSchema.safeParse({ ...base, categorie_origine: 'B', categorie: 'B' }).success,
);

console.log('\nL’EXPIRATION À L’EXÉCUTION');
const q = (id: string, origine: 'A' | 'B' | 'maison', temporalite?: unknown): QuestionDgfip =>
  ({
    id,
    rubrique: 'Essai',
    rubriqueId: 'essai',
    question: id,
    options: ['a', 'b'],
    bonnes: [0],
    explication: '',
    categorie_origine: origine,
    temporalite,
  }) as QuestionDgfip;

const perimee = q('perimee', 'B', { nature: 'a-venir', date_de_reference: '2026-01-01', expire_le: '2026-06-30' });
const vivante = q('vivante', 'B', { nature: 'a-venir', date_de_reference: '2026-01-01', expire_le: '2027-06-30' });
const nue = q('nue', 'B');

verifier('une question dont l’échéance est passée est expirée', estExpiree(perimee, '2026-10-13'));
verifier('le jour même de l’échéance, elle ne l’est pas encore', !estExpiree(perimee, '2026-06-30'));
verifier('le lendemain, elle l’est', estExpiree(perimee, '2026-07-01'));
verifier('une échéance future ne périme rien', !estExpiree(vivante, '2026-10-13'));
verifier('une question SANS temporalité n’est jamais expirée', !estExpiree(nue, '2099-01-01'));

console.log('\nLE TIRAGE PAR PARCOURS');
const banque: BanqueDgfip = {
  rubriques: [{ id: 'essai', nom: 'Essai', ordre: 1, total: 4 }],
  questions: [q('a', 'A'), q('b', 'B'), q('m', 'maison'), perimee],
};
const ids = (parcours?: string) =>
  questionsServables(banque, parcours, '2026-10-13')
    .map((x) => x.id)
    .sort()
    .join(',');

verifier('DGFiP B ne tire que B et maison', ids('dgfip-b') === 'b,m', ids('dgfip-b'));
verifier('DGFiP A tire A, B et maison', ids('dgfip-a') === 'a,b,m', ids('dgfip-a'));
verifier('DGFiP A+ aussi', ids('dgfip-ap') === 'a,b,m', ids('dgfip-ap'));
verifier('l’INSP tire dans tout', ids('insp') === 'a,b,m', ids('insp'));
verifier('un parcours inconnu ne vide pas la banque', ids('inconnu') === 'a,b,m', ids('inconnu'));
verifier(
  'et la question périmée n’est servie à personne',
  !['dgfip-b', 'dgfip-a', 'insp', undefined].some((p) => ids(p).includes('perimee')),
);

console.log(
  echecs === 0
    ? '\n\x1b[32m✓ Temporalité : tout passe\x1b[0m\n'
    : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
