import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { destinoPainelGlobal } from "@/lib/admin-portais";

export default function AdminReturnLink({ onNavigate }: { onNavigate?: (action: () => void) => void }) {
  const { user, loading, globalRole } = useAuth();
  const navigate = useNavigate();
  const destino = destinoPainelGlobal(!!user, loading, globalRole);
  if (!destino) return null;
  const conteudo = <><ArrowLeft className="h-4 w-4 shrink-0" /><span>Painel Superadmin</span></>;
  if (onNavigate) return <Button variant="ghost" size="sm" className="min-h-11 gap-2" onClick={() => onNavigate(() => navigate(destino))}>{conteudo}</Button>;
  return <Button asChild variant="ghost" size="sm" className="min-h-11 gap-2"><Link to={destino}>{conteudo}</Link></Button>;
}