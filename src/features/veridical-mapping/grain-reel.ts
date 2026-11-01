/**
 * LE GRAIN D'UNE DIMENSION, MESURÉ SUR SON RENDU ET NON DÉDUIT D'UN COMPTE.
 *
 * Prompt 63. Ce fichier se branche sur le noyau de l'agent B
 * (`dimensions-l5.ts`), qui tient la bonne règle — un seuil ne peut pas être
 * plus fin que ce que le stimulus montre — et qui la tire d'une déclaration :
 * `niveaux`, puis `grain = 1 / (niveaux - 1)`. Deux mesures disent que la
 * déclaration ne suffit pas, et c'est tout l'objet de ce fichier.
 *
 * ## PREMIÈRE MESURE : UNE DIMENSION CIRCULAIRE N'A PAS CE GRAIN-LÀ
 *
 * `STEP(n, circulaire)` de la référence rend `round(z*n) % n` quand la
 * dimension reboucle, et `round(z*(n-1))` sinon. Les deux rendent n niveaux,
 * mais pas avec le même pas :
 *
 * | | niveaux atteints | grain |
 * |---|---|---|
 * | circulaire | n | **1/n** |
 * | non circulaire | n | **1/(n−1)** |
 *
 * Sur une circulaire à sept niveaux — `note_name`, `weekday` —, `1/(n-1)`
 * annonce 16,7 % là où le rendu montre 14,3 % : **17 % de trop**. La direction
 * est prudente, l'écart ENREGISTRÉ est faux, et c'est l'écart enregistré qui
 * devient le seuil d'une personne. Vingt-quatre des cent vingt-trois
 * dimensions de la fiche de référence sont circulaires.
 *
 * ## SECONDE MESURE : SUR UNE ÉCHELLE LOGARITHMIQUE, LE GRAIN N'EST PAS UN
 *
 * Un grain unique suppose une grille régulière. Trente-six dimensions de la
 * fiche sont sur échelle logarithmique, et leur grain VARIE avec la position :
 * il est le plus grossier en bas de la plage. Mesuré sur la fiche :
 *
 * | dimension | niveaux | `1/(n−1)` annoncerait | pire grain réel |
 * |---|---|---|---|
 * | `audition.event_count` | 15 | 7,1 % | **24 %** |
 * | `vision.numerosity` | 49 | 2,1 % | **9,7 %** |
 *
 * Le second cas est le grave, et il défait la garde qu'il devrait déclencher :
 * `ecartMontre` rendrait 0,021 — non nul, donc rassurant — là où rien
 * au-dessous de 0,097 ne change quoi que ce soit en bas de la plage. **Deux
 * stimulus identiques passeraient à travers la garde écrite pour les
 * empêcher**, et l'escalier enregistrerait un seuil de 2 % qui est un tirage
 * au sort. Aucune déclaration d'un nombre de niveaux ne peut dire cela : ce
 * n'est pas une propriété du compte, c'est une propriété de la fonction.
 *
 * ## CE QU'ON FAIT À LA PLACE
 *
 * On lit le grain sur `valeur(pas)` — la fonction même que le stimulus
 * appelle. On parcourt la grille des 1 001 pas, on relève les pas où la valeur
 * CHANGE, et le pire grain est le plus grand intervalle entre deux changements.
 * Cela donne d'un coup le cas circulaire, le cas logarithmique, et tout cas à
 * venir qu'on n'a pas prévu, sans qu'une dimension ait rien à déclarer.
 *
 * **Et ce n'est pas une garde qui se mesure à elle-même.** Elle lit `valeur`,
 * puis l'essai demande au chemin RÉEL d'un essai — `ecartEnPasDuZ`, `borner`,
 * `stimulus` — si deux candidats diffèrent au plancher ainsi calculé. Si ce
 * parcours se trompait d'un cran, l'assertion rougirait : elle ne refait pas
 * le parcours, elle en éprouve la conséquence.
 *
 * ## CE QUE LA MESURE DIT DU REGISTRE VIVANT, ET C'EST UNE BONNE NOUVELLE
 *
 * **Les sept dimensions vivantes sont toutes continues** : 1 001 valeurs
 * distinctes sur 1 001 pas, pire grain 0,001 — vingt fois plus fin que le
 * plancher global de 0,02. Mesuré, dimension par dimension. Aucun seuil déjà
 * enregistré n'est donc remis en cause par le plancher par dimension, et la
 * machinerie de ce fichier ne change aujourd'hui aucun chiffre affiché. Elle
 * attend les trente-deux dimensions discrètes de la fiche de référence, dont
 * aucune n'est encore dans le code.
 */
