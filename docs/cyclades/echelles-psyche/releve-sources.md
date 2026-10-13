# Échelles de la psyché — relevé à la source

**Résultat : aucun relevé n'a pu être fait.** Les cinq hôtes nécessaires sont
refusés par la passerelle réseau du conteneur. Aucun octet n'a été téléchargé,
donc aucun texte d'échelle ne figure ci-dessous. Ce fichier est un constat
d'échec d'accès, pas un relevé.

Mesures faites le **13 octobre 2026**, entre **00:37:50 UTC** et **00:38:36 UTC**.

---

## 1. Atteignabilité des cinq hôtes

Commande exécutée telle quelle :

```
for u in https://cdn.who.int https://www.who.int https://iris.who.int https://www.phqscreeners.com https://phqscreeners.com; do
  printf '%-32s' "$u"; curl -sS -o /dev/null -w "%{http_code}\n" --max-time 25 "$u" 2>&1 | tail -1
done
```

Sortie brute :

```
https://cdn.who.int             000
https://www.who.int             000
https://iris.who.int            000
https://www.phqscreeners.com    000
https://phqscreeners.com        000
```

Le code `000` signifie que `curl` n'a jamais obtenu de réponse HTTP : la
connexion n'a pas été établie. En réexécutant sans masquer le canal d'erreur,
chacun des cinq hôtes rend la même ligne :

```
curl: (56) CONNECT tunnel failed, response 403
```

| Hôte | Code HTTP | Diagnostic |
|---|---|---|
| `cdn.who.int` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `www.who.int` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `iris.who.int` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `www.phqscreeners.com` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `phqscreeners.com` | — (`000`) | `CONNECT tunnel failed, response 403` |

**Cinq refus sur cinq.** Le `403` est rendu par la passerelle en réponse au
`CONNECT`, c'est-à-dire avant tout échange avec l'OMS ou avec Pfizer : ce n'est
pas un refus des sites, c'est la politique réseau du conteneur qui n'autorise
pas ces domaines. Le journal de la passerelle qualifie les cinq événements de
`connect_rejected` — « gateway answered 403 to CONNECT (policy denial or
upstream failure) ».

## 2. Les URL exactes visées, essayées nommément

Le refus portant sur l'hôte, les URL précises du cahier des charges ont été
essayées pour que le relevé soit sans ambiguïté. Même résultat, à 00:38:35 UTC :

| URL | Code HTTP | Diagnostic |
|---|---|---|
| `https://cdn.who.int/media/docs/default-source/mental-health/indice-(en-cinq-points)-de-bien--tre-de-l-oms.pdf` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `https://www.who.int/copyright` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `https://www.phqscreeners.com/select-screener` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `https://www.phqscreeners.com/images/screeners/french_phq-9.pdf` | — (`000`) | `CONNECT tunnel failed, response 403` |

Les deux dernières URL sont celles que je visais de mémoire pour atteindre la
page de téléchargement et le PDF du PHQ-9 ; **je n'ai pas pu vérifier qu'elles
existent encore**, puisque l'hôte ne répond pas. Elles figurent ici comme
tentatives, pas comme adresses confirmées.

## 3. Ce qui n'a donc pas été obtenu

Rien n'a été téléchargé. `/tmp/echelles/` est resté vide : **aucune taille,
aucune empreinte SHA-256 à rapporter**, pour aucun des trois documents.

| Document attendu | Obtenu | Pourquoi |
|---|---|---|
| WHO-5 français (titre, consigne, période de rappel, 5 items, options et valeurs chiffrées, règle de score) | Néant | `cdn.who.int` et `www.who.int` refusés par la passerelle |
| Page de droits de l'OMS (`www.who.int/copyright`) | Néant | `www.who.int` refusé |
| PHQ-9 français (texte intégral, licence) | Néant | `www.phqscreeners.com` et `phqscreeners.com` refusés |
| GAD-7 français (texte intégral, licence) | Néant | idem |
| Liste des variantes de français du PHQ-9 et du GAD-7 (France, Belgique, Canada, Suisse…) | Néant | la page de sélection des langues est sur l'hôte refusé ; je ne peux ni énumérer les variantes offertes, ni dire si une variante « France » existe |
| Mentions de copyright, de licence, de non-responsabilité et d'attribution | Néant | elles vivent dans les documents et sur les pages de téléchargement inaccessibles |

## 4. Ce que je n'ai délibérément pas fait

La consigne prime sur le résultat, donc je me suis arrêté net :

- **Aucun contournement.** Ni miroir, ni cache, ni proxy tiers, ni moteur de
  recherche, ni dépôt documentaire de substitution, ni site tiers (INSPQ,
  psychomedia, helpsy, université, PDF trouvé ailleurs).
- **Aucune reconstitution de mémoire.** Je connais approximativement la forme de
  ces trois échelles ; je n'en écris pas une ligne. Un énoncé reconstitué à un
  mot près — un « senti(e) » devenu « senti », une période de rappel approchée —
  a l'apparence du juste et n'est plus l'échelle : il vaut moins que rien, parce
  qu'il se relit sans alerter personne. Le texte français intégral demandé à
  l'étape 4 est donc **absent, et non approximé**.
- **Aucun fichier de données, aucun `NOTICE`, aucun code, aucun test.** La
  phase 1 n'est pas validée et la condition d'accès aux sources n'est pas
  remplie.

## 5. Pour débloquer

La politique d'accès réseau de l'environnement a refusé ces hôtes. Le réglage se
fait dans les paramètres de l'environnement cloud (menu de l'environnement dans
la barre de titre de la session, puis **Edit**, section **Network access**) :
soit un niveau d'accès plus large, soit l'ajout de `cdn.who.int`, `www.who.int`,
`iris.who.int`, `www.phqscreeners.com` et `phqscreeners.com` sous **Allowed
domains**, en laissant cochée la case **Allow package managers**. La marche à
suivre est décrite sur <https://code.claude.com/docs/en/cloud-environments#network-access>.

Une fois ces cinq domaines autorisés, le relevé de l'étape 2 peut être refait
sans rien changer d'autre : il ne dépend que de l'atteignabilité.

---

## 6. Tentative par un modèle externe (13 octobre 2026) — rejetée

Un relevé a été demandé à un modèle externe (Gemini) disposant d'un accès web,
le conteneur restant privé des cinq hôtes. **Son rapport est rejeté : il
n'apporte aucun texte authentifiable.** Les motifs, vérifiables :

- **Horodatage impossible.** Le rapport date la consultation du 13 octobre à
  06:35 UTC. Il a été remis à 04:36 UTC le 13 octobre — deux heures dans
  l'avenir. Cette date n'a pas été lue sur une horloge.
- **Aucune empreinte SHA-256, aucune taille en octets, aucun code HTTP**, pour
  aucun des quatre documents. Le motif invoqué — « données binaires exactes non
  accessibles par l'interpréteur de commande, mais le texte est extrait de
  manière intègre depuis l'index de données WHO » — décrit un mécanisme
  inexistant : il n'y a pas d'« index de recherche documentaire d'infrastructure
  WHO ». Un transfert réel livre la taille du fichier d'office.
- **Items du WHO-5 tronqués en milieu de phrase**, selon le motif caractéristique
  des extraits de moteur de recherche et non d'une extraction de PDF, avec
  renvoi au document pour « le contenu intégral et exact ». Les cinq items sont
  donc absents.
- **Licence paraphrasée.** La page de droits de l'OMS est rendue en « verbatim
  résumé » — contradiction dans les termes. Une licence paraphrasée est sans
  valeur. La mention de copyright du WHO-5 s'achève sur « texte abrégé, voir
  l'intégralité dans », préposition suivie de rien : artefact d'une citation qui
  n'a pas eu lieu.
- **PHQ-9, GAD-7 et la liste des variantes de français : non obtenus**, ce que le
  rapport reconnaît. Bilan réel sur quatre documents : zéro.

La règle de calcul du score qu'il avance est conforme à ce que l'on croit savoir
du WHO-5. C'est ce qui la rend inutilisable ici : rien n'établit qu'elle a été
lue plutôt que reconstituée, et sa plausibilité sert de caution au reste. Un
rapport dont les éléments vérifiables sont faux ne se rachète pas par ceux qui
sont seulement vraisemblables.

**Les fragments d'items ne sont volontairement pas recopiés dans ce fichier.**
Les y consigner, même sous étiquette, serait déposer dans le dépôt un texte
d'apparence juste qu'une relecture ultérieure prendrait pour le relevé. L'étape
du mot-à-mot reste entière.

---

## 7. Relevé externe n°2 (Qwen, 13 octobre 2026) — recevable comme piste, pas comme relevé

Second relevé externe, d'une qualité sans rapport avec le premier. **Il reste
néanmoins non authentifié, et une contradiction interne l'empêche d'être retenu
comme relevé à la source.**

### 7.1 La contradiction centrale

Dans sa partie « preuve de téléchargement », le rapport porte pour **les quatre
documents** la phrase exacte : « Je n'ai pas téléchargé ce fichier. » Tous les
champs — code HTTP, en-tête `Date`, `ETag`, `Content-Length`, taille, SHA-256,
ligne `%PDF`, producteur, nombre de pages — sont à `NON OBTENU`.

