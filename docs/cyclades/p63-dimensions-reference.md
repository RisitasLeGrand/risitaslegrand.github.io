# Les 123 dimensions de la référence de comportement

Cette fiche existe parce qu'une seule session du chantier détient le fichier de
référence, et qu'un lot qui doit en construire quarante dimensions ne peut pas
travailler sur un compte. Elle le remplace : tout ce qu'il faut pour écrire une
dimension est ici, et rien n'y est recopié du code.

Demandée par le pilote le 1er novembre 2026, écrite par l'agent A.

## Ce que cette fiche est, et ce qu'elle n'est pas

**C'est une description.** Chaque ligne dit ce qui varie pour la personne —
« la clarté d'un disque gris, du presque noir au presque blanc » —, puis les
faits mesurables qui permettent de l'implanter : échelle, plage, nombre de
niveaux quand la dimension est discrète, grain, paramètres de roving.

**Ce n'est pas une transcription.** Aucune ligne de rendu n'y figure, et c'est
voulu : la référence dessine avec son propre vocabulaire graphique, et le
recopier produirait un lot qui imite au lieu de comprendre. Ce qui est repris
est la DÉFINITION de la grandeur, parce qu'elle seule décide si deux stimulus
se distinguent.

**Les chiffres sont extraits, non recopiés à la main.** Les 123 déclarations
ont été analysées par un programme qui REFUSE de rendre quoi que ce soit s'il
ne sait pas lire une forme de plage ou s'il manque une description : les 123
sont passées, aucune n'a été approximée. Un tableau de référence à moitié juste
serait pire que pas de tableau, puisqu'on le croirait.

## Les comptes, et une correction

| | |
|---|---|
| dimensions | **123** |
| vision | 69 |
| audition | 54 |
| prothétiques — « combien » | 79 |
| métathétiques — « où », « lequel » | **44** |
| échelle logarithmique | 36 |
| échelle linéaire | 63 |
| échelle circulaire | 24 |
| discrètes | 32 |
| paramètres de roving distincts | 15 |

**Quarante-quatre métathétiques, et non quarante-deux.** Un relevé antérieur de
ma part annonçait 79 et 42, ce qui fait 121 et non 123 : le compte ne se
vérifiait pas lui-même, et personne ne l'a additionné. C'est inscrit ici parce
qu'un chiffre faux dans un document de référence se recopie plus vite qu'il ne
se corrige.

## Les deux familles de Stevens

La distinction vient de Stevens (1957) et elle n'est pas décorative : elle
décide de la façon de juger.

Une dimension **prothétique** répond à « combien » : l'excitation s'y ajoute,
et on la juge par estimation de grandeur — une intensité, une taille, une
durée. Une dimension **métathétique** répond à « où » ou « lequel » :
l'excitation s'y déplace, et on la juge par différence — une hauteur, une
position, une teinte, un nom de note.

Une paire ne relie que deux dimensions de la même famille : on ne fait pas
correspondre un « combien » à un « où ».

## L'échelle, et ce qu'elle veut dire

- **log** — les pas perceptivement réguliers sont des rapports constants. C'est
  la loi de Weber : l'écart juste perceptible croît avec la grandeur.
- **lin** — l'échelle physique est déjà perceptive, ou la grandeur est une
  proportion bornée. Les pas réguliers sont des différences constantes.
- **circ** — la dimension reboucle. Il n'y a pas d'origine, et l'écart entre
  deux valeurs se mesure par le plus court chemin. Une teinte à 350° est
  voisine d'une teinte à 10°.

Deux plages descendent au lieu de monter — `vision.fractality` (3 → 1) et
`audition.melodic_fractality` (2,6 → 0,2) — parce que la grandeur perçue croît
quand l'exposant décroît. Ce n'est pas une faute de saisie.

## LE POINT LE PLUS IMPORTANT : LE GRAIN DES DIMENSIONS DISCRÈTES

Une dimension discrète ne montre que des valeurs séparées. Elle a donc un
**grain** : le plus petit écart qui change quelque chose à l'écran ou dans
l'oreille. En dessous, deux stimulus demandés différents sont **identiques**.

C'est la panne qui ne lève pas. L'essai se déroule normalement, les deux
candidats sont valides, la personne répond au hasard puisqu'il n'y a rien à
distinguer — et l'escalier enregistre quand même un seuil, plausible et sans
rapport avec ce qu'elle perçoit.

**Le grain se lit sur la déclaration**, et il ne vaut pas la même chose selon
que la dimension reboucle :

- dimension **circulaire** à n niveaux : grain = **1/n** ;
- dimension **non circulaire** à n niveaux : grain = **1/(n−1)**.

