# Cyclades

Application personnelle privée, chiffrée, hébergée gratuitement sur GitHub
Pages — dans le navigateur, sans serveur ni compte.

Cyclades se divise en **branches**, déclarées dans `src/lib/branches.ts` :

| Branche | Ce qu'elle porte | État |
|---|---|---|
| **Révisions** | Préparation aux concours : cours, fiches de synthèse, flashcards à répétition espacée, quiz, glossaire, planification, suivi de progression | disponible |
| **Odyssée** | Pilotage de la vie : domaines, calendrier, tâches, quêtes, revue du soir, relevé de ce qui a eu lieu | disponible |
| **Sport** | Musculation et cardio : bibliothèque d'exercices, schéma du corps, programmes, séance en direct, suivi de la force | disponible |

La branche Révisions se décline en **parcours** (`src/lib/parcours/registre.ts`) :
INSP, DGFiP B, DGFiP A, DGFiP A+. Chaque parcours déclare ses matières, ses
thèmes de planification et le concours qu'il prépare. Seul l'INSP porte du
contenu à ce jour ; les trois autres se naviguent et attendent leur
référentiel officiel, qui ne sera jamais inventé.

Les noms de stockage (base IndexedDB `revinsp`, clés `revinsp.*`) gardent leur
préfixe historique : voir `docs/cyclades/renommage.md`.

---

## Sommaire

