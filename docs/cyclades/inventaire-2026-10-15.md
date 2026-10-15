# Inventaire de ce qui reste — 15 octobre 2026, 21 h

Dressé à la demande d'Alexis, sur **mes archives et le dépôt**, pas sur une
liste reçue. Chaque ligne porte **vu** (constaté à l'écran ou en base) ou
**lu** (établi en lisant le code, l'historique ou un document).

## 0. Un avertissement sur la numérotation

**Mes archives ne portent pas les numéros 30 à 40.** Elles sont nommées par
sujet. Je peux rattacher quatre numéros avec certitude — 32 le centre de
notifications, 38 les tâches récurrentes, 39 le branchement, 40
l'optimisation — parce que les messages du pilote les nomment ainsi. Pour
les autres, **je ne sais pas** quel numéro recouvre quel sujet, et je ne
l'invente pas. L'inventaire est donc par sujet. [lu]

Archives présentes dans `audit/prompts/` : prompt 30 partie 1, animations
(plus son rectificatif et son audit), centre de notifications, finitions
d'interface, profil âge-sexe-cycle, tâches récurrentes, branchement v1 et
v2. Neuf fichiers. [vu]

## 1. Les chiffres mesurés aujourd'hui

| Quoi | Compté | Comment |
|---|---|---|
| Textes de podcast écrits | **425** | [vu] `find content -name '*podcast*'` |
| Fiches avec voix produite | **250** | [vu] `.enc` audio dans `dist` |
| **Fiches sans voix** | **175** | [vu] la différence |
| Pages du site | **53** | [vu] |
| Modules de `src/lib` | **186** | [vu] |
| Scripts d'essai | **167** | [vu] |
| Scripts npm | **196** | [vu] |
| PDF officiels dans `sources/` | **49** | [vu] |
| Orphelins non branchés | **5**, tous déclarés | [vu] `essais:orphelins` |

## 2. Lot par lot

### Prompt 39 — le branchement des écrans. **En cours, 3 phases sur 6.**

Livré : l'essai des orphelins, la dérivation branche → tâche, la
suppression de `retour-de-branche`, et les quatre précisions du pilote.
Commits `7dc1b4f`, `76e3333`, `a35d33d`, `f68f766`, `a2bcef5`. [vu pour le
parcours de bout en bout ; lu pour le reste]

Reste : l'extraction du formulaire de série, le calendrier (occurrences
affichées, pointables, portée, bouton de programmation), la Revue et les
tâches du jour, le tableau de bord, « Reprendre la série », les captures et
le compte rendu. [lu]

### A-13 — le consentement. **Non commencé, résolution arrêtée.**

Constat : l'observation d'usage tourne depuis le 12 octobre (`b23e506`,
`3d930ff`) sans qu'aucun consentement soit demandé ni lu. Elle ne lit que
la branche Révisions, et **rien ne sort de l'appareil**. [lu]

Résolution arrêtée avec le pilote : un champ de profil faux par défaut, la
garde dans `observerUsage()` lui-même, l'écran qui cite les trois
paragraphes **plus une note datée disant ce qui n'existe pas encore**, et la
révocation qui l'emporte sur un accord venu d'un appareil hors ligne. [lu]

### A-12 — `noyau/permissions.ts`. **Reporté au prompt 40**, verdict « à trancher ».

### Prompt 32 — le centre de notifications. **Phases 1 à 3 sur 7.**

Livré : le filtre de sensibilité du cycle, le magasin et le modèle, le
recalcul depuis la source, et N-1 close (le genre en clair). [lu]

Reste : le compteur et le panneau, les douze résolveurs de source, les
notifications système, le remplacement du bloc du tableau de bord, les
essais de bout en bout. [lu]

### Les 175 fiches sans voix. **Non commencé.**

C'est le plus gros écart entre ce qui est écrit et ce qui est utilisable.
La chaîne est locale et gratuite ; elle demande un `npm run build` **sans**
`REVINSP_SANS_PODCAST=1`, c'est-à-dire plusieurs heures. [lu]

### Publication des fascicules 3, 4 et 5. **Non commencé** — tâches #62 et #90.

La publication reste à Alexis.

### Les molécules. **Débloqué ce soir.**

La liste prioritaire est arrivée : esters de testostérone et formes non
estérifiées, nootropes, et le lot de douze. Les fiches et les doses
étudiées, puis la bibliographie NooTopics sous l'autorisation écrite. [lu]

### Prompt 40 — l'optimisation. **En dernier**, après tout le reste.

## 3. Les pièces de `sources/`, exploitées ou non

| Fonds | État | Marque |
|---|---|---|
| `sources/officiels/` — 49 PDF, relevé `RELEVE.md` | **exploités en partie** : les arrêtés DGFiP et l'organigramme ont servi aux QCM | [lu] |
| `sources/collecte-pilote-2026-10-14` — 362 empreintes | **non exploitée** pour les molécules, qui n'étaient pas débloquées | [lu] |
| `sources/fascicules` | exploités — les fiches de cours en viennent | [lu] |
| `sources/annales-dgfip` | exploitées — la banque de QCM en vient | [lu] |

F5 (Bhasin 2018, 88 p.) sert directement aux esters et aux formes de
testostérone : c'est la première pièce à ouvrir quand les molécules
viendront. [lu]

## 4. Ce que je ne sais pas, et que je ne devine pas

- **Quel numéro recouvre quel sujet**, hors des quatre certains.
- **L'état réel des reliquats des prompts 35 et 36** que le pilote me
  signale — captures manquantes, pastille sur l'onglet Odyssée,
  `essais:instantane` rouge. Je les vérifierai avant de les traiter plutôt
  que de les tenir pour acquis : c'est la faute que j'ai commise trois fois
  aujourd'hui, conclure d'une liste au lieu d'ouvrir le fichier.
