# Service Desk Acadêmico — ProjetoGO v1.0 (piloto UVV / VPN CAPES)

Novo módulo em `/servicedesk`, multi-institucional, reaproveitando login, Supabase, Resend, design system e auditoria existentes. Nenhuma regra da UVV fica fixa no código: tudo é configuração cadastrada para a instituição.

## Entrega em 4 fases (cada uma utilizável e testável)

**Fase 1 — Fundação institucional**
- Instituições (reaproveita a tabela de organizações existente, com sigla, logo, domínio, fuso, status), membros e papéis institucionais (Administrador Institucional, Operador, Solicitante Aluno/Professor).
- Grupos responsáveis configuráveis (UVV: PRPPGE, DTI).
- Configurações por instituição: duração Mestrado/Doutorado, tipos de contrato e prazos, antecedência de alertas.
- Painel do Superadmin para criar/ativar instituições.

**Fase 2 — Bases institucionais e importação Excel**
- Programas, alunos (matrícula, nível, ingresso, orientador, situação, prazo regular e prazo vigente), professores (contrato, início, situação) e vínculo professor-programa.
- Importação: Upload → Validação → Preview (novos, alterados, sem alteração, ausentes, inconsistências) → Confirmação. Arquivo preservado em armazenamento privado, com versão e histórico. Ausência em nova base gera ocorrência, nunca revogação automática.

**Fase 3 — Catálogo, solicitação e workflow**
- Primeiro acesso: "Qual é seu vínculo?" + matrícula, validada no servidor com limite de tentativas (anti-enumeração); cadastro complementar (e-mail institucional, pessoal, celular WhatsApp + ciência de comunicações).
- Catálogo por instituição com elegibilidade, formulário, termo versionado e etapas de workflow ligadas a grupos.
- Motor genérico: Solicitação → Etapa → Grupo → Ação → Próxima etapa, com status genéricos e histórico.
- Aceite eletrônico do termo com hash SHA-256, versão, data/hora e dados técnicos.
- Serviço UVV_VPN_CAPES cadastrado: finalidade (com "Outra" exigindo descrição) → PRPPGE autoriza → DTI configura WireGuard manualmente, informa IP/PublicKey e faz upload do .conf (privado, download por link temporário e registrado).

**Fase 4 — Prazos, notificações, prorrogação e revogação**
- Motor de notificações por evento/destinatário/template/antecedência via Resend, com registro de envio e ID Resend.
- Rotina diária: alerta 7 dias antes (e-mail pessoal, CTA "Solicitar prorrogação" para alunos); no vencimento cria tarefa "Revogar VPN" para o DTI.
- Prorrogação: aluno solicita (nova previsão, motivo, justificativa, documento) → PRPPGE decide → altera só o prazo vigente, recalcula alertas, avisa DTI.
- Revogação manual com botão "Confirmar revogação" (operador, data, motivo).
- Dashboards: institucional, por grupo (PRPPGE: análises, correções, prorrogações, prazos 30/60/90/vencidos; DTI: aguardando configuração, VPNs ativas, vencimentos, revogações pendentes).
- Auditoria de todos os eventos relevantes, incluindo downloads.

Fora do escopo (conforme PRD): geração de .conf/Peer, API WireGuard, revogação automática, WhatsApp, app nativo, integrações diretas.

## Detalhes técnicos

- Tenant: `organizations` vira a "instituição" (colunas novas: sigla, logo_url, domain, timezone, status). A tabela `institutions` atual (catálogo eMEC) é mantida intacta para não quebrar cadastros.
- Novas tabelas `sd_*` com `organization_id` obrigatório: `sd_members`, `sd_groups`, `sd_group_members`, `sd_settings`, `sd_programs`, `sd_students`, `sd_faculty`, `sd_faculty_programs`, `sd_imports`, `sd_import_records`, `sd_services`, `sd_service_eligibility`, `sd_workflow_steps`, `sd_service_terms`, `sd_requests`, `sd_request_history`, `sd_signatures`, `sd_vpn_access`, `sd_files`, `sd_extension_requests`, `sd_tasks`, `sd_notifications`.
- Funções SECURITY DEFINER `sd_is_member`, `sd_has_role`, `sd_in_group`; RLS em todas as tabelas filtrando por organização; validações por triggers; auditoria via `fn_audit_trigger` existente.
- Bucket privado `servicedesk` com caminho `{organization_id}/...` e políticas por instituição; downloads por URL assinada via Edge Function que registra o acesso.
- Edge Functions: `sd-validate-enrollment` (rate limit), `sd-import-commit`, `sd-file-url`, `sd-notify`, `sd-daily-deadlines` (agendada via pg_cron).
- Parsing de Excel no navegador (SheetJS) para preview; gravação confirmada no servidor.
- Seed UVV (programas, grupos, prazos 24/48/PJ 24, alerta 7 dias, serviço VPN CAPES e termo v1) via inserção de dados.
- Decisões estruturais registradas em `AGENTS.md`; tarefas das fases em `roadmap.md`.

Ao aprovar, começo pela Fase 1 e sigo fase a fase.
