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

### Le quatrième piège : une post-condition que le NAVIGATEUR pose

*Ajouté le 26 octobre, après une conversion fausse du chantier des
temporisations.*

Les trois premiers pièges se voient dans l'essai : le moment de l'attente, puis
son objet. Celui-ci se voit ailleurs — dans le **partage du travail entre le
navigateur et le script**. La marque attendue est propre au geste, elle ne peut
pas rester d'un passage antérieur, elle a tout d'une post-condition. Elle est
seulement posée par quelqu'un d'autre que celui dont on attend la peinture.

Le dépliant d'une carte d'actualité est un `<details>`. J'ai converti sa
temporisation en attente de `details[open]`, et les deux assertions qui
suivaient sont tombées à la mesure. **`open` est posé par le navigateur au
clic** — donc avant que le gestionnaire `toggle` n'ait tourné. Le résumé qui
perd sa coupe à trois lignes et le bouton « Préparer une question » sont peints
après lui. La post-condition juste est le bouton visible, qui est écrit en
dernier ; `scripts/essais-actualites-navigateur.mjs` porte le cas en clair, à
l'endroit où je m'étais trompé.

La mise en garde vaut pour tout ce que le navigateur tient lui-même : `open`
d'un `<details>`, `checked` d'une case, la valeur d'un champ, le focus, le
fragment de l'adresse. Tous changent avant le gestionnaire, et aucun ne dit que
l'écran a été repeint.

Le contrôle tient en une question : **qui écrit cette marque ?** Le navigateur,
et elle date du geste et non de la peinture. Le script, et il reste à vérifier
qu'il l'écrit en DERNIER — ce qui ramène au troisième piège.

Autrement dit : **une post-condition plausible n'est pas une post-condition.**
Celle-ci l'était assez pour que je la croie sans la mesurer. C'est la mesure
qui a tranché, et c'est elle qu'il faut faire avant d'annoncer une conversion,
pas après.

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

## 4. Le chantier des temporisations

*Ouvert le 26 octobre. Le § 3 dit pourquoi une attente peut n'attendre rien ;
celui-ci dit ce qu'on fait des temporisations à l'aveugle qui restent, et ce
que le pilote de trois essais a appris.*

### Le chiffre, ce qu'il vaut, et deux corrections

`scripts/relever-temporisations.mjs` en tient le compte, et il est au dépôt
pour que le chiffre soit vérifiable plutôt qu'annoncé. Sur l'arbre d'avant le
pilote : **576 temporisations, dont 458 — réparties sur 112 essais — ont une
lecture derrière**, un `isVisible`, un `textContent`, un `count()`, un
`evaluate`, une assertion. Ce sont celles-là qui comptent : une temporisation
suivie de rien ne ment pas sur l'écran, elle ne fait que ralentir la batterie.
Après le pilote : 546 et 433 dans 110 essais.

**C'est une estimation, et il faut savoir de quoi elle dépend.** La fenêtre de
douze lignes est un choix. À vingt, le même script rend **478** sites au lieu
de 433 sur le même arbre : l'élargir ramasse des lectures qui appartiennent au
geste suivant, la rétrécir manque celles qu'un bloc `waitForFunction` sépare de
leur temporisation. *Deux relevés qui ne disent pas leur fenêtre ne sont pas
comparables.*

**Première correction : le motif sous-comptait d'un quart.** Il cherchait
`isVisible`, `textContent`, `getAttribute`, `$$eval`, `count()` et les appels
d'assertion — mais pas **`evaluate(`**, qui est la façon la plus courante de
lire l'écran dans ces essais. Trois sites d'un seul fichier passaient dessous,
et je ne les ai vus qu'en comptant les restes après conversion. *Un motif de
mesure se vérifie sur un fichier déjà traité, où le reste doit être zéro.*

