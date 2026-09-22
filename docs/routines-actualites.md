# Routines de veille — rubrique Actualités

Ces trois routines alimentent le dossier `actualites-data/` de la branche
`gh-pages`. Elles tournent sur l'infrastructure Claude : elles n'ont accès ni à
la machine locale, ni au mot de passe de chiffrement — seulement au dépôt
GitHub. C'est la raison pour laquelle la rubrique Actualités n'est pas chiffrée
(voir la section « La rubrique Actualités » du README).

Par défaut, chaque routine **ouvre une pull request** plutôt que de publier
directement : cela laisse un point de relecture, au moins le temps de vérifier
la qualité et l'exactitude des résumés. Le passage en publication directe peut
être envisagé ensuite.

Elles se créent depuis `claude.ai/code/routines` (dépôt GitHub connecté,
déclencheur programmé, connecteur GitHub actif). Les prompts ci-dessous sont à
coller tels quels.

---

## 1. Routine hebdomadaire — chaque lundi matin

```
Tu interviens sur le dépôt GitHub du site RevINSP, sur la branche gh-pages, dossier actualites-data/. Chaque semaine, mets à jour la rubrique Actualités du site :

1. Recherche sur le web les actualités des 7 derniers jours en droit public, économie et finances publiques, et relations internationales, en priorité auprès de sources fiables (Légifrance, Journal officiel, Vie publique, INSEE, Banque de France, presse économique de référence, sites institutionnels des ministères concernés).
2. Sélectionne 5 à 10 actualités marquantes. Pour chacune, rédige : un titre court, un résumé de quelques phrases dans tes propres mots (jamais une copie du texte source), le thème (juridique, économique ou international), les sources (nom + URL), et un bref paragraphe reliant l'actualité au programme de révision du concours INSP. Si une image pertinente illustre un article source, note son URL d'origine et son crédit — ne télécharge et n'héberge jamais l'image toi-même.
3. Vérifie si l'un de ces thèmes doit être mis à jour (remplace entièrement le fichier existant, ne garde que la version la plus récente) : Premier ministre ; ministres des ministères économiques et financiers et Directeur général des Finances publiques ; chiffres clés de l'économie française ; changements législatifs majeurs récents. Ne touche qu'aux fiches réellement concernées par un changement.
4. Avant d'écrire, lis un fichier existant dans actualites-data/semaines/ et dans actualites-data/fiches/ pour respecter exactement le même schéma JSON.
5. Écris l'entrée de la semaine dans actualites-data/semaines/AAAA-Wnn.json (numéro de semaine ISO) et les fiches mises à jour dans actualites-data/fiches/<id>.json.
6. Commite ces changements sur une branche dédiée et ouvre une pull request avec, en description, un résumé des actualités de la semaine.
```

## 2. Routine trimestrielle — 1er janvier, 1er avril, 1er juillet, 1er octobre

```
Tu interviens sur le dépôt GitHub du site RevINSP, sur la branche gh-pages, dossier actualites-data/. Chaque trimestre, réalise la synthèse trimestrielle de la rubrique Actualités :

1. Lis l'ensemble des fichiers actualites-data/semaines/AAAA-Wnn.json publiés au cours des trois derniers mois.
2. Identifie les actualités les plus importantes de la période pour la préparation du concours INSP (réformes structurantes, évolutions institutionnelles majeures, chiffres économiques significatifs, événements internationaux notables) — une sélection resserrée, pas une recopie de toutes les entrées hebdomadaires.
3. Avant d'écrire, lis un fichier existant dans actualites-data/trimestres/ pour respecter exactement le même schéma JSON que les entrées hebdomadaires (mêmes champs : titre, thème, résumé, sources, lien avec le cours).
4. Écris le résultat dans actualites-data/trimestres/AAAA-Tn.json (ex. 2026-T3.json).
5. Commite ces changements sur une branche dédiée et ouvre une pull request avec un résumé de la synthèse trimestrielle.
```

## 3. Routine annuelle — 5 janvier

```
Tu interviens sur le dépôt GitHub du site RevINSP, sur la branche gh-pages, dossier actualites-data/. Une fois par an, réalise la synthèse annuelle de la rubrique Actualités :

1. Lis les quatre fichiers actualites-data/trimestres/AAAA-Tn.json de l'année écoulée.
2. Identifie les actualités les plus structurantes de l'année pour la préparation du concours INSP.
3. Avant d'écrire, lis un fichier existant dans actualites-data/annees/ pour respecter exactement le même schéma JSON.
4. Écris le résultat dans actualites-data/annees/AAAA.json.
5. Commite ces changements sur une branche dédiée et ouvre une pull request avec un résumé de la synthèse annuelle.
```

---

## Schéma des fichiers

**Fiche suivie** — `actualites-data/fiches/<id>.json`. Les quatre identifiants
attendus par le site sont `premier-ministre`, `ministres-finances`,
`chiffres-economie` et `legislation` ; un autre identifiant ne serait pas
affiché.

```json
{
  "id": "premier-ministre",
  "titre": "Premier ministre",
  "resume": "…",
  "sources": [{ "nom": "…", "url": "…" }],
  "lien_cours": "…",
  "derniere_maj": "2026-09-22"
}
```

**Entrée datée** — `semaines/AAAA-Wnn.json`, `trimestres/AAAA-Tn.json`,
`annees/AAAA.json`. Le champ d'identifiant prend le nom du dossier
(`semaine`, `trimestre` ou `annee`).

```json
{
  "semaine": "2026-W39",
  "periode": "21–27 septembre 2026",
  "items": [
    {
      "titre": "…",
      "theme": "juridique",
      "resume": "…",
      "sources": [{ "nom": "…", "url": "…" }],
      "image": { "url": "…", "credit": "…" },
      "lien_cours": "…"
    }
  ]
}
```

Les trois valeurs admises pour `theme` sont `juridique`, `economique` et
`international` : ce sont elles qui alimentent le filtre de la page d'archive.
`image` est facultatif et ne contient jamais qu'une URL distante.

## Points de vigilance

- **Ne jamais héberger d'image dans le dépôt** — seulement son URL d'origine et
  son crédit.
- **Ne jamais recopier le texte d'un article** : les résumés sont rédigés dans
  les propres mots de la routine, avec la source citée.
- **Les fiches suivies sont remplacées, pas accumulées** : l'historique Git
  suffit à retrouver une version antérieure.
- **Ne toucher qu'aux fiches réellement concernées** par un changement, pour
  que `derniere_maj` reste une information utile.
- Le site n'a pas d'index de dossier : il sonde les identifiants de période en
  remontant le temps. Une interruption de plus de vingt semaines masque donc les
  entrées antérieures dans la page d'archive.
