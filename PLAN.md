# Plan de développement

Découpage retenu avant l'écriture du code, et état d'avancement.
Chaque phase est utilisable telle quelle : le site reste fonctionnel à la fin
de chacune d'elles.

## Phase 1 — Socle et protection réelle ✅

Fondation du projet et, surtout, la garantie que le contenu publié est
illisible sans le mot de passe. Tout le reste en dépend.

- Projet Astro + Tailwind, `.gitignore` excluant `content/` et `.env.local`
  dès le premier commit.
- Pipeline de build : lecture de `content/`, validation du schéma (Zod),
  rendu Markdown → HTML, chiffrement AES-GCM (clé PBKDF2, 600 000 itérations).
- Écran de connexion : vérification SHA-256 puis dérivation de la clé réelle.
- Garde-fou de publication : le build s'interrompt si un titre de fiche
  apparaît en clair dans les fichiers produits.
- Non-indexation : `robots.txt` + `<meta name="robots">` sur toutes les pages.

## Phase 2 — Bibliothèque de contenu ✅

- Manifeste chiffré reconstruisant la hiérarchie matière → fascicule → fiche.
- Bibliothèque navigable, avec filtres par matière et par statut.
- Page fiche : bascule « cours complet » / « fiche simplifiée », sommaire,
  navigation vers la fiche précédente et suivante.
- Glossaire automatique : détection des termes au build (`<dfn>`), bulles de
  définition via l'API `popover` native, repli accessible au clavier.

## Phase 3 — Flashcards et persistance ✅

- IndexedDB (`idb`) : cartes, fiches, quiz, agrégats journaliers, profil.
- Algorithme SM-2 avec notation difficile / moyen / facile.
- File « à réviser aujourd'hui » recalculée automatiquement, aperçu du
  prochain intervalle sur chaque bouton, raccourcis clavier.

## Phase 4 — Quiz et gamification ✅

- QCM avec correction immédiate, explications, récapitulatif des erreurs.
- XP, niveaux, série de jours consécutifs avec relance visuelle, 13 badges,
  barres de progression par matière et par fascicule.

## Phase 5 — Transversal ✅

- Recherche plein texte sur l'index chiffré, filtres par matière, par tag et
  par niveau de maîtrise, extraits surlignés.
- Statistiques : temps passé, régularité hebdomadaire, taux de réussite par
  matière, échéancier des cartes, fiches les plus fragiles.
- Export / import JSON de la progression (fusion ou remplacement).
- Interface responsive, thème clair et sombre.

## Phase 6 — Déploiement et documentation ✅

- `npm run deploy` : chiffrement, build, publication sur `gh-pages`.
- `npm run hash` pour la procédure de changement de mot de passe.
- README couvrant installation, format des fiches, glossaire, publication,
  changement de mot de passe, sauvegarde et dépannage.

## Phase 7 — Entraînement cognitif (Quad N-Back) ✅

Ajout demandé après coup, sur la base du dépôt `quad-box` (licence MIT).

**Deux stratégies possibles, comparées avant d'écrire du code :**

| | Portage dans le site | Intégration par `<iframe>` |
|---|---|---|
| Thème | partagé | deux styles côte à côte |
| Progression | même base, même XP, même série | base séparée, pont `postMessage` à écrire |
| Poids | 196 Ko de sons, 0 dépendance ajoutée | 6,3 Mo d'assets, daisyui + chart.js + d3 |
| Chemin de base | géré par Astro | à recâbler à la main |
| Effort initial | moyen | faible |

**Retenu : le portage.** Le coût réel s'est avéré modéré parce que les parties
les plus liées à daisyui (réglages, graphiques, tiroirs) sont précisément
celles qu'il fallait remplacer par l'existant du site. L'iframe aurait été plus
rapide à poser mais aurait créé un second système de progression — exactement
ce que le cahier des charges demandait d'éviter.

