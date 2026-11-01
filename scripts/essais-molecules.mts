/**
 * Les contrôles du registre, des paires, des limites et des doses.
 *
 * Ces essais portent d'abord sur des **refus**. C'est voulu : ils ont été
 * écrits quand le catalogue était vide, pour être déjà en place et déjà durs
 * le jour où du contenu arriverait. Un contrôle écrit après le contenu s'y
 * adapte ; celui-ci a été écrit avant. Le contenu est arrivé — cinq fiches —,
 * et la dernière section le fait passer par ces mêmes contrôles.
 *
 * Chaque cas de refus est accompagné du cas passant correspondant : un
 * contrôle qui refuse tout ne contrôle rien non plus.
 */
import {
  chercher,
  controlerLigneDose,
  controlerLimite,
  direLaLimite,
  limitesDe,
  LIMITES,
  controlerPaire,
  controlerRegistre,
  LIBELLE_MAX_ETUDIEE,
  MESSAGE_PROBABLE,
  ORDRE_STATUTS,
  replier,
  type EntreeRegistre,
  type LigneDose,
  type LimiteSourcee,
  type PaireInteraction,
} from '../src/lib/odyssee/molecules';
import { CATALOGUE, controlerFiche } from '../src/lib/odyssee/sante';
import {
  ABSENTE_DU_THESAURUS,
  INTERACTIONS,
  INTERACTIONS_NON_RELIEES,
  controlerLiaisonAuThesaurus,
  interactionsDeLaFiche,
} from '../src/lib/odyssee/molecules';
import {
  CLASSES_CONNUES,
  IDENTIFIANTS_DE_CLASSE,
  classeDeclaree,
} from '../src/lib/odyssee/classes-de-molecules';
import { CLASSES_DU_CYCLE } from '../src/lib/notifications/filtre-cycle';
import { populationNonLue } from '../src/lib/noyau/population';

/**
 * UNE SOURCE COMPLÈTE, parce que « Source » en exige quatre champs et que ces
 * fabrications n'en donnaient que deux.
 *
 * Il manquait « nom » et « populationVisee ». Le second n'est pas un oubli de
 * forme : son commentaire dans « odyssee/sante.ts » explique qu'il est
 * OBLIGATOIRE exprès, parce qu'avec un champ facultatif « on peut citer une
 * source sans dire qui elle vise, et rien ne s'en aperçoit avant l'écran — où
 * le repère s'affiche comme s'il concernait tout le monde ».
 *
 * C'est donc une garde posée contre un défaut d'affichage précis, et sept
 * fabrications de cet essai la contournaient sans le savoir : elles
 * éprouvaient « controlerPaire » sur des sources que le programme refuse de
 * construire. Le même commentaire donne la réponse honnête pour un document
 * qui n'a pas été relu pour cela, et c'est celle qu'on prend ici.
 */
const source = (ou: string, le: string, nom = 'Document d’essai') => ({
  nom,
  ou,
  le,
  populationVisee: populationNonLue('document d’essai, non relu pour la population visée'),
});

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(
      `  \x1b[31m✗\x1b[0m ${quoi}\n      attendu ${JSON.stringify(attendu)}\n      obtenu  ${JSON.stringify(obtenu)}`,
    );
    rouges += 1;
  }
};

const entree = (p: Partial<EntreeRegistre> = {}): EntreeRegistre => ({
  id: 'cafeine',
  nom: 'Caféine',
  alias: [],
  nomenclature: null,
  fiche: false,
  identiteVerifiee: false,
  ...p,
});

