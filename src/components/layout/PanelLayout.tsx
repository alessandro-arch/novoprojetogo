import { useState } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { FileText, LogOut, UserCircle, Menu } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PanelLayoutProps {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  activeNav: string;
  onNavChange: (key: string) => void;
  onSignOut: () => void;
  footerLinks?: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  children: React.ReactNode;
}

const SidebarContent = ({
  title,
  subtitle,
  navItems,
  activeNav,
  onNavChange,
  onSignOut,
  footerLinks,
  onItemClick,
}: Omit<PanelLayoutProps, "children"> & { onItemClick?: () => void }) => (
  <div className="flex flex-col h-full">
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
          <FileText className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold font-heading text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>

    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {navItems.map((item) => (
        <button
          key={item.key}
          onClick={() => { onNavChange(item.key); onItemClick?.(); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-200 ${
            activeNav === item.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {item.label}
        </button>
      ))}
    </nav>

    <div className="p-3 border-t border-border space-y-1">
      {footerLinks?.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          onClick={onItemClick}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <link.icon className="w-4 h-4 shrink-0" />
          {link.label}
        </Link>
      ))}
      <Link
        to="/profile"
        onClick={onItemClick}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <UserCircle className="w-4 h-4 shrink-0" /> Meu Cadastro
      </Link>
      <button
        onClick={() => { onSignOut(); onItemClick?.(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <LogOut className="w-4 h-4 shrink-0" /> Sair
      </button>
    </div>
  </div>
);

const PanelLayout = (props: PanelLayoutProps) => {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentNav = props.navItems.find((n) => n.key === props.activeNav);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SidebarContent {...props} onItemClick={() => setDrawerOpen(false)} />
                </SheetContent>
              </Sheet>
              <div>
                <p className="text-sm font-bold font-heading text-foreground">{props.title}</p>
                <p className="text-[11px] text-muted-foreground">{currentNav?.label}</p>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 border-r border-border bg-card flex-shrink-0 sticky top-0 h-screen overflow-y-auto transition-all duration-300">
          <SidebarContent {...props} />
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="px-4 py-6 md:px-8 md:py-8 lg:px-12">
          {props.children}
        </div>
      </main>
    </div>
  );
};

export default PanelLayout;
