import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FomentoAuthProvider } from "@/contexts/FomentoAuthContext";
import ViewAsBar from "@/components/ViewAsSwitcher";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/admin/AdminPanel";
import OrgPanel from "./pages/org/OrgPanel";
import ProponentePanel from "./pages/proponente/ProponentePanel";
import ReviewerPanel from "./pages/reviewer/ReviewerPanel";
import FinanceiroPanel from "./pages/financeiro/FinanceiroPanel";
import Profile from "./pages/Profile";
import ReviewerInvitePage from "./pages/invite/ReviewerInvitePage";
import ReviewerActivatePage from "./pages/reviewer/ReviewerActivatePage";
import ReviewerLoginPage from "./pages/reviewer/ReviewerLoginPage";
import ReviewerTermsPage from "./pages/reviewer/ReviewerTermsPage";
import ReviewerTermsGate from "./components/ReviewerTermsGate";
import NotFound from "./pages/NotFound";
import FomentoLogin from "./pages/fomento/FomentoLogin";
import FomentoPanel from "./pages/fomento/FomentoPanel";
import FomentoProtectedRoute from "./components/FomentoProtectedRoute";
import ServiceDeskPanel from "./pages/servicedesk/ServiceDeskPanel";
import ServiceDeskLogin from "./pages/servicedesk/ServiceDeskLogin";
import ServiceDeskFirstAccess from "./pages/servicedesk/ServiceDeskFirstAccess";
import VpnUvv from "./pages/VpnUvv";
import CuradoriaPage from "./pages/editais/CuradoriaPage";
import OperonLayout from "./pages/editais/OperonLayout";
import VisaoGeralPage from "./pages/editais/VisaoGeralPage";
import ChamadasPage from "./pages/editais/ChamadasPage";
import PrazosPage from "./pages/editais/PrazosPage";
import ValoresPage from "./pages/editais/ValoresPage";
import AlertasPage from "./pages/editais/AlertasPage";
import FontesPage from "./pages/editais/FontesPage";
import ColetasPage from "./pages/editais/ColetasPage";
import EditalFichaPage from "./pages/editais/EditalFichaPage";
import EditaisLogin from "./pages/editais/EditaisLogin";
import OperonAccessGate from "./components/operon/OperonAccessGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FomentoAuthProvider>
            <ViewAsBar />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/admin/*" element={<ProtectedRoute allowedRoles={["icca_admin"]}><AdminPanel /></ProtectedRoute>} />
              <Route path="/editais/login" element={<EditaisLogin />} />
              <Route path="/editais/curadoria" element={<ProtectedRoute allowedRoles={["icca_admin"]} loginPath="/editais/login"><CuradoriaPage /></ProtectedRoute>} />
              {/* TODO: controle por plano e afiliação institucional em etapa posterior */}
              <Route path="/editais" element={<ProtectedRoute loginPath="/editais/login"><OperonAccessGate><OperonLayout /></OperonAccessGate></ProtectedRoute>}>
                <Route index element={<VisaoGeralPage />} />
                <Route path="chamadas" element={<ChamadasPage />} />
                <Route path="prazos" element={<PrazosPage />} />
                <Route path="valores" element={<ValoresPage />} />
                <Route path="alertas" element={<AlertasPage />} />
                <Route path="fontes" element={<FontesPage />} />
                <Route path="coletas" element={<ProtectedRoute allowedRoles={["icca_admin"]} loginPath="/editais/login"><ColetasPage /></ProtectedRoute>} />
                <Route path=":id" element={<EditalFichaPage />} />
              </Route>
              <Route path="/org/*" element={<ProtectedRoute allowedRoles={["org_admin", "edital_manager"]}><OrgPanel /></ProtectedRoute>} />
              <Route path="/proponente/*" element={<ProtectedRoute allowedRoles={["proponente"]}><ProponentePanel /></ProtectedRoute>} />
              <Route path="/reviewer/terms" element={<ProtectedRoute allowedRoles={["reviewer"]}><ReviewerTermsPage /></ProtectedRoute>} />
              <Route path="/reviewer/*" element={<ProtectedRoute allowedRoles={["reviewer"]}><ReviewerTermsGate><ReviewerPanel /></ReviewerTermsGate></ProtectedRoute>} />
              <Route path="/financeiro/*" element={<ProtectedRoute allowedRoles={["proponente"]}><FinanceiroPanel /></ProtectedRoute>} />
              <Route path="/avaliador" element={<ReviewerLoginPage />} />
              <Route path="/invite/reviewer" element={<ReviewerInvitePage />} />
              <Route path="/reviewer/activate" element={<ReviewerActivatePage />} />
              <Route path="/fomento/login" element={<FomentoLogin />} />
              <Route path="/fomento/*" element={<FomentoProtectedRoute><FomentoPanel /></FomentoProtectedRoute>} />
              <Route path="/servicedesk/login" element={<ServiceDeskLogin />} />
              <Route path="/servicedesk/primeiro-acesso" element={<ServiceDeskFirstAccess />} />
              <Route path="/vpn-uvv" element={<VpnUvv />} />
              <Route path="/servicedesk/*" element={<ProtectedRoute loginPath="/servicedesk/login"><ServiceDeskPanel /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </FomentoAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
