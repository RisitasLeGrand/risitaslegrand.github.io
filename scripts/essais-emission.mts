/**
 * Les notifications du système : ce qui les retient — prompt 32, phase 3.
 *
 *   npm run essais:emission
 *
 * Contrôle **par exécution**, et non par lecture de source : le module
 * ne tient qu'à trois objets du navigateur — `localStorage`, `Notification`
 * et `navigator.locks` —, qui se doublent. La leçon de la phase 1 est
 * appliquée d'emblée : une sonde textuelle dit qu'un garde-fou est cité,
 * jamais qu'il agit, et ici c'est l'agir qui compte, parce qu'un défaut se
 * voit sur l'écran verrouillé d'un téléphone.
 *
 * Sept refus à éprouver, et chacun protège d'une chose différente :
 * la source non activée (§ 3.4, désactivées par défaut), le cycle
 * (§ 1 n° 3), la permission absente, la page sous les yeux (0.8 du 43), le
 * plafond du jour (§ 3.3), un autre onglet (§ 3.5), et l'absence de verrou.
 * Plus le libellé lui-même, qui est la seule chose que l'écran verrouillé
 * montre.
 */

/* ── Les doublures, posées avant d'importer le module ───────────────── */

let magasin = new Map<string, string>();
const localStorageDouble = {
  getItem: (c: string) => magasin.get(c) ?? null,
  setItem: (c: string, v: string) => void magasin.set(c, v),
  removeItem: (c: string) => void magasin.delete(c),
  clear: () => magasin.clear(),
  key: () => null,
  length: 0,
};

let permission: NotificationPermission = 'default';
let demandes = 0;
const affichees: { titre: string; options: NotificationOptions }[] = [];

class NotificationDouble {
  static get permission() {
    return permission;
  }
  static async requestPermission(): Promise<NotificationPermission> {
    demandes += 1;
    return permission;
  }
  constructor(titre: string, options: NotificationOptions = {}) {
    affichees.push({ titre, options });
  }
}

/**
 * Le verrou, et il est **réellement tenu**.
 *
 * La première doublure se contentait de rendre un jeton selon un drapeau
 * que personne ne mettait à jour : elle rendait donc toujours le verrou
 * libre, et le sabotage « ne jamais relâcher » restait vert. Une doublure
 * qui ne modélise pas ce qu'elle double ne prouve rien — c'est la même
 * faute que la sonde textuelle de la phase 1, sous un autre costume.
 *
 * Ici, le verrou est pris tant que la promesse du corps n'est pas tenue,
 * exactement comme l'API Web Locks : une seconde demande pendant ce temps
 * reçoit `null`.
 */
let occupeParUnAutreOnglet = false;
let tenu = false;

/**
 * L'état de la page, et son défaut est **« non regardée »**.
 *
 * Ce n'est pas une commodité pour faire passer les autres sections : c'est
 * ce qu'elles mesurent. Chacune éprouve UN refus, et une page sous les yeux
 * les refuserait toutes pour une raison qui n'est pas la leur — on
 * mesurerait alors le dernier contrôle écrit, et le jour où un autre
 * casserait, personne ne le verrait. La section 6 bis, elle, pose les deux
 * états et c'est son objet.
 */
let visibilite: 'visible' | 'hidden' = 'hidden';

/**
 * Les notifications que le *service worker* dit afficher.
 *
 * `refermer` ne peut pas se prouver autrement : il interroge
 * `getNotifications()` et appelle `close()` sur une partie. Sans doublure,
 * on ne saurait que ce qu'il n'a pas jeté — ce qui n'est pas la même chose
 * que ce qu'il a fermé.
 */
let auTableau: { tag: string; fermee: boolean }[] = [];
const serviceWorkerDouble = {
  getRegistration: async () => ({
    getNotifications: async () =>
      auTableau
        .filter((n) => !n.fermee)
        .map((n) => ({
          tag: n.tag,
          close: () => {
            n.fermee = true;
          },
        })),
  }),
};
/** `false` : pas de *service worker* du tout. */
let serviceWorkerPresent = false;
/** `null` : l'API n'existe pas du tout — vieux navigateur. */
let apiVerrous: boolean = true;

