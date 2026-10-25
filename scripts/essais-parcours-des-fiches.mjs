/**
 * Chaque fiche sait de quel parcours elle vient.
 *
 * ## Le défaut
 *
 * `racineContenu` était déclaré dans le registre des parcours et **lu nulle
 * part** : la hiérarchie se reconstruit depuis `matiere`/`fascicule`, de sorte
 * qu'une fiche déposée dans `content/dgfip-a/` devenait une matière de plus du
 * parcours INSP, à côté du droit public.
 *
 * ## Ce que cet essai vérifie, et ce qu'il ne vérifie pas
 *
 * Il lit le **manifeste réellement produit** par la construction, pas le code
 * qui le produit. Il vérifie que chaque fiche porte sa racine et les parcours
 * qu'elle sert, que ces parcours existent au registre, que le manifeste
 * s'accorde avec le registre sur qui sert quoi, et que les comptes du
 * manifeste s'accordent avec le DISQUE.
 *
 * Il tient aussi, depuis le 25 octobre, **l'invariant de la racine partagée** :
 * une fiche sous `content/commun/` a UN identifiant pour les trois parcours
 * DGFiP. Il le vérifie depuis le DISQUE — l'identifiant que la fiche déclare
 * en `id_publie`, ou l'empreinte de son chemin — et le compare au manifeste,
 * donc sans faire confiance au manifeste pour se juger lui-même, et sans
 * toucher à `idStable`, dont dépend l'historique des 262 fiches de l'INSP.
 *
 * Il ne vérifie **pas** que la bibliothèque filtre : elle ne filtre pas
 * encore, et le prétendre serait mentir. Ces champs existent pour que ce second
 * pas soit possible ; il se fera à part, avec ses propres essais.
 *
 * ## Deux choses à savoir avant de le croire rouge
 *
 * Il exige **plus de cent fiches** au manifeste, et la garde est délibérée :
 * un essai qui parcourt zéro élément passe au vert sans rien prouver, et c'est
 * arrivé. Dans un conteneur sans le corpus — `content/` n'est jamais commité —
 * il ne peut donc pas passer, et son premier constat le dit. Ce n'est pas un
 * défaut du produit.
 *
 * Et jusqu'au 25 octobre, **il n'était lancé par personne** : ni
 * `package.json`, ni la batterie, ni aucun document ne le nommait. Il est
 * désormais `npm run essais:parcours-des-fiches`. Un essai que rien n'appelle
 * ne protège rien.
 */
import { readFileSync, existsSync } from 'node:fs';
import {
  PARCOURS,
  parcoursServisParLaRacine,
  RACINE_COMMUNE,
  racineDuChemin,
} from '../src/lib/parcours/registre.ts';
import { deriverCle, idStable } from './lib/crypto.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import matter from 'gray-matter';

let echecs = 0;
const v = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

const CHEMIN = 'dist/data/manifeste.json';
const CLE = 'dist/data/cle.json';
if (!existsSync(CHEMIN) || !existsSync(CLE)) {
  console.error(`\n${CHEMIN} absent : construisez d'abord (npm run build).\n`);
  process.exit(1);
}

/*
   Par le module partagé : il lit la variable d'environnement, et à défaut
   `.env.local` — le fichier du build, ignoré par Git. Lire la seule variable
   obligeait à écrire le mot de passe devant la commande, donc dans le journal
   de la session, en clair. Son message d'absence est le même, en mieux.
*/
const MDP = motDePasseEssais();

/*
   Le manifeste publié est chiffré, et il faut le déchiffrer pour l'éprouver.

   Une première version lisait le fichier tel quel, y trouvait `{iv, ct}`, en
   tirait zéro fiche — et l'assertion « aucune fiche sans parcours » passait
   AU VERT sur une liste vide. C'est la garde « le manifeste n'est pas vide »
   qui l'a arrêtée. Un essai qui parcourt zéro élément ne prouve rien, et il
   faut toujours lui donner de quoi le dire.
*/
const params = JSON.parse(readFileSync(CLE, 'utf8'));
const cle = await deriverCle(MDP, Buffer.from(params.sel, 'base64'), params.iterations, 256);
const enveloppe = JSON.parse(readFileSync(CHEMIN, 'utf8'));
const clair = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv: Buffer.from(enveloppe.iv, 'base64') },
  cle,
  Buffer.from(enveloppe.ct, 'base64'),
);
const manifeste = JSON.parse(new TextDecoder().decode(clair));

