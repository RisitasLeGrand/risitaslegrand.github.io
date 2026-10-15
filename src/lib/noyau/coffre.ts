/**
 * Le coffre : le chiffrement au repos des quatre domaines sensibles.
 *
 * Décision 3, prise le 12 octobre 2026 : **Psyché, Finances, médicaments et
 * statut hormonal** sont chiffrés dans IndexedDB ; le reste — sommeil, poids,
 * séances de sport, révisions — reste en clair.
 *
 * ## Ce que ce chiffrement protège, et quand
 *
 * Il protège contre quiconque **lit la base sans le mot de passe** : une
 * extension de navigateur, un autre profil, un outil d'inspection, quelqu'un
 * qui ouvre l'ordinateur. Et il ne protège que **session verrouillée**, pour
 * une raison qu'il faut dire en face :
 *
 * > La clé du coffre n'est **jamais écrite**, ni en `localStorage`, ni en
 * > `sessionStorage`, ni dans IndexedDB. Elle vit en mémoire, le temps de
 * > l'onglet.
 *
 * C'est ce qui distingue ce chiffrement d'un théâtre. La clé du contenu, elle,
 * est mémorisée quand on coche « rester connecté » — et une extension capable
 * de lire IndexedDB peut tout aussi bien lire `localStorage`. Dériver la clé
 * du coffre de la même façon n'aurait donc rien protégé du tout : l'attaquant
 * aurait eu les deux.
 *
 * **La contrepartie est réelle et assumée** : après un rechargement, les
 * écrans sensibles redemandent le mot de passe une fois, même si « rester
 * connecté » est coché. C'est le prix de la protection, et le prétendre
 * gratuit serait mentir.
 *
 * ## Ce que ce chiffrement ne protège pas
 *
 * **Les champs d'index restent en clair.** On ne peut pas indexer ce qu'on ne
 * lit pas, et sans index une lecture par jour parcourt toute la table. Un
 * enregistrement scellé expose donc son identifiant, son jour logique et son
 * domaine. La décision 3 le disait déjà : « un index en clair sur les dates et
 * les domaines dit déjà beaucoup ». Ce qu'il **ne** dit **pas** est le
 * contenu : qu'on ait écrit quelque chose le 12 octobre dans Psyché se voit ;
 * ce qu'on a écrit, non.
 *
 * Chaque magasin sensible déclare donc ses champs clairs, et
 * `controlerCoffre()` refuse qu'un champ de contenu s'y glisse.
 *
 * ## La perte du mot de passe devient la perte des données
 *
 * C'est le premier coût listé par la décision, et il change de nature : un
 * cours se reconstruit depuis le dépôt, un journal psychique de trois ans ne
 * se reconstruit pas. La décision pose en condition **bloquante** que le
 * rappel de sauvegarde devienne plus insistant sur ces domaines. C'est
 * `rappelDeSauvegarde()`, plus bas, et les écrans concernés l'affichent.
 */

/** La version du format scellé. Un jour, elle servira. */
export const VERSION_COFFRE = 1;

/** Un enregistrement chiffré : l'IV et le texte chiffré, tous deux en base64. */
export interface Scelle {
  v: number;
  iv: string;
  ct: string;
}

/**
 * Les magasins chiffrés, et les champs qu'ils laissent en clair.
 *
 * La liste est **fermée** : un magasin qui n'y figure pas n'est pas chiffré,
 * et c'est délibéré. Chiffrer par principe coûterait un déchiffrement à chaque
 * lecture de la roue du jour, pour protéger un nombre de séries de
 * musculation.
 */
export interface MagasinScelle {
  magasin: string;
  /** Pourquoi celui-ci et pas un autre. */
  pourquoi: string;
  /**
   * Les champs laissés en clair, parce qu'ils servent d'index ou de clé.
   *
   * Rien d'autre ne doit y figurer. Un champ en clair est un champ lisible
   * sans mot de passe, et la tentation est grande d'en ajouter « juste un »
   * pour éviter un déchiffrement.
   */
  clairs: readonly string[];
}

