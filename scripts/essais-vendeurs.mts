/**
 * Essais de la reconnaissance de vendeur — Finances, phase 3 bis a et b.
 *
 * Trois choses à tenir, et la troisième est celle qui compte vraiment.
 *
 *  1. La **normalisation** survit aux formes de libellé : mentions de carte,
 *     dates collées, villes, références, intermédiaires.
 *  2. L'**ordre de résolution** est respecté — mes règles d'abord, toujours.
 *  3. **Aucun faux positif.** Un vendeur proche mais différent n'est pas
 *     confondu, et un motif court ou courant ne capte pas un libellé
 *     étranger. C'est le seul critère dont une erreur se paie en argent mal
 *     classé plutôt qu'en clic supplémentaire.
 */
import {
  FAMILLES,
  TOUS_LES_TYPES,
  categorieDuType,
  categoriesInconnues,
  categoriesOrphelines,
  controlerLaTaxonomie,
  typeDe,
} from '../src/lib/odyssee/taxonomie';
import {
  MOTIF_LONGUEUR_MINIMALE,
  SEUIL_RESSEMBLANCE,
  controlerLaReconnaissance,
  examinerLeMotif,
  grouperLesInconnus,
  libelleNet,
  lireLeLibelle,
  positionDuMotif,
  reconnaitre,
  ressemblance,
  type Connaissance,
  type RegleDePointage,
  type Vendeur,
} from '../src/lib/odyssee/vendeurs';
import {
  DICTIONNAIRE,
  VERSION_DU_DICTIONNAIRE,
  controlerLeDictionnaire,
  dictionnaireUtilisable,
} from '../src/lib/odyssee/dictionnaire-vendeurs';
import { LIBELLES } from './lib/libelles-synthetiques.mts';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

const su = (p: Partial<Connaissance> = {}): Connaissance => ({
  regles: [], vendeurs: [], dictionnaire: DICTIONNAIRE, ...p,
});

const regle = (p: Partial<RegleDePointage> = {}): RegleDePointage => ({
  id: 'r1', nom: 'Le Fournil de Tournay', typeId: 'boulangerie',
  motif: 'LE FOURNIL', comparaison: 'contient', mode: 'proposer', ligneId: null,
  appliquee: 0, corrigee: 0, majLe: '2026-10-01T00:00:00.000Z', ...p,
});

console.log('\n1. LA TAXONOMIE');

{
  egal('1.1 le garde-fou ne trouve rien', controlerLaTaxonomie(), []);
  egal('1.2 douze familles', Object.keys(FAMILLES).length, 12);
  verifier('1.3 cinquante-neuf types, plus trois états',
    TOUS_LES_TYPES.length === 62, String(TOUS_LES_TYPES.length));
  egal('1.4 aucune catégorie hors du catalogue', categoriesInconnues(), []);
  egal('1.5 aucune catégorie orpheline', categoriesOrphelines(), []);
}

{
  /* Ce qui est sensible ne peut jamais être pointé seul. C'est l'invariant. */
  const sensibles = TOUS_LES_TYPES.filter((t) => t.sensible);
  verifier('1.6 des types sensibles existent', sensibles.length >= 6);
  verifier('1.7 et tous interdisent l’automatisme', sensibles.every((t) => t.jamaisAuto));
  verifier('1.8 une pharmacie en est', typeDe('pharmacie')?.sensible === true);
  verifier('1.9 un retrait n’est pas sensible mais reste manuel',
    typeDe('retrait')?.sensible === false && typeDe('retrait')?.jamaisAuto === true);
  verifier('1.10 un supermarché est pointable', typeDe('supermarche')?.jamaisAuto === false);
}

{
  egal('1.11 un type rend sa catégorie', categorieDuType('boulangerie'), 'Alimentation');
  egal('1.12 une modification la remplace',
    categorieDuType('boulangerie', [{ typeId: 'boulangerie', categorie: 'Vie courante' }]),
    'Vie courante');
  egal('1.13 un type inconnu ne casse rien', categorieDuType('inventé'), 'Sans catégorie');
}

