# Maquettes — menu, initialisation, « Mon profil », export et import

Livrable de la phase 0. Les maquettes sont en texte : elles fixent le contenu, l'ordre et les mots,
pas les pixels. Le socle visuel existe déjà (tokens de couleurs, cartes arrondies, conventions
service-public.gouv.fr).

---

## 1. Le menu de garde — `/`

```
┌──────────────────────────────────────────────────────────────┐
│  Cyclades                                     ☀/🌙  ⚙       │
│                                                              │
│  Bonjour Alexis.                                             │
│                                                              │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐    │
│  │ 🧭  Odyssée    │ │ 🏋️  Sport      │ │ 🎓  Révisions  │    │
│  │                │ │                │ │                │    │
│  │ Pilotage de la │ │ Musculation et │ │ Préparation aux│    │
│  │ vie : domaines,│ │ cardio :       │ │ concours :     │    │
│  │ calendrier,    │ │ exercices,     │ │ cours, fiches, │    │
│  │ tâches, quêtes │ │ séances, force │ │ quiz, séances  │    │
│  │                │ │                │ │                │    │
│  │ Bientôt        │ │ Bientôt        │ │     Entrer →   │    │
│  └────────────────┘ └────────────────┘ └────────────────┘    │
│                                                              │
│  Mon profil · Appareils · Stockage                           │
└──────────────────────────────────────────────────────────────┘
```

- **Aucune donnée personnelle hors le prénom**, et la salutation se coupe dans « Mon profil ».
- Une branche indisponible porte « Bientôt » et n'est pas cliquable : un onglet qui mène à une page
  vide ne renseigne personne, il promet.
- Les trois liens du bas sont les écrans communs. Rien d'autre.

---

## 2. L'initialisation — une question par écran

```
┌──────────────────────────────────────────────────────────────┐
│                                              Question 5 / 14 │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░                     │
│                                                              │
│                                                              │
│      À quelle heure vous levez-vous, d'habitude ?            │
│                                                              │
│                    ┌─────────────┐                           │
│                    │   07 : 00   │  ▲▼                       │
│                    └─────────────┘                           │
│                                                              │
│      Cela servira à régler le moment où votre journée        │
│      change de date — une séance finie à minuit trente       │
│      compte pour la soirée écoulée, pas pour le lendemain.   │
│                                                              │
│                                                              │
│  ← Précédent                 Plus tard          Suivant →    │
└──────────────────────────────────────────────────────────────┘
```

- La **raison** de la question est sous la question, toujours. Une question dont on ne voit pas
  l'usage se répond mal, ou se passe.
- « Plus tard » est au même niveau que « Suivant », pas relégué.
- La barre dit où l'on en est. Quatorze écrans sans compteur paraissent cent.
- Fermer la page ne perd rien : l'avancement est un champ de profil, donc il est enregistré et
  synchronisé.

**Dernier écran :**

```
│      C'est tout pour l'instant, Alexis.                      │
│                                                              │
│      Vous avez répondu à 11 questions sur 14. Les trois       │
│      autres attendent dans « Mon profil », et chaque branche  │
│      vous posera deux ou trois questions la première fois.    │
│                                                              │
│      Ce que Cyclades a réglé pour vous :                     │
│       · journée logique à 6 h (vous vous levez à 7 h)        │
│       · samedi et dimanche en repos                          │
│       · cinq domaines affichés sur huit                      │
│      Tout cela se change, et se remet à zéro d'un bouton.    │
│                                                              │
│                                     Ouvrir le menu →         │
```

---

## 3. « Mon profil »

```
┌──────────────────────────────────────────────────────────────┐
│  Mon profil                                                  │
│                                                              │
│  Ces informations restent sur vos appareils. Elles sont      │
│  exclues des exports pour une IA par défaut.                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Prénom                                          Alexis   ││
│  │ déclaré · modifié le 11/10/2026 · version 1              ││
│  │ Utilisé par : le menu uniquement                         ││
│  │                      [Modifier] [Restreindre] [Supprimer]││
│  ├──────────────────────────────────────────────────────────┤│
│  │ Heure de lever                                    07:00  ││
│  │ déclaré · version 1                                      ││
│  │ Utilisé par : Odyssée, Révisions                         ││
│  │ ⓘ Règle la bascule du jour logique à 6 h.               ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ Jours d'entraînement effectifs       mardi, jeudi, samedi││
│  │ observé, non confirmé · version 3                        ││
│  │ Vous aviez déclaré : lundi, mercredi, vendredi.          ││
│  │                  [C'est juste] [Garder ma déclaration]   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Relecture : la dernière vérification date du 11/10/2026.    │
│  Prochaine proposition de relecture : avril 2027.            │
│                                                              │
│  [Réinitialiser l'adaptation]   [Supprimer tout le profil]   │
└──────────────────────────────────────────────────────────────┘
```

- Chaque champ dit **qui l'utilise** et **d'où il vient** : déclaré, ou observé puis confirmé.
- Un écart déclaré / observé se règle là, en deux boutons, sans jamais rien écraser d'avance.
- « Restreindre » ouvre la liste des branches avec des cases. Un champ restreint est **retiré** de
  ce que la branche lit, pas caviardé.

---

## 4. « Exporter pour une IA »