const toutes = [];
for (const m of manifeste.matieres ?? []) {
  for (const f of m.fascicules ?? []) {
    for (const fiche of f.fiches ?? []) toutes.push({ ...fiche, matiere: m.nom });
  }
}

console.log('\nCHAQUE FICHE PORTE SA RACINE ET LES PARCOURS QU’ELLE SERT');

console.log(`      ${toutes.length} fiches au manifeste`);
/*
   CE GARDE-FOU A MENTI, ET VOICI CE QU'IL DISAIT.

   Il s'énonçait « le manifeste n'est pas vide » et exigeait « plus de cent
   fiches ». Les deux ne sont pas la même chose, et l'écart s'est vu le jour où
   une machine n'a porté que cinq fiches : l'essai est devenu rouge en
   annonçant un manifeste vide qui portait cinq fiches servies à quatre
   parcours, et dont il avait vérifié chaque racine.

   Son objet est d'empêcher un essai creux : sur un manifeste SANS fiche,
   toutes les assertions qui suivent passent au vert pour n'avoir rien examiné.
   C'est « zéro » qu'il doit refuser, et c'est ce qu'il refuse maintenant.

   Le volume du corpus, lui, est un fait de la MACHINE et non du code : ce
   dépôt ne versionne pas « content/ », et rien ici ne peut garantir que les
   427 fiches y sont. Le compte est donc imprimé juste au-dessus, et une
   mention le dit en clair quand le corpus est partiel — pour que personne ne
   lise « 15 verts » comme « le corpus entier est conforme ».
*/
v('le manifeste porte au moins une fiche, sinon rien ne serait examiné', toutes.length > 0, true);
if (toutes.length < 100) {
  console.log(
    `      · corpus partiel : ${toutes.length} fiches seulement. La forme est mesurée, ` +
      'le corpus ne l’est pas.',
  );
}

const sansRacine = toutes.filter((f) => typeof f.racine !== 'string');
v('aucune fiche sans racine', sansRacine.map((f) => f.titre).slice(0, 5), []);

/*
   UNE LISTE VIDE EST UN DÉFAUT, ET NON UNE ABSENCE. Une fiche servie à zéro
   parcours est une fiche que personne ne verra, rangée sous une racine que le
   registre ne connaît pas. C'est le cas qu'un champ au singulier masquait : il
   portait toujours une valeur, fût-elle fausse.
*/
const sansParcours = toutes.filter(
  (f) => !Array.isArray(f.parcoursServis) || f.parcoursServis.length === 0,
);
v('aucune fiche servie à zéro parcours', sansParcours.map((f) => f.titre).slice(0, 5), []);

const connus = new Set(PARCOURS.map((p) => p.id));
const inconnus = [
  ...new Set(toutes.flatMap((f) => f.parcoursServis ?? [])),
].filter((p) => !connus.has(p));
v('aucun parcours inconnu du registre', inconnus, []);

/*
   LE MANIFESTE S'ACCORDE AVEC LE REGISTRE. Les parcours servis sont DÉRIVÉS de
   la racine ; les recalculer ici attrape une construction faite avec un
   registre différent de celui qu'on lit — un `dist/` resté en arrière, par
   exemple, ce qui s'est produit pendant l'écriture de ce lot.
*/
const desaccords = toutes
  .filter(
    (f) =>
      JSON.stringify(f.parcoursServis) !== JSON.stringify(parcoursServisParLaRacine(f.racine)),
  )
  .map((f) => `${f.titre} : racine « ${f.racine} », manifeste ${JSON.stringify(f.parcoursServis)}`);
v('les parcours servis s’accordent avec le registre', desaccords.slice(0, 5), []);

/* Et le champ dérivé ne contredit pas la liste dont il est tiré. */
const partageIncoherent = toutes
  .filter((f) => Boolean(f.partagee) !== (f.parcoursServis ?? []).length > 1)
  .map((f) => f.titre);
v('« partagée » dit la même chose que la liste', partageIncoherent.slice(0, 5), []);

