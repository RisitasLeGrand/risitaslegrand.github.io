# Revenir en arrière

*Exigé par le prompt 2.9. Écrit le 13 octobre 2026 (D-014).*

Cyclades n'a pas **un** retour arrière, il en a cinq, parce qu'il a cinq
choses qui peuvent mal tourner séparément : le site publié, les données du
navigateur, le mot de passe, une actualité fausse, une routine qui déraille.
Ce document les traite dans l'ordre où on en a besoin, du plus fréquent au
plus rare, et dit pour chacun **ce que le retour ne rend pas**.

---

## 1. Le site publié

**Il n'y a pas de version précédente en ligne.** `npm run deploy` reconstruit
la branche de publication depuis zéro, dans un dossier temporaire, avec un
seul commit et un `push --force` : la branche distante ne porte jamais plus
d'une publication. Il n'existe donc nulle part un « site d'hier » à
restaurer ; revenir en arrière, c'est **republier**.

```bash
git log --oneline -15                # trouver le commit d’avant
git checkout <commit> -- src/ scripts/ site.config.mjs
printf 'SITE_PASSWORD=…\n' > .env.local
npm run build && node scripts/deploy.mjs
rm -f .env.local && ls .env.local    # « No such file » : correct
```

**Ce que ce retour ne rend pas : le contenu.** `content/` n'est pas versionné
— c'est la règle de sécurité du projet, les fiches en clair ne sont jamais
commitées. Le build repart donc du contenu **présent sur le disque
aujourd'hui**, pas de celui du commit choisi. Revenir au code d'il y a un mois
avec les fiches d'aujourd'hui publie un état qui n'a jamais existé. Si c'est
le contenu qu'il faut défaire, c'est dans `content/` qu'il faut le défaire, et
la seule copie de secours est celle de votre machine (voir
`docs/cyclades/sauvegarde.md`).

Quand ce n'est pas urgent, préférez un `git revert` du commit fautif à un
`checkout` d'un état ancien : l'historique reste lisible, et la prochaine
publication repart du présent.

## 2. Les données du navigateur

### Après une migration de schéma

Un **instantané est pris automatiquement** avant chaque migration, dans une
base IndexedDB voisine (`revinsp-instantanes`) ; les deux derniers sont
gardés. Pour y revenir : `/stockage/` → **Dernière migration** →
**Revenir avant la migration**. L'écran affiche la date de prise, les deux versions et la
taille avant de demander confirmation.

Deux instantanés, pas un, parce que la panne réelle n'est pas « la migration a
échoué » — elle échoue bruyamment — mais « la migration a réussi et quelque
chose cloche », constaté une ou deux versions plus tard.

**Ce que ce retour ne rend pas : ce qui a été saisi depuis.** La base repasse
à l'état d'avant la migration, intégralement. Tout ce qui a été révisé,
corrigé ou noté entre-temps disparaît, et l'opération ne s'annule pas. Le
message de confirmation le dit avec le nombre d'enregistrements concernés.

### Dans tous les autres cas

Restaurez une sauvegarde `.cyclades` : `/progression/` → **Restaurer une
sauvegarde**.
C'est le seul retour arrière qui couvre une erreur de saisie, un effacement
accidentel ou un appareil perdu — à condition d'avoir une sauvegarde, ce qui
est le seul geste que l'application ne peut pas faire à votre place.

## 3. Le mot de passe

Le changement se défait comme il s'est fait, en remettant l'ancien :

```bash
printf 'SITE_PASSWORD=ancien\n' > .env.local
npm run mot-de-passe
npm run deploy
rm -f .env.local
```

Et, si la rubrique Actualités est active, `npm run actualites:cles --
--resynchroniser` pour réécrire la copie chiffrée de la clé privée, puis la
réédition du texte des quatre routines sur `claude.ai/code/routines`, qui
portent le mot de passe.

**Ce que ce retour ne rend pas : rien à défaire, justement.** Un changement de
mot de passe ne rend pas illisible ce qui est déjà sorti. Les sauvegardes
`.cyclades` et les paquets de synchronisation déjà produits portent chacun
leur propre sel et s'ouvrent avec le mot de passe **de leur date**. Revenir à
l'ancien ne referme donc rien : il rouvre seulement les sauvegardes faites
sous l'ancien.

## 4. Une actualité fausse ou mal rédigée

Elle vit dans `actualites-data/`, versionnée et chiffrée. Trois gestes, selon
le cas :

| Cas | Geste |
|---|---|
| La pull request de la routine n'est pas fusionnée | la fermer |
| Elle est fusionnée, l'entrée est à corriger | `node scripts/chiffrer-actualite.mjs` la réécrit, commit |
| Elle est fusionnée, l'entrée est à retirer | supprimer le fichier, commit |

Dans les deux derniers cas, `npm run actualites:publier` — ou la poussée, qui
déclenche le workflow — suffit : la publication **remplace** le dossier en
ligne au lieu de le compléter, et régénère l'inventaire. Une suppression dans
le dépôt est donc bien une suppression en ligne, sans intervention
supplémentaire.

**Ce que ce retour ne rend pas : les copies déjà faites.** Le dépôt est
public ; une entrée publiée a pu être récupérée. Elle est chiffrée, ce qui
limite la portée du constat — mais « retiré du site » n'est pas « jamais
sorti ».

## 5. Une routine qui déraille

Sur `claude.ai/code/routines`, chaque routine se **désactive** sans se
supprimer : son historique d'exécutions reste lisible, et la réactiver
n'impose pas de réécrire son texte. C'est le geste à faire en premier, avant
de chercher ce qui a mal tourné.

La publication, elle, s'arrête en supprimant
`.github/workflows/publier-actualites.yml` : c'était l'argument pour la confier
à un workflow plutôt qu'à la routine — « il est versionné, chaque exécution
est tracée dans l'onglet Actions, et supprimer le fichier suffit à tout
arrêter ».

**Ce que ce retour ne rend pas : les pull requests déjà fusionnées.** Elles se
défont par le point 4.

---

## Les quatre choses qu'un retour arrière ne pourra jamais rattraper

1. **Un `content/` perdu** — il n'est nulle part ailleurs que sur votre
   machine, par construction.
2. **Un mot de passe oublié** — il n'y a pas de récupération ; le site, les
   sauvegardes et la clé privée des actualités deviennent définitivement
   illisibles.
3. **Une base effacée sans sauvegarde `.cyclades`** — l'instantané de
   migration ne couvre que les migrations, et seulement les deux dernières.
4. **Ce qui est sorti du périmètre** — un fichier publié, un paquet transmis,
   une sauvegarde copiée ailleurs. Le chiffrement protège ; il n'efface pas à
   distance.
