# Fase 2.5 — Portais e Experiência por Perfil

Objetivo: cada perfil entra no Service Desk e vê a sua área, não o painel administrativo. Usa o login, membros, grupos e permissões que já existem. O fluxo completo da VPN (IP, chave, arquivo .conf) não entra agora: só deixamos as telas prontas para recebê-lo na Fase 3.

## Áreas e endereços

```text
/servicedesk                 -> leva cada pessoa para a sua área
/servicedesk/portal/*        Portal do Solicitante (aluno e professor)
   inicio | servicos | solicitacoes | notificacoes | cadastro
/servicedesk/prppge/*        Painel PRPPGE (integrantes do grupo PRPPGE)
   dashboard | solicitacoes | prorrogacoes | prazos | divergencias | historico
/servicedesk/dti/*           Painel DTI (integrantes do grupo DTI)
   dashboard | aguardando | ativos | revogacoes | historico
/servicedesk/admin/*         Administração (administrador institucional / geral)
   abas atuais + Usuários e acessos, Serviços, Auditoria
/servicedesk/solicitacao/:id Detalhe da solicitação com linha do tempo (todos, conforme permissão)
```

Quem tem mais de um papel (ex.: administrador que também está no DTI) vê um seletor de área no topo.

## 1. Portal do Solicitante
- Início: saudação, programa/nível (aluno) ou vínculo/situação (professor), matrícula; 4 cartões: Minhas solicitações, Serviços disponíveis, Pendências, Notificações; prazos importantes.
- Serviços: catálogo com "Solicitar".
- Minhas solicitações: protocolo, situação colorida, "Acompanhar".
- Notificações: lista com sino no topo e contador de não lidas.
- Meu cadastro: aluno vê nome, matrícula, programa, nível, ingresso, orientador, prazo regular e vigente; professor vê nome, matrícula, contrato, programa(s) com vínculo, situação e prazo do vínculo (PJ). Edita só e-mail pessoal e celular/WhatsApp. Botão "Informar divergência".

## 2. Painel PRPPGE
- Dashboard: aguardando análise, correções pendentes, prorrogações, prazos próximos.
- "Minha Caixa": tudo cuja etapa atual pertence à PRPPGE.
- Solicitações: tabela Protocolo, Solicitante, Tipo, Serviço, PPG, Recebido, Situação. Ao abrir, uma única tela com dados do solicitante, finalidade, termo aceito e botões Autorizar / Solicitar correção / Indeferir.
- Divergências (move a lista atual para cá) e Histórico. Prorrogações e Prazos ficam com a tela pronta e vazia até a Fase 3.

## 3. Painel DTI
- Dashboard: aguardando configuração, acessos ativos, vencendo em breve, revogações pendentes.
- "Minha Caixa" operacional.
- Aguardando configuração: tela do ticket com espaço reservado para IP, chave pública, arquivo .conf e "Liberar acesso" (desativado, chega na Fase 3).
- Acessos ativos, Revogações (com tela de confirmação reservada) e Histórico.

## 4. Administração
- Mantém tudo que existe hoje.
- Novo "Usuários e acessos": lista única com nome, perfil (aluno, professor, operador, administrador), grupos, contrato e se a conta está ativa no Service Desk.
- "Serviços": lista os serviços cadastrados (somente consulta nesta fase).
- "Auditoria": eventos das solicitações da instituição.

## Partes comuns
- Protocolo único por solicitação: SD-UVV-2026-000142 (sigla da instituição + ano + sequência por instituição), gerado automaticamente; solicitações antigas recebem o seu.
- Linha do tempo visual com data/hora de cada etapa, entrada e saída de cada grupo.
- Notificações internas guardadas no sistema (o e-mail continua como canal externo).
- Busca por protocolo, nome, matrícula; filtros por situação, serviço, programa e período; atalhos Hoje / Pendentes / Atrasados / Vencendo / Concluídos.
- Etiquetas de situação com as mesmas cores em todas as áreas e contadores de pendências nos menus.

## Matriz de permissões
```text
Perfil          Portal  PRPPGE  DTI  Admin  Vê solicitações
Aluno            sim     -       -    -     só as próprias
Professor        sim     -       -    -     só as próprias
Grupo PRPPGE     -       sim     -    -     da instituição em etapa PRPPGE + histórico
Grupo DTI        -       -       sim  -     da instituição em etapa DTI + histórico
Admin instit.    -       sim*    sim* sim   todas da instituição
Admin geral      -       sim*    sim* sim   todas
* acesso de consulta, para acompanhar
```
O acesso a cada painel vem do grupo responsável (código do grupo), não de nomes fixos — outra instituição usa os próprios grupos.

## Detalhes técnicos
- Banco (uma migração): em `sd_requests` adicionar `protocol` (único por organização, gerado por trigger com contador por org/ano), `stage_entered_at`; nova tabela `sd_notifications` (organization_id, user_id, request_id, title, body, read_at) com GRANT para authenticated/service_role, RLS só o próprio usuário lê/marca lida; inserção via funções SECURITY DEFINER existentes (`sd_create_request`, `sd_advance_request`, `sd_resolve_divergence`) que também passam a gravar notificações e `from_group_id`/`to_group_id` em `sd_request_events`. Backfill de protocolo para solicitações existentes.
- Painel de cada grupo: rota genérica por código de grupo; menus de PRPPGE e DTI definidos por configuração do grupo em `sd_settings` (com padrão), seguindo a regra de não fixar regras institucionais no código.
- Front: dividir `ServiceDeskPanel.tsx` em layout com roteador (`ServiceDeskRouter`), `RequesterPortal`, `GroupPanel` (PRPPGE/DTI), `AdminPanel`; componentes comuns em `src/components/servicedesk/common/`: `StatusBadge`, `ProtocolSearch/Filters`, `RequestTimeline` (visual), `NotificationBell`, `MyInbox`, `RequestDetail`. Reaproveitar `RequesterHome` e `GroupQueues` como base.
- Registrar a estrutura de áreas no AGENTS.md.
- Verificação: compilação, testes existentes e telas públicas; telas com login não podem ser testadas aqui (projeto sem sessão de teste), o que ficará informado.

Ao terminar: lista de endereços, matriz de permissões e componentes prontos para a Fase 3.
