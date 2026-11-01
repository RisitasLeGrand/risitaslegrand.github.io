# Les décisions reçues d'Alexis, dans la session où il les a dites

## Pourquoi ce fichier existe

Le 1er novembre 2026, une décision m'a été rapportée comme venant d'Alexis :
« il t'a confirmé directement le partage de la clé du coffre entre appareils
appairés ». Elle ne m'était **pas** parvenue. La phrase d'origine existait bien,
mais dans les fichiers de pilotage, hors du dépôt — donc invérifiable d'ici.

C'est un cas qu'il faut distinguer d'un désaccord : personne n'avait tort, et la
phrase était probablement exacte. Le problème est qu'**une décision qui ne vit
que dans une relève ne peut pas être vérifiée par celui qui doit l'appliquer**,
et que certaines décisions sont justement celles qu'un agent ne doit pas prendre
sur relève : le modèle de sécurité du coffre, la publication, les comptes
payants, les données personnelles réelles, le mot de passe du site, le moteur de
voix.

Ce fichier porte donc, pour ces décisions-là, **la phrase telle qu'Alexis l'a
écrite dans une session d'agent**, avec sa date. Rien d'autre : ni résumé, ni
interprétation, ni décision rapportée par un tiers. Une ligne ici veut dire
« je l'ai lue de lui ». Une décision absente d'ici n'est pas pour autant fausse
— elle est seulement invérifiable depuis le dépôt, et c'est ce qu'il faut
pouvoir dire sans accuser personne.

**Aucune donnée sensible n'entre ici.** Les décisions portent sur
l'architecture, jamais sur un contenu personnel, et le mot de passe du site
n'apparaît dans aucun fichier du dépôt.

## Les décisions

### 1er novembre 2026 — la clé du coffre passe entre appareils appairés

> « Je confirme : partager la clé du coffre entre appareils appairés, toujours
> chiffrée »

Reçue dans la session du constructeur, d'Alexis lui-même.

**Ce qu'elle autorise.** La clé qui ouvre le coffre peut passer d'un appareil à
l'autre, entre appareils appairés. C'est un changement du modèle de sécurité du
coffre, et il n'était pas à la portée d'un agent : c'est cette phrase qui le
rend possible.

**Ce qu'elle n'autorise pas, et c'est écrit dans la phrase même** : « toujours
chiffrée ». La clé ne passe jamais en clair. Elle voyage enveloppée — sous le
mot de passe du coffre, ou sous le secret d'appairage, qui n'est jamais transmis
au relais.

**Ce que le reste du dépôt impose par ailleurs**, et que cette phrase ne lève
pas : le sceau ne porte que `{ ct, iv, v }`
(`scripts/essais-compteur-visites.mjs`, qui le vérifie), donc le choix de la clé
à l'ouverture se fait par **essai de déchiffrement** et non par un identifiant
de clé écrit en clair sur chaque enregistrement scellé. Un scellé qu'aucune clé
connue n'ouvre est compté et signalé, et **laissé intact** : ni réécrit, ni
jeté. Un appareil qui ne connaît pas encore une clé ne doit pas détruire ce
qu'il ne sait pas lire.
