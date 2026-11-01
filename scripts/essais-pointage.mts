/**
 * Essais de la politique de pointage — Finances, phase 3 bis c.
 *
 * Le critère qui domine tous les autres : **ce qui ne doit jamais être
 * pointé seul ne l'est jamais**. Un faux pointage automatique coûte de
 * l'argent mal classé dans une comparaison qu'on croit juste ; un pointage
 * refusé à tort coûte un clic.
 */
import type { OperationBancaire } from '../src/lib/odyssee/finances';
import { TOUS_LES_TYPES, typeDe } from '../src/lib/odyssee/taxonomie';
import type { Reconnaissance } from '../src/lib/odyssee/vendeurs';
import {
  APPLICATIONS_AVANT_JUGEMENT,
  FACTEUR_DE_DISPERSION,
  HISTORIQUE_VIDE,
  OCCURRENCES_POUR_HISTORIQUE,
  PLANCHER_DE_DISPERSION,
  PREREGLAGE_PAR_DEFAUT,
  SONDAGE_A_PARTIR_DE,
  anomaliesDe,
  controlerLaPolitique,
  decider,
  jugerLaRegle,
  montantHabituel,
  reglageDe,
  sondage,
  type ContexteDeDecision,
  type HistoriqueDuVendeur,
} from '../src/lib/odyssee/pointage';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

const op = (p: Partial<OperationBancaire> = {}): OperationBancaire => ({
  id: 'OP1', compteId: 'C1', jour: '2026-10-12', centimes: -4390,
  libelle: 'CB CARREFOUR CITY TOURNAY', categorie: '', transfertAvec: null,
  majLe: '2026-10-12T10:00:00.000Z', ...p,
});

const vu = (p: Partial<Reconnaissance> = {}): Reconnaissance => ({
  net: 'CARREFOUR CITY TOURNAY', nom: 'Carrefour City', typeId: 'superette',
  certitude: 'certain', source: 'dictionnaire',
  parQuoi: 'dictionnaire embarqué, motif « CARREFOUR CITY » (sur)',
  ressemblance: null, parIntermediaire: false, ...p,
});

const hist = (montants: number[], comptes = ['C1']): HistoriqueDuVendeur => ({ montants, comptes });
const ctx = (p: Partial<ContexteDeDecision> = {}): ContexteDeDecision => ({
  prereglage: 'standard', historique: HISTORIQUE_VIDE, memeJour: [], ...p,
});

console.log('\n1. LES TROIS PRÉRÉGLAGES');

{
  egal('1.1 le garde-fou ne trouve rien', controlerLaPolitique(), []);
  egal('1.2 Standard est le défaut', PREREGLAGE_PAR_DEFAUT, 'standard');
  const p = reglageDe('prudent');
  const s = reglageDe('standard');
  const r = reglageDe('rapide');
  verifier('1.3 les plafonds croissent', p.plafond < s.plafond && s.plafond < r.plafond);
  verifier('1.4 et chacun s’abaisse sans historique',
    [p, s, r].every((x) => x.plafondSansHistorique < x.plafond));
  verifier('1.5 chaque préréglage contient le précédent',
    p.typesEnAuto.every((t) => s.typesEnAuto.includes(t))
    && s.typesEnAuto.every((t) => r.typesEnAuto.includes(t)));
  egal('1.6 Standard est à 150 €', s.plafond, 15000);
  egal('1.7 et à 60 € sans historique', s.plafondSansHistorique, 6000);
}

{
  /*
     La décision qui dépasse ce que le prompt demandait : la santé reste
     hors de l'automatisme **même en Rapide**. Une pharmacie pointée sans
     que personne la regarde fait entrer un fait médical dans une catégorie.
  */
  const r = reglageDe('rapide');
  const sensibles = TOUS_LES_TYPES.filter((t) => t.sensible).map((t) => t.id);
  egal('1.8 aucun type sensible en Rapide',
    sensibles.filter((id) => r.typesEnAuto.includes(id)), []);
  verifier('1.9 ni le retrait d’espèces', !r.typesEnAuto.includes('retrait'));
  verifier('1.10 ni le commerce multi-catégories',
    !r.typesEnAuto.includes('commerce-multi-categories'));
  verifier('1.11 ni l’intermédiaire de paiement',
    !r.typesEnAuto.includes('intermediaire-de-paiement'));
  verifier('1.12 mais le supermarché en est', r.typesEnAuto.includes('supermarche'));
}

