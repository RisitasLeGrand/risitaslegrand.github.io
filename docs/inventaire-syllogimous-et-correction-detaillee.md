# Inventaire Syllogimous v4 et contrat de correction détaillée

**À valider avant tout code.** Les deux prompts complémentaires exigent chacun un tableau
préalable : l'inventaire comparé (prompt « Reprise native », étape 1) et le tableau de
couverture des corrections (prompt « Correction détaillée », livrable 1). Les voici réunis,
parce qu'ils partagent le même registre de moteurs.

Dépôt lu : `github.com/4skinSkywalker/Syllogimous-v4`, cloné en local
(`--depth 1`), lu pour comprendre les mécaniques — aucun fichier n'est copié dans le site.

---

## 0. Correction d'un point de départ : l'état réel du registre

Le prompt parle de « 29 moteurs et 9 systèmes déjà spécifiés ». Le registre du site
en contient aujourd'hui **16 moteurs et 10 systèmes**, soit **118 couples moteur × système
praticables** (vérifié en exécutant `couples(MOTEURS, SYSTEMES)`).

| Catégorie | Moteur (`id`) | Systèmes acceptés |
|---|---|---|
| induction | `inferer-relation` | les 10 |
| induction | `reseau-relationnel` | les 10 |
| isomorphisme | `algebre-cachee` | les 10 |
| isomorphisme | `recherche-motif` | les 10 |
| isomorphisme | `sous-systeme-commun` | les 10 |
| isomorphisme | `isomorphisme-partiel` | les 10 |
| analogie | `completion-analogie` | les 10 |
| analogie | `analogie-intruse` | les 10 |
| incompletude | `ensembles-possibles` | `plane`, `space`, `rcc8`, `allen` |
| incompletude | `contradiction` | 9 (tous sauf `digraph`) |
| incompletude | `premisses-minimales` | 9 (tous sauf `digraph`) |
| incompletude | `premisse-manquante` | 9 (tous sauf `digraph`) |
| algebres | `entre-deux` | `line` |
| algebres | `projection` | `plane`, `space` |
| algebres | `cadres` | `plane`, `space` |
| algebres | `echange-axes` | `plane`, `space` |

**Systèmes (10)** : `line` (Ligne), `plane` (Plan), `space` (Volume), `groups` (Équipes),
`digraph` (Réseau de services), `poset` (Ordre partiel), `poset-ouvert`, `cyclic`
(Dominance cyclique), `rcc8` (Régions), `allen` (Intervalles).

**Conséquence sur les deux prompts.** Plusieurs noms cités dans le prompt « Correction
détaillée » ne sont pas des moteurs : « RCC8 Regions », « Interval Algebra », « Cyclic
Dominance » sont des **systèmes** (`rcc8`, `allen`, `cyclic`) sur lesquels tournent des
moteurs existants ; « Possibility Sets » est le moteur `ensembles-possibles`. Et
**six noms n'existent nulle part** : `Structure Match`, `Cross-System`, `Second-Order`,
`Partial` (analogie), `Mapping Conflict`, `Transformation Matching`, `Axis Maps`,
`Mutual Moves`, `Pivot Transforms`, `Oblique Basis`. Le tableau de couverture de la
partie B ne les traite donc pas : **la correction détaillée sera livrée pour les 16 moteurs
qui existent, plus les moteurs nouveaux validés en partie A.** Si vous voulez aussi les
moteurs manquants de l'ancien cahier des charges, c'est un lot supplémentaire à décider.

---

# Partie A — Inventaire Syllogimous v4 et comparaison

## A.1 Ce que contient Syllogimous v4 : 12 types de questions

Source : `EnumQuestionType` (`src/app/syllogimous/constants/question.constants.ts`),
`QUESTION_TYPE_SETTING_PARAMS` (`settings.constants.ts`), les douze générateurs
`create*` de `game.service.ts`, et les dossiers de tutoriels.

