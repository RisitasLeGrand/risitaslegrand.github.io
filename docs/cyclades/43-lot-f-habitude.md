# Prompt 43, lot F — « Habitude sans pression »

**Établi le 19 octobre 2026, branche `claude/p43-f`, partie de `origin/main`
à `a89105f`.**

## En tête : ce que le lot a appris, et qui n'était écrit nulle part

**Une lecture en panne affirmait qu'il n'y avait rien.** Le centre de
notifications rattrapait l'échec de lecture en rendant une liste vide, et la
suite du rendu faisait ce qu'elle fait d'une liste vide : « Rien à signaler ».
Au moment précis où le site venait de perdre le moyen de savoir, il affirmait.
Une question à trancher pouvait attendre là sans que personne l'apprenne.

**La moitié de F5 était déjà faite, et pas là où l'audit la cherchait.** Le
tableau de bord ne comptait plus les cartes neuves depuis un lot antérieur, et
le commentaire du code l'expliquait. Le défaut ne restait que sur l'écran des
cartes. Mesuré avant d'écrire une ligne.

**Deux barèmes d'XP coexistaient sans le savoir.** L'écran payait la note, et le
moteur qui REPREND l'XP la payait aussi — avec les mêmes chiffres, donc
personne ne l'avait vu. Rendre l'un plat sans l'autre aurait fait contredire le
total repris par le total gagné.

## Ce que chaque point est devenu

| Point | État | Ce qui a été fait |
|---|---|---|
| **F1** | fait | Les deux bandeaux de pression retirés, et « en péril » retiré du calcul avec eux : le champ ne servait qu'à presser. |
| **F2** | fait | « Afficher la série et l'XP », allumé par défaut, dans Paramètres > Affichage. |
| **F3** | fait | Un jour de grâce par semaine, et la règle écrite sous le compteur. |
| **F4** | fait | XP égale pour les quatre notes ; une fiche lue ne vaut plus la maîtrise ; une ligne définit chaque bouton. |
| **F5** | fait, la moitié l'était déjà | « À revoir aujourd'hui », « en retard » à part, et la proposition au-delà de cent. |
| **F6** | **moitié faite, moitié déléguée** | L'accueil est fait. `profil.astro` revient à l'agent C, qui refait ce fichier : un fichier ne vit que sur une branche à la fois. Arbitré par le pilote. |
| **F7** | **laissé au constructeur** | La permission de notification déclenchée par « Certifier » (`appareils.astro:1311-1324`) relève de la synchronisation. `appareils.astro` n'est pas touché. |
| **F8** | fait | Une lecture en panne se dit, avec « Réessayer ». |

## Les décisions que j'ai prises, et pourquoi

**F2 — ce que l'interrupteur ne masque pas.** La grille de régularité reste :
elle dit ce qu'on a travaillé, pas ce qu'on a marqué ; seul le chiffre sort de
son infobulle et de sa légende. La confirmation d'une action reste : « Fiche
terminée » est un fait, pas une récompense. Et **« D'où vient mon XP », sur les
statistiques, reste visible** : c'est l'outil qui reprend le calcul quand il a
dérivé, et le cacher laisserait une personne devant un total faux sans moyen de
le corriger. Le pilote l'a accepté ; je le redis ici pour que ce soit visible.

**F3 — pas de migration, donc pas de schéma.** Le jour de grâce est un champ
facultatif du profil. Un profil écrit avant ce lot ne l'a pas ; il vaut alors
« jamais utilisée », ce qui est exactement la vérité. Aucune donnée réécrite,
aucun schéma levé. À la fusion d'une sauvegarde, c'est le jour **le plus
récent** qui est gardé : prendre l'autre offrirait deux oublis par semaine à qui
importe un fichier.

**F4 — cinq points, et pas sept ni trois.** C'est l'ancienne valeur de
« Correct » : ni l'inflation du maximum ni la déflation du minimum, de sorte
qu'un total d'hier et un total d'aujourd'hui restent comparables. Aucune XP
déjà gagnée n'est recalculée ni retirée ; **seul le calcul change**, et le
moteur de reprise suit la même règle, sous peine de tenir deux barèmes.

**F4 — ce que « lire n'est pas maîtriser » laisse debout.** La lecture compte
encore là où il n'y a RIEN à éprouver — ni carte, ni quiz —, parce qu'une telle
fiche resterait sinon à zéro pour toujours, ce qui n'est pas plus vrai.

**F5 — deux comptes disjoints.** Une carte attendue hier est **en retard**, pas
« à revoir aujourd'hui ». Les additionner redonne les exigibles ; les séparer
dit laquelle des deux dettes on regarde.

## Ce que les essais m'ont appris contre moi

**Un essai peut être vert des deux côtés, et ne rien prouver.** Deux fois dans
ce lot. « Série en cours » était cherché avec sa majuscule, alors que la classe
« etiquette » met ses intitulés en capitales et qu'`innerText` rend la casse
appliquée par le style. Et le soulignement de « Non » n'existait qu'au survol,
donc la propriété calculée au repos valait « none ». Les deux ont été trouvés
en mesurant l'essai **sur la construction d'avant** — jamais en le relisant.

