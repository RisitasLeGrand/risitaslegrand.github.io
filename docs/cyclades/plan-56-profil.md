# Prompt 56 — le profil : confrontation, puis plan

Écrit avant d'exécuter, sur `claude/p56` partie d'`origin/main` (`23ba481`).
Chaque constat de l'audit du 54 est confronté au code **avant** d'être repris :
« déjà fait », « à faire », ou « contesté, avec la mesure ». Les mesures de
cette page ont été prises sur l'arbre de travail, pas lues dans l'audit.

---

## 1. Ce que la confrontation donne

### Les bloquants

**B1 — la portée « Lisible par » ne restreint rien : confirmé.**
`profilDeBranche` (`src/lib/profil.ts:65`) n'a **aucun appelant** dans `src/` ;
`pourBranche` n'est appelé que par elle et par `scripts/essais-profil.mts`.
L'export, lui, passe par `repartirProfilPourExport`, qui ne regarde pas la
portée.

Un détail que l'audit ne dit pas et qui aggrave le constat : chaque carte
affiche **deux** phrases fausses, pas une. Les cases « Lisible par » (13 champs
renseignés × 4 branches = 52), et au-dessus une ligne « Utilisé par : … »
calculée par `lecteurs()` sur cette même portée déclarée — donc sur une portée
que personne ne lit. P3 remplace les deux.

**B2 — des réglages déduits affichés mais non appliqués : confirmé, et le
compte est de 5 sur 8, non de 6.**
`reglagesDeduits` rend huit réglages. `reglagesLocaux()` n'a qu'un appelant,
`src/pages/profil.astro:441`.

| Réglage | Appliqué ? | Par quoi |
|---|---|---|
| `bascule-du-jour` | oui | `reglagesJourLogique` → une vingtaine d'appelants |
| `fuseau` | oui | idem |
| `domaines-affiches` | **oui** | `domainesActifs()` (`odyssee-jour.ts:112`), lu par Quêtes, Tâches, Calendrier |
| `jours-de-repos` | non | rien ne nomme `joursTravail` hors `noyau/reglages.ts` |
| `creneaux` | non | idem pour `plagesTravail` |
| `parcours-ouverts` | non | `concours` n'est lu que là et par l'observation |
| `avis-locaux` | non | idem pour `styleAccompagnement` et `heureRappel` |
| `objectif-hebdomadaire` | non | `heuresRevision` et `tempsParSemaine` sont lus par l'adaptation, mais ce réglage-ci n'est appliqué nulle part |

C'est bien la liste du prompt (« la bascule, le fuseau et les domaines »), et
l'audit compte un réglage de trop. La phrase fausse « Un jour de repos ne casse
pas votre série » est dans la `cause` de `jours-de-repos`
(`src/lib/noyau/reglages.ts`) : `gamification.ts` ne nomme jamais
`joursTravail`. Confirmé.

**B3 (U1) — toujours corrigé.** Les cinq champs portent `jamaisExporte`,
`repartirProfilPourExport` écarte l'interdiction **en premier**, et
`src/lib/export-ia.ts` ne nomme aucun champ de naissance : le contrôle du
graphe d'imports (`scripts/essais-contexte-personne.mts`, § 6) le vérifie sur
tout `src/`, avec une liste de six fichiers autorisés dont la taille est
elle-même contrôlée.

**B4 (U2) — toujours corrigé.** La saisie des dates rend `undefined` quand rien
n'a été tapé (`src/pages/initialisation.astro:529-534`), et le commentaire cite
U2.

**B5 — un champ de branche vide ne se renseigne pas depuis le profil :
confirmé.** « Ce qui n'est pas renseigné » est peint depuis `etat.restants`,
qui vient d'`avancement()`, qui ne regarde que `questionsDuSocle()`.

### Les gênants et les mineurs

Confirmés tels quels : G1 (tri alphabétique, socle et branches mêlés), G2
(valeurs brutes, `font-mono`, « posé sur … », « version … »), G3 (cases de
16 px), G4 (le compteur « X réponse(s) sur Y au socle commun »), G6 (« Moment
de ma revue » posé en texte libre alors que seuls `matin` et `soir` sont lus),
G9 (« et mon sexe » sans champ pour le sexe), M1 (« au 16 octobre 2026 » écrit
en dur), M2 (aucun `role="status"` sur les trois zones de message), M3 (le
renvoi « Affichage » entre les champs et les déductions), M4 (l'aide du lever
annonce l'heure de bascule alors que la bascule est **une heure avant** le
lever, bornée entre 2 h et 6 h), M6 (« Supprimer » ambré sur chaque carte).

