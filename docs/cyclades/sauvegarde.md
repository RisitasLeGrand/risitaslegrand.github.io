# La sauvegarde `.cyclades`

Livrable de la phase 2. La sauvegarde est la **seule** protection contre une
perte totale : tout ce que porte Cyclades tient dans l'IndexedDB d'un
navigateur, et le site n'a pas de serveur pour sauvegarder à la place de la
personne.

## La forme du fichier

```
CYCLADES-SAUVEGARDE\n                  ← ligne de reconnaissance
{"format":"cyclades-sauvegarde",…}\n   ← en-tête, une ligne de JSON lisible
<charge utile binaire>                 ← comprimée, puis chiffrée
```

L'en-tête est **en clair, même quand la charge utile est chiffrée**. Retrouver
dans six mois ce que contient un fichier et de quand il date ne doit pas
demander de le déchiffrer. Il ne porte donc que des noms de magasins, des
compteurs, une date, des versions et les paramètres de dérivation — aucune
donnée personnelle.

### Comprimer puis chiffrer, dans cet ordre

L'ordre inverse ne marcherait pas : des données chiffrées ressemblent à du bruit
et ne se compressent plus du tout. Mesuré sur soixante séances de vraies notes,
le fichier pèse **0,8 %** du clair.

### La somme de contrôle porte sur les octets du fichier

Et non sur le contenu en clair, qui serait le réflexe. Deux raisons :

1. AES-GCM **authentifie déjà** le clair : une altération du chiffré fait échouer
   le déchiffrement, sans qu'aucune somme n'ait à le dire.
2. Une empreinte du clair, écrite en clair dans l'en-tête, permettrait de
   confirmer une hypothèse sur le contenu d'un fichier chiffré. Oracle faible,
   mais gratuit à éviter.

La somme sert donc à ce qu'une somme sert vraiment ici : dire si le fichier est
arrivé entier. Utile dans les deux cas, chiffré ou non.

## L'ancien mot de passe ouvre l'ancienne sauvegarde

Le sel et le nombre d'itérations voyagent **dans le fichier et nulle part
ailleurs**. Une sauvegarde garde donc, pour toujours, le mot de passe qu'elle
avait le jour où elle a été faite.

Ce n'est plus un cas d'école : **le mot de passe du site a changé le 11 octobre
2026**, l'ancien ayant été publié par inadvertance dans huit scripts d'essai
suivis par Git. Toute sauvegarde antérieure à cette date s'ouvre avec l'ancien
mot de passe, et seulement avec lui.

Le message d'erreur du mauvais mot de passe le dit explicitement, et un essai
vérifie qu'il le dit — un message qui laisserait croire au fichier abîmé ferait
jeter une sauvegarde valide.

## Ce que le fichier ne contient jamais

- le mot de passe du site ;
- la clé dérivée de la session ;
- le contenu de cours chiffré du site, qui vient du dépôt et se reconstruit.

Les trois sont vérifiés par essai, et pas seulement par relecture : la propriété
est facile à perdre par inadvertance — il suffirait qu'un futur appelant passe
le mot de passe dans un champ de l'en-tête « pour information ».

## Pourquoi il n'y a pas de mode « Fusionner », et ce que je propose

