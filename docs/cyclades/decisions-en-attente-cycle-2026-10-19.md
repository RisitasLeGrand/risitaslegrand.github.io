# Suivi personnel — ce qui attend une décision d'Alexis

> Fichier propre au chantier du cycle, ouvert le 19 octobre 2026 sur la branche
> `claude/cycle-d2`. Il est **séparé** de
> `decisions-en-attente-2026-10-19.md`, qui est un fichier vivant du
> constructeur : écrire dans le sien aurait produit un conflit pour rien.
>
> Chaque entrée dit ce qui attend, qui doit trancher, et **ce que le code fait
> en attendant**. Cette dernière colonne est la plus importante : une décision
> en attente dont le code aurait déjà choisi à la place ne serait plus en
> attente.

---

## 1. Vérification visuelle de la collecte D2 — **à faire**

**Vérification visuelle d'Alexis : à faire.**

La collecte `collectes/D2-signes-alerte-regles-2026-10-19.md` le dit elle-même :
l'outil de lecture passait par un résumé limité à 125 signes par citation, et
les citations longues ont été recollées à partir de fragments. Les apostrophes
varient et les espaces insécables ne sont pas garanties — par exemple avant
« °C ».

**Qui tranche** : Alexis, en relisant les citations à l'œil contre les pages
d'origine.

**Ce que le code fait en attendant** : les vingt-neuf citations sont déclarées
dans `odyssee/cycle-signes-alerte.ts` et vérifiées contre la collecte, mais
**aucun écran ne les affiche encore** — l'écran arrive avec le module, parce
que la règle 5 veut que la liste soit consultable depuis le renvoi et non
posée à part.

Le complément qui gouverne ces citations est versé à côté de la collecte,
dans `collectes/D2-complement-regles-2026-10-19.md` : la règle et la citation
se relisent au même endroit.

**Ce que l'essai fera, et sa limite** : il comparera chaque phrase affichée à sa
citation dans la collecte, après normalisation des **apostrophes et des espaces
seulement** — aucun mot, aucune ponctuation, aucune casse. La comparaison
portera donc sur un texte qui n'a pas encore été vérifié à l'œil. L'essai garde
la fidélité de l'écran à la collecte ; il ne garde pas la fidélité de la
collecte aux pages.

---

## 2. Les statuts déjà saisis sous « Phase du cycle » — **à relire**

Le libellé de la nature `cycle` de `StatutHormonal` est passé de « Phase du
cycle » à « Phase de cure » le 19 octobre (décision B du plan de phase 0,
premier temps). Le libellé seul a changé ; la clé stockée n'a pas bougé et
aucune donnée n'a été touchée.

**Conséquence qu'il faut dire** : un statut déjà enregistré sous cette nature
s'affiche désormais comme une cure. Si l'un d'eux notait une phase menstruelle
— ce que le libellé d'origine autorisait à lire ainsi —, son étiquette est
maintenant fausse. **Rien dans le code ne permet de savoir lequel des deux sens
a été employé**, et la donnée est sous coffre.

**Qui tranche** : Alexis, en ouvrant Odyssée > Corps et en relisant ses statuts.

**Ce que le code fait en attendant** : il n'essaie pas de deviner. Aucune
reclassification automatique, et `NATURES_ECARTEES` continue d'écarter la
nature entière de l'analyse — plus large que nécessaire, ce qui est le bon sens
de l'erreur pour un filtre de confidentialité.

---

## 3. Les paramètres de produit du suivi — **à proposer, puis à trancher**

La décision 24 du plan de phase 0 est explicite : « proposés chiffrés en
phase 3, **aucun appliqué avant ta réponse** ». La décision 8 ajoute que la
fenêtre « avant les règles » est « à fixer avec toi ».

**Qui tranche** : Alexis. Ce sont des seuils de santé, et le pilote a renvoyé la
décision vers lui plutôt que de l'arbitrer.

**Ce que le code fait en attendant** : le journal enregistre et relit. Aucun
calcul de durée de cycle, aucune plage estimée, aucune fenêtre, aucune
statistique — ce n'est pas un manque de travail, c'est l'absence délibérée de
tout chiffre qu'une réponse pourrait démentir.

**Ce qui sera proposé, et quand** : au lot qui construit les cycles et les
statistiques personnelles, chiffré et motivé, en une seule fois.

---

## 4. La méthode des pistes entre cycles — **à valider avant d'être écrite**

La décision 14 demande que la méthode soit « proposée chiffrée en phase 5,
**validée avant implémentation** ».

**Qui tranche** : Alexis.

**Ce que le code fait en attendant** : rien n'est écrit. Si la réponse n'arrive
pas dans le délai du chantier, le lot reste une proposition écrite et aucun
calcul n'est livré.

---

## 5. La matrice de permissions B.2 — **à vérifier avant la fiche de cycle**

Le § 11 du plan de phase 0 le déclare comme un angle mort : « je sais que le
contrat de faits porte `proprietaire` et `domaine` pour les 36 types ; je n'ai
pas vérifié que la matrice couvre toutes les lectures inter-branches que 4.7
restreint ».

Or la fiche de cycle lit d'autres domaines, et la maquette 8.3 impose de
distinguer « domaine non autorisé » de « non mesuré » — deux lignes distinctes,
parce que les confondre laisserait croire qu'un domaine coupé est un domaine
vide.

