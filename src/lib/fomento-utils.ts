/** Format number as BRL currency: R$ 1.250.000,00 */
export const formatBRL = (value: number | null | undefined): string => {
  if (value == null) return "R$ 0,00";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

/** Format date string or Date to DD/MM/AAAA */
export const formatDateBR = (date: string | Date | null | undefined): string => {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date + (date.length === 10 ? "T12:00:00" : "")) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/** Calculate days remaining from today to a future date */
export const daysRemaining = (dateStr: string | null | undefined): number | null => {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T23:59:59");
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

/** Status labels in Portuguese */
export const STATUS_LABELS: Record<string, string> = {
  em_execucao: "Em execução",
  concluido: "Concluído",
  prestacao_contas: "Prestação de Contas",
  inadimplente: "Inadimplente",
};

export const AREA_LABELS: Record<string, string> = {
  pesquisa: "Pesquisa",
  inovacao: "Inovação",
  extensao: "Extensão",
  servicos: "Serviços",
};

export const FONTE_LABELS: Record<string, string> = {
  publica: "Pública",
  privada: "Privada",
};

export const TIPO_DOC_LABELS: Record<string, string> = {
  termo_outorga: "Termo de Outorga",
  termo_parceria: "Termo de Parceria",
  aditivo: "Aditivo",
  relatorio_parcial: "Relatório Parcial",
  relatorio_final: "Relatório Final",
  prestacao_contas: "Prestação de Contas",
  publicacao: "Publicação",
  outro: "Outro",
};

/** Format file size in KB or MB */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