import { PAS, dimensionParId, zDuPas, type Dimension } from './dimensions';
import { PLANCHER_MESURABLE, REGLAGES } from './escalier';

/** Ce qu'une dimension montre réellement, mesuré sur sa grille. */
export interface GrainMesure {
  /** Nombre de valeurs distinctes rendues sur les 1 001 pas. */
  niveaux: number;
  /** Le plus grand intervalle, en z, entre deux changements de valeur. */
  pire: number;
  /** Le pas où cet intervalle commence — pour pouvoir aller y regarder. */
  auPas: number;
  /** Faux quand chaque pas rend une valeur neuve : la dimension est continue. */
  discrete: boolean;
}

const MEMOIRE = new Map<string, GrainMesure>();

/**
 * LE GRAIN RÉEL D'UNE DIMENSION, PAR PARCOURS DE SA GRILLE.
 *
 * Mémoïsé par identifiant : le parcours coûte 1 001 appels, et il est demandé
 * à chaque essai. La mémoire est volontairement sans invalidation — une
 * dimension est une constante de module, et un registre qui changerait en
 * cours de session serait un défaut bien plus grand que ce cache.
 */
export function grainMesure(dimension: Dimension): GrainMesure {
  const dejaVu = MEMOIRE.get(dimension.id);
  if (dejaVu) return dejaVu;

  const distinctes = new Set<number>();
  const changements: number[] = [];
  let precedente: number | null = null;
  for (let pas = 0; pas < PAS; pas += 1) {
    const v = dimension.valeur(pas);
    if (!Number.isFinite(v)) {
      throw new Error(
        `La dimension « ${dimension.id} » rend ${v} au pas ${pas}. ` +
          'Une valeur non finie ne se compare pas, et le grain mesuré sur elle ' +
          'serait un nombre sans objet — on refuse plutôt que de rendre un plancher.',
      );
    }
    distinctes.add(v);
    if (precedente === null || v !== precedente) {
      changements.push(pas);
      precedente = v;
    }
  }

  /*
     Une dimension qui ne change JAMAIS de valeur ne se mesure pas du tout :
     aucun écart n'y est présentable. On refuse, au lieu de rendre un pire
     grain de zéro — qui serait lu comme « plus fine que la grille ».
  */
  if (changements.length < 2) {
    throw new Error(
      `La dimension « ${dimension.id} » rend la même valeur sur les ${PAS} pas. ` +
        'Rien n’y est discriminable : il n’y a pas de seuil à mesurer, et un ' +
        'grain de zéro se lirait comme une finesse parfaite.',
    );
  }

  /*
     LE PALIER QUI ENJAMBE LE PAS ZÉRO, et la mesure qui le coupait en deux.

     Sur une dimension CIRCULAIRE, la valeur du pas 1 000 et celle du pas 0
     peuvent être la même : le palier est alors un seul, étalé de part et
     d'autre de la couture. Mesuré en deux morceaux, il paraît deux fois plus
     fin qu'il n'est — et le plancher qui en sort laisse passer des stimulus
     identiques.

     **Ce n'est pas une crainte, c'est une mesure.** Sur sept niveaux
     circulaires, les deux morceaux font 71 et 72 pas ; le palier vrai en fait
     143. Avec le plancher tiré de 72 pas, l'écart demandé au pas 71 revenait,
     par rebouclage, sur le même niveau : deux candidats identiques, dont l'un
     était marqué juste et l'autre faux. L'assertion « deux stimulus au
     plancher doivent différer » l'a dit en nommant le pas 71, alors que toute
     l'arithmétique de ce fichier était verte.

     On referme donc le cercle : le dernier palier et le premier n'en font
     qu'un quand ils portent la même valeur.
  */
  const cycle = [...changements];
  if (dimension.circulaire && dimension.valeur(PAS - 1) === dimension.valeur(0)) {
    /*
       On ajoute la FIN du premier palier, et non son début.

       Le palier fusionné va du dernier changement jusqu'à l'endroit où le
       premier palier s'achève — soit `changements[1]`, un tour plus loin.
       Ajouter `changements[0]`, qui vaut toujours zéro, rendait l'intervalle du
       dernier palier SEUL : la correction paraissait faite et ne changeait
       rien. Mesuré sur sept niveaux circulaires : 72 pas au lieu de 144, et
       l'assertion du pas 71 restait rouge — c'est elle qui a dit que le
       correctif ne corrigeait pas.
    */
    cycle.push(PAS + changements[1]);
  }

  let pire = 0;
  let auPas = cycle[0];
  for (let i = 1; i < cycle.length; i += 1) {
    const intervalle = zDuPas(cycle[i] - cycle[i - 1]);
    if (intervalle > pire) {
      pire = intervalle;
      auPas = cycle[i - 1];
    }
  }

  const mesure: GrainMesure = {
    niveaux: distinctes.size,
    pire,
    auPas,
    discrete: distinctes.size < PAS,
  };
  MEMOIRE.set(dimension.id, mesure);
  return mesure;
}

