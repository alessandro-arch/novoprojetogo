// Níveis acadêmicos aceitos no Service Desk (o banco valida os mesmos valores).
export const SD_LEVELS = [
  { value: "graduacao", label: "Graduação" },
  { value: "mestrado", label: "Mestrado" },
  { value: "doutorado", label: "Doutorado" },
] as const;
export type SdLevel = (typeof SD_LEVELS)[number]["value"];

/** Reconhece o nível a partir de um texto já normalizado (minúsculas, sem acento, "_" no lugar de espaços). */
export const parseLevel = (n: string): SdLevel | null => {
  if (!n) return null;
  if (n.startsWith("mest") || n === "ms") return "mestrado";
  if (n.startsWith("dout") || n === "dr") return "doutorado";
  if (n.startsWith("grad") || n.startsWith("bacharel") || n.startsWith("licenciat") || n.startsWith("tecnolog")) return "graduacao";
  return null;
};

export const levelLabel = (v?: string | null) => SD_LEVELS.find((l) => l.value === v)?.label ?? (v || "-");
