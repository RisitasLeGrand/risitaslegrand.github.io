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
- Répétition espacée : SM-2 à l'origine, FSRS depuis la phase 10a.
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

### Progression : déblocage par famille, échelle par moteur

Le cahier des charges révisé abandonne le séquencement en quatre phases rigides
au profit du modèle observé dans l'outil de référence, et c'est un meilleur
dessin : les quatre phases faisaient dépendre l'accès à un moteur d'un compteur
global, si bien qu'une personne à l'aise en analogie devait accumuler des items
d'induction pour y accéder.

- **Au départ, un moteur par famille** : Hidden Algebra (isomorphisme), Analogy
  Completion (analogie), Possibility Sets (incomplétude), Betweenness (autres
  algèbres), plus les moteurs d'induction en accompagnement.
- **Les autres moteurs d'une famille se débloquent** sur la maîtrise du moteur
  déjà ouvert de cette même famille, et non sur un calendrier ni sur un total
  général.
- **Chaque moteur monte sa propre échelle** de difficulté, réglée par sa propre
  réussite : nombre d'entités, présence de leurres à ressemblance de surface,
  taille de l'ensemble de réponses. Il n'y a pas de difficulté unique pour la
  rubrique.
- **L'ordre d'apparition des systèmes** reste celui des quatre paliers — line,
  plane, groups, puis digraph et poset, puis space et cyclic, puis rcc8 et allen
  — mais comme ordre par défaut à l'intérieur des moteurs, indépendamment du
  déblocage.

**Le barème crédite l'incertitude.** Sur les moteurs à sélection multiple, une
réponse partiellement juste vaut plus qu'une réponse fausse et moins qu'une
réponse exacte ; tout cocher ne rapporte rien. C'est la contrepartie du principe
selon lequel « ça pourrait être l'un ou l'autre » est une réponse légitime quand
c'est effectivement indéterminé : si l'indétermination est une réponse, la
deviner ne doit pas payer.

### Ce que la rubrique promet, et ce qu'elle ne promet pas

Le texte de présentation reprend le cadrage de l'outil de référence : c'est un
entraînement à une tâche difficile, non une promesse d'amélioration cognitive
générale. Le transfert au-delà de la tâche elle-même n'est pas établi, et la page
le dit. Le cadre théorique invoqué — la *Relational Frame Theory* — est cité
comme principe unificateur, pas comme garantie de résultat.

Un espace **« Comprendre »** décrit chaque moteur, ouvert ou non, consultable à
tout moment et jamais imposé pendant une session, avec un réglage pour couper
tout tutoriel.

### Découpage de la mise en œuvre

Chaque sous-phase laisse le site utilisable, comme les précédentes.

- **8a** — retrait de Syllogismes ; coquille de l'exercice (route
  `/cog-training/relational-reasoning/`, navigation, page de session, magasin
  IndexedDB v5, XP, badges) ; solveur de cohérence de chemin ; systèmes line,
  plane, groups ; les moteurs d'ouverture de chaque famille.
- **8b** — systèmes digraph, poset (clos et ouvert) ; isomorphisme de
  sous-graphe ; solveur de sous-ensemble insatisfiable minimal ; le reste de la
  catégorie C et les moteurs d'induction manquants.
- **8c** — systèmes space, cyclic ; applicateur géométrique et le reste de la
  catégorie D.
- **8d** — systèmes rcc8, allen ; analogies avancées ; Context Shifts.
- **8e** — espace « Comprendre », réglage des tutoriels, courbe de progression
  dans les statistiques et badges de déblocage.


### Ce que les phases 8b à 8e ont appris

**Les tables de composition ne se recopient pas, elles se calculent.** RCC8 et
Allen totalisent cent trente-trois entrées de composition. Le plan prévoyait de
reprendre les tables publiées « telles quelles » ; c'était le meilleur moyen
d'introduire une erreur indectable, un exercice faux sur une paire de relations
sur cent soixante-neuf ne se remarquant pas. Les deux systèmes partagent donc un
**modèle concret** — des segments sur une droite graduée — et leur table est
**dérivée** par énumération exhaustive des triplets, ce qui est la définition même
de la composition. Elle est correcte par construction, et un contrôle indépendant
vérifie que le vocabulaire déclaré est exactement celui que le modèle réalise, que
la converse est involutive et concorde avec lui, et que toute relation réalisée par
un triplet est bien annoncée par la table.

