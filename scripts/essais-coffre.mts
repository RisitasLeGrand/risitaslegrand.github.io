/**
 * Le coffre : ce qu'il scelle, ce qu'il laisse en clair, et ce qu'il refuse.
 *
 * Quatre promesses, et la troisième est celle qui se perd le plus facilement
 * à l'usage :
 *
 * - **ce qui n'est pas déclaré clair est scellé**, y compris un champ ajouté
 *   plus tard sans y penser ;
 * - **le contenu n'est pas lisible** dans l'enregistrement stocké ;
 * - **aucun champ de contenu ne figure parmi les champs clairs** — un contrôle
 *   le vérifie, parce qu'il suffit d'un « juste celui-là, pour éviter un
 *   déchiffrement » pour que le coffre cesse de servir ;
 * - **le rappel de sauvegarde devient insistant** dès qu'il y a du scellé à
 *   perdre : c'est la condition bloquante posée par la décision 3.
 *
 * Node 20+ fournit `crypto.subtle` : le chiffrement s'éprouve donc pour de
 * vrai ici, sans navigateur.
 */
import { TYPES } from '../src/lib/noyau/faits';
import { MAGASINS_JOURNALISES } from '../src/lib/noyau/enregistrements';
import { MAGASINS_PROGRESSION } from '../src/lib/db';
import {
  CHAMPS_INTERDITS_EN_CLAIR,
  JOURS_AVANT_INSISTANCE,
  MAGASINS_SCELLES,
  controlerCoffre,
  controlerCouvertureDesSensibles,
  controlerMagasinsExistants,
  SENSIBLES_EN_CLAIR,
  estFerme,
  estScelle,
  magasinScelle,
  ouvrir,
  rappelDeSauvegarde,
  sceller,
} from '../src/lib/noyau/coffre';
import {
  controlerPrise,
  controlerStatut,
  prisesDuJour,
  statutsEnCours,
  type Prise,
  type StatutHormonal,
} from '../src/lib/odyssee/sensible';

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

/**
 * Compare deux objets **sans tenir compte de l'ordre des clés**.
 *
 * Un aller-retour par le coffre reconstruit l'enregistrement en deux temps —
 * les champs clairs, puis ceux qui sortent du scellé — et l'ordre des clés
 * change donc. Le contenu, lui, est identique. `JSON.stringify` étant
 * sensible à l'ordre, s'en servir tel quel ferait échouer un essai pour une
 * raison qui n'intéresse personne ; et nous dirait, à tort, que le coffre
 * perd quelque chose.
 *
 * Conséquence à connaître : du code qui dépendrait de l'ordre des clés d'un
 * enregistrement scellé se tromperait. Rien n'en dépend, et rien ne le doit.
 */
const trierClefs = (valeur: unknown): unknown =>
  valeur && typeof valeur === 'object' && !Array.isArray(valeur)
    ? Object.fromEntries(
        Object.entries(valeur as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([c, x]) => [c, trierClefs(x)]),
      )
    : valeur;

const memeContenu = (intitule: string, obtenu: unknown, attendu: unknown) =>
  v(intitule, trierClefs(obtenu), trierClefs(attendu));

/** Une clé de coffre, tirée au sort : les essais n'ont pas de mot de passe. */
const cle = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
  'encrypt',
  'decrypt',
]);
const autre = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
  'encrypt',
  'decrypt',
]);

