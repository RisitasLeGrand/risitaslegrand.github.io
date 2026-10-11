/**
 * Le salon : mon enveloppe autour du relais, éprouvée sans relais.
 *
 * Le relais public n'est pas éprouvé ici, et ne peut pas l'être : il est chez
 * quelqu'un d'autre, et un essai qui en dépend échoue le jour où ce quelqu'un
 * redémarre. Ce qui est éprouvé, c'est tout ce qui est à moi — la découverte des
 * pairs, le découpage des paquets au-dessus de l'action, l'état « ouvert », la
 * fermeture quand le dernier pair s'en va. Le relais est remplacé par un
 * tableau, ce qui a l'avantage de rendre les essais instantanés et
 * déterministes.
 *
 * C'est aussi ce que l'injection permet de vérifier et qui compte le plus : que
 * le secret serve de mot de passe au salon, et que le nom du salon soit bien
 * celui du QR. Une inversion des deux fonctionnerait parfaitement — les deux
 * appareils se rencontreraient — en livrant le secret au relais.
 */
import { APPLICATION, rejoindre, type TypeRejoindre } from '../src/lib/sync/salon';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  ✓ ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  ✗ ${intitule}\n      attendu ${b}\n      obtenu  ${a}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);

/* ══════════════════════════════════════════════════════════════════════════
   Un relais simulé : deux chambres qui se parlent, et rien d'autre
   ══════════════════════════════════════════════════════════════════════════ */

interface Chambre {
  nom: string;
  motDePasse?: string;
  application: string;
  messages: Uint8Array[];
  partie: boolean;
}

function relaisSimule() {
  const chambres: Chambre[] = [];
  const auditeurs = new Map<Chambre, (donnees: unknown, c: { peerId: string }) => void>();
  const pairs = new Map<Chambre, ((p: string) => void) | null>();
  const departs = new Map<Chambre, ((p: string) => void) | null>();

  const rejoindreSalon: TypeRejoindre = (config, nom) => {
    const chambre: Chambre = {
      nom,
      motDePasse: config.password,
      application: config.appId,
      messages: [],
      partie: false,
    };
    chambres.push(chambre);

    const voisines = () =>
      chambres.filter(
        (c) => c !== chambre && c.nom === chambre.nom && c.application === chambre.application && !c.partie,
      );

    const objet = {
      makeAction: (_nom: string, cfg?: { onMessage?: (d: unknown, c: { peerId: string }) => void }) => {
        if (cfg?.onMessage) auditeurs.set(chambre, cfg.onMessage);
        return {
          send: async (donnees: Uint8Array) => {
            chambre.messages.push(donnees);
            for (const voisine of voisines()) {
              auditeurs.get(voisine)?.(donnees, { peerId: chambre.nom });
            }
          },
        };
      },
      leave: () => {
        chambre.partie = true;
        for (const voisine of voisines()) departs.get(voisine)?.(`pair-${chambres.indexOf(chambre)}`);
      },
      set onPeerJoin(f: ((p: string) => void) | null) {
        pairs.set(chambre, f);
        // Les voisines déjà là sont annoncées, comme le ferait un vrai salon.
        for (const voisine of voisines()) {
          f?.(`pair-${chambres.indexOf(voisine)}`);
          pairs.get(voisine)?.(`pair-${chambres.indexOf(chambre)}`);
        }
      },
      get onPeerJoin() {
        return pairs.get(chambre) ?? null;
      },
      set onPeerLeave(f: ((p: string) => void) | null) {
        departs.set(chambre, f);
      },
      get onPeerLeave() {
        return departs.get(chambre) ?? null;
      },
    };
    return objet as never;
  };

  return { rejoindreSalon, chambres };
}

const attendre = () => new Promise((ok) => setTimeout(ok, 0));

const paquetDe = (taille: number) => {
  const octets = new Uint8Array(taille);
  for (let i = 0; i < taille; i += 1) octets[i] = (i * 17 + 3) % 256;
  return octets;
};

console.log('\nLe salon porte le nom du QR, et le secret ne sert que de clef');

