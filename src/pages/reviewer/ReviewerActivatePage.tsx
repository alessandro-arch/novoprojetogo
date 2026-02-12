import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, KeyRound, X } from "lucide-react";
import { toast } from "sonner";
import CnpqAreaSelector from "@/components/CnpqAreaSelector";
import InstitutionSelector from "@/components/InstitutionSelector";

type Step = "code" | "register" | "success";

const ReviewerActivatePage = () => {
  const [step, setStep] = useState<Step>("code");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Code step
  const [inviteCode, setInviteCode] = useState("");

  // Invite data
  const [invite, setInvite] = useState<any>(null);
  const [reviewer, setReviewer] = useState<any>(null);
  const [orgName, setOrgName] = useState("");

  // Register step
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [institution, setInstitution] = useState({
    institution_id: null as string | null,
    institution_name: "",
    institution_custom_name: null as string | null,
    institution_type: null as string | null,
  });
  const [areas, setAreas] = useState<{ code: string; name: string }[]>([]);
  const [currentArea, setCurrentArea] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [lattesUrl, setLattesUrl] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptConflict, setAcceptConflict] = useState(false);
  const [acceptLgpd, setAcceptLgpd] = useState(false);

  const formatCode = (value: string): string => {
    return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
  };

  const formatCpf = (value: string): string => {
    const clean = value.replace(/\D/g, "").slice(0, 11);
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
    if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
  };

  const validateCpf = (cpfVal: string): boolean => {
    const clean = cpfVal.replace(/\D/g, "");
    if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== parseInt(clean[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    return rest === parseInt(clean[10]);
  };

  const cpfClean = cpf.replace(/\D/g, "");

  const addArea = (value: string) => {
    if (!value) return;
    const parts = value.split(" - ");
    const code = parts[0]?.trim();
    const name = parts.slice(1).join(" - ").trim();
    if (areas.find((a) => a.code === code)) return;
    setAreas([...areas, { code, name }]);
    setCurrentArea(null);
  };

  const removeArea = (code: string) => setAreas(areas.filter((a) => a.code !== code));

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
    }
    setKeywordInput("");
  };

  const handleValidateCode = async () => {
    const code = inviteCode.trim();
    if (code.length < 6) {
      toast.error("O código deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("validate-reviewer-code", {
        body: { invite_code: code },
      });

      if (fnError || data?.error) {
        setError(data?.error || "Código inválido.");
        setLoading(false);
        return;
      }

      setInvite(data.invite);
      setReviewer(data.reviewer);
      setOrgName(data.org_name);
      setFullName(data.reviewer?.full_name || "");

      if (data.reviewer?.institution) {
        setInstitution(prev => ({ ...prev, institution_name: data.reviewer.institution }));
      }

      setStep("register");
    } catch {
      setError("Erro ao validar código.");
    }
    setLoading(false);
  };

  const handleSubmitRegistration = async () => {
    if (!acceptTerms || !acceptConflict || !acceptLgpd) {
      toast.error("Aceite todos os termos para continuar.");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (!validateCpf(cpfClean)) {
      toast.error("CPF inválido.");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Nome completo é obrigatório.");
      return;
    }
    if (areas.length === 0) {
      toast.error("Selecione pelo menos uma área do conhecimento.");
      return;
    }

    setSubmitting(true);

    try {
      const institutionValid = institution.institution_id || institution.institution_custom_name?.trim();

      const { data, error: fnError } = await supabase.functions.invoke("accept-reviewer-code", {
        body: {
          invite_code: inviteCode.trim(),
          password,
          cpf: cpfClean,
          full_name: fullName.trim(),
          institution: institution.institution_name || undefined,
          institution_id: institution.institution_id || undefined,
          institution_custom_name: institution.institution_custom_name || undefined,
          institution_type: institution.institution_type || undefined,
          areas,
          keywords: keywords.length > 0 ? keywords : undefined,
          lattes_url: lattesUrl || undefined,
        },
      });

      if (fnError || data?.error) {
        toast.error(data?.error || "Erro ao completar cadastro.");
        setSubmitting(false);
        return;
      }

      setStep("success");
      toast.success("Cadastro realizado com sucesso!");
    } catch {
      toast.error("Erro inesperado.");
    }
    setSubmitting(false);
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-primary mb-4" />
            <h2 className="text-lg font-bold mb-2">Cadastro Realizado!</h2>
            <p className="text-muted-foreground mb-4">
              Seu cadastro como avaliador foi concluído. Agora você pode acessar o sistema.
            </p>
            <Button onClick={() => window.location.href = "/login"}>Ir para o Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "register") {
    const institutionValid = !!institution.institution_id || (!!institution.institution_custom_name?.trim() && !!institution.institution_type);
    const formValid = fullName.trim() && cpfClean.length === 11 && validateCpf(cpfClean) && password.length >= 6 && areas.length > 0 && acceptTerms && acceptConflict && acceptLgpd;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <CardTitle>Complete seu Cadastro</CardTitle>
            <CardDescription>
              Convite de <strong>{orgName}</strong> — {reviewer?.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome completo <span className="text-destructive">*</span></Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>CPF <span className="text-destructive">*</span></Label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {cpfClean.length === 11 && !validateCpf(cpfClean) && (
                  <p className="text-xs text-destructive">CPF inválido</p>
                )}
              </div>
            </div>

            <InstitutionSelector
              label="Instituição de vínculo"
              required
              value={institution}
              onChange={setInstitution}
            />

            <div className="space-y-1.5">
              <Label>Áreas do Conhecimento (CNPq) <span className="text-destructive">*</span></Label>
              {areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {areas.map((a) => (
                    <Badge key={a.code} variant="secondary" className="gap-1">
                      {a.name || a.code}
                      <button type="button" onClick={() => removeArea(a.code)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <CnpqAreaSelector value={currentArea} onChange={(v) => addArea(v)} />
            </div>

            <div className="space-y-1.5">
              <Label>Palavras-chave</Label>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="Digite e pressione Enter"
                />
                <Button type="button" variant="outline" onClick={addKeyword}>Adicionar</Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {keywords.map((kw) => (
                    <Badge key={kw} variant="outline" className="gap-1">
                      {kw}
                      <button type="button" onClick={() => setKeywords(keywords.filter((k) => k !== kw))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Lattes URL</Label>
              <Input value={lattesUrl} onChange={(e) => setLattesUrl(e.target.value)} placeholder="http://lattes.cnpq.br/..." />
            </div>

            <div className="space-y-1.5">
              <Label>Crie sua senha <span className="text-destructive">*</span></Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(v) => setAcceptTerms(!!v)}
                  className="mt-0.5"
                />
                <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                  Declaro que li e aceito os <strong>Termos de Avaliação e Confidencialidade</strong>, comprometendo-me a manter sigilo sobre todas as propostas avaliadas.
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="conflict"
                  checked={acceptConflict}
                  onCheckedChange={(v) => setAcceptConflict(!!v)}
                  className="mt-0.5"
                />
                <Label htmlFor="conflict" className="text-sm leading-relaxed cursor-pointer">
                  Declaro ausência de conflito de interesse geral para atuar como avaliador, ciente de que conflitos específicos poderão ser declarados por edital.
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="lgpd"
                  checked={acceptLgpd}
                  onCheckedChange={(v) => setAcceptLgpd(!!v)}
                  className="mt-0.5"
                />
                <Label htmlFor="lgpd" className="text-sm leading-relaxed cursor-pointer">
                  Autorizo o tratamento dos meus dados pessoais exclusivamente para a finalidade de avaliação, nos termos da <strong>LGPD (Lei 13.709/2018)</strong>.
                </Label>
              </div>
            </div>

            <Button className="w-full" onClick={handleSubmitRegistration} disabled={!formValid || submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aceitar e Finalizar Cadastro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: code
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-2">
            <KeyRound className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle>Ativar Convite de Avaliador</CardTitle>
          <CardDescription>
            Insira o código de convite fornecido pela organização.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Código do Convite <span className="text-destructive">*</span></Label>
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(formatCode(e.target.value))}
              placeholder="EX: EDITAL-PQ-2026-F1"
              className="font-mono tracking-wider text-center text-lg"
              maxLength={32}
              onKeyDown={(e) => { if (e.key === "Enter") handleValidateCode(); }}
            />
            <p className="text-xs text-muted-foreground">Apenas letras, números e hífen. 6 a 32 caracteres.</p>
          </div>

          <Button className="w-full" onClick={handleValidateCode} disabled={inviteCode.length < 6 || loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Validar Código
          </Button>

          <div className="text-center pt-2">
            <a href="/login" className="text-sm text-primary hover:underline">
              Já tenho conta — Fazer login
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewerActivatePage;
