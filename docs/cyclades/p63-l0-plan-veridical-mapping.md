# Prompt 63 · L0 — le plan de la refonte du Veridical Mapping

Écrit le 31 octobre 2026 par l'agent A. **Lecture et planification seulement :
ce lot ne touche rien dans `src/`.**

La référence de comportement est `VMTrainer.html`, déposé par Alexis. Elle se
**lit**, ne s'exécute pas, et son code ne se recopie pas. C'est un DOM
enregistré : ses statistiques déjà remplies et le `div#unbroke-widget-host`
injecté par une extension ne disent rien du produit et sont ignorés.

## 0. Comment ce relevé a été pris, et une correction

Tous les chiffres de ce document viennent d'un comptage sur le fichier, pas
d'une lecture d'ensemble. Le motif est donné à chaque fois, pour qu'un autre
puisse le refaire et obtenir le même nombre.

**Une correction, et elle est instructive.** Mon premier comptage ancrait le
motif en début de ligne — `^dim\('` — et annonçait **116 dimensions**. Sept
déclarations sont indentées, et toutes les sept sont des dimensions parlées :
le motif les manquait, et le sous-compte tombait précisément sur la famille la
plus particulière du lot. Le compte juste est **123**, obtenu avec `^\s*dim\('`.

C'est la même faute que celle qui a caché trente-quatre bornes au mauvais rang
le même jour : un motif de mesure se vérifie sur ce qu'il doit trouver, et non
seulement sur ce qu'il trouve.

## 1. L'inventaire

### VMTrainer — 1 951 lignes, un seul fichier