const g = globalThis as Record<string, unknown>;
g.localStorage = localStorageDouble;
g.Notification = NotificationDouble;
/*
   `document` n'existe pas sous Node, et le module le teste par
   `typeof document` : sans cette doublure, il croirait tourner dans un
   *service worker* et ne consulterait jamais la visibilité. L'accesseur est
   relu à chaque appel, pour que `visibilite` se change entre deux émissions.
*/
Object.defineProperty(g, 'document', {
  get: () => ({ get visibilityState() { return visibilite; } }),
  configurable: true,
});
/*
   `navigator` est un accesseur en lecture seule sous Node : on le
   REDÉFINIT, on ne l'affecte pas. L'affectation jetait « has only a
   getter » — et un essai qui plante avant sa première ligne ne dit rien
   du code qu'il devait éprouver.
*/
Object.defineProperty(g, 'navigator', {
  get: () =>
    apiVerrous
      ? {
          locks: {
            request: async (
              _nom: string,
              _o: { ifAvailable?: boolean },
              corps: (verrou: unknown) => Promise<void>,
            ) => {
              if (occupeParUnAutreOnglet || tenu) return corps(null);
              tenu = true;
              try {
                return await corps({});
              } finally {
                tenu = false;
              }
            },
          },
          serviceWorker: serviceWorkerPresent ? serviceWorkerDouble : undefined,
        }
      : { serviceWorker: serviceWorkerPresent ? serviceWorkerDouble : undefined },
  configurable: true,
});

const {
  CORPS_NEUTRE,
  refermer,
  PLAFOND_PAR_JOUR,
  TITRE_NEUTRE,
  emettre,
  reglerLaSource,
  sourceActivee,
  sourcesActivees,
} = await import('../src/lib/notifications/emission');

import type { ElementDuCentre } from '../src/lib/notifications/modele';
import { peutNotifier } from '../src/lib/notifications/sources';

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

const JOUR = '2026-10-16';
const element = (source: string, id = 'a'.repeat(32)): ElementDuCentre => ({
  id,
  source,
  refSource: 'quelconque',
  genre: 'a-trancher',
  creeLe: JOUR,
  etat: 'non_lu',
  regroupement: null,
});

const repartir = () => {
  magasin = new Map();
  permission = 'default';
  demandes = 0;
  affichees.length = 0;
  occupeParUnAutreOnglet = false;
  tenu = false;
  apiVerrous = true;
  auTableau = [];
  serviceWorkerPresent = false;
  visibilite = 'hidden';
};

console.log('\n\x1b[1m1. Désactivées par défaut (§ 3.4)\x1b[0m');
{
  repartir();
  v('aucune source activée au départ', sourcesActivees(), []);
  v(
    'et rien ne s’émet, même permission accordée',
    (permission = 'granted', await emettre(element('avis-de-fusion'), JOUR)),
    { quoi: 'refusee', pourquoi: 'source-inactive' },
  );
  v('aucune notification affichée', affichees.length, 0);
}

console.log('\n\x1b[1m2. La permission n’est demandée qu’au premier oui\x1b[0m');
{
  repartir();
  v('aucune demande avant le premier réglage', demandes, 0);
  await reglerLaSource('avis-de-fusion', true);
  v('la première activation demande', demandes, 1);
  await reglerLaSource('revue-manquee', true);
  v('la seconde ne redemande pas', demandes, 1);
  vrai('les deux sont activées', sourceActivee('avis-de-fusion') && sourceActivee('revue-manquee'));

  /* Et tout désactiver puis réactiver redemande : c'est de nouveau « la
     première », et le navigateur a pu être réinitialisé entre-temps. */
  await reglerLaSource('avis-de-fusion', false);
  await reglerLaSource('revue-manquee', false);
  v('plus aucune source', sourcesActivees(), []);
  await reglerLaSource('avis-de-fusion', true);
  v('la première d’un nouveau cycle redemande', demandes, 2);
}

console.log('\n\x1b[1m3. Une permission refusée ne casse rien (§ 3.4)\x1b[0m');
{
  repartir();
  permission = 'denied';
  const { etat } = await reglerLaSource('avis-de-fusion', true);
  v('l’état réel est rendu', etat, 'refusee');
  vrai('et le choix reste enregistré', sourceActivee('avis-de-fusion'));
  v(
    'l’émission refuse proprement',
    await emettre(element('avis-de-fusion'), JOUR),
    { quoi: 'refusee', pourquoi: 'permission' },
  );
}

