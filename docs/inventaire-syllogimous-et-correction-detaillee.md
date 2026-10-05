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

# Décisions arrêtées (4 octobre 2026)

Les quatre points laissés en suspens ont été tranchés ; ce document n'attend plus de validation.

| Question | Décision |
|---|---|
| Seuil de montée en difficulté des moteurs vrai/faux | **7 justes sur 8**, descente à 4 ou moins sur 8. Les moteurs à choix multiple gardent leur règle. |
| Moteurs nommés dans le prompt B mais absents du registre | **Erreur du prompt, confirmée.** Le périmètre est celui des **16 moteurs** existants, plus les 3 moteurs nouveaux de la famille « Chaînes de prémisses ». Aucun lot supplémentaire. |
| Redintégration de Veridical Mapping | **Hors périmètre.** N'existe pas dans le code, n'est pas à créer. Les routes couvertes sont : valeur simple, plans 2-D, modulaire, et le bruit de surface. |
| Choix des 150 questions du lot pilote | **Tirage par couverture des visuels** : au moins une occurrence de chacun des 8 types et un `aucun` justifié, par rubrique et par matière. |

**Ordre d'exécution retenu** : B1 + C3 (socle visuel commun) → C1-C2 (schéma et contrôle de contenu)
→ A1-A4 (systèmes et moteurs) → B2-B6 (traces et bouton) → C4-C7 (écrans et pilote)
→ A5-A6 (écran « Mon entraînement » et attribution) → C8-C9 (rattrapage de la banque).

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

---

# Avancement

## Lot B1 + C3 — socle visuel commun : **livré**

| Fichier | Rôle |
|---|---|
| `src/features/correction/trace.ts` | Le contrat : `Ref`, `EtiquetteErreur`, `DIAGNOSTIC`, `Etape`, `Conclusion`, `TraceResolution`, le **`Journal`** que le solveur alimente en calculant, `memeConclusion`, `conclusionAttendue`, `defautsDeLaTrace` |
| `src/features/correction/vocabulaire.ts` | Les **7 marqueurs**, chacun avec sa forme propre, son glyphe de repli, son token de thème et son sens ; `legende()` et `alternative()` |
| `src/features/correction/registre.ts` | `EXERCICES_COG` et `aCorrectionDetaillee()` — inclusion par défaut, **Quad N-Back seul exclu, avec sa raison écrite** |
| `composants/Cadre.svelte` | L'enveloppe : `viewBox` adaptatif, `role="img"` et `aria-label` obligatoire, légende, trame de hachures partagée |
| `composants/Marqueur.svelte` | Les 7 formes en SVG |
| `composants/Legende.svelte` | La légende des seuls marqueurs employés, glyphe lisible par lecteur d'écran |
| `composants/Deroule.svelte` | Le pas à pas, `aria-live` sur la légende d'étape, **lecture automatique refusée** sous `prefers-reduced-motion` |
| `composants/SchemaLigne.svelte` | Ordres, comparaisons, frises, « entre » : arcs étagés, zones d'indétermination hachurées |
| `composants/SchemaIntervalles.svelte` | Les 13 relations d'Allen, deux intervalles par option, verdict par la forme |
| `composants/SchemaRegions.svelte` | Les 8 relations RCC8, deux disques par option |
| `composants/SchemaCycle.svelte` | Dominance cyclique, avec **l'inférence transitive barrée là où elle échoue** |
| `composants/SchemaEuler.svelte` | Classes quantifiées, avec **témoins** et zones vides marquées `∅` |
| `composants/SchemaHasse.svelte` | Ordres partiels, relations de couverture seules, paire interrogée en pointillés |
| `composants/SchemaAppariement.svelte` | Deux réseaux côte à côte, liens nœud à nœud, orphelins cerclés, paire fautive barrée |
| `composants/SchemaEchelles.svelte` | Veridical Mapping : deux échelles parallèles, route, écart tracé |
| `scripts/essais-correction.mts` | **38 assertions**, `npm run essais:correction` |

