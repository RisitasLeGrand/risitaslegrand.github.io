# Sources à atteindre — liste de courses

**13 octobre 2026.** La passerelle réseau de ce conteneur refuse tout hôte
extérieur à GitHub et aux registres de paquets : douze hôtes essayés à la même
minute, onze `403` au `CONNECT` (`docs/cyclades/acces-sources.md`). Ce fichier
liste donc ce que je ne peux pas aller chercher, et que tu peux me sortir.

Il est ordonné par **ce que chaque pièce débloque**, pas par commodité. Les
pièces notées ★ débloquent à elles seules une phase entière ; celles notées ·
complètent sans débloquer.

---

## Avant tout : ce dont je n'ai **pas** besoin

Pour éviter du travail inutile.

| Chantier | Sources nécessaires |
|---|---|
| **Veille du rythme de vie**, phases 2, 3 et 4 | **aucune.** Le moteur ne compare qu'à ta propre ligne de base ; les études ne servaient qu'à choisir quelles grandeurs regarder, ce qui est fait. |
| **WHO-5, PHQ-9, GAD-7** — textes, options, scores, seuils, licence | **aucune.** Tout est authentifié et empreinté (`echelles-psyche/releve-sources.md`, sections 10, 12 et 14). |
| **Finances**, phase 3 | **aucune.** |

Il reste donc trois lots : deux petits sur les échelles, un gros sur santé et
musculation.

---

## Comment me les donner

Ce qui a marché pour les échelles, et qui doit être reconduit : **imprimer la
page en PDF depuis ton navigateur, et me déposer le PDF.** J'en tire le texte
localement, j'en calcule l'empreinte SHA-256, et je consigne la chaîne de
possession. Trois relevés confiés à des modèles externes ont été rejetés avant
cela — deux d'entre eux donnaient huit items faux sur neuf tout en ayant l'air
parfaitement plausibles.

Trois règles, apprises à ce prix :

1. **Le fichier, pas le texte.** Un copier-coller perd les caractères exacts, et
   ce sont eux qui distinguent une traduction d'une autre.
2. **Un PDF par source**, sans retouche, sans sélection de pages.
3. **Dis-moi d'où il vient** — l'URL exacte, et la date. C'est ce qui fait la
   différence entre un relevé et une affirmation.

Pour les listes déroulantes (cas du sélecteur de langues ci-dessous),
**déplie-la avant d'imprimer**, ou fais une capture d'écran : une impression
PDF fige le document rendu, pas le contenu déplié d'un menu.

---

## Lot 1 — Échelles de la psyché (2 pièces, petites)

Le volet est **clos à 90 %**. Il reste deux lacunes documentées et un contrôle.

### 1.1 · La liste des variantes de français

- **Où** : `https://www.phqscreeners.com/select-screener`
- **Ce qu'il me faut** : le sélecteur de langue **déplié**, montrant les
  intitulés proposés. Une capture d'écran suffit.
- **Pourquoi** : les fichiers que tu m'as donnés s'appellent
  `PHQ9_French for France.pdf`. Rien n'établit encore combien de variantes de
  français existent, ni si elles diffèrent entre elles. Tu as attesté que la
  variante Canada est identique à celle de France, ce qui réduit l'enjeu sans
  le fermer.
- **Débloque** : rien. L'application peut se construire avec la variante
  « France » et le dire. C'est une lacune de rigueur, pas un blocage.

### 1.2 · Les conditions générales de Pfizer

- **Où** : `http://pfizer.com/general/terms.jsp`
- **Pourquoi** : l'énoncé permissif qui place le PHQ-9 et le GAD-7 dans le
  domaine public vit sur un site dont le pied de page renvoie à `pfizer.com`
  pour les conditions d'utilisation. Une autorisation portée par une page ne se
  lit pas indépendamment des conditions générales du site qui l'héberge.
- **Débloque** : rien non plus — le manuel d'instructions authentifié est
  explicite sur le domaine public (section 14.4). C'est une vérification de
  cohérence.

### 1.3 · Contrôle d'origine — à lancer depuis **ta** machine

Ce n'est pas un fichier à me donner, c'est une commande à exécuter chez toi.
Elle prouve que les fichiers que tu m'as transmis sont bien ceux que les
serveurs servent.