Or chaque bloc transcrit porte l'étiquette `[FICHIER] copié du fichier que j'ai
effectivement téléchargé`.

**Les deux affirmations ne peuvent pas être vraies ensemble.** L'étiquette
`[FICHIER]` est démentie par la partie B du rapport lui-même. Au mieux le texte
vient d'une page rendue par un outil d'extraction (`[PAGE]`), au pire d'ailleurs.
Aucune empreinte n'existe, donc rien n'est vérifiable : le texte ci-dessous est
**sous quarantaine**.

### 7.2 Ce que ce relevé apporte réellement

Trois choses, qui valent d'être conservées :

1. **Des URL de structure crédible**, bien plus que les chemins devinés en
   section 2 :
   - `https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/PHQ9_French%20for%20France.pdf`
   - `https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/GAD7_French%20for%20France.pdf`
   Le segment `g10060481` et l'horodatage `201412` ont la forme d'un chemin de
   gestionnaire de contenu réel, difficilement inventable de mémoire. **À
   vérifier en premier** le jour où les domaines s'ouvrent.
2. **Une variante « Canada »** signalée pour le PHQ-9 (`PHQ9_French for
   Canada.pdf`). Le rapport n'en signale aucune autre : ni Belgique, ni Suisse.
   Cette liste est donc **possiblement incomplète** et reste à établir sur la
   page de sélection.
3. **Des anomalies typographiques — dont la valeur de preuve est annulée par
   l'OCR (voir 7.2 bis).** Le texte comporte « vousavez » sans espace,
   « bienêtre » sans trait d'union, « ont- ils » avec espace interne, et un
   « géné(e) » dans le GAD-7 là où le PHQ-9 porte « gêné(e) ». Elles sont
   conservées ci-dessous sans correction, mais **elles ne prouvent rien quant à
   la fidélité du texte** : elles sont très probablement produites par le moteur
   d'OCR, non portées par les documents.

### 7.2 bis — RECTIFICATION : le texte provient d'une extraction OCR

L'utilisateur a précisé après coup que **ces transcriptions sont issues d'une
extraction OCR**. Deux conséquences, dont la première annule un raisonnement
écrit plus haut dans ce fichier et poussé le 13 octobre.

**1. L'argument d'empreinte était faux, et il est retiré.** J'avais soutenu que
les anomalies typographiques signaient une lecture réelle du PDF et que, si les
vrais fichiers les portaient, le texte serait authentifié. C'est inversé : sous
OCR, « ê » lu « é », une espace avalée et un trait d'union perdu sont les erreurs
les plus banales du procédé. Le PDF réel porte donc très probablement
« gêné(e) » dans le GAD-7 comme dans le PHQ-9, « vous avez » et « bien-être ».
**L'absence de ces anomalies dans les vrais fichiers ne réfuterait rien, et leur
présence ne confirmerait rien** : le test que j'avais proposé ne départage pas.

**2. Un texte d'échelle issu d'OCR ne peut pas satisfaire l'exigence du
mot-à-mot.** L'OCR échoue précisément sur ce qui fait la valeur de ces
documents : les accents, les suffixes « (e) » et « (s) », les parenthèses, le
glyphe « ✓ », et les chiffres des tableaux de cotation — donc les valeurs de
réponse et les seuils de score. Chaque caractère ci-dessous est suspect
individuellement, y compris dans les mentions de licence.

**3. L'étiquetage du rapport est fautif une seconde fois.** La consigne imposait
d'étiqueter tout recours à l'OCR par `OCR NON VÉRIFIÉ`. Le rapport a étiqueté
`[FICHIER] copié du fichier que j'ai effectivement téléchargé`, sans mentionner
l'OCR. La provenance réelle n'est venue ni du rapport ni de ses étiquettes.

À l'inverse, l'OCR éclaire partiellement la contradiction de la section 7.1 :
océriser suppose d'avoir obtenu un rendu des pages, ce qui situe le procédé
au-dessus de l'invention pure. Mais cela reste incompatible avec « Je n'ai pas
téléchargé ce fichier » et avec un nombre de pages à `NON OBTENU`, que toute
océrisation fournit.

### 7.3 Ce qui manque toujours

- **Toute preuve de téléchargement**, pour les quatre documents.
- **La règle de calcul du score du PHQ-9 et du GAD-7**, et leurs seuils
  d'interprétation. Seul un fragment de codage interne est rapporté pour le
  GAD-7.
- **La liste complète des variantes de français** (deux signalées sur un nombre
  inconnu).
- Le rapport initial était **tronqué** en cours de partie « droits » ; la page
  de droits de l'OMS, la ligne de licence PHQ/GAD du site et l'attribution
  portée par les PDF PHQ-9 / GAD-7 en français ont été transmises séparément,
  par collage de l'utilisateur. Leur provenance exacte à l'intérieur de la
  session externe n'est donc pas établie, et elles ne portent elles non plus
  aucune empreinte.

### 7.4 TEXTE SOUS QUARANTAINE — ne pas utiliser comme donnée d'échelle

> **OCR NON VÉRIFIÉ.** Tout ce qui suit provient d'une extraction OCR, sans
> empreinte, sans taille, sans code HTTP, et sous une étiquette d'origine
> contredite par le rapport qui la porte (voir 7.1 et 7.2 bis). **Chaque
> caractère est suspect**, en particulier les accents, les suffixes « (e) », les
> parenthèses, le glyphe « ✓ » et les chiffres de cotation. Ce texte est consigné
> pour être **recoupé contre la couche texte des PDF réels**, pas pour être
> employé, et aucun fichier de données d'échelle n'en sera tiré.

#### WHO-5 — version française (non authentifié)

Titre : `Indice (en cinq points) de bien-être de l’OMS (1999)`

Consigne : `Veuillez indiquer, pour chacune des cinq affirmations, laquelle se rapproche le plus de ce que vousavez ressenti au cours des deux dernières semaines. Notez que le chiffre est proportionnel au bienêtre.`

Exemple : `si vous vous êtes senti(e) bien et de bonne humeur plus de la moitié du temps au cours des deux dernières semaines, cochez la case 3.`

Période de rappel : `Au cours des deux dernières semaines`

Options : `Tout le Temps (5) | La plupart du temps (4) | Plus de la moitié du temps (3) | Moins de la moitié du temps (2) | De temps en temps (1) | Jamais (0)`

Items :

```text
1. Je me suis senti(e) bien et de bonne humeur
2. Je me suis senti(e) calme et tranquille
3. Je me suis senti(e) plein(e) d'énergie et vigoureux(se)
4. Je me suis réveillé(e) en me sentant frais(che) et dispos(e)
5. Ma vie quotidienne a été remplie de choses intéressantes
```

Score : `Pour calculer votre score, ajoutez les chiffres correspondant aux cases que vous avez cochées et multipliez la somme par quatre. Vous obtiendrez alors un score compris entre 0 et 100. Un score élevé signifie un meilleur bien-être.`

Mentions portées par le PDF :

```text
French translation

* * *

The WHO-5 was developed during the 1990s by the late Per Bech of the Psychiatric Centre North Zealand
(Copenhagen, Denmark), which hosted a WHO Collaborating Centre for Mental Health. The WHO-5 was derived
from other scales and studies by the WHO Regional Office in Europe [1][2]. It has been translated, tested and used
in a wide range of languages and settings across the globe [3].

In 2024 the Psychiatric Centre North Zealand and WHO agreed to assign copyright in the WHO-5 to WHO, thereby
creating the opportunity to publish and disseminate the tool as a WHO open access product.

The translation displayed on the next page was completed before WHO accepted copyright of the English version
in 2024. The translation was published on the website of the Psychiatric Centre North Zealand (Copenhagen,
Denmark). WHO is not responsible for the content or accuracy of this translation. In the event of any inconsistency
between the English and the translated version, the English version shall be the binding and authentic version.
```

#### PHQ-9 — version française France (non authentifié)

Titre : `QUESTIONNAIRE SUR LA SANTÉ DU PATIENT – 9 (PHQ-9)`

Consigne : `Au cours des 2 dernières semaines, selon quelle fréquence avez-vous été gêné(e) par les problèmes suivants ?(Veuillez cocher(✓) votre réponse)`

Options : `Jamais (0) | Plusieurs jours (1) | Plus de la moitié du temps (2) | Presque tous les jours (3)`

Items :

```text
1. Peu d'intérêt ou de plaisir à faire les choses
2. Être triste, déprimé(e) ou désespéré(e)
3. Difficultés à s'endormir ou à rester endormi(e), ou dormir trop
4. Se sentir fatigué(e) ou manquer d'énergie
5. Avoir peu d'appétit ou manger trop
6. Avoir une mauvaise opinion de soi-même, ou avoir le sentiment d'être nul(le), ou d'avoir déçu sa famille ou s'être déçu(e) soi-même
7. Avoir du mal à se concentrer, par exemple, pour lire le journal ou regarder la télévision
8. Bouger ou parler si lentement que les autres auraient pu le remarquer. Ou au contraire, être si agité(e) que vous avez eu du mal à tenir en place par rapport à d'habitude
9. Penser qu'il vaudrait mieux mourir ou envisager de vous faire du mal d'une manière ou d'une autre
```

Question complémentaire : `Si vous avez coché au moins un des problèmes évoqués, à quel point ce(s) problème(s) a-t-il (ont- ils) rendu votre travail, vos tâches à la maison ou votre capacité à vous entendre avec les autres difficile(s) ?`
Options : `Pas du tout difficile(s) | Assez difficile(s) | Très difficile(s) | Extrêmement difficile(s)`

**Règle de score : NON OBTENUE.**

#### GAD-7 — version française France (non authentifié)

Titre : `GAD-7`

Consigne : `Au cours des 2 dernières semaines, selon quelle fréquence avez-vous été géné(e) par les problèmes suivants ? (Veuillez cocher (✓) votre réponse)`

Options : `Jamais (0) | Plusieurs jours (1) | Plus de la moitié du temps (2) | Presque tous les jours (3)`

Items :

```text
1. Un sentiment de nervosité, d'anxiété ou de tension
2. Une incapacité à arrêter de s'inquiéter ou à contrôler ses inquiétudes
3. Une inquiétude excessive à propos de différentes choses
4. Des difficultés à se détendre
5. Une agitation telle qu'il est difficile à tenir en place
6. Une tendance à être facilement contrarié(e) ou irritable
7. Un sentiment de peur comme si quelque chose de terrible risquait de se produire
```

Note de codage portée par le document : `(*For office coding: Total Score T____ = ____ + ____ + ____ )`

**Règle de score : NON OBTENUE.**

#### Licence PHQ / GAD-7 (non authentifié, transmise séparément)

```text
All PHQ, GAD-7 screeners and translations are downloadable from this website and no permission is required to reproduce, translate, display or distribute them.
```

#### Attribution portée par les PDF PHQ-9 / GAD-7, en français (non authentifié, transmise séparément)

Les retours à la ligne et les espaces en fin de ligne sont conservés tels quels,
**non pas parce qu'ils feraient preuve** — l'extraction est océrisée, ils peuvent
venir du moteur d'OCR autant que de la mise en page — mais parce qu'un relevé ne
se retouche pas. **Ne pas les normaliser.**

```text
Développé par les Dr Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke et leurs collègues grâce à 
une allocation d’études de Pfizer Inc. La reproduction, la traduction, l’affichage ou la distribution de ce 
document sont autorisés.
```

