/**
 * Le suivi personnel : ce qui le protège, écrit avant qu'il ait une donnée.
 *
 * ## Pourquoi la confidentialité vient en premier, et pas en dernier
 *
 * Le § 1 n° 3 du prompt 32 a déjà imposé ce geste une fois, pour le filtre
 * du centre de notifications : « testé dès la phase 1, même si le module de
 * cycle n'est pas construit ». La raison y est écrite et vaut ici
 * entièrement — **une protection posée après coup est une protection
 * trouée**. Quand le journal existera et qu'on cherchera où le brancher,
 * chaque porte oubliée sera une fuite qu'aucun essai ne cherchait.
 *
 * Ce module est donc écrit alors qu'aucune saisie n'existe. Il déclare les
 * magasins, la forme de leurs clés, et les quatre portes par lesquelles une
 * donnée pourrait sortir. Le lot suivant remplit les formes ; il n'aura
 * aucune porte à ouvrir.
 *
 * ## Quatre portes, et chacune a un gardien nommé
 *
 * Une donnée de cycle peut quitter l'appareil par quatre chemins, et un
 * seul oubli suffit :
 *
 * 1. **l'export pour IA** (`export-ia.ts`) — un catalogue de catégories
 *    cochables. Le cycle n'y a **aucune catégorie**, et c'est différent
 *    d'une catégorie sensible décochée : une case qu'on peut cocher est une
 *    case qu'on cochera ;
 * 2. **l'export d'agenda** (`echeances-ics.ts`, `rappels-ics.ts`) — un
 *    fichier `.ics` part chez un calendrier tiers, souvent synchronisé avec
 *    un serveur. Rien du cycle n'y entre, sous aucun titre, même neutre ;
 * 3. **la sauvegarde** — elle emporte le cycle, et c'est **voulu** : une
 *    sauvegarde qui l'oublierait rendrait, à la restauration, une base
 *    amputée en annonçant une restauration complète. Le fichier est
 *    chiffré, et le magasin est scellé à l'intérieur ;
 * 4. **la synchronisation entre appareils** — décision 18, non synchronisé
 *    par défaut tant que les garanties ne sont pas démontrées. Ici la
 *    protection est **structurelle et non déclarative** : le paquet de
 *    synchronisation ne transporte que le journal d'opérations et les
 *    révisions, et le cycle n'écrit dans ni l'un ni l'autre. Il faudrait
 *    l'ajouter nommément à `magasinsEnPlus` pour qu'il parte.
 *
 * L'interrupteur de synchronisation du cycle n'est pas construit ici : il
 * appartient au lot B-6 du constructeur. La part de ce module est de garder
 * les magasins **à part** et **déclarés**, pour qu'il n'y ait rien à
 * deviner le jour où il les branchera.
 *
 * ## Pourquoi les clés sont opaques, et pourquoi il n'y a aucun index
 *
 * Un magasin scellé chiffre ses **valeurs**. Ses **clés** restent lisibles,
 * et c'est par là qu'on perd tout : une liste de clés `2026-10-01`,
 * `2026-10-02`, `2026-10-28` dit les jours de saignement sans qu'on ait
 * besoin d'ouvrir une seule valeur. Un rythme se lit sans rien comprendre
 * d'autre.
 *
 * La clé est donc l'empreinte du jour, et **aucun index n'est posé** — un
 * index sur `jour` réécrirait en clair exactement ce que la clé cache. Le
 * prix est connu et assumé : une lecture par jour voulu, et non un
 * parcours de plage. Trente et une lectures pour un mois, ce qui est le
 * coût d'une page.
 *
 * C'est le même geste que `odysseeExceptionsScellees` au prompt 38 et que
 * `odysseeCreneaux` au 52, pour la même raison.
 */
import { populationNonLue } from '../noyau/population';

/* ══════════════════════════════════════════════════════════════════════════
   Les magasins, et ce qu'ils laissent voir
   ══════════════════════════════════════════════════════════════════════════ */

export interface MagasinDuCycle {
  /** Le nom du magasin, tel que `db.ts` le crée. */
  magasin: string;
  /** Ce qu'il porte, en une phrase. */
  porte: string;
  /** Les champs qui restent en clair dans le scellé. */
  clairs: readonly string[];
  /** La clé est-elle une empreinte, plutôt que la donnée elle-même ? */
  cleOpaque: boolean;
}

