import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { STATUS_LABEL, statusVariant, notify, RequestTimeline } from "./sd-requests";

const db = supabase as any;
const fmt = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

interface Props { orgId: string; groups: { id: string; code: string; name: string }[]; isAdmin: boolean }

/** Filas de atendimento por grupo responsável (ex.: PRPPGE aprova, DTI executa). */
const GroupQueues = ({ orgId, groups, isAdmin }: Props) => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<{ req: any; act: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: reqs, isLoading } = useQuery({
    queryKey: ["sd-queue", orgId],
    queryFn: async () => (await db.from("sd_requests").select("*, sd_services(name, steps)").eq("organization_id", orgId).order("created_at", { ascending: false })).data || [],
  });
  const showDiv = isAdmin || groups.some((g) => g.code === "PRPPGE");
  const { data: divs } = useQuery({
    queryKey: ["sd-divs", orgId], enabled: showDiv,
    queryFn: async () => (await db.from("sd_divergences").select("*").eq("organization_id", orgId).order("created_at", { ascending: false })).data || [],
  });

  const q = search.trim().toLowerCase();
  const filtered = (reqs || []).filter((r: any) => !q || r.requester_name.toLowerCase().includes(q) || r.requester_enrollment.toLowerCase().includes(q));
  const isLast = (r: any) => r.step_index >= (r.sd_services?.steps?.length || 1) - 1;
  const open = filtered.filter((r: any) => !["concluido", "recusado"].includes(r.status));
  const closed = filtered.filter((r: any) => ["concluido", "recusado"].includes(r.status));

  const run = async () => {
    if (!action) return;
    setBusy(true);
    const fn = action.act === "resolver" ? "sd_resolve_divergence" : "sd_advance_request";
    const args = action.act === "resolver" ? { _id: action.req.id, _note: note || null } : { _id: action.req.id, _action: action.act, _note: note || null };
    const { error } = await db.rpc(fn, args);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    if (action.act !== "resolver") notify({ request_id: action.req.id, event: action.act });
    setAction(null); setNote("");
    qc.invalidateQueries({ queryKey: ["sd-queue", orgId] });
    qc.invalidateQueries({ queryKey: ["sd-divs", orgId] });
    qc.invalidateQueries({ queryKey: ["sd-req-events", action.req.id] });
  };

  const groupTab = (g: { id: string; code: string; name: string }) => {
    const mine = open.filter((r: any) => r.current_group_id === g.id);
    return (
      <TabsContent key={g.id} value={g.id} className="space-y-3">
        {!mine.length && <p className="text-sm text-muted-foreground">Nenhuma solicitação aguardando {g.code}.</p>}
        {mine.map((r: any) => <ReqCard key={r.id} r={r}>
          {!isLast(r) && <Button size="sm" onClick={() => setAction({ req: r, act: "aprovar" })}>Aprovar</Button>}
          {isLast(r) && r.status !== "em_andamento" && <Button size="sm" variant="secondary" onClick={() => setAction({ req: r, act: "iniciar" })}>Em andamento</Button>}
          {isLast(r) && <Button size="sm" onClick={() => setAction({ req: r, act: "concluir" })}>Concluído</Button>}
          <Button size="sm" variant="destructive" onClick={() => setAction({ req: r, act: "recusar" })}>Recusar</Button>
        </ReqCard>)}
      </TabsContent>
    );
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <Input placeholder="Buscar por nome ou matrícula" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Tabs defaultValue={groups[0]?.id || "hist"}>
        <TabsList className="flex-wrap h-auto">
          {groups.map((g) => <TabsTrigger key={g.id} value={g.id}>{g.code} ({open.filter((r: any) => r.current_group_id === g.id).length})</TabsTrigger>)}
          {showDiv && <TabsTrigger value="div">Divergências ({(divs || []).filter((d: any) => d.status !== "resolvida").length})</TabsTrigger>}
          <TabsTrigger value="hist">Histórico ({closed.length})</TabsTrigger>
        </TabsList>
        {groups.map(groupTab)}
        {showDiv && (
          <TabsContent value="div" className="space-y-3">
            {!divs?.length && <p className="text-sm text-muted-foreground">Nenhuma divergência informada.</p>}
            {divs?.map((d: any) => (
              <Card key={d.id} className="rounded-xl"><CardContent className="py-3 space-y-1 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{d.person_name} · {d.enrollment} ({d.person_kind})</span><Badge variant={d.status === "resolvida" ? "secondary" : "outline"}>{d.status === "resolvida" ? "Resolvida" : "Aberta"}</Badge></div>
                <p><span className="text-muted-foreground">{d.field}:</span> {d.description}</p>
                <p className="text-xs text-muted-foreground">Informada em {fmt(d.created_at)}{d.resolution_note ? ` · Resolução: ${d.resolution_note}` : ""}</p>
                {d.status !== "resolvida" && <Button size="sm" variant="outline" onClick={() => setAction({ req: d, act: "resolver" })}>Marcar como resolvida</Button>}
              </CardContent></Card>
            ))}
          </TabsContent>
        )}
        <TabsContent value="hist" className="space-y-3">
          {!closed.length && <p className="text-sm text-muted-foreground">Nada no histórico.</p>}
          {closed.map((r: any) => <ReqCard key={r.id} r={r} />)}
        </TabsContent>
      </Tabs>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{action?.act === "recusar" ? "Recusar solicitação" : action?.act === "resolver" ? "Resolver divergência" : "Confirmar"}</DialogTitle></DialogHeader>
          <Textarea rows={3} placeholder={action?.act === "recusar" ? "Motivo (obrigatório)" : action?.act === "concluir" ? "Observação (ex.: login VPN entregue)" : "Observação (opcional)"} value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter><Button variant="outline" onClick={() => setAction(null)}>Cancelar</Button><Button disabled={busy || (action?.act === "recusar" && note.trim().length < 3)} onClick={run}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ReqCard = ({ r, children }: { r: any; children?: React.ReactNode }) => (
  <Card className="rounded-xl"><CardContent className="py-3 space-y-2">
    <div className="flex flex-wrap justify-between gap-2">
      <div>
        <p className="font-medium text-sm">{r.requester_name} · {r.requester_enrollment}</p>
        <p className="text-xs text-muted-foreground">{r.sd_services?.name} · {r.requester_kind}{r.requester_program ? ` · ${r.requester_program}` : ""}{r.requester_email ? ` · ${r.requester_email}` : ""}</p>
        <p className="text-xs text-muted-foreground">Enviada em {fmt(r.created_at)} · termo aceito ({r.terms_hash?.slice(0, 12)}…)</p>
      </div>
      <Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status] || r.status}</Badge>
    </div>
    <RequestTimeline requestId={r.id} />
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </CardContent></Card>
);

export default GroupQueues;