export const MAGASINS_SCELLES: readonly MagasinScelle[] = [
  {
    magasin: 'odysseeCheckins',
    pourquoi: 'Psyché : un état intérieur quotidien, lu par un tiers, fait un dommage.',
    clairs: ['id', 'jour', 'majLe'],
  },
  {
    magasin: 'odysseeHebdos',
    pourquoi:
      'Psyché : trois questions ouvertes sur la semaine, donc du texte libre sur ce qui a pesé.',
    clairs: ['id', 'semaine', 'majLe'],
  },
  {
    magasin: 'odysseeJournal',
    pourquoi: 'Psyché : le journal est l’objet le plus intime de l’application.',
    clairs: ['id', 'jour', 'majLe'],
  },
  {
    magasin: 'odysseeMedicaments',
    pourquoi:
      'Un traitement déclaré est une donnée de santé au sens le plus strict, et son enregistrement est le seul service rendu — aucun conseil, aucune dose proposée.',
    clairs: ['id', 'jour', 'majLe'],
  },
  {
    magasin: 'odysseeExceptionsScellees',
    pourquoi:
      'Une occurrence liée à une branche sous coffre dit un rythme — « chaque jour à 8 h, quelque chose de sensible » — et un rythme se lit sans rien comprendre d’autre. Décision 3 du prompt 38.',
    /*
       Rien d'autre que la clé et la date d'écriture. Pas de `jour` ici,
       contrairement aux autres magasins scellés : le jour EST l'information
       qu'on protège. On renonce donc à l'index, et on parcourt — ce magasin
       ne porte que les exceptions des tâches sensibles, il reste petit.

       L'identifiant, lui, vaut « tâche / jour » et reste en clair, puisque
       c'est la clé. La protection est donc PARTIELLE, et le maillon faible
       n'est pas ici : la tâche elle-même vit en clair dans `odysseeTaches`,
       avec son titre et son lien. Le dire vaut mieux que de le masquer
       derrière une clé opaque qui laisserait la vraie porte ouverte.
    */
    clairs: ['id', 'majLe'],
  },
  /*
     `odysseeReports` A QUITTÉ CETTE LISTE — A-6, option D, signée le
     15 octobre.

     Il y figurait pour la bonne raison : un report en attente est la trace
     qu'un geste a eu lieu dans une branche scellée. Mais le sceller sous la
     clé du coffre rendait son écriture impossible COFFRE FERMÉ, c'est-à-dire
     dans le seul cas où il sert. Le magasin exigeait la condition qu'il
     devait contourner.

     Il n'est pas descellé pour autant : son contenu est chiffré par la
     **boîte aux lettres** (`noyau/boite-aux-lettres.ts`), dont la clé
     publique est en clair et la privée scellée. Écrire ne demande rien ;
     lire demande le coffre. Le magasin ne porte donc qu'un pli opaque sous
     une clé tirée au hasard — ni date, ni tâche, ni branche.
  */
  {
    magasin: 'odysseeComptes',
    pourquoi: 'Finances : un intitulé de compte et son type se lisent d’un coup d’œil.',
    clairs: ['id', 'majLe'],
  },
  {
    magasin: 'odysseeValorisations',
    pourquoi: 'Finances : une valorisation datée, c’est le patrimoine à une date.',
    clairs: ['id', 'compteId', 'jour', 'majLe'],
  },
  {
    magasin: 'odysseeOperations',
    pourquoi: 'Finances : les opérations racontent une vie entière, jour par jour.',
    clairs: ['id', 'jour', 'compteId', 'majLe'],
  },
  {
    magasin: 'odysseeVeilleBases',
    pourquoi:
      'Veille : la ligne de base dit l’habitude d’une personne — combien elle dort, à quelle heure elle se couche, combien de fois elle ouvre son téléphone la nuit. C’est un portrait, et il se lit sans rien comprendre d’autre.',
    clairs: ['id', 'majLe'],
  },
  {
    magasin: 'odysseePassations',
    pourquoi:
      'Échelles : un score de PHQ-9 ou de GAD-7, daté, est lisible par quiconque connaît ces instruments — et ils sont connus. C’est la donnée la plus sensible que cette application puisse contenir.',
    clairs: ['id', 'jour', 'echelle', 'majLe'],
  },
  {
    magasin: 'odysseeVeilleSignaux',
    pourquoi:
      'Veille : un repère nomme les domaines où quelqu’un s’écarte de son habitude. C’est un constat sur lui, et le lire ne demande aucune compétence.',
    clairs: ['id', 'jour', 'majLe'],
  },
  {
    magasin: 'odysseeVeilleReglages',
    pourquoi:
      'Veille : savoir que quelqu’un a activé une veille du rythme de vie est déjà une information sur lui, avant même qu’elle ait rien observé.',
    clairs: ['id', 'majLe'],
  },
  {
    magasin: 'odysseeLignesBudget',
    pourquoi: 'Finances : le budget dit ce qu’on gagne, ce qu’on doit et ce qu’on met de côté.',
    clairs: ['id', 'majLe'],
  },
  {
    magasin: 'odysseeVendeurs',
    pourquoi:
      'Finances : la liste des commerçants de quelqu’un dit où il va, ce qu’il soigne, ce à quoi il adhère et ce qu’il donne. Elle en apprend plus que presque tout le reste de cette base.',
    clairs: ['id', 'majLe'],
  },
  {
    magasin: 'odysseeReglesPointage',
    pourquoi:
      'Finances : une règle porte le nom d’un vendeur et le type qu’on lui a donné — la même information, sous une autre forme.',
    clairs: ['id', 'majLe'],
  },
  {
    magasin: 'odysseePointages',
    pourquoi:
      'Finances : un pointage relie une opération à un type de vendeur. « Pharmacie, 240 € » est un fait de santé autant qu’un fait de budget.',
    clairs: ['id', 'operationId', 'majLe'],
  },
  {
    magasin: 'odysseeTaxonomie',
    pourquoi:
      'Finances : les catégories qu’on a modifiées disent ce qu’on suit de près, et donc ce qui préoccupe.',
    clairs: ['id', 'majLe'],
  },
  {
    magasin: 'odysseeConsommateurs',
    pourquoi:
      'Finances : savoir que quelqu’un a ouvert son budget à « Demander à l’IA », ou fermé tout le reste, est une information sur lui — de la même nature que savoir qu’il a activé une veille.',
    clairs: ['id', 'majLe'],
  },
  {
    magasin: 'odysseeRapprochements',
    pourquoi:
      'Finances : un rapprochement relie un montant à une ligne de vie — « ce prélèvement de 112,40 € est mon électricité ». Il en dit autant que l’opération elle-même.',
    clairs: ['id', 'operationId', 'majLe'],
  },
  {
    magasin: 'odysseeHormonal',
    pourquoi:
      'Statut hormonal et substances : une période déclarative dont la lecture par un tiers peut coûter très cher.',
    clairs: ['id', 'debut', 'majLe'],
  },
  /*
     Santé, phase 1 (D-024). Les cinq magasins sont scellés dès leur création,
     comme l'ont été les médicaments et la psyché : une donnée de santé écrite
     en clair ne se rattrape pas, puisqu'elle resterait en clair dans les
     instantanés de migration déjà pris.

     Les champs laissés clairs sont les seuls que les index demandent. La
     fuite qu'ils portent est celle que la décision 3 nomme et accepte :
     qu'on ait écrit quelque chose ce jour-là se voit ; ce qu'on a écrit, non.
  */
  {
    magasin: 'odysseeTraitements',
    pourquoi:
      'Santé : le nom d’un traitement, sa posologie et son prescripteur disent une pathologie, une transition ou une pratique. C’est la donnée la plus coûteuse à perdre du domaine.',
    clairs: ['id', 'debut', 'majLe'],
  },
  {
    magasin: 'odysseePrelevements',
    pourquoi:
      'Santé : la date d’un bilan, son laboratoire et son contexte — « à jeun », « 3 h après la prise » — dessinent un suivi médical.',
    clairs: ['id', 'jour', 'majLe'],
  },
  {
    magasin: 'odysseeResultats',
    pourquoi:
      'Santé : un analyte et sa valeur sont un résultat d’examen. Lu par un tiers, c’est un dossier médical.',
    clairs: ['id', 'prelevementId', 'majLe'],
  },
  {
    magasin: 'odysseeSymptomes',
    pourquoi:
      'Santé : ce que la personne ressent et à quelle intensité, écrit dans ses mots.',
    clairs: ['id', 'jour', 'majLe'],
  },
  {
    magasin: 'odysseeConditions',
    pourquoi:
      'Santé : une condition déclarée dure, et sa seule lecture suffit à situer quelqu’un.',
    clairs: ['id', 'debut', 'majLe'],
  },
  {
    magasin: 'odysseeRessentis',
    pourquoi:
      'Santé : ce qu’une personne ressent sous un traitement nommé en dit autant que le ' +
      'traitement. C’est aussi la seule expérience que l’application regarde — celle des ' +
      'autres reste dehors.',
    clairs: ['id', 'traitementId', 'jour', 'majLe'],
  },
];

