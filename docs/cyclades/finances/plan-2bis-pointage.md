# Finances, 2 bis — pointage par type de vendeur : plan à valider

**Rien n'est codé de ce document.** Le prompt l'exige, et il a raison de
l'exiger : ce chantier porte un dictionnaire d'enseignes que j'écris de ma
seule connaissance, et une automatisation qui classe des dépenses sans
demander. Les deux se corrigent mal après coup.

## 0. Ce que le plan de phase 0 a manqué

Le plan `finances/plan.md` ne contient **aucune** occurrence des mots
« vendeur » ni « pointage ». Il a été écrit à partir d'une version du prompt
qui n'avait pas la section 2 bis — sa propre « section 2 bis » parle des
relevés PDF, ce qui a probablement masqué l'absence.

Conséquence sur le calendrier, et elle est bonne : les phases 1, 2, 3 livrées
correspondent bien aux phases 1, 2, 3 du prompt, et ce qui vient d'être livré
sous le nom de « phase 4 » **est** la phase 4 du prompt (usage par Odyssée,
« Qui lit mon budget »). Ce qui manque est la **phase 3 bis**, entière.

Conséquence sur ce qui existe : `categoriser()` et `RegleCategorisation`
(dans `finances.ts`) sont une version primitive de ce chantier — des règles
« si le libellé contient X, catégorie Y », sans vendeur, sans certitude, sans
journal. Elles seront **absorbées**, pas conservées en parallèle.

## 1. Les définitions (décision 10)

Je confirme l'interprétation du prompt, avec **une réserve de vocabulaire**.

| Terme | Sens retenu |
|---|---|
| **Pointer** | marquer une opération **vue, reconnue et classée** : vendeur, type, catégorie, et la ligne de budget si elle est prévue |
| **Vendeur** | entité normalisée tirée du libellé : nom canonique + alias |
| **Type de vendeur** | famille puis type, taxonomie modifiable, reliée aux catégories de budget |

Statuts : `a-pointer`, `pointee-auto`, `pointee-par-moi`, `a-revoir`.

**La réserve.** En comptabilité française, « pointer » désigne déjà le fait de
cocher une opération contre un relevé — c'est-à-dire exactement le
rapprochement de solde (2.5), qui est autre chose. Garder votre mot est le
bon choix : c'est le vôtre, et l'application est la vôtre. Mais pour que la
confusion ne s'installe pas, les écrans nommeront toujours l'autre en entier,
« **rapprochement de solde** », jamais « pointage » ni « pointer le relevé ».
C'est déjà le cas dans ce qui est livré.

## 2. La taxonomie (décision 11)

**Une seule taxonomie, et les catégories sont celles du budget.** C'est ce qui
rend la comparaison prévu / réalisé cohérente par construction plutôt que par
tableau de correspondance — un tableau que personne ne tient à jour.

