

## Separação de Perfis: Superadmin vs Admin de Organização no Fomento

### Problema
Atualmente `fomento_role` tem apenas dois valores: `'admin'` e `'gestor'`. Ambos veem tudo. Não existe distinção entre o dono do SaaS (você, alessandro@icca.org.br) e o administrador de uma organização (ex: admin da UVV). Além disso, não existe `organization_id` em `fomento_projects` nem em `profiles`, impossibilitando isolamento por organização.

### Solução

#### 1. Alterações no Banco de Dados (4 migrações)

**Migração A — Adicionar `'superadmin'` como valor válido e coluna `fomento_org_id` em profiles**
- Alterar trigger `validate_fomento_role` para aceitar `'superadmin'`, `'admin'`, `'gestor'`
- Adicionar coluna `fomento_org_id UUID REFERENCES fomento_organizations(id)` na tabela `profiles` (nullable)
- Atualizar funções `has_fomento_admin` → checar `'superadmin'` (dono do SaaS)
- Criar função `has_fomento_superadmin(_user_id uuid)` para checar superadmin
- Atualizar `set_fomento_role` para aceitar `'superadmin'`

**Migração B — Adicionar `organization_id` em `fomento_projects`**
- Adicionar coluna `organization_id UUID REFERENCES fomento_organizations(id)` em `fomento_projects` (nullable por compatibilidade)
- Adicionar `organization_id` em `fomento_documents` (já existe mas verificar uso)

**Migração C — Reforçar RLS com isolamento por organização**
- `fomento_projects`: superadmin vê tudo; admin/gestor vê apenas `organization_id` da sua org
- `fomento_rubricas`, `fomento_team`: via join com `fomento_projects.organization_id`
- `fomento_documents`: mesma lógica
- `fomento_organizations`: superadmin vê tudo; admin/gestor vê apenas a própria

**Migração D — Definir superadmin**
- `UPDATE profiles SET fomento_role = 'superadmin' WHERE email = 'alessandro@icca.org.br'`

#### 2. Alterações no Contexto de Auth

**`FomentoAuthContext.tsx`**
- Adicionar `fomentoOrgId: string | null` ao contexto
- Buscar `fomento_org_id` junto com `fomento_role` na query de profile
- Expor `isSuperadmin` helper (`fomentoRole === 'superadmin'`)

#### 3. Alterações no Painel (`FomentoPanel.tsx`)

**Sidebar condicional:**
- superadmin → Dashboard, Projetos, Alertas, Organizações, Administração
- admin → Dashboard, Projetos, Alertas, Administração (sem Organizações)
- gestor → Dashboard, Projetos, Alertas (sem Administração e Organizações)

**Proteção de rotas:**
- `/fomento/master` → apenas superadmin (já existe, trocar check de `'admin'` para `'superadmin'`)
- `/fomento/admin` → superadmin OU admin (superadmin vê todos; admin vê apenas sua org)

#### 4. Queries filtradas por organização

**Todos os componentes que buscam `fomento_projects`:**
- `FomentoDashboardView`, `FomentoProjectsList`, `FomentoAlerts`, `FomentoProjectForm`
- Se não-superadmin: adicionar `.eq("organization_id", fomentoOrgId)` nas queries
- Se superadmin: buscar tudo (sem filtro)

**`FomentoProjectForm` — ao salvar:**
- Incluir `organization_id: fomentoOrgId` no payload de insert

**`FomentoAdmin` — gestão de usuários:**
- Superadmin: vê todos os usuários fomento (comportamento atual)
- Admin de org: filtrar apenas usuários com mesmo `fomento_org_id`

#### 5. Funções SQL atualizadas

- `list_fomento_users()` → aceitar parâmetro opcional `_org_id` para filtrar
- `set_fomento_role()` → permitir que superadmin OU admin da mesma org atribua roles
- `has_fomento_admin()` → renomear semântica: checar superadmin para operações globais
- Criar `is_fomento_org_admin(_user_id, _org_id)` para checar admin de org específica

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| Migration SQL (4) | Schema + RLS + dados |
| `FomentoAuthContext.tsx` | Adicionar `fomentoOrgId` |
| `FomentoPanel.tsx` | Sidebar condicional, proteção rotas |
| `FomentoProtectedRoute.tsx` | Aceitar superadmin |
| `FomentoDashboardView.tsx` | Filtro por org |
| `FomentoProjectsList.tsx` | Filtro por org |
| `FomentoProjectForm.tsx` | Salvar com org_id, filtro |
| `FomentoAlerts.tsx` | Filtro por org |
| `FomentoAdmin.tsx` | Filtro por org para admin |
| `FomentoMasterPanel.tsx` | Restringir a superadmin |

### Detalhes Técnicos

A abordagem usa a coluna `fomento_org_id` em `profiles` para vincular cada usuário a uma organização fomento. O superadmin (`fomento_role = 'superadmin'`) não precisa de `fomento_org_id`. As RLS policies usam funções `SECURITY DEFINER` para evitar recursão. A filtragem dupla (RLS no banco + filtro no frontend) garante segurança em profundidade.

