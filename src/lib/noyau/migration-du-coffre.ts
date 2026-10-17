/**
 * Rechiffrer le coffre sous une clé neuve, sans jamais pouvoir rien perdre.
 *
 * ## Pourquoi rechiffrer, et pourquoi on ne peut pas y couper
 *
 * La clé actuelle est dérivée du **mot de passe du site**, à 310 000
 * itérations, avec un sel rangé dans IndexedDB. Envelopper cette clé telle
 * quelle sous un mot de passe de coffre neuf aurait été sans risque — et sans
 * effet : qui tient la base de l'appareil et le mot de passe du site
 * recalculerait la clé directement et contournerait l'enveloppe. Pour que le
 * coffre cesse d'être ouvrable par le mot de passe du site, il faut une clé
 * que ce mot de passe ne produit pas. Donc rechiffrer.
 *
 * C'est la seule étape de tout ce chantier qui touche aux données, et Alexis
 * l'a assortie d'une condition : « après une sauvegarde confirmée et sans
 * perte de données ». Ce module tient la seconde moitié.
 *
 * ## L'invariant, et c'est le seul qui compte
 *
 * > À tout instant, chaque enregistrement est lisible sous **au moins une**
 * > clé connue, et le journal dit laquelle.
 *
 * Il tient parce qu'on n'écrase jamais : on écrit le nouveau scellé **à côté**
 * de l'ancien, sous `scelle2`. Tant que les deux sont là, l'enregistrement est
 * lisible des deux façons. L'ancien ne part qu'à la troisième passe, et
 * seulement après que la deuxième a relu le nouveau.
 *
 * Trois passes, donc, et aucune n'est facultative :
 *
 * 1. **Copier** — pour chaque enregistrement, ouvrir sous l'ancienne clé,
 *    resceller sous la neuve, écrire le résultat dans `scelle2`.
 * 2. **Relire** — rouvrir `scelle2` sous la nouvelle clé et comparer au
 *    contenu ouvert sous l'ancienne. Une seule différence arrête tout.
 * 3. **Échanger** — `scelle2` devient `scelle`, et l'ancien disparaît.
 *
 * Sauter la deuxième passe reviendrait à faire confiance à la première. Or la
 * première est précisément ce qu'on ne peut pas vérifier autrement : un
 * chiffrement qui échoue à moitié produit un scellé d'apparence normale.
 *
 * ## Une interruption ne laisse jamais un état à moitié
 *
 * La machine peut s'éteindre entre deux enregistrements. Le journal dit la
 * passe en cours et le magasin atteint ; la reprise recommence la passe depuis
 * son début. Recommencer coûte du temps et ne coûte que cela : réécrire un
 * `scelle2` par-dessus un `scelle2` est sans effet, et le relire deux fois
 * aussi. Les trois passes sont **idempotentes**, et c'est ce qui autorise à
 * reprendre bêtement plutôt qu'à deviner où l'on s'était arrêté.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne sauvegarde pas, et ne vérifie pas qu'une sauvegarde existe : c'est à
 * l'écran de l'exiger, parce que c'est là qu'on peut la montrer à la personne
 * et attendre qu'elle confirme l'avoir. Un module qui déciderait seul que la
 * sauvegarde est « suffisante » prendrait une responsabilité qu'Alexis s'est
 * réservée.
 */
import { MAGASINS_SCELLES, ouvrir, sceller, type Scelle } from './coffre';

/** La clé de journal, dans le magasin « etat ». */
export const CLEF_JOURNAL = 'coffre.migration';

export type Passe = 'copier' | 'relire' | 'echanger' | 'fini';

export interface JournalDeMigration {
  passe: Passe;
  /** Le magasin où la passe en cours s'est arrêtée, pour le compte rendu. */
  magasin?: string;
  /** Combien d'enregistrements la dernière passe complète a traités. */
  traites: number;
  /** Quand elle a commencé, pour que l'écran puisse le dire. */
  commenceeLe: string;
}

