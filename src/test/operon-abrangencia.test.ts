import { describe, expect, it } from "vitest";
import { correspondeAbrangencia } from "@/components/operon/AbrangenciaBadge";

describe("Filtro de abrangência", () => {
  it("Todas inclui os três valores e null", () => {
    for (const valor of ["estadual", "nacional", "internacional", null]) {
      expect(correspondeAbrangencia(valor, "__none__")).toBe(true);
    }
  });
  it.each(["estadual", "nacional", "internacional"])("%s inclui apenas a abrangência selecionada", (filtro) => {
    expect(correspondeAbrangencia(filtro, filtro)).toBe(true);
    for (const valor of ["estadual", "nacional", "internacional", null].filter((v) => v !== filtro)) {
      expect(correspondeAbrangencia(valor, filtro)).toBe(false);
    }
  });
  it("A definir inclui null e exclui valores definidos", () => {
    expect(correspondeAbrangencia(null, "a_definir")).toBe(true);
    for (const valor of ["estadual", "nacional", "internacional"]) {
      expect(correspondeAbrangencia(valor, "a_definir")).toBe(false);
    }
  });
});