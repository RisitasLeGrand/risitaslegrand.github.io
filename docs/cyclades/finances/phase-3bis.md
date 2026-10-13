# Finances, 3 bis — le pointage par type de vendeur

Les cinq sous-phases, et les huit défauts trouvés par la mesure plutôt que
par la relecture. Décisions 11, 12 et 15 validées le 13 octobre 2026.

## Ce qui est livré

| Module | Rôle |
|---|---|
| `taxonomie.ts` | 12 familles, 59 types + 3 états, catégories communes au budget |
| `vendeurs.ts` | Normalisation, résolution en six rangs, appariement approché, groupement des inconnus |
| `donnees/vendeurs.json` | 296 entrées, 213 sûres, écrites à la main |
| `pointage.ts` | Préréglages, anomalies, sondage, rétrogradation d'une règle |
| `regles-pointage.ts` | Motif proposé, brouillon, aperçu sur le passé, contradictions |
| `categories-pointees.ts` | Réalisé par catégorie, non-pointé, catégories d'un seul côté |
| `donnees-pointage.ts` | Quatre magasins scellés, annulation à quatre échelles |
| `/odyssee/rapprocher/` | La file **unique** et filtrable, les vendeurs inconnus, les catégories pointées |
| `/odyssee/mes-regles/` | Règles, vendeurs appris, dictionnaire, contradictions |

Schéma **v28** : `odysseeVendeurs`, `odysseeReglesPointage`,
`odysseePointages`, `odysseeTaxonomie`.

## Les huit défauts, et ce que chacun apprend

**1. Les dates étaient cherchées après la normalisation**, qui remplace le
`/` par une espace. Elles n'étaient jamais trouvées. L'ordre des étapes
d'un nettoyage de texte n'est pas une préférence de style.

**2. Un motif générique battait une enseigne** dès qu'il était plus long :
« PRELEVEMENT SFR ABONNEMENT » se classait en « Abonnement ». Quatre
libellés d'un coup. Les génériques sont devenus un filet, en seconde passe.

**3. Un motif collait sur un fragment.** « BOULANGERIE PAUL » contient
« BOULANGER », et une boulangerie de quartier se classait en magasin
d'électroménager. Les motifs collent désormais sur des mots entiers — et
l'entrée « Boulanger », prise seule, était parfaitement juste : aucune
relecture du dictionnaire ne l'aurait trouvée.

**4. La hausse d'abonnement passait sous le plancher de dispersion.** Un
abonnement est à prix fixe ; la bande généreuse du montant habituel —
quatre écarts médians, plancher de cinq euros — avalait une hausse de
13,49 € à 19,99 €, petite en euros et considérable en proportion. Elle se
mesure en relatif.

**5. Un garde-fou qui avait tort.** Il refusait qu'une entrée « sûre » vise
un type sensible. Or `statut` dit que le **nom** n'est pas ambigu, ce qui
est vrai d'« URSSAF ». Il aurait fallu mentir sur seize entrées pour une
protection qui ne venait pas de là : elle vient de `jamaisAuto`, sur le
type. Le contrôle vérifie maintenant cet invariant-là.

**6. Le seuil de ressemblance à 0,85 sépare** « ETS DURAND ET FILS » de
« ETS DURAND FILS » — trois caractères sur dix-huit, soit 0,83. C'est le
bon côté de l'erreur, et il faut le savoir : le regroupement des variantes
tient sur la troncature, pas sur un mot retiré au milieu.

**7. Le filtre réaffichait un titre au-dessus du vide.** « Probables — un
geste chacun » apparaissait même sans probable, parce que la fonction de
filtrage écrasait la logique de vacuité que la peinture venait
d'appliquer. Un titre ne s'affiche que si le filtre le permet **et** qu'il
y a quelque chose dessous.

**8. Deux sigles de trois lettres sont des mots français.** Le seuil de
quatre caractères refusait EDF, SFR, AXA — des enseignes réelles — et
acceptait BUT, NOZ, DON, CAF s'il avait été baissé. Une liste courte et
justifiée de sigles admis vaut mieux qu'un seuil déplacé.

## Les décisions qui ne se règlent pas

**La santé reste hors de l'automatisme, même en préréglage Rapide.** Cela
dépasse ce que le prompt demandait. Une pharmacie pointée sans que personne
la regarde fait entrer un fait médical dans une catégorie, et aucun gain de
clic ne paie cela. Six types sont marqués `sensible`, et la taxonomie
refuse qu'un type sensible ne porte pas `jamaisAuto`.

**Un retrait d'espèces n'est jamais pointé seul.** Le billet sorti du
distributeur ne dit pas ce qu'il a payé ; le ranger en « banque » ferait
disparaître une dépense réelle dans une catégorie technique.

**Une règle créée en un geste naît en « proposer ».** Jamais en
automatique. Une règle écrite en trois secondes n'a pas été relue, et lui
donner le droit de classer seule ferait d'un clic une décision dont la
portée n'est pas mesurée.

**Une opération pointée par la personne n'est jamais modifiée** — ni par
une règle, ni par une mise à jour du dictionnaire, ni par un réimport.
C'est la première condition examinée, avant même de regarder ce qui a été
reconnu.

**Deux corrections contradictoires posent une question.** Classer un
hypermarché en alimentation un jour et en carburant le lendemain n'est pas
une erreur : c'est un vendeur multi-catégories, et la bonne réponse est
peut-être de le dire.

## La mesure, et sa réserve

`npm run mesurer:reconnaissance` : **100 % reconnus, 0 faux positif** sur
51 libellés synthétiques.

Ce chiffre ne dit **rien** de relevés réels. Le jeu de libellés et le
dictionnaire sortent de la même main ; la mesure porte sur la robustesse de
la normalisation aux formes de libellé — mentions de carte, dates collées,
villes, références, intermédiaires, troncatures — et sur la cohérence entre
les deux côtés de cette main. Le seul chiffre qui vaudra quelque chose est
celui des trois premiers imports réels.

Le rapport l'écrit lui-même, à chaque exécution.

## Essais

| Suite | Assertions |
|---|---|
| `essais:vendeurs` | 93 |
| `essais:pointage` | 69 |
| `essais:regles-pointage` | 61 |
| `essais:rapprocher-ecran` (pointage compris) | 63 |

## Ce que 3 bis ne fait pas

- **Le fractionnement n'a pas d'écran.** `vueDesCategories` répartit
  correctement une opération entre plusieurs catégories et les essais le
  vérifient au centime, mais l'éditeur de parts reste à écrire. Le moteur,
  lui, est celui de la phase 3 — `diviser()` et `controlerParts()`.
- **Le mode avancé de création de règle** (modifier le motif, choisir la
  comparaison, viser une ligne de budget, appliquer au passé) existe en
  module — `controlerLeBrouillon`, `apercuSurLePasse` — et pas encore en
  écran. Le geste simple, lui, est là.
- **Le compte rendu d'import** « N pointées, M à pointer, K à revoir »
  n'est pas affiché après l'import : le pointage se fait à l'ouverture de
  la file, et les trois nombres y figurent. La maquette 8.1 reste à faire.
- **Le sondage** est calculé et éprouvé, pas encore affiché.
