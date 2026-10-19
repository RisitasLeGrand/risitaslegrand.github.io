/**
 * « Lu par » : la déclaration confrontée au code (P3 du prompt 56).
 *
 *   npm run essais:lu-par
 *
 * ## Le défaut que cet essai existe pour empêcher
 *
 * L'écran « Mon profil » affichait, sous chaque champ, « Utilisé par :
 * Révisions, Odyssée », et 52 cases pour restreindre cette portée. Les deux
 * étaient fausses : `profilDeBranche` — la seule fonction qui applique la
 * portée — n'avait **aucun appelant**. Une promesse peut rester vraie au sens
 * du type et fausse au sens de la personne pendant des mois, parce que rien ne
 * la contredit à voix haute.
 *
 * La ligne « Lu par » la remplace, et elle ne vaut que si quelque chose la
 * casse quand elle cesse d'être vraie. C'est le rôle de ce fichier.
 *
 * ## Les trois sens de la confrontation
 *
 * 1. **Déclaré, donc lu.** Chaque lecteur déclaré au catalogue existe sur le
 *    disque et porte une lecture reconnue du champ.
 * 2. **Lu, donc déclaré.** Chaque lecture reconnue trouvée dans `src/` est
 *    déclarée — soit comme lecteur, soit, quand la lecture ne produit aucun
 *    effet, dans la table des lectures sans effet, avec sa raison.
 * 3. **La ceinture.** Tout endroit où le nom d'un champ apparaît en littéral
 *    **sans** forme de lecture reconnue est déclaré, avec sa raison. Sans ce
 *    troisième sens, une lecture écrite demain sous une forme que ce fichier
 *    ne connaît pas passerait en silence — et c'est exactement ainsi que la
 *    portée était devenue fausse.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHAMPS,
  CHAMPS_A_CAVIARDER,
  CHAMPS_PLUS_DEMANDES,
  aUnUsage,
  champsDeBranche,
  controlerChamps,
  questionsDeBranche,
  questionsDuSocle,
} from '../src/lib/noyau/profil.ts';
import { lecteursDuChamp, rubriquesDuRegistre } from '../src/lib/profil-lecteurs.ts';
import { CLES_SENSIBLES, USAGES, usagesLisant } from '../src/lib/noyau/registre-usages.ts';
import { BRANCHES } from '../src/lib/branches.ts';

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
const vrai = (quoi: string, condition: boolean) => v(quoi, condition, true);

/* ══════════════════════════════════════════════════════════════════════════
   Ce que « lire un champ » veut dire, par écrit
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les formes par lesquelles le code lit la valeur d'un champ de profil.
 *
 * La liste est **close**, et c'est ce qui la rend utile : une forme nouvelle
 * ne passe pas pour une lecture, elle tombe dans la ceinture, et il faut
 * alors la déclarer — c'est-à-dire la voir.
 *
 * `champ: 'x'` n'y est pas, volontairement. Dans `observation.ts` et
 * `adaptation.ts`, cette forme nomme le champ qu'une proposition **écrirait**,
 * et non une valeur qu'on lit : l'observation propose des matières fortes sans
 * jamais lire celles que vous avez déclarées. La confondre avec une lecture
 * ferait passer pour utile un champ que rien n'utilise — le contraire de ce
 * que cet essai cherche.
 */
const FORMES_DE_LECTURE = [
  (n: string) => new RegExp(`\\bchamp\\(\\s*['"]${n}['"]`),
  (n: string) => new RegExp(`\\blire\\(\\s*['"]${n}['"]`),
  (n: string) => new RegExp(`\\bchampDeProfil\\(\\s*['"]${n}['"]`),
  (n: string) => new RegExp(`\\bheureDeclaree\\(\\s*['"]${n}['"]`),
];

/**
 * Les quatre fichiers que le prompt écarte, et pourquoi.
 *
 * Ils nomment tous les champs, par métier : ce sont le catalogue, la façon de
 * poser les questions, l'écran qui les pose et l'écran qui les affiche. Les
 * compter comme lecteurs ferait dire à chaque champ « lu par Mon profil », ce
 * qui n'apprend rien.
 */
const ECARTES: Readonly<Record<string, string>> = {
  'src/lib/noyau/profil.ts': 'le catalogue : il déclare les champs.',
  'src/lib/noyau/initialisation.ts': 'la façon de poser les questions ; il préremplit.',
  'src/pages/initialisation.astro': 'l’écran qui pose les questions.',
  'src/pages/profil.astro': 'l’écran qui affiche les champs.',
};

