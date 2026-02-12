import { cn } from "@/lib/utils";
import { WORKFLOW_PHASES, type DbEditalStatus } from "@/lib/edital-status";
import { Check } from "lucide-react";

interface Props {
  currentStatus: string;
  isCancelled?: boolean;
}

const EditalWorkflowStepper = ({ currentStatus, isCancelled }: Props) => {
  const currentIndex = WORKFLOW_PHASES.findIndex((p) => p.status === currentStatus);

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
        <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
          <span className="text-destructive-foreground text-xs font-bold">✕</span>
        </div>
        <span className="text-sm font-medium text-destructive">Edital Cancelado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {WORKFLOW_PHASES.map((phase, i) => {
        const isCompleted = currentIndex > i;
        const isCurrent = currentIndex === i;
        const isFuture = currentIndex < i;

        return (
          <div key={phase.status} className="flex items-center">
            <div className="flex flex-col items-center gap-1 min-w-[80px]">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "bg-primary/10 border-primary text-primary",
                  isFuture && "bg-muted border-border text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] text-center leading-tight",
                  isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {phase.label}
              </span>
            </div>
            {i < WORKFLOW_PHASES.length - 1 && (
              <div
                className={cn(
                  "w-6 h-0.5 mt-[-14px]",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EditalWorkflowStepper;
