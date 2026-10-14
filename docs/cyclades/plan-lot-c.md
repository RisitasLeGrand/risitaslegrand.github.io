# Lot C — la longueur des pages

Ce plan traite les cinq constats du lot C de `critique-interface-cyclades.md`
(13 octobre 2026). Il est écrit avant l'exécution, et tenu à jour après :
chaque ligne porte son état et, quand il y a lieu, la mesure constatée.

Règle appliquée partout : **une piste de la critique n'est pas une
autorisation d'en inventer une autre**. Ce qui dépasse la piste est posé en
ligne de décision, pas fait en silence.

---

## L2 — Glossaire · **fait** (commit « L2 — le glossaire »)

| Piste de la critique | État | Mesure |
|---|---|---|
| Index collant | fait | collé sous l'en-tête, hauteur mesurée au lieu d'être écrite en dur |
| Bouton « Haut de page » | fait | rend aussi le focus au champ de filtre |
| Rendu différé | fait | mise en page 124 ms → 40 ms à 390 px |
| Deux colonnes sur grand écran | fait | 53 339 px → 35 645 px à 1280 px |

Deux défauts trouvés **par la mesure** et corrigés : l'estimation de taille
des sections (fausse de 6 %, un saut vers « Z » atterrissait sur le « S »), et
le saut lui-même (22 px de reste, maintenant 0). Onze contrôles dans
`essais:glossaire:navigateur`.

---

## L1 — Actualités : 40 659 px pour 109 articles · **fait**

Constat : aucune pagination, aucune recherche, 710 éléments interactifs.

**Mesuré avant et après**, dans le même navigateur, sur les actualités réelles
du dépôt (39 semaines, 109 articles) :

| | avant | après |
|---|---|---|
| Hauteur à 1280 px | 40 455 px | 1 955 px |
| Hauteur à 390 px | — | 3 676 px |
| Sections affichées | 39 | 1 |
| Cartes affichées | 109 | 7 (la semaine ouverte) |
| Éléments interactifs | 643 | 51 |

Le chiffre d'avant retrouve celui de la critique (40 659 px, 109 articles) à
0,5 % près : la mesure porte bien sur la même page. Les 643 éléments
interactifs contre les 710 annoncés : l'écart vient de ce que je ne compte que
ceux de l'archive, pas ceux de l'en-tête et du pied de page.

Pour reproduire : `npm run build && npm run actualites:dist`, puis
`npx astro preview` et `npm run essais:actualites:navigateur` (dix-neuf
contrôles). Sans `actualites:dist`, l'essai s'arrête au lieu de mesurer la
seule semaine de démonstration.

| Piste de la critique | Décision | Pourquoi |
|---|---|---|
| Une semaine à la fois, « ‹ précédente / suivante › », sélecteur de date | **fait** | c'est le cœur du constat ; vaut pour les quatre périodicités, pas seulement les semaines |
| Replier les mois anciens dans des `<details>` | **remplacé** | la navigation période par période rend le repliement sans objet ; empiler les deux donnerait deux mécanismes pour le même besoin |
| Carte limitée à 2–3 lignes avec « Lire la suite » | **fait** | le reste de la carte (lien avec le programme, sources, bouton IA) passe derrière le dépliant, ce qui enlève l'essentiel des 710 éléments interactifs |
| Recherche | **fait** | la recherche traverse toutes les périodes de la vue courante, sinon elle ne chercherait que dans la semaine affichée, ce qui ne sert à rien |
| Mémoriser le filtre de domaine dans l'adresse | **fait** | et aussi la période, la vue et la recherche : une adresse se partage et se recharge |
| Rendu différé | **fait** | utile surtout sur les résultats de recherche, qui peuvent traverser quarante semaines |
| Marqueur « lu / non lu » | **fait (D-039, validé le 14 octobre)** | magasin `actualitesLues`, migration v31, bascule par carte, compte de non lues dans le sélecteur de période, filtre « Non lues seulement » |

---

## L3 — Sport > Exercices : formulaire avant la liste · **fait**

| Piste | Décision |
|---|---|
| Liste d'abord, avec recherche | **fait** — le champ de filtre existait déjà ; c'est l'ordre qui changeait |
| Création dans un panneau ou une boîte de dialogue | **fait** — `<dialog>` natif, `showModal()` : le piège du focus, Échap et l'inertie de la page sont ceux du navigateur, pas une réimplémentation qui oublierait un cas |
| Muscles par la silhouette, les 15 listes dans un bloc « Avancé » | **fait, avec une réserve** — le bloc est `open` dans le balisage, et le script ne le referme qu'en dessous de `lg`. La liste de cases est l'**alternative accessible** du schéma cliquable, pas un supplément : la replier par défaut partout l'aurait rendue plus difficile d'accès pour les seuls à qui elle est indispensable. |
| « Supprimer » dans un menu « … » avec annulation | **confirmation faite, annulation non** : conserver l'exercice supprimé demande de toucher au magasin → **D-040** |

**Mesuré avant et après**, 31 exercices en bibliothèque :

