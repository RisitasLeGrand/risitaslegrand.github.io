# Les questions de l'initialisation

Livrable de la phase 0, demandé en A.2 : « Le plan propose la liste exacte des questions, leur ordre
et leur formulation, et me la soumet. »

## La contrainte, et ce qu'elle impose

Le socle doit tenir en **trois minutes au plus**. À douze secondes par question — le temps de lire
une phrase et de toucher un bouton —, cela fait **quatorze questions**. Toute question ajoutée en
retire une autre : c'est pour ça que la liste est courte et que presque tout se répond en touchant,
pas en tapant.

Trois règles tenues partout :

- **Une question par écran.** Un formulaire de quatorze champs n'est pas une conversation, et il se
  ferme sans être rempli.
- **« Plus tard » sur tout, sauf le prénom.** Le bouton est visible, pas caché en bas.
- **Ce qui est détecté est proposé, jamais imposé** : la langue et le fuseau sont lus dans le
  navigateur et affichés comme une réponse à confirmer.

---

## 1. Socle commun — quatorze questions

| # | Question, telle qu'elle s'affiche | Réponse | Champ |
|---|---|---|---|
| 1 | **« Comment doit-on vous appeler ? »** | Saisie libre, un mot suffit | `prenom` *(obligatoire)* |
| 2 | **« On se tutoie, ou on se vouvoie ? »** | Deux boutons : « Tutoie-moi » · « Vouvoyez-moi » | `formalite` |
| 3 | **« Français, et heure de Paris : c'est bien ça ? »** | « Oui » · « Changer » (listes) | `langue`, `fuseau` |
| 4 | **« Qu'est-ce que vous faites dans la vie ? »** | Saisie libre avec suggestions (« étudiant·e », « agent public », « salarié·e du privé », « en préparation de concours », « en recherche d'emploi », « indépendant·e ») | `activite` |
| 5 | **« À quelle heure vous levez-vous, d'habitude ? »** | Molette d'heures, par quart d'heure | `lever` |
| 6 | **« Et vous couchez-vous ? »** | Idem | `coucher` |
| 7 | **« Quels jours travaillez-vous ? »** | Sept boutons à bascule, lundi–vendredi préchochés | `joursTravail` |
| 8 | **« Sur quelles plages ? »** | « Journée » · « Matin » · « Après-midi » · « Soir » · « Nuit » · « Variable » | `plagesTravail` |
| 9 | **« Qu'est-ce que vous voulez obtenir cette année ? »** | Saisie libre, plusieurs lignes possibles, trois au plus | `objectifsAnnee` |
| 10 | **« Et à plus long terme ? »** | Idem, deux au plus | `objectifsVie` |
| 11 | **« Combien de temps pouvez-vous y consacrer par semaine ? »** | Curseur de 0 à 40 h, pas d'une heure | `tempsParSemaine` |
| 12 | **« Lesquels de ces domaines voulez-vous suivre ? »** | Huit boutons à bascule ; Corps, Cognition, Connaissances, Psyché, Finances **activés**, Lien, Ordre, Œuvre **éteints** (décision 1 de la phase 0 d'Odyssée) | `domainesActifs` |
| 13 | **« Combien de temps par semaine pour chacun ? »** | Un curseur par domaine actif, repli sur « je ne sais pas encore » | `tempsParDomaine` |
| 14 | **« Comment Cyclades doit-il vous accompagner ? »** | « Discret » · « Normal » · « Soutenu », avec une phrase d'exemple sous chaque | `styleAccompagnement` |

**Pourquoi le lever est demandé si tôt** : il règle l'heure de bascule du jour logique (A.4). Un
lever à 11 h avec une bascule à 4 h coupe les soirées en deux, et c'est le réglage qui, mal posé,
fausse silencieusement toutes les séries.

**Pourquoi « ce que vous faites dans la vie » n'est pas une liste fermée** : le prompt dit « de
manière libre avec suggestions ». Une liste fermée obligerait quelqu'un en reconversion à mentir sur
sa situation dès la première minute.

**Ce qui n'est pas demandé, et ne le sera jamais ici** : rien sur la santé, les traitements, la
psyché ni les finances. Ces sujets ne sont proposés que dans leur domaine, avec l'usage qui en sera
fait, et toujours facultatifs (A.2, couche 3 ; garde-fous E.1 à E.4).

---

## 2. Modules par branche — posés à la première entrée dans la branche

### Révisions — six questions

| # | Question | Réponse | Champ |
|---|---|---|---|
| R1 | **« Quel concours préparez-vous ? »** | Les quatre parcours déclarés au registre, choix multiple ; le choix **active** les parcours correspondants | `concours` |
| R2 | **« Quand sont les épreuves ? »** | Date par concours, « je ne sais pas encore » accepté | `datesEpreuves` |
| R3 | **« Combien d'heures de révision par semaine ? »** | Curseur, prérempli depuis la question 11 | `heuresRevision` |
| R4 | **« Quelles matières vous semblent solides ? »** | Boutons à bascule sur les matières du parcours | `matieresFortes` |
| R5 | **« Et lesquelles vous inquiètent ? »** | Idem, exclusif des précédentes | `matieresFaibles` |
| R6 | **« Préférez-vous travailler le matin ou le soir ? »** | « Matin » · « Soir » · « Ça dépend » | `momentRevision` |

R4 et R5 nourrissent l'amorce de l'estimation de niveau (phase 10d), qui existe déjà et qui attend
aujourd'hui qu'on clique sur « situez-vous » dans Statistiques. Elles sont marquées **déclarées**, et
la première série de réponses réelles les remplace : une matière « solide » qu'on rate trois fois
n'est plus solide, et le niveau estimé le dira avant le profil.

### Sport — six questions

| # | Question | Réponse | Champ |
|---|---|---|---|
| S1 | **« Vous entraînez-vous déjà ? »** | « Jamais » · « Depuis moins d'un an » · « Un à trois ans » · « Plus de trois ans » | `experience` |
| S2 | **« Qu'est-ce que vous cherchez ? »** | « Force » · « Masse » · « Perte de gras » · « Santé » · « Endurance », choix multiple | `objectifsSport` |
| S3 | **« Combien de séances par semaine aimeriez-vous tenir ? »** | 1 à 7 | `frequenceSouhaitee` |
| S4 | **« Où vous entraînez-vous, et avec quoi ? »** | « Salle complète » · « Salle limitée » · « Maison, haltères » · « Maison, poids du corps » · « Dehors » | `lieuMateriel` |
| S5 | **« Y a-t-il une blessure ou une douleur dont Cyclades doit tenir compte ? »** | Facultative, saisie libre + schéma du corps ; **sensible**, reste dans Odyssée | `blessures` |
| S6 | **« Dans quelle phase êtes-vous ? »** | « Prise de masse » · « Sèche » · « Maintien » · « Reprise » · « Je ne sais pas » | `phase` |

S5 est le seul champ sensible d'un module de branche, et il ne va **pas** dans le profil commun : il
est publié comme fait `sport.blessure`, sous la matrice. L'écran le dit à ce moment-là — « cette
réponse reste dans Odyssée ; Sport la lit pour ne pas vous proposer de progresser ».

### Odyssée — cinq questions, toutes facultatives

| # | Question | Réponse | Champ |
|---|---|---|---|
| O1 | **« Quel équilibre voulez-vous viser entre vos domaines ? »** | Part par domaine actif, ou « égal » | `ciblesEquilibre` |
| O2 | **« À quelle fréquence voulez-vous faire le point ? »** | « Chaque semaine » · « Chaque mois » · « Les deux » · « Jamais » | `frequenceRevues` |
| O3 | **« Voulez-vous un check-in quotidien de moins de 30 secondes ? »** | « Oui » · « Une fois par semaine » · « Non » | `frequenceCheckin` |
| O4 | **« Voulez-vous suivre des comptes dans Finances ? »** | « Oui, je les ajouterai » · « Pas maintenant » — **jamais d'IBAN, jamais de numéro de compte** | `suiviFinances` |
| O5 | **« À quelle heure voulez-vous être relancé, si vous le voulez ? »** | Molette, ou « aucun rappel » | `heureRappel` |

---

## 3. Ce que l'initialisation écrit, et ce qu'elle en déduit

Chaque réponse devient un champ de profil `source: 'declare'`. Les **déductions** sont des réglages,
pas des champs de profil, et chacune est réversible depuis « Réinitialiser l'adaptation » :

| Déduit de | Réglage posé |
|---|---|
| `lever` | heure de bascule du jour logique (par défaut : lever moins une heure, borné à 2 h–6 h) |
| `joursTravail`, `plagesTravail` | créneaux proposés pour les séances, jours de repos de la rotation |
| `domainesActifs` | domaines affichés dans la roue, cartes du menu |
| `concours` | parcours ouverts dans le registre |
| `styleAccompagnement`, `heureRappel` | fréquence et heure des avis locaux |
| `tempsParSemaine`, `heuresRevision` | plafonds de séance, objectif indicatif de l'histogramme |

**Aucune de ces déductions ne modifie une donnée.** Elles changent des réglages, et l'écran
« Mon profil » montre, pour chacun, la réponse dont il découle — « votre bascule de journée est à
6 h parce que vous vous levez à 7 h ; la changer ici ne changera pas votre lever ».
