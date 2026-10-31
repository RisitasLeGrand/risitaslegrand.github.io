# Les programmes officiels des concours DGFiP

**Établi le 17 octobre 2026.** Toutes les épreuves, durées, coefficients et
matières ci-dessous sont **lus dans les arrêtés**, dans leur version en vigueur
au 14 octobre 2026. Aucun n'est déduit, aucun n'est supposé. Quand une source
n'est pas l'arrêté lui-même, elle est nommée à la ligne.

Ce document ne contient aucun contenu de fiche : il est commitable.

---

## 1. D'où viennent ces informations, et ce que chaque source vaut

| Source | Ce qu'elle est | Date de la version lue |
|---|---|---|
| `sources/officiels/A1-arrete-2011-05-19-controleur-consolide.pdf` | impression Légifrance de la version consolidée de l'arrêté du 19 mai 2011 (NOR BCRE1106036A, JORF n° 0126 du 31 mai 2011) | « EN VIGUEUR AU 14/10/2026 », données mises à jour au 1er janvier 2026 |
| `sources/collecte-…/collecte-03/A11-arrete-2011-03-02-concours-ifip-consolide-reconstitue.pdf` | **reconstitution** de l'arrêté du 2 mars 2011 (NOR BCRE1030476A, JORFTEXT000023662281) à partir des données ouvertes DILA (base LEGI, licence ouverte v2.0) — **ce n'est pas la page Légifrance** | version consolidée reconstituée au 14/10/2026 ; dernière modification LEGI : 06/07/2024 |
| `…/collecte-03/A10-arrete-2011-03-02-concours-pro-ipfip-consolide-reconstitue.pdf` | idem, pour le concours professionnel d'IPFiP (NOR BCRE1104996A, JORFTEXT000023662346) | reconstitution au 14/10/2026 ; dernière modification LEGI : 22/12/2025 |
| `…/collecte-03/A10-arrete-2025-09-04-…`, `A10-arrete-2025-12-18-…`, `A10-arrete-2025-09-11-examen-pro-ifip-ipfip-…`, `A10-arrete-2025-09-11-examen-pro-idcn-ipfip-…`, `A11-arrete-2011-03-02-examen-pro-ifip-…` | idem, textes modificatifs et examens professionnels | reconstitutions au 14/10/2026 |
| `…/collecte-04/A7-guide-enfip-cfip-externe-qcm-qrc.pdf` | guide ENFiP « Préparation à l'épreuve de QCM et QRC », concours externe de contrôleur | mars 2025 |
| `…/collecte-04/A7-guide-enfip-ifip-externe-qcm-qrc.pdf` | guide ENFiP équivalent, concours externe d'inspecteur | non daté en page de garde ; annonce le concours « millésime 2026 » |

**Contrôle d'intégrité exécuté et constaté.** `sha256sum -c MANIFEST-SHA256.txt`
dans les sept archives utilisées (`collecte-03` à `collecte-09`) : 279 empreintes
vérifiées (174 + 5 + 21 + 13 + 10 + 42 + 14), **zéro écart**.