const PAR_MAGASIN = new Map(MAGASINS_SCELLES.map((m) => [m.magasin, m]));

export const magasinScelle = (magasin: string): MagasinScelle | undefined =>
  PAR_MAGASIN.get(magasin);

export const estScelle = (magasin: string): boolean => PAR_MAGASIN.has(magasin);

/**
 * Les champs qu'un magasin scellé n'a **jamais** le droit de laisser en clair.
 *
 * Nommés en négatif, comme les magasins absents du registre : une fuite ne se
 * remarque pas toute seule, et il suffit d'un « juste celui-là, pour éviter un
 * déchiffrement » pour que le coffre cesse de servir.
 */
export const CHAMPS_INTERDITS_EN_CLAIR: readonly string[] = [
  'montant',
  'solde',
  'intitule',
  'libelle',
  'note',
  'texte',
  'contenu',
  'humeur',
  'anxiete',
  'moral',
  'energie',
  'stress',
  'motivation',
  'nom',
  'dose',
  'substance',
  'molecule',
  'motif',
  'categorie',
  'beneficiaire',
  'quantite',
  'valeur',
];

/**
 * Le catalogue du coffre se tient-il ?
 *
 * Trois choses : aucun champ de contenu en clair, un identifiant toujours en
 * clair — sans quoi on ne pourrait pas relire l'enregistrement —, et une
 * raison écrite pour chaque magasin.
 */
