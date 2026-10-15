# Prompt 32 — anomalies

Une ligne par anomalie, dans l'ordre où elle apparaît. Règle du § 4.2 :
une anomalie nouvelle devient une ligne de ce tableau, **jamais un
correctif silencieux**.

| # | Anomalie | Statut |
|---|---|---|
| N-1 | Coffre fermé, le centre ne peut lire **aucun** de ses champs sauf l'`id` : ni la pastille ni la colonne « panneau coffre fermé » du tableau de sensibilité ne sont réalisables en l'état | **close — option A signée le 15 octobre 2026**, motif d'Alexis : « Le genre n'est pas une donnée sensible ». `clairs: ['id', 'genre']`. Aucune migration : le magasin n'avait pas d'écrivain, donc pas un enregistrement. Tableau de sensibilité rectifié. |

---

## N-1 — ce que la phase 2 a rendu impossible à la phase 0

### Le constat, et comment il a été fait

La phase 2 a scellé `centreElements` avec `clairs: ['id']`. J'ai scellé un
élément réel avec une vraie clé AES-GCM et regardé ce que le magasin
contient :

```
Champs lisibles sans la clé : [ 'id' ]
Le genre est-il lisible sans la clé ?   false
La source est-elle lisible sans la clé ? false
```

C'est **exécuté et constaté**, pas lu dans le code : l'enregistrement rendu
par `sceller()` ne porte que `{ id, scelle: { v, iv, ct } }`.

Le coffre de Cyclades ne s'ouvre pas à la connexion : chaque écran sensible
le demande à l'entrée (`ouvrirLeCoffre` est appelé par `sante.astro`,
`psyche.astro`, `finances.astro`, et une quinzaine d'autres). **Coffre
fermé est donc l'état ordinaire du site**, y compris sur l'en-tête où vit
la pastille, et sur toute page qui n'est pas une page sensible.

### Ce que cela casse

| Promesse de la phase 0 | Champ nécessaire | Réalisable coffre fermé ? |
|---|---|---|
| La pastille « 3 » ne compte que les questions à trancher | `genre` | **non** |
| Source 1 — « 2 questions à trancher » | `genre` | **non** |
| Source 2 — « Synchronisation effectuée » | `source` | **non** |
| Source 6 — titre neutre masqué hors de Psyché | `source` | **non** |
| Source 8 — « N revues en attente » | `source`, `regroupement` | **non** |
| Source 12 — le nombre seul | aucun : `combienDeReports()` le rend sans le coffre | oui |
| Source 7 — texte entier | aucun : calculé par `noyau/coffre.ts`, hors du centre | oui |

Le nombre **total** d'enregistrements reste lisible — une ligne par
élément existe, chiffrée ou non. Ce qui manque n'est pas le dénombrement,
c'est sa **répartition** entre questions et informations.

### Ma part dans l'anomalie

Le commit de la phase 2 justifie l'absence d'index par : « un index serait
en clair ». C'est une **sur-lecture** du § 4.1, qui écrit l'inverse : « en
clair, seulement des index **sans domaine, sans source et sans date
fine** ». Le prompt autorise des index clairs, il en restreint le contenu.
`genre`, qui vaut `a-trancher` ou `a-savoir`, n'est ni un domaine, ni une
source, ni une date.

J'ai donc fermé une porte que le prompt laissait ouverte, et la phase 3 a
buté dessus. La correction ne se fait pas en silence : elle touche la
frontière du chiffrement, donc elle est soumise.

### Les options, et ce qu'elles coûtent

**A — `clairs: ['id', 'genre']`.** La pastille redevient exacte. Coffre
fermé, le panneau montre deux nombres — « 2 questions à trancher »,
« 5 informations » — et une mention par ligne, sans jamais nommer la
source. Divulgation ajoutée : la répartition d'un nombre déjà visible en
deux classes qui ne nomment aucun domaine. Aucune source sensible au cycle
n'entre jamais dans le magasin (`filtre-cycle.ts` filtre à l'entrée), donc
cette répartition ne dit rien du cycle. Conforme à la lettre du § 4.1.

**B — rien en clair, statu quo.** Coffre fermé : pas de pastille, pas de
panneau, une invitation à ouvrir le coffre. Parfaitement honnête, et le
centre devient inutile là où l'utilisateur passe le plus clair de son
temps. Le § 1 n° 4 ne demande le silence qu'**avant connexion**, pas après.

**C — `clairs: ['id', 'genre', 'source']`.** Le tableau de sensibilité tel
qu'il est écrit, sans retouche. Contraire à la lettre du § 4.1, qui
interdit la source en clair. Je ne le recommande pas et ne le ferai pas
sans une levée explicite de cette règle.

**D — un magasin de compteurs agrégés, non scellé.** Même divulgation que
A, plus deux écritures à tenir cohérentes. Strictement moins bon que A.

### Ce qui change dans le tableau de sensibilité, sous l'option A

Les lignes 2, 6 et 8 perdent leur libellé coffre fermé : elles passent à la
mention « État chiffré — ouvrez le coffre pour le voir ». Le tableau sera
rectifié, pas réécrit — la version d'origine reste lisible dans l'historique.


---

## N-1 — ce qui a été fait, le 15 octobre 2026

Option **A** signée. Appliqué :

- `coffre.ts` : `clairs: ['id', 'genre']`, avec le raisonnement du § 4.1 écrit
  au-dessus de la déclaration ;
- `essais-coffre.mts` : l'assertion nomme les deux champs attendus **et** en
  refuse nommément deux autres — `source` et `creeLe`. Compter les champs
  aurait laissé passer un échange ; deux sabotages le vérifient ;
- `phase-0.md` : la colonne « panneau coffre fermé » est rectifiée sous le
  tableau d'origine, qui reste lisible.

**Aucune migration n'était nécessaire**, et c'est constaté : aucun fichier de
`src/` n'écrit dans `centreElements` hors de sa déclaration. Le magasin est
vide partout.

Deux effets que l'option A offre en plus de ce qu'elle promettait : coffre
fermé, le centre ne pouvant pas distinguer ses sources, **rien de Psyché ne
peut filtrer** et le nombre d'opérations d'une fusion non plus. Ce que la
décision 5 et la ligne 6 du tableau demandaient comme règles à tenir est
désormais vrai par construction.