| # | Type | Mécanique exacte | Structure interne | Réponse |
|---|---|---|---|---|
| 1 | **Distinction** | Chaîne de prémisses « est identique à » / « est l'opposé de ». Les entités se répartissent en **deux classes** ; la conclusion porte sur une paire. | `buckets: [[…],[…]]` | **vrai / faux** |
| 2 | **Comparison Numerical** | Chaîne « plus que » / « moins que » → **ordre total** | `bucket: string[]` | vrai / faux |
| 3 | **Comparison Chronological** | Chaîne « après » / « avant » → ordre total | `bucket` | vrai / faux |
| 4 | **Syllogism** | Quantificateurs **tous / aucun / certains / certains… ne… pas** (formes A, E, I, O). Trois générateurs (`All`, `Fredo`, `Canyon`) ; validité décidée par une table de **26 codes de règles valides** à 4 chiffres (`VALID_RULES`). Polysyllogismes au-delà de 2 prémisses. | `rule: string`, `bucket` | vrai / faux |
| 5 | **Linear Arrangement** | Agencement sur une **ligne** : « est adjacent et à gauche de », « est à côté de », « est à N pas à gauche de », « est à gauche de »… (`EnumArrangements`) ; énumération des arrangements compatibles (`getLinearWays`) | `IArrangementPremise[]` | vrai / faux |
| 6 | **Circular Arrangement** | Mêmes relations + « est diamétralement opposé à » sur un **anneau** (`getCircularWays`) | id. | vrai / faux |
| 7 | **Direction** | Coordonnées (x, y), **cardinaux stricts et directs** (Nord/Sud/Est/Ouest, jamais « nord-est ») + écart transversal | `coords: [nom,x,y][]` | vrai / faux |
| 8 | **Direction3D Spatial** | Coordonnées (x, y, z), cardinaux + dessus/dessous | `coords3D` | vrai / faux |
| 9 | **Direction3D Temporal** | Plan (x, y) + **axe de temps** (avant/après) comme troisième dimension | `coords3D` | vrai / faux |
| 10 | **Graph Matching** | Deux listes d'arêtes étiquetées `↔ → ←` : **sont-elles isomorphes ?** (`areGraphsIsomorphic`) | `graphPremises`, `graphConclusion` | vrai / faux |
| 11 | **Analogy** | « A est à B ce que C est à D », où A:B et C:D sont **deux sous-questions de types de base différents** (comparaison × direction, etc.). Exige au moins deux types de base actifs. | composition | vrai / faux |
| 12 | **Binary** | **Opérateurs propositionnels** sur des sous-questions prises comme atomes : `AND`, `NAND`, `OR`, `NOR`, `XOR`, `XNOR`. Exige ≥ 2 types de base et ≥ 2 opérateurs. | composition | vrai / faux |

**Les douze types répondent par vrai/faux.** C'est le format de base : *N prémisses mélangées
+ une conclusion à valider*. Votre hypothèse était juste.

## A.2 Les réglages, qui sont transversaux et non par type

| Réglage | Portée | Effet |
|---|---|---|
| `minNumOfPremises` / `maxNumOfPremises` | par type | **2 à 20** partout, sauf `Analogy` (min 3) et `Binary` (min 4) |
| `negation` | global | Une relation est énoncée **par son contraire barré** : « A est ~~l'opposé de~~ B » pour dire « identique ». Activé à partir du palier 6. |
| `meta` | global | Une prémisse est remplacée par une **prémisse du second ordre** : « A est à B ce que C est à D », éventuellement niée. Activé à partir du palier 7. Nombre : `1 + hasard(⌊(N−1)/2⌋)`. |
| `meaningfulWords` | global | Noms communs anglais (liste `NOUNS`, ~1 500 entrées) **ou** pseudo-mots consonne-voyelle-consonne (`QAR`, `TIV`…) |
| `useEmojis` | global | Entités remplacées par des émojis |
| opérateurs binaires | `Binary` | Les six opérateurs activables un par un |

**Progression** : 15 paliers nommés (`Adept` → `Transcendent`) par tranches de 250 points,
**± 10 points par item**, et une `TIERS_MATRIX` qui débloque les types palier par palier
(palier 0 : les trois chaînes ; 1 : syllogisme ; 2 : agencement linéaire ; 3 : circulaire ;
4 : direction 2-D ; 5 : 3-D et analogie ; 6 : appariement de graphes et binaire).
Le nombre de prémisses est géré par type (« unité d'entraînement »), indépendamment du palier.

**Garde-fou de génération** : `isPremiseLikeConclusion` rejette l'item dont la conclusion
est l'une des prémisses ; les prémisses sont **mélangées** avant affichage.

## A.3 Comparaison avec les moteurs du site

| Type Syllogimous | Verdict | Détail |
|---|---|---|
| **Graph Matching** | **déjà couvert** | `reseau-relationnel`, `isomorphisme-partiel` et `sous-systeme-commun` sur `digraph` font déjà de l'isomorphisme, et avec des questions plus exigeantes qu'un vrai/faux. Au plus : ajouter un **réglage « verdict binaire »** à `isomorphisme-partiel`. Rien de neuf. |
| **Direction** (2-D) | **partiellement couvert** | Le système `plane` existe et porte le bon vocabulaire. Ce qui manque est le **format** (chaîne de prémisses + conclusion vrai/faux), pas le système. → traité par le moteur nouveau n° 1 appliqué à `plane`. |
| **Direction3D Spatial** | **partiellement couvert** | Système `space`. Idem. |
| **Direction3D Temporal** | **partiellement couvert** | `space` avec un axe étiqueté « avant / après ». `axes.ts` sait fabriquer un système-produit : un nouveau **système `plan-temps`** suffit (3 lignes de déclaration), pas un moteur. |
| **Comparison Numerical** | **partiellement couvert** | Système `line`. Format absent. |
| **Comparison Chronological** | **partiellement couvert** | `line` avec libellés « avant / après » → **système `frise`** déclaré sur `axes.ts`. |
| **Linear Arrangement** | **partiellement couvert** | `line` donne l'ordre, mais pas les relations d'**adjacence** et de **distance** (« à N pas à gauche »). → **réglage de système** : enrichir `line` d'un vocabulaire d'adjacence, ou déclarer `rang` à côté. |
| **Distinction** | **absent** | Aucun système d'**équivalence à deux classes**. → nouveau système `partition` (classes d'équivalence, relations « même classe » / « classe opposée »). |
| **Circular Arrangement** | **absent** | `cyclic` est une **dominance** (Z₃/Z₅, « bat »), pas un anneau de **positions**. → nouveau système `anneau` (positions sur un cercle, avec « diamétralement opposé »). |
| **Syllogism** | **absent** | Aucun système de **classes quantifiées**. C'est le plus gros manque : il faut un système `classes` (A, E, I, O), son solveur, et le diagramme d'Euler pour la correction. |
| **Analogy (inter-types)** | **partiellement couvert** | `completion-analogie` et `analogie-intruse` existent, mais **à l'intérieur d'un seul système**. L'analogie **inter-systèmes** avec correspondance d'axes est absente. → nouveau moteur. |
| **Binary** | **absent** | Rien dans le site ne compose deux items par un opérateur propositionnel. → nouveau moteur, le plus intéressant du lot : il se branche sur n'importe quel couple de sous-items. |
| **Négation de surface** | **absent** | → réglage transversal des moteurs de chaîne. |
| **Prémisses du second ordre** | **absent** | → réglage transversal des moteurs de chaîne. |
| **Pseudo-mots** | **partiellement couvert** | `groups` a déjà des pseudo-noms (`Adrar`, `Belon`…) ; `axes` utilise `A`…`H`. → **générateur partagé de mots-fantômes français**, réutilisé par tous les systèmes. |
| 15 paliers à ± 10 points | **déjà couvert autrement** | Le site a sa propre progression (XP, badges, déblocage par famille). On ne la remplace pas. |