console.log('\n\x1b[1m4. Le cycle est refusé même source activée (§ 1 n° 3)\x1b[0m');
{
  repartir();
  permission = 'granted';
  /*
     On force l'activation d'une source du cycle dans le magasin, ce
     qu'aucun écran ne propose — c'est exactement le but : la troisième
     porte du § 1 n° 3 doit tenir seule, sans compter sur les deux autres.
  */
  magasin.set('cyclades.notifications.sources', JSON.stringify(['journal-du-cycle']));
  v(
    'refusé pour le cycle, pas pour la source',
    await emettre(element('journal-du-cycle'), JOUR),
    { quoi: 'refusee', pourquoi: 'cycle' },
  );
  v('rien n’a été affiché', affichees.length, 0);

  /* Et une source inconnue l'est aussi — le filtre refuse par défaut. */
  magasin.set('cyclades.notifications.sources', JSON.stringify(['source-inventee']));
  v(
    'une source inconnue est traitée comme sensible',
    await emettre(element('source-inventee'), JOUR),
    { quoi: 'refusee', pourquoi: 'cycle' },
  );
}

console.log('\n\x1b[1m4 bis. Deux sources sont admises au centre et MUETTES au système\x1b[0m');
{
  /*
     Le défaut qui a été trouvé en regardant l'écran, pas en lisant le
     code : la veille du rythme (le 27) et l'apprentissage étendu (le 25)
     n'ont pas le droit d'émettre, et l'écran du § 3.4 les proposait
     — avec dix autres — parce que seul le filtre du cycle était consulté.
     Une interdiction qui n'a pas de garde n'est pas une interdiction.
  */
  for (const muette of ['veille-du-rythme', 'apprentissage-etendu']) {
    repartir();
    permission = 'granted';
    /* On force l'activation, que l'écran ne propose plus : le garde doit
       tenir même si quelqu'un écrit le réglage à la main. */
    magasin.set('cyclades.notifications.sources', JSON.stringify([muette]));
    v(
      `« ${muette} » refuse, et pour la bonne raison`,
      await emettre(element(muette), JOUR),
      { quoi: 'refusee', pourquoi: 'source-muette' },
    );
    v('rien affiché', affichees.length, 0);
  }

  /* Et une source ordinaire, elle, n'est pas muette. */
  repartir();
  permission = 'granted';
  await reglerLaSource('revue-manquee', true);
  v('une source ordinaire émet', (await emettre(element('revue-manquee'), JOUR)).quoi, 'emise');

  /*
     Le repli du registre s'éprouve ICI, sur le registre, et pas à travers
     `emettre` : pour une source inconnue, le filtre du cycle refuse avant
     même qu'on y arrive, de sorte qu'un repli bavard ne changerait rien au
     résultat — le sabotage restait vert. Deux barrières l'une derrière
     l'autre : la seconde ne se teste pas en frappant sur la première.
  */
  v('le repli d’une source inconnue est muet', peutNotifier('source-inventee'), false);
  v('et une source déclarée garde sa valeur', peutNotifier('revue-manquee'), true);
}