/**
 * Le peu de base dont ce module a besoin.
 *
 * Un port, et non `db()` : c'est ce qui rend les trois passes, et surtout la
 * reprise après interruption, éprouvables en Node. Une migration testée
 * seulement dans un navigateur est testée une fois, sur le cas qui marche.
 */
export interface RangementDesMagasins {
  lireTout(magasin: string): Promise<{ clef: IDBValidKey; valeur: Record<string, unknown> }[]>;
  ecrire(magasin: string, clef: IDBValidKey, valeur: Record<string, unknown>): Promise<void>;
  lireJournal(): Promise<JournalDeMigration | undefined>;
  ecrireJournal(journal: JournalDeMigration): Promise<void>;
}

/** Le compte rendu d'une migration, pour l'écran et pour le journal d'audit. */
export interface CompteRendu {
  magasins: number;
  enregistrements: number;
  /** Les magasins qui n'avaient rien à reprendre. Pas une anomalie. */
  vides: string[];
}

/**
 * Les magasins à reprendre, lus dans le **registre** et non recopiés.
 *
 * Recopier la liste ici en ferait une seconde à tenir à jour, et le jour où
 * elle divergerait, un magasin resterait en arrière sous l'ancienne clé sans
 * que rien ne le dise. Un magasin ajouté au registre demain sera repris sans
 * qu'on touche à ce fichier.
 */
export const magasinsAReprendre = (): string[] => MAGASINS_SCELLES.map((m) => m.magasin);

/**
 * Où en est un enregistrement, lu et non supposé.
 *
 * La reprise ne peut pas déduire l'état d'un enregistrement du journal : le
 * journal dit la passe, pas le détail, et une coupure tombe **entre** deux
 * écritures. Chaque enregistrement porte donc sa réponse, et on la lit en
 * essayant de l'ouvrir.
 *
 * Deux états ont coûté cher avant d'être nommés, et l'essai des trente
 * coupures les a trouvés tous les deux :
 *
 * - `copie-faite` — un `scelle2` existe déjà. Le rescelle ne doit pas repartir
 *   de l'enregistrement brut : `sceller` n'ignore que `scelle`, donc il
 *   enfermait `scelle2` dans le nouveau chiffré, et la relecture signalait un
 *   écart sur chaque enregistrement repris.
 * - `deja-migre` — la passe d'échange est passée par là : `scelle` porte
 *   désormais la clé neuve. L'ouvrir sous l'ancienne ne donne pas un écart,
 *   cela **lève**. Une reprise qui l'ignorerait s'arrêterait sur une base
 *   pourtant saine.
 */
export type EtatDUnEnregistrement = 'a-reprendre' | 'copie-faite' | 'deja-migre' | 'sans-scelle';

const ouvrable = async (cle: CryptoKey, valeur: Record<string, unknown>, champ: string) => {
  if (!valeur[champ]) return false;
  try {
    await ouvrir<Record<string, unknown>>(cle, { ...clairsSeuls(valeur), scelle: valeur[champ] });
    return true;
  } catch {
    return false;
  }
};

async function etatDe(
  valeur: Record<string, unknown>,
  ancienne: CryptoKey,
  neuve: CryptoKey,
): Promise<EtatDUnEnregistrement> {
  if (!valeur.scelle) return 'sans-scelle';
  if (await ouvrable(ancienne, valeur, 'scelle')) {
    return valeur.scelle2 ? 'copie-faite' : 'a-reprendre';
  }
  if (await ouvrable(neuve, valeur, 'scelle')) return 'deja-migre';
  /*
     Ni l'une ni l'autre : on ne touche à rien et on laisse la relecture le
     dire. Deviner ici reviendrait à décider du sort d'un enregistrement qu'on
     ne sait pas lire.
  */
  return 'a-reprendre';
}