Le prix à payer est à dire clairement : la table obtenue est celle du **modèle des
segments**, non celle de la théorie RCC8 abstraite, qui admet des régions
quelconques du plan et dont certaines compositions sont plus larges. Les deux
systèmes annoncent donc des segments et des intervalles, jamais des « régions » au
sens général. Le bénéfice inattendu est que `rcc8` apparaît pour ce qu'il est : la
version **grossière** d'`allen`, qui regroupe treize relations en huit. Et
regrouper des relations **affaiblit** la composition, donc **augmente**
l'indétermination : une algèbre plus grossière n'est pas une algèbre plus simple.

**`cheminComplet: false` ne corrige rien sur les réseaux que la rubrique produit —
et l'on sait pourquoi.** La raison d'être de RCC8 et d'Allen dans le catalogue était
que la cohérence de chemin n'y suffit pas. C'est vrai des algèbres abstraites ; ce
n'est pas observable ici. Un contrôle dédié a comparé `possibilitesParChemin` et
`possibilitesExactes` sur des réseaux tirés au hasard — non pas les seules chaînes
qu'engendrent les systèmes, mais des **sous-ensembles** de faits, qui laissent des
paires entièrement ouvertes : **zéro écart sur 1 739 comparaisons pour `allen` et
1 824 pour `rcc8`**.

L'explication est précise et vaut d'être retenue, parce qu'elle contredit ce que le
plan supposait. D'une part la table de composition employée ici est **exacte pour le
modèle** dont elle est dérivée, là où les résultats classiques d'incomplétude portent
sur la plus faible approximation saine. D'autre part, et surtout, le format des
faits ne permet d'exprimer que deux sortes de contraintes : un **singleton**, quand
un fait est énoncé, et la **relation universelle**, quand il ne l'est pas. Or les
deux sont **convexes**, et la cohérence de chemin décide la satisfiabilité des
réseaux d'Allen convexes — les contraintes d'intervalles convexes se ramènent à des
contraintes sur les bornes, c'est-à-dire à une algèbre de points, où la propagation
est complète. Tant qu'aucun moteur n'introduit de contrainte **disjonctive non
convexe** — « A est avant **ou** après B, mais pas au contact » — l'énumération de
scénarios ne trouvera jamais rien que la propagation n'ait déjà trouvé.

La déclaration est néanmoins conservée. Elle est du bon côté de l'erreur, et le jour
où un moteur posera une contrainte disjonctive, la réponse restera juste sans qu'on y
pense. Mais son coût n'est pas nul : le solveur exact a **abandonné sur budget** dans
261 cas sur `allen` et 161 sur `rcc8`, et il rend alors la réponse de la propagation
— celle qui était de toute façon correcte. Autrement dit, le filet coûte du temps et
n'a encore rien rattrapé : le dire vaut mieux que laisser croire à une précaution
éprouvée.

**La même faute, deux fois, à deux endroits différents.** `reetiqueter` copie une
instance en changeant les noms de ses entités ; le modèle étant indexé par nom,
tout champ oublié laisse la copie pointer vers les anciens noms. L'oubli s'est
produit à l'ajout de `digraph` et `poset`, puis, après un commentaire
d'avertissement explicite, à celui d'`allen` et `rcc8`. Le symptôme était à chaque
fois trompeur — « l'appariement ne transporte pas la structure », alors que
l'appariement était juste et la copie fausse. Un troisième commentaire n'aurait pas
plus servi que le second : la fonction **échoue désormais bruyamment** sur un champ
de modèle qu'elle ne traite pas. C'est la seule leçon généralisable de l'épisode :
quand une convention a été violée deux fois, il faut la rendre mécanique.

**« transmet à » n'est pas sa propre converse.** `digraph` la déclarait symétrique
par facilité — deux relations plutôt que trois. L'erreur s'est manifestée très loin
de sa cause : le dessin d'un motif ne traçant qu'un sens des relations symétriques,
deux motifs pourtant distincts se dessinaient à l'identique, et Recherche de motif
proposait deux options indiscernables. D'où une troisième relation, « reçoit de »,
qui ne sert jamais à énoncer un fait mais sans laquelle on ne peut pas **lire** une
paire dans l'autre sens.

