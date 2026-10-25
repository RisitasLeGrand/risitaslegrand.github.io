# Prompt 58, partie 2 — confrontation à l'état de `main`

Première étape de la méthode du prompt : « confronter chaque constat à l'état
actuel de main, puis noter pour chacun *encore vrai*, *déjà corrigé* ou
*contesté* ». Fait par lecture du code sur `main` à `33f701c`, le 25 octobre.

Rien n'est commencé. Ce document est préparé en local, `main` étant gelé le
temps que l'agent A livre son train d'intégration.

| Point | Verdict | Ce qui l'établit |
|---|---|---|
| **B-2** la clé du coffre n'est pas partagée | **encore vrai** | aucun identifiant de clé nulle part dans `coffre.ts` ni `coffre-cles.ts` ; les magasins scellés ne sont pas journalisés |
| **B-6** la Santé ne passe pas d'un appareil à l'autre | **encore vrai** | aucun des six magasins de Santé n'apparaît au registre des magasins journalisés |
| **B-7** la restauration ne demande rien | **encore vrai** | aucune trace de « remplace » ou « s'y ajoute » dans les écrans de restauration |
| **G-3** les textes rédigés | **EN PARTIE, et c'est la bonne nouvelle** | voir ci-dessous |
| **G-4** une suppression écrase une modification | **encore vrai** | `supprimees()` ramasse les pierres tombales sans condition : la suppression gagne toujours |
| **M-1 / M-2** l'en-tête en clair | **encore vrai** | `VERSION_FORMAT = 1`, en-tête « une ligne de JSON lisible », et `magasins` y porte le compte par magasin **en clair** |
| **G-7** la version de schéma | **EN PARTIE** | l'en-tête porte `versionFormat` et `versionApplication`, mais **pas** la version du schéma IndexedDB (35 aujourd'hui) |

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

## Ce que je ne peux pas confronter ici

Les §§ 3, 4 et 7 de l'audit font foi pour le détail — fichier, ligne,
reproduction — et ils ne me sont pas encore parvenus. Les reproductions de
l'audit doivent devenir des essais, rouges avant correction : je ne peux pas
les écrire sans elles.

Et rien de ce qui touche au contenu ne se construira tant que le corpus n'est
pas revenu.

## L'ordre que je propose

1. **B-2** d'abord, parce que **B-6 en dépend explicitement** — « les six
   magasins de Santé sont journalisés, scellés, **après la clé partagée** ».
2. **G-3**, qui est le moins cher : quatre déclarations et leur invariant.
3. **G-4**, qui touche le moteur de fusion et demande de la prudence.
4. **B-7**, indépendant.
5. **M-1 / M-2** et **G-7** ensemble : les deux touchent l'en-tête du fichier,
   et les faire séparément écrirait deux fois la même migration.
