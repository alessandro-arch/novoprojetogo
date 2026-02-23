

# Auditoria de Compliance + Integridade SHA-256 + Arquivamento Imutavel

## Resumo

Implementar um sistema completo de compliance no ProjetoGO com: trilha de auditoria com hash encadeado (anti-tamper), integridade criptografica SHA-256 para propostas e PDFs, bloqueio de edicao apos submissao, interface administrativa com badge de integridade, e arquivamento imutavel de documentos.

---

## Fase 1 -- Banco de Dados (Migration SQL)

### 1.1 Evoluir tabela `audit_logs`

A tabela ja existe com campos basicos. Adicionar as colunas novas:

- `actor_role` (text) -- papel do usuario no momento da acao
- `entity_type` (text) -- tipo de entidade (proposal, review, notice, file)
- `diff` (jsonb) -- apenas campos alterados
- `ip_address` (text, nullable)
- `user_agent` (text, nullable)
- `prev_log_hash` (text) -- hash do log anterior da mesma entidade
- `log_hash` (text) -- SHA-256 encadeado do registro atual

Criar indices:
- `(organization_id, created_at DESC)`
- `(entity_type, entity_id, created_at DESC)`

### 1.2 Evoluir tabela `proposals`

Adicionar colunas de integridade:
- `integrity_hash` (text) -- SHA-256 do snapshot canonical
- `pdf_integrity_hash` (text) -- SHA-256 do PDF final
- `integrity_status` (text, default 'PENDING') -- VERIFIED / MISMATCH / PENDING

### 1.3 Evoluir tabela `edital_submissions`

Adicionar colunas de integridade (espelhando proposals):
- `integrity_hash` (text)
- `pdf_integrity_hash` (text)
- `integrity_status` (text, default 'PENDING')

### 1.4 Funcao PL/pgSQL: `compute_audit_log_hash`

Funcao SECURITY DEFINER que:
1. Busca o ultimo `log_hash` para a mesma `entity_type + entity_id`
2. Concatena: `prev_log_hash + created_at + user_id + action + entity_type + entity_id + diff_normalizado`
3. Calcula SHA-256 usando `encode(digest(..., 'sha256'), 'hex')` (extensao pgcrypto)
4. Retorna `prev_log_hash` e `log_hash`

### 1.5 Trigger melhorado: `fn_audit_trigger_v2`

Substitui o `fn_audit_trigger` atual. Agora:
- Calcula o `diff` (apenas campos alterados em UPDATE)
- Chama `compute_audit_log_hash` para gerar hashes encadeados
- Preenche `entity_type` e `actor_role`
- Registra em `audit_logs` com todos os novos campos

### 1.6 Criar triggers nas tabelas criticas

Tabelas: `proposals`, `reviews`, `review_scores`, `editais`, `edital_submissions`, `proposal_decisions`, `scoring_criteria`

Cada uma com AFTER INSERT/UPDATE/DELETE chamando `fn_audit_trigger_v2`.

### 1.7 Trigger de protecao: `protect_submitted_proposal`

Impede UPDATE nos campos criticos de `edital_submissions` apos `submitted_at IS NOT NULL`. Campos protegidos: `answers`, `cnpq_area_code`, `form_version_id`. Permite alteracoes em: `status`, `integrity_hash`, `pdf_integrity_hash`, `integrity_status`.

### 1.8 RLS adicional

- `audit_logs`: manter politica atual (imutavel, sem UPDATE/DELETE)
- `proposals`/`edital_submissions`: impedir alteracao direta de `integrity_hash` por proponentes (via trigger, nao RLS, pois o campo so deve ser alterado pelo backend)

### 1.9 Habilitar extensao pgcrypto

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

## Fase 2 -- Storage (Bucket de Arquivo)

### 2.1 Criar bucket `archive`

Bucket privado para PDFs finalizados. Politicas:
- **INSERT**: somente via service_role (edge function)
- **SELECT**: admin, manager, reviewer atribuido
- **UPDATE/DELETE**: bloqueado para todos (nao criar politica)

---

## Fase 3 -- Edge Functions

### 3.1 `finalize-proposal-submission`

Nova edge function que:
1. Valida permissoes (usuario e dono da proposta)
2. Busca dados completos da submission
3. Gera snapshot canonical (JSON com chaves ordenadas)
4. Calcula `integrity_hash = SHA-256(snapshot_json)`
5. Gera PDF no backend (HTML simples renderizado)
6. Calcula `pdf_integrity_hash = SHA-256(pdf_bytes)`
7. Upload do PDF para `archive/{org_id}/{edital_id}/{submission_id}.pdf`
8. Atualiza `integrity_hash`, `pdf_integrity_hash`, `integrity_status = 'VERIFIED'` na submission
9. Registra audit_log com action `SUBMIT`
10. Retorna os hashes e o path do arquivo

