import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, LogOut, UserCircle, LayoutDashboard, ScrollText, Users, Shield, UserSearch, BookOpen } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold font-heading text-foreground">ProjetoGO</p>
              <p className="text-xs text-muted-foreground">Painel da Organização</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => { setActiveNav(item.key); setSelectedReviewerId(null); setEditingFormId(null); }}
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
          <Link to="/profile" className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <UserCircle className="w-4 h-4" /> Meu Cadastro
          </Link>
          <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {activeNav === "dashboard" && <OrgDashboard orgId={orgId} />}
          {activeNav === "editais" && <EditaisList orgId={orgId} />}
          {activeNav === "forms" && (
            editingFormId ? (
              <FormLibraryEditor
                formId={editingFormId}
                orgId={orgId}
                onBack={() => setEditingFormId(null)}
              />
            ) : (
              <FormLibraryList
                orgId={orgId}
                onEditForm={(id) => setEditingFormId(id)}
              />
            )
          )}
          {activeNav === "reviewers" && (
            selectedReviewerId ? (
              <ReviewerDetail
                reviewerId={selectedReviewerId}
                orgId={orgId}
                onBack={() => setSelectedReviewerId(null)}
              />
            ) : (
              <ReviewersList
                orgId={orgId}
                onViewReviewer={(id) => setSelectedReviewerId(id)}
              />
            )
          )}
          {activeNav === "members" && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Gestão de membros será implementada na próxima iteração.</p>
            </div>
          )}
          {activeNav === "audit" && <AuditLogViewer orgId={orgId} />}
        </div>
      </main>
    </div>
  );
};

export default OrgPanel;
