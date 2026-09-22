# Routines de veille — rubrique Actualités

Trois routines alimentent le dossier `actualites-data/` du dépôt : une veille
hebdomadaire, une synthèse trimestrielle et une synthèse annuelle. Chacune
ouvre une pull request ; rien n'est publié sans relecture.

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

**La veille hebdomadaire ne reçoit pas le mot de passe** : elle ne détient que
la clé publique, elle écrit sans pouvoir relire. **Les synthèses trimestrielle
et annuelle le reçoivent**, parce qu'il leur faut relire la période pour la
résumer ; elles l'écrivent dans `.env.local`, qui est ignoré par Git, et le
suppriment avant de committer.

```bash
node scripts/dechiffrer-actualite.mjs semaines 2026-W38
node scripts/dechiffrer-actualite.mjs --depuis semaines 2026-W27 2026-W39
node scripts/dechiffrer-actualite.mjs --lister
```

La sortie est du JSON en clair sur la sortie standard : elle ne doit jamais
être redirigée vers un fichier du dépôt.

Conséquences, qui expliquent la forme des consignes ci-dessous :

- la veille hebdomadaire peut **écrire** une actualité, jamais **relire** celles
  qui existent ;
- le schéma JSON ne peut pas être déduit d'un fichier existant : il est fourni
  par `node scripts/chiffrer-actualite.mjs --modele <dossier>` ;
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

Tant que `actualites-data/cle-publique.json` n'existe pas, les routines ne
publient rien : elles ouvrent une issue le signalant, et la rubrique reste
masquée sur le site.

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

## Les trois routines

Elles existent déjà sur le compte et sont actives. Chacune crée une session
neuve à son déclenchement.

| Routine | Identifiant | Cron (UTC) | Prochain passage |
|---|---|---|---|
| Veille hebdomadaire | `trig_01KJ1XtUse66nHRoMWL74LtE` | `0 5 * * 1` | lundi 28 septembre 2026 |
| Synthèse trimestrielle | `trig_015hD9sdSbmvoVvxpDxg5U1B` | `0 5 1 1,4,7,10 *` | 1er octobre 2026 |
| Synthèse annuelle | `trig_01NCNPZK25f6E2MsfN4TZUC6` | `0 5 5 1 *` | 5 janvier 2027 |

5 h UTC correspond à 7 h à Paris en heure d'été, 6 h en heure d'hiver. Le
texte exact de chaque consigne se consulte et se modifie sur
`claude.ai/code/routines`.

**À vérifier avant le premier passage.** Ces routines ont été créées depuis une
session Claude Code, qui n'a pas pu leur transmettre de connecteur : les
sessions qu'elles déclenchent risquent de démarrer sans les outils GitHub, et
donc de ne pas pouvoir ouvrir de pull request. Ouvrez `claude.ai/code/routines`
et vérifiez que le connecteur GitHub est actif sur chacune ; sinon, recréez-les
depuis cette page.

## Schéma des données

Obtenu par `node scripts/chiffrer-actualite.mjs --modele semaines` (ou
`fiches`, `trimestres`, `annees`).

**Fiche suivie.** Quatre identifiants seulement sont affichés par le site :
`premier-ministre`, `ministres-finances`, `chiffres-economie`, `legislation`.

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

**Entrée datée.** Le champ d'identifiant prend le nom du dossier : `semaine`,
`trimestre` ou `annee`.

```json
{
  "semaine": "2026-W40",
  "periode": "28 septembre – 4 octobre 2026",
  "items": [
    {
      "titre": "…",
      "theme": "juridique",
      "resume": "…",
      "sources": [{ "nom": "…", "url": "…" }],
      "image": { "url": "…", "credit": "…" },
      "lien_cours": "…",
      "mots_cles": ["déficit public", "Pacte de stabilité"]
    }
  ]
}
```

`theme` n'admet que `juridique`, `economique` et `international`, sans accent :
ce sont les valeurs du filtre de la page d'archive.

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

## Points de vigilance

- **Ne jamais commiter de JSON en clair.** Le contenu s'écrit dans `/tmp`, puis
  se chiffre ; seul le fichier chiffré entre dans le dépôt. `npm run deploy`
  refuse de publier un fichier de `actualites-data/` qui ne serait pas chiffré.
- **Ne jamais héberger d'image** : seulement son URL d'origine et son crédit.
- **Ne jamais recopier le texte d'un article** : les résumés sont rédigés dans
  les propres mots de la routine, avec la source citée.
- **Les fiches suivies sont remplacées, pas complétées** ; l'historique Git
  conserve les versions antérieures.
- **Ne toucher qu'aux fiches réellement concernées**, pour que `derniere_maj`
  reste une information utile.