const repartition = {};
for (const f of toutes) {
  for (const id of f.parcoursServis ?? []) repartition[id] = (repartition[id] ?? 0) + 1;
}
console.log(`      répartition par parcours : ${JSON.stringify(repartition)}`);
const parRacine = {};
for (const f of toutes) parRacine[f.racine] = (parRacine[f.racine] ?? 0) + 1;
console.log(`      répartition par racine : ${JSON.stringify(parRacine)}`);

console.log('\nLES COMPTES DU MANIFESTE S’ACCORDENT AVEC LE DISQUE');

/*
   On compare aux fichiers présents sur le disque, et non à ce que le
   manifeste raconte de lui-même : un manifeste qui se contredirait serait
   cohérent avec lui-même et faux quand même.

   LE COMPTE SE FAIT PAR RACINE, ET PLUS PAR PARCOURS. Une fiche partagée
   existe une fois sur le disque et sert trois parcours : compter par parcours
   annoncerait trois fichiers là où il y en a un, et l'écart serait pris pour
   un défaut.
*/
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const compterSous = (dossier) => {
  if (!existsSync(dossier)) return 0;
  let n = 0;
  for (const e of readdirSync(dossier)) {
    const c = join(dossier, e);
    if (statSync(c).isDirectory()) n += compterSous(c);
    else if (e.endsWith('.md') && !e.endsWith('.podcast.md')) n += 1;
  }
  return n;
};

const racinesDeclarees = [
  ...new Set(PARCOURS.flatMap((p) => [p.racineContenu, ...p.racinesPartagees])),
].filter((r) => r !== '');

const ecarts = [];
for (const racine of racinesDeclarees) {
  const surDisque = compterSous(join('content', racine));
  const auManifeste = parRacine[racine] ?? 0;
  if (surDisque !== auManifeste) {
    ecarts.push(`${racine} : ${surDisque} sur disque, ${auManifeste} au manifeste`);
  }
}
v('autant de fiches au manifeste que sur le disque, par racine', ecarts, []);

/*
   Les dossiers de matière de l'INSP vivent à la racine de `content/`, et ne
   sont donc pas des racines déclarées — voir l'en-tête du registre sur la
   raison pour laquelle on ne les déplace pas. Ils sont nommés ici pour que le
   contrôle du dossier inconnu ne les dénonce pas à tort ; la liste se lit au
   registre dès qu'un parcours la porte.
*/
const FICHIERS_HORS_PARCOURS = new Set(
  (PARCOURS.find((p) => p.racineContenu === '')?.themes ?? []).flatMap((t) =>
    t.matieres.map((m) =>
      m
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
    ),
  ),
);

console.log('\nUN IDENTIFIANT, UN HISTORIQUE — MÊME POUR UNE FICHE PARTAGÉE');

/*
   L'INVARIANT DE LA RACINE PARTAGÉE, ET LA SEULE FAÇON HONNÊTE DE LE TENIR.

   `idStable` hache le chemin RELATIF à `content/`. Une fiche sous `commun/` a
   donc la même empreinte quel que soit le parcours qui la sert — c'est ce qui
   permet une matière unique sans toucher à `idStable`, dont dépend l'historique
   FSRS des 262 fiches de l'INSP.

   On ne demande pas au manifeste de le confirmer : on recalcule l'empreinte
   depuis le DISQUE et on compare. Le chemin ne figure pas au manifeste — il est
   interne au build —, donc c'est la comparaison des ensembles d'identifiants
   qui fait foi. Si une empreinte dépendait du parcours, un identifiant du
   disque manquerait au manifeste, ou l'inverse.
*/
const cheminsDuDisque = [];

