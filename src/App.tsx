import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin/*" element={<ProtectedRoute allowedRoles={["icca_admin"]}><AdminPanel /></ProtectedRoute>} />
            <Route path="/org/*" element={<ProtectedRoute allowedRoles={["org_admin", "edital_manager"]}><OrgPanel /></ProtectedRoute>} />
            <Route path="/proponente/*" element={<ProtectedRoute allowedRoles={["proponente"]}><ProponentePanel /></ProtectedRoute>} />
            <Route path="/reviewer/terms" element={<ProtectedRoute allowedRoles={["reviewer"]}><ReviewerTermsPage /></ProtectedRoute>} />
            <Route path="/reviewer/*" element={<ProtectedRoute allowedRoles={["reviewer"]}><ReviewerTermsGate><ReviewerPanel /></ReviewerTermsGate></ProtectedRoute>} />
            <Route path="/financeiro/*" element={<ProtectedRoute allowedRoles={["proponente"]}><FinanceiroPanel /></ProtectedRoute>} />
            <Route path="/avaliador" element={<ReviewerLoginPage />} />
            <Route path="/invite/reviewer" element={<ReviewerInvitePage />} />
            <Route path="/reviewer/activate" element={<ReviewerActivatePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
