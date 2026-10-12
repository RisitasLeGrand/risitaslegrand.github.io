/**
 * L'adaptation et les réglages déduits.
 *
 * Ce que ces essais protègent, et qu'aucun écran ne dirait :
 *
 * - **au plus une proposition par semaine**, le plafond se mesurant sur toutes
 *   les décisions et non sur celles d'une règle : avoir refusé lundi ne doit pas
 *   faire apparaître autre chose mardi ;
 * - **un refus ne revient jamais** — pas « pas avant trois mois » : jamais ;
 * - **une remise retrouve la valeur déclarée** au lieu de la deviner, en la
 *   relisant dans le journal version par version ;
 * - **un domaine muet n'est proposé à l'extinction que s'il est seul à l'être** :
 *   tous muets veut dire que l'application n'est pas utilisée, pas que les
 *   domaines sont mal choisis ;
 * - **un réglage déduit porte toujours sa cause**, et ne se dit déduit que s'il
 *   l'est vraiment.
 */
import {
  DELAI_DE_REPORT_JOURS,
  DELAI_ENTRE_PROPOSITIONS_JOURS,
  JOURS_AVANT_DELAISSEMENT,
  REGLES_ADAPTATION,
  TYPE_DECISION,
  cibleDeLaRegle,
  controlerRegles,
  historiqueDesDecisions,
  lireDecisions,
  proposer,
  regleAdaptation,
  regleDeCible,
  reinitialisation,
  type Decision,
  type Entrees,
} from '../src/lib/noyau/adaptation';
import {
  BASCULE_MAXIMALE,
  BASCULE_MINIMALE,
  basculeDuJour,
  controlerReglages,
  reglagesDeduits,
  reglagesJourLogique,
} from '../src/lib/noyau/reglages';
import { CHAMPS, TYPE_CHAMP_PROFIL, cibleDuChamp, valider } from '../src/lib/noyau/profil';
import { observer } from '../src/lib/noyau/observation';
import { DOMAINES_ACTIFS_PAR_DEFAUT } from '../src/lib/noyau/domaines';
import { HEURE_BASCULE_PAR_DEFAUT } from '../src/lib/noyau/jour-logique';
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
const op = (type: string, cible: string, charge: unknown, ms: number, appareil = 'bureau') => {
  compteur += 1;
  return operation({
    id: `01ADAPT${String(compteur).padStart(19, '0')}`,
    appareil,
    hlc: { ms, compteur: 0 },
    type,
    cible,
    lot: SANS_LOT,
    charge,
  });
};

const champ = (nom: string, valeur: unknown, ms: number, source = 'declare', appareil = 'bureau') =>
  op(TYPE_CHAMP_PROFIL, cibleDuChamp(nom), { valeur, source }, ms, appareil);
/*
   La décision porte ce qui avait été proposé, comme `accepter()` l'écrit : sans
   cela, la remise ne saurait pas distinguer l'écriture de l'adaptation de la
   déclaration qui la précède.
*/
const decision = (regle: string, issue: string, le: string, ms: number, valeurProposee?: unknown) =>
  op(
    TYPE_DECISION,
    cibleDeLaRegle(regle),
    valeurProposee === undefined ? { issue, le } : { issue, le, valeurProposee },
    ms,
  );

/** Une lecture de profil, au plus simple. */
const lectureDe = (valeurs: Record<string, unknown>) => (nom: string) => valeurs[nom];