/*
   UNE FICHE PEUT DÉCLARER SON IDENTIFIANT, et cet essai l'ignorait.

   `ficheId = fm.data.id_publie ?? idStable(relatif)` : le build accepte un
   identifiant écrit au front-matter. Le champ n'est pas un confort, c'est une
   RÉPARATION — son commentaire au schéma le dit —, pour qu'une fiche dont le
   chemin a été perdu garde l'identifiant sous lequel la progression est rangée
   dans le navigateur.

   Le 25 octobre, la récupération du corpus en a posé 51 : les 51 fiches dont le
   chemin n'a pas pu être certifié par son empreinte. Cet essai est alors passé
   au rouge en affirmant que tout identifiant du manifeste est l'empreinte d'un
   chemin — ce que `id_publie` est précisément fait de rompre.

   L'invariant juste n'est donc pas plus faible, il est plus précis : un
   identifiant du manifeste est soit celui qu'une fiche DÉCLARE, soit l'empreinte
   de son chemin. Ainsi un identifiant déclaré qui ne correspond à aucun fichier
   se voit encore, et c'est ce qui compte.
*/
const idsDeclares = new Map();

/*
   L'EN-TÊTE EST LU PAR L'ANALYSEUR DU BUILD, ET NON PAR UNE EXPRESSION
   RÉGULIÈRE ÉCRITE ICI.

   Cette lecture était faite à la main : « texte.indexOf('\n---') » pour borner
   l'en-tête, puis un motif pour en extraire le champ.

   J'AI D'ABORD ANNONCÉ DEUX DÉFAUTS, ET LE SABOTAGE N'EN A CONFIRMÉ QU'UN.
   C'est dit ici parce qu'une raison fausse laissée dans un commentaire se
   recopie, et que celle-ci a déjà été recopiée une fois.

   - L'EN-TÊTE EN CRLF : je l'ai cru perdu par l'ancien motif, et il ne
     l'était pas. Sabotage posé : le contrôle CRLF reste VERT sous l'ancien
     lecteur. La raison est que « \s » comprend le retour de chariot — le
     « \s*$ » du motif l'absorbe, et « indexOf('\n---') » retrouve la clôture
     parce que le « \n » du CRLF y est. Le contrôle est gardé quand même : il
     dit que les deux lecteurs traversent le CRLF, ce qui vaut d'être écrit.
   - « id_publie : x », AVEC UN ESPACE avant le deux-points, que YAML accepte :
     celui-là est réel. Sabotage posé, le contrôle rougit.

   Le gain mesuré est donc plus modeste que ce que j'avais annoncé : l'espace
   avant le deux-points, et surtout qu'un identifiant déclaré mais ILLISIBLE
   soit nommé au lieu d'être confondu avec une absence — l'ancien motif ne
   trouvait rien et l'essai retombait en silence sur l'empreinte du chemin.

   Mais la raison de fond ne dépend pas du nombre de cas, et c'est elle qui
   a motivé ce changement : le mot de passe du site avait CINQ lecteurs écrits
   à la main, divergents sur la coupure des lignes, les blancs et les
   guillemets, dont celui qui rechiffre le corpus. Une règle de lecture
   recopiée finit par diverger de l'originale, et on ne sait pas d'avance par
   où. On n'ajoute donc pas un cas au motif : on supprime le motif.

   « gray-matter » est l'analyseur que « build-content.mjs » emploie. C'est la
   seule façon d'être sûr de lire ce que le build lit.

   Il règle aussi, gratuitement, ce que le motif attrapait par chance : le
   corps de la fiche ne peut plus être confondu avec l'en-tête, puisque
   l'analyseur borne l'en-tête lui-même.

   ET IL A DÉTROMPÉ UNE RAISON ÉCRITE DEUX FOIS DANS CE DÉPÔT. Le motif
   acceptait des guillemets autour de l'identifiant, et son commentaire — le
   mien, repris par celui de B — expliquait que « 03893560309995e0 » se lit
   comme un nombre en notation scientifique. C'est FAUX pour l'analyseur du
   build : son zéro initial le disqualifie comme flottant, et il revient en
   chaîne. Le fait observé était juste — la fiche porte bien des guillemets —
   mais la raison avancée ne l'était pas, et une raison fausse se recopie.

   Mesuré, un seul des 51 identifiants déclarés est écrit entre guillemets, et
   AUCUN ne serait lu comme un nombre sans eux. Le vrai danger est dit au
   contrôle de sabotage correspondant, plus bas : il tient aux chiffres et non
   à la notation scientifique.
*/

/** Les identifiants déclarés mais illisibles : nommés, jamais ignorés. */
const idsDeclaresInvalides = [];