Réalisé : moteur de stimuli porté et vérifié, grille 3D, touches
personnalisables, enregistrement dans la base commune, XP et badges dédiés,
chargement différé sur la seule page concernée.

## Phase 8 — Relational Reasoning Training (remplace Syllogismes) 🔄

Syllogismes est retiré et remplacé par un exercice écrit nativement dans le
site. Le retrait est un gain net : 52 626 lignes de code vendorisé, 730 Mo sur
le disque, une chaîne de build Angular, deux scripts npm, le pont de thème
`postMessage` de l'iframe — et la dernière anomalie d'étanchéité du site, car
`/syllogismes/` était un sous-site statique accessible par son adresse alors que
seule la page englobante était derrière l'écran de connexion. Le déploiement
reconstruisant l'arborescence publiée à chaque fois et poussant en `--force`,
retirer son bloc de `scripts/deploy.mjs` suffit à faire disparaître le dossier
du site en ligne.

### Le contrat entre les deux couches

Un **système** est un module de données ; un **moteur** est un générateur
d'exercice qui reçoit un système en paramètre. Ce que les moteurs demandent
réellement à un système :

```ts
interface Systeme {
  id: string;
  relations: Relation[];         // vocabulaire de surface, réétiquetable
  converse(r: Relation): Relation;
  composition?: TableComposition; // r ∘ s → ensemble des relations possibles
  axes?: Axe[];                   // systèmes-produits : line = 1 axe, plane = 2, space = 3
  monde: 'clos' | 'ouvert';
  engendrer(difficulte: number): Instance;  // entités + faits atomiques
  rendu: 'diagramme' | 'grille' | 'intervalles' | 'regions' | 'texte';
}
```

### Trois régimes d'inférence, et non un seul

C'est la réponse au livrable n° 5. « Agnostique du système » est vrai **à
l'intérieur d'un régime** ; plusieurs moteurs présupposent silencieusement le
leur.

| Régime | Systèmes | Inférence | Moteurs servis |
|---|---|---|---|
| **Algèbre de relations** | line, poset, cyclic, groups, rcc8, allen ; plane et space comme **produits d'axes** | cohérence de chemin sur des ensembles de relations | toute la catégorie C, RCC8 Regions, Interval Algebra, Cyclic Dominance, l'essentiel de A et B |
| **Monde clos, graphe explicite** | digraph ; les prédicats « adjacent » et « même ligne » de line/plane/space ; poset en mode clos | requêtes de graphe, négation par échec | Motif Search, Relational Web, Common Sub-System, Partial Isomorphism |
| **Transformations non commutatives** | plane, space, groups | application de fonctions dans un groupe non abélien | Context Shifts, Frames, Pivot Transforms, Axis Maps, Oblique Basis, Projection |

Deux conséquences structurantes.

**Plane et Space ne sont pas des tables de 8 ou 26 relations** mais le produit
de deux et trois algèbres de points. « au nord de » ∘ « à l'est de » = « au
nord-est de » ne se lit dans aucune table plate ; il se calcule axe par axe.
C'est cette formulation qui rend Projection (effondrer un axe) et Oblique Basis
(relations combinant plusieurs axes) naturels au lieu d'être des cas
particuliers.

**Digraph n'a pas de table de composition du tout.** « supervise » n'est ni
transitive ni composable : seules les arêtes énoncées valent, et l'absence
d'arête est une négation, pas une inconnue. Les moteurs de la catégorie C, qui
vivent de l'indétermination, ne peuvent donc pas tourner sur `digraph`.

### Trente moteurs, huit solveurs

Les moteurs nommés se ramènent à huit noyaux ; c'est de là que vient le coût
réel, et non du nombre d'entrées de menu.

1. **Cohérence de chemin** sur table de composition — sert les catégories C et D
   et le calcul de toute réponse « en ensemble de possibilités ».
