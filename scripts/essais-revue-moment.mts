/**
 * Le moment de la revue — phase 1 du prompt 36.
 *
 *   npm run essais:revue-moment
 *
 * **L'interdit que ces contrôles protègent** : « Les libellés suivent le
 * moment choisi : "hier" ou "aujourd'hui", jamais un "aujourd'hui" faux. »
 *
 * C'est une erreur qu'aucun test de type ne rattrape : le jour visé et le mot
 * affiché sont deux valeurs, et rien n'oblige la seconde à décrire la
 * première. Le contrôle les confronte donc l'une à l'autre plutôt que de
 * vérifier chacune de son côté — vérifier séparément que « le matin vise la
 * veille » et que « le matin dit hier » laisserait passer l'inversion des
 * deux.
 */
import { COUCHER_PAR_DEFAUT, LEVER_PAR_DEFAUT, fenetreDeLaRevue } from '../src/lib/odyssee/jour';
import {
  MOMENT_PAR_DEFAUT,
  jourVise,
  libelles,
  lireMoment,
  type Moment,
} from '../src/lib/odyssee/moment-revue';

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)} / attendu ${JSON.stringify(attendu)}`);
};

console.log('\nLE MOMENT DE LA REVUE');

console.log('\n  A — la lecture de la préférence');
v('sans préférence, c’est le soir — l’existant', MOMENT_PAR_DEFAUT, 'soir');
v('« matin » est reconnu', lireMoment('matin'), 'matin');
v('« soir » aussi', lireMoment('soir'), 'soir');
v('une valeur absente retombe sur le soir', lireMoment(undefined), 'soir');
v('et une valeur inattendue aussi, plutôt qu’un troisième comportement', lireMoment('Matin '), 'soir');
v('y compris un nombre', lireMoment(3), 'soir');

console.log('\n  B — le jour visé');
/* Un instant en milieu de journée, pour ne pas mesurer la bascule du jour
   logique en même temps : c'est l'objet d'un autre contrôle. */
const midi = new Date('2026-03-12T12:00:00.000Z');
v('le soir vise le jour en cours', jourVise('soir', midi), '2026-03-12');
v('le matin vise LA VEILLE', jourVise('matin', midi), '2026-03-11');

/* Le passage de mois, où une soustraction naïve se trompe. */
const premier = new Date('2026-03-01T12:00:00.000Z');
v('le matin du 1er mars vise le 28 février', jourVise('matin', premier), '2026-02-28');
/* Et une année bissextile, où elle se trompe autrement. */
const bissextile = new Date('2028-03-01T12:00:00.000Z');
v('le matin du 1er mars 2028 vise le 29 février', jourVise('matin', bissextile), '2028-02-29');

console.log('\n  C — le mot affiché décrit bien le jour visé');
/*
   LE contrôle de cette phase. On ne vérifie pas « le matin dit hier » dans
   l'absolu : on vérifie que le mot et la date désignent le MÊME jour. C'est
   l'inversion des deux que l'interdit vise, et elle survivrait à deux
   contrôles séparés.
*/
for (const moment of ['matin', 'soir'] as Moment[]) {
  const mots = libelles(moment);
  const vise = jourVise(moment, midi);
  const aujourdhui = jourVise('soir', midi);
  const dit = mots.quand === 'aujourd’hui' ? aujourdhui : null;
  v(
    `« ${mots.quand} » (${moment}) désigne bien ${vise}`,
    mots.quand === 'aujourd’hui' ? dit === vise : vise !== aujourdhui,
    true,
  );
  v(`les trois libellés de « ${moment} » portent le même mot`, [
    mots.titrePlan.includes(mots.quand),
    mots.questionCompte.includes(mots.quand),
    mots.dejaTenue.includes(mots.quand),
  ], [true, true, true]);
}

v(
  'le mode matin ne dit JAMAIS « aujourd’hui »',
  Object.values(libelles('matin')).some((t) => t.includes('aujourd’hui')),
  false,
);

console.log('\n  D — la fenêtre d’ouverture');

v('le soir, deux heures avant le coucher déclaré', fenetreDeLaRevue('soir', undefined, '23:00'), {
  de: 21 * 60,
  a: 23 * 60,
  parceQue: 'Moins de deux heures avant votre heure de coucher.',
});
v('le matin, du lever déclaré à midi', fenetreDeLaRevue('matin', '07:30', undefined), {
  de: 7 * 60 + 30,
  a: 12 * 60,
  parceQue: 'Depuis votre heure de lever, et jusqu’à midi.',
});

/*
   LE défaut réparé. Avant le 15 octobre, sans heure de coucher déclarée, la
   revue n'était JAMAIS proposée : elle disparaissait sans rien dire. Le
   contrôle exige donc une fenêtre, et pas « null ».
*/
const sansRien = fenetreDeLaRevue('soir', undefined, undefined);
v('sans heure de coucher, la revue est tout de même proposée', sansRien !== null, true);
v('le repli du soir est 20 h', sansRien?.a, 20 * 60);
v('et il est DIT, pas silencieux', /faute d’heure de coucher déclarée/.test(sansRien?.parceQue ?? ''), true);

const matinSansRien = fenetreDeLaRevue('matin', undefined, undefined);
v('le repli du matin est 6 h', matinSansRien?.de, 6 * 60);
v('et il est dit aussi', /faute d’heure de lever déclarée/.test(matinSansRien?.parceQue ?? ''), true);

v('les deux replis sont les valeurs tranchées par Alexis', [LEVER_PAR_DEFAUT, COUCHER_PAR_DEFAUT], ['06:00', '20:00']);

/* Une heure mal formée ne doit pas produire une fenêtre absurde. */
v('une heure illisible retombe sur le repli', fenetreDeLaRevue('soir', undefined, 'vingt heures')?.a, 20 * 60);

/*
   Et la borne haute du matin n'est pas décorative : une « revue du matin »
   proposée à dix-sept heures porterait sur la veille sans que rien ne le
   laisse deviner.
*/
v('le matin se ferme à midi', fenetreDeLaRevue('matin', '05:00', undefined)?.a, 12 * 60);

console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
