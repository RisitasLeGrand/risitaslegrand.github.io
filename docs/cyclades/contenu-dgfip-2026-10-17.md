# Contenu DGFiP — compte rendu du 17 octobre 2026

Travail de contenu sur les parcours DGFiP et sur l'organigramme de la DGFiP.
Aucun fichier de `content/` n'est commité ; ce document ne reproduit aucun
contenu de fiche.

**Convention d'honnêteté employée partout ci-dessous.**
« **Exécuté et constaté** » = j'ai lancé la commande et lu sa sortie.
« **Lu dans la source** » = j'ai ouvert le document et lu la phrase.
« **Supposé** » = raisonnement de ma part, signalé comme tel.
Quand je n'ai rien, j'écris « non trouvé ».

---

## 1. Ce qui a été produit

### 1.1 Documents, commitables

| Fichier | Nature |
|---|---|
| `docs/cyclades/programmes-dgfip.md` | les programmes officiels des trois concours (B, A, A+), internes et externes, avec les arrêtés, les coefficients, les durées, les programmes par matière, les écarts relevés sur les thèmes actuels de `dgfip-b`, et une proposition de thèmes à trancher par le propriétaire du code |
| `docs/cyclades/contenu-dgfip-2026-10-17.md` | le présent compte rendu |

### 1.2 Contenu, **non commitable**, laissé en place dans `content/`

| Fichier | Contenu |
|---|---|
| `content/dgfip-a/organisation-dgfip/fiche-01-administration-centrale-de-la-dgfip.md` | 10 questions de prétest, cours complet, fiche simplifiée, 20 cartes de révision, 8 questions de quiz dont 8 corrections détaillées (6 avec visuel, 2 avec `type: aucun` motivé) |
| `content/dgfip-a/organisation-dgfip/fiche-02-reseau-deconcentre-et-services-de-proximite.md` | 10 questions de prétest, cours complet, fiche simplifiée, 17 cartes de révision, 8 questions de quiz dont 8 corrections détaillées (6 avec visuel, 2 avec `type: aucun` motivé) |
| `…/fiche-01-….podcast.md`, `…/fiche-02-….podcast.md` | scripts parlés **engendrés** par `npm run podcasts`, jamais écrits à la main |
| `content/glossaire.yml` | **29 termes ajoutés** : DGFiP, DLF, DIE, SJCF, GPLABE, 2FCE, SPiB, DTNum, DRFiP, DDFiP, DIRCOFI, DVNI, DNEF, DNVSF, DGE, DINR, DNID, ENFiP, SRE, SIP, SIE, SGC, SPF, PRS, nouveau réseau de proximité, centre de gestion financière, conseiller aux décideurs locaux, France Services, attaché fiscal |

**Totaux de ce lot** : 2 fiches, 20 questions de prétest, 37 cartes de révision,
16 questions de quiz avec correction détaillée, 16 visuels déclaratifs : 6 schémas
au format `schema`, 6 tableaux, et 4 décisions motivées de n'en mettre aucun, 29 termes de glossaire.

Le schéma demandé au format `schema` de `scripts/lib/visuels.mjs` est présent
**six fois** : trois dans la fiche 1 — le compte des directions et des services
face à l'organigramme publié, le rattachement des trois directions nationales de
contrôle, le périmètre de la direction de l'immobilier de l'État — et trois dans
la fiche 2 — les quatre catégories de services déconcentrés, les deux filières
d'origine du SIP, les conditions de l'article 4 du décret de 2009. Compté par
`grep` sur les deux fichiers : 6 `schema`, 6 `tableau`, 4 `aucun`.

### 1.3 Vérifications — exécutées et constatées

| Commande | Résultat |
|---|---|
| `npm run verifier:pretests` | `✓ aucun problème` — 415/425 fiches avec prétest avant le lot, **417/427 après** |
| `npm run check-content` | `Aucun problème de correction.` Périmètre `dgfip-a` : 16 questions, 16 corrigées, 12 avec visuel, 2 avec `aucun`, 0 en confiance moyenne |
| `npm run podcasts` | les deux `.podcast.md` ont été produits et portent l'en-tête « ne pas modifier à la main ». La commande enchaîne ensuite la **synthèse vocale** des fiches dont l'audio manque : elle tournait encore à l'heure de ce compte rendu, voir § 10 |
| `npm run verifier` | 347 fichiers, 0 erreur, 0 avertissement, 25 indications |
| contrôle YAML du glossaire | 560 entrées, **0 doublon de terme** après correction (voir § 6.3) |

`npm run verifier` (astro check) a été lancé après le lot, bien qu'aucun fichier
de `src/` ni de `scripts/` n'ait été touché : **347 fichiers, 0 erreur,
0 avertissement, 25 indications**. Vert.

**Aucun `npm run build`, aucun `astro build`, aucun `astro preview` n'a été
exécuté.** `dist/` n'a pas été touché.

**Mise à jour après coup : `build-content.mjs` a tourné, et il a accepté les
deux fiches.** Je ne l'ai pas lancé — c'est la tâche qui travaille en parallèle
sur le dépôt qui a exécuté `npm run contenu` à 23 h 53, et j'ai constaté le
résultat sans y toucher : `public/data/fiches/` contient **427 fiches**, soit
les 425 de l'INSP plus les deux de ce lot. Le contrôle du front-matter, de la
structure des sections et du rendu des visuels est donc passé. La réserve que
je portais ici est levée.

**Ce qui reste à faire de votre côté** : un build **sans**
`REVINSP_SANS_PODCAST=1` pour que les deux nouvelles fiches audio soient
réellement synthétisées — voir § 10, l'audio n'a pas été produit.

---

## 2. Les sources lues, avec leurs dates

### 2.1 Contrôle d'intégrité — exécuté et constaté

`sha256sum -c MANIFEST-SHA256.txt` dans les sept archives utilisées de
`sources/collecte-pilote-2026-10-14/documents/` :

