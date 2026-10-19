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

## Ce qui reste hors d'atteinte ici

`essais:fiches-audio` réclame `ffmpeg`. Il a été installé dans le conteneur
du 19 octobre — mais le conteneur est éphémère, donc l'installation ne
survivra pas. Tant que `ffmpeg` n'est pas dans le script de préparation de
l'environnement, cet essai redeviendra rouge dans un conteneur neuf, pour une
raison qui n'est pas la sienne.
