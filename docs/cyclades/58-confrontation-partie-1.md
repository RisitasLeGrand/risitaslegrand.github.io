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
