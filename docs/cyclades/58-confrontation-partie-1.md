# Prompt 58, partie 1 — confrontation à l'état de `main`, et plan

Confrontation faite le 19 octobre 2026 sur `6939f8a`, l'audit datant de
`61f93b7`. Méthode : chaque constat est dit **« encore vrai »**, **« déjà
corrigé »** ou **« contesté »**, avec ce qui l'établit. Rien n'est écrit tant
que le plan n'est pas arrêté.

Trois niveaux de preuve sont distingués, et jamais confondus :
**mesuré** (sonde réelle en navigateur), **lu** (le code, à la ligne près),
**supposé** (ni l'un ni l'autre).

## Les huit points de la partie 1

| Point | Verdict | Ce qui l'établit |
|---|---|---|
| **B-1** restauration non atomique | **encore vrai** | *Lu.* `db.ts:2671` : `viderProgression(base)` hors transaction, puis **une transaction par magasin** dans la boucle `for (const nom of MAGASINS_PROGRESSION)`, chacune close par son `await tx.done`. Un échec au vingtième magasin laisse la base vidée et à moitié réécrite. |
| **B-3** le groupe « Réglages et profil » détruit le coffre | **encore vrai, et pire que décrit** | *Lu + mesuré.* `sauvegarde/groupes.ts:329` déclare `magasins: ['etat']`, le magasin entier. En sondant A7 j'y ai vu `coffre.sel-enveloppe`, `coffre.enveloppe`, `appareil`, `coffre.verrou-automatique.delai`. Le libellé promet « XP, série, badges, rotation » et ne nomme pas le coffre. |
| **B-4** fusion interrompue, et l'écran dit « identiques » | **encore vrai** | *Lu.* `sync/service.ts` écrit le journal, puis ne matérialise que `ciblesRecues`. Le commentaire « le recalcul suivant rétablira la cohérence » est toujours là, et il est faux : un paquet suivant n'apporte plus rien pour cette cible. |
| **B-5** « Sauvegarder d'abord, puis effacer » sans preuve | **encore vrai** | *Lu.* `stockage.astro:590` : `offrirLeFichier(...)` puis, à la ligne suivante, `noterSauvegardeReussie()`. Aucune confirmation A3 entre les deux. |
| **A7 / G-2** l'effacement n'efface pas tout | **encore vrai** | *Mesuré* le 19/10 à 07 h 17, sonde réelle : témoin posé dans `localStorage`, dans un cache et dans une seconde base ; après « Tout effacer », les trois sont intacts. Relevé avant et après identiques. |
| **G-5 / G-6** les confirmations ne comptent pas tout | **encore vrai** | *Lu.* `progression.astro:676` : `combienIci = cartesIci.length + quizIci.length + joursIci.length`. Ni Odyssée, ni Santé, ni Finances, ni le profil. |
| **G-13** l'erreur brute à l'écran | **encore vrai** | *Lu.* `progression.astro:729` : `dire('message-cyclades', (e as Error).message, 'echec')`. |
| **G-10** la persistance demandée une seule fois | **encore vrai** | *Lu.* `progression.astro:794` : `assurerLaPersistance()` est appelée dans le fil d'une sauvegarde confirmée, et nulle part à l'ouverture. |

**Aucun des huit n'est déjà corrigé, et aucun n'est contesté.** Les deux que
l'audit marquait « lu » (B-5, G-10) sont confirmés par lecture ; celui qu'il
marquait « lu » sur A7 est désormais **mesuré**.

## Ce que j'ajoute à l'audit, et qu'il ne dit pas

**La phrase de la boîte « Tout effacer » est fausse, et c'est plus grave que
la portée.** Elle annonce que partent « les séances, les notes, les mesures
et **les réglages enregistrés dans ce navigateur** ». Les réglages de
`localStorage` — le thème, la position de lecture d'une fiche audio —
survivent. Une promesse non tenue dans la phrase même qui demande une action
irréversible : quelqu'un qui efface avant de prêter son ordinateur croit
avoir tout retiré.

## L'ordre que je propose, et pourquoi celui-là

