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

# Anomalies relevées en construisant — phase 5

Règle d'audit §4.2 : une anomalie nouvelle devient une ligne de tableau, pas
un correctif silencieux. Les deux premières viennent de moi.

| № | Ce qui a été constaté | Statut |
|---|---|---|
| A-1 | **Le registre de la phase 5 justifiait `revision.seance` par une affirmation fausse** : « une séance de cartes se crée avec un thème, un jour et un statut ». Elle porte un quatrième champ, `secondes`, et c'est une durée **mesurée** — le fait `revision.seance` en déduit son instant de début (`faits-revisions.ts`). La créer d'un geste de calendrier aurait écrit une séance de zéro seconde, c'est-à-dire exactement ce que la décision 5 refuse pour les QCM : « un zéro n'est pas une absence ». | **Corrigé**, et dit : `revision.seance` passe à `branche-vers-tache`. La décision 5 du 15 octobre le disait déjà en toutes lettres (« faire la séance dans la branche coche la tâche ; pointer la tâche ne crée pas de séance ») ; je ne l'avais appliquée qu'aux QCM. |
| A-2 | **La décision 5 dit « la séance », et il y en a deux.** `sport.seance` reste déclarée `deux-sens` : une séance de sport sans série est un état légal du modèle (« à compléter »), et rien n'y est mesuré. Mais si la décision 5 visait *toute* séance, alors le sport doit passer lui aussi à `branche-vers-tache`, et il ne reste plus qu'une action pointable (la quête). | **Ouvert — arbitrage d'Alexis.** Le changement est d'un mot dans le registre plus la suppression d'un écrivain. Rien n'est écrit en attendant qui dépende du choix. |
| A-3 | **Pointer l'occurrence d'une tâche répétée non liée ne compte nulle part.** Une tâche répétée n'a pas de `faiteLe` ; `faits-odyssee.ts` ignore (`if (!tache.faiteLe) continue;`) tout ce qui n'en porte pas, et `odyssee.occurrence` n'est pas dans `TYPES_SERIE`. Clore une tâche simple rapporte de l'XP ; pointer une occurrence n'en rapporte pas. | **Constaté, non corrigé.** Compter `odyssee.occurrence` casserait « un fait par geste, jamais deux » pour les tâches liées, qui écriraient alors deux faits comptés. La correction demande une règle que personne n'a tranchée : compter l'occurrence **seulement** si la tâche n'est pas liée. C'est une ligne pour la phase 8 (la Revue et les indicateurs). |

## Les anomalies tranchées par Alexis le 15 octobre

| № | Décision | Ce que cela change |
|---|---|---|
| A-2 | **Le sport reste pointable.** `sport.seance` garde `deux-sens` : la décision 5 du 15 octobre visait la séance de révision, pas celle de sport. | Rien — c'est l'état du code. L'écart avec `revision.seance` est désormais voulu et daté : la révision porte une durée mesurée, le sport n'en porte aucune. |
| A-3 | **Compter l'occurrence seulement si la tâche n'est pas liée.** | Règle neuve à écrire en phase 8. Une tâche liée continue de ne compter que son fait de branche ; une tâche répétée sans lien comptera son occurrence. La liste des types comptés ne suffit plus : il faut regarder la tâche d'origine. |
| Santé | **Reste hors des liens** jusqu'au plan Santé. | Rien — `odyssee.medicament` garde `hors-du-lot`. |

## Anomalies relevées en construisant — phase 6

| № | Ce qui a été constaté | Statut |
|---|---|---|
| A-4 | **`cocheLaTache` refusait `ouvre-ecran`, et c'était le mauvais garde-fou.** L'essai de la phase 5 exigeait qu'un check-in ne coche pas sa tâche, avec cette raison : « ouvrir l'écran puis le fermer vaudrait pour fait ». L'exigence est juste, le moyen était faux. `cocheLaTache` ne répond pas à « ouvrir l'écran coche-t-il ? » mais à « un fait écrit dans la branche coche-t-il ? ». Un check-in fermé sans réponse n'écrit **aucun fait** : rien n'appelle le retour de branche, et la tâche reste ouverte d'elle-même. Le refus déclaré, lui, cassait l'aller-retour — on ouvrait l'écran depuis le calendrier, on répondait, et la tâche ne se cochait jamais. | **Corrigé.** `cocheLaTache` est désormais vrai pour tout sauf `hors-du-lot`. C'est l'absence de fait qui protège, et l'essai le dit maintenant en toutes lettres. Trouvé par la phase 6, pas par la phase 5 : la suite de la phase 5 avait figé l'erreur en assertion. |
| A-5 | **Une tâche liée aurait compté deux fois dans le sens retour.** Le fait de branche existe déjà quand on coche la tâche ; si la tâche close écrivait en plus son `odyssee.tache`, une séance de sport vaudrait deux faits comptés pour un seul geste. Ce n'est pas symétrique de la phase 5, où l'occurrence ne compte pas et où un seul fait naît. | **Corrigé dans le même lot** : une tâche liée **cède son fait** à sa branche (`laTacheCedeSonFait`), et seulement quand cette branche en produit un qui compte — une tâche liée à une pesée ou à une prise déclarée ne cède rien, sans quoi on supprimerait son activité sans rien mettre à la place. La règle est la même phrase qui justifiera, en phase 8, la décision d'Alexis sur A-3 : **la comptabilité d'une tâche liée vit dans sa branche**. |

## Anomalies relevées en construisant — phase 7

