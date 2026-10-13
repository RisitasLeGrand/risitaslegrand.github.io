# Ce qui reste à faire — relevé du 13 octobre 2026, au soir

Dressé sur l'état réel du dépôt, pas sur la liste de tâches : les comptes
ci-dessous sont **mesurés**, et les écarts avec ce que le relevé précédent
annonçait sont signalés, y compris quand ils me donnent tort.

---

## 0. Les quatre chiffres qu'il faut avoir en tête

| Quoi | Compté aujourd'hui | Ce que le relevé du matin disait |
|---|---|---|
| Fiches de cours | **425** | 347 |
| Fiches avec voix | **250**, soit **175 sans** | 247, soit « une centaine sans » |
| Questions de QCM | **6 759**, dont **0 sans explication** | 8 048, dont 2 706 sans explication |
| Questions avec correction détaillée | **294**, soit **6 465 sans** | 146 |
| Scripts d'essai | **100** | 85 |

Deux de ces écarts méritent qu'on s'y arrête.

**« 8 048 questions, 2 706 sans explication » était faux.** Le compte réel est
de 6 759 questions, et **aucune** n'est sans explication. Le chiffre venait du
rapport de l'agent INSP et n'a jamais été recoupé contre le dépôt. Ce qui
manque, ce sont les **corrections détaillées** — le bloc `correction:` avec
son verdict par option, son détail et son visuel —, et il en manque 6 465.
C'est un chantier tout aussi grand, mais ce n'est pas le même, et le confondre
aurait fait croire que des milliers de questions s'affichent sans un mot
d'explication alors qu'elles en portent toutes une.

**Le fascicule 5 est écrit.** 78 fiches sur les 79 chapitres inventoriés, de
taille comparable à celles du fascicule 4 (médiane 54 ko contre 46 ko). Le
relevé du matin en annonçait 16. L'agent INSP a travaillé pendant la journée.

---

## A. Ce qui attend un geste, et rien d'autre

### A.1 — Les 175 fiches sans voix ★

Les textes de podcast existent pour **les 425 fiches** : c'est la synthèse
vocale qui n'a pas été passée sur 175 d'entre elles, dont les 78 du fascicule
5. La chaîne est locale, gratuite et longue ; il faut la lancer délibérément,
avec un `npm run build` **sans** `REVINSP_SANS_PODCAST=1`.

C'est le plus gros écart entre ce qui est écrit et ce qui est utilisable.

### A.2 — Publication des fascicules 3, 4 et 5

Tâches #62 et #90, plus le fascicule 5 qui vient de s'écrire. Les fiches et
les textes de podcast sont là, le glossaire porte 531 termes ; restent la
synthèse audio (A.1), le complément de glossaire pour le fascicule 5, et la
publication.

### A.3 — Deux écrans de Finances 3 bis

Les deux derniers de la maquette, et les deux ont leur moteur écrit et
éprouvé :

- le **compte rendu d'import** « N pointées, M à pointer, K à revoir »
  (maquette 8.1) — aujourd'hui les trois nombres figurent dans la file, mais
  rien ne les annonce après un import ;
- l'**affichage du sondage** — `sondage()` tire déjà, de façon déterministe,
  les opérations à faire revérifier ; aucun écran ne les montre.

### A.4 — Deux gestes de la maquette 4.3 (Finances phase 3)

« Autre ligne » et « Diviser » — ce dernier au sens de la phase 3, répartir
une opération entre plusieurs **occurrences de budget**, à ne pas confondre
avec le fractionnement par **catégories** livré aujourd'hui. Les moteurs
`diviser()` et `controlerParts()` existent et sont éprouvés ; l'interface
relève de l'écran du budget.

### A.5 — `MATIERES_MIGREES` est vide

Le régime à deux vitesses des corrections est en place, mais aucun périmètre
n'y est déclaré migré. L'agent INSP demandait d'y ajouter `cas-pratique`.
Une ligne, et le contrôle passe de l'inventaire à l'exigence sur ce périmètre.