Les huit points ne se valent pas. Deux peuvent **détruire** des données
aujourd'hui, trois en **perdent** en silence, trois **mentent** à l'écran.

1. **B-3 d'abord.** C'est le seul qui casse le coffre, c'est-à-dire qui rend
   illisible ce qui existe, sans recours. Une liste blanche de clés, et les
   clés techniques hors de portée de l'effacement ciblé comme de l'export.
2. **B-1 ensuite.** La restauration est le geste qu'on fait quand tout va
   déjà mal ; elle ne doit pas pouvoir aggraver. Une seule transaction,
   vidage compris, et l'instantané **confirmé avant** d'écrire.
3. **B-5** dans la foulée de B-1 : même recette, même confirmation A3.
4. **A7 et sa phrase.** L'effacement efface vraiment, et la boîte dit la
   vérité sur ce qui reste et sur les autres appareils.
5. **B-4.** Journal et matérialisation dans la même transaction, ou rejeu au
   démarrage ; et l'écran cesse de dire « identiques » quand ils divergent.
6. **G-5, G-13, G-10**, qui sont petits et sans risque.

## Les essais, avant d'écrire

Chaque reproduction de l'audit devient un essai **rouge d'abord** : B-1 avec
l'échec à la vingtième écriture, B-3 avec le coffre qui ne se rouvre plus,
B-4 avec la tâche au journal et pas au magasin, B-5 avec le téléchargement
qui échoue. La sonde A7 du 19/10 devient elle aussi un essai : elle est
rouge aujourd'hui, elle doit virer au vert.

Un essai qui ne rougit pas avant la correction ne prouve rien — c'est la
règle que ce dépôt applique partout, et elle vaut ici plus qu'ailleurs,
puisqu'il s'agit de perte de données.

## Ce qui n'est pas dans cette partie

La partie 2 (clé de coffre partagée, Santé synchronisée, identité d'appareil
à la restauration, conflits de textes, format v2) et la partie 3 (l'écran
« Mes données ») ne sont pas touchées ici. **Recoupement annoncé** : la
partie 2 prévoit de journaliser et sceller les six magasins de Santé, et
l'agent B travaille exactement là. C'est à la fusion que cela se tranche.

---

## Avancement — B-3, livré le 19 octobre

**Le rouge, d'abord.** L'essai `essais:reglages-sans-coffre` a été écrit
avant le correctif et exécuté contre une construction de `main` sans lui. Il
part de `/odyssee/psyche/`, ouvre un vrai coffre avec un vrai mot de passe,
pose deux réglages, puis efface « Réglages et profil » depuis l'écran de
`/stockage/`, en cliquant ce que la personne clique.

Mesuré avant le correctif : l'écran annonce « etat — 6 sur 6 », puis
« 6 enregistrement(s) effacés ». Le sel du coffre, ses enveloppes et
l'identité de l'appareil partent avec les deux réglages.

**Un constat qui n'était pas au prompt.** Après cet effacement, l'écran sous
coffre ne redemande même plus le mot de passe : un coffre dont le sel a
disparu ne se distingue pas d'un coffre jamais créé. La personne n'a donc
aucun message, et aucune occasion de comprendre que ses données chiffrées
sont devenues inatteignables. Le correctif empêche la situation ; **il ne la
signale pas**, et aucun écran ne la signalerait aujourd'hui. C'est une ligne
du prochain tableau, pas une correction silencieuse.

**Ce qui est écrit.** Un groupe peut désormais ne désigner que certaines
**clés** d'un magasin, par noms exacts et par préfixes, et la table est
indexée par magasin — « Odyssée » désigne quarante-quatre magasins entiers
et quatre clés d'`etat`, ce qu'une liste unique n'aurait pas permis.
L'effacement et l'export lisible suivent la même déclaration.

Quatre clés ont changé de domaine : le socle d'activité, l'activation de
Santé et les deux clés du dossier de relevés n'étaient effaçables que sous
le libellé « Réglages et profil », qui ne les décrit pas. Elles reviennent à
Odyssée, qui porte déjà leurs données.

Un réglage porte un nom variable (`selection:<exercice>`) : une liste de
noms exacts l'aurait manqué en silence, d'où les préfixes.