/* ══════════════════════════════════════════════════════════════════════════
   Le catalogue
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLE CATALOGUE DU COFFRE SE TIENT\x1b[0m');

v('aucun problème de catalogue', controlerCoffre(), []);
/*
   Neuf. Trois magasins de Finances avaient été inscrits par anticipation le
   jour de la décision 3, alors que la branche n'existait pas, et
   `controlerCoffre()` passait au vert : d'où `controlerMagasinsExistants`
   plus bas. Ils ont été retirés, puis sont revenus avec la phase 1 — cette
   fois avec leurs magasins.
*/
/*
   Vingt-cinq depuis le journal de ressentis, vingt-quatre depuis la phase 1
   de Santé (D-024), dix-neuf avant elle. Ce nombre écrit en dur est l'office
   de cet essai : un magasin scellé qu'on ajoute doit se déclarer ici, et un
   magasin qui **disparaîtrait** du registre — c'est-à-dire qui cesserait
   d'être chiffré — se verrait aussi.
*/
/*
   Vingt-six depuis A-6, option D : `odysseeReports` a quitté la liste le
   15 octobre. Il y figurait pour la bonne raison — un report est la trace
   qu'un geste a eu lieu dans une branche scellée — mais le sceller rendait
   son écriture impossible coffre fermé, le seul cas où il sert. Son contenu
   reste chiffré, par la boîte aux lettres et non par le coffre.
*/
/*
   Vingt-neuf depuis le suivi personnel, le 19 octobre : `odysseeCycleJournal`
   et `odysseeCycleReglages`.

   ET CET ESSAI ÉTAIT ROUGE DEPUIS QUE JE LES AI AJOUTÉS, sans que je le
   voie : les magasins sont arrivés dans un lot où j'ai lancé les essais que
   je croyais concernés — le schéma, l'effacement, la confidentialité du
   cycle — et pas celui-ci, qui n'est pas dans le socle. Le nombre écrit en
   dur a fait exactement son office ; c'est moi qui ne l'ai pas écouté.

   Le remonter de 27 à 29 n'affaiblit rien : l'exigence est qu'un magasin
   scellé ajouté ou retiré se déclare ici, et elle reste entière.
*/
v('vingt-neuf magasins scellés', MAGASINS_SCELLES.length, 29);
/*
   Le centre : l'identifiant ET le genre, pas un champ de plus.

   N-1, option A. Le genre vaut « à trancher » ou « à savoir », et il est en
   clair pour que la pastille existe coffre fermé. L'assertion nomme les deux
   champs attendus plutôt que leur nombre : ajouter `source` ou `creeLe` ferait
   toujours deux, puis trois, sans que personne le remarque.
*/
v(
  'le centre de notifications en est, avec son identifiant et son genre en clair',
  MAGASINS_SCELLES.find((m) => m.magasin === 'centreElements')?.clairs,
  ['id', 'genre'],
);
v(
  'et surtout PAS la source, que le § 4.1 interdit en clair',
  MAGASINS_SCELLES.find((m) => m.magasin === 'centreElements')?.clairs.includes('source'),
  false,
);
v(
  'ni une date, même au jour',
  MAGASINS_SCELLES.find((m) => m.magasin === 'centreElements')?.clairs.includes('creeLe'),
  false,
);
v(
  'et les reports n’en sont plus — leur chiffrement est asymétrique',
  MAGASINS_SCELLES.some((m) => m.magasin === 'odysseeReports'),
  false,
);
v(
  'le journal de ressentis en fait partie',
  MAGASINS_SCELLES.some((m) => m.magasin === 'odysseeRessentis'),
  true,
);
vrai('les passations d’échelles en sont', estScelle('odysseePassations'));
vrai('la ligne de base de la veille en est', estScelle('odysseeVeilleBases'));
vrai('les repères aussi', estScelle('odysseeVeilleSignaux'));
/*
   Et jusqu'aux réglages : savoir que quelqu'un a *activé* une veille du
   rythme de vie est déjà une information sur lui, avant même qu'elle ait
   rien observé.
*/
vrai('et jusqu’aux réglages de la veille', estScelle('odysseeVeilleReglages'));
vrai('les comptes en sont', estScelle('odysseeComptes'));
vrai('les opérations aussi', estScelle('odysseeOperations'));
vrai('et les lignes de budget', estScelle('odysseeLignesBudget'));
/*
   Et le rapprochement, qui dit « ce prélèvement de 112,40 € est mon
   électricité ». Il en apprend autant que l'opération qu'il range.
*/
vrai('les rapprochements en sont', estScelle('odysseeRapprochements'));
/*
   Et les sept interrupteurs de « Qui lit mon budget » : savoir que quelqu'un
   a ouvert son budget à l'IA, ou fermé tout le reste, est une information sur
   lui.
*/
vrai('et qui lit mon budget', estScelle('odysseeConsommateurs'));
/*
   Et le pointage par vendeur, entier. La liste des commerçants de
   quelqu'un dit où il va, ce qu'il soigne, ce à quoi il adhère et ce qu'il
   donne : elle en apprend plus que presque tout le reste de cette base.
*/
vrai('les vendeurs en sont', estScelle('odysseeVendeurs'));
vrai('les règles de pointage aussi', estScelle('odysseeReglesPointage'));
vrai('les pointages eux-mêmes', estScelle('odysseePointages'));
vrai('et la taxonomie modifiée', estScelle('odysseeTaxonomie'));
vrai('le journal en est', estScelle('odysseeJournal'));
vrai('les check-ins aussi', estScelle('odysseeCheckins'));
vrai('et les points de semaine', estScelle('odysseeHebdos'));
vrai('les médicaments aussi', estScelle('odysseeMedicaments'));
/*
   Et le sommeil **non**. C'est la moitié de la décision 3 : chiffrer par
   principe coûterait un déchiffrement à chaque lecture de la roue du jour,
   pour protéger un nombre d'heures de sommeil.
*/
faux('mais pas le sommeil', estScelle('odysseeNuits'));
faux('ni les séances de sport', estScelle('sportSeances'));
faux('ni les révisions', estScelle('seances'));

