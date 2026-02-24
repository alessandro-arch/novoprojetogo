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
    {
      label: "Editais Publicados",
      value: stats.published,
      icon: ScrollText,
      borderColor: "border-l-primary",
      iconBg: "bg-info-light",
      iconColor: "text-primary",
    },
    {
      label: "Editais em Rascunho",
      value: stats.draft,
      icon: FileEdit,
      borderColor: "border-l-warning",
      iconBg: "bg-warning-light",
      iconColor: "text-warning",
    },
    {
      label: "Propostas Recebidas",
      value: stats.proposals,
      icon: Inbox,
      borderColor: "border-l-success",
      iconBg: "bg-success-light",
      iconColor: "text-success",
    },
    {
      label: "Propostas Hoje",
      value: stats.todayProposals,
      icon: CalendarCheck,
      borderColor: "border-l-secondary",
      iconBg: "bg-warning-light",
      iconColor: "text-secondary",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold font-heading text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da organização</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label} className={`border-l-4 ${c.borderColor} shadow-card hover:shadow-card-hover transition-shadow duration-200`}>
            <CardContent className="p-4 md:p-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl md:text-3xl font-bold text-foreground">{c.value}</p>
                <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">{c.label}</p>
              </div>
              <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0`}>
                <c.icon className={`w-5 h-5 ${c.iconColor}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base md:text-lg font-semibold">Submissões — Últimos 14 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "var(--shadow-md)",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Submissões" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrgDashboard;
