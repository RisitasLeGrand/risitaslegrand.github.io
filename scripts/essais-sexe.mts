/**
 * Le suivi ne s'affiche que pour un sexe féminin déclaré, et on le mesure.
 *
 *   npm run essais:sexe
 *
 * Décision d'Alexis du 19 octobre, qui remplace pour ce point le comportement
 * du prompt 30 et du registre des usages — où le module restait accessible
 * sous un libellé neutre. L'écart est consigné dans
 * `docs/cyclades/decisions-en-attente-cycle-2026-10-19.md`.
 *
 * ## Ce que cet essai garde, et pourquoi il est écrit en table de vérité
 *
 * Une restriction ne se mesure pas sur son cas nominal. « Féminin montre » est
 * la ligne qui passerait même si la fonction rendait `true` partout. Ce qui
 * compte est l'ensemble des cas qui NE doivent pas montrer, et il faut qu'ils
 * soient énumérés : masculin, refus de répondre, question jamais posée,
 * coffre fermé, usage coupé, et toute valeur que personne n'a prévue.
 *
 * La dernière ligne est la plus utile : un balayage de valeurs inattendues
 * rougit si quelqu'un réécrit la règle en liste noire
 * (`sexe_physio !== 'homme'`), ce qui montrerait le suivi à tout ce qui n'est
 * pas exactement masculin, erreurs comprises.
 *
 * ## Ce qu'il ne peut pas garder
 *
 * Il ne prouve pas qu'un écran appelle la règle : c'est l'affaire de
 * `essais:suivi:navigateur`, qui ouvre les pages pour de vrai. Il garde la
 * règle, ses cinq lieux de déclaration, et le fait que les écrans ne disent
 * jamais POURQUOI c'est masqué.
 */
import { readFileSync } from 'node:fs';
import {
  controlerLeSexe,
  ID_DU_SEXE,
  LIBELLES_DU_SEXE,
  leSuiviEstVisible,
  raisonDeMasquer,
  SEXES_DECLARABLES,
  versSexePhysio,
  type SexeDeclare,
} from '../src/lib/odyssee/sexe';
import { contextePersonne, ETAT_VIERGE, usage, type Contexte } from '../src/lib/noyau/registre-usages';
import { MAGASINS_SCELLES } from '../src/lib/noyau/coffre';
import { MAGASINS_HORS_SAUVEGARDE_EN_CLAIR, magasinsDUneSauvegarde } from '../src/lib/db';
import { CHAMP_DATE, groupe } from '../src/lib/sauvegarde/groupes';
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
const source = (chemin: string) => readFileSync(chemin, 'utf8');

/**
 * Le source sans ses commentaires.
 *
 * Les deux contrôles de la section 5 portent sur ce que la page **fait** et
 * sur ce qu'elle **affiche**, pas sur ce que ses commentaires racontent. Sans
 * ce nettoyage, le commentaire qui explique pourquoi `raisonDeMasquer` ne doit
 * pas atteindre l'écran faisait rougir l'essai qui le vérifie — ce qui est
 * drôle une fois et coûteux ensuite : on affaiblit le contrôle plutôt que de
 * le corriger, ou on cesse d'écrire les commentaires.
 *
 * Les deux formes sont retirées : `/* … *\/` du code et `<!-- … -->` des
 * gabarits.
 */
const sansCommentaires = (texte: string) =>
  texte
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const MAGASIN = 'odysseeSexe';

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n1. LA FORME DE LA RÉPONSE');

v('trois réponses, celles d’Alexis', [...SEXES_DECLARABLES], [
  'feminin',
  'masculin',
  'sans-reponse',
]);
v('et leurs libellés, mot pour mot', Object.values(LIBELLES_DU_SEXE), [
  'Féminin',
  'Masculin',
  'Je préfère ne pas répondre',
]);
v(
  'aucun libellé ne porte de « (e) » ni de « (s) »',
  Object.values(LIBELLES_DU_SEXE).filter((l) => /\(e\)|\(s\)/.test(l)),
  [],
);
v(
  'une réponse enregistrée passe son contrôle',
  controlerLeSexe({ id: ID_DU_SEXE, reponse: 'feminin', majLe: '' }),
  [],
);
v(
  'une réponse inconnue est refusée',
  controlerLeSexe({
    id: ID_DU_SEXE,
    reponse: 'autre' as SexeDeclare,
    majLe: '',
  }).length,
  1,
);
v(
  'un identifiant inattendu est refusé',
  controlerLeSexe({ id: 'ailleurs' as typeof ID_DU_SEXE, reponse: 'feminin', majLe: '' }).length,
  1,
);