/**
 * LE PLANCHER RÉEL D'UNE DIMENSION : le plus grossier des deux obstacles.
 *
 * `plancherDe` de B prend le même maximum, sur un grain déclaré ; celui-ci le
 * prend sur un grain mesuré. Le sens du maximum est celui que B a écrit, et il
 * est le tout : un seuil n'est ni plus fin que ce que la procédure encadre, ni
 * plus fin que ce que le stimulus montre.
 *
 * ## LE TERME DE PROCÉDURE EST `deltaMinimum`, ET NON `PLANCHER_MESURABLE`
 *
 * C'est la formulation retenue par le pilote — `max(deltaMinimum, grain)` — et
 * deux conséquences mesurées la confirment. Prendre `PLANCHER_MESURABLE`
 * (0,04) comme plancher de l'ESCALIER tuerait deux gardes en silence :
 *
 * - `DEPART_MINIMUM` vaut 0,03. Tout départ y serait relevé à 0,04, et la
 *   borne basse du départ deviendrait du code mort.
 * - le tableau de bord avertit qu'un seuil sous `PLANCHER_MESURABLE` n'a pas
 *   été encadré. Un seuil est la moyenne géométrique de rebroussements ; si
 *   aucun écart ne descend sous 0,04, aucun seuil ne peut y descendre, et
 *   l'avertissement ne pourrait plus jamais se déclencher.
 *
 * Les deux rôles sont donc distincts et le restent : `deltaMinimum` est la
 * borne basse du MOUVEMENT, `PLANCHER_MESURABLE` le seuil de CONFIANCE
 * au-dessous duquel le chiffre obtenu est signalé comme non encadré. Les
 * confondre supprime l'avertissement au lieu de l'honorer.
 *
 * `plancherDe` de B prend `PLANCHER_MESURABLE` pour ce terme. Sa fonction ne
 * commande pas l'escalier — elle porte sur des dimensions DÉCLARÉES, qui
 * n'existent pas encore dans le code — et son essai l'assied. La divergence
 * est donc remontée au pilote plutôt que tranchée ici : écraser l'assertion
 * mesurée d'un pair sur une décision qui ne m'appartient pas serait pire que
 * deux fonctions dont l'écart est écrit.
 *
 * **Conséquence sur le registre vivant : aucune.** Les sept dimensions sont
 * continues, leur pire grain vaut 0,001, et `max(0,02 ; 0,001)` rend 0,02 —
 * exactement la borne d'avant ce lot. Rien de ce qui est affiché ne change.
 */
export function plancherReel(dimension: Dimension): number {
  return Math.max(REGLAGES.deltaMinimum, grainMesure(dimension).pire);
}

/**
 * LA PHRASE À MONTRER QUAND L'ESCALIER EST ARRIVÉ AU PLUS FIN DE LA DIMENSION.
 *
 * Demandée par le pilote. Elle ne dit pas « seuil atteint » : sur une dimension
 * discrète, l'escalier peut buter sur le grain AVANT d'avoir trouvé le seuil de
 * la personne, et les deux ne sont pas la même chose. Dire « vous ne faites pas
 * mieux » là où il faut dire « cette dimension ne montre pas plus fin »
 * attribuerait à la personne une limite de l'appareil.
 */
