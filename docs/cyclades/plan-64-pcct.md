# Prompt 64 — PCCT dans l'Entraînement cognitif

**Lot L0 : plan.** Lecture et planification seules. Rien n'est écrit dans `src/`.

La référence de comportement est
`PCCT_prospective_and_cognitive_control_training.html`, un fichier autonome de
3 238 lignes déposé par Alexis le 31 octobre. Elle a été **lue, non exécutée**,
et son code n'est pas recopié : ce plan en décrit le comportement, pas sa mise
en œuvre.

---

## 1. Ce que fait l'exercice

Un flux de nombres cadencé. À chaque nombre, on applique une opération entre le
nombre courant et celui entendu **n positions plus tôt** (n de 1 à 5) :

| opération | résultat attendu |
| --- | --- |
| `+` | courant + référence |
| `−` | référence − courant |
| `×` | produit |
| `÷` | référence ÷ courant, le tirage étant contraint aux diviseurs pour tomber juste |

Les n premiers essais sont un échauffement : il n'y a pas encore de référence,
donc rien à répondre.

Par-dessus ce flux, **une mémoire prospective** : « dans X secondes, appuyez sur
K ». La consigne s'affiche 6,5 s puis disparaît ; **rien n'est rappelé à
l'échéance** — c'est tout l'intérêt de l'épreuve. Une consigne toutes les 12 à
35 s, deux en attente au plus, horizon de 60 s, fenêtre de réponse de 3 s.

