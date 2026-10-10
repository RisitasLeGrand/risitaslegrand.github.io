# Catalogue d'indicateurs — version initiale

Livrable de la phase 0, demandé en C.8 : « fichier central où chaque indicateur est défini
(formule, source, fréquence, cible, fiabilité) ; il alimente la couverture de mesure (C.2) et la
documentation ».

Ce document est la **version documentaire** du catalogue. Il devient, en phase 1, un fichier de
données (`src/lib/odyssee/indicateurs.ts`) dont le tableau de bord, la couverture de mesure et cette
page sont tous dérivés — un seul endroit à modifier pour ajouter un indicateur.

## Pourquoi un catalogue, et non des calculs dispersés

Un indicateur défini dans le composant qui l'affiche a trois défauts dont on ne se rend compte que
tard : sa formule n'est écrite nulle part, donc elle dérive ; sa fiabilité n'est pas dite, donc elle
est présumée totale ; et la **couverture de mesure** (C.2, « révéler les angles morts ») ne peut pas
être calculée, puisqu'il n'existe aucune liste de ce qui devrait être mesuré. Le catalogue est
exactement cette liste.

## Le schéma d'une entrée

```ts
interface Indicateur {
  id: string;                    // stable, jamais réutilisé
  libelle: string;
  domaine: Domaine;              // corps | cognition | connaissances | psyche | finances | lien | ordre | oeuvre
  formule: string;               // en français, lisible par la personne
  calcul: (donnees: Fenetre) => Mesure | null;  // null = pas calculable, jamais 0 par défaut
  sources: readonly SourceFait[]; // types de faits requis (contrat B.1)
  frequence: 'jour' | 'semaine' | 'mois' | 'trimestre' | 'an';
  cible?: Cible;                 // fixée par la personne, jamais par défaut (voir plus bas)
  fiabilite: RegleDeFiabilite;
  sens: 'haut-mieux' | 'bas-mieux' | 'neutre';  // « neutre » pour tout ce que E.3 interdit de juger
  unite: string;
}
```

Deux points du schéma portent une décision, et je les signale parce qu'ils sont faciles à défaire
par inadvertance :

**`calcul` rend `null`, jamais zéro.** « Aucune donnée » et « zéro » sont deux choses différentes, et
les confondre fabrique des roues d'équilibre fausses — un domaine non mesuré apparaîtrait comme un
domaine délaissé. La couverture de mesure, elle, est précisément le compte des `null`.

**`sens: 'neutre'` est le défaut dans Corps et Psyché.** E.3 interdit de présenter un poids ou une
humeur comme un progrès ou un recul. Un indicateur neutre s'affiche sans flèche, sans couleur de
jugement, sans « objectif atteint ».

## La règle de fiabilité, qui est un calcul et pas une impression

Chaque indicateur rend, avec sa valeur, une fiabilité sur quatre composantes. Elles se multiplient,
la plus faible commande donc le résultat, ce qui est voulu.

| Composante | Ce qu'elle mesure | Règle |
|---|---|---|
| **Effectif** | A-t-on assez de points ? | 1 si l'effectif atteint le minimum de l'indicateur ; décroît linéairement en dessous ; 0 sous le tiers |
| **Fraîcheur** | La dernière donnée est-elle récente au regard de la fréquence ? | 1 dans la fenêtre attendue, décroît ensuite ; une mesure de poids d'il y a six semaines ne décrit pas cette semaine |
| **Complétude** | Les jours attendus sont-ils renseignés ? | Part des jours de la fenêtre qui portent un fait de cette source |
| **Intégrité** | Y a-t-il des conflits B.4 non résolus sur les faits utilisés ? | 1 sans conflit ; 0,5 avec un conflit non résolu ; 0 si le fait pivot est en conflit |

