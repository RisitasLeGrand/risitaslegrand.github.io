# Prompt 38 — plan : tâches récurrentes, tâches à étapes, pointage partagé

*15 octobre 2026. **Plan seul — rien n'est codé.** Le prompt l'exige, et je m'y
tiens jusqu'à la validation d'Alexis.*

État relu dans mon dépôt, pas repris du rapport : **T1 à T5 confirmés.**
`Tache` (`modele.ts:55`) porte titre, domaine, échéance, `faiteLe`,
`abandonneeLe`, motif, note — ni récurrence, ni étapes, ni lien de branche.
`Evenement` n'a pas de récurrence non plus.

---

## Réponse 1 — quels pointages existent, et ce qu'ils exigent

Relevé dans `src/lib/noyau/enregistrements.ts` (le registre des 35 magasins
journalisés) et dans `src/lib/noyau/coffre.ts:84` (les 25 magasins scellés).

| Branche | Action « faite » | Magasin | Type d'opération | Sous coffre |
|---|---|---|---|---|
| Sport | une séance | `sportSeances` | `sport.seance` | non |
| Révisions | une session de QCM | `qcmSessions`, `quiz` | `revision.qcm` | non |
| Révisions | une séance de cartes | `seances` | — | non |
| Entraînement cognitif | n-back, relationnel, mapping | `nback`, `relationnel`, `vmSessions` | `revision.cog-training` | non |
| Odyssée | une quête tenue | `odysseeQuetes` | `odyssee.quete` | non |
| Odyssée | un focus, une revue | `odysseeFocus`, `odysseeRevues` | — | non |
| Corps | pesée, mesure, nuit, repas, boisson | `odysseePesees`, `odysseeMesures`, `odysseeNuits`, `odysseeRepas`, `odysseeBoissons` | `odyssee.mesure`, `odyssee.sommeil` | non |
| Psyché | un check-in | `odysseeCheckins` | `odyssee.checkin` | **oui** |
| Psyché | un hebdo | `odysseeHebdos` | `odyssee.checkin` | **oui** |
| Finances | une opération, un pointage | `odysseeOperations`, `odysseePointages` | `odyssee.operation` | **oui** |
| **Santé** | **une prise déclarée** | **aucun** | — | — |

**Champs obligatoires, relevés sur les trois cibles les plus probables :**

- `Seance` (Sport) : `id`, `jour`, `debut`, `statut`, `series[]`, `majLe`.
  `fin`, `difficulte`, `programmeId` admettent `null`. Un pointage depuis le
  calendrier peut donc créer une séance **sans séries** : c'est exactement le
  cas « à compléter » du prompt, et il est représentable sans rien inventer.
- `Checkin` (Psyché) : `id`, `jour`, `le`, `majLe`. Les quatre échelles
  (humeur, énergie, stress, motivation) admettent `null`. **Un check-in vide
  est donc légal** — et c'est un piège : il compterait comme un check-in fait
  tout en ne mesurant rien. Réserve R-c ci-dessous.
- `Operation` (Finances) : relevé non fait, je ne l'ai pas ouvert. À faire en
  phase 0 du lot, avec les autres.