Quatre modules facultatifs s'y ajoutent (ICT, NDM, SDM, changement de règle) et
sept aides (chiffres inversés, doigt glissé, délai de grâce, chiffre des unités,
plages, chiffre unique, pavé à l'écran).

Durée de 15 minutes en standard, de 1 à 60 en personnalisé, intervalle de départ
1 500 ms, adaptatif entre 50 et 6 000 ms.

### Les trois algorithmes de rythme

| algorithme | règle |
| --- | --- |
| standard | blocs de 5 essais ; au moins 4 justes → −100 ms, sinon +100 ms |
| douce | ±`adaptUp` / `adaptDown`, réglables (20 ms par défaut) |
| précision cible | fenêtre de 20 essais, ajustement de `clamp(round(err × 160), −80, 80)` |

---

## 2. Carte de correspondance avec les exercices existants

L'Entraînement cognitif porte trois exercices. Le plus proche de PCCT est la
**Correspondance perceptive** (Veridical Mapping) : stimulus cadencé, procédure
adaptative, voix, séance, correction détaillée. C'est donc son contrat qu'on
suit, point d'accroche par point d'accroche.

| ce qu'il faut déclarer | fichier | ce qu'y fait la Correspondance perceptive | ce qu'y fera PCCT |
| --- | --- | --- | --- |
| le dossier de l'exercice | `src/features/veridical-mapping/` (10 fichiers, 3 073 lignes) | `session.ts`, `escalier.ts`, `audio.ts`, `correction.ts`, `hub.ts`, `dimensions.ts`, `stimulus.ts` + 3 composants | `src/features/pcct/` : `moteur/` (tirage, calcul, rythme, mémoire prospective, notation), `composants/`, `correction.ts`, `audio.ts` |
| la page | `src/pages/cog-training/veridical-mapping.astro` (99 lignes) | enveloppe le composant racine | `src/pages/cog-training/pcct.astro` |
| la carte du hub | `src/pages/cog-training/index.astro` | entrée du tableau `EXERCICES` : `id`, `icone`, `titre`, `anglais`, `description`, `travaille`, `duree`, `href` | une entrée de même forme, `duree: 'environ 15 minutes · son facultatif'` |
| l'onglet de branche | `src/lib/branches.ts` | `nom`, `court`, `description`, `chemin`, `icone` | PCCT n'est pas un onglet : comme `/cog-training/quad-n-back/`, il appartient à la branche sans y figurer (voir le commentaire de `branches.ts:486`) |
| l'XP | `src/lib/gamification.ts` | `xpVeridical(reussis, convergences)` et les jetons `XP.veridical*` | `xpPcct(...)` et ses jetons, à partir des trois scores (arithmétique, mémoire prospective, global) |
| les échelons par famille | `src/lib/indicateurs.ts` | `parFamille['Veridical Mapping'] = max(charge)` | `parFamille['PCCT']` — reste à décider quelle grandeur fait échelon : l'intervalle atteint, ou n |
| les faits d'activité | `src/lib/odyssee/faits-revisions.ts` | un fait `revision.cog-training` par session, avec `details.famille = 'veridical'` | idem, `details.famille = 'pcct'` |
| le détail de l'XP dans l'Odyssée | `src/lib/odyssee/activite.ts` | entrée `cog-veridical` : `quand`, `base`, `pourquoi` | entrée `cog-pcct`, avec un `pourquoi` qui nomme les trois scores |
| le registre des corrections | `src/features/correction/registre.ts` | `{ id: 'veridical-mapping', nom: 'Veridical Mapping', correctionDetaillee: true }` | `{ id: 'pcct', nom: 'PCCT', correctionDetaillee: true }` |
| l'écran de correction | `src/features/correction/composants/CorrectionPerceptive.svelte` | lit le journal des essais | un composant frère, qui lit le journal de PCCT |
| les magasins | `src/lib/db.ts` | `vmSeuils`, `vmSessions` + `tousLesSeuils…`, `ecrire…`, `ajouterSession…`, `toutesLesSessions…` | voir le § 3 |
| la sauvegarde | `src/lib/db.ts`, `exporterTout` | les sélections d'entraînement par exercice, via `clefSelection` | les profils de réglages de PCCT |
| l'effacement par rubrique | `src/lib/db.ts` | `effacerVeridical()` | `effacerPcct()` |

**Nom affiché** : « PCCT — calcul cadencé et mémoire prospective ».

---

## 3. Schéma de données

Trois magasins, sur le modèle `vm*` :

### `pcctSessions` — une par séance

```
id          ULID posé à l'écriture (jamais une clé auto-incrémentée :
            deux appareils produiraient le même « 1 » pour deux séances)
le          horodatage ISO
mode        'standard' | 'personnalise' | 'decouverte'
reglages    l'empreinte des réglages joués (n, opération, modules, aides)
essais      nombre d'essais notés (hors échauffement)
reussis     nombre d'essais justes
isiDebut    intervalle de départ, ms
isiFin      intervalle atteint, ms
isiMedian   intervalle médian, ms
tempsReaction { median, p90 }  arithmétique, ms
scoreArith  réussis / essais
scorePm     hits / (hits + misses + omissions + wrong)
scoreGlobal comme la référence
secondes    durée réelle
```

Index sur `le`, comme `vmSessions`.

### `pcctEssais` — un par essai, pour la correction détaillée

```
id        ULID
session   l'id de la séance
rang      numéro d'essai
nombre    le nombre entendu
reference le nombre d'il y a n positions
operation 'add' | 'sub' | 'mul' | 'div'
attendu   le résultat attendu
donne     ce qui a été répondu (null si omission)
juste     booléen
aide      l'aide qui a validé, s'il y en a une ('doigt-glisse', 'grace', …)
isi       l'intervalle de cet essai, ms
reaction  temps de réaction, ms (la référence ne le mesure pas — décision 6)
modules   ce que les modules ont exigé et ce qui a été donné
```

Index sur `session`.

### `pcctPm` — un par consigne de mémoire prospective

```
id         ULID
session    l'id de la séance
creeeA     quand la consigne a paru
echeance   quand elle devait être exécutée
fenetre    la fenêtre de réponse, ms
touche     la touche demandée
presse     ce qui a été pressé, ou null
presseA    quand
verdict    'hit' | 'miss' | 'omission' | 'wrong'
```

### Profils de réglages

Vingt au plus, dans `etat`, sous une clé par exercice comme `clefSelection`.
**Jamais dans `localStorage`**, et jamais de `localStorage.clear()`.

### Ce qui dépend du 58 p2

Les trois magasins, leur politique `.schema`, et leur appartenance aux groupes
de sauvegarde et de synchronisation **attendent que le 58 p2 soit sur main** :
c'est lui qui apporte les nouveaux magasins, la politique de schéma et les
groupes. L1 n'écrit donc pas dans `db.ts` ; c'est L4 qui le fera, après le
signal du Pilote.

---

## 4. Les défauts de la référence

Le Pilote m'en a relayé une liste. J'ai **vérifié moi-même** ceux qui suivent, en
lisant la référence ; je distingue ce que j'ai constaté de ce que je porte encore
sur parole, et chaque défaut porté sera prouvé par un essai qui rougit **avant**
d'être corrigé.

### Constatés par lecture

| défaut | ce que j'ai lu |
| --- | --- |
| `synth` employé avant sa déclaration | employé aux lignes 1714, 1726, 1736 et 1740 ; déclaré `const synth = …` ligne 1970. Un `const` est en zone morte avant son initialisation : l'appel qui arrive pendant le chargement lève. |
| `SHARE_KEYS` de même | employé ligne 1917 (`checkImport`), déclaré ligne 3062. |
| **SDM est commandé par un réglage nommé `rrt`** | `if(isCorrect && settings.rrt && …)` ligne 2583. Le nom du réglage ne dit rien de son effet, et `DEFAULTS` ne contient aucun `sdm`. À ne pas reporter : le réglage s'appellera `sommeComparee`. |
| **SDM compare à la dernière somme JUSTE** | `prevCorrectAnswerVal` est réécrit dans la branche `if(isCorrect)`. Après un essai manqué, la comparaison porte donc sur une somme plus ancienne que la précédente. C'est plus précis que « la somme attendue précédente » : la consigne devra dire *laquelle*. |
| le pavé n'est mélangé qu'une fois | `padOrder: 'random'` est libellé « Shuffle each trial », mais `buildNumpad()` n'est appelé qu'au démarrage de la séance et au changement de réglage — jamais depuis `runTrial`. |
| `endSession` sans garde | la fonction commence par `pmStopSession(); sessionActive=false;` sans vérifier qu'elle n'a pas déjà couru. |
| valeurs par défaut affichées fausses | `DEFAULTS` porte `duration: 15`, `startISI: 1500`, `isiMin: 500`. Le balisage affiche « 20 min » (ligne 413) et « 3000 ms » (ligne 1027). |

### Portés sur parole, à prouver par un essai avant correction

- le délai de grâce ne marche jamais. Ce que j'ai lu : la fenêtre s'ouvre bien
  (`openCoyoteWindow`, appelée ligne 2429 quand l'essai précédent a été manqué),
  et la branche qui la note est **après** celle qui note l'essai courant, avec
  `!answerProcessed` pour condition. Une réponse tardive semble donc consommée
  par l'essai courant avant d'atteindre la branche de grâce — mais je n'ai pas
  établi le chemin complet, et je ne l'affirmerai qu'après mesure ;
- ICT impossible à répondre : le champ est désactivé alors que les touches ne
  sont écoutées que sur lui. Correction prévue : écouter au niveau du document,
  et rendre les fausses alarmes possibles ;
- NDM et SDM : la validation automatique juge avant la flèche. La flèche doit
  pouvoir se donner avant ou après le nombre ;
- mémoire prospective : avec plusieurs consignes échues, la bonne touche de
  l'une compte « miss » pour les autres ; à 5 s l'encart est encore visible à
  l'échéance ; quand l'horizon tombe sous 5 s, plus rien n'est reprogrammé ;
- division non entière quand le minimum de plage est supérieur à 1 ;
- le pavé doit contenir 0 et les négatifs quand ils sont possibles ;
- minimum de plage à 0 : la saisie se transforme en −99 ;
- « Réglages par défaut » fait une copie superficielle.

---

## 5. Les lots

Une branche par lot, partie de `main`. Batterie à chaque lot, **un sabotage par
garde nouvelle**, rapport en quelques lignes avec le commit.

### L1 — le moteur, sans écran

Tirage des nombres (y compris la contrainte de divisibilité), calcul du résultat
attendu, les trois algorithmes de rythme, l'ordonnancement de la mémoire
prospective, la notation des trois scores. Essais unitaires, sans navigateur.

Gardes, et le sabotage qui doit les faire rougir :

| garde | sabotage |
| --- | --- |
| la division tombe juste à toute plage | rendre le tirage libre quand le minimum dépasse 1 |
| l'échauffement ne note rien | noter les n premiers essais |
| le rythme reste entre 50 et 6 000 ms | retirer la borne |
| le bloc standard exige 4 justes sur 5 | passer à 3 |
| la précision cible borne l'ajustement à ±80 | retirer `clamp` |
| une consigne échue n'en fait pas manquer une autre | noter « miss » pour toutes les échues |
| l'horizon sous 5 s reprogramme quand même | couper la reprogrammation |

### L2 — l'écran de séance

Clavier et pavé, équivalents tactiles, voix et sons, retour, découverte d'une
minute. Le pavé se remélange **à chaque essai** quand c'est demandé.

| garde | sabotage |
| --- | --- |
| le pavé se remélange à chaque essai | ne le construire qu'au démarrage |
| chaque touche a son équivalent tactile de 44 px | réduire une cible |
| le retour passe par `aria-live`, pas seulement par la couleur | retirer la région |
| sans voix locale, l'écran le dit et passe au visuel | accepter une voix distante |
| `prefers-reduced-motion` est respecté | rendre l'animation inconditionnelle |
| Échap passe par `confirmer()` | arrêter sans confirmation |
| les valeurs par défaut affichées sont les vraies | réafficher 20 min et 3 000 ms |
| la fin de séance ne compte qu'une fois | retirer la garde |

### L3 — les modules

ICT, NDM, SDM, changement de règle (marqué « expérimental »).

| garde | sabotage |
| --- | --- |
| l'ICT se répond au document, fausse alarme comprise | n'écouter que sur le champ désactivé |
| la flèche NDM compte avant comme après le nombre | juger avant la flèche |
| SDM nomme la somme à laquelle il compare | comparer à la dernière juste sans le dire |
| les couleurs du changement de règle tiennent 3:1 | en tirer une hors jetons |

### L4 — stockage et bilan

Les trois magasins, les groupes de sauvegarde et de synchronisation, le coffre,
l'effacement par rubrique, les profils, le journal, la correction détaillée, le
bilan, l'XP, le hub.

| garde | sabotage |
| --- | --- |
| rien n'est écrit dans `localStorage` | y écrire un réglage |
| les données sont couvertes par le coffre | les écrire hors coffre |
| `effacerPcct` n'efface que PCCT | lui faire appeler `toutEffacer` |
| au plus 20 profils | en accepter 21 |
| la correction nomme l'aide qui a validé | l'omettre |
| le bilan s'ouvre sur ce qui a progressé | l'ouvrir sur les échecs |
| les temps de réaction sont stockés | ne stocker que le verdict |

---

## 6. Heures estimées

Calibrées sur la taille **mesurée** des deux exercices comparables :
Correspondance perceptive 3 073 lignes en 10 fichiers, Quad N-Back 3 383 lignes
en 10 fichiers. PCCT porte davantage de surface — quatre modules, sept aides,
trois algorithmes de rythme, une mémoire prospective — et devrait se situer
entre les deux et le double.

| lot | heures |
| --- | --- |
| L0 plan | 2 à 3 (celui-ci) |
| L1 moteur et essais unitaires | 10 à 14 |
| L2 écran de séance | 12 à 16 |
| L3 modules | 8 à 10 |
| L4 stockage et bilan | 10 à 14 |
| **total** | **42 à 57** |

Ces nombres sont une estimation, et non une mesure : la part la moins sûre est
L2, où le pavé, les équivalents tactiles et la voix se mesurent au navigateur,
et où chaque sabotage coûte une bâtisse complète — le lot E3 a demandé six
bâtisses pour six sabotages.

---

## 7. Ce que je ne peux pas décider seul

1. **Les six termes du glossaire.** `content/` est dans `.gitignore` et aucun
   fichier n'y est suivi : `content/glossaire.yml` ne peut donc pas arriver par
   une commit de ma part. Les six termes — n-back, intervalle, mémoire
   prospective, inhibition, fausse alarme, omission — doivent passer par qui
   détient `content/`. Je peux en rédiger le libellé dans ce plan, mais pas les
   livrer.

2. **« Les unités ».** Les points d'accroche que j'ai trouvés sont
   `branches.ts`, `gamification.ts`, `serie-xp.ts`, `indicateurs.ts`,
   `odyssee/activite.ts`, `odyssee/faits-revisions.ts`,
   `correction/registre.ts`, `db.ts` et la page du hub. Je n'ai trouvé aucun
   module d'« unités » : si ce mot désigne autre chose que les échelons
   d'`indicateurs.ts`, il me faut le fichier.

3. **Quelle grandeur fait échelon** dans `indicateurs.ts` : l'intervalle atteint
   ou la profondeur n. La Correspondance perceptive y met sa charge maximale ;
   les deux candidats se défendent, et le choix se lit au tableau de bord.

4. **Le réglage `rrt`.** Je le renomme `sommeComparee` plutôt que de porter un
   nom qui ne dit pas ce qu'il commande. À confirmer, parce qu'un profil de
   réglages exporté depuis la référence ne se relira pas — mais il n'y a pas de
   profils exportés, puisque le partage par URL est écarté.
