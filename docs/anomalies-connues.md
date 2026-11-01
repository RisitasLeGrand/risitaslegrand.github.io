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

4. Un essai **rendu vert en affaiblissant sa mesure** n'a rien à faire ici.
   Celui-là n'est pas une anomalie connue, c'est une anomalie CACHÉE : la
   table dirait « plus rien à signaler » là où plus rien n'est regardé.

**Aucune ligne ne vaut sans sa mesure.** « Celui-là est connu rouge » n'est pas
une cause ; « rouge à l'identique sur `origin/main`, trois assertions nommées »
en est une. Une ligne sans mesure est une permission de ne pas regarder.

## Les rouges connus

### `essais:cibles-souris:navigateur` — un module dynamique échoue, une fois sur un balayage

**Vu deux fois, jamais reproduit sur demande.** Inscrit le 1er novembre 2026
par l'agent C.

Ce balayage parcourt soixante-deux routes. Il a rendu
« Failed to fetch dynamically imported module » le 31 octobre
(`notification.iKce5Cl-.js`) et le 1er novembre (`veille.BaboT8Sn.js`) — deux
modules DIFFÉRENTS. Les deux fois le fichier existait dans `dist/` et l'aperçu
le servait en 200, vérifié à la main par le constructeur ; les deux fois
l'essai était vert à la relance. Quatre lancements de plus le 1er novembre :
pas reparu.

**Ce qui a été fait, et ce qui ne l'a pas été.** Aucun correctif : on ne répare
pas ce qu'on ne sait pas reproduire, et le verdict ne change pas — une erreur
de page reste une croix. Ce qui a changé est la PREUVE que l'essai laisse
derrière lui : à la prochaine occurrence il redemande le module à l'aperçu et
note le code obtenu, `200` (« le fichier était là, le transport a lâché ») ou
`404` (« fichier absent de la bâtisse »). Sans cela chaque enquête repart de
zéro, ce qui s'est produit deux fois.

**Ce qui retire cette ligne.** Deux occurrences de plus portant le même code à
la relecture, qui trancheraient entre le transport et la bâtisse.

---

### `essais:parametres-navigateur` — l'ancre `#sport` n'emmène nulle part, une fois sur six

**Mesuré, et la cause est dans l'écran, pas dans l'essai.** Inscrit le
1er novembre 2026 par le constructeur.

L'assertion « `#sport` amène la section dans l'écran » rougit par
intermittence : cinq rouges de suite, puis un vert, sur le même code. Elle est
rouge à `bc02395a`, à `f64a4cdb` et à `7af82285` — donc AVANT les fusions de
branches `src/` du jour, qui n'y sont pour rien. L'essai est hors socle : rien
ne le surveillait.

**Ce que la sonde a relevé**, en faisant imprimer à l'essai ce qu'il lit :

    ancre=11420 puis {"top":11420,"hauteur":761,"defilement":190,"hauteurDoc":15309}

La page a défilé de **190 px**, et la section se trouve à **11 420 px**. Les
deux mesures, prises à cinquante millisecondes d'intervalle, sont identiques :
rien ne bougeait plus, donc `attendreLaFinDuDefilement` a vu juste. **La page
n'a simplement jamais défilé jusqu'à l'ancre.** Sur la course verte, le même
relevé donnait `defilement: 11499`.

**Le mécanisme, lu ensuite.** `src/lib/defilement.ts:242` s'écarte
délibérément quand l'adresse porte une ancre — « Une ancre dans l'adresse a
toujours raison : c'est une position demandée ». Le défilement est donc laissé
au navigateur, qui le fait à l'analyse du document, quand les blocs situés
au-dessus n'ont pas encore reçu leurs commandes et que la page est deux fois
plus courte. Les blocs grandissent ensuite, la section descend, et plus rien ne
repose la position. Le 190 px est le défilement natif vers l'endroit où la
section se trouvait alors.

**Ce n'est pas qu'un défaut d'essai : c'est un défaut d'écran.** Ouvrir
`/parametres/#sport` dépose la personne au mauvais endroit, et l'intermittence
ne fait que suivre l'ordre d'arrivée des commandes. Le correctif de l'ancre du
prompt 43 (`p43-e3-ancres`) traitait un autre point — une ancre qui atterrit
SOUS ce qui est collé en haut — et ne couvre pas la croissance qui suit.

