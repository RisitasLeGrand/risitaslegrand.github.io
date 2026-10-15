# Prompt 32 — phase 0 : inventaire vérifié, sensibilité, maquettes

Écrit le 15 octobre 2026. **Aucun code.** C'est le livrable du point d'arrêt.

> **Chronologie, pour qu'elle soit au dossier.** Alexis a validé le plan à
> 17 h 00, puis dit « Tu peux construire » à 17 h 06 ; la phase 1 (le filtre
> du cycle) a été poussée dans la foulée. Le Pilote a relevé que la phase 0
> n'existait pas. **Il a raison** : mon propre plan la posait en préalable,
> et je l'ai sautée. L'autorisation d'Alexis couvrait la construction ; elle
> ne fabriquait pas l'inventaire. Ce document comble le manque avant la
> phase 2. Le filtre du cycle reste livré : il est protecteur, et rien dans
> ce relevé ne le contredit.

## 1. Les trois vérifications annoncées au plan

| À vérifier | Constat | Conséquence |
|---|---|---|
| Alertes de conflit entre molécules (H.10) | **Aucun producteur.** `PaireInteraction` et `StatutInteraction` n'apparaissent nulle part hors de `odyssee/molecules.ts`, qui ne porte qu'un registre, une recherche et des statuts. | **Pas une source de ce lot.** Le prompt la listait par anticipation. À inscrire le jour où le producteur existera. |
| Propositions de modulation (D.7 du 22) | **ERREUR DE MA PART, corrigée ici.** J'avais écrit que « modulation » n'apparaissait que dans `sport/refus-locaux.ts`. C'était une ligne d'`import` : le module est `sport/modulation.ts`, il porte `proposer()`, `JOURS_DE_SILENCE = 21`, `SEANCES_MINIMALES = 3` et quatre sortes de proposition, et **deux écrans l'appellent** (`sport/force.astro`, `sport/seance.astro`). | **Source réelle et active.** Inscrite. |
| Trajectoires (C.8 du 22) | `odyssee/trajectoires.ts` existe avec `PLAFOND_ACTIVES` et `controlerTrajectoire()`, et `odyssee/tendances.astro` les affiche. **Aucun émetteur de signal trouvé** : les trajectoires se consultent, elles ne se signalent pas. | **Pas une source** en l'état. À revoir si un signal naît. |

**Ce que cette série d'erreurs m'apprend, et que j'écris pour m'y tenir :**
trois fois aujourd'hui j'ai conclu à une absence depuis un `grep` sur un
mot, au lieu d'ouvrir le dossier. Le magasin des prises, les sept magasins
manquants, et maintenant la modulation. Un nom ne prouve rien, ni sa
présence ni son absence.

## 2. L'inventaire exhaustif

Douze sources réelles. Les colonnes « plafond » et « entre appareils »
viennent du code, pas du prompt.

| # | Source | Module constaté | Déclencheur | Plafond existant | Entre appareils |
|---|---|---|---|---|---|
| 1 | Questions à trancher | `noyau/corrections.ts` + `odyssee/desaccords.ts` | Un désaccord détecté, ou un conflit de fusion | aucun | partagé par le journal |
| 2 | Avis de fusion | `sync/veille.ts` → `sync/notification.ts` | Fin d'une fusion | aucun | local |
| 3 | Proposition d'adaptation | `noyau/adaptation.ts` | Usage observé | 1/semaine, toutes catégories | journal |
| 4 | Avertissement avant analyse | `noyau/avertissements.ts` | Entrée dans un domaine à avertissement | aucun | local |
| 5 | Proposition de modulation | `sport/modulation.ts` | ≥ 3 séances, silence de 21 jours après refus | 21 j par refus | `sport/refus-locaux.ts`, **local** |
| 6 | Veille du rythme de vie | `odyssee/signal-veille.ts` | Signal du moteur | `SILENCE_APRES` par réponse | journal |
| 7 | Rappel de sauvegarde | `noyau/coffre.ts` | > 14 jours sans sauvegarde | 4 degrés | local |
| 8 | Rappel de revue manquée | `odyssee/moment-revue.ts` | Revues en attente | 7 jours au plus | journal |
| 9 | Rappel de prise | branche Santé | Heure de prise | à établir | journal |
| 10 | Apprentissage étendu | `odyssee/consentement.ts` (`RAPPEL`) | Consentement non répondu | — | journal |
| 11 | Occurrence manquée | **à construire** (prompt 38) | Occurrence passée non pointée | une fois, jamais accumulée | journal |
| 12 | Pointage à reporter | `odyssee/donnees-occurrences.ts` (`combienDeReports`) | Un pli en attente | — | **local par construction** |