| ce qui est compté | nombre | motif |
|---|---|---|
| exercices | **12** | `EXERCISES` (l. 1451) |
| dimensions | **123** | `^\s*dim\('` |
| · de vision | 69 | `dim('vision.` |
| · d'audition | 54 | `dim('audition.` |
| · prothétiques | 79 | second argument `'prothetic'` |
| · métathétiques | 42 | second argument `'metathetic'` |
| dimensions **discrètes** | **32** | `disc:true` — ce sont elles qui demandent `qz` |
| dimensions **parlées** | **7** | libellé `(spoken)` |
| paramètres de roving | 15 | `ROVE_LABEL` |

Les douze exercices : `coherence`, `completion`, `constellation`,
`discrimination`, `induction`, `interference`, `matching`, `one_to_many`,
`relational`, `reproduction`, `sequence`, `transposition`. `reproduction`
délègue à `matching(C, true)` — ce n'est pas un treizième.

### Notre côté — 3 073 lignes, 10 fichiers, et 7 dimensions

| fichier | lignes | ce qu'il porte |
|---|---|---|
| `composants/VeridicalMapping.svelte` | 1 161 | l'écran de séance entier |
| `session.ts` | 447 | le tirage des essais, les tâches, les réglages |
| `composants/TableauDeBord.svelte` | 379 | matrice, courbes, journal |
| `correction.ts` | 260 | la correction détaillée du 60 |
| `dimensions.ts` | 176 | les 7 dimensions, et `PAS = 120` |
| `escalier.ts` | 162 | l'escalier 2-down, les seuils |
| `audio.ts` | 139 | la synthèse des stimuli sonores |
| `hub.ts` | 130 | l'entrée, le choix des paires |
| `stimulus.ts` | 116 | le rendu commun |
| `composants/Stimulus.svelte` | 103 | le canevas |
| `pages/cog-training/veridical-mapping.astro` | 99 | la page |

Nos sept dimensions : `taille`, `luminosite`, `intensite`, `duree`
(prothétiques), `hauteur`, `position`, `teinte` (métathétiques).

Les essais qui le touchent, et qu'aucun lot ne supprime : `essais-veridical.mts`,
`essais-correction.mts`, `essais-mots-cog-training.mts`, `essais-activite.mts`,
`essais-cog-training-navigateur.mjs`, `essais-pictogrammes.mjs`.

## 2. La carte de correspondance

### Les exercices

| VMTrainer | chez nous aujourd'hui | ce que le lot fait |
|---|---|---|
| `discrimination` | tâche `point` | garde, c'est l'ancre de l'escalier |
| `matching` · `reproduction` | tâche `point` (partiel) | sépare les deux |
| `relational` | tâche `squelette` (partiel) | précise |
| `coherence`, `completion`, `induction`, `interference`, `one_to_many`, `sequence`, `transposition`, `constellation` | **absents** | à écrire au L3 |
| — | tâche `plan` | **renommée « couple »** (décision 5) |

« Plan 2-D » est réservé aux constellations ; nos tâches `modulaire`,
`exhaustif`, `prothetique`, `visuelle`, `teinte` sont des **réglages de
tirage**, non des exercices, et le L1 doit cesser de les nommer comme tels.

### L'escalier — ce qui change exactement

| | nous | VMTrainer | source |
|---|---|---|---|
| règle | 2-down / 1-up | **3-down / 1-up** | `s.run>=3` (l. 1357) |
| facteurs | 2 → 1,41 → 1,19 par paliers | **×0,87 / ×1,2 constants** | l. 1357-1358 |
| départ | 36 pas (= z 0,3025) | **z 0,18** | l. 1352 |
| bornes | 1 à 60 pas (z 0,0084 à 0,504) | **z 0,02 à 0,45** | `DMIN`, `DMAX` l. 1350 |
| seuil rendu dès | 8 inversions | **4 inversions** | `rev.length>=4` l. 1361 |
| inversions retenues | 6 dernières, moyenne géométrique | 6 dernières, moyenne géométrique | identique |
| convergence | écart-type du log ≤ 0,1 | **6 inversions** | décision 3 du pilote |
| départ des autres exercices | — | `seuil × RATIO`, borné [0,03 ; 0,45] | `RATIO` l. 1349 |

`RATIO` : `matching` 0,5 · `coherence` 1,2 · `one_to_many` 1,3 · `sequence` 1,1
· `transposition` 1,2 · `completion` 1,1 · les autres 1.

### La charge

`loadSpec(L)` (l. 1367) est un barème de huit barreaux, chacun
`[roving, exposition, délai]` :

    [0,1,0] [1,1,0] [1,.75,0] [2,.75,0] [2,.75,1000] [2,.55,1000] [2,.55,2000] [2,.45,2500]

Le masque paraît dès que l'exposition passe sous 0,6. Au-delà du huitième
barreau, l'exposition tend vers 0,2 par `0,45 × 0,9^k`, le délai plafonne à
5 000 ms, et la difficulté continue par un bruit sur la source
(`jit = max(0, L-12) × 0,01`).

Montée si seuil ≤ 0,05 et 8 réussites sur 10 ; descente sous 50 % sur 12.

**« Charge » ne désignera plus qu'une seule chose.** Nos 1 à 3 sous-essais par
écran deviennent un réglage facultatif nommé « correspondances par écran ».

## 3. Le défaut n° 7 du pilote, confirmé dans le code

`updateLoad` (l. 1373) :

```js
const d = st.ex.discrimination || st.ex.constellation;
if (d && d.rev.length>=6 && thrEst(d)<=0.05 && …) { st.load++; … }
```

La convergence et la montée de charge ne lisent donc **que** ces deux
exercices. Les dix autres ne font jamais monter la charge, et leur convergence
n'est jamais constatée. C'est à corriger au L1 (la convergence) et au L2 (la
charge), et chacune des deux doit porter son essai : un exercice pris au hasard
parmi les dix doit pouvoir faire monter la charge.

## 4. Le schéma cible, et la migration

### Ce que nous stockons aujourd'hui

`src/lib/db.ts`, schéma **version 43**, deux magasins : `vmSeuils`
(`SeuilVeridical`, indexé par `famille`) et `vmSessions` (`SessionVeridical`,
indexé par `le`). Le seuil porte son escalier entier — `delta`,
`bonnesDeSuite`, `inversions[]`, `derniereDirection`, `essais`, `reussis` —
et `delta` comme `inversions[]` sont **en pas**, sur l'échelle `PAS = 120`
de `dimensions.ts`.

### Ce qu'il devient

- `z ∈ [0 ; 1]`, continu, et `qz` pour les 32 dimensions discrètes ;
- la conversion est **`z = pas / 119`** (décision 2 du pilote), appliquée à
  `delta` et à chaque élément de `inversions[]` ;
- le champ qui porte l'échelle est **nommé**, pas deviné : un seuil migré
  porte `echelle: 'z'`, un seuil d'avant `echelle: 'pas'`. Sans ce champ, un
  seuil de 0,3 serait indiscernable d'un seuil de 0,3 pas, et la deuxième
  migration lirait la première à l'envers.

### Et la règle qui gouverne la migration

Les seuils mesurés sous l'ancienne règle **2-down** sont gardés et affichés
« ancienne mesure ». Ils ne se mélangent pas aux nouveaux : un 2-down converge
vers 70,7 % de réussite, un 3-down vers 79,4 %, et moyenner les deux donnerait
un nombre qui ne désigne aucun point de la courbe. **Chaque paire repart donc
d'un escalier neuf**, et l'ancienne mesure reste lisible à côté.

Le marqueur est donc double, et c'est voulu : `echelle` dit comment lire le
nombre, `regle: '2-down' | '3-down'` dit ce qu'il mesure.

### L'essai de migration, et son sabotage

- un seuil en pas se convertit, et `36 → 0,3025` à quatre décimales ;
- un seuil déjà en z n'est **pas** reconverti — la migration doit être
  idempotente, et c'est ce qu'un second passage vérifie ;
- un seuil 2-down garde sa marque et ne sert pas de départ à un escalier
  3-down ;
- **sabotage** : la conversion retirée du chemin des `inversions[]` — le seuil
  rendu reste alors plausible, puisque la moyenne géométrique de six nombres en
  pas donne un nombre en pas, et seul l'essai le voit.

**Ce lot attend le signal du 58 p2**, puisque le schéma de la base change. Le
L1 sans migration et le L2 n'attendent pas.

## 5. Les dimensions, par lots — et la frontière pour le L5 de B

Le L5 passe à B, sur une branche séparée de la mienne. La frontière doit être
une frontière de **fichiers**, pas une convention : deux agents qui éditent le
même fichier se croisent, et nous nous sommes déjà croisés quatre fois
aujourd'hui.

### La forme proposée : un registre, et des rendus séparés

    src/features/veridical-mapping/
      dimensions/
        registre.ts        ← À MOI. Le type, l'échelle, qz, et la LISTE.
        rendus/
          vision-simple.ts     ← à moi (lot 5a)
          vision-forme.ts      ← à B (lot 5b)
          vision-texture.ts    ← à B (lot 5c, les lourdes)
          audition-simple.ts   ← à moi (lot 5a)
          audition-motif.ts    ← à B (lot 5b)
          audition-parle.ts    ← à B (lot 5d, les 7 parlées)

`registre.ts` ne contient **aucun dessin** : il déclare le type d'une
dimension, son échelle (`log`, `lin`, `circ`), sa quantification éventuelle,
ses paramètres de roving, et il importe les rendus. Un rendu ne connaît que
son canevas et sa valeur `z`. Ainsi le L1 et le L5 ne se touchent jamais, et
une dimension s'ajoute en modifiant **un** fichier de rendu plus **une** ligne
du registre.

**La ligne du registre est le seul point de contact**, et c'est acceptable :
une ligne par dimension, ajoutée en fin de liste, ne produit qu'un conflit
d'adjacence — celui que nous avons déjà résolu aujourd'hui sans dommage sur la
liste `SOCLE`.

### Le découpage

| lot | dimensions | critère |
|---|---|---|
| **5a** — légères | ~45 | un disque, une barre, une tonalité : rendu immédiat, aucun calcul par pixel |
| **5b** — formes et motifs | ~40 | polygones, grilles, séquences : du calcul, mais borné et prévisible |
| **5c** — lourdes | 8 | `spatial_correlation`, `fractality`, `voronoi_chaos`, `logistic_chaos`, `correlation` (vision et audition), `melodic_fractality` |
| **5d** — parlées | 7 | `weekday`, `month`, `clock_hour`, `compass_point`, `note_name`, `letter`, `number` |

**Les 8 lourdes sortent du fil principal** — Worker ou `OffscreenCanvas` — ou
sont précalculées. La règle du pilote est une mesure, pas une intention :
*aucune ne doit retarder un stimulus sur téléphone, et cela se mesure.* L'essai
qui en découle : le temps entre la demande d'un stimulus et sa première image,
sur chacune des huit, sous un bridage de processeur — et le bridage ET la
vitesse pleine, puisque le bridage sérialise les courses.

**Les 7 parlées n'existent qu'avec une voix française locale**
(`voice.localService`). Sans elle, elles sont **absentes**, et l'écran dit
pourquoi — jamais une voix distante, qui serait une dépendance réseau.

## 6. Les défauts de VMTrainer, et où chacun se garde

Chacun doit avoir son essai. La colonne de droite dit dans quel lot il tombe.

| défaut à ne pas reproduire | garde | lot |
|---|---|---|
| un abandon laisse l'essai en cours | aucune double boucle de séance, aucun essai enregistré dans une autre séance | L4 |
| la réécoute n'est pas verrouillée pendant la lecture | verrou, et l'échéance « gut » suspendue pendant une réécoute | L3 |
| les plans 2-D échappent à exposition, masque et roving | ils les appliquent aussi | L6 |
| le journal s'écrit à la fin | au fil de l'eau : un onglet fermé ne perd rien | L4 |
| le nombre d'événements se lit dans la durée | indice parasite retiré, et mesuré | L2 |
| la saturation varie la clarté | oklch à clarté constante | L5a |
| le limiteur écrase le haut de la sonie | mesuré et documenté | L5a |
| une donnée stockée que rien ne lit | toute donnée stockée est lue quelque part | L4 |
| Échap sans confirmation | passe par `confirmer()` | L3 |
| non focalisable au clavier, tactile inférieur | tout focalisable, le tactile vaut le clavier | L3 |
| canevas sans alternative textuelle | alternative pour chacun | L3 |
| retour non annoncé | `aria-live` | L3 |
| flashs | gris neutre pour tout ce qui varie dans le temps, et un essai qui mesure la variation de luminance contre le seuil WCAG | L2 |
| gestionnaire en ligne, `innerHTML` non échappé, `window.Audio` masqué | la CSP du site l'interdit déjà ; un essai le prouve sur le nouveau code | L3 |

## 7. Les heures, par lot

Estimation d'agent, en heures de travail effectif, essais et sabotages
compris. Elle vaut ce que valent les estimations ; ce qui est sûr est l'ordre
de grandeur relatif.

| lot | contenu | heures | dépend de |
|---|---|---|---|
| **L0** | ce document | **fait** | — |
| **L1** | z, qz, escalier 3-down, renommages « couple » et « correspondances par écran », convergence pour les douze. Essais existants adaptés, aucun supprimé. | 6 – 8 | rien |
| **L1-m** | la migration des seuils, `echelle` et `regle`, idempotence, sabotage | 3 – 4 | **signal du 58 p2** |
| **L2** | roving, exposition, masque, délai, bruit ; montée et descente pour les douze ; essai photosensible | 5 – 7 | L1 |
| **L3** | les 12 exercices, en 3 sous-lots, chacun avec sa correction détaillée | 14 – 20 | L1, L2 |
| **L4** | étapes, plan de séance entrelacé, Alternate, une seule paire ; tableau de bord et bilan ; journal au fil de l'eau | 8 – 11 | L3 |
| **L5** | les dimensions, 4 sous-lots — **à B** | 12 – 16 | registre du L1 |
| **L6** | plans 2-D, codes véridiques, modulaire k = 2, 3, 4 | 5 – 7 | L3, L5 |

Soit **41 à 57 heures** hors L5, et **53 à 73** avec.

**Ce qui pèse le plus est le L3**, et c'est attendu : douze exercices, chacun
avec sa correction détaillée « dans l'esprit de `correction.ts` » — montrer
l'écart, ne pas prétendre démontrer. Le découper en trois sous-lots n'est pas
un confort : un lot de douze exercices ne se mesure pas, parce qu'un rouge y
cache les onze autres.

## 8. L'ordre, et ce qui attend quoi

1. **L1 sans migration**, puis **L2** : du TypeScript pur et des écrans, qui
   n'attendent pas le 58 p2.
2. **La migration et le stockage** après le signal du pilote.
3. **L3**, puis **L4**, puis **L6**.
4. **L5** en parallèle chez B, dès que `dimensions/registre.ts` existe — c'est
   la seule chose que le L1 lui doit, et elle vient tôt.

Une branche par lot, partie de `main`. Batterie, un sabotage par garde
nouvelle, compte rendu de quelques lignes avec le commit. Pas de rebase ni de
force-push ; `content/` jamais en clair ; le mot de passe lu depuis un fichier
hors du dépôt, jamais dans une commande ; aucune dépendance réseau ; français,
consignes à l'infinitif, termes nouveaux au glossaire.

## 9. Ce que ce plan ne tranche pas

Trois choses, que je ne décide pas seul.

1. **Le sort de nos sept dimensions.** Elles portent des noms français
   (`taille`, `luminosite`…) là où VMTrainer nomme par domaine
   (`vision.size`, `vision.luminance`). Les renommer casse les seuils déjà
   mesurés — l'identifiant d'une paire est `de>vers`. Soit on garde les sept
   noms et le registre les traite comme des alias, soit la migration les
   renomme en les convertissant. **Je penche pour l'alias** : une migration qui
   renomme ET convertit fait deux choses à la fois, et un rouge n'y dirait pas
   laquelle a échoué.
2. **Le nombre de dimensions à porter.** Cent vingt-trois est l'inventaire de
   la référence, pas forcément la cible. Les 8 lourdes et les 7 parlées sont
   les plus coûteuses et les moins sûres ; un premier jalon à ~85 (5a + 5b)
   serait déjà vingt fois notre couverture actuelle.
3. **`PAS = 120` et la conversion `z = pas/119`.** La conversion est juste pour
   un seuil, mais `PAS` sert aussi au TIRAGE des valeurs. Le passage à z
   continu change ce tirage pour les dimensions continues, et le `qz` le
   conserve pour les discrètes. Il faut dire si une dimension continue doit
   rester tirée sur une grille de 120 points — ce qui garde nos stimuli
   reproductibles — ou devenir vraiment continue.
