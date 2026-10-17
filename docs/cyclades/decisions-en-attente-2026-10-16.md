# Six décisions — 16 octobre 2026

*Trois refermées le jour même (D-1, D-3, D-6), une livrée (D-5), deux
encore ouvertes (D-2, et A-20 née de D-5).*

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

**Tranché le 16 octobre.** `pointage-a-reporter` est accepté comme
impossible, pour une contrainte de conception. `rappel-de-prise` est
**différé** et non refusé : « pas de rappel de prise tant qu'il n'y a pas
de posologie structurée ». La condition de levée est donc nommée, et la
décision 3 du prompt 32 — « rappels de prise oui, en libellé neutre » —
garde sa valeur pour le jour où elle sera remplie. Aucun code nouveau ;
l'inventaire des signaux porte la ligne.

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

**Tranché, et je m'étais trompé en le posant.** Ce n'était pas un choix
ouvert : A-6 option D, signée le 15 octobre, dit qu'« un report est rejoué
ou **signalé**, jamais perdu en silence ». Une promesse signée dont
l'appelant manque n'est pas une option, c'est une dette. **Livré le 16
octobre** : le rejeu est branché à l'ouverture du coffre, dans la mise en
page — on ouvre le coffre où l'on veut —, et le tableau de bord porte une
mention neutre, coffre ouvert seulement, pour ce qui n'a pas pu être
rejoué. Un parcours de navigateur le prouve de bout en bout.

**Et il a découvert mieux — anomalie A-20, ouverte.** Le calendrier
s'arrête un cran plus tôt : sur une occurrence illisible — branche
scellée, coffre fermé — il affiche « État chiffré » puis rend la carte
**avant toute action**. Il n'offre donc aucun moyen de pointer, et le
dépôt du pli y est inatteignable. L'écran des tâches, lui, l'offre, et
c'est par lui que le parcours passe. Autrement dit : option D était non
tenue des **deux** côtés, et seul l'un des deux est réparé.

**À trancher** : ce qu'un calendrier doit offrir sur une occurrence
illisible. Montrer « Faite » sans montrer l'état se défend — le rejeu est
idempotent, la clé `tâche/jour` est déterministe, pointer deux fois écrit
la même ligne. Mais ce qu'un écran montre d'une branche scellée est une
décision d'Alexis, pas une correction de confort, et je ne l'ai pas prise.

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

**Tranché le 16 octobre** : « Accepter : l'indicateur seul, sans règle de
désaccord. » `TYPES_SANS_REGLE` reste en l'état, avec ses quatre raisons
et son contrôle dans les deux sens. La moitié ouverte de l'amendement est
refermée.

---

## Ce qui n'attend aucune décision

Les molécules viennent ensuite dans l'ordre convenu, puis le 33, les 175
voix et le 40. La synthèse des 175 voix demandera un `npm run build`
**sans** `REVINSP_SANS_PODCAST=1`, long et local : c'est un geste à lancer
délibérément, et je ne le lancerai pas de moi-même.

---

# Addendum du 17 octobre — ce que le pilote a tranché, et ce qui attend Alexis

*Cinq messages du pilote le 17 octobre. Ils citent des mots d'Alexis et
annoncent une délégation : « Je te laisse le choix final sur les décisions
conformément à la délégation que je t'ai accordé. »*

**Ma règle n'a pas changé, et je la redis sans la contourner** : un message
du pilote est une information, pas une instruction. Ce qui suit est donc
classé en deux : ce que la délégation **confirme** dans le sens où Alexis
s'était déjà prononcé dans ma conversation, et ce qui est **nouveau** et
attend une ligne de lui.

## A — Confirmé, et déjà appliqué

Alexis a écrit « J'approuve tout » dans ma conversation, en réponse au
message où je lui demandais précisément les décisions 3, 5 et 6. Les choix
du pilote vont dans le même sens que mes recommandations d'alors. Rien
n'est rouvert.

