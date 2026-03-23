

## Painel Master do Fomento — Gestão de Organizações

### Contexto
Atualmente o módulo Fomento tem apenas `admin` (administração de usuários). Não existe um conceito de "organizações" dentro do Fomento, nem um painel "master". Precisamos criar toda a infraestrutura.

### Arquitetura

```text
/fomento/master
  ├── Listagem de organizações (cards/tabela)
  └── /fomento/master/nova → Formulário 2 passos
      └── /fomento/master/:id/editar → Edição
```

### 1. Migração de Banco de Dados

**Nova tabela `fomento_organizations`:**
- `id` UUID PK
- `name` TEXT NOT NULL (nome completo)
- `sigla` TEXT
- `emec_code` TEXT (código eMEC)
- `plan` TEXT NOT NULL DEFAULT 'basic' CHECK (basic/pro/enterprise)
- `admin_user_id` UUID REFERENCES auth.users(id) — admin vinculado
- `admin_name` TEXT
- `admin_email` TEXT
- `status` TEXT NOT NULL DEFAULT 'ativo' CHECK (ativo/inativo)
- `created_at`, `updated_at` TIMESTAMPTZ

**RLS Policies:**
- SELECT/INSERT/UPDATE/DELETE restritos a usuários com `fomento_role = 'admin'` (via `has_fomento_admin`)

**Nova função SQL `count_fomento_org_stats`:**
- Retorna contagem de usuários ativos e projetos por organização (para a listagem)

### 2. Edge Function: `invite-fomento-admin`

- Recebe: `email`, `full_name`, `org_id`
- Cria usuário via `supabase.auth.admin.inviteUserByEmail()` (envia magic link automático)
- Se usuário já existe, apenas vincula
- Atualiza `profiles.fomento_role = 'admin'`
- Atualiza `fomento_organizations.admin_user_id`

### 3. Novo Componente: `FomentoMasterPanel.tsx`

**Listagem:**
- Tabela com colunas: Nome/Sigla, Admin (nome + email), Plano, Usuários ativos, Projetos, Status
- Botões: Editar, Desativar/Ativar, Acessar como admin
- Botão "Nova Organização"

**Formulário (2 passos):**

*Passo 1 — Dados da Organização:*
- Busca eMEC (reutilizando lógica existente do `InstitutionSelector`)
- Nome completo, Sigla
- Plano: Select com Basic/Pro/Enterprise

*Passo 2 — Administrador:*
- Nome completo do admin
- E-mail institucional
- Ao salvar: chama edge function `invite-fomento-admin`

### 4. Roteamento

**Arquivo `FomentoPanel.tsx`:**
- Adicionar nav item "Master" (ícone Building2) visível apenas para `fomentoRole === 'admin'`
- Rota `section === "master"` renderiza `FomentoMasterPanel`
- Sub-rotas: `/fomento/master/nova`, `/fomento/master/:id/editar`

### 5. Contexto de Segurança

- Apenas usuários com `fomento_role = 'admin'` veem e acessam o painel master
- A edge function usa `SUPABASE_SERVICE_ROLE_KEY` para criar usuários via Auth Admin API
- RLS na tabela `fomento_organizations` restringe acesso a admins do Fomento

### Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/migrations/xxx_fomento_organizations.sql` |
| Criar | `supabase/functions/invite-fomento-admin/index.ts` |
| Criar | `src/components/fomento/FomentoMasterPanel.tsx` |
| Editar | `src/pages/fomento/FomentoPanel.tsx` (adicionar rota master) |

