import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2, ScrollText, FolderOpen, Landmark } from "lucide-react";
import PanelLayout from "@/components/layout/PanelLayout";
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
    <PanelLayout
      title="ProjetoGO"
      subtitle="Portal do Proponente"
      navItems={[...NAV_ITEMS]}
      activeNav={activeNav}
      onNavChange={(k) => setActiveNav(k as NavKey)}
      onSignOut={signOut}
      footerLinks={[
        { to: "/financeiro", label: "Gestão Financeira", icon: Landmark },
      ]}
    >
      {activeNav === "editais" && <EditaisAbertos orgId={orgId} userId={user.id} onStartProposal={() => setActiveNav("propostas")} />}
      {activeNav === "propostas" && <MinhasPropostas orgId={orgId} userId={user.id} />}
    </PanelLayout>
  );
};

export default ProponentePanel;