**Qui tranche** : le pilote d'abord, Alexis ensuite si la matrice doit changer.

**Ce que le code fait en attendant** : la vérification est faite **avant**
d'entrer dans le lot de la fiche, et son résultat remonté. Aucune lecture
inter-branches n'est écrite avant cela.

---

## 6. Décision B, second temps : la clé `cycle` n'est pas renommée — **tranché**

Le plan de phase 0 prévoyait de renommer la clé `cycle` de `StatutHormonal`
« avec l'arrivée du module, qui impose de toute façon un changement de
schéma : la migration voyage avec lui ».

**La prémisse ne tient pas**, et c'est mesuré : `nature` est à l'intérieur du
scellé, la clé du coffre vit en mémoire, et le bloc `upgrade` de `db.ts` ne
l'a pas. Une migration de schéma ne peut pas lire ce champ, donc pas le
réécrire.

Il aurait fallu une **conversion paresseuse coffre ouvert** : une seconde
opération touchant des données de santé chiffrées, après
`migration-du-coffre.ts` — la seule du dépôt de cette espèce, qu'Alexis avait
conditionnée à une sauvegarde confirmée. Plus une période à deux clés, et
`NATURES_ECARTEES` à faire fonctionner sur les deux noms, puisque c'est un
filtre de confidentialité accroché à cette chaîne.

**Tranché par le pilote le 19 octobre : on ne renomme pas.** Le libellé
affiché est déjà « Phase de cure », donc l'ambiguïté que la décision visait
est levée. Le risque de collision est écarté autrement : les statuts que le
suivi ajoutera porteront `contraception`, `grossesse`, `allaitement` et
`menopause`.

**Si Alexis préfère la conversion** — l'option (b) — elle demande une
**sauvegarde confirmée** avant toute réécriture, par la même règle qu'il a
posée pour le rechiffrement du coffre. Rien n'est fait dans ce sens, et rien
ne le sera sans sa parole.

---

## 7. « Modules disponibles » : une surface que le registre décrit et qui n'existe pas

`registre-usages.ts` nomme cet écran deux fois : dans l'`effetVisible` de
`profil.modules-a-seuil` — « Le module n'apparaît pas dans "Modules
disponibles" » — et dans le `siInconnu` de `profil.question-cycle` — « Le
module reste accessible depuis "Modules disponibles", sous un libellé
neutre ». **Aucun écran ne porte ce nom**, vérifié sur tout `src/`.

La formulation du registre **reste telle quelle**, avec un commentaire qui dit
qu'elle désigne une surface à construire. L'adoucir aurait fait reculer la
déclaration devant l'implémentation, alors que c'est l'implémentation qui doit
venir.

**Qui tranche** : le constructeur, à qui l'écran appartient (phase 1).

**Ce que le code fait en attendant** : le suivi personnel s'atteint par une
**ligne neutre depuis l'écran Corps**, qui est déjà sous coffre et où le
registre dit que la question du cycle se pose. Décision du pilote,
19 octobre, option (c). L'entrée de branche sous Odyssée — un libellé
« Suivi personnel » dans la navigation — sera demandée au constructeur quand
le module aura ses écrans à lui ; `branches.ts` n'est pas touché.

---

## 8. Le sexe déclaré n'est stocké nulle part

La porte `etatDeLaPersonne()` rend `sexe: null`, et ce n'est pas un oubli de
ce chantier : **aucun magasin du dépôt ne stocke ce champ.** Ni `profil.ts` ni
`initialisation.ts` ne le déclarent, vérifié ligne par ligne. Le plan de
phase 0 le range dans Odyssée > Corps sous coffre, et la phase 1 n'a livré que
les trois champs d'âge.

**La conséquence est visible, et le registre l'avait déjà prévue** :
`profil.question-cycle` lit `sexe_physio`, donc la question du suivi n'est
**jamais posée d'office**. Son `siInconnu` dit exactement ce qui se passe
alors. Le module fonctionne ; il ne se propose pas tout seul.

**Qui tranche** : le pilote, puis le constructeur si le champ relève de la
phase 1. Créer son magasin serait une vingtaine de lignes, mais la forme — un
magasin scellé propre, ou un champ d'un magasin existant du corps — est une
décision d'architecture qui appartient à qui possède la phase 1.

**Ce que le code fait en attendant** : il rend `null` honnêtement, et le
balayage du graphe d'imports garde **déjà** le nom `sexe` et `aUnCycle`, pour
que le jour où ils seront créés, aucun écran ne puisse les lire en
contournant la porte.

---

## 9. Ce qui n'attend rien, et ne doit pas se retrouver ici

Par symétrie, et pour qu'on ne vienne pas chercher une décision là où il n'y en
a pas :

- **La fenêtre fertile, l'ovulation prédite et le conseil de contraception**
  sont refusés par la décision 12, déclarée **non levable**. Ils sont nommés
  dans `JAMAIS_CALCULE` (`odyssee/cycle-confidentialite.ts`) et un essai
  vérifie qu'aucun identifiant du module ne les calcule. Ce n'est pas une
  décision en attente, c'est un refus.
- **La synchronisation du suivi** n'attend pas non plus : non synchronisée par
  défaut (décision 18), et l'interrupteur appartient au lot B-6 du
  constructeur. La part de ce chantier est de garder les magasins à part et
  déclarés.
