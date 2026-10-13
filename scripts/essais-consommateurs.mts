/**
 * Essais de « Qui lit mon budget » — Finances, phase 4.
 *
 * La thèse du module est qu'un **interrupteur n'est pas une garantie**. Ces
 * essais la mettent à l'épreuve dans les deux sens :
 *
 *  - l'interrupteur éteint ne rend rien — nécessaire, et facile ;
 *  - l'interrupteur allumé ne rend **que** ce que la promesse annonce, ce
 *    qui est la partie difficile et la seule qui protège.
 *
 * Et une troisième chose, qu'on oublie toujours : que le garde-fou soit
 * capable d'**échouer**. Un contrôle qu'aucun essai ne fait tomber ne prouve
 * rien de son silence sur les vrais cas.
 */
import {
  CONSOMMATEURS,
  FENETRE_CADENCE,
  REGLAGES_PAR_DEFAUT,
  SENTINELLES,
  budgetTemoinPourEssais,
  controlerLesConsommateurs,
  declarationDe,
  fuitesDe,
  projeter,
  relireLesReglages,
  type Consommateur,
  type ReglagesConsommateurs,
  type SourceFinances,
  type VueAgenda,
  type VueHabitudes,
  type VueQuoiMaintenant,
  type VueVeille,
} from '../src/lib/odyssee/consommateurs';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

const tousAllumes = Object.fromEntries(
  CONSOMMATEURS.map((c) => [c.id, true]),
) as ReglagesConsommateurs;
const tousEteints = Object.fromEntries(
  CONSOMMATEURS.map((c) => [c.id, false]),
) as ReglagesConsommateurs;

console.log('\n1. LE REGISTRE DIT CE QUE CHACUN VOIT');

{
  egal('1.1 sept consommateurs', CONSOMMATEURS.length, 7);
  verifier('1.2 chacun dit ce qu’il voit', CONSOMMATEURS.every((c) => c.voit.trim().length > 10));
  verifier('1.3 chacun a un libellé', CONSOMMATEURS.every((c) => c.libelle.trim().length > 0));
  egal('1.4 les cinq premiers sont actifs par défaut',
    CONSOMMATEURS.filter((c) => c.actifParDefaut).map((c) => c.id),
    ['agenda', 'quoiMaintenant', 'objectifs', 'habitudes', 'quetes']);
  egal('1.5 et les deux derniers non',
    CONSOMMATEURS.filter((c) => !c.actifParDefaut).map((c) => c.id), ['veille', 'ia']);
}

{
  /*
     Les deux règles que le plan écrit en toutes lettres, et dont l'oubli ne
     se verrait pas avant longtemps.
  */
  const veille = declarationDe('veille');
  verifier('1.6 la veille ne reçoit jamais d’écart au budget', !veille.ecartAuBudgetAutorise);
  verifier('1.7 ni aucun montant', !veille.montantsAutorises);
  verifier('1.8 et elle est décochée par défaut', !veille.actifParDefaut);
  const ia = declarationDe('ia');
  verifier('1.9 l’IA se consent à chaque fois', ia.consentementAChaqueFois);
  verifier('1.10 et elle est décochée par défaut', !ia.actifParDefaut);
  verifier('1.11 elle est la seule à redemander le consentement',
    CONSOMMATEURS.filter((c) => c.consentementAChaqueFois).length === 1);
}

console.log('\n2. L’INTERRUPTEUR, QUI EST NÉCESSAIRE');

{
  const s = budgetTemoinPourEssais();
  for (const c of CONSOMMATEURS) {
    verifier(`2.x « ${c.libelle} » éteint ne rend rien`,
      projeter(c.id, s, tousEteints, true) === null);
  }
  verifier('2.1 et allumés, tous rendent quelque chose',
    CONSOMMATEURS.every((c) => projeter(c.id, s, tousAllumes, true) !== null));
  verifier('2.2 un consommateur inconnu ne reçoit rien',
    projeter('inventé' as Consommateur, s, tousAllumes, true) === null);
}

{
  const s = budgetTemoinPourEssais();
  verifier('2.3 l’IA allumée mais non consentie ne rend rien',
    projeter('ia', s, tousAllumes, false) === null);
  verifier('2.4 consentie, elle rend', projeter('ia', s, tousAllumes, true) !== null);
  verifier('2.5 le consentement ne contourne pas l’interrupteur',
    projeter('ia', s, tousEteints, true) === null);
  verifier('2.6 et il ne concerne pas les autres',
    projeter('agenda', s, tousAllumes, false) !== null);
}

console.log('\n3. L’INTERRUPTEUR, QUI NE SUFFIT PAS');

