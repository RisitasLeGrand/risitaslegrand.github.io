/**
 * Le modèle d'Odyssée : ce qui se vérifie sans navigateur et sans base.
 *
 * Les contrôles de forme, les durées, les chevauchements. Ce sont les règles
 * que l'import ICS et les écrans appliqueront tous les deux : les vérifier ici
 * évite de les vérifier deux fois, et mal.
 */
import type { Fait } from '../src/lib/noyau/faits';
import { projeterFaitsOdyssee } from '../src/lib/odyssee/faits-odyssee';
import {
  JOURS_DE_LA_ROUE,
  SUGGESTIONS_AFFICHEES,
  controlerRegles,
  couverture,
  derniersJours,
  plancherDuJour,
  queFaireMaintenant,
  roue,
  semaineCourante,
} from '../src/lib/odyssee/jour';
import {
  CADENCES,
  TYPES_DE_REVUE,
  chevauchements,
  controlerEvenement,
  controlerQuete,
  controlerTache,
  dureeDeLEvenement,
  seChevauchent,
  type Evenement,
  type Quete,
  type Tache,
} from '../src/lib/odyssee/modele';

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

const tache = (p: Partial<Tache> = {}): Tache => ({
  id: 'T1',
  titre: 'Déclarer les impôts',
  domaine: 'ordre',
  echeance: null,
  faiteLe: null,
  note: '',
  creeeLe: '2026-10-01T09:00:00.000Z',
  majLe: '2026-10-01T09:00:00.000Z',
  ...p,
});

const quete = (p: Partial<Quete> = {}): Quete => ({
  id: 'Q1',
  titre: 'Marcher trente minutes',
  domaine: 'corps',
  cadence: 'jour',
  active: true,
  tenues: [],
  creeeLe: '2026-10-01T09:00:00.000Z',
  majLe: '2026-10-01T09:00:00.000Z',
  ...p,
});

const evenement = (p: Partial<Evenement> = {}): Evenement => ({
  id: 'E1',
  titre: 'Rendez-vous',
  domaine: 'ordre',
  debut: '2026-10-12T09:00:00.000Z',
  fin: '2026-10-12T10:00:00.000Z',
  journeeEntiere: false,
  lieu: '',
  note: '',
  uidIcs: null,
  ...p,
});

/* ════════════════════════════════════════════════════════════════════════
   1. Les contrôles de forme
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES CONTRÔLES DE FORME DISENT CE QUI CLOCHE');

v('une tâche bien formée ne pose aucun problème', controlerTache(tache()), []);
v(
  'un titre vide est refusé, et le dit',
  controlerTache(tache({ titre: '   ' })),
  ['Une tâche a besoin d’un titre.'],
);
v(
  'une échéance qui n’est pas un jour est refusée',
  controlerTache(tache({ echeance: '12/10/2026' })).length,
  1,
);
v('une échéance absente est licite', controlerTache(tache({ echeance: null })), []);

v('une quête bien formée ne pose aucun problème', controlerQuete(quete()), []);
v(
  'un même jour tenu deux fois est refusé',
  controlerQuete(quete({ tenues: ['2026-10-10', '2026-10-10'] })),
  ['Un même jour ne peut être tenu deux fois.'],
);
v('les deux cadences sont celles déclarées', [...CADENCES], ['jour', 'semaine']);
v('les cinq revues sont celles déclarées', TYPES_DE_REVUE.length, 5);

v('un événement bien formé ne pose aucun problème', controlerEvenement(evenement()), []);
v(
  'une fin antérieure au début est refusée',
  controlerEvenement(evenement({ fin: '2026-10-12T08:00:00.000Z' })),
  ['Un événement ne peut pas finir avant d’avoir commencé.'],
);
/*
   Le jalon de durée nulle : un agenda exporté en produit couramment, et le
   refuser ferait perdre à l'import des entrées valides.
*/
v(
  'une durée nulle est acceptée : c’est un jalon, pas une erreur',
  controlerEvenement(evenement({ fin: '2026-10-12T09:00:00.000Z' })),
  [],
);

