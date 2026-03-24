import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Loader2, LayoutDashboard, FolderKanban, AlertTriangle, ShieldCheck, Building2 } from "lucide-react";
import PanelLayout, { NavItem } from "@/components/layout/PanelLayout";
import FomentoDashboardView from "@/components/fomento/FomentoDashboardView";
import FomentoProjectsList from "@/components/fomento/FomentoProjectsList";
import FomentoProjectForm from "@/components/fomento/FomentoProjectForm";
import FomentoAlerts from "@/components/fomento/FomentoAlerts";
import FomentoAdmin from "@/components/fomento/FomentoAdmin";
import FomentoMasterPanel from "@/components/fomento/FomentoMasterPanel";

const FomentoPanel = () => {
  const { loading, fomentoRole, isSuperadmin, signOut } = useFomentoAuth();
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

  const activeNav = section === "projetos" ? "projetos" : section === "master" ? "master" : section;

  const navItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "projetos", label: "Projetos", icon: FolderKanban },
    { key: "alertas", label: "Alertas de Vigência", icon: AlertTriangle },
  ];

  // Admin de org pode ver Administração (gestão de usuários da própria org)
  if (fomentoRole === "admin" || isSuperadmin) {
    navItems.push({ key: "admin", label: "Administração", icon: ShieldCheck });
  }

  // Apenas superadmin vê Organizações (painel master)
  if (isSuperadmin) {
    navItems.push({ key: "master", label: "Organizações", icon: Building2 });
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
      if (segments[1] === "novo") {
        return <FomentoProjectForm onBack={handleBackToList} />;
      }
      if (segments[1] && segments[2] === "editar") {
        return <FomentoProjectForm projectId={segments[1]} onBack={handleBackToList} />;
      }
      return <FomentoProjectsList onNewProject={handleNewProject} onEditProject={handleEditProject} />;
    }

    if (section === "alertas") {
      return <FomentoAlerts onEditProject={handleEditProject} />;
    }

    // Painel master: APENAS superadmin
    if (section === "master" && isSuperadmin) {
      if (segments[1] === "nova") {
        return <FomentoMasterPanel subRoute="nova" onNavigate={navigate} />;
      }
      if (segments[1] && segments[2] === "editar") {
        return <FomentoMasterPanel subRoute="editar" orgId={segments[1]} onNavigate={navigate} />;
      }
      return <FomentoMasterPanel onNavigate={navigate} />;
    }

    // Administração: superadmin ou admin de org
    if (section === "admin" && (isSuperadmin || fomentoRole === "admin")) {
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
