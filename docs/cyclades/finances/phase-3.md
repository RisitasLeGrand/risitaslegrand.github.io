# Finances, phase 3 — l'appariement et le rapprochement

Ce que la phase livre, et surtout **les six endroits où la version évidente
était fausse**. Les essais nomment chacun ; ce document dit pourquoi.

## Ce qui est livré

| Module | Rôle |
|---|---|
| `src/lib/odyssee/appariement.ts` | Propose : niveau, trois critères chiffrés, une phrase. 1→N, N→1, division. |
| `src/lib/odyssee/rapprochement.ts` | Décide et conserve : conflits, recherche de causes, écarts par ligne, catégorie et mois. |
| `src/lib/odyssee/recurrences.ts` | 1.5 : déduit des lignes de budget du réel. |
| `src/pages/odyssee/rapprocher.astro` | La file, le solde, les écarts, « déduire du réel ». |
| Magasin `odysseeRapprochements` | Scellé, journalisé, schéma **v26**. |

Essais : 63 (appariement), 79 (rapprochement), 55 (récurrences), 34 en
navigateur — dont une chaîne complète *quatre relevés → récurrence déduite →
ligne créée → file qui propose*.

## 1. Le montant n'a pas de borne, la date en a une

La dissymétrie a coûté un essai pour être vue, et elle est voulue.

Quand la date et le motif concordent, l'identification est faite : c'est bien
ce prélèvement-là, sur cette ligne-là. Le montant n'identifie plus rien, il
*informe* — une facture d'électricité varie, c'est sa nature. Une borne sur
l'écart de montant écarterait donc précisément le cas que le plan donne en
exemple, **112,40 € pour 95 € prévus**, et qu'il range explicitement dans les
probables.

Le garde-fou n'est pas un seuil : c'est la phrase, qui dit « Montant hors
tolérance de 17,40 € » et laisse refuser d'un geste. Une date, elle, a un
« presque » naturel : décalée de quatre jours c'est le même prélèvement,
décalée de quatre mois non.

## 2. L'écart se compte dans le sens de la ligne

J'avais écrit `Math.abs(operation.centimes) - Math.abs(occurrence.montant)`.
Sur une ligne de charge, une rentrée de 45 € se lisait alors comme un
**dépassement** de 50 € au lieu d'une économie de 140 €. Un remboursement de
mutuelle apparaissait comme une dépense.

Même faute, une couche plus haut : `reel += Math.abs(part)`. Une ligne de
charge plus remboursée qu'elle n'a coûté — 60 € prélevés, 80 € rendus —
affichait **+20 € dépensés** au lieu de −20 €, sur la seule ligne où de
l'argent était rentré. Corrigé en `occ.signe * part`.

## 3. Humain avant machine, et pas « le dernier gagne »

Son erreur ne se verrait qu'au bout de plusieurs mois : un import mensuel qui
défait, à chaque fois et sans bruit, ce qui a été rangé à la main le mois
d'avant. L'arbitrage regarde donc le **type** de décision d'abord, l'heure
ensuite — et seulement entre décisions de même rang.

Un **refus** est une décision humaine, conservée comme les autres. Sans trace
du refus, le prochain import reproposerait le même appariement, indéfiniment.

Une opération **divisée** porte plusieurs rapprochements légitimes : on les
reconnaît à ce que leurs parts somment à l'opération sans qu'aucune la
couvre, et on les garde tous.

## 4. La récurrence qui se dédouble

Le cas est réel : neuf mois de « PRLV EDF », puis trois de « PRLV EDF CLIENTS
SA ». En préférant le fragment le plus **long** — mon premier choix —, le
libellé long capte les trois derniers mois, le court garde les neuf premiers,
et l'écran propose **deux lignes d'électricité**. Validées, elles doubleraient
ce budget sans que rien ne le signale.

Le gagnant est donc celui qui **couvre le plus d'opérations**. La faute
inverse — « CARREFOUR » avalant « CARREFOUR CITY » et « CARREFOUR MARKET » —
donne une ligne de trop gros grain, visible au premier coup d'œil parce que
sa dispersion la fait proposer en fourchette, et qu'il suffit de la refuser.
Entre une erreur qu'on voit et une erreur qui double un budget en silence, le
choix est fait.

