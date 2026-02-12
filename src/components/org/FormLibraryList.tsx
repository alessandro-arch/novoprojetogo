import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Plus, Search, Copy, Archive, PenLine, FileText, ChevronLeft, ChevronRight, ClipboardCopy,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  orgId: string;
  onEditForm: (formId: string) => void;
}

type StatusFilter = "all" | "draft" | "published" | "archived";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Rascunho", variant: "outline" },
  published: { label: "Publicado", variant: "default" },
  archived: { label: "Arquivado", variant: "secondary" },
};

const FormLibraryList = ({ orgId, onEditForm }: Props) => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // New form modal
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: forms, isLoading } = useQuery({
    queryKey: ["form-library", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!forms) return [];
    return forms.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        if (!f.name.toLowerCase().includes(q) && !f.code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [forms, statusFilter, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      // Generate code
      const { data: codeData, error: codeErr } = await supabase.rpc("generate_form_code", { p_org_id: orgId });
      if (codeErr) throw codeErr;

      const { data, error } = await supabase
        .from("forms")
        .insert({
          organization_id: orgId,
          code: codeData as string,
          name: newName.trim(),
          description: newDesc.trim() || null,
          created_by: (await supabase.auth.getUser()).data.user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      toast.success(`Formulário ${data.code} criado!`);
      setNewModalOpen(false);
      setNewName("");
      setNewDesc("");
      queryClient.invalidateQueries({ queryKey: ["form-library"] });
      onEditForm(data.id);
    } catch (e: any) {
      toast.error("Erro ao criar: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (form: any) => {
    try {
      const { data: codeData } = await supabase.rpc("generate_form_code", { p_org_id: orgId });
      const { data: newForm, error } = await supabase
        .from("forms")
        .insert({
          organization_id: orgId,
          code: codeData as string,
          name: `${form.name} (cópia)`,
          description: form.description,
          created_by: (await supabase.auth.getUser()).data.user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Copy fields
      const { data: fields } = await supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", form.id)
        .order("sort_order");

      if (fields && fields.length > 0) {
        const rows = fields.map((f: any) => ({
          form_id: newForm.id,
          section_title: f.section_title,
          section_description: f.section_description,
          label: f.label,
          help_text: f.help_text,
          field_type: f.field_type,
          is_required: f.is_required,
          min_chars: f.min_chars,
          max_chars: f.max_chars,
          sort_order: f.sort_order,
          options: f.options,
          validation_rules: f.validation_rules,
        }));
        await supabase.from("form_fields").insert(rows);
      }

      toast.success(`Formulário duplicado como ${newForm.code}`);
      queryClient.invalidateQueries({ queryKey: ["form-library"] });
    } catch (e: any) {
      toast.error("Erro ao duplicar: " + e.message);
    }
  };

  const handleArchive = async (form: any) => {
    const newStatus = form.status === "archived" ? "draft" : "archived";
    const { error } = await supabase
      .from("forms")
      .update({ status: newStatus })
      .eq("id", form.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(newStatus === "archived" ? "Formulário arquivado." : "Formulário reativado.");
      queryClient.invalidateQueries({ queryKey: ["form-library"] });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Código ${code} copiado!`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Formulários</h1>
          <p className="text-muted-foreground mt-1">Biblioteca de formulários reutilizáveis da organização.</p>
        </div>
        <Button onClick={() => setNewModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Formulário
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="published">Publicado</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-14 h-14 mx-auto text-muted-foreground/60 mb-4" />
          <p className="text-muted-foreground mb-4">
            {forms && forms.length > 0
              ? "Nenhum formulário encontrado com os filtros aplicados."
              : "Nenhum formulário criado ainda. Comece criando o primeiro."}
          </p>
          {(!forms || forms.length === 0) && (
            <Button onClick={() => setNewModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Criar Primeiro Formulário
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-[80px]">Versão</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[130px]">Atualizado</TableHead>
                    <TableHead className="w-[200px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((f) => {
                    const st = STATUS_MAP[f.status] ?? { label: f.status, variant: "outline" as const };
                    return (
                      <TableRow key={f.id}>
                        <TableCell>
                          <button
                            onClick={() => copyCode(f.code)}
                            className="flex items-center gap-1 font-mono text-xs text-primary hover:underline cursor-pointer"
                            title="Copiar código"
                          >
                            {f.code}
                            <ClipboardCopy className="w-3 h-3" />
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-center">{f.version}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(f.updated_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => onEditForm(f.id)}>
                              <PenLine className="w-4 h-4 mr-1" />
                              {f.status === "published" ? "Ver" : "Editar"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDuplicate(f)} title="Duplicar">
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleArchive(f)} title={f.status === "archived" ? "Reativar" : "Arquivar"}>
                              <Archive className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((f) => {
              const st = STATUS_MAP[f.status] ?? { label: f.status, variant: "outline" as const };
              return (
                <Card key={f.id}>
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{f.name}</p>
                        <button
                          onClick={() => copyCode(f.code)}
                          className="font-mono text-xs text-primary flex items-center gap-1"
                        >
                          {f.code} <ClipboardCopy className="w-3 h-3" />
                        </button>
                      </div>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>v{f.version}</span>
                      <span>·</span>
                      <span>{new Date(f.updated_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onEditForm(f.id)}>
                        <PenLine className="w-4 h-4 mr-1" /> {f.status === "published" ? "Ver" : "Editar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicate(f)}><Copy className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleArchive(f)}><Archive className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* New Form Modal */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Formulário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Formulário de Pesquisa Básica"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descreva o propósito deste formulário..."
                className="mt-1"
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O código do formulário será gerado automaticamente (ex: FRM-000001).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Criar Formulário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormLibraryList;