/**
 * Les deux magasins du suivi, et il n'y en aura pas d'autres sans décision.
 *
 * Deux plutôt qu'un, et la séparation porte une règle : les **réglages**
 * (le suivi est-il actif ?) doivent pouvoir être lus pour décider ce qu'un
 * écran propose, alors que le **journal** ne doit être ouvert que par
 * l'écran du suivi. Les mélanger obligerait à ouvrir le journal pour savoir
 * si le module est actif.
 *
 * Et la conséquence est visible : `odysseeCycleReglages` porte une clé fixe
 * — il n'y a qu'un enregistrement — tandis que `odysseeCycleJournal` porte
 * une empreinte par jour.
 */
export const MAGASINS_DU_CYCLE: readonly MagasinDuCycle[] = [
  {
    magasin: 'odysseeCycleJournal',
    porte: 'Une saisie par jour : saignements, ressentis déclarés, note libre.',
    /*
       `majLe` seul. Pas de `jour` : ce serait réécrire en clair ce que la
       clé opaque cache, et le magasin ne protégerait plus rien.
    */
    clairs: ['id', 'majLe'],
    cleOpaque: true,
  },
  {
    magasin: 'odysseeCycleReglages',
    porte: 'Le suivi est-il actif, et sous quel libellé l’écran le nomme.',
    clairs: ['id', 'majLe'],
    cleOpaque: false,
  },
];

export const NOMS_DES_MAGASINS_DU_CYCLE: readonly string[] = MAGASINS_DU_CYCLE.map(
  (m) => m.magasin,
);

/* ══════════════════════════════════════════════════════════════════════════
   La clé opaque
   ══════════════════════════════════════════════════════════════════════════ */

const encodeurDeCycle = new TextEncoder();

/**
 * L'empreinte d'un jour du journal. Seize octets, soit trente-deux signes.
 *
 * Même longueur et même raison qu'au centre et qu'aux créneaux : une
 * collision demanderait 2^64 jours pour une chance sur deux.
 *
 * Le sel est fixe et public, et ce n'est pas une faiblesse : il ne sert pas
 * à résister à une recherche exhaustive — trente mille jours se parcourent
 * en une seconde — mais à **séparer les espaces de clés**. Sans lui,
 * l'empreinte du 1er octobre serait la même ici et ailleurs, et comparer
 * deux magasins dirait qu'ils parlent du même jour.
 *
 * Ce que la clé opaque protège est donc précis, et il faut le dire plutôt
 * que de le laisser croire plus grand : elle empêche de **lire un rythme
 * dans la liste des clés**. Elle n'empêche pas quelqu'un qui a la base de
 * tester si un jour donné porte une saisie.
 */
export async function cleDuJourDeCycle(jour: string): Promise<string> {
  const brut = await crypto.subtle.digest(
    'SHA-256',
    encodeurDeCycle.encode(`suivi-personnel\u0000${jour}`),
  );
  return Array.from(new Uint8Array(brut).slice(0, 16))
    .map((octet) => octet.toString(16).padStart(2, '0'))
    .join('');
}

/* ══════════════════════════════════════════════════════════════════════════
   Les portes, nommées pour qu'on ne puisse pas en oublier une
   ══════════════════════════════════════════════════════════════════════════ */

export interface PorteGardee {
  /** Par où une donnée pourrait sortir. */
  nom: string;
  /** Le module qui la garde. */
  gardien: string;
  /** Ce que le cycle y subit. */
  regime: 'exclu' | 'admis-et-chiffre';
  /** Pourquoi, en une phrase relisible. */
  pourquoi: string;
}