/**
 * Les lectures reconnues qui **ne produisent aucun effet**.
 *
 * Toutes dans `noyau/reglages.ts`, et toutes pour la même raison : le réglage
 * déduit qui en découle n'est appliqué nulle part, et n'était affiché que sur
 * l'écran du profil (constat B2 de l'audit, mesuré à 5 réglages sur 8). Les
 * déclarer ici plutôt que comme lecteurs est la différence entre « quelque
 * chose lit ce champ » et « quelque chose s'en sert ».
 */
const LECTURES_SANS_EFFET: readonly [string, string, string][] = [
  ['joursTravail', 'src/lib/noyau/reglages.ts', 'le réglage « jours de repos » en découle, et rien ne l’applique : la rotation ne lit pas ce champ.'],
  ['plagesTravail', 'src/lib/noyau/reglages.ts', 'le réglage « créneaux » en découle, et rien ne l’applique.'],
  ['styleAccompagnement', 'src/lib/noyau/reglages.ts', 'le réglage « avis » en découle, et rien ne l’applique.'],
  ['heureRappel', 'src/lib/noyau/reglages.ts', 'le réglage « avis » en découle, et rien ne l’applique.'],
  ['concours', 'src/lib/noyau/reglages.ts', 'le réglage « parcours ouverts » en découle, et rien ne l’applique : le parcours courant se choisit dans Révisions.'],
  ['tempsParSemaine', 'src/lib/noyau/reglages.ts', 'le réglage « objectif et plafond » en découle, et rien ne l’applique ; le champ est lu, avec effet, par l’adaptation.'],
  ['heuresRevision', 'src/lib/noyau/reglages.ts', 'le réglage « objectif et plafond » en découle, et rien ne l’applique ; le champ est lu, avec effet, par l’adaptation.'],
];

/**
 * Les endroits où le nom d'un champ apparaît **sans** être une lecture.
 *
 * Trois familles, et la première est la plus nombreuse : des noms qui se
 * ressemblent. `nom` est aussi l'identifiant d'un champ de formulaire, d'une
 * entrée de registre et d'une colonne chiffrée ; `lever` et `coucher` sont
 * aussi les deux bouts d'une nuit relevée dans Odyssée > Corps ; `activite`
 * est aussi un domaine de veille. La deuxième famille est la provenance
 * déclarée d'un réglage (`depuis: [...]`), la troisième le champ qu'une
 * proposition écrirait (`champ: '...'`).
 */
