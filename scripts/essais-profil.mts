/**
 * Le profil commun : la portée, la fusion par champ, les divergences.
 *
 * Ce que ces essais protègent n'a pas d'écran qui le dise : qu'un champ
 * restreint soit **retiré** de ce qu'une branche lit et non masqué, qu'une
 * modification sur deux appareils se fusionne champ par champ au lieu de faire
 * conflit sur tout le profil, qu'une divergence réelle soit **vue**, et qu'un
 * champ supprimé ne revienne pas.
 */
import { DOMAINES } from '../src/lib/noyau/domaines';
import { domainesAMontrer } from '../src/lib/noyau/saisies';
import {
  CHAMPS,
  CIBLE_INITIALISATION,
  TYPE_CHAMP_PROFIL,
  TYPE_INITIALISATION,
  avancement,
  champDeCible,
  champDeclare,
  champsDeBranche,
  aUnUsage,
  champsDuSocle,
  NON_REPONSE_INCONNU,
  NON_REPONSE_REFUS,
  estUneNonReponse,
  lisibleParUnLecteur,
  questionsDuSocle,
  cibleDuChamp,
  controlerChamps,
  divergences,
  lecteurs,
  lireInitialisation,
  lireProfil,
  porteeInclut,
  pourBranche,
  valider,
} from '../src/lib/noyau/profil';
import { operation, SANS_LOT, type Operation } from '../src/lib/noyau/operations';
import { BRANCHES } from '../src/lib/branches';
import { typeDeFait } from '../src/lib/noyau/faits';

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

let compteur = 0;
const ecrire = (
  champ: string,
  valeur: unknown,
  ms: number,
  appareil = 'bureau',
  extra: Record<string, unknown> = {},
): Operation => {
  compteur += 1;
  return operation({
    id: `01PROFIL${String(compteur).padStart(17, '0')}`,
    appareil,
    hlc: { ms, compteur: 0 },
    type: TYPE_CHAMP_PROFIL,
    cible: cibleDuChamp(champ),
    lot: SANS_LOT,
    charge: { valeur, source: 'declare', ...extra },
  });
};

const supprimer = (champ: string, ms: number, appareil = 'bureau'): Operation => {
  compteur += 1;
  return operation({
    id: `01EFFACE${String(compteur).padStart(17, '0')}`,
    appareil,
    hlc: { ms, compteur: 0 },
    type: TYPE_CHAMP_PROFIL,
    cible: cibleDuChamp(champ),
    lot: SANS_LOT,
    charge: { supprime: true },
  });
};

const BRANCHES_CONNUES = BRANCHES.map((b) => b.id);

console.log('\nLE CATALOGUE DES CHAMPS TIENT');

v('aucun problème de catalogue', controlerChamps(BRANCHES_CONNUES), []);
/* D6 : plus aucun champ n'est obligatoire. Ce contrôle disait l'inverse — le
   prénom était le seul à l'être. Il dit maintenant qu'AUCUN ne porte même la
   marque : le champ « obligatoire » est retiré du type, donc un catalogue qui
   en déclarerait un ne compilerait plus, et celui-ci n'en garde aucune trace. */
v(
  'aucun champ ne porte de marque d’obligation',
  CHAMPS.filter((c) => Object.keys(c).includes('obligatoire')).map((c) => c.champ),
  [],
);
/* Vingt-et-un champs au socle, et **huit** questions depuis la décision 2 du
   prompt 56. Les treize autres se taisent pour deux raisons distinctes, et les
   deux sont vérifiées séparément plutôt que confondues dans un seul nombre :

   - trois se demandent au moment du besoin — le mois, la majorité déclarée et
     les usages coupés ;
   - dix ne sont plus demandés parce que **rien ne les lit**. Leur valeur reste
     au catalogue, avec sa question, et une déclaration de lecteur suffit à
     reposer la question : c'est `aUnUsage`, et `essais-lu-par.mts` confronte
     cette déclaration au code.

   Avant le 56, l'avancement annonçait « deux réponses sur dix-huit » en
   comptant des questions dont la réponse ne servait à rien. */
