/**
 * Essais des trois échelles — WHO-5, PHQ-9, GAD-7.
 *
 * Ce qu'ils garantissent, et qu'une relecture ne garantit pas :
 *
 *   1. les textes portent l'apostrophe typographique du document, et aucune
 *      apostrophe droite — c'est le détail par lequel on reconnaît une
 *      traduction réécrite de mémoire ;
 *   2. un questionnaire incomplet n'a **pas** de score, et surtout pas un
 *      score partiel, qui serait plus bas donc plus rassurant ;
 *   3. aucun palier n'apparaît sans sa provenance, ni traduit en français ;
 *   4. le WHO-5 n'a pas de palier, et le contrôle refuse qu'on lui en mette ;
 *   5. une étiquette de palier qui n'est pas celle du manuel est marquée comme
 *      telle, pour que l'interface ne l'attribue pas à la source.
 */
import {
  ECHELLES,
  GAD7,
  PHQ9,
  WHO5,
  controlerEchelles,
  echelle,
  noter,
  type Echelle,
} from '../src/lib/odyssee/echelles';
import { MOTS_INTERDITS, controlerVocabulairePsyche } from '../src/lib/odyssee/psyche';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

/* ── 1. Le contrôle, et ce qu'il attrape ──────────────────────────────── */

egal('1.1 les trois échelles passent leur contrôle', controlerEchelles(), []);
egal('1.2 il y en a trois', ECHELLES.length, 3);

const abime = (e: Echelle, modif: Partial<Echelle>): Echelle => ({ ...e, ...modif });

verifier('1.3 un palier sans provenance est refusé',
  controlerEchelles([abime(PHQ9, { origineDesPaliers: null })]).some((p) => p.includes('d’où')));
verifier('1.4 une provenance qui tait l’origine anglaise est refusée',
  controlerEchelles([abime(PHQ9, { origineDesPaliers: 'Table 4 du manuel.' })])
    .some((p) => p.includes('anglaise')));
verifier('1.5 un palier traduit en français est refusé',
  controlerEchelles([abime(PHQ9, {
    paliers: [{ de: 0, a: 27, etiquette: 'Modéré' }],
  })]).some((p) => p.includes('traduit')));
verifier('1.6 un palier posé sur le WHO-5 est refusé',
  controlerEchelles([abime(WHO5, {
    paliers: [{ de: 0, a: 100, etiquette: 'Low' }],
    origineDesPaliers: 'tranches anglaises',
  })]).some((p) => p.includes('WHO-5')));
verifier('1.7 un compte d’items faux est refusé',
  controlerEchelles([abime(GAD7, { items: GAD7.items.slice(0, 6) })]).some((p) => p.includes('items')));
verifier('1.8 un trou entre deux paliers est refusé',
  controlerEchelles([abime(GAD7, {
    paliers: [{ de: 0, a: 4, etiquette: 'A' }, { de: 6, a: 21, etiquette: 'B' }],
  })]).some((p) => p.includes('trou')));
verifier('1.9 une attribution vide est refusée',
  controlerEchelles([abime(GAD7, { attribution: '  ' })]).some((p) => p.includes('attribue')));

/* ── 2. Les textes sont ceux du document ──────────────────────────────── */

{
  /*
     Le relevé l'établit par comptage : les documents n'emploient que
     l'apostrophe typographique. Une apostrophe droite trahirait un texte
     retapé plutôt que repris.
  */
  const tout = ECHELLES.flatMap((e) => [e.titre, e.consigne, e.periode, ...e.items,
    ...e.options.map((o) => o.libelle)]).join(' ');
  verifier('2.1 aucune apostrophe droite dans les textes repris', !tout.includes("'"), 
    tout.split("'").slice(0, 2).join(" ' "));
  verifier('2.2 et l’apostrophe typographique est bien présente', tout.includes('’'));
}

egal('2.3 le WHO-5 a cinq items', WHO5.items.length, 5);
egal('2.4 le PHQ-9 en a neuf', PHQ9.items.length, 9);
egal('2.5 le GAD-7 en a sept', GAD7.items.length, 7);

verifier('2.6 la majuscule de « Tout le Temps » est celle du document',
  WHO5.options.some((o) => o.libelle === 'Tout le Temps'));
verifier('2.7 le neuvième item du PHQ-9 est bien celui du document',
  PHQ9.items[8].startsWith('Penser qu’il vaudrait mieux mourir'));
verifier('2.8 le cinquième du GAD-7 porte la tournure du document, telle quelle',
  GAD7.items[4] === 'Une agitation telle qu’il est difficile à tenir en place');
