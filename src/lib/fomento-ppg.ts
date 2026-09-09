/**
 * Fonte única de verdade dos Programas de Pós-Graduação (PPG).
 *
 * Mestrado e Doutorado são NÍVEIS, não programas: nunca devem virar PPGs distintos.
 * A mesma regra existe no banco, na função SQL `public.normalize_ppg()`.
 */

export const PPG_CANONICOS = [
  "Segurança Pública",
  "Biotecnologia Vegetal",
  "Ciências Farmacêuticas",
  "Ciência Animal",
  "Arquitetura e Cidade",
  "Assistência Farmacêutica",
  "Sociologia Política",
] as const;

export type PpgCanonico = (typeof PPG_CANONICOS)[number];

export const SEM_PPG = "Sem PPG";

/** Remove acentos, pontuação, caixa e espaços duplicados */
const simplify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Correspondência determinística por palavras-chave e siglas conhecidas */
const MATCHERS: { ppg: PpgCanonico; keys: string[] }[] = [
  { ppg: "Segurança Pública", keys: ["seguranca publica", "ppgseg"] },
  { ppg: "Biotecnologia Vegetal", keys: ["biotecnologia vegetal"] },
  { ppg: "Assistência Farmacêutica", keys: ["assistencia farmaceutica"] },
  { ppg: "Ciências Farmacêuticas", keys: ["ciencias farmaceuticas", "ciencia farmaceutica", "ppgcf"] },
  { ppg: "Ciência Animal", keys: ["ciencia animal", "ciencias animais"] },
  { ppg: "Arquitetura e Cidade", keys: ["arquitetura e cidade", "arquitetura e cidades"] },
  { ppg: "Sociologia Política", keys: ["sociologia politica"] },
];

/**
 * Converte qualquer variação para o nome canônico do PPG.
 * - Vazio/nulo → null (registro sem vínculo com PPG).
 * - Nome não reconhecido → retorna o texto original (pendência para revisão manual),
 *   nunca é convertido silenciosamente em "Sem PPG".
 */
export const normalizePPG = (value: string | null | undefined): string | null => {
  if (!value || !value.trim()) return null;
  const simplified = simplify(value);
  for (const { ppg, keys } of MATCHERS) {
    if (keys.some((k) => simplified.includes(k))) return ppg;
  }
  return value.trim();
};

/** true quando o valor já é um dos 7 PPGs institucionais */
export const isPpgCanonico = (value: string | null | undefined): boolean =>
  !!value && (PPG_CANONICOS as readonly string[]).includes(value);

/** Rótulo para exibição: canônico, "Sem PPG" ou o texto original marcado como pendente */
export const ppgLabel = (value: string | null | undefined): string => {
  const n = normalizePPG(value);
  if (!n) return SEM_PPG;
  return n;
};

/** Nome não reconhecido que precisa de revisão manual */
export const isPpgPendente = (value: string | null | undefined): boolean => {
  const n = normalizePPG(value);
  return !!n && !isPpgCanonico(n);
};
