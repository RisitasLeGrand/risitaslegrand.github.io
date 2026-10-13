/**
 * Essais du rejeu et du recalcul identique sur deux appareils — phase 4.
 *
 * Trois propriétés, et aucune ne se relit.
 *
 *   1. **Le calcul ne dépend que des données.** Ni de l'heure qu'il est, ni du
 *      fuseau de l'appareil, ni de l'ordre dans lequel la base a été lue, ni
 *      du hasard. C'est ce qui permet à deux appareils de s'accorder, et
 *      c'est aussi ce qui permet de croire un rejeu.
 *   2. **Ce qui ne peut pas s'accorder est nommé.** Le journal d'usage ne
 *      voyage pas ; cinq indicateurs en dérivent. Une comparaison qui les
 *      inclurait montrerait un désaccord permanent, et l'on cesserait de la
 *      regarder — donc on cesserait de voir le vrai désaccord, le jour où il
 *      arriverait.
 *   3. **Le rejeu ne touche à rien.** Il déroule l'histoire et rend un
 *      résultat ; il ne lève aucun repère, n'écrit nulle part, et ne doit
 *      jamais devenir une façon détournée de recevoir des cartes en retard.
 */
import { construireLesMesures, DEPUIS_LE_JOURNAL_DUSAGE } from '../src/lib/odyssee/mesures-veille';
import { CATALOGUE, type Indicateur, type Mesure } from '../src/lib/odyssee/veille';
import { identiteDuRepere, controlerCycle } from '../src/lib/odyssee/signal-veille';
import type { Deviation, Repere } from '../src/lib/odyssee/moteur-veille';
import {
  ECHAUFFEMENT,
  comparerLesAppareils,
  comparerLesRejeux,
  controlerLeRejeu,
  domainesDuRejeu,
  empreinteDuRejeu,
  empreinteLisible,
  memeEmpreinte,
  partageable,
  phraseDuRejeu,
  rejouer,
  rejouerLesTrois,
  texteCanonique,
} from '../src/lib/odyssee/rejeu-veille';
import { vieQuiSeDegrade, vieStable } from './lib/vies-synthetiques.mts';

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

const DEBUT = '2021-01-04';
const JOURS = 365 * 3;

/* ══════════════════════════════════════════════════════════════════════════
   1. La liste de ce qui ne voyage pas est exacte
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. CE QUI VIENT DU JOURNAL D’USAGE');
{
  /*
     La liste est déclarée à la main ; elle est ici confrontée à ce que le
     collecteur produit réellement quand il ne reçoit **que** le journal
     d'usage. Sans cette confrontation, un indicateur qui changerait de source
     resterait écarté de la comparaison entre appareils sans que personne ne
     s'en aperçoive — et il serait écarté dans le mauvais sens, celui qui
     cache un désaccord réel.
  */
  const sessions = [];
  for (let d = 0; d < 40; d += 1) {
    const jour = new Date(Date.parse(`${DEBUT}T12:00:00.000Z`) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    sessions.push(
      { id: `s${d}a`, jour, debut: `${jour}T08:12:00.000Z`, fin: `${jour}T08:51:00.000Z`, majLe: '' },
      { id: `s${d}b`, jour, debut: `${jour}T19:03:00.000Z`, fin: `${jour}T20:10:00.000Z`, majLe: '' },
    );
  }
  const produits = Object.keys(construireLesMesures({ usage: sessions })).sort();
  egal('1.1 le collecteur produit exactement les indicateurs déclarés', produits,
    [...DEPUIS_LE_JOURNAL_DUSAGE].sort());

  const rythme = CATALOGUE.filter((i) => i.domaine === 'rythme').map((i) => i.id).sort();
  egal('1.2 et c’est tout le domaine « rythme », ni plus ni moins', produits, rythme);
  egal('1.3 le garde-fou ne trouve rien à redire au catalogue réel', controlerLeRejeu(), []);
}