| Archive | Empreintes | Écarts |
|---|---:|---|
| `collecte-03-textes-juridiques-B1-A10-A11-structures` | 174 | aucun |
| `collecte-04-concours-A7-A8-A9-partie1sur3` | 5 | aucun |
| `collecte-05-concours-A7-A8-A9-partie2sur3` | 21 | aucun |
| `collecte-06-concours-A7-A8-A9-partie3sur3` | 13 | aucun |
| `collecte-07-B4-organisation-DGFiP-partie1sur3` | 10 | aucun |
| `collecte-08-B4-organisation-DGFiP-partie2sur3` | 42 | aucun |
| `collecte-09-B4-organisation-DGFiP-partie3sur3` | 14 | aucun |
| **Total** | **279** | **zéro** |

`collecte-10-extraits-NON-AUTHENTIQUES` **n'a pas été ouverte** : son contenu
est une piste, jamais une source, et aucun fait de ce compte rendu ni des deux
fiches n'en vient.

### 2.2 Textes juridiques lus

Tous dans leur **version en vigueur au 14 octobre 2026**, telle que la porte le
document consulté.

| Texte | Ce qui en a été lu | Support |
|---|---|---|
| Décret n° 2008-310 du 3 avril 2008 relatif à la DGFiP (NOR BCFP0806742D, JORF n° 0080 du 5 avril 2008) | identité et état du texte | reconstitution DILA, collecte-03 |
| Décret n° 2016-1234 du 19 septembre 2016 (NOR ECFP1610819D, JORF n° 0220 du 21 septembre 2016) | intitulé : modifie le décret de 2008 et **porte création d'une direction de l'immobilier de l'État** | reconstitution DILA, collecte-03 |
| **Arrêté du 20 décembre 2019 portant organisation de la DGFiP** (NOR CPAP1935037A, JORF n° 0301 du 28 décembre 2019) | articles 1 à 14, intégralement | impression Légifrance `sources/officiels/B1-…`, lue **par rendu d'image** |
| **Décret n° 2009-707 du 16 juin 2009 relatif aux services déconcentrés** (NOR BCFP0907314D, JORF n° 0139 du 18 juin 2009) | articles 1 à 6-1 | impression Légifrance `sources/officiels/B4-…`, lue par rendu d'image |
| **Arrêté du 19 mai 2011** (contrôleur, NOR BCRE1106036A, JORF n° 0126 du 31 mai 2011) | les 24 pages, articles et annexe entière | impression Légifrance `sources/officiels/A1-…`, lue par rendu d'image |
| **Arrêté du 2 mars 2011** (inspecteur, NOR BCRE1030476A, JORFTEXT000023662281) | articles 1 à 7 et annexe entière | reconstitution DILA, collecte-03 |
| **Arrêté du 2 mars 2011** (concours professionnel IPFiP, NOR BCRE1104996A) | articles 1 à 6 et historique des versions | reconstitution DILA, collecte-03 |
| Arrêtés des 4 septembre 2025 et 18 décembre 2025 modifiant le concours professionnel IPFiP | intégralement | reconstitutions DILA, collecte-03 |
| Arrêtés du 11 septembre 2025 (examens professionnels IFiP → IPFiP et IDCN → IPFiP) | articles 1 à 7 | reconstitutions DILA, collecte-03 |
| Arrêté du 2 mars 2011 (examen professionnel d'accès au grade d'inspecteur), modifié le 15 mai 2015 | articles 1 à 5 | reconstitution DILA, collecte-03 |
| Arrêtés du 24 juillet 2000 — DNEF (ECOP0000463A), DNVSF (ECOP0000464A), DVNI (ECOP0000465A) | métadonnées et article 1er, version en vigueur depuis le 20/11/2020 | reconstitutions DILA, collecte-03 |
| Arrêté du 16 mars 2012 (DIRCOFI, NOR BCRE1203168A, JORF du 27 mars 2012) | articles 1 et 2 | reconstitution DILA, collecte-03 |
| Arrêté du 9 mars 2009 (création des SIP) | articles 1 et 2 | reconstitution DILA, collecte-03 |
| Arrêté du 20 décembre 2013 (SIP et SIE à Mayotte, NOR BUDE1330752A) | article 1er | reconstitution DILA, collecte-03 |
| Arrêté du 1er juin 2017 (publicité foncière et enregistrement, NOR CPAE1715988A, JORF du 17 juin 2017) | articles 1, 2 et annexe | reconstitution DILA, collecte-03 |
| Arrêté du 13 novembre 2009 (création des PRS, NOR BCFR0925134A, JORF du 24 novembre 2009) | article 1er | reconstitution DILA, collecte-03 |
| Arrêté du 4 août 2010 (création de l'ENFiP, NOR BCRE1019880A, JORF du 1er septembre 2010) | intitulé et métadonnées | reconstitution DILA, collecte-03 |
| Décrets n° 2009-1052 et n° 2009-1053 du 26 août 2009 (SRE, JORF n° 0199 du 29 août 2009) | intitulés et métadonnées | reconstitutions DILA, collecte-03 |
| Décret n° 2013-1225 du 23 décembre 2013 (DGE) ; décret n° 2017-1197 du 26 juillet 2017 (DINR) ; décret n° 2017-1827 du 28 décembre 2017 (DNID) | intitulés et métadonnées | reconstitutions DILA, collecte-03 |
| Arrêté du 5 mars 2010 (DCST, NOR BCFR1004493A) et arrêté du 31 mars 2026 le modifiant | intitulés et métadonnées | reconstitutions DILA, collecte-03 |
| Arrêté du 31 décembre 2012 (DSFiPE, NOR BUDE1240126A) ; arrêté du 11 avril 2011 (DISI, NOR BCRE1108418A) | intitulés et métadonnées | reconstitutions DILA, collecte-03 |
| Arrêté du 23 décembre 2015 portant nouvelle organisation des DRFiP (NOR FCPE1531725A) | intitulé et métadonnées | reconstitution DILA, collecte-03 |
| **Arrêtés des 15 janvier 2026 et 29 juillet 2026** d'ajustement du périmètre des services déconcentrés | articles 1 et 2, tableaux de transfert | reconstitutions DILA, collecte-03 |
| Décret n° 2023-1052 du 17 novembre 2023 (conventions France Services, NOR TFPC2321532D) | article 1er | reconstitution DILA, collecte-03 |
| Arrêté du 16 juin 2025 (référentiel France services, NOR ATDB2503200A, JORF du 1er juillet 2025) | article 1er | reconstitution DILA, collecte-03 |

**Réserve à porter dans toute relecture.** Les documents marqués
« reconstitution DILA » **ne sont pas les pages Légifrance** : ils sont
engendrés à partir des fichiers XML d'origine de la DILA (base LEGI, licence
ouverte v2.0), et chacun le déclare en en-tête de chaque page. Les XML d'origine
sont joints dans les mêmes archives. Lorsqu'un même texte existait sous les deux
formes — l'arrêté inspecteur en `sources/officiels/A3-…` et en reconstitution
`A11-…` —, les identifiants JORFTEXT concordent.

