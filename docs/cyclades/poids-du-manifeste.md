# Le poids des données servies — mesure du 1er novembre 2026

Mesuré avant toute proposition, parce que le nom de la tâche désigne le mauvais
fichier : le manifeste pèse 302 Ko, soit moins de 1 % du total. Optimiser ce que
le nom désigne aurait été travailler sur 302 Ko en laissant 11,6 Mo à côté.

## 1. Ce qui est sur le disque, et ce qui part sur le réseau

Relevé sur `public/data/` après `node scripts/build-content.mjs`, et sur
`http://localhost:4321` servi par `astro preview`, avec et sans
`Accept-Encoding`.

| fichier | disque | réseau compressé | gain |
| --- | --- | --- | --- |
| `recherche.json` | 11 643 985 o | **8 770 078 o** | 25 % |
| `bibliographie.bin` | 1 843 536 o | 1 843 536 o | **0 %** |
| `qcm-dgfip.json` | 683 325 o | 514 700 o | 25 % |
| `manifeste.json` | 302 205 o | 227 655 o | 25 % |
| `glossaire.json` | 228 209 o | — | — |
| `molecules.json` | 142 261 o | — | — |
| `public/data/` en tout | **44 Mo** | — | — |

### Le gain de compression est de 25 %, et c'est le chiffre qui oriente tout

Du JSON se comprime d'ordinaire à 80-90 %. Vingt-cinq pour cent est la
signature d'un contenu **chiffré** — et la construction l'annonce : « 43397 Ko
chiffrés ». Le `.bin` ne gagne rien du tout, ce qui confirme.

**Le poids est donc irréductible par compression.** Il ne reste que deux
leviers : ne pas télécharger, ou télécharger moins.

## 2. Qui paie, et quand

### Le service worker ne précharge rien, et c'est écrit

`public/sw.js` : « Tout le reste — les fiches chiffrées, les manifestes — n'est
servi depuis le cache que s'il y a **été mis exprès**. Le worker ne garde jamais
de lui-même ce qu'il voit passer. » Personne ne paie donc 8,8 Mo par surprise au
premier affichage.

### Mais `recherche.json` est demandé par TROIS écrans, dont deux qui ne cherchent rien

- `recherche.astro:146` — l'écran de recherche. Légitime : on y est venu pour
  chercher.
- `actualites.astro:531` — l'écran des actualités.
- `revisions/index.astro:863` — l'index des révisions.

Les deux derniers le font sous condition et en différé : seulement s'il reste
une actualité **sans aucun rattachement**. Le choix est donc fait pour la bonne
raison.

### Un écart de facteur huit entre le code et la mesure