Le registre versionné des réglages perd les entrées des clés effacées. Sans
cela, le profil effacé serait revenu à la première synchronisation, avec sa
valeur et son horloge. **Aucune pierre tombale n'est posée** : un autre
appareil qui porte encore le réglage le renverra. C'est le sujet de l'A7, et
il n'est pas tranché ici.

**G-8 est réglé par la même déclaration** : l'export lisible honore les clés
visées, donc ni le sel, ni les enveloppes, ni le secret d'appairage ne
sortent plus en clair.

**Les garde-fous.** Deux essais, et ils ne se recouvrent pas. Le premier
compare des listes, hors navigateur : aucune clé technique dans une liste
blanche, aucun préfixe personnel qui attrape une clé technique, deux groupes
qui ne visent jamais la même clé, et un magasin partagé que personne ne
prend entier. Le second constate le comportement, dans un navigateur : le
coffre se referme et se rouvre avec le bon mot de passe, après l'effacement.
Il relève aussi toutes les clés réellement présentes dans `etat` et refuse
qu'une seule échappe au classement — c'est ce contrôle-là qui parlera le
jour où une clé nouvelle apparaîtra.

### Les deux constats, tranchés par le pilote sous délégation (19/10)

Le pilote a tranché les deux constats ci-dessus dans le cadre du 58 et de la
délégation d'Alexis.

**Le registre de synchronisation : il faut la pierre tombale.** Le 58 pose
que l'effacement **ciblé** se propage, et que son écran le dit. Un réglage
effacé de façon ciblée doit donc partir aussi des autres appareils. La
pierre tombale s'écrit avec A7/G-2, puisque c'est le même sujet, et l'essai
simule deux appareils : un réglage effacé sur l'un ne revient pas quand
l'autre se synchronise. « Tout effacer sur cet appareil » reste local, selon
la décision 4 : là, pas de pierre tombale.

**Le coffre sans clé : un signal, en petit, dans la partie 1.** Au
démarrage, ou à l'ouverture d'un écran sous coffre, s'il existe des
enregistrements scellés alors que le sel ou l'enveloppe manque, l'écran le
dit en clair et propose la restauration. Il ne crée **jamais** un nouveau
coffre par-dessus en silence : la création demande une confirmation qui cite
ce message. L'essai part de la reproduction de B-3 sans le correctif.

L'ordre ne change pas : B-1, B-5, A7/G-2 avec la pierre tombale, B-4, puis
G-5, G-13 et G-10, et une batterie complète à la fin de la partie 1.

## Avancement — B-1, livré le 19 octobre

**Le rouge, d'abord, et sur le bon chemin.** L'essai de restauration
atomique existait déjà, mais il n'éprouvait que l'ancien chemin JSON. Le
chemin d'archive — `.cyclades` → `restaurer()` → `remplacerMagasins()` — ne
portait pas l'invariant. L'essai a donc été étendu : il fabrique une vraie
sauvegarde par le bouton de l'écran, met la base dans un autre état, puis
restaure avec une coupure armée au milieu.

Mesuré avant le correctif : après la coupure, le magasin des cartes est
**vide**. Ni l'état d'avant, ni la sauvegarde. C'est le pire des deux états,
et il arrive au moment précis où l'on restaure parce qu'on a déjà perdu
quelque chose.

**Le seuil de la coupure est dérivé, pas figé.** L'audit parlait d'un échec
« à la vingtième écriture ». Sur une base d'essai, il n'y en a pas vingt :
une coupure armée à vingt ne coupe jamais, et l'essai passerait au vert sans
avoir rien éprouvé. L'essai compte donc les écritures d'une restauration
complète, coupe à la moitié, et **refuse de juger** si une restauration tient
en moins de quatre écritures.

**Ce qui est écrit.** Une transaction unique, le vidage compris. Si une
écriture échoue, `abort()` rend la base telle qu'elle était. Deux précautions
sont écrites au-dessus du code, parce qu'elles sont faciles à défaire : aucune
attente étrangère à la transaction entre deux écritures — une transaction
IndexedDB se valide d'elle-même dès que la boucle d'événements tourne à vide,
et le vidage serait alors acquis ; et c'est l'erreur d'origine qui est
relancée, non celle de l'abandon, sans quoi la cause serait remplacée par sa
conséquence.