Sur une circulaire à 7 niveaux, prendre 1/(n−1) surestime le grain de 17 %.
C'est la direction prudente, mais c'est faux, et une fiche de référence n'a pas
à propager une approximation.

**Sur une échelle logarithmique, le grain VARIE avec la position** : il est le
plus grossier en bas de la plage. Les valeurs marquées d'une étoile dans les
tableaux sont ce pire grain. Un plancher constant doit le prendre ; un plancher
calculé localement serait plus fin.

### Et le résultat qui décide d'un lot entier

**Les 32 dimensions discrètes ont toutes un grain supérieur à 0,02**, la borne
basse globale de l'escalier. Du plus grossier au plus fin :

| grain | dimensions |
|---|---|
| 25 % | `nesting_depth`, `recursion_depth` (5 niveaux) |
| 24 %\* | `audition.event_count` (log, 15 valeurs) |
| 20 % | `polygon_sides`, `hole_count`, `rotational_symmetry` (6) |
| 16,7 % | `accent_phase` (6, circ.), `divisor_richness` (7) |
| 14,3 % | `period_length` (8), `weekday`, `note_name` (7, circ.) |
| 12,5 % | `flash_count` (9), `compass_point` (8, circ.) |
| 9,7 %\* | `vision.numerosity` (log, 49 valeurs) |
| 8,3 % | `month`, `clock_hour` (12, circ.) |
| 7,7 % | `audition.spectral_complexity` (14) |
| 6,2 % | `motif_rotation` (16, circ.) |
| 5,3 % | `number` (20) |
| 4 % | `letter` (26) |

Aucune exception. Tout seuil déjà mesuré sur une dimension discrète sous la
borne globale est donc sans objet, et le plancher par dimension n'est pas un
raffinement : c'est la condition pour que ces 32 mesures veuillent dire quelque
chose.

*Ce tableau-ci est un résumé écrit à la main ; il a été relu contre les
colonnes « niveaux » et « grain » des tableaux par groupe, qui sont produits par
le programme d'extraction. Les deux concordent, grain par grain. En cas de
doute, ce sont les tableaux par groupe qui font foi — un résumé se périme, une
colonne extraite non.*

**Et cette relecture n'est plus à la main.** `essais:fiche-dimensions`, au
socle depuis le 1er novembre, lit cette fiche et en compare trois choses :

- les trente-deux lignes discrètes contre `dimensions-discretes.ts`, **dans les
  deux sens** — une dimension de la fiche absente du code n'a pas de plancher,
  une dimension du code absente de la fiche est inventée, et ce sont deux
  fautes différentes ;
- chaque grain contre sa règle — `1/n` si la colonne « éch. » porte `circ`,
  `1/(n−1)` sinon, et strictement plus grossier que cette règle sur une
  logarithmique, ce que l'étoile signale ;
- ce résumé-ci contre les colonnes, grain par grain, ce qui est exactement ce
  que le paragraphe ci-dessus promettait de faire à la main.

Si la forme de la fiche change — une colonne déplacée, un tableau renommé —
l'essai **refuse** avec le code 2 au lieu de passer au vert. Un analyseur qui ne
lit plus rien ne trouve aucune discordance, et aucune discordance est ce que
rend une fiche juste.

La circularité n'a pas de colonne propre : elle est portée par « éch. », dont la
valeur `circ` la déclare. L'essai assied cette équivalence plutôt que de la
laisser à la lecture — une convention qui n'est écrite nulle part est une
convention qui se perd.

**Aucune des 123 déclarations n'annonce son nombre de niveaux.** Il est lisible,
mais il est déduit — de `STEP(n, circulaire)`, qui rend n niveaux dans les deux
cas, ou de l'étendue entière d'une plage arrondie. Les colonnes « niveaux » et
« grain » de cette fiche sont donc le seul endroit du chantier où ces nombres
existent, et une dimension nouvelle devra les déclarer plutôt que les laisser
deviner.

## Le roving, et à quoi il sert

Le roving fait varier, d'un essai à l'autre, ce qui n'est PAS mesuré. Sans lui,
la personne peut répondre sur un indice annexe — la taille au lieu de la
clarté — et le seuil ne porte plus sur ce qu'on croit mesurer.

Quinze paramètres, et leur emploi :