### A.6 — Un magasin déclaré que personne n'écrit

`odysseeVeilleBases` existe dans le schéma, dans la liste des magasins
scellés et dans la politique de rétention — et **aucun code ne l'écrit**. Les
lignes de base de la veille sont recalculées à chaque évaluation, ce qui est
le bon choix (2,9 ms à l'horizon réel). Il faut donc soit retirer le magasin,
soit écrire pourquoi il est réservé. En l'état, il ment sur ce que
l'application garde.

---

## B. Les chantiers ouverts

| Chantier | Où en est-ce | Qui |
|---|---|---|
| **Corrections détaillées** | 294 sur 6 759. Le lot pilote a prouvé le format ; le reste demande un plan chiffré avant d'être lancé. | agent INSP |
| **Finances, phase 5** | Jeu synthétique de cinq ans, conflits entre deux appareils, mesures d'ergonomie, guide court. Rien de commencé. | moi |
| **Veille — rejouer sur de vraies données** | Phase 4 close. Le rejeu n'a **rien à lire** : cette installation ne porte aucun historique de veille. Ce qui reste n'est pas du code, c'est d'avoir vécu assez de jours. | le temps |
| **Santé, traitements, musculation** | Plan validé, valeurs bloquées. Voir C. | moi, en partie |

---

## C. Bloqué sur des sources extérieures

**Santé, traitements et musculation** — la forme se construit sans rien
attendre : modèle, écrans, enregistrement, programmes, volumes. Ce qui est
bloqué, ce sont les **valeurs** : demi-vies, interactions, limites de
sécurité, niveaux de preuve des méthodes. La liste est dans
`sources-a-atteindre.md`, lots 2 et 3.

La décision que je recommande, inchangée : **construire la forme maintenant**,
chaque valeur affichée « inconnue », avec un bandeau qui le dit. C'est le
comportement voulu de toute façon — une valeur inventée coûterait plus cher
qu'une case vide — et cela met le chantier en état de recevoir les sources le
jour où elles arrivent, au lieu de tout commencer ce jour-là.

---

## D. Bloqué sur des documents que toi seul peux fournir

| Quoi | Combien | Où c'est listé |
|---|---|---|
| Trois annexes INSP | 3 thèmes sur 29 | `fichiers-bloquants.md` § 2 |
| Corrigés DGFiP 2026, inspecteur et contrôleur | 70 questions non recoupées | `fichiers-bloquants.md` § 3 |
| Quatre sources du fascicule 5 | dont `Corrigé Cas Pratique IA_V2.pdf` | rapport de l'agent INSP |

---

## E. La dette méthodologique, et ce qu'elle a encore coûté

**La règle, rappelée** : la suite complète — **100 scripts**, une vingtaine de
minutes — après chaque changement de schéma, et pas seulement avant une
publication. Elle avait sorti trois défauts dormants la dernière fois qu'on
l'a oubliée.

Un piège de mesure à retenir, trouvé aujourd'hui : `essais-relationnel` dépasse
les 300 secondes. Une boucle de vérification qui coupe à 300 s le rapporte en
échec alors qu'il passe. Un essai lent qu'on croit cassé finit par être
ignoré, ce qui revient à ne plus l'avoir.

---

## F. Le modèle de branches, enfin tranché

`main` existe depuis le 13 octobre 2026 au soir. Elle part du sommet de
`claude/new-session-vlew41` et porte donc l'intégralité du travail.

| Branche | Rôle |
|---|---|
| `main` | La référence. Ce dont une nouvelle session part, et ce que les routines lisent. |
| `claude/new-session-vlew41` | La branche de travail des sessions. |
| `gh-pages` | La publication. Reconstruite de zéro à chaque `npm run deploy`, depuis `dist/` seul. Son historique n'a aucune valeur. |
| `veille/…`, `bilan/…`, `synthese/…` | Les branches éphémères des quatre routines d'actualités, fusionnées puis abandonnées. |

### Il reste un geste, et il n'est pas à ma portée

**La branche par défaut du dépôt est encore `claude/new-session-vlew41`.** Le
mandataire par lequel passent mes appels refuse d'écrire les réglages d'un
dépôt — « Repository settings writes are not permitted through this proxy ».
C'est une limite de mes droits, pas une difficulté technique.

Le changement se fait en un clic :
**Settings → General → Default branch → `main`**, sur
`RisitasLeGrand/risitaslegrand.github.io`.

Pourquoi cela compte, au-delà de l'esthétique : le workflow « Publier les
actualités » ne s'exécute que si `github.ref_name == default_branch`, et les
quatre routines commencent toutes par `git checkout <branche par défaut>`.
Tant que le défaut reste la branche de travail, c'est **elle** qui sert de
référence aux routines — ce qui marche aujourd'hui, et deviendra faux le jour
où une session en ouvrira une autre.

Rien n'est codé en dur nulle part : ni le workflow ni les routines ne nomment
une branche. Le basculement est donc sans effet de bord, et c'est délibéré —
le workflow porte même un commentaire qui explique pourquoi il lit le défaut
plutôt qu'un nom écrit.

---

## G. Deux mots de passe, et les routines ont le bon

Signalé ce soir comme une anomalie à vérifier, puis vérifié — et c'était
l'inverse de ce que je supposais.

**`actualites-data/cle-privee-chiffree.json` est scellé avec le mot de passe
que portent les quatre routines, pas avec le mot de passe du site en
vigueur.** Éprouvé dans les deux sens : avec le mot de passe actuel,
`dechiffrer-actualite.mjs` répond « Mot de passe incorrect » ; avec celui des
routines, il liste les 39 entrées hebdomadaires. Les six pull requests des
routines sont d'ailleurs toutes fusionnées, la dernière le 12 octobre.

Les routines ont donc raison, et **les « corriger » les casserait** : elles
échoueraient dès leur première lecture des actualités passées.

### Pourquoi les deux cohabitent sans que rien ne se voie

Il y a deux chemins vers la même clé privée, et ils ne lisent pas le même
fichier.

| Qui | Lit | Scellé avec |
|---|---|---|
| Le navigateur, sur le site | `data/actualites-cle.json`, réécrit à chaque build depuis la copie **en clair** de `content/` | le mot de passe du site, forcément à jour |
| Les routines, après un clone | `actualites-data/cle-privee-chiffree.json`, commité | le mot de passe du jour où il a été scellé |

`content/` n'est jamais commité : une routine qui clone n'a que la copie
chiffrée. Le site, lui, ne la lit jamais. Les deux marchent, chacun avec son
mot de passe, et rien ne les confronte — d'où le silence.

### Le remède, et son ordre

Le dépôt avait prévu le cas : `npm run actualites:cles -- --resynchroniser`
porte en commentaire « le mot de passe a changé : on réécrit la copie chiffrée
sans toucher à la paire ». La paire étant inchangée, les actualités déjà
publiées restent lisibles.

L'ordre compte, et il n'existe pas d'ordre sans fenêtre de casse — les deux
gestes vont ensemble, dans la même séance :

1. `npm run actualites:cles -- --resynchroniser`, puis commiter le seul
   `actualites-data/cle-privee-chiffree.json` ;
2. mettre les **quatre** prompts de routine au mot de passe en vigueur.

Le second geste ne m'est pas accessible : le prompt d'une routine ne se change
que depuis la conversation où elle poste, et il y en a quatre, une par
routine. La prochaine échéance est la veille hebdomadaire du lundi.

### Ou ne rien faire

C'est défendable : tout fonctionne. Le coût est une divergence qui ne se voit
nulle part et qui mordra le jour où le mot de passe du site changera encore,
ou le jour où `npm run actualites:lire` sera lancé avec celui qu'on croit
être le bon. C'est précisément pour cela que `--resynchroniser` existe.