G7 confirmé, et doublement : le catalogue promet « La salutation du menu, qui
se coupe d'un réglage » et `src/pages/index.astro:22` répète « si la personne
n'a pas coupé la salutation » — or la ligne 259 ne vérifie rien, et aucun
réglage de ce nom n'existe au catalogue des paramètres. Le tutoiement
(`formalite`) n'est lu par rien.

G8 — l'exemple `{"cognition": 10}` **s'affiche toujours** pour les dates
d'épreuves : `profil.astro:413` le pose dès que la nature est `repartition`, et
`datesEpreuves` en est une. Signalé au 43, pas touché ici.

### Ce qui est déjà fait, en partie : G5 et la décision 5

La décision 5 demande « une seule source : Ma journée ». **Elle l'est déjà
entre le profil et les paramètres** : `src/lib/parametres/acces.ts:103-105`
lit et écrit les champs de profil eux-mêmes (`champDeProfil('lever', '07:00')`),
par `champ()` et `ecrireChamp()`. Il n'existe donc pas de copie qui puisse
diverger entre ces deux écrans.

Ce qui reste, et qui est réel :

1. **le faux défaut.** `champDeProfil` rend `'07:00'` et `'21:00'` quand le
   champ est vide, et la page centrale les affiche comme s'ils avaient été
   choisis, là où le profil dit « non renseigné ». C'est P10.
2. **la vraie troisième copie.** « Passer au clair à » écrit
   `revinsp.heures-bascule` (`src/lib/theme.ts:47`), propre à l'appareil, et
   `heuresDeBascule()` la fait **primer** sur le miroir du profil
   (`revinsp.heures-journee`, écrit par `miroirDesHeures` depuis
   `src/layouts/Base.astro:786`). Une heure changée dans Ma journée ne déplace
   donc pas la bascule du thème si cette copie existe.

Conséquence pour le chantier : **`Base.astro` n'a pas besoin d'être touché.**
Son script d'avant-peinture lit déjà `revinsp.heures-bascule` puis le miroir ;
il suffit que « suivre Ma journée » soit *l'absence* de la première.

### Ce que je conteste : le compte des champs « qui ne servent à rien »

L'audit annonce « 14 ne sont lus par rien, ou seulement par l'export ». 14 est
un compte de **lignes** de son tableau, pas de champs : trois lignes en
regroupent cinq et trois. En confrontant champ par champ — un relevé mécanique
de toutes les lectures littérales dans `src/`, hors `noyau/profil.ts`,
`noyau/initialisation.ts`, `initialisation.astro` et `profil.astro` —, j'obtiens
**23 champs dont aucune lecture ne produit d'effet aujourd'hui** — et le
catalogue en porte 37, non 36 : l'audit réunit les matières fortes et les
matières faibles sur une seule ligne :

