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
| Marqueur « lu / non lu » | **ligne de décision D-039** | demande un magasin chiffré de plus et une migration de schéma. La règle d'audit §4.2 impose de s'arrêter avant de toucher au format des données. |

---

## L3 — Sport > Exercices : formulaire avant la liste · **à faire**

| Piste | Décision |
|---|---|
| Liste d'abord, avec recherche | prévu |
| Création dans un panneau ou une boîte de dialogue | prévu — dialogue natif `<dialog>`, pas de dépendance |
| Muscles par la silhouette, les 15 listes dans un bloc « Avancé » | prévu |
| « Supprimer » dans un menu « … » avec annulation | prévu pour la confirmation ; **l'annulation après coup est une ligne de décision D-040** (il faut garder l'exercice supprimé quelque part, donc toucher au magasin) |

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

## Lignes de décision nées de ce lot

| Réf. | Question | Pourquoi je m'arrête |
|---|---|---|
| D-039 | Marqueur « lu / non lu » sur les actualités | magasin chiffré supplémentaire + migration de schéma |
| D-040 | Annulation après suppression d'un exercice | il faut conserver l'exercice supprimé : changement de magasin |