| № | Ce qui a été constaté | Statut |
|---|---|---|
| A-6 | **Le magasin des reports en attente ne peut pas servir à ce pour quoi il a été fait.** `odysseeReports` a été créé en phase 2 pour garder un geste fait **coffre fermé** et l'écrire à l'ouverture. Il est **scellé** : `ecrireReport` et `tousLesReports` appellent `exigerLeCoffre()`, qui lève coffre fermé. Le magasin exige donc la condition qu'il était censé contourner. C'est une erreur de conception de ma part, pas une limite du coffre. | **Ouvert — arbitrage d'Alexis, parce que la ligne touche le chiffrement.** Le desceller n'est pas un détail : une file en clair portant « tâche T, jour J, branche psyché » révèle qu'un check-in a eu lieu ce jour-là, ce que l'exception scellée a précisément pour objet de cacher. La trace serait transitoire — effacée au report — mais elle existerait. Rien n'est écrit en attendant. |
| A-7 | **En conséquence, le geste sur une tâche sous coffre, coffre fermé, est refusé** au lieu d'être reporté. | **Livré ainsi, et dit.** `gesteSousCoffre()` rend le refus comme une **valeur** avec sa raison affichable, plutôt que de laisser `exigerLeCoffre()` lever une exception à la figure de l'écran — une erreur attrapée finit toujours par être confondue avec une panne. Le jour où A-6 est tranchée, c'est ce point unique qui change. **Mis à jour le 15 octobre 2026** : A-6 ayant été tranchée (option D) et l'écran câblé (A-9), le refus n'est plus le cas général. Coffre fermé sur une branche scellée, le geste est **gardé chiffré** si ce navigateur a une boîte, et refusé seulement s'il n'en a pas — avec la raison affichée, qui dit quoi faire. |
| A-8 | **`calendrier.astro` ne porte ni « Répéter » ni la portée**, alors que la ligne de la phase 4 du plan le nommait avec `taches.astro`. Constaté : le fichier ne contient aucune occurrence des mots `serie`, `repet`, `portee`. L'interface de série vit uniquement dans `taches.astro`. Les **événements** d'agenda ne se répètent donc pas. | **Ouverte.** Ce n'est pas forcément un manque : un événement n'est pas une tâche, et la répétition a été conçue pour les tâches. Mais le plan l'annonçait, et le compte rendu ne l'a pas démenti. À trancher : les événements doivent-ils se répéter, ou la ligne du plan était-elle trop large ? |
| A-9 | **Les phases 5, 6 et 7 n'étaient appelées par aucun écran.** `pointage-partage.ts`, `retour-de-branche.ts`, `coffre-ferme.ts` et le registre `liaison-branches.ts` n'avaient pour seuls importateurs que leurs propres scripts d'essai. Conséquence visible : le bouton « Faite » appelait `clore(tache.id, true)` quelle que soit la tâche, donc **une tâche répétée pointée une fois ne revenait jamais**. | **Close en partie — option A signée le 15 octobre 2026.** `taches.astro` appelle désormais `gesteSousCoffre` puis `pointerDepuisLeCalendrier`, et dépose un pli chiffré quand le coffre est fermé sur une branche scellée. `essais:taches-parcours` est passé au vert sans qu'une seule de ses assertions soit assouplie. **Reste ouvert : le retour de branche (phase 6)**, qui va dans l'autre sens — un fait écrit dans une branche doit cocher la tâche qui le visait — et qui se branche sur les écrans de branche, pas ici. Voir A-11. |
| A-11 | **Le retour de branche n'est toujours appelé par aucun écran.** `retourDeBranche()` et `decisionDeRetour()` attendent d'être appelés depuis les écrans qui écrivent un fait — séance de sport, Psyché, Corps — pour que la tâche qui visait ce fait se coche d'elle-même. Sans cela, une tâche liée reste ouverte alors que son fait existe, et il faut la pointer à la main : le double geste que la phase 6 existait pour supprimer. | **Ouverte.** Surface plus large que la précédente — plusieurs écrans de branche, chacun avec son moment d'écriture. Je ne l'emporte pas dans le même geste : la corriger à l'aveugle sur six écrans sans contrôle de bout en bout pour chacun reproduirait exactement A-9. |
| A-12 | **`noyau/permissions.ts` n'est appelé par aucun écran.** Trouvé par `essais:orphelins` à sa première exécution. Seuls `essais-noyau.mts` et `essais-psyche.mts` l'atteignent. | **Ouverte — intégrée au prompt 39** sur décision d'Alexis du 15 octobre (« Les intégrer »). Déclarée en exception datée dans le contrôle, le temps du lot. |
| A-13 | **`odyssee/consentement.ts` n'est atteint par personne.** Trouvé par `essais:orphelins`. Un seul script le charge, par un `import()` dynamique **qui avale son propre échec** — il n'y a donc même pas d'essai qui en dépende vraiment. C'est le module du consentement à l'apprentissage étendu, et la source n° 10 du prompt 32 : **aucun écran ne demande ce consentement aujourd'hui.** | **Ouverte — intégrée au prompt 39** sur décision d'Alexis du 15 octobre. La plus sérieuse des deux : un consentement qu'on ne demande pas n'est pas un consentement. |
| A-10 | **Une phrase de mon compte rendu de la phase 7 était fausse.** « Le calendrier se dessine entièrement coffre fermé. Les occurrences sont calculées depuis la série… » : `calendrier.astro` ne calcule **aucune** occurrence. Il ne lit que `evenementsEntre()`. La phrase est vraie de `taches.astro`, seul écran qui importe `repetition.ts`. | **Rectifiée ci-dessous**, pas supprimée. Même faute que les trois de la phase 0 du prompt 32 : conclure d'un module à l'écran qui est censé l'appeler, sans ouvrir l'écran. |

### Ce que la phase 7 livre malgré A-6