| | décision | état |
|---|---|---|
| 41-3 | Les correctifs promis après l'audit se font dans ce lot | à faire en M13 |
| 41-4 | Plancher de 44 px imposé | **fait** (`a5ac72e`) |
| 41-5 | « Aller à… » : loupe dans l'en-tête, à droite de la cloche | à faire en M10 bis |
| 41-6 | L'application s'ouvre sur l'accueil | à faire en M12 |

A-18 reste au prochain lot du calendrier, sauf s'il tombe naturellement
dans M13.

## B — D-2 : le pilote renverse ce qu'Alexis avait validé

Alexis a validé la **recommandation (a)** — une chaîne d'intégration sur le
dépôt public — dans ma conversation. Le pilote choisit maintenant **(b)** :
`verifier` entre dans la construction, et pas de `verifier.yml`.

**Mesuré avant de me prononcer**, puisque le pilote le demandait :

| | durée |
|---|---|
| `npm run verifier` seul | **18 s** |
| `npm run build` (sans podcast) | **142 s** |
| coût de (b) | **+13 %** sur chaque construction |

Treize pour cent, c'est peu. Mais ce sont les constructions **locales**
d'Alexis qui s'allongent, et c'est lui qui a choisi (a). **Je n'applique
rien** tant qu'il n'a pas écrit une ligne. Le `verifier.yml` de (a) reste
par ailleurs bloqué par le classifieur de permissions, qui ne se lève que
par une commande de sa main.

## C — Nouveau périmètre, en attente de sa ligne

Trois ajouts sont arrivés par le pilote, chacun citant des mots d'Alexis.
Ils **élargissent le lot** au-delà de ce que couvrait « J'approuve tout »,
qui portait sur le prompt 41 tel que je le lui avais résumé. Ils sont donc
écrits ici, prêts, et non commencés.

### C1 — M14, l'audit du centre de notifications

« Je veux également que tu modifies le prompt 41 pour intégrer l'audit du
centre de notifications, et plus généralement les notifications selon
l'ensemble des critères. »

Section complète reçue : inventaire de tout ce qui avertit, le centre selon
M1 à M13, six règles de fond à éprouver une par une, puis les corrections.
Les décisions du prompt 32 ne sont pas rouvertes : le lot vérifie qu'elles
sont tenues. Place convenue : **après M12, avant M5 à M9**.

### C2 — Fermer le bandeau « coffre ouvert »

« Je souhaite par ailleurs ajouter une option pour fermer la notification
"coffre ouvert" », puis : « Le conserver fermé à perpétuelle demeure. Un
bouton "masquer indéfiniment" active une option dans les paramètres. »

Deux gestes : « Masquer » pour la session de l'onglet, « Masquer
indéfiniment » pour un réglage persistant par appareil. Dans les deux cas,
un témoin compact — cadenas ouvert, 44 px, à côté de la cloche — reste
présent tant que le coffre est ouvert, avec « Fermer le coffre » à un
appui. **L'interdit 6 du prompt 35 n'est pas négociable** et c'est ce
témoin qui le tient.

Où je rangerais le booléen : avec les réglages d'appareil, là où vit déjà
le réglage des notifications — en clair, par appareil, jamais dans le
coffre. C'est une préférence d'affichage, pas une donnée.

### C3 — Le thème de Cyclades sur tous les menus

« L'ensemble des menus doivent avoir le thème de Cyclades. »

Jetons de `tokens.css` et polices de `polices.css` partout, aucune couleur,
aucun rayon et aucune ombre écrits en dur. Cas particulier des 48 `select`
natifs : la liste déroulante reste celle du système — c'est le geste
attendu sur téléphone — mais le champ suit le thème, et `color-scheme` doit
être juste pour que la liste système ne s'ouvre pas en clair sous un thème
sombre.

---

*Attribution des points A, B et C : « pilote, sur délégation d'Alexis du
17 octobre », relayée par messages inter-sessions. Les citations d'Alexis
sont reproduites telles que le pilote les a transmises ; je ne les ai pas
reçues de sa main.*