{
  const { rejoindreSalon, chambres } = relaisSimule();
  await rejoindre({ salon: 'LeSalon', secret: 'LeSecret', rejoindreSalon });
  v('le nom du salon est celui qu’on lui donne', chambres[0].nom, 'LeSalon');
  v('le secret est passé comme mot de passe du salon', chambres[0].motDePasse, 'LeSecret');
  v('et l’application namespacie', chambres[0].application, APPLICATION);
  vrai(
    'le secret n’est pas le nom du salon — sans quoi le relais pourrait déchiffrer',
    chambres[0].nom !== chambres[0].motDePasse,
  );
}

console.log('\nDeux appareils se trouvent, et un paquet passe entier');

{
  const { rejoindreSalon } = relaisSimule();
  const a = await rejoindre({ salon: 'S', secret: 'K', rejoindreSalon });
  const recusB: Uint8Array[] = [];
  const b = await rejoindre({ salon: 'S', secret: 'K', rejoindreSalon });
  b.canal.surPaquet((p) => recusB.push(p));

  await attendre();
  v('A voit un pair', a.pairs().length, 1);
  v('B aussi', b.pairs().length, 1);
  vrai('et le canal se dit ouvert', a.canal.ouvert && b.canal.ouvert);

  const paquet = paquetDe(40_000);
  await a.canal.envoyer(paquet);
  await attendre();
  v('B a reçu un paquet', recusB.length, 1);
  v('de la bonne taille', recusB[0]?.length, 40_000);
  vrai('et identique', recusB[0].every((octet, i) => octet === paquet[i]));
}

console.log('\nUn salon différent n’entend rien');

{
  const { rejoindreSalon } = relaisSimule();
  const a = await rejoindre({ salon: 'S1', secret: 'K', rejoindreSalon });
  const b = await rejoindre({ salon: 'S2', secret: 'K', rejoindreSalon });
  const recus: Uint8Array[] = [];
  b.canal.surPaquet((p) => recus.push(p));
  await attendre();
  v('aucun pair', [a.pairs().length, b.pairs().length], [0, 0]);
  vrai('et le canal se dit fermé', !a.canal.ouvert);
  await a.canal.envoyer(paquetDe(100));
  await attendre();
  v('rien n’est reçu ailleurs', recus.length, 0);
}

console.log('\nLa progression est annoncée à la réception');

{
  const { rejoindreSalon } = relaisSimule();
  const a = await rejoindre({ salon: 'S', secret: 'K', rejoindreSalon });
  const b = await rejoindre({ salon: 'S', secret: 'K', rejoindreSalon });
  const vues: number[] = [];
  b.canal.surProgression((p) => vues.push(p.faits));
  await attendre();
  await a.canal.envoyer(paquetDe(50_000));
  await attendre();
  vrai('plusieurs annonces', vues.length > 2);
  v('la dernière est le total', vues.at(-1), 50_000);
  vrai('et elles croissent', vues.every((f, i) => i === 0 || f >= vues[i - 1]));
}

console.log('\nLe départ du dernier pair ferme le canal');

{
  const { rejoindreSalon } = relaisSimule();
  const a = await rejoindre({ salon: 'S', secret: 'K', rejoindreSalon });
  const b = await rejoindre({ salon: 'S', secret: 'K', rejoindreSalon });
  let ferme = 0;
  a.canal.surFermeture(() => (ferme += 1));
  await attendre();
  await b.quitter();
  await attendre();
  v('la fermeture est annoncée une fois', ferme, 1);
  vrai('et le canal ne se dit plus ouvert', !a.canal.ouvert);
}

console.log('\nLe plafond de taille est transmis au récepteur');

{
  const { rejoindreSalon } = relaisSimule();
  const a = await rejoindre({ salon: 'S', secret: 'K', rejoindreSalon });
  const b = await rejoindre({ salon: 'S', secret: 'K', rejoindreSalon, plafond: 1_000 });
  await attendre();
  let motif = '';
  try {
    await a.canal.envoyer(paquetDe(5_000));
  } catch (erreur) {
    motif = (erreur as { motif?: string }).motif ?? 'autre';
  }
  v('un paquet au-dessus du plafond est refusé à la réception', motif, 'trop-gros');
}

console.log(echecs === 0 ? '\nTous les essais passent.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
