# Les anomalies connues

`scripts/batterie.mjs` renvoie à ce document deux fois : dans son commentaire
d'en-tête — « la comparaison au tableau des anomalies reste un geste humain » —
et dans sa sortie, dès qu'il nomme un rouge :

> À comparer au tableau des anomalies avant toute poussée : un rouge qui n'y
> figure pas est un rouge NOUVEAU, et il se corrige avant de pousser.

**Ce document n'existait pas.** La batterie renvoyait donc, depuis sa première
version, à une table que personne n'avait écrite — et son conseil était
inapplicable : faute de table, tout rouge est « nouveau », ou aucun ne l'est,
selon ce dont on se souvient. C'est la même faute qu'un libellé de socle qui
promet un garde-fou absent : on le lit, on le croit, et l'on cherche ailleurs.
Créé le 31 octobre 2026 par l'agent A, à la demande du pilote.

## Comment s'en servir

1. Un rouge **inscrit ici** se compare à sa ligne : même essai, mêmes
   assertions, même cause ? Alors il est connu, et la poussée peut se faire.
2. Un rouge **absent d'ici** est nouveau. Il se corrige avant de pousser, ou
   il s'inscrit ici avec sa cause mesurée — jamais supposée.
3. Une ligne dont la cause a disparu **se retire**. Une table qui ne se vide
   jamais finit par autoriser tout.

**Aucune ligne ne vaut sans sa mesure.** « Celui-là est connu rouge » n'est pas
une cause ; « rouge à l'identique sur `origin/main`, trois assertions nommées »
en est une. Une ligne sans mesure est une permission de ne pas regarder.

## Les rouges connus

**Ce titre ne porte plus de compte, et c'est une leçon payée deux fois.** Il
disait « AUCUN au 1er novembre », puis « UN » : le second a provoqué un conflit
de fusion dès qu'une entrée est arrivée d'ailleurs, et le compte était faux
avant même d'être relu. C'est exactement ce que l'en-tête de `batterie.mjs`
raconte de ses deux nombres périmés. Le compte, c'est la liste qui le donne.

Les trois entrées qu'a portées ce tableau le 31 octobre en sont toutes sorties,
et chacune pour la même raison. Elles sont gardées plus bas plutôt qu'effacées,
parce qu'un tableau qui ne montre que son état courant ne dit pas comment il
s'est trompé.

### `essais:mots-cog` — cinq rouges, et ils sont ANTÉRIEURS à tout le chantier

Cinq rouges, tous dans `src/features/quad-n-back/composants/QuadNBack.svelte`,
aux lignes 1062, 1213, 1217, 1239 et 1243 :

| ligne | ce que l'essai reproche |
|---|---|
| 1062 | « interférence » sans « presque juste » — `libelle="le taux d’interférence"` |
| 1213 | « seuil » sans sa glose — `id="seuil-montee"` |
| 1217 | « seuil » sans sa glose — `libelle="le seuil de montée"` |
| 1239 | « seuil » sans sa glose — `id="seuil-descente"` |
| 1243 | « seuil » sans sa glose — `libelle="le seuil de descente"` |

La glose attendue pour « seuil » est « le plus petit écart que vous
distinguez ». L'essai relève en outre, en jaune et non en rouge, six noms de
type de question portant un terme technique, couverts par une exception motivée
dont la décision est remontée au pilote.

**La mesure, et elle est double.** Relevé par l'agent A le 1er novembre sur
`claude/a-p63-l1` : cinq rouges, aux cinq lignes ci-dessus. Relevé
indépendamment par le constructeur dans un arbre détaché à `ec1843bd` — donc
avant sa série de fusions — **et** sur `main` : les mêmes cinq, finding pour
finding, aux numéros de ligne près. Ni la branche de A, ni celle de B, ni la
série de fusions n'en est la cause.

Le constructeur avait d'abord soupçonné le `CurseurRegle` de l'agent C pour les
deux « libelle= » ; c'était faux, et c'est le compte identique des deux côtés
qui l'a dit. Une cause supposée aurait fait chercher au mauvais endroit.

**Ce qui reste à faire, et par qui.** Les cinq gloses sont confiées à l'agent C
par le pilote, avec la ligne de chacune.