**Seconde correction, sur la première : le « 488 dans 116 essais » que j'ai
annoncé au Pilote ne se reproduisait pas.** Il venait d'une mesure à la main
dont je n'avais pas noté la fenêtre — la valeur s'explique par une fenêtre
large, celle de vingt lignes en rendant 478. L'ordre de grandeur et la charge
de travail n'en bougent pas ; ce qui change, c'est qu'un chiffre de ce chantier
se donne désormais avec le script et la fenêtre qui le produisent.

### Une temporisation légitime existe, et elle est rare

Une sur vingt-six, dans le pilote. Deux séries de 8 répétitions à 60 kg portent
exactement les mêmes données : le **repos de 600 ms** du site les prend pour un
seul geste, et c'est l'objet de son empreinte. L'essai attend 700 ms pour
franchir ce repos.

Elle ne se remplace pas par une post-condition, et la raison est de principe :
ce qu'on attend est précisément **qu'il ne se passe rien**. Donner une marque à
ce non-événement reviendrait à faire annoncer par l'écran une déduplication
qu'il rend invisible — on ajouterait à la page une trace pour l'essai seul.

### Comment la reconnaître — et l'erreur que j'ai failli laisser

Je l'ai d'abord écrit ainsi : « elle se reconnaît à un `setTimeout` dans un
gestionnaire d'entrée côté site ». **C'est faux, et c'est faux sur l'exemple
même qui a servi à l'énoncer.** Le repos de 600 ms du sport n'a aucun minuteur :
`src/lib/geste.ts` garde l'instant du dernier geste et refuse le suivant s'il
arrive trop tôt — `performance.now() - derniere < repos`. Un relevé des
`setTimeout` ne le voit pas, et il y en a 32 qui auraient donné l'illusion d'un
relevé complet.

Un délai du site a donc **deux formes**, et la seconde est celle qui compte :

- **un minuteur** diffère une action. Trente-deux dans `src/`. Il se cherche par
  son nom, et c'est la forme à laquelle on pense.
- **un repos comparé à l'horloge** n'a rien à chercher : aucun timer, une
  soustraction dans une condition. **Trois** dans tout `src/` —
  `geste.ts` (le rebond des gestes), l'échange en arrière-plan (son plancher
  entre deux synchronisations), et le compteur d'inactivité.

Le premier des trois gouverne **les 31 appels à `unSeulGeste`** du site : tout
geste répété à données identiques en moins de 600 ms y est pris pour un rebond.
C'est la portée réelle de la classe légitime, et elle se dit en une phrase —
beaucoup mieux qu'un relevé de 32 minuteurs dont aucun n'était en cause.

`node scripts/relever-temporisations.mjs --amortissements` rend les trois
groupes, les repos d'abord.