/* ══════════════════════════════════════════════════════════════════════════
   2. L'identité d'un repère ne tient à aucun hasard
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n2. L’IDENTITÉ D’UN REPÈRE');
{
  const d = (indicateur: string, ecarts: number): Deviation => ({
    indicateur,
    domaine: 'sommeil',
    libelle: indicateur,
    ecarts,
    seuilApplique: 2.5,
    devie: true,
    contextes: [],
    joursRetenus: 21,
  });
  const socle: Repere = {
    jour: '2026-10-13',
    depuis: '2026-09-23',
    sensibilite: 'standard',
    deviations: [d('sommeil.duree', 3), d('focus.minutes', 3)],
    domaines: ['sommeil', 'engagement'],
    appuis: [],
    contextes: [],
    baseArreteeAu: '2026-09-22',
  };

  verifier('2.1 deux calculs du même repère donnent le même identifiant',
    identiteDuRepere(socle) === identiteDuRepere({ ...socle }));
  verifier('2.2 l’ordre des déviations ne le change pas',
    identiteDuRepere(socle) ===
      identiteDuRepere({ ...socle, deviations: [...socle.deviations].reverse() }));
  verifier('2.3 un autre jour donne un autre identifiant',
    identiteDuRepere(socle) !== identiteDuRepere({ ...socle, jour: '2026-10-14' }));
  verifier('2.4 un autre indicateur aussi',
    identiteDuRepere(socle) !==
      identiteDuRepere({ ...socle, deviations: [d('sommeil.duree', 3), d('agenda.densite', 3)] }));
  verifier('2.5 une autre sensibilité aussi',
    identiteDuRepere(socle) !== identiteDuRepere({ ...socle, sensibilite: 'attentive' }));
  verifier('2.6 l’identifiant porte son jour en clair, et se trie donc comme une date',
    identiteDuRepere(socle).startsWith('vr-2026-10-13-'));
  egal('2.7 le cycle de vie ne se contredit pas', controlerCycle(), []);
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Le calcul ne dépend que des données
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n3. LE CALCUL NE DÉPEND QUE DES DONNÉES');
const vie = vieStable({ debut: DEBUT, jours: JOURS, graine: 7 });
{
  const a = rejouer({ mesures: vie });
  const b = rejouer({ mesures: vie });
  egal('3.1 deux rejeux de la même vie donnent la même trace',
    texteCanonique(a), texteCanonique(b));

  // L'ordre des clés d'un objet suit l'histoire de l'objet, pas son contenu :
  // deux appareils qui ont lu leur base dans un autre ordre doivent conclure
  // la même chose.
  const inverse: Record<string, Mesure[]> = {};
  for (const id of Object.keys(vie).reverse()) inverse[id] = vie[id];
  egal('3.2 l’ordre des indicateurs dans l’objet ne change rien',
    texteCanonique(rejouer({ mesures: inverse })), texteCanonique(a));

  // Et l'ordre des mesures à l'intérieur d'une série non plus : IndexedDB ne
  // promet pas un ordre de lecture, et le promettre serait une dépendance
  // qu'aucun essai ne surveillerait.
  const melange: Record<string, Mesure[]> = {};
  for (const [id, serie] of Object.entries(vie)) melange[id] = [...serie].reverse();
  egal('3.3 l’ordre des jours à l’intérieur d’une série non plus',
    texteCanonique(rejouer({ mesures: melange })), texteCanonique(a));
}

{
  /*
     Le fuseau de l'appareil. La canarie est indispensable : si le changement
     de fuseau n'avait aucun effet sur le processus, l'essai passerait sans
     rien éprouver, et c'est le genre de garde qui rassure à tort pendant des
     années.
  */
  const sessions = [];
  for (let d = 0; d < 40; d += 1) {
    const jour = new Date(Date.parse(`${DEBUT}T12:00:00.000Z`) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    sessions.push({ id: `s${d}`, jour, debut: `${jour}T23:40:00.000Z`, fin: `${jour}T23:59:00.000Z`, majLe: '' });
  }
  const avant = process.env.TZ;
  process.env.TZ = 'Europe/Paris';
  const heureParis = new Date('2026-06-01T12:00:00.000Z').getHours();
  const paris = JSON.stringify(construireLesMesures({ usage: sessions }));
  process.env.TZ = 'Pacific/Auckland';
  const heureAuckland = new Date('2026-06-01T12:00:00.000Z').getHours();
  const auckland = JSON.stringify(construireLesMesures({ usage: sessions }));
  process.env.TZ = avant;

  verifier('3.4 canarie : le fuseau du processus a bien changé',
    heureParis !== heureAuckland, `${heureParis} h ici, ${heureAuckland} h là`);
  verifier('3.5 et le collecteur rend pourtant les mêmes séries', paris === auckland);
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Deux appareils
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n4. DEUX APPAREILS');
{
  const { mesures: partagees, ecartes } = partageable(vie);
  egal('4.1 la part partageable écarte exactement les cinq indicateurs d’usage',
    [...ecartes].sort(), [...DEPUIS_LE_JOURNAL_DUSAGE].sort());
  verifier('4.2 et garde tout le reste',
    Object.keys(partagees).length === Object.keys(vie).length - DEPUIS_LE_JOURNAL_DUSAGE.length);
}

{
  /*
     Le cas normal : deux appareils synchronisés, dont les journaux d'usage
     diffèrent puisqu'ils ne voyagent pas. Aucun défaut ne doit apparaître.
  */
  const autreUsage = vieStable({ debut: DEBUT, jours: JOURS, graine: 99 });
  const appareilB: Record<string, Mesure[]> = { ...vie };
  for (const id of DEPUIS_LE_JOURNAL_DUSAGE) appareilB[id] = autreUsage[id];

  const c = await comparerLesAppareils(vie, appareilB);
  egal('4.3 deux appareils synchronisés ne montrent aucun défaut', c.defauts, []);
  verifier('4.4 et leurs empreintes se lisent comme identiques',
    c.identiques && memeEmpreinte(c.empreintes[0], c.empreintes[1]));
  egal('4.5 ce qui est écarté de la comparaison est nommé',
    [...c.ecartes].sort(), [...DEPUIS_LE_JOURNAL_DUSAGE].sort());
}

{
  /*
     Un journal d'usage qui fait lever un repère d'un seul côté : la
     comparaison doit l'imputer au journal d'usage, et surtout pas le
     présenter comme un défaut. C'est le classement que la première version
     ratait — un repère exige trois domaines, donc sa liste d'indicateurs
     déborde toujours du rythme, et un classement par indicateur l'aurait
     compté comme une non-reproductibilité.
  */
  const degradeParLUsage = vieQuiSeDegrade(400, 8, { debut: DEBUT, jours: JOURS, graine: 7 });
  const appareilB: Record<string, Mesure[]> = { ...vie };
  for (const id of DEPUIS_LE_JOURNAL_DUSAGE) appareilB[id] = degradeParLUsage[id];

  const c = await comparerLesAppareils(vie, appareilB, { sensibilite: 'attentive' });
  egal('4.6 un désaccord dû au seul journal d’usage n’est pas un défaut', c.defauts, []);
  verifier('4.7 il est bien vu, et imputé à ce qui le cause',
    c.imputablesAuJournalDUsage.length > 0,
    JSON.stringify(c.imputablesAuJournalDUsage));
}

{
  /*
     Et l'inverse : un désaccord sur une source qui voyage. Il n'a aucune
     excuse, et doit sortir en défaut.
  */
  const degradee = vieQuiSeDegrade(400, 8, { debut: DEBUT, jours: JOURS, graine: 7 });
  const appareilB: Record<string, Mesure[]> = { ...degradee };
  for (const id of DEPUIS_LE_JOURNAL_DUSAGE) appareilB[id] = vie[id];

  const c = await comparerLesAppareils(vie, appareilB);
  verifier('4.8 un désaccord sur une source synchronisée sort en défaut',
    c.defauts.length > 0, JSON.stringify(c.defauts));
  verifier('4.9 et les deux empreintes diffèrent',
    !memeEmpreinte(c.empreintes[0], c.empreintes[1]));
}

{
  // Les empreintes : seize signes, et la comparaison porte sur ce qui s'affiche.
  const a = await empreinteDuRejeu(rejouer({ mesures: partageable(vie).mesures }));
  const b = await empreinteDuRejeu(rejouer({ mesures: partageable(vie).mesures }));
  verifier('4.10 deux empreintes du même rejeu sont identiques', memeEmpreinte(a, b));
  verifier('4.11 elle s’affiche en quatre groupes de quatre',
    /^[0-9A-F]{4}( · [0-9A-F]{4}){3}$/.test(empreinteLisible(a)), empreinteLisible(a));

  const autre = await empreinteDuRejeu(
    rejouer({ mesures: partageable(vie).mesures, sensibilite: 'attentive' }),
  );
  verifier('4.12 deux réglages différents ne se confondent pas', !memeEmpreinte(a, autre));

  const c = comparerLesRejeux(
    rejouer({ mesures: partageable(vie).mesures }),
    rejouer({ mesures: partageable(vie).mesures, sensibilite: 'attentive' }),
  );
  verifier('4.13 et la comparaison nue le dit au lieu de comparer l’incomparable',
    c.divergences.some((d) => d.quoi.includes('sensibilités différentes')));
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Le rejeu lui-même
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n5. LE REJEU');
{
  const r = rejouer({ mesures: vie });
  verifier('5.1 il part après l’échauffement, pas au premier jour',
    r.debut === new Date(Date.parse(`${DEBUT}T12:00:00.000Z`) + ECHAUFFEMENT * 86_400_000)
      .toISOString().slice(0, 10), r.debut);
  verifier('5.2 aucun repère n’est levé avant ce jour-là',
    r.reperes.every((x) => x.jour >= r.debut));
  verifier('5.3 une vie stable ne lève presque rien sur trois ans',
    r.reperes.length <= 1, `${r.reperes.length} repère(s)`);
  verifier('5.4 et la veille a bien eu de quoi se prononcer', r.evalues > 500, `${r.evalues}`);

  const degradee = vieQuiSeDegrade(400, 8, { debut: DEBUT, jours: JOURS, graine: 7 });
  const d = rejouer({ mesures: degradee });
  verifier('5.5 une dégradation franche finit par se voir', d.reperes.length >= 1);
  verifier('5.6 et pas avant qu’elle ne commence',
    d.reperes.every((x) => x.jour >= '2022-02-08'), JSON.stringify(d.reperes.map((x) => x.jour)));
  verifier('5.7 les domaines du rejeu sont nommés et comptés',
    domainesDuRejeu(d).length >= 1 && domainesDuRejeu(d)[0].libelle.length > 0);

  const phrase = phraseDuRejeu(rejouer({ mesures: vie }));
  verifier('5.8 la phrase ne présente jamais un compte comme un taux',
    !/par an|\/ ?an|taux/i.test(phrase), phrase);
  verifier('5.9 et quand rien n’a été levé, elle le dit sans rassurer',
    !phraseDuRejeu({ ...r, reperes: [] }).includes('tout va bien') &&
      phraseDuRejeu({ ...r, reperes: [] }).includes('ne veut pas dire'));

  // Deux rejeux de suite : aucune trace laissée nulle part.
  egal('5.10 le rejeu est pur — deux appels donnent le même résultat',
    JSON.stringify(rejouer({ mesures: vie })), JSON.stringify(r));

  const trois = rejouerLesTrois({ mesures: vie });
  egal('5.11 les trois sensibilités sont rejouées, dans l’ordre',
    trois.map((x) => x.sensibilite), ['discrete', 'standard', 'attentive']);
  verifier('5.12 la plus sensible ne lève jamais moins que la plus discrète',
    trois[2].reperes.length >= trois[0].reperes.length,
    JSON.stringify(trois.map((x) => x.reperes.length)));
}

{
  // Les bords : pas de données, une seule journée, une fin avant le début.
  egal('5.13 sans mesure, le rejeu rend un résultat vide plutôt qu’une erreur',
    rejouer({ mesures: {} }).reperes, []);
  egal('5.14 et la phrase le dit',
    phraseDuRejeu(rejouer({ mesures: {} })).includes('pas encore assez d’historique'), true);
  egal('5.15 un historique plus court que l’échauffement ne rejoue rien',
    rejouer({ mesures: vie, debut: '2021-01-04', fin: '2021-02-01' }).jours, 0);
}

/* ══════════════════════════════════════════════════════════════════════════
   6. Le garde-fou se déclenche quand il doit
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n6. LE GARDE-FOU');
{
  /*
     Un garde qu'on ne peut pas faire échouer ne prouve rien. On fabrique donc
     le cas qu'il surveille : un indicateur du rythme qui ne viendrait plus du
     journal d'usage, et que la comparaison entre appareils continuerait
     pourtant d'écarter.
  */
  const catalogue: Indicateur[] = [
    ...CATALOGUE,
    {
      ...CATALOGUE.find((i) => i.id === 'jour.amplitude')!,
      id: 'rythme.depuis-une-montre',
    },
  ];
  const problemes = controlerLeRejeu(catalogue);
  verifier('6.1 un indicateur de rythme venu d’ailleurs est signalé',
    problemes.some((p) => p.includes('rythme.depuis-une-montre')), JSON.stringify(problemes));

  const inconnu = CATALOGUE.filter((i) => i.id !== 'usage.duree');
  verifier('6.2 un indicateur déclaré mais retiré du catalogue est signalé',
    controlerLeRejeu(inconnu).some((p) => p.includes('usage.duree')));
}

/* ── Bilan ─────────────────────────────────────────────────────────────── */

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