**Et pourquoi cet essai n'est PAS au socle.** Il n'y a aucune raison de fond de
l'en tenir dehors : c'est un balayage de source, sans navigateur ni aperçu, et
il coûte peu. Mais il rougirait cinq fois, et inscrire au socle un rouge connu
est exactement ce que ce tableau sert à éviter — un socle qu'on prend
l'habitude de voir rouge ne garde plus rien. Il entre quand les cinq gloses
sont sur `main`. C'est la règle qu'on a déjà appliquée à
`essais:essais-branches`, inscrit seulement une fois ses huit orphelins
branchés.


### `essais:centre-m14` — RETIRÉ le 1er novembre : c'était un faux rouge

Cette entrée a existé moins de quatre heures, et sa correction vaut mieux que
son contenu.

Elle portait trois assertions rouges, mesurées par l'agent B « à l'identique
sur `origin/main` ». Je l'avais inscrite en disant, en toutes lettres, que je
ne l'avais pas rejouée moi-même — c'était la bonne précaution, et elle a servi.

**Le constructeur l'a mesuré VERT deux fois** : sur `main` reconstruit, et à
`06038b1` lui-même dans un arbre détaché. La cause du rouge n'était pas dans le
dépôt : l'aperçu servait un `dist/` **périmé**. C'est le même piège qui a pris
trois d'entre nous le même jour.

Rien ne reste donc dans ce tableau au titre de `centre-m14`. Ce qui reste est la
règle ci-dessous, qui est la vraie leçon.

### Et deux entrées qui n'ont jamais eu à être écrites

`essais:sauvegarde-confirmee` et `essais:restauration-atomique` étaient rouges
sur `main`, et B me les avait signalés comme indépendants de ses changements.
C'était faux, et B l'a corrigé de lui-même : son propre lot B1 avait remplacé
une forme parenthésée par l'accord juste, et les deux essais attendaient le
littéral d'avant — l'ancienne forme, celle que le lot 9 retire partout. Le constructeur les a corrigés sur `main` en `63a45ae` **sans
assouplir les motifs**.

Je ne les avais pas inscrits — faute d'avoir mesuré moi-même. Cette abstention
est la seule raison pour laquelle ce tableau ne porte pas deux lignes de plus
qui auraient dû en sortir.

## Les essais INSTABLES, ce qui est pire qu'un essai rouge

Un rouge se compare à ce tableau. Un essai dont les rouges CHANGENT d'un
passage à l'autre ne se compare à rien : celui qui le lance juste après avoir
modifié quelque chose l'attribuera à sa modification, et cherchera des heures
dans un diff qui n'y est pour rien. C'est arrivé le 1er novembre, et la mesure
ci-dessous est ce qui l'a arrêté.

### `essais:cog:navigateur` — il donnait entre un et six rouges, sur n'importe quel arbre

Relevé le 1er novembre. L'essai a été joué **trois fois sur chaque arbre**, le
même, avec deux `dist/` distincts servis en parallèle — ma branche sur le port
4321, `origin/main` à 908032c dans un arbre détaché sur le port 4322 :

| passage | `claude/a-p63-l1` | `origin/main` |
|---|---|---|
| 1 | 2 rouges | 3 rouges |
| 2 | 6 rouges | 1 rouge |
| 3 | 4 rouges | 6 rouges |

Les libellés sont les mêmes des deux côtés, et ils tournent : « Mémoire de
travail · téléphone · clair », puis « · sombre », puis « Raisonnement
relationnel · ordinateur · clair »… Et la grandeur mesurée change à chaque
passage pour le MÊME écran : 940, 960, 1004, 1058, 1082 puis 1112 px de hauteur
de zone de jeu.

**La cause est là.** L'essai mesure si la zone de jeu tient dans la fenêtre. Or
la hauteur de cette zone dépend de la question TIRÉE AU HASARD : un énoncé long
déborde, un court passe. L'essai confronte donc une page de taille aléatoire à
une fenêtre fixe, et son verdict est un tirage. Les « haut à -194 px » sont la
seconde moitié du même problème : la zone est alors hors écran vers le haut,
c'est-à-dire mesurée avant que la mise en page se soit posée.

**Ce qui n'est PAS la cause** : aucune des assertions de « Correspondance
perceptive » n'échoue, dans aucun des six passages. Les deux écrans concernés
sont « Mémoire de travail » et « Raisonnement relationnel ».