export const PORTES_GARDEES: readonly PorteGardee[] = [
  {
    nom: 'Export pour une IA',
    gardien: 'src/lib/odyssee/export-ia.ts',
    regime: 'exclu',
    pourquoi:
      'Aucune catégorie du cycle n’existe dans le catalogue. Une catégorie sensible décochée resterait cochable, et une case cochable finit cochée.',
  },
  {
    nom: 'Export d’agenda (.ics)',
    gardien: 'src/lib/odyssee/echeances-ics.ts',
    regime: 'exclu',
    pourquoi:
      'Un fichier d’agenda part chez un service tiers, souvent synchronisé. Aucun titre, même neutre, n’en vaut le risque.',
  },
  {
    nom: 'Sauvegarde locale',
    gardien: 'src/lib/db.ts',
    regime: 'admis-et-chiffre',
    pourquoi:
      'Une sauvegarde qui oublierait le suivi rendrait une base amputée en annonçant une restauration complète. Le fichier est chiffré, et le magasin reste scellé à l’intérieur.',
  },
  {
    nom: 'Synchronisation entre appareils',
    gardien: 'src/lib/sync/service.ts',
    regime: 'exclu',
    pourquoi:
      'Décision 18 : non synchronisé par défaut. Le paquet ne transporte que le journal d’opérations et les révisions ; le cycle n’écrit dans ni l’un ni l’autre.',
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   Ce que le suivi ne saura jamais faire
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La décision 12, écrite dans le code plutôt que dans un document.
 *
 * Elle est déclarée ici, sur le module de confidentialité, parce que c'en
 * est une : une fenêtre fertile affichée est une donnée qui sort de
 * l'appareil par les yeux de qui regarde l'écran, et elle ne se rattrape
 * pas.
 *
 * `populationNonLue` sert de témoin : si quelqu'un voulait un jour fonder
 * un de ces calculs, il lui faudrait une source et une population, et la
 * phase 2 l'obligerait à les déclarer. Il n'y a donc pas de chemin discret.
 */
export const JAMAIS_CALCULE: readonly string[] = [
  'fenêtre fertile',
  'ovulation prédite',
  'conseil de contraception',
  'jours sûrs',
];

export const RAISON_DE_NE_JAMAIS_CALCULER = populationNonLue(
  'la décision 12 du plan de phase 0 est non levable : Cyclades n’est pas une méthode ' +
    'contraceptive et n’est pas un dispositif médical.',
);

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les invariants de forme, vérifiés plutôt que promis.
 *
 * Ce contrôle ne regarde que ce module. Les quatre portes sont mesurées
 * ailleurs, par `essais:cycle-confidentialite`, qui lit le code des
 * gardiens plutôt que leur description — une porte qui se décrit fermée
 * n'est pas une porte fermée.
 */
export function controlerLaConfidentialiteDuCycle(): string[] {
  const problemes: string[] = [];

  for (const m of MAGASINS_DU_CYCLE) {
    if (!m.magasin.startsWith('odysseeCycle')) {
      problemes.push(
        `« ${m.magasin} » ne porte pas le préfixe « odysseeCycle ». Le préfixe est ce qui ` +
          'permet de reconnaître un magasin du suivi sans tenir une seconde liste.',
      );
    }
    if (!m.porte.trim()) problemes.push(`« ${m.magasin} » ne dit pas ce qu’il porte.`);
    /*
       UN CHAMP DE DATE EN CLAIR DANS UN MAGASIN À CLÉ OPAQUE ANNULE LA CLÉ.
       C'est le défaut le plus facile à introduire et le plus discret : on
       ajoute `jour` aux champs clairs pour pouvoir trier, et le rythme
       redevient lisible sans ouvrir une valeur.
    */
    if (m.cleOpaque && m.clairs.some((c) => /jour|date|debut|fin|semaine/i.test(c))) {
      problemes.push(
        `« ${m.magasin} » laisse une date en clair alors que sa clé est une empreinte. ` +
          'La clé ne cacherait plus rien.',
      );
    }
  }

  const vus = new Set<string>();
  for (const m of MAGASINS_DU_CYCLE) {
    if (vus.has(m.magasin)) problemes.push(`« ${m.magasin} » est déclaré deux fois.`);
    vus.add(m.magasin);
  }

  for (const p of PORTES_GARDEES) {
    if (!p.pourquoi.trim()) problemes.push(`La porte « ${p.nom} » ne dit pas pourquoi.`);
    if (!p.gardien.startsWith('src/')) {
      problemes.push(`La porte « ${p.nom} » ne nomme pas un fichier du dépôt.`);
    }
  }

  return problemes;
}