/**
 * Les magasins qui portent une donnée déclarée sensible **et restent en clair**.
 *
 * ## Pourquoi cette liste existe, et pourquoi elle est pénible
 *
 * Le contrat de faits marque onze types `sensible`. Cinq d'entre eux vivent
 * dans des magasins non scellés, et c'est **voulu** : la décision 3 a retenu
 * que le coffre ne verrouillerait pas le quotidien. Se peser, noter un repas
 * ou déclarer un rhume doit rester possible sans retaper un mot de passe,
 * sans quoi personne ne le fait — et un suivi qu'on ne tient pas ne protège
 * rien du tout.
 *
 * Mais un arbitrage qui ne vit nulle part n'est pas un arbitrage, c'est un
 * oubli qui a réussi. Sans cette liste, le jour où une branche ajoute un
 * magasin portant un type sensible, il entrerait en clair **exactement de la
 * même façon** que ces cinq-là — et rien ne distinguerait la décision du
 * défaut.
 *
 * D'où la forme : toute couverture manquante doit être **nommée ici avec sa
 * raison**, ou le contrôle échoue. C'est délibérément inconfortable. Écrire
 * une ligne de dispense oblige à formuler pourquoi, et formuler pourquoi est
 * le moment où l'on s'aperçoit qu'on n'a pas de raison.
 */