/* ════════════════════════════════════════════════════════════════════════
   2. Les durées
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES DURÉES');

v('une heure vaut 3 600 secondes', dureeDeLEvenement(evenement()), 3600);
v(
  'une journée entière vaut 24 h, quelles que soient ses heures',
  dureeDeLEvenement(evenement({ journeeEntiere: true, fin: '2026-10-12T09:30:00.000Z' })),
  24 * 3600,
);
v(
  'une date illisible vaut zéro, et non « NaN »',
  dureeDeLEvenement(evenement({ fin: 'jeudi' })),
  0,
);

/* ════════════════════════════════════════════════════════════════════════
   3. Les chevauchements
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES CHEVAUCHEMENTS, ET CE QUI N’EN EST PAS UN');

const neufDix = evenement({ id: 'A' });
const dixOnze = evenement({
  id: 'B',
  debut: '2026-10-12T10:00:00.000Z',
  fin: '2026-10-12T11:00:00.000Z',
});
const neufTrenteDixTrente = evenement({
  id: 'C',
  debut: '2026-10-12T09:30:00.000Z',
  fin: '2026-10-12T10:30:00.000Z',
});

/*
   Le contact simple n'est pas un chevauchement : c'est ainsi qu'une journée
   bien remplie est normalement construite, et le signaler rendrait
   l'avertissement inutilisable.
*/
faux('deux réunions qui se suivent ne se chevauchent pas', seChevauchent(neufDix, dixOnze));
vrai('deux réunions qui se superposent, si', seChevauchent(neufDix, neufTrenteDixTrente));
faux(
  'une journée entière ne chevauche rien : elle n’occupe pas d’heures',
  seChevauchent(evenement({ journeeEntiere: true }), neufTrenteDixTrente),
);

v(
  'la paire est rendue une seule fois, pas dans les deux sens',
  chevauchements([neufTrenteDixTrente, neufDix]).map(([a, b]) => [a.id, b.id]),
  [['A', 'C']],
);
/*
   C (9 h 30 – 10 h 30) chevauche A (9 h – 10 h) **et** B (10 h – 11 h) : deux
   paires, pas une. C'est la réunion posée en travers de deux créneaux
   jointifs, et c'est exactement le cas que l'écran doit signaler deux fois.
*/
v(
  'une réunion à cheval sur deux créneaux fait deux paires',
  chevauchements([neufDix, neufTrenteDixTrente, dixOnze]).map(([a, b]) => [a.id, b.id]),
  [
    ['A', 'C'],
    ['C', 'B'],
  ],
);
v(
  'trois réunions qui se superposent toutes font trois paires',
  chevauchements([
    neufDix,
    neufTrenteDixTrente,
    evenement({ id: 'D', debut: '2026-10-12T09:45:00.000Z', fin: '2026-10-12T10:15:00.000Z' }),
  ]).length,
  3,
);

/*
   La sortie anticipée de la boucle repose sur le tri par début. Une journée
   bien remplie et sans aucun chevauchement est le cas où elle doit couper :
   on vérifie qu'elle ne rate rien pour autant, sur une suite d'événements
   jointifs qui ne se chevauchent jamais.
*/
{
  const journee: Evenement[] = [];
  for (let h = 8; h < 18; h += 1) {
    journee.push(
      evenement({
        id: `H${h}`,
        debut: `2026-10-12T${String(h).padStart(2, '0')}:00:00.000Z`,
        fin: `2026-10-12T${String(h + 1).padStart(2, '0')}:00:00.000Z`,
      }),
    );
  }
  v('dix réunions jointives ne font aucun chevauchement', chevauchements(journee).length, 0);
  // Et une de plus, posée en travers, est bien trouvée malgré la sortie anticipée.
  journee.push(
    evenement({ id: 'X', debut: '2026-10-12T15:30:00.000Z', fin: '2026-10-12T16:30:00.000Z' }),
  );
  v(
    'mais une réunion posée en travers l’est, et sur ses deux voisines',
    chevauchements(journee).length,
    2,
  );
}