verifier('2.9 la consigne dit « selon quelle fréquence », et non « à quelle fréquence »',
  PHQ9.consigne.includes('selon quelle fréquence') && GAD7.consigne.includes('selon quelle fréquence'));
verifier('2.10 les options du PHQ et du GAD sont « Jamais » à « Presque tous les jours »',
  PHQ9.options.map((o) => o.libelle).join('|') ===
    'Jamais|Plusieurs jours|Plus de la moitié du temps|Presque tous les jours');

/* ── 3. Le score ──────────────────────────────────────────────────────── */

egal('3.1 le WHO-5 multiplie par quatre', noter(WHO5, [5, 5, 5, 5, 5]).score, 100);
egal('3.2 et vaut zéro quand tout est à zéro', noter(WHO5, [0, 0, 0, 0, 0]).score, 0);
egal('3.3 un WHO-5 moyen', noter(WHO5, [3, 3, 3, 3, 3]).score, 60);
egal('3.4 le PHQ-9 va jusqu’à vingt-sept', noter(PHQ9, Array(9).fill(3)).score, 27);
egal('3.5 le GAD-7 jusqu’à vingt-et-un', noter(GAD7, Array(7).fill(3)).score, 21);

{
  /*
     La règle qui compte. Un item sans réponse ne vaut pas zéro : compter les
     non-réponses comme des zéros rendrait un score plus bas, donc plus
     rassurant, sur la seule foi de ce qui n'a pas été rempli.
  */
  const r = noter(PHQ9, [3, 3, 3, null, 3, 3, 3, 3, 3]);
  egal('3.6 un questionnaire incomplet n’a pas de score', r.score, null);
  egal('3.7 et pas davantage de palier', r.palier, null);
  egal('3.8 mais il dit combien d’items manquent', r.sansReponse, 1);
}

egal('3.9 un nombre de réponses différent du nombre d’items ne donne rien',
  noter(GAD7, [1, 1, 1]).score, null);

/* ── 4. Les paliers, cités et bornés ──────────────────────────────────── */

{
  const palier = (n: number) => noter(PHQ9, [n, 0, 0, 0, 0, 0, 0, 0, 0]).palier?.etiquette ?? null;
  // Un seul item suffit à placer le score entre 0 et 3 : on passe par des sommes.
  const score = (s: number) => {
    const r: number[] = [];
    let reste = s;
    for (let i = 0; i < 9; i += 1) { const v = Math.min(3, reste); r.push(v); reste -= v; }
    return noter(PHQ9, r).palier?.etiquette ?? null;
  };
  egal('4.1 PHQ-9, score 4 → None-minimal', score(4), 'None-minimal');
  egal('4.2 score 5 → Mild, à la borne exacte', score(5), 'Mild');
  egal('4.3 score 9 → Mild encore', score(9), 'Mild');
  egal('4.4 score 10 → Moderate', score(10), 'Moderate');
  /*
     La casse est celle de la table 4 du manuel, qui écrit « Moderately
     Severe » sur deux lignes. La phrase en prose du manuel écrit la même
     chose en minuscules ; comme le module cite la table, c'est la casse de
     la table qui fait foi. Le relevé portait la minuscule : corrigé.
  */
  egal('4.5 score 15 → Moderately Severe, casse de la table 4', score(15), 'Moderately Severe');
  egal('4.6 score 20 → Severe', score(20), 'Severe');
  egal('4.7 score 27 → Severe', score(27), 'Severe');
  verifier('4.8 le palier d’un score nul existe', palier(0) === 'None-minimal');
}

{
  const score = (s: number) => {
    const r: number[] = [];
    let reste = s;
    for (let i = 0; i < 7; i += 1) { const v = Math.min(3, reste); r.push(v); reste -= v; }
    return noter(GAD7, r).palier?.etiquette ?? null;
  };
  egal('4.9 GAD-7, score 4 → sous le point de coupure', score(4), 'Below cutpoint');
  egal('4.10 score 10 → Moderate, le seuil que le manuel dit justifier une suite', score(10), 'Moderate');
  egal('4.11 score 21 → Severe', score(21), 'Severe');
  egal('4.12 le GAD-7 n’a que quatre tranches, pas cinq', GAD7.paliers.length, 4);
}

egal('4.13 le WHO-5 n’a aucun palier', WHO5.paliers.length, 0);
egal('4.14 et un score complet n’en produit pas', noter(WHO5, [2, 2, 2, 2, 2]).palier, null);

/* ── 4 bis. L'étiquette que le manuel ne donne pas ────────────────────── */

