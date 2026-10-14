# Prompt 36 — La revue devient le check-up journalier

Plan soumis avant tout code. La décision 1 était tranchée d'avance (« Revue ») ;
les décisions 2, 3 et 4 l'ont été le 14 octobre.

Mêmes conventions que le plan du prompt 35 : *mesuré*, *lu*, *supposé*,
distingués partout.

---

## 0. Les constats R1 à R5, refaits sur l'état courant

Le relevé du pilote portait sur le commit `195f78c`. **Refait sur l'état
courant** — tous *lus* dans la source.

| N° | État courant | Verdict |
|---|---|---|
| R1 | `branches.ts:211` : `{ id: 'revue', nom: 'Revue du soir', court: 'Revue', chemin: '/odyssee/revue/' }` | **Confirmé**, avec une nuance utile : le libellé **court est déjà « Revue »**. La décision 1 ne demande que d'aligner `nom`. |
| R2 | Règle `revue-du-soir`, `jour.ts:295-298`, « jamais le matin » | **Confirmé**, et je précise la source de l'heure : elle vient du **champ de profil** `coucher` (`odyssee-jour.ts:100-103`), pas des nuits observées, et elle est **ignorée** si elle ne vaut pas `^\d{2}:\d{2}$`. |
| R3 | `branches.ts:225` : `principaux: ['accueil','calendrier','taches','corps']` | **Confirmé.** La revue n'y est pas. |
| R4 | « Ce qui était prévu aujourd'hui », puis les trois questions ouvertes | **Confirmé.** |
| R5 | Seul `src/lib/sync/notification.ts` existe | **Confirmé.** Aucun centre de notifications : le prompt 32 n'est pas construit. |

**Un fait qui lève à lui seul le coût de la décision 3** : le profil porte
**déjà les deux champs**, `lever` (`noyau/profil.ts:219`) et `coucher` (`:228`).
Une ouverture du matin à l'heure de lever déclarée **ne demande aucun champ
nouveau**.

---

## 1. La liste exacte des faits pris en compte en V2, branche par branche

Exigée par le prompt. Établie *lue* depuis le **catalogue déclaré** de
`src/lib/noyau/faits.ts`, qui compte **36 types** répartis sur trois branches
propriétaires. Je donne ceux que la revue consultera, et surtout **ceux qu'elle
ne consultera pas, avec la raison** — une liste qui ne dirait que ce qu'elle
retient cacherait l'essentiel.

### Branche `revisions` — consultés
| Type | Ce qu'il prouve pour la revue |
|---|---|
| `revision.seance` | une séance de révision a eu lieu |
| `revision.flashcards` | des cartes ont été vues |
| `revision.qcm` | un QCM a été passé |
| `revision.pretest` | un prétest a été fait |
| `revision.note-seance` | la séance a **déjà** reçu sa note — donc on ne la redemande pas |

*Non consultés* : `revision.fiche`, `revision.niveau`, `revision.retention`,
`revision.cog-training` — ce sont des **états dérivés**, pas des actes de la
journée ; les afficher comme « déjà fait » serait un contresens.

### Branche `sport` — consultés
| Type | Ce qu'il prouve |
|---|---|
| `sport.seance` | la séance du jour est enregistrée — l'exemple même du prompt |
| `sport.blessure` | une blessure est déclarée, à ne pas redemander |

*Non consultés* : `sport.serie`, `sport.record`, `sport.phase` — détail interne
d'une séance ou état de programme ; la séance les résume.

### Branche `odyssee` — consultés
| Type | Ce qu'il prouve |
|---|---|
| `odyssee.evenement` | relevé d'agenda **déjà fait** (`realise` ≠ `inconnu`) |
| `odyssee.tache` | tâche cochée |
| `odyssee.quete` | quête avancée |
| `odyssee.focus` | séance de concentration tenue |
| `odyssee.checkin` | **humeur ou état de forme déjà saisis** |
| `odyssee.journal` | une note de journal existe déjà pour le jour |
| `odyssee.sommeil` | la nuit est renseignée |
| `odyssee.repas`, `odyssee.hydratation` | relevés du corps déjà faits |
| `odyssee.poids`, `odyssee.mesure` | pesée ou mesure du jour |
| `odyssee.revue` | **la revue du jour est déjà tenue** — le fait qui gouverne V3 |
| `odyssee.medicament` | prise déclarée — **coffre ouvert seulement** |
| `odyssee.statut-hormonal` | **coffre ouvert seulement** |