**Le contrôle des doublons d'options ne voyait pas les dessins.** Il comparait le
seul texte des options ; celles de Recherche de motif sont des graphes, sans texte,
et se signalaient donc toutes comme doublons. La correction porte sur le contrôle,
non sur le moteur — mais l'alerte était fondée : tel qu'il était écrit, il n'aurait
pas davantage détecté deux dessins réellement identiques, et c'est ainsi qu'il a
fini par trouver le défaut de converse ci-dessus.

**L'invariant anti-devinette doit être vérifié sur l'item, pas espéré du procédé.**
Prémisses minimales ajoutait un nombre de faits inutiles réglé sur l'échelon ; sur
les instances où le sous-ensemble suffisant était large, il y avait moins de leurres
que de bonnes réponses, et « tout cocher » rapportait la moitié des points. La même
remarque valait déjà pour Contradiction et Prémisses minimales sur l'unicité de la
réponse : dans les trois cas, la garantie est maintenant **contrôlée sur l'item
produit**, et le tirage rejeté sinon.

### Ce que la phase 9d a appris

**« La même valeur » ne veut rien dire sur un cercle.** La tâche modulaire devait
être « la même tâche, sur une dimension qui reboucle ». C'est impossible : une
teinte n'est pas « au rang trente » dans l'absolu, un cercle n'ayant pas d'origine.
Ce qui se transporte d'une droite vers un cercle, c'est un **écart**. La tâche
montre donc deux références et demande le couple qui reproduit leur intervalle, à un
**décalage tiré au hasard** près — sans lequel la réponse se lirait sur la position
du premier élément et la tâche redeviendrait celle du point. C'est la mise en
correspondance d'une **structure** et non d'un point, et c'est plus fidèle à l'objet
de la rubrique que ne l'était l'intention initiale.

**Un leurre faux sur deux axes est plus facile, pas plus dur.** Dans la tâche
« plan », où la référence porte deux valeurs superposées, un leurre qui se trompe
sur les deux axes serait démasqué par la moindre des deux différences : la tâche se
réduirait au **meilleur des deux seuils**. Le leurre ne se trompe donc que sur
**un** axe, tiré au hasard — on ne sait pas lequel surveiller, il faut tenir les
deux, et le niveau du hasard reste à **50 %**, donc le point de convergence de
l'escalier et la comparabilité des seuils sont préservés.

**Les seuils des trois tâches ne sont pas la même grandeur.** Les seuils étaient
indexés par arête seule. Une session sur la tâche « plan » aurait donc poursuivi
l'escalier de la tâche de base avec des réponses qui incorporent le coût de tenir
deux axes, et les deux mesures auraient été perdues. La clef porte désormais la
tâche — la tâche de base gardant la clef nue, de sorte qu'aucune migration de
données ne soit nécessaire. Le poids de l'arbre couvrant est compté par tâche pour
la même raison.

**Un réglage sans effet est pire qu'un réglage absent.** La tâche modulaire suppose
une dimension d'arrivée circulaire, et la seule qui le soit — la teinte — est
métathétique : elle est donc indisponible en famille prothétique, sauf si les paires
hors famille sont ouvertes. Plutôt que de la proposer et de retomber silencieusement
sur la tâche de base, l'interface la **désactive** et dit pourquoi.

### Progression et données

Le système existant est réutilisé, sans second dispositif : nouveau magasin
`relationnel` en base v5 — une ligne par session, avec le **détail par item**
(moteur, système, réussite), ce qui permet de recalculer aussi bien le déblocage
d'une famille que l'échelon courant d'un moteur, sans rien mémoriser qu'un import
de sauvegarde pourrait désynchroniser. Clés d'XP dans `site.config.mjs` sur le
modèle de `nbackSession`, et des badges de déblocage par famille.

### Correctif : « Remplacer » n'effaçait pas tout

Le mode « remplacement » de l'import annonce qu'il « **efface la progression
locale puis restaure la sauvegarde** ». Il ne vidait que **huit magasins sur
douze** : `nback`, `relationnel`, `vmSeuils` et `vmSessions` — les quatre ajoutés
après lui — étaient oubliés. Comme les sessions y sont ensuite **ajoutées** et non
écrasées, le défaut était cumulatif : restaurer deux fois la même sauvegarde
triplait l'historique de Cog-Training. Mesuré avant correction, par l'interface
réelle : **1 → 2 → 3** enregistrements pour `nback`, `relationnel` et `vmSessions`.