**Un constat en passant, pour G-13.** Après la coupure, l'écran affiche le
message brut de l'erreur. C'est exactement le constat G-13 — « ne jamais
montrer un `Error.message` à l'écran ». L'essai vérifie donc seulement que
l'écran **n'annonce pas une réussite** et qu'il dit quelque chose ; il ne
prétend pas couvrir G-13, qui vient à son tour.

## Avancement — B-5, livré le 19 octobre

**Le défaut, en une phrase.** Le bouton « Sauvegarder d'abord, puis
effacer » téléchargeait la sauvegarde, notait aussitôt « sauvegarde
réussie », puis effaçait. Or un navigateur ne dit jamais si un
téléchargement a abouti : pas d'événement, pas de promesse, pas d'accès au
dossier de destination. C'est le constat A3 du 43, que l'écran de
Progression respecte déjà en demandant à la personne de retrouver le
fichier. Celui-ci ne le demandait pas.

Sur un téléphone qui refuse le fichier, ou un disque plein, la sauvegarde
n'existait donc pas et l'effacement avait lieu quand même. C'est le seul
endroit du site où une promesse non tenue se paie par une perte sans
recours, puisqu'on efface en s'appuyant sur une sauvegarde qui n'est
peut-être pas là.

**Ce qui est écrit.** La preuve est demandée avant d'effacer, par la boîte
commune, avec deux réponses qui disent l'une et l'autre ce qu'elles font :
« Je l'ai retrouvé, effacer » et « Je ne le trouve pas ». Un « je ne le
trouve pas » n'efface rien et le dit. La date de dernière sauvegarde
réussie n'est notée qu'à la confirmation, pour la même raison.

**L'essai éprouve les deux réponses, et le refus d'abord** — c'est lui qui
manquait. Rouge avant le correctif : aucune boîte ne s'ouvrait, et les onze
enregistrements partaient sans qu'on ait pu dire que le fichier n'était pas
là.

## Avancement — A7 et G-2, livrés le 19 octobre

**Les quatre endroits.** « Tout effacer » ne vidait que les magasins de la
base `revinsp`. Sonde du 19 octobre, devenue essai : `localStorage` intact,
Cache Storage intact, les autres bases IndexedDB intactes — alors que la
phrase de confirmation annonçait « les réglages enregistrés dans ce
navigateur ». Désormais partent aussi les deux stockages de l'onglet, les
caches de la coquille hors ligne, `revinsp-instantanes` (qui garde une copie
complète de la base) et `cyclades-cles`.

L'essai a **deux moitiés**, parce qu'un effacement se trompe de deux façons.
Ne pas assez effacer, c'est le défaut corrigé. Trop effacer, en emportant ce
qui n'est pas à nous, en serait un autre : un témoin étranger est donc posé à
côté de chaque témoin à nous, et il doit survivre. Il survit.

**Les libellés disent la portée.** « Effacer ma progression » annonçait moins
que ce qui part, et « Réinitialiser » ne disait rien. Le bouton et le titre
s'appellent maintenant « Tout effacer sur cet appareil ». La phrase nomme les
quatre endroits, et l'écran annonce ensuite le compte de chacun.

**G-2 : la boîte dit ce qui NE part pas.** Si l'appareil est appairé, elle
dit que les autres appareils liés gardent leurs données et que la première
synchronisation renverra ici ce qui vient d'être effacé. C'est là qu'une
personne se trompe, et le dire après coup serait inutile.

**Délier est un geste séparé**, et il ne s'offre que s'il a un sens : le
bouton reste caché quand aucun appairage n'est mémorisé. Proposer de couper
un lien qui n'existe pas ferait croire qu'il existe. Délier n'efface rien, ni
ici ni ailleurs, et l'écran le dit.