console.log('\n2. LE MONTANT HABITUEL');

{
  egal('2.1 sans historique, pas de montant habituel', montantHabituel(HISTORIQUE_VIDE), null);
  egal('2.2 deux occurrences ne suffisent pas', montantHabituel(hist([4000, 4200])), null);
  verifier('2.3 trois oui', montantHabituel(hist([4000, 4200, 4100])) !== null);
  egal('2.4 et le seuil est bien trois', OCCURRENCES_POUR_HISTORIQUE, 3);
}

{
  /*
     Le même piège que la veille : un vendeur toujours au même prix a une
     dispersion nulle, et sans plancher le moindre centime de plus serait
     aberrant.
  */
  const t = montantHabituel(hist([999, 999, 999, 999]))!;
  verifier('2.5 une dispersion nulle n’interdit pas de varier', t.haut > 999,
    JSON.stringify(t));
  egal('2.6 la médiane est juste', t.mediane, 999);
  verifier('2.7 le plancher s’applique',
    t.haut === 999 + PLANCHER_DE_DISPERSION * FACTEUR_DE_DISPERSION, String(t.haut));
  verifier('2.8 et la borne basse ne descend pas sous zéro', t.bas >= 0);
}

console.log('\n3. CE QUI N’EST JAMAIS POINTÉ SEUL');

{
  const inconnu = vu({ nom: null, typeId: null, certitude: 'inconnu', source: 'aucune', parQuoi: null });
  const d = decider(op(), inconnu, ctx());
  egal('3.1 un vendeur inconnu n’est pas pointé', d.statut, 'a-revoir');
  verifier('3.2 et l’anomalie le nomme',
    d.anomalies.some((a) => a.nature === 'vendeurInconnu'));
}

{
  const probable = vu({ certitude: 'probable', source: 'mon-historique' });
  egal('3.3 un vendeur seulement probable non plus',
    decider(op(), probable, ctx()).statut, 'a-pointer');
}

{
  const retrait = vu({ nom: 'Retrait au distributeur', typeId: 'retrait' });
  const d = decider(op({ centimes: -4000 }), retrait, ctx());
  egal('3.4 un retrait d’espèces non plus', d.statut, 'a-pointer');
  verifier('3.5 et la raison le dit',
    d.pourquoi.includes('jamais pointé automatiquement'), d.pourquoi);
}

{
  const pharma = vu({ nom: 'Pharmacie', typeId: 'pharmacie' });
  for (const p of ['prudent', 'standard', 'rapide'] as const) {
    egal(`3.x une pharmacie reste manuelle en ${p}`,
      decider(op({ centimes: -1200 }), pharma, ctx({ prereglage: p })).statut, 'a-pointer');
  }
}

{
  const d = decider(op({ centimes: -20000 }), vu(), ctx({ historique: hist([19000, 20000, 21000]) }));
  egal('3.6 au-dessus du plafond, pas de pointage', d.statut, 'a-pointer');
  /*
     LES BLANCS SONT NORMALISÉS, et c'est la leçon d'« essais:accords » : la
     phrase passe maintenant par « euros() », qui rend une espace INSÉCABLE
     avant le signe — « 150,00 € » et « 150,00 € » sont identiques à l'œil et
     différents pour « includes ». On normalise tous les blancs plutôt que
     d'en nommer un, et le littéral reste lisible.
  */
  verifier(
    '3.7 et le plafond est cité',
    d.pourquoi.replace(/\s/g, ' ').includes('150,00 €'),
    d.pourquoi,
  );
}

