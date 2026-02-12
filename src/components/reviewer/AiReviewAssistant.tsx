import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScoreInput {
  criteriaName: string;
  criteriaDescription: string | null;
  maxScore: number;
  weight: number;
  score: number;
  comment: string;
}

interface Props {
  scores: ScoreInput[];
  recommendation: string;
  overallScore: number;
  knowledgeArea: string | null;
  editalTitle: string;
  proposalContent: Record<string, string> | null;
  onInsert: (text: string) => void;
  disabled?: boolean;
}

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-review-draft`;

export default function AiReviewAssistant({
  scores,
  recommendation,
  overallScore,
  knowledgeArea,
  editalTitle,
  proposalContent,
  onInsert,
  disabled,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setDraft("");
    setLoading(true);

    try {
      const resp = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ scores, recommendation, overallScore, knowledgeArea, editalTitle, proposalContent }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast({ title: err.error || "Erro ao gerar parecer", variant: "destructive" });
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              result += content;
              setDraft(result);
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro de conexão com IA", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [scores, recommendation, overallScore, knowledgeArea, editalTitle, proposalContent, toast]);

  const handleOpen = () => {
    setOpen(true);
    setDraft("");
    setCopied(false);
    generate();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    onInsert(draft);
    setOpen(false);
    toast({ title: "Minuta inserida nos comentários" });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={disabled || !recommendation || scores.some((s) => s.score <= 0)}
        className="gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Gerar minuta com IA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Assistente de Parecer
            </DialogTitle>
            <DialogDescription>
              Minuta gerada automaticamente. Revise e edite antes de usar.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-[200px] max-h-[50vh] rounded-md border border-border bg-muted/30 p-4">
            {loading && !draft && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Gerando minuta...
              </div>
            )}
            {draft && (
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                {draft}
                {loading && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!draft || loading} className="gap-1">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
              Regenerar
            </Button>
            <Button size="sm" onClick={handleInsert} disabled={!draft || loading}>
              Inserir nos comentários
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