| paramètre | dimensions | ce qu'il brouille |
|---|---|---|
| `carrier` | 37 | la fréquence porteuse d'un son |
| `pos` | 23 | la position à l'écran |
| `size` | 22 | la taille de l'objet montré |
| `orient` | 21 | l'inclinaison |
| `level` | 20 | le niveau sonore |
| `spread` | 5 | la dispersion autour d'une moyenne |
| `phase` | 2 | la phase d'un réseau |
| `lum` | 2 | la clarté |
| `angle` | 2 | l'angle de déplacement |
| `y` | 2 | l'ordonnée |
| `hue` | 1 | la teinte |
| `x` | 1 | l'abscisse |
| `speed` | 1 | la vitesse |
| `radius` | 1 | la distance au centre |
| `timbre` | 1 | le timbre |

**Vingt-quatre dimensions n'ont aucun roving propre**, et ce n'est pas un
oubli : ce sont celles dont le stimulus est un ensemble — un nuage, un réseau,
une suite — où la grandeur mesurée est déjà une statistique de l'ensemble, et
où brouiller un attribut reviendrait à brouiller la mesure elle-même.

## Vision · prothétiques — « combien »

46 dimensions.

| canonique | nom | ce qui varie | éch. | plage | niveaux | grain | roving propre |
|---|---|---|---|---|---|---|---|
| `vision.luminance` | Clarté | La clarté d’un disque gris, du presque noir au presque blanc. | log | 0,05 → 1 | — | — | pos, size |
| `vision.contrast` | Contraste | La force des bandes claires et sombres d’un réseau rayé, de l’à-peine-visible au franchement tranché. | log | 0,04 → 1 | — | — | orient, phase, size |
| `vision.size` | Taille (rayon) | Le diamètre d’un disque, du petit point au grand cercle. | log | 8 → 120 | — | — | pos, lum |
| `vision.length` | Longueur d’une barre | La longueur d’une barre horizontale. | log | 20 → 200 | — | — | orient, pos |
| `vision.width` | Épaisseur d’une barre | L’épaisseur d’une barre, du trait fin au bloc large. | log | 4 → 60 | — | — | orient, pos |
| `vision.numerosity` | Nombre de points | Combien de points distincts sont dispersés à l’écran. | log | 4 → 52 | 49 | 9,7 %* | pos |
| `vision.density` | Densité de points | Le serrement d’un nombre fixe de points dans leur amas, de l’étalé au tassé. | log | 0,0003 → 0,003 | — | — | — |
| `vision.dispersion` | Dispersion spatiale | L’éloignement d’un nombre fixe de points par rapport au centre. | log | 30 → 180 | — | — | pos |
| `vision.duration` | Durée d’un éclair | Le temps pendant lequel un disque reste allumé, de l’éclair bref à la tenue longue. | log | 80 → 900 | — | — | pos, lum |
| `vision.flicker_rate` | Fréquence de scintillement | La vitesse à laquelle un disque clignote, de la pulsation lente au scintillement rapide. | log | 1 → 16 | — | — | pos, size |
| `vision.speed` | Vitesse | La vitesse d’un point qui traverse l’écran. | log | 20 → 300 | — | — | angle |
| `vision.acceleration` | Accélération | La vigueur avec laquelle un point en mouvement prend de la vitesse. | log | 50 → 800 | — | — | y |
| `vision.motion_amplitude` | Amplitude du mouvement | L’ampleur du va-et-vient d’un point autour du centre, du tremblement au grand balayage. | log | 10 → 170 | — | — | orient |
| `vision.spatial_frequency` | Fréquence spatiale | Le serrement des rayures d’un réseau, des bandes larges aux lignes fines. | log | 0,01 → 0,12 | — | — | orient, phase |
| `vision.saturation` | Saturation | La vivacité d’un disque coloré, du gris pâle à la couleur profonde — la teinte, elle, ne change pas. | log | 0,05 → 1 | — | — | hue, size |
| `vision.regularity` | Régularité des points | La régularité d’une grille de points, du désordre au parfait alignement. | lin | 0 → 1 | — | — | pos |
| `vision.anisotropy` | Anisotropie | L’alignement d’un champ de petits segments, des angles tous dispersés à tous parallèles. | lin | 0 → 1 | — | — | orient |
| `vision.spatial_correlation` | Corrélation spatiale | La douceur avec laquelle les taches claires et sombres d’une texture se fondent, du grain fin aux larges plages. | lin | 0 → 1 | — | — | — |
| `vision.flash_count` | Nombre d’impulsions | Combien de fois un disque éclate de suite. | lin | 1 → 9 | 9 | 12,5 % | pos, size |
| `vision.relative_distance` | Distance relative | L’écart entre deux points. | log | 20 → 300 | — | — | orient, pos |
| `vision.angle` | Ouverture d’un angle | L’ouverture entre deux lignes qui se rejoignent, du coin étroit au grand V. | lin | 10 → 170 | — | — | orient |
| `vision.aspect_ratio` | Rapport de forme | L’étirement d’un rectangle d’aire fixe, du haut et mince au large et plat. | log | 0,25 → 4 | — | — | orient, pos |
| `vision.curvature` | Courbure | La courbure d’une ligne, de la parfaitement droite à l’arc serré. | lin | 0 → 1 | — | — | orient |
| `vision.circularity` | Circularité | Le nombre de côtés d’une forme, du triangle à la forme si polygonale qu’elle paraît ronde. | lin | 0 → 1 | — | — | orient |
| `vision.convexity` | Convexité | Le creusement des bords d’une forme, du contour en étoile à la forme bombée. | lin | 0 → 1 | — | — | orient |
| `vision.symmetry` | Symétrie | La fidélité avec laquelle les points de droite reflètent ceux de gauche. | lin | 0 → 1 | — | — | — |
| `vision.center_distance` | Distance au centre | L’éloignement d’un point par rapport au centre. | lin | 0 → 170 | — | — | angle |
| `vision.fractality` | Fractalité d’un contour | La rugosité du contour d’une tache, du bord lisse au bord crénelé. | lin | 3 → 1 | — | — | orient, size |
| `vision.voronoi_chaos` | Désordre d’un pavage | L’irrégularité d’un pavage de cellules, du nid d’abeilles au patchwork. | lin | 0 → 1 | — | — | — |
| `vision.system_complexity` | Complexité d’un réseau (recâblage) | Le recâblage d’un anneau de points reliés, des liaisons toutes locales à l’enchevêtrement de raccourcis. | log | 0,02 → 1 | — | — | orient |
| `vision.polygon_sides` | Côtés d’un polygone | Le nombre de côtés d’un polygone tracé, du triangle à l’octogone — les figures élémentaires des épreuves de raisonnement. | lin | 3 → 8 (entiers) | 6 | 20 % | orient, size |
| `vision.hole_count` | Nombre de trous (genre) | Combien de trous percent un disque plein : un compte topologique qu’aucun étirement ne change. | lin | 0 → 5 (entiers) | 6 | 20 % | orient, size |
| `vision.nesting_depth` | Profondeur d’imbrication | Combien de contours sont emboîtés les uns dans les autres ; cercles et carrés se mêlent au hasard, seule la profondeur compte. | lin | 1 → 5 (entiers) | 5 | 25 % | orient |
| `vision.rotational_symmetry` | Ordre de symétrie de rotation | Combien de pales identiques tournent autour du centre, de la pale unique à la symétrie d’ordre six. | lin | 1 → 6 (entiers) | 6 | 20 % | orient, size |
| `vision.glass_coherence` | Cohérence d’un motif de Glass | La force avec laquelle un champ de paires de points s’organise en un tourbillon global — explosion, spirale ou anneaux, tirés au hasard. | lin | 0 → 1 | — | — | orient |
| `vision.divisor_richness` | Richesse en diviseurs (roue) | Combien de façons un nombre de points disposés en cercle se divise en groupes égaux, montrées par des polygones superposés : des nombres premiers aux nombres très divisibles. | lin | 0 → 6 (entiers) | 7 | 16,7 % | orient |
| `vision.period_length` | Longueur de période (frise) | La longueur du motif qui se répète dans une rangée de traits inclinés. | lin | 2 → 9 (entiers) | 8 | 14,3 % | pos |
| `vision.logistic_chaos` | Chaos (suite logistique) | Le désordre d’une suite de barres produite en réinjectant un nombre dans une formule de croissance, du cycle stable à l’imprévisible. | lin | 0 → 1 | — | — | — |
| `vision.entropy` | Entropie d’une suite | La prévisibilité d’une courte suite de points sur une portée, du cycle fixe aux sauts imprévisibles. | lin | 0 → 1 | — | — | — |
| `vision.compressibility` | Incompressibilité (grille) | La part d’une grille de cases noires et blanches qui suit un petit motif répété plutôt que le hasard. | lin | 0 → 1 | — | — | — |
| `vision.recursion_depth` | Profondeur de récursion (arbre) | Combien de fois un arbre se divise en branches plus petites. | lin | 1 → 5 (entiers) | 5 | 25 % | orient |
| `vision.correlation` | Corrélation (nuage de points) | La force du lien entre les abscisses et les ordonnées d’un nuage, du nuage informe à la diagonale serrée. | lin | 0 → 0,98 | — | — | size |
| `vision.ratio` | Rapport entre deux ensembles | La proportion de points pleins face aux cercles vides, c’est-à-dire le rapport entre deux effectifs. | log | 1 → 6 | — | — | — |
| `vision.collective_order` | Ordre collectif (essaim) | L’alignement des caps d’un essaim de points mobiles, de la dérive désordonnée au vol groupé. | lin | 0 → 1 | — | — | — |
| `vision.modularity` | Modularité d’un réseau | La part des liaisons d’un réseau qui restent dans des grappes serrées plutôt que de s’étaler. | lin | 0,2 → 1 | — | — | — |
| `vision.rhythmic_evenness` | Régularité (cercle euclidien) | L’étalement d’une partie des positions autour d’un cercle de cases, du tas serré à la répartition la plus égale. | lin | 0 → 1 | — | — | — |

