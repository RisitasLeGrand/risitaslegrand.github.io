/**
 * Les schémas de Santé refusent-ils ce qu'ils doivent refuser ?
 *
 * Un schéma qui accepte tout est un schéma qui ne sert à rien, et on ne s'en
 * aperçoit qu'au moment où une valeur fausse est déjà entrée. Ces essais
 * tentent donc, un par un, les cinq façons de contourner la règle « aucune
 * valeur sans sa source », et vérifient que chacune est fermée.
 */
import { SCHEMAS } from './lib/schemas-sante.mts';

let reussis = 0;
const echecs = [];
const verifier = (titre, condition, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const refuse = (titre, schema, valeur) =>
  verifier(titre, !schema.safeParse(valeur).success, 'accepté alors qu’il fallait refuser');
const accepte = (titre, schema, valeur) => {
  const r = schema.safeParse(valeur);
  verifier(titre, r.success, r.success ? '' : JSON.stringify(r.error.issues[0]?.message));
};

const SOURCE = {
  intitule: 'Résumé des caractéristiques du produit, base publique des médicaments',
  type: 'rcp',
  evalueeParLesPairs: 'sans-objet',
  consulteeLe: '2026-10-14',
  lien: 'https://example.org/rcp',
  confiance: 'solide',
  valablePour: 'adulte sain, voie orale',
};

const MOLECULE = {
  id: 'cafeine',
  nom: 'Caféine',
  synonymes: ['1,3,7-triméthylxanthine'],
  maturiteClinique: 'autorisee',
  donneesHumaines: true,
  statutAntidopage: 'autorise',
  demiVie: { valeur: 5, unite: 'h', intervalle: [3, 7], source: SOURCE },
  notes: [],
};

console.log('LA RÈGLE : AUCUNE VALEUR SANS SA SOURCE');

accepte('une molécule complète passe', SCHEMAS.molecule, MOLECULE);
accepte('« inconnue » est une valeur de première classe', SCHEMAS.molecule, {
  ...MOLECULE,
  demiVie: 'inconnue',
});
refuse('une demi-vie sans source est refusée', SCHEMAS.molecule, {
  ...MOLECULE,
  demiVie: { valeur: 5, unite: 'h', intervalle: null },
});
refuse('un champ absent n’est pas un « inconnue » déguisé', SCHEMAS.molecule, {
  ...MOLECULE,
  demiVie: undefined,
});
refuse('une source sans date de consultation est refusée', SCHEMAS.molecule, {
  ...MOLECULE,
  demiVie: { valeur: 5, unite: 'h', intervalle: null, source: { ...SOURCE, consulteeLe: undefined } },
});
refuse('une source sans niveau de confiance est refusée', SCHEMAS.molecule, {
  ...MOLECULE,
  demiVie: { valeur: 5, unite: 'h', intervalle: null, source: { ...SOURCE, confiance: undefined } },
});
refuse('une source sans population ni condition est refusée', SCHEMAS.molecule, {
  ...MOLECULE,
  demiVie: { valeur: 5, unite: 'h', intervalle: null, source: { ...SOURCE, valablePour: '' } },
});
refuse('un type de source inventé est refusé', SCHEMAS.molecule, {
  ...MOLECULE,
  demiVie: { valeur: 5, unite: 'h', intervalle: null, source: { ...SOURCE, type: 'de-memoire' } },
});

console.log('\nCE QUE LE CATALOGUE NE PORTE PAS');

refuse('une dose ne se glisse pas dans une molécule', SCHEMAS.molecule, {
  ...MOLECULE,
  dose: { valeur: 200, unite: 'mg' },
});

console.log('\nLES TROIS AUTRES FICHIERS');

accepte('une interaction expliquée et sourcée passe', SCHEMAS.interaction, {
  id: 'cafeine-theanine',
  entre: ['cafeine', 'l-theanine'],
  famille: 'pharmacodynamique',
  statut: 'sans-consequence-connue',
  explication: 'Association courante, dont les effets rapportés sont subjectifs et peu mesurés.',
  source: SOURCE,
});
refuse('une interaction sans explication est refusée', SCHEMAS.interaction, {
  id: 'x',
  entre: ['a', 'b'],
  famille: 'additive',
  statut: 'inconnu',
  explication: 'trop court',
  source: SOURCE,
});
refuse('une méthode sans aucune source est refusée', SCHEMAS.methode, {
  id: 'double-progression',
  nom: 'Double progression',
  resume: 'Monter les répétitions avant de monter la charge, dans une fourchette donnée.',
  niveauDePreuve: 'plausible',
  sources: [],
});
refuse('une question obligatoire est refusée', SCHEMAS.question, {
  id: 'q1',
  chapitre: 1,
  intitule: 'Quel est votre objectif principal ?',
  forme: 'choix-unique',
  options: ['Force', 'Volume'],
  renseigne: 'profil.objectif',
  facultative: false,
});

refuse('une maturité absente de la liste de l’application est refusée', SCHEMAS.molecule, {
  ...MOLECULE,
  maturiteClinique: 'medicament-hors-amm',
});
{
  const sante = await import('../src/lib/odyssee/sante');
  verifier(
    'les maturités admises sont exactement celles que l’écran sait nommer',
    Object.keys(sante.MATURITES).every((m) =>
      SCHEMAS.molecule.safeParse({ ...MOLECULE, maturiteClinique: m }).success,
    ),
  );
}

console.log('\nLE CONSENTEMENT (J.5), LIVRÉ EN PHASE 0 POUR ÊTRE RELU');

{
  const c = await import('../src/lib/odyssee/consentement.ts').catch(() => null);
  if (!c) {
    verifier('le module de consentement se charge', false, 'import impossible depuis node');
  } else {
    const vierge = c.consentementVierge();
    verifier('rien n’est coché au départ', vierge.accorde === false
      && Object.values(vierge.domaines).every((x) => x === false)
      && Object.values(vierge.sources).every((x) => x === false));
    verifier('deux appels ne partagent pas le même objet',
      c.consentementVierge().domaines !== vierge.domaines);
    verifier('les huit domaines et les quatre sources y sont',
      c.DOMAINES_DU_CONSENTEMENT.length === 8 && c.SOURCES_DU_CONSENTEMENT.length === 4);
    verifier('« ce qui ne change jamais » dit que tout marche sans',
      c.TEXTE_DE_CONSENTEMENT.ceQuiNeChangeJamais.includes('Tout marche sans')
      || c.TEXTE_DE_CONSENTEMENT.ceQuiNeChangeJamais.includes('tout marche sans'));
    verifier('le rappel est dans l’application, jamais en notification',
      c.RAPPEL.dansLApplicationSeulement === true && c.RAPPEL.moisParDefaut === 3);
  }
}

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
