/**
 * L'initialisation : le parcours, les reports, les modules, les déductions.
 *
 * Ce que ces essais protègent n'a pas d'écran qui le dise :
 *
 * - qu'une question **reportée ne soit pas reposée**, y compris sur l'autre
 *   appareil, et qu'elle reparaisse quand on lève le report ;
 * - qu'un module de branche ne soit **posé qu'une fois**, la marque voyageant
 *   avec le journal ;
 * - qu'une **déduction sans effectif n'existe pas** : six faits au moins, et un
 *   niveau non fiable ne devient jamais une matière « solide » ;
 * - que chaque **réponse proposée soit recevable** par la validation du champ —
 *   un bouton qui écrit une valeur refusée est un écran mort, et il ne se
 *   découvre qu'en cliquant ;
 * - que la semaine en cours, **partielle**, ne tire pas le rythme vers le bas.
 */
import {
  BORNES,
  CHOIX,
  DEFAUTS,
  DYNAMIQUES,
  GROUPES,
  MAXIMUM_LIGNES,
  MULTIPLES,
  SUGGESTIONS,
  TYPE_MODULE,
  TYPE_REPORT,
  brancheDuModule,
  champDuReport,
  cibleDuModule,
  cibleDuReport,
  controlerQuestions,
  enEcrans,
  lireModules,
  lireReports,
  parcours,
  porte,
} from '../src/lib/noyau/initialisation';
import {
  CIBLE_INITIALISATION,
  TYPE_CHAMP_PROFIL,
  TYPE_INITIALISATION,
  champsDeBranche,
  champsDuSocle,
  questionsDuSocle,
  cibleDuChamp,
  valider,
} from '../src/lib/noyau/profil';
import {
  NOTE_FRAGILE,
  NOTE_SOLIDE,
  SEANCES_MINIMALES,
  deduire,
  observer,
  plageDeLHeure,
  semaineDe,
} from '../src/lib/noyau/observation';
import { DOMAINES, DOMAINES_ACTIFS_PAR_DEFAUT, libelleDuDomaine } from '../src/lib/noyau/domaines';
import { operation, SANS_LOT, type Operation } from '../src/lib/noyau/operations';
import type { Fait } from '../src/lib/noyau/faits';

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
const op = (
  type: string,
  cible: string,
  charge: unknown,
  ms: number,
  appareil = 'bureau',
): Operation => {
  compteur += 1;
  return operation({
    id: `01INIT${String(compteur).padStart(20, '0')}`,
    appareil,
    hlc: { ms, compteur: 0 },
    type,
    cible,
    lot: SANS_LOT,
    charge,
  });
};

const champ = (nom: string, valeur: unknown, ms: number, appareil = 'bureau') =>
  op(TYPE_CHAMP_PROFIL, cibleDuChamp(nom), { valeur, source: 'declare' }, ms, appareil);
const report = (nom: string, ms: number, appareil = 'bureau') =>
  op(TYPE_REPORT, cibleDuReport(nom), { reporteLe: '2026-10-12T08:00:00.000Z' }, ms, appareil);
const leve = (nom: string, ms: number, appareil = 'bureau') =>
  op(TYPE_REPORT, cibleDuReport(nom), { annule: true }, ms, appareil);
const module = (branche: string, ms: number, appareil = 'bureau') =>
  op(TYPE_MODULE, cibleDuModule(branche), { poseLe: '2026-10-12T08:00:00.000Z' }, ms, appareil);
