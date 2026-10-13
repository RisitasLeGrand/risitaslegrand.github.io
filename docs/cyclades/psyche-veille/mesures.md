# Veille du rythme de vie — ce que la mesure a dit

**13 octobre 2026.** Phase 4. Tous les chiffres de ce document sortent de
`npm run veille:faux-signaux` et des balayages qui l'ont accompagné : vies
synthétiques sur cinq ans, huit à dix graines, parcours séquentiel jour par
jour avec la cadence réelle.

---

## 0. Une erreur de mesure, trouvée en relisant un chiffre

La première version de ce relevé éprouvait la détection sur une dégradation de
**quatre** planchers, et rapportait un délai médian de **quatre cent soixante-dix
jours** sur une dégradation commencée au jour quatre cents. Le chiffre aurait dû
sauter aux yeux : ce n'étaient pas des détections tardives, c'étaient des
signaux qui seraient arrivés de toute façon, comptés à tort comme des succès.

L'épreuve porte désormais sur six planchers — l'ampleur à laquelle le
dispositif dit réellement quelque chose — et ne compte une détection que dans
les cent vingt jours. Les chiffres de la section 5 sont ceux-là.

## 1. Ce que « faux signal » veut dire ici, et ce qu'il ne veut pas dire

Une **vie stable** est une vie sans tendance ni rupture. Elle a des semaines
meilleures et des semaines pires, des week-ends différents des mardis, des
nuits ratées, et des jours où rien n'est noté — mais rien ne s'y dégrade. Tout
signal levé sur une telle vie est donc faux **par construction**, et c'est la
seule définition de « faux » dont on dispose : il n'existe aucune vérité
terrain.

Ces chiffres ne sont **ni une sensibilité ni une spécificité**. Ils disent une
chose, utile et limitée : à quelle fréquence quelqu'un dont rien ne va mal
serait dérangé, et si une dégradation franche finit par se voir.

### Le piège évité

Mesurer sur du bruit blanc n'aurait rien mesuré. Le bruit indépendant se
moyenne : la médiane d'une fenêtre de trois semaines en est presque toujours
proche de zéro, et le dispositif aurait paru d'une spécificité parfaite. Les
vies synthétiques portent donc une composante **autocorrélée** — une mauvaise
quinzaine existe —, qui est exactement ce que le moteur doit apprendre à ne
pas prendre pour une dégradation.

---

## 2. Le défaut que la mesure a trouvé

Le premier relevé était sans appel : **aux réglages du plan, « Discrète » et
« Standard » ne signalaient rien du tout** — pas même une dégradation franche
sur trois domaines, zéro fois sur dix. Un taux de faux signaux parfait, obtenu
en ne détectant jamais rien.

Le balayage par ampleur a donné la cause. **La ligne de base incluait la
fenêtre qu'on lui comparait.** Quand rien ne déclenchait, elle glissait : la
dégradation y entrait peu à peu, la référence la rejoignait, l'écart
retombait. Le gel était censé l'empêcher — mais il ne s'arme que pendant qu'un
repère est ouvert, et une dégradation lente n'en ouvre jamais. Donc ne gèle
jamais. Donc ne se voit jamais.

Le raisonnement tournait en rond, et personne ne l'aurait vu en relisant :
chacune des deux pièces était juste.

| Réglage Standard | Ampleur nécessaire pour voir quoi que ce soit |
|---|---|
| Avant correctif | **12 planchers** — trois heures de sommeil en moins, toutes les nuits |
| Après correctif | **4 planchers** |

La base s'arrête désormais **une fenêtre avant** le jour jugé, toujours. Le
gel reste utile par-dessus : quand un repère est ouvert, on retient la plus
ancienne des deux dates.

Psyché avait reçu ce correctif en phase 7. Il n'avait pas été reporté ici.

---

## 3. Le second défaut : trois axes qui bougeaient ensemble

Le plan faisait varier le seuil, la fenêtre **et** le nombre de domaines d'un
réglage à l'autre. Deux conséquences, mesurées.

**« Discrète » était aveugle.** Son `k = 4` exigeait quatre domaines ; une
dégradation qui en touche trois ne peut pas en remplir quatre. Elle ne
signalait jamais rien, à aucune ampleur.