**Limite à connaître, et qui ne se contourne pas.** Les PDF Légifrance de
`sources/officiels/` (A1, A2, A3, A4, B1, B4-…) sont des impressions dont le
texte est tracé en **contours vectoriels** : aucun outil d'extraction ne peut
en tirer une chaîne de caractères. Ils ont donc été lus **par rendu d'image**
(`pdftoppm`, installé pour l'occasion), page par page. Les textes de la collecte
du pilote, eux, sont des reconstitutions DILA : leur texte est extractible,
mais ce ne sont **pas** les pages Légifrance, et le document le dit lui-même en
en-tête de chaque page. Quand les deux existaient pour le même texte (arrêté
inspecteur : A3 et A11), ils portent le même JORFTEXT.

---

## 2. DGFiP B — contrôleur des finances publiques de 2e classe

**Arrêté du 19 mai 2011** fixant les règles d'organisation générale, la nature
et le programme des épreuves des concours pour l'accès au grade de contrôleur
des finances publiques de 2e classe. NOR : BCRE1106036A. JORF n° 0126 du
31 mai 2011.

**Version en vigueur** : celle issue de l'**arrêté du 1er juillet 2024**
(NOR : ECOE2416020A), articles 1 à 4 — mention Légifrance « version en vigueur
depuis le 01/01/2026 ». Une note répétée à chaque article précise que ces
dispositions « entrent en vigueur à la date de publication de l'arrêté
d'ouverture du concours externe pour l'accès au grade de contrôleur des
finances publiques de 2e classe au titre de l'année 2026 ».

L'arrêté régit **trois voies** : externe, interne, et interne spécial.

### 2.1 Concours externe

| Épreuve | Durée | Coefficient |
|---|---|---|
| Admissibilité n° 1 — réponses à des questions à partir d'un dossier documentaire | 3 heures | 4 |
| Admissibilité n° 2 — QCM puis QRC | 2 heures | 2 |
| Admission — entretien avec le jury | 25 minutes | 6 |

**Épreuve n° 1.** « Répondre à des questions, à partir d'un dossier
documentaire, sur un sujet contemporain en matière sociale, économique ou
financière. L'une des questions conduira le candidat à présenter un avis
argumenté. » Dossier documentaire limité à **vingt pages**.

**Épreuve n° 2, première partie — le QCM.** Quatre thèmes, et quatre seulement :

1. Connaissances générales (histoire, géographie, institutions françaises,
   Union européenne et culture numérique) ;
2. Français ;
3. Mathématiques ;
4. Raisonnement logique.

**Épreuve n° 2, seconde partie — le QRC**, sur **une** matière choisie par le
candidat à l'inscription, parmi cinq : sciences économiques et sociales ;
comptabilité et analyse financière ; droit ; mathématiques ; histoire,
géographie, géopolitique.

**Épreuve orale.** Présentation du parcours (cinq minutes au plus), échanges sur
les aptitudes et les motivations, puis **mises en situation** destinées à
évaluer le savoir-être.

**Ce que le guide ENFiP ajoute** (mars 2025, concours externe rénové, millésime
2026) : « environ **30 QCM** communes à toutes les options et **3 à 4 QRC**
selon l'option choisie » ; « toute note inférieure à **5 sur 20 est
éliminatoire** », la note étant examinée au regard de l'ensemble QCM + QRC.
Le guide ne donne pas le barème de l'erreur ; il ne figure pas non plus dans
l'arrêté. **Non trouvé à ce jour** — voir § 6.

### 2.2 Programme du QCM, tel qu'il figure à l'annexe

**I. Connaissances générales**
- A. Les grandes dates et faits marquants de l'histoire de France.
- B. Géographie de la France.
- C. Les institutions françaises : la Constitution ; le président de la
  République ; le gouvernement ; le Parlement ; le Conseil constitutionnel ; le
  Conseil d'État ; le Conseil économique, social et environnemental.
- D. L'Union européenne : le Parlement européen ; le Conseil de l'Union
  européenne ; le Conseil européen ; la Commission européenne ; la Cour de
  justice de l'Union européenne ; la Banque centrale européenne ; la Cour des
  comptes européenne ; les grandes étapes de la construction européenne et les
  différents élargissements (les traités et les États membres).
- E. Culture numérique : information et données ; communication et
  collaboration ; créations de contenus ; protection et sécurité.

**II. Français** : A. Grammaire — B. Orthographe — C. Vocabulaire.

**III. Mathématiques** : A. Manipulation des nombres (entiers, rationnels,
racines carrées, nombre pi ; opérations et priorités ; multiples et diviseurs ;
nombres premiers, PGCD, PPCM ; division euclidienne ; critères de divisibilité ;
valeur décimale et approchée d'une fraction ; puissances d'exposant entier
relatif ; notation scientifique ; racine carrée d'un produit, d'un quotient ;
proportionnalité ; moyennes, pourcentages, taux, intérêts simples ; prix
d'achat, de vente, de revient ; bénéfice, perte ; calculs et conversions des
masses, densité, masse volumique) — B. Algèbre (calcul littéral ; identités
remarquables ; monômes et polynômes ; factorisation et développement ;
équations et inéquations du premier degré à une inconnue et coefficients
réels ; systèmes de deux équations à deux inconnues ; problèmes du premier
degré à une ou deux inconnues).

**IV. Raisonnement logique** : « ensemble de questions destinées à évaluer les
capacités du candidat à analyser des données et à conduire un raisonnement
déductif ».

### 2.3 Programme du QRC du concours externe (les cinq options)

- **Sciences économiques et sociales** — A. Techniques quantitatives
  élémentaires (taux de croissance, coefficient multiplicateur, indices,
  élasticités, propensions, valeur/volume, nominal/réel, moyenne, médiane,
  dispersion, représentations graphiques, coefficient de Gini). B. Accumulation
  du capital, organisation du travail et croissance économique. C. Les enjeux
  de l'ouverture internationale (internationalisation des échanges et
  mondialisation ; intégration européenne et politiques économiques et
  sociales).
- **Comptabilité et analyse financière** — A. Traduire l'activité de
  l'entreprise. B. Synthétiser fidèlement l'image de l'entreprise. C. Une
  entreprise performante (EBE, RE, RCAI, CAF ; rentabilité économique et
  financière, effet de levier sans le calculer ; affectation du résultat).
  D. L'équilibre de la structure financière (ratios, FR, BFR, trésorerie).
  E. L'analyse des coûts (seuil de rentabilité, point mort).
