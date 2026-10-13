/**
 * Fabrique un PDF minimal, pour éprouver la chaîne de lecture.
 *
 * Pas une bibliothèque : une centaine de lignes qui posent du texte à des
 * coordonnées choisies. C'est ce qu'il faut pour vérifier que l'adaptateur
 * pdf.js, son *worker* et l'analyseur se parlent — et rien de plus. Les
 * relevés réels ayant été effacés, cette fabrique est ce qui permet de
 * rejouer leur géométrie sans les conserver.
 */
const echapper = (s) => s.replace(/([\\()])/g, '\\$1');

/** `pages` : un tableau de tableaux de `{ x, y, texte }`. */
export function pdfMinimal(pages) {
  const objets = [];
  const ajouter = (corps) => {
    objets.push(corps);
    return objets.length; // numéro d'objet, 1-indexé
  };

  const police = ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const numerosDePage = [];
  const contenus = [];

  for (const morceaux of pages) {
    const flux =
      'BT\n' +
      morceaux
        .map(
          (m) =>
            `/F1 9 Tf\n1 0 0 1 ${m.x.toFixed(2)} ${m.y.toFixed(2)} Tm\n(${echapper(m.texte)}) Tj`,
        )
        .join('\n') +
      '\nET';
    contenus.push(flux);
  }

  /* Les pages référencent l'objet « Pages », dont le numéro n'est connu
     qu'après : on réserve donc sa place en le créant en dernier et en
     calculant son numéro à l'avance. */
  const premierePage = objets.length + 1;
  const numeroPages = premierePage + pages.length * 2;

  for (const [i, flux] of contenus.entries()) {
    const contenu = ajouter(`<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`);
    numerosDePage.push(
      ajouter(
        `<< /Type /Page /Parent ${numeroPages} 0 R /MediaBox [0 0 595 842] ` +
          `/Resources << /Font << /F1 ${police} 0 R >> >> /Contents ${contenu} 0 R >>`,
      ),
    );
    void i;
  }

  ajouter(
    `<< /Type /Pages /Kids [${numerosDePage.map((n) => `${n} 0 R`).join(' ')}] ` +
      `/Count ${numerosDePage.length} >>`,
  );
  const catalogue = ajouter(`<< /Type /Catalog /Pages ${numeroPages} 0 R >>`);
  const info = ajouter('<< /Producer (Cyclades essais 1.0) >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, corps] of objets.entries()) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${corps}\nendobj\n`;
  }
  const debutXref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objets.length + 1} /Root ${catalogue} 0 R /Info ${info} 0 R >>\n` +
    `startxref\n${debutXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/** Un relevé d'essai à la géométrie mesurée sur les relevés réels. */
export function relevePdfDEssai() {
  const X = { date: 62, valeur: 98, libelle: 161, debit: 440, credit: 515 };
  const entete = (y) => [
    { x: 63, y, texte: 'Date' },
    { x: 98, y, texte: 'Date valeur' },
    { x: 161, y, texte: 'Operation' },
    { x: 409, y, texte: 'Debit EUROS' },
    { x: 480, y, texte: 'Credit EUROS' },
  ];
  const op = (y, jour, libelle, montant, debit) => [
    { x: X.date, y, texte: jour },
    { x: X.valeur, y, texte: jour },
    { x: X.libelle, y, texte: libelle },
    { x: debit ? X.debit : X.credit, y, texte: montant },
  ];
  return pdfMinimal([
    [
      { x: 57, y: 740, texte: 'C/C CONTRAT PERSONNEL PARCOURS.J+ N 00055347 en euros (GD)' },
      ...entete(720),
      ...op(700, '01/09/2026', 'PAIEMENT PSC TOURNAY', '3,10', true),
      ...op(688, '03/09/2026', 'VIR DE M ALEXIS POUSSET 4974123456784417', '225,00', false),
      ...op(676, '04/09/2026', 'PRLV SEPA PRIXTEL', '5,99', true),
      { x: 57, y: 660, texte: 'SOLDE CREDITEUR AU 31/08/2026' },
      { x: 515, y: 660, texte: '525,71' },
      { x: 57, y: 640, texte: 'Ref : 009 SOLDE CREDITEUR AU 30/09/2026' },
      { x: 515, y: 640, texte: '741,62' },
    ],
  ]);
}
