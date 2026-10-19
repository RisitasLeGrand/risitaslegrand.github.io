/**
 * Le suivi personnel ne sort pas de l'appareil, et on le mesure.
 *
 *   npm run essais:cycle-confidentialite
 *
 * ## Pourquoi cet essai lit le code des gardiens
 *
 * `PORTES_GARDEES` décrit cinq portes et dit de chacune qu'elle est
 * fermée. **Une porte qui se décrit fermée n'est pas une porte fermée.**
 * Cet essai ne lit donc pas la description : il va voir chaque gardien et
 * vérifie que le nom d'un magasin du suivi ne s'y trouve pas — ou, pour la
 * sauvegarde, qu'il s'y trouve bien.
 *
 * C'est ce qui le rend utile le jour où quelqu'un ajoutera une catégorie
 * d'export en oubliant la règle : la description restera juste, le code ne
 * le sera plus, et c'est le code qui est mesuré.
 *
 * ## Ce qu'il ne peut pas garder
 *
 * Il ne prouve pas qu'une donnée du suivi est effectivement chiffrée au
 * repos : cela demande une base ouverte, et `essais:coffre-ferme` et
 * `essais:odyssee:navigateur` s'en chargent au navigateur. Il garde la
 * **déclaration** — qu'aucun magasin du suivi n'échappe au scellé —, et la
 * déclaration est ce qui fait agir `sceller()`.
 */
import { readFileSync } from 'node:fs';
import {
  controlerLaConfidentialiteDuCycle,
  cleDuJourDeCycle,
  JAMAIS_CALCULE,
  MAGASINS_DU_CYCLE,
  NOMS_DES_MAGASINS_DU_CYCLE,
  PORTES_GARDEES,
} from '../src/lib/odyssee/cycle-confidentialite';
import {
  controlerReglagesDuCycle,
  controlerSaisie,
  ID_DES_REGLAGES,
  NIVEAUX_DE_SAIGNEMENT,
  ORDRE_DES_NIVEAUX,
  REGLAGES_AU_DEPART,
  type SaisieDuCycle,
} from '../src/lib/odyssee/cycle';
import { MAGASINS_SCELLES } from '../src/lib/noyau/coffre';
import {
  MAGASINS_HORS_SAUVEGARDE_EN_CLAIR,
  MAGASINS_SAUVEGARDES,
  magasinsDUneSauvegarde,
} from '../src/lib/db';
import { CHAMP_DATE, raisonDuRefusDeDecoupage } from '../src/lib/sauvegarde/groupes';
import { MAGASINS_JOURNALISES, magasinJournalise } from '../src/lib/noyau/enregistrements';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

const sansCommentaires = (texte: string) =>
  texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const source = (chemin: string) => sansCommentaires(readFileSync(chemin, 'utf8'));

/* ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. LA DÉCLARATION TIENT');

v('le module ne relève aucun problème de forme', controlerLaConfidentialiteDuCycle(), []);
v('deux magasins sont déclarés', MAGASINS_DU_CYCLE.length, 2);
v('cinq portes sont nommées', PORTES_GARDEES.length, 5);

/*
   AUCUN MAGASIN DU SUIVI N'ÉCHAPPE AU SCELLÉ. C'est l'assertion que
   `essais:schema` ne peut pas rendre : il vérifie que tout magasin scellé
   existe, pas que tout magasin du suivi est scellé. Le défaut qu'il
   laisserait passer est précisément celui qui compte ici.
*/
const scelles = new Set(MAGASINS_SCELLES.map((m) => m.magasin));
v(
  'chaque magasin du suivi est déclaré scellé',
  NOMS_DES_MAGASINS_DU_CYCLE.filter((n) => !scelles.has(n)),
  [],
);

/*
   ET AUCUNE DATE EN CLAIR DANS LE JOURNAL. La déclaration de coffre est
   relue ici, pas seulement celle du module : ce sont deux fichiers, et c'est
   celui du coffre qui agit.
*/
const journalAuCoffre = MAGASINS_SCELLES.find((m) => m.magasin === 'odysseeCycleJournal');
v('le journal est bien au coffre', journalAuCoffre !== undefined, true);
v(
  'et ses champs clairs ne portent aucune date',
  (journalAuCoffre?.clairs ?? []).filter((c) => /jour|date|debut|fin|semaine/i.test(c)),
  [],
);