console.log('\n2. LE LIBELLÉ RÉDUIT');

{
  egal('2.1 la mention de carte part', libelleNet('CB CARREFOUR CITY TOURNAY 1210'),
    'CARREFOUR CITY TOURNAY');
  egal('2.2 le prélèvement SEPA aussi', libelleNet('PRLV SEPA EDF CLIENTS'), 'EDF CLIENTS');
  /*
     La date est retirée **avant** la normalisation, tant que le « / » est
     encore là. Mon premier jet la cherchait après, où elle était devenue
     « 12 10 » et ne ressemblait plus à une date.
  */
  egal('2.3 la date séparée part', libelleNet('CB FNAC 12/10/2026'), 'FNAC');
  egal('2.4 la date à points aussi', libelleNet('CB FNAC 12.10.26'), 'FNAC');
  egal('2.5 la référence part', libelleNet('CB AMAZON REF : 00912'), 'AMAZON');
  egal('2.6 le numéro long part', libelleNet('PRLV EDF 00055347'), 'EDF');
  egal('2.7 les quatre chiffres de fin partent', libelleNet('CB LIDL 0310'), 'LIDL');
}

{
  /*
     Les mentions ne se retirent qu'en **tête** : « CARTE GRISE » est un nom.
     Et « CARTE » seul n'est pas une mention — seul « CARTE » suivi de
     chiffres en est une.
  */
  verifier('2.8 « carte grise » survit',
    libelleNet('PRLV CARTE GRISE ANTS').includes('CARTE GRISE'),
    libelleNet('PRLV CARTE GRISE ANTS'));
  egal('2.9 mais « carte 1210 » est du bruit',
    libelleNet('PAIEMENT CARTE 1210 LECLERC'), 'LECLERC');
}

{
  /* Les motifs génériques ne sont pas du bruit : ils sont la part la plus sûre. */
  for (const mot of ['RETRAIT', 'VIREMENT', 'COTISATION', 'FRAIS', 'CHEQUE']) {
    verifier(`2.x « ${mot} » survit à la normalisation`,
      libelleNet(`${mot} DAB GARE`).startsWith(mot), libelleNet(`${mot} DAB GARE`));
  }
}

{
  const avec = lireLeLibelle('CB PAYPAL *DECATHLON');
  egal('2.10 l’intermédiaire est traversé', avec.net, 'DECATHLON');
  egal('2.11 et nommé', avec.intermediaire, 'PAYPAL');
  verifier('2.12 le vendeur final est lisible', !avec.vendeurFinalIllisible);
  const sans = lireLeLibelle('CB PAYPAL 4039035165');
  verifier('2.13 un intermédiaire sans vendeur final le dit', sans.vendeurFinalIllisible);
  egal('2.14 et ne devine rien', sans.net, 'PAYPAL');
}

console.log('\n3. LE MOTIF COLLE SUR UN MOT ENTIER');

{
  /*
     Sans frontière de mot, « BOULANGERIE PAUL » contient « BOULANGER » et
     une boulangerie de quartier se classe en magasin d’électroménager.
     C’est la mesure qui l’a trouvé, pas la relecture : l’entrée
     « Boulanger » est parfaitement juste prise seule.
  */
  egal('3.1 un fragment ne colle pas', positionDuMotif('BOULANGERIE PAUL', 'BOULANGER'), -1);
  egal('3.2 le mot entier colle', positionDuMotif('BOULANGERIE PAUL', 'BOULANGERIE'), 0);
  egal('3.3 au milieu aussi', positionDuMotif('CB GRAND FRAIS LILLE', 'GRAND FRAIS'), 3);
  egal('3.4 en fin de chaîne aussi', positionDuMotif('ABONNEMENT NETFLIX', 'NETFLIX'), 11);
  egal('3.5 et un préfixe de mot ne colle pas', positionDuMotif('NETFLIXOSE', 'NETFLIX'), -1);
}

console.log('\n4. L’ORDRE DE RÉSOLUTION');