/*
   La traduction vers le registre. `'sans-reponse'` devient `null`, c'est-à-dire
   « personne ne sait » — ce qui est la vérité pour un consommateur. Le refus
   reste dans le magasin pour que la question ne se repose pas, et il n'a pas à
   voyager plus loin.
*/
v('féminin devient « femme »', versSexePhysio('feminin'), 'femme');
v('masculin devient « homme »', versSexePhysio('masculin'), 'homme');
v('un refus de répondre ne devient pas une réponse', versSexePhysio('sans-reponse'), null);
v('et l’absence non plus', versSexePhysio(null), null);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n2. LA TABLE DE VÉRITÉ DE LA RESTRICTION');

/*
   Les deux seules lignes qui montrent, et toutes celles qui masquent. Écrites
   en table pour qu'un cas ajouté demain se voie comme une ligne manquante, et
   non comme un `if` oublié dans une fonction.
*/
const CAS: { quoi: string; contexte: Contexte; coffre: boolean; visible: boolean }[] = [
  { quoi: 'féminin, coffre ouvert', contexte: { sexe_physio: 'femme' }, coffre: true, visible: true },
  {
    quoi: 'féminin, coffre FERMÉ',
    contexte: { sexe_physio: 'femme' },
    coffre: false,
    visible: false,
  },
  { quoi: 'masculin', contexte: { sexe_physio: 'homme' }, coffre: true, visible: false },
  {
    quoi: 'intersexe ou autre',
    contexte: { sexe_physio: 'intersexe_ou_autre' },
    coffre: true,
    visible: false,
  },
  {
    quoi: 'refus de répondre, ou question jamais posée (« inconnu »)',
    contexte: { sexe_physio: 'inconnu' },
    coffre: true,
    visible: false,
  },
  { quoi: 'usage coupé : la porte rend {}', contexte: {}, coffre: true, visible: false },
];

for (const cas of CAS) {
  v(`${cas.quoi} → ${cas.visible ? 'visible' : 'masqué'}`, leSuiviEstVisible(cas.contexte, cas.coffre), cas.visible);
}

/*
   LA LISTE BLANCHE, mesurée sur des valeurs que personne n'a prévues.

   C'est l'essai qui rougit si la règle est réécrite en liste noire. Aucune de
   ces valeurs n'est `'femme'`, donc aucune ne doit montrer — y compris celles
   qui ressemblent à « femme » de près.
*/
const VALEURS_IMPREVUES = [
  'Femme',
  'FEMME',
  'femmes',
  'feminin',
  'Féminin',
  'f',
  '',
  'null',
  'undefined',
  'homme ',
  'autre',
];
const quiMontrent = VALEURS_IMPREVUES.filter((valeur) =>
  leSuiviEstVisible({ sexe_physio: valeur as Contexte['sexe_physio'] }, true),
);
v('aucune valeur imprévue ne montre le suivi', quiMontrent, []);

/*
   Et la raison du masquage, qui sert aux essais et jamais à l'écran : chaque
   fermeture est distinguée, donc chacune est prévue.
*/
v('coffre fermé se distingue', raisonDeMasquer({ sexe_physio: 'femme' }, false), 'coffre-ferme');
v('un usage coupé se distingue', raisonDeMasquer({}, true), 'usage-coupe');
v('« inconnu » se distingue', raisonDeMasquer({ sexe_physio: 'inconnu' }, true), 'inconnu');
v('masculin se distingue', raisonDeMasquer({ sexe_physio: 'homme' }, true), 'pas-feminin');
v('et féminin n’a aucune raison', raisonDeMasquer({ sexe_physio: 'femme' }, true), null);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n3. LA RÈGLE PASSE PAR LA PORTE DU REGISTRE');

