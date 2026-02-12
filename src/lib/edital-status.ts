/**
 * Computes the display status of an edital based on its DB status and dates.
 *
 * DB statuses map directly to display labels except for "published" which
 * is further refined by date:
 *   - "Agendado" = published but before start_date
 *   - "Aberto"   = published and within start_date..end_date
 *   - "Encerrado" = published and past end_date
 */
export type ComputedEditalStatus =
  | "Rascunho"
  | "Agendado"
  | "Aberto"
  | "Encerrado"
  | "Em Avaliação"
  | "Resultado Preliminar"
  | "Resultado Final"
  | "Homologado"
  | "Outorgado"
  | "Cancelado";

/** All DB-level status values */
export type DbEditalStatus =
  | "draft"
  | "published"
  | "closed"
  | "em_avaliacao"
  | "resultado_preliminar"
  | "resultado_final"
  | "homologado"
  | "outorgado"
  | "cancelado";

const DB_TO_DISPLAY: Record<string, ComputedEditalStatus> = {
  draft: "Rascunho",
  closed: "Encerrado",
  em_avaliacao: "Em Avaliação",
  resultado_preliminar: "Resultado Preliminar",
  resultado_final: "Resultado Final",
  homologado: "Homologado",
  outorgado: "Outorgado",
  cancelado: "Cancelado",
};

export function getComputedStatus(
  dbStatus: string,
  startDate: string | null,
  endDate: string | null
): ComputedEditalStatus {
  const mapped = DB_TO_DISPLAY[dbStatus];
  if (mapped) return mapped;

  // published — refine by dates
  const now = new Date();
  if (startDate && new Date(startDate) > now) return "Agendado";
  if (endDate && new Date(endDate) < now) return "Encerrado";
  return "Aberto";
}

export function getStatusVariant(status: ComputedEditalStatus) {
  switch (status) {
    case "Rascunho":
      return "outline" as const;
    case "Agendado":
    case "Encerrado":
      return "secondary" as const;
    case "Aberto":
    case "Em Avaliação":
      return "default" as const;
    case "Resultado Preliminar":
    case "Resultado Final":
      return "secondary" as const;
    case "Homologado":
    case "Outorgado":
      return "default" as const;
    case "Cancelado":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

/**
 * Whether the submission window is currently open for a given edital.
 */
export function isSubmissionOpen(
  dbStatus: string,
  startDate: string | null,
  endDate: string | null
): boolean {
  return getComputedStatus(dbStatus, startDate, endDate) === "Aberto";
}

/**
 * Allowed transitions from a given DB status.
 * Returns array of target DB statuses.
 */
export type WorkflowTransition = {
  targetStatus: DbEditalStatus;
  label: string;
  description: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  requiresInput?: "end_date" | "cancellation_reason";
};

export function getAllowedTransitions(
  dbStatus: string,
  startDate: string | null,
  endDate: string | null
): WorkflowTransition[] {
  const computed = getComputedStatus(dbStatus, startDate, endDate);

  switch (dbStatus) {
    case "draft":
      return [
        // Publish is handled separately with prerequisites
      ];

    case "published":
      if (computed === "Encerrado") {
        // Published but past end_date → can transition to em_avaliacao or reopen
        return [
          {
            targetStatus: "em_avaliacao",
            label: "Iniciar Avaliação",
            description: "Encerrar submissões e iniciar o processo de avaliação cega.",
            variant: "default",
          },
          {
            targetStatus: "published",
            label: "Reabrir Submissões",
            description: "Definir nova data de encerramento e reabrir para novas submissões.",
            variant: "outline",
            requiresInput: "end_date",
          },
          {
            targetStatus: "cancelado",
            label: "Cancelar Edital",
            description: "Cancelar permanentemente este edital com justificativa.",
            variant: "destructive",
            requiresInput: "cancellation_reason",
          },
        ];
      }
      // Published and still open or scheduled
      return [
        {
          targetStatus: "closed",
          label: "Encerrar Submissões",
          description: "Bloquear novas submissões imediatamente.",
          variant: "secondary",
        },
        {
          targetStatus: "cancelado",
          label: "Cancelar Edital",
          description: "Cancelar permanentemente este edital com justificativa.",
          variant: "destructive",
          requiresInput: "cancellation_reason",
        },
      ];

    case "closed":
      return [
        {
          targetStatus: "em_avaliacao",
          label: "Iniciar Avaliação",
          description: "Iniciar o processo de avaliação cega das propostas submetidas.",
          variant: "default",
        },
        {
          targetStatus: "published",
          label: "Reabrir Submissões",
          description: "Definir nova data de encerramento e reabrir para novas submissões.",
          variant: "outline",
          requiresInput: "end_date",
        },
        {
          targetStatus: "cancelado",
          label: "Cancelar Edital",
          description: "Cancelar permanentemente este edital com justificativa.",
          variant: "destructive",
          requiresInput: "cancellation_reason",
        },
      ];

    case "em_avaliacao":
      return [
        {
          targetStatus: "resultado_preliminar",
          label: "Publicar Resultado Preliminar",
          description: "Divulgar o resultado preliminar e abrir período de recurso.",
          variant: "default",
        },
        {
          targetStatus: "cancelado",
          label: "Cancelar Edital",
          description: "Cancelar permanentemente este edital com justificativa.",
          variant: "destructive",
          requiresInput: "cancellation_reason",
        },
      ];

    case "resultado_preliminar":
      return [
        {
          targetStatus: "resultado_final",
          label: "Publicar Resultado Final",
          description: "Congelar o ranking final após análise de recursos.",
          variant: "default",
        },
        {
          targetStatus: "cancelado",
          label: "Cancelar Edital",
          description: "Cancelar permanentemente este edital com justificativa.",
          variant: "destructive",
          requiresInput: "cancellation_reason",
        },
      ];

    case "resultado_final":
      return [
        {
          targetStatus: "homologado",
          label: "Homologar Resultado",
          description: "Homologar oficialmente o resultado. Propostas aprovadas ficam elegíveis para outorga.",
          variant: "default",
        },
        {
          targetStatus: "cancelado",
          label: "Cancelar Edital",
          description: "Cancelar permanentemente este edital com justificativa.",
          variant: "destructive",
          requiresInput: "cancellation_reason",
        },
      ];

    case "homologado":
      return [
        {
          targetStatus: "outorgado",
          label: "Registrar Outorga",
          description: "Confirmar que os termos de outorga foram assinados e habilitar execução dos projetos.",
          variant: "default",
        },
      ];

    case "outorgado":
    case "cancelado":
      return []; // Terminal states

    default:
      return [];
  }
}

/**
 * Workflow phase labels for the stepper UI.
 */
export const WORKFLOW_PHASES: { status: DbEditalStatus; label: string }[] = [
  { status: "draft", label: "Rascunho" },
  { status: "published", label: "Publicado" },
  { status: "closed", label: "Encerrado" },
  { status: "em_avaliacao", label: "Em Avaliação" },
  { status: "resultado_preliminar", label: "Resultado Preliminar" },
  { status: "resultado_final", label: "Resultado Final" },
  { status: "homologado", label: "Homologado" },
  { status: "outorgado", label: "Outorgado" },
];
