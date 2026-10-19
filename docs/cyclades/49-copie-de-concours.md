# Prompt 49 — la copie de concours

**Établi le 19 octobre 2026, branche `claude/p48-49`.**

## Le défaut antérieur au prompt, corrigé au passage

Le quota du tirage était calculé sur la banque entière et non sur les questions
servables. Une rubrique dont le stock servable tombait sous son quota rendait
une session plus courte que le format annoncé, sans rien dire. Le quota porte
désormais sur les servables.

Il ne produisait aucune erreur, seulement un écran vraisemblable : c'est
pourquoi il a survécu aux relectures. Il se mesure, il ne se relit pas.

## Ce qui est en place

L'écran de l'épreuve DGFiP se passe comme le concours : sujet entier sur une
page, zones de réponse en regard de chaque question, rebours, feuille de réponse
de soixante zones. Cinq cases par ligne — quatre numérotées et « Ann » —, deux
lignes par zone. Une case cochée ne se décoche plus, et la seconde ligne
remplace la première. Aucune correction n'apparaît avant la remise.

La présentation se règle depuis Paramètres, section Révisions, et depuis l'écran
de l'épreuve. Le défaut est la copie.

## Les deux décisions que j'ai prises seul, et pourquoi

**Trois champs facultatifs dans `SessionDgfip`, et non deux.** La décision 4
demande que le temps utilisé soit affiché à la fin ; il n'était déductible de
rien — l'heure de début n'est pas enregistrée et le rebours ne survit pas au
rechargement. D'où `secondes` en plus de `format` et `zones`.

**`repartir` et `TAILLE_SESSION` ont quitté `qcm.ts`** pour un module pur,
`qcm-composition.ts`. `qcm.ts` importe `./ui`, qui lit `import.meta.env` : il
n'est pas chargeable sous Node, donc rien de ce qu'il contenait n'était
éprouvable hors navigateur. Les deux noms restent réexportés depuis `qcm.ts`,
aucun appelant ne change — mais le commit sur `qcm.ts` est un déplacement et non
un ajout, et c'est à savoir à la fusion.

## Les deux situations que le tableau du prompt ne tranche pas

Dites dans le module plutôt que résolues en silence : « Ann » cochée en même
temps que plusieurs cases numérotées sur la même ligne, et la seconde ligne
laissée vide. Le choix retenu est écrit à côté de la règle, avec son motif.

## Les durées

Aucun arrêté ne distingue QCM et QRC. Le guide ENFiP donne deux minutes par
question : 45 questions font 1 h 30, 30 font 1 h, 40 font 1 h 20 — ce dernier
chiffre retombe sur celui que le guide donne lui-même, ce qui est la seule
vérification possible.

## Ce que les essais tiennent

- `essais:copie-concours` — module pur : tableau de lecture C2 au complet, les
  deux situations hors tableau, conversions case ↔ option, durées, et la
  composition dans cinq états, dont celui où le stock total dépasse largement le
  format alors que la composition dérive quand même.
- `essais:copie:navigateur` — l'écran : les douze questions sur une page, le
  refus de raturer, l'absence de correction avant la remise, le ramassage à zéro,
  la feuille de fin.
- Le filtre des zones est vérifié **des deux côtés** : le prédicat sur ses cas
  limites, et le tirage réel par la feuille de fin, où chaque zone servie ne doit
  annoncer qu'une seule case attendue, entre 1 et 4. Une question à deux bonnes
  réponses en annoncerait deux, une question à cinq propositions une cinquième.
  C'est l'essai que vous avez demandé.

## Les mesures

Barre collante du rebours : 103 px à 360, 103 à 430, 119 à 1280, pour des
plafonds de 111, 140 et 135. La première version prenait 215 px à 360, soit près
d'un tiers d'écran ; c'est la capture qui l'a montré et c'est le script de
captures qui empêche d'y revenir sans s'en apercevoir.

24 captures aux trois largeurs et dans les deux modes d'Égée, hors du dépôt.
Aucun débordement en largeur, aucune erreur de page.

## La banque réelle : conforme, mais figée sur quatre rubriques

Le comptage du constructeur donne 339 questions à quatre propositions sur 540,
et aucune question à plusieurs bonnes réponses — seul le nombre de propositions
réduit les comptes. Confronté aux quotas des deux formats officiels :

- **Catégorie B** — 30 questions : chaque rubrique dispose de dix fois son
  quota ou presque (83 pour 8, 82 pour 8, 75 pour 8, 64 pour 6). Entièrement
  variée.
- **Catégorie A** — 45 questions : Environnement administratif et financier,
  Union européenne, Culture numérique et Anglais comptent exactement 10, 10, 10
  et 5 questions, qui sont toutes à quatre propositions, pour des quotas de 10,
  10, 10 et 5. **Trente-cinq des quarante-cinq questions sont donc toujours les
  mêmes, et seules les dix de logique varient** — tirées parmi 64.

Deux précisions qui comptent pour savoir où est le défaut. D'abord, le filtre de
la copie **ne retire rien** à ces quatre rubriques : elles sont intégralement
servables. La fixité ne vient donc pas de la copie, et elle existe déjà dans
« une question à la fois ». Ensuite, aucune rubrique n'a moins de questions que
son quota : la composition est conforme aujourd'hui dans les deux formats, et
l'annonce « composition adaptée » ne se déclenche pas — elle reste en place pour
le jour où la banque changera, avec ses deux essais.

C'est une limite de contenu et non de code. Les quotas ne bougent pas : ils
reproduisent le sujet réel. Ce qui manque, ce sont des questions dans ces quatre
rubriques.

**Pour fiches-insp** : écrire des questions à quatre propositions en
Environnement administratif et financier, Union européenne, Culture numérique et
Anglais — ces quatre rubriques n'en comptent que 10, 10, 10 et 5, soit
exactement le quota de la catégorie A, ce qui fige trente-cinq des quarante-cinq
questions de chaque épreuve.