/* ════════════════════════════════════════════════════════════════════════
   4. La projection de faits
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nODYSSÉE NE PUBLIE QUE CE QUI A EU LIEU');

const MAINTENANT = new Date('2026-10-12T18:00:00.000Z');
const vide = { taches: [], quetes: [], evenements: [], focus: [], revues: [] };

{
  const { faits } = projeterFaitsOdyssee(
    { ...vide, taches: [tache({ faiteLe: null }), tache({ id: 'T2', faiteLe: '2026-10-11' })] },
    { maintenant: MAINTENANT },
  );
  v('une tâche ouverte n’est pas un fait', faits.length, 1);
  v('et la tâche close porte un identifiant déterministe', faits[0].id, 'odyssee.tache:T2');
  v('posée au jour de sa clôture', faits[0].jourLogique, '2026-10-11');
}

{
  /*
     « En retard » est figé à la clôture : l'échéance peut être modifiée après
     coup, le fait ne doit pas réécrire son propre passé.
  */
  const { faits } = projeterFaitsOdyssee(
    { ...vide, taches: [tache({ faiteLe: '2026-10-11', echeance: '2026-10-05' })] },
    { maintenant: MAINTENANT },
  );
  v('le retard est enregistré avec le fait', faits[0].details?.enRetard, true);
}

{
  const { faits } = projeterFaitsOdyssee(
    { ...vide, quetes: [quete({ tenues: ['2026-10-10', '2026-10-11'] })] },
    { maintenant: MAINTENANT },
  );
  v('une quête tenue deux jours fait deux faits', faits.length, 2);
  v(
    'et chacun porte son jour dans son identifiant',
    faits.map((f) => f.id),
    ['odyssee.quete:Q1:2026-10-10', 'odyssee.quete:Q1:2026-10-11'],
  );
  v('dans le domaine de la quête', faits[0].domaine, 'corps');
}

{
  const passe = evenement({ id: 'PASSE' });
  const futur = evenement({
    id: 'FUTUR',
    debut: '2026-10-20T09:00:00.000Z',
    fin: '2026-10-20T10:00:00.000Z',
  });
  const { faits, manques } = projeterFaitsOdyssee(
    { ...vide, evenements: [passe, futur] },
    { maintenant: MAINTENANT },
  );
  v('un événement à venir n’est pas publié', faits.map((f) => f.id), [
    'odyssee.evenement:PASSE',
  ]);
  vrai(
    'et le manque le dit, plutôt que de le taire',
    manques.some((m) => m.quoi.includes('à venir') && m.combien === 1),
  );
  /*
     Un créneau d'agenda dit ce qui était prévu : `estime`, jamais `confirme`.
     C'est le seul des cinq à ne pas être confirmé.
  */
  v('un créneau d’agenda est estimé, pas confirmé', faits[0].fiabilite, 'estime');
  v('et il porte sa durée en secondes', faits[0].valeur, 3600);
}

{
  const { faits } = projeterFaitsOdyssee(
    {
      ...vide,
      focus: [
        {
          id: 'F1',
          domaine: 'oeuvre',
          tacheId: null,
          debut: '2026-10-12T09:00:00.000Z',
          fin: '2026-10-12T09:09:00.000Z',
          secondes: 540,
          interrompue: true,
          majLe: '2026-10-12T09:09:00.000Z',
        },
      ],
    },
    { maintenant: MAINTENANT },
  );
  /*
     Neuf minutes réellement passées, et non les vingt-cinq visées : compter la
     durée visée gonflerait l'indicateur les jours où l'on s'est le moins
     concentré.
  */
  v('un Pomodoro interrompu vaut ce qu’il a duré', faits[0].valeur, 540);
  v('et il est mesuré, donc confirmé', faits[0].fiabilite, 'confirme');
}

{
  const { faits } = projeterFaitsOdyssee(
    {
      ...vide,
      revues: [
        {
          id: 'soir:2026-10-11',
          type: 'soir',
          jour: '2026-10-11',
          reponses: { bilan: 'rien à signaler' },
          majLe: '2026-10-11T22:00:00.000Z',
        },
      ],
    },
    { maintenant: MAINTENANT },
  );
  // Une revue est un retour sur soi : Psyché, et non Ordre.
  v('une revue relève de Psyché', faits[0].domaine, 'psyche');
  v('et ne publie que le nombre de réponses, jamais leur texte', faits[0].details, {
    type: 'soir',
    reponses: 1,
  });
}

{
  const contenu = {
    ...vide,
    quetes: [quete({ tenues: ['2026-10-01', '2026-10-11'] })],
  };
  const { faits } = projeterFaitsOdyssee(contenu, {
    maintenant: MAINTENANT,
    de: '2026-10-05',
    a: '2026-10-12',
  });
  v('la fenêtre écarte ce qui tombe avant', faits.length, 1);
  v(
    'deux projections rendent exactement la même chose',
    JSON.stringify(projeterFaitsOdyssee(contenu, { maintenant: MAINTENANT }).faits),
    JSON.stringify(projeterFaitsOdyssee(contenu, { maintenant: MAINTENANT }).faits),
  );
}