- ~~**Le calendrier se dessine entièrement coffre fermé.** Les occurrences sont calculées depuis la série, qui vit en clair : seules les **exceptions** des tâches liées à une branche sous coffre manquent.~~ **Faux, rectifié le 15 octobre 2026 — anomalie A-10.** `calendrier.astro` ne calcule aucune occurrence : il dessine des **événements** d'agenda, et rien d'autre. La phrase est vraie de **`taches.astro`**, seul écran qui importe `repetition.ts` : là, les occurrences sont bien calculées depuis la série, qui vit en clair, et seules les exceptions des tâches liées à une branche sous coffre manquent. Trois actions sur onze sont dans ce cas. C'est l'écart qui donne sa valeur à la décision 3 — si tout devenait illisible, le chiffrement par branche n'aurait servi à rien.
- **Ce qu'on ne peut pas lire est dit, jamais deviné.** Une occurrence dont l'exception est scellée ne s'affiche pas « à faire » : ce serait une affirmation fausse. `lisibiliteDeLOccurrence` rend `scellee`, qui veut dire « on ne peut pas savoir », et non « il n'y a rien ».
- **Les libellés ne portent aucun titre** (décision 6), et l'essai ne se contente pas de lire la constante : il refuse toute marque d'interpolation, parce qu'un gabarit finit par être rempli.

### Comment A-6 sera tranchée

Un artefact de décision contresignable lui est consacré, hors du dépôt : un
acte par page, les trois options avec leurs conséquences, ma recommandation,
et deux blocs de signature — Alexis décide, le Pilote donne un avis. Seule la
signature d'Alexis autorise à toucher au scellement ; un contreseing absent
ne bloque rien. C'est la forme retenue pour **tout** arbitrage à venir.

Quelle que soit l'issue, un seul point du code change : `gesteSousCoffre()`.

## Phase 8 — la Revue et les indicateurs

La décision d'Alexis sur A-3 (« compter l'occurrence seulement si la tâche
n'est pas liée ») est appliquée, et la façon dont elle l'est mérite d'être
dite, parce qu'elle déplace une protection sans l'affaiblir.

**Le filtre vit à la projection, pas dans la liste des types comptés.** Une
liste de types ne sait pas regarder la tâche d'origine — c'est ce qui rendait
l'option C la plus chère des trois. La projection, elle, a la tâche sous la
main : elle n'émet tout simplement pas `odyssee.occurrence` pour une tâche
liée. Le type peut donc entrer dans `TYPES_SERIE` sans réserve, parce qu'un
fait qui existe est, par construction, celui d'une tâche non liée.

**Le garde-fou de la phase 5 a donc changé de place**, et son essai le dit :
il n'affirme plus « ce type ne compte pas » mais « ce type compte, et c'est
l'absence de fait qui protège ». Un sabotage qui ferait émettre la projection
pour les tâches liées ramènerait le double comptage sans que la liste des
types bouge — c'est exactement ce que `essais:revue` surveille.

**Le prédicat est celui de la phase 6**, `laTacheCedeSonFait`, et c'est
voulu : une seule règle, énoncée une fois, appliquée aux deux sens. Une tâche
liée à une pesée ou à un pointage budgétaire ne cède rien et compte donc ici
aussi — sa branche n'écrit aucun fait compté.

**Ce que le coffre fermé empêche est dit.** La projection ne lit que le
magasin clair et ne réclame jamais le coffre. Les exceptions scellées non
lues sont rendues en manque chiffré, pas passées sous silence : coffre fermé,
une occurrence de pointage budgétaire ne compte pas, et on sait combien.

### Ce qui reste de la phase 8

Les **écrans** de la Revue ne sont pas touchés : ils liront ces faits comme
les autres, et leur contrôle automatisé n'existe toujours pas — c'est la
phase 9.

## A-6 — tranchée le 15 octobre : option D

Alexis a signé l'option D sur l'acte contresignable, après lecture de l'avis
du Pilote. **Le Pilote a refusé mes trois options et en a proposé une
quatrième**, que je n'avais pas vue, et il a eu raison sur un point que
j'avais manqué : mon option A n'était pas un repli neutre, c'était
l'abandon silencieux de la décision 5 du prompt, qui demandait un report
coffre fermé.

**Le principe.** Une paire de clés asymétrique : la publique en clair, la
privée scellée sous la clé du coffre. Écrire ne demande que la publique,
donc rien ; lire demande la privée, donc le coffre. Une boîte aux lettres —
la fente est ouverte, la porte ne s'ouvre qu'avec la clé.

**Ce que cela a coûté, règle par règle.** Le pli ne porte ni date
d'écriture (elle dirait qu'un geste a eu lieu ce jour-là), ni clé métier
(`tâche/jour` dirait tout avant déchiffrement), ni entrée au journal des
opérations (un pli qu'aucun autre appareil ne peut ouvrir n'a rien à faire
dans un paquet de synchronisation). Le magasin sort donc de la rétention par
date et de la convergence de fusion ; l'idempotence est retrouvée au rejeu,
l'exception écrite portant, elle, la clé déterministe.

**Ce qui reste visible, et qui est dit :** qu'un pli existe. Pas sa taille —
le contenu est rembourré à 256 octets.

**Les trois contrôles demandés par le Pilote** sont couverts : rien n'est
lisible sans la privée (cinq assertions qui décodent avant de chercher), la
privée n'existe en clair nulle part, et après un changement de mot de passe
un report est rejoué ou **signalé**, jamais perdu en silence —
`assurerLaBoite()` refuse de renouveler une paire périmée, et
`rejouerLesReports()` rend le nombre de plis illisibles sans les supprimer.

## Phase 9 — ce qui est enfin constaté, et ce qui ne l'est pas

### La fusion sur deux appareils

Le modèle l'affirmait depuis la phase 2 ; c'est maintenant éprouvé. Deux
appareils qui pointent la même occurrence hors ligne visent la **même cible**
de fusion, donc écrivent la même clé, donc une seule ligne. Un témoin le
montre à l'envers : deux clés tirées au sort font deux cibles pour un seul
geste — le moteur n'y peut rien, c'est la clé qui décide.

Et une exception vit hors de la tâche, donc « A déplace l'occurrence du 12 »
et « B change l'heure de la série » survivent toutes les deux. Dans la
tâche, la seconde écriture aurait effacé la première **sans conflit levé**.

### Le premier contrôle automatisé d'un écran de ce lot