Le commentaire d'`actualites.astro` dit : « l'index de recherche (plus d'un
mégaoctet, d'où le chargement différé) ». La mesure dit **8,8 Mo sur le réseau**.
Le différé était justifié ; son ordre de grandeur, non. Une personne dont une
actualité n'est pas rattachée télécharge huit fois ce que le code croit lui
coûter.

## 3. À quoi servent ces 8,8 Mo — et la réponse est : à un signal faible

`EntreeRecherche` porte `{ id, titre, matiere, fascicule, tags, texte }`, et
c'est `texte` — le corps entier des 429 fiches — qui fait le poids.

`construireIndexTexte` (`src/lib/rattachement.ts:48`) en fait une
`Map<id, texte normalisé>`. Et dans `rattacher`, ce texte ne sert QUE dans la
branche de repêchage :

```
if (score === 0 && index) {
  const texte = index.get(fiche.id);
  if (texte) for (const mot of …) if (mot.length >= 5 && texte.includes(mot)) score += 1;
}
```

Trois conditions, toutes restrictives : le score doit être **nul** — donc aucun
accord sur les tags ni sur le titre —, le mot doit faire **cinq lettres ou
plus**, et le test est un `includes`. Tout le reste du calcul ne lit que
`fiche.titre` et `fiche.tags`, qui sont dans le manifeste.

**Huit mégaoctets et huit cent mille octets pour un `+1` de dernier recours.**

## 4. Ce que cette mesure permet de proposer

Rien n'est décidé ici ; ce qui suit est à arbitrer.

### a. Deux index au lieu d'un

L'écran de recherche a besoin du texte : qui cherche paie, et c'est juste. Le
rattachement n'a besoin que de savoir si un mot de cinq lettres ou plus figure
dans un corps. Ce sont deux besoins différents servis par un seul fichier.

Un second fichier portant, par fiche, l'ensemble de ses **mots significatifs**
— le module a déjà `motsSignificatifs`, qui filtre à cinq lettres et retire les
mots vides — suffirait au repêchage. Le test deviendrait
`mots.some((m) => m.includes(mot))`, qui garde la sémantique du `includes`
actuel.

### b. Les mesures manquantes, FAITES — et elles ont corrigé la proposition

Le document s'arrêtait ici en nommant trois mesures à faire. Elles sont faites,
sur les 429 fiches de `content/`, et la première a démoli l'esquisse ci-dessus.

#### La proposition naïve ne gagnait que 2,9 fois

| forme | poids | rapport |
| --- | --- | --- |
| le texte servi aujourd'hui | 8 335 Ko | — |
| ensembles de mots PAR FICHE | 2 876 Ko | 2,9 × |
| **index INVERSÉ, mot → fiches** | **1 311 Ko** | **6,4 ×** |

Les ensembles par fiche répètent chaque mot autant de fois qu'il paraît de
fiches. L'index inversé le dit une fois : 24 908 mots pour 265 149 couples. Mon
estimation de « l'ordre du mégaoctet » pour la forme par fiche était fausse d'un
facteur trois, et c'est exactement l'erreur que ce document reproche au nom de
la tâche.

Économie mesurée : **7 025 Ko sur 8 335**, et 40 % des mots ne paraissent que
dans UNE fiche — ce sont les plus discriminants pour un rattachement, donc ceux
qu'il faut garder.

#### Un index de mots entiers perdrait 19 % des accords

Le test actuel est `texte.includes(mot)`, qui attrape un mot À L'INTÉRIEUR d'un
autre. Mesuré sur 632 mots d'épreuve — le vocabulaire des titres de fiches,
faute d'avoir les vraies actualités hors ligne, et c'est dit plutôt que caché :
46 663 accords trouvés par les deux méthodes, **10 974 trouvés seulement par la
sous-chaîne**, soit 19 %. Exemple typique : `corrige` dans `corriger`, une
variante morphologique.

Un index de mots entiers aurait donc changé ce que la personne voit. La
condition « rien de visible » n'était PAS remplie.

#### La forme qui garde les deux, et sa vérification

Pour un mot cherché, réunir les listes de tous les mots du VOCABULAIRE qui le
contiennent. Le raisonnement : tout accord de sous-chaîne dans le texte a lieu à
l'intérieur d'un mot entier, et ce mot est au vocabulaire.

**Ce raisonnement était faux, et la mesure l'a dit.** Une divergence sur 632 :
le mot `nouvel`, 158 fiches manquantes. Cause : `nouvel` est une sous-chaîne de
`nouvelle`, qui est un MOT VIDE — donc exclu du vocabulaire alors qu'il est
présent dans le texte.

Remède : les mots vides entrent au vocabulaire de l'index, tout en restant
exclus du SCORE. Vérifié : **zéro divergence sur 632 mots**, les deux méthodes
rendent exactement le même ensemble. Le poids ci-dessus (1 311 Ko) les inclut
déjà.

#### Ce qui reste non mesuré, et je ne le compte pas comme acquis

**Combien d'actualités restent sans rattachement** dans le contenu réel. Les
actualités ne sont pas dans `content/` — elles viennent d'un flux —, donc je ne
peux pas le mesurer hors ligne. Cela ne change pas la décision, puisque le gain
est acquis dès qu'un seul écran charge l'index ; cela change seulement combien
de personnes en profitent.

Et les 632 mots d'épreuve sont le vocabulaire des TITRES, non de vraies
actualités. L'équivalence vérifiée porte sur eux ; elle est démontrable en
général, mais sa démonstration vient d'être prise en défaut une fois, donc je
la donne pour vérifiée sur cet échantillon et non pour prouvée.

### c. Ce qu'il faudrait encore mesurer si l'on va plus loin

- **le poids réel du second index.** Estimé, non mesuré : quelques centaines de
  mots par fiche, soit de l'ordre du mégaoctet avant chiffrement. Un index
  inversé — mot vers identifiants — dédupliquerait les mots entre fiches et
  pèserait probablement beaucoup moins. **À mesurer, pas à supposer** : c'est
  précisément l'erreur que ce document évite au sujet du manifeste.
- **combien d'actualités restent sans rattachement**, dans le contenu réel. Si
  c'est presque toujours le cas, « différé » veut dire « payé quand même, plus
  tard ». Si c'est rare, le gain porte sur peu de monde et la priorité baisse.
- **ce que le repêchage trouve réellement.** Un signal qui ne change jamais le
  résultat ne vaut aucun octet ; un signal qui évite des actualités orphelines
  en vaut. Mesurable en comparant les rattachements avec et sans index.

### c. Et ce qui est certain dès maintenant

Le commentaire d'`actualites.astro` doit dire 8,8 Mo et non « plus d'un
mégaoctet ». C'est une correction sans risque, et un commentaire faux sur un
ordre de grandeur est ce qui fait juger qu'un chargement différé suffit.