v('huit questions au socle', questionsDuSocle().length, 8);
v('vingt-et-un champs au socle', champsDuSocle().length, 21);
v(
  'et les trois de l’écart sont bien ceux qui se demandent au besoin',
  champsDuSocle().filter((c) => c.demandeAuBesoin).map((c) => c.champ),
  ['naissanceMois', 'majeurDeclare', 'usagesCoupes'],
);
v(
  'les dix autres se taisent faute de lecteur, et on les nomme',
  champsDuSocle()
    .filter((c) => !c.demandeAuBesoin && !aUnUsage(c))
    .map((c) => c.champ),
  [
    'nom',
    'formalite',
    'langue',
    'activite',
    'joursTravail',
    'plagesTravail',
    'objectifsAnnee',
    'objectifsVie',
    'tempsParDomaine',
    'styleAccompagnement',
  ],
);
v('six pour Révisions', champsDeBranche('revisions').length, 6);
v('cinq pour Sport', champsDeBranche('sport').length, 5);
v('cinq pour Odyssée', champsDeBranche('odyssee').length, 5);

/*
 * L'invariant de confidentialité du module : A.3 dit que les données sensibles
 * « restent dans leur domaine et ne passent pas dans le profil commun ». Une
 * blessure connue n'est donc pas un champ : c'est un fait « sport.blessure »,
 * sous la matrice de permissions. L'essai le vérifie en cherchant un champ qui
 * porterait le nom d'un type sensible du catalogue de faits.
 */
v(
  'aucun champ ne double un type de fait sensible',
  CHAMPS.filter((c) => typeDeFait(c.champ)?.sensible).map((c) => c.champ),
  [],
);
v(
  'et aucun champ ne s’appelle « blessures », qui est un fait de Sport',
  CHAMPS.filter((c) => /blessure/i.test(c.champ)),
  [],
);

console.log('\nLA CIBLE PORTE LE CHAMP, ET SE RELIT');

v('une cible par champ', cibleDuChamp('prenom'), 'profil:prenom');
v('et elle se défait', champDeCible('profil:prenom'), 'prenom');
v('une cible étrangère n’est pas un champ', champDeCible('quiz:Q1'), null);
v('ni une cible sans champ', champDeCible('profil:'), null);

console.log('\nLE DERNIER ÉCRIVAIN GAGNE, CHAMP PAR CHAMP');

{
  const profil = lireProfil([
    ecrire('prenom', 'Alexis', 10),
    ecrire('lever', '07:00', 20),
    ecrire('prenom', 'Alex', 30),
  ]);
  v('deux champs posés', [...profil.keys()].sort(), ['lever', 'prenom']);
  v('la dernière valeur du prénom gagne', profil.get('prenom')!.valeur, 'Alex');
  v('et l’autre champ n’a pas bougé', profil.get('lever')!.valeur, '07:00');
  v('la version compte les écritures', profil.get('prenom')!.version, 2);
  v('et celle du lever vaut un', profil.get('lever')!.version, 1);
}

{
  /*
   * Le cas qui justifie l'enregistrement par champ : modifier le prénom ici et
   * l'heure de lever là. Avec un objet unique, l'un des deux aurait écrasé
   * l'autre ou aurait demandé un arbitrage ; ici, les deux tiennent.
   */
  const profil = lireProfil([
    ecrire('prenom', 'Alexis', 10, 'bureau'),
    ecrire('lever', '06:30', 20, 'portable'),
  ]);
  v('deux appareils, deux champs, aucun conflit', profil.get('prenom')!.valeur, 'Alexis');
  v('et le second champ vient de l’autre appareil', profil.get('lever')!.appareil, 'portable');
}

{
  const profil = lireProfil([ecrire('prenom', 'Alexis', 10), supprimer('prenom', 20)]);
  v('un champ supprimé disparaît', profil.has('prenom'), false);
  const repose = lireProfil([
    ecrire('prenom', 'Alexis', 10),
    supprimer('prenom', 20),
    ecrire('prenom', 'Alexis', 30),
  ]);
  v('et se repose si on le repose', repose.get('prenom')!.valeur, 'Alexis');
}

{
  // Un champ hors catalogue est ignoré, et non écrit à l'aveugle.
  const inconnu = operation({
    id: '01INCONNU0000000000000001',
    appareil: 'bureau',
    hlc: { ms: 10, compteur: 0 },
    type: TYPE_CHAMP_PROFIL,
    cible: cibleDuChamp('champDUneVersionFuture'),
    lot: SANS_LOT,
    charge: { valeur: 'x', source: 'declare' },
  });
  v('un champ inconnu du catalogue est ignoré', lireProfil([inconnu]).size, 0);
}

console.log('\nUN CHAMP RESTREINT EST RETIRÉ, PAS MASQUÉ');

