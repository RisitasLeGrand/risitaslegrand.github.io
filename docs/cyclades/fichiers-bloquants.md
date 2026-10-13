# Ce qui me manque, et ce que chaque manque bloque

**État au 13 octobre 2026.** Rien d'autre ne me bloque : tout le reste avance.

---

## 1. Échelles de la psyché — bloquant total

Aucune des trois échelles ne peut être intégrée sans son texte officiel. La
règle vient du prompt lui-même : pas de reconstitution de mémoire, pas de
copie depuis un site tiers. **Deux voies, l'une ou l'autre suffit.**

**Voie A — les fichiers.** Trois PDF, tels que téléchargés, plus ce qui est
écrit **sur la page de téléchargement** (c'est là que vit la licence, pas
toujours dans le PDF) :

| Fichier | Où | Ce que j'en tire |
|---|---|---|
| WHO-5 français | `cdn.who.int` — « Indice (en cinq points) de bien-être de l'OMS » | texte, consigne, items, options, règle de score |
| Page de droits de l'OMS | `www.who.int/copyright` | portée de la licence CC BY-NC-SA 3.0 IGO |
| PHQ-9 français | `phqscreeners.com` | texte + **la liste des variantes de français offertes** |
| GAD-7 français | `phqscreeners.com` | idem |

**Voie B — la passerelle réseau.** Ajouter `cdn.who.int`, `www.who.int`,
`iris.who.int` et `www.phqscreeners.com` sous *Allowed domains* de
l'environnement `env_0198bLo9y2XVzvhccU7sPF7k` — **celui-ci, pas l'autre
« Default »**. Un conteneur neuf a été essayé : le refus vient bien de la
politique de cet environnement, pas du cache.

Sans l'un ou l'autre : le check-in rapide suffit, rien d'autre n'attend.

## 2. Contenu INSP — trois thèmes sur 29 bloqués

Les fascicules renvoient à des annexes qu'ils ne reproduisent pas.

| Document | Référence | Débloque |
|---|---|---|
| `Annexe4_Fiches connaissances pour épve RCP_HG.pdf` | cas pratique F1, page 11 | 1 thème |
| `RCP_Devoir1_Corrigé.pdf` | cas pratique F4, page 9 | 1 thème |
| Corrigé de la question 3 de la « V0 » en QRC | questions européennes F1, page 64 (« La crise de l'espace Schengen ») | 1 thème |

Les **26 autres thèmes manquants sont rédigeables immédiatement**, et l'agent
y travaille. Ces trois-là restent de côté, nommés dans l'inventaire.

## 3. QCM DGFiP — 70 questions non recoupées

| Document | Couvre |
|---|---|
| Corrigé de l'épreuve n° 2, concours 2026 **inspecteur** | 43 questions |
| Corrigé de l'épreuve n° 2, concours 2026 **contrôleur** | 27 questions |

Attention au piège : les corrigés 2026 déjà en main sont ceux du **sujet-test**
de contrôleur, qui est un autre document. Ils couvrent les 27 questions issues
du sujet-test, pas celles des épreuves réelles.

Sans eux, ces 70 questions sont vérifiées pour **fidélité** (l'énoncé et les
options correspondent au sujet officiel) mais pas **validées** (aucune source
ne tranche la bonne réponse).

## 4. Finances — rien de bloquant, deux choses utiles

Le CIC est validé sur deux relevés à un an d'écart. Ce qui ferait progresser :

- **un relevé d'une autre banque**, si tu en as une — c'est la seule
  vérification qui reste ;
- **un copier-coller du tableau d'opérations** depuis le site de ta banque,
  tel quel, dans un fichier texte. Le collage est devenu une méthode de
  premier rang (c'est lui qui comble le mois entre deux relevés), et je ne
  sais pas ce que le presse-papiers en rend.

Et si une banque propose un **OFX** ou un **QIF** — souvent cachés derrière
« exporter vers un logiciel de comptabilité » plutôt que « télécharger » —,
c'est plus simple que tout le reste.

## 5. Ce qui ne me manque pas

Pour mémoire, afin que personne ne cherche : les 28 fascicules sont là et
lisibles, les 25 corrections d'annales aussi, les deux sujets 2026 également,
et le gabarit de relevé CIC est éprouvé. Aucune décision de conception
n'attend de réponse.
