# Plan Cyclades — version consolidée des trois prompts

Ce document remplace `docs/plan-cyclades.md`, qui ne connaissait que les deux premiers prompts.

**Rien n'est codé avant ta validation de ce plan et des décisions de `decisions-phase-0.md`** —
c'est la consigne explicite du troisième prompt, et elle vaut pour l'ensemble.

## 1. Comment les trois prompts s'articulent

Trois prompts se recouvrent partiellement. L'ordre de préséance, tel que tu l'as posé :

| Prompt | Portée | Préséance |
|---|---|---|
| **P1** « parcours, QCM, prétest » | Renommage Cyclades, parcours multiples, QCM à jour, prompt IA par couches, prétest réécrit | le plus ancien |
| **P2** « stockage, sauvegarde, branches » | Mesure, stockage compressé, format `.cyclades`, registre de branches | **prévaut sur P1 en matière de stockage** |
| **P3** « Odyssée, Sport, parité » | Socle de faits, Odyssée comme application centrale, Sport, parité des parcours | **prévaut sur les deux** |

Ce que P3 change concrètement aux deux autres :

- il **lève** l'instruction « ne construis pas Sport ni Vie quotidienne » ;
- il **renomme** « Vie quotidienne » en **Odyssée**, qui devient la **page d'accueil** de Cyclades —
  Révisions n'est plus l'entrée du site mais une branche parmi trois ;
- il **absorbe** la phase 8 de l'ancien plan (« fondations des branches futures ») : les branches ne
  sont plus une fondation à prouver sur une fausse branche de test, elles sont deux branches réelles ;
- il **ajoute** un contrat de faits typés, une matrice de permissions inter-branches, un jour logique
  à 4 h et un moteur d'activité unique — qui n'existaient dans aucun des deux premiers.

Ce que P3 **ne** change pas, et qui reste donc à faire tel que P1 le décrit : la temporalité du QCM
DGFiP, la réécriture du prétest, la suppression du bouton « Ouvrir dans Claude ».

## 2. Ce que l'audit de parité impose au plan

`audit-parite.md` a déplacé une pièce du plan, et il faut le dire avant la liste des phases :

**`src/lib/rotation.ts` est le vrai pivot.** Les sept matières de l'INSP y sont une constante du
code, et elles servent de thèmes à la rotation hebdomadaire — donc à la planification, donc aux
séances, donc aux rappels. Un parcours DGFiP sans thème n'a aucune planification. Le registre de
parcours doit par conséquent **déclarer les thèmes**, et `rotation.ts` devenir un lecteur du
registre. Ce n'est pas « ajouter un fichier de configuration ».

**Un défaut est déjà en production.** `src/features/assistant/prompt.ts:112` affirme « Tu m'aides à
préparer le concours externe de l'INSP » pour **toute** question, QCM DGFiP compris. Et le parcours
par défaut est le concours **interne**. Deux erreurs dans une phrase, visibles aujourd'hui. Elles
sont corrigées en phase 1, pas en phase 6.

## 3. Les phases

Dix phases, chacune livrable et testée, avec ta validation entre deux. L'ordre suit la section F de
P3, avec le stockage et la sauvegarde remontés **devant** Odyssée et Sport — c'est la seule
divergence, elle est motivée au § 4, et je te la soumets comme la sixième décision.

### Phase 0 — Documents (celle-ci)

**Fait** : `audit-parite.md`, `decisions-phase-0.md`, `indicateurs.md`, ce plan.
**Attend** : tes réponses aux six décisions.

### Phase 1 — Cyclades, registre de parcours, et les trois corrections de vérité

Le renommage et le registre sont indissociables : nommer le produit « Cyclades » sans que
« Révisions » soit une branche parmi d'autres ne fait que changer un titre.

- Renommage : « Cyclades », Révisions devient une branche (« Cyclades · Révisions »), navigation à
  deux niveaux. Les clés `localStorage` **restent** `revinsp.*` — les renommer casserait l'état des
  installations existantes pour un gain nul ; une table de correspondance documente l'écart.
- Registre de parcours : `src/lib/parcours/registre.ts`, déclarant pour chaque parcours son
  identifiant, son intitulé, son concours, ses matières **et ses thèmes de rotation**.