```bash
mkdir -p /tmp/echelles && cd /tmp/echelles
B='https://www.phqscreeners.com/images/sites/g/files/g10016261/f/201412'
curl -sSL -o phq9.pdf         "$B/PHQ9_French%20for%20France.pdf"
curl -sSL -o gad7.pdf         "$B/GAD7_French%20for%20France.pdf"
curl -sSL -o instructions.pdf "$B/instructions.pdf"
curl -sSL -o who5.pdf 'https://cdn.who.int/media/docs/default-source/mental-health/indice-(en-cinq-points)-de-bien--tre-de-l-oms.pdf'
sha256sum *.pdf
```

Colle-moi la sortie. Les empreintes attendues :

```text
408801762a1b728ebc01eaf119302539e7fb5503b855d81d603dbe9a43be9fc1  who5.pdf
b9529947a01d82b7c640176958e6e0f409a98e239380deafdfb4f27162c50298  phq9.pdf
3622a0e265cb182c0cc8cffaa836b22b8f264dd9f39f9759c68459e4fa08f02c  gad7.pdf
```

Identiques : la réserve des sections 10.1 et 12.1 tombe. Différentes : le texte
relevé reste exact **pour les fichiers que tu m'as donnés**, mais il faudra le
refaire sur ce que le serveur sert aujourd'hui.

---

## Lot 2 — Santé et traitements (★ bloque la phase 2 du chantier #170)

Le modèle, les écrans et l'enregistrement se construisent sans rien de tout
cela. **Ce qui est bloqué, ce sont les valeurs** : aucune n'entrera sans source,
et une demi-vie inconnue restera affichée « inconnue ».

### 2.1 ★ Résumés des caractéristiques du produit (RCP)

- **Où** : `https://base-donnees-publique.medicaments.gouv.fr`
- **Ce qu'il me faut** : le RCP, en PDF, **molécule par molécule**, pour le
  groupe sourçable :

| | Molécule |
|---|---|
| 1 | esters de testostérone commercialisés en France (énanthate, undécanoate — un RCP par spécialité) |
| 2 | nandrolone et ses esters |
| 3 | modafinil |
| 4 | armodafinil (si commercialisé en France ; sinon, le dire) |
| 5 | N-acétylcystéine |
| 6 | bleu de méthylène |
| 7 | caféine (spécialité pharmaceutique) |

- **Justifie** : demi-vie, voie, statut en France, contre-indications, et le
  `maturite_clinique` de chaque fiche.
- **Au mieux** : commence par les esters de testostérone et le modafinil. Ce
  sont eux qui portent le plus de valeurs.

### 2.2 ★ Thésaurus des interactions médicamenteuses

- **Où** : `https://ansm.sante.fr`, Thésaurus des interactions
  médicamenteuses, **dernière version datée**
- **Ce qu'il me faut** : le PDF complet, et sa date de version.
- **Justifie** : les niveaux d'interaction (contre-indication, association
  déconseillée, précaution d'emploi, à prendre en compte).
- **Attention** : le dépôt est public. Le catalogue d'interactions embarqué ne
  portera donc **que** des faits dérivés avec citation précise, jamais une
  recopie du thésaurus (décision 8 du plan).

### 2.3 · Limites de sécurité des nutriments

- **Où** : EFSA (`https://www.efsa.europa.eu`) et ANSES
  (`https://www.anses.fr`)
- **Ce qu'il me faut** : les apports maximaux tolérables, **nutriment par
  nutriment**, pour les treize vitamines. Un document de synthèse suffit s'il
  en existe un.
- **Justifie** : les bornes hautes affichées sur les fiches de vitamines.

### 2.4 · Liste des interdictions antidopage

- **Où** : Agence mondiale antidopage, liste **en vigueur, version datée**
- **Justifie** : le champ `statut_antidopage` de chaque molécule.

### 2.5 · Une publication primaire

- **ACD856** — *Eur J Clin Pharmacol*, 2024, DOI `10.1007/s00228-024-03645-1`
- **Ce qu'il me faut** : le texte intégral, pas le résumé. La demi-vie
  d'environ 20 h vient d'une étude à dose unique, et je veux lire les
  conditions avant d'inscrire le chiffre.

### 2.6 — Ce que je **ne** te demande pas