**Ce que les essais garantissent.** Que `sceller` refuse une trace sans étape ; que les rangs
se suivent ; qu'un élément qui a servi **cesse** d'être déclaré distracteur ; qu'une conclusion
divergente, une légende vide ou un renvoi orphelin sont signalés ; que **les 7 marqueurs ont 7
formes et 7 glyphes distincts** — l'invariant d'accessibilité, qu'aucun écran ne signalerait s'il
tombait ; que toutes les couleurs passent par un token de thème ; que l'alternative textuelle
accorde correctement ses énumérations ; et que Quad N-Back est le seul exercice exclu, un
exercice inconnu étant **inclus** par défaut.

Les essais engendrent par ailleurs plusieurs milliers d'items sur les 118 couples moteur ×
système et vérifient la cohérence de toute trace rencontrée. Les 16 moteurs sont pour l'instant
listés comme restant à migrer, ce qui est le lot B2 : `MOTEURS_TRACES` est écrit à la main
exprès, pour que migrer un moteur oblige à l'y inscrire et rende l'avancement visible.

**Correction de contenu au passage** : la page d'accueil de Cog-Training annonçait « neuf
systèmes » pour Relational Reasoning ; il y en a **dix**. Corrigé.

### Ce qui reste à faire sur ce socle

- La **vue comparative « votre réponse / bonne réponse »** est outillée (les deux marqueurs
  existent, et `SchemaEchelles` la met en œuvre), mais pour les autres schémas c'est l'appelant
  qui passe les deux marqueurs : elle se vérifiera moteur par moteur au lot B2.
- Les types de `Bloc` ne sont pas encore étendus : les schémas sont des composants autonomes,
  et c'est le lot B5 qui les branchera dans l'énoncé pour la mise en évidence sur place.
- `SchemaEuler` reçoit sa géométrie de l'appelant plutôt que de la calculer : la disposition
  d'un diagramme d'Euler à partir de prémisses quantifiées relève du système `classes`, donc
  du lot A2.

## Lot C1 + C2 — schéma « correction » et contrôle à deux régimes : **livré**

| Fichier | Rôle |
|---|---|
| `scripts/lib/schema.mjs` | `TYPES_VISUEL` (9 types), `visuelSchema`, `correctionSchema`, **`defautsDeLaCorrection`**, et le bloc `correction` branché sur `quizSchema` **et** `questionDgfipSchema` |
| `scripts/lib/corrections-migrees.mjs` | `MATIERES_MIGREES` et `RUBRIQUES_MIGREES` — vides au départ, la liste ne fait que croître |
| `scripts/verifier-corrections.mjs` | `npm run check-content` : le tableau de couverture et les deux régimes |
| `scripts/essais-corrections-contenu.mjs` | **37 assertions**, `npm run essais:corrections` |
| `package.json` | `check-content` câblé dans `npm run contenu`, donc dans `npm run build` |

**L'invariant que ce lot apporte** est le pendant écrit de celui de la partie B :
`defautsDeLaCorrection` refuse une correction qui **contredit la clef de réponse** — une option
donnée juste quand la clef la donne fausse, une bonne réponse oubliée, un nombre d'entrées qui
ne correspond pas aux options. Et ce refus vaut **partout**, périmètre migré ou non : une
correction incohérente est un bug, pas un retard.

Le second contrôle porte sur le visuel. `type: aucun` exige `raison_aucun`, et tout type dessiné
exige `donnees` **et** `alt`. Sans cette contrainte, « aucun » devient le réflexe de qui n'a pas
réfléchi et l'alternative textuelle se perd une question à la fois.

**Le tableau de couverture, imprimé à chaque build :**

