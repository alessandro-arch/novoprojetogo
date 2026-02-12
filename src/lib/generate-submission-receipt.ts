import jsPDF from "jspdf";

interface ReceiptData {
  protocol: string;
  editalTitle: string;
  proponenteName: string;
  proponenteEmail: string;
  proponenteCpf?: string;
  cnpqArea?: string;
  submittedAt: string;
  submissionId: string;
}

const PW = 210;
const PH = 297;
const ML = 25;
const MR = 25;
const MT = 30;
const MB = 30;
const CW = PW - ML - MR;

export function generateSubmissionReceipt(data: ReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MT;

  const addFooter = (page: number) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140);
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(ML, PH - 20, PW - MR, PH - 20);
    doc.text("Este documento é gerado automaticamente e possui validade como comprovante de submissão.", PW / 2, PH - 16, { align: "center" });
    doc.text(`ID: ${data.submissionId}  |  Página ${page}`, PW / 2, PH - 12, { align: "center" });
    doc.setTextColor(0);
  };

  // === HEADER BAR ===
  doc.setFillColor(20, 50, 100);
  doc.rect(0, 0, PW, 18, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);
  doc.text("RECIBO DE SUBMISSÃO DE PROPOSTA", PW / 2, 12, { align: "center" });
  doc.setTextColor(0);
  y = 28;

  // === SUBTITLE ===
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text("Plataforma ProjetoGO — Comprovante Oficial de Protocolo", PW / 2, y, { align: "center" });
  y += 10;

  // === SEPARATOR ===
  doc.setDrawColor(20, 50, 100);
  doc.setLineWidth(0.6);
  doc.line(ML, y, PW - MR, y);
  y += 10;

  // === PROTOCOL BOX ===
  doc.setDrawColor(20, 50, 100);
  doc.setLineWidth(0.8);
  doc.roundedRect(ML, y, CW, 28, 3, 3, "S");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text("NÚMERO DE PROTOCOLO", PW / 2, y + 8, { align: "center" });
  doc.setFontSize(18);
  doc.setFont("courier", "bold");
  doc.setTextColor(20, 50, 100);
  doc.text(data.protocol || "—", PW / 2, y + 20, { align: "center" });
  doc.setTextColor(0);
  y += 36;

  // === DATA TABLE ===
  const fields = [
    { label: "Data e Hora da Submissão", value: data.submittedAt },
    { label: "Proponente", value: data.proponenteName },
    { label: "E-mail", value: data.proponenteEmail },
  ];
  if (data.proponenteCpf) {
    fields.push({ label: "CPF", value: data.proponenteCpf });
  }
  if (data.cnpqArea) {
    fields.push({ label: "Área do Conhecimento (CNPq)", value: data.cnpqArea });
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DA SUBMISSÃO", ML, y);
  y += 6;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);

  for (const field of fields) {
    // Row background
    doc.setFillColor(245, 247, 250);
    doc.rect(ML, y - 4, CW, 10, "F");
    doc.line(ML, y + 6, PW - MR, y + 6);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60);
    doc.text(field.label, ML + 3, y + 2);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    const valLines = doc.splitTextToSize(field.value || "—", CW / 2 - 5);
    doc.text(valLines[0], PW / 2 + 5, y + 2);
    y += 10;
  }

  y += 6;

  // === EDITAL ===
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("EDITAL", ML, y);
  y += 6;

  doc.setFillColor(245, 247, 250);
  doc.rect(ML, y - 4, CW, 14, "F");
  doc.setDrawColor(200);
  doc.line(ML, y + 10, PW - MR, y + 10);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const editalLines = doc.splitTextToSize(data.editalTitle, CW - 6);
  doc.text(editalLines, ML + 3, y + 2);
  y += Math.max(14, editalLines.length * 5 + 6);

  y += 10;

  // === LEGAL TEXT ===
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DECLARAÇÃO", ML, y);
  y += 7;

  const legalTexts = [
    `Certificamos que a proposta identificada pelo protocolo ${data.protocol || "N/A"} foi recebida com sucesso pela plataforma ProjetoGO na data e horário indicados acima.`,
    `Este documento serve como comprovante oficial de submissão da proposta ao edital "${data.editalTitle}", devendo ser guardado pelo proponente para fins de registro e eventual consulta futura.`,
    `A submissão da proposta implica na aceitação integral das condições estabelecidas no edital, incluindo prazos, critérios de avaliação e demais disposições regulamentares.`,
    `O conteúdo da proposta submetida não poderá ser alterado após o encerramento do prazo de submissão, salvo disposição expressa em contrário prevista no edital.`,
    `Em caso de dúvidas ou necessidade de esclarecimentos, o proponente deverá entrar em contato com a instituição responsável pelo edital, apresentando este comprovante de protocolo.`,
  ];

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);

  for (const para of legalTexts) {
    const lines = doc.splitTextToSize(para, CW);
    for (const line of lines) {
      if (y + 5 > PH - MB) {
        addFooter(1);
        doc.addPage();
        y = MT;
      }
      doc.text(line, ML, y);
      y += 4.5;
    }
    y += 3;
  }

  y += 8;

  // === SIGNATURE LINE ===
  if (y + 30 > PH - MB) {
    addFooter(1);
    doc.addPage();
    y = MT;
  }

  doc.setDrawColor(100);
  doc.setLineWidth(0.4);
  const sigX = PW / 2 - 35;
  doc.line(sigX, y, sigX + 70, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text("Plataforma ProjetoGO", PW / 2, y, { align: "center" });
  y += 4;
  doc.text("Sistema de Gestão de Editais e Projetos", PW / 2, y, { align: "center" });

  addFooter(doc.getNumberOfPages());

  doc.save(`Recibo_${data.protocol || "submissao"}.pdf`);
}