{
  const profil = lireProfil([
    ecrire('prenom', 'Alexis', 10),
    ecrire('lever', '07:00', 20),
    ecrire('matieresFortes', ['Économie'], 30),
  ]);

  const revisions = pourBranche(profil, 'revisions');
  vrai('Révisions lit le rythme, qui la concerne', revisions.has('lever'));
  vrai('et ses propres matières', revisions.has('matieresFortes'));
  vrai('mais pas le prénom : aucune branche n’en a besoin', !revisions.has('prenom'));

  const sport = pourBranche(profil, 'sport');
  vrai('Sport lit le rythme', sport.has('lever'));
  vrai('et pas les matières de Révisions', !sport.has('matieresFortes'));

  /*
   * Retiré, et non masqué : la carte ne porte **aucune** clé pour un champ hors
   * portée. Rendre une clé à valeur nulle aurait appris que le champ existe, et
   * parfois cela suffit — c'est le même raisonnement que pour la matrice de
   * permissions par type de fait.
   */
  v('la carte ne porte aucune clé pour un champ hors portée', [...sport.keys()].includes('matieresFortes'), false);

  v('la portée par défaut du prénom est vide', champDeclare('prenom')!.porteeParDefaut, []);
  vrai('« toutes » inclut n’importe quelle branche', porteeInclut('toutes', 'sport'));
  vrai('une liste vide n’inclut rien', !porteeInclut([], 'sport'));
  v(
    'l’écran peut nommer les lecteurs d’un champ',
    lecteurs(profil.get('matieresFortes')!, BRANCHES_CONNUES),
    ['revisions'],
  );
}

{
  // Une portée posée à l'écriture l'emporte sur celle du catalogue.
  const profil = lireProfil([ecrire('lever', '07:00', 10, 'bureau', { portee: ['odyssee'] })]);
  const lu = pourBranche(profil, 'revisions');
  vrai('un champ restreint à Odyssée n’est plus lu par Révisions', !lu.has('lever'));
  vrai('mais l’est par Odyssée', pourBranche(profil, 'odyssee').has('lever'));
}

console.log('\nUNE DIVERGENCE RÉELLE EST VUE ; UNE CORRECTION NE L’EST PAS');

{
  const deuxFoisIci = divergences([
    ecrire('activite', 'agent public', 10, 'bureau'),
    ecrire('activite', 'en préparation de concours', 20, 'bureau'),
  ]);
  v('deux écritures du même appareil ne sont pas une divergence', deuxFoisIci.length, 0);

  const deuxAppareils = divergences([
    ecrire('activite', 'agent public', 10, 'bureau'),
    ecrire('activite', 'en préparation de concours', 20, 'portable'),
  ]);
  v('deux appareils qui ne disent pas la même chose, oui', deuxAppareils.length, 1);
  v('et les deux versions sont rendues', deuxAppareils[0].versions.length, 2);
  v(
    'du plus ancien au plus récent',
    deuxAppareils[0].versions.map((x) => x.appareil),
    ['bureau', 'portable'],
  );

  const memeValeur = divergences([
    ecrire('activite', 'agent public', 10, 'bureau'),
    ecrire('activite', 'agent public', 20, 'portable'),
  ]);
  v('deux appareils d’accord ne divergent pas', memeValeur.length, 0);

  const liste = divergences([
    ecrire('joursTravail', ['lundi', 'mardi'], 10, 'bureau'),
    ecrire('joursTravail', ['mardi', 'lundi'], 20, 'portable'),
  ]);
  v('une liste dans un autre ordre n’est pas une divergence de valeur', liste.length, 1);
}

console.log('\nL’INITIALISATION N’A LIEU QU’UNE FOIS, ET ELLE VOYAGE');

{
  const marque = operation({
    id: '01INIT00000000000000000001',
    appareil: 'bureau',
    hlc: { ms: 50, compteur: 0 },
    type: TYPE_INITIALISATION,
    cible: CIBLE_INITIALISATION,
    lot: SANS_LOT,
    charge: { termineeLe: '2026-10-12T09:00:00.000Z', allegee: true },
  });
  v('la marque est lue', lireInitialisation([marque])?.termineeLe, '2026-10-12T09:00:00.000Z');
  v('et son caractère allégé aussi', lireInitialisation([marque])?.allegee, true);
  v('sans marque, rien', lireInitialisation([]), null);
  /*
   * Elle voyage comme toute opération : un nouvel appareil qui reçoit le paquet
   * la reçoit avec, et ne repose donc pas les quatorze questions. C'est
   * l'exigence d'A.6, et c'est pour cela que ce n'est pas un drapeau local.
   */
  v('elle n’est pas un champ de profil', lireProfil([marque]).size, 0);
}

