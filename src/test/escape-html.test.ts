import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { escapeHtml, escapeJsonForHtml } from "@/lib/escape-html";
import {
  escapeHtml as escapeHtmlEdge,
  escapeJsonForHtml as escapeJsonForHtmlEdge,
} from "../../supabase/functions/_shared/escape-html";

const PAYLOADS = [
  `<script>alert(1)</script>`,
  `<img src=x onerror="alert(1)">`,
  `" onmouseover="alert(1)`,
  `'><svg/onload=alert(1)>`,
  `a & b < c > d`,
  `texto normal com acentuação: ção, é, ü`,
];

describe("escapeHtml", () => {
  it("neutraliza marcação perigosa", () => {
    for (const p of PAYLOADS) {
      const out = escapeHtml(p);
      expect(out).not.toMatch(/[<>"']/);
    }
    expect(escapeHtml(`<script>alert(1)</script>`)).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("preserva texto comum e trata valores vazios", () => {
    expect(escapeHtml("Edital 12/2026 - Pesquisa")).toBe("Edital 12/2026 - Pesquisa");
    expect(escapeHtml("ação")).toBe("ação");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });

  it("escapa o & primeiro, sem duplo escape de entidades já presentes no texto", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("escapeJsonForHtml não deixa tags passarem", () => {
    const out = escapeJsonForHtml({ k: `</pre><script>alert(1)</script>` });
    expect(out).not.toContain("<");
    expect(out).toContain("&lt;/pre&gt;");
  });

  it("a cópia das Edge Functions se comporta igual à do front-end", () => {
    for (const p of PAYLOADS) {
      expect(escapeHtmlEdge(p)).toBe(escapeHtml(p));
    }
    expect(escapeJsonForHtmlEdge({ a: PAYLOADS })).toBe(escapeJsonForHtml({ a: PAYLOADS }));
  });
});

describe("regressão: HTML gerado não interpola dados sem escape", () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, "../..", rel), "utf8");

  it("SubmissionForm escapa campos da proposta no PDF", () => {
    const full = read("src/components/proponente/SubmissionForm.tsx");
    expect(full).toContain('from "@/lib/escape-html"');
    // Só o trecho que gera HTML (mensagens de erro em texto puro, fora dele, não são HTML).
    const start = full.indexOf("const handleDownloadPdf");
    const end = full.indexOf("const renderField");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const src = full.slice(start, end);
    expect(src).not.toMatch(/\$\{q\.label\}/);
    expect(src).not.toMatch(/\$\{s\.title\}/);
    expect(src).not.toMatch(/\$\{s\.description\}/);
    expect(src).not.toMatch(/\$\{editalTitle\}/);
    expect(src).not.toMatch(/\$\{answerDisplay\}/);
    expect(src).not.toMatch(/\$\{\(submission as any\)\.protocol\}/);
  });

  it("finalize-proposal-submission escapa o HTML arquivado", () => {
    const src = read("supabase/functions/finalize-proposal-submission/index.ts");
    expect(src).toContain("../_shared/escape-html.ts");
    expect(src).not.toMatch(/\$\{editalTitle\}/);
    expect(src).not.toMatch(/\$\{submission\.protocol\}/);
    expect(src).not.toMatch(/\$\{key\}/);
  });

  it("export-audit-report escapa título, nome e diff", () => {
    const src = read("supabase/functions/export-audit-report/index.ts");
    expect(src).toContain("../_shared/escape-html.ts");
    expect(src).not.toMatch(/\$\{edital\.title\}/);
    expect(src).not.toMatch(/\$\{exporterProfile\?\.full_name/);
    expect(src).not.toMatch(/\$\{JSON\.stringify\(log\.diff/);
  });

  it("export-audit-logs escapa linhas do HTML e células do CSV", () => {
    const src = read("supabase/functions/export-audit-logs/index.ts");
    expect(src).toContain("../_shared/escape-html.ts");
    expect(src).not.toMatch(/<td>\$\{details\}<\/td>/);
    expect(src).toContain("csvCell");
  });
});