/*
   La règle reçoit un `Contexte`, donc ce que la porte a bien voulu rendre au
   consommateur nommé. Deux choses à garder : que l'usage existe et lise la
   bonne clé, et qu'un usage coupé masque au lieu de débloquer.
*/
const questionCycle = usage('profil.question-cycle');
v('l’usage existe', questionCycle !== undefined, true);
v('et il lit le sexe', questionCycle?.clesLues, ['sexe_physio']);
v(
  'son effet visible dit que rien n’apparaît sans réponse féminine',
  /n’apparaît que pour une personne de sexe féminin/.test(questionCycle?.effetVisible ?? ''),
  true,
);
v(
  'et son « si inconnu » nomme les trois fermetures, coffre fermé compris',
  /ni proposé ni accessible[\s\S]*préfère ne[\s\S]*jamais posée[\s\S]*coffre fermé/.test(
    questionCycle?.siInconnu ?? '',
  ),
  true,
);

/*
   Couper l'usage masque. Mesuré sur la porte réelle, et non sur une
   supposition : `contextePersonne` rend `{}` pour un usage coupé depuis le
   lot 5d, et `leSuiviEstVisible` traite `{}` comme fermé.
*/
const coupe = contextePersonne('profil.question-cycle', { ...ETAT_VIERGE, sexe: 'femme' }, '2026-10-19', [
  'profil.question-cycle',
]);
v('couper l’usage vide le contexte', coupe, {});
v('donc couper l’usage masque le suivi', leSuiviEstVisible(coupe, true), false);

const pasCoupe = contextePersonne(
  'profil.question-cycle',
  { ...ETAT_VIERGE, sexe: 'femme' },
  '2026-10-19',
  [],
);
v('et sans coupure, une femme voit le suivi', leSuiviEstVisible(pasCoupe, true), true);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n4. LE MAGASIN SUIT LES RÈGLES DU SUIVI');

/*
   Consigne du pilote : « Le nouveau champ `sexe` suit les mêmes règles que le
   suivi : sous coffre ; absent de toute sauvegarde non chiffrée ; aucun champ
   d'index en clair qui le révèle. » Les trois, une par une, plus les deux
   autres lieux de déclaration.
*/
const declare = MAGASINS_SCELLES.find((m) => m.magasin === MAGASIN);
v('il est scellé', declare !== undefined, true);
v('et ne laisse en clair que « id »', declare?.clairs, ['id']);
v(
  'donc ni la réponse ni une date ne sont en clair',
  (declare?.clairs ?? []).filter((c) => c === 'reponse' || c === 'majLe'),
  [],
);
v('il n’entre pas dans une sauvegarde en clair', MAGASINS_HORS_SAUVEGARDE_EN_CLAIR.includes(MAGASIN), true);
v('et il entre dans une sauvegarde chiffrée', magasinsDUneSauvegarde(true).includes(MAGASIN), true);
v('rien en clair', magasinsDUneSauvegarde(false).includes(MAGASIN), false);
v('aucun champ de date à la règle de rétention', CHAMP_DATE[MAGASIN] ?? null, null);
v(
  'il s’efface avec le groupe Odyssée, sans groupe à lui',
  (groupe('odyssee')?.magasins ?? []).includes(MAGASIN),
  true,
);
v('et aucun groupe ne le nomme dans son libellé',
  /sexe/i.test(groupe('odyssee')?.libelle ?? ''),
  false,
);

/*
   Il ne voyage pas. Même raison que le suivi, et le même oubli possible : la
   journalisation ne nomme aucun magasin dans `sync/`, elle se déclare
   ailleurs.
*/
v('il n’est pas déclaré journalisé', magasinJournalise(MAGASIN), undefined);
v('ni présent dans la liste', MAGASINS_JOURNALISES.some((m) => m.magasin === MAGASIN), false);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n5. AUCUN ÉCRAN NE DIT POURQUOI C’EST MASQUÉ');

