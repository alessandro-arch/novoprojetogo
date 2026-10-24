/**
 * CORS com lista de origens permitidas para as Edge Functions.
 *
 * Como funciona: cada funcao continua montando as suas respostas como antes; este modulo envolve o handler
 * e, em TODA resposta, troca "Access-Control-Allow-Origin: *" pela origem do pedido quando ela esta na lista
 * (e adiciona "Vary: Origin"). Se a origem nao esta na lista, o cabecalho e removido e o navegador bloqueia.
 * Clientes sem cabecalho Origin (curl, servidores, Hermes) nao sao afetados.
 *
 * Lista: ALLOWED_ORIGINS (variavel de ambiente da funcao, separada por virgulas) ou o padrao abaixo.
 */
export const DEFAULT_ALLOWED_ORIGINS = [
  "https://projetogo.lovable.app",
  "https://id-preview--1a559eba-0539-4eb6-b753-ea572e9cc56a.lovable.app",
  "https://projetogo.innovago.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

type DenoLike = { env?: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): unknown };
const denoGlobal = () => (globalThis as unknown as { Deno?: DenoLike }).Deno;

export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  const list = (raw ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ALLOWED_ORIGINS;
}

export function applyCors(req: Request, res: Response, allowed: string[]): Response {
  const origin = req.headers.get("Origin");
  const headers = new Headers(res.headers);
  if (origin) {
    if (allowed.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
    } else {
      headers.delete("Access-Control-Allow-Origin");
    }
    headers.append("Vary", "Origin");
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function withCors(
  handler: (req: Request) => Response | Promise<Response>,
  allowed?: string[],
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const list = allowed ?? parseAllowedOrigins(denoGlobal()?.env?.get("ALLOWED_ORIGINS"));
    return applyCors(req, await handler(req), list);
  };
}

/** Substitui Deno.serve(handler) / serve(handler). */
export function serveCors(handler: (req: Request) => Response | Promise<Response>) {
  return denoGlobal()!.serve(withCors(handler));
}
