/**
 * Essais du collecteur de mesures — phase 3.
 *
 * Ce qu'il doit garantir, et qu'une relecture ne garantit pas :
 *
 *   1. un jour sans donnée **n'apparaît pas**, et ne vaut surtout pas zéro ;
 *   2. l'irrégularité monte quand le rythme se disperse, **même à moyenne
 *      constante** — sans quoi elle mesurerait le niveau, pas la dispersion ;
 *   3. le coucher est ancré à 18 h, donc monotone à travers minuit ;
 *   4. ce qui n'est pas collecté est déclaré, et la déclaration est juste.
 */
import { CATALOGUE } from '../src/lib/odyssee/veille';
import {
  JOURS_ROULANTS,
  NON_COLLECTES,
  construireLesMesures,
  heuresDepuisLAncre,
} from '../src/lib/odyssee/mesures-veille';
import type { Session } from '../src/lib/odyssee/usage';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
const presque = (titre: string, obtenu: number | undefined, attendu: number, marge = 0.01) =>
  verifier(titre, obtenu !== undefined && Math.abs(obtenu - attendu) < marge,
    `obtenu ${obtenu}, attendu ${attendu} à ${marge} près`);

const LUNDI = '2026-06-01';
const j = (n: number) =>
  new Date(Date.parse(`${LUNDI}T12:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Un instant à l'heure dite **à Paris**, le jour dit.
 *
 * Le décalage est écrit en clair plutôt que laissé au fuseau du conteneur :
 * ces essais tournaient en UTC, et une session de 3 h construite en UTC
 * arrivait à 5 h à Paris, donc hors de la plage nocturne. L'essai échouait
 * pour une raison qui n'avait rien à voir avec ce qu'il vérifiait.
 *
 * Juin 2026 est en heure d'été : UTC+2.
 */
const a = (jour: string, heure: number) => {
  const h = Math.floor(heure);
  const m = Math.round((heure - h) * 60);
  return new Date(
    `${jour}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000+02:00`,
  ).toISOString();
};

/* ── 1. L'ancre du coucher ─────────────────────────────────────────────── */

presque('1.1 23 h vaut cinq heures depuis l’ancre', heuresDepuisLAncre(a(j(0), 23)), 5);
presque('1.2 1 h du matin en vaut sept', heuresDepuisLAncre(a(j(1), 1)), 7);
presque('1.3 3 h en vaut neuf', heuresDepuisLAncre(a(j(1), 3)), 9);
presque('1.4 18 h vaut zéro', heuresDepuisLAncre(a(j(0), 18)), 0);
verifier('1.5 la grandeur est monotone à travers minuit',
  heuresDepuisLAncre(a(j(0), 23)) < heuresDepuisLAncre(a(j(1), 1)) &&
    heuresDepuisLAncre(a(j(1), 1)) < heuresDepuisLAncre(a(j(1), 3)));

/* ── 2. Le sommeil ─────────────────────────────────────────────────────── */

{
  // Quinze nuits : coucher à 23 h, lever à 7 h.
  const nuits = Array.from({ length: 15 }, (_, d) => ({
    jour: j(d + 1),
    coucher: a(j(d), 23),
    lever: a(j(d + 1), 7),
  }));
  const m = construireLesMesures({ nuits });
  presque('2.1 la durée de sommeil fait huit heures', m['sommeil.duree']?.[0]?.valeur, 8);
  egal('2.2 une mesure par nuit', m['sommeil.duree']?.length, 15);
  presque('2.3 le coucher vaut cinq, depuis l’ancre', m['sommeil.phase']?.[0]?.valeur, 5);
  verifier('2.4 un rythme régulier donne une irrégularité nulle',
    (m['sommeil.irregularite'] ?? []).every((x) => x.valeur === 0));
  verifier('2.5 aucune nuit courte', (m['sommeil.nuits-courtes'] ?? []).every((x) => x.valeur === 0));
}

{
  /*
     L'essai qui compte : la **moyenne ne bouge pas**, seule la dispersion
     change. Un coucher alternant 21 h et 1 h a la même médiane que 23 h tous
     les soirs. Si l'irrégularité ne montait pas ici, elle mesurerait le
     niveau et non la dispersion — et c'est pourtant la dispersion que la
     littérature fait remonter le plus nettement.
  */
  const regulier = Array.from({ length: 15 }, (_, d) => ({
    jour: j(d + 1), coucher: a(j(d), 23), lever: a(j(d + 1), 7),
  }));
  const disperse = Array.from({ length: 15 }, (_, d) => ({
    jour: j(d + 1),
    coucher: d % 2 ? a(j(d), 21) : a(j(d + 1), 1),
    lever: a(j(d + 1), 7),
  }));
  const r = construireLesMesures({ nuits: regulier });
  const dsp = construireLesMesures({ nuits: disperse });

  const moyenne = (xs: { valeur: number }[]) => xs.reduce((s, x) => s + x.valeur, 0) / xs.length;
  presque('2.6 les deux rythmes ont la même heure de coucher médiane',
    moyenne(dsp['sommeil.phase']!), moyenne(r['sommeil.phase']!), 0.3);
  verifier('2.7 mais l’irrégularité du second est bien plus haute',
    moyenne(dsp['sommeil.irregularite']!) > moyenne(r['sommeil.irregularite']!) + 1,
    `${moyenne(dsp['sommeil.irregularite']!).toFixed(2)} contre ${moyenne(r['sommeil.irregularite']!).toFixed(2)}`);
}

/* ── 3. L'absence n'est pas un zéro ────────────────────────────────────── */

{
  // Quinze jours, mais une nuit sur trois seulement est notée.
  const nuits = Array.from({ length: 15 }, (_, d) => d)
    .filter((d) => d % 3 === 0)
    .map((d) => ({ jour: j(d + 1), coucher: a(j(d), 23), lever: a(j(d + 1), 7) }));
  const m = construireLesMesures({ nuits });
  egal('3.1 seules les nuits notées produisent une mesure', m['sommeil.duree']?.length, 5);
  verifier('3.2 et aucune ne vaut zéro', (m['sommeil.duree'] ?? []).every((x) => x.valeur === 8));
}

{
  const m = construireLesMesures({});
  egal('3.3 sans aucune source, aucun indicateur n’est fabriqué', Object.keys(m).length, 0);
}

{
  // Un trou de dix jours au milieu d'une série roulante.
  const seances = [
    ...Array.from({ length: 5 }, (_, d) => ({ jour: j(d), terminee: true })),
    ...Array.from({ length: 5 }, (_, d) => ({ jour: j(d + 20), terminee: true })),
  ];
  const m = construireLesMesures({ seances });
  const jours = (m['sport.frequence'] ?? []).map((x) => x.jour);
  verifier('3.4 le trou ne produit pas de jours à zéro séance',
    !jours.includes(j(14)), jours.join(' '));
  verifier('3.5 mais la fenêtre roulante déborde de six jours après la dernière séance',
    jours.includes(j(10)) && !jours.includes(j(11)));
}

/* ── 4. Les fenêtres roulantes ─────────────────────────────────────────── */

{
  const seances = Array.from({ length: 21 }, (_, d) => ({ jour: j(d), terminee: d % 2 === 0 }));
  const m = construireLesMesures({ seances });
  const f = m['sport.frequence']!;
  presque(`4.1 une séance un jour sur deux fait quatre par ${JOURS_ROULANTS} jours`,
    f.at(-1)?.valeur, 4, 1.01);
  const ab = m['sport.abandons']!;
  presque('4.2 et la part d’abandons tourne autour de la moitié', ab.at(-1)?.valeur, 0.5, 0.1);
}

{
  const focus = Array.from({ length: 10 }, (_, d) => ({
    jour: j(d), secondes: 1500, interrompue: false,
  }));
  const m = construireLesMesures({ focus });
  presque('4.3 vingt-cinq minutes de focus se lisent en minutes',
    m['focus.minutes']?.[0]?.valeur, 25);
  verifier('4.4 aucune interruption', (m['focus.abandons'] ?? []).every((x) => x.valeur === 0));
}

/* ── 5. L'usage ────────────────────────────────────────────────────────── */

{
  const sessions: Session[] = [];
  for (let d = 0; d < 10; d += 1) {
    for (const h of [9, 14, 20]) {
      sessions.push({
        id: `S${d}-${h}`, jour: j(d), debut: a(j(d), h), fin: a(j(d), h + 0.5),
        majLe: a(j(d), h + 0.5),
      });
    }
  }
  const m = construireLesMesures({ usage: sessions });
  egal('5.1 trois sessions par jour', m['usage.fragmentation']?.[0]?.valeur, 3);
  presque('5.2 d’une demi-heure chacune', m['usage.duree']?.[0]?.valeur, 30);
  egal('5.3 aucune session nocturne', m['usage.heure-tardive']?.[0]?.valeur, 0);
    /*
     L'amplitude court du **début** de la première session à la **fin** de la
     dernière : de 9 h à 20 h 30, soit onze heures et demie. C'est bien ce
     qu'on veut mesurer — l'étendue de la journée éveillée, pas l'écart entre
     deux instants de départ.
  */
  presque('5.4 une amplitude de onze heures et demie', m['jour.amplitude']?.[0]?.valeur, 11.5, 0.1);
}

{
  // Une session à 3 h du matin doit se voir.
  const sessions: Session[] = [
    { id: 'A', jour: j(0), debut: a(j(0), 3), fin: a(j(0), 3.5), majLe: a(j(0), 3.5) },
    { id: 'B', jour: j(0), debut: a(j(0), 10), fin: a(j(0), 10.5), majLe: a(j(0), 10.5) },
  ];
  const m = construireLesMesures({ usage: sessions });
  presque('5.5 une session sur deux est nocturne', m['usage.heure-tardive']?.[0]?.valeur, 0.5);
}

/* ── 6. Le poids ───────────────────────────────────────────────────────── */

{
  const pesees = Array.from({ length: 40 }, (_, d) => ({ jour: j(d), kg: 70 + d * 0.1 }));
  const m = construireLesMesures({ pesees });
  presque('6.1 une dérive de cent grammes par jour fait trois kilos sur trente',
    m['poids.variation']?.[0]?.valeur, 3, 0.01);
  egal('6.2 les trente premiers jours n’ont pas de comparaison, donc pas de mesure',
    m['poids.variation']?.[0]?.jour, j(30));
}

/* ── 7. Ce qui n'est pas collecté est déclaré ──────────────────────────── */

{
  /*
     L'essai de cohérence : on alimente **toutes** les sources, et on compare
     ce qui sort à ce que `NON_COLLECTES` annonce. Le jour où une branche se
     met à alimenter l'un d'eux sans qu'on retire la ligne, cet essai le dit.
  */
  const nuits = Array.from({ length: 40 }, (_, d) => ({
    jour: j(d + 1), coucher: a(j(d), 23), lever: a(j(d + 1), 7),
  }));
  const sessions: Session[] = Array.from({ length: 40 }, (_, d) => ({
    id: `U${d}`, jour: j(d), debut: a(j(d), 9), fin: a(j(d), 10), majLe: a(j(d), 10),
  }));
  const m = construireLesMesures({
    nuits,
    usage: sessions,
    seances: Array.from({ length: 40 }, (_, d) => ({ jour: j(d), terminee: true })),
    focus: Array.from({ length: 40 }, (_, d) => ({ jour: j(d), secondes: 1500, interrompue: false })),
    taches: Array.from({ length: 40 }, (_, d) => ({ jour: j(d), reportee: false })),
    evenements: Array.from({ length: 40 }, (_, d) => ({ jour: j(d), annule: false })),
    repas: Array.from({ length: 40 }, (_, d) => ({ jour: j(d), le: a(j(d), 12) })),
    pesees: Array.from({ length: 40 }, (_, d) => ({ jour: j(d), kg: 70 })),
  });

  const produits = new Set(Object.keys(m));
  const manquants = CATALOGUE.map((i) => i.id).filter((id) => !produits.has(id));
  egal('7.1 les indicateurs non produits sont exactement ceux déclarés',
    [...manquants].sort(), [...NON_COLLECTES].sort());

  const inconnus = [...produits].filter((id) => !CATALOGUE.some((i) => i.id === id));
  egal('7.2 et aucun indicateur hors catalogue n’est fabriqué', inconnus, []);

  verifier('7.3 trois domaines comptants au moins sont alimentés',
    new Set(CATALOGUE.filter((i) => produits.has(i.id) && i.domaine !== 'lien')
      .map((i) => i.domaine)).size >= 3);

  /*
     Et le domaine entièrement observé l'est bien : sans lui, la veille
     s'éteindrait quand les saisies s'arrêtent.
  */
  const rythme = CATALOGUE.filter((i) => i.domaine === 'rythme');
  verifier('7.4 tous les indicateurs du rythme sont alimentés par le seul usage',
    rythme.every((i) => produits.has(i.id)));
}

/* ── Bilan ─────────────────────────────────────────────────────────────── */

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
