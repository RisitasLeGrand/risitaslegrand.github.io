# Plan de construction — Odyssée et Sport

Les deux branches sont **déclarées** depuis la phase 1e et **nourries** depuis les phases A à F :
contrat de faits, matrice de permissions, domaines, moteur d'activité, désaccords inter-branches,
catalogue d'indicateurs, synthèses, export et import d'analyse. Il ne leur manque que ce qu'une
branche possède en propre : **ses magasins et ses écrans**.

Ce document découpe les phases 4 à 9 de `docs/cyclades/plan.md` — qui transcrivent le prompt P3 —
en lots livrables, et garde la trace de ce qui est fait. Il ne rajoute aucune exigence : ce qu'il
contient vient de `plan.md`, de `decisions-phase-0.md` et du catalogue d'indicateurs.

---

## Ce qui est déjà en place, et qu'il ne faut pas refaire

| Acquis | Où |
|---|---|
| Les 34 types de faits, dont 20 pour Odyssée et 5 pour Sport | `src/lib/noyau/faits.ts` |
| Les 8 domaines, 5 actifs par défaut (décision 1) | `src/lib/noyau/domaines.ts` |
| Propriétaire unique par fait, et la matrice de lecture | `src/lib/noyau/permissions.ts` |
| XP, niveau et série calculés **une seule fois** (décision 2) | `src/lib/odyssee/activite.ts` |
| Désaccords inter-branches et composante d'intégrité | `src/lib/odyssee/desaccords.ts` |
| Les 15 indicateurs, les périodes, la couverture et la fiabilité | `src/lib/odyssee/{indicateurs,syntheses,fiabilite}.ts` |
| Journal d'opérations, fusion, compaction, sauvegarde, synchronisation | `src/lib/noyau/*`, `src/lib/sauvegarde/*`, `src/lib/sync/*` |
| Profil commun, initialisation, réglages déduits, adaptation | `src/lib/noyau/{profil,initialisation,reglages,adaptation}.ts` |

**Une branche possède ses données et publie des faits** : `faits-revisions.ts` montre la forme à
suivre — une **projection en lecture**, à identifiants déterministes, jamais un second magasin qui
dupliquerait la vérité.

---

## Odyssée

### O1 — Magasins et projection de faits

> **O1 faite, le 12 octobre 2026.** Cinq magasins, la migration v15, l'inscription au registre
> journalisé, et la projection.
>
> **Les cinq magasins entrent au registre journalisé dès leur création**, et non après coup. Une
> donnée écrite avant d'y être inscrite ne voyagerait pas, et le socle de rattrapage devrait
> inventer une horloge pour elle. Ils entrent du même coup dans la sauvegarde, dans la rétention et
> dans l'effacement ciblé — c'est tout l'intérêt d'avoir un registre plutôt que des listes
> parallèles.
>
> **Tâche et quête ne sont pas la même chose, et la confusion coûterait cher.** Une tâche se fait
> une fois et se clôt ; une quête se tient, à chaque jour ou à chaque semaine. Le plancher du jour
> se calcule sur les quêtes, l'arriéré sur les tâches, et une quête close disparaîtrait là où une
> tâche répétée s'accumulerait. Les jours tenus d'une quête sont gardés en **liste**, pas en
> compteur : un compteur ne se corrige pas, il se croit.
>
> **La projection a été coupée en deux.** `publier` lit les magasins, `projeter` calcule, et
> `maintenant` est un paramètre. Une projection qu'on ne peut éprouver qu'à travers IndexedDB est
> testée une fois, mal, et jamais sur les cas tordus — un événement à cheval sur minuit, une quête
> tenue hors fenêtre, un Pomodoro interrompu.
>
> **Un créneau d'agenda est `estime`, seul des cinq à ne pas être `confirme`.** Il dit ce qui était
> **prévu** : la réunion a pu finir plus tôt, ou ne pas avoir lieu. Le marquer confirmé flatterait
> la couverture de mesure exactement là où elle est la plus fragile.
>
> **L'essai de migration sème une base v14 entière**, et non les trois magasins qu'il relit. Un
> schéma partiel fait échouer le site sur un magasin absent, l'écran reste sur « Déchiffrement du
> contenu… », et l'on conclut que la migration est cassée alors que c'est la base de départ qui
> n'existait pas. Le schéma complet vit dans `scripts/lib/base-ancienne.mjs`.
>
> **Au passage, un défaut du helper partagé.** `franchirInitialisation` attendait
> `#terminer, #aller-menu, #commencer` par `waitForSelector`, qui résout l'union puis attend le
> **premier** — `#terminer`, caché tant que l'écran allégé est affiché. L'attente expirait donc sur
> une base portant déjà de l'usage, c'est-à-dire précisément le cas où l'écran allégé existe. Aucun
> essai ne l'avait vu : ils partent tous d'une base vierge.

### O2 — Le noyau des règles du jour

