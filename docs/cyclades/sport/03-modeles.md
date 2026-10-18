# 03 — Modèles de programmes bodybuilding (R2 bis, R3, R4), 18/10/2026

Complément du dossier du 18/10 (prompt 47 bis). À lire avec `00-synthese.md`. Les modèles sont des **propositions de cibles**, exprimées dans le modèle de Cyclades (`Programme`, `SeanceType`, `BlocPrevu`, `ciblesParMuscle`) ; ils ne sont pas des prescriptions.

## 0. Comment lire ce fichier

Ce fichier répond au complément **47 bis** (le 47 était arrivé coupé après « Full body sur 2 et 3 jours ; »). Il contient : **R2 bis** (fiches D08 maison et D09 spécialisation ; leurs règles sourcées nouvelles sont dans `02-decoupages.md` et dans le CSV), **R3** (sept modèles prêts à traduire en `Programme`, `SeanceType` et `BlocPrevu`), **R4** (les exercices à ajouter), puis les **questions à trancher**. Les lignes H01 à H13 et D01 à D07 sont celles des fichiers du 18/10 ; les lignes **D08-xx et D09-xx** sont nouvelles et suivent les mêmes règles (statut de lecture, niveau de preuve).

**Trois origines de valeurs, à ne pas confondre.**

| Origine | Où on la voit | Ce que cela veut dire |
|---|---|---|
| **Source** | un ID du dossier (par exemple H01-14) | la valeur ou la fourchette est lue dans une source citée dans cette ligne, avec son niveau de preuve |
| **Choix du dossier** | « choix » dans les tableaux | une valeur choisie à l'intérieur d'une fourchette sourcée (par exemple 150 s de repos, dans la plage de 120 à 180 s de H05-10) ; aucune source ne désigne cette valeur précise |
| **Convention de muscles** | tableau des exercices | le classement de chaque exercice en muscles principaux et secondaires **ne vient pas des sources** ; c'est une convention d'anatomie courante, écrite parce que la bibliothèque de Cyclades (`BIBLIOTHEQUE`, `MUSCLES`) n'était pas accessible à l'auteur du dossier. **À comparer à la bibliothèque réelle, puis à recalculer** (voir la sensibilité plus bas et les questions à trancher) |

Toutes les valeurs sont des **cibles, jamais des obligations** : Sport propose, la personne dispose, et le réel fait foi. Aucune étude ne compare les modèles entre eux (voir D01 à D05) ; le dossier ne classe donc pas un modèle « meilleur » qu'un autre.


## 1. Les modèles en un coup d'œil

| Modèle | Séances par semaine | Séries par semaine | Durée par séance (min) | Passages par grand groupe | Pectoraux | Dorsaux | Quadriceps | Équipement |
|---|---|---|---|---|---|---|---|---|
| M1 — PPL 3 jours | 3 | 68 | 54 / 50 / 63 | 1 | 9 | 10 | 9 | salle |
| M2 — PPL 6 jours | 6 | 89 | 29 / 35 / 41 / 30 / 33 / 45 | 2 | 11 | 12 | 10 | salle |
| M3 — Haut/Bas 4 jours | 4 | 77 | 53 / 41 / 52 / 42 | 2 | 10 | 12 | 10 | salle |
| M4 — Full body 3 jours | 3 | 62 | 49 / 53 / 52 | 2 à 3 | 9 | 9 | 10 | salle |
| M5 — Full body 2 jours | 2 | 39 | 44 / 55 | 1 à 2 | 6 | 6 | 6 | salle |
| M6 — Maison 3 jours | 3 | 67 | 46 / 53 / 58 | 2 à 3 | 9 | 9 | 9 | maison |
| M7 — Haut/Bas 4 jours + spécialisation épaules (côté) | 4 | 77 | 50 / 39 / 54 / 44 | 2 à 3 | 10 | 11 | 10 | salle |

*Séries par semaine = somme des séries de travail des séances ; « Pectoraux », « Dorsaux », « Quadriceps » = cibles hebdomadaires calculées (point 2). Passages = nombre de séances où le grand groupe est sollicité, directement ou en secondaire.*

## 2. Conventions de calcul

- **Cible hebdomadaire d'un muscle** = somme, sur toutes les séances de la semaine, de (séries × 1) pour chaque exercice où le muscle est **principal** et de (séries × 0,5) pour chaque exercice où il est **secondaire**. C'est la méthode « fractionnée » de la méta-régression de Pelland et coll. (H01-22) et le `COEFFICIENT_SECONDAIRE` de Cyclades. La source ne mesure pas le coefficient : son estimation exploratoire est d'environ 0,32 pour l'hypertrophie (H01-24). Les cibles peuvent donc être lues comme une fourchette (valeur calculée à 0,5, valeur plus basse à 0,32 pour les muscles surtout secondaires).
- **Règle de classement de la convention** : un muscle est **principal** s'il est le moteur principal du mouvement ; **secondaire** s'il y contribue de façon dynamique notable ; un muscle qui stabilise ou tient la prise (isométrique) **ne compte pas**. Les avant-bras ne sont donc comptés qu'aux curls ; les lombaires qu'aux soulevés ; le cou n'est programmé nulle part (aucune source lue).
- **Série unilatérale** (fentes, rowing à un bras, gainage latéral, mollets à une jambe) : une série = les deux côtés faits ; elle compte pour 1 série du muscle. **Gainage** : une série = un maintien ; les « répétitions » du bloc sont des **secondes**.
- **Séries comptées** : séries de travail, proches de l'échec au RIR visé (définition du volume de H01-21) ; les séries d'échauffement ne comptent pas.
- **Repères du dossier utilisés pour juger chaque cible** : minimum efficace d'environ 4 séries fractionnées (H01-06) ; repère officiel d'environ 10 séries par groupe musculaire et par semaine (H01-14, H03-10, H10-12) ; plage de 12 à 20 séries sans bénéfice net au-delà pour quadriceps et biceps (H01-09), pas de plateau net en méta-régression (H01-08) ; environ 11 séries fractionnées par séance au plus (H01-19, prépublication non évaluée par des pairs) et environ 10 séries par muscle et par séance (D03-06, D05-07) ; au moins 2 jours par semaine pour chaque grand groupe (H01-14, D01-04), alors qu'à volume égal la fréquence n'a pas d'effet mesuré sur l'hypertrophie (H02-02, H01-20). **Pour les petits muscles** (avant-bras, trapèzes, lombaires, abdominaux, obliques, adducteurs, cou), le dossier n'a **aucune donnée propre** : les mêmes repères sont appliqués par défaut et signalés comme tels.

## 3. Valeurs communes aux modèles

| Paramètre | Valeur retenue | Ce que disent les sources (fourchette) | ID | Niveau de preuve | Nature |
|---|---|---|---|---|---|
| Séries par muscle et par semaine | résultat du calcul de chaque modèle (grands groupes : de 6 à 14 selon le modèle) | environ 10 (ACSM 2026) ; minimum efficace d'environ 4 séries fractionnées ; 12 à 20 sans bénéfice net au-delà pour quadriceps et biceps ; pas de plateau net | H01-14, H03-10, H10-12 ; H01-06 ; H01-09, H01-10 ; H01-07, H01-08 | prise de position ; méta-analyse (méta-régression) ; revue systématique | source pour la fourchette, choix du dossier pour la position |
| Coefficient des muscles secondaires | 0,5 | meilleur ajustement parmi trois valeurs testées ; estimation exploratoire d'environ 0,32 ; jamais mesuré par essai | H01-22, H01-23, H01-24 | méta-analyse (méta-régression) | source avec réserve |
| Séries par muscle et par séance | au plus environ 10 à 11 séries fractionnées | environ 11 (point d'efficacité indétectable, prépublication) ; environ 10 (consensus d'athlètes) ; environ 6 (un coach, piste) | H01-19 ; D03-06, D05-07 ; D01-10 | méta-analyse (prépublication) ; prise de position ; pratique de terrain | choix du dossier |
| Fréquence par muscle | 2 à 3 passages par semaine (1 passage pour le PPL 3 jours) | au moins 2 jours pour les grands groupes (ACSM 2026) ; à volume égal, pas de différence mesurée pour l'hypertrophie ; un passage peut suffire (consensus d'athlètes) | H01-14, D01-04 ; H02-02, H01-20 ; D04-07 | prise de position ; méta-analyse | source |
| Répétitions | 6 à 10 aux barres libres lourdes ; 8 à 12 aux polyarticulaires moyens ; 10 à 15 aux isolations ; 12 à 20 aux petits muscles et aux mollets | pas de « zone d'hypertrophie » idéale ; croissance semblable dès environ 30 % du 1RM près de l'échec ; 6 à 20 répétitions (IUSCA) ; 6 à 12 en accent (ACSM 2009) | H03-01, H03-02, H03-06, H03-07, H03-08, H03-09 | méta-analyse ; prise de position ; consensus d'experts | choix du dossier dans la fourchette |
| Proximité de l'échec (RIR visé) | 2 à 3 aux barres libres lourdes ; 1 à 2 ailleurs | l'échec n'a qu'un avantage trivial ; environ 2 RIR (presse) ou 1 RIR (extension) ont valu l'échec dans un essai (n = 18) ; aucune prise de position ne donne de RIR cible ; le RIR est sous-estimé de 0,95 répétition en moyenne | H04-01, H04-05, H04-07, H04-08, H04-11 | méta-analyse ; essai contrôlé ; prise de position | choix du dossier |
| Repos entre séries | 150 s (barres libres lourdes), 120 s (polyarticulaires moyens), 90 s (isolations, mollets), 75 s (petits muscles), 60 s (tronc) | un peu plus de bénéfice au-delà de 60 s, aucune différence détectée au-delà de 90 s ; ACSM 2009 : 1 à 2 min, et 2 à 3 min pour les gros exercices lourds des avancés ; NSCA citée : 30 à 90 s | H05-04, H05-05, H05-07, H05-10, H05-12, H05-13 | méta-analyse ; prise de position | choix du dossier (toute valeur de 60 à 180 s est dans les données) |
| Ordre des exercices | gros polyarticulaires d'abord, isolations ensuite | l'ACSM le conseille ; l'ordre n'a pas d'effet significatif sur l'hypertrophie, il en a sur la force des exercices placés en tête | H07-01, H07-02, H07-03 | prise de position ; méta-analyse | source |
| Variantes choisies | mollets debout ; triceps bras au-dessus de la tête ; leg curl assis ; amplitude complète pour le bas du corps | plus de croissance dans ces essais (mollets, triceps, ischio-jambiers) ; la pleine amplitude est favorable à l'hypertrophie du bas du corps | H07-12, H07-11, H07-08, H07-09 | essai contrôlé ; revue systématique ; méta-analyse | source (essais courts, petits effectifs) |
| Techniques avancées | aucune dans les modèles | pas d'avantage constant sur l'entraînement classique à volume égal ; supersets et séries dégressives gagnent du temps | H08-01, H08-03, H08-05, H08-10, H08-11 | revue systématique ; méta-analyse | choix du dossier (option laissée à la personne) |

## 4. Règle de progression proposée

**Double progression** (*pratique de terrain, non démontrée* : aucune étude lue ne teste ce schéma comme méthode nommée, H06-02). Pour chaque `BlocPrevu` :

