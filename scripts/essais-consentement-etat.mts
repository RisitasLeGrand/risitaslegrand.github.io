/**
 * L'état du consentement, et la règle « la révocation l'emporte » — A-13.
 *
 *   npm run essais:consentement-etat
 *
 * Une seule chose s'éprouve ici, mais elle décide si un consentement en
 * est un : **un accord ne lève une révocation que s'il la nomme.**
 *
 * Le cas qui compte est celui de l'appareil resté hors ligne. Il porte
 * encore l'accord, il le réécrit plus tard, et son horodatage est le plus
 * récent. Sous « dernier écrivain gagne », le consentement reviendrait
 * tout seul. L'essai le refuse explicitement — et il le refuse **dans les
 * deux ordres d'arrivée**, parce que deux appareils qui ont reçu les mêmes
 * gestes dans des ordres différents doivent conclure la même chose.
 */
import {
  CONSENTEMENT_VIERGE,
  accorder,
  resoudreConsentement,
  revoquer,
  type EntreeDeConsentement,
} from '../src/lib/odyssee/consentement-etat';

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

const T1 = '2026-10-01T10:00:00.000Z';
const T2 = '2026-10-10T10:00:00.000Z';
const T3 = '2026-10-12T10:00:00.000Z';

console.log('\n\x1b[1mLe défaut est le silence\x1b[0m');
{
  v('rien dit, rien accordé', resoudreConsentement([]), CONSENTEMENT_VIERGE);
  v('et donc rien observé', resoudreConsentement([]).accorde, false);
}

console.log('\n\x1b[1mUn accord simple\x1b[0m');
{
  const etat = resoudreConsentement([{ type: 'accord', le: T1 }]);
  v('il vaut', etat.accorde, true);
  v('et il est daté', etat.depuis, T1);
  v('rien à lever', etat.revocationAlever, null);
}

console.log('\n\x1b[1mUne révocation absorbe\x1b[0m');
{
  const etat = resoudreConsentement([
    { type: 'accord', le: T1 },
    { type: 'revocation', le: T2 },
  ]);
  v('le consentement tombe', etat.accorde, false);
  v('et l’écran sait quoi lever', etat.revocationAlever, T2);
}

console.log('\n\x1b[1m\x1b[31mLE CAS QUI COMPTE\x1b[0m\x1b[1m : l’appareil resté hors ligne\x1b[0m');
{
  /*
     On révoque sur le téléphone à T2. L'ordinateur, hors ligne, portait
     encore l'accord et le réécrit à T3 — PLUS RÉCENT. Il n'a jamais vu la
     révocation, donc il ne peut pas la nommer.
  */
  const horsLigne: EntreeDeConsentement[] = [
    { type: 'accord', le: T1 },
    { type: 'revocation', le: T2 },
    { type: 'accord', le: T3 },
  ];
  const etat = resoudreConsentement(horsLigne);
  v(
    'un accord PLUS RÉCENT qui ne nomme pas la révocation ne la lève pas',
    etat.accorde,
    false,
  );
  v('la révocation reste celle à lever', etat.revocationAlever, T2);

  /* Et l'ordre d'arrivée des paquets n'y change rien. */
  const autreOrdre = [horsLigne[2]!, horsLigne[0]!, horsLigne[1]!];
  v(
    'dans un autre ordre d’arrivée, la même conclusion',
    resoudreConsentement(autreOrdre),
    etat,
  );
}

console.log('\n\x1b[1mUne reprise VOULUE, elle, vaut\x1b[0m');
{
  const apresRevocation = resoudreConsentement([
    { type: 'accord', le: T1 },
    { type: 'revocation', le: T2 },
  ]);
  /* L'écran lit l'état, donc il nomme la révocation qu'il lève. */
  const reprise = accorder(apresRevocation, T3);
  v('l’accord nomme la révocation', reprise.remplace, T2);

  const etat = resoudreConsentement([
    { type: 'accord', le: T1 },
    { type: 'revocation', le: T2 },
    reprise,
  ]);
  v('et il la lève', etat.accorde, true);
  v('la reprise fait foi', etat.depuis, T3);
  v('plus rien à lever', etat.revocationAlever, null);
}

console.log('\n\x1b[1mUne seconde révocation reprend le dessus\x1b[0m');
{
  const T4 = '2026-10-14T10:00:00.000Z';
  const etat = resoudreConsentement([
    { type: 'accord', le: T1 },
    { type: 'revocation', le: T2 },
    { type: 'accord', le: T3, remplace: T2 },
    revoquer(T4),
  ]);
  v('révoqué de nouveau', etat.accorde, false);
  v('et c’est la seconde qu’il faudrait lever', etat.revocationAlever, T4);

  /* Un accord qui nommerait l'ANCIENNE révocation ne lève pas la nouvelle. */
  const perime = resoudreConsentement([
    { type: 'accord', le: T1 },
    { type: 'revocation', le: T2 },
    { type: 'accord', le: T3, remplace: T2 },
    revoquer(T4),
    { type: 'accord', le: '2026-10-15T10:00:00.000Z', remplace: T2 },
  ]);
  v(
    'un accord qui nomme une révocation périmée ne lève pas la nouvelle',
    perime.accorde,
    false,
  );
}

console.log('\n\x1b[1mUn premier accord ne nomme rien\x1b[0m');
{
  v('rien à remplacer quand rien n’a été révoqué', accorder(CONSENTEMENT_VIERGE, T1), {
    type: 'accord',
    le: T1,
  });
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