export interface SensibleEnClair {
  magasin: string;
  type: string;
  pourquoi: string;
}

export const SENSIBLES_EN_CLAIR: readonly SensibleEnClair[] = [
  {
    magasin: 'sportBlessures',
    type: 'sport.blessure',
    pourquoi:
      'Une blessure interdit des exercices : Sport doit pouvoir la lire pour ne pas proposer de progresser dessus, et il ne demande jamais le mot de passe.',
  },
  {
    magasin: 'odysseePesees',
    type: 'odyssee.poids',
    pourquoi:
      'Décision 3 : le coffre ne verrouille pas le quotidien. Une pesée se note en dix secondes au saut du lit, ou ne se note pas.',
  },
  {
    magasin: 'odysseeMesures',
    type: 'odyssee.mesure',
    pourquoi: 'Même geste que la pesée, même raison.',
  },
  {
    magasin: 'odysseeRepas',
    type: 'odyssee.repas',
    pourquoi:
      'Trois à cinq saisies par jour : c’est le magasin le plus écrit de Cyclades, et une demande de mot de passe à chaque repas le viderait.',
  },
  {
    magasin: 'odysseeUsage',
    type: 'odyssee.usage',
    pourquoi:
      'Un magasin scellé ne s’écrit que coffre ouvert, c’est-à-dire rarement. Sceller le journal d’usage n’enregistrerait que les sessions où l’on vient consulter sa psyché ou ses traitements : un échantillon biaisé par exactement ce qu’on cherche à mesurer, et vide le reste du temps. Le choix est donc des horodatages en clair, ou pas de domaine observé du tout — et sans domaine observé la veille s’éteint quand quelqu’un cesse de saisir. Ce qui en est dérivé, lui, est scellé (odysseeVeilleBases).',
  },
  {
    magasin: 'odysseeSante',
    type: 'odyssee.sante',
    pourquoi:
      'Un état de santé empêche l’effort, donc Sport et Odyssée le lisent pour s’abstenir de proposer. Le détail médical, lui, est dans les magasins scellés.',
  },
];

/**
 * Tout type sensible est-il scellé, ou nommément dispensé ?
 *
 * Prend le registre en paramètre plutôt que de l'importer : `coffre.ts`
 * n'importe rien, et c'est ce qui permet de l'éprouver sur un registre
 * fabriqué pour l'essai — notamment sur celui qui contient le magasin oublié
 * qu'on veut voir attraper.
 */
export function controlerCouvertureDesSensibles(
  magasins: readonly { magasin: string; type: string }[],
  typesSensibles: readonly string[],
): string[] {
  const problemes: string[] = [];
  const sensibles = new Set(typesSensibles);
  const dispenses = new Map(SENSIBLES_EN_CLAIR.map((d) => [d.magasin, d]));

  for (const m of magasins) {
    if (!sensibles.has(m.type)) continue;
    if (estScelle(m.magasin)) continue;
    const dispense = dispenses.get(m.magasin);
    if (!dispense) {
      problemes.push(
        `« ${m.magasin} » porte « ${m.type} », déclaré sensible, et n’est ni scellé ` +
          'ni inscrit dans SENSIBLES_EN_CLAIR. Scellez-le, ou dites pourquoi il reste en clair.',
      );
      continue;
    }
    if (dispense.type !== m.type) {
      problemes.push(
        `« ${m.magasin} » est dispensé pour « ${dispense.type} » mais porte « ${m.type} ».`,
      );
    }
    if (!dispense.pourquoi.trim()) {
      problemes.push(`« ${m.magasin} » est dispensé sans raison écrite.`);
    }
  }

  /*
     Une dispense devenue inutile est signalée elle aussi : un magasin scellé
     entre-temps qui garderait sa ligne de dispense laisserait croire, à la
     lecture, qu'il voyage en clair.
  */
  for (const d of SENSIBLES_EN_CLAIR) {
    if (estScelle(d.magasin)) {
      problemes.push(`« ${d.magasin} » est scellé : sa dispense n’a plus lieu d’être.`);
    }
  }
  return problemes;
}

