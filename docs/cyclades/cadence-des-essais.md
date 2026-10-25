# La cadence des essais — ce qui a changé le 19 octobre

*Pour les agents A, B et C, et pour moi. Deux changements, tous deux
accordés par le pilote le 19 octobre.*

## 1. Le socle contient désormais les balayages de source

Le socle passe de **seize à vingt essais**. Les quatre ajoutés ne demandent
ni navigateur ni aperçu, et coûtent quelques secondes chacun :

| Essai | Ce qu'il refuse de laisser passer |
|---|---|
| `essais:reglages-orphelins` | une clé d'état écrite par le code sans être déclarée, ni au catalogue, ni comme état technique avec sa raison |
| `essais:effacement` | un magasin qu'aucun groupe ne nomme, un magasin sans champ de date déclaré, une description de groupe qui tait un magasin sensible |
| `essais:semis` | un essai qui écrit en base sans déclarer pourquoi |
| `essais:enregistrements` | le registre des magasins journalisés, qui doit être **nommé** et non compté |

**Pourquoi eux, et pourquoi maintenant.** Ce sont exactement ceux qu'une
écriture **nouvelle** fait rougir : une clé qu'on vient d'inventer, un magasin
qu'on vient d'ajouter, un essai qui sème sans le dire. Ils manquaient, et cela
s'est payé le même jour — deux clés d'état non déclarées ont vécu sur `main`
sans qu'un contrôle d'avant-poussée puisse les voir, puisque le socle ne les
contenait pas et que la batterie complète coûte une heure. C'est un agent qui
les a signalées, pas la cadence.

**Ce que cela change pour vous** : votre socle d'avant-poussée dure quelques
secondes de plus, et il vous dira tout de suite si votre magasin ou votre clé
nouvelle manque une déclaration. C'est moins cher que de l'apprendre à la
fusion.

## 2. Cinq essais tournent dans un arbre de travail séparé

`essais:acces-m9`, `essais:lecteur-parties`,
`essais:seances-parties:navigateur`, `essais:parties-client` et
`essais:reperes-audio` bâtissent eux-mêmes un `content/` depuis
`content-exemple/`, avec un mot de passe factice, servent sur le port 4322,
puis effacent tout. Ils **refusent** donc de démarrer si `content/`,
`.env.local` ou `public/data/` existent déjà — c'est-à-dire toujours, dans un
répertoire où le travail se fait.

La batterie les comptait rouges, et la règle « aucun rouge avant de
fusionner » devenait inapplicable. Elle ouvre maintenant un **`git worktree`
détaché** sur le même commit, lie `node_modules` plutôt que de le
réinstaller, y lance ces cinq essais, et le retire à la fin. L'arbre séparé
ne porte aucun des trois fichiers, puisqu'aucun n'est suivi par Git : leurs
gardes sont satisfaites sans qu'on touche à rien.

**Ce qui a été écarté, et pourquoi** : déplacer le `content/` réel pour leur
faire de la place. Ces essais le suppriment en fin de course, il n'est pas
dans Git, et toute perte de donnée réelle est réservée à Alexis.

**Une batterie lancée dans un laboratoire n'en crée pas un second.** Le signe
est que `.git` y est un *fichier* et non un dossier. Une première version
regardait seulement s'il existait : il existe des deux côtés, et la détection
ne détectait rien.

## 3. Quand une attente de navigateur n'attend rien

*Ajouté le 25 octobre, après le rouge intermittent de
`essais:reglages-sans-coffre` sous la batterie.*

Un essai attendait `#decompte:not(.hidden)` après avoir cliqué sur
« Compter », puis lisait `#decompte-detail`. Vert en isolé, rouge sous la
batterie, au même rang à chaque passage. **L'attente était déjà vraie avant le
clic** : la phase précédente avait laissé le panneau visible — il se montre dès
qu'il a un refus à dire — et son détail vide, le détail ne listant que les
magasins non refusés. Le gestionnaire, lui, attend `compter()`, qui lit le
magasin et déchiffre. Pendant cet await, l'essai lisait l'état d'avant.

