# Operon Fomento: complemento do "Receber no Telegram"

O plano anterior já está no ar (conexão, aguardando confirmação, desconectar, canal da organização, opção por edital, regras no banco). Este complemento só acrescenta os quatro pontos abaixo; o resto continua como está.

## 1. Aviso de conta no Telegram
Em "Meus alertas", antes do botão e junto do aviso de LGPD:
"Para receber alertas no Telegram você precisa de uma conta no Telegram (app gratuito)." com link "Baixar o Telegram" para https://telegram.org/apps (nova aba).
Aparece só enquanto o Telegram não estiver conectado.

## 2. E-mail continua padrão
- Frase em "Meus alertas": "Os alertas por e-mail continuam ativos. O Telegram é opcional e adicional."
- Nada muda no e-mail: seguir edital continua gravando e-mail ligado; desconectar ou nunca conectar o Telegram não afeta o e-mail (já é assim no banco; o texto do diálogo de desconectar já diz isso).

## 3. Código expirado
Hoje o status só informa código pendente e válido; depois de 15 minutos a tela volta silenciosamente ao botão. Proposta:
- Ajustar a consulta de status para informar também `expirado_em`: o código mais recente do usuário que não foi usado e já venceu (nas últimas 24 horas), apenas se não houver código válido nem Telegram conectado.
- Na tela: "O código expirou antes da confirmação no Telegram. Gere um novo código para tentar de novo." com o botão "Gerar novo código".
- O polling continua só enquanto há código pendente; ao expirar, a próxima consulta já mostra a mensagem.

Migração proposta (para aprovar):
```sql
CREATE OR REPLACE FUNCTION public.oe_status_telegram()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ultimo AS (
    SELECT expira_em, usado_em FROM oe_vinculo_telegram
     WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1)
  SELECT jsonb_build_object(
    'conectado', EXISTS (SELECT 1 FROM oe_destinatario WHERE user_id = auth.uid()
                  AND canal = 'telegram' AND ativo AND confirmado_em IS NOT NULL),
    'pendente_ate', (SELECT expira_em FROM ultimo WHERE usado_em IS NULL AND expira_em > now()),
    'expirado_em', (SELECT expira_em FROM ultimo WHERE usado_em IS NULL
                     AND expira_em <= now() AND expira_em > now() - interval '24 hours'));
$$;
```
Permissões da função permanecem as mesmas (somente usuários logados). A tela só mostra "expirado" quando não está conectado.

## 4. "Seguir este edital" sem Telegram
Quando o usuário segue o edital e não tem Telegram conectado: a chave "Também pelo Telegram" aparece desligada e desativada, com a dica "Conecte seu Telegram em Meus alertas" (link que leva a /editais, na seção Meus alertas). Substitui o botão de conectar que hoje aparece ali. Com Telegram conectado, a chave funciona como já funciona.

## Detalhes técnicos
- `operon-telegram.ts`: `StatusTelegram` ganha `expirado_em`.
- `TelegramAlertas.tsx`: textos de conta, e-mail padrão e expirado; âncora `id="meus-alertas"`.
- `SeguirEditalButton.tsx`: Switch desativado + link `/editais#meus-alertas` quando não conectado.

## Testes
- Desconectado: mostra aviso de conta com link https://telegram.org/apps e a frase do e-mail padrão.
- Conectado: aviso de conta não aparece.
- Status com `expirado_em`: mostra a mensagem de expirado e "Gerar novo código".
- Seguindo sem Telegram: chave desativada e dica "Conecte seu Telegram em Meus alertas"; com Telegram: chave ativa.
- Seguir sem Telegram continua gravando e-mail ligado e Telegram desligado.

## Não alterado
Login, Service Desk, ProjetoGO Fomento, landing, tema, curadoria, IA, demais regras do Telegram já aplicadas.