**Et la machinerie du correctif existe déjà, dans ce même module.**
`rendreLaPosition` repose la position à CHAQUE changement de hauteur pendant
une fenêtre de grâce, avec `overflow-anchor: none` et un abandon au premier
geste de la personne. C'est exactement ce dont une ancre a besoin ; elle en est
seulement exclue par le retour anticipé de la ligne 242. Proposition, à
arbitrer par le pilote puisque le lot des ancres n'est pas le mien : traiter la
cible d'une ancre comme une position demandée — donc la reposer de la même
façon — au lieu de s'en remettre au seul défilement natif.

**Ce qui retire cette ligne.** Que l'ancre reste en place après la croissance
de la page, mesuré sur dix courses de suite.

---

## Les rouges connus au 31 octobre — tous retirés le 1er novembre

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

## La règle qui explique l'intermittence du 1er novembre

**Un écran qui annonce son verdict AVANT de repeindre laisse une course
derrière lui, et `travailFini` ne la couvre pas.**

Inscrit le 1er novembre 2026 par le constructeur, après mesure.

`essais:effacement:navigateur` — au socle — a rendu, sur le MÊME code et sans
qu'une ligne de `src/` change entre les courses : vert, rouge, vert, puis vert.
Un code 1 sans croix : le script expirait dans `recompter`, en attendant
« Compté » pendant trente secondes.

**Ce qu'une sonde a dit, là où la lecture du code ne disait rien.** L'essai a
été fait imprimer ce qu'il lisait à l'instant de l'expiration. Le message ne
disait pas « Compté » mais **« Choisissez au moins un domaine. »**, et les
treize cases de domaine étaient **toutes à faux** — dont celle que l'essai
venait de cocher deux lignes plus haut.

**Le mécanisme, lu ensuite à la ligne près.** `appliquerEffacement`
(`src/pages/stockage.astro`) écrit son verdict, notifie, cache le décompte,
puis appelle `rafraichirComptes()`, qui repeint les deux listes de domaines par
`peindreGroupes` — et `peindreGroupes` fait `zone.replaceChildren()`. Les cases
sont donc des éléments NEUFS, décochés, et cette peinture vient **après** le
verdict. `travailFini` rend la main sur le verdict : il ne garantit rien de ce
qui est peint ensuite. L'essai cochait alors une case que la peinture suivante
remplaçait, et le clic sur « Compter » tombait sur le premier garde-fou du
gestionnaire, qui écrit « Choisissez au moins un domaine. » et sort sans jamais
écrire « Compté ». Selon que la peinture arrivait avant ou après le cochage,
l'essai passait ou expirait.

La même cause produit **une seconde forme de rouge**, à une autre ligne et avec
une croix cette fois : un domaine décoché fait répondre « Choisissez au moins
un domaine. » là où l'essai attend la phrase de la période à l'envers.

**Ce qui a été corrigé.** Dans l'essai, et non dans l'écran : une post-condition
en deux moitiés, à trois endroits — on marque le premier enfant de la liste des
domaines AVANT le geste d'effacement, et l'on attend un premier enfant SANS la
marque. Elle ne peut pas être vraie d'avance. Trois sabotages hors du site
prouvent qu'elle expire quand la peinture ne vient pas, qu'elle rend la main
quand elle vient, et qu'elle attend une peinture tardive. Six courses de suite
vertes, là où deux sur quatre rougissaient.

**Ce qui n'est PAS corrigé, et qui reste à arbitrer.** L'écran annonce avant de
peindre. Tant que c'est le cas, `travailFini('#message-effacement')` n'est une
post-condition que du verdict, et tout essai qui touche aux domaines après un
effacement doit attendre la peinture lui-même. Le corriger côté écran — écrire
le verdict en DERNIER, après `rafraichirComptes()` — rendrait `travailFini`
exact partout, mais touche au chemin de l'effacement et ferait dire
« Effacement interrompu » à une peinture qui échoue après un effacement réussi.
Ce n'est pas une correction à faire en passant.

