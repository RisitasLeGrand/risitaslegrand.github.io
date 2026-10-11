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
  ecrire,
  lireEnTete,
  nomDeFichier,
  relire,
  verifier,
  type Magasins,
} from '../src/lib/sauvegarde/format';

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

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
