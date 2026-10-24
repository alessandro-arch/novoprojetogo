import Bloco from "./Bloco";
import LancamentosPorMesChart from "./LancamentosPorMesChart";
import AbertosPorFonteChart from "./AbertosPorFonteChart";
import PrazosTimeline from "./PrazosTimeline";
import { corEsfera, corFonte } from "./cores";
import { abertosPorEsfera, abertosPorFonte, lancamentosPorMes, prazosPorSemana } from "@/lib/operon-indicadores";
import type { EditalPublicado } from "@/lib/operon-portal";

export default function GraficosVisaoGeral({ rows, carregando, erro, retry }: { rows: EditalPublicado[]; carregando: boolean; erro: boolean; retry: () => void }) {
  const agora = Date.now();
  const lanc = lancamentosPorMes(rows, agora);
  const porFonte = abertosPorFonte(rows, agora).map(f => ({ nome: f.nome, total: f.total, cor: corFonte(f.slug) }));
  const porEsfera = abertosPorEsfera(rows, agora).map(e => ({ nome: e.nome, total: e.total, cor: corEsfera(e.esfera) }));
  const semanas = prazosPorSemana(rows, agora);
  const estado = { carregando, erro, retry };
  return <>
    <Bloco titulo="Lançamentos por mês e por agência" descricao="Últimos 12 meses, pela data de publicação." {...estado} vazio={!lanc.fontes.length}>
      <LancamentosPorMesChart dados={lanc.dados} fontes={lanc.fontes} />
    </Bloco>
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloco titulo="Abertos por fonte" {...estado} vazio={!porFonte.length}><AbertosPorFonteChart dados={porFonte} titulo="Abertos por fonte" /></Bloco>
      <Bloco titulo="Abertos por esfera" {...estado} vazio={porEsfera.every(e => !e.total)}><AbertosPorFonteChart dados={porEsfera} titulo="Abertos por esfera" /></Bloco>
    </div>
    <Bloco titulo="Prazos nos próximos 60 dias" descricao="Quantidade de prazos de submissão por semana." {...estado} vazio={semanas.every(s => !s.total)}>
      <PrazosTimeline dados={semanas} />
    </Bloco>
  </>;
}