/* ════════════════════════════════════════════════════════════════════════
   5. La roue d'équilibre : vide n'est pas déséquilibré
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA ROUE DIT « PAS DE DONNÉE », JAMAIS ZÉRO');

const JOURS = derniersJours('2026-10-12', JOURS_DE_LA_ROUE);
const ACTIFS = ['corps', 'cognition', 'connaissances', 'psyche', 'finances'];

const faitDuree = (domaine: string, jour: string, secondes: number): Fait => ({
  id: `x:${domaine}:${jour}`,
  branche: 'odyssee',
  proprietaire: 'odyssee',
  domaine,
  type: 'odyssee.focus',
  debut: `${jour}T09:00:00.000Z`,
  jourLogique: jour,
  valeur: secondes,
  unite: 'secondes',
  source: 'auto',
  fiabilite: 'confirme',
  version: 1,
  modifieLe: `${jour}T09:00:00.000Z`,
});

{
  const r = roue([], { actifs: ACTIFS, jours: JOURS });
  vrai('une roue sans aucun fait se déclare vide', r.vide);
  v('et aucune branche n’affiche zéro', r.branches.filter((b) => b.secondes === 0).length, 0);
  v(
    'les cinq domaines actifs sont « sans donnée »',
    r.branches.filter((b) => b.etat === 'sans-donnee').length,
    5,
  );
  v(
    'et les trois autres sont en pause',
    r.branches.filter((b) => b.etat === 'en-pause').length,
    3,
  );
}

{
  const r = roue([faitDuree('cognition', '2026-10-12', 3600)], {
    actifs: ACTIFS,
    jours: JOURS,
    cibles: { cognition: 0.5 },
  });
  faux('une roue qui porte un fait n’est plus vide', r.vide);
  const cognition = r.branches.find((b) => b.domaine === 'cognition')!;
  v('le domaine mesuré porte sa part', cognition.part, 1);
  v('et son écart à la cible', cognition.ecart, 0.5);
  const corps = r.branches.find((b) => b.domaine === 'corps')!;
  v('un domaine actif sans fait reste sans part', corps.part, null);
  v('mais sans écart non plus : on ne s’écarte pas de nulle part', corps.ecart, null);
}

{
  /*
     Une tâche close n'a pas de durée. La compter pour une valeur arbitraire
     ferait d'un chiffre inventé la moitié de la roue.
  */
  const sansDuree: Fait = { ...faitDuree('ordre', '2026-10-12', 0), unite: undefined, valeur: undefined };
  const r = roue([sansDuree], { actifs: [...ACTIFS, 'ordre'], jours: JOURS });
  vrai('un fait sans durée ne pèse pas dans la roue', r.vide);
}

/* ════════════════════════════════════════════════════════════════════════
   6. Le plancher du jour
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE PLANCHER NE COMPTE QUE CE QU’ON S’EST ENGAGÉ À TENIR');

const SEMAINE = semaineCourante('2026-10-12');

{
  const p = plancherDuJour(
    [
      quete({ id: 'A', cadence: 'jour', tenues: ['2026-10-12'] }),
      quete({ id: 'B', cadence: 'jour', tenues: [] }),
      quete({ id: 'C', cadence: 'jour', active: false }),
    ],
    { aujourdhui: '2026-10-12', semaine: SEMAINE, actifs: ACTIFS },
  );
  v('une quête inactive n’est pas attendue', p.total, 2);
  v('une tenue, une non tenue', p.tenues, 1);
  faux('le plancher n’est pas atteint', p.atteint);
}

{
  /*
     Une hebdomadaire tenue lundi doit libérer les six jours suivants : sans
     cela, la cadence « semaine » ne voudrait rien dire.
  */
  const lundi = SEMAINE[0];
  const p = plancherDuJour([quete({ cadence: 'semaine', tenues: [lundi] })], {
    aujourdhui: '2026-10-12',
    semaine: SEMAINE,
    actifs: ACTIFS,
  });
  v('une hebdomadaire tenue cette semaine n’est plus attendue', p.total, 0);
  faux('et un plancher vide n’est pas « atteint »', p.atteint);
}