## A.4 Ce qu'il faut donc écrire : une famille et trois moteurs

### Famille nouvelle : « Chaînes de prémisses » (`chaines`)

| Moteur proposé | Ce qu'il demande | Réponse | Systèmes |
|---|---|---|---|
| **1. `chaine-conclusion`** | N prémisses mélangées, une conclusion : **vraie ou fausse ?** C'est le format de base de Syllogimous, porté tel quel. | vrai / faux | tous les systèmes à régime `algebre` ou `clos` : `line`, `frise`, `plane`, `space`, `plan-temps`, `partition`, `anneau`, `rang`, `poset`, `cyclic`, `rcc8`, `allen`, `groups` |
| **2. `chaine-composee`** | Deux chaînes jointes par un opérateur (`et`, `ou`, `ni… ni`, `l'un ou l'autre mais pas les deux`, …) : **le composé est-il vrai ?** (= `Binary`) | vrai / faux | idem, deux sous-items de systèmes différents |
| **3. `analogie-inter-systemes`** | « A est à B (dans un système) ce que C est à D (dans un autre) » : vrai ou faux, avec correspondance d'axes (= `Analogy`) | vrai / faux | couples de systèmes compatibles |

### Systèmes nouveaux ou enrichis

| Système | Statut | Contenu |
|---|---|---|
| `partition` | nouveau | classes d'équivalence, « même classe » / « classe opposée » (Distinction) |
| `anneau` | nouveau | positions sur un cercle, voisinage, « diamétralement opposé » (Circular Arrangement) |
| `classes` | nouveau | quantificateurs A/E/I/O, solveur de syllogisme et de polysyllogisme (Syllogism) |
| `frise` | nouveau, déclaratif | `line` au vocabulaire temporel (Comparison Chronological) |
| `plan-temps` | nouveau, déclaratif | `plane` + axe de temps (Direction3D Temporal) |
| `rang` | enrichissement de `line` | adjacence et distance : « adjacent et à gauche », « à N pas à gauche » (Linear Arrangement) |

### Réglages transversaux nouveaux

| Réglage | Effet |
|---|---|
`negation` | énoncer une relation par son contraire barré |
`secondOrdre` | remplacer une prémisse par « A est à B ce que C est à D » |
`motsFantomes` | pseudo-mots français plausibles au lieu des noms réels |
`distracteurs` | ajouter des prémisses inutiles à la déduction (déjà requis par la correction détaillée, qui doit les signaler) |

### Échelle de difficulté propre, et le problème du 50 %