1. [En bref](#en-bref)
2. [Installation](#installation)
3. [Déposer vos fiches](#déposer-vos-fiches)
4. [Format d'une fiche](#format-dune-fiche)
5. [Le glossaire](#le-glossaire)
6. [Les fiches audio](#les-fiches-audio)
7. [La rubrique QCM — DGFiP](#la-rubrique-qcm--dgfip)
8. [Travailler en local](#travailler-en-local)
9. [Publier sur GitHub Pages](#publier-sur-github-pages)
10. [La rubrique Actualités](#la-rubrique-actualités)
11. [Changer le mot de passe](#changer-le-mot-de-passe)
12. [Comment fonctionne la protection](#comment-fonctionne-la-protection)
13. [Sauvegarder et synchroniser la progression](#sauvegarder-et-synchroniser-la-progression)
14. [Mon profil, l'export vers une IA, l'import d'une analyse](#mon-profil-lexport-vers-une-ia-limport-dune-analyse)
15. [Odyssée : le pilotage de la vie](#odyssée--le-pilotage-de-la-vie)
16. [Sport : la musculation et le cardio](#sport--la-musculation-et-le-cardio)
17. [Cog-Training](#cog-training--quad-n-back-relational-reasoning-et-veridical-mapping)
18. [Organisation du projet](#organisation-du-projet)
19. [En cas de problème](#en-cas-de-problème)

---

## En bref

Trois commandes suffisent au quotidien :

| Commande | Effet |
|---|---|
| `npm run dev` | Chiffre le contenu puis ouvre le site en local pour le tester |
| `npm run deploy` | Chiffre, construit et publie le site sur GitHub Pages |
| `npm run hash` | Affiche l'empreinte SHA-256 du mot de passe (voir plus bas) |
| `npm run actualites:cles` | Crée la paire de clés de la rubrique Actualités (une seule fois) |
| `npm run actualites:local` | Fabrique des actualités de démonstration pour le mode dev |
| `npm run actualites:lire` | Relit une actualité chiffrée (nécessite le mot de passe) |
| `npm run actualites:publier` | Met la rubrique Actualités en ligne sans reconstruire le site (aucun mot de passe ; normalement fait par GitHub Actions) |

**Règle de sécurité fondamentale :** le dossier `content/` (vos fiches en clair)
et le fichier `.env.local` (votre mot de passe) ne sont **jamais** envoyés sur
GitHub. Ils figurent dans `.gitignore` depuis le premier commit. Seul le
résultat du build — déjà chiffré — est publié.

---

## Installation

Prérequis : [Node.js](https://nodejs.org/) version 20 ou plus récente.

```bash
# 1. Récupérer le projet
git clone https://github.com/<votre-compte>/<votre-depot>.git
cd <votre-depot>

# 2. Installer les dépendances
npm install

# 3. Créer le fichier de mot de passe (jamais commité)
cp .env.local.example .env.local
```

Ouvrez `.env.local` et remplacez la valeur par votre vrai mot de passe :

```
SITE_PASSWORD=votre-mot-de-passe
```

Vérifiez que ce mot de passe correspond bien à l'empreinte enregistrée dans
`site.config.mjs` :

```bash
npm run hash
```

La commande affiche `✓ Correspond déjà…` si tout est cohérent. Sinon, suivez la
section [Changer le mot de passe](#changer-le-mot-de-passe).

Enfin, créez le dossier de contenu à partir des exemples fournis :

```bash
npm run init:contenu
```

---

## Déposer vos fiches

Les fiches vivent dans `content/`, organisé en **matière → fascicule → fiche** :

```
content/
  glossaire.yml
  droit-public/
    fascicule-1/
      fiche-01-hierarchie-des-normes.md
      fiche-02-principe-de-legalite.md
  questions-internationales/
    fascicule-3/
      fiche-01-pandemie-relations-internationales.md
```

Les noms de dossiers n'ont aucune importance technique : **la hiérarchie
affichée sur le site est reconstruite à partir du front-matter** de chaque
fiche (champs `matiere` et `fascicule`). Les dossiers ne servent qu'à vous
retrouver dans vos fichiers.

Matières suggérées pour le concours interne :

- Droit public
- Économie et finances publiques
- Questions sociales, européennes et internationales
- Culture générale et expression écrite
- Anglais

---

## Format d'une fiche

Un fichier `.md` par fiche thématique, composé d'un **front-matter** (entre
deux lignes `---`) et de cinq sections optionnelles.

```markdown
---
matiere: "Questions internationales"
fascicule: "Fascicule 3 — Enjeux globaux"
titre: "Pandémie et relations internationales"
ordre: 1
tags: [santé mondiale, gouvernance, OMS]
---

## Prétest

- question: "Une question posée AVANT la lecture ?"
  options:
    - "Première proposition"
    - "Deuxième proposition"
  reponse: "Deuxième proposition"
- question: "Une deuxième, deux à quatre en tout ?"
  options: ["Oui", "Non"]
  reponse: "Oui"

## Cours complet

Le texte de référence, en Markdown. Les sous-titres se notent `###`.

### I. Première partie {#i-premiere-partie}

Du texte, des **listes**, des tableaux, des *italiques*…

## Fiche simplifiée

La version condensée, à relire rapidement.

## Flashcards

- q: "La question posée ?"
  r: "La réponse attendue."
  partie: i-premiere-partie
- q: "Une autre question ?"
  r: "Une autre réponse."

## Quiz

- question: "L'énoncé du QCM ?"
  options:
    - "Première proposition"
    - "Deuxième proposition"
    - "Troisième proposition"
  reponse: "Deuxième proposition"
  explication: "Facultatif : s'affiche après la réponse."
  partie: i-premiere-partie
```

### Les parties d'une fiche

Chaque titre de niveau 2 ou 3 du « Cours complet » est une **partie** : un
morceau qu'on peut lire, écouter ou réviser seul. Son identifiant s'écrit à
côté du titre, entre accolades — `{#i-premiere-partie}` — et il ne bouge
plus, même si le titre est corrigé. C'est tout l'intérêt : l'ancre d'un titre
se fabrique à partir de son texte, si bien que corriger une coquille la
change, et détache du même coup le repère audio de la partie, les cartes qui
s'y rattachent et les séances qui disent l'avoir vue.

`npm run parties:identifiants` les pose une fois pour toutes sur les fiches
existantes, d'après l'ancre actuelle — tous les liens déjà enregistrés
continuent donc de tomber juste. Le script est idempotent et ne touche que
`content/`.

Une carte et une question de quiz peuvent ensuite désigner la partie dont
elles relèvent, par un champ `partie:` **facultatif**. Son absence veut dire
« la fiche entière », et c'est le cas par défaut : en cas de doute, on laisse
le champ vide plutôt que de deviner. Le build refuse deux parties du même
identifiant dans une fiche, et une carte qui cite une partie qui n'existe
pas ; un titre encore sans identifiant est toléré et signalé en fin de
construction.

La synthèse vocale note, en plus, la seconde où chaque partie commence à se
dire ; ces repères sont chiffrés avec la fiche. Une fiche audio produite
avant cette version n'en a pas, et s'écoute d'un bloc.

**À la lecture**, ces repères donnent trois choses : la liste des parties sous
le lecteur, où un appui saute à l'une d'elles ; un bouton « 🎧 Écouter à
partir d'ici » sur chaque titre du cours qui est une partie atteignable ; et
les commandes « partie précédente / suivante » de l'écran verrouillé. Celui-ci
n'affiche jamais qu'un titre neutre, « Cyclades — fiche audio », le même pour
toutes les fiches : un téléphone posé sur une table ne doit pas dire à la
pièce ce que son propriétaire révise.

L'endroit où l'écoute s'est arrêtée est enregistré dans le magasin
`podcastPositions`, donc synchronisé et sauvegardé avec le reste de la
progression. Il s'écrit au fil de l'eau et à chaque arrêt — pause, passage en
arrière-plan, fermeture de la page —, et la reprise recule de trois secondes
pour retrouver le fil. Une fiche écoutée jusqu'au bout perd sa position : la
liste « Écoutes en cours » de l'accueil de Révisions dit donc ce qui est
commencé, et non ce qui a été écouté.

**En séance**, une fiche peut n'être travaillée que par parties. « Toute la
fiche » reste le choix par défaut ; en cochant des parties, on restreint la
lecture, les cartes et les QCM. Le seuil est de **5 cartes et 3 questions** :
en dessous, la séance est complétée depuis le reste de la fiche, et l'écran le
dit — « 4 cartes sur cette sélection, complétées par 1 de la fiche ». Les
parties réellement vues sont retenues dans `Seance.parties`, un champ
facultatif dont l'absence veut dire « la fiche entière » : une séance
enregistrée avant ce prompt vaut donc pour la fiche entière, ce qui est la
vérité. Le découpage automatique d'une longue fiche sur plusieurs séances est
un réglage, **désactivé par défaut**.

### Détail des champs

| Champ | Obligatoire | Remarque |
|---|---|---|
| `matiere` | oui | Regroupement de premier niveau |
| `fascicule` | oui | Regroupement de deuxième niveau |
| `titre` | oui | Titre affiché de la fiche |
| `ordre` | non | Position dans le fascicule (défaut : 999) |
| `tags` | non | Mots-clés, utilisables comme filtres de recherche |

Un tag a une conséquence : **`méthodologie`** écarte la fiche de l'estimation de
niveau et des files de révision. Ces fiches — méthodes d'épreuve, devoirs,
corrigés — enseignent comment traiter une épreuve, pas ce qu'il faut en savoir ;
les réviser en répétition espacée reviendrait à mémoriser un mode d'emploi.
Elles restent lisibles, et se révisent toujours en ouvrant la fiche. Le build
**refuse** une fiche dont le titre annonce une méthode, un devoir ou un corrigé
et qui n'a pas ce tag : c'est le genre d'oubli qui ne se voit jamais à l'usage.
Le réglage se change dans Progression → « Contenus écartés ».

### Règles à connaître

- Les cinq titres reconnus sont `## Prétest`, `## Cours complet`,
  `## Fiche simplifiée`, `## Flashcards` et `## Quiz`. Un autre titre `##` est
  rattaché à la section en cours (utile pour un cours découpé en grandes
  parties).
- Le `## Prétest` s'écrit au format du quiz. C'est un **vivier de 3 à 16
  questions** — le build refuse les autres nombres —, dont le site n'affiche que
  **trois** à la fois, tirées au sort en préférant celles jamais servies. Un
  vivier fourni est ce qui permet à un prétest reproposé (après une progression
  effacée, par exemple) de rester un prétest, et non la répétition d'un exercice
  déjà corrigé. Visez une dizaine de questions.
- Le prétest s'affiche avant la première lecture du cours — depuis la fiche,
  depuis la séance, ou depuis le tableau de bord —, et n'est jamais noté : ni XP
  à la justesse, ni entrée au journal d'erreurs. Écrivez-y des questions
  d'orientation, pas des questions de contrôle : leur rôle est d'ouvrir la
  lecture, pas de la vérifier. N'y recopiez pas une question du quiz, sinon
  celle-ci ne mesurera plus rien lorsqu'elle reviendra corrigée — `npm run
  verifier:pretests` le contrôle.
- **Aucune question sur l'épreuve.** Sa durée, son coefficient, le plan attendu,
  ce qu'en dit le jury : un prétest ouvre la lecture d'un sujet, il ne révise
  pas le mode d'emploi du concours, et une telle question occupe la place de
  celle qui, elle, aurait ouvert quelque chose. Le build **refuse** un prétest
  contenant le vocabulaire de l'épreuve (liste dans `scripts/lib/pretest.mjs`).
  C'est un filet, pas une preuve : il ne reconnaît pas toutes les tournures, et
  la règle tient d'abord à ce qu'on écrit. Une fiche dont le sujet **est**
  l'épreuve — méthode, devoir, corrigé, bibliographie — n'a donc pas de prétest
  du tout.
- La matière **« Cas pratique »** est elle aussi écartée de l'estimation par
  défaut : l'épreuve s'évalue sur une note rédigée, pas sur des questions
  fermées, et un « niveau en RCP » tiré de quelques QCM de vocabulaire ne
  prédirait rien de la copie. Même réglage, même endroit.
- Dans les flashcards, `q:`/`r:` peuvent aussi s'écrire `question:`/`reponse:`.
- Dans les quiz, `reponse:` accepte le **texte exact** d'une option, ou son
  **numéro** (`0` pour la première). Pour plusieurs bonnes réponses, utilisez
  `reponses: ["...", "..."]`.
- Les valeurs contenant `:` ou `"` doivent être entourées de guillemets.
- Le build refuse de publier si une fiche est mal formée, et affiche la ligne
  fautive : rien n'est mis en ligne tant que le contenu n'est pas valide.

### Pourquoi l'identifiant des cartes est stable

Chaque flashcard reçoit un identifiant dérivé de **sa question**, pas de sa
position. Vous pouvez donc réordonner les cartes, en ajouter ou en supprimer
sans perdre l'historique de répétition espacée. En revanche, **reformuler une
question crée une nouvelle carte** : son historique repart de zéro. C'est
voulu — une question réécrite est une autre question.

---

## Le glossaire

Les termes techniques sont soulignés automatiquement dans les cours et les
fiches simplifiées, avec leur définition au clic (ou au survol sur ordinateur).
**Aucun balisage manuel n'est nécessaire dans les fiches.**

Tout se pilote depuis `content/glossaire.yml` :

```yaml
- terme: "gouvernance"
  formes: ["gouvernances"]
  definition: "Ensemble des règles et processus de pilotage et de décision…"
- terme: "multilatéralisme"
  formes: ["multilatéral", "multilatérale", "multilatéraux"]
  definition: "Mode de coopération internationale associant au moins trois États…"
```

- `formes` liste les variantes à détecter aussi (pluriels, féminins, sigles).
- La détection ignore la casse **et les accents** : « État », « etat » et
  « ÉTAT » sont reconnus de la même façon.
- Les titres, les liens et les blocs de code ne sont jamais modifiés.
- En cas de chevauchement, le terme le plus long gagne : « droit international »
  l'emporte sur « droit ».
- Pour forcer la détection sur un passage précis, écrivez `[[le terme]]` dans
  le Markdown.

Une page **Glossaire** liste tous les termes par ordre alphabétique et sert
elle-même de support de révision.

Pour ne souligner que la **première** occurrence de chaque terme dans une fiche,
passez `premiereOccurrenceSeulement: true` dans `site.config.mjs`.

---

## Les fiches audio

Chaque fiche dont le « Cours complet » est renseigné reçoit une **version
parlée**, écoutable directement dans sa page : un bouton « ▶ Écouter la fiche »,
sous le titre, et un lecteur audio ordinaire.

Tout est produit **sur votre machine**. Aucune fiche n'est envoyée à un service
de synthèse vocale, et le fichier audio est chiffré comme le reste du contenu :
sur GitHub Pages, ce n'est qu'un flux d'octets illisible de plus.

**Rien n'est téléchargé tant que vous ne le demandez pas** : ouvrir une fiche
n'appelle que son texte. Le fichier audio n'est récupéré et déchiffré qu'au
clic sur « Écouter la fiche », et le bouton annonce d'avance sa durée et son
poids.

### Installer la chaîne de production (une seule fois)

```bash
npm run podcasts:installer
```

La commande installe le moteur de synthèse choisi dans `site.config.mjs`, un
`ffmpeg` statique si la machine n'en a pas, et le modèle de voix française —
déposé dans `outils/`, un dossier **non commité**. Python 3 est le seul
prérequis.

Deux moteurs, tous deux **locaux et gratuits** :

| Moteur | Modèle | Diction | Vitesse de production |
|---|---|---|---|
| **`kokoro`** (par défaut) | [Kokoro v1.0](https://huggingface.co/hexgrad/Kokoro-82M) multilingue, voix `ff_siwis` — ≈ 390 Mo | Nettement plus naturelle | ≈ 25 min de calcul pour 10 min de parole (sur 4 cœurs) |
| **`piper`** | [Piper](https://github.com/rhasspy/piper) `fr_FR-siwis-medium` — ≈ 65 Mo | Plus mécanique | ≈ 2 min de calcul pour 10 min de parole (sur 4 cœurs) |

Une API de synthèse vocale du nuage (ElevenLabs, Google, Azure) donnerait une
voix encore plus naturelle, mais elle est **payante au caractère** — de l'ordre
de 30 à 300 $ pour regénérer l'ensemble des fiches — et chaque fiche serait
envoyée à un tiers. Les deux moteurs ci-dessus ne coûtent rien et ne font sortir
aucun texte de la machine.

### Produire les fiches audio

```bash
npm run podcasts     # scripts parlés + synthèse des fiches nouvelles ou modifiées
```

Cette étape est **intégrée au flux de contenu** : `npm run contenu`,
`npm run dev`, `npm run build` et `npm run deploy` la lancent d'eux-mêmes.
Ajoutez une fiche, modifiez son cours : son podcast est régénéré au prochain
build, sans rien demander. Les autres ne sont pas refaites — une empreinte du
texte parlé sert de témoin.

Pour travailler sans attendre la voix, `REVINSP_SANS_PODCAST=1 npm run dev`
écrit les scripts et saute la synthèse.

### Ce qui est produit, et où

| Fichier | Contenu | Commité ? |
|---|---|---|
| `content/<matière>/<fascicule>/<fiche>.podcast.md` | le script parlé, relisible et corrigeable | non (`content/` est ignoré) |
| `content/.audio/<id>.opus` | l'audio en clair | non |
| `public/data/audio/<id>.enc` | l'audio **chiffré**, publié | non (régénéré à chaque build) |

Le script parlé n'est pas une lecture du cours : les titres deviennent des
relances (« On passe à la suite… »), les listes des énumérations dites, les
tableaux des phrases, les abréviations sont développées (« art. 55 » se dit
« article 55 »), les phrases trop longues sont coupées, et **chaque notion du
glossaire croisée en chemin est expliquée** à sa première occurrence. La
réécriture est déterministe : le même cours donne toujours le même script.

Pour corriger une tournure, modifiez la **fiche** (ou `scripts/lib/podcast.mjs`),
jamais le `.podcast.md` : il est réécrit à chaque build.

### Changer la voix ou le débit

Dans `site.config.mjs`, section `podcast` :

| Réglage | Effet |
|---|---|
| `moteur` | `'kokoro'` (naturel, lent) ou `'piper'` (mécanique, rapide) |
| `kokoro.voix` | `ff_siwis` est la seule voix française du modèle |
| `piper.voix` | `fr_FR-siwis-medium` et `fr_FR-upmc-medium` (féminines), `fr_FR-tom-medium` (masculine) |
| `vitesse` | 1 = diction naturelle ; **en dessous, la lecture est plus lente et plus douce** |
| `silenceParagrapheMs`, `silencePhraseMs` | les respirations |
| `silencePartieMs` | la pause avant une nouvelle partie — plus longue qu'une respiration, parce qu'un changement de sujet s'entend avant de se comprendre |
| `sonie` | la sonie visée à l'encodage, en LUFS. −16 est la cible usuelle de la parole en mobilité |
| `format` | `'opus'` (recommandé) ou `'mp3'` pour un navigateur ancien |
| `bitrate` | qualité et poids du fichier : `'16k'` en Opus équivaut à `'32k'` en MP3 |

**Les cinq derniers entrent dans l'empreinte** : ils ne changent pas une
syllabe du texte dit, mais ils changent le son produit. En changer un
resynthétise donc tout, et c'est voulu — sans cela, la bibliothèque
mélangerait deux volumes ou deux rythmes de pause.

Après un changement de moteur, de voix ou de vitesse, relancez
`npm run podcasts:installer` (si le modèle change) puis `npm run podcasts` :
l'empreinte enregistrée ne correspond plus, **toutes** les fiches sont donc
resynthétisées. Pour la centaine de fiches actuelle, comptez **une bonne nuit
avec Kokoro**, **quelques heures avec Piper**. La génération est **reprenable** :
interrompue, elle repart des fiches qui manquent.

### Ce qu'une fiche audio dit, et ce qu'elle ne dit pas

Le script parlé n'est pas le cours lu à voix haute : il est réécrit pour
l'oreille, qui ne peut ni revenir en arrière ni voir la page.

- **Le plan est annoncé** à l'ouverture, et le rang de chaque partie au
  passage : « Deuxième partie, sur trois : … ». Les deux nombres viennent des
  titres de la fiche.
- **Chaque partie se termine par un récapitulatif**, construit à partir de son
  titre et de ses exergues, puis — s'il existe une carte rattachée à cette
  partie — par une **question de rappel** : « Question : … », quatre secondes
  de silence, « Réponse : … ». Pas de carte rattachée, pas de question : on
  n'en fabrique pas une.
- **Rien n'est inventé.** Plans, récapitulatifs, nombres d'éléments et
  questions viennent de la fiche ou de ses cartes. Quand une information
  manque, la phrase est omise, jamais complétée.
- **Les sigles fiscaux** (IR, IS, TVA, CGI, LPF, CE, QPC) sont dits en entier
  la première fois puis épelés. La table est explicite et close : un sigle
  deviné serait développé faux. DGFiP, IFiP, LOLF et OMS se prononcent et
  restent lus tels quels.
- **Ce que l'audio ne peut pas lire est signalé** : une fiche qui contient un
  schéma le dit une fois, « La fiche montre ici un schéma : vous le
  retrouverez à l'écran ».
- **Les silences ne sont jamais écrits dans le texte dit.** Ils sont déclarés
  à part, dans l'en-tête du script, par rang de paragraphe. Tout ce qui reste
  dans le texte sera prononcé : un marqueur oublié s'entendrait, et
  `essais:scripts-parles` refuse d'ailleurs les crochets doubles.

`npm run essais:fiches-audio` éprouve ces règles, et mesure sur un fichier
réellement encodé la sonie, la pause de partie et les repères de partie.

### Ce que cela ajoute au dépôt — à lire avant de publier

C'est le seul vrai coût de cette fonctionnalité, et il n'est pas négligeable :

- l'ensemble des fiches représente **plusieurs dizaines d'heures de parole**,
  soit de l'ordre de **200 Mo** d'Opus chiffré à 16 kbit/s, là où le reste du
  site pèse environ 10 Mo. Le même contenu en MP3 à 32 kbit/s en pèserait le
  double : c'est tout l'intérêt d'Opus sur de la parole ;
- ces fichiers partent sur la branche `gh-pages` à **chaque publication**. La
  branche est reconstruite depuis zéro et poussée en force, son historique ne
  s'accumule donc pas — mais chaque `npm run deploy` téléverse bien ces
  centaines de mégaoctets, ce qui rallonge la publication de plusieurs minutes
  selon la connexion ;
- GitHub Pages recommande de rester **sous 1 Go** par site publié. La marge
  existe, elle n'est pas infinie : surveillez-la si le nombre de fiches double.

Trois leviers, si le poids devient gênant :

1. baisser `bitrate` à `'12k'` — un quart de moins encore, au prix d'une voix
   plus métallique ;
2. ne synthétiser qu'une partie des fiches : supprimez de `content/.audio/`
   les fichiers que vous ne voulez pas publier, les fiches concernées
   afficheront simplement « Fiche audio pas encore disponible » ;
3. renoncer à la fonctionnalité : videz `content/.audio/`, plus aucun fichier
   audio n'est publié.

**Coût récurrent : aucun.** Les deux moteurs sont locaux, libres et gratuits :
la seule ressource consommée est du temps de calcul sur votre machine.

---

## La rubrique QCM — DGFiP

L'onglet **Quiz** ouvre sur un menu à deux entrées : le **quiz du cours**,
tiré de vos fiches et corrigé au fil de l'eau, et le **QCM — DGFiP**, une
**épreuve blanche** avec sa banque de questions autonome, son format d'épreuve
et son barème qui sanctionne l'erreur.

> **Condition de réutilisation des annales : aucun profit financier.** C'est
> la condition relevée sur les sujets d'annales dont la banque est tirée. Ce
> site est personnel, gratuit, sans publicité, sans compte, sans mesure
> d'audience et sans aucune forme de monétisation : elle est remplie **de
> fait**. Elle cesserait de l'être si la nature du site changeait, et rien
> dans le code ne l'empêcherait — d'où cette ligne, et le fichier
> [`NOTICE`](NOTICE), qui porte aussi les licences des échelles
> psychométriques.

### Écrire la banque

Un fichier YAML par rubrique dans `content/qcm-dgfip/` — dossier ignoré par
Git comme le reste de `content/` :

```yaml
rubrique: Français
ordre: 1
questions:
  - question: Quelle phrase est correctement orthographiée ?
    options:
      - Les décisions qu'il a prises sont justifiées.
      - Les décisions qu'il a pris sont justifiées.
    reponse: Les décisions qu'il a prises sont justifiées.
    explication: >-
      Le participe passé employé avec « avoir » s'accorde avec le complément
      d'objet direct lorsque celui-ci précède le verbe.
    source: Annales contrôleur DGFiP 2011
    categorie: B
```

| Champ | Rôle |
| --- | --- |
| `rubrique` | nom affiché ; un fichier par rubrique |
| `ordre` | rang d'affichage de la rubrique |
| `question`, `options` | l'énoncé et ses propositions (au moins deux) |
| `reponse` / `reponses` | la ou les bonnes réponses, par leur texte exact ou par leur index |
| `explication` | **obligatoire** : c'est la correction montrée en fin d'épreuve |
| `source` | l'annale d'origine ; affichée seulement si elle ne commence pas par « RevINSP » |
| `categorie` | `A` ou `B`, les deux niveaux étant fusionnés dans une banque unique |
| `incertain` | note affichée en garde lorsque la bonne réponse ne peut pas être garantie |

Deux règles tenues par le build : une réponse doit correspondre **exactement**
à l'une des options, et deux questions identiques dans une même rubrique sont
ramenées à une seule — un doublon pourrait sinon tomber deux fois dans la même
épreuve.

Les rubriques ne sont pas figées : si des sujets de catégorie A introduisent du
droit ou des finances publiques, il suffit d'ajouter un fichier, la répartition
s'ajuste seule.

### Le déroulé d'une épreuve

Cinq formats sont proposés. Les deux premiers reproduisent la structure réelle
des sujets 2026, rubrique par rubrique :

| Format | Questions | Répartition |
| --- | --- | --- |
| Catégorie B — sujet 2026 | 30 | Culture générale 8 · Français 8 · Maths 8 · Logique 6 |
| Catégorie A — sujet 2026 | 45 | Environnement administratif et financier 10 · Union européenne 10 · Culture numérique 10 · Logique 10 · Anglais 5 |
| Épreuve blanche | 54 | au prorata de toutes les rubriques |
| Demi-épreuve | 27 | idem |
| Série courte | 12 | idem |

Sans quota imposé, la répartition est égale puis le reliquat va aux rubriques
les mieux pourvues : sur quatre rubriques et 54 questions, cela donne
14/14/13/13. Un format dont les rubriques manquent n'est pas proposé ; un
format que la banque ne remplit qu'à moitié l'annonce dans son libellé.

Le barème est celui du concours : **+1** par bonne réponse, **−0,5** par
mauvaise, **0** en l'absence de réponse. C'est pourquoi l'épreuve n'oblige
jamais à répondre : on passe une question sans rien cocher, et décocher une
option ramène à l'abstention. Aucune correction n'est donnée en cours
d'épreuve ; le résultat affiche le score, le détail par rubrique et la
correction de chaque question ratée ou laissée de côté.

Le tirage n'est pas purement aléatoire : chaque réponse est mémorisée dans le
navigateur, et les questions ratées ou esquivées reviennent plus souvent que
celles qui sont sues — sans jamais disparaître du hasard, faute de quoi les
épreuves finiraient par se ressembler.

---

## Travailler en local

```bash
npm run dev
```

Le contenu est chiffré, puis le site s'ouvre sur `http://localhost:4321/`.
Saisissez votre mot de passe comme en ligne.

**Après toute modification dans `content/`, relancez `npm run dev`** : le
chiffrement n'est pas rejoué automatiquement à chaud.

Autres commandes utiles :

```bash
npm run contenu    # rechiffre le contenu seulement
npm run build      # chiffre + construit le site dans dist/
npm run preview    # prévisualise le contenu de dist/
npm run verifier   # contrôle des types (utile après une modification du code)
```

### Les essais

Le dépôt porte un peu plus de deux cents essais, tous nommés `essais:*`, et une
commande qui les passe tous :

```bash
# 1. Construire, et servir ce qu'on vient de construire
REVINSP_SANS_PODCAST=1 npx astro build      # .env.local présent, puis effacé
npx astro preview stop && npx astro preview --port 4321 &

# 2. La batterie complète
SITE_PASSWORD='<le mot de passe>' npm run batterie
```

### Deux cadences, et pourquoi il en faut deux

La batterie complète demande **une demi-heure** quand elle reprend un journal,
**quatre heures** quand elle repart de zéro. La passer avant chaque poussée
coûterait plus que ce qu'elle garde. Deux cadences, donc :

**La batterie complète** (`npm run batterie`, 235 essais) tourne à la fin de
chaque prompt, avant chaque fusion d'une branche dans `main`, et avant de
lancer des agents en parallèle. Une branche ne rejoint `main` qu'après une
batterie passée sur la branche, `main` déjà fusionné dedans, et **lue** : ses
rouges doivent tous figurer au tableau des anomalies, et **aucun rouge
nouveau** n'est admis. Un rouge nouveau se corrige avant toute autre chose, en
remontant au commit qui l'a introduit. Le message de la fusion porte le
compte : `batterie complète : N verts ; rouges ⊂ tableau`.

**Le socle** (`npm run socle`, 16 essais transversaux, **11 minutes** mesurées)
tourne avant chaque poussée, avec `npx astro check` et les essais du périmètre
touché. Le message du commit porte : `essais ciblés : N verts ; socle : N
verts`.

Le socle ne remplace pas la batterie : il attrape ce qu'une modification locale
casse **ailleurs**, et c'est le seul genre de dégât qu'on ne voit pas en
relisant son propre diff. Ce qu'il garde, essai par essai :

| Essai | Ce qu'il garde |
|---|---|
| `essais:structure` | un titre de niveau 1 par écran, un titre d'onglet unique |
| `essais:espaces` | aucun mot collé à une balise en ligne, dans le site construit |
| `essais:mots-colles:navigateur` | les mêmes, mesurés dans la page vivante |
| `essais:typographie` | apostrophes, espaces insécables, accords sans « (s) » |
| `essais:accessibilite:navigateur` | rôles, noms accessibles, ordre de tabulation |
| `essais:mobile:navigateur` | 360 px : aucun débordement, cibles atteignables |
| `essais:mouvement-reduit` | le réglage d'animations existe, et il est respecté |
| `essais:themes-navigateur` | les quatorze thèmes s'appliquent pour de vrai |
| `essais:themes-a-jour` | le catalogue et les feuilles engendrées concordent |
| `essais:contrastes-themes` | WCAG AA dans chaque thème |
| `essais:couleurs-jetons` | aucune couleur littérale hors des jetons |
| `essais:theme-menus` | aucun menu hors palette, et refus de juger à vide |
| `essais:coffre-ferme` | coffre fermé, rien de sensible n'apparaît |
| `essais:echecs-dits` | un échec est dit, jamais avalé |
| `essais:refus-dit` | un mot de passe de coffre refusé est dit, sur chaque page |
| `essais:carte-ecrans` | aucun écran orphelin, aucun au-delà de trois appuis |

La liste vit dans `scripts/batterie.mjs`, et la commande **refuse de tourner**
si l'un de ces noms n'existe plus : un socle qui rétrécit en silence continue
d'annoncer qu'il garde seize choses.

Trois précautions, chacune pour une erreur déjà commise :

- **Reconstruire avant de mesurer.** Les essais de navigateur visitent
  `dist/`, pas les sources. Mesurer sans reconstruire éprouve l'état d'avant,
  et le verdict porte alors sur un site qui n'existe plus.
- **Un seul aperçu.** Un `astro preview` oublié dans un autre répertoire de
  travail répond lui aussi sur le port 4321 : la batterie mesure alors un
  autre site que celui qu'on croit. `npx astro preview stop` avant de lancer
  le bon — `kill` sur le processus laisse le démon dans un état où il se croit
  encore en vie.
- **Aucun essai n'est sauté, désactivé, mis en quarantaine ni assoupli** pour
  obtenir du vert. Un essai rouge se corrige, ou s'inscrit au tableau des
  anomalies avec son diagnostic ; il ne se tait pas.

La batterie ne juge pas : elle nomme ses rouges, conserve le journal de chaque
essai, et rend toujours 0. La comparaison au tableau des anomalies reste un
geste humain. Elle refuse en revanche de tourner sans mot de passe ou sans
aperçu, parce qu'elle rendrait alors des rouges qui n'appartiennent pas au
site.

L'exercice d'entraînement cognitif est écrit en **Svelte** (intégration
`@astrojs/svelte`, installée avec le reste par `npm install`). Pour le tester :
`npm run dev`, puis onglet **Cog-Training** — ou directement
`http://localhost:4321/cog-training/quad-n-back/`. Le son nécessite une première
interaction avec la page, ce que fait le bouton « Commencer la session ».

---

## Publier sur GitHub Pages

### La règle de nommage, à connaître avant tout

GitHub Pages sert l'adresse courte `https://<nom>.github.io/` **uniquement**
si le dépôt s'appelle exactement `<nom>.github.io` **et** appartient au compte
(ou à l'organisation) `<nom>`. Tout autre dépôt est publié dans un
sous-dossier : `https://<compte>.github.io/<depot>/`.

| Dépôt | Propriétaire | Adresse publique | `base` |
|---|---|---|---|
| **`risitaslegrand.github.io`** | **`RisitasLeGrand`** | **`https://risitaslegrand.github.io/`** | **`'/'`** |
| `revinsp.github.io` | organisation `revinsp` | `https://revinsp.github.io/` | `'/'` |
| `un-depot` | `RisitasLeGrand` | `https://risitaslegrand.github.io/un-depot/` | `'/un-depot'` |

**Configuration actuelle : la première ligne** (en gras). Le dépôt porte le nom
du compte suivi de `.github.io`, il est donc servi directement à la racine du
domaine, sans sous-dossier.

Un nom de dépôt qui ne correspond pas au propriétaire ne donne donc pas
l'adresse courte : il produit seulement une URL à rallonge.

### Configuration initiale (une seule fois)

1. **Nommez le dépôt** selon l'adresse visée, d'après le tableau ci-dessus.
   Le dépôt doit être **public** : un compte gratuit l'exige pour utiliser
   Pages. C'est sans risque ici, puisque seul du contenu **chiffré** y est
   publié.
2. **Renseignez `base`** dans `site.config.mjs`, conformément au tableau.
   C'est la seule ligne à changer si l'adresse évolue plus tard.
3. **Reliez le dépôt local** (ou mettez l'URL à jour après un renommage) :

   ```bash
   git remote set-url origin https://github.com/<compte>/<depot>.git
   ```

4. **Publiez une première fois** (voir ci-dessous), puis, dans le dépôt sur
   GitHub : **Settings → Pages → Source : Deploy from a branch →
   branche `gh-pages`, dossier `/ (root)`**.

> La branche `gh-pages` n'existe qu'après le premier `npm run deploy` : c'est
> pourquoi on publie avant de configurer Pages, et non l'inverse.

### À chaque mise à jour du contenu

```bash
npm run deploy
```

Cette commande, exécutée **sur votre machine** :

1. lit le mot de passe dans `.env.local` et vérifie son empreinte ;
2. valide et chiffre tout le contenu de `content/` ;
3. construit le site statique dans `dist/` ;
4. reconstruit entièrement la branche `gh-pages` à partir de `dist/`.

La branche de publication est régénérée depuis zéro à chaque fois : son
contenu est donc exactement celui de `dist/`, sans résidu d'une publication
précédente. Son historique est écrasé (`push --force`), ce qui est sans
conséquence — tout y est régénérable à partir de `content/`.

Aucun secret GitHub Actions n'est nécessaire, et **la construction du site ne
peut pas être automatisée côté serveur** : chiffrer les fiches exige le mot de
passe en clair, qui ne doit jamais quitter votre machine. C'est une conséquence
assumée du modèle de sécurité, pas une limitation technique.

La rubrique Actualités échappe à cette règle, et c'est voulu : ses entrées sont
chiffrées avec une clé *publique*, et la publication les recopie telles quelles
à côté du build sans jamais les relire. `npm run actualites:publier` met donc la
rubrique en ligne sans mot de passe et sans rebuild — c'est ce qui rend la
publication des actualités automatisable côté serveur, et c'est le workflow
`.github/workflows/publier-actualites.yml` qui s'en charge. Voir « Alimenter la
rubrique automatiquement ».

Le site est en ligne une minute plus tard.

### Renommer le dépôt plus tard

Le renommage se fait dans **Settings → General → Repository name**. GitHub
redirige automatiquement l'ancienne adresse, mais pensez à :

1. mettre à jour `base` dans `site.config.mjs` si l'adresse publique change ;
2. mettre à jour le remote local (`git remote set-url origin …`) ;
3. republier (`npm run deploy`).

## La rubrique Actualités

Une rubrique **Actualités** apparaît en bas du tableau de bord : quatre fiches
suivies en continu (Premier ministre ; ministres de Bercy, Action et Comptes
publics et DGFiP ; tableau de bord des chiffres clés de l'économie ; historique
des changements législatifs), un aperçu de la semaine en cours, et un bouton
**« Voir les actualités passées »** qui mène à `/actualites/`. Cette page
d'archive n'est volontairement pas dans la navigation globale : on n'y accède
que par ce bouton.

Elle réunit cinq onglets : **Semaines**, **Mois**, **Trimestres**, **Années**
— chacun filtrable par domaine — et **Synthèses**, qui rassemble les frises
chronologiques de toutes les périodes, légendées par domaine. Les bilans
mensuel, trimestriel et annuel s'ouvrent sur leurs **tendances de fond** :
quelques paragraphes de lecture d'ensemble, avant la liste des actualités
retenues.

Un seul vocabulaire sert partout — cinq domaines : `economie`, `finance`,
`social`, `juridique`, `international`.

Chaque actualité affiche, sous son résumé, les **fiches de cours auxquelles la
rattacher** : ce sont de vrais liens, calculés dans le navigateur à partir des
mots-clés de l'actualité et des titres, tags puis corps des fiches.

### Les actualités sont chiffrées, comme le reste

Rien n'est publié en clair sur GitHub Pages — ni le contenu des actualités, ni
même les dates : les noms de fichiers sont des empreintes.

Le chiffrement ne peut cependant pas utiliser la clé du site : les routines de
veille tournent dans le nuage et n'ont pas le mot de passe. Le site emploie
donc pour elles une **paire de clés** :

| Clé | Où elle vit | Ce qu'elle permet |
|---|---|---|
| **Publique** | `actualites-data/cle-publique.json`, commitée, publiée en clair | chiffrer une actualité |
| **Privée** | `content/actualites-cle-privee.json`, jamais commitée ; republiée chiffrée par le build | déchiffrer, dans le navigateur, après saisie du mot de passe |
| **Privée, copie chiffrée** | `actualites-data/cle-privee-chiffree.json`, commitée, protégée par le mot de passe | relire une actualité en ligne de commande |

Les quatre routines reçoivent le mot de passe : les bilans doivent relire la
période qu'ils résument, et la veille hebdomadaire doit relire l'historique
législatif, qu'elle complète au lieu de le remplacer.

```bash
npm run actualites:lire -- semaines 2026-W38
npm run actualites:lire -- --depuis semaines 2026-W27 2026-W39
npm run actualites:lire -- --lister
```

### Activer la rubrique

```bash
npm run actualites:cles          # crée la paire de clés (une seule fois)
git add actualites-data/cle-publique.json actualites-data/cle-privee-chiffree.json
git commit -m "Active la rubrique Actualités"
npm run deploy
```

Tant que cette étape n'est pas faite, la rubrique reste masquée et le build
vous le rappelle par un avertissement.

> La clé privée est aussi conservée dans le dépôt sous forme chiffrée par le
> mot de passe : elle survit donc à un clone, et le build la restaure dans
> `content/` si elle y manque. Après un changement de mot de passe, réécrivez
> cette copie avec `npm run actualites:cles -- --resynchroniser`. Regénérer la
> paire (`--forcer`) invalide en revanche tout l'historique publié.

### Où vivent les données

```
actualites-data/
  cle-publique.json     en clair, c'est son rôle
  fiches/               premier-ministre, ministres-finances,
                        chiffres-economie, legislation
  semaines/             une entrée par semaine ISO
  mois/                 un bilan par mois civil
  trimestres/           une par trimestre civil
  annees/               une par année
```

Les fichiers portent un nom d'empreinte, pas leur identifiant. Ils sont
versionnés dans le dépôt — c'est sans risque, ils sont chiffrés — et
`npm run deploy` les publie tels quels. Le script **refuse de publier** un
fichier de ce dossier qui ne serait pas chiffré.

### Ajouter une actualité à la main

```bash
node scripts/chiffrer-actualite.mjs --modele semaines > /tmp/semaine.json
$EDITOR /tmp/semaine.json
node scripts/chiffrer-actualite.mjs semaines 2026-W40 /tmp/semaine.json
npm run deploy
```

Les gabarits disponibles : `fiches`, `chiffres-economie`, `legislation`,
`semaines`, `mois`, `trimestres`, `annees`. Un bilan (`mois`, `trimestres`,
`annees`) doit porter ses `tendances` et sa `frise` — le script refuse de
chiffrer sans.

Le fichier en clair reste dans `/tmp` : ne le déplacez pas dans le dépôt.

### Voir la rubrique en développement local

```bash
npm run actualites:local   # entrées de démonstration chiffrées, dans public/
npm run dev
```

Ce dossier local est ignoré par Git, et `npm run deploy` l'écarte d'office : la
démonstration ne peut jamais atteindre le site en ligne.

### Alimenter la rubrique automatiquement

Quatre routines programmées tiennent la rubrique à jour : hebdomadaire (lundi
matin), mensuelle (1er du mois), trimestrielle (2 janvier, avril, juillet,
octobre) et annuelle (6 janvier). Les déclencheurs sont échelonnés parce que
chaque niveau lit le niveau en dessous.

Chacune produit son bulletin, ouvre une pull request et la fusionne — puis
s'arrête là. La mise en ligne est faite par le dépôt : la fusion déclenche le
workflow `.github/workflows/publier-actualites.yml`, qui recopie
`actualites-data/` dans la branche de publication, régénère l'inventaire chiffré
et demande la reconstruction du site. Une ou deux minutes plus tard, l'actualité
est visible. Aucune intervention n'est requise.

Les routines n'ont volontairement pas le droit de déployer : leurs prompts le
leur interdisent. Déployer en production n'a pas à faire partie des pouvoirs
d'une session d'agent, alors que le dépôt a toujours eu ce rôle — et dans un
workflow le geste est versionné, tracé et révocable en supprimant un fichier.
La pull request subsiste comme trace de ce qui a été ajouté, et permet de
revenir en arrière. Voir `docs/routines-actualites.md`.

Aucune image n'est jamais hébergée dans le dépôt : seule l'URL d'origine et son
crédit sont conservés. Si l'URL cesse de répondre, le bloc image disparaît de
lui-même.

---

## Changer le mot de passe

Le mot de passe apparaît à deux endroits : dans `.env.local` (le mot de passe
lui-même, jamais commité) et dans `site.config.mjs` (seulement son empreinte
SHA-256, inoffensive). Les deux doivent rester cohérents.

```bash
# 1. Modifier .env.local
#    SITE_PASSWORD=le-nouveau-mot-de-passe

# 2. Obtenir la nouvelle empreinte
npm run hash

# 3. Recopier l'empreinte affichée dans site.config.mjs, champ motDePasseHash

# 4. Republier : le contenu est rechiffré avec la nouvelle clé
npm run deploy
```

> Tant que l'étape 4 n'est pas faite, le site en ligne reste chiffré avec
> l'ancien mot de passe. Le build vous en avertit : il refuse de démarrer si
> `.env.local` et `site.config.mjs` ne concordent pas.

Après un changement, chaque appareil redemandera le mot de passe une fois.

---

## Comment fonctionne la protection

GitHub Pages ne permet aucune vérification côté serveur : tout fichier publié
est accessible à qui connaît l'URL. Un simple écran de connexion en JavaScript
ne protégerait rien — le contenu serait déjà dans la page. D'où deux
mécanismes **complémentaires** :

**1. L'écran de connexion.** Le mot de passe saisi est haché en SHA-256
(API Web Crypto) et comparé à l'empreinte de `site.config.mjs`. Cela donne un
message d'erreur clair et immédiat, mais ne protège rien à soi seul.

**2. Le chiffrement du contenu (la vraie protection).** À la construction,
chaque fiche, le glossaire, l'index de recherche et jusqu'à la table des
matières sont chiffrés en **AES-GCM 256 bits**. La clé est dérivée du mot de
passe par **PBKDF2-HMAC-SHA256, 600 000 itérations**, avec un sel aléatoire
régénéré à chaque publication. Les fichiers publiés ne contiennent que du texte
chiffré : ni les titres des fiches, ni les noms des matières n'y sont lisibles.
Une personne qui devine l'URL et inspecte le code source ne voit rien
d'exploitable.

Le navigateur redérive la même clé après la saisie du mot de passe et déchiffre
à la volée, **en mémoire uniquement**.

Un garde-fou automatique relit les fichiers produits à chaque build et
**interrompt la publication** si un titre de fiche y apparaît en clair.

**Non-indexation :** `robots.txt` interdit tous les robots, et chaque page porte
`<meta name="robots" content="noindex, nofollow, noarchive">`. Ne soumettez pas
le site à Google Search Console.

### Ce que cette protection ne couvre pas

- Si quelqu'un obtient votre mot de passe, il obtient tout le contenu.
- Une fois déchiffré dans votre navigateur, le contenu est dans la mémoire de
  votre appareil : la protection vise l'hébergement public, pas un accès
  physique à votre machine.
- L'option « rester connecté » conserve la clé dérivée dans le stockage local
  du navigateur, pour éviter de retaper le mot de passe. Sur un appareil
  partagé, décochez-la — ou utilisez le cadenas 🔒 en haut à droite, qui efface
  la clé et le contenu déchiffré.

---

## Sauvegarder et synchroniser la progression

XP, niveaux, série de jours, badges, échéances de répétition espacée, résultats
de quiz et temps passé sont enregistrés **dans le navigateur** (IndexedDB).
Ils ne sont liés ni à un compte ni à un serveur.

**Ce sont deux besoins différents, et deux mécanismes différents.** Les
confondre est ce qui a produit, pendant un temps, trois procédés concurrents
pour le même geste.

### Mettre à l'abri : la sauvegarde `.cyclades`

`/progression/` → **Sauvegarder**. Le fichier est **compressé puis chiffré**
avec le mot de passe du site, fabriqué dans le navigateur et téléchargé — rien
n'est envoyé. Il ne perd aucun champ, et c'est le seul format à pouvoir le
promettre.

- La page affiche l'**ancienneté** de la dernière sauvegarde et le dit quand
  elle vieillit.
- Un **instantané de sécurité** est pris automatiquement avant toute fusion et
  avant toute migration de schéma ; il s'annule pendant sept jours.
- La restauration n'a **qu'un mode** : elle efface la progression de ce
  navigateur, puis restaure. *Fusionner* n'existe pas pour la sauvegarde
  complète — [`docs/cyclades/sauvegarde.md`](docs/cyclades/sauvegarde.md) dit
  pourquoi, et c'est `/appareils/` qui fusionne.

> Rangez le fichier **ailleurs que sur l'appareil qu'il protège**. Une
> sauvegarde posée à côté de ce qu'elle sauvegarde ne protège de rien.

### Passer d'un appareil à l'autre : `/appareils/`

**Ajouter un téléphone** : un QR visé une fois depuis `/apparier/`, et les
échanges suivants tiennent en un bouton. L'appairage est mémorisé, le
chiffrement est de bout en bout, et le relais ne voit que des messages de mise
en relation — `/apparier/` porte une section « Ce que voit le relais, et ce
qu'il ne voit pas ».

Quatre transports, du plus court au plus sûr : **liaison directe** (WebRTC
après QR), **deux QR** sans aucun relais, **dossier partagé**, et **transfert
de fichier**, qui marche sans réseau et reste le recours quand le reste
échoue.

Sur un **ordinateur certifié** — et il l'est par défaut dès qu'il est apparié
et que le mot de passe est en mémoire —, la synchronisation se fait **sans
geste** tant
qu'un onglet de Cyclades est ouvert et que l'autre appareil l'est aussi : à
l'ouverture, au retour au premier plan, au retour du réseau, après une
écriture (regroupée), et par un battement de cinq minutes. L'écran reste
allumé le temps de l'échange. Onglet fermé ou machine éteinte, rien ne se
passe : un site statique ne peut pas tourner tout seul.

### Ce qui n'existe plus

L'**export JSON** a été retiré. Cyclades n'en produit plus : la sauvegarde
`.cyclades` le remplace pour l'archivage, `/appareils/` pour le passage d'un
appareil à l'autre. L'**import** d'un ancien `.json` reste disponible sur
`/progression/` — on cesse d'en fabriquer, on ne cesse pas de savoir les
relire.

### Réinitialiser

`/progression/` → **Réinitialiser** efface toute la progression de ce
navigateur. Les fiches ne sont pas touchées. `/stockage/` permet un effacement
**ciblé**, magasin par magasin, et affiche ce que chacun pèse.

---

## Mon profil, l'export vers une IA, l'import d'une analyse

Trois écrans permettent de faire relire votre pratique par l'IA de votre choix
**sans que le site n'appelle jamais de modèle** : vous téléchargez un dossier,
vous le confiez à qui vous voulez, vous rapportez la réponse. Aucune connexion
sortante, aucune clé d'API, aucun coût.

| Écran | Ce qu'il fait |
|---|---|
| **Mon profil** (`/profil/`) | Quinze écrans, une question par écran, puis les réglages que Cyclades déduit de l'usage observé |
| **Synthèses** (`/syntheses/`) | Les quinze indicateurs calculés sur une période, et la comparaison avec la précédente |
| **Exporter pour une IA** (`/exporter-ia/`) | Construit le dossier à confier au modèle, après aperçu |
| **Importer une analyse** (`/importer-analyse/`) | Relit la réponse, revérifie chaque chiffre cité, vous laisse trier |

### Mon profil

L'initialisation ne se fait pas d'un bloc : chaque question tient sur un écran,
et « Terminer maintenant » est disponible partout — un report est enregistré,
pas une réponse vide. Un profil restauré depuis une sauvegarde n'est jamais
redemandé.

Ensuite Cyclades **observe** huit semaines d'usage et en déduit huit réglages
(moment des séances, volume quotidien, bascule du jour logique…). Chaque
réglage affiche sa cause. Quand l'usage s'écarte durablement de ce que vous
avez déclaré, l'écran **propose** un ajustement : vous acceptez, vous reportez,
ou vous refusez — et un refus se respecte.

### Exporter pour une IA

Période, catégories, pseudonyme, aperçu. Les catégories sensibles (corps,
psyché, finances) sont **décochées par défaut** et les cocher demande une
confirmation à part ; votre prénom et votre nom ne partent jamais, et un
contrôle les cherche dans tous les fichiers avant l'écriture. Neuf fichiers
sortent, dont le schéma strict de la réponse attendue. Chaque export est
inscrit au journal — identifiant, empreinte, périmètre, poids, **jamais le
contenu** — et seulement après téléchargement.

### Importer une analyse

Vous collez la réponse du modèle. Cyclades la valide contre le schéma (un
prompt de réparation est proposé si elle ne passe pas), puis **recalcule
lui-même chaque chiffre que l'IA cite** : confirmé, approché, faux, ou non
vérifiable — un chiffre devenu incalculable après compaction n'est jamais
compté comme une invention. Vous gardez ce que vous voulez, trajectoire par
trajectoire, et un avertissement professionnel s'affiche dès que le domaine
touche au corps, à la psyché ou aux finances, que l'IA l'ait signalé ou non.

> Le guide détaillé des trois écrans : [`docs/cyclades/profil-ia/guide.md`](docs/cyclades/profil-ia/guide.md).

---

## Odyssée : le pilotage de la vie

La branche **Odyssée** (`/odyssee/`) tient l'agenda, les tâches, les habitudes
et la revue du soir. Six écrans :

| Écran | Ce qu'il fait |
|---|---|
| **Tableau de bord** (`/odyssee/`) | La roue des domaines, les suggestions du jour, le minuteur de focus, et l'indicateur du plan tenu |
| **Mon calendrier** (`/odyssee/calendrier/`) | Les événements, l'import et l'export `.ics` |
| **Mes tâches** (`/odyssee/taches/`) | La liste, les échéances, l'abandon motivé |
| **Mes quêtes** (`/odyssee/quetes/`) | Les habitudes, leur frise de quatorze jours, la mise en pause |
| **Revue du soir** (`/odyssee/revue/`) | Le relevé d'abord, puis trois questions |
| **Mon corps** (`/odyssee/corps/`) | Pesées, mesures, sommeil, repas, boissons, santé |
| **Mes tendances** (`/odyssee/tendances/`) | La revue de cinq minutes, les bilans, les pistes, les trajectoires |
| **Mes synthèses** (`/syntheses/`) | Les indicateurs par période, écran commun aux branches |

**Le relevé est ce qui distingue Odyssée d'un agenda.** À la revue du soir, on
dit de chaque élément planifié s'il a eu lieu — fait, partiellement, pas fait —
et **pourquoi**, parmi dix motifs fermés. Trois conséquences :

- l'indicateur « plan tenu » existe, et il vaut `null` tant que rien n'est
  relevé : une absence de relevé n'est pas un zéro ;
- une **cause dominante** se calcule, parce que la liste de motifs est fermée.
  Un champ libre n'aurait produit que des phrases ;
- un créneau d'agenda déclaré fait devient un fait **confirmé**, un créneau
  déclaré non fait n'est pas publié du tout, et seul l'élément non relevé reste
  une supposition. Sans le relevé, tout créneau était publié « estimé », faute
  de mieux.

Les domaines **en pause se taisent**, suggestions comprises : mettre un domaine
en pause et continuer d'en recevoir des rappels n'aurait aucun sens.

**Les tendances sont des pistes, jamais des causes.** Les données d'ici sont
observationnelles : rien n'y distingue « mieux dormir fait mieux réviser » de
« les jours calmes permettent les deux ». Une piste n'apparaît donc qu'au-delà
de **vingt jours appariés**, avec un lien d'au moins 0,3, un intervalle de
confiance qui ne contient pas zéro, et après correction des comparaisons
multiples — le nombre de croisements testés est affiché, parce qu'une piste
retenue parmi quarante-cinq ne se lit pas comme une piste retenue parmi deux.
Chaque piste porte sa **réserve** à côté de son énoncé, et un contrôle relit
les phrases affichées pour y refuser tout mot de causalité.

Ce qui est **écarté** est montré avec son motif. Un écran vide se lit « rien à
voir » ; le vrai message est presque toujours « pas encore assez de données »,
et les deux appellent des conduites opposées.

**Trois trajectoires au plus**, et c'est un refus d'écriture, pas un
avertissement. Une trajectoire écartée ne vous est plus proposée.

---

## Sport : la musculation et le cardio

La branche **Sport** (`/sport/`) tient le carnet d'entraînement. Six écrans :

| Écran | Ce qu'il fait |
|---|---|
| **Tableau de bord** (`/sport/`) | Les quatre dernières semaines, le volume par muscle, les blessures ouvertes |
| **Ma séance** (`/sport/seance/`) | La saisie série par série, le minuteur de repos réel, le Wake Lock |
| **Mes exercices** (`/sport/exercices/`) | La bibliothèque, et le schéma du corps |
| **Mes programmes** (`/sport/programmes/`) | Les séances types, et le volume prévu contre réalisé |
| **Mon suivi de la force** (`/sport/force/`) | La courbe des maximums estimés, les phases, le plateau |
| **Mon corps** (`/sport/corps/`) | Les phases d'entraînement, et les douleurs déclarées |

Trois choses méritent d'être sues avant d'utiliser la branche.

**Une séance interrompue se reprend sans perte.** Chaque série est écrite dès
qu'elle est saisie, et la séance en cours est retrouvée au rechargement. Le
repos enregistré est le temps **réellement** écoulé, relu sur l'horloge, et le
compteur continue au-delà de la cible : un minuteur qui s'arrêterait à sa
consigne enregistrerait sa consigne.

**Les charges du suivi de force sont estimées, jamais soulevées.** Elles
viennent des formules d'Epley et de Brzycki ; au-delà de dix répétitions, les
deux divergent et le point devient un cercle creux sur la courbe, marqué
« approximative » dans le tableau. L'échelle du graphique ne part pas de zéro,
et la légende le dit.

**Une douleur déclarée empêche toute proposition de progresser** sur les
muscles concernés, et aucun réglage ne le désactive. Une blessure sans muscle
coché est générale : elle couvre tout. Pour le reste, Sport propose, vous
disposez — et un refus n'est retenu que dans le stockage local de l'appareil,
hors de la synchronisation, de la sauvegarde et de l'export : il sert à se
taire quelque temps, jamais à tenir un compte.

Le schéma du corps est **dessiné nativement** et doublé d'une liste de cases
toujours affichée. Les deux écrivent la même chose, dans les deux sens : un
tracé SVG n'est pas lisible au lecteur d'écran, et la liste n'est donc pas un
repli mais l'autre moitié de la même donnée.

---

## Cog-Training : Quad N-Back, Relational Reasoning et Veridical Mapping

La rubrique **Cog-Training** (`/cog-training/`) réunit des exercices
indépendants du programme du concours. L'ancienne adresse `/entrainement/`
redirige vers elle.

| Exercice | Adresse | Aptitude travaillée |
|---|---|---|
| **Quad N-Back** | `/cog-training/quad-n-back/` | Mémoire de travail |
| **Relational Reasoning** | `/cog-training/relational-reasoning/` | Raisonnement relationnel |
| **Veridical Mapping** | `/cog-training/veridical-mapping/` | Correspondance perceptive |

Aucun ne contient de données du concours : ils ne sont pas chiffrés, mais
restent derrière l'écran de connexion. Contrairement à l'exercice Syllogismes
qu'il remplace, Relational Reasoning est écrit dans le site : il n'y a plus de
sous-site statique atteignable par son adresse, et plus de seconde chaîne de
build.

> **Ce que le retrait de Syllogismes a changé.** L'exercice était une adaptation
> française de Syllogimous v4, vendorisée dans `apps/syllogismes/` avec sa propre
> chaîne Angular et affichée dans une `<iframe>`. Son retrait supprime 52 626
> lignes de code tierce, 730 Mo de dépendances, deux scripts npm et le pont de
> thème `postMessage` — et referme la dernière brèche d'étanchéité du site, le
> sous-site `/syllogismes/` étant atteignable directement alors que seule la page
> qui l'englobait était derrière l'écran de connexion. Le code reste dans
> l'historique Git si vous souhaitez y revenir.

### Relational Reasoning — deux couches

L'exercice sépare **systèmes** et **moteurs**. Un système est un module de
données : un ensemble d'entités, un vocabulaire de relations, et la table qui dit
comment deux relations se composent. Un moteur est un générateur d'exercice qui
reçoit un système en paramètre. Ajouter un système donne donc des exercices dans
tous les moteurs compatibles, sans écrire de moteur ; ajouter un moteur le rend
disponible sur tous les systèmes de son régime.

Les fichiers vivent dans `src/features/relational-reasoning/` :

```
systemes/      # un module par système : line, plane, groups, …
moteurs/       # un module par moteur d'exercice
noyaux/        # les solveurs partagés (cohérence de chemin, isomorphisme, …)
composants/    # l'interface Svelte de la session
```

**Trois régimes d'inférence** se partagent les systèmes, et un moteur ne
fonctionne que dans le sien :

| Régime | Systèmes | Inférence |
|---|---|---|
| Algèbre de relations | `line`, `grandeur`, `rang`, `anneau`, `poset`, `cyclic`, `groups`, `rcc8`, `allen`, `classes` ; `plane`, `plan-temps` et `space` comme produits d'axes | cohérence de chemin sur la table de composition |
| Monde clos | `digraph`, prédicats d'adjacence, `poset` en mode clos | requêtes de graphe, négation par échec |
| Transformations | `plane`, `plan-temps`, `space`, `groups` | application de fonctions, composition non commutative |

Quinze systèmes et dix-neuf moteurs, soit **199 couples praticables**. Chaque
système doit figurer dans un palier de `PALIERS_SYSTEMES`, sans quoi il ne sera
jamais tiré : `systemesSansPalier()` et un essai l'imposent.

`digraph` n'a **pas** de table de composition : « supervise » n'est ni
transitive ni composable, et l'absence d'arête y est une négation, non une
inconnue. Les moteurs qui reposent sur l'indétermination ne peuvent donc pas
tourner dessus — le sélecteur de l'interface ne les propose pas ensemble.

### Progression : par famille, et par exercice

Les moteurs sont rangés en **six familles**. **Chaque famille s'ouvre par un
exercice** ; les autres se débloquent quand celui-là est maîtrisé — douze items
joués et 75 % de réussite sur les vingt derniers. L'induction est ouverte
d'emblée. **Chaque exercice monte ensuite sa propre échelle** : trois réponses
exactes d'affilée le font monter d'un cran, deux fautes consécutives le font
redescendre, une réponse partielle maintient. Deux items de la même session
peuvent donc être de niveaux très différents.

**Sauf pour les moteurs à peu d'options**, qui déclarent une règle à fenêtre.
Trois réussites d'affilée sur une réponse à deux options arrivent une fois sur
huit par pur hasard, et deux fautes de suite une fois sur quatre : l'échelle
monterait et descendrait au bruit. Les trois moteurs de la famille *Chaînes de
prémisses* exigent donc **sept réussites sur huit** pour monter, et redescendent
à quatre réussites ou moins sur huit. La fenêtre se vide à chaque changement
d'échelon.

Rien de tout cela n'est stocké : l'échelon et les déblocages se **recalculent**
depuis l'historique des items, à chaque ouverture de l'exercice. Une valeur
mémorisée se désynchroniserait d'un import de sauvegarde ; un rejeu se refait.

Les systèmes, eux, apparaissent par paliers sur un compteur global — ligne, plan
et équipes d'abord, puis réseaux dirigés et ordres partiels, puis espace et
cycles, puis régions et intervalles. C'est le seul compteur resté général, parce
qu'il porte sur le vocabulaire et non sur les exercices.

### Le barème crédite l'incertitude

Sur les exercices à sélection multiple, une case juste rapporte et une case
fausse retire autant, le tout rapporté au nombre de bonnes réponses. Une réponse
partielle vaut donc plus qu'une erreur et moins qu'une réponse exacte, et
**tout cocher ne rapporte rien** — les générateurs garantissent qu'il y a au
moins autant de leurres que de bonnes réponses, et `npm run essais:relationnel`
le vérifie sur chaque item engendré. C'est la contrepartie du principe selon
lequel « ça pourrait être l'un ou l'autre » est une réponse légitime : si
l'indétermination est une réponse, la deviner ne doit pas payer.

### Vérification

```bash
npm run essais:relationnel
```

Contrôle les tables de composition, la propagation, la détection d'incohérence,
le barème, l'échelle de difficulté, puis deux cents items par couple exercice ×
système. Les items sont validés **tels qu'ils s'affichent** — l'énoncé est
reparsé et reclassé — et non sur la foi des étiquettes internes du générateur :
c'est ce contrôle qui a pris le seul vrai défaut de la première version, un
énoncé dont la réponse cochée était introuvable.

Le détail du découpage et les décisions de conception figurent dans `PLAN.md`,
phase 8.

### Veridical Mapping — seuils et comparabilité

L'exercice mesure, pour chaque **paire de dimensions perceptives**, le plus petit
écart encore distingué. Une référence est montrée sur une dimension, deux
candidats sur l'autre, dont un seul est au même niveau relatif : après deux
réussites l'écart se resserre, après une erreur il s'élargit. C'est une procédure
**2-down-1-up**, qui converge vers le point où l'on réussit 70,7 % des essais.

**La normalisation est dans le jeu de stimuli, pas dans le score.** Chaque
dimension découpe sa plage en cent vingt pas perceptivement réguliers — géométriques
là où la loi de Weber s'applique au stimulus physique (taille, durée, fréquence),
linéaires là où l'échelle est déjà perceptive (décibels, clarté L*, degrés de
teinte). Un seuil exprimé en pas est donc sans unité, et sept pas de taille se
comparent directement à sept pas d'intensité sonore.

Les deux sens de chaque paire sont suivis séparément : c'est la façon la plus
directe de mesurer la **bidirectionnalité**, taille → intensité et
intensité → taille se lisant côte à côte dans la matrice du hub.

La règle de Stevens — on ne relie que deux dimensions de la même famille — est le
réglage par défaut et non une impossibilité câblée. Elle écarte en effet
précisément hauteur ↔ taille et hauteur ↔ luminosité, parmi les correspondances
transmodales les mieux répliquées de la littérature. Un interrupteur les ouvre, et
le tableau de bord les suit à part.

```bash
npm run essais:veridical
```

Vérifie les plages, le rebouclage de la teinte, le hub, l'arbre couvrant, puis
fait tourner l'escalier contre un **observateur simulé de seuil connu**. Une
procédure adaptative se relit mal : c'est en la faisant converger sur une valeur
qu'on a fixée d'avance qu'on sait si elle mesure ce qu'on croit.

### Quad N-Back

Le Quad N-Back est un exercice de mémoire de travail : quatre flux de
stimuli défilent en parallèle — position dans une grille 3×3×3, couleur, forme
et lettre prononcée. À chaque épreuve, il faut signaler les dimensions
identiques à celles vues *n* épreuves plus tôt.

### Utilisation

- **Réglages** : profondeur *n*, nombre d'épreuves, rythme, taux de
  correspondances, interférence, grille 3D ou 2D, et dimensions suivies
  (désactivez-en pour travailler en Dual ou Tri N-Back). Les valeurs par
  défaut sont celles de quad-box : 30 épreuves, 2,5 s, 25 % de
  correspondances, 20 % d'interférence.
- **Motifs** : la cinquième dimension « Motif » remplace la couleur et la
  forme par un dessin généré — **Voronoï** ou **art génératif**, au choix,
  comme dans le dépôt d'origine. Le vivier de motifs est régénéré à chaque
  partie, ce qui empêche de les apprendre par cœur. Activer Motif désactive
  Couleur et Forme, et réciproquement.
- **Touches personnalisables** : chaque dimension a sa touche (A, S, D, F par
  défaut). Cliquez sur « Touche : … » puis appuyez sur la touche voulue.
  Si elle sert déjà à une autre dimension, les deux sont échangées — aucune
  dimension ne peut se retrouver sans touche. `Échap` annule la saisie.
- **Tout au clavier** : `Entrée` lance une session, les touches configurées
  signalent les correspondances, `Échap` interrompt.
- **Retour immédiat** : chaque réponse est jugée sur-le-champ — bouton vert
  avec ✓ si la correspondance était réelle, rouge avec ✗ sinon. En fin
  d'épreuve, une correspondance qui n'a pas été signalée s'affiche en orange
  avec ⌛ pendant une demi-seconde. Les états et leurs couleurs sont ceux de
  quad-box. Le retour se désactive dans les réglages, pour s'entraîner en
  conditions d'examen.
- **Recommencer** : le bouton « ↻ » de l'en-tête abandonne la partie en cours
  et en relance aussitôt une autre avec les mêmes réglages, sans repasser par
  le bilan ni par les réglages. La séquence de stimuli est régénérée — c'est
  une nouvelle partie, pas une reprise — et la partie abandonnée n'est pas
  enregistrée.
- **Amorçage** : les *n* premières épreuves n'ont rien à quoi se comparer.
  Elles sont signalées comme telles et les réponses qu'on y donne ne comptent
  pas — c'est aussi le comportement du dépôt d'origine.
### Progression automatique du niveau

Mécanisme repris de quad-box, avec ses réglages :

- **Monter** : par défaut **1 partie** à **80 %** ou plus.
- **Descendre** : par défaut **3 parties consécutives** sous **50 %** — une
  mauvaise session isolée ne fait donc pas reculer.
- Seules sont comparées les parties des **48 dernières heures**, dans le
  **même mode** et au **même niveau** : passer de Dual à Quad ne fait pas
  monter, et changer de niveau ne recompte pas les parties précédentes.
- Chaque changement de niveau pose un **jalon** dans l'historique, qui borne
  les parties prises en compte par la décision suivante.
- Le niveau est plafonné à *n* = 12, comme dans le dépôt d'origine.

Les quatre seuils sont réglables dans l'écran de réglages, et la progression
automatique peut être désactivée.

### Comment le score est calculé

Barème de quad-box. Seules les décisions engageantes comptent :

- **réussite** : une correspondance signalée à temps ;
- **échec** : une fausse alerte, ou une correspondance manquée.

Ne rien signaler quand il n'y avait rien à signaler n'entre pas dans le calcul.
Le taux vaut donc réussites / (réussites + échecs). Rester passif donne **0 %**,
et tout signaler s'effondre aussi puisque chaque pression injustifiée est un
échec. C'est le barème auquel les seuils de 80 % et 50 % sont calibrés.

### Intégration au reste du site

- Les sessions sont enregistrées dans la **même base IndexedDB** que le reste
  de la progression, et incluses dans l'export/import JSON.
- Elles rapportent de l'XP et débloquent des badges dédiés (« Premier Quad
  N-Back », « Niveau 3 atteint »…), et alimentent **la même série de jours**
  que les fiches et les flashcards — il n'y a pas deux systèmes de streak.
- Une session interrompue n'est pas enregistrée.
- Le code du jeu et ses sons ne sont chargés **que sur cette page** : les
  autres pages du site n'en téléchargent rien.
- L'exercice ne contient aucune donnée du concours : il n'est donc pas chiffré,
  mais reste derrière l'écran de connexion comme le reste du site.

### Chaînes de prémisses : attribution

Les trois moteurs de la famille *Chaînes de prémisses* — conclusion d'une
chaîne, syllogisme, conclusion composée — s'inspirent des **mécaniques** de
[Syllogimous v4](https://github.com/4skinSkywalker/Syllogimous-v4), de
**4skinSkywalker**, diffusé sous licence
[CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/).

> **Aucun code d'origine n'est embarqué.** Le dépôt a été lu pour comprendre ses
> douze types de questions et leurs réglages, puis les moteurs ont été écrits de
> première main dans la pile du site. Il n'y a **aucune dépendance Angular,
> Bootstrap ou ng-bootstrap**, aucune `<iframe>`, aucun sous-dossier vendorisé :
> les énoncés sont rédigés en français, les relations viennent des systèmes
> existants, et la progression est celle du site.
>
> Les mécaniques ont par ailleurs été **modifiées** sur un point de fond : le
> format d'origine répond par vrai ou faux, ce qui n'est exact que sur un système
> dont la composition est fonctionnelle. Partout ailleurs un troisième verdict —
> « reste ouvert » — a été ajouté, faute de quoi l'exercice enseignerait à
> conclure de ce qu'on ignore.
>
> Usage **strictement non commercial**, ce que la nature de ce site personnel
> respecte. À reconsidérer si cet usage devait changer.

### Origine du code et licence

La logique de génération des stimuli et le principe du rendu 3D sont repris du
projet **quad-box** :

> https://github.com/scottshadow56/quad-box (fork de `soamsy/quad-box`)
> Licence **MIT** — Copyright (c) 2025 The Quad Box Project Contributors

Le texte complet de la licence est conservé dans
`src/features/quad-n-back/LICENCE-quad-box.txt`, et chaque fichier portant du
code repris le mentionne en en-tête, comme la licence MIT l'exige.

Adaptations par rapport au dépôt d'origine :

Repris à l'identique : les tracés SVG des neuf formes, les deux palettes de
huit couleurs, la règle d'affectation des couleurs (face claire + forme
colorée), la génération des stimuli, les deux générateurs de motifs (Voronoï
et art génératif) et le mécanisme de progression automatique.

| Élément | quad-box | Ici |
|---|---|---|
| Interface | daisyui | Tailwind, au style du site |
| Stockage | base IndexedDB séparée | base commune du site |
| Audio | `howler` | API `Audio` native (une dépendance de moins) |
| Sons embarqués | 6 jeux, 6,3 Mo | 1 jeu de lettres, 196 Ko |
| Graphiques | `chart.js`, `d3` complet | page « Statistiques » du site |
| Régularité | `@mariohamann/activity-graph` | calendrier déjà présent au tableau de bord |
| Modes | tally, N variable | les cinq dimensions et les motifs |

Les seules dépendances ajoutées sont `svelte`, `d3-delaunay` (motifs de
Voronoï) et `d3-shape` (art génératif) — les deux modules précis dont les
générateurs ont besoin, pas l'ensemble de `d3`. Les autres retraits évitent
d'embarquer des bibliothèques pour des fonctions que le site assure déjà.

## Les guides

Le README dit comment faire tourner Cyclades. Ces documents disent comment
l'étendre et comment le défaire.

| Document | Quand l'ouvrir |
|---|---|
| [`docs/ajouter-une-branche.md`](docs/ajouter-une-branche.md) | ajouter un domaine d'usage entier (après Révisions, Odyssée et Sport) |
| [`docs/ajouter-un-parcours.md`](docs/ajouter-un-parcours.md) | préparer un concours de plus |
| [`docs/retour-arriere.md`](docs/retour-arriere.md) | défaire une publication, une migration, un mot de passe, une actualité |
| [`docs/routines-actualites.md`](docs/routines-actualites.md) | la rubrique Actualités, ses quatre routines et leur coût récurrent |
| [`docs/cyclades/sauvegarde.md`](docs/cyclades/sauvegarde.md) | le format `.cyclades` et pourquoi il ne fusionne pas |

---

## Organisation du projet

```
.
├── content/                 # VOS FICHES EN CLAIR + scripts parlés + audio + banque QCM — jamais commité
├── content-exemple/         # Exemples fournis, copiés par « npm run init:contenu »
├── actualites-data/         # Rubrique Actualités — entrées chiffrées + clé publique
├── docs/                    # Guides : routines de veille, ajout d'une branche, retour arrière
├── outils/                  # Modèles de synthèse vocale — jamais commité
├── .env.local               # VOTRE MOT DE PASSE — jamais commité
├── site.config.mjs          # Réglages : mot de passe (empreinte), base, XP, glossaire
│
├── scripts/
│   ├── build-content.mjs    # Valide, transforme en HTML et chiffre le contenu
│   ├── deploy.mjs           # Reconstruit et publie la branche gh-pages
│   ├── hash.mjs             # Calcule l'empreinte SHA-256 d'un mot de passe
│   ├── init-contenu.mjs     # Crée content/ à partir des exemples
│   ├── actualites-cles.mjs  # Crée la paire de clés de la rubrique Actualités
│   ├── actualites-local.mjs # Actualités de démonstration pour le mode dev
│   ├── chiffrer-actualite.mjs   # Chiffre une actualité (veille hebdomadaire)
│   ├── dechiffrer-actualite.mjs # Relit une actualité (synthèses périodiques)
│   ├── podcasts.mjs         # Scripts parlés + synthèse vocale des fiches audio
│   ├── synthese-voix.py     # Synthèse (Kokoro ou Piper) et encodage MP3
│   ├── installer-voix.mjs   # Installe le moteur et la voix française
│   └── lib/
│       ├── schema.mjs       # Validation du format des fiches (Zod)
│       ├── markdown.mjs     # Découpage en sections et rendu HTML
│       ├── glossaire.mjs    # Détection automatique des termes (plugin remark)
│       ├── podcast.mjs      # Réécriture d'un cours en script parlé
│       ├── voix.mjs         # Moteurs de synthèse et emplacement des modèles
│       ├── crypto.mjs       # PBKDF2 + AES-GCM côté build
│       ├── secret.mjs       # Chiffrement d'un secret par mot de passe
│       └── motdepasse.mjs   # Lecture du mot de passe (env ou .env.local)
│
├── src/
│   ├── features/
│   │   └── quad-n-back/     # Exercice de mémoire de travail (code Svelte)
│   │       ├── moteur/      # Stimuli, score, progression, audio, motifs
│   │       ├── composants/  # Grille 3D, cellule, écrans de jeu
│   │       └── LICENCE-quad-box.txt
│   ├── pages/               # Une page par écran du site
│   ├── layouts/Base.astro   # En-tête, navigation, thème
│   ├── components/Verrou.astro  # Écran de connexion
│   ├── styles/global.css    # Tailwind + styles du glossaire et des cours
│   └── lib/
│       ├── crypto.ts        # Déchiffrement côté navigateur
│       ├── podcast.ts       # Lecteur de fiche audio (déchiffrement à la demande)
│       ├── auth.ts          # Session et gestion de la clé
│       ├── contenu.ts       # Chargement et cache du contenu déchiffré
│       ├── db.ts            # IndexedDB : progression, export/import
│       ├── srs.ts           # Répétition espacée (FSRS)
│       ├── qcm.ts           # Épreuves « QCM - DGFiP » : tirage, barème, score
│       ├── gamification.ts  # XP, niveaux, série, badges
│       ├── agregats.ts      # Calculs de maîtrise et file du jour
│       ├── glossaire.ts     # Bulles de définition
│       ├── temps.ts         # Mesure du temps de révision
│       ├── actualites.ts    # Chargement et déchiffrement des actualités
│       ├── actualites-rendu.ts  # Fabrique les cartes d'actualité
│       ├── rattachement.ts  # Relie une actualité aux fiches de cours
│       ├── ui.ts            # Utilitaires d'affichage
│       │
│       ├── noyau/           # Règles pures, sans IndexedDB — testables avec tsx
│       │   ├── ulid.ts, hlc.ts, empreinte.ts      # Identité, horloge logique, état
│       │   ├── operations.ts, fusion.ts           # Journal d'opérations et fusion
│       │   ├── jour-logique.ts, faits.ts          # Jour à 4 h, faits de domaine typés
│       │   ├── profil.ts, initialisation.ts       # Profil journalisé, questions d'entrée
│       │   ├── observation.ts, reglages.ts        # Usage observé, réglages déduits
│       │   ├── adaptation.ts                      # Propositions d'ajustement et refus
│       │   ├── schema-analyse.ts                  # Format strict de la réponse de l'IA
│       │   ├── validateur-analyse.ts              # Validation et prompt de réparation
│       │   ├── verification.ts                    # Recalcul des chiffres cités
│       │   └── avertissements.ts                  # Garde-fou des domaines sensibles
│       │
│       ├── odyssee/         # Pilotage de la vie, et lecture transversale
│       │   ├── activite.ts, desaccords.ts         # XP/niveau/série, divergences
│       │   ├── indicateurs.ts, syntheses.ts       # Les 15 indicateurs, les périodes
│       │   ├── fiabilite.ts                       # Couverture et lacunes
│       │   ├── export-ia.ts                       # Les neuf fichiers de l'export
│       │   ├── modele.ts, donnees.ts              # Tâches, quêtes, événements, relevé
│       │   ├── jour.ts                            # Roue du jour, règles, plan tenu
│       │   ├── ics.ts                             # Import et export de calendrier
│       │   └── faits-odyssee.ts                   # Projection vers les faits
│       │
│       └── sport/           # Musculation et cardio
│           ├── modele.ts                          # 18 muscles, exercices, séries, séances
│           ├── schema-corps.ts                    # Le dessin, déclaré comme une donnée
│           ├── force.ts                           # Epley, Brzycki, courbe, plateau
│           ├── programmes.ts                      # Séances types, volume prévu/réalisé
│           ├── modulation.ts                      # Propositions, et le garde-fou
│           ├── refus-locaux.ts                    # Les refus, hors de toute sauvegarde
│           ├── donnees.ts                         # Magasins et bibliothèque livrée
│           └── faits-sport.ts                     # Projection vers les faits
│
└── public/                  # Fichiers copiés tels quels (robots.txt, favicon)
    ├── data/                # Contenu chiffré produit par le build — non commité
    └── actualites-data/     # Démonstration locale (npm run actualites:local) — non commité
```

### Note sur la validation du contenu

Astro propose des *content collections* pour valider du Markdown. Ce projet
utilise plutôt Zod directement dans le script de build : une content collection
exposerait le contenu au moteur de rendu d'Astro, avec le risque qu'un fragment
en clair se retrouve dans `dist/`. La validation et la reconstruction de la
hiérarchie sont identiques, mais **le contenu en clair ne traverse jamais
Astro**.

---

## Ajouter un nouveau format de contenu

L'architecture prévoit d'accueillir d'autres formats (cas pratiques, notes de
synthèse annotées…) sans réécriture. Les points à toucher :

1. `scripts/lib/markdown.mjs` — ajouter le titre reconnu dans la table `SECTIONS` ;
2. `scripts/lib/schema.mjs` — décrire le format si la section est structurée ;
3. `scripts/build-content.mjs` — inclure la section dans la charge chiffrée ;
4. `src/lib/contenu.ts` — déclarer le champ dans l'interface `Fiche` ;
5. `src/pages/` — créer la page ou l'onglet correspondant.

---

## En cas de problème

**« Fichier .env.local introuvable »**
Créez-le : `cp .env.local.example .env.local`, puis renseignez votre mot de passe.

**« Le mot de passe de .env.local ne correspond pas à l'empreinte »**
Les deux sources ont divergé. Voir [Changer le mot de passe](#changer-le-mot-de-passe).

**« Dossier content/ introuvable »**
Lancez `npm run init:contenu`, puis remplacez les exemples par vos fiches.

**Le build signale une erreur dans une fiche**
Le message indique le fichier, la section et la nature du problème. Rien n'est
publié tant que ce n'est pas corrigé — c'est volontaire.

**Sur le site en ligne : « Le mot de passe est reconnu mais ne déchiffre pas le
contenu publié »**
Le site en ligne a été construit avec un autre mot de passe. Relancez
`npm run deploy`.

**« Ce contenu ne correspond pas à la clé de la session »**
Le navigateur a réutilisé un fichier mis en cache lors d'une publication
précédente. Chaque `npm run deploy` régénère un sel aléatoire et rechiffre
tout : un fichier ancien est illisible avec la nouvelle clé. Les URL du
contenu portent un numéro de publication pour éviter cela, mais la page HTML
elle-même peut rester en cache jusqu'à dix minutes — GitHub Pages ne permet
pas de régler les en-têtes. Un rechargement forcé (`Ctrl+Maj+R`, ou `Cmd+Maj+R`
sur Mac) résout le cas immédiatement.

**Juste après un déploiement, le site s'affiche sans aucun style**
Même cause : une page HTML en cache référence des fichiers de style de la
publication précédente, qui n'existent plus. Rechargement forcé, ou attendre
une dizaine de minutes.

**La page reste bloquée sur « Déchiffrement du contenu… », ou le site s'affiche
sans style**
Dans les deux cas, `base` dans `site.config.mjs` ne correspond pas à l'adresse
publique réelle : les fichiers chiffrés sont cherchés à `<base>/data/` et les
styles à `<base>/_astro/`. Reportez-vous au tableau de la section
« Publier sur GitHub Pages ».

**Je tape `<nom>.github.io` et je tombe sur une page 404 de GitHub**
Aucun compte ni organisation ne porte ce nom, ou le dépôt `<nom>.github.io`
ne lui appartient pas. Voir la règle de nommage ci-dessus.

**Les termes du glossaire ne sont pas soulignés**
Vérifiez que `content/glossaire.yml` existe (le build indique le nombre de
termes chargés) et que la forme employée dans le texte figure dans `formes`.

**J'ai perdu ma progression**
Restaurez votre dernière sauvegarde `.cyclades` depuis `/progression/` →
**Restaurer une sauvegarde** : elle remplace ce qu'il y a dans ce navigateur.
Si vous aviez un ancien export `.json`, il reste importable depuis la même
page, au choix en *Fusionner* ou en *Remplacer*. Si vous n'avez ni l'un ni l'autre, la progression n'est pas
récupérable : elle n'existait que dans ce navigateur.

Avant d'y arriver : un **instantané de sécurité** est pris automatiquement
avant chaque fusion et chaque migration, et s'annule pendant sept jours depuis
`/appareils/`. Il ne remplace pas une sauvegarde — il vit dans le même
navigateur, et disparaît avec lui.