console.log('\n\x1b[1m5. Le libellé ne dit rien (§ 1 n° 2, décision 3)\x1b[0m');
{
  repartir();
  permission = 'granted';
  await reglerLaSource('avis-de-fusion', true);
  const id = 'b'.repeat(32);
  v('émise', await emettre(element('avis-de-fusion', id), JOUR), { quoi: 'emise' });
  v('une seule notification', affichees.length, 1);
  /*
     LE RELEVÉ EST PRIS UNE FOIS, ET IL A UN REPLI.

     Ces six contrôles lisaient `affichees[0]` directement. Un sabotage du
     lot 0.8 — le prédicat de visibilité inversé — a fait refuser l'émission
     ici, et la section est MORTE sur « Cannot read properties of undefined
     (reading 'titre') », emportant les quatre sections suivantes avec elle.
     Une panne n'est pas un rouge : elle ne dit pas ce qui a cassé, et elle
     cache ce qui allait bien.
  */
  const affichee = affichees[0] ?? { titre: '(rien n’a été affiché)', options: {} };
  v('le titre est le libellé neutre', affichee.titre, TITRE_NEUTRE);
  v('le corps aussi', affichee.options.body, CORPS_NEUTRE);
  /*
     Le défaut visé : un chiffre, un nom de domaine, une source. On lit le
     texte RÉELLEMENT affiché, pas la constante — c'est ce que l'écran
     verrouillé montre.
  */
  const texte = `${affichee.titre} ${affichee.options.body ?? ''}`;
  v('aucun chiffre', /\d/.test(texte), false);
  v('aucun nom de source', /fusion|revue|cycle|santé|sport/i.test(texte), false);
  /* L'étiquette est l'identifiant, pour refermer celle-ci et pas une autre. */
  v('l’étiquette est l’identifiant de l’élément', affichee.options.tag, id);
}

console.log('\n\x1b[1m6. Le plafond du jour (§ 3.3)\x1b[0m');
{
  repartir();
  permission = 'granted';
  await reglerLaSource('avis-de-fusion', true);
  const resultats: string[] = [];
  for (let i = 0; i < PLAFOND_PAR_JOUR + 2; i += 1) {
    const r = await emettre(element('avis-de-fusion', String(i).padStart(32, '0')), JOUR);
    resultats.push(r.quoi === 'emise' ? 'emise' : r.pourquoi);
  }
  v(
    `${PLAFOND_PAR_JOUR} passent, les suivantes sont plafonnées`,
    resultats,
    [...Array(PLAFOND_PAR_JOUR).fill('emise'), 'plafond', 'plafond'],
  );
  v('et autant de notifications affichées', affichees.length, PLAFOND_PAR_JOUR);

  /* Le lendemain repart à zéro : le plafond est quotidien, pas définitif. */
  v(
    'le lendemain, ça repasse',
    (await emettre(element('avis-de-fusion'), '2026-10-17')).quoi,
    'emise',
  );
}

console.log('\n\x1b[1m6 bis. La page sous les yeux ne s’interrompt pas (0.8 du 43)\x1b[0m');
{
  repartir();
  permission = 'granted';
  await reglerLaSource('avis-de-fusion', true);

  /* Page regardée : refus nommé, et RIEN d'affiché. */
  visibilite = 'visible';
  v(
    'page regardée : refusée, et la raison est la sienne',
    await emettre(element('avis-de-fusion', 'c'.repeat(32)), JOUR),
    { quoi: 'refusee', pourquoi: 'page-regardee' },
  );
  v('et aucune notification n’est partie', affichees.length, 0);

  /*
     ET LE PLAFOND N'A PAS BOUGÉ. C'est l'autre moitié de la règle : une
     émission retenue parce qu'on regardait l'écran n'est pas une
     interruption. Si elle comptait, cinq coups d'œil au site le matin
     feraient taire les cinq vraies notifications de la journée.

     On le mesure par l'effet, et non en relisant le compteur : on cache la
     page, puis on émet le plafond entier. S'il en restait une consommée,
     la dernière serait plafonnée.
  */
  visibilite = 'hidden';
  const suite: string[] = [];
  for (let i = 0; i < PLAFOND_PAR_JOUR; i += 1) {
    const r = await emettre(element('avis-de-fusion', `d${String(i).padStart(31, '0')}`), JOUR);
    suite.push(r.quoi === 'emise' ? 'emise' : r.pourquoi);
  }
  v(
    'page cachée : les cinq du jour restent entières',
    suite,
    Array(PLAFOND_PAR_JOUR).fill('emise'),
  );
  v('et cinq notifications sont bien parties', affichees.length, PLAFOND_PAR_JOUR);

  /*
     Le refus vient APRÈS la permission et AVANT le plafond, et l'ordre se
     mesure : sans permission, la raison doit rester « permission », sinon
     l'écran des notifications dirait « rien ne part parce que vous regardez
     la page » à quelqu'un qui n'a tout simplement rien accordé.
  */
  repartir();
  permission = 'default';
  await reglerLaSource('avis-de-fusion', true);
  visibilite = 'visible';
  v(
    'sans permission, la raison reste la permission',
    await emettre(element('avis-de-fusion'), JOUR),
    { quoi: 'refusee', pourquoi: 'permission' },
  );

  /*
     Et une source MUETTE le reste : la visibilité ne doit pas devenir la
     seule raison affichée, sans quoi la cacher suffirait à croire qu'une
     source interdite va parler.
  */
  repartir();
  permission = 'granted';
  await reglerLaSource('veille-du-rythme', true);
  visibilite = 'visible';
  v(
    'une source muette est refusée pour son silence, pas pour la page',
    await emettre(element('veille-du-rythme'), JOUR),
    { quoi: 'refusee', pourquoi: 'source-muette' },
  );
}