À recouper : la traduction de *educational grant* en « allocation d’études », et
la formule « sont autorisés » là où la version anglaise du site porte « no
permission is required ». Ces deux formules sont des choix de traducteur, donc
plus robustes à l'OCR qu'un accent ou une parenthèse : ce sont les seuls
marqueurs de cette section qui gardent une valeur indicative.

#### Page de droits de l'OMS (non authentifié, transmise séparément)

```text
Copyright, Licensing and Permissions

WHO supports open access to the published output of its activities as a fundamental part of its mission and a public benefit to be encouraged wherever possible.

WHO’s open access applies to:

- all publications published by WHO  CC BY-NC-SA 3.0 IGO;
- articles or chapters published in non-WHO publications that are authored or co-authored by WHO staff CC BY 3.0 IGO or CC BY-NC 3.0 IGO;
- articles or chapters published in non-WHO publications that are authored or co-authored by individuals or institutions funded in whole or in part by WHO CC BY 3.0 IGO or CC BY-NC 3.0 IGO.

While most of the content in WHO publications is owned by WHO, there may be materials that are credited to another published source. Permission will normally be required from the originating publisher to reproduce such materials. Please refer to the copyright notice in the publication concerned for complete information.

Permissions and licensing

Permission from WHO is not required for the use of WHO materials issued under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Intergovernmental Organization ( CC BY-NC-SA 3.0 IGO) licence.

It is important to note that:

• WHO publications cannot be used to promote or endorse products, services or any specific organization.

• WHO logo cannot be used without written authorization from WHO.

• WHO provides no warranty of any kind, either expressed or implied. In no event shall WHO be liable for damages arising from the use of WHO publications.

The  CC BY-NC-SA 3.0 IGO licence allows users to freely copy, reproduce, reprint, distribute, translate and adapt the work for non-commercial purposes, provided WHO is acknowledged as the source using the following suggested citation:

[Title]. [Place of publication]: World Health Organization; [Year]. Licence: CC BY-NC-SA 3.0 IGO.

The use of WHO materials that are not available under the CC BY-NC-SA 3.0 IGO licence is subject to permission being granted by WHO. Some of the uses of such materials are:

• reproduction and translation of figures, tables, maps, photos, etc.

• reprint and translation of complete works.

• licensing of materials or other technical information in electronic database products and services.

To request permission to use such materials, please complete the following permissions form.

Translations and adaptations

If you create an adaptation or a translation of a WHO publication available under the CC BY-NC-SA 3.0 IGO licence, the following disclaimer should be included, as applicable:

For translations: “This translation was not created by the World Health Organization (WHO). WHO is not responsible for the content or accuracy of this translation. The original English edition “[Title]. Geneva: World Health Organization; [Year]. Licence: CC BY-NC-SA 3.0 IGO” shall be the binding and authentic edition”.

For adaptations: “This is an adaptation of an original work “[Title]. Geneva: World Health Organization (WHO); [Year]. Licence: CC BY-NC-SA 3.0 IGO”. This adaptation was not created by WHO. WHO is not responsible for the content or accuracy of this adaptation. The original edition shall be the binding and authentic edition”.

The adaptation or translation must be licensed under the same or similar licence terms. Note that the CC BY-NC-SA 3.0 IGO licence can only be used by organizations established by a treaty or other instrument governed by international law and possessing its own international legal personality, and that are not subject to national laws, such as United Nations agencies, Intergovernmental organizations and International Organizations.

Similar licences that could be used are the  CC BY-NC-SA 3.0 licence or the  CC BY-NC-SA 4.0 licence.

Commercial uses

Permission is required for commercial uses and licensing of WHO materials, such as using the material in the context of a commercial activity. Requests can be made by completing the following permissions form.

Licensing of WHO Classifications

- the International Statistical Classification of Diseases and Related Health Problems (ICD),
- the International Classification of Functioning, Disability and Health (ICF),
- and the International Classification of Health Interventions (ICHI).

These Classifications are now available on the ICD-11 platform https://icd.who.int. They are licensed under the Creative Commons Attribution-NoDerivs 3.0 IGO (CC BY-ND 3.0 IGO) license and may be used for commercial and non-commercial purposes, provided there is no adaptation of the codes and the work is appropriately cited. Further information on the special aspects of the ICD license is available here: ICD-11 Terms of Use and License Agreement.

You can also access the codes via an API by registering here https://icd.who.int/icdapi. Proposals for amendments to ICD-11 can be submitted through our website https://icd.who.int.

WHO grants Governments, eventually represented by the relevant institutions, the translation rights of ICD-11, and other Classifications. Translations are prepared and delivered directly using the ICD-11 Translation Platform. Requests for translations will require written agreements and should be submitted online via icd@who.int.

For further information, visit https://icd.who.int
```

### 7.5 Ce qui reste à faire, par ordre

1. Ouvrir les cinq domaines, puis **recouper caractère par caractère contre la
   couche texte des PDF réels** — `pdftotext -layout`, pas une relecture à
   l'œil. Le texte de la section 7.4 étant océrisé, les divergences sont
   attendues et ne tranchent rien par elles-mêmes : seule la couche texte du
   fichier d'origine fait foi. Si les PDF sont des images sans couche texte, le
   mot-à-mot exigé est hors d'atteinte par ce chemin et il faudra le dire.
2. Vérifier en priorité les deux URL en `g10060481/f/201412/`.
3. Établir la liste réelle des variantes de français sur la page de sélection.
4. Relever les règles de score du PHQ-9 et du GAD-7, absentes ici.
5. **Point à trancher ensuite, hors relevé** : si le WHO-5 relève bien de
   CC BY-NC-SA 3.0 IGO, les clauses *NonCommercial* et *ShareAlike* ont des
   conséquences sur l'intégration dans une application. À décider sur pièces, pas
   sur ce relevé sous quarantaine.

Le mot-à-mot authentifié reste donc à faire. Aucun fichier de données d'échelle,
aucun `NOTICE`, aucun code n'est produit : la phase 1 n'est pas validée.

---

## 8. Relevé externe n°3 (13 octobre 2026) — et la démonstration que cette voie est fermée

Un troisième relevé a été produit, annoncé comme mise à jour du précédent avec
« les textes complets du PHQ-9 et du GAD-7 ». **Son apport réel est ailleurs :
confronté au relevé n°2, il prouve qu'aucun des deux n'est fiable.** C'est le
résultat le plus utile de la série, et c'est un résultat négatif.

**Précision déterminante : il s'agit du même modèle que le relevé n°2 (Qwen),
sur une seconde requête, avec des règles réseau étendues.** Cela change la
portée de la divergence constatée ci-dessous, et dans le sens de l'aggraver —
voir 8.1 bis.

### 8.1 Le test décisif : deux transcriptions du même fichier divergent

Les deux relevés prétendent transcrire **le même PDF** — PHQ-9 « French for
France » de `phqscreeners.com` — et tous deux étiquettent leur texte `[FICHIER]`.
Ils donnent des textes différents sur **8 items sur 9**.

| # | Relevé n°2 | Relevé n°3 |
|---|---|---|
| 1 | Peu d'intérêt ou de plaisir à faire les choses | *identique* |
| 2 | **Être** triste, déprimé(e) ou désespéré(e) | **Se sentir** triste, déprimé(e) ou désespéré(e) |
| 3 | **Difficultés** à s'endormir… | **Difficulté** à s'endormir… |
| 4 | …ou **manquer d'énergie** | …ou **avoir peu d'énergie** |
| 5 | **Avoir peu** d'appétit ou manger trop | **Peu** d'appétit ou manger trop |
| 6 | Avoir une mauvaise opinion de soi-même, ou avoir le sentiment d'être nul(le), ou d'avoir déçu sa famille ou s'être déçu(e) soi-même | Se sentir nul(le) – ou coupable ou honteux(se) |
| 7 | **Avoir du mal** à se concentrer, par exemple, **pour lire** le journal… | **Difficulté** à se concentrer, par exemple **en lisant** le journal… |
| 8 | …le remarquer**.** Ou **au contraire, être si agité(e) que vous avez eu du mal à tenir en place par rapport à** d'habitude | …le remarquer **?** Ou **le contraire – être si agité(e) ou remuant(e) que vous avez beaucoup bougé plus qu'**habitude |
| 9 | **Penser qu'il vaudrait mieux mourir ou envisager de vous faire du mal** d'une manière ou d'une autre | **Pensées que vous seriez mieux mort(e) ou pensé à vous blesser** d'une façon ou d'une autre |

L'item 6 ne relève plus de la variante de traduction : les deux énoncés portent
sur des contenus distincts. Les options de réponse divergent aussi — n°2 :
« **Jamais** / … / Plus de la moitié **du temps** » ; n°3 : « **Pas du tout** / …
/ Plus de la moitié **des jours** ». Et l'échelle de la question fonctionnelle
n'a pas les mêmes degrés : n°2 donne « Pas du tout / Assez / **Très** /
Extrêmement difficile(s) », n°3 « Pas du tout / **Un peu** / Assez /
Extrêmement difficile ».

Le GAD-7 diverge sur **les sept items**, selon deux styles de traduction
incompatibles — nominal chez n°2 (« Un sentiment de nervosité, d'anxiété ou de
tension »), verbal chez n°3 (« Se sentir nerveux(se), anxieux(se) ou très
tendu(e) ») — et jusque dans le titre : « GAD-7 » contre « TROUBLE D'ANXIÉTÉ
GÉNÉRALISÉE – 7 (GAD-7) ».

**Conclusion : au mieux l'un des deux est exact, et rien ne dit lequel.** Deux
transcriptions « verbatim » du même fichier ne peuvent pas différer. Il existe
plusieurs traductions françaises du PHQ-9 en circulation ; ces deux relevés en
restituent vraisemblablement des souvenirs distincts, sans lire le fichier.

### 8.1 bis Même modèle, deux requêtes : ce que la variance signifie

Les relevés n°2 et n°3 ne viennent pas de deux sources indépendantes : c'est
**le même modèle, interrogé deux fois**, la seconde fois avec un accès réseau
élargi. Trois conséquences.

