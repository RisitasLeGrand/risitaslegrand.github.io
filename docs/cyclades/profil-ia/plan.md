# Plan — Profil, menu de garde, synthèses pour une IA et import d'une analyse

Livrable de la **phase 0** du prompt complémentaire « profil et initialisation adaptative, menu de
garde, synchronisation intégrale, synthèses pour IA et import d'une analyse au format strict ».

**Aucune ligne de code n'a été écrite pour ce prompt.** Ce document, la liste des questions
(`questions.md`), le schéma d'analyse (`schema-analyse.md`), les maquettes (`maquettes.md`) et les
six décisions (`decisions.md`) sont tout ce que la phase 0 produit, et ils attendent ta validation.

---

## 1. Ce que ce prompt change dans ce qui existe déjà

Trois amendements de la section 0 touchent du code déjà écrit. Les voici mesurés, parce que c'est là
que se cachent les surprises.

### 1.1 La racine du site n'est plus Révisions

Aujourd'hui, `/` **est** le tableau de bord de Révisions : `src/pages/index.astro`, et
`src/lib/branches.ts` déclare `racine: '/'` pour la branche `revisions`. Le prompt demande que `/`
devienne un **menu** qui ouvre le choix entre Odyssée, Sport et Révisions.

Deux façons de le faire, et elles ne coûtent pas la même chose :

| | Ce que ça demande | Ce que ça casse |
|---|---|---|
| **A. Déplacer toute la branche sous `/revisions/`** | 17 pages renommées, tous les liens internes, le manifeste de contenu, les chemins d'audio et de podcasts, le *service worker* | Tous les favoris existants ; aucun serveur pour rediriger, GitHub Pages n'en offre pas |
| **B. Ne déplacer que l'accueil** (recommandé) | `/` devient le menu ; le tableau de bord de Révisions passe à `/revisions/` ; les autres pages (`/fiche/`, `/flashcards/`, `/quiz/`…) restent où elles sont | Un favori sur `/` arrive sur le menu, à un clic de l'accueil. Rien d'autre |

**Je recommande B**, et la raison n'est pas la paresse : les pages de Révisions portent déjà des
chemins qui leur sont propres (`/flashcards/`, `/planification/`), elles ne gagnent rien à être
nichées, et un renommage massif de chemins est exactement le genre de changement qui casse en
silence une ressource chiffrée dont le chemin est écrit dans un manifeste. Le jour où Sport aura des
pages, elles naîtront directement sous `/sport/`.

