import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ScrollText, FileEdit, Inbox, CalendarCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const OrgDashboard = ({ orgId }: { orgId: string }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ published: 0, draft: 0, proposals: 0, todayProposals: 0 });
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      const [pubRes, draftRes, propRes, todayRes] = await Promise.all([
        supabase.from("editais").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "published"),
        supabase.from("editais").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "draft"),
        supabase.from("proposals").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("proposals").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", new Date().toISOString().split("T")[0]),
      ]);

      setStats({
        published: pubRes.count || 0,
        draft: draftRes.count || 0,
        proposals: propRes.count || 0,
        todayProposals: todayRes.count || 0,
      });

      // Last 14 days chart
      const days: { date: string; count: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({ date: d.toISOString().split("T")[0], count: 0 });
      }

      const startDate = days[0].date;
      const { data: propsByDay } = await supabase
        .from("proposals")
        .select("created_at")
        .eq("organization_id", orgId)
        .gte("created_at", startDate);

      if (propsByDay) {
        propsByDay.forEach((p: any) => {
          const day = p.created_at.split("T")[0];
          const entry = days.find((d) => d.date === day);
          if (entry) entry.count++;
        });
      }

      setChartData(days.map((d) => ({
        date: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        count: d.count,
      })));

      setLoading(false);
    };
    fetch();
  }, [orgId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const cards = [
    { label: "Editais Publicados", value: stats.published, icon: ScrollText, color: "text-primary" },
    { label: "Editais em Rascunho", value: stats.draft, icon: FileEdit, color: "text-accent-foreground" },
    { label: "Propostas Recebidas", value: stats.proposals, icon: Inbox, color: "text-secondary-foreground" },
    { label: "Propostas Hoje", value: stats.todayProposals, icon: CalendarCheck, color: "text-primary" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold font-heading text-foreground mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${c.color}`}>
                <c.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submissões — Últimos 14 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Submissões" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrgDashboard;