**Baisser le seuil ne détectait rien de plus, et coûtait très cher.**

| Seuil | Fenêtre | k | Faux/an | Détections (ampleur 4) |
|---|---|---|---|---|
| 1,5 | 10 j | 3 | **8,85** | 0/6 |
| 1,5 | 14 j | 3 | 7,40 | 0/6 |
| 1,75 | 14 j | 3 | 2,95 | 0/6 |
| 2,0 | 14 j | 3 | 1,20 | 1/6 |

Le résultat est contre-intuitif et mérite d'être retenu : **une sensibilité
plus haute détectait moins.** Les faux signaux partent les premiers, le
silence qui suit chaque réponse les suit, et ce silence masque le vrai signal
quand il arrive. En dessous d'une certaine spécificité, la cadence transforme
la sensibilité en bruit qui cache ce qu'on cherche.

---

## 4. Le balayage qui a tranché

Vies stables et dégradations d'ampleur 4, 6 et 8 planchers, huit graines,
trois ans, cadence réelle.

| Candidat | Faux/an | ampl. 4 | ampl. 6 | ampl. 8 | Délai médian |
|---|---|---|---|---|---|
| **2,5 / 21 j / k=3** | **0,05** | 1/8 | **7/8** | **8/8** | **11 j** |
| 2,5 / 28 j / k=3 | 0,05 | 0/8 | 7/8 | 8/8 | 15 j |
| 3,0 / 21 j / k=3 | 0,00 | 0/8 | 5/8 | 7/8 | 12 j |
| 3,0 / 14 j / k=2 | 0,18 | 1/8 | 5/8 | 6/8 | 7 j |
| 2,5 / 21 j / k=4 | 0,00 | 0/8 | 0/8 | 1/8 | 28 j |
| 2,0 / 21 j / k=3 | 0,45 | 2/8 | 4/8 | 5/8 | 11 j |

**2,5 ÉAM sur 21 jours, trois domaines, domine.** Presque aucun faux signal,
et la meilleure détection — précisément parce que les deux vont ensemble :
moins de faux signaux, moins de silence consommé, donc le vrai signal passe.

Les réglages de fenêtre et de croisement que le plan réservait à « Discrète »
étaient donc les bons. C'est son `k = 4` qui la condamnait.

---

## 5. Les réglages adoptés

Les trois ne font plus varier qu'**une** chose : le seuil.

Mesure finale, dix graines, cinq ans, cadence réelle, dégradation d'épreuve de
six planchers sur trois domaines :

| | Seuil | Faux signaux / an | Dégradation vue | Délai médian |
|---|---|---|---|---|
| Discrète | 3,0 ÉAM | **0,00** | 6 / 10 | 17 j |
| **Standard** (défaut) | **2,5 ÉAM** | **0,04** | **8 / 10** | 14 j |
| Attentive | 2,0 ÉAM | 0,46 | 5 / 10 | 10 j |

Fenêtre de 21 jours et croisement de 3 domaines pour les trois.

**« Attentive » détecte moins que « Standard »**, en dérangeant dix fois plus.
Le résultat n'est pas une anomalie de mesure : c'est l'effet de masquage
décrit plus haut, vérifié cette fois sur les réglages retenus. Elle repère en
revanche plus vite quand elle repère — dix jours contre quatorze —, et c'est
la seule chose qu'on puisse honnêtement mettre à son crédit.

Un réglage offert à quelqu'un doit se décrire en une phrase. Trois axes qui
bougent ensemble ne se décrivent pas — et l'un d'eux était aveugle sans que
personne s'en aperçoive. `controlerMoteur()` refuse désormais que la fenêtre
ou le croisement diffèrent d'un réglage à l'autre.

### Ce que l'écran doit dire, et qu'il dit

« Attentive » signale plus souvent sur une vie stable **sans** mieux repérer
une vraie dégradation : à l'ampleur 8, elle en voit 5 sur 8 là où Standard en
voit 8 sur 8. Quelqu'un qui la choisit doit le savoir, et l'écran « À propos »
le porte. Une case « plus sensible » qui rend le dispositif moins utile serait
un piège.

---

## 6. La cible du plan, et où l'on en est