Les neuf molécules du groupe « à sourcer » — dihexa, PRL-8-53, KW-6356,
aticaprant, NSI-189, TUDCA, piracétam, L-théanine, armodafinil — n'ont
probablement pas de source primaire accessible. Leur fiche sera créée avec son
bandeau, sa `maturite_clinique` renseignée, et sa demi-vie **« inconnue »**.
C'est le comportement voulu, pas un pis-aller : une valeur inventée coûterait
plus cher qu'une case vide.

---

## Lot 3 — Musculation (★ bloque les niveaux de preuve des méthodes)

Les programmes, les volumes et les séances se construisent sans. Ce qui est
bloqué, c'est le **niveau de preuve** affiché à côté de chaque méthode — et une
méthode présentée comme établie alors qu'elle ne l'est pas est exactement ce
que ce projet s'interdit.

| | Référence | Ce qu'elle justifie |
|---|---|---|
| 3.1 ★ | **Schoenfeld, Ogborn, Krieger, 2016** — méta-analyse, relation volume / hypertrophie | les fourchettes de séries directes par semaine et par muscle |
| 3.2 ★ | **Robinson et coll.**, *Sports Medicine*, 2024 — méta-régression | la proximité de l'échec |
| 3.3 · | **Krzysztofik et coll.**, 2019, PubMed `31817252` — revue systématique | les techniques d'intensification |
| 3.4 · | **Pelland et coll.**, SportRxiv v2, 4 octobre 2024 — préprint | volume et fréquence — **à signaler comme non évalué par les pairs** |
| 3.5 · | **Bhasin et coll.**, 2018, Endocrine Society | repères de suivi sous testostérone |
| 3.6 · | **Lally et coll.**, 2010, *Eur J Soc Psychol* | variabilité de la formation d'habitude — je ne la connais que par commentaires secondaires |

Texte intégral pour chacune. Les hôtes refusés sont `pubmed.ncbi.nlm.nih.gov`,
`doi.org`, `link.springer.com` et `academic.oup.com`.

---

## Lot 4 — Les deux sources de la veille (· aucune urgence)

Ton prompt sur la veille du rythme de vie citait deux travaux : une **revue
systématique de 2024** reliant sommeil court, sédentarité et usage accru du
téléphone à des symptômes de stress et d'anxiété, et une **étude d'actigraphie
de 2026** sur l'irrégularité du coucher. Je ne les ai pas lues, et le plan le
dit à trois endroits.

Je ne te les demande pas vraiment : la conception n'en dépend pas, puisqu'elle
ne compare qu'à ta propre ligne de base. Mais si elles te tombent sous la main,
elles me permettraient de remplacer « revue 2024 » par une référence exacte
dans les vingt-trois justifications du catalogue, et d'écrire dans
« Pourquoi ce repère » autre chose qu'une paraphrase de ta lecture.

**Il me faudrait leur identification** — titre, auteurs, revue, DOI — avant le
texte : je ne sais pas aujourd'hui de quels travaux il s'agit.

---

## Une décision qui t'attend, et qui ne demande aucune source

Elle est posée en section 14.5 du relevé des échelles, et elle est importante.

Le manuel d'instructions du PHQ-9 et du GAD-7 dit, mot pour mot, que **peu des
traductions ont été validées psychométriquement** contre un entretien
psychiatrique structuré. Les seuils — 0-4, 5-9, 10-14, 15-19, 20-27 — sont
établis sur les versions **anglaises**. Rien n'établit que la traduction
française « France » l'ait été.

Afficher un palier de sévérité calculé sur le texte français en le présentant
comme validé irait donc au-delà de ce que la source autorise. Ce n'est pas une
question de licence — le domaine public n'impose rien — mais d'exactitude.

Trois formulations possibles, de la plus prudente à la plus informative :

1. **Score brut seul**, sans palier. Le plus défendable, le moins utile.
2. **Score et palier, avec mention** que les paliers proviennent de la
   validation anglaise et que la traduction française n'a pas été validée.
3. **Score et palier sans mention.** À écarter.

Mon avis, puisque tu me le demanderas : la **2**. Un palier non accompagné de
sa réserve se retient comme un verdict ; accompagné, il reste ce qu'il est — un
repère emprunté à une autre langue. Et l'application dit déjà « à examiner,
jamais à croire » partout ailleurs.