**La pierre tombale, et l'essai à deux appareils.** L'effacement ciblé pose
une marque d'effacement sur l'entrée du registre versionné, horodatée comme
une écriture. Elle gagne par l'horloge, donc l'autre appareil supprime la clé
à son tour. À l'application, elle **supprime la clé** au lieu d'écrire
`null` : un profil absent se réinitialise, un profil `null` casse la lecture.

L'essai de fusion appelle le moteur **des deux côtés** — un effacement qui ne
se propagerait que dans un sens laisserait les deux appareils en désaccord
permanent — et vérifie le cas symétrique : un réglage **remis** après
l'effacement gagne, sinon un effacement d'hier empêcherait d'écrire
aujourd'hui, pour toujours.

**Ce que je n'ai pas obtenu, et je le dis.** L'essai de fusion ne rougit pas
avant le correctif : le moteur transporte déjà les champs qu'il ne connaît
pas, donc la règle de propagation passait « par accident ». Ce qui manquait
était le type et, surtout, l'application — écrire au lieu de supprimer. C'est
l'essai de navigateur qui porte le rouge : avant, l'entrée du registre était
simplement retirée, et l'essai constate maintenant la marque, l'absence de
valeur et l'horloge qui a avancé.

**Et l'écran de l'effacement ciblé dit qu'il se propage.** C'est l'écart le
plus utile entre les deux effacements, et il n'était écrit nulle part : une
personne qui veut retirer une donnée de partout doit passer par l'effacement
ciblé, et non par le bouton qui semble plus radical.

## Avancement — le coffre sans clé, livré le 19 octobre

Le second constat tranché par le pilote. Ce n'est pas un des huit points :
c'est l'anomalie que B-3 a révélée en passant, et qui n'était dans aucun
prompt. Le correctif de B-3 empêche désormais d'arriver là par un
effacement ciblé ; il reste tous les autres chemins — un nettoyage de site
par le navigateur, un effacement manuel, une base en partie perdue.

**Le mécanisme réel, et il est plus grave que ce que j'avais écrit.** Je
disais « la personne n'a aucun message ». C'est exact, mais ce n'est pas le
pire. `selLocal()` **crée un sel neuf** quand il n'en trouve aucun. Donc le
premier mot de passe tapé après la disparition ne produisait pas une erreur :
il créait un coffre **par-dessus** des données devenues illisibles, en
silence, et avec l'air d'avoir réussi. Les enregistrements scellés restaient
là, définitivement muets, au milieu de données neuves.

**Le constat, et pourquoi trois conditions.** Le signal paraît si, et
seulement si : des enregistrements scellés existent en base, **et** aucune
enveloppe n'est posée, **et** aucun sel valide n'est présent. Aucune ne
suffit seule. Un sel absent sur une base vierge, c'est le cas de tous les
premiers jours ; des scellés sans enveloppe, c'est le cas normal d'un coffre
mémorisé par mot de passe. C'est la conjonction qui ne peut pas arriver sans
perte.

**Où il est écrit : dans le formulaire partagé, une fois.** Les neuf écrans
sous coffre passent par `FormulaireCoffre.astro`, donc le signal paraît
partout d'un coup. Le recopier aurait reproduit l'écart du 14 octobre — six
pages sur dix sans bouton de fermeture, parce qu'un bloc recopié n'évolue
jamais partout.

**Ce que l'écran dit, et ce qu'il retire.** Il dit que la clé a disparu,
qu'**aucun mot de passe ne les rouvrira** — ce n'est pas un mot de passe
oublié —, combien d'enregistrements sont dans ce cas, et il propose de
restaurer une sauvegarde. Et il **retire le formulaire d'ouverture** :
proposer un champ de mot de passe qui ne peut rien ouvrir, et qui en plus
écrirait par-dessus, était exactement la cruauté de la version d'avant.

**Repartir à zéro reste possible, jamais en silence.** Un bouton le nomme ;
la confirmation cite le message, donne le même nombre que l'écran, et
conseille la restauration d'abord. Un refus ne retire rien et ne pose aucun
sel. L'ouverture du coffre refuse aussi, en amont de la dérivation : la
fonction qui ouvrait créait le sel, c'est là qu'il fallait arrêter.

