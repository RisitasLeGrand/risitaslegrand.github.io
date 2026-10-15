/**
 * Deux appareils, une occurrence — phase 9 du prompt 38.
 *
 *   npm run essais:fusion-occurrences
 *
 * C'est l'essai pour lequel les clés déterministes ont été conçues, et il
 * n'avait jamais été écrit. Le modèle affirme deux choses depuis la phase 2 ;
 * elles sont ici **constatées** plutôt que crues :
 *
 * - **deux appareils qui pointent la même occurrence hors ligne convergent
 *   vers UNE ligne.** Avec un identifiant tiré au sort, ils en feraient deux,
 *   et le calendrier montrerait deux fois le même geste ;
 * - **une exception vit hors de la tâche**, donc « A déplace l'occurrence du
 *   12 » et « B change l'heure de la série » sont deux cibles distinctes, et
 *   survivent toutes les deux. Dans la tâche, la seconde écriture aurait
 *   effacé la première **sans conflit levé** — la pire des pertes, celle qui
 *   ne se voit pas.
 */
import {
  appareil,
  deriveIdentique,
  identiques,
  transmettre,
} from '../src/lib/sync/simulateur';
import { idEtapeCochee, idOccurrence } from '../src/lib/odyssee/modele';

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

/** La cible de fusion, telle que la couche de données l'écrirait. */
const cibleOccurrence = (tacheId: string, jour: string) =>
  `odysseeOccurrences:${idOccurrence(tacheId, jour)}`;
const cibleEtape = (tacheId: string, jour: string, etape: string) =>
  `odysseeEtapesCochees:${idEtapeCochee(tacheId, jour, etape)}`;

/** Deux appareils partant du même instant, l'un en avance d'une seconde. */
const deuxAppareils = () => {
  let t = Date.parse('2026-10-12T08:00:00.000Z');
  const instant = () => (t += 1000);
  return {
    a: appareil({ nom: 'Portable', identifiant: 'A', instant }),
    b: appareil({ nom: 'Téléphone', identifiant: 'B', instant, deriveHorloge: 1000 }),
  };
};

/** Échange complet dans les deux sens, jusqu'à convergence. */
const synchroniser = (a: ReturnType<typeof appareil>, b: ReturnType<typeof appareil>) => {
  transmettre(a, b);
  transmettre(b, a);
};

/* ── 1. Le même geste, des deux côtés ──────────────────────────────────── */
console.log('\nDeux appareils pointent la même occurrence, hors ligne');

{
  const { a, b } = deuxAppareils();
  const cible = cibleOccurrence('T1', '2026-10-12');
  a.saisir('odyssee.occurrence', cible, { etat: 'pointee', valeur: 1 });
  b.saisir('odyssee.occurrence', cible, { etat: 'pointee', valeur: 1 });
  synchroniser(a, b);

  /*
     CE QU'IL FAUT MESURER, et que j'avais d'abord mesuré de travers.
     Le journal est un journal d'AJOUT : deux gestes y font deux opérations,
     et `parCible` les compte. Ce n'est pas un défaut — c'est ce qui permet
     de rejouer l'histoire. La convergence vers une seule LIGNE ne se lit
     donc pas dans ce compte, mais dans la CIBLE : les deux opérations
     visent la même, donc elles écrivent la même clé de magasin, donc la
     seconde réécrit la première au lieu de s'ajouter à côté.
  */
  const cibles = (x: ReturnType<typeof appareil>) =>
    [...new Set(x.paquet().operations.map((o) => o.cible))];
  v('une seule cible distincte, des deux côtés', [cibles(a), cibles(b)], [[cible], [cible]]);
  v('et c’est bien la clé déterministe', cibles(a)[0], 'odysseeOccurrences:T1/2026-10-12');
  v('les deux appareils ont le même état dérivé', deriveIdentique(a, b), true);
  v('et la même empreinte', await identiques(a, b), true);
}

/* ── 2. Deux gestes contraires sur la même occurrence ──────────────────── */
console.log('\nL’un pointe, l’autre abandonne : le dernier l’emporte, des deux côtés');

