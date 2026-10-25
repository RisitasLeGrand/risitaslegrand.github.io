# Décisions de phase 3, prises dans la nuit du 24 au 25 octobre

Écrit parce que ces décisions ne vivaient que dans des messages entre sessions.
Le conteneur a été recyclé le 24 octobre et a emporté 590 lignes de tableau
d'anomalies, qui n'étaient nulle part ailleurs. Celles-ci sont dans Git.

Rien de ce qui suit n'est commencé. L'ordre est : relecture du train
d'intégration, puis 58 partie 2, puis ceci — le ciblage d'abord, les agents en
ayant besoin dès leurs premières questions.

---

## 1. Le statut d'une question DGFiP — dérivé, jamais stocké

**Demandé** : un champ `statut` valant `annales | maison | officiel`, avec une
migration 344 B / 153 maison / 43 A.

**Refusé, et accepté comme tel par le pilote.** Ces trois nombres sont
exactement la distribution de `categorie_origine`, qui existe déjà, qui est
obligatoire, et dont le schéma refuse déjà l'ancien nom. Le champ demandé
était donc un renommage.

Il y avait même déjà un **troisième** encodage du même fait : `source` est du
texte libre, et `quiz/dgfip.astro` en déduisait l'annale par un test de
préfixe, `!source.startsWith('RevINS')`.

**Retenu** : une fonction `statutDe(question)`, dérivée de `categorie_origine`,
avec un essai qui fixe la table des trois correspondances. Et `dgfip.astro`
cesse de deviner par préfixe : il appelle la même fonction. **Un encodage de
moins, pas un de plus.** Aucun fichier de contenu touché.

## 2. « Pour quel parcours cette question est écrite » — le champ `vise`

**Le défaut est présent, pas à venir.** `origineAdmise()` sert les questions
`maison` à **tous** les parcours, sans condition. Une question maison écrite
pour A+ est donc déjà servie à un candidat DGFiP B, aujourd'hui, et rien ne le
dit. C'est le pilote qui a vu la cause : `categorie_origine` mêle deux faits —
la catégorie de concours et la provenance — de sorte qu'une question maison n'a
pas de catégorie.

Retenu, approuvé tel quel :

1. un champ **optionnel** `vise: [identifiant de parcours]` ;
2. absent = le comportement d'aujourd'hui, mot pour mot — donc **zéro
   migration** des 153, et aucune question qui change de main en silence ;
3. le schéma le **refuse** sur une question A ou B : leur catégorie dit déjà
   pour qui elles sont, et l'accepter recréerait le doublon qu'on vient
   d'éviter ;
4. les valeurs sont **validées contre le registre de parcours**, et non
   libres. C'est le point qui compte : `dgfip-ap` mal orthographié rendrait la
   question invisible de **tous** les tirages, sans un mot. Un champ dont la
   faute de frappe efface du contenu en silence est un piège ;
5. tirage, pour `maison` : servir si `vise` est absent, ou s'il contient le
   parcours courant ;
6. parcours inconnu ou INSP : tire tout, y compris les questions visées. C'est
   la règle actuelle, et elle ne change pas en passant ;
7. essais : une question visée `dgfip-ap` n'est pas servie à `dgfip-b`, l'est à
   `dgfip-ap`, l'est encore sans parcours ; et au schéma, `vise` sur une
   question B est refusé, un identifiant inconnu est refusé.

## 3. Les deux formes du parcours A+

### L'épreuve écrite sur dossier

Un fichier par sujet : dossier documentaire, consigne, durée, corrigé-type.
Minuterie au temps réel de l'épreuve (5 h, 4 h), qui **survit à la fermeture de
l'onglet** — elle garde son instant de départ, et non un compte à rebours en
mémoire. Aucune notation automatique.

### La banque d'entretien

Des questions de jury, chacune avec ses attendus et ses écueils, plus une trame
de présentation du parcours. Révision par le FSRS existant, sans moteur
nouveau.

### Les deux règles tranchées par le pilote, à tenir par un essai

**Ni l'une ni l'autre n'alimente l'estimation de niveau.** L'entretien se révise
sans être une source de niveau ; l'épreuve sur dossier n'écrit aucune note.

La raison vaut d'être gardée : une épreuve non notée qui écrirait un zéro ferait
**chuter un niveau qu'elle n'a pas mesuré**. Et l'estimation compte aujourd'hui
cinq sources déclarées — `quiz`, `flashcards`, `rappels`, `dgfip`, `pretest` —
dont l'essai de niveau vérifie le nombre : une sixième source aurait changé ce
compte et l'écran de réglages.

### Ce que la mécanique ne promet pas

« Le corrigé n'est révélé qu'après le rendu » n'est pas une garantie de secret :
les données sont sur l'appareil, et qui veut les lire les lira. Ce qui est
garanti, c'est qu'on ne tombe pas dessus par accident. À dire ainsi à l'écran,
plutôt que de laisser croire autre chose.

### Ce qui bloque

Les deux formes demandent du contenu réel. Rien ne se construit tant que le
corpus n'est pas revenu.