{
  /*
     Le cœur. Trois consommateurs promettent de ne porter aucun montant ; le
     budget témoin en contient trois, choisis pour qu'aucun hasard ne les
     reproduise. Aucun ne doit apparaître.
  */
  const s = budgetTemoinPourEssais();
  for (const c of CONSOMMATEURS.filter((x) => !x.montantsAutorises)) {
    const p = projeter(c.id, s, tousAllumes, true)!;
    egal(`3.x « ${c.libelle} » ne laisse passer aucun montant`, fuitesDe(p.vue), []);
  }
}

{
  /*
     Et le garde-fou doit **pouvoir** échouer. Une vue fabriquée pour fuir
     est refusée : sans cela, son silence sur les vraies projections ne
     prouverait que son inertie.
  */
  const fuite = { regularite: 'bonne', montantDuLoyer: SENTINELLES.loyer };
  verifier('3.1 une vue qui fuit est détectée', fuitesDe(fuite).length > 0);
  verifier('3.2 et la fuite est nommée',
    fuitesDe(fuite).some((f) => f.startsWith('loyer')), JSON.stringify(fuitesDe(fuite)));
  verifier('3.3 le montant en euros est détecté aussi',
    fuitesDe({ phrase: 'vous avez payé 783,17 € de loyer' }).length > 0);
  verifier('3.4 et le montant signé', fuitesDe({ x: -SENTINELLES.salaire }).length > 0);
  egal('3.5 une vue propre ne déclenche rien', fuitesDe({ compte: 3, part: 0.75 }), []);
}

console.log('\n4. CE QUE CHACUN REÇOIT VRAIMENT');

{
  const s = budgetTemoinPourEssais();
  const vue = projeter('agenda', s, tousAllumes)!.vue as VueAgenda;
  /*
     Une seule : le loyer du 5 est passé, le salaire du 28 ne l'est pas. Un
     agenda qui affiche l'échéance de la semaine dernière la fait relire pour
     rien, et noie celle qui arrive.
  */
  egal('4.1 l’agenda ne voit que les échéances à venir', vue.echeances.length, 1);
  egal('4.2 et pas celle qui est passée', vue.echeances[0].jour, '2026-10-28');
  verifier('4.3 avec son montant, qui est sa promesse',
    vue.echeances[0].montant === SENTINELLES.salaire, String(vue.echeances[0].montant));
  egal('4.4 et son sens', vue.echeances[0].sens, 'ressource');
}

{
  /* Et elles sortent triées : un agenda non trié se relit en entier. */
  const base = budgetTemoinPourEssais();
  const s: SourceFinances = {
    ...base,
    arreteAu: '2026-10-01',
    occurrences: [...base.occurrences].reverse(),
  };
  const vue = projeter('agenda', s, tousAllumes)!.vue as VueAgenda;
  egal('4.4 bis les échéances sortent triées',
    vue.echeances.map((e) => e.jour), ['2026-10-05', '2026-10-28']);
  egal('4.4 ter et chacune porte le libellé de sa ligne',
    vue.echeances.map((e) => e.libelle), ['Loyer', 'Salaire']);
}

{
  const s = budgetTemoinPourEssais();
  const vue = projeter('quoiMaintenant', s, tousAllumes)!.vue as VueQuoiMaintenant;
  egal('4.5 « que faire maintenant » ne voit qu’un nombre', vue, { aRapprocher: 2 });
  egal('4.6 et un seul champ', Object.keys(vue), ['aRapprocher']);
}

{
  const s = budgetTemoinPourEssais();
  const vue = projeter('habitudes', s, tousAllumes)!.vue as VueHabitudes;
  egal('4.7 les habitudes voient la date du dernier import', vue.joursDepuisLeDernierImport, 5);
  egal('4.8 et le compte des imports', vue.importsSurTroisMois, 2);
  verifier('4.9 aucun champ ne porte un nom de montant',
    !Object.keys(vue).some((k) => /montant|euro|solde/i.test(k)), JSON.stringify(Object.keys(vue)));
}

{
  /* Absence n'est pas zéro : sans échéance échue, la part est `null`. */
  const s: SourceFinances = { ...budgetTemoinPourEssais(), occurrences: [] };
  const vue = projeter('habitudes', s, tousAllumes)!.vue as VueHabitudes;
  egal('4.10 sans échéance échue, la part rapprochée est nulle, pas 0 %',
    vue.partRapprochee, null);
}

