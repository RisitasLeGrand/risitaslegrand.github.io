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
| **C3** quitter l'épreuve | **deux issues sur trois** | Le lot 1 a écrit en commentaire que « Garder pour plus tard » est une **fonction** et non un habillage : il faudrait enregistrer une épreuve inachevée, ce qu'aucun magasin ne sait faire. *Lu dans le code, et confirmé.* |
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