/** Les champs clairs d'un enregistrement, sans aucun scellé. */
const clairsSeuls = (valeur: Record<string, unknown>): Record<string, unknown> => {
  const { scelle: _s, scelle2: _s2, ...reste } = valeur;
  return reste;
};

/**
 * Passe 1 — copier : resceller chaque enregistrement sous la clé neuve, à côté.
 *
 * Rien n'est effacé, rien n'est remplacé. Un enregistrement déjà pourvu de son
 * `scelle2` est repris quand même : c'est ce qui rend la passe idempotente, et
 * donc reprenable sans savoir où elle s'était arrêtée.
 */
async function copier(
  rangement: RangementDesMagasins,
  ancienne: CryptoKey,
  neuve: CryptoKey,
): Promise<number> {
  let faits = 0;
  for (const magasin of magasinsAReprendre()) {
    for (const { clef, valeur } of await rangement.lireTout(magasin)) {
      const etat = await etatDe(valeur, ancienne, neuve);
      // Sans scellé : écrit avant que le magasin le soit. Déjà migré : la
      // passe d'échange est passée. Dans les deux cas, rien à faire.
      if (etat === 'sans-scelle' || etat === 'deja-migre') continue;
      /*
         On repart des champs **clairs** et du seul `scelle`, jamais de
         l'enregistrement brut : `sceller` n'ignore que `scelle`, et repartir
         du brut enfermerait un `scelle2` d'une tentative précédente dans le
         nouveau chiffré.
      */
      const contenu = await ouvrir<Record<string, unknown>>(ancienne, {
        ...clairsSeuls(valeur),
        scelle: valeur.scelle,
      });
      const refait = await sceller(neuve, magasin, contenu);
      await rangement.ecrire(magasin, clef, {
        ...valeur,
        scelle2: refait.scelle as Scelle,
      });
      faits += 1;
    }
    await rangement.ecrireJournal({
      passe: 'copier',
      magasin,
      traites: faits,
      commenceeLe: (await rangement.lireJournal())?.commenceeLe ?? new Date().toISOString(),
    });
  }
  return faits;
}

/**
 * Passe 2 — relire : la nouvelle copie dit-elle exactement la même chose ?
 *
 * On compare les deux contenus ouverts, et non les deux chiffrés : deux
 * chiffrés d'un même texte diffèrent toujours, puisque le vecteur
 * d'initialisation est tiré au sort. Comparer les chiffrés n'aurait rien
 * prouvé, et aurait toujours échoué.
 *
 * Une seule différence arrête la migration, et c'est voulu : à ce stade
 * l'ancien scellé est encore là, donc s'arrêter ne coûte rien, tandis que
 * poursuivre effacerait l'original sur la foi d'une copie douteuse.
 */
