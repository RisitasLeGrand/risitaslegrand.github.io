import { Pipe, PipeTransform } from '@angular/core';

/**
 * TRADUCTION FR — ajout par rapport au dépôt d'origine.
 *
 * Applique l'élision française aux énoncés engendrés : « de Ananas » devient
 * « d'Ananas », « le Ananas » devient « l'Ananas ».
 *
 * Pourquoi un tuyau plutôt qu'une correction dans les générateurs : la
 * préposition et le sujet sont produits à une quinzaine d'endroits différents,
 * et le sujet n'est connu qu'au dernier moment. Un traitement unique au rendu
 * évite d'éparpiller la règle.
 *
 * L'élision n'est appliquée que devant un sujet commençant par une voyelle ou
 * un « h » muet usuel — jamais devant un émoji ni devant une suite de lettres
 * majuscules, pour lesquels « de QAX » reste la forme correcte.
 */
@Pipe({ name: 'elision' })
export class ElisionPipe implements PipeTransform {
    /**
     * Mots élidables suivis d'un sujet : « de », « le », « la », « que ».
     *
     * Le groupe optionnel « </span> » couvre le cas où le mot termine un
     * fragment surligné par la négation — « plus grand que</span> <span
     * class="subject">Artichaut</span> » — qui sans cela échapperait à la règle.
     */
    private static readonly MOTIF =
        /\b(de|que|le|la)(<\/span>)?\s+(<span class="subject">)([A-ZÀÂÉÈÊÎÔÛ][a-zàâçéèêëîïôûùü-]*)/g;

    /**
     * Voyelles françaises, plus les rares initiales à « h » muet présentes dans
     * la liste des noms. Le « h » aspiré (« Hérisson », « Hibou », « Hangar »)
     * n'est volontairement pas élidé.
     */
    private static readonly H_MUET = ['Horizon', 'Herbe', 'Heure', 'Hiver', 'Homme'];

    private static commenceParVoyelle(mot: string): boolean {
        if (/^[AEIOUYÀÂÉÈÊÎÔÛ]/.test(mot)) return true;
        return ElisionPipe.H_MUET.some((h) => mot.startsWith(h));
    }

    transform(valeur: unknown): unknown {
        if (typeof valeur !== 'string') return valeur;

        return valeur.replace(
            ElisionPipe.MOTIF,
            (tout, mot: string, fermante: string | undefined, balise: string, sujet: string) => {
                if (!ElisionPipe.commenceParVoyelle(sujet)) return tout;
                const elide = mot === 'que' ? "qu'" : mot[0] + "'";
                return elide + (fermante ?? '') + balise + sujet;
            },
        );
    }
}
