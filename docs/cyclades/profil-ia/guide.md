# Guide — « Mon profil », « Exporter pour une IA », « Importer une analyse »

Trois écrans, et ce qu'il faut savoir avant de s'en servir. Écrit pour être lu
une fois, puis oublié.

---

## Mon profil

**Où** : le menu de Cyclades, puis « Mon profil ».

Ce que Cyclades sait de vous tient dans une trentaine de champs, et chacun dit
trois choses : **sa valeur**, **qui le lit** et **ce qu'il règle**.

### Qui lit quoi

Chaque champ porte une **portée** : la liste des branches qui peuvent le lire.
Une case par branche, et il suffit de la décocher pour que la branche cesse de
le voir. Un champ hors portée est **retiré**, pas masqué : la branche ne sait
même pas qu'il existe.

Le prénom, lui, n'est lu par aucune branche. Il ne sert qu'à la salutation du
menu.

### D'où vient une valeur

Trois origines, et elles ne veulent pas dire la même chose :

| Mention | Ce qu'elle veut dire |
|---|---|
| **déclaré** | Vous l'avez dit. |
| **observé, puis confirmé** | Cyclades l'a déduit de votre usage, vous l'avez validé. |
| **observé, non confirmé** | Cyclades l'a déduit, et personne ne l'a validé. |

La distinction compte le jour où un réglage est faux : savoir si c'est une
déclaration ou une déduction est la première chose à regarder.

### Ce que Cyclades en déduit

Huit réglages découlent de vos réponses — l'heure à laquelle votre journée
change de date, les jours de repos de la rotation, les domaines affichés,
l'objectif de l'histogramme… Chacun affiche **la réponse dont il découle** :
« votre bascule de journée est à 6 h parce que vous vous levez à 7 h ; la
changer ne changerait pas votre heure de lever. »

Aucune de ces déductions ne modifie une donnée. Elles changent des réglages.

### L'adaptation

Quand votre usage contredit ce que vous avez déclaré, Cyclades pose la
question — **une fois par semaine au plus**, jamais en travers de votre chemin.
Trois réponses : d'accord, plus tard, non. **Un « non » est définitif.**

« Réinitialiser l'adaptation » remet les réglages qu'une proposition acceptée
avait changés à la valeur que **vous** aviez déclarée — pas à une valeur par
défaut. Le journal garde chaque version de chaque champ, donc la vôtre est
retrouvée, pas devinée. Les questions que vous avez refusées restent refusées.

### Supprimer

Un champ se supprime seul, ou tout le profil d'un coup. La suppression voyage
avec la synchronisation : le champ ne revient pas du premier appareil qui ne
l'avait pas vue.

---

## Exporter pour une IA

**Où** : le menu, puis « Exporter pour une IA ».

Cyclades construit un dossier que **vous** confiez à l'IA de votre choix. Le
site n'appelle aucun modèle, n'ouvre aucune connexion et ne connaît aucune clé :
tout passe par des fichiers que vous téléchargez.

### Les quatre étapes

1. **La période** — semaine, mois, trimestre, année.
2. **Les catégories** — ce qui part, catégorie par catégorie. Les catégories
   sensibles (corps, psyché, finances) sont **décochées**, et les cocher demande
   une confirmation à part. Les textes libres et le profil sont **exclus par
   défaut**.
3. **Le nom employé** — un pseudonyme. Votre prénom et votre nom ne partent
   **jamais**, quelle que soit la sélection, et un contrôle les cherche dans
   tous les fichiers avant l'écriture — jusque dans vos notes, où vous pouvez
   vous être nommé vous-même.
4. **L'aperçu** — rien n'est téléchargé avant que vous ayez vu ce qui sort :
   le poids, les fichiers, et le début du contenu de chacun.

### Les neuf fichiers

| Fichier | Ce qu'il porte |
|---|---|
| `LISEZMOI.md` | Le contexte, le périmètre, et les instructions à l'IA. |
| `synthese.md` | Le récit par domaine, avec les valeurs déjà calculées. |
| `indicateurs.json` | Le catalogue entier, les formules, les valeurs. |
| `series/series.json` | Les séries, au jour sur un mois, à la semaine sur un an, au mois au-delà. |
| `contexte.md` | Le profil retenu, les objectifs, les refus passés. |
| `qualite-des-donnees.md` | La couverture, les lacunes, les mesures peu fiables. |
| `schema-analyse.json` | Le format strict de la réponse attendue. |
| `exemple-analyse.json` | Un exemple conforme. |
| `manifest.json` | L'identifiant, l'empreinte, le vecteur de versions. |