Les conséquences dépassaient le doublon d'affichage. L'échelon des moteurs
relationnels et le déblocage des familles se **rejouent depuis les traces** :
des traces locales survivantes gonflaient la progression après une restauration
censée repartir de la sauvegarde. Et un seuil de Veridical Mapping absent de la
sauvegarde survivait à l'effacement, l'escalier reprenant depuis un état que
l'utilisateur avait demandé à jeter — exactement la contamination contre laquelle
les clefs de seuil par tâche avaient été introduites.

Le remède n'est pas d'allonger la liste oubliée mais de n'en avoir **qu'une** :
`MAGASINS_PROGRESSION` sert désormais à la fois à la remise à zéro complète et au
mode remplacement, qui ne peuvent donc plus diverger. C'est la même leçon que le
réétiquetage des modèles en phase 8 : quand deux listes doivent rester synchrones,
il faut les remplacer par une seule.

La vérification a suivi la discipline inverse de l'habituelle : **reproduire
d'abord la panne**, en rétablissant temporairement l'ancienne liste, puis montrer
le même contrôle passer. Un correctif dont on n'a pas vu le test échouer n'est pas
un correctif vérifié.

### Correctif : l'inventaire de la rubrique Actualités

Un balayage des dix-huit routes a mis au jour un défaut que les contrôles
statiques ne pouvaient pas voir : la page Actualités émettait **cinquante-cinq
requêtes dont cinquante-quatre répondaient 404**, à chaque visite.

Ce n'était pas une erreur de logique. GitHub Pages ne permet pas de lister un
dossier, et les noms de fichiers sont des empreintes pour ne révéler ni les dates
ni les thèmes : le navigateur n'avait donc aucun moyen de savoir ce qui existe, et
**sondait** les identifiants de semaine en remontant le temps. Le code le
documentait, et traitait correctement les 404 comme « pas encore publié ».

C'était néanmoins un défaut, pour une raison que l'incident a rendue tangible :
une console saturée de rouge **masque les vraies erreurs**. Elle me les a
masquées pendant le balayage lui-même, où cent dix signalements de bruit
noyaient tout le reste. Un diagnostic qu'on ne peut pas lire ne sert à rien.

**Le correctif est un inventaire chiffré.** Le script de publication, qui parcourt
déjà chaque entrée pour vérifier qu'elle est bien une enveloppe, collecte au
passage les noms publiés et écrit un inventaire — **chiffré avec la même clé
publique que les entrées**. Le navigateur le lit une fois, puis demande exactement
les fichiers qui existent. Mesuré : **cinq requêtes au lieu de cinquante-cinq,
zéro 404, zéro erreur de console**, les quatre onglets affichant toujours leurs
entrées.

Trois points de conception méritent d'être notés.

**L'inventaire est chiffré, et il devait l'être.** Une liste d'empreintes en clair
serait inversible : l'espace des identifiants de période est minuscule — quelques
centaines de semaines plausibles — de sorte que n'importe qui pourrait
précalculer les empreintes et lire dans l'inventaire les périodes couvertes.
C'est une métadonnée sur les périodes de révision, aujourd'hui non énumérable
précisément parce que le listage est impossible. Le correctif ne devait pas
l'introduire.

**Le sondage demeure, en voie de secours.** Un déploiement antérieur à
l'inventaire continue de fonctionner à l'identique, ce qui a été vérifié en
retirant le fichier : les entrées sont retrouvées et affichées comme avant.

**Un bénéfice non cherché : la fenêtre peut s'élargir sans coût.** Les
identifiants absents étant écartés localement, la profondeur d'historique n'est
plus limitée par le nombre de requêtes qu'on accepte de perdre. Elle passe de
dix-huit mois à six ans, et la « tolérance » d'un an qui compensait l'historique
troué n'a plus d'objet.

### Correctif : le noyau MUS, dix-neuf secondes pour un item

Engendrer un item de « Prémisses minimales » sur RCC8 demandait **18,9 s**. Rien
dans les essais ne le disait : ils vérifiaient que les items étaient justes, pas
qu'ils arrivaient. Un moteur qui fige la page au tirage est pourtant un défaut,
même quand sa réponse est bonne.

**Le diagnostic a démenti le commentaire qui l'excusait.** Le noyau énumérait les
2^n sous-ensembles de faits « parce qu'à cette échelle mille combinaisons ne
coûtent rien ». Ce n'était pas le nombre de sous-ensembles qui avait été mal
estimé, mais le prix d'un seul test : une propagation sur l'ensemble complet
coûte 0,1 ms, mais sur un sous-ensemble *presque vide* — réseau non contraint,
foule de scénarios — l'énumération exacte y brûlait son budget de 400 000 nœuds,
soit près d'une seconde. Les sous-ensembles dont l'insuffisance est la plus
évidente étaient les plus chers.