console.log('\nL’AVANCEMENT SE LIT, POUR POUVOIR REPRENDRE');

{
  const etat = avancement([ecrire('prenom', 'Alexis', 10), ecrire('lever', '07:00', 20)]);
  v('deux réponses sur huit', [etat.repondus, etat.total], [2, 8]);
  /* « nom » venait en premier avant le 56 : il n'est plus demandé, et c'est
     l'année de naissance qui suit le prénom dans l'ordre des questions. */
  v('et les restants sont dans l’ordre des questions', etat.restants[0].champ, 'naissanceAnnee');
  v('l’initialisation n’est pas marquée', etat.initialisation, null);

  const vide = avancement([]);
  v('sans rien, rien n’est posé', vide.repondus, 0);
  v('et toutes les questions du socle restent', vide.restants.length, 8);
}

console.log('\nLA VALIDATION VÉRIFIE LA FORME, PAS LE CONTENU');

v('une heure bien formée passe', valider('lever', '07:00').recevable, true);
v('minuit aussi', valider('lever', '00:00').recevable, true);
v('une heure impossible est refusée', valider('lever', '25:00').recevable, false);
v('un texte au lieu d’une heure est refusé', valider('lever', 'le matin').recevable, false);
v('une activité libre passe', valider('activite', 'en reconversion').recevable, true);
v('un nombre là où un texte est attendu est refusé', valider('activite', 3).recevable, false);
v('une liste de textes passe', valider('joursTravail', ['lundi']).recevable, true);
v('une liste de nombres est refusée', valider('joursTravail', [1, 2]).recevable, false);
v('un booléen passe pour un booléen', valider('suiviFinances', false).recevable, true);
v('une répartition passe', valider('tempsParDomaine', { cognition: 10 }).recevable, true);
v('un tableau au lieu d’une répartition est refusé', valider('tempsParDomaine', []).recevable, false);
v('un champ inconnu est refusé', valider('inexistant', 'x').recevable, false);
vrai(
  'et le refus dit pourquoi, en français',
  (valider('lever', '25:00').motif ?? '').includes('HH:MM'),
);

/* ══════════════════════════════════════════════════════════════════════════
   D6 — PLUS AUCUN CHAMP N'EST OBLIGATOIRE
   ══════════════════════════════════════════════════════════════════════════ */

/*
   CE QUE CE BLOC TIENT, ET CE QU'IL NE PEUT PAS TENIR.

   Le prénom était le seul champ obligatoire, et `controlerChamps` vérifiait
   qu'il le restât. L'obligation est retirée, et avec elle le champ
   « obligatoire » du type : « obligatoire: true » ne compile plus, de sorte
   que le compilateur refuse d'avance ce qu'un contrôle n'aurait crié qu'après
   coup. C'est le garde le plus solide, mais il ne se mesure pas ici — on ne
   teste pas un code qui ne compile pas.

   Ce qui se mesure, c'est que le catalogue reste VALIDE sans champ obligatoire
   — l'invariant retiré aurait refusé ce catalogue-ci — et que le prénom soit
   devenu un champ comme les autres, qui peut manquer sans que rien ne le
   réclame.
*/
{
  /* La validité du catalogue est déjà tenue plus haut : l'invariant retiré
     aurait refusé celui-ci, donc ce contrôle-là porte aussi D6. */
  const lePrenom = champDeclare('prenom');
  vrai('le prénom est toujours déclaré', Boolean(lePrenom));
  vrai(
    'et il ne porte plus aucune marque d’obligation',
    !Object.keys(lePrenom as object).includes('obligatoire'),
  );

  /* Un profil vierge n'est donc pas un profil en faute : les huit questions
     du socle restent à poser, et aucune n'est due. */
  const vierge = avancement([]);
  v('un profil vierge n’a aucune réponse', vierge.repondus, 0);
  v('et les huit questions du socle restent ouvertes', vierge.restants.length, 8);
  vrai(
    'l’avancement n’annonce plus de réponse attendue',
    !Object.keys(vierge).includes('prenomPose'),
  );
}

