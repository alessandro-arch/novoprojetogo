import { describe, expect, it } from "vitest";
import { resumirColetas, type ColetaRow, type FonteColeta } from "@/lib/operon-coletas";

const AGORA = new Date("2026-06-15T12:00:00Z").getTime();
const HORA = 3_600_000;
const fonte = (id: string): FonteColeta => ({ id, slug: id, nome: id.toUpperCase() });
let seq = 0;
const coleta = (fonte_id: string, horasAtras: number, ok: boolean | null, erro: string | null = null): ColetaRow => ({
  id: `c${seq++}`, fonte_id, iniciou_em: new Date(AGORA - horasAtras * HORA).toISOString(), terminou_em: null, ok, erro,
});

describe("saúde das coletas", () => {
  it("Ok: última bem-sucedida há menos de 36 horas e nenhuma falha seguida", () => {
    const [s] = resumirColetas([fonte("cnpq")], [coleta("cnpq", 2, true), coleta("cnpq", 10, true)], AGORA);
    expect(s.situacao).toBe("ok");
    expect(s.falhasSeguidas).toBe(0);
    expect(s.total).toBe(2);
    expect(s.falhas).toBe(0);
  });
  it("Atenção: última bem-sucedida passou de 36 horas", () => {
    const [s] = resumirColetas([fonte("cnpq")], [coleta("cnpq", 40, true)], AGORA);
    expect(s.situacao).toBe("atencao");
  });
  it("Atenção: 1 ou 2 falhas seguidas", () => {
    const [uma] = resumirColetas([fonte("cnpq")], [coleta("cnpq", 1, false, "timeout"), coleta("cnpq", 2, true)], AGORA);
    expect(uma.situacao).toBe("atencao");
    expect(uma.falhasSeguidas).toBe(1);
    const [duas] = resumirColetas([fonte("cnpq")], [coleta("cnpq", 1, false), coleta("cnpq", 2, false), coleta("cnpq", 3, true)], AGORA);
    expect(duas.situacao).toBe("atencao");
    expect(duas.falhasSeguidas).toBe(2);
  });
  it("Falha: 3 ou mais falhas seguidas, mesmo com sucesso antigo", () => {
    const [s] = resumirColetas([fonte("fapes")], [coleta("fapes", 1, false, "e1"), coleta("fapes", 2, false), coleta("fapes", 3, false), coleta("fapes", 4, true)], AGORA);
    expect(s.situacao).toBe("falha");
    expect(s.falhasSeguidas).toBe(3);
    expect(s.ultimoErro).toBe("e1");
  });
  it("Sem coleta registrada: fonte sem nenhuma coleta", () => {
    const [s] = resumirColetas([fonte("capes")], [], AGORA);
    expect(s.situacao).toBe("sem_coleta");
    expect(s.ultimaColeta).toBeNull();
    expect(s.ultimoOk).toBeNull();
  });
  it("falhas seguidas param na primeira coleta bem-sucedida", () => {
    const [s] = resumirColetas([fonte("cnpq")], [coleta("cnpq", 1, true), coleta("cnpq", 2, false), coleta("cnpq", 3, false)], AGORA);
    expect(s.situacao).toBe("ok");
    expect(s.falhasSeguidas).toBe(0);
    expect(s.falhas).toBe(2);
  });
  it("resume cada fonte de forma independente", () => {
    const lista = resumirColetas([fonte("cnpq"), fonte("capes")], [coleta("cnpq", 1, true)], AGORA);
    expect(lista.map(s => s.situacao)).toEqual(["ok", "sem_coleta"]);
  });
});