> **O2 faite, le 12 octobre 2026.** `odyssee/jour.ts` : la roue, le plancher, les huit règles, la
> couverture, les fenêtres de jours.
>
> **Une branche de roue porte un état, pas un nombre.** `mesure`, `sans-donnee`, `en-pause` : au
> premier lancement, une roue qui afficherait cinq branches à zéro dirait à la personne que sa vie
> est déséquilibrée, alors qu'elle dit seulement que le logiciel ne sait rien. `vide` est un champ
> du résultat et non une déduction laissée à l'appelant, parce que trois écrans poseront la même
> question et y répondraient chacun un peu autrement.
>
> **Seuls les faits qui portent une durée entrent dans la roue.** Une tâche close et une quête
> tenue n'en ont pas ; leur attribuer une valeur — « une tâche vaut dix minutes » — ferait d'un
> chiffre inventé la moitié de la roue. Elles nourrissent le plancher, qui est fait pour elles.
>
> **La surcharge est la seule règle qui en désactive d'autres**, et c'est sa raison d'être. Neuf
> heures d'agenda : les tâches et les domaines délaissés se taisent, les engagements du jour et les
> conflits restent. Proposer d'en faire plus un jour déjà plein est le plus sûr moyen de faire
> abandonner l'outil.
>
> **« Délaissé » suppose « suivi ».** Un domaine qui n'a jamais rien reçu n'est pas délaissé : il
> n'est pas mesuré, et le signaler reviendrait à reprocher de ne pas saisir, ce que E.6 refuse.
>
> **Un domaine en pause se tait entièrement**, suggestions comprises. Conséquence pour O5 : l'écran
> de saisie ne doit proposer que des domaines actifs, sans quoi on pourrait créer une tâche qui ne
> reparaîtrait jamais. C'est écrit comme un essai, pas comme une note.

### O3 — `/odyssee/` : le tableau de bord

> **O3 faite, le 12 octobre 2026.** Le bandeau du vide, « Que faire maintenant ? », le plancher,
> la roue, l'agenda du jour, le focus.
>
> **Une seule lecture, un seul instant.** `etatDuJour` lit tout en une fois. Cinq lectures séparées
> auraient donné cinq instants différents : la roue calculée à 23 h 59 et les suggestions à 0 h 00
> ne parleraient pas du même jour, et personne ne comprendrait pourquoi.
>
> **La roue additionne les deux branches.** Si elle ne voyait que les faits d'Odyssée, Cognition et
> Connaissances seraient vides alors que ce sont les deux domaines les mieux nourris — c'est tout
> le sens d'une roue d'équilibre.
>
> **Le bandeau du vide se vérifie sur ses mots**, parce que c'est par les mots qu'il se perdrait :
> l'essai exige « absence de données » et « n'est pas un déséquilibre ». Et la contrepartie, qui
> est la vraie preuve : une quête tenue **ne remplit pas** la roue, puisqu'elle n'a pas de durée.
> Le bandeau reste donc affiché après l'avoir cochée, et c'est voulu.
>
> **La règle est dans le DOM**, en `data-regle`, et pas seulement à l'écran : un essai vérifie
> ainsi *quelle* règle a parlé au lieu de deviner d'après un libellé qui changera. L'écran affiche
> l'**intitulé** de la règle, jamais sa raison — la raison explique au développeur pourquoi elle
> existe, l'intitulé dit à la personne ce qu'elle cherche.
>
> **Le focus n'écrit qu'à l'arrêt**, et il écrit le temps réellement passé. Les deux secondes de
> l'essai, pas les vingt-cinq minutes visées : compter la durée visée gonflerait le temps de
> concentration exactement les jours où l'on s'est le moins concentré.

### O4 — Calendrier

Jour, semaine, mois. Import et export ICS, **aucune synchronisation cloud**. Détection de
chevauchement et de surcharge.

### O5 — Tâches et quêtes

### O6 — Revue du soir, et le coût de saisie affiché (E.6)

### O7 — Ouverture de la branche

`disponible: true`, navigation à deux niveaux, essais de bout en bout.

---

## Sport

### S1 — Magasins et bibliothèque d'exercices

Nature, latéralité, équipement, muscles, unité de charge, et l'**identité de comparaison** incluant
variante et équipement — sans quoi deux exercices différents se compareraient.

### S2 — Le schéma du corps

SVG **dessiné nativement**, avant et arrière, trois états par clic, **avec l'alternative en cases à
cocher obligatoire** : utilisable au clavier et au lecteur d'écran seuls.

### S3 — Séances types, programmes, volume par muscle

Coefficient secondaire 0,5 réglable, **stocké avec chaque calcul** — un coefficient changé plus tard
ne doit pas réécrire l'histoire.

### S4 — La séance en direct

Saisie série par série, minuteur de récupération réelle, Wake Lock, **sauvegarde à chaque série**,
hors réseau. Une séance interrompue se reprend sans perte.

### S5 — Le suivi de la force

Epley et Brzycki, **imprécision signalée au-delà de dix répétitions**, bandes de contexte datées,
filtre « périodes comparables », détection de plateau.

### S6 — Les modulations, et le garde-fou

Selon la lecture de la décision 5 : **Sport propose, la personne dispose, et le réel fait foi** —
aucune mémoire de désobéissance, aucun compteur de propositions non suivies. **Exception non
négociable** : en présence d'une douleur ou d'une blessure déclarée, aucune proposition de
progresser.

### S7 — Ouverture de la branche

---

## Ce qui attend une décision avant d'être construit

| Décision | Ce qu'elle bloque | État |
|---|---|---|
| **3 — chiffrement au repos** de Psyché, Finances, médicaments et statut hormonal | Phases 7 et 8 (Psyché, Finances) | **non tranchée** |
| **5 — lecture des modulations Sport** | S6 | non tranchée ; je construis sur la recommandation écrite, qui est révocable |
| **4 — appels réseau** (cours de bourse, base d'aliments) | Finances, nutrition | non tranchée ; je construis **sans**, ce qui est la recommandation et le défaut sûr |

Les phases 6 à 9 — Corps, Psyché, Finances, Tendances — viennent **après** O7 et S7, et la
décision 3 doit être prise avant Psyché.