## Vision · métathétiques — « où » ou « lequel »

23 dimensions.

| canonique | nom | ce qui varie | éch. | plage | niveaux | grain | roving propre |
|---|---|---|---|---|---|---|---|
| `vision.position_x` | Position horizontale | La place d’un point de gauche à droite dans un cadre carré. | lin | 40 → 380 | — | — | y |
| `vision.position_y` | Position verticale | La place d’un point de bas en haut dans un cadre carré. | lin | 380 → 40 | — | — | x |
| `vision.orientation` | Orientation | L’inclinaison d’une barre, qui reboucle de l’horizontale à l’horizontale. | circ | 0 → 180 | — | — | pos, size |
| `vision.direction` | Direction du mouvement | La direction dans laquelle un point se déplace, sur tout le tour. | circ | 0 → 360 | — | — | speed |
| `vision.hue` | Teinte | La couleur d’un disque sur le cercle chromatique — rouge, orange, jaune, vert, bleu, violet, et retour au rouge. La clarté reste constante. | circ | 0 → 360 | — | — | pos, size |
| `vision.polar_angle` | Angle polaire | La direction, mesurée en angle depuis le centre, où se trouve un point. | circ | 0 → 360 | — | — | radius |
| `vision.phase` | Phase d’un réseau | La place des rayures d’un réseau par rapport à un repère rouge fixe, qui reboucle quand le motif glisse. | circ | 0 → 2π | — | — | — |
| `vision.accent_phase` | Phase d’accent (cycle) | Laquelle des positions d’un anneau de points clignotants est la plus grosse, l’accentuée. | circ | 0 → 5 (entiers) | 6 | 16,7 % | — |
| `vision.synchrony` | Asynchronie visuelle | Lequel de deux disques, le gauche ou le droit, s’allume le premier, et de combien. | lin | -250 → 250 | — | — | — |
| `vision.figure_rotation` | Rotation d’une figure chirale | L’orientation d’une figure en L, qui n’a aucune symétrie : chaque angle se distingue. | circ | 0 → 360 | — | — | pos, size |
| `vision.glass_type` | Type de motif de Glass | La nature du tourbillon formé par un champ de paires de points : explosion radiale, puis spirales, puis anneaux concentriques, puis spirales inverses. | circ | 0 → 180 | — | — | size |
| `vision.flow_radial` | Flux (contraction ou expansion) | Si un champ de points afflue vers le centre ou s’en écarte, et à quelle vitesse. | lin | -1 → 1 | — | — | — |
| `vision.ensemble_orientation` | Orientation moyenne d’un ensemble | L’inclinaison moyenne d’une grille de petits segments, chacun variant autour de cette moyenne. | circ | 0 → 180 | — | — | spread |
| `vision.ensemble_hue` | Teinte moyenne d’un ensemble | La couleur moyenne d’une grille de points mouchetés sur le cercle chromatique, chacun variant autour d’elle. | circ | 0 → 360 | — | — | spread |
| `vision.motif_rotation` | Rotation d’un motif (cycle) | Lequel des temps d’un motif rythmique fixe disposé en cercle compte comme le départ. | circ | 0 → 15 (entiers) | 16 | 6,2 % | size |
| `vision.distribution_mode` | Mode d’une distribution | La place du sommet — la valeur la plus fréquente — d’un histogramme. | lin | 0,1 → 0,9 | — | — | spread |
| `vision.weekday` | Jour de la semaine (écrit) | Quel jour de la semaine est écrit en grand à l’écran, du lundi au dimanche. | circ | 0 → 6 (entiers) | 7 | 14,3 % | pos, size |
| `vision.month` | Mois (écrit) | Quel mois de l’année est écrit en grand à l’écran, de janvier à décembre. | circ | 0 → 11 (entiers) | 12 | 8,3 % | pos, size |
| `vision.clock_hour` | Heure d’une horloge (écrite) | Quelle heure une horloge afficherait, écrite en chiffres, sur les douze heures du cadran. | circ | 0 → 11 (entiers) | 12 | 8,3 % | pos, size |
| `vision.compass_point` | Point cardinal (écrit) | Lequel des huit points cardinaux est écrit en grand à l’écran, comme sur une rose des vents. | circ | 0 → 7 (entiers) | 8 | 12,5 % | pos, size |
| `vision.note_name` | Nom de note (écrit) | Quel nom de note est écrit en grand à l’écran, sur les sept touches blanches d’une octave. | circ | 0 → 6 (entiers) | 7 | 14,3 % | pos, size |
| `vision.letter` | Lettre (écrite) | Quelle lettre de l’alphabet est écrite en grand à l’écran, de A à Z. | lin | 0 → 25 (entiers) | 26 | 4 % | pos, size |
| `vision.number` | Nombre (écrit) | Quel entier de 1 à 20 est écrit en grand à l’écran — une place dans une liste fixe, et non une grandeur à comparer. | lin | 0 → 19 (entiers) | 20 | 5,3 % | pos, size |