{
  const p = plancherDuJour([quete({ cadence: 'jour', tenues: ['2026-10-12'] })], {
    aujourdhui: '2026-10-12',
    semaine: SEMAINE,
    actifs: ACTIFS,
  });
  vrai('tout tenu, le plancher est atteint', p.atteint);
}

/* ════════════════════════════════════════════════════════════════════════
   7. Que faire maintenant
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nCHAQUE SUGGESTION PORTE SA RÈGLE');

v('le catalogue de règles ne pose aucun problème', controlerRegles(), []);

const MIDI = new Date('2026-10-12T12:00:00.000Z');
const base = {
  quetes: [] as Quete[],
  taches: [] as Tache[],
  evenementsDuJour: [] as Evenement[],
  faits: [] as Fait[],
};
const options = {
  maintenant: MIDI,
  aujourdhui: '2026-10-12',
  semaine: SEMAINE,
  actifs: ACTIFS,
};

{
  const { suggestions } = queFaireMaintenant(
    { ...base, quetes: [quete({ cadence: 'jour', tenues: [] })] },
    options,
  );
  v('une quête non tenue est suggérée', suggestions.length, 1);
  v('par la règle du plancher', suggestions[0].regle, 'quete-du-jour');
  vrai('et la suggestion dit pourquoi', suggestions[0].parceQue.length > 10);
}

{
  /*
     « Ordre » est en pause par défaut, et les tâches y vivent : les options de
     ce bloc l'allument donc. C'est aussi la règle que vérifie le bloc suivant
     — un domaine mis en pause se tait, suggestions comprises.
  */
  const avecOrdre = { ...options, actifs: [...ACTIFS, 'ordre'] };
  const { suggestions } = queFaireMaintenant(
    {
      ...base,
      taches: [
        tache({ id: 'R', echeance: '2026-10-01' }),
        tache({ id: 'J', echeance: '2026-10-12' }),
      ],
    },
    avecOrdre,
  );
  /*
     Le retard passe après l'engagement du jour, mais avant l'échéance du
     jour : l'ordre des règles est l'ordre d'affichage, et il est délibéré.
  */
  v(
    'le retard précède l’échéance du jour',
    suggestions.map((s) => s.regle),
    ['tache-en-retard', 'tache-du-jour'],
  );

  /*
     Et la contrepartie, qui est une règle et non un oubli : un domaine mis en
     pause ne produit aucune suggestion. Mettre un domaine en pause veut dire
     « je ne tiens pas celui-là en ce moment » ; continuer à en rappeler les
     tâches ferait du geste une case à cocher sans effet, et rendrait la pause
     coupable — exactement ce que E.3 refuse.

     La conséquence pour l'écran de saisie : il ne doit proposer que des
     domaines actifs, faute de quoi on pourrait créer une tâche qui ne
     reparaîtra jamais.
  */
  const { suggestions: muettes } = queFaireMaintenant(
    { ...base, taches: [tache({ id: 'R', echeance: '2026-10-01' })] },
    options,
  );
  v('une tâche d’un domaine en pause ne dit rien', muettes.length, 0);
}

{
  const { suggestions } = queFaireMaintenant(
    {
      ...base,
      evenementsDuJour: [
        evenement({ id: 'BIENTOT', debut: '2026-10-12T12:20:00.000Z', fin: '2026-10-12T13:00:00.000Z' }),
        evenement({ id: 'CE-SOIR', debut: '2026-10-12T20:00:00.000Z', fin: '2026-10-12T21:00:00.000Z' }),
      ],
    },
    options,
  );
  v('seul l’événement imminent est suggéré', suggestions.length, 1);
  v('et il dit dans combien de temps', suggestions[0].parceQue, 'Commence dans 20 min.');
}