Douze familles, **cinquante-neuf types** — plus trois « états » (§2 bis).
*(Correction : la première version de ce plan annonçait « quarante-six »,
qui était une erreur de comptage ; le tableau ci-dessous, lui, n'a pas
changé et c'est celui qui a été validé.)* Le niveau de finesse est choisi
sur un critère simple : **un type doit pouvoir porter une décision différente d'un
autre**. « Boulangerie » et « supermarché » se séparent parce qu'on peut
vouloir pointer l'un automatiquement et pas l'autre ; « boulangerie » et
« pâtisserie » ne se séparent pas, parce qu'on n'en ferait jamais rien.

| Famille | Types | Catégorie de budget par défaut |
|---|---|---|
| Alimentation | supermarché, supérette, boulangerie, boucherie, primeur, marché, épicerie spécialisée, livraison de repas | Alimentation |
| Restauration | restaurant, café et bar, restauration rapide, cantine | Restauration |
| Transports | carburant, péage, stationnement, transport public, train, avion, taxi et VTC, location de véhicule, entretien automobile | Transports |
| Logement | loyer, charges de copropriété, travaux et bricolage, ameublement | Logement |
| Énergie et eau | électricité et gaz, eau, combustibles | Énergie |
| Télécoms | opérateur mobile, accès internet | Télécoms |
| Assurances et santé | assurance, mutuelle, pharmacie, praticien, laboratoire, hôpital | Santé / Assurances |
| Abonnements | streaming vidéo, musique, presse, logiciel, salle de sport | Abonnements |
| Commerce | commerce en ligne, habillement, équipement, culture et loisirs, animalerie | Vie courante |
| Banque | frais bancaires, intérêts, retrait d'espèces, remboursement de crédit | Banque |
| Administrations | impôts et taxes, organisme social, amende, administration | Impôts et taxes |
| Revenus et épargne | employeur, prestation sociale, pension, virement d'épargne, placement | Revenus / Épargne |

Plus deux types qui ne sont pas des familles mais des **états** :
**commerce multi-catégories** (grande surface, place de marché) et
**intermédiaire de paiement** (quand le libellé ne livre pas le vendeur
final). Les deux sont en mode « proposer », jamais « auto ».

**Vendeurs ambigus.** Un hypermarché vend de l'alimentation, du carburant et
de l'électroménager ; le libellé ne dit pas lequel. Trois options étaient
possibles ; je retiens la troisième.

1. Tout ranger en « alimentation » — faux, et faux systématiquement.
2. Laisser « à classer » — correct, et insupportable : c'est le vendeur le
   plus fréquent d'un relevé.
3. **Pointer en « commerce multi-catégories », proposer la catégorie la plus
   fréquente pour ce vendeur chez vous, et offrir le fractionnement.**

**Le fractionnement est déjà écrit.** `diviser()` et `controlerParts()`, de la
phase 3, répartissent une opération en parts qui somment **exactement** au
centime — le reste de la division va à la dernière part. Il n'y a rien à
réécrire, seulement un écran.

## 3. Reconnaître le vendeur

Déterministe, local, sans IA, sans réseau. Quatre étapes.

**3.1 Normaliser.** Majuscules, accents retirés, espaces réduits — la fonction
`normaliser()` de l'appariement, déjà écrite et éprouvée. Puis retirer le
bruit : mentions de paiement (`CB`, `PRLV`, `VIR`, `SEPA`, `FACT`), dates
(`12/10`, `021025`), numéros de carte déjà masqués, références (`REF`,
suites de plus de six chiffres), codes de terminal.

Les villes sont le cas pénible : « CARREFOUR CITY TOURNAY » contient une
enseigne et une commune, et aucune liste de communes n'est embarquée — ce
serait un fichier de trente-cinq mille lignes pour un gain marginal. On ne
retire donc **pas** les villes : on apparie sur le **début** du libellé
normalisé, où l'enseigne se trouve presque toujours.

**3.2 Résoudre, dans cet ordre.**

| Rang | Source | Certitude |
|---|---|---|
| 1 | mes alias et règles confirmés | **certain** |
| 2 | appariement approché avec un vendeur déjà vu, au-dessus du seuil | probable |
| 3 | dictionnaire embarqué, entrée « sûr » | **certain** |
| 4 | dictionnaire embarqué, entrée « ambigu » | probable |
| 5 | catégorie fournie par la banque, si elle existe | probable |
| 6 | rien | inconnu |

Mes règles passent **avant** le dictionnaire : c'est la règle que le prompt
pose, et elle est juste — le dictionnaire est écrit par moi sans avoir vu vos
relevés, vous les avez sous les yeux.

**3.3 L'appariement approché.** Distance de Levenshtein normalisée sur les
trente premiers caractères, seuil à **0,85**. Mesuré, pas décrété : le jeu
synthétique dira le taux de faux appariements, et le seuil bougera si la
mesure le demande. La borne existe pour une raison précise, que le prompt
nomme : « un vendeur proche mais différent n'est pas confondu ».

**3.4 Aucune requête.** Pas d'enrichissement, pas de logo distant, pas
d'icône. Le contrôle existe déjà et passe sur tous les écrans de Finances :
l'essai en navigateur compte les requêtes sortantes et exige zéro.

## 4. Le dictionnaire par défaut (décision 15)

**Ce que je propose, et ce que je ne promets pas.**

Taille de départ : **environ 250 entrées**, et non « plusieurs centaines »
au sens de six cents. La raison est une contrainte du prompt que je prends au
sérieux — « **pas d'entrée en cas de doute** ». Je connais bien une centaine
et demie d'enseignes françaises majeures et la forme de leurs libellés ; au
delà, j'écrirais des entrées plausibles et invérifiables, dont chacune est un
faux positif potentiel. Deux cent cinquante entrées sûres valent mieux que
six cents dont deux cents sont inventées.

Répartition visée, par famille :

| Famille | Entrées | Dont « sûr » |
|---|---|---|
| Alimentation | 35 | 30 |
| Restauration | 20 | 12 |
| Transports | 30 | 25 |
| Énergie et eau | 15 | 14 |
| Télécoms | 12 | 12 |
| Assurances et santé | 30 | 22 |
| Abonnements | 25 | 23 |
| Commerce | 35 | 20 |
| Banque | 20 | 18 |
| Administrations | 18 | 16 |
| Revenus et épargne | 10 | 6 |
| **Motifs génériques** | 15 | 15 |

Les **motifs génériques** sont la part la plus sûre et la plus utile :
`RETRAIT`, `VIREMENT DE`, `VIREMENT A`, `COTISATION`, `FRAIS`, `CHEQUE`,
`INTERETS`, `REMBOURSEMENT`. Ils ne nomment aucune enseigne, ne vieillissent
pas, et couvrent les lignes qu'aucun dictionnaire d'enseignes n'attrape.

**Forme.** Un fichier de données `src/donnees/vendeurs.json`, versionné et
daté, **séparé du code**, avec par entrée : motifs normalisés, nom canonique,
type, statut `sur` ou `ambigu`. Un garde-fou refuse à la construction : un
motif de moins de quatre caractères, un motif qui est un mot courant du
français ou de la plomberie bancaire, une entrée sans type déclaré.

**Licence.** Aucune liste tierce n'est consultée ni reprise. Les entrées sont
écrites à la main ; un nom d'enseigne employé comme identifiant factuel dans
un fichier de correspondance ne pose pas de difficulté pour un dépôt public.

**Ce que je ne promets pas.** Le taux de reconnaissance sera mesuré sur un
jeu de **libellés synthétiques** que j'écris aussi — il mesure donc surtout la
cohérence entre ce que j'ai écrit d'un côté et de l'autre. Il sera rapporté
comme tel, et il ne dit **rien** de vos vrais relevés. Le seul chiffre qui
vaudra quelque chose est celui de vos trois premiers imports.

**Mise à jour.** Une nouvelle version du fichier ne modifie **jamais** une
opération déjà pointée : elle ne produit que des propositions sur ce qui est
encore à pointer. Vos règles masquent ou remplacent une entrée.

## 5. Quand pointer tout seul (décisions 12 et 14)

**Une opération est pointée automatiquement si, et seulement si**, les six
conditions sont réunies :

1. le vendeur est **certain** (rang 1 ou 3 de la résolution) ;
2. son type est en mode **auto** dans le préréglage courant ;
3. le **montant est habituel** : dans l'écart absolu médian de l'historique de
   ce vendeur, avec un plancher — la même mécanique que la veille, et pour la
   même raison, un vendeur toujours à 9,99 € ne doit pas rendre 10,49 €
   aberrant ;
4. le montant est **sous le plafond** ;
5. **aucune anomalie** (section 6) ;
6. compte et devise habituels.

**Les trois préréglages**, et une règle de conception tirée de la veille : ils
ne diffèrent que sur **un axe**. Dans la veille, trois réglages qui variaient
sur deux axes à la fois en avaient rendu un aveugle et un
contre-productif — mesuré, pas supposé. Ici, l'axe est le **plafond** et
l'**ensemble des types en auto** ; les anomalies et la règle du montant
habituel sont **identiques** partout.

| | Prudent | Standard | Rapide |
|---|---|---|---|
| Plafond, vendeur avec historique | 50 € | **150 €** | 400 € |
| Plafond, première occurrence (dictionnaire) | 20 € | **60 €** | 150 € |
| Occurrences minimales pour « historique » | 3 | **3** | 3 |
| Types en auto | abonnements, télécoms, énergie | + alimentation, transports, banque | + restauration, commerce |
| Types jamais auto | tout le reste | multi-catégories, intermédiaire, santé, revenus | multi-catégories, intermédiaire |

**Recommandation : Standard.** Et une proposition que le prompt n'exige pas :
la **santé reste hors de l'auto même en Rapide**. Une pharmacie pointée
automatiquement fait entrer un fait médical dans une catégorie sans que
personne l'ait regardé — et 2 bis.8 classe précisément ces types comme
sensibles.

**Trois occurrences, pas deux** : la même raison qu'à la détection de
récurrences, où elle est déjà écrite et éprouvée. Par deux points passe
exactement une droite, et la régularité qu'on y lit est celle qu'on y a mise.

**Jamais pointés automatiquement** : vendeur inconnu, vendeur seulement
probable, virement non reconnu, retrait d'espèces, montant au-dessus du
plafond, devise inhabituelle.

Les valeurs de ce tableau sont des **points de départ à mesurer**, comme les
seuils de la veille l'ont été. L'engagement est de mesurer le taux de faux
pointages sur le jeu synthétique et de **publier le chiffre**, y compris s'il
est mauvais.

## 6. Les anomalies : signalées, jamais pointées

Montant inhabituel pour le vendeur ; vendeur inconnu ; doublon probable (même
vendeur, même montant, même jour) ; prélèvement attendu absent ; hausse d'un
abonnement ; débit après une résiliation déclarée ; devise ou pays inhabituel ;
frais bancaires.

Statut `a-revoir`, vocabulaire neutre. **L'application ne détecte pas la
fraude et ne le prétend pas** : elle signale des écarts à ce qu'elle a déjà
vu. L'écran « À propos » le dira en ces termes.

## 7. Le nom inconnu, et la règle créée sur le champ (2 bis.6 bis)

C'est votre demande explicite, et c'est l'écran qui décide si tout le reste
sert à quelque chose. La règle de conception : **un vendeur par ligne, jamais
une opération par ligne**. Six vendeurs inconnus couvrant quatorze opérations
font six lignes, parce que traiter quatorze lignes dont huit sont le même
commerçant est exactement ce qui fait abandonner.

Tri par montant cumulé puis nombre d'opérations. **Dix à la fois**, puis
« traiter les dix suivants ».

## 8. Les maquettes

### 8.1 Compte rendu d'import

```
┌──────────────────────────────────────────────────────────────────────┐
│ Import terminé — 87 opérations                                       │
├──────────────────────────────────────────────────────────────────────┤
│  61 pointées automatiquement     [ Les revoir ]  [ Tout annuler ]    │
│  19 à pointer                    [ Les traiter ]                     │
│   7 à revoir                     [ Les voir ]                        │
│                                                                      │
│  6 vendeurs inconnus (14 opérations)   [ Créer les règles ]          │
│                                                                      │
│  Contrôle par sondage : 5 opérations à vérifier d’un coup d’œil.     │
│  [ Vérifier ]   [ Plus tard ]                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Vendeurs inconnus — un geste par vendeur

```
┌──────────────────────────────────────────────────────────────────────┐
│ 6 vendeurs inconnus                        Traités : 0 / 6           │
│ Un vendeur par ligne. Les variantes d’un même libellé sont groupées. │
├──────────────────────────────────────────────────────────────────────┤
│  LE FOURNIL DE TOURNAY            4 opérations · 38,20 € au total    │
│  « CB LE FOURNIL DE TOURNAY 0310 », « CB LE FOURNIL TOURNAY »…       │
│  Type :  [ Boulangerie ▾ ]   suggéré d’après le libellé              │
│  [ Créer la règle ]   [ Mode avancé ]   [ Je ne sais pas ]           │
│                                                                      │
│  SARL MARTIN PLOMBERIE            1 opération · 420,00 €             │
│  Type :  [ Choisir… ▾ ]                                              │
│  [ Créer la règle ]   [ Mode avancé ]   [ Je ne sais pas ]           │
├──────────────────────────────────────────────────────────────────────┤
│ [ Plus tard ] — les opérations restent « à classer », sans relance.  │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.3 Mode avancé — avec l'aperçu de ce que le motif attrape

```
┌──────────────────────────────────────────────────────────────────────┐
│ Règle pour « Le Fournil de Tournay »                                 │
├──────────────────────────────────────────────────────────────────────┤
│ Nom canonique   [ Le Fournil de Tournay            ]                 │
│ Le libellé      [ contient ▾ ] [ LE FOURNIL        ]                 │
│                                                                      │
│ ⚠ Ce motif attraperait aussi 2 opérations d’un autre commerçant :    │
│    « CB LE FOURNIL DE PARIS 14 » (2 fois, 11,40 €)                   │
│    [ Voir ]   [ Allonger le motif ]                                  │
│                                                                      │
│ Type            [ Boulangerie ▾ ]   Catégorie : Alimentation         │
│ Ligne de budget [ Aucune ▾ ]                                         │
│ Mode            ( ) Auto   (•) Proposer   ( ) Toujours manuel        │
│                                                                      │
│ [ ] Appliquer aux 4 opérations déjà importées                        │
├──────────────────────────────────────────────────────────────────────┤
│                             [ Annuler ]   [ Créer la règle ]         │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.4 « Pourquoi ce pointage ? »

```
┌──────────────────────────────────────────────────────────────────────┐
│ 12/10   −43,90 €   CB CARREFOUR CITY TOURNAY 1210                    │
│ → Carrefour City · Supermarché · Alimentation                        │
├──────────────────────────────────────────────────────────────────────┤
│ Vendeur reconnu par : dictionnaire embarqué (entrée « sûr »),        │
│   motif « CARREFOUR CITY », version du 13/10/2026.                   │
│ Montant habituel : oui — vos 23 passages vont de 12,40 € à 71,80 €,  │
│   médiane 44,10 €.                                                   │
│ Sous le plafond de 150,00 € : oui.                                   │
│ Aucune anomalie.                                                     │
│                                                                      │
│ [ C’est faux ]   [ Changer le type ]   [ Annuler ce pointage ]       │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.5 Prévu / réalisé / écart par catégorie pointée

```
┌──────────────────────────────────────────────────────────────────────┐
│ Octobre 2026 — prévu, réalisé, écart            [ Mois ▾ ] [ Cumul ] │
├──────────────────────────────────────────────────────────────────────┤
│ Catégorie          Prévu      Réalisé       Écart                    │
│ Logement          875,00 €    892,40 €    + 17,40 €  (+2,0 %)        │
│ Alimentation      400,00 €    341,85 €    − 58,15 €  (−14,5 %)       │
│ Transports        120,00 €    164,30 €   ⚠ + 44,30 €  (+36,9 %)      │
│                                             hors tolérance           │
│ Santé              60,00 €     31,20 €    − 28,80 €  (−48,0 %)       │
│ …                                                                    │
├──────────────────────────────────────────────────────────────────────┤
│ Non pointé : 19 opérations · 284,10 €                                │
│ À revoir :    7 opérations · 118,60 €  (hors du réalisé ci-dessus)   │
│ La comparaison ne tient pas compte de ces 26 opérations.             │
└──────────────────────────────────────────────────────────────────────┘
```

La ligne « non pointé » n'est pas un détail d'affichage : sans elle, une
comparaison prévu / réalisé faite à moitié ressemble exactement à une
comparaison faite en entier, et c'est faux dans le sens rassurant.

### 8.6 « Mes règles »

```
┌──────────────────────────────────────────────────────────────────────┐
│ Mes règles                       [ Chercher…        ]  [ + Règle ]   │
├──────────────────────────────────────────────────────────────────────┤
│ Le Fournil de Tournay   contient « LE FOURNIL »   Boulangerie        │
│   Appliquée 12 fois · corrigée 0 fois · Proposer      [ Modifier ]   │
│                                                                      │
│ Mutuelle Alpha          contient « MUT ALPHA »    Mutuelle           │
│   Appliquée 9 fois · corrigée 4 fois · ⚠ rétrogradée en « proposer » │
│   Une règle souvent corrigée cesse de pointer seule.  [ Modifier ]   │
├──────────────────────────────────────────────────────────────────────┤
│ Dictionnaire embarqué : 250 entrées, version du 13/10/2026.          │
│ 3 entrées masquées par vos règles.          [ Voir le dictionnaire ] │
└──────────────────────────────────────────────────────────────────────┘
```

## 9. La file unique (2.4)

« La file à pointer et la file à rapprocher sont **une seule file** »,
filtrable. L'écran `/odyssee/rapprocher/` existe et porte déjà les probables
et les « à classer » ; il reçoit un filtre `[ Tout | À pointer | À rapprocher
| À revoir ]` plutôt qu'un second écran.

## 10. Le modèle, et ce qu'il ajoute

Cinq entités, toutes scellées, toutes en événements ajoutés :

| Entité | Rôle |
|---|---|
| `vendeur` | nom canonique, alias, type, compteurs |
| `typeDeVendeur` | taxonomie modifiable, catégorie de budget associée |
| `regleDePointage` | motif, type, mode, compteurs appliquée / corrigée |
| `evenementDePointage` | journal immuable : auteur (règle, dictionnaire, moi), avant, après |
| `versionDuDictionnaire` | quelle version a produit quel pointage |

**Conflits** : la règle est déjà écrite et éprouvée en phase 3 —
`arbitrer()` fait primer une décision humaine sur une décision automatique
quelle que soit l'heure, et conserve les deux en signalant. Le pointage
réutilise la même fonction, sans la redéfinir.

## 11. Confidentialité (2 bis.8), et ce qui est déjà en place

La règle « les autres domaines ne reçoivent que des agrégats, jamais le
vendeur ni le type » est **déjà tenue par construction** : les projections de
`consommateurs.ts`, livrées en phase 4, n'ont aucun champ où un vendeur
pourrait se glisser, et un garde-fou refuse qu'un montant apparaisse dans une
projection qui promet de n'en porter aucun.

Ce qui reste à faire quand 3 bis arrivera :

- ajouter aux déclarations un axe `vendeursAutorises`, à `false` partout sauf
  autorisation explicite, contrôlé comme l'est déjà `montantsAutorises` ;
- l'option « regrouper les types sensibles sous une étiquette générique »
  pour un usage en public ;
- vérifier qu'aucun alias, règle ni vendeur appris n'entre dans le dépôt —
  un essai qui lit l'arbre Git, pas une intention.

**Aucune XP** liée au taux de pointage automatique.

## 12. Les décisions, et mes recommandations

| # | Question | Ma recommandation |
|---|---|---|
| **10** | Définitions | **Les vôtres, confirmées.** Avec la réserve de vocabulaire du §1 : l'autre opération s'appelle toujours « rapprochement de solde » en entier. |
| **11** | Taxonomie | **12 familles, 59 types + 3 états** (§2), catégories communes au budget, ambigus en « commerce multi-catégories » proposé, fractionnement par `diviser()` déjà écrit. |
| **12** | Préréglage | **Standard**, avec la santé hors de l'auto même en Rapide. Les trois ne diffèrent que sur le plafond et la liste des types en auto. |
| **13** | Sondage | **Oui, et petit** : les 3 plus gros montants + 2 tirés au sort, seulement si 10 opérations ou plus ont été pointées seules. Un sondage qui est une corvée se saute. |
| **14** | Garde-fous | Plafond **150 €** (60 € à la première occurrence), **3 occurrences** minimum, exclusions du §5. Valeurs à **mesurer**, pas à décréter. |
| **15** | Dictionnaire | **≈ 250 entrées**, pas 600 : « pas d'entrée en cas de doute » est une contrainte qui coûte, et je la respecte. Fichier de données daté, séparé du code, aucune liste tierce. |
| **16** | « À revoir » | **Exclues du réalisé et montrées à part**, avec leur nombre et leur montant. |

## 13. Phases proposées pour 3 bis

| | Contenu | Livrée testée |
|---|---|---|
| **3 bis a** | Normalisation, résolution, taxonomie, modèle et magasins scellés. Jeu de libellés synthétiques. | **livrée** |
| **3 bis b** | Le dictionnaire (**296** entrées, et non 250) et la mesure du taux de reconnaissance, publiée telle quelle. | **livrée** |
| **3 bis c** | Politique de pointage, anomalies, journal, annulation, sondage. | **livrée** |
| **3 bis d** | Règles locales, vendeurs inconnus et création sur le champ, « Mes règles ». | **livrée** |
| **3 bis e** | Catégories pointées, vue prévu / réalisé / écart, file unique filtrable. | **livrée** |

Les décisions prises en chemin et les huit défauts trouvés par la mesure
sont dans [`phase-3bis.md`](phase-3bis.md).

## 14. Ce que je ne peux pas vérifier

- **La couverture réelle du dictionnaire sur vos relevés.** Elle ne se
  connaîtra qu'à vos trois premiers imports. Tout chiffre produit avant cela
  mesure ma cohérence avec moi-même.
- **La présence d'une catégorie fournie par la banque** dans vos exports.
  Le prompt dit de ne pas la présumer ; le relevé PDF du CIC n'en a pas.
- **Les libellés réels de vos commerçants.** Si vous m'en donnez un
  échantillon, il reste hors du dépôt, n'entre dans aucun essai ni aucune
  capture, et le jeu de test reste synthétique.

---

**À valider, ou à corriger.** En particulier les décisions 11, 12 et 15 : la
finesse de la taxonomie, le préréglage par défaut, et la taille du
dictionnaire que j'ai délibérément réduite par rapport à votre demande.