console.log('\n\x1b[1mLE REGISTRE NE PORTE QUE DES NOMS\x1b[0m\n');
{
  v('une entrée minimale passe', controlerRegistre([entree()]), []);
  v(
    'un champ de catégorie est refusé',
    controlerRegistre([{ ...entree(), categorie: 'nootropiques' } as unknown as EntreeRegistre])
      .length,
    1,
  );
  v(
    'et le refus nomme le champ',
    controlerRegistre([
      { ...entree(), provenance: 'bibliotheque' } as unknown as EntreeRegistre,
    ])[0]?.includes('provenance'),
    true,
  );
  for (const interdit of ['theme', 'liens', 'mentions', 'dose', 'pseudonyme', 'bibliotheque']) {
    v(
      `« ${interdit} » est refusé`,
      controlerRegistre([{ ...entree(), [interdit]: 'x' } as unknown as EntreeRegistre]).length > 0,
      true,
    );
  }
  v(
    'un champ simplement inconnu est refusé aussi',
    controlerRegistre([{ ...entree(), couleur: 'bleu' } as unknown as EntreeRegistre]).length,
    1,
  );
  v(
    'une identité « vérifiée » sans nomenclature est refusée',
    controlerRegistre([entree({ identiteVerifiee: true })]).length,
    1,
  );
  v(
    'avec sa nomenclature, elle passe',
    controlerRegistre([entree({ identiteVerifiee: true, nomenclature: 'DCI:caffeine' })]),
    [],
  );
  v(
    'un registre non trié est refusé',
    controlerRegistre([entree({ id: 'zinc', nom: 'Zinc' }), entree()]).some((p) =>
      p.includes('alphabétique'),
    ),
    true,
  );
  v(
    'deux fois le même identifiant est refusé',
    controlerRegistre([entree(), entree()]).some((p) => p.includes('double')),
    true,
  );
}

console.log('\n\x1b[1mLA RECHERCHE : SANS CASSE, SANS ACCENT, SANS TRACE\x1b[0m\n');
{
  const registre = [
    entree({ id: 'cafeine', nom: 'Caféine', alias: ['theine'] }),
    entree({ id: 'creatine', nom: 'Créatine' }),
    entree({ id: 'zinc', nom: 'Zinc' }),
  ];
  v('replier enlève accents et casse', replier('Créatine'), 'creatine');
  v(
    'une recherche sans accent trouve le mot accentué',
    chercher(registre, 'cafeine').map((e) => e.id),
    ['cafeine'],
  );
  v(
    'la casse est indifférente',
    chercher(registre, 'CRÉA').map((e) => e.id),
    ['creatine'],
  );
  v(
    'un alias trouve l’entrée',
    chercher(registre, 'theine').map((e) => e.id),
    ['cafeine'],
  );
  v(
    'une requête vide rend tout, par ordre alphabétique',
    chercher(registre, '').map((e) => e.id),
    ['cafeine', 'creatine', 'zinc'],
  );
  v(
    '« mes molécules » passent devant',
    chercher(registre, '', new Set(['zinc'])).map((e) => e.id),
    ['zinc', 'cafeine', 'creatine'],
  );
  v('le plafond est respecté', chercher(registre, '', new Set(), 2).length, 2);
}

console.log('\n\x1b[1mLE STATUT « PROBABLE » EXIGE SA BASE\x1b[0m\n');
{
  const paire = (p: Partial<PaireInteraction> = {}): PaireInteraction => ({
    a: 'A',
    b: 'B',
    statut: 'probable',
    base: null,
    gravite: null,
    ...p,
  });
  v(
    'une paire « probable » sans base est refusée',
    controlerPaire(paire())[0]?.includes('sans base publiée'),
    true,
  );
  v(
    'avec une publication primaire citée, elle passe',
    controlerPaire(
      paire({
        base: { nature: 'cas-rapporte', source: source('Rev. Exemple 2025;1:1', '2025-01-01') },
      }),
    ),
    [],
  );
  v(
    'une base sans provenance est refusée',
    controlerPaire(
      paire({ base: { nature: 'cas-rapporte', source: source('', '2025-01-01') } }),
    ).length,
    1,
  );
  v(
    'une paire « théorique » qui porte une base est refusée',
    controlerPaire(
      paire({
        statut: 'theorique',
        base: { nature: 'essai', source: source('x', '2025-01-01') },
      }),
    ).length,
    1,
  );
  v('l’ordre des statuts est celui du prompt', ORDRE_STATUTS.slice(0, 4), [
    'documentee',
    'probable',
    'theorique',
    'non-documentee',
  ]);
  for (const idee of [
    'une interaction potentielle existe',
    'non documentée',
    'des précautions sont à prendre',
    'médecin ou un pharmacien',
  ]) {
    v(`le message porte « ${idee} »`, replier(MESSAGE_PROBABLE).includes(replier(idee)), true);
  }
  v(
    'et il ne dit pas quoi faire',
    ['espacer', 'remplacer', 'arrêter', 'réduire'].some((m) =>
      replier(MESSAGE_PROBABLE).includes(replier(m)),
    ),
    false,
  );
}