Le prompt demande deux modes, **Remplacer** et **Fusionner** (« union par
identifiant, la dernière modification l'emporte »), et ajoute : « si la fusion
s'avère trop risquée pour un magasin donné, le plan le dit et propose son
traitement ; ne pas improviser ».

**Elle est trop risquée aujourd'hui, pour tous les magasins, et pour une raison
unique : les enregistrements ne portent pas de date de dernière
modification.** Sans elle, « la dernière modification l'emporte » n'a pas de
sens — il n'y a rien à comparer.

Les contournements qu'on serait tenté d'improviser sont tous faux :

| Contournement | Pourquoi il est faux |
|---|---|
| Garder « le plus avancé » (plus de révisions, intervalle plus long) | Une carte oubliée sur l'autre appareil a *moins* de révisions et un intervalle *plus court*, et c'est elle qui dit la vérité la plus récente |
| Ajouter les sessions des deux côtés | Les identifiants sont auto-incrémentés et collisionnent entre appareils. Le défaut existait déjà : restaurer deux fois la même sauvegarde doublait l'historique de Cog-Training |
| Prendre le fichier pour les magasins d'état, le local pour les journaux | Deux vérités partielles cousues ensemble, dont aucun écran ne sait plus laquelle il lit |

**Le traitement proposé**, dans cet ordre :

1. **Ajouter `majLe` à chaque enregistrement**, écrit à chaque modification.
   C'est ce que demande la section 1.4 du prompt (« chaque enregistrement porte
   un identifiant unique et une date de dernière modification : cela rend
   possible une fusion entre deux appareils sans l'imposer »). Sans cette
   étape, rien d'autre n'est possible.
2. **Faire déclarer à chaque branche sa règle de fusion, magasin par magasin** :
   dernière écriture gagnante pour les états, union pour les journaux
   append-only une fois leurs identifiants rendus globalement uniques, et
   **refus explicite** pour les magasins où la fusion n'a pas de sens.
3. **Garder l'export JSON existant** en attendant. Il a sa propre fusion,
   imparfaite mais éprouvée, et il reste le bon outil pour l'usage auquel il
   était destiné : synchroniser deux appareils à la main.

En attendant, `.cyclades` fait ce qu'il sait faire sans mentir : **Remplacer**,
avec un instantané de sécurité téléchargé avant d'écrire.

## Le déroulé d'une restauration

1. **Vérifier d'abord.** Le fichier choisi est lu, son en-tête et sa somme de
   contrôle contrôlés, et un résumé affiché : date, version, branches, nombre
   d'enregistrements, chiffrement. **Rien n'est appliqué.**
2. **Le mot de passe est demandé** seulement si le fichier est chiffré, avec le
   rappel que l'ancien peut être nécessaire.
3. **L'instantané de sécurité** est proposé, coché par défaut. Il faut le
   décocher explicitement pour s'en passer : c'est le dernier moment où l'état
   présent existe encore.
4. **La relecture précède l'écriture.** Si le fichier est refusé — mauvais mot
   de passe, somme fausse, version future — la base n'a pas été touchée. Un
   essai le vérifie en tentant une restauration avec un mauvais mot de passe et
   en contrôlant que rien n'a bougé.
5. **Les magasins inconnus sont comptés et laissés de côté**, jamais écrits à
   l'aveugle. Une sauvegarde écrite par une version future, qui porterait des
   magasins de Sport ou d'Odyssée, se restaure pour ce que cette version sait
   lire, et le dit.

Une version de format **plus récente** est refusée, pas devinée : deviner le
sens d'un champ inconnu ferait plus de dégâts que de refuser.

## Le rappel

La date de la dernière sauvegarde réussie vit dans `etat`, donc **elle part dans
la sauvegarde**. Conséquence voulue : restaurer une sauvegarde vieille de trois
mois ramène « dernière sauvegarde il y a trois mois », et la bannière se
rallume. C'est la vérité — l'état restauré n'a pas été sauvegardé depuis — et
c'est exactement le moment où il faut en refaire une.

Quatre états, et le ton monte avec le temps : *jamais*, *à faire*, *ancienne*
(au-delà de 30 jours), *à jour*. **Aucun n'est bloquant et aucun ne pénalise la
série.** Le site ne peut pas sauvegarder à la place de la personne, et le lui
faire payer serait punir une limite qui n'est pas la sienne.

## L'export lisible, qui n'est pas une sauvegarde

Deux fonctions distinctes, et les confondre rendrait les deux mauvaises.

| | `.cyclades` | Export lisible |
|---|---|---|
| Sert à | **revenir en arrière** | **partir ailleurs** |
| Contenu | exhaustif | un domaine à la fois |
| Forme | compressée puis chiffrée | CSV ou JSON en clair |
| Réimportable | oui | **non** |

L'export lisible existe pour la portabilité : ouvrir ses données dans un
tableur, les donner à un autre outil. L'écran le dit explicitement, parce que
croire qu'on a sauvegardé alors qu'on a exporté est exactement l'erreur qui
coûte tout.

**Le CSV suit les conventions françaises**, et ce n'est pas un détail : un CSV
séparé par des virgules, avec des points décimaux et sans BOM, s'ouvre dans
Excel en français comme **une seule colonne de texte**. Le fichier est juste et
inutilisable. D'où le point-virgule, la virgule décimale, le BOM UTF-8 et les
fins de ligne CRLF.

Les colonnes sont l'**union** de toutes les clés rencontrées, et non celles du
premier enregistrement : un champ optionnel absent de la première ligne — comme
`pretesteeLe` sur une fiche jamais prétestée — disparaîtrait sinon pour tout le
monde.

## L'effacement ciblé : compter, puis choisir

Un effacement est la seule opération du site qui soit **définitive sans
recours**. Une restauration se défait en restaurant autre chose ; un effacement
ne se défait pas.

Le module expose donc deux fonctions prenant le **même filtre** : `compter()`
dit exactement ce qui partirait, `effacer()` le fait. L'écran impose le premier
avant le second, et n'efface qu'après un choix explicite entre « sauvegarder
d'abord » et « effacer sans sauvegarder ».

**Les magasins qui portent un état courant refusent d'être découpés par
période**, et le disent. Une carte porte `derniereRevision` et `du`, qui
ressemblent à des dates : les prendre pour la date de l'enregistrement
effacerait l'état d'une carte sous prétexte qu'elle n'a pas été revue
récemment — c'est-à-dire précisément les cartes qu'il faut garder. Le champ de
date de chaque magasin est donc **déclaré** dans `groupes.ts`, et `null` y
signifie « pas d'historique, ne pas découper ».

Un magasin épargné en silence ferait croire à un effacement complet qui n'a pas
eu lieu : le décompte et le message final nomment donc ceux qui restent entiers.

## Pourquoi il n'y a pas encore de sauvegarde partielle par parcours

Le prompt la demande : « par branche (et, dans Révisions, par parcours), pour
pouvoir exporter ou effacer une branche sans toucher aux autres ».

**Aucun enregistrement ne porte d'identifiant de parcours.** Les cartes sont
clés par fiche, les compétences par matière, les séances par thème — et rien
n'y dit à quel parcours ces fiches, matières et thèmes appartiennent. Un filtre
« par parcours » ne pourrait donc rien filtrer : il rendrait tout, ou rien.

Et aujourd'hui cela ne changerait rien de visible, puisque l'INSP est le seul
parcours qui porte du contenu. Une sélection « par parcours » serait un écran
qui promet un découpage qu'il ne fait pas — pire que son absence.

Ce qui existe à la place, et qui est honnête :

- la portée (branches et parcours) est **inscrite dans l'en-tête** de chaque
  sauvegarde, donc un fichier sait déjà dire ce qu'il couvre ;
- le découpage par **domaine** est offert, et il est réel ;
- le groupement des magasins (`groupes.ts`) est la structure sur laquelle le
  découpage par parcours se greffera.

**Ce qu'il faudra pour le faire vraiment** : un champ `parcours` sur les
enregistrements des magasins qui en dépendent, écrit au moment de la création.
Ce sera naturel quand le contenu DGFiP existera — un enregistrement créé depuis
un parcours DGFiP saura d'où il vient — et artificiel avant.

## Ce qui reste à faire sur ce chantier

- **Destination du fichier** : téléchargement seulement pour l'instant. La
  feuille de partage du système sur mobile et l'enregistrement dans un dossier
  mémorisé avec rotation (API File System Access) restent à écrire.
- **Sauvegarde partielle par parcours** : bloquée par l'absence d'identifiant de
  parcours sur les enregistrements, voir ci-dessus.
- **Sauvegarde proposée avant une opération risquée** : faite pour la
  restauration et pour l'effacement ciblé, à faire pour la migration de schéma.
- **`majLe` sur chaque enregistrement**, qui débloque la fusion.