**Deux remarques que l'inventaire fait apparaître et que le prompt ne dit
pas.** La source 5 garde son silence **localement** (`refus-locaux.ts`) :
deux appareils peuvent donc proposer la même modulation. Et la source 12
est **nécessairement locale** — un pli chiffré pour la boîte d'un appareil
n'a aucun sens sur l'autre. Ce sont deux cas du plafond réparti que je
signalais au plan.

## 3. Tableau de sensibilité (§ 4.2), rempli

Six colonnes, comme le prompt les nomme. « Neutre » = « Cyclades : un
élément à voir ».

| Source | Compteur | Panneau coffre fermé | Panneau coffre ouvert | Notification | Sauvegarde | Effacement de la source |
|---|---|---|---|---|---|---|
| 1 Questions à trancher | **oui** | « 2 questions à trancher » | titre recalculé, sans valeur | neutre | exclue | efface ses éléments |
| 2 Avis de fusion | non | « Synchronisation effectuée » | idem | neutre, **sans nombre** | exclue | sans objet |
| 3 Proposition | non | rien | texte recalculé | **non** | exclue | efface ses éléments |
| 4 Avertissement avant analyse | non | rien | texte recalculé | **non** | exclue | efface ses éléments |
| 5 Modulation | non | rien | texte recalculé | **non** | exclue | efface ses éléments |
| 6 Veille du rythme | non | **rien** (titre hors de Psyché) | titre neutre | **non** (le 27 l'interdit) | exclue | efface ses éléments |
| 7 Rappel de sauvegarde | non | texte entier | texte entier | **oui**, neutre | exclue | sans objet |
| 8 Revue manquée | non | « N revues en attente » | idem | neutre | exclue | efface ses éléments |
| 9 Rappel de prise | non | rien | texte recalculé | **oui**, neutre | exclue | efface ses éléments |
| 10 Apprentissage étendu | non | rien | texte recalculé | **non** (le 25) | exclue | efface ses éléments |
| 11 Occurrence manquée | non | rien | texte recalculé | neutre | exclue | efface ses éléments |
| 12 Pointage à reporter | non | **le nombre seul** | le nombre seul | **non** | exclue | efface ses éléments |
| — Cycle et sa sensibilité | **exclu** | **exclu** | **exclu** | **exclu** | exclu | sans objet |

### Rectification du 15 octobre 2026 — anomalie N-1, option A signée

La colonne « panneau coffre fermé » ci-dessus **n'était pas réalisable** : le
magasin ne laissait en clair que l'`id`. Elle est corrigée ici, et le tableau
d'origine reste au-dessus pour que l'écart se voie.

Avec `genre` en clair — et **lui seul** en plus de l'`id` —, coffre fermé le
centre sait combien d'éléments existent et de quel genre, **et rien d'autre**.
Il ne peut pas distinguer ses sources. La colonne devient donc, pour toutes les
sources qui ont un élément dans le magasin :

| Source | Panneau coffre fermé, rectifié |
|---|---|
| 1 Questions à trancher | compté dans « N questions à trancher » |
| 2, 3, 4, 5, 6, 8, 9, 10, 11 | compté dans « N informations », sans une ligne qui les nomme |
| 7 Rappel de sauvegarde | texte entier — il n'a pas d'élément : `noyau/coffre.ts` le calcule hors du centre |
| 12 Pointage à reporter | le nombre seul — `combienDeReports()` le rend sans le coffre |

**Deux conséquences qui vont dans le bon sens, et une qui coûte.**

La ligne 6 voulait « rien, parce que son titre vit dans Psyché » : coffre
fermé, le centre **ne peut pas** distinguer la veille d'une autre source, donc
rien de Psyché ne peut filtrer — la protection est obtenue par construction au
lieu d'être obtenue par une règle qu'il aurait fallu tenir. Même chose pour la
ligne 2 et son nombre d'opérations.

Ce qui coûte : « 3 revues en attente » et « Synchronisation effectuée » ne
s'affichent plus coffre fermé. Ils reviennent intacts coffre ouvert.

**Trois lignes méritent leur justification.** La 2 perd son nombre
d'opérations : « Reçu : 1 opération » peut révéler une saisie sensible faite
sur l'autre appareil (décision 5). La 6 n'affiche rien coffre fermé parce
que son titre vit dans Psyché, qui est scellée. La 12 montre un nombre et
rien d'autre, **y compris coffre fermé** : c'est la seule information qui
sorte d'un pli, et `combienDeReports()` la rend déjà sans ouvrir le coffre.

## 4. Maquettes

### 4.1 L'icône et le compteur — en-tête, sur téléphone comme sur ordinateur

```
┌──────────────────────────────────────────────┐
│  Cyclades        Révisions  Odyssée   🔔(3)  │
└──────────────────────────────────────────────┘
                                        └─ pastille : nombre d'éléments
                                           « à trancher » seulement.
                                           9 et plus → « 9+ ».
                                           Rien du tout si 0 : pas de rond vide.
```

- La pastille **ne compte que les questions à trancher** (colonne 1 du
  tableau). Tout le reste est dans le panneau sans peser sur le nombre —
  sinon le compteur dirait « 7 » pour sept informations, et ne voudrait
  plus rien dire.
- `aria-live="polite"` **sur le nombre seul** : « 3 éléments à trancher ».
  Jamais un titre, jamais une source.
- **Rien avant connexion, rien sur le menu de garde** : ni icône ni
  compteur (§ 1 n° 4).

### 4.2 Le panneau — ordinateur

```
┌─ Ce que Cyclades signale ─────────────────── ✕ ─┐
│                                                 │
│  À TRANCHER                              2      │
│  ┌───────────────────────────────────────────┐  │
│  │ Deux mesures de poids se contredisent     │  │
│  │ le 12 octobre            → Voir dans Corps│  │
│  ├───────────────────────────────────────────┤  │
│  │ Conflit de synchronisation sur une tâche  │  │
│  │                      → Voir dans Odyssée  │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  À SAVOIR                                       │
│  • Synchronisation effectuée        hier        │
│  • 2 gestes à reporter à l'ouverture du coffre  │
│  • Pensez à sauvegarder        il y a 16 jours  │
│                                                 │
│  ─────────────────────────────────────────────  │
│  Tout marquer comme lu   ·   Réglages           │
└─────────────────────────────────────────────────┘
```

- **Deux sections, et une seule compte.** « À trancher » porte les questions
  ouvertes, qui ne peuvent être ni marquées lues ni archivées tant que la
  source n'est pas résolue (§ 1 n° 8). « À savoir » porte le reste.
- **Chaque ligne mène à son écran** et ne décide de rien sur place (§ 0.2
  n° 4). Le verbe est « Voir dans », jamais « Résoudre ».
- **Aucune couleur d'alarme, aucun « en retard », aucun XP** (§ 1 n° 5).
  La date est relative et sans emphase.

### 4.3 Le panneau — téléphone

Pleine hauteur, mêmes sections, mêmes verbes. L'en-tête du panneau reste
fixe ; la liste défile sous lui. Fermeture par Échap et par le bouton ✕,
focus renvoyé à l'icône.

### 4.4 Coffre fermé

```
│  À SAVOIR                                       │
│  • Synchronisation effectuée        hier        │
│  • 2 gestes à reporter à l'ouverture du coffre  │
│  • 3 éléments chiffrés — ouvrez le coffre       │
```

La dernière ligne dit **qu'on ne peut pas savoir**, et ne devine rien.
Même règle qu'au prompt 38 : `scellee` ne veut pas dire « il n'y a rien ».

### 4.5 Les réglages

```
Réglages du centre
  Notifications du système            [ Activer ]
    Elles n'apparaissent que pendant qu'une page
    de Cyclades est ouverte. Rien ne vous sera
    envoyé quand l'application est fermée.
  Archiver après            [ 30 ] jours
  Supprimer après           [ 180 ] jours
    Jamais pour une question à trancher.
```

Le deuxième paragraphe est le libellé qui **interdit la promesse** du § 0.2
n° 2 : aucun texte ne doit laisser croire à un réveil.

## 5. Ce que la phase 2 attend encore

L'`id` par empreinte, soumis au plan et non tranché : `id = SHA-256(source +
ref_source)` tronqué, plutôt que la référence en clair. Sans lui, la clé du
magasin dirait en clair ce que le magasin chiffre.
