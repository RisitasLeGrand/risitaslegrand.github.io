# Espace de révision personnel

Site de révision privé, chiffré, hébergé gratuitement sur GitHub Pages.
Cours, fiches de synthèse, flashcards à répétition espacée, quiz, glossaire
et suivi de progression — le tout dans le navigateur, sans serveur ni compte.

---

## Sommaire

1. [En bref](#en-bref)
2. [Installation](#installation)
3. [Déposer vos fiches](#déposer-vos-fiches)
4. [Format d'une fiche](#format-dune-fiche)
5. [Le glossaire](#le-glossaire)
6. [Travailler en local](#travailler-en-local)
7. [Publier sur GitHub Pages](#publier-sur-github-pages)
8. [La rubrique Actualités](#la-rubrique-actualités)
9. [Changer le mot de passe](#changer-le-mot-de-passe)
10. [Comment fonctionne la protection](#comment-fonctionne-la-protection)
11. [Sauvegarder et synchroniser la progression](#sauvegarder-et-synchroniser-la-progression)
12. [Cog-Training : Quad N-Back et Syllogismes](#cog-training--quad-n-back-et-syllogismes)
13. [Organisation du projet](#organisation-du-projet)
14. [En cas de problème](#en-cas-de-problème)

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
| `npm run syllogismes:install` | Installe les dépendances Angular de l'exercice Syllogismes (une fois) |
| `npm run syllogismes:build` | Construit l'exercice Syllogismes |

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
deux lignes `---`) et de quatre sections optionnelles.

```markdown
---
matiere: "Questions internationales"
fascicule: "Fascicule 3 — Enjeux globaux"
titre: "Pandémie et relations internationales"
ordre: 1
tags: [santé mondiale, gouvernance, OMS]
---

## Cours complet

Le texte de référence, en Markdown. Les sous-titres se notent `###`.

### I. Première partie

Du texte, des **listes**, des tableaux, des *italiques*…

## Fiche simplifiée

La version condensée, à relire rapidement.

## Flashcards

- q: "La question posée ?"
  r: "La réponse attendue."
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
```

### Détail des champs

| Champ | Obligatoire | Remarque |
|---|---|---|
| `matiere` | oui | Regroupement de premier niveau |
| `fascicule` | oui | Regroupement de deuxième niveau |
| `titre` | oui | Titre affiché de la fiche |
| `ordre` | non | Position dans le fascicule (défaut : 999) |
| `tags` | non | Mots-clés, utilisables comme filtres de recherche |

### Règles à connaître

- Les quatre titres reconnus sont `## Cours complet`, `## Fiche simplifiée`,
  `## Flashcards` et `## Quiz`. Un autre titre `##` est rattaché à la section
  en cours (utile pour un cours découpé en grandes parties).
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

Aucun secret GitHub Actions n'est nécessaire, et **le déploiement ne peut pas
être automatisé côté serveur** : le chiffrement exige le mot de passe en clair,
qui ne doit jamais quitter votre machine. C'est une conséquence assumée du
modèle de sécurité, pas une limitation technique.

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

Quatre routines programmées tiennent la rubrique à jour et ouvrent une pull
request à chaque passage : hebdomadaire (lundi matin), mensuelle (1er du mois),
trimestrielle (2 janvier, avril, juillet, octobre) et annuelle (6 janvier).
Les déclencheurs sont échelonnés parce que chaque niveau lit le niveau en
dessous. Une actualité n'apparaît en ligne qu'après **fusion de la pull request
et republication**. Voir `docs/routines-actualites.md`.

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
Ils ne sont liés ni à un compte ni à un serveur — et ne sont donc pas partagés
automatiquement entre vos appareils.

La page **Sauvegarde** permet de :

- **exporter** toute la progression dans un fichier `.json` ;
- **importer** ce fichier sur un autre appareil, en deux modes :
  - *Fusionner* — conserve, pour chaque carte, la révision la plus récente
    (à utiliser pour synchroniser ordinateur et téléphone) ;
  - *Remplacer* — écrase la progression locale (à utiliser pour restaurer) ;
- **réinitialiser** entièrement la progression.

> Pensez à exporter de temps en temps : vider les données du navigateur efface
> aussi la progression.

---

## Cog-Training : Quad N-Back et Syllogismes

La rubrique **Cog-Training** (`/cog-training/`) réunit deux exercices
indépendants du programme du concours. L'ancienne adresse `/entrainement/`
redirige vers elle.

| Exercice | Adresse | Aptitude travaillée |
|---|---|---|
| **Quad N-Back** | `/cog-training/quad-n-back/` | Mémoire de travail |
| **Syllogismes** | `/cog-training/syllogismes/` | Raisonnement déductif |

Aucun des deux ne contient de données du concours : ils ne sont pas chiffrés,
mais restent derrière l'écran de connexion.

### Syllogismes — construction et licence

L'exercice est une adaptation française de
[Syllogimous v4](https://github.com/4skinSkywalker/Syllogimous-v4), créé par
**4skinSkywalker** et distribué sous licence
[CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/) — attribution
obligatoire, **usage non commercial**. La seule modification apportée est la
traduction intégrale en français, y compris les modèles de phrases qui
engendrent les énoncés ; `apps/syllogismes/TRADUCTION.md` en détaille les
écarts, pour permettre une resynchronisation ultérieure avec le projet source.

Le code source est vendorisé dans `apps/syllogismes/` avec sa **propre chaîne
de build Angular**, indépendante d'Astro :

```bash
npm run syllogismes:install   # une seule fois — dépendances Angular (~500 Mo)
npm run syllogismes:build     # produit apps/syllogismes/dist/
npm run deploy                # publie le résultat à /syllogismes/
```

L'application a été expurgée de ses appels à des tiers : la balise Google
Analytics de l'auteur amont, le CDN Font Awesome et l'import Google Fonts ont
été retirés. **L'exercice n'émet plus aucune requête externe**, ce qui le met en
cohérence avec le reste du site. Le détail figure dans `TRADUCTION.md`.

Angular 15 se construit sans difficulté sur Node 20 ou 22. Le build produit un
sous-site statique servi à `/syllogismes/`, affiché dans une `<iframe>` par la
page Astro. `404.html` est une copie d'`index.html` pour que le routeur Angular
reprenne la main sur GitHub Pages.

> Pourquoi une iframe plutôt qu'un composant intégré : Angular n'a pas
> d'intégration Astro, et l'empaqueter en composant web natif imposerait
> d'isoler Zone.js et de cloisonner Bootstrap pour qu'il ne déborde pas sur
> Tailwind. Le coût dépasse le bénéfice tant que les résultats de séance ne
> remontent pas dans l'XP du site.
>
> Conséquence à connaître : `/syllogismes/` est un sous-site statique, donc
> accessible directement par son adresse. Seule la page qui l'englobe est
> derrière l'écran de connexion.

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

## Organisation du projet

```
.
├── content/                 # VOS FICHES EN CLAIR + clé privée — jamais commité
├── content-exemple/         # Exemples fournis, copiés par « npm run init:contenu »
├── actualites-data/         # Rubrique Actualités — entrées chiffrées + clé publique
├── apps/
│   └── syllogismes/         # Syllogimous v4 traduit (Angular, build indépendant)
├── docs/                    # Consignes des routines de veille
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
│   ├── build-syllogismes.mjs    # Construit l'exercice Syllogismes
│   └── lib/
│       ├── schema.mjs       # Validation du format des fiches (Zod)
│       ├── markdown.mjs     # Découpage en sections et rendu HTML
│       ├── glossaire.mjs    # Détection automatique des termes (plugin remark)
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
│       ├── auth.ts          # Session et gestion de la clé
│       ├── contenu.ts       # Chargement et cache du contenu déchiffré
│       ├── db.ts            # IndexedDB : progression, export/import
│       ├── srs.ts           # Répétition espacée (SM-2)
│       ├── gamification.ts  # XP, niveaux, série, badges
│       ├── agregats.ts      # Calculs de maîtrise et file du jour
│       ├── glossaire.ts     # Bulles de définition
│       ├── temps.ts         # Mesure du temps de révision
│       ├── actualites.ts    # Chargement et déchiffrement des actualités
│       ├── actualites-rendu.ts  # Fabrique les cartes d'actualité
│       ├── rattachement.ts  # Relie une actualité aux fiches de cours
│       └── ui.ts            # Utilitaires d'affichage
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
Réimportez votre dernier export JSON depuis la page *Sauvegarde*. Sans export,
la progression n'est pas récupérable : elle n'existait que dans ce navigateur.
