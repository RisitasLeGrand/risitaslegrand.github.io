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
8. [Changer le mot de passe](#changer-le-mot-de-passe)
9. [Comment fonctionne la protection](#comment-fonctionne-la-protection)
10. [Sauvegarder et synchroniser la progression](#sauvegarder-et-synchroniser-la-progression)
11. [Organisation du projet](#organisation-du-projet)
12. [En cas de problème](#en-cas-de-problème)

---

## En bref

Trois commandes suffisent au quotidien :

| Commande | Effet |
|---|---|
| `npm run dev` | Chiffre le contenu puis ouvre le site en local pour le tester |
| `npm run deploy` | Chiffre, construit et publie le site sur GitHub Pages |
| `npm run hash` | Affiche l'empreinte SHA-256 du mot de passe (voir plus bas) |

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
4. pousse `dist/` sur la branche `gh-pages`.

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

## Organisation du projet

```
.
├── content/                 # VOS FICHES EN CLAIR — jamais commité
├── content-exemple/         # Exemples fournis, copiés par « npm run init:contenu »
├── .env.local               # VOTRE MOT DE PASSE — jamais commité
├── site.config.mjs          # Réglages : mot de passe (empreinte), base, XP, glossaire
│
├── scripts/
│   ├── build-content.mjs    # Valide, transforme en HTML et chiffre le contenu
│   ├── deploy.mjs           # Publie dist/ sur la branche gh-pages
│   ├── hash.mjs             # Calcule l'empreinte SHA-256 d'un mot de passe
│   ├── init-contenu.mjs     # Crée content/ à partir des exemples
│   └── lib/
│       ├── schema.mjs       # Validation du format des fiches (Zod)
│       ├── markdown.mjs     # Découpage en sections et rendu HTML
│       ├── glossaire.mjs    # Détection automatique des termes (plugin remark)
│       └── crypto.mjs       # PBKDF2 + AES-GCM côté build
│
├── src/
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
│       └── ui.ts            # Utilitaires d'affichage
│
└── public/                  # Fichiers copiés tels quels (robots.txt, favicon)
    └── data/                # Contenu chiffré produit par le build — non commité
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
