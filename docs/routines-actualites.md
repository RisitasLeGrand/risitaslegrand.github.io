# Routines de veille — rubrique Actualités

Quatre routines alimentent le dossier `actualites-data/` du dépôt : une veille
hebdomadaire, un bilan mensuel, une synthèse trimestrielle et une synthèse
annuelle. Chacune ouvre une pull request ; rien n'est publié sans relecture.

Chaque niveau s'appuie sur le niveau en dessous : le mensuel lit les semaines,
le trimestriel lit les mois (et redescend aux semaines quand un événement
mérite d'être recontextualisé), l'annuel lit les trimestres (et redescend lui
aussi jusqu'aux semaines au besoin).

## Le principe : elles chiffrent sans pouvoir déchiffrer

Ces routines tournent sur l'infrastructure Claude. Elles n'ont accès ni à la
machine du propriétaire du site, ni au mot de passe de chiffrement. Elles ne
peuvent donc pas utiliser la clé symétrique qui protège les cours.

Le site utilise pour elles une **paire de clés** :

| Clé | Où elle vit | Ce qu'elle permet |
|---|---|---|
| **Publique** | `actualites-data/cle-publique.json`, commitée et publiée en clair | chiffrer une actualité |
| **Privée** | `content/actualites-cle-privee.json`, jamais commitée ; republiée par le build sous forme chiffrée dans `data/actualites-cle.json` | déchiffrer, dans le navigateur, après saisie du mot de passe |
| **Privée, copie chiffrée** | `actualites-data/cle-privee-chiffree.json`, commitée, protégée par le mot de passe du site | déchiffrer en ligne de commande, pour qui détient le mot de passe |

**Les quatre routines reçoivent le mot de passe du site**, parce que toutes ont
désormais besoin de relire l'existant :

| Routine | Ce qu'elle doit relire |
|---|---|
| Hebdomadaire | l'historique législatif, qui se **complète** au lieu d'être remplacé (voir plus bas) |
| Mensuelle | les bulletins hebdomadaires du mois |
| Trimestrielle | les bilans mensuels du trimestre, et les semaines pour le détail |
| Annuelle | les synthèses trimestrielles de l'année, et les semaines pour le détail |

Chacune l'écrit dans `.env.local`, ignoré par Git, et le supprime avant de
committer.

```bash
node scripts/dechiffrer-actualite.mjs semaines 2026-W38
node scripts/dechiffrer-actualite.mjs --depuis semaines 2026-W27 2026-W39
node scripts/dechiffrer-actualite.mjs fiches legislation
node scripts/dechiffrer-actualite.mjs --lister
```

La sortie est du JSON en clair sur la sortie standard : elle ne doit jamais
être redirigée vers un fichier du dépôt.

Conséquences, qui expliquent la forme des consignes :

- le schéma JSON ne se devine pas d'un fichier publié : il est fourni par
  `node scripts/chiffrer-actualite.mjs --modele <clé>` ;
- les descriptions de pull request restent **neutres** : le dépôt est public,
  et y recopier les résumés annulerait le bénéfice du chiffrement ;
- le nom de chaque fichier publié est une **empreinte** de `<dossier>/<id>` :
  la liste des fichiers en ligne ne révèle ni les dates ni les thèmes suivis.

## Activation (une fois, sur la machine du propriétaire)

```bash
npm run actualites:cles      # crée la paire de clés
git add actualites-data/cle-publique.json actualites-data/cle-privee-chiffree.json
git commit -m "Active la rubrique Actualités"
npm run deploy               # publie la clé privée chiffrée avec le contenu
```

Après un changement de mot de passe du site, réécrire la copie chiffrée :

```bash
npm run actualites:cles -- --resynchroniser
```

Le mot de passe est aussi inscrit dans le texte des quatre routines : le
changer impose donc de les rééditer sur `claude.ai/code/routines`.

Tant que `actualites-data/cle-publique.json` n'existe pas, les routines ne
publient rien : elles le signalent et s'arrêtent, et la rubrique reste masquée
sur le site.

> La copie chiffrée versionnée rend la clé privée récupérable après un clone :
> le build la restaure automatiquement dans `content/` si elle y manque. Elle
> n'est donc perdue que si le mot de passe l'est aussi.

## Le circuit d'une actualité

```
routine (nuage)                     propriétaire (machine locale)
───────────────                     ─────────────────────────────
recherche web
  ↓
JSON en clair dans /tmp
  ↓  node scripts/chiffrer-actualite.mjs
enveloppe chiffrée
  ↓  commit + pull request
          ──────────── relecture, fusion ────────────→
                                     npm run deploy
                                       ↓
                                     site à jour
```

Une actualité n'apparaît donc en ligne qu'après fusion de la pull request
**et** republication du site.

## Les quatre routines

Elles existent sur le compte et sont actives. Chacune crée une session neuve à
son déclenchement. Les déclencheurs sont échelonnés pour respecter les
dépendances entre niveaux : le bilan mensuel doit être prêt avant le
trimestriel, qui doit être prêt avant l'annuel.

| Routine | Identifiant | Cron (UTC) | Moment |
|---|---|---|---|
| Veille hebdomadaire | `trig_01KJ1XtUse66nHRoMWL74LtE` | `0 5 * * 1` | chaque lundi |
| Bilan mensuel | `trig_01FF1YML9UePxVUJTHyUcFzi` | `0 5 1 * *` | le 1er du mois |
| Synthèse trimestrielle | `trig_015hD9sdSbmvoVvxpDxg5U1B` | `0 5 2 1,4,7,10 *` | le 2 janvier, avril, juillet, octobre |
| Synthèse annuelle | `trig_01NCNPZK25f6E2MsfN4TZUC6` | `0 5 6 1 *` | le 6 janvier |

5 h UTC correspond à 7 h à Paris en heure d'été, 6 h en heure d'hiver. Le
texte exact de chaque consigne se consulte et se modifie sur
`claude.ai/code/routines`.

**À vérifier avant le premier passage.** Ces routines ont été créées depuis une
session Claude Code, qui n'a pas pu leur transmettre de connecteur : les
sessions qu'elles déclenchent risquent de démarrer sans les outils GitHub, et
donc de ne pas pouvoir ouvrir de pull request. Ouvrez `claude.ai/code/routines`
et vérifiez que le connecteur GitHub est actif sur chacune ; sinon, recréez-les
depuis cette page.

## Les cinq domaines

Un seul vocabulaire sert aux items comme aux légendes de frise :

`economie` · `finance` · `social` · `juridique` · `international`

Sans accent : ce sont les valeurs admises par le script de chiffrement et par
le filtre de la page d'archive. `economique`, valeur de la taxonomie
précédente, reste lue par le site — les entrées déjà publiées n'ont pas été
réécrites — mais ne doit plus être produite.

## Schéma des données

Obtenu par `node scripts/chiffrer-actualite.mjs --modele <clé>`, où la clé est
`fiches`, `chiffres-economie`, `legislation`, `semaines`, `mois`, `trimestres`
ou `annees`.

**Entrée datée.** Le champ d'identifiant prend le nom du dossier : `semaine`,
`mois`, `trimestre` ou `annee`.

```json
{
  "mois": "2026-09",
  "periode": "septembre 2026",
  "items": [
    {
      "titre": "…",
      "domaine": "juridique",
      "date": "2026-09-15",
      "resume": "…",
      "sources": [{ "nom": "…", "url": "…" }],
      "image": { "url": "…", "credit": "…" },
      "lien_cours": "…",
      "mots_cles": ["déficit public", "Pacte de stabilité"]
    }
  ],
  "tendances": [
    { "titre": "…", "domaine": "finance", "texte": "Quelques phrases de lecture d'ensemble." }
  ],
  "frise": [
    { "date": "2026-09-15", "libelle": "…", "domaine": "juridique", "detail": "…" }
  ]
}
```

- `tendances` et `frise` sont **obligatoires** pour `mois`, `trimestres` et
  `annees` : le script de chiffrement refuse un bilan qui en manque.
- Un bulletin hebdomadaire n'en a pas besoin : sa frise se déduit du champ
  `date` de ses items. C'est la raison d'être de ce champ.
- Une frise de mois, de trimestre ou d'année **regroupe** : un point par
  semaine ou par événement marquant, pas un point par actualité.

**Fiche de suivi permanent.** Quatre identifiants seulement sont affichés par
le site : `premier-ministre`, `ministres-finances`, `chiffres-economie`,
`legislation`. Les trois formes coexistent selon la fiche.

*Instantané* (`premier-ministre`, `ministres-finances`) — remplacé à chaque
mise à jour :

```json
{
  "id": "premier-ministre",
  "titre": "Premier ministre",
  "resume": "…",
  "sources": [{ "nom": "…", "url": "…" }],
  "lien_cours": "…",
  "mots_cles": ["gouvernance", "souveraineté"],
  "derniere_maj": "2026-09-22"
}
```

`ministres-finances` couvre le ministre de l'Économie et des Finances, le
**ministre de l'Action et des Comptes publics** lorsque ce poste existe dans le
gouvernement en fonction, et le directeur général des Finances publiques.

*Tableau de bord* (`chiffres-economie`) — cinq indicateurs au minimum, et le
texte de contexte, qui est conservé à côté des chiffres et non remplacé par
eux :

```json
{
  "id": "chiffres-economie",
  "titre": "Chiffres clés de l'économie française",
  "indicateurs": {
    "pib":           { "valeur": "…", "periode_reference": "…", "source": { "nom": "…", "url": "…" } },
    "dette":         { "valeur": "…", "periode_reference": "…", "source": { "nom": "…", "url": "…" } },
    "dette_pct_pib": { "valeur": "…", "periode_reference": "…", "source": { "nom": "…", "url": "…" } },
    "deficit":       { "valeur": "…", "periode_reference": "…", "source": { "nom": "…", "url": "…" } },
    "inflation":     { "valeur": "…", "periode_reference": "…", "source": { "nom": "…", "url": "…" } }
  },
  "texte_contextuel": "…",
  "lien_cours": "…",
  "derniere_maj": "2026-09-22"
}
```

*Historique cumulatif* (`legislation`) — la seule fiche qui se **complète** :

```json
{
  "id": "legislation",
  "titre": "Changements législatifs majeurs récents",
  "historique": [
    {
      "titre": "…",
      "date": "2026-09-15",
      "resume": "…",
      "sources": [{ "nom": "…", "url": "…" }],
      "lien_cours": "…",
      "mots_cles": ["loi de finances"]
    }
  ],
  "derniere_maj": "2026-09-22"
}
```

Chiffrer une fiche écrit un fichier entier : pour compléter l'historique, il
faut donc **relire l'existant** (`node scripts/dechiffrer-actualite.mjs fiches
legislation`), y ajouter les nouvelles entrées, et réécrire la liste complète.
Le script le rappelle à chaque passage sur cette fiche.

## Le principe de sourcing

Ne retenir que des faits établis, sourcés auprès d'organes officiels : Journal
officiel, Légifrance, Vie publique, INSEE, Banque de France, communication
institutionnelle des ministères, presse économique de référence pour la mise en
contexte.

Les déclarations de campagne électorale et les prises de position de
personnalités publiques hors exercice d'une fonction officielle ne sont pas
retenues par défaut : elles ne le sont que si elles ont une portée factuelle
avérée et une utilité réelle pour la préparation du concours — l'annonce
confirmée d'une réforme, par exemple — jamais pour rapporter une promesse ou
une opinion en tant que telle. En cas de doute sur une source ou sur un fait,
l'écarter plutôt que l'inclure.

## Le champ « mots_cles » : c'est lui qui fait le lien avec les cours

Une routine ne connaît pas le plan du site — le manifeste est chiffré. Le
rattachement d'une actualité aux fiches de cours se fait donc **dans le
navigateur**, après déchiffrement, en rapprochant `mots_cles` des titres, des
tags puis du corps des fiches (`src/lib/rattachement.ts`).

Il faut donc choisir des **termes du programme**, pas des mots de l'actualité :

| À écrire | Plutôt que |
|---|---|
| `déficit public`, `Pacte de stabilité` | `budget 2027` |
| `citoyenneté européenne`, `article 20 TFUE` | `Bruxelles` |
| `multilatéralisme`, `Conseil de sécurité` | `sommet de New York` |

Les termes du glossaire du site (`content/glossaire.yml`) sont les meilleurs
candidats : ils sont repris tels quels dans les tags des fiches.

## Reconstituer l'historique manquant

Il n'existe pas encore d'historique antérieur à la mise en service de la
rubrique. Le reconstituer — les semaines écoulées de l'année, puis les mois,
puis les trimestres, plus deux synthèses de contexte pour les deux années
précédentes — est un travail de recherche conséquent, à répartir sur plusieurs
sessions plutôt qu'à tenter d'un coup : une session par mois reconstitué, en
s'arrêtant à la fin d'un mois complet, en committant, et en indiquant où
reprendre.

L'ordre est imposé par la chaîne de construction : les semaines d'abord, le
bilan mensuel une fois ses semaines complètes, le trimestriel une fois ses
trois mois écrits. Les fiches de suivi permanent, elles, décrivent l'état du
jour et se mettent à jour indépendamment.

## Points de vigilance

- **Ne jamais commiter de JSON en clair.** Le contenu s'écrit dans `/tmp`, puis
  se chiffre ; seul le fichier chiffré entre dans le dépôt. `npm run deploy`
  refuse de publier un fichier de `actualites-data/` qui ne serait pas chiffré.
- **Ne jamais écrire le mot de passe ailleurs que dans `.env.local`**, ni dans
  un commit, une description de pull request, une issue ou une réponse.
- **Ne jamais héberger d'image** : seulement son URL d'origine et son crédit.
- **Ne jamais recopier le texte d'un article** : les résumés sont rédigés dans
  les propres mots de la routine, avec la source citée.
- **Les fiches d'instantané sont remplacées, l'historique législatif est
  complété** ; l'historique Git conserve les versions antérieures.
- **Ne toucher qu'aux fiches réellement concernées**, pour que `derniere_maj`
  reste une information utile.
