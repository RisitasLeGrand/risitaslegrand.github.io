# Prompt 58, partie 2 — confrontation à l'état de `main`

Première étape de la méthode du prompt : « confronter chaque constat à l'état
actuel de main, puis noter pour chacun *encore vrai*, *déjà corrigé* ou
*contesté* ». Fait par lecture du code sur `main` à `33f701c`, le 25 octobre.

Rien n'est commencé. Ce document est préparé en local, `main` étant gelé le
temps que l'agent A livre son train d'intégration.

| Point | Verdict | Ce qui l'établit |
|---|---|---|
| **B-2** la clé du coffre n'est pas partagée | **encore vrai, et actif** | aucun identifiant de clé nulle part ; et **17 des 28 magasins scellés sont journalisés aujourd'hui**, donc déjà expédiés d'un appareil à l'autre, où ils arrivent illisibles |
| **B-6** la Santé ne passe pas d'un appareil à l'autre | **encore vrai** | aucun des six magasins de Santé n'apparaît au registre des magasins journalisés |
| **B-7** la restauration ne demande rien | **encore vrai** | aucune trace de « remplace » ou « s'y ajoute » dans les écrans de restauration |
| **G-3** les textes rédigés | **EN PARTIE, et c'est la bonne nouvelle** | voir ci-dessous |
| **G-4** une suppression écrase une modification | **encore vrai** | `supprimees()` ramasse les pierres tombales sans condition : la suppression gagne toujours |
| **M-1 / M-2** l'en-tête en clair | **encore vrai** | `VERSION_FORMAT = 1`, en-tête « une ligne de JSON lisible », et `magasins` y porte le compte par magasin **en clair** |
| **G-7** la version de schéma | **encore vrai, et pire que décrit** | `SCHEMA_REVISIONS = 12` est toujours écrit en dur alors que la base est en **v35** — l'audit disait v33, l'écart s'est creusé à 23 versions |

## G-3 — le mécanisme existe déjà, et il est bien pensé

`TYPES_TEXTE_A_CONFLIT` existe, à côté de `TYPES_A_CONFLIT_EXPLICITE`, et la
raison des deux listes est écrite : la première porte un invariant **vérifié**
— un type à conflit explicite est un type *sensible* au sens d'E.5 — et une
note de séance n'est pas sensible. Elle est **irremplaçable**, ce qui n'est pas
la même chose : « sensible » dit qui peut la lire, « irremplaçable » dit ce que
coûte sa perte.

Mais la liste ne contient **qu'un** type : `revision.note-seance`.

Le prompt en demande quatre de plus — journal Odyssée, revues, notes, tâches.
Le travail n'est donc pas d'inventer un mécanisme, c'est de **déclarer les
types**, en vérifiant pour chacun l'invariant que la liste s'impose : déclaré
au catalogue, de nature `texte`, et **pas** sensible — sinon il va dans l'autre
liste.

C'est un bon exemple de ce que la confrontation sert à voir : écrit sans lire,
ce point aurait fabriqué un second mécanisme à côté d'un mécanisme correct.

## G-7 — ce qui manque exactement

L'en-tête porte déjà la version du **format de fichier** et celle de
l'**application**. Il ne porte pas la version du **schéma de la base**, qui est
pourtant celle dont dépend la lisibilité des magasins restaurés. Le point n'est
donc pas « écrire une version » mais « écrire la troisième », et brancher
dessus la migration ou le refus motivé.

Pire : la valeur écrite n'est pas seulement absente, elle est **fausse**.
`SCHEMA_REVISIONS = 12` est figé dans `sauvegarde/service.ts` pendant que la
base tourne en v35. Un fichier produit aujourd'hui annonce donc une version
qu'il n'a pas, et la restauration ne lit même pas le champ. C'est le même
défaut que les nombres figés de la partie 1, au pire endroit possible.

## UNE CORRECTION À MA PREMIÈRE LECTURE

J'avais écrit ici que « les magasins scellés ne sont pas journalisés ». **C'est
faux**, et je l'avais écrit en interrogeant le mauvais module —
`sync/faits-domaine.ts`, qui réexporte la liste, au lieu de
`noyau/enregistrements.ts`, qui la définit.

Mesuré correctement : **28 scellés, 46 journalisés, 17 à la fois.**

