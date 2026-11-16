import jsPDF from "jspdf";

export interface PdfLista {
  titulo: string;
  contexto?: string;
  filtros?: string;
  colunas: { titulo: string; largura: number }[];
  linhas: string[][];
}

/** Data e hora de Brasília para o cabeçalho do relatório. */
export const agoraBrasilia = (d = new Date()) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Nome do arquivo: servicedesk-<titulo>-AAAA-MM-DD.pdf, sem acentos nem espaços. */
export const nomeArquivoPdf = (titulo: string, d = new Date()) => {
  const slug = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const dia = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `servicedesk-${slug || "lista"}-${dia}.pdf`;
};

const PW = 297, PH = 210, M = 12, CW = PW - 2 * M, LH = 4;

/** Monta um PDF A4 paisagem com a lista exatamente como está na tela (somente leitura). */
export function montarPdfLista(l: PdfLista, agora = new Date()) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const total = l.colunas.reduce((s, c) => s + c.largura, 0);
  const larg = l.colunas.map((c) => (c.largura / total) * CW);
  let y = M;

  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(l.titulo, M, y + 4); y += 9;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
  const meta = [l.contexto, `Gerado em ${agoraBrasilia(agora)} (horário de Brasília)`, `${l.linhas.length} registro(s)`].filter(Boolean).join("  ·  ");
  doc.text(meta, M, y); y += 5;
  if (l.filtros) { const f = doc.splitTextToSize(`Filtros: ${l.filtros}`, CW); doc.text(f, M, y); y += f.length * LH + 1; }
  doc.setTextColor(0); y += 2;

  const cabecalho = () => {
    doc.setFillColor(235, 238, 243); doc.rect(M, y, CW, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    let x = M;
    l.colunas.forEach((c, i) => { doc.text(c.titulo, x + 1.5, y + 4.8); x += larg[i]; });
    y += 7; doc.setFont("helvetica", "normal");
  };
  cabecalho();

  if (!l.linhas.length) { doc.setFontSize(9); doc.text("Nenhum registro.", M + 1.5, y + 6); }
  for (const linha of l.linhas) {
    doc.setFontSize(8);
    const celulas = linha.map((v, i) => doc.splitTextToSize(v || "-", larg[i] - 3) as string[]);
    const h = Math.max(...celulas.map((c) => c.length)) * LH + 3;
    if (y + h > PH - M - 6) { doc.addPage(); y = M; cabecalho(); doc.setFontSize(8); }
    let x = M;
    celulas.forEach((c, i) => { doc.text(c, x + 1.5, y + 4); x += larg[i]; });
    y += h;
    doc.setDrawColor(220); doc.line(M, y, M + CW, y);
  }

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(130);
    doc.text(`ProjetoGO Service Desk  ·  ${l.titulo}  ·  Página ${p} de ${paginas}`, PW / 2, PH - 6, { align: "center" });
  }
  doc.setTextColor(0);
  return doc;
}

export const baixarPdfLista = (l: PdfLista) => montarPdfLista(l).save(nomeArquivoPdf(l.titulo));