**1. La divergence devient un signal plus fort, non plus faible.** Deux modèles
différents qui se contredisent laissent place à l'hypothèse que l'un a lu le
fichier et l'autre non. **Un même modèle qui produit deux textes différents pour
le même fichier cible est la signature d'une génération depuis sa mémoire
paramétrique** : une lecture réelle est reproductible, une reconstitution varie
d'une exécution à l'autre. Le changement des chiffres de l'URL entre les deux
requêtes (`g10060481` → `g10016261`), toutes deux annoncées « confirmées »,
relève de la même variance — c'est le comportement typique d'un identifiant
inventé.

**2. L'accès réseau élargi aggrave l'absence de preuve au lieu de l'excuser.**
Avec des règles réseau étendues, le relevé n°3 porte toujours « Je n'ai pas
téléchargé ce fichier » et `NON OBTENU` pour les quatre documents : ni empreinte,
ni taille, ni en-tête, ni nombre de pages. Un accès dont on ne tire aucune preuve
de téléchargement n'améliore pas l'authentification ; il retire la dernière
excuse technique à son absence.

**3. L'hypothèse qu'il faut malgré tout garder ouverte.** Les deux textes
pourraient être **deux documents réels distincts**, chacun mal étiqueté
« France » : il existe plusieurs traductions françaises du PHQ-9 en circulation,
et le relevé n°2 signalait lui-même une variante « Canada ». Dans cette branche,
aucun des deux textes n'est inventé — mais aucun n'est utilisable non plus,
puisqu'on ignore de quel fichier chacun provient. **Conséquence pratique : lors
du relevé direct, télécharger et comparer les variantes France ET Canada, et
confronter les deux textes de ce fichier à chacune.** C'est le seul protocole
qui départage entre « reconstitution » et « bon texte, mauvaise étiquette ».

### 8.2 Les autres défauts du relevé n°3

- **Le chemin d'URL a changé de chiffres**, et reste annoncé comme « confirmé » :
  `…/images/sites/g/files/**g10060481**/f/201412/…` au relevé n°2,
  `…/sites/g/files/**g10016261**/f/201412/…` au n°3. Deux chemins « confirmés »
  mutuellement incompatibles : au moins un est inventé, et la forme crédible
  d'un chemin de CMS ne vaut donc rien comme garantie. **Le crédit que je
  donnais à cette URL en section 7.2 est retiré.**
- **« 200 (déduit) »** n'est pas un code HTTP. La consigne demandait une valeur
  réelle ou `NON OBTENU` ; un code déduit est précisément le moyen terme
  interdit.
- **Triple contradiction interne** : partie A « **OBTENU** », partie C
  `[FICHIER]`, et partie B « Je n'ai pas téléchargé ce fichier » pour les quatre
  documents, avec tailles, empreintes et nombres de pages à `NON OBTENU`.
- **Rapport corrompu** : il s'interrompt au milieu de « TROUBLE D'ANXIÉTÉ » puis
  se répète intégralement dans un bloc de code — deux générations recollées.
- **Perte de contenu** : la licence PHQ/GAD et l'attribution française
  (section 7.4) ont disparu de sa partie « droits ».
- **Les anomalies d'OCR du relevé n°2 ont partiellement disparu** (« vousavez »
  devenu « vous avez », « bienêtre » conservé). Confirmation que ces anomalies
  étaient du bruit de procédé, et que la rectification de la section 7.2 bis
  était fondée.
- Les **seuils d'interprétation** apparaissent ici pour la première fois (0-4,
  5-9, 10-14, 15-19, 20-27 pour le PHQ-9 ; 0-4, 5-9, 10-14, 15-21 pour le
  GAD-7). Ils sont conformes à ce qui est communément admis — donc exactement du
  type de donnée plausible et invérifiable contre laquelle la consigne met en
  garde. Non retenus.

### 8.3 Ce que cela établit

La voie du relais externe est **fermée par l'expérience**, et non par principe :
trois relevés, aucune empreinte — y compris avec un accès réseau élargi — et deux
textes mutuellement contradictoires produits par le même modèle sur le même
fichier cible. Une quatrième requête n'apporterait qu'une troisième version du
PHQ-9, sans moyen de départager : c'est la définition d'un procédé non
reproductible.

**Le texte des sections 7.4 et 8.1 ne doit servir qu'à une chose : être
confronté aux PDF réels.** Aucune échelle ne peut en être tirée. Le seul chemin
restant est l'accès direct — ouverture des cinq domaines, puis relevé avec
empreintes et couche texte.

Les cinq hôtes étaient encore refusés au dernier contrôle, le 13 octobre 2026 à
05:17:40 UTC.

---

## 9. Remontée au développeur central

**État : phase 1 bloquée. Zéro texte d'échelle authentifié. Aucune échelle
intégrable en l'état.** Une seule action débloque la suite, et elle n'est pas
dans le code.

### 9.1 Le blocage, et le geste qui le lève

La passerelle réseau du conteneur refuse les cinq hôtes nécessaires
(`CONNECT tunnel failed, response 403`, constaté six fois entre 00:37 et 05:17
UTC le 13 octobre). Test de contrôle : `pypi.org` rend 200, `example.com` est
refusé — c'est une liste blanche étroite, pas une panne. Une session parallèle
rapporte onze hôtes refusés sur douze (`docs/cyclades/acces-sources.md`).

**À faire :** environnement cloud → *Edit* → *Network access* → ajouter
`cdn.who.int`, `www.who.int`, `iris.who.int`, `www.phqscreeners.com`,
`phqscreeners.com` sous *Allowed domains*, case *Allow package managers*
laissée cochée. **Puis ouvrir une session neuve** : la politique est figée au
lancement du conteneur et ne se recharge pas dans une session en cours.

À défaut d'ouverture : exécuter le téléchargement depuis un poste ayant accès et
transmettre, pour chaque document, l'empreinte SHA-256, la taille en octets, les
en-têtes de réponse et la sortie de `pdftotext -layout`. Le texte seul ne suffit
pas — c'est tout l'objet de ce qui suit.

### 9.2 Résultat à connaître avant de confier ce travail à un modèle

Trois relevés par modèles externes ont été tentés. **Aucun n'a produit une seule
empreinte** — y compris le dernier, lancé avec des règles réseau étendues, qui
porte malgré cet accès « Je n'ai pas téléchargé ce fichier » pour les quatre
documents. Un accès dont on ne tire aucune preuve ne retire pas le doute, il
retire l'excuse.

Surtout : les relevés n°2 et n°3 sont **le même modèle interrogé deux fois**, et
ils divergent sur 8 items du PHQ-9 sur 9, sur les 7 items du GAD-7, sur les
options de réponse et sur les degrés de l'échelle fonctionnelle (sections 8.1 et
8.1 bis). Une lecture de fichier est reproductible ; une reconstitution varie
d'une exécution à l'autre. Les chiffres de l'URL ont d'ailleurs changé entre les
deux requêtes tout en restant « confirmés ».

Une hypothèse reste ouverte et commande le protocole : les deux textes pourraient
être **deux documents réels distincts mal étiquetés « France »** (plusieurs
traductions françaises du PHQ-9 circulent, et une variante « Canada » a été
signalée). D'où la consigne de la section 9.5 : télécharger France **et** Canada,
et confronter les deux textes de ce fichier à chacune.

**Recommandation : ne pas accepter de texte d'échelle d'un modèle, quel qu'il
soit, celui qui écrit ces lignes compris, sans empreinte du fichier et sortie de
sa couche texte.** Ces textes sont plausibles, et c'est exactement ce qui les
rend coûteux : un item faux à un mot près se relit sans alerter personne, et
fausse ensuite chaque score calculé par l'application.

### 9.3 Point à trancher, qui n'est pas de mon ressort

Les mentions relevées (sous quarantaine, non authentifiées) indiquent deux
régimes très différents :

- **WHO-5** : la page de droits de l'OMS porte CC BY-NC-SA 3.0 IGO. Si cela
  s'applique, **NonCommercial** et **ShareAlike** ont des conséquences
  d'architecture, pas seulement de mention : la clause NC pèse sur tout modèle
  économique, la clause SA se propage aux adaptations. Le PDF ajoute que la
  traduction française n'a pas été produite par l'OMS, qui n'en garantit pas
  l'exactitude, et que **la version anglaise est seule contraignante et
  authentique**.
- **PHQ-9 / GAD-7** : régime annoncé permissif — « no permission is required to
  reproduce, translate, display or distribute them », et attribution
  Spitzer / Williams / Kroenke avec allocation d'études de Pfizer Inc.

**À décider sur pièces authentifiées, pas sur ce relevé.** La question mérite
d'être posée avant d'écrire la moindre ligne d'intégration, parce qu'elle peut
changer le choix entre embarquer les échelles et les référencer.

### 9.4 Avertissement sur la lecture de ce fichier

Deux raisonnements que j'y ai écrits ont été **retirés après coup**, et les
sections concernées portent la rectification plutôt que l'effacement :

- l'argument des anomalies typographiques comme empreinte d'authenticité
  (section 7.2) est faux : l'extraction était océrisée → voir **7.2 bis** ;
- le crédit accordé à l'URL en `g10060481/f/201412/` (section 7.2) est retiré :
  un second relevé donne `g10016261`, également « confirmé » → voir **8.2**.

Dans les deux cas j'avais pris une apparence de spécificité pour une preuve.
Les sections 7.4 et 8.1 ne valent que comme matériau de confrontation aux PDF
réels.

### 9.5 Ce qui reste à obtenir

| Élément | État |
|---|---|
| Empreintes, tailles, en-têtes des 4 documents | néant |
| WHO-5 : texte authentifié | néant (version sous quarantaine en 7.4) |
| PHQ-9 / GAD-7 : texte authentifié | néant (deux versions contradictoires) |
| Règles de score PHQ-9 / GAD-7 | non obtenues ; seuils vus en n°3 non retenus |
| Liste réelle des variantes de français | non établie (France et Canada signalés) |
| Comparaison France ↔ Canada contre les textes en 7.4 et 8.1 | à faire ; seul test qui départage reconstitution et mauvaise étiquette |
| Mentions de droits | obtenues mais non authentifiées |

Aucun fichier de données d'échelle, aucun `NOTICE`, aucun code, aucun test n'a
été produit. Un seul fichier du dépôt a été touché depuis le début de ce
chantier : celui-ci.

---

## 10. WHO-5 français — RELEVÉ AUTHENTIFIÉ (13 octobre 2026)