**Un clic qui n'atteint rien laisse l'essai continuer.** La bibliothèque range
ses fiches dans deux dépliants imbriqués ; le lien existait dans le document
mais mesurait 0 × 0. Le clic expirait en silence, l'essai restait sur l'écran
de la bibliothèque, et le contrôle suivant passait au vert sans qu'aucune fiche
ait été marquée lue. La prémisse manquait : elle est là maintenant.

**« isHidden » rend vrai sur un élément absent.** Le contrôle « la carte est
retirée » aurait été vert sur une page qui n'aurait jamais porté cette carte.
Il est doublé du compte.

**Et le plancher de 44 px ne s'applique qu'au doigt.** Sous « pointer: coarse »,
donc avec `hasTouch`. Sans lui, l'essai rougissait sur un bouton parfaitement
conforme : c'était l'essai qui avait tort.

## Un défaut d'outillage que je signale plutôt que de le corriger ici

**`essais:typographie` ne voit pas les textes construits dans un script.** Il
relève les « (s) » du site servi ; or `question(s) à trancher`,
`fiche(s) lue(s)`, `carte(s) à revoir`, `facile(s)`, `correct(s)`,
`difficile(s)` et `oublié(s)` étaient tous écrits dans du code client, et tous
invisibles pour lui. Je les ai accordés au passage, dans les fichiers que ce
lot touchait déjà. Il en reste ailleurs, et l'essai ne les verra pas non plus.

## Deux essais que ce lot rend caducs, et un rouge qui n'est pas à lui

Ni l'un ni l'autre n'est assoupli : c'est la formule du site qui a changé, et
ce sont les essais qui la suivent.

**`essais:activite:navigateur`** épinglait « 12 pour les deux cartes (5 + 7) »,
donc 140 d'XP recalculée, un niveau, une ventilation et une répartition au
prorata. Le barème étant devenu plat, les deux cartes valent 10 et le total
138. L'arithmétique est refaite à la main : 38 + 24 + 10 + 30 + 36.

**`essais:flashcards`** regardait « #nb-dues » pour vérifier que les compteurs
se remplissent sans déchiffrer une fiche. Ce compteur dit maintenant « à revoir
aujourd'hui », et vaut zéro sur une base qui n'a jamais rien révisé. L'essai
regarde « jamais révisées » ; ce qu'il mesure n'a pas bougé. Au passage, son
assertion « la session compte bien vingt cartes » était écrite en dur et fausse
partout où la banque en compte moins : ce conteneur n'en a que treize, et le
compteur affiche « 1/13 ». Elle se mesure désormais contre ce qui est offert.

**Et un rouge que je laisse, parce qu'il n'est pas du lot :**
`essais:niveau:navigateur` attend une matière « Économie » que l'échantillon de
`content/` de ce conteneur ne contient pas. Il échoue sur sa prémisse, avant
d'atteindre quoi que ce soit que ce lot modifie.

## Mesures

**Socle complet : 16 verts, 0 rouge (11 min)**, sur la construction de
`e9bda9b`. Les trois commits qui ont suivi ne touchent que `scripts/` — le site
mesuré est celui de la tête.

`essais:centre-panne` — créé par ce lot : 16 contrôles, rouge quatre fois sur la
construction d'avant. `essais:habitude:navigateur` — créé par ce lot : 56
contrôles, F1 à F6, rouge **trente-six fois** sur les constructions d'avant,
point par point (F1 : 5, F3 : 3, F2 : 10, F4 : 7, F5 : 6, F6 : 5). Chaque point
a été mesuré AVANT et APRÈS, sur sa propre construction.

Repassés verts dans le périmètre touché : `essais:srs`, `essais:niveau`,
`essais:flashcards`, `essais:centre:navigateur`, `essais:centre-m14`,
`essais:centre-donnees`, `essais:centre-modele`, `essais:centre-recalcul`,
`essais:reglages-orphelins`, `essais:reglages-sans-coffre`,
`essais:activite:navigateur`.

`astro check` : 0 erreur, 0 avertissement.

## Les captures

Prises **avant le premier changement**, comme demandé : 48 images, 8 écrans aux
trois largeurs du 41 et dans les deux modes, dans `audit/captures/prompt-43-f/
avant/` — hors du dépôt. Les captures d'après sont au même format, dans
`apres/`. Un contrôle de débordement accompagne chaque prise.

Le semis est synthétique et n'écrit que dans le magasin « etat » : deux
profils, parce que les deux bandeaux que F1 retire s'excluent l'un l'autre.
Deux écrans sont révélés à la main et l'image le dit par son nom — la
proposition de l'accueil ne paraît qu'une fois par semaine au plus.

**La prémisse du script était fausse pour l'après**, et les six premières
prises l'ont dit : il exigeait le bandeau de pression à chaque capture, ce qui
était juste avant le lot et faux après. Ce qui vaut des deux côtés est que le
semis ait pris — la série de sept jours à l'écran. Le bandeau est maintenant
exigé avant et **interdit après** : ces captures sont devenues une mesure, et
plus seulement une image.
