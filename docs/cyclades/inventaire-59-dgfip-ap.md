# Inventaire du parcours DGFiP A+ (prompt 59, première étape)

Établi le 25 octobre 2026, à partir du corpus récupéré (427 fiches) et de
`sources/` reconstitué (384 fichiers, 362 contrôlés contre leurs manifestes).
Aucune fiche n'est écrite : le pilote a demandé l'inventaire seul.

## 1. Ce qui existe aujourd'hui pour A+

**Rien.**

| | |
| --- | --- |
| Fiches sous `content/dgfip-ap/` | **0** |
| Cartes de révision | 0 |
| Prétests | 0 |
| Questions de quiz de catégorie A+ | **0** |
| Thèmes déclarés dans `registre.ts` | **0** (`themes: []`) |

Le registre porte bien l'entrée `dgfip-ap`, mais vide, et avec deux aveux
écrits dans le code : `voie: 'a-preciser'` et `referentiel: { origine:
'a-etablir' }`.

La banque « QCM — DGFiP » récupérée compte 540 questions : 344 de catégorie
d'origine `B`, 153 `maison`, 43 `A`, **aucune `A+`**. Avec la règle de filtrage
du prompt (« A et A+ tirent dans A et B »), un candidat A+ dispose donc
aujourd'hui de **387 questions**, dont aucune n'a été écrite pour son concours.
Le champ `statut` que le prompt mentionne (« au statut annales ») **n'existe sur
aucune des 540 questions** : il reste à introduire.

Le seul contenu DGFiP du corpus est sous `dgfip-a/` : deux fiches
d'organisation (administration centrale, réseau déconcentré). Elles relèvent du
parcours de B, pas du mien.

## 2. Ce que sont les épreuves, et leur poids

Fondement retenu par le pilote : **arrêté du 2 mars 2011, NOR BCRE1104996A,
article 1er, version du 22 décembre 2025.**

### 2.1 Le concours professionnel — la seule voie avec des écrits

| Épreuve | Durée | Coefficient | Part |
| --- | --- | --- | --- |
| Admission — entretien avec le jury | 40 min | **8** | 40 % |
| Admissibilité n° 1 — note administrative sur dossier (≤ 30 p.) | 5 h | **6** | 30 % |
| Admissibilité n° 2 — épreuve professionnelle (15 pts) + analyse financière (5 pts) | 4 h | **6** | 30 % |

L'épreuve n° 2 se décompose en deux parties de poids très inégal :

- **première partie, 15 points sur 20**, au choix du candidat parmi six
  options : fiscalité professionnelle ; fiscalité personnelle et patrimoniale ;
  gestion comptable et analyse financière ; gestion publique (État et
  collectivités locales) ; gestion des ressources et organisation de la DGFiP ;
  systèmes d'information ;
- **seconde partie, 5 points sur 20**, commune à tous : analyse financière sur
  fonds documentaire.

Soit, rapporté au total des coefficients (20) : l'option choisie pèse **22,5 %**
du concours, et l'analyse financière commune **7,5 %**.

### 2.2 Les deux examens professionnels — aucun écrit, aucun programme

L'examen ouvert aux inspecteurs (IFiP → IPFiP) et celui ouvert aux inspecteurs
départementaux à compétence nationale (IDCN → IPFiP), tous deux régis par un
arrêté du 11 septembre 2025, sont **identiques** : présélection sur dossier de
reconnaissance des acquis, puis **oral de quarante minutes, seul noté**. Le
dossier n'est pas noté.

**Aucune épreuve écrite. Aucun programme de connaissances.**

## 3. Le fait qui commande tout l'inventaire

**Il n'existe plus de programme de l'IPFiP.** L'article 2 de l'arrêté du
4 septembre 2025 a abrogé l'annexe de l'arrêté du 2 mars 2011
(`LEGIARTI000030768328`, état `ABROGE` au 6 septembre 2025).

Conséquence directe, et c'est ce qui distingue A+ de B et de A : **« ce qui
manque » ne peut pas être déduit d'un programme, parce qu'il n'y en a plus.**
Les six options de l'article 1er sont la seule délimitation en vigueur, et ce
sont des intitulés de quelques mots, pas des listes de notions.

Pour B et A, l'inventaire se fait en confrontant le contenu à l'annexe du
programme. Pour A+, il faut construire la délimitation avant de pouvoir mesurer
le manque — et cette construction est un choix, pas une lecture. Elle revient
au pilote.

## 4. Ce qui manque, classé par poids

### 4.1 L'entretien avec le jury — coefficient 8, le plus lourd

Rien n'existe. Et rien de ce que le prompt 59 décrit (cours, cartes, quiz de
6 à 10 questions) ne prépare un entretien de quarante minutes : ce qui s'y joue
est un parcours à exposer, des choix à défendre, une connaissance de la maison.
**C'est l'épreuve la plus lourde des trois voies, et la seule commune aux
trois.** Il manque donc, d'abord, une forme que le site n'a pas encore :
questions d'entretien, trames de présentation de parcours, mises en situation.

### 4.2 La note administrative — coefficient 6

Épreuve de méthode sur dossier, pas de connaissances. Il manque une fiche de
méthode (structure d'une note, formulation d'un avis et d'une proposition,
gestion de cinq heures et de trente pages) et des dossiers d'entraînement. Le
corpus INSP contient des fiches de méthode comparables (tag `méthodologie`) :
la forme existe, le contenu A+ non.

### 4.3 L'épreuve professionnelle — coefficient 6