## Audition · prothétiques — « combien »

33 dimensions.

| canonique | nom | ce qui varie | éch. | plage | niveaux | grain | roving propre |
|---|---|---|---|---|---|---|---|
| `audition.loudness` | Intensité sonore | La force d’un son, de l’à-peine-audible au fort. | log | 0,03 → 0,8 | — | — | carrier |
| `audition.duration` | Durée d’un son | La longueur d’un son isolé, du bip bref à la note tenue. | log | 80 → 900 | — | — | carrier, level |
| `audition.event_count` | Nombre d’événements | Combien de clics brefs se succèdent. | log | 2 → 16 | 15 | 24 %* | carrier, level |
| `audition.event_rate` | Cadence des événements | La vitesse de répétition d’un train de clics. | log | 1 → 12 | — | — | carrier, level |
| `audition.attack_time` | Temps d’attaque | La progressivité du début d’un son, de l’attaque nette au lent gonflement. | log | 5 → 300 | — | — | carrier, level |
| `audition.decay_time` | Temps d’extinction | La progressivité de la fin d’un son, de la coupure brusque à l’extinction lente. | log | 20 → 600 | — | — | carrier, level |
| `audition.am_rate` | Fréquence de modulation | La vitesse à laquelle un son ondule en intensité, du battement lent au frémissement rapide. | log | 1 → 30 | — | — | carrier, level |
| `audition.harmonicity` | Harmonicité | La netteté avec laquelle les harmoniques d’un son s’alignent sur une hauteur unique, du fracas désaccordé au son de cloche. | lin | 0 → 1 | — | — | carrier, level |
| `audition.spectral_centroid` | Centre spectral | Où se concentre l’énergie d’un bruit filtré, du grondement grave au souffle aigu. | log | 200 → 4000 | — | — | level |
| `audition.spectral_bandwidth` | Largeur de bande | L’étendue de fréquences couverte par un bruit, de la bande étroite comme un sifflement au souffle large. | log | 0,1 → 4 | — | — | carrier, level |
| `audition.spectral_slope` | Pente spectrale | La vitesse à laquelle les harmoniques s’éteignent quand la hauteur monte, ce qui donne au son sa couleur plus ou moins sourde. | lin | -18 → 6 | — | — | carrier |
| `audition.spectral_complexity` | Complexité spectrale | Combien de couches d’harmoniques se superposent, de la hauteur nue au son dense comme un accord. | lin | 1 → 14 | 14 | 7,7 % | carrier |
| `audition.roughness` | Rugosité | Le battement de deux hauteurs proches et dissonantes, du son lisse à la rugosité bourdonnante. | lin | 0 → 1 | — | — | carrier, level |
| `audition.rhythm_regularity` | Régularité rythmique | La régularité des intervalles entre des clics, du rythme trébuchant à la pulsation parfaitement égale. | lin | 0 → 1 | — | — | level |
| `audition.pitch_interval` | Taille d’un intervalle | L’ampleur du saut entre deux sons successifs, du petit degré au grand bond. | log | 0,5 → 12 | — | — | carrier |
| `audition.distance` | Distance apparente | L’éloignement apparent d’un son, du proche et clair au lointain et étouffé. | lin | 0 → 1 | — | — | carrier |
| `audition.acceleration` | Accélération de la cadence | L’accélération d’un train de clics au fil de son déroulement. | log | 0,5 → 8 | — | — | level |
| `audition.deceleration` | Ralentissement de la cadence | Le ralentissement d’un train de clics au fil de son déroulement. | log | 0,5 → 8 | — | — | level |
| `audition.accent_strength` | Force de l’accent | L’appui mis sur un temps sur deux, de la pulsation égale au rythme fortement scandé. | lin | 0 → 1 | — | — | carrier |
| `audition.spatial_width` | Largeur spatiale | La largeur de l’image stéréo d’un bruit, du point central au son qui remplit les deux oreilles. | lin | 0 → 1 | — | — | carrier, level |
| `audition.timbre_richness` | Richesse harmonique | Le caractère plus ou moins bourdonnant d’un son, du sinus pur au mélange avec un signal carré. | lin | 0 → 1 | — | — | carrier, level |
| `audition.melodic_fractality` | Fractalité mélodique | La prévisibilité d’une courte mélodie d’une note à l’autre, de la ligne douce au contour heurté. | lin | 2,6 → 0,2 | — | — | carrier |
| `audition.figure_coherence` | Cohérence figure-fond | La force avec laquelle une voix tenue se détache d’un nuage de sons aléatoires. | lin | 0 → 1 | — | — | carrier |
| `audition.divisor_richness` | Richesse en diviseurs (métrique) | Combien de façons une métrique de clics se divise en groupes égaux, du nombre premier de temps aux subdivisions nombreuses. | lin | 0 → 6 (entiers) | 7 | 16,7 % | carrier |
| `audition.period_length` | Longueur de période (boucle) | La longueur du motif qui se répète dans une mélodie en boucle. | lin | 2 → 9 (entiers) | 8 | 14,3 % | carrier |
| `audition.logistic_chaos` | Chaos (suite logistique) | Le désordre d’une mélodie dont les hauteurs viennent d’un nombre réinjecté dans une formule de croissance. | lin | 0 → 1 | — | — | carrier |
| `audition.entropy` | Entropie d’une suite | La prévisibilité d’une courte mélodie, du cycle fixe aux sauts imprévisibles. | lin | 0 → 1 | — | — | carrier |
| `audition.compressibility` | Incompressibilité (rythme) | La part d’un rythme de clics qui suit un petit motif répété plutôt que le hasard. | lin | 0 → 1 | — | — | carrier |
| `audition.recursion_depth` | Profondeur de récursion (métrique imbriquée) | Combien de couches de rythme s’empilent, de la pulsation unique aux couches plus rapides imbriquées. | lin | 1 → 5 (entiers) | 5 | 25 % | carrier |
| `audition.correlation` | Corrélation (hauteur et intensité) | La force du lien entre la hauteur et l’intensité d’une suite de notes. | lin | 0 → 0,98 | — | — | carrier |
| `audition.ratio` | Rapport entre deux flux | La proportion de clics graves face aux aigus, c’est-à-dire le rapport entre deux groupes. | log | 1 → 6 | — | — | — |
| `audition.collective_order` | Ordre collectif (glissandos) | L’alignement d’un ensemble de glissandos, du glissement chacun pour soi au mouvement commun. | lin | 0 → 1 | — | — | carrier |
| `audition.rhythmic_evenness` | Régularité (rythme euclidien) | L’étalement d’une partie des temps dans un cycle de cases, du tas serré à la répartition la plus égale. | lin | 0 → 1 | — | — | carrier |