console.log('\n\x1b[1m7. Un seul émetteur par appareil (§ 3.5)\x1b[0m');
{
  repartir();
  permission = 'granted';
  await reglerLaSource('avis-de-fusion', true);
  occupeParUnAutreOnglet = true;
  v(
    'un autre onglet tient le verrou : on n’émet pas',
    await emettre(element('avis-de-fusion'), JOUR),
    { quoi: 'refusee', pourquoi: 'autre-onglet' },
  );
  v('rien affiché', affichees.length, 0);

  /* Sans l'API du tout, on s'abstient aussi : trois notifications
     identiques valent moins que zéro. */
  repartir();
  permission = 'granted';
  await reglerLaSource('avis-de-fusion', true);
  apiVerrous = false;
  v(
    'sans API de verrous, on s’abstient',
    await emettre(element('avis-de-fusion'), JOUR),
    { quoi: 'refusee', pourquoi: 'sans-verrou' },
  );
  v('rien affiché', affichees.length, 0);
}

console.log('\n\x1b[1m8. Le verrou est relâché, même sur un refus tardif\x1b[0m');
{
  repartir();
  permission = 'granted';
  await reglerLaSource('avis-de-fusion', true);
  /*
     Deux émissions de suite : si la première gardait le verrou, la seconde
     se verrait refuser « autre-onglet » alors qu'il n'y a qu'un onglet.
     C'est le genre de fuite qui ne se voit qu'à la deuxième notification.
  */
  await emettre(element('avis-de-fusion', 'c'.repeat(32)), JOUR);
  v('le verrou n’est plus tenu après la première', tenu, false);
  v(
    'et la seconde passe, donc il a bien été rendu',
    (await emettre(element('avis-de-fusion', 'd'.repeat(32)), JOUR)).quoi,
    'emise',
  );
}

console.log('\n\x1b[1m9. Refermer : tout au verrouillage, le reste par complément (§ 3.5)\x1b[0m');
{
  const ouvertes = () => auTableau.filter((n) => !n.fermee).map((n) => n.tag).sort();

  repartir();
  serviceWorkerPresent = true;
  auTableau = [
    { tag: 'q1', fermee: false },
    { tag: 'q2', fermee: false },
    { tag: 'q3', fermee: false },
  ];
  /*
     Le cas de l'ouverture d'une page : q2 est encore à trancher, les deux
     autres sont tranchées. On ferme par COMPLÉMENT, pour attraper aussi ce
     qu'un autre onglet a affiché et qu'on n'a jamais vu.
  */
  v('deux fermées par complément', await refermer({ saufCes: ['q2'] }), 2);
  v('la question encore ouverte reste', ouvertes(), ['q2']);

  /* Le verrouillage, maintenant : tout part. */
  auTableau = [
    { tag: 'q1', fermee: false },
    { tag: 'q2', fermee: false },
  ];
  v('le verrouillage ferme tout', await refermer({ toutes: true }), 2);
  v('il ne reste rien', ouvertes(), []);

  /* Et le ciblage exact, pour une seule. */
  auTableau = [
    { tag: 'q1', fermee: false },
    { tag: 'q2', fermee: false },
  ];
  v('une seule, nommément', await refermer({ ces: ['q1'] }), 1);
  v('l’autre est intacte', ouvertes(), ['q2']);

  /* Sans service worker, rien à retirer — et surtout, pas d'exception. */
  repartir();
  serviceWorkerPresent = false;
  v('sans service worker, zéro et pas d’erreur', await refermer({ toutes: true }), 0);
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
