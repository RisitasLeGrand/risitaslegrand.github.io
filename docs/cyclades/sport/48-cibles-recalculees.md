# Prompt 48 — les cibles recalculées, et les écarts avec le dossier

**Établi le 19 octobre 2026, branche `claude/p48-49`.**

La décision 7 du 18 octobre pose que les muscles d'un exercice viennent de
`BIBLIOTHEQUE` et non de la convention du dossier, et que **chaque écart est
signalé**. Voici ces écarts, calculés et non estimés.

Les chiffres de ce document sont **épinglés par `npm run essais:copie-modele`** :
s'ils cessent d'être vrais, la batterie rougit. Un compte rendu qu'aucun essai
ne garde devient faux en silence, et c'est le genre de document qu'on finit par
croire.

## 0. Comment ils sont obtenus

- Les cibles du dossier sont celles de ses tableaux « Cibles hebdomadaires de
  séries par muscle », transcrites dans `src/lib/sport/modeles-programmes.ts`
  et revérifiées à chaque passage par `npm run essais:modeles-sport`.
- Les cibles du code sont calculées par `ciblesDuModele`
  (`src/lib/sport/copie-de-modele.ts`), qui passe par `volumePrevu` — le même
  calcul que la colonne « prévu » de l'écran, pour que la colonne « écart » ne
  mesure pas la divergence de deux formules.
- Le coefficient des muscles secondaires reste **0,5**, en valeur unique
  (décision 13). La réserve du dossier — une estimation exploratoire autour de
  0,32, H01-24 — est citée à l'écran sous « Pourquoi ces valeurs », et aucune
  cible ne repose sur elle.

## 1. Ce que le dossier contient, et sa cohérence

Les sept modèles se lisent sans ambiguïté, et **le dossier ne se contredit
nulle part** : pour chacun, la somme des séries de chaque séance égale le
nombre annoncé en titre, le total hebdomadaire égale la fiche, et
`parSemaine` égale le nombre de séances types. Aucun exercice ne reçoit deux
conventions de muscles différentes d'un modèle à l'autre.

- Exercices distincts employés par les sept modèles : **34**, dont **7 ajoutés**
  (point 9 du dossier, décision 10).
- `BIBLIOTHEQUE` comptait 31 exercices ; elle en compte **38**.
- Exercices livrés qu'aucun modèle n'emploie : **4** — soulevé de terre
  (barre), extensions lombaires, extensions du cou, course. Ils ne gênent
  rien ; signalés pour mémoire.

## 2. Les muscles : 12 exercices sur 27 diffèrent

Les sept exercices ajoutés ne figurent pas ici : ils n'existaient pas dans la
bibliothèque, il n'y avait donc rien à préférer à la convention du dossier,
qui est reprise telle quelle.

| Exercice | Ce qui diffère | Dossier | `BIBLIOTHEQUE` |
|---|---|---|---|
| squat (barre) | principaux | quadriceps | quadriceps, **fessiers** |
| | secondaires | fessiers, **adducteurs** | **ischio-jambiers, lombaires, abdominaux** |
| fentes (haltères) | principaux | quadriceps | quadriceps, **fessiers** |
| | secondaires | fessiers, **adducteurs** | **ischio-jambiers** |
| presse à cuisses | secondaires | fessiers, **adducteurs** | fessiers |
| curl marteau (haltères) | principaux | biceps | biceps, **avant-bras** |
| | secondaires | avant-bras | — |
| tractions pronation (barre fixe) | secondaires | biceps | biceps, **avant-bras** |
| shrugs (haltères) | secondaires | — | **avant-bras** |
| relevés de jambes suspendu (barre fixe) | secondaires | — | **obliques, avant-bras** |
| rowing buste penché (barre) | secondaires | trapèzes, **épaules (arrière)**, biceps | biceps, trapèzes, **lombaires** |
| tirage horizontal (poulie) | secondaires | trapèzes, **épaules (arrière)**, biceps | biceps, trapèzes |
| développé militaire (barre) | secondaires | **épaules (côté)**, triceps | triceps, **trapèzes** |
| écarté couché (haltères) | secondaires | **épaules (avant)** | — |
| gainage ventral | secondaires | obliques | obliques, **lombaires** |

