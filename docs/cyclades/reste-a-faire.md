# Ce qui reste à faire — relevé du 13 octobre 2026, au soir

> **Mise à jour du 14 octobre 2026.** Trois entrées de ce relevé étaient déjà
> fausses au moment où il a été écrit, ou l'ont été dans les heures qui ont
> suivi : A.3, A.5 et A.6. Elles sont corrigées ci-dessous, avec la preuve de
> ce qui a été constaté. Le lot C de la critique d'interface — pages trop
> longues, états vides, planning — a par ailleurs été traité en entier :
> voir `plan-lot-c.md`.

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

### A.3 — Deux écrans de Finances 3 bis — **faits, et déjà faits quand ce relevé l'écrivait**

Ce relevé a été écrit à 15 h 13 ; le commit `f66ea52`, « D-021 — le compte
rendu de la passe, et l'affichage du sondage », date de 20 h 46 le même jour.
Les deux écrans existent :

- le compte rendu est la section `#compte-rendu` de
  `src/pages/odyssee/rapprocher.astro` : « N pointées automatiquement, M à
  pointer, K à revoir », chaque nombre portant le geste qui va avec ;
- le sondage s'affiche dans `#echantillon-sondage`, avec ses deux gestes
  « Vérifier » et « Plus tard ».

Constaté le 14 octobre en lisant le code et l'historique, pas déduit.

### A.4 — Deux gestes de la maquette 4.3 (Finances phase 3)

« Autre ligne » et « Diviser » — ce dernier au sens de la phase 3, répartir
une opération entre plusieurs **occurrences de budget**, à ne pas confondre
avec le fractionnement par **catégories** livré aujourd'hui. Les moteurs
`diviser()` et `controlerParts()` existent et sont éprouvés ; l'interface
relève de l'écran du budget.

### A.5 — `MATIERES_MIGREES` est vide — **fait (D-019)**

`scripts/lib/corrections-migrees.mjs` porte `['cas-pratique']` depuis le
13 octobre. Mesure faite avant de l'inscrire : 158 questions de cas pratique,
158 corrigées — le build ne casse donc pas aujourd'hui, et cassera le jour où
une question de ce périmètre arrivera sans sa correction.

### A.6 — Un magasin déclaré que personne n'écrit — **tranché : il reste, et il le dit**

Le choix retenu est le second : le magasin reste déclaré, et sa déclaration
dans `db.ts` porte maintenant la raison — supprimer un magasin d'IndexedDB
est une migration de schéma, qui doit réussir du premier coup sur la seule
installation qui compte, pour un gain nul puisque le magasin est vide.
`sauvegarde/groupes.ts` le redit à sa ligne de rétention. Le commentaire se
termine par ce qu'il faut *ne pas* en conclure : l'application ne garde
aucune ligne de base, et c'est précisément ce que son absence laissait
croire.

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

## G. Un seul mot de passe — la moitié faite, l'autre à faire avant lundi

### Ce qui s'était installé sans se voir

`actualites-data/cle-privee-chiffree.json` était scellé avec le mot de passe
que portent les quatre routines, et non avec celui du site. Signalé d'abord
comme une anomalie des routines, puis vérifié — et c'était l'inverse : les
routines avaient le bon, et les « corriger » seules les aurait cassées.

Deux chemins mènent à la même clé privée, et ils ne lisent pas le même
fichier. C'est ce qui a rendu la divergence invisible pendant des semaines :

| Qui | Lit | Scellé avec |
|---|---|---|
| Le navigateur, sur le site | `data/actualites-cle.json`, réécrit à chaque build depuis la copie **en clair** de `content/` | le mot de passe du site, forcément à jour |
| Les routines, après un clone | `actualites-data/cle-privee-chiffree.json`, commité | le mot de passe du jour où il a été scellé |

`content/` n'est jamais commité : une routine qui clone n'a que la copie
chiffrée, et le site ne la lit jamais. Chacun marchait avec son mot de passe,
rien ne les confrontait.

### Fait : la clé est resynchronisée

`npm run actualites:cles -- --resynchroniser` a réécrit la copie chiffrée avec
le mot de passe du site, **sans toucher à la paire**. Éprouvé dans les deux
sens après coup : avec le mot de passe en vigueur, les 39 entrées
hebdomadaires se listent ; avec l'ancien, le déchiffrement est refusé.

Que les 39 entrées se relisent est la preuve que la paire est intacte : les
actualités déjà publiées restent lisibles, sur le site comme pour les
routines. Le fichier reste une enveloppe — PBKDF2-SHA256 à 600 000 itérations,
AES-GCM, sel, vecteur d'initialisation, texte chiffré — et rien d'autre.

### À faire : les quatre prompts, avant lundi 5 h

**Les quatre routines détiennent désormais un mot de passe qui n'ouvre plus
rien.** Il faut y porter celui du site, dans la ligne

    Le propriétaire du site te confie son mot de passe : SITE_PASSWORD=…

et dans la commande de l'étape 0

    echo "SITE_PASSWORD=…" > .env.local

Deux occurrences par routine, huit en tout. Rien d'autre ne change.

Ce geste ne m'est pas accessible : le prompt d'une routine ne se change que
depuis la conversation où elle poste, et il y en a quatre, une par routine.

| Routine | Cadence | Prochain tir |
|---|---|---|
| Veille hebdomadaire | lundi 5 h | **lundi 19 octobre** |
| Bilan mensuel | le 1er à 5 h | 1er novembre |
| Synthèse trimestrielle | les 1er janvier, avril, juillet, octobre | 2 janvier |
| Synthèse annuelle | le 6 janvier | 6 janvier |

**L'échéance qui compte est lundi.** Si les prompts ne sont pas à jour, la
veille hebdomadaire échouera à sa première lecture des actualités passées.
Elle n'abîmera rien — le bulletin de la semaine sera simplement manquant, et
le tir suivant pourra le republier avec `--remplacer`.