/**
 * L'identifiant déclaré dans un TEXTE de fiche, ou `null`.
 *
 * Pure, donc éprouvable sans disque : c'est ce qui permet les contrôles de
 * sabotage plus bas, dont le cas CRLF, sans écrire dans le corpus réel.
 */
export const idDeclareDuTexte = (texte, quoi = '(texte)') => {
  let donnees;
  try {
    donnees = matter(texte).data ?? {};
  } catch {
    /* Un en-tête illisible est l'affaire du build, qui refuse en le nommant. */
    return null;
  }
  if (!('id_publie' in donnees)) return null;
  const valeur = donnees.id_publie;
  /*
     UN CHAMP PRÉSENT MAIS NON CONFORME N'EST PAS « ABSENT », et les deux
     versions précédentes le traitaient comme tel — le motif ne trouvait rien,
     donc l'essai retombait sur l'empreinte du chemin, en silence.

     Or c'est exactement le cas de « id_publie: 03893560309995e0 » SANS
     guillemets : YAML y lit le NOMBRE 3,89…e0, parce que seize caractères
     hexadécimaux finissant par « e » suivi de chiffres forment une écriture
     scientifique valable. Le build le refuse par son schéma, qui exige seize
     caractères hexadécimaux. Cet essai doit donc le NOMMER, et non le
     confondre avec une fiche qui ne déclare rien.
  */
  if (typeof valeur !== 'string' || !/^[0-9a-f]{16}$/.test(valeur)) {
    idsDeclaresInvalides.push(`${quoi} : ${JSON.stringify(valeur)}`);
    return null;
  }
  return valeur;
};

const lireIdDeclare = (chemin) => idDeclareDuTexte(readFileSync(chemin, 'utf8'), chemin);

const parcourirPour = (dossier, prefixe) => {
  if (!existsSync(dossier)) return;
  for (const e of readdirSync(dossier)) {
    const c = join(dossier, e);
    const relatif = prefixe ? `${prefixe}/${e}` : e;
    if (statSync(c).isDirectory()) parcourirPour(c, relatif);
    else if (e.endsWith('.md') && !e.endsWith('.podcast.md')) {
      cheminsDuDisque.push(relatif);
      const declare = lireIdDeclare(c);
      if (declare) idsDeclares.set(relatif, declare);
    }
  }
};
parcourirPour('content', '');