### 2.3 Documents administratifs lus

| Document | Date | Ce qui en a été tiré |
|---|---|---|
| Organigramme des services centraux de la DGFiP (`sources/officiels/B2-…`) | **12 octobre 2026** | la liste des blocs de l'organigramme : direction générale, direction générale adjointe, délégués, mission Risques et Audit, cabinet et communication, RSSI, SRP, délégation aux relations internationales, les huit blocs de rang « service » |
| Guide ENFiP « Préparation à l'épreuve de QCM et QRC », concours externe de contrôleur | mars 2025 | environ 30 QCM et 3 à 4 QRC, coefficient 2, 2 heures, note < 5/20 éliminatoire |
| Guide ENFiP équivalent, concours externe d'inspecteur | non daté, annonce le millésime 2026 | environ 40 QCM et 3 à 4 QRC, coefficient 3, 2 h 30, quatre propositions, une seule réponse, réponse multiple assimilée à une réponse inexacte, abstention par la case « Ann » |
| Sujet officiel, concours externe de contrôleur 2026, épreuve écrite n° 2 | 2026 | l'épreuve QCM **comprend 30 questions** ; « une réponse fausse est pénalisée », sans chiffre |
| Sujet officiel, concours externe d'inspecteur 2026, épreuve écrite n° 2 | 2026 | durée 2 h 30, coefficient 3, « toute note inférieure à 5/20 est éliminatoire » |
| DGFiP, rapport d'activité 2025 (`sources/officiels/B3-…`) | 2025 | les centres de gestion financière : expérimentation commencée en 2021, trois CGF ouverts en 2025 au sein de directions régionales, et les trois modes de traitement de la dépense |
| Organigramme de la DRFiP d'Île-de-France et de Paris | **juillet 2025** | les cinq pôles d'une direction régionale |
| Avis de vacance, pôle gestion publique de la DRFiP des Hauts-de-France et du Nord | 2026 | un directeur de pôle, deux adjoints, six responsables de division, un réseau de **29 conseillers aux décideurs locaux** |
| Avis de vacance, adjoint au pôle pilotage et ressources de la DDFiP de la Haute-Saône | 2026 | la composition d'un pôle pilotage et ressources et ses deux divisions |
| Assemblée nationale, question écrite n° 20639 (15e législature) et réponse | non datée dans le PDF | le nouveau réseau de proximité « initié par le Ministre de l'action et des comptes publics le 6 juin », objectif d'au moins 30 % de points de contact en plus, rôle de la DGFiP dans les espaces France Services |
| Assemblée nationale, question écrite n° 5408 (16e législature) et réponse | non datée dans le PDF | « Depuis 2019 » ; le regroupement en services de gestion comptable |

**Les avis de vacance et les questions écrites décrivent une organisation à une
date donnée, et dans une direction donnée.** Ils sont datés comme tels dans les
fiches, et ils ne priment jamais sur un arrêté. **Aucun nom de personne n'a été
retenu** : l'organigramme du 12 octobre 2026 porte des noms de titulaires dans
presque toutes ses cases ; aucun n'apparaît dans les fiches, dans le glossaire,
ni dans ce document.

---

## 3. L'inventaire des parcours DGFiP (tâche C)

### 3.1 Ce que contient aujourd'hui chaque parcours — compté fichier par fichier