console.log('\n\x1b[1mUNE LIMITE SANS SOURCE N’EST PAS AFFICHABLE\x1b[0m\n');
{
  const limite = (p: Partial<LimiteSourcee> = {}): LimiteSourcee => ({
    nature: 'autorite',
    valeur: 'Limite supérieure fixée par l’EFSA pour l’adulte : 400 mg par jour.',
    population: 'adulte',
    voie: 'orale',
    source: source('EFSA 2015', '2015-05-27'),
    date: '2015-05-27',
    ...p,
  });
  v('une limite complète passe', controlerLimite(limite()), []);
  v('sans source, refusée', controlerLimite(limite({ source: source('', '') })).length, 1);
  v('sans population, refusée', controlerLimite(limite({ population: '' })).length, 1);
  v('sans voie, refusée', controlerLimite(limite({ voie: '' })).length, 1);

  /*
     LES LIMITES RÉELLEMENT LIVRÉES, ET LE COMPTE QUI VERROUILLE LA MESURE.

     Une seule limite est livrée, et ce chiffre est le résultat d'une lecture
     des huit RCP de la collecte : un seul énonce une dose maximale. Si
     quelqu'un en ajoute une sans source — ou si une source disparaît —, c'est
     ici que ça se voit. Le compte fait donc partie de l'essai, pas seulement
     la forme.
  */
  for (const [molecule, liste] of Object.entries(LIMITES)) {
    for (const l of liste) {
      v(`la limite livrée de « ${molecule} » est affichable`, controlerLimite(l), []);
    }
  }
  v('une seule molécule porte une limite', Object.keys(LIMITES).length, 1);
  v('et c’est la N-acétylcystéine', Object.keys(LIMITES)[0], 'n-acetylcysteine');
  v('sa limite vient d’un RCP', LIMITES['n-acetylcysteine'][0].nature, 'rcp');
  v('elle cite son document', LIMITES['n-acetylcysteine'][0].source.empreinte !== undefined, true);

  /*
     Les quatre autres molécules du catalogue n'ont AUCUNE limite, et c'est
     constaté : dans leur RCP, « maximale » qualifie une concentration
     plasmatique, pas une dose. L'essai le fige pour qu'une limite ne s'y
     glisse pas par analogie avec la première.
  */
  for (const sans of [
    'testosterone-enantate',
    'testosterone-undecanoate',
    'modafinil',
    'cafeine',
  ]) {
    v(`« ${sans} » n’a pas de limite`, limitesDe(sans), []);
  }
  v('une molécule hors catalogue non plus', limitesDe('inconnue-du-catalogue'), []);
  v('ni une molécule sans identifiant', limitesDe(null), []);

  /* La phrase affichée nomme la nature AVANT le chiffre : c'est elle qui dit
     comment lire le nombre. */
  const dite = direLaLimite(LIMITES['n-acetylcysteine'][0]);
  v('la phrase commence par la nature de la limite', dite.startsWith('Dose maximale du résumé'), true);
  v('et elle porte la population', dite.includes('Adulte'), true);
  for (const mot of ['ne dépassez pas', 'recommandé', 'sûr jusqu’à', 'dose habituelle']) {
    v(
      `« ${mot} » est refusé par la revue H.9`,
      controlerLimite(limite({ valeur: `400 mg, ${mot}` })).some((p) => p.includes('H.9')),
      true,
    );
  }
  v(
    'une dose maximale étudiée sans son libellé fixe est refusée',
    controlerLimite(limite({ nature: 'max-etudiee', valeur: '600 mg' })).some((p) =>
      p.includes('libellé fixe'),
    ),
    true,
  );
  v(
    'avec son libellé, elle passe',
    controlerLimite(limite({ nature: 'max-etudiee', valeur: `600 mg. ${LIBELLE_MAX_ETUDIEE}` })),
    [],
  );
}