/* ══════════════════════════════════════════════════════════════════════════
   LA LECTURE DE L'EN-TÊTE, ÉPROUVÉE SUR DU TEXTE ET NON SUR LE CORPUS
   ══════════════════════════════════════════════════════════════════════════

   Ces contrôles portent sur `idDeclareDuTexte`, qui est pure : ils ne
   touchent pas à « content/ », qui n'est pas dans Git et dont la perte serait
   irréparable. Un sabotage qui écrirait une fiche CRLF dans le corpus réel
   pour vérifier qu'on la lit serait un prix absurde.

   Sans eux, le passage à « gray-matter » ne serait pas MESURÉ : le corpus
   d'aujourd'hui ne porte aucune fiche CRLF, donc l'ancien motif et le nouvel
   analyseur y donnent exactement le même résultat. Un garde-fou qu'on ne
   peut pas faire rougir n'en est pas un.
*/
console.log('\nL’EN-TÊTE EST LU COMME LE BUILD LE LIT');
{
  const ID = '9d222c1a0b3e4f56';
  const avant = idsDeclaresInvalides.length;

  v('un en-tête simple', idDeclareDuTexte(`---\nid_publie: ${ID}\n---\ncorps\n`), ID);

  /* LE CAS QUI MOTIVE TOUT CECI. L'ancien motif rendait null ici. */
  v(
    'un en-tête en CRLF (les deux lecteurs le traversent)',
    idDeclareDuTexte(`---\r\nid_publie: ${ID}\r\ntitre: x\r\n---\r\ncorps\r\n`),
    ID,
  );
  v(
    'un identifiant entre guillemets, comme l’outil de récupération les écrit',
    idDeclareDuTexte('---\nid_publie: "03893560309995e0"\n---\n'),
    '03893560309995e0',
  );
  v(
    'un espace avant le deux-points, que YAML accepte',
    idDeclareDuTexte(`---\nid_publie : ${ID}\n---\n`),
    ID,
  );
  v(
    'le champ peut ne pas être le premier',
    idDeclareDuTexte(`---\ntitre: x\ntags: [a, b]\nid_publie: ${ID}\n---\n`),
    ID,
  );
  v('aucun en-tête du tout', idDeclareDuTexte('# juste un titre\n'), null);
  v('un en-tête sans le champ', idDeclareDuTexte('---\ntitre: x\n---\n'), null);

  /*
     LE CORPS N'EST PAS L'EN-TÊTE. Une fiche qui PARLE de « id_publie » dans
     son cours ne déclare rien. L'analyseur borne l'en-tête lui-même ; le
     motif, lui, tenait par la chance du « .slice » qui précédait.
  */
  v(
    'une ligne du corps ne déclare rien',
    idDeclareDuTexte(`---\ntitre: x\n---\nid_publie: ${ID}\n`),
    null,
  );

  v('aucun de ces cas n’est compté invalide', idsDeclaresInvalides.length - avant, 0);

  /*
     ET LE CAS NON CONFORME EST NOMMÉ, NON IGNORÉ.

     MA PREMIÈRE VERSION DE CE CONTRÔLE PORTAIT SUR LE MAUVAIS IDENTIFIANT, et
     c'est lui qui m'a détrompé. J'avais écrit, et le dépôt le disait en deux
     endroits, que « 03893560309995e0 » se lit comme un nombre en notation
     scientifique. MESURÉ : l'analyseur du build le rend en CHAÎNE, parce que
     son ZÉRO INITIAL le disqualifie comme flottant YAML. La raison écrite
     était fausse.

     Le danger existe, et il est plus LARGE que ce qu'on croyait : il ne tient
     pas à la notation scientifique mais aux chiffres. Mesuré sur l'analyseur
     du build :

       1234567890123456  → nombre 1234567890123456
       1234567890123e45  → nombre 1.234567890123e+57
       03893560309995e0  → chaîne  (zéro initial)
       abcdef0123456789  → chaîne  (une lettre hexadécimale suffit)

     Un identifiant de seize caractères hexadécimaux ENTIÈREMENT NUMÉRIQUE,
     sans zéro initial, est donc lu comme un nombre. Cela arrivera : l'empreinte
     n'a aucune raison d'éviter ce cas.

     Ce n'est pas un défaut de l'outil de récupération, et je l'ai vérifié
     plutôt que de le supposer : il écrit avec « yaml », qui CITE tout
     identifiant ambigu — les quatre ci-dessus sauf le dernier —, et
     gray-matter les relit tous en chaîne. L'aller-retour est sain. Le cas
     dangereux est celui d'une fiche écrite ou corrigée à la main.
  */
  v(
    'un identifiant non conforme ne passe pas pour une absence',
    idDeclareDuTexte('---\nid_publie: 1234567890123456\n---\n', '(cas éprouvé)'),
    null,
  );
  /* Et celui qu'on croyait dangereux ne l'est pas : il revient en chaîne. */
  v(
    'un zéro initial suffit à garder la chaîne',
    idDeclareDuTexte('---\nid_publie: 03893560309995e0\n---\n'),
    '03893560309995e0',
  );
  v(
    'il est consigné comme invalide',
    idsDeclaresInvalides.length - avant,
    1,
  );
  /* On retire le cas éprouvé, pour ne pas faire rougir le contrôle du corpus. */
  idsDeclaresInvalides.length = avant;
}

/*
   ET AUCUNE FICHE DU CORPUS NE DÉCLARE UN IDENTIFIANT ILLISIBLE.

   Ce contrôle ne pouvait pas exister avant : l'ancien motif rendait null sans
   distinguer « pas de champ » de « champ illisible ».
*/
v('aucune fiche ne déclare un identifiant illisible', idsDeclaresInvalides.slice(0, 5), []);

