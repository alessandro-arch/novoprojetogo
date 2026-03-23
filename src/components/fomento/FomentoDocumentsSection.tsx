import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, FileText, Eye, Download, Trash2, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TIPO_DOC_LABELS, formatFileSize } from "@/lib/fomento-utils";
import { formatDateBR } from "@/lib/fomento-utils";

interface Props {
  projectId: string;
}

interface PendingFile {
  file: File;
  nome: string;
  tipo: string;
  descricao: string;
  uploading: boolean;
  progress: number;
}

const FomentoDocumentsSection = ({ projectId }: Props) => {
  const { user, fomentoRole } = useFomentoAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["fomento-documents", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fomento_documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      await supabase.storage.from("fomento-docs").remove([doc.storage_path]);
      const { error } = await supabase.from("fomento_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fomento-documents", projectId] });
      queryClient.invalidateQueries({ queryKey: ["fomento-doc-counts"] });
      queryClient.invalidateQueries({ queryKey: ["fomento-docs-total"] });
      toast({ title: "Documento excluído." });
    },
    onError: () => {
      toast({ title: "Erro ao excluir documento.", variant: "destructive" });
    },
  });

  const addFiles = useCallback((files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf");
    if (pdfs.length === 0) {
      toast({ title: "Selecione apenas arquivos PDF.", variant: "destructive" });
      return;
    }
    setPendingFiles((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        file,
        nome: file.name.replace(/\.pdf$/i, ""),
        tipo: "outro",
        descricao: "",
        uploading: false,
        progress: 0,
      })),
    ]);
  }, [toast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const uploadFile = async (index: number) => {
    const pf = pendingFiles[index];
    const update = (patch: Partial<PendingFile>) =>
      setPendingFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));

    update({ uploading: true, progress: 10 });

    try {
      const timestamp = Date.now();
      const safeName = pf.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `uploads/${projectId}/${timestamp}_${safeName}`;

      update({ progress: 30 });

      const { error: uploadError } = await supabase.storage
        .from("fomento-docs")
        .upload(storagePath, pf.file, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;

      update({ progress: 70 });

      const { error: insertError } = await supabase.from("fomento_documents").insert({
        project_id: projectId,
        nome: pf.nome,
        tipo: pf.tipo,
        descricao: pf.descricao || null,
        storage_path: storagePath,
        tamanho_bytes: pf.file.size,
        uploaded_by: user?.id,
      });
      if (insertError) throw insertError;

      update({ progress: 100 });

      queryClient.invalidateQueries({ queryKey: ["fomento-documents", projectId] });
      queryClient.invalidateQueries({ queryKey: ["fomento-doc-counts"] });
      queryClient.invalidateQueries({ queryKey: ["fomento-docs-total"] });

      setPendingFiles((prev) => prev.filter((_, i) => i !== index));
      toast({ title: `"${pf.nome}" enviado com sucesso.` });
    } catch (err: any) {
      update({ uploading: false, progress: 0 });
      toast({ title: "Erro no upload.", description: err.message, variant: "destructive" });
    }
  };

  const handleView = async (storagePath: string) => {
    const { data } = await supabase.storage.from("fomento-docs").createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDownload = async (storagePath: string, nome: string) => {
    const { data } = await supabase.storage.from("fomento-docs").createSignedUrl(storagePath, 3600, { download: `${nome}.pdf` });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Arraste PDFs aqui ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground mt-1">Múltiplos arquivos permitidos</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {pendingFiles.map((pf, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-sm font-medium truncate">{pf.file.name}</span>
            <span className="text-xs text-muted-foreground ml-auto">{formatFileSize(pf.file.size)}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Nome do documento</Label>
              <Input
                value={pf.nome}
                onChange={(e) => setPendingFiles((prev) => prev.map((f, j) => j === i ? { ...f, nome: e.target.value } : f))}
                disabled={pf.uploading}
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={pf.tipo}
                onValueChange={(v) => setPendingFiles((prev) => prev.map((f, j) => j === i ? { ...f, tipo: v } : f))}
                disabled={pf.uploading}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_DOC_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                value={pf.descricao}
                onChange={(e) => setPendingFiles((prev) => prev.map((f, j) => j === i ? { ...f, descricao: e.target.value } : f))}
                disabled={pf.uploading}
              />
            </div>
          </div>
          {pf.uploading ? (
            <Progress value={pf.progress} className="h-2" />
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => uploadFile(i)} disabled={!pf.nome.trim()}>
                <Upload className="w-3.5 h-3.5 mr-1" /> Enviar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}>
                Remover
              </Button>
            </div>
          )}
        </div>
      ))}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando documentos…</p>
      ) : documents && documents.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Paperclip className="w-3.5 h-3.5" /> {documents.length} documento(s) anexado(s)
          </p>
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 border rounded-lg p-3 bg-background">
              <FileText className="w-5 h-5 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.nome}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{TIPO_DOC_LABELS[doc.tipo] || doc.tipo}</Badge>
                  {doc.tamanho_bytes && <span className="text-xs text-muted-foreground">{formatFileSize(doc.tamanho_bytes)}</span>}
                  <span className="text-xs text-muted-foreground">{formatDateBR(doc.created_at)}</span>
                </div>
                {doc.descricao && <p className="text-xs text-muted-foreground mt-0.5">{doc.descricao}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleView(doc.storage_path)} title="Visualizar">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.storage_path, doc.nome)} title="Download">
                  <Download className="w-4 h-4" />
                </Button>
                {fomentoRole === "admin" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O documento "{doc.nome}" será removido permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate({ id: doc.id, storage_path: doc.storage_path })}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento anexado.</p>
      )}
    </div>
  );
};

export default FomentoDocumentsSection;