Le plan visait **au plus un signal par an** sur une vie stable. Mesuré :
**0,04 par an** au réglage par défaut, soit un signal tous les vingt-cinq ans.
La cible est tenue très largement — ce qui pose la question inverse, celle de
savoir si le dispositif n'est pas trop discret. La dégradation d'épreuve, elle,
est vue huit fois sur dix en quatorze jours, ce qui rassure sans trancher.

La réponse honnête est qu'on ne peut pas la trancher ici. Une dégradation de
six planchers est vue sept fois sur huit en onze jours ; une dégradation de
quatre planchers passe presque toujours inaperçue. Savoir laquelle des deux
ressemble à ce qui arrive dans une vraie vie demanderait une vérité terrain
qui n'existe pas. Le **mode rejeu** sur l'historique réel est le seul moyen
d'évaluation disponible, et c'est pour cela qu'il est au programme.

---

## 7. Le rejeu, et ce que deux appareils peuvent comparer

Ajoutés après la mesure, et pour la prolonger.

### Le rejeu

Dérouler l'historique réel jour après jour, avec les trois réglages, et voir ce
que la veille **aurait dit**. Le parcours est séquentiel et emploie le tour de
veille réel, pas une copie : la base figée, le silence après réponse et la
règle du repère unique dépendent tous de l'état laissé par la veille, et une
copie aurait dérivé au premier changement de cadence.

Il n'écrit rien — ni repère, ni réglage, ni `evalueeLe`. Un essai navigateur le
vérifie en comparant le statut affiché avant et après : si le rejeu écrivait
quoi que ce soit, il deviendrait une façon détournée de recevoir des cartes en
retard.

Les quatre-vingt-quatre premiers jours sont écartés. En deçà la veille répond
« données insuffisantes », ce qui est le bon comportement mais ne dit rien ;
les compter comme observés ferait croire à un dispositif plus discret qu'il
n'est.

**Ce que le rejeu a donné à ce jour : rien.** Cette installation ne porte aucun
historique de veille. L'instrument est éprouvé sur les vies synthétiques — une
vie stable de trois ans ne lève aucun repère au réglage par défaut, une
dégradation de huit planchers au jour 400 est vue le treizième jour —, mais la
lecture sur données réelles, celle que la section 6 appelait, attend d'avoir de
quoi se faire.

### Deux appareils

La veille ne se synchronise pas : ses trois magasins ne sont pas journalisés,
et chaque appareil calcule chez lui. Ce qui les rapproche, ce sont leurs
**sources**, qui voyagent — à une exception près, délibérée : le journal
d'usage. Les cinq indicateurs du domaine `rythme` en dérivent, et deux
appareils ne peuvent donc pas s'y accorder.

D'où une comparaison en deux temps, qui ne demande aucun jugement :

| Ce qu'on rejoue | Ce qu'une divergence signifie |
|---|---|
| La part qui voyage | **Un défaut.** Sans exception et sans interprétation. |
| Tout | Le prix du journal d'usage, constaté au lieu d'être déduit. |

L'écran affiche l'empreinte de la première, en seize signes et quatre groupes,
comme celle des journaux : deux appareils synchronisés doivent afficher la
même, et ce qui en est écarté est nommé sous elle.

Les propriétés éprouvées, chacune par un essai qui échouerait si elle tombait :
l'ordre des indicateurs dans l'objet ne change rien, l'ordre des jours à
l'intérieur d'une série non plus, et le fuseau horaire du processus non plus —
avec une canarie qui vérifie d'abord que le fuseau a bien changé, sans quoi
l'essai n'éprouverait rien.

### La synthèse médecin

La carte dit « en parler à votre médecin peut être utile ». Ce document existe
pour que la phrase soit suivable : sept sections, composées à la demande, non
conservées, et qui portent leurs dénégations en propre — ne dépiste rien, ne
diagnostique rien, ni sensibilité ni spécificité, l'absence de repère ne
signifie pas que tout va bien.

Il porte des chiffres, que la carte interdit. C'est le même raisonnement
appliqué à deux lecteurs, et un essai le dit explicitement pour qu'on ne le
prenne pas pour un oubli.

Il ne contient ni auto-évaluation, ni score d'échelle, ni intitulé de note, de
tâche ou de repas — et il dit lesquels, parce qu'un lecteur qui ignore ce qui a
été tu suppose que tout y est.
