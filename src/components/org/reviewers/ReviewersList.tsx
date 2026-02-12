import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Plus, Search, Eye, MoreVertical, Ban, RefreshCw, UserCheck, Trash2, Filter, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NewReviewerModal from "./NewReviewerModal";
import EditReviewerModal from "./EditReviewerModal";
import DeleteReviewerDialog from "./DeleteReviewerDialog";
import { formatInstitutionDisplay } from "@/components/InstitutionSelector";

interface Props {
  orgId: string;
  onViewReviewer: (id: string) => void;
}

export interface ReviewerListItem {
  _type: "active" | "invite";
  _id: string;
  user_id?: string;
  full_name: string;
  email: string;
  institution: string;
  institution_custom_name?: string | null;
  institution_type?: string | null;
  areas: any[];
  keywords?: string[] | null;
  lattes_url?: string | null;
  orcid?: string | null;
  bio?: string | null;
  status: string;
  created_at: string;
  cpf_last4?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  convidado: "Convidado",
  ativo: "Ativo",
  suspenso: "Suspenso",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  convidado: "outline",
  ativo: "default",
  suspenso: "destructive",
};

function getAreaLabel(a: any): string {
  if (typeof a === "string") return a;
  return a?.name || a?.code || "";
}

function getPrimaryArea(areas: any[]): string | null {
  const primary = areas.find((a: any) => a?.role === "primary");
  if (primary) return getAreaLabel(primary);
  return areas.length > 0 ? getAreaLabel(areas[0]) : null;
}

function getSecondaryArea(areas: any[]): string | null {
  const secondary = areas.find((a: any) => a?.role === "secondary");
  if (secondary) return getAreaLabel(secondary);
  return areas.length > 1 ? getAreaLabel(areas[1]) : null;
}