1. Garder la **charge** tant que la personne n'atteint pas le haut de la fourchette de répétitions sur toutes les séries au RIR visé ; viser une répétition de plus par série d'une séance à l'autre.
2. Quand elle atteint le haut de la fourchette (ou le dépasse de 1 à 2 répétitions, sur deux séances consécutives selon l'ACSM 2009), **monter la charge** du plus petit pas disponible, dans l'ordre de +2 à +10 % (borne basse pour les petits muscles, borne haute pour les gros ; H06-01), puis redescendre au bas de la fourchette.

**Pourquoi ce choix** : ses deux briques sont étayées séparément (incrément de charge : H06-01 ; monter les répétitions à charge constante ou monter la charge à répétitions constantes a donné des gains d'épaisseur très proches dans un essai de 43 personnes, H06-03). Il ne demande, à la saisie, que la charge et les répétitions de la séance précédente ; ce classement de la simplicité sur téléphone est un **jugement de conception, hors preuve** (H06-14).

**Alternatives sourcées, laissées à la personne** : charges réglées sur le RPE ou le RIR (effets sur l'épaisseur musculaire non différents du pourcentage du 1RM dans un essai de 21 hommes, H06-06 ; meilleure progression de force dans un essai de 31 hommes, H06-07, force et non hypertrophie) ; autorégulation par la vitesse de la barre (capteur nécessaire, H06-09, H06-12). Limite commune : le RIR et la prédiction des répétitions restantes sont sous-estimés en moyenne (H06-13, H04-11) et l'erreur est plus grande loin de l'échec (H04-13).

## 5. Déload type

*Pratique d'entraîneurs, non démontrée par des essais* (enquête qualitative auprès de 18 entraîneurs, H09-12, H09-13), appuyée par un consensus Delphi sur la forme (H09-10, H09-11). Les colonnes « Déload » des tableaux de séances en appliquent la règle suivante :

| Élément | Règle des modèles | Ce que disent les sources | ID |
|---|---|---|---|
| Intervalle | toutes les 4 à 6 semaines d'entraînement, **si la personne le souhaite** | typiquement toutes les 4 à 6 semaines (extrêmes de 3 à 12) ; déclenchement planifié ou autorégulé (consensus 100 %) | H09-12, H09-10 |
| Durée | 5 à 7 jours (une semaine) | typiquement 5 à 7 jours | H09-12 |
| Volume | séries du bloc × 0,6, arrondies (soit −33 % à −50 % selon le bloc) | volume en baisse de 30 % à plus de 50 % ; moins de séries : consensus à 100 % | H09-13, H09-11 |
| Effort | RIR visé de 3 à 4 | +1 à 3 RIR par série | H09-13 |
| Fréquence | `parSemaine` inchangé | « fréquence inchangée » : 100 % au Delphi | H09-11, H09-13 |
| Charge | inchangée ou légèrement réduite | intensité inchangée avec volume en baisse : 95,2 % au Delphi | H09-11 |
| Arrêt complet d'une semaine | option, jamais obligation | un essai (n = 39) : hypertrophie du bas du corps non différente, force un peu moindre | H09-14 |

Aucune étude lue ne montre qu'un déload systématique améliore l'hypertrophie ; le Delphi donne la forme, pas un pourcentage ni un nombre de semaines.

## 6. Phases, reprise, modulation

| Phase ou cas | Ce que le dossier permet | ID | Niveau de preuve |
|---|---|---|---|
| Prise de masse | les modèles tels quels (repère général d'environ 10 séries par groupe et par semaine) | H10-12 | prise de position |
| Sèche | garder au moins environ 10 séries par groupe et par semaine (preuve faible) ; les études où le volume a augmenté s'en sortent mieux que celles où il a baissé ; le cardio n'a pas d'effet d'interférence net sur l'hypertrophie, mais les sources divergent sur la course (nutrition chiffrée hors champ) | H10-04, H10-05 ; H11-02, H11-03 | revue systématique ; méta-analyse |
| Maintien | plancher indicatif : 1 séance par semaine et 1 série par exercice, intensité conservée, jusqu'à 32 semaines chez l'adulte jeune ; dans un essai (n = 70), un tiers ou un neuvième de la dose ont préservé l'hypertrophie chez les jeunes, pas chez les âgés (la « dose » n'est pas traduisible en séries : nature non lue) | H10-08, H10-10 | consensus d'experts ; essai contrôlé |
| Déload | voir le point 5 | H09-10 à H09-14 | consensus d'experts ; enquête ; essai |
| Reprise après une pause | arrêt court (moins de 4 semaines) : perte de force limitée ; après 12 semaines d'arrêt, la force est revenue en moins de 8 semaines de réentraînement chez des hommes âgés (force, non hypertrophie) ; repère de terrain : redémarrer à environ 75 % de l'ancien 1RM et remonter en environ 13 semaines ; limiter la hausse de charge à moins de 10 % par semaine est un consensus établi sur des athlètes de sports collectifs, non sur la musculation. Les modèles se reprennent en appliquant les valeurs du déload type, puis en remontant | H13-03, H13-05, H13-08, H13-09 | consensus d'experts ; essai contrôlé ; pratique de terrain |
| Blessure en cours | modulation par les remplaçants du tableau de chaque modèle (pratique de terrain, sans preuve citée) ; entraîner un membre en unilatéral augmente aussi la force du membre non entraîné (information) ; aucune prescription médicale | H13-10 | méta-analyse |
| Sexe, âge, niveau | un seul jeu de modèles : ni l'âge, ni le statut d'entraînement, ni la proportion de femmes ne modifient clairement l'effet de la prescription chez les adultes sains ; l'hypertrophie ne diffère pas entre hommes et femmes pour un même protocole. Les valeurs viennent surtout de jeunes adultes (âge moyen de 25 ans, 79 % d'hommes) ; pour les plus de 65 ans, voir H12-14 à H12-17 | H12-05, H12-08, H02-04 ; H12-14 à H12-17 | méta-analyse |


## 7. R2 bis — Les deux découpages manquants (D08 et D09)

Chaque fiche suit la forme des fiches D01 à D07 de `02-decoupages.md` (structure, séances types, rythme, public, avantages, limites, ce que disent les sources, traduction dans le modèle de Cyclades). Les règles sourcées nouvelles (D08-01 à D08-22, D08-31 à D08-54, D09-01 à D09-26) sont ajoutées à `02-decoupages.md` et au CSV, avec leurs sources dans `99-sources.md`.

### 7.1 D08 — Maison, avec haltères et poids du corps, sur 3 jours

Les règles sourcées D08 sont de deux agents : D08-01 à D08-22 (pompes, poids du corps, leviers de progression, élastiques, domicile) et D08-31 à D08-54 (choix d'exercices par muscle, remplacements). **Les numéros D08-23 à D08-30 ne sont pas attribués.** D08-13 et D08-31/D08-32 portent sur la même méta-analyse (unilatéral et bilatéral). Aucune source lue ne décrit un programme complet à domicile sur 3 jours avec ce matériel : la structure est une construction du dossier à partir de D05 (corps entier sur 3 jours) et des essais ci-dessous. **Aucune revue ni méta-analyse sur la calisthénie pour l'hypertrophie n'a été trouvée**, et la plupart des essais portent sur des hommes jeunes non entraînés ou sur des adultes âgés non entraînés.

### Fiche D08

| Rubrique | Contenu | Source ou ID / niveau de preuve |
|---|---|---|
| Structure | Trois séances de **corps entier** par semaine (Maison A, B, C), avec une paire d'haltères, le poids du corps, un sol, une chaise ou une marche. Chaque séance compte une poussée (pompes, développé d'épaules), un tirage (rowing à un bras), un exercice de cuisses à une jambe (fentes), une charnière de hanche ou un exercice de fessiers, un petit muscle (biceps, triceps, mollets) et du gainage. Construction du dossier : aucune source ne décrit ce programme. | D05-01 (corps entier sur 3 jours) ; construction du dossier ; D08-31 à D08-54 pour les choix d'exercices |
| Séances types | A : pompes, fentes, rowing à un bras, développé d'épaules, élévations latérales, curl, triceps au-dessus de la tête, gainage ventral. B : soulevé jambes tendues aux haltères, fentes, pompes, rowing à un bras, élévations latérales, curl marteau, mollets à une jambe, gainage latéral. C : fentes, hip thrust à l'haltère, soulevé jambes tendues, pompes, rowing, développé d'épaules, élévations latérales, triceps, mollets. | construction du dossier ; D08-35, D08-37, D08-39, D08-40, D08-41, D08-43, D08-45, D08-46, D08-47 |
| Rythme | 3 séances par semaine sur des jours non consécutifs (choix du dossier). Les essais lus utilisent **2 séances par semaine** (pompes, squat au poids du corps, poids du corps et élastique) ou **3 séances** (pompes progressives, squat à tempo lent, charges légères, domicile sur 32 semaines). Durées d'essai : 4 à 14 semaines, une fois 32 semaines. | D08-01, D08-02, D08-06, D08-09, D08-14 à D08-17, D08-22 ; essais contrôlés |
| Public visé | Pratiquants qui n'ont ni salle ni machines. Les essais lus portent sur : hommes jeunes non entraînés (pompes, charges légères), femmes sédentaires jeunes (squat), adultes âgés non entraînés (poids du corps et élastique), adultes avec diabète de type 2 (domicile, 32 semaines). Pour des **avancés**, aucun essai d'hypertrophie au poids du corps n'a été trouvé. | D08-01, D08-06, D08-14, D08-16, D08-19, D08-22 ; D08-03 pour la force d'avancés |
| Avantages | **Pompes et développé couché à charge appariée** : épaisseur du triceps et du grand pectoral en hausse dans les deux cas (n = 18, 8 semaines). **Charge légère menée près de l'échec** : hypertrophie semblable à une charge lourde (n = 25 et n = 18). **Unilatéral ou bilatéral** : pas de différence d'hypertrophie démontrée (imprécis). **Fessiers** : hip thrust et squat ont fait croître le grand fessier de façon semblable (le moyen et le petit fessiers : peu ou pas, dans les deux groupes). **Élastique ou haltère** : force équivalente. | D08-01, D08-14, D08-15, D08-13, D08-31, D08-35, D08-52 ; essais contrôlés, méta-analyses |
| Limites | **Hypertrophie des pompes non établie** : aucun changement significatif d'épaisseur après 4 semaines de pompes progressives chez des hommes moyennement entraînés (n = 23), contre une hausse après 8 semaines à charge appariée (n = 18) ; la durée, l'effort et la progression diffèrent. **Charge légère** : s'arrêter vers 20 répétitions quand l'échec est à 34 a donné un gain faible et non significatif. **Pas de tirage vertical** sans barre fixe. **Aucun essai** sur les pompes lestées ou pieds surélevés, sur le rowing à un bras, le développé au sol ou le triceps à l'haltère. **Élastiques** : résultats opposés sur la masse (adultes âgés). **Les mesures d'EMG** (activation) ne disent pas la croissance. | D08-02, D08-14, D08-43, D08-44, D08-49, D08-19, D08-16, D08-20 ; absence de preuve pour les lignes « non trouvé » |
| Ce que disent les sources | **Pompes** : 15 à 26 répétitions à l'échec en pompe standard chez des entraînés (hommes 25,6 ; femmes 15,5) ; la pompe standard porte environ 64 à 72 % de la masse corporelle ; échelle de 0,41 à 0,74 de la masse selon la variante. **Progression** : 3 × 6 puis +1 répétition par série et par séance, variante plus difficile après 3 × 8 deux séances de suite (4 semaines). **Cuisses** : squat bulgare, fente, montée sur banc et squat sont interchangeables pour l'hypertrophie dans l'état de la preuve (2 essais). **Mollets** : 6, 9 ou 12 séries par semaine à 15-20 répétitions : plus de croissance à 12 qu'à 6 (femmes non entraînées, 6 semaines). **Ischio-jambiers** : soulevé jambes tendues et curl nordique ont fait croître l'ensemble chez des étudiants décrits comme non entraînés en musculation (9 semaines ; chiffres de la prépublication, publiée depuis). **Tempo** : à l'échec, 2 s ou 6 s par répétition donnent la même croissance. | D08-04, D08-05, D08-02, D08-31, D08-41, D08-37, D08-10 |
| Traduction Cyclades | `Programme` à 3 `SeanceType` (corps entier). `BlocPrevu` : charge indicative des pompes en fraction de la masse corporelle (D08-05), répétitions de 8 à 20, séries de 2 à 4. Exercices à ajouter : voir R4. **Le `BlocPrevu` ne porte ni le tempo ni la variante** : la variante de pompes se note à part. Remplacements de matériel : banc → chaise ou sol ; barre fixe → rowing sous une table solide ou à la sangle ; haltères trop légers → unilatéral et plus de répétitions (D08-53, pratique courante). | D08-01 à D08-05, D08-53, D08-54 ; construction du dossier |

#### Échelle de difficulté des pompes (D08-05, charge mécanique, non effet d'entraînement)

| Variante | Fraction de la masse corporelle |
|---|---|
| Mains surélevées de 61 cm | 0,41 ± 0,06 |
| À genoux | 0,49 ± 0,05 |
| Mains surélevées de 30,5 cm | 0,55 ± 0,05 |
| Standard | 0,64 ± 0,04 |
| Pieds surélevés de 30,5 cm | 0,70 ± 0,02 |
| Pieds surélevés de 61 cm | 0,74 ± 0,02 |

*Source : Wurm et coll., 23 adultes jeunes, force maximale de réaction au sol (actes de congrès 2010) ; ancien, force de pic et non charge moyenne d'une répétition. À lire avec D08-04 (64 à 72 % de la masse portée, entraînés) et D08-01 (pompe adaptée à environ 40 % du 1RM du développé couché).*

#### Exercices du modèle Maison et appui de la preuve

| Muscle | Exercice du modèle | Ce que montre la source | ID | Réserve |
|---|---|---|---|---|
| Pectoraux | pompes (variantes) | croissance semblable au développé couché à charge appariée ; pas de hausse en 4 semaines de progression par variantes | D08-01, D08-02 | deux petits essais, résultats opposés |
| Épaules (avant) | développé d'épaules (haltères) | activation du deltoïde antérieur distincte des neuf autres exercices | D08-46 | EMG, mémoire, 2014 ; aucun essai d'hypertrophie |
| Épaules (côté) | élévations latérales (haltères) | équivalentes à la poulie sur l'épaisseur du deltoïde latéral (4 puis 5 séries par bras et par séance, 12 à 16 répétitions, 8 semaines) | D08-45 | entraînés, bras contre bras |
| Dorsaux | rowing à un bras (haltère) | traction et rowing inversé sont les mieux placés à l'EMG ; le rowing à un bras n'est pas mentionné | D08-43, D08-44 | **non testé tel quel** ; EMG seulement |
| Cuisses | fentes (haltères) | fente et squat interchangeables pour l'hypertrophie ; fente plus active pour le grand fessier et le biceps fémoral à l'EMG | D08-31, D08-34 | 2 essais d'hypertrophie, EMG de 7 sujets |
| Ischio-jambiers | soulevé jambes tendues (haltères) | croissance de l'ensemble des ischio-jambiers (+7,0 %) ; forte activation au soulevé jambes tendues | D08-37, D08-39 | prépublication publiée depuis (J Strength Cond Res 2025, résumé seul relu) ; barre non précisée ; haltères non testés |
| Fessiers | hip thrust (haltère) | croissance du grand fessier semblable à celle du squat (moyen et petit fessiers : peu ou pas, dans les deux groupes) ; le squat fait mieux croître quadriceps et adducteurs ; les ischio-jambiers ne grossissent notablement dans aucun groupe | D08-35, D08-36 | essai à la barre, 15 à 17 séances ; haltère non testé |
| Mollets | mollets debout à une jambe (haltère) | 10 à 14 répétitions, 4 à 6 séries par séance, 2 séances par semaine : +8 % ; 12 séries par semaine font mieux que 6 | D08-40, D08-41 | non entraînés ; 6 à 10 semaines |
| Biceps | curl biceps, curl marteau (haltères) | curl incliné ou curl pupitre : régions différentes | D08-48 | jeunes femmes non entraînées ; banc incliné requis |
| Triceps | extension au-dessus de la tête (haltère) | bras au-dessus de la tête : +19,9 % contre +13,9 % (poulie) | D08-47 | **non testé à l'haltère** ; le débat sur la longueur musculaire reste ouvert (H07-13) |
| Abdominaux, obliques | gainage ventral, gainage latéral | planche à bras de levier long et bascule du bassin : plus d'activation | D08-51 | EMG ; aucun essai d'hypertrophie |


#### Fourchettes à retenir, en termes Cyclades (D08)

| Paramètre Cyclades | Valeur ou fourchette | Population / phase | Niveau de preuve | IDs |
|---|---|---|---|---|
| Charge indicative d'un `BlocPrevu` « pompes » (fraction de la masse corporelle) | De 0,41 (mains surélevées de 61 cm) à 0,74 (pieds surélevés de 61 cm) ; standard 0,64 ; à genoux 0,49 ; environ 66 à 72 % de la masse portée en pompe standard | Jeunes adultes actifs (n = 23) ; sujets entraînés (n = 20) | autre : étude biomécanique ; autre : étude expérimentale transversale | D08-04, D08-05 |
| Équivalence pompes et développé couché (charge indicative) | Pompes (position adaptée, par exemple à genoux) à difficulté d'environ 40 % du 1RM du développé couché : épaisseur du triceps et du grand pectoral en hausse en 8 semaines, 2 séances par semaine | Hommes de 19 à 22 ans (n = 18) | essai contrôlé | D08-01 |
| Règle de progression des pompes par variantes | Départ 3 × 6 ; +1 répétition par série et par séance ; variante plus difficile après 3 × 8 tenu deux séances de suite ; 3 séances par semaine ; en 4 semaines, force de pompes en hausse, épaisseur du pectoral inchangée | Hommes moyennement entraînés (n = 23) | essai contrôlé | D08-02 |
| Répétitions d'une série à l'échec en pompe standard | Moyenne 15,5 ± 8,0 (femmes) et 25,6 ± 5,2 (hommes) | Adultes entraînés (n = 20) | autre : étude expérimentale transversale | D08-04 |
| Charge légère (haltères, poids du corps) : proximité de l'échec | Environ 30 % du 1RM menés à l'échec (environ 34 répétitions) : +7,8 % d'aire de section ; arrêt vers 20 répétitions : +2,8 % non significatif ; 3 séries à 30 % du 1RM menées à l'échec : volume musculaire comparable à 3 séries à 80 % | Hommes non entraînés (n = 25 ; n = 18) | essai contrôlé | D08-14, D08-15 |
| Séries par séance et par semaine, exercice au poids du corps | 6 séries par séance, 2 séances par semaine (12 séries par semaine par calcul), squat à 10 niveaux ; ou rampe de 1 à 3 séries par exercice sur 8 semaines | Femmes sédentaires jeunes (n = 13) ; adultes avec diabète de type 2 (n = 120) | essai contrôlé | D08-06, D08-22 |
| Repos entre séries (poids du corps, élastique) | 60 s au départ puis réduit par paliers de 2 semaines ; 120 s dans les essais à 6 séries ou à 32 semaines | Adultes âgés non entraînés (n = 51) ; femmes sédentaires jeunes ; adultes avec diabète | essai contrôlé | D08-17, D08-06, D08-22 |
| Tempo (information, hors modèle) | 3 s / 3 s (poids du corps et élastique ; squat à 50 % du 1RM) ; 2 s / 2 s ; à l'échec, 2 s ou 6 s par répétition donnent la même aire de section (14 contre 7 répétitions en médiane) ; temps sous tension de 20 à 70 s par série (revue) | Hommes jeunes ; adultes âgés ; avis d'experts | essai contrôlé ; consensus d'experts (revue narrative) | D08-06, D08-09, D08-10, D08-12, D08-17 |
| Effort cible à domicile | RPE ≈ 13 en fin de série (échelle de Borg présumée) ; OMNI-RES 5-7 puis 8-10 (échelle de 0 à 10) pour des élastiques sans effet mesuré | Adultes âgés non entraînés | essai contrôlé | D08-17, D08-19 |
| Fréquence par muscle (`parSemaine`) | 2 séances par semaine (pompes, squat, programme poids du corps et élastique) ; 3 séances par semaine (pompes progressives, squat à tempo lent, charges légères, domicile 32 semaines) | Adultes jeunes ou âgés selon l'essai | essai contrôlé | D08-01, D08-02, D08-06, D08-09, D08-15, D08-16, D08-22 |
| Unilatéral ou bilatéral | Choix libre pour l'hypertrophie : effet −0,21 (IC95 % −3,56 à 3,13), estimation imprécise | Adultes, 9 études | méta-analyse | D08-13 |
| Durée de cycle testée | 8 semaines (pompes, charge légère), 12 semaines (poids du corps et élastique ; Nordic hamstring), paliers de progression de 2 semaines | Selon l'essai | essai contrôlé | D08-01, D08-14, D08-16, D08-07, D08-17 |
| `BlocPrevu` élévation latérale à l'haltère : séries et répétitions | 4 puis 5 séries par bras et par séance (calcul : environ 10 par semaine et par épaule), 12 à 16 répétitions menées à l'échec, 2 séances par semaine, 8 semaines | Entraînés (au moins 3 ans), hommes et femmes | essai contrôlé | D08-45 |
| `BlocPrevu` mollets debout à une jambe | 10 à 14 répétitions, 4 à 6 séries par séance (ou 2 à 3 suivies de répétitions partielles allongées), 2 séances par semaine, 10 semaines | Hommes non entraînés | essai contrôlé | D08-40 |
| `ciblesParMuscle` mollets | 6, 9 ou 12 séries par semaine à 15-20 répétitions, 3 séances par semaine, 6 semaines : +6,9 % (6) contre +12,0 % (12) d'épaisseur du triceps sural | Jeunes femmes non entraînées | essai contrôlé | D08-41 |
| `BlocPrevu` fessiers : hip thrust ou squat | 8 à 12 répétitions, 3 (semaine 1), 4, 5 puis 6 séries par séance, 2 séances par semaine, 9 semaines ; croissance des fessiers similaire | Adultes non entraînés | essai contrôlé | D08-35, D08-36 |
| `BlocPrevu` ischio-jambiers : curl nordique ou soulevé jambes tendues | Environ 80 % du 1RM, 3 séances par semaine, 9 semaines ; croissance des ischio-jambiers dans les deux cas (prépublication, publiée depuis en 2025) | Étudiants actifs, décrits comme non entraînés en musculation | essai contrôlé (prépublication, publiée depuis) | D08-37 |
| `BlocPrevu` biceps : curl incliné ou curl pupitre | 8 à 12 répétitions menées à l'échec, 2 séances par semaine, 8 semaines | Jeunes femmes non entraînées | essai contrôlé | D08-48 |
| `BlocPrevu` triceps : extension au-dessus de la tête | 70 % du 1RM, 2 séances par semaine, 12 semaines (poulie) | Adultes | essai contrôlé | D08-47 |
| Unilatéral ou bilatéral (`exercice` des cuisses) | Pas de différence d'hypertrophie significative (ES −0,21, IC95 % −3,56 à 3,13), 2 études ; force spécifique à l'exercice | Divers (9 essais) | méta-analyse | D08-31, D08-32 |
| `BlocPrevu` planche (tronc) | Maintien de 30 secondes dans l'essai d'EMG ; activation, pas hypertrophie | Hommes entraînés | autre : étude mécaniste, activation | D08-51 |
| Sangle ou élastique à la place de l'haltère | Force équivalente (SMD −0,011 haut du corps, 0,09 bas du corps) ; hypertrophie : non trouvé | Divers (8 études) | méta-analyse | D08-52 |

#### Désaccords entre sources (D08)

1. **Pompes : hypertrophie ou non ?** Kikuchi 2017 (D08-01) : épaisseur du triceps et du grand pectoral en hausse après 8 semaines de pompes à charge appariée (40 % du 1RM). Kotarsky 2018 (D08-02) : aucun changement significatif d'épaisseur du pectoral après 4 semaines de pompes progressives (comme au développé couché). Les deux essais sont petits (n = 18 et n = 23) ; la durée, l'effort et la progression diffèrent. Je ne tranche pas.
2. **Tempo.** Usui 2016 (D08-09) : tempo 3 s / 3 s à 50 % du 1RM, 3 × 10 : épaisseur du quadriceps +6 à 10 % contre aucun gain au tempo 1 s / 1 s avec pause. Lacerda 2021 (D08-10), séries à l'échec : 2 s ou 6 s par répétition donnent la même aire de section ; Kojic 2025 (D08-11) : même aire de section du quadriceps entier, vaste latéral plus gros avec l'excentrique lent ; Schoenfeld 2015 (H08-16) : 0,5 à 8 s équivalents. Le résumé de la revue parapluie McLeod (D08-08) se contredit sur la vitesse de contraction. Le point qui ressort : la proximité de l'échec n'est pas connue pour Usui, ce qui interdit de conclure.
3. **Charge légère et échec.** Lasevicius 2022 (D08-14) : à 30 % du 1RM, l'arrêt avant l'échec (environ 20 répétitions) donne +2,8 % non significatif contre +7,8 % à l'échec. ACSM 2026 (H04-07) et la méta-analyse H04-01 : l'échec n'a pas d'effet constant ou seulement trivial. Les deux sont compatibles si l'on retient que, en charge légère, des séries très éloignées de l'échec sont risquées pour la croissance (un seul essai, hommes non entraînés, machine).
4. **Élastiques.** Ozaki 2020 (D08-16) : épaisseur en hausse avec poids du corps et élastique en 12 semaines, sans groupe témoin ; Martins 2015 (D08-19) : aucun gain de masse maigre avec des élastiques en 8 semaines, avec un groupe témoin ; Lopes 2020 (D08-20) : masse maigre comparable aux dispositifs conventionnels, mais avec un intervalle large et des statistiques incohérentes. Lima 2018 (D08-21) : force comparable, hypertrophie non mesurée.
5. **Supervision.** Ozaki 2020 (D08-18) : plus de croissance avec une supervision complète qu'avec une séance sur deux à domicile ; force et fonction semblables. Aucune autre source lue ne permet de recouper chez des adultes jeunes.
6. **Unilatéral.** Kassiano 2025 (D08-13) : pas de différence d'hypertrophie démontrée, mais intervalle de confiance très large ; ce n'est pas une preuve d'équivalence.

| Sujet | Position 1 | Position 2 | IDs |
|---|---|---|---|
| Unilatéral ou bilatéral pour l'hypertrophie | Pas de différence d'hypertrophie (méta-analyse de Kassiano 2025, 2 études, modèle instable) | Le résumé cite des voix qui jugent l'unilatéral supérieur, sans les nommer : sources non lues | D08-31, D08-32 |
| Quel dos pour le grand dorsal | Traction et traction en supination les plus actives (Edelburg 2017, 19 hommes) | Rowing inversé le plus actif parmi les variantes de rowing (Fenwick 2009, 7 hommes, rapporté par Di Fonza 2026) ; deux comparaisons d'EMG différentes, pas strictement contradictoires | D08-43, D08-44 |
| Abdominaux : sélectivité haut et bas du droit de l'abdomen | Activation préférentielle des segments selon l'exercice (Gomirato 2023) | Pas de différence haut et bas, aucun exercice sélectif (Kim 2015) | D08-50 |
| Charges légères sur les mollets | Charges faibles menées à l'échec : hypertrophie semblable aux charges élevées (H03-01, H03-02, H03-06) | 30 % du 1RM sans échec, tour de mollet inchangé en 8 semaines (Gavanda 2024) ; protocole et mesure différents | D08-42 |
| Longueur musculaire et triceps | Bras au-dessus de la tête : triceps entier +19,9 % contre +13,9 % (Maeo 2022, via H07-11) | Effet moyen de la longueur musculaire trivial sur l'hypertrophie régionale (H07-13) | D08-47 |
| Hip thrust contre squat : EMG et croissance | Piste, non lue : un blog cite un essai d'EMG (Neto 2019) où le hip thrust donnerait la plus haute activité du grand fessier, devant le soulevé jambes tendues et le squat | Croissance des fessiers semblable (Plotkin 2023, IRM, 9 semaines) ; le squat fait en plus croître quadriceps et adducteurs | D08-35, D08-36 |

Les fourchettes retenues par les deux agents de recherche, leurs désaccords et leurs pistes non confirmées sont reprises ci-dessous. Les 46 règles sourcées D08 sont dans `02-decoupages.md` et dans le CSV.

### 7.2 D09 — Spécialisation d'un muscle en retard

Aucune source lue ne teste une « phase de spécialisation » sous ce nom : un muscle en retard à volume relevé, les autres réduits, la masse mesurée (D09-01). Ce qui existe : quatre essais qui comparent deux ou trois volumes **sur un même muscle** (D09-02 à D09-05, de 6 à 12 semaines, résultats mitigés), des essais de maintien à volume réduit (D09-21, H10-08) et trois pages de coachs qui donnent des chiffres de terrain (D09-07 à D09-12, D09-18, D09-19). Les chiffres de terrain sont marqués comme tels et ne sont pas des preuves. Deux sources sont fragiles : un résumé de congrès (D09-02) et une prépublication sans version publiée trouvée (D09-03). D09-04, prépublication de 2019, a une version publiée (J Physiol, 2020) dont le résumé donne les mêmes chiffres.

### Fiche D09

| Rubrique | Contenu | Source ou ID / niveau de preuve |
|---|---|---|
| Structure | Une phase où **un muscle visé** (parfois deux) reçoit plus de séries que sa cible habituelle, répartis sur 2 à 3 séances par semaine, pendant que les **autres muscles** passent à un volume d'entretien. Elle se greffe sur un découpage existant, elle n'en est pas un (déduction). Aucune étude lue ne teste cet ensemble. | D09-01, D09-07, D09-09 à D09-12 ; pratique de terrain, absence de preuve directe |
| Séances types | Pas de séance propre : le muscle visé est ajouté à 2 ou 3 séances du découpage, avec 1 à 3 exercices dont **un d'isolation au minimum**. Exemples de terrain : pectoraux 3 séances de 6 séries (18 par semaine) et épaules (côté) 3 séances de 4 séries (12) chez Alpha Progression ; bras 3 jours par semaine, un exercice par muscle et par jour chez RP Strength. | D09-07, D09-08 ; pratique de terrain |
| Rythme | **2 à 3 passages par semaine** pour le muscle visé, au plus environ 10 séries pondérées par muscle et par séance. Autres muscles : 2 passages de « maintien » (RP) ou 1 à 2 passages (essai de maintien). Blocs de **4 à 6 semaines** suivis d'**une semaine de déload**, 1 à 2 cycles de focus. Les essais lus durent 6 à 12 semaines. | D09-07, D09-11, D09-15, D09-18, D09-19, D09-21, D03-06, H01-19 ; pratique de terrain, essais contrôlés |
| Public visé | Les pages de coachs réservent la spécialisation aux **personnes avancées, hors déficit calorique**. Les essais lus portent sur des personnes entraînées (coude, biceps), entraînées de loisir (cuisse) et non entraînées (cuisse). Aucune source lue ne vise une personne dont le retard est mesuré. | D09-26 (terrain) ; D09-02, D09-03, D09-04, D09-05 (essais) |
| Combien de séries ajouter | **Terrain** : environ +50 % (pectoraux 12 → 18, épaules (côté) 8 → 12) ; sur les bras, RP monte de 12 à 21, puis de 16 à 25, puis de 21 à 30 séries par semaine (non démontré). **Essais** : volume relevé sur le coude (exemple du résumé : +2 séries par séance, soit +4 par semaine) sans gain d'épaisseur chez 42 entraînés (résumé de congrès) ; 16 contre 8 séries sur la cuisse, avantage détectable pour l'hypertrophie mais pas pour la force (prépublication) ; 9, 18 ou 27 séries de biceps sans différence de masse. **Norme de revue** : 12 à 20 séries par semaine, davantage seulement pour le triceps. | D09-09, D09-10 (terrain) ; D09-02, D09-03, D09-04, D09-05 (essais) ; H01-09, H01-10 |
| Combien de temps | Essais : 6 à 12 semaines. Terrain : blocs de 4 à 6 semaines, chacun suivi d'une semaine de déload ; RP annonce « 3 à 4 mois » pour trois blocs (15 à 21 semaines par calcul du dossier) ; Alpha conseille 1 à 2 cycles de focus puis de passer à d'autres muscles, la longueur du cycle n'étant pas donnée. Aucun essai ne compare plusieurs durées. | D09-15, D09-18, D09-19 ; essais contrôlés, pratique de terrain |
| Réduire ailleurs | RP : environ **4 séries difficiles par muscle et par semaine**, en 2 passages. Alpha : **−2 séries** sur chacun de cinq muscles pour financer +10 séries. Un essai sur des non entraînés : **environ −50 à −57 % du volume-charge** pendant 8 semaines n'a pas changé significativement la taille du quadriceps (pas de test d'équivalence). Plancher des revues de maintien : 1 séance par semaine, 1 série par exercice, charge conservée (jeune adulte). | D09-11, D09-12, D09-21, H10-08, H10-10 ; pratique de terrain, essai contrôlé, consensus d'experts |
| Fin de phase | Retour du muscle visé vers sa cible habituelle ; Alpha note que 8 séries de pectoraux peuvent suffire à maintenir une masse acquise avec 18. Le passage progressif de l'un à l'autre n'est testé nulle part. | D09-20, H10-08, H13-06 ; pratique de terrain |
| Avantages | Un volume plus haut sur un muscle peut donner un petit avantage de masse (cuisse : 16 contre 8 séries ; non entraînés : 3 contre 1 série par exercice). Le financement par des baisses ailleurs garde la semaine à peu près de même longueur (déduction à partir de D09-12). | D09-03 (prépublication), D09-04 (prépublication publiée en 2020) ; D09-12 ; niveau faible |
| Limites | **Aucune étude directe.** Résultats mitigés : un volume relevé n'a rien changé chez des entraînés (résumé de congrès ; exemple : +2 séries par séance), +50 % de séries non plus chez des athlètes de force (H01-13). Aucun plafond du volume total sourcé, aucune donnée sur l'effet de la hausse d'un muscle sur la récupération des autres, aucune règle haut/bas du corps, rien de chiffré sur les articulations. Le délai pour voir un résultat n'est pas connu chez les entraînés. | D09-02, D09-22, D09-23, D09-25, D09-16, D09-17, H01-13 ; absence de preuve |
| Ce que disent les sources | **Dose-réponse** : la courbe de l'hypertrophie monte avec le volume avec des rendements décroissants (H01-05 à H01-08) ; elle n'est pas démontrée au-delà de 12 à 20 séries par muscle (H01-09, H01-10). **Comptage** : une série indirecte compte pour 0,5 (H01-22) ; estimation exploratoire à 0,32 (H01-24). **Fréquence** : à volume égal, effet négligeable sur l'hypertrophie (H02-04) ; elle sert ici à tenir le plafond par séance. **Échec** : RP finit chaque bloc à 0 RIR ; une méta-analyse ne voit qu'un avantage trivial de l'échec (H04-01). **Variété** : au moins un exercice d'isolation, pas de variation au hasard (D09-08, D09-13, H07-15). | D09-06 à D09-08, D09-13, D09-14, H01-05 à H01-10, H01-22, H01-24, H02-04, H04-01, H07-15 |
| Traduction Cyclades | Pas de phase « spécialisation » parmi prise de masse, sèche, maintien, déload, reprise (D09-01). Elle se traduit par un `Programme` dont `ciblesParMuscle` est **relevée sur le muscle visé** et **abaissée sur les autres**, avec une durée en semaines, un déload en fin de bloc et un retour à la cible habituelle. Pas d'effet sur `BlocPrevu`. À proposer en `prise de masse` ou en `maintien`, pas en `sèche` (conseil de terrain). Valeurs de ce dossier : voir la recette ci-dessous. | D09-01, D09-09 à D09-12, D09-19, D09-26 ; choix du dossier |

#### Recette proposée par le dossier (choix, non preuve)

| Étape | Règle | Valeur | Fondement |
|---|---|---|---|
| 1. Choisir | Un muscle visé à la fois (deux au plus) ; pas en `sèche` | 1 | D09-26 ; pratique de terrain |
| 2. Relever la cible | Base hebdomadaire du muscle + 4 à 6 séries pondérées (environ +50 % d'une base de 8 à 12) | environ 12 à 18 ; 20 au plus par défaut | D09-09 (terrain), H01-09 (norme de revue) |
| 3. Répartir | 2 à 3 passages par semaine, au plus environ 10 séries pondérées par muscle et par séance | 2 à 3 passages | D09-07, D03-06, H01-19 |
| 4. Choisir les exercices | 1 à 3 exercices du muscle ; au moins un d'isolation ; garder 3 à 4 séries par exercice et ajouter un exercice ou un passage plutôt que d'allonger un seul exercice | 1 à 3 | D09-08, D09-13 |
| 5. Financer | Retirer 1 à 2 séries sur 3 à 5 autres muscles déjà bien fournis, en laissant chacun à environ 4 séries pondérées ou plus ; aucune règle sourcée entre haut et bas du corps | −1 à −2 séries par muscle | D09-11, D09-12, D09-21, D09-23, H01-06 |
| 6. Durée | 6 semaines, puis une semaine de déload ; renouvelable une fois, puis retour aux cibles habituelles | 6 + 1 semaines | D09-15, D09-18, D09-19, H09-12 |
| 7. Proximité de l'échec | Commencer à 2-3 RIR, finir à 1 RIR ou moins ; l'échec n'est pas requis | RIR 3 → 1 | D09-14, H04-01, H04-09 |
| 8. Retour | Cible habituelle du muscle ; ne pas descendre sous 8 séries par semaine avec charge conservée pour garder la masse (repère de terrain) | 8 séries | D09-20, H10-08 |
| 9. Garde-fous | Écarter ou alléger si une articulation ou un tendon du muscle visé est déjà en cause ; exercices sans douleur articulaire | — | D09-25 ; options, jamais obligations |

L'exemple chiffré est le modèle M7 (§ 8.7) : épaules (côté) de 6 à 11 séries par semaine, financées par −2,5 pour les biceps, −1 pour les dorsaux, −1 pour les mollets et −1 pour les abdominaux.


#### Fourchettes à retenir, en termes Cyclades (D09)

| Paramètre Cyclades | Valeur ou fourchette | Population / phase | Niveau de preuve | IDs |
|---|---|---|---|---|
| `ciblesParMuscle` du muscle visé (relèvement) | de +4 à +6 séries par semaine sur une base de 8 à 12, soit environ 12 à 18 ; essais : volume relevé (exemple : +4 séries par semaine, coude) sans gain d'épaisseur, 8 contre 16 (cuisse) petit avantage, 9 / 18 / 27 (biceps) sans différence significative de masse | entraînés ou entraînés de loisir ; prise de masse ou maintien | essai contrôlé (3 essais, 6 à 12 semaines) ; pratique de terrain pour le +50 % | D09-02, D09-03, D09-05, D09-09 |
| `ciblesParMuscle` du muscle visé (haut de fourchette) | jusqu'à environ 20 séries par semaine (norme de revue) ; 21 à 30 sur un petit muscle du bras en pratique de terrain, non démontré | entraînés ; petit muscle | revue systématique (7 études, 19 groupes) ; pratique de terrain | D09-10, H01-09, H01-10 |
| `ciblesParMuscle` des autres muscles (réduction) | environ 4 séries par semaine en 2 passages (RP) ; −2 séries par muscle (Alpha) ; environ la moitié du volume habituel a préservé la taille du quadriceps en 8 semaines (non entraînés) | muscles non visés ; `maintien` | pratique de terrain ; essai contrôlé (n=33, 8 semaines de réduction) | D09-11, D09-12, D09-21 |
| Plancher de maintien des autres muscles | 1 séance par semaine, 1 série par exercice, charge conservée | jeune adulte ; `maintien` | consensus d'experts (revue narrative) | H10-08, H10-10, D09-11 |
| `parSemaine` / passages du muscle visé | 2 à 3 séances par semaine, au plus environ 10 séries pondérées par muscle et par séance | entraînés | pratique de terrain ; prise de position (IUSCA) pour le plafond | D09-07, D03-06, H01-19 |
| Coefficient secondaire | 0,5 pour compter l'indirect dans le total du muscle visé | hypertrophie | méta-analyse (méta-régression, prépublication) | D09-06, H01-22 |
| Durée d'une spécialisation (`Programme`) | 6 à 12 semaines si l'on suit les essais ; blocs de 4 à 6 semaines suivis d'une semaine de déload, 1 à 2 cycles (terrain) | entraînés | essai contrôlé (4 essais) ; pratique de terrain | D09-15, D09-18, D09-19 |
| Déload entre blocs | 1 semaine à la fin de chaque bloc de 4 à 6 semaines | phase `déload` | pratique de terrain ; enquête auprès d'entraîneurs | D09-19, H09-12 |
| Choix des exercices du muscle visé | 1 à 3 exercices par muscle, variante allongée en option, pas de variation aléatoire | entraînés | pratique de terrain ; revue systématique (k=8) | D09-08, D09-13, H07-15 |
| Phase | spécialiser en `prise de masse` ou `maintien`, pas en `sèche` | avancés (suggéré) | pratique de terrain | D09-26 |
| Délai de résultat | pas de date annoncée : environ 8 % de surface en 10 semaines (jeunes hommes), gains détectables dès 7 séances chez des non entraînés | non entraînés ; jeunes hommes | essais (n=13, n=14) | D09-16, D09-17 |

#### Désaccords entre sources (D09)

1. **Faut-il monter le volume du muscle en retard ?** Pour : Robinson 2025, 16 contre 8 séries, petit avantage sur la cuisse, prépublication (D09-03) ; Hammarström 2019, 3 contre 1 série par exercice, non entraînés, prépublication de 2019 publiée en 2020 (D09-04). Contre ou neutre : Moreno 2024, volume relevé sur le coude (exemple du résumé : +2 séries par séance) sans écart de masse chez 42 entraînés, résumé de congrès (D09-02) ; Heaselgrave 2019, aucune différence de masse entre 9, 18 et 27 séries de biceps (D09-05) ; Räntilä 2026, +50 % de séries sans gain de taille chez des athlètes entraînés (H01-13). Les petits essais, les muscles (jambe, bras) et les populations diffèrent.
2. **Jusqu'où monter (plafond).** Norme de 12 à 20 séries par semaine et par muscle, davantage seulement pour le triceps (Baz-Valle 2022, H01-09, H01-10) ; maximum de 18 séries pour le triceps sur l'ancienne page RP de 2017 (H01-26) contre 21 à 30 séries pour les bras sur la page RP de 2025 (D09-10) ; pas de plateau net chez Pelland (H01-08) ; plafond par séance d'environ 10 séries (IUSCA, D03-06) ou 11 séries pondérées (H01-19).
3. **Ampleur de la réduction ailleurs.** RP : environ 4 séries par muscle et par semaine (D09-11) ; Alpha : seulement −2 séries par muscle (D09-12) ; Tavares : environ −50 % du volume-charge (D09-21) ; revues de maintien : 1 séance, 1 série par exercice avec charge conservée (H10-08). Ces chiffres ne se contredisent pas sur le résultat (maintien) mais ne décrivent pas le même point de départ.
4. **Échec ou non pendant la phase.** RP monte jusqu'à 0 RIR en fin de mésocycle (D09-14) ; une méta-analyse ne trouve qu'un avantage trivial de l'échec pour l'hypertrophie et l'ACSM 2026 pas d'effet constant (H04-01, H04-07) ; l'échec alourdit la fatigue (H04-09, H04-10).
5. **Variété d'exercices.** Henselmans 2026 : très peu de bénéfice de la variété au-delà d'un exercice d'isolation (D09-13) ; revue de Kassiano : une variation systématique peut aider, une variation aléatoire nuire (H07-15) ; RP : 3 exercices par muscle (D09-08) ; méta-analyse de 2025 sur la longueur musculaire : écarts régionaux triviaux (H07-13) contre des essais précis sur le triceps et les mollets (H07-11, H07-12).
6. **Fréquence.** À volume égal, effet négligeable sur l'hypertrophie (H02-04, H02-05) contre 2 à 3 séances par semaine sur les pages de terrain (D09-07) : les deux sont compatibles si la fréquence sert à tenir le plafond par séance.
7. **Effectif de Heaselgrave 2019.** 49 participants sur la page de l'université de Birmingham contre 51 dans le tableau de Baz-Valle 2022 (D09-05) ; je retiens 49 (page de l'essai) et signale l'écart.

Les fourchettes retenues par l'agent de recherche, les désaccords entre sources et les pistes non confirmées de D09 sont reprises ci-dessous. Les 26 règles sourcées D09-01 à D09-26 sont dans `02-decoupages.md` et dans le CSV.

## 8. R3 — Les modèles

Sept modèles : les six imposés (PPL 3 jours, PPL 6 jours, Haut/Bas 4 jours, Full body 3 jours, Full body 2 jours, Maison 3 jours) et **un septième, une spécialisation** (Haut/Bas 4 jours avec un bloc sur les épaules (côté)).

**Pourquoi une spécialisation ?** Elle est défendable comme **module optionnel**, pas comme modèle de base : D09 donne des chiffres de terrain cohérents entre deux coachs (+50 %, 2 à 3 passages, blocs de 4 à 6 semaines, D09-09 à D09-12, D09-19) et des bornes sourcées pour les encadrer (norme de revue de 12 à 20 séries, plancher de maintien, H01-09, H10-08). Mais **aucune étude ne teste cette phase** (D09-01) ; le modèle est donc marqué à preuve faible et se lit comme un exemple de la recette de la fiche D09.

**Pourquoi pas de découpage par groupe musculaire (« bro split ») ?** Il est documenté (D06-01) mais il donne un seul passage par muscle et par semaine, sous le plancher de 2 jours de l'ACSM 2026 (D01-04, D06-14), avec des séances de 60 à 75 minutes ; il n'apporte rien que le PPL 3 jours (M1) ne montre déjà. Aucune étude lue ne le recommande pour l'hypertrophie contre un autre découpage (D06-03 à D06-05, D07). Les hybrides et le torse/membres (D06-b, D06-c) ont moins de sources encore. Si la personne en veut un, la structure de M1 en donne la base.


### M1 — Poussée / Tirage / Jambes, 3 jours

| Rubrique | Contenu |
|---|---|
| Nom | Poussée / Tirage / Jambes, 3 jours |
| Description | Trois séances par semaine : Poussée (pectoraux, épaules, triceps), Tirage (dos, arrière des épaules, biceps) et Jambes. Chaque muscle est travaillé **une seule fois par semaine** : le volume hebdomadaire d'un muscle repose donc sur une seule séance, ce qui le rapproche du plafond d'environ 10 à 11 séries par séance (triceps, biceps, fessiers). |
| Public | Novices avancés et intermédiaires qui ne disposent que de trois séances par semaine. L'ACSM 2009 place 3 jours par semaine dans la plage des novices (2 à 3) et des intermédiaires (D01-03). |
| Séances par semaine (`parSemaine`) | 3 |
| Séries de travail par semaine | 68 |
| Durée estimée par séance (hors échauffement ; calcul simple : 40 s par série plus repos) | 54 / 50 / 63 min |
| Équipement | salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe |
| Découpage documenté dans | D01 |

**Ce que disent les sources de ce découpage.** Structure : D01-01 (pratique de terrain). Plage de l'ACSM 2009 : D01-03. Plancher de 2 jours par muscle de l'ACSM 2026 : D01-04 ; **ce modèle est en dessous** (1 passage), alors qu'à volume égal la fréquence n'a pas d'effet mesuré sur l'hypertrophie (D01-06, D01-07) et qu'un essai de 20 hommes entraînés compare 1 et 3 passages (D01-08). Le dossier ne trouve aucune étude qui compare le PPL à un autre découpage (D01, D07).

**Limites.** 1 passage par muscle et par semaine (sous le repère ≥ 2 jours, D01-04, D06-14) ; séances de 21 à 25 séries ; triceps à 10,5 séries dans une séance (au plafond d'environ 10 à 11, H01-19). Les muscles de petite taille (mollets, trapèzes, adducteurs) restent sous 10 séries.

#### Séance « Poussée » (22 séries, environ 54 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | développé couché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 2 | développé incliné (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 3 | dips (barres parallèles) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 4 | développé militaire (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 5 | élévations latérales (haltères) | 5 | 12 | 20 | 75 | 1-2 | 3 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 6 | extension triceps à la poulie | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06, H07-11 | Si la variante existe, bras au-dessus de la tête (H07-11). |
| 7 | gainage latéral | 2 | 30 | 60 | 60 | — | 1 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. Une série = les deux côtés faits (compte pour 1 série). |

#### Séance « Tirage » (21 séries, environ 50 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | tractions pronation (barre fixe) | 4 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05 |  |
| 2 | rowing buste penché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01 |  |
| 3 | tirage horizontal (poulie) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-07 |  |
| 4 | oiseau (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |
| 5 | curl biceps (haltères) | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |
| 6 | curl marteau (haltères) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |
| 7 | relevés de jambes suspendu (barre fixe) | 3 | 8 | 15 | 60 | 1-2 | 2 série(s), RIR 3-4 | RIR : H04-01 ; choix : D08-50 |  |

#### Séance « Jambes » (25 séries, environ 63 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | squat (barre) | 4 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09 |  |
| 2 | soulevé de terre jambes tendues (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-39 |  |
| 3 | presse à cuisses | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-07, H07-08 |  |
| 4 | fentes (haltères) | 2 | 8 | 12 | 120 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09, D08-31, D08-34 | Une série = les deux côtés faits (compte pour 1 série). |
| 5 | hip thrust (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-35, D08-36 |  |
| 6 | leg curl | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-11 | Assis plutôt que couché si l'appareil le permet (H07-11). |
| 7 | mollets debout (machine) | 5 | 10 | 20 | 90 | 1-2 | 3 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |
| 8 | gainage ventral | 2 | 30 | 60 | 60 | — | 1 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. |

#### Cibles hebdomadaires de séries par muscle (`ciblesParMuscle`), calculées

| Muscle | Calcul (séries × coefficient) | Cible hebdomadaire (séries) | Passages par semaine | Maximum dans une séance | Position face au dossier | Alerte |
|---|---|---|---|---|---|---|
| pectoraux | développé couché 3×1 + développé incliné 3×1 + dips 3×1 | 9 | 1 | 9 | entre le minimum et le repère (≈ 10) | 1 passage par semaine, sous le repère ≥ 2 jours |
| épaules (avant) | développé couché 3×0,5 + développé incliné 3×0,5 + dips 3×0,5 + développé militaire 3×1 | 7,5 | 1 | 7,5 | entre le minimum et le repère (≈ 10) | 1 passage par semaine, sous le repère ≥ 2 jours |
| épaules (côté) | développé militaire 3×0,5 + élévations latérales 5×1 | 6,5 | 1 | 6,5 | entre le minimum et le repère (≈ 10) | 1 passage par semaine, sous le repère ≥ 2 jours |
| épaules (arrière) | rowing buste penché 3×0,5 + tirage horizontal 3×0,5 + oiseau 3×1 | 6 | 1 | 6 | entre le minimum et le repère (≈ 10) | 1 passage par semaine, sous le repère ≥ 2 jours |
| biceps | tractions pronation 4×0,5 + rowing buste penché 3×0,5 + tirage horizontal 3×0,5 + curl biceps 3×1 + curl marteau 2×1 | 10 | 1 | 10 | dans le repère (≈ 10 à 12) | 1 passage par semaine, sous le repère ≥ 2 jours |
| triceps | développé couché 3×0,5 + développé incliné 3×0,5 + dips 3×1 + développé militaire 3×0,5 + extension triceps à la poulie 3×1 | 10,5 | 1 | 10,5 | dans le repère (≈ 10 à 12) | 1 passage par semaine, sous le repère ≥ 2 jours ; au plafond de ≈ 10-11 par séance |
| avant-bras | curl biceps 3×0,5 + curl marteau 2×0,5 | 2,5 | 1 | 2,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| dorsaux | tractions pronation 4×1 + rowing buste penché 3×1 + tirage horizontal 3×1 | 10 | 1 | 10 | dans le repère (≈ 10 à 12) | 1 passage par semaine, sous le repère ≥ 2 jours |
| trapèzes | rowing buste penché 3×0,5 + tirage horizontal 3×0,5 + oiseau 3×0,5 | 4,5 | 1 | 4,5 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| lombaires | SDT jambes tendues (barre) 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| abdominaux | gainage latéral 2×0,5 + relevés de jambes suspendu 3×1 + gainage ventral 2×1 | 6 | 3 | 3 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| obliques | gainage latéral 2×1 + gainage ventral 2×0,5 | 3 | 2 | 2 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| quadriceps | squat 4×1 + presse à cuisses 3×1 + fentes 2×1 | 9 | 1 | 9 | entre le minimum et le repère (≈ 10) | 1 passage par semaine, sous le repère ≥ 2 jours |
| ischio-jambiers | SDT jambes tendues (barre) 3×1 + hip thrust 3×0,5 + leg curl 3×1 | 7,5 | 1 | 7,5 | entre le minimum et le repère (≈ 10) | 1 passage par semaine, sous le repère ≥ 2 jours |
| fessiers | squat 4×0,5 + SDT jambes tendues (barre) 3×0,5 + presse à cuisses 3×0,5 + fentes 2×0,5 + hip thrust 3×1 | 9 | 1 | 9 | entre le minimum et le repère (≈ 10) | 1 passage par semaine, sous le repère ≥ 2 jours |
| adducteurs | squat 4×0,5 + presse à cuisses 3×0,5 + fentes 2×0,5 | 4,5 | 1 | 4,5 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| mollets | mollets debout 5×1 | 5 | 1 | 5 | entre le minimum et le repère (≈ 10) | 1 passage par semaine, sous le repère ≥ 2 jours |
| cou | aucun exercice | 0 | 0 | 0 | non programmé (aucun repère propre à ce muscle : non trouvé) | — |

*Repères : minimum ≈ 4 séries fractionnées (H01-06) ; repère ≈ 10 (H01-14) ; 12 à 20 (H01-09) ; ≈ 10 à 11 par séance (H01-19, D03-06) ; ≥ 2 passages (H01-14, D01-04) ; à volume égal, la fréquence n'a pas d'effet mesuré sur l'hypertrophie (H02-02, H01-20).*

**Ce qui sort des fourchettes du dossier.**

| Critère | Muscles concernés |
|---|---|
| Sous le minimum d'environ 4 séries (H01-06) | avant-bras (2,5), lombaires (1,5), obliques (3), cou (0) |
| Grand groupe entre 4 et 10 séries, sous le repère d'environ 10 (H01-14) | pectoraux (9), épaules (avant) (7,5), épaules (côté) (6,5), épaules (arrière) (6), quadriceps (9), ischio-jambiers (7,5), fessiers (9), mollets (5) |
| Au-dessus de 12 séries (plage 12 à 20 de H01-09) | aucun |
| Plus de 10 séries pondérées dans une séance (H01-19, D03-06) | triceps (10,5) |
| Un seul passage par semaine pour un grand groupe, sous le repère ≥ 2 jours (D01-04) | pectoraux, épaules (avant), épaules (côté), épaules (arrière), biceps, triceps, dorsaux, quadriceps, ischio-jambiers, fessiers, mollets |

**Sensibilité à la convention de muscles.** Si la bibliothèque réelle classe les fessiers en muscle **principal** au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 9 à 13,5 séries par semaine ; les autres cibles ne changent pas.

**Progression.** Double progression, *pratique de terrain non démontrée* (H06-02) : voir le point 4.

**Déload type.** Pratique d'entraîneurs (H09-12, H09-13) et consensus sur la forme (H09-10, H09-11) : voir le point 5 ; la colonne « Déload » de chaque tableau de séance donne les séries et le RIR.

#### Exercices du modèle

| Exercice | Statut | Équipement | Muscles principaux (×1) | Muscles secondaires (×0,5) | Unilatéral | Remplaçants (autre équipement ; gêne articulaire courante) |
|---|---|---|---|---|---|---|
| développé couché (barre) | déjà présent | barre, banc | pectoraux | épaules (avant), triceps | non | autre équipement : développé incliné (haltères) si pas de barre ni de support ; gêne articulaire courante : développé incliné (haltères), prise libre |
| développé incliné (haltères) | déjà présent | haltères, banc incliné | pectoraux | épaules (avant), triceps | non | autre équipement : développé couché (barre) sans haltères lourds ; gêne articulaire courante : écarté couché (haltères), amplitude réduite |
| dips (barres parallèles) | déjà présent | barres parallèles | pectoraux, triceps | épaules (avant) | non | autre équipement : développé incliné (haltères) sans barres parallèles ; gêne articulaire courante : extension triceps à la poulie |
| développé militaire (barre) | déjà présent | barre | épaules (avant) | épaules (côté), triceps | non | autre équipement : développé incliné (haltères) ; gêne articulaire courante : élévations latérales (haltères) |
| élévations latérales (haltères) | déjà présent | haltères | épaules (côté) | — | non | autre équipement : pas d'équivalent présent (l'exercice peut se faire à la poulie : variante non présente) ; gêne articulaire courante : développé militaire (barre), en secondaire |
| extension triceps à la poulie | déjà présent | poulie | triceps | — | non | autre équipement : barre au front (barre EZ) ; gêne articulaire courante : dips (barres parallèles) en secondaire |
| gainage latéral | déjà présent | poids du corps | obliques | abdominaux | oui | gainage ventral (autre équipement et gêne articulaire) |
| tractions pronation (barre fixe) | déjà présent | barre fixe | dorsaux | biceps | non | autre équipement : tirage vertical (poulie) sans barre fixe ; gêne articulaire courante : rowing buste penché (barre) |
| rowing buste penché (barre) | déjà présent | barre | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : tirage vertical (poulie), buste soutenu |
| tirage horizontal (poulie) | déjà présent | poulie basse | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : rowing buste penché (barre) ; gêne articulaire courante : tirage vertical (poulie) |
| oiseau (haltères) | déjà présent | haltères | épaules (arrière) | trapèzes | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : — |
| curl biceps (haltères) | déjà présent | haltères | biceps | avant-bras | non | autre équipement : curl marteau (haltères) ; gêne articulaire courante : curl marteau (haltères), prise neutre |
| curl marteau (haltères) | déjà présent | haltères | biceps | avant-bras | non | curl biceps (haltères) (autre équipement et gêne articulaire) |
| relevés de jambes suspendu (barre fixe) | déjà présent | barre fixe | abdominaux | — | non | autre équipement : gainage ventral sans barre fixe ; gêne articulaire courante : gainage ventral |
| squat (barre) | déjà présent | barre, support | quadriceps | fessiers, adducteurs | non | autre équipement : presse à cuisses ; gêne articulaire courante : fentes (haltères) ou presse à cuisses |
| soulevé de terre jambes tendues (barre) | déjà présent | barre | ischio-jambiers | fessiers, lombaires | non | autre équipement : hip thrust (barre) ; gêne articulaire courante : leg curl |
| presse à cuisses | déjà présent | machine | quadriceps | fessiers, adducteurs | non | autre équipement : squat (barre) ; gêne articulaire courante : fentes (haltères) |
| fentes (haltères) | déjà présent | haltères | quadriceps | fessiers, adducteurs | oui | autre équipement : presse à cuisses ; gêne articulaire courante : presse à cuisses, charge réduite |
| hip thrust (barre) | déjà présent | barre, banc | fessiers | ischio-jambiers | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : fentes (haltères) |
| leg curl | déjà présent | machine | ischio-jambiers | — | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : — |
| mollets debout (machine) | déjà présent | machine | mollets | — | non | autre équipement : mollets debout à une jambe (haltère) sans machine, à ajouter ; gêne articulaire courante : — |
| gainage ventral | déjà présent | poids du corps | abdominaux | obliques | non | autre équipement : gainage latéral ; gêne articulaire courante : relevés de jambes suspendu (barre fixe) |

*Remplaçants : pratique de terrain, aucune preuve citée ; seuls les exercices déjà présents sont proposés, sauf mention « à ajouter ». « Gêne articulaire courante » ne veut dire ni diagnostic ni prescription : l'application propose une autre façon de solliciter le muscle, la personne choisit.*

---

### M2 — Poussée / Tirage / Jambes, 6 jours

| Rubrique | Contenu |
|---|---|
| Nom | Poussée / Tirage / Jambes, 6 jours |
| Description | Six séances : Poussée A, Tirage A, Jambes A, puis Poussée B, Tirage B, Jambes B. Chaque muscle est travaillé **deux fois par semaine**. Les séances A utilisent surtout des barres libres et des polyarticulaires (fourchettes de répétitions plus basses) ; les séances B ajoutent des variantes aux haltères, à la poulie et aux machines. Chaque séance dure 31 à 42 minutes environ (12 à 18 séries). |
| Public | Intermédiaires et avancés qui disposent de six jours. Six jours dépassent la plage de 4 à 5 jours des avancés de l'ACSM 2009 (D02-03) ; l'ACSM 2026 demande au moins 2 passages par grand groupe, ce que fait ce modèle (D02-04). Option de rotation « trois jours puis un repos » (D02-02). |
| Séances par semaine (`parSemaine`) | 6 |
| Séries de travail par semaine | 89 |
| Durée estimée par séance (hors échauffement ; calcul simple : 40 s par série plus repos) | 29 / 35 / 41 / 30 / 33 / 45 min |
| Équipement | salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe |
| Découpage documenté dans | D02 |

**Ce que disent les sources de ce découpage.** Structure : D02-01, D02-02 (pratique de terrain). Trois contre six séances par semaine à volume égalisé : adaptations similaires de force et d'épaisseur musculaire dans un essai de 27 hommes entraînés (D02-05) ; masse maigre plus grande à six séances dans un autre essai (n = 28, D02-06). Plancher de 2 jours : D02-04.

**Limites.** Six jours d'entraînement (aucune étude ne compare ce nombre de séances à l'hypertrophie au long cours) ; peu de repos par semaine ; la personne qui manque une séance a des cibles inférieures sans que le réel soit jugé (règle de Sport). Le volume par séance reste sous le plafond (au plus 8 séries pondérées pour un muscle dans une séance).

#### Séance « Poussée A » (11 séries, environ 29 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | développé couché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 2 | développé militaire (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 3 | élévations latérales (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 4 | extension triceps à la poulie | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06, H07-11 | Si la variante existe, bras au-dessus de la tête (H07-11). |

#### Séance « Tirage A » (15 séries, environ 35 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | tractions pronation (barre fixe) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05 |  |
| 2 | rowing buste penché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01 |  |
| 3 | oiseau (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |
| 4 | curl biceps (haltères) | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |
| 5 | relevés de jambes suspendu (barre fixe) | 3 | 8 | 15 | 60 | 1-2 | 2 série(s), RIR 3-4 | RIR : H04-01 ; choix : D08-50 |  |

#### Séance « Jambes A » (17 séries, environ 41 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | squat (barre) | 4 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09 |  |
| 2 | presse à cuisses | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-07, H07-08 |  |
| 3 | leg curl | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-11 | Assis plutôt que couché si l'appareil le permet (H07-11). |
| 4 | mollets debout (machine) | 4 | 10 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |
| 5 | gainage ventral | 3 | 30 | 60 | 60 | — | 2 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. |

#### Séance « Poussée B » (13 séries, environ 30 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | développé incliné (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 2 | dips (barres parallèles) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 3 | écarté couché (haltères) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-49 |  |
| 4 | élévations latérales (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 5 | barre au front (barre EZ) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06 |  |

#### Séance « Tirage B » (14 séries, environ 33 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | tirage vertical (poulie) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-07 |  |
| 2 | tirage horizontal (poulie) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-07 |  |
| 3 | shrugs (haltères) | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |
| 4 | curl marteau (haltères) | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |
| 5 | oiseau (haltères) | 2 | 12 | 20 | 75 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |

#### Séance « Jambes B » (19 séries, environ 45 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | soulevé de terre jambes tendues (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-39 |  |
| 2 | fentes (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09, D08-31, D08-34 | Une série = les deux côtés faits (compte pour 1 série). |
| 3 | hip thrust (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-35, D08-36 |  |
| 4 | leg curl | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-11 | Assis plutôt que couché si l'appareil le permet (H07-11). |
| 5 | adducteurs à la machine | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |
| 6 | mollets debout (machine) | 4 | 10 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |
| 7 | gainage latéral | 2 | 30 | 60 | 60 | — | 1 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. Une série = les deux côtés faits (compte pour 1 série). |

#### Cibles hebdomadaires de séries par muscle (`ciblesParMuscle`), calculées

| Muscle | Calcul (séries × coefficient) | Cible hebdomadaire (séries) | Passages par semaine | Maximum dans une séance | Position face au dossier | Alerte |
|---|---|---|---|---|---|---|
| pectoraux | développé couché 3×1 + développé incliné 3×1 + dips 3×1 + écarté couché 2×1 | 11 | 2 | 8 | dans le repère (≈ 10 à 12) | — |
| épaules (avant) | développé couché 3×0,5 + développé militaire 3×1 + développé incliné 3×0,5 + dips 3×0,5 + écarté couché 2×0,5 | 8,5 | 2 | 4,5 | entre le minimum et le repère (≈ 10) | — |
| épaules (côté) | développé militaire 3×0,5 + élévations latérales (3+3)×1 | 7,5 | 2 | 4,5 | entre le minimum et le repère (≈ 10) | — |
| épaules (arrière) | rowing buste penché 3×0,5 + oiseau (3+2)×1 + tirage horizontal 3×0,5 | 8 | 2 | 4,5 | entre le minimum et le repère (≈ 10) | — |
| biceps | tractions pronation 3×0,5 + rowing buste penché 3×0,5 + curl biceps 3×1 + tirage vertical 3×0,5 + tirage horizontal 3×0,5 + curl marteau 3×1 | 12 | 2 | 6 | dans le repère (≈ 10 à 12) | — |
| triceps | développé couché 3×0,5 + développé militaire 3×0,5 + extension triceps à la poulie 2×1 + développé incliné 3×0,5 + dips 3×1 + barre au front 2×1 | 11,5 | 2 | 6,5 | dans le repère (≈ 10 à 12) | — |
| avant-bras | curl biceps 3×0,5 + curl marteau 3×0,5 | 3 | 2 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| dorsaux | tractions pronation 3×1 + rowing buste penché 3×1 + tirage vertical 3×1 + tirage horizontal 3×1 | 12 | 2 | 6 | dans le repère (≈ 10 à 12) | — |
| trapèzes | rowing buste penché 3×0,5 + oiseau (3+2)×0,5 + tirage horizontal 3×0,5 + shrugs 3×1 | 8,5 | 2 | 5,5 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| lombaires | SDT jambes tendues (barre) 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| abdominaux | relevés de jambes suspendu 3×1 + gainage ventral 3×1 + gainage latéral 2×0,5 | 7 | 3 | 3 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| obliques | gainage ventral 3×0,5 + gainage latéral 2×1 | 3,5 | 2 | 2 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| quadriceps | squat 4×1 + presse à cuisses 3×1 + fentes 3×1 | 10 | 2 | 7 | dans le repère (≈ 10 à 12) | — |
| ischio-jambiers | leg curl (3+2)×1 + SDT jambes tendues (barre) 3×1 + hip thrust 3×0,5 | 9,5 | 2 | 6,5 | entre le minimum et le repère (≈ 10) | — |
| fessiers | squat 4×0,5 + presse à cuisses 3×0,5 + SDT jambes tendues (barre) 3×0,5 + fentes 3×0,5 + hip thrust 3×1 | 9,5 | 2 | 6 | entre le minimum et le repère (≈ 10) | — |
| adducteurs | squat 4×0,5 + presse à cuisses 3×0,5 + fentes 3×0,5 + adducteurs à la machine 2×1 | 7 | 2 | 3,5 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| mollets | mollets debout (4+4)×1 | 8 | 2 | 4 | entre le minimum et le repère (≈ 10) | — |
| cou | aucun exercice | 0 | 0 | 0 | non programmé (aucun repère propre à ce muscle : non trouvé) | — |

*Repères : minimum ≈ 4 séries fractionnées (H01-06) ; repère ≈ 10 (H01-14) ; 12 à 20 (H01-09) ; ≈ 10 à 11 par séance (H01-19, D03-06) ; ≥ 2 passages (H01-14, D01-04) ; à volume égal, la fréquence n'a pas d'effet mesuré sur l'hypertrophie (H02-02, H01-20).*

**Ce qui sort des fourchettes du dossier.**

| Critère | Muscles concernés |
|---|---|
| Sous le minimum d'environ 4 séries (H01-06) | avant-bras (3), lombaires (1,5), obliques (3,5), cou (0) |
| Grand groupe entre 4 et 10 séries, sous le repère d'environ 10 (H01-14) | épaules (avant) (8,5), épaules (côté) (7,5), épaules (arrière) (8), ischio-jambiers (9,5), fessiers (9,5), mollets (8) |
| Au-dessus de 12 séries (plage 12 à 20 de H01-09) | aucun |
| Plus de 10 séries pondérées dans une séance (H01-19, D03-06) | aucun |
| Un seul passage par semaine pour un grand groupe, sous le repère ≥ 2 jours (D01-04) | aucun |

**Sensibilité à la convention de muscles.** Si la bibliothèque réelle classe les fessiers en muscle **principal** au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 9,5 à 14,5 séries par semaine ; les autres cibles ne changent pas.

**Progression.** Double progression, *pratique de terrain non démontrée* (H06-02) : voir le point 4.

**Déload type.** Pratique d'entraîneurs (H09-12, H09-13) et consensus sur la forme (H09-10, H09-11) : voir le point 5 ; la colonne « Déload » de chaque tableau de séance donne les séries et le RIR.

#### Exercices du modèle

| Exercice | Statut | Équipement | Muscles principaux (×1) | Muscles secondaires (×0,5) | Unilatéral | Remplaçants (autre équipement ; gêne articulaire courante) |
|---|---|---|---|---|---|---|
| développé couché (barre) | déjà présent | barre, banc | pectoraux | épaules (avant), triceps | non | autre équipement : développé incliné (haltères) si pas de barre ni de support ; gêne articulaire courante : développé incliné (haltères), prise libre |
| développé militaire (barre) | déjà présent | barre | épaules (avant) | épaules (côté), triceps | non | autre équipement : développé incliné (haltères) ; gêne articulaire courante : élévations latérales (haltères) |
| élévations latérales (haltères) | déjà présent | haltères | épaules (côté) | — | non | autre équipement : pas d'équivalent présent (l'exercice peut se faire à la poulie : variante non présente) ; gêne articulaire courante : développé militaire (barre), en secondaire |
| extension triceps à la poulie | déjà présent | poulie | triceps | — | non | autre équipement : barre au front (barre EZ) ; gêne articulaire courante : dips (barres parallèles) en secondaire |
| tractions pronation (barre fixe) | déjà présent | barre fixe | dorsaux | biceps | non | autre équipement : tirage vertical (poulie) sans barre fixe ; gêne articulaire courante : rowing buste penché (barre) |
| rowing buste penché (barre) | déjà présent | barre | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : tirage vertical (poulie), buste soutenu |
| oiseau (haltères) | déjà présent | haltères | épaules (arrière) | trapèzes | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : — |
| curl biceps (haltères) | déjà présent | haltères | biceps | avant-bras | non | autre équipement : curl marteau (haltères) ; gêne articulaire courante : curl marteau (haltères), prise neutre |
| relevés de jambes suspendu (barre fixe) | déjà présent | barre fixe | abdominaux | — | non | autre équipement : gainage ventral sans barre fixe ; gêne articulaire courante : gainage ventral |
| squat (barre) | déjà présent | barre, support | quadriceps | fessiers, adducteurs | non | autre équipement : presse à cuisses ; gêne articulaire courante : fentes (haltères) ou presse à cuisses |
| presse à cuisses | déjà présent | machine | quadriceps | fessiers, adducteurs | non | autre équipement : squat (barre) ; gêne articulaire courante : fentes (haltères) |
| leg curl | déjà présent | machine | ischio-jambiers | — | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : — |
| mollets debout (machine) | déjà présent | machine | mollets | — | non | autre équipement : mollets debout à une jambe (haltère) sans machine, à ajouter ; gêne articulaire courante : — |
| gainage ventral | déjà présent | poids du corps | abdominaux | obliques | non | autre équipement : gainage latéral ; gêne articulaire courante : relevés de jambes suspendu (barre fixe) |
| développé incliné (haltères) | déjà présent | haltères, banc incliné | pectoraux | épaules (avant), triceps | non | autre équipement : développé couché (barre) sans haltères lourds ; gêne articulaire courante : écarté couché (haltères), amplitude réduite |
| dips (barres parallèles) | déjà présent | barres parallèles | pectoraux, triceps | épaules (avant) | non | autre équipement : développé incliné (haltères) sans barres parallèles ; gêne articulaire courante : extension triceps à la poulie |
| écarté couché (haltères) | déjà présent | haltères, banc | pectoraux | épaules (avant) | non | autre équipement : développé incliné (haltères) ; gêne articulaire courante : — |
| barre au front (barre EZ) | déjà présent | barre EZ, banc | triceps | — | non | extension triceps à la poulie (autre équipement et gêne articulaire) |
| tirage vertical (poulie) | déjà présent | poulie haute | dorsaux | biceps | non | autre équipement : tractions pronation (barre fixe) ; gêne articulaire courante : tirage horizontal (poulie) |
| tirage horizontal (poulie) | déjà présent | poulie basse | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : rowing buste penché (barre) ; gêne articulaire courante : tirage vertical (poulie) |
| shrugs (haltères) | déjà présent | haltères | trapèzes | — | non | autre équipement : pas d'équivalent présent ; gêne articulaire courante : tirage horizontal (poulie), en secondaire |
| curl marteau (haltères) | déjà présent | haltères | biceps | avant-bras | non | curl biceps (haltères) (autre équipement et gêne articulaire) |
| soulevé de terre jambes tendues (barre) | déjà présent | barre | ischio-jambiers | fessiers, lombaires | non | autre équipement : hip thrust (barre) ; gêne articulaire courante : leg curl |
| fentes (haltères) | déjà présent | haltères | quadriceps | fessiers, adducteurs | oui | autre équipement : presse à cuisses ; gêne articulaire courante : presse à cuisses, charge réduite |
| hip thrust (barre) | déjà présent | barre, banc | fessiers | ischio-jambiers | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : fentes (haltères) |
| adducteurs à la machine | déjà présent | machine | adducteurs | — | non | autre équipement : pas d'équivalent présent ; gêne articulaire courante : — |
| gainage latéral | déjà présent | poids du corps | obliques | abdominaux | oui | gainage ventral (autre équipement et gêne articulaire) |

*Remplaçants : pratique de terrain, aucune preuve citée ; seuls les exercices déjà présents sont proposés, sauf mention « à ajouter ». « Gêne articulaire courante » ne veut dire ni diagnostic ni prescription : l'application propose une autre façon de solliciter le muscle, la personne choisit.*

---

### M3 — Haut / Bas, 4 jours

| Rubrique | Contenu |
|---|---|
| Nom | Haut / Bas, 4 jours |
| Description | Quatre séances : Haut A, Bas A, Haut B, Bas B. Chaque muscle est travaillé **deux fois par semaine** ; la séance A privilégie les exercices lourds (6 à 10 répétitions), la séance B les exercices à répétitions plus élevées. Durée de 40 à 55 minutes environ. |
| Public | Intermédiaires. L'ACSM 2009 recommande à l'intermédiaire 3 jours en corps entier ou 4 jours en découpage haut/bas pour l'hypertrophie, preuve de catégorie B (D03-01). |
| Séances par semaine (`parSemaine`) | 4 |
| Séries de travail par semaine | 77 |
| Durée estimée par séance (hors échauffement ; calcul simple : 40 s par série plus repos) | 53 / 41 / 52 / 42 min |
| Équipement | salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe |
| Découpage documenté dans | D03 |

**Ce que disent les sources de ce découpage.** D03-01 (ACSM 2009), D03-02 (ACSM 2026 : au moins 2 fois par semaine, environ 10 séries). Seize séries par semaine en une ou en deux séances : pas de différence (D03-05, essai de 20 hommes entraînés). Plafond d'environ 10 séries par séance (D03-06). Programme public de structure voisine : D03-10 (structure seulement).

**Limites.** Aucune étude lue ne compare le Haut/Bas au PPL ou au corps entier avec les mêmes exercices ; les trapèzes (4,5) et les obliques (1,5) restent bas.

#### Séance « Haut A » (20 séries, environ 53 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | développé couché (barre) | 4 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 2 | rowing buste penché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01 |  |
| 3 | développé militaire (barre) | 2 | 8 | 12 | 150 | 2-3 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 4 | tirage vertical (poulie) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-07 |  |
| 5 | élévations latérales (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 6 | extension triceps à la poulie | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06, H07-11 | Si la variante existe, bras au-dessus de la tête (H07-11). |
| 7 | curl biceps (haltères) | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |

#### Séance « Bas A » (17 séries, environ 41 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | squat (barre) | 4 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09 |  |
| 2 | soulevé de terre jambes tendues (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-39 |  |
| 3 | leg curl | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-11 | Assis plutôt que couché si l'appareil le permet (H07-11). |
| 4 | mollets debout (machine) | 4 | 10 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |
| 5 | gainage ventral | 3 | 30 | 60 | 60 | — | 2 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. |

#### Séance « Haut B » (22 séries, environ 52 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | développé incliné (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 2 | tractions pronation (barre fixe) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05 |  |
| 3 | dips (barres parallèles) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 4 | tirage horizontal (poulie) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-07 |  |
| 5 | élévations latérales (haltères) | 2 | 12 | 20 | 75 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 6 | oiseau (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |
| 7 | barre au front (barre EZ) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06 |  |
| 8 | curl marteau (haltères) | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |

#### Séance « Bas B » (18 séries, environ 42 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | presse à cuisses | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-07, H07-08 |  |
| 2 | fentes (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09, D08-31, D08-34 | Une série = les deux côtés faits (compte pour 1 série). |
| 3 | hip thrust (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-35, D08-36 |  |
| 4 | adducteurs à la machine | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |
| 5 | mollets debout (machine) | 4 | 10 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |
| 6 | relevés de jambes suspendu (barre fixe) | 3 | 8 | 15 | 60 | 1-2 | 2 série(s), RIR 3-4 | RIR : H04-01 ; choix : D08-50 |  |

#### Cibles hebdomadaires de séries par muscle (`ciblesParMuscle`), calculées

| Muscle | Calcul (séries × coefficient) | Cible hebdomadaire (séries) | Passages par semaine | Maximum dans une séance | Position face au dossier | Alerte |
|---|---|---|---|---|---|---|
| pectoraux | développé couché 4×1 + développé incliné 3×1 + dips 3×1 | 10 | 2 | 6 | dans le repère (≈ 10 à 12) | — |
| épaules (avant) | développé couché 4×0,5 + développé militaire 2×1 + développé incliné 3×0,5 + dips 3×0,5 | 7 | 2 | 4 | entre le minimum et le repère (≈ 10) | — |
| épaules (côté) | développé militaire 2×0,5 + élévations latérales (3+2)×1 | 6 | 2 | 4 | entre le minimum et le repère (≈ 10) | — |
| épaules (arrière) | rowing buste penché 3×0,5 + tirage horizontal 3×0,5 + oiseau 3×1 | 6 | 2 | 4,5 | entre le minimum et le repère (≈ 10) | — |
| biceps | rowing buste penché 3×0,5 + tirage vertical 3×0,5 + curl biceps 3×1 + tractions pronation 3×0,5 + tirage horizontal 3×0,5 + curl marteau 3×1 | 12 | 2 | 6 | dans le repère (≈ 10 à 12) | — |
| triceps | développé couché 4×0,5 + développé militaire 2×0,5 + extension triceps à la poulie 2×1 + développé incliné 3×0,5 + dips 3×1 + barre au front 2×1 | 11,5 | 2 | 6,5 | dans le repère (≈ 10 à 12) | — |
| avant-bras | curl biceps 3×0,5 + curl marteau 3×0,5 | 3 | 2 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| dorsaux | rowing buste penché 3×1 + tirage vertical 3×1 + tractions pronation 3×1 + tirage horizontal 3×1 | 12 | 2 | 6 | dans le repère (≈ 10 à 12) | — |
| trapèzes | rowing buste penché 3×0,5 + tirage horizontal 3×0,5 + oiseau 3×0,5 | 4,5 | 2 | 3 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| lombaires | SDT jambes tendues (barre) 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| abdominaux | gainage ventral 3×1 + relevés de jambes suspendu 3×1 | 6 | 2 | 3 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| obliques | gainage ventral 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| quadriceps | squat 4×1 + presse à cuisses 3×1 + fentes 3×1 | 10 | 2 | 6 | dans le repère (≈ 10 à 12) | — |
| ischio-jambiers | SDT jambes tendues (barre) 3×1 + leg curl 3×1 + hip thrust 3×0,5 | 7,5 | 2 | 6 | entre le minimum et le repère (≈ 10) | — |
| fessiers | squat 4×0,5 + SDT jambes tendues (barre) 3×0,5 + presse à cuisses 3×0,5 + fentes 3×0,5 + hip thrust 3×1 | 9,5 | 2 | 6 | entre le minimum et le repère (≈ 10) | — |
| adducteurs | squat 4×0,5 + presse à cuisses 3×0,5 + fentes 3×0,5 + adducteurs à la machine 2×1 | 7 | 2 | 5 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| mollets | mollets debout (4+4)×1 | 8 | 2 | 4 | entre le minimum et le repère (≈ 10) | — |
| cou | aucun exercice | 0 | 0 | 0 | non programmé (aucun repère propre à ce muscle : non trouvé) | — |

*Repères : minimum ≈ 4 séries fractionnées (H01-06) ; repère ≈ 10 (H01-14) ; 12 à 20 (H01-09) ; ≈ 10 à 11 par séance (H01-19, D03-06) ; ≥ 2 passages (H01-14, D01-04) ; à volume égal, la fréquence n'a pas d'effet mesuré sur l'hypertrophie (H02-02, H01-20).*

**Ce qui sort des fourchettes du dossier.**

| Critère | Muscles concernés |
|---|---|
| Sous le minimum d'environ 4 séries (H01-06) | avant-bras (3), lombaires (1,5), obliques (1,5), cou (0) |
| Grand groupe entre 4 et 10 séries, sous le repère d'environ 10 (H01-14) | épaules (avant) (7), épaules (côté) (6), épaules (arrière) (6), ischio-jambiers (7,5), fessiers (9,5), mollets (8) |
| Au-dessus de 12 séries (plage 12 à 20 de H01-09) | aucun |
| Plus de 10 séries pondérées dans une séance (H01-19, D03-06) | aucun |
| Un seul passage par semaine pour un grand groupe, sous le repère ≥ 2 jours (D01-04) | aucun |

**Sensibilité à la convention de muscles.** Si la bibliothèque réelle classe les fessiers en muscle **principal** au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 9,5 à 14,5 séries par semaine ; les autres cibles ne changent pas.

**Progression.** Double progression, *pratique de terrain non démontrée* (H06-02) : voir le point 4.

**Déload type.** Pratique d'entraîneurs (H09-12, H09-13) et consensus sur la forme (H09-10, H09-11) : voir le point 5 ; la colonne « Déload » de chaque tableau de séance donne les séries et le RIR.

#### Exercices du modèle

| Exercice | Statut | Équipement | Muscles principaux (×1) | Muscles secondaires (×0,5) | Unilatéral | Remplaçants (autre équipement ; gêne articulaire courante) |
|---|---|---|---|---|---|---|
| développé couché (barre) | déjà présent | barre, banc | pectoraux | épaules (avant), triceps | non | autre équipement : développé incliné (haltères) si pas de barre ni de support ; gêne articulaire courante : développé incliné (haltères), prise libre |
| rowing buste penché (barre) | déjà présent | barre | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : tirage vertical (poulie), buste soutenu |
| développé militaire (barre) | déjà présent | barre | épaules (avant) | épaules (côté), triceps | non | autre équipement : développé incliné (haltères) ; gêne articulaire courante : élévations latérales (haltères) |
| tirage vertical (poulie) | déjà présent | poulie haute | dorsaux | biceps | non | autre équipement : tractions pronation (barre fixe) ; gêne articulaire courante : tirage horizontal (poulie) |
| élévations latérales (haltères) | déjà présent | haltères | épaules (côté) | — | non | autre équipement : pas d'équivalent présent (l'exercice peut se faire à la poulie : variante non présente) ; gêne articulaire courante : développé militaire (barre), en secondaire |
| extension triceps à la poulie | déjà présent | poulie | triceps | — | non | autre équipement : barre au front (barre EZ) ; gêne articulaire courante : dips (barres parallèles) en secondaire |
| curl biceps (haltères) | déjà présent | haltères | biceps | avant-bras | non | autre équipement : curl marteau (haltères) ; gêne articulaire courante : curl marteau (haltères), prise neutre |
| squat (barre) | déjà présent | barre, support | quadriceps | fessiers, adducteurs | non | autre équipement : presse à cuisses ; gêne articulaire courante : fentes (haltères) ou presse à cuisses |
| soulevé de terre jambes tendues (barre) | déjà présent | barre | ischio-jambiers | fessiers, lombaires | non | autre équipement : hip thrust (barre) ; gêne articulaire courante : leg curl |
| leg curl | déjà présent | machine | ischio-jambiers | — | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : — |
| mollets debout (machine) | déjà présent | machine | mollets | — | non | autre équipement : mollets debout à une jambe (haltère) sans machine, à ajouter ; gêne articulaire courante : — |
| gainage ventral | déjà présent | poids du corps | abdominaux | obliques | non | autre équipement : gainage latéral ; gêne articulaire courante : relevés de jambes suspendu (barre fixe) |
| développé incliné (haltères) | déjà présent | haltères, banc incliné | pectoraux | épaules (avant), triceps | non | autre équipement : développé couché (barre) sans haltères lourds ; gêne articulaire courante : écarté couché (haltères), amplitude réduite |
| tractions pronation (barre fixe) | déjà présent | barre fixe | dorsaux | biceps | non | autre équipement : tirage vertical (poulie) sans barre fixe ; gêne articulaire courante : rowing buste penché (barre) |
| dips (barres parallèles) | déjà présent | barres parallèles | pectoraux, triceps | épaules (avant) | non | autre équipement : développé incliné (haltères) sans barres parallèles ; gêne articulaire courante : extension triceps à la poulie |
| tirage horizontal (poulie) | déjà présent | poulie basse | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : rowing buste penché (barre) ; gêne articulaire courante : tirage vertical (poulie) |
| oiseau (haltères) | déjà présent | haltères | épaules (arrière) | trapèzes | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : — |
| barre au front (barre EZ) | déjà présent | barre EZ, banc | triceps | — | non | extension triceps à la poulie (autre équipement et gêne articulaire) |
| curl marteau (haltères) | déjà présent | haltères | biceps | avant-bras | non | curl biceps (haltères) (autre équipement et gêne articulaire) |
| presse à cuisses | déjà présent | machine | quadriceps | fessiers, adducteurs | non | autre équipement : squat (barre) ; gêne articulaire courante : fentes (haltères) |
| fentes (haltères) | déjà présent | haltères | quadriceps | fessiers, adducteurs | oui | autre équipement : presse à cuisses ; gêne articulaire courante : presse à cuisses, charge réduite |
| hip thrust (barre) | déjà présent | barre, banc | fessiers | ischio-jambiers | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : fentes (haltères) |
| adducteurs à la machine | déjà présent | machine | adducteurs | — | non | autre équipement : pas d'équivalent présent ; gêne articulaire courante : — |
| relevés de jambes suspendu (barre fixe) | déjà présent | barre fixe | abdominaux | — | non | autre équipement : gainage ventral sans barre fixe ; gêne articulaire courante : gainage ventral |

*Remplaçants : pratique de terrain, aucune preuve citée ; seuls les exercices déjà présents sont proposés, sauf mention « à ajouter ». « Gêne articulaire courante » ne veut dire ni diagnostic ni prescription : l'application propose une autre façon de solliciter le muscle, la personne choisit.*

---

### M4 — Corps entier, 3 jours

| Rubrique | Contenu |
|---|---|
| Nom | Corps entier, 3 jours |
| Description | Trois séances de corps entier (A, B, C) sur des jours non consécutifs ; chaque muscle est travaillé **deux ou trois fois par semaine** selon les exercices. Chaque séance compte 19 à 21 séries (environ 50 minutes). |
| Public | Novices et intermédiaires. L'ACSM 2009 : novices 2 à 3 jours en corps entier, intermédiaires 3 jours en corps entier (D05-01). |
| Séances par semaine (`parSemaine`) | 3 |
| Séries de travail par semaine | 62 |
| Durée estimée par séance (hors échauffement ; calcul simple : 40 s par série plus repos) | 49 / 53 / 52 min |
| Équipement | salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe |
| Découpage documenté dans | D05 |

**Ce que disent les sources de ce découpage.** D05-01 ; à volume égal, un corps entier à haute fréquence et un découpage donnent des gains de masse maigre et de force semblables (D05-03, essai de 23 hommes bien entraînés) ; 3 contre 6 séances : D05-04. Contre-exemple : un essai de 21 hommes à 4 jours par semaine donne un gain d'épaisseur du vaste latéral plus grand avec un découpage (D05-05). Les programmes publics à 3 séances sont présentés comme temporaires pour les débutants (D05-11).

**Limites.** Les séries pondérées d'un muscle dans une séance (au plus 4,5) sont loin du plafond par séance ; les ischio-jambiers, fessiers et trapèzes sont sous 10 séries par semaine ; la séance dure environ 50 minutes même avec seulement 3 séries par exercice.

#### Séance « Corps entier A » (19 séries, environ 49 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | squat (barre) | 4 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09 |  |
| 2 | développé couché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 3 | rowing buste penché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01 |  |
| 4 | élévations latérales (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 5 | curl biceps (haltères) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |
| 6 | extension triceps à la poulie | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06, H07-11 | Si la variante existe, bras au-dessus de la tête (H07-11). |
| 7 | gainage ventral | 2 | 30 | 60 | 60 | — | 1 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. |

#### Séance « Corps entier B » (21 séries, environ 53 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | presse à cuisses | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-07, H07-08 |  |
| 2 | développé militaire (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 3 | tirage vertical (poulie) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-07 |  |
| 4 | leg curl | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-11 | Assis plutôt que couché si l'appareil le permet (H07-11). |
| 5 | dips (barres parallèles) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 6 | curl marteau (haltères) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |
| 7 | mollets debout (machine) | 4 | 10 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |

#### Séance « Corps entier C » (22 séries, environ 52 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | soulevé de terre jambes tendues (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-39 |  |
| 2 | développé incliné (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 3 | tractions pronation (barre fixe) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05 |  |
| 4 | fentes (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09, D08-31, D08-34 | Une série = les deux côtés faits (compte pour 1 série). |
| 5 | oiseau (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |
| 6 | barre au front (barre EZ) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06 |  |
| 7 | relevés de jambes suspendu (barre fixe) | 2 | 8 | 15 | 60 | 1-2 | 1 série(s), RIR 3-4 | RIR : H04-01 ; choix : D08-50 |  |
| 8 | mollets debout (machine) | 3 | 10 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |

#### Cibles hebdomadaires de séries par muscle (`ciblesParMuscle`), calculées

| Muscle | Calcul (séries × coefficient) | Cible hebdomadaire (séries) | Passages par semaine | Maximum dans une séance | Position face au dossier | Alerte |
|---|---|---|---|---|---|---|
| pectoraux | développé couché 3×1 + dips 3×1 + développé incliné 3×1 | 9 | 3 | 3 | entre le minimum et le repère (≈ 10) | — |
| épaules (avant) | développé couché 3×0,5 + développé militaire 3×1 + dips 3×0,5 + développé incliné 3×0,5 | 7,5 | 3 | 4,5 | entre le minimum et le repère (≈ 10) | — |
| épaules (côté) | élévations latérales 3×1 + développé militaire 3×0,5 | 4,5 | 2 | 3 | entre le minimum et le repère (≈ 10) | — |
| épaules (arrière) | rowing buste penché 3×0,5 + oiseau 3×1 | 4,5 | 2 | 3 | entre le minimum et le repère (≈ 10) | — |
| biceps | rowing buste penché 3×0,5 + curl biceps 2×1 + tirage vertical 3×0,5 + curl marteau 2×1 + tractions pronation 3×0,5 | 8,5 | 3 | 3,5 | entre le minimum et le repère (≈ 10) | — |
| triceps | développé couché 3×0,5 + extension triceps à la poulie 2×1 + développé militaire 3×0,5 + dips 3×1 + développé incliné 3×0,5 + barre au front 2×1 | 11,5 | 3 | 4,5 | dans le repère (≈ 10 à 12) | — |
| avant-bras | curl biceps 2×0,5 + curl marteau 2×0,5 | 2 | 2 | 1 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| dorsaux | rowing buste penché 3×1 + tirage vertical 3×1 + tractions pronation 3×1 | 9 | 3 | 3 | entre le minimum et le repère (≈ 10) | — |
| trapèzes | rowing buste penché 3×0,5 + oiseau 3×0,5 | 3 | 2 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| lombaires | SDT jambes tendues (barre) 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| abdominaux | gainage ventral 2×1 + relevés de jambes suspendu 2×1 | 4 | 2 | 2 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| obliques | gainage ventral 2×0,5 | 1 | 1 | 1 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| quadriceps | squat 4×1 + presse à cuisses 3×1 + fentes 3×1 | 10 | 3 | 4 | dans le repère (≈ 10 à 12) | — |
| ischio-jambiers | leg curl 3×1 + SDT jambes tendues (barre) 3×1 | 6 | 2 | 3 | entre le minimum et le repère (≈ 10) | — |
| fessiers | squat 4×0,5 + presse à cuisses 3×0,5 + SDT jambes tendues (barre) 3×0,5 + fentes 3×0,5 | 6,5 | 3 | 3 | entre le minimum et le repère (≈ 10) | — |
| adducteurs | squat 4×0,5 + presse à cuisses 3×0,5 + fentes 3×0,5 | 5 | 3 | 2 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| mollets | mollets debout (4+3)×1 | 7 | 2 | 4 | entre le minimum et le repère (≈ 10) | — |
| cou | aucun exercice | 0 | 0 | 0 | non programmé (aucun repère propre à ce muscle : non trouvé) | — |

*Repères : minimum ≈ 4 séries fractionnées (H01-06) ; repère ≈ 10 (H01-14) ; 12 à 20 (H01-09) ; ≈ 10 à 11 par séance (H01-19, D03-06) ; ≥ 2 passages (H01-14, D01-04) ; à volume égal, la fréquence n'a pas d'effet mesuré sur l'hypertrophie (H02-02, H01-20).*

**Ce qui sort des fourchettes du dossier.**

| Critère | Muscles concernés |
|---|---|
| Sous le minimum d'environ 4 séries (H01-06) | avant-bras (2), trapèzes (3), lombaires (1,5), obliques (1), cou (0) |
| Grand groupe entre 4 et 10 séries, sous le repère d'environ 10 (H01-14) | pectoraux (9), épaules (avant) (7,5), épaules (côté) (4,5), épaules (arrière) (4,5), biceps (8,5), dorsaux (9), ischio-jambiers (6), fessiers (6,5), mollets (7) |
| Au-dessus de 12 séries (plage 12 à 20 de H01-09) | aucun |
| Plus de 10 séries pondérées dans une séance (H01-19, D03-06) | aucun |
| Un seul passage par semaine pour un grand groupe, sous le repère ≥ 2 jours (D01-04) | aucun |

**Sensibilité à la convention de muscles.** Si la bibliothèque réelle classe les fessiers en muscle **principal** au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 6,5 à 11,5 séries par semaine ; les autres cibles ne changent pas.

**Progression.** Double progression, *pratique de terrain non démontrée* (H06-02) : voir le point 4.

**Déload type.** Pratique d'entraîneurs (H09-12, H09-13) et consensus sur la forme (H09-10, H09-11) : voir le point 5 ; la colonne « Déload » de chaque tableau de séance donne les séries et le RIR.

#### Exercices du modèle

| Exercice | Statut | Équipement | Muscles principaux (×1) | Muscles secondaires (×0,5) | Unilatéral | Remplaçants (autre équipement ; gêne articulaire courante) |
|---|---|---|---|---|---|---|
| squat (barre) | déjà présent | barre, support | quadriceps | fessiers, adducteurs | non | autre équipement : presse à cuisses ; gêne articulaire courante : fentes (haltères) ou presse à cuisses |
| développé couché (barre) | déjà présent | barre, banc | pectoraux | épaules (avant), triceps | non | autre équipement : développé incliné (haltères) si pas de barre ni de support ; gêne articulaire courante : développé incliné (haltères), prise libre |
| rowing buste penché (barre) | déjà présent | barre | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : tirage vertical (poulie), buste soutenu |
| élévations latérales (haltères) | déjà présent | haltères | épaules (côté) | — | non | autre équipement : pas d'équivalent présent (l'exercice peut se faire à la poulie : variante non présente) ; gêne articulaire courante : développé militaire (barre), en secondaire |
| curl biceps (haltères) | déjà présent | haltères | biceps | avant-bras | non | autre équipement : curl marteau (haltères) ; gêne articulaire courante : curl marteau (haltères), prise neutre |
| extension triceps à la poulie | déjà présent | poulie | triceps | — | non | autre équipement : barre au front (barre EZ) ; gêne articulaire courante : dips (barres parallèles) en secondaire |
| gainage ventral | déjà présent | poids du corps | abdominaux | obliques | non | autre équipement : gainage latéral ; gêne articulaire courante : relevés de jambes suspendu (barre fixe) |
| presse à cuisses | déjà présent | machine | quadriceps | fessiers, adducteurs | non | autre équipement : squat (barre) ; gêne articulaire courante : fentes (haltères) |
| développé militaire (barre) | déjà présent | barre | épaules (avant) | épaules (côté), triceps | non | autre équipement : développé incliné (haltères) ; gêne articulaire courante : élévations latérales (haltères) |
| tirage vertical (poulie) | déjà présent | poulie haute | dorsaux | biceps | non | autre équipement : tractions pronation (barre fixe) ; gêne articulaire courante : tirage horizontal (poulie) |
| leg curl | déjà présent | machine | ischio-jambiers | — | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : — |
| dips (barres parallèles) | déjà présent | barres parallèles | pectoraux, triceps | épaules (avant) | non | autre équipement : développé incliné (haltères) sans barres parallèles ; gêne articulaire courante : extension triceps à la poulie |
| curl marteau (haltères) | déjà présent | haltères | biceps | avant-bras | non | curl biceps (haltères) (autre équipement et gêne articulaire) |
| mollets debout (machine) | déjà présent | machine | mollets | — | non | autre équipement : mollets debout à une jambe (haltère) sans machine, à ajouter ; gêne articulaire courante : — |
| soulevé de terre jambes tendues (barre) | déjà présent | barre | ischio-jambiers | fessiers, lombaires | non | autre équipement : hip thrust (barre) ; gêne articulaire courante : leg curl |
| développé incliné (haltères) | déjà présent | haltères, banc incliné | pectoraux | épaules (avant), triceps | non | autre équipement : développé couché (barre) sans haltères lourds ; gêne articulaire courante : écarté couché (haltères), amplitude réduite |
| tractions pronation (barre fixe) | déjà présent | barre fixe | dorsaux | biceps | non | autre équipement : tirage vertical (poulie) sans barre fixe ; gêne articulaire courante : rowing buste penché (barre) |
| fentes (haltères) | déjà présent | haltères | quadriceps | fessiers, adducteurs | oui | autre équipement : presse à cuisses ; gêne articulaire courante : presse à cuisses, charge réduite |
| oiseau (haltères) | déjà présent | haltères | épaules (arrière) | trapèzes | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : — |
| barre au front (barre EZ) | déjà présent | barre EZ, banc | triceps | — | non | extension triceps à la poulie (autre équipement et gêne articulaire) |
| relevés de jambes suspendu (barre fixe) | déjà présent | barre fixe | abdominaux | — | non | autre équipement : gainage ventral sans barre fixe ; gêne articulaire courante : gainage ventral |

*Remplaçants : pratique de terrain, aucune preuve citée ; seuls les exercices déjà présents sont proposés, sauf mention « à ajouter ». « Gêne articulaire courante » ne veut dire ni diagnostic ni prescription : l'application propose une autre façon de solliciter le muscle, la personne choisit.*

---

### M5 — Corps entier, 2 jours

| Rubrique | Contenu |
|---|---|
| Nom | Corps entier, 2 jours |
| Description | Deux séances de corps entier (A et B) par semaine ; chaque muscle est travaillé **une ou deux fois par semaine**. Le volume hebdomadaire des grands groupes se situe entre 5 et 8 séries : **modèle économe**, sous le repère d'environ 10. |
| Public | Novices (ACSM 2009 : 2 à 3 jours en corps entier, D04-01 et D04-04) ; personnes à temps limité ; cadre de maintien. Un programme public de deux séances par semaine est jugé de volume « plutôt faible » par son auteur pour intermédiaires et avancés (D05-12). |
| Séances par semaine (`parSemaine`) | 2 |
| Séries de travail par semaine | 39 |
| Durée estimée par séance (hors échauffement ; calcul simple : 40 s par série plus repos) | 44 / 55 min |
| Équipement | salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe |
| Découpage documenté dans | D04 |

**Ce que disent les sources de ce découpage.** D04-01, D04-04 (novices, 1 à 3 séries par exercice) ; deux séances contre trois, à volume égal, ont donné les mêmes gains chez des débutants (D04-09, D05-10) ; le volume prime sur la fréquence dans la revue sur l'entraînement économe en temps, au moins 4 séries par groupe et par semaine (D04-06) ; au moins 2 jours non consécutifs par semaine (D04-02). Un passage par semaine peut suffire d'après un consensus d'athlètes (D04-07).

**Limites.** Cibles hebdomadaires sous le repère d'environ 10 pour la plupart des muscles ; plusieurs muscles restent sous le minimum d'environ 4 (voir le tableau des cibles). Le dossier ne donne ni fréquence ni volume précis pour les « 2 jours » au-delà des lignes citées.

#### Séance « Corps entier A » (17 séries, environ 44 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | squat (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09 |  |
| 2 | développé couché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 3 | rowing buste penché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01 |  |
| 4 | leg curl | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-11 | Assis plutôt que couché si l'appareil le permet (H07-11). |
| 5 | élévations latérales (haltères) | 2 | 12 | 20 | 75 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 6 | curl biceps (haltères) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |
| 7 | gainage ventral | 2 | 30 | 60 | 60 | — | 1 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. |

#### Séance « Corps entier B » (22 séries, environ 55 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | presse à cuisses | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-07, H07-08 |  |
| 2 | développé incliné (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 3 | tirage vertical (poulie) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-07 |  |
| 4 | soulevé de terre jambes tendues (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-39 |  |
| 5 | développé militaire (barre) | 2 | 8 | 12 | 150 | 2-3 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 6 | extension triceps à la poulie | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06, H07-11 | Si la variante existe, bras au-dessus de la tête (H07-11). |
| 7 | mollets debout (machine) | 4 | 10 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |
| 8 | relevés de jambes suspendu (barre fixe) | 2 | 8 | 15 | 60 | 1-2 | 1 série(s), RIR 3-4 | RIR : H04-01 ; choix : D08-50 |  |

#### Cibles hebdomadaires de séries par muscle (`ciblesParMuscle`), calculées

| Muscle | Calcul (séries × coefficient) | Cible hebdomadaire (séries) | Passages par semaine | Maximum dans une séance | Position face au dossier | Alerte |
|---|---|---|---|---|---|---|
| pectoraux | développé couché 3×1 + développé incliné 3×1 | 6 | 2 | 3 | entre le minimum et le repère (≈ 10) | — |
| épaules (avant) | développé couché 3×0,5 + développé incliné 3×0,5 + développé militaire 2×1 | 5 | 2 | 3,5 | entre le minimum et le repère (≈ 10) | — |
| épaules (côté) | élévations latérales 2×1 + développé militaire 2×0,5 | 3 | 2 | 2 | sous le minimum (≈ 4) | — |
| épaules (arrière) | rowing buste penché 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) | 1 passage par semaine, sous le repère ≥ 2 jours |
| biceps | rowing buste penché 3×0,5 + curl biceps 2×1 + tirage vertical 3×0,5 | 5 | 2 | 3,5 | entre le minimum et le repère (≈ 10) | — |
| triceps | développé couché 3×0,5 + développé incliné 3×0,5 + développé militaire 2×0,5 + extension triceps à la poulie 2×1 | 6 | 2 | 4,5 | entre le minimum et le repère (≈ 10) | — |
| avant-bras | curl biceps 2×0,5 | 1 | 1 | 1 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| dorsaux | rowing buste penché 3×1 + tirage vertical 3×1 | 6 | 2 | 3 | entre le minimum et le repère (≈ 10) | — |
| trapèzes | rowing buste penché 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| lombaires | SDT jambes tendues (barre) 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| abdominaux | gainage ventral 2×1 + relevés de jambes suspendu 2×1 | 4 | 2 | 2 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| obliques | gainage ventral 2×0,5 | 1 | 1 | 1 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| quadriceps | squat 3×1 + presse à cuisses 3×1 | 6 | 2 | 3 | entre le minimum et le repère (≈ 10) | — |
| ischio-jambiers | leg curl 2×1 + SDT jambes tendues (barre) 3×1 | 5 | 2 | 3 | entre le minimum et le repère (≈ 10) | — |
| fessiers | squat 3×0,5 + presse à cuisses 3×0,5 + SDT jambes tendues (barre) 3×0,5 | 4,5 | 2 | 3 | entre le minimum et le repère (≈ 10) | — |
| adducteurs | squat 3×0,5 + presse à cuisses 3×0,5 | 3 | 2 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| mollets | mollets debout 4×1 | 4 | 1 | 4 | entre le minimum et le repère (≈ 10) | 1 passage par semaine, sous le repère ≥ 2 jours |
| cou | aucun exercice | 0 | 0 | 0 | non programmé (aucun repère propre à ce muscle : non trouvé) | — |

*Repères : minimum ≈ 4 séries fractionnées (H01-06) ; repère ≈ 10 (H01-14) ; 12 à 20 (H01-09) ; ≈ 10 à 11 par séance (H01-19, D03-06) ; ≥ 2 passages (H01-14, D01-04) ; à volume égal, la fréquence n'a pas d'effet mesuré sur l'hypertrophie (H02-02, H01-20).*

**Ce qui sort des fourchettes du dossier.**

| Critère | Muscles concernés |
|---|---|
| Sous le minimum d'environ 4 séries (H01-06) | épaules (côté) (3), épaules (arrière) (1,5), avant-bras (1), trapèzes (1,5), lombaires (1,5), obliques (1), adducteurs (3), cou (0) |
| Grand groupe entre 4 et 10 séries, sous le repère d'environ 10 (H01-14) | pectoraux (6), épaules (avant) (5), biceps (5), triceps (6), dorsaux (6), quadriceps (6), ischio-jambiers (5), fessiers (4,5), mollets (4) |
| Au-dessus de 12 séries (plage 12 à 20 de H01-09) | aucun |
| Plus de 10 séries pondérées dans une séance (H01-19, D03-06) | aucun |
| Un seul passage par semaine pour un grand groupe, sous le repère ≥ 2 jours (D01-04) | épaules (arrière), mollets |

**Sensibilité à la convention de muscles.** Si la bibliothèque réelle classe les fessiers en muscle **principal** au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 4,5 à 7,5 séries par semaine ; les autres cibles ne changent pas.

**Progression.** Double progression, *pratique de terrain non démontrée* (H06-02) : voir le point 4.

**Déload type.** Pratique d'entraîneurs (H09-12, H09-13) et consensus sur la forme (H09-10, H09-11) : voir le point 5 ; la colonne « Déload » de chaque tableau de séance donne les séries et le RIR.

#### Exercices du modèle

| Exercice | Statut | Équipement | Muscles principaux (×1) | Muscles secondaires (×0,5) | Unilatéral | Remplaçants (autre équipement ; gêne articulaire courante) |
|---|---|---|---|---|---|---|
| squat (barre) | déjà présent | barre, support | quadriceps | fessiers, adducteurs | non | autre équipement : presse à cuisses ; gêne articulaire courante : fentes (haltères) ou presse à cuisses |
| développé couché (barre) | déjà présent | barre, banc | pectoraux | épaules (avant), triceps | non | autre équipement : développé incliné (haltères) si pas de barre ni de support ; gêne articulaire courante : développé incliné (haltères), prise libre |
| rowing buste penché (barre) | déjà présent | barre | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : tirage vertical (poulie), buste soutenu |
| leg curl | déjà présent | machine | ischio-jambiers | — | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : — |
| élévations latérales (haltères) | déjà présent | haltères | épaules (côté) | — | non | autre équipement : pas d'équivalent présent (l'exercice peut se faire à la poulie : variante non présente) ; gêne articulaire courante : développé militaire (barre), en secondaire |
| curl biceps (haltères) | déjà présent | haltères | biceps | avant-bras | non | autre équipement : curl marteau (haltères) ; gêne articulaire courante : curl marteau (haltères), prise neutre |
| gainage ventral | déjà présent | poids du corps | abdominaux | obliques | non | autre équipement : gainage latéral ; gêne articulaire courante : relevés de jambes suspendu (barre fixe) |
| presse à cuisses | déjà présent | machine | quadriceps | fessiers, adducteurs | non | autre équipement : squat (barre) ; gêne articulaire courante : fentes (haltères) |
| développé incliné (haltères) | déjà présent | haltères, banc incliné | pectoraux | épaules (avant), triceps | non | autre équipement : développé couché (barre) sans haltères lourds ; gêne articulaire courante : écarté couché (haltères), amplitude réduite |
| tirage vertical (poulie) | déjà présent | poulie haute | dorsaux | biceps | non | autre équipement : tractions pronation (barre fixe) ; gêne articulaire courante : tirage horizontal (poulie) |
| soulevé de terre jambes tendues (barre) | déjà présent | barre | ischio-jambiers | fessiers, lombaires | non | autre équipement : hip thrust (barre) ; gêne articulaire courante : leg curl |
| développé militaire (barre) | déjà présent | barre | épaules (avant) | épaules (côté), triceps | non | autre équipement : développé incliné (haltères) ; gêne articulaire courante : élévations latérales (haltères) |
| extension triceps à la poulie | déjà présent | poulie | triceps | — | non | autre équipement : barre au front (barre EZ) ; gêne articulaire courante : dips (barres parallèles) en secondaire |
| mollets debout (machine) | déjà présent | machine | mollets | — | non | autre équipement : mollets debout à une jambe (haltère) sans machine, à ajouter ; gêne articulaire courante : — |
| relevés de jambes suspendu (barre fixe) | déjà présent | barre fixe | abdominaux | — | non | autre équipement : gainage ventral sans barre fixe ; gêne articulaire courante : gainage ventral |

*Remplaçants : pratique de terrain, aucune preuve citée ; seuls les exercices déjà présents sont proposés, sauf mention « à ajouter ». « Gêne articulaire courante » ne veut dire ni diagnostic ni prescription : l'application propose une autre façon de solliciter le muscle, la personne choisit.*

---

### M6 — Maison, haltères et poids du corps, 3 jours

| Rubrique | Contenu |
|---|---|
| Nom | Maison, haltères et poids du corps, 3 jours |
| Description | Trois séances de **corps entier** (Maison A, B, C) à faire sur des jours non consécutifs, avec une paire d'haltères (idéalement réglables), le poids du corps, un sol, une chaise ou une marche. Les pectoraux, les dorsaux, les cuisses, les fessiers, les deux parties des épaules (avant, côté), les biceps et les triceps sont travaillés trois fois par semaine ; les ischio-jambiers et les mollets deux fois. Les fourchettes de répétitions sont plus hautes qu'en salle (10 à 15, 12 à 20) parce que les haltères sont légers. Le gainage ventral est dans la séance A, le gainage latéral dans la séance B. |
| Public | Pratiquants sans salle : novices et intermédiaires. Les essais d'hypertrophie au poids du corps ou aux charges légères portent sur des hommes jeunes non entraînés, des femmes sédentaires jeunes et des adultes âgés non entraînés (D08-01, D08-06, D08-14, D08-16) ; pour un **avancé**, aucun essai d'hypertrophie au poids du corps n'a été trouvé (D08-03 donne de la force seulement). |
| Séances par semaine (`parSemaine`) | 3 |
| Séries de travail par semaine | 67 |
| Durée estimée par séance (hors échauffement ; calcul simple : 40 s par série plus repos) | 46 / 53 / 58 min |
| Équipement | maison : une paire d'haltères (idéalement réglables), le poids du corps, un sol, une chaise ou une marche, un appui (canapé, banc ou chaise) |
| Découpage documenté dans | D08 |

**Ce que disent les sources de ce découpage.** Fiche D08 (point 7.1). Pompes : D08-01, D08-02, D08-04, D08-05. Charge légère menée près de l'échec : D08-14, D08-15, H03-01, H03-02. Unilatéral (fentes, rowing à un bras, mollets à une jambe) : D08-13, D08-31. Fessiers et ischio-jambiers sans machine : D08-35, D08-36, D08-37, D08-39. Mollets : D08-40, D08-41. Épaules et triceps : D08-45, D08-46, D08-47. Corps entier sur 3 jours : D05-01, D05-03. Élastique ou sangle à la place d'un haltère : D08-52.

**Limites.** **Sept exercices sont à ajouter** (point 9) et **aucun n'a été testé tel quel** : le rowing à un bras, le développé d'épaules aux haltères, le soulevé jambes tendues aux haltères, le hip thrust à l'haltère et l'extension du triceps à l'haltère n'ont que des essais voisins (D08-35, D08-43, D08-44, D08-46, D08-47). Pas de tirage vertical sans barre fixe : les dorsaux ne sont travaillés que par le rowing (cibles à 9). **Sous le minimum d'environ 4** : avant-bras, lombaires, abdominaux, obliques et cou (voir le tableau des cibles). Avec des haltères légers, les séries doivent s'approcher de l'échec : s'arrêter loin de l'échec à charge très légère a donné un gain faible et non significatif (D08-14) ; la fourchette de répétitions réelle dépend donc de la personne et du poids dont elle dispose. La preuve des pompes est partagée (D08-01, D08-02).

#### Séance « Maison A » (20 séries, environ 46 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | pompes | 3 | 8 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-04 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11, D08-14 ; choix : D08-01, D08-02, D08-05 | choisir la variante qui permet 8 à 20 répétitions (échelle de difficulté : D08-05) Exercice à ajouter (R4). |
| 2 | fentes (haltères) | 3 | 10 | 15 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09, D08-31, D08-34 | Une série = les deux côtés faits (compte pour 1 série). |
| 3 | rowing à un bras (haltère) | 3 | 10 | 15 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-43, D08-44 | Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4). |
| 4 | développé épaules (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-46 | Exercice à ajouter (R4). |
| 5 | élévations latérales (haltères) | 2 | 12 | 20 | 75 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 6 | curl biceps (haltères) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |
| 7 | extension triceps au-dessus de la tête (haltère) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-47 | Exercice à ajouter (R4). |
| 8 | gainage ventral | 2 | 30 | 60 | 60 | — | 1 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. |

#### Séance « Maison B » (23 séries, environ 53 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | soulevé de terre jambes tendues (haltères) | 3 | 10 | 15 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-37, D08-39 | Exercice à ajouter (R4). |
| 2 | fentes (haltères) | 3 | 10 | 15 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09, D08-31, D08-34 | Une série = les deux côtés faits (compte pour 1 série). |
| 3 | pompes | 3 | 8 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-04 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11, D08-14 ; choix : D08-01, D08-02, D08-05 | choisir la variante qui permet 8 à 20 répétitions (échelle de difficulté : D08-05) Exercice à ajouter (R4). |
| 4 | rowing à un bras (haltère) | 3 | 10 | 15 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-43, D08-44 | Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4). |
| 5 | élévations latérales (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 6 | curl marteau (haltères) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |
| 7 | mollets debout à une jambe (haltère) | 4 | 12 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : D08-40, D08-41 | Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4). |
| 8 | gainage latéral | 2 | 30 | 60 | 60 | — | 1 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. Une série = les deux côtés faits (compte pour 1 série). |

#### Séance « Maison C » (24 séries, environ 58 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | fentes (haltères) | 3 | 10 | 15 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09, D08-31, D08-34 | Une série = les deux côtés faits (compte pour 1 série). |
| 2 | hip thrust (haltère) | 3 | 10 | 15 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-35, D08-36 | Exercice à ajouter (R4). |
| 3 | soulevé de terre jambes tendues (haltères) | 2 | 10 | 15 | 120 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-37, D08-39 | Exercice à ajouter (R4). |
| 4 | pompes | 3 | 8 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-04 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11, D08-14 ; choix : D08-01, D08-02, D08-05 | Exercice à ajouter (R4). |
| 5 | rowing à un bras (haltère) | 3 | 10 | 15 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-43, D08-44 | Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4). |
| 6 | développé épaules (haltères) | 2 | 8 | 12 | 120 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-46 | Exercice à ajouter (R4). |
| 7 | élévations latérales (haltères) | 2 | 12 | 20 | 75 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 8 | extension triceps au-dessus de la tête (haltère) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-47 | Exercice à ajouter (R4). |
| 9 | mollets debout à une jambe (haltère) | 4 | 12 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : D08-40, D08-41 | Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4). |

#### Cibles hebdomadaires de séries par muscle (`ciblesParMuscle`), calculées

| Muscle | Calcul (séries × coefficient) | Cible hebdomadaire (séries) | Passages par semaine | Maximum dans une séance | Position face au dossier | Alerte |
|---|---|---|---|---|---|---|
| pectoraux | pompes (3+3+3)×1 | 9 | 3 | 3 | entre le minimum et le repère (≈ 10) | — |
| épaules (avant) | pompes (3+3+3)×0,5 + développé épaules (3+2)×1 | 9,5 | 3 | 4,5 | entre le minimum et le repère (≈ 10) | — |
| épaules (côté) | développé épaules (3+2)×0,5 + élévations latérales (2+3+2)×1 | 9,5 | 3 | 3,5 | entre le minimum et le repère (≈ 10) | — |
| épaules (arrière) | rowing à un bras (3+3+3)×0,5 | 4,5 | 3 | 1,5 | entre le minimum et le repère (≈ 10) | — |
| biceps | rowing à un bras (3+3+3)×0,5 + curl biceps 2×1 + curl marteau 2×1 | 8,5 | 3 | 3,5 | entre le minimum et le repère (≈ 10) | — |
| triceps | pompes (3+3+3)×0,5 + développé épaules (3+2)×0,5 + extension triceps au-dessus de la tête (2+2)×1 | 11 | 3 | 5 | dans le repère (≈ 10 à 12) | — |
| avant-bras | curl biceps 2×0,5 + curl marteau 2×0,5 | 2 | 2 | 1 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| dorsaux | rowing à un bras (3+3+3)×1 | 9 | 3 | 3 | entre le minimum et le repère (≈ 10) | — |
| trapèzes | rowing à un bras (3+3+3)×0,5 | 4,5 | 3 | 1,5 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| lombaires | SDT jambes tendues (haltères) (3+2)×0,5 | 2,5 | 2 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| abdominaux | gainage ventral 2×1 + gainage latéral 2×0,5 | 3 | 2 | 2 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| obliques | gainage ventral 2×0,5 + gainage latéral 2×1 | 3 | 2 | 2 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| quadriceps | fentes (3+3+3)×1 | 9 | 3 | 3 | entre le minimum et le repère (≈ 10) | — |
| ischio-jambiers | SDT jambes tendues (haltères) (3+2)×1 + hip thrust 3×0,5 | 6,5 | 2 | 3,5 | entre le minimum et le repère (≈ 10) | — |
| fessiers | fentes (3+3+3)×0,5 + SDT jambes tendues (haltères) (3+2)×0,5 + hip thrust 3×1 | 10 | 3 | 5,5 | dans le repère (≈ 10 à 12) | — |
| adducteurs | fentes (3+3+3)×0,5 | 4,5 | 3 | 1,5 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| mollets | mollets debout à une jambe (4+4)×1 | 8 | 2 | 4 | entre le minimum et le repère (≈ 10) | — |
| cou | aucun exercice | 0 | 0 | 0 | non programmé (aucun repère propre à ce muscle : non trouvé) | — |

*Repères : minimum ≈ 4 séries fractionnées (H01-06) ; repère ≈ 10 (H01-14) ; 12 à 20 (H01-09) ; ≈ 10 à 11 par séance (H01-19, D03-06) ; ≥ 2 passages (H01-14, D01-04) ; à volume égal, la fréquence n'a pas d'effet mesuré sur l'hypertrophie (H02-02, H01-20).*

**Ce qui sort des fourchettes du dossier.**

| Critère | Muscles concernés |
|---|---|
| Sous le minimum d'environ 4 séries (H01-06) | avant-bras (2), lombaires (2,5), abdominaux (3), obliques (3), cou (0) |
| Grand groupe entre 4 et 10 séries, sous le repère d'environ 10 (H01-14) | pectoraux (9), épaules (avant) (9,5), épaules (côté) (9,5), épaules (arrière) (4,5), biceps (8,5), dorsaux (9), quadriceps (9), ischio-jambiers (6,5), mollets (8) |
| Au-dessus de 12 séries (plage 12 à 20 de H01-09) | aucun |
| Plus de 10 séries pondérées dans une séance (H01-19, D03-06) | aucun |
| Un seul passage par semaine pour un grand groupe, sous le repère ≥ 2 jours (D01-04) | aucun |

**Sensibilité à la convention de muscles.** Si la bibliothèque réelle classe les fessiers en muscle **principal** au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 10 à 14,5 séries par semaine ; les autres cibles ne changent pas.

**Progression.** Double progression, *pratique de terrain non démontrée* (H06-02) : voir le point 4. **Pompes** : monter par variantes (échelle D08-05, de 0,41 à 0,74 de la masse corporelle). Règle testée sur 4 semaines : départ à 3 × 6, une répétition de plus par série à chaque séance, variante plus difficile quand 3 × 8 est tenu deux séances de suite, retour à 3 × 6 (D08-02) ; l'effet sur la masse n'a pas été démontré en 4 semaines. **Haltères trop légers** : passer à l'unilatéral, ajouter des répétitions, s'approcher de l'échec (D08-14), ralentir la descente (le tempo est une information, pas une règle : D08-09 à D08-12). Pratique courante, non démontrée (D08-53).

**Déload type.** Pratique d'entraîneurs (H09-12, H09-13) et consensus sur la forme (H09-10, H09-11) : voir le point 5 ; la colonne « Déload » de chaque tableau de séance donne les séries et le RIR.

#### Exercices du modèle

| Exercice | Statut | Équipement | Muscles principaux (×1) | Muscles secondaires (×0,5) | Unilatéral | Remplaçants (autre équipement ; gêne articulaire courante) |
|---|---|---|---|---|---|---|
| pompes | à ajouter | poids du corps (sol) | pectoraux | épaules (avant), triceps | non | autre équipement : développé incliné (haltères) si un banc est disponible ; gêne articulaire courante : pompes mains surélevées ou à genoux (variantes plus faciles : D08-05) |
| fentes (haltères) | déjà présent | haltères | quadriceps | fessiers, adducteurs | oui | autre équipement : fentes avec le pied arrière sur une chaise (variante interchangeable pour l'hypertrophie : D08-31) ; presse à cuisses si une machine est disponible ; gêne articulaire courante : fentes (haltères), amplitude réduite |
| rowing à un bras (haltère) | à ajouter | haltère, appui (chaise, banc) | dorsaux | trapèzes, épaules (arrière), biceps | oui | autre équipement : tractions pronation (barre fixe) si une barre fixe est disponible ; tirage horizontal (poulie) si une poulie est disponible ; gêne articulaire courante : rowing à un bras, buste soutenu par l'appui |
| développé épaules (haltères) | à ajouter | haltères | épaules (avant) | épaules (côté), triceps | non | autre équipement : développé militaire (barre) si une barre est disponible ; gêne articulaire courante : élévations latérales (haltères), en secondaire |
| élévations latérales (haltères) | déjà présent | haltères | épaules (côté) | — | non | autre équipement : élévations latérales à l'élastique ou à la sangle (force équivalente : D08-52 ; hypertrophie : non trouvé) ; gêne articulaire courante : développé épaules (haltères), en secondaire |
| curl biceps (haltères) | déjà présent | haltères | biceps | avant-bras | non | autre équipement : curl marteau (haltères) ; gêne articulaire courante : curl marteau (haltères), prise neutre |
| extension triceps au-dessus de la tête (haltère) | à ajouter | haltère | triceps | — | non | autre équipement : extension triceps à la poulie ou barre au front (barre EZ) si le matériel existe ; gêne articulaire courante : pompes, en secondaire |
| gainage ventral | déjà présent | poids du corps | abdominaux | obliques | non | autre équipement : gainage latéral ; gêne articulaire courante : relevés de jambes suspendu (barre fixe) si une barre fixe est disponible |
| soulevé de terre jambes tendues (haltères) | à ajouter | haltères | ischio-jambiers | fessiers, lombaires | non | autre équipement : soulevé de terre jambes tendues (barre) si une barre est disponible ; gêne articulaire courante : hip thrust (haltère) |
| curl marteau (haltères) | déjà présent | haltères | biceps | avant-bras | non | curl biceps (haltères) (autre équipement et gêne articulaire) |
| mollets debout à une jambe (haltère) | à ajouter | haltère, marche | mollets | — | oui | autre équipement : mollets debout (machine) si une machine est disponible ; gêne articulaire courante : — |
| gainage latéral | déjà présent | poids du corps | obliques | abdominaux | oui | gainage ventral (autre équipement et gêne articulaire) |
| hip thrust (haltère) | à ajouter | haltère, appui (canapé, banc, chaise) | fessiers | ischio-jambiers | non | autre équipement : hip thrust (barre) si barre et banc ; gêne articulaire courante : soulevé de terre jambes tendues (haltères) |

*Remplaçants : pratique de terrain, aucune preuve citée ; seuls les exercices déjà présents sont proposés, sauf mention « à ajouter ». « Gêne articulaire courante » ne veut dire ni diagnostic ni prescription : l'application propose une autre façon de solliciter le muscle, la personne choisit.*

---

### M7 — Haut / Bas, 4 jours, avec bloc de spécialisation des épaules (côté)

| Rubrique | Contenu |
|---|---|
| Nom | Haut / Bas, 4 jours, avec bloc de spécialisation des épaules (côté) |
| Description | Le **Haut/Bas 4 jours** (M3) auquel s'ajoute un **bloc de spécialisation sur les épaules (côté)**, pris comme exemple de la recette de la fiche D09. La cible hebdomadaire des épaules (côté) passe de 6 à 11 séries fractionnées, en **3 passages** (Haut A, Haut B, Bas B) ; elle est financée par −2,5 séries pour les biceps, −1 pour les dorsaux, −1 pour les mollets et −1 pour les abdominaux, et −1 pour les avant-bras (effet de la baisse des curls). **Bloc de 6 semaines suivi d'une semaine de déload**, renouvelable une fois, puis retour à M3 (choix du dossier, D09-18, D09-19). |
| Public | Intermédiaires et avancés qui jugent un muscle en retard et ont déjà un volume de base. Les pages de coachs réservent la spécialisation aux personnes avancées, hors déficit calorique (D09-26) ; **ne pas proposer en phase `sèche`**. |
| Séances par semaine (`parSemaine`) | 4 |
| Séries de travail par semaine | 77 |
| Durée estimée par séance (hors échauffement ; calcul simple : 40 s par série plus repos) | 50 / 39 / 54 / 44 min |
| Équipement | salle : comme le Haut/Bas 4 jours |
| Découpage documenté dans | D03, D09 |

**Ce que disent les sources de ce découpage.** Fiche D09 (point 7.2) et recette. Relèvement : +4 à +6 séries (environ +50 %) chez les coachs (D09-09, D09-10) ; ici +5, de 6 à 11 : **sous la plage 12 à 18 de la fiche** parce que la base de 6 est basse. Essais voisins : D09-02 (volume relevé sans gain d'épaisseur du coude chez 42 entraînés ; exemple du résumé : +4 séries par semaine), D09-03 (16 contre 8 séries, avantage détectable pour l'hypertrophie), D09-05. Réduction ailleurs : D09-11, D09-12, D09-21, H10-08. Structure de base : D03-01, D03-02, D03-05, D03-06.

**Limites.** **Aucune étude ne teste cette phase** (D09-01) ; le relèvement de 6 à 11 séries n'est pas démontré, et un volume relevé (exemple : +4 séries par semaine) n'a rien changé chez des entraînés (D09-02). Aucun plafond de volume total sourcé (D09-22). Les baisses ailleurs (−1 à −2,5 séries) sont **plus douces** que celles de RP (environ 4 séries par muscle, D09-11) et du même ordre que celles d'Alpha (−2, D09-12). La séance Bas B passe à 19 séries avec un bloc de côté de 2 séries ajoutées à la fin.

#### Séance « Haut A » (19 séries, environ 50 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | développé couché (barre) | 4 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 2 | rowing buste penché (barre) | 3 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01 |  |
| 3 | développé militaire (barre) | 2 | 8 | 12 | 150 | 2-3 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-01, H07-03 |  |
| 4 | tirage vertical (poulie) | 2 | 8 | 12 | 120 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-07 |  |
| 5 | élévations latérales (haltères) | 4 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 6 | extension triceps à la poulie | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06, H07-11 | Si la variante existe, bras au-dessus de la tête (H07-11). |
| 7 | curl biceps (haltères) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |

#### Séance « Bas A » (16 séries, environ 39 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | squat (barre) | 4 | 6 | 10 | 150 | 2-3 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09 |  |
| 2 | soulevé de terre jambes tendues (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-39 |  |
| 3 | leg curl | 3 | 10 | 15 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-11 | Assis plutôt que couché si l'appareil le permet (H07-11). |
| 4 | mollets debout (machine) | 3 | 10 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |
| 5 | gainage ventral | 3 | 30 | 60 | 60 | — | 2 série(s), RIR — | choix : D08-51 | Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. |

#### Séance « Haut B » (23 séries, environ 54 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | développé incliné (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 2 | tractions pronation (barre fixe) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05 |  |
| 3 | dips (barres parallèles) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 |  |
| 4 | tirage horizontal (poulie) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-07 |  |
| 5 | élévations latérales (haltères) | 4 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 |  |
| 6 | oiseau (haltères) | 3 | 12 | 20 | 75 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |
| 7 | barre au front (barre EZ) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-06 |  |
| 8 | curl marteau (haltères) | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-05, H07-06 |  |

#### Séance « Bas B » (19 séries, environ 44 min hors échauffement : calcul simple, 40 s par série plus repos)

| # | Exercice | Séries | Répét. min | Répét. max | Repos (s) | RIR visé | Déload : séries, RIR | ID du dossier qui justifient | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | presse à cuisses | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-07, H07-08 |  |
| 2 | fentes (haltères) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, H07-09, D08-31, D08-34 | Une série = les deux côtés faits (compte pour 1 série). |
| 3 | hip thrust (barre) | 3 | 8 | 12 | 120 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-08, H03-09, H06-04 ; repos : H05-04, H05-10 ; RIR : H04-01, H04-05, H04-11 ; choix : H07-08, D08-35, D08-36 |  |
| 4 | adducteurs à la machine | 2 | 10 | 15 | 90 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-06, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 |  |
| 5 | mollets debout (machine) | 4 | 10 | 20 | 90 | 1-2 | 2 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H07-10, H07-12, H03-08 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05 ; choix : H07-12, H07-10, D08-40, D08-41 |  |
| 6 | relevés de jambes suspendu (barre fixe) | 2 | 8 | 15 | 60 | 1-2 | 1 série(s), RIR 3-4 | RIR : H04-01 ; choix : D08-50 |  |
| 7 | élévations latérales (haltères) | 2 | 12 | 20 | 75 | 1-2 | 1 série(s), RIR 3-4 | séries : H01-06, H01-14, H01-19 ; répét. : H03-01, H03-06, H03-08, D08-14 ; repos : H05-04, H05-05 ; RIR : H04-01, H04-05, H04-11 ; choix : D08-45 | séries ajoutées pour le bloc de spécialisation (troisième passage du muscle visé) |

#### Cibles hebdomadaires de séries par muscle (`ciblesParMuscle`), calculées

| Muscle | Calcul (séries × coefficient) | Cible hebdomadaire (séries) | Passages par semaine | Maximum dans une séance | Position face au dossier | Alerte |
|---|---|---|---|---|---|---|
| pectoraux | développé couché 4×1 + développé incliné 3×1 + dips 3×1 | 10 | 2 | 6 | dans le repère (≈ 10 à 12) | — |
| épaules (avant) | développé couché 4×0,5 + développé militaire 2×1 + développé incliné 3×0,5 + dips 3×0,5 | 7 | 2 | 4 | entre le minimum et le repère (≈ 10) | — |
| épaules (côté) | développé militaire 2×0,5 + élévations latérales (4+4+2)×1 | 11 | 3 | 5 | dans le repère (≈ 10 à 12) | — |
| épaules (arrière) | rowing buste penché 3×0,5 + tirage horizontal 3×0,5 + oiseau 3×1 | 6 | 2 | 4,5 | entre le minimum et le repère (≈ 10) | — |
| biceps | rowing buste penché 3×0,5 + tirage vertical 2×0,5 + curl biceps 2×1 + tractions pronation 3×0,5 + tirage horizontal 3×0,5 + curl marteau 2×1 | 9,5 | 2 | 5 | entre le minimum et le repère (≈ 10) | — |
| triceps | développé couché 4×0,5 + développé militaire 2×0,5 + extension triceps à la poulie 2×1 + développé incliné 3×0,5 + dips 3×1 + barre au front 2×1 | 11,5 | 2 | 6,5 | dans le repère (≈ 10 à 12) | — |
| avant-bras | curl biceps 2×0,5 + curl marteau 2×0,5 | 2 | 2 | 1 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| dorsaux | rowing buste penché 3×1 + tirage vertical 2×1 + tractions pronation 3×1 + tirage horizontal 3×1 | 11 | 2 | 6 | dans le repère (≈ 10 à 12) | — |
| trapèzes | rowing buste penché 3×0,5 + tirage horizontal 3×0,5 + oiseau 3×0,5 | 4,5 | 2 | 3 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| lombaires | SDT jambes tendues (barre) 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| abdominaux | gainage ventral 3×1 + relevés de jambes suspendu 2×1 | 5 | 2 | 3 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| obliques | gainage ventral 3×0,5 | 1,5 | 1 | 1,5 | sous le minimum (≈ 4) (repère général : aucune donnée propre à ce muscle) | — |
| quadriceps | squat 4×1 + presse à cuisses 3×1 + fentes 3×1 | 10 | 2 | 6 | dans le repère (≈ 10 à 12) | — |
| ischio-jambiers | SDT jambes tendues (barre) 3×1 + leg curl 3×1 + hip thrust 3×0,5 | 7,5 | 2 | 6 | entre le minimum et le repère (≈ 10) | — |
| fessiers | squat 4×0,5 + SDT jambes tendues (barre) 3×0,5 + presse à cuisses 3×0,5 + fentes 3×0,5 + hip thrust 3×1 | 9,5 | 2 | 6 | entre le minimum et le repère (≈ 10) | — |
| adducteurs | squat 4×0,5 + presse à cuisses 3×0,5 + fentes 3×0,5 + adducteurs à la machine 2×1 | 7 | 2 | 5 | entre le minimum et le repère (≈ 10) (repère général : aucune donnée propre à ce muscle) | — |
| mollets | mollets debout (3+4)×1 | 7 | 2 | 4 | entre le minimum et le repère (≈ 10) | — |
| cou | aucun exercice | 0 | 0 | 0 | non programmé (aucun repère propre à ce muscle : non trouvé) | — |

*Repères : minimum ≈ 4 séries fractionnées (H01-06) ; repère ≈ 10 (H01-14) ; 12 à 20 (H01-09) ; ≈ 10 à 11 par séance (H01-19, D03-06) ; ≥ 2 passages (H01-14, D01-04) ; à volume égal, la fréquence n'a pas d'effet mesuré sur l'hypertrophie (H02-02, H01-20).*

**Ce qui sort des fourchettes du dossier.**

| Critère | Muscles concernés |
|---|---|
| Sous le minimum d'environ 4 séries (H01-06) | avant-bras (2), lombaires (1,5), obliques (1,5), cou (0) |
| Grand groupe entre 4 et 10 séries, sous le repère d'environ 10 (H01-14) | épaules (avant) (7), épaules (arrière) (6), biceps (9,5), ischio-jambiers (7,5), fessiers (9,5), mollets (7) |
| Au-dessus de 12 séries (plage 12 à 20 de H01-09) | aucun |
| Plus de 10 séries pondérées dans une séance (H01-19, D03-06) | aucun |
| Un seul passage par semaine pour un grand groupe, sous le repère ≥ 2 jours (D01-04) | aucun |

**Sensibilité à la convention de muscles.** Si la bibliothèque réelle classe les fessiers en muscle **principal** au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 9,5 à 14,5 séries par semaine ; les autres cibles ne changent pas.

**Progression.** Double progression, *pratique de terrain non démontrée* (H06-02) : voir le point 4. **Rampe du bloc** (choix du dossier, d'après D09-10 et D09-25 : monter d'abord par une progression de séries dans le cycle) : semaines 1-2, épaules (côté) à 9 séries par semaine (2 séries de moins que la cible) ; semaines 3-4, 10 ; semaines 5-6, 11. Commencer à 3 RIR et finir à 1 RIR (D09-14). Puis une semaine de déload (point 5), puis retour aux cibles de M3 ou deuxième bloc.

**Déload type.** Pratique d'entraîneurs (H09-12, H09-13) et consensus sur la forme (H09-10, H09-11) : voir le point 5 ; la colonne « Déload » de chaque tableau de séance donne les séries et le RIR.

#### Exercices du modèle

| Exercice | Statut | Équipement | Muscles principaux (×1) | Muscles secondaires (×0,5) | Unilatéral | Remplaçants (autre équipement ; gêne articulaire courante) |
|---|---|---|---|---|---|---|
| développé couché (barre) | déjà présent | barre, banc | pectoraux | épaules (avant), triceps | non | autre équipement : développé incliné (haltères) si pas de barre ni de support ; gêne articulaire courante : développé incliné (haltères), prise libre |
| rowing buste penché (barre) | déjà présent | barre | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : tirage vertical (poulie), buste soutenu |
| développé militaire (barre) | déjà présent | barre | épaules (avant) | épaules (côté), triceps | non | autre équipement : développé incliné (haltères) ; gêne articulaire courante : élévations latérales (haltères) |
| tirage vertical (poulie) | déjà présent | poulie haute | dorsaux | biceps | non | autre équipement : tractions pronation (barre fixe) ; gêne articulaire courante : tirage horizontal (poulie) |
| élévations latérales (haltères) | déjà présent | haltères | épaules (côté) | — | non | autre équipement : pas d'équivalent présent (l'exercice peut se faire à la poulie : variante non présente) ; gêne articulaire courante : développé militaire (barre), en secondaire |
| extension triceps à la poulie | déjà présent | poulie | triceps | — | non | autre équipement : barre au front (barre EZ) ; gêne articulaire courante : dips (barres parallèles) en secondaire |
| curl biceps (haltères) | déjà présent | haltères | biceps | avant-bras | non | autre équipement : curl marteau (haltères) ; gêne articulaire courante : curl marteau (haltères), prise neutre |
| squat (barre) | déjà présent | barre, support | quadriceps | fessiers, adducteurs | non | autre équipement : presse à cuisses ; gêne articulaire courante : fentes (haltères) ou presse à cuisses |
| soulevé de terre jambes tendues (barre) | déjà présent | barre | ischio-jambiers | fessiers, lombaires | non | autre équipement : hip thrust (barre) ; gêne articulaire courante : leg curl |
| leg curl | déjà présent | machine | ischio-jambiers | — | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : — |
| mollets debout (machine) | déjà présent | machine | mollets | — | non | autre équipement : mollets debout à une jambe (haltère) sans machine, à ajouter ; gêne articulaire courante : — |
| gainage ventral | déjà présent | poids du corps | abdominaux | obliques | non | autre équipement : gainage latéral ; gêne articulaire courante : relevés de jambes suspendu (barre fixe) |
| développé incliné (haltères) | déjà présent | haltères, banc incliné | pectoraux | épaules (avant), triceps | non | autre équipement : développé couché (barre) sans haltères lourds ; gêne articulaire courante : écarté couché (haltères), amplitude réduite |
| tractions pronation (barre fixe) | déjà présent | barre fixe | dorsaux | biceps | non | autre équipement : tirage vertical (poulie) sans barre fixe ; gêne articulaire courante : rowing buste penché (barre) |
| dips (barres parallèles) | déjà présent | barres parallèles | pectoraux, triceps | épaules (avant) | non | autre équipement : développé incliné (haltères) sans barres parallèles ; gêne articulaire courante : extension triceps à la poulie |
| tirage horizontal (poulie) | déjà présent | poulie basse | dorsaux | trapèzes, épaules (arrière), biceps | non | autre équipement : rowing buste penché (barre) ; gêne articulaire courante : tirage vertical (poulie) |
| oiseau (haltères) | déjà présent | haltères | épaules (arrière) | trapèzes | non | autre équipement : tirage horizontal (poulie) ; gêne articulaire courante : — |
| barre au front (barre EZ) | déjà présent | barre EZ, banc | triceps | — | non | extension triceps à la poulie (autre équipement et gêne articulaire) |
| curl marteau (haltères) | déjà présent | haltères | biceps | avant-bras | non | curl biceps (haltères) (autre équipement et gêne articulaire) |
| presse à cuisses | déjà présent | machine | quadriceps | fessiers, adducteurs | non | autre équipement : squat (barre) ; gêne articulaire courante : fentes (haltères) |
| fentes (haltères) | déjà présent | haltères | quadriceps | fessiers, adducteurs | oui | autre équipement : presse à cuisses ; gêne articulaire courante : presse à cuisses, charge réduite |
| hip thrust (barre) | déjà présent | barre, banc | fessiers | ischio-jambiers | non | autre équipement : soulevé de terre jambes tendues (barre) ; gêne articulaire courante : fentes (haltères) |
| adducteurs à la machine | déjà présent | machine | adducteurs | — | non | autre équipement : pas d'équivalent présent ; gêne articulaire courante : — |
| relevés de jambes suspendu (barre fixe) | déjà présent | barre fixe | abdominaux | — | non | autre équipement : gainage ventral sans barre fixe ; gêne articulaire courante : gainage ventral |

*Remplaçants : pratique de terrain, aucune preuve citée ; seuls les exercices déjà présents sont proposés, sauf mention « à ajouter ». « Gêne articulaire courante » ne veut dire ni diagnostic ni prescription : l'application propose une autre façon de solliciter le muscle, la personne choisit.*

## 9. R4 — Les exercices à ajouter

La bibliothèque compte 30 exercices ; **les modèles de salle (M1 à M5, M7) n'en ajoutent aucun**. Le modèle Maison en demande 7. **Quatre sont nécessaires** (pompes, rowing à un bras, soulevé de terre jambes tendues aux haltères, mollets à une jambe) : sans eux, un grand groupe tombe à 0 ou près de 0. **Trois sont facultatifs** (développé d'épaules aux haltères, hip thrust à l'haltère, extension du triceps au-dessus de la tête) : sans eux, aucune cible ne passe sous 4 séries par semaine, mais elles baissent (dernière colonne). Un exercice présent est préféré chaque fois qu'il fait l'affaire ; pour chaque ajout, l'exercice présent le plus proche exige un matériel que le modèle Maison n'a pas (colonnes « Pourquoi… » et « Plus proche… »).

| Exercice à ajouter | Équipement | Muscles principaux | Muscles secondaires (×0,5) | Unilatéral | Modèle(s) qui l'utilisent | Pourquoi un exercice déjà présent ne suffit pas | Plus proche exercice présent | Sans cet ajout (modèle Maison, cibles qui changent, séries par semaine) |
|---|---|---|---|---|---|---|---|---|
| pompes | poids du corps (sol) | pectoraux | épaules (avant), triceps | non | M6 | aucune poussée présente ne se fait sans banc, sans barre ni sans barres parallèles | développé incliné (haltères) | pectoraux 9 → 0; épaules (avant) 9,5 → 5; triceps 11 → 6,5 |
| rowing à un bras (haltère) | haltère, appui (chaise, banc) | dorsaux | trapèzes, épaules (arrière), biceps | oui | M6 | aucun tirage horizontal présent sans barre ni poulie ; les tractions exigent une barre fixe | rowing buste penché (barre) | épaules (arrière) 4,5 → 0; biceps 8,5 → 4; dorsaux 9 → 0; trapèzes 4,5 → 0 |
| développé épaules (haltères) | haltères | épaules (avant) | épaules (côté), triceps | non | M6 | le seul développé d'épaules présent est à la barre | développé militaire (barre) | épaules (avant) 9,5 → 4,5; épaules (côté) 9,5 → 7; triceps 11 → 8,5 |
| extension triceps au-dessus de la tête (haltère) | haltère | triceps | — | non | M6 | les deux extensions présentes demandent une poulie ou une barre EZ avec un banc | extension triceps à la poulie | triceps 11 → 7 |
| soulevé de terre jambes tendues (haltères) | haltères | ischio-jambiers | fessiers, lombaires | non | M6 | la version présente est à la barre | soulevé de terre jambes tendues (barre) | lombaires 2,5 → 0; ischio-jambiers 6,5 → 1,5; fessiers 10 → 7,5 |
| mollets debout à une jambe (haltère) | haltère, marche | mollets | — | oui | M6 | le seul exercice de mollets présent est une machine | mollets debout (machine) | mollets 8 → 0 |
| hip thrust (haltère) | haltère, appui (canapé, banc, chaise) | fessiers | ischio-jambiers | non | M6 | la version présente est à la barre, avec un banc | hip thrust (barre) | ischio-jambiers 6,5 → 5; fessiers 10 → 7 |

## 10. Questions à trancher par l'utilisateur

| # | Question | Pourquoi elle compte | Options | Ce que dit le dossier |
|---|---|---|---|---|
| 1 | **Quel modèle par défaut, et combien de jours ?** | Chaque modèle propose un nombre de séances par semaine (`parSemaine`) et des cibles différentes | Haut/Bas 4 jours (2 passages par muscle) ; Full body 3 jours (2 à 3 passages) ; PPL 6 jours (2 passages, six jours) ; PPL 3 jours (1 passage) ; Full body 2 jours (volume économe) ; Maison 3 jours | Aucune étude lue ne compare ces modèles entre eux. Seuls repères : au moins 2 passages par grand groupe (ACSM 2026, D01-04) et environ 10 séries par groupe et par semaine (H01-14). Respectent les deux : PPL 6 jours, Haut/Bas 4 jours, Full body 3 jours (pour les grands groupes, selon la convention de muscles) |
| 2 | **Quel équipement pour la branche Maison ?** | Le modèle Maison est écrit avec une paire d'haltères, le poids du corps et un appui, **sans banc ni barre fixe** | Haltères réglables (jusqu'à quel poids ?) ; banc ; barre de traction ; élastique | Avec un banc : développé incliné et écartés deviennent possibles ; avec une barre fixe : tractions et relevés de jambes suspendu (déjà présents). Voir les remplaçants du modèle |
| 3 | **Quelle table de muscles principaux et secondaires ?** | Les cibles de ce fichier reposent sur une convention écrite sans accès à `BIBLIOTHEQUE` | Adopter la convention de ce fichier ; ou recalculer avec la bibliothèque réelle (les ID et les séries restent valables) | Sensibilité donnée dans chaque modèle (par exemple les fessiers du PPL 3 jours passent de 9 à 13,5 si le squat les compte en principal) |
| 4 | **Comment exprimer le gainage ?** | `BlocPrevu` a une fourchette de répétitions ; un maintien se compte en secondes | Répétitions = secondes (convention retenue) ; ou un champ de durée | Aucune source lue sur le gainage (non trouvé) : valeurs de 30 à 60 s à titre de choix |
| 5 | **Une série unilatérale compte-t-elle pour un côté ou pour deux ?** | Fentes, rowing à un bras, gainage latéral, mollets à une jambe | Une série = les deux côtés (convention retenue) ; ou une série par côté | Pas de règle dans les sources lues |
| 6 | **Faut-il distinguer des variantes dans la bibliothèque ?** | L'identité de comparaison d'un exercice inclut sa variante : « extension triceps à la poulie » au-dessus de la tête et « leg curl » assis ont donné plus de croissance que leurs variantes (H07-11) | Variante notée dans le nom ; exercice ajouté ; ou simple note du bloc (convention retenue) | Essais courts, petits effectifs (H07-11) |
| 7 | **Accepte-t-on les exercices à ajouter pour la maison ?** | Le tableau du point 9 en liste sept ; quatre sont nécessaires (sans eux un grand groupe tombe à 0 ou près de 0), trois sont facultatifs (sans eux aucune cible ne passe sous 4 séries, mais elles baissent) | Les sept ; les quatre nécessaires ; aucun (le modèle Maison n'a alors que huit exercices présents et laisse pectoraux, dorsaux, mollets et ischio-jambiers sans travail direct) | Chaque ajout est justifié et a un exercice présent le plus proche ; le tableau du point 9 chiffre ce que coûte chaque retrait |
| 8 | **Où ranger le RIR visé ?** | Les modèles donnent un RIR par bloc | Note du bloc ; champ propre ; ou valeur de phase | Le RIR est sous-estimé en moyenne (H04-11) : à présenter comme une aide, pas comme une mesure |
| 9 | **Stocker une cible unique ou une fourchette ?** | Le coefficient de 0,5 n'est pas mesuré ; l'estimation exploratoire est d'environ 0,32 (H01-24) | Valeur calculée à 0,5 (convention retenue) ; ou fourchette entre 0,32 et 0,5 pour les muscles surtout secondaires | Réserve de la source : le 0,5 peut être critiqué (H01-24) |
| 10 | **Programmer le cou, les avant-bras et les lombaires ?** | Ces muscles n'ont aucune donnée propre dans le dossier ; ils sont à 0 ou à peu de séries | Laisser à la personne (convention retenue) ; ajouter un bloc facultatif | Non trouvé |
| 11 | **Déload planifié ou à la demande ?** | Les deux sont acceptés par le consensus (H09-10) | Proposition tous les 4 à 6 semaines ; ou seulement à la demande | Pratique d'entraîneurs, non démontrée (H09-12) |
| 12 | **Durée acceptable d'une séance ?** | Les séances durent de 29 à 63 minutes selon le modèle (calcul simple, hors échauffement) | Garder ; ou proposer des versions plus courtes | Les supersets raccourcissent la séance d'environ 37 % à volume proche (H08-11) mais fatiguent plus (H08-13) |
| 13 | **Une phase « spécialisation » dans Cyclades ?** | Le modèle n'a pas de phase de ce type (prise de masse, sèche, maintien, déload, reprise) ; M7 en est un exemple chiffré | Module optionnel appliqué à un `Programme` (M7) ; simple relèvement manuel de `ciblesParMuscle` ; ou aucune | Aucune étude ne teste cette phase (D09-01) ; chiffres de terrain cohérents entre deux coachs, essais voisins mitigés (D09-02 à D09-05) |
| 14 | **Garder les sources fragiles dans les modèles ?** | Quelques lignes reposent sur une prépublication sans version publiée trouvée (D09-03), sur des prépublications publiées depuis mais relues en résumé seulement (D08-37, D09-04), sur un résumé de congrès (D09-02) ou sur un mémoire non publié en revue (D08-43, D08-46) | Les garder avec leur niveau de preuve (convention retenue) ; ou les retirer des modèles | Aucune valeur d'un modèle ne dépend d'elles seules : elles s'ajoutent à des lignes plus solides (D08-35, D08-31, H01-09) |

## 11. Limites de ce complément

- **Pas d'accès au code** : le modèle de Cyclades est pris tel que le pilote l'a relevé le 18/10 (commit `0c5b8c0`). Les 30 exercices viennent de la liste du prompt 47 bis ; leurs muscles principaux et secondaires sont une **convention du dossier**, à remplacer par `BIBLIOTHEQUE`.
- **Les ID de justification d'un bloc sont ceux de sa règle de type** (barres libres lourdes, polyarticulaires moyens, isolations, petits muscles, mollets), plus les ID de choix d'exercice quand une étude existe. Aucun essai ne teste ces exercices dans ces séances précises ; ils justifient la **fourchette**, pas la valeur exacte choisie dans la fourchette.
- **Aucune étude lue ne compare ces modèles entre eux** (D01 à D07). Les cibles sont jugées contre des repères moyens issus d'adultes surtout jeunes (H02-04), non contre un résultat mesuré.
- **Les valeurs de gainage, de relevés de jambes, de cou et d'abdominaux n'ont aucune source** ; elles sont marquées « aucune source lue ».
- **Le déload et la double progression sont de la pratique de terrain** (H09-12, H06-02) ; le consensus Delphi sur le déload ne donne ni durée ni pourcentage (H09-11).
- **ACSM 2026 : texte intégral non lu** (voir `00-synthese.md`) ; ses chiffres viennent du communiqué et de l'infographie (H01-14, D01-04).
- **Durées de séance** : calcul simple (40 s par série plus repos), hors échauffement et hors temps de réglage du matériel.
- **D08 et D09** : D08 compte 46 règles (D08-23 à D08-30 non attribuées) et D09 26. Les deux recherches ont utilisé au plus 14 recherches web chacune ; Europe PMC, Crossref et OpenAlex ont refusé plusieurs demandes (429) et des résumés ont été reconstruits via OpenAlex (statut « lu : résumé », ordre des mots déduit). Quatre familles de sources sont fragiles : prépublication sans version publiée trouvée (D09-03), prépublications publiées depuis mais relues en résumé seulement (D08-37, D09-04), résumé de congrès (D09-02), mémoires universitaires non publiés en revue (D08-43, D08-46). Une relecture indépendante de 24 des 72 règles D08 et D09 (16 confirmées, 8 à nuancer, 0 contredite) a corrigé le statut de D08-37 (publié en 2025), le sens de l'écart de D09-03 et la portée de D09-02 (un exemple, non une règle). **Aucune étude ne teste une spécialisation** (D09-01), ni le rowing à un bras, le développé au sol, le triceps ou le hip thrust à l'haltère.
- **Modèle Maison** : il a été conçu pour une paire d'haltères, le poids du corps et un appui. Pour un matériel plus riche (banc, barre fixe), les remplaçants de chaque tableau proposent des exercices déjà présents.
- **Aucun programme commercial n'est reproduit** : les structures publiques citées (D03-10, D05-11) ne sont décrites que dans le dossier du 18/10 ; les modèles de ce fichier sont des constructions propres, écrites à partir des fourchettes sourcées.