Et il nomme les **quinze écrans** que ce rebond gouverne : dix d'Odyssée
(agenda, corps, échelles, molécule, Psyché, quêtes, santé, tâches, tendances,
l'accueil), quatre du sport, et le QCM DGFiP. La classe légitime se concentre
donc là, et nulle part ailleurs — ce qui dit par avance dans quel lot y faire
attention.

### Trois choses apprises au pilote

**Les écritures en base sans marque à l'écran** — l'amorce de calibrage, le
décochage d'une source — se tiennent en interrogeant **la base elle-même**
jusqu'à ce qu'elle réponde, et non l'écran. `attendreEnBase(magasin,
estSatisfait, delai)` de `essais-niveau-navigateur.mjs` fait cela par le `lire()`
que l'essai possède déjà.

**Les invariants négatifs ne s'attendent pas.** « Refuser la confirmation ne
supprime rien » est vrai tout de suite, et le resterait si la suppression
arrivait une seconde plus tard. On attend la post-condition du GESTE — la boîte
qui se referme —, après quoi la lecture a un sens.

**Certains essais ont des préalables.** `essais:actualites` exige
`npm run actualites:dist`, et son propre garde le dit. Une batterie lancée sans
eux rend des rouges qui n'en sont pas : à connaître avant de conclure quoi que
ce soit d'un lot.

### Et ce que le second lot a ajouté

*Cinq essais de plus le 26 octobre — « redemande » (10 sites), « invitation »
(10), « copie-navigateur » (9), « bascule-branchement » (7), « echecs-dits »
(12). Quatre leçons, et la dernière n'a rien à voir avec les post-conditions.*

**Une aide qui sert aux DEUX issues doit attendre les deux.** `saisirLeCoffre`
de « bascule-branchement » ouvre le coffre à six endroits — et à trois d'entre
eux, le refus est précisément ce qu'on mesure : « le mot de passe du site ne
l'ouvre plus » est tout l'objet de la bascule. Attendre « le cadenas s'en va »
consommait donc la borne entière trois fois, et l'essai arrivait ensuite dans
un état qu'il n'avait pas mesuré. On attend la PREMIÈRE des deux issues — le
cadenas parti, ou le refus écrit —, et l'assertion dit laquelle est venue.

**Un message d'avant fait rendre la main trop tôt.** Le même refus reste
affiché d'une tentative à l'autre : l'essai efface donc la zone lui-même avant
le geste, et ce qu'il y lit ensuite ne peut venir que de lui. C'est la parade
du § 3, et il a fallu la payer pour s'en souvenir.

**Un verdict se distingue de l'annonce de travail.** L'étape de la preuve
écrit « Ouverture du fichier… », puis son verdict. Attendre un texte non vide
rend la main sur l'annonce ; attendre le motif du succès laisse un refus
consommer la borne entière. On attend un texte qui n'est pas l'annonce : vrai
pour les deux issues, et indépendant de ce qu'on affirme.

**Et trois passages, trois jeux de rouges différents : c'est la signature d'une
post-condition manquante.** Le scellé du coffre n'est pas écrit au chargement
mais quand l'écran scelle son premier enregistrement, et six secondes le
couvraient sans le dire. Aucune marque à l'écran pour cela : c'est la base
qu'on interroge. *Un rouge qui change de place à chaque passage ne dit pas que
l'essai est fragile — il dit qu'on attend la mauvaise chose.*

**Enfin, celle qui ne parle pas d'attentes du tout.** En remplaçant les trois
lignes « attendre, cliquer, attendre » d'un bloc, je n'ai remis que les deux
attentes : **le geste avait disparu.** L'essai a rendu un rouge parfaitement
cohérent — « le refus n'est pas dit » — sur un refus que personne n'avait
demandé, et j'ai cherché le défaut dans le site. Deux lignes de diagnostic
l'ont montré en disant que rien ne s'opposait au geste. **Quand on remplace un
bloc, on vérifie que le geste y est encore** ; et un rouge cohérent n'est pas
pour autant un rouge du site.

### Ce que coûte une conversion, mesuré

Le pilote : **2 h 01 d'horloge pour 26 sites**, trois essais, un socle. À ce
rythme exact, les 458 demanderaient 36 heures — mais le pilote a payé trois
passages individuels PLUS un socle pour trois essais seulement. En lot, la
vérification se mutualise : une batterie pour trente essais convertis, et non
une par essai. L'estimation tenable est **20 à 22 heures**, dont 3 à 4 de
batteries et 20 % de marge pour les conversions fausses — il y en aura, le § 3
dit lesquelles.

`scripts/lib/post-condition.mjs` tient les formes qui reviennent :
`apresLaPeinture` pour une action répétable sur une zone qui compte ses
peintures, `apresLeRemplacement` quand la zone refait ses enfants,
`apresLeChangementDeTexte` quand une phrase est réécrite, `attendreLeCompte`
pour une liste qui grandit, `apresLesAnimations` avant toute lecture de
géométrie, et `devientVisible` pour le « il part / il paraît » qui occupait la
moitié des sites. Quand rien de tout cela ne s'applique — l'écriture n'a
aucune marque à l'écran —, c'est la base qu'on interroge : l'idiome
`attendreEnBase`.

### Ce que le premier lot a appris, et qui ne s'invente pas

*Trois essais convertis le 26 octobre — « parametres-navigateur » (19 sites),
« sante-navigateur » (25), « gestes » (11). Chacune de ces quatre leçons vient
d'une assertion tombée, et aucune n'était prévisible depuis la source.*

**Une animation se lit par sa FIN, jamais par une durée.** Deux fois dans ce
lot. Une ancre défile par animation : `scrollend` le dit. Le bandeau
d'annulation monte : son bas passe de 708 à 684 px en cent cinquante
millisecondes, et trois constats de géométrie tombent si on le lit dès qu'il
est visible. `apresLesAnimations` attend les promesses `finished` de
`getAnimations()`, ce qui est exact et ne suppose aucune durée.

**Une conversion ACCÉLÈRE l'essai, et peut le faire tomber dans le repos du
site.** C'est la leçon la moins attendue, et la plus utile pour la suite.
« Abandonner » passe par `unSeulGeste` ; l'empreinte d'un bouton sans champ
est vide, donc deux appuis sur ce bouton portent la même empreinte, et le
second est pris pour un rebond s'il arrive moins de 600 ms après le premier.
Les temporisations d'avant franchissaient ce repos sans le savoir. Les
post-conditions, plus rapides, l'ont ramené dans la fenêtre : deux assertions
sont tombées sur du code sain. **Avant de refaire le même geste sur le même
contrôle, il faut franchir le repos** — et c'est une des rares temporisations
légitimes.

**Un rouge ne doit pas en cacher vingt-trois.** Le dépôt au centre de
notifications manque — défaut du site, présent avant ce lot, mesuré sur la
version d'avant comme sur la nouvelle. La lecture qui suivait faisait une
panne sur « undefined », et l'essai s'arrêtait là : les vingt-trois assertions
des deux dernières sections n'étaient pas mesurées, ce qui se lisait comme
leur absence. Elles tournent désormais.

**Une page visitée pour son EFFET DE BORD a besoin de sa post-condition.**
`essais:gestes` passe par l'écran des exercices uniquement pour que la
bibliothèque se déchiffre, puis s'en va. J'ai retiré les 2 200 ms de ce
passage en croyant que l'attente du sélecteur, sur l'écran suivant, suffisait :
à ×15 de bridage, le sélecteur restait vide et l'essai tombait avant sa
première assertion. « networkidle » dit que le réseau se tait, pas que le
travail est fini. `#vue` ne paraît qu'une fois la bibliothèque lue : c'est la
marque, et elle était là depuis le début.

**Au passage, une borne qu'on croit avoir fixée.** Le même essai écrivait
`waitForFunction(fn, { timeout: 20000 })` — or le second argument de
`waitForFunction` est la VALEUR passée à la fonction, pas les options. Les
vingt secondes annoncées n'en étaient pas, et la borne réelle était celle par
défaut. À vérifier partout : c'est une erreur qui ne se voit jamais, puisque
les deux valeurs se ressemblent.

**Et un vert à vide se dit « non mesuré ».** Dans la même section, deux
constats restaient verts sans l'élément déposé — « rien d'autre n'est lisible »
est vrai d'un objet vide. Ce n'est pas un assouplissement : l'essai échoue
toujours, pour la seule cause réelle, et les constats qui ne peuvent rien
prouver le disent au lieu de rassurer.

## Ce qui reste hors d'atteinte ici

`essais:fiches-audio` réclame `ffmpeg`. Il a été installé dans le conteneur
du 19 octobre — mais le conteneur est éphémère, donc l'installation ne
survivra pas. Tant que `ffmpeg` n'est pas dans le script de préparation de
l'environnement, cet essai redeviendra rouge dans un conteneur neuf, pour une
raison qui n'est pas la sienne.
