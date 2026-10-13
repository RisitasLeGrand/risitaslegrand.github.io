# Échelles de la psyché — relevé à la source

**Résultat : aucun relevé n'a pu être fait.** Les cinq hôtes nécessaires sont
refusés par la passerelle réseau du conteneur. Aucun octet n'a été téléchargé,
donc aucun texte d'échelle ne figure ci-dessous. Ce fichier est un constat
d'échec d'accès, pas un relevé.

Mesures faites le **13 octobre 2026**, entre **00:37:50 UTC** et **00:38:36 UTC**.

---

## 1. Atteignabilité des cinq hôtes

Commande exécutée telle quelle :

```
for u in https://cdn.who.int https://www.who.int https://iris.who.int https://www.phqscreeners.com https://phqscreeners.com; do
  printf '%-32s' "$u"; curl -sS -o /dev/null -w "%{http_code}\n" --max-time 25 "$u" 2>&1 | tail -1
done
```

Sortie brute :

```
https://cdn.who.int             000
https://www.who.int             000
https://iris.who.int            000
https://www.phqscreeners.com    000
https://phqscreeners.com        000
```

Le code `000` signifie que `curl` n'a jamais obtenu de réponse HTTP : la
connexion n'a pas été établie. En réexécutant sans masquer le canal d'erreur,
chacun des cinq hôtes rend la même ligne :

```
curl: (56) CONNECT tunnel failed, response 403
```

| Hôte | Code HTTP | Diagnostic |
|---|---|---|
| `cdn.who.int` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `www.who.int` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `iris.who.int` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `www.phqscreeners.com` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `phqscreeners.com` | — (`000`) | `CONNECT tunnel failed, response 403` |

**Cinq refus sur cinq.** Le `403` est rendu par la passerelle en réponse au
`CONNECT`, c'est-à-dire avant tout échange avec l'OMS ou avec Pfizer : ce n'est
pas un refus des sites, c'est la politique réseau du conteneur qui n'autorise
pas ces domaines. Le journal de la passerelle qualifie les cinq événements de
`connect_rejected` — « gateway answered 403 to CONNECT (policy denial or
upstream failure) ».

## 2. Les URL exactes visées, essayées nommément

Le refus portant sur l'hôte, les URL précises du cahier des charges ont été
essayées pour que le relevé soit sans ambiguïté. Même résultat, à 00:38:35 UTC :

| URL | Code HTTP | Diagnostic |
|---|---|---|
| `https://cdn.who.int/media/docs/default-source/mental-health/indice-(en-cinq-points)-de-bien--tre-de-l-oms.pdf` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `https://www.who.int/copyright` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `https://www.phqscreeners.com/select-screener` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `https://www.phqscreeners.com/images/screeners/french_phq-9.pdf` | — (`000`) | `CONNECT tunnel failed, response 403` |

Les deux dernières URL sont celles que je visais de mémoire pour atteindre la
page de téléchargement et le PDF du PHQ-9 ; **je n'ai pas pu vérifier qu'elles
existent encore**, puisque l'hôte ne répond pas. Elles figurent ici comme
tentatives, pas comme adresses confirmées.

## 3. Ce qui n'a donc pas été obtenu

Rien n'a été téléchargé. `/tmp/echelles/` est resté vide : **aucune taille,
aucune empreinte SHA-256 à rapporter**, pour aucun des trois documents.

| Document attendu | Obtenu | Pourquoi |
|---|---|---|
| WHO-5 français (titre, consigne, période de rappel, 5 items, options et valeurs chiffrées, règle de score) | Néant | `cdn.who.int` et `www.who.int` refusés par la passerelle |
| Page de droits de l'OMS (`www.who.int/copyright`) | Néant | `www.who.int` refusé |
| PHQ-9 français (texte intégral, licence) | Néant | `www.phqscreeners.com` et `phqscreeners.com` refusés |
| GAD-7 français (texte intégral, licence) | Néant | idem |
| Liste des variantes de français du PHQ-9 et du GAD-7 (France, Belgique, Canada, Suisse…) | Néant | la page de sélection des langues est sur l'hôte refusé ; je ne peux ni énumérer les variantes offertes, ni dire si une variante « France » existe |
| Mentions de copyright, de licence, de non-responsabilité et d'attribution | Néant | elles vivent dans les documents et sur les pages de téléchargement inaccessibles |

## 4. Ce que je n'ai délibérément pas fait

La consigne prime sur le résultat, donc je me suis arrêté net :

- **Aucun contournement.** Ni miroir, ni cache, ni proxy tiers, ni moteur de
  recherche, ni dépôt documentaire de substitution, ni site tiers (INSPQ,
  psychomedia, helpsy, université, PDF trouvé ailleurs).
- **Aucune reconstitution de mémoire.** Je connais approximativement la forme de
  ces trois échelles ; je n'en écris pas une ligne. Un énoncé reconstitué à un
  mot près — un « senti(e) » devenu « senti », une période de rappel approchée —
  a l'apparence du juste et n'est plus l'échelle : il vaut moins que rien, parce
  qu'il se relit sans alerter personne. Le texte français intégral demandé à
  l'étape 4 est donc **absent, et non approximé**.
- **Aucun fichier de données, aucun `NOTICE`, aucun code, aucun test.** La
  phase 1 n'est pas validée et la condition d'accès aux sources n'est pas
  remplie.

## 5. Pour débloquer

La politique d'accès réseau de l'environnement a refusé ces hôtes. Le réglage se
fait dans les paramètres de l'environnement cloud (menu de l'environnement dans
la barre de titre de la session, puis **Edit**, section **Network access**) :
soit un niveau d'accès plus large, soit l'ajout de `cdn.who.int`, `www.who.int`,
`iris.who.int`, `www.phqscreeners.com` et `phqscreeners.com` sous **Allowed
domains**, en laissant cochée la case **Allow package managers**. La marche à
suivre est décrite sur <https://code.claude.com/docs/en/cloud-environments#network-access>.

Une fois ces cinq domaines autorisés, le relevé de l'étape 2 peut être refait
sans rien changer d'autre : il ne dépend que de l'atteignabilité.
