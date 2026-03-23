import { useState } from "react";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Loader2, LayoutDashboard, FolderKanban, AlertTriangle, ShieldCheck } from "lucide-react";
import PanelLayout, { NavItem } from "@/components/layout/PanelLayout";
import FomentoDashboardView from "@/components/fomento/FomentoDashboardView";
import FomentoProjectsList from "@/components/fomento/FomentoProjectsList";
import FomentoProjectForm from "@/components/fomento/FomentoProjectForm";
import FomentoAlerts from "@/components/fomento/FomentoAlerts";
import FomentoAdmin from "@/components/fomento/FomentoAdmin";

type NavKey = "dashboard" | "projetos" | "alertas" | "admin";

const FomentoPanel = () => {
  const { loading, fomentoRole, signOut } = useFomentoAuth();
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const navItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "projetos", label: "Projetos", icon: FolderKanban },
    { key: "alertas", label: "Alertas de Vigência", icon: AlertTriangle },
  ];

  if (fomentoRole === "admin") {
    navItems.push({ key: "admin", label: "Administração", icon: ShieldCheck });
  }

  const handleNavChange = (key: string) => {
    setActiveNav(key as NavKey);
    setEditingProjectId(null);
    setCreatingProject(false);
  };

  const handleEditProject = (id: string) => {
    setEditingProjectId(id);
    setCreatingProject(false);
    setActiveNav("projetos");
  };

  const handleNewProject = () => {
    setCreatingProject(true);
    setEditingProjectId(null);
  };

  const handleBackToList = () => {
    setEditingProjectId(null);
    setCreatingProject(false);
  };

  return (
    <PanelLayout
      title="ProjetoGO Fomento"
      subtitle="PRPPGE · UVV"
      navItems={navItems}
      activeNav={activeNav}
      onNavChange={handleNavChange}
      onSignOut={signOut}
    >
      {activeNav === "dashboard" && (
        <FomentoDashboardView onEditProject={handleEditProject} />
      )}

      {activeNav === "projetos" && (
        editingProjectId ? (
          <FomentoProjectForm projectId={editingProjectId} onBack={handleBackToList} />
        ) : creatingProject ? (
          <FomentoProjectForm onBack={handleBackToList} />
        ) : (
          <FomentoProjectsList
            onNewProject={handleNewProject}
            onEditProject={handleEditProject}
          />
        )
      )}

      {activeNav === "alertas" && (
        <FomentoAlerts onEditProject={handleEditProject} />
      )}

      {activeNav === "admin" && fomentoRole === "admin" && (
        <FomentoAdmin />
      )}
    </PanelLayout>
  );
};

export default FomentoPanel;
