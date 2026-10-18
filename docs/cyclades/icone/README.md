# L'icône de Cyclades — les trois variantes, et le choix

**La planche de comparaison : `docs/cyclades/icone/planche.png`.**
Trois variantes en haut à 256 px, les mêmes en bas rendues à 48 px puis
agrandies au plus proche voisin — c'est-à-dire telles qu'un écran d'accueil
les montre, sans lissage pour flatter.

Tout se régénère par `node scripts/icones.mjs`, qui porte le dessin de chacune.

## Le point de départ

Les Cyclades sont l'archipel qui **encercle Délos**. Les trois variantes
partent de là, et non d'une métaphore de la révision : une icône qui illustre
une idée se dessine toujours moins bien qu'une qui dessine une forme.

## Ce que la planche montre

| Variante | À 256 px | À 48 px |
| --- | --- | --- |
| **Orbite** (retenue) | un disque au centre, un anneau ouvert autour | nette ; l'anneau et le centre restent distincts |
| **Archipel** | sept îles autour de Délos | encore lisible, mais les petites îles perdent leur contour et l'ensemble se lit comme une rosace floue plutôt que comme un archipel |
| **Houle** | un relief sur trois vagues | le relief tient, les vagues fondent en une bande grise |

Le choix s'est fait **sur la seconde colonne**, parce que c'est celle de
l'usage : une icône d'application se regarde à 48 pixels, pas à 256.

Je ne dis pas que l'archipel est illisible en petit — la planche montre le
contraire, et c'était mon premier mot, trop sévère. Je dis qu'il perd ce qui
le distingue, alors que l'orbite ne perd rien.

## La zone sûre, qui décide de la forme autant que le goût

Android rogne une icône `maskable` à la forme qu'il choisit — cercle, goutte,
carré arrondi — et ne garantit que le **disque central de 80 %**. Le dessin
retenu tient dans un rayon de 0,2875 × la largeur, contre 0,4 autorisé. La
variante `maskable` resserre encore de 18 %, par prudence sous le rognage le
plus agressif.

## Changer d'avis plus tard

Les trois dessins sont des fonctions exportées de `scripts/icones.mjs`. Pour
en retenir une autre, il suffit d'échanger `orbite` contre `archipel` ou
`houle` dans le bloc d'écriture, puis de relancer le script : les six fichiers
de `public/` sont refaits, et l'essai `npm run essais:installation` vérifie
que chacun existe et fait la taille que le manifeste annonce.