const MENTIONS_SANS_LECTURE: readonly [string, string, string][] = [
  ['nom', 'src/lib/noyau/coffre.ts', 'une colonne qui doit rester chiffrée, dans un tout autre magasin.'],
  ['nom', 'src/lib/odyssee/molecules.ts', 'un champ admis dans une entrée du registre des molécules.'],
  ['nom', 'src/lib/odyssee/regles-pointage.ts', 'le nom d’une règle de pointage.'],
  ['nom', 'src/pages/odyssee/molecule.astro', 'le nom de la molécule, passé dans l’adresse.'],
  ['nom', 'src/pages/odyssee/rapprocher.astro', 'le nom d’une règle, dans son formulaire.'],
  ['nom', 'src/pages/sport/exercices.astro', 'le nom d’un exercice, dans son formulaire.'],
  ['nom', 'src/pages/sport/programmes.astro', 'le nom d’un programme, dans son formulaire.'],
  ['lever', 'src/lib/odyssee/corps.ts', 'l’heure de lever d’une nuit relevée, qui est un fait et non un champ de profil.'],
  ['coucher', 'src/lib/odyssee/corps.ts', 'l’heure de coucher d’une nuit relevée, même raison.'],
  ['lever', 'src/pages/odyssee/corps.astro', 'les deux bouts d’une nuit, saisis dans Odyssée > Corps.'],
  ['coucher', 'src/pages/odyssee/corps.astro', 'les deux bouts d’une nuit, saisis dans Odyssée > Corps.'],
  ['lever', 'src/lib/parametres/catalogue.ts', 'l’identifiant du réglage de Ma journée ; sa lecture est dans acces.ts.'],
  ['coucher', 'src/lib/parametres/catalogue.ts', 'l’identifiant du réglage de Ma journée ; sa lecture est dans acces.ts.'],
  ['moment-revue', 'src/lib/parametres/catalogue.ts', 'l’identifiant du réglage de Ma journée ; sa lecture est dans acces.ts.'],
  ['fuseau', 'src/lib/odyssee/veille.ts', 'une confusion possible d’un indicateur de veille — « voyage, fuseau ».'],
  ['activite', 'src/lib/odyssee/veille.ts', 'un domaine de veille, qui porte le même mot.'],
  ['activite', 'src/pages/statistiques.astro', 'l’ancre d’une section de la page.'],
  ['tempsParSemaine', 'src/lib/noyau/observation.ts', 'le champ qu’une proposition écrirait ; la valeur déclarée n’est pas lue.'],
  ['domainesActifs', 'src/lib/noyau/observation.ts', 'le champ qu’une proposition écrirait ; la valeur déclarée n’est pas lue.'],
  ['concours', 'src/lib/noyau/observation.ts', 'le champ qu’une proposition écrirait ; la valeur déclarée n’est pas lue.'],
  ['heuresRevision', 'src/lib/noyau/observation.ts', 'le champ qu’une proposition écrirait ; la valeur déclarée n’est pas lue.'],
  ['matieresFortes', 'src/lib/noyau/observation.ts', 'le champ qu’une proposition écrirait ; la valeur déclarée n’est pas lue.'],
  ['matieresFaibles', 'src/lib/noyau/observation.ts', 'le champ qu’une proposition écrirait ; la valeur déclarée n’est pas lue.'],
  ['momentRevision', 'src/lib/noyau/observation.ts', 'le champ qu’une proposition écrirait ; la valeur déclarée n’est pas lue.'],
  ['momentRevision', 'src/lib/noyau/reglages.ts', 'la provenance déclarée du réglage « créneaux », qui ne lit pas sa valeur.'],
];

/* ══════════════════════════════════════════════════════════════════════════
   Le relevé
   ══════════════════════════════════════════════════════════════════════════ */

const fichiers: string[] = [];
const parcourir = (dossier: string) => {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) parcourir(chemin);
    else if (/\.(ts|svelte|astro|mts)$/.test(entree)) fichiers.push(chemin.replace(/\\/g, '/'));
  }
};
parcourir('src');

/** Le code seul : les commentaires parlent des champs, et c'est leur métier. */
const codeDe = (chemin: string) =>
  readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\*.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

const lectures: string[] = [];
const mentions: string[] = [];
for (const chemin of fichiers) {
  if (chemin in ECARTES) continue;
  const code = codeDe(chemin);
  for (const c of CHAMPS) {
    if (!code.includes(`'${c.champ}'`) && !code.includes(`"${c.champ}"`)) continue;
    const lu = FORMES_DE_LECTURE.some((forme) => forme(c.champ).test(code));
    (lu ? lectures : mentions).push(`${c.champ} → ${chemin}`);
  }
}
/* Le caviardage se lit à l'import de la liste, et non au nom du champ : c'est
   tout l'objet de `CHAMPS_A_CAVIARDER`, que l'export ne doit pas recopier. */
for (const chemin of fichiers) {
  if (chemin in ECARTES || !codeDe(chemin).includes('CHAMPS_A_CAVIARDER')) continue;
  for (const nom of CHAMPS_A_CAVIARDER) lectures.push(`${nom} → ${chemin}`);
}

const trier = (xs: readonly string[]) => [...xs].sort((a, b) => (a < b ? -1 : 1));

console.log('\n1. LE CATALOGUE');
v('aucun problème de déclaration', controlerChamps(BRANCHES.map((b) => b.id)), []);
v('les quatre fichiers écartés sont nommés, avec leur raison', Object.keys(ECARTES).length, 4);
for (const chemin of Object.keys(ECARTES)) {
  vrai(`${chemin} existe toujours`, fichiers.includes(chemin));
}

console.log('\n2. DÉCLARÉ, DONC LU');
for (const c of CHAMPS) {
  for (const lecteur of c.luPar ?? []) {
    if (!fichiers.includes(lecteur.module)) {
      v(`${c.champ} : le lecteur ${lecteur.module} existe`, false, true);
      continue;
    }
    const code = codeDe(lecteur.module);
    const lit = lecteur.protection
      ? code.includes('CHAMPS_A_CAVIARDER')
      : FORMES_DE_LECTURE.some((forme) => forme(c.champ).test(code));
    vrai(`${c.champ} : ${lecteur.module} le lit vraiment`, lit);
  }
}
v(
  'les champs caviardés sont ceux qui déclarent un lecteur de protection',
  [...CHAMPS_A_CAVIARDER],
  ['prenom', 'nom'],
);