2. **Isomorphisme de sous-graphe** — Motif Search, Common Sub-System,
   Partial Isomorphism, Relational Web, Structure Match.
3. **Sous-ensemble insatisfiable minimal** — Contradiction, Minimal Premises,
   Missing Premise.
4. **Classifieur d'algèbre** — Hidden Algebra, Infer the Relation.
5. **Solveur d'analogie** (extraction puis application d'une relation) — les
   six premiers moteurs de la catégorie B.
6. **Applicateur de transformation géométrique** — Axis Maps, Pivot Transforms,
   Frames, Oblique Basis, Projection, Betweenness.
7. **Séquenceur d'opérateurs non abélien** — Context Shifts.
8. **Applicateur de règle par rôle** — Mutual Moves, Transformation Matching.

Deux moteurs disparaissent en tant que code : **RCC8 Regions** et **Interval
Algebra** sont le solveur n° 1 instancié sur `rcc8` et `allen`. Ce sont des
configurations, pas des implémentations — exactement ce que la séparation en
deux couches devait produire.

### Moteurs réellement agnostiques, et exceptions

**Agnostiques** (tout système muni d'une table de composition) : Hidden Algebra,
Structure Match, Analogy Completion, Partial Analogy, Odd Analogy,
Second-Order Analogy, Mapping Conflict, Possibility Sets, Missing Premise,
Contradiction, Minimal Premises, Infer the Relation.

**Agnostiques mais sur la seule vue « graphe »** (ils ignorent la composition,
donc tournent aussi sur `digraph`) : Motif Search, Relational Web,
Common Sub-System, Partial Isomorphism.

**Liés à une famille de systèmes**, par nécessité et non par paresse :

| Moteur | Restriction | Pourquoi |
|---|---|---|
| Projection | systèmes à `axes` ≥ 2 | il faut un axe à effondrer |
| Oblique Basis | plane, space, groups | vecteurs-relations multi-axes |
| Frames, Pivot Transforms | plane, space | cadre égocentrique, pivot |
| Betweenness, Axis Maps | line, plane, space | relation ternaire, opération spatiale |
| Cyclic Dominance | cyclic | la non-transitivité *est* l'exercice |
| Context Shifts | plane, space, groups | exige un monoïde non commutatif |
| Mutual Moves | line, plane, space, digraph | exige position **et** rôle |
| Cross-System Analogy | paires déclarées | la correspondance d'axes entre deux systèmes ne se devine pas |

### Trois points du cahier des charges à trancher

**Poset en monde clos contredit la catégorie C.** Le prompt définit `poset`
comme un monde clos où « l'absence de relation énoncée = incomparabilité
réelle, pas une inconnue ». Possibility Sets demande à l'inverse, sur un ordre
partiel, « TOUTES les relations encore logiquement possibles » pour une paire
non précisée — ce qui n'a aucun sens en monde clos, où rien n'est jamais
« encore possible ». Retenu : un drapeau `monde` sur le système, et deux
préréglages du même module — `poset` (clos) pour l'induction et la catégorie D,
`poset-ouvert` pour la catégorie C.

**Contradiction n'a pas toujours de réponse unique.** L'énoncé demande « le
fait présent dans chaque cycle en conflit — celui dont le retrait suffirait à
rétablir la cohérence ». Si l'instance contient deux cycles contradictoires
disjoints, aucun fait unique ne les couvre. Contrainte imposée au générateur :
les cycles engendrés partagent exactement une arête. Même remarque pour
Minimal Premises, dont le sous-ensemble suffisant minimal n'est pas unique en
général — le générateur garantira l'unicité, faute de quoi l'interface devrait
accepter n'importe quel minimal, ce qui brouille la correction.

**Les « rule-shells » manquent.** Le prompt le signale lui-même et avance sans.
Je n'invente rien à leur place : les huit solveurs ci-dessus tiennent lieu de
grammaire commune provisoire. Si les rule-shells définissent effectivement une
grammaire transversale, elle se substituera à cette liste sans toucher aux
systèmes.

### Ce que la mise en œuvre a appris

**Analogy Completion ne fonctionne pas sur les neuf systèmes**, contrairement à
ce qu'annonce le cahier des charges. Le format A:B::C:? exige une relation
**fonctionnelle** : il faut qu'une seule entité soit dans la relation cherchée
avec C. Sur un ordre strict total, « avant » vaut pour plusieurs entités à la
fois, et l'exercice aurait plusieurs bonnes réponses dont une seule serait
comptée juste. Le moteur refuse donc `line` — proprement, en rejetant le tirage.
Le remède est déjà dans le cahier des charges, qui range l'**adjacence** dans le
vocabulaire de `line` : le successeur immédiat, lui, est fonctionnel. Mais
l'adjacence n'appartient pas à l'algèbre de points — composée avec elle-même
elle donnerait « à deux rangs », qui n'est pas dans le vocabulaire —, et relève
donc du régime clos, c'est-à-dire de la phase 8b. C'est le premier cas concret
où le découpage en régimes prédit correctement quel moteur manquera à quel
système.

**La symétrie n'est pas une information à cacher.** Hidden Algebra n'affichait
d'abord qu'un sens des paires d'une relation symétrique, pour ne pas « donner »
la symétrie. C'était un contresens : c'est elle qui distingue une équivalence
d'un ordre, et sans elle l'énoncé ne portait pas sa réponse — une équivalence s'y
lisait comme un ordre total. Le contrôle l'a pris en reclassant le motif
**affiché** plutôt qu'en croyant l'étiquette interne du générateur ; c'est la
raison pour laquelle il vaut la peine de valider les items tels que la personne
les voit.

**Les masques de bits ne sont pas une optimisation prématurée.** Le contrôle
complet passait en 2 min 04 avec des ensembles d'objets, et en 2,5 s avec des
masques et une composition mémoïsée. Le facteur cinquante ne se voit pas sur un
item isolé, mais l'énumération de scénarios que réclameront RCC8 et Allen rappelle
la propagation à chaque branchement.

### Découpage de la mise en œuvre

Chaque sous-phase laisse le site utilisable, comme les précédentes.

- **8a** — retrait de Syllogismes ; coquille de l'exercice (route
  `/cog-training/relational-reasoning/`, navigation, page de session, magasin
  IndexedDB v5, XP, badges) ; solveur de cohérence de chemin ; systèmes line,
  plane, groups ; les cinq moteurs d'induction, Hidden Algebra, Structure Match,
  Analogy Completion. Livre la **phase 1** de progression, jouable.
