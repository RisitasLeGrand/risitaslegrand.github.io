/**
 * Le verrouillage automatique : les trois cas que personne ne teste.
 *
 * Le cas facile — « quinze minutes sans rien faire » — n'est pas celui qui
 * compte. Les trois qui comptent sont la **veille** de la machine, le
 * **recul d'horloge**, et le **délai nul**. Aucun des trois ne s'éprouve avec
 * une vraie horloge sans attendre vraiment, d'où l'horloge à la main.
 */
import {
  DELAI_PAR_DEFAUT_MS,
  VerrouAutomatique,
  decider,
  type MondeDuVerrou,
} from '../src/lib/noyau/verrou-automatique';

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

const MINUTE = 60 * 1000;

/** Un monde dont on tient l'horloge, et qui compte les fermetures. */
const monde = (depart = 1_000_000) => {
  let horloge = depart;
  let ouvert = true;
  let fermetures = 0;
  return {
    avancer: (ms: number) => void (horloge += ms),
    reculer: (ms: number) => void (horloge -= ms),
    rouvrir: () => void (ouvert = true),
    get fermetures() {
      return fermetures;
    },
    get ouvert() {
      return ouvert;
    },
    port: {
      maintenant: () => horloge,
      coffreOuvert: () => ouvert,
      fermer: () => {
        ouvert = false;
        fermetures += 1;
      },
    } satisfies MondeDuVerrou,
  };
};

console.log('\nLA DÉCISION SE PREND SUR DEUX HORODATAGES, PAS SUR UN COMPTEUR');

v(
  'dans les temps, on ne verrouille pas',
  decider({ derniereActivite: 0, delaiMs: 15 * MINUTE }, 14 * MINUTE).verrouiller,
  false,
);
v(
  'au délai exact, on verrouille',
  decider({ derniereActivite: 0, delaiMs: 15 * MINUTE }, 15 * MINUTE).verrouiller,
  true,
);
v(
  'le délai par défaut est de quinze minutes',
  DELAI_PAR_DEFAUT_MS,
  15 * MINUTE,
);

console.log('\nZÉRO VEUT DIRE JAMAIS');

v(
  'un délai nul désactive le verrou, même après un an',
  decider({ derniereActivite: 0, delaiMs: 0 }, 365 * 24 * 60 * MINUTE),
  { verrouiller: false, raison: 'desactive', ecoule: 365 * 24 * 60 * MINUTE },
);
v(
  'un délai négatif aussi',
  decider({ derniereActivite: 0, delaiMs: -1 }, 10 ** 9).raison,
  'desactive',
);

console.log('\nLA VEILLE DE LA MACHINE : LE CAS QUI COMPTE VRAIMENT');

{
  /*
     Le défaut visé : un module qui compterait le temps écoulé avec un
     minuteur ne verrouillerait PAS ici, parce qu'une machine en veille
     n'exécute pas ses minuteurs. L'ordinateur a été refermé trois heures,
     et le coffre doit être fermé avant d'avoir rien affiché.
  */
  const m = monde();
  const verrou = new VerrouAutomatique(m.port, 15 * MINUTE);
  v('au départ, le coffre est ouvert', m.ouvert, true);

  m.avancer(3 * 60 * MINUTE); // trois heures de veille, aucun minuteur n'a tourné
  const d = verrou.verifier();
  v('le réveil après trois heures verrouille', d.verrouiller, true);
  v('et le coffre est bien fermé', m.ouvert, false);
  v('une seule fermeture, pas une par minute écoulée', m.fermetures, 1);
}

console.log('\nL’ACTIVITÉ REPOUSSE, ELLE N’ACCUMULE PAS');

{
  const m = monde();
  const verrou = new VerrouAutomatique(m.port, 15 * MINUTE);
  /*
     Quatorze minutes, un clic, quatorze minutes : vingt-huit minutes au
     total, et pourtant il ne faut pas verrouiller. Un module qui
     additionnerait les intervalles se tromperait ici.
  */
  for (let i = 0; i < 2; i += 1) {
    m.avancer(14 * MINUTE);
    verrou.verifier();
    verrou.activite();
  }
  v('vingt-huit minutes avec un clic au milieu ne verrouillent pas', m.ouvert, true);

  m.avancer(16 * MINUTE);
  verrou.verifier();
  v('seize minutes sans rien, en revanche, oui', m.ouvert, false);
}

console.log('\nUNE HORLOGE QUI RECULE NE SUSPEND PAS LE VERROU');

{
  const m = monde();
  const verrou = new VerrouAutomatique(m.port, 15 * MINUTE);
  m.reculer(60 * MINUTE); // changement d'heure, synchronisation réseau…
  const d = verrou.verifier();
  v('on ne verrouille pas sur un écart négatif', d.verrouiller, false);
  v('et on le nomme', d.raison, 'horloge-reculee');
  v('le coffre reste ouvert', m.ouvert, true);

  /*
     Le défaut visé : sans remise du repère, l'écart resterait négatif
     pendant une heure, et le verrou dormirait tout ce temps. Seize minutes
     après le recul, il doit de nouveau mordre.
  */
  m.avancer(16 * MINUTE);
  verrou.verifier();
  v('seize minutes après le recul, le verrou a repris son office', m.ouvert, false);
}

console.log('\nUN COFFRE DÉJÀ FERMÉ N’EST PAS REFERMÉ');

{
  const m = monde();
  const verrou = new VerrouAutomatique(m.port, 15 * MINUTE);
  m.avancer(20 * MINUTE);
  verrou.verifier();
  m.avancer(20 * MINUTE);
  verrou.verifier();
  v('une seule fermeture pour deux dépassements', m.fermetures, 1);
}

console.log('\nCHANGER LE DÉLAI NE VERROUILLE PAS SUR-LE-CHAMP');

{
  const m = monde();
  const verrou = new VerrouAutomatique(m.port, 60 * MINUTE);
  m.avancer(30 * MINUTE);
  /*
     Le défaut visé : on règle le délai à quinze minutes depuis un écran de
     réglages, alors qu'on vient de passer trente minutes à lire. Sans remise
     à zéro, le coffre se fermerait à l'instant même du réglage — au moment
     précis où l'on est devant l'écran, donc actif.
  */
  verrou.reglerLeDelai(15 * MINUTE);
  verrou.verifier();
  v('le coffre reste ouvert juste après le réglage', m.ouvert, true);
  v('et le nouveau délai est bien retenu', verrou.delai, 15 * MINUTE);

  m.avancer(16 * MINUTE);
  verrou.verifier();
  v('mais il s’applique ensuite', m.ouvert, false);
}

console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
