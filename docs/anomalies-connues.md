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

## Les rouges connus — AUCUN au 1er novembre 2026

Et c'est une information, non une page blanche : les trois entrées qu'a portées
ce tableau le 31 octobre en sont toutes sorties, et chacune pour la même
raison. Elles sont gardées ci-dessous plutôt qu'effacées, parce qu'un tableau
qui ne montre que son état courant ne dit pas comment il s'est trompé.


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