/*
   Décision 11, qu'Alexis ne lève pas : « Aucun libellé neutre de repli. » Une
   personne à qui le suivi est masqué ne doit pas lire « masqué parce que vous
   avez répondu masculin » — ce serait dire qu'il existe quelque chose à
   masquer. L'absence est muette.

   Mesuré sur la page que l'adresse directe rend quand c'est masqué : ni le mot
   « cycle », ni le mot « suivi », ni « règles », ni « menstruel », ni aucune
   des raisons.
*/
const ecranDuSuivi = sansCommentaires(source('src/pages/odyssee/corps/suivi.astro'));
/*
   LES BORNES SONT DES BALISES, PAS DES COMMENTAIRES, et elles sont vérifiées.

   Ma première version bornait le bloc par un commentaire `<!-- ══ FIN HORS
   PORTÉE -->`. Les commentaires sont retirés avant la mesure, donc
   `indexOf` rendait -1, donc `slice` prenait TOUTE LA PAGE — et l'essai
   mesurait le contenu du suivi en croyant mesurer la page neutre.

   Les deux bornes sont donc des identifiants qui existent dans le rendu, et
   leur présence est affirmée avant de s'en servir : un découpage qui se
   trompe de région ne mesure rien, et ne le dit pas.
*/
const debutDuBloc = ecranDuSuivi.indexOf('id="hors-portee"');
const finDuBloc = ecranDuSuivi.indexOf('id="dans-la-portee"');
v('la borne de début est trouvée', debutDuBloc >= 0, true);
v('la borne de fin est trouvée, et après le début', finDuBloc > debutDuBloc, true);
const bloc = ecranDuSuivi.slice(debutDuBloc, finDuBloc);
v('la page neutre existe', bloc.length > 0, true);
/*
   « suivi » n'est pas dans cette liste, et c'est raisonné : c'est le nom
   neutre que la décision 20 a choisi précisément parce qu'il ne révèle rien,
   et l'adresse `/odyssee/corps/suivi/` le porte de toute façon. Ce qu'Alexis
   interdit sur la page neutre est le mot « cycle ».

   Les quatre autres y sont parce qu'ils diraient soit ce qui est caché
   (« règles », « menstruel »), soit POURQUOI (« féminin », « masculin »,
   « sexe ») — et dire pourquoi revient à dire qu'il y a quelque chose.
*/
const MOTS_QUI_TRAHISSENT = ['cycle', 'règles', 'menstruel', 'féminin', 'masculin', 'sexe'];
v(
  'et elle ne porte aucun mot qui trahirait ce qu’elle cache',
  MOTS_QUI_TRAHISSENT.filter((mot) => new RegExp(mot, 'i').test(bloc)),
  [],
);
v(
  'elle renvoie vers Corps',
  /\/odyssee\/corps\//.test(bloc),
  true,
);

/*
   ══ LE SENS DU DÉFAUT, DANS LE HTML SERVI ═══════════════════════════════

   Ces trois-là viennent d'un sabotage qui est passé au vert.

   J'avais retiré `hidden` de la ligne de l'écran Corps, pour voir. L'essai au
   navigateur n'a rien dit : le script repeint la ligne au chargement, donc il
   la recachait aussitôt, et l'essai mesurait l'état d'après. La ligne était
   pourtant visible le temps que le script tourne — et visible pour toujours
   si le script échoue, ou si le navigateur n'exécute pas JavaScript.

   Or c'est précisément ce que le commentaire de `corps.astro` promet : « un
   défaut de rendu, un script qui échoue, un navigateur sans JavaScript
   laissent la ligne cachée ». Une promesse que rien ne mesure finit par
   cesser d'être vraie.

   La mesure porte donc sur le GABARIT, c'est-à-dire sur ce que le serveur
   envoie avant toute exécution. C'est la seule façon de garder un défaut
   initial : au navigateur, il a déjà été corrigé par le script quand on
   regarde.
*/
const ecranCorps = source('src/pages/odyssee/corps.astro');
const baliseDe = (texte: string, id: string): string => {
  const place = texte.indexOf(`id="${id}"`);
  if (place < 0) return '';
  const debut = texte.lastIndexOf('<', place);
  const fin = texte.indexOf('>', place);
  return debut >= 0 && fin > debut ? texte.slice(debut, fin + 1) : '';
};