Cet essai n'est pas au socle, et c'est pour cela que son instabilité a vécu
jusqu'ici sans être vue. **Il ne doit pas y entrer tant qu'il est instable** :
un socle qui rougit au hasard ne garde rien, et apprend à ne plus le lire.

Ce qu'il faudrait pour le réparer, à confier à qui tient ces deux écrans :
soit fixer la question tirée pendant la mesure — une graine —, soit mesurer
une page dont le contenu est borné, soit laisser la mise en page se poser avant
de lire la hauteur. La troisième seule ne suffirait pas : elle corrigerait les
« -194 px » et laisserait le tirage.

### `essais:cog:navigateur` — RÉSOLU le 1er novembre

L'entrée ci-dessus garde la forme ; celle-ci dit ce qu'il a fallu. Quatre
causes, et non une : l'attente de l'essai rendait la main en pleine descente,
l'essai visait un haut de zéro là où la page impose un décalage, l'écran visait
zéro lui aussi — ce qui lui coûtait 822 ms avant la première épreuve sur un
téléphone court —, et il n'avait aucun signal disant que la position était
atteinte. Plus un cinquième défaut, que la graine a découvert : « la zone
tient » se mesurait sur la fenêtre entière et non sous l'en-tête.

Six passages rendent désormais le même verdict, et le même texte au caractère
près — la durée mesurée étant dite au dixième de seconde, parce qu'une lecture
d'horloge ne peut pas être identique et qu'une ligne qui change de dix
millisecondes apprend à ignorer les écarts.

### `essais:parametres-navigateur` — vert, puis rouge, sur le même code

Trouvé le 1er novembre en mesurant les conséquences d'un autre lot. Première
mesure : deux passages de suite sur le MÊME commit, le premier vert, le second
rouge sur « `#sport` amène la section dans l'écran ».

**Cette première mesure ne valait rien, et je le dis parce que la seconde la
confirme.** Elle a été prise pendant qu'une AUTRE batterie de navigateur
tournait sur le même aperçu — une tâche de fond que j'avais laissée courir. Deux
navigateurs qui se disputent la même machine suffisent à faire varier une
mesure de position, et j'aurais conclu d'une contention que j'avais créée.

Rejoué SEUL, trois passages : rouge, rouge, vert. L'instabilité est donc bien
dans l'essai, et non dans la façon de le mesurer.

L'assertion accepte un haut entre -50 et 400 px, et le décalage que la page
impose vaut 111 : elle devrait passer. L'attente de cet essai est d'ailleurs
MEILLEURE que celle qui rendait `essais:cog:navigateur` instable — elle écoute
« scrollend » ET exige dix trames immobiles. La cause est donc ailleurs, et je
ne l'ai pas cherchée : ce n'est pas mon lot.

**Ce qui est établi**, et c'est ce qui compte pour quiconque le rencontrera :
ce rouge n'appartient pas au lot « claude/a-cog-zone-de-jeu ». Un passage vert
et un passage rouge sur le même code le disent, et les fichiers de ce lot ne
touchent ni l'écran Paramètres ni son attente de défilement, qui est locale à
son essai.

Cet essai n'est pas au socle. C'est, comme pour `essais:cog:navigateur`, la
raison pour laquelle son instabilité a vécu sans être vue.

## Deux manières de mesurer qui rendent zéro

Ce tableau liste des rouges. Ces deux lignes-ci listent le contraire : des
VERTS qui ne valaient rien. Elles y sont parce qu'un vert faux coûte plus cher
qu'un rouge connu — le rouge se regarde, le vert se croit.

### Deux passages qui se recouvrent rendent un rouge qui n'existe pas

Le 1er novembre, deux passages de mesure ont tourné en même temps sur le même
aperçu, parce que j'avais laissé le premier en tâche de fond. Deux
conséquences, et la seconde est pire.

La première : deux navigateurs se disputent la machine, et toute mesure de
position ou de durée en pâtit. J'ai cru à une instabilité d'essai que j'avais
créée moi-même ; il a fallu rejouer seul pour savoir que l'instabilité était
réelle, ce qui est un coup de chance et non une méthode.

La seconde : chacun des deux passages efface `.env.local` en finissant, comme
le protocole l'exige. Le premier à finir l'a donc retiré SOUS les pieds du
second, dont les six passages suivants ont tous rendu **le code 2 — « mot de
passe absent »**. Six codes non nuls d'affilée, qui ressemblent trait pour
trait à six rouges, et qui ne mesuraient rien du tout. C'est le piège que le
constructeur avait signalé pour les arbres détachés, et il se produit aussi
chez soi.

