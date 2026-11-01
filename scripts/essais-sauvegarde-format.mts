/**
 * Les essais du format `.cyclades`.
 *
 * Ce format est le seul recours contre une perte totale : si l'écriture ou la
 * relecture se trompe, on ne s'en aperçoit **que le jour où l'on a besoin de
 * restaurer**, c'est-à-dire le jour où il est trop tard. D'où le nombre
 * d'invariants vérifiés ici, et le soin mis aux cas d'échec — un fichier refusé
 * avec un bon message vaut infiniment mieux qu'un fichier accepté à moitié.
 *
 * Le module de format est pur : ces essais tournent hors navigateur, en
 * quelques secondes, sans serveur et sans mot de passe du site.
 */
import {
  ITERATIONS_PAR_DEFAUT,
  LIGNE_RECONNAISSANCE,
  SauvegardeRefusee,
  VERSION_FORMAT,
  VERSION_SANS_EN_TETE_AUTHENTIFIE,
  ecrire,
  ligneDEnTete,
  lireEnTete,
  nomDeFichier,
  relire,
  verifier,
  type Magasins,
} from '../src/lib/sauvegarde/format';
/*
   ET « service.ts », POUR UNE SEULE SECTION — celle du magasin scellé et
   inconnu. Ce fichier éprouve d'ordinaire le module de format seul, qui est
   pur ; mais ce que M-2bis (b) corrige est précisément une COUTURE entre les
   deux — ce que l'en-tête cesse de dire, et où la restauration doit le
   rattraper. L'éprouver des deux côtés séparément ne dirait rien de la couture.
   Les deux fonctions employées ici sont pures et ne touchent pas la base.
*/
import { apercu, magasinsInconnus } from '../src/lib/sauvegarde/service';

let echecs = 0;
const verifierQue = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