const baliseDeLaLigne = baliseDe(ecranCorps, 'ligne-du-suivi');
v('la ligne du suivi existe dans le gabarit de Corps', baliseDeLaLigne.length > 0, true);
v('et elle part CACHÉE, avant toute exécution', /\bhidden\b/.test(baliseDeLaLigne), true);

const baliseDuContenu = baliseDe(ecranDuSuivi, 'dans-la-portee');
v('le contenu du suivi part caché lui aussi', /\bhidden\b/.test(baliseDuContenu), true);

const baliseDeLaPorte = baliseDe(ecranDuSuivi, 'hors-portee');
v(
  'et la page neutre part VISIBLE : c’est elle qui reste si rien ne tourne',
  /\bhidden\b/.test(baliseDeLaPorte),
  false,
);

/*
   ══ « QUAND CONSULTER » N'A NI PORTE NI LIEN ════════════════════════════

   Choix d'Alexis du 19 octobre vers 17 h 10 — l'option 2. La restriction porte
   sur le suivi ; les signes d'alerte restent accessibles sans coffre, sans
   déclaration, quel que soit le sexe.

   Deux choses à garder, et elles tirent en sens opposés : que la page ne se
   referme pas (aucun appel à la règle de visibilité, aucun bloc caché par
   défaut), et qu'elle ne révèle rien (aucun lien vers le suivi, pas même
   conditionnel — un lien qui paraît pour certaines personnes est ce qui se
   remarque quand on compare deux écrans).

   `essais:suivi:navigateur` mesure l'accès pour de vrai, coffre fermé et
   réponse masculine. Ici on garde le GABARIT, parce qu'une porte ajoutée par
   mégarde se verrait dans le source avant de se voir à l'écran.
*/
const ecranDesSignes = sansCommentaires(source('src/pages/odyssee/corps/quand-consulter.astro'));
v(
  'la page des signes n’appelle aucune règle de visibilité',
  /leSuiviEstVisible|portee-du-suivi|reponseAAfficher/.test(ecranDesSignes),
  false,
);
v(
  'elle ne demande pas le coffre',
  /FormulaireCoffre|coffre\b/.test(ecranDesSignes),
  false,
);
v(
  'et elle ne porte aucun lien vers le suivi',
  ecranDesSignes.includes('/odyssee/corps/suivi/'),
  false,
);
/*
   LE MOT, DANS CE QU'ELLE AFFICHE — donc après le frontmatter.

   Cette ligne a rougi sur `import … from '…/chaines-du-suivi'` : un chemin de
   module, que personne ne lit à l'écran. Mesurer le fichier entier revenait à
   interdire un nom de fichier, ce qui n'est pas l'objet — l'objet est que la
   page ne PARLE pas du suivi.

   Le gabarit commence après le second `---`. Ce qui est avant est du code.
*/
const finDuFrontmatter = ecranDesSignes.indexOf('---', ecranDesSignes.indexOf('---') + 3);
v('le frontmatter se termine', finDuFrontmatter > 0, true);
const gabaritDesSignes = ecranDesSignes.slice(finDuFrontmatter);
v('ni le mot « suivi » dans ce qu’elle affiche', /\bsuivi\b/i.test(gabaritDesSignes), false);

/*
   Et `raisonDeMasquer` ne doit atteindre aucun écran. Elle existe pour les
   essais ; si un gabarit l'appelait, la raison finirait affichée un jour.
*/
const ecrans = [
  'src/pages/odyssee/corps/suivi.astro',
  'src/pages/odyssee/corps.astro',
  'src/pages/odyssee/corps/quand-consulter.astro',
];
v(
  'aucun écran n’appelle « raisonDeMasquer »',
  ecrans.filter((chemin) => sansCommentaires(source(chemin)).includes('raisonDeMasquer')),
  [],
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs === 0
    ? `\n\x1b[32m${CAS.length} lignes de table, ${VALEURS_IMPREVUES.length} valeurs imprévues, ` +
        `un seul chemin ouvert : « femme », coffre ouvert.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
