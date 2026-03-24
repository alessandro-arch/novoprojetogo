import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ArrowLeft, Save } from "lucide-react";
import { formatBRL, PARCERIA_TIPO_LABELS, PARCERIA_STATUS_LABELS, TIPO_INSTITUICAO_LABELS } from "@/lib/fomento-utils";
import { toast } from "sonner";

interface Props {
  parceriaId?: string;
  onBack: () => void;
}

const emptForm = {
  numero_contrato: "",
  titulo: "",
  tipo: "",
  modalidade: "",
  status: "em_negociacao",
  instituicao_nome: "",
  cnpj: "",
  tipo_instituicao: "",
  num_beneficiarios: 0,
  num_parcelas: 0,
  valor_mensal_aluno: 0,
};

const formatCnpj = (v: string) => {
  const digits = v.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const FomentoParceiraForm = ({ parceriaId, onBack }: Props) => {
  const { fomentoOrgId, user } = useFomentoAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptForm);
  const [openSections, setOpenSections] = useState({ a: true, b: true, c: true });

  const isEditing = !!parceriaId;

  const { data: existing } = useQuery({
    queryKey: ["fomento-parceria", parceriaId],
    queryFn: async () => {
      if (!parceriaId) return null;
      const { data, error } = await supabase.from("fomento_parcerias").select("*").eq("id", parceriaId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!parceriaId,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        numero_contrato: existing.numero_contrato || "",
        titulo: existing.titulo || "",
        tipo: existing.tipo || "",
        status: existing.status || "em_negociacao",
        instituicao_nome: existing.instituicao_nome || "",
        cnpj: existing.cnpj || "",
        tipo_instituicao: existing.tipo_instituicao || "",
        num_beneficiarios: existing.num_beneficiarios || 0,
        num_parcelas: existing.num_parcelas || 0,
        valor_mensal_aluno: existing.valor_mensal_aluno || 0,
      });
    }
  }, [existing]);

  const valorTotal = form.num_beneficiarios * form.num_parcelas * form.valor_mensal_aluno;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        valor_total: valorTotal,
        organization_id: fomentoOrgId,
        created_by: user?.id,
      };
      if (isEditing) {
        const { error } = await supabase.from("fomento_parcerias").update(payload).eq("id", parceriaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fomento_parcerias").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fomento-parcerias"] });
      toast.success(isEditing ? "Parceria atualizada" : "Parceria criada");
      onBack();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    saveMutation.mutate();
  };

  const set = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const SectionCard = ({ id, title, children }: { id: "a" | "b" | "c"; title: string; children: React.ReactNode }) => (
    <Collapsible open={openSections[id]} onOpenChange={(o) => setOpenSections((s) => ({ ...s, [id]: o }))}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer flex-row items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            <ChevronDown className={`w-5 h-5 transition-transform ${openSections[id] ? "rotate-180" : ""}`} />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <h2 className="text-2xl font-bold text-foreground">{isEditing ? "Editar Parceria" : "Nova Parceria"}</h2>
        </div>
        <Button type="submit" disabled={saveMutation.isPending}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
      </div>

      <SectionCard id="a" title="[A] Identificação">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Número do Contrato/Processo</Label>
            <Input value={form.numero_contrato} onChange={(e) => set("numero_contrato", e.target.value)} placeholder="Ex: 001/2026" />
          </div>
          <div className="space-y-2">
            <Label>Título da Parceria *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Título" required />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PARCERIA_TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PARCERIA_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <SectionCard id="b" title="[B] Instituição Parceira">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome da Instituição</Label>
            <Input value={form.instituicao_nome} onChange={(e) => set("instituicao_nome", e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={(e) => set("cnpj", formatCnpj(e.target.value))} placeholder="XX.XXX.XXX/XXXX-XX" maxLength={18} />
          </div>
          <div className="space-y-2">
            <Label>Tipo da Instituição</Label>
            <Select value={form.tipo_instituicao} onValueChange={(v) => set("tipo_instituicao", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_INSTITUICAO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <SectionCard id="c" title="[C] Financeiro">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Número de Beneficiários</Label>
            <Input type="number" min={0} value={form.num_beneficiarios} onChange={(e) => set("num_beneficiarios", parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Número de Parcelas</Label>
            <Input type="number" min={0} value={form.num_parcelas} onChange={(e) => set("num_parcelas", parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Valor Mensal por Aluno (R$)</Label>
            <Input type="number" min={0} step={0.01} value={form.valor_mensal_aluno} onChange={(e) => set("valor_mensal_aluno", parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Valor Total (calculado)</Label>
            <Input value={formatBRL(valorTotal)} readOnly className="bg-muted font-bold" />
          </div>
        </div>
      </SectionCard>
    </form>
  );
};

export default FomentoParceiraForm;