**Trois corrections, dont une de fond.**

1. *L'énumération est remplacée par une caractérisation exacte.* Un fait est
   **nécessaire** lorsque l'ensemble entier privé de ce seul fait n'entraîne plus
   la conclusion. Tout sous-ensemble suffisant contient l'ensemble N des faits
   nécessaires ; donc si N suffit, c'est l'unique minimal, et s'il ne suffit pas,
   il y en a au moins deux. L'unicité se décide en n+1 tests au lieu de 2^n. La
   preuve est en tête de `noyaux/mus.ts`, et la suite d'essais vérifie l'accord
   avec l'énumération exhaustive — sur une référence qui n'emprunte aucun des
   raccourcis du noyau, sans quoi une erreur commune aux deux passerait inaperçue.
2. *Les questions booléennes cessent de calculer des ensembles.* « Reste-t-il au
   moins un scénario ? » et « en reste-t-il plus d'un ? » se répondent en
   arrêtant le parcours au premier, respectivement au deuxième, résultat distinct.
3. *La propagation tranche là où elle suffit.* La cohérence par chemin rend un
   sur-ensemble des relations possibles, pour un dixième de milliseconde : si la
   relation visée n'y figure pas, c'est « non » ; si le sur-ensemble est déjà
   réduit à elle seule, la vraie liste y est incluse et ne peut être que vide ou
   égale à elle, de sorte qu'exhiber **un** scénario conclut « oui ». Prouver
   qu'une relation est forcée obligeait sinon à visiter tous les scénarios —
   832 ms pour un test que la propagation avait déjà décidé.

**Le même changement corrige une explication fausse.** L'ancienne version ne
comptait les sous-ensembles concurrents qu'à taille égale : deux chaînes
indépendantes de tailles 2 et 3 lui passaient pour « uniques ». L'explication
affichée — « retirer l'un des faits qui comptent rend la conclusion
indéterminée » — était alors mensongère, puisque la seconde chaîne la forçait
toujours, et les faits présentés comme « inertes » ne l'étaient pas. La
caractérisation par faits nécessaires *est* exactement l'énoncé que l'explication
prétend faire. Les deux défauts avaient une seule cause.

**Le coût est désormais un invariant surveillé.** Un bloc d'essais mesure le
temps par item de chaque couple moteur × système et échoue au-delà de 1,5 s. Le
plus lent est passé de 18 900 ms à 590 ms.

## Phase 9 — Veridical Mapping 🔄 (v1 livrée)

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

### Ce que la mise en œuvre a appris

**L'escalier retrouve exactement ce que la théorie prédit, et c'est ainsi qu'on
le vérifie.** Une procédure adaptative se relit mal ; on la fait tourner contre
un observateur simulé dont le seuil est connu. La règle 2-down-1-up converge vers
le point à 70,7 % de la courbe psychométrique, qui pour une Weibull de pente 3
vaut 0,812 fois le paramètre d'échelle — et l'escalier rend 0,77 à 0,80 sur trois
seuils vrais différents. Un contrôle qui aurait simplement exigé « le bon ordre
de grandeur » aurait laissé passer une erreur de règle ; celui-ci la prendrait.

**La charge ajoute des sous-essais, pas des candidats.** C'est la décision qui
sauve la comparabilité des seuils. Ajouter des candidats aurait changé le niveau
du hasard — un sur trois au lieu d'un sur deux —, donc le point de convergence
de l'escalier, donc la signification du seuil : une mesure à charge 3 n'aurait
plus rien eu à voir avec une mesure à charge 1. Plusieurs sous-essais au même
écart, chacun nourrissant l'escalier pour son compte, augmentent ce qu'il faut
tenir à la fois sans toucher à la mesure — ce que le cahier des charges demandait
précisément.

**Un réglage plausible pouvait ne rien mesurer du tout.** Quarante-huit essais
répartis sur les douze arêtes d'une famille en laissent quatre chacune, là où un
seuil en demande une trentaine. La session aurait été agréable et parfaitement
vaine. Les réglages affichent donc le nombre d'essais par arête qu'ils impliquent,
et préviennent quand il est trop faible.