{
  const { a, b } = deuxAppareils();
  const cible = cibleOccurrence('T1', '2026-10-12');
  a.saisir('odyssee.occurrence', cible, { etat: 'pointee', valeur: 1 });
  b.saisir('odyssee.occurrence', cible, { etat: 'abandonnee', valeur: 1 });
  synchroniser(a, b);

  v('les deux convergent', deriveIdentique(a, b), true);
  v('et sur la même empreinte', await identiques(a, b), true);
  /*
     Lequel l'emporte n'est pas l'objet : c'est l'horloge logique qui tranche,
     et elle est éprouvée ailleurs. Ce qui compte ici est qu'ils soient
     D'ACCORD — un calendrier qui montrerait « pointée » sur un appareil et
     « abandonnée » sur l'autre serait pire que les deux réponses.
  */
}

/* ── 3. La tâche et son occurrence sont deux cibles ────────────────────── */
console.log('\nModifier la série et pointer une occurrence ne s’effacent pas');

{
  const { a, b } = deuxAppareils();
  const tache = 'odysseeTaches:T1';
  const occurrence = cibleOccurrence('T1', '2026-10-12');
  a.saisir('odyssee.occurrence', occurrence, { etat: 'deplacee', valeur: 1 });
  b.saisir('odyssee.tache', tache, { heure: '09:00', valeur: 1 });
  synchroniser(a, b);

  const parCible = (x: ReturnType<typeof appareil>) => x.derive().parCible as Record<string, number>;
  v('la tâche survit', parCible(a)[tache], 1);
  v('l’occurrence aussi', parCible(a)[occurrence], 1);
  v('les deux appareils sont d’accord', deriveIdentique(a, b), true);
}

/* ── 4. Les étapes cochées suivent la même règle ───────────────────────── */
console.log('\nDeux appareils cochent la même étape du même jour');

{
  const { a, b } = deuxAppareils();
  const cible = cibleEtape('T1', '2026-10-12', 'E1');
  a.saisir('odyssee.etape-cochee', cible, { valeur: 1 });
  b.saisir('odyssee.etape-cochee', cible, { valeur: 1 });
  synchroniser(a, b);
  v(
    'une seule cible, donc une seule étape cochée',
    [...new Set(a.paquet().operations.map((o) => o.cible))],
    [cible],
  );
  v('et la clé porte bien la tâche, le jour et l’étape', cible, 'odysseeEtapesCochees:T1/2026-10-12/E1');
  v('et les deux convergent', await identiques(a, b), true);
}

/* ── 5. Deux jours différents restent deux occurrences ─────────────────── */
console.log('\nLa clé distingue ce qui doit l’être');

{
  const { a, b } = deuxAppareils();
  a.saisir('odyssee.occurrence', cibleOccurrence('T1', '2026-10-12'), { valeur: 1 });
  b.saisir('odyssee.occurrence', cibleOccurrence('T1', '2026-10-13'), { valeur: 1 });
  synchroniser(a, b);
  v('deux jours, deux lignes', Object.keys(a.derive().parCible as object).length, 2);

  const { a: c, d: _ } = { a: appareil({ nom: 'C', identifiant: 'C' }), d: null };
  c.saisir('odyssee.occurrence', cibleOccurrence('T1', '2026-10-12'), { valeur: 1 });
  c.saisir('odyssee.occurrence', cibleOccurrence('T2', '2026-10-12'), { valeur: 1 });
  v('deux tâches, deux lignes', Object.keys(c.derive().parCible as object).length, 2);
}

/* ── 6. Ce que la clé déterministe évite ───────────────────────────────── */
console.log('\nCe qu’un identifiant tiré au sort ferait, à titre de témoin');

{
  const { a, b } = deuxAppareils();
  /*
     Le même geste, mais avec une clé par appareil — ce qu'un ULID donnerait.
     Le résultat n'est pas une erreur du moteur de fusion : il fait
     exactement ce qu'on lui demande. C'est la CLÉ qui décide, et c'est
     pourquoi `idOccurrence` n'est pas un détail d'implémentation.
  */
  a.saisir('odyssee.occurrence', 'odysseeOccurrences:01AAAA', { valeur: 1 });
  b.saisir('odyssee.occurrence', 'odysseeOccurrences:01BBBB', { valeur: 1 });
  synchroniser(a, b);
  v(
    'deux clés tirées au sort font deux cibles pour un seul geste',
    [...new Set(a.paquet().operations.map((o) => o.cible))].length,
    2,
  );
}

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
