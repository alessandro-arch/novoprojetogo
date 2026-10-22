import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import { checkOperonAccess, logoutOperon } from "@/lib/operon-access";
import { LogOut } from "lucide-react";

const OperonAccessGate = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const access = useQuery({
    queryKey: ["operon-access", user?.id],
    queryFn: () => user ? checkOperonAccess(user.id) : Promise.resolve(false),
    enabled: !!user,
    retry: false,
  });
  if (access.isLoading) return <div className="container max-w-lg py-12"><Skeleton className="h-32 w-full" /></div>;
  if (access.data === true) return <>{children}</>;
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <Placeholder title={access.isError ? "Erro ao verificar acesso" : "Acesso negado"}
          text={access.isError ? "Não foi possível verificar seu acesso ao Operon Fomento." : "Você não tem acesso ao Operon Fomento. Entre em contato com o administrador da sua instituição."} />
        {access.isError && <Button variant="outline" onClick={() => access.refetch()}>Tentar novamente</Button>}
        <Button variant="outline" onClick={() => logoutOperon(navigate).catch(() => toast({ title: "Erro ao sair", description: "Não foi possível encerrar sua sessão. Tente novamente.", variant: "destructive" }))}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
      </div>
    </main>
  );
};

export default OperonAccessGate;