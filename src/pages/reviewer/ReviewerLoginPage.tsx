import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ReviewerLoginPage = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const isCpfInput = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(identifier.trim());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed || !password.trim()) return;
    setLoading(true);

    let email = trimmed;

    if (isCpfInput) {
      const cpfClean = trimmed.replace(/\D/g, "");
      const encoder = new TextEncoder();
      const data = encoder.encode(cpfClean);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const cpfHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      // Use RPC function to look up email by CPF hash (bypasses RLS)
      const { data: emailResult, error: rpcError } = await supabase.rpc("lookup_email_by_cpf_hash", { p_cpf_hash: cpfHash });

      if (rpcError || !emailResult) {
        toast({ title: "CPF não encontrado", description: "Nenhum avaliador com este CPF.", variant: "destructive" });
        setLoading(false);
        return;
      }
      email = emailResult as string;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      navigate("/reviewer");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-2"><ShieldCheck className="w-6 h-6 text-primary-foreground" /></div>
          <CardTitle className="text-xl">Portal do Avaliador</CardTitle>
          <CardDescription>Acesse com seu e-mail ou CPF cadastrado como avaliador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="identifier">E-mail ou CPF</Label><Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="seu@email.com ou 000.000.000-00" required /></div>
            <div className="space-y-1.5"><Label htmlFor="password">Senha</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Entrar</Button>
          </form>
          <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div></div>
          <Link to="/reviewer/activate" className="block"><Button variant="outline" className="w-full" size="lg"><KeyRound className="w-4 h-4 mr-2" />Ativar acesso com código de convite</Button></Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors justify-center"><ArrowLeft className="w-4 h-4" /> Voltar ao início</Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewerLoginPage;