Cela change la gravité de B-2. Ce ne sont pas des données qui *seraient*
illisibles si on les synchronisait un jour : dix-sept magasins scellés partent
déjà dans les paquets, aujourd'hui, et arrivent illisibles en face — en rendant
du même coup illisibles les données locales de l'appareil qui reçoit, puisque
les lecteurs sont en `Promise.all`. Vingt-cinq appels de ce genre dans huit
modules de lecture.

L'audit disait 18 ; il en reste 17. L'écart tient aux remaniements depuis
`61f93b7`, et non à une erreur de l'audit.

## Ce que je ne peux pas confronter ici

Les §§ 3, 4 et 7 de l'audit font foi pour le détail — fichier, ligne,
reproduction — et ils ne me sont pas encore parvenus. Les reproductions de
l'audit doivent devenir des essais, rouges avant correction : je ne peux pas
les écrire sans elles.

Et rien de ce qui touche au contenu ne se construira tant que le corpus n'est
pas revenu.

## L'ordre que je propose

1. **B-2** d'abord, et plus fermement encore depuis la mesure ci-dessus : dix-sept
   magasins scellés voyagent déjà. La proposition 3 prévoit d'ailleurs un
   palier — « en attendant, les magasins scellés ne sont plus journalisés, et
   l'écran le dit ». C'est ce palier qu'il faut poser **en premier**, avant même
   la clé partagée : il arrête la perte pendant qu'on construit le reste.
   Et **B-6 dépend de B-2** explicitement — « les six magasins de Santé sont
   journalisés, scellés, **après la clé partagée** ».
2. **G-3**, qui est le moins cher : quatre déclarations et leur invariant.
3. **G-4**, qui touche le moteur de fusion et demande de la prudence.
4. **B-7**, indépendant.
5. **M-1 / M-2** et **G-7** ensemble : les deux touchent l'en-tête du fichier,
   et les faire séparément écrirait deux fois la même migration.

---

# Le premier lot, arrêté et approuvé (25 octobre)

Spécifié au fil de la nuit, approuvé tel quel par le pilote. **Il passe avant
la clé partagée**, parce qu'il arrête une perte en cours pendant qu'on
construit le reste.

## Ce qu'il fait

1. **Le palier** : les 17 magasins scellés cessent d'être journalisés, et
   l'écran le dit. C'est la proposition 3 de l'audit, prise à la lettre.
2. **Les lecteurs deviennent tolérants** : `Promise.allSettled` à la place de
   `Promise.all` — 25 appels dans 8 modules. Sans cela, un seul scellé
   étranger continue de rendre illisibles les données **locales**.
3. **Les entrées isolées sont comptées et nommées.**

## Deux phrases distinctes à l'écran, et non une

- « vient d'un autre appareil » ;
- « vient d'un coffre précédent de **cet** appareil ».

Les deux n'appellent pas le même geste. Une phrase unique ferait chercher au
mauvais endroit.

Le diagnostic sort du **désaccord entre deux moyens indépendants** :

| Moyen | Ce qu'il lit | Ce qu'il coûte |
|---|---|---|
| le journal | `lot === SANS_LOT` ⇒ écrite ici ; un lot de fusion ⇒ venue d'ailleurs | rien : aucun déchiffrement |
| l'échec de déchiffrement | l'entrée est illisible avec la clé d'aujourd'hui | une tentative, désormais sans danger |

Une entrée **locale et illisible** est donc celle d'un coffre précédent. C'est
le cas que l'audit soupçonnait sans le vérifier.

La preuve de provenance survit : la compaction n'efface que les faits d'une
cible **supprimée**, jamais ceux d'une cible vivante.

## La règle qui tient tout

**Isoler, c'est écarter, compter et dire. Jamais supprimer.**

Ces entrées redeviendront lisibles le jour où la clé partagée arrivera ; les
effacer maintenant transformerait un défaut réparable en perte définitive.
L'isolement est une **lecture**, pas une écriture.

## Les deux essais qui décident

1. **Celui qui dit si le lot a réussi** : après réception d'un scellé étranger,
   les données **locales** de l'appareil qui reçoit sont de nouveau lisibles.
2. **Celui qui tient la règle** (demandé par le pilote) : toute écriture ou
   suppression portant sur une entrée isolée **échoue**. La règle cesse ainsi
   de dépendre de la discipline de celui qui écrira le code suivant.