La **latéralité**, elle, ne diverge nulle part : les quatre exercices
unilatéraux du dossier le sont aussi dans la bibliothèque, et une série
unilatérale compte pour les deux côtés, comme le dossier le veut.

## 3. Ce que cela fait aux cibles : 66 sur 126

Sept modèles, dix-huit muscles. Plus de la moitié des cibles bouge.

| Modèle | Cibles qui changent |
|---|---|
| M1 — Poussée / Tirage / Jambes, 3 jours | 10 sur 18 |
| M2 — Poussée / Tirage / Jambes, 6 jours | 11 sur 18 |
| M3 — Haut / Bas, 4 jours | 10 sur 18 |
| M4 — Corps entier, 3 jours | 10 sur 18 |
| M5 — Corps entier, 2 jours | 10 sur 18 |
| M6 — Maison, 3 jours | **5 sur 18** |
| M7 — Haut / Bas avec spécialisation | 10 sur 18 |

M6 est le moins touché, et la raison est nette : six de ses treize exercices
sont des ajouts du point 9, dont les muscles viennent du dossier faute d'autre
source.

### Les six familles d'écart

**1. Les adducteurs tombent à zéro ou presque.** C'est l'écart le plus lourd.

| Modèle | Dossier | Code |
|---|---|---|
| M1 | 4,5 | **0** |
| M2 | 7 | 2 |
| M3 | 7 | 2 |
| M4 | 5 | **0** |
| M5 | 3 | **0** |
| M6 | 4,5 | **0** |
| M7 | 7 | 2 |

Le dossier compte les adducteurs en secondaire au squat, aux fentes et à la
presse à cuisses ; la bibliothèque ne les y met pas. Le seul exercice livré
qui les travaille est « adducteurs à la machine », employé par trois modèles.
**Quatre modèles sur sept laissent donc les adducteurs à zéro.**

**2. Les lombaires montent de +4 à +5 partout** : le squat et le rowing buste
penché les comptent en secondaire dans la bibliothèque. Le dossier les plaçait
sous le minimum d'environ quatre séries ; le code les place au-dessus.

**3. Les fessiers montent de +3 à +4,5** : le squat et les fentes les ont en
muscle **principal** dans la bibliothèque. Le dossier avait annoncé cette
sensibilité pour M1 — « les fessiers passent de 9 à 13,5 ». Le chiffre réel
est **9 → 12**, et non 13,5 : sa note supposait aussi la presse à cuisses en
principal, ce que la bibliothèque ne fait pas. Le dossier savait où il était
fragile ; il avait raison sur le sens, pas sur l'ampleur.

**4. Les ischio-jambiers montent de +1,5 à +4,5** : le squat les compte en
secondaire.

**5. Les avant-bras montent de +1 à +6** : tractions, shrugs, relevés de
jambes et curl marteau les comptent. Le dossier les disait sous le minimum
partout ; le code les y laisse pour M5 et M6 seulement.

**6. Les épaules (arrière) baissent de −1,5 à −3** : le dossier les met en
secondaire au rowing et au tirage horizontal, la bibliothèque non. Sur M5
elles tombent à **0**.

## 4. Ce qui est fait, et ce qui demande un arbitrage

**Fait.** Aucune valeur n'a été corrigée ni rapprochée. Les cibles d'une copie
sont celles du calcul ; celles du dossier restent dans le catalogue, sous
`ciblesDuDossier`, pour mémoire et pour ce tableau.

**À trancher.** Les adducteurs à zéro sur quatre modèles. `musclesAbsents()`
le signale déjà de lui-même à l'écran — un muscle qu'aucun exercice du
programme ne touche est nommé, avec la mention que c'est peut-être voulu. La
décision 12 laisse le cou, les avant-bras et les lombaires à la personne, sans
bloc ajouté. **Faut-il traiter les adducteurs de la même façon**, en s'en
tenant au signalement de l'écran, ou le dire aussi dans la carte du modèle,
avant la copie ? En attendant la réponse, c'est le signalement existant qui
s'applique : rien n'a été ajouté au programme, et rien n'a été caché.
