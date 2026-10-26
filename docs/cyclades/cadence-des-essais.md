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

*Élargi le 26 octobre : la première condition a deux formes, et le premier
balayage n'en voyait qu'une.*

Une attente n'est dangereuse que si **les deux** sont réunies :

- **(a)** la condition attendue est vraie **avant que le gestionnaire n'ait
  peint** ce que l'essai va lire ;
- **(b)** le gestionnaire **cède la main** — un `await` — entre ce moment-là et
  la peinture.

La condition (a) se présente sous **deux formes**, et c'est tout l'élargissement :

- **motif 1 — la condition était déjà vraie avant le geste.** Une phase
  antérieure a laissé le panneau visible, et le clic ne change rien à ce que
  l'attente regarde.
- **motif 2 — le gestionnaire la rend vraie, puis cède la main.** Le panneau
  était bien caché, la transition est réelle, et pourtant l'attente est
  satisfaite à un instant où le contenu n'est pas là. Trouvé par B dans
  `basculer()` du centre de notifications, le 25 octobre.

**Sans (b), il n'y a rien à attraper.** Une peinture synchrone ne peut pas être
surprise à mi-chemin : le navigateur ne rend pas la main entre deux
instructions, et l'observateur de Playwright ne voit l'état qu'une fois la
fonction entière terminée. L'ordre entre « démasquer » et « remplir » n'y
change donc rien — c'est le piège de raisonnement qu'il faut éviter ici, et
dans lequel je suis tombé deux fois avant de mesurer.

### Pourquoi le premier balayage ne pouvait pas voir le motif 2

Son troisième resserrement écartait « les occurrences qu'un `goto`, un contexte
neuf ou une fermeture explicite précède — le panneau y repart caché ». Ce
resserrement est **exactement** ce qui jette le motif 2 : le panneau repart
caché, donc la transition est vraie, donc l'occurrence paraît saine. Elle ne
l'est pas, parce que la question n'est pas « la transition a-t-elle lieu ? »
mais « a-t-elle lieu **avant ou après** la peinture ? ».

`#resultat` de l'import bancaire le montre sans ambiguïté : `peindreApercu` le
**re-cache** explicitement à chaque relevé, et l'essai attend `#apercu` avant
de cliquer. Le premier balayage l'aurait donc écarté deux fois.

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

### Le troisième piège : attendre un élément et en lire un AUTRE

*Ajouté le 26 octobre, après la réparation de l'import bancaire.*

Les deux premiers pièges portent sur le MOMENT de l'attente. Celui-ci porte
sur son OBJET, et il est plus difficile à voir parce que l'élément attendu est
irréprochable.

`importer()` démasque `#resultat` et écrit sa phrase — « 3 opérations
enregistrées » — **synchroniquement**. L'assertion qui lit `#resultat` est
donc saine, et le restera. Puis vient `await peindreEtat()`, qui remplit la
table `[data-etat]`. Trois assertions lisaient CETTE table après avoir attendu
`#resultat`. Mesuré, avec 500 ms injectés : « 15 opérations » au lieu de 20.

Chercher le défaut dans l'élément attendu n'aurait rien donné. **L'attente
doit porter sur ce qu'on va LIRE**, pas sur ce qui annonce que quelque chose
s'est passé.

### `aria-busy` ou un compteur : ce qui les sépare

`aria-busy` posé avant le premier `await` et retiré dans un `finally` est une
vraie post-condition, et elle a sa valeur propre : sans elle, une technologie
d'assistance annonce une région vide puis la rend à nouveau remplie. Le centre
de notifications l'emploie, et elle y tient — vérifié avec 500 ms injectés,
les trente-deux assertions passent.

Elle ne suffit pourtant pas partout, et la raison est le premier motif. **Au
repos, la zone n'est pas occupée** : attendre « plus occupée » est donc déjà
vrai avant le geste. Le centre s'en tire parce qu'on ne l'ouvre qu'une fois
par mesure. L'import bancaire, non : `essais-rapprocher-ecran` enchaîne cinq
relevés, et dès le second l'attente serait satisfaite avant que le clic
n'agisse.

Un **compteur monotone** n'a pas ce défaut. La zone porte `data-peint`,
incrémenté dans le même `finally` ; l'essai relève la valeur AVANT le geste et
attend qu'elle change. Aucun passage antérieur ne peut avoir rendu cette
condition vraie, puisqu'elle porte sur une valeur relevée après eux. C'est la
forme à prendre pour **une action répétable**, et `scripts/lib/post-condition.mjs`
la rend en une ligne.

Mesuré sur le correctif : les deux essais passent avec 500 ms injectés, et
encore avec **2 secondes**. Un correctif qui ne tiendrait que par la vitesse
tomberait à la seconde.

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

### Le second balayage, du 26 octobre

Partir de la source donne **66 occurrences** — un démasquage suivi d'un `await`
dans les vingt-cinq lignes — dont presque aucune n'est en jeu. On part donc des
**essais**, qui sont le petit côté : 294 attentes de visibilité relevées, 16
retenues où l'élément attendu est démasqué avant un `await` et où l'essai lit
un contenu juste après. Les 16 se lisent à la main, et il reste **deux sites de
source**.