### 3.2 `verify-proposal-integrity`

Nova edge function que:
1. Valida permissoes (admin/manager da org)
2. Busca submission e recalcula hashes
3. Compara com hashes armazenados
4. Se mismatch: atualiza `integrity_status = 'MISMATCH'` e registra audit_log
5. Se ok: confirma `integrity_status = 'VERIFIED'`
6. Retorna resultado da verificacao

### 3.3 `export-audit-report`

Nova edge function (evolucao do `export-audit-logs` existente) que:
1. Gera PDF contendo: dados da proposta, hashes, timeline de audit_logs, data, usuario exportador
2. Registra audit_log com action `EXPORT_PDF`
3. Retorna o PDF

---

## Fase 4 -- Frontend

### 4.1 Badge de Integridade (`IntegrityBadge.tsx`)

Componente reutilizavel:
- Verde: "Integridade verificada" (VERIFIED)
- Vermelho: "Integridade comprometida" (MISMATCH)
- Cinza: "Pendente" (PENDING)

### 4.2 Evolucao do `AuditLogViewer.tsx`

- Adicionar coluna "Diff" com expansor para ver detalhes
- Filtros por tipo de acao: STATUS_CHANGE, SCORE_CHANGE, EXPORT_PDF, DOWNLOAD_FILE, CREATE, UPDATE, DELETE, SUBMIT
- Exibir `actor_role` em vez de `user_role`
- Exibir indicador de cadeia de hash integra

### 4.3 Aba "Historico de Auditoria" no detalhe da proposta

No `SubmissionsList.tsx`, quando o admin visualiza uma submission:
- Nova aba "Auditoria" com timeline filtrada pela entity_id
- Badge de integridade no topo
- Botao "Verificar Integridade" que chama `verify-proposal-integrity`

### 4.4 Integracao no fluxo de submissao

No `SubmissionForm.tsx`, apos submissao bem-sucedida:
- Chamar `finalize-proposal-submission` para calcular hashes e arquivar PDF
- Exibir badge de integridade na tela de confirmacao

### 4.5 Exportacao de relatorio de auditoria

Botao "Exportar Relatorio" na tela de detalhe da proposta que chama `export-audit-report`.

---

## Detalhes Tecnicos

### Calculo SHA-256 no Backend (Edge Function)

```typescript
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Normalizacao JSON Estavel

Para garantir hashes reproduziveis:
```typescript
function canonicalJson(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}
```

Para objetos aninhados, usar funcao recursiva que ordena chaves em todos os niveis.

### Hash Encadeado no PL/pgSQL

```sql
SELECT encode(
  digest(
    COALESCE(prev_hash, '') || created_at::text || COALESCE(user_id::text, '') 
    || action || entity_type || COALESCE(entity_id::text, '') 
    || COALESCE(diff::text, ''),
    'sha256'
  ), 'hex'
) INTO new_hash;
```

### Arquivos Criados/Modificados

| Arquivo | Acao |
|---|---|
| `supabase/migrations/...compliance.sql` | Migration com todas as alteracoes de schema |
| `supabase/functions/finalize-proposal-submission/index.ts` | Nova edge function |
| `supabase/functions/verify-proposal-integrity/index.ts` | Nova edge function |
| `supabase/functions/export-audit-report/index.ts` | Nova edge function |
| `src/components/org/IntegrityBadge.tsx` | Novo componente |
| `src/components/org/AuditLogViewer.tsx` | Evolucao com diff, filtros, hash chain |
| `src/components/org/SubmissionsList.tsx` | Aba de auditoria, badge de integridade |
| `src/components/proponente/SubmissionForm.tsx` | Integracao com finalize |
| `supabase/config.toml` | JWT config para novas functions |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |

### Ordem de Implementacao

1. Migration SQL (schema + funcoes + triggers + extensao pgcrypto)
2. Storage bucket `archive`
3. Edge functions (finalize, verify, export)
4. Componentes frontend (IntegrityBadge, AuditLogViewer evolucao)
5. Integracao no fluxo de submissao e detalhe da proposta

### Restricoes e Consideracoes

- A extensao `pgcrypto` deve estar disponivel no Supabase (ja vem habilitada por padrao)
- Os triggers substituem o `fn_audit_trigger` atual -- migrar com cuidado para nao perder logs existentes
- PDFs sao gerados como HTML simples no backend (sem dependencia de bibliotecas externas pesadas)
- O bloqueio de edicao apos submissao e feito via trigger, nao apenas RLS, para ser incontornavel