{
  const d = decider(op({ centimes: -9000 }), vu(), ctx());
  egal('3.8 à la première occurrence, le plafond est abaissé', d.statut, 'a-pointer');
  verifier('3.9 et le dit', d.pourquoi.includes('faute d’historique'), d.pourquoi);
  verifier('3.10 le marqueur est posé', d.surLePlafondSansHistorique);
}

{
  const memeJour = [op({ id: 'A' }), op({ id: 'B' })];
  const d = decider(op({ id: 'A' }), vu(), ctx({ memeJour }));
  egal('3.11 un doublon probable est à revoir', d.statut, 'a-revoir');
  verifier('3.12 sans affirmer que c’en est un',
    d.anomalies[0].phrase.includes('comme deux achats réels'), d.anomalies[0].phrase);
}

{
  const d = decider(op({ centimes: -12000 }), vu(), ctx({ historique: hist([4000, 4200, 4100]) }));
  egal('3.13 un montant inhabituel est à revoir', d.statut, 'a-revoir');
  verifier('3.14 et la phrase donne l’ordre de grandeur habituel',
    d.anomalies[0].phrase.includes('41,00'), d.anomalies[0].phrase);
}

console.log('\n4. CE QUI EST POINTÉ SEUL');

{
  const d = decider(op({ centimes: -4390 }), vu(), ctx({ historique: hist([4000, 4200, 4100]) }));
  egal('4.1 vendeur certain, type en auto, montant habituel', d.statut, 'pointee-auto');
  verifier('4.2 la raison cite la source', d.pourquoi.includes('dictionnaire'), d.pourquoi);
  verifier('4.3 et le nombre d’opérations', d.pourquoi.includes('3 opérations'), d.pourquoi);
  egal('4.4 sans anomalie', d.anomalies, []);
}

{
  /* Première occurrence d'une entrée sûre : pointée, mais sous le petit plafond. */
  const d = decider(op({ centimes: -3000 }), vu(), ctx());
  egal('4.5 une première occurrence sous le plafond est pointée', d.statut, 'pointee-auto');
  verifier('4.6 et elle est étiquetée comme telle', d.surLePlafondSansHistorique);
  verifier('4.7 la raison le dit', d.pourquoi.includes('première occurrence'), d.pourquoi);
}

{
  /*
     Et la règle qui prime sur tout : une opération que vous avez pointée
     n'est **jamais** modifiée, pas même par une anomalie.
  */
  const d = decider(op(), vu({ certitude: 'inconnu', nom: null, typeId: null }),
    ctx({ dejaPointeeParMoi: true }));
  egal('4.8 ce que vous avez pointé reste pointé par vous', d.statut, 'pointee-par-moi');
  verifier('4.9 et la raison le dit', d.pourquoi.includes('Aucune règle ne la modifie'));
}

console.log('\n5. LES ANOMALIES');

{
  /*
     Une hausse d'abonnement se mesure en **relatif**. La bande généreuse du
     « montant habituel » — quatre écarts médians, plancher de cinq euros —
     avalait une hausse de 13,49 € à 19,99 € : petite en euros, considérable
     en proportion, et exactement le cas que le plan veut voir. C'est cet
     essai qui l'a trouvé.
  */
  const abo = vu({ nom: 'Netflix', typeId: 'streaming-video' });
  const a = anomaliesDe(op({ centimes: -1999 }), abo, hist([1349, 1349, 1349]), []);
  verifier('5.1 une hausse d’abonnement est signalée',
    a.some((x) => x.nature === 'hausseDAbonnement'));
  verifier('5.2 avec les deux montants',
    a.find((x) => x.nature === 'hausseDAbonnement')!.phrase.includes('13,49'));
  const baisse = anomaliesDe(op({ centimes: -800 }), abo, hist([1349, 1349, 1349]), []);
  verifier('5.3 une baisse n’est pas une hausse',
    !baisse.some((x) => x.nature === 'hausseDAbonnement'));
  const arrondi = anomaliesDe(op({ centimes: -1352 }), abo, hist([1349, 1349, 1349]), []);
  verifier('5.3 bis un arrondi de trois centimes ne l’est pas non plus',
    !arrondi.some((x) => x.nature === 'hausseDAbonnement'),
    JSON.stringify(arrondi.map((x) => x.nature)));
}