```
┌──────────────────────────────────────────────────────────────┐
│  Exporter une synthèse pour une IA                           │
│                                                              │
│  Période   ( ) Semaine  ( ) Mois  (•) Trimestre  ( ) Année   │
│            ( ) Depuis le début   ( ) Période libre           │
│            du 01/07/2026 au 30/09/2026                       │
│                                                              │
│  Domaines  [x] Cognition  [x] Connaissances                  │
│            [ ] Corps  [ ] Psyché  [ ] Finances               │
│                                                              │
│  Contenu   [x] Indicateurs et séries                         │
│            [x] Qualité des données et lacunes                │
│            [ ] Catégories sensibles (santé, psyché, finances)│
│            [ ] Mes textes libres (notes, journal)            │
│            [ ] Mes analyses précédentes comme contexte       │
│            [x] Profil pseudonymisé (sans prénom ni nom)      │
│                                                              │
│  ⚠ Ce fichier part chez un tiers que Cyclades ne contrôle    │
│    pas. Rien n'est envoyé par le site : vous le confiez      │
│    vous-même à l'IA de votre choix.                          │
│                                                              │
│  Taille estimée : 180 Kio — lisible d'un seul tenant.        │
│                                                              │
│              [Voir l'aperçu]      [Générer l'export]         │
└──────────────────────────────────────────────────────────────┘
```

Au-delà d'un seuil, le bouton change de phrase :

```
│  Taille estimée : 2,4 Mio — trop pour une seule lecture.     │
│  Proposition : une analyse par domaine (4 fichiers), puis    │
│  une synthèse transversale qui s'appuiera sur les analyses   │
│  déjà importées.                                             │
│                              [Découper]  [Exporter quand même]│
```

---

## 5. « Importer une analyse »

**Entrée :** coller le texte, ou choisir un fichier.

**Échec de validation :**

```
┌──────────────────────────────────────────────────────────────┐
│  L'analyse n'a pas pu être importée                          │
│                                                              │
│  3 erreurs. Rien n'a été importé.                            │
│                                                              │
│  · constats[2].preuves[0].indicateur : identifiant inconnu   │
│    « corps.poids_moyen ».                                     │
│  · propositions[1].nature : valeur « protocole » refusée.     │
│    Admises : organisation, habitude, mesure, question,        │
│    verification_donnee.                                       │
│  · propositions[0].lie_aux_constats[1] : « c9 » ne correspond │
│    à aucun constat.                                           │
│                                                              │
│  [Copier le texte de correction à donner à l'IA]             │
└──────────────────────────────────────────────────────────────┘
```

**Aperçu avant intégration :**

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠ Analyse produite par une IA, non vérifiée ; ne remplace   │
│    ni un avis médical, ni un conseil financier.              │
│                                                              │
│  Trimestre du 01/07 au 30/09/2026 · export exp-01JAWZ4K7P ✓  │
│  12 constats · 6 propositions · 3 questions                  │
│                                                              │
│  ── Constats ───────────────────────────────────────────────  │
│  c1  Cognition · tendance · confiance moyenne                │
│      « Le temps de révision a baissé d'un tiers en août      │
│        avant de remonter en septembre. »                     │
│      Preuve : cog.temps-revision, septembre → 42,5 h         │
│               ✓ confirmé (calculé : 42,5 h)                  │
│                                   [Garder]  [Écarter]        │
│                                                              │
│  c7  Corps · correlation · confiance elevee                  │
│      « Les semaines à moins de six heures de sommeil         │
│        coïncident avec une baisse de la régularité. »        │
│      Preuve : corps.sommeil-moyen, août → 5,8 h              │
│               ✗ non retrouvé (calculé : 7,1 h)               │
│      ⚠ Un chiffre de ce constat ne se retrouve pas dans vos  │
│        données.                                              │
│                                   [Garder]  [Écarter]        │
│                                                              │
│  ── Propositions ──────────────────────────────────────────   │
│  p1  organisation · horizon 4 semaines                       │
│      « Poser les séances de révision avant 21 h »            │
│      Suivi : cog.regularite-revision                         │
│      Vient de : c1                                           │
│            [Adopter comme trajectoire] [Reporter] [Refuser]  │
│                                                              │
│  ── Questions ─────────────────────────────────────────────   │
│  q1  « Août était-il un mois de congés ? »                   │
│      → ira dans la revue du trimestre                        │
│                                                              │
│  ── Qualité des données ───────────────────────────────────    │
│  · Corps : 14 jours sans pesée → deviendra un « à vérifier » │
│                                                              │
│         [Tout écarter]              [Intégrer mes choix]     │
└──────────────────────────────────────────────────────────────┘
```

- La bannière est **permanente**, pas un bandeau qu'on referme.
- Chaque preuve porte son verdict, et le chiffre **recalculé** à côté du chiffre cité.
- Les trois actions d'une proposition sont celles de B.6.6 ; « Adopter » prévient si les trois
  trajectoires actives sont déjà prises.
- Tout est en **texte échappé**. Aucun lien n'est cliquable, aucune image n'est chargée.

**Après intégration**, l'analyse se retrouve dans « Historique des analyses » et dans la revue du
trimestre, avec son étiquette et son journal : date, export lié, constats importés, adoptés, refusés.