console.log('\n3. LU, DONC DÉCLARÉ');
/**
 * La porte de l'âge : le seul fichier qui lise les trois champs de naissance.
 *
 * Ce n'est pas une exception à la règle « lu, donc déclaré » : c'est l'autre
 * source. Le champ déclare les clés du registre, le registre nomme les usages
 * qui les lisent, et `etat-personne.ts` est le guichet par lequel ils passent —
 * le contrôle du graphe d'imports interdit à tout autre fichier de lire ces
 * champs, et vérifie la taille de sa propre liste d'autorisés.
 */
const PORTE_DE_LAGE = 'src/lib/etat-personne.ts';

const declarees = trier([
  ...CHAMPS.flatMap((c) => (c.luPar ?? []).map((l) => `${c.champ} → ${l.module}`)),
  ...CHAMPS.filter((c) => c.clesDuRegistre?.length).map((c) => `${c.champ} → ${PORTE_DE_LAGE}`),
  ...LECTURES_SANS_EFFET.map(([champ, module]) => `${champ} → ${module}`),
]);
v('toute lecture reconnue est déclarée', trier(lectures), declarees);
for (const [, , raison] of LECTURES_SANS_EFFET) {
  vrai('une lecture sans effet porte sa raison', raison.trim().length > 20);
}

console.log('\n4. LA CEINTURE : LES MENTIONS QUI NE SONT PAS DES LECTURES');
v(
  'toute mention en littéral est expliquée',
  trier(mentions),
  trier(MENTIONS_SANS_LECTURE.map(([champ, module]) => `${champ} → ${module}`)),
);
for (const [, , raison] of MENTIONS_SANS_LECTURE) {
  vrai('une mention porte sa raison', raison.trim().length > 20);
}

console.log('\n5. CE QUE L’ÉCRAN DIRA');
for (const c of CHAMPS) {
  const dits = lecteursDuChamp(c);
  if (!c.luPar && !c.clesDuRegistre) {
    v(`${c.champ} : aucune ligne « Lu par »`, dits, []);
    continue;
  }
  vrai(`${c.champ} : la ligne « Lu par » n’est pas vide`, dits.length > 0);
  /* Pas de chemin, pas d'extension, pas d'identifiant criard. « IA » reste
     permis : c'est un sigle, et la section G réserve les capitales aux sigles. */
  vrai(
    `${c.champ} : aucun libellé technique`,
    dits.every((d) => !/src\/|\.ts|\.astro|[A-Z]{3,}/.test(d)),
  );
}
v(
  'le lever nomme ses quatre lecteurs, fondus en quatre phrases',
  lecteursDuChamp(CHAMPS.find((c) => c.champ === 'lever')!),
  [
    'l’heure à laquelle votre journée change de date',
    'la fenêtre de la revue (Odyssée)',
    'Paramètres, Ma journée',
    'la bascule entre le thème clair et le thème sombre',
  ],
);
v(
  'les domaines fondent deux modules en une seule phrase',
  lecteursDuChamp(CHAMPS.find((c) => c.champ === 'domainesActifs')!).length,
  2,
);

/* ── La seconde source : le registre des usages ─────────────────────────── */
console.log('\n5 bis. L’ÂGE VIENT DU REGISTRE, ET DE LUI SEUL');

