/**
 * Le magasin du centre : ce qu'il refuse — prompt 32, phase 1.
 *
 *   npm run essais:centre-donnees
 *
 * Ce contrôle est **structurel**, et c'est délibéré : la couche de
 * données demande une base et un coffre ouvert, donc son comportement se
 * prouve au navigateur. Ce qui se prouve ici, en lisant les sources, ce
 * sont les propriétés qu'aucun parcours ne saurait garantir pour les
 * chemins que personne n'a encore écrits :
 *
 * 1. **le compte ne déchiffre pas.** `comptesDuCentre` ne doit appeler ni
 *    `exigerLeCoffre` ni `ouvrir` : la pastille vit coffre fermé, et elle
 *    ne vit que du `genre` laissé en clair par la décision N-1 ;
 * 2. **le filtre du cycle est appliqué À L'ÉCRITURE.** Filtrer à la
 *    lecture laisserait la donnée dans le magasin, donc dans une base
 *    qu'un autre appareil fusionne ;
 * 3. **le contexte de filtrage n'est jamais stocké.** Le § 2.3 veut un
 *    élément sans contenu ; la classe d'une molécule en est ;
 * 4. **le centre ne charge aucune branche.**
 *
 * La règle suivie, et elle vient de ce lot : *un contrôle se valide sur
 * le défaut qu'il vise.* Chacune est donc sabotée à la main avant d'être
 * déclarée tenue.
 *
 * ## Ce que ce contrôle NE prouve pas, et pourquoi c'est écrit ici
 *
 * Une sonde textuelle prouve qu'un garde-fou est **cité**. Elle ne prouve
 * jamais qu'il **agit** : le sabotage `if (false && !peutEtreRange(e))`
 * garde la mention, neutralise le refus, et ce fichier reste vert. Essayé,
 * constaté.
 *
 * Ce n'est pas réparable par une sonde plus fine — le texte ne dit pas ce
 * que le code fait. La preuve d'exécution du refus de ranger une question
 * (§ 1 n° 8) appartient donc à l'essai de navigateur de la phase 2, où un
 * vrai magasin et un vrai coffre existent. Jusque-là, la propriété est
 * **lue dans le code**, pas constatée, et la section 6 le dit à l'écran.
 */
import { readFileSync, readdirSync } from 'node:fs';
import {
  RETENTION_PAR_DEFAUT,
  peutEtreRange,
  sortDeLaRetention,
  type ElementDuCentre,
} from '../src/lib/notifications/modele';
import { SOURCES_DECLAREES } from '../src/lib/notifications/filtre-cycle';
import { ROUTES } from '../src/lib/notifications/sources';

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

/**
 * Une fonction absente rend un corps vide, et un corps vide passe toutes
 * les sondes d'absence. On exige donc d'abord qu'elle existe.
 */
const corpsDe = (nom: string): string => {
  const c = corps(nom);
  vrai(`\`${nom}\` existe (sinon toute sonde d’absence serait vraie à vide)`, c.length > 0);
  return c;
};

const source = readFileSync('src/lib/notifications/donnees.ts', 'utf8');
const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Le corps d'une fonction, pour l'examiner seule — exportée ou non.
 *
 * `changerLEtat` est interne : `marquerLu` et `archiver` n'en sont que les
 * deux portes. Un extracteur qui n'aurait cherché que des fonctions
 * exportées aurait rendu une chaîne vide, et une chaîne vide ne contient
 * aucun appel interdit : le contrôle aurait été vert **par cécité**. D'où
 * la garde `existe` ci-dessous, posée à chaque usage.
 */
function corps(nom: string): string {
  const debut = sansCommentaires.search(new RegExp(`(export )?async function ${nom}\\b`));
  if (debut < 0) return '';
  const suite = sansCommentaires.slice(debut);
  const fin = suite.indexOf('\n}\n');
  return fin < 0 ? suite : suite.slice(0, fin);
}