console.log('\n\x1b[1mUNE LIGNE DE DOSE DÉCRIT UNE ÉTUDE, PAS UNE CONSIGNE\x1b[0m\n');
{
  const ligne = (p: Partial<LigneDose> = {}): LigneDose => ({
    provenance: 'humain',
    dose: '200 mg',
    voie: 'orale',
    frequence: 'dose unique',
    population: 'volontaires sains',
    effectif: '24',
    duree: 'une prise',
    effet: 'temps de réaction raccourci',
    indesirables: 'aucun rapporté',
    typeEtude: 'essai randomisé',
    source: source('Rev. Exemple 2024;3:7', '2024-03-01'),
    ...p,
  });
  v('une ligne complète passe', controlerLigneDose(ligne()), []);
  v('sans effectif, refusée', controlerLigneDose(ligne({ effectif: '' })).length, 1);
  v('sans durée, refusée', controlerLigneDose(ligne({ duree: '' })).length, 1);
  v('sans type d’étude, refusée', controlerLigneDose(ligne({ typeEtude: '' })).length, 1);
  v('sans source, refusée', controlerLigneDose(ligne({ source: source('', '') })).length, 1);
  v(
    'une provenance animale est refusée comme dose',
    controlerLigneDose(ligne({ provenance: 'animal' as 'humain' })).some((p) =>
      p.includes('animale'),
    ),
    true,
  );
  for (const mot of ['dose efficace', 'dose optimale', 'plus puissant']) {
    v(
      `« ${mot} » est refusé`,
      controlerLigneDose(ligne({ effet: `${mot} à 200 mg` })).some((p) => p.includes('H.9')),
      true,
    );
  }
}

console.log('\n\x1b[1mCE QUI EST LIVRÉ PASSE LES CONTRÔLES CI-DESSUS\x1b[0m\n');
{
  /*
     L'alarme douce a sonné, et elle avait raison.

     Cet essai constatait que le catalogue était vide, en annonçant qu'il
     servirait d'alarme si quelqu'un y glissait une fiche sans la faire passer
     par les contrôles. Cinq fiches sont arrivées : l'alarme a fait son
     travail, et c'est ici qu'elle se transforme en ce qu'elle annonçait —
     chaque fiche livrée passe `controlerFiche`, nommément.

     Le compte n'est pas figé : on vérifie qu'il y en a, pas combien. Un
     chiffre recopié ici rougirait à la sixième fiche sans que rien ne soit
     cassé.
  */
  v('le catalogue de molécules n’est pas vide', CATALOGUE.length > 0, true);
  for (const livree of CATALOGUE) {
    v(`« ${livree.nom} » passe les contrôles de fiche`, controlerFiche(livree), []);
  }
}


console.log('\n\x1b[1mLES ONZE INTERACTIONS SONT ATTEIGNABLES DEPUIS UNE FICHE\x1b[0m');

/*
   LE DÉFAUT QUE CETTE SECTION GARDE. Les onze paires du Thésaurus existaient
   depuis le 16 octobre et aucun écran ne les montrait : rien ne reliait un
   identifiant de fiche (`testosterone-enantate`) aux noms sous lesquels le
   document les indexe (« androgènes »). Elles étaient sourcées, justes et
   invisibles.

   Ce contrôle tient la liaison dans les DEUX sens : aucune fiche sans
   réponse, aucune paire sans fiche.
*/
v('la table de liaison ne contredit ni le catalogue ni le document', controlerLiaisonAuThesaurus(CATALOGUE), []);

{
  /* Chaque fiche livrée rend un état, et jamais « non reliée » : une fiche
     non reliée afficherait « non examinée » alors qu'on a lu le document. */
  const etats = CATALOGUE.map((f) => [f.id, interactionsDeLaFiche(f.id).etat]);
  v('aucune fiche livrée n’est laissée non reliée', etats.filter(([, e]) => e === 'non-reliee'), []);
  v(
    'et chacune rend l’état que la source impose',
    Object.fromEntries(etats),
    {
      'testosterone-enantate': 'documentees',
      'testosterone-undecanoate': 'documentees',
      modafinil: 'documentees',
      /* Lue, et absente du document : ce n'est pas « sans interaction ». */
      'n-acetylcysteine': 'absente-du-thesaurus',
      cafeine: 'documentees',
    },
  );
}

{
  /* Les onze paires s'affichent toutes, et une seule fois chacune — à ceci
     près que les deux esters partagent l'entrée de classe « androgènes »,
     qui compte donc deux fois. */
  const parFiche = CATALOGUE.map((f) => {
    const r = interactionsDeLaFiche(f.id);
    return r.etat === 'documentees' ? r.paires.length : 0;
  });
  v('les paires atteignables, fiche par fiche', parFiche, [2, 2, 2, 0, 7]);
  const atteintes = new Set(
    CATALOGUE.flatMap((f) => {
      const r = interactionsDeLaFiche(f.id);
      return r.etat === 'documentees' ? r.paires.map((p) => `${p.a}×${p.b}`) : [];
    }),
  );
  v('et les onze du Thésaurus sont toutes atteintes', atteintes.size, INTERACTIONS.length);
}