{
  const r = reconnaitre('CB LE FOURNIL DE TOURNAY', su({ regles: [regle()] }));
  egal('4.1 ma règle gagne', r.nom, 'Le Fournil de Tournay');
  egal('4.2 et elle est certaine', r.certitude, 'certain');
  egal('4.3 la source est nommée', r.source, 'ma-regle');
  verifier('4.4 et la raison est affichable', r.parQuoi?.includes('votre règle') ?? false);
}

{
  /*
     Ma règle passe **avant** le dictionnaire, même quand le dictionnaire
     connaît l'enseigne : il est écrit sans avoir vu ces relevés.
  */
  const mienne = regle({ nom: 'Mon supermarché', motif: 'LIDL', typeId: 'superette' });
  const r = reconnaitre('CB LIDL TOURNAY', su({ regles: [mienne] }));
  egal('4.5 ma règle prime sur le dictionnaire', r.nom, 'Mon supermarché');
  egal('4.6 et impose son type', r.typeId, 'superette');
}

{
  const vu: Vendeur = {
    id: 'v1', nom: 'Le Fournil de Tournay', typeId: 'boulangerie',
    alias: ['LE FOURNIL DE TOURNAY'], vu: 4, majLe: '2026-10-01T00:00:00.000Z',
  };
  const r = reconnaitre('CB LE FOURNIL DE TOURNAY 0310', su({ vendeurs: [vu] }));
  egal('4.7 un vendeur déjà vu est reconnu', r.nom, 'Le Fournil de Tournay');
  egal('4.8 mais seulement comme probable', r.certitude, 'probable');
  egal('4.9 la source le dit', r.source, 'mon-historique');
  verifier('4.10 et la ressemblance est chiffrée', (r.ressemblance ?? 0) >= SEUIL_RESSEMBLANCE);
}

{
  const r = reconnaitre('CB CARREFOUR CITY TOURNAY', su());
  egal('4.11 le dictionnaire reconnaît', r.nom, 'Carrefour City');
  egal('4.12 une entrée sûre est certaine', r.certitude, 'certain');
  const a = reconnaitre('CB AMAZON MARKETPLACE', su());
  egal('4.13 une entrée ambiguë ne l’est pas', a.certitude, 'probable');
  egal('4.14 et vise le type multi-catégories', a.typeId, 'commerce-multi-categories');
}

{
  const r = reconnaitre('CB ZZQW TRADING LTD', su({ categorieDeLaBanque: 'Loisirs' }));
  egal('4.15 la catégorie de la banque est un indice de dernier rang',
    r.source, 'categorie-de-la-banque');
  egal('4.16 elle ne nomme aucun vendeur', r.nom, null);
  const rien = reconnaitre('CB ZZQW TRADING LTD', su());
  egal('4.17 sans elle, c’est inconnu', rien.certitude, 'inconnu');
  egal('4.18 et rien n’est inventé', [rien.nom, rien.typeId], [null, null]);
}

console.log('\n5. LE GÉNÉRIQUE EST UN FILET, PAS UN CONCURRENT');

{
  /*
     Quatre libellés d’un coup se classaient en « Abonnement »,
     « Assurance » ou « Cotisation » parce que le mot générique était plus
     long que l’enseigne. Le filet ne doit jouer que si rien n’a répondu.
  */
  egal('5.1 l’enseigne gagne sur le générique',
    reconnaitre('PRELEVEMENT SFR ABONNEMENT', su()).nom, 'SFR');
  egal('5.2 même quand le générique est plus long',
    reconnaitre('PRLV ASSURANCE MAIF SOCIETAIRE', su()).nom, 'MAIF');
  egal('5.3 et pour un organisme',
    reconnaitre('VIR URSSAF COTISATIONS', su()).nom, 'URSSAF');
  egal('5.4 le filet joue quand rien d’autre ne répond',
    reconnaitre('PRLV ABONNEMENT MENSUEL', su()).nom, 'Abonnement');
}