{
  /* Neuf heures d'agenda : la journée est pleine. */
  const journee: Evenement[] = [];
  for (let h = 8; h < 17; h += 1) {
    journee.push(
      evenement({
        id: `H${h}`,
        debut: `2026-10-12T${String(h).padStart(2, '0')}:00:00.000Z`,
        fin: `2026-10-12T${String(h + 1).padStart(2, '0')}:00:00.000Z`,
      }),
    );
  }
  const { suggestions, retenues, surchargee } = queFaireMaintenant(
    { ...base, evenementsDuJour: journee, taches: [tache({ echeance: '2026-10-01' })] },
    { ...options, actifs: [...ACTIFS, 'ordre'] },
  );
  vrai('la journée est déclarée surchargée', surchargee);
  /*
     La règle de surcharge est la seule qui en désactive d'autres : elle retient
     ce qui ajoute du travail, et laisse passer les engagements et les conflits.
     Proposer d'en faire plus un jour déjà plein est le plus sûr moyen de faire
     abandonner l'outil.
  */
  vrai('et elle retient la tâche en retard', retenues >= 1);
  faux(
    'aucune suggestion n’ajoute de travail',
    suggestions.some((s) => s.regle === 'tache-en-retard'),
  );
  vrai(
    'mais l’avertissement de surcharge, lui, s’affiche',
    suggestions.some((s) => s.regle === 'journee-surchargee'),
  );
}

{
  /*
     « Délaissé » suppose « suivi » : un domaine qui n'a jamais rien reçu n'est
     pas délaissé, il n'est pas mesuré, et le signaler reviendrait à reprocher
     à la personne de ne pas saisir.
  */
  const vieux = faitDuree('corps', '2026-08-01', 1800);
  const { suggestions } = queFaireMaintenant({ ...base, faits: [vieux] }, options);
  v(
    'un domaine suivi autrefois et muet cette semaine est signalé',
    suggestions.filter((s) => s.regle === 'domaine-delaisse').map((s) => s.texte),
    ['Corps'],
  );
  const aucun = queFaireMaintenant(base, options);
  v(
    'un domaine jamais mesuré ne l’est pas',
    aucun.suggestions.filter((s) => s.regle === 'domaine-delaisse').length,
    0,
  );
}

{
  const tot = queFaireMaintenant(base, { ...options, coucher: '23:00' });
  v(
    'la revue du soir n’est pas proposée à midi',
    tot.suggestions.filter((s) => s.regle === 'revue-du-soir').length,
    0,
  );
  const soir = queFaireMaintenant(base, {
    ...options,
    maintenant: new Date('2026-10-12T21:30:00.000Z'),
    coucher: '23:00',
  });
  v(
    'elle l’est moins de deux heures avant le coucher',
    soir.suggestions.filter((s) => s.regle === 'revue-du-soir').length,
    1,
  );
  const faite = queFaireMaintenant(base, {
    ...options,
    maintenant: new Date('2026-10-12T21:30:00.000Z'),
    coucher: '23:00',
    revueFaite: true,
  });
  v('et plus une fois faite', faite.suggestions.filter((s) => s.regle === 'revue-du-soir').length, 0);
}

{
  const beaucoup: Quete[] = [];
  for (let i = 0; i < 10; i += 1) beaucoup.push(quete({ id: `Q${i}`, tenues: [] }));
  const { suggestions } = queFaireMaintenant({ ...base, quetes: beaucoup }, options);
  // Une liste de quinze suggestions n'est pas une aide, c'est une liste de reproches.
  v('les suggestions sont plafonnées', suggestions.length, SUGGESTIONS_AFFICHEES);
}

/* ════════════════════════════════════════════════════════════════════════
   8. Les fenêtres de jours
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES FENÊTRES');

v('sept jours, du plus ancien au plus récent', derniersJours('2026-10-12', 7), [
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
  '2026-10-09',
  '2026-10-10',
  '2026-10-11',
  '2026-10-12',
]);
// Le 12 octobre 2026 est un lundi : la semaine ne contient que lui.
v('la semaine commence le lundi', semaineCourante('2026-10-12'), ['2026-10-12']);
v('et s’arrête à aujourd’hui, jamais à dimanche', semaineCourante('2026-10-14'), [
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
]);
// Le changement d'heure ne doit pas faire sauter un jour : fin octobre 2026.
v('un changement d’heure ne décale rien', derniersJours('2026-10-26', 3), [
  '2026-10-24',
  '2026-10-25',
  '2026-10-26',
]);

{
  const c = couverture([faitDuree('cognition', '2026-10-12', 600)], ACTIFS, JOURS);
  v('un domaine sur cinq est mesuré', c.part, 0.2);
  v('et les quatre autres sont nommés', c.sansDonnee.length, 4);
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
