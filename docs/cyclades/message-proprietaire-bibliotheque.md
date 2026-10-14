# NooTopics — ce qui est su de l'autorisation, et ce qui en découle

*Ce fichier était un brouillon de demande de licence. Il n'en est plus une :
l'autorisation a été donnée. Il garde la trace de ce qui a été accordé, par
qui, à quelle date et sous quelle forme — parce qu'une autorisation dont on ne
sait plus la portée ne vaut pas mieux que pas d'autorisation.*

---

## L'autorisation

**14 octobre 2026.** Alexis, qui connaît le propriétaire du dépôt, rapporte
que la réutilisation **ne pose pas de difficulté tant que NooTopics est
cité**.

| | |
|---|---|
| Ressource | *Nootopics Neuroscience Library*, `Nootropics123/Nootopics-Neuroscience-Library` |
| Forme de l'accord | **verbal, rapporté** par Alexis — pas de licence publiée, pas d'écrit du propriétaire au dossier |
| Condition posée | **citer NooTopics** |
| Date | 14 octobre 2026 |

## Ce que cela change, et c'est fait

- La citation est **une constante unique**, `NOM_BIBLIOTHEQUE` dans
  `src/lib/odyssee/bibliotheque-externe.ts`, reprise partout où la ressource
  est nommée : le libellé du lien, l'avertissement de sortie, la mention de
  consultation, la phrase de couverture inconnue.
- Une ligne de crédit, `ATTRIBUTION`, s'affiche **sur les deux écrans qui se
  servent de la ressource** : la fiche de molécule (la passerelle) et l'écran
  Santé (le menu de noms). Le second compte autant que le premier : ce sont
  les mêmes noms, et les afficher sans dire d'où ils viennent reviendrait à
  les présenter comme ceux de Cyclades.
- Six contrôles dans `essais:bibliotheque` tiennent la condition : le nom est
  déclaré une fois, il n'est jamais recopié en toutes lettres ailleurs, la
  ligne de crédit le reprend, et les deux écrans l'affichent. Une refonte
  d'écran qui l'effacerait passe au rouge.

## Ce que cela ne change pas

**L'écran ne proclame pas l'accord.** Il cite la source, il n'écrit pas
« utilisé avec l'autorisation de son auteur » : cette phrase affirmerait un
fait que Cyclades ne peut pas produire si on le lui demande. La trace est
ici, datée ; l'écran, lui, se contente de créditer.

**Les témoignages de tiers restent hors de portée.** La bibliothèque
rassemble 5 441 extraits de conversations signés de 342 pseudonymes. Leurs
auteurs ne sont pas le propriétaire du dépôt, et aucune autorisation venant
de lui ne peut couvrir leurs droits. Cyclades n'en reprend aucun — et c'est
indépendant de tout accord.

**La copie de la partie bibliographique (phase 5) reste non décidée.** Les
25 226 liens et leurs titres sont une autre affaire que les 970 noms : c'est
le cœur du travail rassemblé, et « pas de souci tant que NooTopics est cité »
a été dit à propos de la ressource en général, pas de la recopie de sa
bibliographie. Si c'est voulu, cela se demande explicitement.

## Pour mémoire : ce que le dépôt publie, lui

Au 13 octobre 2026, `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `README.md`,
`readme.md` et `COPYING` répondent tous **404** sur `main`. Le constat reste
vrai ; il est seulement devenu sans objet pour l'usage fait ici, puisque
l'autorisation vient d'ailleurs. Une licence publiée sur le dépôt resterait
préférable : elle survit aux conversations.