const initialisee = (ms: number, allegee = false, appareil = 'bureau') =>
  op(
    TYPE_INITIALISATION,
    CIBLE_INITIALISATION,
    { termineeLe: '2026-10-12T08:00:00.000Z', allegee },
    ms,
    appareil,
  );

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes cibles\x1b[0m');

v('la cible d’un report se relit', champDuReport(cibleDuReport('lever')), 'lever');
v('celle d’un module aussi', brancheDuModule(cibleDuModule('revisions')), 'revisions');
v('une cible de champ n’est pas un report', champDuReport(cibleDuChamp('lever')), null);
v('une cible de report n’est pas un module', brancheDuModule(cibleDuReport('lever')), null);
v('un report sans champ est refusé', champDuReport('profil:report:'), null);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1m« Plus tard » : le report tient, et se lève\x1b[0m');

v('aucun report au départ', lireReports([]).size, 0);
v('un report est lu', [...lireReports([report('lever', 1)]).keys()], ['lever']);
v(
  'le report levé n’est plus un report',
  [...lireReports([report('lever', 1), leve('lever', 2)]).keys()],
  [],
);
v(
  'et l’ordre est celui de l’horloge, pas celui du tableau',
  [...lireReports([leve('lever', 2), report('lever', 1)]).keys()],
  [],
);
v(
  'un report postérieur à une levée reporte de nouveau',
  [...lireReports([report('lever', 1), leve('lever', 2), report('lever', 3)]).keys()],
  ['lever'],
);
v(
  'le report d’un autre appareil compte comme le sien',
  [...lireReports([report('coucher', 5, 'telephone')]).keys()],
  ['coucher'],
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLe parcours : ce qui reste à poser\x1b[0m');

const socle = questionsDuSocle();
/* Huit depuis la décision 2 du prompt 56 ; dix-huit avant elle. Le parcours ne
   compte que les champs qu'il pose, et deux filtres les écartent : le mois, la
   majorité déclarée et les usages coupés se demandent au moment du besoin ;
   dix autres ne sont plus demandés parce que rien ne lit leur réponse. Les dix
   sont nommés dans `essais-profil.mts`, et `essais-lu-par.mts` confronte au
   code la déclaration qui les écarte. */
v('le socle fait huit questions', socle.length, 8);

const vierge = parcours([]);
v('tout reste à poser sur une base vierge', vierge.restantes.length, socle.length);
v('et la première question est le prénom', vierge.prochaine?.declare.champ, 'prenom');
v('rien n’est réglé', vierge.reglees, 0);

const unePosee = parcours([champ('prenom', 'Alexis', 1)]);
v('un champ répondu sort des restantes', unePosee.restantes.length, socle.length - 1);
v('et la suivante est posée', unePosee.prochaine?.declare.champ, 'naissanceAnnee');
vrai(
  'la valeur déjà posée est rendue avec l’étape',
  unePosee.etapes[0].deja?.valeur === 'Alexis',
);

/* Le report porte sur la deuxième question du socle. C'était « nom » avant la
   décision 2 du 56 ; ce champ n'étant plus posé, un report sur lui ne reporte
   plus rien — et l'essai, lui, serait passé en ne mesurant plus son objet. */
const unReporte = parcours([champ('prenom', 'Alexis', 1), report('naissanceAnnee', 2)]);
v('une question reportée ne se repose pas', unReporte.prochaine?.declare.champ, 'fuseau');
v('mais elle compte comme réglée', unReporte.reglees, 2);
vrai('et l’étape dit qu’elle est reportée', unReporte.etapes[1].reportee);

const toutReporte = parcours([
  champ('prenom', 'Alexis', 1),
  ...socle.slice(1).map((c, i) => report(c.champ, i + 2)),
]);
v('tout reporté : le parcours est fini', toutReporte.prochaine, null);
v('et rien n’est perdu : les étapes restent toutes là', toutReporte.etapes.length, socle.length);

const repris = parcours([
  champ('prenom', 'Alexis', 1),
  report('naissanceAnnee', 2),
  leve('naissanceAnnee', 3),
]);
v(
  'un report levé remet la question dans la file',
  repris.prochaine?.declare.champ,
  'naissanceAnnee',
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes écrans : une question, même quand elle règle deux champs\x1b[0m');

/*
   LE GROUPE A DISPARU, PAS LE MÉCANISME.

   « Français, et heure de Paris : c'est bien ça ? » réglait la langue et le
   fuseau sur un écran. La décision 2 du 56 ne demande plus la langue — rien ne
   la lit —, et la question ne règle plus que le fuseau : huit questions font
   donc huit écrans, et la phrase a changé pour ne plus annoncer un réglage
   qu'elle ne fait pas.

   Le regroupement, lui, reste éprouvé juste en dessous, sur deux étapes qui
   partagent leur question. Le supprimer parce que plus aucun champ ne le
   déclenche aurait laissé sans garde le jour où un groupe revient.
*/
const ecrans = enEcrans(vierge.restantes);
v('huit questions font huit écrans', ecrans.length, socle.length);
const ecranFuseau = ecrans.find((e) => e.etapes.some((x) => x.declare.champ === 'fuseau'));
v('le fuseau est seul sur son écran', ecranFuseau?.etapes.length, 1);
v(
  'et sa question ne parle plus que des journées',
  ecranFuseau?.question,
  'Vos journées sont comptées à l’heure de Paris : c’est bien ça ?',
);
{
  /* Deux étapes, une seule question : l'écran les réunit. */
  const paire = enEcrans([
    { declare: { ...socle[0], champ: 'a', question: 'Une seule phrase ?' }, reportee: false },
    { declare: { ...socle[0], champ: 'b', question: 'Une seule phrase ?' }, reportee: false },
    { declare: { ...socle[0], champ: 'c', question: 'Une autre ?' }, reportee: false },
  ]);
  v('deux champs qui partagent leur question tiennent un seul écran', paire.length, 2);
  v('et c’est bien la paire qui est réunie', paire[0].etapes.length, 2);
}
vrai(
  'aucun écran ne répète sa question',
  new Set(ecrans.map((e) => e.question)).size === ecrans.length,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes modules de branche\x1b[0m');

v('les modules de Révisions font six questions', champsDeBranche('revisions').length, 6);
v('ceux de Sport aussi', champsDeBranche('sport').length, 5);
v('aucun module posé au départ', lireModules([]).size, 0);
v('un module posé est lu', [...lireModules([module('revisions', 1)]).keys()], ['revisions']);
v(
  'le module posé sur un appareil l’est pour les deux',
  lireModules([module('revisions', 1, 'telephone')]).get('revisions')?.appareil,
  'telephone',
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLa porte : qui doit poser quoi\x1b[0m');

v('base vierge : initialiser', porte([]).quoi, 'initialiser');
v('et ce n’est pas une initialisation allégée', porte([]), { quoi: 'initialiser', allegee: false });
v(
  'avec de l’usage, elle l’est',
  porte([], { existante: true }),
  { quoi: 'initialiser', allegee: true },
);
v(
  'initialisation faite, sans branche : entrer',
  porte([initialisee(1)]).quoi,
  'entrer',
);
v(
  'initialisation faite, branche neuve : son module',
  porte([initialisee(1)], { branche: 'revisions' }),
  { quoi: 'module', branche: 'revisions' },
);
v(
  'module posé : entrer',
  porte([initialisee(1), module('revisions', 2)], { branche: 'revisions' }).quoi,
  'entrer',
);
v(
  'module non posé mais tout répondu : entrer quand même',
  porte(
    [initialisee(1), ...champsDeBranche('revisions').map((c, i) => report(c.champ, i + 2))],
    { branche: 'revisions' },
  ).quoi,
  'entrer',
);
v(
  'le socle passe avant le module',
  porte([], { branche: 'revisions' }).quoi,
  'initialiser',
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes réponses proposées sont recevables\x1b[0m');

v('le catalogue des questions ne porte aucun problème', controlerQuestions(), []);
for (const [nom, options] of Object.entries(CHOIX)) {
  const multiple = MULTIPLES.includes(nom);
  const verdict = multiple
    ? valider(nom, options.map((o) => String(o.valeur)))
    : options.map((o) => valider(nom, o.valeur)).find((x) => !x.recevable) ?? { recevable: true };
  vrai(`« ${nom} » : ${options.length} réponses, toutes recevables`, verdict.recevable);
}
for (const [nom, defaut] of Object.entries(DEFAUTS)) {
  vrai(`le défaut de « ${nom} » est recevable`, valider(nom, defaut).recevable);
}
vrai(
  'les bornes sont croissantes',
  Object.values(BORNES).every((b) => b.min < b.max && b.pas > 0),
);
vrai(
  'les suggestions sont des textes non vides',
  Object.values(SUGGESTIONS)
    .flat()
    .every((s) => typeof s === 'string' && s.length > 2),
);
vrai(
  'chaque champ à lignes en accepte au moins deux',
  Object.values(MAXIMUM_LIGNES).every((n) => n >= 2),
);
vrai(
  'les groupes ne nomment que des champs déclarés',
  GROUPES.flat().every((c) => socle.some((s) => s.champ === c)),
);
/* Et la liste est vide depuis que la langue n'est plus demandée : l'affirmer
   évite qu'elle le soit par accident, sans que personne l'ait voulu. */
v('plus aucun groupe à poser', GROUPES.length, 0);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes domaines\x1b[0m');

v('huit domaines sont déclarés', DOMAINES.length, 8);
v('cinq sont allumés au départ', DOMAINES_ACTIFS_PAR_DEFAUT.length, 5);
v(
  'et ce sont ceux de la décision 1',
  [...DOMAINES_ACTIFS_PAR_DEFAUT],
  ['corps', 'cognition', 'connaissances', 'psyche', 'finances'],
);
v('un domaine inconnu rend son identifiant', libelleDuDomaine('martien'), 'martien');
v('un domaine connu rend son libellé', libelleDuDomaine('psyche'), 'Psyché');
vrai(
  'aucun identifiant de domaine ne porte d’accent',
  DOMAINES.every((d) => /^[a-z]+$/.test(d.id)),
);
vrai(
  'la liste des domaines est recevable comme valeur du champ',
  valider('domainesActifs', DOMAINES.map((d) => d.id)).recevable,
);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes semaines et les plages\x1b[0m');

v('le lundi est son propre lundi', semaineDe('2026-10-12'), '2026-10-12');
v('le dimanche appartient à la semaine qui précède', semaineDe('2026-10-18'), '2026-10-12');
v('un changement de mois ne casse rien', semaineDe('2026-11-01'), '2026-10-26');
v('ni un changement d’année', semaineDe('2027-01-01'), '2026-12-28');
v('7 h est le matin', plageDeLHeure(7), 'matin');
v('midi est l’après-midi', plageDeLHeure(12), 'apres-midi');
v('20 h est le soir', plageDeLHeure(20), 'soir');
v('1 h du matin est la nuit', plageDeLHeure(1), 'nuit');
v('4 h aussi, et c’est l’heure de bascule', plageDeLHeure(4), 'nuit');

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mL’observation\x1b[0m');

let idFait = 0;
const fait = (jour: string, heureDebut: number, minutes: number, domaine = 'connaissances'): Fait => {
  idFait += 1;
  const debut = `${jour}T${String(heureDebut).padStart(2, '0')}:00:00.000Z`;
  return {
    id: `fait-${idFait}`,
    branche: 'revisions',
    domaine,
    type: 'revision.seance',
    debut,
    fin: new Date(Date.parse(debut) + minutes * 60_000).toISOString(),
    jourLogique: jour,
    valeur: minutes * 60,
    unite: 'secondes',
    source: 'automatique',
    fiabilite: 'confirme',
    proprietaire: 'revisions',
    version: 1,
    modifieLe: debut,
  };
};

/*
   Les fixtures sont lues en **temps universel**, et c'est délibéré : une heure
   écrite 9 h dans l'essai doit valoir 9 h dans le constat, sinon l'essai mesure
   l'heure d'été plutôt que la règle. Le fuseau réel a son propre essai, plus
   bas — et c'est lui qui a trouvé que ces mêmes fixtures tombaient l'après-midi
   à Paris.
*/
const UTC = { jour: '2026-10-12', fuseau: 'UTC' } as const;

const vide = observer([]);
v('aucun fait : aucun jour', vide.jours.length, 0);
v('aucun fait : aucune médiane', vide.heuresMedianes, null);
v('aucun fait : aucune plage dominante', vide.plageDominante, null);

/*
   Trois séances ne disent rien d'un rythme : le seuil d'effectif est la
   première règle d'honnêteté du module, et c'est celle qui coûte le plus cher
   quand elle manque.
*/
const maigre = observer([fait('2026-09-07', 9, 60), fait('2026-09-08', 9, 60)], UTC);
v('deux séances : pas de médiane', maigre.heuresMedianes, null);
v('mais les jours sont connus', maigre.jours.length, 2);

/* Quatre semaines pleines à deux heures, et la semaine en cours à zéro. */
const regulier: Fait[] = [];
for (const lundi of ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']) {
  regulier.push(fait(lundi, 9, 60));
  regulier.push(fait(lundi, 14, 60));
}
const obsRegulier = observer(regulier, UTC);
v('huit séances suffisent', obsRegulier.faits, 8);
v('deux heures par semaine en médiane', obsRegulier.heuresMedianes, 2);
v('quatre semaines observées', obsRegulier.semaines.length, 4);
v('aucune plage ne domine à parts égales', obsRegulier.plageDominante, null);
v('matin et après-midi à parts égales', [obsRegulier.parPlage.matin, obsRegulier.parPlage['apres-midi']], [4, 4]);

/*
   La semaine en cours est partielle, et c'est **la** chose à ne pas compter : un
   lundi matin, elle vaut presque zéro et tirerait le rythme avec elle. Une
   semaine pleine à six heures, plus une demi-heure cette semaine : la médiane
   doit rester six, et non trois et quart.
*/
const avecPartielle = observer(
  // Du lundi 5 au samedi 10 octobre : une seule semaine, pleine, à six heures.
  [...Array.from({ length: 6 }, (_, i) => fait(`2026-10-${String(i + 5).padStart(2, '0')}`, 9, 60)), fait('2026-10-12', 9, 30)],
  UTC,
);
v('la semaine en cours est vue', avecPartielle.semaines.includes('2026-10-12'), true);
v('mais elle ne pèse pas sur la médiane', avecPartielle.heuresMedianes, 6);
v('ses secondes sont bien comptées par ailleurs', avecPartielle.secondesParSemaine['2026-10-12'], 1800);

const matinal = observer(
  ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-06'].map((j) =>
    fait(j, 7, 45),
  ),
  UTC,
);
v('le matin domine', matinal.plageDominante, 'matin');
v('la première heure observée est celle du début', matinal.heurePremiere, 7);
v('et la dernière, celle de la fin', matinal.heureDerniere, 7);

/*
   Le même jeu de faits, lu à Paris : l'heure d'été décale de deux heures, et
   7 h 45 universel devient 9 h 45 — toujours le matin. En revanche, les séances
   de 14 h de `regulier` finissent à 17 h à Paris, et la plage dominante change.
   C'est la règle, pas un défaut : les plages sont murales.
*/
const aParis = observer(regulier, { jour: '2026-10-12' });
v('le même jeu, lu à Paris, bascule l’après-midi', aParis.plageDominante, 'apres-midi');
v('et sa première heure est décalée de deux', aParis.heurePremiere, 11);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes déductions de l’initialisation allégée\x1b[0m');

v('sans rien, aucune déduction', deduire({ observation: vide }), []);

const deduites = deduire({
  observation: obsRegulier,
  parcoursActifs: [{ id: 'insp', libelle: 'INSP' }],
  niveaux: [
    { matiere: 'Droit public', libelle: 'Droit public', note: 1300, fiable: true },
    { matiere: 'Économie', libelle: 'Économie', note: 1100, fiable: true },
    { matiere: 'Questions sociales', libelle: 'Questions sociales', note: 900, fiable: false },
  ],
  domainesParDefaut: DOMAINES_ACTIFS_PAR_DEFAUT,
});
const parChamp = new Map(deduites.map((d) => [d.champ, d]));
v('le parcours ouvert est proposé', parChamp.get('concours')?.valeur, ['insp']);
v('les heures de révision sont proposées', parChamp.get('heuresRevision')?.valeur, 2);
v('le temps disponible est un plancher, arrondi au-dessus', parChamp.get('tempsParSemaine')?.valeur, 2);
v('une matière au-dessus du seuil est solide', parChamp.get('matieresFortes')?.valeur, ['Droit public']);
v('une matière sous le seuil est fragile', parChamp.get('matieresFaibles')?.valeur, ['Économie']);
faux(
  'un niveau non fiable n’est jamais déduit',
  JSON.stringify(deduites).includes('Questions sociales'),
);
faux(
  'les domaines ne sont pas proposés quand l’usage ne dit rien de neuf',
  parChamp.has('domainesActifs'),
);
vrai(
  'chaque déduction porte un constat en français',
  deduites.every((d) => d.constat.length > 15 && d.constat.endsWith('.')),
);
vrai(
  'et chaque valeur déduite est recevable par son champ',
  deduites.every((d) => valider(d.champ, d.valeur).recevable),
);
vrai(
  'une valeur déduite d’un champ à choix est l’un de ses choix',
  deduites.every((d) => !CHOIX[d.champ] || CHOIX[d.champ].some((o) => o.valeur === d.valeur)),
);

const avecMoment = deduire({ observation: matinal });
v('la plage dominante devient le moment préféré', new Map(avecMoment.map((d) => [d.champ, d.valeur])).get('momentRevision'), 'matin');

const horsDefaut = deduire({
  observation: observer(
    [
      fait('2026-10-05', 9, 60),
      ...Array.from({ length: 5 }, (_, i) => fait(`2026-10-0${i + 1}`, 9, 30, 'oeuvre')),
    ],
    UTC,
  ),
  domainesParDefaut: DOMAINES_ACTIFS_PAR_DEFAUT,
});
vrai(
  'un domaine hors défaut, lui, est proposé',
  horsDefaut.some((d) => d.champ === 'domainesActifs' && (d.valeur as string[]).includes('oeuvre')),
);

v('le seuil d’effectif est déclaré, pas deviné', SEANCES_MINIMALES, 6);
vrai('et les deux seuils de niveau encadrent la note initiale', NOTE_FRAGILE < 1200 && NOTE_SOLIDE > 1200);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes champs dynamiques sont tous connus\x1b[0m');
for (const nom of DYNAMIQUES) {
  vrai(
    `« ${nom} » est un champ déclaré`,
    /* Tous les champs du socle, et non les seules questions : un champ dynamique
       peut très bien se demander au moment du besoin — « usagesCoupes » se règle
       depuis son propre écran. Ce que cette assertion vérifie est qu'il est
       **déclaré**, pas qu'il est posé par le parcours. */
    champsDuSocle()
      .concat(champsDeBranche('revisions'), champsDeBranche('sport'), champsDeBranche('odyssee'))
      .some((c) => c.champ === nom),
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
