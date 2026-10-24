import { NavLink, useLocation } from "react-router-dom";
import { Bell, CalendarDays, FileCheck2, LayoutDashboard, Activity, Landmark, ListChecks, CircleDollarSign, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export interface ItemMenuOperon { titulo: string; url: string; icone: LucideIcon; fim?: boolean }
export const ITENS_PORTAL: ItemMenuOperon[] = [
  { titulo: "Visão geral", url: "/editais", icone: LayoutDashboard, fim: true },
  { titulo: "Chamadas", url: "/editais/chamadas", icone: ListChecks },
  { titulo: "Valores", url: "/editais/valores", icone: CircleDollarSign },
  { titulo: "Prazos", url: "/editais/prazos", icone: CalendarDays },
  { titulo: "Meus alertas", url: "/editais/alertas", icone: Bell },
  { titulo: "Fontes", url: "/editais/fontes", icone: Landmark },
];
export const ITENS_CURADORIA: ItemMenuOperon[] = [
  { titulo: "Curadoria", url: "/editais/curadoria", icone: FileCheck2 },
  { titulo: "Saúde das coletas", url: "/editais/coletas", icone: Activity },
];
/** Mesma regra do menu do usuário: papel global efetivo (já considera o Ver como). */
export const itensCuradoria = (globalRole: string | null | undefined) => globalRole === "icca_admin" ? ITENS_CURADORIA : [];

export default function OperonSidebar() {
  const { globalRole } = useAuth();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const recolhido = state === "collapsed" && !isMobile;
  const { pathname } = useLocation();
  const ativo = (i: ItemMenuOperon) => i.fim ? pathname === i.url : pathname.startsWith(i.url);
  const grupo = (rotulo: string, itens: ItemMenuOperon[]) => <SidebarGroup>
    <SidebarGroupLabel>{rotulo}</SidebarGroupLabel>
    <SidebarGroupContent><SidebarMenu>{itens.map(i => <SidebarMenuItem key={i.url}>
      <SidebarMenuButton asChild isActive={ativo(i)} tooltip={i.titulo}>
        <NavLink to={i.url} end={i.fim} onClick={() => isMobile && setOpenMobile(false)} className="min-h-11"><i.icone className="h-4 w-4" />{!recolhido && <span>{i.titulo}</span>}</NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
  </SidebarGroup>;
  const admin = itensCuradoria(globalRole);
  return <Sidebar collapsible="icon" aria-label="Menu do Operon Fomento">
    <SidebarContent>
      {grupo("Portal", ITENS_PORTAL)}
      {admin.length > 0 && grupo("Administração", admin)}
    </SidebarContent>
  </Sidebar>;
}