| Périmètre | Questions | Corrigées |
|---|---|---|
| questions-europeennes | 941 | 0 |
| economie | 797 | 0 |
| questions-internationales | 752 | 0 |
| finances-publiques | 600 | 0 |
| droit-public | 597 | 0 |
| questions-sociales | 555 | 0 |
| cas-pratique | 110 | 0 |
| **quiz de cours** | **4 352** | **0** |
| culture-generale | 225 | 0 |
| maths | 134 | 0 |
| francais | 82 | 0 |
| logique | 64 | 0 |
| culture-numerique, environnement-administratif, union-europeenne | 10 chacune | 0 |
| anglais | 5 | 0 |
| **QCM - DGFiP** | **540** | **0** |
| **ensemble** | **4 892** | **0 (0 %)** |

C'est le livrable C9 dans sa forme définitive : il se remplira lot par lot, et chaque périmètre
terminé passe de « inventaire » à « migré » en s'inscrivant dans
`scripts/lib/corrections-migrees.mjs`.

**Note sur le prétest.** Il partage `quizSchema` avec le quiz, mais le contrôle ne l'inspecte
pas : un prétest ne corrige rien par construction — « rien n'est compté comme une erreur » —,
de sorte qu'y exiger une correction irait contre sa raison d'être.

## Lot A1 — systèmes nouveaux : **livré**, et un défaut trouvé au passage

| Fichier | Rôle |
|---|---|
| `systemes/grandeur.ts` | Comparaison de **magnitude** : « est plus grand que », axe non strict |
| `systemes/rang.ts` | Places numérotées et **écart exact** : « est à deux places à gauche de » |
| `systemes/anneau.ts` | Six places **en cercle**, avec « est diamétralement opposé à » |
| `systemes/plan-temps.ts` | Un plan, et le **temps** comme troisième axe |
| `noyaux/mots.ts` | Générateur de **mots-fantômes français** prononçables |

Le registre passe de **10 à 14 systèmes**, et les couples praticables de **118 à 169** — sans
qu'une ligne de moteur soit touchée. C'est ce que la séparation système / moteur devait rendre
possible, et la preuve qu'elle tient.

### Deux systèmes de l'inventaire écartés après lecture du code

| Annoncé absent | En fait |
|---|---|
| `partition` (identique / opposé) | **C'est `groups`.** « Alliée de » / « rivale de » est exactement le Z₂ attendu, avec la composition fonctionnelle de l'équilibre structurel. Le créer aurait été le doublon que la consigne interdit. |
| `frise` (comparaison chronologique) | **C'est `line`.** Son vocabulaire est déjà « est avant » / « est après ». Ce qui manquait n'était pas le temps mais la **magnitude**, d'où `grandeur`. |

### Le défaut : une clef de mémo tronquée, qui faussait `space`

En étendant la vérification « la relation du modèle doit figurer parmi les possibles » aux
quatorze systèmes — elle ne portait que sur trois —, `space` a échoué. Cause :

```js
const clef = gauche * (1 << a.taille) + droite;   // taille = 27
```

À vingt-sept relations, les deux masques valent jusqu'à 2²⁷ et leur produit atteint **2⁵⁴**,
au-delà des 2⁵³ que JavaScript représente exactement. Deux couples de masques distincts
recevaient la même clef, et `composerMasques` rendait le résultat mémorisé **pour une autre
paire** — sans erreur, sans avertissement.

| Mesure sur mille instances de `space` | Avant | Après |
|---|---|---|
| Instances déclarées incohérentes alors qu'un modèle les satisfait | **88** | 0 |
| Paires dont la relation réelle était exclue des possibles | **3 436** | 0 |

**Portée.** `space` est en production et dix moteurs sur seize y tournent : tout item posé sur
ce système pouvait porter une clef de réponse fausse. Le mémo passe à deux étages, exact pour
tout vocabulaire que le solveur accepte (31 relations au plus).

