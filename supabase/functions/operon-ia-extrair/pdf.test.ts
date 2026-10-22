import { extractPDFBatch } from "./pdf.ts";
import { PDFDocument, StandardFonts } from "npm:pdf-lib@1.17.1";

Deno.test("PDF real: lote limitado a quatro páginas, mantém texto final e PDF vazio", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 6; i++) pdf.addPage().drawText(`Pagina ${i}. Pesquisa em instituicoes publicas.`, { font });
  const bytes = await pdf.save();
  const first = await extractPDFBatch(bytes.slice(), 1);
  if (first.next !== 5 || first.totalPages !== 6 || !first.text.includes("Pagina 4") || first.text.includes("Pagina 5")) throw new Error("Lote incorreto");
  const last = await extractPDFBatch(bytes.slice(), 5);
  if (last.next !== null || !last.text.includes("Pagina 6")) throw new Error("Texto final ausente");
  const blank = await PDFDocument.create();
  blank.addPage();
  const empty = await extractPDFBatch(await blank.save(), 1);
  if (empty.text.trim()) throw new Error("Texto inventado em PDF vazio");
});