- **Droit** — A. Définition du droit. B. Droit et règlement des litiges.
  C. Faire valoir ses droits. D. Les droits reconnus aux personnes (dont
  « intelligence artificielle et justice »). E. La responsabilité juridique.
  F. Le contrat de travail.
- **Mathématiques** — A. Arithmétique. B. Algèbre. C. Fonctions numériques.
  D. Statistiques et probabilités (dont loi de Bernoulli, loi binomiale,
  espérance). E. Suites numériques.
- **Histoire, géographie et géopolitique** — A. Histoire contemporaine en France
  et en Europe (1789 à la fin du XXe siècle). B. Géographie économique et
  humaine (la France métropole et outre-mer ; réseaux et flux en Europe et en
  France ; la mondialisation).

### 2.4 Concours interne

| Épreuve | Durée | Coefficient |
|---|---|---|
| Admissibilité n° 1 — réponses à des questions et/ou cas pratique à partir d'un dossier de documents administratifs (≤ 20 pages) | 3 heures | 4 |
| Admissibilité n° 2 — une option parmi dix | 2 heures | 3 |
| Admission — entretien avec le jury | 25 minutes | 6 |

Les **dix options** de l'épreuve n° 2, dans l'ordre de l'arrêté :

1. Fiscalité personnelle ;
2. Fiscalité professionnelle ;
3. Enregistrement, publicité foncière et fiscalité patrimoniale ;
4. Cadastre ;
5. Comptabilité privée ;
6. Recouvrement de l'impôt et des autres produits de l'État ;
7. Gestion financière et comptable de l'État ;
8. Gestion financière et comptable des collectivités locales ;
9. Missions domaniales ;
10. Budget, immobilier, gestion des ressources humaines, logistique et
    **organisation de la DGFiP**.

L'oral consiste en un entretien de reconnaissance des acquis de l'expérience
professionnelle : exposé d'environ cinq minutes, puis échange « sur sa
connaissance de l'environnement de la direction générale de finances
publiques » et mises en situation. Un dossier de présentation du parcours est
fourni en amont.

### 2.5 Concours interne spécial

| Épreuve | Durée | Coefficient |
|---|---|---|
| Admissibilité — une option parmi trois | 2 h 30 | 6 |
| Admission — entretien avec le jury | 25 minutes | 4 |

Les trois options : a) les missions fiscales ; b) les missions gestion
publique ; c) les missions transverses. « Les candidats doivent répondre à des
questions et/ou résoudre des cas pratiques, à partir d'une analyse de dossier,
constitué de différents documents. »

### 2.6 Ce que contient l'option 10 — et pourquoi elle compte ici

L'annexe détaille cette option en trois parties : I. Gestion des ressources
humaines (règles générales de la fonction publique, modalités de gestion à la
DGFiP, recrutement et formation) ; II. Gestion budgétaire, immobilière et
logistique (BOP et UO, achats et marchés publics, opérations immobilières,
informatique de proximité) ; III. **Organisation de la DGFiP** :

> « Organisation et missions de l'administration centrale. Les directions et
> services à compétence nationale ou spéciale. Rôle et missions des délégués du
> directeur général. Organisation du réseau déconcentré de la DGFiP au niveau
> régional, départemental et infradépartemental. »

C'est le fondement, au programme et daté, du chantier « organigramme » : quatre
lignes d'arrêté qui commandent une fiche entière.

---

## 3. DGFiP A — inspecteur des finances publiques

**Arrêté du 2 mars 2011** fixant les règles d'organisation générale, la nature
et le programme des épreuves des concours pour l'accès au grade d'inspecteur
des finances publiques. NOR : BCRE1030476A. JORF n° 0055 du 6 mars 2011.
LEGITEXT000023663625 / JORFTEXT000023662281.

**Version en vigueur** : celle issue de l'**arrêté du 1er juillet 2024**
(NOR : ECOE2416012A) — articles 1 à 4 « en vigueur depuis le 06/07/2024 », avec
la même note d'entrée en vigueur liée à l'arrêté d'ouverture du concours externe
2026.

### 3.1 Concours externe

| Épreuve | Durée | Coefficient |
|---|---|---|
| Admissibilité n° 1 — note de synthèse + question appelant une proposition ou un avis argumenté (dossier ≤ 25 pages) | 4 heures | 5 |
| Admissibilité n° 2 — QCM puis QRC | 2 h 30 | 3 |
| Admission — entretien avec le jury | 35 minutes | 8 |

**QCM — cinq thèmes** : 1° environnement administratif, économique et
financier ; 2° Union européenne ; 3° culture numérique ; 4° raisonnement
logique ; 5° anglais.

