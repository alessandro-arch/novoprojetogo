import { describe, it, expect } from "vitest";
import {
  SD_ORG_PRINCIPAL_KEY,
  idOrganizacaoPrincipal,
  ordenarOrganizacoes,
  organizacoesComPrincipal,
} from "@/lib/sd-org";

const UVV = { id: "u1", name: "UNIVERSIDADE VILA VELHA", sigla: "UVV" };
const ICCA = { id: "i1", name: "ICCA - Instituto de Inovação, Conhecimento e Ciências Aplicadas", sigla: "ICCA" };

describe("organização principal do Service Desk", () => {
  it("usa a chave de configuração service_desk_principal", () => {
    expect(SD_ORG_PRINCIPAL_KEY).toBe("service_desk_principal");
  });

  it("põe a instituição principal em primeiro lugar", () => {
    expect(ordenarOrganizacoes([ICCA, UVV], UVV.id).map((o) => o.sigla)).toEqual(["UVV", "ICCA"]);
  });

  it("mantém a ordem de nome quando não há principal marcada", () => {
    expect(ordenarOrganizacoes([UVV, ICCA], null).map((o) => o.sigla)).toEqual(["ICCA", "UVV"]);
  });

  it("não repete a instituição principal nem perde as demais", () => {
    const r = ordenarOrganizacoes([ICCA, UVV], UVV.id);
    expect(r).toHaveLength(2);
    expect(new Set(r.map((o) => o.id)).size).toBe(2);
  });

  it("reconhece apenas valor true como marca de principal", () => {
    expect(idOrganizacaoPrincipal([{ organization_id: UVV.id, value: true }])).toBe(UVV.id);
    expect(idOrganizacaoPrincipal([{ organization_id: UVV.id, value: false }])).toBeNull();
    expect(idOrganizacaoPrincipal([])).toBeNull();
    expect(idOrganizacaoPrincipal(null)).toBeNull();
  });

  it("consulta a marca e devolve a lista ordenada", async () => {
    const chamadas: any[] = [];
    const db = {
      from: (tabela: string) => ({
        select: () => ({
          in: (col: string, ids: string[]) => ({
            eq: (key: string, valor: string) => {
              chamadas.push({ tabela, col, ids, key, valor });
              return Promise.resolve({ data: [{ organization_id: UVV.id, value: true }] });
            },
          }),
        }),
      }),
    };
    const r = await organizacoesComPrincipal(db, [ICCA, UVV]);
    expect(r.orgs.map((o) => o.sigla)).toEqual(["UVV", "ICCA"]);
    expect(r.principalId).toBe(UVV.id);
    expect(chamadas[0]).toMatchObject({ tabela: "sd_settings", key: SD_ORG_PRINCIPAL_KEY });
    expect(chamadas[0].ids.sort()).toEqual([ICCA.id, UVV.id].sort());
  });

  it("não faz consulta nova quando há só uma instituição", async () => {
    let chamada = false;
    const db = { from: () => ({ select: () => { chamada = true; return { in: () => ({ eq: () => Promise.resolve({ data: [] }) }) }; } }) };
    const r = await organizacoesComPrincipal(db, [UVV]);
    expect(r.orgs.map((o) => o.sigla)).toEqual(["UVV"]);
    expect(r.principalId).toBeNull();
    expect(chamada).toBe(false);
  });
});
