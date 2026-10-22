import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { alterarSeguimento, carregarSeguidor } from "@/lib/operon-portal";

export default function SeguirEditalButton({ editalId }: { editalId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ["oe-seguidor", user?.id, editalId];
  const q = useQuery({ queryKey: key, enabled: !!user, queryFn: () => carregarSeguidor(editalId, user?.id ?? "") });
  const mutation = useMutation({
    mutationFn: () => alterarSeguimento(editalId, user?.id ?? "", !!q.data),
    onSuccess: (registro) => {
      qc.setQueryData(key, registro);
      qc.invalidateQueries({ queryKey: ["oe-seguidos", user?.id] });
      toast({ title: registro ? "Você está seguindo este edital" : "Você deixou de seguir este edital" });
    },
    onError: () => toast({ title: "Não foi possível atualizar o acompanhamento", description: "Tente novamente. Sua escolha anterior foi mantida.", variant: "destructive" }),
  });
  if (!user) return null;
  if (q.isLoading) return <Skeleton className="h-10 w-56" />;
  if (q.isError) return <div className="space-y-2"><p className="text-sm text-muted-foreground">Não foi possível consultar seu acompanhamento.</p><Button variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button></div>;
  return <div className="space-y-2 max-w-xl">
    <Button variant={q.data ? "secondary" : "default"} disabled={mutation.isPending} aria-pressed={!!q.data} onClick={() => mutation.mutate()}>
      {mutation.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : q.data ? <BellRing /> : <Bell />}
      {q.data ? "Seguindo este edital" : "Seguir este edital"}
    </Button>
    <p className="text-sm text-muted-foreground">{q.data ? "Você receberá por e-mail toda alteração, retificação, errata, novo anexo, resultado preliminar e resultado final. Deixe de seguir quando quiser." : "Siga para receber por e-mail todas as alterações deste edital e os resultados."}</p>
    <p className="text-xs text-muted-foreground">Avisos por Telegram em breve.</p>
  </div>;
}