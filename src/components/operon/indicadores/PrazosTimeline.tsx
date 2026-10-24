import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export default function PrazosTimeline({ dados }: { dados: { semana: number; rotulo: string; total: number }[] }) {
  const config: ChartConfig = { total: { label: "Prazos na semana", color: "hsl(var(--primary))" } };
  return <>
    <ChartContainer config={config} className="h-48 w-full" aria-hidden="true">
      <BarChart data={dados} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(l) => `Semana de ${l}`} />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={4}><LabelList dataKey="total" position="top" fontSize={11} formatter={(v: number) => v || ""} /></Bar>
      </BarChart>
    </ChartContainer>
    <table className="sr-only"><caption>Prazos por semana nos próximos 60 dias</caption><tbody>{dados.map(d => <tr key={d.semana}><th>Semana de {d.rotulo}</th><td>{d.total}</td></tr>)}</tbody></table>
  </>;
}