v(
  'chaque magasin scellé dit pourquoi',
  MAGASINS_SCELLES.filter((m) => m.pourquoi.length < 20).map((m) => m.magasin),
  [],
);
v(
  'et chacun garde « id » en clair',
  MAGASINS_SCELLES.filter((m) => !m.clairs.includes('id')).map((m) => m.magasin),
  [],
);
vrai('la liste des champs interdits est fournie', CHAMPS_INTERDITS_EN_CLAIR.length > 15);

/* ══════════════════════════════════════════════════════════════════════════
   Sceller et rouvrir
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mCE QUI N’EST PAS DÉCLARÉ CLAIR EST SCELLÉ\x1b[0m');

const entree = {
  id: 'J1',
  jour: '2026-10-12',
  majLe: '2026-10-12T22:00:00.000Z',
  texte: 'Journée difficile, je n’ai pas réussi à m’y mettre.',
  humeur: 2,
  etiquettes: ['fatigue'],
};

const range = await sceller(cle, 'odysseeJournal', entree);

vrai('l’enregistrement est scellé', estFerme(range));
v('l’identifiant reste en clair', range.id, 'J1');
v('le jour aussi, parce qu’il sert d’index', range.jour, '2026-10-12');
v('et la date de mise à jour', range.majLe, entree.majLe);
v('le texte a disparu du clair', range.texte, undefined);
v('l’humeur aussi', range.humeur, undefined);
/*
   `etiquettes` n'est déclaré ni clair ni secret : il part dans le scellé, et
   c'est le sens de la séparation. Un champ ajouté demain sans y penser est
   protégé par défaut ; il faut un geste explicite pour l'exposer.
*/
v('un champ non déclaré part dans le scellé', range.etiquettes, undefined);

{
  /*
     La vérification qui compte vraiment : le contenu n'apparaît nulle part
     dans ce qui est écrit sur le disque. On sérialise tout l'enregistrement
     et on y cherche le texte.
  */
  const surDisque = JSON.stringify(range);
  faux('le texte n’est nulle part dans l’enregistrement', surDisque.includes('Journée difficile'));
  faux('ni un fragment de celui-ci', surDisque.includes('fatigue'));
  vrai('mais le jour s’y lit — c’est la fuite assumée', surDisque.includes('2026-10-12'));
}

