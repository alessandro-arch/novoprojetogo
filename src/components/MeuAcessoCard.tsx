import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound } from "lucide-react";
import { acessosDoUsuario } from "@/lib/meu-acesso";

// Mostra apenas os papéis do usuário atual já carregados na sessão; nenhuma consulta nova.
const MeuAcessoCard = () => {
  const { globalRole, membership, fomentoRole } = useAuth();
  const itens = acessosDoUsuario({ globalRole, membershipRole: membership?.role ?? null, fomentoRole });
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="w-5 h-5 text-primary" />Meu acesso</CardTitle>
        <CardDescription>Portais e perfis liberados para você. Para mudar, fale com o administrador da sua organização.</CardDescription>
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum perfil atribuído.</p>
        ) : (
          <ul className="space-y-2">
            {itens.map((i) => (
              <li key={`${i.portal}-${i.perfil}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                <span className="text-sm font-medium">{i.portal}</span>
                <Badge variant="secondary">{i.perfil}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default MeuAcessoCard;