La règle : **un seul passage de navigateur à la fois.** Avant d'en lancer un,
vérifier qu'aucun autre ne tourne — et devant un code 2, chercher le mot de
passe avant de chercher un défaut.

### Le périmètre d'une mesure doit suivre celui du changement

Le 1er novembre, l'agent A a porté la grille de dessin de Veridical Mapping de
120 à 1001 points, puis mesuré le socle : 43 verts, 0 rouge, et poussé.
`essais:correction` n'est pas au socle. Il portait une fixture écrite en pas de
l'ancienne grille — « les rangs 2 et 118 sont voisins sur la teinte » —, juste
sur 120 points et fausse sur 1001. **La poussée est donc partie avec un rouge**,
et le socle vert n'avait rien de faux : il ne couvrait simplement pas ce que le
changement touchait.

La règle qui en sort : quand un changement porte sur une constante PARTAGÉE, la
mesure se choisit d'après ce qui l'importe — ici, tous les essais qui importent
le module —, et non d'après la liste qu'on a l'habitude de lancer.

### Une garde qui se mesure à elle-même rend toujours zéro

Même jour, même lot. Un balayage vérifiait qu'aucun fichier ne nommait plus
l'ancien nom d'une tâche, et comptait les fichiers lus :

    verifier('les cinq fichiers ont été lus', lus, FICHIERS.length);

Retirer un fichier de `FICHIERS` retirait aussi l'attendu. Le contrôle restait
VERT en ayant cessé de balayer ce fichier — mesuré par sabotage, et c'est le
seul des sept de cette série qui n'a pas mordu. Le compte va désormais à un
littéral, et les quatre fichiers qui portent la tâche sont nommés un par un,
pour que le rouge dise LEQUEL manque.

C'est la troisième forme du même défaut rencontrée sur ce prompt, après la
virgule finale qui vidait un argument et l'exclusion qui ne portait sur rien.
Un analyseur cassé ne lève pas : il rend ZÉRO — et zéro est ce que rend un
dépôt propre.

## La règle qui aurait évité les trois faux rouges du 31 octobre

**Un rouge mesuré pendant qu'un autre agent construit n'est pas un rouge.**

`astro preview` sert le site **déjà construit**. Un essai de navigateur mesure
donc ce qu'il y a dans `dist/`, et non ce qu'il y a dans `src/`. Trois
conséquences, chacune constatée le 31 octobre :

1. **un sabotage de la source non reconstruit ne sabote rien**, et passe vert —
   ce qui se lit comme la preuve qu'il n'y avait rien à trouver ;
2. **un changement de branche sans reconstruction** fait mesurer l'autre
   branche. B a joué un socle de treize minutes à cheval sur deux arbres : 38
   essais sur l'un, 5 sur l'autre, et « cinq rouges » qu'il a failli remonter
   comme des défauts de son lot ;
3. **une reconstruction PENDANT une course** change le site sous les pieds de
   l'essai en train de le mesurer.

Le contrôle préalable de la batterie ne voyait rien de tout cela : il sondait
`robots.txt`, donc il répondait à « quelque chose écoute-t-il sur ce port » et
jamais à « est-ce bien MON site ». **L'avertissement existait, en prose, juste
au-dessus.** Une mise en garde qui n'est pas mesurée ne garde rien.

B l'a corrigé — `claude/b-apercu-temoin`, commit `90d563f` : la batterie compare
l'empreinte de `dist/index.html` sur le disque à celle de « / » servi, refuse de
mesurer si l'aperçu sert un autre arbre, et reprend l'empreinte à l'arrivée. Si
l'arbre bascule en cours de course, le récapitulatif n'est plus un verdict mais
**« MESURE NULLE »**, le renvoi à ce tableau est retiré, et le code de sortie
vaut 1. Sept sabotages le gardent, dont un aperçu factice qui bascule en pleine
course.

**Avant d'inscrire un rouge ici**, donc : reconstruire, vérifier que l'aperçu
sert bien cet arbre, et se demander si un autre agent construisait au même
moment. Les trois faux rouges du 31 octobre auraient tous été évités par la
première de ces trois questions.