Signalé manquant à chaque commit depuis la phase 1, il existe. Les huit
phases précédentes ont éprouvé des moteurs purs ; aucune n'avait ouvert la
page. **Un moteur juste derrière un écran qui ne l'appelle pas donne un site
faux dont tous les essais sont verts.**

Il vérifie ce qu'aucun essai pur ne peut dire : que les champs de série
existent dans la page, et surtout qu'ils **se découvrent selon le rythme
choisi** — « certains jours de la semaine » montre les sept cases, « tous
les N jours » montre le pas et range les cases, « jamais » ne montre ni
l'un ni l'autre. Le moteur sait qu'une règle hebdomadaire porte des jours ;
il ne sait pas si l'écran montre la case. Sabotage constaté rouge : une case
à cocher qui ne se découvre jamais rend la règle hebdomadaire inatteignable.

### Ce qui n'est PAS couvert — relu le 15 octobre 2026

La liste ci-dessous était **en dessous de la vérité**. Écrire le parcours
complet que je déclarais manquant a montré que le manque n'était pas un
trou dans les preuves mais un trou dans la livraison : trois phases de
moteur sans aucun appelant (A-9). Je laisse la liste d'origine telle
quelle en dessous, et j'ajoute ici ce qu'elle taisait.

- ~~**`essais:taches-parcours` est livré rouge**, sur quatre assertions~~ —
  **passé au vert le même jour**, une fois l'option A d'A-9 signée et
  `taches.astro` câblé. Huit assertions vertes, dont deux ajoutées sur ce que
  la carte **affiche** : écrire l'occurrence sans le dire laisserait « Faite »
  proposé une seconde fois sur une tâche déjà faite. Deux sabotages vérifiés
  rouges, le second reproduisant exactement le défaut d'origine.
- **Le calendrier et la Revue restent sans contrôle automatisé.** Je ne les
  ai pas ajoutés dans le même geste : corriger A-9 changera ce que ces
  écrans affichent, et un contrôle écrit avant la correction mesurerait un
  état transitoire.

### Ce qui n'est PAS couvert, et qu'il faut dire

- **Un seul écran sur les trois** du lot. `/odyssee/taches/` est contrôlé ;
  le calendrier et la Revue ne le sont pas.
- **Aucun parcours complet** : créer une tâche répétée, la pointer, vérifier
  l'occurrence écrite. Le contrôle s'arrête au formulaire.
- **Aucune capture.** Les écrans du lot n'ont rien à montrer tant qu'aucune
  donnée ne les traverse, et des captures d'écrans vides ne prouveraient
  rien — c'est la même raison qu'aux prompts 35 et 36.
- **Le coffre fermé n'est pas éprouvé à l'écran.** Les trois modules qui le
  gèrent le sont ; la page qui les appelle, non.

---

## Anomalies relevées en construisant — prompt 39, phase 5 (calendrier)

Règle d'audit §4.2 : une anomalie nouvelle devient une ligne de tableau, pas
un correctif silencieux. Les deux qui suivent ont été trouvées **en
branchant le calendrier**, c'est-à-dire par le geste même que le lot
demandait — et non par une relecture.

| N° | Constat | Suite |
|---|---|---|
| A-14 | **Le magasin scellé des exceptions était en écriture seule, et les écrans écrivaient en clair ce qu'il fallait sceller.** Deux moitiés, une seule cause : aucun écran ne choisissait le magasin. **(a)** `odysseeExceptionsScellees` n'était lu par personne — aucun appel à `exceptionsScellees()` hors de son propre fichier. Or `pointerDepuisLeCalendrier` y range l'exception de toute tâche liée à une branche sous coffre. Un dépointage sur une tâche sensible s'écrivait donc et ne se voyait **jamais** : l'écran continuait de déduire « faite » du fait de branche, que lui se lit. L'exception doit faire autorité ; elle ne le pouvait pas, faute d'être lue. **(b)** `taches.astro` écrivait dépointages et renoncements avec `ecrireOccurrence`, donc **en clair**, y compris pour une tâche scellée. Une ligne en clair « tâche X, le 14, dépointée » rend un rythme lisible sans la clé — ce que la décision 3 refuse, et ce que `magasinDeLException` existait pour empêcher. | **Corrigée** (`b181503`). `exceptionsDeLaFenetre()` lit les deux magasins et **ne lève pas** coffre fermé : un scellé illisible est l'état normal, pas une panne, et lever ici obligerait chaque écran à entourer sa lecture d'un `try` — qui finit par avaler autre chose. `ecrireLException()` et `retirerLePointage()` choisissent le magasin, une fois, pour les deux écrans. |
| A-15 | **Le moteur de la phase 5a cherchait le fait de branche au mauvais jour.** Il passait `jourPrevu` à `pointageDeLOccurrence`, pas le jour d'arrivée. Pour une occurrence déplacée du 20 septembre au 15 octobre, il cherchait donc une séance le 20 septembre, alors qu'elle a eu lieu le 15 : l'occurrence restait « à faire » le jour où elle avait justement été faite. | **Corrigée** (`b181503`). Mes seize assertions de la 5a ne le voyaient pas, et c'est la leçon : elles éprouvaient le **déplacement** et la **dérivation** séparément, jamais ensemble. Deux règles justes prises une à une peuvent se contredire à leur jointure, et c'est la jointure qu'il faut éprouver. Même famille qu'A-9, à plus petite échelle. **Essai de jointure ajouté le 15 octobre** : déplacement et dérivation ensemble, au même jour d'arrivée, cinq assertions. Remettre `jourPrevu` à la place du jour d'arrivée en fait échouer trois — le sabotage reproduit le défaut d'origine. |

### A-14 b — aucune version publiée n'a pu écrire ces lignes. **Vu sur `gh-pages`.**

Question posée : une version **publiée** a-t-elle pu écrire, dans la base
réelle, des lignes en clair pour une tâche scellée ? Si oui, il y aurait
des lignes à nettoyer sur l'appareil d'Alexis, et c'est un critère
d'arrêt. La réponse est **non**, et elle est constatée, pas déduite.