`nom` (lu seulement pour être **retiré** d'un export), `formalite`, `langue`,
`activite`, `joursTravail`, `plagesTravail`, `objectifsAnnee`, `objectifsVie`,
`tempsParDomaine`, `styleAccompagnement`, `concours`, `datesEpreuves`,
`matieresFortes`, `matieresFaibles`, `experienceSport`, `objectifsSport`,
`frequenceSouhaitee`, `lieuMateriel`, `phaseSport`, `frequenceRevues`,
`frequenceCheckin`, `suiviFinances`, `heureRappel`.

Deux remarques qui demandent un arbitrage, posées au pilote :

- `datesEpreuves` **cesse** d'être inutile avec la décision 3 : le compte à
  rebours le lit. Il reste donc demandé. Les champs qui ne sont plus demandés
  sont alors **22**.

  *Corrigé le 19 octobre, après comptage par le code : j'avais écrit 22 et 21
  en comptant de tête une liste qui en porte 23. Les nombres de ce paragraphe
  sont désormais ceux que rend `essais-lu-par.mts`.*
- `matieresFortes` et `matieresFaibles` : l'observation **propose** une valeur
  pour eux, elle ne lit pas celle qui est déclarée. Rien ne lit la réponse.
  Ils tombent donc, à la lettre du critère, dans « plus demandés ».

### Ce que je conteste aussi : l'exemple du compte à rebours

P13 propose « Écrit IFiP : 15 mars 2027, dans 21 semaines ». La donnée ne porte
pas la distinction écrit / oral : `datesEpreuves` est un dictionnaire d'**une**
date par parcours (clé : l'identifiant du parcours, valeur `AAAA-MM-JJ`, posée
par un champ `type="date"`). La ligne dira donc « INSP : 15 mars 2027, dans
21 semaines », avec le libellé du parcours. Inventer « Écrit » serait afficher
une précision que personne n'a donnée.

---

## 2. Le plan

Trois mécanismes portent l'essentiel, et c'est voulu : les décisions d'Alexis
se recoupent, et un seul endroit de vérité vaut mieux que trois cohérents par
surveillance.

### Mécanisme 1 — la table « Lu par », au catalogue (P3 **et** décision 2)

Chaque champ du catalogue (`src/lib/noyau/profil.ts`) reçoit une déclaration
facultative :

```ts
luPar?: readonly {
  /** Le fichier qui lit la valeur, tel que l'essai le retrouvera. */
  module: string;
  /** Ce que la personne voit : « la revue du soir (Odyssée) ». */
  libelle: string;
  /** Vrai quand ce lecteur lit la valeur pour la retirer, non pour s'en servir. */
  protection?: true;
}[];
```

Elle vit au catalogue et nulle part ailleurs, pour une raison vérifiable : le
contrôle du graphe d'imports interdit à tout fichier de `src/` hors de six
d'entre eux de nommer `naissanceAnnee`, `naissanceMois` ou `majeurDeclare`.
`noyau/profil.ts` est l'un des six ; un fichier neuf ne le serait pas.

Trois conséquences, d'un seul coup :

- **l'écran** affiche « Lu par : … » à partir des lecteurs réels, et rien quand
  il n'y en a pas ;
- **la question** n'est plus posée quand aucun lecteur hors `protection` n'est
  déclaré : `questionsDuSocle()` et `champsDeBranche()` portent ce filtre. C'est
  la décision 2, et c'est aussi la demande du prompt — « un champ qui redevient
  utile est redemandé automatiquement dès qu'un lecteur est déclaré » ;
- **la valeur déjà remplie** reste : rien n'est effacé ni réécrit (interdit 1),
  et le champ garde sa carte, modifiable, avec la mention « Pas encore utilisé
  par Cyclades. Votre réponse est gardée. »

**L'essai** (`scripts/essais-lu-par.mts`) confronte la déclaration au code dans
les deux sens :

1. chaque `module` déclaré existe, et son code — commentaires retirés — porte
   une **lecture reconnue** du champ : `champ('x')`, `lire('x')`,
   `champDeProfil('x'`, `champ: 'x'`, `heureDeclaree('x')`, `depuis: [… 'x' …]`.
   Une déclaration sans lecture fait rougir ;
2. toute lecture reconnue trouvée dans `src/` est déclarée. Une lecture non
   déclarée fait rougir ;
3. **la ceinture**, qui est ce qui rend l'essai utile dans un an : tout fichier
   où le nom du champ apparaît en littéral **sans** forme de lecture reconnue
   doit figurer dans une table d'exceptions **avec sa raison** (« `nom` est
   l'identifiant d'un champ du formulaire d'exercice », « lu par un réglage
   déduit que rien n'applique »). Sans cela, une lecture écrite demain sous une
   forme nouvelle passerait en silence.

### Mécanisme 2 — `applique` sur chaque réglage déduit (P4)

Chaque `Reglage` de `src/lib/noyau/reglages.ts` déclare qui l'applique :
`applique: { par: string } | null`. L'écran ne montre que ceux dont `applique`
n'est pas nul — la bascule, le fuseau, les domaines. Les cinq autres quittent
l'écran **sans quitter le code** : rien n'est supprimé, donc
`scripts/essais-adaptation.mts` garde toutes ses assertions, et aucune exigence
n'est abaissée. Un essai confronte chaque déclaration au code, dans les deux
sens, comme pour « Lu par ». La phrase « Un jour de repos ne casse pas votre
série » est retirée de la `cause` elle-même, qu'elle soit affichée ou non.

### Mécanisme 3 — le compte à rebours, pur et séparé (décision 3)

`src/lib/compte-a-rebours.ts`, sans base et sans navigateur : il prend le jour
logique du jour (`AAAA-MM-JJ`), le dictionnaire `datesEpreuves` et les libellés
des parcours, et rend des lignes prêtes à peindre. L'arithmétique se fait sur
des **dates nues**, en minuits UTC : le passage à l'heure d'hiver ne la touche
pas, parce qu'elle ne compte jamais des millisecondes. Formats : « aujourd'hui »
le jour même, en jours jusqu'à 56 jours, en semaines au-delà. Aucun rouge,
aucun « plus que », aucune urgence. Sans aucune date : une ligne unique,
« Renseigner mes dates d'épreuves », qui mène au champ.

L'interrupteur va dans Paramètres > Révisions.

### L'ordre des commits

1. P3 et décision 2 — la table « Lu par », le filtre des questions, l'essai.
2. P4 — `applique`, la phrase fausse retirée, l'essai.
3. Décision 3 — le module du compte à rebours et son essai, puis l'insertion
   sur l'accueil de Révisions et l'interrupteur.
4. Décision 5 et P10 — le faux défaut retiré, « suivre Ma journée ».
5. Décision 4 et P11 — les deux moments, mieux nommés, et le choix fermé.
6. P1, P2, P7 — le plan de page, les champs de branche renseignables, les
   valeurs lisibles. *Attend la correction A7 du 58.*
7. P8, P9, P12, P14, P15 — cibles, compteur, promesses, confidentialité,
   mineurs. *Même attente.*

### Les fichiers, et ce que la règle 4 impose de signaler

| Fichier | Ce que j'y fais | Signalement |
|---|---|---|
| `src/lib/noyau/profil.ts` | `luPar`, filtre des questions | le 43 (C2, lot 6) peut y toucher |
| `src/lib/noyau/reglages.ts` | `applique` | — |
| `src/lib/parametres/catalogue.ts`, `acces.ts` | faux défaut, interrupteur | — |
| `src/lib/theme.ts` | « suivre Ma journée » | — |
| `src/lib/export-ia.ts` | la liste `['prenom', 'nom']` passe au catalogue | — |
| `src/lib/db.ts` | 3 lignes : un booléen dans `ReglagesSession` | **fichier disputé** : question 1 |
| `src/pages/revisions/index.astro` | la ligne du compte à rebours | **modifié par `claude/p46-55`, non fusionnée** : question 2 |
| `src/pages/profil.astro` | tout le reste | **bloqué** : A7 ou G-2 du 58 n'est pas sur `main` |
| `src/layouts/Base.astro` | **rien** | justifié au § 1 |

Aucune migration IndexedDB (interdit 1). Le numéro 41 reste libre.

### Les essais

Neufs : `essais-lu-par.mts`, `essais-reglages-appliques.mts`,
`essais-compte-a-rebours.mts`, et un essai de navigateur pour l'écran refait.
Repris : `essais-profil.mts`, `essais-adaptation.mts`,
`essais-initialisation.mts`, `essais-reglages-orphelins.mts`. Aucun essai n'est
sauté, désactivé ni allégé.

---

## 3. Ce qui attend une réponse du pilote

1. **`db.ts`.** Trois lignes dans `ReglagesSession` (même magasin, même
   section, déjà synchronisé, sans bump ni migration), ou une clé `etat` à part
   dans un module neuf pour ne pas toucher un fichier que d'autres branches
   modifient ? Je recommande les trois lignes.
2. **`revisions/index.astro`.** Fusionner `claude/p46-55` d'abord, ou je livre
   le module et son essai maintenant et l'insertion ensuite ? Je recommande la
   seconde : rien ne bloque, et le fichier n'est touché qu'une fois.
3. **La liste des champs plus demandés** : 23 champs, 22 après le compte à
   rebours, et non 14. `matieresFortes` et `matieresFaibles` en font partie.
   Je confirme la liste du § 1 ?
4. **« Lu par » et l'export.** Trente champs porteraient « Lu par : l'export
   pour une IA », ce qui noierait les lecteurs réels. Je propose de dire
   l'export **une fois**, dans le paragraphe Confidentialité (P14), et par
   champ une mention dérivée du catalogue — « part dans un export si vous
   cochez Profil » — plutôt qu'une ligne « Lu par ».

---

## 4. Compte rendu, constat par constat

Tenu à jour à mesure. « Mesuré » veut dire exécuté et observé ; « lu » veut
dire lu dans le code sans l'exécuter.

### Les bloquants

| Constat | État | Comment, et où |
|---|---|---|
| **B1** la portée « Lisible par » ne restreint rien | **corrigé dans le catalogue, l'écran suit** | La table `luPar` déclare les lecteurs réels, champ par champ ; `essais-lu-par.mts` la confronte au code dans trois sens. Le retrait des 52 cases et la ligne « Lu par : … » sont dans `profil.astro`, **bloqué** jusqu'à l'A7 du 58. |
| **B2** six réglages déduits sur huit non appliqués | **corrigé, et le compte rectifié : cinq sur huit** | Chaque réglage déclare `applique` ; `reglagesAppliques()` rend les trois réels. La phrase fausse sur la série est retirée de la cause. Le filtre d'affichage attend `profil.astro`. |
| **B3** l'âge part dans l'export | **toujours corrigé (U1)** | Vérifié : les cinq champs portent `jamaisExporte`, l'interdiction passe en premier, et le contrôle du graphe d'imports tient. En plus, l'export ne nomme plus lui-même le prénom et le nom : il importe `CHAMPS_A_CAVIARDER`. |
| **B4** l'initialisation enregistre une réponse non donnée | **toujours corrigé (U2)** | Vérifié sur la saisie des dates, qui rend `undefined`. Et la règle est étendue : vider une heure dans Paramètres **supprime** le champ au lieu d'écrire l'heure d'usine. |
| **B5** un champ de branche vide ne se renseigne pas depuis le profil | **à faire** | `questionsDeBranche()` sépare « ce qu'on pose » de « tous les champs de la branche », ce qui est la moitié mécanique du travail. L'autre moitié est l'écran, bloqué. |

### Les gênants

| Constat | État | Comment |
|---|---|---|
| **G1** tri alphabétique, neuf écrans de long | **à faire** (P1) | Bloqué : `profil.astro`. |
| **G2** valeurs brutes et jargon | **en partie** | Le jargon est parti des phrases du catalogue (« le jour logique »), et « 07:00 » se dit « 7 h » dans Paramètres. Les valeurs de l'écran du profil attendent P7. |
| **G3** cases de portée de 16 px | **sans objet après P3** | Les cases disparaissent avec la portée. |
| **G4** le compteur se lit comme une complétude | **à faire** (P9) | Bloqué. Le dénominateur a déjà changé de sens : huit questions posées au lieu de dix-huit. |
| **G5** faux 07:00 dans Ma journée, et une troisième copie | **corrigé** | `siVide` déclare ce que le vide veut dire ; « Passer au clair à » suit Ma journée quand il est vide. Mesuré au navigateur : 25 verts. |
| **G6** le moment de la revue en texte libre | **corrigé** | Choix fermé sur les deux valeurs que `lireMoment` reconnaît, avec une aide par réponse. |
| **G7** promesses fausses sur les cartes | **corrigé** | Six phrases retirées, et un invariant du catalogue interdit d'en écrire une sur un champ que rien ne lit. |
| **G8** la boîte de saisie unique | **signalé, couvert par le 43** | L'exemple `{"cognition": 10}` s'affiche toujours pour les dates d'épreuves (`profil.astro:413`). |
| **G9** « et mon sexe » sans champ pour le sexe | **corrigé** | Titre, libellé, question et trois commentaires. Reste le lien de `profil.astro`, déclaré dans l'essai avec sa raison. |

### Les mineurs

| Constat | État |
|---|---|
| **M1** date du consentement écrite en dur | **à faire**, bloqué (`profil.astro`) |
| **M2** pas de `role="status"` sur les messages | **à faire**, bloqué |
| **M3** le renvoi « Affichage » coupe la page | **à faire**, bloqué |
| **M4** l'aide du lever dit le contraire du code | **corrigé** : « une heure avant votre lever, entre 2 h et 6 h », au catalogue des champs et à celui des réglages |
| **M5** la copie locale des heures n'est pas dite | **en partie** : les phrases de Paramètres disent désormais que Ma journée est la source et que l'heure donnée ici ne vaut que sur cet appareil. Le paragraphe Confidentialité (P14) attend `profil.astro`. |
| **M6** « Supprimer » ambré sur chaque carte | **à faire**, bloqué |

### Ce que l'audit ne dit pas, et que la confrontation a trouvé

1. **La porte de l'âge n'applique pas les coupures.** `contextePersonne` ne
   prend pas `usagesCoupes` en paramètre : la coupure n'est appliquée qu'à
   l'affichage de l'écran. Et aucune fonction ne lit l'âge aujourd'hui —
   `etatDeLaPersonne` et `contextePersonne` n'ont qu'un appelant, l'écran
   lui-même. La phrase du champ a été corrigée ; le défaut de la porte est
   signalé au pilote, avec son correctif, parce qu'il appartient au prompt qui
   l'a construite.
2. **`essais:reglages-orphelins` rougit sur `origin/main`** : le commit
   `2462447` (B-3 du 58) écrit `etat/reglagesSync` dans
   `lib/sauvegarde/effacement.ts` sans déclarer la clé. Signalé, non touché.
3. **Le catalogue porte 37 champs**, non 36 : l'audit réunit les matières
   fortes et les faibles sur une ligne.
4. **La langue et le fuseau partageaient un écran.** La langue n'étant plus
   demandée, la question a dû changer de phrase pour ne pas annoncer un
   réglage qu'elle ne fait plus.