{
  const frais = vu({ nom: 'Agios', typeId: 'frais-bancaires' });
  verifier('5.4 des frais bancaires sont toujours montrés',
    anomaliesDe(op(), frais, hist([300, 310, 290]), [])
      .some((x) => x.nature === 'fraisBancaires'));
}

{
  verifier('5.5 un compte inhabituel est signalé',
    anomaliesDe(op({ compteId: 'C9' }), vu(), hist([4000, 4100, 4200], ['C1']), [])
      .some((x) => x.nature === 'deviseInhabituelle'));
  egal('5.6 un compte habituel ne l’est pas',
    anomaliesDe(op({ compteId: 'C1' }), vu(), hist([4300, 4390, 4400], ['C1']), []), []);
}

console.log('\n6. LE SONDAGE');

{
  const peu = Array.from({ length: 6 }, (_, i) => ({ id: `O${i}`, centimes: -(i + 1) * 100 }));
  egal('6.1 sous dix pointages, pas de sondage', sondage(peu), []);
  egal('6.2 et le seuil est bien dix', SONDAGE_A_PARTIR_DE, 10);

  const beaucoup = Array.from({ length: 30 }, (_, i) => ({ id: `O${i}`, centimes: -(i + 1) * 137 }));
  const s = sondage(beaucoup);
  egal('6.3 cinq opérations à vérifier', s.length, 5);
  verifier('6.4 les trois plus gros en sont',
    ['O29', 'O28', 'O27'].every((id) => s.includes(id)), JSON.stringify(s));
  verifier('6.5 et deux autres, qui ne sont pas les plus gros',
    s.filter((id) => !['O29', 'O28', 'O27'].includes(id)).length === 2);
  /*
     Déterministe : deux appareils qui recalculent le même import proposent
     le même sondage, et un sondage qui change à chaque ouverture ne se
     termine jamais.
  */
  egal('6.6 le tirage est reproductible', sondage(beaucoup), s);
  egal('6.7 et ne dépend pas de l’ordre d’entrée', sondage([...beaucoup].reverse()), s);
}

console.log('\n7. UNE RÈGLE SOUVENT CORRIGÉE SE RÉTROGRADE');

{
  egal('7.1 une règle jeune n’est pas jugée', jugerLaRegle(2, 2).retrograder, false);
  egal('7.2 et le seuil est connu', APPLICATIONS_AVANT_JUGEMENT, 4);
  egal('7.3 une règle fiable reste', jugerLaRegle(12, 1).retrograder, false);
  egal('7.4 une règle souvent corrigée tombe', jugerLaRegle(12, 5).retrograder, true);
  verifier('7.5 et la phrase dit pourquoi',
    jugerLaRegle(12, 5).phrase.includes('cesse de pointer seule'));
  verifier('7.6 une correction isolée ne suffit pas', !jugerLaRegle(10, 1).retrograder);
}

console.log('\n8. LA TAXONOMIE RESTE COHÉRENTE AVEC LA POLITIQUE');

{
  /*
     Le lien entre les deux modules est le seul endroit où une protection
     peut se perdre : un type qui deviendrait pointable sans que personne
     touche à la politique.
  */
  const auto = reglageDe('rapide').typesEnAuto;
  egal('8.1 aucun type automatique n’est jamaisAuto',
    auto.filter((id) => typeDe(id)?.jamaisAuto), []);
  egal('8.2 ni sensible', auto.filter((id) => typeDe(id)?.sensible), []);
  verifier('8.3 et la politique pointe vraiment quelque chose', auto.length > 20,
    String(auto.length));
}

console.log(
  echecs.length
    ? `\n\x1b[31m${reussis} essais réussis, ${echecs.length} échec(s).\x1b[0m\n` +
        echecs.map((e) => `  ✗ ${e}`).join('\n') + '\n'
    : `\n\x1b[32m${reussis} essais réussis, 0 échec.\x1b[0m\n`,
);
process.exit(echecs.length ? 1 : 0);