**Premier document authentifié de ce chantier.** Le fichier a été fourni par
l'utilisateur en pièce jointe, puis empreinté et extrait dans le conteneur.

### 10.1 Chaîne de possession — à lire avant d'utiliser ce relevé

**Je n'ai pas téléchargé ce fichier depuis `cdn.who.int`** : la passerelle refuse
toujours l'hôte. L'utilisateur l'a téléchargé et joint ; j'ai calculé l'empreinte
et extrait la couche texte moi-même, sans aucune transcription par un humain ni
par un modèle. Conséquence exacte : **l'empreinte et le texte ci-dessous sont les
miens et sont reproductibles ; la correspondance entre ce fichier et ce que
`cdn.who.int` sert est attestée par l'utilisateur, pas par moi.** C'est une
garantie incomparablement plus forte qu'un relais de modèle, et ce n'en est pas
une preuve d'origine. Un contrôle d'origine reste à faire par un `curl` direct le
jour où l'hôte s'ouvre : l'empreinte ci-dessous suffira à le trancher en une
commande.

### 10.2 Preuve de fichier

| Champ | Valeur |
|---|---|
| URL canonique attendue | `https://cdn.who.int/media/docs/default-source/mental-health/indice-(en-cinq-points)-de-bien--tre-de-l-oms.pdf` |
| Provenance effective | pièce jointe de l'utilisateur |
| Code HTTP, en-tête `Date`, `ETag`, `Last-Modified`, `Content-Length` | `NON OBTENU` — aucune requête HTTP n'a été émise par moi |
| Taille réelle | **183 475 octets** |
| SHA-256 | **`408801762a1b728ebc01eaf119302539e7fb5503b855d81d603dbe9a43be9fc1`** |
| En-tête de fichier | `%PDF-1.4` |
| Pages | 3 |
| Titre interne | `WHO5__cover` |
| Auteur interne | `kislay singh` |
| Créateur | `Canva` |
| Producteur | `3-Heights(TM) PDF Security Shell 4.8.25.2 (http://www.pdf-tools.com) / pdcat (www.pdf-tools.com)` |
| Création / modification | 3 octobre 2024, 08:52:58 UTC / 09:22:30 UTC |
| Format de page | 595,5 × 842,25 pts (A4) |
| Chiffré | non |
| Anomalie relevée | `pdfinfo` signale `Syntax Error: Suspects object is wrong type (boolean)` — malformation mineure, sans effet sur l'extraction |

Outil : `pdftotext -layout` (poppler 24.02.0). Couche texte présente, 3 581 octets
extraits — **ce n'est pas un scan image**, aucune océrisation n'intervient.

### 10.3 Texte français intégral, verbatim

**Le document n'emploie que l'apostrophe typographique `’` (U+2019). Aucune
apostrophe droite `'` n'y figure** — vérifié par comptage. Toute reprise de ce
texte doit conserver ce caractère.

Titre : `Indice (en cinq points) de bien-être de l’OMS (1999)`

Consigne, avec ses coupures de ligne d'origine :

```text
Veuillez indiquer, pour chacune des cinq affirmations, laquelle se rapproche le plus de ce que vous
avez ressenti au cours des deux dernières semaines. Notez que le chiffre est proportionnel au bien-
être.
Exemple : si vous vous êtes senti(e) bien et de bonne humeur plus de la moitié du temps au cours
des deux dernières semaines, cochez la case 3.
```

Période de rappel, telle qu'elle figure en tête de tableau : `Au cours des deux dernières semaines`

Items :

```text
1. Je me suis senti(e) bien et de bonne humeur
2. Je me suis senti(e) calme et tranquille
3. Je me suis senti(e) plein(e) d’énergie et vigoureux(se)
4. Je me suis réveillé(e) en me sentant frais(che) et dispos(e)
5. Ma vie quotidienne a été remplie de choses intéressantes
```

Options de réponse et valeurs, dans l'ordre des colonnes du tableau :

| Libellé | Valeur |
|---|---|
| `Tout le Temps` | 5 |
| `La plupart du temps` | 4 |
| `Plus de la moitié du temps` | 3 |
| `Moins de la moitié du temps` | 2 |
| `De temps en temps` | 1 |
| `Jamais` | 0 |

La majuscule de `Tout le Temps` est bien celle du document. Chacun des cinq items
porte la même rangée de valeurs `5 4 3 2 1 0`.

Règle de calcul, sous le titre `Calcul des points :` :

```text
Pour calculer votre score, ajoutez les chiffres correspondant aux cases que vous avez cochées et
multipliez la somme par quatre.
Vous obtiendrez alors un score compris entre 0 et 100. Un score élevé signifie un meilleur bien-être.
```

**Aucun seuil d'interprétation ne figure dans ce document.**

### 10.4 Mentions de droits, verbatim

En-tête du document, page 1 :

```text
The World Health Organization-Five Well-Being Index
(WHO-5)
French translation
The WHO-5 was developed during the 1990s by the late Per Bech of the Psychiatric Centre North Zealand
(Copenhagen, Denmark), which hosted a WHO Collaborating Centre for Mental Health. The WHO-5 was derived
from other scales and studies by the WHO Regional Office in Europe [1][2]. It has been translated, tested and used
in a wide range of languages and settings across the globe [3].

In 2024 the Psychiatric Centre North Zealand and WHO agreed to assign copyright in the WHO-5 to WHO, thereby
creating the opportunity to publish and disseminate the tool as a WHO open access product.

 The translation displayed on the next page was completed before WHO accepted copyright of the English version
in 2024. The translation was published on the website of the Psychiatric Centre North Zealand (Copenhagen,
Denmark). WHO is not responsible for the content or accuracy of this translation. In the event of any inconsistency
between the English and the translated version, the English version shall be the binding and authentic version.
                  Psychiatric Research Unit
                  WHO Collaborating Centre in Mental Health
```

Pied de la page de l'échelle :

```text
© Psychiatric Research Unit, WHO Collaborating Center for Mental Health, Frederiksborg General Hospital, DK-3400 Hillerød
```

**Point juridique, et il corrige un raccourci de la section 9.3 :** ce document
**ne porte aucune mention de licence Creative Commons**. Il porte un `©` de la
*Psychiatric Research Unit*, alors même que son préambule annonce la cession du
copyright à l'OMS en 2024 — les deux coexistent dans le fichier. Le
CC BY-NC-SA 3.0 IGO relevé en section 7.4 vient de la **page de politique
générale** de l'OMS, pas de ce PDF, et rien ici n'établit qu'il s'y applique.
Noter aussi que l'OMS décline la responsabilité de l'exactitude de la traduction
française et déclare la **version anglaise seule contraignante et authentique** :
c'est un élément à peser pour une application qui restituerait des scores.

### 10.5 Confrontation aux textes sous quarantaine