console.log('\n2. LA CLÉ EST UNE EMPREINTE, ET ELLE NE DIT PAS LE JOUR');

const cle1 = await cleDuJourDeCycle('2026-10-01');
const cle2 = await cleDuJourDeCycle('2026-10-02');
v('trente-deux signes hexadécimaux', /^[0-9a-f]{32}$/.test(cle1), true);
v('déterministe', await cleDuJourDeCycle('2026-10-01'), cle1);
v('deux jours voisins donnent deux clés sans rapport visible', cle1 === cle2, false);
/*
   LE POINT DE TOUT CE MAGASIN : la clé ne contient aucun morceau de la date.
   Un identifiant « 2026-10-01-abcdef » passerait les trois assertions
   précédentes et ne protégerait rien.
*/
/*
   LE POINT DE TOUT CE MAGASIN, et il demande une assertion qui morde.

   Les trois précédentes passeraient sur une clé « 2026-10-01-a3f9… », qui
   est déterministe, longue et différente d'un jour à l'autre — et qui ne
   protège rien. On vérifie donc que la date ne se retrouve dans la clé sous
   AUCUNE de ses formes plausibles : telle quelle, compacte, à l'envers.
*/
const formesDuJour = (jour: string): readonly string[] => {
  const [a, m, j] = jour.split('-');
  return [jour, `${a}${m}${j}`, `${j}${m}${a}`, `${j}-${m}-${a}`, `${m}${j}`, `${j}${m}`];
};
v(
  'la date ne se retrouve dans la clé sous aucune de ses formes',
  formesDuJour('2026-10-01').filter((f) => cle1.includes(f)),
  [],
);
v('et la clé ne porte aucun séparateur de date', /[-/.]/.test(cle1), false);

console.log('\n3. LES CINQ PORTES, MESURÉES SUR LE CODE DES GARDIENS');

/*
   PORTE 1 — l'export pour IA. Le cycle n'y a aucune catégorie, et le nom
   d'aucun de ses magasins n'apparaît dans le module.
*/
const exportIa = source('src/lib/odyssee/export-ia.ts');
v(
  'export pour IA : aucun magasin du suivi n’y est nommé',
  NOMS_DES_MAGASINS_DU_CYCLE.filter((n) => exportIa.includes(n)),
  [],
);
v(
  'et aucune catégorie d’export ne porte le suivi',
  /categorie|CATEGORIES/.test(exportIa) && /cycle|regles|suivi-personnel/i.test(
    exportIa.slice(exportIa.indexOf('CATEGORIES'), exportIa.indexOf('CATEGORIES_SOUS_COFFRE')),
  ),
  false,
);

/* PORTE 2 — l'agenda. Deux fichiers produisent des .ics sur cette branche. */
for (const chemin of ['src/lib/odyssee/echeances-ics.ts', 'src/lib/odyssee/ics.ts']) {
  v(
    `agenda (${chemin.split('/').pop()}) : aucun magasin du suivi n’y est nommé`,
    NOMS_DES_MAGASINS_DU_CYCLE.filter((n) => source(chemin).includes(n)),
    [],
  );
}

/*
   PORTE 3 — la sauvegarde. Ici l'attendu est INVERSE : le suivi doit y
   être. Une sauvegarde qui l'oublierait rendrait, à la restauration, une
   base amputée en annonçant une restauration complète.
*/
const db = source('src/lib/db.ts');
const listeDeProgression = db.slice(
  db.indexOf('export const MAGASINS_PROGRESSION'),
  db.indexOf('];', db.indexOf('export const MAGASINS_PROGRESSION')),
);
v(
  'sauvegarde : le suivi y est, et c’est voulu',
  NOMS_DES_MAGASINS_DU_CYCLE.filter((n) => !listeDeProgression.includes(`'${n}'`)),
  [],
);
const horsSauvegarde = db.slice(
  db.indexOf('export const MAGASINS_HORS_SAUVEGARDE'),
  db.indexOf('];', db.indexOf('export const MAGASINS_HORS_SAUVEGARDE')),
);
v(
  'et il n’est pas rangé hors sauvegarde',
  NOMS_DES_MAGASINS_DU_CYCLE.filter((n) => horsSauvegarde.includes(`'${n}'`)),
  [],
);