**Le rouge d'abord.** L'essai part de la reproduction de B-3 sans le
correctif, comme le pilote l'a demandé. Contre la version d'avant :
`waitForSelector: Timeout 30000ms exceeded … locator('#coffre-sans-cle:not(.hidden)')`
— rien ne paraissait. Quinze contrôles verts après.

**Deux de mes assertions avaient tort, et c'est l'essai qui a cédé.**
J'attendais un nombre figé ; le nombre réel est celui que la base porte, et
ouvrir le coffre écrit son propre enregistrement scellé. L'essai dérive donc
le nombre de la base et vérifie surtout que **l'écran et la confirmation
disent le même**. Et je lisais le compte avant qu'il soit écrit : il l'est
après l'affichage du bloc, d'où l'attente.

## Avancement — B-4, livré le 19 octobre

**Le défaut, et pourquoi il ne pouvait pas être réglé comme le prompt
l'imaginait d'abord.** Le pilote laissait le choix : journal et
matérialisation dans une seule transaction, **ou** rejeu au démarrage. La
première branche est fermée, et pour une raison de moteur, pas de goût. La
matérialisation relit tout le journal avant d'écrire, touche une cinquantaine
de magasins, et certains de ses enregistrements passent par le coffre — donc
par du chiffrement, donc par des `await` étrangers. Une transaction IndexedDB
se referme dès que la boucle d'événements tourne sans requête en attente : un
`await` qui n'est pas une requête de la transaction la clôt. Les deux ne
peuvent pas tenir ensemble.

**Ce qui peut être atomique, c'est le journal et la promesse.** La marque est
donc posée **dans la transaction du journal elle-même** : si les opérations
sont là, la liste du travail restant est là aussi. Elle porte les cibles à
matérialiser et les cartes à recalculer, et elle ne tombe qu'après les deux.
Elle est écrite sans `await` — c'est une requête de cette transaction, et
l'attendre ferait tourner la boucle avant les deux boucles d'écriture, ce qui
refermerait la transaction au milieu.

**Le vrai dommage était l'écran, et c'est lui que le 58 visait.** L'empreinte
d'état ne porte que sur les deux journaux et les réglages versionnés — c'est
son rôle, et c'est juste. Elle était donc **égale** à celle de l'émetteur dès
le `tx.done` du journal. L'écran annonçait « les deux appareils sont désormais
identiques ✓ » alors que les séances, les notes et les mesures n'avaient pas
été écrites. Désormais, « identiques » exige les deux : l'égalité des
empreintes **et** l'absence de marque.

**Le commentaire du code était faux, et il est retiré.** Il disait « le
recalcul suivant rétablira la cohérence depuis ce qui a été écrit ». Aucun
recalcul ne part tout seul, et un paquet suivant n'apporte plus ces
opérations : elles sont déjà au journal, donc plus « reçues ». Rien ne
rétablissait rien.

**Trois chemins de réparation, et aucun n'efface les autres.** La bannière
« Fusion interrompue : une partie a été reçue » paraît en tête de
`/appareils/`, avec le compte des rubriques à ranger, le nom de l'appareil
émetteur, la date, et un bouton « Reconstruire ». La veille d'arrière-plan
rejoue au démarrage, à l'endroit précis où l'on vient de constater un
appairage mémorisé **et** un mot de passe en mémoire — donc un coffre ouvert,
ce dont la matérialisation a besoin. Et une fusion suivante **réunit** le
reliquat à ses propres cibles : sans cela, une seconde interruption effacerait
la liste de la première, et plus personne ne saurait quelles cibles manquent.

**Deux listes, et elles ne se confondent pas.** Ce qu'il y a à recalculer
inclut le reliquat ; ce qui part à l'historique des lots n'est que ce que ce
lot-ci a apporté. Une annulation ne doit pas défaire les cartes d'une fusion
d'avant qu'elle n'a fait que finir.

**Une phrase est devenue fausse en route, et elle est corrigée.** L'aperçu
d'un paquet dont l'empreinte égale la nôtre disait « ce paquet n'apporte rien,
et le fusionner ne changera rien ». Avec une marque posée, fusionner **finit**
le travail. L'aperçu le dit maintenant, et renvoie au bouton.