- **8b** — systèmes digraph, poset (clos et ouvert) ; isomorphisme de
  sous-graphe ; solveur de sous-ensemble insatisfiable minimal. Livre la
  **phase 2** et la catégorie C de base.
- **8c** — systèmes space, cyclic ; applicateur géométrique. Livre la
  **phase 3**.
- **8d** — systèmes rcc8, allen avec leurs tables de composition publiées,
  reprises telles quelles ; analogies avancées ; Context Shifts. Livre la
  **phase 4**.
- **8e** — courbe de progression dans les statistiques, jalons et badges des
  quatre phases, revue de fin de session.

### Progression et données

Le système existant est réutilisé, sans second dispositif : nouveau magasin
`relationnel` en base v5 — une ligne par session, avec phase, moteur, système,
items tentés, items réussis et durée —, clés d'XP dans `site.config.mjs` sur le
modèle de `nbackSession`, et quatre badges de jalon correspondant aux quatre
phases.

## Phase 9 — Veridical Mapping 🔄

Troisième rubrique de Cog-Training : un entraînement de mise en correspondance
perceptive entre dimensions, fondé sur la psychophysique de Stevens.

**Cadrage.** La rubrique est présentée comme un entraînement perceptif. Elle ne
reproduit aucune capacité savante, ne mesure rien de clinique et ne diagnostique
personne. Mottron, Bouvet, Bonnel, Samson, Burack, Dawson et Heaton (2013),
*Veridical mapping in the development of exceptional autistic abilities*,
*Neuroscience & Biobehavioral Reviews*, 37(2), 209-228, est créditée comme
source du cadre conceptuel — bidirectionnalité, redintégration — sans
reproduction de son texte, sa licence étant CC BY-NC-ND 3.0. L'outil
`kdevos-lab.vercel.app/tools/VMTrainer.html` est crédité comme source
d'inspiration de l'architecture d'entraînement, sans avoir pu être consulté : la
politique réseau de l'environnement en interdit l'accès et n'a pas pu être
ouverte. La mécanique ci-dessous est donc construite de première main, à partir
du cahier des charges et de la pratique psychophysique établie.