const ReviewersList = ({ orgId, onViewReviewer }: Props) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [areaFilter, setAreaFilter] = useState<string[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingReviewer, setEditingReviewer] = useState<ReviewerListItem | null>(null);
  const [deletingReviewer, setDeletingReviewer] = useState<ReviewerListItem | null>(null);
  const queryClient = useQueryClient();

  const { data: reviewers, isLoading } = useQuery({
    queryKey: ["reviewers", orgId, statusFilter],
    queryFn: async () => {
      const items: ReviewerListItem[] = [];

      // 1. Active reviewers: org_members + profiles + reviewer_profiles
      let omQuery = supabase
        .from("organization_members")
        .select("user_id, status")
        .eq("organization_id", orgId)
        .eq("role", "reviewer" as any);

      if (statusFilter !== "ALL" && statusFilter !== "convidado") {
        omQuery = omQuery.eq("status", statusFilter);
      }

      const { data: members } = await omQuery;
      const memberIds = (members || []).map((m: any) => m.user_id);
      const memberStatusMap = new Map((members || []).map((m: any) => [m.user_id, m.status]));

      if (memberIds.length > 0) {
        const [profilesRes, revProfilesRes] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, email, institution_id, institution_custom_name, institution_type, lattes_url, cpf, phone, created_at").in("user_id", memberIds),
          supabase.from("reviewer_profiles" as any).select("*").eq("org_id", orgId).in("user_id", memberIds) as any,
        ]);
        const profiles = profilesRes.data as any[];
        const revProfiles = (revProfilesRes.data || []) as any[];

        // Fetch institution names for those with institution_id
        const instIds = (profiles || []).map((p: any) => p.institution_id).filter(Boolean);
        let institutionMap = new Map<string, string>();
        if (instIds.length > 0) {
          const { data: insts } = await supabase.from("institutions").select("id, name").in("id", instIds);
          institutionMap = new Map((insts || []).map((i: any) => [i.id, i.name]));
        }

        for (const uid of memberIds) {
          const profile = (profiles || []).find((p: any) => p.user_id === uid);
          const rp = (revProfiles || []).find((r: any) => r.user_id === uid);
          if (!profile) continue;

          const instName = profile.institution_id ? (institutionMap.get(profile.institution_id) || "") : "";

          items.push({
            _type: "active",
            _id: `active:${uid}`,
            user_id: uid,
            full_name: profile.full_name || "",
            email: profile.email || "",
            institution: profile.institution_custom_name || instName || "",
            institution_custom_name: profile.institution_custom_name,
            institution_type: profile.institution_type,
            areas: Array.isArray(rp?.areas) ? rp.areas : [],
            keywords: rp?.keywords || null,
            lattes_url: profile.lattes_url,
            orcid: rp?.orcid || null,
            bio: rp?.bio || null,
            status: memberStatusMap.get(uid) || "ativo",
            created_at: rp?.created_at || profile.created_at || new Date().toISOString(),
            cpf_last4: profile.cpf?.slice(-4) || null,
          });
        }
      }

      // 2. Pending invites (not used yet)
      if (statusFilter === "ALL" || statusFilter === "convidado") {
        const { data: invites } = await supabase
          .from("reviewer_invites")
          .select("*")
          .eq("org_id", orgId)
          .is("used_at", null)
          .order("created_at", { ascending: false });

        for (const inv of invites || []) {
          // Skip if this email is already in the active list
          if (items.some((i) => i.email === inv.email)) continue;

          items.push({
            _type: "invite",
            _id: `invite:${inv.id}`,
            full_name: (inv as any).full_name || inv.email,
            email: inv.email,
            institution: (inv as any).institution || "",
            institution_custom_name: (inv as any).institution_custom_name,
            institution_type: (inv as any).institution_type,
            areas: Array.isArray((inv as any).areas) ? (inv as any).areas : [],
            keywords: (inv as any).keywords || null,
            lattes_url: (inv as any).lattes_url || null,
            orcid: (inv as any).orcid || null,
            bio: null,
            status: "convidado",
            created_at: inv.created_at,
          });
        }
      }

      // Sort by created_at desc
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return items;
    },
  });

  const allAreas = (() => {
    const set = new Map<string, string>();
    reviewers?.forEach((r) => {
      r.areas.forEach((a: any) => {
        const label = getAreaLabel(a);
        if (label) set.set(label, label);
      });
    });
    return Array.from(set.values()).sort();
  })();

  const toggleAreaFilter = (area: string) => {
    setAreaFilter((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ item, newStatus }: { item: ReviewerListItem; newStatus: string }) => {
      if (item._type === "active" && item.user_id) {
        const { error } = await supabase
          .from("organization_members")
          .update({ status: newStatus } as any)
          .eq("user_id", item.user_id)
          .eq("organization_id", orgId)
          .eq("role", "reviewer" as any);
        if (error) throw error;
      }
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        organization_id: orgId,
        entity: "reviewer",
        entity_id: item.user_id || item._id,
        action: "REVIEWER_STATUS_CHANGED",
        metadata_json: { new_status: newStatus },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] });
      toast.success("Status atualizado com sucesso.");
    },
    onError: () => toast.error("Erro ao atualizar status."),
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (item: ReviewerListItem) => {
      // For invites, we need the invite record
      if (item._type === "invite") {
        const inviteId = item._id.replace("invite:", "");
        // Re-send by calling edge function with invite data
        const { error } = await supabase.functions.invoke("send-reviewer-invite", {
          body: { inviteId, orgId },
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] });
      toast.success("Convite reenviado com sucesso.");
    },
    onError: () => toast.error("Erro ao reenviar convite."),
  });

  const filtered = reviewers?.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      const match = r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.institution.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (areaFilter.length > 0) {
      const reviewerAreas = r.areas.map((a: any) => getAreaLabel(a));
      const hasMatch = areaFilter.some((f) => reviewerAreas.includes(f));
      if (!hasMatch) return false;
    }
    return true;
  });

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Avaliadores</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie o banco de avaliadores da organização.</p>
          </div>
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo Avaliador
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, e-mail ou instituição..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="convidado">Convidado</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>

          {allAreas.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Filter className="w-3.5 h-3.5" /> Área
                  {areaFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{areaFilter.length}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 max-h-64 overflow-y-auto">
                {allAreas.map((area) => (
                  <DropdownMenuItem key={area} onClick={(e) => { e.preventDefault(); toggleAreaFilter(area); }} className="gap-2 text-xs">
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${areaFilter.includes(area) ? "bg-primary border-primary" : "border-border"}`}>
                      {areaFilter.includes(area) && <span className="text-primary-foreground text-[9px]">✓</span>}
                    </div>
                    <span className="truncate">{area}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {areaFilter.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">Filtros:</span>
            {areaFilter.map((a) => (
              <Badge key={a} variant="secondary" className="gap-1 text-xs">
                {a}
                <button type="button" onClick={() => toggleAreaFilter(a)}><X className="w-3 h-3" /></button>
              </Badge>
            ))}
            <button type="button" onClick={() => setAreaFilter([])} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar</button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !filtered || filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">Nenhum avaliador encontrado.</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro avaliador
            </Button>
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="grid grid-cols-[1fr_minmax(120px,1fr)_minmax(140px,1.2fr)_90px_90px_40px] gap-3 px-4 py-2.5 bg-muted/50 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>Avaliador</span>
              <span className="hidden sm:block">Instituição</span>
              <span className="hidden md:block">Área</span>
              <span>Status</span>
              <span className="hidden lg:block">Cadastro</span>
              <span />
            </div>

            <div className="divide-y divide-border">
              {filtered.map((r) => {
                const primary = getPrimaryArea(r.areas);
                const secondary = getSecondaryArea(r.areas);

                return (
                  <div key={r._id} className="grid grid-cols-[1fr_minmax(120px,1fr)_minmax(140px,1.2fr)_90px_90px_40px] gap-3 items-center px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-tight">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{r.email}</p>
                    </div>
                    <div className="min-w-0 hidden sm:block">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatInstitutionDisplay(r.institution, null)}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top">{formatInstitutionDisplay(r.institution, null)}</TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="min-w-0 hidden md:flex items-center gap-1.5">
                      {primary ? (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild><span className="text-xs text-muted-foreground truncate">{primary}</span></TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs"><strong>Principal:</strong> {primary}</p>
                              {secondary && <p className="text-xs mt-1"><strong>Secundária:</strong> {secondary}</p>}
                            </TooltipContent>
                          </Tooltip>
                          {secondary && (
                            <Tooltip>
                              <TooltipTrigger asChild><span className="text-[10px] text-primary/70 whitespace-nowrap cursor-default font-medium">+1</span></TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs"><p className="text-xs">{secondary}</p></TooltipContent>
                            </Tooltip>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">—</span>
                      )}
                    </div>
                    <div>
                      <Badge variant={STATUS_VARIANTS[r.status] || "outline"} className="text-[10px]">
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </div>
                    <div className="hidden lg:block">
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onViewReviewer(r._id)}>
                            <Eye className="w-3.5 h-3.5 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          {r._type === "active" && (
                            <DropdownMenuItem onClick={() => setEditingReviewer(r)}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                          )}
                          {r.status === "convidado" && (
                            <DropdownMenuItem onClick={() => resendInviteMutation.mutate(r)}>
                              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Reenviar convite
                            </DropdownMenuItem>
                          )}
                          {r.status === "ativo" && (
                            <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ item: r, newStatus: "suspenso" })} className="text-destructive focus:text-destructive">
                              <Ban className="w-3.5 h-3.5 mr-2" /> Suspender
                            </DropdownMenuItem>
                          )}
                          {r.status === "suspenso" && (
                            <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ item: r, newStatus: "ativo" })}>
                              <UserCheck className="w-3.5 h-3.5 mr-2" /> Reativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeletingReviewer(r)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <NewReviewerModal open={showNewModal} onOpenChange={setShowNewModal} orgId={orgId} />

        {editingReviewer && (
          <EditReviewerModal
            open={!!editingReviewer}
            onOpenChange={(v) => { if (!v) setEditingReviewer(null); }}
            orgId={orgId}
            reviewer={editingReviewer}
          />
        )}

        {deletingReviewer && (
          <DeleteReviewerDialog
            open={!!deletingReviewer}
            onOpenChange={(v) => { if (!v) setDeletingReviewer(null); }}
            orgId={orgId}
            reviewer={deletingReviewer}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default ReviewersList;
