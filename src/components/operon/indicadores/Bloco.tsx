import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/** Moldura comum com estados de carregamento, erro e vazio em cada bloco. */
export default function Bloco({ titulo, descricao, carregando, erro, vazio, retry, children }: { titulo: string; descricao?: string; carregando?: boolean; erro?: boolean; vazio?: boolean; retry?: () => void; children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-label={titulo}>
    <div><h2 className="font-semibold font-heading">{titulo}</h2>{descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}</div>
    {carregando ? <Skeleton className="h-48 w-full rounded-lg" />
      : erro ? <div className="space-y-2 text-sm text-muted-foreground"><p>Não foi possível carregar este bloco.</p>{retry && <Button variant="outline" size="sm" onClick={retry}>Tentar novamente</Button>}</div>
        : vazio ? <p className="text-sm text-muted-foreground py-8 text-center">Sem dados para exibir por enquanto.</p>
          : children}
  </section>;
}
