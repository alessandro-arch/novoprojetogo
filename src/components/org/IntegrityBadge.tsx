import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Clock } from "lucide-react";

interface IntegrityBadgeProps {
  status: string | null | undefined;
  className?: string;
}

const IntegrityBadge = ({ status, className }: IntegrityBadgeProps) => {
  if (status === "VERIFIED") {
    return (
      <Badge variant="default" className={`bg-green-600 hover:bg-green-700 text-white gap-1 ${className || ""}`}>
        <ShieldCheck className="w-3.5 h-3.5" />
        Integridade verificada
      </Badge>
    );
  }

  if (status === "MISMATCH") {
    return (
      <Badge variant="destructive" className={`gap-1 ${className || ""}`}>
        <ShieldAlert className="w-3.5 h-3.5" />
        Integridade comprometida
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={`gap-1 ${className || ""}`}>
      <Clock className="w-3.5 h-3.5" />
      Pendente
    </Badge>
  );
};

export default IntegrityBadge;