**Pourquoi il avait échappé.** La vérification qui l'attrape est la seule capable de détecter un
générateur qui énonce un fait faux, et elle était restreinte à `line`, `plane` et `groups` —
tous sous le seuil de 26 relations. Elle porte désormais sur les quatorze systèmes dotés d'une
table de composition : mille tirages là où lire une paire est une propagation, quarante là où
c'est une énumération de scénarios, `allen` coûtant près d'une seconde par instance.

## Lot A2 — système `classes` : **livré**

| Fichier | Rôle |
|---|---|
| `systemes/classes.ts` | Les **cinq relations d'ensembles** de RCC5 : confondues, l'une contenue dans l'autre, l'une contenant l'autre, en chevauchement, sans élément commun |

Le registre passe à **15 systèmes** et **181 couples** praticables ; onze moteurs sur seize
produisent des items sur `classes`, `contradiction` le refusant comme il refuse déjà `rcc8` et
`allen`. Le plus lent coûte 209 ms par item, loin sous le budget de 1 500 ms.

**Rectification d'un chiffre que j'avais donné.** Le lot A1 porte les couples de **118 à 169**,
et non à 196 comme annoncé dans son message de commit et dans mon compte rendu. Le compte exact,
vérifié : 118 avec dix systèmes, 169 avec quatorze, 181 avec quinze.

### Pourquoi RCC5 et non RCC8

On y oublie le **contact**, et ce n'est pas une simplification mais une conséquence du domaine :
deux *régions* peuvent se toucher sans se recouvrir, deux *ensembles* ne peuvent pas. Le
classifieur diffère donc de celui de RCC8 au premier test — deux segments qui ne partagent qu'une
extrémité **se recoupent**, cette extrémité étant un élément commun.

La table de composition, dérivée par énumération, donne les résultats attendus de la logique des
classes :

| Composition | Résultat | Ce que c'est |
|---|---|---|
| `contenu ∘ contenu` | `contenu` | La transitivité de l'inclusion |
| `contenu ∘ disjoints` | `disjoints` | Le syllogisme **AEE**, valide |
| `disjoints ∘ disjoints` | **les cinq** | Le sophisme classique : « aucun A n'est B, aucun B n'est C » ne conclut rien |
| `contenu ∘ contient` | **les cinq** | L'autre sophisme : deux termes sous un même majeur ne se comparent pas |
| `contient ∘ disjoints` | `contient`, `empiète`, `disjoints` | Un contenant peut dépasser là où son contenu est séparé |

### Et pourquoi le syllogisme ne peut pas être un système

Le point méritait d'être établi avant d'écrire du code, parce qu'il change le découpage du lot A3.

Le contrat exige de chaque relation qu'elle soit une information **complète** sur une paire :
`converse` rend **une** relation, et un `Fait` en énonce **une**. Or une prémisse quantifiée est
une **disjonction** de relations :

| Forme | Ce qu'elle dit des cinq relations |
|---|---|
| Tous les X sont Y | `identiques` **ou** `contenu` |
| Aucun X n'est Y | `disjoints` |
| Certains X sont Y | tout sauf `disjoints` |
| Certains X ne sont pas Y | `contient`, `empiète` **ou** `disjoints` |

Et la conversion ne s'écrit pas comme une fonction : « aucun X n'est Y » et « certains X sont Y »
se renversent simplement, « tous les X sont Y » ne donne que « certains Y sont X », et
« certains X ne sont pas Y » ne se renverse **pas du tout**. Un `converse` total et exact est donc
impossible sur le vocabulaire quantifié.

**D'où la répartition retenue**, qui n'était pas celle annoncée par l'inventaire : `classes`
porte les cinq relations **exactes** et sert les seize moteurs — c'est déjà le raisonnement
d'inclusion, celui des diagrammes d'Euler. Le **syllogisme proprement dit** devient un **moteur**
de la famille des chaînes, qui lit le modèle de ce système, en tire des prémisses quantifiées, et
les résout lui-même avec son propre solveur. `SchemaEuler`, livré au lot B1, l'attend déjà avec
ses témoins et ses zones vides.