{
  /*
     Le manuel nomme les trois tranches qui suivent ses points de coupure ;
     il ne nomme pas celle d'en dessous. L'interface annonçait pourtant « la
     tranche que le manuel nomme » pour les neuf tranches des deux échelles :
     juste huit fois, faux une fois, et invisible au milieu des huit autres.

     D'où le drapeau `deduit`, et ces essais : une étiquette de Cyclades ne
     doit jamais pouvoir se faire passer pour une citation.
  */
  const basse = GAD7.paliers.find((p) => p.de === 0)!;
  verifier('4.15 la tranche basse du GAD-7 est marquée déduite', basse.deduit === true);
  egal('4.16 son étiquette reste inchangée', basse.etiquette, 'Below cutpoint');

  const citees = [
    ...PHQ9.paliers,
    ...GAD7.paliers.filter((p) => p.de !== 0),
  ];
  verifier(
    '4.17 toutes les autres tranches sont des citations, non des déductions',
    citees.every((p) => !p.deduit),
    `déduites à tort : ${citees.filter((p) => p.deduit).map((p) => p.etiquette).join(', ')}`,
  );

  verifier(
    '4.18 l’origine du GAD-7 dit que l’étiquette basse est déduite',
    /déduit/i.test(GAD7.origineDesPaliers ?? ''),
  );

  // Et le contrôle attrape une déduction qu'on aurait oublié d'annoncer.
  const truque: Echelle = {
    ...GAD7,
    origineDesPaliers: 'Points de coupure du manuel, établis sur la version anglaise.',
  };
  const trouves = controlerEchelles([truque]);
  verifier(
    '4.19 une étiquette déduite sans mention est refusée',
    trouves.some((m) => /déduite\(s\)/.test(m)),
    `obtenu : ${JSON.stringify(trouves)}`,
  );

  // À l'inverse, une tranche citée n'a pas besoin de cette mention.
  egal(
    '4.20 le PHQ-9, dont aucune tranche n’est déduite, passe sans cette mention',
    controlerEchelles([PHQ9]),
    [],
  );
}

/* ── 5. Le vocabulaire de Psyché reste tenu ───────────────────────────── */

{
  /*
     Un résultat qu'il faut consigner, parce qu'il corrige un raisonnement.

     On pouvait croire que citer les paliers en anglais suffisait à les tenir
     hors du vocabulaire interdit de Psyché. C'est faux au niveau du contrôle
     automatique : `controlerVocabulairePsyche` retire les accents avant de
     comparer, donc « sévère » devient « severe » — et heurte l'étiquette
     anglaise `Severe`. L'essai le constate plutôt que de le contourner.

     L'anglais protège le **lecteur**, qui voit une citation là où un mot
     français se lirait comme le jugement de l'application. Il ne protège pas
     la machine. Ce qui protège la machine, c'est `controlerEchelles()` : les
     étiquettes doivent rester dans la langue de la source et porter leur
     provenance, et c'est cette règle-là qui est vérifiée.

     Conséquence pratique : `controlerVocabulairePsyche` ne doit **pas** être
     appliqué aux étiquettes de paliers. Il reste appliqué à tout ce que
     Cyclades compose de son propre chef.
  */
  const etiquettes = ECHELLES.flatMap((e) => e.paliers.map((p) => p.etiquette));
  verifier('5.1 le contrôle de Psyché heurte bien les étiquettes anglaises, et c’est attendu',
    controlerVocabulairePsyche(etiquettes).length > 0);
  verifier('5.2 les trois graduations françaises restent interdites ailleurs',
    ['léger', 'modéré', 'sévère'].every((m) => MOTS_INTERDITS.includes(m)));
  verifier('5.2 bis mais aucune étiquette n’est écrite en français',
    etiquettes.every((e) => !/[àâäéèêëîïôöùûüç]/i.test(e)), etiquettes.join(', '));
}

{
  // Les provenances, elles, doivent porter la réserve, en français.
  for (const e of ECHELLES.filter((x) => x.origineDesPaliers)) {
    verifier(`5.3 ${e.id} : la provenance dit que la traduction n’est pas validée`,
      /valid/.test(e.origineDesPaliers!), e.origineDesPaliers ?? '');
  }
  verifier('5.4 le PHQ-9 rappelle que la question de gêne ne compte pas dans le score',
    PHQ9.reserve.includes('n’entre pas dans le calcul'));
  verifier('5.5 et qu’un entretien clinique ne se remplace pas',
    PHQ9.reserve.includes('entretien clinique'));
  verifier('5.6 le WHO-5 dit que la version anglaise seule fait foi',
    WHO5.reserve.includes('anglaise seule contraignante'));
}

egal('5.7 une échelle inconnue lève plutôt que de rendre n’importe quoi',
  (() => { try { echelle('xxx' as never); return 'rien'; } catch { return 'levée'; } })(), 'levée');

/* ── Bilan ─────────────────────────────────────────────────────────────── */

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