Trois occurrences minimum, et non deux : par deux points passe exactement une
droite, et la régularité qu'on y lit est celle qu'on y a mise. Le montant
proposé est la **médiane** — une régularisation à 450 € une fois par an
déplacerait une moyenne de vingt euros par mois, et le budget serait faux onze
mois sur douze. La dispersion autour de cette médiane choisit la nature :
`fixe`, `estime`, ou `fourchette`.

## 5. Une décision automatique doit rester visible

Trouvé par l'essai en navigateur, et c'était un vrai trou. Le pied des
certaines ne montrait que le passage en cours : au rechargement, une opération
rangée d'office la semaine précédente devenait invisible — ni dans la file, ni
dans le pied, ni annulable. Le système l'avait décidée, et plus rien ne
permettait de la contester.

Le pied liste maintenant **toutes** les certaines appliquées, chacune
annulable. Le bouton d'annulation en bloc, lui, reste borné au passage en
cours : une décision prise il y a trois mois et jamais contestée n'a pas à
sauter parce qu'on rouvre l'écran.

## 6. Le solde de départ, sans quoi l'écart ne veut rien dire

Un solde de compte n'est pas une somme de mouvements. Sans le solde d'avant la
première opération enregistrée, la comparaison affiche un écart **constant**,
égal à cette ouverture, qui ne signale rien et masque tout le reste. L'écran a
donc deux champs, et la phrase qui dit lequel est lequel.

### La recherche de causes

`reconcilier()` dit *qu'il y a* un écart ; le savoir sans savoir d'où il vient
ne sert à rien. Cinq natures, qui sont les cinq accidents qu'un relevé lu par
une machine produit réellement :

| Nature | Signature |
|---|---|
| Opération en double | deux imports qui se chevauchent ; la banque compte **moins** |
| Montant au signe inversé | une colonne crédit prise pour un débit ; l'écart vaut **deux fois** le montant |
| Opération manquante | un caractère de marge décale une ligne — onze opérations perdues sur 278 lors de l'écriture de l'analyseur, sans rien signaler |
| Chiffres intervertis | saisie à la main |
| Virgule déplacée | saisie à la main |

**Aucune n'est appliquée.** Chacune est une hypothèse à vérifier sur le relevé
papier. Corriger automatiquement un solde en inventant une opération
fabriquerait la concordance au lieu de la constater.

## 7. Une occurrence future n'est pas un écart

Une ligne de loyer dont l'échéance du 5 novembre n'est pas encore arrivée
n'est pas « en avance de 780 € » : elle n'est pas encore due. Compter les
occurrences non échues ferait de chaque début de mois une alerte généralisée,
c'est-à-dire aucune alerte. Le jour d'arrêt est un **paramètre**, jamais une
lecture d'horloge à l'intérieur du calcul — un calcul qui lit l'heure ne peut
être ni rejoué ni testé à midi comme à minuit.

Le mois d'un écart est celui de l'**occurrence**, jamais celui de l'opération
qui l'a soldée. Un loyer de novembre payé le 29 octobre reste une charge de
novembre ; le ranger en octobre ferait un mois à deux loyers et un mois à
zéro, deux fois par an, pour un fait sans conséquence.

## Ce que la phase ne fait pas

- **« Autre ligne » et « Diviser »** de la maquette 4.3 ne sont pas branchés à
  l'écran : `grouperVers()` et `diviser()` existent et sont éprouvés, mais
  leur interface demande un sélecteur de ligne et un éditeur de parts, qui
  relèvent de l'écran du budget plutôt que de la file.
- **La catégorie d'une ligne déduite reste vide.** La deviner serait la seule
  chose de ce module qui ne se lit pas dans les données : « SARL LE PETIT
  MARCHE » est des courses ou un restaurant selon ce qu'on y achète, et une
  catégorie fausse rangée d'office coûte plus qu'une catégorie absente.
- **Le verrou de période** (`periodeRapprochee` du modèle) attend la phase 4.
