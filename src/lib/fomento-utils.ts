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
  ensino: "Ensino",
  servicos: "Serviços",
  estagio_tecnico: "Estágio Técnico",
  participacao_evento: "Participação em Evento",
  publicacao: "Publicação",
};

export const NATUREZA_LABELS: Record<string, string> = {
  auxilio_financeiro: "Auxílio Financeiro",
  bolsa: "Bolsa",
};

export const VINCULO_LABELS: Record<string, string> = {
  ppg: "Programa de Pós-Graduação",
  graduacao: "Graduação",
  nenhum: "Nenhum",
};

export const FONTE_LABELS: Record<string, string> = {
  publica: "Pública",
  privada: "Privada",
};

export const MODALIDADE_LABELS: Record<string, string> = {
  ic: "Iniciação Científica",
  mestrado: "Mestrado",
  doutorado: "Doutorado",
  pos_doc: "Pós-Doutorado",
  apoio_tecnico: "Apoio Técnico",
  extensao: "Extensão",
};

export const BOLSISTA_STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
  concluido: "Concluído",
};

export const MODALIDADE_VALORES_SUGERIDOS: Record<string, number> = {
  ic: 500,
  mestrado: 3200,
  doutorado: 4500,
  pos_doc: 5200,
  apoio_tecnico: 0,
  extensao: 0,
};

export const PARCERIA_TIPO_LABELS: Record<string, string> = {
  contrato: "Contrato",
  convenio: "Convênio",
  acordo_cooperacao: "Acordo de Cooperação",
  termo_fomento: "Termo de Fomento",
};

export const PARCERIA_STATUS_LABELS: Record<string, string> = {
  em_negociacao: "Em Negociação",
  ativa: "Ativa",
  encerrada: "Encerrada",
  suspensa: "Suspensa",
};

export const TIPO_INSTITUICAO_LABELS: Record<string, string> = {
  publica_federal: "Pública Federal",
  publica_estadual: "Pública Estadual",
  privada: "Privada",
  internacional: "Internacional",
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