{
  /*
     Et à position égale, le motif le plus long gagne ; à position
     différente, le premier. Le commerçant est en tête du libellé.
  */
  egal('5.5 le plus précis gagne à position égale',
    reconnaitre('CB CARREFOUR CITY TOURNAY', su()).nom, 'Carrefour City');
  egal('5.6 et le premier gagne à position différente',
    reconnaitre('CB FNAC DARTY PARTICIPATIONS', su()).nom, 'Fnac');
}

console.log('\n6. AUCUN FAUX POSITIF');

{
  let faux = 0;
  let justes = 0;
  const manques: string[] = [];
  for (const l of LIBELLES) {
    const r = reconnaitre(l.libelle, su());
    if (l.attendu === null) {
      if (r.nom !== null) faux += 1;
      else justes += 1;
    } else if (r.nom === l.attendu) justes += 1;
    else manques.push(`${l.libelle} → ${r.nom ?? 'rien'}, attendu ${l.attendu}`);
  }
  egal('6.1 aucun libellé inconnu n’est faussement reconnu', faux, 0);
  egal('6.2 et aucun libellé connu n’est manqué', manques, []);
  verifier(`6.3 ${justes} sur ${LIBELLES.length} du jeu synthétique`,
    justes === LIBELLES.length, `${justes}/${LIBELLES.length}`);
}

console.log('\n7. LE DICTIONNAIRE');

{
  egal('7.1 le garde-fou ne trouve rien', controlerLeDictionnaire(), []);
  verifier('7.2 il n’est pas vide', DICTIONNAIRE.length >= 200, String(DICTIONNAIRE.length));
  verifier('7.3 il est daté', /^\d{4}-\d{2}-\d{2}$/.test(VERSION_DU_DICTIONNAIRE));
  const surs = DICTIONNAIRE.filter((e) => e.statut === 'sur').length;
  verifier('7.4 une majorité d’entrées sûres', surs > DICTIONNAIRE.length / 2, String(surs));
  verifier('7.5 et des motifs génériques', DICTIONNAIRE.some((e) => e.generique));
}

{
  /*
     Une entrée masquée disparaît, et masquer n'est pas supprimer : une mise
     à jour du fichier ne doit pas la faire réapparaître.
  */
  const sans = dictionnaireUtilisable(['Carrefour City']);
  egal('7.6 une entrée masquée disparaît', sans.length, DICTIONNAIRE.length - 1);
  const r = reconnaitre('CB CARREFOUR CITY TOURNAY', su({ dictionnaire: sans }));
  verifier('7.7 et n’est plus reconnue par elle', r.nom !== 'Carrefour City', String(r.nom));
}

console.log('\n8. LES VENDEURS INCONNUS, GROUPÉS');

{
  /*
     Un vendeur par ligne, jamais une opération par ligne. Six vendeurs
     couvrant quatorze opérations font six lignes — en faire quatorze est
     exactement ce qui fait abandonner.
  */
  const operations = [
    { id: 'A', libelle: 'CB ETS DURAND ET FILS 0310', centimes: -850 },
    { id: 'B', libelle: 'CB ETS DURAND ET FILS 1210', centimes: -1240 },
    /*
       Tronqué par la banque, ce qui est la variation réelle : une banque
       coupe la fin d'un libellé, elle n'en retire pas un mot du milieu.
       Mesuré en écrivant cet essai : « ETS DURAND ET FILS » contre « ETS
       DURAND FILS » tombe à 0,83 et le seuil de 0,85 les sépare — ce qui
       est le bon côté de l'erreur, mais qu'il faut savoir.
    */
    { id: 'C', libelle: 'CB ETS DURAND ET FIL 1510', centimes: -920 },
    { id: 'D', libelle: 'CB SARL MARTIN PLOMBERIE', centimes: -42000 },
    { id: 'E', libelle: 'CB LIDL TOURNAY', centimes: -3400 },
  ];
  const groupes = grouperLesInconnus(operations, su());
  egal('8.1 deux vendeurs inconnus, pas quatre', groupes.length, 2);
  egal('8.2 le plus coûteux en tête', groupes[0].net, 'SARL MARTIN PLOMBERIE');
  egal('8.3 et les variantes sont rassemblées', groupes[1].operationIds.length, 3);
  egal('8.4 Lidl, qui est connu, n’y est pas',
    groupes.some((g) => g.net.includes('LIDL')), false);
  egal('8.5 le cumul est juste', groupes[1].cumule, 850 + 1240 + 920);
}