{
  const rouvert = await ouvrir<typeof entree>(cle, range);
  memeContenu('rouvert, il est identique', rouvert, entree);
}
{
  let leve = false;
  try {
    await ouvrir(autre, range);
  } catch {
    leve = true;
  }
  vrai('une autre clé ne l’ouvre pas', leve);
}
{
  /* Un enregistrement d'avant la migration n'est pas scellé : il passe tel quel. */
  const ancien = { id: 'J0', jour: '2026-01-01', texte: 'Écrit avant le coffre.' };
  memeContenu('un enregistrement non scellé traverse', await ouvrir(cle, ancien), ancien);
}
{
  let leve = false;
  try {
    await sceller(cle, 'sportSeances', { id: 'X' });
  } catch {
    leve = true;
  }
  vrai('sceller un magasin non déclaré est refusé', leve);
}
{
  /*
     Deux scellés du même contenu diffèrent : l'IV est tiré au sort à chaque
     écriture. Sans cela, deux journées identiques se reconnaîtraient à leur
     chiffré, et l'on saurait qu'elles sont identiques sans les lire.
  */
  const premier = await sceller(cle, 'odysseeJournal', entree);
  const second = await sceller(cle, 'odysseeJournal', entree);
  faux(
    'deux scellés du même texte diffèrent',
    JSON.stringify(premier.scelle) === JSON.stringify(second.scelle),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Le contrôle attrape un champ de contenu en clair
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mUN CHAMP DE CONTENU EN CLAIR EST ATTRAPÉ\x1b[0m');

{
  /*
     On éprouve le contrôle sur un catalogue volontairement fautif — celui
     qu'on écrirait un jour de fatigue pour éviter un déchiffrement de plus.
     Sans cet essai, `controlerCoffre()` ne prouverait que l'état actuel.
  */
  const fautif = [
    { magasin: 'odysseeComptes', pourquoi: 'Finances.', clairs: ['id', 'solde'] },
    { magasin: 'odysseeJournal', pourquoi: '', clairs: ['jour'] },
  ];
  const problemes: string[] = [];
  for (const m of fautif) {
    if (!m.clairs.includes('id')) problemes.push('id');
    if (!m.pourquoi.trim()) problemes.push('pourquoi');
    for (const champ of m.clairs) {
      if (CHAMPS_INTERDITS_EN_CLAIR.includes(champ)) problemes.push(champ);
    }
  }
  v('un solde en clair, un id manquant, une raison vide', problemes.sort(), [
    'id',
    'pourquoi',
    'solde',
  ]);
  vrai('et « solde » est bien dans la liste des interdits', CHAMPS_INTERDITS_EN_CLAIR.includes('solde'));
  vrai('« texte » aussi', CHAMPS_INTERDITS_EN_CLAIR.includes('texte'));
  vrai('et « montant »', CHAMPS_INTERDITS_EN_CLAIR.includes('montant'));
}

v(
  'les champs clairs des médicaments se limitent aux index',
  magasinScelle('odysseeMedicaments')?.clairs,
  ['id', 'jour', 'majLe'],
);

/* ══════════════════════════════════════════════════════════════════════════
   Les deux garde-fous qui manquaient
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mUNE DÉCLARATION SANS MAGASIN NE PROTÈGE RIEN\x1b[0m');

{
  /*
     Le cas réel : la décision 3 avait inscrit trois magasins de Finances au
     catalogue alors qu'ils n'existaient pas, et `controlerCoffre()` passait
     au vert. Le contrôle relisait la forme des déclarations sans vérifier
     qu'elles portaient sur quelque chose.
  */
  v(
    'tous les magasins scellés existent au schéma',
    controlerMagasinsExistants(MAGASINS_PROGRESSION as readonly string[]),
    [],
  );
  const sansRien = controlerMagasinsExistants([]);
  v('un schéma vide les signale tous', sansRien.length, MAGASINS_SCELLES.length);
  vrai('et le message nomme le magasin', sansRien[0].includes(MAGASINS_SCELLES[0].magasin));
}

console.log('\n\x1b[1mTOUT TYPE SENSIBLE EST SCELLÉ, OU DISPENSÉ AVEC SA RAISON\x1b[0m');

{
  const typesSensibles = TYPES.filter((t) => t.sensible).map((t) => t.id);
  vrai('treize types sont déclarés sensibles', typesSensibles.length === 13);
  v(
    'le registre réel est couvert',
    controlerCouvertureDesSensibles(MAGASINS_JOURNALISES, typesSensibles),
    [],
  );
  v(
    'six magasins sensibles sont nommément laissés en clair',
    SENSIBLES_EN_CLAIR.map((d) => d.magasin),
    [
      'sportBlessures',
      'odysseePesees',
      'odysseeMesures',
      'odysseeRepas',
      // Le seul dont la raison n'est pas l'ergonomie, mais la mesure
      // elle-même : scellé, il n'enregistrerait qu'un échantillon biaisé.
      'odysseeUsage',
      'odysseeSante',
    ],
  );
  v(
    'et chacun dit pourquoi',
    SENSIBLES_EN_CLAIR.filter((d) => d.pourquoi.length < 30).map((d) => d.magasin),
    [],
  );

  /*
     Le contrôle doit **attraper** le cas qu'il prétend couvrir, sinon il ne
     prouve rien. On simule la branche future qui ajoute un magasin portant
     un type sensible sans y penser.
  */
  const avecOubli = [
    ...MAGASINS_JOURNALISES,
    { magasin: 'odysseeConfidences', type: 'odyssee.journal' },
  ];
  const attrape = controlerCouvertureDesSensibles(avecOubli, typesSensibles);
  v('un magasin sensible oublié est attrapé', attrape.length, 1);
  vrai('et le message dit quoi faire', attrape[0].includes('Scellez-le, ou dites pourquoi'));
}

/* ══════════════════════════════════════════════════════════════════════════
   La condition bloquante : le rappel de sauvegarde
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mCHIFFRER SANS SAUVEGARDER FABRIQUE UNE PERTE DÉFINITIVE\x1b[0m');

v(
  'sans scellé et sauvegardé hier, rien à dire',
  rappelDeSauvegarde({ joursDepuisLaSauvegarde: 1, enregistrementsScelles: 0 }).insistance,
  'aucune',
);
v(
  'sans scellé mais jamais sauvegardé, un rappel discret',
  rappelDeSauvegarde({ joursDepuisLaSauvegarde: null, enregistrementsScelles: 0 }).insistance,
  'discrete',
);
v(
  'du scellé et aucune sauvegarde : urgent',
  rappelDeSauvegarde({ joursDepuisLaSauvegarde: null, enregistrementsScelles: 12 }).insistance,
  'urgente',
);
vrai(
  'et le message dit que c’est définitif',
  rappelDeSauvegarde({
    joursDepuisLaSauvegarde: null,
    enregistrementsScelles: 12,
  }).message.includes('définitivement'),
);
v(
  'du scellé et deux semaines de retard : insistant',
  rappelDeSauvegarde({
    joursDepuisLaSauvegarde: JOURS_AVANT_INSISTANCE + 1,
    enregistrementsScelles: 3,
  }).insistance,
  'insistante',
);
v(
  'du scellé sauvegardé hier : discret, mais pas muet',
  rappelDeSauvegarde({ joursDepuisLaSauvegarde: 1, enregistrementsScelles: 3 }).insistance,
  'discrete',
);
vrai(
  'et il rappelle que la sauvegarde est la seule copie',
  rappelDeSauvegarde({
    joursDepuisLaSauvegarde: 1,
    enregistrementsScelles: 3,
  }).message.includes('seule copie'),
);

/* ══════════════════════════════════════════════════════════════════════════
   Enregistrement seul : ce que le module ne fait pas
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mENREGISTREMENT SEUL, ET RIEN D’AUTRE\x1b[0m');

const prise = (p: Partial<Prise> = {}): Prise => ({
  id: 'P',
  jour: '2026-10-12',
  le: '2026-10-12T08:00:00.000Z',
  nom: 'Paracétamol',
  dose: '500 mg',
  voie: 'orale',
  motif: 'Mal de tête',
  note: '',
  majLe: '2026-10-12T08:00:00.000Z',
  ...p,
});

v('une prise bien formée ne pose rien', controlerPrise(prise()), []);
v('une prise sans nom est refusée', controlerPrise(prise({ nom: '  ' })).length, 1);
v(
  'une voie inconnue est refusée',
  controlerPrise(prise({ voie: 'telepathie' as never })).length,
  1,
);

{
  /*
     `prisesDuJour` ne rend qu'un **constat** : ce qui a été pris, combien de
     fois, à quelles heures. Pas d'écart à une posologie, pas d'alerte
     d'oubli — le module ne sait pas ce qui était prévu, et c'est la règle
     entière du contrat : « aucun conseil, aucune dose proposée ».
  */
  const groupes = prisesDuJour(
    [
      prise({ id: '1', le: '2026-10-12T08:00:00.000Z' }),
      prise({ id: '2', le: '2026-10-12T20:00:00.000Z' }),
      prise({ id: '3', nom: 'Vitamine D', le: '2026-10-12T08:05:00.000Z' }),
      prise({ id: '4', jour: '2026-10-11' }),
    ],
    '2026-10-12',
  );
  v('deux produits ce jour-là', groupes.length, 2);
  v('le paracétamol, deux fois', groupes.find((g) => g.nom === 'Paracétamol')?.fois, 2);
  v('la veille n’est pas comptée', groupes.reduce((n, g) => n + g.fois, 0), 3);
  /*
     Aucune clef du résultat ne parle d'attendu, de manquant ou de
     recommandé. L'essai le vérifie littéralement : c'est la forme du rendu
     qui tient la promesse, pas la bonne volonté de l'appelant.
  */
  v(
    'et le constat ne porte aucun jugement',
    Object.keys(groupes[0]).sort(),
    ['fois', 'heures', 'nom'],
  );
}

const statut = (p: Partial<StatutHormonal> = {}): StatutHormonal => ({
  id: 'S',
  nature: 'traitement',
  intitule: 'Traitement en cours',
  debut: '2026-09-01T12:00:00.000Z',
  fin: null,
  note: '',
  majLe: '2026-09-01T12:00:00.000Z',
  ...p,
});

v('un statut bien formé ne pose rien', controlerStatut(statut()), []);
v('une fin avant le début est refusée', controlerStatut(statut({ fin: '2026-08-01T12:00:00.000Z' })).length, 1);
{
  const le12 = new Date('2026-10-12T12:00:00.000Z');
  v('un statut ouvert est en cours', statutsEnCours([statut()], le12).length, 1);
  v(
    'un statut terminé ne l’est plus',
    statutsEnCours([statut({ fin: '2026-10-01T12:00:00.000Z' })], le12).length,
    0,
  );
}
{
  /* Et une prise se scelle comme le reste : son nom ne traîne nulle part. */
  const range = await sceller(cle, 'odysseeMedicaments', prise() as unknown as Record<string, unknown>);
  const surDisque = JSON.stringify(range);
  faux('le nom du médicament n’est pas lisible', surDisque.includes('Paracétamol'));
  faux('ni la dose', surDisque.includes('500 mg'));
  faux('ni le motif', surDisque.includes('Mal de tête'));
  vrai('mais le jour l’est, comme annoncé', surDisque.includes('2026-10-12'));
  memeContenu('et rouverte, elle est intacte', await ouvrir(cle, range), prise());
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