### Le critère, en deux conditions

Une attente n'est dangereuse que si **les deux** sont réunies :

- **(a)** sa condition était **déjà vraie** avant le geste ;
- **(b)** le gestionnaire **cède la main** — un `await` — avant de peindre.

**Sans (b), il n'y a rien à attraper.** Une peinture synchrone ne peut pas être
surprise à mi-chemin : le navigateur ne rend pas la main entre deux
instructions, et l'observateur de Playwright ne voit l'état qu'une fois la
fonction entière terminée. L'ordre entre « démasquer » et « remplir » n'y
change donc rien — c'est le piège de raisonnement qu'il faut éviter ici, et
dans lequel je suis tombé deux fois avant de mesurer.

### Les deux exemples à garder en tête

**`finances`, synchrone, donc sain.** `peindreApercu` démasque `#apercu` puis
écrit `#verdict` quatre lignes plus bas. L'ordre est « le mauvais », et
pourtant rien n'est observable : la fonction est synchrone. Condition (b)
absente. Ne pas « réparer ».

**`suivi` ligne 627, latent, donc à reprendre quand même.** Les deux conditions
y sont : `#effacer-periode` est déjà visible, la section 8 ayant rempli la même
période pour mesurer la taille du bouton, et le gestionnaire attend
`combienDansLaPeriode` avant d'écrire. Mais un retard de 500 ms injecté laisse
l'ancienne version **au vert** : la section 8 compte la même période aux mêmes
dates, et laisse dans l'annonce exactement la phrase attendue. La lecture
périmée rend la bonne réponse **par construction**. L'assertion ne prouvait
rien sans pour autant mentir, et c'est à ce titre qu'elle a été reprise.

### La parade, et ce qu'elle n'est pas

Ce n'est pas « attendre autre chose dans le même esprit » : n'importe quel état
durable a le même défaut. Il faut une **post-condition qu'aucun passage
antérieur ne peut avoir rendue vraie**. En pratique : effacer soi-même le
message, faire le geste, puis attendre celui que le gestionnaire écrit en
dernier. Et refuser une lecture vide plutôt que de la rendre à une assertion
qui en tirera ce qu'elle peut.

Une temporisation à l'aveugle — `waitForTimeout(400)` — n'est pas une parade :
elle réduit le risque sans le supprimer, et elle cède exactement là où elle
était censée protéger. Celle de l'auxiliaire des créneaux a cédé sous 500 ms.

### Comment reconnaître le motif sans refaire le balayage

Le motif brut — attendre un conteneur, puis lire un texte qu'il porte — donne
**73 occurrences dans 35 essais**, dont presque aucune n'est fautive. Trois
resserrements successifs, chacun sur une classe de faux positifs constatée :

1. compter **par page**, et non par fichier : deux attentes du même sélecteur
   peuvent être sur deux appareils neufs (`A.page` puis `B.page`) ;
2. ne retenir que les occurrences **non premières** : un coffre est fermé au
   chargement, et sa première ouverture est une vraie transition ;
3. écarter celles qu'un `goto`, un contexte neuf ou une fermeture explicite
   précède — le panneau y repart caché.

Il reste **dix** cas, qu'on lit à la main en vérifiant (b) dans l'écran. Neuf
étaient sains. Un relevé de 73 entrées n'aurait rien appris : *un contrôle qui
ne contrôle rien finit par rassurer, ce qui est pire que son absence.*

## Ce qui reste hors d'atteinte ici

`essais:fiches-audio` réclame `ffmpeg`. Il a été installé dans le conteneur
du 19 octobre — mais le conteneur est éphémère, donc l'installation ne
survivra pas. Tant que `ffmpeg` n'est pas dans le script de préparation de
l'environnement, cet essai redeviendra rouge dans un conteneur neuf, pour une
raison qui n'est pas la sienne.