{
  /*
     Et ce qu'un motif générique attrape n'est **pas** inconnu : c'est une
     proposition. « LE FOURNIL DE TOURNAY » tombe sur le motif « FOURNIL »,
     qui donne le bon type — boulangerie — et un nom approximatif. Il part
     donc en « à pointer » avec une suggestion, pas en « nom inconnu ».

     La nuance compte pour l'écran : on ne demande pas à quelqu'un
     d'identifier un vendeur dont on vient de deviner le métier.
  */
  const r = reconnaitre('CB LE FOURNIL DE TOURNAY 0310', su());
  egal('8.6 un motif générique rend une proposition', r.certitude, 'probable');
  egal('8.7 avec le bon type', r.typeId, 'boulangerie');
  egal('8.8 et pas un inconnu',
    grouperLesInconnus([{ id: 'F', libelle: 'CB LE FOURNIL DE TOURNAY', centimes: -800 }], su()),
    []);
}

console.log('\n9. LES GARDE-FOUS D’UN MOTIF');

{
  const tous = ['CB LE FOURNIL DE TOURNAY', 'CB LE FOURNIL DE PARIS 14', 'CB LIDL'];
  const vises = ['CB LE FOURNIL DE TOURNAY'];

  const court = examinerLeMotif('LE', vises, tous);
  verifier('9.1 un motif de deux lettres est refusé', !court.acceptable);
  verifier('9.2 et il dit pourquoi', court.avertissement.includes('caractères'));

  const courant = examinerLeMotif('VIREMENT', vises, tous);
  verifier('9.3 un mot de plomberie est refusé', !courant.acceptable);

  const large = examinerLeMotif('LE FOURNIL', vises, tous);
  verifier('9.4 un motif qui déborde est accepté', large.acceptable);
  egal('9.5 mais ce qu’il attrape est montré', large.deTrop.length, 1);
  verifier('9.6 avec un avertissement', large.avertissement.includes('autre commerçant'));

  const juste = examinerLeMotif('FOURNIL DE TOURNAY', vises, tous);
  verifier('9.7 un motif précis ne déborde pas', juste.acceptable && !juste.deTrop.length);
  egal('9.8 et n’avertit de rien', juste.avertissement, '');
  egal('9.9 la longueur minimale est de quatre', MOTIF_LONGUEUR_MINIMALE, 4);
}

console.log('\n10. LA RESSEMBLANCE');

{
  egal('10.1 deux chaînes identiques se ressemblent entièrement',
    ressemblance('CARREFOUR', 'CARREFOUR'), 1);
  verifier('10.2 une lettre de différence reste au-dessus du seuil',
    ressemblance('CARREFOUR CITY', 'CARREFOUR CITYY') >= SEUIL_RESSEMBLANCE);
  verifier('10.3 deux enseignes différentes passent dessous',
    ressemblance('CARREFOUR CITY', 'MONOPRIX PARIS') < SEUIL_RESSEMBLANCE);
  verifier('10.4 le seuil est mesurable, pas décrété',
    SEUIL_RESSEMBLANCE > 0.7 && SEUIL_RESSEMBLANCE < 0.98, String(SEUIL_RESSEMBLANCE));
  egal('10.5 le garde-fou du module ne trouve rien', controlerLaReconnaissance(), []);
}

console.log(
  echecs.length
    ? `\n\x1b[31m${reussis} essais réussis, ${echecs.length} échec(s).\x1b[0m\n` +
        echecs.map((e) => `  ✗ ${e}`).join('\n') + '\n'
    : `\n\x1b[32m${reussis} essais réussis, 0 échec.\x1b[0m\n`,
);
process.exit(echecs.length ? 1 : 0);
