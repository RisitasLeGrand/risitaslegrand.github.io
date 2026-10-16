# Registre des sources — santé, traitements, musculation

> **Ce registre ne contient aucune donnée personnelle.** Le dépôt est public ; il ne
> porte que des références et ce qu'elles justifient.

Règle de tenue, reprise du prompt (0.3) : **aucune valeur numérique n'entre dans
l'application sans** référence précise, date de vérification, population ou condition
de validité, et niveau de confiance. **« Inconnu » plutôt qu'une valeur inventée**,
partout.

## Comment lire ce registre

| Colonne | Ce qu'elle dit |
|---|---|
| **Référence** | de quoi il s'agit, assez précisément pour être retrouvé |
| **Type** | RCP, agence, recommandation, revue systématique, méta-analyse, essai, préprint, praticien, encyclopédie |
| **Évaluée par les pairs** | oui / non / sans objet |
| **Consultée le** | date de consultation effective, pas la date de publication |
| **Justifie** | la ou les valeurs qui en dépendent dans l'application |
| **Confiance** | solide, plausible, faible, heuristique, controversé |

## État : rien n'est encore sourcé

Le plan est validé depuis le 14 octobre 2026 et sa **phase 0 est livrée** : les
schémas de `scripts/lib/schemas-sante.mjs` refusent désormais, au build, toute
valeur chiffrée dépourvue de référence, de date de consultation, de population et
de niveau de confiance. La règle de ce registre n'est donc plus une intention mais
une condition — vérifiée par `npm run essais:schemas-sante`, qui tente les cinq
contournements connus et constate qu'ils échouent.

Aucune valeur n'est entrée dans
l'application, donc aucune source n'est encore inscrite ici.

Les **pistes de départ** fournies par le prompt (annexe S) sont listées ci-dessous
pour mémoire. **Elles ne comptent pas comme références** : chacune doit être remplacée
par une source de premier rang avant qu'une valeur entre dans le catalogue.

| Piste | Type | Ce qu'elle était censée justifier | Remplacée par |
|---|---|---|---|
| Page encyclopédique « Androgen ester » | encyclopédie | demi-vies des esters de testostérone | *à faire* |
| Pages encyclopédiques « Modafinil », « Piracetam », « Theanine » | encyclopédie | demi-vies de nootropes | *à faire* |
| Pages encyclopédiques du lot de douze | encyclopédie | maturité clinique, demi-vies | *à faire* |
| ACD856, *Eur J Clin Pharmacol*, 2024, DOI 10.1007/s00228-024-03645-1 | essai, source primaire | demi-vie ≈ 20 h, dose unique | *à relire en entier* |
| Thésaurus des interactions, ANSM, version du 15 septembre 2023 | agence | niveaux d'interaction | *lien seulement — voir décision 8* |
| Bhasin et coll., 2018, Endocrine Society | recommandation | repères de suivi sous testostérone | *texte intégral à lire* |
| Schoenfeld, Ogborn, Krieger, 2016 | méta-analyse | relation volume / hypertrophie | *à lire* |
| Pelland et coll., SportRxiv v2, 4 octobre 2024 | préprint | volume et fréquence | *non évalué par les pairs — à signaler comme tel* |
| Robinson et coll., *Sports Medicine*, 2024 | méta-régression | proximité de l'échec | *à lire* |
| Krzysztofik et coll., 2019, PubMed 31817252 | revue systématique | techniques d'intensification | *à lire* |
| Lally et coll., 2010, *Eur J Soc Psychol* | essai | variabilité de la formation d'habitude | *lu par commentaires secondaires — à relire* |
| Base de données publique des médicaments, ANSM, HAS | agence | statut en France, RCP | *à faire, molécule par molécule* |
| EFSA, ANSES | agence | limites supérieures de sécurité des vitamines | *à faire, nutriment par nutriment* |
| Liste de l'Agence mondiale antidopage | agence | `statut_antidopage` | *à faire, version datée* |

---

## Les cinq premières fiches, et d'où elles viennent — 16 octobre 2026

La collecte du pilote du 14 octobre a livré ce que ce registre attendait
« à faire, molécule par molécule ». Cinq RCP en sont sortis exploitables,
et le catalogue les porte.

| Fiche | Source lue | Ce que j'y ai lu |
|---|---|---|
| Testostérone énantate | RCP Androtardyl, 15 p. | deux demi-vies : 4,5 jours (ester, testostérone plasmatique) et 7,8 jours (métabolites) |
| Testostérone undécanoate | RCP Nebido, 17 p. | 90 ± 40 jours (dépôt) et environ une heure (testostérone, hommes âgés) |
| Modafinil | RCP Modiodal, 18 p. | 15 heures, demi-vie d'élimination efficace après doses multiples |
| N-acétylcystéine | RCP Fluimucil 600, 10 p. | **aucune demi-vie** — constaté sur le texte entier, pas supposé |
| Caféine | RCP citrate de caféine Cooper, 8 p. | 36 à 144 heures **chez le nouveau-né** : le produit est une apnée du prématuré |

Chaque fiche cite le chemin du fichier déposé et son empreinte SHA-256.
`npm run essais:catalogue-molecules` relit les PDF, recalcule les
empreintes, et **retrouve chaque durée dans son document** — une valeur
absente de sa source est signalée, aussi vraisemblable soit-elle.

**Le statut antidopage reste inconnu pour les cinq.** La liste de l'AMA
n'est pas dans la collecte : la ligne ci-dessus reste donc *à faire*, et
aucun RCP ne la remplace. Les déduire du bon sens serait les inventer.

**Ce que la collecte contient aussi et qui n'est pas encore exploité** :
le Thésaurus des interactions de septembre 2023 avec ses index par
substance et par classe, le différentiel, les références nutritionnelles
de l'ANSES et l'aperçu des limites supérieures de l'EFSA. De quoi lever
deux autres lignes *à faire* de ce registre.