**Ce qui a été fait** : `git fetch origin gh-pages`, puis extraction de
l'arbre publié et recherche dans les paquets livrés. La branche publiée
est `e2584b7`, « Publication 2026-10-14 15:13 » — la date attendue.

**Le contrôle de la méthode d'abord**, parce qu'un zéro ne vaut que si
l'on sait qu'un non-zéro était possible. Les noms de magasins sont des
chaînes littérales passées à `db.transaction(…)` : la minification ne les
touche pas. Vérifié : `odysseeTaches` paraît dans 5 fichiers du bundle,
`odysseeEvenements` dans 5, `sportSeances` dans 5, `odysseeQuetes` et
`odysseeRevues` dans 4. Les noms survivent bien.

**Le relevé** :

| Magasin cherché dans le bundle publié | Fichiers |
|---|---|
| `odysseeOccurrences` | **0** |
| `odysseeExceptionsScellees` | **0** |
| `odysseeEtapesCochees` | **0** |
| `odysseeReports` | **0** |
| `depointee` | **0** |

Et le schéma publié lui-même (`_astro/db.*.js`) déclare 38 magasins
d'Odyssée, **dont aucun des quatre**. Les magasins n'existaient donc pas :
aucun appareil ayant exécuté la version publiée n'a pu y écrire une ligne,
ni en clair ni autrement.

**La datation le confirme indépendamment.** Les quatre modules en cause
sont nés le **15 octobre**, entre 11 h 05 et 12 h 04 UTC :
`donnees-occurrences.ts` (`0187745`, 11:05), `modification-serie.ts`
(`c8db077`, 11:28), `liaison-branches.ts` (`96e4b91`, 11:51),
`pointage-partage.ts` (`d72d19d`, 12:04). La publication date du
**14 octobre à 15 h 13**, soit près de vingt heures plus tôt.

**Conclusion** : A-14 b était un défaut réel du code sur `main`, corrigé
avant toute publication. **Rien à nettoyer, rien à annoncer à Alexis comme
risque sur ses données.** Le critère d'arrêt n'est pas déclenché. La règle
qui s'en dégage est simple et vaut pour la suite : *une anomalie de
confidentialité se date contre la dernière publication, pas contre
`main`.*

### A-8 — close le 15 octobre 2026

**Le calendrier montre les occurrences** (`aa94f32`) : une seconde liste
« Tâches prévues » sous les événements en vues jour et semaine, une ligne
compacte « n tâches » en vue mois, et un jour qui ne porte qu'une occurrence
n'est plus sauté. Pointer, défaire et renoncer y passent par les mêmes
fonctions que l'écran des tâches.

**Ce qui reste hors du lot, et c'est l'arbitrage rendu** : la récurrence des
**événements** d'agenda. Un événement n'est pas une tâche ; la répétition a
été conçue pour les tâches, et le calendrier montre désormais les deux.

### Le coût, mesuré plutôt que supposé

`npm run mesure:occurrences-mois`. Volume d'un an — 12 tâches répétées,
1 104 exceptions, 400 faits :

| Vue | Coût par affichage |
|---|---|
| jour | 9,7 ms |
| semaine (7 jours) | 9,8 ms |
| mois (30 jours) | 9,9 ms |
| mois, à cinq ans (5 520 exceptions) | 12,9 ms |

Le seuil fixé est de **50 ms**. Il n'est pas atteint, donc **aucun cache
n'est posé** : un cache ajouté sans mesure ajoute un second état à tenir
juste, donc un second endroit où se tromper. Le repli — un calcul mémorisé,
invalidé à l'écriture d'un fait — reste en réserve.

Les trois premiers chiffres sont presque égaux, et cela dit **où va le
temps** : non pas dans la fenêtre affichée, mais dans la fenêtre **élargie**
de 93 jours, déroulée à l'identique dans les trois cas, et dans le tri des
exceptions par tâche, qui parcourt tout le lot. Le facteur est donc le
volume d'exceptions, pas la vue — vérifié à cinq ans.

**Ce n'est pas `bench-storage`**, qui pèse le stockage et le temps de
chargement d'un écran. C'est la part de calcul que la phase 5 ajoute, et
rien d'autre.

### Ce qui n'est toujours PAS couvert, après la phase 5

- **La portée sur une occurrence du calendrier n'a pas d'essai de
  navigateur.** Le plan qu'elle applique (`planifierAbandon`) est éprouvé en
  module ; le formulaire qui le monte ne l'est que par lecture.
- **Aucune capture** des écrans du lot. Phase 6.
- **`npm run verifier` (astro check) n'est pas vert sur `main`** : neuf
  erreurs, toutes antérieures à ce lot et hors de lui (`Base.astro`,
  `glossaire.astro`, `molecule.astro`). Dix avant la phase 5, neuf après —
  une refermée au passage, aucune ajoutée. **Ce contrôle ne garde rien
  aujourd'hui**, et il faut le savoir avant de s'y fier.

---

## Prompt 39, phase 6 — la Revue, le tableau de bord, et reprendre une série

Chaque affirmation est marquée **[vu]** — constaté à l'écran, dans un
navigateur — ou **[lu]** — établi par lecture du code. Rien n'est supposé.

### Une porte unique pour trois écrans

**[lu]** `occurrences-lues.ts` enchaîne les trois lectures — les tâches, les
exceptions des **deux** magasins, les faits — puis appelle le moteur. Le
calendrier, le tableau de bord et la Revue passent par elle.

La raison est celle d'A-14, et elle est récente : *une règle tenue à
plusieurs endroits finit par n'être tenue qu'à certains*. Trois copies de cet
enchaînement, et la troisième aurait oublié d'élargir la fenêtre, ou de lire
le magasin scellé.

**[lu]** Deux économies, dites plutôt que tues. `etatDuJour` projette déjà
tous les faits pour la roue et lit déjà les tâches ; il les **passe** au lieu
de les faire relire. Aucune seconde projection par peinture du tableau de
bord.

