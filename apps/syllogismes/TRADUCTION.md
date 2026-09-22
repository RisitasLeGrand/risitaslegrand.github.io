# Traduction française — écarts avec le dépôt d'origine

Cette application est une adaptation de [Syllogimous v4](https://github.com/4skinSkywalker/Syllogimous-v4)
de **4skinSkywalker**, sous licence [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/).
La modification principale est la **traduction intégrale en français** ; trois
appels à des services tiers ont par ailleurs été retirés (voir plus bas).

Version d'origine vendorisée : voir `.version-amont`.

Ce document existe pour faciliter une éventuelle resynchronisation avec une
version ultérieure du projet source. Chaque modification notable porte un
commentaire `TRADUCTION FR` ou `MODIFICATION` dans le code.

## Méthode retenue

Le dépôt d'origine ne comporte **aucun attribut `i18n`** dans ses 50 gabarits,
alors que `@angular/localize` figure dans ses dépendances. Passer par la chaîne
`extract-i18n` aurait donc supposé d'annoter au préalable l'ensemble des
gabarits — beaucoup de machinerie pour *maintenir plusieurs langues*, alors
qu'une seule est visée ici. Les textes ont donc été traduits directement dans
les gabarits et dans le code, à la manière d'un fork.

## Modifications qui ne relèvent pas de la traduction

Trois écarts supplémentaires, pour que l'exercice respecte la règle du site :
**rien ne sort de la machine du visiteur**. Le dépôt d'origine appelait trois
services tiers ; après adaptation, l'application n'émet **aucune requête
externe**.

| Retiré | Où | Pourquoi |
|---|---|---|
| Balise **Google Analytics** (`G-XX6PV4G4TX`) | `src/index.html` | Renvoyait les visites vers le compte de l'auteur amont |
| **Font Awesome** via `maxcdn.bootstrapcdn.com` | `src/index.html` | Les trois icônes concernées ont été remplacées par leurs équivalentes Bootstrap Icons, déjà empaquetées |
| Import **Google Fonts** (`Playpen Sans`) | `src/assets/css/thickstrap.css` | Contactait `fonts.googleapis.com` à chaque ouverture. La pile de polices retombe sur le système ; pour retrouver la typographie d'origine, héberger la police localement |

Une quatrième modification est technique : la **minification CSS est désactivée
en configuration de production** (`angular.json`). L'optimiseur d'Angular
abandonnait des règles de `thickstrap.css` — avertissement « rules skipped due
to selector errors » — ce qui publiait une application sans styles. Le
JavaScript reste optimisé. C'est d'ailleurs pourquoi l'auteur amont publie sa
propre version en configuration de développement.

## Ce qui n'a pas été traduit, et pourquoi

Ces valeurs sont des **identifiants**, pas du texte affiché. Les traduire
casserait les données déjà enregistrées ou les URL.

| Élément | Raison |
|---|---|
| `EnumQuestionType` (`"Syllogism"`, `"Direction3D Spatial"`…) | Clés des statistiques et de l'historique en `localStorage` |
| `EnumScreens` (`"Start"`, `"Playground Mode"`…) | Segments d'URL du routeur Angular |
| Clés de `localStorage` | Compatibilité avec les parties déjà jouées |

Les libellés correspondants sont traduits dans les gabarits, là où ils
s'affichent.

## Points de grammaire qui ont guidé la traduction

Une traduction mot à mot aurait produit des énoncés fautifs. Trois décisions
structurent le résultat.

### 1. Tous les sujets sont masculins

`NOUNS` (`constants/question.constants.ts`) contient désormais **400 noms
français masculins singuliers**, en remplacement des 1 497 noms anglais. Les
sujets pouvant aussi être des émojis ou des suites de lettres — pour lesquels le
masculin est la valeur par défaut — cette contrainte rend tous les accords
corrects sans machinerie d'accord.

> **Toute addition à cette liste doit être un nom masculin singulier.**

### 2. Les propositions catégoriques sont au singulier

`formatSylPremise` (`utils/syllogism.utils.ts`) :

| Forme logique | Anglais d'origine | Français retenu |
|---|---|---|
| universelle affirmative | `All A is B` | `Tout A est un B` |
| universelle négative | `No A is B` | `Aucun A n'est un B` |
| particulière affirmative | `Some A is B` | `Au moins un A est un B` |
| particulière négative | `Some A is not B` | `Au moins un A n'est pas un B` |

« Certains A sont des B » aurait exigé un pluriel sur un sujet qui est au
singulier (« Certains Emblème sont des Puzzle » est fautif). « Au moins un »
rend par ailleurs exactement la lecture logique du quantificateur particulier.
L'élision de « Aucun A **n'**est » n'a pas d'équivalent anglais.

### 3. Les points cardinaux portent leur préposition au rendu

Les cardinaux sont stockés sous leur forme nue (`"nord"`, `"est"`…) parce qu'ils
servent **à la fois de clé** (carte des opposés, utilisée par la négation) **et
de texte affiché**. La préposition est ajoutée au moment du rendu par
`auCardinal` / `auCardinal2D` : `au nord`, `à l'est`.

C'est ce qui permet à la négation, qui remplace le mot nu, de rester correcte :
`au nord` → `au sud`, `à l'est` → `à l'ouest`. Les deux couples partagent leur
préposition (`au` pour nord/sud, `à l'` pour est/ouest), ce qui rend la
substitution sûre.

Conséquences associées :

- les expressions régulières de négation sont passées de `/(north|south|east|west)/`
  à `/(nord|sud|est|ouest)/`, et de `/(before|after|below|above)/` à
  `/(avant|après|plus bas|plus haut)/`, avec leurs cartes d'opposés ;
- « pas » étant invariable, la marque de pluriel a été retirée (`à trois pas`) ;
  « niveau » prend un `x`, « heure » un `s` ;
- le cadre des prémisses 3D est `est … par rapport à` et non `est … de`, car le
  complément peut être « dans la même direction cardinale », qui refuse « de » ;
- `# steps` est interpolé en `immédiatement` ou `à N pas`, sans préposition dans
  le modèle — d'où `EnumArrangements.NStepsLeft = "est # steps à gauche de"`.

## Exemples des tutoriels

Les énoncés donnés en exemple ont été réécrits avec les tournures que les
générateurs produisent réellement, et avec des noms masculins. Un tutoriel qui
enseignerait une formulation absente du jeu serait pire qu'un tutoriel en
anglais.

## Fichiers portant des modifications de traduction

```
src/app/syllogimous/constants/question.constants.ts   NOUNS, NUMBER_WORDS, EnumArrangements
src/app/syllogimous/utils/syllogism.utils.ts          propositions catégoriques
src/app/syllogimous/utils/question.utils.ts           relations, analogies, agencements
src/app/syllogimous/services/game.service.ts          directions 2D et 3D, graphes, consignes
src/app/**/*.html                                     interface et tutoriels
```