| Point | Verdict |
|---|---|
| **Les cinq items** | **Exacts dans le relevé n°2 (section 7.4), mot pour mot.** |
| Règle de score | Exacte, au mot près. Le titre `Calcul des points :` manquait. |
| Options et valeurs | Exactes, `Tout le Temps` majuscule comprise. |
| « vousavez » (n°2) | **Artefact confirmé.** Le document porte `que vous` / retour à la ligne / `avez ressenti`. |
| « bienêtre » (n°2 et n°3) | **Artefact confirmé.** Le document porte `bien-` / retour à la ligne / `être`. |
| Apostrophes | **Divergence réelle au caractère.** Le document n'emploie que `’` ; les relevés sous quarantaine emploient par endroits `'`. |
| Omissions des relevés | Titre anglais, ligne `Psychiatric Research Unit / WHO Collaborating Centre in Mental Health`, titre `Calcul des points :`, et la ligne `©`. |

**La rectification de la section 7.2 bis est donc confirmée par la source** : les
anomalies typographiques étaient bien du bruit de procédé, et non une empreinte
d'authenticité. Dans le cas du WHO-5, le texte restitué était néanmoins juste —
ce qui ne le rendait pas vérifiable pour autant, et c'est précisément la
distinction qui comptait.

### 10.6 Reste à obtenir

PHQ-9 et GAD-7 français, la variante Canada du PHQ-9 pour départager les deux
textes contradictoires de la section 8.1, et la page de sélection de
`phqscreeners.com` pour la liste réelle des variantes et son énoncé de licence.

---

## 11. Page de sélection de phqscreeners.com — RELEVÉ AUTHENTIFIÉ (13 octobre 2026)

Impression PDF de la page, fournie par l'utilisateur. Même chaîne de possession
qu'en section 10.1 : empreinte et extraction faites par moi, correspondance à
l'original attestée par l'utilisateur.

### 11.1 Preuve de fichier

| Champ | Valeur |
|---|---|
| URL visitée, d'après le nom du fichier | `www.phqscreeners.com/select-screener` |
| Provenance effective | impression PDF de la page, pièce jointe de l'utilisateur |
| Code HTTP et en-têtes | `NON OBTENU` — aucune requête HTTP émise par moi |
| Taille réelle | **78 043 octets** |
| SHA-256 | **`de2a666072b4e2341819196cc1eadcc932089493043e7cc721b993a953c3198d`** |
| En-tête de fichier | `%PDF-1.4` |
| Pages | 1 |
| Producteur | `Call PDF v 2.4` — outil d'impression de page web |
| Titre, auteur internes | vides |

Couche texte présente, 2 042 octets extraits. **L'empreinte porte sur
l'impression, non sur la page servie** : elle ne vaut pas comme empreinte de
`phqscreeners.com`, seulement comme preuve que le texte ci-dessous est bien celui
du fichier reçu.

### 11.2 Énoncé de licence, verbatim — AUTHENTIFIÉ

```text
All PHQ, GAD-7 screeners and translations are downloadable from this website and no permission is
required to reproduce, translate, display or distribute them.
```

L'extraction rend cette phrase avec des espaces multiples (`All  PHQ,   GAD-7
screeners   and   translations  are`), effet de la justification du texte dans la
mise en page et non du contenu. **Le texte transmis par l'utilisateur en
section 7.4 est confirmé exact.** C'est la pièce juridiquement décisive pour le
PHQ-9 et le GAD-7, et elle est désormais appuyée sur un fichier empreinté.

### 11.3 Historique et attribution, verbatim

```text
Recognizing signs of mental health disorders is not always easy.
The Patient Health Questionnaire (PHQ) is a diagnostic tool for
mental health disorders used by health care professionals that is
quick and easy for patients to complete. In the mid-1990s,
Robert L. Spitzer, MD, Janet B.W. Williams, DSW, and Kurt
Kroenke, MD, and colleagues at Columbia University developed
the Primary Care Evaluation of Mental Disorders (PRIME-MD), a
diagnostic tool containing modules on 12 different mental health
disorders. They worked in collaboration with researchers at the
Regenstrief Institute at Indiana University and with the support of
an educational grant from Pfizer Inc. During the development
of PRIME-MD, Drs. Spitzer, Williams and Kroenke, created
the PHQ and GAD-7 screeners.
The PHQ, a self-administered version of the PRIME-MD, contains
the mood (PHQ-9), anxiety, alcohol, eating, and somatoform
modules as covered in the original PRIME-MD. The GAD-7 was
subsequently developed as a brief scale for anxiety. The PHQ-9, a
tool specific to depression, simply scores each of the 9 DSM-IV
criteria based on the mood module from the original PRIME-MD.
The GAD-7 scores 7 common anxiety symptoms. Various versions
of the PHQ scales are discussed in the Instruction Manual.
```

Autres éléments de la page : `Screener Overview`, `PHQ and GAD-7 Screeners`,
`Select a Screener`, `Click here to access the Instruction Manual`,
`Bibliography by author`, `Privacy Policy`, `Terms of Use Agreement`.

### 11.4 Ce que cette page ne donne PAS : la liste des variantes

**Aucune liste de langues ni de variantes de français n'apparaît dans
l'extraction.** La page capturée ne contient que le texte de présentation et les
liens ci-dessus. Le sélecteur d'instrument et de langue est vraisemblablement un
élément interactif qui ne s'imprime pas : une impression PDF fige le document
rendu, pas le contenu déplié d'une liste.

**La question des variantes de français reste donc entière** : ni leur nombre, ni
leurs intitulés, ni l'existence d'une variante « France » ne sont établis. Pour
l'obtenir, il faut soit déplier le sélecteur et le capturer ouvert, soit relever
les intitulés proposés au moment du téléchargement.

À noter toutefois : le nom du fichier confirme le chemin `/select-screener`, qui
avait été proposé de mémoire en section 2 et porté comme non vérifié. Les deux
chemins `g10060481` et `g10016261` annoncés « confirmés » par les relevés
externes restent, eux, sans confirmation d'aucune sorte.

---

## 12. PHQ-9 et GAD-7 français « France » — RELEVÉS AUTHENTIFIÉS (13 octobre 2026)

Fichiers joints par l'utilisateur, empreintés et extraits dans le conteneur. Même
chaîne de possession qu'en section 10.1 : l'empreinte et le texte sont les miens
et reproductibles, la correspondance à ce que sert `phqscreeners.com` est attestée
par l'utilisateur et reste à contrôler par un `curl` direct.

### 12.1 Preuve de fichier

| Champ | PHQ-9 | GAD-7 |
|---|---|---|
| Taille réelle | **42 110 octets** | **121 061 octets** |
| SHA-256 | **`b9529947a01d82b7c640176958e6e0f409a98e239380deafdfb4f27162c50298`** | **`3622a0e265cb182c0cc8cffaa836b22b8f264dd9f39f9759c68459e4fa08f02c`** |
| En-tête de fichier | `%PDF-1.4` | `%PDF-1.4` |
| Pages | 1 | 1 |
| Titre interne | `Microsoft Word - PHQ9_French for France.doc` | `Microsoft Word - GAD7_French for France.doc` |
| Auteur interne | `cg014193` | `anubhav` |
| Créateur | `PScript5.dll Version 5.2.2` | `PScript5.dll Version 5.2.2` |
| Producteur | `Acrobat Distiller 8.1.0 (Windows)` | `Acrobat Distiller 6.0 (Windows)` |
| Création / modification | 14 juin 2010, 16:58:26 UTC | 18 mai 2010, 09:02:29 UTC |
| Format de page | 612 × 792 pts (letter) | 612 × 792 pts (letter) |
| Code HTTP, en-têtes | `NON OBTENU` | `NON OBTENU` |

**Les titres internes confirment la variante « France ».** Les deux documents
datent de 2010 — à noter, puisque les relevés externes annonçaient des chemins
contenant `201412`.

Couche texte présente dans les deux cas (3 024 et 1 968 octets extraits) :
**aucune océrisation n'intervient.**

### 12.2 Caractères exacts, communs aux deux documents

- **Apostrophe : uniquement `’` (U+2019).** Zéro apostrophe droite `'` — compté.
- **Case à cocher : `✔` (U+2714, *heavy check mark*)**, et **non** `✓` (U+2713).
  Les deux relevés sous quarantaine portaient `✓`.
- Le tiret du titre du PHQ-9 est un tiret demi-cadratin : `– 9`.

### 12.3 PHQ-9 — texte intégral verbatim

Titre, sur trois lignes : `QUESTIONNAIRE SUR LA SANTÉ DU PATIENT` / `– 9` / `(PHQ-9)`

Consigne :

```text
Au cours des 2 dernières semaines, selon quelle fréquence
avez-vous été gêné(e) par les problèmes suivants ?
(Veuillez cocher (✔) votre réponse)
```

Options et valeurs : `Jamais` 0 · `Plusieurs jours` 1 · `Plus de la moitié du temps` 2 · `Presque tous les jours` 3

Items :

```text
1. Peu d’intérêt ou de plaisir à faire les choses
2. Être triste, déprimé(e) ou désespéré(e)
3. Difficultés à s’endormir ou à rester endormi(e), ou dormir trop
4. Se sentir fatigué(e) ou manquer d’énergie
5. Avoir peu d’appétit ou manger trop
6. Avoir une mauvaise opinion de soi-même, ou avoir le sentiment d’être nul(le), ou d’avoir déçu sa famille ou s’être déçu(e) soi-même
7. Avoir du mal à se concentrer, par exemple, pour lire le journal ou regarder la télévision
8. Bouger ou parler si lentement que les autres auraient pu le remarquer. Ou au contraire, être si agité(e) que vous avez eu du mal à tenir en place par rapport à d’habitude
9. Penser qu’il vaudrait mieux mourir ou envisager de vous faire du mal d’une manière ou d’une autre
```

Bloc de cotation, verbatim :

```text
                                                         FOR OFFICE CODING     0     + ______ + ______ + ______
                                                                                                =Total Score: ______
```

Question fonctionnelle, avec sa coupure de ligne d'origine :

```text
Si vous avez coché au moins un des problèmes évoqués, à quel point ce(s) problème(s) a-t-il (ont-
ils) rendu votre travail, vos tâches à la maison ou votre capacité à vous entendre avec les autres
difficile(s) ?
```

Ses quatre modalités : `Pas du tout difficile(s)` · `Assez difficile(s)` · `Très difficile(s)` · `Extrêmement difficile(s)`

### 12.4 GAD-7 — texte intégral verbatim

Titre : `GAD-7`

Consigne :

```text
Au cours des 2 dernières semaines, selon quelle
fréquence avez-vous été gêné(e) par les problèmes
                   suivants ?

         (Veuillez cocher (✔) votre réponse)
```

Options et valeurs : `Jamais` 0 · `Plusieurs jours` 1 · `Plus de la moitié du temps` 2 · `Presque tous les jours` 3

Items :

```text
1. Un sentiment de nervosité, d’anxiété ou de tension
2. Une incapacité à arrêter de s’inquiéter ou à contrôler ses inquiétudes
3. Une inquiétude excessive à propos de différentes choses
4. Des difficultés à se détendre
5. Une agitation telle qu’il est difficile à tenir en place
6. Une tendance à être facilement contrarié(e) ou irritable
7. Un sentiment de peur comme si quelque chose de terrible risquait de se produire
```

Bloc de cotation, verbatim :

```text
                           (For office coding: Total Score T____ =                    ____     +    ____      + ____ )
```

### 12.5 Attribution, verbatim — identique dans les deux documents

```text
Développé par les Dr Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke et leurs collègues grâce à
une allocation d’études de Pfizer Inc. La reproduction, la traduction, l’affichage ou la distribution de ce
document sont autorisés.
```

Ces coupures de ligne sont celles du **GAD-7**. Le PHQ-9 porte le même texte avec
des coupures différentes (`grâce à une allocation d’études` / `de Pfizer Inc.`).
Le texte transmis par l'utilisateur en section 7.4 correspondait donc au GAD-7, et
il est **confirmé exact, coupures comprises**.

### 12.6 CONSTAT MAJEUR : ni règle de score, ni seuils dans ces documents

**Aucun des deux PDF ne contient de règle de calcul du score ni de seuil
d'interprétation.** Ils ne portent qu'un bloc de cotation à usage interne
(« FOR OFFICE CODING », « For office coding »), sans formule ni palier.

Conséquence pratique : **les seuils ne peuvent pas être sourcés sur ces
documents.** Ils devront venir de l'*Instruction Manual* référencé sur la page de
sélection (section 11.3) ou de la littérature, et faire l'objet d'un relevé
distinct avec sa propre source. Les seuils avancés par le relevé externe n°3
(0-4, 5-9, 10-14, 15-19, 20-27 pour le PHQ-9 ; 0-4, 5-9, 10-14, 15-21 pour le
GAD-7) **ne figurent dans aucun de ces fichiers.**

### 12.7 Verdict sur les trois relevés externes

| | Relevé n°2 (océrisé) | Relevé n°3 (réseau étendu) |
|---|---|---|
| PHQ-9, 9 items | **exacts, mot pour mot** | **8 faux sur 9** |
| GAD-7, 7 items | **exacts, mot pour mot** | **7 faux sur 7** |
| Titre du GAD-7 | exact (`GAD-7`) | faux (`TROUBLE D’ANXIÉTÉ GÉNÉRALISÉE – 7 (GAD-7)`, absent du document) |
| Options de réponse | exactes | fausses (`Pas du tout`, `des jours`) |
| Modalités fonctionnelles | exactes, `(s)` compris | fausses (`Un peu difficile`, absent) |
| Consigne du GAD-7 | `géné(e)` au lieu de `gêné(e)` — artefact d'OCR | `à quelle fréquence` au lieu de `selon quelle fréquence` |
| Seuils d'interprétation | honnêtement `NON OBTENUE` | absents des deux PDF — mais **authentiques**, voir la rectification en 14.7 |
| Bloc de cotation GAD-7 | astérisque parasite (`(*For office coding`) | non rapporté |
| Coche | `✓` au lieu de `✔` | `✓` au lieu de `✔` |
| Apostrophes | `'` par endroits au lieu de `’` | idem |