*Non consultés* : `odyssee.usage`, `odyssee.passation`, `odyssee.interaction`
(télémétrie d'usage : les afficher reviendrait à dire à Alexis ce qu'il a
cliqué) ; `odyssee.operation`, `odyssee.valorisation` (finances : une opération
bancaire n'est pas une chose « servie » dans une revue de journée) ;
`odyssee.sante`, `odyssee.apport-externe`, `odyssee.charge-percue` (relèvent du
lot Santé, non construit).

**Les deux types du coffre** suivent l'interdit 1 du prompt 36 : ils n'entrent
que **coffre ouvert**, selon le prompt 35. Coffre fermé, la revue n'affiche pas
un silence mais le manque nommé — faute de quoi « rien à signaler » voudrait
dire deux choses contraires.

---

## 2. Les décisions appliquées

| N° | Décision |
|---|---|
| 1 | *(tranchée d'avance)* Le nom est **« Revue »**, partout et quel que soit le moment. |
| 2 | En tête de l'accueil quand elle est due, **plus une pastille sur l'onglet Odyssée**. La barre du bas ne change pas. |
| 3 | Matin dès l'heure de **lever** déclarée, ou **6 h** à défaut. Soir deux heures avant le **coucher** déclaré, ou **20 h** à défaut. **Les valeurs par défaut vivent dans la règle, jamais écrites dans le profil.** |
| 4 | Un seul rappel regroupé (« 3 revues en attente »), **sur 7 jours au plus**, dans la liste d'Odyssée et sur l'accueil dès maintenant ; dans le centre de notifications quand il existera. |

**Pourquoi le repli ne s'écrit pas dans le profil** : écrire 20 h dans le champ
`coucher` reviendrait à faire dire à Alexis une heure qu'il n'a jamais
déclarée. Toute la branche distingue le déclaré du déduit ; un repli est une
règle de produit, pas une déclaration.

**Où va la notification, puisque le prompt demande de le dire** : R5 est
confirmé, il n'y a pas de centre. Donc **la liste des propositions du jour**
(`jour.ts`, nouvelle règle `revue-manquee`) **et l'accueil**. Le passage au
centre se fera quand le prompt 32 sera livré.

---

## 3. Les phases

Commit séparé par phase, **« go » attendu avant chacune**.

### Phase 1 — Le nom, et le moment au choix

*Fichiers* : `src/lib/branches.ts`, `src/pages/odyssee/revue.astro`,
`src/lib/noyau/profil.ts` (préférence du moment), `src/lib/odyssee/jour.ts`.

*Ce qui change* : `nom: 'Revue du soir'` devient `'Revue'` ; une préférence
« Moment de ma revue : matin / soir », réglable au profil et proposée à la
première ouverture ; les libellés suivent le moment — « hier » en mode matin,
« aujourd'hui » en mode soir, **jamais un « aujourd'hui » faux**.

*Risque* : faible sur le renommage, **moyen sur les libellés**. C'est
précisément là que se loge le défaut que l'interdit vise : un mode matin qui
dirait « aujourd'hui » en parlant de la veille serait un mensonge d'interface,
et le seul moyen de s'en assurer est de jouer les deux modes.

### Phase 2 — Les heures d'ouverture

*Fichiers* : `src/lib/odyssee/jour.ts`, `src/lib/odyssee-jour.ts`.

*Ce qui change* : `heureDeCoucher()` gagne un pendant `heureDeLever()` ; la
règle `revue-du-soir` devient `revue` et ouvre selon le moment choisi ; les
replis 6 h et 20 h vivent **dans la règle**.

*Ce qui est réparé au passage* : aujourd'hui, **sans heure de coucher déclarée,
la revue n'est jamais proposée** (*lu*, R2). Le repli à 20 h met fin à cette
disparition silencieuse.

*Risque* : moyen. Touche le moteur des règles du jour, qui alimente le tableau
de bord. Le passage de minuit et le jour logique existant sont le piège connu.

### Phase 3 — Ce qui a déjà été servi n'est pas reposé

*Fichiers* : `src/pages/odyssee/revue.astro`, un module de lecture s'appuyant
sur l'agrégation de faits existante.

*Ce qui change* : avant d'afficher quoi que ce soit, la revue lit les faits du
jour concerné selon la liste du § 1 ; ce qui est déjà servi passe dans une ligne
**« Déjà fait aujourd'hui »**, cochée, sans question ; seul ce qui attend encore
une réponse est demandé.

*Risque* : **le plus élevé de ce lot, et pas pour une raison technique.** Un
fait mal reconnu ferait disparaître une question qu'il fallait poser. Une revue
qui ne demande rien parce qu'elle croit à tort que tout est fait est pire
qu'une revue qui redemande. Les essais de doublons porteront donc **dans les
deux sens** : le fait présent ne doit pas être redemandé, et le fait **absent**
doit l'être.

### Phase 4 — L'oubli rappelé, et l'accès en un geste

*Fichiers* : `src/lib/odyssee/jour.ts` (règle `revue-manquee`),
`src/pages/index.astro`, `src/pages/odyssee/index.astro`, `src/lib/branches.ts`
(pastille).

*Ce qui change* : la revue de J s'ouvre **datée de J**, sans écraser celle de
J+1 ni s'y confondre ; en mode matin, la revue du matin de J+1 **est** celle de
J ; un seul rappel regroupé, sur sept jours au plus ; la revue due ou manquée
paraît **sur l'accueil du site**, plus une pastille sur l'onglet Odyssée.

*Risque* : moyen. L'accueil est la page la plus vue ; une revue qui s'y
afficherait à tort serait vue tout de suite — ce qui, pour une fois, est une
bonne propriété.

---

## 4. Les essais

- la batterie complète, verte **avant** et après ;
- essais unitaires : le moment matin ou soir avec leurs heures d'ouverture, y
  compris **sans heure déclarée** (les replis) ; les doublons **dans les deux
  sens** ; la revue manquée, puis plusieurs jours manqués, puis **au-delà de
  sept** ; le passage de minuit et le jour logique ;
- un essai de navigateur sur la journée type, en mode matin **puis** en mode
  soir, données synthétiques ;
- captures en 390 × 844 et 1280 × 800 : la revue du matin, la revue du soir, la
  ligne « Déjà fait », le rappel de revue manquée, l'accueil avec la revue due.

**Un essai que j'ajoute** : la revue doit rester **sous trente secondes et une
seule réponse** (interdit 4). Une phase qui ajoute un aperçu du jour et une
ligne « déjà fait » peut l'allonger sans qu'on s'en aperçoive. L'essai comptera
les champs demandés, et échouera si le minimum pour clore la revue dépasse une
réponse.

---

## 5. Mes réserves

1. **La phase 3 peut faire taire une question qu'il fallait poser.** C'est le
   risque de ce lot, et il est silencieux : rien à l'écran ne signalera une
   question escamotée. D'où les essais dans les deux sens.
2. **La décision 4 n'a pas d'endroit où vivre pleinement.** Sans centre de
   notifications, « un seul rappel » se réduit à une ligne de tableau de bord et
   d'accueil. C'est ce que je livrerai ; ce n'est pas tout à fait ce que le mot
   « notification » promet, et je préfère l'écrire.
3. **Deux modes doublent la surface de libellés.** « Hier » et « aujourd'hui »
   devront être justes dans chaque écran touché, et c'est le genre d'erreur
   qu'aucun test de type ne rattrape — seule la lecture des deux modes à l'écran
   la trouve.