**Et une correction de mon propre compte rendu.** J'avais retiré mon correctif
d'identité (`b7ffc6b7`, retiré par `357f66e2`) en écrivant que son effet de
bord sur cet essai était « déterministe, et de moi ». Il ne l'était pas : deux
rouges avec lui et des verts sans lui étaient un tirage, pas une loi. Le retour
en arrière reste la bonne décision — un correctif dont l'effet n'est pas compris
ne se garde pas — mais la raison avancée était fausse, et la cause réelle est
celle ci-dessus. Le défaut d'identité au retour en arrière, lui, reste réel et
non corrigé : une base semée en 11, migrée en 43, ramenée en 11 par le bouton
puis remigrée change d'identité d'appareil (`7KS3FJFA` puis `TV5T90GB`, mesuré
par sonde).

**Un détail de bibliothèque, pour qui voudra réutiliser la forme.**
`apresLeRemplacement` de `scripts/lib/post-condition.mjs` fait exactement ce
marquage, mais **avale son expiration** (`.catch(() => {})`). Employée comme
post-condition, elle change donc une peinture qui ne vient jamais en trente
secondes d'attente puis en un rouge plus loin, qui ne nomme plus la cause.
C'est pourquoi l'essai de l'effacement écrit l'attente en clair plutôt que de
l'appeler.

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

## Ce qui est SU et n'est pas gardé

Deux choses distinctes de ce qui précède : ce ne sont pas des rouges, et ce
n'est pas voulu non plus. Ce sont des défauts ou des risques connus que
personne ne garde — et la raison de ne pas les garder est aussi importante que
le défaut.

### L'accueil décale sa mise en page de 0,0345 au chargement

**Mesuré, non corrigé.** Relevé le 1er novembre 2026 par l'agent C.

`scripts/essais-logotype-navigateur.mjs` relève, par `PerformanceObserver` sur
les entrées `layout-shift`, un décalage cumulé de **0,0345** au chargement de
l'accueil. Les sources, nommées par le navigateur lui-même :

    UL.grid (0,0303), NAV.mt-10 (0,0303), SPAN.mt-4 (0,0042), LI (0,0042)

C'est la grille des branches. Ce n'est PAS le logotype, qui a exactement la
même géométrie d'une page à l'autre — x 318, y 27, 63,56 × 18 px, mesuré.

**Pourquoi ce n'est pas gardé.** Faire porter ce total au lot du logotype
aurait rendu sa garde rouge en permanence, jusqu'à ce que quelqu'un la
désarme — et une garde qu'on désarme est pire qu'une garde absente. La garde
mesure donc les décalages dont la SOURCE est le logotype, et imprime le total
de la page à côté, pour qu'il ne se perde pas.

**Ce qui retire cette ligne.** Une réserve de place sur la grille des branches,
et un relevé repassé sous 0,01.

### `peindre()` du calendrier : onze appelants sur un état partagé

**Risque NON mesuré.** Signalé le 1er novembre 2026 par l'agent C.

`src/pages/odyssee/calendrier.astro` — `peindre()` est asynchrone, attend deux
fois (les événements, puis les occurrences) avant d'effacer la zone, et écrit
dans `occurrencesAffichees`, qui est au niveau du module. Onze endroits
l'appellent, dont plusieurs en « lance et oublie » (`void peindre()`). Rien ne
garantit que le dessin le plus RÉCENT soit celui qui peint en dernier.

**Ce qui a été mesuré, et ce qu'il dit.** En cherchant la cause de quatre
essais rouges, j'avais posé un compteur de rang pour faire abandonner un dessin
dépassé. L'instrumentation a RÉFUTÉ l'hypothèse : les deux dessins observés ne
se chevauchaient pas, et la cause était ailleurs — le jour logique, voir
`scripts/lib/jour-logique-essais.mjs`. La garde a donc été retirée. Du code non
mesuré, ajouté sur une hypothèse fausse, n'a rien à faire dans le dépôt.

**Ce qui n'est pas su.** Si la course est seulement improbable, ou impossible.
Aucune mesure ne l'a produite, et cette ligne n'autorise personne à la corriger
sur la foi de sa description.

**Ce qui retire cette ligne.** Soit une mesure qui PRODUIT la course — deux
dessins concurrents dont le plus ancien peint en dernier —, et alors un
compteur de rang se justifie et s'éprouve par sabotage ; soit une lecture qui
démontre que les onze chemins ne peuvent pas se chevaucher.

---

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
