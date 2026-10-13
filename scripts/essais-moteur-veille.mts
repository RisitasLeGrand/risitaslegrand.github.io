/**
 * Essais du moteur de la veille — phase 2.
 *
 * Les trois propriétés qui comptent, et qu'aucune relecture ne garantit :
 *
 *   1. un déclin **mono-domaine** ne déclenche jamais, si fort soit-il ;
 *   2. un déclin **multi-domaines** déclenche après la persistance, pas avant ;
 *   3. la base **ne s'entraîne pas** : une dégradation lente ne devient pas la
 *      nouvelle normale, et le signal ne s'éteint pas tout seul.
 *
 * La troisième est la seule qui échouerait sans qu'on s'en aperçoive jamais —
 * le dispositif se tairait, et un dispositif muet a l'air d'un dispositif
 * rassurant.
 */
import {
  CATALOGUE,
  controlerCatalogue,
  ligneDeBase,
  type Indicateur,
  type Mesure,
} from '../src/lib/odyssee/veille';
import {
  DECOTE,
  MARGE_DE_CONTEXTE,
  REGLAGES,
  contextesApplicables,
  controlerFormulations,
  controlerMoteur,
  deviation,
  evaluer,
  formulerLEcart,
  formulerLeContexte,
  type Contexte,
  type Sensibilite,
} from '../src/lib/odyssee/moteur-veille';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(
    titre,
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`,
  );

const jourDecale = (depuis: string, n: number) =>
  new Date(Date.parse(`${depuis}T12:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Un lundi, pour que les semaines tombent rond. */
const LUNDI = '2026-06-01';
verifier('0.1 le jour d’ancrage est un lundi', new Date(`${LUNDI}T12:00:00.000Z`).getUTCDay() === 1);

const indicateur = (id: string): Indicateur => {
  const i = CATALOGUE.find((c) => c.id === id);
  if (!i) throw new Error(`indicateur inconnu : ${id}`);
  return i;
};

/**
 * Une série : `jours` jours à `base`, puis `jours2` jours à `apres`.
 * Le dernier jour est `LUNDI + total - 1`.
 */
const serie = (base: number, jours: number, apres?: number, jours2 = 0): Mesure[] => {
  const out: Mesure[] = [];
  for (let d = 0; d < jours; d += 1) out.push({ jour: jourDecale(LUNDI, d), valeur: base });
  for (let d = 0; d < jours2; d += 1) {
    out.push({ jour: jourDecale(LUNDI, jours + d), valeur: apres ?? base });
  }
  return out;
};

/* ── 1. Les réglages se tiennent ───────────────────────────────────────── */

egal('1.1 le moteur passe son propre contrôle', controlerMoteur(), []);
egal('1.2 le catalogue aussi', controlerCatalogue(), []);
verifier('1.3 Standard est à deux ÉAM, quatorze jours, trois domaines',
  REGLAGES.standard.seuil === 2 && REGLAGES.standard.persistance === 14 && REGLAGES.standard.k === 3);
verifier('1.4 Discrète est plus exigeante sur les trois axes',
  REGLAGES.discrete.seuil > REGLAGES.standard.seuil &&
    REGLAGES.discrete.persistance > REGLAGES.standard.persistance &&
    REGLAGES.discrete.k > REGLAGES.standard.k);
verifier('1.5 Attentive est moins exigeante sur le seuil et la fenêtre',
  REGLAGES.attentive.seuil < REGLAGES.standard.seuil &&
    REGLAGES.attentive.persistance < REGLAGES.standard.persistance);
verifier('1.6 la décote rend un contexte atténuant, jamais aggravant', DECOTE > 1);

/* ── 2. L'écart d'un indicateur ────────────────────────────────────────── */

{
  // Huit heures pendant huit semaines, puis six heures pendant deux.
  const mesures = serie(8, 56, 6, 14);
  const fin = jourDecale(LUNDI, 69);
  const base = ligneDeBase('sommeil.duree', mesures, jourDecale(LUNDI, 55));
  const d = deviation(indicateur('sommeil.duree'), mesures, base, fin, REGLAGES.standard, []);
  verifier('2.1 une chute de deux heures sur une habitude parfaite dévie', d?.devie === true,
    `écarts ${d?.ecarts}`);
  verifier('2.2 l’écart est positif, c’est-à-dire dans le sens préoccupant', (d?.ecarts ?? 0) > 0);
  egal('2.3 les quatorze jours de la fenêtre sont retenus', d?.joursRetenus, 14);
}

{
  // Le piège du plancher : une personne parfaitement régulière.
  const mesures = serie(8, 56, 7.9, 14);
  const fin = jourDecale(LUNDI, 69);
  const base = ligneDeBase('sommeil.duree', mesures, jourDecale(LUNDI, 55));
  const d = deviation(indicateur('sommeil.duree'), mesures, base, fin, REGLAGES.standard, []);
  verifier(
    '2.4 six minutes de moins sur une habitude parfaite ne déclenchent rien',
    d?.devie === false,
    `écarts ${d?.ecarts?.toFixed(2)} — sans plancher, ce serait l’infini`,
  );
  verifier('2.5 et l’écart reste fini', Number.isFinite(d?.ecarts ?? NaN));
}

{
  // Le sens compte : dormir plus n'inquiète pas.
  const mesures = serie(8, 56, 10, 14);
  const fin = jourDecale(LUNDI, 69);
  const base = ligneDeBase('sommeil.duree', mesures, jourDecale(LUNDI, 55));
  const d = deviation(indicateur('sommeil.duree'), mesures, base, fin, REGLAGES.standard, []);
  verifier('2.6 dormir deux heures de plus ne dévie pas', d?.devie === false);
  verifier('2.7 et l’écart est négatif', (d?.ecarts ?? 0) < 0);
}

{
  // Trop peu de jours : null, et non « pas de déviation ».
  const mesures: Mesure[] = [
    { jour: jourDecale(LUNDI, 68), valeur: 3 },
    { jour: jourDecale(LUNDI, 69), valeur: 3 },
  ];
  const base = ligneDeBase('sommeil.duree', serie(8, 56), jourDecale(LUNDI, 55));
  const d = deviation(indicateur('sommeil.duree'), mesures, base, jourDecale(LUNDI, 69),
    REGLAGES.standard, []);
  egal('2.8 deux jours ne suffisent pas à conclure, et rendent null', d, null);
}

/* ── 3. Le contexte ────────────────────────────────────────────────────── */

const contexte = (motif: Contexte['motif'], debut: string, fin: string,
  domaines: Contexte['domaines'] = []): Contexte => ({ id: `${motif}-${debut}`, motif, debut, fin, domaines });

{
  const c = [contexte('examens', jourDecale(LUNDI, 50), jourDecale(LUNDI, 60))];
  egal('3.1 un contexte couvrant la fenêtre s’applique',
    contextesApplicables(c, 'sommeil', jourDecale(LUNDI, 56), jourDecale(LUNDI, 69)).length, 1);
  egal(`3.2 il s’applique encore ${MARGE_DE_CONTEXTE} jours après sa fin`,
    contextesApplicables(c, 'sommeil', jourDecale(LUNDI, 66), jourDecale(LUNDI, 67)).length, 1);
  egal('3.3 mais plus au-delà de la marge : il ne masque pas indéfiniment',
    contextesApplicables(c, 'sommeil', jourDecale(LUNDI, 68), jourDecale(LUNDI, 80)).length, 0);
  egal('3.4 un contexte ciblé n’atteint pas les autres domaines',
    contextesApplicables([contexte('blessure', jourDecale(LUNDI, 50), jourDecale(LUNDI, 60), ['activite'])],
      'sommeil', jourDecale(LUNDI, 56), jourDecale(LUNDI, 69)).length, 0);
}

{
  const mesures = serie(8, 56, 6, 14);
  const fin = jourDecale(LUNDI, 69);
  const base = ligneDeBase('sommeil.duree', mesures, jourDecale(LUNDI, 55));
  const sans = deviation(indicateur('sommeil.duree'), mesures, base, fin, REGLAGES.standard, []);
  const avec = deviation(indicateur('sommeil.duree'), mesures, base, fin, REGLAGES.standard,
    [contexte('maladie', jourDecale(LUNDI, 56), fin)]);
  egal('3.5 le contexte ne change pas l’écart mesuré', avec?.ecarts, sans?.ecarts);
  verifier('3.6 il relève le seuil', (avec?.seuilApplique ?? 0) > (sans?.seuilApplique ?? 0));
  egal('3.7 et le motif est nommé, jamais tu', avec?.contextes, ['maladie']);
  verifier('3.8 un écart franc survit à la décote : un contexte n’éteint pas', avec?.devie === true);
}

{
  // Un écart juste au-dessus du seuil, que la décote doit faire taire.
  const mesures = serie(8, 56, 7.3, 14);
  const fin = jourDecale(LUNDI, 69);
  const base = ligneDeBase('sommeil.duree', mesures, jourDecale(LUNDI, 55));
  const sans = deviation(indicateur('sommeil.duree'), mesures, base, fin, REGLAGES.standard, []);
  const avec = deviation(indicateur('sommeil.duree'), mesures, base, fin, REGLAGES.standard,
    [contexte('vacances', jourDecale(LUNDI, 56), fin)]);
  verifier('3.9 un écart modéré dévie sans contexte', sans?.devie === true, `${sans?.ecarts}`);
  verifier('3.10 et ne dévie plus avec un contexte déclaré', avec?.devie === false);
}

/* ── 4. Le croisement ──────────────────────────────────────────────────── */

/** Construit l'entrée complète : tous les indicateurs plats, sauf ceux nommés. */
const entreeAvec = (
  degrades: Readonly<Record<string, [number, number]>>,
  jours = 70,
): Record<string, Mesure[]> => {
  const out: Record<string, Mesure[]> = {};
  for (const i of CATALOGUE) {
    const d = degrades[i.id];
    out[i.id] = d
      ? serie(d[0], jours - 14, d[1], 14)
      : serie(i.sens === 'baisse' ? 10 : 2, jours);
  }
  return out;
};

const FIN = jourDecale(LUNDI, 69);

{
  // Le sommeil s'effondre sur ses quatre indicateurs. Un seul domaine.
  const v = evaluer({
    jour: FIN,
    mesures: entreeAvec({
      'sommeil.duree': [8, 4],
      // 23 h et 3 h, exprimées en heures depuis 18 h : voir le commentaire
      // du catalogue. En heures d'horloge, ce décalage de quatre heures se
      // lirait comme un coucher avancé de vingt.
      'sommeil.phase': [5, 9],
      'sommeil.irregularite': [0.2, 3],
      'sommeil.nuits-courtes': [0, 6],
    }),
  });
  egal('4.1 un effondrement mono-domaine ne déclenche rien', v.quoi, 'rien-a-signaler');
  if (v.quoi === 'rien-a-signaler') {
    egal('4.2 et le seul domaine concerné est nommé', v.domaines, ['sommeil']);
    verifier('4.3 le verdict dit pourquoi, il ne se tait pas', v.pourquoi.includes('3'));
    verifier('4.4 les quatre indicateurs du sommeil dévient pourtant',
      v.deviations.filter((d) => d.domaine === 'sommeil' && d.devie).length === 4);
  }
}

{
  // Trois domaines comptants : sommeil, rythme, engagement.
  const v = evaluer({
    jour: FIN,
    mesures: entreeAvec({
      'sommeil.duree': [8, 4],
      'usage.heure-tardive': [0.02, 0.5],
      'focus.minutes': [120, 20],
    }),
  });
  egal('4.5 trois domaines déclenchent', v.quoi, 'repere');
  if (v.quoi === 'repere') {
    egal('4.6 les trois domaines sont nommés', [...v.repere.domaines].sort(),
      ['engagement', 'rythme', 'sommeil']);
    egal('4.7 la fenêtre commence quatorze jours plus tôt', v.repere.depuis, jourDecale(FIN, -13));
    verifier('4.8 les déviations sont ordonnées, la plus forte d’abord',
      v.repere.deviations.every((d, i, t) => i === 0 || t[i - 1].ecarts >= d.ecarts));
  }
}

{
  // Les mêmes trois domaines, mais en sensibilité Discrète : k = 4.
  const mesures = entreeAvec({
    'sommeil.duree': [8, 4],
    'usage.heure-tardive': [0.02, 0.5],
    'focus.minutes': [120, 20],
  });
  egal('4.9 Discrète exige un quatrième domaine',
    evaluer({ jour: FIN, mesures, sensibilite: 'discrete' }).quoi, 'rien-a-signaler');
  egal('4.10 Attentive se contente des mêmes trois',
    evaluer({ jour: FIN, mesures, sensibilite: 'attentive' }).quoi, 'repere');
}

{
  // « lien » ne peut pas faire le troisième domaine.
  const v = evaluer({
    jour: FIN,
    mesures: entreeAvec({
      'sommeil.duree': [8, 4],
      'usage.heure-tardive': [0.02, 0.5],
      'agenda.annulations': [0.02, 0.6],
      'agenda.densite': [6, 0.5],
    }),
  });
  egal('4.11 le domaine d’appoint ne complète pas le croisement', v.quoi, 'rien-a-signaler');
  if (v.quoi === 'rien-a-signaler') {
    verifier('4.12 bien que ses indicateurs dévient',
      v.deviations.some((d) => d.domaine === 'lien' && d.devie));
  }
}

{
  // Mais il renforce un repère déjà déclenché.
  const v = evaluer({
    jour: FIN,
    mesures: entreeAvec({
      'sommeil.duree': [8, 4],
      'usage.heure-tardive': [0.02, 0.5],
      'focus.minutes': [120, 20],
      'agenda.annulations': [0.02, 0.6],
    }),
  });
  egal('4.13 un repère déclenché accueille l’appoint', v.quoi, 'repere');
  if (v.quoi === 'repere') {
    verifier('4.14 qui figure à part, hors des domaines comptés',
      v.repere.appuis.length === 1 && !v.repere.domaines.includes('lien'));
  }
}

/* ── 4 bis. La convention de l'heure de coucher ────────────────────────── */

{
  /*
     Cet essai existe parce que le défaut s'est produit. En heures d'horloge,
     un coucher repoussé de 23 h à 3 h donne une valeur qui chute de vingt, et
     le moteur conclut à une amélioration franche. L'ancre à 18 h est donc un
     contrat, et c'est ici qu'il est écrit.
  */
  const horloge = serie(23, 56, 3, 14);
  const ancre = serie(5, 56, 9, 14);
  const fin = jourDecale(LUNDI, 69);
  const i = indicateur('sommeil.phase');

  const faux = deviation(i, horloge, ligneDeBase(i.id, horloge, jourDecale(LUNDI, 55)), fin,
    REGLAGES.standard, []);
  const juste = deviation(i, ancre, ligneDeBase(i.id, ancre, jourDecale(LUNDI, 55)), fin,
    REGLAGES.standard, []);

  verifier('4bis.1 en heures d’horloge, un coucher repoussé se lirait comme une amélioration',
    (faux?.ecarts ?? 0) < 0);
  verifier('4bis.2 avec l’ancre à 18 h, il se lit comme un décalage', juste?.devie === true);
  verifier('4bis.3 la définition du catalogue porte l’ancre',
    i.definition.includes('18 h') && i.unite.includes('18 h'));
}

/* ── 5. La base ne s'entraîne pas ──────────────────────────────────────── */

{
  /*
     Le scénario qui ruine les détections par écart : une dégradation qui
     dure. Sans gel, la base la rejoint, l'écart retombe sous le seuil, et le
     signal s'éteint sans que rien ne se soit amélioré.
  */
  const degrades = {
    'sommeil.duree': [8, 4] as [number, number],
    'usage.heure-tardive': [0.02, 0.5] as [number, number],
    'focus.minutes': [120, 20] as [number, number],
  };
  // 56 jours sains, puis 70 jours dégradés : dix semaines.
  const mesures: Record<string, Mesure[]> = {};
  for (const i of CATALOGUE) {
    const d = (degrades as Record<string, [number, number]>)[i.id];
    mesures[i.id] = d ? serie(d[0], 56, d[1], 70) : serie(i.sens === 'baisse' ? 10 : 2, 126);
  }
  const debutDuSignal = jourDecale(LUNDI, 56 + 13);
  const bienPlusTard = jourDecale(LUNDI, 125);

  const sansGel = evaluer({ jour: bienPlusTard, mesures });
  egal('5.1 sans gel, dix semaines plus tard, le repère s’est éteint tout seul',
    sansGel.quoi, 'rien-a-signaler');

  const avecGel = evaluer({ jour: bienPlusTard, mesures, signalActifDepuis: debutDuSignal });
  egal('5.2 avec le gel, il tient', avecGel.quoi, 'repere');
  if (avecGel.quoi === 'repere') {
    egal('5.3 et la base employée est bien celle de la veille du signal',
      avecGel.repere.baseArreteeAu, jourDecale(debutDuSignal, -1));
  }
  verifier(
    '5.4 c’est bien le gel qui fait la différence, rien d’autre',
    sansGel.quoi !== avecGel.quoi,
  );
}

/* ── 6. Données insuffisantes ──────────────────────────────────────────── */

{
  const v = evaluer({ jour: FIN, mesures: {} });
  egal('6.1 sans aucune donnée, le verdict le dit', v.quoi, 'donnees-insuffisantes');
  if (v.quoi === 'donnees-insuffisantes') {
    verifier('6.2 et nomme ce qui manque', v.suffisance.manques.length > 0);
  }
}

{
  // Deux semaines d'historique seulement : la base n'existe pas.
  const mesures: Record<string, Mesure[]> = {};
  for (const i of CATALOGUE) mesures[i.id] = serie(5, 14);
  const v = evaluer({ jour: jourDecale(LUNDI, 13), mesures });
  egal('6.3 quatorze jours d’historique ne font pas une base', v.quoi, 'donnees-insuffisantes');
}

/* ── 7. Les mots de la carte ───────────────────────────────────────────── */

{
  const v = evaluer({
    jour: FIN,
    mesures: entreeAvec({
      'sommeil.irregularite': [0.2, 3],
      'usage.heure-tardive': [0.02, 0.5],
      'focus.minutes': [120, 20],
    }),
  });
  verifier('7.1 le scénario de la maquette déclenche', v.quoi === 'repere');
  if (v.quoi === 'repere') {
    const phrases = [
      ...v.repere.deviations.map((d) => formulerLEcart(d, indicateur(d.indicateur))),
      formulerLeContexte(v.repere),
    ];
    egal('7.2 aucune phrase ne contient de mot interdit ni de chiffre',
      controlerFormulations(phrases), []);
    verifier('7.3 l’irrégularité se dit « plus dispersées »',
      phrases.some((p) => p.includes('plus dispersées')));
    verifier('7.4 l’absence de contexte se dit, au lieu de se taire',
      phrases.some((p) => p.includes('aucun n’a été déclaré')));
  }
}

verifier('7.5 le contrôle attrape un chiffre glissé dans une phrase',
  controlerFormulations(['vos nuits ont perdu 2 heures']).some((p) => p.includes('chiffre')));
verifier('7.6 et le vocabulaire de dépistage',
  controlerFormulations(['ce dépistage indique']).some((p) => p.includes('dépistage')));
verifier('7.7 y compris le mot « alerte », que le titre refuse',
  controlerFormulations(['une alerte a été levée']).length > 0);

/* ── 8. Stabilité ──────────────────────────────────────────────────────── */

{
  // Une série parfaitement stable, sur toutes les sensibilités.
  const mesures: Record<string, Mesure[]> = {};
  for (const i of CATALOGUE) mesures[i.id] = serie(i.sens === 'baisse' ? 10 : 2, 70);
  for (const s of ['discrete', 'standard', 'attentive'] as Sensibilite[]) {
    egal(`8.1 ${s} : une vie stable ne déclenche rien`,
      evaluer({ jour: FIN, mesures, sensibilite: s }).quoi, 'rien-a-signaler');
  }
}

{
  // Un bruit léger, réaliste, ne doit rien déclencher non plus.
  let graine = 7;
  const bruit = () => {
    graine = (graine * 1103515245 + 12345) % 2147483648;
    return (graine / 2147483648 - 0.5) * 2;
  };
  const mesures: Record<string, Mesure[]> = {};
  for (const i of CATALOGUE) {
    const socle = i.sens === 'baisse' ? 10 : 2;
    mesures[i.id] = Array.from({ length: 70 }, (_, d) => ({
      jour: jourDecale(LUNDI, d),
      valeur: socle + bruit() * i.plancherDeDispersion * 2,
    }));
  }
  egal('8.2 un bruit de deux planchers ne déclenche rien',
    evaluer({ jour: FIN, mesures }).quoi, 'rien-a-signaler');
}

/* ── Bilan ─────────────────────────────────────────────────────────────── */

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
