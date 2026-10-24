import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { corFonte } from "./cores";
import type { SerieFonte } from "@/lib/operon-indicadores";

export default function LancamentosPorMesChart({ dados, fontes }: { dados: Record<string, string | number>[]; fontes: SerieFonte[] }) {
  const config: ChartConfig = Object.fromEntries(fontes.map(f => [f.slug, { label: f.nome, color: corFonte(f.slug) }]));
  return <>
    <ChartContainer config={config} className="h-64 w-full" aria-hidden="true">
      <BarChart data={dados} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {fontes.map((f, i) => <Bar key={f.slug} dataKey={f.slug} stackId="m" fill={`var(--color-${f.slug})`} stroke="hsl(var(--card))" strokeWidth={1}>
          {i === fontes.length - 1 && <LabelList dataKey="total" position="top" fontSize={11} formatter={(v: number) => v || ""} />}
        </Bar>)}
      </BarChart>
    </ChartContainer>
    <table className="sr-only"><caption>Lançamentos por mês e por agência</caption><thead><tr><th>Mês</th>{fontes.map(f => <th key={f.slug}>{f.nome}</th>)}<th>Total</th></tr></thead>
      <tbody>{dados.map(d => <tr key={String(d.mes)}><td>{d.rotulo}</td>{fontes.map(f => <td key={f.slug}>{d[f.slug] ?? 0}</td>)}<td>{d.total}</td></tr>)}</tbody></table>
  </>;
}
