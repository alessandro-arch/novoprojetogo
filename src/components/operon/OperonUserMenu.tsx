import { useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, FileCheck2, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useModoVisualizacao } from "@/lib/view-as";
import { logoutOperon } from "@/lib/operon-access";
import { carregarNomeOperon, identidadeUsuarioOperon, nomeOperonSchema, papelUsuarioOperon, salvarNomeOperon } from "@/lib/operon-profile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function OperonUserMenu({ onNavigate }: { onNavigate?: (action: () => void) => void }) {
  const { user, globalRole, fomentoRole, simulando: authSimulando, loading } = useAuth();
  const modoVisualizacao = useModoVisualizacao();
  const bloqueado = modoVisualizacao || authSimulando;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const nomeQ = useQuery({ queryKey: ["oe-perfil-nome", user?.id], enabled: !!user, queryFn: () => carregarNomeOperon(user?.id ?? "") });
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const nomeId = useId();
  const focoAlertas = useRef<HTMLElement | null>(null);
  const { identidade, iniciais, semNome } = identidadeUsuarioOperon(nomeQ.data, user?.email);
  const abrirPerfil = () => { setNome(nomeQ.data ?? ""); setErro(""); setAberto(true); };
  const ir = (action: () => void) => onNavigate ? onNavigate(action) : action();
  const alertas = () => ir(() => {
    const cartao = document.getElementById("meus-alertas");
    if (!cartao) { navigate("/editais#meus-alertas"); return; }
    focoAlertas.current = cartao;
    cartao.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    cartao.focus({ preventScroll: true });
  });
  const sair = async () => {
    setSaindo(true);
    try { await logoutOperon(navigate); }
    catch { toast({ title: "Erro ao sair", description: "Não foi possível sair. Tente novamente.", variant: "destructive" }); }
    finally { setSaindo(false); }
  };
  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (bloqueado || salvando || !user) return;
    const validacao = nomeOperonSchema.safeParse(nome);
    if (!validacao.success) { setErro(validacao.error.issues[0]?.message ?? "Nome inválido."); return; }
    setErro(""); setSalvando(true);
    try {
      const atualizado = await salvarNomeOperon(validacao.data);
      qc.setQueryData(["oe-perfil-nome", user.id], atualizado);
      setAberto(false);
      toast({ title: "Nome atualizado" });
    } catch (error) {
      setErro(error instanceof Error && error.message === "Modo visualização" ? error.message : "Não foi possível salvar seu nome. Tente novamente.");
      toast({ title: "Não foi possível salvar o nome", variant: "destructive" });
    } finally { setSalvando(false); }
  };
  if (!user || loading) return null;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto min-h-11 max-w-56 gap-2 px-2" aria-label={`Menu do usuário: ${identidade}`}>
          <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{iniciais}</AvatarFallback></Avatar>
          <span className="hidden sm:block truncate text-sm">{identidade}</span><ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]" onCloseAutoFocus={event => {
        if (focoAlertas.current) {
          event.preventDefault();
          focoAlertas.current.focus({ preventScroll: true });
          focoAlertas.current = null;
        }
      }}>
        <DropdownMenuLabel className="space-y-1">
          <p className="break-words">{identidade}</p>
          <p className="break-words text-xs font-normal text-muted-foreground">{user.email}</p>
          <p className="text-xs font-normal text-muted-foreground">{papelUsuarioOperon(globalRole, fomentoRole)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={abrirPerfil} className="min-h-11 gap-2"><UserRound className="h-4 w-4 shrink-0" /><span>Meu perfil{!nomeQ.isLoading && !nomeQ.isError && semNome && <span className="block text-xs text-muted-foreground">Complete seu nome</span>}</span></DropdownMenuItem>
        {globalRole === "icca_admin" && <DropdownMenuItem onSelect={() => ir(() => navigate("/editais/curadoria"))} className="min-h-11 gap-2"><FileCheck2 className="h-4 w-4" />Curadoria</DropdownMenuItem>}
        <DropdownMenuItem onSelect={alertas} className="min-h-11 gap-2"><Bell className="h-4 w-4" />Meus alertas</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={saindo} onSelect={() => ir(() => { void sair(); })} className="min-h-11 gap-2"><LogOut className="h-4 w-4" />{saindo ? "Saindo..." : "Sair"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={aberto} onOpenChange={value => { if (!salvando) setAberto(value); }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl">
        <DialogHeader><DialogTitle>Meu perfil</DialogTitle><DialogDescription className="break-words">{user.email}</DialogDescription></DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          {bloqueado && <p role="status" className="text-sm text-muted-foreground">Modo visualização. Volte ao Superadmin para editar seu nome.</p>}
          {nomeQ.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar seu nome.<Button type="button" variant="link" onClick={() => nomeQ.refetch()}>Tentar novamente</Button></p>}
          <div className="space-y-2"><Label htmlFor={nomeId}>Nome completo</Label><Input id={nomeId} autoComplete="name" value={nome} disabled={bloqueado || salvando || nomeQ.isLoading || nomeQ.isError} onChange={event => { setNome(event.target.value); setErro(""); }} aria-invalid={!!erro} aria-describedby={`${nomeId}-ajuda`} /><p id={`${nomeId}-ajuda`} className="text-xs text-muted-foreground">De 2 a 120 caracteres.</p>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}</div>
          <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={salvando} onClick={() => setAberto(false)}>Cancelar</Button><Button type="submit" disabled={bloqueado || salvando || nomeQ.isLoading || nomeQ.isError}>{salvando ? "Salvando..." : "Salvar nome"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}