**Les couleurs sont en `oklch`.** Quand une dimension perceptive *est* la mesure,
la régularité de l'échelle de couleur n'est pas un agrément : en `hsl`, deux pas
de clarté séparés par le même écart numérique ne se ressemblent pas selon la
teinte, et le seuil mesuré ne voudrait plus rien dire.

### Découpage de la mise en œuvre

- **9a** — chaîne Web Audio, les sept dimensions et leurs plages en pas
  discriminables. ✅
- **9b** — escalier adaptatif, seuil en pas, statuts, persistance v6, XP et
  badges. ✅
- **9c** — toutes les routes d'une famille, arbre couvrant et mélange exhaustif,
  longueurs de session, charge. ✅
- **9d** — redintégration et résistance au bruit comme variantes d'essai ✅ ;
  plans 2-D et modulaire restent à faire.
- **9e** — tableau de bord, export JSON, effacement, texte « à propos » et
  crédits. ✅

## Phase 10 — FSRS, prétest, journal d'erreurs, zone proximale 🔄

Quatre demandes complémentaires, dépendantes dans cet ordre : l'ordonnanceur
fournit la note « oublié » dont le journal d'erreurs se nourrit, et le journal
alimente à son tour le tableau de bord de niveau.

### 10a — FSRS remplace SM-2 ✅

**Pourquoi changer.** SM-2 applique une formule fixe à un « facteur de
facilité ». FSRS modélise la mémoire par trois grandeurs ajustées sur des
données réelles — difficulté, stabilité, récupérabilité — et prédit mieux le
moment où une carte est sur le point d'être oubliée. L'implémentation vient de
`ts-fsrs` : réécrire l'algorithme aurait été refaire un ajustement statistique
sans les données pour le faire.

**Quatre notes, pas trois.** FSRS attend Again / Hard / Good / Easy, d'où
« Oublié / Difficile / Correct / Facile ». Ce n'est pas un cran de plus sur le
même axe : l'échec alimente une grandeur distincte du modèle, les rechutes. Une
conséquence discrète mais réelle dans l'interface : c'est désormais « Oublié »
et non « Difficile » qui ramène la carte en fin de session, puisque
« Difficile » est devenu une réussite à intervalle court. Le barème d'XP suit
— « Oublié » rapporte quand même, sans quoi il serait tentant de cliquer
« Difficile » sur une carte oubliée et de fausser l'ordonnanceur pour trois
points.

**Un paramètre par défaut a été écarté, et documenté.** `enable_short_term`
fait programmer des reprises à dix minutes dans la même journée, alors que tout
l'ordonnancement du site est au jour : `du` est une date `AAAA-MM-JJ`, l'index
aussi, et les écrans comptent « les cartes dues aujourd'hui ». Stocker un état
dont on jette la précision aurait fait diverger le modèle et sa représentation.

**L'état FSRS est stocké sous les noms de la bibliothèque**, dates en ISO. Le
traduire en français aurait créé une table de correspondance à maintenir à
chaque montée de version, et c'est là que les erreurs se logent. Les champs que
le reste du site lit — `du`, `intervalle`, `revisions`, `oublis` — gardent en
revanche leur nom et leur sens. Les dates sont des chaînes et non des `Date`
pour que la base et la sauvegarde JSON rendent la même forme.

**La migration ne convertit pas, mais ne jette pas non plus.** Les cartes
repartent d'un état de modèle neuf — convertir un historique SM-2 en stabilité
et difficulté FSRS aurait produit des nombres d'allure savante et sans contenu.
En revanche l'échéance déjà acquise, l'intervalle, le compte des révisions et
des oublis sont conservés : une migration n'a pas à rendre sept mille cartes
exigibles le même jour, et ces compteurs sont de l'histoire, pas de l'état du
modèle. C'est le seul endroit de la phase où une erreur détruirait des données
réelles, d'où un essai en navigateur (`scripts/essais-migration-fsrs.mjs`) qui
fabrique une vraie base version 6, la fait ouvrir par l'application, et vérifie
ce qui en ressort.

### 10b — Prétest avant la première lecture ✅

**L'effet.** Tenter de répondre à une question avant d'avoir reçu
l'enseignement correspondant améliore la mémorisation de cet enseignement, y
compris — et surtout — quand la tentative échoue : l'erreur creuse la place où
la bonne réponse viendra se loger. La condition est qu'une vraie tentative ait
lieu, d'où un bouton « Valider » plutôt qu'un simple « suivant », et d'où aussi
l'absence totale d'enjeu.

