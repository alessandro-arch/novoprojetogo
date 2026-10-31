import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { celula } from "@/lib/operon-chamadas";

describe("CSV do portal Operon: neutraliza injecao de formula", () => {
  it.each(["=SOMA(A1)", "+1", "-1", "@cmd", "\tabc"])("prefixa %j com apostrofo", (v) => {
    expect(celula(v).startsWith("'")).toBe(true);
  });
  it("mantem texto comum e aplica aspas quando ha separador", () => {
    expect(celula("Edital 34/2026")).toBe("Edital 34/2026");
    expect(celula('a;b "c"')).toBe('"a;b ""c"""');
  });
  it("neutraliza e depois escapa aspas", () => {
    expect(celula('=HYPERLINK("x";"y")')).toBe('"\'=HYPERLINK(""x"";""y"")"');
  });
});

describe("Edge Functions que montam HTML devem usar escapeHtml", () => {
  const dir = join(process.cwd(), "supabase/functions");
  const comHtml = readdirSync(dir).filter((f) => {
    const p = join(dir, f, "index.ts");
    return existsSync(p) && /html:\s*`|<!DOCTYPE html>|<html/.test(readFileSync(p, "utf8"));
  });
  it("encontra as funcoes que geram HTML", () => {
    expect(comHtml.length).toBeGreaterThan(0);
  });
  // sd-notify e sd-invite-staff e sd-password-reset usam o helper local esc(); as demais devem importar o compartilhado.
  it.each(comHtml)("%s escapa interpolacoes", (f) => {
    const src = readFileSync(join(dir, f, "index.ts"), "utf8");
    expect(/escapeHtml|const esc\s*=/.test(src)).toBe(true);
  });
});