- `rotation.ts` lit le registre au lieu de porter `THEMES`.
- Quatre parcours : INSP (le contenu actuel), DGFiP B, DGFiP A, **DGFiP A+ — inspecteur principal
  des finances publiques** (intitulé que tu as validé), les trois derniers vides mais navigables.
- `lien_cours` des actualités devient un dictionnaire par parcours, avec repli sur la valeur unique
  existante.
- **Les trois corrections** : l'ouverture du prompt IA prend le concours du parcours courant ;
  « externe » devient « interne » pour le parcours par défaut ; le préréglage « approfondir » cesse
  de nommer l'INSP.

**Tests** : un parcours vide s'ouvre sans erreur sur chaque page ; la rotation produit des thèmes
pour un parcours déclaré ; le prompt engendré nomme le concours du parcours ; aucune clé
`localStorage` orpheline.

### Phase 2 — Mesurer, puis stocker et sauvegarder (P2)

P2 est explicite : **mesurer avant de décider**. Rien de la compression n'est écrit avant que le
générateur ait produit cinq ans de données.

- Générateur de données synthétiques sur cinq ans, étendu dès maintenant aux faits de Sport et
  d'Odyssée (séries, repas, check-ins, opérations) pour ne pas avoir à le refaire en phase 5.
- `npm run bench-storage` : taille par magasin, temps de chargement, temps d'agrégation.
- Stockage segmenté compressé (`CompressionStream`, Web Worker, fenêtre de 90 jours non compressée,
  index léger). Les magasins que P3 interdit d'agréger (séries, opérations, mesures, médicaments,
  check-ins, journal) sont **compressés sans jamais être résumés**.
- Format `.cyclades` : compression **puis** chiffrement, PBKDF2 + AES-GCM, même mot de passe que le
  site ; **un ancien mot de passe doit encore ouvrir une ancienne sauvegarde** (le sel et les
  paramètres voyagent dans l'enveloppe).
- Export CSV/JSON lisible par domaine, effacement ciblé (branche, domaine, période) avec sauvegarde
  proposée avant.
- `tr.recul-sauvegarde` sur la page d'accueil.

**Tests** : aller-retour compression sur le jeu de cinq ans ; restauration d'une sauvegarde chiffrée
avec un mot de passe antérieur ; effacement ciblé qui n'emporte rien d'autre ; mesures avant/après
publiées dans le document de phase.

### Phase 3 — Le socle partagé (P3, partie B)

- **Contrat de faits typés** : un fait porte son type, sa date, sa branche émettrice, son
  propriétaire, sa provenance (automatique / manuelle / importée) et sa fiabilité.
- **Propriétaires uniques** : le statut hormonal et le poids appartiennent à Odyssée ; les séries et
  les records à Sport ; la rétention et le niveau estimé à Révisions. Un fait n'a qu'un propriétaire.
- **Matrice de lecture inter-branches**, configurable, refusant par défaut tout ce que E.5 protège.
- **Aucune écrasure silencieuse** : un désaccord entre deux branches ouvre une **notification de
  correction** (quatre issues, journal d'audit), et un conflit non tranché **dégrade la fiabilité**
  des indicateurs concernés — câblé dans le catalogue, pas dans le moteur de tendances.
- **Jour logique à 4 h**, réglable, appliqué partout où un « jour » est compté.
- **Moteur d'activité unique** : XP, niveau et série calculés **une seule fois**, dans Odyssée, à
  partir des faits. Journal d'XP explicable (quelle règle, quel fait, quel multiplicateur).
- Migration de l'XP et de la série existants, selon ta réponse à la décision 2.
- Enregistrement des branches Sport et Odyssée dans le registre.

**Tests** : chaque règle de conflit détectée sur un cas construit ; la fiabilité baisse bien quand un
conflit reste ouvert ; l'XP recalculé sur l'historique existant est identique à l'XP affiché
aujourd'hui (ou l'écart est documenté et voulu) ; le jour logique à 4 h ne décale aucune série
existante d'un jour.

### Phase 4 — Odyssée, socle (P3, C.2 à C.4)

Tableau de bord et page d'accueil : roue d'équilibre sur 7 jours contre la cible, cartes de domaine,
« Aujourd'hui », « Que faire maintenant ? » (règles locales, chaque suggestion avec sa raison,
**aucune IA**), derniers gains, focus Pomodoro, couverture de mesure, notifications de correction.
Calendrier (jour/semaine/mois, import et export ICS, aucune synchronisation cloud), tâches, quêtes,
plancher du jour, revue du soir. Cognition et Connaissances servies automatiquement par Révisions.

