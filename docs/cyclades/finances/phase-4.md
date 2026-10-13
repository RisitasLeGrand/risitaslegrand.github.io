# Finances, phase 4 — l'usage par Odyssée

Ce que le prompt appelle sa phase 4 : « Qui lit mon budget », le dossier
surveillé, l'export ICS des échéances.

## 1. Un interrupteur n'est pas une garantie

C'est la décision qui tient tout l'écran. Sept interrupteurs qui laissent
ensuite chaque lecteur puiser dans les mêmes données ne promettent rien : ils
déclarent une intention, et la première fonction écrite sans y penser la
dément. La ligne « Habitudes — la régularité de la tenue, **aucun montant** »
n'est tenue que si Habitudes ne reçoit structurellement aucun montant.

Chaque consommateur reçoit donc une **projection** construite pour lui.
L'interrupteur décide si elle est calculée ; sa forme décide de ce qu'elle
peut contenir. Les deux sont nécessaires, et c'est la seconde qui protège.

`controlerLesConsommateurs()` le vérifie **sur des données** : il fabrique un
budget aux montants reconnaissables (78 317, 234 571, 41 983 centimes —
choisis pour qu'aucun pourcentage ni compte de jours ne les reproduise),
projette les sept, et refuse si un montant apparaît là où la promesse dit
qu'il n'y en a pas.

Et `fuitesDe()` est exportée exprès : un garde-fou qu'aucun essai ne peut
**faire échouer** ne prouve rien par son silence. Un essai le nourrit d'une
vue fabriquée pour fuir, et vérifie qu'il la refuse.

**Une correction en chemin.** Le détecteur ne connaissait que l'espace
insécable produit par `euros()`. Une fuite écrite à la main dans une phrase —
« vous avez payé 783,17 € » avec une espace ordinaire — lui échappait. Les
deux formes sont couvertes depuis.

## 2. L'écran montre, il ne se contente pas de promettre

« Voir ce qu'il reçoit » affiche la projection réelle, calculée à l'instant
sur les vraies données. Si la ligne dit « aucun montant » et que l'aperçu en
montre un, la contradiction est sous les yeux de la personne au lieu d'être
enfouie dans un module.

Les sept interrupteurs se règlent **coffre fermé** : savoir qu'on veut fermer
l'accès de l'IA à son budget ne devrait pas demander d'ouvrir son budget.
Seuls les aperçus, qui lisent des données réelles, l'exigent.

## 3. Deux règles qui ne se règlent pas

**La veille ne s'allume jamais sur un budget dépassé.** Un budget serré est un
choix, pas un signal de santé ; confondre les deux ferait d'une période
d'économies volontaires une alerte sur l'état de quelqu'un, et apprendrait à
cette personne à ignorer la veille. Elle ne reçoit qu'une **cadence de
dépenses** comparée à sa propre base, sans aucune référence au prévu. Un essai
divise tous les montants prévus par quatre — ce qui met toutes les lignes hors
tolérance — et exige que la projection de la veille soit **identique au
caractère près**.

**« Demander à l'IA » redemande l'accord à chaque fois.** C'est le seul des
sept dont la sortie quitte l'appareil ; un accord donné en janvier ne peut pas
couvrir un envoi fait en novembre sur des données que personne n'a relues.

## 4. Deux fuites trouvées, dont une par le prompt lui-même

**Le résumé pour l'IA listait les lignes.** Il devient une fuite dès qu'on se
rappelle d'où viennent les intitulés : une ligne déduite du réel porte le nom
de l'enseigne, et une liste de lignes est une liste de commerçants.
« Pharmacie du Centre : 240 € ce mois-ci » dit quelque chose sur une santé,
pas sur un budget. Le résumé agrège désormais **par catégorie**, qui est un
mot que la personne a choisi. C'est la section 2 bis.8 du prompt qui l'exige,
et le prompt est arrivé après le code.

**L'export ICS portait le libellé bancaire**, et c'est l'essai de bout en
bout qui l'a trouvé. La cause était en amont : une ligne déduite du réel
gardait « VIR M DUPONT LOYER » comme intitulé, qui traversait ensuite toute
l'application. `intituleDepuisLeLibelle()` retire la plomberie bancaire et
rend « Dupont Loyer » — on retire, on ne devine pas, et la personne corrige.

## 5. Le dossier surveillé

Le plancher honnête est **un geste**, pas zéro : sans serveur ni tiers, rien
ne va chercher un fichier pendant que l'application est fermée.

**Le nom d'un relevé est une donnée sensible**, et c'est le point que
l'implémentation évidente rate. Une banque nomme ses relevés
`Releve_CCP_00055347_202609.pdf` : une liste de « fichiers déjà importés »
gardée en clair ferait entrer un numéro de compte dans la base. On enregistre
donc une **empreinte SHA-256** de `nom|taille|modification`, jamais le nom.
Le bandeau, qui s'affiche coffre fermé, ne dit qu'un nombre.

Le dossier est demandé en **lecture seule** — la synchronisation demande
l'écriture parce qu'elle y dépose des paquets ; ici Cyclades n'a aucune raison
d'écrire chez vos relevés, et demander un droit inutile est la meilleure façon
de faire refuser celui dont on a besoin.

L'empreinte est notée **avant** la lecture, et non après l'import : un relevé
illisible ou refusé par le contrôle de solde serait sinon reproposé à chaque
ouverture, indéfiniment.

## 6. L'export ICS des échéances

Journées entières, parce qu'un prélèvement n'a pas d'heure. UID dérivé de
l'occurrence, qui est déterministe — c'est ce qui fait qu'un réexport **met à
jour** l'agenda au lieu d'y empiler douze loyers. Montant dans le titre, parce
qu'un agenda n'affiche souvent que le titre en vue mensuelle.

C'est le **seul export de Finances qui quitte l'appareil** : un agenda est,
pour la plupart des gens, synchronisé chez un tiers. Le fichier ne porte donc
que le libellé, la date et le montant ; `controlerLExportDEcheances()` refuse
un compte, un IBAN, un motif d'appariement, et les mots « solde », « écart »,
« reste à vivre ».

## 7. Essais

| Suite | Assertions |
|---|---|
| `essais:consommateurs` | 63 |
| `essais:dossier-releves` | 51 |
| `essais:consommateurs:ecran` | 29 |
| `essais:rapprocher-ecran` (ICS compris) | 47 |

Schéma **v27**, magasin `odysseeConsommateurs` scellé.

## 8. Ce que la phase ne fait pas

- **Le dossier surveillé n'est pas éprouvé en navigateur** : `showDirectoryPicker`
  ouvre une fenêtre native que Playwright ne sait pas piloter. Le module et
  ses empreintes sont éprouvés en nœud ; le parcours complet reste à vérifier
  à la main, sur Chromium, et il ne fonctionnera ni sur Firefox ni sur Safari
  ni sur téléphone — l'écran le dit.
- **Les jours d'import** sont déduits des dates d'écriture des opérations :
  le magasin `import` du modèle existe mais n'est pas rempli. La régularité
  de la tenue est donc mesurée de biais, et c'est préférable à l'inventer.
- **`revuesFaites` est vide** : la revue mensuelle vient avec les quêtes.