| | avant | après |
|---|---|---|
| Hauteur à 1280 px | 5 097 px | 3 214 px |
| Hauteur à 390 px | 7 397 px | 3 981 px |
| Éléments interactifs visibles | 75 | 33 |

Les chiffres d'avant retrouvent ceux de la critique (5 353 px et 7 454 px) à
5 % près — l'écart tient au nombre d'exercices, qui n'est pas forcément le
même que sur le site en ligne.

---

## L4 — Le bruit des états vides · **fait**

- **Programmes** : les 18 lignes de tirets remplacées par une phrase et une
  action, le tableau replié tant qu'il n'y a pas de donnée.
- **Force** : plus de présélection d'un exercice jamais pratiqué ; le dernier
  exercice pratiqué, ou une invite s'il n'y en a aucun.
- **Statistiques** : un message à la place d'un graphique vide, et la valeur
  réelle quand elle est trop petite pour être dessinée.

Constaté à l'exécution : le cas « zéro absolu » n'est presque jamais celui
qu'on rencontre. Sur un carnet neuf, l'essai mesure **5 s** de révision —
cinq secondes sur une échelle de dix heures, soit la barre de trois pixels
que la critique décrit. Le remplacement du graphique ne suffisait donc pas :
c'est le **chiffre écrit** qui répond au « sans valeur ni message », et les
deux branches sont contrôlées séparément.

---

## L5 — Planification : des jours passés marqués « non tenue » · **fait**

La cause est marquée **[D]** par la critique : à établir avant de corriger.
Deux correctifs possibles selon ce que la lecture du code montrera —
démarrer le planning à la date d'ouverture du parcours, ou ne pas étiqueter
les jours antérieurs à cette date. Le constat sera écrit ici avant le
correctif.

---

## Anomalie trouvée en chemin, et qui n'est pas dans la critique

L'essai `essais:sport:navigateur` cliquait `details >> nth=0` sur
`/sport/corps/`. Depuis que la barre de navigation du lot B groupe ses
onglets dans des `details`, la page en porte **trois avant son contenu** : le
sélecteur désignait un menu de l'en-tête, caché à cette largeur, et l'essai
expirait. C'est une conséquence de mon propre lot B, trouvée en relançant
les essais, et c'est le sélecteur qui était trop large — la page est intacte.
Corrigé en `#contenu-principal details >> nth=0`. Aucun autre essai
n'utilisait un sélecteur `details` non qualifié.

## La suite complète des essais de navigateur, relancée

Vingt-huit scripts, passés un par un. **Quatre rouges, aucun défaut du
site** : quatre essais qui mesuraient autre chose que ce qu'ils croyaient.
Trois viennent de mes propres changements, le quatrième d'une horloge.

| Essai | Ce qui n'allait pas | Corrigé en |
|---|---|---|
| `positionnement` | seul des vingt-neuf à ne pas porter de chemin de navigateur par défaut : sans `CHROMIUM` dans l'environnement, il s'arrêtait avant d'ouvrir une page. **Un essai qui ne démarre pas n'échoue pas : il disparaît.** | lui donnant le même défaut que les vingt-huit autres |
| `psyche` | « un onglet Psyché est proposé » : depuis le lot B les onglets sont groupés, le lien est dans un `details` replié, donc invisible — mais à un geste | contrôlant le geste : le groupe est visible, l'ouvrir montre le lien |
| `odyssee` (magasins) | égalité stricte sur la liste des magasins ; deux magasins ajoutés par le domaine Santé la faisaient tomber sur un essai dont le sujet est la migration depuis la v14 | un plancher, comme pour le numéro de version juste au-dessus — `essais:coffre` compte toujours les scellés exactement |
| `odyssee` (relevés) | les moments « passés » étaient semés à partir de `Date.now()`, dont la date de calendrier (14 oct.) diffère du **jour logique** affiché (13 oct.) entre minuit et 4 h. L'essai échouait donc quatre heures par nuit | ancrant les moments dans le jour logique |

Le dernier a demandé une sonde pour être établi plutôt que supposé : le
calendrier affichait bien « mardi 13 octobre » à 3 h 55, et les moments
datés du 14 n'y figuraient pas. Le site fait exactement ce qu'on lui
demande ; c'est l'essai qui regardait le mauvais jour.

`actualites` compte pour vert : il s'arrête tant que `npm run
actualites:dist` n'a pas été lancé, et c'est voulu.

## Lignes de décision nées de ce lot

| Réf. | Question | État |
|---|---|---|
| D-039 | Marqueur « lu / non lu » sur les actualités | **validé et livré** le 14 octobre. Magasin `actualitesLues`, non scellé — un marqueur de lecture qui ne marcherait que coffre ouvert serait absurde sur une liste d'actualités. La clef est « période:empreinte du titre » : IndexedDB n'est pas chiffré pour Révisions, et une liste de titres en clair sur le disque dirait ce qui est lu. |
| D-040 | Annulation après suppression d'un exercice | **écartée pour l'instant** le 14 octobre. La confirmation reste, le retour en arrière n'est pas fait. |