**[lu]** Ce qui n'est jamais économisé : la fenêtre élargie et les deux
magasins. Et les branches illisibles sont **rendues**, jamais avalées — un
`catch` muet ferait passer « je n'ai pas pu lire » pour « il n'y a rien ».

### Le tableau de bord — option B, et c'est une absence qu'il faut prouver

**[vu]** Un bloc « Tâches prévues », un compte (« 1 faite sur 2 »), une ligne
par occurrence avec son état. **Aucun bouton.**

**[vu]** L'essai compte les boutons du bloc et exige **zéro**. C'est le genre
d'exigence qu'aucun essai de module ne sait porter : rien, dans un moteur,
n'empêche un écran d'ajouter un bouton.

Pourquoi cette absence : un « Faite » ici signifierait la même chose en
apparence et **moins en vérité** — sans la portée, sans l'avertissement tiré
du plan, sans le report coffre fermé. Un lien mène à l'écran qui, lui, pointe.

**[lu]** Les occurrences illisibles sont comptées **à part**, jamais parmi
les manques : coffre fermé, on ne sait pas si elles ont été faites, et les
ranger du côté des échecs transformerait le chiffrement en reproche.

### La Revue — elle compte, et ne repose pas ce qui est fait

**[vu]** Une ligne « Tâches répétées : n faite(s) sur m », puis la liste de ce
qui reste **dû**. Une fois pointée, l'occurrence quitte cette liste et rejoint
« Déjà fait ».

**[lu]** La Revue calcule sur **le jour visé**, pas sur aujourd'hui. Le matin,
elle porte sur la veille ; reprendre `etat.occurrences` telle quelle aurait
montré les tâches du jour sous un titre disant « hier » — le « aujourd'hui
faux » de l'interdit V1, déplacé d'un cran.

**[lu]** Les occurrences faites **depuis leur branche** ne sont pas ajoutées à
« Déjà fait » : leur fait y figure déjà sous son propre libellé, et la ligne
serait un doublon.

### « Reprendre la série » — la règle du pilote, et pourquoi l'ancre bouge

**[vu]** Sur une tâche répétée close, le bouton se nomme « Reprendre la
série » et une ligne le précède : « La série repart le *jour*. Ce qui était
prévu pendant la pause n'est ni dû ni en retard. »

**[lu]** `planifierReprise` pose `serie.depuis` au **prochain jour que la
règle d'origine produit à partir d'aujourd'hui**, et non à aujourd'hui.

La distinction n'est pas cosmétique : `depuis` est l'**ancre** de la règle —
c'est lui qui porte le quantième d'une mensuelle. Y poser aujourd'hui ferait
d'une tâche du 3 de chaque mois une tâche du 16. **[vu]** L'essai le vérifie
sur une mensuelle du 3 : elle repart un 3 de novembre.

**[lu]** Une série dont la règle ne prévoit plus aucun jour n'est pas
rallongée d'autorité : le bouton se tait et dit pourquoi.

**[lu]** La phrase affichée vient du **plan**, pas de l'écran. Un libellé
écrit à la main finirait par promettre autre chose que ce que le code fait.

### Les captures

**[vu]** Dix captures dans `audit/captures/prompt-39/`, en 390 × 844 et
1280 × 800, sur données synthétiques semées **par les écrans eux-mêmes** —
jamais par une écriture détournée en base. Une capture d'un état que
l'application ne sait pas produire ne prouverait rien.

**[vu]** Aucun débordement horizontal à 390 px sur les quatre écrans :
`scrollWidth` vaut 390 partout. Vérifié par mesure après qu'une capture m'eut
fait croire le contraire — le bouton du calendrier est pleine largeur, pas
rogné.

### Les contrôles, et ce que les sabotages ont appris

**[vu]** `essais:phase6-ecrans`, neuf : 21 assertions vertes.

Trois sabotages, et le troisième a enseigné deux fois :

| Sabotage | Résultat |
|---|---|
| un bouton « Faite » sur le tableau de bord | rouge, 1 assertion |
| la Revue cesse de filtrer ce qui est fait | rouge, 1 assertion |
| la reprise ne replanifie plus la série | rouge, 3 assertions |

**Le troisième s'est d'abord effondré** sur un délai de trente secondes au
lieu de nommer la ligne fautive : l'assertion lisait un texte sans vérifier
que l'élément existait. Corrigée — on compte, **puis** on lit. *Un contrôle
qui s'effondre renseigne moins qu'un contrôle qui accuse.*

**Un trou dans mes propres essais, trouvé par sabotage.** Sur
`planifierReprise`, remplacer `depuis: prochaine` par `depuis: aujourdhui` ne
faisait **rougir aucune assertion**. Je vérifiais `prochaine` sur le cas
mensuel et `depuis` sur le cas quotidien — où les deux valeurs se confondent.
La mensuelle se serait déplacée du 3 au 16 sans que rien ne le dise.
Assertion ajoutée ; le sabotage rougit désormais.

C'est la deuxième fois dans ce lot, et c'est la même règle : **deux
propriétés éprouvées séparément ne prouvent pas leur rencontre.** A-15 en
venait déjà.

**[vu]** Les trois suites de navigateur antérieures restent vertes après ce
lot. **[vu]** Onze suites de module vertes. **[vu]** Construction sortie 0,
`.env.local` absent après chacune (`ls` sortie 2).

### Ce qui n'est toujours PAS couvert

- **La portée sur une occurrence du calendrier** n'a pas d'essai de
  navigateur. Le plan qu'elle applique est éprouvé en module ; le formulaire
  qui le monte ne l'est que par lecture. Annoncé en phase 5, toujours vrai.
- **Le coffre fermé n'est pas éprouvé à l'écran** sur ces trois écrans. Les
  modules qui le gèrent le sont ; les pages qui les appellent, non. Il
  faudrait une tâche liée à une branche scellée et un coffre refermé en
  cours de parcours.
