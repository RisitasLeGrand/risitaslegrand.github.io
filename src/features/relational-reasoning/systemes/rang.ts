/**
 * Système `rang` : des places numérotées sur une rangée, et la distance exacte
 * qui les sépare.
 *
 * Il ne double pas `line`, il le complète, et la différence est le point à
 * saisir. `line` dit la **direction** sans la distance — « est avant », « est
 * après » —, de sorte qu'une chaîne y laisse toujours de l'indétermination sur
 * les écarts. `rang` dit la **distance exacte** — « est à deux places à gauche
 * de » —, ce qui rend le réseau entièrement déterminé dès qu'une chaîne couvre
 * les entités.
 *
 * Les deux exercices n'ont donc rien à voir : sur `line` on cherche ce qui
 * reste possible, sur `rang` on compte. C'est la différence entre « A est avant
 * B, B est avant C, donc A est avant C » et « A est deux places avant B, B est
 * trois places avant C, donc A est cinq places avant C » — et la seconde est
 * précisément ce que les chaînes d'agencement linéaire demandent.
 *
 * La composition est **fonctionnelle** : deux écarts s'additionnent et donnent
 * un écart, ou rien du tout quand la somme sort de la rangée ou ramène sur la
 * même place. Ce « rien du tout » n'est pas un trou dans la table, c'est une
 * contradiction détectée : deux entités distinctes ne partagent pas une place.
 */
import { motsFantomes } from '../noyaux/mots';
import type { Alea, Instance, Modele, Relation, Systeme } from './types';

/** Six places : assez pour des écarts jusqu'à cinq, assez peu pour rester lisible. */
const PLACES = 6;
const ECART_MAX = PLACES - 1;

/** `+2` → « est à deux places à droite de ». L'écart est celui du sujet vers l'objet. */
const NOMBRES = ['', 'une', 'deux', 'trois', 'quatre', 'cinq'];

function idDeLEcart(ecart: number): string {
  return ecart > 0 ? `d${ecart}` : `g${-ecart}`;
}

function libelleDeLEcart(ecart: number): string {
  const n = Math.abs(ecart);
  const cote = ecart > 0 ? 'droite' : 'gauche';
  // L'adjacence a son mot propre : « est à une place à droite » se dit mal.
  if (n === 1) return `est juste à ${cote} de`;
  return `est à ${NOMBRES[n]} places à ${cote} de`;
}

const ECARTS: number[] = [];
for (let e = -ECART_MAX; e <= ECART_MAX; e += 1) if (e !== 0) ECARTS.push(e);

const ECART_PAR_ID = new Map(ECARTS.map((e) => [idDeLEcart(e), e]));

const relations: Relation[] = ECARTS.map((ecart) => ({
  id: idDeLEcart(ecart),
  libelle: libelleDeLEcart(ecart),
  bref: ecart > 0 ? `+${ecart}` : String(ecart),
  // Seule l'adjacence exhibe un motif que le classifieur sait nommer : une
  // chaîne de voisins immédiats est une succession. Les écarts plus larges ne
  // dessinent aucune des sept algèbres, et ne sont donc pas proposés à
  // « Algèbre cachée » plutôt que d'y être rangés de force.
  algebre: Math.abs(ecart) === 1 ? ('succession' as const) : undefined,
}));

function relationDansModele(modele: Modele, a: string, b: string): string {
  const pa = modele.coordonnees?.[a]?.[0] ?? 0;
  const pb = modele.coordonnees?.[b]?.[0] ?? 0;
  return idDeLEcart(pa - pb);
}

export const rang: Systeme = {
  id: 'rang',
  nom: 'Rangée',
  resume: 'Des places numérotées côte à côte, et l’écart exact entre deux d’entre elles.',
  regimes: ['algebre'],
  relations,
  monde: 'ouvert',
  converse: (relation) => idDeLEcart(-(ECART_PAR_ID.get(relation) ?? 0)),
  composer: (r, s) => {
    const somme = (ECART_PAR_ID.get(r) ?? 0) + (ECART_PAR_ID.get(s) ?? 0);
    // Hors rangée, ou retour sur la même place : la combinaison est impossible.
    if (somme === 0 || Math.abs(somme) > ECART_MAX) return new Set<string>();
    return new Set([idDeLEcart(somme)]);
  },
  // Composition fonctionnelle : la propagation par chemins suffit, comme pour
  // « groups ». Aucune paire ne reste ouverte dès qu'une chaîne couvre les
  // entités, et l'énumération de scénarios serait du temps perdu.
  cheminComplet: true,
  relationDansModele,

  engendrer(difficulte: number, alea: Alea): Instance {
    const nombre = Math.min(PLACES, 3 + Math.floor(difficulte / 3));
    const entites = motsFantomes(nombre, alea);

    // Des places distinctes, tirées parmi les six : l'écart maximal observé
    // varie donc d'une instance à l'autre, ce qui évite que le vocabulaire se
    // réduise toujours aux mêmes deux ou trois relations.
    const places = alea.plusieurs(
      Array.from({ length: PLACES }, (_, i) => i),
      nombre,
    );
    const coordonnees: Record<string, number[]> = {};
    entites.forEach((entite, i) => {
      coordonnees[entite] = [places[i]];
    });
    const modele: Modele = { coordonnees };

    const ordre = alea.melanger(entites);
    const faits = ordre.slice(1).map((entite, i) => ({
      sujet: entite,
      relation: relationDansModele(modele, entite, ordre[i]),
      objet: ordre[i],
    }));

    return { systeme: 'rang', entites, faits: alea.melanger(faits), modele };
  },

  rendu: 'texte',
};
