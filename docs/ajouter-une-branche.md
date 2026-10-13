# Ajouter une branche à Cyclades

*Exigé par le prompt 21 § 3.4. Écrit le 13 octobre 2026 (D-014).*

Une **branche** est un domaine d'usage, avec ses écrans, ses données et ses
règles. Trois existent : Révisions, Odyssée, Sport.

Le registre `src/lib/branches.ts` a été écrit pour qu'une branche s'ajoute
**sans toucher à la mise en page**. Son commentaire le dit : « la prochaine
branche n'aura donc aucune ligne à ajouter dans `Base.astro` ». C'était une
bonne décision d'architecture, et elle n'avait jamais été écrite en mode
d'emploi : la connaissance était dans le code, et le code ne se lit pas quand
on cherche *par où commencer*.

---

## 1. Déclarer la branche, et la laisser fermée

Dans `src/lib/branches.ts`, ajoutez une entrée à `BRANCHES` :

```ts
{
  id: 'lecture',                       // jamais renommé : il voyage dans les faits
  libelle: 'Lecture',                  // « Lecture », jamais « Cyclades · Lecture »
  icone: '📖',
  description: 'Ce que je lis, ce que j’en retiens.',
  racine: '/lecture/',                 // aucune branche n’occupe « / » : c’est le menu
  disponible: false,                   // ← fermée tant qu’elle n’a pas d’écran
  onglets: [],
},
```

**`disponible: false` n'est pas une formalité.** Un onglet qui mène à une page
vide ne renseigne personne : il promet. Tant que le drapeau est à `false`, la
branche existe pour le code — les faits peuvent la nommer, la matrice
inter-branches peut s'y référer — et n'apparaît nulle part dans l'interface.

**L'identifiant ne se renomme pas.** Il est écrit dans les faits de domaine
déjà enregistrés, dans les désaccords inter-branches, et dans les sauvegardes.
Le changer d'avis après coup coûte une migration.

## 2. Écrire les écrans

Un fichier par écran sous `src/pages/<racine>/`. Chacun ouvre sur le gabarit
commun :

```astro
<Base titre="Mon écran" actif="accueil">
```

`actif` est l'identifiant de l'onglet courant : c'est lui qui met l'onglet en
évidence. La mise en page déduit la branche **du chemin** (`brancheDuChemin`),
et vous n'avez rien à lui dire.

Si un écran doit vivre hors de la racine — par héritage de chemin —, déclarez
son chemin complet dans l'onglet : c'est le cas de « Mes synthèses », onglet
d'Odyssée hébergé à `/syntheses/`, et `brancheDUnOnglet` sait le rattacher.

## 3. Déclarer les onglets

Dans la même entrée du registre :

```ts
onglets: [
  { id: 'accueil', libelle: 'Tableau de bord', court: 'Accueil', chemin: '/lecture/', icone: '🏠' },
  { id: 'livres',  libelle: 'Mes livres',      court: 'Livres',  chemin: '/lecture/livres/', icone: '📚' },
],
```

- `libelle` : le nom complet, lu par les lecteurs d'écran et affiché en
  info-bulle.
- `court` : ce qui s'affiche à côté de l'icône sur les grands écrans. La barre
  d'onglets est un budget d'attention : un onglet de plus se paie sur tous les
  autres.
- Un écran qui ne mérite pas d'onglet va dans `annexes` : il n'apparaît pas
  dans la barre, mais le pied de page le nomme, **dans sa branche**.

## 4. Les données

Déclarez vos magasins dans `src/lib/db.ts`, dans une migration numérotée, et
inscrivez-les :

| Où | Pourquoi |
|---|---|
| `src/lib/sauvegarde/groupes.ts` | sinon ils ne sont ni sauvegardés ni élagués |
| `src/lib/noyau/coffre.ts` | si les données sont sensibles : santé, psyché, finances, corps |
| `src/lib/noyau/permissions.ts` | qui peut lire quoi entre branches |

**Un magasin oublié dans `groupes.ts` est un magasin qu'une restauration ne
rendra pas.** C'est le défaut le plus coûteux de cette liste, et le seul qui
ne se voie pas avant le jour où l'on en a besoin.

## 5. Ouvrir

Passez `disponible: true`. Rien d'autre : la barre d'onglets, le sélecteur de
branche de l'en-tête et le pied de page contextuel se remplissent seuls depuis
le registre.

## 6. Vérifier

```bash
npx astro check                      # 0 erreur
npm run build                        # le site se construit
npm run essais:noyau                 # faits, propriétaires, permissions
npm run essais:sauvegarde:cyclades   # l’aller-retour couvre les magasins neufs
```

Puis, à 360 px dans un navigateur : l'en-tête ne déborde pas, et le pied de
page de la nouvelle branche montre **ses** onglets.

**Ce que les essais ne couvrent pas, et qu'il faut donc regarder soi-même.**
Aucun essai ne lit le registre des branches pour lui-même : `essais:noyau`
vérifie seulement que chaque propriétaire de fait est une branche déclarée, et
une de ses assertions nomme en dur « les trois branches » — elle est à étendre
quand une quatrième arrive. Un onglet dont le chemin ne mène nulle part, une
racine en doublon ou un `court` qui déborde la barre ne seront signalés par
rien : c'est au navigateur de le dire.

---

## Ce qu'il ne faut pas faire

- **Toucher à `Base.astro`.** Si vous devez le modifier pour ajouter une
  branche, c'est que le registre manque quelque chose : complétez le registre.
- **Occuper `/`.** C'est le menu, et il est au-dessus des branches.
- **Renommer une racine après coup.** Les chemins sont écrits dans les
  manifestes du contenu chiffré ; un renommage casse en silence.