/* ── Les faits : des séances d'une heure, à heure fixe, en temps universel ── */
let idFait = 0;
const fait = (jour: string, heure: number, minutes: number, domaine = 'connaissances'): Fait => {
  idFait += 1;
  const debut = `${jour}T${String(heure).padStart(2, '0')}:00:00.000Z`;
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

const JOUR = '2026-10-12';
const UTC = { jour: JOUR, fuseau: 'UTC' } as const;

/** Six heures par semaine, le matin, sur quatre semaines pleines. */
const usage = (heure = 9, domaine = 'connaissances'): Fait[] => {
  const faits: Fait[] = [];
  for (const lundi of ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']) {
    for (let i = 0; i < 6; i += 1) {
      const jour = new Date(Date.parse(`${lundi}T00:00:00Z`) + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      faits.push(fait(jour, heure, 60, domaine));
    }
  }
  return faits;
};

const observation = observer(usage(), UTC);
const entrees = (valeurs: Record<string, unknown>, obs = observation): Entrees => ({
  observation: obs,
  lire: lectureDe(valeurs),
  jour: JOUR,
});

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLe catalogue des règles\x1b[0m');

v('le catalogue ne porte aucun problème', controlerRegles(), []);
v('cinq règles sont déclarées', REGLES_ADAPTATION.length, 5);
vrai(
  'chacune porte sur un champ déclaré',
  REGLES_ADAPTATION.every((r) => CHAMPS.some((c) => c.champ === r.champ)),
);
v('la cible d’une règle se relit', regleDeCible(cibleDeLaRegle('rythme-declare')), 'rythme-declare');
v('et une cible de champ n’en est pas une', regleDeCible(cibleDuChamp('lever')), null);
v('une règle inconnue n’existe pas', regleAdaptation('inventee'), undefined);
v('les délais sont déclarés', [DELAI_ENTRE_PROPOSITIONS_JOURS, DELAI_DE_REPORT_JOURS], [7, 14]);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes écarts se détectent, et seulement quand ils comptent\x1b[0m');

v('six heures observées par semaine', observation.heuresMedianes, 6);

{
  const { proposition } = proposer({ ...entrees({}), decisions: new Map() });
  v('sans profil, rien à proposer', proposition, null);
}
{
  const { proposition } = proposer({
    ...entrees({ heuresRevision: 6 }),
    decisions: new Map(),
  });
  v('un déclaré conforme à l’observé ne propose rien', proposition, null);
}
{
  const { proposition } = proposer({
    ...entrees({ heuresRevision: 5 }),
    decisions: new Map(),
  });
  v('un écart d’une heure sur cinq ne propose rien non plus', proposition, null);
}
{
  const { proposition } = proposer({
    ...entrees({ heuresRevision: 2 }),
    decisions: new Map(),
  });
  v('un écart de deux à six heures, si', proposition?.regle, 'rythme-declare');
  v('et il propose la valeur observée', proposition?.valeurProposee, 6);
  vrai('en disant ce qui a été vu', (proposition?.constat ?? '').includes('médiane observée'));
  vrai('et en posant une question', (proposition?.question ?? '').endsWith('?'));
}
{
  /* 30 h déclarées contre 28 observées : l'écart absolu est là, le relatif non. */
  const beaucoup = observer(
    usage().concat(
      ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'].flatMap((lundi) =>
        Array.from({ length: 22 }, (_, i) =>
          fait(
            new Date(Date.parse(`${lundi}T00:00:00Z`) + (i % 6) * 86_400_000)
              .toISOString()
              .slice(0, 10),
            11 + (i % 6),
            60,
          ),
        ),
      ),
    ),
    UTC,
  );
  const { ecarts } = proposer({
    ...entrees({ heuresRevision: 30 }, beaucoup),
    decisions: new Map(),
  });
  faux(
    'un écart gros en heures mais petit en proportion ne propose rien',
    ecarts.some((e) => e.regle === 'rythme-declare'),
  );
}
{
  const { ecarts } = proposer({
    ...entrees({ tempsParSemaine: 3 }),
    decisions: new Map(),
  });
  const temps = ecarts.find((e) => e.regle === 'temps-disponible');
  v('un plancher dépassé se voit', temps?.valeurProposee, 6);
  vrai('et la question dit qu’on l’a déjà fait', (temps?.question ?? '').includes('déjà'));
}
{
  const { ecarts } = proposer({
    ...entrees({ tempsParSemaine: 20 }),
    decisions: new Map(),
  });
  faux(
    'un plancher non atteint n’est pas un écart',
    ecarts.some((e) => e.regle === 'temps-disponible'),
  );
}
{
  const { ecarts } = proposer({
    ...entrees({ momentRevision: 'soir' }),
    decisions: new Map(),
  });
  const moment = ecarts.find((e) => e.regle === 'moment-prefere');
  v('un moment déclaré que l’usage contredit se voit', moment?.valeurProposee, 'matin');
  vrai('et la question rappelle la réponse donnée', (moment?.question ?? '').includes('soir'));
}
{
  const { ecarts } = proposer({
    ...entrees({ momentRevision: 'matin' }),
    decisions: new Map(),
  });
  faux(
    'un moment conforme ne propose rien',
    ecarts.some((e) => e.regle === 'moment-prefere'),
  );
}
{
  /* Activité jusqu'à 23 h, coucher déclaré à 22 h. */
  const tardif = observer(usage(22), UTC);
  const { ecarts } = proposer({ ...entrees({ coucher: '22:00' }, tardif), decisions: new Map() });
  const couche = ecarts.find((e) => e.regle === 'coucher-depasse');
  v('l’activité qui dépasse le coucher déclaré se voit', couche?.valeurProposee, '23:30');
}
{
  const tardif = observer(usage(22), UTC);
  const { ecarts } = proposer({ ...entrees({ coucher: '01:00' }, tardif), decisions: new Map() });
  faux(
    'un coucher après minuit est postérieur à 23 h, pas antérieur',
    ecarts.some((e) => e.regle === 'coucher-depasse'),
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mUn domaine délaissé, et la limite de la règle\x1b[0m');

{
  const { ecarts } = proposer({
    ...entrees({ domainesActifs: ['connaissances', 'psyche', 'corps'] }),
    decisions: new Map(),
  });
  const delaisse = ecarts.find((e) => e.regle === 'domaine-delaisse');
  v('deux domaines muets sur trois se voient', delaisse?.valeurProposee, ['connaissances']);
  vrai('et le constat les nomme', (delaisse?.constat ?? '').includes('psyche'));
  vrai(
    'la question dit que les données restent',
    (delaisse?.question ?? '').includes('données y restent'),
  );
}
{
  const { ecarts } = proposer({
    ...entrees({ domainesActifs: ['psyche', 'corps'] }),
    decisions: new Map(),
  });
  faux(
    'tous muets : ce n’est pas un mauvais choix de domaines, c’est une absence d’usage',
    ecarts.some((e) => e.regle === 'domaine-delaisse'),
  );
}
{
  const { ecarts } = proposer({
    ...entrees({ domainesActifs: ['connaissances'] }),
    decisions: new Map(),
  });
  faux(
    'un seul domaine actif : rien à retirer',
    ecarts.some((e) => e.regle === 'domaine-delaisse'),
  );
}
{
  /* Activité d'hier dans psyche : le domaine n'est pas délaissé. */
  const recent = observer(usage().concat(fait('2026-10-11', 9, 30, 'psyche')), UTC);
  const { ecarts } = proposer({
    ...entrees({ domainesActifs: ['connaissances', 'psyche'] }, recent),
    decisions: new Map(),
  });
  faux(
    'un domaine servi hier n’est pas délaissé',
    ecarts.some((e) => e.regle === 'domaine-delaisse'),
  );
}
v('le seuil de délaissement est déclaré', JOURS_AVANT_DELAISSEMENT, 30);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mAu plus une par semaine, et le refus est définitif\x1b[0m');

const profilEnEcart = { heuresRevision: 2, momentRevision: 'soir', tempsParSemaine: 3 };

{
  const { proposition, ecarts } = proposer({
    ...entrees(profilEnEcart),
    decisions: new Map(),
  });
  v('trois écarts sont détectés', ecarts.length, 3);
  v('une seule proposition est faite', proposition?.regle, 'rythme-declare');
  v('et c’est la plus prioritaire', REGLES_ADAPTATION[0].id, 'rythme-declare');
}
{
  /* Un seul écart, et il est refusé : plus jamais, quel que soit le temps passé. */
  const decisions = lireDecisions([decision('rythme-declare', 'refusee', '2020-01-01', 1)]);
  const { proposition, silence } = proposer({
    ...entrees({ heuresRevision: 2 }),
    decisions,
  });
  v('une règle refusée ne revient jamais, même six ans après', proposition, null);
  v('et le silence dit que tout est refusé', silence?.pourquoi, 'tout-refuse');
}
{
  /* Le refus ne tue que sa règle, pas les autres — et il compte dans le plafond. */
  const decisions = lireDecisions([decision('rythme-declare', 'refusee', '2026-10-10', 1)]);
  const { proposition, silence } = proposer({ ...entrees(profilEnEcart), decisions });
  v('un refus d’avant-hier suspend aussi les autres règles', proposition, null);
  v('parce que le plafond porte sur l’attention demandée', silence?.pourquoi, 'trop-tot');
}
{
  const decisions = lireDecisions([decision('rythme-declare', 'refusee', '2026-08-01', 1)]);
  const { proposition, silence } = proposer({ ...entrees(profilEnEcart), decisions });
  v(
    'le refus passé le délai hebdomadaire laisse passer une autre règle',
    proposition?.regle,
    'temps-disponible',
  );
  v('et il n’y a plus de silence', silence, null);
}
{
  /* Une décision récente, quelle qu'elle soit, suspend toute proposition. */
  const decisions = lireDecisions([decision('moment-prefere', 'acceptee', '2026-10-08', 1)]);
  const { proposition, silence } = proposer({ ...entrees(profilEnEcart), decisions });
  v('une décision d’il y a quatre jours suspend tout', proposition, null);
  v('et le silence compte les jours restants', silence, { pourquoi: 'trop-tot', joursRestants: 3 });
}
{
  const decisions = lireDecisions([decision('moment-prefere', 'acceptee', '2026-10-05', 1)]);
  const { proposition } = proposer({ ...entrees(profilEnEcart), decisions });
  v('sept jours après, la parole revient', proposition?.regle, 'rythme-declare');
}
{
  const decisions = lireDecisions([decision('rythme-declare', 'reportee', '2026-10-05', 1)]);
  const { proposition } = proposer({ ...entrees(profilEnEcart), decisions });
  v('une règle reportée il y a sept jours attend encore', proposition?.regle, 'temps-disponible');
}
{
  const decisions = lireDecisions([decision('rythme-declare', 'reportee', '2026-09-20', 1)]);
  const { proposition } = proposer({ ...entrees(profilEnEcart), decisions });
  v('passé deux semaines, elle revient', proposition?.regle, 'rythme-declare');
}
{
  const decisions = lireDecisions([
    decision('rythme-declare', 'refusee', '2026-08-01', 1),
    decision('temps-disponible', 'refusee', '2026-08-02', 2),
    decision('moment-prefere', 'refusee', '2026-08-03', 3),
  ]);
  const { proposition, silence } = proposer({ ...entrees(profilEnEcart), decisions });
  v('tout refusé : plus rien', proposition, null);
  v('et le silence le dit', silence?.pourquoi, 'tout-refuse');
}
{
  const { silence } = proposer({ ...entrees({ heuresRevision: 6 }), decisions: new Map() });
  v('aucun écart : le silence a sa raison propre', silence?.pourquoi, 'aucun-ecart');
}
{
  /*
     Reporté n'est pas refusé. Dire « vous avez refusé » à quelqu'un qui a
     répondu « plus tard » est une petite trahison, et elle se remarque.
  */
  const decisions = lireDecisions([decision('rythme-declare', 'reportee', '2026-10-05', 1)]);
  const { silence } = proposer({ ...entrees({ heuresRevision: 2 }), decisions });
  v('un report seul donne son propre silence', silence, { pourquoi: 'ajourne', joursRestants: 7 });
}
{
  const decisions = lireDecisions([
    decision('rythme-declare', 'reportee', '2026-10-01', 1),
    decision('temps-disponible', 'refusee', '2026-10-02', 2),
  ]);
  const { silence } = proposer({
    ...entrees({ heuresRevision: 2, tempsParSemaine: 3 }),
    decisions,
  });
  v(
    'un report et un refus : c’est le report qui parle, avec son délai',
    silence,
    { pourquoi: 'ajourne', joursRestants: 3 },
  );
}
{
  const ops = [
    decision('rythme-declare', 'reportee', '2026-10-01', 1),
    decision('rythme-declare', 'refusee', '2026-10-02', 2),
  ];
  v('la dernière décision par règle est celle qui vaut', lireDecisions(ops).get('rythme-declare')?.issue, 'refusee');
  v('et l’historique les garde toutes, dans l’ordre', historiqueDesDecisions(ops).map((d) => d.issue), ['reportee', 'refusee']);
}
{
  const ops = [decision('rythme-declare', 'douteuse', '2026-10-01', 1)];
  v('une issue inconnue est ignorée', lireDecisions(ops).size, 0);
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mRéinitialiser : retrouver la valeur déclarée, pas la deviner\x1b[0m');

v('sans décision, rien à défaire', reinitialisation([]), []);
{
  const ops: Operation[] = [
    champ('heuresRevision', 2, 1),
    champ('heuresRevision', 6, 2, 'confirme'),
    decision('rythme-declare', 'acceptee', '2026-10-05', 3, 6),
  ];
  const retours = reinitialisation(ops);
  v('un champ adapté revient à sa valeur déclarée', retours, [
    { champ: 'heuresRevision', valeur: 2, source: 'declare', supprimer: false, regle: 'rythme-declare' },
  ]);
}
{
  /* Deux acceptations de suite sur le même champ : une seule remontée, la bonne. */
  const ops: Operation[] = [
    champ('heuresRevision', 2, 1),
    champ('heuresRevision', 5, 2, 'confirme'),
    decision('rythme-declare', 'acceptee', '2026-09-01', 3, 5),
    champ('heuresRevision', 6, 4, 'confirme'),
    decision('rythme-declare', 'acceptee', '2026-10-05', 5, 6),
  ];
  /*
     Deux acceptations de suite sur le même champ : la remise remonte avant la
     **première** encore en vigueur, et non d'un cran. Remonter d'un cran
     laisserait la personne avec une valeur qu'elle n'a jamais déclarée.
  */
  v('deux adaptations se défont d’un coup', reinitialisation(ops), [
    { champ: 'heuresRevision', valeur: 2, source: 'declare', supprimer: false, regle: 'rythme-declare' },
  ]);
}
{
  const ops: Operation[] = [
    champ('momentRevision', 'matin', 1, 'confirme'),
    decision('moment-prefere', 'acceptee', '2026-10-05', 2, 'matin'),
  ];
  v('un champ qui n’existait pas avant est supprimé, pas inventé', reinitialisation(ops), [
    { champ: 'momentRevision', supprimer: true, regle: 'moment-prefere' },
  ]);
}
{
  const ops: Operation[] = [
    champ('heuresRevision', 2, 1),
    champ('heuresRevision', 6, 2, 'confirme'),
    decision('rythme-declare', 'acceptee', '2026-10-05', 3, 6),
    champ('heuresRevision', 2, 4),
    decision('rythme-declare', 'remise', '2026-10-06', 5),
  ];
  v('une remise déjà faite ne se refait pas', reinitialisation(ops), []);
}
{
  const ops: Operation[] = [
    champ('heuresRevision', 2, 1),
    champ('heuresRevision', 6, 2, 'confirme'),
    decision('rythme-declare', 'acceptee', '2026-10-01', 3, 6),
    champ('heuresRevision', 2, 4),
    decision('rythme-declare', 'remise', '2026-10-02', 5),
    champ('heuresRevision', 7, 6, 'confirme'),
    decision('rythme-declare', 'acceptee', '2026-10-05', 7, 7),
  ];
  v(
    'mais une adaptation postérieure à la remise se défait',
    reinitialisation(ops).map((r) => r.valeur),
    [2],
  );
}
{
  const ops: Operation[] = [
    champ('heuresRevision', 2, 1),
    champ('heuresRevision', 6, 2, 'confirme'),
    decision('rythme-declare', 'refusee', '2026-10-05', 3, 6),
  ];
  v('un refus n’est pas une adaptation : rien à défaire', reinitialisation(ops), []);
}
{
  const ops: Operation[] = [decision('regle-inventee', 'acceptee', '2026-10-05', 1)];
  v('une règle inconnue ne défait rien', reinitialisation(ops), []);
}

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('\n\x1b[1mLes réglages déduits, et leur cause\x1b[0m');

v(
  'le catalogue des réglages ne porte aucun problème',
  controlerReglages(CHAMPS.map((c) => c.champ)),
  [],
);
{
  const vides = reglagesDeduits(() => undefined);
  v('huit réglages existent toujours', vides.length, 8);
  faux('aucun ne se dit déduit sur un profil vide', vides.some((r) => r.deduit));
  vrai('et tous expliquent d’où ils viennent', vides.every((r) => r.cause.length > 20));
  vrai(
    'chacun nomme les champs dont il découlerait',
    vides.every((r) => r.depuis.length > 0),
  );
}
{
  const lu = reglagesDeduits(
    lectureDe({
      lever: '07:00',
      fuseau: 'Indian/Reunion',
      joursTravail: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
      domainesActifs: ['connaissances', 'cognition'],
      heuresRevision: 8,
      styleAccompagnement: 'discret',
    }),
  );
  const par = new Map(lu.map((r) => [r.id, r]));
  v('la bascule du jour est une heure avant le lever', par.get('bascule-du-jour')?.valeur, 6);
  vrai(
    'et elle dit pourquoi, et ce qu’elle ne change pas',
    (par.get('bascule-du-jour')?.cause ?? '').includes('ne changerait pas votre heure de lever'),
  );
  v('les jours de repos sont ceux où l’on ne travaille pas', par.get('jours-de-repos')?.valeur, [
    'dimanche',
    'samedi',
  ]);
  v('le fuseau suit la réponse', par.get('fuseau')?.valeur, 'Indian/Reunion');
  v('les domaines affichés sont ceux qu’on suit', par.get('domaines-affiches')?.valeur, [
    'connaissances',
    'cognition',
  ]);
  v('le style discret ne pose aucun avis spontané', par.get('avis-locaux')?.valeur, {
    parJour: 0,
    heure: null,
  });
  v('l’objectif suit les heures de révision', par.get('objectif-hebdomadaire')?.valeur, {
    heuresParSemaine: 8,
    plafondSeanceMinutes: 120,
  });
  vrai('tous se disent déduits sauf les parcours et les créneaux', par.get('bascule-du-jour')!.deduit);
}
{
  const lu = reglagesDeduits(lectureDe({ tempsParSemaine: 4 }));
  const par = new Map(lu.map((r) => [r.id, r]));
  v('à défaut d’heures de révision, le temps disponible fait l’objectif', par.get('objectif-hebdomadaire')?.valeur, {
    heuresParSemaine: 4,
    plafondSeanceMinutes: 60,
  });
  vrai(
    'et la cause dit laquelle des deux réponses a servi',
    (par.get('objectif-hebdomadaire')?.cause ?? '').includes('temps que vous pouvez'),
  );
}

console.log('\n\x1b[1mLa bascule du jour reste dans ses bornes\x1b[0m');
v('sans lever, c’est le défaut du site', basculeDuJour(undefined), HEURE_BASCULE_PAR_DEFAUT);
v('un lever à 7 h donne 6 h', basculeDuJour('07:00'), 6);
v('un lever à 11 h est borné en haut', basculeDuJour('11:00'), BASCULE_MAXIMALE);
v('un lever à 3 h est borné en bas', basculeDuJour('03:00'), BASCULE_MINIMALE);
v('un lever à minuit aussi', basculeDuJour('00:00'), BASCULE_MINIMALE);
v('une heure mal formée ne casse rien', basculeDuJour('le matin'), HEURE_BASCULE_PAR_DEFAUT);
v('ni une valeur qui n’est pas un texte', basculeDuJour(7), HEURE_BASCULE_PAR_DEFAUT);
vrai(
  'les bornes évitent la fenêtre du changement d’heure',
  BASCULE_MINIMALE >= 2 && BASCULE_MAXIMALE <= 6,
);
v('les réglages du jour logique se rendent ensemble', reglagesJourLogique(lectureDe({ lever: '08:00', fuseau: 'UTC' })), {
  heureBascule: 6,
  fuseau: 'UTC',
});

console.log('\n\x1b[1mLes valeurs proposées sont écrivables\x1b[0m');
{
  const toutes = [
    ...proposer({ ...entrees(profilEnEcart), decisions: new Map() }).ecarts,
    ...proposer({
      ...entrees({ domainesActifs: ['connaissances', 'psyche', 'corps'], coucher: '22:00' }, observer(usage(22), UTC)),
      decisions: new Map(),
    }).ecarts,
  ];
  vrai('au moins cinq écarts ont été éprouvés', toutes.length >= 5);
  vrai(
    'et chaque valeur proposée passe la validation de son champ',
    toutes.every((e) => valider(e.champ, e.valeurProposee).recevable),
  );
  vrai(
    'chaque constat et chaque question sont en français lisible',
    toutes.every((e) => e.constat.length > 20 && e.question.length > 10),
  );
}
v(
  'les domaines par défaut n’ont pas bougé sous les pieds de la règle',
  DOMAINES_ACTIFS_PAR_DEFAUT.length,
  5,
);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