## Ce qui est VOULU, et qu'il ne faut pas prendre pour un défaut

Ces lignes ne sont pas des anomalies. Elles sont ici parce qu'elles
ressemblent à des défauts et que quelqu'un, un jour, essaiera de les
« corriger ».

### Aucun rappel de prise n'entre au centre tant que le registre n'est pas classé

**Tant que le registre ne porte aucune classe (contenu, phase C), aucun rappel
de prise n'entre au centre ; c'est voulu (D2).**

`filtre-cycle.ts` déclare `rappel-de-prise` avec `exigeUneClasse`, et le filtre
écarte tout signal dont la classe de molécule est inconnue — option (a),
arbitrée le 19 octobre. La raison n'est pas une prudence de principe : une
molécule dont la classe est inconnue PEUT être liée au cycle, et le centre ne
porte rien qui y touche (interdit 1 n° 3). C'est une fonction en moins, visible,
plutôt qu'une fuite invisible.

Les cinq molécules du catalogue ne portent aucune classe au 31 octobre 2026.
L'infrastructure, elle, est en place et **mesurée** : le champ `classe` et sa
source dans `EntreeRegistre`, le vocabulaire clos de `classes-de-molecules.ts`,
la garde dans `verifier:registre-molecules`, le chemin depuis `sante.astro`, et
les deux issues éprouvées au navigateur sur une entrée de registre d'essai —
classe hors cycle, le rappel paraît ; classe du cycle, il est écarté, avec sa
raison consignée.

Le renseignement des classes depuis les RCP est en phase C, chez l'agent des
fiches. **Ne pas lever `exigeUneClasse` pour faire paraître les rappels** :
cela trancherait à l'envers un arbitrage qui porte sur des données de santé.

#### Comment mesurer soi-même le chemin « admis »

    npm run registre:essai     # écrit la fixture, et REFUSE d'écraser un registre réel
    npm run contenu            # pour qu'elle atteigne le site construit
    npm run essais:sante:navigateur

`essais:sante:navigateur` est valide **dans les deux cas** : il choisit la
molécule d'essai si le menu l'offre, retombe sur une saisie libre sinon, et dit
dans sa sortie laquelle des deux issues il a mesurée — ligne « la molécule du
traitement ». Il n'y a donc aucune préparation à câbler dans la batterie, et
aucun essai qui refuserait faute de fixture.

**La contrepartie est à dire** : sur une machine sans fixture, la batterie ne
mesure que l'issue « écarté ». L'issue « admis » est alors couverte par
`essais:filtre-cycle` (au module, avec sabotage) et par ce passage-ci, à la
main. Pour l'ôter : supprimer `content/sante/molecules.json` et reconstruire.

## Ce qui dépend du conteneur, et non du site

Ces essais-là ne sont pas rouges par la faute du dépôt : ils réclament quelque
chose que le conteneur fournit ou ne fournit pas. Un conteneur neuf peut donc
les faire changer d'avis sans qu'une ligne de code ait bougé, et c'est pour
cela qu'ils sont séparés des rouges ci-dessus.

### `essais:bibliographie:navigateur` — la bibliographie chiffrée manque

`content/bibliographie.bin` est **absent de ce conteneur** : vérifié le
31 octobre, et `find` n'en trouve aucune copie hors de `node_modules`. L'essai
mesure ce que l'écran rend d'une bibliographie déchiffrée ; sans le fichier, il
n'a rien à mesurer. Ce n'est pas un défaut du site, et ce n'est pas un rouge à
corriger dans le code : c'est une donnée de contenu qui ne vit pas dans le
dépôt.

### `essais:fiches-audio` — et une anomalie qui n'en est plus une

`docs/cyclades/cadence-des-essais.md` annonce, depuis le 19 octobre, que cet
essai « réclame `ffmpeg` », que l'outil a été installé à la main dans le
conteneur de ce jour-là, et que l'installation ne survivrait pas à un conteneur
neuf.

**Ce n'est plus vrai.** Mesuré le 31 octobre : `ffmpeg` répond à
`/usr/bin/ffmpeg`, c'est-à-dire à un chemin du système et non à une
installation posée dans un répertoire de travail. Il vient donc de l'image ou
du script de préparation de l'environnement, et il survivra.

