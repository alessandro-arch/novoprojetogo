import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Mail, UserCheck, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { carregarIndicadoresUsuarios, ehFuncaoAusente, type IndicadoresUsuarios } from "@/lib/operon-indicadores-usuarios";

const CARTOES: { chave: keyof Pick<IndicadoresUsuarios, "usuarios_com_acesso" | "com_telegram" | "com_email_ativo" | "seguindo_algum">; titulo: string; icone: typeof Users }[] = [
  { chave: "usuarios_com_acesso", titulo: "Usuários com acesso", icone: Users },
  { chave: "com_email_ativo", titulo: "Com e-mail ativo", icone: Mail },
  { chave: "com_telegram", titulo: "Com Telegram", icone: Bell },
  { chave: "seguindo_algum", titulo: "Seguindo ao menos um edital", icone: UserCheck },
];

const rotuloEdital = (e: { numero: string | null; ano: number | null; titulo: string }) =>
  `${e.numero?.trim() ? `Nº ${e.numero}${e.ano ? `/${e.ano}` : ""} · ` : ""}${e.titulo}`;

/** Indicadores agregados de usuários do portal, somente para icca_admin. Nenhum dado pessoal. */
export default function IndicadoresUsuarios() {
  const { globalRole } = useAuth();
  const habilitado = globalRole === "icca_admin";
  const q = useQuery({ queryKey: ["oe-indicadores-usuarios"], queryFn: carregarIndicadoresUsuarios, enabled: habilitado, retry: false });
  if (!habilitado) return null;
  return <section aria-labelledby="indicadores-usuarios" className="space-y-3">
    <div className="space-y-1">
      <h2 id="indicadores-usuarios" className="text-lg font-bold font-heading text-foreground">Indicadores de usuários</h2>
      <p className="text-sm text-muted-foreground">Somente totais agregados. Nenhum dado pessoal é exibido.</p>
    </div>
    {q.isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      : q.isError ? (ehFuncaoAusente(q.error)
        ? <p role="status" className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">Disponível após a ativação da consulta agregada.</p>
        : <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <p role="alert" className="text-sm text-destructive">Não foi possível carregar os indicadores de usuários.</p>
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>Tentar novamente</Button>
        </div>)
        : q.data && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CARTOES.map(({ chave, titulo, icone: Icone }) => <div key={chave} className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Icone className="h-4 w-4" aria-hidden="true" />{titulo}</p>
              <p className="text-3xl font-bold font-heading tabular-nums">{q.data[chave]}</p>
            </div>)}
          </div>
          {q.data.mais_seguidos.length > 0 && <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-semibold">Editais mais seguidos</h3>
            <ul className="space-y-1">
              {q.data.mais_seguidos.slice(0, 5).map(e => <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <Link to={`/editais/${e.id}`} className="break-words text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">{rotuloEdital(e)}</Link>
                <span className="shrink-0 tabular-nums text-muted-foreground">{e.seguidores} {e.seguidores === 1 ? "seguidor" : "seguidores"}</span>
              </li>)}
            </ul>
          </div>}
        </>}
  </section>;
}
