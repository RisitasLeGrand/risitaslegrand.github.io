# Le format strict de l'analyse, et sa validation

Livrable de la phase 0, demandé en B.4 : « Point de départ que le plan affine. » Voici la version
que je propose d'arrêter, avec ses plafonds, ses énumérations fermées et ses règles croisées.

## Pourquoi JSON, et pourquoi strict

Un format libre serait plus facile à produire pour une IA et impossible à vérifier pour Cyclades.
Or tout l'intérêt de l'import tient à la vérification : sans elle, une analyse importée est un texte
qui ressemble à des données. Le schéma fermé — **champs inconnus refusés**, énumérations fermées,
longueurs bornées — est ce qui permet de dire « ce chiffre ne correspond à rien dans vos données »
plutôt que de l'afficher comme s'il venait de là.

## L'objet

```json
{
  "format": "cyclades-analyse",
  "version": 1,
  "export_id": "exp-01JAWZ4K7P",
  "export_empreinte": "sha256:9f2b…",
  "genere_le": "2026-10-11T13:00:00+02:00",
  "periode": { "debut": "2026-07-01", "fin": "2026-09-30" },
  "resume": "…",
  "constats": [
    {
      "id": "c1",
      "domaine": "cognition",
      "type": "tendance",
      "enonce": "…",
      "confiance": "moyenne",
      "preuves": [
        {
          "indicateur": "cog.temps-revision",
          "periode": { "debut": "2026-09-01", "fin": "2026-09-30" },
          "valeur_citee": 42.5,
          "unite": "heures"
        }
      ],
      "explications_alternatives": ["…"],
      "limites": "…"
    }
  ],
  "propositions": [
    {
      "id": "p1",
      "domaine": "cognition",
      "nature": "organisation",
      "titre": "…",
      "description": "…",
      "horizon_semaines": 4,
      "indicateur_de_suivi": "cog.regularite-revision",
      "lie_aux_constats": ["c1"],
      "avertissement_professionnel": false
    }
  ],
  "questions_a_clarifier": [{ "id": "q1", "question": "…", "pourquoi": "…" }],
  "qualite_des_donnees": [{ "domaine": "corps", "probleme": "…", "reference": "…" }],
  "limites_globales": "…"
}
```

## Ce que j'ajoute au point de départ du prompt, et pourquoi

| Ajout | Raison |
|---|---|
| `format` et `version` **obligatoires et vérifiés en premier** | Un fichier qui n'est pas une analyse Cyclades doit être refusé avant toute autre erreur, sinon le message parle de champs manquants au lieu de dire « ce n'est pas le bon fichier » |
| `export_id` et `export_empreinte` **facultatifs** | B.6.3 veut que l'import reste possible si l'export est inconnu. Les rendre obligatoires interdirait un import légitime après un effacement du journal |
| `unite` **obligatoire dans une preuve** | Sans elle, 42,5 peut être des heures ou des minutes, et la comparaison serait fausse dans un cas sur deux |
| `preuves` peut être **vide** pour `type: "lacune_de_donnees"` | Un constat qui dit « il n'y a pas de données ici » ne peut pas citer de chiffre. Exiger une preuve forcerait l'IA à en inventer une, ce qui est exactement ce qu'on veut éviter |
| `indicateur_de_suivi` **facultatif** pour `nature: "question"` | Une question n'a pas d'indicateur de suivi |
| Pas de champ libre de type objet, nulle part | Un objet ouvert est une porte ; on la ferme avant qu'elle serve |

## Énumérations fermées

| Champ | Valeurs |
|---|---|
| `format` | `cyclades-analyse` |
| `version` | `1` |
| `domaine` | `corps` · `cognition` · `connaissances` · `psyche` · `finances` · `lien` · `ordre` · `oeuvre` · `transverse` |
| `constats[].type` | `tendance` · `anomalie` · `correlation` · `progres` · `risque` · `lacune_de_donnees` |
| `constats[].confiance` | `faible` · `moyenne` · `elevee` |
| `propositions[].nature` | `organisation` · `habitude` · `mesure` · `question` · `verification_donnee` |

**La liste des natures est le garde-fou le plus important du schéma.** Elle ne contient ni dose, ni
protocole, ni allocation : une proposition qui dirait « prendre 5 000 UI de vitamine D » ou
« basculer 20 % vers les obligations » n'a **aucune nature valide** pour s'exprimer, et elle est donc
refusée par le schéma, pas par un filtre de mots. C'est E.1 et E.4 tenus par la structure.

## Plafonds

