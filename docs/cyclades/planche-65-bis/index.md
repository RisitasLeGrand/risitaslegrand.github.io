# Planche de choix — trois logos (prompt 65 bis)

Huit images, engendrées par `npm run planche:logotype:bis`. Comme au 65, elles
ne sont pas dessinées à la main : le script appelle `svgLogoBis` de
`src/lib/logotype-bis.ts`, de sorte que la planche ne peut pas montrer autre
chose que ce qu'on livrerait.

**Rien n'est branché dans le site.** `logotype-bis.ts` n'est appelé que par le
script de planche. Le branchement attend le choix d'Alexis, et se fera au point
centralisé de `src/lib/logotype.ts` — les deux constantes `VARIANTE_EN_TETE` et
`VARIANTE_VOILE` —, sous la garde `essais:logotype`.

## Ce que le 65 avait manqué

Le « mot seul » retenu au 65 a été écarté : ce n'était pas un logo, c'était du
texte courant un peu plus gras. Les trois propositions ci-dessous prennent trois
chemins franchement différents, pour que le choix en soit un.

## Deux formes, et pourquoi elles sont de la même famille

L'en-tête a 44 px de haut et le voile dix fois plus. Chaque proposition a donc
une **forme compacte** et une **forme complète** — et ce ne sont pas deux logos :
c'est le même dessin dont le détail apparaît quand il y a la place. Chaque image
les montre **côte à côte dans leurs deux places réelles**, la compacte dans la
rangée de 44 px, la complète seule et centrée sur le voile. C'est le seul moyen
de juger ce qui compte ici : non pas « ce dessin est-il beau », mais « ces deux
formes se reconnaissent-elles comme un seul logo ».

## Les trois propositions

| | proposition | la marque | la forme compacte | la forme complète |
| --- | --- | --- | --- | --- |
| **A** | **archipel-C** — la lettre dessinée | le C *est* un anneau d'îles, ouvert à droite de 55° à 305° | l'arc seul, épais, puis `yclades` | le même arc, fin, portant trois îles (rayons 14, 10, 7) et Délos dans l'ouverture |
| **B** | **baie** — le geste | une courbe unique qui passe sous le mot comme une côte | la courbe s'arrête à mi-mot, sans île | la courbe va jusqu'au bout, avec une île dans l'anse |
| **C** | **capitales** — la typographie seule | `CYCLADES` en capitales largement espacées, lapidaires | le lettrage seul | le lettrage et un arc ouvert de quatre marques inégales |

L'interlettrage n'est pas une propriété de la police : il est obtenu par
`textLength` avec `lengthAdjust="spacing"`, donc **déterministe quelle que soit
la police effectivement servie** — et c'est le même mécanisme qui réserve la
place et interdit le décalage de mise en page au chargement.

## Le contraste

Le dessin n'emploie que **deux jetons** : `--etat-texte` pour le mot et le
trait, `--etat-texte-faible` pour la marque (Délos, l'île de l'anse, les quatre
marques de l'arc). Vérifié par `grep` : aucune couleur en dur, aucun autre
jeton, aucun appel au réseau.

C'est exactement le couple que `npm run essais:logotype` mesure déjà sur les
**25 combinaisons thème × mode**, avec un pire cas de **10,53:1** pour le mot et
**5,31:1** pour la marque. Cette garantie porte donc sur ces trois dessins par
construction — *mais il faut être exact sur ce qui a été mesuré* : la garde
mesure les **jetons**, pas la géométrie. Elle ne dit rien de la lisibilité d'une
île de sept pixels, qui se juge sur l'image.

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

Mêmes deux thèmes qu'au 65, pour la même raison : **Égée** est le défaut, celui
que presque tout le monde verra ; **République** est celui dont la mesure a fait
changer le dessin au 65. Deux thèmes voisins n'auraient rien appris.

## Ce que la première planche de ce lot m'a appris, contre moi

**La première version de A était exactement le défaut que j'avais écrit avoir
évité.** L'en-tête de `logotype-bis.ts` affirmait que les trois marques
échappaient à la roue de chargement parce que leurs îles étaient « franchement
inégales ». Le fichier se démentait lui-même quatre lignes plus bas : les huit
angles étaient 55, 92, 130, 168, 205, 242, 278, 305 — des écarts de 36 à 38
degrés, c'est-à-dire **réguliers**. En thème sombre, l'image rendait le
`spinner` de tout le monde.

Deux corrections, et toutes deux venues de l'image, pas du code :

1. **A garde son arc dans les deux formes.** Une roue de chargement n'a pas de
   trait qui la relie : garder l'arc l'écarte plus sûrement qu'espérer qu'on
   voie à 56 px la différence entre un rayon de 6 et un de 13. Bénéfice second,
   qui m'importe autant : les deux formes se reconnaissent enfin comme un seul
   logo, ce que ce fichier promettait et que l'arc effacé démentait. L'arc est
   en outre **fin** en forme complète : épais, il ravalait les îles au rang de
   bosses — la plus petite ne sortait même pas du trait.
2. **La courbe de B passe sous les jambages.** Sa ligne de base était à 104,
   huit pixels sous la ligne d'écriture ; mais le « y » descend jusque vers 117.
   La courbe traversait donc les lettres, et en forme compacte elle se lisait
   comme un soulignement raté. Elle est à 128.

La leçon dépasse ce fichier : **une affirmation dans un commentaire n'est pas
une mesure**, et un dessin ne se juge pas sur le code qui l'engendre. Le script
refuse déjà de rendre une image dont les jetons calculent vide (garde héritée du
65, où la première planche montrait République en noir sur noir) ; il refuse
désormais aussi de rendre un dessin dégénéré — il exige six SVG par page et une
boîte non plate pour chacun. Mais aucune de ces deux gardes n'aurait attrapé la
roue de chargement. Celle-là, il a fallu regarder.
