import { Link, Outlet } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import OperonSidebar from "@/components/operon/OperonSidebar";
import OperonUserMenu from "@/components/operon/OperonUserMenu";
import { RodapeOperon } from "@/components/operon/PortalEditalUI";

export default function OperonLayout() {
  return <TooltipProvider delayDuration={200}>
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <OperonSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 border-b border-border bg-card">
            <div className="px-3 md:px-6 h-14 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger aria-label="Abrir ou recolher o menu" className="h-10 w-10" />
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-primary-foreground" /></div>
                <span className="font-bold font-heading truncate">Operon Fomento</span>
              </div>
              <div className="flex items-center gap-1"><Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft />Voltar</Link></Button><OperonUserMenu /></div>
            </div>
          </header>
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6"><Outlet /></main>
          <RodapeOperon />
        </div>
      </div>
    </SidebarProvider>
  </TooltipProvider>;
}