**Le rouge, mesuré.** Contre une construction de `main` sans le correctif :
`waitForSelector: Timeout 40000ms exceeded … locator('#fusion-interrompue:not(.hidden)')`.
Vingt-quatre contrôles verts après.

**Ce que l'essai éprouve, et ce qu'il n'éprouve pas.** L'interruption n'est
pas provoquée en tuant l'onglet au bon millième de seconde : ce serait un
essai qui passerait une fois sur dix. L'essai **écrit l'état que
l'interruption laisse** — l'opération au journal, la marque posée, rien dans
le magasin de domaine — puis mesure l'écran et la réparation. Que la marque
soit bien posée par la transaction du journal, c'est *lu dans le code* ; ce
qui est *constaté*, c'est le comportement dans cet état, et le fait qu'une
vraie fusion de paquet réunit le reliquat au lieu de l'écraser — quatrième
section de l'essai, à deux appareils et un paquet réel.

**Deux erreurs de ma part, trouvées par l'essai.** Mon bouton reprenait
l'identifiant `reconstruire`, que la page porte déjà pour « Reconstruire
depuis le journal » — la réparation complète, qui rejoue tout. `$()` aurait
rendu le mien et laissé l'autre muet. Et le compte rendu de réussite était
écrit **dans** la bannière, que la peinture d'état masque aussitôt : le texte
était juste, et invisible. Il est sorti de la bannière.

## Avancement — G-5 et G-6, livrés le 19 octobre

**Le défaut.** Les deux confirmations — « Tout effacer sur cet appareil » et
« Remplacer toute la progression » — additionnaient trois magasins : les
cartes, les quiz et les journées. Ni Odyssée (quarante-quatre magasins), ni
Santé, ni Finances, ni le profil. Une personne qui portait quatre mille
enregistrements d'Odyssée lisait « 31 », et décidait là-dessus.

**Des deux, la restauration était la plus dangereuse.** Un effacement se voit
venir ; une restauration se présente comme un gain. « Ce navigateur en porte
31 » faisait écraser Odyssée entière en croyant risquer trente et un
enregistrements.

**Ce qui est écrit.** Un compte **par groupe**, tiré de la même déclaration
que l'effacement et l'export lisible. Un magasin nouveau entre dans un
groupe, donc dans le compte, sans qu'une ligne soit à ajouter. Les groupes
sont comptés séparément et non en une cible unique : un total juste et muet
sur la répartition ne fait pas décider — « Odyssée : 4 128 » arrête une main
que « 4 159 » n'arrête pas.

**Et la complétude ne repose pas sur ma vigilance.** Elle repose sur
l'invariant « aucun magasin n'est oublié », déjà vérifié par
`essais:effacement` : un magasin qu'aucun groupe ne nomme fait rougir la
batterie. Mesuré le 19 octobre : **68 magasins, 68 dans un groupe, aucun
orphelin**. Je n'ai donc pas ajouté de garde-fou en double.

**Les trois nombres de tête restent dits**, en détail et après les rubriques :
ce sont ceux qu'on reconnaît, et les fondre dans un total aurait été reculer.

**Le rouge, mesuré.** Contre une construction sans le correctif : trois
contrôles rouges sur l'effacement (la rubrique Odyssée n'est pas nommée, son
compte n'est pas donné, le total ne s'accorde avec rien) et deux sur la
restauration (ni rubriques, ni total).

**Deux corrections de ma part en route.** J'avais figé « Odyssée 2 » pour les
deux enregistrements semés : la boîte dit 3, parce qu'une clé d'`etat`
appartient aussi à Odyssée. L'essai dérive maintenant le nombre et vérifie
surtout que **le total s'accorde avec la somme des rubriques nommées** — un
contrôle qui vaut plus que le nombre lui-même. Et ma phrase disait « Dont 0
carte(s) suivie(s), 0 quiz et 0 journée(s) » sur une base qui ne portait
qu'Odyssée : trois zéros n'apprennent rien et font douter du reste. Le détail
ne paraît plus que s'il a quelque chose à détailler.