La quatrième composante est celle que le prompt exige explicitement (« les conflits non résolus
restent visibles et dégradent l'indicateur de fiabilité des analyses concernées », B.4). Elle est
donc câblée dans le catalogue, pas laissée au moteur de tendances.

**Un indicateur sous 0,5 de fiabilité ne nourrit aucune trajectoire corrective** et s'affiche grisé,
avec la raison. C'est la contrepartie de C.8 : on ne construit pas un plan d'action sur une mesure
dont on sait qu'elle est faible.

## Les cibles : fixées par la personne, et pour certains domaines jamais proposées

La roue d'équilibre compare l'effort réel à « la **cible** que je fixe » (C.2). Le catalogue ne
livre donc **aucune valeur cible par défaut** pour :

- le poids, le tour de taille, les calories, la vitesse de variation du poids (E.3) ;
- l'humeur, l'énergie, le stress, les scores d'échelles psychiques (E.2) ;
- le volume d'entraînement, dont les repères restent « généraux, non prescriptifs et réglables »
  (D.3).

Pour ces indicateurs, le champ `cible` reste vide jusqu'à ce que la personne en saisisse une, et
l'interface n'en suggère pas. Les cibles d'**organisation** (nombre de séances par semaine, jours de
révision, taux d'épargne, part d'un domaine dans la roue) sont, elles, proposables : elles portent
sur la conduite, pas sur le corps ni sur l'humeur.

---

# Le catalogue initial

La colonne **disponible** est le point important de cette version : elle distingue ce que les
données actuelles permettent déjà de calculer de ce qui attend une saisie qui n'existe pas encore.
Quatorze indicateurs sur les cinquante-deux des cinq domaines demandés sont calculables aujourd'hui
(les trois domaines proposés en portent six de plus) ; c'est la mesure de l'écart entre le site
actuel et Odyssée.

## Cognition

