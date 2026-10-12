/**
 * Le validateur d'analyse : enveloppe tolérante, contenu strict.
 *
 * Ce que ces essais protègent :
 *
 * - **l'enveloppe est retirée, et dite.** Un bloc de code, une phrase
 *   d'introduction, une virgule finale : refuser pour cela serait refuser une
 *   réponse juste pour une raison de forme.
 * - **le contenu ne se négocie pas.** Champ inconnu, énumération non
 *   respectée, plafond dépassé, balisage : refusés, et **rien n'est importé
 *   partiellement**.
 * - **les quatre références croisées**, qui sont la moitié du travail : les
 *   identifiants uniques, les liens vers des constats qui existent, les
 *   indicateurs au catalogue, les dates dans la période.
 * - **chaque message porte le chemin exact**, parce que c'est lui qui nourrit
 *   le prompt de réparation — la seule façon de faire corriger une IA sans
 *   l'appeler.
 */
import {
  ERREURS_AFFICHEES,
  deballer,
  direErreur,
  promptDeReparation,
  validerTexte,
  type Contexte,
} from '../src/lib/noyau/validateur-analyse';
import { PLAFONDS, exempleAnalyse } from '../src/lib/noyau/schema-analyse';
import { INDICATEURS } from '../src/lib/odyssee/indicateurs';

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
const faux = (intitule: string, condition: boolean) => v(intitule, condition, false);

const EXPORT_ID = '01EXPORT0000000000000000';
const EMPREINTE = `sha256:${'a'.repeat(64)}`;
const CONTEXTE: Contexte = {
  indicateurs: INDICATEURS.map((i) => i.id),
  periode: { debut: '2026-09-01', fin: '2026-09-30' },
  exportId: EXPORT_ID,
  empreinte: EMPREINTE,
};

const BASE = exempleAnalyse({
  exportId: EXPORT_ID,
  empreinte: EMPREINTE,
  debut: '2026-09-01',
  fin: '2026-09-30',
  indicateur: 'cog.temps-revision',
  unite: 'secondes',
});