| Parcours | Racine de contenu déclarée | Fiches | Cartes | Quiz | Prétests | Épreuve blanche |
|---|---|---:|---:|---:|---:|---|
| `dgfip-b` — contrôleur | `content/dgfip-b` | **0** (le dossier n'existe pas) | 0 | 0 | 0 | via la banque « QCM — DGFiP », partagée |
| `dgfip-a` — inspecteur | `content/dgfip-a` | **2** (ce lot) | 37 | 16 | 20 | idem |
| `dgfip-ap` — inspecteur principal | `content/dgfip-ap` | **0** (le dossier n'existe pas) | 0 | 0 | 0 | idem |
| Pour mémoire, INSP | racine de `content/` | 425 | — | — | 415 fiches sur 425 | — |

La banque « QCM — DGFiP », elle, est bien pourvue — **540 questions**, comptées
fichier par fichier :

| Rubrique | Questions | Corrections détaillées | `incertain:` |
|---|---:|---:|---:|
| culture-generale | 225 | 10 | 3 |
| maths | 134 | 10 | 1 |
| francais | 82 | 10 | 0 |
| logique | 64 | 10 | 2 |
| culture-numerique | 10 | 10 | 0 |
| environnement-administratif | 10 | 10 | 0 |
| union-europeenne | 10 | 10 | 0 |
| anglais | 5 | 5 | 0 |
| **Total** | **540** | **75** | **6** |

Provenance des 540, dépouillée par lecture des champs `source:` : **290**
viennent d'annales datées, **153** sont de rédaction originale (`RevINSP —
rédaction originale`), **97** viennent des sujets officiels 2026 ou des sujets
test fournis sans corrigé.

### 3.2 Ce qui manque, classé par poids à l'épreuve

Le classement suit les coefficients établis dans `programmes-dgfip.md`. Le
critère est le **produit du coefficient par la part de l'épreuve** que le
contenu couvrirait.

**DGFiP B — contrôleur.**

| Rang | Ce qui manque | Pourquoi ce rang |
|---|---|---|
| 1 | De quoi préparer l'**épreuve n° 1** : analyse d'un dossier documentaire (externe) ou réponses et cas pratique sur dossier administratif (interne) | coefficient **4** à l'externe comme à l'interne, soit le tiers du total d'admissibilité, et **aucune fiche, aucune méthode** n'existe |
| 2 | L'**oral**, coefficient **6** — le plus fort des trois voies —, qui porte notamment sur « la connaissance de l'environnement de la DGFiP » | les deux fiches de ce lot le servent déjà en partie ; il manque le reste : missions, métiers, chiffres, actualité de la direction |
| 3 | Les **cinq options de QRC** de l'externe (SES ; comptabilité et analyse financière ; droit ; mathématiques ; histoire-géographie-géopolitique) | elles portent 3 à 4 questions sur une épreuve de coefficient 2 ; seules les mathématiques ont une rubrique, et uniquement en QCM |
| 4 | Les **dix options de l'épreuve n° 2 de l'interne**, coefficient **3** | aucune n'a de fiche ; l'option 10 (organisation de la DGFiP) est la seule désormais couverte, par les deux fiches de ce lot |
| 5 | Les **trois options de l'interne spécial**, coefficient **6** sur une seule épreuve écrite | missions fiscales, gestion publique, missions transverses : rien |
| 6 | Le **français** et le **raisonnement logique** en fiches de cours | la banque QCM les couvre (82 et 64 questions) ; un cours manque pour comprendre plutôt que reconnaître |

**DGFiP A — inspecteur.**

| Rang | Ce qui manque | Pourquoi ce rang |
|---|---|---|
| 1 | L'**oral**, coefficient **8** à l'externe et **9** à l'interne | le plus fort coefficient de tout le dispositif, et celui qui porte expressément sur l'environnement de la DGFiP |
| 2 | La **note de synthèse**, coefficient **5** à l'externe et **7** à l'interne | aucune méthode, aucun sujet travaillé ; les guides ENFiP de note de synthèse existent dans `sources/officiels/` et n'ont pas encore été exploités |
| 3 | Le thème « **environnement administratif, économique et financier** » du QCM | la rubrique de banque existe mais ne porte que **10 questions** pour un programme de trois grandes parties (institutions françaises, institutions administratives, budget de l'État) |
| 4 | Les thèmes **Union européenne** et **culture numérique** du QCM | 10 questions chacun, pour des programmes de quatre parties |
| 5 | L'**anglais** du QCM, niveau B1 | **5 questions** pour une rubrique qui pèse 1/8e des 40 questions, selon le guide ENFiP |
| 6 | Les **neuf matières de QRC** | aucune fiche ; chacune pèse 3 à 4 questions sur une épreuve de coefficient 3 |
| 7 | Les **cinq options de l'interne**, coefficient 5 | l'option 5 (organisation de la DGFiP) est partiellement couverte par ce lot |

**DGFiP A+ — inspecteur principal.**

| Rang | Ce qui manque | Pourquoi ce rang |
|---|---|---|
| 1 | De quoi préparer la **note administrative** sur l'environnement administratif, économique, financier et social de la DGFiP et les politiques publiques où elle intervient — coefficient **6**, 5 heures | c'est l'épreuve la plus caractéristique du concours, et les deux fiches de ce lot n'en couvrent que la partie « organisation » |
| 2 | L'**oral**, coefficient **8**, 40 minutes | il porte sur les mêmes matières et sur les aptitudes d'encadrement supérieur |
| 3 | Les **six options métiers** de l'épreuve n° 2, notées 15/20 | fiscalité professionnelle ; fiscalité personnelle et patrimoniale ; gestion comptable et analyse financière ; gestion publique ; gestion des ressources et organisation de la DGFiP ; systèmes d'information |
| 4 | L'**analyse financière**, partie commune notée 5/20 | la seule partie que tous les candidats passent |

**Pour les deux examens professionnels d'accès au grade d'inspecteur principal**
(arrêtés du 11 septembre 2025), il n'y a **rien à réviser au sens d'un
programme** : une présélection sur dossier, non notée, puis un oral de quarante
minutes seul noté. Le besoin de contenu y est de nature différente — préparer un
dossier de reconnaissance des acquis et un exposé de parcours.

### 3.3 Ce que j'ai ajouté dans ce lot, et pourquoi là

Les deux fiches couvrent **l'organisation de la DGFiP**, c'est-à-dire :
l'option 10 de l'épreuve n° 2 du concours interne de contrôleur, l'option 5 de
l'épreuve n° 2 du concours interne d'inspecteur, l'option « gestion des
ressources et organisation de la DGFiP » du concours professionnel d'inspecteur
principal, la partie B du thème « environnement administratif, économique et
financier » du QCM d'inspecteur, et la partie de l'oral consacrée à
l'environnement de la direction générale. C'est le seul objet du programme qui
serve **les trois concours à la fois**, ce qui en fait le point de départ qui
rend le plus.

Elles sont rangées sous `content/dgfip-a/` parce que c'est la racine de contenu
déclarée pour le parcours inspecteur — voir toutefois le § 6.1, qui est un
avertissement.

---

## 4. L'organigramme de la DGFiP (tâche B)

### 4.1 L'état de référence, et où il est écrit

Rien n'a été inventé : chaque structure nommée dans les deux fiches vient d'un
texte identifié au § 2.2. La répartition est la suivante.

- **L'administration centrale** repose sur l'arrêté du 20 décembre 2019, dont
  l'article 1er — version en vigueur depuis le **1er janvier 2021** — énonce
  « notamment deux directions et sept services ainsi que deux délégations
  directement placées auprès du directeur général ». Les articles 2 à 11-2
  détaillent chacune de ces structures et leurs sous-directions.
- **Le réseau déconcentré** repose sur le décret n° 2009-707 du 16 juin 2009,
  dont l'article 1er énumère quatre catégories et quatre seulement.
- **Les services à compétence nationale** reposent chacun sur leur propre texte,
  listé au § 2.2.
- **Les services de proximité** reposent sur les arrêtés de 1970, 2009, 2013,
  2017 et sur les arrêtés d'ajustement de périmètre de 2026.

### 4.2 Un écart relevé entre le texte et l'organigramme publié — et son explication

L'arrêté du 20 décembre 2019 compte **sept** services. L'organigramme publié le
**12 octobre 2026** aligne **huit** blocs au même rang visuel : SJCF, GF,
GPLABE, 2FCE, SRE, RH, SPiB, SI. Le huitième est le **service des retraites de
l'État**, qui ne figure dans aucun article de cet arrêté.

L'explication est dans les textes, et non dans une supposition : le SRE a été
créé par le décret n° 2009-1052 du 26 août 2009 et organisé par le décret
n° 2009-1053 du même jour ; c'est un **service à compétence nationale**, et
l'arrêté du 20 décembre 2019 n'organise que l'administration centrale. Le mot
« notamment » de l'article 1er autorise d'ailleurs l'organigramme à montrer
davantage que ce que l'arrêté nomme. Ce point est traité comme tel dans la
fiche 1, avec un schéma, parce que c'est exactement le genre d'écart qui produit
une réponse fausse apprise avec assurance.

### 4.3 Les réformes récentes, datées et sourcées

| Date | Fait | Source |
|---|---|---|
| 24 juillet 2000, article 1er modifié le **20 novembre 2020** | DNEF, DNVSF et DVNI deviennent des services à compétence nationale rattachés **au chef du SJCF**, et non plus au directeur général | les trois arrêtés du 24 juillet 2000, version en vigueur |
| 19 septembre 2016 | création de la **direction de l'immobilier de l'État**, qui succède à France Domaine | décret n° 2016-1234 |
| 4 décembre 2020 et 1er janvier 2021 | création des deux **délégations** : relations internationales (art. 11-1) et transformation numérique (art. 11-2) | arrêtés des 19 novembre et 9 décembre 2020 |
| 1er janvier 2021 | l'article 1er prend sa rédaction actuelle (« deux directions et sept services ») | arrêté du 9 décembre 2020 |
| 26 octobre 2022 | nouvelle rédaction de l'article 3 : les cinq sous-directions de la DLF | arrêté du 19 octobre 2022 |
| 3 février 2024 | nouvelle rédaction de l'article 7 : GPLABE | arrêté du 31 janvier 2024 |
| 1er janvier 2025 | nouvelle rédaction de l'article 4 du décret de 2009 : **douze domaines** de compétence étendue entre directions | décret n° 2024-610 du 26 juin 2024 |
| **14 février 2026** | nouvelle rédaction des articles 6 et 8 : service de la gestion fiscale et service de la fonction financière et comptable de l'État | arrêté du **10 février 2026** |
| 31 mars 2026 | modification de l'arrêté relatif à la direction des créances spéciales du Trésor | arrêté du 31 mars 2026 |
| 23 janvier 2026 et 1er septembre 2026 | transferts d'activité entre services de gestion comptable, département par département | arrêtés des 15 janvier et 29 juillet 2026 |
| depuis 2019, lancé « le 6 juin » | **nouveau réseau de proximité** : regroupement des trésoreries en services de gestion comptable, et augmentation d'au moins 30 % du nombre de points de contact | réponses du gouvernement aux questions écrites n° 20639 (15e lég.) et n° 5408 (16e lég.) |
| 2021-2025 | déploiement des **centres de gestion financière** : trois ouverts en 2025 | rapport d'activité 2025 de la DGFiP |

### 4.4 Les anciennes appellations

Elles sont traitées dans la fiche 2, avec ce que chacune est devenue : DGI et
DGCP, centre des impôts, trésorerie de proximité, conservation des hypothèques,
France Domaine, ISF. **Aucune structure supprimée ne figure à l'organigramme**
des fiches ; chacune n'apparaît que dans le tableau des anciennes appellations,
avec la raison qui la rend utile — les textes du concours les emploient encore.
Deux exemples sourcés : l'annexe de l'arrêté du 19 mai 2011 porte encore
« l'organisation et le fonctionnement des conservations des hypothèques » et
« l'impôt de solidarité sur la fortune (ISF) » ; l'arrêté du 9 mars 2009 prévoit
encore que le SIP « reçoit les déclarations relatives à l'impôt de solidarité
sur la fortune ». L'arrêté d'organisation du 20 décembre 2019, lui, nomme
« l'impôt sur la fortune immobilière ».

### 4.5 Les QCM existants qui reposeraient sur un organigramme périmé : **aucun**

Vérification exécutée : recherche, dans les huit fichiers de
`content/qcm-dgfip/`, de toute question dont l'énoncé, les options ou
l'explication mentionnent la DGFiP, une structure du réseau, une trésorerie, une
conservation des hypothèques, France Domaine, la DGI ou la comptabilité
publique.

**Deux questions seulement touchent la DGFiP**, et **aucune des deux n'est
périmée** :

1. `culture-generale.yml` — « Que signifie le sigle DGFiP ? ». Réponse
   « Direction générale des finances publiques », explication qui rappelle la
   fusion de 2008. **Exacte**, confrontée au décret n° 2008-310 du 3 avril 2008.
   Aucune correction proposée.
2. `francais.yml` — « Qu'est-ce que la “DGFiP” ? », réponse « Un acronyme ».
   Question de vocabulaire, sans contenu d'organisation. Aucune correction
   proposée.

**Il n'y a donc rien à réécrire de ce chef**, et rien n'a été réécrit. La raison
est simple et vaut d'être dite : la banque est tirée d'annales de catégorie B
dont le QCM porte sur les connaissances générales, le français, les
mathématiques et la logique — l'organisation de la DGFiP n'y est pas au
programme. Elle l'est en revanche aux options de l'épreuve n° 2 et à l'oral,
c'est-à-dire là où il n'y avait aucun contenu avant ce lot.

---

## 5. La fiabilisation des QCM existants (tâche D)

### 5.1 Un obstacle dirimant, et je m'y arrête

**Les vingt-cinq corrigés d'annales de `sources/annales-dgfip/` sont des copies
de pages de `devenez-fonctionnaire.fr`.** Constaté en lisant les adresses
contenues dans l'un des fichiers `.htm` — elles pointent toutes vers ce
domaine, dont l'adresse n'est pas recopiée ici : le projet demande de
l'oublier, et l'écrire dans un document commité serait la remettre en
circulation —,
sans ouvrir le contenu des corrections. Cette source est **bannie du projet**
par votre consigne.

**Je n'ai donc ouvert aucun de ces vingt-cinq fichiers, et je n'ai recoupé
aucune question contre eux.** La tâche D, telle qu'elle est formulée —
« fiabilisation des QCM existants contre les corrigés d'annales » — ne peut pas
être conduite avec les sources présentes. Je m'arrête là-dessus plutôt que de
contourner.

**Deux conséquences à connaître, qui vous appartiennent.**

1. La banque **cite déjà cette source**, à découvert. L'en-tête de
   `content/qcm-dgfip/environnement-administratif.yml` explique que « les
   “propositions de correction” auxquelles renvoient ces champs viennent du site
   communautaire Devenir fonctionnaire ». Quatre des six champs `incertain:`
   restants citent « la correction de l'annale », c'est-à-dire la même source.
   Ce n'est pas mon fait, et je ne l'ai pas modifié : réécrire 540 questions et
   leurs attributions de source est une décision, pas une correction.
2. Les questions tirées des **annales 2015 à 2024-2025** — environ 270 d'après
   le dépouillement des champs `source:` — ont leur clef de réponse établie
   contre cette source. Tant qu'un corrigé officiel ne les recoupe pas, leur
   fiabilité repose sur elle.

### 5.2 Ce qui a été vérifié malgré cela, contre des sources officielles

**Le recompte des `incertain:` — exécuté et constaté.** La feuille de route en
annonçait **seize** (8 culture générale, 4 maths, 3 logique, 1 français). Il en
reste **six** :

| Rubrique | Question | État |
|---|---|---|
| culture-generale | « Quelle institution française est renouvelée par fractions tous les trois ans ? » | incertitude **documentée et justifiée** : sujet 2026 officiel sans corrigé, et l'énoncé officiel disait « par tiers », ce que la composition actuelle du Sénat contredit |
| culture-generale | « Qui a peint “Le Déjeuner sur l'herbe” ? » | incertitude documentée : plusieurs peintres ont traité le sujet |
| culture-generale | « Qui fut le dernier roi de France à avoir régné ? » | incertitude documentée : Charles X au titre, Louis-Philippe au fait de régner |
| logique | « Cailloux – Pierres – Roches – ??? » | sujet 2026 officiel sans corrigé ; deux lectures exposées |
| logique | « ANGUILLE – MANGUE – CRABE – GOYAVE – ? » | deux raisonnements concurrents exposés |
| maths | tirage de billes, avec ou sans remise | énoncé ambigu, les deux calculs figurant parmi les options |

Dix incertitudes ont donc été levées entre la feuille de route et aujourd'hui,
avant mon intervention. Les six restantes sont **correctement rédigées** : elles
exposent le désaccord au lieu de le masquer. **Je n'en ai levé aucune et n'en ai
ajouté aucune** — les lever demanderait soit un corrigé officiel, soit la source
bannie.

**Les attributions de source aux sujets 2026 — vérifiées.** La banque attribue
des questions aux « épreuve n° 2, QCM » des concours 2026 de contrôleur et
d'inspecteur. J'ai vérifié que ces sujets existent bien dans la collecte, et
qu'ils contiennent bien le QCM : les fichiers `A9-sujet-cfip-externe-2026-…` et
`A9-sujet-ifip-externe-2026-…` portent en première page « ÉPREUVE ÉCRITE
D'ADMISSIBILITÉ N° 2 », puis « Questionnaire à choix multiples (QCM) Et
Questions à réponses courtes (QRC) à option », le QCM étant commun à toutes les
options. J'ai comparé les **énoncés** : les questions 1 à 30 du sujet contrôleur
2026 se retrouvent dans la banque, réparties entre `culture-generale`,
`francais`, `maths` et `logique`, avec des reformulations ponctuelles qui ne
changent pas le sens — sauf une, signalée ci-dessous, qui le change et qui est
déjà documentée.

Les **clefs de réponse** de ces 2026, elles, ne peuvent pas être vérifiées :
**aucun corrigé officiel n'existe pour ces sujets**. C'est précisément ce que
disent leurs champs `incertain:` lorsqu'il y en a un.

**Trois réponses recoupées contre des sources officielles ou non contestées,
toutes exactes** : la signification du sigle DGFiP (décret n° 2008-310) ; le
passage de 22 à 13 régions métropolitaines ; le premier président de la
République. Aucune correction n'est proposée.

### 5.3 Ce qui est à revoir, et que je n'ai pas touché

1. **Une question expirée**, signalée par `npm run check-content` :
   `qcm-dgfip/union-europeenne.yml`, « Quel État membre préside le Conseil de
   l'Union européenne de… » — `expire_le: 2025-12-31`, nature
   `passee-non-historique`. Elle est **retirée du tirage** par le programme, et
   le rapport demande de « la remplacer à rubrique et compétence constantes ».
   Elle ne l'a pas été. Rubrique `union-europeenne` : 10 questions, donc 9 qui
   tombent réellement.
2. **La couverture de la temporalité est très faible** : 30 questions étiquetées
   sur 540, soit **5,6 %**. 510 questions n'ont aucun champ `temporalite:`. Une
   question datée sans étiquette ne peut pas expirer, et c'est exactement le cas
   de figure du point précédent — sauf que là, personne ne sera prévenu.
3. **Une question reproduit un « sauf » noyé dans l'énoncé** :
   `culture-generale.yml`, « Les opérations suivantes constituent un traitement
   de données personnelles, sauf une. Laquelle ? ». Elle contrevient à la règle
   de rédaction du projet — et elle est la **transcription fidèle** de la
   question 1 du sujet officiel 2026, qui écrit « Les opérations suivantes
   constituent un traitement de données personnelles sauf une. Laquelle ? ».
   Fidélité à l'annale et règle interne s'opposent ici ; c'est un arbitrage qui
   vous revient, et je ne l'ai pas tranché.
4. **153 questions sur 540 ne viennent d'aucune annale** (`source: RevINSP —
   rédaction originale`). Ce n'est pas un défaut, mais c'est une information
   utile quand on juge de la représentativité de la banque.

---

## 6. Trois points signalés, qui relèvent du code et non de moi

### 6.1 `racineContenu` n'est lu nulle part — avertissement important

Constat exécuté : `grep -rn "racineContenu" src scripts` ne renvoie que les
cinq occurrences de `src/lib/parcours/registre.ts` lui-même — la déclaration de
l'interface et les quatre valeurs. **Aucun consommateur.**

Et `scripts/build-content.mjs` parcourt `content/` **récursivement**, en ne
retenant que l'extension `.md`, puis reconstruit la hiérarchie affichée à partir
des champs `matiere` et `fascicule` du front-matter (`listerFiches`, puis le
regroupement `parMatiere`).

**Conséquence, à mesurer avant la prochaine construction** : les deux fiches
déposées dans `content/dgfip-a/` apparaîtront, après build, comme une **matière
supplémentaire du parcours INSP**, nommée « Organisation de la DGFiP », aux
côtés du droit public et de l'économie. Elles ne seront pas rattachées au
parcours `dgfip-a`, parce que rien dans le code ne sait le faire aujourd'hui.

Je n'ai pas touché au code. Deux issues possibles, et elles vous appartiennent :
faire lire `racineContenu` par le chargeur de contenu, ou déplacer ces deux
fiches ailleurs. Si vous préférez les retirer en attendant, elles sont dans un
seul dossier, `content/dgfip-a/organisation-dgfip/`, et rien d'autre n'en
dépend — hors les 29 termes de glossaire, qui restent utiles de toute façon.

J'ai choisi le nom de matière « Organisation de la DGFiP » et le nom de
fascicule « Fascicule 1 — L'organigramme de la DGFiP » précisément pour que, si
elles s'affichent dans l'arbre de l'INSP, leur origine soit lisible au premier
coup d'œil plutôt que confondue avec une matière du concours interne.

Un effet de bord mineur, constaté à la lecture du script parlé engendré : la
phrase d'ouverture annonce « Nous sommes en Organisation de la DGFiP,
fascicule 1 », tournure maladroite que produit le gabarit « Nous sommes en
<matière> » appliqué à un nom de matière qui n'est pas un nom de discipline. Ce
n'est pas corrigeable dans la fiche — le gabarit est dans
`scripts/lib/podcast.mjs` — et je n'y touche pas. Changer le nom de matière en
« Organisation administrative » ferait disparaître la gêne, au prix de la
lisibilité de l'origine ; c'est un arbitrage de plus à votre main.

### 6.2 Le barème du QCM annoncé par le README n'est appuyé par aucune source lue

Le README annonce, pour l'épreuve blanche, « +1 par bonne réponse, −0,5 par
mauvaise, 0 en l'absence de réponse ». Je n'ai trouvé ce barème **nulle part** :
ni dans l'arrêté du 19 mai 2011, ni dans celui du 2 mars 2011, ni dans les deux
guides ENFiP, ni dans la notice du sujet officiel 2026, qui écrit seulement
« Une réponse fausse est pénalisée. L'absence de réponse vaut zéro. » Le guide
ENFiP inspecteur dit de même « une réponse fausse est sanctionnée de façon
négative ». La pénalité existe donc ; **son montant n'est pas sourcé**. À
vérifier, ou à annoncer comme une convention du site plutôt que comme le barème
du concours.

### 6.3 Un doublon préexistant dans le glossaire, corrigé

En ajoutant les sigles, le contrôle a révélé que j'introduisais un doublon sur
« service facturier », déjà présent à la ligne 1175 de `content/glossaire.yml`.
**C'est mon entrée que j'ai retirée**, l'ancienne étant conservée intacte. Le
fichier compte désormais 560 entrées et aucun terme en double — constaté par un
contrôle YAML. Signalé ici parce que le schéma du glossaire (`glossaireSchema`)
n'interdit pas les doublons : rien n'aurait prévenu.

---

## 7. Ce qui n'a pas été trouvé

| Ce qui manque | Ce que j'ai constaté |
|---|---|
| **Un corrigé officiel de QCM**, pour n'importe quelle année et n'importe quelle voie | aucun dans `sources/`. Les seuls corrigés présents viennent de la source bannie |
| Le **barème chiffré** de l'erreur au QCM | voir § 6.2 |
| Les **guides ENFiP des concours internes** (contrôleur, inspecteur, IPFiP) | le tableau de la collecte les porte en « introuvable » ; seuls les guides des concours **externes** ont été récupérés |
| Les **rapports de jury 2026** du concours de contrôleur | tableau de la collecte : « trouvé, non téléchargeable » |
| L'**arrêté de création des services de gestion comptable** | aucun texte fondateur du SGC dans les sources lues. Le SGC n'apparaît que comme **poste comptable nommé** dans les arrêtés d'ajustement de périmètre, et comme mécanisme dans les réponses aux questions écrites. La fiche 2 le dit ainsi, sans inventer de texte |
| Un **texte de création propre au SIE** | le SIE est nommé par l'arrêté du 9 mars 2009 (SIPE), par celui du 20 décembre 2013 et par celui du 1er juin 2017, mais son texte de création n'est pas dans les sources lues |
| L'**annexe du DIRCOFI** (liste, ressorts, sièges) à jour | l'arrêté du 16 mars 2012 y renvoie ; l'annexe elle-même n'a pas été dépouillée, faute de temps, et aucun nom de DIRCOFI n'est affirmé dans les fiches |
| L'accès à **Légifrance** | exécuté et constaté le 17 octobre 2026 : `curl` vers `legifrance.gouv.fr` → « CONNECT tunnel failed, response 403 ». La collecte du pilote faisait le même constat le 14 octobre (défi anti-robot). Rien n'a été contourné |
| La **date de publication** des réponses aux questions écrites de l'Assemblée nationale | les PDF de la collecte ne la portent pas ; seules la législature et le numéro de question sont citables, et c'est ce qui est cité |

Un point d'outillage, pour mémoire : les impressions Légifrance de
`sources/officiels/` ont leur texte **tracé en contours vectoriels** — aucune
extraction de caractères n'est possible. Pour les lire, `poppler-utils` a été
installé sur la machine (`apt-get install poppler-utils`), ce qui permet le
rendu des pages en images. C'est la seule modification faite hors de `content/`
et `docs/`, et elle ne touche pas le dépôt.

---

## 8. Documents à demander à Alexis

Par ordre d'utilité décroissante.

1. **Un corrigé officiel de QCM, pour n'importe quelle session.** C'est le seul
   document qui débloque la tâche D. Sans lui, la fiabilisation de 540 questions
   repose sur une source bannie, et aucune des six incertitudes ne peut être
   levée honnêtement.
2. **Les guides ENFiP des concours internes** — contrôleur, inspecteur,
   inspecteur principal. Les guides externes ont permis d'établir le nombre de
   questions, le format de la feuille de réponse et la règle d'élimination ;
   rien d'équivalent n'existe pour les voies internes, qui sont pourtant celles
   dont les épreuves d'option sont les plus nombreuses.
3. **Les rapports de jury 2026** du concours de contrôleur (interne et externe),
   signalés « trouvés, non téléchargeables ».
4. **La décision sur `racineContenu`** (§ 6.1) : faut-il que le chargeur de
   contenu rattache `content/dgfip-a/` au parcours inspecteur, ou faut-il que je
   range ces fiches ailleurs ?
5. **L'arbitrage sur le « sauf » des annales** (§ 5.3, point 3) : fidélité à
   l'énoncé officiel, ou règle de rédaction du projet ?
6. **La position à tenir sur les sources de la banque QCM** (§ 5.1) : la source
   bannie est citée dans l'en-tête d'un fichier de rubrique et dans quatre
   champs `incertain:`. Faut-il réécrire ces mentions, et avec quoi ?
7. **L'annexe de l'arrêté du 16 mars 2012** à jour, ou la carte des DIRCOFI, si
   vous souhaitez une fiche qui les nomme.
8. **Le barème officiel du QCM**, s'il existe quelque part (§ 6.2).

---

## 9. Ce qui est prêt à être commité, et ce qui ne doit jamais l'être

**Prêt à être commité — je n'ai rien commité moi-même :**

- `docs/cyclades/contenu-dgfip-2026-10-17.md` (le présent fichier)
- `docs/cyclades/programmes-dgfip.md` — **déjà commité par vous** entre-temps,
  en `91665f2`. Vérifié : le fichier du répertoire de travail est identique à
  celui du commit (`git diff HEAD` vide).

Ces deux fichiers ne contiennent aucun contenu de fiche, aucun nom de personne,
aucune donnée personnelle, et aucun extrait de source dont la redistribution
poserait question : ils citent des textes réglementaires par leur référence.

**À ne jamais commiter**, et laissé en place dans l'arborescence ignorée par
Git :

- `content/dgfip-a/organisation-dgfip/fiche-01-administration-centrale-de-la-dgfip.md`
- `content/dgfip-a/organisation-dgfip/fiche-02-reseau-deconcentre-et-services-de-proximite.md`
- les deux `.podcast.md` correspondants
- `content/glossaire.yml`, modifié

**Rien n'a été publié.** `node scripts/deploy.mjs` n'a pas été appelé. Aucun
`git add`, aucun `git commit`, aucun `git push` de ma part.

Vérifié : `git ls-files content/` renvoie **0**, et `git check-ignore -v` sur
une des deux fiches confirme qu'elle est écartée par `.gitignore:3 content/`.

**Une observation sur l'état du répertoire de travail, qui n'est pas de mon
fait.** Au moment de rendre ce compte rendu, `git status` fait apparaître des
modifications non commitées dans `.gitignore`, `package.json`,
`scripts/build-content.mjs`, `scripts/changer-mot-de-passe.mjs`,
`site.config.mjs`, `src/env.d.ts`, `src/lib/auth.ts`, `src/lib/coffre.ts`, deux
scripts d'essais non suivis, et une suppression **déjà indexée** de
`scripts/hash.mjs`. **Je n'ai touché à aucun de ces fichiers** : mon périmètre
s'est limité à `content/` et à `docs/cyclades/`. Ces changements viennent de la
tâche qui travaille en parallèle sur le dépôt. Je les signale pour qu'aucun ne
me soit attribué, et pour que la suppression indexée de `scripts/hash.mjs` ne
parte pas dans un commit par inadvertance.

---

## 10. Où j'en suis, pour une reprise sans redécouverte

Fait : la tâche A en entier ; la tâche B pour l'administration centrale, le
réseau, les services de proximité, les réformes datées, le rendu dans `content/`
et l'audit des QCM dépendant de l'organigramme ; la tâche C pour l'inventaire et
pour le premier lot d'ajout.

Reste : la suite de la tâche C, c'est-à-dire les lots suivants par ordre de
poids — l'épreuve n° 1 du contrôleur, puis l'oral, puis l'environnement
administratif du QCM d'inspecteur, dont la rubrique ne porte que 10 questions.
La tâche D est **bloquée** sur l'absence de corrigé officiel, et elle le restera
tant que le document n° 1 de la liste du § 8 n'aura pas été fourni.

Et il manque une construction, que je n'ai pas le droit de lancer : les deux
fiches n'ont pas encore traversé `scripts/build-content.mjs`.

**Un point d'état sur l'audio — constaté, et il manque quelque chose.**
`npm run podcasts` a produit les deux scripts parlés immédiatement, puis a
enchaîné sur la synthèse vocale des deux fiches dont l'audio manquait. **Cette
synthèse n'est pas allée au bout** : le processus a été interrompu au bout de
quinze minutes par la limite de la tâche de fond, et **aucun fichier `.opus`
n'a été produit** pour ces deux fiches. Les 501 fichiers de `content/.audio/`
sont ceux d'avant ; le plus récent date du 14 octobre.

Deux conséquences, l'une bénigne, l'autre à retenir :

- un témoin `content/.audio/.synthese-en-cours` est resté, portant le numéro du
  processus interrompu. **Il n'y a rien à nettoyer** : `synthesePosee()`, dans
  `scripts/podcasts.mjs`, lit ce numéro et vérifie que le processus vit encore
  avant d'en tenir compte ; comme il est mort, le témoin est traité comme
  « laissé par une exécution interrompue ». Je ne l'ai pas supprimé, et il ne
  bloquera pas la prochaine exécution ;
- **les deux fiches de ce lot n'ont pas de fiche audio.** Un build sans
  `REVINSP_SANS_PODCAST=1`, ou un simple `npm run podcasts` laissé aller au
  bout, la produira. Comptez environ 22 minutes de parole par fiche. Les
  scripts parlés, eux, sont écrits et leur empreinte est stable : ils ne seront
  pas régénérés différemment.

**Et un point d'hygiène qui ne m'appartient pas.** Un fichier `.env.local` est
présent à la racine depuis 23 h 50, créé par la tâche parallèle pour son build.
Je ne l'ai ni lu, ni écrit, ni supprimé : l'effacer pendant une construction en
cours la ferait échouer. La règle du projet veut qu'il soit effacé juste après
chaque build et que son absence soit vérifiée ; **c'est à faire quand la tâche
parallèle aura fini.**
