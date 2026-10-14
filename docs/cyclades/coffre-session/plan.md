# Prompt 35 — Garder le coffre ouvert pendant la session, et brancher ses données sur l'analyse globale

Plan soumis avant tout code, comme le prompt l'exige. Les dix décisions des
prompts 35 et 36 ont été tranchées le 14 octobre ; ce plan les applique sans
les rouvrir.

**Ce qui est écrit ici est de trois natures, et je les distingue partout** :
*mesuré* (constaté à l'exécution), *lu* (établi par lecture de la source),
*supposé* (ni l'un ni l'autre, et dit comme tel).

---

## 0. Les deux questions du § 0, répondues

### Question 1 — quand le coffre se referme-t-il, et quand le mot de passe est-il redemandé ?

**Mesuré** le 14 octobre, sur le site construit et servi en préversion,
Chromium, deux tailles d'écran — **1280 × 900 et 390 × 844, résultats
strictement identiques**. La réserve « comportement sur téléphone non vérifié »
est donc levée.

| Situation | Verrou de session | Coffre de l'écran |
|---|---|---|
| Première visite | demandé | demandé (seconde saisie) |
| Navigation entre deux pages sous coffre | non | non |
| Rechargement | non | non |
| **Nouvel onglet** | non | **OUI** |
| Retour de veille (document caché 3 s, puis visible + focus) | non | non |
| Profil de navigateur neuf | OUI | OUI |

**Mesuré aussi** : la clé du coffre est présente dans `sessionStorage`,
**absente** de `localStorage`.

**Une honnêteté sur cette mesure.** La dernière ligne ouvrait un *profil neuf*,
ce qui n'est pas un navigateur refermé puis rouvert. L'inférence — donnée comme
**inférence**, pas comme constat — est qu'à la réouverture du navigateur le
verrou de session ne serait pas redemandé (`localStorage` survit) tandis que le
coffre le serait (`sessionStorage` non).

**K2 est confirmé** : *lu*, aucune fermeture automatique n'existe. Rien sur
`visibilitychange`, aucun `setTimeout` de fermeture, rien sur l'inactivité ni
sur `blur`, ni dans `coffre.ts` ni dans `auth.ts`. Le coffre ne se ferme que sur
geste explicite.

**Qui referme le coffre, aujourd'hui** (*lu*, balayage exhaustif) :
`auth.ts:144` — le verrouillage explicite de la session referme le coffre avec
elle — et quatre pages seulement : `corps`, `finances`, `psyche`, `rapprocher`.
`oublierLaMemoire()` n'est appelée depuis **aucun** appelant extérieur à son
module.

**L'asymétrie qui commande tout ce lot.** Les deux verrous dérivent du **même**
mot de passe et leurs portées sont inverses : la case « Rester connecté sur cet
appareil » de `Verrou.astro:41-49` est `checked` **dans le balisage**, donc
`auth.ts:48` écrit la clé de contenu dans `localStorage` par défaut, où elle
survit à l'onglet et au navigateur ; le coffre, lui, est par onglet. **Cyclades
est aujourd'hui plus permissif sur le contenu publié que sur le coffre.** Les
deux dérivations utilisent des sels distincts : la clé du coffre n'est pas
reconstructible depuis celle de session.

### Question 2 — ce qu'on appelle « l'analyse globale »

**Lu**, balayage exhaustif des sources.

Trois modules seulement lisent `faits-branches` :

| Module | Ce qu'il fait |
|---|---|
| `src/lib/indicateurs.ts` | le catalogue des indicateurs calculables |
| `src/lib/odyssee-jour.ts` | l'état du jour : roue d'équilibre, plancher, « que faire maintenant ? » |
| `src/pages/odyssee/tendances.astro` | les lectures croisées |

`SourceDeFaits` vaut exactement `'revisions' | 'odyssee' | 'corps' | 'sport' |
'psyche'` : **K3 et K4 sont confirmés sur l'état courant.**

Les autres écrans et calculs transversaux : `odyssee/desaccords.ts`,
`odyssee/indicateurs.ts`, `pages/statistiques.astro`, `odyssee/syntheses.ts`,
`lib/export-ia.ts`, `odyssee/export-ia.ts`, `pages/exporter-ia.astro`.

**Ce que chacun reçoit aujourd'hui du coffre : rien, sauf Psyché.** Aucun de ces
modules ne lit un magasin scellé. Les scellés ne sont lus que par les pages du
coffre et leurs propres modules de données (13 fichiers). Psyché fait exception
parce qu'elle passe par `faits-branches`, qui publie ses faits coffre ouvert et
affiche un **manque nommé** coffre fermé.

**Une correction à mon propre relevé**, parce qu'un audit doit savoir d'où
viennent mes chiffres : mon premier balayage avait cru voir `desaccords.ts` lire
les prises de médicaments. Faux positif — la sous-chaîne venait de « bornes
com**prises** ».

**Un fait qui réduit le coût de la décision 4** : le mécanisme de l'export
existe déjà. `odyssee/export-ia.ts` déclare les catégories `sante`, `psyche` et
`finances` avec `sensible: true, parDefaut: false`, et `categoriesParDefaut()`
n'en coche jamais une sensible. Mais leurs trois descriptions disent « Rien de
tout cela n'existe encore » et aucun module n'émet de données pour elles :
**déclarées, vides**. Ce qui manque est l'émission, pas la case.

---

## 1. Les décisions appliquées, et la précision d'exécution

| N° | Décision d'Alexis |
|---|---|
| 1 | L'onglet par défaut. En option, « garder ouvert pour la session » : tous les onglets, jusqu'à la fermeture du navigateur, **sans rien écrire sur le disque**. À part, « mémoriser sur cet appareil ». |
| 2 | Aucune fermeture pour inactivité par défaut. Délai réglable proposé **seulement** si le coffre est mémorisé sur l'appareil. |
| 3 | Psyché et Finances maintenant. Médicaments et statut hormonal **avec le lot Santé**. |
| 4 | Export pour une IA sur case explicite, décochée par défaut, avec la liste des champs. Grisée et nommée si le coffre est fermé. |
| 5 | Clé d'encapsulation non extractible pour la mémorisation, **et plus de clé en clair dans le stockage de l'onglet**. `oublierLaMemoire()` appelée par « Oublier sur cet appareil », au changement de mot de passe et à la réinitialisation. |
| 6 | « Rester connecté » (verrou de session) : gardée cochée, avec une explication sous la case. |

### La précision d'exécution sur la décision 5, et pourquoi elle était nécessaire

Prise au pied de la lettre — retirer `sessionStorage` et ne garder qu'une
variable en mémoire plus le relais entre onglets — la décision 5 **retournerait
le prompt 35 contre son propre objet**.

*Lu* : Cyclades est **multi-pages**. Chaque navigation est un chargement
complet, et la mémoire de la page meurt avec elle. Le commentaire de
`coffre.ts` le dit lui-même : sans `sessionStorage`, « le mot de passe est
redemandé **à chaque page** ». Le relais entre onglets ne couvre pas ce cas : il
lui faut un onglet donneur **vivant**, et sur téléphone il n'y en a le plus
souvent qu'un. Le résultat serait un mot de passe redemandé à chaque navigation
et à chaque rechargement, là où la mesure montre qu'aujourd'hui ni l'un ni
l'autre ne le redemande — et P1 promet exactement l'inverse.

**Ce que le lot fera donc** : garder `sessionStorage`, mais n'y ranger que la
clé **encapsulée**. « Plus de clé en clair dans le stockage de l'onglet » est
tenu à la lettre ; la navigation et le rechargement sont préservés sans onglet
donneur ; la portée voulue par la décision 1 reste intacte, puisque
`sessionStorage` meurt avec l'onglet.

**Deux clés d'encapsulation, deux durées de vie.** Celle de la **session** est
régénérée à chaque ouverture du coffre et effacée à sa fermeture — l'interdit 6
promet un bouton qui « efface la clé **et tout ce qui en a été tiré** », et une
clé survivante ferait de la fermeture un affichage plutôt qu'un effacement.
Celle de la **mémorisation** ne meurt qu'à « Oublier sur cet appareil », au
changement de mot de passe et à la réinitialisation.

---

## 2. Les phases

Une phase par partie, livrée et testée avant la suivante, commit séparé.
**J'attends un « go » avant chacune.**

### Phase 1 — Le socle de clés : encapsulation, et plus rien en clair

*Fichiers* : `src/lib/coffre.ts` (le cœur), un nouveau module de magasin de clés
sur IndexedDB.

*Ce qui change* : `retenir()` et `reprendreLeCoffre()` ne manipulent plus du
base64 brut mais un chiffré ; une clé d'encapsulation AES non extractible,
générée à l'ouverture, vit dans IndexedDB et meurt à la fermeture ;
`fermerLeCoffre()` efface les deux.

*Risque* : **le plus élevé du lot.** C'est le chemin par lequel passent toutes
les données scellées. Une erreur ici ne casse pas un écran, elle rend des
données illisibles. Mitigation : la clé du coffre reste dérivée du mot de passe
exactement comme aujourd'hui (même sel, mêmes itérations) — seul son *rangement*
change, jamais sa valeur. Un coffre existant doit s'ouvrir sans migration. Un
essai le vérifiera avant toute autre chose.

### Phase 2 — Le témoin, les deux cases, et fermer partout

*Fichiers* : `src/components/Verrou.astro`, le formulaire d'ouverture du coffre,
l'en-tête de `src/layouts/Base.astro`, les dix pages sous coffre.

*Ce qui change* : la case « Garder le coffre ouvert pendant cette session » avec
sa phrase d'explication ; la case « Mémoriser sur cet appareil », décochée,
apparaissant seulement après la première, avec son avertissement et sa
confirmation ; le témoin permanent dans l'en-tête, qui distingue « Coffre ouvert
(session) » et « Coffre ouvert (mémorisé sur cet appareil) » ; l'explication
sous « Rester connecté » (décision 6).

*Ce qui est réparé au passage, et ce n'est pas un ajout* : **six des dix pages
sous coffre n'offrent aucun bouton de fermeture** — `echelles`, `mes-regles`,
`molecule`, `qui-lit-mon-budget`, `sante`, `veille`. L'**interdit 6** exige ce
bouton « partout où le coffre est ouvert » ; le témoin de l'en-tête le donne
d'un coup sur toutes les pages, et c'est la réponse la plus économique.

*Risque* : moyen. Touche l'en-tête, donc toutes les pages du site.

### Phase 3 — La session multi-onglets

*Fichiers* : `src/lib/coffre.ts`, un nouveau module de relais.

*Ce qui change* : un canal de même origine ; un onglet neuf demande la clé, un
onglet vivant la lui passe **en mémoire**, jamais depuis le disque ; une
fermeture dans un onglet ferme partout.

*Les limites, écrites dans le code et dans le tableau* — par construction :
- un onglet unique fermé puis rouvert n'a **aucun donneur** : mot de passe
  redemandé. C'est le cas le plus fréquent sur téléphone, où (b) apporte donc
  peu ;
- fenêtre privée ou autre profil : partition de stockage distincte, pas de
  donneur ;
- `BroadcastChannel` n'est utilisé **nulle part** dans le dépôt aujourd'hui
  (*mesuré*, zéro occurrence) : c'est une primitive à introduire ;
- **non vérifié** : le comportement sur Safari. Je ne citerai aucun numéro de
  version de mémoire.

*Sur la surface d'attaque* : le canal étant de même origine, le seul demandeur
possible est une page Cyclades — ou un script injecté sur notre origine, qui
lirait déjà `sessionStorage` aujourd'hui. **Cette phase n'aggrave pas cette
exposition.**

*Risque* : moyen. Un protocole de demande et de réponse mal fermé laisserait un
onglet sans clé ou en attente.

### Phase 4 — Finances dans l'analyse globale

*Fichiers* : `src/lib/odyssee/faits-branches.ts` (la liste `SourceDeFaits`), un
nouveau `faits-finances.ts`, `src/lib/indicateurs.ts`, `odyssee/desaccords.ts`.

*Ce qui change* : Finances rejoint les sources, sur le modèle exact de Psyché —
coffre ouvert elle compte, coffre fermé un **manque nommé** s'affiche, jamais un
silence qui ressemblerait à « aucune donnée ». Mise à jour sans rechargement à
l'ouverture et à la fermeture, ou mention explicite que l'affichage date
d'avant.

*Ce qui ne change pas* : **l'XP** (interdit 5). Et **aucun agrégat tiré du
coffre n'est mémorisé** (interdit 1) : ce qui est calculé à partir du coffre vit
en mémoire et disparaît à la fermeture.

*Risque* : moyen. La roue d'équilibre et le plancher du jour changent de valeurs
quand une source s'ajoute ; il faudra vérifier qu'un domaine nouvellement
alimenté ne fasse pas basculer des règles existantes à tort.

### Phase 5 — L'export pour une IA

*Fichiers* : `src/lib/odyssee/export-ia.ts`, `src/lib/export-ia.ts`,
`src/pages/exporter-ia.astro`.

*Ce qui change* : les catégories sensibles déclarées reçoivent enfin une
émission ; la case reste décochée par défaut ; le rappel énumère les **noms de
champs** qui partiront, pas seulement la catégorie ; coffre fermé, la catégorie
est **grisée avec un manque nommé** — jamais exportée vide en silence, ce qui se
lirait comme « il n'y a rien ».

*Risque* : élevé sur la confidentialité, faible sur la technique. C'est le seul
endroit du lot où des données du coffre **sortent**. Les essais porteront
d'abord sur le cas négatif : sans la case, rien du coffre dans le fichier.

### Phase 6 — Le tableau « ce que ce choix protège », et le compte rendu

*Fichiers* : l'en-tête de `src/lib/coffre.ts`, un compte rendu court.

Le tableau sera écrit **sans enjoliver**, et sa deuxième ligne est la plus
importante :

- le chiffré dans `sessionStorage` protège contre la **lecture passive** du
  stockage — copie de profil, copie de disque, outil d'inspection : il est
  inutilisable sans la clé d'IndexedDB ;
- il ne protège **pas** contre un script exécuté sur notre origine. Ce script
  appelle `unwrapKey` avec la clé non extractible et obtient le même résultat.
  « Non extractible » empêche de **copier** la clé, pas de **s'en servir**.
  C'est le niveau d'aujourd'hui, pas mieux ;
- **limite non vérifiée** : certains navigateurs restaurent `sessionStorage`
  avec un onglet rouvert ou au redémarrage. Je ne peux pas le mesurer — c'est
  une fonction de l'enveloppe du navigateur, hors de la surface d'un pilotage
  automatisé, et un contrôle automatisé serait asymétrique au point d'être
  trompeur : un résultat positif prouverait quelque chose, un résultat négatif
  **rien du tout**. Écrit comme réserve plutôt que mesuré faussement.

---

## 3. Les essais

Ceux que le prompt énumère, plus ceux que ces phases appellent.

- la batterie complète, verte **avant** et après ;
- un essai qui ouvre le coffre case cochée, navigue, recharge, ouvre un nouvel
  onglet, puis **inspecte IndexedDB et `localStorage`** et exige qu'aucune
  valeur en clair n'y figure ;
- un essai de fermeture : bouton, puis contrôle que la clé, les agrégats et les
  écrans tirés du coffre ont disparu **partout** ;
- P1 bis : sans la case, rien ne survit ; avec la case, réouverture sans mot de
  passe et clé jamais lisible en clair ; « Oublier » efface tout ; un changement
  de mot de passe invalide la clé conservée ;
- par source scellée ajoutée : coffre ouvert elle compte, coffre fermé son
  manque nommé s'affiche ;
- export : **sans la case, aucune donnée du coffre dans le fichier produit** ;
- captures en 390 × 844 et 1280 × 800, **données synthétiques uniquement**.

**Un essai que j'ajoute, et la raison.** Avant la phase 1, un essai vérifiera
qu'un coffre ouvert **avant** le changement s'ouvre encore **après**. Toute
cette journée a montré des contrôles verts parce qu'ils ne voyaient rien ;
celui-là doit échouer si le rangement de la clé casse la compatibilité, et je
le prouverai en le sabotant.

---

## 4. Mes réserves

1. **La phase 1 touche la lecture de toutes les données scellées.** C'est le
   seul endroit du lot où une erreur se paie en données perdues et non en écran
   cassé. Je la livrerai seule, avec son essai de compatibilité, et je
   m'arrêterai après.
2. **La phase 3 apporte peu sur téléphone**, pour la raison dite plus haut. Elle
   reste demandée et je la livrerai ; je préfère que ce soit écrit plutôt que
   découvert à l'usage.
3. **La phase 4 fera bouger des chiffres déjà affichés** (roue, plancher). Ce
   n'est pas un défaut, c'est l'effet voulu d'une source qui s'ajoute — mais il
   faudra le regarder plutôt que le supposer.
4. **Je ne sais pas mesurer la restauration d'onglet** et je ne ferai pas
   semblant. Trois gestes sur ton propre navigateur vaudront mieux que mon
   contrôle.
