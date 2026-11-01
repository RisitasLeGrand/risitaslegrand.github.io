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


---

# Suite du 1er novembre : les deux mesures, et ce qu'elles ont changé

## Le coût par page : 159 ms, et aucune phase ne domine

Mesuré dans le navigateur, sur le vrai fichier, par
`npm run mesure:repechage` :

| phase | avant |
| --- | --- |
| `JSON.parse` de l'enveloppe base64 | 16 ms |
| base64 vers octets | 48 ms |
| AES-GCM `decrypt` | 35 ms |
| décodage UTF-8 | 27 ms |
| `JSON.parse` du clair | 33 ms |
| **par page, hors réseau** | **159 ms** |

PBKDF2 est hors de ce chiffre : ses 600 000 itérations se paient une fois par
session. **Aucune phase ne domine**, et c'est ce qui décidait de la suite : le
coût suit la TAILLE et non une étape, donc alléger paie à proportion.

## La part du repêchage : il ne se retire pas

J'avais écrit « huit mégaoctets pour un `+1` de dernier recours ». Le `+1` est
exact — c'est le score — et **la conclusion qu'on en tirait est fausse** : un
rattachement de score 1 est précisément ce que la personne voit quand rien
d'autre n'a accordé.

| corpus de mots-clés | top 3 changé | sans aucun rattachement sans l'index |
| --- | --- | --- |
| vocabulaire des CORPS (24 964 mots) | 84,1 % | 52,5 % |
| vocabulaire du GLOSSAIRE (3 511 mots) | 65,6 % | 33,5 % |

Le premier est un **plafond très lâche** : ces mots sont dans un corps par
construction. Le second n'est pas choisi pour cela — des termes retenus parce
qu'ils méritent une définition. Aucun n'est un échantillon des vraies
actualités. Mais les deux disent la même chose : **le repêchage est le signal
dominant**, et le retirer rendrait un tiers à une moitié des actualités
orphelines.

## L'index inversé CHANGE ce que la personne voit — mesuré, et abandonné

L'équivalence vérifiée plus haut à « zéro divergence sur 632 mots » portait sur
des mots **isolés**. Or `normaliser` ne retire que les accents et la casse : il
garde les espaces, et `mots_cles` est une liste de chaînes libres. Donc
`texte.includes('finances publiques')` traverse aujourd'hui les frontières de
mots, et **un index de mots ne peut pas le reproduire**.

Mesuré sur les termes du glossaire, qui sont de vraies locutions du domaine :

- **86 % d'entre eux portent un séparateur** (« droit international »,
  « hiérarchie des normes »). Le cas à plusieurs jetons est la règle, pas
  l'exception ;
- la règle de remplacement la plus naturelle — intersection des jetons —
  **diverge sur 350 des 400 premiers**, en ajoutant 11 794 fiches que
  `includes` ne trouve pas. « droit international » passe de 44 fiches à 172.

La condition posée par le Pilote — « si rien ne change pour la personne » —
n'est donc **pas** remplie. L'index inversé est abandonné, et la mesure
précédente (1 311 Ko, 6,4 ×) est juste sur le poids et sans objet sur la
décision.

## Ce qui a été fait : comprimer AVANT de chiffrer

Le gain de compression de 25 % relevé au début de ce document était la
signature du chiffrement : un texte chiffré n'a plus de redondance, donc plus
rien à offrir au compresseur. **La compression du serveur et celle du
navigateur arrivaient toutes deux trop tard.** Comprimer le clair, puis
chiffrer le comprimé, rend la redondance au compresseur — et le clair obtenu
est identique octet pour octet, donc rien ne change pour la personne.

| | avant | après | |
| --- | --- | --- | --- |
| `recherche.json` | 11 371 Ko | **3 270 Ko** | 3,5 × |
| `qcm-dgfip.json` | 667 Ko | **170 Ko** | 3,9 × |
| contenu chiffré en tout | 43 397 Ko | **34 798 Ko** | |
| coût par page, hors réseau | 159 ms | **136 ms** | −14 % |

Le gain de temps est modeste et il faut le dire ainsi : la décompression coûte
43 ms, et elle est en partie payée par les phases qui rétrécissent — enveloppe
16 → 5 ms, base64 48 → 20 ms, AES 35 → 13 ms. **Le vrai gain est le réseau**,
où 8,1 Mo disparaissent de chaque chargement.

Brotli ferait 1,4 fois mieux (1 791 Ko contre 2 452 Ko sur le clair) et
`DecompressionStream` ne le connaît pas — vérifié dans le navigateur du dépôt,
qui n'accepte que `gzip`, `deflate` et `deflate-raw`. Le bloc porte donc un
champ `z` qui dit lequel, pour que le jour où brotli arrive ne demande pas de
republier le reste.

### Le seuil, et pourquoi les petits fichiers n'y touchent pas

256 Ko de clair. Au-dessous, le fichier garde **exactement** la forme qu'il
avait. Ce n'est pas une coquetterie : `temoin`, dans `cle.json`, est le premier
bloc que l'écran de connexion déchiffre, avant tout le reste. Le laisser hors
de la compression garantit qu'une panne de décompression ne peut pas enfermer
la personne dehors.

### Ce que l'essai garde, et que rien d'autre ne garderait

`npm run essais:contenu-comprime`. Si quelqu'un relève le seuil, retire
`gzipSync` ou oublie le champ `z`, **le site continue de marcher
parfaitement** : les fiches s'affichent, la recherche trouve, les actualités se
rattachent — et chaque page redevient huit mégaoctets plus lourde sans qu'aucun
essai ne rougisse. Il n'y a aucun écran à regarder pour cela ; la perte est
invisible par construction.

Les essais de navigateur gardent l'autre moitié : si la décompression était
cassée, `charger` lèverait et la recherche, les actualités et la bibliographie
rougiraient. Ce qui manquait est le sens inverse.

Éprouvé par trois sabotages : le champ `z` retiré → code 1 ; un dossier sans
aucun bloc → code 2 ; un dossier absent → code 2.

**Il n'est PAS proposé au socle**, et la raison est celle du `ffmpeg` : il
refuse quand `public/data/` n'existe pas, donc il rendrait le socle rouge dans
un conteneur neuf où le contenu n'a pas été construit — pour une raison qui
n'est pas la sienne.

### Un commentaire que ce lot a rendu faux, et qui l'aurait resté

`charger` attrapait l'échec de déchiffrement sous un commentaire disant « seul
cas plausible : le fichier vient d'une autre publication que la clé ». La
compression en ajoute un second — un bloc marqué `z` dont le contenu décomprimé
est illisible. Le message ne nomme plus la cause qu'il ne peut pas distinguer ;
il dit ce qui ne va pas et ce qu'il faut faire, et la marche à suivre est la
même dans les deux cas.