**À corriger en conséquence** (le prompt le demande explicitement) : « page d'accueil » désigne
désormais l'accueil de **Révisions**. Les occurrences à reprendre sont connues —
`docs/cyclades/plan.md` (deux endroits, dont « `tr.recul-sauvegarde` sur la page d'accueil »),
`docs/cyclades/indicateurs.md`, le commentaire d'en-tête de `src/lib/branches.ts` qui annonce encore
« Odyssée … deviendra la page d'accueil », et les liens de retour de la rubrique Actualités.

### 1.2 Le mot « profil » est déjà pris

`etat.profil` porte aujourd'hui l'XP, la série et les badges. Le **profil commun** de ce prompt est
autre chose. Il ne faut pas les mélanger, et il ne faut pas renommer l'ancien — la clé est lue par
des installations existantes. Le profil commun sera donc écrit ailleurs, sous un nom distinct
(proposition : magasin `profilChamps`, un enregistrement **par champ**).

### 1.3 Une dépendance que je signale avant de commencer : les faits ne voyagent pas

La vérification automatique des chiffres cités (B.6.4) demande de **recalculer un indicateur à la
version des données de l'export**. C'est faisable exactement là où les données sont **journalisées**
— le journal d'opérations et le journal de révisions sont en ajout seul et totalement ordonnés par
horloge logique, donc « rejouer à l'état du 12 juillet » consiste à filtrer sur la borne de
l'horloge. Ce n'est **pas** faisable ailleurs.

Or, à la fin de la phase 5 du chantier de synchronisation, je l'ai écrit dans `plan.md` : **les faits
de domaine (séances, quiz, Cog-Training, QCM) ne sont pas journalisés**. Ils ne voyagent donc pas
entre appareils, et ils ne peuvent pas être rejoués à une version antérieure.

Cela a deux conséquences, et aucune ne doit être découverte en route :

1. **La « synchronisation intégrale » de la section 0.2 n'est pas tenue aujourd'hui.** Deux appareils
   n'aboutissent pas à la même empreinte globale sur les faits de domaine, parce que ces faits ne
   sont pas transportés. L'exigence du prompt est juste ; elle demande un chantier nommé.
2. **Sans journalisation, la vérification des chiffres serait « non vérifiable » presque partout**,
   ce qui viderait B.6.4 de son intérêt.

D'où une **phase préalable** dans le plan ci-dessous. Elle n'est pas dans la partie C du prompt, et
je la propose parce que les phases 3 et 4 reposent dessus.

### 1.4 Le catalogue d'indicateurs n'existe pas encore en code

L'export demande `indicateurs.json` : « catalogue d'indicateurs (identifiants stables, formule,
unité, source, fiabilité) et leurs valeurs par période ». Le catalogue existe aujourd'hui comme
**document** (`docs/cyclades/indicateurs.md`, 52 indicateurs dont 14 calculables) ; sa version code
(`src/lib/odyssee/indicateurs.ts`) était prévue pour la phase 4 du plan Cyclades, qui n'est pas
faite. La règle de fiabilité, elle, est écrite depuis la phase 3f (`fiabilite.ts`).

Je ne propose pas d'attendre Odyssée : je propose de construire le catalogue **réduit aux
indicateurs calculables aujourd'hui** (les 14 de Cognition et Connaissances, nourris par Révisions),
avec les identifiants stables du document. Un export qui annonce 52 indicateurs dont 38 vides serait
moins honnête qu'un export qui en annonce 14 et dit pourquoi.

---

## 2. Le plan en phases

Les phases suivent la partie C du prompt, avec la phase préalable du 1.3 et les dépendances dites.

### Phase 0 — Ce document. *Fait.*

Plan, liste des questions, schéma d'analyse, maquettes, décisions. **Validation attendue.**

### Phase A — Les faits de domaine deviennent journalisés *(préalable, nouveau)*

> **A1 faite, le 11 octobre 2026.** Cinq magasins d'événements immuables — quiz de cours, QCM
> DGFiP, Quad N-Back, Relational Reasoning, Veridical Mapping — entrent au journal et voyagent.
> L'opération porte **l'enregistrement entier** et non le fait typé : le fait typé est une vue,
> faite pour les indicateurs, et faire voyager la vue aurait perdu des données à chaque
> synchronisation. Le **socle est déterministe** — identifiant dérivé de la cible, horloge au
> plancher, appareil nommé `socle` —, de sorte que deux appareils migrés séparément produisent la
> même opération et se réconcilient en silence ; un même enregistrement de contenus différents
> donne le même identifiant, et c'est alors une **collision** signalée, ce qui est exactement ce
> qu'on veut. L'effacement ciblé journalise désormais ses suppressions, sans quoi la première
> synchronisation les aurait ressuscitées.

> **A2 faite, le 12 octobre 2026.** Les trois entités qui demandaient chacune leur règle.
>
> **Les séances** : dernière écriture gagne, ce qui est juste — leurs champs sont objectifs, et
> l'écriture la plus récente est la mieux informée. Leur suppression emporte leur note.
>
> **Les notes de séance** : un **second** registre de types à conflit, `TYPES_TEXTE_A_CONFLIT`.
> La première liste porte un invariant vérifié — un type à conflit explicite est un type *sensible*
> au sens de E.5 —, et une note de séance n'est pas sensible : ce n'est ni de la santé, ni de la
> psyché, ni des finances. Elle est **irremplaçable**, ce qui n'est pas la même chose. « Sensible »
> dit qui peut la lire ; « irremplaçable » dit ce que coûte sa perte. Deux raisons de montrer le
> désaccord, donc deux listes, chacune avec son contrôle. La plus récente s'affiche en attendant, et
> **la réponse décide** : `materialiser` lit les résolutions du journal — elles sont des opérations,
> donc elles voyagent, donc les deux appareils écrivent la même version.
>
> **L'état des fiches** se **combine** et ne s'écrase pas : lue sur l'ordinateur, prétestée sur le
> téléphone, les deux doivent tenir. `lu` par ou logique, `pretesteeLe` par la plus ancienne date
> (l'effet de prétest tient à ce qu'il précède la lecture), `pretestPasseLe` par la plus récente,
> `pretestVues` par union, `derniereOuverture` par la plus récente, `secondes` par le **maximum** —
> qui sous-estime quand on a lu la même fiche sur deux appareils, et ne surestime jamais : une
> surestimation ferait croire à un travail qui n'a pas eu lieu. Ils n'entrent au journal qu'au
> changement réel, l'écriture ayant lieu à chaque ouverture de fiche.
>
> Et une conséquence du socle déterministe qu'il a fallu trancher : pour ces trois magasins, le
> socle est **par appareil**. Un socle partagé aurait donné le même identifiant aux deux versions,
> l'union n'en aurait gardé qu'une — choisie par une règle de départage sans sens métier — et la
> seconde aurait disparu sans que rien ne le dise. Les cinq magasins d'événements immuables gardent
> leur socle partagé, qui est tout leur intérêt.
>
> Au passage, un défaut d'affichage qui devenait un défaut de sûreté : l'écran des conflits
> insérait `JSON.stringify(charge)` dans du HTML. Depuis que les enregistrements voyagent, cette
> charge peut être une note de deux pages écrite à la main — illisible, et **non échappée**. Elle
> est désormais résumée (début du texte, compte de signes, nombre de restitutions) et échappée sans
> exception.
>
> Reste hors du périmètre : les compteurs de tirage DGFiP, état dérivé que l'historique ne permet
> pas de recalculer.


Ce que la synchronisation intégrale (0.2) exige, et ce dont la vérification des chiffres (B.6.4) a
besoin.

- Une opération journalisée par fait de domaine : séance terminée, session de QCM, session de
  Cog-Training, prétest, fiche achevée. Le magasin reste la source d'affichage ; le journal devient
  la source de **vérité transportable**, comme pour FSRS depuis la phase 1b.
- Un **socle** pour l'existant, exactement comme pour FSRS : une entrée par fait déjà enregistré,
  marquée comme socle, reprise telle quelle. L'historique d'avant la migration n'est pas
  recalculable — il est repris, ce qui est honnête.
- L'empreinte d'état couvre alors les faits, et deux appareils peuvent se dire « identiques ✓ » sur
  les trois branches.
- `rejouerJusqua(borne)` : reconstruire l'état d'un indicateur à une borne d'horloge logique donnée.
  C'est la brique que la vérification des chiffres appellera.

**Essais** : deux appareils, une séance de chaque côté, même empreinte après fusion ; un indicateur
rejoué à une borne antérieure rend la valeur d'alors ; une compaction passée rend `non vérifiable`
et non une valeur fausse.

### Phase B — Le profil commun et « Mon profil » *(= phase 1 du prompt)*

- **Modèle** : un enregistrement par champ — `{ champ, valeur, portee, sensible, source, modifieLe,
  version }` — et une **opération journalisée par champ** (`profil.champ`, cible
  `profil:<champ>`). Conséquence heureuse : la fusion champ par champ réclamée par A.6 est **déjà
  écrite** (dernier écrivain par champ sur `(hlc, appareil, valeur)`), et une divergence réelle
  passe par la notification de correction de la phase 3c, avec ses quatre issues. Rien de neuf à
  inventer pour ça.
- **Interface du cœur** : `lireProfil(branche)` rend les champs dont la portée inclut la branche.
  Un champ restreint est **retiré**, pas masqué — la matrice de permissions de la phase 3b a déjà
  tranché ce point, et pour la même raison : rendre un champ caviardé apprendrait qu'il existe.
- **Écran « Mon profil »** : chaque champ avec sa valeur, sa portée (« utilisé par Révisions et
  Sport »), un bouton pour restreindre, un pour supprimer, et l'historique de ses versions.
- **Salutation par le prénom** sur le menu, réglage désactivable, et rien d'autre de personnel.
- **Initialisation allégée pour l'existant** (A.7) : préremplie de ce qui est déduit sans rien
  écraser — parcours INSP actif, matières déjà travaillées, heures d'usage observées, série et
  record repris du socle d'activité. Chaque préremplissage est **affiché comme déduit** et attend
  confirmation : une valeur devinée présentée comme déclarée est un mensonge qui dure des mois.

### Phase C — Initialisation, modules par branche, adaptation *(= phase 2)*

- Le parcours : mot de passe → *(première fois)* initialisation → menu. Une question à la fois,
  boutons et suggestions, « Plus tard » partout sauf le prénom, reprise après fermeture (l'avancement
  est un champ de profil comme les autres, donc il se synchronise).
- Les modules de branche, posés **à la première entrée dans la branche**.
- L'adaptation : ce qui est **observé** localement et sans aucune IA (heures d'usage, jours
  effectifs, durée moyenne, régularité, domaines délaissés) donne des **propositions** — au plus une
  par semaine, jamais bloquante, acceptées, reportées ou refusées, **refus mémorisé**, et un bouton
  « Réinitialiser l'adaptation » qui remet tous les réglages adaptatifs à leur valeur déclarée.