console.log('\n\x1b[1m1. Le compte ne déchiffre pas — la pastille vit coffre fermé\x1b[0m');
{
  const compte = corpsDe('comptesDuCentre');
  v('il n’exige pas le coffre', compte.includes('exigerLeCoffre'), false);
  v('et il n’ouvre rien', /\bouvrir[<(]/.test(compte), false);
  vrai('il lit le genre, laissé en clair par la décision N-1', compte.includes('genre'));
  /*
     Et il ne lève pas : une base absente rend zéro. Un compteur qui jette
     emporterait l'en-tête de toutes les pages.
  */
  vrai('une base absente rend zéro au lieu de lever', compte.includes('catch'));
}

console.log('\n\x1b[1m2. Le panneau, lui, exige le coffre\x1b[0m');
{
  const elements = corpsDe('elementsDuCentre');
  vrai('`elementsDuCentre` exige le coffre', elements.includes('exigerLeCoffre'));
  vrai('et déchiffre', elements.includes('ouvrir'));
}

console.log('\n\x1b[1m3. Le filtre du cycle est appliqué à L’ÉCRITURE\x1b[0m');
{
  const depot = corpsDe('deposer');
  vrai('`deposer` consulte le filtre', depot.includes('suitLaSensibiliteDuCycle'));
  /* Avant l'écriture, pas après : sinon la donnée existe déjà. */
  const filtre = depot.indexOf('suitLaSensibiliteDuCycle');
  const ecriture = depot.indexOf('.put(');
  vrai('et le consulte AVANT d’écrire', filtre >= 0 && ecriture > filtre);
  vrai('le refus est une valeur, pas une exception', depot.includes("quoi: 'ecarte'"));

  /* La lecture, elle, ne refiltre pas : ce serait avouer qu'on a laissé entrer. */
  v(
    '`elementsDuCentre` ne refiltre pas : rien d’interdit n’est jamais entré',
    corpsDe('elementsDuCentre').includes('suitLaSensibiliteDuCycle'),
    false,
  );
}

console.log('\n\x1b[1m4. Le contexte de filtrage n’est jamais stocké\x1b[0m');
{
  const depot = corpsDe('deposer');
  /*
     `sceller` reçoit `element`, et non un objet qui mêlerait l'élément au
     contexte. Une seule ligne sépare « un modèle sans contenu » de « un
     modèle qui porte une classe de molécule ».
  */
  vrai(
    'ce qui est scellé est l’élément seul',
    /sceller\(cle, MAGASIN, element as unknown/.test(depot),
  );
  v(
    'le contexte n’entre pas dans ce qui est écrit',
    /sceller\([^)]*contexte/.test(depot),
    false,
  );
}

console.log('\n\x1b[1m5. Le centre ne charge aucune branche\x1b[0m');
{
  const branches = ['faits-branches', 'faits-revisions', 'odyssee/donnees', 'sport/donnees'];
  const chargees = branches.filter((b) => sansCommentaires.includes(b));
  v('aucune branche importée', chargees, []);
}

console.log(
  '\n\x1b[1m6. Une question à trancher ne se range pas (§ 1 n° 8)\x1b[0m' +
    '\n   \x1b[2mLa règle pure est exécutée ; la délégation des deux écrivains n’est que LUE.\x1b[0m',
);
{
  const question: ElementDuCentre = {
    id: 'a',
    source: 'fusion',
    refSource: 'r',
    genre: 'a-trancher',
    creeLe: '2026-01-01',
    etat: 'non_lu',
    regroupement: null,
  };
  v('elle ne peut pas être rangée', peutEtreRange(question), false);
  v(
    'et la rétention ne la touche pas, même à deux ans',
    sortDeLaRetention(question, '2028-01-01', RETENTION_PAR_DEFAUT),
    'rien',
  );

  const avis: ElementDuCentre = { ...question, id: 'b', genre: 'a-savoir' };
  v('un avis, lui, s’archive à 30 jours', sortDeLaRetention(avis, '2026-02-15'), 'archiver');
  v('et se supprime à 180', sortDeLaRetention(avis, '2026-07-15'), 'supprimer');

  /*
     Et les deux écrivains délèguent à la règle pure, au lieu de rejuger.
     Sonde FAIBLE, et nommée telle : elle attrape la suppression du garde-
     fou, jamais sa neutralisation. Voir l'en-tête.
  */
  const etat = corpsDe('changerLEtat');
  vrai(
    '`changerLEtat` cite `peutEtreRange` (sonde faible : citation, pas effet)',
    etat.includes('peutEtreRange'),
  );
  vrai(
    'et `marquerLu` comme `archiver` passent par lui — une seule porte à garder',
    /return changerLEtat\(id, 'lu'\)/.test(sansCommentaires) &&
      /return changerLEtat\(id, 'archive'\)/.test(sansCommentaires),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Phase 2 : le routage, l'en-tête, et l'avis de fusion
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1m7. Le pont entre les deux registres\x1b[0m');
{
  /*
     Les deux registres ont des défauts opposés — refus pour le filtre,
     affichage dégradé pour le routage — et c'est voulu. Mais une source
     ADMISE par le filtre et inconnue du routage s'afficherait sous son
     identifiant brut : « rappel-de-prise » au lieu de « Rappels de prise ».
     Le contrôle ne compare donc pas les deux listes : il vérifie le seul
     sens qui coûte quelque chose.
  */
  const admises = SOURCES_DECLAREES.map((s) => s.id);
  const routees = new Set(ROUTES.map((r) => r.id));
  v('toute source déclarée a une route', admises.filter((id) => !routees.has(id)), []);

  /* Et aucune route ne mène à un chemin qui ne ressemble pas à un chemin. */
  v(
    'les routes sont des chemins internes, absolus, sans schéma',
    ROUTES.filter((r) => r.vers !== null && !/^\/[\w/#-]*$/.test(r.vers)).map((r) => r.id),
    [],
  );
}

console.log('\n\x1b[1m8. Une seule porte vers le système (0.8 du 43, décision 5)\x1b[0m');
{
  /*
     CE QUE CETTE SECTION MESURE, ET POURQUOI ICI.

     Elle mesurait « l'appel à `avertir` existe dans veille.ts, et son corps
     n'interpole rien du rapport ». L'appel n'existe plus, et c'est le lot
     0.8 : il était une SECONDE PORTE vers les notifications du système, à
     côté de `emettre`, et il contournait tout ce que l'autre tient — le
     réglage par source, le plafond du jour, le verrou entre onglets, le
     libellé neutre.

     L'objet de la section ne change pas pour autant : aucun nombre du
     rapport ne doit pouvoir paraître sur un écran verrouillé. Il se mesure
     maintenant mieux qu'avant, parce que le libellé est devenu une
     constante — ce que la section 5 de `essais:emission` éprouve par
     exécution — et qu'il ne reste donc à garder qu'une chose : qu'aucune
     autre porte ne s'ouvre. C'est une propriété de tout le dossier `src/`,
     que personne ne peut vérifier en relisant un fichier, et c'est
     exactement ce que ce contrôle structurel sait faire.
  */
  const veille = readFileSync('src/lib/sync/veille.ts', 'utf8');
  v('la veille n’appelle plus `avertir` directement', /\bavertir\s*\(/.test(veille), false);
  vrai(
    'elle dépose la fusion au centre, qui décide d’interrompre ou non',
    /signalerUneFusion\(recu\.lot\)/.test(veille),
  );
  /*
     Le défaut visé reste celui de la décision 5, mot pour mot : « Reçu :
     1 opération ». Le rapport n'est plus lu que pour TROIS champs — deux
     volumes, qui servent uniquement à décider s'il y a quelque chose à
     dire, et le numéro de lot, qui n'est pas un volume. Un quatrième champ
     lu ici serait une donnée de plus qui sort de la fusion, et il faudrait
     alors se demander où elle va.
  */
  v(
    'et le rapport n’est lu que pour les deux volumes et le lot',
    [...new Set([...veille.matchAll(/\brecu\.(\w+)/g)].map((m) => m[1]))].sort(),
    ['lot', 'recues', 'revisionsRecues'],
  );

  /*
     L'INVARIANT, et c'est lui qui vaut la section : `avertir` n'a qu'un
     appelant dans tout le site, et c'est `emettre`.

     On ne cherche pas le NOM seul : `lib/boite.ts` exporte aussi un
     `avertir` — la boîte de dialogue —, et sept écrans l'appellent. Un
     contrôle sur le nom rougirait sur eux, on l'assouplirait, et il ne
     garderait plus rien.

     On ne cherche pas la forme d'import non plus, et c'est un SABOTAGE qui
     l'a appris : la première écriture lisait `import { avertir } from …`, et
     le sabotage qui remettait la porte dans la veille est resté vert,
     puisque la veille importe en différé — `await import('./notification')`,
     et avant ce lot `const [{ avertir }] = await Promise.all([…])`. Un
     contrôle qu'un sabotage traverse ne garde rien.

     La règle est donc grossière exprès : **aucun fichier ne doit à la fois
     citer le module et nommer `avertir`**, hormis `emettre`. Elle attrape
     les deux formes d'import et celles que personne n'a écrites. Elle
     refuserait un fichier qui n'emprunterait au module que `etatPermission`
     tout en ayant son propre `avertir` — aucun n'existe aujourd'hui, les
     quatre qui citent le module ayant été relus un par un. Et si ce cas
     arrivait, la question qu'il poserait est la bonne : pourquoi ce fichier
     parle-t-il des deux à la fois ?
  */
  const fichiers: string[] = [];
  const parcourir = (dossier: string): void => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = `${dossier}/${entree.name}`;
      if (entree.isDirectory()) parcourir(chemin);
      else if (/\.(ts|astro|svelte|js)$/.test(entree.name)) fichiers.push(chemin);
    }
  };
  parcourir('src');
  const portes = fichiers.filter((f) => {
    const texte = readFileSync(f, 'utf8');
    return /['"][^'"]*\/notification['"]/.test(texte) && /\bavertir\b/.test(texte);
  });
  v('un seul fichier ouvre la porte du système', portes, [
    'src/lib/notifications/emission.ts',
  ]);

  /*
     ET PAS DE TROISIÈME PORTE PAR LE SERVICE WORKER. `sw.js` sait afficher
     une notification sur message `cyclades:avis` d'une page ; ce chemin
     n'aurait pas de réglage, pas de plafond, pas de verrou. Personne ne
     l'emprunte — mesuré ici, pas supposé — et la branche est signalée au
     Pilote comme du code mort plutôt que retirée d'un lot qui ne touche pas
     au service worker.
  */
  v(
    'personne ne poste `cyclades:avis` au service worker',
    fichiers.filter((f) => readFileSync(f, 'utf8').includes('cyclades:avis')),
    [],
  );
}

console.log('\n\x1b[1m9. Le centre n’est pas sur le menu de garde (§ 3.1)\x1b[0m');
{
  const gabarit = readFileSync('src/layouts/Base.astro', 'utf8');
  /*
     Compter, et non chercher : une seule pose, dans l'en-tête complet. Deux
     poses voudraient dire que l'en-tête léger en a une aussi, et c'est
     exactement ce que le § 3.1 écarte.
  */
  v('le composant est posé une fois et une seule', (gabarit.match(/<CentreNotifications \/>/g) ?? []).length, 1);
  /*
     Et cette pose est du côté complet. Le repère : elle précède le premier
     `CommutateurTheme`, qui est celui de l'en-tête complet — le léger vient
     après dans le fichier.
  */
  const pose = gabarit.indexOf('<CentreNotifications />');
  const themes = [...gabarit.matchAll(/<CommutateurTheme \/>/g)].map((m) => m.index ?? -1);
  vrai('elle est dans l’en-tête complet, le premier des deux', pose > 0 && pose < themes[0]);
  vrai('et l’en-tête léger n’en a pas', themes.length === 2 && pose < themes[1] && pose < themes[0]);
}

console.log('\n\x1b[1m10. L’inventaire du § 2.1 suit le code\x1b[0m');
{
  /*
     Un inventaire qu'aucun contrôle ne tient devient faux à la première
     source ajoutée, et il est alors pire qu'absent : on le lit en croyant
     qu'il dit l'état des lieux. On n'éprouve donc pas sa prose — elle est
     du jugement, et c'est sa valeur — mais sa COUVERTURE.
  */
  const inventaire = readFileSync('docs/inventaire-des-signaux.md', 'utf8');
  const absentes = ROUTES.map((r) => r.id).filter((id) => !inventaire.includes(`\`${id}\``));
  v('toute source du registre figure à l’inventaire', absentes, []);

  /*
     Et l'inverse : une ligne d'inventaire qui nommerait un identifiant
     inconnu du registre désignerait une source qu'aucun filtre ne garde.
  */
  const connues = new Set(ROUTES.map((r) => r.id));
  const citees = [...inventaire.matchAll(/`([a-z][a-z-]+-[a-z-]+)`/g)].map((m) => m[1]);
  const inventees = [...new Set(citees)].filter((id) => !connues.has(id));
  v('et l’inventaire n’invente aucune source', inventees, []);

  /* Les quatre lignes que l'inventaire AJOUTE au § 2.2 sont nommées. */
  for (const ajout of ['Témoin du coffre', 'Ressources de détresse']) {
    vrai(`« ${ajout} » est inventorié`, inventaire.includes(ajout));
  }
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
