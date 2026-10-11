# Compatibilité des transports — relevé du 11 octobre 2026

Livrable de la phase 0. Le prompt demande ce tableau « à vérifier à la date de
l'implémentation, pas de mémoire ». Les lignes ci-dessous distinguent donc
**trois états**, et la distinction est le point important du document :

- **vérifié aujourd'hui** — j'ai consulté une source datée pendant cette session,
  citée en bas de page ;
- **non vérifié** — je ne l'ai pas consulté. Je ne l'affirme pas de mémoire ;
- **à vérifier sur appareil** — aucune source ne remplace un essai sur ton
  téléphone et ton ordinateur.

Un tableau qui mélangerait les trois serait pire qu'absent : il donnerait
l'assurance d'une vérification qui n'a pas eu lieu.

## Les briques dont dépendent les transports

| Brique | Chrome / Edge (ordinateur) | Firefox | Safari (Mac) | Chrome (Android) | Safari (iPhone) | État |
|---|---|---|---|---|---|---|
| **Sélecteur de dossier** (`showDirectoryPicker`) | oui, depuis la 86 | **non** (OPFS seul) | **non** (OPFS seul) | **non** (OPFS seul) | **non** | **vérifié aujourd'hui** |
| **`BarcodeDetector`** (lecture de QR) | partiel depuis la 88 | **jamais** | **désactivé par défaut** (17.0 → 26.5) | partiel | **désactivé par défaut** | **vérifié aujourd'hui** |
| **WebRTC pair à pair** | — | — | — | — | — | **non vérifié** |
| **Caméra** (`getUserMedia`) | — | — | — | — | — | **non vérifié** |
| **Partage de fichiers** (`navigator.share` avec `files`) | — | — | — | — | — | **non vérifié** |
| **Écran maintenu allumé** (Wake Lock) | — | — | — | — | — | **non vérifié** |
| **Durée de vie du stockage** | longue | longue | plafond de 7 jours sur les données écrites par script | longue | plafond de 7 jours ; exemption de l'écran d'accueil attestée mais non documentée par Apple | **vérifié** (session précédente) |

## Ce que cela fait aux transports

| Transport | Ordinateur | Téléphone | Verdict |
|---|---|---|---|
| **A1** — QR, liaison directe, relais de signalisation | affiche le QR, pas besoin de scanner | scanne avec l'appareil photo du système | **viable**, sous réserve de WebRTC (non vérifié) |
| **A2** — QR dans les deux sens, sans tiers | **doit scanner le QR du téléphone** → bloqué sur Firefox et Safari sans décodeur embarqué | affiche le second QR | **viable seulement avec un décodeur en WebAssembly** |
| **A3** — QR animés seuls | idem A2 | idem | **écarté** : débit trop faible, et même obstacle de lecture |
| **B** — fichier dans un dossier choisi | **Chromium seulement** pour l'accès mémorisé | **impossible** : pas de dossier persistant | **ordinateur Chromium seulement** |
| **C** — transfert manuel du fichier | partout | partout | **secours universel** |

## Les trois conséquences qui pèsent sur les décisions

**1. A2 n'est pas le repli gratuit qu'il paraît.** Son principe est que
l'ordinateur lise un QR affiché par le téléphone. Or ni Firefox ni Safari
n'exposent `BarcodeDetector` — Safari l'a désactivé par défaut de la version 17
à la 26.5, Firefox ne l'a jamais implémenté. Sur ces navigateurs, A2 exige un
décodeur de QR en WebAssembly embarqué dans le site, avec sa licence à vérifier
et son poids à mesurer. A2 reste faisable, mais il coûte un composant de plus,
et ce composant est inutile en A1 où l'ordinateur n'a rien à scanner.

**2. B est un transport d'ordinateur, et seulement sous Chromium.** L'accès
mémorisé à un dossier n'existe ni sur Firefox, ni sur Safari, ni sur aucun
navigateur mobile — ces plateformes n'exposent que le système de fichiers privé
de l'origine, qui est un bac à sable et non le disque. Sur téléphone, B se réduit
au sélecteur de fichiers, c'est-à-dire à C déguisé. Le tableau d'hypothèses du
prompt disait « 0 geste sur ordinateur, plusieurs sur téléphone » : la
vérification confirme, et durcit.

**3. C est le seul transport qui marche partout**, et c'est la raison pour
laquelle la phase 3 du plan commence par lui. Un moteur de fusion éprouvé par un
transport trivial est un moteur dont on sait que les bogues restants sont dans
le transport.

## Ce qu'il reste à vérifier, et comment

Les quatre lignes « non vérifié » ne le sont pas par négligence : ce sont celles
dont la réponse dépend de ton matériel et de ta version, et qu'une page de
documentation ne tranche pas. Elles se vérifient par un essai, qui est le
premier livrable de la phase 3 :

- **WebRTC entre ton ordinateur et ton téléphone**, sur ton Wi-Fi puis en 4G.
  C'est le seul essai qui décide si A1 est la bonne voie. Une page d'essai
  minimale suffit, et elle est à écrire avant le moteur de fusion.
- **La caméra et le partage de fichiers** sur ton téléphone précisément.
- **L'écran maintenu allumé**, dont dépend la viabilité d'un transfert long sur
  téléphone — les navigateurs mobiles suspendent les pages en arrière-plan.

## Sources consultées le 11 octobre 2026

- File System Access : <https://developer.chrome.com/docs/capabilities/web-apis/file-system-access>
  et <https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker>
- `BarcodeDetector` : <https://caniuse.com/mdn-api_barcodedetector>
- Trystero : <https://github.com/dmotz/trystero>
- Stockage sur WebKit (session précédente) : <https://webkit.org/tracking-prevention/>

Les tables de compatibilité sont des instantanés. Celles-ci portent une date
pour qu'on sache quand les relire, et non pour faire croire qu'elles sont
définitives.