/*
   PORTE 4 — la synchronisation. Décision 18. La protection est structurelle :
   le paquet ne transporte que le journal d'opérations et les révisions. On
   vérifie qu'aucun magasin du suivi n'est nommé dans la couche, et en
   particulier pas dans `magasinsEnPlus`, qui est le seul chemin par lequel
   un magasin entier voyage.
*/
for (const chemin of ['src/lib/sync/service.ts', 'src/lib/sync/paquet.ts']) {
  v(
    `synchronisation (${chemin.split('/').pop()}) : aucun magasin du suivi n’y est nommé`,
    NOMS_DES_MAGASINS_DU_CYCLE.filter((n) => source(chemin).includes(n)),
    [],
  );
}

/*
   PORTE 5 — LE JOURNAL D'OPÉRATIONS, que cet essai ne gardait pas.

   Les quatre assertions précédentes vérifient que la couche de
   synchronisation ne NOMME aucun magasin du suivi. C'était vrai, et
   insuffisant : tous les voisins scellés appellent `journaliser()` après une
   écriture, et `journaliserEnregistrement()` écrit dans le journal
   d'opérations — qui est précisément ce que la synchronisation transporte.
   L'en-tête de `donnees-sensible.ts` le dit : les magasins scellés
   « voyagent, se sauvegardent et s'effacent par le même mécanisme ».

   Journaliser le suivi l'aurait donc synchronisé, contre la décision 18,
   SANS QU'AUCUN NOM DE MAGASIN N'APPARAISSE DANS `sync/`. Une porte qu'on ne
   voit pas en lisant le gardien, mais en lisant l'écrivain.

   Elle est gardée sur la couche de données du suivi : elle n'appelle rien de
   `faits-domaine`, ni directement ni par un import dynamique.
*/
const donneesDuCycle = source('src/lib/odyssee/donnees-cycle.ts');
v(
  'journal d’opérations : la couche de données du suivi ne journalise pas',
  /journaliser|faits-domaine/.test(donneesDuCycle),
  false,
);
/*
   ET LA SYMÉTRIE, pour que l'assertion ne devienne pas vraie par
   déplacement : aucun autre fichier du suivi ne journalise non plus.
*/
const fichiersDuSuivi = [
  'src/lib/odyssee/cycle.ts',
  'src/lib/odyssee/cycle-confidentialite.ts',
  'src/lib/odyssee/cycle-signes-alerte.ts',
  'src/lib/odyssee/donnees-cycle.ts',
];
v(
  'et aucun fichier du suivi ne journalise',
  fichiersDuSuivi.filter((f) => /journaliser|faits-domaine/.test(source(f))),
  [],
);

/*
   LA COUCHE DE DONNÉES EXIGE LE COFFRE PARTOUT. Une seule fonction qui
   l'oublierait écrirait en clair dans un magasin scellé — et `sceller()`
   lèverait, mais seulement si elle est appelée. Une écriture directe
   passerait.
*/
/*
   LA DÉLÉGATION COMPTE, et il a fallu que l'assertion morde pour que je
   l'écrive correctement. Sa première version exigeait un appel DIRECT à
   `exigerLeCoffre()` : elle a rougi sur `activerLeSuivi` et
   `desactiverLeSuivi`, qui délèguent à `lireLesReglages` et
   `ecrireLesReglages` — lesquelles l'exigent toutes deux. Déléguer est
   légitime, et plutôt mieux : un seul endroit porte la garde.

   On calcule donc la fermeture : une fonction est sûre si elle appelle
   `exigerLeCoffre()`, ou si elle n'appelle que des fonctions sûres du même
   module. Desserrer l'assertion aurait été plus court et n'aurait plus rien
   gardé.
*/
const corpsDe = (nom: string): string => {
  const debut = donneesDuCycle.search(new RegExp(`(export )?async function ${nom}\\b`));
  if (debut < 0) return '';
  return donneesDuCycle.slice(debut, donneesDuCycle.indexOf('\n}', debut));
};
const toutesLesFonctions = [...donneesDuCycle.matchAll(/(?:export )?async function (\w+)/g)].map(
  (m) => m[1],
);
const fonctionsExportees = [...donneesDuCycle.matchAll(/export async function (\w+)/g)].map(
  (m) => m[1],
);
v('la couche de données expose des fonctions', fonctionsExportees.length > 5, true);

