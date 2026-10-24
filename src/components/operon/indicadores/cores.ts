/** Cores de fonte vêm dos mesmos tokens dos selos; fontes novas usam um tom neutro. */
const TOKENS: Record<string, string> = { cnpq: "--fonte-cnpq", fapes: "--fonte-fapes", capes: "--fonte-capes" };
export const corFonte = (slug: string) => `hsl(var(${TOKENS[slug] ?? "--muted-foreground"}))`;
export const corEsfera = (esfera: string) => esfera === "nacional" ? "hsl(var(--primary))" : esfera === "estadual" ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))";
