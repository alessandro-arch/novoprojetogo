import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { fmtReais } from "@/lib/operon-valores";

const compacto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

/** Barras horizontais em reais, com o valor escrito ao lado e tabela acessível. */
export default function ValoresBarrasChart({ dados, titulo }: { dados: { nome: string; valor: number; nota?: string }[]; titulo: string }) {
  const config: ChartConfig = { valor: { label: "Valor confirmado", color: "hsl(var(--primary))" } };
  return <>
    <ChartContainer config={config} className="w-full" style={{ height: Math.max(96, dados.length * 44) }} aria-hidden="true">
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 88, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nome" width={110} tickLine={false} axisLine={false} fontSize={12} />
        <Bar dataKey="valor" radius={4} barSize={22} fill="var(--color-valor)">
          <LabelList dataKey="valor" position="right" fontSize={12} className="fill-foreground" formatter={(v: number) => compacto.format(v)} />
        </Bar>
      </BarChart>
    </ChartContainer>
    <table className="sr-only"><caption>{titulo}</caption><tbody>{dados.map(d => <tr key={d.nome}><th>{d.nome}</th><td>{fmtReais(d.valor)}{d.nota ? ` (${d.nota})` : ""}</td></tr>)}</tbody></table>
  </>;
}