## Audition · métathétiques — « où » ou « lequel »

21 dimensions.

| canonique | nom | ce qui varie | éch. | plage | niveaux | grain | roving propre |
|---|---|---|---|---|---|---|---|
| `audition.pitch` | Hauteur | La hauteur d’un son, du grave à l’aigu. | log | 110 → 1760 | — | — | level, timbre |
| `audition.chroma` | Chroma (classe de hauteur) | Le nom de note d’un son, indépendamment de l’octave, joué en ton de Shepard dont la hauteur est rendue ambiguë exprès : seul le nom passe, et il reboucle comme un cadran. | circ | 0 → 12 | — | — | level |
| `audition.azimuth` | Azimut | Le côté d’où semble venir un son, de la gauche pleine à la droite pleine. | lin | -1 → 1 | — | — | carrier, level |
| `audition.elevation` | Élévation | Si un son semble venir d’en dessous ou d’au-dessus, par des indices spatiaux. | lin | -40 → 60 | — | — | level |
| `audition.formant_f1` | Première formante | Quelle voyelle produit un son de synthèse vocale, par l’ouverture de la bouche — de la voyelle fermée à la voyelle ouverte. | log | 250 → 900 | — | — | carrier |
| `audition.formant_f2` | Seconde formante | Quelle voyelle produit un son de synthèse vocale, par l’avancée de la langue — de la voyelle d’arrière à celle d’avant. | log | 800 → 2500 | — | — | carrier |
| `audition.accent_phase` | Phase d’accent (cycle) | Lequel des temps d’un cycle de clics est l’accentué. | circ | 0 → 5 (entiers) | 6 | 16,7 % | carrier |
| `audition.pitch_contour` | Contour de hauteur | Si une courte suite de notes descend ou monte. | lin | 0 → 1 | — | — | carrier |
| `audition.amplitude_contour` | Contour d’intensité | Si un son s’éteint ou s’enfle au fil de sa durée. | lin | 0 → 1 | — | — | carrier |
| `audition.synchrony` | Asynchronie interaurale | Quelle oreille, la gauche ou la droite, entend un clic la première, et de combien. | lin | -250 → 250 | — | — | carrier |
| `audition.shepard_glide` | Glissando sans fin (Shepard) | Si un son de Shepard descend ou monte sans fin, et à quelle vitesse, sans jamais devenir globalement plus grave ni plus aigu. | lin | -1,5 → 1,5 | — | — | — |
| `audition.ensemble_pitch` | Hauteur moyenne d’un nuage | La hauteur moyenne d’un nuage de notes superposées, chacune dispersée autour d’elle. | log | 150 → 1200 | — | — | level, spread |
| `audition.motif_rotation` | Rotation d’un motif (cycle) | Lequel des temps d’un motif rythmique fixe compte comme le départ. | circ | 0 → 15 (entiers) | 16 | 6,2 % | carrier |
| `audition.temporal_mode` | Mode temporel | Où se concentre une salve de clics dans un court intervalle, du début à la fin. | lin | 0,1 → 0,9 | — | — | carrier, spread |
| `audition.weekday` | Jour de la semaine (parlé) | Quel jour de la semaine est prononcé, du lundi au dimanche. | circ | 0 → 6 (entiers) | 7 | 14,3 % | — |
| `audition.month` | Mois (parlé) | Quel mois de l’année est prononcé, de janvier à décembre. | circ | 0 → 11 (entiers) | 12 | 8,3 % | — |
| `audition.clock_hour` | Heure d’une horloge (parlée) | Quelle heure une horloge afficherait, prononcée, sur les douze heures du cadran. | circ | 0 → 11 (entiers) | 12 | 8,3 % | — |
| `audition.compass_point` | Point cardinal (parlé) | Lequel des huit points cardinaux est prononcé, comme sur une rose des vents. | circ | 0 → 7 (entiers) | 8 | 12,5 % | — |
| `audition.note_name` | Nom de note (parlé) | Quel nom de note est prononcé, sur les sept touches blanches d’une octave. | circ | 0 → 6 (entiers) | 7 | 14,3 % | — |
| `audition.letter` | Lettre (parlée) | Quelle lettre de l’alphabet est prononcée, de A à Z. | lin | 0 → 25 (entiers) | 26 | 4 % | — |
| `audition.number` | Nombre (parlé) | Quel entier de 1 à 20 est prononcé — une place dans une liste fixe, et non une grandeur à comparer. | lin | 0 → 19 (entiers) | 20 | 5,3 % | — |

