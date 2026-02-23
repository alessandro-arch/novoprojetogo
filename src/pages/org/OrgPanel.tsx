import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2, LayoutDashboard, ScrollText, Users, Shield, UserSearch, BookOpen } from "lucide-react";
import PanelLayout from "@/components/layout/PanelLayout";
import OrgDashboard from "@/components/org/OrgDashboard";
import EditaisList from "@/components/org/EditaisList";
import AuditLogViewer from "@/components/org/AuditLogViewer";
import ReviewersList from "@/components/org/reviewers/ReviewersList";
import ReviewerDetail from "@/components/org/reviewers/ReviewerDetail";
import FormLibraryList from "@/components/org/FormLibraryList";
import FormLibraryEditor from "@/components/org/FormLibraryEditor";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "editais", label: "Editais", icon: ScrollText },
  { key: "forms", label: "Formulários", icon: BookOpen },
  { key: "reviewers", label: "Avaliadores", icon: UserSearch },
  { key: "members", label: "Membros", icon: Users },
  { key: "audit", label: "Auditoria", icon: Shield },
] as const;

type NavKey = typeof NAV_ITEMS[number]["key"];

const OrgPanel = () => {
  const { user, loading, membership, signOut } = useAuth();
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");
  const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !membership) return <Navigate to="/login" replace />;

  const orgId = membership.organization_id;

  const handleNavChange = (key: string) => {
    setActiveNav(key as NavKey);
    setSelectedReviewerId(null);
    setEditingFormId(null);
  };

  return (
    <PanelLayout
      title="ProjetoGO"
      subtitle="Painel da Organização"
      navItems={[...NAV_ITEMS]}
      activeNav={activeNav}
      onNavChange={handleNavChange}
      onSignOut={signOut}
    >
      {activeNav === "dashboard" && <OrgDashboard orgId={orgId} />}
      {activeNav === "editais" && <EditaisList orgId={orgId} />}
      {activeNav === "forms" && (
        editingFormId ? (
          <FormLibraryEditor formId={editingFormId} orgId={orgId} onBack={() => setEditingFormId(null)} />
        ) : (
          <FormLibraryList orgId={orgId} onEditForm={(id) => setEditingFormId(id)} />
        )
      )}
      {activeNav === "reviewers" && (
        selectedReviewerId ? (
          <ReviewerDetail reviewerId={selectedReviewerId} orgId={orgId} onBack={() => setSelectedReviewerId(null)} />
        ) : (
          <ReviewersList orgId={orgId} onViewReviewer={(id) => setSelectedReviewerId(id)} />
        )
      )}
      {activeNav === "members" && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Gestão de membros será implementada na próxima iteração.</p>
        </div>
      )}
      {activeNav === "audit" && <AuditLogViewer orgId={orgId} />}
    </PanelLayout>
  );
};

export default OrgPanel;
