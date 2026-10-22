import { extractPDFBatch } from "./pdf.ts";
// Minimal valid ASCII PDF fixture; no extra runtime or test dependencies.
function fixture(count: number, blank = false) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${count} /Kids [${Array.from({ length: count }, (_, i) => `${4 + i * 2} 0 R`).join(" ")}] >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  for (let i = 0; i < count; i++) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    const stream = blank ? "" : `BT /F1 12 Tf 50 700 Td (Pagina ${i + 1}. Pesquisa em instituicoes publicas.) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

Deno.test("PDF real: lote limitado a quatro páginas, mantém texto final e PDF vazio", async () => {
  const bytes = fixture(6);
  const first = await extractPDFBatch(bytes.slice(), 1);
  if (first.next !== 5 || first.totalPages !== 6 || !first.text.includes("Pagina 4") || first.text.includes("Pagina 5")) throw new Error("Lote incorreto");
  const last = await extractPDFBatch(bytes.slice(), 5);
  if (last.next !== null || !last.text.includes("Pagina 6")) throw new Error("Texto final ausente");
  const empty = await extractPDFBatch(fixture(1, true), 1);
  if (empty.text.trim()) throw new Error("Texto inventado em PDF vazio");
});