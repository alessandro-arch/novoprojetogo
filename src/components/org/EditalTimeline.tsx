import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FilePen,
  Globe,
  Lock,
  SearchCheck,
  ListChecks,
  Trophy,
  ShieldCheck,
  Award,
  XCircle,
  Check,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import {
  WORKFLOW_PHASES,
  getAllowedTransitions,
  type DbEditalStatus,
  type WorkflowTransition,
} from "@/lib/edital-status";

/* ── Phase metadata ─────────────────────────────────────────── */

interface PhaseMeta {
  icon: LucideIcon;
  description: string;
}

const PHASE_META: Record<string, PhaseMeta> = {
  draft: {
    icon: FilePen,
    description:
      "Edital em elaboração. Configure título, datas, formulário e critérios de avaliação antes de publicar.",
  },
  published: {
    icon: Globe,
    description:
      "Edital publicado e visível para proponentes. Submissões são aceitas dentro do período definido.",
  },
  closed: {
    icon: Lock,
    description:
      "Período de submissões encerrado. Novas propostas estão bloqueadas.",
  },
  em_avaliacao: {
    icon: SearchCheck,
    description:
      "Propostas em avaliação cega pelos avaliadores designados. Pareceres técnicos em andamento.",
  },
  resultado_preliminar: {
    icon: ListChecks,
    description:
      "Resultado preliminar divulgado. Período aberto para recursos e contestações.",
  },
  resultado_final: {
    icon: Trophy,
    description:
      "Ranking final congelado após análise de recursos. Aguardando homologação oficial.",
  },
  homologado: {
    icon: ShieldCheck,
    description:
      "Resultado oficialmente homologado. Propostas aprovadas elegíveis para outorga.",
  },
  outorgado: {
    icon: Award,
    description:
      "Termos de outorga assinados. Projetos habilitados para execução financeira.",
  },
};

/* ── Audit entry type ───────────────────────────────────────── */

interface AuditEntry {
  action: string;
  created_at: string;
  user_id: string | null;
  user_role: string | null;
  metadata_json: any;
}

/* ── Props ──────────────────────────────────────────────────── */

interface Props {
  editalId: string;
  currentStatus: string;
  isCancelled: boolean;
  isGestor: boolean;
  startDate: string | null;
  endDate: string | null;
  allowedTransitions: WorkflowTransition[];
  onTransition: (t: WorkflowTransition) => void;
}

const EditalTimeline = ({
  editalId,
  currentStatus,
  isCancelled,
  isGestor,
  startDate,
  endDate,
  allowedTransitions,
  onTransition,
}: Props) => {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);

  const currentIndex = WORKFLOW_PHASES.findIndex(
    (p) => p.status === currentStatus
  );

  useEffect(() => {
    supabase
      .from("audit_logs")
      .select("action, created_at, user_id, user_role, metadata_json")
      .eq("entity", "edital")
      .eq("entity_id", editalId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setAuditLogs(data as AuditEntry[]);
      });
  }, [editalId, currentStatus]);

  const getPhaseAudit = (status: string) => {
    return auditLogs.filter((l) => {
      const meta = l.metadata_json as any;
      if (meta?.to_status === status) return true;
      if (status === "published" && l.action === "edital.insert") return false;
      if (
        status === "published" &&
        (l.action === "edital.published" || meta?.new_status === "published")
      )
        return true;
      return false;
    });
  };

  const formatDt = (dt: string) =>
    new Date(dt).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  const togglePhase = (status: string) => {
    setExpandedPhase((prev) => (prev === status ? null : status));
  };

  const getPhaseDate = (status: string, index: number): string | null => {
    // Try audit logs first
    const entries = getPhaseAudit(status);
    if (entries.length > 0) return entries[entries.length - 1].created_at;

    // Fallback for published
    if (status === "published" && startDate) return startDate;
    if (status === "closed" && endDate && currentIndex >= index) return endDate;
    return null;
  };

  if (isCancelled) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-destructive">
                Edital Cancelado
              </p>
              <p className="text-sm text-muted-foreground">
                Este edital foi cancelado e não pode mais avançar no workflow.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1">
      {WORKFLOW_PHASES.map((phase, i) => {
        const meta = PHASE_META[phase.status];
        const Icon = meta?.icon ?? FilePen;
        const isCompleted = currentIndex > i;
        const isCurrent = currentIndex === i;
        const isFuture = currentIndex < i;
        const isExpanded = expandedPhase === phase.status;
        const phaseDate = getPhaseDate(phase.status, i);

        // Transitions that originate from this phase
        const phaseTransitions = isCurrent
          ? allowedTransitions
          : [];

        return (
          <div key={phase.status}>
            {/* Phase row */}
            <button
              onClick={() => togglePhase(phase.status)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                isCurrent && "bg-primary/5 border border-primary/20",
                isCompleted && "hover:bg-accent/50",
                isFuture && "opacity-50",
                isExpanded && "rounded-b-none"
              )}
            >
              {/* Icon circle */}
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors",
                  isCompleted &&
                    "bg-emerald-500 border-emerald-500 text-white",
                  isCurrent &&
                    "bg-primary/10 border-primary text-primary",
                  isFuture && "bg-muted border-border text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              {/* Label + date */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-medium text-sm",
                      isCurrent && "text-primary font-semibold",
                      isCompleted && "text-foreground",
                      isFuture && "text-muted-foreground"
                    )}
                  >
                    {phase.label}
                  </span>
                  {isCurrent && (
                    <Badge
                      variant="default"
                      className="text-[10px] px-1.5 py-0"
                    >
                      Atual
                    </Badge>
                  )}
                  {isCompleted && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-600"
                    >
                      Concluído
                    </Badge>
                  )}
                </div>
                {phaseDate && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {formatDt(phaseDate)}
                  </span>
                )}
              </div>

              {/* Expand indicator */}
              <div className="text-muted-foreground">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {/* Expanded detail panel */}
            {isExpanded && (
              <div
                className={cn(
                  "px-4 pb-4 pt-2 rounded-b-lg border-x border-b space-y-3",
                  isCurrent
                    ? "border-primary/20 bg-primary/5"
                    : "border-border bg-muted/20"
                )}
              >
                {/* Description */}
                <p className="text-sm text-muted-foreground">
                  {meta?.description}
                </p>

                {/* Audit info */}
                {(() => {
                  const entries = getPhaseAudit(phase.status);
                  if (entries.length === 0) return null;
                  const last = entries[entries.length - 1];
                  return (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {last.user_role && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {last.user_role}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDt(last.created_at)}
                      </span>
                    </div>
                  );
                })()}

                {/* Contextual actions for gestor */}
                {isGestor && phaseTransitions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {phaseTransitions.map((t) => (
                      <Button
                        key={t.targetStatus}
                        size="sm"
                        variant={t.variant}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTransition(t);
                        }}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                )}

                {isFuture && (
                  <p className="text-xs text-muted-foreground italic">
                    Esta fase será habilitada após a conclusão da fase anterior.
                  </p>
                )}
              </div>
            )}

            {/* Connector line */}
            {i < WORKFLOW_PHASES.length - 1 && (
              <div className="flex justify-start pl-[1.375rem] py-0">
                <div
                  className={cn(
                    "w-0.5 h-2",
                    isCompleted ? "bg-emerald-500" : "bg-border"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EditalTimeline;