{
  /*
     L'ORDRE EST CELUI DE LA GRAVITÉ, et c'est la hiérarchie anti-fatigue de
     la décision 3.10 appliquée ici : le plus grave en tête, parce qu'une
     association déconseillée en bas de liste est une ligne qu'on ne lit pas.
     À gravité égale, l'alphabet — pas l'ordre de lecture du PDF, qui ne veut
     rien dire pour qui regarde l'écran.
  */
  const r = interactionsDeLaFiche('cafeine');
  const lignes = r.etat === 'documentees'
    ? r.paires.map((p) => `${p.b} — ${p.gravite?.connue ? p.gravite.valeur : '?'}`)
    : [];
  v('la caféine, de la plus grave à la moins grave', lignes, [
    'énoxacine — Association déconseillée',
    'dipyridamole — Précaution d’emploi',
    'stiripentol — Précaution d’emploi',
    'ciprofloxacine — À prendre en compte',
    'lithium — À prendre en compte',
    'méxilétine — À prendre en compte',
    'norfloxacine — À prendre en compte',
  ]);
}

{
  /*
     SOUS QUEL NOM, et ce n'est pas de l'érudition. Le document ne traite pas
     la testostérone : il traite la classe « androgènes », avec
     l'androstanolone et la noréthandrolone. Montrer ces paires sans le dire
     laisserait croire que l'entrée vise cet ester-là — ce que le catalogue
     appelle lui-même surinterpréter la source.
  */
  const r = interactionsDeLaFiche('testosterone-enantate');
  v('la testostérone dit sous quel nom elle est traitée', r.etat === 'documentees' ? r.sous : [], ['androgènes']);
  const c = interactionsDeLaFiche('cafeine');
  v('et la caféine, sous le sien', c.etat === 'documentees' ? c.sous : [], ['caféine']);
}

{
  /* Chaque gravité affichée porte sa source et sa page : une gravité sans
     source serait la valeur non sourcée que tout ce domaine empêche, et elle
     porterait sur une association médicamenteuse. */
  const sansSource = INTERACTIONS.filter((p) => !p.gravite?.connue || !p.gravite.source?.ou?.trim());
  v('aucune gravité n’est affirmée sans sa source', sansSource.map((p) => `${p.a}×${p.b}`), []);
  const sansPage = INTERACTIONS.filter((p) => p.gravite?.connue && !/p\. \d+/.test(p.gravite.source.nom));
  v('et chacune cite la page où la relire', sansPage.map((p) => `${p.a}×${p.b}`), []);
}

{
  /*
     LE CONTRÔLE SE VALIDE SUR LE DÉFAUT QU'IL VISE : une fiche neuve que
     personne n'a reliée doit faire rougir la liaison, sinon elle
     s'afficherait « non examinée » sans que quiconque l'apprenne.
  */
  const avecUneFicheNeuve = controlerLiaisonAuThesaurus([
    ...CATALOGUE,
    { id: 'creatine', nom: 'Créatine' },
  ]);
  v('une fiche non reliée est refusée', avecUneFicheNeuve.length, 1);
  v(
    'et le refus dit quoi faire',
    avecUneFicheNeuve[0]?.includes('Créatine') && avecUneFicheNeuve[0]?.includes('non reliée'),
    true,
  );
}

console.log('\n\x1b[1mLES TROIS ÉTATS NE SE CONFONDENT PAS\x1b[0m');

/*
   « Absente du document » et « non examinée » se ressemblent à l'œil et ne
   disent pas du tout la même chose. Les deux phrases doivent donc différer,
   et aucune ne doit affirmer l'absence d'interaction.
*/
v('les deux phrases sont distinctes', ABSENTE_DU_THESAURUS === INTERACTIONS_NON_RELIEES, false);
v(
  'l’absence de document ne se dit pas absence d’interaction',
  ABSENTE_DU_THESAURUS.includes('absence de document'),
  true,
);
v(
  'et l’absence d’examen ne se dit pas absence de risque',
  INTERACTIONS_NON_RELIEES.includes('ne signifie pas l’absence de risque'),
  true,
);