## Lot A3 — famille « Chaînes de prémisses » : **livré**

| Fichier | Rôle |
|---|---|
| `moteurs/chaines/conclusion.ts` | Le moteur `chaine-conclusion` : N prémisses mélangées, une conclusion à juger |
| `moteurs/types.ts` | La catégorie `chaines` et `RegleDEchelle` |
| `progression.ts` | La famille, les paliers corrigés, et `echelonParFenetre` |

**17 moteurs, 15 systèmes, 195 couples.** Le moteur tourne sur les **14 systèmes** dotés d'une
table de composition, avec **100 % de tirages retenus** partout et **0 trace fautive** sur
2 100 items. Le plus lent est `allen`, à 191 ms par item.

### Deux options ou trois : c'est la détermination du système qui décide

| Mode | Systèmes | Pourquoi |
|---|---|---|
| **Deux options** — « découle » / « n'en découle pas » | `rang`, `anneau`, `groups`, `cyclic` | Leur composition est **fonctionnelle** : une chaîne couvrant les entités fixe tout le réseau, et une conclusion y est nécessairement entraînée ou contredite |
| **Trois verdicts** — « découle », « contredit », « reste ouvert » | les dix autres | Une conclusion peut y être **vraie dans la situation tirée tout en restant ouverte** au vu des prémisses. Répondre « vrai » serait enseigner l'erreur même que la rubrique corrige |

Les trois verdicts reprennent **mot pour mot** ceux d'« Entre-deux », pour qu'un seul vocabulaire
serve partout.

### Le seuil de 7 sur 8, et ce qu'il corrige

À deux options, trois réussites d'affilée — la règle commune pour monter d'un cran — arrivent
**une fois sur huit** sans rien comprendre, et deux fautes de suite **une fois sur quatre**.
L'échelle monterait et descendrait au bruit. D'où `echelle: { reussites: 7, fenetre: 8,
descente: 4 }` : moins de quatre chances sur cent sous l'hypothèse du pur hasard. La fenêtre se
vide à chaque changement d'échelon, pour que la mesure recommence au niveau où l'on arrive.

### Un biais de distribution, mesuré puis corrigé

Premier jet : le verdict visé était tiré **à chaque essai**. Comme la boucle rend l'item au
premier succès, un verdict rare était abandonné dès le premier échec au profit d'un verdict
facile. Mesure avant correction :

| Système | « découle » | « contredit » | « reste ouvert » |
|---|---|---|---|
| `space` | **2 %** | 38 % | 60 % |
| `rcc8` | **3 %** | 33 % | 65 % |
| `classes` | **5 %** | 29 % | 66 % |

Une personne aurait appris à répondre toujours « reste ouvert » et marqué 60 %. Corrigé en tirant
le verdict **une fois** et en **cherchant la paire** qui le réalise, le chemin servant de filtre
avant la propagation complète — qui coûte jusqu'à 200 ms sur `classes` et ne peut pas être testée
six fois par instance. Après correction, **33 / 29 / 37 %** sur tous les systèmes à trois
verdicts et **52 / 48 %** sur les binaires.

### Un défaut des lots A1 et A2, trouvé ici

Mes cinq systèmes nouveaux n'étaient dans **aucun palier** de `PALIERS_SYSTEMES`. Or
`systemesOuverts()` ne rend que les systèmes placés : ils étaient **injouables**, du code mort
qu'aucune erreur ne signalait. Corrigé, et `systemesSansPalier()` plus trois assertions
l'empêchent de se reproduire.

### Ce que la trace porte

La justification est un **chemin** : les prémisses qui, composées l'une après l'autre, mènent du
premier terme au second. On exige que l'ensemble obtenu par ce chemin soit **exactement** celui
que la propagation complète donne — sinon le chemin ne suffirait pas à justifier la réponse, et la
correction pas à pas mentirait par omission. L'item est alors retiré plutôt que posé.

