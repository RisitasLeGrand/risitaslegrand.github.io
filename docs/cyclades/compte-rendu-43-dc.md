# Prompt 43, lots D et C — compte rendu

Branche `claude/p43-dc`, partie de `origin/main` (`a89105f`) le 19 octobre.

Ce document dit, pour chaque point, ce qui est **fait**, ce qui est **listé
sans être touché** (et par quel interdit), ce qui est **contesté**, et ce qui
**reste**. Chaque affirmation est marquée « vu à l'écran » ou « lu dans le
code », comme la règle C6 du 39 le demande.

---

## 1. L'état de `main` à l'ouverture, mesuré et non supposé

| Point | État sur `main` | La preuve |
|---|---|---|
| **C1** une seule boîte | **déjà fait** | `git grep -E '(window\.)?(confirm\|alert\|prompt)\('` sur `src/` ne rend que `boite.ts` (la boîte elle-même), `installation.ts` (`garde.prompt()`, l'API d'installation d'une application web, pas un dialogue), `coffre/bascule.astro:239` — **celui que l'interdit 1 exclut** — et deux commentaires. *Lu dans le code.* |
| **C2** les deux `prompt()` | **moitié** | Celui des appareils est réservé au constructeur. Celui du profil n'est plus natif mais demande toujours **du JSON** : « Forme attendue : {"cognition": 10} ». *Lu dans le code.* |
| **C3** quitter l'épreuve | **fait** | Le lot 1 a écrit en commentaire que « Garder pour plus tard » est une **fonction** et non un habillage : il faudrait enregistrer une épreuve inachevée, ce qu'aucun magasin ne sait faire. *Lu dans le code, et confirmé.* |
| **C4** les erreurs hors bulle | **fait** | `ui.ts` : la bulle dure **2 600 ms** là où le 43 en veut 5 000 au moins, et se place à `bottom-20 sm:bottom-4` plutôt que sur `--sur-bas`. *Lu dans le code.* |
| **D1** étiquettes visibles | **fait** | voir § 2 |
| **D2** erreurs reliées au champ | **fait** | voir § 2 |
| **D3** « Afficher » | **fait**, sauf un fichier réservé | voir § 2 |
| **D4** décimaux | **fait** | voir § 2 |
| **D5** « (facultatif) » | **fait**, un cas listé | voir § 2 |
| **D6** prénom facultatif | **reporté**, et il touche un invariant | voir § 4 |
| **D7** dates locales | **à confirmer** | `sport/corps.astro` porte l'alias `leJourLocal` et le commentaire qui nomme le bug UTC ; `odyssee/corps.astro` passe par midi UTC. Le chemin donné par le prompt pour le budget, `qui-lit-mon-budget.astro`, n'existe pas : le fichier est sous `odyssee/`. *Lu dans le code.* |

---

## 2. Ce qui est fait

### D3 — « Afficher » sur les champs de mot de passe

Huit écrans demandent un mot de passe ; aucun ne permettait de le relire. Sur
un téléphone, une phrase de passe longue se tape à l'aveugle, on se trompe, le
site répond « mot de passe incorrect », et rien ne dit où. Le remède habituel
est d'en choisir une courte — c'est-à-dire d'affaiblir le coffre pour pouvoir
le saisir. **L'absence de ce bouton était un défaut de sécurité**, pas de
confort.

Un module, sept appels. Le bouton est posé **à côté** du champ et non
par-dessus : un bouton superposé oblige à réserver une marge intérieure, et
cette marge est ce qui déborde à 360 px quand la largeur est fixée en `w-56`.

*Vu à l'écran* : le bouton existe sur six champs, rend le texte lisible, le
remasque, annonce son état, et atteint 44 px **dans un contexte tactile** —
le plancher du dépôt vit sous `@media (pointer: coarse)`, et le mesurer à la
souris faisait rougir un bouton conforme.

### D4 — Les nombres décimaux

`input[type=number]` refuse la virgule qu'un clavier français propose. Comme
`Number('')` vaut zéro, **appuyer sur « Enregistrer » dans « Mon corps » avec
un champ vide écrivait une pesée à 0 kg au journal**, sans un mot. Quatre
champs passent au texte avec `inputmode="decimal"` ; les bornes deviennent
`data-min` / `data-max`, parce qu'un champ texte porterait `min` sans
l'appliquer — une promesse muette.

### D1 et D5 — Étiquettes visibles, et « (facultatif) »

Santé portait 8 textes indicatifs pour 2 étiquettes, Molécule 3 pour 1,
l'écran du verrou une étiquette en `sr-only`. Dix-huit champs reçoivent une
étiquette visible ; les unités entrent dedans — « Poids du jour (kg) ». Huit
champs sont marqués « (facultatif) », sans astérisque.

*Trouvé en faisant* : le jour d'un ressenti arrivait **vide** alors que le code
lisait déjà « le jour saisi, ou aujourd'hui ». Il part désormais rempli : rien
ne change à ce qui s'écrit, l'écran dit enfin quel jour il note.

### D2 — L'erreur au pied du champ

Zone de message juste après le champ avec `role="alert"`, `aria-invalid`,
`aria-describedby`. Validation **à la sortie** du champ — « 7 » n'est pas un
poids invalide, c'est le début de « 72,5 » — et effacement **dès la
correction**. À l'envoi, le focus revient au champ fautif, et la saisie n'est
jamais touchée. Plus jamais le texte brut d'une `Error` : la saisie d'une série
l'affichait tel quel.

**Le défaut que l'essai a trouvé, et que je n'aurais pas vu.** `essayer` rendait
`true` dès que rien n'avait levé — y compris quand le travail avait **refusé**
d'écrire. `unSeulGeste` comptait donc le geste comme abouti, notait son repos
de 600 ms, et avalait l'appui qui suivait la correction : on corrige « abc » en
« 72,5 », on réappuie, rien ne se passe, l'ancien message restant sous un champ
qu'on vient de corriger. C'est **exactement** le défaut que `geste.ts` décrit au
19 octobre, corrigé là-bas — et il revenait par cette porte-ci, que mes deux
gestes neufs venaient d'ouvrir.

### C4 — Les erreurs quittent la bulle, et la bulle devient lisible

Trois choses, et la première est la plus grave. **L'échec d'un ressenti partait
dans une bulle**, avec le texte brut de l'exception, et s'effaçait en 2,6 s —
or un ressenti qui n'a pas été enregistré est exactement ce qu'il faut pouvoir
relire. Il va désormais au pied du formulaire, dans une zone annoncée qui
reste, et c'est une phrase écrite pour être lue.

Ensuite la bulle elle-même. **5 000 ms au lieu de 2 600** : 2,6 s suffisent à
voir qu'il s'est passé quelque chose, pas à lire une phrase de dix mots, et
encore moins quand on vient de quitter l'écran des yeux pour appuyer. La durée
est nommée — `DUREE_BULLE_MS` — pour qu'un essai puisse la citer et qu'elle ne
redescende pas sans que personne s'en aperçoive. Et elle **se ferme d'un
appui**, pour qui a déjà lu.

Enfin sa place. `bottom-20` valait 80 px, soit la barre du bas plus une marge,
**mais rien n'y ajoutait l'encoche** : sur un téléphone à poignée d'accueil, la
bulle finissait dessous, là où le doigt appartient au système. La classe
calcule désormais la barre, l'encoche (`--sur-bas`) et la marge.

### C3 — « Garder pour plus tard », et l'épreuve qu'on retrouve telle quelle

Quitter une épreuve commencée perdait les trente à quarante-cinq réponses déjà
données : la question était « rester, ou tout perdre ». Le lot 1 avait posé la
fenêtre à deux issues et écrit pourquoi la troisième manquait — ce n'est pas un
habillage mais une fonction, et aucun magasin ne savait garder une épreuve
inachevée. **Schéma 41**, magasin `epreuveDgfipEnCours`, un enregistrement de
clé fixe, des identifiants de questions et non les énoncés, hors coffre comme
`qcmSessions` — vérifié dans `MAGASINS_SCELLES` plutôt que supposé.

**Non journalisé**, avec son motif à côté de la déclaration : un brouillon
existe pour être consommé ou jeté, le journal est un registre qui ne s'élague
pas. Trois chemins d'effacement, et aucun ne laisse rien : l'épreuve terminée
le consomme, l'abandon l'efface, le groupe `qcm-dgfip` l'emporte.

**La reprise refuse plutôt que de recomposer.** Si la banque a changé,
recomposer une épreuve différente sous le même nom donnerait une note sur un
sujet que la personne n'a pas commencé. Le bloc le dit sans le mot « erreur »,
propose d'en lancer une neuve, et efface le brouillon — le garder reviendrait à
reposer la même question à chaque visite.

*Trouvé en écrivant, et absent de ma description au pilote* : l'ordre des
propositions de chaque question, tiré au sort à la composition. Sans lui, la
reprise les remélangerait — mêmes questions, autre écran, et des cases cochées
qui sembleraient avoir bougé toutes seules.

**Une boîte à plusieurs issues.** « Quitter l'épreuve ? » n'est pas une
question à deux réponses, et `confirmer` n'en sait poser que deux.
`choisirUneIssue` en pose autant qu'il en faut, avec les mêmes règles —
« Annuler » à gauche et au focus, une destructrice qui n'est pas un bouton de
soumission, de sorte que **la touche Entrée ne peut jamais abandonner une
épreuve**.

**L'essai se bâtit un laboratoire**, et c'est le point de méthode de ce lot.
L'écran du QCM ne s'ouvre que si la banque existe ; ce conteneur n'en porte
aucune, et le contenu est chiffré avec la clé du site, de sorte qu'aucune
banque de contrebande ne peut être servie par le réseau. Le dépôt avait déjà la
réponse : un `content/` tiré de `content-exemple/`, une banque synthétique de
quatre questions, un mot de passe factice, un arbre de travail séparé, et tout
effacé derrière. L'essai **refuse de démarrer si `content/` existe** ; il est
inscrit à `EN_LABORATOIRE`.

## 2 bis. Les trois points confiés le 19 au soir

### Le voile des dialogues hors thème

Le `::backdrop` était écrit en dur au `slate-900` de Tailwind : il restait
bleuté dans les quatorze thèmes, là où `.boite::backdrop` tire sa couleur de
`--etat-ombre` depuis son propre correctif. La même valeur était revenue par
une autre porte, ce qu'une correction ponctuelle ne pouvait pas empêcher.

**Une seule règle, deux sélecteurs** — `.boite::backdrop,
.voile-du-theme::backdrop` —, et non deux règles jumelles, qui dérivent. Le
fondu et les durées réduites n'avaient rien à recevoir : `dialog::backdrop`
s'applique à **tous** les dialogues, pas aux seules boîtes ; seule la couleur
leur manquait.

*Et la garde a trouvé un troisième dialogue.* La commande en nommait deux, mon
propre relevé en avait trouvé deux — parce qu'il ne lisait que les `.astro` et
les `.ts`. Le dialogue de l'assistant est un composant **Svelte**, et il
portait le même voile. J'avais écrit au pilote « deux, et pas une troisième » :
c'était faux, et c'est l'essai qui l'a dit, avant la poussée.

### H2 — le mouvement réduit

Six défilements `smooth` ne consultaient aucune préférence. Elle est pourtant
respectée partout ailleurs, mais par la feuille de style — et un défilement
demandé en JavaScript ne passe pas par elle.

Une fonction, et non six `if` : le septième défilement serait reparti en
`smooth`, parce que c'est la forme qu'on recopie en ajoutant un écran.

*Ce que l'essai existant m'a refusé.* Ma première écriture ne lisait que le
réglage du **système**. `essais:mouvement-reduit` tient une règle qu'aucun
lecteur ne connaisse un seul des deux réglages : il y a aussi celui de
l'application, `data-animations`. Quelqu'un qui coupe les animations dans
Cyclades sans pouvoir le faire dans son système — un ordinateur partagé, un
téléphone de service — aurait vu l'écran glisser quand même.

*Et ce que j'ai failli détruire.* `src/lib/defilement.ts` **existait déjà** et
portait deux fonctions que la mise en page et les statistiques importent. Je
l'ai écrasé. Rien ne me l'a dit sur le moment : je lisais `astro check` avec
`tail -3`, qui coupe la ligne des erreurs du résumé, et la construction ne
contrôle pas les types. Les deux fonctions sont rendues à l'octet près, et mes
exports sont ajoutés à la suite.

La rotation 3D, enfin, n'est pas où la commande la situait — elle vit dans
`Grille.svelte` — et elle était **déjà** coupée sous mouvement réduit, sans
que personne le vérifie. L'essai le constate ; ce qui manquait est
l'avertissement, désormais relié à la case qui l'allume.

### H5 — les deux histogrammes des statistiques

**La ligne annoncée est tracée.** « Ligne pointillée à 10 h » était écrit sous
le graphique depuis le début, et aucun trait n'existait.

**Les données en toutes lettres** : un tableau repliable avec sa légende sous
chaque graphique. L'échéancier n'avait aucun nom accessible ; celui de
l'histogramme *récitait* les douze semaines, ce qu'on ne peut ni relire ni
comparer — il annonce maintenant, et renvoie au tableau.

**3:1 sur leur fond, mesuré** et non supposé : les marques n'y étaient pas —
vert à 2,54 sur blanc, et la tranche basse à 1,99 en clair et 1,80 en sombre,
c'est-à-dire la barre des semaines faibles, celle qu'on a le plus besoin de
voir. Les trois tranches se distinguent désormais par la **teinte** et non par
la clarté d'une même couleur : trois marches d'une rampe indigo ne peuvent pas
toutes tenir 3:1 sur blanc **et** sur l'ardoise foncée.

**Ce que je n'ai pas fait** : chaque colonne n'est pas devenue un bouton. Ce
serait la façon la plus directe de rendre la valeur « visible au toucher », et
elle coûterait quarante-deux arrêts de tabulation sur cette page pour une
information que le tableau porte mieux — on y compare deux lignes, ce qu'une
bulle sur une barre ne permet pas.

**Ce que j'ai balayé pour fixer le périmètre** : les seuls graphiques tracés du
dépôt sont ceux de `sport/force.astro` et `odyssee/corps.astro`, et tous deux
étaient **déjà conformes** — SVG en `aria-hidden`, `figure`, tableau des mêmes
points, `caption`. Les autres « barres » du dépôt sont des jauges de
progression, pas des graphiques. D'où le périmètre : les deux histogrammes de
`statistiques.astro`.

---

## 3. Ce qui est listé sans être touché, et par quel interdit

- **Les trois champs de mot de passe d'`appareils.astro`** restent nus : le
  pilote a réservé ce fichier au constructeur pour la durée du 43. La table des
  exceptions de `essais:mot-de-passe-visible` porte cette ligne, avec sa raison,
  pour que personne — moi compris — ne croie D3 complet.
- **« Lancer la bascule »**, sur l'écran du coffre, est le seul bouton d'envoi du
  dépôt grisé pour cause de formulaire incomplet. Le dégriser changerait la
  garde du coffre : l'interdit 1 dit de le **lister** sans y toucher.
- **Le `window.prompt` de `coffre/bascule.astro`**, que le 43 exclut nommément.

---

### Un rouge qui n'est pas de ce lot

`essais:effacement`, entré au socle avec la fusion de `main`, rend **trois
rouges** : le magasin `odysseeCreneaux` n'est déclaré ni dans un groupe de
sauvegarde, ni dans la table des dates. Vérifié en mettant les changements de
ce lot de côté et en relançant l'essai sur `main` seul : les trois y sont déjà.
Transmis au constructeur, qui le corrige sur `main`.

### Un manquement de ma part

Un `.env.local` portant le mot de passe du site a séjourné à la racine du
conteneur de 11 h 52 à 20 h 15, alors que la règle est qu'il n'existe que le
temps d'une construction. Il n'a jamais été commité — vérifié sur tout
l'historique, pas seulement sur l'état courant — et jamais affiché. Effacé,
absence vérifiée ; les constructions suivantes le créent et le suppriment
**dans la même commande**, ce qui est la seule forme qui ne dépend pas de ma
vigilance.

---

## 4. Ce qui est reporté, et pourquoi

Deux points du lot D touchent des fichiers que le prompt 56 réécrit, sur la
branche `claude/p56` remise le même jour et pas encore fusionnée :

1. **C2, le JSON du profil** : `profil.astro` est réécrit en entier par le 56.
   Le faire ici produirait un conflit sur tout le fichier.
2. **D6, le prénom facultatif** : il ne s'agit pas d'une ligne. `controlerChamps`
   **exige** qu'un seul champ soit obligatoire et que ce soit le prénom ; rendre
   le prénom facultatif, c'est retirer cet invariant, donc changer le
   contrôleur — dans `noyau/profil.ts`, que le 56 modifie aussi.

Les deux sont à livrer **après** la fusion du 56. La question est posée au
pilote ; elle ne bloque rien d'autre.