console.log('\n\x1b[1mLA CLASSE PHARMACOLOGIQUE : UN VOCABULAIRE CLOS, ET SA SOURCE\x1b[0m\n');
{
  const SOURCE = 'Thésaurus de l’ANSM, p. 17.';
  v(
    'une classe connue, avec sa source, passe',
    controlerRegistre([entree({ classe: 'androgenes', classeSource: SOURCE })]),
    [],
  );
  /*
     LE CONTRÔLE QUI SÉPARE UNE CLASSE D'UNE CATÉGORIE. Le champ `categorie`
     est refusé depuis le prompt 25, et il le reste — un essai plus haut le
     vérifie encore. Ce qui rend `classe` admissible n'est pas une exception
     de faveur : c'est que son vocabulaire est CLOS, et qu'une valeur hors
     vocabulaire est refusée exactement comme une catégorie l'était.
  */
  v(
    'une classe hors vocabulaire est refusée',
    controlerRegistre([entree({ classe: 'nootropique', classeSource: SOURCE })]).length,
    1,
  );
  v(
    'et le refus nomme les valeurs admises',
    controlerRegistre([entree({ classe: 'nootropique', classeSource: SOURCE })])[0]?.includes(
      'androgenes',
    ),
    true,
  );
  /*
     L'EXIGENCE DE SOURCE fait tout le travail : une classe sans document n'a
     pas d'autorité, et le registre redeviendrait une liste de rangements.
     L'inscription seule ne prouve rien.
  */
  v('une classe sans source est refusée', controlerRegistre([entree({ classe: 'androgenes' })]).length, 1);
  v(
    'une source vide ne vaut pas une source',
    controlerRegistre([entree({ classe: 'androgenes', classeSource: '   ' })]).length,
    1,
  );
  v(
    'une source SANS classe est refusée aussi',
    controlerRegistre([entree({ classeSource: SOURCE })]).length,
    1,
  );
  /*
     ABSENTE SE LIT « NON CLASSÉE », et c'est l'état des cinq molécules du
     catalogue au 31 octobre. Si ce contrôle rougissait, le registre réel
     deviendrait inconstructible du jour au lendemain.
  */
  v('absente, elle ne gêne rien', controlerRegistre([entree({ classe: null })]), []);
  v(
    'absente et nulle des deux côtés non plus',
    controlerRegistre([entree({ classe: null, classeSource: null })]),
    [],
  );
}

console.log('\n\x1b[1mLES DEUX LISTES DE CLASSES CONCORDENT, DANS LES DEUX SENS\x1b[0m\n');
{
  /*
     `filtre-cycle.ts` est l'autorité sur la sensibilité du cycle, et
     `classes-de-molecules.ts` en garde une COPIE dans son champ `duCycle`.
     Une copie non gardée dérive — c'est la leçon des étiquettes de magasins,
     où une étiquette restée derrière un magasin disparu satisfaisait la
     couverture sans rien dire de juste.

     Les deux sens comptent. Une classe du cycle absente du vocabulaire ne
     pourrait jamais être écrite dans le registre, donc jamais écartée : le
     filtre protégerait sur le papier. Et une classe marquée « du cycle » que
     le filtre ignore ferait écarter un rappel pour rien.
  */
  v(
    'toute classe du cycle est dans le vocabulaire',
    CLASSES_DU_CYCLE.filter((c) => !IDENTIFIANTS_DE_CLASSE.includes(c)),
    [],
  );
  v(
    'toute classe marquée « du cycle » est connue du filtre',
    CLASSES_CONNUES.filter((c) => c.duCycle && !CLASSES_DU_CYCLE.includes(c.id)).map((c) => c.id),
    [],
  );
  v(
    'et toute classe hors cycle est bien absente de la liste du filtre',
    CLASSES_CONNUES.filter((c) => !c.duCycle && CLASSES_DU_CYCLE.includes(c.id)).map((c) => c.id),
    [],
  );
  v(
    'chaque classe déclarée dit quel document la nomme',
    CLASSES_CONNUES.filter((c) => c.source.trim().length < 20).map((c) => c.id),
    [],
  );
  v(
    'le vocabulaire ne porte aucun doublon',
    new Set(IDENTIFIANTS_DE_CLASSE).size,
    IDENTIFIANTS_DE_CLASSE.length,
  );
  v('une classe inconnue ne se déclare pas', classeDeclaree('nootropique'), null);
  v('et une connue se retrouve', classeDeclaree('androgenes')?.libelle, 'androgènes');
}

if (rouges > 0) {
  console.log(`\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m`);
  process.exit(1);
}
console.log('\n\x1b[32mTous les essais passent.\x1b[0m');
