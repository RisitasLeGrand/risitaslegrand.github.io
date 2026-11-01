# Planche de choix — logotype « Cyclades » (prompt 65)

Huit images, engendrées par `npm run planche:logotype`. Elles ne sont pas
dessinées à la main : le script appelle `svgLogotype` de `src/lib/logotype.ts`,
la fonction même que le composant appelle. Les regénérer après une retouche du
dessin est donc une seule commande, et la planche ne peut pas montrer autre
chose que ce qui est livré.

## Comment lire une image

Chaque image porte les **trois variantes**, l'une sous l'autre. Chaque variante
est montrée dans ses **deux contextes réels** :

- en haut, **l'en-tête** — une rangée de 44 px, avec l'icône de menu à sa
  gauche, comme dans `Base.astro` ;
- en bas, **le voile de confidentialité** — le logotype seul et centré, aux
  couleurs du thème, et rien d'autre. Le voile ne doit livrer aucun indice sur
  l'écran qu'il cache.

Un logotype se juge à sa place : un échantillon flottant sur du gris n'aurait
rien appris.

## Les trois variantes

| variante | composition | destination |
| --- | --- | --- |
| **mot** | le mot seul, Public Sans 600 | l'en-tête |
| **anneau** | sept îles inégales et Délos décentrée, puis le mot | *écartée* |
| **archipel** | trois disques au-dessus du mot, en Spectral | le voile |

**« Anneau » est écartée**, et la planche dit pourquoi mieux que ce texte : à
18 px dans l'en-tête, un anneau de petits disques est l'idiome universel de
l'indicateur de chargement — que le site possède par ailleurs pour de vrai.
Le défaut ne se voyait pas dans le code ; il saute aux yeux sur l'image.

**« Archipel » est montrée en en-tête bien qu'elle n'y aille pas**, exprès : la
hauteur y étant partagée entre la marque et le mot, le nom tombe à environ huit
pixels. Il valait mieux le donner à voir que l'affirmer.

## Les huit images

| fichier | thème | mode | largeur |
| --- | --- | --- | --- |
| `egee-clair-390.png` | Égée (défaut) | clair | 390 px |
| `egee-clair-1280.png` | Égée (défaut) | clair | 1280 px |
| `egee-sombre-390.png` | Égée (défaut) | sombre | 390 px |
| `egee-sombre-1280.png` | Égée (défaut) | sombre | 1280 px |
| `republique-clair-390.png` | République | clair | 390 px |
| `republique-clair-1280.png` | République | clair | 1280 px |
| `republique-sombre-390.png` | République | sombre | 390 px |
| `republique-sombre-1280.png` | République | sombre | 1280 px |

## Pourquoi ces deux thèmes sur quatorze

**Égée** est le thème par défaut : c'est ce que presque tout le monde verra.
**République** est celui dont la mesure a fait changer le dessin — Délos y était
en couleur d'action, qui vaut 13,79:1 contre 10,53:1 pour le texte, de sorte que
le clin d'œil y dominait le nom. C'est donc là qu'il faut regarder. Deux thèmes
voisins n'auraient rien appris.

Les douze autres ne sont pas laissés au hasard pour autant :
`npm run essais:logotype` mesure les **25 combinaisons thème × mode** et exige
4,5:1 — le seuil d'un logotype seul porteur du nom. Pire cas relevé : 10,53:1
pour le mot, 5,31:1 pour la marque.

## Un avertissement sur les planches en général

La première version de celle-ci était **fausse**, et d'une façon qui ne se
voyait pas à la lecture du code : les captures de République montraient un mot
presque noir sur un fond presque noir, alors que la garde mesure 16,36:1 pour ce
thème. Relevé dans la page plutôt que raisonné, `--etat-texte` y calculait la
chaîne vide — les feuilles des treize thèmes non-défaut exigent
`[data-palette='<id>'][data-theme='<mode>']`, et la page ne posait que le
second. Elle n'avait donc aucun thème, et son fond sombre venait du
`color-scheme` du navigateur.

Le script refuse désormais de rendre une image dont les jetons calculent vide.
Une planche qui montre une variante sous un thème qu'elle n'a pas chargé est
pire qu'une planche manquante : on y choisirait sur une image fausse.