/*
   L'arbitrage du pilote, après le constat du constructeur : l'âge — et demain
   le sexe et le cycle — a déjà sa table de lecteurs, `registre-usages.ts`, qui
   appartient à qui construit le cycle. La ligne « Lu par » en est DÉRIVÉE, et
   ce fichier-là n'est pas touché. Tous les autres champs déclarent au
   catalogue. Un champ aux deux endroits aurait deux listes à tenir d'accord,
   et c'est exactement l'état que « Lu par » existe pour supprimer.
*/
const AGE = ['naissanceAnnee', 'naissanceMois', 'majeurDeclare'];
for (const nom of AGE) {
  const c = CHAMPS.find((x) => x.champ === nom)!;
  vrai(`${nom} dérive ses lecteurs du registre`, (c.clesDuRegistre ?? []).length > 0);
  v(`${nom} ne déclare aucun lecteur au catalogue`, c.luPar, undefined);
  vrai(`${nom} garde donc un usage, et reste demandé`, aUnUsage(c));
}
v(
  'aucun champ n’est déclaré aux deux endroits',
  CHAMPS.filter(
    (c) => c.clesDuRegistre?.length && (c.luPar ?? []).some((l) => l.protection !== true),
  ).map((c) => c.champ),
  [],
);
for (const c of CHAMPS) {
  for (const cle of c.clesDuRegistre ?? []) {
    vrai(
      `${c.champ} : la clé « ${cle} » est lue par au moins un usage déclaré`,
      usagesLisant(cle).length > 0,
    );
  }
}
/*
   LA LIGNE DIT CE QUI MARCHE, ET COMPTE CE QUI ATTEND.

   Six usages sur treize reposent sur une source que cet environnement ne sait
   pas atteindre, et le registre le déclare. Les compter avec les autres ferait
   dire à la ligne que sept rubriques lisent votre âge, alors que cinq le font.
*/
v(
  'la ligne de l’année nomme les rubriques livrables, et compte celles qui attendent',
  lecteursDuChamp(CHAMPS.find((c) => c.champ === 'naissanceAnnee')!),
  [
    'les usages de votre âge dans Révisions, Exports, Profil, Santé et Psyché, ' +
      'et 4 autres qui attendent une source — tous listés dans Qui utilise mon âge',
  ],
);
v(
  'et celle de la majorité n’en compte aucune : ses trois usages marchent',
  lecteursDuChamp(CHAMPS.find((c) => c.champ === 'majeurDeclare')!),
  ['les usages de votre âge dans Profil, Santé et Psyché, listés dans Qui utilise mon âge'],
);
/*
   LES USAGES SENSIBLES NE SORTENT PAS DE LEUR ÉCRAN (2.6 du prompt de l'âge).
   Aucun ne lit ces clés aujourd'hui : l'assertion dit donc deux choses — que
   rien ne fuit, et que le filtre existe avant le premier usage.
*/
for (const cle of CLES_SENSIBLES) {
  v(`aucune rubrique n’est rendue pour « ${cle} »`, rubriquesDuRegistre([cle]), {
    livrables: [],
    enAttente: 0,
  });
}
vrai(
  'et aucun champ de profil ne déclare une clé sensible',
  CHAMPS.every((c) => !(c.clesDuRegistre ?? []).some((cle) => CLES_SENSIBLES.includes(cle))),
);
/* Ce que la ligne affirme, compté sur le registre : cinq rubriques livrables
   et quatre usages en attente, soit les neuf usages qui lisent l'âge. */
{
  const lisantLAge = USAGES.filter((u) =>
    u.clesLues.some((c) => c === 'tranche_age' || c === 'majeur'),
  );
  v('neuf usages lisent l’âge', lisantLAge.length, 9);
  v(
    'dont quatre attendent une source',
    lisantLAge.filter((u) => u.fondement.type === 'source-a-obtenir').length,
    4,
  );
  v(
    'et les cinq autres sont livrables',
    rubriquesDuRegistre(['tranche_age', 'majeur']).livrables.length,
    5,
  );
}

console.log('\n6. CE QUI N’EST PLUS DEMANDÉ (DÉCISION 2)');
v('le catalogue tient trente-sept champs', CHAMPS.length, 37);
/* Quinze, et non quatorze : la décision 3 a donné un lecteur à
   `datesEpreuves` — le compte à rebours de l'accueil de Révisions. Ces deux
   nombres bougent ensemble, et doivent le faire : leur somme est le catalogue. */
v('quinze champs ont un usage', CHAMPS.filter(aUnUsage).length, 15);
v('vingt-deux ne sont plus demandés', CHAMPS_PLUS_DEMANDES.length, 22);
v(
  'et les deux comptes couvrent le catalogue',
  CHAMPS.filter(aUnUsage).length + CHAMPS_PLUS_DEMANDES.length,
  CHAMPS.length,
);
v('le socle passe de dix-huit questions à huit', questionsDuSocle().length, 8);
v(
  'les huit, dans l’ordre des questions',
  questionsDuSocle().map((c) => c.champ),
  ['prenom', 'naissanceAnnee', 'fuseau', 'lever', 'moment-revue', 'coucher', 'tempsParSemaine', 'domainesActifs'],
);
/* Trois depuis le compte à rebours : la question des dates d'épreuves revient
   parce que quelque chose les lit enfin, et par le même chemin que les autres —
   personne ne l'a remise à la main. */
