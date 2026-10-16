/**
 * La rétention réglable : ce qu'elle refuse — prompt 32, § 3.6.
 *
 *   npm run essais:retention
 *
 * Exécuté, avec `localStorage` doublé. Ce qui s'y éprouve n'est pas que
 * trente et cent quatre-vingts se relisent, mais que les **bornes
 * refusent au lieu de corriger** : un réglage silencieusement remis dans
 * l'ordre est un réglage qui ne fait pas ce qu'on lui demande, et on ne
 * s'en aperçoit qu'en comptant les jours.
 *
 * Et que la règle du § 1 n° 8 traverse tout : une question à trancher
 * n'est jamais touchée, quelle que soit la durée réglée. C'est éprouvé
 * ici **avec une rétention d'un jour**, le cas le plus agressif qu'un
 * réglage puisse produire.
 */
let magasin = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (c: string) => magasin.get(c) ?? null,
    setItem: (c: string, v: string) => void magasin.set(c, v),
    removeItem: (c: string) => void magasin.delete(c),
  },
  configurable: true,
});

const {
  PLAFOND_JOURS,
  PLANCHER_JOURS,
  controlerLaRetention,
  reglerLaRetention,
  retablirLaRetention,
  retentionReglee,
} = await import('../src/lib/notifications/retention');

import {
  RETENTION_PAR_DEFAUT,
  sortDeLaRetention,
  type ElementDuCentre,
} from '../src/lib/notifications/modele';

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
const vrai = (t: string, c: boolean) => v(t, c, true);

console.log('\n\x1b[1m1. Le défaut est celui de la décision 7\x1b[0m');
{
  magasin = new Map();
  v('30 jours puis 180', retentionReglee(), RETENTION_PAR_DEFAUT);
}

console.log('\n\x1b[1m2. Les bornes REFUSENT, elles ne corrigent pas\x1b[0m');
{
  magasin = new Map();
  const inverse = reglerLaRetention({ archiverApres: 90, supprimerApres: 30 });
  v('un ordre inversé est refusé', inverse.recevable, false);
  vrai(
    'et le motif dit la conséquence, pas la règle',
    !inverse.recevable && inverse.motif.includes('sans avoir jamais été rangé'),
  );
  /*
     Le défaut visé : une correction silencieuse. Si le module remettait
     les deux valeurs dans l'ordre, la lecture rendrait 30/90 au lieu du
     défaut — et personne ne saurait que sa saisie a été réécrite.
  */
  v('la lecture rend toujours le défaut', retentionReglee(), RETENTION_PAR_DEFAUT);
  /*
     ET LE MAGASIN EST VIDE. Deux gardes se superposent — l'écriture
     refuse, la lecture re-valide — et la seconde cache la première : un
     module qui écrirait la valeur refusée passerait quand même, puisque
     la relecture la rejetterait. C'est la troisième fois de ce prompt
     qu'une barrière en masque une autre ; on la frappe donc où elle est
     seule, sur le magasin lui-même.
  */
  v('et rien n’a été écrit dans le magasin', magasin.size, 0);

  v('égal est refusé aussi', reglerLaRetention({ archiverApres: 30, supprimerApres: 30 }).recevable, false);
  v('zéro jour est refusé', reglerLaRetention({ archiverApres: 0, supprimerApres: 30 }).recevable, false);
  v('une fraction est refusée', reglerLaRetention({ archiverApres: 1.5, supprimerApres: 30 }).recevable, false);
  v(
    'au-delà de dix ans, refusé',
    reglerLaRetention({ archiverApres: 30, supprimerApres: PLAFOND_JOURS + 1 }).recevable,
    false,
  );
  v('le plancher exact passe', reglerLaRetention({ archiverApres: PLANCHER_JOURS, supprimerApres: 2 }).recevable, true);
}

console.log('\n\x1b[1m3. Un réglage recevable tient, et se relit\x1b[0m');
{
  magasin = new Map();
  v('écrit', reglerLaRetention({ archiverApres: 7, supprimerApres: 60 }).recevable, true);
  v('relu tel quel', retentionReglee(), { archiverApres: 7, supprimerApres: 60 });
  v('et le retour au défaut efface', retablirLaRetention(), RETENTION_PAR_DEFAUT);
  v('la relecture confirme', retentionReglee(), RETENTION_PAR_DEFAUT);
}

console.log('\n\x1b[1m4. Un enregistrement abîmé rend le défaut, sans lever\x1b[0m');
{
  magasin = new Map([[ 'cyclades.notifications.retention', 'ceci n’est pas du JSON' ]]);
  v('illisible → défaut', retentionReglee(), RETENTION_PAR_DEFAUT);
  /*
     Et un enregistrement bien formé mais hors bornes — écrit par une
     version plus ancienne, ou à la main — ne doit pas devenir la règle.
  */
  magasin = new Map([
    ['cyclades.notifications.retention', JSON.stringify({ archiverApres: 400, supprimerApres: 10 })],
  ]);
  v('hors bornes → défaut', retentionReglee(), RETENTION_PAR_DEFAUT);
}

console.log('\n\x1b[1m5. Une question à trancher survit au réglage le plus agressif (§ 1 n° 8)\x1b[0m');
{
  const question: ElementDuCentre = {
    id: 'a'.repeat(32),
    source: 'question-a-trancher',
    refSource: 'r',
    genre: 'a-trancher',
    creeLe: '2020-01-01',
    etat: 'non_lu',
    regroupement: null,
  };
  magasin = new Map();
  const serre = reglerLaRetention({ archiverApres: 1, supprimerApres: 2 });
  vrai('le réglage le plus serré est recevable', serre.recevable);
  v(
    'six ans plus tard, la question n’est toujours pas touchée',
    sortDeLaRetention(question, '2026-01-01', retentionReglee()),
    'rien',
  );
  const avis: ElementDuCentre = { ...question, genre: 'a-savoir' };
  v('un avis, lui, est supprimé', sortDeLaRetention(avis, '2026-01-01', retentionReglee()), 'supprimer');
}

console.log('\n\x1b[1m6. Le contrôle pur est séparé de l’écriture\x1b[0m');
{
  magasin = new Map();
  /* L'écran appelle `controlerLaRetention` pour afficher un motif AVANT
     d'écrire ; cet appel ne doit donc rien enregistrer. */
  controlerLaRetention({ archiverApres: 5, supprimerApres: 50 });
  v('contrôler n’écrit pas', magasin.size, 0);
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
