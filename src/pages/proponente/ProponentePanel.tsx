import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, LogOut, UserCircle, ScrollText, FolderOpen, Landmark } from "lucide-react";
import EditaisAbertos from "@/components/proponente/EditaisAbertos";
import MinhasPropostas from "@/components/proponente/MinhasPropostas";

const NAV_ITEMS = [
  { key: "editais", label: "Editais Abertos", icon: ScrollText },
  { key: "propostas", label: "Minhas Propostas", icon: FolderOpen },
] as const;

type NavKey = typeof NAV_ITEMS[number]["key"];

const ProponentePanel = () => {
  const { user, loading, membership, signOut } = useAuth();
  const [activeNav, setActiveNav] = useState<NavKey>("editais");

  // Listen for navigation events from child components (e.g., empty state CTA)
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "editais" || detail === "propostas") setActiveNav(detail);
    };
    window.addEventListener("navigate-proponente", handler);
    return () => window.removeEventListener("navigate-proponente", handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !membership) return <Navigate to="/login" replace />;

  const orgId = membership.organization_id;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold font-heading text-foreground">ProjetoGO</p>
              <p className="text-xs text-muted-foreground">Portal do Proponente</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveNav(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <Link to="/financeiro" className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Landmark className="w-4 h-4" /> Gestão Financeira
          </Link>
          <Link to="/profile" className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <UserCircle className="w-4 h-4" /> Meu Cadastro
          </Link>
          <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {activeNav === "editais" && <EditaisAbertos orgId={orgId} userId={user.id} onStartProposal={() => setActiveNav("propostas")} />}
          {activeNav === "propostas" && <MinhasPropostas orgId={orgId} userId={user.id} />}
        </div>
      </main>
    </div>
  );
};

export default ProponentePanel;