| id | Formule | Source | Fréq. | Cible | Fiabilité | Disponible |
|---|---|---|---|---|---|---|
| `cog.temps-revision` | Somme des secondes effectives (compteur en pause après 2 min d'inactivité) | `jours.secondes` | jour | proposable | effectif ≥ 1 jour | **oui** |
| `cog.regularite-revision` | Jours avec au moins un fait de révision ÷ jours de la fenêtre | `jours` | semaine | proposable | complétude | **oui** |
| `cog.retention-fsrs` | Part des cartes dont la rétention prédite ≥ 0,9 au jour J | `cartes` (FSRS) | semaine | proposable | effectif ≥ 20 cartes | **oui** |
| `cog.charge-arrieree` | Cartes échues non révisées | `cartes.echeance` | jour | 0 | — | **oui** |
| `cog.echelon-cog-training` | Moyenne des échelons atteints par famille de moteurs | `relationnel`, `nback`, `vmSessions` | semaine | proposable | effectif ≥ 5 sessions | **oui** |
| `cog.temps-focus` | Somme des minutes de minuteur Pomodoro rattachées à un domaine | *(nouveau)* faits `focus` | jour | proposable | complétude | non — C.2 |
| `cog.interruptions-focus` | Sessions focus abandonnées ÷ sessions démarrées | *(nouveau)* faits `focus` | semaine | neutre | effectif ≥ 5 | non — C.2 |

## Connaissances

| id | Formule | Source | Fréq. | Cible | Fiabilité | Disponible |
|---|---|---|---|---|---|---|
| `sav.couverture-programme` | Fiches avec au moins une révision ÷ fiches du parcours | `fiches`, manifeste | semaine | 1 | complétude | **oui** |
| `sav.niveau-estime` | Note Elo de la personne, par matière et agrégée | `competences` | semaine | neutre | effectif ≥ 10 échanges | **oui** |
| `sav.retard-programme` | Écart entre fiches vues et fiches planifiées à date | `jours`, `planification` | semaine | 0 | complétude | **oui** |
| `sav.taux-bonnes` | Bonnes réponses ÷ réponses | `jours.bonnes`, `.reponses` | semaine | neutre (dépend de la difficulté tirée) | effectif ≥ 30 réponses | **oui** |
| `sav.courbe-oubli` | Pente de la rétention observée par intervalle | `cartes`, `journal` | mois | neutre | effectif ≥ 50 révisions | **oui** |
| `sav.erreurs-par-matiere` | Entrées du journal d'erreurs par matière, non résolues | `journal`, `difficultes` | semaine | bas-mieux | effectif ≥ 5 | **oui** |
| `sav.apports-externes` | Somme des durées de lecture, cours, conférence saisis | *(nouveau)* faits `apport-externe` | semaine | proposable | complétude | non — C.4 |

## Corps

Sept indicateurs sur douze viennent de Sport ; les cinq autres sont saisis dans Odyssée. Tous sont
`neutre` sauf la régularité, qui porte sur la conduite et non sur le corps.

| id | Formule | Source | Fréq. | Cible | Fiabilité | Disponible |
|---|---|---|---|---|---|---|
| `corps.seances` | Nombre de séances closes | Sport, faits `seance` | semaine | proposable | complétude | non — D.4 |
| `corps.regularite-sport` | Séances effectuées ÷ séances programmées | Sport + calendrier | semaine | proposable | complétude | non — D.3 |
| `corps.volume-par-muscle` | Σ(séries principales) + c × Σ(séries secondaires), c = 0,5 réglable | Sport, faits `serie` | semaine | **jamais par défaut** (D.3) | effectif ≥ 2 séances | non — D.3 |
| `corps.frequence-par-muscle` | Jours distincts où le muscle est sollicité | Sport, faits `serie` | semaine | jamais par défaut | effectif ≥ 2 séances | non — D.3 |
| `corps.tonnage` | Σ(charge × répétitions) des séries de travail | Sport, faits `serie` | semaine | neutre | effectif ≥ 1 séance | non — D.4 |
| `corps.charge-max-estimee` | Epley et Brzycki, répétitions + répétitions en réserve ; **imprécis au-delà de ~10 reps** | Sport, faits `serie` | semaine | neutre | effectif ≥ 3 séries ; **0,6 au-delà de 10 reps** | non — D.5 |
| `corps.plateau` | Absence de progression de la charge max estimée sur N semaines, **bandes de contexte déduites** | Sport + faits `phase` | mois | neutre | effectif ≥ 6 semaines comparables | non — D.5 |
| `corps.difficulte-percue` | Moyenne de la difficulté perçue des séances | Sport, faits `seance` | semaine | neutre | effectif ≥ 3 | non — D.4 |
| `corps.poids` | Dernière mesure ; tendance = médiane mobile 7 jours | Odyssée, faits `mesure` | jour | **jamais par défaut** (E.3) | fraîcheur ≤ 7 jours | non — C.5 |
| `corps.sommeil-duree` | Médiane de la durée sur la fenêtre | Odyssée, faits `sommeil` | jour | proposable | complétude ≥ 0,5 | non — C.5 |
| `corps.sommeil-qualite` | Moyenne de la qualité perçue | Odyssée, faits `sommeil` | semaine | neutre | complétude ≥ 0,5 | non — C.5 |
| `corps.proteines` | Σ des apports protéiques saisis ÷ jours renseignés | Odyssée, faits `repas` | jour | proposable | complétude ≥ 0,7 | non — C.5 |
| `corps.hydratation` | Σ des volumes saisis | Odyssée, faits `hydratation` | jour | proposable | complétude | non — C.5 |
| `corps.douleurs-actives` | Zones avec douleur déclarée non clôturée | Odyssée, faits `sante` | jour | 0 | — | non — C.5 |

**`corps.douleurs-actives` n'est pas un indicateur ordinaire** : il est l'entrée qui coupe les
propositions de progression dans Sport (D.7, dernier point). Il doit donc être calculable même
quand tout le reste du domaine est vide, et sa valeur `null` doit être traitée comme « inconnu », pas
comme « aucune douleur ».

## Psyché

Le prompt exige une vérification de licence avant d'intégrer WHO-5, PHQ-9 et GAD-7. **Je ne les
inscris donc pas au catalogue** : ils y entreront en phase 5, après vérification, ou n'y entreront
pas. Ce qui suit ne dépend d'aucune échelle sous licence.

| id | Formule | Source | Fréq. | Cible | Fiabilité | Disponible |
|---|---|---|---|---|---|---|
| `psy.completude-checkin` | Jours avec check-in ÷ jours de la fenêtre | faits `checkin` | semaine | proposable | complétude | non — C.6 |
| `psy.humeur` | Moyenne mobile 7 jours, **écart à la ligne de base personnelle** | faits `checkin` | jour | **jamais** (E.2) | effectif ≥ 7 ; ligne de base ≥ 30 jours | non — C.6 |
| `psy.energie` | idem | faits `checkin` | jour | jamais | idem | non — C.6 |
| `psy.stress` | idem | faits `checkin` | jour | jamais | idem | non — C.6 |
| `psy.variabilite` | Écart interquartile de l'humeur sur 14 jours | faits `checkin` | semaine | neutre | effectif ≥ 14 | non — C.6 |
| `psy.recul-revue` | Jours écoulés depuis la dernière revue hebdomadaire | faits `revue` | semaine | ≤ 7 | — | non — C.8 |

Les trois indicateurs d'état (`humeur`, `energie`, `stress`) ne sont **jamais affichés en valeur
absolue seule**, mais comme écart à la ligne de base de la personne, et seulement si cette ligne de
base repose sur au moins trente jours. C'est ce que E.2 appelle « présentées avec mesure » : une
humeur à 3/5 ne veut rien dire tant qu'on ne sait pas si la personne vit habituellement à 2 ou à 4.

## Finances

Aucun indicateur ne récompense le rendement ni la fréquence des opérations (C.7, dernier point) :
les trois seuls indicateurs porteurs d'XP du domaine mesurent la **tenue**.

| id | Formule | Source | Fréq. | Cible | Fiabilité | Disponible |
|---|---|---|---|---|---|---|
| `fin.patrimoine-net` | Σ(valorisations d'actifs datées) − Σ(dettes) | faits `valorisation` | mois | proposable | fraîcheur ≤ 1 mois par compte | non — C.7 |
| `fin.taux-epargne` | (revenus − dépenses) ÷ revenus | faits `operation` | mois | proposable | complétude des imports | non — C.7 |
| `fin.mois-de-precaution` | Épargne disponible ÷ dépenses mensuelles médianes | faits `operation`, `valorisation` | mois | proposable | effectif ≥ 3 mois | non — C.7 |
| `fin.depenses-par-categorie` | Σ par catégorie issue des règles locales | faits `operation` | mois | neutre | part des opérations non catégorisées | non — C.7 |
| `fin.abonnements` | Opérations récurrentes détectées, montant mensualisé | faits `operation` | mois | neutre | effectif ≥ 3 occurrences | non — C.7 |
| `fin.ecart-allocation` | Σ \|part réelle − part cible\| ÷ 2, par classe d'actifs | faits `position`, cible personnelle | mois | cible **de la personne** | fraîcheur des prix saisis | non — C.7 |
| `fin.rebalancement` | Montant à déplacer par ligne pour rejoindre la cible — **arithmétique seule, aucune recommandation** | idem | mois | — | idem | non — C.7 |
| `fin.performance-tri` | Taux de rendement interne des flux datés | faits `transaction` | trimestre | **neutre, jamais de cible** | effectif ≥ 4 flux | non — C.7 |
| `fin.concentration` | Part de la plus grosse ligne ; indice de Herfindahl | faits `position` | mois | neutre | fraîcheur des prix | non — C.7 |
| `fin.frais` | Σ des frais ÷ encours moyen | faits `transaction` | an | bas-mieux | effectif ≥ 1 an | non — C.7 |
| `fin.tenue-a-jour` | Jours depuis le dernier import ou la dernière valorisation | faits `operation`, `valorisation` | semaine | ≤ 30 | — | non — C.7 |

`fin.performance-tri` porte la mention « jamais de cible » pour une raison de fond : fixer une cible
de rendement transforme un outil de mesure en outil de décision d'investissement, ce que E.4
interdit.

## Les trois domaines proposés

Inscrits ici pour que la décision 1 se prenne sur du concret, et non activés tant qu'elle n'est pas
prise.

| id | Formule | Source | Fréq. | Disponible |
|---|---|---|---|---|
| `lien.contacts-entretenus` | Personnes avec au moins une interaction journalisée | faits `interaction` | semaine | non |
| `lien.temps-partage` | Σ des durées d'événements marqués « Lien » | calendrier | semaine | non |
| `ordre.taches-echues` | Tâches dont l'échéance est passée, non closes | faits `tache` | jour | non |
| `ordre.demarches-en-cours` | Tâches du domaine Ordre ouvertes depuis > 30 jours | faits `tache` | semaine | non |
| `oeuvre.temps-projet` | Σ du temps focus rattaché à un projet | faits `focus` | semaine | non |
| `oeuvre.livraisons` | Tâches closes marquées « livrable » | faits `tache` | mois | non |

## Transverses

| id | Formule | Source | Fréq. | Cible | Disponible |
|---|---|---|---|---|---|
| `tr.roue-equilibre` | Part de l'effort par domaine sur 7 jours, contre la cible | tous faits porteurs d'effort | semaine | cible personnelle | partiel |
| `tr.serie` | Jours consécutifs avec au moins un fait porteur d'effort, jokers déduits | tous | jour | haut-mieux | **oui** (sur Révisions seul) |
| `tr.xp-jour` | Σ des XP attribués par règle, journal explicable | moteur d'activité | jour | proposable | **oui** (sur Révisions seul) |
| `tr.niveau` | Barème 100 + 50 × (n−1) XP par niveau | XP cumulé | — | — | **oui** |
| `tr.couverture-mesure` | Indicateurs calculables ÷ indicateurs du domaine | ce catalogue | semaine | — | se calcule dès que le catalogue existe |
| `tr.conflits-ouverts` | Notifications de correction non tranchées | journal d'audit B.4 | jour | 0 | non — B.4 |
| `tr.recul-sauvegarde` | Jours depuis la dernière sauvegarde `.cyclades` réussie | registre de sauvegarde | jour | ≤ 7 | non |

`tr.couverture-mesure` est l'indicateur qui justifie tout le reste du fichier : il se calcule sur le
catalogue lui-même, et c'est pour cela que le catalogue doit être une donnée et non du code dispersé.

`tr.recul-sauvegarde` est inscrit ici volontairement, bien qu'il relève du prompt « stockage ». Il
est le seul indicateur qui mesure un risque de perte totale, et il n'a aucun sens de le placer
ailleurs que sur la page d'accueil.

---

## Ce que le catalogue apprend, et qui touche le plan

**La couverture de mesure initiale d'Odyssée serait de 27 %** (14 indicateurs calculables sur 52,
les trois domaines non validés mis de côté). Ce n'est pas un défaut : c'est l'état normal d'un
tableau de bord avant qu'on y saisisse quoi que ce soit. Mais cela veut dire qu'au premier
lancement, **la roue d'équilibre sera presque vide, avec deux branches sur cinq renseignées**, et
qu'il faut que l'interface le dise au lieu de l'afficher comme un déséquilibre de vie. Je le note
comme exigence de la phase 2 : l'écran d'accueil d'un Odyssée vide doit expliquer qu'il est vide,
pas accuser la personne d'avoir délaissé quatre domaines.

**Trois indicateurs sont des gardes, pas des mesures** : `corps.douleurs-actives` (coupe les
propositions de progression), `tr.conflits-ouverts` (dégrade les fiabilités) et
`tr.recul-sauvegarde` (risque de perte). Ils doivent être calculables même sur un domaine vide, et
ne jamais être masqués par un filtre de domaine désactivé.

**Le volume par muscle a besoin d'un coefficient documenté.** 0,5 par série secondaire est la valeur
que le prompt propose ; elle est réglable. Mais changer le coefficient change l'historique entier,
donc le catalogue doit stocker le coefficient **avec chaque calcul**, et non seulement dans les
réglages — sans quoi une courbe de volume sur deux ans mélangerait deux définitions.