### Le hub

Sept dimensions, réparties en deux familles de Stevens, et la règle stricte du
cahier des charges : **on ne relie que deux dimensions d'une même famille**.

| Famille | Dimensions | Jugement |
|---|---|---|
| Prothetic (« combien ») | intensité sonore, taille, durée, luminosité | estimation de magnitude, loi de puissance |
| Metathetic (« quel type / où ») | hauteur, position, teinte | différence, seuil |

Quatre dimensions prothetic donnent six paires, trois dimensions metathetic en
donnent trois ; la bidirectionnalité étant suivie séparément, le hub compte
**dix-huit arêtes orientées**. S'y ajoutent deux types de paires particuliers :
les **plans 2-D** (position sur une grille ↔ point d'un espace teinte-saturation)
et le **modulaire** (ligne → cycle, où la teinte reboucle et où l'écart doit se
calculer sur le cercle et non sur un segment).

**La modalité est un attribut du rendu, non de la dimension** : la durée se
porte aussi bien par un son que par un clignotement, la position par un point ou
par une localisation stéréo. Pour que le hub reste lisible, chaque dimension
reçoit un rendu canonique, et les routes vision → audition et audition → vision
sont les exceptions explicitement déclarées.

### Seuil adaptatif

Escalier **2-down-1-up** (convergence vers 70,7 % de réussite), pas géométrique
sur l'écart de stimulus : facteur 2 au départ, ramené à 1,41 après deux
inversions, puis à 1,19 après quatre. Seuil = moyenne géométrique des écarts aux
six dernières inversions, huit inversions au minimum.

- **Untrained** : aucun essai.
- **In progress** : des essais, mais moins de huit inversions ou un écart-type
  des six dernières supérieur à 0,1 unité logarithmique.
- **Converged** : huit inversions et écart-type ≤ 0,1.

**La normalisation z se fait dans le jeu de stimuli, pas dans le score.** C'est
le point de conception qui rend les seuils comparables sans bricolage : chaque
dimension déclare sa plage utile découpée en un nombre fixe de pas à peine
discriminables, de sorte qu'un seuil exprimé en pas est déjà sans unité et
directement comparable d'une dimension à l'autre. Normaliser après coup, en
divisant par l'écart-type des performances de la personne, aurait rendu le Δz
mobile au fil de l'entraînement — un seuil qui s'améliore aurait pu faire
remonter le score d'une paire jamais travaillée.

Une **charge** de 2 à 5 items simultanés fait varier la difficulté
indépendamment du seuil perceptif.

**Variantes d'essai**, et non familles séparées : **redintégration** (reconstruire
la correspondance à partir d'un motif partiel) et **résistance au bruit de
surface** (distorsion, réordonnancement).

### Modes de session

**Arbre couvrant** — les n−1 arêtes reliant toutes les dimensions d'une famille,
soit trois arêtes en prothetic et deux en metathetic : couvrir la famille sans
répéter les paires redondantes. **Mélange exhaustif** — les six ou trois paires
en ordre aléatoire, une fois l'arbre acquis. Longueur au choix : 48, 96 ou 160
essais.

### Tableau de bord

Matrice dimension × dimension du hub, l'intensité de la cellule suivant la
finesse du seuil convergé ; force par nœud (arêtes entraînées, Δz moyen) ; arbre
couvrant courant ; Δz médian au fil des sessions ; journal de session. Le
stockage passe par IndexedDB — magasin `veridical` en base v5, une ligne par
session et une par arête — et non par `localStorage`, tout en gardant l'export
JSON et l'effacement manuel de l'outil de référence.

### Trois affirmations du cahier des charges à corriger

**Il n'existe aucune infrastructure Web Audio à réutiliser.** Le prompt renvoie
à celle « déjà prévue pour les podcasts de fiches » : les podcasts sont des
fichiers `.opus` synthétisés hors ligne par Kokoro et lus par un lecteur, et le
Quad N-Back joue des sons préenregistrés via `new Audio()`. Aucun oscillateur,
aucun `AudioContext` dans tout le site. Produire des stimuli d'intensité, de
durée et de hauteur exige donc d'écrire une chaîne Web Audio — une centaine de
lignes, oscillateur et gain, sans dépendance ; c'est du code neuf, pas de la
réutilisation.

**La réutilisation de `line` et `plane` est plus mince qu'annoncé.** Ces modules
de la phase 8 sont *relationnels* : entités, vocabulaire de relations, table de
composition. La position de Veridical Mapping est une *grandeur continue*, qui
n'a pas besoin de relations. La pièce réellement partageable est l'abstraction
`axes` introduite en phase 8 pour formuler plane et space comme produits
d'algèbres de points : c'est elle qui fournit coordonnées, plages et rebouclage,
et c'est donc d'elle que dépendra la position, pas du vocabulaire relationnel.

**La règle intra-famille écarte les correspondances transmodales les mieux
établies.** La distinction prothetic / metathetic de Stevens (1957) est réelle,
mais interdire de relier les deux familles exclut précisément **hauteur ↔
taille** et **hauteur ↔ luminosité**, qui comptent parmi les correspondances
transmodales les plus répliquées de la littérature — la hauteur est metathetic,
la taille et la luminosité sont prothetic. Restent autorisées hauteur ↔ position
et intensité ↔ luminosité, également attestées. La dichotomie elle-même est par
ailleurs discutée depuis longtemps. La règle est donc implémentée comme demandé,
mais **comme réglage par défaut et non comme impossibilité câblée** : un
interrupteur « paires transmodales hors famille » permet d'ouvrir les six arêtes
manquantes sans retoucher le code, et le tableau de bord les distingue pour que
les deux régimes ne se mélangent pas dans les statistiques.

### Découpage de la mise en œuvre

- **9a** — chaîne Web Audio, les sept dimensions et leurs plages en pas
  discriminables, la route vision → vision.
- **9b** — escalier adaptatif, Δz, statuts, persistance v5, XP et badges.
- **9c** — routes audition → audition et transmodales, arbre couvrant et
  mélange exhaustif, longueurs de session.
- **9d** — plans 2-D et modulaire, redintégration et résistance au bruit.
- **9e** — tableau de bord complet, export JSON, texte « à propos » et crédits.

## Pistes pour la suite

Prévues par l'architecture, non réalisées à ce stade :

- Cas pratiques et notes de synthèse annotées : ajouter un titre de section
  reconnu dans `scripts/lib/markdown.mjs` puis une page dédiée
  (voir « Ajouter un nouveau format de contenu » dans le README).
- Objectif hebdomadaire paramétrable (actuellement fixé à 10 h dans les
  statistiques).
- Révision ciblée sur les seules fiches marquées fragiles.
- Quad N-Back : courbe de progression du niveau n dans la page Statistiques,
  et modes supplémentaires du dépôt d'origine (tally, N variable).
