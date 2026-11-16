import { describe, it, expect } from "vitest";
import { montarPdfLista, nomeArquivoPdf } from "@/lib/sd-pdf";
import { applyFilters, emptyFilters, linhasSolicitacoesPdf, resumoFiltrosPdf, PDF_COLUNAS_SOLICITACOES } from "@/components/servicedesk/sd-ui";

const agora = new Date().toISOString();
const antiga = new Date(Date.now() - 10 * 864e5).toISOString();
const rows = [
  { id: "1", protocol: "SD-1", requester_name: "Ana", requester_enrollment: "111", requester_kind: "aluno", service_id: "vpn", sd_services: { name: "VPN CAPES" }, requester_program: "Biotecnologia", created_at: antiga, stage_entered_at: antiga, status: "em_analise", correction_cycle: 0 },
  { id: "2", protocol: "SD-2", requester_name: "Bia", requester_enrollment: "222", requester_kind: "aluno", service_id: "vpn", sd_services: { name: "VPN CAPES" }, created_at: agora, status: "concluido", correction_cycle: 0 },
  { id: "3", protocol: "SD-3", requester_name: "Caio", requester_enrollment: "333", requester_kind: "professor", service_id: "vpn", sd_services: { name: "VPN CAPES" }, created_at: agora, stage_entered_at: agora, status: "aprovado", correction_cycle: 1, resubmitted_at: agora },
];

describe("PDF das listas de pendentes do Service Desk", () => {
  it("o PDF de pendentes leva só as solicitações em aberto mostradas na tela", () => {
    const f = { ...emptyFilters, quick: "pendentes" as const };
    const linhas = linhasSolicitacoesPdf(applyFilters(rows, f));
    expect(linhas.map((l) => l[0])).toEqual(["SD-1", "SD-3"]);
  });

  it("marca solicitação parada há mais de 5 dias e correção recebida", () => {
    const [ana, , caio] = linhasSolicitacoesPdf(rows);
    expect(ana[6]).toContain("parada há mais de 5 dias");
    expect(ana[7]).toBe("Aguardando análise");
    expect(caio[7]).toContain("Correção recebida (#1)");
  });

  it("descreve os filtros usados", () => {
    expect(resumoFiltrosPdf(rows, { ...emptyFilters, quick: "pendentes", program: "Biotecnologia" })).toBe("Pendentes, programa Biotecnologia");
    expect(resumoFiltrosPdf(rows, emptyFilters)).toContain("nenhum");
  });

  it("gera um PDF com nome sem acentos e várias páginas quando a lista é longa", () => {
    expect(nomeArquivoPdf("Solicitações pendentes", new Date("2026-11-16T15:00:00Z"))).toBe("servicedesk-solicitacoes-pendentes-2026-11-16.pdf");
    const muitas = Array.from({ length: 80 }, (_, i) => ({ ...rows[0], id: String(i), protocol: `SD-${i}` }));
    const doc = montarPdfLista({ titulo: "Pendentes", colunas: PDF_COLUNAS_SOLICITACOES, linhas: linhasSolicitacoesPdf(muitas) });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