**Le relevé n°2 disait vrai sur le fond.** Ses seules erreurs sont des artefacts
de procédé — un accent perdu, des mots recollés, une coche approchée, un
astérisque surnuméraire — et il a honnêtement déclaré ne pas avoir les seuils.
**Le relevé n°3 a produit un texte faux de bout en bout**, tout en l'étiquetant
`[FICHIER]`, en annonçant `OBTENU`, et en y ajoutant des seuils plausibles qui
n'existent nulle part.

**Sur l'hypothèse de la section 8.1 bis** (deux documents réels mal étiquetés) :
elle est **écartée pour les fichiers « France »** — le texte du relevé n°3 ne
correspond à aucun des deux.

**Et elle est désormais close pour le Canada aussi** : l'utilisateur atteste que
**la variante Canada est identique à la variante France** (attestation orale, le
13 octobre ; je n'ai pas reçu ce fichier, donc ni empreinte ni comparaison
mécanique — une empreinte dirait en outre s'il s'agit du même texte ou
littéralement du même fichier). Le texte du relevé n°3 ne correspond donc à
aucune des deux variantes françaises connues de `phqscreeners.com`.

Il reste une possibilité résiduelle, et elle mérite d'être nommée parce qu'elle
change la nature du manquement sans en changer la conséquence : le relevé n°3
pourrait reproduire une **autre traduction française réelle du PHQ-9, circulant
hors de `phqscreeners.com`** — il en existe plusieurs. Dans cette lecture, il
n'aurait pas inventé un texte mais violé la règle de la source unique, en
restituant un document tiers sous l'étiquette du fichier demandé. Dans l'autre,
il a confabulé. Le résultat est le même : inutilisable, et présenté comme
authentique.

**Et la leçon tient en une ligne : le relevé qui s'est révélé exact est celui qui
a reconnu ses manques, et le relevé qui s'est révélé faux est celui qui
affirmait avoir tout obtenu.**

### 12.8 Reste à obtenir

- La **liste réelle des variantes de français** : toujours pas établie
  (section 11.4). L'attestation que France et Canada sont identiques réduit
  l'enjeu de cette liste sans la fournir : il reste à savoir si d'autres
  variantes sont proposées, et si elles diffèrent entre elles.
- ~~La variante Canada du PHQ-9~~ — question close par attestation de
  l'utilisateur (section 12.7), sans empreinte.
- Les **seuils d'interprétation**, depuis l'*Instruction Manual* ou la
  littérature, avec leur propre source et leur propre empreinte.
- Un **contrôle d'origine par `curl`** sur les quatre fichiers, le jour où la
  passerelle s'ouvrira : les empreintes des sections 10, 11 et 12 le rendront
  immédiat.

---

## 13. Les URL authentiques, extraites des liens embarqués (13 octobre 2026)

Les annotations `/URI` du PDF de la page de sélection (section 11, empreinte
`de2a6660…c3198d`) portent les cibles réelles des liens. Extraites localement,
sans aucun accès réseau. Même chaîne de possession que la section 11 : ce sont
les liens de la page telle que le navigateur de l'utilisateur l'a rendue.

```text
https://www.phqscreeners.com/images/sites/g/files/g10016261/f/201412/instructions.pdf
https://www.phqscreeners.com/images/sites/g/files/g10016261/f/201412/01_Bibliography%20by%20author.pdf
http://pfizer.com/general/terms.jsp
http://www.pfizer.com/
http://www.pfizer.com/privacy
```

### 13.1 Le chemin réel, et ce qu'il révèle des deux relevés externes

Le préfixe authentique est **`/images/sites/g/files/g10016261/f/201412/`**.
Confronté aux deux chemins annoncés « confirmés » :

| Source | Chemin annoncé | Verdict |
|---|---|---|
| Relevé n°2 | `/images/sites/g/files/`**`g10060481`**`/f/201412/` | préfixe **juste**, identifiant de site **faux** |
| Relevé n°3 | `/sites/g/files/`**`g10016261`**`/f/201412/` | préfixe **faux** (`/images` manquant), identifiant **juste** |
| **Authentique** | `/images/sites/g/files/g10016261/f/201412/` | — |

**Chacun des deux avait une moitié juste et une moitié fausse** — et aucun n'était
utilisable, puisque rien ne disait laquelle. Le segment `201412` est en revanche
authentique, bien que les deux questionnaires datent de 2010 : c'est un chemin de
dépôt, pas une date de document.

URL probables des trois fichiers déjà authentifiés, à confirmer par `curl` :

```text
https://www.phqscreeners.com/images/sites/g/files/g10016261/f/201412/PHQ9_French%20for%20France.pdf
https://www.phqscreeners.com/images/sites/g/files/g10016261/f/201412/GAD7_French%20for%20France.pdf
```

### 13.2 Où vivent les seuils d'interprétation

**`instructions.pdf` est l'*Instruction Manual* référencé par la page**, et c'est
là que doivent se trouver la règle de calcul et les seuils absents des deux
questionnaires (section 12.6). **Un seul fichier reste donc à obtenir pour clore
le volet psychométrique.**

### 13.3 Point juridique à compléter

Les mentions « Privacy Policy » et « Terms of Use Agreement » du pied de page
pointent vers **`pfizer.com`**, non vers `phqscreeners.com`. L'énoncé permissif
authentifié en section 11.2 vit donc sur un site régi par les conditions
d'utilisation de Pfizer. **`http://pfizer.com/general/terms.jsp` est à relever**
avant de conclure sur le régime applicable : une autorisation portée par une page
ne se lit pas indépendamment des conditions générales du site qui l'héberge.

### 13.4 Contrôle d'origine, prêt à exécuter

À lancer dès que la passerelle s'ouvre. Il compare les empreintes servies à
celles des sections 10 et 12, et récupère les deux pièces manquantes.

```bash
mkdir -p /tmp/echelles/verif && cd /tmp/echelles/verif
B='https://www.phqscreeners.com/images/sites/g/files/g10016261/f/201412'
curl -sSL -o phq9.pdf        "$B/PHQ9_French%20for%20France.pdf"
curl -sSL -o gad7.pdf        "$B/GAD7_French%20for%20France.pdf"
curl -sSL -o instructions.pdf "$B/instructions.pdf"
curl -sSL -o who5.pdf        'https://cdn.who.int/media/docs/default-source/mental-health/indice-(en-cinq-points)-de-bien--tre-de-l-oms.pdf'
sha256sum *.pdf
# attendu :
#   408801762a1b728ebc01eaf119302539e7fb5503b855d81d603dbe9a43be9fc1  who5.pdf
#   b9529947a01d82b7c640176958e6e0f409a98e239380deafdfb4f27162c50298  phq9.pdf
#   3622a0e265cb182c0cc8cffaa836b22b8f264dd9f39f9759c68459e4fa08f02c  gad7.pdf
pdftotext -layout instructions.pdf -
```

Une empreinte identique prouve l'origine et clôt la réserve des sections 10.1 et
12.1. Une empreinte différente signifie que le fichier servi n'est pas celui
relevé ici — le texte des sections 10, 12 resterait exact pour les fichiers
empreintés, mais devrait être refait sur le fichier servi.

---

## 14. Instruction Manual et bibliographie — RELEVÉS AUTHENTIFIÉS (13 octobre 2026)

Fichiers joints par l'utilisateur, empreintés et extraits dans le conteneur. Même
chaîne de possession qu'en section 10.1. **Ces deux fichiers étaient les cibles
des liens embarqués relevés en section 13**, ce qui confirme ces liens.

### 14.1 Preuve de fichier

| Champ | Instruction Manual | Bibliographie |
|---|---|---|
| Taille réelle | **134 493 octets** | **175 450 octets** |
| SHA-256 | **`6ed2f00f97e438c1168cd702d38d31fc923031445c720653005f138aa424228a`** | **`614ded70a7a4a1df18a8e6d712130456062b667b4e703c51c97d111021d93acf`** |
| En-tête de fichier | `%PDF-1.6` | `%PDF-1.4` |
| Pages | 9 | 49 |
| Titre interne | *(vide)* | `Microsoft Word - PHQ biblio by author _Apr 2010_.rtf` |
| Auteur interne | **`Kurt Kroenke`** | `cg014193` |
| Producteur | `Microsoft® Office Word 2007` | `Acrobat Distiller 8.1.0 (Windows)` |
| Création | 22 juin 2010, 22:18:09 UTC | 19 mai 2010, 14:32:12 UTC |
| Modification | **16 avril 2014, 13:54:47 UTC** | 19 mai 2010, 14:32:12 UTC |

La bibliographie est une liste de références (`PRIME-MD & PHQ Family of Scales
Reference List by Author (Updated April 2010)`) et **ne porte aucune mention de
droits** — vérifié par recherche. Elle n'est pas reprise ici.

**Réserve d'encodage, à connaître avant toute citation au caractère :** la couche
texte du manuel rend les guillemets typographiques du document par `U+2015`
(barre horizontale) et `U+2016` (double barre verticale). Ce sont des artefacts
de la table d'encodage du PDF, non les caractères du document. **Les chaînes
anglaises citées ci-dessous sont donc exactes quant aux mots, et normalisées
quant aux guillemets** — je les rends par `"`. Toute reprise au caractère près
exigerait de relire le document lui-même.

### 14.2 Règles de calcul du score — AUTHENTIFIÉES

`PHQ-9 Depression Severity`, verbatim (guillemets normalisés) :

```text
This is calculated by assigning scores of 0, 1, 2, and 3, to the response categories of "not at
all," "several days," "more than half the days," and "nearly every day," respectively. PHQ-9 total
score for the nine items ranges from 0 to 27. [...] Scores of 5, 10, 15, and 20 represent
cutpoints for mild, moderate, moderately severe and severe depression, respectively. Sensitivity
to change has also been confirmed. The PHQ-8 is scored just like the PHQ-9 and its total score
ranges from 0 to 24. Cutpoints on the PHQ-8 are identical to the PHQ-9.
```