Les prémisses hors du chemin sont vraies mais inutiles : la trace les déclare **distractrices**,
pour que la correction les signale. Apprendre à voir qu'un fait ne sert à rien fait partie de
l'exercice.

### Reporté au lot A4

Les **prémisses du second ordre** — « A est à B ce que C est à D », la mécanique `meta` de
Syllogimous — demandent que le solveur résolve une prémisse qui parle d'autres prémisses. C'est un
solveur de plus, non un réglage, et le faire à moitié aurait produit des traces inexactes. La
**négation de surface** est dans le même cas : « A n'est pas après B » n'est univoque que sur un
vocabulaire de **deux** relations complémentaires, soit `line` et `groups` seulement.

## Lot A4 — syllogisme et conclusion composée : **livré en partie**

| Fichier | Rôle |
|---|---|
| `moteurs/chaines/chemin.ts` | La machinerie de chemin, extraite de `conclusion.ts` quand le second moteur en a eu besoin |
| `moteurs/chaines/syllogisme.ts` | Prémisses quantifiées, solveur par **énumération des régions de Venn** |
| `moteurs/chaines/composee.ts` | Deux conclusions reliées par un connecteur logique, six connecteurs |
| `noyaux/presentation.ts` | `que()` — l'élision, qu'aucun gabarit ne peut anticiper |

**19 moteurs, 15 systèmes, 199 couples.** Tous deux : 100 % de tirages retenus, **0 trace
fautive**, 72 ms et moins d'une milliseconde par item.

### Le point qui décidait de la conception du syllogisme

Un solveur fondé sur le modèle d'intervalles de `classes` aurait été **faux**. Les intervalles
sont strictement moins expressifs que les ensembles : trois ensembles deux à deux sécants peuvent
avoir une intersection triple vide, trois intervalles ne peuvent pas — en dimension un, si les
trois intersections deux à deux sont non vides, la triple l'est aussi.

Vérifié par énumération des 55³ triplets de segments : **aucun** ne réalise cette configuration.
Un tel solveur aurait donc déclaré entraînées des conclusions que les ensembles réfutent, et posé
des items à clef fausse. D'où l'énumération des **régions de Venn** : 2ⁿ−1 régions, un modèle
étant le choix des régions non vides — 128 modèles à trois termes, 32 768 à quatre. Exact,
complet, immédiat.

**L'import existentiel est imposé et annoncé** : chaque catégorie compte au moins un élément,
comme chez Aristote. Ce n'est pas neutre — cela rend valide « tous les X sont des Y, donc certains
X sont des Y », que la logique moderne rejette. Choisir sans le dire aurait rendu une partie des
clefs indéfendables ; l'énoncé le dit.

### Trois défauts de production, trouvés en relisant les items engendrés

| Défaut | Correction |
|---|---|
| Des prémisses **redondantes** : « Certains X sont des Y » suivi de « Certains Y sont des X ». I se renverse simplement, la trace affichait 92 → 92 — une étape sans effet | Chaque prémisse doit **restreindre strictement** ce qui reste possible. Exact, et attrape toutes les redondances, pas seulement la conversion |
| **Presque aucune prémisse universelle** : un modèle de Venn tiré uniformément a la moitié de ses régions non vides, donc « certains » y est presque toujours vrai et « tous » presque jamais | Le modèle de référence est tiré **creux**, puis les termes vides sont habités. Résultat : A 20 %, E 18 %, I 31 %, O 30 % |
| Des fautes de langue qu'on ne voit qu'à l'exécution : « **ni** Guvran **est** à gauche de… », « exige **que au** moins un » | Les membres sont **cités entre guillemets**, ce qui les nominalise et rend la construction indépendante de leur forme verbale ; et `que()` gère l'élision |

### Pourquoi `chaine-composee` ne tourne que sur trois systèmes