- Les écarts entre le déclaré et l'observé deviennent soit une question de confirmation, soit — pour
  un **fait** — un désaccord au sens de la phase 3f. Le mécanisme existe, il attend ses règles.

### Phase D — Le catalogue d'indicateurs et les synthèses *(= phase 3)*

- `indicateurs.ts` : les 14 indicateurs calculables aujourd'hui, identifiants stables du document,
  formule en français, unité, sources (pivot en premier, comme `fiabilite.ts` l'attend), fréquence,
  minimum d'effectif. `calcul` rend `null`, jamais zéro.
- Les synthèses : période (semaine, mois, trimestre, année, libre), bilan global, par domaine ou
  transversale. Précalcul des indicateurs, détail à part, séries à résolution dégradée avec
  l'ancienneté.
- Les huit fichiers de B.3, la variante fichier unique, le `manifest.json` avec l'identifiant
  d'export, l'empreinte SHA-256 et le **vecteur de versions** (les bornes d'horloge par appareil,
  plus le périmètre de compaction — c'est ce qui rend la vérification possible, et ce qui dit quand
  elle ne l'est pas).
- Le **journal des exports** : identifiant, empreinte, date, périmètre, **jamais le contenu**.
- Les protections de E.7 sans changement : catégories sensibles décochées par défaut, textes libres
  exclus par défaut, confirmation par catégorie, aperçu avant génération, aucune copie conservée.
- L'estimation de taille et la proposition de découpage.

### Phase E — Le schéma strict, l'import, la vérification *(= phase 4)*

- `schema-analyse.json` et `exemple-analyse.json`, servis avec l'export.
- Le validateur : **écrit à la main**, sans dépendance. Un validateur de schéma JSON générique
  pèserait plus que ce qu'il apporte pour un schéma fermé de cette taille, et les messages d'erreur
  en français avec le chemin exact (« constats[2].preuves[0].indicateur : identifiant inconnu »)
  sont précisément ce qu'une bibliothèque rend mal.
- L'enveloppe tolérante : un bloc de code, une phrase d'introduction, une virgule finale sont
  retirés ; le contenu, lui, est strict.
- Le **prompt de réparation**, généré localement, à copier.
- La **vérification des chiffres** : pour chaque preuve, recalcul de l'indicateur sur la période à la
  version de l'export, et quatre verdicts — confirmé, approché, non retrouvé, non vérifiable.
- L'aperçu, le tri (garder / écarter ; adopter / reporter / refuser ; les questions vers la revue ;
  la qualité vers des « à vérifier »), la conservation compressée, chiffrée, synchronisée, étiquetée
  « analyse externe produite par une IA, non vérifiée », rattachée à sa période et à sa revue.

### Phase F — Durcissement, sécurité, documentation *(= phase 5)*

- Rendu **en texte échappé uniquement**. Le site sait rendre du Markdown — pour les fiches de cours,
  qui viennent du dépôt. Une analyse importée n'empruntera **jamais** ce chemin : `textContent`, pas
  `innerHTML`, aucune image distante, aucun lien ouvert automatiquement.
- Taille maximale à l'import, ensemble de champs fermé, plafonds de nombre et de longueur.
- Bannière permanente, et rappel de consulter un professionnel sur les propositions qui touchent au
  corps ou aux finances — par le champ `avertissement_professionnel` **et** par une règle locale, le
  champ étant rempli par l'IA et donc non fiable.
- Le bouclage complet sur le jeu synthétique de cinq ans, taille et durée mesurées.
- Guide utilisateur : « Mon profil », « Exporter pour une IA », « Importer une analyse ». README mis
  à jour.

---

## 3. Ce que je signale avant de commencer

**Le menu coûte un déplacement d'accueil, pas un renommage du site.** Voir 1.1, option B.

**La synchronisation intégrale n'existe pas encore**, et la phase A est le prix à payer. Je préfère
le dire maintenant qu'après avoir livré un import dont la vérification répondrait « non vérifiable »
à chaque preuve.

**La vérification des chiffres sera parfois impossible, et c'est bien.** Une compaction passée
efface le détail d'avant une borne : le verdict est alors « non vérifiable », jamais une valeur
reconstituée. C'est écrit dans le prompt, et c'est la seule réponse honnête.

**Le profil ne sera pas un objet unique.** Un enregistrement par champ coûte quelques lignes de plus
et donne gratuitement : la portée par champ, la suppression par champ, le versionnement par champ, et
la fusion champ par champ. Un objet unique aurait fait de chaque modification sur deux appareils un
conflit sur tout le profil.

**Trois minutes, c'est quatorze questions.** La liste de `questions.md` est calibrée là-dessus, à
une douzaine de secondes par question, boutons compris. Toute question ajoutée en enlève une autre.

**Je ne construirai pas de garde-fou contre moi-même sur les catégories sensibles** : elles ne sont
pas dans le profil commun, elles restent dans leur domaine sous la matrice de permissions. C'est la
seule architecture qui tient, parce qu'elle ne repose pas sur la discipline d'un écran.
