import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

/** Barras horizontais com o valor escrito ao lado: a leitura não depende da cor. */
export default function AbertosPorFonteChart({ dados, titulo }: { dados: { nome: string; total: number; cor: string }[]; titulo: string }) {
  const config: ChartConfig = { total: { label: "Abertos" } };
  return <>
    <ChartContainer config={config} className="w-full" style={{ height: Math.max(96, dados.length * 44) }} aria-hidden="true">
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="nome" width={110} tickLine={false} axisLine={false} fontSize={12} />
        <Bar dataKey="total" radius={4} barSize={22}>
          {dados.map(d => <Cell key={d.nome} fill={d.cor} />)}
          <LabelList dataKey="total" position="right" fontSize={12} className="fill-foreground" />
        </Bar>
      </BarChart>
    </ChartContainer>
    <table className="sr-only"><caption>{titulo}</caption><tbody>{dados.map(d => <tr key={d.nome}><th>{d.nome}</th><td>{d.total}</td></tr>)}</tbody></table>
  </>;
}