Un connecteur se calcule sur des valeurs de vérité, et il faut donc que chaque membre **en ait**
une. C'est le cas sur `rang`, `anneau` et `cyclic`, dont la composition est fonctionnelle.
Ailleurs un membre peut rester **ouvert**, et le connecteur cesse d'être une table de vérité :
« A est avant B ou A est après B » découle des prémisses alors qu'aucun des deux membres n'en
découle. C'est vrai, c'est instructif, et cela demande de raisonner sur les situations
**conjointes** — un troisième solveur. Plutôt que de poser une question dont la réponse serait
approximative, le moteur s'y refuse.

`groups` est écarté pour une autre raison : deux relations seulement, de sorte qu'un membre faux
se devine sans calcul.

### Ce qui reste du lot A4

| Reste | Pourquoi ce n'est pas fait |
|---|---|
| `analogie-inter-systemes` | Non commencé |
| **Négation de surface** | N'est univoque que sur un vocabulaire de **deux** relations complémentaires — `line` et `groups` seulement |
| **Prémisses du second ordre** | Demandent un solveur capable de résoudre une prémisse qui parle d'autres prémisses, non un réglage |

## Lot A6 — attribution CC BY-NC 3.0 : **livré**

Dans l'« à propos » de la rubrique (`src/pages/cog-training/relational-reasoning.astro`) et dans
le README, avec le nom de l'auteur d'origine, le lien du dépôt, le lien de la licence, la mention
que les exercices ont été **réécrits et modifiés**, et la mention d'usage **strictement non
commercial**. Le README précise qu'aucune dépendance Angular, Bootstrap ou ng-bootstrap n'a été
introduite, et nomme la modification de fond : le troisième verdict « reste ouvert », que le
format d'origine ne connaît pas.

Le README est par ailleurs corrigé — « cinq familles » devenait faux, le tableau des régimes ne
listait que dix systèmes, et l'échelle à fenêtre n'y figurait pas.

## Lot A5 — écran « Mon entraînement » : **livré**

Le livrable de l'étape 3 du prompt A : choisir soi-même les moteurs d'une séance, au lieu de
subir le tirage parmi tout ce qui est débloqué.

### Ce qui a été écrit

| Fichier | Ce qu'il apporte |
|---|---|
| `src/features/cog-training/unites.ts` | `Unite` / `GroupeUnites`, **indépendants du relationnel** : l'écran doit servir à d'autres rubriques de Cog-Training sans réécriture |
| `src/features/cog-training/composants/MonEntrainement.svelte` | Le panneau : préréglages, recherche, cases, nombre d'items, ordre, mode libre |
| `src/lib/db.ts` | `SelectionEntrainement`, `lireSelectionEntrainement` / `ecrireSelectionEntrainement`, et `selections` dans l'export/import |
| `src/features/relational-reasoning/progression.ts` | `couplesPourEntrainement(traces, { modeLibre })` et `CoupleJouable` |
| `src/features/relational-reasoning/session.ts` | `OptionsSession` en quatrième paramètre |
| `src/features/relational-reasoning/composants/RelationalReasoning.svelte` | Branchement : `selection` remplace `longueur` |

### Trois décisions qui méritent d'être écrites

**Le mode libre n'offre jamais l'échelon qu'on n'a pas gagné.** Un couple ouvert par le mode
libre est rendu à l'**échelon 1**. On peut donc s'entraîner où l'on veut, mais pas sauter la
progression : l'échelon reste calculé depuis l'historique, et le mode libre ne l'écrit pas. En
le désactivant, les moteurs cochés devenus inaccessibles sont retirés de la sélection plutôt que
gardés en silence.

**Une sélection sans couple praticable rend une session vide, pas une session complète.** Se
rabattre sur tous les moteurs serait le pire comportement possible : la personne croirait
travailler ce qu'elle a coché et s'entraînerait ailleurs sans le savoir. La consigne « empêcher
de lancer une session avec une sélection vide » est donc tenue **deux fois** — le bouton est
désactivé avec son explication, et la composition ne contourne pas le filtre si on l'appelle
autrement.