/** Capture le refus attendu, et son motif. */
async function refus(intitule: string, motifAttendu: string, action: () => Promise<unknown>) {
  try {
    await action();
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      aucun refus : l’action a réussi`);
  } catch (e) {
    const motif = e instanceof SauvegardeRefusee ? e.motif : `(${(e as Error).name})`;
    verifierQue(intitule, motif, motifAttendu);
    if (e instanceof SauvegardeRefusee && !e.message.trim()) {
      echecs += 1;
      console.log('      refus sans message : inacceptable');
    }
  }
}

/* Les itérations PBKDF2 réelles coûtent une seconde par dérivation. Les essais
   en utilisent peu : ils vérifient la mécanique, pas la résistance du KDF, qui
   se règle par un nombre et se vérifie par lecture. */
const ITERATIONS = 1000;

const BRANCHES = [
  { id: 'revisions', schema: 10, magasins: ['cartes', 'seances', 'jours'] },
];

const MAGASINS: Magasins = {
  cartes: [
    { id: 'a:0', ficheId: 'a', matiere: 'Droit public', intervalle: 12 },
    { id: 'a:1', ficheId: 'a', matiere: 'Droit public', intervalle: 3 },
  ],
  seances: [
    { id: 1, theme: 'droit-public', jour: '2026-03-04', note: 'Une note de séance.\n\nAvec un paragraphe.' },
  ],
  jours: [{ jour: '2026-03-04', xp: 60, cartes: 22 }],
};

const ecrireJeu = (motDePasse: string | null, magasins = MAGASINS) =>
  ecrire({
    magasins,
    branches: BRANCHES,
    versionApplication: '1.0.0',
    portee: { branches: ['revisions'], parcours: ['insp'] },
    motDePasse,
    iterations: ITERATIONS,
    maintenant: new Date('2026-10-11T09:30:00.000Z'),
  });

console.log('\nALLER-RETOUR, CHIFFRÉ');

{
  const s = await ecrireJeu('un-mot-de-passe');
  const r = await relire(s.octets, 'un-mot-de-passe');
  verifierQue('les magasins reviennent à l’identique', r.magasins, MAGASINS);
  verifierQue('aucune ligne illisible', r.lignesIllisibles, 0);
  verifierQue('les compteurs de l’en-tête sont justes', r.entete.magasins, {
    cartes: 2,
    seances: 1,
    jours: 1,
  });
  verifierQue('la portée est conservée', r.entete.portee, {
    branches: ['revisions'],
    parcours: ['insp'],
  });
  verifierQue('les branches et leur schéma sont conservés', r.entete.branches, BRANCHES);
  verifierQue('le format est chiffré par défaut', r.entete.chiffrement?.chiffrement, 'AES-GCM');
  verifierQue('la dérivation est PBKDF2-SHA256', r.entete.chiffrement?.kdf, 'PBKDF2-SHA256');
  verifierQue('la compression est annoncée', r.entete.compression, 'gzip');
}

console.log('\nL’EN-TÊTE EST LISIBLE SANS MOT DE PASSE');

{
  const s = await ecrireJeu('un-mot-de-passe');
  const texte = new TextDecoder().decode(s.octets.subarray(0, 600));
  verifierQue(
    'le fichier s’annonce dès sa première ligne',
    texte.startsWith(`${LIGNE_RECONNAISSANCE}\n`),
    true,
  );
  const entete = lireEnTete(s.octets);
  verifierQue('l’en-tête se lit sans déchiffrer', entete.versionFormat, VERSION_FORMAT);
  verifierQue('il porte la date de création', entete.creeLe, '2026-10-11T09:30:00.000Z');
  verifierQue('il porte la version de l’application', entete.versionApplication, '1.0.0');

  const v = await verifier(s.octets);
  verifierQue('la vérification à blanc dit le fichier intact', v.intacte, true);
  verifierQue('et dit qu’il est chiffré', v.chiffree, true);
}

console.log('\nAUCUN SECRET, AUCUN CONTENU DE COURS DANS LE FICHIER');

/*
 * Le prompt l'exige, et c'est la propriété la plus facile à perdre par
 * inadvertance : il suffit qu'un futur appelant passe le mot de passe dans un
 * champ de l'en-tête « pour information ». L'essai cherche le mot de passe dans
 * les octets du fichier, en clair et en base64.
 */
{
  const MDP = 'un-mot-de-passe-bien-reconnaissable';
  const s = await ecrireJeu(MDP);
  const octets = new TextDecoder('latin1').decode(s.octets);
  verifierQue('le mot de passe n’apparaît pas en clair', octets.includes(MDP), false);
  verifierQue(
    'ni en base64',
    octets.includes(Buffer.from(MDP, 'utf8').toString('base64')),
    false,
  );
  const entete = lireEnTete(s.octets);
  const champs = JSON.stringify(entete);
  verifierQue('ni dans un champ de l’en-tête', champs.includes(MDP), false);
  verifierQue(
    'l’en-tête ne porte aucun champ de clé',
    /\b(cle|cleDerivee|key|motDePasse|password)\b/i.test(champs),
    false,
  );
  // La note de séance, elle, doit bien être dans le fichier — mais chiffrée.
  verifierQue(
    'le contenu rédigé n’est pas lisible en clair',
    octets.includes('Une note de séance'),
    false,
  );
}

console.log('\nL’ANCIEN MOT DE PASSE OUVRE L’ANCIENNE SAUVEGARDE');

/*
 * L'écueil que le prompt nomme, et qui s'est réalisé le 11 octobre 2026 : le
 * mot de passe du site a changé. Tout ce qu'il faut pour redériver la clé d'un
 * fichier — son sel, son nombre d'itérations — voyage dans ce fichier, et nulle
 * part ailleurs. Une sauvegarde garde donc le mot de passe qu'elle avait le
 * jour où elle a été faite, pour toujours.
 */
{
  const ancienne = await ecrireJeu('ancien-mot-de-passe');
  const nouvelle = await ecrireJeu('nouveau-mot-de-passe');

  const r = await relire(ancienne.octets, 'ancien-mot-de-passe');
  verifierQue('l’ancienne s’ouvre avec l’ancien mot de passe', r.magasins.jours?.length, 1);

  await refus(
    'et pas avec le nouveau',
    'mot-de-passe',
    () => relire(ancienne.octets, 'nouveau-mot-de-passe'),
  );

  const r2 = await relire(nouvelle.octets, 'nouveau-mot-de-passe');
  verifierQue('la nouvelle s’ouvre avec le nouveau', r2.magasins.jours?.length, 1);

  verifierQue(
    'deux sauvegardes du même contenu ont des sels différents',
    ancienne.entete.chiffrement?.sel === nouvelle.entete.chiffrement?.sel,
    false,
  );
  verifierQue(
    'et des vecteurs d’initialisation différents',
    ancienne.entete.chiffrement?.iv === nouvelle.entete.chiffrement?.iv,
    false,
  );
}

console.log('\nLES REFUS, CHACUN AVEC SON MOTIF');

await refus('un fichier quelconque n’est pas une sauvegarde', 'pas-une-sauvegarde', async () =>
  lireEnTete(new TextEncoder().encode('{"ceci":"un JSON ordinaire"}\nautre chose\n')),
);

await refus('un fichier vide non plus', 'pas-une-sauvegarde', async () =>
  lireEnTete(new Uint8Array(0)),
);

await refus('une sauvegarde sans en-tête est refusée', 'entete-illisible', async () =>
  lireEnTete(new TextEncoder().encode(`${LIGNE_RECONNAISSANCE}\n`)),
);

await refus('un en-tête qui n’est pas du JSON est refusé', 'entete-illisible', async () =>
  lireEnTete(new TextEncoder().encode(`${LIGNE_RECONNAISSANCE}\npas du json\ncharge`)),
);

{
  // Une version future : on refuse, on ne devine pas.
  const s = await ecrireJeu('mdp');
  const texte = new TextDecoder().decode(s.octets);
  const abime = texte.replace(
    `"versionFormat":${VERSION_FORMAT}`,
    `"versionFormat":${VERSION_FORMAT + 1}`,
  );
  await refus('une version de format plus récente est refusée', 'version-trop-recente', async () =>
    lireEnTete(new TextEncoder().encode(abime)),
  );
}

{
  // Une troncature : la somme de contrôle doit la voir.
  const s = await ecrireJeu('mdp');
  const tronquee = s.octets.slice(0, s.octets.length - 40);
  const v = await verifier(tronquee);
  verifierQue('la vérification à blanc voit la troncature', v.intacte, false);
  await refus('et la relecture la refuse', 'somme-de-controle', () => relire(tronquee, 'mdp'));
}

await refus('une sauvegarde chiffrée sans mot de passe est refusée', 'mot-de-passe', async () => {
  const s = await ecrireJeu('mdp');
  return relire(s.octets);
});

{
  const s = await ecrireJeu('mdp');
  try {
    await relire(s.octets, 'pas-le-bon');
  } catch (e) {
    const msg = (e as Error).message;
    verifierQue(
      'le message du mauvais mot de passe suggère l’ancien',
      /ancien/i.test(msg),
      true,
    );
  }
}

console.log('\nCHIFFREMENT DÉSACTIVÉ : POSSIBLE, ET DIT');

{
  const s = await ecrireJeu(null);
  verifierQue('l’en-tête dit qu’il n’y a pas de chiffrement', s.entete.chiffrement, null);
  const v = await verifier(s.octets);
  verifierQue('la vérification le dit aussi', v.chiffree, false);
  const r = await relire(s.octets);
  verifierQue('la relecture n’a besoin d’aucun mot de passe', r.magasins, MAGASINS);
  /*
   * Non chiffré veut dire lisible, et c'est tout l'objet de l'avertissement que
   * l'interface doit afficher. L'essai le vérifie plutôt que de le supposer :
   * un fichier dont on croirait qu'il protège quelque chose serait pire qu'un
   * fichier dont on sait qu'il ne protège rien.
   */
  const { gunzipSync } = await import('node:zlib');
  const debut = s.octets.indexOf(10, s.octets.indexOf(10) + 1) + 1;
  const clair = gunzipSync(s.octets.slice(debut)).toString('utf8');
  verifierQue(
    'et le contenu rédigé est bien lisible, décompression faite',
    clair.includes('Une note de séance'),
    true,
  );
}

console.log('\nUN MAGASIN INCONNU N’EST PAS PERDU');

/*
 * Le prompt l'exige : « magasins ou branches inconnus dans le fichier : les
 * conserver tels quels sans les perdre, pour qu'une sauvegarde faite par une
 * version future ne soit pas amputée ». Le format n'a donc aucune liste blanche
 * de magasins — il transporte ce qu'on lui donne.
 */
{
  const avecFutur: Magasins = {
    ...MAGASINS,
    sportSeries: [{ id: 1, exercice: 'developpe-couche', charge: 80, repetitions: 5 }],
    odysseeCheckins: [{ jour: '2026-10-11', humeur: 4 }],
  };
  const s = await ecrireJeu('mdp', avecFutur);
  const r = await relire(s.octets, 'mdp');
  verifierQue('les magasins futurs reviennent entiers', r.magasins, avecFutur);
  verifierQue('et l’en-tête les compte', r.entete.magasins.sportSeries, 1);
}

console.log('\nCOMPRESSION : UN GAIN RÉEL SUR DU TEXTE RÉDIGÉ');

{
  const phrase =
    'La hiérarchie des normes repose sur une articulation que la jurisprudence a précisée par étapes. ';
  const grosse: Magasins = {
    seances: Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      theme: 'droit-public',
      jour: '2026-03-04',
      note: phrase.repeat(40),
    })),
  };
  const s = await ecrireJeu('mdp', grosse);
  const rapport = s.tailleFichier / s.tailleClair;
  console.log(
    `      clair ${s.tailleClair} o → fichier ${s.tailleFichier} o ` +
      `(${(rapport * 100).toFixed(1)} %)`,
  );
  verifierQue('le fichier pèse moins du quart du clair', rapport < 0.25, true);
  const r = await relire(s.octets, 'mdp');
  verifierQue('et se relit sans perte', r.magasins.seances?.length, 60);
}

console.log('\nNOM DE FICHIER');

verifierQue(
  'le nom suit la convention annoncée',
  nomDeFichier(new Date(2026, 9, 11, 9, 5)),
  'cyclades-sauvegarde-2026-10-11-0905.cyclades',
);

console.log('\nITÉRATIONS PAR DÉFAUT');

verifierQue(
  'la valeur par défaut suit la recommandation OWASP du site',
  ITERATIONS_PAR_DEFAUT,
  600_000,
);

console.log('\n\x1b[1mLE FORMAT v2 — L’EN-TÊTE EST AUTHENTIFIÉ (M-1)\x1b[0m');

/*
   Un petit jeu de magasins, dont un SCELLÉ au sens du dépôt. On ne lit pas le
   registre du coffre ici — `format.ts` est pur et ne le connaît pas — on lui
   dit lequel l'est, exactement comme `service.ts` le fait.
*/
const MAGASINS_ESSAI: Magasins = {
  cartes: [{ id: 'c1' }, { id: 'c2' }],
  odysseeCycleJournal: [{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }],
};
const SCELLES = ['odysseeCycleJournal'];
const MDP = 'un-mot-de-passe-d-essai';

const faire = (plus: Record<string, unknown> = {}) =>
  ecrire({
    magasins: MAGASINS_ESSAI,
    branches: [{ id: 'revisions', schema: 43, magasins: Object.keys(MAGASINS_ESSAI) }],
    versionApplication: 'essai',
    portee: { branches: ['revisions'] },
    motDePasse: MDP,
    magasinsScelles: SCELLES,
    maintenant: new Date('2026-10-31T12:00:00.000Z'),
    ...plus,
  } as never);

{
  const s = await faire();
  verifierQue('un fichier neuf porte la version 2', s.entete.versionFormat, 2);

  /* L'aller-retour d'abord : sans lui, le reste ne prouve rien. */
  const relu = await relire(s.octets, MDP);
  verifierQue('il se relit à l’identique', relu.magasins, MAGASINS_ESSAI);

  /*
     LE SABOTAGE QUI COMPTE. On modifie l'en-tête — une date, le champ le plus
     anodin qui soit — et le déchiffrement doit ÉCHOUER. En version 1 il
     réussissait : l'en-tête n'était authentifié par rien, et une sauvegarde
     pouvait annoncer n'importe quoi sans que rien ne bronche.

     On touche à `creeLe` plutôt qu'à un compte, et c'est délibéré : si même la
     date est protégée, tout l'en-tête l'est, puisque les données associées
     sont la ligne entière.
  */
  const ligne = ligneDEnTete(s.octets);
  const truque = ligne.replace('2026-10-31T12:00:00.000Z', '2020-01-01T00:00:00.000Z');
  verifierQue('la ligne truquée diffère bien de l’originale', truque !== ligne, true);
  const octetsTruques = new Uint8Array([
    ...new TextEncoder().encode(`${LIGNE_RECONNAISSANCE}\n${truque}\n`),
    ...s.octets.subarray(s.octets.indexOf(10, s.octets.indexOf(10) + 1) + 1),
  ]);
  await refus(
    'un en-tête modifié fait échouer le déchiffrement',
    'mot-de-passe',
    () => relire(octetsTruques, MDP),
  );

  /*
     ET LA SOMME, ELLE, PEUT CHANGER SANS ROMPRE LES DONNÉES ASSOCIÉES —
     c'est le dénouement de la circularité. Elle est mise en zéros des deux
     côtés, donc elle ne participe pas à l'authentification ; elle est
     vérifiée séparément, et son propre refus a son propre motif.
  */
  const sommeFaussee = ligne.replace(/("valeur":")[0-9a-f]{64}(")/, `$1${'f'.repeat(64)}$2`);
  verifierQue('la somme a bien été faussée', sommeFaussee !== ligne, true);
  const octetsSommeFaussee = new Uint8Array([
    ...new TextEncoder().encode(`${LIGNE_RECONNAISSANCE}\n${sommeFaussee}\n`),
    ...s.octets.subarray(s.octets.indexOf(10, s.octets.indexOf(10) + 1) + 1),
  ]);
  await refus(
    'une somme faussée est refusée par la somme, et non par le mot de passe',
    'somme-de-controle',
    () => relire(octetsSommeFaussee, MDP),
  );
}

console.log('\n\x1b[1mNI NOM NI COMPTE SCELLÉ DANS LE CLAIR (M-2 et M-2bis)\x1b[0m');
{
  const s = await faire();
  const enClair = ligneDEnTete(s.octets);
  verifierQue('le magasin non scellé garde son compte nommé', s.entete.magasins.cartes, 2);
  verifierQue(
    'le magasin scellé n’a plus de compte nommé',
    'odysseeCycleJournal' in s.entete.magasins,
    false,
  );
  /*
     ET PLUS DE TOTAL NON PLUS — M-2bis. La première version en gardait un, et
     la limite était écrite dans le module plutôt que tue. Le pilote a tranché :
     un total dit encore l'ordre de grandeur de ce qui est scellé, et il ne vaut
     que pour quelqu'un qui en a — « zéro » et « quatre cents » ne disent pas la
     même chose de la personne.
  */
  verifierQue('et il n’y a plus de total du tout', 'scelles' in s.entete, false);
  /*
     ET LE NOM A QUITTÉ « branches ». C'était la dernière fuite, et la plus
     bête : un compte retiré dont le nom reste ne cache rien de ce qui compte.
     « odysseeCycleJournal est dans ce fichier » dit déjà que la personne suit
     son cycle, avant même de savoir combien.
  */
  verifierQue(
    'et la branche ne déclare plus le magasin scellé',
    s.entete.branches[0].magasins,
    ['cartes'],
  );
  verifierQue(
    'mais elle déclare toujours ce qui n’est pas scellé',
    s.entete.branches[0].magasins.includes('cartes'),
    true,
  );

  /*
     LE CONTRÔLE QUI COMPTE, ET IL PORTE SUR LE FICHIER ENTIER.

     Les quatre précédents interrogent l'en-tête DÉJÀ ANALYSÉ, c'est-à-dire
     l'objet que ce module a bien voulu rendre. Ils passeraient tous le jour où
     le nom se glisserait ailleurs dans le clair — dans un champ ajouté, dans
     la portée, dans un futur index. Celui-ci lit les OCTETS, comme le ferait
     la personne qui ouvre le fichier dans un éditeur de texte, et c'est elle
     qu'on protège.
  */
  const octetsEnClair = Buffer.from(s.octets).toString('latin1');
  verifierQue(
    'aucun nom de magasin scellé dans les octets en clair du fichier',
    octetsEnClair.includes('odysseeCycleJournal'),
    false,
  );
  verifierQue(
    'et aucun compte de magasin scellé dans la carte en clair',
    /"odysseeCycleJournal"\s*:\s*3/.test(enClair),
    false,
  );

  /*
     ET LE SABOTAGE, sans lequel les deux précédents ne prouveraient rien : un
     contrôle qui cherche une chaîne absente passe aussi quand la chaîne ne
     pouvait pas y être. On réécrit donc le MÊME fichier sans déclarer aucun
     magasin scellé — c'est exactement ce que faisait la version 1 — et le nom
     doit reparaître. S'il ne reparaît pas, le contrôle ci-dessus ne garde rien.
  */
  const sansProtection = await faire({ magasinsScelles: [] });
  const clairSansProtection = Buffer.from(sansProtection.octets).toString('latin1');
  verifierQue(
    'et sans la protection, ce nom SE LIT dans le clair — le contrôle mord',
    clairSansProtection.includes('odysseeCycleJournal'),
    true,
  );
  verifierQue(
    'et son compte aussi',
    /"odysseeCycleJournal"\s*:\s*3/.test(ligneDEnTete(sansProtection.octets)),
    true,
  );

  /* Le fichier, lui, porte bien les trois enregistrements : rien n'est perdu. */
  const relu = await relire(s.octets, MDP);
  verifierQue(
    'les enregistrements scellés sont tous là, après le mot de passe',
    (relu.magasins.odysseeCycleJournal as unknown[]).length,
    3,
  );
  verifierQue(
    'et c’est là que leur nom se lit, et nulle part avant',
    Object.keys(relu.magasins).includes('odysseeCycleJournal'),
    true,
  );
}

console.log('\n\x1b[1mUN MAGASIN SCELLÉ ET INCONNU RESTE SIGNALÉ (M-2bis b)\x1b[0m');
{
  /*
     CE QUE M-2bis COÛTE, ET CE QUI LE COMPENSE.

     Un magasin SCELLÉ que cette version ne sait pas écrire — ce que porterait
     une sauvegarde venue d'une version plus récente — n'est plus nommé dans
     l'en-tête en clair. « Vérifier cette sauvegarde », qui répond sans mot de
     passe, ne peut donc plus le voir : c'est le prix de l'arbitrage, et il est
     mesuré ici plutôt qu'admis.

     La compensation est que le compte se fait désormais sur la charge utile
     DÉCHIFFRÉE, avant l'instantané et avant l'écriture. Les deux assertions
     vont donc par paire : l'une montre la perte, l'autre montre qu'elle est
     rattrapée. Séparées, aucune des deux ne dirait quoi que ce soit.
  */
  const AVEC_INCONNU: Magasins = {
    cartes: [{ id: 'c1' }],
    odysseeRituelFutur: [{ id: 'f1' }, { id: 'f2' }],
  };
  const fichier = await ecrire({
    magasins: AVEC_INCONNU,
    branches: [{ id: 'revisions', schema: 99, magasins: Object.keys(AVEC_INCONNU) }],
    versionApplication: 'essai',
    portee: { branches: ['revisions'] },
    motDePasse: MDP,
    magasinsScelles: ['odysseeRituelFutur'],
    maintenant: new Date('2026-10-31T12:00:00.000Z'),
  } as never);

  const vu = await apercu(fichier.octets);
  verifierQue(
    'sans mot de passe, le magasin scellé inconnu est INVISIBLE — le prix de M-2bis',
    vu.magasinsInconnus.includes('odysseeRituelFutur'),
    false,
  );
  verifierQue(
    'et la vérification à blanc garde tout de même son objet',
    vu.entete.versionFormat,
    VERSION_FORMAT,
  );

  const relu = await relire(fichier.octets, MDP);
  verifierQue(
    'après le mot de passe, il est signalé — et AVANT toute écriture',
    magasinsInconnus(Object.keys(relu.magasins)),
    ['odysseeRituelFutur'],
  );
  /*
     ET LE SABOTAGE : si le compte se faisait sur l'en-tête plutôt que sur la
     charge utile — ce qu'il faisait avant M-2bis (b) — ce magasin passerait
     inaperçu. C'est exactement la régression que l'assertion précédente garde.
  */
  verifierQue(
    'alors que le compter sur l’en-tête le manquerait — la régression gardée',
    magasinsInconnus(Object.keys(relu.entete.magasins)),
    [],
  );
  /* Et ce qui est connu reste connu : le contrôle ne crie pas sur tout. */
  verifierQue(
    'et un magasin connu n’est pas signalé',
    magasinsInconnus(['cartes']),
    [],
  );
}

console.log('\n\x1b[1mLA VERSION 1 RESTE LISIBLE\x1b[0m');
{
  /*
     UN VRAI FICHIER DE VERSION 1, écrit par la même chaîne de chiffrement. Le
     fabriquer autrement — en réécrivant la dérivation de clé dans l'essai —
     serait la duplication que ce module refuse, et l'essai éprouverait alors
     sa propre copie au lieu du code livré.
  */
  const v1 = await faire({ versionFormat: VERSION_SANS_EN_TETE_AUTHENTIFIE });
  verifierQue('le fichier annonce la version 1', v1.entete.versionFormat, 1);
  verifierQue(
    'et il compte TOUS ses magasins en clair, comme le faisait la version 1',
    v1.entete.magasins.odysseeCycleJournal,
    3,
  );
  verifierQue('sans total séparé', 'scelles' in v1.entete, false);
  /*
     ET ELLE DÉCLARE ENCORE LE MAGASIN SCELLÉ DANS SA BRANCHE. C'est le défaut
     que M-2bis ferme, et il doit rester visible ICI : un fichier de version 1
     écrit par la version d'aujourd'hui doit être un vrai fichier de version 1,
     sinon l'essai de compatibilité éprouve un fichier qui n'a jamais existé.
  */
  verifierQue(
    'et sa branche déclare encore tous ses magasins, comme en version 1',
    [...v1.entete.branches[0].magasins].sort(),
    ['cartes', 'odysseeCycleJournal'],
  );

  const relu = await relire(v1.octets, MDP);
  verifierQue('il se relit à l’identique', relu.magasins, MAGASINS_ESSAI);

  /*
     ET SON EN-TÊTE N'EST PAS AUTHENTIFIÉ — c'est le défaut que la version 2
     corrige, et le constater sur un vrai fichier de version 1 est la seule
     façon de montrer que la correction en est bien une. Modifier la date d'un
     fichier de version 1 ne l'empêche pas de s'ouvrir.

     Il faut refaire la somme, sinon c'est elle qui refuserait et l'on
     mesurerait la mauvaise chose.
  */
  const ligne = ligneDEnTete(v1.octets);
  const debut = v1.octets.indexOf(10, v1.octets.indexOf(10) + 1) + 1;
  const charge = v1.octets.subarray(debut);
  const somme = [...new Uint8Array(await crypto.subtle.digest('SHA-256', charge))]
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
  const truque = ligne
    .replace('2026-10-31T12:00:00.000Z', '2020-01-01T00:00:00.000Z')
    .replace(/("valeur":")[0-9a-f]{64}(")/, `$1${somme}$2`);
  const octetsTruques = new Uint8Array([
    ...new TextEncoder().encode(`${LIGNE_RECONNAISSANCE}\n${truque}\n`),
    ...charge,
  ]);
  const reluTruque = await relire(octetsTruques, MDP);
  verifierQue(
    'un en-tête de version 1 modifié s’ouvre quand même — le défaut que v2 ferme',
    reluTruque.entete.creeLe,
    '2020-01-01T00:00:00.000Z',
  );
  verifierQue('et ses données sont intactes', reluTruque.magasins, MAGASINS_ESSAI);
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