**Analyse financière commune (5 pts sur 20)** : à écrire pour tous les
candidats, quelle que soit leur option. C'est le besoin le plus net et le moins
discutable de tout le parcours — un seul sujet, obligatoire, et aucune fiche.

**Les six options (15 pts sur 20)** : un candidat n'en choisit qu'une. Écrire
les six revient à écrire cinq sixièmes de contenu que chaque candidat n'ouvrira
pas. Le pilote doit trancher : couvrir les six, ou en retenir une ou deux.

Ce que `sources/` permet de documenter, option par option, avec des sources
officielles datées :

| Option | État des sources | Appréciation |
| --- | --- | --- |
| Gestion des ressources et organisation de la DGFiP | **Forte** : 72 textes fondateurs, 45 documents B4-SVC2, 26 RESEAU, 26 STATUT, 12 B4-PERF (PAP/RAP, bilan IGF du COM) | La mieux couverte, de loin |
| Gestion publique (État et collectivités locales) | Moyenne : PAP/RAP mission GFP, rapport spécial PLF 2026 | Suffisante pour un cadrage |
| Gestion comptable et analyse financière | **Faible** | Rien de dédié dans la collecte |
| Fiscalité professionnelle | **Faible** : quelques BOFiP épars | À collecter |
| Fiscalité personnelle et patrimoniale | **Faible** | À collecter |
| Systèmes d'information | **Faible** : arrêté DiSI, schéma directeur du numérique *bloqué* | À collecter |

## 5. Les documents qui manquent

### 5.1 Bloqués, et récupérables par Alexis seul

Tirés de `collecte-a-telecharger-a-la-main.csv` (150 lignes), ceux qui
concernent A+ :

- **Les six rapports d'activité nationaux de la DGFiP 2019-2024**, le **COM
  2023-2027**, ses bilans d'étape et le **schéma directeur du numérique** —
  tous bloqués par le pare-robot d'`economie.gouv.fr`. Ce sont les pièces
  centrales de l'option « organisation » et du cadrage de l'épreuve n° 1.
- **54 sujets de concours internes 2024-2026** (code A9), même blocage.
- **Quatre rapports d'activité de direction locale** (sites de préfecture,
  connexion coupée).

### 5.2 Inexistants publiquement — à acter comme telles

- **Aucun corrigé d'annales n'existe sur les pages officielles**, pour aucune
  voie. La fiabilisation des QCM contre les corrigés, prévue par les règles de
  `fiches-insp`, est donc **impossible pour A+** par cette voie.
- **Aucun sujet du concours professionnel d'IPFiP** n'a été trouvé, ni récent
  ni ancien.
- Les guides de préparation de l'ENFiP pour l'IPFiP sont réservés aux agents
  (code A7, introuvables).

### 5.3 Non écrit faute de source, sur décision du pilote

Le découpage « assiette / recouvrement » d'un SIP ne figure dans aucun texte
officiel obtenu. Il va en « non trouvé » et n'est pas écrit.

## 6. Deux réserves que je dois poser avant d'écrire

**La première porte sur la forme demandée.** Le prompt 59 décrit, pour chaque
fiche, dix questions de prétest, un cours, une fiche simplifiée, des cartes et
un quiz de 6 à 10 questions à correction détaillée. Cette forme sert bien B et
A, dont les épreuves comportent un QCM et un QRC — on y restitue des
connaissances. Les épreuves d'A+ ne comportent **aucun QCM** : une note
administrative, une épreuve professionnelle sur dossier ou cas pratique, une
analyse financière, un entretien. Ce sont des épreuves de **production**, pas de
restitution. Un quiz à choix multiples prépare mal un candidat à rédiger un avis
en cinq heures.

Je peux appliquer la forme du prompt telle quelle — elle n'est pas inutile, les
connaissances restent nécessaires — mais je signale que le rapport
effort/bénéfice est bien moins bon que pour B et A, et qu'une forme adaptée
(dossiers d'entraînement, trames, questions d'entretien) servirait davantage. À
toi de trancher ; je ne modifie pas le prompt de mon côté.

**La seconde porte sur les prérequis.** Deux des quatre prérequis du prompt 59
ne sont pas réunis pour A+ :

1. *« Les thèmes sont posés : `registre.ts` est renseigné par B »* — pour
   `dgfip-ap`, `themes: []`. Or le prompt exige que mes fiches « se rangent sous
   ces thèmes, et nulle part ailleurs ». Je ne peux donc pas ranger une seule
   fiche aujourd'hui. Et comme le programme est abrogé (§ 3), les thèmes d'A+ ne
   se déduisent pas d'une annexe : ils se décident.
2. *« Le corpus voyage chiffré : archive sur la branche `corpus-chiffre` »* —
   l'archive n'est pas autorisée ; elle attend la décision d'Alexis.

## 7. Ce que je propose, dans cet ordre

1. **Le pilote arrête les thèmes de `dgfip-ap`**, puisqu'ils ne se lisent nulle
   part. Proposition minimale, calée sur l'article 1er : les trois épreuves
   comme thèmes de premier rang, et les six options sous l'épreuve n° 2.
2. **Le pilote arrête le périmètre des options** : les six, ou un
   sous-ensemble. Ma recommandation : commencer par « gestion des ressources et
   organisation de la DGFiP », la seule que `sources/` documente solidement, et
   l'analyse financière commune, obligatoire pour tous.
3. **Alexis récupère les rapports d'activité, le COM et le schéma directeur du
   numérique** — sans eux, l'option la mieux couverte reste adossée à des
   textes fondateurs et à des offres d'emploi, pas à la parole de la DGFiP sur
   son activité.
4. Alors seulement, le premier lot de fiches.