Deux classes de faux positifs, et elles valent d'être connues :

1. **l'`await` appartient à une autre fonction.** La fenêtre de lignes franchit
   une accolade fermante, et ramasse l'`await` d'un gestionnaire voisin ou
   imbriqué. Cinq des huit sites sont dans ce cas — `podcast.ts`, le bandeau de
   proposition de l'accueil, le compte à rebours du tableau de bord, la
   simulation de `qui-utilise-mon-age`, les deux erreurs du calendrier.
2. **le contenu est écrit AVANT le démasquage**, et c'est l'ordre sain. Quatre
   de ces cinq l'écrivent aussi : le texte est posé, puis l'élément paraît. Rien
   à observer, quel que soit l'`await` d'après.

#### Les deux cas confirmés, mesurés par un retard de 500 ms

| Source | Essais | Ce qui casse |
| --- | --- | --- |
| `CentreNotifications.astro:527` — `panneau.hidden = !ouvrir`, puis `await faireLeMenage()` et `await dessiner()` | `essais-centre-navigateur` (3 attentes), `essais-centre-panne` | 7 assertions, dont « le panneau liste la question et le rappel » : lues sur un panneau vide |
| `finances.astro:403` — `resultat.classList.remove('hidden')`, puis `await peindreEtat()` | `essais-finances-navigateur` (2 attentes), `essais-rapprocher-ecran` | la table d'état, écrite par `peindreEtat` : « 15 » au lieu de « 20 » |

Le second est instructif : `#resultat` lui-même est rempli **synchroniquement**,
juste après le démasquage — donc l'assertion qui le lit est saine. Ce qui casse
est la table `[data-etat]`, que l'`await` d'après remplit. L'essai attend un
élément et lit **un autre**, et c'est le second qui arrive en retard. Chercher
le défaut dans l'élément attendu n'aurait rien donné.

Les quatre essais repassent au vert le retard retiré.

#### Un cas déjà réparé, qui donne la forme du remède

`essais-cle-disparue.mjs:190` attend `#coffre-sans-cle:not(.hidden)` sur un
`FormulaireCoffre` qui démasque puis attend `combienDeScellesIllisibles()`.
L'essai porte déjà la parade **et son commentaire** : il enchaîne sur un
`waitForFunction` qui exige que le compte soit écrit, « lire trop tôt mesurait
l'ordre d'arrivée, pas le contenu ». C'est la post-condition écrite en dernier,
et elle était là avant qu'on nomme le motif.

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

### La visibilité et le focus d'une page ne se pilotent pas (26 octobre, lot 0.8)

Le lot 0.8 demande qu'aucune notification du système ne parte « quand la page
est visible ». Avant d'écrire la règle, j'ai cherché un levier réel pour
cacher une page dans ce conteneur. **Il n'y en a aucun**, et c'est mesuré,
pas supposé : dans ce Chromium sans écran, piloté par Playwright, une page
répond toujours `visibilityState = "visible"` et `hasFocus() = true`.

Les quatre tentatives, dans l'ordre :

| Levier | Résultat mesuré |
|---|---|
| ouvrir un second onglet devant | les deux pages restent `visible`, `hasFocus() = true` |
| `page.bringToFront()` sur l'autre onglet | sans effet sur la première |
| `Emulation.setFocusEmulationEnabled: false` par le protocole | accepté, sans effet |
| `Emulation.setActiveAndFocused` | la commande n'existe pas |

Reste l'écrasement de la propriété avant tout script de la page :

```js
await ctx.addInitScript(() => {
  Object.defineProperty(Document.prototype, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  });
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => true });
});
```

**Ce que cela éprouve, et ce que cela n'éprouve pas.** Un essai écrit ainsi
prouve que le code CONSULTE la visibilité et en tient compte ; il ne prouve
pas que le navigateur la calcule juste. C'est le même rang de preuve que la
permission accordée d'avance ou `showNotification` remplacé par un compteur,
et il faut l'écrire dans l'en-tête de l'essai comme `essais:centre-m14` le
fait désormais.

**Le corollaire, qui est le piège.** Une page de navigateur étant toujours
« visible » ici, un essai qui mesure une règle de la forme « rien ne part
quand on regarde » obtient zéro **sans rien faire** — et zéro est aussi ce
que donnerait une chaîne débranchée. Une telle passe ne vaut donc que
doublée d'une passe où la page est cachée et où quelque chose part. Sans
cela, on écrit un essai qui reste vert sur la suppression du code qu'il
surveille.

### `ffmpeg`

`essais:fiches-audio` réclame `ffmpeg`. Il a été installé dans le conteneur
du 19 octobre — mais le conteneur est éphémère, donc l'installation ne
survivra pas. Tant que `ffmpeg` n'est pas dans le script de préparation de
l'environnement, cet essai redeviendra rouge dans un conteneur neuf, pour une
raison qui n'est pas la sienne.
