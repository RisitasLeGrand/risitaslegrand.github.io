# Plan — bouton « Demander à l'IA »

**Livrable 6 du prompt, à produire avant tout code** : les emplacements où le bouton sera
branché, et les données de contexte **réellement disponibles** à chacun. Établi en lisant le
code, non d'après le plan : les écarts entre ce que le prompt suppose et ce que le site a sont
signalés à chaque ligne.

---

## 1. La règle qui gouverne le module

Le site **ne contacte aucune IA**. Il fabrique un texte et le donne à copier. Cela se garantit
de deux façons, et la seconde vaut mieux que la première :

| Garantie | Comment |
|---|---|
| **Aucun appel réseau** | Un essai parcourt la clôture des imports du module et échoue sur `fetch(`, `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket` ou un `import()` d'URL |
| **Aucun secret dans le prompt** | **Par construction** : le type `Contexte` n'a aucun champ qui puisse en porter. Un essai le confirme sur des cas d'exemple, mais c'est le type qui l'interdit — un contrôle de chaîne seul se contournerait au premier champ ajouté |

Ce qui compte comme secret, et qui n'entre jamais dans un `Contexte` : le mot de passe, la clé
dérivée, le sel, les paramètres de dérivation (`ParametresPublics`), et tout identifiant
technique du site.

## 2. Les emplacements, et ce qui existe à chacun

### 2.1 Quiz de cours — `src/pages/quiz/cours.astro`

**Quand** : sur l'écran de correction, après validation. Jamais avant — le prompt contient la
question, et l'ouvrir plus tôt donnerait la réponse sans l'avoir cherchée.

| Donnée du prompt | Disponible ? | Source |
|---|---|---|
| Question, options, bonne réponse | **oui** | `QuestionQuiz` : `{ id, question, options, bonnes }` |
| Ma réponse | **oui** | état de session de la page |
| Correction détaillée (résumé, verdict par option, raisonnement) | **oui dès qu'elle est rédigée** | `correction` du lot C1 ; `explication` seule en attendant |
| Source et indicateur de confiance | `confiance` **oui**, `sources` **oui** | bloc `correction` |
| Extrait de la fiche liée | **oui, et mieux que prévu** | `rappel_de_cours` quand il existe ; à défaut la fiche **dont la question est tirée**, toujours connue — `Fiche { id, titre, matiere, fascicule, coursHtml, ficheHtml, sommaire }` |
| Matière / fascicule / fiche | **oui** | `Fiche` |

### 2.2 QCM - DGFiP — `src/pages/quiz/dgfip.astro`

**Quand** : écran de **résultats** uniquement pour les sessions chronométrées (54 questions,
+1 / −0,5 / 0). Pendant la session, rien : ce sont des conditions d'examen.

| Donnée | Disponible ? | Source |
|---|---|---|
| Question, options, bonne réponse, ma réponse | **oui** | `QuestionDgfip` + `ReponseSession` |
| Provenance de l'annale | **oui** | `source` — déjà rédigé sur les 540 questions |
| Catégorie du concours | **oui** | `categorie: 'A' \| 'B'` |
| Réponse non garantie | **oui** | `incertain`, présent sur 16 questions ; devient `confiance: moyenne` au lot C1 |
| Extrait de fiche de cours | **non, et c'est normal** | Français, Logique et Maths ne correspondent à aucune fiche. Le bloc est **omis**, comme le prompt le prévoit |
| Matière | la rubrique | Le journal les range sous `MATIERE_DGFIP`, et non dans une matière du concours |

### 2.3 Rappels de planification — `src/pages/planification/seance.astro`

**Quand** : comme les quiz de cours. Les rappels n−1 / n−2 / n−4 posent des questions de quiz et
des flashcards tirées des **fiches réellement couvertes** lors des séances antérieures.

Même contexte que 2.1 ou 2.5, **plus** ce que seule cette page a :