**Exigence tirée du catalogue d'indicateurs** : au premier lancement, la couverture de mesure sera de
27 % et la roue presque vide. L'écran doit **dire qu'il est vide** au lieu d'afficher un déséquilibre
de vie.

**Tests** : aller-retour ICS ; détection de chevauchement et de surcharge ; chaque suggestion de
« Que faire maintenant ? » porte sa règle ; un domaine mis en pause ne casse pas la série ; le coût
en temps de saisie est affiché (E.6).

### Phase 5 — Sport (P3, partie D)

Bibliothèque d'exercices (nature, latéralité, équipement, muscles, unité de charge, **identité de
comparaison** incluant variante et équipement) ; schéma du corps en SVG **dessiné nativement**, vues
avant et arrière, trois états par clic, **avec l'alternative en cases à cocher obligatoire** ;
séances types et programmes ; volume par muscle (coefficient secondaire 0,5 réglable, **stocké avec
chaque calcul**) ; séance en direct (saisie série par série, minuteur de récupération réelle, Wake
Lock, **sauvegarde à chaque série**, hors réseau) ; suivi de la force (Epley et Brzycki, imprécision
signalée au-delà de dix répétitions, bandes de contexte datées, filtre « périodes comparables »,
détection de plateau) ; propositions de modulation selon ta réponse à la décision 5.

**Tests** : séance interrompue et reprise sans perte ; charge max estimée vérifiée à la main sur des
cas connus ; aucune proposition de progression en présence d'une douleur déclarée ; schéma du corps
utilisable **au clavier et au lecteur d'écran seuls**.

### Phase 6 — Odyssée Corps, et les conflits Sport ↔ Odyssée (P3, C.5 et B.4)

