import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { applyCors, withCors, parseAllowedOrigins, DEFAULT_ALLOWED_ORIGINS } from "../../supabase/functions/_shared/cors";

const permitidas = ["https://projetogo.lovable.app"];
const req = (origin?: string) => new Request("https://x.supabase.co/functions/v1/f", { headers: origin ? { Origin: origin } : {} });
const resp = () => new Response("ok", { status: 201, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "text/plain" } });

describe("CORS com lista de origens", () => {
  it("reflete a origem permitida e adiciona Vary", () => {
    const r = applyCors(req("https://projetogo.lovable.app"), resp(), permitidas);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("https://projetogo.lovable.app");
    expect(r.headers.get("Vary")).toContain("Origin");
    expect(r.status).toBe(201);
  });
  it("remove o cabecalho para origem fora da lista", () => {
    const r = applyCors(req("https://malicioso.example"), resp(), permitidas);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
  it("nao altera chamadas sem Origin (curl, servidor, Hermes)", () => {
    const r = applyCors(req(), resp(), permitidas);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  it("preserva corpo e demais cabecalhos", async () => {
    const r = applyCors(req("https://projetogo.lovable.app"), resp(), permitidas);
    expect(await r.text()).toBe("ok");
    expect(r.headers.get("Content-Type")).toBe("text/plain");
  });
  it("withCors envolve o handler (inclusive preflight)", async () => {
    const h = withCors(() => new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } }), permitidas);
    const ok = await h(new Request("https://x/f", { method: "OPTIONS", headers: { Origin: "https://projetogo.lovable.app" } }));
    const no = await h(new Request("https://x/f", { method: "OPTIONS", headers: { Origin: "https://outro.example" } }));
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://projetogo.lovable.app");
    expect(no.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
  it("ALLOWED_ORIGINS: usa a lista da variavel, com barras finais removidas; vazio cai no padrao", () => {
    expect(parseAllowedOrigins("https://a.com/, https://b.com")).toEqual(["https://a.com", "https://b.com"]);
    expect(parseAllowedOrigins("")).toEqual(DEFAULT_ALLOWED_ORIGINS);
    expect(parseAllowedOrigins(undefined)).toEqual(DEFAULT_ALLOWED_ORIGINS);
  });
});

describe("Toda Edge Function usa serveCors", () => {
  const dir = join(process.cwd(), "supabase/functions");
  const funcs = readdirSync(dir).filter((f) => existsSync(join(dir, f, "index.ts")));
  it.each(funcs)("%s", (f) => {
    const src = readFileSync(join(dir, f, "index.ts"), "utf8");
    expect(src).toContain('from "../_shared/cors.ts"');
    expect(/(?<![\w.])Deno\.serve\(|(?<![\w.])serve\(/.test(src)).toBe(false);
  });
});