| Donnée | Source |
|---|---|
| Thème et jour de la séance | `Seance { theme, jour }` |
| **Ma note de séance** | `Seance.note` — le champ existe déjà, c'est la restitution d'une à deux pages |
| Mes restitutions à blanc | `Seance.restitutions`, indexées par séance restituée |
| Les fiches couvertes ce jour-là | `Seance.fiches` |

C'est l'emplacement le plus riche du site : « mes notes de séance liées » y est pleinement
servi, alors qu'ailleurs il faut remonter des fiches aux séances.

### 2.4 Revue du journal d'erreurs — `src/pages/journal.astro`

**Quand** : sur chaque entrée ouverte.

Le journal ne stocke pas le contenu, seulement de quoi le retrouver : `Fautif { id, genre,
matiere, fascicule?, ficheId?, rubriqueId? }`. Le `genre` dit s'il s'agit d'une flashcard, d'une
question de quiz ou d'une question DGFiP, et le fournisseur **délègue** à celui de la provenance
correspondante après déchiffrement à la demande. Il ajoute ce que lui seul connaît :

| Donnée | Source |
|---|---|
| Depuis quand l'entrée est ouverte, combien de rechutes | `EntreeJournal` |
| Réussites consécutives acquises | `REUSSITES_POUR_FERMER` vaut 2 |

### 2.5 Flashcards — `src/pages/flashcards.astro`

**Quand** : au **verso**, après retournement.

| Donnée | Disponible ? | Source |
|---|---|---|
| Recto, verso | **oui** | `Flashcard { id, question, reponse }` |
| Nombre de fois ratée | **oui** | état FSRS de la carte dans IndexedDB (`lapses`, historique de notations) |
| Extrait de la fiche liée | **oui** | la fiche dont la carte est tirée |

### 2.6 Fiches de cours — `src/pages/fiche.astro`

**Quand** : deux points d'accroche. Dans l'**en-tête de chaque section**, et un bouton flottant
**sur sélection de texte**.

| Donnée | Disponible ? | Source |
|---|---|---|
| Titre et position de la section | **oui** | `Fiche.sommaire : { niveau, id, titre }[]` |
| Le passage sélectionné | **oui** | `window.getSelection()`, borné à la fiche |
| Matière > fascicule > fiche | **oui** | `Fiche` |
| Définitions des mots complexes du passage | **oui** | `src/lib/glossaire.ts` et l'index du glossaire — 493 termes |
| Titres des fiches voisines | **oui** | `Manifeste` → `Fascicule.fiches : FicheResume[]` |

### 2.7 Cog-Training — hors Quad N-Back

**Quand** : sur l'écran de **correction détaillée**, donc après une réponse fausse. Le registre
`src/features/correction/registre.ts` décide déjà qui y a droit : Quad N-Back est exclu, et tout
exercice nouveau est inclus par défaut.

**Relational Reasoning** — `RelationalReasoning.svelte`

| Donnée | Disponible ? | Source |
|---|---|---|
| Moteur et famille | **oui** | `Item.moteur`, `Moteur.categorie`, `FAMILLES` |
| Principe du moteur (texte « Learn ») | **oui** | `Moteur.resume` et `Famille.resume`, ceux qu'affiche `Comprendre.svelte` |
| Ma réponse, la bonne réponse | **oui** | `Item.reponse` et l'état de session |
| Trace de résolution en texte | **oui dès le lot B2** | `Item.trace` : `Etape.legende` est déjà une phrase française |
| **L'item décrit en texte** | **partiellement — pièce à écrire** | `Bloc` de type `faits` est déjà en français ; `grille`, `graphe`, `tableau` sont des structures, et il faut un convertisseur `blocVersTexte()`. C'est le seul morceau de contexte qui n'existe pas encore |

**Veridical Mapping** — `VeridicalMapping.svelte`