Une variante **fichier unique** rassemble tout dans un seul Markdown, quand le
volume le permet.

### Si c'est trop gros

L'assistant estime le poids et le compare à ce qu'une IA lit raisonnablement
d'un coup. Au-delà, il propose un **découpage par domaine**, puis une analyse
transversale qui s'appuiera sur les précédentes. Découper par période serait
plus simple et moins utile : une IA qui ne voit qu'un trimestre ne peut rien
dire d'une tendance annuelle.

### Le journal

Chaque export est inscrit au journal : identifiant, empreinte, date, périmètre,
poids. **Jamais le contenu.** C'est ce qui permettra de rattacher une analyse
importée à l'export dont elle répond. L'inscription a lieu **après** le
téléchargement : un export construit pour l'aperçu puis abandonné n'a jamais
quitté votre machine.

---

## Importer une analyse

**Où** : le menu, puis « Importer une analyse ».

Collez la réponse de l'IA, ou choisissez son fichier.

### Ce que Cyclades fait de la réponse

**Il retire l'enveloppe.** Un bloc de code, une phrase d'introduction, une
virgule finale : retirés, et l'écran dit ce qu'il a enlevé.

**Il valide le contenu, strictement.** Un champ hors du format, une valeur hors
des listes admises, un plafond dépassé, du balisage dans un texte : refusés.
Rien n'est importé partiellement — l'analyse est entière ou nulle. Chaque erreur
dit **où** elle se trouve : `constats[2].preuves[0].indicateur : identifiant
inconnu`.

Refusés aussi : les caractères de contrôle, et les marques de sens d'écriture
qui retourneraient l'affichage d'une ligne sans changer ce qu'elle contient.
Un texte doit se lire comme il est écrit, et l'échappement du HTML n'y suffit
pas.

**Il engendre un texte de réparation**, à copier et à donner à l'IA. Aucun appel
à un modèle : le texte est écrit ici, à partir des erreurs.

**Il recalcule les chiffres cités.** Pour chaque preuve, l'indicateur est
recalculé sur la période, et le résultat est l'un de quatre :

| Verdict | Ce qu'il veut dire |
|---|---|
| **confirmé** | Le chiffre est juste, à 2 % près. |
| **approché** | À 10 % près : l'IA a arrondi, elle n'a pas inventé. |
| **non retrouvé** | Le chiffre n'est pas celui de l'export. |
| **non vérifiable** | Une compaction a effacé le détail, ou l'unité ne correspond pas. Nous ne savons plus — ce n'est pas une accusation. |

Un constat dont **une seule** preuve n'est pas retrouvée est signalé en
évidence : un constat bâti sur trois chiffres dont un est inventé n'est pas aux
deux tiers juste.

### Le tri

Pour chaque constat : **garder** ou **écarter** — un constat douteux est écarté
par défaut. Pour chaque proposition : **adopter** comme trajectoire, **reporter**
ou **refuser**.

Deux règles tiennent le tri. Au plus **trois trajectoires actives** : au-delà,
ce n'est plus un plan. Et on ne peut pas adopter une action dont le constat est
écarté : adopter l'action en rejetant sa raison laisserait une trajectoire que
plus rien ne justifie.

Les questions rejoignent votre prochaine revue. Les remarques sur la qualité
des données deviennent des « à vérifier » — **jamais** des corrections
automatiques.

### Ce que l'analyse n'est pas

Elle est conservée **étiquetée** « analyse externe produite par une IA, non
vérifiée », chiffrée et synchronisée comme le reste. Elle ne modifie aucune de
vos données d'elle-même. Son texte est affiché en **texte brut** : Cyclades sait
rendre du Markdown, pour les fiches qui viennent du dépôt ; une analyse importée
n'emprunte jamais ce chemin.

Et pour tout ce qui touche au **corps, à la santé ou aux finances**, un
avertissement s'affiche — décidé **ici**, par le domaine et la nature de la
proposition, et pas seulement par le champ que l'IA remplit. Ce champ est rempli
par la partie dont on se méfie : s'y fier serait demander au renard de garder le
poulailler.

---

## Trois choses à retenir

1. **Rien ne part tout seul.** Pas d'appel de modèle, pas de connexion : vous
   téléchargez, vous confiez, vous rapportez.
2. **Une absence n'est pas un zéro.** Un indicateur sans source dit « pas de
   donnée », et l'export le dit à l'IA. Une roue d'équilibre vide ne veut pas
   dire une vie déséquilibrée.
3. **Un chiffre cité est recalculé.** Une analyse qui invente se voit, et elle
   se voit preuve par preuve.
