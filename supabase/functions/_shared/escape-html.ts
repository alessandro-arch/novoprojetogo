/**
 * Escapa texto para uso seguro dentro de HTML (conteúdo de elemento ou valor de atributo entre aspas).
 * Mantenha este arquivo idêntico a src/lib/escape-html.ts
 * (há um teste que compara o comportamento dos dois).
 */
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Serializa um valor como JSON já escapado para HTML (por exemplo, dentro de <pre>). */
export function escapeJsonForHtml(value: unknown, space = 2): string {
  return escapeHtml(JSON.stringify(value, null, space) ?? "");
}