| Donnée | Disponible ? | Source |
|---|---|---|
| Route source → cible, et famille | **oui** | arête du hub, `Dimension.famille` (prothétique / métathétique) |
| Valeur attendue, valeur donnée, écart | **oui** | session, et l'écart en unité **et en z** |
| Réglages de la session | **oui** | mode `squelette` / `exhaustif`, portée point / plan / modulaire, bruit de surface |

### 2.8 Actualités — `src/pages/actualites.astro`

**Quand** : sur chaque carte.

| Donnée | Source |
|---|---|
| Titre, résumé, date, domaine | `ItemActu` |
| Sources avec nom et lien | `ItemActu.sources : { nom, url }[]` |
| Lien avec le cours | `ItemActu.lien_cours` et `mots_cles` |

### 2.9 Termes du glossaire

**Quand** : dans la bulle de définition d'un mot souligné, « si la définition ne suffit pas ».

| Donnée | Source |
|---|---|
| Terme et définition | `TermeGlossaire { id, terme, definition }` |
| La phrase où il apparaissait | le nœud de texte environnant, dans le DOM |

C'est le seul emplacement où le contexte est assez court pour que **« Ouvrir dans Claude »** soit
utilisable (voir § 4).

## 3. Les blocs « moi », communs à tous les emplacements

Trois cases à cocher, réglage mémorisé.

| Case | Source | Réserve |
|---|---|---|
| Mon niveau sur ce sujet | `niveauDeLaMatiere()` → `NiveauAffiche { note, observations, fiable, calibree }` | Rendu **en mots**, jamais en nombre à quatre chiffres. Le site s'astreint déjà à ne pas montrer la note brute, et un prompt qui annoncerait « ma note est 1 247 » demanderait à l'assistant d'interpréter une échelle qu'il ne connaît pas. Omis si `fiable` est faux |
| L'historique de mes erreurs sur ce sujet | `EntreeJournal` de l'élément, et agrégats de la matière | Omis si l'entrée n'existe pas |
| Mes notes de séance liées | `Seance.note` des séances dont `fiches` contient la fiche | Pleinement servi depuis une séance (§ 2.3) ; ailleurs, remontée par l'identifiant de fiche |

## 4. « Ouvrir dans Claude » : vérifié, et à désactiver le plus souvent

Vérification faite : `https://claude.ai/new?q=<prompt encodé>` **fonctionne** — la page ouvre une
conversation neuve avec le prompt prérempli, et le soumet sur la plupart des plateformes. La
personne doit être connectée à un compte Claude.

**Mais la recommandation d'usage est de plafonner autour de 2 000 caractères**, le transport par
URL cassant bien avant la fenêtre de contexte du modèle. Or le budget du prompt est de
**8 000 caractères**, et l'encodage les gonfle encore — les retours à la ligne deviennent `%0A`,
chaque accent deux ou trois caractères.

**Conséquence assumée** : le bouton n'est actif que si le `q` **encodé** tient sous le plafond.
Au-delà, il est **désactivé avec son motif affiché** — « prompt trop long pour un lien, utilisez
Copier ». Le bouton **Copier** est le chemin garanti, et il est l'action principale. Aucun autre
assistant ne sera ajouté sans que son paramètre de préremplissage ait été vérifié de la même
façon.

> **Rectification après mesure (lot D).** Le plafond avait été fixé à 2 000 d'après la
> recommandation d'usage citée plus haut. À l'implémentation, mesure faite sur le site : le
> **plus court** prompt que le module sache produire — un terme de glossaire, sa définition, la
> phrase où on l'a rencontré — pèse 1 300 caractères et près de 2 700 une fois encodé, le
> français étant accentué et le prompt structuré en paragraphes. À 2 000, le lien n'aurait donc
> **jamais** été offert, pas même dans le cas pour lequel il était prévu. Le plafond est porté à
> **6 000 caractères encodés** : très en deçà de ce qu'un navigateur transporte (de l'ordre de
> 32 000), assez pour le glossaire, une flashcard courte et les items de Cog-Training, et trop
> peu pour les prompts de quiz et de fiche, qui dépassent 10 000 une fois encodés. Ce qui reste
> non vérifié est ce que `claude.ai` accepte exactement — d'où le repli, qui n'en est pas un :
> « Copier » est l'action principale.