/**
 * Tout magasin déclaré scellé existe-t-il vraiment ?
 *
 * Cette question avait une mauvaise réponse pendant une journée. La décision 3
 * avait inscrit `odysseeComptes`, `odysseeOperations` et `odysseePositions` au
 * catalogue par anticipation, alors que Finances n'était pas construite : trois
 * magasins scellés qui n'existaient pas, et `controlerCoffre()` passait au vert.
 *
 * Inoffensif en soi. Inquiétant par ce que cela dit du contrôle : il relisait
 * la forme des déclarations sans jamais vérifier qu'elles portaient sur
 * quelque chose. Le schéma étant impur, la liste entre par paramètre.
 */
export function controlerMagasinsExistants(existants: readonly string[]): string[] {
  const schema = new Set(existants);
  return MAGASINS_SCELLES.filter((m) => !schema.has(m.magasin)).map(
    (m) =>
      `« ${m.magasin} » est déclaré scellé mais n’existe pas au schéma : ` +
      'une déclaration sans magasin ne protège rien.',
  );
}

export function controlerCoffre(): string[] {
  const problemes: string[] = [];
  for (const m of MAGASINS_SCELLES) {
    if (!m.clairs.includes('id')) {
      problemes.push(`« ${m.magasin} » doit laisser « id » en clair : c’est sa clé.`);
    }
    if (!m.pourquoi.trim()) problemes.push(`« ${m.magasin} » ne dit pas pourquoi il est scellé.`);
    for (const champ of m.clairs) {
      if (CHAMPS_INTERDITS_EN_CLAIR.includes(champ)) {
        problemes.push(
          `« ${m.magasin} » laisse « ${champ} » en clair : c’est du contenu, pas un index.`,
        );
      }
    }
  }
  const vus = new Set<string>();
  for (const m of MAGASINS_SCELLES) {
    if (vus.has(m.magasin)) problemes.push(`« ${m.magasin} » est déclaré deux fois.`);
    vus.add(m.magasin);
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Sceller et ouvrir
   ══════════════════════════════════════════════════════════════════════════ */

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

const octetsVersBase64 = (octets: Uint8Array): string => {
  let binaire = '';
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire);
};

const base64VersOctets = (b64: string): Uint8Array => {
  const binaire = atob(b64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
};

/**
 * Sépare un enregistrement en sa partie claire et sa partie scellée.
 *
 * Tout ce qui n'est pas déclaré clair part dans le chiffré, **y compris les
 * champs qu'on ajouterait plus tard sans y penser**. C'est le sens de la
 * séparation : un champ nouveau est scellé par défaut, et il faut un geste
 * explicite pour l'exposer.
 */
export async function sceller(
  cle: CryptoKey,
  magasin: string,
  enregistrement: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const declare = PAR_MAGASIN.get(magasin);
  if (!declare) throw new Error(`« ${magasin} » n’est pas un magasin scellé.`);

  const clair: Record<string, unknown> = {};
  const secret: Record<string, unknown> = {};
  for (const [champ, valeur] of Object.entries(enregistrement)) {
    if (champ === 'scelle') continue;
    if (declare.clairs.includes(champ)) clair[champ] = valeur;
    else secret[champ] = valeur;
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    cle,
    encodeur.encode(JSON.stringify(secret)) as BufferSource,
  );
  return {
    ...clair,
    scelle: {
      v: VERSION_COFFRE,
      iv: octetsVersBase64(iv),
      ct: octetsVersBase64(new Uint8Array(chiffre)),
    } satisfies Scelle,
  };
}

/** Rouvre un enregistrement scellé. Lève si la clé ne convient pas. */
export async function ouvrir<T>(cle: CryptoKey, range: Record<string, unknown>): Promise<T> {
  const scelle = range.scelle as Scelle | undefined;
  if (!scelle) {
    // Pas scellé : un enregistrement écrit avant la migration, ou une erreur.
    return range as T;
  }
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64VersOctets(scelle.iv) as BufferSource },
    cle,
    base64VersOctets(scelle.ct) as BufferSource,
  );
  const secret = JSON.parse(decodeur.decode(clair)) as Record<string, unknown>;
  const { scelle: _, ...reste } = range;
  return { ...reste, ...secret } as T;
}

