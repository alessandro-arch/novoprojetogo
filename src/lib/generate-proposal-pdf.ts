import jsPDF from "jspdf";

interface PdfSection {
  title: string;
  description?: string;
  questions: {
    label: string;
    isRequired?: boolean;
    answer: string;
  }[];
}

interface PdfData {
  editalTitle: string;
  proponenteName: string;
  proponenteEmail: string;
  protocol: string;
  submittedAt: string;
  cnpqArea?: string;
  submissionId: string;
  sections: PdfSection[];
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 25;
const MARGIN_BOTTOM = 25;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const MAX_Y = PAGE_HEIGHT - MARGIN_BOTTOM;

export function generateProposalPdf(data: PdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN_TOP;
  let pageNum = 1;

  const checkPage = (needed: number) => {
    if (y + needed > MAX_Y) {
      drawFooter(doc, pageNum, data.submissionId);
      doc.addPage();
      pageNum++;
      y = MARGIN_TOP;
    }
  };

  // === HEADER ===
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(data.editalTitle, CONTENT_WIDTH);
  doc.text(titleLines, PAGE_WIDTH / 2, y, { align: "center" });
  y += titleLines.length * 7 + 4;

  doc.setDrawColor(50);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 8;

  // Header info
  const headerItems = [
    { label: "Proponente", value: data.proponenteName },
    { label: "Email", value: data.proponenteEmail },
    { label: "Protocolo", value: data.protocol },
    { label: "Data de Submissão", value: data.submittedAt },
  ];
  if (data.cnpqArea) {
    headerItems.push({ label: "Área CNPq", value: data.cnpqArea });
  }

  doc.setFontSize(10);
  for (const item of headerItems) {
    checkPage(6);
    doc.setFont("helvetica", "bold");
    doc.text(`${item.label}: `, MARGIN_LEFT, y);
    const labelWidth = doc.getTextWidth(`${item.label}: `);
    doc.setFont("helvetica", "normal");
    const valLines = doc.splitTextToSize(item.value || "—", CONTENT_WIDTH - labelWidth);
    doc.text(valLines, MARGIN_LEFT + labelWidth, y);
    y += valLines.length * 5 + 2;
  }

  y += 4;
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 8;

  // === SECTIONS ===
  for (const section of data.sections) {
    // Section title
    checkPage(16);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 60, 120);
    const secTitleLines = doc.splitTextToSize(section.title, CONTENT_WIDTH);
    doc.text(secTitleLines, MARGIN_LEFT, y);
    y += secTitleLines.length * 6 + 2;

    doc.setDrawColor(30, 60, 120);
    doc.setLineWidth(0.4);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
    y += 4;

    if (section.description) {
      checkPage(8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100);
      const descLines = doc.splitTextToSize(section.description, CONTENT_WIDTH);
      for (const line of descLines) {
        checkPage(5);
        doc.text(line, MARGIN_LEFT, y);
        y += 4;
      }
      y += 3;
    }

    doc.setTextColor(0);

    // Questions
    for (const q of section.questions) {
      checkPage(12);

      // Label
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      const labelText = q.label + (q.isRequired ? " *" : "");
      const labelLines = doc.splitTextToSize(labelText, CONTENT_WIDTH);
      for (const line of labelLines) {
        checkPage(5);
        doc.text(line, MARGIN_LEFT, y);
        y += 5;
      }

      // Answer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const answerText = q.answer || "—";

      // Check if answer contains table-like data (budget module)
      if (answerText.includes("\n") && answerText.includes("|")) {
        const tableLines = answerText.split("\n");
        for (const tl of tableLines) {
          checkPage(5);
          const trimmed = tl.trim();
          if (trimmed.startsWith("|")) {
            // Table row
            doc.setFontSize(8);
            const cells = trimmed.split("|").filter(Boolean).map(c => c.trim());
            const cellWidth = CONTENT_WIDTH / Math.max(cells.length, 1);
            for (let i = 0; i < cells.length; i++) {
              const cellLines = doc.splitTextToSize(cells[i], cellWidth - 2);
              doc.text(cellLines[0] || "", MARGIN_LEFT + i * cellWidth + 1, y);
            }
            y += 5;
            doc.setFontSize(10);
          } else if (trimmed) {
            const wLines = doc.splitTextToSize(trimmed, CONTENT_WIDTH);
            for (const wl of wLines) {
              checkPage(5);
              doc.text(wl, MARGIN_LEFT, y);
              y += 5;
            }
          }
        }
      } else {
        // Regular text - split into lines for long content
        const ansLines = doc.splitTextToSize(answerText, CONTENT_WIDTH);
        for (const line of ansLines) {
          checkPage(5);
          doc.text(line, MARGIN_LEFT, y);
          y += 5;
        }
      }

      y += 4;
    }

    y += 4;
  }

  // Final footer on last page
  drawFooter(doc, pageNum, data.submissionId);

  doc.save(`Proposta_${data.protocol || "sem-protocolo"}.pdf`);
}

function drawFooter(doc: jsPDF, pageNum: number, submissionId: string) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150);
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, PAGE_HEIGHT - 18, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 18);
  doc.text("Documento gerado automaticamente pela plataforma ProjetoGO", PAGE_WIDTH / 2, PAGE_HEIGHT - 14, { align: "center" });
  doc.text(`ID: ${submissionId}  |  Página ${pageNum}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: "center" });
  doc.setTextColor(0);
}