## 5. Budget et troncature

Cible : **8 000 caractères**. Ordre de coupe, du dernier gardé au premier sacrifié :

1. La question ou le passage en cause, et **ma réponse** — jamais coupés
2. La correction
3. L'extrait de cours
4. Les définitions du glossaire
5. Le niveau et l'historique

Coupe **aux limites de paragraphe**, marque `[extrait tronqué]`, et avertissement visible dans
l'aperçu. L'aperçu est **obligatoire et éditable** : rien n'est copié sans que la personne ait pu
relire.

## 6. Découpage du lot

| Lot | Contenu | Dépend de |
|---|---|---|
| **D0** | Ce plan | — |
| **D1** | `construirePrompt(contexte, options)` pur, les gabarits français, les six consignes de préréglage, le budget et la troncature, et les essais par provenance | D0 |
| **D2** | L'interface `FournisseurDeContexte` et les neuf fournisseurs ; `blocVersTexte()` pour Relational Reasoning — la seule pièce de contexte qui manque aujourd'hui | D1 |
| **D3** | La fenêtre `<dialog>` : champ libre, cinq préréglages, cases à cocher mémorisées, aperçu éditable avec compteur, piège à focus, `Échap`, plein écran sur mobile | D1 |
| **D4** | Les livraisons : Copier avec repli par sélection, Partager via Web Share, Ouvrir dans Claude sous condition de longueur | D3 |
| **D5** | Le branchement aux neuf emplacements, dont le bouton flottant sur sélection de texte | D2, D3 |
| **D6** | L'avertissement de premier usage avec « ne plus afficher », et les essais de non-fuite | D3 |
| **D7** | L'événement « aide demandée » en IndexedDB et la pastille du journal — **sans effet** sur le score, l'XP ni le niveau estimé | D5 |
| **D8** | L'essai d'absence d'appel réseau sur la clôture des imports | D2 |

## 7. Un point à signaler

Le prompt demande que l'assistant soit invité à **contredire** le contenu fourni : « si tu penses
qu'une correction ou une réponse fournie est inexacte ou incomplète, dis-le explicitement ».
C'est la bonne consigne, et elle a une conséquence qu'il vaut mieux voir venir : les corrections
du lot C portent un champ `confiance`, et celles marquées `moyenne` sont précisément les réponses
établies sans corrigé officiel. Le prompt les signalera comme telles, de sorte que l'assistant
sache **où** il est permis de douter. C'est plus honnête que de tout présenter avec la même
assurance, et cela donne au bouton une seconde utilité : relire les réponses incertaines de la
banque.

---

## 8. Ce que la réalisation a changé au plan

| Point du plan | Ce qui a été fait |
|---|---|
| § 4, plafond d'URL | Porté de 2 000 à 6 000 caractères encodés, après mesure (voir l'encadré ci-dessus) |
| § 6, D2 — `blocVersTexte()` | Écrit sous le nom `enonceEnMots()` dans `src/features/assistant/blocs-en-mots.ts`, avec `reponseEnMots()` pour les options purement graphiques, que le plan n'avait pas vues |
| § 6, D7 — événement « aide demandée » | Magasin `aides` en IndexedDB v10, exporté et importé avec la progression, effacé avec elle ; pastille sur la page du journal, sans effet sur le score, l'XP ni le niveau |
| § 2.3, séance | Le bouton n'apparaît qu'une fois la note commencée (40 caractères) : sans note, il n'offrirait rien de plus que celui d'une fiche |
| § 1, garantie de non-fuite | Vérifiée sur la **clôture des imports à l'exécution** : les `import type` sont effacés à la compilation et ne sont donc pas suivis, ce qui est précisément ce qui permet au module de connaître la *forme* d'une fiche sans pouvoir atteindre son déchiffrement |