`GAD-7 Anxiety Severity`, verbatim :

```text
This is calculated by assigning scores of 0, 1, 2, and 3, to the response categories of "not at
all," "several days," "more than half the days," and "nearly every day," respectively. GAD-7 total
score for the seven items ranges from 0 to 21. Scores of 5, 10, and 15 represent cutpoints for
mild, moderate, and severe anxiety, respectively. [...] When screening for anxiety disorders, a
recommended cutpoint for further evaluation is a score of 10 or greater.
```

### 14.3 Table 4 — paliers du PHQ-9, verbatim

```text
 Table 4. PHQ-9 Scores and Proposed Treatment Actions *

PHQ-9         Depression     Proposed Treatment Actions
Score          Severity

 0–4         None-minimal    None

 5–9               Mild      Watchful waiting; repeat PHQ-9 at follow-up

10 – 14        Moderate      Treatment plan, considering counseling, follow-up and/or
                             pharmacotherapy

15 – 19       Moderately     Active treatment with pharmacotherapy and/or psychotherapy
               Severe

20 – 27          Severe      Immediate initiation of pharmacotherapy and, if severe impairment or
                             poor response to therapy, expedited referral to a mental health
                             specialist for psychotherapy and/or collaborative management

* From Kroenke K, Spitzer RL, Psychiatric Annals 2002;32:509-521
```

Le manuel ne donne **pas** de tableau équivalent pour le GAD-7 : seuls les
points de coupure 5, 10 et 15 y figurent, en texte.

### 14.4 RÉGIME JURIDIQUE — tranché, et plus favorable que prévu

Page 8, section `QUESTIONS REGARDING DEVELOPMENT, ACKNOWLEDGMENTS AND USE`,
verbatim :

```text
The PHQ family of measures (see Table 1, page 3), including abbreviated and alternative
versions as well as the GAD-7, were developed by Drs. Robert L. Spitzer, Janet B.W. Williams,
Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc.
All of the measures included in Table 1 are in the public domain. No permission is required to
reproduce, translate, display or distribute.
```

**« in the public domain »** est plus net que l'énoncé du site relevé en
section 11.2, et il est signé du manuel dont l'auteur interne est Kurt Kroenke.
Le PHQ-9 et le GAD-7 relèvent donc du **domaine public**, ce qui rend sans objet
la réserve de la section 13.3 sur les conditions d'utilisation de Pfizer : il n'y
a pas de licence à respecter, seulement une attribution d'usage à faire par
correction.

### 14.5 CONSTAT CRITIQUE POUR L'APPLICATION — les traductions ne sont pas validées

Page 7, section `TRANSLATIONS`, verbatim :

```text
Many of the translations have been developed by the MAPI Research Institute using an
internationally accepted translation methodology.       Thus, most of the translations are
linguistically valid. However, unlike the English versions of the PHQ and GAD-7, few of the
translations have been psychometrically validated against an independent structured
psychiatric interview.
```

**C'est le point le plus important de ce relevé pour la suite du projet.** Les
seuils de la section 14.3 sont établis sur les versions **anglaises**. Le manuel
indique que peu de traductions ont été validées psychométriquement. Rien dans les
pièces relevées n'établit que la traduction française « France » l'ait été.

Conséquence : **afficher un palier de sévérité calculé sur la version française
en le présentant comme validé irait au-delà de ce que la source autorise.** Ce
n'est pas une question de licence — le domaine public n'impose rien — mais
d'exactitude. La décision revient au développeur central ; les formulations
possibles vont de l'affichage du score brut sans palier, à l'affichage des
paliers avec mention explicite qu'ils proviennent de la validation anglaise.

### 14.6 Deux précisions d'implémentation, authentifiées

**La question fonctionnelle n'entre pas dans le score.** Page 2, verbatim
(guillemets normalisés) :

```text
This single patient-rated difficulty item is not used in calculating any PHQ score or diagnosis but
rather represents the patient's global impression of symptom-related impairment.
```

**L'item 9 du PHQ-9 appelle une précaution.** Page 2, verbatim :

```text
A particularly important question is how to assess suicide risk in individuals who answer positively
to the 9th question of the PHQ-9. A four-item screener has been developed that may assist in
positive responses to this 9th question [16], although a final decision about the actual risk of self-
harm requires a clinical interview.
```

### 14.7 Rectification sur le relevé externe n°3

La section 12.7 qualifiait ses seuils d'« inventés ». **C'est inexact et je le
corrige : les seuils qu'il donnait sont authentiques**, conformes à la table 4
ci-dessus pour le PHQ-9 (0-4, 5-9, 10-14, 15-19, 20-27) et aux points de coupure
du GAD-7 (0-4, 5-9, 10-14, 15-21). Ils ne figuraient pas dans les deux
questionnaires qu'il prétendait avoir lus — ils figurent dans le manuel.

Le constat exact est donc plus instructif que celui que j'avais porté : **ce
relevé a restitué correctement des chiffres très diffusés, et faussement le texte
d'une traduction particulière.** C'est la signature même de la mémoire
paramétrique — ce qui est répété partout ressort juste, ce qui est propre à un
document ressort inventé. Et c'est précisément pourquoi la plausibilité d'une
partie d'un relevé ne dit rien de la fiabilité du reste.

### 14.8 État de clôture du relevé

| Élément | État |
|---|---|
| WHO-5 français : texte, options, score | **authentifié** (section 10) |
| PHQ-9 « France » : texte, options | **authentifié** (section 12) |
| GAD-7 « France » : texte, options | **authentifié** (section 12) |
| Règles de score et seuils PHQ-9 / GAD-7 | **authentifiés** (section 14) |
| Licence PHQ-9 / GAD-7 | **authentifiée — domaine public** (section 14.4) |
| Mentions et attribution des trois échelles | **authentifiées** (sections 10.4, 12.5) |
| Page de droits de l'OMS | relevée, sous quarantaine (section 7.4) — non empreintée |
| Liste complète des variantes de français | **non établie** (section 11.4) |
| Validation psychométrique du français | **absente, et signalée comme telle par la source** (14.5) |
| Contrôle d'origine par `curl` des 6 fichiers | **à faire** (script en 13.4) |

**Le mot-à-mot demandé est obtenu et empreinté pour les trois échelles.** Restent
deux lacunes documentées — la liste des variantes et le contrôle d'origine — et
une décision qui n'est pas de mon ressort, celle de la section 14.5.

---

## 15. Confrontation des documents authentifiés entre eux (13 octobre 2026)

Trois constats issus de la seule comparaison des pièces des sections 10, 12 et
14. Aucune source nouvelle, aucune interprétation : ce sont des faits de texte.

### 15.1 Les catégories de réponse françaises ne traduisent pas littéralement l'ancrage anglais

Le manuel énonce les catégories anglaises sur lesquelles reposent les seuils
(section 14.2) ; les PDF français portent les leurs. Mises en regard :

| Valeur | Anglais (manuel, ancrage des seuils) | Français « France » (PHQ-9 et GAD-7) | Écart |
|---|---|---|---|
| 0 | `not at all` | `Jamais` | **« jamais » ≠ « pas du tout »** |
| 1 | `several days` | `Plusieurs jours` | concordant |
| 2 | `more than half the days` | `Plus de la moitié du temps` | **« du temps » ≠ « des jours »** |
| 3 | `nearly every day` | `Presque tous les jours` | concordant |

**Deux niveaux sur quatre s'écartent du sens de l'ancrage anglais** : le niveau 0
passe d'une absence de gêne à une absence d'occurrence, et le niveau 2 d'un
décompte de jours à une proportion de temps.

Ce constat et celui de la section 14.5 se renforcent : les seuils sont validés
sur l'anglais, la traduction française n'est pas psychométriquement validée, et
son jeu de réponses diverge du jeu anglais sur la moitié de ses niveaux. **Cela
ne disqualifie pas le questionnaire français** — il est publié comme tel par
l'éditeur, et le manuel qualifie les traductions MAPI de linguistiquement
valides. Cela borne ce qu'on peut en dire : le score français n'est pas
démontré équivalent au score anglais, et c'est à prendre en compte dans ce que
l'application affiche.

### 15.2 Piège d'implémentation : un même libellé, deux valeurs

| Libellé | WHO-5 | PHQ-9 / GAD-7 |
|---|---|---|
| `Plus de la moitié du temps` | **3** | **2** |
| `Jamais` | **0** | **0** |

`Plus de la moitié du temps` est **le même texte avec deux valeurs différentes**
selon l'échelle. Toute table d'options indexée sur le libellé, et non sur le
couple (échelle, libellé), produira un score faux pour l'une des deux. Que
`Jamais` vaille 0 des deux côtés est une coïncidence et non une règle : elle ne
doit pas servir de garantie.

### 15.3 Les trois échelles n'ont ni la même granularité ni le même sens

| | WHO-5 | PHQ-9 | GAD-7 |
|---|---|---|---|
| Niveaux | **6** (`5 4 3 2 1 0`) | 4 (`0 1 2 3`) | 4 (`0 1 2 3`) |
| Items | 5 | 9 | 7 |
| Score brut | 0 à 25 | 0 à 27 | 0 à 21 |
| Transformation | **× 4 → 0 à 100** | aucune | aucune |
| Sens de la montée | **score élevé = meilleur bien-être** | score élevé = symptômes plus sévères | score élevé = symptômes plus sévères |
| Paliers au document | **aucun** | aucun (voir manuel, 14.3) | aucun (voir manuel, 14.2) |
| Item non coté | — | **la question fonctionnelle** (14.6) | — |

**Le sens de la montée s'inverse entre le WHO-5 et les deux autres.** Une
présentation uniforme des trois scores — même code couleur, même sens de jauge —
inverserait la lecture d'une des trois. C'est le second piège, et il est plus
facile à commettre que le premier parce qu'il ne produit aucune erreur de calcul.

### 15.4 Portée de cette section

Ces trois constats sont des observations de texte sur des fichiers empreintés ;
ils n'engagent aucun choix de mise en œuvre, qui relève du développeur central.
Ils sont consignés ici parce qu'ils ne se voient qu'en lisant les six documents
ensemble, et qu'ils disparaîtraient d'un relevé document par document.