/** L'enregistrement est-il effectivement scellé ? Sert aux essais et aux contrôles. */
export const estFerme = (range: Record<string, unknown>): boolean =>
  typeof range.scelle === 'object' && range.scelle !== null;

/* ══════════════════════════════════════════════════════════════════════════
   La condition bloquante : le rappel de sauvegarde
   ══════════════════════════════════════════════════════════════════════════ */

/** Au-delà, le rappel passe de discret à insistant. */
export const JOURS_AVANT_INSISTANCE = 14;

export type Insistance = 'aucune' | 'discrete' | 'insistante' | 'urgente';

export interface RappelDeSauvegarde {
  insistance: Insistance;
  message: string;
}

/**
 * Le rappel de sauvegarde, plus fort dès qu'une donnée scellée existe.
 *
 * La décision 3 en fait une condition **bloquante** : « chiffrer sans
 * sauvegarder, c'est fabriquer une perte définitive ». Un journal de trois ans
 * perdu avec un mot de passe oublié ne se reconstruit pas, contrairement à un
 * cours, qui se régénère depuis le dépôt.
 *
 * Le rappel est donc gradué sur deux choses : depuis combien de temps on n'a
 * pas sauvegardé, et **s'il y a du scellé à perdre**. Sans scellé, le rappel
 * reste ce qu'il était.
 */
export function rappelDeSauvegarde(options: {
  joursDepuisLaSauvegarde: number | null;
  enregistrementsScelles: number;
}): RappelDeSauvegarde {
  const { joursDepuisLaSauvegarde: jours, enregistrementsScelles: scelles } = options;
  if (!scelles) {
    return jours === null || jours > JOURS_AVANT_INSISTANCE
      ? {
          insistance: 'discrete',
          message: 'Pensez à sauvegarder : le contenu des cours se régénère, votre progression non.',
        }
      : { insistance: 'aucune', message: '' };
  }

  if (jours === null) {
    return {
      insistance: 'urgente',
      message:
        `${scelles} enregistrement${scelles > 1 ? 's' : ''} chiffré${scelles > 1 ? 's' : ''} ` +
        'et **aucune sauvegarde**. Ces données ne se reconstruisent pas : un mot de passe oublié ' +
        'les perd définitivement. Sauvegardez avant d’en écrire davantage.',
    };
  }
  if (jours > JOURS_AVANT_INSISTANCE) {
    return {
      insistance: 'insistante',
      message:
        `Dernière sauvegarde il y a ${jours} jours, et ${scelles} enregistrement` +
        `${scelles > 1 ? 's' : ''} chiffré${scelles > 1 ? 's' : ''} depuis. Un journal ou des ` +
        'comptes perdus ne se reconstruisent pas depuis le dépôt, contrairement aux cours.',
    };
  }
  return {
    insistance: 'discrete',
    message: `Sauvegardé il y a ${jours} jour${jours > 1 ? 's' : ''}. Ces données sont chiffrées : la sauvegarde est la seule copie.`,
  };
}
