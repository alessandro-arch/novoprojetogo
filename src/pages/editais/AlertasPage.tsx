import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TelegramAlertas from "@/components/operon/TelegramAlertas";
import FonteBadge from "@/components/operon/FonteBadge";
import { SeguirEditalCompacto } from "@/components/operon/SeguirEditalButton";
import { ErroOperon, PrazoTexto } from "@/components/operon/PortalEditalUI";
import { usePortalOperon } from "@/components/operon/usePortalOperon";

export default function AlertasPage() {
  const { user, lista, seguidos, seguidosIds } = usePortalOperon();
  const editais = (lista.data ?? []).filter(e => seguidosIds.has(e.id));
  return <>
    <div className="space-y-1"><h1 className="text-2xl md:text-3xl font-bold font-heading">Meus alertas</h1><p className="text-sm text-muted-foreground">Escolha como receber avisos dos editais que você segue.</p></div>
    <section className="rounded-xl border border-border bg-card p-4 flex items-start gap-3" aria-label="E-mail">
      <Mail className="h-5 w-5 mt-0.5 text-primary" aria-hidden="true" />
      <div><h2 className="font-semibold">E-mail, canal padrão</h2><p className="text-sm text-muted-foreground">Avisos dos editais seguidos chegam em {user?.email ?? "seu e-mail"}.</p></div>
    </section>
    <section id="meus-alertas" aria-label="Telegram" tabIndex={-1} className="scroll-mt-20 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><TelegramAlertas /></section>
    <section className="space-y-3" aria-labelledby="seguidos-titulo">
      <h2 id="seguidos-titulo" className="font-semibold font-heading">Editais seguidos {seguidos.data && <span className="text-muted-foreground tabular-nums">({seguidosIds.size})</span>}</h2>
      {lista.isLoading || seguidos.isLoading ? <Skeleton className="h-24 rounded-xl" />
        : lista.isError || seguidos.isError ? <ErroOperon retry={() => { lista.refetch(); seguidos.refetch(); }} />
          : !editais.length ? <p className="text-sm text-muted-foreground">Você ainda não segue nenhum edital. Use o botão Seguir em <Link to="/editais/chamadas" className="underline">Chamadas</Link>.</p>
            : <ul className="divide-y divide-border rounded-xl border border-border bg-card">{editais.map(e => <li key={e.id} className="p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1"><Link to={`/editais/${e.id}`} className="font-medium hover:underline break-words">{e.titulo}</Link><div className="flex flex-wrap items-center gap-2"><FonteBadge slug={e.oe_fonte?.slug} nome={e.oe_fonte?.nome} /><PrazoTexto e={e} /></div></div>
              <SeguirEditalCompacto editalId={e.id} seguindo titulo={e.titulo} />
            </li>)}</ul>}
    </section>
  </>;
}
