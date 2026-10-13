# Accès aux sources — relevé du 13 octobre 2026

Douze hôtes essayés depuis le conteneur, à la même minute. **Onze refusés par
la passerelle**, le douzième servant de témoin.

| Hôte | Pour quoi | Résultat |
|---|---|---|
| `cdn.who.int` | texte français du WHO-5 | `403` |
| `www.who.int` | page de droits, fiche WHO-5 | `403` |
| `iris.who.int` | dépôt documentaire de l'OMS | `403` |
| `www.phqscreeners.com` | PHQ-9 et GAD-7 français, variantes | `403` |
| `base-donnees-publique.medicaments.gouv.fr` | RCP des médicaments | `403` |
| `ansm.sante.fr` | Thésaurus des interactions | `403` |
| `www.has-sante.fr` | recommandations | `403` |
| `pubmed.ncbi.nlm.nih.gov` | revues et méta-analyses | `403` |
| `doi.org` | résolution des DOI | `403` |
| `link.springer.com` | texte intégral | `403` |
| `academic.oup.com` | Endocrine Society | `403` |
| `github.com` | **témoin** | répond |

Le refus est rendu par la passerelle au `CONNECT`, donc avant tout échange
avec les sites : c'est la politique réseau de l'environnement, pas un blocage
anti-robot. Un conteneur neuf dans le même environnement avait déjà été
essayé le même jour, avec le même résultat.

## Ce que cela bloque exactement

**Psyché.** Les trois échelles, et elles seules. Le check-in rapide, le point
de semaine, le journal, les écarts à la ligne de base et toute la veille du
rythme de vie n'ont besoin d'aucune source externe : leurs repères sont
internes, et la seule référence admise est la personne elle-même.

**Sport et santé.** Aucune **valeur numérique** sourcée ne peut entrer :
demi-vies, niveaux d'interaction, repères de suivi, relations volume /
hypertrophie. Le prompt l'avait prévu, et sa règle s'applique telle quelle —
« *inconnu* plutôt qu'une valeur inventée ». Les **modèles**, eux, se
construisent : un traitement, une prise, un prélèvement, un symptôme sont des
objets à enregistrer, pas des valeurs à sourcer.

## Ce qui reste donc constructible sans rien attendre

| Chantier | Constructible | Bloqué |
|---|---|---|
| Veille du rythme de vie | registre d'indicateurs, base personnelle, moteur, écrans | — |
| Psyché | tout, sauf les échelles | les trois échelles |
| Santé, phase 1 | modèle, écrans, enregistrement | le catalogue de molécules et ses valeurs |
| Musculation | structure, programmes, volumes | les niveaux de preuve des méthodes |

Autrement dit : **la forme se construit, les chiffres attendent.** Et quand
une valeur manque, l'application doit le dire — c'est la règle du prompt, et
c'est aussi ce qui permet de reprendre plus tard sans se demander ce qui a
été inventé entre-temps.

## Second relevé, le même jour, pour la synthèse des années 2024 et 2025

La ligne `D-023` de l'audit demande deux synthèses annuelles dont **chaque
chiffre est sourcé**. Neuf hôtes essayés à la même minute, tous refusés au
`CONNECT` — y compris le témoin public :

| Hôte | Pour quoi | Résultat |
|---|---|---|
| `www.insee.fr` | PIB, déficit, dette, inflation, chômage | `403` |
| `www.vie-publique.fr` | lois promulguées, décisions publiques | `403` |
| `www.legifrance.gouv.fr` | textes et dates de promulgation | `403` |
| `www.economie.gouv.fr` | budget, mesures fiscales | `403` |
| `www.banque-france.fr` | taux, crédit, conjoncture | `403` |
| `www.ecb.europa.eu` | décisions de politique monétaire | `403` |
| `ec.europa.eu` | droit de l'Union, procédures | `403` |
| `en.wikipedia.org` | repère de contrôle | `403` |
| `example.com` | **témoin** neutre | `403` |

Le témoin tombe aussi : la politique n'épargne rien hors GitHub et les
registres de paquets. `WebFetch` échoue de la même façon (`ENOTFOUND`), la
résolution de nom passant par la même passerelle.

**La recherche web, elle, répond** — mais elle rend le résumé d'un modèle sur
des extraits, pas la page. Elle a d'ailleurs rendu, sur le déficit public
2024, deux montants en euros différents selon la publication, et une dette
révisée de 113,0 % à 112,6 % du PIB. C'est exactement le genre d'écart qu'une
synthèse annuelle doit trancher en ouvrant la source, et que je ne peux pas
trancher d'ici. Citer l'URL d'une page que je n'ai pas lue serait une
affirmation déguisée en référence.

**`actualites-data/annees/2024.json` et `2025.json` ne sont donc pas
produits.** Ce qu'il faudrait pour les produire est au lot 5 de
`sources-a-atteindre.md`.

## Pour lever le blocage

Les deux voies sont inchangées : les fichiers transmis directement, ou
l'ajout des hôtes sous **Allowed domains** de l'environnement
`env_0198bLo9y2XVzvhccU7sPF7k` — celui de cette session, et non l'autre
« Default ».