Les trois moteurs nouveaux répondent par **vrai/faux** : une chance sur deux au hasard.
Règle proposée, à valider : la difficulté ne monte **qu'après 8 items du moteur
dont au moins 7 justes** (≥ 87,5 %, soit p < 0,04 sous l'hypothèse du hasard), et
redescend après 8 items dont 4 ou moins. Les moteurs existants, à choix multiple,
gardent leur règle actuelle.

### Ce que l'on ne reprend pas, et pourquoi

| Écarté | Raison |
|---|---|
| Les 15 paliers `Adept`…`Transcendent` et le ± 10 points | Le site a sa progression (XP, badges, déblocage par famille) ; en ajouter une seconde brouillerait les deux. |
| Les émojis comme entités | Illisible pour un lecteur d'écran, et la consigne d'accessibilité du site l'interdit de fait. |
| `Graph Matching` comme moteur distinct | Doublon des trois moteurs d'isomorphisme existants. |
| Les listes `NOUNS` et les pseudo-mots anglais | Tout le texte doit être en français ; générateur propre. |

---

# Partie B — Contrat de correction détaillée

## B.1 Le contrat de trace, imposé à tous les générateurs

Produit **par le solveur**, jamais par du code écrit à côté — c'est la condition pour que
l'explication ne puisse pas contredire la réponse attendue.

```
TraceResolution = {
  etapes: Etape[]            // dans l'ordre ; la dernière conclut
  elementsUtiles: Ref[]      // prémisses, arêtes, nœuds réellement mobilisés
  elementsInutiles: Ref[]    // distracteurs, à signaler comme tels
  conclusion: Verdict        // DOIT être égal à la bonne réponse de l'item
}

Etape = {
  rang: number
  utilise: Ref[]             // ce que cette étape consomme
  produit: Fait | Ensemble   // ce qu'elle établit
  loi?: string               // « composition », « transitivité », « conversion »…
  legende: string            // une phrase française, entités nommées
  surbrillance: Ref[]        // ce que le schéma doit allumer à cette étape
}

Ref = { sorte: 'premisse'|'entite'|'arete'|'noeud'|'option'|'axe', clef: string }

EtiquetteErreur =
  | 'relation-inverse' | 'transitivite-abusive' | 'leurre-de-surface'
  | 'option-redondante' | 'option-oubliee' | 'axe-permute'
  | 'quantificateur-affaibli' | 'cycle-ignore' | 'hors-zone' | 'non-etiquete'
```

Chaque option de réponse fausse porte son `EtiquetteErreur`. Le registre de moteurs
reçoit le champ **`correctionDetaillee: boolean`** — `true` partout, `false` pour le seul
Quad N-Back.

**Tests automatiques** (livrable 5) : pour chaque moteur, 200 items tirés au hasard ;
on vérifie que `trace.conclusion` est **identique** à la bonne réponse déclarée, que
`elementsUtiles ∪ elementsInutiles` couvre l'énoncé sans recouvrement, et que chaque
distracteur porte une étiquette.

## B.2 Le vocabulaire visuel commun

Six marqueurs, distingués par **forme, icône ou motif — jamais par la couleur seule** :

| Marqueur | Forme |
|---|---|
| élément utilisé | trait **plein épais** + puce pleine |
| élément inutile | trait **pointillé fin** + puce creuse, grisé |
| déduit | trait **tireté** qui devient plein à l'étape suivante |
| ta réponse | marqueur **losange**, contour hachuré |
| bonne réponse | marqueur **rond**, contour plein + ✓ |
| exclu | **croix** barrant l'élément + hachures |

Déroulé pas à pas (« étape précédente / suivante »), lecture automatique facultative,
**manuelle et sans mouvement** si `prefers-reduced-motion`. Alternative textuelle
obligatoire par schéma. Tokens de thème clair/sombre, `viewBox` adaptatif, pas de
défilement horizontal sur mobile.

## B.3 Tableau de couverture : moteur → trace → forme visuelle → composants

| Moteur | Forme de la trace | Forme visuelle de la correction | Composant |
|---|---|---|---|
| `chaine-conclusion` *(nouveau)* | dérivation « P1 + P3 ⇒ A avant C », une étape par composition | entités sur le **support naturel** : ligne (ordre), frise (temps), grille 2-D/3-D (directions), anneau (circulaire), **diagramme d'Euler** (classes), diagramme de Hasse (poset). Prémisses utilisées allumées une à une, lien déduit en tireté puis plein, conclusion proposée tracée en regard. | `SchemaLigne`, `SchemaGrille`, `SchemaAnneau`, `SchemaEuler`, `SchemaHasse` |
| `chaine-composee` *(nouveau)* | valeur de vérité de chaque membre, puis **table de l'opérateur**, ligne appliquée surlignée | deux sous-schémas côte à côte, chacun marqué vrai/faux, et la table de l'opérateur avec sa ligne active | `SchemaCompose` + table |
| `analogie-inter-systemes` *(nouveau)* | relation A→B, **correspondance d'axes**, application à C | deux schémas côte à côte reliés par la même flèche de transformation ; axes appariés nommés | `SchemaAnalogie` |
| `ensembles-possibles` | composition pas à pas + **table de composition** citée ; verdict par option | `rcc8` : les deux régions dessinées dans chaque configuration (DC, EC, PO, EQ, TPP, NTPP et inverses), marquées possible/exclue. `allen` : les deux intervalles sur une même ligne du temps. `plane`/`space` : la grille avec la zone encore possible. | `SchemaRegions`, `SchemaIntervalles`, `SchemaGrille` |
| `contradiction` | le **cycle conflictuel** complet, puis le fait commun à tous les cycles | graphe des faits, cycle entouré, fait commun marqué | `SchemaGraphe` |
| `premisse-manquante` | le chemin incomplet, le fait ajouté, ce qu'il permet | graphe des faits, **nouvelle arête** qui ferme le chemin | `SchemaGraphe` |
| `premisses-minimales` | preuve de suffisance + preuve de **nécessité** (retirer chaque fait casse le chemin) | sous-ensemble retenu mis en valeur ; animation « l'arête s'efface, le chemin se rompt » ; en cas de sélection redondante ou insuffisante, le fait en trop ou manquant marqué | `SchemaGraphe` |
| `completion-analogie` | relation induite A→B, application à C | deux schémas côte à côte ; le leurre de surface montré avec sa correspondance **brisée** | `SchemaAnalogie` |
| `analogie-intruse` | relation commune aux trois paires, puis l'écart de la quatrième | quatre petits schémas en ligne, l'intruse cerclée | `SchemaAnalogie` |
| `recherche-motif` | plongement nœud à nœud du motif trouvé ; pour chaque motif rejeté, l'arête qui manque | les deux réseaux côte à côte, **liens d'appariement** tracés, nœuds sans partenaire cerclés | `SchemaAppariement` |
| `sous-systeme-commun` | appariement maximal, puis preuve qu'on ne peut pas faire mieux | idem, taille du motif commun affichée | `SchemaAppariement` |
| `isomorphisme-partiel` | vérification paire par paire, arrêt sur la paire fautive | les deux réseaux, la paire fautive **barrée**, la correction indiquée | `SchemaAppariement` |
| `reseau-relationnel` | appariement par degrés et structure | idem | `SchemaAppariement` |
| `algebre-cachee` | propriétés testées (réflexivité, symétrie, transitivité) sur les exemples montrés ; l'exemple qui élimine chaque algèbre candidate | tableau de propriétés + le contre-exemple mis en évidence sur le graphe | `SchemaProprietes` |
| `inferer-relation` | règle induite, exemple par exemple, puis application | exemples « avant → après » alignés, règle animée sur chacun, puis appliquée ; l'exemple qui réfute l'hypothèse choisie mis en évidence | `SchemaInduction` |
| `entre-deux` | positions compatibles ; l'ambiguïté résiduelle nommée | ligne avec le **segment « entre »** mis en valeur et les positions encore possibles | `SchemaLigne` |
| `projection` | relation complète, puis axe retiré, puis relation restante | grille avant/après avec l'axe supprimé estompé | `SchemaGrille` |
| `cadres` | cap égocentrique de l'observateur, puis rotation du repère | grille avec la **flèche d'orientation** de chaque entité, et le repère tourné | `SchemaGrille` |
| `echange-axes` | permutation appliquée, coordonnée par coordonnée | grille avant/après superposées, axes permutés nommés | `SchemaGrille` |
| sur système `cyclic` (tous moteurs) | l'endroit exact où la **transitivité échoue** | cycle Z₃/Z₅ dessiné en cercle avec ses flèches « bat » ; l'inférence transitive attendue à tort **barrée** à l'endroit de l'échec | `SchemaCycle` |
| **Veridical Mapping** (toutes routes) | pas une dérivation : route source → cible, famille, position sur l'échelle commune, valeur attendue, valeur donnée, écart en unité et en **z** | deux **échelles parallèles** alignées avec stimulus, attendu, donné et l'écart tracé entre les deux. Route « plans 2-D » : deux plans côte à côte. Route modulaire : un **cercle face à une ligne**. Bruit de surface : la teinte parasite montrée et désignée comme non informative. | `SchemaEchelles`, `SchemaPlans`, `SchemaCercleLigne` |

**Exercices sans représentation visuelle raisonnable : aucun.** Les 16 moteurs et les
3 moteurs nouveaux ont tous un support naturel, et Veridical Mapping a ses échelles.
Aucun ne se rabat sur la liste d'étapes seule.

**Réserve à signaler** : le prompt demande, pour Veridical Mapping, « pour les variantes de
**redintégration** et de bruit, montrer le motif d'origine complet ». Le module actuel a bien
le **bruit de surface**, mais **aucune variante de redintégration** n'existe dans le code.
Soit on l'écarte du périmètre, soit elle fait l'objet d'un lot propre, à décider.

Chaque correction se termine par un lien **« Revoir le principe de ce moteur »** vers
l'espace « Learn » de l'exercice.

## B.4 Ce que cela change dans l'existant

Le type `Item` porte aujourd'hui `explication: string` — une phrase unique, affichée en cas
d'erreur. Il faut la remplacer par la trace structurée, donc **retoucher les 16 moteurs**,
leurs solveurs, et le composant `Bloc.svelte`. Les types de `Bloc` existants
(`texte`, `faits`, `grille`, `graphe`, `tableau`) ne suffisent pas : il faut y ajouter
`ligne`, `anneau`, `euler`, `hasse`, `regions`, `intervalles`, `cycle`, `echelles`,
`appariement`. C'est le gros du travail, et c'est pourquoi je préfère le faire valider.

---

# Découpage proposé

| Lot | Contenu | Dépend de |
|---|---|---|
| **A0** | Ce document, validé | — |
| **A1** | Systèmes nouveaux : `partition`, `anneau`, `frise`, `plan-temps`, `rang` ; générateur de mots-fantômes français | A0 |
| **A2** | Système `classes` (quantificateurs A/E/I/O) et son solveur | A1 |
| **A3** | Moteur `chaine-conclusion` + réglages `negation`, `secondOrdre`, `distracteurs` + échelle à seuil de réussite | A1, A2 |
| **A4** | Moteurs `chaine-composee` et `analogie-inter-systemes` | A3 |
| **A5** | Écran « Mon entraînement » : cases à cocher par moteur, recherche, préréglages, mémorisation IndexedDB, « Reprendre ma sélection », nombre d'items, ordre entrelacé ou par moteur, garde-fou de sélection vide, mode libre | A3 |
| **A6** | Attribution CC BY-NC 3.0 dans l'« à propos » + note au README | A0 |
| **B1** | Contrat de trace et d'étiquettes, nouveaux types de `Bloc`, vocabulaire visuel, composants de schéma | A0 |
| **B2** | Migration des 16 moteurs existants vers la trace | B1 |
| **B3** | Trace des 3 moteurs nouveaux | B1, A4 |
| **B4** | Veridical Mapping : trace perceptive et schémas | B1 |
| **B5** | Bouton « Correction détaillée », déroulé pas à pas, vue « ta réponse / bonne réponse », revue de fin de session, `correctionDetaillee` au registre | B2, B3, B4 |
| **B6** | Tests automatiques trace ↔ bonne réponse, par moteur | B2, B3, B4 |

## Attribution prévue (lot A6)

> Les exercices de la famille « Chaînes de prémisses » sont inspirés de **Syllogimous v4**,
> de **4skinSkywalker** (<https://github.com/4skinSkywalker/Syllogimous-v4>), diffusé sous
> licence **CC BY-NC 3.0** (<https://creativecommons.org/licenses/by-nc/3.0/>).
> Ils ont été **entièrement réécrits et modifiés** pour ce site : aucun code, aucun style et
> aucune dépendance du projet d'origine n'y figurent, les énoncés sont rédigés en français,
> et les mécaniques ont été adaptées aux systèmes relationnels et à la progression du site.
> Usage **strictement non commercial**.

## Questions à trancher avant A1

1. **Le seuil de montée en difficulté** pour les moteurs vrai/faux : 7 bonnes sur 8,
   ou préférez-vous plus exigeant ?
2. **Les six moteurs nommés dans le prompt B mais absents du registre**
   (`Structure Match`, `Cross-System`, `Second-Order`, `Partial`, `Mapping Conflict`,
   `Transformation Matching`, `Axis Maps`, `Mutual Moves`, `Pivot Transforms`,
   `Oblique Basis`) : lot supplémentaire, ou on s'en tient aux 16 existants ?
3. **La redintégration en Veridical Mapping**, qui n'existe pas : hors périmètre, ou lot propre ?
4. **`Graph Matching`** : simple réglage « verdict binaire » de `isomorphisme-partiel`,
   ou on n'y touche pas du tout ?

---

# Partie C — Correction détaillée des QCM de révision

Troisième prompt. Nature différente des deux premiers : la correction n'est **pas calculée**
par un solveur, c'est un **contenu rédigé et stocké** avec chaque question. D'où un
travail de production de contenu, et non d'architecture.

## C.1 L'ampleur réelle, mesurée

| Périmètre | Fiches / fichiers | Questions | État actuel |
|---|---|---|---|
| **Quiz de cours** — `## Quiz` des fiches | 321 fiches, 7 matières | **4 352** | `explication:` présente sur **4 352 / 4 352** (100 %) |
| **QCM - DGFiP** | 8 rubriques | **540** | `explication:` **obligatoire** au schéma, donc présente partout ; 16 questions portent déjà `incertain:` |
| **Total** | — | **4 892** | — |

Détail par matière de cours :

| Matière | Fiches | Questions de quiz |
|---|---|---|
| questions-europeennes | 58 | 941 |
| economie | 66 | 797 |
| questions-internationales | 50 | 752 |
| finances-publiques | 44 | 600 |
| droit-public | 50 | 597 |
| questions-sociales | 44 | 555 |
| cas-pratique | 9 | 110 |

Détail par rubrique DGFiP :

| Rubrique | Questions | dont `incertain` |
|---|---|---|
| culture-generale | 225 | 8 |
| maths | 134 | 4 |
| francais | 82 | 1 |
| logique | 64 | 3 |
| culture-numerique | 10 | 0 |
| environnement-administratif | 10 | 0 |
| union-europeenne | 10 | 0 |
| anglais | 5 | 0 |

**À quoi cela engage.** Un bloc `correction` complet demande, par question : un `resume`,
une entrée `par_option` (≈ 4 par question, soit **~19 500 verdicts** au total), un `detail`,
une décision de `visuel` et, pour les cours, un `rappel_de_cours`. C'est, de loin, le plus
gros des trois prompts — et le seul dont le coût croît avec la banque.

## C.2 Le point de séquencement qu'il faut trancher

Le prompt demande que le bloc `correction` devienne **obligatoire** et que
**le build échoue** sur ce contrôle. Appliqué tel quel aujourd'hui, cela **casse le build
pour 4 892 questions** et bloque toute autre avancée jusqu'à ce que la banque entière soit
reprise.

**Proposition, à valider :** le contrôle `npm run check-content` fonctionne en deux régimes.

| Régime | Portée | Effet sur le build |
|---|---|---|
| **bloquant** | toute rubrique ou matière marquée `correctionsMigrees: true`, et toute question nouvelle ou modifiée | **échec** du build |
| **inventaire** | le reste de la banque | **rapport** chiffré, pas d'échec |

La garantie demandée est ainsi tenue pour tout ce qui s'écrit désormais, sans geler le site.
Chaque lot de rattrapage bascule sa rubrique en régime bloquant quand il est terminé. Le
drapeau n'est pas un contournement : il **se retire** rubrique par rubrique et disparaît
quand la banque est complète.

**Bonne nouvelle pour le coût** : `explication` existe déjà sur les 4 892 questions. La
migration vers `correction.resume` est donc **mécanique**, et le travail rédactionnel se
concentre sur `par_option`, `detail` et le `visuel`.

## C.3 Extension du schéma

Dans `scripts/lib/schema.mjs`, les deux schémas convergent vers un bloc commun.

| Champ | Type | Obligatoire | Note |
|---|---|---|---|
| `resume` | texte | oui | reprend l'`explication` actuelle à la migration |
| `par_option[]` | `{ verdict: juste\|faux, pourquoi }` | oui | **le nombre doit égaler celui des options** — contrôlé |
| `detail` | texte | oui | raisonnement ou méthode, étape par étape |
| `rappel_de_cours[]` | identifiants de fiche | non | contrôlé : la fiche doit exister |
| `sources[]` | `{ nom, url }` | non | obligatoire de fait pour droit et finances publiques |
| `confiance` | `haute` \| `moyenne` | oui | `moyenne` reprend et remplace le `incertain:` du schéma DGFiP |
| `visuel.type` | `frise\|tableau\|schema\|courbe\|venn\|figure\|grille\|texte_annote\|aucun` | oui | **une décision est exigée**, `aucun` admis avec `raison_aucun` |
| `visuel.donnees` | objet déclaratif | si type ≠ `aucun` | rendu en SVG par les composants du site |
| `visuel.legende` / `visuel.alt` | texte | si type ≠ `aucun` | `alt` obligatoire |
| `visuel.raison_aucun` | texte | si type = `aucun` | contrôlé |

`confiance: moyenne` s'affiche à la personne : « réponse déterminée sans corrigé officiel ».
Le champ `incertain:` existant des 16 questions DGFiP y est converti sans perte.

## C.4 Bibliothèque de visuels déclaratifs

Huit types, chacun avec son schéma de `donnees` et son composant SVG, rendus avec les
tokens de thème et le **même vocabulaire visuel que la partie B** (forme et motif, jamais
la couleur seule ; `alt` obligatoire ; `viewBox` adaptatif ; pas de défilement horizontal).

| Type | `donnees` | Usage principal |
|---|---|---|
| `frise` | jalons datés, intervalles | culture générale, histoire des institutions |
| `tableau` | en-têtes, lignes, cellules marquées | tableaux comparatifs, tables de valeurs |
| `schema` | nœuds, liens orientés, niveaux | pyramide des normes, institutions de l'Union, circuit de la dépense, voies de recours |
| `courbe` | fonctions ou points, axes nommés | offre et demande, suites, fonctions |
| `venn` | ensembles, intersections, zones marquées | logique, syllogismes, tous/certains/aucun |
| `figure` | points, segments, angles, cotes | géométrie |
| `grille` | cases, valeurs, cases à trouver | logique, suites, tables de vérité |
| `texte_annote` | segments du texte + étiquettes | français : sujet, verbe, accords, règle d'orthographe |

Contrainte respectée : **rien d'externe**, aucune image distante, aucune carte ni photo
reprise ailleurs — uniquement des schémas originaux décrits en données.

## C.5 Où le bouton apparaît, et selon quelles règles

| Contexte | Règle |
|---|---|
| **Quiz de cours** | bouton après validation, **que la réponse soit juste ou fausse**, mis en avant après une erreur |
| **QCM - DGFiP, session chronométrée** (54 questions, +1 / −0,5 / 0) | **aucune correction pendant la session** — conditions d'examen. Correction question par question sur l'**écran de résultats** |
| **Rappels n−1 / n−2 / n−4** de la planification | comme les quiz de cours |
| **Revue du journal d'erreurs** | comme les quiz de cours |
| **Flashcards** | hors périmètre, par votre consigne |
| **Cog-Training** | hors périmètre (partie B) |

Ouvrir une correction est **sans effet** sur le score, l'XP, le niveau estimé par matière et
le journal d'erreurs : une mauvaise réponse alimente le journal comme prévu.

**Ordre d'affichage adapté à la réponse donnée** : l'option choisie d'abord (pourquoi elle est
fausse, ou pourquoi elle est juste), puis le raisonnement vers la bonne réponse, puis les
autres options. Le contenu est stocké une fois ; seul son ordre varie.

## C.6 Chiffrement et chargement à la demande

Les corrections et leurs visuels entrent dans le contenu **chiffré** — `content/` reste
gitignoré, jamais commité en clair. Elles sont déchiffrées **au clic**, dans un fichier
séparé de celui de la session, pour ne pas alourdir le chargement : réutilisation de la
barre de progression existante, avec son garde-fou de délai et d'erreur, afin qu'aucun
écran ne reste bloqué sur « Déchiffrement en cours… ».

## C.7 Un point de consigne à lever explicitement

Vous m'avez donné pour instruction permanente d'**oublier devenez-fonctionnaire.fr**, et je
m'y suis tenu. Ce prompt mentionne les questions de catégorie B qui en viennent.

**Ce que je ferai, sauf avis contraire :** je n'y retourne pas, je ne le consulte pas et je ne
le cite pas comme source à interroger. Je me sers uniquement de ce qui est **déjà dans la
banque locale**. Il se trouve que c'est sans conséquence pratique : le champ `source:` des
540 questions DGFiP est déjà rédigé sous la forme « Contrôleur DGFiP — annale 2022-2023,
culture générale », donc l'attribution demandée **existe déjà** et sera reportée dans
`correction.sources` à la migration.

## C.8 Lot pilote proposé

Conformément au prompt : **10 questions par rubrique DGFiP et par matière de cours**, soit
**8 × 10 + 7 × 10 = 150 corrections**, présentées pour validation avant la suite.

Choix des 150 : les questions **les plus manquées** d'abord si l'historique en donne, sinon
un tirage couvrant les types de visuels (au moins une `figure`, une `courbe`, un `venn`, une
`grille`, un `texte_annote`, une `frise`, un `schema`, un `tableau` et un `aucun` justifié),
afin que le pilote exerce la bibliothèque entière et non un seul type.

**Vérification avant présentation**, comme demandé : chaque calcul de maths et chaque
raisonnement de logique **contrôlé par script** ; pour le droit et les finances publiques,
aucun article ni chiffre cité sans vérification, et `confiance: moyenne` à défaut.

## C.9 Découpage du lot C

| Lot | Contenu | Dépend de |
|---|---|---|
| **C1** | Extension du schéma (`correction` commun aux deux banques), conversion mécanique `explication` → `resume`, conversion `incertain` → `confiance` | C0 (ce document) |
| **C2** | `npm run check-content` à deux régimes + drapeau `correctionsMigrees` par rubrique | C1 |
| **C3** | Bibliothèque des 8 visuels déclaratifs en SVG, vocabulaire visuel partagé avec la partie B | B1 |
| **C4** | Bouton et écran de correction : quiz de cours, rappels de planification, revue du journal | C1, C3 |
| **C5** | Écran de résultats des sessions DGFiP chronométrées, avec correction par question | C1, C3 |
| **C6** | Chargement et déchiffrement à la demande, barre de progression et garde-fou | C1 |
| **C7** | **Lot pilote : 150 corrections rédigées et vérifiées**, présenté pour validation | C1-C6 |
| **C8** | Rattrapage par lots, rubrique par rubrique et matière par matière, avec bascule en régime bloquant à chaque fin de lot | C7 validé |
| **C9** | Tableau de couverture final : par rubrique, combien de questions ont une correction, un visuel, ou `aucun` justifié | C8 |

## C.10 Questions à trancher avant C1

1. **Le régime à deux vitesses du contrôle de contenu** (C.2) vous convient-il, ou préférez-vous
   que le build échoue tout de suite sur l'ensemble de la banque ?
2. **L'ordre des lots entre les trois prompts.** Les parties B et C partagent la bibliothèque de
   schémas SVG et le vocabulaire visuel : B1 et C3 doivent être faits ensemble, une seule fois.
   Je propose donc : **A0-C0 (validation) → B1+C3 (socle visuel) → C1-C2 (schéma et contrôle)
   → A1-A4 (moteurs) → B2-B6 → C4-C7 (pilote) → A5-A6 → C8-C9 (rattrapage)**.
   La production des 4 892 corrections passe en dernier, puisqu'elle est longue et
   qu'elle n'empêche rien d'autre.
3. **Les 150 questions du pilote** : vous les choisissez, ou je les tire selon le critère de
   couverture des visuels donné en C.8 ?
