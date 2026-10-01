import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readSheet, reconcileStudents, reconcileFaculty, type Outcome, type Row } from "@/lib/sd-import";
import { Plus, Upload, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const db = supabase as any;
const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";

export const fmtDate = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "—");

const usePrograms = (orgId: string) =>
  useQuery({
    queryKey: ["sd-programs", orgId],
    queryFn: async () => (await db.from("sd_programs").select("*").eq("organization_id", orgId).order("name")).data || [],
  });

/* ---------------- Programas ---------------- */
export const ProgramsTab = ({ orgId }: { orgId: string }) => {
  const { data, refetch } = usePrograms(orgId);
  const [name, setName] = useState(""); const [sigla, setSigla] = useState("");
  const add = async () => {
    if (!name.trim()) return toast.error("Informe o nome");
    const { error } = await db.from("sd_programs").insert({ organization_id: orgId, name: name.trim(), sigla: sigla.trim() || null });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Programa cadastrado"); setName(""); setSigla(""); refetch();
  };
  const upd = async (id: string, patch: any) => {
    const { error } = await db.from("sd_programs").update(patch).eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Atualizado"); refetch();
  };
  return (
    <div className="space-y-4">
      <Card className="rounded-xl"><CardContent className="pt-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]"><Label>Nome</Label><Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Sigla</Label><Input className="mt-1" value={sigla} onChange={(e) => setSigla(e.target.value)} /></div>
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Cadastrar</Button>
      </CardContent></Card>
      <div className="space-y-2">
        {(data || []).map((p: any) => (
          <Card key={p.id} className="rounded-xl"><CardContent className="py-3 flex flex-wrap items-center gap-3">
            <p className="flex-1 font-medium text-sm">{p.name}</p>
            <Input className="w-32" defaultValue={p.sigla || ""} placeholder="Sigla" onBlur={(e) => e.target.value !== (p.sigla || "") && upd(p.id, { sigla: e.target.value || null })} />
            <Button size="sm" variant="outline" onClick={() => upd(p.id, { status: p.status === "ativo" ? "inativo" : "ativo" })}>
              <Badge variant={p.status === "ativo" ? "default" : "secondary"}>{p.status}</Badge>
            </Button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
};

/* ---------------- Alunos ---------------- */
export const StudentsTab = ({ orgId }: { orgId: string }) => {
  const { data: programs } = usePrograms(orgId);
  const [prog, setProg] = useState("__all__"); const [q, setQ] = useState(""); const [onlyAbsent, setOnlyAbsent] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["sd-students", orgId],
    queryFn: async () => (await db.from("sd_students").select("*, program:sd_programs(name), advisor:sd_faculty(full_name)").eq("organization_id", orgId).order("full_name")).data || [],
  });
  const rows = (data || []).filter((s: any) =>
    (prog === "__all__" || s.program_id === prog) && (!onlyAbsent || s.absent_in_last_import) &&
    (!q || s.full_name.toLowerCase().includes(q.toLowerCase()) || s.enrollment.includes(q)));
  const resolve = async (s: any, status: string) => {
    const { error } = await db.from("sd_students").update({ status, absent_in_last_import: false }).eq("id", s.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Revisão registrada"); refetch();
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Buscar nome ou matrícula" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={sel} value={prog} onChange={(e) => setProg(e.target.value)}>
          <option value="__all__">Todos os programas</option>
          {(programs || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyAbsent} onChange={(e) => setOnlyAbsent(e.target.checked)} /> Só ausentes na nova base</label>
      </div>
      <p className="text-sm text-muted-foreground">{rows.length} aluno(s)</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>{["Matrícula", "Nome", "Programa", "Nível", "Ingresso", "Orientador", "Prazo regular", "Prazo vigente", "Situação", ""].map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((s: any) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-2">{s.enrollment}</td><td className="p-2">{s.full_name}</td><td className="p-2">{s.program?.name || "—"}</td>
                <td className="p-2 capitalize">{s.level}</td><td className="p-2">{fmtDate(s.entry_date)}</td><td className="p-2">{s.advisor?.full_name || "—"}</td>
                <td className="p-2">{fmtDate(s.regular_deadline)}</td><td className="p-2">{fmtDate(s.current_deadline)}</td>
                <td className="p-2"><Badge variant={s.status === "ativo" ? "default" : "secondary"}>{s.status}</Badge>{s.absent_in_last_import && <Badge variant="destructive" className="ml-1">ausente na nova base</Badge>}</td>
                <td className="p-2 whitespace-nowrap">{s.absent_in_last_import && (<>
                  <Button size="sm" variant="outline" onClick={() => resolve(s, s.status)}>Manter</Button>
                  <Button size="sm" variant="ghost" onClick={() => resolve(s, "inativo")}>Inativar</Button></>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------------- Professores ---------------- */
export const FacultyTab = ({ orgId }: { orgId: string }) => {
  const [q, setQ] = useState(""); const [onlyAbsent, setOnlyAbsent] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["sd-faculty", orgId],
    queryFn: async () => (await db.from("sd_faculty").select("*, programs:sd_faculty_programs(program:sd_programs(name))").eq("organization_id", orgId).order("full_name")).data || [],
  });
  const rows = (data || []).filter((f: any) => (!onlyAbsent || f.absent_in_last_import) && (!q || f.full_name.toLowerCase().includes(q.toLowerCase()) || f.enrollment.includes(q)));
  const upd = async (id: string, patch: any) => {
    const { error } = await db.from("sd_faculty").update(patch).eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Atualizado"); refetch();
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Buscar nome ou matrícula" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyAbsent} onChange={(e) => setOnlyAbsent(e.target.checked)} /> Só ausentes na nova base</label>
      </div>
      <p className="text-sm text-muted-foreground">{rows.length} professor(es) · {rows.filter((f: any) => f.can_advise).length} orientador(es)</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>{["Matrícula", "Nome", "Contrato", "Início", "Prazo do vínculo", "Programas", "Pode orientar", "Situação", ""].map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((f: any) => (
              <tr key={f.id} className="border-t border-border">
                <td className="p-2">{f.enrollment}</td><td className="p-2">{f.full_name}</td><td className="p-2">{f.contract_type || "—"}</td>
                <td className="p-2">{fmtDate(f.bond_start)}</td><td className="p-2">{f.bond_deadline ? fmtDate(f.bond_deadline) : "Indeterminado"}</td>
                <td className="p-2">{(f.programs || []).map((p: any) => p.program?.name).join(", ") || "—"}</td>
                <td className="p-2"><input type="checkbox" aria-label="Pode orientar" checked={f.can_advise} onChange={(e) => upd(f.id, { can_advise: e.target.checked })} /></td>
                <td className="p-2"><Badge variant={f.status === "ativo" ? "default" : "secondary"}>{f.status}</Badge>{f.absent_in_last_import && <Badge variant="destructive" className="ml-1">ausente na nova base</Badge>}</td>
                <td className="p-2 whitespace-nowrap">{f.absent_in_last_import && (<>
                  <Button size="sm" variant="outline" onClick={() => upd(f.id, { absent_in_last_import: false })}>Manter</Button>
                  <Button size="sm" variant="ghost" onClick={() => upd(f.id, { absent_in_last_import: false, status: "inativo" })}>Inativar</Button></>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------------- Importação ---------------- */
const LABEL: Record<Outcome, string> = { novo: "Novos", alterado: "Alterados", sem_alteracao: "Sem alterações", ausente: "Ausentes na nova base", erro: "Inconsistências" };

export const ImportTab = ({ orgId, orgLabel }: { orgId: string; orgLabel: string }) => {
  const { user } = useAuth();
  const { data: programs } = usePrograms(orgId);
  const [base, setBase] = useState<"alunos" | "professores">("alunos");
  const [programId, setProgramId] = useState("__none__");
  const [period, setPeriod] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<Outcome | null>(null);

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["sd-imports", orgId],
    queryFn: async () => (await db.from("sd_imports").select("*, program:sd_programs(name)").eq("organization_id", orgId).order("created_at", { ascending: false })).data || [],
  });

  const counts = useMemo(() => { const c: Record<string, number> = {}; (rows || []).forEach((r) => (c[r.outcome] = (c[r.outcome] || 0) + 1)); return c; }, [rows]);
  const processed = (rows || []).filter((r) => r.outcome !== "ausente").length;

  const process = async () => {
    if (programId === "__none__") return toast.error("Selecione o programa da planilha");
    if (!file) return toast.error("Selecione o arquivo Excel");
    if (!period.trim()) return toast.error("Informe o período/semestre");
    setBusy(true); setRows(null);
    try {
      const sheet = readSheet(await file.arrayBuffer());
      if (!sheet.length) throw new Error("Planilha vazia");
      const fixedProg = programId !== "__none__" ? (programs || []).find((p: any) => p.id === programId) : null;
      let out: Row[];
      if (base === "alunos") {
        const [{ data: existing }, { data: faculty }] = await Promise.all([
          db.from("sd_students").select("*").eq("organization_id", orgId),
          db.from("sd_faculty").select("id, enrollment, full_name, can_advise").eq("organization_id", orgId),
        ]);
        out = reconcileStudents(sheet, { programs: programs || [], fixedProg, existing: existing || [], faculty: faculty || [] });
      } else {
        const [{ data: cfg }, { data: existing }, { data: links }] = await Promise.all([
          db.from("sd_settings").select("value").eq("organization_id", orgId).eq("key", "contract_types").maybeSingle(),
          db.from("sd_faculty").select("*").eq("organization_id", orgId),
          db.from("sd_faculty_programs").select("faculty_id, program_id").eq("organization_id", orgId),
        ]);
        out = reconcileFaculty(sheet, { programs: programs || [], fixedProg, existing: existing || [], links: links || [], contracts: Object.keys(cfg?.value || {}) });
      }
      setRows(out); setShow(null);
    } catch (e: any) { toast.error("Não foi possível ler o arquivo: " + e.message); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!rows || !file || !user) return;
    setBusy(true);
    try {
      const path = `${orgId}/imports/${base}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await supabase.storage.from("servicedesk").upload(path, file);
      if (up.error) throw up.error;
      const { data: imp, error } = await db.from("sd_imports").insert({
        organization_id: orgId, base_type: base, program_id: programId !== "__none__" ? programId : null, period: period.trim(),
        file_name: file.name, storage_path: path, total_count: processed, new_count: counts.novo || 0, changed_count: counts.alterado || 0,
        unchanged_count: counts.sem_alteracao || 0, absent_count: counts.ausente || 0, error_count: counts.erro || 0, imported_by: user.id,
      }).select().single();
      if (error) throw error;
      const table = base === "alunos" ? "sd_students" : "sd_faculty";
      const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
      const writable = rows.filter((r) => r.outcome === "novo" || r.outcome === "alterado" || r.outcome === "sem_alteracao");
      const toWrite = await Promise.all(writable.map(async (r) => {
        const { cpf_digits, ...rest } = r.data || {};
        const cpf = cpf_digits ? { cpf_hash: await sha256(cpf_digits), cpf_last4: cpf_digits.slice(-4) } : {};
        return { organization_id: orgId, ...rest, ...cpf, absent_in_last_import: false, last_import_id: imp.id };
      }));
      for (let i = 0; i < toWrite.length; i += 200) {
        const { error: e } = await db.from(table).upsert(toWrite.slice(i, i + 200), { onConflict: "organization_id,enrollment" });
        if (e) throw e;
      }
      const absentIds = rows.filter((r) => r.outcome === "ausente").map((r) => r.before.id);
      if (absentIds.length) { const { error: e } = await db.from(table).update({ absent_in_last_import: true }).in("id", absentIds); if (e) throw e; }
      if (base === "professores") {
        const { data: fac } = await db.from("sd_faculty").select("id, enrollment").eq("organization_id", orgId);
        const idByEnr = new Map<string, string>((fac || []).map((f: any) => [f.enrollment, f.id]));
        const links = rows.flatMap((r) => (r.extra?.progIds || []).map((p: string) => ({ organization_id: orgId, faculty_id: idByEnr.get(r.enrollment), program_id: p }))).filter((l) => l.faculty_id);
        if (links.length) { const { error: e } = await db.from("sd_faculty_programs").upsert(links, { onConflict: "faculty_id,program_id", ignoreDuplicates: true }); if (e) throw e; }
      }
      const recs = rows.map((r) => ({ import_id: imp.id, organization_id: orgId, enrollment: r.enrollment, outcome: r.outcome, before_data: r.before || null, after_data: r.data || null, message: r.message || (r.diffs?.length ? "Campos: " + r.diffs.join(", ") : null) }));
      for (let i = 0; i < recs.length; i += 500) { const { error: e } = await db.from("sd_import_records").insert(recs.slice(i, i + 500)); if (e) throw e; }
      toast.success("Importação confirmada e registrada");
      setRows(null); setFile(null); refetchHistory();
    } catch (e: any) { toast.error("Erro na importação: " + e.message); }
    finally { setBusy(false); }
  };

  const progName = programId !== "__none__" ? (programs || []).find((p: any) => p.id === programId)?.name : null;

  return (
    <div className="space-y-6">
      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Nova importação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><Label>Instituição</Label><Input className="mt-1" value={orgLabel} disabled /></div>
            <div><Label>Base</Label><select className={`${sel} mt-1 w-full`} value={base} onChange={(e) => { setBase(e.target.value as any); setRows(null); }}><option value="alunos">Alunos</option><option value="professores">Professores</option></select></div>
            <div><Label>Programa *</Label><select className={`${sel} mt-1 w-full`} value={programId} onChange={(e) => { setProgramId(e.target.value); setRows(null); }}>
              <option value="__none__">Selecione o programa</option>{(programs || []).filter((p: any) => p.status !== "inativo").map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><Label>Período/Semestre</Label><Input className="mt-1" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Ex.: 2027/1" /></div>
          </div>
          <div>
            <Label>Arquivo Excel</Label>
            <div className="mt-1 flex items-center gap-3 flex-wrap">
              <label>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setRows(null); }} />
                <Button type="button" variant="outline" asChild>
                  <span className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />{file ? "Escolher outro arquivo" : "Procurar arquivo"}</span>
                </Button>
              </label>
              <span className="text-sm text-muted-foreground truncate max-w-[320px]">{file ? file.name : "Nenhum arquivo selecionado (.xlsx, .xls, .csv)"}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Uma planilha por programa: a comparação e as ausências consideram só o programa selecionado.{" "}
            {base === "alunos" ? "Colunas: Matrícula, Nome, Nível (Mestrado/Doutorado), Ingresso, Orientador (matrícula ou nome), Situação. A coluna Programa é opcional." : "Colunas: Matrícula, Nome, Contrato, Início do vínculo, Pode orientar (Sim/Não), Situação. Professores ficam vinculados ao programa selecionado."}
            {" "}Quem não estiver no arquivo é apenas sinalizado como ausente — ninguém é inativado automaticamente.
          </p>
          <Button onClick={process} disabled={busy}>{busy && !rows ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} Validar e comparar</Button>
        </CardContent>
      </Card>

      {rows && (
        <Card className="rounded-xl border-primary/40">
          <CardHeader><CardTitle className="text-base">Prévia · {orgLabel} · {base === "alunos" ? "Alunos" : "Professores"}{progName ? ` · ${progName}` : ""} · {period} · {file?.name}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium">{processed} registros processados</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LABEL) as Outcome[]).map((k) => (
                <Button key={k} size="sm" variant={show === k ? "default" : "outline"} onClick={() => setShow(show === k ? null : k)}>
                  {counts[k] || 0} {LABEL[k].toLowerCase()}
                </Button>
              ))}
            </div>
            {show && (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border text-sm">
                {rows.filter((r) => r.outcome === show).map((r, i) => (
                  <div key={i} className="px-3 py-2 border-b border-border/50 last:border-0">
                    <span className="font-medium">{r.enrollment || "(sem matrícula)"}</span>{r.line > 0 && <span className="text-muted-foreground"> · linha {r.line}</span>}
                    {r.data?.full_name && <span> · {r.data.full_name}</span>}
                    {r.message && <span className="text-muted-foreground"> · {r.message}</span>}
                    {r.diffs?.length ? <div className="text-xs text-muted-foreground">{r.diffs.map((d) => `${d}: ${String(r.before?.[d] ?? "—")} → ${String(r.data?.[d] ?? "—")}`).join(" | ")}</div> : null}
                  </div>
                ))}
                {!rows.some((r) => r.outcome === show) && <p className="p-3 text-muted-foreground">Nenhum registro.</p>}
              </div>
            )}
            {(counts.erro || 0) > 0 && <p className="text-sm flex items-center gap-1 text-destructive"><AlertTriangle className="w-4 h-4" /> Linhas com inconsistência não serão gravadas; o restante pode ser confirmado.</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShow("alterado")}>Revisar alterações</Button>
              <Button onClick={confirm} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirmar importação</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Histórico de importações</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(history || []).map((h: any) => (
            <div key={h.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-border/50 pb-2 last:border-0">
              <span className="font-medium">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
              <Badge variant="secondary">{h.base_type}</Badge>{h.program?.name && <span>{h.program.name}</span>}<span>{h.period}</span>
              <span className="text-muted-foreground truncate">{h.file_name}</span>
              <span className="text-xs text-muted-foreground">{h.total_count} proc. · {h.new_count} novos · {h.changed_count} alt. · {h.unchanged_count} iguais · {h.absent_count} ausentes · {h.error_count} incons.</span>
              {h.storage_path && <Button size="sm" variant="ghost" onClick={async () => { const { data } = await supabase.storage.from("servicedesk").createSignedUrl(h.storage_path, 60); if (data) window.open(data.signedUrl); }}>Baixar arquivo</Button>}
            </div>
          ))}
          {!history?.length && <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>}
        </CardContent>
      </Card>
    </div>
  );
};