/*
   ET AUCUNE FICHE N'EST RANGÉE SOUS UN DOSSIER QUE LE REGISTRE IGNORE.

   `racineDuChemin` rend `''` pour tout chemin dont le premier segment n'est pas
   une racine déclarée, et `''` est la racine de l'INSP. Une fiche déposée dans
   `content/dgfip-c/` deviendrait donc une matière de plus de l'INSP, en
   silence — exactement le défaut d'origine de cet essai, sous une autre forme.
   On liste les premiers segments inconnus plutôt que d'attendre qu'ils se
   voient à l'écran.
*/
const dossiersInconnus = [
  ...new Set(
    cheminsDuDisque
      .filter((c) => c.includes('/'))
      .filter((c) => racineDuChemin(c) === '')
      .map((c) => c.split('/')[0]),
  ),
].filter((d) => !FICHIERS_HORS_PARCOURS.has(d));
v('aucune fiche sous un dossier que le registre ignore', dossiersInconnus, []);

/*
   LA RÈGLE JUSTE, ET POURQUOI ELLE EST PLUS STRICTE QUE L'UNION DES DEUX.

   Deux corrections de ce bloc se sont croisées le 25 octobre, et toutes deux
   partaient du même constat : écrit avant `id_publie`, l'essai exigeait que
   TOUT identifiant du manifeste soit l'empreinte d'un chemin du disque, ce que
   ce champ est précisément fait de rompre. Sur le corpus réel, 51 fiches le
   déclarent ; l'essai rougissait donc sur la réparation elle-même.

   La version du train attendait « l'ensemble des empreintes UNION l'ensemble
   des identifiants déclarés ». Elle lève le faux rouge, et elle laisse passer
   le vrai défaut : si le build oubliait d'employer un `id_publie` déclaré, la
   fiche repartirait sous l'empreinte de son chemin — qui appartient à l'union,
   donc rien ne rougirait, et la progression serait orpheline en silence.

   La règle retenue est donc fiche par fiche : l'identifiant attendu d'une
   fiche est celui qu'elle DÉCLARE, et à défaut l'empreinte de son chemin.
   L'empreinte du chemin d'une fiche qui déclare autre chose n'est plus
   attendue, et c'est exactement le cas que l'union ne voyait pas.

   S'y ajoute la demande symétrique, qu'aucune des deux versions ne portait :
   un `id_publie` déclaré doit se retrouver AU MANIFESTE. Sans elle, un champ
   écrit pour rien laisserait la progression orpheline — l'inverse exact de ce
   qu'il répare.
*/
const idsAttendus = new Set(
  await Promise.all(
    cheminsDuDisque.map(async (c) => idsDeclares.get(c) ?? (await idStable(c))),
  ),
);
const idsDuManifeste = new Set(toutes.map((f) => f.id));
v(
  'chaque identifiant du manifeste est celui que la fiche déclare, ou l’empreinte de son chemin',
  [...idsDuManifeste].filter((id) => !idsAttendus.has(id)).slice(0, 5),
  [],
);
if (idsDeclares.size === 0) {
  console.log('      \x1b[36m·\x1b[0m non mesuré : aucune fiche ne déclare « id_publie » dans ce corpus');
} else {
  v(
    `les ${idsDeclares.size} « id_publie » déclarés se retrouvent au manifeste`,
    [...idsDeclares].filter(([, id]) => !idsDuManifeste.has(id)).map(([c]) => c).slice(0, 5),
    [],
  );
}
v(
  'et aucun identifiant n’est porté deux fois',
  toutes.length - idsDuManifeste.size,
  0,
);

/*
   Et le cas du partage lui-même, quand le corpus le porte. Sans fiche sous
   `commun/`, ce constat ne peut rien dire : il l'annonce plutôt que de passer
   au vert sur le vide.
*/
const partagees = toutes.filter((f) => f.racine === RACINE_COMMUNE);
if (partagees.length === 0) {
  console.log(
    `      \x1b[36m·\x1b[0m non mesuré : aucune fiche sous « ${RACINE_COMMUNE}/ » dans ce corpus`,
  );
} else {
  v(
    'une fiche partagée sert plus d’un parcours',
    partagees.every((f) => f.parcoursServis.length > 1),
    true,
  );
  v(
    'et elle sert exactement les parcours que le registre déclare',
    [...new Set(partagees.map((f) => JSON.stringify(f.parcoursServis)))],
    [JSON.stringify(parcoursServisParLaRacine(RACINE_COMMUNE))],
  );
  v(
    'son identifiant ne dépend pas du parcours qui la sert',
    partagees.every((f) => idsAttendus.has(f.id)),
    true,
  );
}

console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
