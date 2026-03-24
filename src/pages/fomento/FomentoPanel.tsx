import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Loader2, LayoutDashboard, FolderKanban, GraduationCap, AlertTriangle, ShieldCheck, Building2, Handshake, Lock } from "lucide-react";
import { toast } from "sonner";
import PanelLayout, { NavItem } from "@/components/layout/PanelLayout";
import FomentoDashboardView from "@/components/fomento/FomentoDashboardView";
import FomentoProjectsList from "@/components/fomento/FomentoProjectsList";
import FomentoProjectForm from "@/components/fomento/FomentoProjectForm";
import FomentoBatchImport from "@/components/fomento/FomentoBatchImport";
import FomentoBolsistasList from "@/components/fomento/FomentoBolsistasList";
import FomentoBolsistaForm from "@/components/fomento/FomentoBolsistaForm";
import FomentoBolsistaBatchImport from "@/components/fomento/FomentoBolsistaBatchImport";
import FomentoAlerts from "@/components/fomento/FomentoAlerts";
import FomentoAdmin from "@/components/fomento/FomentoAdmin";
import FomentoMasterPanel from "@/components/fomento/FomentoMasterPanel";
import FomentoParceirasList from "@/components/fomento/FomentoParceirasList";
import FomentoParceiraForm from "@/components/fomento/FomentoParceiraForm";

const FomentoPanel = () => {
  const { loading, fomentoRole, isSuperadmin, isAuditor, signOut } = useFomentoAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const segments = location.pathname.replace(/^\/fomento\/?/, "").split("/").filter(Boolean);
  const section = segments[0] || "dashboard";

  if (!segments.length) {
    return <Navigate to="/fomento/dashboard" replace />;
  }

  const activeNav = section === "projetos" ? "projetos" : section === "bolsistas" ? "bolsistas" : section === "parcerias" ? "parcerias" : section === "master" ? "master" : section;

  const navItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "projetos", label: "Projetos", icon: FolderKanban },
    { key: "bolsistas", label: "Bolsistas (Cotas)", icon: GraduationCap },
    { key: "alertas", label: "Alertas de Vigência", icon: AlertTriangle },
    { key: "parcerias", label: "Parcerias", icon: Handshake },
  ];

  if (fomentoRole === "admin" || isSuperadmin) {
    navItems.push({ key: "admin", label: "Administração", icon: ShieldCheck });
  }
  if (isSuperadmin) {
    navItems.push({ key: "master", label: "Organizações", icon: Building2 });
  }

  const handleNavChange = (key: string) => navigate(`/fomento/${key}`);

  const handleEditProject = (id: string) => navigate(`/fomento/projetos/${id}/editar`);
  const handleNewProject = () => navigate("/fomento/projetos/novo");
  const handleBatchImport = () => navigate("/fomento/projetos/importar-lote");
  const handleBackToProjects = () => navigate("/fomento/projetos");

  const handleEditBolsista = (id: string) => navigate(`/fomento/bolsistas/${id}/editar`);
  const handleNewBolsista = () => navigate("/fomento/bolsistas/novo");
  const handleBolsistaBatchImport = () => navigate("/fomento/bolsistas/importar-lote");
  const handleBackToBolsistas = () => navigate("/fomento/bolsistas");

  const handleEditParceria = (id: string) => navigate(`/fomento/parcerias/${id}/editar`);
  const handleNewParceria = () => navigate("/fomento/parcerias/nova");
  const handleBackToParcerias = () => navigate("/fomento/parcerias");

  const renderContent = () => {
    if (section === "dashboard") return <FomentoDashboardView onEditProject={handleEditProject} />;

    if (section === "projetos") {
      if (segments[1] === "novo") return <FomentoProjectForm onBack={handleBackToProjects} />;
      if (segments[1] === "importar-lote") return <FomentoBatchImport onBack={handleBackToProjects} />;
      if (segments[1] && segments[2] === "editar") return <FomentoProjectForm projectId={segments[1]} onBack={handleBackToProjects} />;
      return <FomentoProjectsList onNewProject={handleNewProject} onEditProject={handleEditProject} onBatchImport={handleBatchImport} />;
    }

    if (section === "bolsistas") {
      if (segments[1] === "novo") return <FomentoBolsistaForm onBack={handleBackToBolsistas} />;
      if (segments[1] === "importar-lote") return <FomentoBolsistaBatchImport onBack={handleBackToBolsistas} />;
      if (segments[1] && segments[2] === "editar") return <FomentoBolsistaForm bolsistaId={segments[1]} onBack={handleBackToBolsistas} />;
      return <FomentoBolsistasList onNewBolsista={handleNewBolsista} onEditBolsista={handleEditBolsista} onBatchImport={handleBolsistaBatchImport} />;
    }

    if (section === "alertas") return <FomentoAlerts onEditProject={handleEditProject} />;

    if (section === "parcerias") {
      if (segments[1] === "nova") return <FomentoParceiraForm onBack={handleBackToParcerias} />;
      if (segments[1] && segments[2] === "editar") return <FomentoParceiraForm parceriaId={segments[1]} onBack={handleBackToParcerias} />;
      return <FomentoParceirasList onNewParceria={handleNewParceria} onEditParceria={handleEditParceria} />;
    }

    if (section === "master" && isSuperadmin) {
      if (segments[1] === "nova") return <FomentoMasterPanel subRoute="nova" onNavigate={navigate} />;
      if (segments[1] && segments[2] === "editar") return <FomentoMasterPanel subRoute="editar" orgId={segments[1]} onNavigate={navigate} />;
      return <FomentoMasterPanel onNavigate={navigate} />;
    }

    if (section === "admin" && (isSuperadmin || fomentoRole === "admin")) return <FomentoAdmin />;

    if (section === "admin" && isAuditor) {
      toast.error("Acesso restrito. Você está em modo somente leitura.");
      return <Navigate to="/fomento/dashboard" replace />;
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