const sures = new Set(toutesLesFonctions.filter((n) => corpsDe(n).includes('exigerLeCoffre()')));
for (let passe = 0; passe < toutesLesFonctions.length; passe += 1) {
  for (const nom of toutesLesFonctions) {
    if (sures.has(nom)) continue;
    const corps = corpsDe(nom);
    const appelees = toutesLesFonctions.filter(
      (autre) => autre !== nom && new RegExp(`\\b${autre}\\s*\\(`).test(corps),
    );
    if (appelees.length && appelees.every((a) => sures.has(a))) sures.add(nom);
  }
}
/* `combienDeSaisies` compte des clés et n'ouvre rien : exemptée, nommément. */
const sansCoffre = fonctionsExportees.filter((n) => n !== 'combienDeSaisies' && !sures.has(n));
v('et chacune exige le coffre, directement ou par délégation', sansCoffre, []);

console.log('\n4. CE QUI NE SERA JAMAIS CALCULÉ (DÉCISION 12)');

v('quatre interdits sont nommés', JAMAIS_CALCULE.length, 4);
/*
   Et aucun n'est calculé nulle part. Le balayage porte sur les noms de
   fonctions et de variables, pas sur les chaînes : une phrase d'écran qui
   dirait « ce n'est pas une fenêtre fertile » serait légitime, un
   `calculerFenetreFertile()` ne le serait pas.
*/
const sansEspaces = (mot: string) => mot.replace(/[ -]/g, '');
const identifiantsSuspects = ['fenetreFertile', 'ovulation', 'joursSurs', 'contraception'];
const cycleEtConfidentialite = source('src/lib/odyssee/cycle.ts') +
  source('src/lib/odyssee/cycle-confidentialite.ts');
v(
  'aucun identifiant du suivi ne nomme un de ces calculs',
  identifiantsSuspects.filter((i) =>
    new RegExp(`(function|const|let|=>)[^\\n]*${i}`, 'i').test(cycleEtConfidentialite),
  ),
  [],
);
v('et les quatre interdits sont écrits en français lisible', JAMAIS_CALCULE.map(sansEspaces).filter((m) => !/^[a-zà-ÿ]+$/i.test(m)), []);

console.log('\n5. LA FORME DES SAISIES');

const saisie = (p: Partial<SaisieDuCycle> = {}): SaisieDuCycle => ({
  id: 'a'.repeat(32),
  jour: '2026-10-19',
  niveau: 'moyen',
  note: '',
  debutDeclare: false,
  majLe: '2026-10-19T08:00:00.000Z',
  ...p,
});

v('une saisie complète passe', controlerSaisie(saisie()), []);
v('cinq niveaux, dans l’ordre de l’écran', ORDRE_DES_NIVEAUX.length, 5);
v(
  'et chacun porte un libellé',
  ORDRE_DES_NIVEAUX.filter((n) => !NIVEAUX_DE_SAIGNEMENT[n]),
  [],
);
v('un jour mal formé est refusé', controlerSaisie(saisie({ jour: '19/10/2026' })).length, 1);
v('un niveau inconnu est refusé', controlerSaisie(saisie({ niveau: 'énorme' as never })).length, 1);
/*
   LA CONTRADICTION SILENCIEUSE : un début déclaré sur une journée sans
   saignement. L'écran afficherait un début de cycle sur une journée que la
   personne a déclarée vide, et personne ne le verrait avant une statistique.
*/
v(
  'un début déclaré sans saignement est refusé',
  controlerSaisie(saisie({ debutDeclare: true, niveau: 'aucun' })).length,
  1,
);
v('mais un début déclaré avec des traces passe', controlerSaisie(saisie({ debutDeclare: true, niveau: 'traces' })), []);

