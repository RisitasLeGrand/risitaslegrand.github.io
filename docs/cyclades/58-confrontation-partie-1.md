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
