/**
 * L'enveloppe du coffre : le témoin, le mot de passe changé, et l'ordre.
 *
 * Ce que ces essais protègent tient en une phrase : **un mot de passe faux
 * doit être refusé, pas servi**. L'ancien coffre comparait une empreinte
 * SHA-256 sans sel, publiée dans le paquet du site ; le retirer sans rien
 * mettre à la place aurait fait dériver une clé fausse et chiffrer des
 * enregistrements que plus rien n'ouvrirait. C'est le défaut que le premier
 * bloc vise, et il le vise sur le refus, pas sur le succès.
 *
 * Le second bloc vise l'autre promesse, celle qui a décidé de l'architecture :
 * **changer le mot de passe ne touche à aucune donnée**. On le prouve en
 * chiffrant avant, en changeant, et en relisant après — pas en relisant le
 * code.
 *
 * Node fournit `crypto.subtle` : le chiffrement s'éprouve donc pour de vrai,
 * sans navigateur, avec une carte en mémoire à la place d'IndexedDB.
 */
import {
  CLEF_ENVELOPPE,
  CLEF_SEL_ENVELOPPE,
  ITERATIONS_ENVELOPPE,
  changerLeMotDePasseDuCoffre,
  enveloppePosee,
  ouvrirLEnveloppe,
  poserLEnveloppe,
  type RangementDesCles,
} from '../src/lib/noyau/enveloppe-du-coffre';

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

/** Une carte en mémoire, à la place d'IndexedDB. */
const carte = (): RangementDesCles & { contenu: Map<string, string> } => {
  const contenu = new Map<string, string>();
  return {
    contenu,
    lire: async (c) => contenu.get(c),
    ecrire: async (c, valeur) => void contenu.set(c, valeur),
    effacer: async (c) => void contenu.delete(c),
  };
};

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

/** Chiffre un texte sous une clé, comme le fait un magasin scellé. */
const sceller = async (cle: CryptoKey, texte: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cle,
    encodeur.encode(texte),
  );
  return { iv, ct };
};

/**
 * Ouvre un scellé, et rend « REFUSÉ » plutôt que de lever.
 *
 * Sans ce `catch`, une clé fausse faisait **planter** l'essai au lieu de le
 * faire échouer — et le banc de sabotage, qui ne lit que les lignes d'échec,
 * concluait que le contrôle ne mordait pas. Un contrôle qui confond l'échec
 * et la panne ne rapporte rien : c'est le défaut qui a laissé passer le
 * sabotage « changer le mot de passe tire une clé neuve ».
 */
const ouvrirLeScelle = async (cle: CryptoKey, scelle: { iv: Uint8Array; ct: ArrayBuffer }) => {
  try {
    return decodeur.decode(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: scelle.iv }, cle, scelle.ct),
    );
  } catch {
    return 'REFUSÉ — la clé n’ouvre pas ce scellé';
  }
};

const MDP = 'un-mot-de-passe-de-coffre-pour-essai';

console.log("\nLE TÉMOIN : UN MOT DE PASSE FAUX EST REFUSÉ, PAS SERVI");

{
  const r = carte();
  v('sans enveloppe, il n’y a rien à ouvrir', await enveloppePosee(r), false);
  v('et l’ouverture rend null plutôt qu’une clé', await ouvrirLEnveloppe(r, MDP), null);

  const posee = await poserLEnveloppe(r, MDP);
  v('une fois posée, l’enveloppe existe', await enveloppePosee(r), true);

  /*
     Le cœur de l'affaire. Un mot de passe faux doit rendre `null`. S'il
     rendait une clé, elle serait fausse, et tout ce qu'elle chiffrerait
     deviendrait illisible — le défaut exact de l'ancien coffre si on lui
     retirait son empreinte.
  */
  v('un mot de passe faux ne rend pas de clé', await ouvrirLEnveloppe(r, `${MDP}x`), null);
  v('une casse différente ne passe pas non plus', await ouvrirLEnveloppe(r, MDP.toUpperCase()), null);
  v('un mot de passe vide ne passe pas', await ouvrirLEnveloppe(r, ''), null);

  const rouverte = await ouvrirLEnveloppe(r, MDP);
  v('le bon mot de passe rend bien une clé', rouverte !== null, true);

  /*
     Et c'est la MÊME clé, ce que seul un aller-retour de chiffrement prouve :
     deux clés AES distinctes se ressemblent comme deux objets opaques.
  */
  const scelle = await sceller(posee, 'le contenu du coffre');
  v(
    'et c’est la même clé : ce qu’elle a scellé, elle le rouvre',
    await ouvrirLeScelle(rouverte!, scelle),
    'le contenu du coffre',
  );
}