export function phraseDuPlusFin(dimension: Dimension): string {
  const mesure = grainMesure(dimension);
  const pct = (x: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 }).format(x);
  if (!mesure.discrete) {
    return (
      `Vous êtes au plus fin que cette mesure sache encadrer, ${pct(PLANCHER_MESURABLE)}. ` +
      'En dessous, un écart ne peut plus être présenté de part et d’autre de votre ' +
      'seuil : le chiffre obtenu serait celui de la procédure, pas le vôtre.'
    );
  }
  return (
    `Vous êtes au plus fin que « ${dimension.nom} » sache montrer : ${pct(mesure.pire)}. ` +
    `Cette dimension ne prend que ${mesure.niveaux} valeurs distinctes, et deux ` +
    'stimulus plus proches que cela seraient identiques. La limite est celle de la ' +
    'dimension, pas la vôtre.'
  );
}

/**
 * LE DÉSACCORD ENTRE UN NOMBRE DE NIVEAUX DÉCLARÉ ET CE QUE LE RENDU MONTRE.
 *
 * Rend `null` quand les deux concordent, sinon la phrase à écrire. C'est le
 * contrôle croisé qui donne sa valeur à la déclaration : `niveaux` reste utile
 * — il dit l'intention de l'auteur — mais il ne commande plus rien, et un
 * écart entre l'intention et le rendu se voit au lieu de se propager.
 *
 * Une déclaration jamais relue contre le rendu est une déclaration qui finira
 * par être fausse ; et une dimension discrète dont personne ne déclare le
 * compte n'est pas mesurable, parce que rien ne dirait que le rendu s'est
 * trompé.
 */
export function desaccordDeNiveaux(
  dimension: Dimension,
  niveauxDeclares: number | undefined,
): string | null {
  const mesure = grainMesure(dimension);
  if (niveauxDeclares === undefined) {
    if (!mesure.discrete) return null;
    return (
      `« ${dimension.id} » ne déclare pas son nombre de niveaux, et son rendu n’en ` +
      `montre que ${mesure.niveaux} sur ${PAS} pas. Sans déclaration, rien ne peut ` +
      'dire que ce compte est celui qui était voulu : la dimension n’est pas mesurable.'
    );
  }
  if (niveauxDeclares === mesure.niveaux) return null;
  return (
    `« ${dimension.id} » déclare ${niveauxDeclares} niveaux et son rendu en montre ` +
    `${mesure.niveaux}. L’un des deux est faux, et le plancher calculé sur le mauvais ` +
    'des deux laisserait passer des stimulus identiques ou écarterait une dimension ' +
    'mesurable.'
  );
}

/**
 * LE PLANCHER D'UNE PAIRE, D'APRÈS LE SEUL NOM DE SA DIMENSION D'ARRIVÉE.
 *
 * **C'est « vers » seul qui commande, et c'est mesuré sur le code, non supposé.**
 * Dans `tirerEssai`, le leurre vaut `borner(arete.vers, pasReference ± ecart)`
 * et la référence vaut `stimulus(arete.de, pasReference)` — au MÊME pas. L'écart
 * n'est donc présenté que sur la dimension d'arrivée ; la dimension de départ
 * ne porte aucun écart à discriminer. Prendre le maximum des deux planchers
 * aurait semblé prudent et aurait écarté des paires mesurables.
 *
 * Une dimension inconnue — une ligne écrite par une version passée, ou un
 * import — rend le plancher de la procédure seul. On ne peut rien dire du
 * grain d'une dimension qu'on n'a pas : annoncer le plancher global est alors
 * la seule phrase vraie, et elle ne prétend rien sur un grain. C'est aussi la
 * valeur la plus basse possible, donc celle qui ne masque aucun seuil déjà
 * enregistré derrière un plancher inventé.
 */
export function plancherDeLArete(versId: string): number {
  const dimension = dimensionParId(versId);
  return dimension === undefined ? REGLAGES.deltaMinimum : plancherReel(dimension);
}
