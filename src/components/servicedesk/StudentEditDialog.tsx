import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Student = Record<string, any>;

interface Props {
  student: Student | null;
  programs: Student[];
  advisors: Student[];
  onOpenChange: (open: boolean) => void;
  onSave: (values: Student, cpf: string) => Promise<void>;
}

const field = "mt-1";
const select = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function StudentEditDialog({ student, programs, advisors, onOpenChange, onSave }: Props) {
  const [values, setValues] = useState<Student>({});
  const [cpf, setCpf] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!student) return;
    setValues({
      enrollment: student.enrollment ?? "",
      full_name: student.full_name ?? "",
      phone: student.phone ?? "",
      email: student.email ?? "",
      turma: student.turma ?? "",
      program_id: student.program_id ?? "__none__",
      level: student.level ?? "mestrado",
      entry_date: student.entry_date ?? "",
      expected_end: student.expected_end ?? "",
      advisor_id: student.advisor_id ?? "__none__",
      scholarship: student.scholarship ?? "",
      current_deadline: student.current_deadline ?? "",
      status: student.status ?? "ativo",
      service_desk_access_active: student.service_desk_access_active !== false,
    });
    setCpf("");
  }, [student]);

  const set = (key: string, value: any) => setValues((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    try { await onSave(values, cpf); } finally { setSaving(false); }
  };

  return (
    <Dialog open={Boolean(student)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Editar aluno</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Matrícula</Label><Input className={field} value={values.enrollment ?? ""} onChange={(e) => set("enrollment", e.target.value)} /></div>
          <div><Label>Nome</Label><Input className={field} value={values.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></div>
          <div><Label>CPF</Label><Input className={field} inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder={student?.cpf_last4 ? `Protegido · final ${student.cpf_last4}` : "Informe para cadastrar"} /></div>
          <div><Label>Telefone</Label><Input className={field} value={values.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><Label>E-mail</Label><Input className={field} type="email" value={values.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>Turma</Label><Input className={field} value={values.turma ?? ""} onChange={(e) => set("turma", e.target.value)} /></div>
          <div><Label>Programa</Label><select className={select} value={values.program_id ?? "__none__"} onChange={(e) => set("program_id", e.target.value)}><option value="__none__">Sem programa</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><Label>Nível</Label><select className={select} value={values.level ?? "mestrado"} onChange={(e) => set("level", e.target.value)}><option value="mestrado">Mestrado</option><option value="doutorado">Doutorado</option></select></div>
          <div><Label>Ingresso</Label><Input className={field} type="date" value={values.entry_date ?? ""} onChange={(e) => set("entry_date", e.target.value)} /></div>
          <div><Label>Término previsto</Label><Input className={field} type="date" value={values.expected_end ?? ""} onChange={(e) => set("expected_end", e.target.value)} /></div>
          <div><Label>Orientador</Label><select className={select} value={values.advisor_id ?? "__none__"} onChange={(e) => set("advisor_id", e.target.value)}><option value="__none__">Sem orientador</option>{advisors.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}</select></div>
          <div><Label>Bolsa</Label><Input className={field} value={values.scholarship ?? ""} onChange={(e) => set("scholarship", e.target.value)} /></div>
          <div><Label>Prazo vigente</Label><Input className={field} type="date" value={values.current_deadline ?? ""} onChange={(e) => set("current_deadline", e.target.value)} /></div>
          <div><Label>Situação acadêmica</Label><select className={select} value={values.status ?? "ativo"} onChange={(e) => set("status", e.target.value)}><option value="ativo">Ativo</option><option value="trancado">Trancado</option><option value="concluido">Concluído</option><option value="desligado">Desligado</option><option value="inativo">Inativo</option></select></div>
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm">
          <input type="checkbox" checked={Boolean(values.service_desk_access_active)} onChange={(e) => set("service_desk_access_active", e.target.checked)} />
          Acesso ao Service Desk ativo
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}