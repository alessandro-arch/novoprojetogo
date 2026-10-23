# Operon Fomento: botão "Receber no Telegram"

## O que já existe no banco (conferido)
- `oe_vinculo_telegram` (user_id, token_hash, expira_em, usado_em, created_at), RLS ligado e **sem políticas**: ninguém lê pelo portal.
- `oe_gerar_vinculo_telegram()` (SECURITY DEFINER): exige login, apaga códigos pendentes do usuário, gera token aleatório, guarda só o SHA-256, validade de 15 minutos, devolve o token em claro uma única vez.
- `oe_confirmar_vinculo_telegram(p_token, p_chat_id)` (SECURITY DEFINER): marca o código como usado e faz upsert em `oe_destinatario` (canal telegram, ativo, confirmado_em). O Hermes pode chamá-la com a service role, em vez de gravar direto.
- `oe_destinatario`: política `ALL` com `user_id = auth.uid()`.
- `oe_seguidor_edital.canal_telegram`, `oe_org_config.telegram_canal`, `oe_perfil.consentimento_lgpd` já existem.
- O portal ainda não tem tela "Meus alertas".

Conclusão: não é preciso criar tabela nova nem edge function. A RPC segura já existe e é o caminho certo (atômica, sem expor hash, sem chamada de rede extra).

## Problemas encontrados e correções propostas (migração para aprovar)
1. **Falsa vinculação**: com a política `ALL` atual, o usuário pode inserir sozinho um `oe_destinatario` telegram com `confirmado_em` preenchido e qualquer chat_id. Proposta: trocar por leitura própria + RPC de desconectar.
2. **Status "Aguardando confirmação"**: o portal não consegue ler `oe_vinculo_telegram` (correto). Proposta: RPC que retorna só o estado, nunca o hash.
3. **Limite de tentativas**: um novo código já invalida o anterior; acrescentar no máximo 5 códigos por usuário por hora.
4. **Seguir com Telegram**: impedir `canal_telegram = true` sem destinatário telegram ativo e confirmado (gatilho de validação).

```sql
-- 1. destinatário: usuário só lê; escrita via RPC
DROP POLICY oe_destinatario_proprio ON public.oe_destinatario;
CREATE POLICY oe_destinatario_leitura_propria ON public.oe_destinatario
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.oe_destinatario FROM authenticated, anon;
GRANT SELECT ON public.oe_destinatario TO authenticated;
-- canal de e-mail atual: confirmar antes que nada no portal escreve nele (não escreve hoje)

-- 2. status do vínculo
CREATE OR REPLACE FUNCTION public.oe_status_telegram()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'conectado', EXISTS (SELECT 1 FROM oe_destinatario WHERE user_id = auth.uid()
                  AND canal = 'telegram' AND ativo AND confirmado_em IS NOT NULL),
    'pendente_ate', (SELECT max(expira_em) FROM oe_vinculo_telegram WHERE user_id = auth.uid()
                  AND usado_em IS NULL AND expira_em > now()));
$$;

-- desconectar
CREATE OR REPLACE FUNCTION public.oe_desconectar_telegram()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  UPDATE oe_destinatario SET ativo = false WHERE user_id = auth.uid() AND canal = 'telegram';
  UPDATE oe_seguidor_edital SET canal_telegram = false WHERE user_id = auth.uid();
END $$;

-- 3. limite: recriar oe_gerar_vinculo_telegram com a mesma lógica +
--    RAISE 'limite_codigos' se >= 5 linhas do usuário com created_at > now() - 1 hour
--    (mantém códigos usados/expirados para contagem; apaga só pendentes)

-- 4. gatilho de validação em oe_seguidor_edital
--    BEFORE INSERT OR UPDATE: se NEW.canal_telegram e não houver destinatário
--    telegram ativo e confirmado do NEW.user_id, RAISE 'telegram_nao_conectado'

REVOKE EXECUTE ON FUNCTION public.oe_confirmar_vinculo_telegram(text,text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.oe_gerar_vinculo_telegram(), public.oe_status_telegram(),
  public.oe_desconectar_telegram() TO authenticated;
```
O `REVOKE` na confirmação garante que só o Hermes (service role) vincula chat_id.

## LGPD
`oe_perfil.consentimento_lgpd` é um booleano genérico, sem texto nem canal definido; não cobre de forma explícita o uso do chat. Proposta: aviso curto antes de conectar, sem coluna nova: "Seu chat do Telegram será usado apenas para enviar alertas do Operon Fomento. Você pode desconectar a qualquer momento." O clique em "Receber no Telegram" vale como aceite, e `confirmado_em` registra quando aconteceu. Se você quiser registro formal separado, adiciono `oe_destinatario.consentimento_em` (diga se prefere).

## Portal
- **Nova seção "Meus alertas"** dentro de `/editais` (bloco no painel, sem rota nova), com:
  - aviso LGPD + botão "Receber no Telegram": chama a RPC, abre `https://t.me/<bot>?start=<código>` em nova aba (aberta já no clique, para não ser bloqueada);
  - "Aguardando confirmação no Telegram" com tempo restante e "Gerar novo código";
  - "Telegram conectado" + "Desconectar" (com confirmação);
  - "Entrar no canal Operon Fomento" só se `oe_org_config.telegram_canal` da organização do usuário estiver preenchido (e for link `https://t.me/`).
- Atualização: polling a cada 5 s só enquanto pendente, mais refetch ao voltar o foco da aba.
- **Ficha do edital**: abaixo de "Seguir este edital", opção "Também pelo Telegram". Sem Telegram conectado, mostra "Conecte seu Telegram para receber por lá" com o mesmo botão. Substitui "Avisos por Telegram em breve".
- Nome do bot: `VITE_OPERON_TELEGRAM_BOT` (só o nome de usuário, público). Se ausente, o botão fica oculto com aviso "Telegram indisponível no momento". Token do bot nunca entra no portal.
- Nenhum webhook, nenhuma edge function, nenhuma mensagem enviada pelo portal.

## Para o Hermes (fora do portal)
Ao receber `/start <código>`, chamar `rpc('oe_confirmar_vinculo_telegram', {p_token, p_chat_id})` com service role; `null` = código inválido/expirado, responder pedindo novo código.

## Detalhes técnicos
- Arquivos: `src/lib/operon-telegram.ts` (RPCs, montagem do link, validação do nome do bot e do link do canal), `src/components/operon/TelegramAlertas.tsx`, ajustes em `SeguirEditalButton.tsx`, `operon-portal.ts` (`alterarCanalTelegram`), `EditaisPage.tsx`.
- Erros `limite_codigos` e `telegram_nao_conectado` traduzidos em toast.
- AGENTS.md: regra de vinculação só por RPC/Hermes e nome do bot por variável.

## Testes
- Link: monta `t.me/<bot>?start=<código>` com o bot da variável; sem variável não renderiza botão.
- Estados: conectado, pendente (polling ativo), desconectado (botão); polling para ao conectar.
- Desconectar chama a RPC e só muda após confirmação; erro mantém estado.
- Seguir pelo Telegram bloqueado sem conexão, mostrando orientação.
- Canal: botão só aparece com `telegram_canal` válido; link não `t.me` é ignorado.
- Erro de limite exibe mensagem correta.

## Não alterado
Login, Service Desk, ProjetoGO Fomento, landing, tema, curadoria, IA.
