/**
 * « Non mesurable » : un essai qui ne peut pas juger, et qui ne se dit pas vert.
 *
 * ## Le défaut que cette convention corrige
 *
 * Plusieurs essais du dépôt ne peuvent rien dire sans une condition qui n'est
 * pas réunie dans tous les conteneurs. `essais:parcours-des-fiches` lit la
 * racine et les parcours servis de chaque fiche, et il lui faut plus de cent
 * fiches au manifeste pour que la répartition veuille dire quelque chose ;
 * `essais:niveau:navigateur` fixe la matière à « Économie », qui n'existe que
 * dans le corpus réel. Dans un conteneur qui ne sert que `content-exemple/` —
 * trois fiches, deux matières — le premier rendait un ROUGE et le second
 * LEVAIT : code 1, aucune croix, aucun message. Et rien, nulle part, ne disait
 * pourquoi : le rouge se re-diagnostiquait à chaque fois.
 *
 * ## Pourquoi un refus ne devient PAS un vert
 *
 * C'était la tentation, et c'est la condition qu'Alexis a posée : **un refus ne
 * doit jamais compter comme vert.** Un essai vert affirme quelque chose ;
 * celui-là n'affirme rien. Le ranger parmi les verts achèterait un nombre
 * flatteur contre une garantie perdue — et le jour où la condition serait
 * réunie mais la lecture cassée, le même vert couvrirait les deux cas sans
 * qu'on puisse les distinguer.
 *
 * ## La convention, telle qu'elle est fixée
 *
 * - **code de sortie 3** = non mesurable. 0 reste vert, 1 rouge, et tout autre
 *   code non nul reste rouge.
 * - **une ligne de marque obligatoire** : `⚠ NON MESURABLE : <raison>`. Un code
 *   3 **sans** cette ligne compte ROUGE — sans quoi un essai pourrait rendre 3
 *   par accident et disparaître du compte en silence.
 * - la batterie les compte à part, **avec leur raison**, et ne les range jamais
 *   parmi les verts. Ils ne la font pas sortir en rouge : rien n'est cassé, et
 *   faire rendre 1 interdirait de pousser depuis tout conteneur sans corpus
 *   réel, c'est-à-dire presque toujours.
 * - **personne ne recopie la ligne** : `nonMesurable(raison)` l'écrit et sort.
 *
 * ## Pourquoi le format vit ici, et pourquoi la batterie le lit d'ici
 *
 * Parce que l'écrivain et le lecteur doivent s'accorder. Écrit de part et
 * d'autre, le format divergerait — et le jour où il divergerait, un refus
 * redeviendrait un rouge sans que personne comprenne pourquoi. La batterie
 * importe donc `estNonMesurable` et `raisonNonMesurable` plutôt que de
 * reconnaître la ligne à sa façon.
 */

/**
 * Le code de sortie d'un essai qui n'a pas pu mesurer.
 *
 * 0 est pris par le vert, 1 par le rouge, 124 par l'interruption au délai
 * (`erreur.signal` dans la batterie). 3 est libre et n'a pas de sens
 * concurrent chez Node.
 */
export const CODE_NON_MESURABLE = 3;

/** Ce que la ligne de marque annonce, avant les deux points. */
export const INTITULE_NON_MESURABLE = '⚠ NON MESURABLE :';

/**
 * Le texte porte-t-il la ligne de marque ?
 *
 * Cherchée en TÊTE DE LIGNE, couleurs retirées, comme la batterie cherche sa
 * croix : une ligne qui se contenterait de citer l'intitulé au fil d'une phrase
 * ne doit pas suffire à faire disparaître un essai du compte.
 */
export function estNonMesurable(texte) {
  return lignesDeMarque(texte).length > 0;
}

/** La raison annoncée, ou une chaîne vide. Pour le récapitulatif de la batterie. */
export function raisonNonMesurable(texte) {
  const ligne = lignesDeMarque(texte)[0];
  return ligne ? ligne.slice(INTITULE_NON_MESURABLE.length).trim() : '';
}

const sansCouleur = (ligne) => ligne.replace(/\u001b\[[0-9;]*m/g, '').trim();

const lignesDeMarque = (texte) =>
  String(texte ?? '')
    .split('\n')
    .map(sansCouleur)
    .filter((l) => l.startsWith(INTITULE_NON_MESURABLE));

/**
 * Renonce à mesurer, en disant de quoi l'essai avait besoin, et sort.
 *
 * Le message ne porte **aucune croix** : la batterie compte rouge tout essai
 * dont une ligne commence par une croix, et ce refus n'est pas un rouge.
 *
 * `raison` dit ce qui manque, de façon vérifiable — « le corpus réel : plus de
 * cent fiches au manifeste » vaut mieux que « corpus insuffisant », parce que
 * le premier se vérifie et le second se discute. `constate` dit ce qui a été vu
 * à la place, et c'est lui qui épargne un diagnostic à qui lira le journal.
 *
 * ## `remede` : pourquoi il est devenu un paramètre
 *
 * Le conseil de sortie était écrit EN DUR — « npm run recuperer:corpus ». Il
 * est juste pour les deux premiers appelants, dont le corpus manque. Il est
 * FAUX pour le troisième, arrivé le jour même : « essais:organigramme:navigateur »
 * a le corpus entier sous la main, et ce qui lui manque est une DÉCLARATION
 * dans les fiches — au moins deux nœuds « essentiel: true ». Lui dire de
 * récupérer le corpus l'enverrait refaire ce qui est déjà fait.
 *
 * Un conseil faux est pire qu'une absence de conseil : il se suit. Le défaut
 * par défaut reste celui du corpus, qui couvre le cas le plus fréquent ; qui a
 * un autre remède le dit.
 */
export const REMEDE_CORPUS =
  'npm run recuperer:corpus (voir docs/cyclades/recuperation-du-corpus.md), puis reconstruisez';

export function nonMesurable(raison, constate = '', remede = REMEDE_CORPUS) {
  console.log(`\n${INTITULE_NON_MESURABLE} ${raison}`);
  if (constate) console.log(`  Constaté ici : ${constate}`);
  console.log(
    '  Cet essai ne juge rien dans cet état, et il ne se compte donc pas vert.\n' +
      `  Pour le rendre mesurable : ${remede}.\n`,
  );
  process.exit(CODE_NON_MESURABLE);
}