const texteDe = (analyse: unknown) => JSON.stringify(analyse);
/** Une copie modifiable de l'exemple. */
const copie = () => structuredClone(BASE) as Record<string, any>;

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’enveloppe est retirée, et dite\x1b[0m');

v('un texte nu n’a pas d’enveloppe', deballer('{"a":1}'), { json: '{"a":1}', retire: [] });
{
  const d = deballer('```json\n{"a":1}\n```');
  v('un bloc de code est retiré', d.json, '{"a":1}');
  v('et il est nommé', d.retire, ['un bloc de code']);
}
v('un bloc sans langage aussi', deballer('```\n{"a":1}\n```').json, '{"a":1}');
{
  const d = deballer('Voici l’analyse :\n{"a":1}');
  v('une phrase d’introduction est retirée', d.json, '{"a":1}');
  v('et nommée', d.retire, ['une phrase d’introduction']);
}
{
  const d = deballer('{"a":1}\n\nJ’espère que cela vous aide !');
  v('une phrase de conclusion aussi', d.json, '{"a":1}');
  v('et nommée', d.retire, ['une phrase de conclusion']);
}
{
  const d = deballer('{"a":1,}');
  v('une virgule finale est retirée', d.json, '{"a":1}');
  v('et nommée', d.retire, ['une ou plusieurs virgules finales']);
}
v('dans un tableau aussi', deballer('{"a":[1,2,]}').json, '{"a":[1,2]}');
{
  const d = deballer('Voici :\n```json\n{"a":[1,],}\n```\nVoilà.');
  v('les quatre ensemble', d.json, '{"a":[1]}');
  v('et les quatre sont nommés', d.retire, [
    'un bloc de code',
    'une phrase d’introduction',
    'une phrase de conclusion',
    'une ou plusieurs virgules finales',
  ]);
}
v('un texte vide reste vide', deballer('   ').json, '');
{
  /*
     Une accolade dans la prose ne doit pas égarer la recherche : le bloc de
     code est retiré en premier, précisément pour cela.
  */
  const d = deballer('Le champ {id} est là :\n```json\n{"a":1}\n```');
  v('une accolade dans la prose n’égare pas', d.json, '{"a":1}');
}
{
  /*
     Une virgule qui traîne après l'accolade finale n'est pas « une phrase de
     conclusion », et le dire ferait chercher une phrase que personne n'a
     écrite. Ce défaut a été trouvé par l'essai de navigateur.
  */
  const d = deballer('```json\n{"a":1},\n```');
  v('une virgule après l’accolade est dite comme telle', d.retire, [
    'un bloc de code',
    'une ou plusieurs virgules finales',
  ]);
  v('et l’objet est propre', d.json, '{"a":1}');
}
{
  const d = deballer('{"a":1}.');
  v('un point final ne vaut pas une phrase', d.retire, []);
  v('et il est retiré quand même', d.json, '{"a":1}');
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’exemple passe, et il est rendu entier\x1b[0m');

{
  const verdict = validerTexte(texteDe(BASE), CONTEXTE);
  v('l’exemple est recevable', verdict.recevable, true);
  v('sans erreur', verdict.erreurs, []);
  vrai('et l’analyse est rendue', verdict.analyse !== undefined);
  v('avec son résumé', typeof verdict.analyse?.resume, 'string');
}
{
  const verdict = validerTexte('```json\n' + texteDe(BASE) + ',\n```', CONTEXTE);
  v('l’exemple emballé passe aussi', verdict.recevable, true);
  vrai('et l’enveloppe est rapportée', verdict.retire.length >= 1);
}
{
  const verdict = validerTexte('', CONTEXTE);
  v('un texte vide est refusé', verdict.recevable, false);
  v('et le dit', direErreur(verdict.erreurs[0]), 'analyse : le texte est vide.');
}
{
  const verdict = validerTexte('{ ceci n’est pas du json', CONTEXTE);
  v('du texte qui n’est pas du JSON est refusé', verdict.recevable, false);
  vrai('et la raison le dit', verdict.erreurs[0].raison.includes('pas du JSON valide'));
}
{
  const gros = JSON.stringify({ ...BASE, limites_globales: 'x'.repeat(PLAFONDS.octets) });
  const verdict = validerTexte(gros, CONTEXTE);
  v('un document trop gros est refusé avant d’être lu', verdict.recevable, false);
  vrai('et la raison nomme le plafond', verdict.erreurs[0].raison.includes('trop gros'));
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLa forme : chaque message porte son chemin\x1b[0m');

{
  const a = copie();
  a.conseil_medical = 'prenez ceci';
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v('un champ inconnu à la racine est refusé', verdict.recevable, false);
  v('et le chemin est exact', verdict.erreurs[0].chemin, 'conseil_medical');
  vrai('la raison liste ce qui est admis', verdict.erreurs[0].raison.includes('Admis ici'));
}
{
  const a = copie();
  a.constats[0].preuves[0].source = 'inventée';
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v(
    'un champ inconnu en profondeur porte son chemin complet',
    verdict.erreurs[0].chemin,
    'constats[0].preuves[0].source',
  );
}
{
  const a = copie();
  delete a.resume;
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v('un champ requis manquant est signalé', verdict.erreurs[0].chemin, 'resume');
  vrai('et la raison rappelle ce qu’on attendait', verdict.erreurs[0].raison.includes('résumé'));
}
{
  const a = copie();
  a.propositions[0].nature = 'dose';
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v('une nature hors énumération est refusée', verdict.erreurs[0].chemin, 'propositions[0].nature');
  vrai('et les valeurs admises sont listées', verdict.erreurs[0].raison.includes('organisation'));
}
{
  const a = copie();
  a.constats[0].domaine = 'astrologie';
  vrai(
    'un domaine inventé est refusé',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.chemin === 'constats[0].domaine'),
  );
}
{
  const a = copie();
  a.version = 2;
  vrai(
    'une version inconnue est refusée',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.chemin === 'version'),
  );
}
{
  const a = copie();
  a.format = 'autre-format';
  vrai(
    'un format inconnu aussi',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.chemin === 'format'),
  );
}
{
  const a = copie();
  a.constats[0].enonce = '<b>Gras</b> et du balisage.';
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v('du balisage dans un texte est refusé', verdict.erreurs[0].chemin, 'constats[0].enonce');
  vrai('et la raison dit « texte brut »', verdict.erreurs[0].raison.includes('texte brut'));
}
{
  const a = copie();
  a.resume = 'trop court';
  vrai(
    'un texte sous le minimum est refusé',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.raison.includes('trop court')),
  );
}
{
  const a = copie();
  a.constats[0].enonce = 'x'.repeat(PLAFONDS.texteCourt + 1);
  vrai(
    'un texte au-delà du plafond aussi',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.raison.includes('trop long')),
  );
}
{
  const a = copie();
  a.constats = Array.from({ length: PLAFONDS.constats + 1 }, () => structuredClone(BASE.constats[0]));
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v('une liste au-delà du plafond est refusée', verdict.erreurs[0].chemin, 'constats');
  vrai('et la raison compte', verdict.erreurs[0].raison.includes(`${PLAFONDS.constats} au plus`));
}
{
  const a = copie();
  a.constats[0].preuves = [];
  vrai(
    'un constat sans preuve est refusé',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some(
      (e) => e.chemin === 'constats[0].preuves' && e.raison.includes('trop courte'),
    ),
  );
}
{
  const a = copie();
  a.propositions[0].horizon_semaines = 0;
  vrai(
    'un horizon nul est hors bornes',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.raison.includes('hors bornes')),
  );
}
{
  const a = copie();
  a.propositions[0].horizon_semaines = 4.5;
  vrai(
    'et un horizon non entier est refusé',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.raison.includes('entier')),
  );
}
{
  const a = copie();
  a.export_empreinte = 'abcdef';
  vrai(
    'une empreinte mal formée est refusée',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.chemin === 'export_empreinte'),
  );
}
{
  const a = copie();
  a.constats[0].preuves[0].periode.debut = '2026-13-45';
  vrai(
    'une date impossible est refusée',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.raison.includes('n’existe pas')),
  );
}
{
  const a = copie();
  a.propositions[0].avertissement_professionnel = 'oui';
  vrai(
    'un booléen écrit en mot est refusé',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.raison.includes('true')),
  );
}
{
  const a = copie();
  a.constats[0].preuves[0].valeur_citee = 'beaucoup';
  vrai(
    'une valeur citée non numérique est refusée',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some(
      (e) => e.chemin === 'constats[0].preuves[0].valeur_citee',
    ),
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes références croisées\x1b[0m');

{
  const a = copie();
  a.constats[0].preuves[0].indicateur = 'corps.poids-moyen';
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v(
    'un indicateur hors catalogue est refusé, avec son chemin',
    direErreur(verdict.erreurs[0]).startsWith('constats[0].preuves[0].indicateur : identifiant inconnu'),
    true,
  );
  vrai('et la raison renvoie au fichier fourni', verdict.erreurs[0].raison.includes('indicateurs.json'));
}
{
  const a = copie();
  a.propositions[0].indicateur_de_suivi = 'inventé.truc';
  vrai(
    'un indicateur de suivi inventé aussi',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some(
      (e) => e.chemin === 'propositions[0].indicateur_de_suivi',
    ),
  );
}
{
  const a = copie();
  a.propositions[0].lie_aux_constats = ['c9'];
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v(
    'un lien vers un constat absent est refusé',
    verdict.erreurs[0].chemin,
    'propositions[0].lie_aux_constats[0]',
  );
  vrai('et la raison nomme l’identifiant', verdict.erreurs[0].raison.includes('« c9 »'));
}
{
  const a = copie();
  a.constats.push({ ...structuredClone(BASE.constats[0]), id: 'c1' });
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v('un identifiant en double est refusé', verdict.erreurs[0].chemin, 'constats[1].id');
  vrai('et la raison dit où il était déjà', verdict.erreurs[0].raison.includes('constats[0].id'));
}
{
  const a = copie();
  a.propositions[0].id = 'c1';
  vrai(
    'un identifiant partagé entre deux listes est refusé aussi',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.chemin === 'propositions[0].id'),
  );
}
{
  const a = copie();
  a.constats[0].preuves[0].periode = { debut: '2026-08-01', fin: '2026-08-31' };
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  vrai(
    'une preuve hors période est refusée',
    verdict.erreurs.some((e) => e.raison.includes('hors de la période analysée')),
  );
  vrai('et la raison donne les bornes', verdict.erreurs[0].raison.includes('2026-09-01'));
}
{
  const a = copie();
  a.constats[0].preuves[0].periode = { debut: '2026-09-30', fin: '2026-09-01' };
  vrai(
    'un début postérieur à la fin est refusé',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.raison.includes('postérieur')),
  );
}
{
  const a = copie();
  a.periode = { debut: '2026-08-01', fin: '2026-08-31' };
  vrai(
    'une période qui ne reprend pas celle du manifeste est refusée',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.chemin === 'periode'),
  );
}
{
  const a = copie();
  a.export_id = '01AUTREEXPORT00000000000';
  vrai(
    'un identifiant d’export étranger est refusé',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.chemin === 'export_id'),
  );
}
{
  const a = copie();
  a.export_empreinte = `sha256:${'b'.repeat(64)}`;
  vrai(
    'une empreinte qui ne correspond pas est refusée',
    validerTexte(texteDe(a), CONTEXTE).erreurs.some((e) => e.chemin === 'export_empreinte'),
  );
}
{
  /*
     Sans contexte d'export — journal effacé, autre source — l'import reste
     possible : B.6.3 le demande, avec un avertissement que l'écran portera.
  */
  const sansExport: Contexte = { indicateurs: CONTEXTE.indicateurs };
  v('sans contexte d’export, l’analyse passe', validerTexte(texteDe(BASE), sansExport).recevable, true);
}
{
  /* Les références ne sont pas cherchées quand la forme est déjà cassée. */
  const a = copie();
  a.constats = 'pas une liste';
  a.propositions[0].lie_aux_constats = ['c9'];
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  vrai('la forme est signalée', verdict.erreurs.some((e) => e.chemin === 'constats'));
  faux(
    'et les références ne produisent pas de bruit par-dessus',
    verdict.erreurs.some((e) => e.chemin.includes('lie_aux_constats')),
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mRien n’est importé partiellement\x1b[0m');

{
  const a = copie();
  delete a.resume;
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v('un verdict en échec ne rend aucune analyse', verdict.analyse, undefined);
}
{
  const a = copie();
  a.constats = Array.from({ length: 10 }, (_, i) => ({
    ...structuredClone(BASE.constats[0]),
    id: `c${i + 1}`,
    domaine: 'astrologie',
    type: 'divination',
  }));
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  vrai('les erreurs multiples sont toutes rendues', verdict.erreurs.length >= 20);
  vrai('et plafonnées pour rester lisibles', verdict.erreurs.length <= ERREURS_AFFICHEES);
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLe prompt de réparation\x1b[0m');

{
  const a = copie();
  a.conseil_medical = 'x';
  a.propositions[0].nature = 'dose';
  a.constats[0].preuves[0].indicateur = 'corps.poids';
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  const prompt = promptDeReparation(verdict.erreurs);
  vrai('il dit que la réponse a été refusée', prompt.includes('refusée à l’import'));
  vrai('il demande l’objet entier', prompt.includes('l’objet JSON entier'));
  vrai('il nomme le format et la version', prompt.includes('cyclades-analyse'));
  for (const erreur of verdict.erreurs) {
    vrai(`il porte le chemin « ${erreur.chemin} »`, prompt.includes(`\`${erreur.chemin}\``));
  }
  vrai(
    'il rappelle que les champs hors schéma sont refusés',
    prompt.includes('Aucun champ hors du schéma'),
  );
  vrai('que les énumérations sont fermées', prompt.includes('énumérations sont fermées'));
  vrai('et que les indicateurs ne s’inventent pas', prompt.includes('sans l’inventer'));
  vrai('il finit sur « entier ou nul »', prompt.includes('entier ou nul'));
}
{
  const verdict = validerTexte('pas du json', CONTEXTE);
  const prompt = promptDeReparation(verdict.erreurs);
  vrai(
    'un JSON invalide fait rappeler la consigne de forme',
    prompt.includes('sans bloc de code'),
  );
}
{
  const prompt = promptDeReparation([]);
  vrai('un prompt sans erreur reste cohérent', prompt.includes('refusée à l’import'));
  faux('et ne porte aucun rappel', prompt.includes('Rappels :'));
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLe durcissement : ce qui ne se voit pas à l’écran\x1b[0m');

{
  /*
     U+202E retourne l'affichage d'une ligne sans changer ce qu'elle contient :
     l'énoncé se lirait à l'écran autrement qu'il n'est écrit. L'échappement
     protège le HTML, pas la lecture — d'où un refus à la validation.
  */
  const a = copie();
  a.constats[0].enonce = 'Le résultat est \u202eetsuj\u202c, dit-il, et le reste suit.';
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  v('une inversion de sens d’écriture est refusée', verdict.erreurs[0].chemin, 'constats[0].enonce');
  vrai('et la raison dit ce qu’elle ferait', verdict.erreurs[0].raison.includes('ferait lire autre chose'));
}
{
  const a = copie();
  a.resume = `Un résumé assez long pour passer le minimum, avec un \u0007 caché dedans.`;
  const verdict = validerTexte(texteDe(a), CONTEXTE);
  vrai(
    'un caractère de contrôle est refusé',
    verdict.erreurs.some((e) => e.raison.includes('caractères de contrôle')),
  );
}
{
  const a = copie();
  a.resume = 'Un résumé\navec un retour à la ligne, qui est légitime dans un texte brut.';
  v('un retour à la ligne reste admis', validerTexte(texteDe(a), CONTEXTE).recevable, true);
}
{
  const a = copie();
  a.constats[0].enonce = 'Un énoncé\u200bavec une espace de largeur nulle, ce qui est anodin.';
  v('une espace de largeur nulle ne déclenche rien', validerTexte(texteDe(a), CONTEXTE).recevable, true);
}
{
  const a = copie();
  a.constats[0].enonce = 'Le résultat est \u202eetsuj\u202c, dit-il, et le reste suit.';
  const prompt = promptDeReparation(validerTexte(texteDe(a), CONTEXTE).erreurs);
  vrai(
    'le prompt de réparation rappelle la règle des caractères imprimables',
    prompt.includes('ni marque de sens d’écriture'),
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
