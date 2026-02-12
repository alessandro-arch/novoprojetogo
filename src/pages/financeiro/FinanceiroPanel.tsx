import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Loader2, Landmark, LogOut, UserCircle, Building2, FileText, ArrowLeftRight, CreditCard, BarChart3 } from "lucide-react";
import ProjectSelector from "@/components/financeiro/ProjectSelector";
import BankAccountsManager from "@/components/financeiro/BankAccountsManager";
import BankStatementsManager from "@/components/financeiro/BankStatementsManager";
import TransactionsManager from "@/components/financeiro/TransactionsManager";
import ReconciliationManager from "@/components/financeiro/ReconciliationManager";
import FinancialReports from "@/components/financeiro/FinancialReports";

const NAV_ITEMS = [
  { key: "contas", label: "Contas Bancárias", icon: Building2 },
  { key: "extratos", label: "Extratos", icon: FileText },
  { key: "transacoes", label: "Transações", icon: CreditCard },
  { key: "conciliacao", label: "Conciliação", icon: ArrowLeftRight },
  { key: "relatorios", label: "Relatórios", icon: BarChart3 },
] as const;

type NavKey = typeof NAV_ITEMS[number]["key"];

const FinanceiroPanel = () => {
  const { user, loading, membership, signOut } = useAuth();
  const [activeNav, setActiveNav] = useState<NavKey>("contas");
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

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
              <Landmark className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold font-heading text-foreground">ProjetoGO</p>
              <p className="text-xs text-muted-foreground">Gestão Financeira</p>
            </div>
          </div>
        </div>

        <div className="p-3 border-b border-border">
          <ProjectSelector
            userId={user.id}
            orgId={orgId}
            selectedId={selectedExecutionId}
            onSelect={setSelectedExecutionId}
          />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveNav(item.key)}
              disabled={!selectedExecutionId}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <Link to="/proponente" className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Landmark className="w-4 h-4" /> Voltar ao Painel
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
          {!selectedExecutionId ? (
            <div className="text-center py-20 text-muted-foreground">
              <Landmark className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Selecione um Projeto</h2>
              <p className="text-sm">Escolha um projeto na barra lateral para gerenciar as finanças.</p>
            </div>
          ) : (
            <>
              {activeNav === "contas" && <BankAccountsManager executionId={selectedExecutionId} userId={user.id} />}
              {activeNav === "extratos" && <BankStatementsManager executionId={selectedExecutionId} userId={user.id} />}
              {activeNav === "transacoes" && <TransactionsManager executionId={selectedExecutionId} />}
              {activeNav === "conciliacao" && <ReconciliationManager executionId={selectedExecutionId} userId={user.id} />}
              {activeNav === "relatorios" && <FinancialReports executionId={selectedExecutionId} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default FinanceiroPanel;