**Trois règles, plus importantes que le code.** Aucune pénalité : la justesse ne
rapporte ni ne coûte rien, seule la tentative donne une récompense forfaitaire.
Le prétest n'alimente pas le journal d'erreurs, parce que se tromper ici est
attendu et non un oubli à rattraper. Et il ne s'affiche qu'une fois, avant la
première lecture : après, la question ne précède plus rien.

**« Passer » n'est pas « répondre ».** Le bouton existe pour qu'une consultation
rapide ne soit pas bloquée ; il met donc le prétest en sommeil pour la journée,
pas pour toujours. Le consommer définitivement sur un coup d'œil reviendrait à
le perdre pour la séance de travail qui vient.

**Un défaut trouvé en chemin, et rendu impossible.** Le prétest était produit,
validé et chiffré — et n'arrivait jamais au navigateur : la charge utile envoyée
au client est recopiée champ par champ, et le nouveau champ n'y figurait pas.
C'était la troisième fois qu'une recopie explicite oubliait un champ ajouté
depuis. Le build échoue désormais si une fiche porte un champ qui n'est ni
transmis ni explicitement écarté — la convention est devenue mécanique, comme
pour `reetiqueter` en phase 8.

**Le manifeste annonce `aPretest`.** La séance peut ainsi savoir quelles fiches
valent la peine d'être ouvertes sans déchiffrer toute la matière pour le
découvrir.

**Le contenu reste à écrire.** Trois fiches ont un prétest ; les 259 autres,
écrites avant cette phase, n'en ont pas et n'en affichent donc aucun. Rien n'est
dérivé du quiz à leur place : une question de quiz vue en prétest, corrigée, ne
mesure plus rien lorsqu'elle revient au quiz — et elle alimentera l'estimation
de niveau de la phase 10d.

### 10c — Journal d'erreurs ✅

**Une file qui s'ajoute, et ne remplace rien.** Toute réponse fausse en quiz ou
en QCM-DGFiP, et tout « oublié » sur une flashcard, ouvrent une entrée. FSRS
continue par ailleurs son travail : les deux mécanismes répondent à des
questions différentes — « quand faut-il revoir cette carte ? » pour l'un,
« qu'est-ce qui n'est pas passé ? » pour l'autre — et les confondre ferait
avancer un calendrier que la reprise n'a pas vocation à régler. Une flashcard
révisée dans le journal ne touche donc pas à son échéance.

**La règle de sortie fait tout le travail.** Une entrée ne se referme qu'après
deux réussites lors de **sessions distinctes**. Une seule réussite peut être un
coup de chance, ou le souvenir tout frais de la correction qu'on vient de lire ;
refermer là-dessus effacerait justement le signal qu'on voulait garder. Et une
nouvelle erreur remet le compteur à zéro, pour la même raison — sans quoi une
réussite ancienne et une réussite tardive suffiraient, en ayant manqué l'item
entre les deux.

**L'injection en séance est le mécanisme principal, la page n'est qu'une vue.**
Les entrées de la matière du jour sont servies d'office en étape 2, avant tout
contenu nouveau, les plus récentes d'abord — celles nées de la séance
précédente. Rien ne dépend du fait que la personne pense à aller consulter une
page séparée ; c'est ce qui distingue une file de rattrapage d'une liste de
regrets. Le plafond de douze entrées par séance suit le même principe que celui
des cartes : une file qui en sert cinquante d'un coup n'est jamais reprise.

**Le QCM-DGFiP est sa propre matière.** Ses rubriques — Français, Culture
générale, Logique, Maths — ne recouvrent aucune matière du concours ; répartir
ses erreurs ailleurs les aurait attribuées à des matières auxquelles elles
n'appartiennent pas. Les abstentions n'ouvrent rien : ne pas répondre n'est pas
se tromper, et le barème sanctionne déjà le remplissage au hasard.

**Le prétest n'y entre pas**, délibérément : s'y tromper est attendu, ce n'est
pas un oubli à rattraper.

**L'essai porte sur la règle, parce qu'une erreur y serait invisible** — l'entrée
disparaîtrait simplement un peu trop tôt, et le point faible avec elle. Le
parcours passe par une flashcard, seul item dont la reprise offre un bouton
déterministe : un QCM demanderait de connaître la bonne option avant de cliquer.

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