console.log('\n6. LES RÉGLAGES NAISSENT INACTIFS');

v('le suivi est inactif au départ', REGLAGES_AU_DEPART.actif, false);
v('et sans date d’activation', REGLAGES_AU_DEPART.activeLe, null);
v('les réglages de départ passent leur contrôle', controlerReglagesDuCycle(REGLAGES_AU_DEPART), []);
v(
  'un suivi actif sans date est refusé',
  controlerReglagesDuCycle({ id: ID_DES_REGLAGES, actif: true, activeLe: null, majLe: '' }).length,
  1,
);
v(
  'une date sur un suivi inactif est refusée',
  controlerReglagesDuCycle({ id: ID_DES_REGLAGES, actif: false, activeLe: '2026-10-19', majLe: '' })
    .length,
  1,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n7. AUCUN CHAMP D’INDEX EN CLAIR NE PORTE UNE DATE');

/*
   Le § 6.9 du prompt 30 : « aucun champ d'index en clair ne porte une date,
   un statut ou un symptôme du cycle ».

   C'est l'essai qui dit que j'avais tort au lot 4. J'y avais déclaré
   `clairs: ['id', 'majLe']` en notant qu'il n'y avait pas de `jour` en clair
   « alors que tous ses voisins en ont un » — sans voir que `majLe` est une
   date lui aussi, et qu'une liste de `majLe` rend le rythme des saisies que
   la clé opaque était censée cacher.

   Ces deux-là rougissent si quelqu'un remet un champ de date en clair, ici
   ou dans un magasin du suivi ajouté plus tard.
*/
const CHAMPS_QUI_SONT_DES_DATES = ['majLe', 'jour', 'le', 'debut', 'fin', 'activeLe', 'creeLe'];

for (const nom of NOMS_DES_MAGASINS_DU_CYCLE) {
  const declare = MAGASINS_SCELLES.find((m) => m.magasin === nom);
  v(`« ${nom} » est déclaré scellé`, declare !== undefined, true);
  v(`et ne laisse en clair que « id »`, declare?.clairs, ['id']);
  const dates = (declare?.clairs ?? []).filter((c) => CHAMPS_QUI_SONT_DES_DATES.includes(c));
  v(`donc aucun champ de date en clair`, dates, []);
}

/*
   Et la conséquence, assumée : pas de champ de date en clair veut dire pas
   de découpage par période par le chemin générique, qui lit ce champ dans
   l'enregistrement en clair (`dateDe`, `sauvegarde/groupes.ts`). `null` est
   donc la seule valeur juste ici, et la décision 25 demande de l'écrire
   plutôt que de la contourner — c'est fait dans
   `docs/cyclades/decisions-en-attente-cycle-2026-10-19.md`.
*/
for (const nom of NOMS_DES_MAGASINS_DU_CYCLE) {
  v(
    `« ${nom} » n’annonce aucun champ de date à la règle de rétention`,
    (CHAMP_DATE as Record<string, string | null>)[nom] ?? null,
    null,
  );
}

/*
   Et le motif du refus, qui est dit à la personne. Il affirmait « ce magasin
   porte un état courant et non un historique », phrase recopiée aux trois
   endroits qui l'affichaient — vraie de tous les magasins sans date tant que
   c'était la seule raison de refuser, fausse pour un journal de saisies
   quotidiennes. Un écran qui donne une raison fausse au moment où quelqu'un
   décide d'effacer est pire qu'un écran qui n'en donne aucune.
*/
v(
  'le journal ne se dit pas « un état courant »',
  raisonDuRefusDeDecoupage('odysseeCycleJournal').includes('état courant'),
  false,
);
v(
  'et il dit la vraie raison : scellé, clés en empreintes',
  /scellé[\s\S]*empreintes/.test(raisonDuRefusDeDecoupage('odysseeCycleJournal')),
  true,
);
v(
  'les autres magasins gardent le motif par défaut',
  raisonDuRefusDeDecoupage('etat').includes('état courant'),
  true,
);
v(
  'et l’écran affiche le motif de chaque magasin, non une phrase unique',
  readFileSync('src/pages/stockage.astro', 'utf8').includes('m.refus ??'),
  true,
);

/*
   Ce que le module met à la place : un effacement par période coffre ouvert,
   qui recalcule les empreintes des jours voulus. Mesuré sur le code, puisque
   l'exécuter demande une base et un coffre — `essais:suivi:navigateur` le
   fait pour de vrai.
*/
const donneesCycle = source('src/lib/odyssee/donnees-cycle.ts');
v(
  'le module offre un effacement par période',
  /export async function effacerLaPeriode\(/.test(donneesCycle),
  true,
);
v(
  'et il recalcule les empreintes au lieu de lire une date',
  donneesCycle.includes('cleDuJourDeCycle') &&
    !/getAll\('odysseeCycleJournal'\)[\s\S]{0,400}effacerLaPeriode/.test(donneesCycle),
  true,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n8. UNE SAUVEGARDE NON CHIFFRÉE N’EMPORTE PAS LE SUIVI');

/*
   Le § 6.9 encore : « le cycle n'entre dans aucune sauvegarde non chiffrée,
   et l'écran le dit ». Au lot 4 j'avais écrit l'inverse en commentaire — « le
   fichier est chiffré, et les magasins restent scellés à l'intérieur » —, ce
   qui est vrai du cas chiffré seulement : la case « Ne pas chiffrer ce
   fichier » existe, et son propre avertissement dit que le fichier sera
   « lisible par quiconque l'ouvre ».
*/
/*
   LA LISTE DES EXCLUS EN CLAIR CONTIENT LES MAGASINS DU SUIVI, et depuis le
   19 octobre elle en contient un de plus : `odysseeSexe`.

   L'égalité stricte que cet essai affirmait d'abord était la bonne garde tant
   que le suivi était seul concerné. Le pilote a posé que le champ `sexe` suit
   les mêmes règles — sous coffre, hors sauvegarde non chiffrée, aucun champ
   d'index en clair qui le révèle —, donc la liste est strictement plus grande.

   L'exigence reste entière, et elle est écrite dans les deux sens : aucun
   magasin du suivi ne manque à la liste (sinon il partirait en clair), et
   aucun magasin n'y entre sans être nommé ici (sinon il disparaîtrait des
   sauvegardes sans que personne l'ait voulu). `essais:sexe` garde la même
   chose pour `odysseeSexe`, de son côté.
*/
const ATTENDUS_HORS_CLAIR = [...NOMS_DES_MAGASINS_DU_CYCLE, 'odysseeSexe'].sort();
v(
  'la liste des exclus en clair est celle du suivi et du sexe déclaré',
  [...MAGASINS_HORS_SAUVEGARDE_EN_CLAIR].sort(),
  ATTENDUS_HORS_CLAIR,
);
v(
  'et aucun magasin du suivi n’y manque',
  NOMS_DES_MAGASINS_DU_CYCLE.filter((nom) => !MAGASINS_HORS_SAUVEGARDE_EN_CLAIR.includes(nom)),
  [],
);
const enClair = magasinsDUneSauvegarde(false);
const chiffree = magasinsDUneSauvegarde(true);
for (const nom of NOMS_DES_MAGASINS_DU_CYCLE) {
  v(`« ${nom} » part dans un fichier chiffré`, chiffree.includes(nom), true);
  v(`et ne part pas dans un fichier en clair`, enClair.includes(nom), false);
}
v(
  'et rien d’autre ne disparaît au passage',
  MAGASINS_SAUVEGARDES.length - enClair.length,
  ATTENDUS_HORS_CLAIR.length,
);

/*
   La fabrique appelle bien la porte, et avec le bon critère. Lu sur le code
   parce qu'exécuter `fabriquer` demande une base : ce qui est gardé ici,
   c'est qu'un second chemin d'export ne puisse pas naître à côté.
*/
const serviceSauvegarde = source('src/lib/sauvegarde/service.ts');
v(
  'la fabrique décide depuis le mot de passe, et non depuis un drapeau à part',
  serviceSauvegarde.includes('magasinsDUneSauvegarde(motDePasse !== null)'),
  true,
);
v(
  'et n’exporte plus la liste entière sans la filtrer',
  /exporterMagasins\(\s*\)/.test(serviceSauvegarde),
  false,
);

/*
   « Et l'écran le dit. » La phrase est à l'endroit du choix — la case qu'on
   décoche —, et non dans une page d'aide.
*/
const ecranProgression = readFileSync('src/pages/progression.astro', 'utf8');
v(
  'l’écran dit que le suivi ne part pas dans un fichier non chiffré',
  /suivi personnel n’y sera pas[\s\S]{0,120}chiffré/.test(ecranProgression),
  true,
);
v(
  'et il dit aussi ce que restaurer un tel fichier fait au suivi',
  /Restaurer un fichier non chiffré efface[\s\S]{0,40}suivi/.test(ecranProgression),
  true,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n9. LES VERSIONS ET LES CACHES');

/*
   La partie 1 point 10 du prompt 30 demande la « purge physique des
   enregistrements, des versions et des caches ». Les enregistrements sont
   mesurés plus haut. Restent les deux autres, et la réponse n'est pas la même
   pour chacun : il n'y a rien à purger, et c'est par construction. Une
   absence vaut d'être mesurée, sinon elle se perd au premier ajout.

   LES VERSIONS. Le journal d'opérations (`operations`) garde une version par
   écriture, et c'est lui que la synchronisation transporte. Un magasin n'y
   entre que s'il est déclaré dans `MAGASINS_JOURNALISES`
   (`noyau/enregistrements.ts`) — `journaliserEnregistrement` commence par
   demander cette déclaration et ne fait rien sans elle. Les magasins du suivi
   ne sont pas déclarés, donc aucune version du suivi n'existe : il n'y a pas
   à la purger, il n'y a pas à l'écrire.

   C'est la cinquième porte de `PORTES_GARDEES`, et c'est celle que j'avais
   failli manquer : j'allais journaliser le suivi par imitation des modules
   voisins, ce qui l'aurait synchronisé contre la décision 18 sans qu'aucun
   nom de magasin apparaisse dans `sync/`.
*/
for (const nom of NOMS_DES_MAGASINS_DU_CYCLE) {
  v(`« ${nom} » n’est pas déclaré journalisé`, magasinJournalise(nom), undefined);
  v(
    `donc il n’apparaît pas dans la liste des journalisés`,
    MAGASINS_JOURNALISES.some((m) => m.magasin === nom),
    false,
  );
}

/*
   LES CACHES. Mesuré, et non supposé : le service worker (`public/sw.js`) ne
   met en cache que des **réponses HTTP**. Il n'ouvre aucune base — aucune
   mention d'`indexedDB`, d'`openDB` ni d'`idb` —, et les données du suivi ne
   voyagent jamais sur HTTP puisqu'elles ne quittent pas IndexedDB. Aucune
   donnée du suivi n'entre donc dans le cache, et il n'y a rien à en purger.

   Si un jour quelqu'un fait lire la base au service worker, ces deux-là
   rougissent — c'est exactement le moment où il faudra reprendre ce
   raisonnement.
*/
const sw = readFileSync('public/sw.js', 'utf8');
v(
  'le service worker n’ouvre aucune base',
  /indexedDB|openDB|\bidb\b/.test(sw),
  false,
);
v(
  'et il ne connaît aucun magasin du suivi',
  NOMS_DES_MAGASINS_DU_CYCLE.filter((nom) => sw.includes(nom)),
  [],
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs === 0
    ? `\n\x1b[32m${MAGASINS_DU_CYCLE.length} magasins scellés, ${PORTES_GARDEES.length} portes ` +
        `mesurées sur le code de leurs gardiens, clés opaques sur 32 signes.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