/*
   LES DEUX BLOCS SONT CONSERVÉS, ET LE CONFLIT ÉTAIT PUREMENT ADDITIF.

   « d6-prenom-facultatif » ajoutait le bloc D6 au même endroit que
   « f6-ecran » ajoutait le bloc F6 : même point d'insertion, logique
   différente des deux côtés, donc Git ne pouvait pas trancher. Il n'y a
   rien à choisir — les deux mesurent des choses distinctes, et perdre l'un
   des deux retirerait un garde-fou livré.

   La coupure tombait au milieu d'un appel des deux côtés : la parenthèse
   et l'accolade de fermeture étaient communes, après le marqueur. D'où la
   fermeture explicite ci-dessus, et ce second cartouche.
*/
/* ══════════════════════════════════════════════════════════════════════════
   F6 — LES DEUX NON-RÉPONSES NE SE LISENT JAMAIS COMME DES RÉPONSES
   ══════════════════════════════════════════════════════════════════════════ */

/*
   TROIS ÉTATS, ET ILS NE SE CONFONDENT PAS.

   Rien dans le profil : la question n'a pas été vue, et le parcours la posera.
   « inconnu » : elle a été vue, et la personne ne sait pas. « sans-reponse » :
   elle a été vue, et la personne a refusé.

   Les deux derniers sont STOCKÉS, sans quoi « Mon profil » ne pourrait pas
   montrer qu'on a refusé et le parcours reposerait la question. Ce qui est
   interdit, c'est qu'un lecteur les prenne pour une réponse : un refus traité
   comme une valeur, c'est la réponse qu'on n'a pas voulu donner, utilisée
   quand même.
*/
console.log('\nF6 — LES NON-RÉPONSES');

{
  vrai('« inconnu » est une non-réponse', estUneNonReponse(NON_REPONSE_INCONNU));

  /*
     RECEVABLE POUR TOUTE NATURE, ET C'EST INDISPENSABLE.

     Une non-réponse n'est pas une valeur mal typée. Sans cette règle, « Je
     préfère ne pas répondre » était refusé par « Un nombre est attendu. » sur
     tout champ qui n'attend pas un texte, et l'écran répondait à un refus par
     un reproche de forme. Les trois sorties valent pour tous les champs, ou
     pour aucun.
  */
  for (const non of [NON_REPONSE_INCONNU, NON_REPONSE_REFUS]) {
    vrai(`« ${non} » est recevable sur un nombre`, valider('naissanceAnnee', non).recevable);
    vrai(`« ${non} » est recevable sur une heure`, valider('lever', non).recevable);
    vrai(`« ${non} » est recevable sur une liste`, valider('matieresFortes', non).recevable);
    vrai(
      `« ${non} » est recevable sur une répartition`,
      valider('tempsParDomaine', non).recevable,
    );
  }
  /* Et une vraie faute de forme reste refusée : la porte ne s'ouvre pas pour
     tout le monde. */
  faux('une chaîne quelconque reste refusée sur un nombre', valider('naissanceAnnee', 'bof').recevable);
  vrai('« sans-reponse » aussi', estUneNonReponse(NON_REPONSE_REFUS));

  /* LE PIÈGE D'UNE SEULE LETTRE. « inconnue », au féminin, est une RÉPONSE
     parmi les options de la phase sportive — elle doit rester lisible. */
  faux('mais « inconnue », au féminin, n’en est pas une', estUneNonReponse('inconnue'));
  faux('ni une réponse ordinaire', estUneNonReponse('Alexis'));
  faux('ni un nombre', estUneNonReponse(0));
  faux('ni l’absence', estUneNonReponse(undefined));

  /* CE QU'UNE BRANCHE REÇOIT : rien pour une non-réponse, la valeur sinon. */
  const profil = lireProfil([
    ecrire('lever', NON_REPONSE_REFUS, 10),
    ecrire('coucher', '23:00', 20),
  ]);
  const lu = pourBranche(profil, 'odyssee');
  faux('une branche ne reçoit pas un refus', lu.has('lever'));
  v('mais reçoit la réponse voisine', lu.get('coucher'), '23:00');

  /* CE QU'UN LECTEUR DIRECT REÇOIT. Dix appels passent par `champ()`, qui
     lit la base et n'est donc pas interrogeable ici ; sa décision est sortie
     en fonction pure pour qu'elle se mesure. Sans ce contrôle, le garde est
     tombé une fois sous sabotage sans qu'aucun essai ne rougisse. */
  v('un lecteur ne reçoit rien d’un refus', lisibleParUnLecteur(profil.get('lever') ?? null), null);
  v(
    'ni d’un « je ne sais pas »',
    lisibleParUnLecteur(lireProfil([ecrire('lever', NON_REPONSE_INCONNU, 10)]).get('lever') ?? null),
    null,
  );
  v(
    'mais reçoit une réponse ordinaire, telle quelle',
    lisibleParUnLecteur(profil.get('coucher') ?? null)?.valeur,
    '23:00',
  );
  v('et rien reste rien', lisibleParUnLecteur(null), null);

  /* ET POURTANT LE PROFIL LE GARDE, pour que l'écran puisse le montrer et
     qu'on puisse revenir dessus. */
  vrai('le profil garde le refus', profil.has('lever'));
  v('avec sa valeur telle quelle', profil.get('lever')?.valeur, NON_REPONSE_REFUS);

  /* DONC LA QUESTION N'EST PLUS À POSER : un refus n'est pas un oubli. */
  const etat = avancement([ecrire('lever', NON_REPONSE_REFUS, 10)]);
  faux(
    'une question refusée ne figure plus dans les restantes',
    etat.restants.some((c) => c.champ === 'lever'),
  );
  v('et elle compte comme traitée', etat.repondus, 1);
}

