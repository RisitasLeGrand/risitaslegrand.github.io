# Six décisions en attente — 16 octobre 2026

*Remontée au pilote, écrite ici parce que le canal direct était fermé au
moment de l'écrire : le serveur de liaison était déconnecté et aucune
session n'était joignable. Rien dans ce fichier n'est une donnée réelle —
des noms de champs, des chemins, des constantes, et le raisonnement qui
les accompagne.*

Pour chacune : ce qui a été fait, ce qui reste à trancher, et ce que je
recommande. **Aucune n'a été tranchée à la place d'Alexis.**

---

## D-1 — Les deux sources du prompt 32 déclarées impossibles

`rappel-de-prise` et `pointage-a-reporter` n'alimentent pas le centre de
notifications. Elles sont inscrites dans `SOURCES_NON_BRANCHEES` avec
leurs raisons, plutôt que laissées en attente, et un contrôle tient la
liste dans les deux sens.

- **`rappel-de-prise`** demanderait de savoir ce qui était *prévu*. Le
  champ `posologie` est du texte libre, et la décision 12 pose qu'une
  prise est « isolée, sans schéma ni rappel ». `prisesDuJour()` — que mon
  propre inventaire donnait pour producteur — est un **constat** : son
  module déclare « aucune comparaison à une posologie, aucune alerte
  d'oubli ». La brancher supposerait d'inventer un modèle de posologie,
  c'est-à-dire de décider pour quelqu'un d'autre quand il a oublié un
  médicament.
- **`pointage-a-reporter`** existe exactement quand le coffre est
  **fermé** — c'est sa définition. Or le centre n'écrit rien dans cet
  état, son magasin étant scellé, et le § 3.2 lui interdit d'afficher le
  moindre nombre. La source et le lieu sont incompatibles par
  construction.

**À trancher** : accepter les deux manques nommés, ou demander une autre
lecture.

**Recommandation : accepter.** Le premier touche des données de santé et
relève d'Alexis seul ; le second est bloqué par une contrainte de
conception, pas par un oubli.

---

## D-2 — Rien ne force `npm run verifier` à rester vert

Il l'est depuis le 16 octobre, pour la première fois. L'une des neuf
erreurs n'était pas cosmétique : un nom local masquait une aide importée,
et la fiche d'une molécule restait sur « chargement » avec un pavé
d'échec. Le build ne pouvait pas le voir — un script de page est
empaqueté, pas typé —, et personne ne l'avait vu non plus.

Trois options :

| | Ce que ça donne | Ce que ça coûte |
|---|---|---|
| (a) Chaîne d'intégration sur le dépôt public | `astro check` à chaque poussée | Une automatisation **sortante**, sur un dépôt public |
| (b) Ajouter `verifier` à `npm run build` | Impossible de publier avec une erreur | Ralentit **chaque** build, y compris les locaux |
| (c) Laisser manuel | Rien à installer | Le prochain défaut de cette classe passera aussi |

**Recommandation : (a)** — mais **je ne crée aucune automatisation sur le
dépôt public sans accord**. La publication est réservée à Alexis, et une
chaîne d'intégration en est une forme.

---

## D-3 — Anomalie A-18

`src/pages/odyssee/calendrier.astro` redéfinit localement `enRetard`
alors que `src/lib/odyssee/occurrences-lues.ts` l'exporte. Les deux disent
la même chose aujourd'hui ; rien ne garantit qu'elles le diront demain, et
c'est le genre d'écart qui se découvre quand les deux ont déjà divergé.

**À trancher** : corriger (une ligne) ou laisser.

**Recommandation : corriger au prochain lot qui touche le calendrier**,
pour ne pas élargir un lot sur un sujet étranger.

---

## D-4 — Une durée de produit choisie seul

`JOURS_AU_CENTRE = 30`, dans `src/lib/notifications/alimentation.ts` :
combien de jours un événement **clos** reste une nouvelle au centre.
Au-delà, il en sort **par sa source**, ce qui est la seule sortie que la
synchronisation sache rendre définitive.

Cette borne répare l'anomalie **A-19** : une source dont la condition est
permanente — une trajectoire atteinte le reste, une analyse conservée
reste conservée — ressuscitait ses éléments. La rétention supprimait,
le recensement suivant redéposait avec la date du jour, et un élément
rangé six mois plus tôt reparaissait **non lu**. Les trois sources de la
phase 3 n'avaient pas le défaut, leur condition s'éteignant d'elle-même,
et c'est ce qui me l'avait caché.

**À trancher** : garder trente jours, ou une autre valeur. C'est un choix
de produit, pas une contrainte technique, et je l'ai fait seul faute de
pouvoir demander.

---

## D-5 — Le report de pointage n'a pas d'interface

Découvert en instruisant D-1. `combienDeReports` et `rejouerLesReports`
existent dans `src/lib/odyssee/donnees-occurrences.ts` et ne sont appelés
par **aucun écran**. La plomberie du report de pointage coffre fermé est
écrite et éprouvée ; le geste qui la déclenche n'existe pas. C'est un
reliquat du prompt 38, pas du 32.

Conséquence pratique : un pointage fait coffre fermé est bien retenu,
mais rien ne le rejoue à l'ouverture, et rien ne dit qu'il attend.

**À trancher** : l'inscrire à l'ordre des travaux, ou le laisser dormir.

**Pas de recommandation ferme** : cela dépend de l'usage réel du pointage
coffre fermé, et je ne l'observe pas.

---

## D-6 — Une décision signée dont la moitié reste ouverte

L'amendement du 16 octobre autorisait les traitements et le statut
hormonal « seulement dans les indicateurs et les règles de désaccord ».
L'indicateur existe — `corps.jours-avec-prise`, neutre, sans cible, `null`
plutôt que zéro. La règle de désaccord, non : je l'ai déclarée impossible
dans `TYPES_SANS_REGLE`, avec quatre raisons, parce qu'aucune règle ne
serait honnête — une fin avant le début est déjà refusée à la projection ;
deux prises le même jour ne se contredisent pas, et les distinguer
demanderait le nom de la molécule que le fait ne porte pas ; deux statuts
qui se chevauchent ne sont pas contradictoires ; tout le reste est
médical.

Le pilote a répondu « accepté ». **Alexis ne s'est jamais prononcé**, et
c'est sa moitié de l'amendement qu'il a signé.

**À trancher** : confirmer que le manque nommé tient. Rien n'attend ce feu
vert pour avancer — le code est en place et éprouvé —, mais la ligne porte
sur une décision signée, et il me paraît juste qu'il la referme lui-même.

---

## Ce qui n'attend aucune décision

Les molécules viennent ensuite dans l'ordre convenu, puis le 33, les 175
voix et le 40. La synthèse des 175 voix demandera un `npm run build`
**sans** `REVINSP_SANS_PODCAST=1`, long et local : c'est un geste à lancer
délibérément, et je ne le lancerai pas de moi-même.
