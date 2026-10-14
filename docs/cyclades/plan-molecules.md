# Plan — molécules, bibliothèque externe, menu de déclaration

*Phase 0 du prompt « bibliothèque nootropiques ». Écrit le 14 octobre 2026.
Exécuté dans la foulée, à ta demande : tu valides a posteriori.*

## Ce que j'ai vérifié à la date, et ce que je n'ai pas pu vérifier

**Vérifié depuis ce conteneur, le 14 octobre 2026.**

| | |
|---|---|
| `raw.githubusercontent.com/.../main/index.html` | **200**, 13 278 418 octets (≈ 13,3 Mo) |
| JSON embarqué | 13 155 821 octets, clés `topics, sources, studyTypes, subtopics, compounds, compoundCats, channels, servers, rows, anecAuthors, anec, meta` |
| Dénombrement | **77** thèmes · **970** composés (970 distincts) · **11** catégories · **2** salons · **2** serveurs · **25 226** liens · **342** pseudonymes · **5 441** extraits |
| `meta` | `unique` 25 226, `shares` 27 803, du **2022-04-08** au **2026-10-12** |
| `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `README.md`, `readme.md`, `COPYING` | **404** sur `main` |

Tes chiffres du 13 octobre se confirment tous. **Aucune licence n'est accordée.**

**Non vérifiable depuis ce conteneur** — le proxy de sortie refuse tout sauf
GitHub et les dépôts de paquets :

| | |
|---|---|
| `nootropics123.github.io` | **000**, connexion refusée |
| `api.github.com` | **403** |
| PubChem, Europe PMC, PubMed, base publique des médicaments | `connect_rejected` |

Trois conséquences que rien ne contourne :

1. **Je ne peux pas vérifier que la page s'ouvre, qu'elle marche sans compte,
   ni que son champ de recherche accepte un nom collé** (2.1 l'exige). Je livre
   la passerelle, et je dis que cette vérification reste à faire chez toi.
2. **Je ne peux confronter aucun nom à une nomenclature de référence** (2.8).
   Toute entrée du registre naît donc `identite_verifiee: non`.
3. **Je ne peux vérifier aucune publication à la source.** Donc : aucune paire
   « probable », aucune limite sourcée, aucune ligne de dose étudiée, aucun
   contenu de fiche. Le prompt l'interdit deux fois — « ne comble jamais un
   vide avec une valeur tirée de ta mémoire ». Les phases 3 et 4 livrent le
   **mécanisme**, sa **validation** et ses **essais**, avec **zéro entrée**.

## Les treize décisions

**1 — Mode d'intégration : option 1**, lien sortant. Sans licence, aucune copie.

**2 — Avertissement** : ton texte, inchangé, avec « ne plus afficher ».

**3 — Message au propriétaire du dépôt** : rédigé, dans
`docs/cyclades/message-proprietaire-bibliotheque.md`. C'est toi qui l'envoies.

**4 — Journal personnel (2.3)** : nouveau magasin scellé `odysseeRessentis`,
`{ id, traitementId, jour, ressenti, indesirable, tolerance, note, majLe }`.
Rattaché au traitement, jamais à la bibliothèque. Aucun score, aucun message
rassurant, aucune XP.

**5 — Fiches concernées** : **toutes** les molécules. Restreindre aux
non-médicaments supposerait de savoir lesquelles le sont — ce que le catalogue
vide ne permet pas, et ce serait une donnée inventée.

**6 — Statut « probable »** : ajouté à l'ordre `documentée > probable >
théorique > non documentée`. Les trois idées obligatoires du message sont
contrôlées par un essai. **Une paire « probable » sans base publiée fait
échouer la validation** — et comme je ne peux vérifier aucune publication,
**aucune paire n'est livrée**.

**7 — Limites sourcées (2.5)** : trois natures (`autorite`, `rcp`,
`max-etudiee`), chacune exigeant source, date, population, voie. `max-etudiee`
impose le libellé fixe. Molécule sans limite → phrase fixe. **Zéro limite
livrée.**

**8 — Doses étudiées (2.7)** : tableau à étiquette de provenance obligatoire,
libellé fixe, familles à risque masquées par défaut. « Ma propre expérience »
est une dérivée sensible, **désactivée par défaut**. **Zéro ligne livrée.**

**9 — Fiche explicative (2.6)** : trois profondeurs, lexique, étiquette de
provenance par affirmation. **Premier lot : aucun** — voir la conséquence 3.

**10 — Étanchéité (2.0)** : la bibliothèque n'entre **pas** dans le dépôt.
Il n'y a donc rien à isoler : l'essai de dépôt vérifie son **absence**, et
l'essai du graphe d'imports vérifie qu'aucun module d'analyse ne lit le
registre de noms.

**11 — Menu des molécules (2.8)** : je confirme ta lecture (composés de la
bibliothèque ∪ catalogue). Mode **(a) amendé**, et je dois dire pourquoi
amendé.

> **Le risque juridique n'est pas négligeable, et je ne le tranche pas en ta
> faveur.** Les noms de substances sont des faits ; ce qui est repris ici,
> c'est la **sélection** de 970 composés d'une base sans licence. Le droit
> *sui generis* des bases de données (directive 96/9/CE art. 7, art. L342-1
> CPI) vise précisément l'extraction d'une partie substantielle, quand le
> producteur a consenti un investissement substantiel — ce qui est plausible
> ici. Ton prompt prévoyait la parade : reconstruire la liste depuis les
> nomenclatures publiques, la bibliothèque ne servant que de liste de
> couverture. **Ce conteneur ne peut atteindre aucune nomenclature**, donc je
> ne peux pas faire cette dérivation indépendante.
>
> **Ce que je livre à la place**, et qui satisfait ta contrainte sans rien
> publier : le registre est un fichier de `content/`, **ignoré par Git comme
> tout le contenu**, produit chez toi par `npm run molecules:registre`, et
> **chiffré** dans le paquet publié comme le reste. Les 970 noms n'apparaissent
> jamais en clair dans le dépôt public. Le menu fonctionne sans lui (catalogue
> seul) et l'essai de dépôt vérifie que rien de la base n'y figure.

**12 — Prise sporadique** : `Traitement.sporadique: boolean`. Une prise isolée
est un traitement sporadique : pas de fin, pas de rappel, pas de schéma. La
plus petite évolution possible du modèle, sans nouveau magasin.

**13 — Molécule sans fiche** : ton bandeau, mot pour mot, et une fiche minimale
sans demi-vie, sans effet, niveau de preuve « inconnu ».

## Maquette de la fiche d'une molécule

```
┌──────────────────────────────────────────────────────────────┐
│ Caféine                                      identité non    │
│                                              vérifiée        │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Aucune fiche Cyclades pour cette molécule : ses effets   │ │
│ │ et ses interactions n'ont pas été examinés par           │ │
│ │ l'application. L'absence d'alerte ne signifie pas        │ │
│ │ l'absence de risque.                                     │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ D'UN COUP D'ŒIL                                              │
│   Classe            Non documenté                            │
│   Statut en France  Non documenté                            │
│   Niveau de preuve  inconnu                                  │
│   Demi-vie          Non documenté                            │
│                                                              │
│ ▸ À la demande — mécanisme, effets indésirables  (replié)    │
│ ▸ Exhaustif — doses étudiées, limites, sources   (replié)    │
│                                                              │
│ LIMITES À NE PAS DÉPASSER                                    │
│   Aucune limite de sécurité établie par une autorité.        │
│   L'absence de limite n'est pas une preuve d'innocuité.      │
│                                                              │
│ DOSES ÉTUDIÉES                                               │
│   Aucune donnée de dose chez l'humain.                       │
│                                                              │
│ MON JOURNAL                          3 notes · chiffré       │
│   12 oct.  ressenti · tolérance                              │
│   09 oct.  effet indésirable                                 │
│   [ Noter ce que je ressens ]                                │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│ 🔗 Chercher dans la bibliothèque externe   ↗ nouvel onglet   │
│    [ Copier « Caféine » ]                                    │
│    Cyclades ne sait pas si cette ressource couvre cette      │
│    molécule.                                                 │
│                                                              │
│ Ressource de consultation. Non vérifiée. Cyclades ne         │
│ l'utilise dans aucune de ses analyses.                       │
└──────────────────────────────────────────────────────────────┘
```

Rien n'y est inventé : tout ce qui n'est pas sourcé porte « Non documenté »,
et c'est l'état réel du catalogue aujourd'hui.

## Phases exécutées

| | |
|---|---|
| **1** | 2.0 donnée morte, 2.1 passerelle, essais d'étanchéité et de dépôt |
| **2** | journal personnel lié au traitement (2.3) |
| **2 bis** | menu, registre, prise sporadique, fiche minimale (2.8) |
| **3** | statut « probable » et limites sourcées : **mécanisme et validation**, zéro entrée |
| **4** | fiche explicative et doses étudiées : **gabarit et validation**, zéro ligne |
| **5** | **non faite** — exige une autorisation écrite que personne n'a |

## Ce que ce plan ne fait pas

- Il **n'écrit aucun contenu de molécule**. Pas une demi-vie, pas une dose, pas
  une interaction. Le catalogue reste vide et le dit.
- Il **ne publie aucun nom** de la bibliothèque dans le dépôt.
- Il **ne vérifie pas** que la page externe s'ouvre : à faire chez toi.