- **`npm run verifier` reste rouge** : neuf erreurs, toutes antérieures à ce
  lot et hors de lui. Inscrit au lot « reliquats 30 et 31 », à refermer
  **avant** les molécules puisque `molecule.astro` en porte une.

---

## A-16 — aucune tâche liée ne pouvait exister

Trouvée en écrivant le contrôle que le prompt 39 demandait pour C2, et que
je n'avais pas écrit : « on fait l'action dans la branche, puis on constate
la tâche cochée à l'écran ».

**[lu]** Le constat, vérifiable en deux recherches : **quatorze** endroits
lisent `tache.lien`. **Zéro** l'écrit. `TacheNeuve` ne portait pas le champ,
`ajouterTache` ne le transmettait pas, et le formulaire n'offrait aucun
choix.

Conséquence : **aucune tâche liée ne pouvait exister dans l'application.**
Tout le mécanisme branche ↔ tâche — le registre `liaison-branches.ts`, les
écrivains de `pointage-partage.ts`, la dérivation de la phase 2, les trois
écrans branchés en phases 5 et 6 — était hors d'atteinte d'un utilisateur.

C'est **la même forme qu'A-9** : des moteurs branchés les uns aux autres, et
aucune porte d'entrée. Et c'est le même révélateur : le contrôle que je
déclarais manquant.

La leçon est plus dure que la précédente. Après A-9, j'ai ajouté
`essais:orphelins`, qui trouve un module qu'aucun écran n'importe. Il ne
trouve **pas** ce cas-ci : `liaison-branches.ts` est bel et bien importé par
`taches.astro`. Le module était atteint ; c'est la **donnée** qu'il lit qui
ne pouvait pas naître. *Un contrôle d'atteignabilité des modules ne dit rien
de l'atteignabilité des états.*

### Corrigé

**[lu]** `TacheNeuve.lien`, transmis par `ajouterTache`. **[vu]** Un champ
« Relier à » dans le formulaire, vide par défaut, dont les options viennent
**du registre** et non d'une liste écrite à la main — deux sources auraient
divergé au premier ajout. Les actions « hors-du-lot » ne sont pas proposées :
elles ne produisent ni écriture ni cochage.

### C2 — le contrôle de bout en bout, enfin

**[vu]** `essais:branche-vers-tache`, 22 assertions. Le parcours entier, par
les écrans : créer une tâche répétée liée à une séance de sport, aller dans
la branche Sport, ouvrir puis clore une séance, revenir aux tâches.

Ce qui est constaté, et qui est le cœur de la dérivation :

- **aucune occurrence n'est écrite** — rien ne s'écrit, tout se relit ;
- l'écran ne propose plus de pointer, mais de **défaire** ;
- le bouton se nomme « Ce n'était pas ça », pas « Pas finalement », parce
  que la source est la branche et non une exception ;
- une ligne dit que « la séance reste comptée » ;
- **[vu]** le tableau de bord affiche « faite depuis sa branche » et le
  calendrier propose de défaire. Les trois écrans disent la même chose.

**[vu]** Sabotage : retirer `lien` de `ajouterTache` — exactement l'état
d'avant A-16 — fait rougir trois assertions.

**[vu]** Deux de mes assertions étaient fausses à la première écriture : je
devinais le nom du champ de clôture d'une séance (`finLe`, `closeLe`) au
lieu de lire le modèle, qui dit `fin` et `statut: 'terminee'`. Corrigé dans
l'essai, pas dans le code. Troisième fois dans ce lot qu'une assertion
accuse à tort : **une prémisse d'essai se lit, elle ne se devine pas.**

---

## A-13 — le consentement a sa porte, et son écran

**[lu]** Le constat de départ : depuis le 12 octobre, `observerUsage()`
observait l'usage sans qu'aucun écran ait jamais demandé l'autorisation,
pendant que `consentement.ts` portait un texte promettant « vous n'avez
jamais à l'autoriser ». La promesse de **confidentialité** tenait — rien
ne quitte l'appareil. C'est la promesse de **consentement** qui ne tenait
pas.

### La porte est dans la fonction qui lit

**[lu]** La garde est dans `observerUsage()`, pas chez ses appelants. Une
garde chez les appelants laisse passer l'appelant suivant — et c'est
exactement ainsi que cette anomalie est née, d'une fonction branchée sans
qu'on se demande ce qu'elle lisait. Le `return` précède toute lecture :
sans consentement, `publierFaitsRevisions` n'est même pas importé.

### La révocation l'emporte

**[lu]** Cyclades fusionne par journal répliqué, dernier écrivain gagne.
Appliquée à un consentement, cette règle produit la panne qu'il ne faut
pas : on révoque sur un appareil, un autre resté hors ligne réécrit
l'accord plus tard, et le consentement revient tout seul.

La règle retenue : **un accord ne lève une révocation que s'il la nomme.**
Un appareil qui n'a jamais vu la révocation ne peut pas la nommer.
**[vu]** L'écran, lui, la nomme : une réautorisation après révocation
porte bien son `remplace`.

### L'écran, et ce qu'il dit de lui-même

**[vu]** Le défaut est le refus : « Jamais autorisé », et aucun bouton de
révocation puisqu'il n'y a rien à révoquer. **[vu]** Les trois paragraphes
sont **cités**, et la phrase qui engage y figure mot pour mot.

**[vu]** L'adaptation ne déguise plus l'absence de permission : elle dit
« rien n'est observé, donc aucun écart ne peut être trouvé », et non
« aucun écart ». La distinction est tout le sujet — un constat et une
permission manquante ne se ressemblent qu'à l'écran.

**[vu]** Ce qui n'existe pas est écrit **à l'écran**, pas seulement en
commentaire : les interrupteurs par domaine et par source, le journal
d'accès, le rappel périodique. Et le fait que le choix d'effacer à la
révocation est sans objet, les observations étant recalculées à chaque
lecture et jamais stockées.

### Les contrôles

