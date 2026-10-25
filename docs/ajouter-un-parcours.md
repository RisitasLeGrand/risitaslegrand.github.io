# Ajouter un parcours de concours

*Exigé par le prompt 20 (§ liv.1). Écrit le 13 octobre 2026 (D-014).*

Un **parcours** est un concours préparé. Quatre sont déclarés : INSP (par
défaut), DGFiP B, DGFiP A, DGFiP A+. Un parcours décide des thèmes de
planification, des matières, du filtre de la banque de QCM et du concours
nommé dans le prompt « Demander à l'IA ».

Ne confondez pas avec une **branche** : une branche est un domaine d'usage
(Révisions, Odyssée, Sport), un parcours est une déclinaison de Révisions.
Voir [`ajouter-une-branche.md`](ajouter-une-branche.md).

---

## 1. Déclarer le parcours

Dans `src/lib/parcours/registre.ts`, ajoutez une entrée à `PARCOURS` :

```ts
{
  id: 'dgfip-c',
  libelle: 'DGFiP C',                  // court : il tient dans l’en-tête
  intitule: 'Agent administratif des finances publiques',
  racineContenu: '/dgfip-c',           // '' pour l’INSP, par héritage
  themes: [],                          // ← vide tant que le référentiel n’est pas établi
}
```

**`themes: []` est une valeur légitime, pas une absence à combler.** Le
registre le dit déjà : « Les programmes des concours de la DGFiP doivent venir
de sources officielles et **ne jamais être inventés** : un programme faux
produirait des mois de révision à côté du sujet. » Un parcours vide s'affiche
proprement et dit que sa planification attend son référentiel.

## 2. Le contenu

Les fiches vont dans `content/<racineContenu>/<matière>/`.

**L'INSP garde la racine vide**, et c'est une décision tracée, pas un oubli :
l'identifiant d'une fiche est un hachage de son **chemin relatif**
(`idStable(relatif)`). Déplacer sous `content/insp/` les
425 fiches existantes — comptées le 13 octobre 2026 ; l'audit de parité en
annonce 262, chiffre du 10 octobre que le contenu a depuis dépassé — les ferait toutes
changer d'identifiant, et la progression
FSRS, le journal d'erreurs, les niveaux estimés et les podcasts y sont tous
rattachés. La migration coûterait l'historique entier pour un gain
d'esthétique.

## 3. La banque de QCM

Chaque question porte `categorie_origine` : `A`, `B` ou `maison`. La règle de
tirage est dans `src/lib/qcm-temporalite.ts` :

| Parcours | Tire dans |
|---|---|
| `dgfip-b` | `B` et `maison` |
| `dgfip-a`, `dgfip-ap` | `A`, `B` et `maison` |
| `insp`, inconnu | tout |

Si votre parcours doit tirer autrement, c'est `origineAdmise()` qu'on modifie
— une fonction de cinq lignes, dont le commentaire porte la règle du prompt.

## 4. Vérifier

```bash
npm run essais:parcours
npm run check-content
npm run build
```

Puis, dans le navigateur : le sélecteur de l'en-tête — visible **dans
Révisions seulement** — propose le parcours, et le choisir recharge la page.

---

## Ce qui est partagé, et ce qui ne l'est pas

Le relevé fonctionnalité par fonctionnalité est dans
[`docs/cyclades/audit-parite.md`](cyclades/audit-parite.md), mesuré et daté ;
ne le recopiez pas ici, il bougera. Trois choses à savoir avant de commencer :

- **La rotation est stockée par parcours** — « les sept matières de l'INSP ne
  sont pas celles d'un concours de la DGFiP », dit `rotation.ts`. C'est le
  pivot : la planification fait tourner les séances, donc les rappels, donc le
  journal d'erreurs.
- **Cog-Training est partagé par nature.** Aucun de ses moteurs ne connaît de
  matière ni de concours.
- **Le glossaire est commun** — un seul `content/glossaire.yml`, sans surcharge
  par parcours à ce jour.
- **Une fiche appartient aux parcours de sa racine.** `content/dgfip-b/` sert
  DGFiP B ; `content/commun/` sert les trois parcours DGFiP ; la racine de
  `content/` sert l'INSP. Le build écrit ces parcours dans le manifeste
  (`parcoursServis` et `racine`), et `chargerManifeste()` rend un manifeste
  **déjà réduit au parcours ouvert**, totaux recalculés
  (`src/lib/parcours/filtre-du-manifeste.ts`). C'est ce qui permet à deux
  parcours de déclarer la **même matière** sans se voler leurs fiches —
  « Organisation de la DGFiP » est déclarée par DGFiP B et par DGFiP A,
  délibérément, parce que c'est la même matière.

  **Le tri est en amont, et une seule fois.** J'avais d'abord filtré dans
  `fichesDuTheme`, en écrivant que la séance était le seul écran qui doive
  trancher. C'était faux sur un point : `totaux.fiches` est lu par les
  statistiques et par l'estimation de niveau, et un manifeste filtré qui
  garderait les totaux d'origine annoncerait « 427 fiches » à qui n'en voit que
  quatre. Un filtre local ne pouvait pas les recalculer. Le prédicat local a
  donc été retiré : la même règle gardée à deux endroits, c'est la divergence
  garantie le jour où l'une des deux change.

  **Ce qui propose est filtré ; ce qui raconte voit tout.** C'est la ligne de
  partage arrêtée le 25 octobre. Proposent : la séance, les révisions dues,
  l'épreuve blanche, la bibliothèque, la recherche, le niveau — tous par
  `chargerManifeste()`. Racontent ou conservent : l'historique, les
  statistiques, l'export, la sauvegarde, la restauration, la synchronisation —
  un historique de révision ne change pas de parcours parce qu'on change
  d'onglet, et une sauvegarde qui n'emporterait que le parcours ouvert serait
  une sauvegarde incomplète sans le dire. Ces écrans passent par
  `chargerManifesteComplet()`.
- **Un thème peut être une épreuve, et non des connaissances** (`epreuve: true`).
  Ses matières n'entrent alors pas dans l'estimation de niveau : une note de
  type Elo ne mesure rien sur un oral de quarante minutes où l'on expose son
  parcours. Un seul thème le déclare à ce jour, l'entretien avec le jury de
  DGFiP A+.

**Le mot de passe et la clé de déchiffrement sont les mêmes pour tous les
parcours.** Il n'y en a qu'un, et il ouvre tout.
