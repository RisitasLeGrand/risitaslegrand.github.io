/**
 * LE DÉCOMPTE QUE LA PROSE D'UN VISUEL ANNONCE, CONTRE SES DONNÉES.
 *
 * ## Ce que ce contrôle n'est pas, et pourquoi c'est important
 *
 * Il devait d'abord vérifier les décomptes dans la prose libre : « quand une
 * phrase annonce N éléments et qu'une liste suit, le nombre doit
 * correspondre ». Trois versions ont été écrites et MESURÉES sur 8 979 textes
 * du corpus, et la conclusion est nette : cela ne marche pas.
 *
 *   - version large — un nombre, deux points, une liste aux virgules :
 *     221 avertissements, dont AUCUN juste. Les coupables sont les numéros
 *     d'article (« l'article 5 du traité : l'Union intervient… »), les dates
 *     (« le 11 novembre 1918 : il suspend les combats… ») et le « et » interne
 *     d'un élément, qui fait compter trois éléments dans « la non-compensation
 *     entre recettes et dépenses, et la non-affectation » ;
 *   - version au point-virgule seul : zéro faux positif, et zéro vrai — les
 *     phrases réellement fautives énuméraient à la virgule ;
 *   - version par la forme des segments : 28 avertissements, un ou deux justes.
 *
 * Le français écrit « deux repères : », « cinq voisins : », « trois bornes : »
 * sans que le nombre porte sur les segments séparés par des virgules. Un
 * avertissement juste à 7 % n'est pas un garde-fou : c'est du bruit, et il
 * apprendrait à passer outre les avertissements qui servent. La règle est déjà
 * écrite dans « corrections-migrees » — « un contrôle qui ne contrôle rien
 * finit par rassurer, ce qui est pire que son absence ».
 *
 * ## Ce que ce contrôle est
 *
 * La même faute, prise là où elle est DÉCIDABLE : le texte de remplacement
 * d'un visuel annonce « Tableau à trois colonnes », et le tableau porte ses
 * entêtes. Les deux côtés sont lisibles par une machine, il n'y a rien à
 * interpréter, donc aucun faux positif n'est possible.
 *
 * Mesuré sur 555 visuels du corpus : douze écarts, tous réels, tous dans la
 * prose et aucun dans les données. Il aurait attrapé la légende « Cinq
 * principes » d'une correction où le tableau en portait quatre, que la
 * relecture en aveugle a trouvée à la main.
 *
 * Il REFUSE la construction, et ne se contente pas d'avertir : un texte qui
 * contredit ses propres données est une faute, pas une hypothèse. Un lecteur
 * d'écran annonce « tableau à trois colonnes » et en rencontre deux.
 *
 * ## Les trois formes contrôlées
 *
 * Elles sont celles que les corrections emploient réellement. On ne contrôle
 * que ce qu'on sait lire : une forme inconnue laisse le visuel tranquille,
 * parce qu'un contrôle qui devine est pire que pas de contrôle.
 */

const NOMBRES = new Map(
  Object.entries({
    un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6,
    sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  }),
);

const sansAccents = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
const nombreDe = (mot) => NOMBRES.get(sansAccents(mot).toLowerCase()) ?? Number(mot);

/**
 * Les écarts d'un visuel entre ce que sa prose annonce et ce que portent ses
 * données. Rend la liste des phrases de reproche — vide si tout s'accorde.
 */
export function ecartsDuVisuel(visuel) {
  if (!visuel || visuel.type === 'aucun') return [];
  const ecarts = [];
  const prose = [visuel.alt, visuel.legende].filter(Boolean).join(' ');
  const d = visuel.donnees ?? {};

  /* « Tableau à N colonnes » contre le nombre d'entêtes. */
  const colonnes = prose.match(/tableau\s+[àa]\s+([\wÀ-ÿ]+)\s+colonnes?/i);
  if (colonnes && Array.isArray(d.entetes)) {
    const annonce = nombreDe(colonnes[1]);
    if (Number.isFinite(annonce) && annonce !== d.entetes.length) {
      ecarts.push(
        `la prose annonce ${annonce} colonne(s) et le tableau en porte ${d.entetes.length}`,
      );
    }
  }

  /* « Schéma à N niveaux » contre les niveaux distincts des nœuds. */
  const niveaux = prose.match(/sch[ée]ma\s+[àa]\s+([\wÀ-ÿ]+)\s+niveaux?/i);
  if (niveaux && Array.isArray(d.noeuds)) {
    const annonce = nombreDe(niveaux[1]);
    const reels = new Set(d.noeuds.map((n) => n.niveau)).size;
    if (Number.isFinite(annonce) && annonce !== reels) {
      ecarts.push(`la prose annonce ${annonce} niveau(x) et le schéma en porte ${reels}`);
    }
  }

  /*
     « Frise de A à B » contre les dates extrêmes des jalons.
     On ne lit que les années à quatre chiffres : un jalon peut porter
     « 5 juillet 1974 », et c'est l'année qui borne la frise.
  */
  const frise = prose.match(/frise\s+(?:de|d['’])\s*(\d{3,4})\s+[àa]\s+(\d{3,4})/i);
  if (frise && Array.isArray(d.jalons)) {
    const annees = d.jalons
      .map((j) => String(j.date).match(/\d{3,4}/)?.[0])
      .filter(Boolean)
      .map(Number);
    if (annees.length > 0) {
      const premiere = Math.min(...annees);
      const derniere = Math.max(...annees);
      if (Number(frise[1]) !== premiere || Number(frise[2]) !== derniere) {
        ecarts.push(
          `la prose annonce une frise de ${frise[1]} à ${frise[2]} ` +
            `et les jalons vont de ${premiere} à ${derniere}`,
        );
      }
    }
  }

  return ecarts;
}
