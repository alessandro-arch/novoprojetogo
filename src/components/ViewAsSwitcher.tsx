import { useEffect, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PAPEIS_SIMULADOS, precisaOrg, rotuloPapel, salvarViewAs, limparViewAs, useViewAs, type PapelSimulado } from "@/lib/view-as";
import { EVENTO_BLOQUEIO, MSG_MODO_VISUALIZACAO } from "@/lib/view-as-guard";

const db = supabase as any;
export const AVISO_SIMULACAO = "Simulação de interface. O banco continua autorizando como Superadmin, então podem aparecer dados além do que este papel veria.";
const selectCls = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Seletores de papel, organização e grupo. Só renderiza para o superadmin real. */
export function ViewAsControles({ onPronto }: { onPronto?: () => void }) {
  const { user, realFomentoRole, membership } = useAuth();
  const { escolha } = useViewAs();
  const qc = useQueryClient();
  const realSuper = realFomentoRole === "superadmin";
  const [papel, setPapel] = useState<PapelSimulado>(escolha?.papel ?? "superadmin");
  const [orgId, setOrgId] = useState<string>(escolha?.orgId ?? membership?.organization_id ?? "");
  const [grupoId, setGrupoId] = useState<string>(escolha?.grupoId ?? "");
  const orgs = useQuery({
    queryKey: ["view-as-orgs", user?.id], enabled: realSuper,
    queryFn: async () => { const { data, error } = await db.from("organizations").select("id, name, sigla, is_active").order("name"); if (error) throw error; return (data ?? []) as { id: string; name: string; sigla: string | null }[]; },
  });
  const grupos = useQuery({
    queryKey: ["view-as-grupos", orgId], enabled: realSuper && papel === "sd_atendente" && !!orgId,
    queryFn: async () => { const { data, error } = await db.from("sd_groups").select("id, code, name").eq("organization_id", orgId).eq("is_active", true).order("code"); if (error) throw error; return (data ?? []) as { id: string; code: string; name: string }[]; },
  });
  useEffect(() => { if (!orgId && orgs.data?.length) setOrgId(orgs.data[0].id); }, [orgs.data, orgId]);
  if (!realSuper || !user) return null;
  const aplicar = () => {
    if (papel === "superadmin") { limparViewAs(); }
    else {
      const org = orgs.data?.find(o => o.id === orgId);
      salvarViewAs({ userId: user.id, papel, orgId: precisaOrg(papel) ? orgId || null : null, orgNome: precisaOrg(papel) ? org?.sigla || org?.name || null : null, grupoId: papel === "sd_atendente" ? grupoId || null : null });
    }
    qc.invalidateQueries();
    onPronto?.();
  };
  const faltaGrupo = papel === "sd_atendente" && !grupoId;
  return <div className="space-y-3">
    <label className="block text-sm font-medium">Papel
      <select aria-label="Papel" className={selectCls} value={papel} onChange={e => setPapel(e.target.value as PapelSimulado)}>
        {PAPEIS_SIMULADOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
    {precisaOrg(papel) && <label className="block text-sm font-medium">Organização
      <select aria-label="Organização" className={selectCls} value={orgId} onChange={e => { setOrgId(e.target.value); setGrupoId(""); }}>
        {(orgs.data ?? []).map(o => <option key={o.id} value={o.id}>{o.sigla ? `${o.sigla} · ${o.name}` : o.name}</option>)}
      </select>
    </label>}
    {papel === "sd_atendente" && <label className="block text-sm font-medium">Grupo
      <select aria-label="Grupo" className={selectCls} value={grupoId} onChange={e => setGrupoId(e.target.value)}>
        <option value="">Escolha um grupo</option>
        {(grupos.data ?? []).map(g => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
      </select>
    </label>}
    <p className="text-xs text-muted-foreground">{AVISO_SIMULACAO}</p>
    <Button className="w-full" disabled={faltaGrupo || (precisaOrg(papel) && !orgId)} onClick={aplicar}>Aplicar</Button>
  </div>;
}

/** Faixa fixa e botão "Ver como", visíveis em todos os módulos. */
export default function ViewAsBar() {
  const { user, loading, realFomentoRole } = useAuth();
  const { pathname } = useLocation();
  const { escolha } = useViewAs();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const fn = () => toast.error(MSG_MODO_VISUALIZACAO);
    window.addEventListener(EVENTO_BLOQUEIO, fn);
    return () => window.removeEventListener(EVENTO_BLOQUEIO, fn);
  }, []);
  const painel = ["/dashboard", "/profile", "/admin/*", "/org/*", "/proponente/*", "/reviewer/*", "/financeiro/*", "/fomento/*", "/editais/*", "/servicedesk/*"]
    .some(path => matchPath(path, pathname))
    && !["/fomento/login", "/editais/login", "/servicedesk/login", "/servicedesk/primeiro-acesso", "/reviewer/activate"].includes(pathname.replace(/\/$/, ""));
  if (!user || loading || realFomentoRole !== "superadmin" || !painel) return null;
  const voltar = () => { limparViewAs(); qc.invalidateQueries(); };
  const seletor = <Popover open={aberto} onOpenChange={setAberto}>
    <Tooltip><TooltipTrigger asChild><PopoverTrigger asChild>
      <Button size="sm" variant={escolha ? "outline" : "default"} className="gap-1 shadow-sm"><Eye className="w-4 h-4" />Ver como</Button>
    </PopoverTrigger></TooltipTrigger><TooltipContent className="max-w-xs">{AVISO_SIMULACAO}</TooltipContent></Tooltip>
    <PopoverContent align="end" className="w-80"><ViewAsControles onPronto={() => setAberto(false)} /></PopoverContent>
  </Popover>;
  if (!escolha) return <div className="fixed bottom-4 right-4 z-[60]">{seletor}</div>;
  return <div role="status" className="sticky top-0 z-[60] border-b border-warning/40 bg-warning-light text-foreground">
    <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
      <Tooltip><TooltipTrigger asChild><p className="flex items-center gap-2 font-medium"><Eye className="w-4 h-4" />Visualizando como {rotuloPapel(escolha.papel)}{escolha.orgNome ? ` em ${escolha.orgNome}` : ""}. Nada é gravado.</p></TooltipTrigger><TooltipContent className="max-w-xs">{AVISO_SIMULACAO}</TooltipContent></Tooltip>
      <div className="flex items-center gap-2">{seletor}<Button size="sm" onClick={voltar} className="gap-1"><Undo2 className="w-4 h-4" />Voltar ao Superadmin</Button></div>
    </div>
  </div>;
}