**QRC — une matière au choix parmi neuf** : droit public ; droit privé ;
finances publiques ; mathématiques, statistiques et probabilités ;
« compatibilité » et analyse financière *(orthographe du texte publié : il faut
lire comptabilité — la coquille figure telle quelle dans la version consolidée
et dans le guide ENFiP)* ; analyse économique ; sciences politiques ;
littérature ; histoire et géographie.

L'oral prévoit expressément que « les titulaires d'un doctorat peuvent présenter
leur parcours et leurs travaux » au titre de l'article L. 412-1 du code de la
recherche.

**Ce que le guide ENFiP ajoute** : « L'arrêté du 1er juillet 2024 ne précise pas
le nombre de questions […] mais ceux-ci devraient comporter environ **40 QCM**
communes à toutes les options et **3 à 4 QRC** ». Quatre propositions par
question, **une seule réponse autorisée** ; toute réponse multiple est
« assimilée à une réponse inexacte » ; « une réponse fausse est sanctionnée de
façon négative » ; l'abstention se marque en cochant « Ann » ou rien. Note
inférieure à 5/20 éliminatoire. Le guide conseille deux minutes par question au
plus, soit 1 h 20 pour le QCM.

### 3.2 Programme du QCM (annexe)

**I. Environnement administratif, économique et financier**
- A. Les institutions françaises : la Constitution, la hiérarchie des normes ;
  le Conseil constitutionnel ; le pouvoir exécutif, législatif et judiciaire.
- B. Les institutions administratives : 1° l'organisation administrative de la
  France (administration centrale ; autorités indépendantes et organes centraux
  de conseil et de contrôle ; administration territoriale de l'État et
  déconcentration ; juridictions administratives ; la réforme de l'État depuis
  20 ans ; droits et obligations des fonctionnaires) ; 2° les collectivités
  territoriales (libre administration et décentralisation ; formes de
  collectivités et de coopération intercommunale ; contrôles ; la réforme des
  collectivités territoriales depuis 2014 ; élus locaux et élections locales).
- C. Le budget de l'État : 1° les lois de finances (catégories ; LOLF du
  1er août 2001 ; loi de finances et loi de programmation ; contenu et
  structure ; exécution et contrôle) ; 2° ressources et dépenses (ressources
  fiscales, ressources d'emprunt, autres ressources ; architecture budgétaire
  par missions et programmes) ; 3° principes et gestion budgétaire (principes
  budgétaires, déficit, emprunt, dette).