| Élément | Plafond | Pourquoi ce nombre |
|---|---|---|
| Taille du fichier | **512 Kio** | Une analyse de 30 constats et 15 propositions tient dans 60 Kio ; dix fois la marge, et pas mille |
| `constats` | 30 | Celui du prompt |
| `propositions` | 15 | Celui du prompt |
| `preuves` par constat | 10 | Au-delà, ce n'est plus une preuve, c'est un tableau |
| `explications_alternatives` | 5 par constat, 400 signes chacune | |
| `questions_a_clarifier` | 20 | |
| `qualite_des_donnees` | 30 | |
| `resume` | 4 000 signes | |
| `enonce`, `description` | 1 500 signes | |
| `titre` | 120 signes | |
| `limites`, `limites_globales` | 1 000 signes | |
| `horizon_semaines` | entier de 1 à 52 | |
| Profondeur de l'objet | 6 | Un JSON à cent niveaux est une attaque, pas une analyse |

## Règles croisées — refusées si violées

1. `constats[].id` et `propositions[].id` **uniques**, non vides, 16 signes au plus.
2. `lie_aux_constats` ne cite que des `constats[].id` **présents** dans le même fichier.
3. `preuves[].indicateur` et `indicateur_de_suivi` existent dans le **catalogue d'indicateurs** de
   la version du site qui importe. Un identifiant inconnu est refusé — et le message le dit avec son
   chemin : `constats[2].preuves[0].indicateur : identifiant inconnu`.
4. Toute date est au format `AAAA-MM-JJ`, et **dans la période** de l'analyse, bornes incluses.
5. `periode.debut <= periode.fin`, et de même dans chaque preuve.
6. `valeur_citee` est un nombre fini. Pas de chaîne, pas de `null`, pas de notation exponentielle.
7. Tous les textes sont du **texte brut** : refus si l'on y trouve une balise (`<…>`), une entité
   HTML, un `](` de lien Markdown, un `\u0000`, ou un caractère de contrôle autre que le retour à la
   ligne.
8. Aucun champ inconnu, à aucun niveau.
9. `avertissement_professionnel` est un booléen — et il n'est **pas de confiance** : une règle locale
   le force à vrai pour toute proposition de domaine `corps` ou `finances`, quoi que l'IA ait écrit.

**Rien n'est importé partiellement.** Une seule violation refuse le fichier entier, et l'écran liste
toutes les erreurs trouvées — pas seulement la première, sans quoi la réparation se ferait en dix
allers-retours.

## L'enveloppe tolérante

Avant la validation, et dans cet ordre : retrait d'un BOM ; retrait d'une clôture de bloc de code
(``` avec ou sans langue) ; retrait du texte avant la première `{` et après la dernière `}`
**équilibrée** ; retrait d'une virgule finale avant `}` ou `]`. Rien d'autre. En particulier, aucune
réparation de guillemets ni de clés manquantes : à partir de là, c'est à l'IA de corriger, et c'est
le rôle du prompt de réparation.

## Le prompt de réparation

Généré localement, à copier. Sa forme :

```
Ta réponse précédente n'a pas pu être importée. Voici les erreurs, avec leur chemin :

  - constats[2].preuves[0].indicateur : identifiant inconnu « corps.poids_moyen ».
    Identifiants disponibles : cog.temps-revision, cog.regularite-revision, …
  - propositions[1].nature : valeur « protocole » refusée.
    Valeurs admises : organisation, habitude, mesure, question, verification_donnee.
  - propositions[0].lie_aux_constats[1] : « c9 » ne correspond à aucun constat.

Renvoie l'objet JSON complet et corrigé, sans aucun texte autour.
```

Il ne contient **aucune donnée personnelle** : des chemins, des valeurs refusées et la liste des
identifiants admis. C'est volontaire — ce texte repart chez un tiers.

## La vérification des chiffres cités

Pour chaque preuve, Cyclades recalcule l'indicateur sur la période annoncée, **à la version des
données de l'export** (le vecteur de versions du manifeste), et compare.

| Verdict | Condition |
|---|---|
| **Confirmé** | L'écart relatif est inférieur à 1 %, ou l'écart absolu est inférieur à la précision de l'unité |
| **Approché** | L'écart relatif reste sous 10 % |
| **Non retrouvé** | L'indicateur se recalcule, et la valeur ne correspond pas |
| **Non vérifiable** | L'indicateur n'existe plus, la période est hors des données conservées, ou une **compaction** a effacé le détail d'avant la borne |

Un constat dont une preuve n'est pas retrouvée est **signalé en évidence** dans l'aperçu. Et « non
vérifiable » n'est jamais remplacé par une valeur reconstituée : c'est le seul point où le silence
vaut mieux qu'un nombre.
