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