## Comment se servir de cette fiche pour écrire une dimension

1. **La description d'abord.** Si la phrase « ce qui varie » ne se comprend pas
   sans le code, la dimension n'est pas prête à être écrite.
2. **L'échelle décide de l'interpolation**, et le grain décide du plancher. Une
   dimension discrète qui n'annonce pas son nombre de niveaux ne doit pas être
   mesurable du tout : un champ absent se lirait « continue » et ramènerait la
   panne muette décrite plus haut.
3. **Le roving se choisit par ce qu'il faut rendre inutilisable**, pas par
   habitude. La question est : sur quel indice annexe pourrait-on répondre sans
   percevoir la grandeur ?
4. **L'essai qui garde la dimension se formule sur ce que la personne voit** :
   deux stimulus demandés au plancher doivent DIFFÉRER. Une assertion sur
   l'arithmétique passerait alors même que les deux stimulus se confondent.

## Ce que cette fiche ne dit pas

Les unités physiques ne sont pas inscrites, parce que les déclarations ne les
portent pas. Les plages se lisent avec la description : une taille en pixels,
une durée en millisecondes, une fréquence en hertz. Inventer une unité aurait
été plus commode à lire et faux une fois sur cinq.

Les douze exercices et la montée de charge ne sont pas ici : ils sont dans le
plan du lot zéro, avec le défaut n° 7 et le barème de charge.