{
  const s = budgetTemoinPourEssais();
  egal('4.11 les quêtes ne voient qu’un oui ou non',
    projeter('quetes', s, tousAllumes)!.vue, { revueDuMoisFaite: false });
  const avec: SourceFinances = { ...s, revuesFaites: ['2026-10'] };
  egal('4.12 et le mois courant compte',
    (projeter('quetes', avec, tousAllumes)!.vue as { revueDuMoisFaite: boolean }).revueDuMoisFaite,
    true);
}

{
  const s = budgetTemoinPourEssais();
  const vue = projeter('veille', s, tousAllumes)!.vue as VueVeille;
  egal('4.13 la veille ne voit que deux cadences', Object.keys(vue),
    ['sortiesParJourRecent', 'sortiesParJourDeBase']);
  verifier('4.14 la cadence récente est un nombre d’opérations par jour',
    vue.sortiesParJourRecent === 2 / FENETRE_CADENCE, String(vue.sortiesParJourRecent));
  egal('4.15 sans historique, la base est nulle et non zéro', vue.sortiesParJourDeBase, null);
  egal('4.16 et aucun montant n’y figure', fuitesDe(vue), []);
}

{
  /*
     Le point sur lequel le plan insiste : un budget massivement dépassé ne
     change **rien** à ce que la veille reçoit. On double tous les montants
     prévus — ce qui met toutes les lignes hors tolérance — et la projection
     doit être identique au caractère près.
  */
  const s = budgetTemoinPourEssais();
  const serre: SourceFinances = {
    ...s,
    lignes: s.lignes.map((l) => ({
      ...l,
      versions: l.versions.map((v) => ({ ...v, montant: Math.round(v.montant / 4) })),
    })),
    occurrences: s.occurrences.map((o) => ({ ...o, montant: Math.round(o.montant / 4) })),
  };
  egal('4.17 un budget massivement dépassé ne change rien pour la veille',
    projeter('veille', serre, tousAllumes)!.vue,
    projeter('veille', s, tousAllumes)!.vue);
  verifier('4.18 alors qu’il change tout pour l’IA',
    JSON.stringify(projeter('ia', serre, tousAllumes, true)!.vue)
      !== JSON.stringify(projeter('ia', s, tousAllumes, true)!.vue));
}

{
  /*
     Le prompt l'exige en toutes lettres : ce qui part vers l'IA est
     **agrégé par type, sans liste de vendeurs**. Une ligne déduite du réel
     porte le nom de l'enseigne, et une liste de lignes est donc une liste de
     commerçants — « Pharmacie du Centre : 240 € » dit quelque chose sur une
     santé, pas sur un budget.
  */
  const base = budgetTemoinPourEssais();
  const s: SourceFinances = {
    ...base,
    lignes: base.lignes.map((l) =>
      l.id === 'loyer' ? { ...l, libelle: 'Pharmacie Du Centre' } : l),
  };
  const resume = (projeter('ia', s, tousAllumes, true)!.vue as { resume: string }).resume;
  verifier('4.19 le résumé pour l’IA ne nomme aucune ligne',
    !resume.includes('Pharmacie'), resume);
  verifier('4.20 il agrège par catégorie', resume.includes('Logement') || resume.includes('Aucun écart'),
    resume);
  verifier('4.21 et il porte bien les totaux, qui sont sa promesse',
    resume.includes('Reste à vivre'), resume);
}

console.log('\n5. LES RÉGLAGES RELUS');

{
  egal('5.1 un enregistrement vide rend les défauts', relireLesReglages({}), REGLAGES_PAR_DEFAUT);
  egal('5.2 et une valeur absurde aussi',
    relireLesReglages({ agenda: 'oui' }).agenda, true);
  verifier('5.3 un consommateur manquant reprend son défaut, jamais « activé »',
    relireLesReglages({ agenda: false }).ia === false);
  egal('5.4 ce qui est enregistré est respecté',
    relireLesReglages({ agenda: false, ia: true }).agenda, false);
  egal('5.5 y compris pour ouvrir l’IA', relireLesReglages({ ia: true }).ia, true);
  egal('5.6 rien d’inconnu ne survit',
    Object.keys(relireLesReglages({ espion: true })).includes('espion'), false);
}

console.log('\n6. LE GARDE-FOU');

egal('6.1 le garde-fou ne trouve rien', controlerLesConsommateurs(), []);

console.log(
  echecs.length
    ? `\n\x1b[31m${reussis} essais réussis, ${echecs.length} échec(s).\x1b[0m\n` +
        echecs.map((e) => `  ✗ ${e}`).join('\n') + '\n'
    : `\n\x1b[32m${reussis} essais réussis, 0 échec.\x1b[0m\n`,
);
process.exit(echecs.length ? 1 : 0);
