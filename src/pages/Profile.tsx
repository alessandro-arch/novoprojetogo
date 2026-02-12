import { useState, useEffect } from "react";
import { useProfile, UserProfile } from "@/hooks/use-profile";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, User, MapPin, Briefcase, Bell, FileText, LogOut, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import CnpqAreaSelector from "@/components/CnpqAreaSelector";
import InstitutionSelector from "@/components/InstitutionSelector";
import { Link } from "react-router-dom";

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const Profile = () => {
  const { signOut } = useAuth();
  const { profile, loading, updateProfile, completionPercentage } = useProfile();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    if (profile) setForm({ ...profile });
  }, [profile]);

  const set = (field: keyof UserProfile, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    const { full_name, phone, whatsapp, cpf, mini_bio, photo_url,
      address_street, address_number, address_complement, address_neighborhood,
      address_city, address_state, address_country, address_zipcode,
      institution_affiliation, institution_id, institution_custom_name, institution_type,
      professional_position, lattes_url, instagram_url,
      linkedin_url, research_area_cnpq, keywords,
      receive_news, receive_editais_notifications } = form;

    const { error } = await updateProfile({
      full_name, phone, whatsapp, cpf, mini_bio, photo_url,
      address_street, address_number, address_complement, address_neighborhood,
      address_city, address_state, address_country, address_zipcode,
      institution_affiliation, institution_id, institution_custom_name, institution_type,
      professional_position, lattes_url, instagram_url,
      linkedin_url, research_area_cnpq, keywords,
      receive_news: receive_news ?? true,
      receive_editais_notifications: receive_editais_notifications ?? true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado com sucesso!" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pct = completionPercentage();

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
              <p className="text-xs text-muted-foreground">Meu Cadastro</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Status Banner */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {profile?.profile_completed ? (
                <Badge variant="secondary" className="text-primary border-primary/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Cadastro completo
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                  <AlertCircle className="w-3 h-3 mr-1" /> Cadastro incompleto
                </Badge>
              )}
            </div>
            <span className="text-sm text-muted-foreground font-medium">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
          {!profile?.profile_completed && (
            <p className="text-sm text-muted-foreground mt-2">
              Complete seu cadastro para poder submeter propostas e participar de editais.
            </p>
          )}
        </div>

        {/* Dados Pessoais */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" /> Dados Pessoais
            </CardTitle>
            <CardDescription>Informações de identificação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Nome completo <span className="text-destructive">*</span></Label>
                <Input id="full_name" value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" value={form.cpf || ""} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={form.email || ""} disabled className="mt-1 bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">O email não pode ser alterado.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Telefone <span className="text-destructive">*</span></Label>
                <Input id="phone" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" value={form.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="mini_bio">Mini bio</Label>
              <Textarea id="mini_bio" value={form.mini_bio || ""} onChange={(e) => set("mini_bio", e.target.value)} placeholder="Breve descrição sobre você..." className="mt-1" rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5 text-primary" /> Endereço
            </CardTitle>
            <CardDescription>Endereço residencial</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="address_street">Rua</Label>
                <Input id="address_street" value={form.address_street || ""} onChange={(e) => set("address_street", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="address_number">Número</Label>
                <Input id="address_number" value={form.address_number || ""} onChange={(e) => set("address_number", e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address_complement">Complemento</Label>
                <Input id="address_complement" value={form.address_complement || ""} onChange={(e) => set("address_complement", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="address_neighborhood">Bairro</Label>
                <Input id="address_neighborhood" value={form.address_neighborhood || ""} onChange={(e) => set("address_neighborhood", e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="address_city">Cidade <span className="text-destructive">*</span></Label>
                <Input id="address_city" value={form.address_city || ""} onChange={(e) => set("address_city", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="address_state">Estado <span className="text-destructive">*</span></Label>
                <select id="address_state" value={form.address_state || ""} onChange={(e) => set("address_state", e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Selecione</option>
                  {BRAZILIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="address_zipcode">CEP</Label>
                <Input id="address_zipcode" value={form.address_zipcode || ""} onChange={(e) => set("address_zipcode", e.target.value)} placeholder="00000-000" className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Atuação Profissional */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="w-5 h-5 text-primary" /> Atuação Profissional e Acadêmica
            </CardTitle>
            <CardDescription>Informações acadêmicas e de pesquisa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InstitutionSelector
              label="Vínculo institucional"
              required
              value={{
                institution_id: form.institution_id || null,
                institution_name: form.institution_affiliation || "",
                institution_custom_name: form.institution_custom_name || null,
                institution_type: form.institution_type || null,
              }}
              onChange={(val) =>
                setForm((prev) => ({
                  ...prev,
                  institution_id: val.institution_id,
                  institution_affiliation: val.institution_name,
                  institution_custom_name: val.institution_custom_name,
                  institution_type: val.institution_type,
                }))
              }
            />
            <div>
              <Label htmlFor="professional_position">Cargo / Função</Label>
              <Input id="professional_position" value={form.professional_position || ""} onChange={(e) => set("professional_position", e.target.value)} placeholder="Professor, pesquisador..." className="mt-1" />
            </div>
            <div>
              <CnpqAreaSelector
                label="Área do Conhecimento (CNPq)"
                value={form.research_area_cnpq || ""}
                onChange={(v) => set("research_area_cnpq", v)}
                required
              />
            </div>
            <div>
              <Label htmlFor="keywords">Palavras-chave (separadas por vírgula)</Label>
              <Input id="keywords" value={(form.keywords || []).join(", ")} onChange={(e) => set("keywords", e.target.value.split(",").map((k: string) => k.trim()).filter(Boolean))} placeholder="educação, inclusão, políticas públicas" className="mt-1" />
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="lattes_url">Currículo Lattes</Label>
                <Input id="lattes_url" value={form.lattes_url || ""} onChange={(e) => set("lattes_url", e.target.value)} placeholder="http://lattes.cnpq.br/..." className="mt-1" />
              </div>
              <div>
                <Label htmlFor="linkedin_url">LinkedIn</Label>
                <Input id="linkedin_url" value={form.linkedin_url || ""} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/..." className="mt-1" />
              </div>
              <div>
                <Label htmlFor="instagram_url">Instagram</Label>
                <Input id="instagram_url" value={form.instagram_url || ""} onChange={(e) => set("instagram_url", e.target.value)} placeholder="@usuario" className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferências */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="w-5 h-5 text-primary" /> Preferências
            </CardTitle>
            <CardDescription>Notificações e comunicações</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Receber novidades</p>
                <p className="text-xs text-muted-foreground">Receba informações sobre novos recursos da plataforma</p>
              </div>
              <Switch checked={form.receive_news ?? true} onCheckedChange={(v) => set("receive_news", v)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Notificações de editais</p>
                <p className="text-xs text-muted-foreground">Receba avisos sobre novos editais publicados</p>
              </div>
              <Switch checked={form.receive_editais_notifications ?? true} onCheckedChange={(v) => set("receive_editais_notifications", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pb-8">
          <Button onClick={handleSave} size="lg" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Cadastro
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