v('Révisions en pose trois', questionsDeBranche('revisions').map((c) => c.champ), [
  'datesEpreuves',
  'heuresRevision',
  'momentRevision',
]);
v('Sport n’en pose plus aucune', questionsDeBranche('sport').length, 0);
v('Odyssée en pose une', questionsDeBranche('odyssee').map((c) => c.champ), ['ciblesEquilibre']);
vrai(
  'aucune question posée sans lecteur',
  [...questionsDuSocle(), ...BRANCHES.flatMap((b) => questionsDeBranche(b.id))].every(aUnUsage),
);
vrai(
  'aucun champ plus demandé ne reparaît dans les questions',
  [...questionsDuSocle(), ...BRANCHES.flatMap((b) => questionsDeBranche(b.id))].every(
    (c) => !CHAMPS_PLUS_DEMANDES.includes(c.champ),
  ),
);
/* Le champ n'est plus demandé ; il n'a pas disparu. C'est l'interdit 1. */
vrai(
  'les champs plus demandés restent au catalogue, avec leur question',
  CHAMPS_PLUS_DEMANDES.every((nom) => {
    const c = CHAMPS.find((x) => x.champ === nom);
    return Boolean(c) && c!.question.trim().length >= 10;
  }),
);
vrai(
  'et restent offerts au remplissage par leur branche',
  champsDeBranche('sport').length === 5 && questionsDeBranche('sport').length === 0,
);

console.log('\n7. LES PROMESSES AFFICHÉES (P12, DÉCISION 6)');

/*
   `regle` est la phrase qui dit, sous le champ, ce qu'il change dans
   l'application. Un champ que rien ne lit ne change rien : la phrase était
   alors une promesse que le code ne tenait pas. Le contrôle du catalogue le
   refuse désormais, et on l'éprouve ici avec un cas construit.
*/
vrai(
  'toute promesse affichée a un lecteur',
  CHAMPS.every((c) => !c.regle || aUnUsage(c)),
);
v(
  'les champs qui ont perdu la leur, nommés pour que personne ne la remette sans y penser',
  ['formalite', 'joursTravail', 'styleAccompagnement', 'concours', 'heureRappel'].filter(
    (nom) => CHAMPS.find((c) => c.champ === nom)?.regle !== undefined,
  ),
  [],
);
v(
  'la salutation ne se coupe plus d’un réglage qui n’existe pas',
  CHAMPS.find((c) => c.champ === 'prenom')?.regle,
  'La salutation du menu.',
);
vrai(
  'et aucune promesse ne nomme le jour logique, qui est un mot de code',
  CHAMPS.every((c) => !/jour logique/.test(c.regle ?? '')),
);

/*
   DÉCISION 6 : « et mon sexe » a quitté le titre, le lien et le registre.

   Le sexe ne se déclare nulle part dans Cyclades. Une exception restait
   déclarée ici — le lien de `profil.astro`, qui attendait la correction A7 du
   58 pour être refait —, et elle a disparu avec la refonte de la page : la
   liste est vide, et l'assertion dit maintenant qu'aucun fichier ne porte plus
   l'ancien titre. C'était le bon rouge : il a rappelé de nettoyer la
   déclaration au lieu de la laisser traîner.
*/
const avecLeSexe = fichiers.filter((chemin) =>
  /Qui utilise mon âge et mon sexe/.test(codeDe(chemin)),
);
v('plus aucun fichier ne porte l’ancien titre', trier(avecLeSexe), []);
v(
  'le champ des usages coupés ne nomme plus le sexe',
  CHAMPS.find((c) => c.champ === 'usagesCoupes')?.libelle,
  'Usages de mon âge que j’ai coupés',
);
vrai(
  'ni sa question',
  !/sexe/.test(CHAMPS.find((c) => c.champ === 'usagesCoupes')?.question ?? ''),
);

console.log(
  rouges
    ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m`
    : '\n\x1b[32mTout est vert.\x1b[0m',
);
process.exit(rouges ? 1 : 0);