async function relire(
  rangement: RangementDesMagasins,
  ancienne: CryptoKey,
  neuve: CryptoKey,
): Promise<string[]> {
  const ecarts: string[] = [];
  for (const magasin of magasinsAReprendre()) {
    for (const { clef, valeur } of await rangement.lireTout(magasin)) {
      const etat = await etatDe(valeur, ancienne, neuve);
      if (etat === 'sans-scelle') continue;
      /*
         Déjà migré : l'échange est fait pour celui-ci, il n'y a plus de copie
         à relire et son absence n'est pas un écart. Le signaler arrêterait une
         reprise sur une base pourtant saine — défaut trouvé par l'essai des
         trente coupures.
      */
      if (etat === 'deja-migre') continue;
      if (!valeur.scelle2) {
        ecarts.push(`${magasin}/${String(clef)} : la copie manque`);
        continue;
      }
      /*
         Les deux côtés se construisent de la même façon, et c'est nécessaire :
         `ouvrir` rend tous les champs sauf `scelle`, donc il **garde
         `scelle2`**. Comparer son résultat brut à une ouverture faite depuis
         les seuls champs clairs signalait un écart sur chaque enregistrement.
         L'essai l'a vu avant qu'une ligne touche une vraie base.
      */
      const attendu = await ouvrir<Record<string, unknown>>(ancienne, {
        ...clairsSeuls(valeur),
        scelle: valeur.scelle,
      });
      let obtenu: Record<string, unknown>;
      try {
        obtenu = await ouvrir<Record<string, unknown>>(neuve, {
          ...clairsSeuls(valeur),
          scelle: valeur.scelle2,
        });
      } catch {
        ecarts.push(`${magasin}/${String(clef)} : la copie ne s’ouvre pas sous la clé neuve`);
        continue;
      }
      /*
         `JSON.stringify` sur les clés triées : l'ordre des champs d'un objet
         n'est pas une information, et le scellé le refait à sa guise. Comparer
         sans trier aurait signalé des écarts qui n'en sont pas.
      */
      const normaliser = (o: Record<string, unknown>) =>
        JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
      if (normaliser(attendu) !== normaliser(obtenu)) {
        ecarts.push(`${magasin}/${String(clef)} : la copie dit autre chose`);
      }
    }
    await rangement.ecrireJournal({
      passe: 'relire',
      magasin,
      traites: 0,
      commenceeLe: (await rangement.lireJournal())?.commenceeLe ?? new Date().toISOString(),
    });
  }
  return ecarts;
}

/**
 * Passe 3 — échanger : la copie prend la place de l'original.
 *
 * C'est la seule passe destructrice, et elle ne s'exécute qu'après que la
 * deuxième a relu **tout**. Un enregistrement sans `scelle2` est laissé tel
 * quel plutôt que vidé : s'il en manquait un, la passe 2 aurait déjà arrêté,
 * donc on n'en est pas là — et si on y était, ne rien faire est le seul geste
 * qui ne perde rien.
 */
async function echanger(rangement: RangementDesMagasins): Promise<number> {
  let faits = 0;
  for (const magasin of magasinsAReprendre()) {
    for (const { clef, valeur } of await rangement.lireTout(magasin)) {
      if (!valeur.scelle2) continue;
      const { scelle2, ...reste } = valeur;
      await rangement.ecrire(magasin, clef, { ...reste, scelle: scelle2 });
      faits += 1;
    }
    await rangement.ecrireJournal({
      passe: 'echanger',
      magasin,
      traites: faits,
      commenceeLe: (await rangement.lireJournal())?.commenceeLe ?? new Date().toISOString(),
    });
  }
  return faits;
}

/**
 * Reprend le coffre sous la clé neuve. Reprenable autant de fois qu'il faut.
 *
 * Lève si la relecture trouve le moindre écart — et lève **avant** d'avoir
 * effacé quoi que ce soit, ce qui est tout l'intérêt de l'ordre des passes.
 */
export async function reprendreLeChiffrementDuCoffre(
  rangement: RangementDesMagasins,
  ancienne: CryptoKey,
  neuve: CryptoKey,
): Promise<CompteRendu> {
  const debut = (await rangement.lireJournal())?.commenceeLe ?? new Date().toISOString();
  await rangement.ecrireJournal({ passe: 'copier', traites: 0, commenceeLe: debut });

  const copies = await copier(rangement, ancienne, neuve);

  const ecarts = await relire(rangement, ancienne, neuve);
  if (ecarts.length > 0) {
    throw new Error(
      `La relecture a trouvé ${ecarts.length} écart(s) ; rien n’a été effacé. ` +
        `Premier : ${ecarts[0]}`,
    );
  }

  await echanger(rangement);
  await rangement.ecrireJournal({ passe: 'fini', traites: copies, commenceeLe: debut });

  const vides: string[] = [];
  for (const magasin of magasinsAReprendre()) {
    if ((await rangement.lireTout(magasin)).length === 0) vides.push(magasin);
  }
  return { magasins: magasinsAReprendre().length, enregistrements: copies, vides };
}
