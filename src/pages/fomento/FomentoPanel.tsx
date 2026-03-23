import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Loader2, LayoutDashboard, FolderKanban, AlertTriangle, ShieldCheck } from "lucide-react";
import PanelLayout, { NavItem } from "@/components/layout/PanelLayout";
import FomentoDashboardView from "@/components/fomento/FomentoDashboardView";
import FomentoProjectsList from "@/components/fomento/FomentoProjectsList";
import FomentoProjectForm from "@/components/fomento/FomentoProjectForm";
import FomentoAlerts from "@/components/fomento/FomentoAlerts";
import FomentoAdmin from "@/components/fomento/FomentoAdmin";

const FomentoPanel = () => {
  const { loading, fomentoRole, signOut } = useFomentoAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Parse path: /fomento/projetos/abc/editar → ["projetos","abc","editar"]
  const segments = location.pathname.replace(/^\/fomento\/?/, "").split("/").filter(Boolean);
  const section = segments[0] || "dashboard";

  // Redirect bare /fomento to /fomento/dashboard
  if (!segments.length) {
    return <Navigate to="/fomento/dashboard" replace />;
  }

  const activeNav = section === "projetos" ? "projetos" : section;

  const navItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "projetos", label: "Projetos", icon: FolderKanban },
    { key: "alertas", label: "Alertas de Vigência", icon: AlertTriangle },
  ];

  if (fomentoRole === "admin") {
    navItems.push({ key: "admin", label: "Administração", icon: ShieldCheck });
  }

  const handleNavChange = (key: string) => {
    navigate(`/fomento/${key}`);
  };

  const handleEditProject = (id: string) => {
    navigate(`/fomento/projetos/${id}/editar`);
  };

  const handleNewProject = () => {
    navigate("/fomento/projetos/novo");
  };

  const handleBackToList = () => {
    navigate("/fomento/projetos");
  };

  // Determine which view to render
  const renderContent = () => {
    if (section === "dashboard") {
      return <FomentoDashboardView onEditProject={handleEditProject} />;
    }

    if (section === "projetos") {
      // /fomento/projetos/novo
      if (segments[1] === "novo") {
        return <FomentoProjectForm onBack={handleBackToList} />;
      }
      // /fomento/projetos/:id/editar
      if (segments[1] && segments[2] === "editar") {
        return <FomentoProjectForm projectId={segments[1]} onBack={handleBackToList} />;
      }
      // /fomento/projetos
      return <FomentoProjectsList onNewProject={handleNewProject} onEditProject={handleEditProject} />;
    }

    if (section === "alertas") {
      return <FomentoAlerts onEditProject={handleEditProject} />;
    }

    if (section === "admin" && fomentoRole === "admin") {
      return <FomentoAdmin />;
    }

    return <Navigate to="/fomento/dashboard" replace />;
  };

  return (
    <PanelLayout
      title="ProjetoGO Fomento"
      subtitle="Gestão de Captação de Recursos"
      navItems={navItems}
      activeNav={activeNav}
      onNavChange={handleNavChange}
      onSignOut={signOut}
    >
      {renderContent()}
    </PanelLayout>
  );
};

export default FomentoPanel;
