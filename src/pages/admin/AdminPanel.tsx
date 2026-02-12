import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Loader2, FileText, LogOut, Users, UserCircle, Database } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

interface Org {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

const AdminPanel = () => {
  const { signOut } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchOrgs = async () => {
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOrgs(data as Org[]);
    setLoading(false);
  };

  useEffect(() => { fetchOrgs(); }, []);

  // Check institutions count
  const { data: instCount } = useQuery({
    queryKey: ["institutions-count"],
    queryFn: async () => {
      const { count } = await supabase.from("institutions").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const [seeding, setSeeding] = useState(false);
  const seedInstitutions = async () => {
    setSeeding(true);
    try {
      const resp = await fetch("/data/institutions-emec.csv");
      const csvText = await resp.text();
      const { data, error } = await supabase.functions.invoke("seed-institutions", {
        body: { csvText },
      });
      if (error) throw error;
      toast({ title: `Instituições importadas: ${data.inserted}` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSeeding(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;

    setCreating(true);
    const { error } = await supabase.from("organizations").insert({
      name: newOrgName.trim(),
      slug: newOrgSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    });
    setCreating(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Organização criada!" });
      setNewOrgName("");
      setNewOrgSlug("");
      setDialogOpen(false);
      fetchOrgs();
    }
  };

  const toggleActive = async (org: Org) => {
    await supabase.from("organizations").update({ is_active: !org.is_active }).eq("id", org.id);
    fetchOrgs();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-heading text-foreground">ProjetoGO</h1>
              <p className="text-xs text-muted-foreground">Painel ICCA Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/profile">
              <Button variant="ghost" size="sm"><UserCircle className="w-4 h-4 mr-1" /> Cadastro</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold font-heading text-foreground">Organizações</h2>
            <p className="text-muted-foreground">Gerencie todas as organizações da plataforma</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Nova Organização
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Organização</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Nome da organização" className="mt-1" required />
                </div>
                <div>
                  <Label>Slug (URL)</Label>
                  <Input value={newOrgSlug} onChange={(e) => setNewOrgSlug(e.target.value)} placeholder="minha-organizacao" className="mt-1" required />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Criar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma organização cadastrada</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orgs.map((org) => (
              <div key={org.id} className="bg-card rounded-xl border border-border p-6 flex items-center justify-between hover:shadow-card transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{org.name}</h3>
                    <p className="text-sm text-muted-foreground">/{org.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={org.is_active ? "default" : "secondary"}>
                    {org.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(org)}>
                    {org.is_active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Institutions Seed Section */}
        <div className="mt-10 border-t border-border pt-6">
          <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" /> Banco de Instituições (eMEC)
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {instCount != null ? `${instCount} instituições cadastradas.` : "Carregando..."}
          </p>
          {instCount === 0 && (
            <Button onClick={seedInstitutions} disabled={seeding}>
              {seeding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Importar Lista eMEC (CSV)
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
