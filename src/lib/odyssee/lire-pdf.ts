/**
 * L'adaptateur pdf.js : il transforme un fichier en morceaux positionnés, et
 * ne sait rien des relevés.
 *
 * Toute la logique bancaire est dans `releve.ts`, qui ne connaît pas les PDF.
 * Ici, on ne fait que trois choses : ouvrir le fichier **dans le navigateur**,
 * relever la position de chaque fragment de texte, et dire quel logiciel a
 * produit le document.
 *
 * ## Rien ne sort de l'appareil
 *
 * Le fichier est lu par `arrayBuffer()`, c'est-à-dire en mémoire, et pdf.js
 * tourne dans un *worker* local. Aucune requête réseau n'est émise : les deux
 * réglages ci-dessous (`isEvalSupported`, `standardFontDataUrl` absent) y
 * veillent, et un essai en navigateur vérifie qu'aucune requête ne part
 * pendant un import.
 *
 * ## pdf.js est chargé à la demande
 *
 * 2,8 Mo, dont 2,2 pour le *worker*. Les importer dans le module principal
 * ferait payer ce poids à quelqu'un qui vient réviser une fiche. L'import est
 * donc dynamique, et n'arrive que lorsqu'un fichier est réellement déposé.
 */
import type { Morceau } from './releve';

export interface PdfLu {
  morceaux: Morceau[];
  pages: number;
  /** Le logiciel qui a produit le PDF — entre dans l'empreinte de gabarit. */
  producteur: string;
}

/**
 * Pourquoi le texte est pris morceau par morceau, et non par
 * `textContent.items.map(i => i.str).join('')`.
 *
 * Parce que le signe d'une opération **est** une position : débit et crédit
 * sont deux colonnes, et les concaténer les écrase. Mesuré sur deux relevés
 * CIC : un débit et un crédit finissent à la même colonne de caractères une
 * fois le texte mis à plat. La position est donc la donnée, pas un détail de
 * mise en forme.
 */
export async function lirePdf(fichier: File | ArrayBuffer): Promise<PdfLu> {
  /*
     Import depuis la racine du paquet, et non depuis `build/pdf.mjs` : c'est
     la racine qui porte les types (`types/src/pdf.d.ts`), et le chemin
     profond les perd — on y gagnerait un `any` silencieux exactement là où
     l'on manipule des coordonnées.
  */
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');

  /*
     Le worker est servi depuis le site lui-même, jamais depuis un CDN : un
     CDN verrait passer la demande, et saurait donc qu'un relevé est en cours
     de lecture. C'est peu, et c'est déjà trop.
  */
  GlobalWorkerOptions.workerSrc = new URL(
    '../../../node_modules/pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  const donnees =
    fichier instanceof ArrayBuffer ? fichier : await fichier.arrayBuffer();

  const doc = await getDocument({
    data: new Uint8Array(donnees),
    /* Aucune police ni carte de caractères n'est allée chercher ailleurs. */
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;

  const meta = await doc.getMetadata().catch(() => null);
  const info = (meta?.info ?? {}) as { Producer?: string; Creator?: string };

  const morceaux: Morceau[] = [];
  for (let page = 1; page <= doc.numPages; page += 1) {
    const { items } = await (await doc.getPage(page)).getTextContent();
    for (const item of items) {
      const it = item as { str?: string; transform?: number[] };
      if (!it.str?.trim() || !it.transform) continue;
      morceaux.push({ page, x: it.transform[4], y: it.transform[5], texte: it.str });
    }
  }
  await doc.destroy();

  return {
    morceaux,
    pages: doc.numPages,
    producteur: info.Producer ?? info.Creator ?? 'inconnu',
  };
}

/**
 * Masque ce qui ressemble à une coordonnée bancaire, **avant** tout
 * enregistrement.
 *
 * Les libellés de relevé en sont pleins : « ABONNEMENT 4974XXXXXX4417 »,
 * « VIR FR76 3000 … ». La décision 3 du plan retient de garder les **quatre
 * derniers chiffres** : rien du tout empêcherait de distinguer deux cartes du
 * même foyer, et quatre chiffres seuls n'identifient aucun compte.
 *
 * Le masquage est fait ici, au plus tôt, et non à l'affichage : une donnée
 * masquée à l'écran mais enregistrée en clair n'est pas masquée.
 */
export function masquerIdentifiants(libelle: string): string {
  return libelle
    .replace(/\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]{4}){2,}/gi, (s) => `●●●● ${s.slice(-4)}`)
    .replace(/(?:\d[\s-]?){9,}/g, (s) => {
      const chiffres = s.replace(/\D/g, '');
      return `●●●● ${chiffres.slice(-4)}`;
    });
}
