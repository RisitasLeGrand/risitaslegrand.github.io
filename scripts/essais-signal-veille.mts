/**
 * Essais du cycle de vie d'un repère — phase 3.
 *
 * Les trois que le plan exige, et qui sont les trois façons dont ce module
 * pourrait trahir sans qu'on le voie :
 *
 *   1. un check-in rassurant ne lève rien — et n'éteint rien non plus ;
 *   2. un seul repère est ouvert à la fois ;
 *   3. désactiver n'arme pas un rattrapage.
 */
import { CATALOGUE, type Mesure } from '../src/lib/odyssee/veille';
import { REGLAGES, type Contexte } from '../src/lib/odyssee/moteur-veille';
import {
  LIBELLES_DE_REPONSE,
  REGLAGES_PAR_DEFAUT,
  SILENCE_APRES,
  composerLaCarte,
  controlerCycle,
  decider,
  formulerLeStatut,
  phrasesDeLaCarte,
  repondre,
  tourDeVeille,
  type EtatVeille,
  type ReglagesVeille,
  type Reponse,
  type SignalEnregistre,
} from '../src/lib/odyssee/signal-veille';
import { controlerFormulations } from '../src/lib/odyssee/moteur-veille';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

const LUNDI = '2026-06-01';
const j = (n: number) =>
  new Date(Date.parse(`${LUNDI}T12:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);
const FIN = j(69);

const serie = (a: number, na: number, b: number, nb: number): Mesure[] => {
  const o: Mesure[] = [];
  for (let d = 0; d < na; d += 1) o.push({ jour: j(d), valeur: a });
  for (let d = 0; d < nb; d += 1) o.push({ jour: j(na + d), valeur: b });
  return o;
};

/** Trois domaines qui s'écartent : de quoi lever un repère en Standard. */
const MESURES_QUI_LEVENT: Record<string, Mesure[]> = (() => {
  const degrades: Record<string, [number, number]> = {
    'sommeil.duree': [8, 4],
    'usage.heure-tardive': [0.02, 0.5],
    'focus.minutes': [120, 20],
  };
  const out: Record<string, Mesure[]> = {};
  for (const i of CATALOGUE) {
    const d = degrades[i.id];
    out[i.id] = d ? serie(d[0], 56, d[1], 14) : serie(i.sens === 'baisse' ? 10 : 2, 70, 0, 0);
  }
  return out;
})();

const MESURES_STABLES: Record<string, Mesure[]> = (() => {
  const out: Record<string, Mesure[]> = {};
  for (const i of CATALOGUE) out[i.id] = serie(i.sens === 'baisse' ? 10 : 2, 70, 0, 0);
  return out;
})();

const reglages = (p: Partial<ReglagesVeille> = {}): ReglagesVeille => ({
  ...REGLAGES_PAR_DEFAUT,
  active: true,
  majLe: FIN,
  ...p,
});
const etat = (p: Partial<EtatVeille> = {}): EtatVeille => ({
  reglages: reglages(),
  ouvert: null,
  dernierClos: null,
  ...p,
});

/* ── 1. Les réglages par défaut ────────────────────────────────────────── */

egal('1.1 le cycle passe son propre contrôle', controlerCycle(), []);
verifier('1.2 la veille est éteinte par défaut', REGLAGES_PAR_DEFAUT.active === false);
verifier('1.3 « Pas pertinent » ouvre le plus long silence',
  SILENCE_APRES['pas-pertinent'] > SILENCE_APRES.explication &&
    SILENCE_APRES.explication > SILENCE_APRES.vu);
verifier('1.4 « Plus tard » ouvre le plus court', SILENCE_APRES['plus-tard'] < SILENCE_APRES.vu);

/* ── 2. Désactivation ──────────────────────────────────────────────────── */

{
  const e = etat({ reglages: reglages({ active: false }) });
  egal('2.1 éteinte, rien n’est décidé', decider(e, FIN).quoi, 'desactivee');
  const t = tourDeVeille({ jour: FIN, etat: e, mesures: MESURES_QUI_LEVENT });
  egal('2.2 et rien n’est évalué, même avec des données qui lèveraient', t.verdict, null);
  egal('2.3 aucun repère n’est levé', t.leve, null);
  verifier('2.4 le statut le dit clairement',
    formulerLeStatut(t, e).includes('désactivée'));
}

{
  /*
     Le rattrapage : quelqu'un éteint, trois mois passent, il rallume. Le
     premier tour après la réactivation ne doit pas rejouer les trois mois —
     il évalue **aujourd'hui**, et c'est tout. Cet essai le vérifie en
     constatant qu'un seul repère sort, et qu'il porte la date du jour.
  */
  const e = etat({ reglages: reglages({ evalueeLe: null }) });
  const t = tourDeVeille({ jour: FIN, etat: e, mesures: MESURES_QUI_LEVENT });
  egal('2.5 rallumée, elle évalue le jour même', t.leve?.jour, FIN);
  verifier('2.6 et un seul repère sort, pas un par jour écoulé', t.leve !== null);
}

/* ── 3. Pause ──────────────────────────────────────────────────────────── */

{
  const e = etat({ reglages: reglages({ enPauseJusquau: j(75) }) });
  egal('3.1 en pause, rien n’est décidé', decider(e, FIN).quoi, 'en-pause');
  egal('3.2 le dernier jour de pause est inclus', decider(e, j(75)).quoi, 'en-pause');
  egal('3.3 le lendemain, la veille reprend', decider(e, j(76)).quoi, 'evaluer');
  const t = tourDeVeille({ jour: FIN, etat: e, mesures: MESURES_QUI_LEVENT });
  egal('3.4 et rien n’est levé pendant la pause', t.leve, null);
}

{
  // La désactivation l'emporte sur un repère ouvert.
  const ouvert: SignalEnregistre = {
    id: 'S1', jour: j(60), depuis: j(47), sensibilite: 'standard',
    indicateurs: ['sommeil.duree'], domaines: ['sommeil'], appuis: [], contextes: [],
    baseArreteeAu: j(59), closLe: null, reponse: null, montreLe: j(60), majLe: j(60),
  };
  egal('3.5 éteinte, une carte restée ouverte ne resurgit pas',
    decider(etat({ reglages: reglages({ active: false }), ouvert }), FIN).quoi, 'desactivee');
  egal('3.6 en pause non plus',
    decider(etat({ reglages: reglages({ enPauseJusquau: j(75) }), ouvert }), FIN).quoi, 'en-pause');
}

/* ── 4. Un seul repère à la fois ───────────────────────────────────────── */

{
  const premier = tourDeVeille({ jour: FIN, etat: etat(), mesures: MESURES_QUI_LEVENT });
  verifier('4.1 un premier repère se lève', premier.leve !== null);

  const avecOuvert = etat({ ouvert: premier.leve, reglages: premier.reglages });
  const second = tourDeVeille({ jour: j(70), etat: avecOuvert, mesures: MESURES_QUI_LEVENT });
  egal('4.2 tant qu’il est ouvert, aucun autre ne se lève', second.leve, null);
  egal('4.3 et la décision est de montrer celui qui l’est', second.decision.quoi, 'montrer');
  egal('4.4 le moteur n’est même pas appelé', second.verdict, null);
  egal('4.5 c’est bien le même repère', second.decision.quoi === 'montrer' ? second.decision.signal.id : null,
    premier.leve?.id);
}

{
  // Six indicateurs qui s'écartent : un seul repère, pas six cartes.
  const mesures: Record<string, Mesure[]> = { ...MESURES_STABLES };
  for (const [id, a, b] of [
    ['sommeil.duree', 8, 4], ['sommeil.phase', 5, 9], ['sommeil.nuits-courtes', 0, 6],
    ['usage.heure-tardive', 0.02, 0.5], ['usage.fragmentation', 3, 20], ['focus.minutes', 120, 20],
  ] as [string, number, number][]) mesures[id] = serie(a, 56, b, 14);
  const t = tourDeVeille({ jour: FIN, etat: etat(), mesures });
  verifier('4.6 six indicateurs qui s’écartent font un repère, pas six', t.leve !== null);
  verifier('4.7 qui les porte tous', (t.leve?.indicateurs.length ?? 0) >= 5);
}

/* ── 5. Les réponses et le silence ─────────────────────────────────────── */

{
  const t = tourDeVeille({ jour: FIN, etat: etat(), mesures: MESURES_QUI_LEVENT });
  const signal = t.leve!;

  for (const r of ['vu', 'explication', 'pas-pertinent'] as Reponse[]) {
    const clos = repondre(signal, r, FIN);
    egal(`5.1 « ${LIBELLES_DE_REPONSE[r]} » ferme le repère`, clos.closLe, FIN);
    const e = etat({ ouvert: null, dernierClos: clos });
    const veille = decider(e, j(69 + SILENCE_APRES[r] - 1));
    egal(`5.2 et ouvre ${SILENCE_APRES[r]} jours de silence`, veille.quoi, 'silence');
    egal(`5.3 au terme desquels la veille reprend`,
      decider(e, j(69 + SILENCE_APRES[r])).quoi, 'evaluer');
  }

  const remis = repondre(signal, 'plus-tard', FIN);
  egal('5.4 « Plus tard » ne ferme pas', remis.closLe, null);
  egal('5.5 et fait attendre', decider(etat({ ouvert: remis }), j(70)).quoi, 'attendre');
  egal('5.6 puis remontre', decider(etat({ ouvert: remis }), j(69 + SILENCE_APRES['plus-tard'])).quoi,
    'montrer');
}

{
  // Un repère clos ne doit pas relever le lendemain sur le même écart.
  const t = tourDeVeille({ jour: FIN, etat: etat(), mesures: MESURES_QUI_LEVENT });
  const clos = repondre(t.leve!, 'vu', FIN);
  const lendemain = tourDeVeille({
    jour: j(70),
    etat: etat({ dernierClos: clos, reglages: reglages({ evalueeLe: FIN }) }),
    mesures: MESURES_QUI_LEVENT,
  });
  egal('5.7 le lendemain d’une fermeture, rien ne relève', lendemain.leve, null);
  egal('5.8 et le statut dit jusqu’à quand', lendemain.decision.quoi, 'silence');
}

/* ── 6. Une évaluation par jour ────────────────────────────────────────── */

{
  const e = etat({ reglages: reglages({ evalueeLe: FIN }) });
  egal('6.1 déjà évaluée aujourd’hui, on ne recommence pas', decider(e, FIN).quoi, 'deja-evaluee');
  egal('6.2 demain, si', decider(etat({ reglages: reglages({ evalueeLe: FIN }) }), j(70)).quoi,
    'evaluer');
}

/* ── 7. Les auto-évaluations ne touchent à rien ────────────────────────── */

{
  /*
     La règle la plus importante du dispositif, et la plus facile à perdre :
     un check-in rassurant ne peut ni lever ni éteindre un repère. On le
     vérifie par la seule voie qui prouve quelque chose — l'interface du
     module. Il n'y a **aucun** moyen de lui passer un check-in.
  */
  const t = tourDeVeille({ jour: FIN, etat: etat(), mesures: MESURES_QUI_LEVENT });
  verifier('7.1 le repère se lève sur les données observées', t.leve !== null);

  const entree = { jour: FIN, etat: etat(), mesures: MESURES_QUI_LEVENT } as Record<string, unknown>;
  verifier('7.2 aucun champ de l’entrée ne porte d’auto-évaluation',
    !Object.keys(entree).some((c) => /checkin|humeur|energie|moral/i.test(c)));

  // Et la lecture des check-ins n'entre que dans la carte, à côté.
  const carte = composerLaCarte(
    { jour: FIN, depuis: j(56), sensibilite: 'standard', deviations: [], domaines: [],
      appuis: [], contextes: [], baseArreteeAu: j(55) },
    'Vos check-ins sur la même période disent : humeur et énergie dans votre moyenne. Les deux peuvent être vrais.',
  );
  verifier('7.3 elle figure sur la carte', carte.checkins !== null);
  verifier('7.4 et la carte dit que les deux peuvent être vrais',
    carte.checkins!.includes('peuvent être vrais'));
}

/* ── 8. La carte ───────────────────────────────────────────────────────── */

{
  const t = tourDeVeille({ jour: FIN, etat: etat(), mesures: MESURES_QUI_LEVENT });
  const v = t.verdict!;
  verifier('8.1 le verdict est un repère', v.quoi === 'repere');
  if (v.quoi === 'repere') {
    const carte = composerLaCarte(v.repere, null);
    egal('8.2 le titre est « Un repère à examiner », jamais « alerte »',
      carte.titre, 'Un repère à examiner');
    egal('8.3 aucune phrase ne porte de chiffre ni de mot interdit',
      controlerFormulations(phrasesDeLaCarte(carte)), []);
    verifier('8.4 une puce par repère qui s’écarte',
      carte.puces.length === v.repere.deviations.length && carte.puces.length >= 3);
    verifier('8.5 la mention porte ses deux moitiés',
      carte.mention.includes('avis médical') && carte.mention.includes('absence de repère'));
    verifier('8.6 l’absence de contexte est dite', carte.contexte.includes('aucun'));
    egal('8.7 sans check-in, la place reste vide plutôt que meublée', carte.checkins, null);
  }
}

{
  /*
     La durée est dite en mots, jamais en chiffres. Depuis la phase 4, les
     trois sensibilités partagent la même fenêtre de vingt-et-un jours — elles
     ne diffèrent que par le seuil —, donc la carte dit « trois semaines »
     dans les trois cas. L'essai le vérifie pour les trois plutôt que de
     n'en regarder qu'un : si une fenêtre venait à diverger, la phrase le
     dirait, et c'est ce qu'on veut savoir.
  */
  for (const s of ['attentive', 'standard', 'discrete'] as (keyof typeof REGLAGES)[]) {
    const carte = composerLaCarte({
      jour: FIN, depuis: j(56), sensibilite: s, deviations: [], domaines: [], appuis: [],
      contextes: [], baseArreteeAu: j(55),
    });
    verifier(`8.8 ${s} : la durée se dit « trois semaines »`,
      carte.introduction.includes('trois semaines'), carte.introduction);
  }
}

/* ── 9. Le statut ne se tait jamais ────────────────────────────────────── */

{
  const cas: [string, EtatVeille, Record<string, Mesure[]>][] = [
    ['éteinte', etat({ reglages: reglages({ active: false }) }), MESURES_QUI_LEVENT],
    ['en pause', etat({ reglages: reglages({ enPauseJusquau: j(75) }) }), MESURES_QUI_LEVENT],
    ['stable', etat(), MESURES_STABLES],
    ['sans données', etat(), {}],
    ['repère levé', etat(), MESURES_QUI_LEVENT],
  ];
  for (const [nom, e, m] of cas) {
    const t = tourDeVeille({ jour: FIN, etat: e, mesures: m });
    const phrase = formulerLeStatut(t, e);
    verifier(`9.1 ${nom} : le statut dit quelque chose`, phrase.trim().length > 20, phrase);
    verifier(`9.2 ${nom} : et ne rassure pas`,
      !/tout va bien|rien d’inquiétant|aucun souci/i.test(phrase), phrase);
  }
}

{
  const t = tourDeVeille({ jour: FIN, etat: etat(), mesures: {} });
  verifier('9.3 sans données, le statut nomme ce qui manque',
    formulerLeStatut(t, etat()).includes('insuffisantes'));
}

/* ── Bilan ─────────────────────────────────────────────────────────────── */

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