Mesures, sommeil, nutrition, médicaments (**enregistrement seul**, E.1), statut hormonal et
substances (propriété d'Odyssée, lus par Sport), santé générale alimentant Sport. Les règles de
conflit réelles entre les deux branches.

### Phase 7 — Psyché (P3, C.6 et E.2)

Check-in quotidien de moins de 30 s, check-in hebdomadaire, journal, moyens de relance (ICS avec
alarme, faute de serveur). **Les échelles WHO-5, PHQ-9 et GAD-7 ne sont intégrées qu'après
vérification de leur licence et d'une traduction française validée** — sans quoi elles ne le sont
pas. Les indicateurs d'état ne s'affichent qu'en écart à une ligne de base de trente jours minimum.
Garde-fous E.2, dont la ligne 3114.

### Phase 8 — Finances (P3, C.7)

Comptes (**jamais d'IBAN ni de numéro de compte**), import CSV avec mappage de colonnes et profils
par banque, formats français (point-virgule, virgule décimale, JJ/MM/AAAA, ISO-8859-1, BOM),
dédoublonnage, virements internes, catégorisation par règles locales ; budget et flux ; portefeuille
avec prix **saisis ou importés** ; arithmétique de rééquilibrage vers **la cible que tu fixes**.
**Aucune recommandation d'achat ou de vente** (E.4). XP sur la tenue, jamais sur le rendement.

### Phase 9 — Tendances, trajectoires, revues (P3, C.8)

Repères personnels, croisements entre domaines avec effectif minimal, taille d'effet, incertitude et
contrôle des comparaisons multiples ; langage de piste, jamais de causalité ; fiches de constat ;
trois trajectoires actives au plus ; revue hebdomadaire guidée de 5 minutes, bilans mensuel,
trimestriel, annuel ; indicateur de recul.

**Tests** : statistiques vérifiées sur des jeux synthétiques à résultat connu ; **aucune piste
affichée sous l'effectif minimal** ; un refus de trajectoire est mémorisé et respecté.

## 4. En parallèle, par lots

Ces chantiers ne dépendent pas de la chaîne de phases et avancent par lots entre deux validations.

| Lot | Contenu | Dépend de |
|---|---|---|
| **Parité A** | Explications, corrections, visuels, prétest, glossaire pour les parcours DGFiP ; `check-content --parcours` et tableau de couverture | phase 1 |
| **QCM temporalité** | Schéma `temporalite` (intemporelle / historique / actuelle / à venir), péremption à l'exécution, table d'audit des 540 questions | phase 1 |
| **Prétest réécrit** | Curseur par matière, ordre strictement croissant, ancres, lecture guidée, passe de retour, exploitation dans le rappel n−1 | phase 1 |
| **Prompt IA par couches** | Composition par couches, suppression de « Ouvrir dans Claude », catégories sensibles décochées par défaut avec aperçu éditable (E.5) | phase 3 |
| **Référentiels DGFiP** | Programmes officiels des trois concours, **sur sources datées, jamais inventés** | aucune |
| **Corrections C8-C9** | 4 746 corrections restantes sur 4 892 | aucune |

**Les référentiels DGFiP sont la contrainte la plus dure de tout le plan.** P3 interdit de les
inventer, et à juste titre : un programme de concours faux produirait des mois de révision à côté
du sujet. Ils doivent donc venir des arrêtés et des notices officielles, datés. Tant qu'ils
manquent, les trois parcours DGFiP restent navigables **et vides**, ce que le prompt autorise
explicitement (« un parcours partiellement rempli reste utilisable, avec un indicateur de
complétude »).

## 5. Pourquoi la sauvegarde remonte devant Odyssée et Sport

C'est ma seule divergence avec l'ordre de la section F, et je la motive plutôt que de la glisser.

Aujourd'hui, **toutes** tes données tiennent dans l'IndexedDB d'un navigateur, sans aucune
sauvegarde. Un nettoyage de données de site, un changement de machine, un profil corrompu :
cinq mois de progression disparaissent sans recours. Construire Odyssée et Sport avant la sauvegarde
revient à multiplier par dix la quantité de données qu'on peut perdre — journal psychique et
historique financier compris — avant d'avoir le moyen de les mettre à l'abri.

La section F de P3 place d'ailleurs « extension du stockage et de la sauvegarde » en phase 1, ce qui
présuppose qu'une sauvegarde existe déjà : c'est P2 qui la crée. L'ordre que je propose ne
contredit donc pas P3, il rend explicite ce que sa phase 1 suppose.

## 6. Critères d'acceptation communs à toutes les phases

1. **Aucun contenu en clair dans Git.** `content/` et `public/data/` restent ignorés ; Odyssée,
   Sport et leurs données ne sont **jamais** versés au dépôt (E.5).
2. **Aucun secret dans un prompt engendré par défaut.** Vérifié par un test, pas par relecture.
3. **Aucun appel réseau n'emporte de donnée personnelle.** Les deux options réseau de P3 sont, sauf
   contre-ordre de ta part, écartées de la v1 (décision 4).
4. **Garde-fous E.1 à E.6 testés** : aucune règle ne produit de dose, de protocole, de conseil
   médical, de qualification clinique ni d'XP sur un comportement extrême.
5. **Un parcours vide ou partiel ne plante jamais.**
6. **Accessibilité** : clavier et lecteur d'écran sur chaque nouvel écran, le schéma du corps en
   premier.
7. **Les suites existantes restent vertes** : `essais:relationnel`, `essais:correction`,
   `verifier-corrections`, `astro check`.

## 7. Ce qui t'appartient avant la phase 1

**Les six décisions** de `decisions-phase-0.md` : domaines d'Odyssée, sort de la série existante,
chiffrement par domaine, options réseau, lecture de la règle de modulation, et l'ordre proposé au
§ 5.

**Le dépôt GitHub.** Il est **déjà renommé** en `risitaslegrand.github.io` ; `origin` pointe encore
sur l'ancien nom et ne fonctionne que par redirection. La commande à exécuter toi-même, que je
n'exécute pas :

```
git remote set-url origin https://github.com/RisitasLeGrand/risitaslegrand.github.io.git
```

**Une branche stable.** La branche par défaut du dépôt est `claude/new-session-vlew41` et il
n'existe pas de `main`. Pour un chantier de dix phases, c'est fragile : dis-moi si tu veux que
j'établisse un `main`.