/* ══════════════════════════════════════════════════════════════════════════
   QUELS DOMAINES UNE RÉPARTITION MONTRE
   ══════════════════════════════════════════════════════════════════════════ */

/*
   CE QUE CE BLOC EMPÊCHE DE REVENIR.

   Une répartition par domaine montrait les domaines actifs PAR DÉFAUT, et non
   ceux que la personne avait retenus. Depuis « Mon profil », un domaine coupé
   y réapparaissait donc : on demandait de répartir du temps sur ce qu'on
   venait justement de retirer.

   La décision est sortie en fonction pure pour qu'elle soit mesurable sans
   navigateur. Et il fallait la mesurer ailleurs : aucune répartition n'est
   atteignable dans l'essai de profil en navigateur — la seule du socle n'a
   aucun lecteur, donc sa carte est absente tant qu'elle est vide, et les
   autres appartiennent à une branche que cet essai n'ouvre pas.
*/
{
  const parDefaut = DOMAINES.filter((d) => d.actifParDefaut).map((d) => d.id);
  const horsDefaut = DOMAINES.filter((d) => !d.actifParDefaut).map((d) => d.id);
  vrai('le catalogue a des domaines actifs par défaut', parDefaut.length >= 2);
  vrai('et d’autres qui ne le sont pas', horsDefaut.length >= 1);

  /* L'INITIALISATION NE CHANGE PAS : sans domaines retenus, ce sont ceux du
     défaut, et c'est la bonne réponse là où la question vient d'être posée. */
  const sansRien = domainesAMontrer(null).map((d) => d.clef);
  v('sans domaines retenus, ce sont ceux du défaut', sansRien, parDefaut);
  vrai(
    'et un domaine inactif par défaut n’y est pas',
    !sansRien.includes(horsDefaut[0]!),
  );

  /* UN DOMAINE COUPÉ EST ABSENT. */
  const gardeUnSeul = domainesAMontrer([parDefaut[0]!]).map((d) => d.clef);
  v('un seul domaine retenu n’en montre qu’un', gardeUnSeul, [parDefaut[0]!]);
  vrai(
    'les autres domaines du défaut ont disparu',
    parDefaut.slice(1).every((id) => !gardeUnSeul.includes(id)),
  );

  /* UN DOMAINE AJOUTÉ HORS DÉFAUT EST MONTRÉ : la liste retenue commande,
     elle ne se contente pas de retrancher. */
  vrai(
    'un domaine retenu hors du défaut est montré',
    domainesAMontrer([horsDefaut[0]!])
      .map((d) => d.clef)
      .includes(horsDefaut[0]!),
  );

  /* LA LISTE VIDE N'EST PAS « null ». Les confondre réafficherait les
     domaines par défaut à quelqu'un qui les a tous coupés. */
  v('aucun domaine retenu ne montre aucune ligne', domainesAMontrer([]).length, 0);

  /* UN IDENTIFIANT INCONNU N'INVENTE PAS DE LIGNE : un domaine retiré du
     catalogue laisserait sa trace dans les profils déjà écrits. */
  v('un identifiant inconnu est ignoré', domainesAMontrer(['pas-un-domaine']).length, 0);

  /* L'ORDRE EST CELUI DU CATALOGUE, PAS CELUI DE LA RÉPONSE. */
  v(
    'l’ordre suit le catalogue même si la réponse est inversée',
    domainesAMontrer([...parDefaut].reverse()).map((d) => d.clef),
    parDefaut,
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
