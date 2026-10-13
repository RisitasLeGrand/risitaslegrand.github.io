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
| `essais:regles-pointage` | 71 |
| `essais:fractionnement` | 42 |
| `essais:rapprocher-ecran` (pointage, fractionnement et mode avancé compris) | 97 |

## Le fractionnement, et ce qu'il a appris

`vueDesCategories` répartissait déjà correctement une opération entre
plusieurs catégories, et les essais le vérifiaient au centime — mais rien ne
permettait d'en **fabriquer** une. `Pointage.parts` existait, personne ne
pouvait le remplir. `fractionnement.ts` est la moitié manquante.

**La convention de signe était implicite, et c'est ce qui la rendait
dangereuse.** Une part porte le signe de son opération : une dépense de
120 € vaut `-12000`, et ses parts `-7000` et `-5000`. C'est imposé par le
calcul d'en face, qui ajoute `-part.centimes` à la catégorie. Des parts
positives sur une dépense sommeraient correctement et la feraient compter en
recette — l'arithmétique passe, la lecture est fausse, et rien ne le dirait.
C'est la même famille de défaut que le `abs(part)` de la phase 3, qui lisait
un remboursement net comme une dépense. Les signes mêlés sont donc refusés, et
un essai vérifie d'abord qu'ils **somment bien** avant de vérifier qu'ils sont
refusés quand même.

**Trois contrôles, et deux d'entre eux ne vivent pas où l'on croit.** Un
`Pointage` porte l'identifiant de son opération, pas son montant : le
contrôle « les parts somment à l'opération » ne peut pas vivre dans
`controlerPointage`. Il est donc dans `fractionnement.ts`, appelé par
l'éditeur et par l'écriture. En échange, les deux qui n'ont besoin de rien
d'autre que du pointage — pas deux parts sur le même type, pas de signes
mêlés — ont été **ajoutés** à `controlerPointage`, où ils ferment toutes les
voies d'écriture et pas seulement celle de l'éditeur.

**L'éditeur s'ouvrait sur un état invalide.** La première version ouvrait sur
deux parts égales du type courant, c'est-à-dire sur deux parts du même type :
l'écran accueillait par un reproche quelqu'un qui n'avait encore rien fait.
La seconde part naît désormais « à identifier » — un état, pas un type, et il
dit exactement ce qu'il en est.

**Un geste de correction ne doit pas créer une erreur de plus.** Retirer une
part reverse son montant sur la plus grosse des restantes ; en ajouter une
alors que tout est réparti lui donne la moitié de la plus grosse plutôt que
zéro. Sans ces deux reports, corriger une erreur en produirait une seconde,
et l'écran répondrait à une correction par un reproche.

## Le mode avancé, et ce qu'il a appris

Six champs — nom, type, motif, comparaison, ce que la règle a le droit de
faire, ligne de budget visée —, l'aperçu sur le passé, et le second geste
qui l'applique. Chacun de ces six est une décision que le geste en un clic
prend déjà sans le dire : le mode avancé ne rend pas l'écran plus compliqué,
il avoue lesquelles.

**Le brouillon part du geste simple.** Même motif proposé, même type choisi
au-dessus, même mode « proposer ». Ouvrir sur un formulaire vide aurait fait
du mode avancé un autre écran plutôt que le même, déplié.

**« Pointer seule » est désactivé, pas masqué**, quand le type l'interdit. Le
masquer laisserait croire qu'il n'existe pas ; le montrer barré dit qu'il
existe et pourquoi il est hors d'atteinte.

**« Exact » n'est pas exact sur le libellé du relevé.** Les trois
comparaisons portent sur le libellé **nettoyé** — mentions de carte, dates,
références, ville —, si bien que deux lignes qui ne diffèrent que par leur
date sont « exactement » le même libellé. C'est le bon comportement, la date
n'appartient pas au vendeur ; mais ce n'est pas ce qu'on attend du mot, et
c'est un essai qui l'a montré en échouant sur une attente fausse. L'écran le
dit maintenant sous le choix.

**L'aperçu cachait sa propre protection.** Quand tout ce qu'une règle attrape
est déjà pointé par la personne, il disait « cette règle ne touche aucune
opération déjà importée » — vrai, et trompeur : on croit avoir écrit un motif
qui rate sa cible, et le premier réflexe est de l'élargir. Il dit maintenant
que la règle les attrape et que ce sont vos propres pointages qui les
retiennent. Trouvé par l'essai d'écran, corrigé dans le module, et porté par
deux essais purs.

**Appliquer au passé est refusé sur un type « jamais automatique ».**
Reclasser vingt-trois opérations d'un geste *est* un pointage automatique,
quoi qu'en dise le bouton qui le déclenche, et ces types-là existent
précisément pour que ce geste n'existe pas sur eux. L'écriture porte en
revanche l'auteur « règle » et non « moi », bien que la personne ait décidé :
sans cela, « Défaire ses pointages » — qui cherche les pointages d'auteur
« règle » — ne pourrait plus défaire une application de masse autrement
qu'opération par opération.

**Le jeu d'essai a dû gagner un vendeur.** Il n'en portait qu'un d'inconnu :
le geste simple le consommait, et le mode avancé n'avait plus rien sur quoi
s'éprouver. Un cinquième mouvement mensuel a été ajouté au relevé fabriqué,
et les comptes qui en dépendaient avec lui.

## Ce que 3 bis ne fait pas

- **Le compte rendu d'import** « N pointées, M à pointer, K à revoir »
  n'est pas affiché après l'import : le pointage se fait à l'ouverture de
  la file, et les trois nombres y figurent. La maquette 8.1 reste à faire.
- **Le sondage** est calculé et éprouvé, pas encore affiché.