**La ligne qui manque est la plus demandée.** Le prompt donne « Santé : une
prise déclarée » en premier exemple. **Ce magasin n'existe pas** :
`odysseeMedicaments` porte les fiches de molécules, `odysseeTraitements` les
traitements, et `heuresDepuisLaDernierePrise` (`sante.ts:450`) est une fonction
**pure qui reçoit les prises en paramètre** — elle a été écrite par avance pour
un journal qui n'a jamais été construit. Les phases 2 à 14 de Santé sont
toujours en attente de ton accord (tâche #170).

> **Conséquence** : le lien « étape → Santé » du prompt (« prise du matin »)
> ne peut pas écrire de fait réel dans ce lot. Voir la réserve R-a.

---

## Réponse 2 — comment fusionne aujourd'hui une tâche modifiée sur deux appareils

Lu bout en bout, avec les emplacements :

1. Toute écriture de tâche fait `put('odysseeTaches', t)` **puis**
   `journaliser('odysseeTaches', t)` — `donnees.ts:99-100` et `108-109`.
2. `odysseeTaches` est déclaré journalisé, type `odyssee.tache`, clé `id`
   (`enregistrements.ts:314`).
3. L'opération émise porte **l'enregistrement entier** dans sa charge, avec
   ULID, appareil et horloge logique (`faits-domaine.ts:50-70`).
4. `odyssee.tache` **n'est pas** dans `TYPES_A_CONFLIT_EXPLICITE`
   (`fusion.ts:129-138`) : aucun conflit n'est levé, rien n'est soumis à
   l'arbitrage.
5. À la matérialisation : « **pour chaque cible touchée, la dernière opération
   gagne**, et une suppression l'emporte sur ce qui la précède »
   (`service.ts:414-421`, puis `materialiserFaitsDomaine`).

**La fusion se fait donc par enregistrement entier, dernier écrivain gagnant,
et non champ par champ.** Deux appareils qui touchent la même tâche : le plus
récent écrase l'autre **en totalité**, y compris les champs qu'il n'a pas
modifiés.

### Ce que cela impose au modèle, et c'est la décision structurante du lot

Si les exceptions d'une série vivaient **dans** l'enregistrement de la série,
alors « l'appareil A déplace l'occurrence du 12 » et « l'appareil B change
l'heure de la série » seraient deux écritures sur la **même cible** : la
seconde effacerait la première, en silence, sans conflit levé. C'est
exactement le scénario d'essai que le prompt réclame, et il échouerait.

**Donc : une exception = un enregistrement à part, avec sa propre clé.** Les
deux appareils touchent alors deux cibles différentes, et les deux écritures
survivent. Même raisonnement pour les étapes cochées, si deux appareils
peuvent en cocher chacun une.

---

## Deux collisions de vocabulaire, à trancher avant d'écrire une ligne

Le piège de `regles-pointage.ts` — qui n'a rien à voir avec les règles
menstruelles — s'est déjà présenté. Il y en a deux autres, et ils touchent les
deux mots du prompt :

| Nom existant | Ce que c'est vraiment |
|---|---|
| `src/lib/odyssee/recurrences.ts` | **Finances** : déduire le budget en détectant les prélèvements récurrents dans les opérations bancaires |
| `src/lib/odyssee/pointage.ts` | **Finances** : la politique de pointage budgétaire (prudent / standard / rapide) |
| `src/lib/odyssee/categories-pointees.ts` | **Finances** : les catégories comparées au budget |

Nommer le nouveau moteur `recurrences.ts` ou `pointage.ts` rendrait le dossier
illisible et ferait lire le mauvais fichier au prochain audit. **Proposition :
`repetition.ts`** (le calcul des occurrences) et **`liaison-branches.ts`** (le
pointage partagé), avec les étapes dans `etapes.ts`.

---

## Le modèle proposé

Quatre enregistrements, trois nouveaux magasins. Aucun champ retiré, aucune
tâche existante touchée.

| Enregistrement | Magasin | Clé | Rôle |
|---|---|---|---|
| `Tache` **étendue** | `odysseeTaches` | `id` | gagne `repetition`, `etapes`, `lien`, `reporter` — tous facultatifs |
| `Occurrence` | `odysseeOccurrences` *(nouveau)* | `id` | une exception : pointée, abandonnée, déplacée ou modifiée. Porte `tacheId` et `jourPrevu` |
| `EtapeCochee` | `odysseeEtapesCochees` *(nouveau)* | `id` | une étape cochée, pour une occurrence donnée |
| `ReportEnAttente` | `odysseeReports` *(nouveau)* | `id` | décision 5 : un pointage retenu coffre fermé, à reporter à l'ouverture |

**Les occurrences sont calculées, jamais stockées à l'avance** — seules les
exceptions existent, ce que le prompt demande et que la fusion impose.

**Migration : aucune.** Les trois champs ajoutés sont facultatifs ; une tâche
existante sans `repetition` reste une tâche simple, et son enregistrement est
valide tel quel. Les trois magasins nouveaux naissent vides. Ce qui *doit*
être fait : les déclarer dans `enregistrements.ts` (sinon ils ne voyagent pas
entre appareils) et décider, pour chacun, s'il est scellé — voir R-b.

---

## Les phases

| # | Ce qu'elle fait | Fichiers | Risque |
|---|---|---|---|
| 0 | Relever les champs obligatoires des 11 cibles de la question 1, et les écrire | *(document seul)* | nul |
| 1 | Le moteur de répétition, **pur** : règles, fins, occurrences d'un intervalle | `odyssee/repetition.ts` (nouveau), essais | **le cœur** : fin de mois, bissextiles, changement d'heure. Pur et testable sans écran |
| 2 | Le modèle et les magasins : `Tache` étendue, occurrences, étapes, reports | `odyssee/modele.ts`, `donnees.ts`, `noyau/enregistrements.ts`, migration de schéma | **élevé** : touche la base. Instantané avant migration déjà en place |
| 3 | Les étapes : cocher, réordonner, avancement « 3 / 7 », fin de tâche (décision 2c) | `odyssee/etapes.ts`, `pages/odyssee/taches.astro` | moyen |
| 4 | L'écran : « Répéter », « cette fois / les suivantes / toute la série » | `taches.astro`, `calendrier.astro` | moyen — c'est là que se joue « aucune série réécrite en silence » |
| 5 | Le lien de branche, **sens calendrier → branche** | `odyssee/liaison-branches.ts` (nouveau) | **élevé** : écrit dans d'autres branches. Un fait par geste, jamais deux |
| 6 | Le sens inverse, branche → tâche (décision 4a) | `liaison-branches.ts`, écrans de branche | élevé — c'est ici que le double comptage guette |
| 7 | Coffre fermé : le report en attente (décision 5a) et le libellé neutre | `liaison-branches.ts`, `coffre.ts`, calendrier | **élevé** : rien de scellé en clair |
| 8 | La Revue et les indicateurs : ce qui est pointé n'est pas redemandé | `moment-revue.ts`, `deja-servi.ts`, `jour.ts` | moyen |
| 9 | Essais de fusion à deux appareils, captures, compte rendu | essais, `docs/` | faible |

---

## Mes réserves

**R-a — le lien Santé n'a pas de cible.** Le premier exemple du prompt
(« prise du matin » → Santé) ne peut pas écrire un fait réel : le journal des
prises n'existe pas, et le construire relève des phases Santé que tu n'as pas
encore validées. Trois issues, et je ne tranche pas :
 1. livrer le lien Santé **sans écriture**, en « à compléter » seulement ;
 2. sortir Santé du lot 38 et la brancher quand ses phases seront faites ;
 3. construire le journal des prises **dans** ce lot — ce qui l'élargit
    nettement et empiète sur un plan en attente.

**R-b — les trois magasins nouveaux : scellés ou non ?** Une occurrence porte
un `tacheId` et un jour. Si la tâche est liée à Santé, **le simple fait qu'une
occurrence existe à 8 h tous les jours est déjà une information**. Sceller les
occurrences protège mieux, mais empêche le calendrier d'afficher quoi que ce
soit coffre fermé — or la décision 5a veut justement qu'on puisse pointer
coffre fermé. Mon avis : **ne pas sceller les occurrences, sceller les
reports**, et ne jamais mettre de libellé dans une occurrence. À trancher.

**R-c — un check-in vide compterait comme un check-in.** Les quatre échelles
de `Checkin` admettent `null`. Pointer « check-in fait » depuis le calendrier
créerait un enregistrement sans aucune mesure, qui ferait nombre dans les
tendances de Psyché sans rien mesurer. C'est la frontière exacte entre
« pointer » et « inventer ». Proposition : pour Psyché, le pointage **ouvre le
check-in** au lieu de l'écrire. Contraire à « pointer doit rester un geste »,
donc à trancher.

**R-d — décision 3a et la Revue.** « L'occurrence manquée passe non faite le
lendemain, la Revue la signale une fois » : le mécanisme de revue manquée du
prompt 36 groupe déjà les rappels sur sept jours. Il faudra que les deux
comptages ne se superposent pas, sinon un même oubli sera signalé deux fois.
Je le traite en phase 8 ; je le signale parce que c'est un double comptage
d'un autre genre que celui de l'interdit 2.

**R-e — l'import `.ics` reste tel quel** (décision 7, tranchée). Conséquence à
écrire au compte rendu : un calendrier importé avec des `RRULE` continuera de
n'afficher que la première occurrence. C'est un écart visible à l'usage.

---

## Ce que j'attends de toi

Ta validation du plan, et ton arbitrage sur **R-a** (Santé), **R-b** (sceller
ou non) et **R-c** (le check-in vide). Les autres réserves, je les porte.

---

# Phase 0 — le relevé des onze cibles

*15 octobre 2026, après ton « Je valide ». **Exécuté et constaté** : chaque
forme ci-dessous a été ouverte dans le code, pas déduite.*

Un champ est dit **obligatoire** quand le type ne l'autorise ni à manquer ni à
valoir `null`. C'est la seule définition qui compte ici : ce sont les champs
qu'un pointage venu du calendrier devra remplir, et lui seul saura les
remplir.

| Branche | Enregistrement | Fichier | Obligatoires | Facultatifs ou `null` |
|---|---|---|---|---|
| Sport | `Seance` | `sport/modele.ts:196` | `id`, `jour`, `debut`, `statut`, `series[]`, `majLe` | `fin`, `difficulte`, `note`, `programmeId` |
| Révisions | `Seance` (séance de cartes) | `db.ts:400` | `theme`, `jour`, `statut`, `secondes`, `etendue` | `id`, `termineeLe`, `fiches` |
| Révisions | `SessionDgfip` (QCM) | `db.ts` | `le`, `posees`, `bonnes`, `mauvaises`, `abstentions`, `points`, `maximum`, `parRubrique` | `id` |
| Cognitif | `SessionNBack` | `db.ts:263` | `le`, `n`, `dimensions`, `nombreEpreuves`, `taux`, `reperees`, `aReperer`, `erreurs`, `secondes` | `id`, `titre`, `statut` |
| Cognitif | `SessionRelationnelle` | `db.ts:302` | `le`, `items`, `tentes`, `reussis`, `secondes` | `id` |
| Cognitif | `SessionVeridical` | `db.ts:359` | `le`, `famille`, `mode`, `charge`, `essais`, `reussis`, `paires`, `seuilMedian`, `secondes` | `id` |
| Odyssée | `Quete` | `odyssee/modele.ts` | `titre`, `domaine`, `cadence`, `active`, `tenues[]`, `creeeLe` | — |
| Odyssée | `Focus` | `odyssee/modele.ts` | `domaine`, `debut`, `fin`, `secondes`, `interrompue` | `tacheId` |
| Odyssée | `Revue` | `odyssee/modele.ts` | `type`, `jour`, `reponses` | — |
| Corps | `Pesee` | `odyssee/modele.ts` | `id`, `jour`, `le`, `kg`, `note`, `majLe` | — |
| Corps | `Nuit` | `odyssee/modele.ts` | `id`, `jour`, `coucher`, `lever`, `note`, `majLe` | `qualite`, `reveils` |
| Corps | `Repas` | `odyssee/modele.ts` | `id`, `jour`, `le`, `moment`, `intitule`, `note`, `majLe` | `kcal`, `proteines`, `glucides`, `lipides` |
| Corps | `Boisson` | `odyssee/modele.ts` | `id`, `jour`, `le`, `mL`, `majLe` | — |
| Psyché | `Checkin` | `odyssee/psyche.ts` | `id`, `jour`, `le`, `majLe` | `humeur`, `energie`, `stress`, `motivation`, `note` |
| Finances | `OperationBancaire` | `odyssee/finances.ts` | `id`, `compteId`, `jour`, `centimes`, `libelle`, `categorie`, `majLe` | `transfertAvec` |
| Finances | `Pointage` | `odyssee/pointage.ts:282` | `id`, `operationId`, `statut`, `parts[]`, `auteur`, `pourquoi`, `appareil`, `decideLe`, `majLe` | `vendeurNom`, `typeId`, `versionDuDictionnaire`, `importId`, `precedent` |
| **Santé** | **—** | **—** | **aucune cible** | voir R-a |

## Les quatre constats que ce relevé ajoute au plan

**1. Deux cibles sont hors de portée d'un pointage depuis le calendrier, et
ce n'est pas une réserve nouvelle mais une précision de la décision 4.**
`SessionDgfip` et `SessionVeridical` exigent des chiffres de résultat —
`bonnes`, `seuilMedian` — qu'un geste de pointage ne peut pas inventer. Une
tâche « faire un QCM » liée à cette branche ne pourra donc pas *créer* la
session ; elle pourra seulement **se faire cocher** par une session existante
(sens branche → tâche, phase 6). Le sens calendrier → branche s'arrêtera aux
cibles dont tous les champs obligatoires sont, soit portés par le geste, soit
déductibles du jour.

**2. `Mesure` n'est pas une cible.** Le `Mesure` de `odyssee/indicateurs.ts`
est un **agrégat calculé**, pas un enregistrement. Le magasin
`odysseeMesures` du tableau de la réponse 1 porte les mesures corporelles,
et sa forme vit dans `odyssee/corps.ts`. Je corrige ici ma propre ligne.

**3. `Pointage` (Finances) porte `pourquoi` obligatoire.** Un pointage créé
par le calendrier devra donc écrire une raison en clair. C'est une bonne
contrainte — elle oblige à dire « pointé depuis le calendrier » plutôt qu'à
laisser une ligne sans origine — et elle est satisfaisable sans rien
inventer.

**4. La ligne Santé reste vide.** Rien n'a changé depuis le plan : il n'y a
pas de magasin de prises. **R-a n'est pas arbitrée, je ne l'arbitre pas, et
je ne crée pas de journal de prises sur une inférence.** Tout ce qui en
dépend reste hors de ce lot.

---

# Les treize décisions, tranchées par Alexis le 15 octobre

*Reçues dans ma conversation, donc exécutoires. Consignées ici parce qu'elles
commandent les phases 2 à 9, et qu'une décision qui ne vit que dans un fil de
conversation est une décision perdue.*

| | Tranché | Conséquence pour le lot |
|---|---|---|
| **D1** | **Laisser Santé hors des liens dans ce lot.** | Aucune écriture dans `odysseeMedicaments` depuis le calendrier. L'étape se coche, les autres branches sont liées normalement. |
| **D2** | **Go pour la phase 2**, avec un essai de sauvegarde et de restauration **avant et après**. | Condition d'exécution, pas une formalité : la mesure « avant » précède la première ligne touchant `enregistrements.ts`. |
| **D3** | Reports **scellés** ; occurrences **en clair et sans libellé**, *sauf* celles des tâches liées à une branche sous coffre, **scellées aussi**. | C'est la variante du pilote, meilleure que ma proposition : une occurrence quotidienne à 8 h liée à une branche scellée révèle un rythme, même sans libellé. Impose que la tâche porte son lien **avant** que l'occurrence soit écrite. |
| **D4** | Pointer **ouvre** l'écran de check-in ; rien n'est écrit tant que rien n'est répondu. | Psyché n'est jamais écrite par un geste de pointage. |
| **D5** | **Dans un seul sens** : faire la séance dans la branche coche la tâche ; pointer la tâche ne crée pas de séance. | `SessionDgfip` et `SessionVeridical` ne sont jamais créées par un geste. Aucun zéro n'entre dans l'historique de révision. |
| **D6** | Un texte neutre, **sans le titre de la tâche** : « Pointé depuis le calendrier ». | `Pointage.pourquoi` ne reçoit jamais de titre. |
| **D7** | Santé **par étapes** : **faire constater ce qui reste de la phase 1**, puis 2 et 3 à partir de la collecte, puis 4 en s'appuyant sur le prompt 38 ; chaque phase présentée avant d'être lancée. | Hors de ce lot. Le premier pas est un **constat**, pas un développement. |
| **D8** | Consigner la clause NooTopics : date, les deux conditions, la portée, **sans aucun nom**. | À faire dans `plan-molecules.md`. |
| **D9** | Le **code s'aligne sur la source** (PHQ-9). | Corrige un essai rouge. |
| **D10** | Je retrouve le changement en cause, je montre la liste des questions, **puis** on tranche. | Pas de correctif avant la liste. |
| **D11** | Audio des 175 fiches : en tâche de fond, **après** le prompt 38 et l'audit. | Hors de ce lot. |
| **D12** | Mettre à jour l'adresse du dépôt ; **garder le garde-fou tel quel**. | |
| **D13** | CLS résiduel : au prompt de corrections qui suivra l'audit. | Hors de ce lot. |

## Les deux réserves, levées le 15 octobre

Je les avais écrites ; elles n'ont pas tenu une heure, et c'est le bon
fonctionnement du dispositif.

**R-1 était une erreur de ma part, et elle est réparée.** J'avais écrit
qu'aucun magasin de prises n'existait : `odysseeMedicaments` **est** ce
journal (`Prise`, `odyssee/sensible.ts:46`), scellé et journalisé. Ce qui
reste à construire est le triplet molécule / traitement / prise de H.2, pas le
journal. Les formulations de D1 et D7 qui reposaient sur ma prémisse fausse
— « le lien Santé viendra avec le journal des prises », « compléter la phase 1
(journal des prises) » — ont été **réécrites par Alexis** : D1 devient
« laisser Santé hors des liens dans ce lot », sans justification technique
empruntée à mon erreur, et D7 demande de « faire constater ce qui reste de la
phase 1 ». Le choix est donc **pris en connaissance de cause**, et c'est tout
ce que je demandais.

**R-2 est comblée.** D5 est tranchée : lien **à sens unique**. Les phases 5 et
6 sont exécutables.

**Les treize décisions sont désormais complètes.** Rien ne reste en suspens
pour les phases 2 à 9.
