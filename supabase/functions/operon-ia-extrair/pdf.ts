import { getDocumentProxy } from "npm:unpdf@1.4.0";
import { ExtractionError, MAX_TEXT_CHARS } from "./core.ts";

// Each batch runs in a separate edge invocation, not another Promise in the same isolate.
export const PDF_BATCH_PAGES = 4;
export async function extractPDFBatch(bytes: Uint8Array, start: number) {
  const pdf = await getDocumentProxy(bytes, { isEvalSupported: false, useSystemFonts: true });
  try {
    if (pdf.numPages > 200) throw new ExtractionError(413, "PDF excede o limite de 200 páginas.");
    if (start > pdf.numPages) throw new ExtractionError(400, "Página do PDF inválida.");
    const end = Math.min(start + PDF_BATCH_PAGES - 1, pdf.numPages);
    const texts: string[] = [];
    let size = 0;
    for (let number = start; number <= end; number++) {
      const page = await pdf.getPage(number);
      try {
        const content = await page.getTextContent();
        const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : "") : "").join("");
        size += text.length + 1;
        if (size > MAX_TEXT_CHARS) throw new ExtractionError(413, "Texto do PDF excede o limite de 120 mil caracteres.");
        texts.push(text);
      } finally { page.cleanup(); }
    }
    return { text: texts.join("\n"), next: end < pdf.numPages ? end + 1 : null, totalPages: pdf.numPages };
  } finally { await pdf.destroy(); }
}