console.log("\nL'ENVELOPPE NE LIVRE RIEN DE CE QU'ELLE PROTÈGE");

{
  const r = carte();
  await poserLEnveloppe(r, MDP);
  const range = [...r.contenu.values()].join(' ');
  v('le mot de passe n’est nulle part dans ce qui est rangé', range.includes(MDP), false);
  v('deux choses sont rangées, et deux seulement', [...r.contenu.keys()].sort(), [
    CLEF_ENVELOPPE,
    CLEF_SEL_ENVELOPPE,
  ]);

  /*
     Deux installations du même mot de passe ne doivent pas produire la même
     enveloppe : c'est à cela que sert le sel, et sans cet essai on ne
     saurait pas qu'il est bien tiré au sort à chaque pose.
  */
  const r2 = carte();
  await poserLEnveloppe(r2, MDP);
  v(
    'deux installations du même mot de passe n’ont pas le même sel',
    r.contenu.get(CLEF_SEL_ENVELOPPE) === r2.contenu.get(CLEF_SEL_ENVELOPPE),
    false,
  );
  v(
    'ni la même enveloppe',
    r.contenu.get(CLEF_ENVELOPPE) === r2.contenu.get(CLEF_ENVELOPPE),
    false,
  );
}

console.log('\nCHANGER LE MOT DE PASSE NE TOUCHE À AUCUNE DONNÉE');

{
  const r = carte();
  const cle = await poserLEnveloppe(r, MDP);
  /*
     On scelle AVANT le changement, et on relit APRÈS. C'est la seule façon de
     prouver que les données survivent : vérifier que la fonction « ne les
     touche pas » en lisant son code ne prouverait que ce qu'on y a écrit.
  */
  const avant = await sceller(cle, 'trois ans de journal');
  const selAvant = r.contenu.get(CLEF_SEL_ENVELOPPE);

  v('le changement réussit avec le bon ancien mot de passe', await changerLeMotDePasseDuCoffre(r, MDP, 'nouveau-mot-de-passe'), true);
  v('l’ancien mot de passe n’ouvre plus', await ouvrirLEnveloppe(r, MDP), null);

  const apres = await ouvrirLEnveloppe(r, 'nouveau-mot-de-passe');
  v('le nouveau ouvre', apres !== null, true);
  v(
    'et ce qui était scellé avant se relit après, intact',
    await ouvrirLeScelle(apres!, avant),
    'trois ans de journal',
  );
  v('le sel a été renouvelé', r.contenu.get(CLEF_SEL_ENVELOPPE) === selAvant, false);
}

console.log("\nUN CHANGEMENT QUI ÉCHOUE NE DÉTRUIT RIEN");

{
  const r = carte();
  const cle = await poserLEnveloppe(r, MDP);
  const scelle = await sceller(cle, 'ce qu’il ne faut pas perdre');
  const enveloppeAvant = r.contenu.get(CLEF_ENVELOPPE);
  const selAvant = r.contenu.get(CLEF_SEL_ENVELOPPE);

  /*
     Le défaut visé : effacer le sel AVANT d'avoir ouvert. L'ancien sel perdu
     et le nouveau non posé, la clé de données serait irrécupérable. L'essai
     le vise en passant un mauvais ancien mot de passe — le cas où la suite
     n'a pas lieu.
  */
  v('un ancien mot de passe faux fait échouer le changement', await changerLeMotDePasseDuCoffre(r, 'pas-le-bon', 'peu-importe'), false);
  v('le sel n’a pas bougé', r.contenu.get(CLEF_SEL_ENVELOPPE), selAvant);
  v('l’enveloppe non plus', r.contenu.get(CLEF_ENVELOPPE), enveloppeAvant);

  const encore = await ouvrirLEnveloppe(r, MDP);
  v('et le coffre s’ouvre toujours avec son mot de passe', encore !== null, true);
  v(
    'et rend toujours ses données',
    await ouvrirLeScelle(encore!, scelle),
    'ce qu’il ne faut pas perdre',
  );
}

console.log('\nLE COÛT SE MESURE, IL NE SE SUPPOSE PAS');

{
  v('les itérations sont bien à 600 000', ITERATIONS_ENVELOPPE, 600_000);
  const r = carte();
  await poserLEnveloppe(r, MDP);
  const debut = performance.now();
  await ouvrirLEnveloppe(r, MDP);
  const ms = Math.round(performance.now() - debut);
  /*
     Pas une assertion de performance — la machine de l'essai n'est pas celle
     d'Alexis. Un plafond large qui attrape l'erreur de grandeur : un zéro de
     trop aux itérations, et c'est dix secondes au lieu d'une.
  */
  console.log(`      ouverture mesurée : ${ms} ms`);
  v('une ouverture reste sous cinq secondes', ms < 5000, true);
}

console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