**La sélection est amorcée au premier usage avec tous les moteurs débloqués.** Sans cela, la
règle précédente bloquerait une personne qui n'a jamais ouvert le panneau : sélection vide,
bouton désactivé, aucune séance possible. L'amorçage ne se fait qu'à la première ouverture ; une
sélection enregistrée, même réduite, n'est jamais réécrite.

Autres détails : la recherche filtre **l'affichage seulement** — elle ne décoche rien, pour qu'un
filtre oublié ne mange pas la sélection ; l'ordre « regroupé » trie **après** le tirage, parce
que tirer moteur par moteur déséquilibrerait le dernier, qui n'aurait que les items restants ;
le nombre d'items est borné à 3–60 à la **lecture** de la base, et non seulement à l'écriture,
pour qu'une valeur aberrante venue d'un import ne casse pas une séance.

### Essais

Douze assertions nouvelles dans `scripts/essais-relationnel.mts`, section « MON ENTRAÎNEMENT » :
le mode libre ouvre au moins autant de couples et à l'échelon 1, un couple déjà débloqué garde
son échelon gagné, la session ne tire que les moteurs cochés, une sélection sans couple
praticable rend **zéro** item, l'ordre groupé ne laisse qu'un bloc par moteur en gardant les
mêmes items que l'ordre entrelacé, et la progression n'est pas modifiée par le mode libre.

## Lot B2 — traces des seize moteurs : **en cours**

Les moteurs migrés émettent leur trace depuis leur propre solveur, et l'essai
`npm run essais:correction` vérifie pour chacun que la dernière étape conclut bien à la réponse
de l'item. Il nomme aussi, à chaque exécution, ceux qui restent.

### Famille Induction — livrée

**`reseau-relationnel`.** Le moteur exigeait jusqu'ici que la structure soit **rigide**, ce qui
garantit que l'appariement est unique. Il exige maintenant davantage : que l'appariement se
**trouve par élimination**. La rigidité n'implique pas qu'on puisse le trouver sans fouiller les
permutations — et un exercice dont la solution ne se trouve que par force brute n'est pas un
exercice de raisonnement, en plus de n'avoir aucune correction présentable.

D'où `eliminer()` dans `noyaux/isomorphisme.ts` : profils d'abord — ce qu'un sommet porte comme
relations, compté, invariant par réétiquetage — puis appuis sur ce qui est déjà épinglé. La trace
est l'exécution même de cette élimination. Mesuré sur 300 tirages par système : **au moins 99 %
des structures rigides s'y plient**, et 100 % sur douze des quinze systèmes. La contrainte
nouvelle ne coûte donc presque rien, et `digraph` exerce vraiment la seconde phase (76 % de ses
items ont au moins un appui).

Quatre défauts de rédaction trouvés **en lisant les traces produites**, non en relisant le code :

| Défaut | Correction |
|---|---|
| Le profil entrant était écrit alors qu'il est, sur les quinze systèmes, le miroir exact du sortant | Omis, avec le test qui le dirait si un vocabulaire futur brisait le miroir |
| L'étape d'appui disait « la seule qui convient » sans dire pourquoi | Elle nomme la relation : « Pôle E reçoit de Pôle D ; β est la seule entité qui reçoit de α » |
| « précède 2 entités et **incomparable à** 1 entité » — l'auxiliaire était élidé là où il était le seul verbe | L'élision n'a lieu que si la première relation porte le même auxiliaire |
| Les libellés de `classes` portent une virgule, et trois d'affilée devenaient indécoupables | Relations **citées** entre guillemets dans ce cas, pour tout le profil |

**`inferer-relation`.** La trace dit ce qui fait tenir l'exercice : les relations d'un système
s'excluent mutuellement, donc un seul exemple fixe un symbole, et les autres ne font que
confirmer. Les relations proposées à droite sans être en jeu sont marquées **inutiles**, pour
qu'on ne les croie pas oubliées.