**II. L'Union européenne** : A. grandes étapes et élargissements (traités, États
membres) ; B. aspects institutionnels et financiers (adhésion et retrait ;
composition et attributions des institutions ; processus décisionnels et rôle
des parlements nationaux ; principes du budget de l'Union et contribution des
États) ; C. les principales politiques (libertés de circulation, PAC, politique
régionale, politique commerciale commune, politique économique et monétaire,
PESC, politique sociale) ; D. la protection des droits fondamentaux (valeurs de
l'Union et leur protection ; Charte des droits fondamentaux et CJUE ; CEDH et
Cour européenne des droits de l'homme).

**III. Culture numérique** : A. le socle de compétence numérique (information et
données ; communication et collaboration ; créations de contenus ; protection et
sécurité) ; B. enjeux et politiques de l'administration numérique (services en
ligne, open data, big data, cloud, intelligence artificielle ; politiques
publiques du numérique ; dématérialisation des rapports entre le public et
l'administration) ; C. la réglementation (RGPD, loi informatique et libertés).

**IV. Raisonnement et logique** : analyse de données et raisonnement déductif.

**V. Anglais** : « anglais du niveau **B1** du cadre européen de référence pour
les langues (CECRL) » — orthographe, grammaire, conjugaison, vocabulaire.

### 3.3 Programme du QRC — les neuf matières (titres de l'annexe)

- **Droit public** — A. droit constitutionnel et administratif (théorie générale,
  régime de 1958, sources du droit administratif, organisation administrative,
  collectivités territoriales, missions et action de l'administration, justice
  administrative) ; B. organisation, fonctionnement et politiques des
  institutions européennes (l'Union et ses institutions, le droit de l'Union, le
  système judiciaire de l'Union).
- **Droit privé** — A. droit civil (personnes, famille, droits réels
  principaux, obligations) ; B. procédure civile ; C. droit des affaires
  (activité commerciale, entreprise commerciale, difficultés de l'entreprise).
- **Finances publiques** — A. les finances de l'État (influence de l'Union dans
  le pilotage global, lois de finances et budget, ressources, dépenses,
  organisation comptable, responsabilité des gestionnaires publics et
  contrôles) ; B. les finances locales (organisation administrative financière
  et comptable, budget, ressources, dépenses, contrôle).
- **Mathématiques, statistiques et probabilités** — A. mathématiques (séries
  numériques et séries de fonctions ; fonctions et calcul différentiel ;
  structures algébriques, polynômes et fractions rationnelles ; calcul
  matriciel, algèbre linéaire et bilinéaire en dimension finie ; géométries) ;
  B. probabilités et statistiques (probabilités ; statistiques descriptives ;
  statistiques inductives).
- **Comptabilité et analyse financière** — A. comptabilité générale ;
  B. comptabilité de gestion ; C. analyse financière.
- **Analyse économique** — A. les grands courants de l'analyse économique ;
  B. microéconomie ; C. macroéconomie (notions introductives, grandes fonctions,
  marché du travail, équilibre IS-LM en économie ouverte et fermée, politiques
  macroéconomiques) ; D. monnaie et finance ; E. économie internationale
  (mondialisation économique, mondialisation financière).
- **Sciences politiques** — A à H : le politique et la science politique ;
  institutions et régimes politiques ; comportements électoraux ; action
  publique ; action collective ; clivages et organisations politiques ; médias
  et politique ; professionnalisation de la politique et de la vie publique.
- **Littérature** — A à H : poésie du XVIIe siècle à nos jours ; littérature
  romantique ; écriture du moi ; amours contrariées dans la tragédie, la comédie
  et le drame ; roman historique ; littérature engagée ; surréalisme ; roman
  d'aventure.
- **Histoire et géographie** — A. histoire contemporaine mondiale
  (1789 à la fin du XXe siècle) ; B. géographie économique et humaine (la
  France ; réseaux et flux en Europe et en France ; l'Europe des États ;
  mondialisation et interdépendances).

### 3.4 Concours interne

| Épreuve | Durée | Coefficient |
|---|---|---|
| Admissibilité n° 1 — note de synthèse sur un dossier relatif aux questions économiques et financières (≤ 25 pages) | 4 heures | 7 |
| Admissibilité n° 2 — une option parmi cinq | 3 heures | 5 |
| Admissibilité n° 3 — **facultative** : traduction sans dictionnaire (allemand, anglais, espagnol ou italien) | 1 h 30 | 1 |
| Admission — entretien avec le jury | 30 minutes | 9 |

Les **cinq options** : 1. fiscalité professionnelle ; 2. fiscalité personnelle
et patrimoniale ; 3. gestion publique ; 4. gestion comptable et analyse
financière ; 5. **budget, immobilier, gestion des ressources humaines,
logistique et organisation de la DGFiP**.

Pour l'épreuve facultative, « seuls sont pris en compte les points obtenus
au-dessus de 10 sur 20 » (article 3).

La partie III de l'option 5 reprend mot pour mot, à la graphie près, les quatre
lignes de l'option 10 du concours de contrôleur citées au § 2.6.

### 3.5 Examen professionnel d'accès au grade d'inspecteur

**Arrêté du 2 mars 2011** (examen professionnel prévu à l'article 5 du décret
n° 2010-986), article 1 en vigueur depuis le **22 mai 2015** (modifié par
l'arrêté du 15 mai 2015, applicable à compter de l'examen 2016).

| Épreuve | Durée | Coefficient |
|---|---|---|
| Admissibilité — étude d'un dossier, une option parmi sept | 4 heures | 6 |
| Admission — reconnaissance des acquis de l'expérience professionnelle (RAEP) | 30 minutes | 5 |

Les **sept sujets au choix** : métiers de la gestion publique État ; métiers de
la gestion publique – secteur public local ; métiers de la fiscalité
professionnelle ; métiers de la fiscalité personnelle ; métiers transversaux ;
métiers du cadastre ; métiers des hypothèques.

---

## 4. DGFiP A+ — inspecteur principal des finances publiques

Trois voies distinctes, et elles ne se confondent pas.

### 4.1 Le concours professionnel

**Arrêté du 2 mars 2011** fixant les modalités d'organisation des épreuves du
concours professionnel pour l'accès au grade d'inspecteur principal des finances
publiques. NOR : BCRE1104996A. JORF n° 0055 du 6 mars 2011.
LEGITEXT000023663675 / JORFTEXT000023662346.

**Version en vigueur de l'article 1 : depuis le 22 décembre 2025**, issue de
l'arrêté du 18 décembre 2025 (NOR : CPPE2527998A), lui-même postérieur à
l'arrêté du 4 septembre 2025 (NOR : ECOE2524347A).

| Épreuve | Durée | Coefficient |
|---|---|---|
| Admissibilité n° 1 — note administrative à partir d'un dossier (≤ 30 pages) | 5 heures | 6 |
| Admissibilité n° 2 — épreuve professionnelle (15 points) + analyse financière commune (5 points) | 4 heures | 6 |
| Admission — entretien avec le jury | 40 minutes | 8 |

**Épreuve n° 1** : « sur un sujet relatif à l'environnement administratif,
économique, financier et social de la direction générale des finances publiques
(DGFiP), ainsi qu'aux politiques publiques dans lesquelles la DGFiP intervient,
et pouvant déboucher sur la formulation d'un avis et/ou d'une proposition en
lien avec ce sujet ».

**Épreuve n° 2, première partie** — « réponses à des questions relatives à
l'exercice des métiers de la DGFiP, à partir d'un dossier et/ou de cas
pratiques », au choix du candidat, sur : la fiscalité professionnelle ; la
fiscalité personnelle et patrimoniale ; la gestion comptable et l'analyse
financière ; la gestion publique (État et collectivités locales) ; **la gestion
des ressources et l'organisation de la DGFiP** ; les systèmes d'information.
Notée **15 points sur 20**.

**Épreuve n° 2, seconde partie** — commune à tous les candidats : à partir d'un
fonds documentaire, répondre à une ou plusieurs questions relatives à l'analyse
financière. Notée **5 points sur 20**.

> **Une anomalie de mise en page du texte consolidé, signalée et non corrigée.**
> La phrase « L'épreuve se décompose en deux parties distinctes » apparaît, dans
> la version reconstituée, **à la fin de l'épreuve n° 1** et avant l'intitulé de
> l'épreuve n° 2, alors que ce sont les deux parties de l'épreuve n° 2 qui
> suivent. Je la restitue ici comme elle est lue, sans la déplacer. À vérifier
> sur la page Légifrance quand elle sera accessible.

**Fait important et daté : il n'y a plus de programme annexé, et pas depuis
2025.** L'**article 3** de l'arrêté — « Le programme de l'épreuve
d'admissibilité n° 2 est fixé en annexe au présent arrêté »
(`LEGIARTI000023663685`) — est **abrogé au 24 juin 2015**, et le programme
quitte l'annexe à la même date. Les trois versions de l'annexe ont été lues :

| Version | En vigueur | Ce qu'elle contient |
|---|---|---|
| `LEGIARTI000023663691` | 7 mars 2011 → 1er novembre 2011 | le programme des options de l'épreuve n° 2, et rien d'autre |
| `LEGIARTI000024518582` | 1er novembre 2011 → 24 juin 2015 | ce programme **et** un modèle de dossier de présentation pour l'épreuve orale d'admission n° 2 |
| `LEGIARTI000030768328` | 24 juin 2015 → 6 septembre 2025, `ABROGE` | **ce modèle seul** — 2 827 caractères, aucune option, aucune notion |

L'**article 2 de l'arrêté du 4 septembre 2025** « a abrogé les dispositions suivantes :
arrêté du 2 mars 2011, art. Annexe », avec effet au **6 septembre 2025**. Ce qu'il a abrogé est donc la troisième version : **un modèle de fiche
de présentation**, que le même arrêté rendait sans objet le même jour en
fusionnant les deux oraux en un seul. Pas un programme.

Les options de l'article 1 sont donc la seule délimitation en vigueur, et elles
le sont depuis **près de onze ans**, non depuis sept semaines. La date compte
pour la préparation : chercher « le programme de l'IPFiP » n'aboutit pas à un
texte récemment abrogé, mais à rien — et un support de l'an dernier n'en
contenait pas davantage.

**Et l'épreuve n° 1 n'a jamais eu de programme.** L'article 3 abrogé ne
renvoyait à l'annexe que le programme de l'épreuve **n° 2**. La note
administrative n'a eu, dans aucune version, d'autre délimitation que sa propre
phrase de l'article 1er.

### 4.2 L'examen professionnel ouvert aux inspecteurs (IFiP → IPFiP)

**Arrêté du 11 septembre 2025**, pris pour l'article 18 du décret n° 2010-986.
Articles en vigueur depuis le **1er octobre 2025**, et applicables « à la date
de publication de l'arrêté autorisant l'ouverture de l'examen professionnel au
titre de l'année 2026 ». Il **abroge l'arrêté du 19 mai 2011**
(LEGITEXT000024098455).

Deux temps, et un seul noté :
1. une **phase de présélection** sur dossier de reconnaissance des acquis de
   l'expérience professionnelle, à l'issue de laquelle le jury arrête par ordre
   alphabétique la liste des candidats admis à l'oral ;
2. une **épreuve orale d'admission de quarante minutes**, ouverte par un exposé
   de dix minutes au plus sur le parcours. « Seul l'entretien avec le jury donne
   lieu à la notation. Le dossier de reconnaissance des acquis de l'expérience
   professionnelle n'est pas noté. » Note de 0 à 20.

**Aucune épreuve écrite. Aucun programme de connaissances.** C'est une rupture
nette avec l'ancien régime, et elle est récente.

### 4.3 L'examen professionnel ouvert aux inspecteurs départementaux à compétence nationale (IDCN → IPFiP)

**Arrêté du 11 septembre 2025**, pris pour l'article 19 du même décret, en
vigueur depuis le 1er octobre 2025, abrogeant lui aussi un arrêté du 19 mai 2011
(LEGITEXT000024098118). Le dispositif est **identique** à celui du § 4.2 :
présélection sur dossier, puis oral de quarante minutes seul noté.

---

## 5. Les écarts entre `registre.ts` et le programme officiel

`src/lib/parcours/registre.ts` a été **lu, et non modifié**. Il déclare pour
`dgfip-b` huit thèmes de planification, avec un référentiel d'origine
`annales` — ce que son commentaire assume explicitement : « ces huit thèmes ne
sont pas un programme officiel : ce sont les huit rubriques de la banque
"QCM - DGFiP" ». Voici ce que la confrontation au programme officiel donne.

### 5.1 Thème par thème

| Thème déclaré (`THEMES_DGFIP_B`) | Statut au regard de l'arrêté du 19 mai 2011 |
|---|---|
| `culture-generale` — Culture générale | **À renommer.** L'arrêté dit « connaissances générales », et ce bloc englobe histoire, géographie, institutions françaises, Union européenne **et** culture numérique. « Culture générale » laisse croire à une épreuve de dissertation ; ce n'est pas l'intitulé officiel. |
| `maths` — Mathématiques | **Conforme.** Thème 3° du QCM ; également l'une des cinq options de QRC. |
| `francais` — Français | **Conforme.** Thème 2° du QCM. |
| `logique` — Logique | **Conforme au fond, à renommer.** L'arrêté dit « raisonnement logique ». |
| `environnement-administratif` — Environnement administratif | **Hors programme du concours de contrôleur.** « Environnement administratif, économique et financier » est le thème 1° du QCM du concours **d'inspecteur** (catégorie A), pas de contrôleur. |
| `culture-numerique` — Culture numérique | **Sous-ensemble, pas thème.** Au concours de contrôleur, c'est la partie **E** des connaissances générales. C'est en revanche un thème à part entière chez l'inspecteur. |
| `union-europeenne` — Union européenne | **Sous-ensemble, pas thème.** Partie **D** des connaissances générales chez le contrôleur ; thème à part entière chez l'inspecteur. |
| `anglais` — Anglais | **Hors programme du concours de contrôleur.** L'anglais est le thème 5° du QCM d'inspecteur. Le registre note lui-même que la banque n'en porte que cinq questions. |

### 5.2 Ce que le programme comporte et que le registre n'a pas

- **L'épreuve n° 1** (analyse de dossier, coefficient 4 à l'externe comme à
  l'interne) n'a **aucun thème**. C'est pourtant le coefficient le plus lourd
  de l'admissibilité externe, à égalité avec rien d'autre.
- **Les cinq options de QRC du concours externe** : sciences économiques et
  sociales ; comptabilité et analyse financière ; droit ; mathématiques ;
  histoire, géographie, géopolitique. Seules les mathématiques ont un thème.
- **Les dix options de l'épreuve n° 2 du concours interne** — dont la fiscalité
  personnelle, la fiscalité professionnelle, le recouvrement, la gestion
  financière et comptable de l'État et des collectivités locales, le domaine, le
  cadastre, et l'**organisation de la DGFiP**. Aucune n'a de thème.
- **L'oral, coefficient 6** — le plus fort coefficient des trois voies — qui
  porte notamment sur « la connaissance de l'environnement de la DGFiP ».

### 5.3 De quoi renseigner `registre.ts` — proposition, à trancher par le propriétaire du code

La difficulté est que le parcours « DGFiP B » recouvre **trois voies** dont les
épreuves n° 2 n'ont rien de commun. Deux façons de la traiter, et je ne tranche
pas :

**Option 1 — thèmes du tronc commun seulement** (sept thèmes, un par jour) :

| id proposé | nom | court | matières de contenu |
|---|---|---|---|
| `connaissances-generales` | Connaissances générales | Conn. gén. | Connaissances générales |
| `francais` | Français | Français | Français |
| `maths` | Mathématiques | Maths | Maths |
| `raisonnement-logique` | Raisonnement logique | Raisonnement | Logique |
| `analyse-de-dossier` | Analyse de dossier | Dossier | Analyse de dossier |
| `option-qrc` | Matière d'option (QRC) | Option | SES, Comptabilité, Droit, Histoire-géo |
| `environnement-dgfip` | Environnement et organisation de la DGFiP | Env. DGFiP | Organisation de la DGFiP |

Le dernier thème n'est pas au programme du QCM, mais il est à celui de l'oral
(coefficient 6) et de l'option 10 de l'interne : il mérite un créneau.

**Option 2 — conserver les huit rubriques de la banque**, et se contenter de
corriger les intitulés (`culture-generale` → « Connaissances générales »,
`logique` → « Raisonnement logique »), en assumant que `environnement-administratif`
et `anglais` servent au parcours **DGFiP A** et non au B. Cela suppose que la
banque QCM soit un jour filtrée par parcours, ce qu'elle n'est pas aujourd'hui.

**Pour `dgfip-a`**, le référentiel peut passer de `a-etablir` à `officiel` dès à
présent, sur la base de l'arrêté du 2 mars 2011 version en vigueur au
14/10/2026 : les cinq thèmes du QCM (environnement administratif économique et
financier ; Union européenne ; culture numérique ; raisonnement logique ;
anglais) sont directement des thèmes de planification, et les neuf matières de
QRC en font un dixième, « matière d'option ».

**Pour `dgfip-ap`**, le référentiel peut passer à `officiel` **sans thèmes de
connaissances** : l'arrêté ne fixe plus de programme depuis le 6 septembre 2025
(§ 4.1), et les deux examens professionnels n'ont qu'un oral. Les thèmes
utiles seraient les six options de l'épreuve n° 2 du concours professionnel plus
l'analyse financière commune — c'est-à-dire des **métiers**, pas des matières
académiques. `themes: []` reste défendable ici, et pour une raison qui se dit :
ce n'est pas un programme manquant, c'est un programme abrogé.

---

## 6. Ce qui n'a pas été trouvé

| Ce qui manque | Pourquoi je le dis |
|---|---|
| Le **barème de l'erreur** au QCM (points retirés pour une réponse fausse) | Ni l'arrêté du 19 mai 2011, ni celui du 2 mars 2011, ni les deux guides ENFiP lus ne le chiffrent. Le guide inspecteur dit seulement « sanctionnée de façon négative ». Le README du projet annonce « +1 / −0,5 / 0 » pour l'épreuve blanche : **cette règle n'est appuyée par aucune des sources lues ici**. À confirmer sur un sujet réel ou une notice d'ouverture. |
| Le **programme annexé à l'arrêté du 1er juillet 2024** pour le contrôleur, dans sa version publiée au JO | `A2-arrete-2024-07-01-controleur-JO.pdf` est illisible par extraction (texte vectorisé) ; il a été contourné par la lecture de la version **consolidée** A1, qui intègre ces modifications. Le texte publié lui-même n'a pas été relu ligne à ligne. |
| Les **guides ENFiP des concours internes** (contrôleur, inspecteur, IPFiP) | Le tableau de la collecte les porte en « introuvable ». Seuls les guides des concours **externes** ont été récupérés. |
| Les **rapports de jury 2026** du concours de contrôleur (interne et externe) | Tableau de la collecte : « trouvé, non téléchargeable ». |
| Un **corrigé officiel** de QCM, toutes voies confondues | Voir le rapport `contenu-dgfip-2026-10-17.md`, § sur la fiabilisation : les corrigés présents dans `sources/annales-dgfip/` proviennent d'un site banni du projet et n'ont pas été ouverts. |
| La **page Légifrance** de l'arrêté du 19 mai 2011 et des textes d'organisation | Le proxy sortant refuse `legifrance.gouv.fr` (« CONNECT tunnel failed, response 403 »), constat exécuté le 17 octobre 2026. La collecte du pilote faisait le même constat le 14 octobre (défi anti-robot Cloudflare). Rien n'a été contourné. |

---

## 7. Résumé en une table

| | Épreuve 1 | Épreuve 2 | Épreuve 3 | Oral |
|---|---|---|---|---|
| **B externe** | 3 h · coef 4 | 2 h · coef 2 (QCM + QRC) | — | 25 min · coef 6 |
| **B interne** | 3 h · coef 4 | 2 h · coef 3 (10 options) | — | 25 min · coef 6 |
| **B interne spécial** | 2 h 30 · coef 6 (3 options) | — | — | 25 min · coef 4 |
| **A externe** | 4 h · coef 5 | 2 h 30 · coef 3 (QCM + QRC) | — | 35 min · coef 8 |
| **A interne** | 4 h · coef 7 | 3 h · coef 5 (5 options) | 1 h 30 · coef 1 (facultative) | 30 min · coef 9 |
| **A examen pro** | 4 h · coef 6 (7 options) | — | — | 30 min · coef 5 (RAEP) |
| **A+ concours pro** | 5 h · coef 6 | 4 h · coef 6 (6 options + analyse financière) | — | 40 min · coef 8 |
| **A+ examen pro (IFiP)** | présélection sur dossier, non notée | — | — | 40 min, seule épreuve notée |
| **A+ examen pro (IDCN)** | présélection sur dossier, non notée | — | — | 40 min, seule épreuve notée |