Ce qui reste à faire est une vérification et non une correction : **rejouer
`essais:fiches-audio` et dire son verdict**, pour savoir si cette ligne doit
disparaître de ce document ou y prendre une autre forme. Je ne l'ai pas
rejoué, et je ne prétends donc pas qu'il est vert.

## Les essais qui ne tournaient jamais — RÉSOLU le 1er novembre

Un essai rouge se voit. Un essai qu'aucun script `npm` ne nomme **ne tourne
pas du tout**, et son silence se lit comme une absence de défaut. C'est la
même famille que le vert à vide : rien ne lève, donc on croit qu'il n'y a rien
à trouver.

Relevé le 31 octobre 2026 : **346 fichiers d'essai, dont 8 que la batterie ne
joue jamais.**

| fichier | navigateur | verdict mesuré le 31 octobre |
|---|---|---|
| `essais-aucune-empreinte-publiee.mjs` | non | **4 vertes, code nul, 4 s** |
| `essais-enveloppe-du-coffre.mts` | non | **25 vertes, code nul, 3 s** |
| `essais-migration-du-coffre.mts` | non | **16 vertes, code nul, 1 s** |
| `essais-retour.mts` | non | **26 vertes, code nul, 1 s** |
| `essais-verrou-automatique.mts` | non | **20 vertes, code nul, 0 s** |
| `essais-bascule-coffre.mjs` | oui | **14 vertes, code nul, 4 s** |
| `essais-coffre-refus.mjs` | oui | **8 vertes, code nul, 17 s** |
| `essais-verrou-navigateur.mjs` | oui | **5 vertes, code nul, 12 s** |

**Les huit sont verts, et cela fait 118 assertions vertes et muettes.**
Quatre-vingt-onze d'entre elles sont dans les cinq fichiers qui ne demandent
ni navigateur ni aperçu, et qui coûtent **neuf secondes à eux cinq**. Rien ne
s'opposait à leur inscription : personne ne l'avait faite.

Et `essais-verrou-navigateur.mjs` tient en **12 secondes**, donc sous le seuil
de trente que le pilote a fixé : il a sa place au socle, pas seulement en
batterie complète.

**C'EST FAIT**, le 1er novembre : les huit portent leur script `npm`, donc la
batterie complète les joue — elle joue tout ce qui commence par « essais ». Et
`essais:verrou-navigateur` entre au **socle**, pour deux raisons : il tient en
douze secondes, sous le seuil de trente fixé par le pilote, et ce qu'il garde ne
se voit nulle part ailleurs — qu'un coffre laissé seul se REFERME vraiment,
dans un navigateur, et non seulement que la fonction qui doit le refermer
existe. C'est la leçon des créneaux.

Le relevé des orphelins est donc à zéro, et chacune des mesures ci-dessus est
un code de sortie, non un compte de lignes vertes.

### Et le garde-fou qui ne manque plus

Le relevé ci-dessus a été fait à la main, en croisant les fichiers
`scripts/essais-*.m[jt]s` avec les scripts de `package.json`. **Cela devrait
être un balayage de source au socle** : « aucun fichier d'essai sans script
`npm` ». Il coûterait une fraction de seconde et il attraperait le neuvième
orphelin, celui qu'on écrira sans y penser.

**`essais:essais-branches` est écrit, et il est au socle** — quarante-cinquième
ligne, le jour même où les huit ont été branchés. Un balayage qui part d'un
dépôt à zéro est exactement celui qu'il faut écrire : son premier rouge sera le
neuvième orphelin, et non une dette ancienne.

Il s'éprouve dans les deux sens, comme `essais:bornes`, et son premier contrôle
est ce qu'il DOIT voir — sans quoi un balayage qui ne trouve plus rien resterait
vert sur tous les autres. Il refuse, code 2, s'il ne lit aucun fichier ou aucun
script. Et il porte son contre-exemple sur les données réelles : un neuvième
fichier fabriqué, absent du dossier, doit être vu comme non branché par les
commandes réelles.

**Il a trouvé quelque chose à son premier passage** : son propre fichier,
qui n'était pas encore inscrit. C'est le genre de première mesure qui rassure
sur la suite.

À ne pas confondre avec `essais:orphelins`, qui garde l'inverse — un module
livré que nul écran n'appelle. Les deux noms se ressemblent et les deux défauts
sont symétriques : là, du code sans usage ; ici, un contrôle sans passage.