**[vu]** `essais:consentement-etat`, 18 assertions sur la règle
d'absorption, dont le cas hors ligne **dans les deux ordres d'arrivée**.
**[vu]** `essais:consentement-porte`, 10 assertions structurelles :
`observer()` et `deduire()` ne sont joignables que par la porte, la garde
précède la publication, un retour les sépare. **[vu]**
`essais:consentement-ecran`, 20 assertions de bout en bout.

Cinq sabotages rouges : « dernier écrivain gagne » rétabli (3 échecs),
une seule révocation retenue (3), la garde déplacée après la publication
(2), un second observateur ailleurs (1), le silence qui redevient
« aucun écart » (1).

**[vu]** `essais:orphelins` a de nouveau fait son travail : il a refusé le
commit tant que l'exception d'A-13 restait, `consentement.ts` étant
désormais atteint depuis un écran.

### Ce qui reste de A-13

- **les interrupteurs par domaine et par source** ne sont pas construits,
  et la note datée le dit. Une seule branche est observée ; l'interrupteur
  maître la couvre entièrement ;
- **le journal d'accès** n'existe pas ;
- **le rappel périodique** n'existe pas.

Ces trois lignes restent dans le code et à l'écran tant qu'elles sont
vraies.

---

## Reliquats des prompts 35 et 36 — relevé du 16 octobre 2026

Comparaison exigence par exigence. **[vu]** = constaté à l'écran ou par
exécution. **[lu]** = établi par lecture du code.

### Prompt 35 — coffre ouvert pour la session, données du coffre dans l'analyse

| Exigence | État |
|---|---|
| **P1** — case « Garder le coffre ouvert », témoin dans l'en-tête, « Fermer le coffre » partout | **[lu] tenu.** `TemoinCoffre.astro` porte le témoin, son libellé et le bouton. |
| **P1 bis** — case « Mémoriser sur cet appareil », décochée par défaut | **[lu] tenu.** `FormulaireCoffre.astro`. |
| **P1 bis** — clé d'encapsulation **non extractible** dans IndexedDB | **[lu] tenu.** `coffre-cles.ts` : `extractable: false`, et le commentaire dit pourquoi. |
| **P1 bis** — « Oublier le coffre sur cet appareil » | **[lu] tenu.** `oublierLAppareil()` est branché sur un bouton du témoin. *Je l'avais d'abord noté absent : ma recherche portait sur le libellé du prompt, pas sur celui du code. Un relevé qui cherche la formule et non la fonction conclut trop vite.* |
| **P1 bis** — le témoin distingue « session » et « mémorisé sur cet appareil » | **[lu] tenu.** Les deux libellés sont dans `TemoinCoffre.astro`. |
| **P2** — Psyché et Finances dans l'analyse, manque nommé coffre fermé | **[lu] tenu.** `faits-branches.ts`, `publierPsycheOuLeDire` et `publierFinancesOuLeDire`. |
| **P2** — **médicaments et statut hormonal** dans l'analyse | **[lu] MANQUE.** `SourceDeFaits` compte six sources ; ni les médicaments ni le statut hormonal n'en font partie, et **aucun publieur n'existe** pour eux (`faits-*.ts` : revisions, odyssee, corps, finances, psyche). La décision 3 les demandait, « seulement dans les indicateurs et les règles de désaccord, sans synthèse rédigée qui les nomme hors coffre ». |

### Prompt 36 — la revue devient le check-up

| Exigence | État |
|---|---|
| **V1** — préférence matin / soir | **[lu] tenu.** `moment-revue.ts`, lu par la Revue et par les règles du jour. |
| **V1** — libellés « hier » ou « aujourd'hui », jamais un « aujourd'hui » faux | **[lu] tenu.** `libelles(moment)`. |
| **V1** — le nom est **« Revue » partout** | **Corrigé ce jour.** Le `<h1>` disait « Revue », mais le titre de page disait encore « Revue du soir » — donc l'onglet du navigateur et l'en-tête. La décision 1 était *tranchée* ; c'était un reliquat d'un seul mot, à l'endroit exact que le prompt nommait. |
| **V2** — ce qui est déjà servi n'est pas redemandé | **[vu] tenu**, et étendu aux occurrences en phase 6. |
| **V3** — la revue manquée est rappelée le lendemain | **[lu] tenu.** `rappelDesRevues`, règle `revue-manquee`. |
| **V4** — la revue sur l'accueil quand elle est due | **[lu] tenu.** `#revue-due` sur `index.astro`. |
| **V4 / décision 2** — **pastille sur l'onglet Odyssée** | **[vu] tenu — livré le 16 octobre 2026.** `#pastille-revue`, dans le lien de la branche Odyssée et sur elle seule. Un point, pas un nombre : il n'y a qu'une revue par jour, et un compteur qui ne compte qu'à un n'apprend rien ; le libellé accessible dit la chose en toutes lettres. Le verdict vient de `revueASignaler`, qui **reprend** les deux règles de l'accueil — fenêtre de la revue due, rappel des manquées — au lieu d'en écrire de secondes. Éprouvé dans les deux états par `essais:pastille:navigateur`, et les deux sabotages accusent. |

### Ce que je retiens de ce relevé

Deux manques réels, et ils ne se ressemblent pas.

**Les médicaments et le statut hormonal** touchent le coffre et une
décision signée : je ne les branche pas dans ce lot sans accord, parce
qu'ajouter une source scellée à l'analyse globale fait entrer des données
de santé dans des calculs qui en étaient exempts. C'est exactement le
genre de ligne que la règle §4.2 veut voir s'arrêter et demander.

**La pastille** est une finition d'interface, sans effet sur les données.
Elle entre au prochain lot d'interface.

Et une leçon de méthode : j'ai d'abord noté « Oublier le coffre » absent
parce que je cherchais **le libellé du prompt** au lieu de **la fonction
du code**. Un relevé qui cherche la formule et non la chose conclut trop
vite — dans les deux sens.
